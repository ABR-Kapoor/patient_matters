'use client';

import { useRouter } from 'next/navigation';
import { X, ArrowUpRight } from 'lucide-react';
import { useState, useEffect } from 'react';
import { TranslatedText } from '@/app/components/TranslatedText';

interface ProfileCompletionBannerProps {
  percentage: number;
  missingFields: string[];
  onDismiss: () => void;
}

export default function ProfileCompletionBanner({
  percentage,
  missingFields,
  onDismiss,
}: ProfileCompletionBannerProps) {
  const router = useRouter();
  const [show, setShow] = useState(false);

  useEffect(() => {
    setTimeout(() => setShow(true), 500);
  }, []);

  const handleDismiss = () => {
    setShow(false);
    setTimeout(() => onDismiss(), 300);
  };

  const handleComplete = () => {
    router.push('/dashboard/profile?incomplete=true');
  };

  return (
    <div
      className={`transition-all duration-700 transform ${
        show ? 'translate-y-0 opacity-100' : '-translate-y-full opacity-0'
      }`}
    >
      <div className="bg-sage-50 border border-sage-200 p-5 rounded-3xl shadow-sm mb-8 relative overflow-hidden group">
        {/* Background dot pattern */}
        <div className="absolute inset-0 opacity-[0.08]" style={{ pointerEvents: 'none' }}>
          <div className="absolute inset-0" style={{
            backgroundImage: 'radial-gradient(circle, var(--forest-500) 1.2px, transparent 1.2px)',
            backgroundSize: '24px 24px'
          }}></div>
        </div>

        <div className="relative z-10 flex items-center justify-between">
          <div className="flex-1 flex items-center space-x-5">
            {/* Icon */}
            <div className="flex-shrink-0">
              <div className="w-14 h-14 bg-primary rounded-full flex items-center justify-center shadow-md">
                <ArrowUpRight className="w-7 h-7 text-white" />
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-bold text-forest-900 mb-0.5 font-display">
                <TranslatedText>Complete Your Profile</TranslatedText> ({percentage}%)
              </h3>
              <p className="text-sm text-forest-500 font-medium">
                {missingFields.length} <TranslatedText>fields remaining</TranslatedText>: <span className="text-forest-400">{missingFields.slice(0, 3).join(', ')}</span>
                {missingFields.length > 3 && <span className="text-forest-400"> +{missingFields.length - 3} <TranslatedText>more</TranslatedText></span>}
              </p>
            </div>

            {/* Action button */}
            <button
              onClick={handleComplete}
              className="flex-shrink-0 px-8 py-3 bg-primary text-white text-sm font-bold rounded-full hover:bg-primary-600 transition-all transform hover:scale-105 shadow-sm"
            >
              <TranslatedText>Complete Now</TranslatedText>
            </button>
          </div>

          {/* Dismiss button */}
          <button
            onClick={handleDismiss}
            className="flex-shrink-0 ml-6 p-2 hover:bg-black/5 rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-forest-400" />
          </button>
        </div>

        {/* Progress bar at the absolute bottom */}
        <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-sage-100">
          <div
            className="h-full bg-primary transition-all duration-1000 ease-out"
            style={{ width: `${percentage}%` }}
          ></div>
        </div>
      </div>
    </div>
  );
}
