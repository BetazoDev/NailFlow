"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const tenant_1 = require("./tenant");
const firebase_1 = require("./lib/firebase");
const mercadopago_1 = require("mercadopago");
// Initialize MP Client (In MVP, we use one token. In a full system, you would load this dynamically per tenant from DB)
const mpClient = new mercadopago_1.MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN || 'TEST-TOKEN-MOCK' });
const app = (0, express_1.default)();
const port = process.env.PORT || 4000;
app.use((0, cors_1.default)());
app.use(express_1.default.json());
// ── In-Memory Data Stores (MVP) ──────────────────────────
let servicesStore = [
    { id: 'svc-1', name: 'Manicura Clásica', duration_minutes: 45, estimated_price: 350, required_advance: 100, category: 'Manicura' },
    { id: 'svc-2', name: 'Aplicación Acrílico', duration_minutes: 120, estimated_price: 600, required_advance: 200, category: 'Acrílicas' },
    { id: 'svc-3', name: 'Retoque Acrílico', duration_minutes: 90, estimated_price: 450, required_advance: 150, category: 'Acrílicas' },
    { id: 'svc-4', name: 'Gelish en Manos', duration_minutes: 60, estimated_price: 400, required_advance: 150, category: 'Gel' },
    { id: 'svc-5', name: 'Pedicura Spa', duration_minutes: 60, estimated_price: 450, required_advance: 150, category: 'Pedicura' },
    { id: 'svc-6', name: 'Diseño Artístico', duration_minutes: 90, estimated_price: 550, required_advance: 180, category: 'Diseño' },
];
const todayStr = new Date().toISOString().split('T')[0];
let appointmentsStore = [
    { id: 'apt-1', tenant_id: 'demo-tenant', client_name: 'Lucia Ferreyra', client_phone: '5512345678', client_email: 'lucia@correo.com', service_id: 'svc-1', staff_id: 'staff-1', datetime_start: `${todayStr}T10:00:00Z`, datetime_end: `${todayStr}T10:45:00Z`, status: 'confirmed', advance_paid: true, notes: 'Diseño francés' },
    { id: 'apt-2', tenant_id: 'demo-tenant', client_name: 'Camila Rojas', client_phone: '5587654321', client_email: 'camila@correo.com', service_id: 'svc-4', staff_id: 'staff-2', datetime_start: `${todayStr}T12:00:00Z`, datetime_end: `${todayStr}T13:00:00Z`, status: 'pending_payment', advance_paid: false, notes: '' },
    { id: 'apt-3', tenant_id: 'demo-tenant', client_name: 'Valeria Méndez', client_phone: '5523456789', client_email: 'valeria@correo.com', service_id: 'svc-2', staff_id: 'staff-1', datetime_start: `${todayStr}T14:00:00Z`, datetime_end: `${todayStr}T16:00:00Z`, status: 'confirmed', advance_paid: true, notes: 'Baby boomer' },
    { id: 'apt-4', tenant_id: 'demo-tenant', client_name: 'Mariana Torres', client_phone: '5534567890', client_email: '', service_id: 'svc-5', staff_id: 'staff-2', datetime_start: `${todayStr}T16:00:00Z`, datetime_end: `${todayStr}T17:00:00Z`, status: 'confirmed', advance_paid: true, notes: '' },
    { id: 'apt-5', tenant_id: 'demo-tenant', client_name: 'Andrea Solis', client_phone: '5545678901', client_email: 'andrea@correo.com', service_id: 'svc-6', staff_id: 'staff-1', datetime_start: `${todayStr}T17:00:00Z`, datetime_end: `${todayStr}T18:30:00Z`, status: 'pending_payment', advance_paid: false, notes: 'Nail art temática' },
];
let tenantBranding = {};
// Middleware to extract tenant from request
app.use(async (req, res, next) => {
    // Skip tenant domain resolution for webhooks
    if (req.path.startsWith('/api/webhooks')) {
        return next();
    }
    const tenantDomain = req.headers['x-tenant-domain'] || 'demo.nailflow.com';
    try {
        const tenant = await (0, tenant_1.getTenantByDomain)(tenantDomain);
        if (!tenant) {
            return res.status(404).json({ error: 'Tenant not found' });
        }
        // @ts-ignore - Injecting tenant into request block for convenience
        req.tenant = tenant;
        next();
    }
    catch (e) {
        console.error('Error resolving tenant:', e);
        res.status(500).json({ error: 'Internal server error resolving tenant' });
    }
});
// Endpoint: Get Tenant configuration
app.get('/api/tenant', (req, res) => {
    // @ts-ignore
    res.json(req.tenant);
});
// Endpoint: Get Services
app.get('/api/services', async (req, res) => {
    try {
        res.json(servicesStore);
    }
    catch (e) {
        console.error('Failed to fetch services:', e);
        res.status(500).json({ error: 'Failed to fetch services' });
    }
});
// Endpoint: Create Service
app.post('/api/services', async (req, res) => {
    try {
        const { name, duration_minutes, estimated_price, required_advance, category } = req.body;
        if (!name || !duration_minutes || !estimated_price) {
            return res.status(400).json({ error: 'Name, duration, and price are required' });
        }
        const newService = {
            id: `svc-${Date.now()}`,
            name,
            duration_minutes: Number(duration_minutes),
            estimated_price: Number(estimated_price),
            required_advance: Number(required_advance) || 0,
            category: category || 'General'
        };
        servicesStore.push(newService);
        res.status(201).json(newService);
    }
    catch (e) {
        console.error('Failed to create service:', e);
        res.status(500).json({ error: 'Failed to create service' });
    }
});
// Endpoint: Update Service
app.put('/api/services/:id', async (req, res) => {
    try {
        const idx = servicesStore.findIndex(s => s.id === req.params.id);
        if (idx === -1)
            return res.status(404).json({ error: 'Service not found' });
        servicesStore[idx] = { ...servicesStore[idx], ...req.body, id: req.params.id };
        res.json(servicesStore[idx]);
    }
    catch (e) {
        res.status(500).json({ error: 'Failed to update service' });
    }
});
// Endpoint: Delete Service
app.delete('/api/services/:id', async (req, res) => {
    const idx = servicesStore.findIndex(s => s.id === req.params.id);
    if (idx === -1)
        return res.status(404).json({ error: 'Service not found' });
    servicesStore.splice(idx, 1);
    res.json({ success: true });
});
// Endpoint: Get Staff
app.get('/api/staff', async (req, res) => {
    // @ts-ignore
    const tenantId = req.tenant.id;
    try {
        // MOCK DATA FOR MVP - In real app, fetch from db collection 'tenants/{tenantId}/staff'
        const staffMembers = [
            {
                id: 'staff-1',
                tenant_id: tenantId,
                name: 'Ana López',
                email: 'ana@nailflow.demo',
                role: 'owner',
                photo_url: 'https://i.pravatar.cc/150?u=ana',
                bio: 'Especialista en Acrílico y Diseño 3D',
                active: true,
                color_identifier: '#E8B4B8',
                services_offered: ['svc-1', 'svc-2', 'svc-3']
            },
            {
                id: 'staff-2',
                tenant_id: tenantId,
                name: 'María García',
                email: 'maria@nailflow.demo',
                role: 'staff',
                photo_url: 'https://i.pravatar.cc/150?u=maria',
                bio: 'Experta en Gelish y Pedicura Spa',
                active: true,
                color_identifier: '#82C3A6',
                services_offered: ['svc-1', 'svc-4', 'svc-5']
            }
        ];
        res.json(staffMembers);
    }
    catch (e) {
        console.error('Failed to fetch staff:', e);
        res.status(500).json({ error: 'Failed to fetch staff' });
    }
});
// Endpoint: Get Appointments
app.get('/api/appointments', async (req, res) => {
    const staffId = req.query.staff_id;
    try {
        const filtered = staffId ? appointmentsStore.filter(a => a.staff_id === staffId) : appointmentsStore;
        res.json(filtered);
    }
    catch (e) {
        console.error('Failed to fetch appointments:', e);
        res.status(500).json({ error: 'Failed to fetch appointments' });
    }
});
// Endpoint: Get Single Appointment
app.get('/api/appointments/:id', async (req, res) => {
    const apt = appointmentsStore.find(a => a.id === req.params.id);
    if (!apt)
        return res.status(404).json({ error: 'Appointment not found' });
    // Enrich with service details
    const service = servicesStore.find(s => s.id === apt.service_id);
    res.json({ ...apt, service });
});
// Endpoint: Update Appointment Status
app.patch('/api/appointments/:id/status', async (req, res) => {
    const { status } = req.body;
    const validStatuses = ['pending_payment', 'confirmed', 'cancelled', 'completed'];
    if (!validStatuses.includes(status)) {
        return res.status(400).json({ error: `Status must be one of: ${validStatuses.join(', ')}` });
    }
    const idx = appointmentsStore.findIndex(a => a.id === req.params.id);
    if (idx === -1)
        return res.status(404).json({ error: 'Appointment not found' });
    appointmentsStore[idx] = { ...appointmentsStore[idx], status };
    res.json(appointmentsStore[idx]);
});
// Endpoint: Get Availability
app.get('/api/availability', async (req, res) => {
    const dateStr = req.query.date;
    const staffId = req.query.staff_id; // 'any' or specific staff ID
    // @ts-ignore
    const tenantId = req.tenant.id;
    if (!dateStr || !staffId) {
        return res.status(400).json({ error: 'Date and staff_id parameters are required' });
    }
    try {
        // MOCK DATA for availability. In reality, check staff weekly_schedule and appointments for the date
        const slots = [];
        const startHour = 9;
        const endHour = 18;
        for (let i = startHour; i < endHour; i++) {
            slots.push({ time: `${i.toString().padStart(2, '0')}:00`, available: true });
            slots.push({ time: `${i.toString().padStart(2, '0')}:30`, available: Math.random() > 0.3 }); // Randomly mock booked slots
        }
        res.json(slots);
    }
    catch (e) {
        console.error('Failed to fetch availability:', e);
        res.status(400).json({ error: 'Invalid date format or db error' });
    }
});
// Endpoint: Create Booking
app.post('/api/booking', async (req, res) => {
    const bookingData = req.body;
    // @ts-ignore
    const tenantId = req.tenant.id;
    // Basic validation
    if (!bookingData.service_id || !bookingData.date || !bookingData.time) {
        return res.status(400).json({ error: 'Missing required booking data' });
    }
    try {
        // Calculate temporary lock expiration time (10 minutes)
        const expiresAt = new Date();
        expiresAt.setMinutes(expiresAt.getMinutes() + 10);
        // Create an appointment document with pending status
        const appointmentRef = firebase_1.db.collection('tenants').doc(tenantId).collection('appointments').doc();
        await appointmentRef.set({
            ...bookingData,
            status: 'pending_payment',
            created_at: new Date().toISOString(),
            expires_at: expiresAt.toISOString()
        });
        // Generate MercadoPago Checkout Preference
        const preference = new mercadopago_1.Preference(mpClient);
        const advanceAmount = Number(bookingData.service_price) * 0.3;
        const mpResponse = await preference.create({
            body: {
                payment_methods: {
                    // Force the user to pay immediately online to secure the spot quickly
                    excluded_payment_types: [{ id: 'ticket' }]
                },
                items: [
                    {
                        id: bookingData.service_id,
                        title: `Anticipo de Cita - ${bookingData.service_name}`,
                        quantity: 1,
                        unit_price: advanceAmount
                    }
                ],
                metadata: {
                    tenant_id: tenantId,
                    appointment_id: appointmentRef.id
                },
                back_urls: {
                    success: `http://${req.headers['x-tenant-domain']}/book/success`,
                    failure: `http://${req.headers['x-tenant-domain']}/book`,
                    pending: `http://${req.headers['x-tenant-domain']}/book`
                },
                auto_return: 'approved',
                // notification_url is called by MP server to our server
                // We use query params to pass context to the webhook
                notification_url: `${process.env.APP_BASE_URL || 'https://api.nailflow.com'}/api/webhooks/mercadopago?tenant_id=${tenantId}&appointment_id=${appointmentRef.id}`
            }
        });
        res.json({
            success: true,
            appointmentId: appointmentRef.id,
            status: 'pending_payment',
            init_point: mpResponse.init_point, // URL to redirect the user
            message: 'Booking initialized. Redirecting to Mercado Pago.'
        });
    }
    catch (e) {
        console.error('Booking failed:', e);
        res.status(500).json({ error: 'Creation failed' });
    }
});
// Endpoint: Webhooks (Mercado Pago)
app.post('/api/webhooks/mercadopago', async (req, res) => {
    // Respond quickly to not block MP server
    res.sendStatus(200);
    const { type, data } = req.body;
    const { tenant_id, appointment_id } = req.query;
    if (!tenant_id || !appointment_id || type !== 'payment') {
        return;
    }
    try {
        // In reality, we should fetch payment status from MP using data.id and verify it's approved.
        // Assuming it's approved for MVP:
        const appointmentRef = firebase_1.db.collection('tenants').doc(tenant_id).collection('appointments').doc(appointment_id);
        const doc = await appointmentRef.get();
        if (doc.exists && doc.data()?.status === 'pending_payment') {
            const appointmentData = doc.data();
            // 1. Update appointment status
            await appointmentRef.update({
                status: 'confirmed',
                payment_ref: data.id // Store MP Payment ID
            });
            console.log(`✅ Appointment ${appointment_id} confirmed for Tenant ${tenant_id}`);
            // 2. Trigger n8n WhatsApp confirmation (Fire and forget)
            const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL || 'http://localhost:5678/webhook/nailflow-confirm';
            fetch(N8N_WEBHOOK_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    tenant_id,
                    appointment_id,
                    client_name: appointmentData?.client_name,
                    client_phone: appointmentData?.client_phone,
                    date: appointmentData?.date,
                    time: appointmentData?.time,
                    service_name: appointmentData?.service_name
                })
            }).catch(e => console.error('Failed to ping n8n webhook:', e));
        }
    }
    catch (e) {
        console.error('Webhook processing failed:', e);
    }
});
// Endpoint: Update Tenant Branding
app.put('/api/tenant', async (req, res) => {
    // @ts-ignore
    const tenantId = req.tenant.id;
    const { branding, settings } = req.body;
    tenantBranding[tenantId] = { ...tenantBranding[tenantId], branding, settings };
    // @ts-ignore
    const merged = { ...req.tenant, ...tenantBranding[tenantId] };
    res.json(merged);
});
app.listen(port, () => {
    console.log(`NailFlow API running on http://localhost:${port}`);
});
