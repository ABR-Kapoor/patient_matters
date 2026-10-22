'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Pill, X, FileText, Calendar } from 'lucide-react';
import { formatDate } from '@/lib/formatDate';
import { useAuthToken } from '@/lib/auth-token-context';
import { fetchWithAuth } from '@/lib/fetchWithAuth';
import { TranslatedText } from '@/app/components/TranslatedText';
import { NameText } from '@/app/components/NameText';
import { MedicineName } from '@/app/components/MedicineName';
import { useLanguage } from '@/app/contexts/LanguageContext';

interface Prescription {
  prescription_id: string;
  diagnosis: string;
  medicines: any[];
  instructions: string;
  diet_advice: string;
  sent_at: string;
  doctors: {
    users: {
      name: string;
    };
  };
}

export default function PrescriptionNotification() {
  const token = useAuthToken();
  const router = useRouter();
  const { currentLocale } = useLanguage();
  const [newPrescriptions, setNewPrescriptions] = useState<Prescription[]>([]);
  const [showPopup, setShowPopup] = useState(false);

  useEffect(() => {
    checkNewPrescriptions();
  }, []);

  async function checkNewPrescriptions() {
    try {
      // Sync user
      const syncResponse = await fetchWithAuth('/api/sync-user', token);
      const { user } = await syncResponse.json();

      // Get patient profile
      const profileResponse = await fetchWithAuth(`/api/patient/profile?uid=${user.uid}`, token);
      const profileData = await profileResponse.json();

      if (!profileData.success) return;

      // Fetch prescriptions
      const response = await fetchWithAuth(`/api/patient/prescriptions?pid=${profileData.patient.pid}`, token);
      const data = await response.json();

      if (data.success && data.prescriptions.sent.length > 0) {
        // Show all new prescriptions (not yet viewed)
        setNewPrescriptions(data.prescriptions.sent);
        setShowPopup(true);
      }
    } catch (error) {
      console.error('Error checking prescriptions:', error);
    }
  }

  if (!showPopup || newPrescriptions.length === 0) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="glass-card max-w-[95vw] sm:max-w-md md:max-w-xl w-full p-4 sm:p-6 rounded-2xl max-h-[80vh] overflow-y-auto">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-gradient-to-br from-primary-500 to-secondary-500 rounded-xl flex items-center justify-center">
              <Pill className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-gray-900">
                {newPrescriptions.length > 1
                  ? <TranslatedText>New Prescriptions!</TranslatedText>
                  : <TranslatedText>New Prescription!</TranslatedText>}
              </h2>
              <p className="text-sm text-gray-600"><TranslatedText>From your doctor</TranslatedText></p>
            </div>
          </div>
          <button
            onClick={() => setShowPopup(false)}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          {newPrescriptions.map((prescription) => (
            <div
              key={prescription.prescription_id}
              className="p-4 bg-gradient-to-r from-green-50 to-blue-50 rounded-xl border-2 border-green-200"
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-bold text-lg text-gray-900"><TranslatedText>{prescription.diagnosis}</TranslatedText></h3>
                  <p className="text-sm text-gray-600">
                    <NameText name={prescription.doctors?.users?.name} fallback="Your Doctor" />
                  </p>
                  <p className="text-xs text-green-700 mt-1">
                    <TranslatedText>Prescribed:</TranslatedText> {formatDate(prescription.sent_at)}
                  </p>
                </div>
              </div>

              <div className="mb-3">
                <p className="text-sm font-semibold text-gray-700 mb-2"><TranslatedText>Medicines:</TranslatedText></p>
                <div className="space-y-1">
                  {prescription.medicines.slice(0, 3).map((med: any, idx: number) => (
                    <div key={idx} className="text-sm text-gray-600 flex items-start space-x-2">
                      <Pill className="w-4 h-4 mt-0.5 text-primary-600" />
                      <span>
                        <strong><MedicineName name={med.name} currentLocale={currentLocale} /></strong> - {med.dosage}, <TranslatedText>{med.frequency}</TranslatedText>
                      </span>
                    </div>
                  ))}
                  {prescription.medicines.length > 3 && (
                    <p className="text-xs text-gray-500">
                      +{prescription.medicines.length - 3} <TranslatedText>more medicines</TranslatedText>
                    </p>
                  )}
                </div>
              </div>

              {prescription.instructions && (
                <div className="mb-3 p-3 bg-white/50 rounded-lg">
                  <p className="text-sm font-semibold text-gray-700 mb-1"><TranslatedText>Instructions:</TranslatedText></p>
                  <p className="text-sm text-gray-600"><TranslatedText>{prescription.instructions}</TranslatedText></p>
                </div>
              )}

              <button
                onClick={() => {
                  setShowPopup(false);
                  router.push('/dashboard/prescriptions');
                }}
                className="w-full mt-3 px-4 py-3 bg-gradient-to-r from-primary-600 to-secondary-600 text-white rounded-xl font-semibold hover:shadow-lg smooth-transition"
              >
                <TranslatedText>View Full Prescription & Start Tracking</TranslatedText>
              </button>
            </div>
          ))}
        </div>

        <div className="mt-4 flex space-x-3">
          <button
            onClick={() => {
              setShowPopup(false);
              router.push('/dashboard/prescriptions');
            }}
            className="flex-1 px-4 py-2 bg-primary-100 text-primary-700 rounded-lg font-medium hover:bg-primary-200 smooth-transition"
          >
            <TranslatedText>View All Prescriptions</TranslatedText>
          </button>
          <button
            onClick={() => setShowPopup(false)}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 smooth-transition"
          >
            <TranslatedText>Dismiss</TranslatedText>
          </button>
        </div>
      </div>
    </div>
  );
}
