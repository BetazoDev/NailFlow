import express, { type Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { env } from './config/env';
import { errorHandler, notFoundHandler } from './middleware/errors';
import { resolveTenant } from './middleware/tenant';
import { imagesRouter } from './routes/images';
import { webhooksRouter } from './routes/webhooks';
import { gatewayRouter } from './routes/gateway';
import { platformRouter } from './routes/platform';
import { tenantRouter } from './routes/tenant';
import { sessionRouter } from './routes/session';
import { servicesRouter } from './routes/services';
import { staffRouter } from './routes/staff';
import { appointmentsRouter } from './routes/appointments';
import { availabilityRouter } from './routes/availability';
import { bookingsRouter } from './routes/bookings';
import { favoritesRouter } from './routes/favorites';
import { createLogger } from './lib/logger';

const log = createLogger('http');

/**
 * Middleware order matters here, and the comments say why. Routes are grouped
 * into three tiers:
 *
 *   1. Infrastructure — health, images, payment webhooks. No tenant, no auth.
 *   2. Tenant-scoped   — everything under /api, resolved from the request host.
 *   3. Error handling  — last, so it catches everything above.
 */
export function createApp(): Express {
    const app = express();

    // Behind Dokploy/Traefik, so the client IP the rate limiter sees comes from
    // X-Forwarded-For rather than the proxy's own address.
    app.set('trust proxy', 1);

    app.use(
        helmet({
            // The API serves JSON and proxied images, never HTML, so the
            // browser-facing policies that assume a document do not apply.
            contentSecurityPolicy: false,
            crossOriginResourcePolicy: { policy: 'cross-origin' },
        })
    );

    app.use(
        cors({
            origin(origin, callback) {
                // Server-to-server calls (no Origin header) are always allowed;
                // browsers are held to the configured allowlist.
                //
                // A disallowed origin resolves to `false` rather than an error:
                // the response then simply carries no CORS headers, which the
                // browser blocks. Rejecting with an error instead turned every
                // stray request into a 500 with a stack trace in the logs.
                if (!origin || env.corsOrigins.includes(origin)) {
                    return callback(null, true);
                }
                log.warn('Blocked cross-origin request', { origin });
                callback(null, false);
            },
            credentials: true,
            methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
            allowedHeaders: ['Content-Type', 'Authorization', 'x-tenant-domain'],
            maxAge: 86_400,
        })
    );

    // A booking payload is a little JSON and a handful of URLs; anything larger
    // is a mistake or an attempt to exhaust memory.
    //
    // Stripe is the one exception: it signs the exact bytes it sent, so a body
    // that has been parsed and re-serialised no longer matches its signature.
    // That route reads the raw buffer itself, and parsing here would consume
    // the stream before it ever gets the chance.
    const parseJson = express.json({ limit: '256kb' });
    app.use((req, res, next) => {
        if (req.path === '/api/webhooks/stripe') return next();
        parseJson(req, res, next);
    });
    app.use(express.urlencoded({ extended: false, limit: '256kb' }));

    // ── Tier 1: infrastructure ───────────────────────────────────────────────

    app.get('/health', (_req, res) => res.json({ status: 'ok' }));
    app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

    app.use('/api', imagesRouter);
    app.use('/api', webhooksRouter);

    // ── Tier 2: the platform's own panel ─────────────────────────────────────

    // Mounted before the tenant-scoped router and outside `resolveTenant`: a
    // platform admin acts across every salon, so the Host header says nothing
    // about which one is meant.
    app.use('/api/platform', platformRouter);

    // ── Tier 3: tenant-scoped API ────────────────────────────────────────────

    const api = express.Router();

    api.use(
        rateLimit({
            windowMs: 60_000,
            limit: 120,
            standardHeaders: 'draft-7',
            legacyHeaders: false,
            message: { error: 'Too many requests. Please slow down.' },
        })
    );

    // Booking creation is the expensive, abusable path: it writes rows and can
    // open a payment session. Hold it to a far tighter budget than reads.
    api.use(
        ['/bookings', '/availability/hold'],
        rateLimit({
            windowMs: 60_000,
            limit: 10,
            standardHeaders: 'draft-7',
            legacyHeaders: false,
            message: { error: 'Too many booking attempts. Please try again in a minute.' },
        })
    );

    api.use(resolveTenant);
    api.use(sessionRouter);
    api.use(tenantRouter);
    api.use(gatewayRouter);
    api.use(servicesRouter);
    api.use(staffRouter);
    api.use(appointmentsRouter);
    api.use(availabilityRouter);
    api.use(bookingsRouter);
    api.use(favoritesRouter);

    app.use('/api', api);

    // ── Tier 3: error handling ───────────────────────────────────────────────

    app.use(notFoundHandler);
    app.use(errorHandler);

    return app;
}
