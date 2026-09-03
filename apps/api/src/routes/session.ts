import { Router } from 'express';
import type { StaffRole } from '@nailflow/shared';
import { query } from '../db/pool';
import { asyncHandler } from '../middleware/errors';
import { requireAuth } from '../middleware/auth';
import { tenantOf } from '../middleware/tenant';

export const sessionRouter: Router = Router();

export interface SessionResponse {
    uid: string;
    email: string | null;
    tenantId: string;
    /** null when the signed-in user has no relationship with this salon. */
    role: StaffRole | null;
    staffId: string | null;
}

/**
 * Who the caller is *for this salon*.
 *
 * The admin panel used to read its role from `localStorage.mock_role`, which
 * the user could edit — so every account was effectively an owner. The role now
 * comes from the server, derived from the verified token.
 */
sessionRouter.get(
    '/session',
    requireAuth,
    asyncHandler(async (req, res) => {
        const { tenant } = tenantOf(req);
        const user = req.user!;

        if (tenant.owner_id && tenant.owner_id === user.uid) {
            const response: SessionResponse = {
                uid: user.uid,
                email: user.email ?? null,
                tenantId: tenant.id,
                role: 'owner',
                staffId: null,
            };
            return res.json(response);
        }

        const staff = user.email
            ? await query<{ id: string; role: StaffRole }>(
                  `SELECT id, role FROM staff
                   WHERE tenant_id = $1 AND LOWER(email) = LOWER($2) AND active = TRUE
                   LIMIT 1`,
                  [tenant.id, user.email]
              )
            : null;

        const member = staff?.rows[0];

        const response: SessionResponse = {
            uid: user.uid,
            email: user.email ?? null,
            tenantId: tenant.id,
            role: member?.role ?? null,
            staffId: member?.id ?? null,
        };
        res.json(response);
    })
);
