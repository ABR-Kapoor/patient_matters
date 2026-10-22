'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { HOW_IT_WORKS } from '@/app/components/landing/constants';
import { TranslatedText } from '@/app/components/TranslatedText';
import { Sparkles, ShieldCheck, CheckCircle2 } from 'lucide-react';

export default function HowItWorks() {
  const containerVariants = {
    hidden: {},
    visible: {
      transition: {
        staggerChildren: 0.15,
      },
    },
  };

  const stepVariants = {
    hidden: { opacity: 0, x: -30 },
    visible: {
      opacity: 1,
      x: 0,
      transition: {
        type: 'spring',
        stiffness: 100,
        damping: 16,
      },
    },
  };

  return (
    <section id="how-it-works" className="py-28 bg-white relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-1/2 left-0 w-[450px] h-[450px] bg-sage-50 rounded-full blur-[110px] pointer-events-none -translate-x-1/2" />
      <div className="absolute bottom-0 right-0 w-[300px] h-[300px] bg-sage-100/30 rounded-full blur-[80px] pointer-events-none translate-x-1/3" />
      
      <div className="max-w-7xl mx-auto px-6 relative z-10">
        <div className="grid lg:grid-cols-12 gap-12 lg:gap-20 items-center">
          
          {/* Left Column: Storytelling Pathway */}
          <div className="lg:col-span-6">
            <span className="pill-badge mb-4 inline-block bg-sage-100 text-forest-700 border-sage-200">
              <TranslatedText>SEAMLESS PATHWAY</TranslatedText>
            </span>
            <TranslatedText
              as="h1"
              className="headline-lg text-forest-900 mb-6"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              Consult a Trusted Specialist in Three Simple Steps
            </TranslatedText>
            <p className="body-md text-forest-600/70 mb-10">
              <TranslatedText>AuraSutra removes scheduling and language friction, allowing you to focus on what matters most — restoring physical and energetic equilibrium.</TranslatedText>
            </p>

            {/* Steps timeline */}
            <motion.div
              variants={containerVariants}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-100px' }}
              className="space-y-8 relative before:absolute before:left-8 before:top-4 before:bottom-4 before:w-0.5 before:bg-sage-100"
            >
              {HOW_IT_WORKS.map((item) => (
                <motion.div
                  key={item.step}
                  variants={stepVariants}
                  className="flex gap-6 relative group"
                >
                  {/* Step number badge circle */}
                  <div 
                    className="w-16 h-16 rounded-2xl flex items-center justify-center relative bg-white border shadow-sm shrink-0 group-hover:scale-105 smooth-transition z-10"
                    style={{ borderColor: 'var(--sage-200)' }}
                  >
                    <div 
                      className="w-10 h-10 rounded-xl flex items-center justify-center"
                      style={{ backgroundColor: 'var(--sage-50)', color: item.color }}
                    >
                      <item.icon className="w-5 h-5" />
                    </div>
                    
                    <span 
                      className="absolute -bottom-1.5 -right-1.5 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black text-white shadow-sm"
                      style={{ backgroundColor: item.color }}
                    >
                      {item.step}
                    </span>
                  </div>

                  {/* Step Description */}
                  <div className="pt-1">
                    <h3 className="text-lg font-bold text-forest-900 mb-1.5 group-hover:text-forest-600 smooth-transition">
                      <TranslatedText>{item.title}</TranslatedText>
                    </h3>
                    <p className="text-xs md:text-sm text-forest-600/70 leading-relaxed font-medium">
                      <TranslatedText>{item.desc}</TranslatedText>
                    </p>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          </div>

          {/* Right Column: Serene Patient Healing Story Graphic */}
          <div className="lg:col-span-6 relative">
            
            {/* Visual Frame */}
            <div className="relative rounded-3xl overflow-hidden shadow-2xl border border-sage-100 bg-sage-50 group hover:scale-[1.01] smooth-transition">
              <img 
                src="/modern_ayush_patient_app.png" 
                alt="AuraSutra Modern Vetted Consultations" 
                className="w-full h-auto object-cover group-hover:scale-105 smooth-transition duration-1000" 
              />
              
              {/* Dark overlay at bottom */}
              <div className="absolute inset-0 bg-gradient-to-t from-forest-950/40 via-transparent to-transparent pointer-events-none" />
            </div>

            {/* Glowing active diagnostic pill badge */}
            <div className="absolute -top-5 -left-5 bg-white rounded-2xl p-4 border border-sage-200 shadow-xl z-20 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-forest-50 flex items-center justify-center text-forest-600 shrink-0 animate-pulse">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <p className="text-[10px] font-black text-forest-900 uppercase tracking-widest leading-none mb-1">Vetted Profiles</p>
                <div className="flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-forest-500 fill-forest-100" />
                  <p className="text-xs font-bold text-forest-600/90">Verified Practitioner</p>
                </div>
              </div>
            </div>

            {/* Float Card at bottom right */}
            <div className="absolute -bottom-6 -right-6 bg-forest-900 text-white rounded-2xl p-5 border border-forest-800 shadow-2xl z-20 max-w-[240px]">
              <div className="flex items-center gap-2 mb-2 text-sage-300">
                <Sparkles className="w-4 h-4 shrink-0 text-sage-400" />
                <p className="text-[9px] font-black tracking-widest uppercase">Raipur regional server</p>
              </div>
              <p className="text-xs font-bold leading-normal text-white">
                <TranslatedText>Active queue tracking is currently live at Nehru Nagar clinics.</TranslatedText>
              </p>
            </div>

          </div>

        </div>
      </div>
    </section>
  );
}
