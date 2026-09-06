/**
 * Web-app types.
 *
 * The API contract lives in `@nailflow/shared` and is re-exported here so
 * components keep importing from one place. Only shapes that exist purely in
 * the browser — wizard state, view models — are declared below.
 */

export type {
    Appointment,
    AppointmentStatus,
    Client,
    CreateBookingRequest,
    CreateBookingResponse,
    DayOfWeek,
    DaySchedule,
    LoyaltySettings,
    PaymentMethod,
    Service,
    SocialLinks,
    Staff,
    StaffDaySchedule,
    StaffRole,
    Tenant,
    TenantBranding,
    TenantSettings,
    TimeSlot,
    BookingStep,
} from '@nailflow/shared';

export { APPOINTMENT_STATUSES, BOOKING_STEPS, PAYMENT_METHODS, STAFF_ROLES } from '@nailflow/shared';

import type { PaymentMethod, Service } from '@nailflow/shared';

/**
 * The booking wizard's working state.
 *
 * This is what the UI shows while the client is choosing. The totals here are a
 * preview: the server recomputes them from its own service rows when the
 * booking is submitted, so a tampered payload cannot change what is charged.
 */
export interface BookingDraft {
    date: string | null;
    time: string | null;
    services: Service[];
    staffId: string;
    staffName: string;
    staffPhoto?: string;
    clientName: string;
    clientPhone: string;
    clientEmail: string;
    notes?: string;
    imageUrls: string[];
    paymentMethod?: PaymentMethod;
}

/** Preview totals derived from the draft's selected services. */
export interface BookingTotalsView {
    price: number;
    durationMinutes: number;
    requiredAdvance: number;
}
