'use client';

import React from 'react';
import { ArrowRight, Sparkles } from 'lucide-react';
import { SignInButton } from '@clerk/nextjs';
import { TranslatedText } from '@/app/components/TranslatedText';

export default function CTABand({ isAuthenticated }: { isAuthenticated: boolean }) {
  return (
    <section className="py-20 bg-white relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-6 relative z-10">
        <div 
          className="rounded-3xl p-8 md:p-16 text-center relative overflow-hidden group shadow-primary"
          style={{
            background: 'linear-gradient(135deg, var(--forest-900) 0%, var(--forest-700) 100%)',
          }}
        >
          {/* Animated decorative shader backgrounds */}
          <div className="absolute inset-0 bg-gradient-to-r from-forest-500/10 via-transparent to-forest-500/10 opacity-60 group-hover:scale-105 smooth-transition pointer-events-none" />
          <div className="absolute -top-24 -left-24 w-64 h-64 bg-forest-600/20 rounded-full blur-[80px] pointer-events-none" />
          <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-forest-500/20 rounded-full blur-[80px] pointer-events-none" />

          <div className="relative z-10 max-w-2xl mx-auto flex flex-col items-center">
            <span className="pill-badge mb-6 inline-block bg-[#e8f3ec] text-[#16522e] border-none">
              <Sparkles className="w-3.5 h-3.5 shrink-0" />
              <TranslatedText>JOIN THE COHORT</TranslatedText>
            </span>
            <TranslatedText
              as="h1"
              className="headline-lg text-white mb-4 leading-tight font-bold"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              Restore Your System Equilibrium Today
            </TranslatedText>
            <p className="body-md text-sage-200/90 mb-10 max-w-md">
              <TranslatedText>Experience seamless booking, digital wellness history, and practitioner-managed progress charts under one cohesive system.</TranslatedText>
            </p>

            {isAuthenticated ? (
              <a 
                href="/dashboard"
                className="btn-primary bg-white text-forest-900 border-white hover:bg-sage-100 py-3.5 px-8 rounded-full font-black text-sm flex items-center gap-2 smooth-transition shadow-lg"
              >
                <span>Go to Dashboard</span>
                <ArrowRight className="w-4 h-4 shrink-0 transition-transform group-hover:translate-x-1" />
              </a>
            ) : (
              <div className="flex flex-col sm:flex-row items-center gap-4">
                <SignInButton mode="redirect">
                  <button
                    className="btn-primary bg-white text-forest-900 border-white hover:bg-sage-100 py-3.5 px-8 rounded-full font-black text-sm flex items-center gap-2 smooth-transition shadow-lg"
                  >
                    <span>Get Started Free</span>
                    <ArrowRight className="w-4 h-4 shrink-0 transition-transform group-hover:translate-x-1" />
                  </button>
                </SignInButton>
                <SignInButton mode="redirect">
                  <button
                    className="text-white hover:text-sage-200 text-sm font-bold smooth-transition py-2 px-4"
                  >
                    <span>Consultation Pricing</span>
                  </button>
                </SignInButton>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
