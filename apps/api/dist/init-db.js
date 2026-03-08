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
        'ALTER TABLE appointments ADD COLUMN IF NOT EXISTS payment_method TEXT'
    ];
    for (const m of migrations) {
        try {
            await (0, db_1.query)(m);
        }
        catch (e) {
            console.warn(`Migration failed: ${m}`, e);
        }
    }
    // Seed/Update initial demo tenant
    console.log('Seeding/Updating demo tenant...');
    await (0, db_1.query)(`
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
            palette_id: 'soft-rose',
            typography: 'Outfit'
        }),
        JSON.stringify({ currency: 'MXN', timezone: 'America/Mexico_City' }),
        JSON.stringify({ status: 'active', plan: 'pro' })
    ]);
    // Seed Services
    const servicesCount = await (0, db_1.query)('SELECT count(*) FROM services WHERE tenant_id = $1', ['demo-tenant']);
    if (Number(servicesCount.rows[0].count) === 0) {
        console.log('Seeding demo services...');
        const services = [
            ['svc-1', 'Manicura Clásica', 'Limpieza y esmaltado tradicional', 45, 350, 100, 'Manicura', 'https://images.unsplash.com/photo-1632345033839-247e99714b48?auto=format&fit=crop&q=80&w=400'],
            ['svc-2', 'Aplicación Acrílico', 'Uñas acrílicas con diseño básico', 120, 600, 200, 'Acrílicas', 'https://images.unsplash.com/photo-1604654894610-df490c6a710c?auto=format&fit=crop&q=80&w=400'],
            ['svc-3', 'Gelish en Manos', 'Esmaltado semipermanente de alta duración', 60, 400, 150, 'Gel', 'https://images.unsplash.com/photo-1519014816548-bf5fe059798b?auto=format&fit=crop&q=80&w=400'],
            ['svc-4', 'Pedicura Spa', 'Relajante pedicura con exfoliación y masaje', 75, 500, 150, 'Pedicura', 'https://images.unsplash.com/photo-1597049128960-4009c7a98a4e?auto=format&fit=crop&q=80&w=400']
        ];
        for (const s of services) {
            await (0, db_1.query)('INSERT INTO services (id, tenant_id, name, description, duration_minutes, estimated_price, required_advance, category, image_url) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)', [s[0], 'demo-tenant', s[1], s[2], s[3], s[4], s[5], s[6], s[7]]);
        }
    }
    // Seed Staff
    const staffCount = await (0, db_1.query)('SELECT count(*) FROM staff WHERE tenant_id = $1', ['demo-tenant']);
    if (Number(staffCount.rows[0].count) === 0) {
        console.log('Seeding demo staff...');
        await (0, db_1.query)('INSERT INTO staff (id, tenant_id, name, role, slug, specialty, color_identifier, photo_url) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)', ['staff-1', 'demo-tenant', 'Ana López', 'owner', 'ana', 'Acrílico y 3D', '#E8B4B8', 'https://images.unsplash.com/photo-1595152772835-219674b2a8a6?auto=format&fit=crop&q=80&w=400']);
    }
    // Seed Appointments
    const aptCount = await (0, db_1.query)('SELECT count(*) FROM appointments WHERE tenant_id = $1', ['demo-tenant']);
    if (Number(aptCount.rows[0].count) === 0) {
        console.log('Seeding demo appointments...');
        const appointments = [
            ['apt-1', 'demo-tenant', 'svc-1', 'staff-1', 'Lucia Ferreyra', 'lucia@correo.com', '5512345678', '2026-03-07 10:00:00', '2026-03-07 10:45:00', 'confirmed', true, 'Diseño francés', 350],
            ['apt-2', 'demo-tenant', 'svc-1', 'staff-1', 'Camila Rojas', 'camila@correo.com', '5587654321', '2026-03-07 12:00:00', '2026-03-07 13:00:00', 'pending_payment', false, '', 400]
        ];
        for (const a of appointments) {
            await (0, db_1.query)('INSERT INTO appointments (id, tenant_id, service_id, staff_id, client_name, client_email, client_phone, datetime_start, datetime_end, status, advance_paid, notes, price) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)', a);
        }
    }
    console.log('Database initialization complete.');
}
