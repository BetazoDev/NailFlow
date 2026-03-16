import { api } from '@/lib/api';
import BookingWidget from '@/components/booking/BookingWidget';
import { notFound } from 'next/navigation';
import { headers } from 'next/headers';

interface Props {
    params: {
        staffSlug: string;
    }
}

export const dynamic = 'force-dynamic';

export default async function StaffBookingPage({ params }: Props) {
    const headersList = headers();
    let domain = headersList.get('host') || 'demo.diabolicalservices.tech';
    if (domain.includes('localhost') || domain.includes('127.0.0.1')) {
        domain = 'demo.diabolicalservices.tech';
    }

    const tenant = await api.getTenant(domain);

    if (!tenant) {
        notFound();
    }

    // Resolve the staff member by slug
    const allStaff = await api.getStaff();
    const staffMember = allStaff.find(s => {
        const memberSlug = s.slug || s.name.toLowerCase().replace(/\s+/g, '-');
        return memberSlug === params.staffSlug;
    });

    const staffName = staffMember?.name || params.staffSlug.replace(/-/g, ' ');
    const staffId = staffMember?.id || 'staff-1';
    const staffPhoto = staffMember?.photo_url || undefined;

    return (
        <div className="min-h-screen bg-cream selection:bg-pink-pale selection:text-charcoal relative">
            <BookingWidget
                tenant={tenant}
                staffId={staffId}
                staffName={staffName}
                staffPhoto={staffPhoto}
                skipSplash={false}
            />
        </div>
    );
}
