import { api } from '@/lib/api';
import BookingWidget from '@/components/booking/BookingWidget';
import { notFound } from 'next/navigation';
import { headers } from 'next/headers';

export default async function RootPage() {
  // Determine domain from headers or use default
  const headersList = headers();
  let domain = headersList.get('host') || 'demo.diabolicalservices.tech';
  
  if (domain.includes('localhost') || domain.includes('127.0.0.1')) {
    domain = 'demo.diabolicalservices.tech';
  }

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
