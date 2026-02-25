'use client';

import { TimeSlot } from '@/lib/types';
import { useMemo } from 'react';

interface TimeSlotStepProps {
    selectedDate: string;
    selectedTime: string | null;
    onSelect: (time: string) => void;
    onNext: () => void;
    onBack: () => void;
}

export default function TimeSlotStep({ selectedDate, selectedTime, onSelect, onNext, onBack }: TimeSlotStepProps) {
    // Generate time slots (mock — in production, filtered by availability + existing bookings)
    const timeSlots: TimeSlot[] = useMemo(() => {
        const dayOfWeek = new Date(selectedDate + 'T12:00:00').getDay();
        const isSaturday = dayOfWeek === 6;
        const startHour = isSaturday ? 10 : 9;
        const endHour = isSaturday ? 15 : 18;
        const slots: TimeSlot[] = [];

        for (let h = startHour; h < endHour; h++) {
            slots.push({ time: `${String(h).padStart(2, '0')}:00`, available: Math.random() > 0.3 });
            if (h < endHour - 1 || !isSaturday) {
                slots.push({ time: `${String(h).padStart(2, '0')}:30`, available: Math.random() > 0.25 });
            }
        }
        return slots;
    }, [selectedDate]);

    const formatDate = (dateStr: string) => {
        const d = new Date(dateStr + 'T12:00:00');
        return d.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' });
    };

    return (
        <div className="flex flex-col h-full animate-fade-in-up">
            <div className="px-6 pt-4 pb-2">
                <button onClick={onBack} className="lg:hidden flex items-center gap-1 text-nf-gray text-sm mb-3 hover:text-charcoal transition-colors">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
                    Atrás
                </button>
                <h2 className="font-serif text-2xl font-semibold text-charcoal mb-1">Elige la hora</h2>
                <p className="text-sm text-nf-gray capitalize">{formatDate(selectedDate)}</p>
            </div>

            {/* Time slots grid */}
            <div className="flex-1 overflow-y-auto px-6 py-4">
                <div className="grid grid-cols-3 gap-3 stagger-children">
                    {timeSlots.map((slot) => (
                        <button
                            key={slot.time}
                            onClick={() => slot.available && onSelect(slot.time)}
                            disabled={!slot.available}
                            className={`
                py-3.5 px-3 rounded-xl text-sm font-medium transition-all duration-200
                ${!slot.available
                                    ? 'bg-cream-dark text-gray-light cursor-not-allowed line-through opacity-50'
                                    : selectedTime === slot.time
                                        ? 'text-white shadow-md'
                                        : 'bg-white border-1.5 border-cream-dark text-charcoal hover:border-pink hover:bg-pink-pale'
                                }
              `}
                            style={selectedTime === slot.time ? { background: 'linear-gradient(135deg, var(--pink), var(--coral))' } : {}}
                        >
                            {slot.time}
                        </button>
                    ))}
                </div>
            </div>

            {/* Continue */}
            <div className="p-6">
                <button
                    onClick={onNext}
                    disabled={!selectedTime}
                    className="btn-gradient w-full py-4 rounded-2xl text-base"
                >
                    Continuar
                </button>
            </div>
        </div>
    );
}
