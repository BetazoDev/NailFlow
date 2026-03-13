import express from 'express';
import cors from 'cors';
import { getTenantByDomain, getTenantById } from './tenant';
import { db } from './lib/firebase';
import { MercadoPagoConfig, Preference } from 'mercadopago';
import { query } from './lib/db';
import { initDb } from './init-db';
import crypto from 'crypto';

// Initialize MP Client 
const mpClient = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN || 'TEST-TOKEN-MOCK' });

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

let tenantBranding: Record<string, any> = {};

// Initialize DB schema
initDb().catch(console.error);

// Helper for safe UUID generation
const getUUID = () => {
    try {
        return crypto.randomUUID();
    } catch (e) {
        return crypto.randomBytes(16).toString('hex');
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

    const tenantDomain = (req.headers['x-tenant-domain'] || req.query.domain || req.headers.host) as string;
    const tenantId = (req.headers['x-tenant-id'] || req.query.id) as string;
    const ownerId = req.query.owner_id as string;

    try {
        let tenant = null;
        if (tenantId && tenantId !== 'undefined') {
            tenant = await getTenantById(tenantId);
        } else if (ownerId) {
            const res = await query('SELECT * FROM tenants WHERE owner_id = $1', [ownerId]);
            tenant = res.rows.length > 0 ? res.rows[0] : null;
        } else {
            // Clean domain (remove port if present)
            const cleanDomain = tenantDomain?.split(':')[0] || 'demo.diabolicalservices.tech';
            tenant = await getTenantByDomain(cleanDomain);

            // Fallback for demo if still not found
            if (!tenant && (cleanDomain.includes('diabolicalservices.tech') || cleanDomain.includes('localhost'))) {
                tenant = await getTenantById('demo-tenant');
            }
        }

        if (!tenant) {
            console.warn(`Tenant not found for: ${tenantDomain || tenantId}. Falling back to demo.`);
            tenant = await getTenantById('demo-tenant');
        }

        if (!tenant) {
            return res.status(404).json({ error: 'Tenant not found' });
        }

        // @ts-ignore
        req.tenant = tenant;
        next();
    } catch (e) {
        console.error('Error resolving tenant:', e);
        res.status(500).json({ error: 'Internal server error resolving tenant' });
    }
});

// Create API Router to handle both cases (/api or direct)
const apiRouter = express.Router();

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
        await query('DELETE FROM appointments WHERE tenant_id = $1', [tenantId]);
        await query('DELETE FROM staff WHERE tenant_id = $1', [tenantId]);
        await query('DELETE FROM services WHERE tenant_id = $1', [tenantId]);
        // Reset branding to clean state
        await query(
            `UPDATE tenants SET branding = $1 WHERE id = $2`,
            [JSON.stringify({ primary_color: '#E8B4B8', secondary_color: '#82C3A6', palette_id: 'soft-rose', typography: 'Outfit' }), tenantId]
        );
        res.json({ success: true, message: 'All tenant data wiped successfully.' });
    } catch (e) {
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
        const result = await query('SELECT * FROM tenants WHERE owner_id = $1', [ownerId]);
        if (result.rowCount === 0) return res.status(404).json({ error: 'Tenant not found' });
        res.json(result.rows[0]);
    } catch (e: any) {
        console.error('Failed to fetch tenant by owner:', e);
        res.status(500).json({ error: 'Failed to fetch tenant by owner', details: e.message });
    }
});


// Endpoint: Get Services
apiRouter.get('/services', async (req, res) => {
    try {
        // @ts-ignore
        const tenantId = req.tenant.id;
        const result = await query('SELECT * FROM services WHERE tenant_id = $1', [tenantId]);
        res.json(result.rows);
    } catch (e) {
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
        const result = await query(
            'INSERT INTO services (id, tenant_id, name, description, duration_minutes, estimated_price, required_advance, category, image_url) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *',
            [id, tenantId, name, description, Number(duration_minutes), Number(estimated_price), Number(required_advance) || 0, category || 'General', image_url || '']
        );

        res.status(201).json(result.rows[0]);
    } catch (e: any) {
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
        const result = await query(
            'UPDATE services SET name = $1, description = $2, duration_minutes = $3, estimated_price = $4, required_advance = $5, category = $6, image_url = $7 WHERE id = $8 AND tenant_id = $9 RETURNING *',
            [name, description, Number(duration_minutes), Number(estimated_price), Number(required_advance), category, image_url, req.params.id, tenantId]
        );
        if (result.rowCount === 0) return res.status(404).json({ error: 'Service not found' });
        res.json(result.rows[0]);
    } catch (e) {
        console.error('Failed to update service:', e);
        res.status(500).json({ error: 'Failed to update service' });
    }
});

// Endpoint: Delete Service
apiRouter.delete('/services/:id', async (req, res) => {
    // @ts-ignore
    const tenantId = req.tenant.id;
    const result = await query('DELETE FROM services WHERE id = $1 AND tenant_id = $2', [req.params.id, tenantId]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'Service not found' });
    res.json({ success: true });
});

// Endpoint: Get Staff
apiRouter.get('/staff', async (req, res) => {
    // @ts-ignore
    const tenantId = req.tenant.id;
    try {
        const result = await query('SELECT * FROM staff WHERE tenant_id = $1 AND active = true', [tenantId]);
        res.json(result.rows);
    } catch (e) {
        console.error('Failed to fetch staff:', e);
        res.status(500).json({ error: 'Failed to fetch staff' });
    }
});

// Endpoint: Get Appointments
apiRouter.get('/appointments', async (req, res) => {
    const staffId = req.query.staff_id as string;
    // @ts-ignore
    const tenantId = req.tenant.id;
    try {
        let text = 'SELECT * FROM appointments WHERE tenant_id = $1';
        let params = [tenantId];
        if (staffId) {
            text += ' AND staff_id = $2';
            params.push(staffId);
        }
        const result = await query(text, params);
        res.json(result.rows);
    } catch (e) {
        console.error('Failed to fetch appointments:', e);
        res.status(500).json({ error: 'Failed to fetch appointments' });
    }
});

// Endpoint: Get Single Appointment
apiRouter.get('/appointments/:id', async (req, res) => {
    try {
        const result = await query('SELECT a.*, s.name as service_name FROM appointments a LEFT JOIN services s ON a.service_id = s.id WHERE a.id = $1', [req.params.id]);
        if (result.rowCount === 0) return res.status(404).json({ error: 'Appointment not found' });
        res.json(result.rows[0]);
    } catch (e) {
        res.status(500).json({ error: 'Failed to fetch appointment' });
    }
});

// Endpoint: Update Appointment Status
apiRouter.patch('/appointments/:id/status', async (req, res) => {
    const { status } = req.body;
    const validStatuses = ['pending_payment', 'confirmed', 'cancelled', 'completed'];
    if (!validStatuses.includes(status)) {
        return res.status(400).json({ error: `Status must be one of: ${validStatuses.join(', ')}` });
    }
    try {
        const result = await query('UPDATE appointments SET status = $1 WHERE id = $2 RETURNING *', [status, req.params.id]);
        if (result.rowCount === 0) return res.status(404).json({ error: 'Appointment not found' });
        res.json(result.rows[0]);
    } catch (e) {
        res.status(500).json({ error: 'Failed to update appointment' });
    }
});

// Endpoint: Update Appointment Images
apiRouter.patch('/appointments/:id/images', async (req, res) => {
    const { image_urls } = req.body;
    
    if (!Array.isArray(image_urls)) {
        return res.status(400).json({ error: 'image_urls must be an array' });
    }

    try {
        const result = await query(
            'UPDATE appointments SET image_urls = $1 WHERE id = $2 RETURNING *', 
            [JSON.stringify(image_urls), req.params.id]
        );
        if (result.rowCount === 0) return res.status(404).json({ error: 'Appointment not found' });
        res.json(result.rows[0]);
    } catch (e) {
        console.error('Failed to update appointment images:', e);
        res.status(500).json({ error: 'Failed to update appointment images' });
    }
});

// Endpoint: Get Availability
apiRouter.get('/availability', async (req, res) => {
    const { date, staff_id, service_id } = req.query;
    // @ts-ignore
    const tenantId = req.tenant.id;

    if (!date) return res.status(400).json({ error: 'Date is required' });

    try {
        // 1. Get Service Duration (Buffer logic)
        let serviceDuration = 60;
        if (service_id) {
            const svc = await query('SELECT duration_minutes FROM services WHERE id = $1', [service_id]);
            if (svc.rows.length) serviceDuration = svc.rows[0].duration_minutes;
        }

        // 2. Get Booked Appointments
        const result = await query(
            `SELECT 
                TO_CHAR(datetime_start AT TIME ZONE 'UTC' AT TIME ZONE 'America/Mexico_City', 'HH24:MI') as start_time,
                TO_CHAR(datetime_end AT TIME ZONE 'UTC' AT TIME ZONE 'America/Mexico_City', 'HH24:MI') as end_time
             FROM appointments 
             WHERE tenant_id = $1 
             AND TO_CHAR(datetime_start AT TIME ZONE 'UTC' AT TIME ZONE 'America/Mexico_City', 'YYYY-MM-DD') = $2 
             AND status IN ('confirmed', 'pending_payment')
             ORDER BY datetime_start ASC`,
            [tenantId, date]
        );
        const appointments = result.rows;

        // 3. Get Active Holds (Concurracy)
        // Cleanup expired holds first
        await query("DELETE FROM slot_holds WHERE expires_at < CURRENT_TIMESTAMP");
        const holdResult = await query(
            "SELECT range_time FROM slot_holds WHERE tenant_id = $1 AND range_date = $2",
            [tenantId, date]
        );
        const heldTimes = new Set(holdResult.rows.map(r => r.range_time));

        // 4. Get "Now" in Mexico City
        const nowInCDMX = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Mexico_City' }));
        const bufferLimit = new Date(nowInCDMX.getTime() + 1 * 60 * 60 * 1000); // Allow booking 1 hour in advance

        const requestedDate = date as string;
        const slots = [];

        // 5. Generate Dynamic Slots
        // Logic: Try 10-minute intervals from 9:00 to 20:00
        for (let h = 9; h < 21; h++) {
            for (let min = 0; min < 60; min += 10) {
                const time = `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
                
                const [year, month, day] = requestedDate.split('-').map(Number);
                const slotStart = new Date(year, month - 1, day, h, min);
                const slotEnd = new Date(slotStart.getTime() + serviceDuration * 60000);

                if (slotStart < bufferLimit) continue;
                if (heldTimes.has(time)) continue;

                // Check for appointment overlap
                let isOverlap = false;
                for (const apt of appointments) {
                    const [ah_s, am_s] = apt.start_time.split(':').map(Number);
                    const [ah_e, am_e] = apt.end_time.split(':').map(Number);
                    
                    const aptStart = new Date(year, month - 1, day, ah_s, am_s);
                    const aptEnd = new Date(year, month - 1, day, ah_e, am_e);

                    // User Rule: End time of A + 10 mins <= Start time of B
                    // So we must ensure our Slot Start is AFTER Apt End + 10 mins OR Slot End is BEFORE Apt Start - 10 mins
                    const bufferedAptEnd = new Date(aptEnd.getTime() + 10 * 60000);
                    const bufferedAptStart = new Date(aptStart.getTime() - 10 * 60000);

                    // Overlap if (slotStart < bufferedAptEnd) AND (slotEnd > bufferedAptStart)
                    if (slotStart < bufferedAptEnd && slotEnd > bufferedAptStart) {
                        isOverlap = true;
                        break;
                    }
                }

                if (!isOverlap) {
                    slots.push({ time, available: true });
                }
            }
        }
        res.json(slots);
    } catch (e) {
        console.error('Failed to fetch availability:', e);
        res.status(500).json({ error: 'Failed to fetch availability' });
    }
});

// Endpoint: Hold Slot
apiRouter.post('/availability/hold', async (req, res) => {
    const { date, time, staff_id, hold_id } = req.body;
    // @ts-ignore
    const tenantId = req.tenant.id;

    if (!date || !time || !hold_id) return res.status(400).json({ error: 'Missing hold details' });

    try {
        await query(
            "INSERT INTO slot_holds (id, tenant_id, staff_id, range_date, range_time, hold_id) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT DO NOTHING",
            [getUUID(), tenantId, staff_id || 'general', date, time, hold_id]
        );
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: 'Failed to hold slot' });
    }
});

// Endpoint: Release Slot
apiRouter.post('/availability/release', async (req, res) => {
    const { date, time, hold_id } = req.body;
    // @ts-ignore
    const tenantId = req.tenant.id;

    try {
        await query(
            "DELETE FROM slot_holds WHERE tenant_id = $1 AND range_date = $2 AND range_time = $3 AND hold_id = $4",
            [tenantId, date, time, hold_id]
        );
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: 'Failed to release slot' });
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
        const svcRes = await query('SELECT duration_minutes, estimated_price FROM services WHERE id = $1', [service_id]);
        if (svcRes.rowCount === 0) return res.status(404).json({ error: 'Service not found' });
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

        const result = await query(
            'INSERT INTO appointments (id, tenant_id, service_id, staff_id, client_name, client_email, client_phone, datetime_start, datetime_end, status, payment_method, price, image_urls, image_url, notes) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15) RETURNING *',
            [id, tenantId, service_id, staff_id, client_name, client_email || '', client_phone, datetime_start_str, datetime_end_str, 'confirmed', 'PRUEBA', service_price_db, JSON.stringify(image_urls || []), req.body.image_url || null, notes]
        );
        console.log('Test booking created successfully:', result.rows[0].id);
        res.json({ appointmentId: result.rows[0].id, success: true });
    } catch (e: any) {
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
        const svcRes = await query('SELECT * FROM services WHERE id = $1', [service_id]);
        if (svcRes.rowCount === 0) return res.status(404).json({ error: 'Service not found' });
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
        const aptRes = await query(
            `INSERT INTO appointments 
            (id, tenant_id, client_name, client_phone, client_email, service_id, staff_id, datetime_start, datetime_end, status, notes, price, payment_method, image_urls, image_url) 
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15) RETURNING *`,
            [getUUID(), tenantId, client_name, client_phone, client_email, service_id, staff_id, datetime_start_str, datetime_end_str, initialStatus, notes, service.estimated_price, req.body.payment_method, JSON.stringify(image_urls || []), image_url || null]
        );
        const appointment = aptRes.rows[0];

        if (isMercadoPago) {
            // Create MP Preference
            const preference = new Preference(mpClient);
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
    } catch (e: any) {
        console.error('Booking failed:', e);
        res.status(500).json({ error: 'Booking process failed', details: e.message });
    }
});

// Endpoint: MercadoPago Webhook
apiRouter.post('/webhooks/mercadopago', async (req, res) => {
    const { type, data } = req.body;

    if (type === 'payment') {
        try {
            // Usually we'd fetch details from MP with data.id here.
            // For now, let's just mark the reference as paid if we can find it.
            // External reference was appointment.id
            const paymentId = data.id;

            // Note: In real scenarios, MP sends a notification, then you GET the payment to see external_reference
            console.log(`Payment incoming: ${paymentId}`);
        } catch (e) {
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
        const result = await query(
            'UPDATE tenants SET name = COALESCE($1, name), branding = COALESCE($2, branding), settings = COALESCE($3, settings) WHERE id = $4 RETURNING *',
            [name, branding, settings, tenantId]
        );
        res.json(result.rows[0]);
    } catch (e) {
        res.status(500).json({ error: 'Failed to update tenant' });
    }
});

// Endpoint: Complete Appointment
apiRouter.post('/appointments/:id/complete', async (req, res) => {
    try {
        const { id } = req.params;
        // @ts-ignore
        const tenantId = req.tenant.id;
        await query(
            "UPDATE appointments SET status = 'completed' WHERE id = $1 AND tenant_id = $2",
            [id, tenantId]
        );
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: 'Failed to complete appointment' });
    }
});

// Endpoint: Staff Management (POST)
apiRouter.post('/staff', async (req, res) => {
    try {
        // @ts-ignore
        const tenantId = req.tenant.id;
        const { name, email, role, specialty, photo_url, slug, active, bio, color_identifier, services_offered, weekly_schedule } = req.body;

        if (!name) return res.status(400).json({ error: 'Name is required' });

        const id = getUUID();
        const result = await query(
            'INSERT INTO staff (id, tenant_id, name, email, role, specialty, photo_url, slug, active, bio, color_identifier, services_offered, weekly_schedule) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING *',
            [
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
            ]
        );
        res.json(result.rows[0]);
    } catch (e: any) {
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
        const result = await query(
            `UPDATE staff SET 
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
            WHERE id = $12 AND tenant_id = $13 RETURNING *`,
            [
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
            ]
        );

        if (result.rowCount === 0) return res.status(404).json({ error: 'Staff member not found' });
        res.json(result.rows[0]);
    } catch (e: any) {
        console.error('Failed to update staff member:', e);
        res.status(500).json({ error: 'Failed to update staff member', details: e.message });
    }
});

// Endpoint: Favorites (GET)
apiRouter.get('/favorites', async (req, res) => {
    try {
        // @ts-ignore
        const tenantId = req.tenant.id;
        const result = await query('SELECT client_phone FROM client_favorites WHERE tenant_id = $1', [tenantId]);
        res.json(result.rows.map(r => r.client_phone));
    } catch (e) {
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
            await query(
                'INSERT INTO client_favorites (tenant_id, client_phone) VALUES ($1, $2) ON CONFLICT DO NOTHING',
                [tenantId, phone]
            );
        } else {
            await query(
                'DELETE FROM client_favorites WHERE tenant_id = $1 AND client_phone = $2',
                [tenantId, phone]
            );
        }
        res.json({ success: true });
    } catch (e) {
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
