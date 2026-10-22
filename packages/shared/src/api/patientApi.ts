import { createFetchWithAuth } from './fetchWithAuth';
import type { AuthToken } from '../types';

export async function apiGetAppointments(baseUrl: string = '', token: AuthToken, uid?: string | null) {
  const endpoint = uid ? `/api/patient/appointments?uid=${uid}` : '/api/patient/appointments';
  const res = await createFetchWithAuth(baseUrl, token, endpoint);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || body.error || `Failed to load appointments (${res.status})`);
  }
  return res.json();
}

export async function apiGetPrescriptions(baseUrl: string = '', token: AuthToken, pid?: string | null) {
  const endpoint = pid ? `/api/patient/prescriptions?pid=${pid}` : '/api/patient/prescriptions';
  const res = await createFetchWithAuth(baseUrl, token, endpoint);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || body.error || `Failed to load prescriptions (${res.status})`);
  }
  return res.json();
}

export async function apiGetAdherence(baseUrl: string = '', token: AuthToken, pid?: string | null) {
  const endpoint = pid ? `/api/patient/adherence?pid=${pid}` : '/api/patient/adherence';
  const res = await createFetchWithAuth(baseUrl, token, endpoint);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || body.error || `Failed to load adherence (${res.status})`);
  }
  return res.json();
}

export async function apiGetProfile(baseUrl: string = '', token: AuthToken, uid?: string | null) {
  const query = uid ? `?uid=${uid}&t=${Date.now()}` : '';
  const res = await createFetchWithAuth(baseUrl, token, `/api/patient/profile${query}`, { cache: 'no-store' });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || body.error || `Failed to load profile (${res.status})`);
  }
  return res.json();
}

export async function apiMarkAdherence(
  baseUrl: string = '',
  token: AuthToken,
  body: { prescription_id: string; date: string; taken: boolean }
) {
  const res = await createFetchWithAuth(baseUrl, token, '/api/patient/adherence', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Failed to mark adherence (${res.status})`);
  return res.json();
}

export async function apiCancelAppointment(
  baseUrl: string = '',
  token: AuthToken,
  aid: string,
  reason?: string
) {
  const res = await createFetchWithAuth(baseUrl, token, `/api/patient/appointments/${aid}/cancel`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
  if (!res.ok) throw new Error(`Failed to cancel appointment (${res.status})`);
  return res.json();
}
