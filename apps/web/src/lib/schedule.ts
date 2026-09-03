import type { Appointment } from '@/lib/types';

/**
 * Calendar arithmetic for the agenda.
 *
 * Kept out of the component because the week view was placing appointments by
 * `getDay()` alone — the day of the week, with no check that the appointment
 * fell in the week on screen. Every Tuesday appointment in the salon's history
 * was drawn on this Tuesday.
 */

export function startOfDay(date: Date): Date {
    const copy = new Date(date);
    copy.setHours(0, 0, 0, 0);
    return copy;
}

export function addDays(date: Date, days: number): Date {
    const copy = new Date(date);
    copy.setDate(copy.getDate() + days);
    return copy;
}

export function isSameDay(a: Date, b: Date): boolean {
    return (
        a.getFullYear() === b.getFullYear() &&
        a.getMonth() === b.getMonth() &&
        a.getDate() === b.getDate()
    );
}

/** Monday of the week containing `date`, at midnight. */
export function startOfWeek(date: Date): Date {
    const day = date.getDay();
    return startOfDay(addDays(date, day === 0 ? -6 : 1 - day));
}

/** The seven days of the week containing `date`, Monday first. */
export function weekDays(date: Date): Date[] {
    const monday = startOfWeek(date);
    return Array.from({ length: 7 }, (_, index) => addDays(monday, index));
}

export function isCancelled(appointment: Appointment): boolean {
    return appointment.status === 'cancelled';
}

/** Appointments that start on `day`, earliest first. Cancelled ones excluded. */
export function appointmentsOn(appointments: Appointment[], day: Date): Appointment[] {
    return appointments
        .filter(appointment => !isCancelled(appointment))
        .filter(appointment => isSameDay(new Date(appointment.datetime_start), day))
        .sort((a, b) => a.datetime_start.localeCompare(b.datetime_start));
}

export interface PositionedAppointment {
    appointment: Appointment;
    /** Column index 0-6, Monday first. */
    dayIndex: number;
    /** Minutes from midnight. */
    startMinutes: number;
    /** Length in minutes, taken from the appointment's own end time. */
    durationMinutes: number;
    /** Which lane within its overlap group, and how many lanes that group needs. */
    lane: number;
    lanes: number;
}

function minutesInto(date: Date): number {
    return date.getHours() * 60 + date.getMinutes();
}

/**
 * Places a week's appointments on the grid, splitting simultaneous ones into
 * side-by-side lanes.
 *
 * Without lanes, two clients booked at the same hour were drawn on top of each
 * other and neither name could be read.
 */
export function layOutWeek(appointments: Appointment[], week: Date[]): PositionedAppointment[] {
    const placed: PositionedAppointment[] = [];

    week.forEach((day, dayIndex) => {
        const forDay = appointmentsOn(appointments, day);

        // Group appointments that overlap in time; each group gets its own lanes.
        const groups: Appointment[][] = [];
        let current: Appointment[] = [];
        let groupEnd = -Infinity;

        for (const appointment of forDay) {
            const start = minutesInto(new Date(appointment.datetime_start));
            const end = minutesInto(new Date(appointment.datetime_end));

            if (current.length > 0 && start < groupEnd) {
                current.push(appointment);
                groupEnd = Math.max(groupEnd, end);
            } else {
                if (current.length) groups.push(current);
                current = [appointment];
                groupEnd = end;
            }
        }
        if (current.length) groups.push(current);

        for (const group of groups) {
            group.forEach((appointment, lane) => {
                const start = new Date(appointment.datetime_start);
                const end = new Date(appointment.datetime_end);
                const startMinutes = minutesInto(start);
                const endMinutes = minutesInto(end);

                placed.push({
                    appointment,
                    dayIndex,
                    startMinutes,
                    // An appointment ending past midnight would otherwise be
                    // given a negative height.
                    durationMinutes: Math.max(15, endMinutes - startMinutes),
                    lane,
                    lanes: group.length,
                });
            });
        }
    });

    return placed;
}

/**
 * The hour range the grid needs to show: wide enough for every appointment in
 * view, and never narrower than the salon's usual day.
 */
export function visibleHourRange(
    placed: PositionedAppointment[],
    fallback: { from: number; to: number } = { from: 8, to: 21 }
): { from: number; to: number } {
    if (placed.length === 0) return fallback;

    const earliest = Math.min(...placed.map(item => Math.floor(item.startMinutes / 60)));
    const latest = Math.max(
        ...placed.map(item => Math.ceil((item.startMinutes + item.durationMinutes) / 60))
    );

    return {
        from: Math.min(fallback.from, earliest),
        to: Math.max(fallback.to, latest),
    };
}
