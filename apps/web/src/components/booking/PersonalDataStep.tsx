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
    onBack: () => void;
}

export default function PersonalDataStep({
    name, phone, email,
    onNameChange, onPhoneChange, onEmailChange,
    onNext, onBack
}: PersonalDataStepProps) {
    const [errors, setErrors] = useState<Record<string, string>>({});

    const validate = () => {
        const errs: Record<string, string> = {};
        if (!name.trim()) errs.name = 'El nombre es requerido';
        if (!phone.trim()) errs.phone = 'El teléfono es requerido';
        else if (phone.replace(/\D/g, '').length < 10) errs.phone = 'Teléfono inválido';
        if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errs.email = 'Email inválido';
        setErrors(errs);
        return Object.keys(errs).length === 0;
    };

    const handleSubmit = () => {
        if (validate()) onNext();
    };

    return (
        <div className="flex flex-col h-full animate-fade-in-up">
            <div className="px-6 pt-4 pb-2">
                <button onClick={onBack} className="flex items-center gap-1 text-nf-gray text-sm mb-3 hover:text-charcoal transition-colors">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
                    Atrás
                </button>
                <h2 className="font-serif text-2xl font-semibold text-charcoal mb-1">Tus datos</h2>
                <p className="text-sm text-nf-gray">Necesitamos tu información de contacto</p>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
                {/* Name */}
                <div>
                    <label className="block text-sm font-medium text-charcoal mb-2">
                        Nombre completo <span className="text-pink">*</span>
                    </label>
                    <input
                        type="text"
                        value={name}
                        onChange={(e) => { onNameChange(e.target.value); setErrors(prev => ({ ...prev, name: '' })); }}
                        placeholder="Tu nombre"
                        className={`input-field ${errors.name ? 'border-red-400 focus:border-red-400 focus:ring-red-100' : ''}`}
                    />
                    {errors.name && <p className="text-xs text-red-500 mt-1.5">{errors.name}</p>}
                </div>

                {/* Phone */}
                <div>
                    <label className="block text-sm font-medium text-charcoal mb-2">
                        Teléfono <span className="text-pink">*</span>
                    </label>
                    <input
                        type="tel"
                        value={phone}
                        onChange={(e) => { onPhoneChange(e.target.value); setErrors(prev => ({ ...prev, phone: '' })); }}
                        placeholder="+52 55 1234 5678"
                        className={`input-field ${errors.phone ? 'border-red-400 focus:border-red-400 focus:ring-red-100' : ''}`}
                    />
                    {errors.phone && <p className="text-xs text-red-500 mt-1.5">{errors.phone}</p>}
                </div>

                {/* Email */}
                <div>
                    <label className="block text-sm font-medium text-charcoal mb-2">
                        Email <span className="text-nf-gray text-xs">(opcional)</span>
                    </label>
                    <input
                        type="email"
                        value={email}
                        onChange={(e) => { onEmailChange(e.target.value); setErrors(prev => ({ ...prev, email: '' })); }}
                        placeholder="tu@email.com"
                        className={`input-field ${errors.email ? 'border-red-400 focus:border-red-400 focus:ring-red-100' : ''}`}
                    />
                    {errors.email && <p className="text-xs text-red-500 mt-1.5">{errors.email}</p>}
                </div>

                {/* Privacy note */}
                <div className="bg-cream-dark/50 rounded-xl p-4 mt-2">
                    <p className="text-xs text-nf-gray leading-relaxed">
                        🔒 Tu información está protegida y solo será utilizada para gestionar tu cita y enviarte recordatorios por WhatsApp.
                    </p>
                </div>
            </div>

            <div className="p-6">
                <button onClick={handleSubmit} className="btn-gradient w-full py-4 rounded-2xl text-base">
                    Continuar
                </button>
            </div>
        </div>
    );
}
