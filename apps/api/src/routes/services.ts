import { Router } from 'express';
import type { Service } from '@nailflow/shared';
import { query } from '../db/pool';
import { ApiError, asyncHandler } from '../middleware/errors';
import { requireTenantOwner } from '../middleware/auth';
import { tenantOf } from '../middleware/tenant';
import { validateBody } from '../middleware/validate';
import { serviceInputSchema } from './schemas';
import { newId } from '../services/bookings';

export const servicesRouter: Router = Router();

const COLUMNS = `id, tenant_id, name, description, duration_minutes, estimated_price,
                 required_advance, category, image_url, active, created_at`;

/** Public: the booking wizard lists what the salon offers. */
servicesRouter.get(
    '/services',
    asyncHandler(async (req, res) => {
        const { id } = tenantOf(req);
        const includeInactive = req.query.include_inactive === 'true';

        const result = await query<Service>(
            `SELECT ${COLUMNS} FROM services
             WHERE tenant_id = $1 ${includeInactive ? '' : 'AND active = TRUE'}
             ORDER BY category NULLS LAST, name`,
            [id]
        );
        res.json(result.rows);
    })
);

servicesRouter.post(
    '/services',
    requireTenantOwner,
    validateBody(serviceInputSchema),
    asyncHandler(async (req, res) => {
        const { id: tenantId } = tenantOf(req);
        const input = req.body;

        const result = await query<Service>(
            `INSERT INTO services (
                id, tenant_id, name, description, duration_minutes,
                estimated_price, required_advance, category, image_url, active
             ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
             RETURNING ${COLUMNS}`,
            [
                newId(),
                tenantId,
                input.name,
                input.description ?? null,
                input.duration_minutes,
                input.estimated_price,
                input.required_advance,
                input.category ?? null,
                input.image_url ?? null,
                input.active ?? true,
            ]
        );

        res.status(201).json(result.rows[0]);
    })
);

servicesRouter.put(
    '/services/:id',
    requireTenantOwner,
    validateBody(serviceInputSchema),
    asyncHandler(async (req, res) => {
        const { id: tenantId } = tenantOf(req);
        const input = req.body;

        const result = await query<Service>(
            `UPDATE services SET
                name = $1, description = $2, duration_minutes = $3, estimated_price = $4,
                required_advance = $5, category = $6, image_url = $7, active = $8
             WHERE id = $9 AND tenant_id = $10
             RETURNING ${COLUMNS}`,
            [
                input.name,
                input.description ?? null,
                input.duration_minutes,
                input.estimated_price,
                input.required_advance,
                input.category ?? null,
                input.image_url ?? null,
                input.active ?? true,
                req.params.id,
                tenantId,
            ]
        );

        if (!result.rowCount) throw ApiError.notFound('Service not found');
        res.json(result.rows[0]);
    })
);

/**
 * Retires a service instead of deleting it, so past appointments keep the name
 * and price they were booked at. A hard delete would break the client history
 * and the revenue figures on the dashboard.
 */
servicesRouter.delete(
    '/services/:id',
    requireTenantOwner,
    asyncHandler(async (req, res) => {
        const { id: tenantId } = tenantOf(req);

        const result = await query(
            'UPDATE services SET active = FALSE WHERE id = $1 AND tenant_id = $2',
            [req.params.id, tenantId]
        );

        if (!result.rowCount) throw ApiError.notFound('Service not found');
        res.status(204).send();
    })
);
