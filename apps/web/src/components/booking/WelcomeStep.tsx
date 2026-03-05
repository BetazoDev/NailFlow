'use client';

import { Tenant } from '@/lib/types';

interface WelcomeStepProps {
    tenant: Tenant | null;
    onNext: () => void;
}

export default function WelcomeStep({ tenant, onNext }: WelcomeStepProps) {
    const salonName = tenant?.name || 'Ana Nails Studio';

    return (
        <div className="flex flex-col min-h-full animate-fade-in items-center justify-between py-12 px-6 bg-white">
            <div className="flex-1 flex flex-col items-center justify-center text-center">
                {/* Logo Section */}
                <div className="w-32 h-32 rounded-3xl overflow-hidden mb-8 shadow-xl rotate-3 flex items-center justify-center bg-gradient-to-br from-pink-light to-coral-light p-1">
                    <div className="w-full h-full rounded-[20px] bg-white flex items-center justify-center overflow-hidden">
                        {tenant?.branding?.logo_url ? (
                            <img src={tenant.branding.logo_url} alt={salonName} className="w-full h-full object-cover" />
                        ) : (
                            <span className="text-4xl font-serif font-bold text-pink">NF</span>
                        )}
                    </div>
                </div>

                <h1 className="font-serif text-4xl text-charcoal mb-4 tracking-tight">
                    Bienvenida a <br />
                    <span className="text-pink italic">{salonName}</span>
                </h1>

                <p className="text-nf-gray text-sm max-w-[280px] leading-relaxed mb-8">
                    Tu oasis de belleza y relax. Reserva tu próxima experiencia con nosotras de forma fácil y rápida.
                </p>

                <div className="w-12 h-0.5 bg-coral/30 rounded-full mb-12" />

                <div className="grid grid-cols-2 gap-8 w-full max-w-[300px] mb-8">
                    <div className="flex flex-col items-center">
                        <div className="w-10 h-10 rounded-full bg-pink-pale flex items-center justify-center mb-2">
                            <span className="text-pink">✨</span>
                        </div>
                        <span className="text-[10px] uppercase tracking-widest text-nf-gray font-medium">Diseños top</span>
                    </div>
                    <div className="flex flex-col items-center">
                        <div className="w-10 h-10 rounded-full bg-coral-light/20 flex items-center justify-center mb-2">
                            <span className="text-coral">🕐</span>
                        </div>
                        <span className="text-[10px] uppercase tracking-widest text-nf-gray font-medium">Citas rápidas</span>
                    </div>
                </div>
            </div>

            <button
                onClick={onNext}
                className="w-full py-5 rounded-full text-base font-serif flex items-center justify-center gap-2 transition-all duration-300 shadow-lg hover:shadow-xl hover:-translate-y-0.5 btn-gradient"
            >
                Comenzar Reserva
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="5" y1="12" x2="19" y2="12" />
                    <polyline points="12 5 19 12 12 19" />
                </svg>
            </button>
        </div>
    );
}
