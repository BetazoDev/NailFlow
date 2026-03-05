"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const admin = __importStar(require("firebase-admin"));
// NOTE: To run this script, you MUST set the GOOGLE_APPLICATION_CREDENTIALS 
// environment variable pointing to your Firebase Admin service account key JSON file.
// Example: set GOOGLE_APPLICATION_CREDENTIALS="C:\path\to\serviceAccountKey.json"
// Then run: npx ts-node src/seed.ts
admin.initializeApp();
const db = admin.firestore();
async function seed() {
    console.log('🌱 Starting Firebase Seeding...');
    const tenantId = 'demo-tenant-123';
    // 1. Create Tenant
    console.log('Creating Tenant...');
    await db.collection('tenants').doc(tenantId).set({
        domain: 'demo.com', // maps to localhost or demo.com
        branding: {
            logo_url: '',
            primary_color: '#E8B4B8', // Stitch soft variant
            secondary_color: '#CDB4DB',
        },
        settings: {
            currency: 'MXN',
            timezone: 'America/Mexico_City'
        },
        owner_id: 'owner_abc',
        subscription: {
            status: 'active',
            plan: 'pro'
        }
    });
    // 2. Create Staff (Users & Availabilities merged)
    console.log('Creating Staff...');
    const staffRef = db.collection('tenants').doc(tenantId).collection('staff');
    // Default schedule for demo
    const defaultSchedule = [1, 2, 3, 4, 5].map(day => ({
        day_of_week: day,
        start_time: '09:00',
        end_time: '18:00'
    })).concat([{ day_of_week: 6, start_time: '10:00', end_time: '15:00' }]);
    const staffMembers = [
        {
            id: 'owner_abc',
            name: 'Sarah (Dueña)',
            email: 'sarah@glowstudio.com',
            role: 'owner',
            photo_url: '',
            bio: 'Nail technician with 5 years of experience.',
            services_offered: ['svc_1', 'svc_2', 'svc_3'],
            weekly_schedule: defaultSchedule
        },
        {
            id: 'staff_xyz',
            name: 'Maria Vargas',
            email: 'maria@glowstudio.com',
            role: 'staff',
            photo_url: '',
            bio: 'Specialist in acrylics and nail art.',
            services_offered: ['svc_2', 'svc_4'],
            weekly_schedule: defaultSchedule
        }
    ];
    for (const st of staffMembers) {
        // use set to keep consistent IDS for demo
        await staffRef.doc(st.id).set(st);
    }
    // 3. Create Services
    console.log('Creating Services...');
    const servicesRef = db.collection('tenants').doc(tenantId).collection('services');
    const services = [
        { id: 'svc_1', name: 'Kapping Gel', duration_minutes: 90, estimated_price: 350, required_advance: 100 },
        { id: 'svc_2', name: 'Acrílicas Esculpidas', duration_minutes: 120, estimated_price: 550, required_advance: 200 },
        { id: 'svc_3', name: 'Manicura Rusa', duration_minutes: 60, estimated_price: 250, required_advance: 100 },
        { id: 'svc_4', name: 'Pedicura Spa', duration_minutes: 75, estimated_price: 400, required_advance: 150 },
    ];
    for (const s of services) {
        await servicesRef.doc(s.id).set(s);
    }
    console.log('✅ Seeding complete!');
    process.exit(0);
}
seed().catch(e => {
    console.error('❌ Error during seeding:', e);
    process.exit(1);
});
