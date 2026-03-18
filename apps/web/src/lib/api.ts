import { Tenant, Staff, Service, Appointment, BookingData, TimeSlot } from './types';
import { auth } from './firebase';

let API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api-nailflow.diabolicalservices.tech/api';

// HACK: Fix Dokploy misconfiguration. If the API URL points to the frontend (demo),
// force it to the real backend (api) to prevent infinite loops and 404s.
if (API_URL.includes('demo.diabolicalservices.tech') || (!API_URL.includes('api-') && !API_URL.includes('api.'))) {
    API_URL = 'https://api-nailflow.diabolicalservices.tech/api';
}

if (API_URL.endsWith('/')) {
    API_URL = API_URL.slice(0, -1);
}

const fetchApi = async (path: string, options: RequestInit = {}, domain?: string) => {
    // Ensure path starts with /
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    
    // Avoid double /api in the final URL if path already includes it
    const finalUrl = cleanPath.startsWith('/api') 
        ? `${API_URL.replace(/\/api$/, '')}${cleanPath}`
        : `${API_URL}${cleanPath}`;
    
    // Add tenant domain header for resolution
    const headers = new Headers(options.headers || {});

    if (typeof window !== 'undefined') {
        headers.set('x-tenant-domain', window.location.hostname);
        
        // Add auth token if user is signed in
        if (auth.currentUser) {
            try {
                const token = await auth.currentUser.getIdToken();
                headers.set('Authorization', `Bearer ${token}`);
            } catch (e) {
                console.warn('Failed to get auth token', e);
            }
        }
    } else if (domain) {
        headers.set('x-tenant-domain', domain);
    }

    const response = await fetch(finalUrl, {
        ...options,
        headers,
    });

    if (!response.ok) {
        let errorData;
        try {
            errorData = await response.json();
        } catch (e) {
            errorData = { error: response.statusText };
        }
        throw new Error(errorData.error || `API Error: ${response.status}`);
    }

    return response.json();
};

export const api = {
    // Tenant
    getTenantByDomain: async (domain: string): Promise<Tenant | null> => {
        try {
            return await fetchApi(`/api/tenant?domain=${domain}`, {}, domain);
        } catch (e) {
            return null;
        }
    },
    getTenant: async (idOrDomain: string): Promise<Tenant | null> => {
        try {
            const isDomain = idOrDomain.includes('.');
            const path = isDomain ? `/api/tenant?domain=${idOrDomain}` : `/api/tenant?id=${idOrDomain}`;
            return await fetchApi(path, {}, isDomain ? idOrDomain : undefined);
        } catch (e) {
            return null;
        }
    },
    getTenantByOwner: async (ownerId: string): Promise<Tenant | null> => {
        try {
            return await fetchApi(`/api/tenant?owner_id=${ownerId}`);
        } catch (e) {
            return null;
        }
    },
    getTenantById: async (id: string): Promise<Tenant | null> => {
        try {
            return await fetchApi(`/api/tenant?id=${id}`);
        } catch (e) {
            return null;
        }
    },
    updateTenant: async (id: string, data: Partial<Tenant>): Promise<Tenant> => {
        return fetchApi(`/api/tenant?id=${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });
    },

    // Staff
    getStaff: async (): Promise<Staff[]> => {
        return fetchApi('/api/staff');
    },
    createStaffMember: async (data: Partial<Staff>): Promise<Staff> => {
        return fetchApi('/api/staff', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });
    },
    updateStaffMember: async (id: string, data: Partial<Staff>): Promise<Staff> => {
        return fetchApi(`/api/staff/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });
    },

    // Services
    getServices: async (): Promise<Service[]> => {
        return fetchApi('/api/services');
    },
    createService: async (data: Partial<Service>): Promise<Service> => {
        return fetchApi('/api/services', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });
    },
    updateService: async (id: string, data: Partial<Service>): Promise<Service> => {
        return fetchApi(`/api/services/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });
    },
    deleteService: async (id: string): Promise<void> => {
        return fetchApi(`/api/services/${id}`, { method: 'DELETE' });
    },

    // Appointments & Booking
    getAppointments: async (): Promise<Appointment[]> => {
        return fetchApi('/api/appointments');
    },
    getAvailability: async (staffId: string, date: string, serviceId?: string): Promise<TimeSlot[]> => {
        const svcParam = serviceId ? `&service_id=${serviceId}` : '';
        return fetchApi(`/api/availability?date=${date}&staff_id=${staffId}${svcParam}`);
    },
    createBooking: async (data: BookingData): Promise<{ appointmentId: string; init_point: string }> => {
        return fetchApi('/api/bookings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });
    },
    createBookingTest: async (data: BookingData): Promise<{ appointmentId: string }> => {
        return fetchApi('/api/bookings/test', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });
    },
    completeAppointment: async (id: string): Promise<void> => {
        return fetchApi(`/api/appointments/${id}/complete`, { method: 'POST' });
    },
    updateAppointmentStatus: async (id: string, status: string): Promise<void> => {
        return fetchApi(`/api/appointments/${id}/status`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status }),
        });
    },
    updateAppointmentImages: async (id: string, image_urls: string[]): Promise<void> => {
        return fetchApi(`/api/appointments/${id}/images`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ image_urls }),
        });
    },

    // Slot Locking
    holdTimeSlot: async (date: string, time: string, staff_id: string): Promise<{ success: boolean }> => {
        return fetchApi('/api/availability/hold', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ date, time, staff_id }),
        });
    },

    releaseTimeSlot: async (date: string, time: string, staff_id: string): Promise<{ success: boolean }> => {
        return fetchApi(`/api/availability/hold?date=${date}&time=${time}&staff_id=${staff_id}`, {
            method: 'DELETE',
        });
    },

    // CRM / Favorites
    getFavorites: async (): Promise<Set<string>> => {
        const data = await fetchApi('/api/favorites');
        return new Set(data);
    },
    setFavorite: async (phone: string, favorite: boolean): Promise<void> => {
        return fetchApi(`/api/favorites/${phone}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ favorite }),
        });
    },

    // Images (CDN Integration)
    uploadImage: async (tenantId: string, folder: string, file: File, projectType: 'demo' | 'clients' = 'demo'): Promise<string> => {
        const formData = new FormData();
        formData.append('images', file);
        formData.append('folder', folder);
        formData.append('projectType', projectType);

        const uploadUrl = '/proxy/upload';

        try {
            const response = await fetch(uploadUrl, {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || `CDN Upload Error: ${response.status}`);
            }

            const data = await response.json();

            const clientSlug = 'nailssalon'; // Current slug for NailFlow project resources

            if (data.uploaded && data.uploaded.length > 0) {
                const item = data.uploaded[0];
                return item.url || item.cdnUrl || `https://cdn.diabolicalservices.tech/${clientSlug}/${item.filename}`;
            } else if (data.duplicates && data.duplicates.length > 0) {
                const item = data.duplicates[0];
                return item.url || item.cdnUrl || `https://cdn.diabolicalservices.tech/${clientSlug}/${item.filename}`;
            } else {
                console.error('CDN Response missing data:', data);
                throw new Error('Error CDN: No se retornó información de la imagen subida.');
            }
        } catch (error) {
            console.error('Upload Error:', error);
            throw error;
        }
    },
    getPublicUrl: (url: string | null | undefined): string => {
        if (!url) return '';
        // Blob URLs (local preview) — return as-is
        if (url.startsWith('blob:')) return url;
        
        // External image not on our CDN — return as-is
        if (url.startsWith('http') && !url.includes('cdn.diabolicalservices.tech') && !url.includes('api.diabolicalservices.tech') && !url.includes('api-nailflow.diabolicalservices.tech')) {
            return url;
        }

        const CDN_BASE = 'https://cdn.diabolicalservices.tech';
        const clientSlug = 'nailssalon';
        
        // Tokens as requested by user
        const SYSTEM_TOKEN = 'dmm_7tpONlAMTNtIMLjpr4gMSNqw9LGbgX6X';
        const CLIENTS_TOKEN = 'dmm_XKnnaMPrgRWaRHQ21deaQ3Krz2B6iBW';

        // Extract path (remove potential domain prefixes)
        let path = url;
        if (url.includes('/img/')) {
            path = url.split('/img/')[1];
        } else if (url.startsWith('http')) {
            try {
                const parsed = new URL(url);
                const pathParts = parsed.pathname.split('/').filter(Boolean);
                
                // If it's already a CDN URL: domain/slug/path
                if (url.includes('cdn.diabolicalservices.tech')) {
                    if (pathParts.length >= 2 && pathParts[0] === clientSlug) {
                        path = pathParts.slice(1).join('/');
                    } else {
                        path = pathParts.join('/');
                    }
                } else {
                    path = pathParts.join('/');
                }
            } catch {
                path = url;
            }
        }

        // Clean path and ensure slug prefix if missing
        const cleanPath = path.startsWith('/') ? path.substring(1) : path;
        
        // Detect if it's a client reference photo (specifically in 'clientas' folder)
        const isClientPhoto = cleanPath.includes('clientas/') || cleanPath.includes('bookings/');
        const token = isClientPhoto ? CLIENTS_TOKEN : SYSTEM_TOKEN;
        
        // Correct base path: ensure slug is present once
        const pathPart = cleanPath.startsWith(clientSlug) ? cleanPath : `${clientSlug}/${cleanPath}`;
        
        // Build final URL with token
        const finalUrl = new URL(`${CDN_BASE}/${pathPart}`);
        finalUrl.searchParams.set('api_key', token);
        
        return finalUrl.toString();
    },
};
