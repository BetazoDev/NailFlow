'use client';

import React from 'react';
import CalendarStep from './CalendarStep';
import TimeSlotStep from './TimeSlotStep';

interface DateTimeStepProps {
    selectedDate: string | null;
    selectedTime: string | null;
    onDateSelect: (date: string) => void;
    onTimeSelect: (time: string) => void;
    onNext: () => void;
    onBack?: () => void;
    tenantId?: string;
    staffId?: string;
    serviceId?: string;
}

export default function DateTimeStep({ selectedDate, selectedTime, onDateSelect, onTimeSelect, onNext, onBack, tenantId = 'demo', staffId, serviceId }: DateTimeStepProps) {
    return (
        <div className="flex flex-col h-full overflow-hidden animate-fade-in-up" style={{ background: 'var(--cream)' }}>
            {/* STICKY HEADER */}
            <div className="flex-none bg-white/80 backdrop-blur-md border-b border-cream-dark/50 z-20">
                <div className="p-6">
                    <div className="flex items-center justify-between mb-6">
                        {onBack ? (
                            <button onClick={onBack} className="w-10 h-10 rounded-full bg-cream flex items-center justify-center text-nf-gray hover:text-pink transition-all border border-cream-dark/50 shadow-sm">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
                            </button>
                        ) : <div className="w-10" />}
                        
                        <div className="flex gap-1.5 bg-cream px-3 py-1.5 rounded-full border border-cream-dark/50">
                            {[1, 2, 3, 4, 5, 6].map((i) => (
                                <div key={i} className={`w-2 h-2 rounded-full transition-all duration-500 ${i === 3 ? 'bg-pink scale-125' : (i < 3 ? 'bg-pink/40' : 'bg-cream-dark opacity-40')}`} />
                            ))}
                        </div>
                        <div className="w-10" />
                    </div>
                    <p className="text-[10px] tracking-[0.25em] text-pink uppercase font-black mb-1">Paso 3: Disponibilidad</p>
                    <h1 className="font-serif text-3xl lg:text-4xl text-charcoal leading-tight">
                        Elige tu <span className="text-pink italic">momento</span>
                    </h1>
                </div>
            </div>

            {/* SCROLLABLE CONTENT */}
            <div className="flex-1 overflow-y-auto custom-scrollbar">
                {!selectedDate ? (
                    <div className="p-6 stagger-children">
                        <CalendarStep
                            selectedDate={selectedDate}
                            onSelect={onDateSelect}
                        />
                        <div className="mt-8 p-6 rounded-[2.5rem] bg-white border border-cream-dark/50 shadow-sm flex gap-4 items-center">
                            <div className="w-12 h-12 rounded-2xl bg-pink/5 flex items-center justify-center text-2xl">⏳</div>
                            <p className="text-[11px] text-nf-gray font-bold uppercase tracking-wider leading-relaxed">
                                Selecciona un día disponible para ver <span className="text-pink">horarios libres</span>.
                            </p>
                        </div>
                    </div>
                ) : (
                    <div className="animate-fade-in">
                        <TimeSlotStep
                            selectedDate={selectedDate}
                            selectedTime={selectedTime}
                            onSelect={onTimeSelect}
                            onNext={onNext}
                            onBack={() => onDateSelect('')}
                            tenantId={tenantId}
                            staffId={staffId}
                            serviceId={serviceId}
                        />
                    </div>
                )}
            </div>

            {/* STICKY PROGRESS INDICATOR (If no time selected yet, otherwise TimeSlotStep handles the CTA) */}
            {!selectedTime && (
                <div className="flex-none p-4 bg-white/50 backdrop-blur-sm border-t border-cream-dark/20 text-center">
                    <p className="text-[9px] tracking-[0.3em] text-nf-gray/40 uppercase font-black">
                        PROGRESO DE RESERVA: 50%
                    </p>
                </div>
            )}
        </div>
    );
}
