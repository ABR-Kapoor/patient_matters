import type { AuthToken } from '../types';

// --- URL Resolver -------------------------------------------------------------
// Web (Next.js):  pass { isWeb: true }  -> returns '' (same-origin)
// Mobile (Expo):  pass { metroHost, expoPublicApiUrl, isNative, isDev, defaultPort }
//                 -> auto-detects the Metro dev-server host in dev, falls back to .env URL

export interface ResolveUrlOptions {
  expoPublicApiUrl?: string;
  metroHost?: string;         // Constants.expoConfig?.hostUri split on ':'[0]
  isNative?: boolean;
  isDev?: boolean;
  isWeb?: boolean;
  defaultPort?: number;
}

export function resolveApiBaseUrl(options: ResolveUrlOptions = {}): string {
  const {
    expoPublicApiUrl = '',
    metroHost,
    isNative = false,
    isDev = false,
    isWeb = false,
    defaultPort = 3000,
  } = options;

  // Web (Next.js) - always same-origin
  if (isWeb) return '';

  const normalized = expoPublicApiUrl.replace(/\/$/, '');

  // Native dev - swap the static .env IP for the live Metro host
  if (isDev && isNative && metroHost) {
    return normalized
      ? normalized.replace(/^(https?:\/\/)[^/:]+/, `$1${metroHost}`)
      : `http://${metroHost}:${defaultPort}`;
  }

  return normalized;
}

// --- Timeout Error ------------------------------------------------------------
export class RequestTimeoutError extends Error {
  readonly endpoint: string;
  readonly timeoutMs: number;
  constructor(endpoint: string, timeoutMs: number) {
    super(`Request timed out after ${timeoutMs}ms: ${endpoint}`);
    this.name = 'RequestTimeoutError';
    this.endpoint = endpoint;
    this.timeoutMs = timeoutMs;
  }
}

// --- Fetch Options ------------------------------------------------------------
export interface FetchWithAuthOptions extends RequestInit {
  timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 15_000;

// --- Core fetch ---------------------------------------------------------------
// baseUrl: '' for web (same-origin), 'http://192.168.x.x:3000' for mobile
// token:   string | null | (() => Promise<string|null>)  (Clerk getToken or raw string)
export async function createFetchWithAuth(
  baseUrl: string,
  token: AuthToken,
  endpoint: string,
  options: FetchWithAuthOptions = {}
): Promise<Response> {
  const url = `${baseUrl}${endpoint}`;

  // Resolve token - poll briefly on cold start (Clerk hydration race)
  let resolved = typeof token === 'function' ? await token() : token;
  if (!resolved && typeof token === 'function') {
    const deadline = Date.now() + 3_000;
    while (!resolved && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 300));
      resolved = await token();
    }
  }
  if (!resolved) {
    console.warn(`[fetchWithAuth] No auth token for ${endpoint} - request will be unauthenticated`);
  }

  const { timeoutMs = DEFAULT_TIMEOUT_MS, signal: callerSignal, ...rest } = options;

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(resolved ? { Authorization: `Bearer ${resolved}` } : {}),
    ...options.headers,
  };

  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  if (callerSignal) {
    if (callerSignal.aborted) controller.abort();
    else callerSignal.addEventListener('abort', () => controller.abort());
  }

  try {
    return await fetch(url, { ...rest, headers, signal: controller.signal });
  } catch (err) {
    if (timedOut) {
      console.error(`[fetchWithAuth] Timed out after ${timeoutMs}ms: ${endpoint}`);
      throw new RequestTimeoutError(endpoint, timeoutMs);
    }
    console.error(`[fetchWithAuth] Error fetching ${endpoint}:`, err);
    throw err;
  } finally {
    clearTimeout(timer);
    if (callerSignal) callerSignal.removeEventListener('abort', () => controller.abort());
  }
}
