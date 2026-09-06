import type { NextFunction, Request, Response } from 'express';
import { env } from '../config/env';
import { firebaseAuth } from '../lib/firebase';
import { query } from '../db/pool';
import { ApiError } from './errors';
import { createLogger, errorContext } from '../lib/logger';

const log = createLogger('auth');

/**
 * Verifies the caller's Firebase ID token and attaches the decoded claims.
 *
 * Note there is no test/development bypass: an env var that turns
 * authentication off is one misconfigured deploy away from an open API.
 */
export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
    void (async () => {
        const header = req.headers.authorization;
        if (!header?.startsWith('Bearer ')) {
            return next(ApiError.unauthorized('Missing Bearer token'));
        }

        const token = header.slice('Bearer '.length).trim();
        if (!token) {
            return next(ApiError.unauthorized('Empty Bearer token'));
        }

        // Distinguish "we cannot check" from "your token is bad": a 401 here
        // would send the owner round the sign-in loop over a server-side
        // misconfiguration she cannot fix.
        const auth = firebaseAuth();
        if (!auth) {
            return next(new ApiError(503, 'Authentication is not configured on this server'));
        }

        try {
            req.user = await auth.verifyIdToken(token);
            next();
        } catch (error) {
            log.warn('Token verification failed', errorContext(error));
            next(ApiError.unauthorized('Invalid or expired token'));
        }
    })().catch(next);
}

/**
 * Confirms the authenticated user may administer the tenant this request
 * resolved to — they own it, or they are an active staff member of it.
 *
 * This is the check that makes the platform genuinely multi-tenant. Verifying
 * the token alone only proves *someone* is signed in; without this step any
 * NailFlow account could read and modify any salon's data by sending that
 * salon's domain.
 *
 * Mount after `resolveTenant` and `requireAuth`.
 */
export function requireTenantAccess(
    options: { ownerOnly?: boolean } = {}
) {
    return (req: Request, _res: Response, next: NextFunction): void => {
        void (async () => {
            const tenant = req.tenant;
            const user = req.user;

            if (!tenant) return next(new ApiError(500, 'Tenant middleware did not run'));
            if (!user) return next(ApiError.unauthorized());

            if (tenant.owner_id && tenant.owner_id === user.uid) {
                return next();
            }

            if (options.ownerOnly) {
                log.warn('Owner-only route refused', { tenantId: tenant.id, uid: user.uid });
                return next(ApiError.forbidden('Only the salon owner can do this'));
            }

            // Staff are matched on the email Firebase verified, so a member can
            // be granted access without knowing their Firebase UID up front.
            if (user.email) {
                const result = await query<{ role: string }>(
                    `SELECT role FROM staff
                     WHERE tenant_id = $1 AND LOWER(email) = LOWER($2) AND active = TRUE
                     LIMIT 1`,
                    [tenant.id, user.email]
                );
                if (result.rowCount) return next();
            }

            log.warn('Cross-tenant access refused', { tenantId: tenant.id, uid: user.uid });
            next(ApiError.forbidden('You do not have access to this salon'));
        })().catch(next);
    };
}

/** Convenience: authenticate, then authorise against the resolved tenant. */
export const requireTenantMember = [requireAuth, requireTenantAccess()];
export const requireTenantOwner = [requireAuth, requireTenantAccess({ ownerOnly: true })];

/**
 * Confirms the caller administers the *platform*, not a salon.
 *
 * Kept deliberately apart from `requireTenantAccess`: owning one salon must
 * never imply anything about another, and these routes cross every tenant
 * boundary there is. They are also mounted outside `resolveTenant`, because a
 * platform admin acts on all salons rather than on the one whose domain she
 * happens to be visiting.
 */
export function requirePlatformAdmin(
    req: Request,
    _res: Response,
    next: NextFunction
): void {
    void (async () => {
        const email = req.user?.email?.toLowerCase();
        if (!email) return next(ApiError.forbidden('Esta cuenta no tiene correo verificado'));

        if (env.platformAdminEmails.includes(email)) return next();

        const result = await query('SELECT 1 FROM platform_admins WHERE LOWER(email) = $1', [
            email,
        ]);
        if (result.rowCount) return next();

        log.warn('Platform route refused', { email });
        next(ApiError.forbidden('No administras esta plataforma'));
    })().catch(next);
}

/** Authenticate, then authorise against the platform itself. */
export const requirePlatform = [requireAuth, requirePlatformAdmin];
