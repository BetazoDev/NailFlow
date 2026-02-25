'use client';

import { useState } from 'react';
import { BookingStep, BookingData, Service } from '@/lib/types';
import ProgressBar from './ProgressBar';
import DateTimeStep from './DateTimeStep';
import ServiceStep from './ServiceStep';
import DetailsStep from './DetailsStep';
import PaymentStep from './PaymentStep';
import ConfirmationStep from './ConfirmationStep';

const STEPS: BookingStep[] = ['datetime', 'service', 'details', 'payment', 'confirmation'];

export default function BookingWizard() {
    const [currentStep, setCurrentStep] = useState<BookingStep>('datetime');

    // Booking state
    const [selectedDate, setSelectedDate] = useState<string | null>(null);
    const [selectedTime, setSelectedTime] = useState<string | null>(null);
    const [selectedService, setSelectedService] = useState<Service | null>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [notes, setNotes] = useState('');
    const [clientName, setClientName] = useState('');
    const [clientPhone, setClientPhone] = useState('');
    const [clientEmail, setClientEmail] = useState('');

    const goTo = (step: BookingStep) => setCurrentStep(step);
    const goNext = () => {
        const i = STEPS.indexOf(currentStep);
        if (i < STEPS.length - 1) setCurrentStep(STEPS[i + 1]);
    };
    const goBack = () => {
        const i = STEPS.indexOf(currentStep);
        if (i > 0) setCurrentStep(STEPS[i - 1]);
    };

    const bookingData: BookingData = {
        tenant_id: 'demo-tenant',
        date: selectedDate || '',
        time: selectedTime || '',
        service_id: selectedService?.id || '',
        service_name: selectedService?.name || '',
        service_price: selectedService?.estimated_price || 0,
        service_duration: selectedService?.duration_minutes || 0,
        client_name: clientName,
        client_phone: clientPhone,
        client_email: clientEmail || undefined,
        image_url: imagePreview || undefined,
        notes: notes || undefined,
    };

    return (
        <div className="h-full flex flex-col">
            {currentStep !== 'confirmation' && (
                <ProgressBar currentStep={currentStep} />
            )}

            <div className="flex-1 overflow-hidden">
                {currentStep === 'datetime' && (
                    <DateTimeStep
                        selectedDate={selectedDate}
                        selectedTime={selectedTime}
                        onDateSelect={setSelectedDate}
                        onTimeSelect={setSelectedTime}
                        onNext={goNext}
                    />
                )}
                {currentStep === 'service' && (
                    <ServiceStep
                        selectedServiceId={selectedService?.id || null}
                        onSelect={setSelectedService}
                        onNext={goNext}
                        onBack={goBack}
                    />
                )}
                {currentStep === 'details' && (
                    <DetailsStep
                        imagePreview={imagePreview}
                        notes={notes}
                        onImageChange={setImagePreview}
                        onNotesChange={setNotes}
                        name={clientName}
                        phone={clientPhone}
                        email={clientEmail}
                        onNameChange={setClientName}
                        onPhoneChange={setClientPhone}
                        onEmailChange={setClientEmail}
                        onNext={goNext}
                        onBack={goBack}
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
                    <ConfirmationStep booking={bookingData} />
                )}
            </div>
        </div>
    );
}
