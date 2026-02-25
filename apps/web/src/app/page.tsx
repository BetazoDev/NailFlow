import BookingWizard from '@/components/booking/BookingWizard';
import { api } from '@/lib/api';

export default async function BookingPage() {
  const tenant = await api.getTenant();

  return (
    <div className="min-h-screen bg-cream lg:flex lg:items-center lg:justify-center p-0 md:p-4 lg:p-8">
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
              style={{ background: 'linear-gradient(135deg, var(--pink), var(--coral))' }}
            >
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lg:w-10 lg:h-10">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
              </svg>
            </div>
            <h1 className="font-serif text-3xl lg:text-5xl font-semibold text-charcoal mb-3">{tenant.name}</h1>
            <p className="text-sm lg:text-lg text-charcoal-light font-medium max-w-[280px]">
              Reserva tu cita en línea, fácil y rápido.
            </p>
          </div>

          {/* Decorative elements for desktop */}
          <div className="hidden lg:block absolute top-[10%] right-[10%] w-32 h-32 rounded-full bg-pink-light/30 blur-3xl pointer-events-none" />
          <div className="hidden lg:block absolute bottom-[10%] left-[10%] w-48 h-48 rounded-full bg-coral-light/20 blur-3xl pointer-events-none" />
        </div>

        {/* Right Side (Desktop) / Wizard (Mobile) */}
        <div className="flex-1 bg-white flex flex-col pt-4 lg:pt-0">
          <div className="flex-1 w-full max-w-xl mx-auto lg:p-4">
            <div className="h-full lg:max-h-[800px] lg:h-[85vh] bg-white lg:border lg:border-cream-dark/40 lg:rounded-3xl lg:shadow-xl lg:mt-6 overflow-hidden flex flex-col">
              <BookingWizard />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
