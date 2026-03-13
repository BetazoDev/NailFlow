'use client';

import { BookingData } from '@/lib/types';
import { useState } from 'react';
import { api } from '@/lib/api';

interface PaymentStepProps {
    booking: BookingData;
    /** Files pending CDN upload — will be uploaded on booking confirmation */
    pendingFiles: File[];
    tenantId: string;
    /** Called with appointment ID and optionally CDN URLs after successful booking */
    onBookingConfirmed: (appointmentId: string, cdnUrls?: string[]) => void;
    onBack: () => void;
}

type PaymentMethod = 'card' | 'apple' | 'mercado' | 'prueba' | 'stripe' | 'paypal' | 'google';

export default function PaymentStep({ booking, pendingFiles, tenantId, onBookingConfirmed, onBack }: PaymentStepProps) {
    const [method, setMethod] = useState<PaymentMethod>('prueba');
    const [cardName, setCardName] = useState('');
    const [cardNumber, setCardNumber] = useState('');
    const [expiry, setExpiry] = useState('');
    const [cvc, setCvc] = useState('');
    const [loading, setLoading] = useState(false);
    const [loadingMsg, setLoadingMsg] = useState('');
    const [error, setError] = useState<string | null>(null);

    const price = Number(booking.service_price) || 0;
    const advance = Math.round(price * 0.4);

    const formatCard = (v: string) => v.replace(/\D/g, '').replace(/(.{4})/g, '$1 ').trim().slice(0, 19);
    const formatExpiry = (v: string) => {
        const n = v.replace(/\D/g, '');
        if (n.length >= 2) return n.slice(0, 2) + '/' + n.slice(2, 4);
        return n;
    };

    const handlePayment = async () => {
        setLoading(true);
        setError(null);

        try {
            // Step 1: Upload pending images to CDN (only if there are any)
            const cdnUrls: string[] = [];
            if (pendingFiles.length > 0) {
                setLoadingMsg('Subiendo fotos de referencia...');
                for (const file of pendingFiles) {
                    const url = await api.uploadImage(tenantId, 'bookings', file, 'clients');
                    cdnUrls.push(url);
                }
            }

            if (method === 'prueba') {
                setLoadingMsg('Registrando tu cita...');
                const bookingPayload = {
                    ...booking,
                    payment_method: method,
                    image_urls: cdnUrls,
                    image_url: cdnUrls[0] || undefined,
                };
                const result = await api.createBookingTest(bookingPayload);
                setLoadingMsg('¡Cita confirmada!');
                await new Promise(r => setTimeout(r, 300));
                onBookingConfirmed(result.appointmentId, cdnUrls);
            } else {
                // Step 2: Create the booking with the CDN URLs
                setLoadingMsg('Registrando tu cita...');
                const bookingPayload = {
                    ...booking,
                    payment_method: method,
                    image_urls: cdnUrls,
                    image_url: cdnUrls[0] || undefined,
                };

                const result = await api.createBooking(bookingPayload as any);
                if (result.init_point) {
                    window.location.href = result.init_point;
                } else {
                    await new Promise(r => setTimeout(r, 800));
                    onBookingConfirmed(result.appointmentId, cdnUrls);
                }
            }
        } catch (e: any) {
            console.error('Error creating booking:', e);
            const errorMsg = e.details || e.message || 'Error al procesar la reserva. Por favor intenta de nuevo.';
            setError(errorMsg);
            setLoadingMsg('');
        } finally {
            setLoading(false);
        }
    };

    const methods: { id: PaymentMethod; label: string; icon: string }[] = [
        { id: 'prueba', label: 'PRUEBA', icon: 'verified' },
        { id: 'card', label: 'TARJETA', icon: 'credit_card' },
        { id: 'apple', label: 'APPLE PAY', icon: 'token' },
        { id: 'google', label: 'GOOGLE PAY', icon: 'contactless' },
        { id: 'stripe', label: 'STRIPE', icon: 'payments' },
        { id: 'paypal', label: 'PAYPAL', icon: 'account_balance_wallet' },
        { id: 'mercado', label: 'MERCADO', icon: 'storefront' },
    ];

    return (
        <div className="flex flex-col h-full overflow-hidden animate-fade-in-up" style={{ background: 'var(--cream)' }}>
            {/* STICKY HEADER */}
            <div className="flex-none bg-white/80 backdrop-blur-md border-b border-cream-dark/50 z-20">
                <div className="p-6">
                    <div className="flex items-center justify-between mb-6">
                        <button onClick={onBack} disabled={loading} className="w-10 h-10 rounded-full bg-cream flex items-center justify-center text-nf-gray hover:text-pink transition-all border border-cream-dark/50 shadow-sm disabled:opacity-50">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
                        </button>
                        
                        <div className="flex gap-1.5 bg-cream px-3 py-1.5 rounded-full border border-cream-dark/50">
                            {[1, 2, 3, 4, 5, 6].map((i) => (
                                <div key={i} className={`w-2 h-2 rounded-full transition-all duration-500 ${i === 6 ? 'bg-pink scale-125' : 'bg-pink/40'}`} />
                            ))}
                        </div>
                        <div className="w-10" />
                    </div>
                    <p className="text-[10px] tracking-[0.25em] text-pink uppercase font-black mb-1">Paso 6: Pago Anticipado</p>
                    <h1 className="font-serif text-3xl lg:text-4xl text-charcoal leading-tight">
                        Seguridad <span className="text-pink italic">total</span>
                    </h1>
                </div>
            </div>

            {/* SCROLLABLE PAYMENT CONTENT */}
            <div className="flex-1 overflow-y-auto px-6 py-8 custom-scrollbar">
                <div className="max-w-xl mx-auto space-y-10">
                    {/* Amount Highlight */}
                    <div className="text-center space-y-2">
                        <p className="text-[10px] font-black text-nf-gray uppercase tracking-[0.3em] opacity-40">Anticipo del Servicio</p>
                        <p className="font-serif text-6xl text-charcoal font-black tracking-tight">${advance.toFixed(2)}</p>
                        <p className="text-[9px] font-black text-pink uppercase tracking-[0.2em] bg-pink/5 inline-block px-4 py-1.5 rounded-full">Reserva 100% Reembolsable</p>
                    </div>

                    {/* Payment methods */}
                    <div className="space-y-6">
                        <p className="text-[10px] font-black text-nf-gray uppercase tracking-[0.2em] px-2 opacity-50">Método de Pago</p>
                        <div className="grid grid-cols-2 gap-4">
                            {methods.map(m => (
                                <button
                                    key={m.id}
                                    onClick={() => setMethod(m.id)}
                                    className={`
                                        flex items-center gap-4 p-5 rounded-[2rem] border-2 transition-all duration-500 transform
                                        ${method === m.id 
                                            ? 'border-pink bg-white shadow-2xl scale-[1.02]' 
                                            : 'border-cream-dark bg-white/40 hover:bg-white/80'}
                                    `}
                                >
                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${method === m.id ? 'bg-pink text-white' : 'bg-cream text-nf-gray/40'}`}>
                                        <span className="material-symbol text-2xl">{m.icon}</span>
                                    </div>
                                    <span className={`text-[10px] font-black uppercase tracking-widest ${method === m.id ? 'text-charcoal' : 'text-nf-gray/40'}`}>
                                        {m.label}
                                    </span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Form specifically for Card */}
                    {method === 'card' && (
                        <div className="bg-white rounded-[3rem] p-8 shadow-2xl border border-cream-dark/50 animate-fade-in-up space-y-8">
                            <div className="space-y-6">
                                <div className="space-y-2">
                                    <label className="text-[9px] font-black text-nf-gray uppercase tracking-[0.2em] ml-2 opacity-40">Titular de la tarjeta</label>
                                    <input
                                        className="w-full bg-cream/30 border-2 border-transparent focus:border-pink/20 rounded-2xl px-6 py-4 text-charcoal placeholder-charcoal/20 outline-none transition-all font-serif font-bold"
                                        placeholder="Nombre como figura"
                                        value={cardName}
                                        onChange={e => setCardName(e.target.value)}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[9px] font-black text-nf-gray uppercase tracking-[0.2em] ml-2 opacity-40">Número de tarjeta</label>
                                    <input
                                        className="w-full bg-cream/30 border-2 border-transparent focus:border-pink/20 rounded-2xl px-6 py-4 text-charcoal placeholder-charcoal/20 outline-none transition-all font-serif font-black tracking-[0.2em]"
                                        placeholder="0000 0000 0000 0000"
                                        value={cardNumber}
                                        onChange={e => setCardNumber(formatCard(e.target.value))}
                                        maxLength={19}
                                        inputMode="numeric"
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label className="text-[9px] font-black text-nf-gray uppercase tracking-[0.2em] ml-2 opacity-40">Expiración</label>
                                        <input
                                            className="w-full bg-cream/30 border-2 border-transparent focus:border-pink/20 rounded-2xl px-6 py-4 text-charcoal placeholder-charcoal/20 outline-none transition-all font-serif font-black"
                                            placeholder="MM / AA"
                                            value={expiry}
                                            onChange={e => setExpiry(formatExpiry(e.target.value))}
                                            maxLength={5}
                                            inputMode="numeric"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[9px] font-black text-nf-gray uppercase tracking-[0.2em] ml-2 opacity-40">CVC</label>
                                        <input
                                            className="w-full bg-cream/30 border-2 border-transparent focus:border-pink/20 rounded-2xl px-6 py-4 text-charcoal placeholder-charcoal/20 outline-none transition-all font-serif font-black"
                                            placeholder="123"
                                            value={cvc}
                                            onChange={e => setCvc(e.target.value.replace(/\D/g, '').slice(0, 4))}
                                            maxLength={4}
                                            inputMode="numeric"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {method !== 'card' && (
                        <div className="bg-charcoal text-white/40 rounded-[2.5rem] p-8 text-center space-y-2 border border-white/5 shadow-2xl">
                            <span className="text-2xl opacity-100">🛡️</span>
                            <p className="text-[10px] font-black uppercase tracking-widest leading-relaxed">
                                {method === 'prueba'
                                    ? 'Modo Demo Activo: No se realizará ningún cargo real.'
                                    : `Serás redirigida al portal seguro de ${method} para finalizar.`
                                }
                            </p>
                        </div>
                    )}

                    {error && (
                        <div className="p-6 rounded-[2rem] bg-red-500/10 border border-red-500/20 text-red-500 text-[10px] font-black uppercase tracking-widest text-center animate-shake">
                            {error}
                        </div>
                    )}
                </div>
            </div>

            {/* STICKY CTA PANEL */}
            <div className="flex-none p-6 bg-white/90 backdrop-blur-xl border-t border-cream-dark/50 z-30 shadow-[0_-10px_40px_rgba(0,0,0,0.05)]">
                <div className="max-w-xl mx-auto space-y-6">
                    <button
                        onClick={handlePayment}
                        disabled={loading}
                        className={`
                            w-full py-5 rounded-[2rem] text-sm font-black uppercase tracking-[0.2em] flex items-center justify-center gap-4 shadow-2xl transition-all duration-500 transform active:scale-95
                            ${loading ? 'bg-charcoal text-white/50 cursor-wait' : 'btn-gradient text-white hover:scale-[1.02]'}
                        `}
                    >
                        {loading ? (
                            <div className="flex items-center gap-4">
                                <div className="w-5 h-5 border-3 border-white/20 border-t-white rounded-full animate-spin" />
                                <span>{loadingMsg || 'Verificando...'}</span>
                            </div>
                        ) : (
                            <>
                                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
                                {method === 'prueba' ? 'Confirmar Reserva Demo' : 'Confirmar y Pagar'}
                            </>
                        )}
                    </button>
                    <div className="flex items-center justify-center gap-2 text-nf-gray/30">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
                        <p className="text-[9px] tracking-[0.3em] uppercase font-black">
                            SSL Encryption • 256-bit Security
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
