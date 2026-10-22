'use client';

import { useState } from 'react';
import { CheckCircle2, Clock } from 'lucide-react';
import toast from 'react-hot-toast';
import { TranslatedText } from '@/app/components/TranslatedText';
import { MedicineName } from '@/app/components/MedicineName';
import { useLanguage } from '@/app/contexts/LanguageContext';
import { useAuthToken } from '@/lib/auth-token-context';
import { fetchWithAuth } from '@/lib/fetchWithAuth';

interface AdherenceCheckboxProps {
  adherenceId: string;
  medicineName: string;
  scheduledTime: string;
  scheduledDate: string;
  isTaken: boolean;
  onUpdate: () => void;
  size?: 'small' | 'large';
  showTime?: boolean;
  disabled?: boolean;
  isNextMed?: boolean;
}

export default function AdherenceCheckbox({
  adherenceId,
  medicineName,
  scheduledTime,
  scheduledDate,
  isTaken,
  onUpdate,
  size = 'small',
  showTime = true,
  disabled = false,
  isNextMed = false
}: AdherenceCheckboxProps) {
  const token = useAuthToken();
  const { translate, currentLocale } = useLanguage();
  const [isUpdating, setIsUpdating] = useState(false);

  const handleAction = async (newStatus: 'taken' | 'skipped' | 'pending') => {
    if (isUpdating || disabled) return;

    setIsUpdating(true);
    try {
      const response = await fetchWithAuth(`/api/patient/adherence`, token, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adherenceId, status: newStatus })
      });

      const data = await response.json();

      if (data.success) {
        const msg = await translate(
            newStatus === 'taken' ? 'Marked as taken' : 
            newStatus === 'skipped' ? 'Marked as skipped' : 'Marked as pending'
        );
        toast.success(msg);
        onUpdate();
        window.dispatchEvent(new CustomEvent('adherenceUpdated'));
      } else {
        const msg = await translate('Failed to update');
        toast.error(msg);
      }
    } catch (error) {
      console.error('Error updating adherence:', error);
      const msg = await translate('Failed to update');
      toast.error(msg);
    } finally {
      setIsUpdating(false);
    }
  };

  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
    } catch {
      return dateStr;
    }
  };

  // Check if overdue
  const now = new Date();
  const scheduledDateTime = new Date(`${scheduledDate}T${scheduledTime}`);
  const isOverdue = !isTaken && now > scheduledDateTime;
  const overdueStatus = isOverdue ? 'overdue' : null;

  return (
    <div 
      onClick={() => {
         if (!isNextMed && !disabled) handleAction(isTaken ? 'pending' : 'taken');
      }}
      className={`flex items-center justify-between p-4 rounded-xl transition-all ${
        isTaken
          ? 'bg-green-50 border border-green-200 cursor-default opacity-70'
          : isOverdue
          ? 'bg-red-50 border border-red-200 hover:bg-red-100'
          : 'bg-gray-50 border border-gray-200 hover:bg-gray-100'
      } ${(!isNextMed && !disabled) ? 'cursor-pointer' : ''} ${isUpdating ? 'opacity-50 pointer-events-none' : ''}`}
    >
      <div className="flex-1">
        <p className={`font-bold ${
          size === 'large' ? 'text-base' : 'text-sm'
        } ${
          isTaken ? 'text-gray-500 line-through' : 
          isOverdue ? 'text-red-700' : 'text-gray-900'
        }`}>
          <MedicineName name={medicineName} currentLocale={currentLocale} />
        </p>
        
        {showTime && (
          <div className="flex items-center space-x-1 mt-0.5">
            <Clock className={`w-3 h-3 ${
              overdueStatus ? 'text-red-500' : 'text-gray-400'
            }`} />
            <span className={`text-xs ${
              isTaken ? 'text-gray-500' :
              overdueStatus ? 'text-red-600 font-semibold' : 'text-gray-600'
            }`}>
              {formatDate(scheduledDate)} • {formatTime(scheduledTime)}
              {overdueStatus && <span className="ml-1">• <TranslatedText>OVERDUE</TranslatedText></span>}
            </span>
          </div>
        )}
      </div>
      {isTaken && !isNextMed && (
        <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 animate-bounce" />
      )}

      {isNextMed && !isTaken && (
         <div className="flex items-center gap-2 flex-shrink-0 ml-4">
            <button 
               onClick={(e) => { e.stopPropagation(); handleAction('skipped'); }}
               className="px-3 py-1.5 text-xs font-bold rounded-lg text-forest-600 bg-sage-100 hover:bg-sage-200 transition-colors"
            >
               <TranslatedText>Skip</TranslatedText>
            </button>
            <button 
               onClick={(e) => { e.stopPropagation(); handleAction('taken'); }}
               className="px-3 py-1.5 text-xs font-bold rounded-lg text-white bg-forest-600 hover:bg-forest-700 transition-colors shadow-md hover:shadow-lg"
            >
               <TranslatedText>Take</TranslatedText>
            </button>
         </div>
      )}
    </div>
  );
}
