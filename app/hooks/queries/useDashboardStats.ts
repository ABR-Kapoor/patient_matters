import { useQuery } from '@tanstack/react-query';
import { fetchWithAuth } from '@/lib/fetchWithAuth';

export function useDashboardStats(uid: string | null, token: string | null) {
  return useQuery({
    queryKey: ['patient', 'dashboard', uid],
    queryFn: async () => {
      const res = await fetchWithAuth(`/api/patient/dashboard?uid=${uid}`, token);
      if (!res.ok) throw new Error('Failed to fetch dashboard stats');
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Dashboard fetch failed');
      return data;
    },
    staleTime: Infinity,
    // Only run when both uid and token are available
    enabled: !!(uid && uid.length > 0 && token && token.length > 0),
  });
}
