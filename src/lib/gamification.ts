/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * StudentOS Academic Gamification Engine
 * Manages XP, 10 Scholar Levels, Daily Study Streaks, 9 Core Badges,
 * Anti-Spam Action Deduplication, and Class/School Leaderboards.
 */

import { supabase } from './supabase';
import { soundService } from './soundService';

export type GamificationActionType =
  | 'daily_login'
  | 'complete_homework'
  | 'study_flashcards'
  | 'complete_quiz'
  | 'quiz_high_score'
  | 'create_note'
  | 'use_ai_study'
  | 'read_notice';

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
    unlockRequirement: 'Score 80%+ in a quiz',
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
  }
];

export interface StudentGamificationStats {
  userId: string;
  name: string;
  avatar?: string;
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
  };
  dailyTrackers: {
    date: string; // YYYY-MM-DD
    loginClaimed: boolean;
    aiUsesToday: number;
    xpEarnedToday: number;
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
  complete_quiz: { xp: 30, label: 'Practice Quiz Completed' },
  quiz_high_score: { xp: 20, label: '80%+ Quiz Mastery Bonus' },
  create_note: { xp: 15, label: 'Study Note Created' },
  use_ai_study: { xp: 10, label: 'AI Tutor Study Session' },
  read_notice: { xp: 5, label: 'Official Notice Reviewed' }
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
 * Save gamification profile locally and sync to server + Supabase
 */
export async function saveGamificationProfile(profile: StudentGamificationStats): Promise<void> {
  if (typeof window !== 'undefined') {
    const storageKey = `s_os_gamification_${profile.userId}`;
    localStorage.setItem(storageKey, JSON.stringify(profile));
    window.dispatchEvent(new CustomEvent('studentos-gamification-updated', { detail: { profile } }));
  }

  try {
    await fetch('/api/gamification/award', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
  const today = getTodayDateString();
  const yesterday = getYesterdayDateString();

  // 1. Reset daily tracker if date changed & update study streak
  if (profile.dailyTrackers.date !== today) {
    profile.dailyTrackers = {
      date: today,
      loginClaimed: false,
      aiUsesToday: 0,
      xpEarnedToday: 0
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
  let xpToAdd = XP_REWARDS[action].xp;
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
      profile.counts.quizzesCompleted += 1;
      if ((options?.quizScorePercent ?? 0) >= 80) {
        xpToAdd += XP_REWARDS.quiz_high_score.xp;
        rewardLabel = `Quiz Completed (${options?.quizScorePercent}% Mastery Bonus!)`;
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

  // 6. Save & dispatch UI reward toast event
  await saveGamificationProfile(profile);

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
 * Fetch combined Class & School Leaderboard (merges real Supabase/server student profiles + realistic classmates for demo richness)
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
    schoolId?: string;
  }
): Promise<StudentGamificationStats[]> {
  const myProfile = getLocalGamificationProfile(currentUser);
  const schoolId = myProfile.schoolId || 'default_school';
  const entriesMap = new Map<string, StudentGamificationStats>();

  // Always include current student
  entriesMap.set(myProfile.userId, myProfile);

  // 1. Fetch live leaderboard from backend / Supabase
  try {
    const res = await fetch(
      `/api/gamification/profile?userId=${encodeURIComponent(myProfile.userId)}&schoolId=${encodeURIComponent(schoolId)}`
    );
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.leaderboard)) {
        data.leaderboard.forEach((item: StudentGamificationStats) => {
          if (item && item.userId) {
            if (item.userId === myProfile.userId) {
              // Keep whichever has higher XP
              if ((item.xp || 0) > myProfile.xp) {
                entriesMap.set(myProfile.userId, item);
              }
            } else {
              entriesMap.set(item.userId, item);
            }
          }
        });
      }
    }
  } catch (_) {}

  // 2. Also query real student profiles from Supabase user_profiles if available
  try {
    const { data: realUsers } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('role', 'student')
      .limit(30);

    if (Array.isArray(realUsers)) {
      realUsers.forEach((u: any) => {
        const uid = u.uid || u.id;
        if (uid && !entriesMap.has(uid)) {
          const rawGam = u.raw_data?.gamification;
          const xpVal = rawGam?.xp ?? (typeof u.points === 'number' ? u.points : 180);
          const lvl = calculateLevelInfo(xpVal).current;
          const p = createDefaultGamificationProfile({
            uid,
            name: u.name || 'Student Scholar',
            avatar: u.avatar || '',
            grade: u.grade || myProfile.grade || 'Grade 10',
            section: u.section || myProfile.section || 'Solara',
            house: u.house || 'Ignis',
            schoolId
          });
          p.xp = xpVal;
          p.level = lvl.level;
          p.levelTitle = lvl.title;
          p.currentStreak = rawGam?.currentStreak || 3;
          p.longestStreak = rawGam?.longestStreak || 5;
          entriesMap.set(uid, p);
        }
      });
    }
  } catch (_) {}

  // 3. Ensure at least 10 campus scholars exist so Top 3 Podium & Top 10 Leaderboard are rich for Principal Demo
  const seedScholars = [
    { id: 'scholar_1', name: 'Aarav Sharma', grade: myProfile.grade || 'Grade 10', section: myProfile.section || 'Solara', house: 'Astra', xp: 1480, streak: 12 },
    { id: 'scholar_2', name: 'Diya Patel', grade: myProfile.grade || 'Grade 10', section: myProfile.section || 'Solara', house: 'Elara', xp: 1240, streak: 9 },
    { id: 'scholar_3', name: 'Rohan Verma', grade: myProfile.grade || 'Grade 10', section: 'Astra', house: 'Solara', xp: 980, streak: 7 },
    { id: 'scholar_4', name: 'Ananya Nair', grade: myProfile.grade || 'Grade 10', section: myProfile.section || 'Solara', house: 'Vega', xp: 810, streak: 6 },
    { id: 'scholar_5', name: 'Kabir Mehta', grade: 'Grade 11', section: 'Elara', house: 'Astra', xp: 690, streak: 5 },
    { id: 'scholar_6', name: 'Meera Krishnan', grade: myProfile.grade || 'Grade 10', section: myProfile.section || 'Solara', house: 'Solara', xp: 540, streak: 4 },
    { id: 'scholar_7', name: 'Vivaan Gupta', grade: 'Grade 9', section: 'Vega', house: 'Elara', xp: 420, streak: 4 },
    { id: 'scholar_8', name: 'Ishaan Joshi', grade: myProfile.grade || 'Grade 10', section: 'Astra', house: 'Vega', xp: 310, streak: 3 },
    { id: 'scholar_9', name: 'Sanya Malhotra', grade: 'Grade 12', section: 'Solara', house: 'Astra', xp: 230, streak: 2 },
  ];

  seedScholars.forEach(s => {
    if (!entriesMap.has(s.id)) {
      const lvl = calculateLevelInfo(s.xp).current;
      const p = createDefaultGamificationProfile({
        uid: s.id,
        name: s.name,
        grade: s.grade,
        section: s.section,
        house: s.house,
        schoolId
      });
      p.xp = s.xp;
      p.level = lvl.level;
      p.levelTitle = lvl.title;
      p.currentStreak = s.streak;
      p.longestStreak = s.streak + 2;
      entriesMap.set(s.id, p);
    }
  });

  return Array.from(entriesMap.values()).sort((a, b) => {
    if (b.xp !== a.xp) return b.xp - a.xp;
    return b.currentStreak - a.currentStreak;
  });
}
