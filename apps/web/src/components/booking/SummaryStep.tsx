'use client';

import { BookingData } from '@/lib/types';

interface SummaryStepProps {
    booking: BookingData;
    /** Local blob URLs for previewing selected images (not yet uploaded) */
    localPreviews: string[];
    onNext: () => void;
    onBack: () => void;
    onAddImage: () => void;
}

function formatFullDate(dateStr: string) {
    if (!dateStr) return '—';
    const d = new Date(dateStr + 'T12:00:00');
    return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
}

export default function SummaryStep({ booking, localPreviews, onNext, onBack, onAddImage }: SummaryStepProps) {
    const price = Number(booking.service_price) || 0;
    const advance = Math.round(price * 0.4);

    return (
        <div className="flex flex-col h-full overflow-hidden animate-fade-in-up" style={{ background: 'var(--cream)' }}>
            {/* STICKY HEADER */}
            <div className="flex-none bg-white/80 backdrop-blur-md border-b border-cream-dark/50 z-20">
                <div className="p-6">
                    <div className="flex items-center justify-between mb-6">
                        <button onClick={onBack} className="w-10 h-10 rounded-full bg-cream flex items-center justify-center text-nf-gray hover:text-pink transition-all border border-cream-dark/50 shadow-sm">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
                        </button>
                        
                        <div className="flex gap-1.5 bg-cream px-3 py-1.5 rounded-full border border-cream-dark/50">
                            {[1, 2, 3, 4, 5, 6].map((i) => (
                                <div key={i} className={`w-2 h-2 rounded-full transition-all duration-500 ${i === 5 ? 'bg-pink scale-125' : (i < 5 ? 'bg-pink/40' : 'bg-cream-dark opacity-40')}`} />
                            ))}
                        </div>
                        <div className="w-10" />
                    </div>
                    <p className="text-[10px] tracking-[0.25em] text-pink uppercase font-black mb-1">Paso 5: Resumen</p>
                    <h1 className="font-serif text-3xl lg:text-4xl text-charcoal leading-tight">
                        Confirma tu <span className="text-pink italic">visita</span>
                    </h1>
                </div>
            </div>

            {/* SCROLLABLE SUMMARY CONTENT */}
            <div className="flex-1 overflow-y-auto px-6 py-8 custom-scrollbar">
                <div className="max-w-xl mx-auto space-y-8">
                    {/* Main Card */}
                    <div className="bg-white rounded-[3rem] p-8 shadow-2xl border border-cream-dark/50 relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-40 h-40 bg-pink/5 rounded-full -mr-20 -mt-20 blur-3xl animate-pulse" />

                        <div className="relative z-10">
                            <div className="flex items-center gap-5 mb-8">
                                <div className="w-14 h-14 rounded-2xl bg-pink/5 flex items-center justify-center text-2xl shadow-inner">
                                    ✨
                                </div>
                                <div>
                                    <p className="text-[9px] font-black text-nf-gray uppercase tracking-[0.2em] mb-1 opacity-50">Servicio Seleccionado</p>
                                    <h2 className="font-serif text-2xl text-charcoal font-black">{booking.service_name || '—'}</h2>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-6 py-8 border-y border-cream-dark/50">
                                <div>
                                    <p className="text-[9px] font-black text-nf-gray uppercase tracking-[0.2em] mb-3 flex items-center gap-2 opacity-50">
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
                                        Fecha
                                    </p>
                                    <p className="font-serif text-xl text-charcoal font-black">{formatFullDate(booking.date)}</p>
                                </div>
                                <div>
                                    <p className="text-[9px] font-black text-nf-gray uppercase tracking-[0.2em] mb-3 flex items-center gap-2 opacity-50">
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                                        Hora
                                    </p>
                                    <p className="font-serif text-xl text-charcoal font-black">{booking.time || '—'} HS</p>
                                </div>
                            </div>

                            {booking.staff_name && (
                                <div className="pt-8 flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-full bg-cream flex items-center justify-center text-xl ring-4 ring-cream/50 shadow-inner">
                                            👩‍🎨
                                        </div>
                                        <span className="text-[11px] font-black text-charcoal uppercase tracking-[0.15em]">{booking.staff_name}</span>
                                    </div>
                                    <span className="text-[9px] font-black text-pink uppercase tracking-widest bg-pink/5 px-4 py-1.5 rounded-full border border-pink/10">Personal Profesional</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Reference photos */}
                    <div className="px-2">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="font-serif text-2xl text-charcoal">Selección de <span className="italic">Inspiración</span></h3>
                            <span className="text-[10px] font-black text-nf-gray uppercase tracking-[0.2em] bg-white px-4 py-2 rounded-full border border-cream-dark/50 shadow-sm">
                                {localPreviews.length} capturas
                            </span>
                        </div>
                        <div className="flex gap-5 overflow-x-auto pb-4 scrollbar-hide pt-2">
                            {localPreviews.map((url, idx) => (
                                <div key={idx} className="w-20 h-24 rounded-2xl overflow-hidden flex-shrink-0 shadow-xl border-4 border-white transform hover:scale-110 hover:-rotate-2 transition-all duration-500">
                                    <img src={url} alt={`ref-${idx}`} className="w-full h-full object-cover" />
                                </div>
                            ))}
                            <button
                                onClick={onAddImage}
                                className="w-20 h-24 rounded-2xl border-4 border-dashed border-cream-dark flex items-center justify-center flex-shrink-0 bg-white/50 hover:bg-white hover:border-pink transition-all duration-500 group"
                            >
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="text-nf-gray/30 group-hover:text-pink transition-colors"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                            </button>
                        </div>
                    </div>

                    {/* Pricing Detail */}
                    <div className="bg-charcoal text-white rounded-[3rem] p-10 shadow-2xl relative overflow-hidden group">
                        <div className="absolute bottom-0 right-0 w-64 h-64 bg-white/5 rounded-full -mr-32 -mb-32 blur-3xl group-hover:bg-pink/10 transition-colors duration-1000" />
                        
                        <div className="relative z-10 space-y-8">
                            <div className="flex justify-between items-center pb-8 border-b border-white/10">
                                <div className="space-y-1">
                                    <span className="text-[10px] font-black uppercase tracking-[0.2em] opacity-40">Presupuesto Estimado</span>
                                    <p className="text-[9px] opacity-20 uppercase tracking-widest font-black">Sujeto a cambios en cita</p>
                                </div>
                                <span className="font-serif text-3xl font-black">${price.toFixed(2)}</span>
                            </div>

                            {advance > 0 && (
                                <>
                                    <div className="flex justify-between items-center text-pink py-4">
                                        <div className="space-y-1">
                                            <span className="text-[10px] font-black uppercase tracking-[0.3em]">Reserva (40%)</span>
                                            <p className="text-[9px] opacity-60 uppercase tracking-widest font-black">Abonas hoy para asegurar</p>
                                        </div>
                                        <span className="font-serif text-4xl font-black">${advance.toFixed(2)}</span>
                                    </div>

                                    <div className="p-6 rounded-[2rem] bg-white/5 border border-white/10 flex gap-4 items-center">
                                        <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center text-xl shadow-inner">🔒</div>
                                        <p className="text-[10px] text-white/40 leading-relaxed font-black uppercase tracking-widest">
                                            Pago 100% seguro. El saldo restante se abona al finalizar tu atención.
                                        </p>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* STICKY BOTTOM PANEL */}
            <div className="flex-none p-6 bg-white/90 backdrop-blur-xl border-t border-cream-dark/50 z-30 shadow-[0_-10px_40px_rgba(0,0,0,0.05)]">
                <div className="max-w-xl mx-auto space-y-6">
                    <button
                        onClick={onNext}
                        disabled={!booking.date || !booking.time || !booking.service_id}
                        className="w-full py-5 rounded-[2rem] text-sm font-black uppercase tracking-[0.2em] flex items-center justify-center gap-4 shadow-2xl btn-gradient text-white transform hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:grayscale"
                    >
                        Proceder al Pago
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
                    </button>
                    <p className="text-center text-[9px] tracking-[0.3em] text-nf-gray/30 uppercase font-black">
                        PROGRESO FINAL: 85%
                    </p>
                </div>
            </div>
        </div>
    );
}
