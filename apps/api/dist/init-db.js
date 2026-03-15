"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.initDb = initDb;
const db_1 = require("./lib/db");
async function initDb() {
    console.log('Initializing database schema...');
    await (0, db_1.query)(`
    CREATE TABLE IF NOT EXISTS tenants (
      id TEXT PRIMARY KEY,
      domain TEXT UNIQUE NOT NULL,
      name TEXT,
      branding JSONB,
      settings JSONB,
      owner_id TEXT,
      subscription JSONB,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS services (
      id TEXT PRIMARY KEY,
      tenant_id TEXT REFERENCES tenants(id),
      name TEXT NOT NULL,
      description TEXT,
      duration_minutes INTEGER,
      estimated_price NUMERIC,
      required_advance NUMERIC,
      category TEXT,
      image_url TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS staff (
      id TEXT PRIMARY KEY,
      tenant_id TEXT REFERENCES tenants(id),
      name TEXT NOT NULL,
      email TEXT,
      role TEXT,
      photo_url TEXT,
      bio TEXT,
      specialty TEXT,
      slug TEXT,
      active BOOLEAN DEFAULT TRUE,
      color_identifier TEXT,
      services_offered TEXT[],
      weekly_schedule JSONB,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS appointments (
      id TEXT PRIMARY KEY,
      tenant_id TEXT REFERENCES tenants(id),
      client_name TEXT NOT NULL,
      client_phone TEXT,
      client_email TEXT,
      service_id TEXT,
      staff_id TEXT,
      datetime_start TIMESTAMP WITH TIME ZONE,
      datetime_end TIMESTAMP WITH TIME ZONE,
      status TEXT DEFAULT 'pending_payment',
      advance_paid BOOLEAN DEFAULT FALSE,
      notes TEXT,
      payment_ref TEXT,
      price NUMERIC,
      payment_method TEXT,
      image_urls JSONB,
      image_url TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS client_favorites (
      tenant_id VARCHAR(255),
      client_phone VARCHAR(255),
      PRIMARY KEY (tenant_id, client_phone)
    );
  `);
    // Migrations: Ensure all columns exist
    console.log('Running migrations...');
    const migrations = [
        'ALTER TABLE services ADD COLUMN IF NOT EXISTS image_url TEXT',
        'ALTER TABLE services ADD COLUMN IF NOT EXISTS description TEXT',
        'ALTER TABLE staff ADD COLUMN IF NOT EXISTS slug TEXT',
        'ALTER TABLE staff ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT TRUE',
        'ALTER TABLE staff ADD COLUMN IF NOT EXISTS color_identifier TEXT',
        'ALTER TABLE staff ADD COLUMN IF NOT EXISTS services_offered TEXT[]',
        'ALTER TABLE staff ADD COLUMN IF NOT EXISTS weekly_schedule JSONB',
        'ALTER TABLE appointments ADD COLUMN IF NOT EXISTS price NUMERIC',
        'ALTER TABLE appointments ADD COLUMN IF NOT EXISTS payment_method TEXT',
        'ALTER TABLE appointments ADD COLUMN IF NOT EXISTS image_urls JSONB',
        'ALTER TABLE appointments ADD COLUMN IF NOT EXISTS image_url TEXT'
    ];
    for (const m of migrations) {
        try {
            await (0, db_1.query)(m);
        }
        catch (e) {
            console.warn(`Migration failed: ${m}`);
        }
    }
    /*
    // WIPE DATA FOR FRESH START (Commented out after initial reset to allow persistence)
    console.log('Wiping existing data for fresh start...');
    try {
      await query('TRUNCATE appointments, staff, services CASCADE');
      console.log('Data wiped successfully.');
    } catch (e) {
      console.error('Failed to wipe data:', e);
    }
    */
    // Ensure demo tenant exists (without seeding demo data)
    console.log('Ensuring demo tenant...');
    await (0, db_1.query)(`
      INSERT INTO tenants (id, domain, name, branding, settings, subscription, owner_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (id) DO UPDATE SET
        domain = EXCLUDED.domain,
        name = EXCLUDED.name,
        branding = COALESCE(tenants.branding, EXCLUDED.branding),
        settings = COALESCE(tenants.settings, EXCLUDED.settings),
        subscription = COALESCE(tenants.subscription, EXCLUDED.subscription),
        owner_id = COALESCE(tenants.owner_id, EXCLUDED.owner_id)
    `, [
        'demo-tenant',
        'demo.diabolicalservices.tech',
        'NailFlow Demo',
        JSON.stringify({
            primary_color: '#E8B4B8',
            secondary_color: '#82C3A6',
            palette_id: 'soft-rose',
            typography: 'Outfit',
            tagline: 'Tu oasis de belleza'
        }),
        JSON.stringify({ currency: 'MXN', timezone: 'America/Mexico_City' }),
        JSON.stringify({ status: 'active', plan: 'pro' }),
        'demo-owner-id' // Placeholder, will be updated if first-time setup or specified
    ]);
    console.log('Database initialization complete.');
}
