import { useQuery } from '@tanstack/react-query';
import { apiGetProfile } from '@aurasutra/patient-shared';
import { checkPatientProfileComplete } from '@/lib/shared/profile-utils';

export function useProfile(uid: string | null, token: string | null) {
  return useQuery({
    queryKey: ['patient', 'profile', uid],
    queryFn: async () => {
      const data = await apiGetProfile('', token, uid);
      if (!data.success) throw new Error(data.error || 'Profile fetch failed');

      const completeness = checkPatientProfileComplete(data.patient, data.user);
      return {
        user: data.user,
        patient: data.patient,
        name: data.user?.name || '',
        imageUrl: data.user?.profile_image_url || data.user?.profileImageUrl || '',
        email: data.user?.email || '',
        completionPct: completeness.percentage,
        missingFields: completeness.missingFields,
      };
    },
    staleTime: Infinity, // only updates when mutation fires
    enabled: !!uid && !!token,
  });
}
