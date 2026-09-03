import { Router } from 'express';
import type { Appointment } from '@nailflow/shared';
import { query } from '../db/pool';
import { ApiError, asyncHandler } from '../middleware/errors';
import { requireTenantMember } from '../middleware/auth';
import { tenantOf } from '../middleware/tenant';
import { validateBody, validateQuery } from '../middleware/validate';
import {
    appointmentImagesSchema,
    appointmentQuerySchema,
    appointmentStatusSchema,
} from './schemas';
import { triggerAutomation } from '../services/notifications';

export const appointmentsRouter: Router = Router();

/**
 * Every route here exposes client contact details, so all of them require an
 * authenticated member of *this* salon. Appointment ids are UUIDs, but an id is
 * not an authorisation.
 */
appointmentsRouter.use('/appointments', requireTenantMember);

const COLUMNS = `a.id, a.tenant_id, a.client_name, a.client_phone, a.client_email,
                 a.service_id, a.staff_id, a.datetime_start, a.datetime_end, a.status,
                 a.advance_paid, a.notes, a.payment_ref, a.price, a.payment_method,
                 a.image_urls, a.image_url, a.created_at`;

appointmentsRouter.get(
    '/appointments',
    validateQuery(appointmentQuerySchema),
    asyncHandler(async (req, res) => {
        const { id: tenantId } = tenantOf(req);
        const { staff_id: staffId, from, to, status } = req.query as {
            staff_id?: string;
            from?: string;
            to?: string;
            status?: string;
        };

        // Build the filter incrementally so unused parameters never reach the query.
        const conditions = ['a.tenant_id = $1'];
        const params: unknown[] = [tenantId];

        if (staffId) {
            params.push(staffId);
            conditions.push(`a.staff_id = $${params.length}`);
        }
        if (from) {
            params.push(from);
            conditions.push(`a.datetime_start >= $${params.length}::date`);
        }
        if (to) {
            params.push(to);
            conditions.push(`a.datetime_start < ($${params.length}::date + INTERVAL '1 day')`);
        }
        if (status) {
            params.push(status);
            conditions.push(`a.status = $${params.length}`);
        }

        const result = await query<Appointment>(
            `SELECT ${COLUMNS}, s.name AS service_name
             FROM appointments a
             LEFT JOIN services s ON s.id = a.service_id
             WHERE ${conditions.join(' AND ')}
             ORDER BY a.datetime_start DESC
             LIMIT 1000`,
            params
        );

        res.json(result.rows);
    })
);

appointmentsRouter.get(
    '/appointments/:id',
    asyncHandler(async (req, res) => {
        const { id: tenantId } = tenantOf(req);

        const result = await query<Appointment>(
            `SELECT ${COLUMNS}, s.name AS service_name
             FROM appointments a
             LEFT JOIN services s ON s.id = a.service_id
             WHERE a.id = $1 AND a.tenant_id = $2`,
            [req.params.id, tenantId]
        );

        const appointment = result.rows[0];
        if (!appointment) throw ApiError.notFound('Appointment not found');

        // Multi-service bookings keep their full list in a join table.
        const services = await query(
            `SELECT sv.* FROM appointment_services aps
             JOIN services sv ON sv.id = aps.service_id
             WHERE aps.appointment_id = $1
             ORDER BY aps.position`,
            [appointment.id]
        );

        res.json({ ...appointment, services: services.rows });
    })
);

appointmentsRouter.patch(
    '/appointments/:id/status',
    validateBody(appointmentStatusSchema),
    asyncHandler(async (req, res) => {
        const { id: tenantId } = tenantOf(req);
        const { status } = req.body;

        const result = await query<Appointment>(
            `UPDATE appointments SET status = $1
             WHERE id = $2 AND tenant_id = $3
             RETURNING ${COLUMNS.replace(/a\./g, '')}`,
            [status, req.params.id, tenantId]
        );

        const appointment = result.rows[0];
        if (!appointment) throw ApiError.notFound('Appointment not found');

        if (status === 'cancelled') {
            await triggerAutomation(tenantId, 'booking.cancelled', {
                appointment_id: appointment.id,
                client_name: appointment.client_name,
                client_phone: appointment.client_phone,
            });
        }

        res.json(appointment);
    })
);

/**
 * Reference photos for an appointment.
 *
 * Kept behind authentication: these are the client's own photos, and an open
 * endpoint would let anyone overwrite them on a guessed appointment id.
 */
appointmentsRouter.patch(
    '/appointments/:id/images',
    validateBody(appointmentImagesSchema),
    asyncHandler(async (req, res) => {
        const { id: tenantId } = tenantOf(req);
        const { image_urls: imageUrls } = req.body as { image_urls: string[] };

        const result = await query<Appointment>(
            `UPDATE appointments SET image_urls = $1::jsonb, image_url = $2
             WHERE id = $3 AND tenant_id = $4
             RETURNING ${COLUMNS.replace(/a\./g, '')}`,
            [JSON.stringify(imageUrls), imageUrls[0] ?? null, req.params.id, tenantId]
        );

        if (!result.rowCount) throw ApiError.notFound('Appointment not found');
        res.json(result.rows[0]);
    })
);
