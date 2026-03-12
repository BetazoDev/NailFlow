'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Appointment, Service } from '@/lib/types';

import { api } from '@/lib/api';
import { useTenant } from '@/lib/tenant-context';

const MONTH_NAMES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const DAY_SHORT = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa', 'Do'];

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
                        <div className="flex gap-3 overflow-x-auto pb-2">
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
            </div>
        </div>
    );
}

function addDays(date: Date, n: number) {
    const d = new Date(date);
    d.setDate(d.getDate() + n);
    return d;
}

function isSameDay(a: Date, b: Date) {
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export default function AgendaPage() {
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [services, setServices] = useState<Service[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [selectedApt, setSelectedApt] = useState<Appointment | null>(null);
    const [completing, setCompleting] = useState<string | null>(null);
    const { tenantId } = useTenant();

    useEffect(() => {
        if (!tenantId) return;
        Promise.all([
            api.getAppointments(),
            api.getServices(),
        ]).then(([apts, svcs]) => {
            setAppointments(apts);
            setServices(svcs);
        }).finally(() => setLoading(false));
    }, [tenantId]);

    const getService = useCallback((id: string) => services.find(s => s.id === id), [services]);

    // Build a 7-day strip centered on today
    const today = new Date();
    const weekDays = Array.from({ length: 9 }, (_, i) => addDays(today, i - 4));

    // Filter appointments for the selected day
    const dayAppointments = appointments
        .filter(apt => {
            const d = new Date(apt.datetime_start);
            return isSameDay(d, selectedDate) && apt.status !== 'cancelled';
        })
        .sort((a, b) => new Date(a.datetime_start).getTime() - new Date(b.datetime_start).getTime());

    // dayEarnings is calculated but used only if rendered later
    const _dayEarnings = useMemo(() =>
        dayAppointments
            .filter(a => a.status === 'completed')
            .reduce((sum, a) => sum + (getService(a.service_id)?.estimated_price || 0), 0),
        [dayAppointments, getService]
    );

    const handleComplete = async (apt: Appointment) => {
        const svc = getService(apt.service_id);
        if (!svc || !tenantId) return;
        setCompleting(apt.id);
        try {
            await api.completeAppointment(apt.id);
            setAppointments(prev => prev.map(a => a.id === apt.id ? { ...a, status: 'completed' as const } : a));
        } catch (e) {
            console.error('Error completing appointment:', e);
        } finally {
            setCompleting(null);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center p-20">
                <div className="size-10 border-2 border-aesthetic-accent border-t-aesthetic-pink rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div className="relative min-h-full pb-32">
            {/* Header */}
            <div className="px-6 pt-12 pb-4">
                <div className="flex items-center justify-between mb-4">
                    <p className="text-[10px] tracking-[0.3em] text-aesthetic-muted uppercase font-display italic font-medium">Cronograma</p>
                    <button className="size-10 rounded-full bg-white/50 border border-aesthetic-accent flex items-center justify-center hover:bg-black/5 transition-colors">
                        <span className="material-symbol text-aesthetic-muted font-light">calendar_month</span>
                    </button>
                </div>
                <h1 className="font-display text-4xl font-medium tracking-tight text-aesthetic-taupe italic">
                    {MONTH_NAMES[selectedDate.getMonth()]} {selectedDate.getFullYear()}
                </h1>
            </div>

            {/* Week strip */}
            <div className="px-4 mt-8 flex gap-3 overflow-x-auto pb-6 scrollbar-hide">
                {weekDays.map((day, idx) => {
                    const isSelected = isSameDay(day, selectedDate);
                    const isToday = isSameDay(day, today);
                    const dayOfWeek = (day.getDay() + 6) % 7; // Monday=0
                    const hasAppointments = appointments.some(a => isSameDay(new Date(a.datetime_start), day) && a.status !== 'cancelled');

                    return (
                        <button
                            key={idx}
                            onClick={() => setSelectedDate(day)}
                            className={`flex-shrink-0 flex flex-col items-center gap-1.5 px-5 py-6 rounded-[2.5rem] transition-all duration-500 border relative ${isSelected
                                ? 'bg-aesthetic-taupe text-white border-aesthetic-taupe shadow-minimal scale-105 z-10'
                                : 'bg-white border-aesthetic-accent text-aesthetic-muted hover:border-aesthetic-pink/30'
                                }`}
                        >
                            <span className={`text-[9px] tracking-[0.2em] uppercase font-bold ${isSelected ? 'text-white/60' : 'text-aesthetic-muted/40'}`}>
                                {DAY_SHORT[dayOfWeek]}
                            </span>
                            <span className={`text-2xl font-display italic leading-none ${isToday && !isSelected ? 'text-aesthetic-pink' : ''}`}>
                                {day.getDate()}
                            </span>
                            {hasAppointments && (
                                <span className={`size-1 rounded-full absolute bottom-4 ${isSelected ? 'bg-white' : 'bg-aesthetic-pink'}`} />
                            )}
                        </button>
                    );
                })}
            </div>

            {/* Daily appointments */}
            <div className="px-6 mt-8 space-y-10">
                <div className="flex items-center justify-between">
                    <div className="space-y-1">
                        <h2 className="text-[10px] tracking-[0.3em] text-aesthetic-muted uppercase font-display italic font-medium">
                            Disponibilidad
                        </h2>
                        <p className="font-display text-xl italic text-aesthetic-taupe">
                            {dayAppointments.length === 0 ? 'Día libre' : `${dayAppointments.length} turnos programados`}
                        </p>
                    </div>
                    <button className="text-[10px] tracking-[0.2em] font-bold uppercase text-aesthetic-pink border-b border-aesthetic-pink/30 pb-1"> Ver Día Completo </button>
                </div>

                {dayAppointments.length === 0 ? (
                    <div className="bg-white/40 backdrop-blur-sm rounded-[3rem] border border-dashed border-aesthetic-accent py-20 text-center shadow-minimal">
                        <span className="material-symbol text-aesthetic-muted/20 text-5xl mb-4 font-light italic">spa</span>
                        <p className="font-display text-2xl italic text-aesthetic-muted opacity-40">No hay citas para este día</p>
                        <button onClick={() => setSelectedDate(today)} className="mt-6 text-[10px] tracking-[0.2em] font-bold uppercase text-aesthetic-taupe hover:text-aesthetic-pink transition-colors">Volver a hoy</button>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {dayAppointments.map((apt) => {
                            const svc = getService(apt.service_id);
                            const startDate = new Date(apt.datetime_start);
                            const timeStr = startDate.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false });
                            const isCompleted = apt.status === 'completed';
                            const isCompletable = apt.status === 'confirmed';

                            return (
                                <div key={apt.id} className="group relative pl-20">
                                    {/* Timeline connector */}
                                    <div className="absolute left-10 top-0 bottom-0 w-px bg-aesthetic-accent/30" />
                                    <div className={`absolute left-[37px] top-8 size-2 rounded-full border-2 z-10 ${isCompleted ? 'border-[#88C999] bg-[#88C999]' : 'border-aesthetic-pink bg-white'}`} />

                                    {/* Time Label */}
                                    <div className="absolute left-0 top-6 w-14 text-right">
                                        <p className="font-display text-xl italic text-aesthetic-taupe leading-none">{timeStr}</p>
                                        <p className="text-[9px] text-aesthetic-muted font-bold tracking-widest mt-1 opacity-50 uppercase">{svc?.duration_minutes || 60} min</p>
                                    </div>

                                    {/* Card */}
                                    <button
                                        onClick={() => setSelectedApt(apt)}
                                        className={`w-full text-left bg-white rounded-[2rem] p-6 shadow-minimal border border-aesthetic-accent group-hover:border-aesthetic-pink/30 transition-all duration-500 ${isCompleted ? 'opacity-60 bg-aesthetic-cream/20' : ''}`}
                                    >
                                        <div className="flex items-center justify-between gap-4">
                                            <div className="flex-1 min-w-0">
                                                <h4 className="font-display text-2xl italic text-aesthetic-taupe truncate mb-1">{apt.client_name}</h4>
                                                <div className="flex items-center gap-2">
                                                    <span className="material-symbol text-xs text-aesthetic-pink">content_cut</span>
                                                    <p className="text-xs text-aesthetic-muted font-display italic leading-none">{svc?.name || 'Servicio de Belleza'}</p>
                                                </div>
                                            </div>
                                            {apt.status === 'pending_payment' && (
                                                <span className="size-3 rounded-full bg-aesthetic-pink animate-pulse" title="Pendiente de pago" />
                                            )}
                                        </div>

                                        {/* Completion button */}
                                        <div className="mt-4 pt-4 border-t border-aesthetic-accent/20 flex items-center justify-between">
                                            {isCompleted ? (
                                                <div className="flex items-center gap-2 text-[#88C999]">
                                                    <span className="material-symbol text-lg">check_circle</span>
                                                    <span className="text-[10px] tracking-[0.2em] uppercase font-bold">Completada</span>
                                                    <span className="ml-2 text-xs font-display italic opacity-70">${svc?.estimated_price || 0}</span>
                                                </div>
                                            ) : isCompletable ? (
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); handleComplete(apt); }}
                                                    disabled={completing === apt.id}
                                                    className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#88C999]/10 text-[#5a9a6a] hover:bg-[#88C999]/20 transition-all active:scale-95 disabled:opacity-50"
                                                >
                                                    {completing === apt.id ? (
                                                        <div className="size-4 border-2 border-[#88C999]/30 border-t-[#88C999] rounded-full animate-spin" />
                                                    ) : (
                                                        <span className="material-symbol text-lg">task_alt</span>
                                                    )}
                                                    <span className="text-[10px] tracking-[0.2em] uppercase font-bold">Completar Cita</span>
                                                </button>
                                            ) : (
                                                <span className="text-[10px] tracking-[0.2em] uppercase font-bold text-aesthetic-muted/40">
                                                    {apt.status === 'pending_payment' ? 'Pendiente de pago' : apt.status}
                                                </span>
                                            )}
                                            <span className="text-sm font-semibold text-aesthetic-taupe">${svc?.estimated_price || 0}</span>
                                        </div>
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Appointment detail drawer */}
            {selectedApt && (
                <AppointmentDetail
                    apt={selectedApt}
                    service={getService(selectedApt.service_id)}
                    onClose={() => setSelectedApt(null)}
                    onComplete={() => handleComplete(selectedApt)}
                />
            )}

            {/* FAB */}
            <button className="fixed bottom-10 right-8 size-16 rounded-full bg-aesthetic-taupe text-white shadow-soft flex items-center justify-center group active:scale-95 transition-all z-40">
                <span className="material-symbol text-3xl group-hover:rotate-90 transition-transform duration-500">add</span>
            </button>
        </div>
    );
}
