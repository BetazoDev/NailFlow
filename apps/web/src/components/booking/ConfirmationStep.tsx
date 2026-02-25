'use client';

import { BookingData } from '@/lib/types';

interface ConfirmationStepProps {
    booking: BookingData;
}

export default function ConfirmationStep({ booking }: ConfirmationStepProps) {
    const formatDate = (dateStr: string) => {
        const d = new Date(dateStr + 'T12:00:00');
        return d.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    };

    return (
        <div className="flex flex-col h-full items-center animate-scale-in">
            <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
                {/* Success animation */}
                <div
                    className="w-24 h-24 rounded-full flex items-center justify-center mb-6 shadow-lg"
                    style={{ background: 'linear-gradient(135deg, var(--pink), var(--coral))' }}
                >
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20 6L9 17l-5-5" />
                    </svg>
                </div>

                <h2 className="font-serif text-3xl font-semibold text-charcoal mb-2">
                    ¡Cita confirmada!
                </h2>
                <p className="text-sm text-nf-gray mb-8 max-w-xs">
                    Te enviaremos un recordatorio por WhatsApp antes de tu cita
                </p>

                {/* Appointment details card */}
                <div className="w-full bg-white rounded-2xl p-6 shadow-md border border-cream-dark/30 text-left">
                    <div className="flex items-center gap-3 mb-4">
                        <div
                            className="w-10 h-10 rounded-xl flex items-center justify-center"
                            style={{ background: 'linear-gradient(135deg, var(--pink-pale), var(--coral-light))' }}
                        >
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--pink)" strokeWidth="2">
                                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                                <line x1="16" y1="2" x2="16" y2="6" />
                                <line x1="8" y1="2" x2="8" y2="6" />
                                <line x1="3" y1="10" x2="21" y2="10" />
                            </svg>
                        </div>
                        <div>
                            <p className="text-sm font-semibold text-charcoal capitalize">{formatDate(booking.date)}</p>
                            <p className="text-xs text-nf-gray">{booking.time} hrs</p>
                        </div>
                    </div>

                    <div className="space-y-3 text-sm">
                        <div className="flex justify-between">
                            <span className="text-nf-gray">Servicio</span>
                            <span className="font-medium text-charcoal">{booking.service_name}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-nf-gray">Duración</span>
                            <span className="font-medium text-charcoal">{booking.service_duration} min</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-nf-gray">Total</span>
                            <span className="font-serif font-bold text-lg text-charcoal">${booking.service_price.toFixed(2)}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Bottom actions */}
            <div className="w-full p-6 space-y-3">
                <button
                    onClick={() => window.location.reload()}
                    className="btn-gradient w-full py-4 rounded-2xl text-base"
                >
                    Agendar otra cita
                </button>
                <p className="text-center text-xs text-nf-gray">
                    ID de confirmación: <span className="font-mono font-medium">{Math.random().toString(36).slice(2, 10).toUpperCase()}</span>
                </p>
            </div>
        </div>
    );
}
