'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useSession } from '@/lib/session-context';
import { formatMoney } from '@/lib/format';
import type { Service } from '@/lib/types';

export default function ServicesPage() {
    const { tenant } = useSession();

    const [services, setServices] = useState<Service[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [search, setSearch] = useState('');
    const [showArchived, setShowArchived] = useState(false);
    const [target, setTarget] = useState<Service | null>(null);
    const [working, setWorking] = useState(false);

    const currency = tenant?.settings?.currency;

    useEffect(() => {
        if (!tenant) return;
        let cancelled = false;

        // Archived services are fetched too, so they can be brought back.
        api.getServices({ includeInactive: true })
            .then(next => {
                if (!cancelled) setServices(next);
            })
            .catch(() => {
                if (!cancelled) setError('No pudimos cargar tu catálogo. Recarga la página.');
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, [tenant]);

    const visible = useMemo(() => {
        const query = search.trim().toLowerCase();

        return services
            .filter(service => (showArchived ? !service.active : service.active))
            .filter(service => {
                if (!query) return true;
                // Category matters here: the list groups by it, so searching for
                // a category the owner can see should find its services.
                return (
                    service.name.toLowerCase().includes(query) ||
                    (service.category ?? '').toLowerCase().includes(query) ||
                    (service.description ?? '').toLowerCase().includes(query)
                );
            });
    }, [services, search, showArchived]);

    const grouped = useMemo(() => {
        const map = new Map<string, Service[]>();
        for (const service of visible) {
            const key = service.category || 'Otros';
            map.set(key, [...(map.get(key) ?? []), service]);
        }
        return [...map.entries()].sort(([a], [b]) => a.localeCompare(b, 'es'));
    }, [visible]);

    const archivedCount = services.filter(service => !service.active).length;

    /** Archiving hides a service from booking; restoring brings it back. */
    const setArchived = async (service: Service, archived: boolean) => {
        setWorking(true);
        try {
            if (archived) {
                await api.archiveService(service.id);
            } else {
                await api.updateService(service.id, { ...service, active: true });
            }
            setServices(current =>
                current.map(item => (item.id === service.id ? { ...item, active: !archived } : item))
            );
            setTarget(null);
        } catch {
            setError(
                archived
                    ? 'No pudimos archivar el servicio. Intenta de nuevo.'
                    : 'No pudimos restaurar el servicio. Intenta de nuevo.'
            );
        } finally {
            setWorking(false);
        }
    };

    if (loading) {
        return (
            <div className="space-y-4 p-2" aria-busy="true" aria-label="Cargando servicios">
                <div className="skeleton h-12 w-64" />
                {Array.from({ length: 4 }, (_, i) => (
                    <div key={i} className="skeleton h-20 w-full" />
                ))}
            </div>
        );
    }

    return (
        <div className="pb-16">
            {error && (
                <p role="alert" className="mb-6 rounded-2xl border border-danger/30 bg-danger/10 p-4 text-sm text-danger">
                    {error}
                </p>
            )}

            <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
                <div>
                    <p className="t-label mb-2">Catálogo</p>
                    <h1 className="t-display">Servicios</h1>
                </div>
                <Link
                    href="/admin/services/new"
                    className="btn-gradient flex items-center gap-2 px-5 py-3 text-sm"
                >
                    <span className="material-symbol text-lg" aria-hidden="true">add</span>
                    Nuevo servicio
                </Link>
            </header>

            <div className="mb-8 flex flex-wrap items-center gap-3">
                <div className="relative min-w-[240px] flex-1">
                    <label htmlFor="service-search" className="sr-only">Buscar servicio</label>
                    <span
                        className="material-symbol pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-text-subtle"
                        aria-hidden="true"
                    >
                        search
                    </span>
                    <input
                        id="service-search"
                        type="search"
                        value={search}
                        onChange={event => setSearch(event.target.value)}
                        placeholder="Buscar por nombre o categoría…"
                        className="input-field pl-12"
                    />
                </div>

                {archivedCount > 0 && (
                    <button
                        onClick={() => setShowArchived(value => !value)}
                        aria-pressed={showArchived}
                        className={`rounded-full border px-4 py-2.5 text-xs font-semibold transition-colors ${
                            showArchived
                                ? 'border-transparent bg-text-strong text-white'
                                : 'border-line text-text-muted hover:text-text-strong'
                        }`}
                    >
                        Archivados ({archivedCount})
                    </button>
                )}
            </div>

            {visible.length === 0 ? (
                <div className="blank-slate">
                    {search ? (
                        <>
                            <p className="t-body">Ningún servicio coincide con «{search}».</p>
                            <button
                                onClick={() => setSearch('')}
                                className="t-meta underline underline-offset-4 hover:text-text-strong"
                            >
                                Limpiar la búsqueda
                            </button>
                        </>
                    ) : showArchived ? (
                        <p className="t-body">No tienes servicios archivados.</p>
                    ) : (
                        <>
                            <span className="material-symbol text-3xl opacity-40" aria-hidden="true">spa</span>
                            <p className="t-body">Tu catálogo está vacío.</p>
                            <p className="t-meta">Añade tu primer servicio para empezar a recibir reservas.</p>
                        </>
                    )}
                </div>
            ) : (
                <div className="space-y-10">
                    {grouped.map(([category, items]) => (
                        <section key={category}>
                            <h2 className="t-label mb-4">{category}</h2>
                            <ul className="space-y-3">
                                {items.map(service => (
                                    <li key={service.id} className="sheet flex items-center gap-4 p-4">
                                        <span className="size-14 shrink-0 overflow-hidden rounded-xl border border-line bg-surface-sunken">
                                            {service.image_url ? (
                                                <img
                                                    src={api.getImageUrl(service.image_url)}
                                                    alt=""
                                                    className="size-full object-cover"
                                                />
                                            ) : (
                                                <span className="grid size-full place-items-center text-text-subtle">
                                                    <span className="material-symbol" aria-hidden="true">spa</span>
                                                </span>
                                            )}
                                        </span>

                                        <div className="min-w-0 flex-1">
                                            <p className="t-body truncate font-semibold text-text-strong">
                                                {service.name}
                                            </p>
                                            <p className="t-meta t-figure">
                                                {service.duration_minutes} min ·{' '}
                                                {formatMoney(service.estimated_price, currency)}
                                                {service.required_advance > 0 && (
                                                    <> · anticipo {formatMoney(service.required_advance, currency)}</>
                                                )}
                                            </p>
                                        </div>

                                        <div className="flex shrink-0 items-center gap-2">
                                            <Link
                                                href={`/admin/services/new?id=${service.id}`}
                                                aria-label={`Editar ${service.name}`}
                                                className="grid size-10 place-items-center rounded-xl border border-line text-text-muted transition-colors hover:text-text-strong"
                                            >
                                                <span className="material-symbol text-lg" aria-hidden="true">edit</span>
                                            </Link>

                                            {service.active ? (
                                                <button
                                                    onClick={() => setTarget(service)}
                                                    aria-label={`Archivar ${service.name}`}
                                                    className="grid size-10 place-items-center rounded-xl border border-line text-text-muted transition-colors hover:border-danger/40 hover:text-danger"
                                                >
                                                    <span className="material-symbol text-lg" aria-hidden="true">archive</span>
                                                </button>
                                            ) : (
                                                <button
                                                    onClick={() => setArchived(service, false)}
                                                    disabled={working}
                                                    aria-label={`Restaurar ${service.name}`}
                                                    className="grid size-10 place-items-center rounded-xl border border-line text-text-muted transition-colors hover:border-success/40 hover:text-success disabled:opacity-50"
                                                >
                                                    <span className="material-symbol text-lg" aria-hidden="true">unarchive</span>
                                                </button>
                                            )}
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        </section>
                    ))}
                </div>
            )}

            {target && (
                <div
                    className="animate-fade-in fixed inset-0 z-50 grid place-items-center p-6"
                    onClick={() => !working && setTarget(null)}
                >
                    <div className="absolute inset-0 bg-text-strong/25 backdrop-blur-sm" />
                    <div
                        role="dialog"
                        aria-label="Confirmar archivado"
                        className="sheet relative w-full max-w-sm p-8 text-center shadow-lg"
                        onClick={event => event.stopPropagation()}
                    >
                        <h3 className="t-title mb-3">¿Archivar «{target.name}»?</h3>
                        <p className="t-body mb-8">
                            Dejará de aparecer en tu página de reservas. Las citas pasadas conservan
                            su nombre y precio, y puedes restaurarlo cuando quieras.
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setTarget(null)}
                                disabled={working}
                                className="flex-1 rounded-full border border-line py-3 text-sm font-semibold text-text-muted transition-colors hover:text-text-strong"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={() => setArchived(target, true)}
                                disabled={working}
                                className="flex-1 rounded-full bg-text-strong py-3 text-sm font-semibold text-white disabled:opacity-50"
                            >
                                {working ? 'Archivando…' : 'Archivar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
