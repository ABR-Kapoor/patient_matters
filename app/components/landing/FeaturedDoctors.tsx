'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Star, Award, MapPin, User, ArrowRight, ArrowLeft } from 'lucide-react';
import { FEATURED_DOCTORS, PLATFORM_FEE } from '@/app/components/landing/constants';
import { TranslatedText } from '@/app/components/TranslatedText';
import { SignInButton } from '@clerk/nextjs';

export default function FeaturedDoctors({ isAuthenticated }: { isAuthenticated: boolean }) {
  const [selectedCity, setSelectedCity] = useState<'All' | 'Raipur' | 'Bhilai'>('All');
  const [selectedSize, setSelectedSize] = useState<'All' | 'Micro' | 'Small' | 'Medium'>('All');
  const [sustainedCard, setSustainedCard] = useState<string | null>(null);
  const [platformFee, setPlatformFee] = useState<number>(PLATFORM_FEE);

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

  // Filter logic
  const filteredDoctors = FEATURED_DOCTORS.filter(doc => {
    const cityMatch = selectedCity === 'All' || doc.city === selectedCity;
    const sizeMatch = selectedSize === 'All' || doc.size === selectedSize;
    return cityMatch && sizeMatch;
  });

  return (
    <section id="doctors" className="py-24 bg-sage-50/30 relative overflow-hidden">
      {/* Background radial highlight */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-sage-200/20 rounded-full blur-[120px] pointer-events-none" />

      <div className="max-w-7xl mx-auto px-6 relative z-10">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
          <div>
            <span className="pill-badge mb-4 inline-block bg-sage-100 text-forest-700 border-sage-200">
              <TranslatedText>FEATURED EXPERTS</TranslatedText>
            </span>
            <TranslatedText
              as="h1"
              className="headline-lg text-forest-900 mb-2"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              Vetted Clinical Specialists
            </TranslatedText>
            <p className="body-md text-forest-600/70 max-w-md">
              <TranslatedText>Directly book consults with renowned practitioners across Raipur & Bhilai, filtered by clinic size.</TranslatedText>
            </p>
          </div>

          {/* Filter Toggles */}
          <div className="flex flex-wrap gap-3">
            {/* City Filter */}
            <div className="flex bg-white rounded-full p-1 border border-sage-200 shadow-sm">
              {(['All', 'Raipur', 'Bhilai'] as const).map(city => (
                <button
                  key={city}
                  onClick={() => setSelectedCity(city)}
                  className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${
                    selectedCity === city
                      ? 'bg-forest-600 text-white shadow-sm'
                      : 'text-forest-600 hover:bg-sage-50'
                  }`}
                >
                  <TranslatedText>{city}</TranslatedText>
                </button>
              ))}
            </div>

            {/* Size Filter */}
            <div className="flex bg-white rounded-full p-1 border border-sage-200 shadow-sm">
              {(['All', 'Micro', 'Small', 'Medium'] as const).map(size => (
                <button
                  key={size}
                  onClick={() => setSelectedSize(size)}
                  className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${
                    selectedSize === size
                      ? 'bg-forest-600 text-white shadow-sm'
                      : 'text-forest-600 hover:bg-sage-50'
                  }`}
                >
                  <TranslatedText>{size}</TranslatedText>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Doctor Grid with Framer Motion reshuffling */}
        <motion.div 
          layout
          className="grid grid-cols-1 md:grid-cols-3 gap-6"
        >
          <AnimatePresence mode="popLayout">
            {filteredDoctors.slice(0, 6).map((doc) => (
              <motion.div
                layout
                key={doc.name}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.4, type: 'spring', stiffness: 120, damping: 14 }}
                onClick={() => setSustainedCard(sustainedCard === doc.name ? null : doc.name)}
                className="relative rounded-[24px] overflow-hidden shadow-[0_8px_30px_rgba(20,40,30,0.08)] flex flex-col min-h-[440px] group transition-all duration-300 cursor-pointer"
              >
                {/* Full Image Background */}
                <div className="absolute inset-0 z-0 bg-sage-200">
                  {doc.img ? (
                    <img 
                      src={doc.img} 
                      alt={doc.name} 
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out" 
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <User className="w-16 h-16 text-forest-300/50" />
                    </div>
                  )}
                  {/* Dark gradient overlay for text readability - Adjusts on click to protect name legibility */}
                  <div className={`absolute inset-0 bg-gradient-to-t transition-opacity duration-500 ${sustainedCard === doc.name ? 'from-black/80 via-transparent to-transparent opacity-100' : 'from-black/95 via-black/50 to-transparent opacity-100'}`} />
                  
                  {/* Interaction Hint (Only shows when image is isolated) */}
                  <div className={`absolute top-4 right-4 bg-black/40 backdrop-blur-md px-3 py-1.5 rounded-full text-white text-[10px] font-bold tracking-wide transition-opacity duration-500 border border-white/20 ${sustainedCard === doc.name ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
                    Tap to view details
                  </div>
                </div>

                {/* Content Overlay */}
                <div className="relative z-10 flex flex-col justify-end h-full p-6">
                  
                  {/* Header - ALWAYS visible, never hides */}
                  <div className="transition-transform duration-500">
                    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white/20 backdrop-blur-md rounded-full border border-white/20 text-white text-[10px] font-black uppercase tracking-widest shadow-sm w-fit mb-3">
                      <Award className="w-3.5 h-3.5 drop-shadow-md" />
                      <span className="drop-shadow-md">{doc.spec}</span>
                    </div>
                    <h3 className="text-[26px] font-black text-white leading-tight drop-shadow-lg">
                      {doc.name}
                    </h3>
                    <div className="mt-3 flex items-baseline gap-1">
                      <span className="text-[10px] font-bold text-sage-200 uppercase tracking-wider">Consultation Fee</span>
                      <span className="text-xl font-black text-white drop-shadow-lg">₹{Number(doc.fee + platformFee).toFixed(2)}</span>
                    </div>
                  </div>

                  {/* Details Block (Hides on click) */}
                  <div className={`overflow-hidden transition-all duration-500 ease-in-out ${sustainedCard === doc.name ? 'max-h-0 opacity-0 mt-0 pointer-events-none' : 'max-h-[300px] opacity-100 mt-5'}`}>
                    
                    <div className="bg-white/10 backdrop-blur-md rounded-xl p-4 border border-white/20 mb-4">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-[13px] font-bold text-white drop-shadow-sm">{doc.clinic}</p>
                        <span className="text-[8px] font-black text-sage-200 bg-black/30 border border-white/10 px-1.5 py-0.5 rounded backdrop-blur-sm">
                          Reg: CG-20{30 - doc.exp}
                        </span>
                      </div>
                      <p className="text-[11px] font-medium text-sage-200/90 flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-sage-300" />
                        {doc.city}, CG · {doc.exp} yrs exp
                      </p>
                    </div>

                    {/* Doctor Bio Description instead of OPD Queue */}
                    <div className="mb-5 px-1">
                      <p className="text-[12px] text-sage-100/90 leading-relaxed font-semibold line-clamp-2 drop-shadow-sm italic">
                        "{doc.bio}"
                      </p>
                    </div>

                    <div className="flex items-end justify-end border-t border-white/20 pt-4">

                      {isAuthenticated ? (
                        <a 
                          href="/dashboard"
                          onClick={(e) => e.stopPropagation()}
                          className="bg-forest-500 hover:bg-forest-400 text-white py-3 px-6 rounded-xl text-sm font-black transition-colors shadow-[0_8px_20px_rgba(34,133,74,0.3)] flex items-center gap-2 hover:scale-105"
                        >
                          Book Now <ArrowRight className="w-4 h-4" />
                        </a>
                      ) : (
                        <SignInButton mode="redirect">
                          <button
                            onClick={(e) => e.stopPropagation()}
                            className="bg-forest-500 hover:bg-forest-400 text-white py-3 px-6 rounded-xl text-sm font-black transition-colors shadow-[0_8px_20px_rgba(34,133,74,0.3)] flex items-center gap-2 hover:scale-105"
                          >
                            Book Now <ArrowRight className="w-4 h-4" />
                          </button>
                        </SignInButton>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>

        {filteredDoctors.length === 0 && (
          <div className="text-center py-12 bg-white rounded-2xl border border-sage-100/60 shadow-sm mt-6">
            <p className="text-sm font-bold text-forest-500 mb-2">No clinics or doctors matching these filters.</p>
            <button 
              onClick={() => { setSelectedCity('All'); setSelectedSize('All'); }}
              className="text-xs font-bold text-forest-600 underline"
            >
              Reset Filters
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
