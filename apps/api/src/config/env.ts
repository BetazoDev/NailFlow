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

/**
 * Reads a variable, trimming whitespace and stripping surrounding quotes.
 *
 * Deployment panels vary in how they store values: some keep the quotes you
 * typed, some keep a trailing space. Comparing the raw string then fails
 * silently — `DB_AUTO_MIGRATE="true"` would read as false and skip the schema
 * bootstrap without a word.
 */
function read(name: string): string | undefined {
    const raw = process.env[name];
    if (raw === undefined) return undefined;

    const trimmed = raw.trim();
    const unquoted =
        (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
        (trimmed.startsWith("'") && trimmed.endsWith("'"))
            ? trimmed.slice(1, -1).trim()
            : trimmed;

    return unquoted || undefined;
}

function required(name: string): string {
    const value = read(name);
    if (!value) {
        throw new Error(
            `Missing required environment variable ${name}. ` +
            `Copy .env.example to .env and fill it in.`
        );
    }
    return value;
}

function optional(name: string): string | undefined {
    return read(name);
}

function list(name: string, fallback: string[] = []): string[] {
    const raw = read(name);
    if (!raw) return fallback;
    return raw.split(',').map(item => item.trim()).filter(Boolean);
}

function int(name: string, fallback: number): number {
    const raw = read(name);
    if (!raw) return fallback;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function bool(name: string, fallback = false): boolean {
    const raw = read(name)?.toLowerCase();
    if (raw === undefined) return fallback;
    return raw === 'true' || raw === '1' || raw === 'yes' || raw === 'on';
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

/**
 * What the process can actually see, by name.
 *
 * Logged once at startup. Diagnosing "I set the variable but the app disagrees"
 * otherwise means SSH-ing to the host and running `docker exec … env`, and a
 * panel that shows a value saved is no proof the container received it.
 *
 * Names only — a value is never printed, so this is safe in any log sink.
 */
export interface ConfigReport {
    present: string[];
    missing: string[];
}

/** Grouped so the report reads as "what breaks if this is absent". */
const EXPECTED: Record<string, string[]> = {
    'required to start': ['DATABASE_URL'],
    'browser access': ['CORS_ORIGINS'],
    'admin sign-in': ['FIREBASE_SERVICE_ACCOUNT', 'GOOGLE_APPLICATION_CREDENTIALS'],
    'images': ['CDN_UPLOAD_TOKEN', 'CDN_API_KEY_REFERENCES'],
    'online payment': ['MP_ACCESS_TOKEN', 'MP_WEBHOOK_SECRET'],
    'schema bootstrap': ['DB_AUTO_MIGRATE'],
    'automation': ['N8N_WEBHOOK_URL'],
};

export function describeConfig(): Record<string, ConfigReport> {
    const report: Record<string, ConfigReport> = {};

    for (const [group, names] of Object.entries(EXPECTED)) {
        report[group] = {
            present: names.filter(name => read(name) !== undefined),
            missing: names.filter(name => read(name) === undefined),
        };
    }

    return report;
}
