/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Client API service for Veylentra Winter Festival 3.1:
 * - Winter Profile Banners & Perimeter Borders
 * - Isolated Seasonal Frost XP Economy & Collectible Shop
 * - Winter Cookie Exchange
 * - Nightly Santa Gift, 2-Hour Spin Wheel, Hardened XP Actions & Separated Leaderboards
 */

import { UserProfile } from '../types';
import { buildAuthHeadersForUser } from './featureAccessService';
import { soundService } from './soundService';

export interface SantaTierSpec {
  rarity: 'Common' | 'Rare' | 'Legendary' | 'Insane';
  label: string;
  oddsPercent: number;
  description?: string;
}

export interface SpinWheelSegmentSpec {
  index: number;
  id: string;
  label: string;
  shortLabel: string;
  oddsPercent: number;
  rarity: string;
  color: string;
  textColor?: string;
}

export const DEFAULT_SPIN_SEGMENTS: SpinWheelSegmentSpec[] = [
  { index: 0, id: 'xp_25', label: '+25 Scholar XP', shortLabel: '+25 XP', oddsPercent: 24, rarity: 'standard', color: '#0284c7', textColor: '#ffffff' },
  { index: 1, id: 'cookies_3', label: '3 Winter Cookies', shortLabel: '3 Cookies', oddsPercent: 20, rarity: 'standard', color: '#e11d48', textColor: '#ffffff' },
  { index: 2, id: 'xp_50', label: '+50 Scholar XP', shortLabel: '+50 XP', oddsPercent: 18, rarity: 'standard', color: '#0f766e', textColor: '#f0fdfa' },
  { index: 3, id: 'ai_boost_2', label: '+2 Daily AI Queries', shortLabel: '+2 AI Boost', oddsPercent: 11, rarity: 'rare', color: '#1d4ed8', textColor: '#eff6ff' },
  { index: 4, id: 'xp_100', label: '+100 Scholar XP + 30 Frost XP', shortLabel: '+100 XP & Frost', oddsPercent: 10, rarity: 'rare', color: '#0369a1', textColor: '#e0f2fe' },
  { index: 5, id: 'streak_shield', label: 'Streak Freeze Shield', shortLabel: 'Shield', oddsPercent: 8, rarity: 'rare', color: '#334155', textColor: '#f8fafc' },
  { index: 6, id: 'cookies_6', label: '6 Cocoa Cookies', shortLabel: '6 Cookies', oddsPercent: 6, rarity: 'rare', color: '#be123c', textColor: '#fff1f2' },
  { index: 7, id: 'frost_jackpot', label: 'Frost Jackpot (+200 XP & Banner)', shortLabel: 'Jackpot!', oddsPercent: 3, rarity: 'jackpot', color: '#d97706', textColor: '#ffffff' },
];

export interface CookieExchangeOption {
  id: 'frost_xp_pack' | 'ai_bonus_query';
  title: string;
  description: string;
  cookieCost: number;
  frostXpGrant: number;
  aiBonusGrant: number;
}

export interface FrostXpTransaction {
  id: string;
  userId: string;
  amount: number;
  balanceAfter: number;
  reason: string;
  referenceType?: string;
  referenceId?: string;
  idempotencyKey: string;
  createdAt: string;
}

export interface WinterTaskItem {
  id: string;
  title: string;
  description: string;
  verificationMode: 'hub_visit' | 'academic_action' | 'winter_quiz' | 'spin_or_santa' | 'study_check';
  xpReward: number;
  frostXpReward: number;
  cookiesReward: number;
  badgeId?: string;
  borderId?: string;
  actionTab?: string;
  actionLabel?: string;
  claimed: boolean;
}

export interface WinterBadgeItem {
  id: string;
  name: string;
  description: string;
  unlockRequirement: string;
  purpose?: string;
  rarity: string;
  isHiddenUntilUnlocked?: boolean;
  unlockedAt: string | null;
}

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

export interface WinterProfileBorder {
  id: string;
  name: string;
  description: string;
  unlockRequirement: string;
  purpose?: string;
  rarity: 'seasonal' | 'rare' | 'legendary';
  accentColor: string;
  frostXpCost: number;
  purchasableWithFrostXp: boolean;
  vfxType?: 'ice' | 'snowflake' | 'glow' | 'peppermint' | 'gilded' | 'prism';
}

export interface WinterRewardRecord {
  id: string;
  featureType: 'santa_gift' | 'spin_wheel' | 'winter_task' | 'winter_shop' | 'cookie_exchange' | 'admin_grant';
  idempotencyKey: string;
  eventNightKey?: string;
  status: 'pending_apply' | 'applied' | 'recovered';
  rarity: string;
  segmentIndex?: number;
  label: string;
  xpBonus: number;
  frostXpBonus?: number;
  cookiesBonus: number;
  aiBonusQueries: number;
  streakShield: boolean;
  badgeId?: string;
  bannerId?: string;
  borderId?: string;
  createdAt: string;
  appliedAt?: string;
}

export interface WinterStatusResponse {
  success: boolean;
  isSuperAdmin?: boolean;
  winterState: {
    userId: string;
    userName: string;
    userRole: string;
    frostXp: number;
    cookiesCount: number;
    streakShields: number;
    unlockedBanners: string[];
    equippedBanner: string | null;
    unlockedBorders: string[];
    equippedBorder: string | null;
    spinNextEligibleAt: string | null;
    lastSpinAt: string | null;
    lastWheelNotifiedCycle: string | null;
    aiBonusDate: string;
    aiBonusCreditsToday: number;
    quizCompleted: boolean;
    claimedTaskIds: string[];
    earnedWinterBadges: Record<string, string>;
    santaClaimedNights: Record<string, string>;
    rewardHistory: WinterRewardRecord[];
    frostXpTransactions?: FrostXpTransaction[];
  };
  santa: {
    enabled: boolean;
    window: {
      isOpen: boolean;
      timeZone: string;
      windowLabel: string;
      eventNightKey: string;
      msUntilOpen: number;
      msUntilClose: number;
      currentLocalTimeLabel?: string;
    };
    alreadyClaimedTonight: boolean;
    odds: SantaTierSpec[];
  };
  spinWheel: {
    enabled: boolean;
    canSpin: boolean;
    remainingMs: number;
    nextEligibleAt: string | null;
    cooldownMs: number;
    lastWheelNotifiedCycle: string | null;
    segments: SpinWheelSegmentSpec[];
  };
  tasks: WinterTaskItem[];
  badges: WinterBadgeItem[];
  banners: WinterProfileBanner[];
  borders: WinterProfileBorder[];
  cookieExchangeOptions: CookieExchangeOption[];
  quizQuestions: Array<{ id: string; prompt: string; options: string[] }>;
  serverTime: string;
}

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  name: string;
  role: string;
  grade: string;
  section: string;
  house: string;
  avatar: string;
  xp: number;
  level: number;
  levelTitle: string;
  nextLevelXp: number | null;
  currentStreak: number;
  winterCookies: number;
  equippedBanner: string | null;
  equippedBorder: string | null;
  badgesCount: number;
}

export interface LeaderboardResponse {
  success: boolean;
  type: 'student' | 'faculty';
  period: 'weekly' | 'monthly' | 'all_time';
  rankings: LeaderboardEntry[];
  totalParticipants: number;
  currentUserEntry: LeaderboardEntry | null;
  generatedAt: string;
  code?: string;
  error?: string;
}

export async function fetchWinterStatus(user: Partial<UserProfile> | null | undefined): Promise<WinterStatusResponse | null> {
  if (!user) return null;
  const headers = await buildAuthHeadersForUser(user);
  const res = await fetch('/api/winter/status', { headers, cache: 'no-store' });
  if (!res.ok) return null;
  return res.json();
}

export async function claimSantaGift(
  user: Partial<UserProfile> | null | undefined,
  idempotencyKey: string,
  isPreview: boolean = false
) {
  const headers = await buildAuthHeadersForUser(user);
  const res = await fetch('/api/winter/santa/claim', {
    method: 'POST',
    headers,
    body: JSON.stringify({ idempotencyKey, isPreview }),
  });
  const data = await res.json();
  return { ok: res.ok, status: res.status, data };
}

export async function spinWinterWheel(
  user: Partial<UserProfile> | null | undefined,
  idempotencyKey: string,
  isPreview: boolean = false
) {
  const headers = await buildAuthHeadersForUser(user);
  const res = await fetch('/api/winter/spin', {
    method: 'POST',
    headers,
    body: JSON.stringify({ idempotencyKey, isPreview }),
  });
  const data = await res.json();
  return { ok: res.ok, status: res.status, data };
}

export async function markWheelCycleNotified(user: Partial<UserProfile> | null | undefined, cycleKey: string) {
  try {
    const headers = await buildAuthHeadersForUser(user);
    await fetch('/api/winter/spin/notified', {
      method: 'POST',
      headers,
      body: JSON.stringify({ cycleKey }),
    });
  } catch (_) {}
}

export async function submitWinterQuiz(user: Partial<UserProfile> | null | undefined, answers: Record<string, number>) {
  const headers = await buildAuthHeadersForUser(user);
  const res = await fetch('/api/winter/quiz/submit', {
    method: 'POST',
    headers,
    body: JSON.stringify({ answers }),
  });
  const data = await res.json();
  return { ok: res.ok, status: res.status, data };
}

export async function claimWinterTask(user: Partial<UserProfile> | null | undefined, taskId: string) {
  const headers = await buildAuthHeadersForUser(user);
  const res = await fetch(`/api/winter/tasks/${encodeURIComponent(taskId)}/claim`, {
    method: 'POST',
    headers,
  });
  const data = await res.json();
  return { ok: res.ok, status: res.status, data };
}

export async function equipWinterBanner(user: Partial<UserProfile> | null | undefined, bannerId: string | null) {
  const headers = await buildAuthHeadersForUser(user);
  const res = await fetch('/api/winter/profile/banner', {
    method: 'POST',
    headers,
    body: JSON.stringify({ bannerId }),
  });
  const data = await res.json();
  return { ok: res.ok, status: res.status, data };
}

export async function equipWinterBorder(user: Partial<UserProfile> | null | undefined, borderId: string | null) {
  const headers = await buildAuthHeadersForUser(user);
  const res = await fetch('/api/winter/profile/border', {
    method: 'POST',
    headers,
    body: JSON.stringify({ borderId }),
  });
  const data = await res.json();
  return { ok: res.ok, status: res.status, data };
}

export async function purchaseWinterCollectible(
  user: Partial<UserProfile> | null | undefined,
  params: { itemType: 'banner' | 'border'; itemId: string; adminGrant?: boolean; idempotencyKey?: string }
) {
  const headers = await buildAuthHeadersForUser(user);
  const res = await fetch('/api/winter/shop/purchase', {
    method: 'POST',
    headers,
    body: JSON.stringify(params),
  });
  const data = await res.json();
  return { ok: res.ok, status: res.status, data };
}

export async function exchangeWinterCookies(
  user: Partial<UserProfile> | null | undefined,
  optionId: 'frost_xp_pack' | 'ai_bonus_query'
) {
  const headers = await buildAuthHeadersForUser(user);
  const res = await fetch('/api/winter/cookies/exchange', {
    method: 'POST',
    headers,
    body: JSON.stringify({ optionId }),
  });
  const data = await res.json();
  return { ok: res.ok, status: res.status, data };
}

export async function fetchFrostXpHistory(user: Partial<UserProfile> | null | undefined): Promise<{
  ok: boolean;
  frostXp: number;
  transactions: FrostXpTransaction[];
}> {
  if (!user) return { ok: false, frostXp: 0, transactions: [] };
  const headers = await buildAuthHeadersForUser(user);
  const res = await fetch('/api/winter/frost-xp/history', { headers, cache: 'no-store' });
  const data = await res.json().catch(() => ({}));
  return {
    ok: res.ok && Boolean(data?.success),
    frostXp: Number(data?.frostXp || 0),
    transactions: Array.isArray(data?.transactions) ? data.transactions : [],
  };
}

export interface PublicWinterCosmetics {
  userId: string;
  equippedBanner: string | null;
  equippedBorder: string | null;
  unlockedBanners: string[];
  unlockedBorders: string[];
  cookiesCount: number;
  badgesCount: number;
  frostXp?: number;
  publicProfile?: {
    uid: string;
    name: string;
    role: string;
    photoURL?: string;
    bio?: string;
    house?: string;
    grade?: string;
    section?: string;
    points?: number;
    bannerUrl?: string;
    bannerPreset?: string;
    avatarFrame?: string;
    accentColor?: string;
    pronouns?: string;
    customStatus?: string;
    badges?: any[];
  } | null;
}

export async function fetchPublicWinterCosmetics(
  userId: string,
  requester?: Partial<UserProfile> | null
): Promise<PublicWinterCosmetics | null> {
  if (!userId) return null;
  try {
    const headers = requester ? await buildAuthHeadersForUser(requester) : { 'Content-Type': 'application/json' };
    const res = await fetch(`/api/winter/profile/cosmetics/${encodeURIComponent(userId)}`, {
      headers,
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data?.success || !data?.cosmetics) return null;
    return data.cosmetics as PublicWinterCosmetics;
  } catch {
    return null;
  }
}

export async function awardServerActionXp(
  user: Partial<UserProfile> | null | undefined,
  action: string,
  itemId?: string,
  options?: { syncedFromClientProfile?: boolean }
) {
  if (!user || !(user.uid || (user as any).id)) return null;
  try {
    const headers = await buildAuthHeadersForUser(user);
    const res = await fetch('/api/gamification/action', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        action,
        itemId,
        syncedFromClientProfile: Boolean(options?.syncedFromClientProfile),
      }),
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function fetchSeparatedLeaderboard(params: {
  type: 'student' | 'faculty';
  period: 'weekly' | 'monthly' | 'all_time';
  user?: Partial<UserProfile> | null;
}): Promise<{ ok: boolean; status: number; data?: LeaderboardResponse; error?: string }> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);
  try {
    const headers = await buildAuthHeadersForUser(params.user);
    const res = await fetch(
      `/api/leaderboard?type=${encodeURIComponent(params.type)}&period=${encodeURIComponent(params.period)}`,
      { headers, signal: controller.signal }
    );
    clearTimeout(timeoutId);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { ok: false, status: res.status, data, error: data?.error || 'Leaderboard unavailable' };
    }
    return { ok: true, status: res.status, data };
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err?.name === 'AbortError') {
      return { ok: false, status: 408, error: 'Request timed out while loading leaderboard. Please retry.' };
    }
    return { ok: false, status: 500, error: err?.message || 'Unable to load leaderboard' };
  }
}

export function formatCountdownMs(ms: number): string {
  const clamped = Math.max(0, Math.floor(ms / 1000));
  const hrs = Math.floor(clamped / 3600);
  const mins = Math.floor((clamped % 3600) / 60);
  const secs = clamped % 60;
  return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function hasExplicitSoundPreference(): boolean {
  try {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('studentos_sound_muted') !== null;
  } catch {
    return false;
  }
}

export function isGlobalSoundEnabled(): boolean {
  try {
    return !soundService.getPreferences().muted;
  } catch {
    return false;
  }
}

export function playWheelTickCue(wheelAudioEnabled: boolean, isSettleTick: boolean = false) {
  if (!wheelAudioEnabled || soundService.getPreferences().muted) return;
  try {
    soundService.playWheelTick(isSettleTick);
  } catch (_) {}
}

export function playWheelCelebrateCue(wheelAudioEnabled: boolean) {
  if (!wheelAudioEnabled || soundService.getPreferences().muted) return;
  try {
    soundService.playSuccessSound();
  } catch (_) {}
}
