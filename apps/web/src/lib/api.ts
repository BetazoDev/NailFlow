import { Tenant, Service, Availability, Appointment, BookingData } from './types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

export const api = {
    getTenant: async (): Promise<Tenant> => {
        const res = await fetch(`${API_BASE_URL}/tenant`, {
            headers: { 'x-tenant-domain': 'localhost' }
        });
        if (!res.ok) throw new Error('Failed to fetch tenant');
        return res.json();
    },

    getServices: async (): Promise<Service[]> => {
        const res = await fetch(`${API_BASE_URL}/services`, {
            headers: { 'x-tenant-domain': 'localhost' }
        });
        if (!res.ok) throw new Error('Failed to fetch services');
        return res.json();
    },

    getAppointments: async (): Promise<Appointment[]> => {
        const res = await fetch(`${API_BASE_URL}/appointments`, {
            headers: { 'x-tenant-domain': 'localhost' }
        });
        if (!res.ok) throw new Error('Failed to fetch appointments');
        return res.json();
    },

    getAvailability: async (date: string): Promise<Availability | null> => {
        const res = await fetch(`${API_BASE_URL}/availability?date=${date}`, {
            headers: { 'x-tenant-domain': 'localhost' }
        });
        if (!res.ok) throw new Error('Failed to fetch availability');
        return res.json();
    },

    createBooking: async (data: BookingData) => {
        const res = await fetch(`${API_BASE_URL}/booking`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-tenant-domain': 'localhost'
            },
            body: JSON.stringify(data)
        });
        if (!res.ok) throw new Error('Booking failed');
        return res.json();
    }
};
