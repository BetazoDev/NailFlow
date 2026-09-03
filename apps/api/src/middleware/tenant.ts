import type { NextFunction, Request, Response } from 'express';
import { getTenantByDomain, normaliseDomain } from '../services/tenants';
import { ApiError } from './errors';
import { createLogger } from '../lib/logger';

const log = createLogger('tenant');

/**
 * Resolves which salon a request belongs to, from the domain it arrived on.
 *
 * The tenant is derived from the *host*, never from a caller-supplied id. An
 * earlier version accepted `?id=`, `?owner_id=` and an `x-tenant-id` header,
 * which meant any authenticated user could point a request at another salon's
 * data simply by changing a query string.
 *
 * `x-tenant-domain` is still honoured because the browser bundle is served from
 * the tenant's own domain and forwards it — but it only ever selects an
 * existing tenant; it grants no permissions on its own. Authorisation is a
 * separate step (`requireTenantOwner`).
 */
export function resolveTenant(req: Request, _res: Response, next: NextFunction): void {
    void (async () => {
        const forwarded = req.headers['x-tenant-domain'];
        const host = req.headers.host ?? '';
        const candidate = typeof forwarded === 'string' && forwarded ? forwarded : host;

        if (!candidate) {
            return next(ApiError.badRequest('Cannot determine tenant: no Host header'));
        }

        const domain = normaliseDomain(candidate);
        const tenant = await getTenantByDomain(domain);

        if (!tenant) {
            log.warn('Unknown tenant domain', { domain });
            return next(ApiError.notFound(`No salon is configured for ${domain}`));
        }

        req.tenant = tenant;
        next();
    })().catch(next);
}

/** Narrowing helper for handlers mounted below `resolveTenant`. */
export function tenantOf(req: Request): { id: string; tenant: NonNullable<Request['tenant']> } {
    if (!req.tenant) {
        // Unreachable when routes are mounted correctly; throwing beats a silent
        // `undefined` that would widen a query to every tenant in the table.
        throw new ApiError(500, 'Tenant middleware did not run for this route');
    }
    return { id: req.tenant.id, tenant: req.tenant };
}
