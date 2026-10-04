import { useState, useEffect } from 'react';
import { supabase } from './supabase';
import { UserProfile } from '../types';
import { saveSupabaseUserProfile } from './supabaseUsers';

export type ThemeId = 'default' | 'midnight' | 'ocean' | 'aurora' | 'paper';

export interface ThemeDefinition {
  id: ThemeId;
  name: string;
  tagline: string;
  isDark: boolean;
  colors: {
    background: string;
    surface: string;
    surfaceSecondary: string;
    surfaceTertiary: string;
    text: string;
    textMuted: string;
    textSubtle: string;
    primary: string;
    primaryHover: string;
    border: string;
    accent: string;
    themeColor: string; // for <meta name="theme-color">
  };
  previewGradient: string;
}

export const STUDENTOS_THEMES: Record<ThemeId, ThemeDefinition> = {
  default: {
    id: 'default',
    name: 'StudentOS Default',
    tagline: 'Cyber Slate & Deep Indigo',
    isDark: true,
    colors: {
      background: '#030712',
      surface: 'rgba(15, 23, 42, 0.75)',
      surfaceSecondary: '#0f172a',
      surfaceTertiary: '#1e293b',
      text: '#f8fafc',
      textMuted: '#94a3b8',
      textSubtle: '#64748b',
      primary: '#6366f1',
      primaryHover: '#4f46e5',
      border: 'rgba(255, 255, 255, 0.08)',
      accent: '#38bdf8',
      themeColor: '#030712'
    },
    previewGradient: 'from-slate-950 via-slate-900 to-indigo-950'
  },
  midnight: {
    id: 'midnight',
    name: 'Midnight Void',
    tagline: 'AMOLED Pure Black & Neon Violet',
    isDark: true,
    colors: {
      background: '#000000',
      surface: 'rgba(10, 10, 12, 0.85)',
      surfaceSecondary: '#09090b',
      surfaceTertiary: '#18181b',
      text: '#fafafa',
      textMuted: '#a1a1aa',
      textSubtle: '#71717a',
      primary: '#a855f7',
      primaryHover: '#9333ea',
      border: 'rgba(255, 255, 255, 0.12)',
      accent: '#ec4899',
      themeColor: '#000000'
    },
    previewGradient: 'from-black via-zinc-950 to-purple-950'
  },
  ocean: {
    id: 'ocean',
    name: 'Abyssal Ocean',
    tagline: 'Deep Marine & Luminous Cyan',
    isDark: true,
    colors: {
      background: '#02101e',
      surface: 'rgba(4, 25, 48, 0.8)',
      surfaceSecondary: '#052240',
      surfaceTertiary: '#0b3764',
      text: '#f0f9ff',
      textMuted: '#7dd3fc',
      textSubtle: '#38bdf8',
      primary: '#06b6d4',
      primaryHover: '#0891b2',
      border: 'rgba(56, 189, 248, 0.18)',
      accent: '#2dd4bf',
      themeColor: '#02101e'
    },
    previewGradient: 'from-sky-950 via-cyan-950 to-blue-950'
  },
  aurora: {
    id: 'aurora',
    name: 'Nordic Aurora',
    tagline: 'Boreal Pine & Radiant Emerald',
    isDark: true,
    colors: {
      background: '#021610',
      surface: 'rgba(3, 34, 24, 0.8)',
      surfaceSecondary: '#052e20',
      surfaceTertiary: '#0b4733',
      text: '#f0fdf4',
      textMuted: '#86efac',
      textSubtle: '#4ade80',
      primary: '#10b981',
      primaryHover: '#059669',
      border: 'rgba(52, 211, 153, 0.18)',
      accent: '#14b8a6',
      themeColor: '#021610'
    },
    previewGradient: 'from-teal-950 via-emerald-950 to-slate-950'
  },
  paper: {
    id: 'paper',
    name: 'Paper / Light',
    tagline: 'Editorial Alabaster & Crisp Ink',
    isDark: false,
    colors: {
      background: '#f8fafc',
      surface: '#ffffff',
      surfaceSecondary: '#f1f5f9',
      surfaceTertiary: '#e2e8f0',
      text: '#0f172a',
      textMuted: '#475569',
      textSubtle: '#64748b',
      primary: '#4f46e5',
      primaryHover: '#4338ca',
      border: 'rgba(15, 23, 42, 0.08)',
      accent: '#0284c7',
      themeColor: '#f8fafc'
    },
    previewGradient: 'from-slate-100 via-white to-blue-50'
  }
};

const THEME_STORAGE_KEY = 'studentos_theme';

/**
 * Reads the active theme from localStorage or returns default
 */
export function getSavedTheme(): ThemeId {
  if (typeof window === 'undefined') return 'default';
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY) as ThemeId;
    if (stored && STUDENTOS_THEMES[stored]) return stored;
  } catch (_) {}
  return 'default';
}

/**
 * Applies theme CSS variables to document root, updates <meta name="theme-color">,
 * and sets the data-theme attribute on <html>.
 */
export function applyTheme(themeId: ThemeId) {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  const theme = STUDENTOS_THEMES[themeId] || STUDENTOS_THEMES.default;
  const root = document.documentElement;

  // Set data-theme attribute
  root.setAttribute('data-theme', theme.id);

  // Toggle theme classes
  Object.keys(STUDENTOS_THEMES).forEach(id => {
    root.classList.remove(`theme-${id}`);
  });
  root.classList.add(`theme-${theme.id}`);

  // Backwards compatibility with light-theme class
  if (!theme.isDark) {
    root.classList.add('light-theme');
    document.body?.classList.add('light-theme');
  } else {
    root.classList.remove('light-theme');
    document.body?.classList.remove('light-theme');
  }

  // Set CSS Variables
  root.style.setProperty('--background', theme.colors.background);
  root.style.setProperty('--surface', theme.colors.surface);
  root.style.setProperty('--surface-secondary', theme.colors.surfaceSecondary);
  root.style.setProperty('--surface-tertiary', theme.colors.surfaceTertiary);
  root.style.setProperty('--text', theme.colors.text);
  root.style.setProperty('--text-muted', theme.colors.textMuted);
  root.style.setProperty('--text-subtle', theme.colors.textSubtle);
  root.style.setProperty('--primary', theme.colors.primary);
  root.style.setProperty('--primary-hover', theme.colors.primaryHover);
  root.style.setProperty('--border', theme.colors.border);
  root.style.setProperty('--accent', theme.colors.accent);

  // Update <meta name="theme-color"> for mobile status bar / PWA window frame
  try {
    let metaTag = document.querySelector('meta[name="theme-color"]');
    if (!metaTag) {
      metaTag = document.createElement('meta');
      metaTag.setAttribute('name', 'theme-color');
      document.head.appendChild(metaTag);
    }
    metaTag.setAttribute('content', theme.colors.themeColor);
  } catch (err) {
    console.warn('[ThemeSystem] Error updating meta theme-color:', err);
  }

  // Persist locally for zero-flicker reload
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme.id);
  } catch (_) {}

  // Dispatch global event for subscribers
  window.dispatchEvent(new CustomEvent('studentos_theme_changed', { detail: { themeId: theme.id } }));
}

/**
 * Saves the selected theme to Supabase user profile so it persists
 * across devices, logins, web, and installed app.
 */
export async function saveThemePreference(themeId: ThemeId, currentUser?: UserProfile | null): Promise<void> {
  applyTheme(themeId);

  if (!currentUser?.uid && !currentUser?.email) return;

  try {
    const updatedProfile: UserProfile = {
      ...currentUser,
      raw_data: {
        ...(currentUser.raw_data || {}),
        theme: themeId
      }
    };
    await saveSupabaseUserProfile(updatedProfile);
  } catch (err) {
    console.warn('[ThemeSystem] Failed to save theme preference to Supabase:', err);
  }
}

/**
 * React hook to observe and change the active StudentOS theme
 */
export function useTheme(currentUser?: UserProfile | null) {
  const [currentTheme, setCurrentTheme] = useState<ThemeId>(() => {
    // 1. Check user profile preference from Supabase
    const profileTheme = currentUser?.raw_data?.theme as ThemeId;
    if (profileTheme && STUDENTOS_THEMES[profileTheme]) {
      return profileTheme;
    }
    // 2. Check local storage
    return getSavedTheme();
  });

  // Sync if currentUser's Supabase profile loads with a saved theme
  useEffect(() => {
    const profileTheme = currentUser?.raw_data?.theme as ThemeId;
    if (profileTheme && STUDENTOS_THEMES[profileTheme] && profileTheme !== currentTheme) {
      setCurrentTheme(profileTheme);
      applyTheme(profileTheme);
    }
  }, [currentUser?.raw_data?.theme]);

  // Listen to external theme changes
  useEffect(() => {
    const handleThemeEvent = (e: any) => {
      if (e.detail?.themeId && STUDENTOS_THEMES[e.detail.themeId as ThemeId]) {
        setCurrentTheme(e.detail.themeId as ThemeId);
      }
    };
    window.addEventListener('studentos_theme_changed', handleThemeEvent);
    return () => window.removeEventListener('studentos_theme_changed', handleThemeEvent);
  }, []);

  const changeTheme = async (newTheme: ThemeId) => {
    setCurrentTheme(newTheme);
    await saveThemePreference(newTheme, currentUser);
  };

  return {
    currentTheme,
    theme: STUDENTOS_THEMES[currentTheme],
    changeTheme,
    themes: Object.values(STUDENTOS_THEMES)
  };
}
