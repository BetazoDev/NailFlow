import type { DecodedIdToken } from 'firebase-admin/auth';
import type { Tenant } from '@nailflow/shared';

/**
 * Request augmentation for the values our middleware attaches.
 *
 * Declaring them here is what lets route handlers read `req.tenant` and
 * `req.user` directly — previously every access needed a `@ts-ignore`, which
 * also suppressed genuine type errors around them.
 */
declare global {
    namespace Express {
        interface Request {
            /** Set by `resolveTenant`; present on every route below that middleware. */
            tenant?: Tenant;
            /** Set by `requireAuth`; present only on authenticated routes. */
            user?: DecodedIdToken;
        }
    }
}

export {};
