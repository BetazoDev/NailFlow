import { api } from '@/lib/api';
import BookingWidget from '@/components/booking/BookingWidget';
import { notFound } from 'next/navigation';

export default async function RootPage() {
  // Determine domain from headers or use default
  const domain = 'demo.diabolicalservices.tech';
  const tenant = await api.getTenant(domain);

  if (!tenant) {
    notFound();
  }

  const allStaff = await api.getStaff();
  const owner = allStaff.find(s => s.role === 'owner') || allStaff[0];

  return (
    <div className="min-h-screen bg-cream selection:bg-pink-pale selection:text-charcoal relative">
      <BookingWidget
        tenant={tenant}
        staffId={owner?.id}
        staffName={owner?.name}
        staffPhoto={owner?.photo_url}
        skipSplash={false}
      />
    </div>
  );
}
