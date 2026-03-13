import React from 'react';
import BookingWizard from '@/components/booking/BookingWizard';
import { api } from '@/lib/api';
import { notFound } from 'next/navigation';
import { PALETTES, TYPOGRAPHY } from '@/lib/constants';

interface Props {
    params: {
        staffSlug: string;
    }
}

// Fallback tenant domain for the primary root application
const TENANT_DOMAIN = 'demo.diabolicalservices.tech';

export const dynamic = 'force-dynamic';

export default async function StaffBookingPage({ params }: Props) {
    const tenant = await api.getTenant(TENANT_DOMAIN);

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

    if (!staffMember) {
        // Option to handle invalid staff here, but we will just default to first one or display name
    }

    const staffName = staffMember?.name || params.staffSlug.replace(/-/g, ' ');
    const staffId = staffMember?.id || 'staff-1';
    const staffPhoto = staffMember?.photo_url || undefined;

    return (
        <div className="min-h-screen bg-cream lg:h-screen lg:overflow-hidden p-0 md:p-0 lg:p-0" style={({
            ...cssVars.split(';').reduce((acc: Record<string, string>, curr) => {
                const [k, v] = curr.split(':');
                if (k && v) acc[k.trim()] = v.trim();
                return acc;
            }, {}), '--font-display': typo.fontDisplay, '--font-sans': typo.fontSans
        }) as React.CSSProperties}>
            {/* Main Layout Container */}
            <div className="w-full h-full flex flex-col lg:flex-row overflow-hidden">

                {/* Left Side (Desktop Sidebar) / Header (Mobile) */}
                <div
                    className="w-full lg:w-[40%] xl:w-[35%] lg:h-screen flex flex-col relative z-20 shadow-xl overflow-y-auto no-scrollbar"
                    style={{ background: 'linear-gradient(165deg, var(--cream) 0%, var(--pink-pale) 40%, var(--cream-dark) 100%)' }}
                >
                    <div className="flex-1 px-8 pt-12 pb-24 lg:p-16 flex flex-col justify-center">
                        <div className="lg:max-w-sm mx-auto lg:mx-0">
                            <div
                                className="w-20 h-20 lg:w-24 lg:h-24 rounded-3xl flex items-center justify-center shadow-2xl overflow-hidden mb-8 transform -rotate-3 hover:rotate-0 transition-transform duration-500"
                                style={{ background: `linear-gradient(135deg, ${tenant.branding.primary_color}, ${tenant.branding.secondary_color})` }}
                            >
                                {tenant.branding.logo_url ? (
                                    <img src={api.getPublicUrl(tenant.branding.logo_url)} className="w-full h-full object-cover" alt="Logo" />
                                ) : (
                                    <span className="font-serif text-4xl text-white uppercase">{tenant.domain.charAt(0)}</span>
                                )}
                            </div>
                            <h1 className="font-serif text-4xl lg:text-6xl font-bold text-charcoal mb-4 uppercase tracking-tight leading-none">{tenant.name || tenant.domain.split('.')[0]}</h1>
                            
                            <div className="h-1 w-20 bg-pink rounded-full mb-6" />

                            <p className="text-base lg:text-xl text-charcoal-light font-medium max-w-[320px] mb-8 leading-relaxed">
                                Agenda tu experiencia personalizada con <span className="font-bold text-pink border-b-2 border-pink/20 pb-0.5 capitalize">{staffName}</span>
                            </p>

                            {staffPhoto && (
                                <div className="flex items-center gap-4 p-4 rounded-3xl bg-white/40 border border-white/60 backdrop-blur-md shadow-sm transition-all hover:shadow-md hover:bg-white/60">
                                    <div className="size-14 rounded-full overflow-hidden border-2 border-white shadow-soft">
                                        <img src={api.getPublicUrl(staffPhoto)} alt={staffName} className="w-full h-full object-cover" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-charcoal uppercase tracking-wider capitalize">{staffName}</p>
                                        <p className="text-xs text-charcoal-light italic font-medium">Especialista Senior</p>
                                    </div>
                                    <div className="ml-auto w-8 h-8 rounded-full bg-pink/10 flex items-center justify-center text-pink">
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Fixed Bottom Banner for Sidebar */}
                    <div className="sticky bottom-0 left-0 right-0 p-6 lg:p-8 bg-white/20 backdrop-blur-sm border-t border-white/40">
                        <div className="flex items-center gap-3 justify-center lg:justify-start">
                            <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center text-green-600">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/></svg>
                            </div>
                            <p className="text-[11px] font-bold text-charcoal uppercase tracking-[0.1em]">Reserva 100% segura</p>
                        </div>
                    </div>

                    {/* Decorative elements */}
                    <div className="hidden lg:block absolute top-[5%] right-[-5%] w-64 h-64 rounded-full bg-pink-light/20 blur-[100px] pointer-events-none" />
                </div>

                {/* Right Side (Booking Area) */}
                <div className="flex-1 lg:h-screen overflow-hidden bg-white flex flex-col relative">
                    <div className="flex-1 w-full max-w-2xl mx-auto h-full overflow-y-auto no-scrollbar lg:custom-scrollbar">
                        <BookingWizard
                            tenantId={tenant.id}
                            staffId={staffId}
                            staffName={staffName}
                            staffPhoto={staffPhoto}
                            salonName={tenant.name}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}
}
