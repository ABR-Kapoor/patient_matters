'use client';

import { useState, useEffect } from 'react';
import { useLanguage } from '@/app/contexts/LanguageContext';

export const useTranslation = (text: string) => {
  const { currentLocale } = useLanguage();
  const [translatedText, setTranslatedText] = useState(text);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const performTranslation = async () => {
      // For English locale, always return original text - no translation needed
      if (currentLocale === 'en' || !text) {
        setTranslatedText(text);
        return;
      }

      setIsLoading(true);
      try {
        const { getStaticTranslation, getCachedTranslation, setCachedTranslation } = await import('../lib/translations');
        
        const staticTranslation = getStaticTranslation(text, currentLocale);
        if (staticTranslation) {
          setTranslatedText(staticTranslation);
          setIsLoading(false);
          return;
        }
        
        const cachedTranslation = getCachedTranslation(text, currentLocale);
        if (cachedTranslation) {
          setTranslatedText(cachedTranslation);
          setIsLoading(false);
          return;
        }
        
        const response = await fetch('/api/translate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text,
            sourceLocale: 'en',
            targetLocale: currentLocale,
            type: 'text',
          }),
        });

        const data = await response.json();
        
        if (data.success) {
          setCachedTranslation(text, currentLocale, data.result);
          setTranslatedText(data.result);
        } else {
          setTranslatedText(text);
        }
      } catch (error) {
        setTranslatedText(text);
      } finally {
        setIsLoading(false);
      }
    };

    performTranslation();
  }, [text, currentLocale]);

  return { text: translatedText, isLoading };
};

export const useObjectTranslation = <T extends Record<string, any>>(obj: T) => {
  const { translateObject, currentLocale } = useLanguage();
  const [translatedObj, setTranslatedObj] = useState(obj);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const performTranslation = async () => {
      if (currentLocale === 'en') {
        setTranslatedObj(obj);
        return;
      }

      setIsLoading(true);
      try {
        const result = await translateObject(obj);
        setTranslatedObj(result);
      } catch (error) {
        console.error('Object translation failed:', error);
        setTranslatedObj(obj);
      } finally {
        setIsLoading(false);
      }
    };

    performTranslation();
  }, [obj, currentLocale, translateObject]);

  return { data: translatedObj, isLoading };
};
