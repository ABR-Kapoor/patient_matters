import type { ImageSourcePropType } from 'react-native';

// Bundled stand-in photos (Pexels, free-license) for doctors that have no
// profile image yet. Deterministically picked per doctor so the same doctor
// always shows the same avatar. Doctors that already have a real profile
// image keep it – this list is only a fallback.
const MOCK_INDIAN_DOCTORS: ImageSourcePropType[] = [
  require('../../assets/images/doctors/doctor-1.jpg'),
  require('../../assets/images/doctors/doctor-2.jpg'),
  require('../../assets/images/doctors/doctor-3.jpg'),
  require('../../assets/images/doctors/doctor-4.jpg'),
  require('../../assets/images/doctors/doctor-5.jpg'),
  require('../../assets/images/doctors/doctor-6.jpg'),
  require('../../assets/images/doctors/doctor-7.jpg'),
  require('../../assets/images/doctors/doctor-8.jpg'),
];

export function mockDoctorImage(key: string | null | undefined): ImageSourcePropType {
  const seed = (key ?? 'doctor').toLowerCase();
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return MOCK_INDIAN_DOCTORS[hash % MOCK_INDIAN_DOCTORS.length];
}