'use client';

import { Service } from '@/lib/types';
import { api } from '@/lib/api';
import { useState, useEffect } from 'react';

interface ServiceStepProps {
    selectedServiceId: string | null;
    onSelect: (service: Service) => void;
    onNext: () => void;
    onBack: () => void;
}

const CATEGORY_ICONS: Record<string, string> = {
    'Manicura': '💅',
    'Acrílicas': '✨',
    'Gel': '💎',
    'Diseño': '🎨',
    'Pedicura': '🦶',
};

export default function ServiceStep({ selectedServiceId, onSelect, onNext, onBack }: ServiceStepProps) {
    const [services, setServices] = useState<Service[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        api.getServices()
            .then(data => setServices(data.filter(s => s.active)))
            .finally(() => setLoading(false));
    }, []);

    return (
        <div className="flex flex-col h-full animate-fade-in-up">
            <div className="px-6 pt-4 pb-2">
                <button onClick={onBack} className="flex items-center gap-1 text-nf-gray text-sm mb-3 hover:text-charcoal transition-colors">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
                    Atrás
                </button>
                <h2 className="font-serif text-2xl font-semibold text-charcoal mb-1">Elige tu servicio</h2>
                <p className="text-sm text-nf-gray">Selecciona el tipo de servicio que deseas</p>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4">
                <div className="space-y-3 stagger-children">
                    {services.map((service) => {
                        const isSelected = selectedServiceId === service.id;
                        return (
                            <button
                                key={service.id}
                                onClick={() => onSelect(service)}
                                className={`
                  w-full text-left p-4 rounded-2xl transition-all duration-200 border-2
                  ${isSelected
                                        ? 'border-pink bg-pink-pale shadow-md'
                                        : 'border-transparent bg-white shadow-sm hover:shadow-md hover:border-cream-dark'
                                    }
                `}
                            >
                                <div className="flex items-start gap-3">
                                    <div className={`
                    w-12 h-12 rounded-xl flex items-center justify-center text-xl flex-shrink-0
                    ${isSelected ? 'bg-white' : 'bg-cream-dark/50'}
                  `}
                                        style={isSelected ? { background: 'linear-gradient(135deg, var(--pink-light), var(--coral-light))' } : {}}
                                    >
                                        {CATEGORY_ICONS[service.category] || '💅'}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-start justify-between gap-2">
                                            <h3 className="font-semibold text-charcoal text-[15px]">{service.name}</h3>
                                            <span className="font-serif font-bold text-charcoal text-lg whitespace-nowrap">
                                                ${service.estimated_price}
                                            </span>
                                        </div>
                                        <p className="text-xs text-nf-gray mt-0.5 line-clamp-2">{service.description}</p>
                                        <div className="flex items-center gap-3 mt-2">
                                            <span className="text-xs text-charcoal-light font-medium flex items-center gap-1">
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg>
                                                {service.duration_minutes} min
                                            </span>
                                            <span className="text-xs text-pink font-medium">
                                                Anticipo: ${service.required_advance}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </button>
                        );
                    })}
                </div>
            </div>

            <div className="p-6">
                <button
                    onClick={onNext}
                    disabled={!selectedServiceId}
                    className="btn-gradient w-full py-4 rounded-2xl text-base"
                >
                    Continuar
                </button>
            </div>
        </div>
    );
}
