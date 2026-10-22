'use client';

import React, { useRef, useState } from 'react';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { Sparkles, Mic, MicOff, Loader2, Star, Clock, Stethoscope, ShieldCheck, Heart, Activity, Smile, Search, HelpCircle, Pointer } from 'lucide-react';
import { TranslatedText } from '@/app/components/TranslatedText';
import { QUICK_SYMPTOMS } from '@/app/components/landing/constants';

interface HeroSectionProps {
  symptoms: string;
  setSymptoms: (val: string) => void;
  isSearching: boolean;
  isRecording: boolean;
  isSupported: boolean;
  handleVoiceToggle: () => void;
  handleAISearch: (query?: string) => void;
}

const CLINICAL_CARDS = [
  {
    id: 1,
    image: "/modern_patient_consultation.png",
    title: "Modern Holistic Wellness",
    badge: "Expert Consultation",
    icon: ShieldCheck,
    symptomQuery: "Consult expert doctor for overall holistic lifestyle consultation"
  },
  {
    id: 2,
    image: "/ayurvedic_shirodhara_therapy.png",
    title: "Shirodhara Therapy",
    badge: "Mental Wellness",
    icon: Smile,
    symptomQuery: "Calming Shirodhara treatment for severe anxiety and stress relief"
  },
  {
    id: 3,
    image: "/homeopathic_treatment_bottles.png",
    title: "Homeopathic Care",
    badge: "Natural Remedies",
    icon: Heart,
    symptomQuery: "Homeopathic cure for chronic acidity and severe migraines"
  }
];

export default function HeroSection({
  symptoms,
  setSymptoms,
  isSearching,
  isRecording,
  isSupported,
  handleVoiceToggle,
  handleAISearch,
}: HeroSectionProps) {
  
  // Interactive 3D Parallax Mouse Tracking
  const containerRef = useRef<HTMLDivElement>(null);
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  const [activeCardIndex, setActiveCardIndex] = useState(0);

  const handleMouseMove = (e: React.MouseEvent) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    
    // Relative coordinates from center of the container
    const xVal = e.clientX - rect.left - width / 2;
    const yVal = e.clientY - rect.top - height / 2;
    
    mouseX.set(xVal);
    mouseY.set(yVal);
  };

  const handleMouseLeave = () => {
    mouseX.set(0);
    mouseY.set(0);
  };

  // spring physics mappings for smooth, high-fidelity responsive motions
  const rotateX = useSpring(useTransform(mouseY, [-200, 200], [6, -6]), { damping: 30, stiffness: 150 });
  const rotateY = useSpring(useTransform(mouseX, [-200, 200], [-6, 6]), { damping: 30, stiffness: 150 });

  const badgeX = useSpring(useTransform(mouseX, [-200, 200], [15, -15]), { damping: 25, stiffness: 120 });
  const badgeY = useSpring(useTransform(mouseY, [-200, 200], [15, -15]), { damping: 25, stiffness: 120 });

  const handleCardClick = (index: number) => {
    // If the user clicks the card that is already in front, shuffle the deck to the next card
    if (activeCardIndex === index) {
      const nextIndex = (activeCardIndex + 1) % CLINICAL_CARDS.length;
      setActiveCardIndex(nextIndex);
      setSymptoms(CLINICAL_CARDS[nextIndex].symptomQuery);
    } else {
      // If clicking a background card, bring it directly to the front
      setActiveCardIndex(index);
      setSymptoms(CLINICAL_CARDS[index].symptomQuery);
    }
  };

  const getCardStyle = (relativeIndex: number) => {
    switch(relativeIndex) {
      case 0: return { x: '5%', y: '0%', scale: 1, zIndex: 30, opacity: 1, rotate: 0 };
      case 1: return { x: '15%', y: '12%', scale: 0.95, zIndex: 20, opacity: 0.85, rotate: 2 };
      case 2: return { x: '-2%', y: '22%', scale: 0.9, zIndex: 10, opacity: 0.6, rotate: -2 };
      default: return { x: '0%', y: '0%', scale: 1, zIndex: 0, opacity: 0, rotate: 0 };
    }
  };

  return (
    <section className="relative pt-10 pb-16 px-6 md:px-12 max-w-[1440px] mx-auto overflow-hidden">
      
      {/* Background glowing organic mesh gradients */}
      <div className="absolute top-6 right-20 w-[550px] h-[550px] bg-forest-100/15 rounded-full blur-[130px] pointer-events-none -z-10 animate-pulse duration-[14s]" />
      <div className="absolute bottom-5 left-10 w-[450px] h-[450px] bg-sage-200/25 rounded-full blur-[110px] pointer-events-none -z-10" />

      <div className="grid lg:grid-cols-12 gap-10 lg:gap-14 items-center">
        
        {/* Left Column: Symptoms Entry Console */}
        <div className="lg:col-span-7 flex flex-col items-start text-left relative z-25">
          
          {/* Conversational Pill Tag */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full mb-4 bg-white/90 border border-sage-200/70 shadow-[0_2px_12px_rgba(20,40,30,0.02)] backdrop-blur-sm group hover:scale-[1.02] smooth-transition">
            <span className="flex h-1.5 w-1.5 relative shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-forest-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-forest-500"></span>
            </span>
            <span className="text-[9px] font-black tracking-[0.15em] text-forest-700 uppercase">
              <TranslatedText>Conversational AI Directory</TranslatedText>
            </span>
          </div>

          {/* Heading */}
          <div className="mb-4 animate-fade-in-up flex flex-col items-start">
            <TranslatedText 
              as="h1"
              className="text-4xl md:text-5xl lg:text-[4.2rem] font-display text-forest-900 leading-[1.06] tracking-tight"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              Describe symptoms.
            </TranslatedText>
            <h1 
              className="text-4xl md:text-5xl lg:text-[4.2rem] font-display text-forest-900 leading-[1.06] tracking-tight animate-fade-in-up"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              <TranslatedText>Find your</TranslatedText> <span style={{ color: '#1D6B3C' }}><TranslatedText>perfect doctor.</TranslatedText></span>
            </h1>
          </div>

          <div className="text-xs md:text-sm text-forest-700/80 max-w-[500px] mb-3 md:mb-7 leading-relaxed font-medium space-y-3">
            {/* <p>
              <TranslatedText>Forget complex medical terms. Whether it's a minor ache or a chronic condition, describe every little detail of how you're feeling in your own words.</TranslatedText>
            </p> */}
            {isSupported && (
              <div 
                className="hidden md:flex items-center gap-2.5 p-2.5 rounded-xl bg-sage-50/80 border border-sage-200/50 backdrop-blur-sm group cursor-pointer hover:bg-sage-100/80 hover:border-sage-300 smooth-transition w-fit animate-fade-in-up" 
                onClick={handleVoiceToggle}
              >
                <div className={`w-7 h-7 rounded-lg bg-white border flex items-center justify-center shrink-0 shadow-sm group-hover:scale-105 smooth-transition ${isRecording ? 'border-red-200 ring-2 ring-red-500/20' : 'border-sage-200'}`}>
                  {isRecording ? <MicOff className="w-3.5 h-3.5 text-red-500 animate-pulse" /> : <Mic className="w-3.5 h-3.5 text-forest-600" />}
                </div>
                <span className={`font-bold text-[11px] md:text-xs pr-2 ${isRecording ? 'text-red-600' : 'text-forest-800'}`}>
                  <TranslatedText>{isRecording ? "Listening to your symptoms..." : "Tap the mic and simply speak your symptoms!"}</TranslatedText>
                </span>
              </div>
            )}
          </div>

          {/* AI Symptom Search Console Box */}
          <div className="w-full rounded-2xl p-3 sm:p-5 md:p-6 bg-white border-t-4 border-t-forest-500 border-x border-b border-sage-200/50 shadow-[0_24px_48px_-12px_rgba(10,40,25,0.06)] relative z-20 group hover:shadow-[0_32px_56px_-12px_rgba(10,40,25,0.1)] smooth-transition">
            
            {/* Sleek Clinical Header */}
            <div className="flex items-center justify-between mb-2.5 sm:mb-4 pb-2 sm:pb-3 border-b border-sage-100">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-lg bg-forest-50 flex items-center justify-center text-forest-500 shrink-0">
                  <Search className="w-4.5 h-4.5" />
                </div>
                <div>
                  <p className="text-[10px] sm:text-[11px] font-black text-forest-900 uppercase tracking-widest block leading-none mb-0.5">
                    <span className="md:hidden">AI Practitioner Match</span>
                    <span className="hidden md:inline">AI-Powered Directory Search</span>
                  </p>
                  <p className="text-[8px] sm:text-[9px] font-bold text-forest-400/80 uppercase tracking-wider block">
                    <span className="md:hidden">Secured & Private</span>
                    <span className="hidden md:inline">Secured & Private directory matching</span>
                  </p>
                </div>
              </div>
              
              <span className="text-[9px] sm:text-[10px] font-black text-forest-600 uppercase tracking-widest bg-sage-50 px-2.5 sm:px-3 py-1 rounded-lg border border-sage-200/40 flex items-center gap-1.5 shrink-0">
                <Activity className="w-3 h-3 text-forest-500 animate-pulse" />
                <span className="md:hidden">Live</span>
                <span className="hidden md:inline">Live Matching</span>
              </span>
            </div>

            {/* Styled Textarea Box */}
            <div className="bg-sage-50/20 rounded-xl p-2.5 sm:p-3 md:p-4 border border-sage-100 hover:border-sage-200 focus-within:border-forest-300 focus-within:bg-white focus-within:shadow-[0_0_0_3px_rgba(34,133,74,0.04)] smooth-transition">
              <textarea
                value={symptoms}
                onChange={(e) => setSymptoms(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    if (!isSearching && symptoms.trim()) handleAISearch();
                  }
                }}
                placeholder="e.g. 'Severe back pain with stiffness in the morning' or 'पेट में दर्द और एसिडिटी...'"
                className="w-full bg-transparent outline-none resize-none text-[13px] sm:text-sm font-semibold leading-relaxed text-forest-900 placeholder:text-forest-400/45 min-h-[55px] sm:min-h-[65px] md:min-h-[75px]"
                disabled={isSearching || isRecording}
                rows={3}
              />
            </div>

            <div className="flex items-center justify-between mt-2.5 sm:mt-4 pt-0 sm:pt-1">
              {/* Voice recording indicators */}
              <div>
                {isRecording ? (
                  <div className="flex items-center gap-2 text-[10px] sm:text-[11px] font-bold text-red-600 bg-red-50 px-3 py-1 rounded-lg border border-red-100 shadow-sm animate-pulse">
                    <span className="w-2 h-2 bg-red-500 rounded-full animate-ping shrink-0" />
                    <span>Listening...</span>
                  </div>
                ) : (
                  <div className="text-[9px] sm:text-[10px] font-black text-forest-400 tracking-wider flex items-center gap-1.5 uppercase">
                    <Smile className="w-3.5 h-3.5 text-forest-400 shrink-0" />
                    <span className="hidden sm:inline">Hindi & English AI Match</span>
                    <span className="inline sm:hidden">AI Match</span>
                  </div>
                )}
              </div>

              {/* Controls buttons */}
              <div className="flex items-center gap-2">
                {isSupported && (
                  <button
                    onClick={handleVoiceToggle}
                    className={`hidden sm:flex w-9 h-9 rounded-lg border smooth-transition items-center justify-center shrink-0 shadow-sm ${
                      isRecording 
                        ? 'bg-red-500 border-red-500 text-white shadow-red-200 shadow-lg scale-105 animate-pulse' 
                        : 'bg-sage-50 border-sage-200 text-forest-700 hover:bg-sage-100/80 hover:border-sage-300 hover:scale-105'
                    }`}
                    title={isRecording ? 'Stop Recording' : 'Voice Input'}
                  >
                    {isRecording ? <MicOff className="w-4 h-4 shrink-0" /> : <Mic className="w-4 h-4 shrink-0" />}
                  </button>
                )}

                <button
                  onClick={() => handleAISearch()}
                  disabled={isSearching || !symptoms.trim()}
                  className="bg-gradient-to-r from-forest-600 to-forest-500 hover:from-forest-700 hover:to-forest-600 text-white font-extrabold px-6 py-2.5 rounded-lg text-[11px] sm:text-xs flex items-center gap-1.5 smooth-transition shadow-[0_2px_12px_rgba(34,133,74,0.15)] hover:shadow-[0_4px_16px_rgba(34,133,74,0.25)] hover:scale-[1.02] active:scale-[0.98] border-none shrink-0"
                >
                  {isSearching ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5 shrink-0" />
                      <span>Find Doctors</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Quick chips below console */}
          <div className="flex flex-wrap items-center gap-2 mt-5 w-full">
            <span className="text-[10px] font-black text-forest-400 uppercase tracking-widest flex items-center gap-1 shrink-0">
              <HelpCircle className="w-3.5 h-3.5 text-forest-400" />
              Symptom Chips:
            </span>
            {QUICK_SYMPTOMS.slice(0, 5).map((sym) => (
              <button
                key={sym}
                onClick={() => { setSymptoms(sym); handleAISearch(sym); }}
                className="px-3.5 py-1.5 rounded-full border border-sage-200/40 bg-white text-xs font-bold text-forest-700 shadow-[0_1px_4px_rgba(20,40,30,0.02)] hover:bg-forest-600 hover:text-white hover:border-forest-600 hover:scale-105 smooth-transition"
              >
                {sym}
              </button>
            ))}
          </div>

        </div>

        {/* Right Column: Interactive Deck Stack */}
        <div 
          ref={containerRef}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          className="lg:col-span-5 relative h-[420px] hidden lg:block"
          style={{ perspective: 1200 }}
        >
          {/* Interaction Hint */}
          <div className="absolute -top-4 right-4 text-[9px] font-black text-forest-500 uppercase tracking-widest flex items-center gap-1.5 animate-pulse bg-sage-50/80 px-3 py-1.5 rounded-full border border-sage-200/50 backdrop-blur-sm z-40">
            <Pointer className="w-3.5 h-3.5" />
            Click cards to shuffle
          </div>

          {/* Ambient Glow backing card that moves with cursor */}
          <motion.div
            style={{ rotateX, rotateY }}
            className="absolute inset-4 bg-gradient-to-tr from-forest-500/10 to-sage-400/20 rounded-[32px] blur-3xl pointer-events-none -z-10 smooth-transition"
          />

          <motion.div 
            style={{ rotateX, rotateY }} 
            className="relative w-full h-full cursor-image-hover"
          >
            {CLINICAL_CARDS.map((card, i) => {
              const relativeIndex = (i - activeCardIndex + CLINICAL_CARDS.length) % CLINICAL_CARDS.length;
              const isActive = relativeIndex === 0;
              const style = getCardStyle(relativeIndex);
              const Icon = card.icon;

              return (
                <motion.div
                  key={card.id}
                  animate={style}
                  transition={{ type: "spring", stiffness: 300, damping: 25 }}
                  onClick={() => handleCardClick(i)}
                  className={`absolute top-8 w-[80%] rounded-[24px] overflow-hidden shadow-2xl border border-sage-200/60 bg-white/80 backdrop-blur-sm p-2 cursor-pointer group ${isActive ? 'hover:border-forest-400 ring-2 ring-forest-500/20' : 'hover:border-sage-400'}`}
                >
                  <div className="rounded-[18px] overflow-hidden aspect-[4/3] relative">
                    <img 
                      src={card.image} 
                      alt={card.title}
                      className="w-full h-full object-cover group-hover:scale-105 smooth-transition duration-700"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-forest-950/40 to-transparent pointer-events-none" />
                  </div>
                  <div className="mt-3 mb-1 px-2 flex justify-between items-center">
                    <span className="flex items-center gap-1.5 text-[10px] font-black text-forest-900 uppercase tracking-wider">
                      <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-forest-600' : 'text-sage-500'}`} />
                      {card.title}
                    </span>
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-lg border ${isActive ? 'text-forest-600 bg-forest-50 border-forest-100' : 'text-sage-600 bg-sage-50 border-sage-100'}`}>
                      {card.badge}
                    </span>
                  </div>
                </motion.div>
              );
            })}
            
            {/* Floating Vitals Badge (2D Parallax) */}
            <motion.div 
              style={{
                x: badgeX,
                y: badgeY,
              }}
              className="absolute top-[42%] -left-3 bg-white rounded-xl p-3 border border-sage-200/80 shadow-2xl z-50 flex items-center gap-2.5 pointer-events-none"
            >
              <div className="w-8 h-8 rounded-lg bg-forest-50 flex items-center justify-center text-forest-600 shrink-0">
                <Stethoscope className="w-4.5 h-4.5 text-forest-500" />
              </div>
              <div>
                    <p className="text-[9px] font-black text-forest-900 uppercase tracking-widest leading-none mb-0.5">Secure Match</p>
                <span className="text-[9.5px] font-bold text-forest-500 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-forest-500 animate-ping" />
                  100% Private
                </span>
              </div>
            </motion.div>
          </motion.div>

        </div>

      </div>

      {/* Trust factors bottom strip */}
      <div className="flex items-center justify-start gap-8 md:gap-12 mt-12 flex-wrap opacity-95">
        {[
          { icon: ShieldCheck, text: 'Verified Local Directory' },
          { icon: Star, text: '100% Private & Encrypted' },
          { icon: Clock, text: 'Instant OPD Queue Slots' },
        ].map(({ icon: Icon, text }) => (
          <div key={text} className="flex items-center gap-2 text-xs font-bold text-forest-800 bg-white/40 border border-sage-100/60 px-3.5 py-1.5 rounded-full shadow-sm hover:bg-white hover:shadow-md hover:scale-105 smooth-transition">
            <Icon className="w-4 h-4 text-forest-500 shrink-0" />
            <span><TranslatedText>{text}</TranslatedText></span>
          </div>
        ))}
      </div>

    </section>
  );
}
