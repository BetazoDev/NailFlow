'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { applyBranding } from '@/lib/theme';
import type { BookingStep, Tenant } from '@/lib/types';
import SplashScreen from '@/components/SplashScreen';
import BookingWizard from './BookingWizard';
import { SalonPresence } from './SalonPresence';
import { BOOKING_STEPS } from './BookingContext';

interface Props {
    tenant: Tenant;
    staffId: string;
    staffName: string;
    staffPhoto?: string;
    /** Personal booking links go straight to the wizard. */
    skipSplash?: boolean;
}

const STEP_LABELS: Record<BookingStep, { label: string; description: string }> = {
    personal: { label: 'Tus datos', description: 'Nombre y contacto' },
    service: { label: 'Servicio', description: 'Elige tu tratamiento' },
    datetime: { label: 'Fecha y hora', description: 'Encuentra tu turno' },
    inspiration: { label: 'Inspiración', description: 'Sube referencias' },
    summary: { label: 'Resumen', description: 'Revisa tu reserva' },
    payment: { label: 'Pago', description: 'Aparta tu lugar' },
    confirmation: { label: 'Confirmación', description: '¡Todo listo!' },
};

/** Steps shown in the rail; the confirmation is an outcome, not a task. */
const RAIL_STEPS: BookingStep[] = BOOKING_STEPS.filter(step => step !== 'confirmation');

export default function BookingWidget({ tenant, staffId, staffName, staffPhoto, skipSplash = false }: Props) {
    const [splashDone, setSplashDone] = useState(skipSplash);
    const [currentStep, setCurrentStep] = useState<BookingStep>('personal');

    // The salon's palette is applied before the wizard renders, so the booking
    // flow is themed exactly like the rest of the product.
    useEffect(() => applyBranding(tenant.branding), [tenant.branding]);

    const salonName = tenant.name?.trim() || tenant.domain.split('.')[0];
    const logo = api.getImageUrl(tenant.branding?.logo_url);
    const currentIndex = RAIL_STEPS.indexOf(currentStep);

    if (!splashDone) {
        return (
            <SplashScreen
                salonName={salonName}
                tagline={tenant.branding?.tagline}
                logoUrl={logo || undefined}
                onFinish={() => setSplashDone(true)}
            />
        );
    }

    return (
        <div className="flex min-h-dvh w-full bg-surface">
            <aside
                className="sticky top-0 hidden h-dvh w-80 shrink-0 flex-col lg:flex xl:w-96"
                style={{ background: 'linear-gradient(160deg, var(--text-strong) 0%, #3a2e2e 100%)' }}
            >
                <div className="no-scrollbar flex-1 overflow-y-auto px-10 pb-5 pt-10">
                    <div className="mb-10 flex items-center gap-3">
                        <div className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-2xl bg-brand shadow-lg">
                            {logo ? (
                                <img src={logo} alt="" className="size-full object-cover" />
                            ) : (
                                <span className="font-display text-xl font-bold text-white">
                                    {salonName.charAt(0).toUpperCase()}
                                </span>
                            )}
                        </div>
                        <div className="min-w-0">
                            <p className="truncate font-display text-base font-semibold leading-tight text-white">
                                {salonName}
                            </p>
                            <p className="mt-0.5 text-[11px] uppercase tracking-[0.15em] text-white/40">
                                Nail Studio
                            </p>
                        </div>
                    </div>

                    <div className="mb-8 flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                        <div className="size-10 shrink-0 overflow-hidden rounded-full border border-white/20 bg-white/10">
                            {staffPhoto ? (
                                <img src={api.getImageUrl(staffPhoto)} alt="" className="size-full object-cover" />
                            ) : (
                                <span className="grid size-full place-items-center font-display text-xs text-white/60">
                                    {staffName.charAt(0).toUpperCase()}
                                </span>
                            )}
                        </div>
                        <div className="min-w-0">
                            <p className="mb-0.5 text-[9px] uppercase tracking-[0.2em] text-white/40">
                                Tu especialista
                            </p>
                            <p className="truncate text-sm font-medium text-white">{staffName}</p>
                        </div>
                    </div>

                    <SalonPresence
                        description={tenant.settings?.description}
                        social={tenant.settings?.social}
                    />

                    <p className="mb-5 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/30">
                        Tu reserva
                    </p>

                    <ol className="space-y-1">
                        {RAIL_STEPS.map((step, index) => {
                            const active = step === currentStep;
                            const done = currentIndex > index;
                            const { label, description } = STEP_LABELS[step];

                            return (
                                <li
                                    key={step}
                                    aria-current={active ? 'step' : undefined}
                                    className={`flex items-center gap-3 rounded-2xl px-4 py-3 transition-colors ${active ? 'bg-white/10' : ''}`}
                                >
                                    <span
                                        aria-hidden="true"
                                        className={`grid size-7 shrink-0 place-items-center rounded-full text-[11px] font-bold ${
                                            done
                                                ? 'bg-brand text-white'
                                                : active
                                                  ? 'bg-white text-text-strong'
                                                  : 'bg-white/10 text-white/30'
                                        }`}
                                    >
                                        {done ? '✓' : index + 1}
                                    </span>
                                    <span className="min-w-0">
                                        <span
                                            className={`block text-sm font-medium leading-tight ${
                                                active ? 'text-white' : done ? 'text-white/60' : 'text-white/25'
                                            }`}
                                        >
                                            {label}
                                        </span>
                                        {active && (
                                            <span className="mt-0.5 block text-[11px] leading-tight text-white/40">
                                                {description}
                                            </span>
                                        )}
                                    </span>
                                </li>
                            );
                        })}
                    </ol>
                </div>

                <div className="mt-auto border-t border-white/10 px-10 py-8">
                    <p className="flex items-center gap-2 text-[11px] uppercase tracking-[0.12em] text-white/30">
                        <span className="material-symbol text-sm" aria-hidden="true">lock</span>
                        Reserva segura
                    </p>
                </div>
            </aside>

            <main className="flex h-dvh flex-1 flex-col overflow-hidden">
                <BookingWizard
                    staffId={staffId}
                    staffName={staffName}
                    staffPhoto={staffPhoto}
                    salonName={salonName}
                    onStepChange={setCurrentStep}
                />
            </main>
        </div>
    );
}
