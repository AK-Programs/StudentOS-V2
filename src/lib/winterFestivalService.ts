/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Client API service for Veylentra Winter Festival, Nightly Santa Gift,
 * 2-Hour Spin Wheel, Hardened XP Actions, and Separated Student/Faculty Leaderboards.
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

export interface WinterTaskItem {
  id: string;
  title: string;
  description: string;
  verificationMode: 'hub_visit' | 'academic_action' | 'winter_quiz' | 'spin_or_santa' | 'study_check';
  xpReward: number;
  cookiesReward: number;
  badgeId?: string;
  actionTab?: string;
  actionLabel?: string;
  claimed: boolean;
}

export interface WinterBadgeItem {
  id: string;
  name: string;
  description: string;
  unlockRequirement: string;
  rarity: string;
  isHiddenUntilUnlocked?: boolean;
  unlockedAt: string | null;
}

export interface WinterProfileFrame {
  id: string;
  name: string;
  description: string;
  cssRing?: string;
}

export interface WinterRewardRecord {
  id: string;
  featureType: 'santa_gift' | 'spin_wheel' | 'winter_task';
  idempotencyKey: string;
  eventNightKey?: string;
  status: 'pending_apply' | 'applied' | 'recovered';
  rarity: string;
  segmentIndex?: number;
  label: string;
  xpBonus: number;
  cookiesBonus: number;
  aiBonusQueries: number;
  streakShield: boolean;
  badgeId?: string;
  frameId?: string;
  createdAt: string;
  appliedAt?: string;
}

export interface WinterStatusResponse {
  success: boolean;
  winterState: {
    userId: string;
    userName: string;
    userRole: string;
    cookiesCount: number;
    streakShields: number;
    unlockedFrames: string[];
    equippedFrame: string | null;
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
  frames: WinterProfileFrame[];
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
  equippedFrame: string | null;
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
  const res = await fetch('/api/winter/status', { headers });
  if (!res.ok) return null;
  return res.json();
}

export async function claimSantaGift(user: Partial<UserProfile> | null | undefined, idempotencyKey: string) {
  const headers = await buildAuthHeadersForUser(user);
  const res = await fetch('/api/winter/santa/claim', {
    method: 'POST',
    headers,
    body: JSON.stringify({ idempotencyKey }),
  });
  const data = await res.json();
  return { ok: res.ok, status: res.status, data };
}

export async function spinWinterWheel(user: Partial<UserProfile> | null | undefined, idempotencyKey: string) {
  const headers = await buildAuthHeadersForUser(user);
  const res = await fetch('/api/winter/spin', {
    method: 'POST',
    headers,
    body: JSON.stringify({ idempotencyKey }),
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

export async function equipWinterFrame(user: Partial<UserProfile> | null | undefined, frameId: string | null) {
  const headers = await buildAuthHeadersForUser(user);
  const res = await fetch('/api/winter/profile/frame', {
    method: 'POST',
    headers,
    body: JSON.stringify({ frameId }),
  });
  const data = await res.json();
  return { ok: res.ok, status: res.status, data };
}

export async function awardServerActionXp(
  user: Partial<UserProfile> | null | undefined,
  action: string,
  itemId?: string
) {
  if (!user || !(user.uid || (user as any).id)) return null;
  try {
    const headers = await buildAuthHeadersForUser(user);
    const res = await fetch('/api/gamification/action', {
      method: 'POST',
      headers,
      body: JSON.stringify({ action, itemId }),
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
  try {
    const headers = await buildAuthHeadersForUser(params.user);
    const res = await fetch(
      `/api/leaderboard?type=${encodeURIComponent(params.type)}&period=${encodeURIComponent(params.period)}`,
      { headers }
    );
    const data = await res.json();
    if (!res.ok) {
      return { ok: false, status: res.status, data, error: data?.error || 'Leaderboard unavailable' };
    }
    return { ok: true, status: res.status, data };
  } catch (err: any) {
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

export function playWheelTickCue(wheelAudioEnabled: boolean) {
  if (!wheelAudioEnabled || soundService.getPreferences().muted) return;
  try {
    soundService.playButtonClick();
  } catch (_) {}
}

export function playWheelCelebrateCue(wheelAudioEnabled: boolean) {
  if (!wheelAudioEnabled || soundService.getPreferences().muted) return;
  try {
    soundService.playSuccessSound();
  } catch (_) {}
}
