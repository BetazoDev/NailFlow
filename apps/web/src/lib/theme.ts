import type { TenantBranding } from '@/lib/types';
import { PALETTES, TYPOGRAPHY, DEFAULT_PALETTE_ID, DEFAULT_TYPOGRAPHY_ID } from '@/lib/constants';

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

    const palette =
        PALETTES.find(item => item.id === branding?.palette_id) ??
        PALETTES.find(item => item.id === DEFAULT_PALETTE_ID)!;

    for (const [token, value] of Object.entries(palette.tokens)) {
        root.style.setProperty(token, value);
    }

    const typography =
        TYPOGRAPHY.find(item => item.id === branding?.typography) ??
        TYPOGRAPHY.find(item => item.id === DEFAULT_TYPOGRAPHY_ID)!;

    root.style.setProperty('--font-display', typography.display);
    root.style.setProperty('--font-body', typography.body);

    // A salon that set explicit brand colours overrides the palette's accents.
    if (branding?.primary_color) root.style.setProperty('--brand-primary', branding.primary_color);
    if (branding?.secondary_color) root.style.setProperty('--brand-secondary', branding.secondary_color);
}
