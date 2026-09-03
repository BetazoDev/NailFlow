'use client';

import { useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import type { CreateBookingRequest, PaymentMethod } from '@/lib/types';
import { useBooking } from './BookingContext';

/**
 * Payment step.
 *
 * Only methods the backend can actually process are offered. The previous
 * version listed Apple Pay, Google Pay, Stripe, PayPal and card — none of which
 * were implemented — so a client who chose "Tarjeta" was never charged and the
 * appointment was confirmed as if they had paid.
 */
interface MethodOption {
    id: PaymentMethod;
    label: string;
    icon: string;
    description: string;
    /** Whether choosing this leaves the site for a payment provider. */
    redirects: boolean;
}

/** Set at build time; mirrors the API's `ALLOW_TEST_BOOKINGS`. */
const TEST_BOOKINGS_ENABLED = process.env.NEXT_PUBLIC_ALLOW_TEST_BOOKINGS === 'true';

export default function PaymentStep() {
    const { draft, totals, goBack, confirmBooking, setPaymentMethod } = useBooking();

    const deposit = totals.requiredAdvance;

    const options: MethodOption[] = [
        ...(deposit > 0
            ? [
                  {
                      id: 'mercado' as const,
                      label: 'Mercado Pago',
                      icon: 'credit_card',
                      description: `Paga ahora el anticipo de $${deposit.toFixed(2)} y deja tu cita confirmada al instante.`,
                      redirects: true,
                  },
              ]
            : []),
        {
            id: 'cash' as const,
            label: 'Pago en el salón',
            icon: 'storefront',
            description: deposit > 0
                ? 'Reserva ahora y paga el total el día de tu cita. Tu lugar queda apartado.'
                : 'Este servicio no requiere anticipo. Pagas el día de tu cita.',
            redirects: false,
        },
        ...(TEST_BOOKINGS_ENABLED
            ? [
                  {
                      id: 'test' as const,
                      label: 'Modo prueba',
                      icon: 'science',
                      description: 'Solo para demostraciones: confirma la cita sin cobrar nada.',
                      redirects: false,
                  },
              ]
            : []),
    ];

    const [method, setMethod] = useState<PaymentMethod>(options[0]?.id ?? 'cash');
    const [status, setStatus] = useState<'idle' | 'submitting' | 'redirecting'>('idle');
    const [error, setError] = useState<string | null>(null);

    const selected = options.find(option => option.id === method);
    const busy = status !== 'idle';

    const handleSubmit = async () => {
        if (!draft.date || !draft.time || draft.services.length === 0) {
            setError('Falta información de la reserva. Vuelve atrás y revisa los pasos.');
            return;
        }

        setStatus('submitting');
        setError(null);
        setPaymentMethod(method);

        // The server recomputes price and duration from these ids, so nothing
        // the browser sends can change what the client is charged.
        const payload: CreateBookingRequest = {
            service_ids: draft.services.map(service => service.id),
            staff_id: draft.staffId,
            date: draft.date,
            time: draft.time,
            client_name: draft.clientName.trim(),
            client_phone: draft.clientPhone.trim(),
            client_email: draft.clientEmail.trim() || undefined,
            notes: draft.notes?.trim() || undefined,
            image_urls: draft.imageUrls.length ? draft.imageUrls : undefined,
            payment_method: method,
        };

        try {
            const result =
                method === 'test'
                    ? await api.createTestBooking(payload)
                    : await api.createBooking(payload);

            if (result.init_point) {
                setStatus('redirecting');
                window.location.href = result.init_point;
                return;
            }

            confirmBooking(result.appointmentId);
        } catch (caught) {
            const message =
                caught instanceof ApiError
                    ? caught.message
                    : 'No pudimos procesar tu reserva. Intenta de nuevo.';
            setError(message);
            setStatus('idle');
        }
    };

    return (
        <div className="flex h-full flex-col bg-surface">
            <header className="sticky top-0 z-30 border-b border-line bg-surface-raised/80 backdrop-blur-md">
                <div className="flex items-center justify-between px-6 pb-2 pt-6">
                    <button
                        onClick={goBack}
                        disabled={busy}
                        aria-label="Volver al resumen"
                        className="grid size-8 place-items-center rounded-full bg-surface-raised text-text-muted shadow-soft transition-colors hover:text-brand disabled:opacity-40"
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
                            <path d="M15 18l-6-6 6-6" />
                        </svg>
                    </button>
                </div>
                <div className="px-6 pb-4 pt-2">
                    <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.2em] text-text-muted">
                        Paso 6 · Pago
                    </p>
                    <h1 className="font-display text-3xl leading-tight text-text-strong">
                        ¿Cómo prefieres <span className="text-brand">reservar</span>?
                    </h1>
                </div>
            </header>

            <div className="no-scrollbar flex-1 overflow-y-auto px-6 py-8">
                <div className="mb-8 text-center">
                    <p className="mb-2 text-[11px] uppercase tracking-[0.15em] text-text-muted">
                        {draft.services.map(service => service.name).join(' · ')}
                    </p>
                    <p className="font-display text-5xl text-text-strong">${totals.price.toFixed(2)}</p>
                    {deposit > 0 && (
                        <p className="mt-2 text-sm text-text-muted">
                            Anticipo para apartar: <strong className="text-brand">${deposit.toFixed(2)}</strong>
                        </p>
                    )}
                </div>

                <fieldset className="mb-8" disabled={busy}>
                    <legend className="mb-3 text-[11px] font-bold uppercase tracking-[0.15em] text-text-muted">
                        Método de pago
                    </legend>
                    <div className="flex flex-col gap-3">
                        {options.map(option => {
                            const active = method === option.id;
                            return (
                                <label
                                    key={option.id}
                                    className={`flex cursor-pointer items-start gap-4 rounded-3xl border-2 bg-surface-raised p-5 transition-all ${
                                        active ? 'border-brand shadow-soft' : 'border-transparent opacity-70 hover:opacity-100'
                                    }`}
                                >
                                    <input
                                        type="radio"
                                        name="payment-method"
                                        value={option.id}
                                        checked={active}
                                        onChange={() => setMethod(option.id)}
                                        className="sr-only"
                                    />
                                    <span
                                        className={`material-symbol mt-0.5 text-2xl ${active ? 'text-brand' : 'text-text-subtle'}`}
                                        aria-hidden="true"
                                    >
                                        {option.icon}
                                    </span>
                                    <span className="min-w-0">
                                        <span className="block text-sm font-bold text-text-strong">{option.label}</span>
                                        <span className="mt-1 block text-xs leading-relaxed text-text-muted">
                                            {option.description}
                                        </span>
                                    </span>
                                </label>
                            );
                        })}
                    </div>
                </fieldset>

                {error && (
                    <p role="alert" className="mb-4 rounded-2xl border border-danger/30 bg-danger/10 p-4 text-sm text-danger">
                        {error}
                    </p>
                )}
            </div>

            <div className="sticky bottom-0 border-t border-line bg-surface-raised/90 p-6 backdrop-blur-xl">
                <Button
                    onClick={handleSubmit}
                    isLoading={busy}
                    loadingLabel={status === 'redirecting' ? 'Redirigiendo…' : 'Reservando…'}
                    size="lg"
                    className="h-16 w-full"
                >
                    {selected?.redirects ? 'Pagar y confirmar' : 'Confirmar reserva'}
                </Button>
                <p className="mt-4 text-center text-[10px] font-bold uppercase tracking-[0.18em] text-text-subtle">
                    {selected?.redirects ? 'Pago protegido por Mercado Pago' : 'Sin cargos ahora'}
                </p>
            </div>
        </div>
    );
}
