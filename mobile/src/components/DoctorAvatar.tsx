import React, { useState } from 'react';
import { Image, ImageStyle, StyleProp } from 'react-native';
import { mockDoctorImage } from '../lib/doctorAvatar';

interface DoctorAvatarProps {
  // Real profile image, if the doctor has one. `seed` keys the mock fallback so
  // the same doctor always gets the same bundled stand-in photo.
  uri?: string | null;
  seed: string;
  style?: StyleProp<ImageStyle>;
}

export function DoctorAvatar({ uri, seed, style }: DoctorAvatarProps) {
  const [failed, setFailed] = useState(false);
  const showMock = !uri || failed;

  return (
    <Image
      source={showMock ? mockDoctorImage(seed) : { uri }}
      onError={showMock ? undefined : () => setFailed(true)}
      style={style}
      accessibilityLabel="Doctor profile photo"
    />
  );
}