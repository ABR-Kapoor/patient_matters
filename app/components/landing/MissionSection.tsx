'use client';

import React from 'react';
import { Leaf, Award, ShieldCheck, Heart } from 'lucide-react';
import { TranslatedText } from '@/app/components/TranslatedText';

export default function MissionSection() {
  return (
    <section id="about" className="py-24 bg-white relative overflow-hidden">
      {/* Accent gradient in background */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-sage-100/30 rounded-full blur-[100px] pointer-events-none" />

      <div className="max-w-7xl mx-auto px-6 relative z-10">
        <div className="grid md:grid-cols-2 gap-12 md:gap-20 items-center">
          {/* Visual Stack */}
          <div className="relative">
            <div className="rounded-3xl overflow-hidden aspect-[4/3] shadow-md border border-sage-100 bg-sage-50 relative z-10">
              <img 
                src="/luxury_ayurveda_panchakarma.png" 
                alt="Ayurvedic Wellness & Panchakarma" 
                className="w-full h-full object-cover group-hover:scale-105 smooth-transition duration-700" 
              />
            </div>
            
            {/* Float Card */}
            <div className="absolute -bottom-6 -right-6 bg-white rounded-2xl p-5 border border-sage-200 shadow-xl z-20 max-w-[220px]">
              <div className="w-9 h-9 rounded-lg bg-sage-100 flex items-center justify-center text-forest-600 mb-3">
                <Leaf className="w-5 h-5" />
              </div>
              <p className="text-xs font-black text-forest-900 uppercase tracking-wider mb-1">100% Organic Healing</p>
              <p className="text-xs text-forest-500 font-semibold leading-relaxed">
                <TranslatedText>Clinically tracked BAMS doctors across Raipur & Bhilai clinics.</TranslatedText>
              </p>
            </div>
          </div>

          {/* Copy Area */}
          <div>
            <span className="pill-badge mb-4 inline-block bg-sage-100 text-forest-700 border-sage-200">
              <TranslatedText>THE BRAND VISION</TranslatedText>
            </span>
            <TranslatedText
              as="h1"
              className="headline-lg text-forest-900 mb-6"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              Preserving Ancient Wisdom with Modern Safeguards
            </TranslatedText>
            <p className="body-md text-forest-600/70 mb-8 leading-relaxed">
              <TranslatedText>AuraSutra was founded in Raipur to bring structure and digital validation to holistic wellness. We believe natural recovery clinics are highly potent but deserve the same calendar tracking, digitised prescriptions, and live-queue management as traditional platforms.</TranslatedText>
            </p>

            {/* Core Values List */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {[
                { title: 'Verified Profiles', desc: 'Thorough checks for all listed practitioners.', icon: ShieldCheck },
                { title: 'Local Roots', desc: 'Serving local community clinics in Bhilai, Durg & Raipur.', icon: Award },
              ].map(item => (
                <div key={item.title} className="flex gap-4">
                  <div className="w-10 h-10 rounded-xl bg-sage-50 border border-sage-100 flex items-center justify-center text-forest-600 shrink-0">
                    <item.icon className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-base font-bold text-forest-900 mb-0.5">
                      <TranslatedText>{item.title}</TranslatedText>
                    </h4>
                    <p className="text-xs text-forest-500 leading-normal font-semibold">
                      <TranslatedText>{item.desc}</TranslatedText>
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
