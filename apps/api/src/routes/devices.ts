import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../middleware/errors';
import { requireTenantMember } from '../middleware/auth';
import { tenantOf } from '../middleware/tenant';
import { validateBody } from '../middleware/validate';
import { forgetDevice, registerDevice } from '../services/push';

export const devicesRouter: Router = Router();

/**
 * The devices that receive a salon's notifications.
 *
 * Staff as well as the owner: whoever is in the panel is someone the salon has
 * already trusted with its calendar, and a receptionist who does not learn about
 * a new booking is the same problem as an owner who does not.
 */
const tokenSchema = z.object({ token: z.string().trim().min(20).max(512) });

devicesRouter.post(
    '/devices',
    requireTenantMember,
    validateBody(tokenSchema),
    asyncHandler(async (req, res) => {
        const { id } = tenantOf(req);
        await registerDevice(id, req.user!.uid, (req.body as { token: string }).token);
        res.sendStatus(204);
    })
);

devicesRouter.delete(
    '/devices',
    requireTenantMember,
    validateBody(tokenSchema),
    asyncHandler(async (req, res) => {
        await forgetDevice((req.body as { token: string }).token);
        res.sendStatus(204);
    })
);
