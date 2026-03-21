'use client';

import { useState } from 'react';
import { BookingData } from '@/lib/types';
import { api } from '@/lib/api';

interface SummaryStepProps {
    booking: BookingData;
    /** Local blob URLs for previewing selected images (not yet uploaded) */
    localPreviews: string[];
    /** Actual File objects waiting to be uploaded */
    pendingFiles: File[];
    tenantId: string;
    onNext: (cdnUrls?: string[]) => void;
    onBack: () => void;
    onAddImage: () => void;
}

function formatFullDate(dateStr: string) {
    if (!dateStr) return '—';
    const d = new Date(dateStr + 'T12:00:00');
    return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
}

export default function SummaryStep({ booking, localPreviews, pendingFiles, tenantId, onNext, onBack, onAddImage }: SummaryStepProps) {
    const price = Number(booking.service_price) || 0;
    const advance = Number(booking.service_required_advance) || 0;
    const [isUploading, setIsUploading] = useState(false);
    const [uploadStatus, setUploadStatus] = useState('');

    const handleConfirm = async () => {
        let cdnUrls: string[] = [];

        if (pendingFiles.length > 0) {
            setIsUploading(true);
            try {
                for (let i = 0; i < pendingFiles.length; i++) {
                    setUploadStatus(`Subiendo foto ${i + 1} de ${pendingFiles.length}...`);
                    const url = await api.uploadImage(tenantId, 'clientas', pendingFiles[i], 'clients');
                    cdnUrls.push(url);
                }
            } catch (e) {
                console.error('Image upload failed:', e);
                // Continue without images rather than blocking booking
                cdnUrls = [];
            } finally {
                setIsUploading(false);
                setUploadStatus('');
            }
        }

        onNext(cdnUrls);
    };

    return (
        <div className="flex flex-col h-full relative" style={{ background: 'var(--cream)' }}>
            {/* Header: Sticky at the top */}
            <div className="bg-white/80 backdrop-blur-md sticky top-0 z-30 border-b border-cream-dark/30 shadow-sm">
                <div className="flex items-center justify-between px-6 pt-6 pb-2">
                    <button onClick={onBack} disabled={isUploading} className="flex items-center gap-2 text-nf-gray text-xs font-bold uppercase tracking-widest hover:text-pink transition-colors group">
                        <div className="w-8 h-8 rounded-full bg-white shadow-sm flex items-center justify-center group-hover:bg-pink-pale transition-colors">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
                        </div>
                    </button>
                    <div className="flex gap-1.5">
                        <div className="w-2 h-2 rounded-full bg-pink opacity-20" />
                        <div className="w-2 h-2 rounded-full bg-pink opacity-20" />
                        <div className="w-2 h-2 rounded-full bg-pink opacity-20" />
                        <div className="w-2 h-2 rounded-full bg-pink opacity-20" />
                        <div className="w-2 h-2 rounded-full bg-pink" />
                        {[...Array(2)].map((_, i) => (
                            <div key={i} className="w-2 h-2 rounded-full bg-cream-dark opacity-30" />
                        ))}
                    </div>
                </div>

                <div className="px-6 pt-4 pb-4">
                    <p className="text-[10px] tracking-[0.2em] text-nf-gray uppercase font-bold mb-1">Paso 5: Resumen</p>
                    <h1 className="font-serif text-3xl text-charcoal leading-tight">
                        Confirma tu <span className="text-pink">cita</span>
                    </h1>
                </div>
            </div>

            {/* Scrollable content areas */}
            <div className="flex-1 overflow-y-auto no-scrollbar px-6 py-8">
                {/* Unified Main Card */}
                <div className="bg-white rounded-[2.5rem] p-8 shadow-xl border border-cream-dark/30 mb-8 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-pink-pale/20 rounded-full -mr-16 -mt-16 blur-2xl" />

                    <div className="relative z-10">
                        <div className="mb-8">
                            <p className="text-[10px] font-bold text-nf-gray uppercase tracking-widest mb-4 flex items-center gap-2">
                                <span className="w-6 h-6 rounded-lg bg-pink-pale flex items-center justify-center text-xs">✨</span>
                                Servicios Seleccionados
                            </p>
                            <div className="space-y-3">
                                {booking.selected_services?.map((svc) => (
                                    <div key={svc.id} className="flex justify-between items-center group bg-cream/30 p-4 rounded-2xl border border-cream-dark/10">
                                        <h2 className="font-serif text-lg text-charcoal font-bold">{svc.name}</h2>
                                        <span className="text-sm font-bold text-pink">${Number(svc.estimated_price)}</span>
                                    </div>
                                )) || (
                                    <div className="bg-cream/30 p-4 rounded-2xl border border-cream-dark/10">
                                        <h2 className="font-serif text-xl text-charcoal font-bold">{booking.service_name || '—'}</h2>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="space-y-4 py-6 border-y border-cream-dark/30">
                            <div className="flex items-center justify-between">
                                <p className="text-[10px] font-bold text-nf-gray uppercase tracking-widest flex items-center gap-1.5">
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
                                    Fecha
                                </p>
                                <span className="font-serif text-charcoal font-bold">{formatFullDate(booking.date)}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <p className="text-[10px] font-bold text-nf-gray uppercase tracking-widest flex items-center gap-1.5">
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                                    Hora
                                </p>
                                <span className="font-serif text-charcoal font-bold">{booking.time || '—'} HS</span>
                            </div>
                            {booking.staff_name && (
                                <div className="flex items-center justify-between pt-2">
                                    <p className="text-[10px] font-bold text-nf-gray uppercase tracking-widest flex items-center gap-1.5">
                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
                                        Especialista
                                    </p>
                                    <span className="text-xs font-bold text-charcoal uppercase tracking-widest">{booking.staff_name}</span>
                                </div>
                            )}
                        </div>

                        {/* Pricing details integrated inside the main card area or just below */}
                        <div className="mt-8 space-y-4">
                            <div className="flex justify-between items-center">
                                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-nf-gray">Total del servicio</span>
                                <span className="font-serif text-2xl font-bold text-charcoal">${Number(booking.total_price || price).toFixed(2)}</span>
                            </div>

                            {Number(booking.total_required_advance || advance) > 0 && (
                                <div className="p-5 rounded-3xl bg-pink-pale/20 border border-pink-light/20">
                                    <div className="flex justify-between items-center mb-3">
                                        <div className="flex flex-col">
                                            <span className="text-xs font-bold uppercase tracking-[0.2em] text-pink">Seña para reservar</span>
                                        </div>
                                        <span className="font-serif text-xl font-bold text-pink">${Number(booking.total_required_advance || advance).toFixed(2)}</span>
                                    </div>
                                    <p className="text-[9px] text-nf-gray leading-relaxed font-medium uppercase tracking-wider opacity-70">
                                        Este monto se descontará del total el día de tu cita. Pago seguro vía Mercado Pago.
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Reference photos */}
                <div className="mb-10 px-2">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="font-serif text-lg text-charcoal">Fotos de <span className="italic">referencia</span></h3>
                    </div>

                    {localPreviews.length > 0 ? (
                        <div className="flex gap-4 overflow-x-auto pb-4 thin-scrollbar">
                            {localPreviews.map((url, idx) => (
                                <div key={idx} className="w-24 h-24 rounded-2xl overflow-hidden flex-shrink-0 shadow-md border-2 border-white transform rotate-1 hover:rotate-0 transition-all">
                                    <img src={url} alt={`ref-${idx}`} className="w-full h-full object-cover" />
                                </div>
                            ))}
                        </div>
                    ) : (
                        <button
                            onClick={onAddImage}
                            disabled={isUploading}
                            className="w-full py-4 rounded-2xl border-2 border-dashed border-pink/20 flex items-center justify-center gap-3 bg-white hover:bg-pink-pale hover:border-pink/40 transition-all group"
                        >
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-pink/40 group-hover:text-pink transition-colors">
                                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" /><circle cx="12" cy="13" r="4" />
                            </svg>
                            <span className="text-[11px] text-nf-gray font-bold uppercase tracking-widest">Añadir fotos de inspiración</span>
                        </button>
                    )}
                </div>
            </div>

            {/* CTA: Sticky at the bottom */}
            <div className={`sticky bottom-0 left-0 right-0 p-8 bg-white/80 backdrop-blur-xl border-t border-cream-dark/50 z-40 transition-all duration-500 ${isUploading ? 'opacity-80' : ''}`}>
                <button
                    onClick={handleConfirm}
                    disabled={!booking.date || !booking.time || (!booking.service_id && !booking.selected_services?.length) || isUploading}
                    className="w-full max-w-lg mx-auto py-5 rounded-full text-base font-serif flex items-center justify-center gap-3 shadow-lg btn-gradient text-white transform hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                >
                    {isUploading ? (
                        <>
                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            {uploadStatus || 'Subiendo imágenes...'}
                        </>
                    ) : (
                        <>
                            Confirmar Reserva
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
                        </>
                    )}
                </button>
            </div>
        </div>
    );
}
