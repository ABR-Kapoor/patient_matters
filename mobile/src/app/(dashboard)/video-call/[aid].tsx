import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Platform, PermissionsAndroid } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X } from 'lucide-react-native';
import { useAuthToken, usePatientIdentity } from '../../../hooks/stubs';
import { fetchWithAuth } from '../../../lib/fetchWithAuth';
import { callSoundService } from '../../../lib/callSoundService';

const COLORS = {
  primary: '#048256',
  primaryLight: '#EDF7E3',
  text: '#030315',
  background: '#F2F1F0',
  white: '#FFFFFF',
  gray: '#9CA3AF',
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

const serverUrl = process.env.EXPO_PUBLIC_LIVEKIT_URL;

type Phase = 'identity' | 'config' | 'token' | 'joining' | 'live';

const PHASE_TEXT: Record<Exclude<Phase, 'live'>, string> = {
  identity: 'Loading profile...',
  config: 'Missing EXPO_PUBLIC_LIVEKIT_URL',
  token: 'Securing call token...',
  joining: 'Connecting to secure room...',
};

export default function VideoCallPage() {
  const { aid } = useLocalSearchParams();
  const router = useRouter();
  const token = useAuthToken();
  const { data: identity, isLoading: isIdentityLoading } = usePatientIdentity(token);

  const [liveToken, setLiveToken] = useState<string | null>(null);
  const [joined, setJoined] = useState(false);
  const [fatalError, setFatalError] = useState<string | null>(null);
  const [nativeMissing, setNativeMissing] = useState(false);

  const [LiveKitCall, setLiveKitCall] = useState<
    React.ComponentType<React.ComponentProps<typeof import('../../../components/LiveKitCall')['default']>> | null
  >(null);

  const tokenFetched = useRef(false);
  const joinedRef = useRef(false);
  const endedRef = useRef(false);
  const remoteLeftRef = useRef(false);
  const navigatedRef = useRef(false);

  const identityUid = identity?.uid;

  // Deterministic user ID derived from the Supabase UUID. No random suffix: the same
  // identity on every mount keeps a single LiveKit participant rather than a ghost
  // user that disconnects immediately and looks like the peer hung up.
  const stableUserID = useMemo(() => {
    if (!identityUid) return null;
    return String(identityUid).replace(/-/g, '').trim().slice(0, 64) || null;
  }, [identityUid]);

  const roomID = useMemo(() => {
    if (!aid) return null;
    return ('appointment_' + String(aid)).trim().slice(0, 64);
  }, [aid]);

  // LiveKit ships native WebRTC code, so it has to be pulled in at runtime. In Expo Go the
  // import rejects, and a clear message beats a red screen or a silent blank view.
  useEffect(() => {
    let cancelled = false;
    import('../../../components/LiveKitCall')
      .then((m) => {
        if (!cancelled) setLiveKitCall(() => m.default);
      })
      .catch((e) => {
        console.error('[Patient] Could not load the LiveKit module:', e);
        if (!cancelled) setNativeMissing(true);
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    async function fetchToken() {
      if (!stableUserID || !roomID || tokenFetched.current) return;
      tokenFetched.current = true;

      try {
        const response = await fetchWithAuth('/api/calls/livekit-token', token, {
          method: 'POST',
          // Only the room is requested. The server derives the LiveKit identity
          // and display name from the Clerk session and verifies this patient
          // owns the appointment, so a client-supplied userId/name is ignored �
          // and sending one only invites confusion about which is authoritative.
          body: JSON.stringify({ roomId: roomID }),
        });
        const data = await response.json();

        if (response.status === 401) {
          tokenFetched.current = false;
          setFatalError('Your session has expired. Sign in again to rejoin.');
          return;
        }
        if (response.status === 403) {
          tokenFetched.current = false;
          setFatalError(data.message || 'You are not a participant in this consultation.');
          return;
        }
        if (data.success && data.token) {
          setLiveToken(data.token);
        } else {
          tokenFetched.current = false;
          setFatalError(data.error || 'Failed to generate a secure call token.');
        }
      } catch (err) {
        console.error('[Patient] LiveKit token fetch error:', err);
        tokenFetched.current = false;
        setFatalError('Could not reach the token server. Check your network and try again.');
      }
    }
    fetchToken();
    // Intentionally omit 'token' to prevent Clerk token instability from causing infinite reloads
  }, [stableUserID, roomID, identity?.name]);

  const requestMediaPermissions = useCallback(async () => {
    if (Platform.OS !== 'android') return;
    try {
      await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.CAMERA,
        PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
      ]);
    } catch {
      // Best-effort warm-up only; LiveKit reports real failures through onError.
    }
  }, []);

  useEffect(() => {
    requestMediaPermissions();
  }, [requestMediaPermissions]);

  const goBackOnce = useCallback(() => {
    if (navigatedRef.current) return;
    navigatedRef.current = true;
    router.back();
  }, [router]);

  const reportCallStart = useCallback(async () => {
    if (!aid) return;
    try {
      const res = await fetchWithAuth(`/api/appointments/${String(aid)}/start-call`, token, { method: 'POST' });
      const data = await res.json();
      console.log('[Patient] Call start reported:', data.success);
    } catch (err) {
      console.error('[Patient] Call start error:', err);
    }
  }, [aid, token]);

  const reportCallEnd = useCallback(async () => {
    if (!aid) return;
    try {
      const res = await fetchWithAuth(`/api/appointments/${String(aid)}/call-duration`, token, {
        method: 'PATCH',
        body: JSON.stringify({ end_time: new Date().toISOString() }),
      });
      const data = await res.json();
      console.log('[Patient] Call end reported:', data.success, data.data?.status);
    } catch (err) {
      console.error('[Patient] Call end patch error:', err);
    }
  }, [aid, token]);

  const reportCallStartRef = useRef(reportCallStart);
  const reportCallEndRef = useRef(reportCallEnd);
  const goBackOnceRef = useRef(goBackOnce);
  useEffect(() => {
    reportCallStartRef.current = reportCallStart;
    reportCallEndRef.current = reportCallEnd;
    goBackOnceRef.current = goBackOnce;
  }, [reportCallStart, reportCallEnd, goBackOnce]);

  const handleConnected = useCallback(() => {
    joinedRef.current = true;
    setJoined(true);
    setFatalError(null);
    reportCallStartRef.current();
  }, []);

  const handleDisconnected = useCallback(() => {
    setJoined(false);
  }, []);

  const handleError = useCallback((error: Error) => {
    console.error('[Patient] LiveKit error:', error);
    setFatalError(error.message || 'The video call failed.');
  }, []);

  const handleRemoteLeft = useCallback(() => {
    remoteLeftRef.current = true;
  }, []);

  // If the screen unmounts right after both sides cut the call, still record the completion
  useEffect(() => {
    return () => {
      if (joinedRef.current && remoteLeftRef.current && !endedRef.current) {
        endedRef.current = true;
        reportCallEndRef.current();
      }
    };
  }, []);

  const phase: Phase = joined
    ? 'live'
    : fatalError
    ? 'joining'
    : !stableUserID
    ? 'identity'
    : !serverUrl
    ? 'config'
    : !liveToken
    ? 'token'
    : 'joining';

  // A silent connect hangs forever: the signal can never arrive, so bound the wait.
  useEffect(() => {
    if (phase !== 'joining' || fatalError) return;
    const timer = setTimeout(() => {
      setFatalError('Timed out while joining the LiveKit room. Please try again.');
    }, 30000);
    return () => clearTimeout(timer);
  }, [phase, fatalError]);

  const handleLeave = () => {
    void callSoundService.cleanup();
    if (navigatedRef.current) return;
    if (joinedRef.current && remoteLeftRef.current && !endedRef.current) {
      endedRef.current = true;
      reportCallEndRef.current();
    }
    goBackOnceRef.current();
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Live Consultation</Text>
        <TouchableOpacity onPress={handleLeave} style={styles.closeButton}>
          <X size={16} color={COLORS.danger} />
          <Text style={styles.closeText}>Leave</Text>
        </TouchableOpacity>
      </View>

      {LiveKitCall && liveToken && serverUrl ? (
        <LiveKitCall
          serverUrl={serverUrl}
          token={liveToken}
          onConnected={handleConnected}
          onDisconnected={handleDisconnected}
          onError={handleError}
          onRemoteLeft={handleRemoteLeft}
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
          <TouchableOpacity onPress={handleLeave} style={styles.retryButton}>
            <Text style={styles.retryButtonText}>Go back</Text>
          </TouchableOpacity>
        </View>
      ) : phase !== 'live' ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>
            {isIdentityLoading && phase === 'identity' ? 'Loading profile...' : PHASE_TEXT[phase]}
          </Text>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: COLORS.white, borderBottomWidth: 1, borderBottomColor: COLORS.lightGray },
  title: { color: COLORS.text, fontSize: 16, fontFamily: FONTS.bold },
  closeButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.dangerLight, paddingHorizontal: 14, justifyContent: 'center', borderRadius: 8, height: 36 },
  closeText: { color: COLORS.danger, fontFamily: FONTS.bold, marginLeft: 6, fontSize: 13 },
  loadingContainer: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background, zIndex: 10 },
  loadingText: { color: COLORS.gray, marginTop: 16, fontSize: 14, fontFamily: FONTS.medium },
  errorContainer: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background, padding: 24, zIndex: 20 },
  errorTitle: { color: COLORS.danger, fontSize: 18, fontFamily: FONTS.bold, marginBottom: 12 },
  errorText: { color: COLORS.gray, fontSize: 14, textAlign: 'center', lineHeight: 22, fontFamily: FONTS.regular },
  retryButton: {
    marginTop: 24, backgroundColor: COLORS.primary, 
    paddingHorizontal: 20, alignItems: 'center', justifyContent: 'center', borderRadius: 8, height: 36 },
  retryButtonText: { color: '#FFFFFF', fontFamily: FONTS.bold, fontSize: 14 },
});



