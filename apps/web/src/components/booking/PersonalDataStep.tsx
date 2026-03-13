'use client';

import { useState } from 'react';

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
        <div className="flex flex-col h-full overflow-hidden animate-fade-in-up" style={{ background: 'var(--cream)' }}>
            {/* STICKY HEADER AREA */}
            <div className="flex-none bg-white/80 backdrop-blur-md border-b border-cream-dark/50 z-20">
                <div className="p-6">
                    <div className="flex items-center justify-between mb-6">
                        <div className="w-10 h-10 rounded-full bg-pink/10 flex items-center justify-center text-pink">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                        </div>
                        <div className="flex gap-1.5 bg-cream px-3 py-1.5 rounded-full border border-cream-dark/50">
                            {[1, 2, 3, 4, 5, 6].map((i) => (
                                <div key={i} className={`w-2 h-2 rounded-full transition-all duration-500 ${i === 1 ? 'bg-pink scale-125' : 'bg-cream-dark opacity-40'}`} />
                            ))}
                        </div>
                    </div>
                    <p className="text-[10px] tracking-[0.25em] text-pink uppercase font-black mb-1">Paso 1: Identificación</p>
                    <h1 className="font-serif text-3xl lg:text-4xl text-charcoal leading-tight">
                        ¡Hola! <span className="text-pink italic">Bienvenida</span>
                    </h1>
                </div>
            </div>

            {/* SCROLLABLE FORM AREA */}
            <div className="flex-1 overflow-y-auto px-6 py-8 custom-scrollbar">
                <div className="max-w-md mx-auto">
                    {/* Staff Greeting */}
                    <div className="flex flex-col items-center mb-10 text-center">
                        <div className="relative mb-6">
                            <div className="w-28 h-28 rounded-[2.5rem] overflow-hidden shadow-2xl ring-4 ring-white relative z-10 rotate-3 hover:rotate-0 transition-transform duration-500">
                                {staffPhoto ? (
                                    <img src={staffPhoto} alt={staffName} className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-4xl font-bold text-white bg-gradient-to-br from-pink to-coral">
                                        {staffName[0]}
                                    </div>
                                )}
                            </div>
                            <div className="absolute -bottom-2 -right-2 w-10 h-10 rounded-full bg-white shadow-xl flex items-center justify-center z-20">
                                <span className="text-xl">✨</span>
                            </div>
                        </div>

                        <p className="text-sm font-bold text-nf-gray uppercase tracking-widest mb-1 italic">Soy {staffName}</p>
                        <p className="text-base text-charcoal-light leading-relaxed">
                            Encantada de conocerte. Necesito tus datos básicos para organizar tu cita.
                        </p>
                    </div>

                    {/* Form Fields */}
                    <div className="space-y-10 mb-12">
                        {/* Name */}
                        <div className="group relative">
                            <label className={`block text-[10px] tracking-[0.2em] uppercase font-black mb-2 transition-colors ${errors.name ? 'text-red-500' : 'text-nf-gray group-focus-within:text-pink'}`}>
                                Nombre Completo
                            </label>
                            <input
                                className="w-full bg-white border-2 border-cream-dark rounded-2xl px-6 py-4 text-charcoal placeholder-gray-light focus:outline-none focus:border-pink focus:ring-4 focus:ring-pink/10 transition-all text-base font-bold shadow-sm"
                                placeholder="Tu nombre y apellidos"
                                value={name}
                                onChange={e => onNameChange(e.target.value)}
                            />
                            {errors.name && <p className="text-[10px] font-bold text-red-500 mt-2 uppercase tracking-wider animate-fade-in px-2">{errors.name}</p>}
                        </div>

                        {/* WhatsApp */}
                        <div className="group relative">
                            <label className={`block text-[10px] tracking-[0.2em] uppercase font-black mb-2 transition-colors ${errors.phone ? 'text-red-500' : 'text-nf-gray group-focus-within:text-pink'}`}>
                                WhatsApp / Móvil
                            </label>
                            <div className="relative">
                                <input
                                    className="w-full bg-white border-2 border-cream-dark rounded-2xl px-6 py-4 text-charcoal placeholder-gray-light focus:outline-none focus:border-pink focus:ring-4 focus:ring-pink/10 transition-all text-base font-bold shadow-sm"
                                    placeholder="+00 000 000 000"
                                    type="tel"
                                    value={phone}
                                    onChange={e => onPhoneChange(e.target.value)}
                                />
                                <div className="absolute right-6 top-1/2 -translate-y-1/2 text-xl opacity-40">📱</div>
                            </div>
                            {errors.phone && <p className="text-[10px] font-bold text-red-500 mt-2 uppercase tracking-wider animate-fade-in px-2">{errors.phone}</p>}
                        </div>

                        {/* Email */}
                        <div className="group relative">
                            <label className="block text-[10px] tracking-[0.2em] uppercase font-black mb-2 text-nf-gray group-focus-within:text-pink">
                                Email <span className="opacity-30 font-bold normal-case font-body tracking-normal">(Opcional)</span>
                            </label>
                            <input
                                className="w-full bg-white border-2 border-cream-dark rounded-2xl px-6 py-4 text-charcoal placeholder-gray-light focus:outline-none focus:border-pink focus:ring-4 focus:ring-pink/10 transition-all text-base font-bold shadow-sm"
                                placeholder="tu@email.com"
                                type="email"
                                value={email}
                                onChange={e => onEmailChange(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="p-6 rounded-[2rem] bg-pink/5 border border-pink/10 flex gap-4 items-center">
                        <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-pink shadow-sm">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                        </div>
                        <p className="text-[11px] text-nf-gray font-bold uppercase tracking-wider leading-relaxed">
                            Tus datos están <span className="text-pink">100% protegidos</span> bajo cifrado SSL.
                        </p>
                    </div>
                </div>
            </div>

            {/* STICKY BOTTOM PANEL */}
            <div className="flex-none p-6 bg-white/90 backdrop-blur-xl border-t border-cream-dark/50 z-30 shadow-[0_-10px_40px_rgba(0,0,0,0.05)]">
                <div className="max-w-xl mx-auto">
                    <button
                        onClick={handleNext}
                        className="w-full py-5 rounded-[2rem] text-sm font-black uppercase tracking-[0.2em] flex items-center justify-center gap-4 shadow-2xl btn-gradient text-white transform hover:scale-[1.02] active:scale-[0.98] transition-all"
                    >
                        Continuar a Servicios
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="5" y1="12" x2="19" y2="12" />
                            <polyline points="12 5 19 12 12 19" />
                        </svg>
                    </button>
                </div>
            </div>
        </div>
    );
}
