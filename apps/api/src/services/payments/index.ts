import { accountFor } from './accounts';
import { mercadoPagoProvider } from './mercadopago';
import { stripeProvider } from './stripe';
import {
    GatewayUnavailable,
    type CheckoutResult,
    type DepositCheckout,
    type PaymentAccount,
    type PaymentProvider,
    type ProviderId,
} from './types';

export * from './types';
export * as accounts from './accounts';
export * as mercadoPago from './mercadopago';
export * as stripe from './stripe';

const PROVIDERS: Record<ProviderId, PaymentProvider> = {
    mercadopago: mercadoPagoProvider,
    stripe: stripeProvider,
};

export function providerFor(id: ProviderId): PaymentProvider {
    return PROVIDERS[id];
}

/**
 * Whether this salon can take a deposit right now.
 *
 * There is no platform-wide answer any more: a salon that has connected her
 * gateway can charge and one that has not cannot, independently of every other
 * salon on the platform.
 */
export async function canCharge(tenantId: string): Promise<boolean> {
    const account = await accountFor(tenantId);
    return account !== null && account.chargesEnabled;
}

/**
 * Creates a deposit checkout on the salon's own gateway account.
 *
 * Throws {@link GatewayUnavailable} — never a generic error — when she has not
 * connected one, so the booking route can tell the client something true
 * instead of failing with a 500.
 */
export async function createDepositCheckout(
    tenantId: string,
    checkout: DepositCheckout
): Promise<CheckoutResult> {
    const account = await accountFor(tenantId);

    if (!account) {
        throw new GatewayUnavailable('Este salón todavía no puede cobrar en línea');
    }

    return providerFor(account.provider).createCheckout(account, checkout);
}

/** The salon's connected account, for callers that need the raw credentials. */
export { accountFor };
export type { PaymentAccount };
