'use client';

import React from 'react';
import Link from 'next/link';
import { Mail, Phone, MapPin, Sparkles, Linkedin, Youtube, Instagram, ShieldCheck, Heart, ArrowRight, BookOpen, Compass, ShieldAlert } from 'lucide-react';
import { TranslatedText } from '@/app/components/TranslatedText';

export default function Footer() {
  const [isOpened, setIsOpened] = React.useState(false);
  const [isSubmitted, setIsSubmitted] = React.useState(false);

  return (
    <footer
      className="relative overflow-hidden pt-24 pb-12 text-white/90 selection:bg-sage-600/30 selection:text-white"
      style={{
        background: 'linear-gradient(180deg, #051b0f 0%, #0a2e1a 100%)',
        borderTop: '1px solid #103d22'
      }}
    >
      {/* Background glowing ambient vectors */}
      <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-forest-600/10 rounded-full blur-[140px] pointer-events-none -translate-y-1/2" />
      <div className="absolute bottom-0 right-10 w-[400px] h-[400px] bg-sage-500/10 rounded-full blur-[110px] pointer-events-none" />

      <div className="max-w-[1440px] mx-auto px-6 md:px-12 relative z-10">
        
        {/* Modern Newsletter Showcase Widget */}
        <div className="w-full rounded-[28px] p-8 md:p-12 mb-20 bg-white/[0.03] border border-white/[0.07] backdrop-blur-md relative overflow-hidden flex flex-col lg:flex-row items-center justify-between gap-8 shadow-2xl">
          <div className="absolute -top-10 -right-10 w-40 h-40 bg-sage-500/10 rounded-full blur-3xl pointer-events-none" />
          
          <div className="max-w-xl text-left">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full mb-4 bg-white/10 border border-white/10 text-[10px] font-black text-sage-300 uppercase tracking-widest leading-none">
              <Sparkles className="w-3.5 h-3.5 text-sage-400 shrink-0" />
              <span>Chhattisgarh's Wellness Directory</span>
            </div>
            <TranslatedText
              as="h1"
              className="headline-lg text-white mb-4 leading-tight font-bold"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              Stay updated on local practitioner listings.
            </TranslatedText>
            <p className="text-xs md:text-sm text-sage-200/65 leading-relaxed font-semibold">
              Get immediate alerts regarding new practitioner listings and live OPD queue updates in Chhattisgarh.
            </p>
          </div>

          {/* Interactive Action Area */}
          <div className="smooth-transition">
            {!isOpened ? (
              <button 
                onClick={() => setIsOpened(true)}
                className="btn-primary bg-forest-500 hover:bg-forest-600 text-white border-none py-3.5 px-8 rounded-2xl text-xs font-black flex items-center gap-2 shadow-lg smooth-transition hover:scale-105 active:scale-95 shrink-0"
              >
                <span>Subscribe to Releases</span>
                <Mail className="w-4 h-4 shrink-0" />
              </button>
            ) : !isSubmitted ? (
              <form 
                onSubmit={(e) => { e.preventDefault(); setIsSubmitted(true); }}
                className="w-full lg:w-auto min-w-[300px] md:min-w-[420px] shrink-0 flex bg-white/[0.02] border border-white/10 rounded-2xl p-1.5 focus-within:border-sage-400/40 smooth-transition"
              >
                <input 
                  type="email"
                  required
                  placeholder="Enter your email address"
                  className="bg-transparent outline-none flex-1 px-4 py-3 text-xs md:text-sm text-white placeholder:text-sage-300/40 font-bold"
                />
                <button type="submit" className="btn-primary bg-forest-500 hover:bg-forest-600 text-white border-none py-2.5 px-5 rounded-xl text-xs font-black flex items-center gap-1.5 shrink-0 shadow-md">
                  <span>Subscribe</span>
                  <ArrowRight className="w-3.5 h-3.5 shrink-0" />
                </button>
              </form>
            ) : (
              <div className="flex items-center gap-3 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl px-6 py-4 smooth-transition">
                <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center text-white shrink-0 shadow-sm animate-bounce">
                  <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div>
                  <span className="text-xs md:text-sm font-black text-emerald-400 block mb-0.5 uppercase tracking-wider">Subscription Successful!</span>
                  <span className="text-[10px] md:text-xs font-bold text-sage-200/70 block uppercase tracking-wide">Welcome to Chhattisgarh's practitioner directory updates.</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Upper Column Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 pb-16 border-b border-white/10">
          
          {/* Brand Presentation & Pitch */}
          <div className="lg:col-span-5 flex flex-col items-start">
            <div className="bg-white/95 rounded-full py-2.5 px-8 shadow-lg border border-white/10 mb-6 group hover:scale-105 smooth-transition inline-flex">
              <img 
                src="/AuraSutra-Full_BlackText-Transparent.png" 
                alt="AuraSutra Logo" 
                className="h-10 w-auto object-contain transition-all duration-300" 
              />
            </div>
            
            <p className="text-base text-sage-200/80 leading-relaxed mb-6 max-w-sm font-semibold">
              <TranslatedText>AuraSutra is Bhilai's conversational wellness directory. We connect patients with local clinics and specialist practitioners instantly.</TranslatedText>
            </p>

            {/* Social Links */}
            <div className="flex gap-3">
              {[
                { icon: Linkedin, label: 'LinkedIn', href: 'https://www.linkedin.com/company/frequnsync/about' },
                { icon: Instagram, label: 'Instagram', href: 'https://www.instagram.com/frequnsync/' },
                { icon: Youtube, label: 'YouTube', href: 'https://www.youtube.com/@FrequnSync-Genz' }
              ].map(social => (
                <a
                  key={social.label}
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-10 h-10 rounded-xl bg-white/[0.04] border border-white/10 flex items-center justify-center text-sage-300 hover:text-white hover:bg-white/10 hover:border-sage-400/50 smooth-transition"
                  title={social.label}
                >
                  <social.icon className="w-4 h-4 shrink-0" />
                </a>
              ))}
            </div>
          </div>

          {/* Quick links & Resource columns */}
          <div className="lg:col-span-7 grid grid-cols-2 md:grid-cols-3 gap-8">
            
            {/* Exploration Column */}
            <div>
              <h4 className="text-sm font-black tracking-widest text-sage-300 uppercase mb-5 flex items-center gap-2">
                <Compass className="w-4 h-4 text-sage-400 shrink-0" />
                <TranslatedText>Practitioner Categories</TranslatedText>
              </h4>
              <ul className="space-y-3.5 text-sm font-extrabold text-sage-200/70">
                {[
                  { label: 'Ayurveda Specialties', href: '#specialties' },
                  { label: 'Homeopathic Consults', href: '#specialties' },
                  { label: 'Panchakarma Therapies', href: '#about' },
                  { label: 'Unani & Siddha Care', href: '#specialties' },
                  { label: 'Yoga & Equilibrium Guidance', href: '#specialties' }
                ].map(item => (
                  <li key={item.label}>
                    <Link href={item.href} className="hover:text-white hover:underline smooth-transition">
                      <TranslatedText>{item.label}</TranslatedText>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Standards Column */}
            <div>
              <h4 className="text-sm font-black tracking-widest text-sage-300 uppercase mb-5 flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-sage-400 shrink-0" />
                <TranslatedText>Resources</TranslatedText>
              </h4>
              <ul className="space-y-3.5 text-sm font-extrabold text-sage-200/70">
                {[
                  { label: 'Doctor Directory', href: '#doctors' },
                  { label: 'Join as Doctor', href: 'https://doctor.aurasutra.org', external: true },
                  { label: 'Clinic Appointments', href: '#how-it-works' },
                  { label: 'Privacy & Security', href: '#faq' },
                  { label: 'OPD Queue Tracking', href: '#how-it-works' },
                  { label: 'Bhilai Wellness News', href: '#about' }
                ].map(item => {
                  const isExternal = 'external' in item && item.external;
                  return (
                    <li key={item.label}>
                      {isExternal ? (
                        <a href={item.href} target="_blank" rel="noopener noreferrer" className="hover:text-white hover:underline smooth-transition">
                          <TranslatedText>{item.label}</TranslatedText>
                        </a>
                      ) : (
                        <Link href={item.href} className="hover:text-white hover:underline smooth-transition">
                          <TranslatedText>{item.label}</TranslatedText>
                        </Link>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>

            {/* Contact Column */}
            <div className="col-span-2 md:col-span-1">
              <h4 className="text-sm font-black tracking-widest text-sage-300 uppercase mb-5 flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-sage-400 shrink-0" />
                <TranslatedText>Contact Info</TranslatedText>
              </h4>
              <ul className="space-y-3.5 text-sm font-extrabold text-sage-200/70">
                <li className="flex items-start gap-2.5">
                  <MapPin className="w-4 h-4 text-sage-400 shrink-0 mt-0.5" />
                  <span className="leading-snug">Bhilai, Chhattisgarh, India</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <Phone className="w-4 h-4 text-sage-400 shrink-0 mt-0.5" />
                  <div className="flex flex-col gap-1">
                    <span>+91 97700 75755</span>
                    <span>+91 75829 85761</span>
                  </div>
                </li>
                <li className="flex items-center gap-2.5">
                  <Mail className="w-4 h-4 text-sage-400 shrink-0" />
                  <span>support@aurasutra.org</span>
                </li>
              </ul>
            </div>

          </div>
        </div>

        {/* Lower Legal & Info Bar */}
        <div className="mt-10 flex flex-col md:flex-row items-center justify-between gap-6">
          
          <div className="flex items-center gap-2 text-sm font-bold text-sage-200/50">
            <span>
              © {new Date().getFullYear()} AuraSutra An{' '}
              <a href="https://www.frequnsync.online/" target="_blank" rel="noopener noreferrer" className="text-white hover:underline smooth-transition">
                FrequnSync
              </a>{' '}
              Product. All rights reserved.
            </span>
          </div>

          {/* Legal Links */}
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm font-extrabold text-sage-200/50">
            {[
              { href: '/privacy-policy', label: 'Privacy' },
              { href: '/terms-and-conditions', label: 'Terms' },
              { href: '/refund-policy', label: 'Refunds' },
              { href: '/disclaimer', label: 'Disclaimer' },
              { href: '/vision', label: 'Our Vision' },
              { href: '/contact', label: 'Contact' }
            ].map(link => (
              <Link 
                key={link.href}
                href={link.href} 
                className="hover:text-white hover:underline smooth-transition"
              >
                <TranslatedText>{link.label}</TranslatedText>
              </Link>
            ))}
            <span className="text-sage-300/40">Grievance: <a href="mailto:grievance@aurasutra.org" className="hover:text-white hover:underline">grievance@aurasutra.org</a></span>
          </div>

        </div>



      </div>
    </footer>
  );
}
