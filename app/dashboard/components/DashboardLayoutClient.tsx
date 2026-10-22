'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { Menu, X } from 'lucide-react';
import PatientProfilePicture from '@/app/components/ProfilePicture';
import LiveCallNotifier from '@/app/dashboard/components/LiveCallNotifier';
import Sidebar from '@/app/dashboard/components/Sidebar';
import { AuthTokenProvider } from '@/lib/auth-token-context';
import PatientProfileCheck from '@/app/components/PatientProfileCheck';
import EmergencyBanner from '@/app/components/EmergencyBanner';
import DailyMedicinePopup from '@/app/components/DailyMedicinePopup';
import { usePatientStore } from '@/app/store/usePatientStore';
import { useNotificationStore } from '@/app/store/useNotificationStore';

interface DashboardLayoutClientProps {
  children: React.ReactNode;
  user: any;
  accessToken?: string | null;
}

function StoreBootstrap({ token }: { token: string }) {
  const patientStore = usePatientStore();
  const notificationStore = useNotificationStore();

  // Bootstrap: fetch patient identity first (uid, pid needed by TanStack Query hooks)
  useEffect(() => {
    if (!token) return;
    const bootstrap = async () => {
      await patientStore.fetchPatient(token);
      notificationStore.fetchNotifications(token);
    };
    bootstrap();
  }, [token]);

  return null;
}

export default function DashboardLayoutClient({ children, user, accessToken }: DashboardLayoutClientProps) {
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(true);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setIsMobileSidebarOpen(false);
  }, [pathname]);

  return (
    <AuthTokenProvider token={accessToken || null}>
      {/* Global store bootstrap — runs once per session */}
      {accessToken && <StoreBootstrap token={accessToken} />}

      <div className="min-h-screen flex bg-sage-50 lg:bg-white">
        {/* Desktop Sidebar - Always visible on large screens */}
        <div 
          className="hidden lg:flex flex-col flex-shrink-0 sticky top-0 h-screen border-r border-sage-200 transition-all duration-300" 
          style={{ width: isSidebarExpanded ? '18rem' : '72px' }}
        >
          <Sidebar 
            user={user} 
            isExpanded={isSidebarExpanded} 
            onToggle={() => setIsSidebarExpanded(!isSidebarExpanded)} 
          />
        </div>

        {/* Mobile Sidebar - Overlay on mobile */}
        {isMobileSidebarOpen && (
          <div className="fixed inset-0 z-40 lg:hidden">
            {/* Backdrop */}
            <div
              className="absolute inset-0 bg-black/50"
              onClick={() => setIsMobileSidebarOpen(false)}
            />
            {/* Sidebar */}
            <div className="absolute right-0 top-0 bottom-0 w-[min(18rem,85vw)] bg-white shadow-lg z-50 overflow-y-auto">
              <button
                onClick={() => setIsMobileSidebarOpen(false)}
                className="absolute top-4 right-4 p-2 hover:bg-sage-100 rounded-lg z-50"
              >
                <X className="w-5 h-5" />
              </button>
              <Sidebar user={user} isExpanded={true} />
            </div>
          </div>
        )}

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col">
          {/* Mobile Header */}
          <div className="lg:hidden flex items-center justify-between px-4 py-3 bg-white border-b border-sage-200">
            <div className="flex items-center gap-1">
              <img src="/AuraSutra-Full_BlackText-Transparent.png" alt="AuraSutra" className="h-12 w-auto object-contain" />
            </div>
            <button
              onClick={() => setIsMobileSidebarOpen(true)}
              className="p-2 hover:bg-sage-100 rounded-lg"
            >
              <Menu className="w-5 h-5" />
            </button>
          </div>

          <EmergencyBanner />

          {/* Content */}
          <main className="relative flex-1 overflow-auto">
            <LiveCallNotifier />
            <div className="w-full min-h-full flex flex-col">
              <PatientProfileCheck />
              <DailyMedicinePopup />
              <div className="w-full max-w-[1380px] mx-auto px-3 sm:px-4 md:px-8 lg:px-14 py-4 sm:py-6 md:py-8">
                {children}
              </div>
            </div>
          </main>
        </div>
      </div>
    </AuthTokenProvider>
  );
}
