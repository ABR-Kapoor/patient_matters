import { useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchWithAuth } from '@/lib/fetchWithAuth';

export function useRequestRefund() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ aid, uid, token, reason }: { aid: string; uid: string; token: string; reason: string }) => {
      const response = await fetchWithAuth(`/api/patient/appointments/${aid}/refund`, token, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to request refund');
      }
      return response.json();
    },
    onSuccess: (_, { uid }) => {
      queryClient.invalidateQueries({ queryKey: ['appointments', uid] });
    },
  });
}
