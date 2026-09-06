import express, { Router } from 'express';
import { asyncHandler } from '../middleware/errors';
import { accountByStripeId, accountFor } from '../services/payments/accounts';
import { setChargesEnabled } from '../services/payments/accounts';
import { providerFor } from '../services/payments';
import { verifySignature } from '../services/payments/mercadopago';
import { constructEvent } from '../services/payments/stripe';
import { confirmPayment } from '../services/bookings';
import { triggerAutomation } from '../services/notifications';
import { createLogger, errorContext } from '../lib/logger';
import type { PaymentAccount, PaymentStatus } from '../services/payments/types';

const log = createLogger('webhooks');
export const webhooksRouter: Router = Router();

/**
 * Confirms the appointment a payment belongs to and announces it.
 *
 * Shared by both gateways so a Stripe booking and a Mercado Pago booking end up
 * in exactly the same state, with the same automation fired.
 */
async function applyPayment(payment: PaymentStatus): Promise<void> {
    if (!payment.approved || !payment.appointmentId) return;

    const appointment = await confirmPayment(payment.appointmentId, payment.paymentId);

    if (!appointment) {
        log.warn('Payment approved for an unknown or already-confirmed appointment', {
            appointmentId: payment.appointmentId,
        });
        return;
    }

    log.info('Appointment confirmed by payment', { appointmentId: payment.appointmentId });

    await triggerAutomation(appointment.tenant_id, 'booking.paid', {
        appointment_id: payment.appointmentId,
        client_name: appointment.client_name,
        client_phone: appointment.client_phone,
        client_email: appointment.client_email,
        starts_at: appointment.datetime_start.toISOString(),
        ends_at: appointment.datetime_end.toISOString(),
        total: appointment.price ? Number(appointment.price) : null,
        payment_id: payment.paymentId,
    });
}

// ── Mercado Pago ─────────────────────────────────────────────────────────────

/**
 * Mercado Pago payment notification.
 *
 * Mounted before tenant resolution: it arrives from Mercado Pago's servers, not
 * from a salon's domain. The salon is named in the query string because we put
 * her there when creating the preference — a Mercado Pago notification carries
 * no other hint of which account it belongs to, and her signing secret is what
 * makes the signature checkable.
 *
 * Naming a different salon buys an attacker nothing: the signature is then
 * verified against *that* salon's secret and fails.
 *
 * Three rules keep it safe:
 *   1. the salon must have a signing secret stored,
 *   2. the `x-signature` HMAC must verify against it, and
 *   3. the payment status is re-read from Mercado Pago — the body says only
 *      *which* payment changed, never whether it was approved.
 *
 * Answers 200 once accepted, so Mercado Pago does not retry forever over a bug
 * on our side.
 */
webhooksRouter.post(
    '/webhooks/mercadopago',
    asyncHandler(async (req, res) => {
        const dataId = String(req.query['data.id'] ?? req.body?.data?.id ?? '');
        const tenantId = String(req.query.tenant ?? '');

        if (!tenantId) {
            log.warn('Mercado Pago webhook arrived without a salon', { dataId });
            res.sendStatus(400);
            return;
        }

        const account = await accountFor(tenantId);

        if (!account || account.provider !== 'mercadopago' || !account.webhookSecret) {
            log.warn('Webhook for a salon with no verifiable Mercado Pago account', {
                tenantId,
                dataId,
            });
            res.sendStatus(401);
            return;
        }

        const authentic = verifySignature({
            secret: account.webhookSecret,
            signatureHeader: req.headers['x-signature'] as string | undefined,
            requestIdHeader: req.headers['x-request-id'] as string | undefined,
            dataId,
        });

        if (!authentic) {
            log.warn('Rejected webhook with an invalid signature', { tenantId, dataId });
            res.sendStatus(401);
            return;
        }

        const action = String(req.body?.action ?? '');
        const isPayment = req.body?.type === 'payment' || action.startsWith('payment.');

        if (!isPayment || !dataId) {
            res.sendStatus(200);
            return;
        }

        try {
            const payment = await providerFor('mercadopago').fetchStatus(account, dataId);
            await applyPayment(payment);
        } catch (error) {
            log.error('Failed to process a Mercado Pago webhook', {
                tenantId,
                dataId,
                ...errorContext(error),
            });
        }

        res.sendStatus(200);
    })
);

// ── Stripe ───────────────────────────────────────────────────────────────────

/**
 * Stripe Connect event.
 *
 * Connect delivers every connected account's events to this one endpoint and
 * names the account in `event.account`, so the salon is looked up from the
 * event rather than the URL. The signature is verified against *our* webhook
 * secret, which is how Connect works — the platform is the subscriber.
 *
 * `express.raw` is mounted here specifically: Stripe signs the exact bytes it
 * sent, and a parsed-then-restringified body no longer matches.
 */
webhooksRouter.post(
    '/webhooks/stripe',
    express.raw({ type: 'application/json', limit: '1mb' }),
    asyncHandler(async (req, res) => {
        let event;
        try {
            event = constructEvent(
                req.body as Buffer,
                req.headers['stripe-signature'] as string | undefined
            );
        } catch (error) {
            log.warn('Rejected a Stripe webhook', errorContext(error));
            res.sendStatus(401);
            return;
        }

        const stripeAccountId = event.account;

        try {
            if (event.type === 'account.updated' && stripeAccountId) {
                // Stripe clears an account for charges only once the salon has
                // finished verification; until then a checkout would fail at
                // the gateway, so the panel needs to know.
                const account = event.data.object as { charges_enabled?: boolean };
                await setChargesEnabled(stripeAccountId, account.charges_enabled === true);
                res.sendStatus(200);
                return;
            }

            const isPaid =
                event.type === 'checkout.session.completed' ||
                event.type === 'payment_intent.succeeded';

            if (!isPaid || !stripeAccountId) {
                res.sendStatus(200);
                return;
            }

            const salon: PaymentAccount | null = await accountByStripeId(stripeAccountId);
            if (!salon) {
                log.warn('Stripe event for an account no salon owns', { stripeAccountId });
                res.sendStatus(200);
                return;
            }

            const object = event.data.object as {
                payment_intent?: string | null;
                id?: string;
            };
            const paymentIntentId =
                event.type === 'checkout.session.completed' ? object.payment_intent : object.id;

            if (paymentIntentId) {
                const payment = await providerFor('stripe').fetchStatus(salon, paymentIntentId);
                await applyPayment(payment);
            }
        } catch (error) {
            log.error('Failed to process a Stripe webhook', {
                stripeAccountId,
                type: event.type,
                ...errorContext(error),
            });
        }

        res.sendStatus(200);
    })
);
