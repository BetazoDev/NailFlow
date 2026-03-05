'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Appointment, Service } from '@/lib/types';

import { api } from '@/lib/api';
import { useTenant } from '@/lib/tenant-context';

const MONTH_NAMES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const DAY_SHORT = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa', 'Do'];

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
    const [completing, setCompleting] = useState<string | null>(null);
    const { tenantId } = useTenant();

    useEffect(() => {
        if (!tenantId) return;
        Promise.all([
            api.getAppointments(tenantId),
            api.getServices(tenantId),
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

    const dayEarnings = useMemo(() =>
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
            await api.completeAppointment(tenantId, apt.id, svc.estimated_price, apt.staff_id, apt.date);
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
                                    <div className={`bg-white rounded-[2rem] p-6 shadow-minimal border border-aesthetic-accent group-hover:border-aesthetic-pink/30 transition-all duration-500 ${isCompleted ? 'opacity-60 bg-aesthetic-cream/20' : ''}`}>
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
                                                    onClick={() => handleComplete(apt)}
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
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* FAB */}
            <button className="fixed bottom-10 right-8 size-16 rounded-full bg-aesthetic-taupe text-white shadow-soft flex items-center justify-center group active:scale-95 transition-all z-40">
                <span className="material-symbol text-3xl group-hover:rotate-90 transition-transform duration-500">add</span>
            </button>
        </div>
    );
}
