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
      id SERIAL PRIMARY KEY,
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
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS client_favorites (
      tenant_id VARCHAR(255),
      client_phone VARCHAR(255),
      PRIMARY KEY (tenant_id, client_phone)
    );
  `);

  // Seed/Update initial demo tenant
  console.log('Seeding/Updating demo tenant...');
  await query(`
      INSERT INTO tenants (id, domain, name, branding, settings, subscription)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (id) DO UPDATE SET
        domain = EXCLUDED.domain,
        name = EXCLUDED.name,
        branding = EXCLUDED.branding,
        settings = EXCLUDED.settings
    `, [
    'demo-tenant',
    'demo.diabolicalservices.tech',
    'NailFlow Demo',
    JSON.stringify({
      primary_color: '#E8B4B8',
      secondary_color: '#82C3A6',
      palette: 'Soft Rose',
      typography: 'Outfit'
    }),
    JSON.stringify({ currency: 'MXN', timezone: 'America/Mexico_City' }),
    JSON.stringify({ status: 'active', plan: 'pro' })
  ]);

  // Seed Services if none exist (simplified check)
  const servicesCount = await query('SELECT count(*) FROM services WHERE tenant_id = $1', ['demo-tenant']);
  if (Number(servicesCount.rows[0].count) === 0) {
    console.log('Seeding demo services...');
    const services = [
      ['svc-1', 'Manicura Clásica', 'Limpieza y esmaltado tradicional', 45, 350, 100, 'Manicura'],
      ['svc-2', 'Aplicación Acrílico', 'Uñas acrílicas con diseño básico', 120, 600, 200, 'Acrílicas'],
      ['svc-3', 'Gelish en Manos', 'Esmaltado semipermanente de alta duración', 60, 400, 150, 'Gel']
    ];
    for (const s of services) {
      await query(
        'INSERT INTO services (id, tenant_id, name, description, duration_minutes, estimated_price, required_advance, category) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
        [s[0], 'demo-tenant', s[1], s[2], s[3], s[4], s[5], s[6]]
      );
    }
  }

  // Seed Staff if none exist
  const staffCount = await query('SELECT count(*) FROM staff WHERE tenant_id = $1', ['demo-tenant']);
  if (Number(staffCount.rows[0].count) === 0) {
    console.log('Seeding demo staff...');
    await query(
      'INSERT INTO staff (id, tenant_id, name, role, slug, specialty, color_identifier) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      ['staff-1', 'demo-tenant', 'Ana López', 'owner', 'ana', 'Acrílico y 3D', '#E8B4B8']
    );
  }

  console.log('Database initialization complete.');
}
