/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * StudentOS Global Theme & Color Accent Engine
 * Supports 7 Themes (Default, Midnight, Ocean, Aurora, Paper, Claymorphism, Glassmorphism)
 * and 4 Color Accents (Indigo, Emerald, Amber, Rose) across all UI elements.
 */

import React, { useState, useEffect } from 'react';
import { supabase } from './supabase';
import { UserProfile } from '../types';
import { saveSupabaseUserProfile } from './supabaseUsers';

export type ThemeId = 'default' | 'midnight' | 'ocean' | 'aurora' | 'paper' | 'claymorphism' | 'glassmorphism';
export type ThemeAccent = 'indigo' | 'emerald' | 'amber' | 'rose';

export interface ThemeAccentConfig {
  id: ThemeAccent;
  name: string;
  primary: string;
  primaryHover: string;
  accent: string;
  badgeBg: string;
  badgeText: string;
}

export const THEME_ACCENTS: Record<ThemeAccent, ThemeAccentConfig> = {
  indigo: {
    id: 'indigo',
    name: 'Indigo & Sky',
    primary: '#6366f1',
    primaryHover: '#4f46e5',
    accent: '#38bdf8',
    badgeBg: 'rgba(99, 102, 241, 0.2)',
    badgeText: '#818cf8'
  },
  emerald: {
    id: 'emerald',
    name: 'Emerald & Teal',
    primary: '#10b981',
    primaryHover: '#059669',
    accent: '#14b8a6',
    badgeBg: 'rgba(16, 185, 129, 0.2)',
    badgeText: '#34d399'
  },
  amber: {
    id: 'amber',
    name: 'Amber & Gold',
    primary: '#f59e0b',
    primaryHover: '#d97706',
    accent: '#fbbf24',
    badgeBg: 'rgba(245, 158, 11, 0.2)',
    badgeText: '#fcd34d'
  },
  rose: {
    id: 'rose',
    name: 'Rose & Coral',
    primary: '#f43f5e',
    primaryHover: '#e11d48',
    accent: '#fb7185',
    badgeBg: 'rgba(244, 63, 94, 0.2)',
    badgeText: '#fda4af'
  }
};

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
    themeColor: string;
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
  },
  claymorphism: {
    id: 'claymorphism',
    name: 'Claymorphism 3D',
    tagline: 'Soft inflated cards, thick rounded corners & pastel depth',
    isDark: true,
    colors: {
      background: '#0d1424',
      surface: 'rgba(22, 33, 54, 0.9)',
      surfaceSecondary: '#162136',
      surfaceTertiary: '#1e2d4a',
      text: '#f1f5f9',
      textMuted: '#94a3b8',
      textSubtle: '#64748b',
      primary: '#6366f1',
      primaryHover: '#4f46e5',
      border: 'rgba(255, 255, 255, 0.15)',
      accent: '#38bdf8',
      themeColor: '#0d1424'
    },
    previewGradient: 'from-indigo-950 via-slate-900 to-blue-950'
  },
  glassmorphism: {
    id: 'glassmorphism',
    name: 'Glassmorphism',
    tagline: 'Translucent frosted glass, heavy blur & layered depth',
    isDark: true,
    colors: {
      background: '#030712',
      surface: 'rgba(15, 23, 42, 0.35)',
      surfaceSecondary: '#0f172a',
      surfaceTertiary: '#1e293b',
      text: '#f8fafc',
      textMuted: '#cbd5e1',
      textSubtle: '#94a3b8',
      primary: '#6366f1',
      primaryHover: '#4f46e5',
      border: 'rgba(255, 255, 255, 0.22)',
      accent: '#38bdf8',
      themeColor: '#030712'
    },
    previewGradient: 'from-blue-950 via-slate-950 to-indigo-950'
  },
  halloween: {
    id: 'halloween',
    name: 'Halloween Spook',
    tagline: 'Midnight Pumpkin & Cursed Purple',
    isDark: true,
    colors: {
      background: '#0c0211',
      surface: 'rgba(28, 10, 42, 0.75)',
      surfaceSecondary: '#160822',
      surfaceTertiary: '#240d36',
      text: '#f8fafc',
      textMuted: '#d8b4fe',
      textSubtle: '#a855f7',
      primary: '#f97316',
      primaryHover: '#ea580c',
      border: 'rgba(249, 115, 22, 0.15)',
      accent: '#9333ea',
      themeColor: '#0c0211'
    },
    previewGradient: 'from-orange-950 via-purple-950 to-black'
  }
};

const THEME_STORAGE_KEY = 'studentos_theme';
const ACCENT_STORAGE_KEY = 'studentos_accent';

export function getSavedTheme(): ThemeId {
  if (typeof window === 'undefined') return 'default';
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY) as ThemeId;
    if (stored && STUDENTOS_THEMES[stored]) return stored;
  } catch (_) {}
  return 'default';
}

export function getSavedAccent(): ThemeAccent {
  if (typeof window === 'undefined') return 'indigo';
  try {
    const stored = localStorage.getItem(ACCENT_STORAGE_KEY) as ThemeAccent;
    if (stored && THEME_ACCENTS[stored]) return stored;
  } catch (_) {}
  return 'indigo';
}

export function applyTheme(themeId: ThemeId, accent: ThemeAccent = 'indigo') {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  const theme = STUDENTOS_THEMES[themeId] || STUDENTOS_THEMES.default;
  const accentCfg = THEME_ACCENTS[accent] || THEME_ACCENTS.indigo;
  const root = document.documentElement;

  root.setAttribute('data-theme', theme.id);
  root.setAttribute('data-accent', accentCfg.id);

  Object.keys(STUDENTOS_THEMES).forEach(id => {
    root.classList.remove(`theme-${id}`);
  });
  root.classList.add(`theme-${theme.id}`);

  Object.keys(THEME_ACCENTS).forEach(acc => {
    root.classList.remove(`accent-${acc}`);
  });
  root.classList.add(`accent-${accentCfg.id}`);

  if (!theme.isDark) {
    root.classList.add('light-theme');
    document.body?.classList.add('light-theme');
  } else {
    root.classList.remove('light-theme');
    document.body?.classList.remove('light-theme');
  }

  root.style.setProperty('--background', theme.colors.background);
  root.style.setProperty('--surface', theme.colors.surface);
  root.style.setProperty('--surface-secondary', theme.colors.surfaceSecondary);
  root.style.setProperty('--surface-tertiary', theme.colors.surfaceTertiary);
  root.style.setProperty('--text', theme.colors.text);
  root.style.setProperty('--text-muted', theme.colors.textMuted);
  root.style.setProperty('--text-subtle', theme.colors.textSubtle);
  root.style.setProperty('--primary', accentCfg.primary);
  root.style.setProperty('--primary-hover', accentCfg.primaryHover);
  root.style.setProperty('--border', theme.colors.border);
  root.style.setProperty('--accent', accentCfg.accent);

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

  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme.id);
    localStorage.setItem(ACCENT_STORAGE_KEY, accentCfg.id);
  } catch (_) {}

  window.dispatchEvent(new CustomEvent('studentos_theme_changed', { detail: { themeId: theme.id, accent: accentCfg.id } }));
}

export async function saveThemePreference(themeId: ThemeId, accent: ThemeAccent, currentUser?: UserProfile | null): Promise<void> {
  applyTheme(themeId, accent);

  if (!currentUser?.uid && !currentUser?.email) return;

  try {
    const updatedProfile: UserProfile = {
      ...currentUser,
      raw_data: {
        ...(currentUser.raw_data || {}),
        theme: themeId,
        accent: accent
      }
    };
    await saveSupabaseUserProfile(updatedProfile);
  } catch (err) {
    console.warn('[ThemeSystem] Failed to save theme preference to Supabase:', err);
  }
}

export function useTheme(currentUser?: UserProfile | null) {
  const [currentTheme, setCurrentTheme] = useState<ThemeId>(() => {
    const profileTheme = currentUser?.raw_data?.theme as ThemeId;
    if (profileTheme && STUDENTOS_THEMES[profileTheme]) return profileTheme;
    return getSavedTheme();
  });

  const [currentAccent, setCurrentAccent] = useState<ThemeAccent>(() => {
    const profileAccent = currentUser?.raw_data?.accent as ThemeAccent;
    if (profileAccent && THEME_ACCENTS[profileAccent]) return profileAccent;
    return getSavedAccent();
  });

  useEffect(() => {
    const profileTheme = currentUser?.raw_data?.theme as ThemeId;
    const profileAccent = currentUser?.raw_data?.accent as ThemeAccent;
    if (profileTheme && STUDENTOS_THEMES[profileTheme] && profileTheme !== currentTheme) {
      setCurrentTheme(profileTheme);
    }
    if (profileAccent && THEME_ACCENTS[profileAccent] && profileAccent !== currentAccent) {
      setCurrentAccent(profileAccent);
    }
    if ((profileTheme && STUDENTOS_THEMES[profileTheme]) || (profileAccent && THEME_ACCENTS[profileAccent])) {
      applyTheme(profileTheme || currentTheme, profileAccent || currentAccent);
    }
  }, [currentUser?.raw_data?.theme, currentUser?.raw_data?.accent]);

  useEffect(() => {
    const handleThemeEvent = (e: any) => {
      if (e.detail?.themeId && STUDENTOS_THEMES[e.detail.themeId as ThemeId]) {
        setCurrentTheme(e.detail.themeId as ThemeId);
      }
      if (e.detail?.accent && THEME_ACCENTS[e.detail.accent as ThemeAccent]) {
        setCurrentAccent(e.detail.accent as ThemeAccent);
      }
    };
    window.addEventListener('studentos_theme_changed', handleThemeEvent);
    return () => window.removeEventListener('studentos_theme_changed', handleThemeEvent);
  }, []);

  const changeTheme = async (newTheme: ThemeId, newAccent?: ThemeAccent) => {
    const targetAccent = newAccent || currentAccent;
    setCurrentTheme(newTheme);
    setCurrentAccent(targetAccent);
    await saveThemePreference(newTheme, targetAccent, currentUser);
  };

  const changeAccent = async (newAccent: ThemeAccent) => {
    setCurrentAccent(newAccent);
    await saveThemePreference(currentTheme, newAccent, currentUser);
  };

  return {
    currentTheme,
    currentAccent,
    theme: STUDENTOS_THEMES[currentTheme],
    accent: THEME_ACCENTS[currentAccent],
    changeTheme,
    changeAccent,
    themes: Object.values(STUDENTOS_THEMES),
    accents: Object.values(THEME_ACCENTS)
  };
}
