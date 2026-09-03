import { Router } from 'express';
import { asyncHandler } from '../middleware/errors';
import { fetchPaymentStatus, paymentsEnabled, verifyWebhookSignature } from '../services/payments';
import { confirmPayment } from '../services/bookings';
import { triggerAutomation } from '../services/notifications';
import { createLogger, errorContext } from '../lib/logger';

const log = createLogger('webhooks');
export const webhooksRouter: Router = Router();

/**
 * Mercado Pago payment notification.
 *
 * Mounted before tenant resolution: it arrives from Mercado Pago's servers, not
 * from a salon's domain. Two rules keep it safe:
 *   1. the `x-signature` HMAC must verify, and
 *   2. the payment status is re-read from the Mercado Pago API — the request
 *      body is only a hint about *which* payment changed, never the source of
 *      truth for whether it was approved.
 *
 * Answers 200 once accepted, so Mercado Pago does not retry forever over a bug
 * on our side.
 */
webhooksRouter.post(
    '/webhooks/mercadopago',
    asyncHandler(async (req, res) => {
        const dataId = String(req.query['data.id'] ?? req.body?.data?.id ?? '');

        const authentic = verifyWebhookSignature({
            signatureHeader: req.headers['x-signature'] as string | undefined,
            requestIdHeader: req.headers['x-request-id'] as string | undefined,
            dataId,
        });

        if (!authentic) {
            log.warn('Rejected webhook with an invalid signature', { dataId });
            res.sendStatus(401);
            return;
        }

        const action = String(req.body?.action ?? '');
        const isPayment = req.body?.type === 'payment' || action.startsWith('payment.');

        if (!isPayment || !dataId || !paymentsEnabled) {
            res.sendStatus(200);
            return;
        }

        try {
            const payment = await fetchPaymentStatus(dataId);

            if (payment.approved && payment.appointmentId) {
                const appointment = await confirmPayment(payment.appointmentId, payment.paymentId);

                if (!appointment) {
                    log.warn('Payment approved for an unknown or already-confirmed appointment', {
                        appointmentId: payment.appointmentId,
                    });
                } else {
                    log.info('Appointment confirmed by payment', {
                        appointmentId: payment.appointmentId,
                    });
                    await triggerAutomation(appointment.tenant_id, 'booking.paid', {
                        appointment_id: payment.appointmentId,
                        client_name: appointment.client_name,
                        client_phone: appointment.client_phone,
                        payment_id: payment.paymentId,
                    });
                }
            }
        } catch (error) {
            log.error('Failed to process payment webhook', { dataId, ...errorContext(error) });
        }

        res.sendStatus(200);
    })
);
