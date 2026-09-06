import { query } from '../db/pool';
import { firebaseMessaging } from '../lib/firebase';
import { createLogger, errorContext } from '../lib/logger';

const log = createLogger('push');

/**
 * Push notifications to the people who run a salon.
 *
 * A salon owner is not sitting in the panel waiting: she is doing someone's
 * nails. A booking that only appears on a screen she is not looking at is a
 * booking she finds out about hours later.
 *
 * Devices are registered per salon, so a woman who runs two salons gets each
 * one's bookings on the same phone, and staff of one salon never receive
 * another's.
 */

export async function registerDevice(
    tenantId: string,
    uid: string,
    token: string
): Promise<void> {
    await query(
        `INSERT INTO push_devices (token, tenant_id, uid, updated_at)
         VALUES ($1, $2, $3, NOW())
         ON CONFLICT (token) DO UPDATE SET
            tenant_id  = EXCLUDED.tenant_id,
            uid        = EXCLUDED.uid,
            updated_at = NOW()`,
        [token, tenantId, uid]
    );
}

export async function forgetDevice(token: string): Promise<void> {
    await query('DELETE FROM push_devices WHERE token = $1', [token]);
}

/**
 * Sends to every device registered for a salon.
 *
 * Tokens that the service reports as gone are deleted rather than retried:
 * a phone that was reinstalled or a browser whose permission was revoked would
 * otherwise fail on every booking, forever.
 */
export async function notifySalon(
    tenantId: string,
    notification: { title: string; body: string; link?: string }
): Promise<number> {
    const messaging = firebaseMessaging();
    if (!messaging) return 0;

    const devices = await query<{ token: string }>(
        'SELECT token FROM push_devices WHERE tenant_id = $1',
        [tenantId]
    );
    if (devices.rowCount === 0) return 0;

    const tokens = devices.rows.map(row => row.token);

    try {
        const response = await messaging.sendEachForMulticast({
            tokens,
            notification: { title: notification.title, body: notification.body },
            webpush: {
                fcmOptions: notification.link ? { link: notification.link } : undefined,
                notification: { icon: '/icon-192.png', badge: '/icon-192.png' },
            },
        });

        const dead = response.responses
            .map((result, index) => (result.success ? null : { result, token: tokens[index] }))
            .filter((entry): entry is { result: (typeof response.responses)[number]; token: string } =>
                entry !== null
            )
            .filter(entry => {
                const code = entry.result.error?.code ?? '';
                return (
                    code.includes('registration-token-not-registered') ||
                    code.includes('invalid-argument')
                );
            });

        for (const entry of dead) {
            await forgetDevice(entry.token);
        }

        if (dead.length) {
            log.info('Dropped devices that no longer accept notifications', {
                tenantId,
                count: dead.length,
            });
        }

        return response.successCount;
    } catch (error) {
        // A booking must never fail because a notification could not be sent.
        log.warn('Could not send the push notification', { tenantId, ...errorContext(error) });
        return 0;
    }
}
