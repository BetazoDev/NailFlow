import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { api } from '@/lib/api';
import { requestDomain } from '@/lib/server';
import BookingWidget from '@/components/booking/BookingWidget';

export const dynamic = 'force-dynamic';

interface Props {
    params: { staffSlug: string };
}

/** A staff member's personal booking link (spec §5): `domain.com/book/lidia`. */
async function resolve(staffSlug: string) {
    const domain = requestDomain();
    const tenant = await api.getTenant(domain);
    if (!tenant) return null;

    const staff = await api.getStaff(domain).catch(() => []);
    const member = staff.find(person => person.slug === staffSlug);

    return member ? { tenant, member } : null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const resolved = await resolve(params.staffSlug);
    if (!resolved) return { title: 'Reserva no disponible' };

    const { tenant, member } = resolved;
    return {
        title: `Reserva con ${member.name} · ${tenant.name ?? 'NailFlow'}`,
        description: member.bio ?? `Agenda tu cita con ${member.name}.`,
    };
}

export default async function StaffBookingPage({ params }: Props) {
    const resolved = await resolve(params.staffSlug);

    // An unknown slug is a 404, not a silent fallback to whoever happens to be
    // first — booking with the wrong person is worse than an honest error.
    if (!resolved) notFound();

    const { tenant, member } = resolved;

    return (
        <BookingWidget
            tenant={tenant}
            staffId={member.id}
            staffName={member.name}
            staffPhoto={member.photo_url ?? undefined}
            skipSplash
        />
    );
}
