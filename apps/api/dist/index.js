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
const luxon_1 = require("luxon");
const init_db_1 = require("./init-db");
const crypto_1 = __importDefault(require("crypto"));
// Initialize MP Client 
const mpClient = new mercadopago_1.MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN || 'TEST-TOKEN-MOCK' });
const app = (0, express_1.default)();
const port = process.env.PORT || 3000;
app.use((0, cors_1.default)());
app.use(express_1.default.json());
let tenantBranding = {};
// Initialize DB schema
(0, init_db_1.initDb)().catch(console.error);
// Helper for safe UUID generation
const getUUID = () => {
    try {
        return crypto_1.default.randomUUID();
    }
    catch (e) {
        return crypto_1.default.randomBytes(16).toString('hex');
    }
};
// Middleware to extract tenant from request
app.use(async (req, res, next) => {
    // Basic request logging
    console.log(`[API Request] ${req.method} ${req.url}`, {
        host: req.headers.host,
        tenantDomain: req.headers['x-tenant-domain'],
        tenantId: req.headers['x-tenant-id']
    });
    // Skip tenant domain resolution for webhooks and health
    const skipPaths = ['/health', '/api/webhooks', '/api/health'];
    if (skipPaths.some(p => req.path.startsWith(p))) {
        return next();
    }
    const tenantDomain = (req.headers['x-tenant-domain'] || req.query.domain || req.headers.host);
    const tenantId = (req.headers['x-tenant-id'] || req.query.id);
    const ownerId = req.query.owner_id;
    try {
        let tenant = null;
        if (tenantId && tenantId !== 'undefined') {
            tenant = await (0, tenant_1.getTenantById)(tenantId);
        }
        else if (ownerId) {
            const res = await (0, db_1.query)('SELECT * FROM tenants WHERE owner_id = $1', [ownerId]);
            tenant = res.rows.length > 0 ? res.rows[0] : null;
        }
        else {
            // Clean domain (remove port if present)
            const cleanDomain = tenantDomain?.split(':')[0] || 'demo.diabolicalservices.tech';
            tenant = await (0, tenant_1.getTenantByDomain)(cleanDomain);
            // Fallback for demo if still not found
            if (!tenant && (cleanDomain.includes('diabolicalservices.tech') || cleanDomain.includes('localhost'))) {
                tenant = await (0, tenant_1.getTenantById)('demo-tenant');
            }
        }
        if (!tenant) {
            console.warn(`Tenant not found for: ${tenantDomain || tenantId}. Falling back to demo.`);
            tenant = await (0, tenant_1.getTenantById)('demo-tenant');
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
// Create API Router to handle both cases (/api or direct)
const apiRouter = express_1.default.Router();
// Health check inside router too
apiRouter.get('/health', (req, res) => res.send('OK'));
// Endpoint: Admin Cleanup (wipe services, staff, appointments for tenant)
// Protected by secret key - only for demo reset
apiRouter.post('/admin/cleanup', async (req, res) => {
    const { secret } = req.body;
    const CLEANUP_SECRET = process.env.CLEANUP_SECRET || 'nailflow-demo-reset-2026';
    if (secret !== CLEANUP_SECRET) {
        return res.status(403).json({ error: 'Forbidden' });
    }
    try {
        // @ts-ignore
        const tenantId = req.tenant.id;
        await (0, db_1.query)('DELETE FROM appointments WHERE tenant_id = $1', [tenantId]);
        await (0, db_1.query)('DELETE FROM staff WHERE tenant_id = $1', [tenantId]);
        await (0, db_1.query)('DELETE FROM services WHERE tenant_id = $1', [tenantId]);
        // Reset branding to clean state
        await (0, db_1.query)(`UPDATE tenants SET branding = $1 WHERE id = $2`, [JSON.stringify({ primary_color: '#E8B4B8', secondary_color: '#82C3A6', palette_id: 'soft-rose', typography: 'Outfit' }), tenantId]);
        res.json({ success: true, message: 'All tenant data wiped successfully.' });
    }
    catch (e) {
        console.error('Cleanup failed:', e);
        res.status(500).json({ error: 'Cleanup failed' });
    }
});
// Endpoint: Get Tenant configuration
apiRouter.get('/tenant', (req, res) => {
    // @ts-ignore
    res.json(req.tenant);
});
// Endpoint: Get Tenant by Owner ID
apiRouter.get('/tenants/owner/:ownerId', async (req, res) => {
    try {
        const { ownerId } = req.params;
        const result = await (0, db_1.query)('SELECT * FROM tenants WHERE owner_id = $1', [ownerId]);
        if (result.rowCount === 0)
            return res.status(404).json({ error: 'Tenant not found' });
        res.json(result.rows[0]);
    }
    catch (e) {
        console.error('Failed to fetch tenant by owner:', e);
        res.status(500).json({ error: 'Failed to fetch tenant by owner', details: e.message });
    }
});
// Endpoint: Get Services
apiRouter.get('/services', async (req, res) => {
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
apiRouter.post('/services', async (req, res) => {
    try {
        const { name, description, duration_minutes, estimated_price, required_advance, category, image_url } = req.body;
        // @ts-ignore
        const tenantId = req.tenant.id;
        if (!name || !duration_minutes || !estimated_price) {
            return res.status(400).json({ error: 'Name, duration, and price are required' });
        }
        const id = getUUID();
        const result = await (0, db_1.query)('INSERT INTO services (id, tenant_id, name, description, duration_minutes, estimated_price, required_advance, category, image_url) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *', [id, tenantId, name, description, Number(duration_minutes), Number(estimated_price), Number(required_advance) || 0, category || 'General', image_url || '']);
        res.status(201).json(result.rows[0]);
    }
    catch (e) {
        console.error('Failed to create service:', e);
        res.status(500).json({ error: 'Failed to create service', details: e.message });
    }
});
// Endpoint: Update Service
apiRouter.put('/services/:id', async (req, res) => {
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
apiRouter.delete('/services/:id', async (req, res) => {
    // @ts-ignore
    const tenantId = req.tenant.id;
    const result = await (0, db_1.query)('DELETE FROM services WHERE id = $1 AND tenant_id = $2', [req.params.id, tenantId]);
    if (result.rowCount === 0)
        return res.status(404).json({ error: 'Service not found' });
    res.json({ success: true });
});
// Endpoint: Get Staff
apiRouter.get('/staff', async (req, res) => {
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
apiRouter.get('/appointments', async (req, res) => {
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
apiRouter.get('/appointments/:id', async (req, res) => {
    try {
        // @ts-ignore
        const tenantId = req.tenant.id;
        const result = await (0, db_1.query)('SELECT a.*, s.name as service_name FROM appointments a LEFT JOIN services s ON a.service_id = s.id WHERE a.id = $1 AND a.tenant_id = $2', [req.params.id, tenantId]);
        if (result.rowCount === 0)
            return res.status(404).json({ error: 'Appointment not found' });
        res.json(result.rows[0]);
    }
    catch (e) {
        res.status(500).json({ error: 'Failed to fetch appointment' });
    }
});
// Endpoint: Update Appointment Status
apiRouter.patch('/appointments/:id/status', async (req, res) => {
    const { status } = req.body;
    // @ts-ignore
    const tenantId = req.tenant.id;
    const validStatuses = ['pending_payment', 'confirmed', 'cancelled', 'completed'];
    if (!validStatuses.includes(status)) {
        return res.status(400).json({ error: `Status must be one of: ${validStatuses.join(', ')}` });
    }
    try {
        const result = await (0, db_1.query)('UPDATE appointments SET status = $1 WHERE id = $2 AND tenant_id = $3 RETURNING *', [status, req.params.id, tenantId]);
        if (result.rowCount === 0)
            return res.status(404).json({ error: 'Appointment not found' });
        res.json(result.rows[0]);
    }
    catch (e) {
        res.status(500).json({ error: 'Failed to update appointment' });
    }
});
// Endpoint: Update Appointment Images
apiRouter.patch('/appointments/:id/images', async (req, res) => {
    const { image_urls } = req.body;
    // @ts-ignore
    const tenantId = req.tenant.id;
    if (!Array.isArray(image_urls)) {
        return res.status(400).json({ error: 'image_urls must be an array' });
    }
    try {
        const result = await (0, db_1.query)('UPDATE appointments SET image_urls = $1 WHERE id = $2 AND tenant_id = $3 RETURNING *', [JSON.stringify(image_urls), req.params.id, tenantId]);
        if (result.rowCount === 0)
            return res.status(404).json({ error: 'Appointment not found' });
        res.json(result.rows[0]);
    }
    catch (e) {
        console.error('Failed to update appointment images:', e);
        res.status(500).json({ error: 'Failed to update appointment images' });
    }
});
// Endpoint: Get Availability
apiRouter.get('/availability', async (req, res) => {
    const { date, staff_id, service_id } = req.query;
    // @ts-ignore
    const tenantId = req.tenant.id;
    if (!date)
        return res.status(400).json({ error: 'Date is required' });
    try {
        let requestedDuration = 60; // Default fallback
        if (service_id) {
            const svcRes = await (0, db_1.query)('SELECT duration_minutes FROM services WHERE id = $1 AND tenant_id = $2', [service_id, tenantId]);
            if (svcRes.rowCount && svcRes.rowCount > 0 && svcRes.rows[0].duration_minutes > 0) {
                requestedDuration = Number(svcRes.rows[0].duration_minutes);
            }
        }
        let workingHours = { start: '09:00', end: '21:00' };
        if (staff_id) {
            const staffRes = await (0, db_1.query)(`SELECT weekly_schedule FROM staff WHERE id = $1 AND tenant_id = $2`, [staff_id, tenantId]);
            if (staffRes.rowCount && staffRes.rowCount > 0 && staffRes.rows[0].weekly_schedule) {
                const schedule = staffRes.rows[0].weekly_schedule;
                const dt = luxon_1.DateTime.fromISO(date, { zone: 'America/Mexico_City' });
                const dayName = dt.setLocale('en').toFormat('EEEE').toLowerCase(); // e.g., 'monday'
                if (schedule[dayName]) {
                    if (!schedule[dayName].active) {
                        return res.json([]); // Staff is out
                    }
                    if (schedule[dayName].start && schedule[dayName].end) {
                        workingHours = { start: schedule[dayName].start, end: schedule[dayName].end };
                    }
                }
            }
        }
        const result = await (0, db_1.query)(`SELECT datetime_start, datetime_end 
             FROM appointments 
             WHERE tenant_id = $1 AND (staff_id = $2 OR $2 IS NULL)
             AND TO_CHAR(datetime_start AT TIME ZONE 'UTC' AT TIME ZONE 'America/Mexico_City', 'YYYY-MM-DD') = $3 
             AND status IN ('confirmed', 'pending_payment')`, [tenantId, staff_id || null, date]);
        const appointments = result.rows.map(r => ({
            start: luxon_1.DateTime.fromJSDate(r.datetime_start).setZone('America/Mexico_City'),
            end: luxon_1.DateTime.fromJSDate(r.datetime_end).setZone('America/Mexico_City')
        }));
        const nowInCDMX = luxon_1.DateTime.now().setZone('America/Mexico_City');
        const bufferLimit = nowInCDMX.plus({ hours: 3 });
        const slots = [];
        const dtBase = luxon_1.DateTime.fromISO(date, { zone: 'America/Mexico_City' });
        const [startH, startM] = workingHours.start.split(':').map(Number);
        const [endH, endM] = workingHours.end.split(':').map(Number);
        const startTimeIndex = startH * 60 + startM;
        const endTimeIndex = endH * 60 + endM;
        for (let minOffset = startTimeIndex; minOffset <= endTimeIndex - requestedDuration; minOffset += 30) {
            const slotH = Math.floor(minOffset / 60);
            const slotM = minOffset % 60;
            const slotStart = dtBase.set({ hour: slotH, minute: slotM });
            const slotEnd = slotStart.plus({ minutes: requestedDuration });
            if (slotStart < bufferLimit)
                continue; // Buffer limit passed
            const hasOverlap = appointments.some(apt => slotStart < apt.end && slotEnd > apt.start);
            if (!hasOverlap) {
                slots.push({
                    time: slotStart.toFormat('HH:mm'),
                    available: true
                });
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
apiRouter.post('/bookings/test', async (req, res) => {
    const { service_id, staff_id, date, time, client_name, client_phone, client_email, notes, image_urls } = req.body;
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
        const { duration_minutes: duration, estimated_price: service_price_db } = svcRes.rows[0];
        const id = getUUID();
        // Use Mexico City timezone for datetime_start
        const datetime_start_str = `${date} ${time}:00 America/Mexico_City`;
        // Calculate end time
        const [h, m] = time.split(':').map(Number);
        const startDate = new Date(2000, 0, 1, h, m);
        const endDate = new Date(startDate.getTime() + (duration || 60) * 60000);
        const endStr = `${String(endDate.getHours()).padStart(2, '0')}:${String(endDate.getMinutes()).padStart(2, '0')}`;
        const datetime_end_str = `${date} ${endStr}:00 America/Mexico_City`;
        const result = await (0, db_1.query)('INSERT INTO appointments (id, tenant_id, service_id, staff_id, client_name, client_email, client_phone, datetime_start, datetime_end, status, payment_method, price, image_urls, image_url, notes) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15) RETURNING *', [id, tenantId, service_id, staff_id, client_name, client_email || '', client_phone, datetime_start_str, datetime_end_str, 'confirmed', 'PRUEBA', service_price_db, JSON.stringify(image_urls || []), req.body.image_url || null, notes]);
        console.log('Test booking created successfully:', result.rows[0].id);
        res.json({ appointmentId: result.rows[0].id, success: true });
    }
    catch (e) {
        console.error('Test booking failed:', e);
        res.status(500).json({ error: 'Failed to create test booking', details: e.message });
    }
});
// Endpoint: Create Booking (Initiates MercadoPago Payment)
apiRouter.post('/bookings', async (req, res) => {
    const { service_id, staff_id, date, time, client_name, client_phone, client_email, notes, image_urls, image_url } = req.body;
    // @ts-ignore
    const tenantId = req.tenant.id;
    try {
        const svcRes = await (0, db_1.query)('SELECT * FROM services WHERE id = $1', [service_id]);
        if (svcRes.rowCount === 0)
            return res.status(404).json({ error: 'Service not found' });
        const service = svcRes.rows[0];
        // Use Mexico City timezone for datetime_start
        const datetime_start_str = `${date} ${time}:00 America/Mexico_City`;
        const [h, m] = time.split(':').map(Number);
        const startDate = new Date(2000, 0, 1, h, m);
        const duration = service.duration_minutes || 60;
        const endDate = new Date(startDate.getTime() + duration * 60000);
        const endStr = `${String(endDate.getHours()).padStart(2, '0')}:${String(endDate.getMinutes()).padStart(2, '0')}`;
        const datetime_end_str = `${date} ${endStr}:00 America/Mexico_City`;
        // Determine initial status based on payment method
        const isMercadoPago = req.body.payment_method === 'mercado';
        const initialStatus = isMercadoPago ? 'pending_payment' : 'confirmed';
        // Create appointment
        const aptRes = await (0, db_1.query)(`INSERT INTO appointments 
            (id, tenant_id, client_name, client_phone, client_email, service_id, staff_id, datetime_start, datetime_end, status, notes, price, payment_method, image_urls, image_url) 
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15) RETURNING *`, [getUUID(), tenantId, client_name, client_phone, client_email, service_id, staff_id, datetime_start_str, datetime_end_str, initialStatus, notes, service.estimated_price, req.body.payment_method, JSON.stringify(image_urls || []), image_url || null]);
        const appointment = aptRes.rows[0];
        if (isMercadoPago) {
            // Create MP Preference
            const preference = new mercadopago_1.Preference(mpClient);
            const response = await preference.create({
                body: {
                    items: [{
                            id: service.id,
                            title: service.name,
                            quantity: 1,
                            unit_price: Number(service.required_advance || 0),
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
            return res.json({
                appointmentId: appointment.id,
                init_point: response.init_point
            });
        }
        // For other methods, just return the appointment ID
        res.json({
            appointmentId: appointment.id,
            success: true
        });
    }
    catch (e) {
        console.error('Booking failed:', e);
        res.status(500).json({ error: 'Booking process failed', details: e.message });
    }
});
// Endpoint: MercadoPago Webhook
apiRouter.post('/webhooks/mercadopago', async (req, res) => {
    const { type, data } = req.body;
    if (type === 'payment') {
        try {
            const paymentId = data.id;
            console.log(`Payment incoming webhook hit: ${paymentId}`);
            const payment = new mercadopago_1.Payment(mpClient);
            const paymentData = await payment.get({ id: paymentId });
            if (paymentData.status === 'approved' && paymentData.external_reference) {
                console.log(`Payment ${paymentId} approved for appointment ${paymentData.external_reference}`);
                await (0, db_1.query)(`UPDATE appointments SET status = 'confirmed', advance_paid = true WHERE id = $1`, [paymentData.external_reference]);
            }
            else {
                console.log(`Payment ${paymentId} status: ${paymentData.status}`);
            }
        }
        catch (e) {
            console.error('Webhook processing failed:', e);
        }
    }
    res.sendStatus(200);
});
// Endpoint: Update Tenant Branding
apiRouter.put('/tenant', async (req, res) => {
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
apiRouter.post('/appointments/:id/complete', async (req, res) => {
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
apiRouter.post('/staff', async (req, res) => {
    try {
        // @ts-ignore
        const tenantId = req.tenant.id;
        const { name, email, role, specialty, photo_url, slug, active, bio, color_identifier, services_offered, weekly_schedule } = req.body;
        if (!name)
            return res.status(400).json({ error: 'Name is required' });
        const id = getUUID();
        const result = await (0, db_1.query)('INSERT INTO staff (id, tenant_id, name, email, role, specialty, photo_url, slug, active, bio, color_identifier, services_offered, weekly_schedule) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING *', [
            id,
            tenantId,
            name,
            email || null,
            role || 'staff',
            specialty || null,
            photo_url || null,
            slug || name.toLowerCase().replace(/\s+/g, '-'),
            active !== false,
            bio || null,
            color_identifier || '#C97794',
            services_offered || [],
            weekly_schedule ? JSON.stringify(weekly_schedule) : JSON.stringify({})
        ]);
        res.json(result.rows[0]);
    }
    catch (e) {
        console.error('Failed to create staff member:', e);
        res.status(500).json({ error: 'Failed to create staff member', details: e.message });
    }
});
// Endpoint: Staff Management (PUT)
apiRouter.put('/staff/:id', async (req, res) => {
    try {
        const { id } = req.params;
        // @ts-ignore
        const tenantId = req.tenant.id;
        const { name, email, role, specialty, photo_url, slug, active, bio, color_identifier, services_offered, weekly_schedule } = req.body;
        // We use COALESCE to keep existing values if not provided in the update
        const result = await (0, db_1.query)(`UPDATE staff SET 
                name = COALESCE($1, name), 
                email = COALESCE($2, email), 
                role = COALESCE($3, role), 
                specialty = COALESCE($4, specialty), 
                photo_url = COALESCE($5, photo_url), 
                slug = COALESCE($6, slug), 
                active = COALESCE($7, active), 
                bio = COALESCE($8, bio), 
                color_identifier = COALESCE($9, color_identifier), 
                services_offered = COALESCE($10, services_offered), 
                weekly_schedule = COALESCE($11, weekly_schedule) 
            WHERE id = $12 AND tenant_id = $13 RETURNING *`, [
            name || null,
            email || null,
            role || null,
            specialty || null,
            photo_url || null,
            slug || null,
            active === undefined ? null : active,
            bio || null,
            color_identifier || null,
            services_offered || null,
            weekly_schedule ? JSON.stringify(weekly_schedule) : null,
            id,
            tenantId
        ]);
        if (result.rowCount === 0)
            return res.status(404).json({ error: 'Staff member not found' });
        res.json(result.rows[0]);
    }
    catch (e) {
        console.error('Failed to update staff member:', e);
        res.status(500).json({ error: 'Failed to update staff member', details: e.message });
    }
});
// Endpoint: Favorites (GET)
apiRouter.get('/favorites', async (req, res) => {
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
apiRouter.post('/favorites/:phone', async (req, res) => {
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
// Mount the router at both root and /api for maximum compatibility
app.use('/api', apiRouter);
app.use(apiRouter);
app.get('/health', (req, res) => res.send('OK'));
// 404 Handler - MUST be after apps.use(apiRouter)
app.use((req, res) => {
    console.warn(`[404] ${req.method} ${req.path} - No route matched`);
    res.status(404).json({
        error: 'Route not found',
        method: req.method,
        path: req.path
    });
});
app.listen(port, () => {
    console.log(`NailFlow API running on port ${port}`);
});
