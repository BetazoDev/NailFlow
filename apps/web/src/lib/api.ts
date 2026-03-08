import { Tenant, Staff, Service, Appointment, BookingData, TimeSlot } from './types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://demo.diabolicalservices.tech';

const fetchApi = async (path: string, options: RequestInit = {}) => {
    // Add tenant domain header for resolution
    const headers = new Headers(options.headers || {});
    if (typeof window !== 'undefined') {
        headers.set('x-tenant-domain', window.location.hostname);
    }

    const response = await fetch(`${API_URL}${path}`, {
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
            return await fetchApi(`/api/tenant?domain=${domain}`);
        } catch (e) {
            return null;
        }
    },
    getTenant: async (idOrDomain: string): Promise<Tenant | null> => {
        try {
            const path = idOrDomain.includes('.') ? `/api/tenant?domain=${idOrDomain}` : `/api/tenant?id=${idOrDomain}`;
            return await fetchApi(path);
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
    // Appointments & Booking
    getAppointments: async (): Promise<Appointment[]> => {
        return fetchApi('/api/appointments');
    },
    getAvailability: async (staffId: string, date: string): Promise<TimeSlot[]> => {
        return fetchApi(`/api/availability?date=${date}&staff_id=${staffId}`);
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
    holdSlot: async (date: string, time: string, holdId: string): Promise<void> => {
        // Placeholder for demo
        return Promise.resolve();
    },
    releaseSlot: async (date: string, time: string): Promise<void> => {
        // Placeholder for demo
        return Promise.resolve();
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
    uploadImage: async (tenantId: string, folder: string, file: File): Promise<string> => {
        const formData = new FormData();
        formData.append('images', file);

        // Los IDs son necesarios si la deducción automática por token falla
        const clientId = process.env.NEXT_PUBLIC_CDN_CLIENT_ID || 'c6d224a2-1ebc-480a-8ccc-dcaf06258f01';
        formData.append('client_id', clientId);

        const projectId = process.env.NEXT_PUBLIC_CDN_PROJECT_ID || 'a4ebae0c-6ce2-482a-8774-e1a9aee72c79';
        formData.append('project_id', projectId);

        const uploadUrl = 'https://api.diabolicalservices.tech/api/images/upload';
        const token = process.env.NEXT_PUBLIC_CDN_UPLOAD_TOKEN || 'dmm_7tpONlAMTNtIMLjpr4gMSNqw9LGbgX6X';

        try {
            const response = await fetch(uploadUrl, {
                method: 'POST',
                headers: {
                    'x-api-key': token
                },
                body: formData
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || `CDN Upload Error: ${response.status}`);
            }

            const data = await response.json();

            // El CDN público usa el formato https://cdn.diabolicalservices.tech/{client-slug}/{filename}
            const clientSlug = process.env.NEXT_PUBLIC_CDN_CLIENT_SLUG || 'nailssalon';

            if (data.uploaded && data.uploaded.length > 0) {
                const filename = data.uploaded[0].filename;
                return `https://cdn.diabolicalservices.tech/${clientSlug}/${filename}`;
            } else if (data.duplicates && data.duplicates.length > 0) {
                const filename = data.duplicates[0].filename;
                return `https://cdn.diabolicalservices.tech/${clientSlug}/${filename}`;
            } else {
                throw new Error('Error CDN: No se retornó información de la imagen subida.');
            }
        } catch (error) {
            console.error('Upload Error:', error);
            throw error;
        }
    }
};
