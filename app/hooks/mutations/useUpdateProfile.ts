import { useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchWithAuth } from '@/lib/fetchWithAuth';
import { useProfileStore } from '@/app/store/useProfileStore';
import { checkPatientProfileComplete } from '@/lib/shared/profile-utils';

interface UpdateProfileVars {
  uid: string;
  token: string;
  user: {
    name: string;
    phone?: string | null;
    profileImageUrl?: string;
  };
  patient: Record<string, any>;
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  const setProfile = useProfileStore((s) => s.setProfile);

  return useMutation({
    mutationFn: async ({ uid, token, user, patient }: UpdateProfileVars) => {
      const res = await fetchWithAuth('/api/patient/profile', token, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid, user, patient }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Failed to update profile');
      return data;
    },

    onSuccess: (_data, { uid, token, user }) => {
      // Invalidate profile cache so it re-fetches fresh data
      queryClient.invalidateQueries({ queryKey: ['patient', 'profile', uid] });
      // Also update Zustand mirror for instant sidebar/header update
      setProfile({
        name: user.name,
        imageUrl: user.profileImageUrl || '',
      });
    },
  });
}
