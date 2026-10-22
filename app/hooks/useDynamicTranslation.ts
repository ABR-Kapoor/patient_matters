'use client';

import { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '@/app/contexts/LanguageContext';

export function useDynamicTranslation<T extends Record<string, any>>(
  data: T,
  keysToTranslate: (keyof T)[],
  enabled: boolean = true
): { translated: T; isLoading: boolean } {
  const { translate } = useLanguage();
  const [translated, setTranslated] = useState<T>(data);
  const [isLoading, setIsLoading] = useState(false);

  const translateData = useCallback(async () => {
    if (!data || !enabled || typeof window === 'undefined') {
      setTranslated(data);
      return;
    }

    setIsLoading(true);
    try {
      const result: Record<string, unknown> = { ...data };
      
      for (const key of keysToTranslate) {
        const value = data[key];
        if (typeof value === 'string' && value.trim()) {
          result[key as string] = await translate(value);
        } else if (Array.isArray(value)) {
          result[key as string] = await Promise.all(
            value.map(async (item: unknown) => {
              if (typeof item === 'string' && item.trim()) {
                return await translate(item);
              }
              return item;
            })
          );
        }
      }
      
      setTranslated(result as T);
    } catch (error) {
      console.error('Dynamic translation error:', error);
      setTranslated(data);
    } finally {
      setIsLoading(false);
    }
  }, [data, keysToTranslate, enabled, translate]);

  useEffect(() => {
    translateData();
  }, [translateData]);

  return { translated, isLoading };
}

export function useArrayTranslation(
  items: string[],
  enabled: boolean = true
): { translated: string[]; isLoading: boolean } {
  const { translate } = useLanguage();
  const [translated, setTranslated] = useState<string[]>(items);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') {
      setTranslated(items);
      return;
    }

    const translateItems = async () => {
      setIsLoading(true);
      try {
        const results = await Promise.all(
          items.map(async (item: string) => {
            if (item && item.trim()) {
              return await translate(item);
            }
            return item;
          })
        );
        setTranslated(results);
      } catch (error) {
        console.error('Array translation error:', error);
        setTranslated(items);
      } finally {
        setIsLoading(false);
      }
    };

    translateItems();
  }, [items, enabled, translate]);

  return { translated, isLoading };
}
