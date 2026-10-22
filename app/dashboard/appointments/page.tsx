'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import {
  Calendar as CalendarIcon,
  Video,
  MapPin,
  Clock,
  User,
  X,
  ChevronRight,
  ChevronLeft,
  CheckCircle2,
  Plus,
  ShieldCheck,
  Stethoscope,
  AlertCircle,
  History,
  Hourglass,
  Ban,
  ArrowRight,
} from 'lucide-react';
import toast from 'react-hot-toast';
import Link from 'next/link';

import { TranslatedText } from '@/app/components/TranslatedText';
import { useLanguage } from '@/app/contexts/LanguageContext';
import { formatDate } from '@/lib/formatDate';
import { useAuthToken } from '@/lib/auth-token-context';
import { fetchWithAuth } from '@/lib/fetchWithAuth';
import { useNameTransliteration } from '@/app/hooks/useNameTransliteration';
import Loading from '@/app/components/Loading';
import { Prescription } from '@/app/hooks/queries/usePrescriptions';
import ReactMarkdown from 'react-markdown';
import DOMPurify from 'isomorphic-dompurify';
import { MedicineName } from '@/app/components/MedicineName';
import { usePatientStore } from '@/app/store/usePatientStore';
import { useAppointments } from '@/app/hooks/queries/useAppointments';
import { useCancelAppointment } from '@/app/hooks/mutations/useCancelAppointment';
import { useRequestRefund } from '@/app/hooks/mutations/useRequestRefund';
import { usePatientIdentity } from '@/app/hooks/queries/usePatientData';

/* ──────────────────────────────────────────────────────────
   Formatted Instructions Markdown Helper
────────────────────────────────────────────────────────── */
function FormattedInstructions({ text }: { text: string }) {
  const normalized = (text || '')
    .replace(/^\*\s+(?!\*)/gm, '- ')
    .replace(/\n{3,}/g, '\n\n');

  return (
    <ReactMarkdown
      components={{
        p: ({ children }) => (
          <p className="text-sm text-forest-800 leading-relaxed mb-2">{children}</p>
        ),
        strong: ({ children }) => (
          <strong className="font-semibold text-forest-900">{children}</strong>
        ),
        ol: ({ children }) => (
          <ol className="space-y-2 my-2">{children}</ol>
        ),
        ul: ({ children }) => (
          <ul className="space-y-1.5 my-2">{children}</ul>
        ),
        li: ({ children, ...props }) => {
          const isOrdered = (props as any).ordered;
          return isOrdered ? (
            <li className="flex gap-2.5 text-sm text-forest-800">
              <span className="flex-shrink-0 w-5 h-5 rounded-full bg-forest-600 text-white text-[10px] font-bold flex items-center justify-center mt-0.5 animate-enter">
                {(props as any).index + 1}
              </span>
              <span>{children}</span>
            </li>
          ) : (
            <li className="flex gap-2 text-sm text-forest-800 animate-enter">
              <span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-forest-500 mt-2" />
              <span>{children}</span>
            </li>
          );
        },
        h1: ({ children }) => <h1 className="text-base font-bold text-forest-900 mt-3 mb-1">{children}</h1>,
        h2: ({ children }) => <h2 className="text-sm font-bold text-forest-900 mt-3 mb-1">{children}</h2>,
        h3: ({ children }) => <h3 className="text-sm font-semibold text-forest-800 mt-2 mb-1">{children}</h3>,
      }}
    >
      {DOMPurify.sanitize(normalized)}
    </ReactMarkdown>
  );
}


/* ──────────────────────────────────────────────────────────
   Status Badge Config
────────────────────────────────────────────────────────── */
const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string; dot: string }> = {
  scheduled:   { label: 'Scheduled',   bg: 'bg-blue-50',   text: 'text-blue-700',   dot: 'bg-blue-400' },
  confirmed:   { label: 'Confirmed',   bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-400' },
  in_progress: { label: 'In Progress', bg: 'bg-amber-50',  text: 'text-amber-700',  dot: 'bg-amber-400' },
  completed:   { label: 'Completed',   bg: 'bg-sage-100',  text: 'text-forest-500', dot: 'bg-forest-400' },
  cancelled:   { label: 'Cancelled',   bg: 'bg-red-50',    text: 'text-red-600',    dot: 'bg-red-400' },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? { label: status, bg: 'bg-sage-100', text: 'text-forest-500', dot: 'bg-forest-300' };
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black tracking-widest uppercase border border-transparent ${cfg.bg} ${cfg.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      <TranslatedText>{cfg.label}</TranslatedText>
    </span>
  );
}

/* ──────────────────────────────────────────────────────────
   Main Page
────────────────────────────────────────────────────────── */
export default function AppointmentsPage() {
  const token = useAuthToken();
  const { translate, currentLocale } = useLanguage();
  const { transliterateName } = useNameTransliteration();

  // ── Zustand (identity only) ──
  const patientStore = usePatientStore();

  // ── TanStack Query ──
  const { data: identity } = usePatientIdentity(token);
  const uid = identity?.uid || patientStore.uid || null;

  // Detect active call to use faster polling
  const [hasActiveCall, setHasActiveCall] = useState(false);
  const { data: appointments = [], isLoading: aptsLoading } = useAppointments(uid, token, hasActiveCall);
  const cancelMutation = useCancelAppointment();
  const refundMutation = useRequestRefund();

  // Local UI state
  const [activeTab, setActiveTab] = useState<'upcoming' | 'completed' | 'cancelled'>('upcoming');
  const [platformFee, setPlatformFee] = useState<number>(20);
  const [selectedAppointment, setSelectedAppointment] = useState<any>(null);
  const [cancelModal, setCancelModal] = useState<{ show: boolean; aid: string | null }>({ show: false, aid: null });
  const [refundModal, setRefundModal] = useState<{ show: boolean; aid: string | null }>({ show: false, aid: null });
  const [refundReason, setRefundReason] = useState('');
  const [now, setNow] = useState(new Date());
  const [doctorNames, setDoctorNames] = useState<Record<string, string>>({});
  const [prescription, setPrescription] = useState<any>(null);
  const [loadingPrescription, setLoadingPrescription] = useState(false);

  const loading = aptsLoading && appointments.length === 0;

  useEffect(() => { const timer = setInterval(() => setNow(new Date()), 10000); return () => clearInterval(timer); }, []);

  // Fetch Platform Fee
  useEffect(() => {
    async function fetchPlatformFee() {
      try {
        const response = await fetch('/api/platform-fee');
        const data = await response.json();
        if (data.success) {
          setPlatformFee(data.platformFee);
        }
      } catch (error) {
        console.error('Error fetching platform fee:', error);
      }
    }
    fetchPlatformFee();
  }, []);

  // Transliterate doctor names as they come in
  useEffect(() => {
    const newNames: Record<string, string> = {};
    appointments.forEach(async (apt) => {
      const name = apt.doctor?.user?.name;
      if (name && !doctorNames[name]) {
        try { newNames[name] = await transliterateName(name); } catch { newNames[name] = name; }
        setDoctorNames((prev) => ({ ...prev, ...newNames }));
      }
    });
  }, [appointments]);

  // Update hasActiveCall based on appointments
  useEffect(() => {
    const active = appointments.some(
      (apt) => apt.mode === 'online' && (apt.status === 'scheduled' || apt.status === 'confirmed' || apt.status === 'in_progress') && !isPast(apt)
    );
    setHasActiveCall(active);
  }, [appointments]);

  const inProgressApt = appointments.find(apt => apt.status === 'in_progress' && apt.mode === 'online' && !isPast(apt));

  useEffect(() => {
    if (inProgressApt) {
      const audio = new Audio('/sounds/ringtone.mp3');
      audio.loop = true;
      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.catch(e => console.log('Audio play failed:', e));
      }
      return () => {
        audio.pause();
        audio.currentTime = 0;
      };
    }
  }, [inProgressApt]);

  // Calendar State
  const [viewDate, setViewDate] = useState(new Date());
  const nextMonth = () => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1));
  const prevMonth = () => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1));
  const daysInMonth = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0).getDate();
  const firstDayOfMonth = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1).getDay();
  const monthName = viewDate.toLocaleString('default', { month: 'long' });
  const year = viewDate.getFullYear();

  // A call is joinable only if doctor has started it (in_progress)
  function canJoinCall(apt: any): boolean {
    if (apt.status === 'in_progress') return true;
    return false;
  }

  // Helper: parse appointment datetime
  function aptDateTime(apt: any): Date {
    const d = new Date(apt.scheduledDate);
    if (apt.scheduledTime) {
      const [h, m] = apt.scheduledTime.replace(/[AP]M/i, '').trim().split(':');
      let hours = parseInt(h, 10);
      const minutes = parseInt(m, 10);
      if (/PM/i.test(apt.scheduledTime) && hours !== 12) hours += 12;
      if (/AM/i.test(apt.scheduledTime) && hours === 12) hours = 0;
      d.setHours(hours, minutes, 0, 0);
    }
    return d;
  }

  // in_progress = doctor has started the call → always "upcoming" even if scheduled time passed.
  // A scheduled/confirmed appointment is considered past only if it's more than 60 minutes after the scheduled start time.
  const isPast = (apt: any) =>
    apt.status === 'completed' ||
    (apt.status !== 'cancelled' &&
     apt.status !== 'in_progress' &&
     new Date(aptDateTime(apt).getTime() + 60 * 60 * 1000) < now);

  const getAppointmentsForDay = (day: number) => {
    return appointments.filter(apt => {
      if (apt.status === 'cancelled' || isPast(apt)) return false;
      const d = new Date(apt.scheduledDate);
      return d.getDate() === day && d.getMonth() === viewDate.getMonth() && d.getFullYear() === viewDate.getFullYear();
    });
  };

  useEffect(() => {
    if (!selectedAppointment || selectedAppointment.status !== 'completed') {
      setPrescription(null);
      return;
    }

    let active = true;
    async function fetchPrescription() {
      setLoadingPrescription(true);
      try {
        const response = await fetchWithAuth(
          `/api/patient/prescriptions?pid=${selectedAppointment.pid}`,
          token
        );
        const data = await response.json();
        if (active && data.success) {
          const sentRx = data.prescriptions?.sent || [];
          const matchingRx = sentRx.find((rx: any) => rx.aid === selectedAppointment.aid);
          setPrescription(matchingRx || null);
        }
      } catch (err) {
        console.error('Error fetching prescription:', err);
      } finally {
        if (active) setLoadingPrescription(false);
      }
    }

    fetchPrescription();
    return () => {
      active = false;
    };
  }, [selectedAppointment, token]);

  async function confirmCancelAppointment() {
    if (!cancelModal.aid || !uid) return;
    try {
      await cancelMutation.mutateAsync({ aid: cancelModal.aid, uid, token: token || '' });
      toast.success(await translate('Appointment cancelled successfully'));
    } catch {
      toast.error(await translate('Failed to cancel appointment'));
    }
    setCancelModal({ show: false, aid: null });
  }

  async function handleRefundRequest() {
    if (!refundModal.aid || !uid) return;
    if (!refundReason.trim()) {
      toast.error(await translate('Please provide a reason for the refund'));
      return;
    }
    try {
      await refundMutation.mutateAsync({ aid: refundModal.aid, uid, token: token || '', reason: refundReason });
      toast.success(await translate('Refund requested successfully'));
      setRefundModal({ show: false, aid: null });
      setRefundReason('');
    } catch (err: any) {
      toast.error(err.message || await translate('Failed to request refund'));
    }
  }

  const upcomingAppointments = appointments
    .filter(apt => apt.status !== 'cancelled' && !isPast(apt))
    .sort((a, b) => aptDateTime(a).getTime() - aptDateTime(b).getTime());

  const completedAppointments = appointments
    .filter(isPast)
    .sort((a, b) => aptDateTime(b).getTime() - aptDateTime(a).getTime());

  const cancelledAppointments = appointments
    .filter(apt => apt.status === 'cancelled')
    .sort((a, b) => aptDateTime(b).getTime() - aptDateTime(a).getTime());

  const displayedAppointments =
    activeTab === 'upcoming' ? upcomingAppointments :
    activeTab === 'completed' ? completedAppointments : cancelledAppointments;

  const tabs = [
    { id: 'upcoming',  icon: Hourglass,     label: 'Upcoming', count: upcomingAppointments.length },
    { id: 'completed', icon: History,        label: 'Past',     count: completedAppointments.length },
    { id: 'cancelled', icon: Ban,            label: 'Cancelled', count: cancelledAppointments.length },
  ];

  if (loading) return <Loading />;

  /* ── next appointment countdown ── */
  const nextApt = upcomingAppointments[0];
  const nextAptDate = nextApt ? aptDateTime(nextApt) : null;
  let daysUntil: number | null = null;
  if (nextAptDate) {
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const aptStart = new Date(nextAptDate.getFullYear(), nextAptDate.getMonth(), nextAptDate.getDate());
    daysUntil = Math.floor((aptStart.getTime() - todayStart.getTime()) / (1000 * 60 * 60 * 24));
  }

  return (
    <div className="flex flex-col md:flex-row md:gap-6 lg:gap-10 pb-16 animate-enter pt-2">

      {/* ── LEFT COLUMN ── */}
      <div className="flex-1 min-w-0">

        {/* Header */}
        <div className="mb-8">
          <span className="pill-badge mb-3 inline-flex">
            <CalendarIcon className="w-3 h-3" />
            <TranslatedText>CLINICAL SCHEDULE</TranslatedText>
          </span>
          <h1 className="headline-lg mb-1">
            <TranslatedText>Your</TranslatedText>{' '}
            <span className="text-primary italic"><TranslatedText>Appointments</TranslatedText></span>
          </h1>
          <p className="body-md text-forest-400 max-w-lg">
            <TranslatedText>Manage and track your upcoming and past clinical consultations.</TranslatedText>
          </p>
        </div>

        {/* ── NEXT APPOINTMENT HERO (only on upcoming tab when there's an appointment) ── */}
        {activeTab === 'upcoming' && nextApt && (
          <div
            className="relative rounded-[2rem] overflow-hidden mb-8 cursor-pointer group"
            style={{ background: 'linear-gradient(135deg, #1a4a2e 0%, #22854a 60%, #2da866 100%)' }}
            onClick={() => setSelectedAppointment(nextApt)}
          >
            {/* Decorative circles */}
            <div className="absolute -top-10 -right-10 w-48 h-48 rounded-full bg-white/5 pointer-events-none" />
            <div className="absolute -bottom-8 -left-8 w-36 h-36 rounded-full bg-white/5 pointer-events-none" />

            <div className="relative z-10 p-6 sm:p-8 flex flex-col sm:flex-row gap-5 sm:gap-8 items-start sm:items-center">
              {/* Doctor avatar */}
              <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl overflow-hidden border-2 border-white/20 shadow-xl shrink-0 bg-white/10">
                {nextApt.doctor?.user?.profileImageUrl ? (
                  <img src={nextApt.doctor.user.profileImageUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <User className="w-10 h-10 text-white/50" />
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-white/60 text-[10px] font-bold tracking-[0.2em] uppercase mb-1">
                  {daysUntil === 0 ? '🔴 Today' : daysUntil === 1 ? '⏰ Tomorrow' : `📅 In ${daysUntil} days`}
                </p>
                <h2 className="text-white text-2xl sm:text-3xl font-display mb-1 truncate devanagari-small">
                  {doctorNames[nextApt.doctor?.user?.name || ''] || nextApt.doctor?.user?.name || 'Practitioner'}
                </h2>
                <p className="text-white/70 text-xs font-semibold uppercase tracking-widest mb-4 truncate">
                  <TranslatedText>{Array.isArray(nextApt.doctor?.specialization) ? nextApt.doctor.specialization[0] : nextApt.doctor?.specialization || 'Specialist'}</TranslatedText>
                </p>
                <div className="flex flex-wrap gap-3 text-white/80 text-xs font-semibold">
                  <span className="flex items-center gap-1.5 bg-white/10 px-3 py-1.5 rounded-full">
                    <CalendarIcon className="w-3.5 h-3.5" />
                    {formatDate(nextApt.scheduledDate)}
                  </span>
                  <span className="flex items-center gap-1.5 bg-white/10 px-3 py-1.5 rounded-full">
                    <Clock className="w-3.5 h-3.5" />
                    {nextApt.scheduledTime}
                  </span>
                  <span className="flex items-center gap-1.5 bg-white/10 px-3 py-1.5 rounded-full">
                    {nextApt.mode === 'online' ? <Video className="w-3.5 h-3.5" /> : <MapPin className="w-3.5 h-3.5" />}
                    <TranslatedText>{nextApt.mode === 'online' ? 'Online' : 'In-Clinic'}</TranslatedText>
                  </span>
                  {(nextApt.paidAmount || nextApt.doctor?.consultationFee || nextApt.consultationFee) && (
                    <span className="flex items-center gap-1 bg-white/10 px-3 py-1.5 rounded-full">
                      <span className="opacity-70">₹</span>
                      <span>{Number(nextApt.paidAmount || (Number(nextApt.doctor?.consultationFee || nextApt.consultationFee) + (nextApt.platformFeeApplied ?? platformFee))).toFixed(2)}</span>
                    </span>
                  )}
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex flex-col gap-2 shrink-0">
                {canJoinCall(nextApt) && (
                  <button
                    onClick={(e) => { e.stopPropagation(); window.location.href = `/dashboard/video-call/${nextApt.aid}`; }}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm bg-white text-forest-700 hover:bg-sage-50 transition-all shadow-lg animate-pulse"
                  >
                    <Video className="w-4 h-4" />
                    <TranslatedText>Join Call</TranslatedText>
                  </button>
                )}
                {nextApt.status !== 'confirmed' && nextApt.status !== 'in_progress' && (
                  <button
                    onClick={(e) => { e.stopPropagation(); setCancelModal({ show: true, aid: nextApt.aid }); }}
                    className="px-5 py-2.5 rounded-xl font-bold text-xs bg-white/10 text-white hover:bg-white/20 border border-white/20 transition-all"
                  >
                    <TranslatedText>Cancel</TranslatedText>
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Empty upcoming state */}
        {activeTab === 'upcoming' && upcomingAppointments.length === 0 && (
          <div className="rounded-[2rem] border-2 border-dashed border-sage-200 bg-sage-50/50 p-12 text-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-sage-100 flex items-center justify-center mx-auto mb-4">
              <Stethoscope className="w-8 h-8 text-forest-300" />
            </div>
            <p className="font-display text-forest-600 text-lg mb-1"><TranslatedText>No upcoming appointments</TranslatedText></p>
            <p className="text-sm text-forest-400 mb-6"><TranslatedText>Book a consultation with one of our verified doctors</TranslatedText></p>
            <Link href="/dashboard/find-doctors" className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-forest-500 text-white font-bold text-sm hover:bg-forest-600 transition-all">
              <Plus className="w-4 h-4" />
              <TranslatedText>Book Appointment</TranslatedText>
            </Link>
          </div>
        )}

        {/* ── TABS ── */}
        <div className="flex items-center gap-1 bg-sage-100/60 rounded-2xl p-1 mb-6 w-fit">
          {tabs.map(({ id, icon: Icon, label, count }) => {
            const active = activeTab === id;
            return (
              <button
                key={id}
                onClick={() => setActiveTab(id as any)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold tracking-wide transition-all duration-200 ${
                  active
                    ? 'bg-white text-forest-900 shadow-sm'
                    : 'text-forest-400 hover:text-forest-600'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <TranslatedText>{label}</TranslatedText>
                {count > 0 && (
                  <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-black ${
                    active ? 'bg-forest-100 text-forest-700' : 'bg-white/60 text-forest-400'
                  }`}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* ── APPOINTMENT LIST ── */}
        {displayedAppointments.length === 0 ? (
          <div className="rounded-[2rem] border border-dashed border-sage-200 bg-sage-50/40 p-12 text-center">
            <div className="w-12 h-12 rounded-2xl bg-sage-100 flex items-center justify-center mx-auto mb-3">
              {activeTab === 'completed' ? <History className="w-6 h-6 text-forest-300" /> : <Ban className="w-6 h-6 text-forest-300" />}
            </div>
            <p className="text-sm font-semibold text-forest-400 uppercase tracking-widest">
              {activeTab === 'completed'
                ? <TranslatedText>No past consultations</TranslatedText>
                : <TranslatedText>No cancelled appointments</TranslatedText>}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Skip index 0 on upcoming (shown in hero above) */}
            {displayedAppointments
              .slice(activeTab === 'upcoming' ? 1 : 0)
              .map((apt) => {
                const doctorName = doctorNames[apt.doctor?.user?.name || ''] || apt.doctor?.user?.name || 'Practitioner';
                const spec = Array.isArray(apt.doctor?.specialization)
                  ? apt.doctor.specialization[0]
                  : (apt.doctor?.specialization || 'Specialist');
                const aptDate = formatDate(apt.scheduledDate);
                const canJoin = canJoinCall(apt);

                return (
                  <div
                    key={apt.aid}
                    onClick={() => setSelectedAppointment(apt)}
                    className="group flex items-center gap-4 p-4 sm:p-5 bg-white border border-sage-100 rounded-2xl hover:shadow-forest-sm hover:border-sage-200 transition-all duration-200 cursor-pointer"
                  >
                    {/* Avatar */}
                    <div className={`w-14 h-14 rounded-2xl overflow-hidden shrink-0 border-2 ${
                      apt.status === 'cancelled' ? 'border-red-100' :
                      apt.status === 'completed' ? 'border-sage-100' :
                      'border-forest-100'
                    }`}>
                      {apt.doctor?.user?.profileImageUrl ? (
                        <img src={apt.doctor.user.profileImageUrl} className="w-full h-full object-cover" alt="" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-sage-50">
                          <User className="w-6 h-6 text-forest-300" />
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <h4 className="text-base font-display text-forest-900 truncate devanagari-small">
                          {doctorName}
                        </h4>
                        <StatusBadge status={apt.status} />
                      </div>
                      <p className="text-[0.7rem] font-semibold text-forest-400 uppercase tracking-wider truncate mb-2">
                        <TranslatedText>{spec}</TranslatedText>
                      </p>
                      <div className="flex flex-wrap gap-3 text-xs text-forest-500 font-medium">
                        <span className="flex items-center gap-1">
                          <CalendarIcon className="w-3 h-3 text-forest-300" /> {aptDate}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-forest-300" /> {apt.scheduledTime}
                        </span>
                        <span className="flex items-center gap-1">
                          {apt.mode === 'online'
                            ? <Video className="w-3 h-3 text-forest-300" />
                            : <MapPin className="w-3 h-3 text-forest-300" />}
                          <TranslatedText>{apt.mode === 'online' ? 'Online' : 'In-Clinic'}</TranslatedText>
                        </span>
                        {(apt.paidAmount || apt.doctor?.consultationFee || apt.consultationFee) && (
                          <span className="flex items-center gap-1">
                            <span className="text-forest-400 font-bold">₹</span>
                            <span className="font-semibold">{Number(apt.paidAmount || (Number(apt.doctor?.consultationFee || apt.consultationFee) + (apt.platformFeeApplied ?? platformFee))).toFixed(2)}</span>
                          </span>
                        )}
                        {apt.status === 'cancelled' && apt.refundRequested && apt.refundStatus && (
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black tracking-widest uppercase border ${
                            apt.refundStatus === 'approved' || apt.refundStatus === 'processed'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : apt.refundStatus === 'rejected' || apt.refundStatus === 'failed'
                              ? 'bg-red-50 text-red-600 border-red-200'
                              : 'bg-amber-50 text-amber-700 border-amber-200'
                          }`}>
                            <TranslatedText>{apt.refundStatus}</TranslatedText>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Right action */}
                    {canJoin ? (
                      <button
                        onClick={(e) => { e.stopPropagation(); window.location.href = `/dashboard/video-call/${apt.aid}`; }}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl font-bold text-xs bg-forest-900 text-white hover:bg-forest-800 transition-all shrink-0"
                      >
                        <Video className="w-3.5 h-3.5" />
                        <TranslatedText>Join</TranslatedText>
                      </button>
                    ) : (
                      <ChevronRight className="w-4 h-4 text-forest-200 group-hover:text-forest-400 transition-colors shrink-0" />
                    )}
                  </div>
                );
              })}
          </div>
        )}
      </div>

      {/* ── RIGHT COLUMN ── */}
      <div className="w-full md:w-[260px] lg:w-[300px] shrink-0 space-y-5 mt-8 md:mt-0">

        {/* New Appointment CTA */}
        <Link
          href="/dashboard/find-doctors"
          className="flex items-center justify-between gap-3 w-full px-5 py-4 rounded-2xl font-bold text-sm text-white transition-all group"
          style={{ background: 'linear-gradient(135deg, #1a4a2e, #22854a)' }}
        >
          <span className="flex items-center gap-2">
            <Plus className="w-4 h-4" />
            <TranslatedText>New Appointment</TranslatedText>
          </span>
          <ArrowRight className="w-4 h-4 opacity-60 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
        </Link>

        {/* Quick stats */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: 'Upcoming', value: upcomingAppointments.length, color: 'text-blue-600', bg: 'bg-blue-50' },
            { label: 'Past',     value: completedAppointments.length, color: 'text-forest-600', bg: 'bg-sage-100' },
            { label: 'Cancelled', value: cancelledAppointments.length, color: 'text-red-500', bg: 'bg-red-50' },
          ].map(({ label, value, color, bg }) => (
            <div key={label} className={`${bg} rounded-2xl p-3 text-center`}>
              <p className={`text-2xl font-black font-display ${color}`}>{value}</p>
              <p className="text-[9px] font-bold text-forest-400 uppercase tracking-wider mt-0.5">
                <TranslatedText>{label}</TranslatedText>
              </p>
            </div>
          ))}
        </div>

        {/* Calendar Widget */}
        <div className="bg-sage-50 rounded-[2rem] p-5 border border-sage-100 shadow-forest-sm overflow-hidden relative">
          <div className="absolute -top-8 -right-8 w-28 h-28 rounded-full bg-sage-100/60 pointer-events-none" />
          <div className="flex items-center justify-between mb-5 relative z-10">
            <div>
              <h3 className="text-xl font-display text-forest-900 leading-none">{monthName} {year}</h3>
              <p className="text-[10px] font-bold text-forest-400 tracking-[0.2em] mt-1.5 uppercase">
                <TranslatedText>Calendar Overview</TranslatedText>
              </p>
            </div>
            <div className="flex gap-1">
              <button onClick={prevMonth} className="p-1.5 rounded-lg hover:bg-sage-200 text-forest-400 transition-colors">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button onClick={nextMonth} className="p-1.5 rounded-lg hover:bg-sage-200 text-forest-400 transition-colors">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-y-2 text-center relative z-10">
            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
              <span key={i} className="text-[0.6rem] font-bold text-forest-300 tracking-widest pb-1">
                <TranslatedText>{d}</TranslatedText>
              </span>
            ))}
            {[...Array(firstDayOfMonth)].map((_, i) => <div key={`e-${i}`} />)}
            {[...Array(daysInMonth)].map((_, i) => {
              const day = i + 1;
              const dayApts = getAppointmentsForDay(day);
              const todayD = new Date();
              const isToday = day === todayD.getDate() && viewDate.getMonth() === todayD.getMonth() && viewDate.getFullYear() === todayD.getFullYear();
              const hasApt = dayApts.length > 0;
              return (
                <div key={day} className="relative flex items-center justify-center group py-0.5">
                  <span className={`w-7 h-7 flex items-center justify-center rounded-full text-xs transition-all ${
                    isToday ? 'bg-forest-500 text-white font-black shadow-md' :
                    hasApt ? 'bg-white text-forest-700 font-bold border border-forest-200 shadow-sm' :
                    'text-forest-600 hover:bg-sage-200'
                  }`}>
                    {day}
                  </span>
                  {hasApt && !isToday && (
                    <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-forest-400" />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Upcoming appointments mini list */}
        {upcomingAppointments.length > 0 && (
          <div className="bg-white rounded-2xl border border-sage-100 shadow-forest-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-sage-50">
              <p className="text-[10px] font-black text-forest-400 tracking-widest uppercase">
                <TranslatedText>Upcoming Schedule</TranslatedText>
              </p>
            </div>
            <div className="divide-y divide-sage-50">
              {upcomingAppointments.slice(0, 3).map(apt => (
                <button
                  key={apt.aid}
                  onClick={() => setSelectedAppointment(apt)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-sage-50 transition-colors text-left group"
                >
                  <div className="w-8 h-8 rounded-xl overflow-hidden shrink-0 bg-sage-100">
                    {apt.doctor?.user?.profileImageUrl ? (
                      <img src={apt.doctor.user.profileImageUrl} className="w-full h-full object-cover" alt="" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <User className="w-4 h-4 text-forest-300" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-forest-900 truncate devanagari-small">
                      {doctorNames[apt.doctor?.user?.name || ''] || apt.doctor?.user?.name}
                    </p>
                    <p className="text-[10px] text-forest-400 font-medium">
                      {formatDate(apt.scheduledDate)} · {apt.scheduledTime}
                    </p>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-forest-200 group-hover:text-forest-400 transition-colors shrink-0" />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── DETAIL MODAL ── */}
      {selectedAppointment && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-forest-900/60 backdrop-blur-sm"
          onClick={() => setSelectedAppointment(null)}
        >
          <div
            className="bg-white rounded-t-[3rem] sm:rounded-[2.5rem] shadow-2xl w-full sm:max-w-lg max-h-[92vh] overflow-y-auto scrollbar-hide"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="sticky top-0 bg-white/95 backdrop-blur-sm z-20 px-6 py-5 flex items-center justify-between border-b border-sage-50">
              <div>
                <h2 className="text-xl font-display text-forest-900">
                  <TranslatedText>Consultation Details</TranslatedText>
                </h2>
                <p className="text-[10px] font-bold tracking-widest text-forest-400 uppercase mt-0.5">
                  REF #{selectedAppointment.aid?.slice(-8).toUpperCase()}
                </p>
              </div>
              <button
                onClick={() => setSelectedAppointment(null)}
                className="w-9 h-9 rounded-xl bg-sage-100 flex items-center justify-center text-forest-600 hover:bg-sage-200 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {/* Doctor card */}
              <div className="flex items-center gap-4 p-4 bg-sage-50 rounded-2xl border border-sage-100">
                <div className="w-16 h-16 rounded-2xl overflow-hidden border-2 border-white shadow-md shrink-0 bg-sage-100">
                  {selectedAppointment.doctor?.user?.profileImageUrl ? (
                    <img src={selectedAppointment.doctor.user.profileImageUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <User className="w-8 h-8 text-forest-300" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-forest-400" />
                    <span className="text-[10px] font-bold tracking-widest uppercase text-forest-400">
                      <TranslatedText>Verified Expert</TranslatedText>
                    </span>
                  </div>
                  <h3 className="text-lg font-display text-forest-900 devanagari-small truncate">
                    {doctorNames[selectedAppointment.doctor?.user?.name || ''] || selectedAppointment.doctor?.user?.name}
                  </h3>
                  <p className="text-xs font-semibold text-forest-500 uppercase tracking-widest truncate">
                    <TranslatedText>{
                      Array.isArray(selectedAppointment.doctor?.specialization)
                        ? selectedAppointment.doctor.specialization.join(', ')
                        : selectedAppointment.doctor?.specialization || 'Specialist'
                    }</TranslatedText>
                  </p>
                </div>
                <StatusBadge status={selectedAppointment.status} />
              </div>

              {/* Details grid */}
              <div className="grid grid-cols-2 gap-3">
                {[
                  {
                    icon: CalendarIcon,
                    label: 'Date',
                    value: formatDate(selectedAppointment.scheduledDate)
                  },
                  {
                    icon: Clock,
                    label: 'Time',
                    value: selectedAppointment.scheduledTime
                  },
                  {
                    icon: selectedAppointment.mode === 'online' ? Video : MapPin,
                    label: 'Mode',
                    value: selectedAppointment.mode === 'online' ? 'Online Consultation' : 'In-Clinic Visit',
                    translate: true
                  },
                  {
                    icon: CheckCircle2,
                    label: 'Status',
                    value: selectedAppointment.status,
                    translate: true,
                    capitalize: true
                  },
                ].map(({ icon: Icon, label, value, translate: shouldTranslate, capitalize }) => (
                  <div key={label} className="p-4 rounded-2xl bg-sage-50 border border-sage-100">
                    <div className="flex items-center gap-1.5 mb-2">
                      <Icon className="w-3.5 h-3.5 text-forest-300" />
                      <p className="text-[10px] font-bold text-forest-400 tracking-widest uppercase">
                        <TranslatedText>{label}</TranslatedText>
                      </p>
                    </div>
                    <p className={`text-sm font-bold text-forest-900 ${capitalize ? 'capitalize' : ''}`}>
                      {shouldTranslate ? <TranslatedText>{value}</TranslatedText> : value}
                    </p>
                  </div>
                ))}
              </div>

              {/* Chief complaint */}
              <div className="p-4 rounded-2xl bg-forest-50 border border-forest-100">
                <p className="text-[10px] font-black text-forest-400 tracking-widest uppercase mb-2">
                  <TranslatedText>Chief Complaint</TranslatedText>
                </p>
                <p className="text-sm font-medium text-forest-700 italic leading-relaxed">
                  "{selectedAppointment.chiefComplaint || '—'}"
                </p>
              </div>

              {/* Cancellation Reason */}
              {selectedAppointment.status === 'cancelled' && selectedAppointment.cancellationReason && (
                <div className="p-4 rounded-2xl bg-red-50 border border-red-100 animate-enter">
                  <p className="text-[10px] font-black text-red-500 tracking-widest uppercase mb-2">
                    <TranslatedText>Reason for Cancellation</TranslatedText>
                  </p>
                  <p className="text-sm font-medium text-red-700 italic leading-relaxed">
                    "{selectedAppointment.cancellationReason}"
                  </p>
                </div>
              )}

              {/* Refund Info */}
              {selectedAppointment.status === 'cancelled' && selectedAppointment.refundRequested && (
                <div className="p-4 rounded-2xl border animate-enter" style={{
                  backgroundColor: selectedAppointment.refundStatus === 'approved' || selectedAppointment.refundStatus === 'processed' ? '#ecfdf5' :
                    selectedAppointment.refundStatus === 'rejected' || selectedAppointment.refundStatus === 'failed' ? '#fef2f2' :
                    '#fffbeb',
                  borderColor: selectedAppointment.refundStatus === 'approved' || selectedAppointment.refundStatus === 'processed' ? '#a7f3d0' :
                    selectedAppointment.refundStatus === 'rejected' || selectedAppointment.refundStatus === 'failed' ? '#fecaca' :
                    '#fde68a'
                }}>
                  <p className="text-[10px] font-black tracking-widest uppercase mb-3" style={{
                    color: selectedAppointment.refundStatus === 'approved' || selectedAppointment.refundStatus === 'processed' ? '#059669' :
                      selectedAppointment.refundStatus === 'rejected' || selectedAppointment.refundStatus === 'failed' ? '#dc2626' :
                      '#d97706'
                  }}>
                    <TranslatedText>Refund Status</TranslatedText>
                  </p>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-medium text-forest-500"><TranslatedText>Amount</TranslatedText></span>
                      <span className="text-base font-black text-forest-900">₹{Number(selectedAppointment.refundAmount || selectedAppointment.paidAmount || 0).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-medium text-forest-500"><TranslatedText>Status</TranslatedText></span>
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[9px] font-black tracking-widest uppercase border ${
                        selectedAppointment.refundStatus === 'approved' || selectedAppointment.refundStatus === 'processed'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : selectedAppointment.refundStatus === 'rejected' || selectedAppointment.refundStatus === 'failed'
                          ? 'bg-red-50 text-red-600 border-red-200'
                          : 'bg-amber-50 text-amber-700 border-amber-200'
                      }`}>
                        <TranslatedText>{selectedAppointment.refundStatus}</TranslatedText>
                      </span>
                    </div>
                    {selectedAppointment.refundType && (
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-medium text-forest-500"><TranslatedText>Type</TranslatedText></span>
                        <span className="text-xs font-semibold text-forest-700 capitalize">{selectedAppointment.refundType}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Symptoms */}
              {selectedAppointment.symptoms && selectedAppointment.symptoms.length > 0 && (
                <div>
                  <p className="text-[10px] font-black text-forest-400 tracking-widest uppercase mb-2">
                    <TranslatedText>Symptoms</TranslatedText>
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {selectedAppointment.symptoms.map((s: string, i: number) => (
                      <span key={i} className="pill-badge text-xs">{s}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* Billing & Payments Card */}
              <div className="p-4 rounded-2xl bg-sage-50 border border-sage-100/60 shadow-sage-sm">
                <p className="text-[10px] font-black text-forest-500 tracking-widest uppercase mb-3">
                  <TranslatedText>Billing & Payment</TranslatedText>
                </p>
                {selectedAppointment.paidAmount ? (
                  <>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-xs font-medium text-forest-500"><TranslatedText>Doctor Fee</TranslatedText></span>
                      <span className="text-xs font-semibold text-forest-700">₹{selectedAppointment.doctor?.consultationFee || selectedAppointment.consultationFee || 0}</span>
                    </div>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-xs font-medium text-forest-500"><TranslatedText>Platform Fee</TranslatedText></span>
                      <span className="text-xs font-semibold text-forest-700">+ ₹{selectedAppointment.platformFeeApplied || 20}</span>
                    </div>
                    {Number(selectedAppointment.doctor?.consultationFee || selectedAppointment.consultationFee || 0) + Number(selectedAppointment.platformFeeApplied || 20) > Number(selectedAppointment.paidAmount) && (
                      <div className="flex justify-between items-center mb-2 text-emerald-600">
                        <span className="text-xs font-medium"><TranslatedText>Promo Discount</TranslatedText></span>
                        <span className="text-xs font-semibold">- ₹{(Number(selectedAppointment.doctor?.consultationFee || selectedAppointment.consultationFee || 0) + Number(selectedAppointment.platformFeeApplied || 20)) - Number(selectedAppointment.paidAmount)}</span>
                      </div>
                    )}
                    <div className="flex justify-between items-center mb-2.5 pt-2 border-t border-sage-200 border-dashed">
                      <span className="text-xs font-semibold text-forest-600"><TranslatedText>Total Paid</TranslatedText></span>
                      <span className="text-base font-black text-forest-900">₹{selectedAppointment.paidAmount}</span>
                    </div>
                  </>
                ) : (
                  <div className="flex justify-between items-center mb-2.5">
                    <span className="text-xs font-semibold text-forest-600"><TranslatedText>Total Fee</TranslatedText></span>
                    <span className="text-base font-black text-forest-900">₹{Number(selectedAppointment.doctor?.consultationFee || selectedAppointment.consultationFee || 0) + 20}</span>
                  </div>
                )}
                {selectedAppointment.paymentStatus && (
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs font-semibold text-forest-600"><TranslatedText>Payment Status</TranslatedText></span>
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[9px] font-black tracking-widest uppercase border ${
                      selectedAppointment.paymentStatus === 'completed' 
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                        : 'bg-amber-50 text-amber-700 border-amber-200'
                    }`}>
                      <TranslatedText>{selectedAppointment.paymentStatus}</TranslatedText>
                    </span>
                  </div>
                )}
                {selectedAppointment.paymentId && (
                  <div className="flex justify-between items-center text-[10px] text-forest-400 mt-2.5 pt-2.5 border-t border-sage-100/60 font-mono">
                    <span>TXN ID</span>
                    <span>{selectedAppointment.paymentId}</span>
                  </div>
                )}
              </div>

              {/* In-Clinic Queue Status Card */}
              {selectedAppointment.mode === 'offline' && selectedAppointment.status !== 'cancelled' && selectedAppointment.status !== 'completed' && (
                <div className="p-4 rounded-2xl bg-blue-50/50 border border-blue-100/60 shadow-sm animate-enter">
                  <p className="text-[10px] font-black text-blue-500 tracking-widest uppercase mb-3">
                    <TranslatedText>In-Clinic Queue Status</TranslatedText>
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="text-center bg-white p-2 rounded-xl border border-blue-50 shadow-sm">
                      <p className="text-base font-black text-blue-700">{selectedAppointment.tokenNumber ?? '—'}</p>
                      <p className="text-[8px] font-bold text-blue-400 uppercase tracking-wider mt-0.5"><TranslatedText>Token No</TranslatedText></p>
                    </div>
                    <div className="text-center bg-white p-2 rounded-xl border border-blue-50 shadow-sm">
                      <p className="text-base font-black text-blue-700">{selectedAppointment.queuePosition ?? '—'}</p>
                      <p className="text-[8px] font-bold text-blue-400 uppercase tracking-wider mt-0.5"><TranslatedText>Queue Pos</TranslatedText></p>
                    </div>
                    <div className="text-center bg-white p-2 rounded-xl border border-blue-50 shadow-sm">
                      <p className="text-base font-black text-blue-700">
                        {selectedAppointment.estimatedWaitMinutes ? `${selectedAppointment.estimatedWaitMinutes}m` : '—'}
                      </p>
                      <p className="text-[8px] font-bold text-blue-400 uppercase tracking-wider mt-0.5"><TranslatedText>Est Wait</TranslatedText></p>
                    </div>
                  </div>
                </div>
              )}

              {/* Doctor Notes */}
              {selectedAppointment.doctorNotes && (
                <div className="p-4 rounded-2xl bg-sage-50 border border-sage-100/60 shadow-sage-sm">
                  <p className="text-[10px] font-black text-forest-500 tracking-widest uppercase mb-2.5">
                    <TranslatedText>Doctor's Consultation Notes</TranslatedText>
                  </p>
                  <p className="text-sm font-medium text-forest-700 leading-relaxed whitespace-pre-wrap">
                    {selectedAppointment.doctorNotes}
                  </p>
                </div>
              )}

              {/* Prescription & Treatment Details */}
              {selectedAppointment.status === 'completed' && (
                <div className="space-y-3 pt-2">
                  <p className="text-[10px] font-black text-forest-400 tracking-widest uppercase">
                    <TranslatedText>Prescription & Treatment</TranslatedText>
                  </p>
                  {loadingPrescription ? (
                    <div className="text-center py-6 bg-sage-50 rounded-2xl border border-sage-100/40">
                      <div className="spinner mx-auto mb-2" />
                      <p className="text-xs text-forest-400"><TranslatedText>Retrieving prescription details...</TranslatedText></p>
                    </div>
                  ) : prescription ? (
                    <div className="p-4 rounded-2xl bg-white border border-sage-200/80 shadow-sage-sm space-y-4 animate-enter">
                      {prescription.diagnosis && (
                        <div>
                          <p className="text-[9px] font-bold tracking-widest text-forest-400 uppercase mb-1"><TranslatedText>Diagnosis</TranslatedText></p>
                          <p className="text-sm font-semibold text-forest-900"><TranslatedText>{prescription.diagnosis}</TranslatedText></p>
                        </div>
                      )}

                      {prescription.medicines && prescription.medicines.length > 0 && (
                        <div>
                          <p className="text-[9px] font-bold tracking-widest text-forest-400 uppercase mb-2"><TranslatedText>Prescribed Medicines</TranslatedText></p>
                          <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse text-xs">
                              <thead>
                                <tr className="border-b border-sage-100 text-forest-400 font-bold">
                                  <th className="pb-1.5 pr-2"><TranslatedText>Medicine</TranslatedText></th>
                                  <th className="pb-1.5 px-2"><TranslatedText>Dosage</TranslatedText></th>
                                  <th className="pb-1.5 px-2"><TranslatedText>Frequency</TranslatedText></th>
                                  <th className="pb-1.5 pl-2"><TranslatedText>Duration</TranslatedText></th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-sage-50 text-forest-800">
                                {prescription.medicines.map((med: any, idx: number) => (
                                  <tr key={idx} className="hover:bg-sage-50/50">
                                    <td className="py-2 pr-2 font-semibold text-forest-900">
                                      <MedicineName name={med.name} currentLocale={currentLocale} />
                                    </td>
                                    <td className="py-2 px-2">{med.dosage}</td>
                                    <td className="py-2 px-2"><TranslatedText>{med.frequency}</TranslatedText></td>
                                    <td className="py-2 pl-2">{med.duration}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}

                      {prescription.instructions && (
                        <div className="pt-3 border-t border-sage-100">
                          <p className="text-[9px] font-bold tracking-widest text-forest-400 uppercase mb-2"><TranslatedText>Instructions</TranslatedText></p>
                          <div className="text-xs text-forest-700 leading-relaxed">
                            <FormattedInstructions text={prescription.instructions} />
                          </div>
                        </div>
                      )}

                      {prescription.dietAdvice && (
                        <div className="pt-3 border-t border-sage-100">
                          <p className="text-[9px] font-bold tracking-widest text-forest-400 uppercase mb-1"><TranslatedText>Diet & Nutrition Advice</TranslatedText></p>
                          <p className="text-xs text-forest-700 leading-relaxed whitespace-pre-wrap">{prescription.dietAdvice}</p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-6 bg-sage-50/60 rounded-2xl border border-sage-100/40">
                      <p className="text-xs text-forest-400 italic"><TranslatedText>No prescription record found for this visit.</TranslatedText></p>
                    </div>
                  )}
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                {/* Join call button if doctor has started the call */}
                {canJoinCall(selectedAppointment) && (
                  <button
                    onClick={() => window.location.href = `/dashboard/video-call/${selectedAppointment.aid}`}
                    className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl bg-forest-900 text-white font-bold text-sm hover:bg-forest-800 transition-all animate-pulse"
                  >
                    <Video className="w-4 h-4" />
                    <TranslatedText>Join Call</TranslatedText>
                  </button>
                )}
                {/* Cancel button if upcoming */}
                {!isPast(selectedAppointment) && selectedAppointment.status !== 'cancelled' && selectedAppointment.status !== 'confirmed' && selectedAppointment.status !== 'in_progress' && (
                  <button
                    onClick={() => { setSelectedAppointment(null); setCancelModal({ show: true, aid: selectedAppointment.aid }); }}
                    className="flex-1 py-3 rounded-2xl font-bold text-sm border border-red-200 text-red-600 bg-red-50 hover:bg-red-100 transition-all"
                  >
                    <TranslatedText>Cancel Appointment</TranslatedText>
                  </button>
                )}
                {/* Request Refund button if cancelled and paid and no refund requested */}
                {selectedAppointment.status === 'cancelled' && selectedAppointment.paidAmount && !selectedAppointment.refundRequested && (
                  <button
                    onClick={() => { setSelectedAppointment(null); setRefundModal({ show: true, aid: selectedAppointment.aid }); }}
                    className="flex-1 py-3 rounded-2xl font-bold text-sm border border-amber-200 text-amber-700 bg-amber-50 hover:bg-amber-100 transition-all"
                  >
                    <TranslatedText>Request Refund</TranslatedText>
                  </button>
                )}
                <button
                  onClick={() => setSelectedAppointment(null)}
                  className="flex-1 py-3 rounded-2xl font-bold text-sm bg-sage-100 text-forest-700 hover:bg-sage-200 transition-all"
                >
                  <TranslatedText>Close</TranslatedText>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── CANCEL CONFIRMATION MODAL ── */}
      {cancelModal.show && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-forest-900/60 backdrop-blur-sm"
          onClick={() => setCancelModal({ show: false, aid: null })}
        >
          <div className="bg-white rounded-[2.5rem] shadow-2xl max-w-sm w-full p-8 text-center" onClick={e => e.stopPropagation()}>
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4 bg-red-50">
              <AlertCircle className="w-8 h-8 text-red-500" />
            </div>
            <h2 className="text-xl font-display text-forest-900 mb-2">
              <TranslatedText>Cancel Appointment?</TranslatedText>
            </h2>
            <p className="text-sm text-forest-500 mb-8 leading-relaxed">
              <TranslatedText>This action cannot be undone. Are you sure you want to cancel this appointment?</TranslatedText>
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setCancelModal({ show: false, aid: null })}
                className="flex-1 py-3 px-4 text-sm font-bold bg-sage-100 text-forest-700 rounded-2xl hover:bg-sage-200 transition-all"
              >
                <TranslatedText>Keep it</TranslatedText>
              </button>
              <button
                onClick={confirmCancelAppointment}
                className="flex-1 py-3 px-4 text-sm font-bold bg-red-500 text-white rounded-2xl hover:bg-red-600 transition-all"
                disabled={cancelMutation.isPending}
              >
                {cancelMutation.isPending ? <TranslatedText>Cancelling...</TranslatedText> : <TranslatedText>Yes, Cancel</TranslatedText>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── REFUND REQUEST MODAL ── */}
      {refundModal.show && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-forest-900/60 backdrop-blur-sm"
          onClick={() => setRefundModal({ show: false, aid: null })}
        >
          <div className="bg-white rounded-[2.5rem] shadow-2xl max-w-md w-full p-8 text-center" onClick={e => e.stopPropagation()}>
            <h2 className="text-xl font-display text-forest-900 mb-2">
              <TranslatedText>Request Refund</TranslatedText>
            </h2>
            <p className="text-sm text-forest-500 mb-6 leading-relaxed">
              <TranslatedText>Please provide a reason for requesting a refund. Our team will review it according to our refund policy.</TranslatedText>
            </p>
            <textarea
              value={refundReason}
              onChange={(e) => setRefundReason(e.target.value)}
              placeholder="E.g., Doctor didn't join the call, I had an emergency..."
              className="w-full bg-sage-50 border border-sage-200 rounded-xl p-4 text-sm focus:outline-none focus:ring-2 focus:ring-forest-500 min-h-[100px] mb-6"
            />
            <div className="flex gap-3">
              <button
                onClick={() => setRefundModal({ show: false, aid: null })}
                className="flex-1 py-3 px-4 text-sm font-bold bg-sage-100 text-forest-700 rounded-2xl hover:bg-sage-200 transition-all"
              >
                <TranslatedText>Cancel</TranslatedText>
              </button>
              <button
                onClick={handleRefundRequest}
                disabled={refundMutation.isPending || !refundReason.trim()}
                className="flex-1 py-3 px-4 text-sm font-bold bg-amber-500 text-white rounded-2xl hover:bg-amber-600 transition-all disabled:opacity-50"
              >
                {refundMutation.isPending ? <TranslatedText>Submitting...</TranslatedText> : <TranslatedText>Submit Request</TranslatedText>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── INCOMING CALL OVERLAY ── */}
      {inProgressApt && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-forest-900/80 backdrop-blur-sm p-4 animate-in fade-in duration-300">
          <div className="bg-white rounded-[2rem] p-8 max-w-sm w-full text-center shadow-2xl animate-in zoom-in-95 duration-500">
            <div className="relative w-24 h-24 mx-auto mb-6">
              <div className="absolute inset-0 bg-sage-200 rounded-full animate-ping opacity-75"></div>
              <div className="relative w-full h-full bg-sage-100 rounded-full flex items-center justify-center border-4 border-white shadow-lg z-10 overflow-hidden">
                {inProgressApt.doctor?.user?.profileImageUrl ? (
                  <img src={inProgressApt.doctor.user.profileImageUrl} alt="Doctor" className="w-full h-full object-cover" />
                ) : (
                  <Video className="w-10 h-10 text-forest-500" />
                )}
              </div>
            </div>
            
            <h2 className="text-2xl font-display text-forest-900 mb-2">
              <TranslatedText>Incoming Video Call</TranslatedText>
            </h2>
            <p className="text-forest-600 mb-8 devanagari-small text-lg font-medium">
              {doctorNames[inProgressApt.doctor?.user?.name || ''] || inProgressApt.doctor?.user?.name || 'Your Doctor'}
            </p>
            
            <div className="flex gap-4 justify-center">
              <button 
                onClick={() => window.location.href = `/dashboard/video-call/${inProgressApt.aid}`}
                className="flex-1 flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white py-3.5 px-6 rounded-xl font-bold shadow-lg shadow-emerald-500/30 transition-all hover:-translate-y-1"
              >
                <Video className="w-5 h-5" />
                <TranslatedText>Accept Call</TranslatedText>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
