/**
 * Presentation helpers shared by the admin panel and the booking flow.
 *
 * Formatting used to be re-implemented in every page, which is why the same
 * appointment could read "15 de marzo" on one screen and "15/3/2026" on another.
 */

const LOCALE = 'es-MX';

export function formatMoney(value: number | string | null | undefined, currency = 'MXN'): string {
    const amount = Number(value);
    return new Intl.NumberFormat(LOCALE, {
        style: 'currency',
        currency,
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
    }).format(Number.isFinite(amount) ? amount : 0);
}

export function formatDate(value: string | Date | null | undefined): string {
    if (!value) return '—';
    const date = typeof value === 'string' ? new Date(value) : value;
    if (Number.isNaN(date.getTime())) return '—';
    return date.toLocaleDateString(LOCALE, { day: 'numeric', month: 'long', year: 'numeric' });
}

export function formatShortDate(value: string | Date | null | undefined): string {
    if (!value) return '—';
    const date = typeof value === 'string' ? new Date(value) : value;
    if (Number.isNaN(date.getTime())) return '—';
    return date.toLocaleDateString(LOCALE, { day: 'numeric', month: 'short' });
}

export function formatTime(value: string | Date | null | undefined): string {
    if (!value) return '—';
    const date = typeof value === 'string' ? new Date(value) : value;
    if (Number.isNaN(date.getTime())) return '—';
    return date.toLocaleTimeString(LOCALE, { hour: '2-digit', minute: '2-digit', hour12: false });
}

/** "YYYY-MM-DD" in local time — `toISOString()` would shift the day in the Americas. */
export function toDateKey(value: Date): string {
    return [
        value.getFullYear(),
        String(value.getMonth() + 1).padStart(2, '0'),
        String(value.getDate()).padStart(2, '0'),
    ].join('-');
}

/**
 * A wa.me link, or null when there is no usable number.
 *
 * Returning null instead of a link to `wa.me/null` is the difference between a
 * disabled button and one that opens a broken chat.
 */
export function whatsappLink(phone: string | null | undefined, message?: string): string | null {
    const digits = phone?.replace(/\D/g, '');
    if (!digits || digits.length < 8) return null;

    const query = message ? `?text=${encodeURIComponent(message)}` : '';
    return `https://wa.me/${digits}${query}`;
}

/** Initials for an avatar placeholder. */
export function initials(name: string): string {
    return name
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map(part => part.charAt(0).toUpperCase())
        .join('');
}
