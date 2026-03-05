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
    getStaff: async (tenantId: string): Promise<Staff[]> => {
        return fetchApi('/api/staff');
    },
    createStaffMember: async (tenantId: string, data: Partial<Staff>): Promise<Staff> => {
        return fetchApi('/api/staff', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });
    },
    updateStaffMember: async (tenantId: string, id: string, data: Partial<Staff>): Promise<Staff> => {
        return fetchApi(`/api/staff/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });
    },

    // Services
    getServices: async (tenantId: string): Promise<Service[]> => {
        return fetchApi('/api/services');
    },
    createService: async (tenantId: string, data: Partial<Service>): Promise<Service> => {
        return fetchApi('/api/services', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });
    },
    updateService: async (tenantId: string, id: string, data: Partial<Service>): Promise<Service> => {
        return fetchApi(`/api/services/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });
    },
    deleteService: async (tenantId: string, id: string): Promise<void> => {
        return fetchApi(`/api/services/${id}`, { method: 'DELETE' });
    },

    // Appointments & Booking
    getAppointments: async (tenantId: string): Promise<Appointment[]> => {
        return fetchApi('/api/appointments');
    },
    getAvailability: async (tenantId: string, staffId: string, date: string): Promise<TimeSlot[]> => {
        return fetchApi(`/api/availability?date=${date}&staff_id=${staffId}`);
    },
    createBooking: async (data: BookingData): Promise<{ appointmentId: string; init_point: string }> => {
        return fetchApi('/api/bookings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });
    },
    completeAppointment: async (tenantId: string, id: string): Promise<void> => {
        return fetchApi(`/api/appointments/${id}/complete`, { method: 'POST' });
    },
    holdSlot: async (tenantId: string, date: string, time: string, holdId: string): Promise<void> => {
        // Placeholder for demo
        return Promise.resolve();
    },
    releaseSlot: async (tenantId: string, date: string, time: string): Promise<void> => {
        // Placeholder for demo
        return Promise.resolve();
    },

    // CRM / Favorites
    getFavorites: async (tenantId: string): Promise<Set<string>> => {
        const data = await fetchApi('/api/favorites');
        return new Set(data);
    },
    setFavorite: async (tenantId: string, phone: string, favorite: boolean): Promise<void> => {
        return fetchApi(`/api/favorites/${phone}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ favorite }),
        });
    },

    // Images (Kept Firebase for now as it's separate storage)
    uploadImage: async (tenantId: string, path: string, file: File): Promise<string> => {
        const { storage } = await import('./firebase');
        const { ref, uploadBytes, getDownloadURL } = await import('firebase/storage');
        const storageRef = ref(storage, `${tenantId}/${path}/${Date.now()}_${file.name}`);
        const snapshot = await uploadBytes(storageRef, file);
        return getDownloadURL(snapshot.ref);
    }
};
