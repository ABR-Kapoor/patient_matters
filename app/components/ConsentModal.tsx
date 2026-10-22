import React from 'react';
import { ShieldAlert, Check } from 'lucide-react';
import { useLanguage } from '@/app/contexts/LanguageContext';

interface ConsentModalProps {
  onAccept: () => void;
  onDecline: () => void;
  isLoading?: boolean;
}

export default function ConsentModal({ onAccept, onDecline, isLoading }: ConsentModalProps) {
  const { translate: t } = useLanguage();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-forest-900/60 backdrop-blur-sm">
      <div className="bg-white rounded-[2rem] shadow-2xl max-w-lg w-full p-6 sm:p-8 relative">
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4 bg-sage-100">
          <ShieldAlert className="w-8 h-8 text-forest-600" />
        </div>
        
        <h2 className="text-xl sm:text-2xl font-display text-forest-900 text-center mb-6">
          {t('Teleconsultation Consent')}
        </h2>
        
        <div className="space-y-4 mb-8 text-sm text-forest-800 leading-relaxed bg-sage-50 p-5 rounded-2xl border border-sage-100 max-h-[40vh] overflow-y-auto">
          <p className="font-semibold text-forest-900">
            {t('Before proceeding, please read and confirm the following:')}
          </p>
          <ul className="space-y-3">
            <li className="flex items-start gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-forest-400 mt-1.5 shrink-0" />
              <span>{t('I understand that this is a teleconsultation and NOT a physical examination.')}</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-forest-400 mt-1.5 shrink-0" />
              <span>{t('I am NOT experiencing a medical emergency (e.g., severe chest pain, bleeding, unconsciousness).')}</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-forest-400 mt-1.5 shrink-0" />
              <span>{t('I consent to sharing my health information and past medical records with the chosen practitioner.')}</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-forest-400 mt-1.5 shrink-0" />
              <span>{t('I understand that the platform is a facilitator and is not liable for medical advice provided by the independent practitioner.')}</span>
            </li>
          </ul>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={onDecline}
            className="flex-1 py-3 px-4 text-sm font-bold bg-sage-100 text-forest-700 rounded-2xl hover:bg-sage-200 transition-all text-center"
            disabled={isLoading}
          >
            {t('Decline & Cancel')}
          </button>
          <button
            onClick={onAccept}
            className="flex-1 flex items-center justify-center gap-2 py-3 px-4 text-sm font-bold bg-forest-600 text-white rounded-2xl hover:bg-forest-700 transition-all disabled:opacity-50"
            disabled={isLoading}
          >
            {isLoading ? (
              <span className="spinner" />
            ) : (
              <>
                <Check className="w-4 h-4" />
                {t('I Agree & Continue')}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
