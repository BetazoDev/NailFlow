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
                    const url = await api.uploadImage(tenantId, 'bookings', pendingFiles[i], 'clients');
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
        <div className="flex flex-col min-h-full animate-fade-in-up" style={{ background: 'var(--cream)' }}>
            {/* Header */}
            <div className="px-6 pt-6 pb-2">
                <button onClick={onBack} disabled={isUploading} className="flex items-center gap-2 text-nf-gray text-xs font-bold uppercase tracking-widest mb-6 hover:text-pink transition-colors group">
                    <div className="w-8 h-8 rounded-full bg-white shadow-sm flex items-center justify-center group-hover:bg-pink-pale transition-colors">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
                    </div>
                </button>

                <div className="flex gap-1 mb-6">
                    {[...Array(6)].map((_, i) => (
                        <div key={i} className="w-1.5 h-1.5 rounded-full bg-pink" style={{ opacity: i < 4 ? 0.4 : i === 4 ? 1 : 0.15 }} />
                    ))}
                </div>

                <p className="text-[10px] tracking-[0.2em] text-nf-gray uppercase font-bold mb-1">Paso 5: Resumen</p>
                <h1 className="font-serif text-3xl text-charcoal leading-tight">
                    Confirma tu <span className="text-pink">cita</span>
                </h1>
                <div className="w-8 h-px bg-pink mt-3" />
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-8 stagger-children">
                {/* Main Card */}
                <div className="bg-white rounded-[2.5rem] p-8 shadow-xl border border-cream-dark/30 mb-8 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-pink-pale/20 rounded-full -mr-16 -mt-16 blur-2xl" />

                    <div className="relative z-10">
                        <div className="flex items-center gap-4 mb-6">
                            <div className="w-12 h-12 rounded-2xl bg-pink-pale flex items-center justify-center text-xl shadow-inner">✨</div>
                            <div>
                                <p className="text-[10px] font-bold text-nf-gray uppercase tracking-widest mb-0.5">Servicio Seleccionado</p>
                                <h2 className="font-serif text-xl text-charcoal font-bold">{booking.service_name || '—'}</h2>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4 py-6 border-y border-cream-dark/30">
                            <div>
                                <p className="text-[10px] font-bold text-nf-gray uppercase tracking-widest mb-2 flex items-center gap-1.5">
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
                                    Fecha
                                </p>
                                <span className="font-serif text-charcoal font-bold">{formatFullDate(booking.date)}</span>
                            </div>
                            <div>
                                <p className="text-[10px] font-bold text-nf-gray uppercase tracking-widest mb-2 flex items-center gap-1.5">
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                                    Hora
                                </p>
                                <span className="font-serif text-charcoal font-bold">{booking.time || '—'} HS</span>
                            </div>
                        </div>

                        {booking.staff_name && (
                            <div className="pt-6 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-cream-dark/30 flex items-center justify-center text-sm ring-4 ring-cream/50">👩‍🎨</div>
                                    <span className="text-xs font-bold text-charcoal uppercase tracking-widest">{booking.staff_name}</span>
                                </div>
                                <span className="text-[10px] font-bold text-pink uppercase tracking-widest">Profesional</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Reference photos */}
                <div className="mb-10 px-2">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="font-serif text-lg text-charcoal">Fotos de <span className="italic">referencia</span></h3>
                        <button
                            onClick={onAddImage}
                            disabled={isUploading}
                            className="text-[10px] font-bold text-pink uppercase tracking-widest bg-pink-pale px-3 py-1.5 rounded-full border border-pink-light/30 hover:bg-pink hover:text-white transition-all"
                        >
                            {localPreviews.length > 0 ? 'Editar fotos' : '+ Añadir fotos'}
                        </button>
                    </div>

                    {localPreviews.length > 0 ? (
                        <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
                            {localPreviews.map((url, idx) => (
                                <div key={idx} className="w-20 h-20 rounded-2xl overflow-hidden flex-shrink-0 shadow-md border-2 border-white transform rotate-1 hover:rotate-0 transition-all">
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

                {/* Pricing Table */}
                <div className="bg-charcoal text-white rounded-[2.5rem] p-8 shadow-2xl mb-12">
                    <div className="flex justify-between items-center mb-6">
                        <span className="text-xs font-bold uppercase tracking-[0.2em] opacity-60">Total Servicio</span>
                        <div className="h-px flex-1 mx-4 bg-white/10" />
                        <span className="font-serif text-2xl font-bold">${price.toFixed(2)}</span>
                    </div>

                    {advance > 0 && (
                        <>
                            <div className="flex justify-between items-center mb-10">
                                <div className="flex flex-col">
                                    <span className="text-xs font-bold uppercase tracking-[0.2em] text-pink">Seña adelanto</span>
                                    <span className="text-[9px] opacity-40 uppercase tracking-widest mt-0.5">Confirmación inmediata</span>
                                </div>
                                <div className="h-px flex-1 mx-4 bg-white/10" />
                                <span className="font-serif text-2xl font-bold text-pink">${advance.toFixed(2)}</span>
                            </div>

                            <div className="p-4 rounded-2xl bg-white/5 border border-white/10 flex gap-3 items-center">
                                <div className="w-8 h-8 rounded-lg bg-pink/20 flex items-center justify-center text-sm">💳</div>
                                <p className="text-[10px] text-white/60 leading-relaxed font-medium uppercase tracking-wider">
                                    El adelanto se descontará del total el día de tu cita.
                                </p>
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* CTA */}
            <div className="px-6 pb-12 pt-4">
                <button
                    onClick={handleConfirm}
                    disabled={!booking.date || !booking.time || !booking.service_id || isUploading}
                    className="w-full py-5 rounded-full text-base font-serif flex items-center justify-center gap-3 shadow-lg btn-gradient text-white transform hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
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
                <p className="text-center text-[10px] tracking-[0.2em] text-gray-light uppercase font-bold mt-6">
                    PASO 5 DE 6
                </p>
            </div>
        </div>
    );
}
