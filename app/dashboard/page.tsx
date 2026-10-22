'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import {
  Calendar, Pill, Activity, User, ArrowRight, ArrowUpRight,
  CheckCircle, TrendingUp, Stethoscope, Search, Sparkles,
  Users, BarChart3, Clock
} from 'lucide-react';
import Link from 'next/link';
import AdherenceCheckbox from '@/app/components/AdherenceCheckbox';
import { formatDate } from '@/lib/formatDate';
import { TranslatedText } from '@/app/components/TranslatedText';
import { MedicineName } from '@/app/components/MedicineName';
import { useAuthToken } from '@/lib/auth-token-context';
import Loading from '@/app/components/Loading';
import { LineChart, Line, ResponsiveContainer } from 'recharts';
import { useNameTransliteration } from '@/app/hooks/useNameTransliteration';
import { useLanguage } from '@/app/contexts/LanguageContext';
import { usePatientStore } from '@/app/store/usePatientStore';
import { useProfileStore } from '@/app/store/useProfileStore';
import { useDashboardStats } from '@/app/hooks/queries/useDashboardStats';
import { useAdherence } from '@/app/hooks/queries/useAdherence';
import { usePatientIdentity } from '@/app/hooks/queries/usePatientData';
import { useQueryClient } from '@tanstack/react-query';

export default function PatientDashboardPage() {
  const token = useAuthToken();
  const queryClient = useQueryClient();
  const { transliterateName } = useNameTransliteration();
  const { currentLocale } = useLanguage();

  // ── Zustand (identity + profile display) ──
  const patientStore = usePatientStore();
  const profileStore = useProfileStore();

  // ── TanStack Query ──
  // usePatientIdentity resolves uid/pid from Zustand or API — chains all other queries
  const { data: identity } = usePatientIdentity(token);
  const uid = identity?.uid || patientStore.uid || null;
  const pid = identity?.pid || patientStore.pid || null;

  const { data: dashData, isLoading: dashLoading, isError: dbError } = useDashboardStats(uid, token);
  const { data: adherenceData, isLoading: adherenceLoading } = useAdherence(pid, token);

  const [displayName, setDisplayName] = useState('');

  // Derive stats from query data
  const stats = {
    upcomingAppointments: dashData?.upcomingAppointments || 0,
    activePrescriptions: dashData?.activePrescriptions || 0,
    totalAppointments: dashData?.totalAppointments || 0,
    adherenceRate: dashData?.adherenceRate || 0,
    dailyAdherenceRate: dashData?.dailyAdherenceRate || 0,
    takenDoses: dashData?.takenDoses || 0,
    totalDoses: dashData?.totalDoses || 0,
    elapsedTotal: dashData?.elapsedTotal || 0,
    clinicAverage: dashData?.clinicAverage ?? 75,
  };
  const adherenceTrend: any[] = dashData?.adherenceTrend || [];

  // Derive schedule from TanStack Query adherence data
  const schedule = {
    dueNow: adherenceData?.dueNow || [],
    pending: adherenceData?.pending || [],
    upcoming: adherenceData?.upcoming || [],
    overdue: adherenceData?.overdue || [],
    taken: (adherenceData as any)?.taken || [],
    skipped: (adherenceData as any)?.skipped || [],
  };

  const userName = profileStore.isLoaded ? profileStore.name : patientStore.name;
  const profileImage = profileStore.isLoaded ? profileStore.imageUrl : patientStore.imageUrl;

  // Re-transliterate user name when locale changes
  useEffect(() => {
    if (!userName) return;
    transliterateName(userName).then(setDisplayName);
  }, [userName, currentLocale]);

  // Refresh on adherenceUpdated event (fired by AdherenceCheckbox)
  useEffect(() => {
    const handler = () => {
      queryClient.invalidateQueries({ queryKey: ['patient', 'adherence', pid] });
      queryClient.invalidateQueries({ queryKey: ['patient', 'dashboard', uid] });
    };
    window.addEventListener('adherenceUpdated', handler);
    return () => window.removeEventListener('adherenceUpdated', handler);
  }, [pid, uid]);

  // Refresh callback for AdherenceCheckbox onUpdate
  function fetchDashboardData() {
    queryClient.invalidateQueries({ queryKey: ['patient', 'adherence', pid] });
    queryClient.invalidateQueries({ queryKey: ['patient', 'dashboard', uid] });
  }

  // Show loader only on very first load (no cached data yet)
  const isLoading = dashLoading && !dashData && !patientStore.isLoaded;
  if (isLoading) return <Loading />;

  const today = new Date();
  const formattedDate = formatDate(today);
  const firstNameOnly = displayName.split(' ')[0] || userName.split(' ')[0] || 'User';

  const hasActiveData = stats.totalAppointments > 0 || stats.activePrescriptions > 0 || stats.totalDoses > 0;

  const statCards = [
    { href: '/dashboard/appointments', icon: Calendar,     count: stats.upcomingAppointments, label: 'Upcoming Appointments', sub: 'Next: Check Schedule' },
    { href: '/dashboard/prescriptions', icon: Pill,        count: stats.activePrescriptions,  label: 'Active Prescriptions',  sub: 'Your Prescriptions' },
    { href: '/dashboard',              icon: Activity,     count: stats.totalAppointments,    label: 'Total Activity',         sub: 'All consultations' },
    { href: '/dashboard/prescriptions', icon: CheckCircle, count: `${stats.adherenceRate}%`, label: 'Adherence Score',        sub: 'Daily tracking' },
  ];

  return (
    <div className="pb-10">

      {/* ── HEADER ── */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-10">
        <div>
          <span className="pill-badge mb-4 inline-block">
            <Sparkles className="w-3 h-3" />
            <TranslatedText>DAILY INSIGHT</TranslatedText>
          </span>
          <h1 className="headline-lg mb-1">
            <TranslatedText>Welcome back,</TranslatedText>{' '}
            <span className="text-primary italic">
              {firstNameOnly}
            </span>
          </h1>
          <p className="body-md text-outline max-w-xl">
            <TranslatedText>{formattedDate}</TranslatedText>
          </p>
        </div>
        <blockquote className="hidden lg:block text-right max-w-xs body-md italic text-forest-600 leading-relaxed">
          <TranslatedText>"The body heals with play, the mind heals with laughter, and the spirit heals with joy."</TranslatedText>
        </blockquote>
      </div>

      {/* ── DB ERROR BANNER ── */}
      {dbError && (
        <div className="mb-6 rounded-2xl p-4 flex items-start gap-3 bg-sage-100 border border-sage-200">
          <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 bg-sage-200">
            <span className="text-lg font-bold text-forest-700">!</span>
          </div>
          <div>
            <h4 className="text-sm font-bold mb-0.5 text-forest-900"><TranslatedText>Sync Interrupted</TranslatedText></h4>
            <p className="text-xs text-forest-600">
              <TranslatedText>We're having trouble reaching the clinical database. Some details might be missing, but we're retrying automatically.</TranslatedText>
            </p>
          </div>
        </div>
      )}

      {/* Stats Grid: Unified Patient Console Card ("Big Tub") */}
      <div className="bg-white border border-sage-200 rounded-[2rem] shadow-[var(--shadow-sm)] hover:shadow-[var(--shadow-md)] transition-all duration-300 overflow-hidden flex flex-col lg:flex-row min-h-[340px] group mb-8 lg:mb-12">
        
        {/* 1. Patient Portrait (Left column) */}
        <div className="w-full lg:w-[25%] relative min-h-[250px] lg:min-h-full bg-sage-50/50 shrink-0 border-b lg:border-b-0 lg:border-r border-sage-200">
          {profileImage ? (
            <img 
              src={profileImage} 
              alt="Profile" 
              className="w-full h-full object-cover group-hover:scale-102 transition-transform duration-500" 
            />
          ) : (
            <div className="w-full h-full bg-sage-100/50 flex items-center justify-center">
              <User className="w-16 h-16 text-sage-300" />
            </div>
          )}
          
          {hasActiveData && (
            <div className="absolute top-5 left-5 bg-white rounded-full p-1.5 border border-sage-200 shadow-md flex items-center justify-center" title="Overall Adherence">
               <div className="relative w-10 h-10">
                  <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="42" fill="none" stroke="#e2f0e8" strokeWidth="12" />
                    <circle
                      cx="50" cy="50" r="42" fill="none"
                      stroke="#10b981" strokeWidth="12" strokeLinecap="round"
                      strokeDasharray="264"
                      strokeDashoffset={264 - (264 * stats.adherenceRate) / 100}
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Activity className="w-4 h-4 text-primary" />
                  </div>
               </div>
            </div>
          )}
        </div>

        {/* 2. Patient Info & Quick Stats (Right columns) */}
        <div className="flex-1 p-6 md:p-8 flex flex-col md:flex-row gap-6 md:gap-8 justify-between">
          
          {/* Left Inner: Patient Details & Health Vitality Alert */}
          <div className="flex-1 flex flex-col justify-between space-y-6">
            <div>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-sage-50 text-forest-700 border border-sage-200 uppercase tracking-wider mb-2">
                <Sparkles className="w-3.5 h-3.5 text-primary animate-pulse" />
                <TranslatedText>PATIENT OVERVIEW</TranslatedText>
              </span>
              
              <h2 className="text-2xl font-display font-extrabold text-forest-900 tracking-tight leading-tight mt-1">
                {displayName || userName}
              </h2>
              
              {hasActiveData ? (
                <div className="mt-2 flex flex-col gap-1 text-xs text-forest-600 font-medium">
                  <p className="flex items-center gap-1.5">
                    <CheckCircle className="w-3.5 h-3.5 text-primary shrink-0" />
                    <span><TranslatedText>Overall Adherence</TranslatedText>: {stats.adherenceRate}%</span>
                  </p>
                  <p className="flex items-center gap-1.5">
                    <Pill className="w-3.5 h-3.5 text-primary shrink-0" />
                    <span><TranslatedText>Taken</TranslatedText> {stats.takenDoses} <TranslatedText>of</TranslatedText> {stats.totalDoses} <TranslatedText>doses</TranslatedText></span>
                  </p>
                </div>
              ) : (
                <div className="mt-2 text-sm text-forest-600 font-medium max-w-md">
                  <TranslatedText>Welcome to AuraSutra! We're glad you're here to begin your Ayurvedic wellness journey.</TranslatedText>
                </div>
              )}
            </div>

            {/* Sub-tags */}
            <div className="flex flex-wrap gap-2">
              <Link href="/dashboard/profile" className="px-3 py-1.5 rounded-full text-xs font-semibold bg-sage-50/70 text-forest-700 border border-sage-200 hover:bg-sage-100 transition-colors flex items-center gap-1">
                <User className="w-3.5 h-3.5" /> <TranslatedText>View full profile</TranslatedText>
              </Link>
            </div>

            {/* Progress Bar or Empty CTA */}
            {hasActiveData ? (
              <div className="bg-sage-50/30 border border-sage-200/50 rounded-2xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${stats.dailyAdherenceRate < 100 ? 'bg-amber-500 animate-ping' : 'bg-emerald-500'}`} />
                    <span className="text-forest-600 text-[10px] font-bold uppercase tracking-wider"><TranslatedText>Daily Adherence</TranslatedText></span>
                  </div>
                  <span className={`text-[11px] font-extrabold px-2 py-0.5 rounded-full ${stats.dailyAdherenceRate < 100 ? 'bg-amber-100 text-amber-700 border border-amber-200' : 'bg-emerald-100 text-emerald-700 border border-emerald-200'}`}>
                    {stats.dailyAdherenceRate}%
                  </span>
                </div>
                <div className="h-1.5 w-full bg-sage-200 rounded-full overflow-hidden shadow-inner relative">
                  <div 
                    className={`h-full rounded-full transition-all duration-1000 ${stats.dailyAdherenceRate < 100 ? 'bg-gradient-to-r from-amber-400 to-orange-500' : 'bg-gradient-to-r from-emerald-400 to-teal-500'}`} 
                    style={{ width: `${Math.max(5, stats.dailyAdherenceRate)}%` }} 
                  />
                </div>
                <p className="text-[10px] text-forest-500 mt-1 italic">
                  {(() => {
                    const diff = stats.adherenceRate - stats.clinicAverage;
                    if (diff > 0) return <TranslatedText>Your recovery is faster than clinic average!</TranslatedText>;
                    if (diff === 0) return <TranslatedText>Your recovery matches the clinic average.</TranslatedText>;
                    return <TranslatedText>Your recovery is below clinic average. Keep going!</TranslatedText>;
                  })()}
                </p>
              </div>
            ) : (
              <div className="bg-sage-50/30 border border-sage-200/50 rounded-2xl p-4">
                <h4 className="text-forest-700 font-bold text-sm mb-1"><TranslatedText>Ready to start?</TranslatedText></h4>
                <p className="text-xs text-forest-500 mb-4"><TranslatedText>Book your first consultation with an Ayurvedic specialist to get a personalized treatment plan.</TranslatedText></p>
                <Link href="/dashboard/find-doctors" className="inline-flex items-center justify-center bg-primary text-white text-xs font-bold px-4 py-2 rounded-lg hover:bg-primary-600 transition-colors">
                  <TranslatedText>Find a Doctor</TranslatedText>
                </Link>
              </div>
            )}
          </div>

          {/* Right Inner: Only show if they have data */}
          {hasActiveData && (
            <div className="w-full md:w-[48%] lg:w-[45%] flex flex-col justify-between border-t md:border-t-0 md:border-l border-sage-200/70 md:pl-6 lg:pl-8 pt-6 md:pt-0">
              <h3 className="text-xs font-bold text-forest-500 uppercase tracking-widest mb-4"><TranslatedText>Patient Metrics</TranslatedText></h3>
              
              <div className="grid grid-cols-2 gap-3 sm:gap-4 flex-1">
                {statCards.map((card, i) => (
                  <Link key={i} href={card.href} className="bg-sage-50/20 border border-sage-100/60 rounded-2xl p-4 flex flex-col justify-between hover:bg-sage-50/50 hover:border-sage-200/60 transition-all duration-200 group/item relative">
                    <div className="flex justify-between items-start mb-2">
                      <div className="w-8 h-8 rounded-full bg-sage-100 flex items-center justify-center text-primary shrink-0"><card.icon className="w-4 h-4" /></div>
                      <ArrowUpRight className="w-3.5 h-3.5 opacity-0 group-hover/item:opacity-100 transition-opacity text-forest-400" />
                    </div>
                    <div>
                      <h4 className="text-lg sm:text-xl font-black font-display text-forest-900 leading-tight truncate">{card.count}</h4>
                      <p className="text-[10px] font-bold text-primary uppercase tracking-wider leading-none mt-1"><TranslatedText>{card.label}</TranslatedText></p>
                      <p className="text-[9px] text-forest-400 leading-none mt-1"><TranslatedText>{card.sub}</TranslatedText></p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

        </div>
      </div>

      {/* ── TODAY'S MEDICATIONS (Quick Actions) ── */}
      {(schedule.dueNow.length > 0 || schedule.pending.length > 0 || schedule.upcoming.length > 0) && (
        <div className="mb-8 lg:mb-12">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="headline-md flex items-center gap-2"><Clock className="w-5 h-5 text-forest-500"/> <TranslatedText>Today's Medications</TranslatedText></h2>
              <p className="body-sm text-forest-500"><TranslatedText>Stay on top of your schedule</TranslatedText></p>
            </div>
            <Link href="/dashboard/prescriptions" className="text-sm font-bold text-primary hover:text-primary-600 smooth-transition"><TranslatedText>View All</TranslatedText> →</Link>
          </div>
          
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
             {(() => {
                const now = new Date();
                const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
                
                const allToday = [...(schedule.overdue || []), ...schedule.dueNow, ...schedule.pending, ...schedule.upcoming, ...(schedule.taken || []), ...(schedule.skipped || [])].filter(med => {
                   const dateStr = String(med.scheduled_date).split('T')[0];
                   return dateStr <= todayStr;
                }).reduce((acc: any[], med: any) => {
                   if (!acc.find(m => m.adherence_id === med.adherence_id)) {
                       acc.push(med);
                   }
                   return acc;
                }, []).sort((a: any, b: any) => {
                   if (a.scheduled_date !== b.scheduled_date) return a.scheduled_date.localeCompare(b.scheduled_date);
                   return a.scheduled_time.localeCompare(b.scheduled_time);
                });
                
                const firstPendingId = allToday.find((m: any) => m.status === 'pending')?.adherence_id;
                
                return allToday.slice(0, 6).map((med: any) => {
                   const isNextMed = med.adherence_id === firstPendingId;
                   const isDisabled = med.status === 'pending' && !isNextMed;
                   
                   return (
                     <AdherenceCheckbox
                       key={med.adherence_id}
                       adherenceId={med.adherence_id}
                       medicineName={med.medicine_name}
                       scheduledTime={med.scheduled_time}
                       scheduledDate={med.scheduled_date}
                       isTaken={med.status === 'taken'}
                       disabled={isDisabled}
                       isNextMed={isNextMed}
                       onUpdate={fetchDashboardData}
                       size="large"
                     />
                   );
                });
             })()}
          </div>
        </div>
      )}

      {/* ── ACTIVE MEDICINE STATS ── */}
      {dashData?.medicineData && dashData.medicineData.length > 0 && (
        <div className="mb-8 lg:mb-12">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="headline-md flex items-center gap-2"><Activity className="w-5 h-5 text-forest-500"/> <TranslatedText>Running Medicines Stats</TranslatedText></h2>
              <p className="body-sm text-forest-500"><TranslatedText>Track adherence for each active medicine</TranslatedText></p>
            </div>
            <Link href="/dashboard/prescriptions" className="text-sm font-bold text-primary hover:text-primary-600 smooth-transition"><TranslatedText>View Prescriptions</TranslatedText> →</Link>
          </div>
          
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {dashData.medicineData.map((med: any, idx: number) => (
              <div key={idx} className="editorial-card bg-white rounded-2xl p-4 sm:p-5 shadow-sage-sm border border-sage-100 flex items-center justify-between">
                 <div>
                    <h3 className="font-bold text-forest-900 mb-1 truncate max-w-[140px] sm:max-w-[180px]"><MedicineName name={med.name} currentLocale={currentLocale} /></h3>
                    <p className="text-[10px] text-forest-500 font-semibold tracking-widest"><TranslatedText>OVERALL ADHERENCE</TranslatedText></p>
                 </div>
                 <div className="relative w-14 h-14 shrink-0">
                    <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                      <circle cx="50" cy="50" r="42" fill="none" stroke="#e2f0e8" strokeWidth="8" />
                      <circle
                        cx="50" cy="50" r="42" fill="none"
                        stroke="#10b981" strokeWidth="8" strokeLinecap="round"
                        strokeDasharray="264"
                        strokeDashoffset={264 - (264 * med.value) / 100}
                        className="transition-all duration-1000 ease-out"
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-[14px] font-black font-display text-forest-900 leading-none">{med.value}%</span>
                    </div>
                  </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── BOTTOM ROW ── */}
      <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-5">

        {/* Upcoming Appointments */}
        <Link
          href="/dashboard/appointments"
          className="editorial-card rounded-3xl p-4 sm:p-6 smooth-transition group min-h-[160px] sm:min-h-[180px] flex flex-col justify-between"
        >
          <div className="flex justify-between items-start mb-3">
            <div>
              <span className="pill-badge mb-3 inline-block">
                <Calendar className="w-3 h-3" />
                <TranslatedText>UPCOMING</TranslatedText>
              </span>
              <h3 className="headline-md text-[1.1rem]"><TranslatedText>Your Consultations</TranslatedText></h3>
            </div>
            <Calendar className="w-5 h-5 smooth-transition text-forest-400" />
          </div>
          <div className="rounded-2xl p-3 flex items-center gap-3 bg-sage-50">
            <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 bg-sage-200">
              <Stethoscope className="w-4 h-4 text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold text-forest-900">{stats.upcomingAppointments} <TranslatedText>upcoming</TranslatedText></p>
              <p className="text-[10px] font-medium text-forest-400"><TranslatedText>View full calendar →</TranslatedText></p>
            </div>
          </div>
        </Link>

        {/* Find Doctors */}
        <Link
          href="/dashboard/find-doctors"
          className="editorial-card rounded-3xl p-4 sm:p-6 smooth-transition group min-h-[160px] sm:min-h-[180px] flex flex-col justify-between"
        >
          <div className="flex justify-between items-start mb-3">
            <div>
              <span className="pill-badge mb-3 inline-block">
                <Users className="w-3 h-3" />
                <TranslatedText>AYURVEDIC NETWORK</TranslatedText>
              </span>
              <h3 className="headline-md text-[1.1rem]"><TranslatedText>Find Doctors</TranslatedText></h3>
            </div>
            <Search className="w-5 h-5 smooth-transition text-forest-400" />
          </div>
          <div className="rounded-2xl p-3 flex items-center gap-3 bg-sage-50">
            <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 bg-sage-200">
              <User className="w-4 h-4 text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold text-forest-900"><TranslatedText>Browse specialists</TranslatedText></p>
              <p className="text-[10px] font-medium text-forest-400"><TranslatedText>Book appointments →</TranslatedText></p>
            </div>
          </div>
        </Link>

        {/* Adherence Trend */}
        <div className="editorial-card rounded-3xl p-4 sm:p-6 smooth-transition min-h-[160px] sm:min-h-[180px] flex flex-col sm:col-span-2 md:col-span-1">
          <div className="flex justify-between items-start mb-4">
            <div>
              <span className="pill-badge mb-3 inline-block">
                <BarChart3 className="w-3 h-3" />
                <TranslatedText>TREND</TranslatedText>
              </span>
              <h3 className="headline-md text-[1.1rem]"><TranslatedText>Adherence Trend</TranslatedText></h3>
            </div>
            <TrendingUp className="w-5 h-5 text-forest-400" />
          </div>
          <div className="flex-1 min-h-[70px]">
            {adherenceTrend.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={adherenceTrend}>
                  <Line type="monotone" dataKey="taken" stroke="#22854a" strokeWidth={2.5} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full">
                <p className="text-xs font-medium text-forest-400"><TranslatedText>No trend data yet</TranslatedText></p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
