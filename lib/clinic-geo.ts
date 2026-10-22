/**
 * Clinic coordinates are stored inside `doctors.address_line2` as a compact JSON
 * payload, so the patient app can open directions without a schema change.
 *
 *   {"lat":12.934190,"lng":77.610925,"label":"Nexus Mall, Koramangla"}
 *
 * The human-readable address stays in address_line1 / city / state /
 * postal_code. Only a short place label lives here.
 *
 * `address_line2` is varchar(255), so the label is truncated to fit. Latitude
 * and longitude are never truncated.
 */

export const CLINIC_GEO_MAX_LENGTH = 255;

export interface ClinicLocation {
    latitude: number;
    longitude: number;
    label: string;
}

const isFiniteNumber = (v: unknown): v is number =>
    typeof v === 'number' && Number.isFinite(v);

const isValidLatitude = (v: unknown): v is number => isFiniteNumber(v) && v >= -90 && v <= 90;
const isValidLongitude = (v: unknown): v is number => isFiniteNumber(v) && v >= -180 && v <= 180;

/**
 * Serialise a clinic location into the string stored in address_line2.
 * Returns null when the coordinates are missing or out of range, which clears
 * the location rather than persisting garbage.
 */
export function formatClinicGeo(location: Partial<ClinicLocation> | null | undefined): string | null {
    if (!location) return null;

    const { latitude, longitude } = location;
    if (!isValidLatitude(latitude) || !isValidLongitude(longitude)) return null;

    const label = typeof location.label === 'string' ? location.label.trim() : '';

    // Trim the label until the whole payload fits varchar(255). Coordinates are
    // never sacrificed, so a pathologically long label is cut instead.
    let candidate: { lat: number; lng: number; label?: string } = {
        lat: latitude,
        lng: longitude,
        ...(label ? { label } : {}),
    };

    while (JSON.stringify(candidate).length > CLINIC_GEO_MAX_LENGTH) {
        const current = candidate.label ?? '';
        if (!current.length) {
            // Should not happen: the coordinate-only payload is ~40 chars.
            return null;
        }
        candidate = { ...candidate, label: current.slice(0, current.length - 1).trimEnd() };
    }

    return JSON.stringify(candidate);
}

/**
 * Read a clinic location out of an address_line2 value.
 * Returns null for legacy free-text rows, empty values, or malformed payloads,
 * so a doctor who never set a location simply has none.
 */
export function parseClinicGeo(value: unknown): ClinicLocation | null {
    if (typeof value !== 'string') return null;

    const raw = value.trim();
    if (!raw.startsWith('{')) return null;

    let parsed: unknown;
    try {
        parsed = JSON.parse(raw);
    } catch {
        return null;
    }

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;

    const { lat, lng, label } = parsed as Record<string, unknown>;
    if (!isValidLatitude(lat) || !isValidLongitude(lng)) return null;

    return {
        latitude: lat,
        longitude: lng,
        label: typeof label === 'string' ? label : '',
    };
}

/** Human-readable one-line address for the patient UI, ignoring the geo payload. */
export function formatClinicAddress(parts: {
    clinic_name?: unknown;
    address_line1?: unknown;
    city?: unknown;
    state?: unknown;
    postal_code?: unknown;
}): string {
    const text = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');
    return [text(parts.clinic_name), text(parts.address_line1), text(parts.city), text(parts.state), text(parts.postal_code)]
        .filter(Boolean)
        .join(', ');
}
