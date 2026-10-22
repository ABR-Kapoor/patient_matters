'use client';

import { X, Award, MapPin, DollarSign, Briefcase, Languages, Calendar } from 'lucide-react';
import { useEffect } from 'react';
import Link from 'next/link';
import { TranslatedText } from '@/app/components/TranslatedText';

interface Doctor {
  did: string;
  specialization: string[];
  customSpecializations?: string;
  qualification: string;
  yearsOfExperience: number;
  consultationFee: number;
  city: string;
  state: string;
  bio: string;
  languages: string[];
  user?: {
    name: string;
    email: string;
    profileImageUrl?: string;
  };
}

interface DoctorProfileModalProps {
  doctor: Doctor | null;
  isOpen: boolean;
  onClose: () => void;
  platformFee?: number;
}

export default function DoctorProfileModal({ doctor, isOpen, onClose, platformFee = 20 }: DoctorProfileModalProps) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen || !doctor) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div 
        className="absolute inset-0 bg-forest-900/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      ></div>
      
      <div className="relative bg-white rounded-[2rem] shadow-2xl w-full max-w-[95vw] sm:max-w-md md:max-w-xl max-h-[90vh] overflow-y-auto animate-enter overflow-hidden">
        {/* Header with Image Background or Gradient */}
        <div className="relative bg-sage-50 p-8 pt-12">
           <button 
             onClick={onClose}
             className="absolute top-4 right-4 p-2 bg-white/50 hover:bg-white rounded-full transition-colors"
           >
             <X className="w-6 h-6 text-forest-600" />
           </button>

           <div className="flex flex-col sm:flex-row items-center sm:items-end -mb-16 sm:space-x-6 space-y-4 sm:space-y-0 relative z-10">
              <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-[1.5rem] border-4 border-white shadow-xl overflow-hidden bg-white">
                {doctor.user?.profileImageUrl ? (
                  <img src={doctor.user.profileImageUrl} alt={doctor.user?.name || 'Doctor'} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-sage-100 flex items-center justify-center text-4xl text-forest-600 font-bold">
                    {doctor.user?.name?.charAt(0) || 'D'}
                  </div>
                )}
              </div>
              
              <div className="text-center sm:text-left pb-4">
                <h2 className="text-xl sm:text-2xl md:text-3xl font-black text-forest-900 leading-tight">
                  <TranslatedText>{doctor.user?.name || 'Practitioner'}</TranslatedText>
                </h2>
                {(doctor.city || doctor.state) && (
                  <div className="flex items-center justify-center sm:justify-start space-x-2 text-forest-600 font-medium mt-1">
                    <MapPin className="w-4 h-4 shrink-0" />
                    <span className="text-sm">
                      {[doctor.city, doctor.state].filter(Boolean).join(', ')}
                    </span>
                  </div>
                )}
              </div>
           </div>
        </div>

        {/* Spacer for overlapping avatar */}
        <div className="h-12 bg-sage-50"></div>

        {/* Content */}
        <div className="px-5 py-4 sm:px-8 sm:py-8 space-y-5 sm:space-y-8 bg-white">
          {/* Specializations */}
          <div>
            <h3 className="text-lg font-black text-forest-900 mb-3 flex items-center space-x-2">
              <Award className="w-5 h-5 text-primary-600" />
              <TranslatedText as="span">Specializations</TranslatedText>
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {doctor.specialization.map((spec, index) => (
                <span
                  key={index}
                  className="px-3 py-1.5 sm:px-4 sm:py-2 bg-primary-50 text-primary-700 rounded-full text-xs sm:text-sm font-semibold border border-primary-100"
                >
                  <TranslatedText>{spec}</TranslatedText>
                </span>
              ))}
              {doctor.customSpecializations && (
                 <span className="px-3 py-1.5 sm:px-4 sm:py-2 bg-secondary-50 text-secondary-700 rounded-full text-xs sm:text-sm font-semibold border border-secondary-100">
                    <TranslatedText>{doctor.customSpecializations}</TranslatedText>
                 </span>
              )}
            </div>
          </div>

          {/* Details Grid */}
          <div className="grid grid-cols-2 gap-2 sm:gap-4">
            <div className="bg-sage-50 p-3.5 sm:p-5 rounded-2xl border border-sage-100">
              <div className="flex items-center space-x-2 text-forest-500 mb-1">
                <Briefcase className="w-4 h-4" />
                <TranslatedText as="span" className="text-[9px] sm:text-xs font-bold uppercase tracking-wide whitespace-nowrap">Experience</TranslatedText>
              </div>
              <p className="text-base sm:text-2xl font-black text-forest-900">
                {doctor.yearsOfExperience} <TranslatedText as="span" className="text-sm sm:text-lg font-medium text-forest-500">years</TranslatedText>
              </p>
            </div>

            <div className="bg-sage-100 p-3.5 sm:p-5 rounded-2xl border border-sage-200">
              <div className="flex items-center space-x-2 text-forest-600 mb-1">
                <DollarSign className="w-4 h-4" />
                <TranslatedText as="span" className="text-[9px] sm:text-xs font-bold uppercase tracking-wide whitespace-nowrap">Consultation Fee</TranslatedText>
              </div>
              <p className="text-base sm:text-2xl font-black text-forest-700">
                ₹{Number(Number(doctor.consultationFee || 0) + platformFee).toFixed(2)}
              </p>
            </div>
          </div>


          {/* Languages */}
          {doctor.languages && doctor.languages.length > 0 && (
            <div>
              <h3 className="text-lg font-black text-forest-900 mb-3 flex items-center space-x-2">
                <Languages className="w-5 h-5 text-primary-600" />
                <TranslatedText as="span">Languages</TranslatedText>
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {doctor.languages.map((lang, index) => (
                  <span
                    key={index}
                    className="px-3 py-1 bg-sage-100 text-forest-700 rounded-full text-sm font-medium"
                  >
                    <TranslatedText>{lang}</TranslatedText>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Bio */}
          {doctor.bio && (
            <div>
              <TranslatedText as="h3" className="text-lg font-black text-forest-900 mb-3">About Doctor</TranslatedText>
              <p className="text-forest-600 leading-relaxed bg-sage-50 p-4 rounded-xl border border-sage-100"><TranslatedText>{doctor.bio}</TranslatedText></p>
            </div>
          )}

          {/* Book Appointment Button */}
          <Link
            href={`/dashboard/book-appointment?did=${doctor.did}`}
            className="block w-full px-4 sm:px-8 py-2.5 sm:py-5 bg-gradient-to-r from-forest-600 to-forest-500 text-white rounded-2xl font-bold text-sm sm:text-lg text-center shadow-lg hover:shadow-xl hover:scale-[1.02] smooth-transition"
          >
            <Calendar className="w-5 h-5 inline-block mr-2 mb-1" />
            <TranslatedText>Book Appointment</TranslatedText>
          </Link>
        </div>
      </div>
    </div>
  );
}
