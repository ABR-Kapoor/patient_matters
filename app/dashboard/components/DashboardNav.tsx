'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  LayoutDashboard,
  Calendar,
  Stethoscope,
  Pill,
  UserCircle,
} from 'lucide-react';
import { TranslatedText } from '@/app/components/TranslatedText';

const navigation = [
  { name: 'Dashboard', href: '/dashboard', iconName: 'LayoutDashboard' },
  { name: 'Find Doctors', href: '/dashboard/find-doctors', iconName: 'Stethoscope' },
  { name: 'Appointments', href: '/dashboard/appointments', iconName: 'Calendar' },
  { name: 'Prescriptions', href: '/dashboard/prescriptions', iconName: 'Pill' },
  { name: 'Profile', href: '/dashboard/profile', iconName: 'UserCircle' },
];

const iconMap = {
  LayoutDashboard,
  Calendar,
  Stethoscope,
  Pill,
  UserCircle,
};

interface DashboardNavProps {
  isExpanded: boolean;
  onToggle: () => void;
}

export default function DashboardNav({ isExpanded, onToggle }: DashboardNavProps) {
  const pathname = usePathname() || '';

  return (
    <nav className="flex-1 px-4 space-y-2 flex flex-col bg-sage-50">
      {/* Items */}
      <div className="space-y-2 flex-1 pt-4">
        {navigation.map((item) => {
          const isActive =
            item.href === '/dashboard'
              ? pathname === '/dashboard'
              : pathname.startsWith(item.href);

          const IconComponent = iconMap[item.iconName as keyof typeof iconMap];

          if (!IconComponent) {
            return null;
          }

          const isHighlighted = item.href === '/dashboard/find-doctors';

          return (
            <Link
              key={item.name}
              href={item.href}
              title={!isExpanded ? item.name : undefined}
              className={`
                flex items-center gap-3 px-4 py-3 rounded-2xl smooth-transition group
                ${isExpanded ? '' : 'justify-center'}
                ${
                  isHighlighted
                    ? 'bg-primary text-white shadow-sm'
                    : isActive
                    ? 'bg-white/50 text-forest-700'
                    : 'text-forest-600 hover:bg-white/30'
                }
              `}
            >
              <IconComponent
                className={`shrink-0 smooth-transition ${
                  isExpanded ? 'w-5 h-5' : 'w-5 h-5'
                }`}
                strokeWidth={2}
                color={isHighlighted ? 'white' : 'currentColor'}
              />
              {isExpanded && (
                <span
                  className={`text-sm font-semibold tracking-wide`}
                  style={{
                    color: isHighlighted ? 'white' : 'var(--color-forest-500)',
                    fontSize: '0.8rem',
                    letterSpacing: '0.5px',
                  }}
                >
                  <TranslatedText>{item.name}</TranslatedText>
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
