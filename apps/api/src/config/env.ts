import 'dotenv/config';

/**
 * Centralised, validated environment configuration.
 *
 * Every secret the API needs is declared here — nothing else in the codebase
 * reads `process.env` directly. Missing required values fail fast at boot
 * instead of silently falling back to a hardcoded default.
 */

type NodeEnv = 'development' | 'test' | 'production';

const nodeEnv = (process.env.NODE_ENV ?? 'development') as NodeEnv;
const isProduction = nodeEnv === 'production';

function required(name: string): string {
    const value = process.env[name];
    if (!value) {
        throw new Error(
            `Missing required environment variable ${name}. ` +
            `Copy .env.example to .env and fill it in.`
        );
    }
    return value;
}

function optional(name: string): string | undefined {
    return process.env[name] || undefined;
}

function list(name: string, fallback: string[] = []): string[] {
    const raw = process.env[name];
    if (!raw) return fallback;
    return raw.split(',').map(s => s.trim()).filter(Boolean);
}

function int(name: string, fallback: number): number {
    const raw = process.env[name];
    if (!raw) return fallback;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function bool(name: string, fallback = false): boolean {
    const raw = process.env[name];
    if (raw === undefined) return fallback;
    return raw === 'true' || raw === '1';
}

export const env = {
    nodeEnv,
    isProduction,
    isDevelopment: nodeEnv === 'development',
    /**
     * Matches the container port the reverse proxy targets. Override with PORT
     * for local development, where the web app already owns 3000.
     */
    port: int('PORT', 3000),

    /** Public base URL of this API — used for payment callbacks. */
    appBaseUrl: process.env.APP_BASE_URL ?? `http://localhost:${int('PORT', 3000)}`,

    database: {
        url: required('DATABASE_URL'),
        /** Run CREATE TABLE / ALTER TABLE on boot. Disable once you use real migrations. */
        autoMigrate: bool('DB_AUTO_MIGRATE', !isProduction),
    },

    /**
     * Origins allowed to call this API. Wildcards are rejected in production:
     * the API accepts credentials, so `*` would let any site act on behalf of
     * a logged-in salon owner.
     */
    corsOrigins: list('CORS_ORIGINS', isProduction ? [] : ['http://localhost:3000']),

    booking: {
        /** Business rule (spec §4): earliest a client may book, in days from now. */
        minAdvanceDays: int('BOOKING_MIN_ADVANCE_DAYS', 7),
        /** How long a tentatively-selected slot stays reserved. */
        slotHoldMinutes: int('BOOKING_SLOT_HOLD_MINUTES', 10),
        /** Granularity of the offered start times. */
        slotIntervalMinutes: int('BOOKING_SLOT_INTERVAL_MINUTES', 30),
        /** Endpoint that confirms a booking without going through a payment gateway. */
        allowUnpaidTestBookings: bool('ALLOW_TEST_BOOKINGS', !isProduction),
    },

    defaults: {
        timezone: process.env.DEFAULT_TIMEZONE ?? 'America/Mexico_City',
        currency: process.env.DEFAULT_CURRENCY ?? 'MXN',
        openingTime: process.env.DEFAULT_OPENING_TIME ?? '09:00',
        closingTime: process.env.DEFAULT_CLOSING_TIME ?? '21:00',
    },

    mercadoPago: {
        accessToken: optional('MP_ACCESS_TOKEN'),
        /** Secret from the MP dashboard used to verify `x-signature` on webhooks. */
        webhookSecret: optional('MP_WEBHOOK_SECRET'),
        get enabled() {
            return Boolean(this.accessToken);
        },
    },

    cdn: {
        baseUrl: process.env.CDN_BASE_URL ?? 'https://cdn.diabolicalservices.tech',
        apiUrl: process.env.CDN_API_URL ?? 'https://api.diabolicalservices.tech',
        /**
         * Token for system-managed folders (services, staff, branding).
         *
         * Optional on purpose: without it the image proxy answers 503 and
         * photos stop loading, but bookings, availability and the admin panel
         * all keep working. Only a variable the API cannot run at all without
         * — DATABASE_URL — is allowed to stop it from booting.
         */
        systemToken: optional('CDN_UPLOAD_TOKEN'),
        /** Token for client-supplied folders (booking reference photos). */
        referenceToken: optional('CDN_API_KEY_REFERENCES'),
    },

    n8n: {
        webhookUrl: optional('N8N_WEBHOOK_URL'),
    },

    retention: {
        /** Spec §10: reference photos are purged this many days after the booking. */
        referenceImageDays: int('REFERENCE_IMAGE_RETENTION_DAYS', 14),
        cleanupCron: process.env.CLEANUP_CRON ?? '0 2 * * *',
    },
} as const;

export type Env = typeof env;
