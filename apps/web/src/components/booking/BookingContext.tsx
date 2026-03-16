'use client';

import React, { createContext, useContext, useState, useMemo, ReactNode } from 'react';
import { BookingStep, BookingData, Service } from '@/lib/types';

const STEPS: BookingStep[] = ['personal', 'service', 'datetime', 'inspiration', 'summary', 'payment', 'confirmation'];

interface BookingContextType {
    currentStep: BookingStep;
    setCurrentStep: (step: BookingStep) => void;
    clientName: string;
    setClientName: (name: string) => void;
    clientPhone: string;
    setClientPhone: (phone: string) => void;
    clientEmail: string;
    setClientEmail: (email: string) => void;
    selectedService: Service | null;
    setSelectedService: (service: Service | null) => void;
    selectedDate: string | null;
    setSelectedDate: (date: string | null) => void;
    selectedTime: string | null;
    setSelectedTime: (time: string | null) => void;
    pendingFiles: File[];
    localPreviews: string[];
    handleFilesChange: (files: File[], previews: string[]) => void;
    uploadedImageUrls: string[];
    setUploadedImageUrls: (urls: string[]) => void;
    confirmedAppointmentId: string | null;
    setConfirmedAppointmentId: (id: string | null) => void;
    tenantId: string;
    staffId: string;
    staffName: string;
    staffPhoto?: string;
    salonName: string;
    bookingData: BookingData;
    goNext: () => void;
    goBack: () => void;
    navigate: (step: BookingStep) => void;
    handleBookingConfirmed: (appointmentId: string, cdnUrls?: string[]) => void;
}

const BookingContext = createContext<BookingContextType | undefined>(undefined);

export function BookingProvider({
    children,
    tenantId,
    staffId = 'staff-1',
    staffName = 'Ana López',
    staffPhoto,
    salonName = 'Ana Nails Studio',
    initialStep = 'personal',
    onStepChange,
}: {
    children: ReactNode;
    tenantId: string;
    staffId?: string;
    staffName?: string;
    staffPhoto?: string;
    salonName?: string;
    initialStep?: BookingStep;
    onStepChange?: (step: BookingStep) => void;
}) {
    const [currentStep, setCurrentStep] = useState<BookingStep>(initialStep);

    // Booking state
    const [clientName, setClientName] = useState('');
    const [clientPhone, setClientPhone] = useState('');
    const [clientEmail, setClientEmail] = useState('');
    const [selectedService, setSelectedService] = useState<Service | null>(null);
    const [selectedDate, setSelectedDate] = useState<string | null>(null);
    const [selectedTime, setSelectedTime] = useState<string | null>(null);

    // Image state
    const [pendingFiles, setPendingFiles] = useState<File[]>([]);
    const [localPreviews, setLocalPreviews] = useState<string[]>([]);
    const [uploadedImageUrls, setUploadedImageUrls] = useState<string[]>([]);
    const [confirmedAppointmentId, setConfirmedAppointmentId] = useState<string | null>(null);

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

    const handleBookingConfirmed = (appointmentId: string, cdnUrls?: string[]) => {
        if (cdnUrls) setUploadedImageUrls(cdnUrls);
        setConfirmedAppointmentId(appointmentId);
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
            service_required_advance: selectedService?.required_advance || 0,
            staff_id: staffId || 'staff-1',
            staff_name: staffName,
            client_name: clientName,
            client_phone: clientPhone,
        };

        if (staffPhoto) data.staff_photo = staffPhoto;
        if (clientEmail) data.client_email = clientEmail;

        if (uploadedImageUrls.length > 0) {
            data.image_urls = uploadedImageUrls;
            data.image_url = uploadedImageUrls[0];
        }

        return data as BookingData;
    }, [tenantId, selectedDate, selectedTime, selectedService, staffId, staffName, staffPhoto, clientName, clientPhone, clientEmail, uploadedImageUrls]);

    const value = {
        currentStep, setCurrentStep,
        clientName, setClientName,
        clientPhone, setClientPhone,
        clientEmail, setClientEmail,
        selectedService, setSelectedService,
        selectedDate, setSelectedDate,
        selectedTime, setSelectedTime,
        pendingFiles, localPreviews, handleFilesChange,
        uploadedImageUrls, setUploadedImageUrls,
        confirmedAppointmentId, setConfirmedAppointmentId,
        tenantId, staffId, staffName, staffPhoto, salonName,
        bookingData, goNext, goBack, navigate, handleBookingConfirmed
    };

    return <BookingContext.Provider value={value}>{children}</BookingContext.Provider>;
}

export function useBookingContext() {
    const context = useContext(BookingContext);
    if (!context) {
        throw new Error('useBookingContext must be used within a BookingProvider');
    }
    return context;
}
