'use client';

import { useState, useRef, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Service } from '@/lib/types';

import { api } from '@/lib/api';
import { useTenant } from '@/lib/tenant-context';

const DURATION_OPTIONS = [15, 30, 45, 60, 90, 120, 150, 180];

function NewServiceContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const id = searchParams.get('id');

    const fileRef = useRef<HTMLInputElement>(null);
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [price, setPrice] = useState('');
    const [duration, setDuration] = useState(60);
    const [category, setCategory] = useState('');
    const [isPackage, setIsPackage] = useState(false);
    const [allServices, setAllServices] = useState<Service[]>([]);
    const [includedServiceIds, setIncludedServiceIds] = useState<string[]>([]);
    const [existingCategories, setExistingCategories] = useState<string[]>([]);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const { tenantId } = useTenant();

    useEffect(() => {
        if (tenantId) {
            setLoading(true);
            api.getServices()
                .then(services => {
                    setAllServices(services);
                    // Extract unique categories
                    const cats = Array.from(new Set(services.map(s => s.category).filter(Boolean) as string[]));
                    setExistingCategories(cats);

                    if (id) {
                        const data = services.find(s => s.id === id);
                        if (data) {
                            setName(data.name || '');
                            setDescription(data.description || '');
                            setPrice(data.estimated_price?.toString() || '');
                            setDuration(data.duration_minutes || 60);
                            setCategory(data.category || '');
                            setImagePreview(data.image_url || null);
                            setIsPackage(data.is_package || false);
                            setIncludedServiceIds(data.included_service_ids || []);
                        }
                    }
                })
                .finally(() => setLoading(false));
        }
    }, [id, tenantId]);

    const handleImage = (files: FileList | null) => {
        if (!files || files.length === 0) return;
        const file = files[0];
        setSelectedFile(file);
        const url = URL.createObjectURL(file);
        setImagePreview(url);
    };

    const handleSave = async () => {
        if (!name.trim() || !tenantId) return;
        setError(null);
        setSaving(true);

        try {
            console.log('Iniciando guardado de servicio...', { tenantId, name, price, category });
            let finalImageUrl = imagePreview || '';

            // If a NEW file was selected, upload it
            if (selectedFile) {
                console.log('Subiendo imagen...', selectedFile.name);
                try {
                    finalImageUrl = await api.uploadImage(tenantId, 'services', selectedFile);
                    console.log('Imagen subida con éxito:', finalImageUrl);
                } catch (imgError: any) {
                    console.error('Error subiendo imagen:', imgError);
                    throw new Error(`Error al subir la imagen: ${imgError.message || 'Intente de nuevo'}`);
                }
            }

            const serviceData = {
                tenant_id: tenantId,
                name: name.trim(),
                description: description.trim(),
                category: category.trim() || 'Otros',
                estimated_price: parseFloat(price) || 0,
                duration_minutes: duration,
                required_advance: Math.round((parseFloat(price) || 0) * 0.4),
                image_url: finalImageUrl,
                is_package: isPackage,
                included_service_ids: isPackage ? includedServiceIds : [],
            };

            console.log('Enviando datos a Firestore:', serviceData);
            if (id) {
                await api.updateService(id, serviceData);
                console.log('Servicio actualizado con éxito');
            } else {
                await api.createService(serviceData);
                console.log('Servicio creado con éxito');
            }
            console.log('Redirigiendo a /admin/services');
            router.push('/admin/services');
            router.refresh();
        } catch (error: any) {
            console.error('Error saving service:', error);
            setError(error.details || error.message || 'Error al guardar el servicio. Intenta de nuevo.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="min-h-full pb-24" style={{ background: 'var(--cream)' }}>
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-8 border-b border-aesthetic-accent/20 bg-aesthetic-cream/50 backdrop-blur-md sticky top-0 z-10 transition-all duration-500">
                <Link href="/admin/services" className="flex items-center justify-center size-10 rounded-full hover:bg-black/5 transition-colors">
                    <span className="material-symbol text-aesthetic-muted font-light">arrow_back</span>
                </Link>
                <div className="flex-1 text-center">
                    <h1 className="font-display text-xl font-medium tracking-tight text-aesthetic-taupe italic">
                        {id ? 'Editar Servicio' : 'Nuevo Servicio'}
                    </h1>
                </div>
                <button className="flex items-center justify-center size-10 rounded-full hover:bg-black/5 transition-colors">
                    <span className="material-symbol text-aesthetic-muted font-light">more_horiz</span>
                </button>
            </div>

            {loading ? (
                <div className="flex items-center justify-center h-64">
                    <div className="w-8 h-8 border-2 border-aesthetic-accent border-t-aesthetic-pink rounded-full animate-spin" />
                </div>
            ) : (
                <main className="max-w-md mx-auto w-full px-6 py-8 space-y-10">
                    {/* Photo upload */}
                    <section className="flex flex-col items-center gap-4">
                        <div
                            className="relative group cursor-pointer w-full aspect-square max-w-[280px] bg-white border border-dashed border-aesthetic-accent rounded-3xl flex flex-col items-center justify-center transition-all hover:bg-stone-50 overflow-hidden shadow-minimal"
                            onClick={() => fileRef.current?.click()}
                        >
                            {imagePreview ? (
                                <img src={api.getPublicUrl(imagePreview)} alt="preview" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                            ) : (
                                <div className="flex flex-col items-center gap-3 text-aesthetic-pink/40 group-hover:text-aesthetic-pink transition-colors">
                                    <span className="material-symbol text-4xl font-light">photo_camera</span>
                                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] font-display italic">Agregar Miniatura</p>
                                </div>
                            )}
                        </div>
                        <p className="text-[11px] text-aesthetic-muted/60 text-center px-8 leading-relaxed italic font-display">Sube una foto de alta calidad para destacar tu trabajo</p>
                        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => handleImage(e.target.files)} />
                    </section>

                    <div className="space-y-8">
                        {/* Type Toggle */}
                        <div className="flex gap-2 p-1 bg-white/50 rounded-2xl border border-aesthetic-accent shadow-minimal">
                            <button 
                                onClick={() => setIsPackage(false)}
                                className={`flex-1 py-3 rounded-xl text-xs font-bold uppercase tracking-widest transition-all ${!isPackage ? 'bg-aesthetic-taupe text-white shadow-lg' : 'text-aesthetic-muted hover:text-aesthetic-taupe'}`}
                            >
                                Servicio
                            </button>
                            <button 
                                onClick={() => setIsPackage(true)}
                                className={`flex-1 py-3 rounded-xl text-xs font-bold uppercase tracking-widest transition-all ${isPackage ? 'bg-aesthetic-taupe text-white shadow-lg' : 'text-aesthetic-muted hover:text-aesthetic-taupe'}`}
                            >
                                Paquete
                            </button>
                        </div>

                        {/* Name */}
                        <div className="space-y-2">
                            <label className="font-display text-xs font-medium tracking-wider text-aesthetic-muted ml-1 italic">Nombre del Servicio</label>
                            <input
                                className="w-full bg-white border-none ring-1 ring-aesthetic-accent focus:ring-aesthetic-pink/30 rounded-2xl p-4 text-base font-display italic shadow-minimal transition-all placeholder:text-aesthetic-muted/30"
                                placeholder="ej. Kapping Gel + Nail Art"
                                value={name}
                                onChange={e => setName(e.target.value)}
                            />
                        </div>

                        {/* Category */}
                        <div className="space-y-2">
                            <label className="font-display text-xs font-medium tracking-wider text-aesthetic-muted ml-1 italic">Categoría</label>
                            <div className="relative">
                                <input
                                    list="categories"
                                    className="w-full bg-white border-none ring-1 ring-aesthetic-accent focus:ring-aesthetic-pink/30 rounded-2xl p-4 text-base font-display italic shadow-minimal transition-all placeholder:text-aesthetic-muted/30"
                                    placeholder="Selecciona o escribe una categoría"
                                    value={category}
                                    onChange={e => setCategory(e.target.value)}
                                />
                                <datalist id="categories">
                                    {existingCategories.map(cat => (
                                        <option key={cat} value={cat} />
                                    ))}
                                </datalist>
                                <span className="material-symbol absolute right-4 top-1/2 -translate-y-1/2 text-aesthetic-muted/30 pointer-events-none">expand_more</span>
                            </div>
                        </div>

                        {/* Description */}
                        <div className="space-y-2">
                            <label className="font-display text-xs font-medium tracking-wider text-aesthetic-muted ml-1 italic">Descripción</label>
                            <textarea
                                rows={4}
                                className="w-full bg-white border-none ring-1 ring-aesthetic-accent focus:ring-aesthetic-pink/30 rounded-2xl p-4 text-base font-display italic shadow-minimal transition-all resize-none placeholder:text-aesthetic-muted/30"
                                placeholder="Describe el procedimiento..."
                                value={description}
                                onChange={e => setDescription(e.target.value)}
                            />
                        </div>

                        {/* Price + Duration */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="font-display text-xs font-medium tracking-wider text-aesthetic-muted ml-1 italic">Precio ($)</label>
                                <div className="relative">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-aesthetic-muted/40 font-display italic">$</span>
                                    <input
                                        className="w-full bg-white border-none ring-1 ring-aesthetic-accent focus:ring-aesthetic-pink/30 rounded-2xl p-4 text-base font-display italic shadow-minimal transition-all pl-8"
                                        placeholder="0.00"
                                        value={price}
                                        onChange={e => setPrice(e.target.value.replace(/[^0-9.]/g, ''))}
                                        inputMode="decimal"
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="font-display text-xs font-medium tracking-wider text-aesthetic-muted ml-1 italic">Duración</label>
                                <div className="relative">
                                    <select
                                        className="w-full appearance-none bg-white border-none ring-1 ring-aesthetic-accent focus:ring-aesthetic-pink/30 rounded-2xl p-4 text-base font-display italic shadow-minimal transition-all pr-10"
                                        value={duration}
                                        onChange={e => setDuration(Number(e.target.value))}
                                    >
                                        {DURATION_OPTIONS.map(d => (
                                            <option key={d} value={d}>{d} min</option>
                                        ))}
                                    </select>
                                    <span className="material-symbol absolute right-3 top-1/2 -translate-y-1/2 text-aesthetic-muted/40 pointer-events-none text-xl">expand_more</span>
                                </div>
                            </div>
                        </div>

                        {/* Included services (FOR PACKAGES) */}
                        {isPackage && (
                            <div className="space-y-4 animate-fade-in">
                                <label className="font-display text-xs font-medium tracking-wider text-aesthetic-muted ml-1 italic">Servicios Incluidos</label>
                                <div className="grid grid-cols-1 gap-2">
                                    {allServices.filter(s => !s.is_package && s.id !== id).map(s => (
                                        <button
                                            key={s.id}
                                            onClick={() => {
                                                if (includedServiceIds.includes(s.id)) {
                                                    setIncludedServiceIds(prev => prev.filter(i => i !== s.id));
                                                } else {
                                                    setIncludedServiceIds(prev => [...prev, s.id]);
                                                }
                                            }}
                                            className={`flex items-center gap-3 p-4 rounded-2xl border transition-all ${
                                                includedServiceIds.includes(s.id)
                                                ? 'bg-aesthetic-soft-pink/30 border-aesthetic-pink shadow-minimal'
                                                : 'bg-white border-aesthetic-accent/20 hover:border-aesthetic-pink/30'
                                            }`}
                                        >
                                            <div className={`size-5 rounded-full border-2 flex items-center justify-center transition-all ${
                                                includedServiceIds.includes(s.id) ? 'border-aesthetic-pink bg-aesthetic-pink' : 'border-aesthetic-accent'
                                            }`}>
                                                {includedServiceIds.includes(s.id) && <span className="material-symbol text-white text-[10px] font-bold">check</span>}
                                            </div>
                                            <div className="text-left flex-1 min-w-0">
                                                <p className="text-sm font-display italic text-aesthetic-taupe truncate leading-tight">{s.name}</p>
                                                <p className="text-[10px] text-aesthetic-muted font-bold tracking-widest">{s.duration_minutes} min</p>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                                {allServices.filter(s => !s.is_package && s.id !== id).length === 0 && (
                                    <p className="text-[11px] text-aesthetic-muted italic text-center py-4">No hay servicios registrados para incluir.</p>
                                )}
                            </div>
                        )}
                    </div>

                    {error && (
                        <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-2xl text-sm font-display italic animate-fade-in">
                            <span className="material-symbol align-middle mr-2 text-lg">error</span>
                            {error}
                        </div>
                    )}

                    {/* CTA */}
                    <section className="pt-4 pb-12">
                        <button
                            onClick={handleSave}
                            disabled={saving || !name.trim()}
                            className="w-full bg-aesthetic-pink text-white hover:bg-aesthetic-taupe transition-all duration-500 py-5 rounded-3xl text-sm font-bold tracking-[0.3em] uppercase shadow-minimal active:scale-[0.98] border border-white/20 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {saving ? (
                                <div className="size-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                            ) : (
                                id ? 'ACTUALIZAR SERVICIO' : 'GUARDAR SERVICIO'
                            )}
                        </button>
                        <p className="text-center mt-8 text-aesthetic-muted/40 text-[9px] tracking-[0.3em] uppercase font-display italic">Estética & Elegancia Profesional</p>
                    </section>
                </main>
            )}
        </div>
    );
}

export default function NewServicePage() {
    return (
        <Suspense fallback={
            <div className="flex items-center justify-center h-screen" style={{ background: 'var(--cream)' }}>
                <div className="w-8 h-8 border-2 border-aesthetic-accent border-t-aesthetic-pink rounded-full animate-spin" />
            </div>
        }>
            <NewServiceContent />
        </Suspense>
    );
}
