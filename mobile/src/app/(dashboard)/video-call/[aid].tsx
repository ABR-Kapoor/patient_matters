import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, PermissionsAndroid, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PhoneOff, X } from 'lucide-react-native';
import { useAuthToken, usePatientIdentity } from '../../../hooks/stubs';
import { fetchWithAuth } from '../../../lib/fetchWithAuth';
import { callSoundService } from '../../../lib/callSoundService';
import { callTerminalMessage, useCall } from '../../../components/CallProvider';

const COLORS = {
  primary: '#048256',
  primaryLight: '#EDF7E3',
  text: '#030315',
  background: '#F2F1F0',
  white: '#FFFFFF',
  gray: '#6B7280',
  lightGray: '#E5E7EB',
  danger: '#EF4444',
  dangerLight: '#FEE2E2',
};

const FONTS = {
  regular: 'DMSans_400Regular',
  medium: 'DMSans_500Medium',
  semiBold: 'DMSans_600SemiBold',
  bold: 'DMSans_700Bold',
};

const serverUrl =
  process.env.EXPO_PUBLIC_LIVEKIT_URL || 'wss://dev-42vzlprn.livekit.cloud';

function formatDuration(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
  const seconds = (totalSeconds % 60).toString().padStart(2, '0');
  return `${minutes}:${seconds}`;
}

export default function VideoCallPage() {
  const { aid } = useLocalSearchParams<{ aid: string }>();
  const router = useRouter();
  const token = useAuthToken();
  const { data: identity, isLoading: isIdentityLoading } = usePatientIdentity(token);
  const { initialized, session, recentTerminal, endCall, cancelCall } = useCall();

  const [liveToken, setLiveToken] = useState<string | null>(null);
  const [joined, setJoined] = useState(false);
  const [fatalError, setFatalError] = useState<string | null>(null);
  const [nativeMissing, setNativeMissing] = useState(false);
  const [remoteLeft, setRemoteLeft] = useState(false);
  const [ending, setEnding] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  const [LiveKitCall, setLiveKitCall] = useState<
    React.ComponentType<React.ComponentProps<typeof import('../../../components/LiveKitCall')['default']>> | null
  >(null);

  const tokenFetched = useRef(false);
  const navigatedRef = useRef(false);
  const currentSession = session?.aid === String(aid) ? session : null;
  const activeSession = currentSession?.status === 'active' ? currentSession : null;
  const waiting = currentSession?.status === 'ringing';

  const identityUid = identity?.uid;
  const stableUserID = useMemo(() => {
    if (!identityUid) return null;
    return String(identityUid).replace(/-/g, '').trim().slice(0, 64) || null;
  }, [identityUid]);

  const roomID = useMemo(() => {
    if (!aid) return null;
    return ('appointment_' + String(aid)).trim().slice(0, 64);
  }, [aid]);

  useEffect(() => {
    let cancelled = false;
    import('../../../components/LiveKitCall')
      .then((m) => {
        if (!cancelled) setLiveKitCall(() => m.default);
      })
      .catch((error) => {
        console.error('[Patient] Could not load the LiveKit module:', error);
        if (!cancelled) setNativeMissing(true);
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    async function fetchToken() {
      if (!activeSession || !stableUserID || !roomID || tokenFetched.current) return;
      tokenFetched.current = true;
      try {
        const response = await fetchWithAuth('/api/calls/livekit-token', token, {
          method: 'POST',
          body: JSON.stringify({ roomId: roomID }),
        });
        const data = await response.json();

        if (response.status === 401) {
          tokenFetched.current = false;
          setFatalError('Your session has expired. Sign in again to rejoin.');
          return;
        }
        if (response.status === 403 || response.status === 426) {
          tokenFetched.current = false;
          setFatalError(data.message || data.error || 'You are not a participant in this consultation.');
          return;
        }
        if (data.success && data.token) {
          setLiveToken(data.token);
        } else {
          tokenFetched.current = false;
          setFatalError(data.error || 'Failed to generate a secure call token.');
        }
      } catch (error) {
        console.error('[Patient] LiveKit token fetch error:', error);
        tokenFetched.current = false;
        setFatalError('Could not reach the token server. Check your network and try again.');
      }
    }
    void fetchToken();
  }, [activeSession, roomID, stableUserID, token]);

  useEffect(() => {
    if (!activeSession?.acceptedAt) return;
    const update = () => {
      setElapsed(Math.max(0, Math.floor((Date.now() - new Date(activeSession.acceptedAt as string).getTime()) / 1000)));
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [activeSession?.acceptedAt]);

  const requestMediaPermissions = useCallback(async () => {
    if (Platform.OS !== 'android') return;
    try {
      await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.CAMERA,
        PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
      ]);
    } catch {
      // LiveKit reports real failures through onError.
    }
  }, []);

  useEffect(() => {
    void requestMediaPermissions();
  }, [requestMediaPermissions]);

  const goBackOnce = useCallback(() => {
    if (navigatedRef.current) return;
    navigatedRef.current = true;
    router.back();
  }, [router]);

  const handleLeave = useCallback(async () => {
    if (ending) return;
    setEnding(true);
    if (activeSession) await endCall();
    else if (waiting) await cancelCall();
    await callSoundService.stopWaitingRing();
    goBackOnce();
  }, [activeSession, cancelCall, endCall, ending, goBackOnce, waiting]);

  const handleConnected = useCallback(() => {
    setJoined(true);
    setFatalError(null);
    void callSoundService.playJoinChime();
  }, []);

  const handleDisconnected = useCallback(() => {
    setJoined(false);
  }, []);

  const handleError = useCallback((error: Error) => {
    console.error('[Patient] LiveKit error:', error);
    setFatalError(error.message || 'The video call failed.');
  }, []);

  const noCall = initialized && !currentSession;
  const ended = noCall && (joined || remoteLeft || Boolean(fatalError));
  const terminal = recentTerminal?.aid === String(aid) ? recentTerminal : null;
  const terminalCopy = terminal && terminal.status !== 'ended' ? callTerminalMessage(terminal) : null;

  if (!initialized || isIdentityLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading consultation...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (noCall) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Live Consultation</Text>
          <TouchableOpacity onPress={goBackOnce} style={styles.closeButton}>
            <X size={16} color={COLORS.danger} />
            <Text style={styles.closeText}>Close</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.centerContent}>
          <View style={styles.statusIcon}>
            <PhoneOff size={28} color={COLORS.primary} />
          </View>
          <Text style={styles.statusTitle}>
            {terminalCopy ? terminalCopy.title : ended ? 'Call ended' : 'No active call'}
          </Text>
          <Text style={styles.statusText}>
            {terminalCopy
              ? terminalCopy.detail ?? 'The consultation call ended before it was connected.'
              : ended
                ? 'The consultation call has ended. Your appointment remains available in your visit history.'
                : 'Start a call from the appointment or chat screen when the consultation window is open.'}
          </Text>
          <TouchableOpacity style={styles.primaryButton} onPress={goBackOnce}>
            <Text style={styles.primaryButtonText}>Back to appointments</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Live Consultation</Text>
          {currentSession?.peer?.name ? (
            <Text style={styles.subtitle}>{currentSession.peer.name}</Text>
          ) : null}
        </View>
        <View style={styles.headerRight}>
          <Text style={styles.timer}>{formatDuration(elapsed)}</Text>
          <TouchableOpacity onPress={() => { void handleLeave(); }} style={styles.closeButton} disabled={ending}>
            <X size={16} color={COLORS.danger} />
            <Text style={styles.closeText}>Leave</Text>
          </TouchableOpacity>
        </View>
      </View>

      {LiveKitCall && liveToken && serverUrl ? (
        <LiveKitCall
          serverUrl={serverUrl}
          token={liveToken}
          onConnected={handleConnected}
          onDisconnected={handleDisconnected}
          onError={handleError}
          onRemoteLeft={() => setRemoteLeft(true)}
        />
      ) : null}

      {nativeMissing ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>Native module not found</Text>
          <Text style={styles.errorText}>
            The LiveKit video engine is not linked into this build. Rebuild the app with {'\n'}
            npx expo run:android {'\n'}
            and install it on the device (this will not work in Expo Go).
          </Text>
        </View>
      ) : fatalError ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>Could not join the call</Text>
          <Text style={styles.errorText}>{fatalError}</Text>
          <TouchableOpacity onPress={() => { void handleLeave(); }} style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>End call</Text>
          </TouchableOpacity>
        </View>
      ) : waiting ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Waiting for the doctor to answer...</Text>
        </View>
      ) : !serverUrl ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>Call is not configured</Text>
          <Text style={styles.errorText}>Missing EXPO_PUBLIC_LIVEKIT_URL in this build.</Text>
        </View>
      ) : !liveToken ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Securing call token...</Text>
        </View>
      ) : !joined ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Connecting to secure room...</Text>
        </View>
      ) : null}

      {remoteLeft && joined ? (
        <View style={styles.notice}>
          <Text style={styles.noticeText}>The other participant left the call.</Text>
          <TouchableOpacity onPress={() => { void handleLeave(); }} style={styles.noticeButton}>
            <Text style={styles.noticeButtonText}>End call</Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGray,
  },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { color: COLORS.text, fontSize: 16, fontFamily: FONTS.bold },
  subtitle: { color: COLORS.gray, fontSize: 12, marginTop: 2, fontFamily: FONTS.regular },
  timer: { color: COLORS.primary, fontSize: 13, fontFamily: FONTS.bold, fontVariant: ['tabular-nums'] },
  closeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.dangerLight,
    paddingHorizontal: 14,
    justifyContent: 'center',
    borderRadius: 8,
    height: 36,
  },
  closeText: { color: COLORS.danger, fontFamily: FONTS.bold, marginLeft: 6, fontSize: 13 },
  loadingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    zIndex: 10,
    padding: 24,
  },
  loadingText: { color: COLORS.gray, marginTop: 16, fontSize: 14, fontFamily: FONTS.medium },
  errorContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    padding: 24,
    zIndex: 20,
  },
  errorTitle: { color: COLORS.danger, fontSize: 18, fontFamily: FONTS.bold, marginBottom: 12, textAlign: 'center' },
  errorText: {
    color: COLORS.gray,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 22,
    fontFamily: FONTS.regular,
    marginBottom: 20,
  },
  centerContent: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28 },
  statusIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  statusTitle: { color: COLORS.text, fontSize: 22, fontFamily: FONTS.bold, marginBottom: 8 },
  statusText: {
    color: COLORS.gray,
    fontSize: 14,
    lineHeight: 22,
    textAlign: 'center',
    fontFamily: FONTS.regular,
    marginBottom: 24,
  },
  primaryButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    height: 46,
  },
  primaryButtonText: { color: COLORS.white, fontFamily: FONTS.bold, fontSize: 14 },
  notice: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 28,
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 14,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  noticeText: { color: COLORS.text, fontSize: 13, fontFamily: FONTS.medium, marginBottom: 10 },
  noticeButton: {
    backgroundColor: COLORS.danger,
    height: 38,
    paddingHorizontal: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
  },
  noticeButtonText: { color: COLORS.white, fontFamily: FONTS.bold, fontSize: 13 },
});
