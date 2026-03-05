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
}

export default function DateTimeStep({ selectedDate, selectedTime, onDateSelect, onTimeSelect, onNext, onBack, tenantId = 'demo' }: DateTimeStepProps) {
    return (
        <div className="flex flex-col min-h-full animate-fade-in-up" style={{ background: 'var(--cream)' }}>
            {/* Header */}
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

            <div className="px-6 pt-4 pb-2">
                <p className="text-[10px] tracking-[0.2em] text-nf-gray uppercase font-bold mb-1">Paso 3: Disponibilidad</p>
                <h1 className="font-serif text-3xl text-charcoal leading-tight">
                    Elige tu <span className="text-pink">momento</span>
                </h1>
                <div className="w-8 h-px bg-pink mt-3" />
            </div>

            {/* Calendar */}
            <div className="px-6 py-6 overflow-y-auto flex-1">
                {!selectedDate ? (
                    <div className="stagger-children">
                        <CalendarStep
                            selectedDate={selectedDate}
                            onSelect={onDateSelect}
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
                        />
                    </div>
                )}
            </div>

            {/* Progress counter */}
            <div className="px-6 pb-12 pt-4">
                <p className="text-center text-[10px] tracking-[0.2em] text-gray-light uppercase font-bold">
                    PASO 3 DE 5
                </p>
            </div>
        </div>
    );
}
