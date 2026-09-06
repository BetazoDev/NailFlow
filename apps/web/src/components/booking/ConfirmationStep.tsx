'use client';

import { useRef, useState } from 'react';
import { toPng } from 'html-to-image';
import { api } from '@/lib/api';
import { formatMoney } from '@/lib/format';
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
    const receiptRef = useRef<HTMLDivElement>(null);
    const [downloading, setDownloading] = useState(false);
    const [downloadFailed, setDownloadFailed] = useState(false);

    /**
     * Saves the receipt as a picture.
     *
     * A client who books on her phone wants this in her camera roll, not in a
     * browser tab she will close. Rendered at twice the size so it stays legible
     * when she zooms in or shows it at the counter.
     */
    const download = async () => {
        if (!receiptRef.current) return;
        setDownloading(true);
        setDownloadFailed(false);
        try {
            const dataUrl = await toPng(receiptRef.current, {
                pixelRatio: 2,
                backgroundColor: '#FFFFFF',
                // Reference photos come from the CDN, and a tainted canvas
                // cannot be exported at all — better a receipt without them
                // than no receipt.
                filter: node => !(node instanceof HTMLImageElement && node.dataset.remote === 'true'),
            });

            const link = document.createElement('a');
            link.download = `cita-${salonName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${draft.date ?? ''}.png`;
            link.href = dataUrl;
            link.click();
        } catch {
            setDownloadFailed(true);
        } finally {
            setDownloading(false);
        }
    };

    const paidNow = draft.paymentMethod === 'mercado' ? totals.requiredAdvance : 0;
    const balance = Math.max(0, totals.price - paidNow);

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

            <div
                ref={receiptRef}
                className="animate-fade-in-up mb-10 w-full max-w-sm rounded-[2rem] border border-line bg-surface-raised p-8 shadow-lg"
            >
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
                        <span>{formatMoney(totals.price)}</span>
                    </p>

                    {paidNow > 0 && (
                        <>
                            <p className="mt-2 flex justify-between text-sm text-success">
                                <span>Anticipo pagado</span>
                                <span>−{formatMoney(paidNow)}</span>
                            </p>
                            {/* What she still owes, said plainly. Leaving it to
                                be worked out at the counter is how a client
                                arrives expecting to owe nothing. */}
                            <p className="mt-2 flex justify-between text-sm font-bold text-text-strong">
                                <span>Por pagar en el salón</span>
                                <span>{formatMoney(balance)}</span>
                            </p>
                        </>
                    )}
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
                                    data-remote="true"
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
                    onClick={download}
                    disabled={downloading}
                    className="flex w-full items-center justify-center gap-3 rounded-2xl border border-line bg-surface-raised py-5 text-base font-medium text-text-strong transition-colors hover:bg-surface-sunken disabled:opacity-50"
                >
                    <span className="material-symbol text-xl" aria-hidden="true">download</span>
                    {downloading ? 'Preparando…' : 'Descargar comprobante'}
                </button>

                {downloadFailed && (
                    <p role="alert" className="text-center text-xs text-danger">
                        No pudimos guardar la imagen. Puedes tomar una captura de pantalla.
                    </p>
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
