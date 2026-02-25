'use client';

import { BookingData } from '@/lib/types';

interface PaymentStepProps {
    booking: BookingData;
    onNext: () => void;
    onBack: () => void;
}

export default function PaymentStep({ booking, onNext, onBack }: PaymentStepProps) {
    const formatDate = (dateStr: string) => {
        const d = new Date(dateStr + 'T12:00:00');
        return d.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' });
    };

    const advanceAmount = booking.service_price * 0.3; // 30% advance

    return (
        <div className="flex flex-col h-full animate-fade-in-up">
            <div className="px-6 pt-4 pb-2">
                <button onClick={onBack} className="flex items-center gap-1 text-nf-gray text-sm mb-3 hover:text-charcoal transition-colors">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
                    Atrás
                </button>
                <h2 className="font-serif text-2xl font-semibold text-charcoal mb-1">Resumen y pago</h2>
                <p className="text-sm text-nf-gray">Revisa los detalles de tu cita</p>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
                {/* Order summary card */}
                <div className="bg-white rounded-2xl p-5 shadow-sm border border-cream-dark/50">
                    <h3 className="font-serif text-lg font-semibold text-charcoal mb-4">Tu cita</h3>

                    <div className="space-y-3">
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="text-xs text-nf-gray uppercase tracking-wider font-medium">Servicio</p>
                                <p className="text-sm font-medium text-charcoal mt-0.5">{booking.service_name}</p>
                            </div>
                            <span className="text-sm font-medium text-charcoal">{booking.service_duration} min</span>
                        </div>

                        <div className="h-px bg-cream-dark" />

                        <div className="flex justify-between">
                            <div>
                                <p className="text-xs text-nf-gray uppercase tracking-wider font-medium">Fecha</p>
                                <p className="text-sm font-medium text-charcoal mt-0.5 capitalize">{formatDate(booking.date)}</p>
                            </div>
                        </div>

                        <div className="flex justify-between">
                            <div>
                                <p className="text-xs text-nf-gray uppercase tracking-wider font-medium">Hora</p>
                                <p className="text-sm font-medium text-charcoal mt-0.5">{booking.time} hrs</p>
                            </div>
                        </div>

                        <div className="h-px bg-cream-dark" />

                        <div className="flex justify-between">
                            <div>
                                <p className="text-xs text-nf-gray uppercase tracking-wider font-medium">Cliente</p>
                                <p className="text-sm font-medium text-charcoal mt-0.5">{booking.client_name}</p>
                                <p className="text-xs text-nf-gray">{booking.client_phone}</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Price breakdown */}
                <div className="bg-white rounded-2xl p-5 shadow-sm border border-cream-dark/50">
                    <h3 className="font-serif text-lg font-semibold text-charcoal mb-4">Desglose</h3>

                    <div className="space-y-3">
                        <div className="flex justify-between text-sm">
                            <span className="text-nf-gray">Servicio</span>
                            <span className="text-charcoal font-medium">${booking.service_price.toFixed(2)} MXN</span>
                        </div>
                        <div className="h-px bg-cream-dark" />
                        <div className="flex justify-between text-sm">
                            <div>
                                <span className="text-charcoal font-semibold">Anticipo requerido</span>
                                <p className="text-xs text-nf-gray mt-0.5">El resto se paga en el salón</p>
                            </div>
                            <span className="font-serif text-xl font-bold text-charcoal">${advanceAmount.toFixed(2)}</span>
                        </div>
                    </div>
                </div>

                {/* Payment method (placeholder) */}
                <div className="rounded-2xl p-5 border-2 border-dashed border-cream-dark">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #009ee3, #00b1ea)' }}>
                            <span className="text-white font-bold text-xs">MP</span>
                        </div>
                        <div>
                            <p className="text-sm font-semibold text-charcoal">Mercado Pago</p>
                            <p className="text-xs text-nf-gray">Tarjeta, transferencia o efectivo</p>
                        </div>
                    </div>
                    <p className="text-[11px] text-nf-gray mt-3 bg-cream-dark/50 rounded-lg p-2.5">
                        ⚡ Integración de Mercado Pago pendiente — por ahora se confirma directamente
                    </p>
                </div>
            </div>

            <div className="p-6">
                <button onClick={onNext} className="btn-gradient w-full py-4 rounded-2xl text-base">
                    Confirmar Cita
                </button>
            </div>
        </div>
    );
}
