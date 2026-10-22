'use client';

import { useEffect } from 'react';
import ProfileCompletionBanner from '@/app/components/ProfileCompletionBanner';
import { useAuthToken } from '@/lib/auth-token-context';
import { fetchWithAuth } from '@/lib/fetchWithAuth';
import { checkPatientProfileComplete } from '@/lib/shared/profile-utils';
import { useProfileStore } from '@/app/store/useProfileStore';

export default function PatientProfileCheck() {
  const token = useAuthToken();
  const profileStore = useProfileStore();

  useEffect(() => {
    if (token && !profileStore.isLoaded) {
      checkProfile();
    }
  }, [token, profileStore.isLoaded]);

  async function checkProfile() {
    try {
      const dismissedAt = localStorage.getItem('profileBootstrapDismissed');
      if (dismissedAt) {
        const dismissedDate = new Date(parseInt(dismissedAt));
        const now = new Date();
        const diffDays = Math.floor((now.getTime() - dismissedDate.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays < 7) {
          profileStore.setProfile({ isDismissed: true });
        }
      }

      const syncResponse = await fetchWithAuth('/api/sync-user', token);
      const { user } = await syncResponse.json();
      if (!user) return;

      const response = await fetchWithAuth(`/api/patient/profile?uid=${user.uid}`, token);
      const data = await response.json();

      if (data.success) {
        const completeness = checkPatientProfileComplete(data.patient, data.user);
        profileStore.setProfile({
          completionPct: completeness.percentage,
          missingFields: completeness.missingFields,
          name: data.user.name || '',
          imageUrl: data.user.profile_image_url || '',
          email: data.user.email || '',
        });
      }
    } catch (error) {
      console.error('Error checking profile:', error);
    }
  }

  const handleDismiss = () => {
    profileStore.dismissBanner();
  };

  if (profileStore.completionPct === 100 || profileStore.isDismissed) return null;

  return (
    <ProfileCompletionBanner
      percentage={profileStore.completionPct}
      missingFields={profileStore.missingFields}
      onDismiss={handleDismiss}
    />
  );
}

