import { z } from 'zod';
import { APPOINTMENT_STATUSES, PAYMENT_METHODS, STAFF_ROLES } from '@nailflow/shared';

/** Request schemas, kept together so the API's contract is readable in one place. */

/** E.164 — the format Mercado Pago and WhatsApp both expect. */
export const phoneSchema = z
    .string()
    .trim()
    .regex(/^\+?[1-9]\d{7,14}$/, 'Use international format, e.g. +5215512345678');

export const idSchema = z.string().trim().min(1).max(64);

export const isoDateSchema = z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD');

export const timeSchema = z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Expected HH:mm (24-hour)');

export const hexColorSchema = z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, 'Expected a hex colour like #E8B4B8');

/**
 * Only accept image URLs we host. Storing an arbitrary URL would let a booking
 * embed a tracker — or an attacker's endpoint — into the salon's dashboard.
 */
export const imageUrlSchema = z
    .string()
    .trim()
    .max(2048)
    .refine(
        value => /^https?:\/\//i.test(value) || value.startsWith('/'),
        'Expected an absolute or root-relative URL'
    );

// ── Services ─────────────────────────────────────────────────────────────────

export const serviceInputSchema = z.object({
    name: z.string().trim().min(1).max(120),
    description: z.string().trim().max(2000).optional().nullable(),
    duration_minutes: z.coerce.number().int().min(5).max(600),
    estimated_price: z.coerce.number().min(0).max(1_000_000),
    required_advance: z.coerce.number().min(0).max(1_000_000).default(0),
    category: z.string().trim().max(80).optional().nullable(),
    image_url: imageUrlSchema.optional().nullable(),
    active: z.boolean().optional(),
}).refine(
    data => data.required_advance <= data.estimated_price,
    { path: ['required_advance'], message: 'The deposit cannot exceed the service price' }
);

// ── Staff ────────────────────────────────────────────────────────────────────

export const staffScheduleSchema = z.array(
    z.object({
        day_of_week: z.coerce.number().int().min(0).max(6),
        active: z.boolean().optional(),
        start_time: timeSchema,
        end_time: timeSchema,
    }).refine(day => day.start_time < day.end_time, {
        path: ['end_time'],
        message: 'The end time must be after the start time',
    })
);

export const staffInputSchema = z.object({
    name: z.string().trim().min(1).max(120),
    email: z.string().trim().email().max(254).optional().nullable(),
    role: z.enum(STAFF_ROLES).optional(),
    specialty: z.string().trim().max(120).optional().nullable(),
    photo_url: imageUrlSchema.optional().nullable(),
    slug: z.string().trim().regex(/^[a-z0-9-]{1,60}$/, 'Lowercase letters, numbers and hyphens only').optional(),
    active: z.boolean().optional(),
    bio: z.string().trim().max(2000).optional().nullable(),
    color_identifier: hexColorSchema.optional().nullable(),
    services_offered: z.array(idSchema).max(100).optional(),
    weekly_schedule: staffScheduleSchema.optional(),
});

// ── Tenant ───────────────────────────────────────────────────────────────────

export const salonScheduleSchema = z.array(
    z.object({
        day: z.coerce.number().int().min(0).max(6),
        active: z.boolean(),
        start: timeSchema,
        end: timeSchema,
    })
);

/** A social handle: letters, digits, dots, underscores and dashes. */
const handleSchema = z
    .string()
    .trim()
    .max(60)
    .regex(/^[A-Za-z0-9._-]*$/, 'Ese usuario tiene caracteres que no admitimos');

export const tenantUpdateSchema = z.object({
    name: z.string().trim().min(1).max(120).optional(),
    branding: z.object({
        logo_url: imageUrlSchema.optional().nullable(),
        photo_url: imageUrlSchema.optional().nullable(),
        primary_color: hexColorSchema.optional(),
        secondary_color: hexColorSchema.optional(),
        palette_id: z.string().trim().max(60).optional(),
        typography: z.string().trim().max(60).optional(),
        tagline: z.string().trim().max(160).optional(),
    }).partial().optional(),
    settings: z.object({
        currency: z.string().trim().length(3).optional(),
        timezone: z.string().trim().max(60).optional(),
        weekly_schedule: salonScheduleSchema.optional(),
        loyalty: z.object({
            enabled: z.boolean(),
            visits_required: z.coerce.number().int().min(1).max(100),
            reward_type: z.enum(['discount', 'free_service']),
            discount_value: z.coerce.number().min(0).max(100).optional(),
        }).optional(),
        description: z.string().trim().max(1200).optional(),
        // Handles, not URLs: the salon types what she knows and the link is
        // built where it is shown. Anything that looks like markup or a scheme
        // is refused, so a handle can never become a link somewhere else.
        social: z.object({
            instagram: handleSchema.optional(),
            facebook: handleSchema.optional(),
            tiktok: handleSchema.optional(),
            whatsapp: z.string().trim().max(40).regex(/^[+0-9()\s-]*$/).optional(),
            website: z.string().trim().max(200).url().optional().or(z.literal('')),
        }).partial().optional(),
    }).partial().optional(),
});

// ── Availability & bookings ──────────────────────────────────────────────────

export const availabilityQuerySchema = z.object({
    date: isoDateSchema,
    staff_id: idSchema,
    service_ids: z
        .union([z.string(), z.array(z.string())])
        .transform(value => (Array.isArray(value) ? value : value.split(',')))
        .pipe(z.array(idSchema).min(1).max(20))
        .optional(),
});

export const slotHoldSchema = z.object({
    date: isoDateSchema,
    time: timeSchema,
    staff_id: idSchema,
});

export const createBookingSchema = z.object({
    service_ids: z.array(idSchema).min(1).max(20),
    staff_id: idSchema,
    date: isoDateSchema,
    time: timeSchema,
    client_name: z.string().trim().min(2).max(120),
    client_phone: phoneSchema,
    client_email: z.string().trim().email().max(254).optional(),
    notes: z.string().trim().max(2000).optional(),
    image_urls: z.array(imageUrlSchema).max(10).optional(),
    payment_method: z.enum(PAYMENT_METHODS).optional(),
});

export const appointmentStatusSchema = z.object({
    status: z.enum(APPOINTMENT_STATUSES),
});

export const appointmentImagesSchema = z.object({
    image_urls: z.array(imageUrlSchema).max(10),
});

export const appointmentQuerySchema = z.object({
    staff_id: idSchema.optional(),
    /** Inclusive lower bound on `datetime_start`. */
    from: isoDateSchema.optional(),
    /** Inclusive upper bound on `datetime_start`. */
    to: isoDateSchema.optional(),
    status: z.enum(APPOINTMENT_STATUSES).optional(),
});

export const favoriteSchema = z.object({
    favorite: z.boolean(),
});
