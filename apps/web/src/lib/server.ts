import { headers } from 'next/headers';

/**
 * The domain the current request arrived on.
 *
 * Tenant resolution is host-based end to end: the API looks the salon up from
 * this value, so the app needs no per-tenant route segment. The previous
 * `/[domain]/…` route tree plus a rewriting middleware duplicated every booking
 * page to achieve the same thing.
 *
 * `DEV_TENANT_DOMAIN` lets local development stand in for a real salon domain.
 */
export function requestDomain(): string {
    const host = headers().get('host') ?? '';

    if (!host || host.startsWith('localhost') || host.startsWith('127.0.0.1')) {
        return process.env.DEV_TENANT_DOMAIN ?? host;
    }

    return host;
}
