import React from 'react';
import BookingWizard from '@/components/booking/BookingWizard';
import { api } from '@/lib/api';
import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import { PALETTES, TYPOGRAPHY } from '@/lib/constants';

interface Props {
    params: {
        staffSlug: string;
    }
}

const getDefaultDomain = () => {
    const headersList = headers();
    const domain = headersList.get('host') || 'demo.diabolicalservices.tech';
    if (domain.includes('localhost') || domain.includes('127.0.0.1')) {
        return 'demo.diabolicalservices.tech';
    }
    return domain;
};

export const dynamic = 'force-dynamic';

export default async function StaffBookingPage({ params }: Props) {
    const domain = getDefaultDomain();
    const tenant = await api.getTenant(domain);

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
        <div 
            className="min-h-screen bg-nf-cream flex flex-col lg:flex-row overflow-hidden h-screen w-screen" 
            style={({
                ...cssVars.split(';').reduce((acc: Record<string, string>, curr) => {
                    const [k, v] = curr.split(':');
                    if (k && v) acc[k.trim()] = v.trim();
                    return acc;
                }, {}), 
                '--font-display': typo.fontDisplay, 
                '--font-sans': typo.fontSans,
                background: 'var(--cream)'
            }) as React.CSSProperties}
        >
            {/* Sidebar Izquierdo: Totally separate component area */}
            <aside 
                className="w-full lg:w-[35%] xl:w-[30%] h-auto lg:h-screen flex flex-col relative z-20 border-b lg:border-b-0 lg:border-r border-cream-dark/20 overflow-hidden"
                style={{ background: 'linear-gradient(160deg, var(--cream) 0%, var(--pink-pale) 40%, var(--cream-dark) 100%)' }}
            >
                {/* Scrollable content of sidebar */}
                <div className="flex-1 overflow-y-auto no-scrollbar p-8 lg:p-12 flex flex-col">
                    <div className="mb-auto">
                        <div
                            className="w-16 h-16 lg:w-20 lg:h-20 rounded-2xl flex items-center justify-center shadow-lg overflow-hidden mb-6"
                            style={{ background: `linear-gradient(135deg, ${tenant.branding.primary_color}, ${tenant.branding.secondary_color})` }}
                        >
                            {tenant.branding.logo_url ? (
                                <img src={api.getPublicUrl(tenant.branding.logo_url)} className="w-full h-full object-cover" alt="Logo" />
                            ) : (
                                <span className="font-serif text-3xl text-white uppercase">{tenant.domain.charAt(0)}</span>
                            )}
                        </div>
                        <h1 className="font-serif text-3xl lg:text-4xl xl:text-5xl font-semibold text-charcoal mb-4 uppercase leading-tight tracking-tight">
                            {tenant.name || tenant.domain.split('.')[0]}
                        </h1>
                        <p className="text-sm lg:text-base text-charcoal-light font-medium max-w-[280px] mb-6">
                            Agenda tu cita con <span className="font-semibold text-pink capitalize">{staffName}</span>
                        </p>
                        
                        {staffPhoto && (
                            <div className="flex items-center gap-4 p-4 bg-white/40 backdrop-blur-sm rounded-2xl border border-white/50 shadow-sm transition-all hover:bg-white/60">
                                <div className="size-14 rounded-full overflow-hidden border-2 border-white shadow-soft flex-shrink-0">
                                    <img src={api.getPublicUrl(staffPhoto)} alt={staffName} className="w-full h-full object-cover" />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-sm font-bold text-charcoal capitalize truncate">{staffName}</p>
                                    <p className="text-xs text-charcoal-light italic">Tu especialista</p>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Decorative elements for desktop */}
                    <div className="hidden lg:block absolute top-[5%] right-[5%] w-32 h-32 rounded-full bg-pink-light/20 blur-3xl pointer-events-none" />
                    <div className="hidden lg:block absolute bottom-[20%] left-[5%] w-48 h-48 rounded-full bg-coral-light/10 blur-3xl pointer-events-none" />
                </div>

                {/* Fixed bottom footer in sidebar */}
                <div className="p-6 bg-white/30 backdrop-blur-md border-t border-white/40">
                    <div className="flex items-center gap-3 text-nf-gray">
                        <div className="w-8 h-8 rounded-full bg-green-500/10 flex items-center justify-center text-green-600">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                        </div>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-charcoal/60">Reserva 100% segura</p>
                    </div>
                </div>
            </aside>

            {/* Main Booking Area: Independent scroll */}
            <main className="flex-1 h-screen overflow-hidden flex flex-col bg-white">
                <div className="flex-1 overflow-y-auto no-scrollbar relative flex flex-col">
                    <div className="flex-1 w-full max-w-2xl mx-auto flex flex-col h-full">
                        <BookingWizard
                            tenantId={tenant.id}
                            staffId={staffId}
                            staffName={staffName}
                            staffPhoto={staffPhoto}
                            salonName={tenant.name}
                        />
                    </div>
                </div>
            </main>
        </div>
    );
}
