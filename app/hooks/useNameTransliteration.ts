'use client';

import { useCallback, useRef, useEffect } from 'react';
import { useLanguage } from '@/app/contexts/LanguageContext';

// Cache for translated/transliterated names
const nameCache = new Map<string, string>();
// Track names currently being translated to prevent duplicates
const translatingNames = new Set<string>();

// Convert locale code to script locale for transliteration
function getTargetLocaleWithScript(locale: string): string {
  const localeToScript: Record<string, string> = {
    'hi': 'hi-Deva',
    'bn': 'bn-Beng',
    'ta': 'ta-Taml',
    'te': 'te-Telu',
    'gu': 'gu-Gujr',
    'mr': 'mr-Deva',
    'kn': 'kn-Knda',
    'ml': 'ml-Mlym',
    'pa': 'pa-Guru',
    'or': 'or-Orya',
    'as': 'as-Beng',
    'ne': 'ne-Deva',
    'sa': 'sa-Deva',
  };
  
  return localeToScript[locale] || locale;
}

export function useNameTransliteration() {
  const { currentLocale } = useLanguage();
  const prevLocale = useRef<string>(currentLocale);

  // Clear cache when locale changes to ensure fresh transliterations
  useEffect(() => {
    if (prevLocale.current !== currentLocale) {
      nameCache.clear();
      translatingNames.clear();
    }
    prevLocale.current = currentLocale;
  }, [currentLocale]);

  const transliterateName = useCallback(async (name: string): Promise<string> => {
    if (!name || typeof window === 'undefined') {
      return name;
    }

    // If English locale, return as-is - no translation needed
    if (currentLocale === 'en') {
      return name;
    }

    // Check cache first
    const cacheKey = `${name}_${currentLocale}`;
    if (nameCache.has(cacheKey)) {
      return nameCache.get(cacheKey)!;
    }

    // Prevent multiple concurrent translations of the same name
    if (translatingNames.has(cacheKey)) {
      // Wait a bit and check cache again
      await new Promise(resolve => setTimeout(resolve, 100));
      if (nameCache.has(cacheKey)) {
        return nameCache.get(cacheKey)!;
      }
      return name;
    }

    try {
      translatingNames.add(cacheKey);

      // For non-Latin scripts (Hindi, Bengali, etc.), translate the name
      // For Latin script names in non-English locales, transliterate to target script
      const hasNonLatin = /[\u0900-\u097F\u0980-\u09FF\u0A80-\u0AFF\u0B80-\u0BFF\u0C00-\u0C7F]/.test(name);
      
      let response;
      if (hasNonLatin) {
        nameCache.set(cacheKey, name);
        return name;
      } else {
        const targetLocaleWithScript = getTargetLocaleWithScript(currentLocale);
        response = await fetch('/api/translate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: name,
            sourceLocale: 'en',
            targetLocale: targetLocaleWithScript,
            type: 'transliterate',
          }),
        });
      }

      const data = await response?.json();

      if (data?.success && data?.result) {
        nameCache.set(cacheKey, data.result);
        return data.result;
      }

      return name;
    } catch (error) {
      console.error('Name translation error:', error);
      return name;
    } finally {
      translatingNames.delete(cacheKey);
    }
  }, [currentLocale]);

  const transliterateNames = useCallback(async (names: string[]): Promise<string[]> => {
    if (!names || names.length === 0 || typeof window === 'undefined') {
      return names;
    }

    if (currentLocale === 'en') {
      return names;
    }

    try {
      const results = await Promise.all(
        names.map((name) => transliterateName(name))
      );
      return results;
    } catch (error) {
      console.error('Batch name translation error:', error);
      return names;
    }
  }, [currentLocale, transliterateName]);

  const clearCache = useCallback(() => {
    nameCache.clear();
  }, []);

  return {
    transliterateName,
    transliterateNames,
    clearCache,
  };
}

// Helper function to check if a string contains non-Latin characters
export function hasNonLatinCharacters(text: string): boolean {
  if (!text) return false;
  
  // Latin Extended characters (includes accented characters)
  const latinPattern = /^[\u0000-\u024F]+$/;
  
  // If string doesn't match Latin pattern, it has non-Latin characters
  return !latinPattern.test(text);
}

// Detect script type from text
export function detectScript(text: string): string {
  if (!text) return 'latin';
  
  const hasDevanagari = /[\u0900-\u097F]/.test(text);
  const hasBengali = /[\u0980-\u09FF]/.test(text);
  const hasTamil = /[\u0B80-\u0BFF]/.test(text);
  const hasTelugu = /[\u0C00-\u0C7F]/.test(text);
  const hasGujarati = /[\u0A80-\u0AFF]/.test(text);
  const hasArabic = /[\u0600-\u06FF]/.test(text);
  const hasChinese = /[\u4E00-\u9FFF]/.test(text);
  const hasJapanese = /[\u3040-\u309F\u30A0-\u30FF]/.test(text);
  const hasKorean = /[\uAC00-\uD7AF\u1100-\u11FF]/.test(text);
  
  if (hasDevanagari) return 'devanagari';
  if (hasBengali) return 'bengali';
  if (hasTamil) return 'tamil';
  if (hasTelugu) return 'telugu';
  if (hasGujarati) return 'gujarati';
  if (hasArabic) return 'arabic';
  if (hasChinese) return 'chinese';
  if (hasJapanese) return 'japanese';
  if (hasKorean) return 'korean';
  
  return 'latin';
}
