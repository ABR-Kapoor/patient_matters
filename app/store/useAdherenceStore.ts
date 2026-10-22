import { create } from 'zustand';

// Slimmed-down adherence store — fetch logic moved to TanStack Query (useAdherence hook).
// This store is kept only for any legacy event-based compatibility.
// The updateStatus logic is now handled by useMarkAdherence mutation hook.

interface AdherenceStore {
  invalidate: () => void;
}

export const useAdherenceStore = create<AdherenceStore>(() => ({
  invalidate: () => {}, // No-op — invalidation now handled by TanStack Query
}));
