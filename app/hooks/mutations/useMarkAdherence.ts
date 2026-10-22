import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { AdherenceSchedule, AdherenceRecord } from '@/app/hooks/queries/useAdherence';

interface MarkAdherenceVars {
  adherenceId: string;
  status: 'taken' | 'skipped' | 'pending';
  pid: string;
  uid: string;
  token: string;
}

export function useMarkAdherence() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ adherenceId, status, token }: MarkAdherenceVars) => {
      const res = await fetch('/api/patient/adherence', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ adherenceId, status }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Failed to update adherence');
      return data;
    },

    onMutate: async ({ adherenceId, status, pid }) => {
      // 1. Cancel any in-flight refetches so they don't overwrite our optimistic update
      await queryClient.cancelQueries({ queryKey: ['patient', 'adherence', pid] });

      // 2. Snapshot previous state for rollback
      const prev = queryClient.getQueryData<AdherenceSchedule>(['patient', 'adherence', pid]);

      // 3. Optimistically update the cache — UI flips instantly
      queryClient.setQueryData<AdherenceSchedule>(['patient', 'adherence', pid], (old) => {
        if (!old) return old;
        const updateRecord = (arr: AdherenceRecord[]) =>
          arr.map((r) => r.adherence_id === adherenceId ? { ...r, status } : r);

        return {
          ...old,
          all: updateRecord(old.all),
          pending: status !== 'pending'
            ? old.pending.filter((r) => r.adherence_id !== adherenceId)
            : old.pending,
          dueNow: status !== 'pending'
            ? old.dueNow.filter((r) => r.adherence_id !== adherenceId)
            : old.dueNow,
          overdue: status !== 'pending'
            ? old.overdue.filter((r) => r.adherence_id !== adherenceId)
            : old.overdue,
          upcoming: status !== 'pending'
            ? old.upcoming.filter((r) => r.adherence_id !== adherenceId)
            : old.upcoming,
          taken: status === 'taken'
            ? [...old.taken, old.all.find((r) => r.adherence_id === adherenceId)!].filter(Boolean)
            : old.taken.filter((r) => r.adherence_id !== adherenceId),
          skipped: status === 'skipped'
            ? [...old.skipped, old.all.find((r) => r.adherence_id === adherenceId)!].filter(Boolean)
            : old.skipped.filter((r) => r.adherence_id !== adherenceId),
        };
      });

      return { prev };
    },

    onError: (_err, { pid }, context) => {
      // Rollback to previous state
      if (context?.prev) {
        queryClient.setQueryData(['patient', 'adherence', pid], context.prev);
      }
      toast.error('Could not update. Please try again.');
    },

    onSettled: (_data, _err, { pid, uid }) => {
      // Refetch to ensure DB sync
      queryClient.invalidateQueries({ queryKey: ['patient', 'adherence', pid] });
      queryClient.invalidateQueries({ queryKey: ['patient', 'dashboard', uid] });
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('adherenceUpdated'));
      }
    },
  });
}
