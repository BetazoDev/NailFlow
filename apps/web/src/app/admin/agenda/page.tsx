'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { useSession } from '@/lib/session-context';
import { formatMoney, formatTime } from '@/lib/format';
import { MONTH_NAMES, STATUS_PRESENTATION, WEEKDAYS } from '@/lib/constants';
import {
    addDays,
    appointmentsOn,
    isSameDay,
    layOutWeek,
    startOfDay,
    visibleHourRange,
    weekDays,
} from '@/lib/schedule';
import AppointmentDrawer from '@/components/admin/AppointmentDrawer';
import type { Appointment, Service, Staff } from '@/lib/types';

type ViewMode = 'day' | 'week';

const HOUR_HEIGHT = 72;

export default function AgendaPage() {
    const { tenant } = useSession();

    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [services, setServices] = useState<Service[]>([]);
    const [staff, setStaff] = useState<Staff[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [view, setView] = useState<ViewMode>('day');
    const [selected, setSelected] = useState(() => startOfDay(new Date()));
    const [openAppointment, setOpenAppointment] = useState<Appointment | null>(null);

    const today = useMemo(() => startOfDay(new Date()), []);
    const salonName = tenant?.name ?? 'NailFlow';
    const currency = tenant?.settings?.currency;

    useEffect(() => {
        if (!tenant) return;
        let cancelled = false;

        Promise.all([
            api.getAppointments(),
            api.getServices({ includeInactive: true }),
            api.getStaff(),
        ])
            .then(([nextAppointments, nextServices, nextStaff]) => {
                if (cancelled) return;
                setAppointments(nextAppointments);
                setServices(nextServices);
                setStaff(nextStaff);
            })
            .catch(() => {
                if (!cancelled) setError('No pudimos cargar tu agenda. Recarga la página.');
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, [tenant]);

    const changeStatus = useCallback(
        async (appointment: Appointment, status: Appointment['status']) => {
            try {
                await api.setAppointmentStatus(appointment.id, status);
                setAppointments(current =>
                    current.map(item => (item.id === appointment.id ? { ...item, status } : item))
                );
                setOpenAppointment(null);
            } catch {
                setError('No pudimos actualizar la cita. Intenta de nuevo.');
            }
        },
        []
    );

    const week = useMemo(() => weekDays(selected), [selected]);
    const dayAppointments = useMemo(
        () => appointmentsOn(appointments, selected),
        [appointments, selected]
    );
    const placed = useMemo(() => layOutWeek(appointments, week), [appointments, week]);

    const step = view === 'day' ? 1 : 7;
    const periodLabel =
        view === 'day'
            ? `${selected.getDate()} de ${MONTH_NAMES[selected.getMonth()]} ${selected.getFullYear()}`
            : `${MONTH_NAMES[week[0].getMonth()]} ${week[0].getFullYear()}`;

    if (loading) {
        return (
            <div className="space-y-4 p-2" aria-busy="true" aria-label="Cargando agenda">
                <div className="skeleton h-10 w-64" />
                {Array.from({ length: 4 }, (_, index) => (
                    <div key={index} className="skeleton h-24 w-full" />
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

            <header className="mb-8 flex flex-wrap items-end justify-between gap-5">
                <div>
                    <p className="t-label mb-2">Cronograma</p>
                    <h1 className="t-display capitalize">{periodLabel}</h1>
                </div>

                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1 rounded-full border border-line p-1">
                        {(['day', 'week'] as ViewMode[]).map(mode => (
                            <button
                                key={mode}
                                onClick={() => setView(mode)}
                                aria-pressed={view === mode}
                                className={`rounded-full px-4 py-1.5 text-xs font-semibold transition-colors ${
                                    view === mode
                                        ? 'bg-text-strong text-white'
                                        : 'text-text-muted hover:text-text-strong'
                                }`}
                            >
                                {mode === 'day' ? 'Día' : 'Semana'}
                            </button>
                        ))}
                    </div>

                    <div className="flex items-center gap-1">
                        <button
                            onClick={() => setSelected(addDays(selected, -step))}
                            aria-label={view === 'day' ? 'Día anterior' : 'Semana anterior'}
                            className="grid size-9 place-items-center rounded-full border border-line text-text-muted transition-colors hover:text-text-strong"
                        >
                            <span className="material-symbol text-lg" aria-hidden="true">chevron_left</span>
                        </button>
                        <button
                            onClick={() => setSelected(today)}
                            className="rounded-full border border-line px-4 py-2 text-xs font-semibold text-text-strong transition-colors hover:bg-surface-sunken"
                        >
                            Hoy
                        </button>
                        <button
                            onClick={() => setSelected(addDays(selected, step))}
                            aria-label={view === 'day' ? 'Día siguiente' : 'Semana siguiente'}
                            className="grid size-9 place-items-center rounded-full border border-line text-text-muted transition-colors hover:text-text-strong"
                        >
                            <span className="material-symbol text-lg" aria-hidden="true">chevron_right</span>
                        </button>
                    </div>
                </div>
            </header>

            {view === 'day' ? (
                <DayView
                    day={selected}
                    today={today}
                    appointments={dayAppointments}
                    services={services}
                    staff={staff}
                    currency={currency}
                    onPickDay={setSelected}
                    onOpen={setOpenAppointment}
                />
            ) : (
                <WeekView
                    week={week}
                    today={today}
                    placed={placed}
                    onOpen={setOpenAppointment}
                    onPickDay={day => {
                        setSelected(day);
                        setView('day');
                    }}
                />
            )}

            {openAppointment && (
                <AppointmentDrawer
                    appointment={openAppointment}
                    services={services}
                    staff={staff}
                    salonName={salonName}
                    currency={currency}
                    onClose={() => setOpenAppointment(null)}
                    onStatusChange={changeStatus}
                />
            )}
        </div>
    );
}

/* ── Day ─────────────────────────────────────────────────────────────────── */

function DayView({
    day,
    today,
    appointments,
    services,
    staff,
    currency,
    onPickDay,
    onOpen,
}: {
    day: Date;
    today: Date;
    appointments: Appointment[];
    services: Service[];
    staff: Staff[];
    currency?: string;
    onPickDay: (day: Date) => void;
    onOpen: (appointment: Appointment) => void;
}) {
    // A week strip for quick jumps, centred on the day being viewed.
    const strip = weekDays(day);

    return (
        <div className="space-y-8">
            <div className="grid grid-cols-7 gap-2">
                {strip.map((stripDay, index) => {
                    const active = isSameDay(stripDay, day);
                    const isToday = isSameDay(stripDay, today);

                    return (
                        <button
                            key={stripDay.toISOString()}
                            onClick={() => onPickDay(stripDay)}
                            aria-pressed={active}
                            className={`flex flex-col items-center gap-1 rounded-2xl border py-3 transition-colors ${
                                active
                                    ? 'border-transparent bg-text-strong text-white'
                                    : 'border-line text-text-muted hover:border-brand-soft'
                            }`}
                        >
                            <span className="text-[11px] font-bold uppercase tracking-widest opacity-70">
                                {WEEKDAYS[index].short}
                            </span>
                            <span className={`t-figure text-lg font-semibold ${active ? '' : 'text-text-strong'}`}>
                                {stripDay.getDate()}
                            </span>
                            {isToday && !active && <span className="size-1 rounded-full bg-brand" />}
                        </button>
                    );
                })}
            </div>

            {appointments.length === 0 ? (
                <div className="blank-slate">
                    <span className="material-symbol text-3xl opacity-40" aria-hidden="true">event_available</span>
                    <p className="t-body">No hay citas este día.</p>
                    <p className="t-meta">Comparte tu link de reservas para llenar la agenda.</p>
                </div>
            ) : (
                <ol className="space-y-3">
                    {appointments.map(appointment => {
                        const service = services.find(item => item.id === appointment.service_id);
                        const member = staff.find(item => item.id === appointment.staff_id);
                        const presentation = STATUS_PRESENTATION[appointment.status];
                        const start = new Date(appointment.datetime_start);
                        const end = new Date(appointment.datetime_end);
                        const minutes = Math.max(0, Math.round((end.getTime() - start.getTime()) / 60000));

                        return (
                            <li key={appointment.id}>
                                <button
                                    onClick={() => onOpen(appointment)}
                                    className="sheet sheet-interactive flex w-full items-center gap-5 p-5 text-left"
                                >
                                    <div className="w-16 shrink-0 text-center">
                                        <p className="t-figure text-lg font-semibold text-text-strong">
                                            {formatTime(appointment.datetime_start)}
                                        </p>
                                        <p className="t-meta t-figure">{minutes} min</p>
                                    </div>

                                    <span className="h-12 w-px shrink-0 bg-line" aria-hidden="true" />

                                    <div className="min-w-0 flex-1">
                                        <p className="t-body truncate font-semibold text-text-strong">
                                            {appointment.client_name}
                                        </p>
                                        <p className="t-meta truncate">
                                            {appointment.service_name ?? service?.name ?? 'Servicio'}
                                            {member && ` · ${member.name}`}
                                        </p>
                                    </div>

                                    <div className="flex shrink-0 flex-col items-end gap-2">
                                        <span className="status-pill" data-status={presentation.token}>
                                            {presentation.label}
                                        </span>
                                        {appointment.price != null && (
                                            <span className="t-meta t-figure">
                                                {formatMoney(appointment.price, currency)}
                                            </span>
                                        )}
                                    </div>
                                </button>
                            </li>
                        );
                    })}
                </ol>
            )}
        </div>
    );
}

/* ── Week ────────────────────────────────────────────────────────────────── */

function WeekView({
    week,
    today,
    placed,
    onOpen,
    onPickDay,
}: {
    week: Date[];
    today: Date;
    placed: ReturnType<typeof layOutWeek>;
    onOpen: (appointment: Appointment) => void;
    onPickDay: (day: Date) => void;
}) {
    const { from, to } = visibleHourRange(placed);
    const hours = Array.from({ length: to - from }, (_, index) => from + index);

    return (
        <div className="sheet overflow-hidden">
            <div className="grid grid-cols-[56px_repeat(7,1fr)] border-b border-line">
                <div />
                {week.map((day, index) => {
                    const isToday = isSameDay(day, today);
                    return (
                        <button
                            key={day.toISOString()}
                            onClick={() => onPickDay(day)}
                            className={`flex flex-col items-center gap-0.5 border-l border-line py-3 transition-colors hover:bg-surface-sunken ${
                                isToday ? 'bg-brand-tint' : ''
                            }`}
                        >
                            <span className="text-[11px] font-bold uppercase tracking-widest text-text-muted">
                                {WEEKDAYS[index].short}
                            </span>
                            <span
                                className={`t-figure text-base font-semibold ${
                                    isToday ? 'text-brand' : 'text-text-strong'
                                }`}
                            >
                                {day.getDate()}
                            </span>
                        </button>
                    );
                })}
            </div>

            <div className="relative max-h-[620px] overflow-y-auto custom-scrollbar">
                <div className="relative grid grid-cols-[56px_repeat(7,1fr)]">
                    <div>
                        {hours.map(hour => (
                            <div
                                key={hour}
                                style={{ height: HOUR_HEIGHT }}
                                className="relative border-t border-line"
                            >
                                <span className="t-figure absolute -top-2 right-2 text-[11px] text-text-muted">
                                    {String(hour).padStart(2, '0')}:00
                                </span>
                            </div>
                        ))}
                    </div>

                    {week.map(day => (
                        <div key={day.toISOString()} className="relative border-l border-line">
                            {hours.map(hour => (
                                <div key={hour} style={{ height: HOUR_HEIGHT }} className="border-t border-line" />
                            ))}
                        </div>
                    ))}

                    {/* One absolutely-positioned layer per appointment, offset past
                        the time gutter so it lines up with its own day column. */}
                    <div className="pointer-events-none absolute inset-0 left-[56px] grid grid-cols-7">
                        {placed.map(item => {
                            const top = ((item.startMinutes - from * 60) / 60) * HOUR_HEIGHT;
                            const height = Math.max(28, (item.durationMinutes / 60) * HOUR_HEIGHT);
                            const laneWidth = 100 / item.lanes;
                            const completed = item.appointment.status === 'completed';

                            return (
                                <button
                                    key={item.appointment.id}
                                    onClick={() => onOpen(item.appointment)}
                                    className="pointer-events-auto absolute p-[3px] text-left"
                                    style={{
                                        top,
                                        height,
                                        left: `calc(${item.dayIndex} * (100% / 7) + ${item.lane * laneWidth}% / 7)`,
                                        width: `calc((100% / 7) * ${laneWidth / 100})`,
                                    }}
                                >
                                    <div
                                        className={`flex h-full flex-col overflow-hidden rounded-xl border px-2 py-1.5 transition-colors ${
                                            completed
                                                ? 'border-success/30 bg-success/10'
                                                : 'border-line bg-surface-raised hover:border-brand'
                                        }`}
                                    >
                                        <span className="truncate text-[11px] font-semibold leading-tight text-text-strong">
                                            {item.appointment.client_name}
                                        </span>
                                        {height > 44 && (
                                            <span className="t-figure truncate text-[10px] leading-tight text-text-muted">
                                                {formatTime(item.appointment.datetime_start)}
                                            </span>
                                        )}
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>

            {placed.length === 0 && (
                <p className="t-meta border-t border-line py-10 text-center">
                    No hay citas esta semana.
                </p>
            )}
        </div>
    );
}
