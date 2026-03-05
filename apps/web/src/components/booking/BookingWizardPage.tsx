'use client';

import { useState, useEffect, useMemo } from 'react';
import { BookingStep, BookingData, Service, Tenant, Staff } from '@/lib/types';
import { api } from '@/lib/api';
import PersonalDataStep from './PersonalDataStep';
import ServiceStep from './ServiceStep';
import DateTimeStep from './DateTimeStep';
import ImageUploadStep from './ImageUploadStep';
import SummaryStep from './SummaryStep';
import PaymentStep from './PaymentStep';
import ConfirmationStep from './ConfirmationStep';

const STEPS: BookingStep[] = ['personal', 'service', 'datetime', 'inspiration', 'summary', 'payment', 'confirmation'];
const TENANT_DOMAIN = 'demo.nailflow.com';

export default function BookingWizardPage() {
    const [currentStep, setCurrentStep] = useState<BookingStep>('personal');
    const [tenant, setTenant] = useState<Tenant | null>(null);
    const [staff, setStaff] = useState<Staff[]>([]);

    const [clientName, setClientName] = useState('');
    const [clientPhone, setClientPhone] = useState('');
    const [clientEmail, setClientEmail] = useState('');
    const [selectedService, setSelectedService] = useState<Service | null>(null);
    const [selectedDate, setSelectedDate] = useState<string | null>(null);
    const [selectedTime, setSelectedTime] = useState<string | null>(null);
    const [imageUrls, setImageUrls] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function loadTenant() {
            try {
                const t = await api.getTenant(TENANT_DOMAIN);
                if (t) {
                    setTenant(t);
                    const s = await api.getStaff(t.id);
                    setStaff(s);
                }
            } catch (err) {
                console.error('Failed to load tenant:', err);
            } finally {
                setLoading(false);
            }
        }
        loadTenant();
    }, []);

    const navigate = (step: BookingStep) => setCurrentStep(step);
    const goNext = () => {
        const i = STEPS.indexOf(currentStep);
        if (i < STEPS.length - 1) navigate(STEPS[i + 1]);
    };
    const goBack = () => {
        const i = STEPS.indexOf(currentStep);
        if (i > 0) navigate(STEPS[i - 1]);
    };

    const primaryStaff = staff[0];

    const bookingData: BookingData = useMemo(() => {
        const data: any = {
            tenant_id: tenant?.id || 'demo',
            date: selectedDate || '',
            time: selectedTime || '',
            service_id: selectedService?.id || '',
            service_name: selectedService?.name || '',
            service_price: selectedService?.estimated_price || 0,
            service_duration: selectedService?.duration_minutes || 0,
            staff_id: primaryStaff?.id || 'staff-1',
            staff_name: primaryStaff?.name || 'Ana López',
            client_name: clientName,
            client_phone: clientPhone,
        };

        if (primaryStaff?.photo_url) data.staff_photo = primaryStaff.photo_url;
        if (clientEmail) data.client_email = clientEmail;
        if (imageUrls && imageUrls.length > 0) {
            data.image_urls = imageUrls;
            data.image_url = imageUrls[0];
        }

        return data as BookingData;
    }, [tenant, selectedDate, selectedTime, selectedService, primaryStaff, clientName, clientPhone, clientEmail, imageUrls]);

    if (loading) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-cream">
                <div className="w-12 h-12 border-4 border-pink-light border-t-pink rounded-full animate-spin mb-4" />
                <p className="text-nf-gray font-serif italic">Cargando experiencia...</p>
            </div>
        );
    }

    // Step labels for the progress indicator
    const stepLabels: Partial<Record<BookingStep, string>> = {
        personal: 'Tus Datos',
        service: 'Servicio',
        datetime: 'Fecha & Hora',
        inspiration: 'Inspiración',
        summary: 'Resumen',
        payment: 'Pago',
        confirmation: '¡Listo!',
    };
    const currentIndex = STEPS.indexOf(currentStep);

    return (
        <div className="min-h-screen flex flex-col" style={{ background: 'var(--cream)' }}>
            {/* Header bar with logo + progress */}
            {currentStep !== 'confirmation' && (
                <header className="sticky top-0 z-20 bg-white/95 backdrop-blur-md border-b border-cream-dark/50 px-6 h-16 flex items-center justify-between shadow-sm">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-xl flex items-center justify-center shadow bg-gradient-to-br from-pink to-coral">
                            {tenant?.branding?.logo_url ? (
                                <img src={tenant.branding.logo_url} alt="Logo" className="w-full h-full object-cover rounded-xl" />
                            ) : (
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                                </svg>
                            )}
                        </div>
                        <span className="font-serif font-bold text-lg text-charcoal">{tenant?.name || 'NailFlow'}</span>
                    </div>

                    {/* Progress dots */}
                    <div className="flex items-center gap-1.5 mx-auto">
                        {STEPS.filter(s => s !== 'confirmation').map((s, i) => {
                            const stepIdx = STEPS.indexOf(s);
                            const isActive = stepIdx === currentIndex;
                            const isCompleted = stepIdx < currentIndex;
                            return (
                                <div
                                    key={s}
                                    className="h-1.5 rounded-full transition-all duration-300"
                                    style={{
                                        width: isActive ? '20px' : '6px',
                                        background: isCompleted || isActive ? 'var(--pink)' : 'var(--cream-dark)',
                                    }}
                                />
                            );
                        })}
                    </div>

                    <div className="text-[10px] text-nf-gray font-medium w-24 text-right uppercase tracking-widest hidden sm:block">
                        {stepLabels[currentStep]}
                    </div>
                </header>
            )}

            {/* Booking wizard body */}
            <main className={`flex-1 w-full max-w-lg mx-auto ${currentStep === 'confirmation' ? 'px-0' : 'px-0 pb-8'}`}>
                <div className={`min-h-full bg-white ${currentStep !== 'confirmation' && 'shadow-xl rounded-b-3xl overflow-hidden'}`}>
                    {currentStep === 'personal' && (
                        <PersonalDataStep
                            name={clientName}
                            phone={clientPhone}
                            email={clientEmail}
                            onNameChange={setClientName}
                            onPhoneChange={setClientPhone}
                            onEmailChange={setClientEmail}
                            onNext={goNext}
                            staffName={primaryStaff?.name}
                            staffPhoto={primaryStaff?.photo_url}
                        />
                    )}
                    {currentStep === 'service' && (
                        <ServiceStep
                            selectedServiceId={selectedService?.id || null}
                            onSelect={(svc) => setSelectedService(svc)}
                            onNext={goNext}
                            onBack={goBack}
                            tenantId={tenant?.id}
                        />
                    )}
                    {currentStep === 'datetime' && (
                        <DateTimeStep
                            selectedDate={selectedDate}
                            selectedTime={selectedTime}
                            onDateSelect={(d) => { setSelectedDate(d); setSelectedTime(null); }}
                            onTimeSelect={setSelectedTime}
                            onNext={goNext}
                            onBack={goBack}
                            tenantId={tenant?.id}
                        />
                    )}
                    {currentStep === 'inspiration' && (
                        <ImageUploadStep
                            imageUrls={imageUrls}
                            onImagesChange={setImageUrls}
                            onNext={goNext}
                            onBack={goBack}
                            staffName={primaryStaff?.name}
                        />
                    )}
                    {currentStep === 'summary' && (
                        <SummaryStep
                            booking={bookingData}
                            onNext={goNext}
                            onBack={goBack}
                            onAddImage={() => navigate('inspiration')}
                        />
                    )}
                    {currentStep === 'payment' && (
                        <PaymentStep
                            booking={bookingData}
                            onNext={goNext}
                            onBack={goBack}
                        />
                    )}
                    {currentStep === 'confirmation' && (
                        <ConfirmationStep
                            booking={bookingData}
                            salonName={tenant?.name}
                        />
                    )}
                </div>
            </main>
        </div>
    );
}
