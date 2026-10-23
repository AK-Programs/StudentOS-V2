/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * StudentOS — User Onboarding & Guided Tour Persistence Service
 * Stores non-sensitive learning preferences and tour completion state
 * with local caching and Supabase synchronization.
 */

import { UserProfile } from '../types';
import { setLanguage } from './i18n';
import { byteVoiceService } from './byteVoiceService';

export interface LearningPreferences {
  targetSubjects: string[];
  explanationStyle: 'step_by_step' | 'examples' | 'visuals' | 'summaries' | 'practice_questions';
  autoVoice: boolean;
  sessionPace: 'short' | 'standard';
  revisionReminders: boolean;
  speakingLanguage: 'mixed' | 'hi' | 'en';
  interfaceLanguage: 'en' | 'hi';
  hindiVoiceId?: string;
  englishVoiceId?: string;
}

export interface OnboardingState {
  version: number;
  completed: boolean;
  currentStep: 'welcome' | 'language' | 'preferences' | 'tour' | 'finish';
  skippedSteps: string[];
  tourCompleted: boolean;
  tourSkipped: boolean;
  preferences: LearningPreferences;
  completedAt?: string;
}

export const CURRENT_ONBOARDING_VERSION = 1;

export const DEFAULT_LEARNING_PREFERENCES: LearningPreferences = {
  targetSubjects: ['Mathematics', 'Science', 'English'],
  explanationStyle: 'step_by_step',
  autoVoice: true,
  sessionPace: 'short',
  revisionReminders: true,
  speakingLanguage: 'mixed',
  interfaceLanguage: 'en',
  hindiVoiceId: 'hi-IN-SwaraNeural',
  englishVoiceId: 'en-IN-NeerjaNeural'
};

export const DEFAULT_ONBOARDING_STATE: OnboardingState = {
  version: CURRENT_ONBOARDING_VERSION,
  completed: false,
  currentStep: 'welcome',
  skippedSteps: [],
  tourCompleted: false,
  tourSkipped: false,
  preferences: DEFAULT_LEARNING_PREFERENCES
};

const STORAGE_KEY_PREFIX = 'studentos_onboarding_';

export function getOnboardingStorageKey(userId?: string): string {
  return `${STORAGE_KEY_PREFIX}${userId || 'guest'}`;
}

export function getOnboardingState(userId?: string): OnboardingState {
  if (typeof window === 'undefined') return DEFAULT_ONBOARDING_STATE;
  try {
    const key = getOnboardingStorageKey(userId);
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        ...DEFAULT_ONBOARDING_STATE,
        ...parsed,
        preferences: {
          ...DEFAULT_LEARNING_PREFERENCES,
          ...(parsed.preferences || {})
        }
      };
    }
  } catch (_) {}
  return { ...DEFAULT_ONBOARDING_STATE };
}

export async function saveOnboardingState(
  userId: string | undefined,
  partial: Partial<OnboardingState>
): Promise<OnboardingState> {
  const current = getOnboardingState(userId);
  const updated: OnboardingState = {
    ...current,
    ...partial,
    preferences: {
      ...current.preferences,
      ...(partial.preferences || {})
    }
  };

  const key = getOnboardingStorageKey(userId);
  try {
    localStorage.setItem(key, JSON.stringify(updated));
  } catch (_) {}

  // Apply interface language immediately if changed
  if (updated.preferences.interfaceLanguage) {
    setLanguage(updated.preferences.interfaceLanguage);
  }

  // Update Byte voice preference
  if (updated.preferences.speakingLanguage) {
    byteVoiceService.updatePreferences({
      preferredLanguage: updated.preferences.speakingLanguage,
      autoSpeak: updated.preferences.autoVoice
    });
  }

  // Sync to Supabase global_data / user_profiles when online & authenticated
  if (userId && userId !== 'guest' && typeof window !== 'undefined') {
    try {
      const supabaseUrl = (import.meta as any).env?.VITE_SUPABASE_URL || 'https://zwpoutanhsujezglbson.supabase.co';
      const supabaseKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp3cG91dGFuaHN1amV6Z2xic29uIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE2OTA2MDEsImV4cCI6MjA5NzI2NjYwMX0.Y48u9duD3WohxzDD6czXevPaG1mFRFS0rdRuu4840pQ';
      
      await fetch(`${supabaseUrl}/rest/v1/global_data?on_conflict=id`, {
        method: 'POST',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'resolution=merge-duplicates'
        },
        body: JSON.stringify({
          id: `__onboarding_state_${userId}__`,
          data: updated,
          updated_at: new Date().toISOString()
        })
      });
    } catch (sbErr) {
      console.warn('[OnboardingService] Supabase sync notice:', sbErr);
    }
  }

  return updated;
}

/**
 * Checks whether onboarding should appear for this user.
 * - Eligible new users who have not completed version 1
 * - Does NOT force existing users who already completed it
 */
export function shouldShowOnboarding(user: UserProfile | null): boolean {
  if (!user) return false;
  // If user explicitly has onboardingCompleted in their profile data, respect it
  if (user.raw_data?.onboarding_completed) return false;

  const state = getOnboardingState(user.uid || user.email);
  return !state.completed;
}

/**
 * Allows a student or administrator to restart the onboarding & tour
 */
export function restartOnboarding(userId?: string): void {
  const key = getOnboardingStorageKey(userId);
  try {
    localStorage.removeItem(key);
  } catch (_) {}
}
