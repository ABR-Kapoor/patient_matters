'use client';

import { useRouter } from 'next/navigation';
import { X, CheckCircle2, AlertCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { TranslatedText } from '@/app/components/TranslatedText';

interface ProfileCompletionModalProps {
  isOpen: boolean;
  percentage: number;
  missingFields: string[];
  userType: 'doctor' | 'clinic' | 'patient';
  onDismiss?: () => void; // Only for patients
}

export default function ProfileCompletionModal({
  isOpen,
  percentage,
  missingFields,
  userType,
  onDismiss,
}: ProfileCompletionModalProps) {
  const router = useRouter();
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => setShow(true), 100);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const canDismiss = userType === 'patient' && onDismiss;
  const isBlocking = userType === 'doctor' || userType === 'clinic';

  const handleCompleteProfile = () => {
    router.push('/dashboard/profile?incomplete=true');
  };

  const handleDismiss = () => {
    if (canDismiss && onDismiss) {
      setShow(false);
      setTimeout(() => onDismiss(), 300);
    }
  };

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 transition-all duration-300 ${
        show ? 'bg-black/60 backdrop-blur-sm' : 'bg-black/0'
      }`}
      onClick={canDismiss ? handleDismiss : undefined}
    >
      <div
        className={`relative max-w-md w-full bg-gradient-to-br from-white to-sage-50 rounded-3xl shadow-2xl border border-sage-200 overflow-hidden transition-all duration-500 ${
          show ? 'scale-100 opacity-100' : 'scale-95 opacity-0'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with gradient */}
        <div className="bg-gradient-to-r from-forest-700 to-forest-500 p-6 text-white relative overflow-hidden">
          <div className="absolute inset-0 bg-white/10 backdrop-blur-sm"></div>
          <div className="relative z-10">
            {canDismiss && (
              <button
                onClick={handleDismiss}
                className="absolute top-2 right-2 p-2 hover:bg-white/20 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            )}
            <div className="flex items-center space-x-3 mb-4">
              <AlertCircle className="w-8 h-8" />
              <h2 className="text-2xl font-black">
                <TranslatedText>{isBlocking ? 'Complete Your Profile' : 'Profile Incomplete'}</TranslatedText>
              </h2>
            </div>
            <p className="text-white/90 text-sm">
              <TranslatedText>{isBlocking
                ? 'Please complete your profile to access all features'
                : 'Complete your profile for a better experience'}</TranslatedText>
            </p>
          </div>
        </div>

        {/* Progress Circle */}
        <div className="flex justify-center -mt-12 mb-6 relative z-20">
          <div className="relative">
            <svg className="w-32 h-32 transform -rotate-90">
              <circle
                cx="64"
                cy="64"
                r="56"
                stroke="currentColor"
                strokeWidth="8"
                fill="none"
                className="text-sage-200"
              />
              <circle
                cx="64"
                cy="64"
                r="56"
                stroke="currentColor"
                strokeWidth="8"
                fill="none"
                strokeDasharray={`${2 * Math.PI * 56}`}
                strokeDashoffset={`${2 * Math.PI * 56 * (1 - percentage / 100)}`}
                className="text-primary-600 transition-all duration-1000"
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center bg-white rounded-full w-24 h-24 flex items-center justify-center shadow-lg">
                <div>
                  <div className="text-3xl font-black text-primary-600">{percentage}%</div>
                  <div className="text-xs text-forest-500"><TranslatedText>Complete</TranslatedText></div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Missing Fields */}
        <div className="px-6 pb-6">
          <h3 className="text-sm font-bold text-forest-700 mb-3"><TranslatedText>Missing Information</TranslatedText>:</h3>
          <div className="space-y-2 mb-6">
            {missingFields.map((field, index) => (
              <div
                key={index}
                className="flex items-center space-x-2 text-sm text-forest-600 bg-sage-50 p-3 rounded-xl"
              >
                <div className="w-5 h-5 rounded-full border-2 border-sage-300 flex items-center justify-center">
                  <div className="w-2 h-2 bg-sage-300 rounded-full"></div>
                </div>
                <span>{field}</span>
              </div>
            ))}
          </div>

          {/* Actions */}
          <div className="space-y-3">
            <button
              onClick={handleCompleteProfile}
              className="w-full py-3 bg-gradient-to-r from-forest-600 to-forest-500 text-white rounded-xl font-bold hover:shadow-lg transition-all transform hover:scale-105"
            >
              <TranslatedText>Complete Profile Now</TranslatedText>
            </button>
            {canDismiss && (
              <button
                onClick={handleDismiss}
                className="w-full py-3 bg-sage-100 text-forest-700 rounded-xl font-semibold hover:bg-sage-200 transition-all"
              >
                <TranslatedText>Remind Me Later</TranslatedText>
              </button>
            )}
          </div>

          {isBlocking && (
            <p className="text-xs text-center text-forest-500 mt-4">
              ⚠️ <TranslatedText>You must complete your profile to use the application</TranslatedText>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
