import { Router } from 'express';
import { DateTime } from 'luxon';
import { calculateTotals, type Service } from '@nailflow/shared';
import { query } from '../db/pool';
import { ApiError, asyncHandler } from '../middleware/errors';
import { tenantOf } from '../middleware/tenant';
import { validateBody, validateQuery } from '../middleware/validate';
import { availabilityQuerySchema, slotHoldSchema } from './schemas';
import { getAvailableSlots, holdSlot, releaseSlot, tenantTimezone } from '../services/availability';
import { env } from '../config/env';

export const availabilityRouter: Router = Router();

/**
 * Free start times for a day.
 *
 * The duration comes from the services the client actually picked, so a
 * three-hour combo is never offered a slot that only fits one hour. When no
 * services are given yet, fall back to a single interval.
 */
availabilityRouter.get(
    '/availability',
    validateQuery(availabilityQuerySchema),
    asyncHandler(async (req, res) => {
        const { tenant } = tenantOf(req);
        const { date, staff_id: staffId, service_ids: serviceIds } = req.query as unknown as {
            date: string;
            staff_id: string;
            service_ids?: string[];
        };

        let durationMinutes = env.booking.slotIntervalMinutes;

        if (serviceIds?.length) {
            const result = await query<Service>(
                `SELECT duration_minutes, estimated_price, required_advance
                 FROM services
                 WHERE tenant_id = $1 AND id = ANY($2::text[]) AND active = TRUE`,
                [tenant.id, serviceIds]
            );
            if (result.rows.length !== serviceIds.length) {
                throw ApiError.badRequest('One or more selected services are unavailable');
            }
            durationMinutes = calculateTotals(result.rows).durationMinutes;
        }

        res.json(await getAvailableSlots({ tenant, date, staffId, durationMinutes }));
    })
);

/** Reserves a slot for a few minutes while the client finishes checking out. */
availabilityRouter.post(
    '/availability/hold',
    validateBody(slotHoldSchema),
    asyncHandler(async (req, res) => {
        const { tenant } = tenantOf(req);
        const { date, time, staff_id: staffId } = req.body;

        const start = DateTime.fromISO(`${date}T${time}`, { zone: tenantTimezone(tenant) });
        if (!start.isValid) throw ApiError.badRequest('Invalid date or time');

        await holdSlot(tenant.id, staffId, start);
        res.json({ success: true, expiresInMinutes: env.booking.slotHoldMinutes });
    })
);

availabilityRouter.delete(
    '/availability/hold',
    validateQuery(slotHoldSchema),
    asyncHandler(async (req, res) => {
        const { tenant } = tenantOf(req);
        const { date, time, staff_id: staffId } = req.query as unknown as {
            date: string;
            time: string;
            staff_id: string;
        };

        const start = DateTime.fromISO(`${date}T${time}`, { zone: tenantTimezone(tenant) });
        if (!start.isValid) throw ApiError.badRequest('Invalid date or time');

        await releaseSlot(tenant.id, staffId, start);
        res.status(204).send();
    })
);
