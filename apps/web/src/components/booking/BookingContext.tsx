'use client';

import {
    createContext,
    useCallback,
    useContext,
    useMemo,
    useState,
    type ReactNode,
} from 'react';
import { calculateTotals } from '@nailflow/shared';
import type { BookingDraft, BookingStep, BookingTotalsView, PaymentMethod, Service } from '@/lib/types';

/**
 * State for the booking wizard.
 *
 * The draft holds what the client has chosen; totals are derived from it so
 * price and duration can never disagree with the selected services. They are a
 * *preview* — the API recomputes both from its own rows when the booking is
 * submitted.
 */

export const BOOKING_STEPS: BookingStep[] = [
    'personal',
    'service',
    'datetime',
    'inspiration',
    'summary',
    'payment',
    'confirmation',
];

interface BookingContextValue {
    step: BookingStep;
    stepIndex: number;
    stepCount: number;
    goTo: (step: BookingStep) => void;
    goNext: () => void;
    goBack: () => void;

    draft: BookingDraft;
    totals: BookingTotalsView;

    setClient: (fields: Partial<Pick<BookingDraft, 'clientName' | 'clientPhone' | 'clientEmail' | 'notes'>>) => void;
    toggleService: (service: Service) => void;
    setDate: (date: string | null) => void;
    setTime: (time: string | null) => void;
    setPaymentMethod: (method: PaymentMethod) => void;

    /** Files chosen locally, uploaded only once the client reaches the summary. */
    pendingFiles: File[];
    localPreviews: string[];
    setFiles: (files: File[]) => void;
    setUploadedImageUrls: (urls: string[]) => void;

    confirmedAppointmentId: string | null;
    confirmBooking: (appointmentId: string) => void;

    salonName: string;
}

const BookingContext = createContext<BookingContextValue | null>(null);

export interface BookingProviderProps {
    children: ReactNode;
    staffId: string;
    staffName: string;
    staffPhoto?: string;
    salonName: string;
    onStepChange?: (step: BookingStep) => void;
}

export function BookingProvider({
    children,
    staffId,
    staffName,
    staffPhoto,
    salonName,
    onStepChange,
}: BookingProviderProps) {
    const [step, setStep] = useState<BookingStep>('personal');
    const [pendingFiles, setPendingFiles] = useState<File[]>([]);
    const [localPreviews, setLocalPreviews] = useState<string[]>([]);
    const [confirmedAppointmentId, setConfirmedAppointmentId] = useState<string | null>(null);

    const [draft, setDraft] = useState<BookingDraft>({
        date: null,
        time: null,
        services: [],
        staffId,
        staffName,
        staffPhoto,
        clientName: '',
        clientPhone: '',
        clientEmail: '',
        imageUrls: [],
    });

    const goTo = useCallback(
        (next: BookingStep) => {
            setStep(next);
            onStepChange?.(next);
            // Each step is its own screen; start it from the top.
            window.scrollTo({ top: 0, behavior: 'smooth' });
        },
        [onStepChange]
    );

    const stepIndex = BOOKING_STEPS.indexOf(step);

    const goNext = useCallback(() => {
        const next = BOOKING_STEPS[BOOKING_STEPS.indexOf(step) + 1];
        if (next) goTo(next);
    }, [step, goTo]);

    const goBack = useCallback(() => {
        const previous = BOOKING_STEPS[BOOKING_STEPS.indexOf(step) - 1];
        if (previous) goTo(previous);
    }, [step, goTo]);

    const setClient = useCallback(
        (fields: Partial<BookingDraft>) => setDraft(current => ({ ...current, ...fields })),
        []
    );

    /**
     * Adding or removing a service changes how long the appointment runs, so any
     * time already picked may no longer fit. Clearing it sends the client back
     * through availability rather than letting them confirm a slot that is now
     * too short.
     */
    const toggleService = useCallback((service: Service) => {
        setDraft(current => {
            const selected = current.services.some(item => item.id === service.id);
            return {
                ...current,
                services: selected
                    ? current.services.filter(item => item.id !== service.id)
                    : [...current.services, service],
                time: null,
            };
        });
    }, []);

    const setDate = useCallback(
        (date: string | null) => setDraft(current => ({ ...current, date, time: null })),
        []
    );

    const setTime = useCallback(
        (time: string | null) => setDraft(current => ({ ...current, time })),
        []
    );

    const setPaymentMethod = useCallback(
        (paymentMethod: PaymentMethod) => setDraft(current => ({ ...current, paymentMethod })),
        []
    );

    const setFiles = useCallback((files: File[]) => {
        setPendingFiles(files);
        setLocalPreviews(previous => {
            // Object URLs are a per-document resource; release the old ones or
            // the tab holds every image the client ever previewed.
            previous.forEach(URL.revokeObjectURL);
            return files.map(file => URL.createObjectURL(file));
        });
    }, []);

    const setUploadedImageUrls = useCallback(
        (imageUrls: string[]) => setDraft(current => ({ ...current, imageUrls })),
        []
    );

    const confirmBooking = useCallback(
        (appointmentId: string) => {
            setConfirmedAppointmentId(appointmentId);
            goTo('confirmation');
        },
        [goTo]
    );

    const totals = useMemo<BookingTotalsView>(() => {
        const computed = calculateTotals(draft.services);
        return {
            price: computed.price,
            durationMinutes: computed.durationMinutes,
            requiredAdvance: computed.requiredAdvance,
        };
    }, [draft.services]);

    const value = useMemo<BookingContextValue>(
        () => ({
            step,
            stepIndex,
            stepCount: BOOKING_STEPS.length,
            goTo,
            goNext,
            goBack,
            draft,
            totals,
            setClient,
            toggleService,
            setDate,
            setTime,
            setPaymentMethod,
            pendingFiles,
            localPreviews,
            setFiles,
            setUploadedImageUrls,
            confirmedAppointmentId,
            confirmBooking,
            salonName,
        }),
        [
            step, stepIndex, goTo, goNext, goBack, draft, totals, setClient, toggleService,
            setDate, setTime, setPaymentMethod, pendingFiles, localPreviews, setFiles,
            setUploadedImageUrls, confirmedAppointmentId, confirmBooking, salonName,
        ]
    );

    return <BookingContext.Provider value={value}>{children}</BookingContext.Provider>;
}

export function useBooking(): BookingContextValue {
    const context = useContext(BookingContext);
    if (!context) {
        throw new Error('useBooking must be used inside a BookingProvider');
    }
    return context;
}
