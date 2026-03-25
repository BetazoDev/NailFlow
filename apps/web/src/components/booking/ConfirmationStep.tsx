'use client';

import { useState, useEffect } from 'react';
import { BookingData } from '@/lib/types';
import { api } from '@/lib/api';

interface ConfirmationStepProps {
    booking: BookingData;
    appointmentId?: string | null;
    pendingFiles?: File[];
    tenantId?: string;
    salonName?: string;
}

function formatFullDate(dateStr: string) {
    if (!dateStr) return '—';
    const d = new Date(dateStr + 'T12:00:00');
    return d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
}

export default function ConfirmationStep({ booking, salonName = 'Ana Nails Studio' }: ConfirmationStepProps) {
    const [saved, setSaved] = useState(false);
    const [saving] = useState(false);
    const [error] = useState('');

    useEffect(() => {
        // Booking is now saved in PaymentStep to avoid partial states
        // This component just displays the result.
        setSaved(true);
    }, []);

    if (error) {
        return (
            <div className="flex flex-col min-h-full items-center justify-center p-6 animate-fade-in" style={{ background: 'var(--cream)' }}>
                {/* Error Decoration */}
                <div className="relative mb-12">
                    <div className="w-32 h-32 rounded-full bg-red-50 flex items-center justify-center relative z-10 shadow-xl border-4 border-white animate-scale-in">
                        <span className="material-symbol text-5xl text-red-400">error</span>
                    </div>
                </div>

                {/* Heading */}
                <div className="text-center mb-10 stagger-children">
                    <h1 className="font-serif text-4xl text-charcoal leading-tight mb-3">
                        Ups, algo salió <span className="text-red-400">mal</span>
                    </h1>
                    <p className="text-sm text-nf-gray max-w-[280px] mx-auto leading-relaxed">
                        No pudimos procesar tu reserva en este momento. Por favor, intenta de nuevo.
                    </p>
                </div>

                {/* Actions */}
                <div className="w-full max-w-sm space-y-4">
                    <button
                        onClick={() => window.location.reload()}
                        className="w-full py-5 rounded-full text-base font-serif flex items-center justify-center gap-3 shadow-lg bg-aesthetic-taupe text-white transform hover:scale-[1.02] active:scale-[0.98] transition-all"
                    >
                        <span className="material-symbol">refresh</span>
                        Intentar de nuevo
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col min-h-full items-center p-6 py-12 animate-fade-in overflow-y-auto" style={{ background: 'var(--cream)' }}>
            {/* Success Decoration */}
            <div className="relative mb-12">
                <div className="w-32 h-32 rounded-full bg-pink-pale flex items-center justify-center relative z-10 shadow-xl border-4 border-white animate-scale-in">
                    {saving ? (
                        <div className="w-10 h-10 border-4 border-pink-light border-t-pink rounded-full animate-spin" />
                    ) : (
                        <div className="text-5xl animate-bounce-subtle">✨</div>
                    )}
                </div>
                {/* Floating particles */}
                <div className="absolute top-0 -left-4 w-4 h-4 rounded-full bg-pink animate-ping opacity-20" />
                <div className="absolute bottom-4 -right-4 w-6 h-6 rounded-full bg-pink-light animate-pulse" />
                <div className="absolute -top-4 right-8 w-3 h-3 rounded-full bg-coral animate-ping opacity-30" />
            </div>

            {/* Heading */}
            <div className="text-center mb-10 stagger-children">
                <h1 className="font-serif text-4xl text-charcoal leading-tight mb-3">
                    {saving ? 'Preparando todo...' : <>¡Tu cita está <span className="text-pink">lista!</span></>}
                </h1>
                <p className="text-sm text-nf-gray max-w-[280px] mx-auto leading-relaxed">
                    {saving
                        ? 'Estamos guardando los detalles de tu reserva en nuestra agenda.'
                        : 'Te hemos enviado un correo con todos los detalles de tu reserva.'}
                </p>
            </div>

            {/* Itinerary Card */}
            {(!saving && saved) && (
                <div className="w-full max-w-sm bg-white rounded-[2.5rem] pt-8 px-8 pb-12 shadow-2xl border border-cream-dark/30 mb-10 relative overflow-hidden animate-fade-in-up">
                    <div className="space-y-6">
                        <div className="flex items-center justify-between pb-4 border-b border-cream-dark/30">
                            <div>
                                <p className="text-[9px] font-bold text-nf-gray uppercase tracking-widest mb-1">Tu cita en</p>
                                <h2 className="font-serif text-lg text-charcoal font-bold">{salonName}</h2>
                            </div>
                            <div className="w-10 h-10 rounded-full bg-pink-pale flex items-center justify-center text-lg">💅</div>
                        </div>

                        <div className="grid grid-cols-2 gap-6">
                            <div>
                                <p className="text-[9px] font-bold text-nf-gray uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
                                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
                                    Fecha
                                </p>
                                <span className="font-serif text-charcoal font-bold block capitalize">{formatFullDate(booking.date)}</span>
                            </div>
                            <div>
                                <p className="text-[9px] font-bold text-nf-gray uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
                                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                                    Hora
                                </p>
                                <span className="font-serif text-charcoal font-bold block">{booking.time} HS</span>
                            </div>
                        </div>

                        <div className="pt-4 border-t border-cream-dark/30">
                            <p className="text-[9px] font-bold text-nf-gray uppercase tracking-widest mb-2 flex items-center gap-1.5">
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M12 2L9 12l-7 3 7 3 3 10 3-10 7-3-7-3z" /></svg>
                                Servicio
                            </p>
                            <p className="text-sm font-bold text-charcoal">{booking.service_name}</p>
                        </div>

                        <div className="pt-4 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-pink-pale flex items-center justify-center text-xs border border-white shadow-sm font-bold text-pink">
                                    {booking.client_name?.charAt(0) || 'C'}
                                </div>
                                <span className="text-xs font-bold text-charcoal uppercase tracking-widest">{booking.client_name}</span>
                            </div>
                            <span className="text-[9px] font-bold text-pink uppercase tracking-widest">Confirmado</span>
                        </div>

                        {(booking.image_urls && booking.image_urls.length > 0) && (
                            <div className="pt-6 border-t border-cream-dark/30">
                                <p className="text-[9px] font-bold text-nf-gray uppercase tracking-widest mb-3 flex items-center gap-1.5">
                                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" /><circle cx="12" cy="13" r="4" /></svg>
                                    Inspiración
                                </p>
                                <div className="flex gap-2 overflow-x-auto pb-1">
                                    {booking.image_urls.map((url, i) => (
                                        <img key={i} src={api.getPublicUrl(url)} alt="" className="w-12 h-12 rounded-xl object-cover border border-cream-dark shadow-sm" />
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Scalloped edge effect */}
                    <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
                        {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
                            <div key={i} className="w-4 h-4 rounded-full bg-cream" />
                        ))}
                    </div>
                </div>
            )}

            {/* Actions */}
            {(!saving && saved) && (
                <div className="w-full max-w-sm space-y-4 animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
                    <button
                        className="w-full py-5 rounded-full text-base font-serif flex items-center justify-center gap-3 shadow-lg btn-gradient text-white transform hover:scale-[1.02] active:scale-[0.98] transition-all"
                        onClick={() => {
                            const date = booking.date;
                            const url = `https://calendar.google.com/calendar/r/eventedit?text=${encodeURIComponent(booking.service_name)}&dates=${date.replace(/-/g, '')}/${date.replace(/-/g, '')}&details=${encodeURIComponent('Cita en ' + salonName)}`;
                            window.open(url, '_blank');
                        }}
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
                        Añadir al Calendario
                    </button>

                    <button
                        onClick={() => window.location.reload()}
                        className="w-full text-center text-[10px] tracking-[0.2em] text-pink underline-offset-4 hover:underline uppercase font-bold py-4 transition-all"
                    >
                        Agendar otra cita
                    </button>
                </div>
            )}
        </div>
    );
}
