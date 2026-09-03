import { Router } from 'express';
import type { Staff } from '@nailflow/shared';
import { query } from '../db/pool';
import { ApiError, asyncHandler } from '../middleware/errors';
import { requireTenantOwner } from '../middleware/auth';
import { tenantOf } from '../middleware/tenant';
import { validateBody } from '../middleware/validate';
import { staffInputSchema } from './schemas';
import { newId } from '../services/bookings';

export const staffRouter: Router = Router();

const PUBLIC_COLUMNS = `id, tenant_id, name, role, photo_url, bio, specialty, slug,
                        active, color_identifier, services_offered, weekly_schedule`;
const ALL_COLUMNS = `${PUBLIC_COLUMNS}, email, created_at`;

function slugify(name: string): string {
    return name
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 60);
}

/**
 * Public: the booking page shows who the client can book with.
 * Emails are omitted — they are staff contact details, not public information.
 */
staffRouter.get(
    '/staff',
    asyncHandler(async (req, res) => {
        const { id } = tenantOf(req);
        const result = await query<Staff>(
            `SELECT ${PUBLIC_COLUMNS} FROM staff
             WHERE tenant_id = $1 AND active = TRUE
             ORDER BY role = 'owner' DESC, name`,
            [id]
        );
        res.json(result.rows);
    })
);

/** Full records, including emails, for the salon's own team page. */
staffRouter.get(
    '/staff/all',
    requireTenantOwner,
    asyncHandler(async (req, res) => {
        const { id } = tenantOf(req);
        const result = await query<Staff>(
            `SELECT ${ALL_COLUMNS} FROM staff WHERE tenant_id = $1 ORDER BY role = 'owner' DESC, name`,
            [id]
        );
        res.json(result.rows);
    })
);

staffRouter.post(
    '/staff',
    requireTenantOwner,
    validateBody(staffInputSchema),
    asyncHandler(async (req, res) => {
        const { id: tenantId } = tenantOf(req);
        const input = req.body;
        const slug = input.slug ?? slugify(input.name);

        const clash = await query(
            'SELECT 1 FROM staff WHERE tenant_id = $1 AND slug = $2',
            [tenantId, slug]
        );
        if (clash.rowCount) {
            throw ApiError.conflict(`The booking link "${slug}" is already taken`);
        }

        const result = await query<Staff>(
            `INSERT INTO staff (
                id, tenant_id, name, email, role, specialty, photo_url, slug,
                active, bio, color_identifier, services_offered, weekly_schedule
             ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
             RETURNING ${ALL_COLUMNS}`,
            [
                newId(),
                tenantId,
                input.name,
                input.email ?? null,
                input.role ?? 'staff',
                input.specialty ?? null,
                input.photo_url ?? null,
                slug,
                input.active ?? true,
                input.bio ?? null,
                input.color_identifier ?? '#C97794',
                input.services_offered ?? [],
                JSON.stringify(input.weekly_schedule ?? []),
            ]
        );

        res.status(201).json(result.rows[0]);
    })
);

staffRouter.put(
    '/staff/:id',
    requireTenantOwner,
    validateBody(staffInputSchema.partial()),
    asyncHandler(async (req, res) => {
        const { id: tenantId } = tenantOf(req);
        const input = req.body;

        if (input.slug) {
            const clash = await query(
                'SELECT 1 FROM staff WHERE tenant_id = $1 AND slug = $2 AND id <> $3',
                [tenantId, input.slug, req.params.id]
            );
            if (clash.rowCount) {
                throw ApiError.conflict(`The booking link "${input.slug}" is already taken`);
            }
        }

        const result = await query<Staff>(
            `UPDATE staff SET
                name             = COALESCE($1, name),
                email            = COALESCE($2, email),
                role             = COALESCE($3, role),
                specialty        = COALESCE($4, specialty),
                photo_url        = COALESCE($5, photo_url),
                slug             = COALESCE($6, slug),
                active           = COALESCE($7, active),
                bio              = COALESCE($8, bio),
                color_identifier = COALESCE($9, color_identifier),
                services_offered = COALESCE($10, services_offered),
                weekly_schedule  = COALESCE($11::jsonb, weekly_schedule)
             WHERE id = $12 AND tenant_id = $13
             RETURNING ${ALL_COLUMNS}`,
            [
                input.name ?? null,
                input.email ?? null,
                input.role ?? null,
                input.specialty ?? null,
                input.photo_url ?? null,
                input.slug ?? null,
                input.active ?? null,
                input.bio ?? null,
                input.color_identifier ?? null,
                input.services_offered ?? null,
                input.weekly_schedule ? JSON.stringify(input.weekly_schedule) : null,
                req.params.id,
                tenantId,
            ]
        );

        if (!result.rowCount) throw ApiError.notFound('Staff member not found');
        res.json(result.rows[0]);
    })
);

/** Deactivates rather than deletes, so their past appointments keep their name. */
staffRouter.delete(
    '/staff/:id',
    requireTenantOwner,
    asyncHandler(async (req, res) => {
        const { id: tenantId } = tenantOf(req);
        const result = await query(
            `UPDATE staff SET active = FALSE
             WHERE id = $1 AND tenant_id = $2 AND role <> 'owner'`,
            [req.params.id, tenantId]
        );
        if (!result.rowCount) {
            throw ApiError.notFound('Staff member not found, or is the salon owner');
        }
        res.status(204).send();
    })
);
