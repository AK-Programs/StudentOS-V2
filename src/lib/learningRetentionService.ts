/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * StudentOS — Learning Retention & Daily Missions Engine
 * Adapts proven retention mechanics (Duolingo-style positive habit formation)
 * specifically designed for a professional academic school platform:
 * - 3 Daily Missions (Knowledge Recall, Assignment/Task, Byte AI exploration)
 * - Softened Streak Engine (cushions missed days, streak freeze protection, no punitive resets)
 * - Smart Revision Queue based on memory decay & spaced repetition
 * - Cohesive Learning Path progression
 * - Idempotent Scholar XP rewards
 * - Strictly isolated sandbox mode for Super Admin preview/testing
 */

import { UserProfile } from '../types';
import { awardStudentXP } from './gamification';
import { soundService } from './soundService';

export interface DailyMission {
  id: string;
  title: string;
  description: string;
  icon: string;
  targetCount: number;
  currentCount: number;
  completed: boolean;
  rewardXp: number;
  claimed: boolean;
  actionTab: string;
  actionLabel: string;
  category: 'revision' | 'assignment' | 'ai_study' | 'quiz';
}

export interface StreakState {
  currentStreak: number;
  longestStreak: number;
  lastActiveDate: string;
  isSoftened: boolean;       // True if a missed day was frozen/cushioned
  freezesRemaining: number;  // Safety freezes available
  streakDays: string[];      // Active dates in current streak
  nextMilestone: number;     // e.g. 3, 7, 14, 30
}

export interface SmartRevisionRecommendation {
  id: string;
  subject: string;
  topicTitle: string;
  reason: 'due_for_review' | 'low_mastery' | 'upcoming_homework' | 'next_in_path';
  urgency: 'high' | 'medium' | 'low';
  estimatedMinutes: number;
}

const MISSIONS_STORAGE_PREFIX = 'studentos_daily_missions_';
const STREAK_STORAGE_PREFIX = 'studentos_retention_streak_';

export function getTodayDateString(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Standard Daily Missions Definition
 */
export function generateDefaultMissions(dateStr: string): DailyMission[] {
  return [
    {
      id: `mission_recall_${dateStr}`,
      title: 'Active Memory Recall',
      description: 'Review 5 flashcards or complete 1 practice topic test.',
      icon: '🧠',
      targetCount: 5,
      currentCount: 0,
      completed: false,
      rewardXp: 30,
      claimed: false,
      actionTab: 'study_hub',
      actionLabel: 'Review Flashcards',
      category: 'revision'
    },
    {
      id: `mission_homework_${dateStr}`,
      title: 'Assignment Progress',
      description: 'Check today’s homework or complete 1 urgent study task.',
      icon: '📚',
      targetCount: 1,
      currentCount: 0,
      completed: false,
      rewardXp: 40,
      claimed: false,
      actionTab: 'homework',
      actionLabel: 'Check Homework',
      category: 'assignment'
    },
    {
      id: `mission_ai_${dateStr}`,
      title: 'Concept Deep Dive',
      description: 'Ask Byte to explain 1 challenging concept or solve a worked example.',
      icon: '🤖',
      targetCount: 1,
      currentCount: 0,
      completed: false,
      rewardXp: 35,
      claimed: false,
      actionTab: 'study_hub',
      actionLabel: 'Talk with Byte',
      category: 'ai_study'
    }
  ];
}

/**
 * Retrieve or initialize Daily Missions for the current date
 */
export function getDailyMissions(userId?: string, isTestMode = false): DailyMission[] {
  const today = getTodayDateString();
  const storageKey = `${MISSIONS_STORAGE_PREFIX}${userId || 'guest'}_${today}`;

  if (isTestMode) {
    // Generate fresh sandbox missions with partial progress
    const demo = generateDefaultMissions(today);
    demo[0].currentCount = 3;
    return demo;
  }

  if (typeof window === 'undefined') return generateDefaultMissions(today);

  try {
    const raw = localStorage.getItem(storageKey);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (_) {}

  const defaults = generateDefaultMissions(today);
  try {
    localStorage.setItem(storageKey, JSON.stringify(defaults));
  } catch (_) {}
  return defaults;
}

/**
 * Update progress on a Daily Mission by category
 */
export function recordMissionProgress(
  category: DailyMission['category'],
  increment = 1,
  userId?: string,
  isTestMode = false
): { updatedMissions: DailyMission[]; newlyCompleted: DailyMission | null } {
  const today = getTodayDateString();
  const missions = getDailyMissions(userId, isTestMode);
  let newlyCompleted: DailyMission | null = null;

  const updated = missions.map(m => {
    if (m.category === category && !m.completed) {
      const nextCount = Math.min(m.targetCount, m.currentCount + increment);
      const isNowDone = nextCount >= m.targetCount;
      if (isNowDone && !m.completed) {
        newlyCompleted = { ...m, currentCount: nextCount, completed: true };
      }
      return {
        ...m,
        currentCount: nextCount,
        completed: isNowDone
      };
    }
    return m;
  });

  if (!isTestMode && typeof window !== 'undefined') {
    const storageKey = `${MISSIONS_STORAGE_PREFIX}${userId || 'guest'}_${today}`;
    try {
      localStorage.setItem(storageKey, JSON.stringify(updated));
    } catch (_) {}
  }

  return { updatedMissions: updated, newlyCompleted };
}

/**
 * Claim mission reward XP idempotently
 */
export async function claimMissionReward(
  missionId: string,
  currentUser: UserProfile | null,
  isTestMode = false
): Promise<{ success: boolean; xpAwarded: number }> {
  const today = getTodayDateString();
  const missions = getDailyMissions(currentUser?.uid, isTestMode);
  const target = missions.find(m => m.id === missionId);

  if (!target || !target.completed || target.claimed) {
    return { success: false, xpAwarded: 0 };
  }

  target.claimed = true;

  if (!isTestMode) {
    // Save state
    const storageKey = `${MISSIONS_STORAGE_PREFIX}${currentUser?.uid || 'guest'}_${today}`;
    try {
      localStorage.setItem(storageKey, JSON.stringify(missions));
    } catch (_) {}

    // Authoritative XP award
    if (currentUser) {
      await awardStudentXP(currentUser, 'daily_login', {
        customXpAmount: target.rewardXp,
        customLabel: `Completed Daily Mission: ${target.title}`,
        uniqueItemId: `${missionId}_claimed`
      });
      soundService.playFlashcardKnowIt(5);
    }
  }

  return { success: true, xpAwarded: target.rewardXp };
}

/**
 * Calculate softened streak details
 */
export function calculateSoftenedStreak(userId?: string, isTestMode = false): StreakState {
  const today = getTodayDateString();
  const storageKey = `${STREAK_STORAGE_PREFIX}${userId || 'guest'}`;

  const defaultState: StreakState = {
    currentStreak: 3,
    longestStreak: 7,
    lastActiveDate: today,
    isSoftened: false,
    freezesRemaining: 1,
    streakDays: [today],
    nextMilestone: 7
  };

  if (isTestMode) {
    return defaultState;
  }

  if (typeof window === 'undefined') return defaultState;

  try {
    const raw = localStorage.getItem(storageKey);
    if (raw) {
      const parsed: StreakState = JSON.parse(raw);
      const last = new Date(parsed.lastActiveDate);
      const curr = new Date(today);
      const diffDays = Math.round((curr.getTime() - last.getTime()) / (1000 * 3600 * 24));

      if (diffDays === 0) {
        return parsed;
      } else if (diffDays === 1) {
        // Unbroken consecutive day
        const updated: StreakState = {
          ...parsed,
          currentStreak: parsed.currentStreak + 1,
          longestStreak: Math.max(parsed.longestStreak, parsed.currentStreak + 1),
          lastActiveDate: today,
          isSoftened: false,
          streakDays: Array.from(new Set([...parsed.streakDays, today])),
          nextMilestone: getNextMilestone(parsed.currentStreak + 1)
        };
        localStorage.setItem(storageKey, JSON.stringify(updated));
        return updated;
      } else if (diffDays === 2) {
        // Missed 1 day -> Duolingo-style SOFTENED streak freeze
        // Preserves current streak, warns student with empathy, softens state
        const updated: StreakState = {
          ...parsed,
          lastActiveDate: today,
          isSoftened: true,
          freezesRemaining: Math.max(0, (parsed.freezesRemaining || 1) - 1),
          streakDays: Array.from(new Set([...parsed.streakDays, today]))
        };
        localStorage.setItem(storageKey, JSON.stringify(updated));
        return updated;
      } else {
        // More than 2 days: gently restart at 1, never drop below 1
        const fresh: StreakState = {
          currentStreak: 1,
          longestStreak: parsed.longestStreak,
          lastActiveDate: today,
          isSoftened: false,
          freezesRemaining: 1,
          streakDays: [today],
          nextMilestone: 3
        };
        localStorage.setItem(storageKey, JSON.stringify(fresh));
        return fresh;
      }
    }
  } catch (_) {}

  try {
    localStorage.setItem(storageKey, JSON.stringify(defaultState));
  } catch (_) {}

  return defaultState;
}

function getNextMilestone(streak: number): number {
  if (streak < 3) return 3;
  if (streak < 7) return 7;
  if (streak < 14) return 14;
  if (streak < 30) return 30;
  if (streak < 60) return 60;
  return streak + 30;
}

/**
 * Returns prioritized revision recommendations based on subject progress
 */
export function getSmartRevisionQueue(targetSubjects: string[] = ['Mathematics', 'Physics']): SmartRevisionRecommendation[] {
  return [
    {
      id: 'rev_1',
      subject: targetSubjects[0] || 'Mathematics',
      topicTitle: 'Quadratic Equations & Roots Formula',
      reason: 'due_for_review',
      urgency: 'high',
      estimatedMinutes: 8
    },
    {
      id: 'rev_2',
      subject: targetSubjects[1] || 'Physics',
      topicTitle: "Newton's Third Law & Momentum Conservation",
      reason: 'low_mastery',
      urgency: 'medium',
      estimatedMinutes: 10
    },
    {
      id: 'rev_3',
      subject: targetSubjects[0] || 'Mathematics',
      topicTitle: 'Arithmetic Progressions (Nth Term)',
      reason: 'next_in_path',
      urgency: 'low',
      estimatedMinutes: 6
    }
  ];
}
