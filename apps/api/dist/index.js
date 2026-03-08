"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const tenant_1 = require("./tenant");
const mercadopago_1 = require("mercadopago");
const db_1 = require("./lib/db");
const init_db_1 = require("./init-db");
const crypto_1 = __importDefault(require("crypto"));
// Initialize MP Client 
const mpClient = new mercadopago_1.MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN || 'TEST-TOKEN-MOCK' });
const app = (0, express_1.default)();
const port = process.env.PORT || 3000;
app.use((0, cors_1.default)());
app.use(express_1.default.json());
// Initialize DB schema
(0, init_db_1.initDb)().catch(console.error);
let tenantBranding = {};
// Middleware to extract tenant from request
app.use(async (req, res, next) => {
    // Skip tenant domain resolution for webhooks
    if (req.path.startsWith('/api/webhooks')) {
        return next();
    }
    const tenantDomain = (req.headers['x-tenant-domain'] || req.query.domain);
    const tenantId = (req.headers['x-tenant-id'] || req.query.id);
    const ownerId = req.query.owner_id;
    try {
        let tenant = null;
        if (tenantId) {
            tenant = await (0, tenant_1.getTenantById)(tenantId);
        }
        else if (ownerId) {
            const res = await (0, db_1.query)('SELECT * FROM tenants WHERE owner_id = $1', [ownerId]);
            tenant = res.rows.length > 0 ? res.rows[0] : null;
        }
        else {
            tenant = await (0, tenant_1.getTenantByDomain)(tenantDomain || 'demo.diabolicalservices.tech');
        }
        if (!tenant) {
            return res.status(404).json({ error: 'Tenant not found' });
        }
        // @ts-ignore
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
        // @ts-ignore
        const tenantId = req.tenant.id;
        const result = await (0, db_1.query)('SELECT * FROM services WHERE tenant_id = $1', [tenantId]);
        res.json(result.rows);
    }
    catch (e) {
        console.error('Failed to fetch services:', e);
        res.status(500).json({ error: 'Failed to fetch services' });
    }
});
// Endpoint: Create Service
app.post('/api/services', async (req, res) => {
    try {
        const { name, description, duration_minutes, estimated_price, required_advance, category, image_url } = req.body;
        // @ts-ignore
        const tenantId = req.tenant.id;
        if (!name || !duration_minutes || !estimated_price) {
            return res.status(400).json({ error: 'Name, duration, and price are required' });
        }
        const id = crypto_1.default.randomUUID();
        const result = await (0, db_1.query)('INSERT INTO services (id, tenant_id, name, description, duration_minutes, estimated_price, required_advance, category, image_url) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *', [id, tenantId, name, description, Number(duration_minutes), Number(estimated_price), Number(required_advance) || 0, category || 'General', image_url || '']);
        res.status(201).json(result.rows[0]);
    }
    catch (e) {
        console.error('Failed to create service:', e);
        res.status(500).json({ error: 'Failed to create service' });
    }
});
// Endpoint: Update Service
app.put('/api/services/:id', async (req, res) => {
    try {
        const { name, description, duration_minutes, estimated_price, required_advance, category, image_url } = req.body;
        // @ts-ignore
        const tenantId = req.tenant.id;
        const result = await (0, db_1.query)('UPDATE services SET name = $1, description = $2, duration_minutes = $3, estimated_price = $4, required_advance = $5, category = $6, image_url = $7 WHERE id = $8 AND tenant_id = $9 RETURNING *', [name, description, Number(duration_minutes), Number(estimated_price), Number(required_advance), category, image_url, req.params.id, tenantId]);
        if (result.rowCount === 0)
            return res.status(404).json({ error: 'Service not found' });
        res.json(result.rows[0]);
    }
    catch (e) {
        console.error('Failed to update service:', e);
        res.status(500).json({ error: 'Failed to update service' });
    }
});
// Endpoint: Delete Service
app.delete('/api/services/:id', async (req, res) => {
    // @ts-ignore
    const tenantId = req.tenant.id;
    const result = await (0, db_1.query)('DELETE FROM services WHERE id = $1 AND tenant_id = $2', [req.params.id, tenantId]);
    if (result.rowCount === 0)
        return res.status(404).json({ error: 'Service not found' });
    res.json({ success: true });
});
// Endpoint: Get Staff
app.get('/api/staff', async (req, res) => {
    // @ts-ignore
    const tenantId = req.tenant.id;
    try {
        const result = await (0, db_1.query)('SELECT * FROM staff WHERE tenant_id = $1 AND active = true', [tenantId]);
        res.json(result.rows);
    }
    catch (e) {
        console.error('Failed to fetch staff:', e);
        res.status(500).json({ error: 'Failed to fetch staff' });
    }
});
// Endpoint: Get Appointments
app.get('/api/appointments', async (req, res) => {
    const staffId = req.query.staff_id;
    // @ts-ignore
    const tenantId = req.tenant.id;
    try {
        let text = 'SELECT * FROM appointments WHERE tenant_id = $1';
        let params = [tenantId];
        if (staffId) {
            text += ' AND staff_id = $2';
            params.push(staffId);
        }
        const result = await (0, db_1.query)(text, params);
        res.json(result.rows);
    }
    catch (e) {
        console.error('Failed to fetch appointments:', e);
        res.status(500).json({ error: 'Failed to fetch appointments' });
    }
});
// Endpoint: Get Single Appointment
app.get('/api/appointments/:id', async (req, res) => {
    try {
        const result = await (0, db_1.query)('SELECT a.*, s.name as service_name FROM appointments a LEFT JOIN services s ON a.service_id = s.id WHERE a.id = $1', [req.params.id]);
        if (result.rowCount === 0)
            return res.status(404).json({ error: 'Appointment not found' });
        res.json(result.rows[0]);
    }
    catch (e) {
        res.status(500).json({ error: 'Failed to fetch appointment' });
    }
});
// Endpoint: Update Appointment Status
app.patch('/api/appointments/:id/status', async (req, res) => {
    const { status } = req.body;
    const validStatuses = ['pending_payment', 'confirmed', 'cancelled', 'completed'];
    if (!validStatuses.includes(status)) {
        return res.status(400).json({ error: `Status must be one of: ${validStatuses.join(', ')}` });
    }
    try {
        const result = await (0, db_1.query)('UPDATE appointments SET status = $1 WHERE id = $2 RETURNING *', [status, req.params.id]);
        if (result.rowCount === 0)
            return res.status(404).json({ error: 'Appointment not found' });
        res.json(result.rows[0]);
    }
    catch (e) {
        res.status(500).json({ error: 'Failed to update appointment' });
    }
});
// Endpoint: Get Availability
app.get('/api/availability', async (req, res) => {
    const { date, staff_id } = req.query;
    // @ts-ignore
    const tenantId = req.tenant.id;
    if (!date)
        return res.status(400).json({ error: 'Date is required' });
    try {
        // Query booked times, converting to Mexico City timezone for comparison
        const result = await (0, db_1.query)(`SELECT TO_CHAR(datetime_start AT TIME ZONE 'UTC' AT TIME ZONE 'America/Mexico_City', 'HH24:MI') as time 
             FROM appointments 
             WHERE tenant_id = $1 
             AND TO_CHAR(datetime_start AT TIME ZONE 'UTC' AT TIME ZONE 'America/Mexico_City', 'YYYY-MM-DD') = $2 
             AND status IN ('confirmed', 'pending_payment')`, [tenantId, date]);
        const bookedTimes = new Set(result.rows.map(r => r.time));
        // Get "Now" in Mexico City
        const nowInCDMX = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Mexico_City' }));
        const bufferLimit = new Date(nowInCDMX.getTime() + 3 * 60 * 60 * 1000);
        // Requested date as YYYY-MM-DD
        const requestedDate = date;
        const slots = [];
        for (let h = 9; h < 21; h++) {
            for (const min of [0, 30]) {
                const time = `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
                // Construct a Date object for the slot in CDMX
                const slotDateTime = new Date(`${requestedDate}T${time}:00`);
                // Since 'new Date(string)' assumes local time if no TZ, and server might be UTC, 
                // we should be careful. Better way:
                const [year, month, day] = requestedDate.split('-').map(Number);
                const slotDate = new Date(year, month - 1, day, h, min);
                // But wait, the comparison should be in CDMX time.
                // If nowInCDMX is already local to CDMX, and we construct slotDate as local, 
                // the comparison is safe as long as they are on the SAME machine or handled as timestamps.
                if (slotDate < bufferLimit)
                    continue;
                if (!bookedTimes.has(time)) {
                    slots.push({ time, available: true });
                }
            }
        }
        res.json(slots);
    }
    catch (e) {
        console.error('Failed to fetch availability:', e);
        res.status(500).json({ error: 'Failed to fetch availability' });
    }
});
// Endpoint: Create Booking (Test/PRUEBA mode — no payment gateway)
app.post('/api/bookings/test', async (req, res) => {
    const { service_id, staff_id, date, time, client_name, client_phone, client_email, notes } = req.body;
    // @ts-ignore
    const tenantId = req.tenant.id;
    console.log('Received test booking request:', { tenantId, client_name, date, time });
    if (!client_name || !date || !time) {
        return res.status(400).json({ error: 'client_name, date, and time are required' });
    }
    try {
        const svcRes = await (0, db_1.query)('SELECT duration_minutes, estimated_price FROM services WHERE id = $1', [service_id]);
        if (svcRes.rowCount === 0)
            return res.status(404).json({ error: 'Service not found' });
        const { duration_minutes: duration, estimated_price: service_price } = svcRes.rows[0];
        const id = crypto_1.default.randomUUID();
        // Use Mexico City timezone for datetime_start
        // We append -06:00 (Standard) or -05:00 (Daylight) offset. 
        // Better: let Postgres handle it by passing a string with the timezone name
        const datetime_start_str = `${date} ${time}:00 America/Mexico_City`;
        // Calculate end time
        const [h, m] = time.split(':').map(Number);
        const startDate = new Date(2000, 0, 1, h, m);
        const endDate = new Date(startDate.getTime() + duration * 60000);
        const endStr = `${String(endDate.getHours()).padStart(2, '0')}:${String(endDate.getMinutes()).padStart(2, '0')}`;
        const datetime_end_str = `${date} ${endStr}:00 America/Mexico_City`;
        const result = await (0, db_1.query)('INSERT INTO appointments (id, tenant_id, service_id, staff_id, client_name, client_email, client_phone, datetime_start, datetime_end, status, payment_method, price) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *', [id, tenantId, service_id, staff_id, client_name, client_email || '', client_phone, datetime_start_str, datetime_end_str, 'confirmed', 'PRUEBA', service_price]);
        console.log('Test booking created successfully:', result.rows[0].id);
        res.json({ appointmentId: result.rows[0].id, success: true });
    }
    catch (e) {
        console.error('Test booking failed:', e);
        res.status(500).json({ error: 'Failed to create test booking' });
    }
});
// Endpoint: Create Booking (Initiates MercadoPago Payment)
app.post('/api/bookings', async (req, res) => {
    const { service_id, staff_id, date, time, client_name, client_phone, client_email, notes } = req.body;
    // @ts-ignore
    const tenantId = req.tenant.id;
    try {
        const svcRes = await (0, db_1.query)('SELECT * FROM services WHERE id = $1', [service_id]);
        if (svcRes.rowCount === 0)
            return res.status(404).json({ error: 'Service not found' });
        const service = svcRes.rows[0];
        const { service_price, service_duration } = req.body;
        // Implementation of different gateways
        if (req.body.payment_method === 'stripe') {
            // TODO: Integrar Stripe API (Sk_test_...)
            // const session = await stripe.checkout.sessions.create({ ... })
            // return res.json({ init_point: session.url })
        }
        if (req.body.payment_method === 'paypal') {
            // TODO: Integrar PayPal SDK
        }
        if (req.body.payment_method === 'apple_pay' || req.body.payment_method === 'google_pay') {
            // TODO: Integrar Wallet APIs
        }
        // Use Mexico City timezone for datetime_start
        const datetime_start_str = `${date} ${time}:00 America/Mexico_City`;
        const [h, m] = time.split(':').map(Number);
        const startDate = new Date(2000, 0, 1, h, m);
        const endDate = new Date(startDate.getTime() + (service_duration || 60) * 60000);
        const endStr = `${String(endDate.getHours()).padStart(2, '0')}:${String(endDate.getMinutes()).padStart(2, '0')}`;
        const datetime_end_str = `${date} ${endStr}:00 America/Mexico_City`;
        // Create appointment in 'pending_payment' status
        const aptRes = await (0, db_1.query)(`INSERT INTO appointments 
            (id, tenant_id, client_name, client_phone, client_email, service_id, staff_id, datetime_start, datetime_end, status, notes, price, payment_method) 
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING *`, [crypto_1.default.randomUUID(), tenantId, client_name, client_phone, client_email, service_id, staff_id, datetime_start_str, datetime_end_str, 'pending_payment', notes, service_price, req.body.payment_method]);
        const appointment = aptRes.rows[0];
        // Create MP Preference
        const preference = new mercadopago_1.Preference(mpClient);
        const response = await preference.create({
            body: {
                items: [{
                        id: service.id,
                        title: service.name,
                        quantity: 1,
                        unit_price: Number(service.required_advance),
                    }],
                external_reference: appointment.id.toString(),
                notification_url: `${process.env.APP_BASE_URL}/api/webhooks/mercadopago`,
                back_urls: {
                    success: `https://${req.headers['host']}/book/success`,
                    failure: `https://${req.headers['host']}/book/error`,
                },
                auto_return: 'approved',
            }
        });
        res.json({
            appointmentId: appointment.id,
            init_point: response.init_point
        });
    }
    catch (e) {
        console.error('Booking failed:', e);
        res.status(500).json({ error: 'Booking process failed' });
    }
});
// Endpoint: MercadoPago Webhook
app.post('/api/webhooks/mercadopago', async (req, res) => {
    const { type, data } = req.body;
    if (type === 'payment') {
        try {
            // Usually we'd fetch details from MP with data.id here.
            // For now, let's just mark the reference as paid if we can find it.
            // External reference was appointment.id
            const paymentId = data.id;
            // Note: In real scenarios, MP sends a notification, then you GET the payment to see external_reference
            console.log(`Payment incoming: ${paymentId}`);
        }
        catch (e) {
            console.error('Webhook processing failed:', e);
        }
    }
    res.sendStatus(200);
});
// Endpoint: Update Tenant Branding
app.put('/api/tenant', async (req, res) => {
    // @ts-ignore
    const tenantId = req.tenant.id;
    const { name, branding, settings } = req.body;
    try {
        const result = await (0, db_1.query)('UPDATE tenants SET name = COALESCE($1, name), branding = COALESCE($2, branding), settings = COALESCE($3, settings) WHERE id = $4 RETURNING *', [name, branding, settings, tenantId]);
        res.json(result.rows[0]);
    }
    catch (e) {
        res.status(500).json({ error: 'Failed to update tenant' });
    }
});
// Endpoint: Complete Appointment
app.post('/api/appointments/:id/complete', async (req, res) => {
    try {
        const { id } = req.params;
        // @ts-ignore
        const tenantId = req.tenant.id;
        await (0, db_1.query)("UPDATE appointments SET status = 'completed' WHERE id = $1 AND tenant_id = $2", [id, tenantId]);
        res.json({ success: true });
    }
    catch (e) {
        res.status(500).json({ error: 'Failed to complete appointment' });
    }
});
// Endpoint: Staff Management (POST)
app.post('/api/staff', async (req, res) => {
    try {
        // @ts-ignore
        const tenantId = req.tenant.id;
        const { name, email, role, specialty, photo_url, slug, active, bio, color_identifier, services_offered, weekly_schedule } = req.body;
        const id = crypto_1.default.randomUUID();
        const result = await (0, db_1.query)('INSERT INTO staff (id, tenant_id, name, email, role, specialty, photo_url, slug, active, bio, color_identifier, services_offered, weekly_schedule) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING *', [id, tenantId, name, email, role, specialty, photo_url, slug || name.toLowerCase().replace(/\s+/g, '-'), active !== false, bio, color_identifier, services_offered || [], weekly_schedule || {}]);
        res.json(result.rows[0]);
    }
    catch (e) {
        console.error('Failed to create staff member:', e);
        res.status(500).json({ error: 'Failed to create staff member' });
    }
});
// Endpoint: Staff Management (PUT)
app.put('/api/staff/:id', async (req, res) => {
    try {
        const { id } = req.params;
        // @ts-ignore
        const tenantId = req.tenant.id;
        const { name, email, role, specialty, photo_url, slug, active, bio, color_identifier, services_offered, weekly_schedule } = req.body;
        const result = await (0, db_1.query)('UPDATE staff SET name = $1, email = $2, role = $3, specialty = $4, photo_url = $5, slug = $6, active = $7, bio = $8, color_identifier = $9, services_offered = $10, weekly_schedule = $11 WHERE id = $12 AND tenant_id = $13 RETURNING *', [name, email, role, specialty, photo_url, slug, active, bio, color_identifier, services_offered, weekly_schedule, id, tenantId]);
        if (result.rowCount === 0)
            return res.status(404).json({ error: 'Staff member not found' });
        res.json(result.rows[0]);
    }
    catch (e) {
        console.error('Failed to update staff member:', e);
        res.status(500).json({ error: 'Failed to update staff member' });
    }
});
// Endpoint: Favorites (GET)
app.get('/api/favorites', async (req, res) => {
    try {
        // @ts-ignore
        const tenantId = req.tenant.id;
        const result = await (0, db_1.query)('SELECT client_phone FROM client_favorites WHERE tenant_id = $1', [tenantId]);
        res.json(result.rows.map(r => r.client_phone));
    }
    catch (e) {
        res.status(500).json({ error: 'Failed to fetch favorites' });
    }
});
// Endpoint: Favorites (POST)
app.post('/api/favorites/:phone', async (req, res) => {
    try {
        const { phone } = req.params;
        const { favorite } = req.body;
        // @ts-ignore
        const tenantId = req.tenant.id;
        if (favorite) {
            await (0, db_1.query)('INSERT INTO client_favorites (tenant_id, client_phone) VALUES ($1, $2) ON CONFLICT DO NOTHING', [tenantId, phone]);
        }
        else {
            await (0, db_1.query)('DELETE FROM client_favorites WHERE tenant_id = $1 AND client_phone = $2', [tenantId, phone]);
        }
        res.json({ success: true });
    }
    catch (e) {
        res.status(500).json({ error: 'Failed to update favorite' });
    }
});
app.get('/health', (req, res) => res.send('OK'));
app.listen(port, () => {
    console.log(`NailFlow API running on http://localhost:${port}`);
});
