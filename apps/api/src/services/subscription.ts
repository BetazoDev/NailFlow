import { DateTime } from 'luxon';
import { query } from '../db/pool';
import { triggerAutomation } from './notifications';
import { createLogger, errorContext } from '../lib/logger';

const log = createLogger('subscription');

/**
 * Whether a salon is paid up, and what happens when she is not.
 *
 * Diabolical charges a monthly fee and takes nothing from each booking, so this
 * is the only revenue there is — and until now the `subscription` field existed
 * but nothing ever read it.
 *
 * How the fee is *collected* is deliberately not decided here. `markPaid` is
 * the single seam: call it from a billing webhook, from the platform panel
 * after a transfer lands, or by hand. Everything else in the product depends
 * only on the state it leaves behind.
 */

export type SubscriptionStatus = 'active' | 'trial' | 'cancelled';

export interface Subscription {
    status: SubscriptionStatus;
    plan: string;
    /** When the paid-for period ends. Absent means it has never been set. */
    current_period_end?: string;
}

/**
 * Days a salon keeps working after her period ends.
 *
 * Cutting a salon off the morning a payment is late would punish her clients
 * for a bank delay. A week is long enough to notice and fix, short enough to
 * mean something.
 */
export const GRACE_DAYS = 7;

export type Standing = 'ok' | 'grace' | 'suspended';

/**
 * Where a salon stands right now.
 *
 * A cancelled salon is suspended immediately: cancelling is a decision, not an
 * oversight, so there is nothing to be lenient about.
 */
export function standingOf(subscription: Subscription | null | undefined): Standing {
    if (!subscription) return 'ok';
    if (subscription.status === 'cancelled') return 'suspended';

    const endsAt = subscription.current_period_end;
    if (!endsAt) return 'ok';

    const end = DateTime.fromISO(endsAt);
    if (!end.isValid) return 'ok';

    const now = DateTime.now();
    if (now <= end) return 'ok';
    return now <= end.plus({ days: GRACE_DAYS }) ? 'grace' : 'suspended';
}

/** Days left before a salon in grace is suspended. Null when she is not in grace. */
export function graceDaysLeft(subscription: Subscription | null | undefined): number | null {
    if (standingOf(subscription) !== 'grace' || !subscription?.current_period_end) return null;

    const deadline = DateTime.fromISO(subscription.current_period_end).plus({ days: GRACE_DAYS });
    return Math.max(0, Math.ceil(deadline.diff(DateTime.now(), 'days').days));
}

/**
 * Records that a salon has paid, extending her period.
 *
 * Extends from whichever is later, the old period end or today: paying early
 * should add a month, not throw the extra days away, and paying late should not
 * buy a month that is already half spent.
 */
export async function markPaid(tenantId: string, months = 1): Promise<Subscription> {
    const current = await query<{ subscription: Subscription }>(
        'SELECT subscription FROM tenants WHERE id = $1',
        [tenantId]
    );

    const existing = current.rows[0]?.subscription;
    const previousEnd = existing?.current_period_end
        ? DateTime.fromISO(existing.current_period_end)
        : null;

    const from =
        previousEnd?.isValid && previousEnd > DateTime.now() ? previousEnd : DateTime.now();

    const next: Subscription = {
        status: 'active',
        plan: existing?.plan ?? 'standard',
        current_period_end: from.plus({ months }).toISO()!,
    };

    // Replacing the object drops `warned_at` with it, so the next lapse warns
    // again instead of staying silent because a previous one already had.
    await query('UPDATE tenants SET subscription = $2::jsonb WHERE id = $1', [
        tenantId,
        JSON.stringify(next),
    ]);

    log.info('Subscription extended', { tenantId, until: next.current_period_end });
    return next;
}

/**
 * Warns salons whose period has just run out.
 *
 * Notifies once per lapse rather than daily: a salon who gets the same warning
 * every morning stops reading it, which is the opposite of what a warning is
 * for. The stamp is cleared whenever a payment extends the period.
 */
export async function warnLapsedSalons(): Promise<number> {
    const result = await query<{ id: string; name: string | null; subscription: Subscription }>(
        `UPDATE tenants SET subscription = subscription || jsonb_build_object('warned_at', NOW()::text)
         WHERE (subscription->>'status') <> 'cancelled'
           AND (subscription->>'current_period_end') IS NOT NULL
           AND (subscription->>'current_period_end')::timestamptz < NOW()
           AND (subscription->>'warned_at') IS NULL
         RETURNING id, name, subscription`
    );

    for (const salon of result.rows) {
        await triggerAutomation(salon.id, 'subscription.lapsed', {
            salon: salon.name,
            grace_days: GRACE_DAYS,
        }).catch(error =>
            log.warn('Could not warn a lapsed salon', { tenantId: salon.id, ...errorContext(error) })
        );
    }

    return result.rowCount ?? 0;
}
