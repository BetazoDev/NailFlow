'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Appointment, Service, Staff } from '@/lib/types';

import { api } from '@/lib/api';
import { useTenant } from '@/lib/tenant-context';

const STATUS_LABELS: Record<string, { label: string; color: string; bg: string }> = {
    confirmed: { label: 'CONFIRMADA', color: 'var(--aesthetic-pink)', bg: 'var(--aesthetic-soft-pink)' },
    pending_payment: { label: 'PENDIENTE', color: 'var(--aesthetic-taupe)', bg: 'var(--aesthetic-beige)' },
    cancelled: { label: 'CANCELADA', color: 'var(--gray-light)', bg: 'var(--cream-dark)' },
    completed: { label: 'COMPLETADA', color: '#88C999', bg: 'rgba(136, 201, 153, 0.1)' },
};

interface AppointmentDetailProps {
    apt: Appointment;
    service?: Service;
    onClose: () => void;
    onComplete: () => Promise<void>;
}

function AppointmentDetail({ apt, service, onClose, onComplete }: AppointmentDetailProps) {
    const [completing, setCompleting] = useState(false);
    const s = STATUS_LABELS[apt.status] || STATUS_LABELS.pending_payment;
    const startDate = new Date(apt.datetime_start);
    const dateStr = startDate.toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' });
    const timeStr = startDate.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false });
    const duration = service?.duration_minutes || 60;
    const advance = service ? Math.round(service.estimated_price * 0.4) : 0;
    const total = service?.estimated_price || 0;
    const balance = total - advance;

    return (
        <div className="fixed inset-0 z-50 flex justify-end animate-fade-in" onClick={onClose}>
            <div className="absolute inset-0 bg-charcoal/30 backdrop-blur-sm" />
            <div className="relative w-full max-w-md bg-cream h-full shadow-2xl animate-slide-in-right overflow-y-auto" onClick={e => e.stopPropagation()}>
                {/* Top bar */}
                <div className="flex items-center justify-between px-6 pt-6 pb-4">
                    <button onClick={onClose} className="text-aesthetic-muted hover:text-aesthetic-taupe transition-colors">
                        <span className="material-symbol font-light">arrow_back</span>
                    </button>
                    <button className="text-aesthetic-muted hover:text-aesthetic-taupe transition-colors">
                        <span className="material-symbol font-light">more_horiz</span>
                    </button>
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
                            <p className="text-[9px] tracking-[0.2em] text-aesthetic-muted/60 uppercase font-bold mb-1">Estudio</p>
                            <p className="font-display text-lg italic text-aesthetic-taupe leading-tight">Main Salon</p>
                        </div>
                    </div>
                </div>

                {/* Reference photos */}
                {(apt.image_url || (apt.image_urls && apt.image_urls.length > 0)) && (
                    <div className="px-6 mb-5">
                        <p className="text-[10px] tracking-[0.15em] text-nf-gray uppercase mb-3">Fotos de Referencia</p>
                        <div className="flex gap-3 overflow-x-auto">
                            {(apt.image_urls || (apt.image_url ? [apt.image_url] : [])).map((url, idx) => (
                                <div key={idx} className="w-28 h-28 rounded-2xl overflow-hidden flex-shrink-0">
                                    <img src={url} alt={`ref-${idx}`} className="w-full h-full object-cover" />
                                </div>
                            ))}
                        </div>
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
                {/* WhatsApp CTA */}
                <div className="px-6 pb-4">
                    <a
                        href={`https://wa.me/${apt.client_phone.replace(/\D/g, '')}?text=Hola%20${encodeURIComponent(apt.client_name)}%2C%20te%20recuerdo%20tu%20cita`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full py-5 rounded-full font-display italic text-lg tracking-wide border border-aesthetic-pink/20 bg-aesthetic-soft-pink text-aesthetic-taupe flex items-center justify-center gap-3 transition-all duration-300 hover:shadow-minimal active:scale-[0.98]"
                    >
                        <span className="material-symbol text-xl">chat</span>
                        Contactar por WhatsApp
                    </a>
                </div>

                {apt.status !== 'completed' && apt.status !== 'cancelled' && (
                    <div className="px-6 pb-4">
                        <button
                            onClick={async () => {
                                setCompleting(true);
                                await onComplete();
                                setCompleting(false);
                            }}
                            disabled={completing}
                            className="w-full py-5 rounded-full font-display italic text-lg tracking-wide bg-aesthetic-taupe text-white flex items-center justify-center gap-3 transition-all duration-300 hover:bg-black active:scale-[0.98] disabled:opacity-50"
                        >
                            {completing ? (
                                <div className="size-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                <>
                                    <span className="material-symbol text-xl text-[#88C999]">check_circle</span>
                                    Completar Cita
                                </>
                            )}
                        </button>
                    </div>
                )}
                <div className="px-6 pb-12 text-center">
                    <button className="text-[10px] tracking-[0.3em] text-aesthetic-muted uppercase hover:text-red-400 transition-colors font-display italic font-medium">
                        Cancelar Cita
                    </button>
                </div>
            </div >
        </div >
    );
}

export default function AdminDashboard() {
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [services, setServices] = useState<Service[]>([]);
    const [staff, setStaff] = useState<Staff[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedApt, setSelectedApt] = useState<Appointment | null>(null);
    const [copiedSlug, setCopiedSlug] = useState<string | null>(null);
    const { tenantId, domain } = useTenant();

    useEffect(() => {
        if (!tenantId) return;
        Promise.all([
            api.getAppointments(tenantId),
            api.getServices(tenantId),
            api.getStaff(tenantId),
        ]).then(([apts, svcs, stf]) => {
            setAppointments(apts);
            setServices(svcs);
            setStaff(stf);
        }).finally(() => setLoading(false));
    }, [tenantId]);

    const getService = useCallback((id: string) => services.find(s => s.id === id), [services]);

    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    const todaysAppointments = useMemo(() =>
        appointments
            .filter(apt => apt.date === todayStr && apt.status !== 'cancelled')
            .sort((a, b) => new Date(a.datetime_start).getTime() - new Date(b.datetime_start).getTime()),
        [appointments, todayStr]
    );

    const pendingAppointments = useMemo(() =>
        todaysAppointments.filter(a => a.status !== 'completed'),
        [todaysAppointments]
    );

    const completedAppointments = useMemo(() =>
        todaysAppointments.filter(a => a.status === 'completed'),
        [todaysAppointments]
    );

    const todayIncome = useMemo(() =>
        completedAppointments.reduce((sum, a) => sum + (getService(a.service_id)?.estimated_price || 0), 0),
        [completedAppointments, getService]
    );

    const host = typeof window !== 'undefined' ? window.location.host : 'nailflow.app';

    const handleCopyLink = (member: Staff) => {
        const slug = member.slug || member.name.toLowerCase().replace(/\s+/g, '-');

        const baseDomain = domain && domain.includes('.') ? domain : `${domain}.nailflow.app`;
        const finalUrl = `https://${baseDomain}/book/${slug}`;

        navigator.clipboard.writeText(finalUrl).catch(() => { });
        setCopiedSlug(member.id);
        setTimeout(() => setCopiedSlug(null), 2000);
    };

    const handleComplete = async (apt: Appointment) => {
        if (!tenantId) return;
        try {
            const amount = getService(apt.service_id)?.estimated_price || 0;
            await api.completeAppointment(tenantId, apt.id);
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
                <p className="text-[10px] tracking-[0.3em] text-aesthetic-muted uppercase mb-2 font-display italic font-medium">Hola, Ana</p>
                <div className="flex items-center justify-between">
                    <h1 className="font-display text-4xl font-light italic tracking-tight text-aesthetic-taupe">Buenos días ✨</h1>
                    <div className="size-11 rounded-full overflow-hidden shadow-soft border-2 border-white ring-1 ring-aesthetic-accent/50">
                        <img
                            src="https://lh3.googleusercontent.com/aida-public/AB6AXuAakgqdo3xGyEb_gQdoOeHJEBW2d0GIY35V0eMiKIcybGogNYfthHnBSfCAO_vfuauKbcSuKeXI8OgII8RnH4z9X5KBqjcYOIMf-svswpLrk5HI4n4guqpVYfonm85qLfAhglsa_vNTCh3KJgXuRRr7oqKhCc6FeL70o5ECU5d_x9jp_OQ30AWn7M1PP6gY-o7a86FmpQaphJ0uEvrq274veIa0X5l0bPFmVezOkL3vEHuPg0QeuopSZmXPBBeuWDdPKh0jj0K_eQLU"
                            alt="Ana"
                            className="w-full h-full object-cover"
                        />
                    </div>
                </div>
            </div>

            {/* Staff Booking Links */}
            <div className="mx-6 mt-5 space-y-2">
                <p className="text-[10px] tracking-[0.15em] text-aesthetic-muted uppercase font-display italic font-medium mb-2">Links de Reservas del Equipo</p>
                {staff.map(member => {
                    const slug = member.slug || member.name.toLowerCase().replace(/\s+/g, '-');
                    const baseDomain = domain && domain.includes('.') ? domain : `${domain}.nailflow.app`;
                    const url = `${baseDomain}/book/${slug}`;
                    const isCopied = copiedSlug === member.id;
                    return (
                        <div key={member.id} className="bg-white rounded-2xl p-3.5 shadow-sm flex items-center gap-3 border border-aesthetic-accent/30">
                            <div className="size-9 rounded-full flex items-center justify-center text-xs font-display italic bg-aesthetic-soft-pink text-aesthetic-taupe border border-aesthetic-accent overflow-hidden flex-shrink-0">
                                {member.photo_url ? (
                                    <img src={member.photo_url} alt={member.name} className="w-full h-full object-cover" />
                                ) : member.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-xs font-medium text-aesthetic-taupe font-display truncate">{member.name}</p>
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

            {/* Income card */}
            <div className="mx-6 mt-6 p-8 bg-white/60 backdrop-blur-sm rounded-[2.5rem] border border-aesthetic-accent shadow-minimal flex flex-col items-center text-center">
                <p className="text-[10px] tracking-[0.3em] uppercase text-aesthetic-muted mb-4 font-display italic font-medium">Ingresos de hoy</p>
                <div className="flex flex-col items-center">
                    <p className="font-display text-5xl font-light italic tracking-tight text-aesthetic-taupe mb-2">${todayIncome.toLocaleString()}</p>
                    <span className="text-[10px] font-bold uppercase tracking-[0.2em] px-3 py-1 rounded-full bg-green-50 text-[#88C999] border border-green-100/50">
                        {completedAppointments.length} cita{completedAppointments.length !== 1 ? 's' : ''} completada{completedAppointments.length !== 1 ? 's' : ''}
                    </span>
                </div>
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
                        Completadas
                    </h2>
                    {completedAppointments.length > 0 && (
                        <span className="text-[11px] tracking-[0.12em] font-semibold uppercase text-[#88C999]">
                            {completedAppointments.length}
                        </span>
                    )}
                </div>

                {completedAppointments.length === 0 ? (
                    <div className="text-center py-8 bg-white/30 rounded-3xl border border-dashed border-aesthetic-accent">
                        <p className="text-aesthetic-muted/40 text-sm italic font-display">Sin citas completadas aún hoy</p>
                    </div>
                ) : (
                    <div className="space-y-3 stagger-children">
                        {completedAppointments.map(apt => {
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
            <button className="fixed bottom-32 right-6 size-14 bg-aesthetic-pink text-white rounded-full shadow-soft flex items-center justify-center transition-all active:scale-95 z-30">
                <span className="material-symbol text-3xl font-light">add</span>
            </button>

            {/* Appointment detail drawer */}
            {selectedApt && (
                <AppointmentDetail
                    apt={selectedApt}
                    service={getService(selectedApt.service_id)}
                    onClose={() => setSelectedApt(null)}
                    onComplete={() => handleComplete(selectedApt)}
                />
            )}
        </div>
    );
}
