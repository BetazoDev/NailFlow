'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Appointment, Service, Client, Tenant } from '@/lib/types';

import { api } from '@/lib/api';
import { useTenant } from '@/lib/tenant-context';

// Mock preferences/allergy data for CRM
const MOCK_CLIENT_EXTRAS: Record<string, { preferences?: string; allergies?: string }> = {
    '+5491100000001': { preferences: 'Prefiere tonos nude y acabado mate. Uñas de crecimiento rápido.', allergies: 'Alérgica al látex' },
    '+5491100000002': { preferences: 'Le gustan los diseños florales y colores pastel.', allergies: undefined },
    '+5491100000003': { preferences: 'Prefiere diseños geométricos con colores neutros.', allergies: undefined },
};

type FilterTab = 'todas' | 'recientes' | 'favoritas';

export default function ClientsPage() {
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [services, setServices] = useState<Service[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [activeTab, setActiveTab] = useState<FilterTab>('todas');
    const [expandedPhone, setExpandedPhone] = useState<string | null>(null);
    const [favorites, setFavorites] = useState<Set<string>>(new Set());
    const [historyClient, setHistoryClient] = useState<Client | null>(null);
    const [loyaltySettings, setLoyaltySettings] = useState<Tenant['settings'] | null>(null);
    const { tenantId } = useTenant();

    useEffect(() => {
        if (!tenantId) return;
        Promise.all([
            api.getAppointments(),
            api.getServices(),
            api.getFavorites(),
            api.getTenant(tenantId),
        ]).then(([apts, svcs, favs, tenant]) => {
            setAppointments(apts);
            setServices(svcs);
            setFavorites(favs);
            if (tenant) setLoyaltySettings(tenant.settings as any);
        }).finally(() => setLoading(false));
    }, [tenantId]);

    // Derived: does a client qualify for a loyalty reward right now?
    const getLoyaltyStatus = useCallback((client: Client) => {
        const loyalty = loyaltySettings?.loyalty;
        if (!loyalty?.enabled) return null;
        const required = loyalty.visits_required ?? 5;
        if (client.visits < required) return null;
        const multiples = Math.floor(client.visits / required);
        return {
            multiples,
            rewardType: loyalty.reward_type,
            discountValue: loyalty.discount_value,
        };
    }, [loyaltySettings]);

    const getServiceName = useCallback((id: string, apt?: Appointment) => {
        const svc = services.find(s => s.id === id);
        if (svc) return svc.name;
        if (apt?.service_name) return apt.service_name;
        return 'Servicio';
    }, [services]);

    const getServicePrice = useCallback((id: string, apt?: Appointment) => {
        const svc = services.find(s => s.id === id);
        if (svc) return Number(svc.estimated_price) || 0;
        if (apt?.service_price) return Number(apt.service_price) || 0;
        if (apt?.price) return Number(apt.price) || 0;
        return 0;
    }, [services]);

    const clients: Client[] = useMemo(() => {
        const map = new Map<string, Client>();
        appointments.forEach(apt => {
            // Key by phone primarily, also check email for merging
            const key = apt.client_phone;
            const existing = map.get(key);
            const svcName = getServiceName(apt.service_id, apt);
            const svcPrice = getServicePrice(apt.service_id, apt);

            if (existing) {
                existing.visits += 1;
                existing.totalSpent = Number(existing.totalSpent) + svcPrice;
                if (apt.datetime_start > existing.lastVisit) {
                    existing.lastVisit = apt.datetime_start;
                    existing.lastService = svcName;
                }
                if (!existing.services.includes(svcName)) existing.services.push(svcName);
                // Merge email
                if (apt.client_email && !existing.email) {
                    existing.email = apt.client_email;
                }
            } else {
                // Check if same email exists under a different phone
                let merged = false;
                if (apt.client_email) {
                    for (const [, client] of map) {
                        if (client.email === apt.client_email) {
                            client.visits += 1;
                            client.totalSpent = Number(client.totalSpent) + svcPrice;
                            if (apt.datetime_start > client.lastVisit) {
                                client.lastVisit = apt.datetime_start;
                                client.lastService = svcName;
                            }
                            if (!client.services.includes(svcName)) client.services.push(svcName);
                            merged = true;
                            break;
                        }
                    }
                }
                if (!merged) {
                    const extras = MOCK_CLIENT_EXTRAS[apt.client_phone] || {};
                    map.set(key, {
                        name: apt.client_name,
                        phone: apt.client_phone,
                        email: apt.client_email,
                        visits: 1,
                        lastVisit: apt.datetime_start,
                        lastService: svcName,
                        totalSpent: svcPrice,
                        services: [svcName],
                        preferences: extras.preferences,
                        allergies: extras.allergies,
                        favorite: favorites.has(apt.client_phone),
                    });
                }
            }
        });
        // Apply favorite flag
        const result = Array.from(map.values());
        result.forEach(c => { c.favorite = favorites.has(c.phone); });
        return result;
    }, [appointments, getServiceName, getServicePrice, favorites]);

    const filtered = useMemo(() => {
        let list = clients;
        if (search) {
            const q = search.toLowerCase();
            list = list.filter(c =>
                c.name.toLowerCase().includes(q) || c.phone.includes(q) || (c.email || '').toLowerCase().includes(q)
            );
        }
        if (activeTab === 'recientes') {
            list = list.slice().sort((a, b) => (a.lastVisit > b.lastVisit ? -1 : 1)).slice(0, 5);
        }
        if (activeTab === 'favoritas') {
            list = list.filter(c => c.favorite);
        }
        return list;
    }, [clients, search, activeTab]);

    const toggleFavorite = async (client: Client) => {
        if (!tenantId) return;
        const newState = !client.favorite;
        try {
            await api.setFavorite(client.phone, newState);
            setFavorites(prev => {
                const next = new Set(prev);
                if (newState) next.add(client.phone);
                else next.delete(client.phone);
                return next;
            });
        } catch (e) {
            console.error('Error toggling favorite:', e);
        }
    };

    const formatDate = (dateStr: string) => {
        const d = new Date(dateStr);
        return d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' }).replace('.', '');
    };

    const _formatFullDate = (dateStr: string) => {
        const d = new Date(dateStr);
        return d.toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' });
    };

    // Get all appointments for a client (for history modal)
    const getClientHistory = (client: Client) => {
        return appointments
            .filter(apt => apt.client_phone === client.phone || (client.email && apt.client_email === client.email))
            .sort((a, b) => new Date(b.datetime_start).getTime() - new Date(a.datetime_start).getTime());
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="w-8 h-8 border-2 border-pink-light border-t-pink rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div className="relative min-h-full pb-24" style={{ background: 'var(--cream)' }}>
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
                    <input
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
                        className={`pill-tab ${activeTab === tab ? 'pill-tab-active' : 'pill-tab-inactive'}`}
                    >
                        {tab === 'favoritas' && <span className="material-symbol text-sm mr-1">star</span>}
                        {tab.charAt(0).toUpperCase() + tab.slice(1)}
                    </button>
                ))}
            </div>

            {/* Client list */}
            <div className="px-6 mt-5 space-y-3 stagger-children">
                {filtered.map(client => {
                    const initials = client.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
                    const expanded = expandedPhone === client.phone;
                    const loyaltyStatus = getLoyaltyStatus(client);

                    return (
                        <div key={client.phone} className="bg-white/60 backdrop-blur-sm rounded-3xl overflow-hidden border border-aesthetic-accent transition-all duration-300 hover:shadow-minimal">
                            {/* Loyalty reward banner (collapsed) */}
                            {loyaltyStatus && (
                                <div className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-amber-50 to-yellow-50 border-b border-yellow-200">
                                    <span className="text-lg">🎁</span>
                                    <p className="text-[10px] tracking-[0.2em] uppercase font-bold text-amber-700">
                                        {loyaltyStatus.rewardType === 'free_service'
                                            ? `¡Premio listo! Servicio gratis acumulado`
                                            : `¡Premio listo! ${loyaltyStatus.discountValue}% de descuento acumulado`
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
                                    {initials}
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
                                        Ult: {formatDate(client.lastVisit)} • <span className="opacity-60">{client.lastService || 'Servicio'}</span>
                                        {client.visits > 1 && <span className="ml-2 opacity-40">({client.visits} visitas)</span>}
                                    </p>
                                </div>
                                {/* Star + Chevron */}
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={(e) => { e.stopPropagation(); toggleFavorite(client); }}
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
                                    {loyaltyStatus && (
                                        <div className="flex items-start gap-3 p-4 rounded-2xl bg-gradient-to-br from-amber-50 to-yellow-50 border border-yellow-200">
                                            <span className="text-2xl mt-0.5">🎁</span>
                                            <div>
                                                <p className="text-[10px] tracking-[0.25em] uppercase font-bold text-amber-700 mb-1">Premio de Fidelidad Listo</p>
                                                <p className="text-sm text-amber-800 font-display italic">
                                                    {loyaltyStatus.rewardType === 'free_service'
                                                        ? `Esta clienta ha acumulado ${loyaltyStatus.multiples > 1 ? `${loyaltyStatus.multiples}x` : ''} un servicio gratis. ¡Es momento de recompensarla!`
                                                        : `Esta clienta merece un ${loyaltyStatus.discountValue}% de descuento en su próxima visita.`
                                                    }
                                                </p>
                                            </div>
                                        </div>
                                    )}
                                    {client.preferences && (
                                        <div>
                                            <p className="text-[9px] tracking-[0.3em] text-aesthetic-muted/60 uppercase font-bold mb-2 ml-1">Preferencias</p>
                                            <div className="bg-aesthetic-soft-pink/20 rounded-2xl p-4 border border-aesthetic-accent/20">
                                                <p className="italic text-aesthetic-taupe text-sm leading-relaxed font-display">&ldquo;{client.preferences}&rdquo;</p>
                                            </div>
                                        </div>
                                    )}
                                    {client.allergies && (
                                        <div className="flex items-center gap-2.5 px-3 py-2 bg-red-50 rounded-xl border border-red-100">
                                            <span className="material-symbol text-red-400 text-lg">warning</span>
                                            <p className="text-[10px] tracking-[0.2em] uppercase font-bold text-red-500 font-display italic">
                                                ALERGIA: {client.allergies}
                                            </p>
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
                                            <p className="font-display text-2xl font-light italic text-aesthetic-taupe mb-1">${client.totalSpent}</p>
                                            <p className="text-[8px] tracking-[0.2em] text-aesthetic-muted uppercase font-bold">Inversión</p>
                                        </div>
                                        <div className="bg-white border border-aesthetic-accent rounded-2xl p-4 text-center shadow-sm">
                                            <p className="font-display text-2xl font-light italic text-aesthetic-taupe mb-1">${client.visits > 0 ? Math.round(client.totalSpent / client.visits) : 0}</p>
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
                                        <button className="size-12 rounded-full border border-aesthetic-accent flex items-center justify-center text-aesthetic-muted hover:bg-aesthetic-soft-pink/40 transition-all">
                                            <span className="material-symbol text-xl">call</span>
                                        </button>
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
                            {getClientHistory(historyClient).map((apt, idx) => {
                                const svc = services.find(s => s.id === apt.service_id);
                                const startDate = new Date(apt.datetime_start);
                                const dateStr = startDate.toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' });
                                const timeStr = startDate.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false });
                                const statusLabels: Record<string, { label: string; color: string }> = {
                                    confirmed: { label: 'Confirmada', color: '#C97794' },
                                    completed: { label: 'Completada', color: '#88C999' },
                                    pending_payment: { label: 'Pendiente', color: '#AB937D' },
                                    cancelled: { label: 'Cancelada', color: '#999' },
                                };
                                const s = statusLabels[apt.status] || statusLabels.pending_payment;

                                return (
                                    <div key={apt.id || idx} className="bg-white rounded-2xl p-5 border border-aesthetic-accent/20 shadow-sm">
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="flex-1 min-w-0">
                                                <p className="font-display text-lg italic text-aesthetic-taupe truncate">{svc?.name || 'Servicio'}</p>
                                                <p className="text-xs text-aesthetic-muted mt-1 capitalize">{dateStr} • {timeStr}</p>
                                            </div>
                                            <div className="text-right flex-shrink-0">
                                                <p className="font-semibold text-aesthetic-taupe">${svc?.estimated_price || 0}</p>
                                                <span className="text-[9px] tracking-[0.15em] uppercase font-bold" style={{ color: s.color }}>{s.label}</span>
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
                                    <span className="font-semibold text-aesthetic-taupe">${historyClient.totalSpent}</span>
                                </div>
                                {/* Loyalty status in modal */}
                                {getLoyaltyStatus(historyClient) && (() => {
                                    const ls = getLoyaltyStatus(historyClient)!;
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
