import { api } from '@/lib/api';
import { notFound } from 'next/navigation';
import BookingWidget from '@/components/booking/BookingWidget';

interface Props {
    params: {
        domain: string;
    }
}

export async function generateStaticParams() {
    return [{ domain: 'demo' }];
}

export default async function TenantLandingPage({ params }: Props) {
    const tenant = await api.getTenant(params.domain);

    if (!tenant) {
        notFound();
    }

    return (
        <div className="min-h-screen bg-cream selection:bg-pink-pale selection:text-charcoal relative">
            <BookingWidget tenant={tenant} />
        </div>
    );
}
