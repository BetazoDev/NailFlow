import { Tenant, Service, Availability, Appointment } from './types';

// ============================================
// Mock Tenant
// ============================================
export const DEMO_TENANT: Tenant = {
    id: 'demo-tenant',
    name: 'Bella Nails Studio',
    domain: 'localhost',
    logo_url: '/logo.svg',
    primary_color: '#E8A0B4',
    secondary_color: '#E8B4A0',
    accent_color: '#FF6F61',
    owner_name: 'María García',
    phone: '+52 55 1234 5678',
    currency: 'MXN',
};

// ============================================
// Mock Services
// ============================================
export const DEMO_SERVICES: Service[] = [
    {
        id: 'svc-1',
        tenant_id: 'demo-tenant',
        name: 'Manicura Clásica',
        description: 'Limpieza, limado, cutículas y esmaltado tradicional',
        category: 'Manicura',
        duration_minutes: 45,
        estimated_price: 250,
        required_advance: 100,
        active: true,
    },
    {
        id: 'svc-2',
        tenant_id: 'demo-tenant',
        name: 'Uñas Acrílicas',
        description: 'Aplicación completa de uñas acrílicas con diseño',
        category: 'Acrílicas',
        duration_minutes: 120,
        estimated_price: 650,
        required_advance: 200,
        active: true,
    },
    {
        id: 'svc-3',
        tenant_id: 'demo-tenant',
        name: 'Gel Polish',
        description: 'Esmaltado semipermanente con base y top coat',
        category: 'Gel',
        duration_minutes: 60,
        estimated_price: 350,
        required_advance: 150,
        active: true,
    },
    {
        id: 'svc-4',
        tenant_id: 'demo-tenant',
        name: 'Nail Art Premium',
        description: 'Diseño personalizado con decoraciones y piedras',
        category: 'Diseño',
        duration_minutes: 90,
        estimated_price: 500,
        required_advance: 200,
        active: true,
    },
    {
        id: 'svc-5',
        tenant_id: 'demo-tenant',
        name: 'Pedicura Spa',
        description: 'Pedicura completa con exfoliación y masaje',
        category: 'Pedicura',
        duration_minutes: 75,
        estimated_price: 400,
        required_advance: 150,
        active: true,
    },
];

// ============================================
// Mock Availability
// ============================================
export const DEMO_AVAILABILITY: Availability[] = [
    { id: 'av-1', tenant_id: 'demo-tenant', day_of_week: 1, start_time: '09:00', end_time: '18:00', is_active: true },
    { id: 'av-2', tenant_id: 'demo-tenant', day_of_week: 2, start_time: '09:00', end_time: '18:00', is_active: true },
    { id: 'av-3', tenant_id: 'demo-tenant', day_of_week: 3, start_time: '09:00', end_time: '18:00', is_active: true },
    { id: 'av-4', tenant_id: 'demo-tenant', day_of_week: 4, start_time: '09:00', end_time: '18:00', is_active: true },
    { id: 'av-5', tenant_id: 'demo-tenant', day_of_week: 5, start_time: '09:00', end_time: '17:00', is_active: true },
    { id: 'av-6', tenant_id: 'demo-tenant', day_of_week: 6, start_time: '10:00', end_time: '15:00', is_active: true },
    { id: 'av-7', tenant_id: 'demo-tenant', day_of_week: 0, start_time: '00:00', end_time: '00:00', is_active: false },
];

// ============================================
// Mock Appointments
// ============================================
const today = new Date();
const todayStr = today.toISOString().split('T')[0];

export const DEMO_APPOINTMENTS: Appointment[] = [
    {
        id: 'apt-1',
        tenant_id: 'demo-tenant',
        client_name: 'Sofía Martínez',
        client_phone: '+52 55 9876 5432',
        service_id: 'svc-2',
        service_name: 'Uñas Acrílicas',
        datetime_start: `${todayStr}T09:00:00`,
        datetime_end: `${todayStr}T11:00:00`,
        status: 'confirmed',
        advance_paid: 200,
        total_price: 650,
        created_at: new Date(today.getTime() - 86400000 * 2).toISOString(),
    },
    {
        id: 'apt-2',
        tenant_id: 'demo-tenant',
        client_name: 'Valentina López',
        client_phone: '+52 55 5555 1234',
        service_id: 'svc-3',
        service_name: 'Gel Polish',
        datetime_start: `${todayStr}T11:30:00`,
        datetime_end: `${todayStr}T12:30:00`,
        status: 'confirmed',
        advance_paid: 150,
        total_price: 350,
        created_at: new Date(today.getTime() - 86400000).toISOString(),
    },
    {
        id: 'apt-3',
        tenant_id: 'demo-tenant',
        client_name: 'Camila Rodríguez',
        client_phone: '+52 55 4444 5678',
        service_id: 'svc-4',
        service_name: 'Nail Art Premium',
        datetime_start: `${todayStr}T14:00:00`,
        datetime_end: `${todayStr}T15:30:00`,
        status: 'pending',
        advance_paid: 200,
        total_price: 500,
        created_at: new Date(today.getTime() - 86400000 * 3).toISOString(),
    },
    {
        id: 'apt-4',
        tenant_id: 'demo-tenant',
        client_name: 'Isabella Hernández',
        client_phone: '+52 55 3333 9012',
        service_id: 'svc-1',
        service_name: 'Manicura Clásica',
        datetime_start: `${todayStr}T16:00:00`,
        datetime_end: `${todayStr}T16:45:00`,
        status: 'confirmed',
        advance_paid: 100,
        total_price: 250,
        created_at: new Date(today.getTime() - 86400000 * 5).toISOString(),
    },
];
