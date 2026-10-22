'use client';

import { useEffect } from 'react';
import { TranslatedText } from '@/app/components/TranslatedText';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Dashboard error:', error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 text-center bg-white rounded-3xl border border-sage-100 shadow-forest-sm">
      <div className="w-16 h-16 bg-[var(--error-container)] text-[var(--status-error)] rounded-full flex items-center justify-center mb-6">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
        </svg>
      </div>
      <h2 className="text-2xl font-bold font-display text-forest-900 mb-2 truncate max-w-md">
        <TranslatedText>Unable to Load Dashboard</TranslatedText>
      </h2>
      <p className="text-forest-400 mb-8 max-w-sm text-sm">
        <TranslatedText>We encountered a temporary connection issue. This is usually due to a database timeout.</TranslatedText>
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <button
          onClick={() => reset()}
          className="btn-primary px-8 py-3"
        >
          <TranslatedText>Try Again</TranslatedText>
        </button>
        <a
          href="/dashboard"
          className="btn-secondary px-8 py-3"
        >
          <TranslatedText>Refresh Page</TranslatedText>
        </a>
      </div>
      {error.digest && (
        <p className="mt-8 text-[10px] text-forest-400 font-mono"><TranslatedText>Build ID:</TranslatedText> {error.digest}</p>
      )}
    </div>
  );
}
