/**
 * The NailFlow domain model — the single source of truth for the shapes that
 * cross the wire between the API and the web app.
 *
 * These mirror the PostgreSQL schema in `apps/api/src/db/schema.ts`. When you
 * change a column, change it here too; both apps compile against this file, so
 * a mismatch becomes a type error instead of a runtime surprise.
 */

// ── Enumerations ─────────────────────────────────────────────────────────────

export const APPOINTMENT_STATUSES = ['pending_payment', 'confirmed', 'cancelled', 'completed'] as const;
export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number];

export const STAFF_ROLES = ['owner', 'staff'] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];

export const PAYMENT_METHODS = ['test', 'cash', 'transfer', 'mercado'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const BOOKING_STEPS = [
    'personal',
    'service',
    'datetime',
    'inspiration',
    'summary',
    'payment',
    'confirmation',
] as const;
export type BookingStep = (typeof BOOKING_STEPS)[number];

/** 0 = Sunday … 6 = Saturday, matching JavaScript's `Date#getDay`. */
export type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6;

// ── Tenant ───────────────────────────────────────────────────────────────────

export interface DaySchedule {
    day: DayOfWeek;
    active: boolean;
    /** "HH:mm", 24-hour. */
    start: string;
    /** "HH:mm", 24-hour. */
    end: string;
}

export interface LoyaltySettings {
    enabled: boolean;
    visits_required: number;
    reward_type: 'discount' | 'free_service';
    /** Percentage off, only meaningful when `reward_type` is `discount`. */
    discount_value?: number;
}

export interface TenantBranding {
    logo_url?: string;
    photo_url?: string;
    primary_color?: string;
    secondary_color?: string;
    palette_id?: string;
    typography?: string;
    tagline?: string;
}

export interface TenantSettings {
    currency?: string;
    timezone?: string;
    weekly_schedule?: DaySchedule[];
    loyalty?: LoyaltySettings;
}

export interface Tenant {
    id: string;
    domain: string;
    name?: string;
    branding: TenantBranding;
    settings: TenantSettings;
    /** Firebase Auth UID of the salon owner. */
    owner_id: string | null;
    subscription: {
        status: 'active' | 'trial' | 'cancelled';
        plan: string;
    };
    created_at?: string;
}

// ── Staff ────────────────────────────────────────────────────────────────────

export interface StaffDaySchedule {
    day_of_week: DayOfWeek;
    active?: boolean;
    /** "HH:mm", 24-hour. */
    start_time: string;
    /** "HH:mm", 24-hour. */
    end_time: string;
}

export interface Staff {
    id: string;
    tenant_id: string;
    name: string;
    email: string | null;
    role: StaffRole;
    photo_url: string | null;
    bio: string | null;
    specialty: string | null;
    /** URL segment for this member's personal booking link. */
    slug: string | null;
    active: boolean;
    /** Hex colour used to distinguish this member on the calendar. */
    color_identifier: string | null;
    services_offered: string[];
    weekly_schedule: StaffDaySchedule[];
    created_at?: string;
}

// ── Service ──────────────────────────────────────────────────────────────────

export interface Service {
    id: string;
    tenant_id: string;
    name: string;
    description: string | null;
    duration_minutes: number;
    estimated_price: number;
    /** Deposit the client pays up front to confirm the booking. */
    required_advance: number;
    category: string | null;
    image_url: string | null;
    active: boolean;
    created_at?: string;
}

// ── Appointment ──────────────────────────────────────────────────────────────

export interface Appointment {
    id: string;
    tenant_id: string;
    client_name: string;
    client_phone: string | null;
    client_email: string | null;
    /** Primary service. The full set lives in `services`. */
    service_id: string | null;
    staff_id: string | null;
    /** ISO-8601 with offset. */
    datetime_start: string;
    /** ISO-8601 with offset. */
    datetime_end: string;
    status: AppointmentStatus;
    advance_paid: boolean;
    notes: string | null;
    payment_ref: string | null;
    /** Total price of every service in the appointment, at time of booking. */
    price: number | null;
    payment_method: string | null;
    image_urls: string[];
    image_url: string | null;
    created_at?: string;

    /** Populated by endpoints that join the service tables. */
    services?: Service[];
    service_name?: string;
}

// ── Availability ─────────────────────────────────────────────────────────────

export interface TimeSlot {
    /** "HH:mm", 24-hour, in the tenant's timezone. */
    time: string;
    available: boolean;
}

// ── Client (derived, not a table) ────────────────────────────────────────────

/** Aggregated from a tenant's appointment history; there is no clients table. */
export interface Client {
    name: string;
    phone: string;
    email?: string;
    visits: number;
    /** ISO date of the most recent completed visit. */
    lastVisit: string;
    lastService?: string;
    totalSpent: number;
    services: string[];
    favorite: boolean;
}

// ── Requests ─────────────────────────────────────────────────────────────────

/** Payload the booking wizard posts to `POST /api/bookings`. */
export interface CreateBookingRequest {
    /** One or more services, in the order the client picked them. */
    service_ids: string[];
    staff_id: string;
    /** "YYYY-MM-DD" in the tenant's timezone. */
    date: string;
    /** "HH:mm", 24-hour, in the tenant's timezone. */
    time: string;
    client_name: string;
    client_phone: string;
    client_email?: string;
    notes?: string;
    image_urls?: string[];
    payment_method?: PaymentMethod;
}

export interface CreateBookingResponse {
    appointmentId: string;
    status: AppointmentStatus;
    /** Mercado Pago checkout URL; absent when no deposit is required. */
    init_point?: string;
}
