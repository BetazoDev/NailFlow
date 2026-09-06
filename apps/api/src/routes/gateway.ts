import crypto from 'node:crypto';
import { Router } from 'express';
import { env } from '../config/env';
import { query } from '../db/pool';
import { ApiError, asyncHandler } from '../middleware/errors';
import { requireTenantOwner } from '../middleware/auth';
import { tenantOf } from '../middleware/tenant';
import { secretsEnabled } from '../lib/secretbox';
import {
    disconnect,
    saveMercadoPago,
    saveStripe,
    setMercadoPagoWebhookSecret,
    summaryFor,
} from '../services/payments/accounts';
import { authorizationUrl, exchangeCode } from '../services/payments/mercadopago';
import {
    chargesEnabled,
    createConnectedAccount,
    onboardingLink,
} from '../services/payments/stripe';
import { setChargesEnabled } from '../services/payments/accounts';
import { createLogger, errorContext } from '../lib/logger';

const log = createLogger('gateway');
export const gatewayRouter: Router = Router();

/**
 * Connecting the salon's own payment account.
 *
 * Every deposit is charged against the account authorised here, so the money
 * lands with the salon and never in a Diabolical balance. Both routes are owner
 * only: a staff member must not be able to redirect the salon's income.
 */

const CALLBACK_PATH = '/api/gateway/mercadopago/callback';

function redirectUri(): string {
    return `${env.appBaseUrl}${CALLBACK_PATH}`;
}

/**
 * A tamper-proof `state` for the OAuth round trip.
 *
 * Mercado Pago hands `state` back untouched, so it is how the callback learns
 * which salon authorised. Signing it is what stops someone from crafting a link
 * that files *their* Mercado Pago account under *someone else's* salon — which
 * would send that salon's deposits to the attacker.
 *
 * The signing key is the credentials key: it is already required to store an
 * account at all, so there is no case where state can be signed but the result
 * cannot be saved.
 */
function signState(tenantId: string): string {
    if (!env.credentialsKey) throw new ApiError(503, 'Falta CREDENTIALS_KEY en este servidor');

    const issuedAt = Date.now();
    const payload = `${tenantId}.${issuedAt}`;
    const mac = crypto
        .createHmac('sha256', env.credentialsKey)
        .update(payload)
        .digest('base64url');
    return `${Buffer.from(payload).toString('base64url')}.${mac}`;
}

/** Ten minutes is far longer than an authorisation takes and short enough to matter. */
const STATE_TTL_MS = 10 * 60 * 1000;

function readState(state: string): string | null {
    // Without a key there is nothing to verify against, and accepting the state
    // anyway would let anyone file their own Mercado Pago account under someone
    // else's salon.
    if (!env.credentialsKey) return null;

    const [encoded, mac] = state.split('.');
    if (!encoded || !mac) return null;

    const payload = Buffer.from(encoded, 'base64url').toString('utf8');
    const expected = crypto
        .createHmac('sha256', env.credentialsKey)
        .update(payload)
        .digest('base64url');

    const a = Buffer.from(mac);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

    const [tenantId, issuedAt] = payload.split('.');
    if (!tenantId || !issuedAt) return null;
    if (Date.now() - Number(issuedAt) > STATE_TTL_MS) return null;

    return tenantId;
}

// ── Status ───────────────────────────────────────────────────────────────────

/** What the panel shows: whether she can charge, never the credentials. */
gatewayRouter.get(
    '/gateway',
    requireTenantOwner,
    asyncHandler(async (req, res) => {
        const { id } = tenantOf(req);
        const summary = await summaryFor(id);

        res.json({
            account: summary,
            available: {
                mercadopago: env.mercadoPago.enabled && secretsEnabled(),
                stripe: env.stripe.enabled && secretsEnabled(),
            },
        });
    })
);

gatewayRouter.delete(
    '/gateway',
    requireTenantOwner,
    asyncHandler(async (req, res) => {
        await disconnect(tenantOf(req).id);
        res.sendStatus(204);
    })
);

// ── Mercado Pago ─────────────────────────────────────────────────────────────

/** Starts the authorisation; the panel sends the owner to the returned URL. */
gatewayRouter.post(
    '/gateway/mercadopago/authorize',
    requireTenantOwner,
    asyncHandler(async (req, res) => {
        const { id } = tenantOf(req);

        if (!secretsEnabled()) {
            throw new ApiError(503, 'Este servidor no puede guardar credenciales de cobro todavía');
        }
        if (!env.mercadoPago.enabled) {
            throw new ApiError(503, 'Mercado Pago no está configurado en este servidor');
        }

        res.json({ url: authorizationUrl(signState(id), redirectUri()) });
    })
);

/**
 * Where Mercado Pago returns the owner after she authorises.
 *
 * Deliberately outside the tenant middleware's expectations: the browser lands
 * here from Mercado Pago, so the salon comes from the signed `state` rather
 * than from the Host header.
 */
gatewayRouter.get(
    '/gateway/mercadopago/callback',
    asyncHandler(async (req, res) => {
        const code = String(req.query.code ?? '');
        const state = String(req.query.state ?? '');
        const tenantId = state ? readState(state) : null;

        if (!code || !tenantId) {
            log.warn('Mercado Pago callback with a bad code or state');
            res.status(400).send('No pudimos verificar esta autorización. Vuelve a intentarlo desde tu panel.');
            return;
        }

        // The browser lands on the API's own domain, so a relative redirect
        // would strand the owner here. Her panel lives on her salon's domain.
        const panel = await panelUrl(tenantId);

        try {
            const token = await exchangeCode(code, redirectUri());
            await saveMercadoPago({ tenantId, ...token });
            res.redirect(`${panel}?gateway=connected`);
        } catch (error) {
            log.error('Mercado Pago authorisation failed', { tenantId, ...errorContext(error) });
            res.redirect(`${panel}?gateway=error`);
        }
    })
);

/**
 * Stores the salon's own webhook signing secret.
 *
 * Mercado Pago does not hand this out over OAuth: the owner copies it from her
 * own dashboard. Until it is set, her notifications cannot be verified and no
 * booking of hers will ever be confirmed by payment — so the panel treats a
 * missing secret as an unfinished connection.
 */
gatewayRouter.put(
    '/gateway/mercadopago/webhook-secret',
    requireTenantOwner,
    asyncHandler(async (req, res) => {
        const { id } = tenantOf(req);
        const secret = String((req.body as { secret?: string }).secret ?? '').trim();

        if (secret.length < 8) {
            throw new ApiError(400, 'Ese secreto no parece válido');
        }

        await setMercadoPagoWebhookSecret(id, secret);
        res.json(await summaryFor(id));
    })
);

// ── Stripe ───────────────────────────────────────────────────────────────────

/**
 * Creates the connected account if needed and returns Stripe's onboarding link.
 *
 * Stripe hosts the identity and tax verification, so the salon finishes on
 * Stripe's own pages and comes back when it is done.
 */
gatewayRouter.post(
    '/gateway/stripe/authorize',
    requireTenantOwner,
    asyncHandler(async (req, res) => {
        const { id, tenant } = tenantOf(req);

        if (!secretsEnabled()) {
            throw new ApiError(503, 'Este servidor no puede guardar credenciales de cobro todavía');
        }
        if (!env.stripe.enabled) {
            throw new ApiError(503, 'Stripe no está configurado en este servidor');
        }

        const existing = await summaryFor(id);
        let stripeAccountId: string;

        if (existing?.provider === 'stripe') {
            // Resuming an unfinished onboarding: reuse the account rather than
            // stranding the salon with a second, half-verified one.
            const account = await summaryStripeId(id);
            stripeAccountId = account ?? (await createConnectedAccount(req.user?.email ?? null));
        } else {
            stripeAccountId = await createConnectedAccount(req.user?.email ?? null);
        }

        await saveStripe(id, stripeAccountId);

        const panel = `https://${tenant.domain}/admin/profile`;
        const url = await onboardingLink(
            stripeAccountId,
            `${panel}?gateway=retry`,
            `${panel}?gateway=connected`
        );

        res.json({ url });
    })
);

/**
 * Re-reads whether Stripe has cleared the account for charges.
 *
 * The `account.updated` webhook is the primary signal, but an owner who returns
 * from onboarding immediately should not have to wait for it to arrive.
 */
gatewayRouter.post(
    '/gateway/stripe/refresh',
    requireTenantOwner,
    asyncHandler(async (req, res) => {
        const { id } = tenantOf(req);
        const stripeAccountId = await summaryStripeId(id);

        if (!stripeAccountId) throw new ApiError(404, 'Este salón no tiene Stripe conectado');

        await setChargesEnabled(stripeAccountId, await chargesEnabled(stripeAccountId));
        res.json(await summaryFor(id));
    })
);

/** Where to send the owner back to, on her own salon's domain. */
async function panelUrl(tenantId: string): Promise<string> {
    const result = await query<{ domain: string }>(
        'SELECT domain FROM tenants WHERE id = $1',
        [tenantId]
    );
    const domain = result.rows[0]?.domain;
    return domain ? `https://${domain}/admin/profile` : `${env.appBaseUrl}/admin/profile`;
}

/** The connected account id, which the summary deliberately does not expose. */
async function summaryStripeId(tenantId: string): Promise<string | null> {
    const result = await query<{ stripe_account_id: string | null }>(
        'SELECT stripe_account_id FROM payment_accounts WHERE tenant_id = $1',
        [tenantId]
    );
    return result.rows[0]?.stripe_account_id ?? null;
}
