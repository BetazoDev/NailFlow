'use client';

import { Service } from '@/lib/types';
import { useState, useEffect } from 'react';
import { api } from '@/lib/api';

interface ServiceStepProps {
    selectedServiceId: string | null;
    onSelect: (service: Service) => void;
    onNext: () => void;
    onBack: () => void;
    tenantId?: string;
}

export default function ServiceStep({ selectedServiceId, onSelect, onNext, onBack, tenantId = 'demo' }: ServiceStepProps) {
    const [services, setServices] = useState<Service[]>([]);
    const [category, setCategory] = useState<string>('All');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function loadServices() {
            try {
                const data = await api.getServices();
                setServices(data);
            } catch (err) {
                console.error('Failed to load services:', err);
                setServices([]);
            } finally {
                setLoading(false);
            }
        }
        loadServices();
    }, [tenantId]);

    const categories = ['All', ...Array.from(new Set(services.map(s => s.category || 'Otros')))];
    const filteredServices = category === 'All'
        ? services
        : services.filter(s => (s.category || 'Otros') === category);

    return (
        <div className="flex flex-col h-full overflow-hidden animate-fade-in-up" style={{ background: 'var(--cream)' }}>
            {/* STICKY HEADER AREA */}
            <div className="flex-none bg-white/80 backdrop-blur-md border-b border-cream-dark/50 z-20">
                <div className="p-6">
                    <div className="flex items-center justify-between mb-6">
                        <button onClick={onBack} className="flex items-center gap-2 text-nf-gray text-xs font-bold uppercase tracking-widest hover:text-pink transition-colors group">
                            <div className="w-10 h-10 rounded-full bg-white shadow-soft flex items-center justify-center group-hover:bg-pink-pale transition-all">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
                            </div>
                            <span className="hidden sm:inline">Volver</span>
                        </button>
                        <div className="flex gap-1.5 bg-cream px-3 py-1.5 rounded-full border border-cream-dark/50">
                            {[1, 2, 3, 4, 5, 6].map((i) => (
                                <div key={i} className={`w-2 h-2 rounded-full transition-all duration-500 ${i === 2 ? 'bg-pink scale-125' : i < 2 ? 'bg-pink/40' : 'bg-cream-dark opacity-40'}`} />
                            ))}
                        </div>
                    </div>

                    <p className="text-[10px] tracking-[0.25em] text-pink uppercase font-black mb-1">Paso 2: Selección</p>
                    <h1 className="font-serif text-3xl lg:text-4xl text-charcoal leading-tight mb-6">
                        ¿Qué <span className="text-pink italic">experiencia</span> deseas?
                    </h1>

                    {/* Categories filter - Centered and Sticky */}
                    {!loading && services.length > 0 && (
                        <div className="flex justify-center">
                            <div className="flex gap-2 overflow-x-auto no-scrollbar py-2 max-w-full">
                                {categories.map((cat) => (
                                    <button
                                        key={cat}
                                        onClick={() => setCategory(cat)}
                                        className={`
                                            whitespace-nowrap px-6 py-2.5 rounded-full text-[10px] font-black uppercase tracking-[0.15em] transition-all duration-300
                                            ${category === cat
                                                ? 'bg-charcoal text-white shadow-xl scale-105'
                                                : 'bg-white text-nf-gray hover:bg-cream-dark border border-cream-dark/30'}
                                        `}
                                    >
                                        {cat}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* SCROLLABLE SERVICE LIST */}
            <div className="flex-1 overflow-y-auto px-6 py-8 custom-scrollbar">
                {loading ? (
                    <div className="flex flex-col items-center justify-center h-full gap-5">
                        <div className="relative">
                            <div className="w-16 h-16 border-4 border-pink/10 border-t-pink rounded-full animate-spin" />
                            <div className="absolute inset-0 flex items-center justify-center text-xl">💅</div>
                        </div>
                        <p className="font-serif italic text-nf-gray text-lg">Curando nuestro catálogo...</p>
                    </div>
                ) : filteredServices.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center py-20 opacity-60">
                        <div className="text-6xl mb-6">✨</div>
                        <p className="text-nf-gray font-serif italic text-xl">Próximamente más servicios mágicos...</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-6 pb-24">
                        {filteredServices.map((service) => {
                            const isSelected = selectedServiceId === service.id;
                            return (
                                <button
                                    key={service.id}
                                    onClick={() => onSelect(service)}
                                    className={`
                                        group relative flex flex-col w-full text-left rounded-[2.5rem] overflow-hidden transition-all duration-500
                                        ${isSelected ? 'shadow-2xl ring-2 ring-pink -translate-y-1' : 'shadow-sm hover:shadow-xl border border-cream-dark/50 hover:-translate-y-1'}
                                    `}
                                >
                                    <div className="flex items-center gap-6 p-6 bg-white">
                                        {/* Image/Icon */}
                                        <div className="relative w-28 h-28 rounded-[2rem] overflow-hidden shadow-inner flex-shrink-0 border-2 border-cream-dark/30">
                                            {service.image_url ? (
                                                <img src={api.getPublicUrl(service.image_url)} alt={service.name} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
                                            ) : (
                                                <div className="w-full h-full bg-gradient-to-br from-pink-pale to-cream-dark flex items-center justify-center text-4xl">✨</div>
                                            )}
                                            {isSelected && (
                                                <div className="absolute inset-0 bg-pink/20 backdrop-blur-[2px] flex items-center justify-center">
                                                    <div className="w-10 h-10 rounded-full bg-white shadow-xl flex items-center justify-center text-pink transform scale-110">
                                                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        {/* Info */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-3 mb-2">
                                                <span className="px-3 py-1 bg-pink/10 text-[9px] font-black text-pink uppercase tracking-[0.2em] rounded-full">
                                                    {service.category || 'General'}
                                                </span>
                                                <div className="flex items-center gap-1.5">
                                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--nf-gray)" strokeWidth="2.5"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                                                    <span className="text-[10px] font-black text-nf-gray uppercase tracking-widest">{service.duration_minutes} MIN</span>
                                                </div>
                                            </div>
                                            <h3 className="font-serif text-2xl text-charcoal leading-tight mb-3 group-hover:text-pink transition-colors line-clamp-2">{service.name}</h3>

                                            <div className="flex items-center justify-between">
                                                <span className="text-2xl font-bold text-charcoal">
                                                    {service.estimated_price > 0 ? `$${service.estimated_price}` : `--`}
                                                </span>
                                                <span className={`text-[10px] font-bold uppercase tracking-widest px-4 py-2 rounded-full transition-all ${isSelected ? 'bg-pink text-white' : 'bg-cream text-charcoal-light'}`}>
                                                    {isSelected ? 'Seleccionado' : 'Seleccionar'}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Description reveal */}
                                    {service.description && (
                                        <div className={`px-8 pb-6 bg-white text-xs text-charcoal-light leading-relaxed transition-all duration-500 italic ${isSelected ? 'max-h-32 opacity-100' : 'max-h-0 opacity-0 overflow-hidden'}`}>
                                            "{service.description}"
                                        </div>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* STICKY BOTTOM PANEL */}
            <div className={`
                flex-none p-6 bg-white/90 backdrop-blur-xl border-t border-cream-dark/50 transition-all duration-700 transform z-30
                ${selectedServiceId ? 'translate-y-0 opacity-100 shadow-[0_-10px_40px_rgba(0,0,0,0.08)]' : 'translate-y-full opacity-0 pointer-events-none'}
            `}>
                <div className="max-w-xl mx-auto flex items-center justify-between gap-6">
                    <div className="hidden sm:block">
                        <p className="text-[9px] font-black text-pink uppercase tracking-[0.3em] mb-1">Tu elección</p>
                        <p className="font-serif text-charcoal text-base font-bold truncate max-w-[200px]">
                            {services.find(s => s.id === selectedServiceId)?.name}
                        </p>
                    </div>
                    <button
                        onClick={onNext}
                        className="flex-1 py-5 rounded-[2rem] text-sm font-black uppercase tracking-[0.2em] flex items-center justify-center gap-4 shadow-2xl btn-gradient text-white transform hover:scale-[1.02] active:scale-[0.98] transition-all"
                    >
                        Seleccionar fecha y hora
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg>
                    </button>
                </div>
            </div>
        </div>

    );
}
