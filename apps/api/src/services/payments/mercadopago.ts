import crypto from 'node:crypto';
import { MercadoPagoConfig, Payment, Preference } from 'mercadopago';
import { env } from '../../config/env';
import { createLogger } from '../../lib/logger';
import { updateMercadoPagoTokens } from './accounts';
import {
    GatewayUnavailable,
    type CheckoutResult,
    type DepositCheckout,
    type PaymentAccount,
    type PaymentProvider,
    type PaymentStatus,
} from './types';

const log = createLogger('payments:mercadopago');

const OAUTH_URL = 'https://api.mercadopago.com/oauth/token';
const AUTHORIZE_URL = 'https://auth.mercadopago.com/authorization';

/** Renew a little early, so a checkout never starts with a token about to die. */
const REFRESH_MARGIN_MS = 5 * 60 * 1000;

// ── Authorising a salon ──────────────────────────────────────────────────────

/**
 * Where to send the salon to authorise us.
 *
 * `state` carries the tenant id back to the callback, and is signed so a third
 * party cannot craft a link that connects their Mercado Pago account to someone
 * else's salon.
 */
export function authorizationUrl(state: string, redirectUri: string): string {
    if (!env.mercadoPago.clientId) {
        throw new GatewayUnavailable('MP_CLIENT_ID is not configured');
    }

    const url = new URL(AUTHORIZE_URL);
    url.searchParams.set('client_id', env.mercadoPago.clientId);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('platform_id', 'mp');
    url.searchParams.set('state', state);
    url.searchParams.set('redirect_uri', redirectUri);
    return url.toString();
}

export interface TokenResponse {
    accessToken: string;
    refreshToken: string;
    mpUserId: string;
    accessExpiresAt: Date;
}

interface RawToken {
    access_token?: string;
    refresh_token?: string;
    user_id?: number | string;
    expires_in?: number;
    message?: string;
}

async function postToken(body: Record<string, string>): Promise<TokenResponse> {
    if (!env.mercadoPago.clientId || !env.mercadoPago.clientSecret) {
        throw new GatewayUnavailable('Mercado Pago application credentials are not configured');
    }

    const response = await fetch(OAUTH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
            client_id: env.mercadoPago.clientId,
            client_secret: env.mercadoPago.clientSecret,
            ...body,
        }),
    });

    const payload = (await response.json().catch(() => ({}))) as RawToken;

    if (!response.ok || !payload.access_token || !payload.refresh_token) {
        throw new GatewayUnavailable(
            payload.message ?? `Mercado Pago rejected the token request (${response.status})`
        );
    }

    return {
        accessToken: payload.access_token,
        refreshToken: payload.refresh_token,
        mpUserId: String(payload.user_id ?? ''),
        accessExpiresAt: new Date(Date.now() + (payload.expires_in ?? 15552000) * 1000),
    };
}

/** Trades the authorisation code for the salon's own credentials. */
export function exchangeCode(code: string, redirectUri: string): Promise<TokenResponse> {
    return postToken({ grant_type: 'authorization_code', code, redirect_uri: redirectUri });
}

/**
 * Renews an expiring access token.
 *
 * Mercado Pago rotates the refresh token too, so the new pair replaces the old
 * one; keeping the previous refresh token would leave us unable to renew again.
 */
async function refresh(account: PaymentAccount): Promise<PaymentAccount> {
    if (!account.refreshToken) {
        throw new GatewayUnavailable('This salon has no Mercado Pago refresh token');
    }

    const renewed = await postToken({
        grant_type: 'refresh_token',
        refresh_token: account.refreshToken,
    });

    await updateMercadoPagoTokens(account.tenantId, renewed);
    log.info('Refreshed Mercado Pago token', { tenantId: account.tenantId });

    return {
        ...account,
        accessToken: renewed.accessToken,
        refreshToken: renewed.refreshToken,
        accessExpiresAt: renewed.accessExpiresAt,
    };
}

/** Returns an account whose access token is good for the next few minutes. */
async function usable(account: PaymentAccount): Promise<PaymentAccount> {
    if (!account.accessToken) {
        throw new GatewayUnavailable('This salon has not connected Mercado Pago');
    }

    const expiring =
        account.accessExpiresAt !== null &&
        account.accessExpiresAt.getTime() - Date.now() < REFRESH_MARGIN_MS;

    return expiring ? refresh(account) : account;
}

// ── Verifying her webhooks ───────────────────────────────────────────────────

/**
 * Mercado Pago signs each notification with HMAC-SHA256 over
 * `id:<data.id>;request-id:<x-request-id>;ts:<ts>;`, using the signing secret of
 * the account that received the payment — so the secret is the salon's, not
 * ours, and a salon without one cannot have her webhooks trusted.
 */
export function verifySignature(params: {
    secret: string;
    signatureHeader: string | undefined;
    requestIdHeader: string | undefined;
    dataId: string | undefined;
}): boolean {
    if (!params.signatureHeader || !params.dataId) return false;

    const parts = Object.fromEntries(
        params.signatureHeader.split(',').map(part => {
            const [key, ...rest] = part.split('=');
            return [key.trim(), rest.join('=').trim()];
        })
    );

    const timestamp = parts.ts;
    const received = parts.v1;
    if (!timestamp || !received) return false;

    const manifest =
        `id:${params.dataId};` +
        (params.requestIdHeader ? `request-id:${params.requestIdHeader};` : '') +
        `ts:${timestamp};`;

    const expected = crypto.createHmac('sha256', params.secret).update(manifest).digest('hex');

    const a = Buffer.from(expected, 'utf8');
    const b = Buffer.from(received, 'utf8');
    return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// ── The provider ─────────────────────────────────────────────────────────────

export const mercadoPagoProvider: PaymentProvider = {
    id: 'mercadopago',

    async createCheckout(
        account: PaymentAccount,
        checkout: DepositCheckout
    ): Promise<CheckoutResult> {
        const ready = await usable(account);
        const client = new MercadoPagoConfig({ accessToken: ready.accessToken! });

        const preference = await new Preference(client).create({
            body: {
                items: [
                    {
                        id: checkout.appointmentId,
                        title: checkout.description,
                        quantity: 1,
                        unit_price: checkout.amount,
                        currency_id: checkout.currency,
                    },
                ],
                external_reference: checkout.appointmentId,
                // The tenant travels in the URL because a Mercado Pago
                // notification carries no hint of which salon it belongs to,
                // and we need her signing secret before we can trust it.
                notification_url:
                    `${env.appBaseUrl}/api/webhooks/mercadopago` +
                    `?tenant=${encodeURIComponent(account.tenantId)}`,
                back_urls: { success: checkout.successUrl, failure: checkout.failureUrl },
                auto_return: 'approved',
            },
        });

        const redirectUrl = preference.init_point ?? preference.sandbox_init_point;
        if (!redirectUrl) {
            throw new GatewayUnavailable('Mercado Pago returned a preference without a checkout URL');
        }
        return { redirectUrl };
    },

    async fetchStatus(account: PaymentAccount, paymentId: string): Promise<PaymentStatus> {
        const ready = await usable(account);
        const client = new MercadoPagoConfig({ accessToken: ready.accessToken! });

        const payment = await new Payment(client).get({ id: paymentId });
        return {
            appointmentId: payment.external_reference ?? null,
            approved: payment.status === 'approved',
            paymentId,
        };
    },
};
