import { useQuery } from '@tanstack/react-query';
import { apiGetPrescriptions } from '@aurasutra/patient-shared';

export interface Medicine {
  name: string;
  dosage: string;
  frequency: string;
  duration: string;
  notes?: string;
}

export interface Prescription {
  prescription_id: string;
  aid?: string;
  diagnosis: string;
  symptoms: string[];
  medicines: Medicine[];
  instructions: string;
  dietAdvice: string;
  diet_advice?: string;
  followUpDate: string;
  createdAt: string;
  sentAt: string;
  doctor_name?: string;
  doctor_image?: string;
  doctors?: {
    did: string;
    users?: { name: string; profile_image_url?: string };
  };
}

export function usePrescriptions(pid: string | null, token: string | null) {
  return useQuery({
    queryKey: ['patient', 'prescriptions', pid],
    queryFn: async () => {
      const data = await apiGetPrescriptions('', token, pid);
      if (!data.success) throw new Error(data.error || 'Prescriptions fetch failed');
      // Merge sent + pending into a flat array
      const all: Prescription[] = [
        ...(data.prescriptions?.sent || []),
        ...(data.prescriptions?.pending || []),
      ];
      return { all, sent: data.prescriptions?.sent || [], pending: data.prescriptions?.pending || [] };
    },
    staleTime: 5 * 60_000, // prescriptions rarely change
    enabled: !!pid && !!token,
  });
}
