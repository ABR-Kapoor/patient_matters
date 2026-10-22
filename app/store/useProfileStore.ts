import { create } from 'zustand';

interface ProfileState {
  name: string;
  imageUrl: string;
  email: string;
  isLoaded: boolean;
  completionPct: number;
  missingFields: string[];
  isDismissed: boolean;
  setProfile: (profile: Partial<ProfileState>) => void;
  dismissBanner: () => void;
}

export const useProfileStore = create<ProfileState>((set) => ({
  name: '',
  imageUrl: '',
  email: '',
  isLoaded: false,
  completionPct: 100, // Default to 100 so it doesn't flash on load
  missingFields: [],
  isDismissed: false,
  setProfile: (profile) => set((state) => ({ 
    ...state, 
    ...profile,
    isLoaded: true
  })),
  dismissBanner: () => {
    localStorage.setItem('profileBootstrapDismissed', Date.now().toString());
    set({ isDismissed: true });
  }
}));
