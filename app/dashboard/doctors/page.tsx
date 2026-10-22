'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState, useRef } from 'react';
import { Users, Search, MapPin, Award, ShieldCheck } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuthToken } from '@/lib/auth-token-context';
import { fetchWithAuth } from '@/lib/fetchWithAuth';
import Loading from '@/app/components/Loading';
import { TranslatedText } from '@/app/components/TranslatedText';
import { useLanguage } from '@/app/contexts/LanguageContext';
import { useNameTransliteration } from '@/app/hooks/useNameTransliteration';

interface Doctor {
  did: string;
  specialization: string;
  yearsOfExperience: number;
  consultationFee: number;
  city: string;
  state: string;
  user: {
    name: string;
    email: string;
    profileImageUrl?: string;
  };
}

export default function DoctorsPage() {
  const { translate } = useLanguage();
  const { transliterateName } = useNameTransliteration();
  const token = useAuthToken();
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [transliteratedNames, setTransliteratedNames] = useState<Record<string, string>>({});
  const [platformFee, setPlatformFee] = useState<number>(20);

  const hasFetched = useRef(false);

  useEffect(() => {
    if (token && !hasFetched.current) {
      hasFetched.current = true;
      async function fetchPlatformFee() {
        try {
          const response = await fetch('/api/platform-fee');
          const data = await response.json();
          if (data.success) {
            setPlatformFee(data.platformFee);
          }
        } catch (error) {
          console.error('Error fetching platform fee:', error);
        }
      }
      fetchPlatformFee();
      fetchDoctors(true);
    }
  }, [token]);

  async function fetchDoctors(isInitial = false) {
    try {
      const response = await fetchWithAuth('/api/doctors', token);
      if (!response.ok) throw new Error('Failed to fetch');
      const data = await response.json();
      const doctorsData = data || [];
      setDoctors(doctorsData);
      
      const namesMap: Record<string, string> = {};
      for (const doctor of doctorsData) {
        if (doctor.user?.name) {
          const transliterated = await transliterateName(doctor.user.name);
          namesMap[doctor.did] = transliterated;
        }
      }
      setTransliteratedNames(namesMap);
    } catch (error) {
      console.error('Error fetching doctors:', error);
      if (isInitial) {
        const msg = await translate('Failed to load doctors'); toast.error(msg);
      }
    } finally {
      setLoading(false);
    }
  }

  const filteredDoctors = doctors.filter((doctor) =>
    doctor.user?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    doctor.specialization?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) return <Loading />;

  return (
    <div className="space-y-6 sm:space-y-10 pb-10 p-0">
      {/* ── HEADER ── */}
      <div>
        <span className="pill-badge mb-4 inline-block tracking-widest">
          <ShieldCheck className="w-3 h-3" />
          <TranslatedText>VERIFIED NETWORK</TranslatedText>
        </span>
        <h1 className="headline-lg mb-2">
          Find <span className="text-primary italic">Practitioners</span>
        </h1>
        <p className="body-md text-outline max-w-xl">
          <TranslatedText>Connect with verified Ayurvedic specialists for personalized holistic care and authentic Panchakarma guidance.</TranslatedText>
        </p>
      </div>

      {/* ── SEARCH ── */}
      <div className="bg-white rounded-3xl p-4 sm:p-6 border border-sage-100 shadow-forest-sm">
        <div className="relative">
          <Search className="absolute left-3 sm:left-5 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-primary" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by name, specialization, or therapeutic focus..."
            className="w-full pl-10 sm:pl-14 pr-4 sm:pr-6 py-3 sm:py-4 bg-sage-50 border-none rounded-2xl focus:ring-2 focus:ring-forest-500/20 text-forest-900 placeholder:text-forest-300 font-medium smooth-transition"
          />
        </div>
      </div>

      {/* ── RESULTS ── */}
      {filteredDoctors.length === 0 ? (
        <div className="bg-sage-50 rounded-[40px] p-20 text-center border border-dashed border-sage-200">
          <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center mx-auto mb-6 shadow-forest-sm">
            <Users className="w-10 h-10 text-sage-300" />
          </div>
          <h3 className="text-xl font-bold font-display text-forest-900 mb-2"><TranslatedText>No Doctors Found</TranslatedText></h3>
          <p className="text-forest-400 max-w-xs mx-auto text-sm">
            <TranslatedText>We couldn't find any practitioners matching</TranslatedText> "{searchTerm}". <TranslatedText>Try broadening your search terms.</TranslatedText>
          </p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-6 pb-12">
          {filteredDoctors.map((doctor) => (
            <div key={doctor.did} className="editorial-card rounded-3xl p-4 sm:p-6 flex flex-col group">
              <div className="flex items-start gap-5 mb-6">
                <div className="w-20 h-20 bg-sage-100 rounded-2xl flex items-center justify-center shrink-0 overflow-hidden border border-sage-200">
                  {doctor.user?.profileImageUrl ? (
                    <img src={doctor.user.profileImageUrl} alt={doctor.user.name} className="w-full h-full object-cover" />
                  ) : (
                    <Users className="w-10 h-10 text-forest-400 opacity-40" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-bold tracking-widest text-primary uppercase">VERIFIED</span>
                    <div className="w-1 h-1 bg-sage-300 rounded-full" />
                    <span className="text-[10px] font-bold tracking-widest text-forest-400 uppercase">
                      {doctor.yearsOfExperience}+ YRS EXP
                    </span>
                  </div>
                  <h3 className="text-2xl font-black font-display text-forest-900 leading-tight mb-1 truncate devanagari-small">
                    {transliteratedNames[doctor.did] || doctor.user?.name || 'Doctor'}
                  </h3>
                  <p className="text-sm font-medium text-forest-400 italic">
                    {doctor.specialization}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 sm:gap-4 mb-6 sm:mb-8">
                <div className="bg-sage-50/50 rounded-2xl p-2 sm:p-4 border border-sage-100">
                  <div className="flex items-center gap-2 mb-1">
                    <MapPin className="w-3.5 h-3.5 text-forest-400" />
                    <span className="text-[10px] font-bold text-forest-400 uppercase tracking-wider">Location</span>
                  </div>
                  <p className="text-sm font-bold text-forest-900">{doctor.city || 'Pan-India'}, {doctor.state || 'Online'}</p>
                </div>
                <div className="bg-sage-50/50 rounded-2xl p-2 sm:p-4 border border-sage-100">
                  <div className="flex items-center gap-2 mb-1">
                    <Award className="w-3.5 h-3.5 text-forest-400" />
                    <span className="text-[10px] font-bold text-forest-400 uppercase tracking-wider">Consultation</span>
                  </div>
                  <p className="text-sm font-bold text-forest-900">₹{Number(Number(doctor.consultationFee || 500) + platformFee).toFixed(2)}</p>
                </div>
              </div>

              <div className="mt-auto pt-6 border-t border-sage-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                   <div className="flex -space-x-2">
                     {[1,2,3].map(i => (
                       <div key={i} className="w-6 h-6 rounded-full border-2 border-white bg-sage-200" />
                     ))}
                   </div>
                   <span className="text-[10px] font-bold text-forest-400">500+ Consulted</span>
                </div>
                <button
                  onClick={async () => { const msg = await translate('Booking feature coming soon!'); toast.success(msg); }}
                  className="btn-primary py-2 sm:py-3 px-5 sm:px-8 text-sm shadow-primary"
                >
                  Book Session
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
