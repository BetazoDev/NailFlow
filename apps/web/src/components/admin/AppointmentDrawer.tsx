'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { formatMoney, formatTime, initials, whatsappLink } from '@/lib/format';
import { STATUS_PRESENTATION } from '@/lib/constants';
import Lightbox from '@/components/ui/Lightbox';
import type { Appointment, Service, Staff } from '@/lib/types';

interface Props {
    appointment: Appointment;
    services: Service[];
    staff: Staff[];
    salonName: string;
    currency?: string;
    onClose: () => void;
    onStatusChange: (appointment: Appointment, status: Appointment['status']) => Promise<void>;
}

/**
 * The appointment detail panel, shared by the dashboard and the agenda.
 *
 * Both screens had their own near-identical copy, which is how they drifted
 * into showing different money for the same appointment.
 */
export default function AppointmentDrawer({
    appointment,
    services,
    staff,
    salonName,
    currency,
    onClose,
    onStatusChange,
}: Props) {
    const [busy, setBusy] = useState<'complete' | 'cancel' | null>(null);
    const [confirmingCancel, setConfirmingCancel] = useState(false);
    const [lightbox, setLightbox] = useState<number | null>(null);

    // Escape closes the drawer: it covers the page, so there must be a way out
    // that is not hunting for the arrow.
    useEffect(() => {
        const onKey = (event: KeyboardEvent) => {
            if (event.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose]);

    const service = services.find(item => item.id === appointment.service_id);
    const member = staff.find(item => item.id === appointment.staff_id);
    const presentation = STATUS_PRESENTATION[appointment.status];

    const start = new Date(appointment.datetime_start);
    const end = new Date(appointment.datetime_end);
    const durationMinutes = Math.max(0, Math.round((end.getTime() - start.getTime()) / 60000));
    const dateLabel = start.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' });

    // The price charged at booking, and the deposit the service actually asks
    // for. This used to be a flat 40% of today's catalogue price, which drifted
    // from what the client was really quoted.
    const total = Number(appointment.price ?? service?.estimated_price ?? 0);
    const deposit = appointment.advance_paid ? Number(service?.required_advance ?? 0) : 0;
    const balance = Math.max(0, total - deposit);

    const images = appointment.image_urls.length
        ? appointment.image_urls
        : appointment.image_url
          ? [appointment.image_url]
          : [];

    const waLink = whatsappLink(
        appointment.client_phone,
        `¡Hola ${appointment.client_name}! Te recordamos tu cita en ${salonName} el ${dateLabel} a las ${formatTime(appointment.datetime_start)}. ¿Nos confirmas tu asistencia?`
    );

    const isUpcoming = new Date() < start;
    const isClosed = appointment.status === 'completed' || appointment.status === 'cancelled';

    const run = async (kind: 'complete' | 'cancel', status: Appointment['status']) => {
        setBusy(kind);
        await onStatusChange(appointment, status);
        setBusy(null);
    };

    return (
        <div className="animate-fade-in fixed inset-0 z-50 flex justify-end">
            <button
                aria-label="Cerrar detalle"
                onClick={onClose}
                className="absolute inset-0 bg-text-strong/25 backdrop-blur-sm"
            />

            <aside
                role="dialog"
                aria-label={`Cita de ${appointment.client_name}`}
                className="animate-slide-in-right relative flex h-full w-full max-w-md flex-col bg-surface shadow-lg"
            >
                <header className="flex items-start justify-between gap-4 border-b border-line px-7 pb-6 pt-7">
                    <div className="min-w-0">
                        <p className="t-label mb-2">{dateLabel}</p>
                        <h2 className="t-title truncate">{appointment.client_name}</h2>
                        <span className="status-pill mt-3 inline-flex" data-status={presentation.token}>
                            {presentation.label}
                        </span>
                    </div>
                    <button
                        onClick={onClose}
                        aria-label="Cerrar"
                        className="grid size-9 shrink-0 place-items-center rounded-full text-text-muted transition-colors hover:bg-surface-sunken hover:text-text-strong"
                    >
                        <span className="material-symbol text-xl" aria-hidden="true">close</span>
                    </button>
                </header>

                <div className="flex-1 space-y-7 overflow-y-auto px-7 py-7">
                    <section>
                        <dl className="grid grid-cols-2 gap-x-4 gap-y-6">
                            <div>
                                <dt className="t-label mb-1.5">Hora</dt>
                                <dd className="t-figure text-lg font-semibold text-text-strong">
                                    {formatTime(appointment.datetime_start)} – {formatTime(appointment.datetime_end)}
                                </dd>
                            </div>
                            <div>
                                <dt className="t-label mb-1.5">Duración</dt>
                                <dd className="t-figure text-lg font-semibold text-text-strong">
                                    {durationMinutes} min
                                </dd>
                            </div>
                            <div>
                                <dt className="t-label mb-1.5">Servicio</dt>
                                <dd className="t-body font-medium text-text-strong">
                                    {appointment.service_name ?? service?.name ?? 'Sin especificar'}
                                </dd>
                            </div>
                            <div>
                                <dt className="t-label mb-1.5">Especialista</dt>
                                <dd className="t-body font-medium capitalize text-text-strong">
                                    {member?.name ?? 'Sin asignar'}
                                </dd>
                            </div>
                        </dl>
                    </section>

                    <section>
                        <h3 className="t-label mb-3">Contacto</h3>
                        <div className="sheet flex items-center gap-3 p-4">
                            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-brand-tint text-sm font-semibold text-text-strong">
                                {initials(appointment.client_name)}
                            </span>
                            <div className="min-w-0 flex-1">
                                <p className="t-body truncate font-medium text-text-strong">
                                    {appointment.client_phone ?? 'Sin teléfono'}
                                </p>
                                {appointment.client_email && (
                                    <p className="t-meta truncate">{appointment.client_email}</p>
                                )}
                            </div>
                        </div>
                    </section>

                    {images.length > 0 && (
                        <section>
                            <h3 className="t-label mb-3">Inspiración</h3>
                            <div className="flex gap-3 overflow-x-auto pb-1 no-scrollbar">
                                {images.map((url, index) => (
                                    <button
                                        key={url}
                                        onClick={() => setLightbox(index)}
                                        aria-label={`Ampliar referencia ${index + 1}`}
                                        className="size-24 shrink-0 overflow-hidden rounded-2xl border border-line transition-transform hover:scale-[1.03]"
                                    >
                                        <img
                                            src={api.getImageUrl(url)}
                                            alt=""
                                            className="size-full object-cover"
                                        />
                                    </button>
                                ))}
                            </div>

                            {lightbox !== null && (
                                <Lightbox
                                    images={images.map(url => api.getImageUrl(url))}
                                    initialIndex={lightbox}
                                    onClose={() => setLightbox(null)}
                                />
                            )}
                        </section>
                    )}

                    {appointment.notes && (
                        <section>
                            <h3 className="t-label mb-3">Notas de la clienta</h3>
                            <blockquote className="t-body border-l-2 border-brand pl-4 italic">
                                {appointment.notes}
                            </blockquote>
                        </section>
                    )}

                    {total > 0 && (
                        <section>
                            <h3 className="t-label mb-3">Pago</h3>
                            <div className="sheet divide-y divide-line">
                                <div className="flex items-center justify-between p-4">
                                    <span className="t-meta">Total del servicio</span>
                                    <span className="t-figure font-medium text-text-strong">
                                        {formatMoney(total, currency)}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between p-4">
                                    <span className="t-meta">
                                        {appointment.advance_paid ? 'Anticipo pagado' : 'Anticipo pendiente'}
                                    </span>
                                    <span className="t-figure font-medium text-text-strong">
                                        {formatMoney(deposit, currency)}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between bg-surface-sunken/50 p-4">
                                    <span className="t-body font-semibold text-text-strong">Saldo</span>
                                    <span className="t-figure text-lg font-semibold text-text-strong">
                                        {formatMoney(balance, currency)}
                                    </span>
                                </div>
                            </div>
                        </section>
                    )}
                </div>

                <footer className="space-y-3 border-t border-line bg-surface-raised px-7 py-6">
                    {waLink ? (
                        <a
                            href={waLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex w-full items-center justify-center gap-2.5 rounded-full border border-line py-3.5 font-medium text-text-strong transition-colors hover:bg-surface-sunken"
                        >
                            <span className="material-symbol text-xl text-[#25D366]" aria-hidden="true">chat</span>
                            Escribir por WhatsApp
                        </a>
                    ) : (
                        <p className="t-meta py-2 text-center">Sin teléfono para contactar</p>
                    )}

                    {!isClosed && (
                        <>
                            <button
                                onClick={() => run('complete', 'completed')}
                                disabled={busy !== null || isUpcoming}
                                className="btn-gradient w-full py-3.5 disabled:opacity-40"
                            >
                                {busy === 'complete' ? 'Guardando…' : 'Marcar como completada'}
                            </button>

                            {isUpcoming && (
                                <p className="t-meta text-center">
                                    Podrás completarla cuando empiece la cita
                                </p>
                            )}

                            {confirmingCancel ? (
                                <div className="flex items-center justify-center gap-3 pt-1">
                                    <button
                                        onClick={() => run('cancel', 'cancelled')}
                                        disabled={busy !== null}
                                        className="rounded-full bg-danger px-5 py-2 text-xs font-semibold text-white disabled:opacity-50"
                                    >
                                        {busy === 'cancel' ? 'Cancelando…' : 'Sí, cancelar la cita'}
                                    </button>
                                    <button
                                        onClick={() => setConfirmingCancel(false)}
                                        className="t-meta hover:text-text-strong"
                                    >
                                        Volver
                                    </button>
                                </div>
                            ) : (
                                <button
                                    onClick={() => setConfirmingCancel(true)}
                                    className="t-meta w-full py-1 text-center transition-colors hover:text-danger"
                                >
                                    Cancelar cita
                                </button>
                            )}
                        </>
                    )}
                </footer>
            </aside>
        </div>
    );
}
