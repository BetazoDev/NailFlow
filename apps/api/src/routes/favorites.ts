import { Router } from 'express';
import { query } from '../db/pool';
import { asyncHandler } from '../middleware/errors';
import { requireTenantMember } from '../middleware/auth';
import { tenantOf } from '../middleware/tenant';
import { validateBody, validateParams } from '../middleware/validate';
import { favoriteSchema, phoneSchema } from './schemas';
import { z } from 'zod';

export const favoritesRouter: Router = Router();

/**
 * Which clients the salon has starred in its CRM.
 *
 * Authenticated: the list is a set of client phone numbers, so leaving it open
 * would publish the salon's customer contact list.
 */
favoritesRouter.use('/favorites', requireTenantMember);

favoritesRouter.get(
    '/favorites',
    asyncHandler(async (req, res) => {
        const { id } = tenantOf(req);
        const result = await query<{ client_phone: string }>(
            'SELECT client_phone FROM client_favorites WHERE tenant_id = $1',
            [id]
        );
        res.json(result.rows.map(row => row.client_phone));
    })
);

favoritesRouter.put(
    '/favorites/:phone',
    validateParams(z.object({ phone: phoneSchema })),
    validateBody(favoriteSchema),
    asyncHandler(async (req, res) => {
        const { id } = tenantOf(req);
        const { phone } = req.params;
        const { favorite } = req.body as { favorite: boolean };

        if (favorite) {
            await query(
                `INSERT INTO client_favorites (tenant_id, client_phone)
                 VALUES ($1, $2) ON CONFLICT DO NOTHING`,
                [id, phone]
            );
        } else {
            await query(
                'DELETE FROM client_favorites WHERE tenant_id = $1 AND client_phone = $2',
                [id, phone]
            );
        }

        res.json({ phone, favorite });
    })
);
