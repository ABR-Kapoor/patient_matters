'use client';

import { useState } from 'react';
import { AlertCircle, X, ExternalLink } from 'lucide-react';

export default function EmergencyBanner() {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  return (
    <div className="bg-amber-50 border-b border-amber-200 px-3 sm:px-4 md:px-8 lg:px-14">
      <div className="max-w-[1380px] mx-auto flex items-center justify-between gap-3 py-2.5">
        <div className="flex items-center gap-2 text-xs sm:text-sm text-amber-800">
          <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
          <span>
            <strong>Not for emergencies.</strong> AuraSutra is a{' '}
            <strong>practitioner directory</strong>. If you have a medical emergency,{' '}
            <a
              href="tel:112"
              className="font-bold text-red-600 hover:text-red-800 underline underline-offset-2"
            >
              call 112
            </a>
            {' '}or visit the nearest hospital immediately.
          </span>
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="shrink-0 p-1 rounded-lg text-amber-400 hover:text-amber-600 hover:bg-amber-100 transition-colors"
          aria-label="Dismiss emergency notice"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
