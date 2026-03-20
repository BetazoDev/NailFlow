'use client';

import { PaymentMethod, BookingData } from '@/lib/types';
import { useState } from 'react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';

interface PaymentStepProps {
    booking: BookingData;
    /** Files pending CDN upload — will be uploaded on booking confirmation */
    pendingFiles: File[];
    tenantId: string;
    /** Called with appointment ID and optionally CDN URLs after successful booking */
    onBookingConfirmed: (appointmentId: string, cdnUrls?: string[]) => void;
    onBack: () => void;
}

export default function PaymentStep({ booking, pendingFiles, tenantId, onBookingConfirmed, onBack }: PaymentStepProps) {
    const [method, setMethod] = useState<PaymentMethod>('prueba');
    const [cardName, setCardName] = useState('');
    const [cardNumber, setCardNumber] = useState('');
    const [expiry, setExpiry] = useState('');
    const [cvc, setCvc] = useState('');
    const [loading, setLoading] = useState(false);
    const [loadingMsg, setLoadingMsg] = useState('');
    const [error, setError] = useState<string | null>(null);

    const advance = Number(booking.total_required_advance) || Number(booking.service_required_advance) || 0;

    const handlePayment = async () => {
        setLoading(true);
        setError(null);

        try {
            if (method === 'prueba') {
                setLoadingMsg('Registrando tu cita...');
                const bookingPayload = {
                    ...booking,
                    payment_method: method,
                };
                const result = await api.createBookingTest(bookingPayload);
                setLoadingMsg('¡Cita confirmada!');
                await new Promise(r => setTimeout(r, 600));
                onBookingConfirmed(result.appointmentId);
            } else {
                setLoadingMsg('Redirigiendo a pasarela...');
                const bookingPayload = {
                    ...booking,
                    payment_method: method,
                };

                const result = await api.createBooking(bookingPayload);
                if (result.init_point) {
                    window.location.href = result.init_point;
                } else {
                    await new Promise(r => setTimeout(r, 800));
                    onBookingConfirmed(result.appointmentId);
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
        <div className="flex flex-col h-full relative" style={{ background: 'var(--cream)' }}>
            {/* Header: Sticky at the top */}
            <div className="bg-white/80 backdrop-blur-md sticky top-0 z-30 border-b border-cream-dark/30 shadow-sm">
                <div className="flex items-center justify-between px-6 pt-6 pb-2">
                    <button onClick={onBack} disabled={loading} className="flex items-center gap-2 text-nf-gray text-xs font-bold uppercase tracking-widest hover:text-pink transition-colors group">
                        <div className="w-8 h-8 rounded-full bg-white shadow-sm flex items-center justify-center group-hover:bg-pink-pale transition-colors">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
                        </div>
                    </button>
                    <div className="flex gap-1.5">
                        <div className="w-2 h-2 rounded-full bg-pink opacity-20" />
                        <div className="w-2 h-2 rounded-full bg-pink opacity-20" />
                        <div className="w-2 h-2 rounded-full bg-pink opacity-20" />
                        <div className="w-2 h-2 rounded-full bg-pink opacity-20" />
                        <div className="w-2 h-2 rounded-full bg-pink opacity-20" />
                        <div className="w-2 h-2 rounded-full bg-pink" />
                    </div>
                </div>

                <div className="px-6 pt-4 pb-4">
                    <p className="text-[10px] tracking-[0.2em] text-nf-gray uppercase font-bold mb-1">Paso 6: Pago Anticipado</p>
                    <h1 className="font-serif text-3xl text-charcoal leading-tight">Seguridad <span className="text-pink">Total</span></h1>
                </div>
            </div>

            {/* Scrollable content areas */}
            <div className="flex-1 overflow-y-auto no-scrollbar pb-32 px-6 pt-8 text-center">
                {/* Amount */}
                <p className="text-[11px] tracking-[0.15em] text-nf-gray uppercase mb-2">
                    Reserva de {booking.selected_services?.map(s => s.name).join(', ') || booking.service_name || 'Servicios'}
                </p>
                <p className="font-serif text-5xl text-charcoal mb-1">${advance.toFixed(2)}</p>
                <p className="font-serif italic text-nf-gray text-sm mb-8">Anticipo del servicio</p>

                {/* Payment method selector */}
                <div className="text-left">
                    <p className="text-[11px] tracking-[0.15em] text-nf-gray uppercase mb-3 font-bold opacity-60">Método de Pago</p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                        {methods.map(m => (
                            <button
                                key={m.id}
                                onClick={() => setMethod(m.id)}
                                className="focus:outline-none"
                            >
                                <Card 
                                    variant="white" 
                                    className={`flex flex-col items-center gap-2 p-4 border-2 transition-all duration-300 ${method === m.id ? 'border-pink ring-4 ring-pink/10 scale-[1.02]' : 'border-transparent opacity-60 grayscale-[0.5] hover:opacity-100 hover:grayscale-0'}`}
                                >
                                    <div className={method === m.id ? 'text-pink' : 'text-aesthetic-muted/40'}>
                                        <span className="material-symbol text-2xl font-light">{m.icon}</span>
                                    </div>
                                    <span className={`text-[8px] tracking-[0.1em] uppercase font-bold ${method === m.id ? 'text-pink' : 'text-aesthetic-muted/60'}`}>
                                        {m.label}
                                    </span>
                                </Card>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Instructions */}
                <div className="py-8 px-6 text-center bg-white/40 rounded-3xl border border-cream-dark/50 shadow-minimal mb-8">
                    <p className="text-nf-gray text-sm">
                        {method === 'prueba' 
                            ? 'Modo de prueba activo. La cita se registrará sin necesidad de pago real.'
                            : `Serás redirigida de forma segura a ${method === 'apple' ? 'Apple Pay' : method === 'mercado' ? 'Mercado Pago' : 'nuestra pasarela'} para completar el anticipo.`
                        }
                    </p>
                </div>

                {error && (
                    <div className="mb-4 p-4 rounded-2xl bg-red-50 border border-red-200 text-red-600 text-sm">
                        {error}
                    </div>
                )}
            </div>

            {/* CTA: Fixed at the bottom */}
            <div className="absolute bottom-0 left-0 right-0 p-8 bg-white/80 backdrop-blur-xl border-t border-cream-dark/50 z-40">
                <Button
                    onClick={handlePayment}
                    isLoading={loading}
                    variant={method === 'prueba' ? 'secondary' : 'primary'}
                    className="w-full h-16 shadow-lg rounded-full"
                    leftIcon={!loading && <span className="material-symbol text-lg">lock</span>}
                >
                    {loading ? (loadingMsg || 'Procesando...') : (method === 'prueba' ? 'Confirmar Reserva (Prueba)' : 'Confirmar Pago Seguro')}
                </Button>
                <p className="text-center text-[10px] tracking-[0.18em] text-gray-light uppercase mt-6 opacity-60 font-bold">
                    Protección SSL de Grado Bancario
                </p>
            </div>
        </div>
    );
}
