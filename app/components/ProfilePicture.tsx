'use client';

import { useEffect, useState } from 'react';
import { useAuthToken } from '@/lib/auth-token-context';
import { fetchWithAuth } from '@/lib/fetchWithAuth';

export default function PatientProfilePicture({ 
  uid, 
  fallbackSrc, 
  initials 
}: { 
  uid?: string;
  fallbackSrc?: string;
  initials?: string;
}) {
  const token = useAuthToken();
  const [profileImage, setProfileImage] = useState<string>('');
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    async function fetchProfileImage() {
      try {
        const response = await fetchWithAuth('/api/sync-user', token);
        const { user } = await response.json();
        const imageUrl = user?.profile_image_url || user?.profileImageUrl || user?.picture || fallbackSrc;
        if (imageUrl) {
          setProfileImage(imageUrl);
          setImgError(false);
        }
      } catch (error) {
        console.error('Error fetching profile image:', error);
      }
    }

    fetchProfileImage();
  }, [uid, fallbackSrc, token]);

  const imageToShow = profileImage || fallbackSrc;

  if (imageToShow && !imgError) {
    return (
      <img
        src={imageToShow}
        alt="User Profile"
        className="w-full h-full object-cover"
        onError={() => setImgError(true)}
      />
    );
  }

  return (
    <span className="text-emerald-700 font-semibold text-lg select-none">
      {initials || 'U'}
    </span>
  );
}
