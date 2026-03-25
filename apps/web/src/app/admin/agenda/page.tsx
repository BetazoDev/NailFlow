'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import { useTenant } from '@/lib/tenant-context';
import Lightbox from '@/components/ui/Lightbox';
import type { Appointment, Service, Staff } from '@/lib/types';

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
    staff?: Staff;
    salonName: string;
    onClose: () => void;
    onComplete: (apt: Appointment) => Promise<void>;
}

function AppointmentDetail({ apt, service, staff, salonName, onClose, onComplete }: AppointmentDetailProps) {
    const [completing, setCompleting] = useState(false);
    const [lbIndex, setLbIndex] = useState<number | null>(null);

    const s = STATUS_LABELS[apt.status] || STATUS_LABELS.pending_payment;
    const startDate = new Date(apt.datetime_start);
    const dateStr = startDate.toLocaleDateString('es-MX', { day: 'numeric', month: 'long' });
    const timeStr = startDate.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false });
    const total = service?.estimated_price || 0;
    const advance = service ? Math.round(service.estimated_price * 0.4) : 0;
    const balance = total - advance;
    const isPast = new Date() >= new Date(apt.datetime_start);

    const waMessage = `¡Hola ${apt.client_name} bella! ✨ Te recordamos tu turno en ${salonName} este ${dateStr} a las ${timeStr} hs. ¡Nos encantaría dejar tus uñas increíbles! 💅✨ ¿Nos confirmas que vienes? 😊`;

    return (
        <div className="fixed inset-0 z-50 flex justify-end animate-fade-in" onClick={onClose}>
            <div className="absolute inset-0 bg-charcoal/30 backdrop-blur-sm" />
            <div className="relative w-full max-w-md bg-cream h-full shadow-2xl animate-slide-in-right flex flex-col" onClick={e => e.stopPropagation()}>
                {/* Scrollable Content */}
                <div className="flex-1 overflow-y-auto pb-8">
                    {/* Top bar */}
                    <div className="flex items-center justify-between px-6 pt-6 pb-4">
                        <button onClick={onClose} className="text-aesthetic-muted hover:text-aesthetic-taupe transition-colors">
                            <span className="material-symbol font-light">arrow_back</span>
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
                                <p className="text-[9px] tracking-[0.2em] text-aesthetic-muted/60 uppercase font-bold mb-1">Especialista</p>
                                <p className="font-display text-lg italic text-aesthetic-taupe leading-tight">{staff?.name || 'Por asignar'}</p>
                            </div>
                            <div>
                                <p className="text-[9px] tracking-[0.2em] text-aesthetic-muted/60 uppercase font-bold mb-1">Estado</p>
                                <p className="font-display text-lg italic text-aesthetic-taupe leading-tight capitalize">{s.label.toLowerCase()}</p>
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
                        <div className="mx-6 mb-4">
                            <p className="text-[10px] tracking-[0.15em] text-nf-gray uppercase mb-3">Información de Pago</p>
                            <div className="space-y-2">
                                <div className="flex justify-between text-sm">
                                    <span className="text-nf-gray">Total</span>
                                    <span className="font-medium text-charcoal">${total}</span>
                                </div>
                                <div className="border-t border-cream-dark pt-2 flex justify-between">
                                    <span className="font-semibold text-charcoal">Pendiente</span>
                                    <span className="font-serif font-bold text-xl text-charcoal">${balance}</span>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Sticky Action Footer */}
                <div className="px-6 pt-4 pb-12 bg-cream border-t border-aesthetic-accent/20 space-y-3">
                    <a
                        href={`https://wa.me/${apt.client_phone.replace(/\D/g, '')}?text=${encodeURIComponent(waMessage)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full py-4 rounded-full font-display italic text-lg tracking-wide border border-aesthetic-pink/20 bg-aesthetic-soft-pink text-aesthetic-taupe flex items-center justify-center gap-3 transition-all duration-300 hover:shadow-minimal active:scale-[0.98]"
                    >
                        <span className="material-symbol text-xl text-[#25D366]">chat</span>
                        WhatsApp
                    </a>
                    {apt.status !== 'completed' && apt.status !== 'cancelled' && (
                        <div className="w-full relative">
                            <button
                                onClick={async () => {
                                    setCompleting(true);
                                    await onComplete(apt);
                                    setCompleting(false);
                                }}
                                disabled={completing || !isPast}
                                className={`w-full py-4 rounded-full font-display italic text-lg tracking-wide flex items-center justify-center gap-3 transition-all duration-300 shadow-lg ${!isPast ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-aesthetic-taupe text-white hover:bg-black active:scale-[0.98]'}`}
                            >
                                {completing ? (
                                    <div className="size-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                                ) : (
                                    <>
                                        <span className={`material-symbol text-xl ${isPast ? 'text-[#88C999]' : 'text-gray-300'}`}>check_circle</span>
                                        {isPast ? 'Completar Cita' : 'Cita Futura'}
                                    </>
                                )}
                            </button>
                            {!isPast && (
                                <p className="text-center text-[9px] uppercase tracking-widest text-aesthetic-muted/40 mt-2 font-bold animate-fade-in">Se habilitará al pasar el horario</p>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

function WeeklyView({ baseDate, appointments, services, onSelectDate, onSelectApt }: { baseDate: Date, appointments: Appointment[], services: Service[], onSelectDate: (d: Date) => void, onSelectApt: (a: Appointment) => void }) {
    const today = new Date();
    
    // Find Monday of the week containing baseDate
    const startOfWeek = new Date(baseDate);
    const day = baseDate.getDay();
    const diff = (day === 0 ? -6 : 1 - day);
    startOfWeek.setDate(baseDate.getDate() + diff);
    startOfWeek.setHours(0, 0, 0, 0);

    const weekDays = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(startOfWeek);
        d.setDate(startOfWeek.getDate() + i);
        return d;
    });

    const hours = Array.from({ length: 14 }, (_, i) => i + 8); // 8am to 9pm

    return (
        <div className="mt-6 bg-white/40 backdrop-blur-sm rounded-[2.5rem] border border-aesthetic-accent overflow-hidden animate-fade-in-up">
            <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-aesthetic-accent/20 bg-white/60">
                <div className="h-12" />
                {weekDays.map((day, i) => (
                    <div key={i} className={`h-12 flex flex-col items-center justify-center border-l border-aesthetic-accent/10 ${isSameDay(day, today) ? 'bg-aesthetic-soft-pink/30' : ''}`}>
                        <span className="text-[8px] uppercase font-bold text-aesthetic-muted/40 tracking-widest">{DAY_SHORT[i]}</span>
                        <span className={`text-sm font-display italic ${isSameDay(day, today) ? 'text-aesthetic-pink font-bold' : 'text-aesthetic-taupe'}`}>{day.getDate()}</span>
                    </div>
                ))}
            </div>

            <div className="relative h-[600px] overflow-y-auto custom-scrollbar">
                <div className="grid grid-cols-[60px_repeat(7,1fr)] min-h-full">
                    {/* Time rows */}
                    {hours.map(hour => (
                        <div key={hour} className="contents">
                            <div className="h-16 flex items-center justify-center border-t border-aesthetic-accent/10">
                                <span className="text-[10px] text-aesthetic-muted/60 font-medium">{hour}:00</span>
                            </div>
                            {weekDays.map((_, i) => (
                                <div key={`${hour}-${i}`} className="h-16 border-t border-l border-aesthetic-accent/10" />
                            ))}
                        </div>
                    ))}

                    {/* Appointments Overlay */}
                    <div className="absolute top-0 left-[60px] right-0 bottom-0 pointer-events-none">
                        {appointments.filter(a => a.status !== 'cancelled').map(apt => {
                            const start = new Date(apt.datetime_start);
                            const dayIndex = (start.getDay() + 6) % 7;
                            const hourIndex = start.getHours() - 8;
                            const minuteOffset = (start.getMinutes() / 60) * 64; // 64px per hour
                            
                            if (hourIndex < 0 || hourIndex >= 14) return null;
                            const top = (hourIndex * 64) + minuteOffset;
                            const left = (dayIndex / 7) * 100;
                            const width = (1 / 7) * 100;

                            const svc = services.find(s => s.id === apt.service_id);
                            const duration = svc?.duration_minutes || 60;
                            const height = (duration / 60) * 64;

                            return (
                                <div
                                    key={apt.id}
                                    onClick={() => {
                                        onSelectDate(start);
                                        onSelectApt(apt);
                                    }}
                                    className="absolute p-0.5 pointer-events-auto cursor-pointer group"
                                    style={{
                                        top: `${top}px`,
                                        left: `${left}%`,
                                        width: `${width}%`,
                                        height: `${height}px`,
                                    }}
                                >
                                    <div 
                                        className={`w-full h-full rounded-lg border flex flex-col p-1.5 transition-all overflow-hidden ${
                                            apt.status === 'completed' 
                                            ? 'bg-green-50 border-green-100 text-green-700 opacity-60' 
                                            : 'bg-white border-aesthetic-accent shadow-sm group-hover:border-aesthetic-pink group-hover:shadow-minimal'
                                        }`}
                                    >
                                        <p className="text-[8px] font-bold truncate uppercase tracking-tighter leading-none mb-1 text-aesthetic-taupe">{apt.client_name}</p>
                                        <p className="text-[7px] italic truncate text-aesthetic-muted leading-none">{svc?.name || 'Cita'}</p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
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
    const [staffList, setStaffList] = useState<Staff[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [selectedApt, setSelectedApt] = useState<Appointment | null>(null);
    const [completing, setCompleting] = useState<string | null>(null);
    const [viewMode, setViewMode] = useState<'daily' | 'weekly'>('daily');
    const { tenantId } = useTenant();
    const [salonName, setSalonName] = useState('NailFlow');

    useEffect(() => {
        if (!tenantId) return;
        Promise.all([
            api.getAppointments(),
            api.getServices(),
            api.getStaff(),
            api.getTenantById(tenantId)
        ]).then(([apts, svcs, sl, tenant]) => {
            setAppointments(apts);
            setServices(svcs);
            setStaffList(sl);
            if (tenant && tenant.name) setSalonName(tenant.name);
        }).finally(() => setLoading(false));
    }, [tenantId]);

    const getService = useCallback((id: string) => services.find(s => s.id === id), [services]);

    const today = new Date();

    const dayAppointments = appointments
        .filter(apt => {
            const d = new Date(apt.datetime_start);
            return isSameDay(d, selectedDate) && apt.status !== 'cancelled';
        })
        .sort((a, b) => new Date(a.datetime_start).getTime() - new Date(b.datetime_start).getTime());

    const handleComplete = async (apt: Appointment) => {
        if (!tenantId) return;
        setCompleting(apt.id);
        try {
            await api.completeAppointment(apt.id);
            setAppointments(prev => prev.map(a => a.id === apt.id ? { ...a, status: 'completed' as const } : a));
            if (selectedApt?.id === apt.id) {
                setSelectedApt({ ...selectedApt, status: 'completed' });
            }
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
                    <div className="flex items-center gap-1 bg-white/50 p-1 rounded-full border border-aesthetic-accent">
                        <button 
                            onClick={() => setViewMode('daily')}
                            className={`px-4 py-1.5 rounded-full text-[9px] font-bold uppercase tracking-wider transition-all ${viewMode === 'daily' ? 'bg-aesthetic-taupe text-white shadow-sm' : 'text-aesthetic-muted hover:text-aesthetic-taupe'}`}
                        >
                            Día
                        </button>
                        <button 
                            onClick={() => setViewMode('weekly')}
                            className={`px-4 py-1.5 rounded-full text-[9px] font-bold uppercase tracking-wider transition-all ${viewMode === 'weekly' ? 'bg-aesthetic-taupe text-white shadow-sm' : 'text-aesthetic-muted hover:text-aesthetic-taupe'}`}
                        >
                            7 Días
                        </button>
                    </div>
                </div>
                
                <div className="flex items-center justify-between gap-4">
                    <h1 className="font-display text-4xl font-medium tracking-tight text-aesthetic-taupe italic flex-1 truncate">
                        {MONTH_NAMES[selectedDate.getMonth()]} {selectedDate.getFullYear()}
                    </h1>
                    <div className="flex items-center gap-1 bg-white/50 p-1 rounded-full border border-aesthetic-accent mr-2">
                        <button 
                            onClick={() => setSelectedDate(addDays(selectedDate, viewMode === 'daily' ? -1 : -7))}
                            className="p-1.5 rounded-full hover:bg-aesthetic-accent text-aesthetic-taupe transition-colors"
                        >
                            <span className="material-symbol text-xl leading-none">chevron_left</span>
                        </button>
                        <button 
                            onClick={() => setSelectedDate(new Date())}
                            className="text-[10px] px-2 font-bold uppercase tracking-tight text-aesthetic-muted hover:text-aesthetic-pink transition-colors"
                        >
                            Hoy
                        </button>
                        <button 
                            onClick={() => setSelectedDate(addDays(selectedDate, viewMode === 'daily' ? 1 : 7))}
                            className="p-1.5 rounded-full hover:bg-aesthetic-accent text-aesthetic-taupe transition-colors"
                        >
                            <span className="material-symbol text-xl leading-none">chevron_right</span>
                        </button>
                    </div>
                </div>
            </div>

            {viewMode === 'daily' ? (
                <>
                    {/* Week strip */}
                    <div className="px-4 mt-8 flex gap-3 overflow-x-auto pb-6 scrollbar-hide">
                        {Array.from({ length: 9 }, (_, i) => addDays(selectedDate, i - 4)).map((day, idx) => {
                            const isSelected = isSameDay(day, selectedDate);
                            const isToday = isSameDay(day, today);
                            const dayOfWeek = (day.getDay() + 6) % 7;
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
                                    const isPast = new Date() >= startDate;

                                    return (
                                        <div key={apt.id} className="group relative pl-20" onClick={() => setSelectedApt(apt)}>
                                            <div className="absolute left-10 top-0 bottom-0 w-px bg-aesthetic-accent/30" />
                                            <div className={`absolute left-[37px] top-8 size-2 rounded-full border-2 z-10 ${isCompleted ? 'border-[#88C999] bg-[#88C999]' : 'border-aesthetic-pink bg-white'}`} />

                                            <div className="absolute left-0 top-6 w-14 text-right">
                                                <p className="font-display text-xl italic text-aesthetic-taupe leading-none">{timeStr}</p>
                                                <p className="text-[9px] text-aesthetic-muted font-bold tracking-widest mt-1 opacity-50 uppercase">{svc?.duration_minutes || 60} min</p>
                                            </div>

                                            <div
                                                className={`w-full text-left bg-white rounded-[2rem] p-6 shadow-minimal border border-aesthetic-accent group-hover:border-aesthetic-pink/30 cursor-pointer transition-all duration-500 ${isCompleted ? 'opacity-60 bg-aesthetic-cream/20' : ''}`}
                                            >
                                                <div className="flex items-center justify-between gap-4">
                                                    <div className="flex-1 min-w-0">
                                                        <h4 className="font-display text-2xl italic text-aesthetic-taupe truncate mb-1">{apt.client_name}</h4>
                                                        <div className="flex items-center gap-2">
                                                            <span className="material-symbol text-xs text-aesthetic-pink">content_cut</span>
                                                            <p className="text-xs text-aesthetic-muted font-display italic leading-none">{svc?.name || 'Servicio de Belleza'}</p>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="mt-4 pt-4 border-t border-aesthetic-accent/20 flex items-center justify-between">
                                                    {isCompleted ? (
                                                        <div className="flex items-center gap-2 text-[#88C999]">
                                                            <span className="material-symbol text-lg">check_circle</span>
                                                            <span className="text-[10px] tracking-[0.2em] uppercase font-bold">Completada</span>
                                                        </div>
                                                    ) : isCompletable ? (
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); if (isPast) handleComplete(apt); }}
                                                            disabled={completing === apt.id || !isPast}
                                                            className={`flex items-center gap-2 px-5 py-2.5 rounded-full transition-all active:scale-95 disabled:opacity-50 ${isPast ? 'bg-[#88C999]/10 text-[#5a9a6a] hover:bg-[#88C999]/20' : 'bg-gray-100 text-gray-400 cursor-not-allowed'}`}
                                                        >
                                                            {completing === apt.id ? (
                                                                <div className="size-4 border-2 border-[#88C999]/30 border-t-[#88C999] rounded-full animate-spin" />
                                                            ) : (
                                                                <span className={`material-symbol text-lg ${isPast ? '' : 'opacity-40'}`}>{isPast ? 'task_alt' : 'schedule'}</span>
                                                            )}
                                                            <span className="text-[10px] tracking-[0.2em] uppercase font-bold">{isPast ? 'Completar Cita' : 'Cita Futura'}</span>
                                                        </button>
                                                    ) : (
                                                        <span className="text-[10px] tracking-[0.2em] uppercase font-bold text-aesthetic-muted/40">
                                                            {apt.status === 'pending_payment' ? 'Pendiente' : 'Confirmada'}
                                                        </span>
                                                    )}
                                                    <span className="text-sm font-semibold text-aesthetic-taupe">${svc?.estimated_price || 0}</span>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </>
            ) : (
                <div className="px-6">
                    <WeeklyView 
                        baseDate={selectedDate}
                        appointments={appointments} 
                        services={services} 
                        onSelectDate={setSelectedDate} 
                        onSelectApt={setSelectedApt} 
                    />
                </div>
            )}

            {/* Appointment detail drawer */}
            {selectedApt && (
                <AppointmentDetail
                    apt={selectedApt}
                    service={services.find(s => s.id === selectedApt.service_id)}
                    staff={staffList.find(s => s.id === selectedApt.staff_id)}
                    salonName={salonName}
                    onClose={() => setSelectedApt(null)}
                    onComplete={handleComplete}
                />
            )}
        </div>
    );
}
