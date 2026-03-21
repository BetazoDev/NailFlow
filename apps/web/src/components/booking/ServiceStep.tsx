'use client';

import { Service } from '@/lib/types';
import { useState, useEffect } from 'react';
import { api } from '@/lib/api';

interface ServiceStepProps {
    selectedServiceIds: string[];
    onToggle: (service: Service) => void;
    onNext: () => void;
    onBack: () => void;
    tenantId?: string;
}

export default function ServiceStep({ selectedServiceIds, onToggle, onNext, onBack, tenantId = 'demo' }: ServiceStepProps) {
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

    const totalSelected = selectedServiceIds.length;
    const totalPrice = services
        .filter(s => selectedServiceIds.includes(s.id))
        .reduce((sum, s) => sum + (Number(s.estimated_price) || 0), 0);

    return (
        <div className="flex flex-col h-full relative" style={{ background: 'var(--cream)' }}>
            {/* Header: Sticky at the top */}
            <div className="bg-white/80 backdrop-blur-md sticky top-0 z-30 border-b border-cream-dark/30 shadow-sm">
                <div className="flex items-center justify-between px-6 pt-6 pb-2">
                    <button onClick={onBack} className="flex items-center gap-2 text-nf-gray text-xs font-bold uppercase tracking-widest hover:text-pink transition-colors group">
                        <div className="w-8 h-8 rounded-full bg-white shadow-sm flex items-center justify-center group-hover:bg-pink-pale transition-colors">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
                        </div>
                    </button>
                    <div className="flex gap-1.5">
                        <div className="w-2 h-2 rounded-full bg-pink opacity-20" />
                        <div className="w-2 h-2 rounded-full bg-pink" />
                        {[...Array(5)].map((_, i) => (
                            <div key={i} className="w-2 h-2 rounded-full bg-cream-dark opacity-30" />
                        ))}
                    </div>
                </div>

                <div className="px-6 pt-4 pb-2">
                    <p className="text-[10px] tracking-[0.2em] text-nf-gray uppercase font-bold mb-1">Paso 2: Servicios</p>
                    <h1 className="font-serif text-3xl text-charcoal leading-tight">
                        ¿Qué <span className="text-pink">deseo</span> hoy?
                    </h1>
                </div>

                {/* Categories filter */}
                {!loading && services.length > 0 && (
                    <div className="w-full pb-3">
                        <div className="flex gap-2 overflow-x-auto thin-scrollbar px-6 py-2 relative after:content-[''] after:pr-6">
                            {categories.map((cat) => (
                                <button
                                    key={cat}
                                    onClick={() => setCategory(cat)}
                                    className={`
                                        whitespace-nowrap px-6 py-2.5 rounded-full text-[10px] font-bold uppercase tracking-[0.2em] transition-all duration-300
                                        ${category === cat
                                            ? 'bg-aesthetic-taupe text-white shadow-md scale-105'
                                            : 'bg-white text-aesthetic-muted border border-aesthetic-accent/50 hover:bg-aesthetic-cream/40'}
                                    `}
                                >
                                    {cat}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Service list: Only this area scrolls */}
            <div className="flex-1 overflow-y-auto no-scrollbar px-6 py-6 scroll-smooth">
                {loading ? (
                    <div className="flex flex-col items-center justify-center h-64 gap-4">
                        <div className="w-10 h-10 border-3 border-pink-pale border-t-pink rounded-full animate-spin" />
                        <p className="font-serif italic text-nf-gray">Preparando catálogo...</p>
                    </div>
                ) : filteredServices.length === 0 ? (
                    <div className="text-center py-20">
                        <div className="text-4xl mb-4 opacity-20">✨</div>
                        <p className="text-nf-gray font-serif italic text-lg">Próximamente más servicios...</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-5 stagger-children pb-10">
                        {filteredServices.map((service) => {
                            const isSelected = selectedServiceIds.includes(service.id);
                            return (
                                <button
                                    key={service.id}
                                    onClick={() => onToggle(service)}
                                    className={`
                                        group relative flex flex-col w-full text-left rounded-[2rem] overflow-hidden transition-all duration-300
                                        ${isSelected ? 'shadow-2xl -translate-y-1' : 'shadow-md hover:shadow-xl hover:-translate-y-0.5'}
                                    `}
                                >
                                    <div className={`
                                        flex items-center gap-5 p-5 bg-white
                                        ${isSelected ? 'ring-2 ring-pink' : ''}
                                    `}>
                                        {/* Image/Icon */}
                                        <div className="relative w-24 h-24 rounded-2xl overflow-hidden shadow-inner flex-shrink-0">
                                            {service.image_url ? (
                                                <img src={api.getPublicUrl(service.image_url)} alt={service.name} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                                            ) : (
                                                <div className="w-full h-full bg-pink-pale flex items-center justify-center text-3xl">💅</div>
                                            )}
                                        </div>

                                        {/* Info */}
                                        <div className="flex-1 min-w-0 pr-4">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="text-[10px] font-bold text-pink uppercase tracking-widest">{service.category || 'General'}</span>
                                            </div>
                                            <h3 className="font-serif text-xl text-charcoal leading-tight mb-2 group-hover:text-pink transition-colors line-clamp-2">{service.name}</h3>

                                            <div className="flex items-center gap-4">
                                                <div className="flex items-center gap-1.5">
                                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--nf-gray)" strokeWidth="2"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                                                    <span className="text-[11px] font-bold text-nf-gray">{service.duration_minutes} MIN</span>
                                                </div>
                                                <div className="w-1 h-1 rounded-full bg-cream-dark" />
                                                <div className="flex items-center gap-1.5">
                                                    <span className="text-lg font-bold text-charcoal">
                                                        {service.estimated_price > 0 ? `$${service.estimated_price}` : `--`}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Select Indicator */}
                                        <div className={`
                                            absolute top-4 right-4 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all duration-300
                                            ${isSelected ? 'bg-pink border-pink scale-110 rotate-0 shadow-lg' : 'border-cream-dark opacity-30 -rotate-90 scale-75'}
                                        `}>
                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                                        </div>
                                    </div>

                                    {/* Description reveal */}
                                    {service.description && (
                                        <div className={`px-6 pb-4 bg-white text-[11px] text-nf-gray leading-relaxed transition-all duration-300 ${isSelected ? 'max-h-20 opacity-100 italic' : 'max-h-0 opacity-0'}`}>
                                            {service.description}
                                        </div>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Bottom Panel: Sticky at the bottom */}
            <div className={`
                sticky bottom-0 left-0 right-0 p-6 bg-white/80 backdrop-blur-xl border-t border-cream-dark/50 transition-all duration-500 transform z-40
                ${totalSelected > 0 ? 'translate-y-0 opacity-100 shadow-up' : 'translate-y-full opacity-0 pointer-events-none'}
            `}>
                <div className="max-w-lg mx-auto flex items-center justify-between gap-4">
                    <div className="min-w-0">
                        <p className="text-[10px] font-bold text-pink uppercase tracking-widest mb-0.5">
                            {totalSelected} {totalSelected === 1 ? 'Servicio' : 'Servicios'}
                        </p>
                        <p className="font-serif text-charcoal text-xl font-bold">
                            ${totalPrice}
                        </p>
                    </div>
                    <button
                        onClick={onNext}
                        className="flex-1 py-5 rounded-full text-base font-serif flex items-center justify-center gap-3 shadow-lg btn-gradient text-white hover:scale-105 active:scale-95 transition-all"
                    >
                        Siguiente
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg>
                    </button>
                </div>
            </div>
        </div>
    );
}
