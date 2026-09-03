'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { useSession } from '@/lib/session-context';
import { buildClients, loyaltyStatusFor } from '@/lib/clients';
import { formatDate, formatMoney, formatShortDate, formatTime, initials, whatsappLink } from '@/lib/format';
import { STATUS_PRESENTATION } from '@/lib/constants';
import type { Appointment, Client, Service } from '@/lib/types';

type Tab = 'todas' | 'recientes' | 'favoritas';

const TAB_LABEL: Record<Tab, string> = {
    todas: 'Todas',
    recientes: 'Recientes',
    favoritas: 'Favoritas',
};

/** "Recientes" means a real window, not an arbitrary top-5. */
const RECENT_DAYS = 30;

export default function ClientsPage() {
    const { tenant } = useSession();

    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [services, setServices] = useState<Service[]>([]);
    const [favorites, setFavorites] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [search, setSearch] = useState('');
    const [tab, setTab] = useState<Tab>('todas');
    const [expanded, setExpanded] = useState<string | null>(null);
    const [history, setHistory] = useState<Client | null>(null);

    const currency = tenant?.settings?.currency;
    const loyalty = tenant?.settings?.loyalty;

    useEffect(() => {
        if (!tenant) return;
        let cancelled = false;

        Promise.all([
            api.getAppointments(),
            api.getServices({ includeInactive: true }),
            api.getFavorites(),
        ])
            .then(([nextAppointments, nextServices, nextFavorites]) => {
                if (cancelled) return;
                setAppointments(nextAppointments);
                setServices(nextServices);
                setFavorites(nextFavorites);
            })
            .catch(() => {
                if (!cancelled) setError('No pudimos cargar tus clientas. Recarga la página.');
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, [tenant]);

    const clients = useMemo(
        () => buildClients({ appointments, services, favorites }),
        [appointments, services, favorites]
    );

    const filtered = useMemo(() => {
        let list = clients;
        const query = search.trim().toLowerCase();

        if (query) {
            list = list.filter(
                client =>
                    client.name.toLowerCase().includes(query) ||
                    client.phone.includes(query) ||
                    (client.email ?? '').toLowerCase().includes(query)
            );
        }

        if (tab === 'recientes') {
            const cutoff = new Date();
            cutoff.setDate(cutoff.getDate() - RECENT_DAYS);
            const key = cutoff.toISOString();
            list = list.filter(client => client.lastVisit && client.lastVisit >= key);
        }

        if (tab === 'favoritas') list = list.filter(client => client.favorite);

        return list;
    }, [clients, search, tab]);

    /**
     * Optimistic: the star flips at once and reverts if the write fails.
     * Waiting on the round trip made the control feel broken.
     */
    const toggleFavorite = async (client: Client) => {
        const next = !client.favorite;

        setFavorites(current => {
            const updated = new Set(current);
            if (next) updated.add(client.phone);
            else updated.delete(client.phone);
            return updated;
        });

        try {
            await api.setFavorite(client.phone, next);
        } catch {
            setFavorites(current => {
                const reverted = new Set(current);
                if (next) reverted.delete(client.phone);
                else reverted.add(client.phone);
                return reverted;
            });
            setError('No pudimos guardar el favorito.');
        }
    };

    /**
     * Both the grouping and this lookup trim the phone, so a row stored with
     * stray whitespace still lands in the history it counted towards.
     */
    const historyFor = useCallback(
        (client: Client) =>
            appointments
                .filter(appointment => appointment.client_phone?.trim() === client.phone)
                .sort((a, b) => b.datetime_start.localeCompare(a.datetime_start)),
        [appointments]
    );

    if (loading) {
        return (
            <div className="space-y-4 p-2" aria-busy="true" aria-label="Cargando clientas">
                <div className="skeleton h-12 w-64" />
                {Array.from({ length: 5 }, (_, i) => (
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

            <header className="mb-8">
                <p className="t-label mb-2">Tu gente</p>
                <h1 className="t-display">Clientas</h1>
            </header>

            <div className="mb-8 space-y-4">
                <div className="relative">
                    <label htmlFor="client-search" className="sr-only">Buscar clienta</label>
                    <span
                        className="material-symbol pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-text-subtle"
                        aria-hidden="true"
                    >
                        search
                    </span>
                    <input
                        id="client-search"
                        type="search"
                        value={search}
                        onChange={event => setSearch(event.target.value)}
                        placeholder="Buscar por nombre, teléfono o correo…"
                        className="input-field pl-12"
                    />
                </div>

                <div className="flex gap-2">
                    {(Object.keys(TAB_LABEL) as Tab[]).map(key => (
                        <button
                            key={key}
                            onClick={() => setTab(key)}
                            aria-pressed={tab === key}
                            className={`rounded-full border px-4 py-2 text-xs font-semibold transition-colors ${
                                tab === key
                                    ? 'border-transparent bg-text-strong text-white'
                                    : 'border-line text-text-muted hover:text-text-strong'
                            }`}
                        >
                            {TAB_LABEL[key]}
                        </button>
                    ))}
                </div>
            </div>

            {filtered.length === 0 ? (
                <div className="blank-slate">
                    {search ? (
                        <>
                            <p className="t-body">Ninguna clienta coincide con «{search}».</p>
                            <button
                                onClick={() => setSearch('')}
                                className="t-meta underline underline-offset-4 hover:text-text-strong"
                            >
                                Limpiar la búsqueda
                            </button>
                        </>
                    ) : tab === 'favoritas' ? (
                        <p className="t-body">Aún no has marcado favoritas.</p>
                    ) : tab === 'recientes' ? (
                        <p className="t-body">Nadie ha venido en los últimos {RECENT_DAYS} días.</p>
                    ) : (
                        <>
                            <span className="material-symbol text-3xl opacity-40" aria-hidden="true">group</span>
                            <p className="t-body">Todavía no tienes clientas.</p>
                            <p className="t-meta">Aparecerán aquí en cuanto reserven por primera vez.</p>
                        </>
                    )}
                </div>
            ) : (
                <ul className="space-y-3">
                    {filtered.map(client => {
                        const status = loyaltyStatusFor(client, loyalty);
                        const hasReward = Boolean(status && status.rewards > 0);
                        const isOpen = expanded === client.phone;
                        const wa = whatsappLink(
                            client.phone,
                            `¡Hola ${client.name}! Te escribimos de ${tenant?.name ?? 'tu salón'}.`
                        );

                        return (
                            <li key={client.phone} className="sheet overflow-hidden">
                                {hasReward && (
                                    <p className="flex items-center gap-2 border-b border-line bg-brand-tint px-5 py-2.5">
                                        <span aria-hidden="true">🎁</span>
                                        <span className="t-meta font-semibold text-text-strong">
                                            {status!.rewardType === 'free_service'
                                                ? 'Tiene un servicio gratis acumulado'
                                                : `Tiene ${status!.discountValue}% de descuento acumulado`}
                                        </span>
                                    </p>
                                )}

                                {/* The row and the star are siblings, not nested buttons.
                                    A button inside a button is invalid HTML and the
                                    parser rewrote it, breaking hydration on this page. */}
                                <div className="flex items-center gap-4 p-4">
                                    <button
                                        onClick={() => setExpanded(isOpen ? null : client.phone)}
                                        aria-expanded={isOpen}
                                        className="flex min-w-0 flex-1 items-center gap-4 text-left"
                                    >
                                        <span className="grid size-12 shrink-0 place-items-center rounded-full bg-brand-tint text-sm font-semibold text-text-strong">
                                            {initials(client.name)}
                                        </span>
                                        <span className="min-w-0">
                                            <span className="t-body block truncate font-semibold text-text-strong">
                                                {client.name}
                                            </span>
                                            <span className="t-meta block truncate">
                                                {client.lastVisit
                                                    ? `Últ. ${formatShortDate(client.lastVisit)} · ${client.lastService ?? 'Servicio'}`
                                                    : 'Sin visitas completadas'}
                                                {client.visits > 1 && ` · ${client.visits} visitas`}
                                            </span>
                                        </span>
                                    </button>

                                    <button
                                        onClick={() => toggleFavorite(client)}
                                        aria-pressed={client.favorite}
                                        aria-label={
                                            client.favorite
                                                ? `Quitar a ${client.name} de favoritas`
                                                : `Marcar a ${client.name} como favorita`
                                        }
                                        className="grid size-10 shrink-0 place-items-center rounded-xl transition-colors hover:bg-surface-sunken"
                                    >
                                        <span
                                            className={`material-symbol text-xl ${client.favorite ? 'text-warning' : 'text-text-subtle'}`}
                                            aria-hidden="true"
                                        >
                                            {client.favorite ? 'star' : 'star_border'}
                                        </span>
                                    </button>
                                </div>

                                {isOpen && (
                                    <div className="animate-fade-in space-y-5 border-t border-line p-5">
                                        <dl className="grid grid-cols-3 gap-3">
                                            <Stat label="Visitas" value={client.visits} />
                                            <Stat
                                                label="Inversión"
                                                value={formatMoney(client.totalSpent, currency)}
                                            />
                                            <Stat
                                                label="Ticket medio"
                                                value={formatMoney(
                                                    client.visits > 0 ? client.totalSpent / client.visits : 0,
                                                    currency
                                                )}
                                            />
                                        </dl>

                                        <div className="flex flex-wrap gap-2">
                                            <span className="t-meta rounded-full border border-line px-3 py-1.5">
                                                {client.phone}
                                            </span>
                                            {client.email && (
                                                <span className="t-meta rounded-full border border-line px-3 py-1.5">
                                                    {client.email}
                                                </span>
                                            )}
                                        </div>

                                        <div className="flex gap-3">
                                            <button
                                                onClick={() => setHistory(client)}
                                                className="flex-1 rounded-full border border-line py-3 text-sm font-semibold text-text-strong transition-colors hover:bg-surface-sunken"
                                            >
                                                Ver historial
                                            </button>
                                            {wa && (
                                                <a
                                                    href={wa}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    aria-label={`Escribir a ${client.name}`}
                                                    className="grid size-12 shrink-0 place-items-center rounded-full border border-line text-text-muted transition-colors hover:text-text-strong"
                                                >
                                                    <span className="material-symbol text-xl text-[#25D366]" aria-hidden="true">chat</span>
                                                </a>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </li>
                        );
                    })}
                </ul>
            )}

            {history && (
                <div
                    className="animate-fade-in fixed inset-0 z-50 grid place-items-end sm:place-items-center"
                    onClick={() => setHistory(null)}
                >
                    <div className="absolute inset-0 bg-text-strong/25 backdrop-blur-sm" />

                    <div
                        role="dialog"
                        aria-label={`Historial de ${history.name}`}
                        className="relative flex max-h-[85vh] w-full flex-col rounded-t-[2rem] bg-surface-raised shadow-lg sm:max-w-lg sm:rounded-[2rem]"
                        onClick={event => event.stopPropagation()}
                    >
                        <header className="flex items-start justify-between gap-4 border-b border-line p-7">
                            <div className="min-w-0">
                                <p className="t-label mb-1.5">Historial completo</p>
                                <h2 className="t-title truncate">{history.name}</h2>
                            </div>
                            <button
                                onClick={() => setHistory(null)}
                                aria-label="Cerrar"
                                className="grid size-9 shrink-0 place-items-center rounded-full text-text-muted hover:bg-surface-sunken"
                            >
                                <span className="material-symbol text-xl" aria-hidden="true">close</span>
                            </button>
                        </header>

                        <div className="flex-1 space-y-3 overflow-y-auto p-7">
                            {historyFor(history).length === 0 ? (
                                <p className="t-meta py-8 text-center">Sin citas registradas.</p>
                            ) : (
                                historyFor(history).map(appointment => {
                                    const service = services.find(item => item.id === appointment.service_id);
                                    const presentation = STATUS_PRESENTATION[appointment.status];

                                    return (
                                        <div key={appointment.id} className="sheet flex items-start justify-between gap-4 p-4">
                                            <div className="min-w-0">
                                                <p className="t-body truncate font-medium text-text-strong">
                                                    {appointment.service_name ?? service?.name ?? 'Servicio'}
                                                </p>
                                                <p className="t-meta">
                                                    {formatDate(appointment.datetime_start)} ·{' '}
                                                    {formatTime(appointment.datetime_start)}
                                                </p>
                                            </div>
                                            <div className="shrink-0 space-y-1.5 text-right">
                                                <p className="t-figure font-medium text-text-strong">
                                                    {formatMoney(appointment.price, currency)}
                                                </p>
                                                <span className="status-pill" data-status={presentation.token}>
                                                    {presentation.label}
                                                </span>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>

                        <footer className="border-t border-line p-7">
                            <dl className="grid grid-cols-2 gap-4">
                                <Stat label="Total visitas" value={history.visits} />
                                <Stat label="Total invertido" value={formatMoney(history.totalSpent, currency)} />
                            </dl>
                        </footer>
                    </div>
                </div>
            )}
        </div>
    );
}

function Stat({ label, value }: { label: string; value: string | number }) {
    return (
        <div className="sheet p-4 text-center">
            <dt className="t-label mb-1.5">{label}</dt>
            <dd className="t-figure text-lg font-semibold text-text-strong">{value}</dd>
        </div>
    );
}
