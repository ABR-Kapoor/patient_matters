interface PatientProfile {
  pid?: string;
  uid?: string;
  date_of_birth?: string;
  dateOfBirth?: string;
  gender?: string;
  blood_group?: string;
  bloodGroup?: string;
  allergies?: string[];
  current_medications?: string[];
  currentMedications?: string[];
  chronic_conditions?: string[];
  chronicConditions?: string[];
  address_line1?: string;
  addressLine1?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  postalCode?: string;
  emergency_contact_name?: string;
  emergencyContactName?: string;
  emergency_contact_relationship?: string;
  emergencyContactRelationship?: string;
  emergency_contact_phone?: string;
  emergencyContactPhone?: string;
  [key: string]: any;
}

interface User {
  uid?: string;
  email?: string;
  name?: string;
  phone?: string;
  [key: string]: any;
}

interface ProfileCompletenessResult {
  isComplete: boolean;
  percentage: number;
  missingFields: string[];
}

type FieldRule = {
  label: string;
  keys: string[];
  isMissing?: (value: any) => boolean;
};

function resolveValue(obj: Record<string, any> | null | undefined, keys: string[]) {
  if (!obj) return undefined;
  for (const key of keys) {
    if (obj[key] !== undefined && obj[key] !== null) {
      return obj[key];
    }
  }
  return undefined;
}

function isEmpty(value: any): boolean {
  if (value === null || value === undefined) return true;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === 'string') return value.trim() === '';
  return false;
}

export function checkPatientProfileComplete(
  patient: PatientProfile | null | undefined,
  user: User | null | undefined
): ProfileCompletenessResult {
  if (!patient || !user) {
    return {
      isComplete: false,
      percentage: 0,
      missingFields: ['All profile information required'],
    };
  }

  const requiredPatientFields: FieldRule[] = [
    { label: 'date of birth', keys: ['dateOfBirth', 'date_of_birth'] },
    { label: 'gender', keys: ['gender'] },
    { label: 'blood group', keys: ['bloodGroup', 'blood_group'] },
    { label: 'allergies', keys: ['allergies'] },
    { label: 'current medications', keys: ['currentMedications', 'current_medications'] },
    { label: 'chronic conditions', keys: ['chronicConditions', 'chronic_conditions'] },
    { label: 'address line1', keys: ['addressLine1', 'address_line1'] },
    { label: 'city', keys: ['city'] },
    { label: 'state', keys: ['state'] },
    { label: 'postal code', keys: ['postalCode', 'postal_code'] },
    { label: 'emergency contact name', keys: ['emergencyContactName', 'emergency_contact_name'] },
    { label: 'emergency relationship', keys: ['emergencyContactRelationship', 'emergency_contact_relationship'] },
    { label: 'emergency phone', keys: ['emergencyContactPhone', 'emergency_contact_phone'] },
  ];

  const requiredUserFields: FieldRule[] = [
    { label: 'name', keys: ['name'] },
    { label: 'phone', keys: ['phone'] },
  ];

  const missingFields: string[] = [];

  requiredPatientFields.forEach((field) => {
    const value = resolveValue(patient as Record<string, any>, field.keys);
    const missing = field.isMissing ? field.isMissing(value) : isEmpty(value);
    if (missing) {
      missingFields.push(field.label);
    }
  });

  requiredUserFields.forEach((field) => {
    const value = resolveValue(user as Record<string, any>, field.keys);
    const missing = field.isMissing ? field.isMissing(value) : isEmpty(value);
    if (missing) {
      missingFields.push(field.label);
    }
  });

  const totalFields = requiredPatientFields.length + requiredUserFields.length;
  const completedFields = totalFields - missingFields.length;
  const percentage = Math.round((completedFields / totalFields) * 100);

  return {
    isComplete: missingFields.length === 0,
    percentage,
    missingFields,
  };
}
