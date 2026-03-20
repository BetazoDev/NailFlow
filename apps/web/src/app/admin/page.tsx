'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Appointment, Service, Staff } from '@/lib/types';

import { api } from '@/lib/api';
import { useTenant } from '@/lib/tenant-context';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { MetricsGrid } from '@/components/admin/MetricsGrid';
import Lightbox from '@/components/ui/Lightbox';

const STATUS_LABELS: Record<string, { label: string; color: string; bg: string }> = {
    confirmed: { label: 'CONFIRMADA', color: 'var(--aesthetic-pink)', bg: 'var(--aesthetic-soft-pink)' },
    pending_payment: { label: 'PENDIENTE', color: 'var(--aesthetic-taupe)', bg: 'var(--aesthetic-beige)' },
    cancelled: { label: 'CANCELADA', color: 'var(--gray-light)', bg: 'var(--cream-dark)' },
    completed: { label: 'COMPLETADA', color: '#88C999', bg: 'rgba(136, 201, 153, 0.1)' },
};

type IncomePeriod = 'day' | 'week' | 'month';

interface AppointmentDetailProps {
    apt: Appointment;
    service?: Service;
    onClose: () => void;
    onComplete: () => Promise<void>;
    staff: Staff[];
}

function AppointmentDetail({ apt, service, onClose, onComplete, staff }: AppointmentDetailProps) {
    const [completing, setCompleting] = useState(false);
    const [lbIndex, setLbIndex] = useState<number | null>(null);
    const s = STATUS_LABELS[apt.status] || STATUS_LABELS.pending_payment;
    const startDate = new Date(apt.datetime_start);
    const dateStr = startDate.toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' });
    const timeStr = startDate.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false });
    const duration = service?.duration_minutes || 60;
    const advance = service?.required_advance || 0;
    const total = service?.estimated_price || 0;
    const balance = total - advance;
    const waMessage = `¡Hola hermosa ${apt.client_name}! ✨ Te escribo para recordarte tu cita programada este ${dateStr} a las ${timeStr} hs. ¡Me muero de ganas de verte y dejarte espectacular! 💅💖 Por favor confírmanos tu asistencia. ¡Besos!`;

    return (
        <div className="fixed inset-0 z-50 flex justify-end animate-fade-in" onClick={onClose}>
            <div className="absolute inset-0 bg-charcoal/30 backdrop-blur-sm" />
            <div className="relative w-full max-w-md bg-cream h-full shadow-2xl animate-slide-in-right overflow-y-auto" onClick={e => e.stopPropagation()}>
                {/* Top bar */}
                <div className="flex items-center justify-between px-6 pt-6 pb-4">
                    <button onClick={onClose} className="text-aesthetic-muted hover:text-aesthetic-taupe transition-colors">
                        <span className="material-symbol font-light">arrow_back</span>
                    </button>
                    <div className="size-10" />
                </div>

                {/* Client header */}
                <div className="px-6 pb-6">
                    <h1 className="font-display text-4xl font-light italic text-aesthetic-taupe mb-2 tracking-tight">{apt.client_name}</h1>
                    <div className="flex items-center gap-3">
                        <span className="text-[10px] tracking-[0.2em] uppercase font-bold px-3 py-1 rounded-full" style={{ background: s.bg, color: s.color }}>
                            {s.label}
                        </span>
                        <span className="text-aesthetic-muted text-sm font-display italic tracking-wide">{service?.name || 'Servicio'}</span>
                    </div>
                </div>

                {/* Details card */}
                <div className="mx-6 bg-white/60 backdrop-blur-sm rounded-[2.5rem] border border-aesthetic-accent p-8 mb-5 shadow-minimal">
                    <p className="text-[10px] tracking-[0.3em] text-aesthetic-muted uppercase mb-6 font-display italic font-medium">Detalles del turno</p>
                    <div className="grid grid-cols-2 gap-y-8 gap-x-4">
                        <div>
                            <p className="text-[9px] tracking-[0.2em] text-aesthetic-muted/60 uppercase font-bold mb-1">Fecha</p>
                            <p className="font-display text-lg italic text-aesthetic-taupe capitalize leading-tight">{dateStr}</p>
                        </div>
                        <div>
                            <p className="text-[9px] tracking-[0.2em] text-aesthetic-muted/60 uppercase font-bold mb-1">Hora</p>
                            <p className="font-display text-lg italic text-aesthetic-taupe leading-tight">{timeStr}</p>
                        </div>
                        <div>
                            <p className="text-[9px] tracking-[0.2em] text-aesthetic-muted/60 uppercase font-bold mb-1">Duración</p>
                            <p className="font-display text-lg italic text-aesthetic-taupe leading-tight">{duration} min</p>
                        </div>
                        <div>
                            <p className="text-[9px] tracking-[0.2em] text-aesthetic-muted/60 uppercase font-bold mb-1">Especialista</p>
                            <p className="font-display text-lg italic text-aesthetic-taupe leading-tight capitalize">
                                {staff.find(s => s.id === apt.staff_id)?.name || 'Sin asignar'}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Reference photos */}
                {(apt.image_url || (apt.image_urls && apt.image_urls.length > 0)) && (
                    <div className="px-6 mb-5">
                        <p className="text-[10px] tracking-[0.15em] text-nf-gray uppercase mb-3">Fotos de Referencia</p>
                        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
                            {(apt.image_urls || (apt.image_url ? [apt.image_url] : [])).map((url, idx) => (
                                <div 
                                    key={idx} 
                                    className="w-28 h-28 rounded-2xl overflow-hidden flex-shrink-0 cursor-zoom-in hover:scale-105 active:scale-95 transition-all"
                                    onClick={() => setLbIndex(idx)}
                                >
                                    <img src={api.getPublicUrl(url)} alt={`ref-${idx}`} className="w-full h-full object-cover" />
                                </div>
                            ))}
                        </div>

                        {lbIndex !== null && (
                            <Lightbox
                                images={(apt.image_urls || (apt.image_url ? [apt.image_url] : [])).map(u => api.getPublicUrl(u))}
                                initialIndex={lbIndex}
                                onClose={() => setLbIndex(null)}
                            />
                        )}
                    </div>
                )}

                {/* Client notes */}
                {apt.notes && (
                    <div className="px-6 mb-5">
                        <p className="text-[10px] tracking-[0.15em] text-nf-gray uppercase mb-3">Notas de la Clienta</p>
                        <blockquote className="italic text-charcoal text-sm leading-relaxed border-l-2 pl-4" style={{ borderColor: 'var(--pink)' }}>
                            &ldquo;{apt.notes}&rdquo;
                        </blockquote>
                    </div>
                )}

                {/* Payment info */}
                {total > 0 && (
                    <div className="mx-6 mb-5">
                        <p className="text-[10px] tracking-[0.15em] text-nf-gray uppercase mb-3">Información de Pago</p>
                        <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                                <span className="text-nf-gray">Total Servicio</span>
                                <span className="font-medium text-charcoal">${total}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-nf-gray flex items-center gap-1">
                                    <span className="w-3 h-3 rounded-full bg-green-400 inline-block" />
                                    Anticipo Pagado
                                </span>
                                <span className="font-medium text-charcoal">${advance}</span>
                            </div>
                            <div className="border-t border-cream-dark pt-2 flex justify-between">
                                <span className="font-semibold text-charcoal">Saldo Pendiente</span>
                                <span className="font-serif font-bold text-xl text-charcoal">${balance}</span>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Sticky Action Footer */}
            <div className="sticky bottom-0 left-0 right-0 px-6 pt-4 pb-12 bg-cream border-t border-aesthetic-accent/20 flex flex-col gap-3 shadow-[0_-10px_30px_rgba(0,0,0,0.05)] z-20">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <a
                        href={`https://wa.me/${apt.client_phone.replace(/\D/g, '')}?text=${encodeURIComponent(waMessage)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full py-3.5 rounded-full font-display italic text-lg tracking-wide border border-aesthetic-pink/20 bg-aesthetic-soft-pink text-aesthetic-taupe flex items-center justify-center gap-3 transition-all duration-300 hover:shadow-minimal active:scale-[0.98]"
                    >
                        <span className="material-symbol text-xl text-[#25D366]">chat</span>
                        WhatsApp
                    </a>

                    {apt.status !== 'completed' && apt.status !== 'cancelled' && (
                        <button
                            onClick={async () => {
                                setCompleting(true);
                                await onComplete();
                                setCompleting(false);
                            }}
                            disabled={completing || new Date() < new Date(apt.datetime_start)}
                            className="w-full py-3.5 rounded-full font-display italic text-lg tracking-wide bg-aesthetic-taupe text-white flex items-center justify-center gap-3 transition-all duration-300 hover:bg-black active:scale-[0.98] disabled:opacity-50 disabled:grayscale shadow-lg"
                        >
                            {completing ? (
                                <div className="size-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                <>
                                    <span className="material-symbol text-xl text-[#88C999]">check_circle</span>
                                    {new Date() < new Date(apt.datetime_start) ? 'Próxima' : 'Completar'}
                                </>
                            )}
                        </button>
                    )}
                </div>
                
                {apt.status !== 'completed' && apt.status !== 'cancelled' && new Date() < new Date(apt.datetime_start) && (
                    <p className="text-[9px] text-center text-aesthetic-muted uppercase tracking-widest font-bold">
                        Habilitado al iniciar el turno
                    </p>
                )}
                
                <div className="pt-2 text-center">
                    <button className="text-[10px] tracking-[0.3em] text-aesthetic-muted uppercase hover:text-red-400 transition-colors font-display italic font-medium">
                        Cancelar Cita
                    </button>
                </div>
            </div>
        </div>
    );
}

export default function AdminDashboard() {
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [services, setServices] = useState<Service[]>([]);
    const [staff, setStaff] = useState<Staff[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedApt, setSelectedApt] = useState<Appointment | null>(null);
    const [copiedSlug, setCopiedSlug] = useState<string | null>(null);
    const [incomePeriod, setIncomePeriod] = useState<IncomePeriod>('day');
    const { tenantId, domain } = useTenant();

    useEffect(() => {
        if (!tenantId) return;
        Promise.all([
            api.getAppointments(),
            api.getServices(),
            api.getStaff(),
        ]).then(([apts, svcs, stf]) => {
            setAppointments(apts);
            setServices(svcs);
            setStaff(stf);
        }).finally(() => setLoading(false));
    }, [tenantId]);

    const getService = useCallback((id: string) => services.find(s => s.id === id), [services]);

    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    // Start of current week (Monday)
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - ((today.getDay() + 6) % 7));
    startOfWeek.setHours(0, 0, 0, 0);

    // Start of current month
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    startOfMonth.setHours(0, 0, 0, 0);

    const completedAppointments = useMemo(() =>
        appointments.filter(a => a.status === 'completed'),
        [appointments]
    );

    const todaysAppointments = useMemo(() =>
        appointments
            .filter(apt => apt.datetime_start && apt.datetime_start.split('T')[0] === todayStr && apt.status !== 'cancelled')
            .sort((a, b) => new Date(a.datetime_start).getTime() - new Date(b.datetime_start).getTime()),
        [appointments, todayStr]
    );

    const pendingAppointments = useMemo(() =>
        todaysAppointments.filter(a => a.status !== 'completed'),
        [todaysAppointments]
    );

    const completedToday = useMemo(() =>
        todaysAppointments.filter(a => a.status === 'completed'),
        [todaysAppointments]
    );

    const todayIncome = useMemo(() =>
        completedToday.reduce((sum, a) => sum + (Number(a.price) || getService(a.service_id)?.estimated_price || 0), 0),
        [completedToday, getService]
    );

    const weeklyIncome = useMemo(() =>
        completedAppointments
            .filter(a => new Date(a.datetime_start) >= startOfWeek)
            .reduce((sum, a) => sum + (Number(a.price) || getService(a.service_id)?.estimated_price || 0), 0),
        [completedAppointments, startOfWeek, getService]
    );

    const monthlyIncome = useMemo(() =>
        completedAppointments
            .filter(a => new Date(a.datetime_start) >= startOfMonth)
            .reduce((sum, a) => sum + (Number(a.price) || getService(a.service_id)?.estimated_price || 0), 0),
        [completedAppointments, startOfMonth, getService]
    );

    const displayIncome = incomePeriod === 'day' ? todayIncome : incomePeriod === 'week' ? weeklyIncome : monthlyIncome;
    const displayCompletedCount = incomePeriod === 'day'
        ? completedToday.length
        : incomePeriod === 'week'
            ? completedAppointments.filter(a => new Date(a.datetime_start) >= startOfWeek).length
            : completedAppointments.filter(a => new Date(a.datetime_start) >= startOfMonth).length;

    const periodLabel = incomePeriod === 'day' ? 'Hoy' : incomePeriod === 'week' ? 'Esta semana' : 'Este mes';

    // Owner info from staff (Dirección role)
    const owner = useMemo(() => staff.find(s => s.role === 'owner'), [staff]);

    const handleCopyLink = (member: Staff) => {
        const slug = member.slug || member.name.toLowerCase().replace(/\s+/g, '-');
        // For Dirección role: use root domain. For staff: use /book/slug
        const baseDomain = domain && domain.includes('.') ? domain : `${domain}.nailflow.app`;
        const finalUrl = member.role === 'owner'
            ? `https://${baseDomain}`
            : `https://${baseDomain}/book/${slug}`;

        navigator.clipboard.writeText(finalUrl).catch(() => { });
        setCopiedSlug(member.id);
        setTimeout(() => setCopiedSlug(null), 2000);
    };

    const handleComplete = async (apt: Appointment) => {
        if (!tenantId) return;
        try {
            await api.completeAppointment(apt.id);
            setAppointments(prev => prev.map(a => a.id === apt.id ? { ...a, status: 'completed' } : a));
            setSelectedApt(null);
        } catch (e) {
            console.error('Error completing appointment:', e);
        }
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
                <p className="text-[10px] tracking-[0.3em] text-aesthetic-muted uppercase mb-2 font-display italic font-medium">
                    {owner ? `Hola, ${owner.name.split(' ')[0]}` : 'Bienvenida'}
                </p>
                <div className="flex items-center justify-between">
                    <h1 className="font-display text-4xl font-light italic tracking-tight text-aesthetic-taupe">Buenos días ✨</h1>
                    <div className="size-11 rounded-full overflow-hidden shadow-soft border-2 border-white ring-1 ring-aesthetic-accent/50">
                        {owner?.photo_url ? (
                            <img src={owner.photo_url} alt={owner.name} className="w-full h-full object-cover" />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-sm font-display italic bg-aesthetic-soft-pink text-aesthetic-taupe">
                                {owner ? owner.name.split(' ').map(n => n[0]).join('').slice(0, 2) : '✦'}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Staff Booking Links */}
            <div className="mx-6 mt-5 space-y-2">
                <p className="text-[10px] tracking-[0.15em] text-aesthetic-muted uppercase font-display italic font-medium mb-2">Links de Reservas del Equipo</p>
                {staff.map(member => {
                    const slug = member.slug || member.name.toLowerCase().replace(/\s+/g, '-');
                    const baseDomain = domain && domain.includes('.') ? domain : `${domain}.nailflow.app`;
                    const url = member.role === 'owner'
                        ? baseDomain
                        : `${baseDomain}/book/${slug}`;
                    const isCopied = copiedSlug === member.id;
                    return (
                        <div key={member.id} className="bg-white rounded-2xl p-3.5 shadow-sm flex items-center gap-3 border border-aesthetic-accent/30">
                            <div className="size-9 rounded-full flex items-center justify-center text-xs font-display italic bg-aesthetic-soft-pink text-aesthetic-taupe border border-aesthetic-accent overflow-hidden flex-shrink-0">
                                {member.photo_url ? (
                                    <img src={member.photo_url} alt={member.name} className="w-full h-full object-cover" />
                                ) : member.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-xs font-medium text-aesthetic-taupe font-display truncate">
                                    {member.name}
                                    {member.role === 'owner' && <span className="ml-1 text-[9px] text-aesthetic-pink">(Dirección)</span>}
                                </p>
                                <p className="text-[10px] text-aesthetic-muted/60 truncate font-display italic">https://{url}</p>
                            </div>
                            <button
                                onClick={() => handleCopyLink(member)}
                                className={`flex-shrink-0 p-2 rounded-xl transition-all duration-200 hover:scale-105 ${isCopied ? 'bg-[#88C999]/10' : 'bg-aesthetic-cream'}`}
                            >
                                <span className={`material-symbol text-base ${isCopied ? 'text-[#88C999]' : 'text-aesthetic-muted'}`}>
                                    {isCopied ? 'check' : 'content_copy'}
                                </span>
                            </button>
                        </div>
                    );
                })}
            </div>

            {/* Metrics Dashboard */}
            <div className="px-6 mt-8">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="font-display text-xl italic text-aesthetic-taupe">Resumen de Negocio</h2>
                    <div className="flex gap-1 bg-aesthetic-cream rounded-full p-1">
                        {([['day', 'Hoy'], ['week', 'Semana'], ['month', 'Mes']] as [IncomePeriod, string][]).map(([id, label]) => (
                            <button
                                key={id}
                                onClick={() => setIncomePeriod(id)}
                                className={`px-4 py-1.5 rounded-full text-[10px] font-bold tracking-[0.1em] uppercase transition-all duration-200 ${incomePeriod === id ? 'bg-white shadow-sm text-aesthetic-taupe' : 'text-aesthetic-muted/60'}`}
                            >
                                {label}
                            </button>
                        ))}
                    </div>
                </div>
                
                <MetricsGrid 
                    income={displayIncome}
                    completedCitations={displayCompletedCount}
                    pendingCitations={pendingAppointments.length}
                    newClients={Math.floor(appointments.length * 0.3)} // Mock stat for now
                    periodLabel={periodLabel}
                />
            </div>

            {/* Pending Appointments */}
            <div className="px-6 mt-6">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="font-display text-xl italic text-aesthetic-taupe">Pendientes</h2>
                    {pendingAppointments.length > 0 && (
                        <span className="text-[11px] tracking-[0.12em] font-semibold uppercase text-aesthetic-pink">
                            {pendingAppointments.length} turno{pendingAppointments.length !== 1 ? 's' : ''}
                        </span>
                    )}
                </div>

                {pendingAppointments.length === 0 ? (
                    <div className="text-center py-8 bg-white/30 rounded-3xl border border-dashed border-aesthetic-accent">
                        <span className="material-symbol text-aesthetic-muted/20 text-3xl font-light">check_circle</span>
                        <p className="text-aesthetic-muted/40 text-sm italic font-display mt-2">Todas las citas han sido completadas ✨</p>
                    </div>
                ) : (
                    <div className="space-y-3 stagger-children">
                        {pendingAppointments.map(apt => {
                            const svc = getService(apt.service_id);
                            const startDate = new Date(apt.datetime_start);
                            const timeStr = startDate.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false });
                            const s = STATUS_LABELS[apt.status] || STATUS_LABELS.pending_payment;

                            return (
                                <button
                                    key={apt.id}
                                    className="card-appointment w-full text-left flex items-center gap-4 cursor-pointer"
                                    onClick={() => setSelectedApt(apt)}
                                >
                                    <div className="text-center flex-shrink-0 w-12">
                                        <p className="font-serif text-lg font-bold text-charcoal leading-tight">{timeStr}</p>
                                        <p className="text-[10px] text-nf-gray">{svc?.duration_minutes || 60}M</p>
                                    </div>
                                    <div className="w-px h-12 bg-cream-dark flex-shrink-0" />
                                    <div className="flex-1 min-w-0">
                                        <p className="font-semibold text-charcoal text-[15px] truncate">{apt.client_name}</p>
                                        <p className="text-xs text-nf-gray truncate">{svc?.name || 'Servicio'}</p>
                                    </div>
                                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                                        <span className="text-[10px] tracking-[0.12em] uppercase font-semibold" style={{ color: s.color }}>
                                            {s.label}
                                        </span>
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--gray-light)" strokeWidth="2"><path d="M9 18l6-6-6-6" /></svg>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Completed Appointments */}
            <div className="px-6 mt-6">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="font-display text-xl italic text-aesthetic-taupe flex items-center gap-2">
                        <span className="material-symbol text-[#88C999] text-lg">check_circle</span>
                        Completadas hoy
                    </h2>
                    {completedToday.length > 0 && (
                        <span className="text-[11px] tracking-[0.12em] font-semibold uppercase text-[#88C999]">
                            {completedToday.length}
                        </span>
                    )}
                </div>

                {completedToday.length === 0 ? (
                    <div className="text-center py-8 bg-white/30 rounded-3xl border border-dashed border-aesthetic-accent">
                        <p className="text-aesthetic-muted/40 text-sm italic font-display">Sin citas completadas aún hoy</p>
                    </div>
                ) : (
                    <div className="space-y-3 stagger-children">
                        {completedToday.map(apt => {
                            const svc = getService(apt.service_id);
                            const startDate = new Date(apt.datetime_start);
                            const timeStr = startDate.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false });

                            return (
                                <button
                                    key={apt.id}
                                    className="card-appointment w-full text-left flex items-center gap-4 cursor-pointer opacity-70"
                                    onClick={() => setSelectedApt(apt)}
                                >
                                    <div className="text-center flex-shrink-0 w-12">
                                        <p className="font-serif text-lg font-bold text-charcoal leading-tight">{timeStr}</p>
                                        <p className="text-[10px] text-nf-gray">{svc?.duration_minutes || 60}M</p>
                                    </div>
                                    <div className="w-px h-12 bg-cream-dark flex-shrink-0" />
                                    <div className="flex-1 min-w-0">
                                        <p className="font-semibold text-charcoal text-[15px] truncate">{apt.client_name}</p>
                                        <p className="text-xs text-nf-gray truncate">{svc?.name || 'Servicio'}</p>
                                    </div>
                                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                                        <span className="text-[10px] tracking-[0.12em] uppercase font-semibold text-[#88C999]">
                                            COMPLETADA
                                        </span>
                                        <span className="text-sm font-semibold text-aesthetic-taupe">${svc?.estimated_price || 0}</span>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* FAB */}


            {/* Appointment detail drawer */}
            {selectedApt && (
                <AppointmentDetail
                    apt={selectedApt}
                    service={getService(selectedApt.service_id)}
                    onClose={() => setSelectedApt(null)}
                    onComplete={() => handleComplete(selectedApt)}
                    staff={staff}
                />
            )}
        </div>
    );
}
