'use client';

import React from 'react';
import { useLanguage } from '@/app/contexts/LanguageContext';
import { Globe } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/app/components/CustomSelect';

const languageNames: Record<string, string> = {
  en: 'English',
  es: 'Español',
  fr: 'Français',
  de: 'Deutsch',
  hi: 'Hindi',
  zh: '中文',
  ar: 'العربية',
  pt: 'Português',
  ja: '日本語',
  bn: 'বাংলা',
  te: 'తెలుగు',
  mr: 'मराठी',
  ta: 'தமிழ்',
  gu: 'ગુજરાતી',
};

export const LanguageSwitcher: React.FC = () => {
  const { currentLocale, setLocale, availableLocales, isTranslating } = useLanguage();

  return (
    <div className="relative inline-block w-full">
      <Select
        value={currentLocale}
        onValueChange={setLocale}
        disabled={isTranslating}
      >
        <SelectTrigger 
          className="h-8 w-8 min-w-[32px] min-h-[32px] !p-0 md:px-4 md:h-9 md:w-full md:min-w-[140px] border-sage-200 rounded-full bg-white text-xs font-extrabold text-forest-700 flex items-center justify-center focus:ring-4 focus:ring-forest-500/10 focus:border-forest-500 group shrink-0"
        >
          <div className="flex items-center gap-2 justify-center">
            <Globe className="w-4 h-4 text-forest-600 group-hover:text-forest-800 transition-colors shrink-0" />
            <span className="hidden md:inline">
              <SelectValue placeholder={languageNames[currentLocale] || currentLocale.toUpperCase()} />
            </span>
          </div>
        </SelectTrigger>
        <SelectContent>
          {availableLocales.map((locale) => (
            <SelectItem key={locale} value={locale}>
              {languageNames[locale] || locale.toUpperCase()}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {isTranslating && (
        <div className="absolute right-2 top-1/2 transform -translate-y-1/2 pointer-events-none">
          <div className="animate-spin h-4 w-4 border-2 border-primary-500 border-t-transparent rounded-full"></div>
        </div>
      )}
    </div>
  );
};
