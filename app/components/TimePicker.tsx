'use client';

import { useState, useEffect, useRef } from 'react';
import { X, Clock } from 'lucide-react';
import { TranslatedText } from '@/app/components/TranslatedText';
import { useTranslation } from '@/app/hooks/useTranslation';

interface TimePickerProps {
  value: string;
  onChange: (time: string) => void;
}

export function TimePicker({ value, onChange }: TimePickerProps) {
  const { text: closeLabel } = useTranslation('Close');
  const [isOpen, setIsOpen] = useState(false);
  const [hour, setHour] = useState('09');
  const [minute, setMinute] = useState('00');
  const [period, setPeriod] = useState<'AM' | 'PM'>('AM');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (value) {
      const [h, m] = value.split(':');
      const hourNum = parseInt(h, 10);
      const periodVal = hourNum >= 12 ? 'PM' : 'AM';
      const display24h = hourNum >= 12 && hourNum !== 12 ? hourNum - 12 : hourNum || 12;
      setHour(display24h.toString().padStart(2, '0'));
      setMinute(m);
      setPeriod(periodVal);
    }
  }, [value]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const handleTimeChange = (h: string, m: string, p: 'AM' | 'PM') => {
    setHour(h);
    setMinute(m);
    setPeriod(p);

    let hour24 = parseInt(h, 10);
    if (p === 'PM' && hour24 !== 12) hour24 += 12;
    if (p === 'AM' && hour24 === 12) hour24 = 0;

    onChange(`${hour24.toString().padStart(2, '0')}:${m}`);
  };

  const hours = Array.from({ length: 12 }, (_, i) => (i + 1).toString().padStart(2, '0'));
  const minutes = Array.from({ length: 12 }, (_, i) => (i * 5).toString().padStart(2, '0'));
  const displayValue = `${hour}:${minute} ${period}`;

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-2.5 sm:px-6 sm:py-3.5 rounded-full bg-sage-50 border border-sage-200 text-forest-900 text-sm outline-none transition-all duration-300 focus:border-forest-500 focus:ring-4 focus:ring-forest-500/10 focus:bg-white text-left flex items-center justify-between group"
      >
        <span className={value ? 'text-forest-900 font-medium' : 'text-forest-400'}>
          {displayValue}
        </span>
        <Clock className="w-4 h-4 flex-shrink-0 text-forest-400 group-hover:text-forest-500 transition-colors" />
      </button>

      {isOpen && (
        <div className="absolute top-full mt-3 left-0 z-[100] bg-white rounded-[2rem] border border-sage-100 p-5 shadow-[0_20px_50px_rgba(10,46,26,0.12)] w-[min(280px,90vw)] animate-fadeUp">
          <div className="flex items-center justify-between mb-4">
            <div className="flex gap-1.5 p-1 bg-sage-50 rounded-full">
              <button
                type="button"
                onClick={() => handleTimeChange(hour, minute, 'AM')}
                className={`px-3 py-1 rounded-full text-[10px] font-bold tracking-wider transition-all ${
                  period === 'AM'
                    ? 'bg-forest-500 text-white shadow-sm'
                    : 'text-forest-600 hover:bg-sage-100'
                }`}
              >
                <TranslatedText>AM</TranslatedText>
              </button>
              <button
                type="button"
                onClick={() => handleTimeChange(hour, minute, 'PM')}
                className={`px-3 py-1 rounded-full text-[10px] font-bold tracking-wider transition-all ${
                  period === 'PM'
                    ? 'bg-forest-500 text-white shadow-sm'
                    : 'text-forest-600 hover:bg-sage-100'
                }`}
              >
                <TranslatedText>PM</TranslatedText>
              </button>
            </div>
            <div className="flex items-center gap-2.5">
              <div className="text-lg font-display font-black text-forest-900">{hour}:{minute}</div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-full hover:bg-sage-50 text-forest-400 hover:text-forest-700 transition-colors"
                aria-label={closeLabel}
              >
                <X className="w-4.5 h-4.5" />
              </button>
            </div>
          </div>

          {/* Time Grid with Scrolling */}
          <div className="grid grid-cols-2 gap-3">
            {/* Hours Column */}
            <div>
              <div className="text-[10px] font-bold text-forest-500 tracking-widest text-center mb-2"><TranslatedText>HOUR</TranslatedText></div>
              <div className="flex flex-col gap-1 h-[200px] overflow-y-auto pr-1 custom-scrollbar">
                {hours.map((h) => (
                  <button
                    key={h}
                    type="button"
                    onClick={() => handleTimeChange(h, minute, period)}
                    className={`w-full py-2 rounded-xl text-sm transition-all duration-200 flex items-center justify-center ${
                      hour === h
                        ? 'bg-white text-blue-500 font-bold ring-2 ring-blue-500/30'
                        : 'text-forest-400 hover:bg-sage-50 hover:text-forest-900 font-medium'
                    }`}
                  >
                    {h}
                  </button>
                ))}
              </div>
            </div>

            {/* Minutes Column */}
            <div>
              <div className="text-[10px] font-bold text-forest-500 tracking-widest text-center mb-2"><TranslatedText>MIN</TranslatedText></div>
              <div className="flex flex-col gap-1 h-[200px] overflow-y-auto pr-1 custom-scrollbar">
                {minutes.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => handleTimeChange(hour, m, period)}
                    className={`w-full py-2 rounded-xl text-sm transition-all duration-200 flex items-center justify-center ${
                      minute === m
                        ? 'bg-white text-blue-500 font-bold ring-2 ring-blue-500/30'
                        : 'text-forest-400 hover:bg-sage-50 hover:text-forest-900 font-medium'
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
