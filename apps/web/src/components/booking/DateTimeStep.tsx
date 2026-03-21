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
    totalDuration?: number;
}

export default function DateTimeStep({ selectedDate, selectedTime, onDateSelect, onTimeSelect, onNext, onBack, tenantId = 'demo', staffId, serviceId, totalDuration }: DateTimeStepProps) {
    return (
        <div className="flex flex-col h-full relative" style={{ background: 'var(--cream)' }}>
            {/* Header: Sticky at the top */}
            <div className="bg-white/80 backdrop-blur-md sticky top-0 z-30 border-b border-cream-dark/30 shadow-sm">
                <div className="flex items-center justify-between px-6 pt-6 pb-2">
                    {onBack && (
                        <button onClick={onBack} className="flex items-center gap-2 text-nf-gray text-xs font-bold uppercase tracking-widest hover:text-pink transition-colors group">
                            <div className="w-8 h-8 rounded-full bg-white shadow-sm flex items-center justify-center group-hover:bg-pink-pale transition-colors">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
                            </div>
                        </button>
                    )}
                    <div className="flex gap-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-pink opacity-40" />
                        <div className="w-1.5 h-1.5 rounded-full bg-pink opacity-40" />
                        <div className="w-1.5 h-1.5 rounded-full bg-pink" />
                        <div className="w-1.5 h-1.5 rounded-full bg-cream-dark opacity-30" />
                        <div className="w-1.5 h-1.5 rounded-full bg-cream-dark opacity-30" />
                        <div className="w-1.5 h-1.5 rounded-full bg-cream-dark opacity-30" />
                    </div>
                </div>

                <div className="px-6 pt-4 pb-4">
                    <p className="text-[10px] tracking-[0.2em] text-nf-gray uppercase font-bold mb-1">Paso 3: Disponibilidad</p>
                    <h1 className="font-serif text-3xl text-charcoal leading-tight">
                        Elige tu <span className="text-pink">momento</span>
                    </h1>
                </div>
            </div>

            {/* Scrollable content areas */}
            <div className="flex-1 overflow-y-auto no-scrollbar scroll-smooth">
                <div className="px-6 py-6 pb-24">
                    {!selectedDate ? (
                        <div className="stagger-children">
                            <CalendarStep
                                selectedDate={selectedDate}
                                onSelect={onDateSelect}
                                tenantId={tenantId}
                            />
                            <div className="mt-8 p-6 rounded-[2rem] bg-pink-pale/30 border border-pink-light/20 flex gap-4 items-start">
                                <span className="text-2xl">⏳</span>
                                <p className="text-[11px] text-nf-gray leading-relaxed font-medium uppercase tracking-wider">
                                    Selecciona un día disponible para ver los horarios que tenemos preparados para ti.
                                </p>
                            </div>
                        </div>
                    ) : (
                        <div className="-mx-6">
                            <TimeSlotStep
                                selectedDate={selectedDate}
                                selectedTime={selectedTime}
                                onSelect={onTimeSelect}
                                onNext={onNext}
                                onBack={() => onDateSelect('')}
                                tenantId={tenantId}
                                staffId={staffId}
                                serviceId={serviceId}
                                totalDuration={totalDuration}
                            />
                        </div>
                    )}
                </div>
            </div>

            {/* CTA: Sticky at the bottom */}
            <div className={`sticky bottom-0 left-0 right-0 p-8 bg-white/80 backdrop-blur-xl border-t border-cream-dark/50 z-40 transition-all duration-500 ${selectedTime ? 'translate-y-0 opacity-100 shadow-up' : 'translate-y-full opacity-0 pointer-events-none'}`}>
                <button
                    onClick={onNext}
                    className="w-full max-w-lg mx-auto py-5 rounded-full text-base font-serif flex items-center justify-center gap-2 transition-all duration-300 shadow-lg hover:shadow-xl btn-gradient text-white"
                >
                    Confirmar para las {selectedTime} HS
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="5" y1="12" x2="19" y2="12" />
                        <polyline points="12 5 19 12 12 19" />
                    </svg>
                </button>
            </div>
        </div>
    );
}
