import admin from 'firebase-admin';

const TENANT_ID = 'demo';

if (!admin.apps.length) {
    admin.initializeApp({ projectId: 'nail-demo-35d0a' });
}
const db = admin.firestore();

const services = [
    { id: 'svc-1', name: 'Manicura Clásica', duration_minutes: 45, estimated_price: 350, required_advance: 100, category: 'Manicura', description: 'Limado, cutícula y esmalte.' },
    { id: 'svc-2', name: 'Aplicación Acrílico', duration_minutes: 120, estimated_price: 600, required_advance: 200, category: 'Acrílicas', description: 'Uñas acrílicas desde cero.' },
    { id: 'svc-3', name: 'Retoque Acrílico', duration_minutes: 90, estimated_price: 450, required_advance: 150, category: 'Acrílicas', description: 'Mantenimiento cada 2-3 semanas.' },
    { id: 'svc-4', name: 'Gelish en Manos', duration_minutes: 60, estimated_price: 400, required_advance: 150, category: 'Gel', description: 'Esmalte gel larga duración.' },
    { id: 'svc-5', name: 'Pedicura Spa', duration_minutes: 60, estimated_price: 450, required_advance: 150, category: 'Pedicura', description: 'Exfoliación e hidratación.' },
    { id: 'svc-6', name: 'Diseño Artístico', duration_minutes: 90, estimated_price: 550, required_advance: 180, category: 'Diseño', description: 'Nail art personalizado.' },
];

const staffList = [
    { id: 'staff-1', name: 'Ana López', email: 'ana@nailflow.demo', role: 'owner', photo_url: 'https://i.pravatar.cc/150?u=ana-lopez', bio: 'Especialista en Acrílico y Diseño 3D.', active: true, color_identifier: '#E8B4B8', services_offered: ['svc-1', 'svc-2', 'svc-3', 'svc-6'] },
    { id: 'staff-2', name: 'María García', email: 'maria@nailflow.demo', role: 'staff', photo_url: 'https://i.pravatar.cc/150?u=maria-garcia', bio: 'Experta en Gelish y Pedicura Spa.', active: true, color_identifier: '#82C3A6', services_offered: ['svc-1', 'svc-4', 'svc-5'] },
];

const tenantDoc = {
    id: TENANT_ID, domain: 'demo.nailflow.com', name: 'Ana Nails Studio', owner_id: 'owner-demo',
    branding: { logo_url: '', primary_color: '#E8B4B8', secondary_color: '#D4A5A5' },
    settings: { currency: 'MXN', timezone: 'America/Mexico_City' },
    subscription: { status: 'active', plan: 'pro' },
};

async function seed() {
    console.log('🌱 Seeding Firestore for tenant:', TENANT_ID);
    const batch = db.batch();
    batch.set(db.doc(`tenants/${TENANT_ID}`), tenantDoc);
    for (const svc of services) {
        batch.set(db.doc(`tenants/${TENANT_ID}/services/${svc.id}`), svc);
    }
    for (const s of staffList) {
        batch.set(db.doc(`tenants/${TENANT_ID}/staff/${s.id}`), s);
    }
    await batch.commit();
    console.log('✅ Tenant + 6 services + 2 staff written successfully!');
    console.log('🎉 Seed complete!');
    process.exit(0);
}

seed().catch(e => { console.error('Seed failed:', e.message); process.exit(1); });
