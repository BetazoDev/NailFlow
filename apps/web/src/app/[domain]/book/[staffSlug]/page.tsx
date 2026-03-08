import React from 'react';
import BookingWidget from '@/components/booking/BookingWidget';
import { api } from '@/lib/api';
import { notFound } from 'next/navigation';
import { PALETTES, TYPOGRAPHY } from '@/lib/constants';

interface Props {
    params: {
        domain: string;
        staffSlug: string;
    }
}

export const dynamic = 'force-dynamic';

export default async function StaffBookingPage({ params }: Props) {
    const tenant = await api.getTenant(params.domain);

    if (!tenant) {
        notFound();
    }

    // Resolve palette and typography
    const palette = PALETTES.find(p => p.id === tenant.branding.palette_id) || PALETTES[0];
    const typo = TYPOGRAPHY.find(t => t.id === tenant.branding.typography) || TYPOGRAPHY[0];

    // Create CSS variables string
    const cssVars = Object.entries(palette.cssVars)
        .map(([key, value]) => `${key}: ${value};`)
        .join(' ');

    // Resolve the staff member by slug
    const allStaff = await api.getStaff();
    const staffMember = allStaff.find(s => {
        const memberSlug = s.slug || s.name.toLowerCase().replace(/\s+/g, '-');
        return memberSlug === params.staffSlug;
    });

    const staffName = staffMember?.name || params.staffSlug.replace(/-/g, ' ');
    const staffId = staffMember?.id || undefined;
    const staffPhoto = staffMember?.photo_url || undefined;

    return (
        <div
            className="min-h-screen bg-cream selection:bg-pink-pale selection:text-charcoal relative"
            style={{
                ...cssVars.split(';').reduce((acc, curr) => {
                    const [k, v] = curr.split(':');
                    if (k && v) acc[k.trim()] = v.trim();
                    return acc;
                }, {} as any),
                '--font-display': typo.fontDisplay,
                '--font-sans': typo.fontSans,
            } as React.CSSProperties}
        >
            <BookingWidget
                tenant={tenant}
                staffId={staffId}
                staffName={staffName}
                staffPhoto={staffPhoto}
                skipSplash={true}
            />
        </div>
    );
}
