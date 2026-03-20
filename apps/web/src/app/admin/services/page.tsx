'use client';

import { useState, useEffect } from 'react';
import { Service } from '@/lib/types';
import Link from 'next/link';

import { api } from '@/lib/api';
import { useTenant } from '@/lib/tenant-context';

export default function ServicesPage() {
    const [services, setServices] = useState<Service[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [deleteTarget, setDeleteTarget] = useState<Service | null>(null);
    const [deleting, setDeleting] = useState(false);

    const { tenantId } = useTenant();

    useEffect(() => {
        if (!tenantId) return;
        api.getServices()
            .then(setServices)
            .finally(() => setLoading(false));
    }, [tenantId]);

    const filtered = services.filter(s =>
        !search || s.name.toLowerCase().includes(search.toLowerCase())
    );

    const groupedServices = filtered.reduce((acc, curr) => {
        const cat = curr.category || 'Otros';
        if (!acc[cat]) acc[cat] = [];
        acc[cat].push(curr);
        return acc;
    }, {} as Record<string, Service[]>);

    const handleDelete = async () => {
        if (!deleteTarget || !tenantId) return;
        setDeleting(true);
        try {
            await api.deleteService(deleteTarget.id);
            setServices(prev => prev.filter(s => s.id !== deleteTarget.id));
            setDeleteTarget(null);
        } catch (e) {
            console.error('Error deleting service:', e);
        } finally {
            setDeleting(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="w-8 h-8 border-2 border-aesthetic-accent border-t-aesthetic-pink rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div className="relative min-h-full pb-24" style={{ background: 'var(--cream)' }}>
            {/* Header */}
            <div className="px-6 pt-8 pb-0">
                <p className="text-[10px] tracking-[0.3em] text-aesthetic-muted uppercase mb-2 font-display italic font-medium">Gestión del Catálogo</p>
                <div className="flex items-center justify-between">
                    <h1 className="font-display text-4xl font-light italic tracking-tight text-aesthetic-taupe">Servicios</h1>
                    <Link
                        href="/admin/services/new"
                        className="text-[10px] tracking-[0.2em] uppercase font-bold px-4 py-2 rounded-full transition-all duration-300 bg-aesthetic-pink text-white shadow-minimal hover:scale-105 active:scale-95 flex items-center gap-1"
                    >
                        <span className="material-symbol text-sm">add</span>
                        Nuevo
                    </Link>
                </div>
            </div>

            {/* Search */}
            <div className="px-6 mt-6">
                <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <span className="material-symbol text-aesthetic-muted/60 text-xl">search</span>
                    </div>
                    <input
                        className="block w-full pl-11 pr-4 py-3.5 bg-aesthetic-soft-pink/40 border-none rounded-full focus:ring-1 focus:ring-aesthetic-pink/30 placeholder:text-aesthetic-muted/50 text-base font-display italic"
                        placeholder="Buscar servicio..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                </div>
            </div>

            {/* Service list grouped by categories */}
            <div className="px-6 mt-6 space-y-8">
                {Object.entries(groupedServices).map(([category, catServices]) => (
                    <div key={category} className="space-y-3">
                        <h2 className="font-display text-lg font-medium text-aesthetic-taupe italic ml-2">{category}</h2>
                        <div className="space-y-3 stagger-children">
                            {catServices.map(service => (
                                <div key={service.id} className="bg-white rounded-2xl p-4 shadow-sm flex items-center gap-4 border border-aesthetic-accent/10">
                                    {/* Thumbnail */}
                                    <div className="w-14 h-14 rounded-xl overflow-hidden flex-shrink-0 bg-aesthetic-cream/30 border border-aesthetic-accent/20">
                                        {service.image_url && service.image_url.trim() !== '' ? (
                                            <img
                                                src={api.getPublicUrl(service.image_url)}
                                                alt={service.name}
                                                className="w-full h-full object-cover"
                                                onError={(e) => {
                                                    const target = e.target as HTMLImageElement;
                                                    target.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23d1c7bd"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/></svg>';
                                                }}
                                            />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-aesthetic-muted/30">
                                                <span className="material-symbol text-2xl font-light">spa</span>
                                            </div>
                                        )}
                                    </div>
                                    {/* Info */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <p className="font-semibold text-aesthetic-taupe text-[15px] truncate">{service.name}</p>
                                            {service.is_package && (
                                                <span className="text-[7px] tracking-widest uppercase font-bold px-1.5 py-0.5 rounded bg-aesthetic-pink text-white">Paquete</span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-3 mt-1">
                                            <span className="text-xs text-aesthetic-muted flex items-center gap-1">
                                                <span className="material-symbol text-sm font-light">schedule</span>
                                                {service.duration_minutes === 0 ? 'Varía' : `${service.duration_minutes} min`}
                                            </span>
                                            <span className="text-xs font-semibold text-aesthetic-taupe">
                                                {service.estimated_price > 0 ? `$${service.estimated_price}` : `Desde $${service.required_advance}`}
                                            </span>
                                        </div>
                                    </div>
                                    {/* Actions */}
                                    <div className="flex items-center gap-2 flex-shrink-0">
                                        <Link href={`/admin/services/new?id=${service.id}`} className="size-10 flex items-center justify-center rounded-xl bg-aesthetic-soft-pink/30 text-aesthetic-muted hover:bg-aesthetic-pink hover:text-white transition-colors duration-300">
                                            <span className="material-symbol text-lg font-light">edit</span>
                                        </Link>
                                        <button
                                            onClick={() => setDeleteTarget(service)}
                                            className="size-10 flex items-center justify-center rounded-xl bg-red-50 text-red-300 hover:bg-red-100 hover:text-red-500 transition-colors duration-300"
                                        >
                                            <span className="material-symbol text-lg font-light">delete</span>
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}

                {filtered.length === 0 && !search && (
                    <div className="text-center py-10">
                        <p className="text-aesthetic-muted text-sm italic font-display">Sin servicios aún. ¡Agrega el primero!</p>
                    </div>
                )}
            </div>

            {/* FAB */}
            <Link href="/admin/services/new" className="fixed bottom-32 right-6 size-14 bg-aesthetic-pink text-white rounded-full shadow-lg flex items-center justify-center transition-all hover:scale-105 active:scale-95 z-30">
                <span className="material-symbol text-3xl font-light">add</span>
            </Link>

            {/* Delete Confirmation Modal */}
            {deleteTarget && (
                <div className="fixed inset-0 bg-aesthetic-taupe/40 backdrop-blur-md z-[100] flex items-center justify-center p-6 animate-fade-in" onClick={() => !deleting && setDeleteTarget(null)}>
                    <div className="bg-aesthetic-cream rounded-[2.5rem] p-10 w-full max-w-sm shadow-2xl relative border border-white/50 text-center" onClick={e => e.stopPropagation()}>
                        {/* Decorative */}
                        <div className="absolute top-0 right-0 size-32 bg-red-100/30 blur-3xl rounded-full -mr-16 -mt-16" />

                        <div className="relative">
                            <div className="size-16 rounded-full bg-red-50 border border-red-100 flex items-center justify-center mx-auto mb-6">
                                <span className="material-symbol text-red-400 text-3xl">delete_forever</span>
                            </div>
                            <h3 className="font-display text-2xl italic text-aesthetic-taupe mb-3">¿Eliminar Servicio?</h3>
                            <p className="text-sm text-aesthetic-muted mb-8 leading-relaxed">
                                Se eliminará <strong className="text-aesthetic-taupe">&ldquo;{deleteTarget.name}&rdquo;</strong> permanentemente. Esta acción no se puede deshacer.
                            </p>

                            <div className="flex gap-3">
                                <button
                                    onClick={() => setDeleteTarget(null)}
                                    disabled={deleting}
                                    className="flex-1 py-4 rounded-full border border-aesthetic-accent text-aesthetic-muted text-[10px] tracking-[0.2em] uppercase font-bold hover:bg-white transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleDelete}
                                    disabled={deleting}
                                    className="flex-1 py-4 rounded-full bg-red-500 text-white text-[10px] tracking-[0.2em] uppercase font-bold shadow-minimal hover:bg-red-600 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    {deleting ? (
                                        <div className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    ) : (
                                        'Eliminar'
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
