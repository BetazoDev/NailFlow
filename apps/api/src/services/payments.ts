import crypto from 'node:crypto';
import { MercadoPagoConfig, Payment, Preference } from 'mercadopago';
import { env } from '../config/env';
import { createLogger } from '../lib/logger';

const log = createLogger('payments');

const client = env.mercadoPago.accessToken
    ? new MercadoPagoConfig({ accessToken: env.mercadoPago.accessToken })
    : null;

export const paymentsEnabled = client !== null;

export interface DepositCheckout {
    appointmentId: string;
    description: string;
    amount: number;
    currency: string;
    successUrl: string;
    failureUrl: string;
}

/** Creates the Mercado Pago checkout the client is redirected to. */
export async function createDepositCheckout(
    checkout: DepositCheckout
): Promise<{ initPoint: string }> {
    if (!client) {
        throw new Error('Mercado Pago is not configured (MP_ACCESS_TOKEN is unset)');
    }

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
            notification_url: `${env.appBaseUrl}/api/webhooks/mercadopago`,
            back_urls: { success: checkout.successUrl, failure: checkout.failureUrl },
            auto_return: 'approved',
        },
    });

    const initPoint = preference.init_point ?? preference.sandbox_init_point;
    if (!initPoint) {
        throw new Error('Mercado Pago returned a preference without a checkout URL');
    }
    return { initPoint };
}

export interface PaymentStatus {
    appointmentId: string | null;
    approved: boolean;
    paymentId: string;
}

/** Reads the authoritative status straight from Mercado Pago. */
export async function fetchPaymentStatus(paymentId: string): Promise<PaymentStatus> {
    if (!client) {
        throw new Error('Mercado Pago is not configured (MP_ACCESS_TOKEN is unset)');
    }

    const payment = await new Payment(client).get({ id: paymentId });
    return {
        appointmentId: payment.external_reference ?? null,
        approved: payment.status === 'approved',
        paymentId,
    };
}

/**
 * Verifies a webhook actually came from Mercado Pago.
 *
 * MP signs each notification with HMAC-SHA256 over
 * `id:<data.id>;request-id:<x-request-id>;ts:<ts>;` and sends the result in the
 * `x-signature` header. Without this check anyone who learns an appointment id
 * can POST a fake "approved" payment and confirm a booking for free.
 */
export function verifyWebhookSignature(params: {
    signatureHeader: string | undefined;
    requestIdHeader: string | undefined;
    dataId: string | undefined;
}): boolean {
    const secret = env.mercadoPago.webhookSecret;
    if (!secret) {
        // Refuse rather than trust: an unsigned webhook can confirm bookings.
        log.error('MP_WEBHOOK_SECRET is not set; rejecting webhook');
        return false;
    }

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

    const expected = crypto.createHmac('sha256', secret).update(manifest).digest('hex');

    const a = Buffer.from(expected, 'utf8');
    const b = Buffer.from(received, 'utf8');
    return a.length === b.length && crypto.timingSafeEqual(a, b);
}
