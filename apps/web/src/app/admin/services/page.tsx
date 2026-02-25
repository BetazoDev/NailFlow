'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { Service } from '@/lib/types';

const CATEGORY_ICONS: Record<string, string> = {
    'Manicura': '💅',
    'Acrílicas': '✨',
    'Gel': '💎',
    'Diseño': '🎨',
    'Pedicura': '🦶',
};

export default function ServicesPage() {
    const [services, setServices] = useState<Service[]>([]);
    const [showForm, setShowForm] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        api.getServices()
            .then(data => setServices(data))
            .finally(() => setLoading(false));
    }, []);

    const categories = [...new Set(services.map(s => s.category))];

    return (
        <div className="animate-fade-in">
            {/* Header */}
            <div className="flex items-center justify-between px-6 pt-12 pb-4">
                <h1 className="font-serif text-2xl font-semibold text-charcoal">Servicios</h1>
                <button
                    onClick={() => setShowForm(!showForm)}
                    className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-cream-dark transition-colors"
                    style={showForm ? {} : { background: 'linear-gradient(135deg, var(--pink), var(--coral))' }}
                >
                    <svg
                        width="20" height="20" viewBox="0 0 24 24" fill="none"
                        stroke={showForm ? 'var(--charcoal)' : 'white'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                    >
                        {showForm ? (
                            <><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></>
                        ) : (
                            <><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></>
                        )}
                    </svg>
                </button>
            </div>

            {/* Add service form (placeholder) */}
            {showForm && (
                <div className="mx-6 mb-4 bg-white rounded-2xl p-5 shadow-md border border-cream-dark/50 animate-scale-in">
                    <h3 className="font-serif text-lg font-semibold text-charcoal mb-4">Nuevo servicio</h3>
                    <div className="space-y-3">
                        <input className="input-field" placeholder="Nombre del servicio" />
                        <textarea className="input-field resize-none" rows={2} placeholder="Descripción" />
                        <div className="grid grid-cols-2 gap-3">
                            <input className="input-field" placeholder="Precio ($)" type="number" />
                            <input className="input-field" placeholder="Duración (min)" type="number" />
                        </div>
                        <input className="input-field" placeholder="Anticipo requerido ($)" type="number" />
                        <button className="btn-gradient w-full py-3.5 rounded-xl text-sm">
                            Guardar servicio
                        </button>
                    </div>
                </div>
            )}

            {/* Services by category */}
            <div className="px-6">
                {categories.map((cat) => (
                    <div key={cat} className="mb-6">
                        <p className="text-[11px] font-semibold text-nf-gray uppercase tracking-[1.5px] mb-3">
                            {cat}
                        </p>

                        {/* Mobile Cards */}
                        <div className="space-y-2.5 stagger-children lg:hidden">
                            {services.filter(s => s.category === cat).map((service) => (
                                <div
                                    key={service.id}
                                    className="flex items-center bg-white rounded-xl p-4 shadow-sm border border-black/[0.03] hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-pointer"
                                >
                                    <div className="w-11 h-11 rounded-xl flex items-center justify-center text-lg flex-shrink-0 mr-3.5" style={{ background: 'linear-gradient(135deg, var(--pink-pale), var(--coral-light))' }}>
                                        {CATEGORY_ICONS[service.category] || '💅'}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-[15px] font-semibold text-charcoal truncate">{service.name}</p>
                                        <p className="text-xs text-nf-gray truncate">{service.description}</p>
                                    </div>
                                    <div className="text-right flex-shrink-0 ml-3">
                                        <p className="font-serif text-lg font-bold text-charcoal">${service.estimated_price}</p>
                                        <p className="text-[11px] text-nf-gray">{service.duration_minutes} min</p>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Desktop Table */}
                        <div className="hidden lg:block bg-white rounded-2xl shadow-sm border border-cream-dark/50 overflow-hidden">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-cream/50 border-b border-cream-dark/50">
                                        <th className="py-3 px-5 font-serif font-semibold text-nf-gray text-sm w-12"></th>
                                        <th className="py-3 px-5 font-serif font-semibold text-nf-gray text-sm">Servicio</th>
                                        <th className="py-3 px-5 font-serif font-semibold text-nf-gray text-sm">Duración</th>
                                        <th className="py-3 px-5 font-serif font-semibold text-nf-gray text-sm">Anticipo</th>
                                        <th className="py-3 px-5 font-serif font-semibold text-nf-gray text-sm text-right">Precio Total</th>
                                        <th className="py-3 px-5 font-serif font-semibold text-nf-gray text-sm text-center w-16">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {services.filter(s => s.category === cat).map((service) => (
                                        <tr key={service.id} className="border-b border-cream-dark/20 hover:bg-pink-pale/30 transition-colors">
                                            <td className="py-3 px-5">
                                                <div className="w-9 h-9 rounded-lg flex items-center justify-center text-sm" style={{ background: 'linear-gradient(135deg, var(--pink-pale), var(--coral-light))' }}>
                                                    {CATEGORY_ICONS[service.category] || '💅'}
                                                </div>
                                            </td>
                                            <td className="py-3 px-5">
                                                <p className="font-semibold text-charcoal text-[15px]">{service.name}</p>
                                                <p className="text-xs text-nf-gray flex items-center gap-1 max-w-sm truncate" title={service.description}>
                                                    {service.description}
                                                </p>
                                            </td>
                                            <td className="py-3 px-5 text-sm text-charcoal-light">
                                                <span className="inline-flex items-center gap-1.5 bg-cream/70 px-2.5 py-1 rounded-md">
                                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg>
                                                    {service.duration_minutes} min
                                                </span>
                                            </td>
                                            <td className="py-3 px-5 text-sm font-medium text-pink">${service.required_advance}</td>
                                            <td className="py-3 px-5 text-right font-serif font-bold text-lg text-charcoal">${service.estimated_price}</td>
                                            <td className="py-3 px-5 text-center">
                                                <button className="p-1.5 text-gray-light hover:text-pink transition-colors rounded-lg hover:bg-pink-pale">
                                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
