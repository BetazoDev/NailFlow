import { query } from './lib/db';

export async function initDb() {
  console.log('Initializing database schema...');

  await query(`
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
    'ALTER TABLE appointments ADD COLUMN IF NOT EXISTS image_urls JSONB'
  ];

  for (const m of migrations) {
    try {
      await query(m);
    } catch (e) {
      console.warn(`Migration failed: ${m}`, e);
    }
  }

  // Ensure demo tenant exists (without seeding demo data)
  console.log('Ensuring demo tenant...');
  await query(`
      INSERT INTO tenants (id, domain, name, branding, settings, subscription)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (id) DO UPDATE SET
        domain = EXCLUDED.domain,
        name = EXCLUDED.name,
        settings = COALESCE(tenants.settings, EXCLUDED.settings),
        subscription = COALESCE(tenants.subscription, EXCLUDED.subscription)
    `, [
    'demo-tenant',
    'demo.diabolicalservices.tech',
    'NailFlow Demo',
    JSON.stringify({
      primary_color: '#E8B4B8',
      secondary_color: '#82C3A6',
      palette_id: 'soft-rose',
      typography: 'Outfit'
    }),
    JSON.stringify({ currency: 'MXN', timezone: 'America/Mexico_City' }),
    JSON.stringify({ status: 'active', plan: 'pro' })
  ]);

  // NOTE: No demo services, staff, or appointments are seeded.
  // The admin user sets up all content via the admin panel.

  console.log('Database initialization complete.');
}
