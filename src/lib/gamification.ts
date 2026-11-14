/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * StudentOS Academic Gamification Engine
 * Manages XP, 10 Scholar Levels, Daily Study Streaks, 9 Core Badges,
 * Anti-Spam Action Deduplication, and Class/School Leaderboards.
 */

import { HouseType, SectionType, UserRole } from '../types';
import { supabase } from './supabase';
import { soundService } from './soundService';
import { buildAuthHeadersForUser } from './featureAccessService';
import { awardServerActionXp, fetchSeparatedLeaderboard } from './winterFestivalService';

export type GamificationActionType =
  | 'daily_login'
  | 'complete_homework'
  | 'study_flashcards'
  | 'complete_quiz'
  | 'quiz_high_score'
  | 'create_note'
  | 'use_ai_study'
  | 'read_notice'
  | 'brain_battle_round'
  | 'brain_battle_perfect'
  | 'brain_battle_daily'
  | 'brain_battle_multiplayer_win';

export interface LevelDefinition {
  level: number;
  title: string;
  minXp: number;
  icon: string;
  color: string;
}

export const SCHOLAR_LEVELS: LevelDefinition[] = [
  { level: 1, title: 'Rookie Scholar', minXp: 0, icon: '🌱', color: 'from-slate-500 to-slate-600' },
  { level: 2, title: 'Curious Learner', minXp: 100, icon: '🔍', color: 'from-sky-500 to-blue-600' },
  { level: 3, title: 'Active Student', minXp: 250, icon: '📘', color: 'from-cyan-500 to-teal-600' },
  { level: 4, title: 'Focused Scholar', minXp: 450, icon: '🎯', color: 'from-emerald-500 to-green-600' },
  { level: 5, title: 'Knowledge Builder', minXp: 700, icon: '🏛️', color: 'from-indigo-500 to-blue-700' },
  { level: 6, title: 'Academic Achiever', minXp: 1000, icon: '⚡', color: 'from-violet-500 to-purple-600' },
  { level: 7, title: 'Top Performer', minXp: 1400, icon: '🌟', color: 'from-fuchsia-500 to-pink-600' },
  { level: 8, title: 'Honor Student', minXp: 1900, icon: '🏅', color: 'from-amber-500 to-orange-600' },
  { level: 9, title: 'Master Scholar', minXp: 2500, icon: '👑', color: 'from-rose-500 to-red-600' },
  { level: 10, title: 'Campus Legend', minXp: 3200, icon: '🏆', color: 'from-yellow-400 via-amber-500 to-orange-600' },
];

export interface BadgeDefinition {
  id: string;
  name: string;
  description: string;
  unlockRequirement: string;
  icon: string;
  category: 'milestone' | 'streak' | 'academic' | 'leaderboard';
}

export const GAMIFICATION_BADGES: BadgeDefinition[] = [
  {
    id: 'first_steps',
    name: 'First Steps',
    description: 'Embarked on your StudentOS academic journey.',
    unlockRequirement: 'Complete your first study action',
    icon: '🚀',
    category: 'milestone'
  },
  {
    id: 'streak_3',
    name: '3-Day Streak',
    description: 'Consistent daily learning habit established.',
    unlockRequirement: 'Study 3 days in a row',
    icon: '🔥',
    category: 'streak'
  },
  {
    id: 'streak_7',
    name: '7-Day Streak',
    description: 'A full week of unbroken academic dedication.',
    unlockRequirement: 'Study 7 days in a row',
    icon: '⚡',
    category: 'streak'
  },
  {
    id: 'homework_hero',
    name: 'Homework Hero',
    description: 'Dependable scholar who stays ahead of assignments.',
    unlockRequirement: 'Complete 5 homework items',
    icon: '📚',
    category: 'academic'
  },
  {
    id: 'flashcard_master',
    name: 'Flashcard Master',
    description: 'Active recall specialist with deep memory retention.',
    unlockRequirement: 'Study 50 flashcards',
    icon: '🃏',
    category: 'academic'
  },
  {
    id: 'quiz_champion',
    name: 'Quiz Champion',
    description: 'Demonstrated subject mastery under test conditions.',
    unlockRequirement: 'Score 80%+ in a quiz or Brain Battle',
    icon: '🏆',
    category: 'academic'
  },
  {
    id: 'note_taker',
    name: 'Note Taker',
    description: 'Organized thinker who documents key concepts.',
    unlockRequirement: 'Create 5 study notes',
    icon: '📝',
    category: 'academic'
  },
  {
    id: 'ai_explorer',
    name: 'AI Explorer',
    description: 'Leveraged NVIDIA AI & Orion to accelerate learning.',
    unlockRequirement: 'Use StudentOS AI 10 times for study',
    icon: '🤖',
    category: 'academic'
  },
  {
    id: 'top_10_scholar',
    name: 'Top 10 Scholar',
    description: 'Ranked among the top 10 scholars on the leaderboard.',
    unlockRequirement: 'Reach Top 10 in Class or School Leaderboard',
    icon: '👑',
    category: 'leaderboard'
  },
  {
    id: 'brain_battle_debut',
    name: 'Arena Challenger',
    description: 'Completed your first official Brain Battle match.',
    unlockRequirement: 'Finish 1 Brain Battle match',
    icon: '⚔️',
    category: 'milestone'
  },
  {
    id: 'flawless_tactician',
    name: 'Flawless Tactician',
    description: 'Answered every question in a Brain Battle round with 100% accuracy.',
    unlockRequirement: 'Achieve 100% accuracy in a Brain Battle',
    icon: '🎯',
    category: 'academic'
  },
  {
    id: 'daily_conqueror',
    name: 'Daily Conqueror',
    description: 'Completed the official Campus Daily Challenge.',
    unlockRequirement: 'Finish a Brain Battle Daily Challenge',
    icon: '🌅',
    category: 'streak'
  },
  {
    id: 'arena_victor',
    name: 'Arena Victor',
    description: 'Triumphant in a live Multiplayer Brain Battle duel.',
    unlockRequirement: 'Win 1 Multiplayer Brain Battle',
    icon: '🛡️',
    category: 'leaderboard'
  },
  {
    id: 'halloween_2026',
    name: 'Halloween Spook 2026',
    description: 'Visited StudentOS during the spooky 2026 Halloween celebration.',
    unlockRequirement: 'Open StudentOS between Oct 29 & Nov 1',
    icon: '🎃',
    category: 'milestone'
  }
];

export function isHalloweenBadgeDateRange(): boolean {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1; // October = 10, November = 11
  const day = now.getDate();

  if (year === 2026) {
    if (month === 10 && day >= 29 && day <= 31) return true;
    if (month === 11 && day === 1) return true;
  }
  return false;
}

export interface StudentGamificationStats {
  userId: string;
  name: string;
  avatar?: string;
  role?: string;
  grade: string;
  section: string;
  house?: string;
  schoolId: string;
  xp: number;
  level: number;
  levelTitle: string;
  currentStreak: number;
  longestStreak: number;
  lastActiveDate: string; // YYYY-MM-DD
  earnedBadges: Record<string, string>; // badgeId -> ISO timestamp
  counts: {
    totalActions: number;
    homeworkCompleted: number;
    flashcardsStudied: number;
    quizzesCompleted: number;
    highScoreQuizzes: number;
    notesCreated: number;
    aiStudyUses: number;
    noticesRead: number;
    brainBattlesPlayed?: number;
    brainBattlePerfects?: number;
    dailyChallengesCompleted?: number;
    multiplayerWins?: number;
  };
  dailyTrackers: {
    date: string; // YYYY-MM-DD
    loginClaimed: boolean;
    aiUsesToday: number;
    xpEarnedToday: number;
    dailyChallengeClaimed?: boolean;
  };
  completedActionKeys: string[]; // Prevents duplicate XP for same item ID
  recentXpHistory: Array<{
    id: string;
    action: GamificationActionType;
    xp: number;
    label: string;
    timestamp: string;
  }>;
  updatedAt: string;
}

export const XP_REWARDS: Record<GamificationActionType, { xp: number; label: string }> = {
  daily_login: { xp: 10, label: 'Daily Study Check-In' },
  complete_homework: { xp: 25, label: 'Homework Completed' },
  study_flashcards: { xp: 15, label: 'Flashcard Study Session' },
  complete_quiz: { xp: 30, label: 'Brain Battle Completed' },
  quiz_high_score: { xp: 20, label: '80%+ Mastery Bonus' },
  create_note: { xp: 15, label: 'Study Note Created' },
  use_ai_study: { xp: 10, label: 'AI Tutor Study Session' },
  read_notice: { xp: 5, label: 'Official Notice Reviewed' },
  brain_battle_round: { xp: 35, label: 'Brain Battle Round Completed' },
  brain_battle_perfect: { xp: 25, label: '100% Flawless Round Bonus' },
  brain_battle_daily: { xp: 50, label: 'Daily Brain Battle Challenge' },
  brain_battle_multiplayer_win: { xp: 45, label: 'Multiplayer Arena Victory' }
};

export function getTodayDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getYesterdayDateString(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Calculate level details for a given XP amount
 */
export function calculateLevelInfo(xp: number): {
  current: LevelDefinition;
  next: LevelDefinition | null;
  xpIntoLevel: number;
  xpRequiredForNext: number;
  progressPercent: number;
} {
  let current = SCHOLAR_LEVELS[0];
  let next: LevelDefinition | null = SCHOLAR_LEVELS[1];

  for (let i = 0; i < SCHOLAR_LEVELS.length; i++) {
    if (xp >= SCHOLAR_LEVELS[i].minXp) {
      current = SCHOLAR_LEVELS[i];
      next = SCHOLAR_LEVELS[i + 1] || null;
    } else {
      break;
    }
  }

  if (!next) {
    return {
      current,
      next: null,
      xpIntoLevel: xp - current.minXp,
      xpRequiredForNext: 0,
      progressPercent: 100
    };
  }

  const levelSpan = next.minXp - current.minXp;
  const xpIntoLevel = Math.max(0, xp - current.minXp);
  const progressPercent = Math.min(100, Math.round((xpIntoLevel / levelSpan) * 100));

  return {
    current,
    next,
    xpIntoLevel,
    xpRequiredForNext: next.minXp - xp,
    progressPercent
  };
}

/**
 * Create initial gamification profile for a student
 */
export function createDefaultGamificationProfile(user: {
  uid?: string;
  id?: string;
  name?: string;
  avatar?: string;
  grade?: string;
  section?: string;
  house?: string;
  schoolId?: string;
}): StudentGamificationStats {
  const userId = user.uid || user.id || 'student_default';
  const today = getTodayDateString();
  return {
    userId,
    name: user.name || 'Scholar',
    avatar: user.avatar || '',
    grade: user.grade || 'Grade 10',
    section: user.section || 'Solara',
    house: user.house || 'Ignis',
    schoolId: user.schoolId || 'default_school',
    xp: 0,
    level: 1,
    levelTitle: SCHOLAR_LEVELS[0].title,
    currentStreak: 1,
    longestStreak: 1,
    lastActiveDate: today,
    earnedBadges: {},
    counts: {
      totalActions: 0,
      homeworkCompleted: 0,
      flashcardsStudied: 0,
      quizzesCompleted: 0,
      highScoreQuizzes: 0,
      notesCreated: 0,
      aiStudyUses: 0,
      noticesRead: 0
    },
    dailyTrackers: {
      date: today,
      loginClaimed: false,
      aiUsesToday: 0,
      xpEarnedToday: 0
    },
    completedActionKeys: [],
    recentXpHistory: [],
    updatedAt: new Date().toISOString()
  };
}

/**
 * Load student's gamification profile from localStorage + backend/Supabase
 */
export function getLocalGamificationProfile(user: {
  uid?: string;
  id?: string;
  name?: string;
  avatar?: string;
  grade?: string;
  section?: string;
  house?: string;
  schoolId?: string;
}): StudentGamificationStats {
  const userId = user?.uid || user?.id || 'student_default';
  const storageKey = `s_os_gamification_${userId}`;
  const base = createDefaultGamificationProfile(user);

  if (typeof window === 'undefined') return base;

  try {
    const raw = localStorage.getItem(storageKey);
    if (raw) {
      const parsed = JSON.parse(raw);
      const merged: StudentGamificationStats = {
        ...base,
        ...parsed,
        userId,
        name: user.name || parsed.name || base.name,
        grade: user.grade || parsed.grade || base.grade,
        section: user.section || parsed.section || base.section,
        house: user.house || parsed.house || base.house,
        counts: { ...base.counts, ...(parsed.counts || {}) },
        dailyTrackers: { ...base.dailyTrackers, ...(parsed.dailyTrackers || {}) },
        earnedBadges: { ...(parsed.earnedBadges || {}) },
        completedActionKeys: Array.isArray(parsed.completedActionKeys) ? parsed.completedActionKeys : [],
        recentXpHistory: Array.isArray(parsed.recentXpHistory) ? parsed.recentXpHistory : []
      };
      const lvlInfo = calculateLevelInfo(merged.xp);
      merged.level = lvlInfo.current.level;
      merged.levelTitle = lvlInfo.current.title;
      return merged;
    }
  } catch (_) {}

  return base;
}

/**
 * Load authoritative gamification profile from Supabase and reconcile with local cache.
 * Guarantees XP is NEVER wiped or reset to zero on fresh logins, new tabs, or separate devices.
 */
export async function loadAuthoritativeGamificationProfile(user: {
  uid?: string;
  id?: string;
  name?: string;
  avatar?: string;
  grade?: string;
  section?: string;
  house?: string;
  schoolId?: string;
}): Promise<StudentGamificationStats> {
  const userId = user?.uid || user?.id || 'student_default';
  const schoolId = user?.schoolId || 'default_school';
  const localProfile = getLocalGamificationProfile(user);

  try {
    // 1. Check user-specific document in Supabase global_data
    const userDocId = `gamification_user_${userId}`;
    const { data: userDoc } = await supabase
      .from('global_data')
      .select('*')
      .eq('id', userDocId)
      .maybeSingle();

    let remoteProfile: StudentGamificationStats | null = null;
    if (userDoc) {
      const parsed = (userDoc as any).data ?? ((userDoc as any).content ? JSON.parse((userDoc as any).content) : null);
      if (parsed && typeof parsed === 'object') {
        remoteProfile = parsed;
      }
    }

    // 2. Also check user_profiles table for any existing points
    try {
      const { data: uProfile } = await supabase
        .from('user_profiles')
        .select('points')
        .eq('id', userId)
        .maybeSingle();
      if (uProfile && typeof uProfile.points === 'number' && uProfile.points > 0) {
        if (!remoteProfile || (remoteProfile.xp || 0) < uProfile.points) {
          if (remoteProfile) {
            remoteProfile.xp = uProfile.points;
          }
        }
      }
    } catch (_) {}

    // 3. If not found in individual doc, check backend API / school doc
    if (!remoteProfile) {
      try {
        const resp = await fetch(
          `/api/gamification/profile?userId=${encodeURIComponent(userId)}&schoolId=${encodeURIComponent(schoolId)}`
        );
        if (resp.ok) {
          const json = await resp.json();
          if (json?.profile) remoteProfile = json.profile;
        }
      } catch (_) {}
    }

    if (remoteProfile) {
      // Reconcile safely: ALWAYS keep whichever has the higher XP to prevent data loss!
      const reconciledXp = Math.max(Number(remoteProfile.xp) || 0, Number(localProfile.xp) || 0);
      const lvlInfo = calculateLevelInfo(reconciledXp);

      const merged: StudentGamificationStats = {
        ...localProfile,
        ...remoteProfile,
        userId,
        name: user.name || remoteProfile.name || localProfile.name,
        grade: user.grade || remoteProfile.grade || localProfile.grade,
        schoolId,
        xp: reconciledXp,
        level: lvlInfo.current.level,
        levelTitle: lvlInfo.current.title,
        earnedBadges: {
          ...(remoteProfile.earnedBadges || {}),
          ...(localProfile.earnedBadges || {})
        },
        counts: {
          totalActions: Math.max(localProfile.counts?.totalActions || 0, remoteProfile.counts?.totalActions || 0),
          homeworkCompleted: Math.max(localProfile.counts?.homeworkCompleted || 0, remoteProfile.counts?.homeworkCompleted || 0),
          flashcardsStudied: Math.max(localProfile.counts?.flashcardsStudied || 0, remoteProfile.counts?.flashcardsStudied || 0),
          quizzesCompleted: Math.max(localProfile.counts?.quizzesCompleted || 0, remoteProfile.counts?.quizzesCompleted || 0),
          highScoreQuizzes: Math.max(localProfile.counts?.highScoreQuizzes || 0, remoteProfile.counts?.highScoreQuizzes || 0),
          notesCreated: Math.max(localProfile.counts?.notesCreated || 0, remoteProfile.counts?.notesCreated || 0),
          aiStudyUses: Math.max(localProfile.counts?.aiStudyUses || 0, remoteProfile.counts?.aiStudyUses || 0),
          noticesRead: Math.max(localProfile.counts?.noticesRead || 0, remoteProfile.counts?.noticesRead || 0),
          brainBattlesPlayed: Math.max(localProfile.counts?.brainBattlesPlayed || 0, remoteProfile.counts?.brainBattlesPlayed || 0),
          brainBattlePerfects: Math.max(localProfile.counts?.brainBattlePerfects || 0, remoteProfile.counts?.brainBattlePerfects || 0),
          dailyChallengesCompleted: Math.max(localProfile.counts?.dailyChallengesCompleted || 0, remoteProfile.counts?.dailyChallengesCompleted || 0),
          multiplayerWins: Math.max(localProfile.counts?.multiplayerWins || 0, remoteProfile.counts?.multiplayerWins || 0)
        },
        currentStreak: Math.max(localProfile.currentStreak || 1, remoteProfile.currentStreak || 1),
        longestStreak: Math.max(localProfile.longestStreak || 1, remoteProfile.longestStreak || 1),
        updatedAt: new Date().toISOString()
      };

      if (typeof window !== 'undefined') {
        const storageKey = `s_os_gamification_${userId}`;
        localStorage.setItem(storageKey, JSON.stringify(merged));
        window.dispatchEvent(new CustomEvent('studentos-gamification-updated', { detail: { profile: merged } }));
      }
      return merged;
    }
  } catch (err) {
    console.warn('[Gamification] Authoritative load notice:', err);
  }

  return localProfile;
}

/**
 * Save gamification profile locally and sync to server + Supabase
 */
export async function saveGamificationProfile(profile: StudentGamificationStats): Promise<void> {
  if (typeof window !== 'undefined') {
    const storageKey = `s_os_gamification_${profile.userId}`;
    localStorage.setItem(storageKey, JSON.stringify(profile));
    window.dispatchEvent(new CustomEvent('studentos-gamification-updated', { detail: { profile } }));
  }

  // Authoritative cloud persistence in Supabase global_data (using data column)
  try {
    const userDocId = `gamification_user_${profile.userId}`;
    await supabase.from('global_data').upsert({
      id: userDocId,
      data: profile,
      updated_at: new Date().toISOString()
    });
  } catch (err) {
    console.warn('[Gamification] Direct Supabase persistence notice:', err);
  }

  // Mirror to user_profiles table points column
  try {
    await supabase.from('user_profiles').update({
      points: profile.xp,
      updated_at: Date.now()
    }).eq('id', profile.userId);
  } catch (_) {}

  try {
    const headers = await buildAuthHeadersForUser({
      uid: profile.userId,
      name: profile.name,
      role: (profile.role || 'student') as UserRole,
      grade: profile.grade,
      section: profile.section as SectionType,
    });
    await fetch('/api/gamification/award', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        userId: profile.userId,
        schoolId: profile.schoolId || 'default_school',
        profile
      })
    });
  } catch (_) {}
}

/**
 * Evaluate and unlock any newly earned badges
 */
function evaluateBadges(
  profile: StudentGamificationStats,
  isTop10OnLeaderboard: boolean = true
): BadgeDefinition[] {
  const newlyUnlocked: BadgeDefinition[] = [];
  const now = new Date().toISOString();

  const checkAndUnlock = (badgeId: string, condition: boolean) => {
    if (condition && !profile.earnedBadges[badgeId]) {
      profile.earnedBadges[badgeId] = now;
      const def = GAMIFICATION_BADGES.find(b => b.id === badgeId);
      if (def) newlyUnlocked.push(def);
    }
  };

  checkAndUnlock('first_steps', profile.counts.totalActions >= 1);
  checkAndUnlock('streak_3', profile.currentStreak >= 3 || profile.longestStreak >= 3);
  checkAndUnlock('streak_7', profile.currentStreak >= 7 || profile.longestStreak >= 7);
  checkAndUnlock('homework_hero', profile.counts.homeworkCompleted >= 5);
  checkAndUnlock('flashcard_master', profile.counts.flashcardsStudied >= 50);
  checkAndUnlock('quiz_champion', profile.counts.highScoreQuizzes >= 1);
  checkAndUnlock('note_taker', profile.counts.notesCreated >= 5);
  checkAndUnlock('ai_explorer', profile.counts.aiStudyUses >= 10);
  checkAndUnlock('top_10_scholar', isTop10OnLeaderboard && profile.xp >= 50);
  checkAndUnlock('brain_battle_debut', (profile.counts.brainBattlesPlayed || 0) >= 1 || profile.counts.quizzesCompleted >= 1);
  checkAndUnlock('flawless_tactician', (profile.counts.brainBattlePerfects || 0) >= 1);
  checkAndUnlock('daily_conqueror', (profile.counts.dailyChallengesCompleted || 0) >= 1);
  checkAndUnlock('arena_victor', (profile.counts.multiplayerWins || 0) >= 1);
  checkAndUnlock('halloween_2026', isHalloweenBadgeDateRange());

  return newlyUnlocked;
}

/**
 * Award XP to a student for a real academic action with anti-spam protection
 */
export async function awardStudentXP(
  user: {
    uid?: string;
    id?: string;
    name?: string;
    avatar?: string;
    grade?: string;
    section?: string;
    house?: string;
    role?: string;
    schoolId?: string;
  } | null | undefined,
  action: GamificationActionType,
  options?: {
    uniqueItemId?: string;
    flashcardCount?: number;
    quizScorePercent?: number;
    customXpAmount?: number;
    customLabel?: string;
    silent?: boolean;
  }
): Promise<{
  awarded: boolean;
  xpAdded: number;
  leveledUp: boolean;
  newLevel?: LevelDefinition;
  newBadges: BadgeDefinition[];
  profile: StudentGamificationStats | null;
}> {
  if (!user || !(user.uid || user.id)) {
    return { awarded: false, xpAdded: 0, leveledUp: false, newBadges: [], profile: null };
  }

  const profile = getLocalGamificationProfile(user);
  if (user.role) profile.role = user.role;
  const today = getTodayDateString();
  const yesterday = getYesterdayDateString();

  // 1. Reset daily tracker if date changed & update study streak
  if (profile.dailyTrackers.date !== today) {
    profile.dailyTrackers = {
      date: today,
      loginClaimed: false,
      aiUsesToday: 0,
      xpEarnedToday: 0,
      dailyChallengeClaimed: false
    };
  }

  if (profile.lastActiveDate !== today) {
    if (profile.lastActiveDate === yesterday) {
      profile.currentStreak += 1;
    } else {
      profile.currentStreak = 1;
    }
    if (profile.currentStreak > profile.longestStreak) {
      profile.longestStreak = profile.currentStreak;
    }
    profile.lastActiveDate = today;
  }

  // 2. Anti-spam & deduplication checks
  if (action === 'daily_login') {
    if (profile.dailyTrackers.loginClaimed) {
      return { awarded: false, xpAdded: 0, leveledUp: false, newBadges: [], profile };
    }
    profile.dailyTrackers.loginClaimed = true;
  }

  if (action === 'brain_battle_daily') {
    if (profile.dailyTrackers.dailyChallengeClaimed) {
      return { awarded: false, xpAdded: 0, leveledUp: false, newBadges: [], profile };
    }
    profile.dailyTrackers.dailyChallengeClaimed = true;
  }

  if (action === 'use_ai_study') {
    if (profile.dailyTrackers.aiUsesToday >= 5) {
      // Capped at 5 AI study XP awards per day
      return { awarded: false, xpAdded: 0, leveledUp: false, newBadges: [], profile };
    }
    profile.dailyTrackers.aiUsesToday += 1;
  }

  if (options?.uniqueItemId) {
    const actionKey = `${action}:${options.uniqueItemId}`;
    if (profile.completedActionKeys.includes(actionKey)) {
      return { awarded: false, xpAdded: 0, leveledUp: false, newBadges: [], profile };
    }
    profile.completedActionKeys.push(actionKey);
    if (profile.completedActionKeys.length > 500) {
      profile.completedActionKeys = profile.completedActionKeys.slice(-500);
    }
  }

  // 3. Calculate XP & update counters
  let xpToAdd = typeof options?.customXpAmount === 'number' && options.customXpAmount > 0
    ? Math.min(200, Math.round(options.customXpAmount))
    : XP_REWARDS[action].xp;
  let rewardLabel = options?.customLabel || XP_REWARDS[action].label;

  profile.counts.totalActions += 1;

  switch (action) {
    case 'complete_homework':
      profile.counts.homeworkCompleted += 1;
      break;
    case 'study_flashcards':
      profile.counts.flashcardsStudied += options?.flashcardCount || 10;
      break;
    case 'complete_quiz':
    case 'brain_battle_round':
      profile.counts.quizzesCompleted += 1;
      profile.counts.brainBattlesPlayed = (profile.counts.brainBattlesPlayed || 0) + 1;
      if ((options?.quizScorePercent ?? 0) >= 80) {
        if (typeof options?.customXpAmount !== 'number') {
          xpToAdd += XP_REWARDS.quiz_high_score.xp;
        }
        profile.counts.highScoreQuizzes += 1;
      }
      if ((options?.quizScorePercent ?? 0) === 100) {
        profile.counts.brainBattlePerfects = (profile.counts.brainBattlePerfects || 0) + 1;
      }
      break;
    case 'brain_battle_perfect':
      profile.counts.brainBattlePerfects = (profile.counts.brainBattlePerfects || 0) + 1;
      profile.counts.highScoreQuizzes += 1;
      break;
    case 'brain_battle_daily':
      profile.counts.quizzesCompleted += 1;
      profile.counts.brainBattlesPlayed = (profile.counts.brainBattlesPlayed || 0) + 1;
      profile.counts.dailyChallengesCompleted = (profile.counts.dailyChallengesCompleted || 0) + 1;
      if ((options?.quizScorePercent ?? 0) >= 80) {
        profile.counts.highScoreQuizzes += 1;
      }
      if ((options?.quizScorePercent ?? 0) === 100) {
        profile.counts.brainBattlePerfects = (profile.counts.brainBattlePerfects || 0) + 1;
      }
      break;
    case 'brain_battle_multiplayer_win':
      profile.counts.quizzesCompleted += 1;
      profile.counts.brainBattlesPlayed = (profile.counts.brainBattlesPlayed || 0) + 1;
      profile.counts.multiplayerWins = (profile.counts.multiplayerWins || 0) + 1;
      if ((options?.quizScorePercent ?? 0) >= 80) {
        profile.counts.highScoreQuizzes += 1;
      }
      break;
    case 'quiz_high_score':
      profile.counts.highScoreQuizzes += 1;
      break;
    case 'create_note':
      profile.counts.notesCreated += 1;
      break;
    case 'use_ai_study':
      profile.counts.aiStudyUses += 1;
      break;
    case 'read_notice':
      profile.counts.noticesRead += 1;
      break;
  }

  const prevLevel = calculateLevelInfo(profile.xp).current.level;
  profile.xp += xpToAdd;
  profile.dailyTrackers.xpEarnedToday += xpToAdd;

  const newLevelInfo = calculateLevelInfo(profile.xp);
  profile.level = newLevelInfo.current.level;
  profile.levelTitle = newLevelInfo.current.title;
  const leveledUp = newLevelInfo.current.level > prevLevel;

  // 4. Record in recent XP history
  profile.recentXpHistory.unshift({
    id: `xp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    action,
    xp: xpToAdd,
    label: rewardLabel,
    timestamp: new Date().toISOString()
  });
  if (profile.recentXpHistory.length > 25) {
    profile.recentXpHistory = profile.recentXpHistory.slice(0, 25);
  }

  // 5. Evaluate badges
  const newBadges = evaluateBadges(profile, true);
  profile.updatedAt = new Date().toISOString();

  // 6. Save & sync authoritative XP ledger + dispatch UI reward toast event
  await saveGamificationProfile(profile);
  awardServerActionXp(
    {
      ...user,
      role: user.role as UserRole | undefined,
      section: user.section as SectionType | undefined,
      house: user.house as HouseType | undefined,
    },
    action,
    options?.uniqueItemId
  ).catch(() => {});

  if (typeof window !== 'undefined' && !options?.silent) {
    if (leveledUp) {
      soundService.playSuccessSound();
    }
    window.dispatchEvent(
      new CustomEvent('studentos-xp-toast', {
        detail: {
          xpAdded: xpToAdd,
          label: rewardLabel,
          leveledUp,
          newLevel: leveledUp ? newLevelInfo.current : undefined,
          newBadges,
          totalXp: profile.xp,
          streak: profile.currentStreak
        }
      })
    );
  }

  return {
    awarded: true,
    xpAdded: xpToAdd,
    leveledUp,
    newLevel: leveledUp ? newLevelInfo.current : undefined,
    newBadges,
    profile
  };
}

/**
 * Fetch real separated Student Leaderboard from the authoritative server endpoint
 */
export async function fetchGamificationLeaderboard(
  currentUser: {
    uid?: string;
    id?: string;
    name?: string;
    avatar?: string;
    grade?: string;
    section?: string;
    house?: string;
    role?: string;
    schoolId?: string;
  }
): Promise<StudentGamificationStats[]> {
  const myProfile = getLocalGamificationProfile(currentUser);
  const schoolId = myProfile.schoolId || 'default_school';
  const entriesMap = new Map<string, StudentGamificationStats>();

  // 1. Primary authoritative separated Student leaderboard endpoint
  try {
    const res = await fetchSeparatedLeaderboard({
      type: 'student',
      period: 'all_time',
      user: {
        uid: currentUser.uid || currentUser.id,
        name: currentUser.name,
        role: (currentUser.role || 'student') as UserRole,
        grade: currentUser.grade,
        section: currentUser.section as SectionType | undefined,
      },
    });
    if (res.ok && Array.isArray(res.data?.rankings)) {
      res.data.rankings.forEach((row) => {
        const mapped = createDefaultGamificationProfile({
          uid: row.userId,
          name: row.name,
          avatar: row.avatar || '',
          grade: row.grade || 'Student',
          section: row.section || '',
          house: row.house || '',
          schoolId,
        });
        mapped.role = row.role || 'student';
        mapped.xp = row.xp;
        mapped.level = row.level;
        mapped.levelTitle = row.levelTitle;
        mapped.currentStreak = row.currentStreak || 0;
        mapped.longestStreak = Math.max(row.currentStreak || 0, myProfile.longestStreak);
        entriesMap.set(row.userId, mapped);
      });
    }
  } catch (_) {}

  // 2. Include current student profile if student role
  const normalizedRole = String(currentUser.role || 'student').toLowerCase();
  if (normalizedRole === 'student' && !entriesMap.has(myProfile.userId)) {
    entriesMap.set(myProfile.userId, myProfile);
  }

  return Array.from(entriesMap.values()).sort((a, b) => {
    if (b.xp !== a.xp) return b.xp - a.xp;
    return b.currentStreak - a.currentStreak;
  });
}
