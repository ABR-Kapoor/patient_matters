'use client';

import { useEffect } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import Link from 'next/link';

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[Web ErrorBoundary] Uncaught runtime exception:', error);
  }, [error]);

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-[#F9FAFB] p-6 text-[#030315]">
      <div className="flex w-full max-w-md flex-col items-center rounded-3xl border border-[#E5E7EB] bg-white p-8 text-center shadow-xl shadow-black/5">
        <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-red-50 text-red-600">
          <AlertTriangle className="h-8 w-8" />
        </div>
        
        <h1 className="text-2xl font-bold tracking-tight text-[#030315]">Something went wrong</h1>
        <p className="mt-2 text-sm text-[#6B7280] leading-relaxed">
          An unexpected error occurred while processing your request. Please try again or return to the home page.
        </p>

        {error?.message ? (
          <div className="mt-4 w-full rounded-xl bg-slate-50 border-l-4 border-red-500 p-3 text-left">
            <p className="text-xs font-semibold text-[#030315]">Error Details:</p>
            <p className="text-xs text-[#6B7280] font-mono mt-1 line-clamp-3">{error.message}</p>
          </div>
        ) : null}

        <div className="mt-6 flex w-full gap-3">
          <Link
            href="/"
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-slate-100 py-3 text-sm font-semibold text-[#030315] hover:bg-slate-200 transition-colors"
          >
            <Home className="h-4 w-4" />
            Home
          </Link>
          <button
            onClick={() => reset()}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#048256] py-3 text-sm font-semibold text-white hover:bg-[#036a46] shadow-sm transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
            Try again
          </button>
        </div>
      </div>
    </div>
  );
}

