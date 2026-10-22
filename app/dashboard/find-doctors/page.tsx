'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState, useRef } from 'react';
import { Search, User, MapPin, Sparkles, X, Award, ArrowRight, Stethoscope, Mic, MicOff } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuthToken } from '@/lib/auth-token-context';
import { fetchWithAuth } from '@/lib/fetchWithAuth';
import Loading from '@/app/components/Loading';
import DoctorProfileModal from '@/app/dashboard/components/DoctorProfileModal';
import { TranslatedText } from '@/app/components/TranslatedText';
import { useTranslation } from '@/app/hooks/useTranslation';
import { useLanguage } from '@/app/contexts/LanguageContext';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/app/components/CustomSelect';
import { useVoiceToText } from '@/app/hooks/useVoiceToText';

interface Doctor {
  did: string;
  specialization: string[];
  custom_specializations: string;
  qualification: string;
  yearsOfExperience: number;
  consultationFee: number;
  city: string;
  state: string;
  bio: string;
  languages: string[];
  user: {
    name: string;
    email: string;
    profileImageUrl?: string;
  };
}

interface AIDoctor {
  name: string;
  specialization: string;
  experience: number;
  fee: number;
  location: string;
  matchScore: number;
  reason: string;
  did?: string;
  profileImageUrl?: string;
}

export default function FindDoctorsPage() {
  const [platformFee, setPlatformFee] = useState<number>(20);
  const token = useAuthToken();
  const { translate } = useLanguage();
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [filteredDoctors, setFilteredDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSpecialization, setSelectedSpecialization] = useState('all');
  const [selectedCity, setSelectedCity] = useState('all');
  const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null);

  // AI search
  const [aiQuery, setAiQuery] = useState('');
  const { isRecording, transcript, isSupported, startRecording, stopRecording, resetTranscript } = useVoiceToText();

  useEffect(() => {
    if (transcript) setAiQuery(transcript);
  }, [transcript]);

  // Auto-trigger search when voice recording completes with actual input
  useEffect(() => {
    if (!isRecording && transcript.trim().length > 0) {
      handleAISearch(transcript);
    }
  }, [isRecording]);

  const handleVoiceToggle = () => {
    if (isRecording) { 
      stopRecording(); 
    } else { 
      resetTranscript(); 
      setAiQuery(''); 
      startRecording(); 
    }
  };
  const [isAISearching, setIsAISearching] = useState(false);
  const [aiResults, setAiResults] = useState<AIDoctor[]>([]);
  const [showAIResults, setShowAIResults] = useState(false);

  // Image enlarge
  const [enlargedImage, setEnlargedImage] = useState<{ url: string; name: string } | null>(null);

  const { text: searchPlaceholder } = useTranslation('e.g. Dr. Pintu, Kayachikitsa...');
  const { text: allSpecsText } = useTranslation('All Specializations');
  const { text: allCitiesText } = useTranslation('All Cities');

  const hasFetched = useRef(false);

  useEffect(() => {
    if (token && !hasFetched.current) {
      hasFetched.current = true;
      fetchDoctors(true);
      fetchPlatformFee();
    }
  }, [token]);

  async function fetchPlatformFee() {
    try {
      const response = await fetch('/api/platform-fee');
      const data = await response.json();
      if (data.success) setPlatformFee(data.platformFee);
    } catch {}
  }

  useEffect(() => { filterDoctors(); }, [searchTerm, selectedSpecialization, selectedCity, doctors]);

  async function fetchDoctors(isInitial = false) {
    try {
      const response = await fetchWithAuth('/api/doctors/find-all', token);
      const data = await response.json();
      if (data.success) {
        const mapped = data.doctors || [];
        setDoctors(mapped);
        setFilteredDoctors(mapped);
      } else if (isInitial) {
        toast.error('Failed to load doctors');
      }
    } catch {
      if (isInitial) toast.error('Failed to load doctors');
    } finally {
      setLoading(false);
    }
  }

  function filterDoctors() {
    let filtered = [...doctors];
    if (searchTerm) {
      const s = searchTerm.toLowerCase();
      filtered = filtered.filter((d) => {
        const name = d.user?.name?.toLowerCase() || '';
        const city = d.city?.toLowerCase() || '';
        const state = d.state?.toLowerCase() || '';
        const specs = (d.specialization || []).join(' ').toLowerCase();
        const custom = d.custom_specializations?.toLowerCase() || '';
        return name.includes(s) || city.includes(s) || state.includes(s) || specs.includes(s) || custom.includes(s);
      });
    }
    if (selectedSpecialization !== 'all') {
      filtered = filtered.filter((d) => d.specialization?.includes(selectedSpecialization));
    }
    if (selectedCity !== 'all') {
      filtered = filtered.filter((d) => d.city === selectedCity);
    }
    setFilteredDoctors(filtered);
  }

  async function handleAISearch(query = aiQuery) {
    const q = query.trim();
    if (!q) return;
    setIsAISearching(true);
    setShowAIResults(false);
    try {
      const res = await fetch('/api/ai-doctor-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symptoms: q }),
      });
      const data = await res.json();
      if (data.success && data.doctors?.length > 0) {
        setAiResults(data.doctors);
        setShowAIResults(true);
      } else {
        toast.error('No matching doctors found. Try different symptoms.');
      }
    } catch {
      toast.error('AI search failed. Please try again.');
    } finally {
      setIsAISearching(false);
    }
  }

  function getMatchedDoctor(aiDoc: AIDoctor): Doctor | undefined {
    return doctors.find(d =>
      d.did === aiDoc.did ||
      d.user?.name?.toLowerCase() === aiDoc.name.toLowerCase()
    );
  }

  const allSpecializations = Array.from(new Set(doctors.flatMap((d) => d.specialization || []))).sort();
  const allCities = Array.from(new Set(doctors.map((d) => d.city).filter(Boolean))).sort();

  if (loading) return <Loading />;

  return (
    <div className="pb-10">
      {/* Profile Modal */}
      <DoctorProfileModal
        doctor={selectedDoctor}
        isOpen={!!selectedDoctor}
        onClose={() => setSelectedDoctor(null)}
        platformFee={platformFee}
      />

      {/* Image Enlarge Overlay */}
      {enlargedImage && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm"
          onClick={() => setEnlargedImage(null)}
        >
          <div className="relative max-w-lg w-full mx-4" onClick={e => e.stopPropagation()}>
            <button
              className="absolute -top-4 -right-4 w-10 h-10 flex items-center justify-center rounded-full bg-white text-black shadow-lg z-10 hover:bg-gray-100 transition"
              onClick={() => setEnlargedImage(null)}
            >
              <X className="w-5 h-5" />
            </button>
            <img
              src={enlargedImage.url}
              alt={enlargedImage.name}
              className="w-full rounded-3xl object-cover shadow-2xl max-h-[80vh]"
            />
            <p className="text-center text-white font-semibold mt-3 text-lg">{enlargedImage.name}</p>
          </div>
        </div>
      )}

      {/* ── HEADER ── */}
      <div className="mb-8">
        <span className="pill-badge mb-4 inline-block">
          <Stethoscope className="w-3 h-3" />
          <TranslatedText>AYURVEDIC NETWORK</TranslatedText>
        </span>
        <h1 className="headline-lg mb-1">
          <TranslatedText>Find</TranslatedText>{' '}
          <span className="text-primary italic"><TranslatedText>Doctors</TranslatedText></span>
        </h1>
        <p className="body-md text-outline max-w-xl">
          <TranslatedText>Use AI to find the right specialist for your symptoms, or browse all practitioners.</TranslatedText>
        </p>
      </div>

      {/* ── AI SYMPTOM SEARCH ── */}
      <div className="gradient-primary rounded-3xl p-5 sm:p-7 mb-6 relative overflow-hidden">
        {/* Background glow */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-[80px] pointer-events-none" />
        <div className="flex items-start gap-3 mb-5 relative z-10">
          <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center shrink-0">
            <Sparkles className="w-5 h-5 text-white animate-pulse" />
          </div>
          <div>
            <h2 className="font-black text-white text-base leading-tight">
              <TranslatedText>AI Doctor Search</TranslatedText>
            </h2>
            <p className="text-xs text-white/70 mt-0.5">
              <TranslatedText>Describe your symptoms and AI will find the best matching specialist</TranslatedText>
            </p>
          </div>
        </div>
        <div className="flex gap-3 relative z-10">
          <input
            type="text"
            value={aiQuery}
            onChange={e => setAiQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAISearch()}
            placeholder="e.g. joint pain, fatigue, digestive issues..."
            className="flex-1 px-4 py-3.5 rounded-2xl bg-white/15 border border-white/30 text-white placeholder-white/50 text-sm outline-none focus:bg-white/25 transition-all"
          />
          {isSupported && (
            <button
              onClick={handleVoiceToggle}
              className={`p-3.5 rounded-2xl transition-all flex items-center justify-center shrink-0 border ${
                isRecording 
                  ? 'bg-red-500/20 border-red-500/50 text-red-100 hover:bg-red-500/30' 
                  : 'bg-white/15 border-white/30 text-white hover:bg-white/25'
              }`}
              title={isRecording ? 'Stop recording' : 'Start speaking'}
            >
              {isRecording ? <MicOff className="w-5 h-5 animate-pulse" /> : <Mic className="w-5 h-5" />}
            </button>
          )}
          <button
            onClick={() => handleAISearch(aiQuery)}
            disabled={isAISearching || !aiQuery.trim()}
            className="px-6 py-3.5 rounded-2xl bg-white font-black text-sm hover:bg-white/90 disabled:opacity-60 transition-all flex items-center gap-2 shrink-0"
            style={{ color: 'var(--forest-600)' }}
          >
            {isAISearching ? (
              <div className="w-4 h-4 border-2 border-forest-600 border-t-transparent rounded-full animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4" />
            )}
            <TranslatedText>{isAISearching ? 'Searching...' : 'Find Match'}</TranslatedText>
          </button>
        </div>
      </div>

      {/* ── AI RESULTS (landing page style) ── */}
      {(showAIResults || isAISearching) && (
        <div className="mb-10 relative">
          <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-emerald-500/10 rounded-full blur-[100px] pointer-events-none -z-10" />
          <div className="flex items-center justify-between mb-6 pb-5 border-b border-sage-100">
            <div>
              <span className="pill-badge mb-3 inline-flex bg-emerald-50 text-emerald-700 border-emerald-100/50 items-center gap-1.5 animate-pulse">
                <Sparkles className="w-3.5 h-3.5" />
                <TranslatedText>CLINICAL MATCH INTELLIGENCE</TranslatedText>
              </span>
              <h2 className="headline-md text-forest-900 font-black">
                <TranslatedText>AI Symptom Matches</TranslatedText>
              </h2>
              <p className="body-sm text-forest-600/70 font-medium mt-1">
                <TranslatedText>Real specialists matched precisely to your described symptoms</TranslatedText>
              </p>
            </div>
            <button
              onClick={() => { setShowAIResults(false); setAiResults([]); }}
              className="flex items-center gap-2 px-4 py-2 rounded-full border border-sage-200 bg-white text-xs font-black text-forest-700 hover:bg-sage-50 transition shadow-sm"
            >
              <X className="w-4 h-4 text-forest-500" />
              <TranslatedText>Clear</TranslatedText>
            </button>
          </div>

          {isAISearching ? (
            <div className="py-20 flex flex-col items-center justify-center bg-white rounded-[32px] border border-sage-200/50 shadow-sm">
              <div className="w-12 h-12 border-4 border-sage-100 border-t-forest-600 rounded-full animate-spin mb-4" />
              <p className="text-lg font-black text-forest-800 animate-pulse"><TranslatedText>Synthesizing Clinical AI Matches...</TranslatedText></p>
              <p className="text-xs text-forest-500 font-bold mt-1"><TranslatedText>Analyzing descriptors & scanning specialist directory...</TranslatedText></p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6">
              {aiResults.map((doc, idx) => {
                const realDoc = getMatchedDoctor(doc);
                return (
                  <div
                    key={doc.name + idx}
                    className="bg-white rounded-[32px] border border-sage-200/60 hover:border-emerald-500/40 shadow-sm hover:shadow-[0_24px_56px_rgba(10,40,25,0.06)] transition-all duration-500 overflow-hidden flex flex-col lg:flex-row group cursor-pointer"
                    onClick={() => realDoc && setSelectedDoctor(realDoc)}
                  >
                    {/* Image */}
                    <div className="lg:w-[32%] relative min-h-[240px] lg:min-h-full bg-sage-50 overflow-hidden shrink-0">
                      {doc.profileImageUrl ? (
                        <img
                          src={doc.profileImageUrl}
                          alt={doc.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                          onClick={e => {
                            e.stopPropagation();
                            setEnlargedImage({ url: doc.profileImageUrl!, name: doc.name });
                          }}
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <User className="w-16 h-16 text-forest-300/40" />
                        </div>
                      )}
                      {/* Match badge */}
                      <div className="absolute top-5 left-5 flex items-center gap-1.5 px-4 py-2 bg-emerald-500 text-white rounded-full text-[11px] font-black uppercase tracking-widest shadow-md">
                        <Sparkles className="w-3.5 h-3.5 animate-pulse" />
                        {doc.matchScore}% MATCH
                      </div>
                    </div>

                    {/* Content */}
                    <div className="flex-1 p-7 md:p-9 flex flex-col justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-3 mb-4">
                          <span className="flex items-center gap-1.5 text-xs font-black text-forest-500 uppercase tracking-widest">
                            <Award className="w-4 h-4 text-emerald-500" />
                            {doc.specialization}
                          </span>
                          <span className="text-sage-300 font-bold">•</span>
                          <span className="text-xs font-black text-forest-500 uppercase tracking-widest">
                            {doc.experience} Yrs Experience
                          </span>
                        </div>
                        <h3 className="text-2xl font-black text-forest-900 tracking-wide mb-4 leading-tight group-hover:text-forest-600 transition-colors">
                          {doc.name}
                        </h3>
                        <div className="bg-sage-50/50 border border-sage-100 rounded-2xl p-5 mb-6">
                          <span className="text-[10px] font-black text-emerald-700 uppercase tracking-wider block mb-2">
                            <TranslatedText>Matching Diagnosis Rationale</TranslatedText>
                          </span>
                          <p className="text-[13px] font-semibold text-forest-800 leading-relaxed italic">
                            "{doc.reason}"
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center justify-between border-t border-sage-100 pt-5 gap-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-sage-50 border border-sage-100 flex items-center justify-center">
                            <MapPin className="w-5 h-5 text-forest-400" />
                          </div>
                          <div>
                            <span className="text-[9px] font-black text-forest-400 uppercase tracking-wider block mb-0.5">
                              <TranslatedText>Clinic Location</TranslatedText>
                            </span>
                            <span className="text-sm font-extrabold text-forest-900">{doc.location}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-6 ml-auto flex-wrap">
                          <div className="text-right">
                            <span className="text-[9px] font-black text-forest-400 uppercase tracking-wider block mb-0.5">
                              <TranslatedText>Consultation Fee</TranslatedText>
                            </span>
                            <span className="text-2xl font-black text-forest-900">₹{Number(doc.fee + platformFee).toFixed(2)}</span>
                          </div>
                          <button
                            className="bg-forest-600 hover:bg-forest-700 text-white py-3 px-7 rounded-xl text-xs font-black transition-all shadow-[0_8px_20px_rgba(34,133,74,0.15)] hover:shadow-[0_12px_24px_rgba(34,133,74,0.25)] flex items-center gap-2 hover:scale-105"
                            onClick={e => { e.stopPropagation(); realDoc && setSelectedDoctor(realDoc); }}
                          >
                            <TranslatedText>Book Consultation</TranslatedText>
                            <ArrowRight className="w-4 h-4 animate-pulse" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── ALL DOCTORS LIST ── */}
      {(showAIResults || isAISearching) ? (
        <div className="flex justify-center mt-6">
          <button
            onClick={() => { setShowAIResults(false); setAiResults([]); setAiQuery(''); }}
            className="btn-outline px-8"
          >
            <TranslatedText>Show All Doctors</TranslatedText>
          </button>
        </div>
      ) : (
        <>
          {/* ── FILTERS ── */}
          <div className="rounded-3xl p-4 sm:p-6 mb-6 bg-surface-container-low ambient-shadow">
            <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
              <div className="sm:col-span-2 md:col-span-1">
                <label className="label-md block mb-2" style={{ color: 'var(--on-surface-muted)' }}>
                  <TranslatedText>SEARCH BY NAME OR SPECIALTY</TranslatedText>
                </label>
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-primary" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    placeholder={searchPlaceholder}
                    className="standard-input !pl-10 bg-surface-bright"
                  />
                </div>
              </div>
              <div>
                <label className="label-md block mb-2" style={{ color: 'var(--on-surface-muted)' }}>
                  <TranslatedText>SPECIALIZATIONS</TranslatedText>
                </label>
                <Select value={selectedSpecialization} onValueChange={setSelectedSpecialization}>
                  <SelectTrigger><SelectValue placeholder={allSpecsText} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{allSpecsText}</SelectItem>
                    {allSpecializations.map(spec => (
                      <SelectItem key={spec} value={spec}><TranslatedText>{spec}</TranslatedText></SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="label-md block mb-2" style={{ color: 'var(--on-surface-muted)' }}>
                  <TranslatedText>LOCATION</TranslatedText>
                </label>
                <Select value={selectedCity} onValueChange={setSelectedCity}>
                  <SelectTrigger><SelectValue placeholder={allCitiesText} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{allCitiesText}</SelectItem>
                    {allCities.map(city => (
                      <SelectItem key={city} value={city}>{city}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Results label */}
          <div className="flex flex-wrap items-center justify-between gap-2 mb-6">
            <h2 className="headline-md" style={{ fontFamily: "'Newsreader', serif", fontSize: '1.25rem' }}>
              <TranslatedText>All Practitioners</TranslatedText>
            </h2>
            <span className="label-md" style={{ color: 'var(--on-surface-muted)' }}>
              {filteredDoctors.length} <TranslatedText>results found</TranslatedText>
            </span>
          </div>

          {/* ── DOCTOR GRID (same card style as AIResultsPanel) ── */}
          {filteredDoctors.length === 0 ? (
            <div className="text-center py-20 rounded-3xl" style={{ background: 'var(--sage-50)' }}>
              <User className="w-14 h-14 mx-auto mb-4" style={{ color: 'var(--outline-variant)' }} />
              <p className="body-lg font-semibold" style={{ color: 'var(--on-surface-muted)' }}>
                <TranslatedText>
                  {searchTerm || selectedSpecialization !== 'all' || selectedCity !== 'all'
                    ? 'No doctors found matching your criteria'
                    : 'No doctors are currently available'}
                </TranslatedText>
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6">
              {filteredDoctors.map((doctor) => {
                const specs = doctor.specialization || [];
                const name = doctor.user?.name || 'Doctor';
                const imgUrl = doctor.user?.profileImageUrl;
                const totalFee = Number(doctor.consultationFee || 0) + platformFee;

                return (
                  <div
                    key={doctor.did}
                    className="bg-white rounded-[32px] border border-sage-200/60 hover:border-emerald-500/40 shadow-sm hover:shadow-[0_24px_56px_rgba(10,40,25,0.06)] transition-all duration-500 overflow-hidden flex flex-col lg:flex-row group cursor-pointer"
                    onClick={() => setSelectedDoctor(doctor)}
                  >
                    {/* Image */}
                    <div className="lg:w-[35%] relative min-h-[300px] lg:min-h-full bg-sage-50 overflow-hidden shrink-0">
                      {imgUrl ? (
                        <img
                          src={imgUrl}
                          alt={name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                          onClick={e => {
                            e.stopPropagation();
                            setEnlargedImage({ url: imgUrl, name });
                          }}
                          title="Click to enlarge"
                        />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center gap-2" style={{ background: 'var(--gradient-secondary)' }}>
                          <User className="w-16 h-16" style={{ color: 'var(--primary)', opacity: 0.3 }} />
                        </div>
                      )}
                      {specs[0] && (
                        <div className="absolute bottom-6 left-6 px-4 py-2 rounded-full text-[11px] font-black uppercase tracking-widest shadow-md"
                          style={{ background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(8px)', color: 'var(--forest-700)' }}>
                          {specs[0]}
                        </div>
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 p-8 md:p-10 flex flex-col justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-3 mb-4">
                          <span className="flex items-center gap-1.5 text-xs font-black uppercase tracking-widest" style={{ color: 'var(--forest-500)' }}>
                            <Award className="w-4 h-4 text-emerald-500" />
                            {specs[0] || doctor.qualification || 'General Medicine'}
                          </span>
                          {doctor.yearsOfExperience ? (
                            <>
                              <span className="font-bold" style={{ color: 'var(--sage-300)' }}>•</span>
                              <span className="text-xs font-black uppercase tracking-widest" style={{ color: 'var(--forest-500)' }}>
                                {doctor.yearsOfExperience} Yrs Experience
                              </span>
                            </>
                          ) : null}
                        </div>

                        <h3 className="text-3xl font-black tracking-wide mb-5 leading-tight group-hover:text-forest-600 transition-colors" style={{ color: 'var(--forest-900)', fontFamily: 'var(--font-display)' }}>
                          {name}
                        </h3>

                        {/* Qualification & specs */}
                        <div className="flex flex-wrap gap-1.5 mb-4">
                          {doctor.qualification && (
                            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold" style={{ background: 'var(--sage-100)', color: 'var(--forest-700)' }}>
                              {doctor.qualification}
                            </span>
                          )}
                          {specs.slice(0, 3).map((spec, i) => (
                            <span key={i} className="px-2.5 py-1 rounded-full text-[10px] font-bold" style={{ background: 'var(--sage-100)', color: 'var(--forest-700)' }}>
                              <TranslatedText>{spec}</TranslatedText>
                            </span>
                          ))}
                        </div>

                        {/* Bio / rationale box */}
                        {doctor.bio && (
                          <div className="bg-sage-50/50 border border-sage-100 rounded-2xl p-5 mb-8 relative">
                            <span className="text-[10px] font-black text-emerald-700 uppercase tracking-wider block mb-2">
                              <TranslatedText>Doctor Bio</TranslatedText>
                            </span>
                            <p className="text-[13.5px] font-semibold leading-relaxed italic" style={{ color: 'var(--forest-800)' }}>
                              "{doctor.bio}"
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Footer row */}
                      <div className="flex flex-wrap items-center justify-between border-t border-sage-100 pt-6 gap-6">
                        {/* Location */}
                        {(doctor.city || doctor.state) && (
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-sage-50 border border-sage-100 flex items-center justify-center text-forest-500">
                              <MapPin className="w-5 h-5 text-forest-400" />
                            </div>
                            <div>
                              <span className="text-[9px] font-black text-forest-400 uppercase tracking-wider block leading-none mb-1">
                                <TranslatedText>Clinic Location</TranslatedText>
                              </span>
                              <span className="text-sm font-extrabold text-forest-900 leading-tight">
                                {doctor.city}{doctor.state ? `, ${doctor.state}` : ''}
                              </span>
                            </div>
                          </div>
                        )}

                        {/* Fee + CTA */}
                        <div className="flex items-center gap-8 ml-auto flex-wrap lg:flex-nowrap">
                          <div className="text-right">
                            <span className="text-[9px] font-black text-forest-400 uppercase tracking-wider block mb-0.5">
                              <TranslatedText>Consultation Fee</TranslatedText>
                            </span>
                            <span className="text-2xl font-black text-forest-900 leading-none">₹{Number(totalFee).toFixed(2)}</span>
                          </div>
                          <button
                            className="bg-forest-600 hover:bg-forest-700 text-white py-3.5 px-8 rounded-xl text-xs font-black transition-all shadow-[0_8px_20px_rgba(34,133,74,0.15)] hover:shadow-[0_12px_24px_rgba(34,133,74,0.25)] flex items-center gap-2 hover:scale-105"
                            onClick={e => { e.stopPropagation(); setSelectedDoctor(doctor); }}
                          >
                            <TranslatedText>Book Consultation</TranslatedText>
                            <ArrowRight className="w-4 h-4 animate-pulse" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {filteredDoctors.length > 0 && (
            <div className="flex items-center justify-center mt-10">
              <span className="label-md" style={{ color: 'var(--on-surface-muted)' }}>
                <TranslatedText>SHOWING</TranslatedText> {filteredDoctors.length} <TranslatedText>OF</TranslatedText> {doctors.length} <TranslatedText>PRACTITIONERS</TranslatedText>
              </span>
            </div>
          )}
        </>
      )}
    </div>
  );
}
