import cron, { type ScheduledTask } from 'node-cron';
import { env } from '../config/env';
import { query } from '../db/pool';
import { triggerAutomation } from '../services/notifications';
import { createLogger, errorContext } from '../lib/logger';

const log = createLogger('reminders');

/**
 * Reminds each client the day before her appointment.
 *
 * Runs hourly and looks at a one-hour window a day ahead, so an appointment is
 * reminded about once and roughly 24 hours in advance whatever the hour it was
 * booked for. A daily job at a fixed time would remind a 9am client 23 hours
 * ahead and a 9pm client 11 hours ahead.
 *
 * `reminded_at` is what makes it once: without it, a job that runs while the
 * window still overlaps sends the same reminder twice, and the client stops
 * trusting the messages.
 */
interface DueRow {
    id: string;
    tenant_id: string;
    client_name: string;
    client_phone: string | null;
    client_email: string | null;
    datetime_start: Date;
    price: string | null;
}

export async function sendDueReminders(): Promise<number> {
    const result = await query<DueRow>(
        `UPDATE appointments SET reminded_at = NOW()
         WHERE id IN (
             SELECT id FROM appointments
             WHERE status = 'confirmed'
               AND reminded_at IS NULL
               AND datetime_start BETWEEN NOW() + INTERVAL '23 hours'
                                      AND NOW() + INTERVAL '24 hours'
             FOR UPDATE SKIP LOCKED
         )
         RETURNING id, tenant_id, client_name, client_phone, client_email,
                   datetime_start, price`
    );

    for (const appointment of result.rows) {
        await triggerAutomation(appointment.tenant_id, 'booking.reminder', {
            appointment_id: appointment.id,
            client_name: appointment.client_name,
            client_phone: appointment.client_phone,
            client_email: appointment.client_email,
            starts_at: appointment.datetime_start.toISOString(),
            total: appointment.price ? Number(appointment.price) : null,
        });
    }

    return result.rowCount ?? 0;
}

async function run(): Promise<void> {
    try {
        const sent = await sendDueReminders();
        if (sent > 0) log.info('Reminders sent', { count: sent });
    } catch (error) {
        log.error('Reminder run failed', errorContext(error));
    }
}

export function scheduleReminderJob(): ScheduledTask {
    log.info('Scheduling reminders', { cron: env.retention.reminderCron });
    return cron.schedule(env.retention.reminderCron, run);
}
