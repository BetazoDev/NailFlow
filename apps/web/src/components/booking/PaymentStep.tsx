'use client';

import { BookingData } from '@/lib/types';
import { useState } from 'react';
import { api } from '@/lib/api';

interface PaymentStepProps {
    booking: BookingData;
    onNext: () => void;
    onBack: () => void;
}

type PaymentMethod = 'card' | 'apple' | 'mercado' | 'prueba';

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

    const handlePayment = async () => {
        setLoading(true);
        try {
            // Create the booking in the backend
            await api.createBooking(booking);
            // Release the slot hold (if implemented in backend)
            if (booking.date && booking.time) {
                await api.releaseSlot(booking.tenant_id, booking.date, booking.time);
            }
        } catch (e) {
            console.error('Error creating booking:', e);
        }
        // Small delay for UX
        const delay = method === 'prueba' ? 500 : 1000;
        setTimeout(() => {
            setLoading(false);
            onNext();
        }, delay);
    };

    const methods: { id: PaymentMethod; label: string; icon: React.ReactNode }[] = [
        {
            id: 'prueba', label: 'Prueba', icon: (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v20M2 12h20" /><circle cx="12" cy="12" r="10" /></svg>
            )
        },
        {
            id: 'card', label: 'Tarjeta', icon: (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="1" y="4" width="22" height="16" rx="2" /><line x1="1" y1="10" x2="23" y2="10" /></svg>
            )
        },
        {
            id: 'apple', label: 'Apple Pay', icon: (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><path d="M9 12l2 2 4-4" /></svg>
            )
        },
        {
            id: 'mercado', label: 'Mercado', icon: (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="1" y="4" width="22" height="16" rx="2" /><polyline points="1 10 23 10" /></svg>
            )
        },
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
                                <div className={method === m.id ? 'text-pink' : 'text-gray-light'}>
                                    {m.icon}
                                </div>
                                <span className={`text-[9px] sm:text-[11px] tracking-[0.1em] uppercase font-semibold ${method === m.id ? 'text-pink' : 'text-nf-gray'}`}>
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
