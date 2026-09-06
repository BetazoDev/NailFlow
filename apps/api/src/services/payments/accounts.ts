import { query } from '../../db/pool';
import { open, openMaybe, seal, secretsEnabled } from '../../lib/secretbox';
import { createLogger, errorContext } from '../../lib/logger';
import type { PaymentAccount, ProviderId } from './types';

const log = createLogger('payment-accounts');

interface Row {
    tenant_id: string;
    provider: ProviderId;
    mp_user_id: string | null;
    access_token: string | null;
    refresh_token: string | null;
    access_expires_at: Date | null;
    webhook_secret: string | null;
    stripe_account_id: string | null;
    charges_enabled: boolean;
    connected_at: Date | null;
}

const COLUMNS = `tenant_id, provider, mp_user_id, access_token, refresh_token,
                 access_expires_at, webhook_secret, stripe_account_id,
                 charges_enabled, connected_at`;

/**
 * Opens the sealed columns.
 *
 * A row that cannot be opened is treated as no account at all rather than
 * crashing the request: it means the key was rotated or the row was tampered
 * with, and in both cases the salon has to reconnect. Bookings that need no
 * deposit keep working meanwhile.
 */
function hydrate(row: Row): PaymentAccount | null {
    try {
        return {
            tenantId: row.tenant_id,
            provider: row.provider,
            externalId: row.mp_user_id ?? row.stripe_account_id,
            accessToken: openMaybe(row.access_token),
            refreshToken: openMaybe(row.refresh_token),
            accessExpiresAt: row.access_expires_at,
            webhookSecret: openMaybe(row.webhook_secret),
            stripeAccountId: row.stripe_account_id,
            chargesEnabled: row.charges_enabled,
            connectedAt: row.connected_at,
        };
    } catch (error) {
        log.error('Could not open a salon payment account; it must be reconnected', {
            tenantId: row.tenant_id,
            ...errorContext(error),
        });
        return null;
    }
}

/** The salon's connected account, or null when she has not connected one. */
export async function accountFor(tenantId: string): Promise<PaymentAccount | null> {
    if (!secretsEnabled()) return null;

    const result = await query<Row>(
        `SELECT ${COLUMNS} FROM payment_accounts WHERE tenant_id = $1`,
        [tenantId]
    );

    const row = result.rows[0];
    return row ? hydrate(row) : null;
}

/**
 * Finds the salon behind a Stripe Connect event.
 *
 * Connect delivers every connected account's events to the platform's single
 * endpoint, naming the account in the event body — so this is how a webhook
 * learns whose booking it is about.
 */
export async function accountByStripeId(stripeAccountId: string): Promise<PaymentAccount | null> {
    if (!secretsEnabled()) return null;

    const result = await query<Row>(
        `SELECT ${COLUMNS} FROM payment_accounts WHERE stripe_account_id = $1`,
        [stripeAccountId]
    );

    const row = result.rows[0];
    return row ? hydrate(row) : null;
}

export interface MercadoPagoConnection {
    tenantId: string;
    mpUserId: string;
    accessToken: string;
    refreshToken: string;
    accessExpiresAt: Date;
}

/** Stores a Mercado Pago authorisation, replacing whatever the salon had. */
export async function saveMercadoPago(connection: MercadoPagoConnection): Promise<void> {
    await query(
        `INSERT INTO payment_accounts
            (tenant_id, provider, mp_user_id, access_token, refresh_token,
             access_expires_at, charges_enabled, connected_at, updated_at)
         VALUES ($1, 'mercadopago', $2, $3, $4, $5, TRUE, NOW(), NOW())
         ON CONFLICT (tenant_id) DO UPDATE SET
            provider          = 'mercadopago',
            mp_user_id        = EXCLUDED.mp_user_id,
            access_token      = EXCLUDED.access_token,
            refresh_token     = EXCLUDED.refresh_token,
            access_expires_at = EXCLUDED.access_expires_at,
            stripe_account_id = NULL,
            charges_enabled   = TRUE,
            connected_at      = COALESCE(payment_accounts.connected_at, NOW()),
            updated_at        = NOW()`,
        [
            connection.tenantId,
            connection.mpUserId,
            seal(connection.accessToken),
            seal(connection.refreshToken),
            connection.accessExpiresAt,
        ]
    );

    log.info('Mercado Pago connected', { tenantId: connection.tenantId });
}

/** Replaces just the tokens after a refresh, leaving the rest of the row alone. */
export async function updateMercadoPagoTokens(
    tenantId: string,
    tokens: { accessToken: string; refreshToken: string; accessExpiresAt: Date }
): Promise<void> {
    await query(
        `UPDATE payment_accounts
         SET access_token = $2, refresh_token = $3, access_expires_at = $4, updated_at = NOW()
         WHERE tenant_id = $1`,
        [tenantId, seal(tokens.accessToken), seal(tokens.refreshToken), tokens.accessExpiresAt]
    );
}

/**
 * The salon's own webhook signing secret, copied from her Mercado Pago
 * dashboard. MP signs each notification with the secret of the account that
 * received the payment, so there is one per salon and no platform-wide value.
 */
export async function setMercadoPagoWebhookSecret(
    tenantId: string,
    secret: string
): Promise<void> {
    await query(
        `UPDATE payment_accounts SET webhook_secret = $2, updated_at = NOW()
         WHERE tenant_id = $1 AND provider = 'mercadopago'`,
        [tenantId, seal(secret)]
    );
}

/**
 * Records a Stripe connected account.
 *
 * `chargesEnabled` starts false: Stripe creates the account immediately but
 * only clears it for charges once the salon has finished verification, and a
 * checkout attempted before then fails at the gateway.
 */
export async function saveStripe(tenantId: string, stripeAccountId: string): Promise<void> {
    await query(
        `INSERT INTO payment_accounts
            (tenant_id, provider, stripe_account_id, charges_enabled, connected_at, updated_at)
         VALUES ($1, 'stripe', $2, FALSE, NOW(), NOW())
         ON CONFLICT (tenant_id) DO UPDATE SET
            provider          = 'stripe',
            stripe_account_id = EXCLUDED.stripe_account_id,
            mp_user_id        = NULL,
            access_token      = NULL,
            refresh_token     = NULL,
            access_expires_at = NULL,
            webhook_secret    = NULL,
            connected_at      = COALESCE(payment_accounts.connected_at, NOW()),
            updated_at        = NOW()`,
        [tenantId, stripeAccountId]
    );

    log.info('Stripe account recorded', { tenantId, stripeAccountId });
}

/** Stripe tells us when an account becomes able to take money. */
export async function setChargesEnabled(
    stripeAccountId: string,
    enabled: boolean
): Promise<void> {
    await query(
        `UPDATE payment_accounts SET charges_enabled = $2, updated_at = NOW()
         WHERE stripe_account_id = $1`,
        [stripeAccountId, enabled]
    );
}

/** Disconnects the salon's gateway. Past appointments keep their payment ids. */
export async function disconnect(tenantId: string): Promise<void> {
    await query('DELETE FROM payment_accounts WHERE tenant_id = $1', [tenantId]);
    log.info('Payment account disconnected', { tenantId });
}

/** What the panel may show about a connection: status, never credentials. */
export interface AccountSummary {
    provider: ProviderId;
    connected: boolean;
    chargesEnabled: boolean;
    /** Mercado Pago only: without it her webhooks cannot be verified. */
    webhookSecretSet: boolean;
    connectedAt: string | null;
}

export async function summaryFor(tenantId: string): Promise<AccountSummary | null> {
    const result = await query<Row>(
        `SELECT ${COLUMNS} FROM payment_accounts WHERE tenant_id = $1`,
        [tenantId]
    );

    const row = result.rows[0];
    if (!row) return null;

    return {
        provider: row.provider,
        connected: true,
        chargesEnabled: row.charges_enabled,
        webhookSecretSet: Boolean(row.webhook_secret),
        connectedAt: row.connected_at?.toISOString() ?? null,
    };
}

/** Re-seals a value under the current key. Used by the platform panel only. */
export function sealForStorage(value: string): string {
    return seal(value);
}

/** Exposed for the webhook, which needs the raw secret to verify a signature. */
export function openSecret(sealed: string): string {
    return open(sealed);
}
