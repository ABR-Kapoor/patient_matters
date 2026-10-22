'use client';

import { useEffect, useState, useRef } from 'react';
import { Pill, CheckCircle2, X, Clock, FileText, BellRing, Volume2 } from 'lucide-react';
import toast from 'react-hot-toast';
import Link from 'next/link';
import { TranslatedText } from '@/app/components/TranslatedText';
import { MedicineName } from '@/app/components/MedicineName';
import { useLanguage } from '@/app/contexts/LanguageContext';
import { useAuthToken } from '@/lib/auth-token-context';
import { usePatientStore } from '@/app/store/usePatientStore';
import { useAdherence } from '@/app/hooks/queries/useAdherence';
import { useMarkAdherence } from '@/app/hooks/mutations/useMarkAdherence';
import { usePatientIdentity } from '@/app/hooks/queries/usePatientData';

interface AdherenceRecord {
  adherence_id: string;
  medicine_name: string;
  scheduled_date: string;
  scheduled_time: string;
  status: 'pending' | 'taken' | 'skipped';
  prescription_id: string;
  doctor_name?: string;
  dosage?: string;
  frequency?: string;
  notes?: string;
}


export default function DailyMedicinePopup() {
  const token = useAuthToken();
  const { translate, currentLocale } = useLanguage();
  const patientStore = usePatientStore();

  // ── TanStack Query ──
  const { data: identity } = usePatientIdentity(token);
  const pid = identity?.pid || patientStore.pid || null;
  const uid = identity?.uid || patientStore.uid || null;

  const { data: adherenceData } = useAdherence(pid, token);
  const markAdherence = useMarkAdherence();

  // Due-now medicines from query data
  const todayMedicines = adherenceData?.dueNow || [];
  const [showPopup, setShowPopup] = useState(false);
  const [updating, setUpdating] = useState<string | null>(null);
  const [dismissedToday, setDismissedToday] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const formatScheduledTime = (time: string) => {
    if (!time) return '';
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  // Unlock audio on first interaction
  useEffect(() => {
    const unlockAudio = () => {
      if (!audioRef.current) {
        audioRef.current = new Audio('/sounds/ringtone.mp3');
      }
      audioRef.current.play().then(() => {
        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current.currentTime = 0;
        }
      }).catch(() => {});
      window.removeEventListener('click', unlockAudio);
      window.removeEventListener('touchstart', unlockAudio);
    };
    window.addEventListener('click', unlockAudio);
    window.addEventListener('touchstart', unlockAudio);
    return () => {
      window.removeEventListener('click', unlockAudio);
      window.removeEventListener('touchstart', unlockAudio);
    };
  }, []);

  useEffect(() => {
    const pendingCount = todayMedicines.filter((m: any) => m.status === 'pending').length;
    if (showPopup && pendingCount > 0 && !dismissedToday) {
      if (!audioRef.current) {
        audioRef.current = new Audio('/sounds/ringtone.mp3');
      }
      
      const playCycle = async () => {
        if (!audioRef.current || !showPopup || dismissedToday) return;
        
        try {
          audioRef.current.currentTime = 0;
          await audioRef.current.play();
          setIsPlayingAudio(true);
          
          timeoutRef.current = setTimeout(() => {
            if (audioRef.current) {
              audioRef.current.pause();
              setIsPlayingAudio(false);
            }
            
            // 5 second break before next 15 second buzz
            timeoutRef.current = setTimeout(() => {
              playCycle();
            }, 5000);
          }, 15000);
        } catch (e) {
          console.error("Audio playback failed (browser may require interaction first)", e);
          setIsPlayingAudio(false);
        }
      };
      
      playCycle();
    }

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
      setIsPlayingAudio(false);
    };
  }, [showPopup, dismissedToday, todayMedicines]);

  useEffect(() => {
    const pending = todayMedicines.filter((m: any) => m.status === 'pending');
    if (pending.length > 0 && !dismissedToday) {
       setShowPopup(true);
    }
  }, [todayMedicines, dismissedToday]);

  const toggleMedicine = async (id: string, isTaken: boolean) => {
    if (!pid || !uid || !token) return;
    setUpdating(id);
    const newStatus = isTaken ? 'taken' as const : 'skipped' as const;
    try {
      await markAdherence.mutateAsync({ adherenceId: id, status: newStatus, pid, uid, token });
      toast.success(isTaken ? await translate('Marked as taken') : await translate('Marked as skipped'), {
          icon: isTaken ? '✅' : '⏭️',
          style: { borderRadius: '20px', background: '#333', color: '#fff' }
      });
      window.dispatchEvent(new Event('adherenceUpdated'));
    } catch (error) {
      toast.error(await translate('An error occurred'));
    } finally {
      setUpdating(null);
    }
  };

  if (!showPopup || todayMedicines.length === 0) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-forest-900/40 backdrop-blur-sm animate-in fade-in duration-300 p-4 sm:p-6">
      <div className="bg-sage-50/50 rounded-[2.5rem] shadow-2xl border border-white/60 w-full max-w-[min(100%,28rem)] max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-300 backdrop-blur-xl">
        
        {/* Header */}
        <div className="pt-8 pb-5 px-6 sm:px-8 flex flex-col items-center text-center bg-white shrink-0 rounded-b-3xl shadow-sm z-10 relative">
          <div className="w-16 h-16 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center mb-4 relative">
             <div className="absolute inset-0 bg-emerald-400/20 rounded-full animate-ping" />
             <Pill className="w-8 h-8 relative z-10 transform -rotate-12" />
          </div>
          <div className="inline-flex items-center space-x-1.5 bg-rose-50 text-rose-600 px-3 py-1 rounded-full text-[10px] sm:text-xs font-bold tracking-widest uppercase mb-3 border border-rose-100">
            {isPlayingAudio ? <Volume2 className="w-3.5 h-3.5 animate-pulse shrink-0" /> : <BellRing className="w-3.5 h-3.5 shrink-0" />}
            <span><TranslatedText>Action Required</TranslatedText></span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-display text-forest-900 mb-2"><TranslatedText>Medicine Time!</TranslatedText></h2>
          <p className="text-forest-500 font-medium text-sm sm:text-base">
            <TranslatedText>You have</TranslatedText> <span className="font-black text-emerald-600 text-lg px-1">{todayMedicines.filter((m: any) => m.status === 'pending').length}</span> <TranslatedText>pending medicines</TranslatedText>
          </p>
        </div>

        {/* Medicine List */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4 flex-1 scrollbar-hide relative">
          {/* Subtle decorative background blur */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-emerald-400/10 rounded-full blur-[60px] pointer-events-none" />
          
          <div className="relative z-10 space-y-4">
            {todayMedicines.map((med: any) => (
              <div key={med.adherence_id} className={`group bg-white rounded-3xl p-5 sm:p-6 transition-all duration-300 flex flex-col gap-4 ${med.status === 'taken' ? 'opacity-70 scale-[0.98] border border-sage-200/60' : 'shadow-lg shadow-emerald-900/5 border border-sage-100 hover:border-emerald-200 hover:shadow-xl hover:shadow-emerald-900/10'}`}>
                  
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1.5">
                          <Clock className={`w-3.5 h-3.5 ${med.status === 'taken' ? 'text-forest-300' : 'text-emerald-500'}`} />
                          <span className={`text-xs font-bold tracking-wide ${med.status === 'taken' ? 'text-forest-400' : 'text-emerald-600'}`}>
                            {formatScheduledTime(med.scheduled_time)}
                          </span>
                        </div>
                        <h3 className={`font-display font-bold text-xl sm:text-2xl truncate mb-2 ${med.status === 'taken' ? 'text-forest-400 line-through decoration-forest-300/50' : 'text-forest-900'}`}>
                          <MedicineName name={med.medicine_name} currentLocale={currentLocale} />
                        </h3>
                        <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-forest-500">
                          <span className="bg-sage-50 text-forest-700 px-2.5 py-1 rounded-md border border-sage-200/60">{med.dosage ? med.dosage : <TranslatedText>1 Pill</TranslatedText>}</span>
                          <span className="w-1 h-1 rounded-full bg-sage-300 shrink-0"></span>
                          <span>{med.frequency ? med.frequency : <TranslatedText>Daily</TranslatedText>}</span>
                        </div>
                    </div>
                    {/* Status Icon Indicator */}
                    {med.status === 'taken' && (
                      <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-500 flex items-center justify-center shrink-0">
                        <CheckCircle2 className="w-6 h-6" />
                      </div>
                    )}
                  </div>

                  {med.notes && (
                    <div className="bg-amber-50/50 rounded-2xl p-3.5 border border-amber-100/50 flex items-start gap-2.5">
                      <FileText className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-[9px] font-black text-amber-600/80 uppercase tracking-widest mb-0.5"><TranslatedText>Doctor's Note</TranslatedText></p>
                        <p className="text-xs text-amber-900 font-medium leading-relaxed">"{med.notes}"</p>
                      </div>
                    </div>
                  )}

                  <button
                    onClick={() => toggleMedicine(med.adherence_id, true)}
                    disabled={updating === med.adherence_id || med.status === 'taken'}
                    className={`w-full py-3.5 sm:py-4 rounded-2xl transition-all duration-300 flex justify-center items-center h-12 sm:h-14 mt-1 ${
                        med.status === 'taken' 
                          ? 'hidden' 
                          : 'bg-forest-900 text-white hover:bg-forest-800 shadow-md hover:shadow-lg hover:-translate-y-0.5 active:scale-95'
                    }`}
                  >
                    {updating === med.adherence_id ? (
                        <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                        <span className="text-sm font-bold tracking-wide"><TranslatedText>Mark as Taken</TranslatedText></span>
                    )}
                  </button>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-5 bg-white shrink-0 text-center border-t border-sage-100 z-10 rounded-t-3xl">
            <p className="text-xs font-medium text-forest-400 italic mb-4"><TranslatedText>Stay healthy, stay consistent!</TranslatedText></p>
            <button 
              onClick={() => {
                  setDismissedToday(true);
                  setShowPopup(false);
              }} 
              className="w-full text-sm font-bold tracking-wide text-forest-500 hover:text-forest-800 uppercase py-3.5 bg-sage-50 hover:bg-sage-100 rounded-2xl transition-colors active:scale-95 border border-sage-200"
            >
              <TranslatedText>Dismiss for Now</TranslatedText>
            </button>
        </div>
      </div>
    </div>
  );
}
