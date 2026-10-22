'use client';

export const dynamic = 'force-dynamic';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Video } from 'lucide-react';
import toast from 'react-hot-toast';
import { TranslatedText } from '@/app/components/TranslatedText';
import { useLanguage } from '@/app/contexts/LanguageContext';
import { useNameTransliteration } from '@/app/hooks/useNameTransliteration';
import { useAuthToken } from '@/lib/auth-token-context';
import { fetchWithAuth } from '@/lib/fetchWithAuth';
import { formatDate } from '@/lib/formatDate';
import ConsentModal from '@/app/components/ConsentModal';

export default function PatientVideoCallPage() {
  const token = useAuthToken();
  const { translate } = useLanguage();
  const { transliterateName } = useNameTransliteration();
  const params = useParams();
  const router = useRouter();
  const aid = (params?.aid as string) || '';
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [appointmentData, setAppointmentData] = useState<any>(null);
  const zpRef = useRef<any>(null);
  const [callStartTime, setCallStartTime] = useState<Date | null>(null);
  const [callDurationSeconds, setCallDurationSeconds] = useState<number>(0);
  const [showPostCallScreen, setShowPostCallScreen] = useState(false);
  const [liveTimerInterval, setLiveTimerInterval] = useState<NodeJS.Timeout | null>(null);
  const [doctorName, setDoctorName] = useState('');
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [consentLoading, setConsentLoading] = useState(false);
  const liveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const pollRef = useRef<NodeJS.Timeout | null>(null);
  const endPollRef = useRef<NodeJS.Timeout | null>(null);
  const hasLeftRoom = useRef(false);
  const callStartTimeRef = useRef<Date | null>(null);
  const autoEndTimerRef = useRef<NodeJS.Timeout | null>(null);
  const tokenRef = useRef<string | null>(null);
  tokenRef.current = token;

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Use CAPTURE PHASE (true) so our handler runs BEFORE Next.js dev overlay handler.
    // This prevents ZegoCloud's internal async errors from showing the error screen.
    const suppressErrors = (event: ErrorEvent) => {
      if (event.message?.includes('createSpan') || event.message?.includes('Cannot read properties of null')) {
        event.preventDefault();
        event.stopImmediatePropagation();
        return true;
      }
    };
    const suppressRejections = (event: PromiseRejectionEvent) => {
      // Suppress all unhandled rejections on this page — ZegoCloud fires internal
      // async errors after destroy() that crash Next.js dev overlay
      event.preventDefault();
      event.stopImmediatePropagation();
    };
    window.addEventListener('error', suppressErrors as any, true);
    window.addEventListener('unhandledrejection', suppressRejections, true);

    return () => {
      if (timer.current) clearTimeout(timer.current);
      window.removeEventListener('error', suppressErrors as any, true);
      window.removeEventListener('unhandledrejection', suppressRejections, true);
      // NOTE: do NOT reset hasLeftRoom here — cleanup fires during React StrictMode
      // double-mount and we don't want to allow onLeaveRoom to re-trigger leave flow
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
      if (endPollRef.current) { clearInterval(endPollRef.current); endPollRef.current = null; }
      if (liveTimerRef.current) { clearInterval(liveTimerRef.current); liveTimerRef.current = null; }
      if (autoEndTimerRef.current) { clearTimeout(autoEndTimerRef.current); autoEndTimerRef.current = null; }
      // Null zpRef FIRST — onLeaveRoom checks this to detect cleanup-triggered destroy
      const zp = zpRef.current;
      zpRef.current = null;
      if (zp) { try { zp.destroy(); } catch (_) {} }
    };
  }, [aid]);

  const timer = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (consentAccepted) {
      timer.current = setTimeout(() => { fetchAppointmentAndInitCall(); }, 500);
    }
    return () => {
      if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    };
  }, [consentAccepted]);

  async function fetchAppointmentAndInitCall() {
    const timeoutId = setTimeout(async () => {
      const msg = await translate('Connection timeout — please check your camera/microphone permissions and internet connection');
      setError(msg); toast.error(msg); setLoading(false);
    }, 15000);

    try {
      if (!containerRef.current) throw new Error('Video container not ready');

      const syncResponse = await fetchWithAuth('/api/sync-user', token);
      const { user } = await syncResponse.json();
      if (!user) throw new Error('User not authenticated');

      const response = await fetchWithAuth('/api/patient/appointments', token);
      const data = await response.json();
      if (!data.success) throw new Error('Failed to load appointments');

      const appointment = data.appointments.find((apt: any) => apt.aid === aid);
      if (!appointment) throw new Error('Appointment not found');

      setAppointmentData(appointment);
      const transliteratedName = await transliterateName(appointment.doctor?.user?.name || 'Doctor');
      setDoctorName(transliteratedName);

      const { ZegoUIKitPrebuilt } = await import('@zegocloud/zego-uikit-prebuilt');

      const roomID = `appointment_${aid}`;

      // The kit token is minted SERVER-SIDE by /api/calls/zego-token, which
      // verifies the Clerk session, checks this patient owns the appointment, and
      // never exposes ZEGO_SERVER_SECRET. This page used to call
      // `generateKitTokenForTest(appID, serverSecret, ...)` with a secret read
      // from NEXT_PUBLIC_ZEGO_SERVER_SECRET, which published the full ZEGO
      // credential to every browser and let anyone mint tokens for any room.
      const tokenRes = await fetchWithAuth('/api/calls/zego-token', token, {
        method: 'POST',
        body: JSON.stringify({ roomId: roomID }),
      });
      const tokenData = await tokenRes.json();

      if (!tokenRes.ok || !tokenData?.success || !tokenData?.token) {
        throw new Error(tokenData?.error || 'Could not authorise the video session.');
      }

      const zp = ZegoUIKitPrebuilt.create(tokenData.token);
      zpRef.current = zp;

      zp.joinRoom({
        container: containerRef.current,
        scenario: { mode: ZegoUIKitPrebuilt.OneONoneCall },
        showPreJoinView: false,
        showScreenSharingButton: false,
        showRoomTimer: true,
        maxUsers: 2,
        onLeaveRoom: () => {
          // KEY GUARD: if zpRef is null, this onLeaveRoom was fired by our own
          // cleanup/destroy call (React StrictMode, component unmount, or our
          // post-call destroy). Ignore it — do NOT end the call.
          if (zpRef.current === null) return;
          if (hasLeftRoom.current) return;
          clearTimeout(timeoutId);
          triggerLeaveFlow(false); // patient ended — we write to DB
        },
        onJoinRoom: () => {
          hasLeftRoom.current = false;
          clearTimeout(timeoutId);
          pollForStartTime();
        },
        onUserJoin: (users: any) => { console.log('[PATIENT] Doctor joined:', users); },
        onUserLeave: (users: any) => {
          console.log('[PATIENT] Doctor left:', users);
          if (users.length > 0 && !hasLeftRoom.current) {
            // Give doctor 4s to write DB, then read authoritative values
            setTimeout(() => {
              if (!hasLeftRoom.current) triggerLeaveFlow(true);
            }, 4000);
          }
        },
      });

      clearTimeout(timeoutId);
      setLoading(false);
    } catch (err: any) {
      console.error('[PATIENT] Video call error:', err);
      clearTimeout(timeoutId);
      const errorMsg = await translate(err.message || 'Failed to join video call');
      setError(errorMsg); toast.error(errorMsg); setLoading(false);
      setTimeout(() => router.push('/dashboard/appointments'), 3000);
    }
  }

  async function handleConsentAccept() {
    setConsentLoading(true);
    try {
      await fetchWithAuth(`/api/appointments/${aid}/consent`, token, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ consent_ip: '' }),
      });
    } catch { /* consent recording is non-critical */ }
    setConsentAccepted(true);
    setConsentLoading(false);
  }

  function handleConsentDecline() {
    const msg = 'You must accept the consent to proceed with the video call.';
    toast.error(msg);
    router.push('/dashboard/appointments');
  }

  async function triggerLeaveFlow(preferDbValues: boolean) {
    if (hasLeftRoom.current) return;
    hasLeftRoom.current = true;

    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    if (endPollRef.current) { clearInterval(endPollRef.current); endPollRef.current = null; }
    if (liveTimerRef.current) { clearInterval(liveTimerRef.current); liveTimerRef.current = null; }
    if (autoEndTimerRef.current) { clearTimeout(autoEndTimerRef.current); autoEndTimerRef.current = null; }

    let durationSec = 0;

    if (!preferDbValues) {
      // WE are ending — compute locally and write to DB
      const endTime = new Date();
      const st = callStartTimeRef.current;
      durationSec = st ? Math.floor((endTime.getTime() - st.getTime()) / 1000) : 0;
      console.log(`[PATIENT] Ending — started: ${st?.toISOString()}, duration: ${durationSec}s`);
      await saveCallDuration(st || endTime, endTime, durationSec);
    } else {
      // OTHER side ended — read authoritative values from DB
      try {
        const res = await fetchWithAuth(`/api/appointments/${aid}/status`, tokenRef.current);
        const d = await res.json();
        // patient_view: postgres.camel → callEndedAt, callStartedAt
        if (d.success && d.data?.callEndedAt) {
          const dbEnd = new Date(d.data.callEndedAt);
          const dbStart = d.data.callStartedAt ? new Date(d.data.callStartedAt) : callStartTimeRef.current;
          if (dbStart) durationSec = Math.max(0, Math.floor((dbEnd.getTime() - dbStart.getTime()) / 1000));
          console.log(`[PATIENT] Read DB duration: ${durationSec}s`);
        }
      } catch (e) { console.error('[PATIENT] Failed to read DB duration:', e); }
    }

    setCallDurationSeconds(durationSec);
    if (durationSec > 0) {
      translate('Call ended. Duration:').then(label =>
        toast.success(`${label} ${Math.floor(durationSec / 60)} min ${durationSec % 60} sec`)
      );
    }
    setShowPostCallScreen(true);

    // Destroy AFTER DB write + modal is shown.
    // Null zpRef first so any onLeaveRoom fired by destroy() is ignored (see guard above).
    setTimeout(() => {
      const zp = zpRef.current;
      zpRef.current = null;
      if (zp) { try { zp.destroy(); } catch (_) {} }
    }, 1000);
  }

  async function saveCallDuration(startTime: Date, endTime: Date, durationSec: number) {
    const durationMinutes = Math.round(durationSec / 60);
    const body = JSON.stringify({
      start_time: startTime.toISOString(),
      end_time: endTime.toISOString(),
      duration_minutes: durationMinutes,
    });
    console.log(`[PATIENT] saveCallDuration — mins: ${durationMinutes}`);
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (tokenRef.current) headers['Authorization'] = `Bearer ${tokenRef.current}`;
      // keepalive:true — request survives even if ZegoCloud crashes the JS runtime
      const res = await fetch(`/api/appointments/${aid}/call-duration`, {
        method: 'PATCH', headers, body, keepalive: true,
      });
      const json = await res.json();
      console.log('[PATIENT] call-duration response:', json);
    } catch (err) {
      console.error('[PATIENT] saveCallDuration failed:', err);
    }
  }

  async function pollForStartTime() {
    const startTime = await checkCallStatus();
    if (startTime) { startTimer(startTime); return; }

    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    const pollInterval = setInterval(async () => {
      const time = await checkCallStatus();
      if (time) {
        clearInterval(pollInterval);
        pollRef.current = null;
        startTimer(time);
      }
    }, 2000);
    pollRef.current = pollInterval;
  }

  async function checkCallStatus() {
    try {
      const response = await fetchWithAuth(`/api/appointments/${aid}/status`, tokenRef.current);
      const data = await response.json();
      // patient_view: postgres.camel → call_started_at becomes callStartedAt
      if (data.success && data.data?.callStartedAt) return new Date(data.data.callStartedAt);
      return null;
    } catch { return null; }
  }

  function startTimer(startTime: Date) {
    setCallStartTime(startTime);
    callStartTimeRef.current = startTime;

    if (liveTimerRef.current) clearInterval(liveTimerRef.current);
    liveTimerRef.current = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTime.getTime()) / 1000);
      setCallDurationSeconds(elapsed >= 0 ? elapsed : 0);
    }, 1000);

    // Auto-end exactly 10 min from call_started_at
    if (autoEndTimerRef.current) clearTimeout(autoEndTimerRef.current);
    const msUntilAutoEnd = startTime.getTime() + 10 * 60 * 1000 - Date.now();
    if (msUntilAutoEnd > 0) {
      autoEndTimerRef.current = setTimeout(() => {
        if (!hasLeftRoom.current) triggerLeaveFlow(false);
      }, msUntilAutoEnd);
    }

    // Poll every 5s — catches if doctor ends call even via tab close
    startEndPoll();
  }

  function startEndPoll() {
    if (endPollRef.current) return;
    const interval = setInterval(async () => {
      if (hasLeftRoom.current) { clearInterval(interval); endPollRef.current = null; return; }
      try {
        const response = await fetchWithAuth(`/api/appointments/${aid}/status`, tokenRef.current);
        const data = await response.json();
        if (data.success && data.data?.status === 'completed' && !hasLeftRoom.current) {
          clearInterval(interval);
          endPollRef.current = null;
          triggerLeaveFlow(true);
        }
      } catch {}
    }, 5000);
    endPollRef.current = interval;
  }

  return (
    <div className="fixed inset-0 z-30 bg-forest-900">
      <div
        ref={containerRef}
        className="w-full h-full"
        style={{ display: (loading || error || showPostCallScreen) ? 'none' : 'block' }}
      />

      {!consentAccepted && !error && !showPostCallScreen && (
        <ConsentModal
          onAccept={handleConsentAccept}
          onDecline={handleConsentDecline}
          isLoading={consentLoading}
        />
      )}

      {loading && consentAccepted && !callStartTime && (
        <div className="absolute inset-0 flex flex-col items-center justify-center z-50 bg-gradient-to-br from-forest-900 to-forest-700">
          <div className="spinner border-sage-300 border-t-sage-400 mb-4" />
          <p className="font-medium text-white mb-1"><TranslatedText>Joining video call...</TranslatedText></p>
          <p className="text-sm text-sage-300"><TranslatedText>Please allow camera and microphone access</TranslatedText></p>
        </div>
      )}

      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center z-50 bg-gradient-to-br from-forest-900 to-forest-800">
          <div className="bg-white rounded-3xl p-5 sm:p-8 max-w-[min(90vw,28rem)] w-full mx-4 text-center shadow-forest-xl">
            <div className="w-14 h-14 bg-[var(--error-container)] rounded-full flex items-center justify-center mx-auto mb-4">
              <Video className="w-7 h-7 text-[var(--status-error)]" />
            </div>
            <h2 className="text-xl font-bold font-display text-forest-900 mb-2"><TranslatedText>Connection Failed</TranslatedText></h2>
            <p className="text-forest-400 mb-5">{error}</p>
            <button onClick={() => router.push('/dashboard/appointments')} className="btn-primary px-6 py-2.5 w-full">
              <TranslatedText>Back to Appointments</TranslatedText>
            </button>
          </div>
        </div>
      )}

      {callStartTime && !showPostCallScreen && (
        <div className="absolute top-3 right-3 sm:top-4 sm:right-4 bg-white/90 backdrop-blur-sm px-2 py-1.5 sm:px-4 sm:py-2 rounded-xl shadow-forest-md z-10">
          <p className="text-xs sm:text-sm font-bold text-forest-900">
            <TranslatedText>Duration:</TranslatedText> {Math.floor(callDurationSeconds / 60)}:{String(callDurationSeconds % 60).padStart(2, '0')}
          </p>
        </div>
      )}

      {/* Emergency disclaimer */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-black/60 backdrop-blur-sm px-3 py-1.5 rounded-full z-10 max-w-[90vw]">
        <p className="text-[10px] text-white/80 whitespace-nowrap">
          <strong>AuraSutra</strong> is a practitioner directory. For emergencies, <strong>call 112</strong>.
        </p>
      </div>

      {appointmentData && !loading && !error && callStartTime && !showPostCallScreen && (
        <div className="absolute bottom-2 left-2 sm:bottom-auto sm:top-4 sm:left-4 bg-white/90 backdrop-blur-sm px-2 py-1.5 sm:px-3 sm:py-2 rounded-xl max-w-[min(80vw,280px)] shadow-forest-md z-10">
          <div className="flex items-center gap-3">
            {appointmentData.doctor?.user?.profileImageUrl ? (
              <img
                src={appointmentData.doctor.user.profileImageUrl}
                alt={doctorName || appointmentData.doctor?.user?.name}
                className="w-7 h-7 sm:w-8 sm:h-8 rounded-full object-cover border border-sage-200"
              />
            ) : (
              <div className="w-7 h-7 sm:w-8 sm:h-8 bg-sage-100 rounded-full flex items-center justify-center">
                <Video className="w-4 h-4 text-forest-500" />
              </div>
            )}
            <div>
              <p className="text-xs sm:text-sm font-bold text-forest-900 devanagari-small">
                {doctorName || appointmentData.doctor?.user?.name || 'Doctor'}
              </p>
              <p className="text-xs text-forest-400">
                <TranslatedText>{appointmentData.doctor?.specialization || 'Specialist'}</TranslatedText>
              </p>
            </div>
          </div>
        </div>
      )}

      {showPostCallScreen && appointmentData && (
        <div className="absolute inset-0 flex items-center justify-center z-50 bg-gradient-to-br from-forest-900 to-forest-700 p-4">
          <div className="bg-white rounded-3xl shadow-forest-xl p-4 sm:p-6 max-w-[min(90vw,24rem)] w-full">
            <div className="text-center mb-5">
              <div className="w-14 h-14 bg-sage-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <Video className="w-7 h-7 text-forest-500" />
              </div>
              <h2 className="text-lg sm:text-2xl font-bold font-display text-forest-900 mb-1">
                <TranslatedText>Consultation Completed!</TranslatedText>
              </h2>
              <p className="text-forest-400 text-sm">
                <TranslatedText>Call Duration:</TranslatedText>{' '}
                <span className="font-bold text-forest-500">
                  {Math.floor(callDurationSeconds / 60)} <TranslatedText>min</TranslatedText> {callDurationSeconds % 60} <TranslatedText>sec</TranslatedText>
                </span>
              </p>
            </div>

            {/* Doctor Summary Card */}
            <div className="bg-sage-50 rounded-2xl p-6 mb-8 border border-sage-100">
              <div className="flex items-center gap-4 mb-4">
                {appointmentData.doctor?.user?.profileImageUrl ? (
                  <img
                    src={appointmentData.doctor.user.profileImageUrl}
                    alt={doctorName || appointmentData.doctor?.user?.name}
                    className="w-12 h-12 rounded-full object-cover border border-sage-200"
                  />
                ) : (
                  <div className="w-12 h-12 bg-sage-200 text-forest-700 rounded-full flex items-center justify-center text-lg font-bold">
                    {(doctorName || appointmentData.doctor?.user?.name)?.charAt(0) || 'D'}
                  </div>
                )}
                <div className="flex-1">
                  <p className="text-xs font-bold tracking-wider text-forest-400 uppercase"><TranslatedText>Consulted with</TranslatedText></p>
                  <p className="font-bold text-forest-900 text-lg devanagari-small">
                    {doctorName || appointmentData.doctor?.user?.name}
                  </p>
                  <p className="text-sm text-forest-400">
                    <TranslatedText>{appointmentData.doctor?.specialization}</TranslatedText>
                  </p>
                </div>
              </div>
              <div className="border-t border-sage-200 pt-3">
                <p className="text-[10px] font-bold tracking-wider text-forest-400 uppercase mb-0.5"><TranslatedText>Appointment Date</TranslatedText></p>
                <p className="text-sm text-forest-800">
                  {formatDate(appointmentData.scheduledDate)} at {appointmentData.scheduledTime}
                </p>
              </div>
            </div>
            <div className="space-y-2">
              <button onClick={() => router.push('/dashboard/appointments?tab=history')} className="btn-primary w-full py-3 shadow-primary">
                ✓ <TranslatedText>View Appointment History</TranslatedText>
              </button>
              <p className="text-center text-xs text-forest-400">
                <TranslatedText>Your doctor may send you a prescription shortly</TranslatedText>
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
