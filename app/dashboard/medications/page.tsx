'use client';
 
export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { Pill, CheckCircle2, XCircle, Clock, TrendingUp, Calendar } from 'lucide-react';
import toast from 'react-hot-toast';
import Loading from '@/app/components/Loading';
import { TranslatedText } from '@/app/components/TranslatedText';
import { MedicineName } from '@/app/components/MedicineName';
import { useLanguage } from '@/app/contexts/LanguageContext';
import { useAuthToken } from '@/lib/auth-token-context';
import { usePatientStore } from '@/app/store/usePatientStore';
import { useAdherence } from '@/app/hooks/queries/useAdherence';
import { useMarkAdherence } from '@/app/hooks/mutations/useMarkAdherence';
import { usePatientIdentity } from '@/app/hooks/queries/usePatientData';
import { useQueryClient } from '@tanstack/react-query';

interface AdherenceRecord {
  adherenceId: string;
  medicineName: string;
  scheduledDate: string;
  isTaken: boolean;
  isSkipped: boolean;
  takenAt: string;
}

export default function MedicationsPage() {
  const token = useAuthToken();
  const { translate, currentLocale } = useLanguage();

  const patientStore = usePatientStore();

  // ── TanStack Query ──
  const { data: identity } = usePatientIdentity(token);
  const pid = identity?.pid || patientStore.pid || null;
  const uid = identity?.uid || patientStore.uid || null;

  const { data: adherenceData, isLoading: adherenceLoading } = useAdherence(pid, token);
  const markAdherence = useMarkAdherence();
  const queryClient = useQueryClient();

  // Derive pending (today's un-taken meds) from query data
  const pending = (adherenceData?.pending || []).filter((r) => {
    const d = new Date();
    const todayStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const dateStr = String(r.scheduled_date).split('T')[0];
    return dateStr === todayStr;
  }).map((r) => ({
    adherenceId: r.adherence_id,
    medicineName: r.medicine_name,
    scheduledDate: r.scheduled_date,
    isTaken: r.status === 'taken',
    isSkipped: r.status === 'skipped',
    takenAt: '',
  }));

  // Stats derived from query data
  const allRecords = adherenceData?.all || [];
  
  const elapsedRecords = allRecords.filter((r) => {
    const d = new Date();
    const todayStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const timeStr = d.toTimeString().split(' ')[0];
    const ds = typeof r.scheduled_date === 'string' 
      ? r.scheduled_date.split('T')[0] 
      : new Date(r.scheduled_date).toISOString().split('T')[0];
    const ts = r.scheduled_time;
    if (ds < todayStr) return true;
    if (ds === todayStr && ts <= timeStr) return true;
    if (r.status === 'taken' || r.status === 'skipped') return true;
    return false;
  });

  const elapsedTaken = elapsedRecords.filter(r => r.status === 'taken').length;
  const elapsedSkipped = elapsedRecords.filter(r => r.status === 'skipped').length;
  const pendingCount = allRecords.length - elapsedTaken - elapsedSkipped;
  
  const stats = allRecords.length > 0 ? {
    total: elapsedRecords.length,
    taken: elapsedTaken,
    skipped: elapsedSkipped,
    pending: pendingCount,
    adherenceRate: elapsedRecords.length > 0 ? Math.round((elapsedTaken / elapsedRecords.length) * 100) : 0,
  } : null;

  const loading = adherenceLoading && allRecords.length === 0;

  async function markMedicine(adherence_id: string, action: 'taken' | 'skipped') {
    if (!pid || !uid || !token) return;
    try {
      await markAdherence.mutateAsync({ adherenceId: adherence_id, status: action, pid, uid, token });
      const msg = await translate(action === 'taken' ? 'Marked as taken!' : 'Marked as skipped');
      toast.success(msg);
    } catch {
      const msg = await translate('Failed to update');
      toast.error(msg);
    }
  }

  async function snoozeMedicine(adherence_id: string) {
    if (!pid || !uid || !token) return;
    try {
      const res = await fetch('/api/patient/adherence/snooze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ adherenceId: adherence_id })
      });
      const data = await res.json();
      if (data.success) {
        toast.success(await translate('Snoozed for 10 minutes'));
        queryClient.invalidateQueries({ queryKey: ['patient', 'adherence', pid] });
        queryClient.invalidateQueries({ queryKey: ['patient', 'dashboard', uid] });
        if (typeof window !== 'undefined') window.dispatchEvent(new Event('adherenceUpdated'));
      } else {
        throw new Error(data.error);
      }
    } catch {
      toast.error(await translate('Failed to snooze'));
    }
  }

  if (loading) return <Loading />;

  const statCards = stats ? [
    { icon: Pill,         label: 'Elapsed Doses',    value: stats.total,          bg: 'bg-sage-100',  iconBg: 'bg-sage-200',  iconColor: 'text-forest-600' },
    { icon: CheckCircle2, label: 'Taken',           value: stats.taken,          bg: 'bg-sage-100',  iconBg: 'bg-sage-200',  iconColor: 'text-forest-600' },
    { icon: XCircle,      label: 'Skipped',         value: stats.skipped,        bg: 'bg-[var(--error-container)]',    iconBg: 'bg-[var(--error-container)]',   iconColor: 'text-[var(--status-error)]'    },
    { icon: TrendingUp,   label: 'Adherence Rate',  value: `${stats.adherenceRate}%`, bg: 'bg-sage-200', iconBg: 'bg-forest-500', iconColor: 'text-white' },
  ] : [];

  return (
    <div className="space-y-6 pb-10">
      <div className="mb-10">
        <span className="pill-badge mb-4 inline-block">
          <Calendar className="w-3 h-3" />
          <TranslatedText>DAILY TRACKER</TranslatedText>
        </span>
        <h1 className="headline-lg mb-1">
          <TranslatedText>My</TranslatedText> <span className="text-primary italic"><TranslatedText>Medications</TranslatedText></span>
        </h1>
        <p className="body-md text-outline max-w-xl">
          <TranslatedText>
            Manage your daily medicine adherence and track your healing journey.
          </TranslatedText>
        </p>
      </div>

      {/* ── STATS GRID ── */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {statCards.map(({ icon: Icon, label, value, bg, iconBg, iconColor }) => (
            <div key={label} className={`${bg} rounded-2xl p-3 sm:p-5 border border-sage-200 shadow-forest-sm`}>
              <div className="flex items-center justify-between mb-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${iconBg}`}>
                  <Icon className={`w-5 h-5 ${iconColor}`} />
                </div>
                <span className="text-2xl font-black font-display text-forest-900">{value}</span>
              </div>
              <TranslatedText as="p" className="text-xs font-bold tracking-wider uppercase text-forest-400">{label}</TranslatedText>
            </div>
          ))}
        </div>
      )}

      {/* ── TODAY'S MEDICINES ── */}
      <div className="bg-white rounded-2xl p-4 sm:p-6 shadow-forest-sm border border-sage-100">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-9 h-9 rounded-full flex items-center justify-center bg-sage-100">
            <Clock className="w-5 h-5 text-forest-500" />
          </div>
          <h2 className="text-lg font-display font-bold text-forest-900">
            <TranslatedText>Today's Medicines</TranslatedText> ({pending.length})
          </h2>
        </div>

        {pending.length === 0 ? (
          <div className="text-center py-12 rounded-2xl bg-sage-50">
            <CheckCircle2 className="w-14 h-14 mx-auto mb-3 text-forest-500" />
            <TranslatedText as="h3" className="headline-md mb-2">All Done for Today!</TranslatedText>
            <TranslatedText as="p" className="body-md text-forest-400">You've taken all your medicines. Great job! 🎉</TranslatedText>
          </div>
        ) : (
          <div className="space-y-3">
            {pending.map((med) => (
              <div key={med.adherenceId} className="p-3 sm:p-5 rounded-2xl bg-sage-50 border border-sage-200 transition-all duration-200">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="flex-1">
                    <h3 className="font-bold text-lg mb-1 font-display text-forest-900"><MedicineName name={med.medicineName} currentLocale={currentLocale} /></h3>
                    <TranslatedText as="p" className="text-sm text-forest-400">Scheduled for today</TranslatedText>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => markMedicine(med.adherenceId, 'taken')} disabled={markAdherence.isPending}
                      className="btn-primary px-4 py-2 text-xs font-bold disabled:opacity-50 flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4" />
                      <TranslatedText as="span">{markAdherence.isPending ? 'Updating...' : 'MARK TAKEN'}</TranslatedText>
                    </button>
                    <button onClick={() => snoozeMedicine(med.adherenceId)} disabled={markAdherence.isPending}
                      className="px-4 py-2 text-xs font-bold disabled:opacity-50 flex items-center gap-2 rounded-full border border-forest-200 text-forest-700 bg-white hover:bg-forest-50 transition-colors">
                      <Clock className="w-4 h-4" />
                      <TranslatedText as="span">SNOOZE 10M</TranslatedText>
                    </button>
                    <button onClick={() => markMedicine(med.adherenceId, 'skipped')} disabled={markAdherence.isPending}
                      className="btn-secondary px-4 py-2 text-xs font-bold disabled:opacity-50 flex items-center gap-2">
                      <XCircle className="w-4 h-4" />
                      <TranslatedText as="span">SKIP</TranslatedText>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── EXCELLENCE BANNER ── */}
      {stats && stats.pending === 0 && stats.total > 0 && (
        <div className="gradient-primary rounded-3xl p-4 sm:p-6 shadow-primary">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-full flex items-center justify-center shrink-0 bg-white/15">
              <TrendingUp className="w-6 h-6 text-white" />
            </div>
            <div>
              <TranslatedText as="h3" className="text-lg font-display font-bold text-white mb-1">Excellent Adherence!</TranslatedText>
              <p className="text-sm text-sage-200">
                <TranslatedText>You've maintained</TranslatedText> {stats.adherenceRate}% <TranslatedText>adherence. Keep up the great work!</TranslatedText>
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
