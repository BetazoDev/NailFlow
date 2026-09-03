'use client';

import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { MONTH_NAMES, WEEKDAYS } from '@/lib/constants';
import type { DaySchedule } from '@/lib/types';

interface CalendarStepProps {
    selectedDate: string | null;
    onSelect: (date: string) => void;
}

const DAY_NAMES = WEEKDAYS.map(day => day.short);

/** Local YYYY-MM-DD, avoiding the UTC shift that `toISOString()` introduces. */
function toDateKey(year: number, month: number, day: number): string {
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export default function CalendarStep({ selectedDate, onSelect }: CalendarStepProps) {
    const today = useMemo(() => new Date(), []);
    const [currentMonth, setCurrentMonth] = useState(today.getMonth());
    const [currentYear, setCurrentYear] = useState(today.getFullYear());
    const [schedule, setSchedule] = useState<DaySchedule[]>([]);

    useEffect(() => {
        let cancelled = false;
        api.getTenant()
            .then(tenant => {
                if (!cancelled && tenant?.settings?.weekly_schedule) {
                    setSchedule(tenant.settings.weekly_schedule);
                }
            })
            .catch(() => {
                // Without a schedule the calendar falls back to "closed on
                // Sundays", which beats blocking the whole month.
            });
        return () => {
            cancelled = true;
        };
    }, []);

    const daysInMonth = useMemo(() => {
        const firstDay = new Date(currentYear, currentMonth, 1).getDay(); // 0=Sun..6=Sat
        const mondayOffset = (firstDay + 6) % 7;
        const totalDays = new Date(currentYear, currentMonth + 1, 0).getDate();
        const days: (number | null)[] = [];
        for (let i = 0; i < mondayOffset; i++) days.push(null);
        for (let i = 1; i <= totalDays; i++) days.push(i);
        return days;
    }, [currentMonth, currentYear]);

    const handlePrevMonth = () => {
        if (currentMonth === 0) { setCurrentMonth(11); setCurrentYear(y => y - 1); }
        else setCurrentMonth(m => m - 1);
    };
    const handleNextMonth = () => {
        if (currentMonth === 11) { setCurrentMonth(0); setCurrentYear(y => y + 1); }
        else setCurrentMonth(m => m + 1);
    };

    const isPastDate = (day: number) => {
        const d = new Date(currentYear, currentMonth, day);
        const t = new Date(); t.setHours(0, 0, 0, 0);
        return d < t;
    };

    const isDayDisabled = (day: number) => {
        const d = new Date(currentYear, currentMonth, day);
        const dayOfWeek = d.getDay(); // 0=Sun
        
        // If we have a schedule, check it
        if (schedule.length > 0) {
            const dayInfo = schedule.find(s => s.day === dayOfWeek);
            return dayInfo ? !dayInfo.active : false;
        }

        // Fallback: Default to Sunday closed if no schedule
        return dayOfWeek === 0;
    };

    const isSelected = (day: number) => {
        return selectedDate === toDateKey(currentYear, currentMonth, day);
    };

    const isToday = (day: number) =>
        day === today.getDate() && currentMonth === today.getMonth() && currentYear === today.getFullYear();

    const handleSelectDay = (day: number) => {
        if (isPastDate(day) || isDayDisabled(day)) return;
        onSelect(toDateKey(currentYear, currentMonth, day));
    };

    return (
        <div className="animate-fade-in bg-white rounded-[2.5rem] p-8 shadow-xl border border-cream-dark/30">
            {/* Month Navigation */}
            <div className="flex items-center justify-between mb-8">
                <h2 className="font-serif text-2xl font-bold text-charcoal">
                    {MONTH_NAMES[currentMonth]} <span className="text-pink font-normal">{currentYear}</span>
                </h2>
                <div className="flex gap-2">
                    <button
                        onClick={handlePrevMonth}
                        aria-label="Mes anterior"
                        className="w-10 h-10 rounded-full bg-cream/50 flex items-center justify-center hover:bg-pink-pale hover:text-pink transition-all border border-cream-dark/20 text-nf-gray shadow-sm"
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
                    </button>
                    <button
                        onClick={handleNextMonth}
                        aria-label="Mes siguiente"
                        className="w-10 h-10 rounded-full bg-cream/50 flex items-center justify-center hover:bg-pink-pale hover:text-pink transition-all border border-cream-dark/20 text-nf-gray shadow-sm"
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg>
                    </button>
                </div>
            </div>

            {/* Day names */}
            <div className="grid grid-cols-7 gap-2 mb-4">
                {DAY_NAMES.map((d) => (
                    <div key={d} className="text-center text-[10px] font-bold text-nf-gray uppercase tracking-widest py-1 opacity-50">
                        {d}
                    </div>
                ))}
            </div>

            {/* Calendar grid */}
            <div className="grid grid-cols-7 gap-2">
                {daysInMonth.map((day, i) => {
                    if (day === null) return <div key={`empty-${i}`} className="aspect-square" />;
                    const past = isPastDate(day);
                    const disabled = past || isDayDisabled(day);
                    const selected = isSelected(day);
                    const todayDay = isToday(day);

                    return (
                        <button
                            key={day}
                            onClick={() => handleSelectDay(day)}
                            disabled={disabled}
                            aria-pressed={selected}
                            aria-label={`${day} de ${MONTH_NAMES[currentMonth]}`}
                            className={`
                                relative aspect-square flex items-center justify-center rounded-2xl text-sm font-bold
                                transition-all duration-300 transform
                                ${disabled
                                    ? 'text-nf-gray/20 cursor-not-allowed'
                                    : 'cursor-pointer hover:bg-pink-pale hover:text-pink hover:scale-110'}
                                ${selected
                                    ? 'bg-charcoal text-white shadow-lg scale-110 z-10'
                                    : todayDay
                                        ? 'text-pink border-2 border-pink-light'
                                        : 'text-charcoal'}
                            `}
                        >
                            {day}
                            {todayDay && !selected && (
                                <div className="absolute bottom-1.5 w-1 h-1 rounded-full bg-pink" />
                            )}
                            {selected && (
                                <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-pink border-2 border-white flex items-center justify-center animate-scale-in">
                                    <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                                </div>
                            )}
                        </button>
                    );
                })}
            </div>

            <div className="mt-8 flex gap-4 justify-center">
                <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-pink-light border border-pink" />
                    <span className="text-[10px] font-bold text-nf-gray uppercase tracking-wider">Hoy</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-charcoal" />
                    <span className="text-[10px] font-bold text-nf-gray uppercase tracking-wider">Tu cita</span>
                </div>
            </div>
        </div>
    );
}
