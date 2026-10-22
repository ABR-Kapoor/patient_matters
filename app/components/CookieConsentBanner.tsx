'use client';

import React, { useState, useEffect } from 'react';
import { Cookie, X } from 'lucide-react';

export default function CookieConsentBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const consented = localStorage.getItem('cookieConsent');
    if (!consented) {
      const timer = setTimeout(() => setVisible(true), 1000);
      return () => clearTimeout(timer);
    }
  }, []);

  function accept() {
    localStorage.setItem('cookieConsent', 'true');
    setVisible(false);
  }

  function dismiss() {
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4">
      <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow-2xl border border-sage-200 p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4">
        <div className="w-10 h-10 rounded-xl bg-sage-100 flex items-center justify-center shrink-0">
          <Cookie className="w-5 h-5 text-forest-600" />
        </div>
        <p className="text-xs sm:text-sm text-forest-800 flex-1 leading-relaxed">
          We use essential cookies to provide and secure our services. By continuing, you agree to our{' '}
          <a href="/privacy-policy" className="font-semibold underline text-forest-600">Privacy Policy</a>.
        </p>
        <div className="flex gap-2 shrink-0">
          <button onClick={dismiss} className="p-2 text-forest-400 hover:text-forest-600 transition-colors">
            <X className="w-4 h-4" />
          </button>
          <button onClick={accept} className="px-4 py-2 bg-forest-600 text-white text-sm font-bold rounded-xl hover:bg-forest-700 transition-all">
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
