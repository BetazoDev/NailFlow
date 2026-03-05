import { Tenant, Service, Staff, TimeSlot, Appointment, BookingData } from './types';
import { db } from './firebase';
import {
    collection,
    getDocs,
    getDoc,
    doc,
    query,
    where,
    setDoc,
    addDoc,
    updateDoc,
    deleteDoc,
    serverTimestamp,
    Timestamp
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from './firebase';

export const api = {
    uploadImage: async (tenantId: string, path: string, file: File): Promise<string> => {
        const storageRef = ref(storage, `tenants/${tenantId}/${path}/${Date.now()}_${file.name}`);

        // Timeout to prevent hanging if Firebase Storage is disabled
        const timeoutPromise = new Promise<never>((_, reject) => {
            setTimeout(() => reject(new Error("Timeout: Could not upload image to Firebase Storage.")), 10000);
        });

        // @ts-ignore
        const snapshot = await Promise.race([
            uploadBytes(storageRef, file),
            timeoutPromise
        ]);

        return await getDownloadURL(snapshot.ref);
    },
    getTenant: async (domain: string): Promise<Tenant | null> => {
        try {
            const tenantsRef = collection(db, 'tenants');
            const q = query(tenantsRef, where('domain', '==', domain));
            const snap = await getDocs(q);
            if (snap.empty) return null;
            const d = snap.docs[0];
            return { id: d.id, ...d.data() } as Tenant;
        } catch (e) {
            console.error('Error fetching tenant:', e);
            return null;
        }
    },

    getTenantById: async (tenantId: string): Promise<Tenant | null> => {
        try {
            const snap = await getDoc(doc(db, 'tenants', tenantId));
            if (!snap.exists()) return null;
            return { id: snap.id, ...snap.data() } as Tenant;
        } catch (e) {
            console.error('Error fetching tenant by ID:', e);
            return null;
        }
    },

    getTenantByOwner: async (ownerId: string): Promise<Tenant | null> => {
        try {
            const tenantsRef = collection(db, 'tenants');
            const q = query(tenantsRef, where('owner_id', '==', ownerId));
            const snap = await getDocs(q);
            if (snap.empty) return null;
            const d = snap.docs[0];
            return { id: d.id, ...d.data() } as Tenant;
        } catch (e) {
            console.error('Error fetching tenant by owner:', e);
            return null;
        }
    },

    getServices: async (tenantId: string): Promise<Service[]> => {
        try {
            const snap = await getDocs(collection(db, 'tenants', tenantId, 'services'));
            return snap.docs.map(d => ({ id: d.id, ...d.data() } as Service));
        } catch (e) {
            console.error('Error fetching services:', e);
            return [];
        }
    },

    getStaff: async (tenantId: string): Promise<Staff[]> => {
        try {
            const snap = await getDocs(collection(db, 'tenants', tenantId, 'staff'));
            return snap.docs.map(d => ({ id: d.id, ...d.data() } as Staff));
        } catch (e) {
            console.error('Error fetching staff:', e);
            return [];
        }
    },

    getAppointments: async (tenantId: string): Promise<Appointment[]> => {
        try {
            const snap = await getDocs(collection(db, 'tenants', tenantId, 'appointments'));
            return snap.docs.map(d => ({ id: d.id, ...d.data() } as Appointment));
        } catch (e) {
            console.error('Error fetching appointments:', e);
            return [];
        }
    },

    getAvailability: async (tenantId: string, date: string): Promise<TimeSlot[]> => {
        try {
            // Get booked appointments
            const aptsRef = collection(db, 'tenants', tenantId, 'appointments');
            const q = query(aptsRef, where('date', '==', date), where('status', 'in', ['confirmed', 'pending_payment']));
            const snap = await getDocs(q);
            const bookedTimes = new Set(snap.docs.map(d => d.data().time));

            // Get active holds
            const holdsRef = collection(db, 'tenants', tenantId, 'slot_holds');
            const holdsSnap = await getDocs(holdsRef);
            const now = new Date();
            holdsSnap.docs.forEach(d => {
                const data = d.data();
                if (data.date === date) {
                    const heldUntil = data.held_until?.toDate?.() || new Date(data.held_until);
                    if (heldUntil > now) {
                        bookedTimes.add(data.time);
                    }
                }
            });

            const slots: TimeSlot[] = [];
            for (let h = 9; h < 18; h++) {
                const timeH = `${String(h).padStart(2, '0')}:00`;
                const timeM = `${String(h).padStart(2, '0')}:30`;
                slots.push({ time: timeH, available: !bookedTimes.has(timeH) });
                slots.push({ time: timeM, available: !bookedTimes.has(timeM) });
            }
            return slots.filter(s => s.available);
        } catch (e) {
            console.error('Error fetching availability:', e);
            return [];
        }
    },

    createBooking: async (tenantId: string, data: BookingData) => {
        const start = `${data.date}T${data.time}:00`;
        const startDate = new Date(start);
        const endDate = new Date(startDate.getTime() + (data.service_duration || 60) * 60000);

        const result = await addDoc(collection(db, 'tenants', tenantId, 'appointments'), {
            ...data,
            datetime_start: start,
            datetime_end: endDate.toISOString(),
            status: 'confirmed',
            advance_paid: false,
            created_at: serverTimestamp(),
        });

        // Release the slot hold after booking
        try {
            const holdId = `${data.date}_${data.time}`;
            await deleteDoc(doc(db, 'tenants', tenantId, 'slot_holds', holdId));
        } catch { /* hold may not exist */ }

        return result;
    },

    // ── Service CRUD ──────────────────────────────
    createService: async (tenantId: string, data: Partial<Service> & { category?: string }) => {
        const timeout = new Promise<never>((_, reject) => {
            setTimeout(() => reject(new Error("Timeout: No se pudo conectar con la base de datos (Firestore).")), 15000);
        });

        const operation = async () => {
            if (data.id) {
                await setDoc(doc(db, 'tenants', tenantId, 'services', data.id), { ...data });
                return { ...data };
            } else {
                const docRef = await addDoc(collection(db, 'tenants', tenantId, 'services'), { ...data });
                const id = docRef.id;
                await updateDoc(docRef, { id });
                return { id, ...data };
            }
        };

        return await Promise.race([operation(), timeout]);
    },

    updateService: async (tenantId: string, id: string, data: Partial<Service>) => {
        const timeout = new Promise<never>((_, reject) => {
            setTimeout(() => reject(new Error("Timeout: No se pudo actualizar el servicio.")), 15000);
        });
        const operation = updateDoc(doc(db, 'tenants', tenantId, 'services', id), data as Record<string, any>);
        await Promise.race([operation, timeout]);
    },

    deleteService: async (tenantId: string, id: string) => {
        await deleteDoc(doc(db, 'tenants', tenantId, 'services', id));
    },

    // ── Appointment Operations ────────────────────
    getAppointment: async (tenantId: string, id: string) => {
        const snap = await getDoc(doc(db, 'tenants', tenantId, 'appointments', id));
        if (!snap.exists()) throw new Error('Appointment not found');
        return { id: snap.id, ...snap.data() } as Appointment;
    },

    updateAppointmentStatus: async (tenantId: string, id: string, status: string) => {
        await updateDoc(doc(db, 'tenants', tenantId, 'appointments', id), { status });
    },

    completeAppointment: async (tenantId: string, appointmentId: string, amount: number, staffId: string, date: string) => {
        // Update appointment status
        await updateDoc(doc(db, 'tenants', tenantId, 'appointments', appointmentId), { status: 'completed' });
        // Record earnings
        await addDoc(collection(db, 'tenants', tenantId, 'earnings'), {
            appointment_id: appointmentId,
            amount,
            staff_id: staffId,
            date,
            created_at: serverTimestamp(),
        });
    },

    // ── Staff CRUD ────────────────────────────────
    createStaffMember: async (tenantId: string, data: Partial<Staff>) => {
        const id = data.id || `staff-${Date.now()}`;
        const slug = data.slug || data.name?.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') || id;
        const staffData = {
            id,
            tenant_id: tenantId,
            name: data.name || '',
            email: data.email || '',
            role: data.role || 'staff',
            photo_url: data.photo_url || '',
            bio: data.bio || '',
            specialty: data.specialty || '',
            slug,
            active: true,
            color_identifier: data.color_identifier || '#C97794',
            services_offered: data.services_offered || [],
            weekly_schedule: data.weekly_schedule || [],
        };
        await setDoc(doc(db, 'tenants', tenantId, 'staff', id), staffData);
        return staffData;
    },

    updateStaffMember: async (tenantId: string, id: string, data: Partial<Staff>) => {
        await updateDoc(doc(db, 'tenants', tenantId, 'staff', id), data as Record<string, unknown>);
    },

    // ── Favorites ─────────────────────────────────
    getFavorites: async (tenantId: string): Promise<Set<string>> => {
        try {
            const snap = await getDocs(collection(db, 'tenants', tenantId, 'favorites'));
            const favs = new Set<string>();
            snap.docs.forEach(d => favs.add(d.id));
            return favs;
        } catch (e) {
            console.error('Error fetching favorites:', e);
            return new Set();
        }
    },

    setFavorite: async (tenantId: string, clientKey: string, favorite: boolean) => {
        const docRef = doc(db, 'tenants', tenantId, 'favorites', clientKey);
        if (favorite) {
            await setDoc(docRef, { favorite: true, updated_at: serverTimestamp() });
        } else {
            await deleteDoc(docRef);
        }
    },

    // ── Slot Holds (Booking time-slot blocking) ───
    holdSlot: async (tenantId: string, date: string, time: string, holdId: string) => {
        const docId = `${date}_${time}`;
        const heldUntil = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes from now
        await setDoc(doc(db, 'tenants', tenantId, 'slot_holds', docId), {
            date,
            time,
            hold_id: holdId,
            held_until: Timestamp.fromDate(heldUntil),
            created_at: serverTimestamp(),
        });
    },

    releaseSlot: async (tenantId: string, date: string, time: string) => {
        const docId = `${date}_${time}`;
        try {
            await deleteDoc(doc(db, 'tenants', tenantId, 'slot_holds', docId));
        } catch { /* already released */ }
    },

    // ── Tenant Branding ───────────────────────────
    updateTenant: async (tenantId: string, data: { name?: string; branding?: Partial<Tenant['branding']>; settings?: Partial<Tenant['settings']> }) => {
        await updateDoc(doc(db, 'tenants', tenantId), data);
    }
};
