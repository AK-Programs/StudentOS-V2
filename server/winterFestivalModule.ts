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
  WINTER_PROFILE_BORDERS,
  WINTER_PROFILE_FRAMES,
  WINTER_QUIZ_QUESTIONS,
  getSantaWindowStatus,
  isValidWinterBorderId,
  isValidWinterFrameId,
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
    authToken?: string;
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
    borderId?: string;
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
    unlockedBorders: [],
    equippedBorder: null,
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
    unlockedBorders: [...(state.unlockedBorders || [])],
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

function isRlsPolicyViolationError(status: number, bodyText: string): boolean {
  const lower = bodyText.toLowerCase();
  return (
    (status === 401 || status === 403) &&
    (bodyText.includes('42501') ||
      lower.includes('row-level security') ||
      lower.includes('insufficient_privilege') ||
      lower.includes('permission denied'))
  );
}

function isMissingColumnOrRelationError(status: number, bodyText: string): boolean {
  const lower = bodyText.toLowerCase();
  return (
    status === 404 ||
    bodyText.includes('PGRST204') ||
    bodyText.includes('PGRST205') ||
    bodyText.includes('PGRST202') ||
    bodyText.includes('42703') ||
    bodyText.includes('42P01') ||
    (lower.includes('column') && (lower.includes('does not exist') || lower.includes('could not find'))) ||
    (lower.includes('relation') && lower.includes('does not exist')) ||
    lower.includes('could not find the table') ||
    lower.includes('could not find the function')
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

function evaluateSecretWinterBadges(state: UserWinterState, nowIso: string, badgesEnabled: boolean = true) {
  if (!badgesEnabled) return;
  if (
    state.cookiesCount >= 15 &&
    state.claimedTaskIds.length >= 3 &&
    !state.earnedWinterBadges['north_star_secret']
  ) {
    state.earnedWinterBadges['north_star_secret'] = nowIso;
    if (!state.unlockedBorders.includes('golden_festival_border')) {
      state.unlockedBorders.push('golden_festival_border');
    }
  } else if (
    state.earnedWinterBadges['north_star_secret'] &&
    !state.unlockedBorders.includes('golden_festival_border')
  ) {
    state.unlockedBorders.push('golden_festival_border');
  }
}

function mapLedgerRowToHistoryItem(r: any): UserWinterState['rewardHistory'][number] {
  const extra =
    (r.metadata && typeof r.metadata === 'object' ? r.metadata : null) ||
    (r.reward_payload && typeof r.reward_payload === 'object' ? r.reward_payload : {});
  return {
    id: String(r.id),
    featureType: (r.feature_type || 'spin_wheel') as 'santa_gift' | 'spin_wheel' | 'winter_task',
    idempotencyKey: String(r.idempotency_key || r.id),
    eventNightKey: r.event_night_key
      ? String(r.event_night_key)
      : extra.eventNightKey
      ? String(extra.eventNightKey)
      : undefined,
    status: (r.status || 'applied') as 'pending_apply' | 'applied' | 'recovered',
    rarity: String(r.rarity || extra.rarity || 'common'),
    segmentIndex:
      typeof r.segment_index === 'number'
        ? r.segment_index
        : typeof extra.segmentIndex === 'number'
        ? extra.segmentIndex
        : undefined,
    label: String(r.reward_label || extra.label || extra.reward_label || ''),
    xpBonus: Number(r.xp_bonus ?? extra.xpBonus ?? 0),
    cookiesBonus: Number(r.cookies_bonus ?? extra.cookiesBonus ?? 0),
    aiBonusQueries: Number(r.ai_bonus_queries ?? extra.aiBonusQueries ?? 0),
    streakShield: Boolean(r.streak_shield ?? extra.streakShield),
    badgeId: r.badge_id ? String(r.badge_id) : extra.badgeId ? String(extra.badgeId) : undefined,
    frameId: r.frame_id ? String(r.frame_id) : extra.frameId ? String(extra.frameId) : undefined,
    borderId: r.border_id ? String(r.border_id) : extra.borderId ? String(extra.borderId) : undefined,
    createdAt: String(r.created_at || new Date().toISOString()),
    appliedAt: r.applied_at ? String(r.applied_at) : undefined,
  };
}

async function insertWinterRewardLedgerRow(
  cfg: { url: string; key: string },
  fullRow: Record<string, any>,
  minimalRow: Record<string, any>,
  bareRow: Record<string, any>,
  contextLabel: string
): Promise<{ ok: boolean; status: number; errText: string; isUnique: boolean }> {
  const headers = {
    apikey: cfg.key,
    Authorization: `Bearer ${cfg.key}`,
    'Content-Type': 'application/json',
  };

  let res = await fetchJsonStrict(
    `${cfg.url}/rest/v1/winter_reward_ledger`,
    { method: 'POST', headers, body: JSON.stringify(fullRow) },
    contextLabel
  );
  if (res.ok) {
    return { ok: true, status: res.status, errText: '', isUnique: false };
  }

  let errText = await res.text().catch(() => '');
  if (isUniqueViolationResponse(res.status, errText)) {
    return { ok: false, status: res.status, errText, isUnique: true };
  }

  // Fallback if extended columns (e.g. reward_label, metadata) are not yet added to winter_reward_ledger
  if (isMissingColumnOrRelationError(res.status, errText)) {
    res = await fetchJsonStrict(
      `${cfg.url}/rest/v1/winter_reward_ledger`,
      { method: 'POST', headers, body: JSON.stringify(minimalRow) },
      `${contextLabel} (fallback payload)`
    );
    if (res.ok) {
      return { ok: true, status: res.status, errText: '', isUnique: false };
    }
    errText = await res.text().catch(() => errText);
    if (isUniqueViolationResponse(res.status, errText)) {
      return { ok: false, status: res.status, errText, isUnique: true };
    }

    if (isMissingColumnOrRelationError(res.status, errText)) {
      res = await fetchJsonStrict(
        `${cfg.url}/rest/v1/winter_reward_ledger`,
        { method: 'POST', headers, body: JSON.stringify(bareRow) },
        `${contextLabel} (bare payload)`
      );
      if (res.ok) {
        return { ok: true, status: res.status, errText: '', isUnique: false };
      }
      errText = await res.text().catch(() => errText);
      if (isUniqueViolationResponse(res.status, errText)) {
        return { ok: false, status: res.status, errText, isUnique: true };
      }
    }
  }

  return { ok: false, status: res.status, errText, isUnique: false };
}

export async function loadUserWinterState(
  getSupabaseServerConfig: WinterModuleDeps['getSupabaseServerConfig'],
  user: { id: string; name: string; role: string; isVerifiedJwt?: boolean; authToken?: string }
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
  const actorAuthHeaders =
    user.isVerifiedJwt && user.authToken
      ? { apikey: cfg.key, Authorization: `Bearer ${user.authToken}` }
      : headers;
  const encUid = encodeURIComponent(user.id);

  // Use select=* on winter_reward_ledger so missing optional columns (like reward_label or border_id before SQL migration)
  // never cause a 400 error, and keep ledger/task/badge auxiliary reads non-fatal so winter status always returns.
  const [wpRes, claimsRes, badgesRes, ledgerRes] = await Promise.all([
    fetchJsonStrict(`${cfg.url}/rest/v1/winter_user_profiles?user_id=eq.${encUid}&select=*`, { headers }, 'load winter_user_profiles'),
    fetchJsonStrict(`${cfg.url}/rest/v1/winter_task_claims?user_id=eq.${encUid}&select=task_id,claimed_at`, { headers: actorAuthHeaders }, 'load winter_task_claims').catch(() => null),
    fetchJsonStrict(`${cfg.url}/rest/v1/winter_user_badges?user_id=eq.${encUid}&select=badge_id,unlocked_at`, { headers: actorAuthHeaders }, 'load winter_user_badges').catch(() => null),
    fetchJsonStrict(
      `${cfg.url}/rest/v1/winter_reward_ledger?user_id=eq.${encUid}&select=*&order=created_at.desc&limit=60`,
      { headers },
      'load winter_reward_ledger'
    ).catch(() => null),
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

  const wpRows = await wpRes.json().catch(() => []);
  const claimRows =
    claimsRes && claimsRes.ok ? await claimsRes.json().catch(() => []) : [];
  const badgeRows =
    badgesRes && badgesRes.ok ? await badgesRes.json().catch(() => []) : [];
  let ledgerRows: any[] = [];
  if (ledgerRes && ledgerRes.ok) {
    const parsedLedger = await ledgerRes.json().catch(() => []);
    if (Array.isArray(parsedLedger)) ledgerRows = parsedLedger;
  } else if (ledgerRes && !ledgerRes.ok) {
    const errText = await ledgerRes.text().catch(() => '');
    console.warn(`[WINTER] Non-fatal winter_reward_ledger read warning (${ledgerRes.status}): ${errText || ledgerRes.statusText}`);
  }

  let merged: UserWinterState = getDefaultWinterState(user);

  if (Array.isArray(wpRows) && wpRows[0]) {
    const r = wpRows[0];
    const storedState = r.state_json && typeof r.state_json === 'object' ? r.state_json : {};
    const dbFrames = Array.isArray(r.unlocked_frames) ? r.unlocked_frames : [];
    const storedFrames = Array.isArray(storedState.unlockedFrames) ? storedState.unlockedFrames : [];
    const dbBorders = Array.isArray(r.unlocked_borders) ? r.unlocked_borders : [];
    const storedBorders = Array.isArray(storedState.unlockedBorders) ? storedState.unlockedBorders : [];
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
      unlockedBorders: Array.from(new Set([...storedBorders, ...dbBorders])),
      equippedBorder: r.equipped_border !== undefined ? r.equipped_border : (storedState.equippedBorder || null),
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
            unlockedBorders: Array.isArray(remote.unlockedBorders) ? remote.unlockedBorders : [],
            equippedBorder: remote.equippedBorder ?? null,
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
    const bordersSet = new Set<string>(merged.unlockedBorders || []);
    const historyById = new Map<string, UserWinterState['rewardHistory'][number]>();
    for (const h of merged.rewardHistory || []) {
      if (h?.id) historyById.set(h.id, h);
    }
    for (const r of ledgerRows) {
      const mapped = mapLedgerRowToHistoryItem(r);
      if (r?.feature_type === 'santa_gift' && r?.event_night_key && !nightsMap[r.event_night_key]) {
        nightsMap[String(r.event_night_key)] = String(r.id);
      }
      if (r?.status === 'applied' && mapped.badgeId && !badgesMap[mapped.badgeId]) {
        badgesMap[mapped.badgeId] = String(r.applied_at || r.created_at || new Date().toISOString());
      }
      if (r?.status === 'applied' && mapped.frameId) {
        framesSet.add(mapped.frameId);
      }
      if (r?.status === 'applied' && mapped.borderId) {
        bordersSet.add(mapped.borderId);
      }
      if (r?.id && !historyById.has(mapped.id)) {
        historyById.set(mapped.id, mapped);
      }
    }
    merged.santaClaimedNights = nightsMap;
    merged.earnedWinterBadges = badgesMap;
    merged.unlockedFrames = Array.from(framesSet);
    merged.unlockedBorders = Array.from(bordersSet);
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
  badges: Record<string, string>,
  actorAuthToken?: string
): Promise<void> {
  const entries = Object.entries(badges || {});
  if (entries.length === 0) return;
  const bearer = actorAuthToken || cfg.key;
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
        Authorization: `Bearer ${bearer}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=ignore-duplicates',
      },
      body: JSON.stringify(payload),
    },
    'sync winter_user_badges'
  );
  if (res.ok) return;

  const errText = await res.text().catch(() => '');
  if (isUniqueViolationResponse(res.status, errText)) return;

  if (isRlsPolicyViolationError(res.status, errText)) {
    // Fallback to hardened SECURITY DEFINER RPC (sync_winter_badge_secure)
    let rpcBlocked = false;
    for (const row of payload) {
      const rpcRes = await fetchJsonStrict(
        `${cfg.url}/rest/v1/rpc/sync_winter_badge_secure`,
        {
          method: 'POST',
          headers: {
            apikey: cfg.key,
            Authorization: `Bearer ${bearer}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            p_row_id: row.id,
            p_user_id: row.user_id,
            p_badge_id: row.badge_id,
            p_rarity: row.rarity,
            p_unlocked_at: row.unlocked_at,
          }),
        },
        'rpc sync_winter_badge_secure'
      ).catch(() => null);
      if (!rpcRes || !rpcRes.ok) {
        const rpcErr = rpcRes ? await rpcRes.text().catch(() => '') : '';
        if (rpcRes && isUniqueViolationResponse(rpcRes.status, rpcErr)) continue;
        rpcBlocked = true;
        console.warn(`[WINTER] winter_user_badges RPC sync warning (${rpcRes?.status || 'net'}): ${rpcErr}`);
      }
    }
    if (!rpcBlocked) return;
    // Note: winter_user_profiles.earned_winter_badges is already durably saved cleanly above;
    // avoid crashing Spin/Santa saves when live SQL migration hasn't created sync_winter_badge_secure yet.
    return;
  }

  throw new WinterPersistenceError(`Failed to persist Winter badges (${res.status})`, 503);
}

async function syncCosmeticsToLeaderboardDoc(
  cfg: { url: string; key: string },
  state: UserWinterState
): Promise<void> {
  try {
    const docId = `gamification_user_${state.userId}`;
    const headers = { apikey: cfg.key, Authorization: `Bearer ${cfg.key}` };
    const gdRes = await fetchJsonStrict(
      `${cfg.url}/rest/v1/global_data?id=eq.${encodeURIComponent(docId)}&select=id,data`,
      { headers },
      'read gamification doc for cosmetic sync'
    ).catch(() => null);
    if (!gdRes || !gdRes.ok) return;
    const rows = await gdRes.json().catch(() => []);
    const existingDoc = rows?.[0]?.data && typeof rows[0].data === 'object' ? rows[0].data : {};
    await fetchJsonStrict(
      `${cfg.url}/rest/v1/global_data?on_conflict=id`,
      {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates' },
        body: JSON.stringify({
          id: docId,
          data: {
            ...existingDoc,
            userId: state.userId,
            userName: state.userName || existingDoc.userName || 'Member',
            role: state.userRole || existingDoc.role || 'student',
            equippedFrame: state.equippedFrame,
            equippedBorder: state.equippedBorder,
            winterCookies: state.cookiesCount,
            badgesCount: Math.max(
              Object.keys(existingDoc.earnedBadges || {}).length + Object.keys(state.earnedWinterBadges || {}).length,
              Number(existingDoc.badgesCount || 0)
            ),
            updatedAt: existingDoc.updatedAt || state.updatedAt,
          },
          updated_at: new Date().toISOString(),
        }),
      },
      'sync cosmetics to gamification_user doc'
    ).catch(() => {});
  } catch (_) {}
}

export async function saveUserWinterState(
  getSupabaseServerConfig: WinterModuleDeps['getSupabaseServerConfig'],
  state: UserWinterState,
  options?: { actorAuthToken?: string; badgesEnabled?: boolean; syncLeaderboardCosmetics?: boolean }
): Promise<UserWinterState> {
  const nextState = cloneWinterState(state);
  nextState.updatedAt = new Date().toISOString();
  const badgesEnabled =
    options?.badgesEnabled ?? isFeatureAccessibleForActor('winter_badges', nextState.userRole, true);
  evaluateSecretWinterBadges(nextState, nextState.updatedAt, badgesEnabled);

  const cfg = resolveWinterSupabaseConfig(getSupabaseServerConfig);
  if (!shouldUseSupabase(cfg)) {
    memoryWinterStates.set(nextState.userId, cloneWinterState(nextState));
    return nextState;
  }

  const basePayload: Record<string, any> = {
    user_id: nextState.userId,
    user_name: nextState.userName,
    user_role: nextState.userRole,
    cookies_count: nextState.cookiesCount,
    streak_shields: nextState.streakShields,
    unlocked_frames: nextState.unlockedFrames,
    equipped_frame: nextState.equippedFrame,
    unlocked_borders: nextState.unlockedBorders,
    equipped_border: nextState.equippedBorder,
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
  };

  const headers = {
    apikey: cfg.key,
    Authorization: `Bearer ${cfg.key}`,
    'Content-Type': 'application/json',
    Prefer: 'resolution=merge-duplicates',
  };

  let res = await fetchJsonStrict(
    `${cfg.url}/rest/v1/winter_user_profiles?on_conflict=user_id`,
    {
      method: 'POST',
      headers,
      body: JSON.stringify(basePayload),
    },
    'save winter_user_profiles'
  );

  if (!res.ok) {
    let errText = await res.text().catch(() => '');
    const lowerErr = errText.toLowerCase();
    // Graceful additive fallback ONLY if the new border columns aren't added yet; state_json preserves unlockedBorders & equippedBorder cleanly
    if (
      isMissingColumnOrRelationError(res.status, errText) &&
      (lowerErr.includes('unlocked_borders') || lowerErr.includes('equipped_border'))
    ) {
      const legacyPayload = { ...basePayload };
      delete legacyPayload.unlocked_borders;
      delete legacyPayload.equipped_border;
      res = await fetchJsonStrict(
        `${cfg.url}/rest/v1/winter_user_profiles?on_conflict=user_id`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify(legacyPayload),
        },
        'save winter_user_profiles (state_json border fallback)'
      );
      if (!res.ok) {
        errText = await res.text().catch(() => errText);
      }
    }

    if (!res.ok) {
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
  }

  await syncEarnedBadgesTable(cfg, nextState.userId, nextState.earnedWinterBadges, options?.actorAuthToken);
  if (options?.syncLeaderboardCosmetics) {
    await syncCosmeticsToLeaderboardDoc(cfg, nextState);
  }
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
  return ['teacher', 'coordinator', 'hod', 'admin', 'super_admin'].includes(r);
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
    equippedBorder?: string | null;
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
          equippedBorder: null,
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
        equippedBorder: u.equippedBorder || null,
        badgesCount: u.badgesCount || 0,
      };
    });
    rows.sort(
      (a, b) =>
        b.xp - a.xp ||
        b.winterCookies - a.winterCookies ||
        a.name.localeCompare(b.name) ||
        a.userId.localeCompare(b.userId)
    );
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
      equippedBorder: profile?.equippedBorder || null,
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
      equippedBorder: u.equippedBorder || null,
      badgesCount: u.badgesCount || 0,
    });
  }

  const rows = Array.from(rowsMap.values());
  rows.sort(
    (a, b) =>
      b.xp - a.xp ||
      (b.allTimeXp || 0) - (a.allTimeXp || 0) ||
      (b.winterCookies || 0) - (a.winterCookies || 0) ||
      a.name.localeCompare(b.name) ||
      a.userId.localeCompare(b.userId)
  );
  return rows.map((row, idx) => ({ ...row, rank: idx + 1 }));
}

export async function executeSantaGiftClaim(params: {
  user: { id: string; name: string; email?: string; role: string; grade?: string; section?: string; isVerifiedJwt?: boolean; authToken?: string };
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
  const badgesEnabled = isFeatureAccessibleForActor('winter_badges', params.user.role, true);

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
      badgeId: badgesEnabled ? roll.badgeId : undefined,
      frameId: badgesEnabled ? roll.frameId : undefined,
      borderId: badgesEnabled ? roll.borderId : undefined,
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
        const saved = await saveUserWinterState(params.getSupabaseServerConfig, state, {
          actorAuthToken: params.user.authToken,
          badgesEnabled,
        });
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
    const grantedBadgeId = badgesEnabled ? tier.badgeId : undefined;
    const grantedFrameId = badgesEnabled ? tier.frameId : undefined;
    const grantedBorderId = badgesEnabled ? tier.borderId : undefined;

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
      badgeId: grantedBadgeId,
      frameId: grantedFrameId,
      borderId: grantedBorderId,
      createdAt: appliedAtIso,
      appliedAt: appliedAtIso,
    };

    // Insert pending_apply row in winter_reward_ledger FIRST so concurrent multi-instance claims collide at Postgres UNIQUE index
    let ledgerRowPersisted = false;
    if (useDb) {
      const insertResult = await insertWinterRewardLedgerRow(
        cfg,
        {
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
          badge_id: grantedBadgeId || null,
          frame_id: grantedFrameId || null,
          border_id: grantedBorderId || null,
          metadata: record,
          created_at: appliedAtIso,
        },
        {
          id: rewardId,
          user_id: params.user.id,
          feature_type: 'santa_gift',
          idempotency_key: idemp,
          event_night_key: windowStatus.eventNightKey,
          status: 'pending_apply',
          rarity: tier.rarity,
          reward_payload: record,
          created_at: appliedAtIso,
        },
        {
          id: rewardId,
          user_id: params.user.id,
          feature_type: 'santa_gift',
          idempotency_key: idemp,
          event_night_key: windowStatus.eventNightKey,
          status: 'pending_apply',
          rarity: tier.rarity,
          created_at: appliedAtIso,
        },
        'insert pending santa_gift'
      );

      if (!insertResult.ok) {
        if (insertResult.isUnique) {
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
        if (isMissingColumnOrRelationError(insertResult.status, insertResult.errText)) {
          console.warn(
            `[WINTER] Non-fatal winter_reward_ledger santa insert warning (${insertResult.status}): ${insertResult.errText}`
          );
        } else {
          throw new WinterPersistenceError(
            `Failed to reserve Santa gift claim in Supabase (${insertResult.status}): ${insertResult.errText}`,
            503
          );
        }
      } else {
        ledgerRowPersisted = true;
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
    if (grantedBadgeId && !normalizedState.earnedWinterBadges[grantedBadgeId]) {
      normalizedState.earnedWinterBadges[grantedBadgeId] = appliedAtIso;
    }
    if (grantedFrameId && !normalizedState.unlockedFrames.includes(grantedFrameId)) {
      normalizedState.unlockedFrames.push(grantedFrameId);
    }
    if (grantedBorderId && !normalizedState.unlockedBorders.includes(grantedBorderId)) {
      normalizedState.unlockedBorders.push(grantedBorderId);
    }
    normalizedState.santaClaimedNights[windowStatus.eventNightKey] = rewardId;

    record.status = 'applied';
    normalizedState.rewardHistory = [record, ...normalizedState.rewardHistory].slice(0, 60);

    let persistedState: UserWinterState;
    try {
      persistedState = await saveUserWinterState(params.getSupabaseServerConfig, normalizedState, {
        actorAuthToken: params.user.authToken,
        badgesEnabled,
      });
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

    if (useDb && ledgerRowPersisted) {
      const markRes = await fetchJsonStrict(
        `${cfg.url}/rest/v1/winter_reward_ledger?id=eq.${encodeURIComponent(rewardId)}`,
        {
          method: 'PATCH',
          headers: { apikey: cfg.key, Authorization: `Bearer ${cfg.key}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'applied', applied_at: appliedAtIso }),
        },
        'finalize santa ledger applied'
      ).catch(() => null);
      if (markRes && !markRes.ok) {
        const errText = await markRes.text().catch(() => '');
        if (!isMissingColumnOrRelationError(markRes.status, errText)) {
          throw new WinterPersistenceError(
            `Failed to mark Santa gift ledger applied (${markRes.status}): ${errText}`,
            503
          );
        }
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
  user: { id: string; name: string; email?: string; role: string; grade?: string; section?: string; isVerifiedJwt?: boolean; authToken?: string };
  idempotencyKey?: string;
  nowMs?: number;
  isPreview?: boolean;
  getSupabaseServerConfig: WinterModuleDeps['getSupabaseServerConfig'];
}): Promise<{
  statusCode: number;
  body: Record<string, any>;
}> {
  const nowMs = params.nowMs ?? Date.now();
  const feature = getFeatureRecord('winter_spin_wheel');
  const cooldownMs = Number(feature?.config?.cooldownMs ?? SPIN_WHEEL_COOLDOWN_MS);
  const badgesEnabled = isFeatureAccessibleForActor('winter_badges', params.user.role, true);

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
          error: 'Only Super Admins can run a Spin Wheel preview.',
        },
      };
    }
    const segment = rollSpinWheelSegment();
    const nowIso = new Date(nowMs).toISOString();
    const previewReward = {
      id: `preview_spin_${nowMs}`,
      featureType: 'spin_wheel' as const,
      idempotencyKey: `preview_${nowMs}`,
      status: 'applied' as const,
      rarity: segment.rarity,
      segmentIndex: segment.index,
      label: segment.label,
      xpBonus: segment.xpBonus,
      cookiesBonus: segment.cookiesBonus,
      aiBonusQueries: segment.aiBonusQueries,
      streakShield: segment.streakShield,
      badgeId: badgesEnabled ? segment.badgeId : undefined,
      frameId: badgesEnabled ? segment.frameId : undefined,
      borderId: badgesEnabled ? segment.borderId : undefined,
      createdAt: nowIso,
      appliedAt: nowIso,
    };
    return {
      statusCode: 200,
      body: {
        success: true,
        isPreview: true,
        segmentIndex: segment.index,
        segment,
        reward: previewReward,
        cooldownMs,
        remainingMs: 0,
        message: 'Super Admin Preview: Simulated Spin Wheel roll without mutating cooldown, XP, or collectibles.',
      },
    };
  }

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
    const grantedBadgeId = badgesEnabled ? segment.badgeId : undefined;
    const grantedFrameId = badgesEnabled ? segment.frameId : undefined;
    const grantedBorderId = badgesEnabled ? segment.borderId : undefined;

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
      badgeId: grantedBadgeId,
      frameId: grantedFrameId,
      borderId: grantedBorderId,
      createdAt: nowIso,
      appliedAt: nowIso,
    };

    if (useDb) {
      const insertResult = await insertWinterRewardLedgerRow(
        cfg,
        {
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
          badge_id: grantedBadgeId || null,
          frame_id: grantedFrameId || null,
          border_id: grantedBorderId || null,
          metadata: record,
          created_at: nowIso,
          applied_at: nowIso,
        },
        {
          id: rewardId,
          user_id: params.user.id,
          feature_type: 'spin_wheel',
          idempotency_key: idemp,
          status: 'applied',
          rarity: segment.rarity,
          segment_index: segment.index,
          reward_payload: record,
          created_at: nowIso,
          applied_at: nowIso,
        },
        {
          id: rewardId,
          user_id: params.user.id,
          feature_type: 'spin_wheel',
          idempotency_key: idemp,
          status: 'applied',
          rarity: segment.rarity,
          segment_index: segment.index,
          created_at: nowIso,
        },
        'insert spin_wheel ledger'
      );

      if (!insertResult.ok) {
        if (insertResult.isUnique) {
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
        if (isMissingColumnOrRelationError(insertResult.status, insertResult.errText)) {
          console.warn(
            `[WINTER] Non-fatal winter_reward_ledger spin insert warning (${insertResult.status}): ${insertResult.errText}`
          );
        } else {
          throw new WinterPersistenceError(
            `Failed to record Spin Wheel reward in Supabase (${insertResult.status}): ${insertResult.errText}`,
            503
          );
        }
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
    if (grantedBadgeId && !normalizedState.earnedWinterBadges[grantedBadgeId]) {
      normalizedState.earnedWinterBadges[grantedBadgeId] = nowIso;
    }
    if (grantedFrameId && !normalizedState.unlockedFrames.includes(grantedFrameId)) {
      normalizedState.unlockedFrames.push(grantedFrameId);
    }
    if (grantedBorderId && !normalizedState.unlockedBorders.includes(grantedBorderId)) {
      normalizedState.unlockedBorders.push(grantedBorderId);
    }
    normalizedState.lastSpinAt = nowIso;
    normalizedState.spinNextEligibleAt = nextEligibleAt;
    normalizedState.rewardHistory = [record, ...normalizedState.rewardHistory].slice(0, 60);

    let persistedState: UserWinterState;
    try {
      persistedState = await saveUserWinterState(params.getSupabaseServerConfig, normalizedState, {
        actorAuthToken: params.user.authToken,
        badgesEnabled,
      });
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
        borders: WINTER_PROFILE_BORDERS,
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
        state = await saveUserWinterState(getSupabaseServerConfig, state, {
          actorAuthToken: actor.authToken,
          badgesEnabled: isFeatureAccessibleForActor('winter_badges', actor.role, true),
        });
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
      const claimBearer = actor.isVerifiedJwt && actor.authToken ? actor.authToken : cfg.key;
      let claimViaRpc = false;

      // Insert winter_task_claims FIRST (with verified JWT if available, or hardened RPC on RLS 42501)
      // so concurrent requests collide atomically on UNIQUE(user_id, task_id).
      if (useDb) {
        const claimInsertRes = await fetchJsonStrict(
          `${cfg.url}/rest/v1/winter_task_claims`,
          {
            method: 'POST',
            headers: {
              apikey: cfg.key,
              Authorization: `Bearer ${claimBearer}`,
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

          if (isRlsPolicyViolationError(claimInsertRes.status, errText)) {
            const rpcRes = await fetchJsonStrict(
              `${cfg.url}/rest/v1/rpc/claim_winter_task_secure`,
              {
                method: 'POST',
                headers: {
                  apikey: cfg.key,
                  Authorization: `Bearer ${claimBearer}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  p_claim_id: claimRowId,
                  p_user_id: actor.id,
                  p_task_id: taskId,
                  p_xp_awarded: taskDef.xpReward,
                  p_cookies_awarded: taskDef.cookiesReward,
                  p_claimed_at: nowIso,
                }),
              },
              'rpc claim_winter_task_secure'
            );

            if (!rpcRes.ok) {
              const rpcErr = await rpcRes.text().catch(() => '');
              if (isUniqueViolationResponse(rpcRes.status, rpcErr)) {
                return res.status(409).json({
                  success: false,
                  code: 'TASK_ALREADY_CLAIMED',
                  error: 'You have already claimed rewards for this seasonal task.',
                });
              }
              if (
                isRlsPolicyViolationError(rpcRes.status, rpcErr) ||
                isMissingColumnOrRelationError(rpcRes.status, rpcErr)
              ) {
                throw new WinterPersistenceError(
                  'Unable to save this task claim because database security permissions (claim_winter_task_secure) require migration setup. No XP or collectibles were granted.',
                  503,
                  'WINTER_TASK_CLAIMS_RLS_BLOCKED'
                );
              }
              throw new WinterPersistenceError(
                'Unable to record Winter task claim at this time. Please retry in a moment.',
                503,
                'WINTER_PERSISTENCE_ERROR'
              );
            }
            claimViaRpc = true;
          } else {
            throw new WinterPersistenceError(
              'Unable to record Winter task claim in database. Please retry in a moment.',
              503,
              'WINTER_PERSISTENCE_ERROR'
            );
          }
        }
      }

      const badgesEnabled = isFeatureAccessibleForActor('winter_badges', actor.role, true);
      const grantedBadgeId = badgesEnabled ? taskDef.badgeId : undefined;
      const grantedBorderId = badgesEnabled ? taskDef.borderId : undefined;

      const nextState = cloneWinterState(state);
      nextState.claimedTaskIds.push(taskId);
      nextState.cookiesCount += taskDef.cookiesReward;
      if (grantedBadgeId && !nextState.earnedWinterBadges[grantedBadgeId]) {
        nextState.earnedWinterBadges[grantedBadgeId] = nowIso;
      }
      if (grantedBorderId && !nextState.unlockedBorders.includes(grantedBorderId)) {
        nextState.unlockedBorders.push(grantedBorderId);
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
        badgeId: grantedBadgeId,
        borderId: grantedBorderId,
        createdAt: nowIso,
        appliedAt: nowIso,
      };
      nextState.rewardHistory = [rewardRecord, ...nextState.rewardHistory].slice(0, 60);

      let persistedState: UserWinterState;
      try {
        persistedState = await saveUserWinterState(getSupabaseServerConfig, nextState, {
          actorAuthToken: actor.authToken,
          badgesEnabled,
        });
      } catch (saveErr) {
        if (useDb) {
          if (claimViaRpc) {
            await fetchJsonStrict(
              `${cfg.url}/rest/v1/rpc/rollback_winter_task_claim_secure`,
              {
                method: 'POST',
                headers: {
                  apikey: cfg.key,
                  Authorization: `Bearer ${claimBearer}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({ p_claim_id: claimRowId, p_user_id: actor.id }),
              },
              'rpc rollback winter task claim'
            ).catch(() => {});
          } else {
            const delRes = await fetchJsonStrict(
              `${cfg.url}/rest/v1/winter_task_claims?id=eq.${encodeURIComponent(claimRowId)}`,
              { method: 'DELETE', headers: { apikey: cfg.key, Authorization: `Bearer ${claimBearer}` } },
              'rollback winter task claim'
            ).catch(() => null);
            if (!delRes || !delRes.ok) {
              await fetchJsonStrict(
                `${cfg.url}/rest/v1/rpc/rollback_winter_task_claim_secure`,
                {
                  method: 'POST',
                  headers: {
                    apikey: cfg.key,
                    Authorization: `Bearer ${claimBearer}`,
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({ p_claim_id: claimRowId, p_user_id: actor.id }),
                },
                'rpc fallback rollback winter task claim'
              ).catch(() => {});
            }
          }
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
      state = await saveUserWinterState(getSupabaseServerConfig, state, {
        actorAuthToken: actor.authToken,
        badgesEnabled: isFeatureAccessibleForActor('winter_badges', actor.role, true),
      });
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
      const isPreview = Boolean(req.body?.isPreview);
      const result = await executeSpinWheel({
        user: actor,
        idempotencyKey,
        isPreview,
        getSupabaseServerConfig,
      });

      if (result.statusCode === 200 && !result.body.idempotentHit && !result.body.isPreview) {
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
        state = await saveUserWinterState(getSupabaseServerConfig, state, {
          actorAuthToken: actor.authToken,
          badgesEnabled: isFeatureAccessibleForActor('winter_badges', actor.role, true),
        });
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

      const rawFrameId = req.body?.frameId;
      const frameId = rawFrameId ? String(rawFrameId).trim() : null;
      if (frameId !== null && !isValidWinterFrameId(frameId)) {
        return res.status(400).json({
          success: false,
          code: 'INVALID_FRAME_ID',
          error: 'Invalid Winter profile frame selection.',
        });
      }

      if (frameId !== null && !isFeatureAccessibleForActor('winter_badges', actor.role, true)) {
        return res.status(403).json({
          success: false,
          code: 'FEATURE_DISABLED',
          error: 'Winter collectibles are currently unavailable.',
        });
      }

      let state = await loadUserWinterState(getSupabaseServerConfig, actor);
      if (frameId && !state.unlockedFrames.includes(frameId)) {
        return res.status(403).json({
          success: false,
          code: 'COLLECTIBLE_NOT_OWNED',
          error: 'Frame not unlocked yet.',
        });
      }

      state.equippedFrame = frameId;
      state = await saveUserWinterState(getSupabaseServerConfig, state, {
        actorAuthToken: actor.authToken,
        badgesEnabled: isFeatureAccessibleForActor('winter_badges', actor.role, true),
        syncLeaderboardCosmetics: true,
      });
      return res.json({ success: true, equippedFrame: state.equippedFrame, winterState: state });
    } catch (err) {
      return handleWinterRouteError(res, err, 'Failed to equip profile frame.');
    }
  });

  app.post('/api/winter/profile/border', async (req, res) => {
    try {
      const actor = await getVerifiedUserFromRequest(req);
      if (!actor) return res.status(401).json({ success: false, error: 'Authentication required.' });

      const rawBorderId = req.body?.borderId;
      const borderId = rawBorderId ? String(rawBorderId).trim() : null;
      if (borderId !== null && !isValidWinterBorderId(borderId)) {
        return res.status(400).json({
          success: false,
          code: 'INVALID_BORDER_ID',
          error: 'Invalid Winter border selection.',
        });
      }

      if (borderId !== null && !isFeatureAccessibleForActor('winter_badges', actor.role, true)) {
        return res.status(403).json({
          success: false,
          code: 'FEATURE_DISABLED',
          error: 'Winter collectibles are currently unavailable.',
        });
      }

      let state = await loadUserWinterState(getSupabaseServerConfig, actor);
      if (borderId && !state.unlockedBorders.includes(borderId)) {
        return res.status(403).json({
          success: false,
          code: 'COLLECTIBLE_NOT_OWNED',
          error: 'Winter border not unlocked yet.',
        });
      }

      state.equippedBorder = borderId;
      state = await saveUserWinterState(getSupabaseServerConfig, state, {
        actorAuthToken: actor.authToken,
        badgesEnabled: isFeatureAccessibleForActor('winter_badges', actor.role, true),
        syncLeaderboardCosmetics: true,
      });
      return res.json({ success: true, equippedBorder: state.equippedBorder, winterState: state });
    } catch (err) {
      return handleWinterRouteError(res, err, 'Failed to equip Winter border.');
    }
  });

  app.get('/api/winter/profile/cosmetics/:userId', async (req, res) => {
    try {
      const targetId = String(req.params.userId || '').trim();
      if (!targetId) {
        return res.status(400).json({ success: false, error: 'User ID is required.' });
      }
      const mem = memoryWinterStates.get(targetId);
      if (mem) {
        return res.json({
          success: true,
          userId: targetId,
          equippedFrame: mem.equippedFrame || null,
          equippedBorder: mem.equippedBorder || null,
        });
      }

      const cfg = getSupabaseServerConfig();
      if (shouldUseSupabase(cfg)) {
        const headers = { apikey: cfg.key, Authorization: `Bearer ${cfg.key}` };
        const wpRes = await fetchJsonStrict(
          `${cfg.url}/rest/v1/winter_user_profiles?user_id=eq.${encodeURIComponent(targetId)}&select=equipped_frame,state_json&limit=1`,
          { headers },
          'load public winter cosmetics'
        ).catch(() => null);
        if (wpRes && wpRes.ok) {
          const rows = await wpRes.json().catch(() => []);
          const row = rows?.[0];
          const sJson = row?.state_json && typeof row.state_json === 'object' ? row.state_json : {};
          return res.json({
            success: true,
            userId: targetId,
            equippedFrame: row?.equipped_frame ?? sJson.equippedFrame ?? null,
            equippedBorder: sJson.equippedBorder ?? null,
          });
        }
      }

      return res.json({
        success: true,
        userId: targetId,
        equippedFrame: null,
        equippedBorder: null,
      });
    } catch (err) {
      return handleWinterRouteError(res, err, 'Failed to load profile cosmetics.');
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

      memoryWinterStates.forEach((w, uid) => {
        // Hydrate cosmetics/cookies cleanly when user has active server memory state
        aliasToCanonicalId.set(uid, uid);
      });

      let ledgerSnapshot = [...memoryXpLedger];

      const cfg = getSupabaseServerConfig();
      const mergeAccountStoreObject = (rawKey: string, g: any, fallbackUpdatedAt?: any) => {
        if (!g || typeof g !== 'object') return;
        const rawUid = String(g.userId || g.id || rawKey || '').trim();
        if (!rawUid || rawUid.startsWith('__probe_')) return;
        const uid = aliasToCanonicalId.get(rawUid) || rawUid;
        const existing = allUsersMap.get(uid);
        const gXp = Math.max(0, Number(g.xp || 0));
        const mergedXp = Math.max(gXp, existing?.xp || 0);
        if (mergedXp <= 0 && !existing) return;

        const wState = memoryWinterStates.get(uid);
        const existingTs = existing?.updatedAt ? new Date(existing.updatedAt).getTime() : 0;
        const candidateUpd = g.updatedAt || fallbackUpdatedAt || null;
        const candidateTs = candidateUpd ? new Date(candidateUpd).getTime() : 0;
        const newerUpdatedAt =
          Number.isFinite(candidateTs) && candidateTs > existingTs
            ? candidateUpd
            : existing?.updatedAt || candidateUpd || null;

        allUsersMap.set(uid, {
          userId: uid,
          name: String(g.userName || g.name || existing?.name || 'Member').trim() || 'Member',
          role: String(g.role || existing?.role || 'student').toLowerCase().trim(),
          grade: String(g.grade || existing?.grade || ''),
          section: String(g.section || existing?.section || ''),
          house: String(g.house || existing?.house || ''),
          avatar: String(g.avatar || g.photoURL || existing?.avatar || ''),
          xp: mergedXp,
          currentStreak: Math.max(Number(g.currentStreak || 0), existing?.currentStreak || 0),
          winterCookies: wState?.cookiesCount ?? g.winterCookies ?? existing?.winterCookies ?? 0,
          equippedFrame: wState?.equippedFrame ?? g.equippedFrame ?? existing?.equippedFrame ?? null,
          equippedBorder: wState?.equippedBorder ?? g.equippedBorder ?? existing?.equippedBorder ?? null,
          badgesCount: Math.max(
            Object.keys(g.earnedBadges || {}).length + Object.keys(wState?.earnedWinterBadges || {}).length,
            Number(g.badgesCount || 0),
            existing?.badgesCount || 0
          ),
          updatedAt: newerUpdatedAt,
        });
      };

      if (shouldUseSupabase(cfg)) {
        const headers = { apikey: cfg.key, Authorization: `Bearer ${cfg.key}` };
        const sinceClause =
          period === 'all_time'
            ? ''
            : `created_at=gte.${encodeURIComponent(
                new Date(Date.now() - (period === 'weekly' ? 7 : 30) * 24 * 60 * 60 * 1000).toISOString()
              )}&`;
        const cohortRoleFilter =
          lbType === 'faculty'
            ? 'role=in.(teacher,coordinator,hod,admin,super_admin)&'
            : 'role=eq.student&';

        const fetchOptionalStoreRows = async (url: string, label: string): Promise<any[] | null> => {
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), 3500);
          try {
            const res = await fetchJsonStrict(url, { headers, signal: controller.signal }, label);
            if (!res.ok) return null;
            const parsed = await res.json().catch(() => null);
            return Array.isArray(parsed) ? parsed : null;
          } catch {
            return null;
          } finally {
            clearTimeout(timer);
          }
        };

        const ledController = new AbortController();
        const ledTimer = setTimeout(() => ledController.abort(), 6500);
        let ledRes: Response;
        let profRows: any[] | null;
        let gdRows: any[] | null;
        try {
          // Query gamification_xp_ledger (limit 50) AND cohort-filtered account XP stores in parallel.
          // Failures in user_profiles or global_data are non-fatal so the leaderboard never blocks.
          [ledRes, profRows, gdRows] = await Promise.all([
            fetchJsonStrict(
              `${cfg.url}/rest/v1/gamification_xp_ledger?${sinceClause}select=id,user_id,user_name,user_role,xp_delta,label,created_at&order=created_at.desc&limit=50`,
              { headers, signal: ledController.signal },
              'leaderboard gamification_xp_ledger'
            ),
            fetchOptionalStoreRows(
              `${cfg.url}/rest/v1/user_profiles?${cohortRoleFilter}points=gt.0&select=id,uid,name,role,points,grade,section,updated_at&order=points.desc.nullslast&limit=50`,
              'leaderboard user_profiles'
            ),
            fetchOptionalStoreRows(
              `${cfg.url}/rest/v1/global_data?or=(id.like.gamification_user_*,id.eq.__studentos_gamification_default_school__)&select=id,data,updated_at&limit=100`,
              'leaderboard global_data'
            ),
          ]);
        } finally {
          clearTimeout(ledTimer);
        }

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

        // 1. Seed existing account XP store from user_profiles (only safe public leaderboard fields)
        if (Array.isArray(profRows)) {
          for (const p of profRows) {
            const canonicalId = String(p?.id || p?.uid || '').trim();
            if (!canonicalId || canonicalId.startsWith('__probe_')) continue;
            if (p?.uid) aliasToCanonicalId.set(String(p.uid).trim(), canonicalId);
            if (p?.id) aliasToCanonicalId.set(String(p.id).trim(), canonicalId);
            const pts = Math.max(0, Number(p?.points || 0));
            if (pts <= 0) continue;
            const role = String(p?.role || 'student').toLowerCase().trim();
            const name = String(p?.name || 'Member').trim() || 'Member';
            const wState = memoryWinterStates.get(canonicalId);
            allUsersMap.set(canonicalId, {
              userId: canonicalId,
              name,
              role,
              grade: String(p?.grade || ''),
              section: String(p?.section || ''),
              house: '',
              avatar: '',
              xp: pts,
              currentStreak: 0,
              winterCookies: wState?.cookiesCount || 0,
              equippedFrame: wState?.equippedFrame || null,
              equippedBorder: wState?.equippedBorder || null,
              badgesCount: Object.keys(wState?.earnedWinterBadges || {}).length,
              updatedAt: p?.updated_at ?? null,
            });
          }
        }

        // 2. Merge account XP store documents from global_data (gamification_user_* & school store)
        if (Array.isArray(gdRows)) {
          for (const row of gdRows) {
            const docId = String(row?.id || '');
            const docData = row?.data;
            if (!docData || typeof docData !== 'object') continue;
            if (docId.startsWith('gamification_user_')) {
              mergeAccountStoreObject(docId.slice('gamification_user_'.length), docData, row?.updated_at);
            } else if (docId.startsWith('__studentos_gamification_')) {
              for (const [k, v] of Object.entries(docData)) {
                mergeAccountStoreObject(k, v, row?.updated_at);
              }
            }
          }
        }

        // 3. Also merge in-memory gamification store if populated on this server instance
        if (deps.getGamificationStore) {
          const gStore = deps.getGamificationStore();
          for (const [k, v] of Object.entries(gStore || {})) {
            mergeAccountStoreObject(k, v);
          }
        }

        // 4. Merge authoritative gamification_xp_ledger deltas
        const ledRows = await ledRes.json().catch(() => []);
        if (Array.isArray(ledRows)) {
          const seenIds = new Set(ledgerSnapshot.map((l) => l.id));
          for (const r of ledRows) {
            if (!r?.id || seenIds.has(r.id)) continue;
            const rawUid = String(r.user_id || '').trim();
            if (!rawUid || rawUid.startsWith('__probe_')) continue;
            const uid = aliasToCanonicalId.get(rawUid) || rawUid;
            const existingUser = allUsersMap.get(uid);
            const role = String(r.user_role || existingUser?.role || 'student').toLowerCase().trim();
            const name = String(r.user_name || existingUser?.name || 'Member').trim() || 'Member';

            ledgerSnapshot.push({
              id: String(r.id),
              userId: uid,
              userName: name,
              userRole: role,
              grade: existingUser?.grade || '',
              section: existingUser?.section || '',
              house: existingUser?.house || '',
              avatar: existingUser?.avatar || '',
              sourceType: 'academic',
              actionKey: String(r.id),
              xpDelta: Number(r.xp_delta || 0),
              label: String(r.label || ''),
              createdAt: String(r.created_at),
            });

            if (!existingUser) {
              const wState = memoryWinterStates.get(uid);
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
                winterCookies: wState?.cookiesCount || 0,
                equippedFrame: wState?.equippedFrame || null,
                equippedBorder: wState?.equippedBorder || null,
                badgesCount: Object.keys(wState?.earnedWinterBadges || {}).length,
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
            equippedBorder: wState?.equippedBorder || null,
            badgesCount:
              Object.keys(v.earnedBadges || {}).length +
              Object.keys(wState?.earnedWinterBadges || {}).length,
          });
        });

        if (deps.getGamificationStore) {
          const gStore = deps.getGamificationStore();
          for (const [k, v] of Object.entries(gStore || {})) {
            mergeAccountStoreObject(k, v);
          }
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
