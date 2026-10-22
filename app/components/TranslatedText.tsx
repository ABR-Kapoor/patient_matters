'use client';

import React from 'react';
import { useTranslation } from '@/app/hooks/useTranslation';
import { useLanguage } from '@/app/contexts/LanguageContext';

interface TranslatedTextProps extends React.HTMLAttributes<HTMLElement> {
  children: string;
  className?: string;
  as?: 'p' | 'span' | 'div' | 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'label' | 'button';
}

// Check if text contains Devanagari characters
function hasDevanagari(text: string): boolean {
  return /[\u0900-\u097F]/.test(text);
}

export const TranslatedText: React.FC<TranslatedTextProps> = ({
  children,
  className = '',
  as = 'span',
  ...props
}) => {
  const { text: translatedText, isLoading } = useTranslation(children);
  const { currentLocale } = useLanguage();
  
  // Show original text while loading to avoid layout shift
  const displayText = translatedText || children;
  
  // Only apply Devanagari font styling when locale is explicitly Hindi-related
  // This ensures English locale never gets Hindi font styling
  const isHindiLocale = currentLocale === 'hi' || currentLocale === 'mr' || currentLocale === 'ne' || currentLocale === 'sa';
  const hasDevanagariChars = hasDevanagari(displayText);
  
  // Only use devanagari-hindi class for non-English locales
  const shouldUseHindiFont = isHindiLocale && hasDevanagariChars;
  
  const Element = as;
  
  const combinedClassName = shouldUseHindiFont 
    ? `${className} devanagari-hindi ${isLoading ? 'opacity-70' : ''}`
    : `${className} ${isLoading ? 'opacity-70' : ''}`;
  
  return (
    <Element className={combinedClassName} {...props}>
      {displayText}
    </Element>
  );
};
