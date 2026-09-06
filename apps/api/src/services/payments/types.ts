/**
 * One shape for both gateways.
 *
 * The booking flow should never branch on which gateway a salon uses: it asks
 * for a checkout and gets a URL. Everything provider-specific — how the salon
 * authorises us, how a webhook proves it is genuine, how a charge is created on
 * her behalf — lives behind this interface.
 */

export type ProviderId = 'mercadopago' | 'stripe';

/** A salon's connected gateway account, credentials already opened. */
export interface PaymentAccount {
    tenantId: string;
    provider: ProviderId;
    /** Mercado Pago: the salon's MP user; Stripe: the connected account id. */
    externalId: string | null;
    accessToken: string | null;
    refreshToken: string | null;
    accessExpiresAt: Date | null;
    webhookSecret: string | null;
    stripeAccountId: string | null;
    /** The gateway says this account may take money. */
    chargesEnabled: boolean;
    connectedAt: Date | null;
}

export interface DepositCheckout {
    appointmentId: string;
    description: string;
    /** Major units, e.g. 340.5 for $340.50. */
    amount: number;
    currency: string;
    successUrl: string;
    failureUrl: string;
}

export interface CheckoutResult {
    /** Where to send the client to pay. */
    redirectUrl: string;
}

export interface PaymentStatus {
    appointmentId: string | null;
    approved: boolean;
    paymentId: string;
}

/**
 * Raised when a salon has no usable gateway. The booking routes turn this into
 * a message the client can act on rather than a 500.
 */
export class GatewayUnavailable extends Error {
    constructor(reason: string) {
        super(reason);
        this.name = 'GatewayUnavailable';
    }
}

export interface PaymentProvider {
    readonly id: ProviderId;

    /** Creates the checkout the client is redirected to, on the salon's account. */
    createCheckout(account: PaymentAccount, checkout: DepositCheckout): Promise<CheckoutResult>;

    /**
     * Reads the authoritative status from the gateway.
     *
     * Always re-read: a webhook body says *which* payment changed, never
     * whether it was approved. Trusting the body lets anyone who learns an
     * appointment id confirm a booking for free.
     */
    fetchStatus(account: PaymentAccount, paymentId: string): Promise<PaymentStatus>;
}
