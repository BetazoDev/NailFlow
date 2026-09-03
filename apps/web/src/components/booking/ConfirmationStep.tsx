'use client';

import { api } from '@/lib/api';
import { useBooking } from './BookingContext';

function formatFullDate(dateStr: string | null) {
    if (!dateStr) return '—';
    return new Date(`${dateStr}T12:00:00`).toLocaleDateString('es-MX', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
    });
}

/**
 * Google Calendar wants `YYYYMMDDTHHMMSS` local times.
 *
 * The previous version passed only the date, so every "add to calendar" produced
 * an all-day event — the one detail the client most needs was the one it lost.
 */
function calendarStamp(date: string, time: string, addMinutes = 0): string {
    const start = new Date(`${date}T${time}:00`);
    start.setMinutes(start.getMinutes() + addMinutes);

    const pad = (value: number) => String(value).padStart(2, '0');
    return (
        `${start.getFullYear()}${pad(start.getMonth() + 1)}${pad(start.getDate())}` +
        `T${pad(start.getHours())}${pad(start.getMinutes())}00`
    );
}

export default function ConfirmationStep() {
    const { draft, totals, salonName, confirmedAppointmentId } = useBooking();

    const serviceNames = draft.services.map(service => service.name).join(' + ');
    const canAddToCalendar = Boolean(draft.date && draft.time);

    const calendarUrl = canAddToCalendar
        ? 'https://calendar.google.com/calendar/r/eventedit' +
          `?text=${encodeURIComponent(`${serviceNames} · ${salonName}`)}` +
          `&dates=${calendarStamp(draft.date!, draft.time!)}/${calendarStamp(draft.date!, draft.time!, totals.durationMinutes)}` +
          `&details=${encodeURIComponent(`Cita en ${salonName} con ${draft.staffName}`)}`
        : null;

    return (
        <div className="flex min-h-full animate-fade-in flex-col items-center overflow-y-auto bg-surface p-6 py-12">
            <div className="relative mb-10">
                <div className="animate-scale-in grid size-32 place-items-center rounded-full border-4 border-surface-raised bg-brand-tint shadow-lg">
                    <span className="text-5xl" aria-hidden="true">✨</span>
                </div>
            </div>

            <div className="stagger-children mb-10 text-center">
                <h1 className="mb-3 font-display text-4xl leading-tight text-text-strong">
                    ¡Tu cita está <span className="text-brand">lista!</span>
                </h1>
                <p className="mx-auto max-w-[300px] text-sm leading-relaxed text-text-muted">
                    {draft.paymentMethod === 'mercado'
                        ? 'Recibimos tu anticipo. Te esperamos.'
                        : 'Te esperamos. Recuerda avisarnos si necesitas reprogramar.'}
                </p>
            </div>

            <div className="animate-fade-in-up mb-10 w-full max-w-sm rounded-[2rem] border border-line bg-surface-raised p-8 shadow-lg">
                <div className="mb-6 flex items-center justify-between border-b border-line pb-4">
                    <div className="min-w-0">
                        <p className="mb-1 text-[9px] font-bold uppercase tracking-widest text-text-muted">
                            Tu cita en
                        </p>
                        <h2 className="truncate font-display text-lg font-bold text-text-strong">{salonName}</h2>
                    </div>
                    <span className="grid size-10 shrink-0 place-items-center rounded-full bg-brand-tint text-lg" aria-hidden="true">
                        💅
                    </span>
                </div>

                <dl className="grid grid-cols-2 gap-6">
                    <div>
                        <dt className="mb-1.5 text-[9px] font-bold uppercase tracking-widest text-text-muted">Fecha</dt>
                        <dd className="font-display font-bold capitalize text-text-strong">
                            {formatFullDate(draft.date)}
                        </dd>
                    </div>
                    <div>
                        <dt className="mb-1.5 text-[9px] font-bold uppercase tracking-widest text-text-muted">Hora</dt>
                        <dd className="font-display font-bold text-text-strong">
                            {draft.time ?? '—'} · {totals.durationMinutes} min
                        </dd>
                    </div>
                </dl>

                <div className="mt-6 border-t border-line pt-4">
                    <p className="mb-2 text-[9px] font-bold uppercase tracking-widest text-text-muted">Servicios</p>
                    <ul className="space-y-1">
                        {draft.services.map(service => (
                            <li key={service.id} className="flex justify-between text-sm text-text-strong">
                                <span>{service.name}</span>
                                <span className="text-text-muted">${Number(service.estimated_price).toFixed(2)}</span>
                            </li>
                        ))}
                    </ul>
                    <p className="mt-3 flex justify-between border-t border-line pt-3 text-sm font-bold text-text-strong">
                        <span>Total</span>
                        <span>${totals.price.toFixed(2)}</span>
                    </p>
                </div>

                <div className="mt-6 flex items-center justify-between border-t border-line pt-4">
                    <div className="flex min-w-0 items-center gap-3">
                        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-brand-tint text-xs font-bold text-brand">
                            {draft.clientName.charAt(0).toUpperCase() || 'C'}
                        </span>
                        <span className="truncate text-xs font-bold uppercase tracking-widest text-text-strong">
                            {draft.clientName}
                        </span>
                    </div>
                    <span className="status-pill" data-status="confirmed">Confirmada</span>
                </div>

                {draft.imageUrls.length > 0 && (
                    <div className="mt-6 border-t border-line pt-4">
                        <p className="mb-3 text-[9px] font-bold uppercase tracking-widest text-text-muted">
                            Inspiración
                        </p>
                        <div className="flex gap-2 overflow-x-auto pb-1">
                            {draft.imageUrls.map((url, index) => (
                                <img
                                    key={url}
                                    src={api.getImageUrl(url)}
                                    alt={`Referencia ${index + 1}`}
                                    className="size-12 shrink-0 rounded-xl border border-line object-cover"
                                />
                            ))}
                        </div>
                    </div>
                )}

                {confirmedAppointmentId && (
                    <p className="mt-6 text-center text-[9px] uppercase tracking-widest text-text-subtle">
                        Folio {confirmedAppointmentId.slice(0, 8)}
                    </p>
                )}
            </div>

            <div className="w-full max-w-sm space-y-3">
                {calendarUrl && (
                    <a
                        href={calendarUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn-gradient flex w-full items-center justify-center gap-3 py-5 text-base"
                    >
                        <span className="material-symbol text-xl" aria-hidden="true">calendar_add_on</span>
                        Añadir al calendario
                    </a>
                )}

                <button
                    onClick={() => window.location.reload()}
                    className="w-full py-4 text-center text-[10px] font-bold uppercase tracking-[0.2em] text-brand underline-offset-4 hover:underline"
                >
                    Agendar otra cita
                </button>
            </div>
        </div>
    );
}
