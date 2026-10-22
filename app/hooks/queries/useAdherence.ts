import { useQuery } from '@tanstack/react-query';
import { apiGetAdherence } from '@aurasutra/patient-shared';

export interface AdherenceRecord {
  adherence_id: string;
  prescription_id: string;
  medicine_name: string;
  scheduled_date: string;
  scheduled_time: string;
  status: 'pending' | 'taken' | 'skipped';
  is_taken?: boolean;
  is_skipped?: boolean;
  doctor_name?: string;
  dosage?: string;
  frequency?: string;
  notes?: string;
}

export interface AdherenceSchedule {
  all: AdherenceRecord[];
  pending: AdherenceRecord[];
  dueNow: AdherenceRecord[];
  upcoming: AdherenceRecord[];
  overdue: AdherenceRecord[];
  taken: AdherenceRecord[];
  skipped: AdherenceRecord[];
  stats?: {
    total: number;
    taken: number;
    skipped: number;
    pending: number;
    adherenceRate: number;
  };
}

const EMPTY_SCHEDULE: AdherenceSchedule = {
  all: [], pending: [], dueNow: [], upcoming: [], overdue: [], taken: [], skipped: [],
};

export function useAdherence(pid: string | null, token: string | null) {
  return useQuery({
    queryKey: ['patient', 'adherence', pid],
    queryFn: async () => {
      const data = await apiGetAdherence('', token, pid);
      if (!data.success) throw new Error(data.error || 'Adherence fetch failed');
      return {
        ...EMPTY_SCHEDULE,
        ...(data.adherence || {}),
        all:      data.adherence?.all      || [],
        pending:  data.adherence?.pending  || [],
        dueNow:   data.adherence?.dueNow   || [],
        upcoming: data.adherence?.upcoming || [],
        overdue:  data.adherence?.overdue  || [],
        taken:    data.adherence?.taken    || [],
        skipped:  data.adherence?.skipped  || [],
      } as AdherenceSchedule;
    },
    staleTime: Infinity,
    enabled: !!pid && !!token,
  });
}
