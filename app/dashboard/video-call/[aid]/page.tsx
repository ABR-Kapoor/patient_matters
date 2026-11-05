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
import { useCall } from '@/app/components/CallProvider';

export default function PatientVideoCallPage() {
  const token = useAuthToken();
  const { translate } = useLanguage();
  const { transliterateName } = useNameTransliteration();
  const { session, recentTerminal, refresh, endCall } = useCall();
  const params = useParams();
  const router = useRouter();
  const aid = (params?.aid as string) || '';
  const containerRef = useRef<HTMLDivElement>(null);
  const zpRef = useRef<any>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startRef = useRef<Date | null>(null);
  const hasLeftRef = useRef(false);
  const joinedRef = useRef(false);
  const sawActiveRef = useRef(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [appointmentData, setAppointmentData] = useState<any>(null);
  const [doctorName, setDoctorName] = useState('');
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [consentLoading, setConsentLoading] = useState(false);
  const [callDurationSeconds, setCallDurationSeconds] = useState(0);
  const [showPostCallScreen, setShowPostCallScreen] = useState(false);

  const clearTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const destroyZego = () => {
    const zp = zpRef.current;
    zpRef.current = null;
    if (zp) {
      try { zp.destroy(); } catch {}
    }
  };

  const finishCall = (acceptedAt: string | null, endedAt: string | null) => {
    if (hasLeftRef.current && showPostCallScreen) return;
    hasLeftRef.current = true;
    clearTimer();
    const start = acceptedAt ? new Date(acceptedAt) : startRef.current;
    const end = endedAt ? new Date(endedAt) : new Date();
    const seconds = start ? Math.max(0, Math.floor((end.getTime() - start.getTime()) / 1000)) : 0;
    setCallDurationSeconds(seconds);
    setShowPostCallScreen(true);
    if (seconds > 0) {
      void translate('Call ended. Duration:').then(label => {
        toast.success(`${label} ${Math.floor(seconds / 60)} min ${seconds % 60} sec`);
      });
    }
    window.setTimeout(destroyZego, 800);
  };

  useEffect(() => {
    if (!consentAccepted) return;
    const timer = window.setTimeout(() => { void initializeCall(); }, 300);
    return () => window.clearTimeout(timer);
  }, [consentAccepted, aid]);

  useEffect(() => {
    if (!joinedRef.current || showPostCallScreen || hasLeftRef.current) return;
    const activeForThisCall = session?.aid === aid && session.status === 'active';
    if (activeForThisCall) {
      sawActiveRef.current = true;
      return;
    }
    if (!sawActiveRef.current) return;
    const terminal = recentTerminal?.aid === aid ? recentTerminal : null;
    if (terminal || session === null) {
      finishCall(terminal?.acceptedAt ?? startRef.current?.toISOString() ?? null, terminal?.endedAt ?? null);
    }
  }, [aid, recentTerminal, session, showPostCallScreen]);

  useEffect(() => () => {
    clearTimer();
    const zp = zpRef.current;
    zpRef.current = null;
    if (zp) {
      try { zp.destroy(); } catch {}
    }
  }, []);

  async function fetchActiveSession() {
    try {
      const response = await fetchWithAuth('/api/calls/active', token);
      const data = await response.json();
      if (data.success && data.session?.aid === aid && data.session.status === 'active') {
        return data.session;
      }
    } catch {}
    return null;
  }

  async function initializeCall() {
    const timeoutId = window.setTimeout(async () => {
      const msg = await translate('Connection timeout — please check your camera/microphone permissions and internet connection');
      setError(msg);
      setLoading(false);
    }, 15000);

    try {
      if (!containerRef.current) throw new Error('Video container not ready');

      let activeSession = session?.aid === aid && session.status === 'active' ? session : null;
      if (!activeSession) {
        activeSession = await fetchActiveSession();
        if (!activeSession) {
          await refresh();
          activeSession = await fetchActiveSession();
        }
      }
      if (!activeSession) throw new Error('This call is no longer active.');

      if (!appointmentData) {
        const response = await fetchWithAuth('/api/patient/appointments', token);
        const data = await response.json();
        if (!data.success) throw new Error('Failed to load appointments');
        const appointment = data.appointments.find((apt: any) => apt.aid === aid);
        if (!appointment) throw new Error('Appointment not found');
        setAppointmentData(appointment);
        const transliterated = await transliterateName(appointment.doctor?.user?.name || 'Doctor');
        setDoctorName(transliterated);
      }

      const tokenRes = await fetchWithAuth('/api/calls/zego-token', token, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId: `appointment_${aid}` }),
      });
      const tokenData = await tokenRes.json();
      if (!tokenRes.ok || !tokenData?.success || !tokenData?.token) {
        throw new Error(tokenData?.error || 'Could not authorise the video session.');
      }

      const { ZegoUIKitPrebuilt } = await import('@zegocloud/zego-uikit-prebuilt');
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
          if (zpRef.current === null) return;
          void leaveAndEnd();
        },
        onJoinRoom: () => {
          joinedRef.current = true;
          hasLeftRef.current = false;
          const start = activeSession.acceptedAt ? new Date(activeSession.acceptedAt) : new Date();
          startRef.current = start;
          clearTimer();
          timerRef.current = setInterval(() => {
            setCallDurationSeconds(Math.max(0, Math.floor((Date.now() - start.getTime()) / 1000)));
          }, 1000);
          setLoading(false);
        },
        onUserJoin: () => {},
        onUserLeave: () => {
          if (!hasLeftRef.current) toast('The doctor left the call');
        },
      });

      window.clearTimeout(timeoutId);
    } catch (err: any) {
      window.clearTimeout(timeoutId);
      console.error('[PATIENT] Video call error:', err);
      const message = await translate(err?.message || 'Failed to join video call');
      setError(message);
      setLoading(false);
    }
  }

  async function handleConsentAccept() {
    setConsentLoading(true);
    try {
      await fetchWithAuth(`/api/appointments/${aid}/consent`, token, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ consent_ip: '' }),
      });
    } catch {}
    setConsentAccepted(true);
    setConsentLoading(false);
  }

  function handleConsentDecline() {
    toast.error('You must accept the consent to proceed with the video call.');
    router.push('/dashboard/appointments');
  }

  async function leaveAndEnd() {
    if (hasLeftRef.current) return;
    hasLeftRef.current = true;
    clearTimer();
    try {
      await endCall();
    } catch {}
    finishCall(session?.acceptedAt ?? startRef.current?.toISOString() ?? null, new Date().toISOString());
  }

  const doctorImage = appointmentData?.doctor?.user?.profileImageUrl;

  return (
    <div className="fixed inset-0 z-30 bg-forest-900">
      <div
        ref={containerRef}
        className="w-full h-full"
        style={{ display: loading || error || showPostCallScreen ? 'none' : 'block' }}
      />

      {!consentAccepted && !error && !showPostCallScreen && (
        <ConsentModal
          onAccept={handleConsentAccept}
          onDecline={handleConsentDecline}
          isLoading={consentLoading}
        />
      )}

      {loading && consentAccepted && !error && (
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

      {!loading && !showPostCallScreen && (
        <div className="absolute top-3 right-3 sm:top-4 sm:right-4 bg-white/90 backdrop-blur-sm px-2 py-1.5 sm:px-4 sm:py-2 rounded-xl shadow-forest-md z-10">
          <p className="text-xs sm:text-sm font-bold text-forest-900">
            <TranslatedText>Duration:</TranslatedText> {Math.floor(callDurationSeconds / 60)}:{String(callDurationSeconds % 60).padStart(2, '0')}
          </p>
        </div>
      )}

      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-black/60 backdrop-blur-sm px-3 py-1.5 rounded-full z-10 max-w-[90vw]">
        <p className="text-[10px] text-white/80 whitespace-nowrap">
          <strong>AuraSutra</strong> is a practitioner directory. For emergencies, <strong>call 112</strong>.
        </p>
      </div>

      {appointmentData && !loading && !error && !showPostCallScreen && (
        <div className="absolute bottom-2 left-2 sm:bottom-auto sm:top-4 sm:left-4 bg-white/90 backdrop-blur-sm px-2 py-1.5 sm:px-3 sm:py-2 rounded-xl max-w-[min(80vw,280px)] shadow-forest-md z-10">
          <div className="flex items-center gap-3">
            {doctorImage ? (
              <img src={doctorImage} alt={doctorName || appointmentData.doctor?.user?.name} className="w-7 h-7 sm:w-8 sm:h-8 rounded-full object-cover border border-sage-200" />
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

            <div className="bg-sage-50 rounded-2xl p-6 mb-8 border border-sage-100">
              <div className="flex items-center gap-4 mb-4">
                {doctorImage ? (
                  <img src={doctorImage} alt={doctorName || appointmentData.doctor?.user?.name} className="w-12 h-12 rounded-full object-cover border border-sage-200" />
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
