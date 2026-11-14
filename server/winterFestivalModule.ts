/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Veylentra Winter Festival & Hardened Leaderboard Backend Module
 * Handles:
 * - Authoritative Nightly Santa Gift claiming (7:00 PM – 9:00 PM IST) + atomic recovery
 * - Authoritative Winter Spin Wheel with strict 2-hour cooldown & odds transparency
 * - Verified Winter Tasks & Winter Collectible Badges (separate from permanent badges)
 * - Separated Student vs Faculty XP Leaderboards (Weekly / Monthly / All-Time)
 * - Hardened server-validated XP action ledger with anti-tamper & deduplication
 */

import express from 'express';
import crypto from 'crypto';
import {
  ALLOWED_GAMIFICATION_ACTION_XP,
  MAX_DAILY_WINTER_AI_BONUS,
  MAX_STREAK_SHIELDS,
  SANTA_REWARD_TIERS,
  SPIN_WHEEL_COOLDOWN_MS,
  SPIN_WHEEL_SEGMENTS,
  WINTER_FESTIVAL_BADGES,
  WINTER_FESTIVAL_TASKS,
  WINTER_PROFILE_FRAMES,
  WINTER_QUIZ_QUESTIONS,
  getSantaWindowStatus,
  rollSantaRewardTier,
  rollSpinWheelSegment,
} from './rewardEngine';
import { getFeatureRecord, isFeatureAccessibleForActor } from './featureManagementModule';

export interface WinterModuleDeps {
  getSupabaseServerConfig: () => { url: string; key: string };
  getVerifiedUserFromRequest: (req: express.Request) => Promise<{
    id: string;
    name: string;
    email?: string;
    role: string;
    grade?: string;
    section?: string;
    isVerifiedJwt: boolean;
  } | null>;
  requireFeatureAccess: (featureKey: string) => express.RequestHandler;
  broadcastToAllWs: (payload: any) => void;
}

export interface XpLedgerEntry {
  id: string;
  userId: string;
  userName: string;
  userRole: string;
  grade: string;
  section: string;
  house?: string;
  avatar?: string;
  sourceType: 'academic' | 'winter_task' | 'santa_gift' | 'spin_wheel';
  actionKey: string;
  xpDelta: number;
  label: string;
  createdAt: string;
}

export interface UserWinterState {
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
  rewardHistory: Array<{
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
  }>;
  updatedAt: string;
}

const SCHOLAR_LEVELS = [
  { level: 1, title: 'Rookie Scholar', minXp: 0 },
  { level: 2, title: 'Curious Learner', minXp: 100 },
  { level: 3, title: 'Active Student', minXp: 250 },
  { level: 4, title: 'Focused Scholar', minXp: 450 },
  { level: 5, title: 'Knowledge Builder', minXp: 700 },
  { level: 6, title: 'Academic Achiever', minXp: 1000 },
  { level: 7, title: 'Top Performer', minXp: 1400 },
  { level: 8, title: 'Honor Student', minXp: 1900 },
  { level: 9, title: 'Master Scholar', minXp: 2500 },
  { level: 10, title: 'Campus Legend', minXp: 3200 },
];

function computeLevelFromXp(xp: number): { level: number; levelTitle: string; nextLevelXp: number | null } {
  let current = SCHOLAR_LEVELS[0];
  let next: { level: number; title: string; minXp: number } | null = SCHOLAR_LEVELS[1] || null;
  for (let i = 0; i < SCHOLAR_LEVELS.length; i++) {
    if (xp >= SCHOLAR_LEVELS[i].minXp) {
      current = SCHOLAR_LEVELS[i];
      next = SCHOLAR_LEVELS[i + 1] || null;
    }
  }
  return {
    level: current.level,
    levelTitle: current.title,
    nextLevelXp: next ? next.minXp : null,
  };
}

const memoryWinterStates = new Map<string, UserWinterState>();
const memoryXpLedger: XpLedgerEntry[] = [];
const memoryUserTotalXp = new Map<
  string,
  {
    userId: string;
    name: string;
    role: string;
    grade: string;
    section: string;
    house: string;
    avatar: string;
    xp: number;
    currentStreak: number;
    earnedBadges: Record<string, string>;
    updatedAt: string;
  }
>();

const inFlightClaimLocks = new Set<string>();

function getLocalDayKey(nowMs: number = Date.now(), timeZone: string = 'Asia/Kolkata'): string {
  return getSantaWindowStatus(nowMs, timeZone).eventNightKey;
}

function getDefaultWinterState(user: { id: string; name: string; role: string }): UserWinterState {
  return {
    userId: user.id,
    userName: user.name || 'Member',
    userRole: user.role || 'student',
    cookiesCount: 0,
    streakShields: 0,
    unlockedFrames: [],
    equippedFrame: null,
    spinNextEligibleAt: null,
    lastSpinAt: null,
    lastWheelNotifiedCycle: null,
    aiBonusDate: getLocalDayKey(),
    aiBonusCreditsToday: 0,
    quizCompleted: false,
    claimedTaskIds: [],
    earnedWinterBadges: {},
    santaClaimedNights: {},
    rewardHistory: [],
    updatedAt: new Date().toISOString(),
  };
}

function normalizeWinterBonusForToday(state: UserWinterState, dayKey: string): UserWinterState {
  if (state.aiBonusDate !== dayKey) {
    return {
      ...state,
      aiBonusDate: dayKey,
      aiBonusCreditsToday: 0,
    };
  }
  return state;
}

export function getUserWinterAiBonusCredits(userId: string, nowMs: number = Date.now()): number {
  const st = memoryWinterStates.get(userId);
  if (!st) return 0;
  const todayKey = getLocalDayKey(nowMs);
  if (st.aiBonusDate !== todayKey) return 0;
  return Math.min(MAX_DAILY_WINTER_AI_BONUS, Math.max(0, st.aiBonusCreditsToday || 0));
}

function evaluateSecretWinterBadges(state: UserWinterState, nowIso: string) {
  if (
    state.cookiesCount >= 15 &&
    state.claimedTaskIds.length >= 3 &&
    !state.earnedWinterBadges['north_star_secret']
  ) {
    state.earnedWinterBadges['north_star_secret'] = nowIso;
  }
}

async function loadUserWinterState(
  getSupabaseServerConfig: WinterModuleDeps['getSupabaseServerConfig'],
  user: { id: string; name: string; role: string }
): Promise<UserWinterState> {
  const cached = memoryWinterStates.get(user.id);
  if (process.env.NODE_ENV === 'test') {
    if (cached) return cached;
    const fresh = getDefaultWinterState(user);
    memoryWinterStates.set(user.id, fresh);
    return fresh;
  }

  const { url, key } = getSupabaseServerConfig();
  if (url && key) {
    try {
      const docId = `winter_state_${user.id}`;
      const res = await fetch(
        `${url}/rest/v1/global_data?id=eq.${encodeURIComponent(docId)}&select=*`,
        { headers: { apikey: key, Authorization: `Bearer ${key}` } }
      );
      if (res.ok) {
        const rows = await res.json();
        const remote = rows?.[0]?.data;
        if (remote && typeof remote === 'object') {
          const merged: UserWinterState = {
            ...getDefaultWinterState(user),
            ...remote,
            userId: user.id,
            userName: user.name || remote.userName || 'Member',
            userRole: user.role || remote.userRole || 'student',
          };
          memoryWinterStates.set(user.id, merged);
          return merged;
        }
      }
    } catch (_) {}
  }

  if (cached) return cached;
  const created = getDefaultWinterState(user);
  memoryWinterStates.set(user.id, created);
  return created;
}

async function saveUserWinterState(
  getSupabaseServerConfig: WinterModuleDeps['getSupabaseServerConfig'],
  state: UserWinterState
): Promise<void> {
  state.updatedAt = new Date().toISOString();
  evaluateSecretWinterBadges(state, state.updatedAt);
  memoryWinterStates.set(state.userId, state);

  if (process.env.NODE_ENV === 'test') return;
  const { url, key } = getSupabaseServerConfig();
  if (!url || !key) return;

  try {
    await fetch(`${url}/rest/v1/global_data?on_conflict=id`, {
      method: 'POST',
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates',
      },
      body: JSON.stringify({
        id: `winter_state_${state.userId}`,
        data: state,
        updated_at: state.updatedAt,
      }),
    }).catch(() => {});

    await fetch(`${url}/rest/v1/winter_user_profiles?on_conflict=user_id`, {
      method: 'POST',
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates',
      },
      body: JSON.stringify({
        user_id: state.userId,
        user_name: state.userName,
        user_role: state.userRole,
        cookies_count: state.cookiesCount,
        streak_shields: state.streakShields,
        unlocked_frames: state.unlockedFrames,
        equipped_frame: state.equippedFrame,
        spin_next_eligible_at: state.spinNextEligibleAt,
        last_spin_at: state.lastSpinAt,
        last_wheel_notified_cycle: state.lastWheelNotifiedCycle,
        ai_bonus_date: state.aiBonusDate,
        ai_bonus_credits_today: state.aiBonusCreditsToday,
        quiz_completed: state.quizCompleted,
        updated_at: state.updatedAt,
      }),
    }).catch(() => {});
  } catch (_) {}
}

async function appendXpLedgerEntry(
  getSupabaseServerConfig: WinterModuleDeps['getSupabaseServerConfig'],
  entry: XpLedgerEntry
): Promise<{ accepted: boolean; deduplicated: boolean; totalXp: number; level: number; levelTitle: string }> {
  const alreadyExists = memoryXpLedger.some(
    x => x.userId === entry.userId && x.actionKey === entry.actionKey
  );
  if (alreadyExists) {
    const existingTotal = memoryUserTotalXp.get(entry.userId)?.xp || 0;
    const lvl = computeLevelFromXp(existingTotal);
    return { accepted: false, deduplicated: true, totalXp: existingTotal, ...lvl };
  }

  memoryXpLedger.unshift(entry);
  if (memoryXpLedger.length > 5000) memoryXpLedger.pop();

  const prev = memoryUserTotalXp.get(entry.userId);
  const newTotalXp = Math.max(0, (prev?.xp || 0) + entry.xpDelta);
  const lvl = computeLevelFromXp(newTotalXp);

  memoryUserTotalXp.set(entry.userId, {
    userId: entry.userId,
    name: entry.userName,
    role: entry.userRole,
    grade: entry.grade,
    section: entry.section,
    house: entry.house || prev?.house || '',
    avatar: entry.avatar || prev?.avatar || '',
    xp: newTotalXp,
    currentStreak: prev?.currentStreak || 1,
    earnedBadges: prev?.earnedBadges || {},
    updatedAt: entry.createdAt,
  });

  if (process.env.NODE_ENV !== 'test') {
    const { url, key } = getSupabaseServerConfig();
    if (url && key) {
      fetch(`${url}/rest/v1/gamification_xp_ledger`, {
        method: 'POST',
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: entry.id,
          user_id: entry.userId,
          user_name: entry.userName,
          user_role: entry.userRole,
          grade: entry.grade,
          section: entry.section,
          house: entry.house || '',
          avatar: entry.avatar || '',
          source_type: entry.sourceType,
          action_key: entry.actionKey,
          xp_delta: entry.xpDelta,
          label: entry.label,
          created_at: entry.createdAt,
        }),
      }).catch(() => {});

      fetch(`${url}/rest/v1/global_data?on_conflict=id`, {
        method: 'POST',
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json',
          Prefer: 'resolution=merge-duplicates',
        },
        body: JSON.stringify({
          id: '__veylentra_xp_ledger_recent__',
          data: memoryXpLedger.slice(0, 600),
          updated_at: entry.createdAt,
        }),
      }).catch(() => {});

      fetch(`${url}/rest/v1/user_profiles?id=eq.${encodeURIComponent(entry.userId)}`, {
        method: 'PATCH',
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          points: newTotalXp,
          updated_at: Date.now(),
        }),
      }).catch(() => {});
    }
  }

  return { accepted: true, deduplicated: false, totalXp: newTotalXp, ...lvl };
}

function isStudentRole(role?: string | null): boolean {
  const r = String(role || 'student').toLowerCase().trim();
  return r === 'student';
}

function isFacultyLeaderboardRole(role?: string | null): boolean {
  const r = String(role || '').toLowerCase().trim();
  return ['teacher', 'coordinator', 'hod'].includes(r);
}

export function buildSeparatedLeaderboard(params: {
  entries: XpLedgerEntry[];
  allTimeUsers: Array<{
    userId: string;
    name: string;
    role: string;
    grade?: string;
    section?: string;
    house?: string;
    avatar?: string;
    xp: number;
    currentStreak?: number;
    winterCookies?: number;
    equippedFrame?: string | null;
    badgesCount?: number;
  }>;
  type: 'student' | 'faculty';
  period: 'weekly' | 'monthly' | 'all_time';
  nowMs?: number;
}) {
  const nowMs = params.nowMs ?? Date.now();
  const cutoffMs =
    params.period === 'weekly'
      ? nowMs - 7 * 24 * 60 * 60 * 1000
      : params.period === 'monthly'
      ? nowMs - 30 * 24 * 60 * 60 * 1000
      : 0;

  const roleMatches = (role?: string | null) =>
    params.type === 'student' ? isStudentRole(role) : isFacultyLeaderboardRole(role);

  const userProfileMap = new Map<string, (typeof params.allTimeUsers)[number]>();
  params.allTimeUsers.forEach(u => {
    if (roleMatches(u.role)) {
      userProfileMap.set(u.userId, u);
    }
  });

  if (params.period === 'all_time') {
    const rows = Array.from(userProfileMap.values()).map(u => {
      const lvl = computeLevelFromXp(u.xp || 0);
      return {
        userId: u.userId,
        name: u.name || 'Member',
        role: u.role,
        grade: params.type === 'student' ? u.grade || '' : undefined,
        section: params.type === 'student' ? u.section || '' : undefined,
        house: u.house || '',
        avatar: u.avatar || '',
        xp: Math.max(0, Math.round(u.xp || 0)),
        level: lvl.level,
        levelTitle: lvl.levelTitle,
        nextLevelXp: lvl.nextLevelXp,
        currentStreak: u.currentStreak || 0,
        winterCookies: u.winterCookies || 0,
        equippedFrame: u.equippedFrame || null,
        badgesCount: u.badgesCount || 0,
      };
    });
    rows.sort((a, b) => b.xp - a.xp || a.name.localeCompare(b.name));
    return rows.map((row, idx) => ({ ...row, rank: idx + 1 }));
  }

  const periodTotals = new Map<string, { xp: number; entry: XpLedgerEntry }>();
  for (const item of params.entries) {
    if (!roleMatches(item.userRole)) continue;
    const ts = new Date(item.createdAt).getTime();
    if (!Number.isFinite(ts) || ts < cutoffMs || ts > nowMs + 60_000) continue;
    const prev = periodTotals.get(item.userId);
    if (prev) {
      prev.xp += item.xpDelta;
    } else {
      periodTotals.set(item.userId, { xp: item.xpDelta, entry: item });
    }
  }

  const rows = Array.from(periodTotals.entries()).map(([userId, agg]) => {
    const profile = userProfileMap.get(userId);
    const totalAllTimeXp = profile?.xp ?? agg.xp;
    const lvl = computeLevelFromXp(totalAllTimeXp);
    return {
      userId,
      name: profile?.name || agg.entry.userName || 'Member',
      role: profile?.role || agg.entry.userRole,
      grade: params.type === 'student' ? profile?.grade || agg.entry.grade || '' : undefined,
      section: params.type === 'student' ? profile?.section || agg.entry.section || '' : undefined,
      house: profile?.house || agg.entry.house || '',
      avatar: profile?.avatar || agg.entry.avatar || '',
      xp: Math.max(0, Math.round(agg.xp)),
      allTimeXp: Math.max(0, Math.round(totalAllTimeXp)),
      level: lvl.level,
      levelTitle: lvl.levelTitle,
      nextLevelXp: lvl.nextLevelXp,
      currentStreak: profile?.currentStreak || 0,
      winterCookies: profile?.winterCookies || 0,
      equippedFrame: profile?.equippedFrame || null,
      badgesCount: profile?.badgesCount || 0,
    };
  });

  rows.sort((a, b) => b.xp - a.xp || a.name.localeCompare(b.name));
  return rows.map((row, idx) => ({ ...row, rank: idx + 1 }));
}

export async function executeSantaGiftClaim(params: {
  user: { id: string; name: string; role: string; grade?: string; section?: string };
  idempotencyKey: string;
  nowMs?: number;
  getSupabaseServerConfig: WinterModuleDeps['getSupabaseServerConfig'];
}): Promise<{
  statusCode: number;
  body: Record<string, any>;
}> {
  const nowMs = params.nowMs ?? Date.now();
  const santaFeature = getFeatureRecord('winter_santa_gifts');
  const tz = String(santaFeature?.config?.timeZone || 'Asia/Kolkata');
  const startH = Number(santaFeature?.config?.windowStartHour ?? 19);
  const endH = Number(santaFeature?.config?.windowEndHour ?? 21);

  const windowStatus = getSantaWindowStatus(nowMs, tz, startH, endH);
  if (!windowStatus.isOpen) {
    return {
      statusCode: 403,
      body: {
        success: false,
        code: 'OUTSIDE_SANTA_WINDOW',
        error: `Nightly Santa Gift is only open between ${windowStatus.windowLabel} (${windowStatus.timeZone}).`,
        windowStatus,
      },
    };
  }

  const lockKey = `santa:${params.user.id}:${windowStatus.eventNightKey}`;
  if (inFlightClaimLocks.has(lockKey)) {
    return {
      statusCode: 409,
      body: { success: false, error: 'A Santa gift claim is already in progress. Please wait.' },
    };
  }

  inFlightClaimLocks.add(lockKey);
  try {
    const state = await loadUserWinterState(params.getSupabaseServerConfig, params.user);
    const idemp = String(params.idempotencyKey || `santa_${windowStatus.eventNightKey}`).trim();

    const existingByIdemp = state.rewardHistory.find(
      r => r.featureType === 'santa_gift' && r.idempotencyKey === idemp
    );
    if (existingByIdemp) {
      if (existingByIdemp.status === 'pending_apply') {
        existingByIdemp.status = 'recovered';
        existingByIdemp.appliedAt = new Date(nowMs).toISOString();
        await saveUserWinterState(params.getSupabaseServerConfig, state);
      }
      return {
        statusCode: 200,
        body: {
          success: true,
          alreadyClaimed: true,
          recovered: existingByIdemp.status === 'recovered',
          reward: existingByIdemp,
          windowStatus,
          winterState: state,
        },
      };
    }

    if (state.santaClaimedNights[windowStatus.eventNightKey]) {
      return {
        statusCode: 409,
        body: {
          success: false,
          code: 'ALREADY_CLAIMED_TONIGHT',
          error: 'You have already unwrapped tonight’s Santa Gift. Return tomorrow at 7:00 PM!',
          windowStatus,
        },
      };
    }

    const tier = rollSantaRewardTier();
    const rewardId = `santa_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const appliedAtIso = new Date(nowMs).toISOString();

    const todayKey = windowStatus.eventNightKey;
    const normalizedState = normalizeWinterBonusForToday(state, todayKey);
    const availableBonusRoom = Math.max(0, MAX_DAILY_WINTER_AI_BONUS - normalizedState.aiBonusCreditsToday);
    const grantedAiBonus = Math.min(availableBonusRoom, tier.aiBonusQueries);

    const record = {
      id: rewardId,
      featureType: 'santa_gift' as const,
      idempotencyKey: idemp,
      eventNightKey: windowStatus.eventNightKey,
      status: 'pending_apply' as 'pending_apply' | 'applied' | 'recovered',
      rarity: tier.rarity,
      label: tier.label,
      xpBonus: tier.xpBonus,
      cookiesBonus: tier.cookiesBonus,
      aiBonusQueries: grantedAiBonus,
      streakShield: tier.streakShield,
      badgeId: tier.badgeId,
      frameId: tier.frameId,
      createdAt: appliedAtIso,
      appliedAt: appliedAtIso,
    };

    normalizedState.cookiesCount += tier.cookiesBonus;
    if (tier.streakShield) {
      normalizedState.streakShields = Math.min(MAX_STREAK_SHIELDS, normalizedState.streakShields + 1);
    }
    if (grantedAiBonus > 0) {
      normalizedState.aiBonusCreditsToday = Math.min(
        MAX_DAILY_WINTER_AI_BONUS,
        normalizedState.aiBonusCreditsToday + grantedAiBonus
      );
    }
    if (tier.badgeId && !normalizedState.earnedWinterBadges[tier.badgeId]) {
      normalizedState.earnedWinterBadges[tier.badgeId] = appliedAtIso;
    }
    if (tier.frameId && !normalizedState.unlockedFrames.includes(tier.frameId)) {
      normalizedState.unlockedFrames.push(tier.frameId);
    }
    normalizedState.santaClaimedNights[windowStatus.eventNightKey] = rewardId;

    record.status = 'applied';
    normalizedState.rewardHistory = [record, ...normalizedState.rewardHistory].slice(0, 60);

    await saveUserWinterState(params.getSupabaseServerConfig, normalizedState);

    const xpRes = await appendXpLedgerEntry(params.getSupabaseServerConfig, {
      id: `xp_${rewardId}`,
      userId: params.user.id,
      userName: params.user.name,
      userRole: params.user.role,
      grade: params.user.grade || '',
      section: params.user.section || '',
      sourceType: 'santa_gift',
      actionKey: `santa_gift:${windowStatus.eventNightKey}`,
      xpDelta: tier.xpBonus,
      label: `Santa Gift (${tier.label})`,
      createdAt: appliedAtIso,
    });

    return {
      statusCode: 200,
      body: {
        success: true,
        alreadyClaimed: false,
        reward: record,
        tier,
        xpSummary: xpRes,
        windowStatus,
        winterState: normalizedState,
      },
    };
  } finally {
    inFlightClaimLocks.delete(lockKey);
  }
}

export async function executeSpinWheel(params: {
  user: { id: string; name: string; role: string; grade?: string; section?: string };
  idempotencyKey?: string;
  nowMs?: number;
  getSupabaseServerConfig: WinterModuleDeps['getSupabaseServerConfig'];
}): Promise<{
  statusCode: number;
  body: Record<string, any>;
}> {
  const nowMs = params.nowMs ?? Date.now();
  const feature = getFeatureRecord('winter_spin_wheel');
  const cooldownMs = Number(feature?.config?.cooldownMs ?? SPIN_WHEEL_COOLDOWN_MS);
  const lockKey = `spin:${params.user.id}`;

  if (inFlightClaimLocks.has(lockKey)) {
    return {
      statusCode: 409,
      body: { success: false, error: 'Spin already in progress. Please wait.' },
    };
  }

  inFlightClaimLocks.add(lockKey);
  try {
    const state = await loadUserWinterState(params.getSupabaseServerConfig, params.user);
    const idemp = String(params.idempotencyKey || `spin_${Math.floor(nowMs / 1000)}`).trim();

    const existing = state.rewardHistory.find(
      r => r.featureType === 'spin_wheel' && r.idempotencyKey === idemp
    );
    if (existing) {
      const nextMs = state.spinNextEligibleAt ? new Date(state.spinNextEligibleAt).getTime() : 0;
      const remMs = Math.max(0, nextMs - nowMs);
      return {
        statusCode: 200,
        body: {
          success: true,
          idempotentHit: true,
          segmentIndex: existing.segmentIndex ?? 0,
          reward: existing,
          nextEligibleAt: state.spinNextEligibleAt,
          remainingMs: remMs,
          cooldownMs,
          winterState: state,
        },
      };
    }

    const nextEligibleMs = state.spinNextEligibleAt ? new Date(state.spinNextEligibleAt).getTime() : 0;
    if (nextEligibleMs > nowMs) {
      const remainingMs = nextEligibleMs - nowMs;
      return {
        statusCode: 429,
        body: {
          success: false,
          code: 'SPIN_ON_COOLDOWN',
          error: 'Winter Spin Wheel is cooling down. Try again when the 2-hour timer resets.',
          remainingMs,
          nextEligibleAt: state.spinNextEligibleAt,
          cooldownMs,
        },
      };
    }

    const segment = rollSpinWheelSegment();
    const rewardId = `spin_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const nowIso = new Date(nowMs).toISOString();
    const nextEligibleAt = new Date(nowMs + cooldownMs).toISOString();

    const todayKey = getLocalDayKey(nowMs);
    const normalizedState = normalizeWinterBonusForToday(state, todayKey);
    const availableBonusRoom = Math.max(0, MAX_DAILY_WINTER_AI_BONUS - normalizedState.aiBonusCreditsToday);
    const grantedAiBonus = Math.min(availableBonusRoom, segment.aiBonusQueries);

    const record = {
      id: rewardId,
      featureType: 'spin_wheel' as const,
      idempotencyKey: idemp,
      status: 'applied' as const,
      rarity: segment.rarity,
      segmentIndex: segment.index,
      label: segment.label,
      xpBonus: segment.xpBonus,
      cookiesBonus: segment.cookiesBonus,
      aiBonusQueries: grantedAiBonus,
      streakShield: segment.streakShield,
      badgeId: segment.badgeId,
      frameId: segment.frameId,
      createdAt: nowIso,
      appliedAt: nowIso,
    };

    normalizedState.cookiesCount += segment.cookiesBonus;
    if (segment.streakShield) {
      normalizedState.streakShields = Math.min(MAX_STREAK_SHIELDS, normalizedState.streakShields + 1);
    }
    if (grantedAiBonus > 0) {
      normalizedState.aiBonusCreditsToday = Math.min(
        MAX_DAILY_WINTER_AI_BONUS,
        normalizedState.aiBonusCreditsToday + grantedAiBonus
      );
    }
    if (segment.badgeId && !normalizedState.earnedWinterBadges[segment.badgeId]) {
      normalizedState.earnedWinterBadges[segment.badgeId] = nowIso;
    }
    if (segment.frameId && !normalizedState.unlockedFrames.includes(segment.frameId)) {
      normalizedState.unlockedFrames.push(segment.frameId);
    }
    normalizedState.lastSpinAt = nowIso;
    normalizedState.spinNextEligibleAt = nextEligibleAt;
    normalizedState.rewardHistory = [record, ...normalizedState.rewardHistory].slice(0, 60);

    await saveUserWinterState(params.getSupabaseServerConfig, normalizedState);

    const xpRes = await appendXpLedgerEntry(params.getSupabaseServerConfig, {
      id: `xp_${rewardId}`,
      userId: params.user.id,
      userName: params.user.name,
      userRole: params.user.role,
      grade: params.user.grade || '',
      section: params.user.section || '',
      sourceType: 'spin_wheel',
      actionKey: `spin_wheel:${rewardId}`,
      xpDelta: segment.xpBonus,
      label: `Winter Wheel: ${segment.label}`,
      createdAt: nowIso,
    });

    return {
      statusCode: 200,
      body: {
        success: true,
        segmentIndex: segment.index,
        segment,
        reward: record,
        xpSummary: xpRes,
        nextEligibleAt,
        cooldownMs,
        remainingMs: cooldownMs,
        winterState: normalizedState,
      },
    };
  } finally {
    inFlightClaimLocks.delete(lockKey);
  }
}

export function resetWinterAndLeaderboardMemoryForTests() {
  if (process.env.NODE_ENV !== 'test') return;
  memoryWinterStates.clear();
  memoryXpLedger.length = 0;
  memoryUserTotalXp.clear();
  inFlightClaimLocks.clear();
}

export function seedXpEntryForTests(entry: XpLedgerEntry, totalXpOverride?: number) {
  if (process.env.NODE_ENV !== 'test') return;
  memoryXpLedger.push(entry);
  const existing = memoryUserTotalXp.get(entry.userId);
  const nextXp = typeof totalXpOverride === 'number' ? totalXpOverride : (existing?.xp || 0) + entry.xpDelta;
  memoryUserTotalXp.set(entry.userId, {
    userId: entry.userId,
    name: entry.userName,
    role: entry.userRole,
    grade: entry.grade,
    section: entry.section,
    house: entry.house || 'Emerald',
    avatar: entry.avatar || '',
    xp: nextXp,
    currentStreak: existing?.currentStreak || 1,
    earnedBadges: existing?.earnedBadges || {},
    updatedAt: entry.createdAt,
  });
}

export function registerWinterFestivalAndLeaderboardRoutes(app: express.Express, deps: WinterModuleDeps) {
  const { getSupabaseServerConfig, getVerifiedUserFromRequest, requireFeatureAccess, broadcastToAllWs } = deps;

  app.get('/api/winter/status', async (req, res) => {
    const actor = await getVerifiedUserFromRequest(req);
    if (!actor) {
      return res.status(401).json({ success: false, error: 'Authentication required.' });
    }

    const role = actor.role;
    const canSeeAnyWinter =
      isFeatureAccessibleForActor('winter_festival_tasks', role, true) ||
      isFeatureAccessibleForActor('winter_santa_gifts', role, true) ||
      isFeatureAccessibleForActor('winter_spin_wheel', role, true) ||
      isFeatureAccessibleForActor('winter_badges', role, true) ||
      isFeatureAccessibleForActor('winter_theme', role, true);

    if (!canSeeAnyWinter) {
      return res.status(403).json({
        success: false,
        code: 'FEATURE_DISABLED',
        error: 'Winter Festival features are currently disabled.',
      });
    }

    const state = await loadUserWinterState(getSupabaseServerConfig, actor);
    const santaFeature = getFeatureRecord('winter_santa_gifts');
    const tz = String(santaFeature?.config?.timeZone || 'Asia/Kolkata');
    const startH = Number(santaFeature?.config?.windowStartHour ?? 19);
    const endH = Number(santaFeature?.config?.windowEndHour ?? 21);
    const santaWindow = getSantaWindowStatus(Date.now(), tz, startH, endH);

    const nowMs = Date.now();
    const spinNextMs = state.spinNextEligibleAt ? new Date(state.spinNextEligibleAt).getTime() : 0;
    const spinRemainingMs = spinNextMs > nowMs ? spinNextMs - nowMs : 0;

    return res.json({
      success: true,
      winterState: state,
      santa: {
        enabled: isFeatureAccessibleForActor('winter_santa_gifts', role, true),
        window: santaWindow,
        alreadyClaimedTonight: Boolean(state.santaClaimedNights[santaWindow.eventNightKey]),
        odds: SANTA_REWARD_TIERS.map(t => ({
          rarity: t.rarity,
          label: t.label,
          oddsPercent: t.oddsPercent,
          description: t.description,
        })),
      },
      spinWheel: {
        enabled: isFeatureAccessibleForActor('winter_spin_wheel', role, true),
        canSpin: spinRemainingMs === 0,
        remainingMs: spinRemainingMs,
        nextEligibleAt: state.spinNextEligibleAt,
        cooldownMs: Number(getFeatureRecord('winter_spin_wheel')?.config?.cooldownMs ?? SPIN_WHEEL_COOLDOWN_MS),
        lastWheelNotifiedCycle: state.lastWheelNotifiedCycle,
        segments: SPIN_WHEEL_SEGMENTS.map(s => ({
          index: s.index,
          id: s.id,
          label: s.label,
          shortLabel: s.shortLabel,
          color: s.color,
          textColor: s.textColor,
          oddsPercent: s.oddsPercent,
          rarity: s.rarity,
        })),
      },
      tasks: WINTER_FESTIVAL_TASKS.map(t => ({
        ...t,
        claimed: state.claimedTaskIds.includes(t.id),
      })),
      badges: WINTER_FESTIVAL_BADGES.map(b => {
        const unlockedAt = state.earnedWinterBadges[b.id] || null;
        if (b.isHiddenUntilUnlocked && !unlockedAt && String(role).toLowerCase() !== 'super_admin') {
          return {
            id: b.id,
            name: 'Mystery Winter Collectible',
            description: 'Keep participating in Winter Festival events to reveal this secret collectible.',
            unlockRequirement: 'Hidden Secret Requirement',
            rarity: b.rarity,
            isHiddenUntilUnlocked: true,
            unlockedAt: null,
          };
        }
        return {
          ...b,
          unlockedAt,
        };
      }),
      frames: WINTER_PROFILE_FRAMES,
      quizQuestions: WINTER_QUIZ_QUESTIONS.map(q => ({
        id: q.id,
        prompt: q.prompt,
        options: q.options,
      })),
      serverTime: new Date().toISOString(),
    });
  });

  app.post('/api/winter/quiz/submit', requireFeatureAccess('winter_festival_tasks'), async (req, res) => {
    const actor = await getVerifiedUserFromRequest(req);
    if (!actor) return res.status(401).json({ success: false, error: 'Authentication required.' });

    const { answers } = req.body || {};
    if (!answers || typeof answers !== 'object') {
      return res.status(400).json({ success: false, error: 'Quiz answers object is required.' });
    }

    let correctCount = 0;
    const results = WINTER_QUIZ_QUESTIONS.map(q => {
      const selected = Number(answers[q.id]);
      const isCorrect = selected === q.correctIndex;
      if (isCorrect) correctCount++;
      return {
        id: q.id,
        isCorrect,
        explanation: q.explanation,
      };
    });

    const passed = correctCount >= 2;
    const state = await loadUserWinterState(getSupabaseServerConfig, actor);
    if (passed && !state.quizCompleted) {
      state.quizCompleted = true;
      await saveUserWinterState(getSupabaseServerConfig, state);
    }

    return res.json({
      success: true,
      passed,
      correctCount,
      total: WINTER_QUIZ_QUESTIONS.length,
      results,
      winterState: state,
    });
  });

  app.post('/api/winter/tasks/:taskId/claim', requireFeatureAccess('winter_festival_tasks'), async (req, res) => {
    const actor = await getVerifiedUserFromRequest(req);
    if (!actor) return res.status(401).json({ success: false, error: 'Authentication required.' });

    const taskId = String(req.params.taskId || '').trim();
    const taskDef = WINTER_FESTIVAL_TASKS.find(t => t.id === taskId);
    if (!taskDef) {
      return res.status(404).json({ success: false, error: 'Winter task not found.' });
    }

    const state = await loadUserWinterState(getSupabaseServerConfig, actor);
    if (state.claimedTaskIds.includes(taskId)) {
      return res.status(409).json({
        success: false,
        code: 'TASK_ALREADY_CLAIMED',
        error: 'You have already claimed rewards for this seasonal task.',
      });
    }

    if (taskDef.verificationMode === 'winter_quiz' && !state.quizCompleted) {
      return res.status(400).json({
        success: false,
        error: 'Complete the 3-question Winter Knowledge Check (at least 2/3 correct) before claiming.',
      });
    }

    if (taskDef.verificationMode === 'academic_action') {
      const hasAcademicXp = memoryXpLedger.some(
        x => x.userId === actor.id && x.sourceType === 'academic'
      );
      const userTotal = memoryUserTotalXp.get(actor.id)?.xp || 0;
      if (!hasAcademicXp && userTotal <= 0) {
        return res.status(400).json({
          success: false,
          error: 'Log at least one real academic study action (note, flashcard, assignment, or check-in) first.',
        });
      }
    }

    if (taskDef.verificationMode === 'study_check' && state.cookiesCount < 5) {
      return res.status(400).json({
        success: false,
        error: `Collect at least 5 Winter Cookies first (currently ${state.cookiesCount}/5).`,
      });
    }

    if (taskDef.verificationMode === 'spin_or_santa') {
      const participated = state.rewardHistory.some(
        r => r.featureType === 'spin_wheel' || r.featureType === 'santa_gift'
      );
      if (!participated) {
        return res.status(400).json({
          success: false,
          error: 'Spin the Winter Wheel or claim a Nightly Santa Gift first.',
        });
      }
    }

    const nowIso = new Date().toISOString();
    state.claimedTaskIds.push(taskId);
    state.cookiesCount += taskDef.cookiesReward;
    if (taskDef.badgeId && isFeatureAccessibleForActor('winter_badges', actor.role, true)) {
      if (!state.earnedWinterBadges[taskDef.badgeId]) {
        state.earnedWinterBadges[taskDef.badgeId] = nowIso;
      }
    }

    const rewardRecord = {
      id: `wtask_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
      featureType: 'winter_task' as const,
      idempotencyKey: `task:${taskId}`,
      status: 'applied' as const,
      rarity: 'seasonal',
      label: taskDef.title,
      xpBonus: taskDef.xpReward,
      cookiesBonus: taskDef.cookiesReward,
      aiBonusQueries: 0,
      streakShield: false,
      badgeId: taskDef.badgeId,
      createdAt: nowIso,
      appliedAt: nowIso,
    };
    state.rewardHistory = [rewardRecord, ...state.rewardHistory].slice(0, 60);

    await saveUserWinterState(getSupabaseServerConfig, state);

    const xpRes = await appendXpLedgerEntry(getSupabaseServerConfig, {
      id: `xp_${rewardRecord.id}`,
      userId: actor.id,
      userName: actor.name,
      userRole: actor.role,
      grade: actor.grade || '',
      section: actor.section || '',
      sourceType: 'winter_task',
      actionKey: `winter_task:${taskId}`,
      xpDelta: taskDef.xpReward,
      label: `Winter Task: ${taskDef.title}`,
      createdAt: nowIso,
    });

    broadcastToAllWs({
      type: 'leaderboard:updated',
      userId: actor.id,
      role: actor.role,
    });

    return res.json({
      success: true,
      taskId,
      reward: rewardRecord,
      xpSummary: xpRes,
      winterState: state,
    });
  });

  app.post('/api/winter/santa/claim', requireFeatureAccess('winter_santa_gifts'), async (req, res) => {
    const actor = await getVerifiedUserFromRequest(req);
    if (!actor) return res.status(401).json({ success: false, error: 'Authentication required.' });

    const idempotencyKey = String(req.body?.idempotencyKey || '');
    const result = await executeSantaGiftClaim({
      user: actor,
      idempotencyKey,
      getSupabaseServerConfig,
    });

    if (result.statusCode === 200 && !result.body.alreadyClaimed) {
      broadcastToAllWs({
        type: 'leaderboard:updated',
        userId: actor.id,
        role: actor.role,
      });
    }

    return res.status(result.statusCode).json(result.body);
  });

  app.post('/api/winter/santa/recover', requireFeatureAccess('winter_santa_gifts'), async (req, res) => {
    const actor = await getVerifiedUserFromRequest(req);
    if (!actor) return res.status(401).json({ success: false, error: 'Authentication required.' });

    const state = await loadUserWinterState(getSupabaseServerConfig, actor);
    const pending = state.rewardHistory.find(
      r => r.featureType === 'santa_gift' && r.status === 'pending_apply'
    );
    if (!pending) {
      return res.json({ success: true, recovered: false, winterState: state });
    }

    pending.status = 'recovered';
    pending.appliedAt = new Date().toISOString();
    await saveUserWinterState(getSupabaseServerConfig, state);
    return res.json({ success: true, recovered: true, reward: pending, winterState: state });
  });

  app.post('/api/winter/spin', requireFeatureAccess('winter_spin_wheel'), async (req, res) => {
    const actor = await getVerifiedUserFromRequest(req);
    if (!actor) return res.status(401).json({ success: false, error: 'Authentication required.' });

    const idempotencyKey = req.body?.idempotencyKey ? String(req.body.idempotencyKey) : undefined;
    const result = await executeSpinWheel({
      user: actor,
      idempotencyKey,
      getSupabaseServerConfig,
    });

    if (result.statusCode === 200 && !result.body.idempotentHit) {
      broadcastToAllWs({
        type: 'leaderboard:updated',
        userId: actor.id,
        role: actor.role,
      });
    }

    return res.status(result.statusCode).json(result.body);
  });

  app.post('/api/winter/spin/notified', async (req, res) => {
    const actor = await getVerifiedUserFromRequest(req);
    if (!actor) return res.status(401).json({ success: false, error: 'Authentication required.' });

    const cycleKey = String(req.body?.cycleKey || 'initial').slice(0, 80);
    const state = await loadUserWinterState(getSupabaseServerConfig, actor);
    if (state.lastWheelNotifiedCycle !== cycleKey) {
      state.lastWheelNotifiedCycle = cycleKey;
      await saveUserWinterState(getSupabaseServerConfig, state);
    }
    return res.json({ success: true, lastWheelNotifiedCycle: state.lastWheelNotifiedCycle });
  });

  app.post('/api/winter/profile/frame', async (req, res) => {
    const actor = await getVerifiedUserFromRequest(req);
    if (!actor) return res.status(401).json({ success: false, error: 'Authentication required.' });

    const frameId = req.body?.frameId ? String(req.body.frameId) : null;
    const state = await loadUserWinterState(getSupabaseServerConfig, actor);
    if (frameId && !state.unlockedFrames.includes(frameId)) {
      return res.status(403).json({ success: false, error: 'Frame not unlocked yet.' });
    }

    state.equippedFrame = frameId;
    await saveUserWinterState(getSupabaseServerConfig, state);
    return res.json({ success: true, equippedFrame: state.equippedFrame, winterState: state });
  });

  app.post('/api/gamification/action', async (req, res) => {
    const actor = await getVerifiedUserFromRequest(req);
    if (!actor) return res.status(401).json({ success: false, error: 'Authentication required.' });

    const { action, itemId, labelOverride, clientXpOverride, xp, xpAmount, xpDelta } = req.body || {};
    const actionName = String(action || '').trim();
    const spec = ALLOWED_GAMIFICATION_ACTION_XP[actionName];

    if (!spec) {
      return res.status(400).json({
        success: false,
        error: `Unsupported or unauthorized gamification action "${actionName}".`,
      });
    }

    const suppliedXp = clientXpOverride ?? xp ?? xpAmount ?? xpDelta;
    if (suppliedXp !== undefined && suppliedXp !== null && Number(suppliedXp) !== spec.xp) {
      return res.status(403).json({
        success: false,
        code: 'XP_TAMPER_REJECTED',
        error: 'Client-supplied XP values are rejected; XP is computed strictly on the server.',
      });
    }

    const normalizedRole = String(actor.role || 'student').toLowerCase();
    if (spec.category === 'faculty' && !['teacher', 'coordinator', 'hod', 'admin', 'super_admin'].includes(normalizedRole)) {
      return res.status(403).json({
        success: false,
        error: 'Faculty-only XP actions cannot be claimed by student accounts.',
      });
    }

    const todayKey = getLocalDayKey();
    const safeItemId = itemId ? String(itemId).trim().slice(0, 100) : todayKey;
    const actionKey = `${actionName}:${safeItemId}`;

    const actionsTodayCount = memoryXpLedger.filter(
      x => x.userId === actor.id && x.actionKey.startsWith(`${actionName}:`) && x.createdAt.slice(0, 10) === todayKey
    ).length;

    if (actionsTodayCount >= spec.maxPerDay) {
      return res.status(429).json({
        success: false,
        code: 'DAILY_ACTION_CAP_REACHED',
        error: `Daily limit reached for ${spec.label}.`,
      });
    }

    const nowIso = new Date().toISOString();
    const xpRes = await appendXpLedgerEntry(getSupabaseServerConfig, {
      id: `xp_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
      userId: actor.id,
      userName: actor.name,
      userRole: normalizedRole,
      grade: actor.grade || '',
      section: actor.section || '',
      sourceType: 'academic',
      actionKey,
      xpDelta: spec.xp,
      label: typeof labelOverride === 'string' && labelOverride.trim() ? labelOverride.trim().slice(0, 120) : spec.label,
      createdAt: nowIso,
    });

    if (xpRes.deduplicated) {
      return res.status(409).json({
        success: false,
        code: 'DUPLICATE_XP_CLAIM',
        deduplicated: true,
        error: 'XP for this specific item has already been awarded.',
        xpSummary: xpRes,
      });
    }

    broadcastToAllWs({
      type: 'leaderboard:updated',
      userId: actor.id,
      role: normalizedRole,
    });

    return res.json({
      success: true,
      xpAdded: spec.xp,
      actionKey,
      label: spec.label,
      xpSummary: xpRes,
    });
  });

  app.get('/api/leaderboard', async (req, res) => {
    const actor = await getVerifiedUserFromRequest(req);
    const lbType = String(req.query.type || 'student').toLowerCase() === 'faculty' ? 'faculty' : 'student';
    const rawPeriod = String(req.query.period || 'weekly').toLowerCase();
    const period: 'weekly' | 'monthly' | 'all_time' =
      rawPeriod === 'monthly' ? 'monthly' : rawPeriod === 'all_time' ? 'all_time' : 'weekly';

    const requiredFeature = lbType === 'faculty' ? 'faculty_xp_leaderboard' : 'student_xp_leaderboard';
    if (!isFeatureAccessibleForActor(requiredFeature, actor?.role || '', true)) {
      return res.status(403).json({
        success: false,
        code: 'FEATURE_DISABLED',
        featureKey: requiredFeature,
        error: `${lbType === 'faculty' ? 'Faculty' : 'Student'} XP Leaderboard is currently disabled.`,
      });
    }

    const allUsersMap = new Map<string, any>();
    memoryUserTotalXp.forEach((v, k) => allUsersMap.set(k, { ...v }));

    let ledgerSnapshot = [...memoryXpLedger];

    const { url, key } = getSupabaseServerConfig();
    if (process.env.NODE_ENV !== 'test' && url && key) {
      try {
        const profRes = await fetch(
          `${url}/rest/v1/user_profiles?select=id,name,role,grade,section,house,avatar,points`,
          { headers: { apikey: key, Authorization: `Bearer ${key}` } }
        );
        if (profRes.ok) {
          const profRows = await profRes.json();
          if (Array.isArray(profRows)) {
            profRows.forEach((p: any) => {
              if (!p?.id) return;
              const existing = allUsersMap.get(p.id);
              const wState = memoryWinterStates.get(p.id);
              allUsersMap.set(p.id, {
                userId: String(p.id),
                name: String(p.name || existing?.name || 'Member'),
                role: String(p.role || existing?.role || 'student').toLowerCase(),
                grade: String(p.grade || existing?.grade || ''),
                section: String(p.section || existing?.section || ''),
                house: String(p.house || existing?.house || ''),
                avatar: String(p.avatar || existing?.avatar || ''),
                xp: Math.max(Number(p.points || 0), existing?.xp || 0),
                currentStreak: existing?.currentStreak || 0,
                winterCookies: wState?.cookiesCount || 0,
                equippedFrame: wState?.equippedFrame || null,
                badgesCount: Object.keys(existing?.earnedBadges || {}).length + Object.keys(wState?.earnedWinterBadges || {}).length,
              });
            });
          }
        }

        if (period !== 'all_time') {
          const daysAgo = period === 'weekly' ? 7 : 30;
          const sinceIso = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString();
          const ledRes = await fetch(
            `${url}/rest/v1/gamification_xp_ledger?created_at=gte.${encodeURIComponent(sinceIso)}&select=id,user_id,user_name,user_role,grade,section,house,avatar,source_type,action_key,xp_delta,label,created_at&order=created_at.desc&limit=1000`,
            { headers: { apikey: key, Authorization: `Bearer ${key}` } }
          );
          if (ledRes.ok) {
            const ledRows = await ledRes.json();
            if (Array.isArray(ledRows) && ledRows.length > 0) {
              const seenIds = new Set(ledgerSnapshot.map(l => l.id));
              ledRows.forEach((r: any) => {
                if (!seenIds.has(r.id)) {
                  ledgerSnapshot.push({
                    id: String(r.id),
                    userId: String(r.user_id),
                    userName: String(r.user_name || 'Member'),
                    userRole: String(r.user_role || 'student').toLowerCase(),
                    grade: String(r.grade || ''),
                    section: String(r.section || ''),
                    house: String(r.house || ''),
                    avatar: String(r.avatar || ''),
                    sourceType: r.source_type || 'academic',
                    actionKey: String(r.action_key || r.id),
                    xpDelta: Number(r.xp_delta || 0),
                    label: String(r.label || ''),
                    createdAt: String(r.created_at),
                  });
                }
              });
            }
          } else {
            const docRes = await fetch(
              `${url}/rest/v1/global_data?id=eq.__veylentra_xp_ledger_recent__&select=*`,
              { headers: { apikey: key, Authorization: `Bearer ${key}` } }
            );
            if (docRes.ok) {
              const rows = await docRes.json();
              if (Array.isArray(rows?.[0]?.data)) {
                const seenIds = new Set(ledgerSnapshot.map(l => l.id));
                rows[0].data.forEach((r: any) => {
                  if (r?.id && !seenIds.has(r.id)) ledgerSnapshot.push(r);
                });
              }
            }
          }
        }
      } catch (_) {}
    }

    const rankings = buildSeparatedLeaderboard({
      entries: ledgerSnapshot,
      allTimeUsers: Array.from(allUsersMap.values()),
      type: lbType,
      period,
    });

    const currentUserEntry = actor ? rankings.find(r => r.userId === actor.id) || null : null;

    return res.json({
      success: true,
      type: lbType,
      period,
      rankings,
      totalParticipants: rankings.length,
      currentUserEntry,
      generatedAt: new Date().toISOString(),
    });
  });
}
