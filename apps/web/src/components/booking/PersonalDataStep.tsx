'use client';

import { useState } from 'react';
import { api } from '@/lib/api';

interface PersonalDataStepProps {
    name: string;
    phone: string;
    email: string;
    onNameChange: (v: string) => void;
    onPhoneChange: (v: string) => void;
    onEmailChange: (v: string) => void;
    onNext: () => void;
    staffName?: string;
    staffPhoto?: string;
}

export default function PersonalDataStep({
    name, phone, email,
    onNameChange, onPhoneChange, onEmailChange, onNext,
    staffName = 'Ana', staffPhoto,
}: PersonalDataStepProps) {
    const [errors, setErrors] = useState<Record<string, string>>({});

    const validate = () => {
        const errs: Record<string, string> = {};
        if (!name.trim()) errs.name = 'Por favor dinos tu nombre';
        if (!phone.trim()) errs.phone = 'Necesitamos un teléfono para avisarte';
        return errs;
    };

    const handleNext = () => {
        const errs = validate();
        if (Object.keys(errs).length > 0) { setErrors(errs); return; }
        setErrors({});
        onNext();
    };

    return (
        <div className="flex flex-col h-full relative" style={{ background: 'var(--cream)' }}>
            {/* Header: Sticky at the top */}
            <div className="bg-white/80 backdrop-blur-md sticky top-0 z-30 border-b border-cream-dark/30 shadow-sm">
                <div className="flex items-center justify-between px-6 pt-6 pb-2">
                    <span className="text-[10px] tracking-[0.2em] text-nf-gray uppercase font-bold">Paso 1: Identificación</span>
                    <div className="flex gap-1.5">
                        <div className="w-2 h-2 rounded-full bg-pink" />
                        {[...Array(6)].map((_, i) => (
                            <div key={i} className="w-2 h-2 rounded-full bg-cream-dark opacity-30" />
                        ))}
                    </div>
                </div>
            </div>

            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto no-scrollbar scroll-smooth">
                {/* Staff Header */}
                <div className="flex flex-col items-center pt-10 pb-8 px-6 text-center">
                    <div className="relative mb-6">
                        <div className="w-24 h-24 rounded-full overflow-hidden shadow-xl ring-4 ring-white relative z-10">
                            {staffPhoto ? (
                                <img src={api.getPublicUrl(staffPhoto)} alt={staffName} className="w-full h-full object-cover" />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center text-3xl font-bold text-white bg-gradient-to-br from-pink to-coral">
                                    {staffName[0]}
                                </div>
                            )}
                        </div>
                        <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-white shadow-md flex items-center justify-center z-20">
                            <span className="text-lg">👋</span>
                        </div>
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 bg-pink-pale rounded-full blur-2xl opacity-60" />
                    </div>

                    <h1 className="font-serif text-3xl text-charcoal mb-2 leading-tight">
                        ¡Hola! Soy <span className="text-pink italic">{staffName}</span>
                    </h1>
                    <p className="text-sm text-nf-gray max-w-[240px]">
                        Encantada de conocerte. Necesito unos pocos datos para organizar tu cita.
                    </p>
                </div>

                {/* Form */}
                <div className="px-8 pb-10">
                    <div className="space-y-8">
                        {/* Name */}
                        <div className="group">
                            <label className={`block text-[11px] tracking-widest uppercase font-bold mb-1 transition-colors ${errors.name ? 'text-red-400' : 'text-nf-gray group-focus-within:text-pink'}`}>
                                Tu Nombre Completo
                            </label>
                            <input
                                className="w-full bg-transparent border-0 border-b-2 border-cream-dark py-3 text-charcoal placeholder-gray-light focus:outline-none focus:border-pink transition-all text-lg font-medium"
                                placeholder="Ej. Sofía Martínez"
                                value={name}
                                onChange={e => onNameChange(e.target.value)}
                            />
                            {errors.name && <p className="text-[10px] font-bold text-red-400 mt-2 uppercase tracking-wider animate-fade-in">{errors.name}</p>}
                        </div>

                        {/* WhatsApp */}
                        <div className="group">
                            <label className={`block text-[11px] tracking-widest uppercase font-bold mb-1 transition-colors ${errors.phone ? 'text-red-400' : 'text-nf-gray group-focus-within:text-pink'}`}>
                                WhatsApp / Teléfono
                            </label>
                            <div className="relative">
                                <input
                                    className="w-full bg-transparent border-0 border-b-2 border-cream-dark py-3 text-charcoal placeholder-gray-light focus:outline-none focus:border-pink transition-all text-lg font-medium"
                                    placeholder="+34 000 000 000"
                                    type="tel"
                                    value={phone}
                                    onChange={e => onPhoneChange(e.target.value)}
                                />
                                <div className="absolute right-0 top-1/2 -translate-y-1/2 text-2xl opacity-20">📱</div>
                            </div>
                            {errors.phone && <p className="text-[10px] font-bold text-red-400 mt-2 uppercase tracking-wider animate-fade-in">{errors.phone}</p>}
                        </div>

                        {/* Email */}
                        <div className="group">
                            <label className="block text-[11px] tracking-widest uppercase font-bold mb-1 text-nf-gray group-focus-within:text-pink">
                                Correo Electrónico <span className="opacity-40 font-normal normal-case">(Opcional)</span>
                            </label>
                            <input
                                className="w-full bg-transparent border-0 border-b-2 border-cream-dark py-3 text-charcoal placeholder-gray-light focus:outline-none focus:border-pink transition-all text-lg font-medium"
                                placeholder="hola@ejemplo.com"
                                type="email"
                                value={email}
                                onChange={e => onEmailChange(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="mt-10 p-4 rounded-2xl bg-pink-pale/30 border border-pink-light/20 flex gap-3 items-start">
                        <span className="text-lg">🔒</span>
                        <p className="text-[11px] text-nf-gray leading-relaxed">
                            Tus datos están protegidos. Solo los usaremos para confirmar tu cita.
                        </p>
                    </div>
                </div>
            </div>

            {/* CTA: Sticky at the bottom */}
            <div className="sticky bottom-0 left-0 right-0 p-8 bg-white/80 backdrop-blur-xl border-t border-cream-dark/50 z-40 transition-all duration-300">
                <button
                    onClick={handleNext}
                    className="w-full max-w-lg mx-auto py-5 rounded-full text-base font-serif flex items-center justify-center gap-2 transition-all duration-300 shadow-lg hover:shadow-xl btn-gradient text-white hover:scale-[1.02] active:scale-[0.98]"
                >
                    Continuar a Servicios
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="5" y1="12" x2="19" y2="12" />
                        <polyline points="12 5 19 12 12 19" />
                    </svg>
                </button>
            </div>
        </div>
    );
}
