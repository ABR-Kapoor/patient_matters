import { create } from 'zustand';

// Slimmed-down appointment store — fetch/cancel logic moved to TanStack Query.
// useAppointments query hook handles fetching.
// useCancelAppointment mutation hook handles cancellation with optimistic updates.

interface AppointmentStore {
  invalidate: () => void;
}

export const useAppointmentStore = create<AppointmentStore>(() => ({
  invalidate: () => {}, // No-op — invalidation now handled by TanStack Query
}));
