import { DateTime } from 'luxon';
import {
    intersectHours,
    minutesToTime,
    salonHoursFor,
    staffHoursFor,
    timeToMinutes,
    type DayOfWeek,
    type OpeningHours,
    type TimeSlot,
    type Tenant,
} from '@nailflow/shared';
import { env } from '../config/env';
import { query } from '../db/pool';
import { ApiError } from '../middleware/errors';

/**
 * Slot generation.
 *
 * A start time is offered when all of these hold:
 *   - the salon is open, and the staff member is working
 *   - the whole appointment fits before closing time
 *   - it does not overlap a confirmed or awaiting-payment appointment
 *   - it is not held by another client mid-checkout
 *   - it respects the minimum booking notice (spec §4)
 */

export interface AvailabilityRequest {
    tenant: Tenant;
    /** "YYYY-MM-DD" in the tenant's timezone. */
    date: string;
    staffId: string;
    /** Total duration of every service the client picked. */
    durationMinutes: number;
}

interface Interval {
    start: DateTime;
    end: DateTime;
}

export function tenantTimezone(tenant: Tenant): string {
    return tenant.settings?.timezone || env.defaults.timezone;
}

export async function getAvailableSlots({
    tenant,
    date,
    staffId,
    durationMinutes,
}: AvailabilityRequest): Promise<TimeSlot[]> {
    const zone = tenantTimezone(tenant);
    const day = DateTime.fromISO(date, { zone });

    if (!day.isValid) {
        throw ApiError.badRequest(`"${date}" is not a valid YYYY-MM-DD date`);
    }

    const hours = await workingHoursFor(tenant, day, staffId);
    if (!hours) return [];

    const openMinutes = timeToMinutes(hours.start);
    const closeMinutes = timeToMinutes(hours.end);
    if (openMinutes === null || closeMinutes === null) return [];

    const [booked, held] = await Promise.all([
        bookedIntervals(tenant.id, staffId, date, zone),
        heldSlots(tenant.id, staffId, zone),
    ]);

    // Clients cannot book inside the notice window (spec §4: 7 days by default).
    const earliestStart = DateTime.now().setZone(zone).plus({ days: env.booking.minAdvanceDays });

    const slots: TimeSlot[] = [];
    const step = env.booking.slotIntervalMinutes;

    for (let minute = openMinutes; minute + durationMinutes <= closeMinutes; minute += step) {
        const start = day.set({ hour: Math.floor(minute / 60), minute: minute % 60, second: 0, millisecond: 0 });
        const end = start.plus({ minutes: durationMinutes });

        if (start < earliestStart) continue;
        if (booked.some(interval => start < interval.end && end > interval.start)) continue;
        if (held.some(lock => lock.hasSame(start, 'minute'))) continue;

        slots.push({ time: minutesToTime(minute), available: true });
    }

    return slots;
}

/** Salon hours for the day, narrowed to the staff member's own schedule. */
async function workingHoursFor(
    tenant: Tenant,
    day: DateTime,
    staffId: string
): Promise<OpeningHours | null> {
    const weekday = (day.weekday % 7) as DayOfWeek; // Luxon: 1=Mon…7=Sun → 0=Sun…6=Sat

    const salon = salonHoursFor(tenant.settings?.weekly_schedule, weekday, {
        start: env.defaults.openingTime,
        end: env.defaults.closingTime,
    });
    if (!salon) return null;

    const result = await query<{ weekly_schedule: unknown }>(
        'SELECT weekly_schedule FROM staff WHERE id = $1 AND tenant_id = $2 AND active = TRUE',
        [staffId, tenant.id]
    );

    const row = result.rows[0];
    if (!row) return null; // Unknown or inactive staff member: nothing to offer.

    const staffSchedule = Array.isArray(row.weekly_schedule) ? row.weekly_schedule : undefined;
    const staff = staffHoursFor(staffSchedule, weekday);

    // No personal schedule means "follows the salon".
    if (!staff) return staffSchedule?.length ? null : salon;

    return intersectHours(salon, staff);
}

async function bookedIntervals(
    tenantId: string,
    staffId: string,
    date: string,
    zone: string
): Promise<Interval[]> {
    const result = await query<{ datetime_start: Date; datetime_end: Date }>(
        `SELECT datetime_start, datetime_end
         FROM appointments
         WHERE tenant_id = $1
           AND staff_id = $2
           AND status IN ('confirmed', 'pending_payment')
           AND (datetime_start AT TIME ZONE $4)::date = $3::date`,
        [tenantId, staffId, date, zone]
    );

    return result.rows.map(row => ({
        start: DateTime.fromJSDate(row.datetime_start).setZone(zone),
        end: DateTime.fromJSDate(row.datetime_end).setZone(zone),
    }));
}

async function heldSlots(tenantId: string, staffId: string, zone: string): Promise<DateTime[]> {
    const result = await query<{ slot_time: Date }>(
        `SELECT slot_time FROM slot_locks
         WHERE tenant_id = $1 AND staff_id = $2 AND expires_at > NOW()`,
        [tenantId, staffId]
    );
    return result.rows.map(row => DateTime.fromJSDate(row.slot_time).setZone(zone));
}

/** Reserve a slot while the client completes checkout. */
export async function holdSlot(
    tenantId: string,
    staffId: string,
    slotStart: DateTime
): Promise<void> {
    const expiresAt = DateTime.now().plus({ minutes: env.booking.slotHoldMinutes }).toJSDate();
    await query(
        `INSERT INTO slot_locks (tenant_id, staff_id, slot_time, expires_at)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (tenant_id, staff_id, slot_time) DO UPDATE SET expires_at = EXCLUDED.expires_at`,
        [tenantId, staffId, slotStart.toJSDate(), expiresAt]
    );
}

export async function releaseSlot(
    tenantId: string,
    staffId: string,
    slotStart: DateTime
): Promise<void> {
    await query(
        'DELETE FROM slot_locks WHERE tenant_id = $1 AND staff_id = $2 AND slot_time = $3',
        [tenantId, staffId, slotStart.toJSDate()]
    );
}

/** Remove locks whose hold window has elapsed. */
export async function purgeExpiredLocks(): Promise<number> {
    const result = await query('DELETE FROM slot_locks WHERE expires_at <= NOW()');
    return result.rowCount ?? 0;
}
