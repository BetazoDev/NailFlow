'use client';

import { useState, useMemo } from 'react';
import { BookingStep, BookingData, Service } from '@/lib/types';
import PersonalDataStep from './PersonalDataStep';
import ServiceStep from './ServiceStep';
import DateTimeStep from './DateTimeStep';
import ImageUploadStep from './ImageUploadStep';
import SummaryStep from './SummaryStep';
import PaymentStep from './PaymentStep';
import ConfirmationStep from './ConfirmationStep';

const STEPS: BookingStep[] = ['personal', 'service', 'datetime', 'inspiration', 'summary', 'payment', 'confirmation'];

interface BookingWizardProps {
    tenantId: string;
    staffId?: string;
    staffName?: string;
    staffPhoto?: string;
    salonName?: string;
    onStepChange?: (step: BookingStep) => void;
    initialStep?: BookingStep;
}

export default function BookingWizard({
    tenantId,
    staffId = 'staff-1',
    staffName = 'Ana López',
    staffPhoto,
    salonName = 'Ana Nails Studio',
    onStepChange,
    initialStep = 'personal',
}: BookingWizardProps) {
    const [currentStep, setCurrentStep] = useState<BookingStep>(initialStep);

    // Booking state
    const [clientName, setClientName] = useState('');
    const [clientPhone, setClientPhone] = useState('');
    const [clientEmail, setClientEmail] = useState('');
    const [selectedService, setSelectedService] = useState<Service | null>(null);
    const [selectedDate, setSelectedDate] = useState<string | null>(null);
    const [selectedTime, setSelectedTime] = useState<string | null>(null);

    // Image state: local Files + blob URLs for preview
    const [pendingFiles, setPendingFiles] = useState<File[]>([]);
    const [localPreviews, setLocalPreviews] = useState<string[]>([]);

    // CDN-uploaded URLs — populated only after successful booking
    const [uploadedImageUrls, setUploadedImageUrls] = useState<string[]>([]);

    const navigate = (step: BookingStep) => {
        setCurrentStep(step);
        onStepChange?.(step);
    };

    const goNext = () => {
        const i = STEPS.indexOf(currentStep);
        if (i < STEPS.length - 1) navigate(STEPS[i + 1]);
    };
    const goBack = () => {
        const i = STEPS.indexOf(currentStep);
        if (i > 0) navigate(STEPS[i - 1]);
    };

    const handleFilesChange = (files: File[], previews: string[]) => {
        setPendingFiles(files);
        setLocalPreviews(previews);
    };

    const handleBookingConfirmed = (cdnUrls: string[]) => {
        setUploadedImageUrls(cdnUrls);
        goNext();
    };

    const bookingData: BookingData = useMemo(() => {
        const data: any = {
            tenant_id: tenantId,
            date: selectedDate || '',
            time: selectedTime || '',
            service_id: selectedService?.id || '',
            service_name: selectedService?.name || '',
            service_price: selectedService?.estimated_price || 0,
            service_duration: selectedService?.duration_minutes || 0,
            staff_id: staffId || 'staff-1',
            staff_name: staffName,
            client_name: clientName,
            client_phone: clientPhone,
        };

        if (staffPhoto) data.staff_photo = staffPhoto;
        if (clientEmail) data.client_email = clientEmail;

        // After booking is confirmed, we have CDN URLs
        if (uploadedImageUrls.length > 0) {
            data.image_urls = uploadedImageUrls;
            data.image_url = uploadedImageUrls[0];
        }

        return data as BookingData;
    }, [tenantId, selectedDate, selectedTime, selectedService, staffId, staffName, staffPhoto, clientName, clientPhone, clientEmail, uploadedImageUrls]);

    return (
        <div className="flex flex-col h-full" style={{ background: 'var(--cream)' }}>
            {currentStep === 'personal' && (
                <PersonalDataStep
                    name={clientName}
                    phone={clientPhone}
                    email={clientEmail}
                    onNameChange={setClientName}
                    onPhoneChange={setClientPhone}
                    onEmailChange={setClientEmail}
                    onNext={goNext}
                    staffName={staffName}
                    staffPhoto={staffPhoto}
                />
            )}
            {currentStep === 'service' && (
                <ServiceStep
                    selectedServiceId={selectedService?.id || null}
                    onSelect={(svc) => setSelectedService(svc)}
                    onNext={goNext}
                    onBack={goBack}
                    tenantId={tenantId}
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
                    tenantId={tenantId}
                    staffId={staffId}
                />
            )}
            {currentStep === 'inspiration' && (
                <ImageUploadStep
                    pendingFiles={pendingFiles}
                    localPreviews={localPreviews}
                    onFilesChange={handleFilesChange}
                    onNext={goNext}
                    onBack={goBack}
                    staffName={staffName}
                    tenantId={tenantId}
                />
            )}
            {currentStep === 'summary' && (
                <SummaryStep
                    booking={bookingData}
                    localPreviews={localPreviews}
                    onNext={goNext}
                    onBack={goBack}
                    onAddImage={() => navigate('inspiration')}
                />
            )}
            {currentStep === 'payment' && (
                <PaymentStep
                    booking={bookingData}
                    pendingFiles={pendingFiles}
                    tenantId={tenantId}
                    onBookingConfirmed={handleBookingConfirmed}
                    onBack={goBack}
                />
            )}
            {currentStep === 'confirmation' && (
                <ConfirmationStep
                    booking={bookingData}
                    salonName={salonName}
                />
            )}
        </div>
    );
}
