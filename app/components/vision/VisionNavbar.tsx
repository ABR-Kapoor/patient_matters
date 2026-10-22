'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence, useScroll, useSpring } from 'framer-motion';
import Link from 'next/link';
import { Menu, X, LayoutDashboard, User, Stethoscope } from 'lucide-react';
import { SignInButton, useAuth, useUser } from '@clerk/nextjs';
import { LanguageSwitcher } from '@/app/components/LanguageSwitcher';
import { TranslatedText } from '@/app/components/TranslatedText';

const sections = [
  { id: 'vision-hero',         label: 'Home' },
  { id: 'vision-built',        label: 'Today' },
  { id: 'vision-roadmap',      label: 'Roadmap' },
  { id: 'vision-impact',       label: 'Impact' },
  { id: 'vision-closing',      label: 'Join Us' },
];

export default function VisionNavbar() {
  const [activeSection, setActiveSection] = useState('vision-hero');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [scrolled, setScrolled]     = useState(false);
  const { isSignedIn: isAuthenticated } = useAuth();
  const { user } = useUser();

  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 200, damping: 30 });

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const observers: IntersectionObserver[] = [];
    for (const { id } of sections) {
      const el = document.getElementById(id);
      if (!el) continue;
      const observer = new IntersectionObserver(
        ([entry]) => { if (entry.isIntersecting) setActiveSection(id); },
        { rootMargin: '-40% 0px -50% 0px' }
      );
      observer.observe(el);
      observers.push(observer);
    }
    return () => observers.forEach(o => o.disconnect());
  }, []);

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
    setIsMenuOpen(false);
  };

  return (
    <>
      <motion.div
        className="fixed top-0 left-0 right-0 h-[2px] bg-primary z-[60] origin-left"
        style={{ scaleX }}
      />

      <div className="fixed top-0 z-50 w-full px-4 md:px-8 pt-4 pb-2 pointer-events-none">
        <nav className={`max-w-[1440px] mx-auto rounded-3xl border border-sage-200/60 backdrop-blur-xl pointer-events-auto transition-all duration-300 ${
          scrolled
            ? 'bg-white/85 shadow-[0_8px_32px_rgba(20,40,30,0.08)]'
            : 'bg-white/60 shadow-[0_4px_16px_rgba(20,40,30,0.04)]'
        } hover:shadow-[0_12px_40px_rgba(20,40,30,0.1)]`}>
          <div className="px-6 md:px-10 py-2 flex items-center justify-between gap-4">

            {/* Logo */}
            <div className="flex items-center shrink-0">
              <Link href="/" className="flex items-center">
                <img
                  src="/AuraSutra-Full_BlackText-Transparent.png"
                  alt="AuraSutra Logo"
                  className="h-11 md:h-12 w-auto object-contain transition-all duration-300"
                />
              </Link>
            </div>

            {/* Desktop section links */}
            <div className="hidden lg:flex items-center gap-10 whitespace-nowrap">
              {sections.map(s => (
                <button
                  key={s.id}
                  onClick={() => scrollTo(s.id)}
                  className={`text-sm font-extrabold tracking-tight transition-colors ${
                    activeSection === s.id ? 'text-primary' : 'text-forest-700 hover:text-forest-900'
                  }`}
                >
                  {s.label}
                </button>
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

            {/* Desktop Actions */}
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
                    <button className="px-4 py-2 rounded-2xl text-xs font-extrabold text-forest-700 hover:bg-sage-50 smooth-transition border border-transparent hover:border-sage-200">
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

            {/* Mobile Actions */}
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
                >
                  {user?.imageUrl ? (
                    <img src={user.imageUrl} alt="Profile" className="w-full h-full object-cover" />
                  ) : (
                    <User className="w-4 h-4 text-forest-600" />
                  )}
                </Link>
              ) : (
                <SignInButton mode="redirect">
                  <button className="w-8 h-8 min-w-[32px] min-h-[32px] max-w-[32px] max-h-[32px] rounded-full border border-sage-200 bg-sage-50 flex items-center justify-center text-forest-700 font-extrabold hover:bg-sage-100 smooth-transition shadow-sm shrink-0">
                    <User className="w-4 h-4 text-forest-600" />
                  </button>
                </SignInButton>
              )}
              <button
                className="p-1.5 text-forest-700 hover:bg-sage-100 rounded-xl transition-colors shrink-0"
                onClick={() => setIsMenuOpen(!isMenuOpen)}
              >
                {isMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {/* Mobile drawer */}
          <AnimatePresence>
            {isMenuOpen && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.22 }}
                className="overflow-hidden border-t border-sage-200/60 rounded-b-3xl md:hidden"
              >
                <div className="px-5 py-4 flex flex-col gap-1">
                  {sections.map(s => (
                    <button
                      key={s.id}
                      onClick={() => scrollTo(s.id)}
                      className={`text-left px-4 py-3 rounded-xl text-sm font-extrabold tracking-tight transition-colors ${
                        activeSection === s.id ? 'bg-primary/10 text-primary' : 'text-forest-700 hover:bg-sage-50'
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                  <div className="mt-3 pt-3 border-t border-sage-200/60">
                    <SignInButton mode="redirect">
                      <button className="w-full btn-primary py-3 text-sm font-black rounded-xl">Get Started</button>
                    </SignInButton>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </nav>
      </div>
    </>
  );
}
