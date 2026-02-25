import express from 'express';
import cors from 'cors';
import { getTenantByDomain } from './tenant';
import { DEMO_SERVICES, DEMO_AVAILABILITY, DEMO_APPOINTMENTS } from './mock-data';

const app = express();
const port = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

// Middleware to extract tenant from request (simulating the Next.js middleware)
// In a real app, the client would send an 'x-tenant-domain' header or we would extract from origin
app.use((req, res, next) => {
    const tenantDomain = req.headers['x-tenant-domain'] as string || 'demo.nailflow.com';
    const tenant = getTenantByDomain(tenantDomain);

    if (!tenant) {
        return res.status(404).json({ error: 'Tenant not found' });
    }

    // @ts-ignore - Injecting tenant into request block for convenience
    req.tenant = tenant;
    next();
});

// Endpoint: Get Tenant configuration
app.get('/api/tenant', (req, res) => {
    // @ts-ignore
    res.json(req.tenant);
});

// Endpoint: Get Services
app.get('/api/services', (req, res) => {
    // @ts-ignore
    const tenantId = req.tenant.id;
    // In actual implementation, we'd filter services by tenantId
    res.json(DEMO_SERVICES);
});

// Endpoint: Get Appointments
app.get('/api/appointments', (req, res) => {
    // @ts-ignore
    const tenantId = req.tenant.id;
    res.json(DEMO_APPOINTMENTS);
});

// Endpoint: Get Availability
app.get('/api/availability', (req, res) => {
    const dateStr = req.query.date as string;
    // @ts-ignore
    const tenantId = req.tenant.id;

    if (!dateStr) {
        return res.status(400).json({ error: 'Date parameter is required' });
    }

    try {
        const date = new Date(dateStr);
        const dayOfWeek = date.getDay();

        // Return mock availability (always the same for demo purposes regardless of exact date, but depends on day of week)
        const availability = DEMO_AVAILABILITY.find(a => a.day_of_week === dayOfWeek) || null;

        res.json(availability);
    } catch (e) {
        res.status(400).json({ error: 'Invalid date format' });
    }
});

// Endpoint: Create Booking
app.post('/api/booking', (req, res) => {
    const bookingData = req.body;
    // @ts-ignore
    const tenantId = req.tenant.id;

    // Basic validation
    if (!bookingData.serviceId || !bookingData.date || !bookingData.time) {
        return res.status(400).json({ error: 'Missing required booking data' });
    }

    // In a real implementation:
    // 1. Double check availability to prevent overbooking
    // 2. Save appointment to Firestore with status 'pending'
    // 3. Initiate Mercado Pago payment intent
    // 4. Return the payment link / preference ID

    res.json({
        success: true,
        appointmentId: `apt_${Math.random().toString(36).substring(2, 9)}`,
        status: 'pending_payment',
        message: 'Booking initialized. Waiting for payment.'
    });
});

app.listen(port, () => {
    console.log(`NailFlow API running on http://localhost:${port}`);
});
