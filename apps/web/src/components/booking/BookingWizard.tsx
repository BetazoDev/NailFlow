'use client';

import type { BookingStep } from '@/lib/types';
import { BookingProvider, useBooking } from './BookingContext';
import PersonalDataStep from './PersonalDataStep';
import ServiceStep from './ServiceStep';
import DateTimeStep from './DateTimeStep';
import ImageUploadStep from './ImageUploadStep';
import SummaryStep from './SummaryStep';
import PaymentStep from './PaymentStep';
import ConfirmationStep from './ConfirmationStep';

export interface BookingWizardProps {
    staffId: string;
    staffName: string;
    staffPhoto?: string;
    salonName: string;
    onStepChange?: (step: BookingStep) => void;
}

/**
 * Renders the current step. Each step reads what it needs from the booking
 * context, so adding a field no longer means threading a prop through every
 * screen in the flow.
 */
function CurrentStep() {
    const { step } = useBooking();

    switch (step) {
        case 'personal':
            return <PersonalDataStep />;
        case 'service':
            return <ServiceStep />;
        case 'datetime':
            return <DateTimeStep />;
        case 'inspiration':
            return <ImageUploadStep />;
        case 'summary':
            return <SummaryStep />;
        case 'payment':
            return <PaymentStep />;
        case 'confirmation':
            return <ConfirmationStep />;
    }
}

export default function BookingWizard(props: BookingWizardProps) {
    return (
        <BookingProvider {...props}>
            <div className="flex h-full flex-col bg-surface">
                <CurrentStep />
            </div>
        </BookingProvider>
    );
}
