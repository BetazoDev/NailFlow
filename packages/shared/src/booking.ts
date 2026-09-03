import type { DayOfWeek, DaySchedule, Service, StaffDaySchedule } from './domain';

/**
 * Pure booking arithmetic shared by the API (which enforces it) and the web app
 * (which previews it). Keeping one implementation is what stops the summary
 * screen and the confirmed appointment from disagreeing on price or duration.
 */

export interface BookingTotals {
    /** Sum of every selected service's price. */
    price: number;
    /** Sum of every selected service's duration, in minutes. */
    durationMinutes: number;
    /** Sum of every selected service's deposit. */
    requiredAdvance: number;
}

export function calculateTotals(services: readonly Pick<Service, 'estimated_price' | 'duration_minutes' | 'required_advance'>[]): BookingTotals {
    return services.reduce<BookingTotals>(
        (totals, service) => ({
            price: totals.price + toNumber(service.estimated_price),
            durationMinutes: totals.durationMinutes + toNumber(service.duration_minutes),
            requiredAdvance: totals.requiredAdvance + toNumber(service.required_advance),
        }),
        { price: 0, durationMinutes: 0, requiredAdvance: 0 }
    );
}

/** `pg` returns NUMERIC columns as strings; normalise before doing maths. */
export function toNumber(value: unknown): number {
    const parsed = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
}

/** "HH:mm" → minutes past midnight. Returns null for malformed input. */
export function timeToMinutes(time: string): number | null {
    const match = /^(\d{1,2}):(\d{2})$/.exec(time);
    if (!match) return null;
    const hours = Number(match[1]);
    const minutes = Number(match[2]);
    if (hours > 23 || minutes > 59) return null;
    return hours * 60 + minutes;
}

/** Minutes past midnight → "HH:mm". */
export function minutesToTime(minutes: number): string {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export interface OpeningHours {
    /** "HH:mm" */
    start: string;
    /** "HH:mm" */
    end: string;
}

/**
 * The salon's hours for a given weekday, or null when it is closed.
 * `fallback` applies when the tenant has not configured that day at all.
 */
export function salonHoursFor(
    schedule: readonly DaySchedule[] | undefined,
    day: DayOfWeek,
    fallback: OpeningHours
): OpeningHours | null {
    const entry = schedule?.find(item => item.day === day);
    if (!entry) return fallback;
    if (!entry.active) return null;
    return { start: entry.start || fallback.start, end: entry.end || fallback.end };
}

/** A staff member's own hours for a weekday, or null when they are off. */
export function staffHoursFor(
    schedule: readonly StaffDaySchedule[] | undefined,
    day: DayOfWeek
): OpeningHours | null {
    const entry = schedule?.find(item => item.day_of_week === day);
    if (!entry) return null;
    if (entry.active === false) return null;
    return { start: entry.start_time, end: entry.end_time };
}

/**
 * The window where salon and staff are both available — the later start and the
 * earlier end. Returns null when the two do not overlap.
 */
export function intersectHours(a: OpeningHours, b: OpeningHours): OpeningHours | null {
    const start = a.start > b.start ? a.start : b.start;
    const end = a.end < b.end ? a.end : b.end;
    return start < end ? { start, end } : null;
}
