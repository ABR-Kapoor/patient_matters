import { useQuery } from '@tanstack/react-query';
import { apiGetAppointments } from '@aurasutra/patient-shared';

export interface Appointment {
  aid: string;
  pid: string;
  did: string;
  scheduledDate: string;
  scheduledTime: string;
  mode: 'online' | 'offline';
  status: 'scheduled' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled';
  chiefComplaint?: string;
  cancellationReason?: string;
  symptoms?: string[];
  consultationFee?: number;
  paidAmount?: number;
  platformFeeApplied?: number;
  refundRequested?: boolean;
  refundId?: string;
  refundAmount?: number;
  refundStatus?: string;
  refundReason?: string;
  refundType?: string;
  doctor?: {
    did: string;
    specialization?: string | string[];
    consultationFee?: number;
    user?: {
      name: string;
      profileImageUrl?: string;
    };
  };
}

export function useAppointments(
  uid: string | null,
  token: string | null,
  hasActiveCall?: boolean
) {
  return useQuery({
    queryKey: ['patient', 'appointments', uid],
    queryFn: async () => {
      const data = await apiGetAppointments('', token, uid);
      if (!data.success) throw new Error(data.error || 'Appointments fetch failed');
      return (data.appointments || []) as Appointment[];
    },
    staleTime: 30_000,
    enabled: !!uid && !!token,
  });
}
