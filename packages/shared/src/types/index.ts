// --- Auth ---------------------------------------------------------------------
export type AuthToken = string | null | (() => Promise<string | null>);

// --- Doctor -------------------------------------------------------------------
export interface Doctor {
  did: string;
  uid: string;
  name: string;
  specialization?: string;
  clinic?: string;
  profileImageUrl?: string;
  verified?: boolean;
  isVerified?: boolean;
  rating?: number;
  fee?: number;
  experience?: number;
  languages?: string[];
  about?: string;
  clinicAddress?: string;
  clinicLat?: number;
  clinicLng?: number;
  consultationModes?: string[];
}

// --- Patient ------------------------------------------------------------------
export interface Patient {
  pid: string;
  uid: string;
  name: string;
  age?: number;
  gender?: string;
  profileImageUrl?: string;
  phone?: string;
  email?: string;
  address?: string;
  bloodGroup?: string;
  allergies?: string[];
}

// --- Appointment --------------------------------------------------------------
export interface Appointment {
  aid: string;
  did: string;
  pid: string;
  date: string;
  time: string;
  status: string;
  mode?: string;
  fee?: number;
  doctorName?: string;
  patientName?: string;
  patientProfileImageUrl?: string;
  doctorProfileImageUrl?: string;
  specialization?: string;
  notes?: string;
  paymentStatus?: string;
  paymentId?: string;
}

// --- Prescription -------------------------------------------------------------
export interface Medicine {
  name: string;
  dosage: string;
  frequency: string;
  duration: string;
  instructions?: string;
  times?: string[];
}

export interface Prescription {
  prescription_id: string;
  did: string;
  pid: string;
  aid?: string;
  diagnosis: string;
  medicines: Medicine[];
  notes?: string;
  created_at: string;
  sent?: boolean;
  patient?: Patient;
  doctor?: Doctor;
}

// --- Adherence ----------------------------------------------------------------
export interface AdherenceRecord {
  id: string;
  prescription_id: string;
  pid: string;
  date: string;
  taken: boolean;
  scheduled_time?: string;
  medicine_name?: string;
}

// --- Finance ------------------------------------------------------------------
export interface EarningsEntry {
  month: string;
  amount: number;
}

export interface DoctorFinance {
  isProfileComplete: boolean;
  isVerified: boolean;
  bankDetailsAdded: boolean;
  payoutMethod: string;
  bankForm: Record<string, unknown>;
  totalEarnings: number;
  pendingEarnings: number;
  earnings: EarningsEntry[];
}
