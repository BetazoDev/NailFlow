'use client';

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import { useSession } from '@/lib/session-context';
import { formatMoney } from '@/lib/format';

const DURATION_OPTIONS = [15, 30, 45, 60, 75, 90, 120, 150, 180];

/** Suggested when the owner has not set a deposit of her own. */
const DEFAULT_DEPOSIT_RATE = 0.4;

function ServiceEditor() {
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

    const [categories, setCategories] = useState<string[]>([]);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const currency = tenant?.settings?.currency;

    useEffect(() => {
        if (!tenant) return;
        let cancelled = false;

        api.getServices({ includeInactive: true })
            .then(services => {
                if (cancelled) return;

                setCategories(
                    [...new Set(services.map(item => item.category).filter(Boolean) as string[])].sort()
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
    const suggestedAdvance = Math.round(numericPrice * DEFAULT_DEPOSIT_RATE);
    const numericAdvance = advance.trim() === '' ? suggestedAdvance : Number(advance) || 0;

    const validation = useMemo(() => {
        if (!name.trim()) return 'Ponle un nombre al servicio.';
        if (numericPrice < 0) return 'El precio no puede ser negativo.';
        if (numericAdvance < 0) return 'El anticipo no puede ser negativo.';
        if (numericAdvance > numericPrice) return 'El anticipo no puede superar el precio.';
        return null;
    }, [name, numericPrice, numericAdvance]);

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
        setImageFile(file);
        setImagePreview(URL.createObjectURL(file));
    };

    const handleSave = async () => {
        if (validation) {
            setError(validation);
            return;
        }

        setError(null);
        setSaving(true);

        try {
            let imageUrl = imageFile ? null : imagePreview;
            if (imageFile) imageUrl = await api.uploadImage(imageFile, 'services');

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

            if (id) await api.updateService(id, payload);
            else await api.createService(payload);

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

    if (loading) {
        return (
            <div className="mx-auto max-w-xl space-y-5 p-2" aria-busy="true">
                <div className="skeleton aspect-[3/2] w-full" />
                <div className="skeleton h-14 w-full" />
                <div className="skeleton h-14 w-full" />
                <div className="skeleton h-28 w-full" />
            </div>
        );
    }

    return (
        <div className="mx-auto max-w-xl pb-16">
            <header className="mb-8 flex items-center gap-4">
                <Link
                    href="/admin/services"
                    aria-label="Volver al catálogo"
                    className="grid size-10 shrink-0 place-items-center rounded-full border border-line text-text-muted transition-colors hover:text-text-strong"
                >
                    <span className="material-symbol text-lg" aria-hidden="true">arrow_back</span>
                </Link>
                <div>
                    <p className="t-label mb-1">Catálogo</p>
                    <h1 className="t-title">{id ? 'Editar servicio' : 'Nuevo servicio'}</h1>
                </div>
            </header>

            {error && (
                <p role="alert" className="mb-6 rounded-2xl border border-danger/30 bg-danger/10 p-4 text-sm text-danger">
                    {error}
                </p>
            )}

            <div className="space-y-8">
                <section>
                    <button
                        type="button"
                        onClick={() => fileRef.current?.click()}
                        className="group relative block aspect-[3/2] w-full overflow-hidden rounded-2xl border border-dashed border-line bg-surface-sunken/40 transition-colors hover:border-brand"
                    >
                        {imagePreview ? (
                            <img
                                src={imagePreview.startsWith('blob:') ? imagePreview : api.getImageUrl(imagePreview)}
                                alt=""
                                className="size-full object-cover"
                            />
                        ) : (
                            <span className="grid size-full place-items-center gap-2 text-text-muted">
                                <span className="material-symbol text-3xl" aria-hidden="true">add_photo_alternate</span>
                                <span className="t-meta">Añadir una foto</span>
                            </span>
                        )}
                    </button>
                    <input
                        ref={fileRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={event => handleImage(event.target.files)}
                    />
                    <p className="t-meta mt-2 text-center">
                        Es lo primero que ve tu clienta al elegir. JPG o PNG, hasta 8 MB.
                    </p>
                </section>

                <section className="space-y-5">
                    <div>
                        <label htmlFor="service-name" className="t-label mb-2 block">
                            Nombre
                        </label>
                        <input
                            id="service-name"
                            required
                            value={name}
                            onChange={event => setName(event.target.value)}
                            placeholder="Manicura rusa"
                            className="input-field"
                        />
                    </div>

                    <div>
                        <label htmlFor="service-category" className="t-label mb-2 block">
                            Categoría
                        </label>
                        <input
                            id="service-category"
                            list="service-categories"
                            value={category}
                            onChange={event => setCategory(event.target.value)}
                            placeholder="Manicura"
                            className="input-field"
                        />
                        <datalist id="service-categories">
                            {categories.map(item => (
                                <option key={item} value={item} />
                            ))}
                        </datalist>
                    </div>

                    <div>
                        <label htmlFor="service-description" className="t-label mb-2 block">
                            Descripción
                        </label>
                        <textarea
                            id="service-description"
                            rows={3}
                            value={description}
                            onChange={event => setDescription(event.target.value)}
                            placeholder="Qué incluye y qué puede esperar tu clienta."
                            className="input-field resize-none"
                        />
                    </div>
                </section>

                <section className="grid gap-5 sm:grid-cols-2">
                    <div>
                        <label htmlFor="service-price" className="t-label mb-2 block">
                            Precio
                        </label>
                        <input
                            id="service-price"
                            inputMode="decimal"
                            value={price}
                            onChange={event => setPrice(event.target.value.replace(/[^0-9.]/g, ''))}
                            placeholder="0"
                            className="input-field t-figure"
                        />
                    </div>

                    <div>
                        <label htmlFor="service-duration" className="t-label mb-2 block">
                            Duración
                        </label>
                        <select
                            id="service-duration"
                            value={duration}
                            onChange={event => setDuration(Number(event.target.value))}
                            className="input-field"
                        >
                            {DURATION_OPTIONS.map(minutes => (
                                <option key={minutes} value={minutes}>
                                    {minutes} min
                                </option>
                            ))}
                        </select>
                    </div>
                </section>

                {/* The deposit had no control at all: every service silently charged
                    40% of its price, and that figure flowed into checkout. */}
                <section>
                    <label htmlFor="service-advance" className="t-label mb-2 block">
                        Anticipo para reservar
                    </label>
                    <input
                        id="service-advance"
                        inputMode="decimal"
                        value={advance}
                        onChange={event => setAdvance(event.target.value.replace(/[^0-9.]/g, ''))}
                        placeholder={String(suggestedAdvance)}
                        className="input-field t-figure"
                    />
                    <p className="t-meta mt-2">
                        Lo que tu clienta paga por adelantado para apartar el lugar. Déjalo vacío
                        para usar el {Math.round(DEFAULT_DEPOSIT_RATE * 100)}% sugerido
                        {numericPrice > 0 && <> ({formatMoney(suggestedAdvance, currency)})</>}. Pon
                        0 si no cobras anticipo.
                    </p>
                </section>

                <section>
                    <label className="sheet flex cursor-pointer items-start gap-3 p-4">
                        <input
                            type="checkbox"
                            checked={active}
                            onChange={event => setActive(event.target.checked)}
                            className="mt-0.5 size-5 accent-[var(--brand-primary)]"
                        />
                        <span>
                            <span className="t-body block font-medium text-text-strong">
                                Visible en tu página de reservas
                            </span>
                            <span className="t-meta block">
                                Desactívalo para dejar de ofrecerlo sin perder su historial.
                            </span>
                        </span>
                    </label>
                </section>

                <div className="space-y-3">
                    <button
                        onClick={handleSave}
                        disabled={saving || Boolean(validation)}
                        className="btn-gradient w-full py-4 disabled:opacity-50"
                    >
                        {saving ? 'Guardando…' : id ? 'Guardar cambios' : 'Crear servicio'}
                    </button>

                    {validation && !error && (
                        <p className="t-meta text-center">{validation}</p>
                    )}
                </div>
            </div>
        </div>
    );
}

export default function NewServicePage() {
    return (
        <Suspense fallback={<div className="skeleton m-2 h-96" aria-busy="true" />}>
            <ServiceEditor />
        </Suspense>
    );
}
