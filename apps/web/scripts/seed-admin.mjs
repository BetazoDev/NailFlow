/**
 * Seed script using firebase-admin (terminates cleanly)
 * Run from the repo root: node apps/web/scripts/seed-admin.mjs
 * Requires GOOGLE_APPLICATION_CREDENTIALS env var OR run in the API folder where firebase-admin is set up
 */
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
const { applicationDefault } = require('firebase-admin/app');

const TENANT_ID = 'demo';

if (!admin.apps.length) {
    admin.initializeApp({ credential: applicationDefault(), projectId: 'nail-demo-35d0a' });
}
const db = admin.firestore();

const services = [
    { id: 'svc-1', name: 'Manicura Clásica', duration_minutes: 45, estimated_price: 350, required_advance: 100, category: 'Manicura', description: 'Limado, cutícula perfeccionada y esmalte de tu elección.' },
    { id: 'svc-2', name: 'Aplicación Acrílico', duration_minutes: 120, estimated_price: 600, required_advance: 200, category: 'Acrílicas', description: 'Uñas acrílicas desde cero con el largo que desees.' },
    { id: 'svc-3', name: 'Retoque Acrílico', duration_minutes: 90, estimated_price: 450, required_advance: 150, category: 'Acrílicas', description: 'Mantenimiento de tus uñas acrílicas cada 2–3 semanas.' },
    { id: 'svc-4', name: 'Gelish en Manos', duration_minutes: 60, estimated_price: 400, required_advance: 150, category: 'Gel', description: 'Esmalte en gel de larga duración, hasta 3 semanas sin astillas.' },
    { id: 'svc-5', name: 'Pedicura Spa', duration_minutes: 60, estimated_price: 450, required_advance: 150, category: 'Pedicura', description: 'Exfoliación, hidratación profunda y esmalte en pies.' },
    { id: 'svc-6', name: 'Diseño Artístico', duration_minutes: 90, estimated_price: 550, required_advance: 180, category: 'Diseño', description: 'Nail art personalizado: flores, mármol, glitter, nail foils.' },
];

const staff = [
    {
        id: 'staff-1', name: 'Ana López', email: 'ana@nailflow.demo', role: 'owner',
        photo_url: 'https://i.pravatar.cc/150?u=ana-lopez', bio: 'Especialista en Acrílico y Diseño 3D — 7 años de experiencia.',
        active: true, color_identifier: '#E8B4B8', services_offered: ['svc-1', 'svc-2', 'svc-3', 'svc-6'],
        weekly_schedule: [1, 2, 3, 4, 5].map(d => ({ day_of_week: d, start_time: '09:00', end_time: '18:00' })),
    },
    {
        id: 'staff-2', name: 'María García', email: 'maria@nailflow.demo', role: 'staff',
        photo_url: 'https://i.pravatar.cc/150?u=maria-garcia', bio: 'Experta en Gelish y Pedicura Spa — certificada en nail art.',
        active: true, color_identifier: '#82C3A6', services_offered: ['svc-1', 'svc-4', 'svc-5'],
        weekly_schedule: [
            { day_of_week: 2, start_time: '10:00', end_time: '19:00' },
            { day_of_week: 3, start_time: '10:00', end_time: '19:00' },
            { day_of_week: 4, start_time: '10:00', end_time: '19:00' },
            { day_of_week: 5, start_time: '10:00', end_time: '19:00' },
            { day_of_week: 6, start_time: '10:00', end_time: '17:00' },
        ],
    },
];

async function seed() {
    console.log('🌱 Seeding Firestore for tenant:', TENANT_ID);
    const batch = db.batch();

    // Tenant
    batch.set(db.doc(`tenants/${TENANT_ID}`), {
        id: TENANT_ID, domain: 'demo.nailflow.com', name: 'Ana Nails Studio', owner_id: 'owner-demo',
        branding: { logo_url: '', primary_color: '#E8B4B8', secondary_color: '#D4A5A5' },
        settings: { currency: 'MXN', timezone: 'America/Mexico_City' },
        subscription: { status: 'active', plan: 'pro' },
    });

    // Services
    for (const svc of services) {
        batch.set(db.doc(`tenants/${TENANT_ID}/services/${svc.id}`), svc);
    }
    // Staff
    for (const s of staff) {
        const { id, ...data } = s;
        batch.set(db.doc(`tenants/${TENANT_ID}/staff/${id}`), data);
    }

    await batch.commit();
    console.log('✅ Tenant + 6 services + 2 staff written');
    console.log('🎉 Seed complete!');
    process.exit(0);
}

seed().catch(e => { console.error('Seed failed:', e); process.exit(1); });
