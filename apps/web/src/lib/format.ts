/**
 * Presentation helpers shared by the admin panel and the booking flow.
 *
 * Formatting used to be re-implemented in every page, which is why the same
 * appointment could read "15 de marzo" on one screen and "15/3/2026" on another.
 */

const LOCALE = 'es-MX';

export function formatMoney(value: number | string | null | undefined, currency = 'MXN'): string {
    const amount = Number(value);
    const safe = Number.isFinite(amount) ? amount : 0;

    // Whole amounts read better without ".00", but anything with cents needs
    // both digits: 450.5 as "$450.5" looks like a typo, not a price.
    const hasCents = Math.round(safe * 100) % 100 !== 0;

    return new Intl.NumberFormat(LOCALE, {
        style: 'currency',
        currency,
        minimumFractionDigits: hasCents ? 2 : 0,
        maximumFractionDigits: 2,
    }).format(safe);
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
 * Which calendar day a moment falls on, *in the salon's timezone*.
 *
 * The API serialises `datetime_start` as UTC, so slicing the ISO string gives
 * the UTC day. In Mexico City that is tomorrow from 18:00 onward: every evening
 * appointment vanished from "hoy" on the dashboard and came back the next
 * morning. The salon's own day is the only one that means anything here.
 *
 * `en-CA` is used because it formats as YYYY-MM-DD, which sorts and compares
 * as a plain string.
 */
export function dayKeyInZone(value: string | Date, timeZone?: string): string {
    const date = typeof value === 'string' ? new Date(value) : value;
    if (Number.isNaN(date.getTime())) return '';

    return new Intl.DateTimeFormat('en-CA', {
        timeZone: timeZone || undefined,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).format(date);
}

/** Today's calendar day in the salon's timezone, as "YYYY-MM-DD". */
export function todayKeyInZone(timeZone?: string): string {
    return dayKeyInZone(new Date(), timeZone);
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

/**
 * A URL segment for a personal booking link.
 *
 * Accents are transliterated, not deleted: the previous version stripped every
 * non-ASCII character, so "Sofía" became `sofa` and "María José" became
 * `mara-jos`. Two members called "Ana García" also collapsed onto the same
 * slug, silently pointing both links at one of them.
 */
export function slugify(name: string): string {
    return name
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/ñ/gi, 'n')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 60);
}
