'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Sparkles, Menu, X, User, ShieldCheck, Stethoscope } from 'lucide-react';
import { SignInButton, useUser, useAuth } from '@clerk/nextjs';
import { LanguageSwitcher } from '@/app/components/LanguageSwitcher';
import { TranslatedText } from '@/app/components/TranslatedText';
import { Link000 } from '@/components/ui/skiper-ui/skiper40';

export default function LandingNavbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const { isSignedIn: isAuthenticated } = useAuth();
  const { user } = useUser();

  return (
    <div className="sticky top-0 z-50 w-full px-4 md:px-8 pt-4 pb-2 pointer-events-none">
      <nav className="max-w-[1440px] mx-auto rounded-3xl border border-sage-200/60 bg-white/80 backdrop-blur-xl shadow-[0_8px_32px_rgba(20,40,30,0.06)] pointer-events-auto transition-all duration-300 hover:shadow-[0_12px_40px_rgba(20,40,30,0.1)]">
        <div className="px-6 md:px-10 py-2 flex items-center justify-between gap-4">
          
          {/* Brand Logo */}
          <div className="flex items-center shrink-0">
            <Link href="/" className="flex items-center">
              <img 
                src="/AuraSutra-Full_BlackText-Transparent.png" 
                alt="AuraSutra Logo" 
                className="h-11 md:h-12 w-auto object-contain transition-all duration-300" 
              />
            </Link>
          </div>

          {/* Desktop Navigation Links */}
          <div className="hidden md:flex items-center gap-10 whitespace-nowrap">
            {['#specialties', '#how-it-works', '/vision', '#faq'].map((href, i) => (
              <Link000
                key={href}
                href={href}
                className="text-sm font-extrabold tracking-tight text-forest-700 hover:text-forest-900 transition-colors"
              >
                {['Specialties', 'How It Works', 'Vision', 'FAQ'][i]}
              </Link000>
            ))}
            <a
              href="https://doctor.aurasutra.org"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-sm font-extrabold tracking-tight text-violet-600 hover:text-violet-800 transition-colors"
            >
              <Stethoscope className="w-4 h-4" />
              For Doctors
            </a>
          </div>

          {/* Action buttons - All in a single line */}
          <div className="hidden md:flex items-center gap-5 shrink-0 whitespace-nowrap">
            <LanguageSwitcher />

            {isAuthenticated ? (
              <Link
                href="/dashboard"
                className="flex items-center gap-2 px-4 py-2 rounded-2xl border border-sage-200 bg-sage-50 text-forest-700 font-extrabold hover:bg-sage-100 smooth-transition text-xs shadow-sm"
              >
                {user?.imageUrl ? (
                  <img 
                    src={user.imageUrl} 
                    alt={user.firstName || 'Profile'} 
                    className="w-5 h-5 rounded-full object-cover shrink-0" 
                  />
                ) : (
                  <User className="w-4 h-4 shrink-0" />
                )}
                <TranslatedText>Dashboard</TranslatedText>
              </Link>
            ) : (
              <div className="flex items-center gap-3">
                <SignInButton mode="redirect">
                  <button
                    className="px-4 py-2 rounded-2xl text-xs font-extrabold text-forest-700 hover:bg-sage-50 smooth-transition border border-transparent hover:border-sage-200"
                  >
                    <TranslatedText>Sign In</TranslatedText>
                  </button>
                </SignInButton>
                <SignInButton mode="redirect">
                  <button className="btn-primary py-2 px-5 text-xs font-black flex items-center gap-1.5 shadow-sm rounded-2xl">
                    <TranslatedText>Get Started</TranslatedText>
                    <span className="font-sans text-[10px]">→</span>
                  </button>
                </SignInButton>
              </div>
            )}
          </div>

          {/* Mobile direct actions */}
          <div className="flex md:hidden items-center gap-2.5 shrink-0 whitespace-nowrap">
            <a
              href="https://doctor.aurasutra.org"
              target="_blank"
              rel="noopener noreferrer"
              className="w-8 h-8 min-w-[32px] min-h-[32px] max-w-[32px] max-h-[32px] rounded-full flex items-center justify-center text-violet-600 hover:bg-violet-50 smooth-transition shrink-0"
              title="For Doctors"
            >
              <Stethoscope className="w-[18px] h-[18px]" />
            </a>
            <div className="w-8 h-8 min-w-[32px] min-h-[32px] max-w-[32px] max-h-[32px] rounded-full flex items-center justify-center shrink-0">
              <LanguageSwitcher />
            </div>

            {isAuthenticated ? (
              <Link
                href="/dashboard"
                className="w-8 h-8 min-w-[32px] min-h-[32px] max-w-[32px] max-h-[32px] rounded-full border border-sage-200 bg-sage-50 flex items-center justify-center text-forest-700 font-extrabold hover:bg-sage-100 smooth-transition shadow-sm overflow-hidden shrink-0"
                title="Dashboard"
              >
                {user?.imageUrl ? (
                  <img 
                    src={user.imageUrl} 
                    alt={user.firstName || 'Profile'} 
                    className="w-full h-full object-cover" 
                  />
                ) : (
                  <User className="w-4 h-4 text-forest-600" />
                )}
              </Link>
            ) : (
              <SignInButton mode="redirect">
                <button 
                  className="w-8 h-8 min-w-[32px] min-h-[32px] max-w-[32px] max-h-[32px] rounded-full border border-sage-200 bg-sage-50 flex items-center justify-center text-forest-700 font-extrabold hover:bg-sage-100 smooth-transition shadow-sm overflow-hidden shrink-0"
                  title="Sign In"
                >
                  <User className="w-4 h-4 text-forest-600" />
                </button>
              </SignInButton>
            )}
          </div>
        </div>
      </nav>
    </div>
  );
}
