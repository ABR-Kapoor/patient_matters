'use client';

import { useState, useEffect, KeyboardEvent } from 'react';
import { X, Camera, Loader2, User, Phone, MapPin, Activity, ShieldAlert, Droplets, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuthToken } from '@/lib/auth-token-context';
import { fetchWithAuth } from '@/lib/fetchWithAuth';
import { uploadImage } from '@/lib/upload';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/app/components/CustomSelect';
import { useLanguage } from '@/app/contexts/LanguageContext';
import { useTranslation } from '@/app/hooks/useTranslation';
import { TranslatedText } from '@/app/components/TranslatedText';

interface ProfileEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialData: {
    profileImageUrl?: string;
    name?: string;
    phone?: string;
    date_of_birth?: string;
    gender?: string;
    blood_group?: string;
    allergies?: string[];
    current_medications?: string[];
    chronic_conditions?: string[];
    address_line1?: string;
    address_line2?: string;
    city?: string;
    state?: string;
    postal_code?: string;
    emergency_contact_name?: string;
    emergency_contact_phone?: string;
    dateOfBirth?: string;
    bloodGroup?: string;
    currentMedications?: string[];
    chronicConditions?: string[];
    addressLine1?: string;
    addressLine2?: string;
    postalCode?: string;
    emergencyContactName?: string;
    emergencyContactPhone?: string;
  };
  uid: string;
  onSuccess: () => void;
}

const inputCls = 'w-full px-3 sm:px-3.5 py-2 sm:py-2.5 bg-sage-50 border border-sage-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 outline-none transition text-sm text-forest-900 placeholder-forest-400';
const selectCls = `${inputCls} cursor-pointer`;

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const GENDERS = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'other', label: 'Other' },
  { value: 'prefer_not_to_say', label: 'Prefer not to say' },
];

function SectionHeader({ icon: Icon, label }: { icon: React.ElementType; label: string }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <div className="w-7 h-7 bg-primary-50 rounded-lg flex items-center justify-center">
        <Icon className="w-3.5 h-3.5 text-primary-600" />
      </div>
      <span className="text-xs font-bold text-forest-500 uppercase tracking-wider"><TranslatedText>{label}</TranslatedText></span>
    </div>
  );
}

function FieldLabel({ children, optional }: { children: React.ReactNode; optional?: boolean }) {
  return (
    <label className="block text-xs font-semibold text-forest-600 mb-1.5">
      {children}
      {optional && <span className="ml-1 text-forest-400 font-normal">(optional)</span>}
    </label>
  );
}

function TagInput({
  tags,
  onChange,
  placeholder,
}: {
  tags: string[];
  onChange: (tags: string[]) => void;
  placeholder: string;
}) {
  const [inputVal, setInputVal] = useState('');
  const { text: addMoreText } = useTranslation('Add more...');

  const addTag = (value: string) => {
    const trimmed = value.trim().replace(/,$/, '');
    if (trimmed && !tags.includes(trimmed)) {
      onChange([...tags, trimmed]);
    }
    setInputVal('');
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag(inputVal);
    } else if (e.key === 'Backspace' && !inputVal && tags.length) {
      onChange(tags.slice(0, -1));
    }
  };

  const removeTag = (index: number) => onChange(tags.filter((_, i) => i !== index));

  return (
    <div className="min-h-[44px] w-full px-3 py-2 bg-sage-50 border border-sage-200 rounded-xl focus-within:bg-white focus-within:ring-2 focus-within:ring-primary-500/30 focus-within:border-primary-500 transition flex flex-wrap gap-1.5 cursor-text">
      {tags.map((tag, i) => (
        <span key={i} className="inline-flex items-center gap-1 px-2.5 py-1 bg-primary-100 text-primary-800 text-xs font-semibold rounded-full">
          {tag}
          <button type="button" onClick={() => removeTag(i)} className="hover:text-primary-600 leading-none">&times;</button>
        </span>
      ))}
      <input
        type="text"
        value={inputVal}
        onChange={(e) => setInputVal(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => addTag(inputVal)}
        placeholder={tags.length === 0 ? placeholder : addMoreText}
        className="flex-1 min-w-[120px] bg-transparent outline-none text-sm text-forest-900 placeholder-forest-400"
      />
    </div>
  );
}

export default function ProfileEditModal({
  isOpen,
  onClose,
  initialData,
  uid,
  onSuccess,
}: ProfileEditModalProps) {
  const token = useAuthToken();
  const { translate } = useLanguage();
  const { text: phFullName } = useTranslation('Enter your full name');
  const { text: phPhone } = useTranslation('e.g. 9876543210');
  const { text: phGender } = useTranslation('Select gender');
  const { text: phBloodGroup } = useTranslation('Select blood group');
  const { text: phAllergy } = useTranslation('Type allergy and press Enter (e.g. Penicillin)');
  const { text: phMedication } = useTranslation('Type medication and press Enter (e.g. Metformin)');
  const { text: phCondition } = useTranslation('Type condition and press Enter (e.g. Diabetes)');
  const { text: phStreet } = useTranslation('Street, area, colony');
  const { text: phFlat } = useTranslation('Flat no., building, landmark');
  const { text: phCity } = useTranslation('City');
  const { text: phState } = useTranslation('State');
  const { text: phPostal } = useTranslation('PIN / ZIP code');
  const { text: phEmergencyName } = useTranslation('e.g. Ramesh Kumar');
  const { text: phEmergencyPhone } = useTranslation('Emergency phone number');
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    date_of_birth: '',
    gender: '',
    blood_group: '',
    allergies: [] as string[],
    current_medications: [] as string[],
    chronic_conditions: [] as string[],
    address_line1: '',
    address_line2: '',
    city: '',
    state: '',
    postal_code: '',
    emergency_contact_name: '',
    emergency_contact_phone: '',
  });

  const [profileImage, setProfileImage] = useState('');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setFormData({
        name: initialData.name || '',
        phone: initialData.phone || '',
        date_of_birth: initialData.date_of_birth ? initialData.date_of_birth.split('T')[0] : (initialData.dateOfBirth ? initialData.dateOfBirth.split('T')[0] : ''),
        gender: initialData.gender || '',
        blood_group: initialData.blood_group || (initialData as any).bloodGroup || '',
        allergies: initialData.allergies || [],
        current_medications: initialData.current_medications || (initialData as any).currentMedications || [],
        chronic_conditions: initialData.chronic_conditions || (initialData as any).chronicConditions || [],
        address_line1: initialData.address_line1 || (initialData as any).addressLine1 || '',
        address_line2: initialData.address_line2 || (initialData as any).addressLine2 || '',
        city: initialData.city || '',
        state: initialData.state || '',
        postal_code: initialData.postal_code || (initialData as any).postalCode || '',
        emergency_contact_name: initialData.emergency_contact_name || (initialData as any).emergencyContactName || '',
        emergency_contact_phone: initialData.emergency_contact_phone || (initialData as any).emergencyContactPhone || '',
      });
      setProfileImage(initialData.profileImageUrl || '');
    }
  }, [initialData, isOpen]);

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { const msg = await translate('Please upload an image file'); toast.error(msg); return; }
    if (file.size > 5 * 1024 * 1024) { const msg = await translate('Image size should be less than 5MB'); toast.error(msg); return; }

    setUploading(true);
    try {
      const url = await uploadImage(file);
      if (url) { setProfileImage(url); const msg = await translate('Photo updated!'); toast.success(msg); }
      else { const msg = await translate('Failed to upload image'); toast.error(msg); }
    } catch {
      const msg = await translate('Failed to upload image'); toast.error(msg);
    } finally {
      setUploading(false);
    }
  };

  const set = (key: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setFormData((prev) => ({ ...prev, [key]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) { const msg = await translate('Name is required'); toast.error(msg); return; }

    setSaving(true);
    try {
      const res = await fetchWithAuth('/api/patient/profile', token, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uid,
          user: {
            name: formData.name,
            phone: formData.phone || null,
            profileImageUrl: profileImage,
          },
          patient: {
            dateOfBirth: formData.date_of_birth || null,
            gender: formData.gender || null,
            bloodGroup: formData.blood_group || null,
            allergies: formData.allergies,
            currentMedications: formData.current_medications,
            chronicConditions: formData.chronic_conditions,
            addressLine1: formData.address_line1 || null,
            addressLine2: formData.address_line2 || null,
            city: formData.city || null,
            state: formData.state || null,
            postalCode: formData.postal_code || null,
            emergencyContactName: formData.emergency_contact_name || null,
            emergencyContactPhone: formData.emergency_contact_phone || null,
          },
        }),
      });

      const data = await res.json();
      if (data.success) {
        const msg = await translate('Profile updated!'); toast.success(msg);
        onSuccess();
        onClose();
      } else {
        const msg = await translate(data.error || 'Failed to update profile'); toast.error(msg);
      }
    } catch {
      const msg = await translate('Failed to update profile'); toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[95vw] sm:max-w-md md:max-w-xl overflow-hidden flex flex-col max-h-[92vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-sage-100 bg-sage-50 flex-shrink-0">
          <div>
            <h2 className="text-xl font-display font-bold text-forest-900"><TranslatedText>Clinical Profile</TranslatedText></h2>
            <p className="text-[10px] font-bold text-forest-400 tracking-widest uppercase mt-0.5"><TranslatedText>Edit Patient Record</TranslatedText></p>
          </div>
          <button onClick={onClose} className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-white border border-transparent hover:border-sage-200 text-forest-300 smooth-transition hover:rotate-90">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="overflow-y-auto flex-1 px-6 py-6 space-y-7">

            {/* ── Avatar ── */}
            <div className="flex items-center gap-5">
              <div className="relative flex-shrink-0">
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary-100 to-secondary-100 border-2 border-primary-100 overflow-hidden flex items-center justify-center shadow-md">
                  {profileImage ? (
                    <img src={profileImage} alt="User Profile" className="w-full h-full object-cover" />
                  ) : (
                    <User className="w-9 h-9 text-primary-300" />
                  )}
                </div>
                {uploading && (
                  <div className="absolute inset-0 bg-black/50 rounded-2xl flex items-center justify-center">
                    <Loader2 className="w-5 h-5 text-white animate-spin" />
                  </div>
                )}
                <label className="absolute -bottom-1.5 -right-1.5 w-7 h-7 bg-primary-600 hover:bg-primary-700 text-white rounded-full flex items-center justify-center cursor-pointer shadow-md transition active:scale-95">
                  <Camera className="w-3.5 h-3.5" />
                  <input type="file" accept="image/*" onChange={handleImageChange} className="hidden" disabled={uploading} />
                </label>
              </div>
              <div>
                <p className="text-sm font-bold text-forest-900"><TranslatedText>Profile Photo</TranslatedText></p>
                <p className="text-xs text-forest-500 mt-0.5"><TranslatedText>JPG or PNG, max 5MB</TranslatedText></p>
              </div>
            </div>

            <div className="h-px bg-sage-100" />

            {/* ── Personal Info ── */}
            <div>
              <SectionHeader icon={User} label="Personal Information" />
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <FieldLabel><TranslatedText>Full Name</TranslatedText> <span className="text-[var(--status-error)]">*</span></FieldLabel>
                  <input type="text" value={formData.name} onChange={set('name')} placeholder={phFullName} className={inputCls} required />
                </div>
                <div>
                  <FieldLabel><TranslatedText>Phone Number</TranslatedText></FieldLabel>
                  <input type="tel" value={formData.phone} onChange={set('phone')} placeholder={phPhone} className={inputCls} />
                </div>
                <div>
                  <FieldLabel><TranslatedText>Date of Birth</TranslatedText></FieldLabel>
                  <input type="date" value={formData.date_of_birth} onChange={set('date_of_birth')} className={inputCls} max={new Date().toISOString().split('T')[0]} />
                </div>
                <div>
                  <FieldLabel><TranslatedText>Gender</TranslatedText></FieldLabel>
                  <Select value={formData.gender} onValueChange={(val) => setFormData(p => ({ ...p, gender: val }))}>
                    <SelectTrigger className="bg-sage-50 border-sage-200">
                      <SelectValue placeholder={phGender} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none" disabled className="hidden"><TranslatedText>Select gender</TranslatedText></SelectItem>
                      {GENDERS.map((g) => <SelectItem key={g.value} value={g.value}><TranslatedText>{g.label}</TranslatedText></SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <div className="h-px bg-sage-100" />

            {/* ── Medical Info ── */}
            <div>
              <SectionHeader icon={Activity} label="Medical Information" />
              <div className="space-y-4">
                <div>
                  <FieldLabel><TranslatedText>Blood Group</TranslatedText></FieldLabel>
                  <Select value={formData.blood_group} onValueChange={(val) => setFormData(p => ({ ...p, blood_group: val }))}>
                    <SelectTrigger className="bg-sage-50 border-sage-200">
                      <SelectValue placeholder={phBloodGroup} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none" disabled className="hidden"><TranslatedText>Select blood group</TranslatedText></SelectItem>
                      {BLOOD_GROUPS.map((bg) => <SelectItem key={bg} value={bg}>{bg}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <FieldLabel><TranslatedText>Allergies</TranslatedText></FieldLabel>
                  <TagInput
                    tags={formData.allergies}
                    onChange={(tags) => setFormData((p) => ({ ...p, allergies: tags }))}
                    placeholder={phAllergy}
                  />
                  <p className="text-xs text-forest-400 mt-1"><TranslatedText>Press Enter or comma to add each item</TranslatedText></p>
                </div>
                <div>
                  <FieldLabel><TranslatedText>Current Medications</TranslatedText></FieldLabel>
                  <TagInput
                    tags={formData.current_medications}
                    onChange={(tags) => setFormData((p) => ({ ...p, current_medications: tags }))}
                    placeholder={phMedication}
                  />
                  <p className="text-xs text-forest-400 mt-1"><TranslatedText>Press Enter or comma to add each item</TranslatedText></p>
                </div>
                <div>
                  <FieldLabel><TranslatedText>Chronic Conditions</TranslatedText></FieldLabel>
                  <TagInput
                    tags={formData.chronic_conditions}
                    onChange={(tags) => setFormData((p) => ({ ...p, chronic_conditions: tags }))}
                    placeholder={phCondition}
                  />
                  <p className="text-xs text-forest-400 mt-1"><TranslatedText>Press Enter or comma to add each item</TranslatedText></p>
                </div>
              </div>
            </div>

            <div className="h-px bg-sage-100" />

            {/* ── Address ── */}
            <div>
              <SectionHeader icon={MapPin} label="Address" />
              <div className="space-y-3">
                <div>
                  <FieldLabel><TranslatedText>Address Line 1</TranslatedText></FieldLabel>
                  <input type="text" value={formData.address_line1} onChange={set('address_line1')} placeholder={phStreet} className={inputCls} />
                </div>
                <div>
                  <FieldLabel optional><TranslatedText>Address Line 2</TranslatedText></FieldLabel>
                  <input type="text" value={formData.address_line2} onChange={set('address_line2')} placeholder={phFlat} className={inputCls} />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
                  <div>
                    <FieldLabel><TranslatedText>City</TranslatedText></FieldLabel>
                    <input type="text" value={formData.city} onChange={set('city')} placeholder={phCity} className={inputCls} />
                  </div>
                  <div>
                    <FieldLabel><TranslatedText>State</TranslatedText></FieldLabel>
                    <input type="text" value={formData.state} onChange={set('state')} placeholder={phState} className={inputCls} />
                  </div>
                </div>
                <div>
                  <FieldLabel><TranslatedText>Postal Code</TranslatedText></FieldLabel>
                  <input type="text" value={formData.postal_code} onChange={set('postal_code')} placeholder={phPostal} className={inputCls} />
                </div>
              </div>
            </div>

            <div className="h-px bg-sage-100" />

            {/* ── Emergency Contact ── */}
            <div>
              <SectionHeader icon={ShieldAlert} label="Emergency Contact" />
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <FieldLabel><TranslatedText>Contact Name</TranslatedText></FieldLabel>
                  <input type="text" value={formData.emergency_contact_name} onChange={set('emergency_contact_name')} placeholder={phEmergencyName} className={inputCls} />
                </div>
                <div>
                  <FieldLabel><TranslatedText>Contact Phone</TranslatedText></FieldLabel>
                  <input type="tel" value={formData.emergency_contact_phone} onChange={set('emergency_contact_phone')} placeholder={phEmergencyPhone} className={inputCls} />
                </div>
              </div>
            </div>

          </div>

          {/* Sticky Footer */}
          <div className="flex gap-3 px-6 py-4 border-t border-sage-100 bg-white flex-shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 border-2 border-sage-200 text-forest-600 rounded-xl hover:bg-sage-50 hover:border-sage-300 transition font-bold text-xs"
            >
              <TranslatedText>Cancel</TranslatedText>
            </button>
            <button
              type="submit"
              disabled={saving || uploading}
              className="flex-1 py-2 bg-gradient-to-r from-primary-600 to-primary-500 text-white rounded-xl hover:shadow-lg transition disabled:opacity-50 disabled:cursor-not-allowed font-bold text-xs flex items-center justify-center gap-2"
            >
              {saving ? (
                <><Loader2 className="w-3.5 h-3.5 animate-spin" /> <TranslatedText>Saving...</TranslatedText></>
              ) : (
                <><CheckCircle className="w-4 h-4" /> <TranslatedText>Save Changes</TranslatedText></>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
