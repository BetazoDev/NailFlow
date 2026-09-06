import Stripe from 'stripe';
import { env } from '../../config/env';
import { createLogger } from '../../lib/logger';
import {
    GatewayUnavailable,
    type CheckoutResult,
    type DepositCheckout,
    type PaymentAccount,
    type PaymentProvider,
    type PaymentStatus,
} from './types';

const log = createLogger('payments:stripe');

/**
 * Currencies Stripe counts in whole units.
 *
 * Stripe takes amounts in the smallest unit, which is normally cents — but a
 * zero-decimal currency like the yen is counted in whole units, and multiplying
 * those by 100 would charge a salon's client a hundred times the deposit.
 */
const ZERO_DECIMAL = new Set([
    'BIF', 'CLP', 'DJF', 'GNF', 'JPY', 'KMF', 'KRW', 'MGA',
    'PYG', 'RWF', 'UGX', 'VND', 'VUV', 'XAF', 'XOF', 'XPF',
]);

function smallestUnit(amount: number, currency: string): number {
    return ZERO_DECIMAL.has(currency.toUpperCase())
        ? Math.round(amount)
        : Math.round(amount * 100);
}

let cached: Stripe | null | undefined;

/** The platform client. Charges are made *on behalf of* a connected account. */
export function stripeClient(): Stripe | null {
    if (cached === undefined) {
        cached = env.stripe.secretKey ? new Stripe(env.stripe.secretKey) : null;
        if (!cached) log.warn('STRIPE_SECRET_KEY is unset; Stripe onboarding is unavailable');
    }
    return cached;
}

function requireClient(): Stripe {
    const client = stripeClient();
    if (!client) throw new GatewayUnavailable('Stripe is not configured on this server');
    return client;
}

// ── Connecting a salon ───────────────────────────────────────────────────────

/**
 * Creates the salon's connected account.
 *
 * Express accounts are the right shape here: Stripe hosts the onboarding and
 * carries the identity and tax verification, which is work neither the salon
 * nor Diabolical should be doing by hand.
 */
export async function createConnectedAccount(email: string | null): Promise<string> {
    const account = await requireClient().accounts.create({
        type: 'express',
        email: email ?? undefined,
        capabilities: { card_payments: { requested: true }, transfers: { requested: true } },
    });

    log.info('Created Stripe connected account', { stripeAccountId: account.id });
    return account.id;
}

/** A single-use link that walks the salon through Stripe's own onboarding. */
export async function onboardingLink(
    stripeAccountId: string,
    refreshUrl: string,
    returnUrl: string
): Promise<string> {
    const link = await requireClient().accountLinks.create({
        account: stripeAccountId,
        refresh_url: refreshUrl,
        return_url: returnUrl,
        type: 'account_onboarding',
    });
    return link.url;
}

/** Whether Stripe has cleared this account to take money yet. */
export async function chargesEnabled(stripeAccountId: string): Promise<boolean> {
    const account = await requireClient().accounts.retrieve(stripeAccountId);
    return account.charges_enabled === true;
}

/** Verifies a Connect webhook against the platform's signing secret. */
export function constructEvent(rawBody: Buffer, signature: string | undefined): Stripe.Event {
    const secret = env.stripe.webhookSecret;
    if (!secret) throw new GatewayUnavailable('STRIPE_WEBHOOK_SECRET is not configured');
    if (!signature) throw new GatewayUnavailable('Missing Stripe signature');

    return requireClient().webhooks.constructEvent(rawBody, signature, secret);
}

// ── The provider ─────────────────────────────────────────────────────────────

export const stripeProvider: PaymentProvider = {
    id: 'stripe',

    async createCheckout(
        account: PaymentAccount,
        checkout: DepositCheckout
    ): Promise<CheckoutResult> {
        if (!account.stripeAccountId) {
            throw new GatewayUnavailable('This salon has not connected Stripe');
        }
        if (!account.chargesEnabled) {
            throw new GatewayUnavailable(
                'This salon has not finished her Stripe verification yet'
            );
        }

        const session = await requireClient().checkout.sessions.create(
            {
                mode: 'payment',
                line_items: [
                    {
                        quantity: 1,
                        price_data: {
                            currency: checkout.currency.toLowerCase(),
                            unit_amount: smallestUnit(checkout.amount, checkout.currency),
                            product_data: { name: checkout.description },
                        },
                    },
                ],
                client_reference_id: checkout.appointmentId,
                // Read back on the webhook: the session is what Stripe reports,
                // but the appointment is what we have to confirm.
                payment_intent_data: { metadata: { appointment_id: checkout.appointmentId } },
                metadata: { appointment_id: checkout.appointmentId },
                success_url: checkout.successUrl,
                cancel_url: checkout.failureUrl,
            },
            // Charging on the connected account means the money settles in the
            // salon's balance and never appears in ours. Diabolical takes no
            // application fee: the deposit is hers in full.
            { stripeAccount: account.stripeAccountId }
        );

        if (!session.url) {
            throw new GatewayUnavailable('Stripe returned a session without a checkout URL');
        }
        return { redirectUrl: session.url };
    },

    async fetchStatus(account: PaymentAccount, paymentId: string): Promise<PaymentStatus> {
        if (!account.stripeAccountId) {
            throw new GatewayUnavailable('This salon has not connected Stripe');
        }

        const intent = await requireClient().paymentIntents.retrieve(paymentId, undefined, {
            stripeAccount: account.stripeAccountId,
        });

        return {
            appointmentId: intent.metadata?.appointment_id ?? null,
            approved: intent.status === 'succeeded',
            paymentId,
        };
    },
};
