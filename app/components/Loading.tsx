'use client';

import { TranslatedText } from '@/app/components/TranslatedText';

export default function Loading() {
  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-white/50 backdrop-blur-[1px]">
      <div className="flex flex-col items-center justify-center gap-1 p-4">
        {/* Heartbeat ECG Animation */}
        <div className="relative w-48 h-20 flex items-center justify-center">
          <svg
            viewBox="0 0 200 100"
            className="w-full h-full stroke-primary/40"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path
              d="M 0 50 L 40 50 L 50 50 L 55 40 L 60 50 L 65 50 L 70 20 L 75 80 L 80 50 L 90 50 L 100 30 L 110 50 L 200 50"
              strokeWidth="3"
            />
            <path
              d="M 0 50 L 40 50 L 50 50 L 55 40 L 60 50 L 65 50 L 70 20 L 75 80 L 80 50 L 90 50 L 100 30 L 110 50 L 200 50"
              stroke="var(--primary)"
              strokeWidth="3.5"
              className="ecg-path"
            />
          </svg>
        </div>

        <div className="flex flex-col items-center gap-1.5">
          <p className="text-[10px] text-primary font-display font-bold italic tracking-[0.2em] uppercase opacity-60">
            <TranslatedText>Loading</TranslatedText>
          </p>
        </div>
      </div>
    </div>
  );
}
