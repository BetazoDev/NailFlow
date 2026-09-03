import { env } from '../config/env';
import { createLogger, errorContext } from '../lib/logger';

const log = createLogger('n8n');

export type AutomationEvent = 'booking.initiated' | 'booking.paid' | 'booking.cancelled';

/**
 * Fire-and-forget notification to the n8n automation workflow (WhatsApp
 * reminders and confirmations). A failure here must never fail the booking, so
 * errors are logged rather than propagated.
 */
export async function triggerAutomation(
    tenantId: string,
    event: AutomationEvent,
    payload: Record<string, unknown>
): Promise<void> {
    if (!env.n8n.webhookUrl) return;

    try {
        const response = await fetch(env.n8n.webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                tenant_id: tenantId,
                event,
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
