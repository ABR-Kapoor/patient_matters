'use client';

import { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, X, Calendar as CalendarIcon } from 'lucide-react';
import { TranslatedText } from '@/app/components/TranslatedText';
import { formatDate } from '@/lib/formatDate';
import { useTranslation } from '@/app/hooks/useTranslation';

interface DatePickerProps {
  value: string;
  onChange: (date: string) => void;
  minDate?: string;
  maxDate?: string;
  placeholder?: string;
}

export function DatePicker({ value, onChange, minDate, maxDate, placeholder }: DatePickerProps) {
  const { text: defaultPlaceholder } = useTranslation('Select date');
  const { text: prevMonthLabel } = useTranslation('Previous month');
  const { text: nextMonthLabel } = useTranslation('Next month');
  const { text: closeLabel } = useTranslation('Close');
  const [isOpen, setIsOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'calendar' | 'years'>('calendar');
  const [displayMonth, setDisplayMonth] = useState<Date>(() => {
    if (value) return new Date(value + 'T00:00:00');
    return new Date();
  });

  const [selectedDate, setSelectedDate] = useState<string>(value);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSelectedDate(value);
    if (value) {
      setDisplayMonth(new Date(value + 'T00:00:00'));
    }
  }, [value]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setViewMode('calendar');
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const getDaysInMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  const getFirstDayOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1).getDay();

  const handlePrevMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    setDisplayMonth(new Date(displayMonth.getFullYear(), displayMonth.getMonth() - 1));
  };

  const handleNextMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    setDisplayMonth(new Date(displayMonth.getFullYear(), displayMonth.getMonth() + 1));
  };

  const handleDateClick = (day: number) => {
    const year = displayMonth.getFullYear();
    const month = String(displayMonth.getMonth() + 1).padStart(2, '0');
    const date = String(day).padStart(2, '0');
    const dateStr = `${year}-${month}-${date}`;

    if (minDate && dateStr < minDate) return;
    if (maxDate && dateStr > maxDate) return;

    setSelectedDate(dateStr);
    onChange(dateStr);
    setIsOpen(false);
  };

  const handleYearSelect = (year: number) => {
    setDisplayMonth(new Date(year, displayMonth.getMonth(), 1));
    setViewMode('calendar');
  };

  const daysInMonth = getDaysInMonth(displayMonth);
  const firstDay = getFirstDayOfMonth(displayMonth);
  const days: (number | null)[] = Array(firstDay).fill(null).concat(Array.from({ length: daysInMonth }, (_, i) => i + 1));

  const monthName = `${String(displayMonth.getMonth() + 1).padStart(2, '0')}/${displayMonth.getFullYear()}`;
  const displayValue = selectedDate
    ? formatDate(selectedDate + 'T00:00:00')
    : (placeholder ?? defaultPlaceholder);

  // Generate years for the selector (centered around display date)
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 120 }, (_, i) => currentYear - i);

  return (
    <div ref={containerRef} className="relative w-full">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-4 py-2.5 sm:px-6 sm:py-3.5 rounded-full bg-sage-50 border border-sage-200 text-forest-900 text-sm focus:border-forest-500 focus:ring-4 focus:ring-forest-500/10 transition-all duration-300 group"
      >
        <span className={selectedDate ? 'text-forest-900 font-medium' : 'text-forest-400'}>
          {displayValue}
        </span>
        <CalendarIcon className="w-4.5 h-4.5 text-forest-400 group-hover:text-forest-500 transition-colors" />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-3 z-[100] w-[min(280px,90vw)] bg-white rounded-[2rem] border border-sage-100 shadow-[0_20px_50px_rgba(10,46,26,0.12)] p-4 animate-fadeUp">
          {/* Header */}
          <div className="flex items-center justify-between mb-3">
            <button 
              type="button"
              onClick={() => setViewMode(viewMode === 'calendar' ? 'years' : 'calendar')}
              className="group flex items-center gap-1.5"
            >
              <h3 className="text-lg font-display font-black text-forest-900 hover:text-forest-600 transition-colors">
                {viewMode === 'calendar' ? monthName : <TranslatedText>Select Year</TranslatedText>}
              </h3>
            </button>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handlePrevMonth}
                className="p-1.5 rounded-full hover:bg-sage-50 text-forest-700 transition-colors"
                aria-label={prevMonthLabel}
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                type="button"
                onClick={handleNextMonth}
                className="p-1.5 rounded-full hover:bg-sage-50 text-forest-700 transition-colors"
                aria-label={nextMonthLabel}
              >
                <ChevronRight className="w-5 h-5" />
              </button>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-full hover:bg-sage-50 text-forest-700 transition-colors ml-1"
                aria-label={closeLabel}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {viewMode === 'calendar' ? (
            <>
              {/* Day Headers */}
              <div className="grid grid-cols-7 gap-1 mb-2">
                {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, i) => (
                  <div key={i} className="text-center text-[11px] font-bold text-forest-500 tracking-widest py-1">
                    <TranslatedText>{day}</TranslatedText>
                  </div>
                ))}
              </div>

              {/* Calendar Grid */}
              <div className="grid grid-cols-7 gap-y-1 gap-x-1">
                {days.map((day, idx) => {
                  if (day === null) {
                    return <div key={`empty-${idx}`} className="w-8 h-8" />;
                  }

                  const year = displayMonth.getFullYear();
                  const month = String(displayMonth.getMonth() + 1).padStart(2, '0');
                  const date = String(day).padStart(2, '0');
                  const dateStr = `${year}-${month}-${date}`;

                  const isSelected = selectedDate === dateStr;
                  const isDisabledFlag = !!((minDate && dateStr < minDate) || (maxDate && dateStr > maxDate));
                  const isToday = new Date().toDateString() === new Date(year, displayMonth.getMonth(), day).toDateString();

                  return (
                    <button
                      key={day}
                      type="button"
                      onClick={() => handleDateClick(day)}
                      disabled={isDisabledFlag}
                      className={`
                        w-8 h-8 text-xs transition-all duration-200 flex items-center justify-center rounded-full
                        ${isSelected
                          ? 'bg-white text-blue-500 font-bold ring-2 ring-blue-500/30'
                          : isDisabledFlag
                          ? 'text-sage-300 cursor-not-allowed'
                          : isToday
                          ? 'text-forest-900 font-bold bg-sage-50'
                          : 'text-forest-400 hover:bg-sage-50 hover:text-forest-900 font-medium'
                        }
                      `}
                    >
                      {day}
                    </button>
                  );
                })}
              </div>
            </>
          ) : (
            /* Year Grid */
            <div className="grid grid-cols-3 gap-2 h-[180px] overflow-y-auto pr-2 custom-scrollbar">
              {years.map((year) => (
                <button
                  key={year}
                  type="button"
                  onClick={() => handleYearSelect(year)}
                  className={`
                    py-2 rounded-xl text-sm font-medium transition-colors
                    ${displayMonth.getFullYear() === year 
                      ? 'bg-forest-500 text-white' 
                      : 'text-forest-600 hover:bg-sage-50'
                    }
                  `}
                >
                  {year}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
