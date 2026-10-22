'use client';

import React, { useRef, useEffect, useState } from 'react';
import { Award, MapPin, ArrowRight, Sparkles, X, User } from 'lucide-react';
import { SignInButton } from '@clerk/nextjs';
import { TranslatedText } from '@/app/components/TranslatedText';

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

interface AIResultsPanelProps {
  doctors: DoctorRecommendation[];
  isSearching: boolean;
  onClear: () => void;
  isAuthenticated: boolean;
}

export default function AIResultsPanel({ doctors, isSearching, onClear, isAuthenticated }: AIResultsPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [platformFee, setPlatformFee] = useState<number>(20);

  useEffect(() => {
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
  }, []);

  // Auto-scroll logic when results are loaded or search begins
  useEffect(() => {
    if (isSearching) {
      setTimeout(() => {
        panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 50);
    } else if (doctors.length > 0) {
      setTimeout(() => {
        panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    }
  }, [doctors, isSearching]);

  if (doctors.length === 0 && !isSearching) return null;

  return (
    <section 
      id="ai-results" 
      ref={panelRef} 
      className="py-24 bg-gradient-to-b from-sage-50/50 to-white relative overflow-hidden border-b border-sage-100"
    >
      {/* Premium organic glows */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-emerald-500/10 rounded-full blur-[120px] pointer-events-none -z-10" />
      <div className="absolute bottom-0 left-0 w-[550px] h-[550px] bg-forest-500/5 rounded-full blur-[140px] pointer-events-none -z-10" />

      <div className="max-w-7xl mx-auto px-6 relative z-10 w-full">
        
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12 border-b border-sage-100/60 pb-8">
          <div>
            <span className="pill-badge mb-4 inline-flex bg-emerald-50 text-emerald-700 border-emerald-100/50 items-center gap-1.5 animate-pulse">
              <Sparkles className="w-3.5 h-3.5" />
              <TranslatedText>SMART DIRECTORY MATCH</TranslatedText>
            </span>
            <h2 className="headline-lg text-forest-900 mb-2 font-black" style={{ fontFamily: 'var(--font-display)' }}>
              <TranslatedText>Vetted AI Symptom Matches</TranslatedText>
            </h2>
            <p className="body-md text-forest-600/70 max-w-xl font-medium">
              <TranslatedText>Real local vetted specialists loaded from our directory, mapped precisely to your described issues.</TranslatedText>
            </p>
          </div>
          
          <button 
            onClick={onClear}
            className="flex items-center gap-2 px-4 py-2 rounded-full border border-sage-200 bg-white text-xs font-black text-forest-700 hover:bg-sage-50 smooth-transition shadow-sm active:scale-95 shrink-0"
          >
            <X className="w-4 h-4 text-forest-500" />
            <TranslatedText>Clear Search</TranslatedText>
          </button>
        </div>

        {isSearching ? (
          <div className="py-28 flex flex-col items-center justify-center bg-white rounded-[32px] border border-sage-200/50 shadow-[0_16px_40px_rgba(20,40,30,0.04)]">
            <div className="w-12 h-12 border-4 border-sage-100 border-t-forest-600 rounded-full animate-spin mb-4" />
            <p className="text-[17px] font-black text-forest-800 animate-pulse">Finding Your Best Matches...</p>
            <p className="text-xs text-forest-500 font-bold mt-1">Scanning verified practitioners in your area...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-8">
            {doctors.map((doctor, index) => (
              <div 
                key={doctor.name + index}
                className="bg-white rounded-[32px] border border-sage-200/60 hover:border-emerald-500/40 shadow-sm hover:shadow-[0_24px_56px_rgba(10,40,25,0.06)] transition-all duration-500 overflow-hidden flex flex-col lg:flex-row group"
              >
                {/* Full-Bleed Image Section */}
                <div className="lg:w-[35%] relative min-h-[300px] lg:min-h-full bg-sage-50 overflow-hidden shrink-0">
                  {doctor.profileImageUrl ? (
                    <img 
                      src={doctor.profileImageUrl} 
                      alt={doctor.name} 
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out" 
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <User className="w-16 h-16 text-forest-300/40" />
                    </div>
                  )}
                  
                  {/* AI Match Badge */}
                  <div className="absolute top-6 left-6 flex items-center gap-1.5 px-4 py-2 bg-emerald-500 text-white rounded-full text-[11px] font-black uppercase tracking-widest shadow-md">
                    <Sparkles className="w-3.5 h-3.5 animate-pulse" />
                    {doctor.matchScore}% MATCH
                  </div>
                </div>

                {/* Info & Content Section */}
                <div className="flex-1 p-8 md:p-10 flex flex-col justify-between">
                  <div>
                    {/* Specialty & Exp Pill Row */}
                    <div className="flex flex-wrap items-center gap-3 mb-4">
                      <span className="flex items-center gap-1.5 text-xs font-black text-forest-500 uppercase tracking-widest">
                        <Award className="w-4 h-4 text-emerald-500" />
                        {doctor.specialization}
                      </span>
                      <span className="text-sage-300 font-bold">•</span>
                      <span className="text-xs font-black text-forest-500 uppercase tracking-widest">
                        {doctor.experience} Yrs Experience
                      </span>
                    </div>

                    {/* Doctor Name */}
                    <h3 className="text-3xl font-black text-forest-900 tracking-wide mb-5 leading-tight group-hover:text-forest-600 smooth-transition">
                      {doctor.name}
                    </h3>

                    {/* Premium Diagnosis Reasoning Box */}
                    <div className="bg-sage-50/50 border border-sage-100 rounded-2xl p-5 mb-8 relative">
                      <span className="text-[10px] font-black text-emerald-700 uppercase tracking-wider block mb-2">Match Rationale</span>
                      <p className="text-[13.5px] font-semibold text-forest-800 leading-relaxed italic">
                        "{doctor.reason}"
                      </p>
                    </div>
                  </div>

                  {/* Pricing / Location & Action Row */}
                  <div className="flex flex-wrap items-center justify-between border-t border-sage-100 pt-6 gap-6">
                    
                    {/* Location */}
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-sage-50 border border-sage-100 flex items-center justify-center text-forest-500">
                        <MapPin className="w-5 h-5 text-forest-400" />
                      </div>
                      <div>
                        <span className="text-[9px] font-black text-forest-400 uppercase tracking-wider block leading-none mb-1">Clinic Location</span>
                        <span className="text-sm font-extrabold text-forest-900 leading-tight">{doctor.location}</span>
                      </div>
                    </div>

                    {/* Action buttons & Fee */}
                    <div className="flex items-center gap-8 ml-auto flex-wrap lg:flex-nowrap">
                      <div className="text-right">
                        <span className="text-[9px] font-black text-forest-400 uppercase tracking-wider block mb-0.5">Consultation Fee</span>
                        <span className="text-2xl font-black text-forest-900 leading-none">₹{Number(doctor.fee + platformFee).toFixed(2)}</span>
                        <span className="text-[9px] font-bold text-forest-500/70 block mt-1">Includes platform fee</span>
                      </div>

                      {isAuthenticated ? (
                        <a 
                          href="/dashboard"
                          className="bg-forest-600 hover:bg-forest-700 text-white py-3.5 px-8 rounded-xl text-xs font-black transition-all shadow-[0_8px_20px_rgba(34,133,74,0.15)] hover:shadow-[0_12px_24px_rgba(34,133,74,0.25)] flex items-center gap-2 hover:scale-105"
                        >
                          Book Consultation <ArrowRight className="w-4 h-4 animate-pulse" />
                        </a>
                      ) : (
                        <SignInButton mode="redirect">
                          <button
                            className="bg-forest-600 hover:bg-forest-700 text-white py-3.5 px-8 rounded-xl text-xs font-black transition-all shadow-[0_8px_20px_rgba(34,133,74,0.15)] hover:shadow-[0_12px_24px_rgba(34,133,74,0.25)] flex items-center gap-2 hover:scale-105"
                          >
                            Book Consultation <ArrowRight className="w-4 h-4 animate-pulse" />
                          </button>
                        </SignInButton>
                      )}
                    </div>

                  </div>
                </div>

              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
