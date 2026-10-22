import { create } from 'zustand';

// Slimmed-down prescription store — fetch logic moved to TanStack Query.
// usePrescriptions query hook handles all fetching and caching.

interface PrescriptionStore {
  invalidate: () => void;
}

export const usePrescriptionStore = create<PrescriptionStore>(() => ({
  invalidate: () => {}, // No-op — invalidation now handled by TanStack Query
}));
