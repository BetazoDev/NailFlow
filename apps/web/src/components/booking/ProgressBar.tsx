'use client';

import { BookingStep } from '@/lib/types';

interface ProgressBarProps {
    currentStep: BookingStep;
}

const STEPS: BookingStep[] = ['personal', 'service', 'datetime', 'inspiration', 'summary', 'payment', 'confirmation'];
const STEP_LABELS: Record<BookingStep, string> = {
    personal: 'Datos',
    service: 'Servicio',
    datetime: 'Fecha',
    inspiration: 'Fotos',
    summary: 'Resumen',
    payment: 'Pago',
    confirmation: '✓',
};

export default function ProgressBar({ currentStep }: ProgressBarProps) {
    const currentIndex = STEPS.indexOf(currentStep);

    return (
        <div className="flex items-center gap-1 px-6 py-4">
            {STEPS.map((step, i) => {
                const isActive = i === currentIndex;
                const isCompleted = i < currentIndex;
                return (
                    <div key={step} className="flex items-center flex-1">
                        <div className="flex flex-col items-center flex-1">
                            <div
                                className={`
                  w-full h-1.5 rounded-full transition-all duration-300
                  ${isCompleted ? 'bg-pink' : isActive ? 'bg-gradient-to-r from-pink to-coral' : 'bg-cream-dark'}
                `}
                                style={isActive ? { background: 'linear-gradient(90deg, var(--pink), var(--coral))' } : {}}
                            />
                            <span
                                className={`
                  text-[10px] mt-1.5 font-medium transition-colors duration-300
                  ${isActive ? 'text-charcoal' : isCompleted ? 'text-pink' : 'text-gray-light'}
                `}
                            >
                                {STEP_LABELS[step]}
                            </span>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
