import express from 'express';
import cors from 'cors';
import { getTenantByDomain, getTenantById } from './tenant';
import { db, auth } from './lib/firebase';
import { MercadoPagoConfig, Preference, Payment } from 'mercadopago';
import { query } from './lib/db';
import { DateTime } from 'luxon';
import { initDb } from './init-db';
import crypto from 'crypto';
import cron from 'node-cron';

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

const triggerN8nWebhook = async (tenantId: string, event: string, data: any) => {
    // URL should ideally come from tenant settings in DB
    const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL;
    if (!N8N_WEBHOOK_URL) return;

    try {
        await fetch(N8N_WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                tenant_id: tenantId,
                event,
                ...data,
                timestamp: new Date().toISOString()
            })
        });
        console.log(`[n8n] Event ${event} triggered for tenant ${tenantId}`);
    } catch (e) {
        console.error('[n8n] Webhook failed:', e);
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

// ─── Image Proxy (Security: API key never exposed to browser) ────────────────
// Route: GET /api/img/:slug/:...filename
// The client uses clean URLs like /api/img/nailssalon/photo.jpg
// The server adds the CDN API key before fetching and pipes the response back.
app.get('/api/img/:slug/*', async (req, res) => {
    const slug = req.params.slug;
    const filename = (req.params as any)[0]; // everything after :slug/

    const CDN_TOKEN = process.env.CDN_UPLOAD_TOKEN
        || process.env.NEXT_PUBLIC_CDN_UPLOAD_TOKEN
        || 'dmm_7tpONlAMTNtIMLjpr4gMSNqw9LGbgX6X';

    const cdnUrl = `https://cdn.diabolicalservices.tech/${slug}/${filename}?api_key=${CDN_TOKEN}`;

    try {
        const cdnRes = await fetch(cdnUrl);
        if (!cdnRes.ok) {
            return res.status(cdnRes.status).json({ error: 'Image not found on CDN' });
        }

        // Pipe content-type and cache headers
        const contentType = cdnRes.headers.get('content-type') || 'image/jpeg';
        res.setHeader('Content-Type', contentType);
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        // Security: no API key in any response header
        res.setHeader('X-Content-Type-Options', 'nosniff');

        const buffer = await cdnRes.arrayBuffer();
        res.send(Buffer.from(buffer));
    } catch (e: any) {
        console.error('[Image Proxy] Error:', e.message);
        res.status(502).json({ error: 'Failed to fetch image from CDN' });
    }
});

// Create API Router to handle both cases (/api or direct)
const apiRouter = express.Router();

// Auth Middleware
const requireAuth = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    // In test mode without token or for local dev without enforcing
    // Note: To secure production fully, you would want to remove this bypass
    if (process.env.NODE_ENV === 'test') return next();

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized. Missing or invalid Authorization header.' });
    }

    const token = authHeader.split('Bearer ')[1];
    try {
        const decodedToken = await auth.verifyIdToken(token);
        // @ts-ignore
        req.user = decodedToken;
        next();
    } catch (e: any) {
        console.error('JWT Verification failed:', e.message);
        return res.status(401).json({ error: 'Unauthorized. Invalid token.' });
    }
};

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
apiRouter.post('/services', requireAuth, async (req, res) => {
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
apiRouter.put('/services/:id', requireAuth, async (req, res) => {
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
apiRouter.delete('/services/:id', requireAuth, async (req, res) => {
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

// Endpoint: Get Appointments (Protected)
apiRouter.get('/appointments', requireAuth, async (req, res) => {
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

// Endpoint: Get Single Appointment (Protected)
apiRouter.get('/appointments/:id', requireAuth, async (req, res) => {
    try {
        // @ts-ignore
        const tenantId = req.tenant.id;
        const result = await query('SELECT a.*, s.name as service_name FROM appointments a LEFT JOIN services s ON a.service_id = s.id WHERE a.id = $1 AND a.tenant_id = $2', [req.params.id, tenantId]);
        if (result.rowCount === 0) return res.status(404).json({ error: 'Appointment not found' });
        res.json(result.rows[0]);
    } catch (e) {
        res.status(500).json({ error: 'Failed to fetch appointment' });
    }
});

// Endpoint: Update Appointment Status (Protected)
apiRouter.patch('/appointments/:id/status', requireAuth, async (req, res) => {
    const { status } = req.body;
    // @ts-ignore
    const tenantId = req.tenant.id;
    const validStatuses = ['pending_payment', 'confirmed', 'cancelled', 'completed'];
    if (!validStatuses.includes(status)) {
        return res.status(400).json({ error: `Status must be one of: ${validStatuses.join(', ')}` });
    }
    try {
        const result = await query('UPDATE appointments SET status = $1 WHERE id = $2 AND tenant_id = $3 RETURNING *', [status, req.params.id, tenantId]);
        if (result.rowCount === 0) return res.status(404).json({ error: 'Appointment not found' });
        res.json(result.rows[0]);
    } catch (e) {
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
        const result = await query(
            'UPDATE appointments SET image_urls = $1 WHERE id = $2 AND tenant_id = $3 RETURNING *', 
            [JSON.stringify(image_urls), req.params.id, tenantId]
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
        let requestedDuration = 60; // Default fallback

        if (service_id) {
            const svcRes = await query('SELECT duration_minutes FROM services WHERE id = $1 AND tenant_id = $2', [service_id, tenantId]);
            if (svcRes.rowCount && svcRes.rowCount > 0 && svcRes.rows[0].duration_minutes > 0) {
                requestedDuration = Number(svcRes.rows[0].duration_minutes);
            }
        }
        
        let workingHours = { start: '09:00', end: '21:00' };

        if (staff_id) {
            const staffRes = await query(`SELECT weekly_schedule FROM staff WHERE id = $1 AND tenant_id = $2`, [staff_id, tenantId]);
            if (staffRes.rowCount && staffRes.rowCount > 0 && staffRes.rows[0].weekly_schedule) {
                const schedule = staffRes.rows[0].weekly_schedule;
                const dt = DateTime.fromISO(date as string, { zone: 'America/Mexico_City' });
                const dayIndex = dt.weekday % 7; // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
                const dayName = dt.setLocale('en').toFormat('EEEE').toLowerCase(); // e.g., 'monday'
                
                let daySchedule = null;
                
                // Handle both object-based and array-based schedules
                if (Array.isArray(schedule)) {
                    daySchedule = schedule.find((s: any) => 
                        s.day_of_week === dayIndex || 
                        s.day === dayIndex || 
                        s.dayName?.toLowerCase() === dayName
                    );
                    // Map array format to our internal structure
                    if (daySchedule) {
                        daySchedule = {
                            active: daySchedule.active !== false,
                            start: daySchedule.start_time || daySchedule.start || '09:00',
                            end: daySchedule.end_time || daySchedule.end || '18:00'
                        };
                    }
                } else if (schedule[dayName]) {
                    daySchedule = schedule[dayName];
                }

                if (daySchedule) {
                    if (!daySchedule.active) {
                        return res.json([]); // Staff is out
                    }
                    if (daySchedule.start && daySchedule.end) {
                        workingHours = { start: daySchedule.start, end: daySchedule.end };
                    }
                }
            }
        }

        const result = await query(
            `SELECT datetime_start, datetime_end 
             FROM appointments 
             WHERE tenant_id = $1 AND (staff_id = $2 OR $2 IS NULL)
             AND TO_CHAR(datetime_start AT TIME ZONE 'UTC' AT TIME ZONE 'America/Mexico_City', 'YYYY-MM-DD') = $3 
             AND status IN ('confirmed', 'pending_payment')`,
            [tenantId, staff_id || null, date]
        );

        const appointments = result.rows.map(r => ({
            start: DateTime.fromJSDate(r.datetime_start).setZone('America/Mexico_City'),
            end: DateTime.fromJSDate(r.datetime_end).setZone('America/Mexico_City')
        }));

        // Fetch active locks
        const locksRes = await query(
            `SELECT slot_time FROM slot_locks 
             WHERE tenant_id = $1 AND staff_id = $2 AND expires_at > NOW()`,
            [tenantId, staff_id]
        );
        const activeLocks = locksRes.rows.map(r => DateTime.fromJSDate(r.slot_time).setZone('America/Mexico_City'));

        const nowInCDMX = DateTime.now().setZone('America/Mexico_City');
        const bufferLimit = nowInCDMX.plus({ days: 7 });

        const slots = [];
        const dtBase = DateTime.fromISO(date as string, { zone: 'America/Mexico_City' });
        
        const [startH, startM] = workingHours.start.split(':').map(Number);
        const [endH, endM] = workingHours.end.split(':').map(Number);
        const startTimeIndex = startH * 60 + startM;
        const endTimeIndex = endH * 60 + endM;

        for (let minOffset = startTimeIndex; minOffset <= endTimeIndex - requestedDuration; minOffset += 30) {
            const slotH = Math.floor(minOffset / 60);
            const slotM = minOffset % 60;
            
            const slotStart = dtBase.set({ hour: slotH, minute: slotM });
            const slotEnd = slotStart.plus({ minutes: requestedDuration });

            if (slotStart < bufferLimit) continue; // Buffer limit passed

            const hasOverlap = appointments.some(apt => slotStart < apt.end && slotEnd > apt.start);
            const isLocked = activeLocks.some(l => l.hasSame(slotStart, 'minute'));

            if (!hasOverlap && !isLocked) {
                slots.push({
                    time: slotStart.toFormat('HH:mm'),
                    available: true
                });
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
    const { date, time, staff_id } = req.body;
    // @ts-ignore
    const tenantId = req.tenant.id;

    if (!date || !time || !staff_id) return res.status(400).json({ error: 'Date, time, and staff_id are required' });

    try {
        const slot_time = DateTime.fromISO(`${date}T${time}:00`, { zone: 'America/Mexico_City' }).toJSDate();
        const expires_at = DateTime.now().plus({ minutes: 10 }).toJSDate();

        await query(
            `INSERT INTO slot_locks (tenant_id, staff_id, slot_time, expires_at) 
             VALUES ($1, $2, $3, $4) 
             ON CONFLICT (tenant_id, staff_id, slot_time) DO UPDATE SET expires_at = EXCLUDED.expires_at`,
            [tenantId, staff_id, slot_time, expires_at]
        );
        res.json({ success: true });
    } catch (e) {
        console.error('Failed to hold slot:', e);
        res.status(500).json({ error: 'Failed to hold slot' });
    }
});

// Endpoint: Release Slot
apiRouter.delete('/availability/hold', async (req, res) => {
    const { date, time, staff_id } = req.query;
    // @ts-ignore
    const tenantId = req.tenant.id;

    if (!date || !time || !staff_id) return res.status(400).json({ error: 'Date, time, and staff_id are required' });

    try {
        const slot_time = DateTime.fromISO(`${date}T${time}:00`, { zone: 'America/Mexico_City' }).toJSDate();
        await query(
            'DELETE FROM slot_locks WHERE tenant_id = $1 AND staff_id = $2 AND slot_time = $3',
            [tenantId, staff_id, slot_time]
        );
        res.json({ success: true });
    } catch (e) {
        console.error('Failed to release slot:', e);
        res.status(500).json({ error: 'Failed to release slot' });
    }
});

// Endpoint: Create Booking (Test/PRUEBA mode — no payment gateway)
apiRouter.post('/bookings/test', async (req, res) => {
    const { service_id, staff_id, date, time, client_name, client_phone, client_email, notes, image_urls } = req.body;
    // @ts-ignore
    const tenantId = req.tenant.id;

    console.log('Received test booking request:', { tenantId, client_name, date, time });

    if (!client_name || !date || !time || !client_phone) {
        return res.status(400).json({ error: 'client_name, date, time, and client_phone are required' });
    }

    const phoneRegex = /^\+?[1-9]\d{1,14}$/;
    if (!phoneRegex.test(client_phone)) {
        return res.status(400).json({ error: 'Invalid phone number format. Use international format (e.g. +521234567890)' });
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

    if (!client_name || !date || !time || !client_phone) {
        return res.status(400).json({ error: 'client_name, date, time, and client_phone are required' });
    }

    const phoneRegex = /^\+?[1-9]\d{1,14}$/;
    if (!phoneRegex.test(client_phone)) {
        return res.status(400).json({ error: 'Invalid phone number format. Use international format (e.g. +521234567890)' });
    }

    try {
        const svcRes = await query('SELECT * FROM services WHERE id = $1', [service_id]);
        if (svcRes.rowCount === 0) return res.status(404).json({ error: 'Service not found' });
        const service = svcRes.rows[0];

        // Use Luxon for robust datetime handling
        const start = DateTime.fromISO(`${date}T${time}`, { zone: 'America/Mexico_City' });
        const duration = Number(service.duration_minutes || 60);
        const end = start.plus({ minutes: duration });

        const datetime_start_str = start.toISO();
        const datetime_end_str = end.toISO();

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
            const advanceAmount = Number(service.required_advance || 0);
            
            // Mercado Pago requires a positive amount
            if (advanceAmount <= 0) {
                console.log('Skipping MP Preference: Advance amount is 0');
                return res.json({
                    appointmentId: appointment.id,
                    success: true,
                    message: 'Confirmed without payment (No advance required)'
                });
            }

            // Create MP Preference
            const preference = new Preference(mpClient);
            const response = await preference.create({
                body: {
                    items: [{
                        id: service.id,
                        title: service.name,
                        quantity: 1,
                        unit_price: advanceAmount,
                        currency_id: 'MXN'
                    }],
                    external_reference: appointment.id.toString(),
                    notification_url: `${process.env.APP_BASE_URL || 'https://api.diabolicalservices.tech'}/api/webhooks/mercadopago`,
                    back_urls: {
                        success: `${req.headers.origin || 'https://' + req.headers.host}/book/success`,
                        failure: `${req.headers.origin || 'https://' + req.headers.host}/book/error`,
                    },
                    auto_return: 'approved',
                }
            });

            await triggerN8nWebhook(tenantId, 'booking.initiated', {
                appointment_id: appointment.id,
                client_name,
                client_phone,
                service_id,
                amount: advanceAmount
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
    const { type, data, action } = req.body;
    
    // Support both 'type=payment' and 'action=payment.created/updated'
    const isPayment = type === 'payment' || action?.startsWith('payment.');

    if (isPayment) {
        try {
            const paymentId = data?.id || req.body.resource?.split('/').pop();
            if (!paymentId) return res.sendStatus(400);

            console.log(`[MP Webhook] Processing payment: ${paymentId}`);

            const payment = new Payment(mpClient);
            const paymentData = await payment.get({ id: paymentId });
            
            const appointmentId = paymentData.external_reference;
            const status = paymentData.status;

            console.log(`[MP Webhook] Payment ${paymentId} status: ${status} for Appointment ${appointmentId}`);

            if (status === 'approved' && appointmentId) {
                const updateRes = await query(
                    `UPDATE appointments SET status = 'confirmed', advance_paid = true, payment_ref = $2 WHERE id = $1 RETURNING id`,
                    [appointmentId, paymentId]
                );
                
                if (updateRes.rowCount === 0) {
                    console.warn(`[MP Webhook] Appointment ${appointmentId} not found in database.`);
                } else {
                    console.log(`[MP Webhook] Success: Appointment ${appointmentId} confirmed.`);
                    // Get tenant info to trigger specific webhook
                    const apptRes = await query('SELECT tenant_id, client_name, client_phone FROM appointments WHERE id = $1', [appointmentId]);
                    if (apptRes && apptRes.rows && apptRes.rows.length > 0) {
                        const { tenant_id, client_name, client_phone } = apptRes.rows[0];
                        await triggerN8nWebhook(tenant_id, 'booking.paid', {
                            appointment_id: appointmentId,
                            client_name,
                            client_phone,
                            payment_id: paymentId
                        });
                    }
                }
            }
        } catch (e: any) {
            console.error('[MP Webhook] Processing failed:', e.message);
        }
    }
    res.sendStatus(200);
});

// Endpoint: Admin Update Tenant Branding
apiRouter.put('/tenant', requireAuth, async (req, res) => {
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

// Endpoint: Complete Booking Server Action (From UI logic when advancing status to paid)
apiRouter.post('/appointments/:id/complete', requireAuth, async (req, res) => {
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
apiRouter.post('/staff', requireAuth, async (req, res) => {
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
apiRouter.put('/staff/:id', requireAuth, async (req, res) => {
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

// ─── Daily Reference Image Cleanup (Spec § 10) ───────────────────────────────
// Runs every day at 02:00 AM UTC.
// Deletes reference image columns from appointments older than 14 days.
cron.schedule('0 2 * * *', async () => {
    console.log('[Cron] Starting 14-day reference image cleanup...');
    try {
        const cutoffDate = DateTime.now().minus({ days: 14 }).toISO();

        // Fetch appointments older than 14 days that still have image data
        const staleRes = await query(
            `SELECT id, image_urls FROM appointments
             WHERE created_at < $1
               AND image_urls IS NOT NULL
               AND jsonb_array_length(COALESCE(image_urls, '[]'::jsonb)) > 0`,
            [cutoffDate]
        );

        if (!staleRes || staleRes.rows.length === 0) {
            console.log('[Cron] No stale images found.');
            return;
        }

        console.log(`[Cron] Found ${staleRes.rows.length} appointments with stale images.`);

        const CDN_DELETE_TOKEN = process.env.CDN_UPLOAD_TOKEN || process.env.NEXT_PUBLIC_CDN_UPLOAD_TOKEN;

        for (const row of staleRes.rows) {
            // Attempt to call CDN delete for each URL (best effort)
            if (CDN_DELETE_TOKEN && Array.isArray(row.image_urls)) {
                for (const url of row.image_urls) {
                    try {
                        // Extract filename from URL
                        const filename = url.split('/').pop()?.split('?')[0];
                        if (filename) {
                            await fetch(`https://api.diabolicalservices.tech/api/images/${filename}`, {
                                method: 'DELETE',
                                headers: { 'Authorization': `Bearer ${CDN_DELETE_TOKEN}` }
                            });
                        }
                    } catch (e) {
                        console.warn(`[Cron] Failed to delete CDN image: ${url}`, e);
                    }
                }
            }

            // Clear image references in the database regardless
            await query(
                `UPDATE appointments SET image_urls = null, image_url = null WHERE id = $1`,
                [row.id]
            );
        }

        console.log(`[Cron] Cleanup complete. Processed ${staleRes.rows.length} appointments.`);
    } catch (e) {
        console.error('[Cron] Cleanup failed:', e);
    }
});

app.listen(port, () => {
    console.log(`NailFlow API running on port ${port}`);
});
