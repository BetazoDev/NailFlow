'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { Appointment } from '@/lib/types';

const DAY_LABELS = ['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa'];

export default function AgendaPage() {
    const today = new Date();
    const [selectedDay, setSelectedDay] = useState(today.getDate());
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        api.getAppointments()
            .then(data => setAppointments(data))
            .finally(() => setLoading(false));
    }, []);

    // Generate week strip
    const weekDays = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(today);
        d.setDate(today.getDate() - today.getDay() + i);
        return { date: d, dayName: DAY_LABELS[d.getDay()], dayNum: d.getDate() };
    });

    // Timeline hours
    const hours = Array.from({ length: 10 }, (_, i) => 9 + i); // 9:00 - 18:00

    const getSlotForHour = (hour: number) => {
        return appointments.find((a) => {
            const h = new Date(a.datetime_start).getHours();
            return h === hour;
        });
    };

    const slotColors = ['pink', 'coral', 'beige'] as const;

    return (
        <div className="animate-fade-in">
            {/* Header */}
            <div className="flex items-center justify-between px-6 pt-12 pb-4">
                <h1 className="font-serif text-2xl font-semibold text-charcoal">Agenda</h1>
                <button className="p-2 rounded-full hover:bg-cream-dark transition-colors">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--charcoal)" strokeWidth="2"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
                </button>
            </div>

            {/* Calendar strip */}
            <div className="px-6 pb-4">
                <p className="font-serif text-base font-medium text-charcoal mb-3.5">
                    {today.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })}
                </p>
                <div className="flex gap-1.5">
                    {weekDays.map((day) => {
                        const isActive = day.dayNum === selectedDay;
                        return (
                            <button
                                key={day.dayNum}
                                onClick={() => setSelectedDay(day.dayNum)}
                                className={`
                  flex-1 flex flex-col items-center py-2.5 rounded-xl transition-all duration-200 border-[1.5px]
                  ${isActive
                                        ? 'text-white border-transparent'
                                        : 'bg-white border-transparent hover:border-pink-light'
                                    }
                `}
                                style={isActive ? { background: 'linear-gradient(135deg, var(--pink), var(--coral))' } : {}}
                            >
                                <span className={`text-[11px] font-medium mb-1 ${isActive ? 'text-white/80' : 'text-nf-gray'}`}>{day.dayName}</span>
                                <span className={`text-base font-semibold ${isActive ? 'text-white' : 'text-charcoal'}`}>{day.dayNum}</span>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Timeline */}
            <div className="px-6">
                {hours.map((hour, i) => {
                    const apt = getSlotForHour(hour);
                    const colorClass = slotColors[i % slotColors.length];

                    return (
                        <div key={hour} className="flex gap-4 min-h-[72px] mb-1">
                            <span className="w-12 text-[13px] font-medium text-nf-gray pt-2 flex-shrink-0">
                                {String(hour).padStart(2, '0')}:00
                            </span>
                            {apt ? (
                                <div
                                    className={`flex-1 rounded-xl p-3.5 cursor-pointer transition-all duration-200 hover:translate-x-1 border-l-4 ${colorClass === 'pink' ? 'bg-pink-pale border-l-pink'
                                        : colorClass === 'coral' ? 'bg-coral-light border-l-coral'
                                            : 'bg-beige-light border-l-beige'
                                        }`}
                                >
                                    <p className="text-sm font-semibold text-charcoal">{apt.service_name}</p>
                                    <p className="text-xs text-charcoal-light">{apt.client_name}</p>
                                    <p className="text-[11px] text-nf-gray mt-1">
                                        {new Date(apt.datetime_start).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false })}
                                        {' — '}
                                        {new Date(apt.datetime_end).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false })}
                                    </p>
                                </div>
                            ) : (
                                <div className="flex-1 rounded-xl border-[1.5px] border-dashed border-cream-dark min-h-[60px]" />
                            )}
                        </div>
                    );
                })}
            </div>

            {/* FAB */}
            <button
                className="fixed bottom-24 right-8 w-14 h-14 rounded-full flex items-center justify-center shadow-lg hover:scale-110 transition-transform z-50"
                style={{ background: 'linear-gradient(135deg, var(--pink), var(--coral))' }}
            >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
            </button>
        </div>
    );
}
