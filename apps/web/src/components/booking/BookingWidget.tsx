'use client';

import { Tenant, BookingStep } from '@/lib/types';
import BookingWizard from './BookingWizard';
import { api } from '@/lib/api';
import SplashScreen from '@/components/SplashScreen';
import { useState } from 'react';

interface Props {
    tenant: Tenant;
    /** When provided, skips the splash and pre-selects a staff member */
    staffId?: string;
    staffName?: string;
    staffPhoto?: string;
    /** Skip splash screen for staff-specific booking pages */
    skipSplash?: boolean;
}

const STEPS: { id: BookingStep; label: string; desc: string }[] = [
    { id: 'personal', label: 'Tus datos', desc: 'Nombre y contacto' },
    { id: 'service', label: 'Servicio', desc: 'Elige tu tratamiento' },
    { id: 'datetime', label: 'Fecha y hora', desc: 'Encuentra tu turno' },
    { id: 'inspiration', label: 'Inspiración', desc: 'Sube referencias' },
    { id: 'summary', label: 'Resumen', desc: 'Confirma tu reserva' },
    { id: 'payment', label: 'Pago', desc: 'Anticipo seguro' },
    { id: 'confirmation', label: 'Confirmación', desc: '¡Todo listo!' },
];

export default function BookingWidget({ tenant, staffId, staffName, staffPhoto, skipSplash = false }: Props) {
    const [splashDone, setSplashDone] = useState(skipSplash);
    const [currentStep, setCurrentStep] = useState<BookingStep>('personal');

    const salonName =
        tenant.name ||
        tenant.domain.split('.')[0].charAt(0).toUpperCase() +
        tenant.domain.split('.')[0].slice(1) +
        ' Nails Studio';

    const currentIndex = STEPS.findIndex(s => s.id === currentStep);

    if (!splashDone) {
        return (
            <SplashScreen
                salonName={salonName}
                tagline={tenant.branding.tagline}
                logoUrl={tenant.branding.logo_url ? api.getPublicUrl(tenant.branding.logo_url) : undefined}
                onFinish={() => setSplashDone(true)}
            />
        );
    }

    return (
        <div className="min-h-screen w-full flex" style={{ background: 'var(--cream)' }}>
            {/* ─── LEFT PANEL — desktop only ─────────────────── */}
            <aside
                className="hidden lg:flex flex-col flex-shrink-0 w-80 xl:w-96 h-screen sticky top-0"
                style={{
                    background: 'linear-gradient(160deg, var(--charcoal) 0%, #3a2e2e 100%)',
                }}
            >
                {/* Scrollable area for Logo + Steps */}
                <div className="flex-1 overflow-y-auto px-10 pt-10 pb-5 no-scrollbar">
                    {/* Top: Logo + name */}
                    <div>
                        <div className="flex items-center gap-3 mb-10">
                            <div
                                className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-lg overflow-hidden"
                                style={{ background: 'var(--pink)' }}
                            >
                                {tenant.branding.logo_url ? (
                                    <img src={api.getPublicUrl(tenant.branding.logo_url)} className="w-full h-full object-cover" alt="Logo" />
                                ) : (
                                    <span className="font-serif text-xl text-white font-bold">{salonName.charAt(0)}</span>
                                )}
                            </div>
                            <div>
                                <p className="font-serif text-white text-base font-semibold leading-tight">{salonName}</p>
                                <p className="text-white/40 text-[11px] tracking-[0.15em] uppercase mt-0.5">Nail Studio</p>
                            </div>
                        </div>

                        {/* Staff or Business profile photo */}
                        <div className="mb-8 flex items-center gap-3 px-4 py-3 bg-white/5 rounded-2xl border border-white/10">
                            <div className="size-10 rounded-full overflow-hidden border border-white/20 flex-shrink-0 bg-white/10">
                                {staffPhoto ? (
                                    <img src={api.getPublicUrl(staffPhoto)} alt={staffName} className="w-full h-full object-cover" />
                                ) : tenant.branding.photo_url ? (
                                    <img src={api.getPublicUrl(tenant.branding.photo_url)} alt="Business" className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-xs font-serif text-white/60">
                                        {staffName ? staffName.charAt(0).toUpperCase() : salonName.charAt(0)}
                                    </div>
                                )}
                            </div>
                            <div>
                                <p className="text-white/40 text-[9px] tracking-[0.2em] uppercase mb-0.5">
                                    {staffName ? 'Tu especialista' : 'Tu salón'}
                                </p>
                                <p className="text-white text-sm font-medium capitalize truncate max-w-[150px]">
                                    {staffName || salonName}
                                </p>
                            </div>
                        </div>

                        {/* Step indicators */}
                        <p className="text-[10px] tracking-[0.2em] text-white/30 uppercase font-semibold mb-5">
                            Tu reserva
                        </p>

                        <div className="space-y-1">
                            {STEPS.filter(s => s.id !== 'confirmation').map((step, i) => {
                                const isActive = step.id === currentStep;
                                const isCompleted = currentIndex > i;

                                return (
                                    <div
                                        key={step.id}
                                        className={`flex items-center gap-3 px-4 py-3 rounded-2xl transition-all duration-300 ${isActive ? 'bg-white/10' : ''
                                            }`}
                                    >
                                        {/* Bubble */}
                                        <div
                                            className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-[11px] font-bold transition-all duration-300 ${isCompleted
                                                ? 'bg-pink text-white'
                                                : isActive
                                                    ? 'bg-white text-charcoal'
                                                    : 'bg-white/10 text-white/30'
                                                }`}
                                        >
                                            {isCompleted ? (
                                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round"><path d="M20 6L9 17l-5-5" /></svg>
                                            ) : (
                                                i + 1
                                            )}
                                        </div>

                                        {/* Labels */}
                                        <div className="min-w-0">
                                            <p className={`text-sm font-medium leading-tight transition-colors ${isActive ? 'text-white' : isCompleted ? 'text-white/60' : 'text-white/25'}`}>
                                                {step.label}
                                            </p>
                                            {isActive && (
                                                <p className="text-[11px] text-white/40 leading-tight mt-0.5">{step.desc}</p>
                                            )}
                                        </div>

                                        {/* Active dot */}
                                        {isActive && (
                                            <div className="ml-auto w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: 'var(--pink)' }} />
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* Bottom: Trust badge (FIXED bottom) */}
                <div className="mt-auto px-10 py-8 border-t border-white/10 bg-inherit">
                    <div className="flex items-center gap-2 text-white/30">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
                        <span className="text-[11px] tracking-[0.12em] uppercase">Reserva 100% segura</span>
                    </div>
                    <p className="text-white/15 text-[10px] mt-1 italic">Protegido con cifrado SSL bancario</p>
                </div>
            </aside>

            {/* ─── RIGHT PANEL — booking wizard ──────────────── */}
            <main className="flex-1 h-screen overflow-hidden flex flex-col" style={{ background: 'var(--cream)' }}>
                {/* The wizard — each step manages its own scroll */}
                <div className="flex-1 overflow-hidden">
                    <BookingWizard
                        tenantId={tenant.id}
                        staffId={staffId}
                        staffName={staffName}
                        staffPhoto={staffPhoto}
                        salonName={salonName}
                        onStepChange={setCurrentStep}
                    />
                </div>
            </main>
        </div>
    );
}
