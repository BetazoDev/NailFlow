import { Router } from 'express';
import { query } from '../db/pool';
import { asyncHandler } from '../middleware/errors';
import { requireTenantOwner } from '../middleware/auth';
import { tenantOf } from '../middleware/tenant';
import { validateBody } from '../middleware/validate';
import { tenantUpdateSchema } from './schemas';
import { forgetRecipients } from '../services/notifications';
export const tenantRouter: Router = Router();

/**
 * The salon's public configuration: branding, opening hours, currency.
 * Read access is public — the booking page needs it before anyone signs in.
 * `owner_id` is withheld so a Firebase UID is not exposed to visitors.
 */
tenantRouter.get('/tenant', (req, res) => {
    const { tenant } = tenantOf(req);
    const { owner_id: _ownerId, ...publicTenant } = tenant;
    res.json(publicTenant);
});

/** Update branding and settings. Owner only. */
tenantRouter.put(
    '/tenant',
    requireTenantOwner,
    validateBody(tenantUpdateSchema),
    asyncHandler(async (req, res) => {
        const { id } = tenantOf(req);
        const { name, branding, settings } = req.body;

        // `||` merges at the top level, so a partial branding update keeps the
        // keys it did not mention instead of wiping them.
        const result = await query(
            `UPDATE tenants SET
                name     = COALESCE($1, name),
                branding = branding || COALESCE($2::jsonb, '{}'::jsonb),
                settings = settings || COALESCE($3::jsonb, '{}'::jsonb)
             WHERE id = $4
             RETURNING id, domain, name, branding, settings, owner_id, subscription`,
            [
                name ?? null,
                branding ? JSON.stringify(branding) : null,
                settings ? JSON.stringify(settings) : null,
                id,
            ]
        );

        // Notifications carry the salon's contact details, cached for a few
        // minutes; a rename that keeps sending the old name reads as a bug.
        forgetRecipients(id);

        res.json(result.rows[0]);
    })
);
