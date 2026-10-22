import { useQuery } from '@tanstack/react-query';
import { fetchWithAuth } from '@/lib/fetchWithAuth';
import { usePatientStore } from '@/app/store/usePatientStore';

/**
 * Self-contained hook: resolves uid+pid itself via /api/sync-user if not in store yet.
 * All other query hooks depend on this one via the 'patient.identity' cache.
 */
export function usePatientIdentity(token: string | null) {
  return useQuery({
    queryKey: ['patient', 'identity'],
    queryFn: async () => {
      // First try the Zustand store (instant if already loaded)
      const storeState = usePatientStore.getState();
      if (storeState.isLoaded && storeState.uid) {
        return { uid: storeState.uid, pid: storeState.pid };
      }

      // Otherwise fetch from API
      const syncRes = await fetchWithAuth('/api/sync-user', token, { cache: 'no-store' });
      if (!syncRes.ok) throw new Error('Failed to sync user');
      const { user } = await syncRes.json();
      if (!user?.uid) throw new Error('No user found');

      const profileRes = await fetchWithAuth(`/api/patient/profile?uid=${user.uid}`, token);
      const profileData = await profileRes.json();
      const pid = profileData.success ? (profileData.patient?.pid || '') : '';

      // Hydrate Zustand store so other components benefit
      usePatientStore.getState().setPatient({
        uid: user.uid,
        pid,
        name: user.name || '',
        imageUrl: user.profile_image_url || user.profileImageUrl || '',
        email: user.email || '',
        isLoaded: true,
        isLoading: false,
      });

      return { uid: user.uid as string, pid: pid as string };
    },
    staleTime: Infinity, // identity never goes stale mid-session
    enabled: !!token,
    retry: 2,
  });
}
