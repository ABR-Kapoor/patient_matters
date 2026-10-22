import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from 'react';
import {
  DEFAULT_LOCALE,
  LOCALES,
  LOCALE_CODES,
  type LocaleOption,
  getVersion,
  hydrate,
  localeOption,
  persistLocale,
  retryLocale,
  subscribe,
  t as translateSync,
  translate as translateAsync,
} from './i18n';

type LanguageContextValue = {
  locale: string;
  setLocale: (code: string) => void;
  localeInfo: LocaleOption;
  locales: LocaleOption[];
  t: (source: string) => string;
  translate: (source: string) => Promise<string>;
  isReady: boolean;
};

const LanguageContext = createContext<LanguageContextValue>({
  locale: DEFAULT_LOCALE,
  setLocale: () => {},
  localeInfo: LOCALES[0],
  locales: LOCALES,
  t: (source) => source,
  translate: async (source) => source,
  isReady: false,
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState(DEFAULT_LOCALE);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    hydrate()
      .then(saved => {
        if (cancelled) return;
        if (saved && saved !== DEFAULT_LOCALE) setLocaleState(saved);
      })
      .finally(() => {
        if (!cancelled) setIsReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const setLocale = useCallback((code: string) => {
    if (!LOCALE_CODES.includes(code)) return;
    setLocaleState(code);
    persistLocale(code);
    retryLocale(code);
  }, []);

  const value = useMemo<LanguageContextValue>(
    () => ({
      locale,
      setLocale,
      localeInfo: localeOption(locale),
      locales: LOCALES,
      t: (source: string) => translateSync(source, locale),
      translate: (source: string) => translateAsync(source, locale),
      isReady,
    }),
    [locale, setLocale, isReady]
  );

  return (
    <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}

/**
 * Translate a single string. Re-renders when the translation arrives, so this
 * is safe to call directly during render.
 *
 * Uses `t` (not `peek`) so a cache miss enqueues the string for the next
 * batched POST to /api/translate — `t` is idempotent (already-cached and
 * in-flight strings are not re-queued), skips the default locale, and still
 * returns the source text immediately.
 */
export function useTranslate(source: string): string {
  const { locale } = useLanguage();
  useSyncExternalStore(subscribe, getVersion, getVersion);
  return translateSync(source, locale);
}
