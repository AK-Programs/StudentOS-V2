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
  frostXpBonus: number;
  cookiesBonus: number;
  aiBonusQueries: number;
  streakShield: boolean;
  badgeId?: string;
  bannerId?: string;
  borderId?: string;
  description: string;
}

export const SANTA_REWARD_TIERS: SantaRewardTier[] = [
  {
    rarity: 'common',
    label: 'Warm Cocoa Bundle',
    weightBps: 6000,
    oddsPercent: 60,
    xpBonus: 25,
    frostXpBonus: 20,
    cookiesBonus: 3,
    aiBonusQueries: 1,
    streakShield: false,
    description: '+25 Scholar XP, +20 Frost XP, 3 Winter Cookies & +1 Daily AI Bonus Query',
  },
  {
    rarity: 'rare',
    label: 'Frost Lantern Pack',
    weightBps: 2500,
    oddsPercent: 25,
    xpBonus: 60,
    frostXpBonus: 45,
    cookiesBonus: 6,
    aiBonusQueries: 2,
    streakShield: true,
    bannerId: 'frosted_aurora',
    borderId: 'winter_glow_border',
    description: '+60 Scholar XP, +45 Frost XP, 6 Winter Cookies, Streak Shield, Frosted Aurora Banner & Winter Glow Border',
  },
  {
    rarity: 'legendary',
    label: 'Starlight Sleigh Crate',
    weightBps: 1100,
    oddsPercent: 11,
    xpBonus: 120,
    frostXpBonus: 90,
    cookiesBonus: 12,
    aiBonusQueries: 3,
    streakShield: true,
    badgeId: 'sleigh_keeper',
    bannerId: 'starlight_gold',
    borderId: 'golden_festival_border',
    description: '+120 Scholar XP, +90 Frost XP, 12 Winter Cookies, +3 AI Queries, Sleigh Keeper Badge, Starlight Sleigh Banner & Golden Festival Border',
  },
  {
    rarity: 'insane',
    label: 'Aurora Crown Vault',
    weightBps: 400,
    oddsPercent: 4,
    xpBonus: 250,
    frostXpBonus: 160,
    cookiesBonus: 20,
    aiBonusQueries: 5,
    streakShield: true,
    badgeId: 'aurora_miracle',
    bannerId: 'aurora_crown',
    borderId: 'golden_festival_border',
    description: '+250 Scholar XP, +160 Frost XP, 20 Winter Cookies, +5 Daily AI Queries, Aurora Miracle Badge, Aurora Crown Banner & Golden Festival Border!',
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
  frostXpBonus: number;
  cookiesBonus: number;
  aiBonusQueries: number;
  streakShield: boolean;
  badgeId?: string;
  bannerId?: string;
  borderId?: string;
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
    frostXpBonus: 10,
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
    frostXpBonus: 15,
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
    frostXpBonus: 15,
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
    frostXpBonus: 20,
    cookiesBonus: 1,
    aiBonusQueries: 2,
    streakShield: false,
    rarity: 'rare',
  },
  {
    index: 4,
    id: 'xp_100',
    label: '+100 Scholar XP + 30 Frost XP',
    shortLabel: '+100 XP & Frost',
    color: '#0369a1',
    textColor: '#e0f2fe',
    weightBps: 1000,
    oddsPercent: 10,
    xpBonus: 100,
    frostXpBonus: 30,
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
    frostXpBonus: 25,
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
    frostXpBonus: 25,
    cookiesBonus: 6,
    aiBonusQueries: 1,
    streakShield: false,
    borderId: 'candy_cane_border',
    rarity: 'rare',
  },
  {
    index: 7,
    id: 'frost_jackpot',
    label: 'Frost Jackpot (+200 XP & Banner)',
    shortLabel: 'Jackpot!',
    color: '#d97706',
    textColor: '#ffffff',
    weightBps: 300,
    oddsPercent: 3,
    xpBonus: 200,
    frostXpBonus: 75,
    cookiesBonus: 10,
    aiBonusQueries: 3,
    streakShield: true,
    badgeId: 'winter_wheel_ace',
    bannerId: 'candy_ribbon',
    borderId: 'golden_festival_border',
    rarity: 'jackpot',
  },
];

export const SPIN_WHEEL_COOLDOWN_MS = 2 * 60 * 60 * 1000; // Strictly 2 hours
export const MAX_DAILY_WINTER_AI_BONUS = 5;
export const MAX_STREAK_SHIELDS = 3;

export interface CookieExchangeOption {
  id: 'frost_xp_pack' | 'ai_bonus_query';
  title: string;
  description: string;
  cookieCost: number;
  frostXpGrant: number;
  aiBonusGrant: number;
}

export const COOKIE_EXCHANGE_OPTIONS: CookieExchangeOption[] = [
  {
    id: 'frost_xp_pack',
    title: 'Exchange Cookies for Frost XP',
    description: 'Trade 5 Winter Cookies for +30 seasonal Frost XP to unlock Profile Banners & Borders in the Winter Shop.',
    cookieCost: 5,
    frostXpGrant: 30,
    aiBonusGrant: 0,
  },
  {
    id: 'ai_bonus_query',
    title: 'Brew Study Focus Boost (+1 AI Query)',
    description: 'Trade 6 Winter Cookies for +1 extra daily Orion / AI Tutor query (up to daily bonus cap of 5).',
    cookieCost: 6,
    frostXpGrant: 0,
    aiBonusGrant: 1,
  },
];

export interface WinterTaskDefinition {
  id: string;
  title: string;
  description: string;
  xpReward: number;
  frostXpReward: number;
  cookiesReward: number;
  badgeId?: string;
  borderId?: string;
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
    frostXpReward: 25,
    cookiesReward: 2,
    badgeId: 'snowflake_explorer',
    borderId: 'frosted_ice_border',
    verificationMode: 'hub_visit',
    actionLabel: 'Claim Arrival Treat',
  },
  {
    id: 'task_winter_quiz',
    title: 'Complete the Winter Knowledge Check',
    description: 'Answer the 3-question winter science & campus trivia challenge correctly.',
    xpReward: 40,
    frostXpReward: 40,
    cookiesReward: 3,
    badgeId: 'winter_scholar',
    borderId: 'snowflake_border',
    verificationMode: 'winter_quiz',
    actionLabel: 'Take Quick Quiz',
  },
  {
    id: 'task_academic_engagement',
    title: 'Complete One Verified Study Action',
    description: 'Log any academic XP action (notes, flashcards, assignment, Brain Battle, or attendance check).',
    xpReward: 35,
    frostXpReward: 35,
    cookiesReward: 3,
    badgeId: 'frosty_focus',
    borderId: 'winter_glow_border',
    verificationMode: 'academic_action',
    actionTab: 'study_hub',
    actionLabel: 'Open Study Hub',
  },
  {
    id: 'task_collect_cookies',
    title: 'Bake 5 Winter Cookies',
    description: 'Gather at least 5 Winter Cookies through festival tasks, Spin Wheel, or Santa gifts.',
    xpReward: 45,
    frostXpReward: 45,
    cookiesReward: 4,
    badgeId: 'cookie_collector',
    borderId: 'candy_cane_border',
    verificationMode: 'study_check',
    actionLabel: 'Verify Cookie Jar',
  },
  {
    id: 'task_seasonal_wheel_or_gift',
    title: 'Try the Spin Wheel or Nightly Santa Gift',
    description: 'Participate in a verified Winter Spin Wheel roll or claim a Nightly Santa Gift.',
    xpReward: 30,
    frostXpReward: 30,
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
  purpose: string;
  rarity: 'seasonal' | 'rare' | 'legendary' | 'secret';
  isHiddenUntilUnlocked?: boolean;
}

export const WINTER_FESTIVAL_BADGES: WinterBadgeDefinition[] = [
  {
    id: 'snowflake_explorer',
    name: 'Snowflake Explorer',
    description: 'Stepped into the campus Winter Festival Celebration.',
    unlockRequirement: 'Claim the Winter Festival arrival task',
    purpose: 'Displayed on Profile Badge Showcase & Chat Public Profile',
    rarity: 'seasonal',
  },
  {
    id: 'winter_scholar',
    name: 'Winter Scholar',
    description: 'Aced the 3-question Winter Science & Knowledge Check.',
    unlockRequirement: 'Pass the Winter Knowledge Check mini-quiz',
    purpose: 'Displayed on Profile Badge Showcase & Chat Public Profile',
    rarity: 'seasonal',
  },
  {
    id: 'frosty_focus',
    name: 'Frosty Focus',
    description: 'Maintained real academic momentum throughout the winter season.',
    unlockRequirement: 'Complete any verified academic study action',
    purpose: 'Displayed on Profile Badge Showcase & Chat Public Profile',
    rarity: 'rare',
  },
  {
    id: 'cookie_collector',
    name: 'Cookie Jar Curator',
    description: 'Collected at least 5 festive Winter Cookies.',
    unlockRequirement: 'Collect 5+ Winter Cookies',
    purpose: 'Displayed on Profile Badge Showcase & Chat Public Profile',
    rarity: 'rare',
  },
  {
    id: 'winter_champion',
    name: 'Solstice Celebrant',
    description: 'Participated in either the Winter Spin Wheel or Nightly Santa Gift.',
    unlockRequirement: 'Try Spin Wheel or Santa Gift once',
    purpose: 'Displayed on Profile Badge Showcase & Chat Public Profile',
    rarity: 'rare',
  },
  {
    id: 'sleigh_keeper',
    name: 'Sleigh Keeper',
    description: 'Unwrapped a Legendary Starlight Sleigh Crate during the 7–9 PM window.',
    unlockRequirement: 'Unwrap a Legendary Santa Gift',
    purpose: 'Prestigious seasonal profile merit badge',
    rarity: 'legendary',
  },
  {
    id: 'winter_wheel_ace',
    name: 'Frost Wheel Ace',
    description: 'Landed cleanly on the Frost Jackpot slice of the Winter Spin Wheel.',
    unlockRequirement: 'Hit the Frost Jackpot slice',
    purpose: 'Prestigious seasonal profile merit badge',
    rarity: 'legendary',
  },
  {
    id: 'aurora_miracle',
    name: 'Aurora Crown Miracle',
    description: 'Unwrapped the ultra-rare 4% Aurora Crown Vault.',
    unlockRequirement: 'Hidden Secret Collectible',
    purpose: 'Ultra-rare secret merit badge on Profile',
    rarity: 'secret',
    isHiddenUntilUnlocked: true,
  },
  {
    id: 'north_star_secret',
    name: 'North Star Alchemist',
    description: 'Collected 15+ Winter Cookies and completed 3+ seasonal festival tasks.',
    unlockRequirement: 'Hidden Secret Collectible',
    purpose: 'Hidden milestone badge that also unlocks Golden Festival Border',
    rarity: 'secret',
    isHiddenUntilUnlocked: true,
  },
];

export interface WinterProfileBanner {
  id: string;
  name: string;
  description: string;
  rarity: 'seasonal' | 'rare' | 'legendary' | 'secret';
  unlockRequirement: string;
  purpose: string;
  frostXpCost: number;
  purchasableWithFrostXp: boolean;
  vfxType: 'aurora' | 'peppermint' | 'starlight' | 'crown' | 'snowfall' | 'hearth';
  accentColor: string;
}

export const WINTER_PROFILE_BANNERS: WinterProfileBanner[] = [
  {
    id: 'midnight_snowfall_banner',
    name: 'Midnight Snowfall Banner',
    description: 'Deep twilight glacier backdrop with drifting snowfall parallax behind your profile header.',
    rarity: 'seasonal',
    unlockRequirement: 'Winter Shop — 90 Frost XP',
    purpose: 'Background banner rendered behind your profile avatar & card header across dashboards & chat',
    frostXpCost: 90,
    purchasableWithFrostXp: true,
    vfxType: 'snowfall',
    accentColor: '#38bdf8',
  },
  {
    id: 'frosted_aurora',
    name: 'Frosted Aurora Banner',
    description: 'Rippling arctic aurora borealis curtains glowing gently behind your profile identity.',
    rarity: 'rare',
    unlockRequirement: 'Rare Frost Lantern Santa Pack (25%) OR 140 Frost XP',
    purpose: 'Background banner rendered behind your profile avatar & card header across dashboards & chat',
    frostXpCost: 140,
    purchasableWithFrostXp: true,
    vfxType: 'aurora',
    accentColor: '#22d3ee',
  },
  {
    id: 'solstice_hearth_banner',
    name: 'Solstice Hearth Banner',
    description: 'Warm amber lantern light contrasting cool frosted pine silhouettes.',
    rarity: 'rare',
    unlockRequirement: 'Winter Shop — 160 Frost XP',
    purpose: 'Background banner rendered behind your profile avatar & card header across dashboards & chat',
    frostXpCost: 160,
    purchasableWithFrostXp: true,
    vfxType: 'hearth',
    accentColor: '#f59e0b',
  },
  {
    id: 'candy_ribbon',
    name: 'Peppermint Ribbon Banner',
    description: 'Diagonal crimson-and-ivory peppermint silk ribbons with crystalline frost highlights.',
    rarity: 'legendary',
    unlockRequirement: 'Spin Wheel Frost Jackpot (3%) OR 220 Frost XP',
    purpose: 'Background banner rendered behind your profile avatar & card header across dashboards & chat',
    frostXpCost: 220,
    purchasableWithFrostXp: true,
    vfxType: 'peppermint',
    accentColor: '#fb7185',
  },
  {
    id: 'starlight_gold',
    name: 'Starlight Sleigh Banner',
    description: 'Gilded constellation canopy from Legendary Santa crates with twinkling starlight.',
    rarity: 'legendary',
    unlockRequirement: 'Unwrap a Legendary Starlight Sleigh Crate from Nightly Santa Gift (11%)',
    purpose: 'Prestige animated background banner across profile headers & leaderboards',
    frostXpCost: 0,
    purchasableWithFrostXp: false,
    vfxType: 'starlight',
    accentColor: '#fbbf24',
  },
  {
    id: 'aurora_crown',
    name: 'Aurora Crown Banner',
    description: 'Prismatic glacial crown sweep from ultra-rare 4% Insane Santa vaults.',
    rarity: 'secret',
    unlockRequirement: 'Unwrap the 4% Aurora Crown Vault from Nightly Santa Gift',
    purpose: 'Ultra-rare animated background banner across profile headers & chat cards',
    frostXpCost: 0,
    purchasableWithFrostXp: false,
    vfxType: 'crown',
    accentColor: '#67e8f9',
  },
];

export const LEGACY_WINTER_BANNER_IDS = new Set([
  'frosted_aurora',
  'candy_ribbon',
  'starlight_gold',
  'aurora_crown',
]);

export interface WinterProfileBorder {
  id: string;
  name: string;
  description: string;
  unlockRequirement: string;
  purpose: string;
  rarity: 'seasonal' | 'rare' | 'legendary';
  accentColor: string;
  frostXpCost: number;
  purchasableWithFrostXp: boolean;
  vfxType: 'ice' | 'snowflake' | 'glow' | 'peppermint' | 'gilded' | 'prism';
}

export const WINTER_PROFILE_BORDERS: WinterProfileBorder[] = [
  {
    id: 'frosted_ice_border',
    name: 'Frosted Ice Border',
    description: 'Subtle crystalline frost enclosure with cool glacial rim glow.',
    unlockRequirement: 'Claim arrival task OR 60 Frost XP',
    purpose: 'Perimeter frame aligned directly to the shape of your avatar',
    rarity: 'seasonal',
    accentColor: '#38bdf8',
    frostXpCost: 60,
    purchasableWithFrostXp: true,
    vfxType: 'ice',
  },
  {
    id: 'snowflake_border',
    name: 'Snowflake Border',
    description: 'Precision six-point snowflake crest perimeter for winter scholars.',
    unlockRequirement: 'Pass Winter Knowledge Check OR 80 Frost XP',
    purpose: 'Perimeter frame aligned directly to the shape of your avatar',
    rarity: 'seasonal',
    accentColor: '#7dd3fc',
    frostXpCost: 80,
    purchasableWithFrostXp: true,
    vfxType: 'snowflake',
  },
  {
    id: 'winter_glow_border',
    name: 'Winter Glow Border',
    description: 'Luminous boreal mist halo around your avatar contour.',
    unlockRequirement: 'Verified Study Action OR Rare Santa Chest OR 110 Frost XP',
    purpose: 'Perimeter frame aligned directly to the shape of your avatar',
    rarity: 'rare',
    accentColor: '#22d3ee',
    frostXpCost: 110,
    purchasableWithFrostXp: true,
    vfxType: 'glow',
  },
  {
    id: 'candy_cane_border',
    name: 'Candy Cane Border',
    description: 'Festive peppermint stripe trim tracing your avatar perimeter.',
    unlockRequirement: 'Bake 5 Cookies OR Spin 6 Cookies OR 130 Frost XP',
    purpose: 'Perimeter frame aligned directly to the shape of your avatar',
    rarity: 'rare',
    accentColor: '#fb7185',
    frostXpCost: 130,
    purchasableWithFrostXp: true,
    vfxType: 'peppermint',
  },
  {
    id: 'aurora_prism_border',
    name: 'Aurora Prism Border',
    description: 'Slowly rotating holographic arctic prism contour exclusive to the Winter Shop.',
    unlockRequirement: 'Winter Shop — 175 Frost XP',
    purpose: 'Prestige perimeter frame aligned directly to the shape of your avatar',
    rarity: 'legendary',
    accentColor: '#06b6d4',
    frostXpCost: 175,
    purchasableWithFrostXp: true,
    vfxType: 'prism',
  },
  {
    id: 'golden_festival_border',
    name: 'Golden Festival Border',
    description: 'Distinguished gilded winter solstice border with warm starlight sheen.',
    unlockRequirement: 'Spin Wheel Jackpot, Legendary/Insane Santa Chest, or North Star Secret',
    purpose: 'Prestige perimeter frame aligned directly to the shape of your avatar',
    rarity: 'legendary',
    accentColor: '#fbbf24',
    frostXpCost: 0,
    purchasableWithFrostXp: false,
    vfxType: 'gilded',
  },
];

export function getWinterBadgeById(id?: string | null): WinterBadgeDefinition | undefined {
  if (!id) return undefined;
  return WINTER_FESTIVAL_BADGES.find(b => b.id === id);
}

export function getWinterBannerById(id?: string | null): WinterProfileBanner | undefined {
  if (!id) return undefined;
  return WINTER_PROFILE_BANNERS.find(b => b.id === id);
}

export function getWinterBorderById(id?: string | null): WinterProfileBorder | undefined {
  if (!id) return undefined;
  return WINTER_PROFILE_BORDERS.find(b => b.id === id);
}

export function isValidWinterBannerId(id?: string | null): boolean {
  return Boolean(getWinterBannerById(id));
}

export function isValidWinterBorderId(id?: string | null): boolean {
  return Boolean(getWinterBorderById(id));
}

export function getAllWinterCollectibleIds() {
  return {
    badgeIds: WINTER_FESTIVAL_BADGES.map(b => b.id),
    bannerIds: WINTER_PROFILE_BANNERS.map(b => b.id),
    borderIds: WINTER_PROFILE_BORDERS.map(b => b.id),
  };
}

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
  // System 2.0 Streak & Mission Rewards
  streak_recovery: { xp: 35, maxPerDay: 1, label: 'Learning Streak Restored', category: 'streak' },
  daily_mission_complete: { xp: 25, maxPerDay: 5, label: 'Daily Mission Completed', category: 'academic' },
  weekly_mission_complete: { xp: 75, maxPerDay: 3, label: 'Weekly Milestone Reached', category: 'academic' },
  milestone_mission_complete: { xp: 100, maxPerDay: 3, label: 'Achievement Milestone Reached', category: 'academic' },
  // Faculty, Coordinator & Admin engagement actions
  faculty_publish_assignment: { xp: 25, maxPerDay: 10, label: 'Assignment Published to Cohort', category: 'faculty' },
  faculty_grade_submission: { xp: 20, maxPerDay: 30, label: 'Student Submission Evaluated', category: 'faculty' },
  faculty_mark_attendance: { xp: 20, maxPerDay: 8, label: 'Class Attendance Submitted', category: 'faculty' },
  faculty_publish_announcement: { xp: 15, maxPerDay: 6, label: 'Cohort Circular Published', category: 'faculty' },
  faculty_workflow_action: { xp: 25, maxPerDay: 6, label: 'Teaching Workflow Completed', category: 'faculty' },
  coordinator_oversight_action: { xp: 30, maxPerDay: 5, label: 'Cohort Oversight Review Completed', category: 'faculty' },
  admin_ops_action: { xp: 25, maxPerDay: 5, label: 'Operations & Governance Review Completed', category: 'faculty' },
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
