/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Veylentra Attention, Engagement & Retention System 2.0 Client Service
 * - Connects to server-authoritative /api/engagement/* endpoints
 * - Synchronizes streak states, verified recovery, role-aware missions, weekly progress & policies
 * - Provides per-user deduplicated celebration dispatchers for Level-Up & Regular Badges
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  EngagementOverview,
  EngagementPolicyConfig,
  SmartReturnContext,
  UserProfile,
} from '../types';
import { buildAuthHeadersForUser } from './featureAccessService';
import { BadgeDefinition, LevelDefinition, calculateLevelInfo } from './gamification';
import { awardServerActionXp } from './winterFestivalService';

export const ENGAGEMENT_UPDATED_EVENT = 'veylentra-engagement-updated';
export const LEVEL_UP_EVENT = 'veylentra-level-up';
export const REGULAR_BADGE_UNLOCKED_EVENT = 'veylentra-regular-badge-unlocked';
export const STREAK_RECOVERED_EVENT = 'studentos-streak-recovered';

export interface StreakRecoveryCelebrationPayload {
  userId: string;
  restoredFrom: number;
  newStreak: number;
  xpRewarded: number;
  activityType?: string;
  role: string;
  timestamp: string;
}

export interface LevelUpCelebrationPayload {
  userId: string;
  previousLevel: number;
  newLevel: number;
  levelTitle: string;
  icon: string;
  color: string;
  totalXp: number;
  xpToNext: number | null;
  perks: string[];
  timestamp: string;
}

export interface RegularBadgeUnlockPayload {
  userId: string;
  badge: BadgeDefinition;
  earnedAt: string;
}

export function dispatchEngagementUpdate(userId?: string) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(ENGAGEMENT_UPDATED_EVENT, { detail: { userId } }));
  }
}

function getSeenLevelKey(userId: string): string {
  return `veylentra_seen_level_v2_${userId}`;
}

function getSeenBadgesKey(userId: string): string {
  return `veylentra_seen_badges_v2_${userId}`;
}

const memorySeenLevel = new Map<string, number>();
const memorySeenBadges = new Map<string, Set<string>>();

/**
 * Records the current level & unlocked badge IDs silently on initial load/login/account switch
 * so reloading or logging into an older account NEVER replays historical level-ups or badges.
 */
export function seedCelebrationBaseline(userId: string, currentLevel: number, earnedBadgeIds: string[]) {
  if (!userId) return;
  const prevMemLvl = memorySeenLevel.get(userId) || 0;
  memorySeenLevel.set(userId, Math.max(1, prevMemLvl, currentLevel));
  const memSet = memorySeenBadges.get(userId) || new Set<string>();
  earnedBadgeIds.forEach((id) => memSet.add(id));
  memorySeenBadges.set(userId, memSet);

  if (typeof window === 'undefined') return;
  try {
    const levelKey = getSeenLevelKey(userId);
    const existingLvl = Number(localStorage.getItem(levelKey) || 0);
    if (currentLevel > existingLvl || !localStorage.getItem(levelKey)) {
      localStorage.setItem(levelKey, String(Math.max(1, currentLevel)));
    }
    const badgesKey = getSeenBadgesKey(userId);
    const existingRaw = localStorage.getItem(badgesKey);
    const existingSet = new Set<string>(existingRaw ? JSON.parse(existingRaw) : []);
    earnedBadgeIds.forEach((id) => existingSet.add(id));
    localStorage.setItem(badgesKey, JSON.stringify(Array.from(existingSet)));
  } catch (_) {}
}

export function dispatchLevelUpIfNew(
  userId: string,
  prevLevel: number,
  newLevelDef: LevelDefinition,
  totalXp: number
): boolean {
  if (!userId) return false;
  let seenLevel = memorySeenLevel.get(userId) || prevLevel || 1;
  if (typeof window !== 'undefined') {
    try {
      const levelKey = getSeenLevelKey(userId);
      const stored = localStorage.getItem(levelKey);
      if (stored) seenLevel = Math.max(seenLevel, Number(stored));
    } catch (_) {}
  }
  if (newLevelDef.level <= seenLevel) return false;

  memorySeenLevel.set(userId, newLevelDef.level);
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(getSeenLevelKey(userId), String(newLevelDef.level));
    } catch (_) {}
    const lvlInfo = calculateLevelInfo(totalXp);
    const perks: string[] = [
      `Unlocked Level ${newLevelDef.level} Scholar Rank: ${newLevelDef.title}`,
      'Leaderboard standing & profile rank upgraded',
    ];
    if (newLevelDef.level >= 5) perks.push('Eligible for Senior Academic & Challenge Milestones');

    const detail: LevelUpCelebrationPayload = {
      userId,
      previousLevel: prevLevel,
      newLevel: newLevelDef.level,
      levelTitle: newLevelDef.title,
      icon: newLevelDef.icon,
      color: newLevelDef.color,
      totalXp,
      xpToNext: lvlInfo.next ? lvlInfo.xpRequiredForNext : null,
      perks,
      timestamp: new Date().toISOString(),
    };
    window.dispatchEvent(new CustomEvent(LEVEL_UP_EVENT, { detail }));
  }
  return true;
}

export function dispatchRegularBadgesIfNew(userId: string, badges: BadgeDefinition[]): boolean {
  if (!userId || !Array.isArray(badges) || badges.length === 0) return false;
  const memSet = memorySeenBadges.get(userId) || new Set<string>();
  const seenSet = new Set<string>(memSet);

  if (typeof window !== 'undefined') {
    try {
      const badgesKey = getSeenBadgesKey(userId);
      const existingRaw = localStorage.getItem(badgesKey);
      const parsed: string[] = existingRaw ? JSON.parse(existingRaw) : [];
      parsed.forEach((id) => seenSet.add(id));
    } catch (_) {}
  }

  const toCelebrate: BadgeDefinition[] = [];
  for (const badge of badges) {
    if (!seenSet.has(badge.id)) {
      seenSet.add(badge.id);
      toCelebrate.push(badge);
    }
  }
  memorySeenBadges.set(userId, seenSet);

  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(getSeenBadgesKey(userId), JSON.stringify(Array.from(seenSet)));
      toCelebrate.forEach((badge) => {
        const detail: RegularBadgeUnlockPayload = {
          userId,
          badge,
          earnedAt: new Date().toISOString(),
        };
        window.dispatchEvent(new CustomEvent(REGULAR_BADGE_UNLOCKED_EVENT, { detail }));
      });
    } catch (_) {}
  }
  return toCelebrate.length > 0;
}

export async function fetchEngagementOverview(
  user: Partial<UserProfile> | null | undefined,
  effectiveRole?: string
): Promise<EngagementOverview | null> {
  const userId = user?.uid || (user as any)?.id;
  if (!userId) return null;
  const role = (effectiveRole || user?.role || 'student').toLowerCase();

  try {
    const headers = await buildAuthHeadersForUser({ ...user, role: role as any });
    const params = new URLSearchParams({ userId, role });
    const res = await fetch(`/api/engagement/overview?${params.toString()}`, { headers });
    if (!res.ok) return null;
    const data = await res.json().catch(() => null);
    if (data?.success && data.overview) {
      return data.overview as EngagementOverview;
    }
  } catch (_) {}
  return null;
}

export async function recordEngagementActivity(
  user: Partial<UserProfile> | null | undefined,
  effectiveRole: string,
  activityType:
    | 'flashcards'
    | 'quiz'
    | 'homework'
    | 'study_session'
    | 'attendance_mark'
    | 'grade_submission'
    | 'oversight_review'
    | 'admin_audit'
    | 'daily_checkin',
  count = 1,
  returnContext?: SmartReturnContext | null,
  eventId?: string
): Promise<{ success: boolean; streakIncremented?: boolean; streak?: any; missions?: any[]; error?: string }> {
  const userId = user?.uid || (user as any)?.id;
  if (!userId) return { success: false, error: 'Sign in required' };

  try {
    const headers = await buildAuthHeadersForUser({ ...user, role: (effectiveRole || user?.role || 'student') as any });
    const res = await fetch('/api/engagement/activity', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        userId,
        role: effectiveRole || user?.role || 'student',
        activityType,
        count,
        eventId,
        returnContext,
      }),
    });
    const data = await res.json().catch(() => null);
    if (res.ok && data?.success) {
      dispatchEngagementUpdate(userId);
      return data;
    }
    return { success: false, error: data?.error || `Activity save failed (${res.status})` };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Network error' };
  }
}

export async function recoverUserStreak(
  user: Partial<UserProfile> | null | undefined,
  activityType: string,
  verifiedCount?: number,
  effectiveRole?: string
): Promise<{
  success: boolean;
  restoredFrom?: number;
  newStreak?: number;
  xpRewarded?: number;
  error?: string;
}> {
  const userId = user?.uid || (user as any)?.id;
  if (!userId) return { success: false, error: 'Sign in required' };

  try {
    const role = effectiveRole || user?.role || 'student';
    const headers = await buildAuthHeadersForUser({ ...user, role: role as any });
    const res = await fetch('/api/engagement/streak/recover', {
      method: 'POST',
      headers,
      body: JSON.stringify({ userId, activityType, verifiedCount, role }),
    });
    const data = await res.json().catch(() => ({ success: false, error: 'Failed to process recovery' }));
    if (
      res.ok &&
      data?.success === true &&
      typeof data.restoredFrom === 'number' &&
      data.restoredFrom > 0 &&
      typeof data.newStreak === 'number' &&
      data.newStreak > 0
    ) {
      const todayKey = new Date().toISOString().split('T')[0];
      void awardServerActionXp(user, 'streak_recovery', `recovery_${userId}_${todayKey}`).then(() => {
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('studentos-gamification-updated'));
        }
      });
      dispatchEngagementUpdate(userId);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('studentos-gamification-updated'));
        window.dispatchEvent(
          new CustomEvent(STREAK_RECOVERED_EVENT, {
            detail: {
              userId,
              restoredFrom: data.restoredFrom,
              newStreak: data.newStreak,
              xpRewarded: data.xpRewarded || 35,
              activityType,
              role,
              timestamp: new Date().toISOString(),
            } as StreakRecoveryCelebrationPayload,
          })
        );
      }
      return data;
    }
    return { success: false, error: data?.error || 'Recovery eligibility check failed' };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Network error' };
  }
}

export async function claimEngagementMission(
  user: Partial<UserProfile> | null | undefined,
  effectiveRole: string,
  missionId: string
): Promise<{ success: boolean; xpAwarded?: number; error?: string }> {
  const userId = user?.uid || (user as any)?.id;
  if (!userId || !missionId) return { success: false, error: 'Missing mission or user ID' };

  try {
    const headers = await buildAuthHeadersForUser({ ...user, role: (effectiveRole || user?.role || 'student') as any });
    const res = await fetch('/api/engagement/missions/claim', {
      method: 'POST',
      headers,
      body: JSON.stringify({ userId, role: effectiveRole || user?.role || 'student', missionId }),
    });
    const data = await res.json().catch(() => ({ success: false, error: 'Claim failed' }));
    if (res.ok && data?.success) {
      const actionKey = data.actionKey || 'daily_mission_complete';
      const itemKey = `${missionId}:${data.periodKey || new Date().toISOString().split('T')[0]}`;
      void awardServerActionXp(user, actionKey, itemKey).then(() => {
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('studentos-gamification-updated'));
        }
      });
      dispatchEngagementUpdate(userId);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('studentos-gamification-updated'));
      }
      return data;
    }
    return { success: false, error: data?.error || 'Unable to claim mission reward' };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Network error' };
  }
}

export async function fetchEngagementPolicyConfig(): Promise<EngagementPolicyConfig | null> {
  try {
    const res = await fetch('/api/engagement/config');
    if (!res.ok) return null;
    const data = await res.json().catch(() => null);
    return data?.success && data.config ? (data.config as EngagementPolicyConfig) : null;
  } catch {
    return null;
  }
}

export async function updateEngagementPolicyConfig(
  user: Partial<UserProfile>,
  patch: Partial<EngagementPolicyConfig>
): Promise<{ success: boolean; config?: EngagementPolicyConfig; error?: string }> {
  try {
    const headers = await buildAuthHeadersForUser(user);
    const res = await fetch('/api/engagement/config', {
      method: 'POST',
      headers,
      body: JSON.stringify({ config: patch }),
    });
    const data = await res.json().catch(() => null);
    if (res.ok && data?.success) {
      dispatchEngagementUpdate();
      return { success: true, config: data.config };
    }
    return { success: false, error: data?.error || 'Failed to save policy configuration' };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Network error' };
  }
}

export async function fetchEngagementAuditLogs(
  user: Partial<UserProfile>
): Promise<Array<{
  id: string;
  actorUserId: string;
  actorEmail: string;
  actorRole: string;
  action: string;
  summary: string;
  createdAt: string;
}>> {
  try {
    const headers = await buildAuthHeadersForUser(user);
    const res = await fetch('/api/engagement/audit', { headers });
    if (!res.ok) return [];
    const data = await res.json().catch(() => null);
    return data?.success && Array.isArray(data.logs) ? data.logs : [];
  } catch {
    return [];
  }
}

export function useEngagementOverview(
  currentUser: UserProfile | null | undefined,
  effectiveRole?: string
) {
  const userId = currentUser?.uid || '';
  const role = (effectiveRole || currentUser?.role || 'student').toLowerCase();
  const [overview, setOverview] = useState<EngagementOverview | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const requestCounterRef = useRef(0);

  const refresh = useCallback(async () => {
    if (!userId) {
      setOverview(null);
      setLoading(false);
      return;
    }
    const reqId = ++requestCounterRef.current;
    setLoading(true);
    const result = await fetchEngagementOverview(currentUser, role);
    if (reqId !== requestCounterRef.current) return;
    if (result) {
      setOverview(result);
    }
    setLoading(false);
  }, [userId, role]);

  useEffect(() => {
    // Clear stale previous account state immediately on account/role switch
    setOverview(null);
    if (!userId) return;
    refresh();

    const onUpdate = () => {
      refresh();
    };
    window.addEventListener(ENGAGEMENT_UPDATED_EVENT, onUpdate);
    window.addEventListener('studentos-gamification-updated', onUpdate);
    window.addEventListener('studentos-profile-updated', onUpdate);
    return () => {
      window.removeEventListener(ENGAGEMENT_UPDATED_EVENT, onUpdate);
      window.removeEventListener('studentos-gamification-updated', onUpdate);
      window.removeEventListener('studentos-profile-updated', onUpdate);
    };
  }, [userId, role, refresh]);

  return { overview, loading, refresh };
}
