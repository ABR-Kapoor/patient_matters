'use client';

import { AlertCircle, ArrowLeft, LogOut } from 'lucide-react';
import { SignOutButton } from '@clerk/nextjs';
import Link from 'next/link';
import { TranslatedText } from '@/app/components/TranslatedText';

export default function UnauthorizedAccess() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 via-orange-50 to-yellow-50">
      <div className="max-w-md w-full mx-4">
        <div className="bg-white rounded-3xl shadow-2xl p-8 border border-red-100">
          {/* Icon */}
          <div className="flex justify-center mb-6">
            <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center">
              <AlertCircle className="w-12 h-12 text-red-600" />
            </div>
          </div>

          {/* Title */}
          <h1 className="text-3xl font-black text-gray-900 text-center mb-4">
            <TranslatedText>Access Denied</TranslatedText>
          </h1>

          {/* Message */}
          <div className="bg-red-50 border border-red-200 rounded-2xl p-6 mb-6">
            <p className="text-gray-800 text-center font-medium mb-3">
              <TranslatedText>This is the</TranslatedText> <span className="font-black text-red-600"><TranslatedText>Patient Portal</TranslatedText></span>
            </p>
            <p className="text-gray-700 text-center text-sm">
              <TranslatedText>Your account is registered as a</TranslatedText> <span className="font-bold"><TranslatedText>Doctor</TranslatedText></span>.{' '}
              <TranslatedText>You cannot access the patient portal with a doctor account.</TranslatedText>
            </p>
          </div>

          {/* Info */}
          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 mb-6">
            <p className="text-sm text-gray-700 text-center">
              <TranslatedText>Please use the</TranslatedText> <span className="font-bold text-blue-600"><TranslatedText>Doctor Portal</TranslatedText></span> <TranslatedText>to access your account.</TranslatedText>
            </p>
          </div>

          {/* Actions */}
          <div className="space-y-3">
            <SignOutButton>
              <button
                className="w-full py-3 px-6 bg-gradient-to-r from-red-600 to-orange-600 text-white rounded-2xl font-bold hover:shadow-lg smooth-transition flex items-center justify-center space-x-2"
              >
                <LogOut className="w-5 h-5" />
                <span><TranslatedText>Logout & Switch Account</TranslatedText></span>
              </button>
            </SignOutButton>

            <a
              href="http://localhost:3001/dashboard"
              className="w-full py-3 px-6 bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-2xl font-bold hover:shadow-lg smooth-transition flex items-center justify-center space-x-2"
            >
              <span><TranslatedText>Go to Doctor Portal</TranslatedText></span>
            </a>

            <Link
              href="/"
              className="w-full py-3 px-6 bg-gray-100 text-gray-700 rounded-2xl font-bold hover:bg-gray-200 smooth-transition flex items-center justify-center space-x-2"
            >
              <ArrowLeft className="w-4 h-4" />
              <span><TranslatedText>Back to Home</TranslatedText></span>
            </Link>
          </div>

          {/* Help Text */}
          <p className="text-xs text-gray-500 text-center mt-6">
            <TranslatedText>If you believe this is an error, please contact support.</TranslatedText>
          </p>
        </div>
      </div>
    </div>
  );
}
