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

import { BookingProvider, useBookingContext } from './BookingContext';

export interface BookingWizardProps {
    tenantId: string;
    staffId?: string;
    staffName?: string;
    staffPhoto?: string;
    salonName?: string;
    onStepChange?: (step: BookingStep) => void;
    initialStep?: BookingStep;
}

function BookingSteps() {
    const { 
        currentStep, 
        clientName, setClientName,
        clientPhone, setClientPhone,
        clientEmail, setClientEmail,
        goNext, goBack, navigate,
        staffName, staffPhoto,
        selectedService, setSelectedService,
        tenantId, staffId,
        selectedDate, setSelectedDate,
        selectedTime, setSelectedTime,
        pendingFiles, localPreviews, handleFilesChange,
        bookingData, handleBookingConfirmed,
        confirmedAppointmentId, salonName
    } = useBookingContext();

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
                    serviceId={selectedService?.id}
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
                    appointmentId={confirmedAppointmentId}
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
                    appointmentId={confirmedAppointmentId}
                    pendingFiles={pendingFiles}
                    tenantId={tenantId}
                    salonName={salonName}
                />
            )}
        </div>
    );
}

export default function BookingWizard(props: BookingWizardProps) {
    return (
        <BookingProvider {...props}>
            <BookingSteps />
        </BookingProvider>
    );
}

