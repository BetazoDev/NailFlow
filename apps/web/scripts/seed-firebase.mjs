// One-time seed script: node scripts/seed-firebase.mjs
// Run with: node --experimental-vm-modules scripts/seed-firebase.mjs

import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, collection } from 'firebase/firestore';

const firebaseConfig = {
    apiKey: "AIzaSyDi8FLD8Itnv93f7_AcCRQJZwNUBShx9dI",
    authDomain: "nail-demo-35d0a.firebaseapp.com",
    projectId: "nail-demo-35d0a",
    storageBucket: "nail-demo-35d0a.firebasestorage.app",
    messagingSenderId: "781585885007",
    appId: "1:781585885007:web:166baa36c2a01e2db2073a",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const TENANT_ID = 'demo';

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
        id: 'staff-1',
        name: 'Ana López',
        email: 'ana@nailflow.demo',
        role: 'owner',
        photo_url: 'https://i.pravatar.cc/150?u=ana-lopez',
        bio: 'Especialista en Acrílico y Diseño 3D — 7 años de experiencia.',
        active: true,
        color_identifier: '#E8B4B8',
        services_offered: ['svc-1', 'svc-2', 'svc-3', 'svc-6'],
        weekly_schedule: [
            { day_of_week: 1, start_time: '09:00', end_time: '18:00' },
            { day_of_week: 2, start_time: '09:00', end_time: '18:00' },
            { day_of_week: 3, start_time: '09:00', end_time: '18:00' },
            { day_of_week: 4, start_time: '09:00', end_time: '18:00' },
            { day_of_week: 5, start_time: '09:00', end_time: '18:00' },
        ],
    },
    {
        id: 'staff-2',
        name: 'María García',
        email: 'maria@nailflow.demo',
        role: 'staff',
        photo_url: 'https://i.pravatar.cc/150?u=maria-garcia',
        bio: 'Experta en Gelish y Pedicura Spa — certificada en nail art.',
        active: true,
        color_identifier: '#82C3A6',
        services_offered: ['svc-1', 'svc-4', 'svc-5'],
        weekly_schedule: [
            { day_of_week: 2, start_time: '10:00', end_time: '19:00' },
            { day_of_week: 3, start_time: '10:00', end_time: '19:00' },
            { day_of_week: 4, start_time: '10:00', end_time: '19:00' },
            { day_of_week: 5, start_time: '10:00', end_time: '19:00' },
            { day_of_week: 6, start_time: '10:00', end_time: '17:00' },
        ],
    },
];

const tenant = {
    id: TENANT_ID,
    domain: 'demo.nailflow.com',
    name: 'Ana Nails Studio',
    owner_id: 'owner-demo',
    branding: {
        logo_url: '',
        primary_color: '#E8B4B8',
        secondary_color: '#D4A5A5',
    },
    settings: {
        currency: 'MXN',
        timezone: 'America/Mexico_City',
    },
    subscription: {
        status: 'active',
        plan: 'pro',
    },
};

async function seed() {
    console.log('🌱 Seeding Firestore for tenant:', TENANT_ID);

    // Tenant document
    await setDoc(doc(db, 'tenants', TENANT_ID), tenant);
    console.log('✅ Tenant created');

    // Services
    for (const svc of services) {
        await setDoc(doc(db, 'tenants', TENANT_ID, 'services', svc.id), svc);
        console.log('  ✅ Service:', svc.name);
    }

    // Staff
    for (const s of staff) {
        await setDoc(doc(db, 'tenants', TENANT_ID, 'staff', s.id), s);
        console.log('  ✅ Staff:', s.name);
    }

    console.log('\n🎉 Seed complete! Check your Firebase console.');
    process.exit(0);
}

seed().catch((e) => { console.error('Seed failed:', e); process.exit(1); });
