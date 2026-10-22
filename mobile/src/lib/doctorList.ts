/**
 * `/api/doctors/find-all` and `/api/ai-doctor-search` do not agree on one envelope: some
 * deployments answer with a bare array, some with `{ doctors }`, some with `{ data }`. Reading
 * `data.doctors` unconditionally is what made one screen show fewer doctors than another screen
 * reading from the very same endpoint, so every known shape is accepted here.
 *
 * The AI endpoint can also return the same doctor more than once (once per matched
 * specialisation), so duplicates are dropped by id.
 */

export function normalizeDoctorList(payload: any): any[] | null {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== 'object') return null;

  const candidates = [
    payload.doctors,
    payload.data,
    payload.results,
    payload.items,
    payload.data?.doctors,
    payload.data?.results,
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate;
  }

  return null;
}

export function cleanDoctorList(list: any[]): any[] {
  const seen = new Set<string | number>();

  return list.filter((doctor) => {
    // A malformed row would throw during render and blank the whole list.
    if (!doctor || typeof doctor !== 'object') return false;

    const key = doctor.did ?? doctor.id ?? null;
    if (key == null) return true;
    if (seen.has(key)) return false;
    seen.add(key);

    return true;
  });
}

/** The AI endpoint refuses anything shorter, so screens should refuse it before the round trip. */
export const MIN_SYMPTOM_LENGTH = 10;
