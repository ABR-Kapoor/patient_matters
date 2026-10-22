'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Home,
  Calendar,
  User,
  Pill,
  TrendingUp,
  Plus,
  Search,
  PanelLeftClose,
  LogOut,
} from 'lucide-react';
import { SignOutButton } from '@clerk/nextjs';
import PatientProfilePicture from '@/app/components/ProfilePicture';
import { TranslatedText } from '@/app/components/TranslatedText';
import { LanguageSwitcher } from '@/app/components/LanguageSwitcher';
import { useTranslation } from '@/app/hooks/useTranslation';
import { useNameTransliteration } from '@/app/hooks/useNameTransliteration';
import { useLanguage } from '@/app/contexts/LanguageContext';
import { useProfileStore } from '@/app/store/useProfileStore';

interface SidebarProps {
  user?: any;
  isExpanded?: boolean;
  onToggle?: () => void;
}

export default function Sidebar({ user, isExpanded = true, onToggle }: SidebarProps) {
  const pathname = usePathname() || '';
  const { text: titleDashboard } = useTranslation('Dashboard');
  const { text: titleFindDoctors } = useTranslation('Find Doctors');
  const { text: titleAppointments } = useTranslation('Appointments');
  const { text: titlePrescriptions } = useTranslation('Prescriptions');
  const { text: titleProfile } = useTranslation('Profile');
  const { text: titleExpandSidebar } = useTranslation('Expand Sidebar');
  const { text: titleLogOut } = useTranslation('Log out');
  const { transliterateName } = useNameTransliteration();
  const { currentLocale } = useLanguage();
  const [displayName, setDisplayName] = useState('');
  const profileStore = useProfileStore();

  useEffect(() => {
    const updateName = async () => {
      const baseName = profileStore.isLoaded ? profileStore.name : user?.given_name;
      if (baseName) {
        const transliterated = await transliterateName(baseName);
        setDisplayName(transliterated);
      } else {
        setDisplayName('');
      }
    };
    updateName();
  }, [user?.given_name, currentLocale, transliterateName, profileStore.name, profileStore.isLoaded]);

  const isActive = (path: string) => {
    if (path === '/dashboard') return pathname === '/dashboard';
    return pathname.startsWith(path);
  };

  if (!isExpanded) {
    return (
      <aside className="w-[72px] h-full flex flex-col items-center py-6 bg-sage-50 border-r border-sage-200">
        {/* Collapsed Logo */}
        <Link href="/dashboard" className="flex items-center justify-center mb-6">
          <img src="/AuraSutra-LogoOnly-Transparent.png" alt="AuraSutra" className="h-8 w-auto object-contain" />
        </Link>

        {onToggle && (
          <button
            onClick={onToggle}
            className="mb-6 px-2 py-2 rounded-lg text-forest-400 hover:bg-sage-100 hover:text-forest-600 transition-colors"
            title={titleExpandSidebar}
          >
            <PanelLeftClose className="w-5 h-5 rotate-180" />
          </button>
        )}

        {/* Collapsed Nav Icons */}
        <nav className="flex flex-col gap-3 flex-1">
          <SidebarIconButton icon={Home} href="/dashboard" active={isActive('/dashboard')} title={titleDashboard} />
          <SidebarIconButton icon={Search} href="/dashboard/find-doctors" active={isActive('/dashboard/find-doctors')} title={titleFindDoctors} />
          <SidebarIconButton icon={Calendar} href="/dashboard/appointments" active={isActive('/dashboard/appointments')} title={titleAppointments} />
          <SidebarIconButton icon={Pill} href="/dashboard/prescriptions" active={isActive('/dashboard/prescriptions')} title={titlePrescriptions} />
          <SidebarIconButton icon={User} href="/dashboard/profile" active={isActive('/dashboard/profile')} title={titleProfile} />
        </nav>

        {/* Collapsed Footer Actions */}
        <div className="flex flex-col gap-5 pt-8 pb-4 border-t border-sage-200 w-full items-center px-2">
          <div className="w-full">
            <LanguageSwitcher />
          </div>
          <Link 
            href="/dashboard/profile"
             className={`w-10 h-10 rounded-full overflow-hidden border-2 transition-all ${isActive('/dashboard/profile') ? 'border-primary ring-2 ring-primary/20' : 'border-sage-200 hover:border-primary'}`}
             title={titleProfile}
           >
              <PatientProfilePicture uid={user?.id || user?.sub || user?.uid} fallbackSrc={profileStore.isLoaded ? profileStore.imageUrl : (user?.profile_image_url || user?.profileImageUrl || user?.picture)} initials={(profileStore.isLoaded ? profileStore.name : (user?.given_name || user?.name || 'U'))[0]} />
           </Link>
          <SignOutButton>
            <button className="flex items-center justify-center w-10 h-10 rounded-lg text-forest-600 hover:bg-[var(--error-container)] hover:text-[var(--status-error)] transition-colors" title={titleLogOut}>
              <LogOut className="w-5 h-5" strokeWidth={1.5} />
            </button>
          </SignOutButton>
        </div>
      </aside>
    );
  }

  return (
    <aside className="w-full h-full flex flex-col bg-sage-50">
      {/* Sidebar Header */}
      <SidebarHeader onToggle={onToggle} />

      {/* Sidebar Navigation */}
      <nav className="flex-1 px-4 py-2 space-y-1 overflow-y-auto">
        <SidebarNavItem 
          label="Dashboard" 
          href="/dashboard" 
          icon={Home}
          active={isActive('/dashboard')}
        />
        <SidebarNavItem 
          label="Find Doctors" 
          href="/dashboard/find-doctors" 
          icon={Search}
          active={isActive('/dashboard/find-doctors')}
        />
        <SidebarNavItem 
          label="Appointments" 
          href="/dashboard/appointments" 
          icon={Calendar}
          active={isActive('/dashboard/appointments')}
        />
        <SidebarNavItem 
          label="Prescriptions" 
          href="/dashboard/prescriptions" 
          icon={Pill}
          active={isActive('/dashboard/prescriptions')}
        />
        <SidebarNavItem 
          label="Profile" 
          href="/dashboard/profile" 
          icon={User}
          active={isActive('/dashboard/profile')}
        />
      </nav>

      {/* New Appointment Button */}
      <div className="px-4 pb-2">
        <Link
          href="/dashboard/find-doctors"
          className="btn-primary w-full py-2.5 px-4 text-xs font-bold flex items-center justify-center gap-2 shadow-primary transition-all duration-200"
        >
          <Plus className="w-4 h-4" />
          <TranslatedText>New Appointment</TranslatedText>
        </Link>
      </div>

      {/* Language Switcher */}
      <div className="px-5 pb-3">
        <LanguageSwitcher />
      </div>

      {/* Sidebar Footer - Pill Styled Profile & Logout */}
      <div className="px-4 py-2 border-t border-sage-200">
        <div className="bg-white border border-sage-200 rounded-full p-2 flex items-center gap-3 shadow-sm transition-all hover:shadow-md">
           <Link 
            href="/dashboard/profile"
            className="w-10 h-10 rounded-full overflow-hidden bg-sage-100 flex-shrink-0 border border-sage-100 transition-transform hover:scale-105"
           >
             <PatientProfilePicture uid={user?.id} fallbackSrc={profileStore.isLoaded ? profileStore.imageUrl : user?.picture} initials={(profileStore.isLoaded ? profileStore.name : user?.given_name)?.[0]} />
           </Link>
           <div className="flex-1 min-w-0 pr-1">
             <p className="text-xs font-bold text-forest-900 truncate tracking-tight devanagari-small" lang={currentLocale}>{displayName || (profileStore.isLoaded ? profileStore.name : (user?.given_name ?? <TranslatedText>User</TranslatedText>))}</p>
             <p className="text-[10px] text-forest-500 truncate">{profileStore.isLoaded ? profileStore.email : user?.email}</p>
           </div>
           <SignOutButton>
             <button className="w-8 h-8 rounded-full flex items-center justify-center text-forest-400 hover:text-[var(--status-error)] hover:bg-[var(--error-container)] transition-colors" title={titleLogOut}>
               <LogOut size={16} strokeWidth={2} />
             </button>
           </SignOutButton>
        </div>
      </div>
    </aside>
  );
}

function SidebarNavItem({
  label,
  href,
  icon: Icon,
  active,
  highlighted,
}: {
  label: string;
  href: string;
  icon: any;
  active: boolean;
  highlighted?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-4 px-4 py-2 rounded-full transition-all ${
        highlighted
          ? 'bg-white text-forest-800 shadow-sm border border-sage-200'
          : active
          ? 'bg-white/80 text-forest-900'
          : 'text-forest-600 hover:bg-sage-100/70'
      }`}
    >
      <Icon 
        className="w-5 h-5 shrink-0"
        strokeWidth={highlighted ? 2 : 1.5}
        color={highlighted ? 'var(--forest-600)' : 'currentColor'}
      />
      <span
        className={`text-sm tracking-wide ${highlighted ? 'font-semibold text-forest-700' : 'font-medium'}`}
      >
        <TranslatedText>{label}</TranslatedText>
      </span>
    </Link>
  );
}

function SidebarHeader({ onToggle }: { onToggle?: () => void }) {
  const { text: titleCollapse } = useTranslation('Collapse Sidebar');
  return (
    <div className="px-4 py-3 border-b border-sage-200 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <Link href="/dashboard" className="flex items-center justify-center px-4">
          <img src="/AuraSutra-Full_BlackText-Transparent.png" alt="AuraSutra" className="h-12 w-auto object-contain" />
        </Link>
      </div>
      {onToggle && (
        <button
          onClick={onToggle}
          className="px-2 py-2 rounded-lg text-forest-400 hover:bg-sage-100 hover:text-forest-600 transition-colors"
          title={titleCollapse}
        >
          <PanelLeftClose size={20} strokeWidth={1.5} />
        </button>
      )}
    </div>
  );
}

function SidebarIconButton({
  icon: Icon,
  href,
  active,
  highlighted,
  title,
}: {
  icon: any;
  href: string;
  active: boolean;
  highlighted?: boolean;
  title?: string;
}) {
  return (
    <Link
      href={href}
      title={title}
      className={`flex items-center justify-center w-10 h-10 rounded-lg transition-colors ${
        highlighted
          ? 'bg-white text-forest-800 shadow-sm border border-sage-200'
          : active
          ? 'bg-white/80 text-forest-900'
          : 'text-forest-600 hover:bg-sage-100/50'
      }`}
    >
      <Icon 
        className="w-5 h-5"
        strokeWidth={highlighted ? 2 : 1.5}
        color={highlighted ? 'var(--forest-600)' : 'currentColor'}
      />
    </Link>
  );
}
