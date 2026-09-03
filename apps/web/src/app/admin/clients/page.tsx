'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { useSession } from '@/lib/session-context';
import { buildClients, loyaltyStatusFor } from '@/lib/clients';
import { formatMoney, formatShortDate, formatDate, formatTime, initials, whatsappLink } from '@/lib/format';
import { STATUS_PRESENTATION } from '@/lib/constants';
import type { Appointment, Client, Service } from '@/lib/types';

type FilterTab = 'todas' | 'recientes' | 'favoritas';

const TAB_LABELS: Record<FilterTab, string> = {
    todas: 'Todas',
    recientes: 'Recientes',
    favoritas: 'Favoritas',
};

export default function ClientsPage() {
    const { tenant } = useSession();

    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [services, setServices] = useState<Service[]>([]);
    const [favorites, setFavorites] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);

    const [search, setSearch] = useState('');
    const [activeTab, setActiveTab] = useState<FilterTab>('todas');
    const [expandedPhone, setExpandedPhone] = useState<string | null>(null);
    const [historyClient, setHistoryClient] = useState<Client | null>(null);

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
                if (!cancelled) setLoadError('No pudimos cargar tus clientas. Recarga la página.');
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

    const loyalty = tenant?.settings?.loyalty;
    const getLoyaltyStatus = useCallback(
        (client: Client) => loyaltyStatusFor(client, loyalty),
        [loyalty]
    );

    const filtered = useMemo(() => {
        let list = clients;

        if (search.trim()) {
            const query = search.trim().toLowerCase();
            list = list.filter(
                client =>
                    client.name.toLowerCase().includes(query) ||
                    client.phone.includes(query) ||
                    (client.email ?? '').toLowerCase().includes(query)
            );
        }

        if (activeTab === 'recientes') list = list.slice(0, 5);
        if (activeTab === 'favoritas') list = list.filter(client => client.favorite);

        return list;
    }, [clients, search, activeTab]);

    /**
     * Optimistic: the star flips immediately and reverts if the write fails.
     * Waiting on the round trip made the control feel broken on a slow network.
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
        }
    };

    const getClientHistory = useCallback(
        (client: Client) =>
            appointments
                .filter(appointment => appointment.client_phone === client.phone)
                .sort((a, b) => b.datetime_start.localeCompare(a.datetime_start)),
        [appointments]
    );

    if (loading) {
        return (
            <div className="space-y-3 p-6" aria-busy="true" aria-label="Cargando clientas">
                {Array.from({ length: 5 }, (_, index) => (
                    <div key={index} className="skeleton h-24 w-full" />
                ))}
            </div>
        );
    }

    if (loadError) {
        return (
            <p role="alert" className="m-6 rounded-2xl border border-danger/30 bg-danger/10 p-6 text-center text-sm text-danger">
                {loadError}
            </p>
        );
    }

    return (
        <div className="relative min-h-full pb-24" >
            {/* Header */}
            <div className="px-6 pt-8 pb-0">
                <div className="flex items-center justify-center mb-4">
                    <h1 className="font-display text-4xl font-light italic tracking-tight text-aesthetic-taupe text-center">Mis Clientas</h1>
                </div>
            </div>

            {/* Search */}
            <div className="px-6 mt-4">
                <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <span className="material-symbol text-aesthetic-muted/60 text-xl font-light">search</span>
                    </div>
                    <label htmlFor="client-search" className="sr-only">Buscar clienta</label>
                    <input
                        id="client-search"
                        type="search"
                        className="block w-full pl-11 pr-4 py-3.5 bg-aesthetic-soft-pink/40 border-none rounded-full focus:ring-1 focus:ring-aesthetic-pink/30 placeholder:text-aesthetic-muted/50 text-base font-display italic"
                        placeholder="Buscar clienta..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                </div>
            </div>

            {/* Filter tabs */}
            <div className="px-6 mt-4 flex gap-2">
                {(['todas', 'recientes', 'favoritas'] as FilterTab[]).map(tab => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        aria-pressed={activeTab === tab}
                        className={`pill-tab ${activeTab === tab ? 'pill-tab-active' : 'pill-tab-inactive'}`}
                    >
                        {tab === 'favoritas' && <span className="material-symbol text-sm mr-1" aria-hidden="true">star</span>}
                        {TAB_LABELS[tab]}
                    </button>
                ))}
            </div>

            {/* Client list */}
            <div className="px-6 mt-5 space-y-3 stagger-children">
                {filtered.map(client => {
                    const expanded = expandedPhone === client.phone;
                    const loyaltyStatus = getLoyaltyStatus(client);
                    const hasReward = Boolean(loyaltyStatus && loyaltyStatus.rewards > 0);
                    const whatsapp = whatsappLink(
                        client.phone,
                        `¡Hola ${client.name}! Te escribimos de ${tenant?.name ?? 'tu salón'}.`
                    );

                    return (
                        <div key={client.phone} className="bg-white/60 backdrop-blur-sm rounded-3xl overflow-hidden border border-aesthetic-accent transition-all duration-300 hover:shadow-minimal">
                            {/* Loyalty reward banner (collapsed) */}
                            {hasReward && (
                                <div className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-amber-50 to-yellow-50 border-b border-yellow-200">
                                    <span className="text-lg">🎁</span>
                                    <p className="text-[10px] tracking-[0.2em] uppercase font-bold text-amber-700">
                                        {loyaltyStatus!.rewardType === 'free_service'
                                            ? '¡Premio listo! Servicio gratis acumulado'
                                            : `¡Premio listo! ${loyaltyStatus!.discountValue}% de descuento acumulado`
                                        }
                                    </p>
                                </div>
                            )}
                            {/* Main row */}
                            <button
                                className="w-full text-left flex items-center gap-5 p-5 active:bg-aesthetic-soft-pink/20 transition-colors"
                                onClick={() => setExpandedPhone(expanded ? null : client.phone)}
                            >
                                {/* Avatar */}
                                <div className="size-14 rounded-full flex items-center justify-center flex-shrink-0 text-base font-bold font-display italic border border-aesthetic-accent shadow-sm bg-aesthetic-soft-pink text-aesthetic-taupe">
                                    {initials(client.name)}
                                </div>
                                {/* Info */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <h3 className="text-xl font-medium leading-tight text-aesthetic-taupe font-display">{client.name}</h3>
                                        {client.favorite && (
                                            <span className="material-symbol text-yellow-400 text-lg">star</span>
                                        )}
                                    </div>
                                    <p className="text-xs text-aesthetic-muted/80 mt-1 font-display italic">
                                        Últ: {client.lastVisit ? formatShortDate(client.lastVisit) : 'Sin visitas'} • <span className="opacity-60">{client.lastService || 'Servicio'}</span>
                                        {client.visits > 1 && <span className="ml-2 opacity-40">({client.visits} visitas)</span>}
                                    </p>
                                </div>
                                {/* Star + Chevron */}
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={(e) => { e.stopPropagation(); void toggleFavorite(client); }}
                                        aria-label={client.favorite ? `Quitar a ${client.name} de favoritas` : `Marcar a ${client.name} como favorita`}
                                        aria-pressed={client.favorite}
                                        className="size-9 rounded-full flex items-center justify-center hover:bg-aesthetic-soft-pink/40 transition-colors"
                                    >
                                        <span className={`material-symbol text-xl ${client.favorite ? 'text-yellow-400' : 'text-aesthetic-muted/30'}`}>
                                            {client.favorite ? 'star' : 'star_border'}
                                        </span>
                                    </button>
                                    <span className={`material-symbol text-aesthetic-muted/40 transition-transform duration-500 scale-125 ${expanded ? 'rotate-180' : ''}`}>
                                        expand_more
                                    </span>
                                </div>
                            </button>

                            {/* Expanded details */}
                            {expanded && (
                                <div className="px-6 pb-6 border-t border-aesthetic-accent/30 pt-4 space-y-6 animate-fade-in">
                                    {/* Loyalty reward detail block */}
                                    {hasReward && (
                                        <div className="flex items-start gap-3 p-4 rounded-2xl bg-gradient-to-br from-amber-50 to-yellow-50 border border-yellow-200">
                                            <span className="text-2xl mt-0.5">🎁</span>
                                            <div>
                                                <p className="text-[10px] tracking-[0.25em] uppercase font-bold text-amber-700 mb-1">Premio de Fidelidad Listo</p>
                                                <p className="text-sm text-amber-800 font-display italic">
                                                    {loyaltyStatus!.rewardType === 'free_service'
                                                        ? `Esta clienta ha acumulado ${loyaltyStatus!.rewards > 1 ? `${loyaltyStatus!.rewards}x ` : ''}un servicio gratis. ¡Es momento de recompensarla!`
                                                        : `Esta clienta merece un ${loyaltyStatus!.discountValue}% de descuento en su próxima visita.`
                                                    }
                                                </p>
                                            </div>
                                        </div>
                                    )}
                                    {/* Contact info */}
                                    <div className="flex flex-wrap gap-3 text-xs text-aesthetic-muted">
                                        <span className="flex items-center gap-1.5 bg-white rounded-full px-3 py-1.5 border border-aesthetic-accent/20">
                                            <span className="material-symbol text-sm">phone</span>
                                            {client.phone}
                                        </span>
                                        {client.email && (
                                            <span className="flex items-center gap-1.5 bg-white rounded-full px-3 py-1.5 border border-aesthetic-accent/20">
                                                <span className="material-symbol text-sm">mail</span>
                                                {client.email}
                                            </span>
                                        )}
                                    </div>

                                    <div className="grid grid-cols-3 gap-3">
                                        <div className="bg-white border border-aesthetic-accent rounded-2xl p-4 text-center shadow-sm">
                                            <p className="font-display text-2xl font-light italic text-aesthetic-taupe mb-1">{client.visits}</p>
                                            <p className="text-[8px] tracking-[0.2em] text-aesthetic-muted uppercase font-bold">Visitas</p>
                                        </div>
                                        <div className="bg-white border border-aesthetic-accent rounded-2xl p-4 text-center shadow-sm">
                                            <p className="font-display text-2xl font-light italic text-aesthetic-taupe mb-1">{formatMoney(client.totalSpent, tenant?.settings?.currency)}</p>
                                            <p className="text-[8px] tracking-[0.2em] text-aesthetic-muted uppercase font-bold">Inversión</p>
                                        </div>
                                        <div className="bg-white border border-aesthetic-accent rounded-2xl p-4 text-center shadow-sm">
                                            <p className="font-display text-2xl font-light italic text-aesthetic-taupe mb-1">{formatMoney(client.visits > 0 ? client.totalSpent / client.visits : 0, tenant?.settings?.currency)}</p>
                                            <p className="text-[8px] tracking-[0.2em] text-aesthetic-muted uppercase font-bold">Ticket Prom.</p>
                                        </div>
                                    </div>

                                    <div className="flex gap-3 pt-2">
                                        <button
                                            onClick={() => setHistoryClient(client)}
                                            className="flex-1 py-4 rounded-full bg-aesthetic-pink text-white text-[10px] tracking-[0.2em] uppercase font-bold shadow-minimal transition-all active:scale-[0.98]"
                                        >
                                            Ver Historial
                                        </button>
                                        {whatsapp && (
                                            <a
                                                href={whatsapp}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                aria-label={`Escribir por WhatsApp a ${client.name}`}
                                                className="size-12 rounded-full border border-aesthetic-accent flex items-center justify-center text-aesthetic-muted hover:bg-aesthetic-soft-pink/40 transition-all"
                                            >
                                                <span className="material-symbol text-xl" aria-hidden="true">chat</span>
                                            </a>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}

                {filtered.length === 0 && (
                    <div className="text-center py-10">
                        <p className="text-nf-gray text-sm italic">
                            {search ? 'No se encontraron clientas' : activeTab === 'favoritas' ? 'Sin favoritas aún. Marca clientas con ⭐' : 'Sin clientas registradas aún'}
                        </p>
                    </div>
                )}
            </div>

            {/* FAB */}


            {/* History Modal */}
            {historyClient && (
                <div className="fixed inset-0 bg-aesthetic-taupe/40 backdrop-blur-md z-[100] flex items-end sm:items-center justify-center animate-fade-in" onClick={() => setHistoryClient(null)}>
                    <div className="bg-aesthetic-cream rounded-t-[3rem] sm:rounded-[3rem] w-full max-w-lg max-h-[85vh] shadow-2xl relative border border-white/50 overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
                        {/* Decorative */}
                        <div className="absolute top-0 right-0 size-40 bg-aesthetic-pink/10 blur-3xl rounded-full -mr-20 -mt-20" />

                        {/* Header */}
                        <div className="p-8 pb-4 relative">
                            <button onClick={() => setHistoryClient(null)} className="absolute top-6 right-6 size-10 rounded-full bg-white/50 flex items-center justify-center hover:bg-white transition-colors">
                                <span className="material-symbol text-aesthetic-muted">close</span>
                            </button>
                            <p className="text-[10px] tracking-[0.4em] text-aesthetic-muted uppercase mb-2 font-display italic font-medium">Historial Completo</p>
                            <h2 className="font-display text-3xl italic text-aesthetic-taupe leading-tight">{historyClient.name}</h2>
                            <div className="flex items-center gap-3 mt-2 text-xs text-aesthetic-muted">
                                <span>{historyClient.phone}</span>
                                {historyClient.email && <span>• {historyClient.email}</span>}
                            </div>
                        </div>

                        {/* Scrollable history list */}
                        <div className="flex-1 overflow-y-auto px-8 pb-8 space-y-3 custom-scrollbar">
                            {getClientHistory(historyClient).map(apt => {
                                const service = services.find(item => item.id === apt.service_id);
                                const presentation = STATUS_PRESENTATION[apt.status];

                                return (
                                    <div key={apt.id} className="bg-white rounded-2xl p-5 border border-aesthetic-accent/20 shadow-sm">
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="flex-1 min-w-0">
                                                <p className="font-display text-lg italic text-aesthetic-taupe truncate">
                                                    {apt.service_name ?? service?.name ?? 'Servicio'}
                                                </p>
                                                <p className="text-xs text-aesthetic-muted mt-1 capitalize">
                                                    {formatDate(apt.datetime_start)} • {formatTime(apt.datetime_start)}
                                                </p>
                                            </div>
                                            <div className="text-right flex-shrink-0 space-y-1">
                                                <p className="font-semibold text-aesthetic-taupe">
                                                    {formatMoney(apt.price, tenant?.settings?.currency)}
                                                </p>
                                                <span className="status-pill" data-status={presentation.token}>{presentation.label}</span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}

                            {getClientHistory(historyClient).length === 0 && (
                                <div className="text-center py-10">
                                    <p className="text-aesthetic-muted text-sm italic font-display">Sin historial de citas</p>
                                </div>
                            )}

                            {/* Summary */}
                            <div className="mt-4 p-5 bg-aesthetic-soft-pink/20 rounded-2xl border border-aesthetic-accent/20">
                                <div className="flex justify-between text-sm">
                                    <span className="text-aesthetic-muted">Total visitas</span>
                                    <span className="font-semibold text-aesthetic-taupe">{historyClient.visits}</span>
                                </div>
                                <div className="flex justify-between text-sm mt-2">
                                    <span className="text-aesthetic-muted">Total invertido</span>
                                    <span className="font-semibold text-aesthetic-taupe">{formatMoney(historyClient.totalSpent, tenant?.settings?.currency)}</span>
                                </div>
                                {/* Loyalty status in modal */}
                                {(() => {
                                    const ls = getLoyaltyStatus(historyClient);
                                    if (!ls || ls.rewards === 0) return null;
                                    return (
                                        <div className="mt-3 pt-3 border-t border-amber-200 flex items-center gap-2">
                                            <span className="text-xl">🎁</span>
                                            <p className="text-xs font-bold text-amber-700 tracking-wide">
                                                {ls.rewardType === 'free_service'
                                                    ? 'Tiene derecho a un servicio GRATIS'
                                                    : `Tiene ${ls.discountValue}% de descuento acumulado`
                                                }
                                            </p>
                                        </div>
                                    );
                                })()}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
