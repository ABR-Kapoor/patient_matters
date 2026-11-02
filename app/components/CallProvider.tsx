'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Loader2, Phone, PhoneOff, Video } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuthToken } from '@/lib/auth-token-context';
import { fetchWithAuth } from '@/lib/fetchWithAuth';

type CallStatus = 'ringing' | 'active' | 'rejected' | 'cancelled' | 'expired' | 'ended';

interface CallSessionView {
  id: string;
  aid: string;
  status: CallStatus;
  direction: 'incoming' | 'outgoing' | 'active';
  initiatorRole: 'patient' | 'doctor';
  isInitiator: boolean;
  role: 'patient' | 'doctor';
  ringExpiresAt: string | null;
  acceptedAt: string | null;
  endedAt: string | null;
  endReason: string | null;
  createdAt: string;
  peer: {
    role: 'patient' | 'doctor';
    name: string;
    imageUrl: string | null;
    specialization?: string[] | null;
  };
  appointment: {
    aid: string;
    status: string;
    mode: string;
    scheduledDate: string | Date;
    scheduledTime: string;
    scheduledAt: string;
    callOpensAt: string;
  };
}

interface ActiveCallResponse {
  success?: boolean;
  serverTime?: string;
  session?: CallSessionView | null;
  recentTerminal?: CallSessionView | null;
  error?: string;
  code?: string;
}

interface ActionResponse extends ActiveCallResponse {
  session?: CallSessionView | null;
}

interface CallContextValue {
  session: CallSessionView | null;
  recentTerminal: CallSessionView | null;
  refresh: () => Promise<void>;
  startCall: (aid: string) => Promise<boolean>;
  acceptCall: () => Promise<void>;
  rejectCall: () => Promise<void>;
  cancelCall: () => Promise<void>;
  endCall: () => Promise<void>;
}

const CallContext = createContext<CallContextValue | undefined>(undefined);

const ROLE_LABEL: Record<'patient' | 'doctor', string> = {
  patient: 'Patient',
  doctor: 'Doctor',
};

function terminalMessage(session: CallSessionView) {
  const peer = ROLE_LABEL[session.peer.role];
  if (session.status === 'rejected') {
    return session.isInitiator ? `${peer} declined the call` : 'You declined the call';
  }
  if (session.status === 'cancelled') {
    return session.isInitiator ? 'You cancelled the call' : `${peer} cancelled the call`;
  }
  if (session.status === 'expired') return 'Missed call';
  if (session.status === 'ended' && session.endReason === 'appointment_cancelled') return 'Appointment cancelled';
  if (session.status === 'ended' && session.endReason === 'appointment_completed') return 'Consultation completed';
  return 'Call ended';
}

export function CallProvider({ children }: { children: ReactNode }) {
  const token = useAuthToken();
  const router = useRouter();
  const pathname = usePathname();
  const [session, setSession] = useState<CallSessionView | null>(null);
  const [recentTerminal, setRecentTerminal] = useState<CallSessionView | null>(null);
  const [serverOffset, setServerOffset] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const unlockHandlersRef = useRef<{ unlock: () => void } | null>(null);
  const blockedRingtoneNotifiedRef = useRef(false);
  const inFlightRef = useRef(false);
  const previousRef = useRef<{ id: string; status: CallStatus } | null>(null);
  const shownTerminalRef = useRef(new Set<string>());
  const pathnameRef = useRef(pathname);

  pathnameRef.current = pathname;
  const onCallPage = Boolean(pathname?.includes('/video-call/'));

  const clearUnlockHandlers = useCallback(() => {
    const pending = unlockHandlersRef.current;
    if (!pending) return;
    window.removeEventListener('pointerdown', pending.unlock);
    window.removeEventListener('keydown', pending.unlock);
    unlockHandlersRef.current = null;
  }, []);

  const attachUnlockHandlers = useCallback((audio: HTMLAudioElement) => {
    if (typeof window === 'undefined' || unlockHandlersRef.current) return;
    const unlock = () => {
      unlockHandlersRef.current = null;
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
      if (audioRef.current === audio && audio.paused) {
        void audio.play().catch(() => {});
      }
    };
    unlockHandlersRef.current = { unlock };
    window.addEventListener('pointerdown', unlock, { once: true, passive: true });
    window.addEventListener('keydown', unlock, { once: true });
  }, []);

  const stopRingtone = useCallback(() => {
    clearUnlockHandlers();
    blockedRingtoneNotifiedRef.current = false;
    const audio = audioRef.current;
    audioRef.current = null;
    if (!audio) return;
    audio.onended = null;
    audio.pause();
    audio.currentTime = 0;
  }, [clearUnlockHandlers]);

  const playRingtone = useCallback(() => {
    const existing = audioRef.current;
    if (existing) {
      if (existing.paused) {
        void existing.play().catch(() => attachUnlockHandlers(existing));
      }
      return;
    }
    const audio = new Audio('/sounds/ringtone.mp3?v=3');
    audio.preload = 'auto';
    audio.loop = true;
    audio.onended = () => {
      audio.currentTime = 0;
      void audio.play().catch(() => {});
    };
    audioRef.current = audio;
    void audio.play().catch(() => {
      attachUnlockHandlers(audio);
      if (!blockedRingtoneNotifiedRef.current) {
        blockedRingtoneNotifiedRef.current = true;
        toast('Click anywhere in this tab to enable the call ringtone');
      }
    });
  }, [attachUnlockHandlers]);

  const applyState = useCallback((next: ActiveCallResponse) => {
    if (next.serverTime) {
      const parsed = new Date(next.serverTime).getTime();
      if (Number.isFinite(parsed)) setServerOffset(parsed - Date.now());
    }
    setSession(next.session ?? null);
    setRecentTerminal(next.recentTerminal ?? null);
  }, []);

  const refresh = useCallback(async () => {
    if (!token || inFlightRef.current || (typeof document !== 'undefined' && document.hidden)) return;
    inFlightRef.current = true;
    try {
      const response = await fetchWithAuth('/api/calls/active', token);
      const data = (await response.json()) as ActiveCallResponse;
      if (response.ok && data.success !== false) applyState(data);
    } catch {
      // Polling failures are transient; the next tick retries.
    } finally {
      inFlightRef.current = false;
    }
  }, [applyState, token]);

  const runAction = useCallback(async (action: 'accept' | 'reject' | 'cancel' | 'end') => {
    const current = session;
    if (!current || busy) return;
    setBusy(true);
    try {
      const response = await fetchWithAuth(`/api/calls/${current.aid}/${action}`, token, { method: 'POST' });
      const data = (await response.json()) as ActionResponse;
      if (!response.ok || data.success === false) {
        toast.error(data.error || 'Could not update the call');
        await refresh();
        return;
      }
      if (data.session) {
        setSession(data.session);
        if (data.session.status !== 'active' && data.session.status !== 'ringing') {
          setRecentTerminal(data.session);
        }
      } else {
        setSession(null);
      }
      if (action === 'accept' && data.session?.status === 'active') {
        if (!pathnameRef.current?.includes('/video-call/')) {
          router.push(`/dashboard/video-call/${data.session.aid}`);
        }
      }
    } catch {
      toast.error('Could not update the call');
      await refresh();
    } finally {
      setBusy(false);
    }
  }, [busy, refresh, router, session, token]);

  const startCall = useCallback(async (aid: string) => {
    if (!token || busy) return false;
    setBusy(true);
    try {
      const response = await fetchWithAuth(`/api/calls/${aid}/start`, token, { method: 'POST' });
      const data = (await response.json()) as ActionResponse;
      if (!response.ok || data.success === false || !data.session) {
        toast.error(data.error || 'Could not start the call');
        await refresh();
        return false;
      }
      setSession(data.session);
      return true;
    } catch {
      toast.error('Could not start the call');
      return false;
    } finally {
      setBusy(false);
    }
  }, [busy, refresh, token]);

  const acceptCall = useCallback(() => runAction('accept'), [runAction]);
  const rejectCall = useCallback(() => runAction('reject'), [runAction]);
  const cancelCall = useCallback(() => runAction('cancel'), [runAction]);
  const endCall = useCallback(() => runAction('end'), [runAction]);

  useEffect(() => {
    if (!token) {
      setSession(null);
      stopRingtone();
      return;
    }
    void refresh();
    const interval = window.setInterval(() => { void refresh(); }, 2000);
    const onVisible = () => {
      if (!document.hidden) void refresh();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [refresh, stopRingtone, token]);

  useEffect(() => {
    const tick = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(tick);
  }, []);

  const countdown = useMemo(() => {
    if (!session?.ringExpiresAt || session.status !== 'ringing') return 60;
    return Math.max(0, Math.ceil((new Date(session.ringExpiresAt).getTime() - (now + serverOffset)) / 1000));
  }, [now, serverOffset, session?.ringExpiresAt, session?.status]);

  useEffect(() => {
    if (!recentTerminal || shownTerminalRef.current.has(recentTerminal.id)) return;
    if (session?.id === recentTerminal.id && session.status !== 'active') return;
    shownTerminalRef.current.add(recentTerminal.id);
    toast(terminalMessage(recentTerminal));
  }, [recentTerminal, session?.id, session?.status]);

  useEffect(() => {
    const previous = previousRef.current;
    const current = session ? { id: session.id, status: session.status } : null;
    previousRef.current = current;

    if (!session || session.status !== 'ringing' || countdown <= 0) {
      stopRingtone();
    } else if (session.direction === 'incoming') {
      playRingtone();
    } else {
      stopRingtone();
    }

    if (
      previous &&
      current &&
      previous.id === current.id &&
      previous.status === 'ringing' &&
      current.status === 'active' &&
      !pathnameRef.current?.includes('/video-call/')
    ) {
      if (session) router.push(`/dashboard/video-call/${session.aid}`);
    }
  }, [countdown, playRingtone, router, session, stopRingtone]);

  useEffect(() => () => stopRingtone(), [stopRingtone]);

  const value = useMemo<CallContextValue>(() => ({
    session,
    recentTerminal,
    refresh,
    startCall,
    acceptCall,
    rejectCall,
    cancelCall,
    endCall,
  }), [acceptCall, cancelCall, endCall, recentTerminal, refresh, rejectCall, session, startCall]);

  const showIncoming = session?.status === 'ringing' && session.direction === 'incoming';
  const showOutgoing = session?.status === 'ringing' && session.direction === 'outgoing';
  const showActiveBanner = session?.status === 'active' && !onCallPage;
  const peerInitial = session?.peer.name?.charAt(0)?.toUpperCase() || '?';

  return (
    <CallContext.Provider value={value}>
      {children}

      {showIncoming && session && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 text-center shadow-2xl">
            <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center overflow-hidden rounded-full bg-emerald-100 text-2xl font-bold text-emerald-700">
              {session.peer.imageUrl ? (
                <img src={session.peer.imageUrl} alt={session.peer.name} className="h-full w-full object-cover" />
              ) : peerInitial}
            </div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">Incoming video call</p>
            <h2 className="mt-1 text-2xl font-bold text-gray-900">{session.peer.name}</h2>
            <p className="mt-1 text-sm text-gray-500">Ringing for {countdown}s</p>
            <div className="mt-6 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => { void rejectCall(); }}
                disabled={busy}
                className="flex items-center justify-center gap-2 rounded-2xl bg-red-50 px-4 py-3 font-semibold text-red-600 disabled:opacity-60"
              >
                <PhoneOff className="h-5 w-5" /> Decline
              </button>
              <button
                type="button"
                onClick={() => { void acceptCall(); }}
                disabled={busy}
                className="flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 py-3 font-semibold text-white disabled:opacity-60"
              >
                {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Phone className="h-5 w-5" />} Accept
              </button>
            </div>
          </div>
        </div>
      )}

      {showOutgoing && session && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 text-center shadow-2xl">
            <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center overflow-hidden rounded-full bg-emerald-100 text-2xl font-bold text-emerald-700">
              {session.peer.imageUrl ? (
                <img src={session.peer.imageUrl} alt={session.peer.name} className="h-full w-full object-cover" />
              ) : peerInitial}
            </div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">Calling</p>
            <h2 className="mt-1 text-2xl font-bold text-gray-900">{session.peer.name}</h2>
            <p className="mt-1 text-sm text-gray-500">Waiting for them to answer... {countdown}s</p>
            <button
              type="button"
              onClick={() => { void cancelCall(); }}
              disabled={busy}
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-red-600 px-4 py-3 font-semibold text-white disabled:opacity-60"
            >
              {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <PhoneOff className="h-5 w-5" />} Cancel call
            </button>
          </div>
        </div>
      )}

      {showActiveBanner && session && (
        <div className="fixed bottom-4 right-4 z-[90] w-[min(92vw,22rem)] rounded-2xl border border-emerald-200 bg-white p-4 shadow-xl">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
              <Video className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-gray-900">Ongoing call with {session.peer.name}</p>
              <p className="text-xs text-gray-500">Rejoin or end the consultation</p>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => router.push(`/dashboard/video-call/${session.aid}`)}
              className="rounded-xl bg-emerald-600 px-3 py-2 text-sm font-semibold text-white"
            >
              Rejoin
            </button>
            <button
              type="button"
              onClick={() => { void endCall(); }}
              disabled={busy}
              className="rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-600 disabled:opacity-60"
            >
              End
            </button>
          </div>
        </div>
      )}
    </CallContext.Provider>
  );
}

export function useCall() {
  const value = useContext(CallContext);
  if (!value) throw new Error('useCall must be used within CallProvider');
  return value;
}
