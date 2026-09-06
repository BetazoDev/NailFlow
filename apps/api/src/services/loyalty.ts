import type { LoyaltySettings } from '@nailflow/shared';
import { query } from '../db/pool';
import { triggerAutomation } from './notifications';
import { createLogger, errorContext } from '../lib/logger';

const log = createLogger('loyalty');

/**
 * Tells the salon when a client has earned her reward.
 *
 * Counted from the appointments themselves rather than a running tally: a
 * counter drifts the moment an appointment is cancelled or corrected, and the
 * salon would be promising a reward the client did not earn — or worse,
 * refusing one she did.
 *
 * Clients are identified by phone. It is the one thing a salon reliably has for
 * a returning client, and the one the client gives the same way every time.
 */
export async function checkReward(
    tenantId: string,
    appointmentId: string,
    clientPhone: string | null,
    loyalty: LoyaltySettings | undefined
): Promise<void> {
    if (!loyalty?.enabled || !clientPhone) return;

    try {
        const visits = await query<{ count: string }>(
            `SELECT COUNT(*) AS count FROM appointments
             WHERE tenant_id = $1
               AND client_phone = $2
               AND status IN ('confirmed', 'completed')`,
            [tenantId, clientPhone]
        );

        const total = Number(visits.rows[0]?.count ?? 0);
        if (total < loyalty.visits_required) return;

        // Only the appointment that completes the count announces it. Claiming
        // the flag in the same statement that reads it is what stops two
        // concurrent confirmations from both sending the message.
        const claimed = await query(
            `UPDATE appointments SET loyalty_notified = TRUE
             WHERE id = $1 AND loyalty_notified = FALSE`,
            [appointmentId]
        );
        if (!claimed.rowCount) return;

        await triggerAutomation(tenantId, 'loyalty.earned', {
            appointment_id: appointmentId,
            client_phone: clientPhone,
            visits: total,
            visits_required: loyalty.visits_required,
            reward_type: loyalty.reward_type,
            discount_value: loyalty.discount_value ?? null,
        });

        log.info('Client earned her reward', { tenantId, visits: total });
    } catch (error) {
        // A booking must never fail because we could not count visits.
        log.warn('Could not check the loyalty reward', { tenantId, ...errorContext(error) });
    }
}
