'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState, KeyboardEvent } from 'react';
import { User, Save, Loader2, Activity, MapPin, Camera, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import Loading from '@/app/components/Loading';
import { TranslatedText } from '@/app/components/TranslatedText';
import { useTranslation } from '@/app/hooks/useTranslation';
import { useLanguage } from '@/app/contexts/LanguageContext';
import { useProfileStore } from '@/app/store/useProfileStore';
import { useUser } from '@clerk/nextjs';
import { useAuthToken } from '@/lib/auth-token-context';
import { fetchWithAuth } from '@/lib/fetchWithAuth';
import { uploadImage } from '@/lib/upload';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/app/components/CustomSelect';
import { DatePicker } from '@/app/components/DatePicker';
import { useNameTransliteration } from '@/app/hooks/useNameTransliteration';
import { checkPatientProfileComplete } from '@/lib/shared/profile-utils';
import { useRouter, useSearchParams } from 'next/navigation';

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const GENDERS = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'other', label: 'Other' },
  { value: 'prefer_not_to_say', label: 'Prefer not to say' },
];

function calcAge(dob: string) {
  if (!dob) return '';
  return String(Math.floor((Date.now() - new Date(dob).getTime()) / (1000 * 60 * 60 * 24 * 365.25)));
}

function TagInput({ tags, onChange, placeholder }: { tags: string[]; onChange: (tags: string[]) => void; placeholder: string }) {
  const [val, setVal] = useState('');
  const { text: addMoreText } = useTranslation('Add more...');
  const add = (v: string) => { const t = v.trim().replace(/,$/, ''); if (t && !tags.includes(t)) onChange([...tags, t]); setVal(''); };
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add(val); }
    else if (e.key === 'Backspace' && !val && tags.length) onChange(tags.slice(0, -1));
  };
  return (
    <div className="min-h-[48px] w-full px-5 py-2.5 flex flex-wrap gap-1.5 cursor-text rounded-[2rem] bg-sage-50 border border-sage-200 transition-all duration-300 focus-within:border-forest-500 focus-within:ring-4 focus-within:ring-forest-500/10 focus-within:bg-white">
      {tags.map((tag, i) => (
        <span key={i} className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-sage-200 text-forest-800">
          {tag}
          <button type="button" onClick={() => onChange(tags.filter((_, j) => j !== i))} className="hover:opacity-70 ml-1 leading-none">×</button>
        </span>
      ))}
      <input
        type="text" value={val} onChange={(e) => setVal(e.target.value)}
        onKeyDown={onKey} onBlur={() => add(val)}
        placeholder={tags.length === 0 ? placeholder : addMoreText}
        className="flex-1 min-w-[80px] sm:min-w-[160px] bg-transparent outline-none text-sm text-forest-900"
      />
    </div>
  );
}

function FieldLabel({ children }: { children: string }) {
  return <label className="block text-xs font-bold tracking-wider mb-2 text-forest-400 uppercase"><TranslatedText>{children}</TranslatedText></label>;
}

function SectionHead({ number, title }: { number: string; title: string }) {
  return (
    <div className="flex items-center gap-3 mb-6 pb-4 border-b border-sage-100">
      <span className="text-sm font-bold italic font-display text-forest-400 min-w-[28px]">{number}</span>
      <TranslatedText as="h2" className="text-xl font-display font-medium italic text-forest-900">{title}</TranslatedText>
    </div>
  );
}

const inputCls = 'w-full px-4 sm:px-6 py-2.5 sm:py-3.5 rounded-full bg-sage-50 border border-sage-200 text-forest-900 text-sm outline-none transition-all duration-300 focus:border-forest-500 focus:ring-4 focus:ring-forest-500/10 focus:bg-white disabled:opacity-60 disabled:cursor-not-allowed disabled:bg-sage-100 placeholder:text-forest-400/50';

export default function PatientProfilePage() {
  const { user: clerkUser } = useUser();
  const token = useAuthToken();
  const profileStore = useProfileStore();
  const { translate } = useLanguage();
  const { transliterateName } = useNameTransliteration();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { text: phFirstName } = useTranslation('First name');
  const { text: phLastName } = useTranslation('Last name');
  const { text: phPhone } = useTranslation('+91 XXXXX XXXXX');
  const { text: phSelectGender } = useTranslation('Select gender');
  const { text: phChronicConditions } = useTranslation('e.g. Diabetes, Hypertension');
  const { text: phAllergies } = useTranslation('e.g. Penicillin, Peanuts, Dust Mites');
  const { text: phMedications } = useTranslation('e.g. Metformin 500mg, Aspirin');
  const { text: phStreet } = useTranslation('Street, area, colony');
  const { text: phAddress2 } = useTranslation('Flat no., building, landmark');
  const { text: phEmergencyName } = useTranslation('e.g. Ramesh Kumar');
  const { text: phRelationship } = useTranslation('e.g. Partner, Parent');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uid, setUid] = useState('');
  const [profileImage, setProfileImage] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);
  const [userName, setUserName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [consentAgreed, setConsentAgreed] = useState(false);
  const [formData, setFormData] = useState({
    firstName: '', lastName: '', email: '', phone: '', date_of_birth: '', gender: '', blood_group: '',
    allergies: [] as string[], current_medications: [] as string[], chronic_conditions: [] as string[],
    address_line1: '', address_line2: '', city: '', state: '', postal_code: '',
    emergency_contact_name: '', emergency_contact_relationship: '', emergency_contact_phone: '',
  });

  const set = (key: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setFormData((p) => ({ ...p, [key]: e.target.value }));

  useEffect(() => { fetchProfile(); }, []);

  useEffect(() => {
    if (profileStore.completionPct === 100 && searchParams.has('incomplete')) {
      router.replace('/dashboard/profile');
    }
  }, [profileStore.completionPct, searchParams, router]);

  async function fetchProfile() {
    try {
      const syncRes = await fetchWithAuth('/api/sync-user', token, { cache: 'no-store' });
      const { user } = await syncRes.json();
      if (!user) { setLoading(false); return; }
      setUid(user.uid);
      const res = await fetchWithAuth(`/api/patient/profile?uid=${user.uid}&t=${Date.now()}`, token, { cache: 'no-store' });
      const data = await res.json();
      if (data.success) {
        setProfileImage(data.user?.profile_image_url || data.user?.profileImageUrl || '');
        
        const dbName = data.user?.name || '';
        const isGenericName = !dbName || dbName.toLowerCase() === 'user' || dbName.toLowerCase() === 'profile';
        
        let firstName = '';
        let lastName = '';
        
        if (isGenericName && clerkUser) {
          firstName = clerkUser.firstName || '';
          lastName = clerkUser.lastName || '';
        } else {
          const parts = dbName.split(' ');
          firstName = parts[0] || '';
          lastName = parts.slice(1).join(' ') || '';
        }

        setUserName(data.user?.name || '');
        // Transliterate the user name
        const transliterated = await transliterateName(data.user?.name || '');
        setDisplayName(transliterated);
          const patientDob = data.patient?.date_of_birth || data.patient?.dateOfBirth;
          const formDataToSet = {
            firstName, lastName,
            email: data.user?.email || '', phone: data.user?.phone || '',
            date_of_birth: patientDob ? patientDob.split('T')[0] : '',
            gender: data.patient?.gender || '', blood_group: data.patient?.blood_group || data.patient?.bloodGroup || '',
            allergies: data.patient?.allergies || [], current_medications: data.patient?.current_medications || data.patient?.currentMedications || [],
            chronic_conditions: data.patient?.chronic_conditions || data.patient?.chronicConditions || [],
            address_line1: data.patient?.address_line1 || data.patient?.addressLine1 || '', 
            address_line2: data.patient?.address_line2 || data.patient?.addressLine2 || '',
            city: data.patient?.city || '', state: data.patient?.state || '',
            postal_code: data.patient?.postal_code || data.patient?.postalCode || '',
            emergency_contact_name: data.patient?.emergency_contact_name || data.patient?.emergencyContactName || '',
            emergency_contact_relationship: data.patient?.emergency_contact_relationship || data.patient?.emergencyContactRelationship || '',
            emergency_contact_phone: data.patient?.emergency_contact_phone || data.patient?.emergencyContactPhone || '',
          };

          setFormData(formDataToSet);

          const completeness = checkPatientProfileComplete(data.patient, data.user);

          profileStore.setProfile({
            name: data.user?.name || '',
            imageUrl: data.user?.profile_image_url || '',
            email: data.user?.email || '',
            completionPct: completeness.percentage,
            missingFields: completeness.missingFields,
          });
      }
    } catch { const msg = await translate('Failed to load profile'); toast.error(msg); }
    finally { setLoading(false); }
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingImage(true);
    try {
      const url = await uploadImage(file);
      if (url) { setProfileImage(url); const msg = await translate('Profile picture updated!'); toast.success(msg); }
      else { const msg = await translate('Failed to upload image'); toast.error(msg); }
    } catch { const msg = await translate('Failed to upload image'); toast.error(msg); }
    finally { setUploadingImage(false); }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formData.firstName.trim()) { const msg = await translate('First name is required'); toast.error(msg); return; }
    if (!consentAgreed) { const msg = await translate('Please agree to the Terms, Privacy Policy, and Medical Disclaimer to save your profile.'); toast.error(msg); return; }
    setSaving(true);
    const fullName = `${formData.firstName} ${formData.lastName}`.trim();
    try {
      const res = await fetchWithAuth('/api/patient/profile', token, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uid, user: { name: fullName, phone: formData.phone || null, profileImageUrl: profileImage },
          patient: {
            dateOfBirth: formData.date_of_birth || null, gender: formData.gender || null,
            bloodGroup: formData.blood_group || null, allergies: formData.allergies,
            currentMedications: formData.current_medications, chronicConditions: formData.chronic_conditions,
            addressLine1: formData.address_line1 || null, addressLine2: formData.address_line2 || null,
            city: formData.city || null, state: formData.state || null, postalCode: formData.postal_code || null,
            emergencyContactName: formData.emergency_contact_name || null,
            emergencyContactRelationship: formData.emergency_contact_relationship || null,
            emergencyContactPhone: formData.emergency_contact_phone || null,
          },
        }),
      });
      const data = await res.json();
      if (data.success) { 
        const msg = await translate('Profile updated successfully!'); 
        toast.success(msg); 
        await fetchProfile(); 
      }
      else { const msg = await translate(data.error || 'Failed to update profile'); toast.error(msg); }
    } catch { const msg = await translate('Failed to update profile'); toast.error(msg); }
    finally { setSaving(false); }
  }

  const currentProfileImage = profileImage || profileStore.imageUrl;
  const currentDisplayName = displayName || profileStore.name;
  const currentUserName = userName || profileStore.name;
  const currentFirstName = formData.firstName || (currentUserName.split(' ')[0]) || 'U';

  const emergencyInputCls = 'w-full px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl text-sm text-white outline-none transition-all duration-200 bg-white/15 border border-white/40 placeholder:text-white/50 focus:bg-white/25 focus:border-white/60';

  return (
    <div className="max-w-3xl mx-auto">
      {/* ── HEADER ── */}
      <div className="flex items-start justify-between gap-4 sm:gap-6 mb-10">
        <div>
          <span className="pill-badge mb-4 inline-block">
            <User className="w-3 h-3" />
            <TranslatedText>YOUR RECORD</TranslatedText>
          </span>
          <h1 className="headline-lg mb-1">
            <TranslatedText>Namaste</TranslatedText> <span className="text-primary italic devanagari-small">{currentDisplayName || currentUserName || 'Profile'}</span>
          </h1>
          <p className="body-md text-outline max-w-xl">
            <TranslatedText>Manage your personal information, contact details, and clinical preferences.</TranslatedText>
          </p>
        </div>
        <div className="relative shrink-0">
          <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-3xl overflow-hidden border-2 border-sage-200">
            {currentProfileImage ? (
              <img src={currentProfileImage} alt="User Profile" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-3xl font-black bg-sage-100 text-forest-500">
                {currentFirstName.charAt(0)}
              </div>
            )}
            {uploadingImage && (
              <div className="absolute inset-0 flex items-center justify-center rounded-3xl bg-black/40">
                <Loader2 className="w-6 h-6 text-white animate-spin" />
              </div>
            )}
          </div>
          <label htmlFor="profile-picture-upload" className="absolute -bottom-2 -right-2 w-7 h-7 rounded-full flex items-center justify-center cursor-pointer bg-forest-500 shadow-primary hover:bg-forest-600 transition-colors">
            <Camera className="w-3.5 h-3.5 text-white" />
            <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" id="profile-picture-upload" />
          </label>
        </div>
      </div>

      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center opacity-70">
          <Loader2 className="w-8 h-8 animate-spin text-forest-500 mb-4" />
          <p className="text-sm font-bold text-forest-400 tracking-widest uppercase animate-pulse"><TranslatedText>Loading Clinical Data</TranslatedText></p>
        </div>
      ) : (
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* ── 01 Personal Identity ── */}
        <div className="bg-white rounded-3xl p-3 sm:p-5 md:p-7 shadow-forest-sm border border-sage-100">
          <SectionHead number="01" title="Personal Identity" />
          <div className="grid md:grid-cols-2 gap-3 sm:gap-4 md:gap-5">
            <div>
              <FieldLabel>LEGAL FIRST NAME</FieldLabel>
              <input type="text" value={formData.firstName}
                onChange={set('firstName')}
                className={inputCls} placeholder={phFirstName} />
            </div>
            <div>
              <FieldLabel>LEGAL LAST NAME</FieldLabel>
              <input type="text" value={formData.lastName}
                onChange={set('lastName')}
                className={inputCls} placeholder={phLastName} />
            </div>
            <div>
              <label className="block text-xs font-bold tracking-wider mb-2 text-forest-400 uppercase">
                <TranslatedText>DATE OF BIRTH</TranslatedText>
                {formData.date_of_birth && ` (${calcAge(formData.date_of_birth)} yrs)`}
              </label>
              <DatePicker 
                value={formData.date_of_birth} 
                onChange={(date) => setFormData(p => ({ ...p, date_of_birth: date }))} 
                maxDate={new Date().toISOString().split('T')[0]}
              />
            </div>
            <div>
              <FieldLabel>GENDER IDENTITY</FieldLabel>
              <Select value={formData.gender} onValueChange={(val) => setFormData(p => ({ ...p, gender: val }))}>
                <SelectTrigger className="bg-sage-50 border-sage-200">
                  <SelectValue placeholder={phSelectGender} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none" disabled className="hidden">{phSelectGender}</SelectItem>
                  {GENDERS.map((g) => <SelectItem key={g.value} value={g.value}><TranslatedText>{g.label}</TranslatedText></SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <FieldLabel>PHONE NUMBER</FieldLabel>
              <input type="tel" value={formData.phone} onChange={set('phone')} className={inputCls} placeholder={phPhone} />
            </div>
            <div>
              <FieldLabel>EMAIL ADDRESS (READ-ONLY)</FieldLabel>
              <input type="email" value={formData.email} disabled className={inputCls} />
            </div>
          </div>
        </div>

        {/* ── 02 Clinical Context ── */}
        <div className="bg-white rounded-3xl p-3 sm:p-5 md:p-7 shadow-forest-sm border border-sage-100">
          <SectionHead number="02" title="Clinical Context" />
          <div className="grid md:grid-cols-3 gap-5 mb-5">
            <div className="rounded-2xl p-5 flex flex-col items-center justify-center text-center bg-sage-100 border border-sage-200 md:row-span-2">
              <FieldLabel>BLOOD TYPE</FieldLabel>
              <div className="text-3xl sm:text-5xl font-black mt-2 font-display text-forest-500">{formData.blood_group || '—'}</div>
              <Select value={formData.blood_group} onValueChange={(val) => setFormData(p => ({ ...p, blood_group: val }))}>
                <SelectTrigger className="mt-3 h-9 px-3 py-2 text-xs font-semibold bg-sage-200 text-forest-800 border-0">
                  <SelectValue placeholder={phSelectGender} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none" disabled className="hidden">Select</SelectItem>
                  {BLOOD_GROUPS.map((bg) => <SelectItem key={bg} value={bg}>{bg}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2">
              <FieldLabel>CHRONIC CONDITIONS</FieldLabel>
              <TagInput tags={formData.chronic_conditions} onChange={(t) => setFormData((p) => ({ ...p, chronic_conditions: t }))} placeholder={phChronicConditions} />
              <p className="text-xs mt-1 text-forest-400"><TranslatedText>Press Enter or comma after each item</TranslatedText></p>
            </div>
            <div className="md:col-span-2">
              <FieldLabel>KNOWN ALLERGIES</FieldLabel>
              <TagInput tags={formData.allergies} onChange={(t) => setFormData((p) => ({ ...p, allergies: t }))} placeholder={phAllergies} />
              <p className="text-xs mt-1 text-forest-400"><TranslatedText>Press Enter or comma after each item</TranslatedText></p>
            </div>
          </div>
          <div>
            <FieldLabel>CURRENT MEDICATIONS</FieldLabel>
            <TagInput tags={formData.current_medications} onChange={(t) => setFormData((p) => ({ ...p, current_medications: t }))} placeholder={phMedications} />
            <p className="text-xs mt-1 text-forest-400"><TranslatedText>Press Enter or comma after each item</TranslatedText></p>
          </div>
        </div>

        {/* ── 03 Address & Reach ── */}
        <div className="bg-white rounded-3xl p-3 sm:p-5 md:p-7 shadow-forest-sm border border-sage-100">
          <SectionHead number="03" title="Address & Reach" />
          <div className="grid md:grid-cols-2 gap-3 sm:gap-4 md:gap-5">
            <div className="md:col-span-2">
              <FieldLabel>RESIDENTIAL ADDRESS</FieldLabel>
              <input type="text" value={formData.address_line1} onChange={set('address_line1')} placeholder={phStreet} className={inputCls} />
            </div>
            <div className="md:col-span-2">
              <FieldLabel>ADDRESS LINE 2</FieldLabel>
              <input type="text" value={formData.address_line2} onChange={set('address_line2')} placeholder={phAddress2} className={inputCls} />
            </div>
            <div><FieldLabel>CITY</FieldLabel><input type="text" value={formData.city} onChange={set('city')} className={inputCls} /></div>
            <div><FieldLabel>EMAIL ADDRESS</FieldLabel><input type="email" value={formData.email} disabled className={inputCls} /></div>
            <div><FieldLabel>STATE</FieldLabel><input type="text" value={formData.state} onChange={set('state')} className={inputCls} /></div>
            <div><FieldLabel>POSTAL CODE</FieldLabel><input type="text" value={formData.postal_code} onChange={set('postal_code')} className={inputCls} /></div>
          </div>
        </div>

        {/* ── 04 Emergency Lifeline ── */}
        <div className="gradient-primary rounded-3xl p-3 sm:p-5 md:p-7 shadow-primary">
          <div className="flex items-center gap-3 mb-6">
            <span className="text-sm font-bold italic font-display text-white/70 min-w-[28px]">04</span>
            <TranslatedText as="h2" className="text-xl font-display font-medium italic text-white">Emergency Lifeline</TranslatedText>
          </div>
          <div className="grid md:grid-cols-3 gap-5">
            <div>
              <label className="block text-xs font-bold tracking-wider mb-2 text-white/70 uppercase"><TranslatedText>CONTACT NAME</TranslatedText></label>
              <input type="text" value={formData.emergency_contact_name} onChange={set('emergency_contact_name')} placeholder={phEmergencyName} className={emergencyInputCls} />
            </div>
            <div>
              <label className="block text-xs font-bold tracking-wider mb-2 text-white/70 uppercase"><TranslatedText>RELATIONSHIP</TranslatedText></label>
              <input
                type="text"
                value={formData.emergency_contact_relationship}
                onChange={set('emergency_contact_relationship')}
                placeholder={phRelationship}
                className={emergencyInputCls}
              />
            </div>
            <div>
              <label className="block text-xs font-bold tracking-wider mb-2 text-white/70 uppercase"><TranslatedText>EMERGENCY PHONE</TranslatedText></label>
              <input type="tel" value={formData.emergency_contact_phone} onChange={set('emergency_contact_phone')} placeholder={phPhone} className={emergencyInputCls} />
            </div>
          </div>
        </div>

        {/* ── CONSENT ── */}
        <div className="flex items-start gap-3 p-4 bg-sage-50 border border-sage-200 rounded-2xl">
          <input
            type="checkbox"
            id="patient-profile-consent"
            checked={consentAgreed}
            onChange={(e) => setConsentAgreed(e.target.checked)}
            className="mt-1 w-4 h-4 text-forest-600 bg-white border-sage-300 rounded focus:ring-forest-500 focus:ring-2 cursor-pointer shrink-0"
          />
          <label htmlFor="patient-profile-consent" className="text-xs sm:text-sm text-forest-700 leading-relaxed cursor-pointer">
            I agree to the <a href="/terms-and-conditions" target="_blank" className="text-forest-600 font-semibold underline hover:text-forest-800">Terms of Service</a>,{' '}
            <a href="/privacy-policy" target="_blank" className="text-forest-600 font-semibold underline hover:text-forest-800">Privacy Policy</a>,{' '}
            <a href="/refund-policy" target="_blank" className="text-forest-600 font-semibold underline hover:text-forest-800">Refund Policy</a>, and{' '}
            <a href="/disclaimer" target="_blank" className="text-forest-600 font-semibold underline hover:text-forest-800">Medical Disclaimer</a>.
          </label>
        </div>

        {/* ── FOOTER ACTIONS ── */}
        <div className="flex flex-col gap-4 pb-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <button type="button" onClick={fetchProfile} className="btn-secondary flex-1 sm:flex-none px-4 py-3 text-xs font-bold text-center"><TranslatedText>Discard Changes</TranslatedText></button>
            <button type="submit" disabled={saving || uploadingImage} className="btn-primary flex-1 sm:flex-none flex items-center justify-center px-6 py-3 text-xs font-bold">
              {saving ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> <TranslatedText>Saving...</TranslatedText></> : <><Save className="w-3.5 h-3.5" /> <TranslatedText>Save Profile</TranslatedText></>}
            </button>
          </div>
        </div>
      </form>
      )}
    </div>
  );
}
