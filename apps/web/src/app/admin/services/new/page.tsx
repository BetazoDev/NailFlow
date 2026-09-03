'use client';

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import { useSession } from '@/lib/session-context';

const DURATION_OPTIONS = [15, 30, 45, 60, 90, 120, 150, 180];

/** Suggested deposit, as a share of the price. The salon can override it. */
const DEFAULT_DEPOSIT_RATE = 0.4;

function NewServiceContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const id = searchParams.get('id');
    const { tenant } = useSession();

    const fileRef = useRef<HTMLInputElement>(null);

    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [price, setPrice] = useState('');
    const [advance, setAdvance] = useState('');
    const [duration, setDuration] = useState(60);
    const [category, setCategory] = useState('');
    const [active, setActive] = useState(true);

    const [existingCategories, setExistingCategories] = useState<string[]>([]);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!tenant) return;
        let cancelled = false;

        api.getServices({ includeInactive: true })
            .then(services => {
                if (cancelled) return;

                setExistingCategories(
                    [...new Set(services.map(service => service.category).filter(Boolean) as string[])].sort()
                );

                if (!id) return;

                const service = services.find(item => item.id === id);
                if (!service) {
                    setError('Ese servicio ya no existe.');
                    return;
                }

                setName(service.name);
                setDescription(service.description ?? '');
                setPrice(String(service.estimated_price ?? ''));
                setAdvance(String(service.required_advance ?? ''));
                setDuration(service.duration_minutes || 60);
                setCategory(service.category ?? '');
                setImagePreview(service.image_url);
                setActive(service.active);
            })
            .catch(() => {
                if (!cancelled) setError('No pudimos cargar el catálogo. Recarga la página.');
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, [id, tenant]);

    const numericPrice = Number(price) || 0;
    const numericAdvance = advance === '' ? Math.round(numericPrice * DEFAULT_DEPOSIT_RATE) : Number(advance) || 0;

    const validationError = useMemo(() => {
        if (!name.trim()) return 'Ponle un nombre al servicio.';
        if (numericPrice < 0) return 'El precio no puede ser negativo.';
        if (numericAdvance > numericPrice) return 'El anticipo no puede ser mayor que el precio.';
        return null;
    }, [name, numericPrice, numericAdvance]);

    /** Local preview only; the file reaches the CDN when the form is saved. */
    const handleImage = (files: FileList | null) => {
        const file = files?.[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            setError('Elige un archivo de imagen.');
            return;
        }
        if (file.size > 8 * 1024 * 1024) {
            setError('La imagen debe pesar 8 MB o menos.');
            return;
        }

        setError(null);
        setSelectedFile(file);
        setImagePreview(URL.createObjectURL(file));
    };

    const handleSave = async () => {
        if (validationError) {
            setError(validationError);
            return;
        }

        setError(null);
        setSaving(true);

        try {
            let imageUrl = selectedFile ? null : imagePreview;

            if (selectedFile) {
                imageUrl = await api.uploadImage(selectedFile, 'services');
            }

            const payload = {
                name: name.trim(),
                description: description.trim() || null,
                category: category.trim() || 'Otros',
                estimated_price: numericPrice,
                required_advance: numericAdvance,
                duration_minutes: duration,
                image_url: imageUrl,
                active,
            };

            if (id) {
                await api.updateService(id, payload);
            } else {
                await api.createService(payload);
            }

            router.push('/admin/services');
            router.refresh();
        } catch (caught) {
            setError(
                caught instanceof ApiError
                    ? caught.message
                    : 'No pudimos guardar el servicio. Intenta de nuevo.'
            );
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="min-h-full pb-24">
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
                <div className="size-10" aria-hidden="true" />
            </div>

            {loading ? (
                <div className="mx-auto w-full max-w-md space-y-6 px-6 py-8" aria-busy="true">
                    <div className="skeleton aspect-square w-full max-w-[280px]" />
                    <div className="skeleton h-14 w-full" />
                    <div className="skeleton h-14 w-full" />
                    <div className="skeleton h-32 w-full" />
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
                                <img
                                    src={imagePreview.startsWith('blob:') ? imagePreview : api.getImageUrl(imagePreview)}
                                    alt=""
                                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                                />
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
                        {/* Name */}
                        <div className="space-y-2">
                            <label htmlFor="service-name" className="font-display text-xs font-medium tracking-wider text-aesthetic-muted ml-1 italic">Nombre del servicio</label>
                            <input
                                id="service-name"
                                required
                                className="w-full bg-white border-none ring-1 ring-aesthetic-accent focus:ring-aesthetic-pink/30 rounded-2xl p-4 text-base font-display italic shadow-minimal transition-all placeholder:text-aesthetic-muted/30"
                                placeholder="ej. Kapping Gel + Nail Art"
                                value={name}
                                onChange={e => setName(e.target.value)}
                            />
                        </div>

                        {/* Category */}
                        <div className="space-y-2">
                            <label htmlFor="service-category" className="font-display text-xs font-medium tracking-wider text-aesthetic-muted ml-1 italic">Categoría</label>
                            <div className="relative">
                                <input
                                    id="service-category"
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
                            <label htmlFor="service-description" className="font-display text-xs font-medium tracking-wider text-aesthetic-muted ml-1 italic">Descripción</label>
                            <textarea
                                id="service-description"
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
                                <label htmlFor="service-price" className="font-display text-xs font-medium tracking-wider text-aesthetic-muted ml-1 italic">Precio</label>
                                <div className="relative">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-aesthetic-muted/40 font-display italic">$</span>
                                    <input
                                        id="service-price"
                                        className="w-full bg-white border-none ring-1 ring-aesthetic-accent focus:ring-aesthetic-pink/30 rounded-2xl p-4 text-base font-display italic shadow-minimal transition-all pl-8"
                                        placeholder="0.00"
                                        value={price}
                                        onChange={e => setPrice(e.target.value.replace(/[^0-9.]/g, ''))}
                                        inputMode="decimal"
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label htmlFor="service-duration" className="font-display text-xs font-medium tracking-wider text-aesthetic-muted ml-1 italic">Duración</label>
                                <div className="relative">
                                    <select
                                        id="service-duration"
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

                    </div>

                    {error && (
                        <p role="alert" className="animate-fade-in rounded-2xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
                            <span className="material-symbol mr-2 align-middle text-lg" aria-hidden="true">error</span>
                            {error}
                        </p>
                    )}

                    {/* CTA */}
                    <section className="pt-4 pb-12">
                        <button
                            onClick={handleSave}
                            disabled={saving || Boolean(validationError)}
                            className="w-full bg-aesthetic-pink text-white hover:bg-aesthetic-taupe transition-all duration-500 py-5 rounded-3xl text-sm font-bold tracking-[0.3em] uppercase shadow-minimal active:scale-[0.98] border border-white/20 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {saving ? (
                                <div className="size-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                            ) : (
                                id ? 'Actualizar servicio' : 'Guardar servicio'
                            )}
                        </button>
                        {validationError && !error && (
                            <p className="mt-4 text-center text-[11px] text-aesthetic-muted">{validationError}</p>
                        )}
                    </section>
                </main>
            )}
        </div>
    );
}

export default function NewServicePage() {
    return (
        <Suspense fallback={<div className="skeleton m-6 h-96" aria-busy="true" />}>
            <NewServiceContent />
        </Suspense>
    );
}
