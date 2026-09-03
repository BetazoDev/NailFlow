'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import type { TimeSlot } from '@/lib/types';
import { useBooking } from './BookingContext';

interface TimeSlotStepProps {
    /** Clears the chosen date and returns to the calendar. */
    onBack: () => void;
}

function formatDate(dateStr: string) {
    return new Date(`${dateStr}T12:00:00`).toLocaleDateString('es-MX', {
        day: 'numeric',
        month: 'long',
    });
}

/**
 * Free start times for the chosen day.
 *
 * The server decides what is available: it knows the salon's hours, the staff
 * member's schedule, existing bookings, other clients' held slots and the total
 * duration of everything selected. The list used to be filtered again here
 * against a second copy of the opening hours, which is how the calendar and the
 * slot list could disagree about the same day.
 */
export default function TimeSlotStep({ onBack }: TimeSlotStepProps) {
    const { draft, setTime } = useBooking();

    const selectedDate = draft.date ?? '';
    const selectedTime = draft.time;
    const staffId = draft.staffId;
    const serviceKey = draft.services.map(service => service.id).join(',');

    const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const heldSlotRef = useRef<string | null>(null);

    useEffect(() => {
        if (!selectedDate || !staffId) return;
        let cancelled = false;

        setLoading(true);
        setLoadError(null);

        api.getAvailability({
            date: selectedDate,
            staffId,
            serviceIds: serviceKey ? serviceKey.split(',') : undefined,
        })
            .then(slots => {
                if (!cancelled) setTimeSlots(slots);
            })
            .catch(() => {
                if (!cancelled) {
                    setTimeSlots([]);
                    setLoadError('No pudimos consultar la agenda. Intenta de nuevo.');
                }
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, [selectedDate, staffId, serviceKey]);

    /**
     * Release the hold if the client leaves without booking, so an abandoned
     * wizard does not keep a slot blocked until the lock expires on its own.
     */
    useEffect(() => {
        return () => {
            const held = heldSlotRef.current;
            if (held && selectedDate && staffId) {
                void api.releaseSlot(selectedDate, held, staffId).catch(() => {});
            }
        };
    }, [selectedDate, staffId]);

    const handleSlotSelect = useCallback(
        async (time: string) => {
            const previous = heldSlotRef.current;
            if (previous && previous !== time) {
                void api.releaseSlot(selectedDate, previous, staffId).catch(() => {});
            }

            heldSlotRef.current = time;
            setTime(time);

            // Best effort: if the hold fails the client can still book, and the
            // transaction that creates the appointment re-checks for clashes.
            await api.holdSlot(selectedDate, time, staffId).catch(() => {});
        },
        [selectedDate, staffId, setTime]
    );


    const morningSlots = timeSlots.filter(s => parseInt(s.time.split(':')[0]) < 13);
    const afternoonSlots = timeSlots.filter(s => parseInt(s.time.split(':')[0]) >= 13);

    const SlotGrid = ({ slots, title, icon }: { slots: TimeSlot[], title: string, icon: string }) => (
        <div className="mb-8 px-2">
            <div className="flex items-center gap-2 mb-4">
                <span className="text-xl">{icon}</span>
                <h4 className="text-[10px] font-bold text-nf-gray uppercase tracking-widest">{title}</h4>
            </div>
            <div className="grid grid-cols-2 min-[380px]:grid-cols-3 gap-3">
                {slots.map((slot) => {
                    const isSelected = selectedTime === slot.time;
                    return (
                        <button
                            key={slot.time}
                            onClick={() => handleSlotSelect(slot.time)}
                            aria-pressed={isSelected}
                            className={`
                                py-4 rounded-2xl text-[13px] font-bold transition-all duration-300 border
                                ${isSelected
                                    ? 'bg-charcoal text-white border-charcoal shadow-lg scale-105'
                                    : 'bg-white border-cream-dark text-charcoal hover:border-pink hover:bg-pink-pale'}
                            `}
                        >
                            {slot.time}
                        </button>
                    );
                })}
            </div>
        </div>
    );

    return (
        <div className="px-6 py-8 animate-fade-in">
            {/* Context bar */}
            <div className="flex items-center justify-between mb-8 p-4 rounded-2xl bg-white shadow-sm border border-cream-dark/30">
                <div className="flex flex-col">
                    <span className="text-[10px] font-bold text-nf-gray uppercase tracking-widest">Fecha elegida</span>
                    <span className="font-serif text-charcoal font-bold">{formatDate(selectedDate)}</span>
                </div>
                <button
                    onClick={onBack}
                    aria-label="Elegir otra fecha"
                    className="w-10 h-10 rounded-full bg-cream-dark/20 flex items-center justify-center text-nf-gray hover:bg-pink-pale hover:text-pink transition-all"
                >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 12H4M4 12l8-8M4 12l8 8" /></svg>
                </button>
            </div>

            {loadError ? (
                <p role="alert" className="rounded-2xl border border-danger/30 bg-danger/10 p-6 text-center text-sm text-danger">
                    {loadError}
                </p>
            ) : loading ? (
                <div className="flex flex-col items-center justify-center py-20 gap-4">
                    <div className="w-10 h-10 border-2 border-pink-pale border-t-pink rounded-full animate-spin" />
                    <p className="font-serif italic text-nf-gray">Consultando agenda...</p>
                </div>
            ) : timeSlots.length === 0 ? (
                <div className="text-center py-20 px-8">
                    <div className="text-4xl mb-4 opacity-20">📅</div>
                    <p className="font-serif text-charcoal text-lg mb-2">¡Lo sentimos!</p>
                    <p className="text-sm text-nf-gray">No hay horarios disponibles para el {formatDate(selectedDate)}. Por favor elige otra fecha.</p>
                </div>
            ) : (
                <div className="stagger-children">
                    {morningSlots.length > 0 && <SlotGrid slots={morningSlots} title="Mañana" icon="☀️" />}
                    {afternoonSlots.length > 0 && <SlotGrid slots={afternoonSlots} title="Tarde" icon="☕" />}
                </div>
            )}

        </div>
    );
}
