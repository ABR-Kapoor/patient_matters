'use client';

import { useState, useEffect, Suspense } from 'react';
import { useUser, useAuth } from '@clerk/nextjs';
import { useRouter, useSearchParams } from 'next/navigation';

import Loading from '@/app/components/Loading';
import CustomCursor from '@/app/components/CustomCursor';
import Footer from '@/app/components/Footer';

// Hook imports
import { useVoiceToText } from '@/app/hooks/useVoiceToText';
import { useLanguage } from '@/app/contexts/LanguageContext';
import { useNameTransliteration } from '@/app/hooks/useNameTransliteration';

// Custom Landing components
import LandingNavbar from '@/app/components/landing/LandingNavbar';
import HeroSection from '@/app/components/landing/HeroSection';
import MarqueeTicker from '@/app/components/landing/MarqueeTicker';
import AIResultsPanel from '@/app/components/landing/AIResultsPanel';
import StatsCounter from '@/app/components/landing/StatsCounter';
import SpecialtiesGrid from '@/app/components/landing/SpecialtiesGrid';
import FeaturedDoctors from '@/app/components/landing/FeaturedDoctors';
import HowItWorks from '@/app/components/landing/HowItWorks';
import FeaturesGrid from '@/app/components/landing/FeaturesGrid';
import ComparisonTable from '@/app/components/landing/ComparisonTable';
import TestimonialsCarousel from '@/app/components/landing/TestimonialsCarousel';
import MissionSection from '@/app/components/landing/MissionSection';
import FAQAccordion from '@/app/components/landing/FAQAccordion';
import CTABand from '@/app/components/landing/CTABand';

interface DoctorRecommendation {
  name: string;
  specialization: string;
  experience: number;
  fee: number;
  location: string;
  // AURASUTRA-REVIEWS:ai_search_real_rating
  // Was `rating: number` (a fresh 4.5-5.0 random per request). The API now
  // sends the real trigger-maintained aggregate, null until reviewed.
  avgRating: number | null;
  totalReviews: number;
  matchScore: number;
  reason: string;
  did?: string;
  profileImageUrl?: string;
}

interface DoctorWithTranslation extends DoctorRecommendation {
  displayName?: string;
}

function LandingOrchestrator() {
  const { translate } = useLanguage();
  const { transliterateName } = useNameTransliteration();
  const [symptoms, setSymptoms] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [doctors, setDoctors] = useState<DoctorWithTranslation[]>([]);
  const { isSignedIn: isAuthenticated, isLoaded } = useAuth();
  const { user } = useUser();
  const isLoading = !isLoaded;
  const [activeTab, setActiveTab] = useState<'home' | 'services' | 'mic' | 'doctors' | 'profile'>('home');
  const router = useRouter();
  const searchParams = useSearchParams();

  // ?search=1 bypass param
  const forceSearch = searchParams?.get('search') === '1';

  const { isRecording, transcript, isSupported, startRecording, stopRecording, resetTranscript } = useVoiceToText();

  useEffect(() => {
    if (transcript) setSymptoms(transcript);
  }, [transcript]);

  const handleVoiceToggle = () => {
    if (isRecording) { 
      stopRecording(); 
    } else { 
      resetTranscript(); 
      setSymptoms(''); 
      startRecording(); 
    }
  };

  // Auto-trigger search when voice recording completes with actual input
  useEffect(() => {
    if (!isRecording && transcript.trim().length > 0) {
      handleAISearch(transcript);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRecording]);

  // Auth redirect logic
  useEffect(() => {
    if (!isLoading && isAuthenticated && !forceSearch) {
      router.push('/dashboard');
    }
  }, [isAuthenticated, isLoading, forceSearch, router]);

  const handleAISearch = async (query = symptoms) => {
    const searchQuery = query.trim();
    if (!searchQuery) return;
    setIsSearching(true);
    try {
      const response = await fetch('/api/ai-doctor-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symptoms: searchQuery }),
      });
      const data = await response.json();
      if (data.success && data.doctors?.length > 0) {
        try {
          const doctorsWithNames = await Promise.all(
            data.doctors.map(async (doc: DoctorRecommendation) => {
              const displayName = await transliterateName(doc.name);
              return { ...doc, displayName };
            })
          );
          setDoctors(doctorsWithNames);
        } catch {
          setDoctors(data.doctors);
        }
      } else if (data.success && data.doctors?.length === 0) {
        translate('No doctors found. Please try describing your symptoms in more detail.').then(msg => alert(msg));
      } else if (data.error) {
        translate(data.error).then(msg => alert(msg));
      }
    } catch {
      translate('Failed to search for doctors. Please try again.').then(msg => alert(msg));
    } finally {
      setIsSearching(false);
    }
  };

  if (isLoading) return <Loading />;

  return (
    <div className="min-h-screen custom-cursor-active bg-surface landing-page-wrapper">
      <CustomCursor />
      
      {/* 1. Navbar */}
      <LandingNavbar />

      {/* 2. Hero Section */}
      <HeroSection 
        symptoms={symptoms}
        setSymptoms={setSymptoms}
        isSearching={isSearching}
        isRecording={isRecording}
        isSupported={isSupported}
        handleVoiceToggle={handleVoiceToggle}
        handleAISearch={handleAISearch}
      />

      {/* 3. Marquee Keyword Ticker */}
      <MarqueeTicker />

      {/* 4. AI Results Panel (conditionally loaded below hero) */}
      <AIResultsPanel 
        doctors={doctors}
        isSearching={isSearching}
        onClear={() => { setDoctors([]); setSymptoms(''); resetTranscript(); }}
        isAuthenticated={isAuthenticated ?? false}
      />

      {/* 5. Animated Stats Counter */}
      <StatsCounter />

      {/* 6. Specialties Grid */}
      <SpecialtiesGrid />

      {/* 7. How It Works Pathway */}
      <HowItWorks />

      {/* 8. Verified Doctors Catalog (Filtered by City & Clinic Size) */}
      <FeaturedDoctors isAuthenticated={isAuthenticated ?? false} />

      {/* 9. Core Tech Capabilities Comparison Grid */}
      <FeaturesGrid />

      {/* 10. Competitor Analysis Feature Matrix */}
      <ComparisonTable />

      {/* 11. Patient Testimonials Swiper */}
      <TestimonialsCarousel />

      {/* 12. Corporate Brand Story & Mission */}
      <MissionSection />

      {/* 13. FAQ Interactive Accordion */}
      <FAQAccordion />

      {/* 14. Action-driven bottom CTABand */}
      <CTABand isAuthenticated={isAuthenticated ?? false} />

      {/* 15. Standardized Footer */}
      <Footer />

      {/* Premium Glassmorphic Mobile Bottom Sticky Bar */}
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 md:hidden w-[92%] max-w-[360px] rounded-[24px] bg-white/90 border border-sage-200/60 backdrop-blur-xl shadow-[0_16px_36px_rgba(10,35,20,0.06)] px-2 py-2 flex items-center justify-around gap-1 transition-all duration-300">
        
        {/* Home */}
        <button 
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="flex flex-col items-center justify-center gap-1 text-forest-600/70 hover:text-forest-900 active:scale-95 smooth-transition px-3 py-1 shrink-0 cursor-pointer"
        >
          <svg className="w-[15px] h-[15px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
          </svg>
          <span className="text-[7.5px] font-black tracking-wider uppercase">Home</span>
        </button>

        {/* Specialities */}
        <button 
          onClick={() => document.getElementById('specialties')?.scrollIntoView({ behavior: 'smooth' })}
          className="flex flex-col items-center justify-center gap-1 text-forest-600/70 hover:text-forest-900 active:scale-95 smooth-transition px-3 py-1 shrink-0 cursor-pointer"
        >
          <svg className="w-[15px] h-[15px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
          <span className="text-[7.5px] font-black tracking-wider uppercase">Services</span>
        </button>

        {/* Pulsing Voice Trigger (Clean Symmetrical Circular Icon) */}
        <button 
          onClick={() => {
            window.scrollTo({ top: 0, behavior: 'smooth' });
            setTimeout(() => {
              handleVoiceToggle();
            }, 300);
          }}
          className={`flex items-center justify-center rounded-full w-[42px] h-[42px] min-w-[42px] min-h-[42px] transition-all duration-300 shrink-0 shadow-[0_6px_16px_rgba(34,133,74,0.25)] border relative cursor-pointer ${
            isRecording 
              ? 'bg-red-500 border border-red-400 text-white scale-105 animate-pulse shadow-red-200' 
              : 'bg-forest-600 border border-forest-500 text-white hover:bg-forest-750 hover:scale-105 active:scale-95'
          }`}
        >
          <svg className="w-[21px] h-[21px] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
          </svg>
          {isRecording && (
            <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-red-600 rounded-full flex items-center justify-center text-[7px] font-black text-white uppercase border border-white animate-ping" />
          )}
        </button>

        {/* AI Doctor Match */}
        <button 
          onClick={() => {
            const el = document.getElementById('doctors') || document.getElementById('ai-results');
            el?.scrollIntoView({ behavior: 'smooth' });
          }}
          className="flex flex-col items-center justify-center gap-1 text-forest-600/70 hover:text-forest-900 active:scale-95 smooth-transition px-3 py-1 shrink-0 cursor-pointer"
        >
          <svg className="w-[15px] h-[15px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          <span className="text-[7.5px] font-black tracking-wider uppercase">Doctors</span>
        </button>

        {/* Dashboard */}
        <a 
          href="/dashboard"
          className="flex flex-col items-center justify-center gap-1 text-forest-600/70 hover:text-forest-900 active:scale-95 smooth-transition px-3 py-1 shrink-0"
        >
          <svg className="w-[15px] h-[15px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
          <span className="text-[7.5px] font-black tracking-wider uppercase">{user?.firstName || 'Profile'}</span>
        </a>

      </div>
    </div>
  );
}

export default function HomePage() {
  return (
    <Suspense fallback={<Loading />}>
      <LandingOrchestrator />
    </Suspense>
  );
}
