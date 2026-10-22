import { useState, useEffect, useRef, useCallback } from 'react';
// Stub hooks for the Expo RN application
import { useLanguage as useLanguageContext } from '../lib/LanguageContext';

export function useLanguage() {
  const { locale, setLocale, t, translate, locales, localeInfo } = useLanguageContext();
  return {
    translate: async (str: string) => translate(str),
    currentLocale: locale,
    setLocale,
    t,
    locales,
    localeInfo,
  };
}

import { useAuth, useUser } from '@clerk/expo';
import { globalShowAlert } from '../lib/NotificationContext';

export function useAuthToken() {
  const { getToken } = useAuth();
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;
  return useCallback(((...args: any[]) => getTokenRef.current(...args)) as typeof getToken, []);
}

export function useNameTransliteration() {
  return {
    transliterateName: async (name: string) => name,
  };
}

export function usePatientStore() {
  return {
    uid: 'dummy-uid',
    pid: 'dummy-pid',
  };
}

export function useProfileStore() {
  return {
    completionPct: 100,
    name: 'Dummy Profile',
    imageUrl: '',
    setProfile: () => {},
  };
}

import { Alert } from 'react-native';
import { fetchWithAuth } from '../lib/fetchWithAuth';

export function usePatientIdentity(token: any) {
  const { user } = useUser();
  const { signOut } = useAuth();
  const [data, setData] = useState<any>({ uid: null, pid: null });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (user?.id) {
      const baseData = {
        name: user.fullName || user.firstName || 'New Patient',
        profileImageUrl: user.imageUrl || '',
      };

      // Always resolve identity through dev-sync-user so the returned uid/pid
      // correspond to real rows. The endpoint derives the account from the Clerk
      // session, so the bearer token is required — identity is no longer taken
      // from the request body.
      const getAuthToken = typeof token === 'function' ? token : async () => token;

      // Clerk can still be hydrating on first mount. Retry once on 401 so the
      // identity sync isn't failed by a cold-start race with a missing token.
      const syncOnce = async () => {
        const r = await fetchWithAuth('/api/dev-sync-user', getAuthToken, { method: 'POST' });
        let b: any = null;
        try {
          b = await r.json();
        } catch {
          const raw = await r.text().catch(() => '<unreadable body>');
          throw new Error(`backend replied ${r.status}: ${raw.slice(0, 160)}`);
        }
        return { res: r, body: b };
      };

      (async () => {
      let { res, body } = await syncOnce();
      if (res.status === 401 && (!body || !body.uid)) {
        await new Promise(request => setTimeout(request, 1000));
        ({ res, body } = await syncOnce());
      }

      // A doctor opening the patient app is authenticated but not a patient.
      // Sign the session out rather than leaving a half-usable portal open.
      if (res.status === 403 || body.code === 'ROLE_MISMATCH') {
        await signOut();
        if (globalShowAlert) { globalShowAlert('Doctor Account Detected', 'This account is registered as a doctor. Please use the doctor app to sign in.'); } else { Alert.alert('Wrong account type', 'This account is registered as a doctor. Please use the doctor app to sign in.'); }
        return;
      }

      if (!body?.uid) {
        console.warn('[usePatientIdentity] Sync returned no uid:', body);
        setData(baseData);
        setIsLoading(false);
        return;
      }

      // Prefer the real DB name (users.name) so the video call and UI show the
      // actual patient name. This used to be a bare `fetch` with no
      // Authorization header and a `?uid=` selector, so it always 401'd and the
      // catch silently swallowed it — the API now resolves the profile from the
      // session, so no uid is sent.
      try {
        const profileRes = await fetchWithAuth('/api/patient/profile', getAuthToken);
        const profile = profileRes.ok ? await profileRes.json() : null;
        const dbName = profile?.user?.name;
        setData({ ...baseData, name: dbName || baseData.name, uid: body.uid, pid: body.pid || body.uid });
      } catch {
        setData({ ...baseData, uid: body.uid, pid: body.pid || body.uid });
      }
    })().catch(err => {
        console.error(err);
        const reason = err instanceof Error ? err.message : String(err);
        console.warn('[usePatientIdentity] Could not reach backend:', reason); setData(baseData);
      }).finally(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }
  }, [user?.id]);
  
  return { data, isLoading };
}

export function useAppointments(uid: any, token: any, hasActiveCall: boolean) {
  return {
    data: [],
    isLoading: false,
  };
}

export function useCancelAppointment() {
  return {
    mutateAsync: async () => {},
    isPending: false,
  };
}

export function useRequestRefund() {
  return {
    mutateAsync: async () => {},
    isPending: false,
  };
}

export function useAdherence(pid: any, token: any) {
  return {
    data: { pending: [], all: [] },
    isLoading: false,
  };
}

export function useMarkAdherence() {
  return {
    mutateAsync: async () => {},
    isPending: false,
  };
}

export function usePrescriptions(pid: any, token: any) {
  return {
    data: { sent: [] },
    isLoading: false,
  };
}

// Translations
export function useTranslation(text: string) {
  return { text };
}

// Dummy Voice to Text
export function useVoiceToText() {
  return {
    isRecording: false,
    transcript: '',
    isSupported: false,
    startRecording: () => {},
    stopRecording: () => {},
    resetTranscript: () => {},
  };
}
