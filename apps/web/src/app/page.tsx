import { notFound } from 'next/navigation';
import { api } from '@/lib/api';
import { requestDomain } from '@/lib/server';
import BookingWidget from '@/components/booking/BookingWidget';

export const dynamic = 'force-dynamic';

/**
 * The salon's public booking page.
 *
 * Which salon this is comes from the request's host, so one deployment serves
 * every tenant's own domain without a per-tenant route.
 */
export default async function BookingPage() {
    const domain = requestDomain();
    const tenant = await api.getTenant(domain);

    if (!tenant) notFound();

    const staff = await api.getStaff(domain).catch(() => []);
    const host = staff.find(member => member.role === 'owner') ?? staff[0];

    // No bookable staff means no agenda to show. Say so rather than rendering a
    // wizard that cannot complete.
    if (!host) {
        return (
            <main className="grid min-h-dvh place-items-center bg-surface px-6 text-center">
                <div>
                    <h1 className="mb-3 font-display text-3xl text-text-strong">
                        {tenant.name ?? 'Este salón'} aún no está listo
                    </h1>
                    <p className="max-w-sm text-sm text-text-muted">
                        Todavía no hay especialistas dados de alta, así que no podemos abrir la
                        agenda. Vuelve pronto.
                    </p>
                </div>
            </main>
        );
    }

    return (
        <BookingWidget
            tenant={tenant}
            staffId={host.id}
            staffName={host.name}
            staffPhoto={host.photo_url ?? undefined}
        />
    );
}
