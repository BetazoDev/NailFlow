import type {
    Appointment,
    AppointmentStatus,
    CreateBookingRequest,
    CreateBookingResponse,
    Service,
    Staff,
    StaffRole,
    Tenant,
    TimeSlot,
} from '@nailflow/shared';
import { auth } from './firebase';

/**
 * Typed client for the NailFlow API.
 *
 * Every call goes through `request`, which attaches the tenant domain and — when
 * someone is signed in — a fresh Firebase ID token. Response shapes come from
 * `@nailflow/shared`, so a change to an endpoint's payload becomes a compile
 * error here rather than `undefined` on screen.
 */

const API_BASE = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001').replace(/\/+$/, '');

/**
 * Top-level folder this deployment's images live under on the CDN. Older rows
 * store a path without it, so it is re-attached when missing.
 */
const CDN_SLUG = process.env.NEXT_PUBLIC_CDN_SLUG ?? 'nailssalon';

/** The domain the API resolves the salon from. */
function tenantDomain(explicit?: string): string | undefined {
    if (explicit) return explicit;
    if (typeof window !== 'undefined') return window.location.host;
    return undefined;
}

/** Answer from `GET /api/session`: the caller's role in the current salon. */
export interface SessionInfo {
    uid: string;
    email: string | null;
    tenantId: string;
    /** null when the user has no relationship with this salon. */
    role: StaffRole | null;
    staffId: string | null;
}

export class ApiError extends Error {
    constructor(
        readonly status: number,
        message: string,
        readonly details?: unknown
    ) {
        super(message);
        this.name = 'ApiError';
    }
}

interface RequestOptions extends Omit<RequestInit, 'body'> {
    body?: unknown;
    /** Explicit tenant domain, for server-side rendering where there is no window. */
    domain?: string;
    /** Skip attaching the auth token even when a user is signed in. */
    anonymous?: boolean;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const { body, domain, anonymous, headers: extraHeaders, ...init } = options;

    const headers = new Headers(extraHeaders);
    const host = tenantDomain(domain);
    if (host) headers.set('x-tenant-domain', host);

    if (body !== undefined) headers.set('Content-Type', 'application/json');

    if (!anonymous && typeof window !== 'undefined' && auth.currentUser) {
        try {
            headers.set('Authorization', `Bearer ${await auth.currentUser.getIdToken()}`);
        } catch {
            // An expired session simply means the request goes out unauthenticated
            // and the API answers 401 — which the caller already handles.
        }
    }

    let response: Response;
    try {
        response = await fetch(`${API_BASE}/api${path}`, {
            ...init,
            headers,
            body: body === undefined ? undefined : JSON.stringify(body),
        });
    } catch {
        // A DNS failure, refused connection or timeout is not an HTTP status.
        // Surfacing it as an ApiError lets callers handle "cannot reach the
        // API" the same way they handle every other failure.
        throw new ApiError(0, 'No pudimos conectar con el servidor. Intenta de nuevo.');
    }

    if (response.status === 204) return undefined as T;

    const payload = await response.json().catch(() => null);

    if (!response.ok) {
        throw new ApiError(
            response.status,
            payload?.error ?? `Request failed with status ${response.status}`,
            payload?.details
        );
    }

    return payload as T;
}

/**
 * Resolves to null when the resource is absent or the API is unreachable.
 *
 * Used by the pages that render a "this salon is not available" state: a server
 * component that throws here would render a bare 500 instead.
 */
async function optional<T>(promise: Promise<T>): Promise<T | null> {
    try {
        return await promise;
    } catch (error) {
        if (error instanceof ApiError && (error.status === 404 || error.status === 0)) return null;
        throw error;
    }
}

export const api = {
    // ── Session ──────────────────────────────────────────────────────────────

    /** Who the signed-in user is for the salon on this domain, and what they may do. */
    getSession: () => optional(request<SessionInfo>('/session')),

    // ── Tenant ───────────────────────────────────────────────────────────────

    /** Public configuration for the salon serving this domain. */
    getTenant: (domain?: string) => optional(request<Tenant>('/tenant', { domain, anonymous: true })),

    updateTenant: (data: Partial<Pick<Tenant, 'name' | 'branding' | 'settings'>>) =>
        request<Tenant>('/tenant', { method: 'PUT', body: data }),

    /** First sign-up on a fresh deployment takes ownership of the salon. */
    claimTenant: (salonName: string) =>
        request<Tenant>('/tenant/claim', { method: 'POST', body: { salon_name: salonName } }),

    // ── Services ─────────────────────────────────────────────────────────────

    getServices: (options?: { includeInactive?: boolean }) =>
        request<Service[]>(`/services${options?.includeInactive ? '?include_inactive=true' : ''}`),

    createService: (data: Partial<Service>) =>
        request<Service>('/services', { method: 'POST', body: data }),

    updateService: (id: string, data: Partial<Service>) =>
        request<Service>(`/services/${encodeURIComponent(id)}`, { method: 'PUT', body: data }),

    /** Retires the service; past appointments keep their history. */
    archiveService: (id: string) =>
        request<void>(`/services/${encodeURIComponent(id)}`, { method: 'DELETE' }),

    // ── Staff ────────────────────────────────────────────────────────────────

    getStaff: (domain?: string) => request<Staff[]>('/staff', { domain, anonymous: true }),

    /** Full records including emails; owner only. */
    getTeam: () => request<Staff[]>('/staff/all'),

    createStaffMember: (data: Partial<Staff>) =>
        request<Staff>('/staff', { method: 'POST', body: data }),

    updateStaffMember: (id: string, data: Partial<Staff>) =>
        request<Staff>(`/staff/${encodeURIComponent(id)}`, { method: 'PUT', body: data }),

    deactivateStaffMember: (id: string) =>
        request<void>(`/staff/${encodeURIComponent(id)}`, { method: 'DELETE' }),

    // ── Appointments ─────────────────────────────────────────────────────────

    getAppointments: (filters?: { staffId?: string; from?: string; to?: string; status?: AppointmentStatus }) => {
        const params = new URLSearchParams();
        if (filters?.staffId) params.set('staff_id', filters.staffId);
        if (filters?.from) params.set('from', filters.from);
        if (filters?.to) params.set('to', filters.to);
        if (filters?.status) params.set('status', filters.status);
        const qs = params.toString();
        return request<Appointment[]>(`/appointments${qs ? `?${qs}` : ''}`);
    },

    getAppointment: (id: string) =>
        request<Appointment>(`/appointments/${encodeURIComponent(id)}`),

    setAppointmentStatus: (id: string, status: AppointmentStatus) =>
        request<Appointment>(`/appointments/${encodeURIComponent(id)}/status`, {
            method: 'PATCH',
            body: { status },
        }),

    setAppointmentImages: (id: string, imageUrls: string[]) =>
        request<Appointment>(`/appointments/${encodeURIComponent(id)}/images`, {
            method: 'PATCH',
            body: { image_urls: imageUrls },
        }),

    // ── Availability ─────────────────────────────────────────────────────────

    getAvailability: (params: { date: string; staffId: string; serviceIds?: string[] }) => {
        const query = new URLSearchParams({ date: params.date, staff_id: params.staffId });
        if (params.serviceIds?.length) query.set('service_ids', params.serviceIds.join(','));
        return request<TimeSlot[]>(`/availability?${query}`, { anonymous: true });
    },

    holdSlot: (date: string, time: string, staffId: string) =>
        request<{ success: boolean }>('/availability/hold', {
            method: 'POST',
            body: { date, time, staff_id: staffId },
            anonymous: true,
        }),

    releaseSlot: (date: string, time: string, staffId: string) => {
        const query = new URLSearchParams({ date, time, staff_id: staffId });
        return request<void>(`/availability/hold?${query}`, { method: 'DELETE', anonymous: true });
    },

    // ── Bookings ─────────────────────────────────────────────────────────────

    createBooking: (data: CreateBookingRequest) =>
        request<CreateBookingResponse>('/bookings', { method: 'POST', body: data, anonymous: true }),

    /** Demo path: confirms without taking payment. Disabled in production. */
    createTestBooking: (data: CreateBookingRequest) =>
        request<CreateBookingResponse>('/bookings/test', {
            method: 'POST',
            body: data,
            anonymous: true,
        }),

    // ── CRM ──────────────────────────────────────────────────────────────────

    getFavorites: async () => new Set(await request<string[]>('/favorites')),

    setFavorite: (phone: string, favorite: boolean) =>
        request<{ phone: string; favorite: boolean }>(`/favorites/${encodeURIComponent(phone)}`, {
            method: 'PUT',
            body: { favorite },
        }),

    // ── Images ───────────────────────────────────────────────────────────────

    /**
     * Uploads through our own Next.js route, which holds the CDN key.
     * `folder` groups the file (e.g. `services`, `team`, `references`).
     */
    uploadImage: async (file: File, folder: string): Promise<string> => {
        const formData = new FormData();
        formData.append('image', file);
        formData.append('folder', folder);

        const response = await fetch('/proxy/upload', {
            method: 'POST',
            body: formData,
            headers: auth.currentUser
                ? { Authorization: `Bearer ${await auth.currentUser.getIdToken()}` }
                : undefined,
        });

        const payload = await response.json().catch(() => null);
        if (!response.ok || !payload?.url) {
            throw new ApiError(response.status, payload?.error ?? 'Upload failed');
        }
        return payload.url as string;
    },

    /**
     * Turns a stored image reference into a URL the browser can load.
     *
     * Stored values vary — some are bare CDN paths, some full CDN URLs from
     * older uploads. Everything is normalised to the API's image proxy so the
     * CDN key never appears in the page.
     */
    getImageUrl: (reference: string | null | undefined): string => {
        if (!reference) return '';
        if (reference.startsWith('data:') || reference.startsWith('blob:')) return reference;

        // Strip any origin and any pre-existing proxy prefix, keeping "<slug>/<path>".
        const path = reference
            .replace(/^https?:\/\/[^/]+/i, '')
            .replace(/^\/?(api\/)?img\//i, '')
            .replace(/^\/+/, '')
            .split('?')[0];

        if (!path) return '';

        const segments = path.split('/').filter(Boolean);
        if (segments[0] !== CDN_SLUG) segments.unshift(CDN_SLUG);

        return `${API_BASE}/api/img/${segments.join('/')}`;
    },
};

export type { Appointment, Service, Staff, Tenant, TimeSlot };
