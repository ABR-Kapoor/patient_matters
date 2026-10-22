import { API_BASE_URL, fetchWithAuth } from './fetchWithAuth';

let _apiBaseUrl = API_BASE_URL;
export function setI18nBaseUrl(url: string) {
  _apiBaseUrl = url;
}

export type LocaleOption = { code: string; label: string; native: string };

export const LOCALES: LocaleOption[] = [
  { code: 'en', label: 'English', native: 'English' },
  { code: 'hi', label: 'Hindi', native: 'हिन्दी' },
];

export const LOCALE_CODES = LOCALES.map((l) => l.code);

export const DEFAULT_LOCALE = LOCALE_CODES.includes(
  process.env.EXPO_PUBLIC_DEFAULT_LOCALE || ''
)
  ? (process.env.EXPO_PUBLIC_DEFAULT_LOCALE as string)
  : 'en';

const STORAGE_KEY = 'aurasutra.i18n.v1';
const FLUSH_DELAY_MS = 150;
const MAX_BATCH = 60;
const MAX_CACHE_ENTRIES = 4000;
const MAX_TEXT_LENGTH = 2000;

function isTranslatable(source: string): boolean {
  if (source.length < 2 || source.length > MAX_TEXT_LENGTH) return false;
  if (!/[a-zA-Z]/.test(source) && !/[\u0900-\u097F]/.test(source)) return false;
  return /[a-zA-Z]/.test(source);
}

const cache = new Map<string, string>();
const listeners = new Set<() => void>();
const timers = new Map<string, ReturnType<typeof setTimeout>>();
const queued = new Map<string, string[]>();
const inflight = new Set<string>();
const disabled = new Set<string>();

let storagePromise: Promise<any | null> | null = null;
let saveTimer: ReturnType<typeof setTimeout> | null = null;

let version = 0;

export function getVersion(): number {
  return version;
}

function key(locale: string, source: string) {
  return `${locale}\u0000${source}`;
}

function notify() {
  version++;
  listeners.forEach((fn) => fn());
}

export function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function peek(source: string, locale: string): string {
  if (!source || !locale || locale === DEFAULT_LOCALE) return source;
  return cache.get(key(locale, source)) ?? source;
}

export function has(source: string, locale: string): boolean {
  return cache.has(key(locale, source));
}

function evictIfNeeded() {
  while (cache.size > MAX_CACHE_ENTRIES) {
    const oldest = cache.keys().next();
    if (oldest.done) return;
    cache.delete(oldest.value);
  }
}

function isAsyncStorageLinked(): boolean {
  try {
    const { TurboModuleRegistry, NativeModules, Platform } = require('react-native');
    if (Platform.OS === 'web') return false;
    return !!(
      TurboModuleRegistry?.get('RNCAsyncStorage') ??
      TurboModuleRegistry?.get('RNC_AsyncSQLiteDBStorage') ??
      TurboModuleRegistry?.get('PlatformLocalStorage') ??
      NativeModules?.RNCAsyncStorage ??
      NativeModules?.RNC_AsyncSQLiteDBStorage ??
      NativeModules?.PlatformLocalStorage
    );
  } catch {
    return false;
  }
}

function loadStorage(): Promise<any | null> {
  if (storagePromise) return storagePromise;
  storagePromise = (async () => {
    try {
      if (!isAsyncStorageLinked()) return null;
      const mod: any = require('@react-native-async-storage/async-storage');
      const store = (mod.default ?? mod);
      const raw = await store.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Record<string, string>;
        for (const [k, v] of Object.entries(parsed)) {
          if (typeof k === 'string' && typeof v === 'string') cache.set(k, v);
        }
      }
      notify();
      return store;
    } catch {
      return null;
    }
  })();
  return storagePromise;
}

function scheduleSave() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    const store = await loadStorage();
    if (!store) return;
    const obj: Record<string, string> = {};
    cache.forEach((v, k) => {
      obj[k] = v;
    });
    try {
      await store.setItem(STORAGE_KEY, JSON.stringify(obj));
    } catch {}
  }, 1000);
}

export async function hydrate(): Promise<string | null> {
  await loadStorage();

  const store = await loadStorage();
  let saved: string | null = null;
  if (store) {
    try {
      const raw = await store.getItem(`${STORAGE_KEY}.locale`);
      saved = raw && LOCALE_CODES.includes(raw) ? raw : null;
    } catch {}
  }
  return saved ?? DEFAULT_LOCALE;
}

export async function persistLocale(locale: string) {
  const store = await loadStorage();
  if (!store) return;
  try {
    await store.setItem(`${STORAGE_KEY}.locale`, locale);
  } catch {}
}

async function flush(locale: string) {
  inflight.add(locale);
  const batch = (queued.get(locale) ?? []).splice(0, MAX_BATCH);
  if (!batch.length) {
    inflight.delete(locale);
    return;
  }

  const payload: Record<string, string> = {};
  const sources: Record<string, string> = {};
  batch.forEach((source, i) => {
    const id = `s${i}`;
    payload[id] = source;
    sources[id] = source;
  });

  try {
    const res = await fetchWithAuth('/api/translate', null, {
      method: 'POST',
      body: JSON.stringify({
        text: payload,
        sourceLocale: DEFAULT_LOCALE,
        targetLocale: locale,
        type: 'object',
      }),
    });

    const body = await res.json();
    if (!body?.success || !body.result) throw new Error(body?.error || 'translate failed');

    let stored = 0;
    for (const [id, translated] of Object.entries(body.result as Record<string, string>)) {
      const source = sources[id];
      if (source && typeof translated === 'string' && translated.trim()) {
        cache.set(key(locale, source), translated);
        stored++;
      }
    }

    disabled.delete(locale);
    if (stored) {
      evictIfNeeded();
      notify();
      scheduleSave();
    }
  } catch (err) {
    console.warn(`[i18n] translation unavailable for "${locale}"`, err);
    disabled.add(locale);
    queued.set(locale, []);
  } finally {
    inflight.delete(locale);
    const left = queued.get(locale) ?? [];
    if (left.length && !disabled.has(locale)) {
      setTimeout(() => flush(locale), 0);
    }
  }
}

function scheduleFlush(locale: string) {
  if (disabled.has(locale) || inflight.has(locale)) return;
  if (timers.has(locale)) return;
  const timer = setTimeout(() => {
    timers.delete(locale);
    flush(locale);
  }, FLUSH_DELAY_MS);
  timers.set(locale, timer);
}

export function t(source: string, locale: string): string {
  if (!locale || locale === DEFAULT_LOCALE || !isTranslatable(source)) return source;

  if (has(source, locale)) return peek(source, locale);

  const list = queued.get(locale) ?? [];
  if (!list.includes(source)) {
    list.push(source);
    queued.set(locale, list);
  }
  scheduleFlush(locale);

  return source;
}

export async function translate(
  source: string,
  locale: string
): Promise<string> {
  if (!locale || locale === DEFAULT_LOCALE || !isTranslatable(source)) return source;

  const hit = peek(source, locale);
  if (hit !== source) return hit;

  const list = queued.get(locale) ?? [];
  if (!list.includes(source)) {
    list.push(source);
    queued.set(locale, list);
  }
  scheduleFlush(locale);

  return new Promise((resolve) => {
    const started = Date.now();
    const check = () => {
      const hit2 = peek(source, locale);
      if (hit2 !== source) return resolve(hit2);
      if (Date.now() - started > 12000) return resolve(source);
      setTimeout(check, 120);
    };
    check();
  });
}

export function localeOption(code: string): LocaleOption {
  return LOCALES.find((l) => l.code === code) ?? LOCALES[0];
}

export function retryLocale(locale: string) {
  disabled.delete(locale);
  for (const timer of timers.values()) clearTimeout(timer);
  timers.clear();
}
