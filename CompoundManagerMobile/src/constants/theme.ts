/**
 * Compound Manager brand theme — jasmine / garden inspired.
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Brand = {
  primary: '#1B5E45',
  primaryDark: '#0F3D2E',
  primarySoft: '#E8F5EF',
  accent: '#C4A35A',
  accentSoft: '#F7F1E1',
  danger: '#B91C1C',
  background: '#F4F7F5',
  surface: '#FFFFFF',
  border: '#D7E3DC',
  text: '#14231C',
  textSecondary: '#5B6B63',
  muted: '#8A9A92',
} as const;

export const Colors = {
  light: {
    text: Brand.text,
    background: Brand.surface,
    backgroundElement: Brand.primarySoft,
    backgroundSelected: Brand.border,
    textSecondary: Brand.textSecondary,
  },
  dark: {
    text: '#ffffff',
    background: Brand.primaryDark,
    backgroundElement: '#1A4A38',
    backgroundSelected: '#246048',
    textSecondary: '#B7C9BF',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
