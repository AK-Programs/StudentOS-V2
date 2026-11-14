/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Centralized Authoritative Reward Engine for Veylentra
 * Single source of truth for:
 * - Nightly Santa Gift (7:00 PM – 9:00 PM IST) rarities & transparent odds
 * - Winter Spin Wheel 8 segments, server RNG (crypto.randomInt), & exact 2-hour cooldown
 * - Winter Festival Tasks, Badges, Profile Frames & 3-Question Knowledge Check
 * - Authoritative server-side XP action table (prevents client XP tampering)
 * - Zero real money, zero financial transactions, zero gambling mechanics
 */

import crypto from 'crypto';

export type SantaRarity = 'common' | 'rare' | 'legendary' | 'insane';

export interface SantaRewardTier {
  rarity: SantaRarity;
  label: string;
  weightBps: number; // Sum = 10000 (100.00%)
  oddsPercent: number;
  xpBonus: number;
  cookiesBonus: number;
  aiBonusQueries: number;
  streakShield: boolean;
  badgeId?: string;
  frameId?: string;
  description: string;
}

export const SANTA_REWARD_TIERS: SantaRewardTier[] = [
  {
    rarity: 'common',
    label: 'Warm Cocoa Bundle',
    weightBps: 6000,
    oddsPercent: 60,
    xpBonus: 25,
    cookiesBonus: 3,
    aiBonusQueries: 1,
    streakShield: false,
    description: '+25 XP, 3 Winter Cookies & +1 Daily AI Bonus Query',
  },
  {
    rarity: 'rare',
    label: 'Frost Lantern Pack',
    weightBps: 2500,
    oddsPercent: 25,
    xpBonus: 60,
    cookiesBonus: 6,
    aiBonusQueries: 2,
    streakShield: true,
    frameId: 'frosted_aurora',
    description: '+60 XP, 6 Winter Cookies, Streak Shield & Frosted Aurora Frame',
  },
  {
    rarity: 'legendary',
    label: 'Starlight Sleigh Crate',
    weightBps: 1100,
    oddsPercent: 11,
    xpBonus: 120,
    cookiesBonus: 12,
    aiBonusQueries: 3,
    streakShield: true,
    badgeId: 'sleigh_keeper',
    frameId: 'starlight_gold',
    description: '+120 XP, 12 Winter Cookies, +3 AI Queries, Streak Shield & Sleigh Keeper Badge',
  },
  {
    rarity: 'insane',
    label: 'Aurora Crown Vault',
    weightBps: 400,
    oddsPercent: 4,
    xpBonus: 250,
    cookiesBonus: 20,
    aiBonusQueries: 5,
    streakShield: true,
    badgeId: 'aurora_miracle',
    frameId: 'aurora_crown',
    description: '+250 XP, 20 Winter Cookies, +5 Daily AI Queries, Streak Shield & Secret Aurora Miracle Badge!',
  },
];

export interface SpinWheelSegment {
  index: number;
  id: string;
  label: string;
  shortLabel: string;
  color: string;
  textColor: string;
  weightBps: number; // Sum = 10000
  oddsPercent: number;
  xpBonus: number;
  cookiesBonus: number;
  aiBonusQueries: number;
  streakShield: boolean;
  badgeId?: string;
  frameId?: string;
  rarity: 'standard' | 'rare' | 'jackpot';
}

export const SPIN_WHEEL_SEGMENTS: SpinWheelSegment[] = [
  {
    index: 0,
    id: 'xp_25',
    label: '+25 Scholar XP',
    shortLabel: '+25 XP',
    color: '#0284c7',
    textColor: '#ffffff',
    weightBps: 2400,
    oddsPercent: 24,
    xpBonus: 25,
    cookiesBonus: 1,
    aiBonusQueries: 0,
    streakShield: false,
    rarity: 'standard',
  },
  {
    index: 1,
    id: 'cookies_3',
    label: '3 Winter Cookies',
    shortLabel: '3 Cookies',
    color: '#e11d48',
    textColor: '#ffffff',
    weightBps: 2000,
    oddsPercent: 20,
    xpBonus: 15,
    cookiesBonus: 3,
    aiBonusQueries: 0,
    streakShield: false,
    rarity: 'standard',
  },
  {
    index: 2,
    id: 'xp_50',
    label: '+50 Scholar XP',
    shortLabel: '+50 XP',
    color: '#0f766e',
    textColor: '#f0fdfa',
    weightBps: 1800,
    oddsPercent: 18,
    xpBonus: 50,
    cookiesBonus: 1,
    aiBonusQueries: 0,
    streakShield: false,
    rarity: 'standard',
  },
  {
    index: 3,
    id: 'ai_boost_2',
    label: '+2 Daily AI Queries',
    shortLabel: '+2 AI Boost',
    color: '#1d4ed8',
    textColor: '#eff6ff',
    weightBps: 1100,
    oddsPercent: 11,
    xpBonus: 20,
    cookiesBonus: 1,
    aiBonusQueries: 2,
    streakShield: false,
    rarity: 'rare',
  },
  {
    index: 4,
    id: 'xp_100',
    label: '+100 Frost XP',
    shortLabel: '+100 XP',
    color: '#0369a1',
    textColor: '#e0f2fe',
    weightBps: 1000,
    oddsPercent: 10,
    xpBonus: 100,
    cookiesBonus: 2,
    aiBonusQueries: 0,
    streakShield: false,
    rarity: 'rare',
  },
  {
    index: 5,
    id: 'streak_shield',
    label: 'Streak Freeze Shield',
    shortLabel: 'Shield',
    color: '#334155',
    textColor: '#f8fafc',
    weightBps: 800,
    oddsPercent: 8,
    xpBonus: 30,
    cookiesBonus: 2,
    aiBonusQueries: 0,
    streakShield: true,
    rarity: 'rare',
  },
  {
    index: 6,
    id: 'cookies_6',
    label: '6 Cocoa Cookies',
    shortLabel: '6 Cookies',
    color: '#be123c',
    textColor: '#fff1f2',
    weightBps: 600,
    oddsPercent: 6,
    xpBonus: 40,
    cookiesBonus: 6,
    aiBonusQueries: 1,
    streakShield: false,
    rarity: 'rare',
  },
  {
    index: 7,
    id: 'frost_jackpot',
    label: 'Frost Jackpot (+200 XP & Ribbon)',
    shortLabel: 'Jackpot!',
    color: '#d97706',
    textColor: '#ffffff',
    weightBps: 300,
    oddsPercent: 3,
    xpBonus: 200,
    cookiesBonus: 10,
    aiBonusQueries: 3,
    streakShield: true,
    badgeId: 'winter_wheel_ace',
    frameId: 'candy_ribbon',
    rarity: 'jackpot',
  },
];

export const SPIN_WHEEL_COOLDOWN_MS = 2 * 60 * 60 * 1000; // Strictly 2 hours
export const MAX_DAILY_WINTER_AI_BONUS = 5;
export const MAX_STREAK_SHIELDS = 3;

export interface WinterTaskDefinition {
  id: string;
  title: string;
  description: string;
  xpReward: number;
  cookiesReward: number;
  badgeId?: string;
  verificationMode: 'hub_visit' | 'academic_action' | 'winter_quiz' | 'spin_or_santa' | 'study_check';
  actionTab?: string;
  actionLabel?: string;
}

export const WINTER_FESTIVAL_TASKS: WinterTaskDefinition[] = [
  {
    id: 'task_visit_festival',
    title: 'Step Into the Winter Festival',
    description: 'Open the Winter Festival Hub and inspect this season’s festive campus lineup.',
    xpReward: 20,
    cookiesReward: 2,
    badgeId: 'snowflake_explorer',
    verificationMode: 'hub_visit',
    actionLabel: 'Claim Arrival Treat',
  },
  {
    id: 'task_winter_quiz',
    title: 'Complete the Winter Knowledge Check',
    description: 'Answer the 3-question winter science & campus trivia challenge correctly.',
    xpReward: 40,
    cookiesReward: 3,
    badgeId: 'winter_scholar',
    verificationMode: 'winter_quiz',
    actionLabel: 'Take Quick Quiz',
  },
  {
    id: 'task_academic_engagement',
    title: 'Complete One Verified Study Action',
    description: 'Log any academic XP action (notes, flashcards, assignment, Brain Battle, or attendance check).',
    xpReward: 35,
    cookiesReward: 3,
    badgeId: 'frosty_focus',
    verificationMode: 'academic_action',
    actionTab: 'study_hub',
    actionLabel: 'Open Study Hub',
  },
  {
    id: 'task_collect_cookies',
    title: 'Bake 5 Winter Cookies',
    description: 'Gather at least 5 Winter Cookies through festival tasks, Spin Wheel, or Santa gifts.',
    xpReward: 45,
    cookiesReward: 4,
    badgeId: 'cookie_collector',
    verificationMode: 'study_check',
    actionLabel: 'Verify Cookie Jar',
  },
  {
    id: 'task_seasonal_wheel_or_gift',
    title: 'Try the Spin Wheel or Nightly Santa Gift',
    description: 'Participate in a verified Winter Spin Wheel roll or claim a Nightly Santa Gift.',
    xpReward: 30,
    cookiesReward: 2,
    badgeId: 'winter_champion',
    verificationMode: 'spin_or_santa',
    actionLabel: 'Spin or Unwrap',
  },
];

export interface WinterBadgeDefinition {
  id: string;
  name: string;
  description: string;
  unlockRequirement: string;
  rarity: 'seasonal' | 'rare' | 'legendary' | 'secret';
  isHiddenUntilUnlocked?: boolean;
}

export const WINTER_FESTIVAL_BADGES: WinterBadgeDefinition[] = [
  {
    id: 'snowflake_explorer',
    name: 'Snowflake Explorer',
    description: 'Stepped into the campus Winter Festival Celebration.',
    unlockRequirement: 'Claim the Winter Festival arrival task',
    rarity: 'seasonal',
  },
  {
    id: 'winter_scholar',
    name: 'Winter Scholar',
    description: 'Aced the 3-question Winter Science & Knowledge Check.',
    unlockRequirement: 'Pass the Winter Knowledge Check mini-quiz',
    rarity: 'seasonal',
  },
  {
    id: 'frosty_focus',
    name: 'Frosty Focus',
    description: 'Maintained real academic momentum throughout the winter season.',
    unlockRequirement: 'Complete any verified academic study action',
    rarity: 'rare',
  },
  {
    id: 'cookie_collector',
    name: 'Cookie Jar Curator',
    description: 'Collected at least 5 festive Winter Cookies.',
    unlockRequirement: 'Collect 5+ Winter Cookies',
    rarity: 'rare',
  },
  {
    id: 'winter_champion',
    name: 'Solstice Celebrant',
    description: 'Participated in either the Winter Spin Wheel or Nightly Santa Gift.',
    unlockRequirement: 'Try Spin Wheel or Santa Gift once',
    rarity: 'rare',
  },
  {
    id: 'sleigh_keeper',
    name: 'Sleigh Keeper',
    description: 'Unwrapped a Legendary Starlight Sleigh Crate during the 7–9 PM window.',
    unlockRequirement: 'Unwrap a Legendary Santa Gift',
    rarity: 'legendary',
  },
  {
    id: 'winter_wheel_ace',
    name: 'Frost Wheel Ace',
    description: 'Landed cleanly on the Frost Jackpot slice of the Winter Spin Wheel.',
    unlockRequirement: 'Hit the Frost Jackpot slice',
    rarity: 'legendary',
  },
  {
    id: 'aurora_miracle',
    name: 'Aurora Crown Miracle',
    description: 'Unwrapped the ultra-rare 4% Aurora Crown Vault.',
    unlockRequirement: 'Hidden Secret Collectible',
    rarity: 'secret',
    isHiddenUntilUnlocked: true,
  },
  {
    id: 'north_star_secret',
    name: 'North Star Alchemist',
    description: 'Collected 15+ Winter Cookies and completed 3+ seasonal festival tasks.',
    unlockRequirement: 'Hidden Secret Collectible',
    rarity: 'secret',
    isHiddenUntilUnlocked: true,
  },
];

export interface WinterProfileFrame {
  id: string;
  name: string;
  borderClass: string;
  description: string;
}

export const WINTER_PROFILE_FRAMES: WinterProfileFrame[] = [
  {
    id: 'frosted_aurora',
    name: 'Frosted Aurora Ring',
    borderClass: 'ring-2 ring-sky-400 shadow-[0_0_16px_rgba(56,189,248,0.45)]',
    description: 'Crisp ice-blue rim unlocked from Rare Santa chests',
  },
  {
    id: 'candy_ribbon',
    name: 'Candy Ribbon Frame',
    borderClass: 'ring-2 ring-rose-400 shadow-[0_0_16px_rgba(244,63,94,0.45)]',
    description: 'Peppermint border unlocked from Spin Wheel Jackpot',
  },
  {
    id: 'starlight_gold',
    name: 'Starlight Sleigh Frame',
    borderClass: 'ring-2 ring-amber-400 shadow-[0_0_18px_rgba(251,191,36,0.5)]',
    description: 'Golden sleigh trim from Legendary Santa chests',
  },
  {
    id: 'aurora_crown',
    name: 'Aurora Crown Frame',
    borderClass: 'ring-2 ring-cyan-300 shadow-[0_0_20px_rgba(103,232,249,0.6)]',
    description: 'Ultra-rare frost crown from Insane Santa vaults',
  },
];

export interface WinterQuizQuestion {
  id: string;
  prompt: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

export const WINTER_QUIZ_QUESTIONS: WinterQuizQuestion[] = [
  {
    id: 'wq_1',
    prompt: 'Why does every natural snowflake exhibit six-fold (hexagonal) symmetry?',
    options: [
      'Gravity stretches ice crystals into six corners while falling',
      'Water molecules bond at ~104.5° angles forming a hexagonal crystal lattice',
      'Atmospheric ozone stamps hexagonal edges on raindrops',
      'Wind shear splits round hailstones into six parts',
    ],
    correctIndex: 1,
    explanation: 'Hydrogen bonding in frozen water arranges H₂O molecules into a hexagonal crystal lattice.',
  },
  {
    id: 'wq_2',
    prompt: 'What causes the December Winter Solstice in the Northern Hemisphere?',
    options: [
      'Earth reaches its farthest orbital distance from the Sun',
      'The Moon blocks solar radiation across polar regions',
      'Earth’s axial tilt points the Northern Hemisphere farthest away from the Sun',
      'Ocean currents reverse direction in late December',
    ],
    correctIndex: 2,
    explanation: 'Earth’s ~23.4° axial tilt angles the Northern Hemisphere away from the Sun in December.',
  },
  {
    id: 'wq_3',
    prompt: 'Which study habit helps retain concepts most effectively during winter exam prep?',
    options: [
      'Re-reading highlighted notes once before sleep without testing',
      'Spaced active recall with flashcards & practice checks over multiple days',
      'Cramming every chapter in one continuous midnight marathon',
      'Skipping difficult chapters until the morning of the exam',
    ],
    correctIndex: 1,
    explanation: 'Spaced repetition and active recall consistently outperform passive cramming.',
  },
];

export const ALLOWED_GAMIFICATION_ACTION_XP: Record<
  string,
  { xp: number; maxPerDay: number; label: string; category: 'academic' | 'battle' | 'streak' | 'faculty' }
> = {
  daily_login: { xp: 10, maxPerDay: 1, label: 'Daily Study Check-In', category: 'streak' },
  complete_homework: { xp: 25, maxPerDay: 10, label: 'Assignment Completed', category: 'academic' },
  study_flashcards: { xp: 15, maxPerDay: 12, label: 'Flashcard Study Session', category: 'academic' },
  complete_quiz: { xp: 30, maxPerDay: 8, label: 'Quiz / Assessment Completed', category: 'battle' },
  quiz_high_score: { xp: 20, maxPerDay: 8, label: '80%+ Mastery Bonus', category: 'battle' },
  create_note: { xp: 15, maxPerDay: 10, label: 'Lecture Note Created', category: 'academic' },
  use_ai_study: { xp: 10, maxPerDay: 8, label: 'AI Tutor Study Session', category: 'academic' },
  read_notice: { xp: 5, maxPerDay: 10, label: 'Official Notice Reviewed', category: 'academic' },
  brain_battle_round: { xp: 35, maxPerDay: 10, label: 'Brain Battle Round Completed', category: 'battle' },
  brain_battle_perfect: { xp: 25, maxPerDay: 6, label: '100% Flawless Round Bonus', category: 'battle' },
  brain_battle_daily: { xp: 50, maxPerDay: 1, label: 'Daily Brain Battle Challenge', category: 'battle' },
  brain_battle_multiplayer_win: { xp: 45, maxPerDay: 8, label: 'Multiplayer Arena Victory', category: 'battle' },
  // Faculty engagement actions
  faculty_publish_assignment: { xp: 25, maxPerDay: 10, label: 'Assignment Published to Cohort', category: 'faculty' },
  faculty_grade_submission: { xp: 20, maxPerDay: 30, label: 'Student Submission Evaluated', category: 'faculty' },
  faculty_mark_attendance: { xp: 20, maxPerDay: 8, label: 'Class Attendance Submitted', category: 'faculty' },
  faculty_publish_announcement: { xp: 15, maxPerDay: 6, label: 'Cohort Circular Published', category: 'faculty' },
};

export interface SantaWindowStatus {
  isOpen: boolean;
  timeZone: string;
  windowStartHour: number;
  windowEndHour: number;
  windowLabel: string;
  currentLocalTimeLabel: string;
  eventNightKey: string;
  msUntilOpen: number;
  msUntilClose: number;
  localHour: number;
  localMinute: number;
  localSecond: number;
}

export function getSantaWindowStatus(
  nowMs: number = Date.now(),
  timeZone: string = 'Asia/Kolkata',
  windowStartHour: number = 19,
  windowEndHour: number = 21
): SantaWindowStatus {
  const safeTz = timeZone || 'Asia/Kolkata';
  const nowDate = new Date(nowMs);

  let year = nowDate.getUTCFullYear();
  let month = nowDate.getUTCMonth() + 1;
  let day = nowDate.getUTCDate();
  let hour = nowDate.getUTCHours();
  let minute = nowDate.getUTCMinutes();
  let second = nowDate.getUTCSeconds();

  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: safeTz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).formatToParts(nowDate);

    const getNum = (type: string) => {
      const p = parts.find(x => x.type === type)?.value;
      return p ? Number(p) : NaN;
    };
    const py = getNum('year');
    const pm = getNum('month');
    const pd = getNum('day');
    const ph = getNum('hour');
    const pmin = getNum('minute');
    const ps = getNum('second');

    if (Number.isFinite(py)) year = py;
    if (Number.isFinite(pm)) month = pm;
    if (Number.isFinite(pd)) day = pd;
    if (Number.isFinite(ph)) hour = ph === 24 ? 0 : ph;
    if (Number.isFinite(pmin)) minute = pmin;
    if (Number.isFinite(ps)) second = ps;
  } catch (_) {}

  const pad2 = (n: number) => String(n).padStart(2, '0');
  const eventNightKey = `${year}-${pad2(month)}-${pad2(day)}`;
  const isOpen = hour >= windowStartHour && hour < windowEndHour;

  const secondsSinceMidnight = hour * 3600 + minute * 60 + second;
  const startSeconds = windowStartHour * 3600;
  const endSeconds = windowEndHour * 3600;

  let msUntilOpen = 0;
  let msUntilClose = 0;

  if (isOpen) {
    msUntilClose = Math.max(0, (endSeconds - secondsSinceMidnight) * 1000);
  } else if (secondsSinceMidnight < startSeconds) {
    msUntilOpen = (startSeconds - secondsSinceMidnight) * 1000;
  } else {
    msUntilOpen = (24 * 3600 - secondsSinceMidnight + startSeconds) * 1000;
  }

  const ampm = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  const currentLocalTimeLabel = `${hour12}:${pad2(minute)}:${pad2(second)} ${ampm}`;

  const fmtHour12 = (h: number) => {
    const suffix = h >= 12 ? 'PM' : 'AM';
    const v = h % 12 === 0 ? 12 : h % 12;
    return `${v}:00 ${suffix}`;
  };

  return {
    isOpen,
    timeZone: safeTz,
    windowStartHour,
    windowEndHour,
    windowLabel: `${fmtHour12(windowStartHour)} – ${fmtHour12(windowEndHour)}`,
    currentLocalTimeLabel,
    eventNightKey,
    msUntilOpen,
    msUntilClose,
    localHour: hour,
    localMinute: minute,
    localSecond: second,
  };
}

export function rollSantaRewardTier(): SantaRewardTier {
  const totalWeight = SANTA_REWARD_TIERS.reduce((acc, t) => acc + t.weightBps, 0);
  const roll = crypto.randomInt(0, totalWeight);
  let cumulative = 0;
  for (const tier of SANTA_REWARD_TIERS) {
    cumulative += tier.weightBps;
    if (roll < cumulative) {
      return tier;
    }
  }
  return SANTA_REWARD_TIERS[0];
}

export function rollSpinWheelSegment(): SpinWheelSegment {
  const totalWeight = SPIN_WHEEL_SEGMENTS.reduce((acc, s) => acc + s.weightBps, 0);
  const roll = crypto.randomInt(0, totalWeight);
  let cumulative = 0;
  for (const seg of SPIN_WHEEL_SEGMENTS) {
    cumulative += seg.weightBps;
    if (roll < cumulative) {
      return seg;
    }
  }
  return SPIN_WHEEL_SEGMENTS[0];
}
