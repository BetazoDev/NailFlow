'use client';

import { TimeSlot } from '@/lib/types';
import { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '@/lib/api';

interface TimeSlotStepProps {
    selectedDate: string;
    selectedTime: string | null;
    onSelect: (time: string) => void;
    onNext: () => void;
    onBack: () => void;
    tenantId?: string;
    staffId?: string;
    serviceId?: string;
    totalDuration?: number;
}

export default function TimeSlotStep({ selectedDate, selectedTime, onSelect, onNext, onBack, tenantId = 'demo', staffId = 'staff-1', serviceId, totalDuration = 0 }: TimeSlotStepProps) {
    const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
    const [loading, setLoading] = useState(false);
    const holdIdRef = useRef(`hold_${Date.now()}_${Math.random().toString(36).slice(2)}`);
    const prevSlotRef = useRef<string | null>(null);

    const formatDate = (dateStr: string) => {
        const d = new Date(dateStr + 'T12:00:00');
        return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'long' });
    };

    const timeToMinutes = (t: string) => {
        const [h, m] = t.split(':').map(Number);
        return h * 60 + (m || 0);
    };

    useEffect(() => {
        if (!selectedDate || !tenantId) return;
        async function loadAvailability() {
            setLoading(true);
            try {
                const [slots, tenant] = await Promise.all([
                    api.getAvailability(staffId, selectedDate, serviceId),
                    api.getTenant(tenantId)
                ]);

                // Filter by business hours
                const dateObj = new Date(selectedDate + 'T12:00:00');
                const dayNum = dateObj.getDay();
                const daySched = tenant?.settings?.weekly_schedule?.find((s: any) => s.day === dayNum);

                if (daySched && daySched.active) {
                    const startMin = timeToMinutes(daySched.start);
                    const endMin = timeToMinutes(daySched.end);
                    
                    const filtered = slots.filter(slot => {
                        const slotMin = timeToMinutes(slot.time);
                        // Filter by business hours AND ensure total duration fits before closing
                        return slotMin >= startMin && (slotMin + (totalDuration || 0)) <= endMin;
                    });
                    setTimeSlots(filtered);
                } else {
                    // Even if no specific schedule, respect duration if endMin were known. 
                    // But usually there's a daySched. If not, we just show all.
                    setTimeSlots(slots);
                }
            } catch (err) {
                console.error('Failed to load availability:', err);
                setTimeSlots([]);
            } finally {
                setLoading(false);
            }
        }
        loadAvailability();
    }, [selectedDate, tenantId, staffId, serviceId]);

    const handleSlotSelect = useCallback(async (time: string) => {
        // Release previous hold if any
        if (prevSlotRef.current && prevSlotRef.current !== time) {
            api.releaseTimeSlot(selectedDate, prevSlotRef.current, staffId!).catch(() => { });
        }
        // Hold the new slot
        try {
            await api.holdTimeSlot(selectedDate, time, staffId!);
        } catch (e) {
            console.error('Failed to hold slot:', e);
        }
        prevSlotRef.current = time;
        onSelect(time);
    }, [tenantId, selectedDate, staffId, onSelect]);

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
                    className="w-10 h-10 rounded-full bg-cream-dark/20 flex items-center justify-center text-nf-gray hover:bg-pink-pale hover:text-pink transition-all"
                >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 12H4M4 12l8-8M4 12l8 8" /></svg>
                </button>
            </div>

            {loading ? (
                <div className="flex flex-col items-center justify-center py-20 gap-4">
                    <div className="w-10 h-10 border-3 border-pink-pale border-t-pink rounded-full animate-spin" />
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

            {/* Bottom Panel */}
            <div className={`
                fixed bottom-0 left-0 right-0 p-6 bg-white/80 backdrop-blur-xl border-t border-cream-dark/50 transition-all duration-500 transform z-20
                ${selectedTime ? 'translate-y-0 opacity-100 shadow-up' : 'translate-y-full opacity-0'}
            `}>
                <div className="max-w-lg mx-auto flex items-center justify-between gap-4">
                    <div className="hidden sm:block">
                        <p className="text-[10px] font-bold text-pink uppercase tracking-widest mb-0.5">Confirmar para las</p>
                        <p className="font-serif text-charcoal text-lg font-bold">
                            {selectedTime}
                        </p>
                    </div>
                    <button
                        onClick={onNext}
                        className="flex-1 py-5 rounded-full text-base font-serif flex items-center justify-center gap-3 shadow-lg btn-gradient text-white"
                    >
                        Confirmar Cita
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>
                    </button>
                </div>
            </div>
        </div>
    );
}
