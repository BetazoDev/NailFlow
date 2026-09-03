'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { useSession } from '@/lib/session-context';
import { dayKeyInZone, formatMoney, formatTime, initials, todayKeyInZone } from '@/lib/format';
import { STATUS_PRESENTATION } from '@/lib/constants';
import AppointmentDrawer from '@/components/admin/AppointmentDrawer';
import type { Appointment, Service, Staff } from '@/lib/types';

type Period = 'day' | 'week' | 'month';

const PERIOD_LABEL: Record<Period, string> = {
    day: 'Hoy',
    week: 'Esta semana',
    month: 'Este mes',
};

function greeting(): string {
    const hour = new Date().getHours();
    if (hour < 12) return 'Buenos días';
    if (hour < 19) return 'Buenas tardes';
    return 'Buenas noches';
}

export default function DashboardPage() {
    const { tenant } = useSession();

    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [services, setServices] = useState<Service[]>([]);
    const [staff, setStaff] = useState<Staff[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [period, setPeriod] = useState<Period>('day');
    const [open, setOpen] = useState<Appointment | null>(null);
    const [copied, setCopied] = useState<string | null>(null);

    const timezone = tenant?.settings?.timezone;
    const currency = tenant?.settings?.currency;
    const domain = tenant?.domain ?? '';
    const salonName = tenant?.name ?? 'NailFlow';

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
                if (!cancelled) setError('No pudimos cargar tu panel. Recarga la página.');
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, [tenant]);

    /**
     * Every "is this today?" question is answered in the salon's timezone.
     * Slicing the UTC ISO string made evening appointments belong to tomorrow.
     */
    const todayKey = useMemo(() => todayKeyInZone(timezone), [timezone]);

    const periodStart = useMemo(() => {
        const now = new Date();
        if (period === 'day') return todayKey;
        if (period === 'week') {
            const monday = new Date(now);
            monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
            return dayKeyInZone(monday, timezone);
        }
        const first = new Date(now.getFullYear(), now.getMonth(), 1);
        return dayKeyInZone(first, timezone);
    }, [period, todayKey, timezone]);

    const inPeriod = useCallback(
        (appointment: Appointment) => dayKeyInZone(appointment.datetime_start, timezone) >= periodStart,
        [periodStart, timezone]
    );

    const todays = useMemo(
        () =>
            appointments
                .filter(a => dayKeyInZone(a.datetime_start, timezone) === todayKey)
                .filter(a => a.status !== 'cancelled')
                .sort((a, b) => a.datetime_start.localeCompare(b.datetime_start)),
        [appointments, todayKey, timezone]
    );

    const pending = useMemo(() => todays.filter(a => a.status !== 'completed'), [todays]);
    const done = useMemo(() => todays.filter(a => a.status === 'completed'), [todays]);

    const completedInPeriod = useMemo(
        () => appointments.filter(a => a.status === 'completed' && inPeriod(a)),
        [appointments, inPeriod]
    );

    const income = useMemo(
        () => completedInPeriod.reduce((sum, a) => sum + Number(a.price ?? 0), 0),
        [completedInPeriod]
    );

    /**
     * Clients whose *first booking was made* inside the period.
     *
     * This used to key off the appointment date, so a first-timer booking today
     * for next Tuesday counted on Tuesday — and a long-standing client with an
     * appointment today counted as new.
     */
    const newClients = useMemo(() => {
        const firstBooking = new Map<string, string>();

        for (const appointment of appointments) {
            const phone = appointment.client_phone?.trim();
            const bookedAt = appointment.created_at;
            if (!phone || !bookedAt) continue;

            const earliest = firstBooking.get(phone);
            if (!earliest || bookedAt < earliest) firstBooking.set(phone, bookedAt);
        }

        return [...firstBooking.values()].filter(
            bookedAt => dayKeyInZone(bookedAt, timezone) >= periodStart
        ).length;
    }, [appointments, periodStart, timezone]);

    const owner = useMemo(() => staff.find(member => member.role === 'owner'), [staff]);

    const changeStatus = useCallback(async (appointment: Appointment, status: Appointment['status']) => {
        try {
            await api.setAppointmentStatus(appointment.id, status);
            setAppointments(current =>
                current.map(item => (item.id === appointment.id ? { ...item, status } : item))
            );
            setOpen(null);
        } catch {
            // Close the drawer first: the banner renders behind it, so leaving
            // it open showed the owner nothing at all.
            setOpen(null);
            setError('No pudimos actualizar la cita. Intenta de nuevo.');
        }
    }, []);

    const bookingUrl = (member: Staff) =>
        member.role === 'owner' || !member.slug
            ? `https://${domain}`
            : `https://${domain}/book/${member.slug}`;

    const copyLink = async (member: Staff) => {
        try {
            await navigator.clipboard.writeText(bookingUrl(member));
            setCopied(member.id);
            setTimeout(() => setCopied(null), 2000);
        } catch {
            setError('Tu navegador bloqueó el portapapeles. Copia el link a mano.');
        }
    };

    if (loading) {
        return (
            <div className="space-y-6 p-2" aria-busy="true" aria-label="Cargando panel">
                <div className="skeleton h-12 w-72" />
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    {Array.from({ length: 4 }, (_, i) => (
                        <div key={i} className="skeleton h-32" />
                    ))}
                </div>
                <div className="skeleton h-64 w-full" />
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

            <header className="mb-10 flex items-start justify-between gap-6">
                <div>
                    <p className="t-label mb-2">
                        {greeting()}
                        {owner ? `, ${owner.name.split(' ')[0]}` : ''}
                    </p>
                    <h1 className="t-display">{salonName}</h1>
                </div>

                {owner && (
                    <div className="size-12 shrink-0 overflow-hidden rounded-full border border-line">
                        {owner.photo_url ? (
                            <img src={api.getImageUrl(owner.photo_url)} alt="" className="size-full object-cover" />
                        ) : (
                            <span className="grid size-full place-items-center bg-brand-tint text-sm font-semibold text-text-strong">
                                {initials(owner.name)}
                            </span>
                        )}
                    </div>
                )}
            </header>

            <section className="mb-12">
                <div className="mb-5 flex items-center justify-between gap-4">
                    <h2 className="t-title">Tu negocio</h2>
                    <div className="flex items-center gap-1 rounded-full border border-line p-1">
                        {(Object.keys(PERIOD_LABEL) as Period[]).map(key => (
                            <button
                                key={key}
                                onClick={() => setPeriod(key)}
                                aria-pressed={period === key}
                                className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                                    period === key
                                        ? 'bg-text-strong text-white'
                                        : 'text-text-muted hover:text-text-strong'
                                }`}
                            >
                                {PERIOD_LABEL[key]}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <Metric
                        label="Ingresos"
                        value={formatMoney(income, currency)}
                        hint="Solo citas completadas"
                    />
                    <Metric label="Completadas" value={completedInPeriod.length} hint={PERIOD_LABEL[period]} />
                    <Metric label="Pendientes hoy" value={pending.length} hint="Aún por atender" />
                    <Metric label="Clientas nuevas" value={newClients} hint="Primera reserva" />
                </div>
            </section>

            <section className="mb-12">
                <h2 className="t-title mb-5">Hoy</h2>

                {todays.length === 0 ? (
                    <div className="blank-slate">
                        <span className="material-symbol text-3xl opacity-40" aria-hidden="true">self_improvement</span>
                        <p className="t-body">Sin citas hoy.</p>
                        <p className="t-meta">Un buen día para poner al día el catálogo.</p>
                    </div>
                ) : (
                    <ol className="space-y-3">
                        {todays.map(appointment => {
                            const service = services.find(item => item.id === appointment.service_id);
                            const presentation = STATUS_PRESENTATION[appointment.status];
                            const isDone = appointment.status === 'completed';

                            return (
                                <li key={appointment.id}>
                                    <button
                                        onClick={() => setOpen(appointment)}
                                        className={`sheet sheet-interactive flex w-full items-center gap-5 p-5 text-left ${isDone ? 'opacity-60' : ''}`}
                                    >
                                        <p className="t-figure w-14 shrink-0 text-lg font-semibold text-text-strong">
                                            {formatTime(appointment.datetime_start)}
                                        </p>
                                        <span className="h-10 w-px shrink-0 bg-line" aria-hidden="true" />
                                        <div className="min-w-0 flex-1">
                                            <p className="t-body truncate font-semibold text-text-strong">
                                                {appointment.client_name}
                                            </p>
                                            <p className="t-meta truncate">
                                                {appointment.service_name ?? service?.name ?? 'Servicio'}
                                            </p>
                                        </div>
                                        <span className="status-pill shrink-0" data-status={presentation.token}>
                                            {presentation.label}
                                        </span>
                                    </button>
                                </li>
                            );
                        })}
                    </ol>
                )}

                {done.length > 0 && (
                    <p className="t-meta mt-4 text-center">
                        {done.length} de {todays.length} completadas
                    </p>
                )}
            </section>

            <section>
                <h2 className="t-title mb-2">Links de reserva</h2>
                <p className="t-meta mb-5">Compárte­los para que tus clientas reserven contigo.</p>

                {staff.length === 0 ? (
                    <div className="blank-slate">
                        <p className="t-body">Aún no hay nadie en el equipo.</p>
                        <p className="t-meta">Añade especialistas para generar sus links.</p>
                    </div>
                ) : (
                    <ul className="space-y-3">
                        {staff.map(member => {
                            const url = bookingUrl(member);
                            const isCopied = copied === member.id;

                            return (
                                <li key={member.id} className="sheet flex items-center gap-4 p-4">
                                    <span className="size-10 shrink-0 overflow-hidden rounded-full border border-line">
                                        {member.photo_url ? (
                                            <img src={api.getImageUrl(member.photo_url)} alt="" className="size-full object-cover" />
                                        ) : (
                                            <span className="grid size-full place-items-center bg-brand-tint text-xs font-semibold text-text-strong">
                                                {initials(member.name)}
                                            </span>
                                        )}
                                    </span>

                                    <div className="min-w-0 flex-1">
                                        <p className="t-body truncate font-medium text-text-strong">
                                            {member.name}
                                            {member.role === 'owner' && (
                                                <span className="t-meta ml-2">Dirección</span>
                                            )}
                                        </p>
                                        <p className="t-meta truncate">{url}</p>
                                    </div>

                                    <button
                                        onClick={() => copyLink(member)}
                                        aria-label={`Copiar el link de ${member.name}`}
                                        className={`grid size-10 shrink-0 place-items-center rounded-xl border transition-colors ${
                                            isCopied
                                                ? 'border-success/40 bg-success/10 text-success'
                                                : 'border-line text-text-muted hover:text-text-strong'
                                        }`}
                                    >
                                        <span className="material-symbol text-lg" aria-hidden="true">
                                            {isCopied ? 'check' : 'content_copy'}
                                        </span>
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </section>

            {open && (
                <AppointmentDrawer
                    appointment={open}
                    services={services}
                    staff={staff}
                    salonName={salonName}
                    currency={currency}
                    onClose={() => setOpen(null)}
                    onStatusChange={changeStatus}
                />
            )}
        </div>
    );
}

function Metric({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
    return (
        <div className="sheet p-6">
            <p className="t-label mb-3">{label}</p>
            <p className="t-figure text-3xl font-light text-text-strong">{value}</p>
            {hint && <p className="t-meta mt-1">{hint}</p>}
        </div>
    );
}
