import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Appointment } from '@/app/hooks/queries/useAppointments';

interface CancelAppointmentVars {
  aid: string;
  uid: string;
  token: string;
}

export function useCancelAppointment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ aid, token }: CancelAppointmentVars) => {
      const res = await fetch(`/api/patient/appointments/${aid}/cancel`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Failed to cancel appointment');
      return data;
    },

    onMutate: async ({ aid, uid }) => {
      await queryClient.cancelQueries({ queryKey: ['patient', 'appointments', uid] });
      const prev = queryClient.getQueryData<Appointment[]>(['patient', 'appointments', uid]);

      // Optimistically mark as cancelled
      queryClient.setQueryData<Appointment[]>(['patient', 'appointments', uid], (old) =>
        old?.map((a) => a.aid === aid ? { ...a, status: 'cancelled' as const } : a) ?? []
      );

      return { prev };
    },

    onError: (_err, { uid }, context) => {
      if (context?.prev) {
        queryClient.setQueryData(['patient', 'appointments', uid], context.prev);
      }
    },

    onSettled: (_data, _err, { uid }) => {
      queryClient.invalidateQueries({ queryKey: ['patient', 'appointments', uid] });
      queryClient.invalidateQueries({ queryKey: ['patient', 'dashboard', uid] });
    },
  });
}
