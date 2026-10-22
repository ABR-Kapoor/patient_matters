import { create } from 'zustand';

interface PatientState {
  // Identity
  uid: string;
  pid: string;
  name: string;
  imageUrl: string;
  email: string;
  role: string;

  // Status
  isLoaded: boolean;
  isLoading: boolean;
  error: string | null;

  // Actions
  fetchPatient: (token: string) => Promise<void>;
  setPatient: (data: Partial<PatientState>) => void;
  reset: () => void;
}

export const usePatientStore = create<PatientState>((set, get) => ({
  uid: '',
  pid: '',
  name: '',
  imageUrl: '',
  email: '',
  role: '',
  isLoaded: false,
  isLoading: false,
  error: null,

  fetchPatient: async (token: string) => {
    if (get().isLoaded || get().isLoading) return; // Already loaded or in flight
    set({ isLoading: true, error: null });
    try {
      const syncRes = await fetch('/api/sync-user', {
        cache: 'no-store',
      });
      const { user } = await syncRes.json();
      if (!user) {
        set({ isLoaded: true, isLoading: false });
        return;
      }

      const profileRes = await fetch(`/api/patient/profile?uid=${user.uid}`);
      const profileData = await profileRes.json();

      const pid = profileData.success ? (profileData.patient?.pid || '') : '';

      set({
        uid: user.uid || '',
        pid,
        name: user.name || '',
        imageUrl: user.profile_image_url || user.profileImageUrl || '',
        email: user.email || '',
        role: user.role || 'patient',
        isLoaded: true,
        isLoading: false,
      });
    } catch (err: any) {
      set({ error: err.message, isLoading: false, isLoaded: true });
    }
  },

  setPatient: (data) => set((state) => ({ ...state, ...data })),

  reset: () =>
    set({
      uid: '',
      pid: '',
      name: '',
      imageUrl: '',
      email: '',
      role: '',
      isLoaded: false,
      isLoading: false,
      error: null,
    }),
}));
