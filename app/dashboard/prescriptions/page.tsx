'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState, useRef, useMemo } from 'react';
import { Pill, Calendar, CheckCircle2, ChevronDown, TrendingUp, User, Clock, FileText, CheckCircle, Activity, XCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import Loading from '@/app/components/Loading';
import AdherenceCheckbox from '@/app/components/AdherenceCheckbox';
import ReactMarkdown from 'react-markdown';
import DOMPurify from 'isomorphic-dompurify';
import { useRouter } from 'next/navigation';
import { TranslatedText } from '@/app/components/TranslatedText';
import { MedicineName } from '@/app/components/MedicineName';
import { useLanguage } from '@/app/contexts/LanguageContext';
import { useAuthToken } from '@/lib/auth-token-context';
import { fetchWithAuth } from '@/lib/fetchWithAuth';
import { useNameTransliteration } from '@/app/hooks/useNameTransliteration';
import { formatDate } from '@/lib/formatDate';
import { usePatientStore } from '@/app/store/usePatientStore';
import { usePrescriptions } from '@/app/hooks/queries/usePrescriptions';
import { useAdherence } from '@/app/hooks/queries/useAdherence';
import { useQueryClient, useQueries } from '@tanstack/react-query';
import { usePatientIdentity } from '@/app/hooks/queries/usePatientData';

// Renders doctor instructions as proper markdown (bold, lists, headings, etc.)

function FormattedInstructions({ text }: { text: string }) {
  // Normalize single asterisks used as stray bullets (* text) → proper markdown bullets (- text)
  const normalized = text
    .replace(/^\*\s+(?!\*)/gm, '- ')   // leading "* " → "- " (but not "** ")
    .replace(/\n{3,}/g, '\n\n');        // collapse excess blank lines

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
              <span className="flex-shrink-0 w-5 h-5 rounded-full bg-forest-600 text-white text-[10px] font-bold flex items-center justify-center mt-0.5">
                {(props as any).index + 1}
              </span>
              <span>{children}</span>
            </li>
          ) : (
            <li className="flex gap-2 text-sm text-forest-800">
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
      {normalized}
    </ReactMarkdown>
  );
}

interface Medicine { name: string; dosage: string; frequency: string; duration: string; notes?: string; }
interface Prescription {
  prescription_id: string; diagnosis: string; symptoms: string[]; medicines: Medicine[];
  instructions: string; dietAdvice: string; diet_advice?: string; followUpDate: string; createdAt: string; sentAt: string;
  doctors: { users: { name: string; profile_image_url: string } };
}
interface AdherenceRecord {
  adherence_id: string; medicine_name: string; scheduled_date: string; scheduled_time: string;
  status: 'pending' | 'taken' | 'skipped'; prescription_id: string;
}

export default function PrescriptionsPage() {
  const token = useAuthToken();
  const { translate, currentLocale } = useLanguage();
  const { transliterateName } = useNameTransliteration();

  const patientStore = usePatientStore();
  const queryClient = useQueryClient();

  // ── TanStack Query ──
  const { data: identity } = usePatientIdentity(token);
  const pid = identity?.pid || patientStore.pid || null;
  const uid = identity?.uid || patientStore.uid || null;

  const { data: rxData, isLoading: rxLoading } = usePrescriptions(pid, token);
  const { data: adherenceData, isLoading: adhLoading } = useAdherence(pid, token);

  const prescriptions: Prescription[] = useMemo(() => rxData?.sent || [], [rxData?.sent]);
  const loading = rxLoading && !rxData;

  const [selectedPrescription, setSelectedPrescription] = useState<Prescription | null>(null);
  const [activeTab, setActiveTab] = useState<Record<string, 'schedule' | 'progress'>>({});
  const [adherenceMap, setAdherenceMap] = useState<Map<string, AdherenceRecord[]>>(new Map());
  const [doctorNames, setDoctorNames] = useState<Record<string, string>>({});

  const getLocalDateString = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const getLocalTimeString = () => {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:00`;
  };

  const formatScheduledTime = (time: string) => {
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  const statsQueries = useQueries({
    queries: prescriptions.map(rx => ({
      queryKey: ['prescriptionStats', rx.prescription_id],
      queryFn: async () => {
        const res = await fetchWithAuth(`/api/patient/adherence/stats?pid=${pid}&prescription_id=${rx.prescription_id}`, token);
        const data = await res.json();
        return data.success ? data.stats : null;
      },
      enabled: !!token && !!pid,
      staleTime: Infinity,
    }))
  });

  const stats = useMemo(() => {
    const map: Record<string, any> = {};
    prescriptions.forEach((rx, index) => {
      const q = statsQueries[index];
      if (q.data) {
        map[rx.prescription_id] = q.data;
      }
    });
    return map;
  }, [statsQueries, prescriptions]);

  useEffect(() => {
    const handleUpdate = () => {
      if (pid) {
        queryClient.invalidateQueries({ queryKey: ['patient', 'adherence', pid] });
      }
      queryClient.invalidateQueries({ queryKey: ['prescriptionStats'] });
    };
    window.addEventListener('adherenceUpdated', handleUpdate);
    return () => window.removeEventListener('adherenceUpdated', handleUpdate);
  }, [pid, queryClient]);



  // Build adherence map from query data
  useEffect(() => {
    if (!adherenceData?.all?.length) return;
    const map = new Map<string, AdherenceRecord[]>();
    adherenceData.all.forEach((r: any) => {
      const key = `${r.prescription_id}_${r.medicine_name}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(r);
    });
    setAdherenceMap(map);
  }, [adherenceData]);

  // Re-transliterate doctor names when locale changes
  useEffect(() => {
    if (!prescriptions || prescriptions.length === 0) return;
    (async () => {
      const nameMap: Record<string, string> = {};
      for (const rx of prescriptions) {
        if (rx.doctors?.users?.name) {
          nameMap[rx.doctors.users.name] = await transliterateName(rx.doctors.users.name);
        }
      }
      setDoctorNames(nameMap);
    })();
  }, [prescriptions, currentLocale]);

  // Listen for adherence updates
  useEffect(() => {
    const handler = () => {
      queryClient.invalidateQueries({ queryKey: ['patient', 'adherence', pid] });
    };
    window.addEventListener('adherenceUpdated', handler);
    return () => window.removeEventListener('adherenceUpdated', handler);
  }, [pid, selectedPrescription]);

  if (loading) return <Loading />;

  return (
    <div className="pb-12 animate-enter pt-2">
      <div className="mb-10">
        <span className="pill-badge mb-4 inline-block">
          <FileText className="w-3 h-3" />
          <TranslatedText>MEDICAL RECORDS</TranslatedText>
        </span>
        <h1 className="headline-lg mb-1">
          <TranslatedText>Clinical</TranslatedText> <span className="text-primary italic"><TranslatedText>Prescriptions</TranslatedText></span>
        </h1>
        <p className="body-md text-outline max-w-xl">
          <TranslatedText>Track your active medications, dosages, and refill history.</TranslatedText>
        </p>
      </div>

      {prescriptions.length === 0 ? (
        <div className="text-center py-20 rounded-3xl bg-sage-50 border border-sage-100">
          <Pill className="w-14 h-14 mx-auto mb-4 text-sage-300" />
          <h3 className="headline-md mb-2"><TranslatedText>No Prescriptions Yet</TranslatedText></h3>
          <p className="body-md text-forest-400"><TranslatedText>Your doctor will send prescriptions here after your consultations.</TranslatedText></p>
        </div>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg sm:text-xl font-display font-medium"><TranslatedText>Active Management</TranslatedText></h2>
            <span className="text-xs font-bold tracking-wider text-forest-400">{prescriptions.length} <TranslatedText>ACTIVE ITEMS</TranslatedText></span>
          </div>

          <div className="space-y-4 mb-10">
            {prescriptions.map((rx) => {
              const todayStr = getLocalDateString();
              const timeStr = getLocalTimeString();
              const allMeds: AdherenceRecord[] = [];
              (rx.medicines || []).forEach((med: any) => {
                const key = `${rx.prescription_id}_${med.name}`;
                allMeds.push(...(adherenceMap.get(key) || []));
              });

              const todayMeds = allMeds.filter(r => r.scheduled_date && String(r.scheduled_date).split('T')[0] === todayStr);
              const todayElapsed = todayMeds.filter(r => r.scheduled_time <= timeStr || r.status !== 'pending');
              const dailyTaken = todayElapsed.filter((r) => r.status === 'taken').length;
              const dailyTotal = todayElapsed.length;
              const dailyPct = dailyTotal > 0 ? Math.round((dailyTaken / dailyTotal) * 100) : 0;

              const overallElapsed = allMeds.filter(r => {
                 const ds = String(r.scheduled_date).split('T')[0];
                 return ds < todayStr || (ds === todayStr && r.scheduled_time <= timeStr) || r.status !== 'pending';
              });
              const overallTaken = overallElapsed.filter(r => r.status === 'taken').length;
              const overallTotal = overallElapsed.length;
              const overallPct = overallTotal > 0 ? Math.round((overallTaken / overallTotal) * 100) : 0;
              return (
                <div key={rx.prescription_id} className="editorial-card overflow-hidden bg-white mb-4 sm:mb-8 border border-sage-100 shadow-sage-sm">
                  <div className="p-4 sm:p-6">
                    {/* Header Signature Section */}
                    <div className="flex items-center justify-between gap-3 mb-4 sm:mb-8 pb-4 sm:pb-6 border-b border-sage-50">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="w-16 h-16 sm:w-20 sm:h-20 shrink-0 rounded-2xl overflow-hidden bg-sage-50 ring-1 ring-sage-200 shadow-sm">
                          {rx.doctors?.users?.profile_image_url ? (
                            <img src={rx.doctors.users.profile_image_url} alt={doctorNames[rx.doctors?.users?.name] || rx.doctors?.users?.name} 
                              className="w-full h-full object-cover grayscale-[0.1] hover:grayscale-0 transition-all duration-500" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center gradient-sage">
                              <User className="w-8 h-8 text-forest-300" />
                            </div>
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-[10px] font-bold tracking-[0.2em] text-forest-400 uppercase mb-1">
                            <TranslatedText>Prescribing Doctor</TranslatedText>
                          </p>
                          <p className="headline-sm text-forest-900 leading-tight devanagari-small truncate">{doctorNames[rx.doctors?.users?.name] || rx.doctors?.users?.name}</p>
                          <p className="text-xs font-medium text-forest-500 italic mt-0.5 opacity-80"><TranslatedText>Clinical Specialist</TranslatedText></p>
                        </div>
                      </div>
                      
                      <div className="flex flex-col items-end gap-2 shrink-0">
                        <span className="pill-badge pill-badge-dark">
                          <CheckCircle2 className="w-3 h-3" />
                          <TranslatedText>ACTIVE PLAN</TranslatedText>
                        </span>
                        <p className="text-[10px] font-mono text-forest-600 bg-sage-50 px-2 py-0.5 rounded border border-sage-100 uppercase">
                            #{rx.prescription_id.slice(-8)}
                          </p>
                      </div>
                    </div>

                    {/* Content Section */}
                    <div className="flex flex-col md:flex-row items-start justify-between gap-6 md:gap-10">
                      <div className="flex-1">
                        <p className="text-[10px] font-bold tracking-[0.2em] text-forest-400 uppercase mb-3">
                          <TranslatedText>DIAGNOSIS & FOCUS</TranslatedText>
                        </p>
                        <h3 className="text-base sm:text-lg font-display font-medium text-forest-900 mb-4 sm:mb-8 leading-relaxed"><TranslatedText>{rx.diagnosis}</TranslatedText></h3>
                        
                        <div className="grid sm:grid-cols-2 gap-4">
                          {(rx.medicines || []).map((med, i) => (
                            <div key={i} className="p-5 rounded-2xl bg-sage-50/50 border border-sage-100 group hover:border-sage-300 transition-all hover:bg-white hover:shadow-sage-sm">
                              <p className="text-sm font-bold text-forest-900 mb-3 flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-forest-500" />
                                <MedicineName name={med.name} currentLocale={currentLocale} />
                              </p>
                              <div className="flex flex-wrap gap-4 sm:gap-8">
                                <div>
                                  <p className="text-[9px] font-bold tracking-widest text-forest-400 uppercase mb-1"><TranslatedText>DOSAGE</TranslatedText></p>
                                  <p className="text-xs font-semibold text-forest-800">{med.dosage}</p>
                                </div>
                                <div>
                                  <p className="text-[9px] font-bold tracking-widest text-forest-400 uppercase mb-1"><TranslatedText>FREQUENCY</TranslatedText></p>
                                  <p className="text-xs font-semibold text-forest-800"><TranslatedText>{med.frequency}</TranslatedText></p>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="w-full md:w-56 lg:w-72 shrink-0 flex flex-col items-stretch gap-6 md:pt-0 lg:pt-8">
                        {(stats[rx.prescription_id]?.todayScheduled > 0 || stats[rx.prescription_id]?.totalDoses > 0) && (
                          <div className="flex flex-col gap-4">
                            {/* Today's Dose Record */}
                            <div className="p-4 sm:p-5 rounded-2xl bg-white border border-sage-100 shadow-sage-sm">
                              <div className="flex justify-between items-center mb-4">
                                <span className="text-[10px] font-bold tracking-widest text-forest-400 uppercase">
                                  <TranslatedText>Today's Dose Record</TranslatedText>
                                </span>
                                <span className="text-sm font-bold text-forest-900">{stats[rx.prescription_id]?.dailyPercentage}%</span>
                              </div>
                              <div className="w-full bg-sage-50 rounded-full h-2 mb-4">
                                <div className="bg-blue-500 h-2 rounded-full transition-all duration-1000" style={{ width: `${stats[rx.prescription_id]?.dailyPercentage || 0}%` }}></div>
                              </div>
                              <div className="grid grid-cols-4 gap-2 text-center">
                                <div className="p-2 bg-sage-50 rounded-lg">
                                  <div className="text-sm font-bold text-forest-900">{stats[rx.prescription_id]?.todayScheduled || 0}</div>
                                  <div className="text-[8px] font-bold tracking-widest text-forest-400 uppercase"><TranslatedText>Total</TranslatedText></div>
                                </div>
                                <div className="p-2 bg-emerald-50 rounded-lg">
                                  <div className="text-sm font-bold text-emerald-600">{stats[rx.prescription_id]?.todayTaken || 0}</div>
                                  <div className="text-[8px] font-bold tracking-widest text-emerald-600 uppercase"><TranslatedText>Taken</TranslatedText></div>
                                </div>
                                <div className="p-2 bg-yellow-50 rounded-lg">
                                  <div className="text-sm font-bold text-yellow-600">{stats[rx.prescription_id]?.todaySkipped || 0}</div>
                                  <div className="text-[8px] font-bold tracking-widest text-yellow-600 uppercase"><TranslatedText>Skipped</TranslatedText></div>
                                </div>
                                <div className="p-2 bg-red-50 rounded-lg">
                                  <div className="text-sm font-bold text-red-600">{stats[rx.prescription_id]?.todayNotTaken || 0}</div>
                                  <div className="text-[8px] font-bold tracking-widest text-red-600 uppercase"><TranslatedText>Not Taken</TranslatedText></div>
                                </div>
                              </div>
                            </div>
                            
                            {/* Overall Dose Record */}
                            <div className="p-4 sm:p-5 rounded-2xl bg-white border border-sage-100 shadow-sage-sm">
                              <div className="flex justify-between items-center mb-4">
                                <span className="text-[10px] font-bold tracking-widest text-forest-400 uppercase">
                                  <TranslatedText>Overall Dose Record</TranslatedText>
                                </span>
                                <span className="text-sm font-bold text-forest-900">{stats[rx.prescription_id]?.overallPercentage}%</span>
                              </div>
                              <div className="w-full bg-sage-50 rounded-full h-2 mb-4">
                                <div className="bg-emerald-500 h-2 rounded-full transition-all duration-1000" style={{ width: `${stats[rx.prescription_id]?.overallPercentage || 0}%` }}></div>
                              </div>
                              <div className="grid grid-cols-4 gap-2 text-center">
                                <div className="p-2 bg-sage-50 rounded-lg">
                                  <div className="text-sm font-bold text-forest-900">{stats[rx.prescription_id]?.totalDoses || 0}</div>
                                  <div className="text-[8px] font-bold tracking-widest text-forest-400 uppercase"><TranslatedText>Total</TranslatedText></div>
                                </div>
                                <div className="p-2 bg-emerald-50 rounded-lg">
                                  <div className="text-sm font-bold text-emerald-600">{stats[rx.prescription_id]?.totalTaken || 0}</div>
                                  <div className="text-[8px] font-bold tracking-widest text-emerald-600 uppercase"><TranslatedText>Taken</TranslatedText></div>
                                </div>
                                <div className="p-2 bg-yellow-50 rounded-lg">
                                  <div className="text-sm font-bold text-yellow-600">{stats[rx.prescription_id]?.totalSkipped || 0}</div>
                                  <div className="text-[8px] font-bold tracking-widest text-yellow-600 uppercase"><TranslatedText>Skipped</TranslatedText></div>
                                </div>
                                <div className="p-2 bg-red-50 rounded-lg">
                                  <div className="text-sm font-bold text-red-600">{stats[rx.prescription_id]?.totalNotTaken || 0}</div>
                                  <div className="text-[8px] font-bold tracking-widest text-red-600 uppercase"><TranslatedText>Not Taken</TranslatedText></div>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}

                        <button onClick={() => { setSelectedPrescription(rx); setActiveTab((p) => ({ ...p, [rx.prescription_id]: 'schedule' })); }}
                          className="btn-primary w-full py-4 text-xs tracking-widest font-bold shadow-lg hover:shadow-xl transition-all">
                          <TranslatedText>VIEW TREATMENT DETAIL</TranslatedText>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* ── Awareness Banner ── */}
          <div className="gradient-primary rounded-3xl p-6 shadow-primary">
            <h3 className="text-lg font-display font-bold italic text-white mb-3"><TranslatedText>Medication Awareness</TranslatedText></h3>
            <p className="text-sm text-sage-200 mb-5 leading-relaxed"><TranslatedText>Consistency is the foundation of clinical efficacy. Your adherence patterns directly correlate with long-term vascular health outcomes.</TranslatedText></p>
            <ul className="space-y-2">
              {['Consistent timing improves blood concentration levels.', 'Avoid skipping doses before physical activity.'].map((tip, i) => (
                <li key={i} className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0 text-sage-300" />
                  <span className="text-xs font-medium text-white/90"><TranslatedText>{tip}</TranslatedText></span>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}

      {/* ── DETAIL MODAL ── */}
      {selectedPrescription && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-5 sm:p-6 bg-forest-900/65 backdrop-blur-xl"
          onClick={() => setSelectedPrescription(null)}>
          <div className="w-full max-w-xl max-h-[88vh] overflow-hidden flex flex-col rounded-2xl sm:rounded-3xl bg-white shadow-forest-xl"
            onClick={(e) => e.stopPropagation()}>
            {/* Modal header */}
            <div className="flex items-center justify-between px-5 py-4 sm:px-6 sm:py-5 border-b border-sage-100">
              <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-sage-100 shrink-0">
                  <Pill className="w-5 h-5 text-forest-500" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-base sm:text-lg font-display font-bold text-forest-900 truncate"><TranslatedText>{selectedPrescription.diagnosis}</TranslatedText></h2>
                  <p className="text-xs font-bold tracking-wider text-forest-400"><TranslatedText>Prescribed by</TranslatedText> <span className="devanagari-small">{doctorNames[selectedPrescription.doctors?.users?.name] || selectedPrescription.doctors?.users?.name}</span></p>
                </div>
              </div>
              <button onClick={() => setSelectedPrescription(null)} className="p-2 rounded-xl bg-sage-100 hover:bg-sage-200 transition-colors">
                <ChevronDown className="w-5 h-5 text-forest-600" />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 p-1.5 mx-3 sm:mx-5 mt-3 rounded-2xl bg-sage-100">
              {(['schedule', 'progress'] as const).map((tab) => {
                const isActive = (activeTab[selectedPrescription.prescription_id] || 'schedule') === tab;
                return (
                  <button key={tab}
                    onClick={() => { setActiveTab((p) => ({ ...p, [selectedPrescription.prescription_id]: tab })); }}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all duration-200 ${isActive ? 'bg-forest-900 text-white shadow-forest-md' : 'bg-transparent text-forest-500 hover:bg-sage-200'}`}>
                    {tab === 'schedule' ? <CheckCircle2 className="w-4 h-4" /> : <TrendingUp className="w-4 h-4" />}
                    {tab === 'schedule' ? <TranslatedText>Today's Schedule</TranslatedText> : <TranslatedText>Progress & Stats</TranslatedText>}
                  </button>
                );
              })}
            </div>

            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto px-5 py-4 pb-8 sm:px-7 sm:py-5 sm:pb-10 bg-sage-50">
              {(activeTab[selectedPrescription.prescription_id] || 'schedule') === 'schedule' ? (
                <div className="space-y-3">
                  <div className="rounded-2xl p-4 sm:p-5 bg-white shadow-forest-sm border border-sage-100">
                    <h3 className="text-sm sm:text-base font-display font-bold text-forest-900 mb-3">
                      <Calendar className="w-4 h-4 inline mr-2 text-forest-500" /><TranslatedText>Checklist for</TranslatedText> {formatDate(new Date())}
                    </h3>
                    <div className="space-y-2">
                      {(() => {
                        const todayStr = getLocalDateString();
                        const currentTime = getLocalTimeString();
                        const allToday: AdherenceRecord[] = [];
                        (selectedPrescription.medicines || []).forEach((med: any) => {
                          const key = `${selectedPrescription.prescription_id}_${med.name}`;
                          allToday.push(...(adherenceMap.get(key) || []).filter((r) => r.scheduled_date && r.scheduled_date.split('T')[0] === todayStr));
                        });
                        allToday.sort((a, b) => a.scheduled_time.localeCompare(b.scheduled_time));

                        // Only show medicines whose time has arrived, plus already taken/skipped
                        const visible = allToday.filter((r) => r.scheduled_time <= currentTime || r.status !== 'pending');
                        const nextUp = allToday.filter((r) => r.scheduled_time > currentTime && r.status === 'pending');

                        if (allToday.length === 0) return (
                          <div className="text-center py-12 rounded-2xl bg-sage-50">
                            <CheckCircle2 className="w-10 h-10 mx-auto mb-2 text-forest-500" />
                            <p className="font-semibold text-forest-400"><TranslatedText>No medicines scheduled for today</TranslatedText></p>
                            <p className="text-xs text-forest-400"><TranslatedText>You are all caught up!</TranslatedText></p>
                          </div>
                        );

                        return (
                          <>
                            {visible.length === 0 && nextUp.length > 0 && (
                              <div className="text-center py-10 rounded-2xl bg-sage-50">
                                <Clock className="w-8 h-8 mx-auto mb-2 text-forest-400" />
                                <p className="font-semibold text-forest-500 text-sm"><TranslatedText>No medicines due yet</TranslatedText></p>
                                <p className="text-xs text-forest-400 mt-1">
                                  <TranslatedText>Next dose</TranslatedText>: <span className="font-bold text-forest-600">{formatScheduledTime(nextUp[0].scheduled_time)}</span>
                                </p>
                              </div>
                            )}
                            {visible.map((r) => (
                              <div key={r.adherence_id} className="rounded-xl overflow-hidden border border-sage-100">
                                <AdherenceCheckbox
                                  adherenceId={r.adherence_id}
                                  medicineName={r.medicine_name}
                                  scheduledTime={r.scheduled_time}
                                  scheduledDate={r.scheduled_date}
                                  isTaken={r.status === 'taken'}
                                  disabled={r.status !== 'pending'}
                                  isNextMed={r.status === 'pending'}
                                  onUpdate={() => {
                                    queryClient.invalidateQueries({ queryKey: ['patient', 'adherence', pid] });
                                  }}
                                  size="large"
                                />
                              </div>
                            ))}
                            {nextUp.length > 0 && visible.length > 0 && (
                              <p className="text-xs text-center text-forest-400 pt-1">
                                <TranslatedText>Next</TranslatedText>: <MedicineName name={nextUp[0].medicine_name} currentLocale={currentLocale} /> <TranslatedText>at</TranslatedText> {formatScheduledTime(nextUp[0].scheduled_time)}
                              </p>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  </div>
                  {selectedPrescription.instructions && (
                    <div className="p-4 sm:p-5 rounded-2xl bg-sage-100 border border-sage-200 mb-6">
                      <p className="text-xs font-bold tracking-wider text-forest-500 mb-3"><TranslatedText>DOCTOR'S INSTRUCTIONS</TranslatedText></p>
                      <div className="prose prose-sm prose-forest max-w-none">
                        <ReactMarkdown>{DOMPurify.sanitize(selectedPrescription.instructions)}</ReactMarkdown>
                      </div>
                    </div>
                  )}
                  { (selectedPrescription.dietAdvice || selectedPrescription.diet_advice) && (
                    <div className="p-4 sm:p-5 rounded-2xl bg-orange-50 border border-orange-100 mb-6 mt-4">
                      <p className="text-xs font-bold tracking-wider text-orange-600 mb-3"><TranslatedText>DIETARY ADVICE</TranslatedText></p>
                      <div className="prose prose-sm prose-orange max-w-none">
                        <ReactMarkdown>{DOMPurify.sanitize(selectedPrescription.dietAdvice || selectedPrescription.diet_advice || '')}</ReactMarkdown>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  {stats[selectedPrescription.prescription_id] ? (
                    <div className="grid gap-3">
                      {/* Prominent Cards Area */}
                      <div className="flex flex-col gap-4">
                        {/* Today's Dose Record */}
                        <div className="p-4 sm:p-5 rounded-2xl bg-white border border-sage-100 shadow-sage-sm">
                          <div className="flex justify-between items-center mb-4">
                            <span className="text-[10px] font-bold tracking-widest text-forest-400 uppercase">
                              <TranslatedText>Today's Dose Record</TranslatedText>
                            </span>
                            <span className="text-sm font-bold text-forest-900">{stats[selectedPrescription.prescription_id]?.dailyPercentage}%</span>
                          </div>
                          <div className="w-full bg-sage-50 rounded-full h-2 mb-4">
                            <div className="bg-blue-500 h-2 rounded-full transition-all duration-1000" style={{ width: `${stats[selectedPrescription.prescription_id]?.dailyPercentage || 0}%` }}></div>
                          </div>
                          <div className="grid grid-cols-4 gap-2 text-center">
                            <div className="p-2 bg-sage-50 rounded-lg">
                              <div className="text-sm font-bold text-forest-900">{stats[selectedPrescription.prescription_id]?.todayScheduled || 0}</div>
                              <div className="text-[8px] font-bold tracking-widest text-forest-400 uppercase"><TranslatedText>Total</TranslatedText></div>
                            </div>
                            <div className="p-2 bg-emerald-50 rounded-lg">
                              <div className="text-sm font-bold text-emerald-600">{stats[selectedPrescription.prescription_id]?.todayTaken || 0}</div>
                              <div className="text-[8px] font-bold tracking-widest text-emerald-600 uppercase"><TranslatedText>Taken</TranslatedText></div>
                            </div>
                            <div className="p-2 bg-yellow-50 rounded-lg">
                              <div className="text-sm font-bold text-yellow-600">{stats[selectedPrescription.prescription_id]?.todaySkipped || 0}</div>
                              <div className="text-[8px] font-bold tracking-widest text-yellow-600 uppercase"><TranslatedText>Skipped</TranslatedText></div>
                            </div>
                            <div className="p-2 bg-red-50 rounded-lg">
                              <div className="text-sm font-bold text-red-600">{stats[selectedPrescription.prescription_id]?.todayNotTaken || 0}</div>
                              <div className="text-[8px] font-bold tracking-widest text-red-600 uppercase"><TranslatedText>Not Taken</TranslatedText></div>
                            </div>
                          </div>
                        </div>
                        
                        {/* Overall Dose Record */}
                        <div className="p-4 sm:p-5 rounded-2xl bg-white border border-sage-100 shadow-sage-sm">
                          <div className="flex justify-between items-center mb-4">
                            <span className="text-[10px] font-bold tracking-widest text-forest-400 uppercase">
                              <TranslatedText>Overall Dose Record</TranslatedText>
                            </span>
                            <span className="text-sm font-bold text-forest-900">{stats[selectedPrescription.prescription_id]?.overallPercentage}%</span>
                          </div>
                          <div className="w-full bg-sage-50 rounded-full h-2 mb-4">
                            <div className="bg-emerald-500 h-2 rounded-full transition-all duration-1000" style={{ width: `${stats[selectedPrescription.prescription_id]?.overallPercentage || 0}%` }}></div>
                          </div>
                          <div className="grid grid-cols-4 gap-2 text-center">
                            <div className="p-2 bg-sage-50 rounded-lg">
                              <div className="text-sm font-bold text-forest-900">{stats[selectedPrescription.prescription_id]?.totalDoses || 0}</div>
                              <div className="text-[8px] font-bold tracking-widest text-forest-400 uppercase"><TranslatedText>Total</TranslatedText></div>
                            </div>
                            <div className="p-2 bg-emerald-50 rounded-lg">
                              <div className="text-sm font-bold text-emerald-600">{stats[selectedPrescription.prescription_id]?.totalTaken || 0}</div>
                              <div className="text-[8px] font-bold tracking-widest text-emerald-600 uppercase"><TranslatedText>Taken</TranslatedText></div>
                            </div>
                            <div className="p-2 bg-yellow-50 rounded-lg">
                              <div className="text-sm font-bold text-yellow-600">{stats[selectedPrescription.prescription_id]?.totalSkipped || 0}</div>
                              <div className="text-[8px] font-bold tracking-widest text-yellow-600 uppercase"><TranslatedText>Skipped</TranslatedText></div>
                            </div>
                            <div className="p-2 bg-red-50 rounded-lg">
                              <div className="text-sm font-bold text-red-600">{stats[selectedPrescription.prescription_id]?.totalNotTaken || 0}</div>
                              <div className="text-[8px] font-bold tracking-widest text-red-600 uppercase"><TranslatedText>Not Taken</TranslatedText></div>
                            </div>
                          </div>
                        </div>
                      </div>
                      {/* Medicine breakdown */}
                      <div className="bg-white rounded-[32px] p-6 sm:p-8 shadow-[0_16px_40px_rgba(10,40,25,0.06)] border border-sage-100">
                        <div className="flex items-center gap-2 mb-6">
                          <Activity className="w-5 h-5 text-emerald-500" />
                          <h3 className="text-lg font-display font-black text-forest-900 tracking-wide"><TranslatedText>Medicine Breakdown</TranslatedText></h3>
                        </div>
                        <div className="space-y-7">
                          {stats[selectedPrescription.prescription_id]?.breakdown?.map((med: any, i: number) => (
                            <div key={i} className="group">
                              <div className="flex justify-between items-end mb-3">
                                <div>
                                  <span className="text-sm font-bold text-forest-900 group-hover:text-emerald-700 transition-colors"><MedicineName name={med.medicineName} currentLocale={currentLocale} /></span>
                                  <span className="text-xs font-semibold block text-forest-500 mt-1">{med.taken}/{med.total} <TranslatedText>doses taken</TranslatedText></span>
                                </div>
                                <span className="font-black text-xl font-display text-emerald-600">{Math.round(Number(med.percentage) || 0)}%</span>
                              </div>
                              <div className="w-full h-3 rounded-full bg-sage-100 overflow-hidden shadow-inner">
                                <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-forest-600 transition-all duration-700 ease-out relative" style={{ width: `${Math.round(Number(med.percentage) || 0)}%` }}>
                                  <div className="absolute top-0 right-0 bottom-0 w-8 bg-gradient-to-r from-transparent to-white/30" />
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                      
                      {/* Upcoming Doses */}
                      {stats[selectedPrescription.prescription_id]?.upcomingActivity?.length > 0 && (
                        <div className="bg-white rounded-[32px] p-6 sm:p-8 shadow-[0_16px_40px_rgba(10,40,25,0.06)] border border-sage-100 mt-6">
                          <div className="flex items-center gap-2 mb-6">
                            <Calendar className="w-5 h-5 text-blue-500" />
                            <h3 className="text-lg font-display font-black text-forest-900 tracking-wide"><TranslatedText>Upcoming Doses</TranslatedText></h3>
                          </div>
                          <div className="space-y-3">
                            {stats[selectedPrescription.prescription_id].upcomingActivity.map((activity: any, idx: number) => (
                              <div key={idx} className="flex items-center justify-between p-4 bg-white border border-sage-100 shadow-sm rounded-xl hover:border-sage-300 transition-colors">
                                <div className="flex items-center space-x-3">
                                  <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                                    <Clock className="w-4 h-4 text-blue-600" />
                                  </div>
                                  <div>
                                    <span className="font-bold text-sm text-forest-900 block"><MedicineName name={activity.medicine_name} currentLocale={currentLocale} /></span>
                                    <span className="text-[10px] uppercase tracking-wider font-bold text-forest-400">
                                      <TranslatedText>Scheduled</TranslatedText>
                                    </span>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <span className="text-xs font-semibold text-forest-500 block">
                                    {formatScheduledTime(activity.scheduled_time)}
                                  </span>
                                  <span className="text-[10px] text-forest-400">
                                    {formatDate(activity.scheduled_date)}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Recent Activity */}
                      {stats[selectedPrescription.prescription_id]?.recentActivity?.length > 0 && (
                        <div className="bg-white rounded-[32px] p-6 sm:p-8 shadow-[0_16px_40px_rgba(10,40,25,0.06)] border border-sage-100 mt-6">
                          <div className="flex items-center gap-2 mb-6">
                            <Clock className="w-5 h-5 text-orange-500" />
                            <h3 className="text-lg font-display font-black text-forest-900 tracking-wide"><TranslatedText>Recent Activity</TranslatedText></h3>
                          </div>
                          <div className="space-y-3">
                            {stats[selectedPrescription.prescription_id].recentActivity.map((activity: any, idx: number) => (
                              <div key={idx} className="flex items-center justify-between p-4 bg-white border border-sage-100 shadow-sm rounded-xl hover:border-sage-300 transition-colors">
                                <div className="flex items-center space-x-3">
                                  {activity.status === 'taken' ? (
                                    <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                                    </div>
                                  ) : (
                                    <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                                      <XCircle className="w-4 h-4 text-red-600" />
                                    </div>
                                  )}
                                  <div>
                                    <span className="font-bold text-sm text-forest-900 block"><MedicineName name={activity.medicine_name} currentLocale={currentLocale} /></span>
                                    <span className="text-[10px] uppercase tracking-wider font-bold text-forest-400">
                                      {activity.status === 'taken' ? <TranslatedText>Taken</TranslatedText> : <TranslatedText>Skipped</TranslatedText>}
                                    </span>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <span className="text-xs font-semibold text-forest-500 block">
                                    {new Date(activity.taken_at || activity.skipped_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                  </span>
                                  <span className="text-[10px] text-forest-400">
                                    {formatDate(new Date(activity.taken_at || activity.skipped_at).toISOString().split('T')[0])}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-16">
                      <div className="spinner mx-auto mb-4" />
                      <p className="body-md text-forest-400"><TranslatedText>Calculating progress...</TranslatedText></p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
