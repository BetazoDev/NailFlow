import { Router } from 'express';
import type { CreateBookingRequest, CreateBookingResponse } from '@nailflow/shared';
import { env } from '../config/env';
import { ApiError, asyncHandler } from '../middleware/errors';
import { tenantOf } from '../middleware/tenant';
import { validateBody } from '../middleware/validate';
import { createBookingSchema } from './schemas';
import { createAppointment, depositFor, prepareBooking } from '../services/bookings';
import { createDepositCheckout, paymentsEnabled } from '../services/payments';
import { triggerAutomation } from '../services/notifications';
import { createLogger } from '../lib/logger';

const log = createLogger('bookings');
export const bookingsRouter: Router = Router();

/**
 * Creates a booking.
 *
 * Prices and durations are computed server-side from the tenant's own service
 * rows — the request only says which services were chosen. When a deposit is
 * required the appointment starts as `pending_payment`, and only the Mercado
 * Pago webhook may promote it to `confirmed`.
 */
bookingsRouter.post(
    '/bookings',
    validateBody(createBookingSchema),
    asyncHandler(async (req, res) => {
        const { tenant } = tenantOf(req);
        const request = req.body as CreateBookingRequest;

        const prepared = await prepareBooking(tenant, request);
        const deposit = depositFor(prepared);
        const wantsGateway = request.payment_method === 'mercado';

        if (wantsGateway && !paymentsEnabled) {
            throw new ApiError(503, 'Online payment is not available for this salon');
        }

        const needsPayment = wantsGateway && deposit > 0;

        const appointment = await createAppointment({
            tenant,
            request,
            prepared,
            status: needsPayment ? 'pending_payment' : 'confirmed',
        });

        const response: CreateBookingResponse = {
            appointmentId: appointment.id,
            status: appointment.status,
        };

        if (needsPayment) {
            const origin = req.headers.origin ?? `https://${tenant.domain}`;
            const { initPoint } = await createDepositCheckout({
                appointmentId: appointment.id,
                description: prepared.services.map(service => service.name).join(' + '),
                amount: deposit,
                currency: tenant.settings?.currency ?? env.defaults.currency,
                successUrl: `${origin}/book/success?appointment=${appointment.id}`,
                failureUrl: `${origin}/book/error?appointment=${appointment.id}`,
            });
            response.init_point = initPoint;
        }

        await triggerAutomation(tenant.id, 'booking.initiated', {
            appointment_id: appointment.id,
            client_name: request.client_name,
            client_phone: request.client_phone,
            services: prepared.services.map(service => service.name),
            starts_at: prepared.start.toISO(),
            deposit,
        });

        log.info('Booking created', {
            tenantId: tenant.id,
            appointmentId: appointment.id,
            status: appointment.status,
        });

        res.status(201).json(response);
    })
);

/**
 * Confirms a booking without going through a payment gateway — for demos and
 * local testing.
 *
 * Disabled in production by default (`ALLOW_TEST_BOOKINGS`). Left open, it lets
 * anyone fill a salon's calendar with free confirmed appointments.
 */
bookingsRouter.post(
    '/bookings/test',
    (_req, _res, next) => {
        next(env.booking.allowUnpaidTestBookings ? undefined : ApiError.notFound('Route not found'));
    },
    validateBody(createBookingSchema),
    asyncHandler(async (req, res) => {
        const { tenant } = tenantOf(req);
        const request = req.body as CreateBookingRequest;

        const prepared = await prepareBooking(tenant, request);
        const appointment = await createAppointment({
            tenant,
            request: { ...request, payment_method: 'test' },
            prepared,
            status: 'confirmed',
        });

        log.warn('Test booking created (no payment taken)', {
            tenantId: tenant.id,
            appointmentId: appointment.id,
        });

        const response: CreateBookingResponse = {
            appointmentId: appointment.id,
            status: appointment.status,
        };
        res.status(201).json(response);
    })
);
