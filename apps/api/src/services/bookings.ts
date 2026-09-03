import crypto from 'node:crypto';
import { DateTime } from 'luxon';
import {
    calculateTotals,
    toNumber,
    type AppointmentStatus,
    type CreateBookingRequest,
    type Service,
    type Tenant,
} from '@nailflow/shared';
import { query, transaction } from '../db/pool';
import { ApiError } from '../middleware/errors';
import { tenantTimezone } from './availability';
import { env } from '../config/env';

export function newId(): string {
    return crypto.randomUUID();
}

export interface PreparedBooking {
    services: Service[];
    totals: ReturnType<typeof calculateTotals>;
    start: DateTime;
    end: DateTime;
}

/**
 * Validates a booking request against the tenant's own data and computes the
 * authoritative price and duration.
 *
 * Prices and durations are read from the database, never from the request body:
 * the client sends *which* services it wants, and the server decides what they
 * cost. Services are also scoped to the tenant, so a booking cannot reference
 * another salon's catalogue.
 */
export async function prepareBooking(
    tenant: Tenant,
    request: CreateBookingRequest
): Promise<PreparedBooking> {
    const result = await query<Service>(
        `SELECT * FROM services
         WHERE tenant_id = $1 AND id = ANY($2::text[]) AND active = TRUE`,
        [tenant.id, request.service_ids]
    );

    if (result.rows.length !== request.service_ids.length) {
        throw ApiError.badRequest('One or more selected services are unavailable');
    }

    // Preserve the order the client picked, so the primary service is stable.
    const byId = new Map(result.rows.map(service => [service.id, service]));
    const services = request.service_ids.map(id => byId.get(id)!);

    const totals = calculateTotals(services);
    if (totals.durationMinutes <= 0) {
        throw ApiError.badRequest('The selected services have no duration configured');
    }

    const zone = tenantTimezone(tenant);
    const start = DateTime.fromISO(`${request.date}T${request.time}`, { zone });
    if (!start.isValid) {
        throw ApiError.badRequest('Invalid date or time');
    }

    const earliest = DateTime.now().setZone(zone).plus({ days: env.booking.minAdvanceDays });
    if (start < earliest) {
        throw ApiError.badRequest(
            `Bookings must be made at least ${env.booking.minAdvanceDays} days in advance`
        );
    }

    return { services, totals, start, end: start.plus({ minutes: totals.durationMinutes }) };
}

export interface CreatedAppointment {
    id: string;
    status: AppointmentStatus;
}

/**
 * Writes the appointment, its service lines, and releases the slot hold in one
 * transaction — so a mid-write failure cannot leave a half-booked appointment
 * or a slot locked forever.
 *
 * The overlap check runs inside the transaction: two clients confirming the
 * same slot at the same moment would otherwise both pass an earlier check.
 */
export async function createAppointment(params: {
    tenant: Tenant;
    request: CreateBookingRequest;
    prepared: PreparedBooking;
    status: AppointmentStatus;
}): Promise<CreatedAppointment> {
    const { tenant, request, prepared, status } = params;
    const id = newId();

    await transaction(async tx => {
        const clash = await tx.query(
            `SELECT 1 FROM appointments
             WHERE tenant_id = $1
               AND staff_id = $2
               AND status IN ('confirmed', 'pending_payment')
               AND datetime_start < $4
               AND datetime_end > $3
             LIMIT 1`,
            [tenant.id, request.staff_id, prepared.start.toISO(), prepared.end.toISO()]
        );

        if (clash.rowCount) {
            throw ApiError.conflict('That time was just taken. Please pick another slot.');
        }

        await tx.query(
            `INSERT INTO appointments (
                id, tenant_id, client_name, client_phone, client_email,
                service_id, staff_id, datetime_start, datetime_end,
                status, notes, price, payment_method, image_urls, image_url
             ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
            [
                id,
                tenant.id,
                request.client_name,
                request.client_phone,
                request.client_email ?? null,
                prepared.services[0].id,
                request.staff_id,
                prepared.start.toISO(),
                prepared.end.toISO(),
                status,
                request.notes ?? null,
                prepared.totals.price,
                request.payment_method ?? null,
                JSON.stringify(request.image_urls ?? []),
                request.image_urls?.[0] ?? null,
            ]
        );

        for (const [position, service] of prepared.services.entries()) {
            await tx.query(
                `INSERT INTO appointment_services (appointment_id, service_id, position)
                 VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
                [id, service.id, position]
            );
        }

        // The client is no longer "choosing" — the appointment itself now blocks the slot.
        await tx.query(
            'DELETE FROM slot_locks WHERE tenant_id = $1 AND staff_id = $2 AND slot_time = $3',
            [tenant.id, request.staff_id, prepared.start.toJSDate()]
        );
    });

    return { id, status };
}

/** Marks a booking paid. Returns null when the appointment no longer exists. */
export async function confirmPayment(
    appointmentId: string,
    paymentRef: string
): Promise<{ tenant_id: string; client_name: string; client_phone: string | null } | null> {
    const result = await query<{ tenant_id: string; client_name: string; client_phone: string | null }>(
        `UPDATE appointments
         SET status = 'confirmed', advance_paid = TRUE, payment_ref = $2
         WHERE id = $1 AND status = 'pending_payment'
         RETURNING tenant_id, client_name, client_phone`,
        [appointmentId, paymentRef]
    );
    return result.rows[0] ?? null;
}

/** Total deposit due, rounded to cents. */
export function depositFor(prepared: PreparedBooking): number {
    return Math.round(toNumber(prepared.totals.requiredAdvance) * 100) / 100;
}
