import { query } from '../db/pool';
import { env } from '../config/env';
import { createLogger, errorContext } from '../lib/logger';

const log = createLogger('notifications');

export type AutomationEvent =
    | 'booking.initiated'
    | 'booking.paid'
    | 'booking.cancelled'
    | 'booking.reminder'
    | 'loyalty.earned';

/**
 * Who to tell, and how to reach them.
 *
 * The automation used to receive only a tenant id, which is enough to file the
 * event and nothing else: an automation cannot send the salon her confirmation
 * without knowing her address, and looking it up would mean giving n8n database
 * access. Every recipient the event needs travels with it.
 */
interface Recipients {
    salon_name: string | null;
    salon_domain: string;
    salon_email: string | null;
    salon_phone: string | null;
    salon_whatsapp: string | null;
}

const recipientCache = new Map<string, { value: Recipients; expiresAt: number }>();

/** Contact details change rarely; every booking re-reading them does not pay. */
const CACHE_TTL_MS = 5 * 60 * 1000;

async function recipientsFor(tenantId: string): Promise<Recipients | null> {
    const cached = recipientCache.get(tenantId);
    if (cached && cached.expiresAt > Date.now()) return cached.value;

    try {
        const result = await query<Recipients>(
            `SELECT name AS salon_name, domain AS salon_domain, owner_email AS salon_email,
                    owner_phone AS salon_phone, owner_whatsapp AS salon_whatsapp
             FROM tenants WHERE id = $1`,
            [tenantId]
        );

        const row = result.rows[0];
        if (!row) return null;

        recipientCache.set(tenantId, { value: row, expiresAt: Date.now() + CACHE_TTL_MS });
        return row;
    } catch (error) {
        // Losing the salon's address must not lose the notification: the
        // automation can still reach the client, which is the more urgent half.
        log.warn('Could not read the salon contact details', {
            tenantId,
            ...errorContext(error),
        });
        return null;
    }
}

/** Forget a salon's cached contact details after they change. */
export function forgetRecipients(tenantId: string): void {
    recipientCache.delete(tenantId);
}

/**
 * Fire-and-forget notification to the automation workflow, which turns it into
 * the emails and WhatsApp messages the salon and her client receive.
 *
 * A failure here must never fail the booking: the appointment is already made,
 * and refusing it because a webhook timed out would be worse than a missing
 * message. Errors are logged, not propagated.
 */
export async function triggerAutomation(
    tenantId: string,
    event: AutomationEvent,
    payload: Record<string, unknown>
): Promise<void> {
    if (!env.n8n.webhookUrl) return;

    const recipients = await recipientsFor(tenantId);

    try {
        const response = await fetch(env.n8n.webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                tenant_id: tenantId,
                event,
                ...recipients,
                ...payload,
                timestamp: new Date().toISOString(),
            }),
            signal: AbortSignal.timeout(5_000),
        });

        if (!response.ok) {
            log.warn('Automation webhook rejected', { event, status: response.status });
            return;
        }
        log.debug('Automation webhook sent', { event, tenantId });
    } catch (error) {
        log.warn('Automation webhook failed', { event, ...errorContext(error) });
    }
}
