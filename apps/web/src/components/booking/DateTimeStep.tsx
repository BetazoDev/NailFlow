'use client';

import CalendarStep from './CalendarStep';
import TimeSlotStep from './TimeSlotStep';

interface DateTimeStepProps {
    selectedDate: string | null;
    selectedTime: string | null;
    onDateSelect: (date: string) => void;
    onTimeSelect: (time: string) => void;
    onNext: () => void;
}

export default function DateTimeStep({ selectedDate, selectedTime, onDateSelect, onTimeSelect, onNext }: DateTimeStepProps) {
    return (
        <div className="flex flex-col lg:flex-row h-full">
            {/* Left side: Calendar */}
            <div className="flex-1 lg:border-r lg:border-cream-dark/50 flex flex-col h-full lg:overflow-y-auto custom-scrollbar">
                <CalendarStep
                    selectedDate={selectedDate}
                    onSelect={onDateSelect}
                    onNext={() => { }} // Disabled internal next, handled by wrapper 
                />
            </div>

            {/* Right side: Time slots (only visible if date is selected or on desktop) */}
            <div className={`flex-1 flex flex-col h-full bg-cream/30 lg:bg-transparent transition-opacity duration-300 ${!selectedDate && 'opacity-50 pointer-events-none hidden lg:flex'}`}>
                {selectedDate ? (
                    <TimeSlotStep
                        selectedDate={selectedDate}
                        selectedTime={selectedTime}
                        onSelect={onTimeSelect}
                        onBack={() => onDateSelect('')} // Back button clears date on mobile
                        onNext={onNext}
                    />
                ) : (
                    <div className="hidden lg:flex flex-col items-center justify-center h-full text-nf-gray">
                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="mb-4 opacity-50"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                        <p>Selecciona una fecha primero</p>
                    </div>
                )}
            </div>
        </div>
    );
}
