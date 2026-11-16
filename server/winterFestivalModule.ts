/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Veylentra Winter Festival & Hardened Leaderboard Backend Module
 * Handles:
 * - Authoritative Nightly Santa Gift claiming (7:00 PM – 9:00 PM IST) + atomic Postgres recovery
 * - Authoritative Winter Spin Wheel with strict 2-hour cooldown & odds transparency
 * - Verified Winter Tasks & Winter Collectible Badges (separate from permanent badges)
 * - Separated Student vs Faculty XP Leaderboards (Weekly / Monthly / All-Time)
 * - Hardened server-validated XP action ledger with Postgres persistence & anti-tamper deduplication
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
import {
  WORKING_ANON_KEY,
  markSupabaseKeyInvalid,
  supabaseFetchWithAnonRetry,
  getFeatureAndWinterSupabaseKey,
} from './supabaseKeyManager';

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
  getGamificationStore?: () => Record<string, any>;
}

export class WinterPersistenceError extends Error {
  statusCode: number;
  code: string;

  constructor(message: string, statusCode = 503, code = 'WINTER_PERSISTENCE_ERROR') {
    super(message);
    this.name = 'WinterPersistenceError';
    this.statusCode = statusCode;
    this.code = code;
  }
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
let forceSupabaseInTests = false;

export function setForceWinterSupabaseForTests(enabled: boolean) {
  if (process.env.NODE_ENV !== 'test') return;
  forceSupabaseInTests = enabled;
}

export function clearWinterMemoryCacheOnlyForTests() {
  if (process.env.NODE_ENV !== 'test') return;
  memoryWinterStates.clear();
  memoryXpLedger.length = 0;
  memoryUserTotalXp.clear();
  inFlightClaimLocks.clear();
}

function shouldUseSupabase(cfg: { url: string; key: string }): boolean {
  if (!cfg.url || !cfg.key) return false;
  if (process.env.NODE_ENV !== 'test') return true;
  if (forceSupabaseInTests) return true;
  return cfg.url.includes('127.0.0.1') || cfg.url.includes('localhost');
}

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

function cloneWinterState(state: UserWinterState): UserWinterState {
  return {
    ...state,
    unlockedFrames: [...(state.unlockedFrames || [])],
    claimedTaskIds: [...(state.claimedTaskIds || [])],
    earnedWinterBadges: { ...(state.earnedWinterBadges || {}) },
    santaClaimedNights: { ...(state.santaClaimedNights || {}) },
    rewardHistory: (state.rewardHistory || []).map(r => ({ ...r })),
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

function isUniqueViolationResponse(status: number, bodyText: string): boolean {
  if (status === 409) return true;
  const lower = bodyText.toLowerCase();
  return lower.includes('23505') || lower.includes('duplicate key') || lower.includes('already exists');
}

function isMissingColumnOrRelationError(status: number, bodyText: string): boolean {
  const lower = bodyText.toLowerCase();
  return (
    status === 404 ||
    bodyText.includes('PGRST204') ||
    bodyText.includes('PGRST205') ||
    bodyText.includes('42703') ||
    bodyText.includes('42P01') ||
    (lower.includes('column') && (lower.includes('does not exist') || lower.includes('could not find'))) ||
    (lower.includes('relation') && lower.includes('does not exist')) ||
    lower.includes('could not find the table')
  );
}

function resolveWinterSupabaseConfig(
  getCfg: WinterModuleDeps['getSupabaseServerConfig']
): { url: string; key: string } {
  const cfg = getCfg();
  if (!cfg.url) return cfg;
  return {
    url: cfg.url,
    key: getFeatureAndWinterSupabaseKey(cfg.url, cfg.key),
  };
}

async function fetchJsonStrict(url: string, init: RequestInit, contextLabel: string): Promise<Response> {
  try {
    return await supabaseFetchWithAnonRetry(url, init);
  } catch (err: any) {
    throw new WinterPersistenceError(
      `Supabase network failure (${contextLabel}): ${err?.message || String(err)}`,
      503
    );
  }
}

export function getUserWinterAiBonusCredits(userId: string, nowMs: number = Date.now()): number {
  const st = memoryWinterStates.get(userId);
  if (!st) return 0;
  const todayKey = getLocalDayKey(nowMs, 'Asia/Kolkata');
  if (st.aiBonusDate !== todayKey) return 0;
  return Math.min(MAX_DAILY_WINTER_AI_BONUS, Math.max(0, st.aiBonusCreditsToday || 0));
}

export async function getUserWinterAiBonusCreditsAsync(
  getSupabaseServerConfig: WinterModuleDeps['getSupabaseServerConfig'],
  userId: string,
  nowMs: number = Date.now()
): Promise<number> {
  const cfg = resolveWinterSupabaseConfig(getSupabaseServerConfig);
  if (!shouldUseSupabase(cfg)) {
    return getUserWinterAiBonusCredits(userId, nowMs);
  }

  const res = await fetchJsonStrict(
    `${cfg.url}/rest/v1/winter_user_profiles?user_id=eq.${encodeURIComponent(userId)}&select=ai_bonus_date,ai_bonus_credits_today`,
    { headers: { apikey: cfg.key, Authorization: `Bearer ${cfg.key}` } },
    'getUserWinterAiBonusCreditsAsync'
  );

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new WinterPersistenceError(
      `Failed to read Winter AI bonus credits from Supabase (${res.status}): ${errText || res.statusText}`,
      503
    );
  }

  const rows = await res.json();
  if (!Array.isArray(rows) || !rows[0]) return 0;
  const row = rows[0];
  const todayKey = getLocalDayKey(nowMs, 'Asia/Kolkata');
  if (String(row.ai_bonus_date || '') !== todayKey) {
    return 0;
  }
  const val = Number(row.ai_bonus_credits_today || 0);
  return Math.min(MAX_DAILY_WINTER_AI_BONUS, Math.max(0, Number.isFinite(val) ? val : 0));
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

function mapLedgerRowToHistoryItem(r: any): UserWinterState['rewardHistory'][number] {
  return {
    id: String(r.id),
    featureType: (r.feature_type || 'spin_wheel') as 'santa_gift' | 'spin_wheel' | 'winter_task',
    idempotencyKey: String(r.idempotency_key || r.id),
    eventNightKey: r.event_night_key ? String(r.event_night_key) : undefined,
    status: (r.status || 'applied') as 'pending_apply' | 'applied' | 'recovered',
    rarity: String(r.rarity || 'common'),
    segmentIndex: typeof r.segment_index === 'number' ? r.segment_index : undefined,
    label: String(r.reward_label || ''),
    xpBonus: Number(r.xp_bonus || 0),
    cookiesBonus: Number(r.cookies_bonus || 0),
    aiBonusQueries: Number(r.ai_bonus_queries || 0),
    streakShield: Boolean(r.streak_shield),
    badgeId: r.badge_id ? String(r.badge_id) : undefined,
    frameId: r.frame_id ? String(r.frame_id) : undefined,
    createdAt: String(r.created_at || new Date().toISOString()),
    appliedAt: r.applied_at ? String(r.applied_at) : undefined,
  };
}

export async function loadUserWinterState(
  getSupabaseServerConfig: WinterModuleDeps['getSupabaseServerConfig'],
  user: { id: string; name: string; role: string }
): Promise<UserWinterState> {
  const cfg = resolveWinterSupabaseConfig(getSupabaseServerConfig);
  if (!shouldUseSupabase(cfg)) {
    const cached = memoryWinterStates.get(user.id);
    if (cached) return cloneWinterState(cached);
    const fresh = getDefaultWinterState(user);
    memoryWinterStates.set(user.id, fresh);
    return cloneWinterState(fresh);
  }

  const headers = { apikey: cfg.key, Authorization: `Bearer ${cfg.key}` };
  const encUid = encodeURIComponent(user.id);

  const [wpRes, claimsRes, badgesRes, ledgerRes] = await Promise.all([
    fetchJsonStrict(`${cfg.url}/rest/v1/winter_user_profiles?user_id=eq.${encUid}&select=*`, { headers }, 'load winter_user_profiles'),
    fetchJsonStrict(`${cfg.url}/rest/v1/winter_task_claims?user_id=eq.${encUid}&select=task_id,claimed_at`, { headers }, 'load winter_task_claims'),
    fetchJsonStrict(`${cfg.url}/rest/v1/winter_user_badges?user_id=eq.${encUid}&select=badge_id,unlocked_at`, { headers }, 'load winter_user_badges'),
    fetchJsonStrict(
      `${cfg.url}/rest/v1/winter_reward_ledger?user_id=eq.${encUid}&select=id,feature_type,idempotency_key,event_night_key,status,rarity,segment_index,reward_label,xp_bonus,cookies_bonus,ai_bonus_queries,streak_shield,badge_id,frame_id,created_at,applied_at&order=created_at.desc&limit=60`,
      { headers },
      'load winter_reward_ledger'
    ),
  ]);

  if (!wpRes.ok) {
    const errText = await wpRes.text().catch(() => '');
    if (isMissingColumnOrRelationError(wpRes.status, errText)) {
      throw new WinterPersistenceError(
        `Missing columns or table in winter_user_profiles (${errText || wpRes.statusText}). Run the Winter SQL migration script in Supabase SQL Editor first.`,
        503,
        'WINTER_SQL_MIGRATION_REQUIRED'
      );
    }
    throw new WinterPersistenceError(
      `Failed to load Winter profile from Supabase (${wpRes.status}): ${errText || wpRes.statusText}`,
      503
    );
  }
  if (!claimsRes.ok) {
    const errText = await claimsRes.text().catch(() => '');
    throw new WinterPersistenceError(
      `Failed to load Winter task claims from Supabase (${claimsRes.status}): ${errText || claimsRes.statusText}`,
      503
    );
  }
  if (!badgesRes.ok) {
    const errText = await badgesRes.text().catch(() => '');
    throw new WinterPersistenceError(
      `Failed to load Winter badges from Supabase (${badgesRes.status}): ${errText || badgesRes.statusText}`,
      503
    );
  }
  if (!ledgerRes.ok) {
    const errText = await ledgerRes.text().catch(() => '');
    throw new WinterPersistenceError(
      `Failed to load Winter reward ledger from Supabase (${ledgerRes.status}): ${errText || ledgerRes.statusText}`,
      503
    );
  }

  const [wpRows, claimRows, badgeRows, ledgerRows] = await Promise.all([
    wpRes.json(),
    claimsRes.json(),
    badgesRes.json(),
    ledgerRes.json(),
  ]);

  let merged: UserWinterState = getDefaultWinterState(user);

  if (Array.isArray(wpRows) && wpRows[0]) {
    const r = wpRows[0];
    const storedState = r.state_json && typeof r.state_json === 'object' ? r.state_json : {};
    const dbFrames = Array.isArray(r.unlocked_frames) ? r.unlocked_frames : [];
    const storedFrames = Array.isArray(storedState.unlockedFrames) ? storedState.unlockedFrames : [];
    const dbTasks = Array.isArray(r.claimed_task_ids) ? r.claimed_task_ids : [];
    const storedTasks = Array.isArray(storedState.claimedTaskIds) ? storedState.claimedTaskIds : [];
    const dbHistory = Array.isArray(r.reward_history) ? r.reward_history : [];
    const storedHistory = Array.isArray(storedState.rewardHistory) ? storedState.rewardHistory : [];

    merged = {
      ...merged,
      ...storedState,
      userId: user.id,
      userName: user.name || r.user_name || storedState.userName || 'Member',
      userRole: user.role || r.user_role || storedState.userRole || 'student',
      cookiesCount: Number(r.cookies_count ?? storedState.cookiesCount ?? 0),
      streakShields: Number(r.streak_shields ?? storedState.streakShields ?? 0),
      unlockedFrames: Array.from(new Set([...storedFrames, ...dbFrames])),
      equippedFrame: r.equipped_frame !== undefined ? r.equipped_frame : (storedState.equippedFrame || null),
      spinNextEligibleAt: r.spin_next_eligible_at || storedState.spinNextEligibleAt || null,
      lastSpinAt: r.last_spin_at || storedState.lastSpinAt || null,
      lastWheelNotifiedCycle: r.last_wheel_notified_cycle || storedState.lastWheelNotifiedCycle || null,
      aiBonusDate: r.ai_bonus_date || storedState.aiBonusDate || getLocalDayKey(),
      aiBonusCreditsToday: Number(r.ai_bonus_credits_today ?? storedState.aiBonusCreditsToday ?? 0),
      quizCompleted: Boolean(r.quiz_completed ?? storedState.quizCompleted ?? false),
      claimedTaskIds: Array.from(new Set([...storedTasks, ...dbTasks])),
      earnedWinterBadges: {
        ...(storedState.earnedWinterBadges && typeof storedState.earnedWinterBadges === 'object' ? storedState.earnedWinterBadges : {}),
        ...(r.earned_winter_badges && typeof r.earned_winter_badges === 'object' ? r.earned_winter_badges : {}),
      },
      santaClaimedNights: {
        ...(storedState.santaClaimedNights && typeof storedState.santaClaimedNights === 'object' ? storedState.santaClaimedNights : {}),
        ...(r.santa_claimed_nights && typeof r.santa_claimed_nights === 'object' ? r.santa_claimed_nights : {}),
      },
      rewardHistory: dbHistory.length >= storedHistory.length ? dbHistory : storedHistory,
      updatedAt: String(r.updated_at || storedState.updatedAt || new Date().toISOString()),
    };
  } else {
    // Optional legacy read-only migration check if older state lived in global_data
    try {
      const docId = `winter_state_${user.id}`;
      const gdRes = await fetchJsonStrict(
        `${cfg.url}/rest/v1/global_data?id=eq.${encodeURIComponent(docId)}&select=id,data`,
        { headers },
        'load legacy winter global_data'
      );
      if (gdRes.ok) {
        const gdRows = await gdRes.json();
        const remote = gdRows?.[0]?.data;
        if (remote && typeof remote === 'object') {
          merged = {
            ...merged,
            ...remote,
            userId: user.id,
            userName: user.name || remote.userName || 'Member',
            userRole: user.role || remote.userRole || 'student',
          };
        }
      }
    } catch {
      // Continue safely with default winter state if global_data fails or is unavailable
    }
  }

  // Reconcile normalized relational tables cleanly as authoritative union
  if (Array.isArray(claimRows) && claimRows.length > 0) {
    const taskSet = new Set<string>(merged.claimedTaskIds || []);
    for (const c of claimRows) {
      if (c?.task_id) taskSet.add(String(c.task_id));
    }
    merged.claimedTaskIds = Array.from(taskSet);
  }

  if (Array.isArray(badgeRows) && badgeRows.length > 0) {
    const badgesMap = { ...(merged.earnedWinterBadges || {}) };
    for (const b of badgeRows) {
      if (b?.badge_id && !badgesMap[b.badge_id]) {
        badgesMap[b.badge_id] = String(b.unlocked_at || new Date().toISOString());
      }
    }
    merged.earnedWinterBadges = badgesMap;
  }

  if (Array.isArray(ledgerRows) && ledgerRows.length > 0) {
    const nightsMap = { ...(merged.santaClaimedNights || {}) };
    const badgesMap = { ...(merged.earnedWinterBadges || {}) };
    const framesSet = new Set<string>(merged.unlockedFrames || []);
    const historyById = new Map<string, UserWinterState['rewardHistory'][number]>();
    for (const h of merged.rewardHistory || []) {
      if (h?.id) historyById.set(h.id, h);
    }
    for (const r of ledgerRows) {
      if (r?.feature_type === 'santa_gift' && r?.event_night_key && !nightsMap[r.event_night_key]) {
        nightsMap[String(r.event_night_key)] = String(r.id);
      }
      if (r?.status === 'applied' && r?.badge_id && !badgesMap[r.badge_id]) {
        badgesMap[String(r.badge_id)] = String(r.applied_at || r.created_at || new Date().toISOString());
      }
      if (r?.status === 'applied' && r?.frame_id) {
        framesSet.add(String(r.frame_id));
      }
      if (r?.id) {
        const mapped = mapLedgerRowToHistoryItem(r);
        if (!historyById.has(mapped.id)) {
          historyById.set(mapped.id, mapped);
        }
      }
    }
    merged.santaClaimedNights = nightsMap;
    merged.earnedWinterBadges = badgesMap;
    merged.unlockedFrames = Array.from(framesSet);
    merged.rewardHistory = Array.from(historyById.values())
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
      .slice(0, 60);
  }

  memoryWinterStates.set(user.id, cloneWinterState(merged));
  return merged;
}

async function syncEarnedBadgesTable(
  cfg: { url: string; key: string },
  userId: string,
  badges: Record<string, string>
): Promise<void> {
  const entries = Object.entries(badges || {});
  if (entries.length === 0) return;
  const payload = entries.map(([badgeId, unlockedAt]) => {
    const def = WINTER_FESTIVAL_BADGES.find(b => b.id === badgeId);
    return {
      id: `wbadge_${userId}_${badgeId}`,
      user_id: userId,
      badge_id: badgeId,
      rarity: def?.rarity || 'seasonal',
      unlocked_at: unlockedAt || new Date().toISOString(),
    };
  });

  const res = await fetchJsonStrict(
    `${cfg.url}/rest/v1/winter_user_badges?on_conflict=user_id,badge_id`,
    {
      method: 'POST',
      headers: {
        apikey: cfg.key,
        Authorization: `Bearer ${cfg.key}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=ignore-duplicates',
      },
      body: JSON.stringify(payload),
    },
    'sync winter_user_badges'
  );
  if (!res.ok && !isUniqueViolationResponse(res.status, await res.text().catch(() => ''))) {
    throw new WinterPersistenceError(`Failed to persist Winter badges (${res.status})`, 503);
  }
}

export async function saveUserWinterState(
  getSupabaseServerConfig: WinterModuleDeps['getSupabaseServerConfig'],
  state: UserWinterState
): Promise<UserWinterState> {
  const nextState = cloneWinterState(state);
  nextState.updatedAt = new Date().toISOString();
  evaluateSecretWinterBadges(nextState, nextState.updatedAt);

  const cfg = resolveWinterSupabaseConfig(getSupabaseServerConfig);
  if (!shouldUseSupabase(cfg)) {
    memoryWinterStates.set(nextState.userId, cloneWinterState(nextState));
    return nextState;
  }

  const res = await fetchJsonStrict(
    `${cfg.url}/rest/v1/winter_user_profiles?on_conflict=user_id`,
    {
      method: 'POST',
      headers: {
        apikey: cfg.key,
        Authorization: `Bearer ${cfg.key}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates',
      },
      body: JSON.stringify({
        user_id: nextState.userId,
        user_name: nextState.userName,
        user_role: nextState.userRole,
        cookies_count: nextState.cookiesCount,
        streak_shields: nextState.streakShields,
        unlocked_frames: nextState.unlockedFrames,
        equipped_frame: nextState.equippedFrame,
        spin_next_eligible_at: nextState.spinNextEligibleAt,
        last_spin_at: nextState.lastSpinAt,
        last_wheel_notified_cycle: nextState.lastWheelNotifiedCycle,
        ai_bonus_date: nextState.aiBonusDate,
        ai_bonus_credits_today: nextState.aiBonusCreditsToday,
        quiz_completed: nextState.quizCompleted,
        claimed_task_ids: nextState.claimedTaskIds,
        earned_winter_badges: nextState.earnedWinterBadges,
        santa_claimed_nights: nextState.santaClaimedNights,
        reward_history: nextState.rewardHistory,
        state_json: nextState,
        updated_at: nextState.updatedAt,
      }),
    },
    'save winter_user_profiles'
  );

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    if (isMissingColumnOrRelationError(res.status, errText)) {
      throw new WinterPersistenceError(
        `Winter rewards could not be saved because required columns (claimed_task_ids, earned_winter_badges, santa_claimed_nights, reward_history, state_json) are missing on winter_user_profiles. Please run the Winter SQL migration script in Supabase SQL Editor. (${errText || res.statusText})`,
        503,
        'WINTER_SQL_MIGRATION_REQUIRED'
      );
    }
    throw new WinterPersistenceError(
      `Failed to save Winter state to Supabase (${res.status}): ${errText || res.statusText}`,
      503
    );
  }

  await syncEarnedBadgesTable(cfg, nextState.userId, nextState.earnedWinterBadges);
  memoryWinterStates.set(nextState.userId, cloneWinterState(nextState));
  return nextState;
}

export async function appendXpLedgerEntry(
  getSupabaseServerConfig: WinterModuleDeps['getSupabaseServerConfig'],
  entry: XpLedgerEntry,
  options?: { alreadyAddedToProfile?: boolean }
): Promise<{ accepted: boolean; deduplicated: boolean; totalXp: number; level: number; levelTitle: string }> {
  const cfg = resolveWinterSupabaseConfig(getSupabaseServerConfig);

  if (!shouldUseSupabase(cfg)) {
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

    return { accepted: true, deduplicated: false, totalXp: newTotalXp, ...lvl };
  }

  const headers = {
    apikey: cfg.key,
    Authorization: `Bearer ${cfg.key}`,
    'Content-Type': 'application/json',
  };

  // 1. Authoritative Postgres insert FIRST (no merge-duplicates so UNIQUE(user_id, action_key) rejects duplicates atomically)
  let insertRes = await fetchJsonStrict(
    `${cfg.url}/rest/v1/gamification_xp_ledger`,
    {
      method: 'POST',
      headers,
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
    },
    'insert gamification_xp_ledger'
  );

  const encUid = encodeURIComponent(entry.userId);

  if (!insertRes.ok) {
    let errText = await insertRes.text().catch(() => '');
    if (isUniqueViolationResponse(insertRes.status, errText)) {
      const curTotal = await fetchAuthoritativeUserTotalXp(cfg, entry.userId);
      const lvl = computeLevelFromXp(curTotal);
      return { accepted: false, deduplicated: true, totalXp: curTotal, ...lvl };
    }
    if (isMissingColumnOrRelationError(insertRes.status, errText)) {
      // Retry insert with the minimal column set in case gamification_xp_ledger uses only core columns
      const minimalInsertRes = await fetchJsonStrict(
        `${cfg.url}/rest/v1/gamification_xp_ledger`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify({
            id: entry.id,
            user_id: entry.userId,
            user_name: entry.userName,
            user_role: entry.userRole,
            xp_delta: entry.xpDelta,
            label: entry.label,
            created_at: entry.createdAt,
          }),
        },
        'insert minimal gamification_xp_ledger'
      );
      if (minimalInsertRes.ok) {
        insertRes = minimalInsertRes;
      } else {
        errText = await minimalInsertRes.text().catch(() => errText);
      }
    }
    if (!insertRes.ok) {
      throw new WinterPersistenceError(
        isMissingColumnOrRelationError(insertRes.status, errText)
          ? `XP ledger table gamification_xp_ledger is missing or outdated (${errText || insertRes.statusText}). Please run the Winter SQL script in Supabase SQL Editor.`
          : `Failed to write XP ledger entry to Supabase (${insertRes.status}): ${errText || insertRes.statusText}`,
        503,
        isMissingColumnOrRelationError(insertRes.status, errText) ? 'WINTER_SQL_MIGRATION_REQUIRED' : 'WINTER_PERSISTENCE_ERROR'
      );
    }
  }

  // 2. Read authoritative existing XP across ledger, user_profiles, & global_data so cold restarts never overwrite with 0
  const [ledRowsRes, profRes, gdRes] = await Promise.all([
    fetchJsonStrict(
      `${cfg.url}/rest/v1/gamification_xp_ledger?user_id=eq.${encUid}&select=xp_delta`,
      { headers: { apikey: cfg.key, Authorization: `Bearer ${cfg.key}` } },
      'sum gamification_xp_ledger'
    ),
    fetchJsonStrict(
      `${cfg.url}/rest/v1/user_profiles?or=(id.eq.${encUid},uid.eq.${encUid})&select=id,uid,points&limit=2`,
      { headers: { apikey: cfg.key, Authorization: `Bearer ${cfg.key}` } },
      'read user_profiles points'
    ).catch(() => null),
    fetchJsonStrict(
      `${cfg.url}/rest/v1/global_data?id=eq.${encodeURIComponent(`gamification_user_${entry.userId}`)}&select=id,data`,
      { headers: { apikey: cfg.key, Authorization: `Bearer ${cfg.key}` } },
      'read global_data gamification doc'
    ).catch(() => null),
  ]);

  if (!ledRowsRes.ok) {
    throw new WinterPersistenceError(`Failed to read XP ledger sum (${ledRowsRes.status})`, 503);
  }

  const ledRows = await ledRowsRes.json();
  const ledgerSum = Array.isArray(ledRows)
    ? ledRows.reduce((s: number, r: any) => s + Math.max(0, Number(r?.xp_delta || 0)), 0)
    : entry.xpDelta;

  let profilePoints = 0;
  if (profRes && profRes.ok) {
    const profRows = await profRes.json();
    if (Array.isArray(profRows)) {
      for (const p of profRows) {
        profilePoints = Math.max(profilePoints, Number(p?.points || 0));
      }
    }
  }

  let existingDoc: any = null;
  let docXp = 0;
  if (gdRes && gdRes.ok) {
    const gdRows = await gdRes.json();
    if (gdRows?.[0]?.data && typeof gdRows[0].data === 'object') {
      existingDoc = gdRows[0].data;
      docXp = Math.max(0, Number(existingDoc.xp || 0));
    }
  }

  const prevKnownXp = Math.max(profilePoints, docXp);
  const newTotalXp = options?.alreadyAddedToProfile
    ? Math.max(ledgerSum, prevKnownXp)
    : Math.max(ledgerSum, prevKnownXp + entry.xpDelta);
  const lvl = computeLevelFromXp(newTotalXp);

  // 3. Persist updated total points back to user_profiles (matching either id or uid) & gamification_user_* doc
  const [patchProfRes] = await Promise.all([
    fetchJsonStrict(
      `${cfg.url}/rest/v1/user_profiles?or=(id.eq.${encUid},uid.eq.${encUid})`,
      {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          points: newTotalXp,
          updated_at: Date.now(),
        }),
      },
      'patch user_profiles points'
    ).catch(() => null),
    fetchJsonStrict(
      `${cfg.url}/rest/v1/global_data?on_conflict=id`,
      {
        method: 'POST',
        headers: { ...headers, Prefer: 'resolution=merge-duplicates' },
        body: JSON.stringify({
          id: `gamification_user_${entry.userId}`,
          data: {
            ...(existingDoc || {}),
            userId: entry.userId,
            userName: entry.userName || existingDoc?.userName || 'Member',
            role: entry.userRole || existingDoc?.role || 'student',
            grade: entry.grade || existingDoc?.grade || '',
            section: entry.section || existingDoc?.section || '',
            house: entry.house || existingDoc?.house || '',
            avatar: entry.avatar || existingDoc?.avatar || '',
            xp: newTotalXp,
            level: lvl.level,
            levelTitle: lvl.levelTitle,
            updatedAt: entry.createdAt,
          },
          updated_at: entry.createdAt,
        }),
      },
      'upsert gamification_user doc'
    ).catch(() => null),
  ]);

  // Note: user_profiles.points is the canonical sync target; if global_data or user_profiles fails, continue safely
  if (patchProfRes && !patchProfRes.ok) {
    const errText = await patchProfRes.text().catch(() => '');
    // If user_profiles was missing or failed, non-fatal since gamification_xp_ledger is already authoritative
    console.warn(`[XP LEDGER] user_profiles sync warning (${patchProfRes.status}): ${errText || patchProfRes.statusText}`);
  }

  // Update in-memory mirror AFTER DB commits cleanly
  memoryXpLedger.unshift(entry);
  if (memoryXpLedger.length > 5000) memoryXpLedger.pop();
  const prev = memoryUserTotalXp.get(entry.userId);
  memoryUserTotalXp.set(entry.userId, {
    userId: entry.userId,
    name: entry.userName,
    role: entry.userRole,
    grade: entry.grade,
    section: entry.section,
    house: entry.house || prev?.house || '',
    avatar: entry.avatar || prev?.avatar || '',
    xp: newTotalXp,
    currentStreak: prev?.currentStreak || existingDoc?.currentStreak || 1,
    earnedBadges: prev?.earnedBadges || existingDoc?.earnedBadges || {},
    updatedAt: entry.createdAt,
  });

  return { accepted: true, deduplicated: false, totalXp: newTotalXp, ...lvl };
}

async function fetchAuthoritativeUserTotalXp(cfg: { url: string; key: string }, userId: string): Promise<number> {
  const headers = { apikey: cfg.key, Authorization: `Bearer ${cfg.key}` };
  const encUid = encodeURIComponent(userId);
  const [ledRes, profRes, gdRes] = await Promise.all([
    fetchJsonStrict(`${cfg.url}/rest/v1/gamification_xp_ledger?user_id=eq.${encUid}&select=xp_delta`, { headers }, 'fetch user ledger').catch(() => null),
    fetchJsonStrict(`${cfg.url}/rest/v1/user_profiles?or=(id.eq.${encUid},uid.eq.${encUid})&select=points&limit=2`, { headers }, 'fetch user points').catch(() => null),
    fetchJsonStrict(`${cfg.url}/rest/v1/global_data?id=eq.${encodeURIComponent(`gamification_user_${userId}`)}&select=data`, { headers }, 'fetch user gdoc').catch(() => null),
  ]);
  let maxXp = 0;
  if (ledRes && ledRes.ok) {
    const rows = await ledRes.json();
    if (Array.isArray(rows)) {
      maxXp = Math.max(maxXp, rows.reduce((s: number, r: any) => s + Math.max(0, Number(r?.xp_delta || 0)), 0));
    }
  }
  if (profRes && profRes.ok) {
    const rows = await profRes.json();
    if (Array.isArray(rows)) {
      for (const p of rows) maxXp = Math.max(maxXp, Number(p?.points || 0));
    }
  }
  if (gdRes && gdRes.ok) {
    const rows = await gdRes.json();
    maxXp = Math.max(maxXp, Number(rows?.[0]?.data?.xp || 0));
  }
  return maxXp;
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
    updatedAt?: string | number | null;
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
    const allTimeLedgerTotals = new Map<string, { xp: number; entry: XpLedgerEntry }>();
    for (const item of params.entries) {
      if (!roleMatches(item.userRole)) continue;
      const prev = allTimeLedgerTotals.get(item.userId);
      if (prev) {
        prev.xp += item.xpDelta;
      } else {
        allTimeLedgerTotals.set(item.userId, { xp: item.xpDelta, entry: item });
      }
    }
    for (const [uid, agg] of allTimeLedgerTotals.entries()) {
      const existing = userProfileMap.get(uid);
      if (!existing) {
        userProfileMap.set(uid, {
          userId: uid,
          name: agg.entry.userName || 'Member',
          role: agg.entry.userRole,
          grade: agg.entry.grade,
          section: agg.entry.section,
          house: agg.entry.house,
          avatar: agg.entry.avatar,
          xp: Math.max(0, Math.round(agg.xp)),
          currentStreak: 0,
          winterCookies: 0,
          equippedFrame: null,
          badgesCount: 0,
        });
      } else if (agg.xp > existing.xp) {
        existing.xp = Math.max(existing.xp, Math.round(agg.xp));
      }
    }

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
    rows.sort((a, b) => b.xp - a.xp || b.winterCookies - a.winterCookies || a.name.localeCompare(b.name));
    return rows.map((row, idx) => ({ ...row, rank: idx + 1 }));
  }

  const periodTotals = new Map<string, { xp: number; entry: XpLedgerEntry }>();
  const usersWithLedgerHistory = new Set<string>();
  for (const item of params.entries) {
    if (!roleMatches(item.userRole)) continue;
    usersWithLedgerHistory.add(item.userId);
    const ts = new Date(item.createdAt).getTime();
    if (!Number.isFinite(ts) || ts < cutoffMs || ts > nowMs + 60_000) continue;
    const prev = periodTotals.get(item.userId);
    if (prev) {
      prev.xp += item.xpDelta;
    } else {
      periodTotals.set(item.userId, { xp: item.xpDelta, entry: item });
    }
  }

  const rowsMap = new Map<string, any>();

  // 1. Users with ledger entries inside the selected time window
  for (const [userId, agg] of periodTotals.entries()) {
    const profile = userProfileMap.get(userId);
    const totalAllTimeXp = Math.max(profile?.xp ?? 0, agg.xp);
    const lvl = computeLevelFromXp(totalAllTimeXp);
    rowsMap.set(userId, {
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
    });
  }

  // 2. Include cohort members from userProfileMap without ledger rows in this window
  for (const [userId, u] of userProfileMap.entries()) {
    if (rowsMap.has(userId)) continue;
    let fallbackWindowXp = 0;
    if (!usersWithLedgerHistory.has(userId) && (u.xp || 0) > 0) {
      const rawUpd = u.updatedAt;
      const updatedMs =
        typeof rawUpd === 'number'
          ? (rawUpd > 0 ? rawUpd : 0)
          : rawUpd
          ? new Date(rawUpd).getTime()
          : 0;
      if (updatedMs > 0 && updatedMs >= cutoffMs && updatedMs <= nowMs + 60_000) {
        fallbackWindowXp = Math.max(0, Math.round(u.xp || 0));
      }
    }
    const totalAllTimeXp = Math.max(0, Math.round(u.xp || 0));
    const lvl = computeLevelFromXp(totalAllTimeXp);
    rowsMap.set(userId, {
      userId,
      name: u.name || 'Member',
      role: u.role,
      grade: params.type === 'student' ? u.grade || '' : undefined,
      section: params.type === 'student' ? u.section || '' : undefined,
      house: u.house || '',
      avatar: u.avatar || '',
      xp: fallbackWindowXp,
      allTimeXp: totalAllTimeXp,
      level: lvl.level,
      levelTitle: lvl.levelTitle,
      nextLevelXp: lvl.nextLevelXp,
      currentStreak: u.currentStreak || 0,
      winterCookies: u.winterCookies || 0,
      equippedFrame: u.equippedFrame || null,
      badgesCount: u.badgesCount || 0,
    });
  }

  const rows = Array.from(rowsMap.values());
  rows.sort((a, b) => b.xp - a.xp || (b.allTimeXp || 0) - (a.allTimeXp || 0) || a.name.localeCompare(b.name));
  return rows.map((row, idx) => ({ ...row, rank: idx + 1 }));
}

export async function executeSantaGiftClaim(params: {
  user: { id: string; name: string; email?: string; role: string; grade?: string; section?: string };
  idempotencyKey: string;
  nowMs?: number;
  isPreview?: boolean;
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

  const userEmail = (params.user.email || '').toLowerCase().trim();
  const isSuperAdmin =
    String(params.user.role || '').toLowerCase().trim() === 'super_admin' ||
    [
      'naitik.kashyap0015@gmail.com',
      'naitik.kashyap5205@gmail.com',
      'superadmin@studentos.edu',
      'superadmin@veylentra.edu',
    ].includes(userEmail);

  if (params.isPreview) {
    if (!isSuperAdmin) {
      return {
        statusCode: 403,
        body: {
          success: false,
          error: 'Only Super Admins can preview Santa gifts outside the event window.',
        },
      };
    }
    const roll = rollSantaRewardTier();
    const previewReward = {
      id: `preview_santa_${Date.now()}`,
      featureType: 'santa_gift' as const,
      idempotencyKey: `preview_${Date.now()}`,
      eventNightKey: windowStatus.eventNightKey,
      status: 'applied' as const,
      rarity: roll.rarity,
      label: roll.label,
      xpBonus: roll.xpBonus,
      cookiesBonus: roll.cookiesBonus,
      aiBonusQueries: roll.aiBonusQueries,
      streakShield: roll.streakShield,
      badgeId: roll.badgeId,
      frameId: roll.frameId,
      createdAt: new Date(nowMs).toISOString(),
      appliedAt: new Date(nowMs).toISOString(),
    };
    return {
      statusCode: 200,
      body: {
        success: true,
        isPreview: true,
        reward: previewReward,
        message: 'Super Admin Preview: Simulated Santa gift unwrap without mutating real claims or XP.',
        windowStatus,
      },
    };
  }

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
      body: { success: false, code: 'CLAIM_IN_PROGRESS', error: 'A Santa gift claim is already in progress. Please wait.' },
    };
  }

  inFlightClaimLocks.add(lockKey);
  try {
    const cfg = resolveWinterSupabaseConfig(params.getSupabaseServerConfig);
    const useDb = shouldUseSupabase(cfg);
    const state = await loadUserWinterState(params.getSupabaseServerConfig, params.user);
    const idemp = String(params.idempotencyKey || `santa_${windowStatus.eventNightKey}`).trim();

    const existingByIdemp = state.rewardHistory.find(
      r => r.featureType === 'santa_gift' && r.idempotencyKey === idemp
    );
    if (existingByIdemp) {
      if (existingByIdemp.status === 'pending_apply') {
        existingByIdemp.status = 'recovered';
        existingByIdemp.appliedAt = new Date(nowMs).toISOString();
        const saved = await saveUserWinterState(params.getSupabaseServerConfig, state);
        if (useDb) {
          await fetchJsonStrict(
            `${cfg.url}/rest/v1/winter_reward_ledger?id=eq.${encodeURIComponent(existingByIdemp.id)}`,
            {
              method: 'PATCH',
              headers: { apikey: cfg.key, Authorization: `Bearer ${cfg.key}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({ status: 'recovered', applied_at: existingByIdemp.appliedAt }),
            },
            'recover santa ledger'
          );
        }
        return {
          statusCode: 200,
          body: {
            success: true,
            alreadyClaimed: true,
            recovered: true,
            reward: existingByIdemp,
            windowStatus,
            winterState: saved,
          },
        };
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
    const rewardId = `santa_${nowMs}_${crypto.randomBytes(4).toString('hex')}`;
    const appliedAtIso = new Date(nowMs).toISOString();

    const todayKey = windowStatus.eventNightKey;
    const normalizedState = normalizeWinterBonusForToday(cloneWinterState(state), todayKey);
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

    // Insert pending_apply row in winter_reward_ledger FIRST so concurrent multi-instance claims collide at Postgres UNIQUE index
    if (useDb) {
      const ledgerInsertRes = await fetchJsonStrict(
        `${cfg.url}/rest/v1/winter_reward_ledger`,
        {
          method: 'POST',
          headers: {
            apikey: cfg.key,
            Authorization: `Bearer ${cfg.key}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            id: rewardId,
            user_id: params.user.id,
            feature_type: 'santa_gift',
            idempotency_key: idemp,
            event_night_key: windowStatus.eventNightKey,
            status: 'pending_apply',
            rarity: tier.rarity,
            reward_label: tier.label,
            xp_bonus: tier.xpBonus,
            cookies_bonus: tier.cookiesBonus,
            ai_bonus_queries: grantedAiBonus,
            streak_shield: tier.streakShield,
            badge_id: tier.badgeId || null,
            frame_id: tier.frameId || null,
            created_at: appliedAtIso,
          }),
        },
        'insert pending santa_gift'
      );

      if (!ledgerInsertRes.ok) {
        const errText = await ledgerInsertRes.text().catch(() => '');
        if (isUniqueViolationResponse(ledgerInsertRes.status, errText)) {
          const reloaded = await loadUserWinterState(params.getSupabaseServerConfig, params.user);
          const sameIdemp = reloaded.rewardHistory.find(
            r => r.featureType === 'santa_gift' && r.idempotencyKey === idemp
          );
          if (sameIdemp) {
            return {
              statusCode: 200,
              body: {
                success: true,
                alreadyClaimed: true,
                recovered: sameIdemp.status === 'recovered',
                reward: sameIdemp,
                windowStatus,
                winterState: reloaded,
              },
            };
          }
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
        throw new WinterPersistenceError(
          `Failed to reserve Santa gift claim in Supabase (${ledgerInsertRes.status}): ${errText || ledgerInsertRes.statusText}`,
          503
        );
      }
    }

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

    let persistedState: UserWinterState;
    try {
      persistedState = await saveUserWinterState(params.getSupabaseServerConfig, normalizedState);
    } catch (saveErr) {
      if (useDb) {
        await fetchJsonStrict(
          `${cfg.url}/rest/v1/winter_reward_ledger?id=eq.${encodeURIComponent(rewardId)}`,
          { method: 'DELETE', headers: { apikey: cfg.key, Authorization: `Bearer ${cfg.key}` } },
          'rollback santa reward ledger'
        ).catch(() => {});
      }
      throw saveErr;
    }

    if (useDb) {
      const markRes = await fetchJsonStrict(
        `${cfg.url}/rest/v1/winter_reward_ledger?id=eq.${encodeURIComponent(rewardId)}`,
        {
          method: 'PATCH',
          headers: { apikey: cfg.key, Authorization: `Bearer ${cfg.key}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'applied', applied_at: appliedAtIso }),
        },
        'finalize santa ledger applied'
      );
      if (!markRes.ok) {
        const errText = await markRes.text().catch(() => '');
        throw new WinterPersistenceError(
          `Failed to mark Santa gift ledger applied (${markRes.status}): ${errText}`,
          503
        );
      }
    }

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

    const reloadedState = await loadUserWinterState(params.getSupabaseServerConfig, params.user);

    return {
      statusCode: 200,
      body: {
        success: true,
        alreadyClaimed: false,
        reward: record,
        tier,
        xpSummary: xpRes,
        windowStatus,
        winterState: reloadedState || persistedState,
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
      body: { success: false, code: 'SPIN_IN_PROGRESS', error: 'Spin already in progress. Please wait.' },
    };
  }

  inFlightClaimLocks.add(lockKey);
  try {
    const cfg = resolveWinterSupabaseConfig(params.getSupabaseServerConfig);
    const useDb = shouldUseSupabase(cfg);
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
    const rewardId = `spin_${nowMs}_${crypto.randomBytes(4).toString('hex')}`;
    const nowIso = new Date(nowMs).toISOString();
    const nextEligibleAt = new Date(nowMs + cooldownMs).toISOString();

    const todayKey = getLocalDayKey(nowMs, 'Asia/Kolkata');
    const normalizedState = normalizeWinterBonusForToday(cloneWinterState(state), todayKey);
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

    if (useDb) {
      const ledgerInsertRes = await fetchJsonStrict(
        `${cfg.url}/rest/v1/winter_reward_ledger`,
        {
          method: 'POST',
          headers: {
            apikey: cfg.key,
            Authorization: `Bearer ${cfg.key}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            id: rewardId,
            user_id: params.user.id,
            feature_type: 'spin_wheel',
            idempotency_key: idemp,
            status: 'applied',
            rarity: segment.rarity,
            segment_index: segment.index,
            reward_label: segment.label,
            xp_bonus: segment.xpBonus,
            cookies_bonus: segment.cookiesBonus,
            ai_bonus_queries: grantedAiBonus,
            streak_shield: segment.streakShield,
            badge_id: segment.badgeId || null,
            frame_id: segment.frameId || null,
            created_at: nowIso,
            applied_at: nowIso,
          }),
        },
        'insert spin_wheel ledger'
      );

      if (!ledgerInsertRes.ok) {
        const errText = await ledgerInsertRes.text().catch(() => '');
        if (isUniqueViolationResponse(ledgerInsertRes.status, errText)) {
          const reloaded = await loadUserWinterState(params.getSupabaseServerConfig, params.user);
          const sameSpin = reloaded.rewardHistory.find(
            r => r.featureType === 'spin_wheel' && r.idempotencyKey === idemp
          );
          if (sameSpin) {
            const nextMs = reloaded.spinNextEligibleAt ? new Date(reloaded.spinNextEligibleAt).getTime() : 0;
            return {
              statusCode: 200,
              body: {
                success: true,
                idempotentHit: true,
                segmentIndex: sameSpin.segmentIndex ?? 0,
                reward: sameSpin,
                nextEligibleAt: reloaded.spinNextEligibleAt,
                remainingMs: Math.max(0, nextMs - nowMs),
                cooldownMs,
                winterState: reloaded,
              },
            };
          }
          return {
            statusCode: 409,
            body: { success: false, code: 'DUPLICATE_SPIN', error: 'Duplicate spin attempt rejected.' },
          };
        }
        throw new WinterPersistenceError(
          `Failed to record Spin Wheel reward in Supabase (${ledgerInsertRes.status}): ${errText || ledgerInsertRes.statusText}`,
          503
        );
      }
    }

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

    let persistedState: UserWinterState;
    try {
      persistedState = await saveUserWinterState(params.getSupabaseServerConfig, normalizedState);
    } catch (saveErr) {
      if (useDb) {
        await fetchJsonStrict(
          `${cfg.url}/rest/v1/winter_reward_ledger?id=eq.${encodeURIComponent(rewardId)}`,
          { method: 'DELETE', headers: { apikey: cfg.key, Authorization: `Bearer ${cfg.key}` } },
          'rollback spin reward ledger'
        ).catch(() => {});
      }
      throw saveErr;
    }

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

    const reloadedState = await loadUserWinterState(params.getSupabaseServerConfig, params.user);

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
        winterState: reloadedState || persistedState,
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
  forceSupabaseInTests = false;
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

function handleWinterRouteError(res: express.Response, err: any, fallbackMessage: string) {
  if (err instanceof WinterPersistenceError) {
    return res.status(err.statusCode).json({
      success: false,
      code: err.code,
      error: err.message,
    });
  }
  return res.status(500).json({
    success: false,
    code: 'WINTER_INTERNAL_ERROR',
    error: err?.message || fallbackMessage,
  });
}

async function hasAcademicEngagementInDb(cfg: { url: string; key: string }, userId: string): Promise<boolean> {
  const headers = { apikey: cfg.key, Authorization: `Bearer ${cfg.key}` };
  const encUid = encodeURIComponent(userId);
  const [ledRes, profRes, gdRes] = await Promise.all([
    fetchJsonStrict(
      `${cfg.url}/rest/v1/gamification_xp_ledger?user_id=eq.${encUid}&source_type=eq.academic&select=id&limit=1`,
      { headers },
      'check academic ledger'
    ),
    fetchJsonStrict(
      `${cfg.url}/rest/v1/user_profiles?or=(id.eq.${encUid},uid.eq.${encUid})&select=points&limit=2`,
      { headers },
      'check academic user_profiles'
    ).catch(() => null),
    fetchJsonStrict(
      `${cfg.url}/rest/v1/global_data?id=eq.${encodeURIComponent(`gamification_user_${userId}`)}&select=data`,
      { headers },
      'check academic global_data'
    ).catch(() => null),
  ]);

  if (!ledRes.ok) {
    throw new WinterPersistenceError(`Failed to verify academic ledger (${ledRes.status})`, 503);
  }
  const ledRows = await ledRes.json();
  if (Array.isArray(ledRows) && ledRows.length > 0) return true;

  if (profRes && profRes.ok) {
    const profRows = await profRes.json();
    if (Array.isArray(profRows) && profRows.some((p: any) => Number(p?.points || 0) > 0)) return true;
  }

  if (gdRes && gdRes.ok) {
    const gdRows = await gdRes.json();
    if (Number(gdRows?.[0]?.data?.xp || 0) > 0) return true;
  }

  return false;
}

export function registerWinterFestivalAndLeaderboardRoutes(app: express.Express, deps: WinterModuleDeps) {
  const { getVerifiedUserFromRequest, requireFeatureAccess, broadcastToAllWs } = deps;
  const getSupabaseServerConfig = () => resolveWinterSupabaseConfig(deps.getSupabaseServerConfig);

  app.get('/api/winter/status', async (req, res) => {
    try {
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
    } catch (err) {
      return handleWinterRouteError(res, err, 'Failed to load Winter Festival status.');
    }
  });

  app.post('/api/winter/quiz/submit', requireFeatureAccess('winter_festival_tasks'), async (req, res) => {
    try {
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
      let state = await loadUserWinterState(getSupabaseServerConfig, actor);
      if (passed && !state.quizCompleted) {
        state.quizCompleted = true;
        state = await saveUserWinterState(getSupabaseServerConfig, state);
      }

      return res.json({
        success: true,
        passed,
        correctCount,
        total: WINTER_QUIZ_QUESTIONS.length,
        results,
        winterState: state,
      });
    } catch (err) {
      return handleWinterRouteError(res, err, 'Failed to save Winter Knowledge Check.');
    }
  });

  app.post('/api/winter/tasks/:taskId/claim', requireFeatureAccess('winter_festival_tasks'), async (req, res) => {
    const actor = await getVerifiedUserFromRequest(req);
    if (!actor) return res.status(401).json({ success: false, error: 'Authentication required.' });

    const taskId = String(req.params.taskId || '').trim();
    const taskDef = WINTER_FESTIVAL_TASKS.find(t => t.id === taskId);
    if (!taskDef) {
      return res.status(404).json({ success: false, error: 'Winter task not found.' });
    }

    const lockKey = `task:${actor.id}:${taskId}`;
    if (inFlightClaimLocks.has(lockKey)) {
      return res.status(409).json({
        success: false,
        code: 'TASK_CLAIM_IN_PROGRESS',
        error: 'Task claim already in progress. Please wait.',
      });
    }

    inFlightClaimLocks.add(lockKey);
    try {
      const cfg = getSupabaseServerConfig();
      const useDb = shouldUseSupabase(cfg);
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
        const hasMemAcademic = memoryXpLedger.some(
          x => x.userId === actor.id && x.sourceType === 'academic'
        ) || (memoryUserTotalXp.get(actor.id)?.xp || 0) > 0;
        const hasDbAcademic = useDb ? await hasAcademicEngagementInDb(cfg, actor.id) : false;
        if (!hasMemAcademic && !hasDbAcademic) {
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
      const claimRowId = `wtc_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

      // Insert winter_task_claims FIRST without merge-duplicates so concurrent requests collide on UNIQUE(user_id, task_id)
      if (useDb) {
        const claimInsertRes = await fetchJsonStrict(
          `${cfg.url}/rest/v1/winter_task_claims`,
          {
            method: 'POST',
            headers: {
              apikey: cfg.key,
              Authorization: `Bearer ${cfg.key}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              id: claimRowId,
              user_id: actor.id,
              task_id: taskId,
              xp_awarded: taskDef.xpReward,
              cookies_awarded: taskDef.cookiesReward,
              claimed_at: nowIso,
            }),
          },
          'insert winter_task_claims'
        );

        if (!claimInsertRes.ok) {
          const errText = await claimInsertRes.text().catch(() => '');
          if (isUniqueViolationResponse(claimInsertRes.status, errText)) {
            return res.status(409).json({
              success: false,
              code: 'TASK_ALREADY_CLAIMED',
              error: 'You have already claimed rewards for this seasonal task.',
            });
          }
          throw new WinterPersistenceError(
            `Failed to record Winter task claim (${claimInsertRes.status}): ${errText || claimInsertRes.statusText}`,
            503
          );
        }
      }

      const nextState = cloneWinterState(state);
      nextState.claimedTaskIds.push(taskId);
      nextState.cookiesCount += taskDef.cookiesReward;
      if (taskDef.badgeId && isFeatureAccessibleForActor('winter_badges', actor.role, true)) {
        if (!nextState.earnedWinterBadges[taskDef.badgeId]) {
          nextState.earnedWinterBadges[taskDef.badgeId] = nowIso;
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
      nextState.rewardHistory = [rewardRecord, ...nextState.rewardHistory].slice(0, 60);

      let persistedState: UserWinterState;
      try {
        persistedState = await saveUserWinterState(getSupabaseServerConfig, nextState);
      } catch (saveErr) {
        if (useDb) {
          await fetchJsonStrict(
            `${cfg.url}/rest/v1/winter_task_claims?id=eq.${encodeURIComponent(claimRowId)}`,
            { method: 'DELETE', headers: { apikey: cfg.key, Authorization: `Bearer ${cfg.key}` } },
            'rollback winter task claim'
          ).catch(() => {});
        }
        throw saveErr;
      }

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
        winterState: persistedState,
      });
    } catch (err) {
      return handleWinterRouteError(res, err, 'Failed to claim Winter task reward.');
    } finally {
      inFlightClaimLocks.delete(lockKey);
    }
  });

  app.post('/api/winter/santa/claim', requireFeatureAccess('winter_santa_gifts'), async (req, res) => {
    try {
      const actor = await getVerifiedUserFromRequest(req);
      if (!actor) return res.status(401).json({ success: false, error: 'Authentication required.' });

      const idempotencyKey = String(req.body?.idempotencyKey || '');
      const isPreview = Boolean(req.body?.isPreview);
      const result = await executeSantaGiftClaim({
        user: actor,
        idempotencyKey,
        isPreview,
        getSupabaseServerConfig,
      });

      if (result.statusCode === 200 && !result.body.alreadyClaimed && !result.body.isPreview) {
        broadcastToAllWs({
          type: 'leaderboard:updated',
          userId: actor.id,
          role: actor.role,
        });
      }

      return res.status(result.statusCode).json(result.body);
    } catch (err) {
      return handleWinterRouteError(res, err, 'Failed to unwrap Santa gift.');
    }
  });

  app.post('/api/winter/santa/recover', requireFeatureAccess('winter_santa_gifts'), async (req, res) => {
    try {
      const actor = await getVerifiedUserFromRequest(req);
      if (!actor) return res.status(401).json({ success: false, error: 'Authentication required.' });

      const cfg = getSupabaseServerConfig();
      let state = await loadUserWinterState(getSupabaseServerConfig, actor);
      const pending = state.rewardHistory.find(
        r => r.featureType === 'santa_gift' && r.status === 'pending_apply'
      );
      if (!pending) {
        return res.json({ success: true, recovered: false, winterState: state });
      }

      pending.status = 'recovered';
      pending.appliedAt = new Date().toISOString();
      state = await saveUserWinterState(getSupabaseServerConfig, state);
      if (shouldUseSupabase(cfg)) {
        await fetchJsonStrict(
          `${cfg.url}/rest/v1/winter_reward_ledger?id=eq.${encodeURIComponent(pending.id)}`,
          {
            method: 'PATCH',
            headers: { apikey: cfg.key, Authorization: `Bearer ${cfg.key}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'recovered', applied_at: pending.appliedAt }),
          },
          'recover pending santa row'
        );
      }
      return res.json({ success: true, recovered: true, reward: pending, winterState: state });
    } catch (err) {
      return handleWinterRouteError(res, err, 'Failed to recover pending Santa gift.');
    }
  });

  app.post('/api/winter/spin', requireFeatureAccess('winter_spin_wheel'), async (req, res) => {
    try {
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
    } catch (err) {
      return handleWinterRouteError(res, err, 'Failed to execute Winter Spin Wheel.');
    }
  });

  app.post('/api/winter/spin/notified', async (req, res) => {
    try {
      const actor = await getVerifiedUserFromRequest(req);
      if (!actor) return res.status(401).json({ success: false, error: 'Authentication required.' });

      const cycleKey = String(req.body?.cycleKey || 'initial').slice(0, 80);
      let state = await loadUserWinterState(getSupabaseServerConfig, actor);
      if (state.lastWheelNotifiedCycle !== cycleKey) {
        state.lastWheelNotifiedCycle = cycleKey;
        state = await saveUserWinterState(getSupabaseServerConfig, state);
      }
      return res.json({ success: true, lastWheelNotifiedCycle: state.lastWheelNotifiedCycle });
    } catch (err) {
      return handleWinterRouteError(res, err, 'Failed to update wheel notification state.');
    }
  });

  app.post('/api/winter/profile/frame', async (req, res) => {
    try {
      const actor = await getVerifiedUserFromRequest(req);
      if (!actor) return res.status(401).json({ success: false, error: 'Authentication required.' });

      const frameId = req.body?.frameId ? String(req.body.frameId) : null;
      let state = await loadUserWinterState(getSupabaseServerConfig, actor);
      if (frameId && !state.unlockedFrames.includes(frameId)) {
        return res.status(403).json({ success: false, error: 'Frame not unlocked yet.' });
      }

      state.equippedFrame = frameId;
      state = await saveUserWinterState(getSupabaseServerConfig, state);
      return res.json({ success: true, equippedFrame: state.equippedFrame, winterState: state });
    } catch (err) {
      return handleWinterRouteError(res, err, 'Failed to equip profile frame.');
    }
  });

  app.post('/api/gamification/action', async (req, res) => {
    try {
      const actor = await getVerifiedUserFromRequest(req);
      if (!actor) return res.status(401).json({ success: false, error: 'Authentication required.' });

      const { action, itemId, labelOverride, clientXpOverride, xp, xpAmount, xpDelta, syncedFromClientProfile } = req.body || {};
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

      const cfg = getSupabaseServerConfig();
      const useDb = shouldUseSupabase(cfg);
      let actionsTodayCount = 0;

      if (useDb) {
        const capRes = await fetchJsonStrict(
          `${cfg.url}/rest/v1/gamification_xp_ledger?user_id=eq.${encodeURIComponent(actor.id)}&action_key=like.${encodeURIComponent(actionName + ':*')}&select=id,created_at&order=created_at.desc&limit=50`,
          { headers: { apikey: cfg.key, Authorization: `Bearer ${cfg.key}` } },
          'check daily xp action cap'
        );
        if (!capRes.ok) {
          const errText = await capRes.text().catch(() => '');
          throw new WinterPersistenceError(
            `Failed to verify daily action limit (${capRes.status}): ${errText || capRes.statusText}`,
            503
          );
        }
        const rows = await capRes.json();
        if (Array.isArray(rows)) {
          actionsTodayCount = rows.filter(
            (r: any) => r?.created_at && getLocalDayKey(Date.parse(String(r.created_at))) === todayKey
          ).length;
        }
      } else {
        actionsTodayCount = memoryXpLedger.filter(
          x =>
            x.userId === actor.id &&
            x.actionKey.startsWith(`${actionName}:`) &&
            getLocalDayKey(Date.parse(x.createdAt)) === todayKey
        ).length;
      }

      if (actionsTodayCount >= spec.maxPerDay) {
        return res.status(429).json({
          success: false,
          code: 'DAILY_ACTION_CAP_REACHED',
          error: `Daily limit reached for ${spec.label}.`,
        });
      }

      const nowIso = new Date().toISOString();
      const xpRes = await appendXpLedgerEntry(
        getSupabaseServerConfig,
        {
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
        },
        { alreadyAddedToProfile: Boolean(syncedFromClientProfile) }
      );

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
    } catch (err) {
      return handleWinterRouteError(res, err, 'Failed to record gamification XP action.');
    }
  });

  app.get('/api/leaderboard', async (req, res) => {
    try {
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
      const aliasToCanonicalId = new Map<string, string>();
      const winterProfilesByUser = new Map<string, { cookiesCount: number; equippedFrame: string | null; badgesCount: number }>();

      memoryWinterStates.forEach((w, uid) => {
        winterProfilesByUser.set(uid, {
          cookiesCount: Number(w.cookiesCount || 0),
          equippedFrame: w.equippedFrame || null,
          badgesCount: Object.keys(w.earnedWinterBadges || {}).length,
        });
      });

      let ledgerSnapshot = [...memoryXpLedger];

      const cfg = getSupabaseServerConfig();
      if (shouldUseSupabase(cfg)) {
        const headers = { apikey: cfg.key, Authorization: `Bearer ${cfg.key}` };
        const sinceClause =
          period === 'all_time'
            ? ''
            : `created_at=gte.${encodeURIComponent(
                new Date(Date.now() - (period === 'weekly' ? 7 : 30) * 24 * 60 * 60 * 1000).toISOString()
              )}&`;

        // Query ONLY gamification_xp_ledger with limit=50 for fast loading (never wait on user_profiles, winter_user_profiles, or global_data)
        const ledRes = await fetchJsonStrict(
          `${cfg.url}/rest/v1/gamification_xp_ledger?${sinceClause}select=id,user_id,user_name,user_role,xp_delta,label,created_at&order=created_at.desc&limit=50`,
          { headers },
          'leaderboard gamification_xp_ledger'
        );

        if (!ledRes.ok) {
          const errText = await ledRes.text().catch(() => '');
          if (isMissingColumnOrRelationError(ledRes.status, errText)) {
            throw new WinterPersistenceError(
              `Leaderboard table gamification_xp_ledger is missing or outdated (${errText || ledRes.statusText}). Please run the Winter SQL migration script in Supabase SQL Editor.`,
              503,
              'WINTER_SQL_MIGRATION_REQUIRED'
            );
          }
          throw new WinterPersistenceError(
            `Leaderboard query failed on gamification_xp_ledger (${ledRes.status}): ${errText || ledRes.statusText}`,
            503,
            'LEADERBOARD_PERSISTENCE_ERROR'
          );
        }

        const ledRows = await ledRes.json().catch(() => []);

        if (Array.isArray(ledRows)) {
          const seenIds = new Set(ledgerSnapshot.map((l) => l.id));
          for (const r of ledRows) {
            if (!r?.id || seenIds.has(r.id)) continue;
            const uid = String(r.user_id || '').trim();
            if (!uid || uid.startsWith('__probe_')) continue;
            const role = String(r.user_role || 'student').toLowerCase();
            const name = String(r.user_name || 'Member');

            ledgerSnapshot.push({
              id: String(r.id),
              userId: uid,
              userName: name,
              userRole: role,
              grade: '',
              section: '',
              house: '',
              avatar: '',
              sourceType: 'academic',
              actionKey: String(r.id),
              xpDelta: Number(r.xp_delta || 0),
              label: String(r.label || ''),
              createdAt: String(r.created_at),
            });

            if (!allUsersMap.has(uid)) {
              allUsersMap.set(uid, {
                userId: uid,
                name,
                role,
                grade: '',
                section: '',
                house: '',
                avatar: '',
                xp: 0,
                currentStreak: 0,
                winterCookies: 0,
                equippedFrame: null,
                badgesCount: 0,
                updatedAt: r.created_at || null,
              });
            }
          }
        }
      } else {
        // Pure in-memory test mode
        memoryUserTotalXp.forEach((v, k) => {
          const wState = memoryWinterStates.get(k);
          allUsersMap.set(k, {
            ...v,
            winterCookies: wState?.cookiesCount || 0,
            equippedFrame: wState?.equippedFrame || null,
            badgesCount:
              Object.keys(v.earnedBadges || {}).length +
              Object.keys(wState?.earnedWinterBadges || {}).length,
          });
        });

        if (deps.getGamificationStore) {
          const gStore = deps.getGamificationStore();
          Object.values(gStore || {}).forEach((g: any) => {
            const uid = String(g?.userId || g?.id || '');
            if (!uid) return;
            const existing = allUsersMap.get(uid);
            const wState = memoryWinterStates.get(uid);
            allUsersMap.set(uid, {
              userId: uid,
              name: String(g.userName || g.name || existing?.name || 'Member'),
              role: String(g.role || existing?.role || 'student').toLowerCase(),
              grade: String(g.grade || existing?.grade || ''),
              section: String(g.section || existing?.section || ''),
              house: String(g.house || existing?.house || ''),
              avatar: String(g.avatar || g.photoURL || existing?.avatar || ''),
              xp: Math.max(Number(g.xp || 0), existing?.xp || 0),
              currentStreak: Math.max(Number(g.currentStreak || 0), existing?.currentStreak || 0),
              winterCookies: wState?.cookiesCount || 0,
              equippedFrame: wState?.equippedFrame || null,
              badgesCount:
                Object.keys(g.earnedBadges || existing?.earnedBadges || {}).length +
                Object.keys(wState?.earnedWinterBadges || {}).length,
              updatedAt: g.updatedAt || existing?.updatedAt,
            });
          });
        }
      }

      const rankings = buildSeparatedLeaderboard({
        entries: ledgerSnapshot,
        allTimeUsers: Array.from(allUsersMap.values()),
        type: lbType,
        period,
      });

      const canonActorId = actor ? aliasToCanonicalId.get(actor.id) || actor.id : '';
      const currentUserEntry = actor ? rankings.find(r => r.userId === canonActorId || r.userId === actor.id) || null : null;

      return res.json({
        success: true,
        type: lbType,
        period,
        rankings,
        totalParticipants: rankings.length,
        currentUserEntry,
        generatedAt: new Date().toISOString(),
      });
    } catch (err) {
      return handleWinterRouteError(res, err, 'Failed to load leaderboard.');
    }
  });
}
