'use client';

import { BookingData } from '@/lib/types';
import { useState } from 'react';
import { api } from '@/lib/api';

interface PaymentStepProps {
    booking: BookingData;
    onNext: () => void;
    onBack: () => void;
}

type PaymentMethod = 'card' | 'apple' | 'mercado' | 'prueba' | 'stripe' | 'paypal' | 'google';

export default function PaymentStep({ booking, onNext, onBack }: PaymentStepProps) {
    const [method, setMethod] = useState<PaymentMethod>('card');
    const [cardName, setCardName] = useState('');
    const [cardNumber, setCardNumber] = useState('');
    const [expiry, setExpiry] = useState('');
    const [cvc, setCvc] = useState('');
    const [loading, setLoading] = useState(false);

    const advance = Math.round(booking.service_price * 0.4);

    const formatCard = (v: string) => v.replace(/\D/g, '').replace(/(.{4})/g, '$1 ').trim().slice(0, 19);
    const formatExpiry = (v: string) => {
        const n = v.replace(/\D/g, '');
        if (n.length >= 2) return n.slice(0, 2) + '/' + n.slice(2, 4);
        return n;
    };

    const [error, setError] = useState<string | null>(null);

    const handlePayment = async () => {
        setLoading(true);
        setError(null);
        try {
            if (method === 'prueba') {
                // Test mode: create appointment directly without payment gateway
                await api.createBookingTest(booking);
                setTimeout(() => {
                    setLoading(false);
                    onNext();
                }, 600);
            } else if (method === 'card' || method === 'apple' || method === 'mercado' || method === 'stripe' || method === 'paypal' || method === 'google') {
                // For real or placeholder payment methods, create booking and redirect
                const bookingWithMethod = { ...booking, payment_method: method };
                const result = await api.createBooking(bookingWithMethod as any);
                if (result.init_point) {
                    window.location.href = result.init_point;
                } else {
                    // Fallback for methods that don't have a redirect yet
                    setTimeout(() => {
                        setLoading(false);
                        onNext();
                    }, 1000);
                }
            }
        } catch (e: any) {
            console.error('Error creating booking:', e);
            setError(e.message || 'Error al procesar la reserva. Por favor intenta de nuevo.');
            setLoading(false);
        }
    };

    const methods: { id: PaymentMethod; label: string; icon: string }[] = [
        { id: 'prueba', label: 'PRUEBA', icon: 'test_confirmation' },
        { id: 'card', label: 'TARJETA', icon: 'credit_card' },
        { id: 'apple', label: 'APPLE PAY', icon: 'apple' },
        { id: 'google', label: 'GOOGLE PAY', icon: 'google' },
        { id: 'stripe', label: 'STRIPE', icon: 'payments' },
        { id: 'paypal', label: 'PAYPAL', icon: 'account_balance_wallet' },
        { id: 'mercado', label: 'MERCADO', icon: 'storefront' },
    ];

    return (
        <div className="flex flex-col min-h-full animate-fade-in-up" style={{ background: 'var(--cream)' }}>
            {/* Header */}
            <div className="flex flex-col px-6 pt-6 pb-2">
                <div className="flex items-center mb-6">
                    <button onClick={onBack} className="flex items-center gap-2 text-nf-gray text-xs font-bold uppercase tracking-widest hover:text-pink transition-colors group">
                        <div className="w-8 h-8 rounded-full bg-white shadow-sm flex items-center justify-center group-hover:bg-pink-pale transition-colors">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
                        </div>
                    </button>
                    <div className="flex gap-1 ml-auto">
                        <div className="w-1.5 h-1.5 rounded-full bg-pink opacity-40" />
                        <div className="w-1.5 h-1.5 rounded-full bg-pink opacity-40" />
                        <div className="w-1.5 h-1.5 rounded-full bg-pink opacity-40" />
                        <div className="w-1.5 h-1.5 rounded-full bg-pink opacity-40" />
                        <div className="w-1.5 h-1.5 rounded-full bg-pink opacity-40" />
                        <div className="w-1.5 h-1.5 rounded-full bg-pink" />
                    </div>
                </div>

                <p className="text-[10px] tracking-[0.2em] text-nf-gray uppercase font-bold mb-1">Paso 6: Pago Anticipado</p>
                <h1 className="font-serif text-3xl text-charcoal leading-tight">Seguridad <span className="text-pink">Total</span></h1>
            </div>

            <div className="flex-1 overflow-y-auto px-6 pt-8 pb-4">
                {/* Amount */}
                <p className="text-[11px] tracking-[0.15em] text-nf-gray uppercase text-center mb-2">
                    Reserva de {booking.service_name || 'Servicio'}
                </p>
                <p className="font-serif text-5xl text-charcoal text-center mb-1">${advance.toFixed(2)}</p>
                <p className="font-serif italic text-nf-gray text-center text-sm mb-8">Anticipo del servicio</p>

                {/* Payment method selector */}
                <div>
                    <p className="text-[11px] tracking-[0.15em] text-nf-gray uppercase mb-3">Método de Pago</p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                        {methods.map(m => (
                            <button
                                key={m.id}
                                onClick={() => setMethod(m.id)}
                                className={`
                                    flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all duration-200
                                    ${method === m.id ? 'border-pink bg-white shadow-md' : 'border-cream-dark bg-white/60'}
                                `}
                            >
                                <div className={method === m.id ? 'text-pink' : 'text-aesthetic-muted/40'}>
                                    <span className="material-symbol text-2xl font-light">{m.icon}</span>
                                </div>
                                <span className={`text-[8px] tracking-[0.1em] uppercase font-bold ${method === m.id ? 'text-pink' : 'text-aesthetic-muted/60'}`}>
                                    {m.label}
                                </span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Card form */}
                {method === 'card' && (
                    <div className="space-y-4">
                        <div>
                            <p className="text-[11px] tracking-[0.15em] text-nf-gray uppercase mb-2">Nombre en la Tarjeta</p>
                            <input
                                className="w-full bg-transparent border-0 border-b border-cream-dark py-2 text-charcoal placeholder-gray-light focus:outline-none focus:border-pink transition-colors text-base"
                                placeholder="Nombre y Apellido"
                                value={cardName}
                                onChange={e => setCardName(e.target.value)}
                            />
                        </div>
                        <div>
                            <p className="text-[11px] tracking-[0.15em] text-nf-gray uppercase mb-2">Número de Tarjeta</p>
                            <input
                                className="w-full bg-transparent border-0 border-b border-cream-dark py-2 text-charcoal placeholder-gray-light focus:outline-none focus:border-pink transition-colors text-base tracking-widest"
                                placeholder="0000 0000 0000 0000"
                                value={cardNumber}
                                onChange={e => setCardNumber(formatCard(e.target.value))}
                                maxLength={19}
                                inputMode="numeric"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <p className="text-[11px] tracking-[0.15em] text-nf-gray uppercase mb-2">Vencimiento</p>
                                <input
                                    className="w-full bg-transparent border-0 border-b border-cream-dark py-2 text-charcoal placeholder-gray-light focus:outline-none focus:border-pink transition-colors text-base"
                                    placeholder="MM / AA"
                                    value={expiry}
                                    onChange={e => setExpiry(formatExpiry(e.target.value))}
                                    maxLength={5}
                                    inputMode="numeric"
                                />
                            </div>
                            <div>
                                <p className="text-[11px] tracking-[0.15em] text-nf-gray uppercase mb-2">CVC</p>
                                <input
                                    className="w-full bg-transparent border-0 border-b border-cream-dark py-2 text-charcoal placeholder-gray-light focus:outline-none focus:border-pink transition-colors text-base"
                                    placeholder="123"
                                    value={cvc}
                                    onChange={e => setCvc(e.target.value.replace(/\D/g, '').slice(0, 4))}
                                    maxLength={4}
                                    inputMode="numeric"
                                />
                            </div>
                        </div>
                    </div>
                )}

                {method !== 'card' && (
                    <div className="py-8 text-center bg-white/40 rounded-3xl border border-cream-dark shadow-minimal">
                        <p className="text-nf-gray text-sm px-6">
                            {method === 'prueba'
                                ? 'Modo de prueba activo. La cita se registrará sin necesidad de pago real.'
                                : `Serás redirigida a ${method === 'apple' ? 'Apple Pay' : 'Mercado Pago'} para completar el pago.`
                            }
                        </p>
                    </div>
                )}
            </div>

            {error && (
                <div className="mx-6 mb-4 p-4 rounded-2xl bg-red-50 border border-red-200 text-red-600 text-sm text-center">
                    {error}
                </div>
            )}

            {/* CTA */}
            <div className="px-6 pb-10 pt-4">
                <button
                    onClick={handlePayment}
                    disabled={loading}
                    className="w-full py-4 rounded-full text-base font-serif flex items-center justify-center gap-2 transition-all duration-200"
                    style={{ background: method === 'prueba' ? 'var(--charcoal)' : 'var(--coral)', color: 'white' }}
                >
                    {loading ? (
                        <div className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    ) : (
                        <>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
                            {method === 'prueba' ? 'Confirmar Reserva (Prueba)' : 'Confirmar Pago Seguro'}
                        </>
                    )}
                </button>
                <p className="text-center text-[10px] tracking-[0.18em] text-gray-light uppercase mt-4">
                    Protección SSL de Grado Bancario
                </p>
            </div>
        </div>
    );
}
