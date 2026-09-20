import { query } from './pool';
import { env } from '../config/env';
import { createLogger, errorContext } from '../lib/logger';

const log = createLogger('db:schema');

/**
 * Idempotent schema bootstrap.
 *
 * This is deliberately simple: every statement is `IF NOT EXISTS`, so booting a
 * fresh database and booting an existing one follow the same path. For anything
 * that needs data backfill or a destructive change, add a numbered migration
 * tool instead of extending this file.
 */

const TABLES = `
    CREATE TABLE IF NOT EXISTS tenants (
        id            TEXT PRIMARY KEY,
        domain        TEXT UNIQUE NOT NULL,
        name          TEXT,
        branding      JSONB NOT NULL DEFAULT '{}'::jsonb,
        settings      JSONB NOT NULL DEFAULT '{}'::jsonb,
        owner_id      TEXT,
        subscription  JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS services (
        id                TEXT PRIMARY KEY,
        tenant_id         TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        name              TEXT NOT NULL,
        description       TEXT,
        duration_minutes  INTEGER NOT NULL DEFAULT 60 CHECK (duration_minutes > 0),
        estimated_price   NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (estimated_price >= 0),
        required_advance  NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (required_advance >= 0),
        category          TEXT,
        image_url         TEXT,
        active            BOOLEAN NOT NULL DEFAULT TRUE,
        created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS staff (
        id                TEXT PRIMARY KEY,
        tenant_id         TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        name              TEXT NOT NULL,
        email             TEXT,
        role              TEXT NOT NULL DEFAULT 'staff',
        photo_url         TEXT,
        bio               TEXT,
        specialty         TEXT,
        slug              TEXT,
        active            BOOLEAN NOT NULL DEFAULT TRUE,
        color_identifier  TEXT,
        services_offered  TEXT[] NOT NULL DEFAULT '{}',
        weekly_schedule   JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS appointments (
        id              TEXT PRIMARY KEY,
        tenant_id       TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        client_name     TEXT NOT NULL,
        client_phone    TEXT,
        client_email    TEXT,
        service_id      TEXT REFERENCES services(id) ON DELETE SET NULL,
        staff_id        TEXT REFERENCES staff(id) ON DELETE SET NULL,
        datetime_start  TIMESTAMPTZ NOT NULL,
        datetime_end    TIMESTAMPTZ NOT NULL,
        status          TEXT NOT NULL DEFAULT 'pending_payment',
        advance_paid    BOOLEAN NOT NULL DEFAULT FALSE,
        notes           TEXT,
        payment_ref     TEXT,
        price           NUMERIC(10, 2),
        payment_method  TEXT,
        image_urls      JSONB NOT NULL DEFAULT '[]'::jsonb,
        image_url       TEXT,
        created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS appointment_services (
        appointment_id  TEXT NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
        service_id      TEXT NOT NULL REFERENCES services(id) ON DELETE CASCADE,
        position        INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (appointment_id, service_id)
    );

    CREATE TABLE IF NOT EXISTS client_favorites (
        tenant_id     TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        client_phone  TEXT NOT NULL,
        created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (tenant_id, client_phone)
    );

    CREATE TABLE IF NOT EXISTS slot_locks (
        tenant_id   TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        staff_id    TEXT NOT NULL,
        slot_time   TIMESTAMPTZ NOT NULL,
        expires_at  TIMESTAMPTZ NOT NULL,
        PRIMARY KEY (tenant_id, staff_id, slot_time)
    );

    -- Devices that receive a salon's notifications. Keyed by token because
    -- that is what the push service addresses, and one person may have several
    -- (phone, laptop, a second browser).
    CREATE TABLE IF NOT EXISTS push_devices (
        token       TEXT PRIMARY KEY,
        tenant_id   TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        uid         TEXT NOT NULL,
        updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    -- Who at Diabolical may administer the platform itself: create salons,
    -- see every salon's status, change a subscription. Deliberately separate
    -- from a salon's own owner/staff roles — being the owner of one salon must
    -- never imply anything about another.
    --
    -- PLATFORM_ADMIN_EMAILS bootstraps the first one, so an empty table can
    -- never lock everybody out of the panel that manages the table.
    CREATE TABLE IF NOT EXISTS platform_admins (
        email       TEXT PRIMARY KEY,
        name        TEXT,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    -- What was done from the platform panel, and by whom. These actions cross
    -- tenant boundaries, so "who created this salon" and "who changed this
    -- subscription" are questions that need answers later.
    CREATE TABLE IF NOT EXISTS platform_audit (
        id          TEXT PRIMARY KEY,
        actor_email TEXT NOT NULL,
        action      TEXT NOT NULL,
        tenant_id   TEXT,
        detail      JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    -- Each salon collects into her own gateway account, so deposits never pass
    -- through Diabolical. One row per salon: a salon uses one gateway at a
    -- time, and switching replaces the row rather than accumulating accounts.
    --
    -- Every column holding a credential stores a sealed value (see
    -- lib/secretbox.ts), never the token itself.
    CREATE TABLE IF NOT EXISTS payment_accounts (
        tenant_id          TEXT PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
        provider           TEXT NOT NULL CHECK (provider IN ('mercadopago', 'stripe')),

        -- Mercado Pago Connect: tokens belong to the salon's MP user.
        mp_user_id         TEXT,
        access_token       TEXT,
        refresh_token      TEXT,
        access_expires_at  TIMESTAMPTZ,
        -- Her own webhook signing secret; MP signs each salon's notifications
        -- with the secret of the account that received the payment.
        webhook_secret     TEXT,

        -- Stripe Connect: charges are created against this account id.
        stripe_account_id  TEXT UNIQUE,

        -- False until the gateway says the account may actually take money.
        -- A salon can finish authorising and still be pending verification.
        charges_enabled    BOOLEAN NOT NULL DEFAULT FALSE,
        connected_at       TIMESTAMPTZ,
        updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    /*
     * Where a salon's images live, and the keys that write them.
     *
     * Without this every salon shared one CDN project and one pair of keys, so
     * a client's reference photo landed in the same folder as every other
     * salon's, and any salon's page could serve it. The folder is not chosen by
     * the browser: the CDN derives it from the key, so a key per salon is what
     * actually keeps them apart.
     *
     * The slug is stored as well as the keys because the read proxy has to know
     * which folder belongs to this salon before it will serve anything from it,
     * and that question is asked on requests that upload nothing.
     *
     * Tokens are sealed with the same AES-256-GCM box as the payment
     * credentials; see lib/secretbox.ts.
     */
    CREATE TABLE IF NOT EXISTS cdn_accounts (
        tenant_id        TEXT PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,

        -- Her own folder, and the key that writes it: services, team, branding.
        -- Unique, because two salons sharing a folder is the exact bug this
        -- table exists to prevent.
        slug             TEXT NOT NULL UNIQUE,
        upload_token     TEXT,

        -- And a second CDN project for the photos her clients upload while
        -- booking, with a key of its own.
        --
        -- Two projects and not one, because that key is handed to people who
        -- are not signed in and must not reach the salon's own pictures with
        -- it. On disk the two live side by side under her client folder —
        -- "<client>/<folder>/original/<file>" — and what keeps this salon apart
        -- from every other is that the CDN refuses a key whose client is not
        -- the one named in the path.
        reference_slug   TEXT UNIQUE,
        reference_token  TEXT,

        updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    /*
     * Carrying a sign-in from the account domain to a salon's own.
     *
     * Google only returns someone to a domain Firebase has been told about,
     * and that list takes no wildcards — so she signs in on the one account
     * domain. But a Firebase session belongs to the origin that created it:
     * signing in at cuenta.example.com does not sign her in at
     * bella.example.com. Different origin, different storage.
     *
     * So the account domain mints a code here, sends her to her own domain
     * carrying it, and that page trades it for a token that signs her in
     * there. This table is what makes the trade safe.
     *
     * The code itself is never stored, only its SHA-256. Reading this table
     * then yields nothing usable, which matters because for sixty seconds a
     * row here is equivalent to her password.
     */
    CREATE TABLE IF NOT EXISTS auth_handoffs (
        code_hash   TEXT PRIMARY KEY,
        uid         TEXT NOT NULL,
        tenant_id   TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        expires_at  TIMESTAMPTZ NOT NULL,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
`;

/**
 * Indexes matching the API's actual access patterns. Without these, every
 * dashboard load and availability lookup is a sequential scan over the whole
 * multi-tenant table.
 */
const INDEXES = [
    'CREATE INDEX IF NOT EXISTS idx_tenants_owner ON tenants (owner_id)',
    'CREATE INDEX IF NOT EXISTS idx_services_tenant ON services (tenant_id)',
    'CREATE INDEX IF NOT EXISTS idx_staff_tenant_active ON staff (tenant_id, active)',
    'CREATE UNIQUE INDEX IF NOT EXISTS idx_staff_tenant_slug ON staff (tenant_id, slug) WHERE slug IS NOT NULL',
    'CREATE INDEX IF NOT EXISTS idx_appointments_tenant_start ON appointments (tenant_id, datetime_start)',
    'CREATE INDEX IF NOT EXISTS idx_appointments_tenant_staff_start ON appointments (tenant_id, staff_id, datetime_start)',
    'CREATE INDEX IF NOT EXISTS idx_appointments_tenant_phone ON appointments (tenant_id, client_phone)',
    'CREATE INDEX IF NOT EXISTS idx_appointments_created_at ON appointments (created_at)',
    'CREATE INDEX IF NOT EXISTS idx_slot_locks_expiry ON slot_locks (expires_at)',
    // Every redeem sweeps the expired rows on its way past.
    'CREATE INDEX IF NOT EXISTS idx_auth_handoffs_expiry ON auth_handoffs (expires_at)',
    // Stripe Connect delivers every account's events to one endpoint, so the
    // webhook looks the salon up by connected account id on every call.
    "CREATE INDEX IF NOT EXISTS idx_payment_accounts_stripe ON payment_accounts (stripe_account_id) WHERE stripe_account_id IS NOT NULL",
    'CREATE INDEX IF NOT EXISTS idx_platform_audit_created ON platform_audit (created_at DESC)',
    'CREATE INDEX IF NOT EXISTS idx_push_devices_tenant ON push_devices (tenant_id)',
    // The reminder job scans for confirmed appointments a day out; without this
    // it walks every appointment ever made, once an hour.
    "CREATE INDEX IF NOT EXISTS idx_appointments_pending_reminder ON appointments (datetime_start) WHERE reminded_at IS NULL AND status = 'confirmed'",
];

/**
 * Column additions for databases created by an earlier version of this file.
 * Safe to re-run; each is a no-op once applied.
 */
const COLUMN_BACKFILLS = [
    // Salons that got a folder before client photos had one of their own.
    `ALTER TABLE cdn_accounts ADD COLUMN IF NOT EXISTS reference_slug TEXT`,
    `ALTER TABLE services ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT TRUE`,
    `ALTER TABLE appointments ADD COLUMN IF NOT EXISTS price NUMERIC(10, 2)`,
    `ALTER TABLE appointments ADD COLUMN IF NOT EXISTS payment_method TEXT`,
    `ALTER TABLE appointments ADD COLUMN IF NOT EXISTS image_urls JSONB DEFAULT '[]'::jsonb`,
    `ALTER TABLE appointments ADD COLUMN IF NOT EXISTS image_url TEXT`,
    `ALTER TABLE staff ADD COLUMN IF NOT EXISTS weekly_schedule JSONB DEFAULT '{}'::jsonb`,
    `ALTER TABLE staff ADD COLUMN IF NOT EXISTS services_offered TEXT[] DEFAULT '{}'`,

    // How to reach the woman who runs the salon. Until now the only thing
    // recorded about her was a Firebase uid, which is useless when she calls.
    `ALTER TABLE tenants ADD COLUMN IF NOT EXISTS owner_name TEXT`,
    `ALTER TABLE tenants ADD COLUMN IF NOT EXISTS owner_email TEXT`,
    `ALTER TABLE tenants ADD COLUMN IF NOT EXISTS owner_phone TEXT`,
    `ALTER TABLE tenants ADD COLUMN IF NOT EXISTS owner_whatsapp TEXT`,
    `ALTER TABLE tenants ADD COLUMN IF NOT EXISTS notes TEXT`,

    // Stamped when the day-before reminder goes out, so a job whose window
    // still overlaps does not send the same reminder twice.
    `ALTER TABLE appointments ADD COLUMN IF NOT EXISTS reminded_at TIMESTAMPTZ`,
    // How many visits this client had already counted when the appointment was
    // confirmed, so the loyalty notice fires exactly once per reward earned.
    `ALTER TABLE appointments ADD COLUMN IF NOT EXISTS loyalty_notified BOOLEAN NOT NULL DEFAULT FALSE`,
];

export async function initDb(): Promise<void> {
    if (!env.database.autoMigrate) {
        log.info('Auto-migration disabled (DB_AUTO_MIGRATE=false); skipping schema bootstrap');
        return;
    }

    log.info('Bootstrapping schema');
    await query(TABLES);

    for (const statement of [...COLUMN_BACKFILLS, ...INDEXES]) {
        try {
            await query(statement);
        } catch (error) {
            // A backfill can legitimately fail on a database that already
            // diverged (e.g. an incompatible column type). Log and continue —
            // the table itself is already usable.
            log.warn('Schema statement skipped', { statement, ...errorContext(error) });
        }
    }

    log.info('Schema ready');
}
