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

// Initialize DB schema
initDb().catch(console.error);



let tenantBranding: Record<string, any> = {};

// Middleware to extract tenant from request
app.use(async (req, res, next) => {
    // Skip tenant domain resolution for webhooks
    if (req.path.startsWith('/api/webhooks')) {
        return next();
    }

    const tenantDomain = (req.headers['x-tenant-domain'] || req.query.domain) as string;
    const tenantId = (req.headers['x-tenant-id'] || req.query.id) as string;
    const ownerId = req.query.owner_id as string;

    try {
        let tenant = null;
        if (tenantId) {
            tenant = await getTenantById(tenantId);
        } else if (ownerId) {
            const res = await query('SELECT * FROM tenants WHERE owner_id = $1', [ownerId]);
            tenant = res.rows.length > 0 ? res.rows[0] : null;
        } else {
            tenant = await getTenantByDomain(tenantDomain || 'demo.diabolicalservices.tech');
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
        const result = await query('SELECT * FROM services WHERE tenant_id = $1', [tenantId]);
        res.json(result.rows);
    } catch (e) {
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

        const id = crypto.randomUUID();
        const result = await query(
            'INSERT INTO services (id, tenant_id, name, description, duration_minutes, estimated_price, required_advance, category, image_url) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *',
            [id, tenantId, name, description, Number(duration_minutes), Number(estimated_price), Number(required_advance) || 0, category || 'General', image_url || '']
        );

        res.status(201).json(result.rows[0]);
    } catch (e) {
        console.error('Failed to create service:', e);
        res.status(500).json({ error: 'Failed to create service' });
    }
});

// Endpoint: Update Service
app.put('/api/services/:id', async (req, res) => {
    try {
        const { name, duration_minutes, estimated_price, required_advance, category, image_url } = req.body;
        const result = await query(
            'UPDATE services SET name = $1, duration_minutes = $2, estimated_price = $3, required_advance = $4, category = $5, image_url = $6 WHERE id = $7 RETURNING *',
            [name, Number(duration_minutes), Number(estimated_price), Number(required_advance), category, image_url, req.params.id]
        );
        if (result.rowCount === 0) return res.status(404).json({ error: 'Service not found' });
        res.json(result.rows[0]);
    } catch (e) {
        res.status(500).json({ error: 'Failed to update service' });
    }
});

// Endpoint: Delete Service
app.delete('/api/services/:id', async (req, res) => {
    const result = await query('DELETE FROM services WHERE id = $1', [req.params.id]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'Service not found' });
    res.json({ success: true });
});

// Endpoint: Get Staff
app.get('/api/staff', async (req, res) => {
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
app.get('/api/appointments', async (req, res) => {
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
app.get('/api/appointments/:id', async (req, res) => {
    try {
        const result = await query('SELECT a.*, s.name as service_name FROM appointments a LEFT JOIN services s ON a.service_id = s.id WHERE a.id = $1', [req.params.id]);
        if (result.rowCount === 0) return res.status(404).json({ error: 'Appointment not found' });
        res.json(result.rows[0]);
    } catch (e) {
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
        const result = await query('UPDATE appointments SET status = $1 WHERE id = $2 RETURNING *', [status, req.params.id]);
        if (result.rowCount === 0) return res.status(404).json({ error: 'Appointment not found' });
        res.json(result.rows[0]);
    } catch (e) {
        res.status(500).json({ error: 'Failed to update appointment' });
    }
});

// Endpoint: Get Availability
app.get('/api/availability', async (req, res) => {
    const { date, staff_id } = req.query;
    // @ts-ignore
    const tenantId = req.tenant.id;

    if (!date) return res.status(400).json({ error: 'Date is required' });

    try {
        const result = await query(
            "SELECT TO_CHAR(datetime_start, 'HH24:MI') as time FROM appointments WHERE tenant_id = $1 AND TO_CHAR(datetime_start, 'YYYY-MM-DD') = $2 AND status IN ('confirmed', 'pending_payment')",
            [tenantId, date]
        );
        const bookedTimes = new Set(result.rows.map(r => r.time));

        const slots = [];
        for (let h = 9; h < 18; h++) {
            const time1 = `${String(h).padStart(2, '0')}:00`;
            const time2 = `${String(h).padStart(2, '0')}:30`;
            slots.push({ time: time1, available: !bookedTimes.has(time1) });
            slots.push({ time: time2, available: !bookedTimes.has(time2) });
        }
        res.json(slots);
    } catch (e) {
        res.status(500).json({ error: 'Failed to fetch availability' });
    }
});

// Endpoint: Create Booking (Initiates MercadoPago Payment)
app.post('/api/bookings', async (req, res) => {
    const { service_id, staff_id, date, time, client_name, client_phone, client_email, notes } = req.body;
    // @ts-ignore
    const tenantId = req.tenant.id;

    try {
        const svcRes = await query('SELECT * FROM services WHERE id = $1', [service_id]);
        if (svcRes.rowCount === 0) return res.status(404).json({ error: 'Service not found' });
        const service = svcRes.rows[0];

        // Create appointment in 'pending_payment' status
        const aptRes = await query(
            `INSERT INTO appointments 
            (tenant_id, client_name, client_phone, client_email, service_id, staff_id, datetime_start, status, notes) 
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
            [tenantId, client_name, client_phone, client_email, service_id, staff_id, `${date}T${time}:00Z`, 'pending_payment', notes]
        );
        const appointment = aptRes.rows[0];

        // Create MP Preference
        const preference = new Preference(mpClient);
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
    } catch (e) {
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
        } catch (e) {
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
app.post('/api/appointments/:id/complete', async (req, res) => {
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
app.post('/api/staff', async (req, res) => {
    try {
        // @ts-ignore
        const tenantId = req.tenant.id;
        const { name, email, role, specialty, photo_url } = req.body;
        const id = crypto.randomUUID();
        const result = await query(
            'INSERT INTO staff (id, tenant_id, name, email, role, specialty, photo_url) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
            [id, tenantId, name, email, role, specialty, photo_url]
        );
        res.json(result.rows[0]);
    } catch (e) {
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
        const { name, email, role, specialty, photo_url } = req.body;
        const result = await query(
            'UPDATE staff SET name = $1, email = $2, role = $3, bio = $4, photo_url = $5 WHERE id = $6 AND tenant_id = $7 RETURNING *',
            [name, email, role, specialty, photo_url, id, tenantId]
        );
        res.json(result.rows[0]);
    } catch (e) {
        res.status(500).json({ error: 'Failed to update staff member' });
    }
});

// Endpoint: Favorites (GET)
app.get('/api/favorites', async (req, res) => {
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
app.post('/api/favorites/:phone', async (req, res) => {
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

app.get('/health', (req, res) => res.send('OK'));

app.listen(port, () => {
    console.log(`NailFlow API running on http://localhost:${port}`);
});
