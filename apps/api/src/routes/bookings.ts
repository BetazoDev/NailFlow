import { Router } from 'express';
import type { CreateBookingRequest, CreateBookingResponse } from '@nailflow/shared';
import { env } from '../config/env';
import { ApiError, asyncHandler } from '../middleware/errors';
import { tenantOf } from '../middleware/tenant';
import { validateBody } from '../middleware/validate';
import { createBookingSchema } from './schemas';
import { createAppointment, depositFor, prepareBooking } from '../services/bookings';
import { canCharge, createDepositCheckout, GatewayUnavailable } from '../services/payments';
import { standingOf } from '../services/subscription';
import { triggerAutomation } from '../services/notifications';
import { createLogger } from '../lib/logger';

const log = createLogger('bookings');
export const bookingsRouter: Router = Router();

/**
 * Creates a booking.
 *
 * Prices and durations are computed server-side from the tenant's own service
 * rows — the request only says which services were chosen. When a deposit is
 * required the appointment starts as `pending_payment`, and only the gateway's
 * webhook may promote it to `confirmed`.
 *
 * The deposit is charged on the salon's own connected account, so whether
 * online payment works is a question about *this* salon, not about the server.
 */
bookingsRouter.post(
    '/bookings',
    validateBody(createBookingSchema),
    asyncHandler(async (req, res) => {
        const { tenant } = tenantOf(req);
        const request = req.body as CreateBookingRequest;

        // A suspended salon stops taking *new* bookings, and nothing else. Her
        // panel stays readable and the appointments she already has stay valid:
        // her clients did not miss a payment, and punishing them would be both
        // unfair and the fastest way to lose the salon for good.
        if (standingOf(tenant.subscription) === 'suspended') {
            throw new ApiError(
                503,
                'Este salón no está aceptando reservas en este momento. Contáctalo directamente.'
            );
        }

        const prepared = await prepareBooking(tenant, request);
        const deposit = depositFor(prepared);
        const wantsGateway = request.payment_method === 'mercado';

        if (wantsGateway && !(await canCharge(tenant.id))) {
            throw new ApiError(503, 'Este salón todavía no acepta pagos en línea');
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
            try {
                const { redirectUrl } = await createDepositCheckout(tenant.id, {
                    appointmentId: appointment.id,
                    description: prepared.services.map(service => service.name).join(' + '),
                    amount: deposit,
                    currency: tenant.settings?.currency ?? env.defaults.currency,
                    successUrl: `${origin}/book/success?appointment=${appointment.id}`,
                    failureUrl: `${origin}/book/error?appointment=${appointment.id}`,
                });
                response.init_point = redirectUrl;
            } catch (error) {
                // The appointment already exists and holds the slot. Telling the
                // client the gateway is down is honest; leaving her with a
                // confirmed-looking booking she never paid for is not.
                if (error instanceof GatewayUnavailable) {
                    throw new ApiError(503, error.message);
                }
                throw error;
            }
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

        // A suspended salon stops taking *new* bookings, and nothing else. Her
        // panel stays readable and the appointments she already has stay valid:
        // her clients did not miss a payment, and punishing them would be both
        // unfair and the fastest way to lose the salon for good.
        if (standingOf(tenant.subscription) === 'suspended') {
            throw new ApiError(
                503,
                'Este salón no está aceptando reservas en este momento. Contáctalo directamente.'
            );
        }

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
