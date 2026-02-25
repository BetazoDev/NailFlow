'use client';

import { useState, useMemo } from 'react';

interface CalendarStepProps {
    selectedDate: string | null;
    onSelect: (date: string) => void;
    onNext: () => void;
}

const MONTH_NAMES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const DAY_NAMES = ['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa'];

export default function CalendarStep({ selectedDate, onSelect, onNext }: CalendarStepProps) {
    const today = new Date();
    const [currentMonth, setCurrentMonth] = useState(today.getMonth());
    const [currentYear, setCurrentYear] = useState(today.getFullYear());

    const daysInMonth = useMemo(() => {
        const firstDay = new Date(currentYear, currentMonth, 1).getDay();
        const totalDays = new Date(currentYear, currentMonth + 1, 0).getDate();
        const days: (number | null)[] = [];

        // Pad start
        for (let i = 0; i < firstDay; i++) {
            days.push(null);
        }
        for (let i = 1; i <= totalDays; i++) {
            days.push(i);
        }
        return days;
    }, [currentMonth, currentYear]);

    const handlePrevMonth = () => {
        if (currentMonth === 0) {
            setCurrentMonth(11);
            setCurrentYear(currentYear - 1);
        } else {
            setCurrentMonth(currentMonth - 1);
        }
    };

    const handleNextMonth = () => {
        if (currentMonth === 11) {
            setCurrentMonth(0);
            setCurrentYear(currentYear + 1);
        } else {
            setCurrentMonth(currentMonth + 1);
        }
    };

    const isPastDate = (day: number) => {
        const d = new Date(currentYear, currentMonth, day);
        const t = new Date();
        t.setHours(0, 0, 0, 0);
        return d < t;
    };

    const isSunday = (day: number) => {
        return new Date(currentYear, currentMonth, day).getDay() === 0;
    };

    const isSelected = (day: number) => {
        const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        return selectedDate === dateStr;
    };

    const isToday = (day: number) => {
        return day === today.getDate() && currentMonth === today.getMonth() && currentYear === today.getFullYear();
    };

    const handleSelectDay = (day: number) => {
        if (isPastDate(day) || isSunday(day)) return;
        const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        onSelect(dateStr);
    };

    return (
        <div className="flex flex-col h-full animate-fade-in-up">
            <div className="px-6 pt-4 pb-2">
                <h2 className="font-serif text-2xl font-semibold text-charcoal mb-1">Elige una fecha</h2>
                <p className="text-sm text-nf-gray">Selecciona el día para tu cita</p>
            </div>

            {/* Month Navigation */}
            <div className="flex items-center justify-between px-6 py-4">
                <button onClick={handlePrevMonth} className="p-2 rounded-full hover:bg-cream-dark transition-colors">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
                </button>
                <span className="font-serif text-lg font-semibold text-charcoal">
                    {MONTH_NAMES[currentMonth]} {currentYear}
                </span>
                <button onClick={handleNextMonth} className="p-2 rounded-full hover:bg-cream-dark transition-colors">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg>
                </button>
            </div>

            {/* Day names */}
            <div className="grid grid-cols-7 gap-1 px-6 mb-2">
                {DAY_NAMES.map((d) => (
                    <div key={d} className="text-center text-xs font-semibold text-nf-gray uppercase tracking-wider py-1">
                        {d}
                    </div>
                ))}
            </div>

            {/* Calendar grid */}
            <div className="grid grid-cols-7 gap-1 px-6 flex-1">
                {daysInMonth.map((day, i) => {
                    if (day === null) return <div key={`empty-${i}`} />;
                    const past = isPastDate(day);
                    const sunday = isSunday(day);
                    const disabled = past || sunday;
                    const selected = isSelected(day);
                    const todayClass = isToday(day);

                    return (
                        <button
                            key={day}
                            onClick={() => handleSelectDay(day)}
                            disabled={disabled}
                            className={`
                aspect-square flex items-center justify-center rounded-xl text-sm font-medium
                transition-all duration-200 relative
                ${disabled ? 'text-gray-light cursor-not-allowed opacity-40' : 'cursor-pointer hover:bg-pink-pale'}
                ${selected ? 'text-white font-semibold shadow-md' : 'text-charcoal'}
                ${todayClass && !selected ? 'ring-2 ring-pink ring-offset-1' : ''}
              `}
                            style={selected ? { background: 'linear-gradient(135deg, var(--pink), var(--coral))' } : {}}
                        >
                            {day}
                        </button>
                    );
                })}
            </div>

            {/* Continue button (Mobile only) */}
            <div className="p-6 mt-auto lg:hidden">
                <button
                    onClick={onNext}
                    disabled={!selectedDate}
                    className="btn-gradient w-full py-4 rounded-2xl text-base"
                >
                    Ver turnos disponibles
                </button>
            </div>
        </div>
    );
}
