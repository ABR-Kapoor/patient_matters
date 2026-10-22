'use client';
import Link from 'next/link';
import { useState } from 'react';
import { User, Menu, X } from 'lucide-react';
import { SignInButton, useUser, useAuth } from '@clerk/nextjs';
import { LanguageSwitcher } from '@/app/components/LanguageSwitcher';
import { TranslatedText } from '@/app/components/TranslatedText';
import { useProfileStore } from '@/app/store/useProfileStore';

export default function Navbar() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { isSignedIn: isAuthenticated } = useAuth();
  const { user } = useUser();
  const profileStore = useProfileStore();

  return (
    <nav className="sticky top-0 z-50 glass-nav">
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">

        {/* Brand */}
        <Link href="/" className="flex items-center gap-2">
          <img
            src="/AuraSutra-Full_BlackText-Transparent.png"
            alt="AuraSutra Logo"
            className="h-12 w-auto object-contain"
          />
        </Link>

        {/* Desktop links */}
        <div className="hidden md:flex items-center gap-3">
          <LanguageSwitcher />
          {isAuthenticated ? (
            <Link
              href="/dashboard"
              className="flex items-center gap-2 px-4 py-2 rounded-full smooth-transition"
              style={{ background: 'var(--sage-100)', color: 'var(--forest-700)', border: '1px solid var(--sage-200)', fontSize: '0.875rem', fontWeight: 600 }}
            >
              { (profileStore.isLoaded ? profileStore.imageUrl : user?.imageUrl) ? (
                <img src={profileStore.isLoaded ? profileStore.imageUrl : user?.imageUrl} alt={profileStore.isLoaded ? profileStore.name : (user?.firstName || 'Profile')} className="w-5 h-5 rounded-full object-cover" />
              ) : (
                <User className="w-4 h-4" />
              )}
              <TranslatedText>Dashboard</TranslatedText>
            </Link>
          ) : (
            <div className="flex items-center gap-2">
              <SignInButton mode="redirect">
                <button
                  className="px-5 py-2 rounded-full text-sm font-medium smooth-transition whitespace-nowrap"
                  style={{ color: 'var(--forest-700)' }}
                >
                  <TranslatedText>Sign In</TranslatedText>
                </button>
              </SignInButton>
              <SignInButton mode="redirect">
                <button className="btn-primary text-sm whitespace-nowrap">
                  <TranslatedText>Get Started</TranslatedText>
                  <span>→</span>
                </button>
              </SignInButton>
            </div>
          )}
        </div>

        {/* Mobile direct actions (No sandwich/hamburger menu) */}
        <div className="flex md:hidden items-center gap-2.5 shrink-0 whitespace-nowrap">
          <div className="w-8 h-8 min-w-[32px] min-h-[32px] max-w-[32px] max-h-[32px] rounded-full flex items-center justify-center shrink-0">
            <LanguageSwitcher />
          </div>

          {isAuthenticated ? (
            <Link
              href="/dashboard"
              className="w-8 h-8 min-w-[32px] min-h-[32px] max-w-[32px] max-h-[32px] rounded-full border border-sage-200 bg-sage-50 flex items-center justify-center text-forest-700 font-extrabold hover:bg-sage-100 smooth-transition shadow-sm overflow-hidden shrink-0"
              title="Dashboard"
            >
              { (profileStore.isLoaded ? profileStore.imageUrl : user?.imageUrl) ? (
                <img 
                  src={profileStore.isLoaded ? profileStore.imageUrl : user?.imageUrl} 
                  alt={profileStore.isLoaded ? profileStore.name : (user?.firstName || 'Profile')} 
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
  );
}
