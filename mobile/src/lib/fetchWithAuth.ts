import { Platform } from 'react-native';
import Constants from 'expo-constants';

// This machine's LAN address changes with every network it joins (Wi-Fi,
// hotspot, Ethernet, ...), so a hardcoded host in .env goes stale the moment the
// phone switches networks and every request then times out. In development we
// instead reuse the host the JS bundle was actually served from: if the device
// could load the bundle from Metro, the very same machine is reachable on that
// exact address for the backend too. EXPO_PUBLIC_API_URL still provides the port
// (and remains the source of truth for production, where there is no dev server).
function resolveApiBaseUrl(): string {
  const configured = process.env.EXPO_PUBLIC_API_URL;
  const normalized = configured ? configured.replace(/\/$/, '') : '';

  // If a public tunnel or remote backend is explicitly configured (e.g. Cloudflare tunnel),
  // preserve it directly instead of substituting the local Metro IP.
  if (normalized && (normalized.startsWith('https://') || normalized.includes('trycloudflare.com'))) {
    return normalized;
  }

  if (__DEV__ && Platform.OS !== 'web') {
    const hostUri =
      Constants.expoConfig?.hostUri ??
      (Constants as any).expoGoConfig?.debuggerHost ??
      (Constants as any).manifest2?.extra?.expoGo?.debuggerHost;
    const devHost = typeof hostUri === 'string' ? hostUri.split(':')[0] : '';
    if (devHost) {
      return normalized
        ? normalized.replace(/^(https?:\/\/)[^/:]+/, `$1${devHost}`)
        : `http://${devHost}:3000`;
    }
  }

  if (normalized) return normalized;

  if (__DEV__ && Platform.OS !== 'web') {
    console.warn(
      '[fetchWithAuth] EXPO_PUBLIC_API_URL is not set and no dev-server host could be detected. ' +
      'Set it in .env (e.g. http://192.168.x.x:3000) and rebuild.'
    );
  }

  return Platform.OS === 'web' ? '' : '';
}

export const API_BASE_URL = resolveApiBaseUrl();

// Without a client-side timeout a request that never gets a response never settles,
// and every caller keeps its spinner up forever. The backend can sit on a dead
// database for its own connect_timeout before giving up, so the client has to have
// its own deadline. Callers can override it per request via `options.timeoutMs`.
const DEFAULT_TIMEOUT_MS = 15000;

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

export async function fetchWithAuth(endpoint: string, tokenFnOrString: any, options: RequestInit = {}) {
  const url = `${API_BASE_URL}${endpoint}`;
  
  // Resolve token. On cold start Clerk is still hydrating, so a single quick
  // retry is not reliable: the first request would go out without a token, the
  // backend answers 401, and callers show a scary error. Poll bounded for a few
  // seconds so the first authenticated call actually has credentials.
  let token = typeof tokenFnOrString === 'function' ? await tokenFnOrString() : tokenFnOrString;
  if (!token && typeof tokenFnOrString === 'function') {
    const deadline = Date.now() + 3000;
    while (!token && Date.now() < deadline) {
      await new Promise(r => setTimeout(r, 300));
      token = await tokenFnOrString();
    }
  }
  if (!token) {
    console.warn(`[fetchWithAuth] No token available for ${endpoint} – request will be unauthenticated`);
  }

  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const { timeoutMs = DEFAULT_TIMEOUT_MS, signal: callerSignal, ...restOptions } = options as RequestInit & {
    timeoutMs?: number;
  };

  const controller = new AbortController();
  let timedOut = false;

  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  // Let a caller-supplied signal (e.g. a screen unmounting) cancel the request too.
  const onCallerAbort = () => controller.abort();
  if (callerSignal) {
    if (callerSignal.aborted) controller.abort();
    else callerSignal.addEventListener('abort', onCallerAbort);
  }

  try {
    const response = await fetch(url, {
      ...restOptions,
      headers,
      signal: controller.signal,
    });
    return response;
  } catch (error) {
    if (timedOut) {
      console.error(`[fetchWithAuth] Timed out after ${timeoutMs}ms: ${url}`);
      throw new RequestTimeoutError(endpoint, timeoutMs);
    }
    console.error(`Error fetching ${url}:`, error);
    throw error;
  } finally {
    clearTimeout(timer);
    if (callerSignal) callerSignal.removeEventListener('abort', onCallerAbort);
  }
}
