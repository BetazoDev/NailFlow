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

/** The domain the API resolves the salon from. */
function tenantDomain(explicit?: string): string | undefined {
    if (explicit) return explicit;
    if (typeof window !== 'undefined') return window.location.host;
    return undefined;
}

/** A salon's image storage, as Diabolical's own panel sees it. */
export interface CdnSummary {
    configured: boolean;
    slug: string;
    /** Her clients' photos: a second CDN project, null until she has one. */
    referenceSlug: string | null;
    hasUploadToken: boolean;
    hasReferenceToken: boolean;
    updatedAt: string | null;
    /** False when the API has no CREDENTIALS_KEY, so nothing can be sealed. */
    storable: boolean;
    /** The folder salons fall back to until they have one of their own. */
    sharedSlug: string;
}

/** A salon as Diabolical's own panel sees it. */
export interface PlatformSalon {
    id: string;
    domain: string;
    name: string | null;
    owner_id: string | null;
    owner_name: string | null;
    owner_email: string | null;
    owner_phone: string | null;
    owner_whatsapp: string | null;
    notes: string | null;
    subscription: {
        status?: 'active' | 'trial' | 'cancelled';
        plan?: string;
        current_period_end?: string;
    };
    created_at: string;
    appointments?: number;
    gateway: GatewayAccount | null;
}

export interface NewSalon {
    domain: string;
    name: string;
    owner_name?: string;
    owner_email: string;
    owner_phone?: string;
    owner_whatsapp?: string;
    notes?: string;
}

/** Result of asking the hosting panel to do something. */
export interface HostingOutcome {
    ok: boolean;
    detail: string;
    reason?: 'unconfigured' | 'rejected' | 'unreachable';
}

/**
 * Result of trying to send a salon her access letter.
 *
 * Separate from the hosting outcome despite the shape: a salon whose subdomain
 * is not routed cannot be reached at all, while one whose letter did not send
 * is reachable and simply has not been told — and the fix is different.
 */
export interface MailOutcome {
    ok: boolean;
    detail: string;
    reason?: 'unconfigured' | 'rejected' | 'unreachable';
}

/** Whether a salon's subdomain is actually routed here, and what is missing. */
export interface DomainCheck {
    domain: string;
    verdict: 'ok' | 'no-dns' | 'no-route' | 'no-certificate' | 'unknown';
    detail: string;
}

export interface AuditEntry {
    id: string;
    actor_email: string;
    action: string;
    tenant_id: string | null;
    detail: Record<string, unknown>;
    created_at: string;
}

/** A salon's connected payment gateway, as the panel is allowed to see it. */
export interface GatewayAccount {
    provider: 'mercadopago' | 'stripe';
    connected: boolean;
    /** The gateway will accept charges. False while verification is pending. */
    chargesEnabled: boolean;
    /** Mercado Pago only: without it her payments can never be verified. */
    webhookSecretSet: boolean;
    connectedAt: string | null;
}

export interface GatewayState {
    account: GatewayAccount | null;
    /** Which gateways this server is configured to offer at all. */
    available: { mercadopago: boolean; stripe: boolean };
}

/** Whether the salon is paid up. Only the panel sees this, never her clients. */
export type Standing = 'ok' | 'grace' | 'suspended';

/** Answer from `GET /api/session`: the caller's role in the current salon. */
export interface SessionInfo {
    uid: string;
    email: string | null;
    tenantId: string;
    /** null when the user has no relationship with this salon. */
    role: StaffRole | null;
    staffId: string | null;
    standing: Standing;
    /** Days before a lapsed salon stops taking bookings. Null when not in grace. */
    graceDaysLeft: number | null;
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

/**
 * The reason to show a client, out of a failed request.
 *
 * The API writes real Spanish for the refusals it means a client to read — a
 * suspended salon, a slot taken while she was deciding. It also emits plumbing
 * that is not addressed to anyone: a 404 on a route that is switched off, a
 * 500. Passing those straight through told a client her booking failed because
 * of "Route not found", which is both meaningless and alarming.
 *
 * So the API's own words are used only for the statuses where it is talking to
 * her, and everything else gets a sentence that says what she can do.
 */
const SPEAKS_TO_CLIENT = new Set([400, 402, 403, 409, 410, 422, 429, 503]);

export function clientReason(caught: unknown, fallback: string): string {
    if (caught instanceof ApiError && SPEAKS_TO_CLIENT.has(caught.status)) {
        return fieldMessage(caught.details) ?? caught.message;
    }
    return fallback;
}


/**
 * The first specific reason out of a validation failure's details.
 *
 * Only the first: a form that reports six problems at once is read as noise,
 * and fixing the first usually reveals whether the rest were the same mistake.
 */
function fieldMessage(details: unknown): string | undefined {
    if (!Array.isArray(details)) return undefined;

    const first = details.find(
        (entry): entry is { message: string } =>
            typeof entry === 'object' &&
            entry !== null &&
            typeof (entry as { message?: unknown }).message === 'string' &&
            (entry as { message: string }).message.trim().length > 0
    );

    return first?.message;
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
            // A validation failure answers with a generic headline and the real
            // reason in `details`. Showing only the headline turns "ese
            // subdominio está reservado" into "Invalid request", which tells the
            // reader nothing and sends them guessing at a form that was one word
            // away from being right.
            fieldMessage(payload?.details) ??
                payload?.error ??
                `Request failed with status ${response.status}`,
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
/**
 * Statuses that mean "there is nothing to show", rather than "something broke".
 *
 * 404 is the salon not existing and 0 is the API not answering at all. The
 * gateway codes matter just as much and were missing: when the API's container
 * is down, the request does not fail to connect — it reaches the reverse proxy,
 * which answers 502. That was re-thrown, the server component crashed, and a
 * salon's booking page showed a raw "Application error" instead of saying it
 * was unavailable.
 *
 * A 500 is deliberately absent. That is the API answering and being broken,
 * which is a different problem and should stay loud.
 */
const ABSENT = new Set([0, 404, 502, 503, 504]);

async function optional<T>(promise: Promise<T>): Promise<T | null> {
    try {
        return await promise;
    } catch (error) {
        if (error instanceof ApiError && ABSENT.has(error.status)) return null;
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

    // ── Cobros ───────────────────────────────────────────────────────────────

    /**
     * The salon's own payment account.
     *
     * Deposits are charged against whatever is connected here, so the money
     * lands with the salon. Nothing on this endpoint returns a credential —
     * only whether one exists and whether the gateway will accept charges.
     */
    getGateway: () => request<GatewayState>('/gateway'),

    connectMercadoPago: () =>
        request<{ url: string }>('/gateway/mercadopago/authorize', { method: 'POST' }),

    connectStripe: () =>
        request<{ url: string }>('/gateway/stripe/authorize', { method: 'POST' }),

    /** Copied by the owner from her Mercado Pago dashboard; we cannot read it. */
    setMercadoPagoWebhookSecret: (secret: string) =>
        request<GatewayAccount>('/gateway/mercadopago/webhook-secret', {
            method: 'PUT',
            body: { secret },
        }),

    /** Re-asks Stripe whether verification finished, without waiting for a webhook. */
    refreshStripe: () => request<GatewayAccount>('/gateway/stripe/refresh', { method: 'POST' }),

    disconnectGateway: () => request<void>('/gateway', { method: 'DELETE' }),

    // ── Avisos ───────────────────────────────────────────────────────────────

    /** Registers this browser to receive the salon's push notifications. */
    registerDevice: (token: string) =>
        request<void>('/devices', { method: 'POST', body: { token } }),

    forgetDevice: (token: string) =>
        request<void>('/devices', { method: 'DELETE', body: { token } }),

    // ── Plataforma (Diabolical) ──────────────────────────────────────────────

    /**
     * Diabolical's own panel. These routes act across every salon, so they are
     * mounted outside the per-domain API and answer 403 to anyone who is not a
     * platform administrator.
     */
    platform: {
        session: () =>
            request<{ email: string; platformAdmin: true; rootDomain: string | null }>(
                '/platform/session'
            ),

        salons: () => request<PlatformSalon[]>('/platform/tenants'),

        salon: (id: string) => request<PlatformSalon>(`/platform/tenants/${id}`),

        /**
         * Creates the salon and returns a link the owner uses to set her own
         * password. No password is ever chosen or sent by us.
         */
        createSalon: (salon: NewSalon) =>
            request<{
                id: string;
                domain: string;
                invite: string | null;
                /** Whether the subdomain was registered with the proxy for us. */
                hosting: HostingOutcome;
                /** Whether her access letter actually went out. */
                mail: MailOutcome;
            }>('/platform/tenants', { method: 'POST', body: salon }),

        /** Retries the subdomain registration for a salon whose first try failed. */
        registerDomain: (id: string) =>
            request<HostingOutcome>(`/platform/tenants/${id}/register-domain`, {
                method: 'POST',
            }),

        /** Confirms the hosting token works, before a real salon depends on it. */
        hosting: () => request<HostingOutcome & { enabled: boolean }>('/platform/hosting'),

        updateSalon: (id: string, patch: Partial<NewSalon> & {
            subscription?: { status: 'active' | 'trial' | 'cancelled'; plan: string };
        }) =>
            request<PlatformSalon>(`/platform/tenants/${id}`, { method: 'PATCH', body: patch }),

        /**
         * Whether the salon's subdomain reaches this deployment yet. Creating a
         * salon writes a row; DNS and the reverse proxy are separate steps.
         */
        checkDomain: (id: string) =>
            request<DomainCheck>(`/platform/tenants/${id}/domain`),

        /**
         * Records a monthly payment and extends the salon's period. However the
         * fee is actually collected, the product only depends on this.
         */
        markPaid: (id: string, months = 1) =>
            request<{ status: string; plan: string; current_period_end?: string }>(
                `/platform/tenants/${id}/paid`,
                { method: 'POST', body: { months } }
            ),

        /**
         * Deletes a salon. Refused once she has appointments — borrar arrastra
         * su historial, y el panel prefiere que canceles su suscripción.
         */
        deleteSalon: (id: string) =>
            request<{ deleted: true; hosting: HostingOutcome }>(`/platform/tenants/${id}`, {
                method: 'DELETE',
            }),

        // ── Almacenamiento de imágenes ───────────────────────────────────

        /**
         * The salon's own CDN folder and keys. The keys themselves never come
         * back: the panel is told whether each one is set, not what it is.
         */
        cdn: (id: string) => request<CdnSummary>(`/platform/tenants/${id}/cdn`),

        /**
         * Saves the folder, and each key that was actually typed. Leaving a key
         * blank keeps the stored one — the panel cannot show them back, so
         * correcting the folder must not wipe keys nobody has a copy of.
         */
        saveCdn: (
            id: string,
            body: {
                slug: string;
                reference_slug?: string;
                upload_token?: string;
                reference_token?: string;
            }
        ) => request<CdnSummary>(`/platform/tenants/${id}/cdn`, { method: 'PUT', body }),

        /** Returns the salon to the shared folder every salon used to share. */
        clearCdn: (id: string) =>
            request<CdnSummary>(`/platform/tenants/${id}/cdn`, { method: 'DELETE' }),

        /** Checks a key before it is stored, and says which folder it writes into. */
        probeCdn: (token: string) =>
            request<{ ok: true; slug: string | null } | { ok: false; detail: string }>(
                '/platform/cdn/probe',
                { method: 'POST', body: { token } }
            ),

        /** Re-issues the access link for an owner who never received it. */
        invite: (id: string) =>
            request<{ invite: string; mail: MailOutcome }>(
                `/platform/tenants/${id}/invite`,
                { method: 'POST' }
            ),

        /**
         * Whether the mailbox that sends access letters works. Asked when the
         * panel opens, so a wrong password is found before a salon needs it.
         */
        mail: () => request<MailOutcome & { enabled: boolean }>('/platform/mail'),

        audit: () => request<AuditEntry[]>('/platform/audit'),
    },

    /**
     * Carrying a Google sign-in from the account domain to a salon's own.
     *
     * Google only runs on the one domain Firebase knows, and a Firebase
     * session belongs to the origin that made it — so the two halves here are
     * called from two different hosts, and that is the whole point of them.
     */
    auth: {
        /** On the account domain: her salons, each with a code to enter it. */
        handoff: () =>
            request<{ salons: { domain: string; name: string | null; code: string }[]; expiresIn: number }>(
                '/auth/handoff',
                { method: 'POST' }
            ),

        /**
         * On her own domain: the code for a token that signs her in here.
         *
         * Anonymous because she has no session on this origin yet; the code is
         * what stands in for one, which is why it dies after this call.
         */
        redeem: (code: string) =>
            request<{ token: string }>('/auth/handoff/redeem', {
                method: 'POST',
                body: { code },
                anonymous: true,
            }),
    },

    /** First sign-up on a fresh deployment takes ownership of the salon. */

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
     * Uploads one image and returns the reference to store.
     *
     * Straight to the API, as raw bytes. It used to go through a Next.js route
     * that held a deployment-wide CDN key; the key now belongs to the salon and
     * is sealed in the database, so the upload has to happen where it can be
     * opened — and where "is this person signed in" can be the stricter
     * question the API already answers: does she own *this* salon.
     *
     * `folder` groups the file (e.g. `services`, `team`, `references`). Which
     * salon's folder it lands in is not sent: the API resolves that from the
     * domain and her own key.
     */
    uploadImage: async (file: File, folder: string): Promise<string> => {
        const headers = new Headers({ 'Content-Type': file.type });
        const host = tenantDomain();
        if (host) headers.set('x-tenant-domain', host);

        if (auth.currentUser) {
            try {
                headers.set('Authorization', `Bearer ${await auth.currentUser.getIdToken()}`);
            } catch {
                // An expired session goes out unauthenticated and the API
                // answers 401, which the caller already handles.
            }
        }

        let response: Response;
        try {
            response = await fetch(
                `${API_BASE}/api/images/${encodeURIComponent(folder)}` +
                    `?filename=${encodeURIComponent(file.name)}`,
                { method: 'POST', headers, body: file }
            );
        } catch {
            throw new ApiError(0, 'No pudimos conectar con el servidor. Intenta de nuevo.');
        }

        const payload = await response.json().catch(() => null);
        if (!response.ok || !payload?.url) {
            throw new ApiError(response.status, payload?.error ?? 'No pudimos subir la imagen.');
        }
        return payload.url as string;
    },

    /**
     * Turns a stored image reference into a URL the browser can load.
     *
     * Stored values vary — some are bare CDN paths, some carry the folder, some
     * are full CDN URLs from older uploads. All of them are normalised to the
     * API's image proxy so the CDN key never appears in the page.
     *
     * The folder is deliberately not filled in here. Each salon now has her
     * own, and a value baked into the web app at build time could only ever
     * name one of them; the API resolves it per request, which is also where it
     * can refuse to serve another salon's.
     *
     * Which salon that is travels in the URL. Everything else here goes through
     * `request`, which sets `x-tenant-domain` — but this returns a string for an
     * `<img src>`, and the browser fetches that by itself, with no way to attach
     * a header. Until the domain went in the query the API saw only its own
     * host, matched no salon, and answered 404 for every photo.
     *
     * `domain` is for callers rendering on the server, where there is no
     * `window` to read it from.
     */
    getImageUrl: (reference: string | null | undefined, domain?: string): string => {
        if (!reference) return '';
        if (reference.startsWith('data:') || reference.startsWith('blob:')) return reference;

        const path = reference
            .replace(/^https?:\/\/[^/]+/i, '')
            .replace(/^\/?(api\/)?img\//i, '')
            .replace(/^\/+/, '')
            .split('?')[0];

        if (!path) return '';

        const host = tenantDomain(domain);
        const query = host ? `?d=${encodeURIComponent(host)}` : '';

        return `${API_BASE}/api/img/${path}${query}`;
    },
};

export type { Appointment, Service, Staff, Tenant, TimeSlot };
