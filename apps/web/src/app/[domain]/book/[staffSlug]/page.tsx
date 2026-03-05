import BookingWizard from '@/components/booking/BookingWizard';
import { api } from '@/lib/api';
import { notFound } from 'next/navigation';
import { PALETTES, TYPOGRAPHY } from '@/lib/constants';

interface Props {
    params: {
        domain: string;
        staffSlug: string;
    }
}

export async function generateStaticParams() {
    return [{ domain: 'demo', staffSlug: 'ana' }];
}

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
    const allStaff = await api.getStaff(tenant.id);
    const staffMember = allStaff.find(s => {
        const memberSlug = s.slug || s.name.toLowerCase().replace(/\s+/g, '-');
        return memberSlug === params.staffSlug;
    });

    const staffName = staffMember?.name || params.staffSlug.replace(/-/g, ' ');
    const staffId = staffMember?.id || 'staff-1';
    const staffPhoto = staffMember?.photo_url || undefined;

    return (
        <div className="min-h-screen bg-cream lg:flex lg:items-center lg:justify-center p-0 md:p-4 lg:p-8" style={{
            ...cssVars.split(';').reduce((acc, curr) => {
                const [k, v] = curr.split(':');
                if (k && v) acc[k.trim()] = v.trim();
                return acc;
            }, {} as any), '--font-display': typo.fontDisplay, '--font-sans': typo.fontSans
        }}>
            {/* Container: Full width mobile, split card on desktop */}
            <div className="w-full h-screen md:h-auto lg:max-w-6xl md:bg-white md:rounded-[32px] md:shadow-2xl overflow-hidden relative flex flex-col lg:flex-row md:min-h-[85vh] md:max-h-[900px]">

                {/* Left Side (Desktop) / Header (Mobile) */}
                <div
                    className="px-6 pt-12 pb-8 lg:p-16 lg:w-[45%] flex flex-col justify-end lg:justify-center relative z-10 shadow-[0_4px_32px_rgba(0,0,0,0.05)] lg:shadow-[32px_0_32px_rgba(0,0,0,0.02)]"
                    style={{ background: 'linear-gradient(160deg, var(--cream) 0%, var(--pink-pale) 40%, var(--cream-dark) 100%)' }}
                >
                    <div className="lg:max-w-sm">
                        <div
                            className="w-16 h-16 lg:w-20 lg:h-20 rounded-2xl flex items-center justify-center shadow-lg mb-6"
                            style={{ background: `linear-gradient(135deg, ${tenant.branding.primary_color}, ${tenant.branding.secondary_color})` }}
                        >
                            {tenant.branding.logo_url ? (
                                <img src={tenant.branding.logo_url} className="object-cover lg:w-20 lg:h-20 rounded-2xl" alt="Logo" />
                            ) : (
                                <span className="font-serif text-3xl text-white uppercase">{tenant.domain.charAt(0)}</span>
                            )}
                        </div>
                        <h1 className="font-serif text-3xl lg:text-5xl font-semibold text-charcoal mb-3 uppercase truncate">{tenant.name || tenant.domain.split('.')[0]}</h1>
                        <p className="text-sm lg:text-lg text-charcoal-light font-medium max-w-[280px] mb-2">
                            Agenda tu cita interactiva con <span className="font-semibold text-pink capitalize">{staffName}</span>
                        </p>
                        {staffPhoto && (
                            <div className="mt-4 flex items-center gap-3">
                                <div className="size-12 rounded-full overflow-hidden border-2 border-white shadow-soft">
                                    <img src={staffPhoto} alt={staffName} className="w-full h-full object-cover" />
                                </div>
                                <div>
                                    <p className="text-sm font-semibold text-charcoal capitalize">{staffName}</p>
                                    <p className="text-xs text-charcoal-light italic">Tu especialista</p>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Decorative elements for desktop */}
                    <div className="hidden lg:block absolute top-[10%] right-[10%] w-32 h-32 rounded-full bg-pink-light/30 blur-3xl pointer-events-none" />
                    <div className="hidden lg:block absolute bottom-[10%] left-[10%] w-48 h-48 rounded-full bg-coral-light/20 blur-3xl pointer-events-none" />
                </div>

                {/* Right Side (Desktop) / Wizard (Mobile) */}
                <div className="flex-1 bg-white flex flex-col pt-4 lg:pt-0">
                    <div className="flex-1 w-full max-w-xl mx-auto lg:p-4">
                        <div className="h-full lg:max-h-[800px] lg:h-[85vh] bg-white lg:border lg:border-cream-dark/40 lg:rounded-3xl lg:shadow-xl lg:mt-6 overflow-hidden flex flex-col">
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
        </div>
    );
}

