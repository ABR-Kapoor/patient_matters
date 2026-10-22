export const Colors = {
  light: {
    text: '#000000',
    background: '#ffffff',
    backgroundElement: '#F0F0F3',
    backgroundSelected: '#E0E1E6',
    textSecondary: '#60646C',
  },
  dark: {
    text: '#ffffff',
    background: '#000000',
    backgroundElement: '#212225',
    backgroundSelected: '#2E3135',
    textSecondary: '#B0B4BA',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const MaxContentWidth = 800;

export const COLORS = {
  primary: '#048256', // Patient App Theme
  primaryLight: '#ECFDF5',
  text: '#030315',        // Dark Navy/Black
  background: '#FFFFFF',  // White
  surface: '#F2F1F0',     // Light Gray/Off-white
  error: '#EF4444',
  success: '#10B981',
  completeBtnBg: '#ECFDF5',
  completeBtnBorder: '#A7F3D0',
  completeBtnText: '#059669',
  white: '#FFFFFF',
  black: '#030315',
  gray: '#9CA3AF',
  lightGray: '#E5E7EB',
} as const;

export const SIZES = {
  base: 8,
  small: 12,
  font: 14,
  medium: 16,
  large: 18,
  extraLarge: 24,
  padding: 24,
  radius: 16,
  cardRadius: 24,
} as const;

export const SHADOWS = {
  light: {
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  medium: {
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 15,
    elevation: 5,
  },
} as const;
