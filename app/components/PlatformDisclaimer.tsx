import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { useLanguage } from '@/app/contexts/LanguageContext';

export default function PlatformDisclaimer() {
  const { translate: t } = useLanguage();

  return (
    <div className="bg-sage-50 border border-sage-200 rounded-xl p-4 sm:p-5 my-6 flex items-start gap-3 sm:gap-4 shadow-sm">
      <div className="shrink-0 bg-white p-2 rounded-lg border border-sage-100 shadow-sm mt-0.5">
        <AlertTriangle className="w-5 h-5 text-forest-600" />
      </div>
      <div>
        <h4 className="font-semibold text-forest-900 text-sm sm:text-base mb-1">
          {t('AuraSutra Platform Disclaimer')}
        </h4>
        <p className="text-forest-800/80 text-xs sm:text-sm leading-relaxed">
          {t('AuraSutra is a practitioner directory that connects patients with independent professionals. We do not provide medical advice, diagnosis, or treatment. All medical decisions are between you and your chosen practitioner.')}
        </p>
        <p className="text-forest-900 font-medium text-xs sm:text-sm leading-relaxed mt-2 bg-red-50 inline-block px-2 py-1 rounded border border-red-100">
          <span className="text-red-600 font-bold mr-1">🚨 {t('Emergency:')}</span>
          {t('This platform is NOT for medical emergencies. Please call 112 or visit your nearest hospital immediately.')}
        </p>
      </div>
    </div>
  );
}
