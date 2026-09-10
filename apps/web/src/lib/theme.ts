import type { TenantBranding } from '@/lib/types';
import { PALETTES, TYPOGRAPHY, DEFAULT_PALETTE_ID, DEFAULT_TYPOGRAPHY_ID } from '@/lib/constants';

/** Relative luminance, per WCAG. */
function luminance(hex: string): number | null {
    const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
    if (!match) return null;

    const channels = [0, 2, 4].map(i => parseInt(match[1].slice(i, i + 2), 16) / 255);
    const [r, g, b] = channels.map(c =>
        c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
    );
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: number, b: number): number {
    const [light, dark] = a > b ? [a, b] : [b, a];
    return (light + 0.05) / (dark + 0.05);
}

const INK = '#2C2420';
const PAPER = '#FFFFFF';

/**
 * The text colour that stays legible across a two-stop gradient.
 *
 * Scored against the *worse* of the two stops, because the label runs over
 * both: a colour that reads beautifully at one end and vanishes at the other is
 * still an unreadable button.
 *
 * Falls back to ink when a colour cannot be parsed — every palette in the
 * product is pale, so that is the safer guess than white.
 */
function readableOn(...colours: string[]): string {
    const stops = colours.map(luminance).filter((value): value is number => value !== null);
    if (stops.length === 0) return INK;

    const ink = luminance(INK)!;
    const paper = luminance(PAPER)!;

    const worst = (text: number) => Math.min(...stops.map(stop => contrast(text, stop)));
    return worst(ink) >= worst(paper) ? INK : PAPER;
}

/**
 * Applies a tenant's palette and typography to the document.
 *
 * One function, called from one place (the theme provider), so the booking flow
 * and the admin panel cannot drift apart. Previously each page applied its own
 * subset of variables, which is why changing the palette re-themed the
 * dashboard but left the booking wizard on the default pink.
 */
export function applyBranding(branding: TenantBranding | undefined): void {
    if (typeof document === 'undefined') return;

    const root = document.documentElement;

    /**
     * Only write a property whose value actually differs.
     *
     * Rewriting `--font-display` on a colour-only change re-resolves the font
     * on every element that uses it, so the page reflows: the content height
     * shifts under the scroll position and a band of blank space appears below
     * until you scroll. Picking a palette should repaint, not relayout.
     */
    const set = (token: string, value: string) => {
        if (root.style.getPropertyValue(token) !== value) {
            root.style.setProperty(token, value);
        }
    };

    const palette =
        PALETTES.find(item => item.id === branding?.palette_id) ??
        PALETTES.find(item => item.id === DEFAULT_PALETTE_ID)!;

    for (const [token, value] of Object.entries(palette.tokens)) set(token, value);

    const typography =
        TYPOGRAPHY.find(item => item.id === branding?.typography) ??
        TYPOGRAPHY.find(item => item.id === DEFAULT_TYPOGRAPHY_ID)!;

    set('--font-display', typography.display);
    set('--font-body', typography.body);

    // A salon that set explicit brand colours overrides the palette's accents.
    if (branding?.primary_color) set('--brand-primary', branding.primary_color);
    if (branding?.secondary_color) set('--brand-secondary', branding.secondary_color);

    // Whatever the brand colour ends up being, the label on top of it has to be
    // readable. Every palette shipped here is a pale pastel where white lands
    // around 2:1 against a 4.5 minimum, so the default is dark — but a salon can
    // pick her own colour, and a dark one would need the opposite.
    set(
        '--on-brand',
        readableOn(
            branding?.primary_color ?? palette.tokens['--brand-primary'],
            branding?.secondary_color ?? palette.tokens['--brand-secondary']
        )
    );
}

/**
 * Removes any palette written by a live preview, so the document falls back to
 * the values defined in the stylesheet.
 *
 * `applyBranding` writes inline custom properties on the root element, which
 * outrank the stylesheet and survive navigation. Without this, an owner who
 * clicked through the palettes to compare them and then left without saving
 * kept the last one she happened to click — across the whole panel — until a
 * hard reload.
 */
export function clearBrandingPreview(): void {
    if (typeof document === 'undefined') return;

    const root = document.documentElement;
    const tokens = Object.keys(PALETTES[0].tokens);

    for (const token of tokens) root.style.removeProperty(token);
    root.style.removeProperty('--font-display');
    root.style.removeProperty('--font-body');
    root.style.removeProperty('--brand-primary');
    root.style.removeProperty('--brand-secondary');
    // Left behind, this pins the label colour of a palette the salon is no
    // longer using — and on a dark custom brand that means an invisible button.
    root.style.removeProperty('--on-brand');
}
