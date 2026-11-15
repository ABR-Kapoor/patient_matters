import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { ActivityIndicator, AppState, Image, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import { useAuth } from '@clerk/expo';
import { Loader2, Phone, PhoneOff, Video } from 'lucide-react-native';
import { fetchWithAuth } from '../lib/fetchWithAuth';
import { callSoundService } from '../lib/callSoundService';
import { useNotification } from '../lib/NotificationContext';

type CallStatus = 'ringing' | 'active' | 'rejected' | 'cancelled' | 'expired' | 'ended';

export interface CallSessionView {
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

const ROLE_LABEL: Record<'patient' | 'doctor', string> = {
  patient: 'Patient',
  doctor: 'Doctor',
};

export function callTerminalMessage(session: CallSessionView): { title: string; detail?: string } {
  const peer = ROLE_LABEL[session.peer.role];
  if (session.status === 'rejected') {
    return {
      title: 'Call declined',
      detail: session.isInitiator ? `${peer} declined the call` : 'You declined the call',
    };
  }
  if (session.status === 'cancelled') {
    return {
      title: 'Call cancelled',
      detail: session.isInitiator ? 'You cancelled the call' : `${peer} cancelled the call`,
    };
  }
  if (session.status === 'expired') return { title: 'Missed call' };
  if (session.status === 'ended' && session.endReason === 'appointment_cancelled') return { title: 'Appointment cancelled' };
  if (session.status === 'ended' && session.endReason === 'appointment_completed') return { title: 'Consultation completed' };
  return { title: 'Call ended' };
}

interface CallContextValue {
  initialized: boolean;
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

const COLORS = {
  primary: '#048256',
  primaryLight: '#E9F7EE',
  text: '#101828',
  muted: '#667085',
  white: '#FFFFFF',
  danger: '#DC2626',
  dangerLight: '#FEF2F2',
};

export function CallProvider({ children }: { children: ReactNode }) {
  const { isSignedIn, getToken } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const { showToast } = useNotification();
  const [initialized, setInitialized] = useState(false);
  const [session, setSession] = useState<CallSessionView | null>(null);
  const [recentTerminal, setRecentTerminal] = useState<CallSessionView | null>(null);
  const [serverOffset, setServerOffset] = useState(0);
  const [now, setNow] = useState(0);
  const [busy, setBusy] = useState(false);
  const inFlightRef = useRef(false);
  const previousRef = useRef<{ id: string; status: CallStatus } | null>(null);
  const shownTerminalRef = useRef(new Set<string>());
  const getTokenRef = useRef(getToken);
  const isSignedInRef = useRef(isSignedIn);
  const failureCountRef = useRef(0);
  const nextAttemptRef = useRef(0);
  getTokenRef.current = getToken;
  isSignedInRef.current = isSignedIn;

  const onCallPage = Boolean(pathname?.includes('/video-call'));
  const displaySession = isSignedIn ? session : null;

  const applyState = useCallback((next: ActiveCallResponse) => {
    if (next.serverTime) {
      const parsed = new Date(next.serverTime).getTime();
      if (Number.isFinite(parsed)) setServerOffset(parsed - Date.now());
    }
    setSession(next.session ?? null);
    setRecentTerminal(next.recentTerminal ?? null);
  }, []);

  const refresh = useCallback(async () => {
    const appState = AppState.currentState;
    if (
      !isSignedInRef.current ||
      inFlightRef.current ||
      Date.now() < nextAttemptRef.current ||
      appState === 'background' ||
      appState === 'inactive'
    ) return;
    inFlightRef.current = true;
    try {
      const response = await fetchWithAuth('/api/calls/active', getTokenRef.current);
      if (!response.ok) throw new Error(`Active call poll failed (${response.status})`);
      const data = (await response.json()) as ActiveCallResponse;
      if (data.success === false) throw new Error(data.error || 'Active call poll failed');
      applyState(data);
      failureCountRef.current = 0;
      nextAttemptRef.current = 0;
    } catch {
      // Back off while the backend or this device's network is unhealthy.
      const failures = Math.min(failureCountRef.current + 1, 4);
      failureCountRef.current = failures;
      nextAttemptRef.current = Date.now() + Math.min(30000, 2000 * 2 ** failures);
    } finally {
      inFlightRef.current = false;
      setInitialized(true);
    }
  }, [applyState]);

  const runAction = useCallback(async (action: 'accept' | 'reject' | 'cancel' | 'end') => {
    const current = session;
    if (!current || busy) return;
    setBusy(true);
    try {
      const response = await fetchWithAuth(`/api/calls/${current.aid}/${action}`, getToken, { method: 'POST' });
      const data = (await response.json()) as ActiveCallResponse;
      if (!response.ok || data.success === false) return;
      if (data.session) {
        setSession(data.session);
        if (data.session.status !== 'active' && data.session.status !== 'ringing') {
          setRecentTerminal(data.session);
        }
      } else {
        setSession(null);
      }
      if (action === 'accept' && data.session?.status === 'active') {
        if (!pathname?.includes('/video-call')) {
          router.push(`/(dashboard)/video-call/${data.session.aid}` as never);
        }
      }
    } catch {
      // The next poll reconciles state.
    } finally {
      setBusy(false);
    }
  }, [busy, getToken, pathname, router, session]);

  const startCall = useCallback(async (aid: string) => {
    if (!isSignedIn || busy) return false;
    setBusy(true);
    try {
      const response = await fetchWithAuth(`/api/calls/${aid}/start`, getToken, { method: 'POST' });
      const data = (await response.json()) as ActiveCallResponse;
      if (!response.ok || data.success === false || !data.session) return false;
      setSession(data.session);
      return true;
    } catch {
      return false;
    } finally {
      setBusy(false);
    }
  }, [busy, getToken, isSignedIn]);

  const acceptCall = useCallback(() => runAction('accept'), [runAction]);
  const rejectCall = useCallback(() => runAction('reject'), [runAction]);
  const cancelCall = useCallback(() => runAction('cancel'), [runAction]);
  const endCall = useCallback(() => runAction('end'), [runAction]);

  useEffect(() => {
    if (!isSignedIn) {
      void callSoundService.stopWaitingRing();
      return;
    }
    const initialTimer = setTimeout(() => { void refresh(); }, 0);
    const interval = setInterval(() => { void refresh(); }, 2000);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        failureCountRef.current = 0;
        nextAttemptRef.current = 0;
        void refresh();
      }
    });
    return () => {
      clearTimeout(initialTimer);
      clearInterval(interval);
      subscription.remove();
    };
  }, [isSignedIn, refresh]);

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(interval);
  }, []);

  const countdown = displaySession?.ringExpiresAt && displaySession.status === 'ringing'
    ? Math.max(0, Math.ceil((new Date(displaySession.ringExpiresAt).getTime() - (now + serverOffset)) / 1000))
    : 60;

  useEffect(() => {
    if (!recentTerminal || shownTerminalRef.current.has(recentTerminal.id)) return;
    if (displaySession?.id === recentTerminal.id && displaySession.status !== 'active') return;
    shownTerminalRef.current.add(recentTerminal.id);
    const copy = callTerminalMessage(recentTerminal);
    showToast(copy.title, copy.detail, 'info');
  }, [displaySession?.id, displaySession?.status, recentTerminal, showToast]);

  useEffect(() => {
    const previous = previousRef.current;
    const current = session ? { id: session.id, status: session.status } : null;
    previousRef.current = current;

    if (session?.status === 'ringing' && session.direction === 'incoming' && countdown > 0) {
      void callSoundService.startWaitingRing();
    } else {
      void callSoundService.stopWaitingRing();
    }

    if (
      previous &&
      current &&
      previous.id === current.id &&
      previous.status === 'ringing' &&
      current.status === 'active' &&
      session &&
      !pathname?.includes('/video-call')
    ) {
      router.push(`/(dashboard)/video-call/${session.aid}` as never);
    }
  }, [countdown, pathname, router, session]);

  const initializedForUi = initialized || !isSignedIn;

  const value = useMemo<CallContextValue>(() => ({
    initialized: initializedForUi,
    session: displaySession,
    recentTerminal,
    refresh,
    startCall,
    acceptCall,
    rejectCall,
    cancelCall,
    endCall,
  }), [acceptCall, cancelCall, displaySession, endCall, initializedForUi, recentTerminal, refresh, rejectCall, startCall]);

  const showIncoming = displaySession?.status === 'ringing' && displaySession.direction === 'incoming';
  const showOutgoing = displaySession?.status === 'ringing' && displaySession.direction === 'outgoing';
  const showActiveBanner = displaySession?.status === 'active' && !onCallPage;
  const initial = displaySession?.peer.name?.charAt(0)?.toUpperCase() || '?';

  return (
    <CallContext.Provider value={value}>
      {children}

      <Modal visible={Boolean(showIncoming || showOutgoing)} transparent animationType="fade" statusBarTranslucent>
        <View style={styles.overlay}>
          <View style={styles.card}>
            <View style={styles.avatar}>
              {displaySession?.peer.imageUrl ? (
                <Image source={{ uri: displaySession.peer.imageUrl }} style={styles.avatarImage} />
              ) : (
                <Text style={styles.avatarText}>{initial}</Text>
              )}
            </View>
            <Text style={styles.eyebrow}>
              {showIncoming ? 'INCOMING VIDEO CALL' : 'CALLING'}
            </Text>
            <Text style={styles.name}>{displaySession?.peer.name || 'Consultation'}</Text>
            <Text style={styles.hint}>
              {showIncoming ? `Ringing for ${countdown}s` : `Waiting for answer... ${countdown}s`}
            </Text>

            {showIncoming ? (
              <View style={styles.actions}>
                <TouchableOpacity
                  style={[styles.actionButton, styles.rejectButton]}
                  disabled={busy}
                  onPress={() => { void rejectCall(); }}
                >
                  <PhoneOff size={20} color={COLORS.danger} />
                  <Text style={styles.rejectText}>Decline</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionButton, styles.acceptButton]}
                  disabled={busy}
                  onPress={() => { void acceptCall(); }}
                >
                  {busy ? <ActivityIndicator color={COLORS.white} /> : <Phone size={20} color={COLORS.white} />}
                  <Text style={styles.acceptText}>Accept</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={[styles.cancelButton, busy && styles.disabled]}
                disabled={busy}
                onPress={() => { void cancelCall(); }}
              >
                {busy ? <ActivityIndicator color={COLORS.white} /> : <PhoneOff size={20} color={COLORS.white} />}
                <Text style={styles.acceptText}>Cancel call</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Modal>

      {showActiveBanner && displaySession && (
        <View style={styles.banner}>
          <View style={styles.bannerInfo}>
            <View style={styles.bannerIcon}>
              <Video size={18} color={COLORS.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text numberOfLines={1} style={styles.bannerTitle}>Ongoing call with {displaySession.peer.name}</Text>
              <Text style={styles.bannerHint}>Rejoin or end the consultation</Text>
            </View>
          </View>
          <View style={styles.bannerActions}>
            <TouchableOpacity
              style={styles.rejoinButton}
              onPress={() => router.push(`/(dashboard)/video-call/${displaySession.aid}` as never)}
            >
              <Text style={styles.rejoinText}>Rejoin</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.endButton}
              disabled={busy}
              onPress={() => { void endCall(); }}
            >
              {busy ? <Loader2 size={16} color={COLORS.danger} /> : <Text style={styles.endText}>End</Text>}
            </TouchableOpacity>
          </View>
        </View>
      )}
    </CallContext.Provider>
  );
}

export function useCall() {
  const value = useContext(CallContext);
  if (!value) throw new Error('useCall must be used within CallProvider');
  return value;
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 28,
    padding: 24,
    alignItems: 'center',
  },
  avatar: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginBottom: 16,
  },
  avatarImage: { width: '100%', height: '100%' },
  avatarText: { color: COLORS.primary, fontSize: 30, fontWeight: '700' },
  eyebrow: { color: COLORS.muted, fontSize: 11, fontWeight: '700', letterSpacing: 2 },
  name: { color: COLORS.text, fontSize: 24, fontWeight: '700', marginTop: 4, textAlign: 'center' },
  hint: { color: COLORS.muted, fontSize: 13, marginTop: 6 },
  actions: { flexDirection: 'row', gap: 12, marginTop: 24, width: '100%' },
  actionButton: {
    flex: 1,
    height: 50,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  rejectButton: { backgroundColor: COLORS.dangerLight },
  acceptButton: { backgroundColor: COLORS.primary },
  rejectText: { color: COLORS.danger, fontWeight: '700' },
  acceptText: { color: COLORS.white, fontWeight: '700' },
  cancelButton: {
    marginTop: 24,
    width: '100%',
    height: 50,
    borderRadius: 16,
    backgroundColor: COLORS.danger,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  disabled: { opacity: 0.6 },
  banner: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 90,
    backgroundColor: COLORS.white,
    borderRadius: 18,
    padding: 14,
    shadowColor: '#000',
    shadowOpacity: 0.14,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  bannerInfo: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  bannerIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerTitle: { color: COLORS.text, fontWeight: '700', fontSize: 14 },
  bannerHint: { color: COLORS.muted, fontSize: 12, marginTop: 2 },
  bannerActions: { flexDirection: 'row', gap: 10, marginTop: 12 },
  rejoinButton: {
    flex: 1,
    height: 40,
    borderRadius: 12,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rejoinText: { color: COLORS.white, fontWeight: '700', fontSize: 13 },
  endButton: {
    width: 80,
    height: 40,
    borderRadius: 12,
    backgroundColor: COLORS.dangerLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  endText: { color: COLORS.danger, fontWeight: '700', fontSize: 13 },
});
