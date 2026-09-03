import { Router } from 'express';
import { query } from '../db/pool';
import { asyncHandler, ApiError } from '../middleware/errors';
import { requireAuth, requireTenantOwner } from '../middleware/auth';
import { tenantOf } from '../middleware/tenant';
import { validateBody } from '../middleware/validate';
import { tenantUpdateSchema } from './schemas';
import { newId } from '../services/bookings';
import { createLogger } from '../lib/logger';

const log = createLogger('tenant');

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

        res.json(result.rows[0]);
    })
);

/**
 * Claims the salon on this domain for the signed-in user.
 *
 * A NailFlow deployment is provisioned for one salon (spec §1); this is how the
 * owner takes ownership of it on first sign-up. It succeeds only while the
 * tenant has no owner, so a second account cannot take over a live salon.
 *
 * Creating the owner's staff record here is what makes the salon bookable at
 * all: signing up previously created a Firebase user and nothing else, leaving
 * the new owner staring at an empty panel they had no access to.
 */
tenantRouter.post(
    '/tenant/claim',
    requireAuth,
    asyncHandler(async (req, res) => {
        const { tenant } = tenantOf(req);
        const user = req.user!;

        if (tenant.owner_id && tenant.owner_id !== user.uid) {
            throw ApiError.conflict('Este salón ya tiene una propietaria registrada');
        }

        const { salon_name: salonName } = req.body as { salon_name?: string };

        const updated = await query(
            `UPDATE tenants
             SET owner_id = $1, name = COALESCE(NULLIF($2, ''), name)
             WHERE id = $3 AND (owner_id IS NULL OR owner_id = $1)
             RETURNING id, domain, name, branding, settings, owner_id, subscription`,
            [user.uid, salonName?.trim() ?? '', tenant.id]
        );

        if (!updated.rowCount) {
            throw ApiError.conflict('Este salón ya tiene una propietaria registrada');
        }

        // The owner is also the first bookable staff member.
        await query(
            `INSERT INTO staff (id, tenant_id, name, email, role, slug, active, color_identifier)
             VALUES ($1, $2, $3, $4, 'owner', 'direccion', TRUE, '#C97794')
             ON CONFLICT (id) DO NOTHING`,
            [
                newId(),
                tenant.id,
                salonName?.trim() || user.email?.split('@')[0] || 'Dirección',
                user.email ?? null,
            ]
        );

        log.info('Tenant claimed', { tenantId: tenant.id, uid: user.uid });
        res.status(201).json(updated.rows[0]);
    })
);
