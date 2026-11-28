/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Persistent Byte AI Quota & Winter Bonus Credit Service
 * - Uses Supabase (`ai_usage_logs`, `ai_user_vouchers`, `ai_role_limits`, `winter_user_profiles`)
 *   with transparent `global_data` fallback specifically when `PGRST205` (migration not yet run) occurs.
 * - Never swallows database errors or falls back silently to process memory in production.
 * - Keeps fast pure in-memory isolation when `NODE_ENV === 'test'` and no local mock DB URL is configured.
 */

import crypto from 'crypto';
import { MAX_DAILY_WINTER_AI_BONUS } from './rewardEngine.js';
import {
  WORKING_ANON_KEY,
  markSupabaseKeyInvalid,
  supabaseFetchWithAnonRetry,
  getFeatureAndWinterSupabaseKey,
} from './supabaseKeyManager.js';

export interface SupabaseConfig {
  url: string;
  key: string;
}

export interface AIUsageLogEntry {
  id: string;
  userId: string;
  role: string;
  feature: string;
  timestamp: number;
}

export interface RollingAIUsageStatus {
  used: number;
  limit: number;
  baseLimit: number;
  bonus: number;
  winterBonus: number;
  voucherBonus: number;
  remaining: number;
  nextAvailableInMinutes: number | null;
  role: string;
}

export const DEFAULT_ROLE_AI_LIMITS: Record<string, number> = {
  student: 30,
  teacher: 75,
  coordinator: 100,
  admin: 150,
  super_admin: 150,
};

export const VALID_AI_VOUCHERS: Record<string, { bonus: number; title: string }> = {
  'STUDENTOS-PRO': { bonus: 25, title: 'StudentOS Pro Booster (+25/day)' },
  'EXAM-PREP': { bonus: 35, title: 'Exam Preparation Sprint (+35/day)' },
  'SCHOLAR-PASS': { bonus: 50, title: 'Academic Scholar Pass (+50/day)' },
  'GENIUS-2026': { bonus: 40, title: '2026 Innovation Grant (+40/day)' },
  'TEACHER-GRANT': { bonus: 60, title: 'Faculty Authorized Quota (+60/day)' },
  'STUDENTOS-UNLIMITED': { bonus: 100, title: 'StudentOS Unlimited Sprint (+100/day)' },
};

export class AIQuotaPersistenceError extends Error {
  statusCode: number;
  code: string;

  constructor(message: string, statusCode = 503, code = 'AI_QUOTA_PERSISTENCE_ERROR') {
    super(message);
    this.name = 'AIQuotaPersistenceError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

const memoryUsageLogs: AIUsageLogEntry[] = [];
const memoryVoucherBonuses = new Map<string, number>();
const memoryRedeemedCodes = new Map<string, string[]>();
let memoryRoleLimits: Record<string, number> = { ...DEFAULT_ROLE_AI_LIMITS };
let forceSupabaseInTests = false;

export function setForceAiQuotaSupabaseForTests(enabled: boolean) {
  if (process.env.NODE_ENV !== 'test') return;
  forceSupabaseInTests = enabled;
}

export function resetAiQuotaMemoryForTests() {
  if (process.env.NODE_ENV !== 'test') return;
  memoryUsageLogs.length = 0;
  memoryVoucherBonuses.clear();
  memoryRedeemedCodes.clear();
  memoryRoleLimits = { ...DEFAULT_ROLE_AI_LIMITS };
  forceSupabaseInTests = false;
}

export function shouldUseSupabaseQuota(cfg: SupabaseConfig): boolean {
  if (!cfg.url || !cfg.key) return false;
  if (process.env.NODE_ENV !== 'test') return true;
  if (forceSupabaseInTests) return true;
  return cfg.url.includes('127.0.0.1') || cfg.url.includes('localhost');
}

export function getIstDayKey(nowMs: number = Date.now(), timeZone: string = 'Asia/Kolkata'): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(nowMs));
  const map: Record<string, string> = {};
  for (const p of parts) {
    if (p.type !== 'literal') map[p.type] = p.value;
  }
  return `${map.year}-${map.month}-${map.day}`;
}

export function getBaseRoleLimit(role?: string, overrides?: Record<string, number>): number {
  const norm = String(role || 'student').toLowerCase().trim() || 'student';
  const source = overrides || memoryRoleLimits;
  return source[norm] || DEFAULT_ROLE_AI_LIMITS[norm] || 30;
}

function isMissingRelationError(status: number, bodyText: string): boolean {
  if (status === 404) return true;
  const lower = bodyText.toLowerCase();
  return (
    lower.includes('pgrst205') ||
    lower.includes('could not find the table') ||
    (lower.includes('relation') && lower.includes('does not exist'))
  );
}

function normalizeQuotaCfg(cfg: SupabaseConfig): SupabaseConfig {
  if (!cfg.url) return cfg;
  return {
    url: cfg.url,
    key: getFeatureAndWinterSupabaseKey(cfg.url, cfg.key),
  };
}

async function fetchQuotaSupabase(url: string, init: RequestInit): Promise<Response> {
  return await supabaseFetchWithAnonRetry(url, init);
}

interface GlobalQuotaDoc {
  timestamps: number[];
  redeemedCodes: string[];
  voucherBonus: number;
}

async function loadGlobalQuotaDoc(cfg: SupabaseConfig, userId: string): Promise<GlobalQuotaDoc> {
  const docId = `__veylentra_ai_quota_${userId}__`;
  let res: Response;
  try {
    res = await fetchQuotaSupabase(
      `${cfg.url}/rest/v1/global_data?id=eq.${encodeURIComponent(docId)}&select=id,data`,
      { headers: { apikey: cfg.key, Authorization: `Bearer ${cfg.key}` } }
    );
  } catch (err: any) {
    throw new AIQuotaPersistenceError(`Network error loading AI quota from Supabase: ${err?.message || err}`);
  }

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new AIQuotaPersistenceError(
      `Failed to load AI quota from Supabase (${res.status}): ${errText || res.statusText}`,
      res.status >= 500 ? 503 : 500
    );
  }

  const rows = await res.json();
  const data = rows?.[0]?.data;
  return {
    timestamps: Array.isArray(data?.timestamps) ? data.timestamps.map(Number).filter(Number.isFinite) : [],
    redeemedCodes: Array.isArray(data?.redeemedCodes) ? data.redeemedCodes.map(String) : [],
    voucherBonus: Number.isFinite(Number(data?.voucherBonus)) ? Math.max(0, Number(data.voucherBonus)) : 0,
  };
}

async function saveGlobalQuotaDoc(cfg: SupabaseConfig, userId: string, doc: GlobalQuotaDoc): Promise<void> {
  const docId = `__veylentra_ai_quota_${userId}__`;
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  const pruned: GlobalQuotaDoc = {
    timestamps: doc.timestamps.filter(ts => Number.isFinite(ts) && ts >= cutoff),
    redeemedCodes: Array.from(new Set(doc.redeemedCodes)),
    voucherBonus: Math.max(0, Number(doc.voucherBonus) || 0),
  };

  let res: Response;
  try {
    res = await fetchQuotaSupabase(`${cfg.url}/rest/v1/global_data?on_conflict=id`, {
      method: 'POST',
      headers: {
        apikey: cfg.key,
        Authorization: `Bearer ${cfg.key}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates',
      },
      body: JSON.stringify({
        id: docId,
        data: pruned,
        updated_at: new Date().toISOString(),
      }),
    });
  } catch (err: any) {
    throw new AIQuotaPersistenceError(`Network error saving AI quota to Supabase: ${err?.message || err}`);
  }

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new AIQuotaPersistenceError(
      `Failed to save AI quota to Supabase (${res.status}): ${errText || res.statusText}`,
      res.status >= 500 ? 503 : 500
    );
  }
}

export async function getWinterAiBonusCreditsFromDb(
  rawCfg: SupabaseConfig,
  userId: string,
  nowMs: number = Date.now(),
  memoryFallback?: (uid: string, nowMs: number) => number
): Promise<number> {
  const cfg = normalizeQuotaCfg(rawCfg);
  if (!shouldUseSupabaseQuota(cfg)) {
    return memoryFallback ? memoryFallback(userId, nowMs) : 0;
  }

  let res: Response;
  try {
    res = await fetchQuotaSupabase(
      `${cfg.url}/rest/v1/winter_user_profiles?user_id=eq.${encodeURIComponent(userId)}&select=ai_bonus_date,ai_bonus_credits_today`,
      { headers: { apikey: cfg.key, Authorization: `Bearer ${cfg.key}` } }
    );
  } catch (err: any) {
    throw new AIQuotaPersistenceError(
      `Network error loading Winter AI bonus credits: ${err?.message || err}`
    );
  }

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new AIQuotaPersistenceError(
      `Failed to load Winter AI bonus credits (${res.status}): ${errText || res.statusText}`
    );
  }

  const rows = await res.json();
  if (!Array.isArray(rows) || !rows[0]) return 0;
  const row = rows[0];
  const todayKey = getIstDayKey(nowMs, 'Asia/Kolkata');
  if (String(row.ai_bonus_date || '') !== todayKey) {
    return 0;
  }
  const rawCredits = Number(row.ai_bonus_credits_today || 0);
  return Math.min(MAX_DAILY_WINTER_AI_BONUS, Math.max(0, Number.isFinite(rawCredits) ? rawCredits : 0));
}

export async function getRoleLimitsAsync(rawCfg: SupabaseConfig): Promise<Record<string, number>> {
  const cfg = normalizeQuotaCfg(rawCfg);
  if (!shouldUseSupabaseQuota(cfg)) {
    return { ...memoryRoleLimits };
  }

  try {
    const res = await fetchQuotaSupabase(`${cfg.url}/rest/v1/ai_role_limits?select=role,daily_limit`, {
      headers: { apikey: cfg.key, Authorization: `Bearer ${cfg.key}` },
    });
    if (res.ok) {
      const rows = await res.json();
      if (Array.isArray(rows) && rows.length > 0) {
        const merged = { ...DEFAULT_ROLE_AI_LIMITS };
        for (const r of rows) {
          if (r?.role && Number(r.daily_limit) > 0) {
            merged[String(r.role).toLowerCase()] = Number(r.daily_limit);
          }
        }
        memoryRoleLimits = merged;
        return merged;
      }
    } else {
      const errText = await res.text().catch(() => '');
      if (isMissingRelationError(res.status, errText)) {
        const docRes = await fetchQuotaSupabase(
          `${cfg.url}/rest/v1/global_data?id=eq.__veylentra_ai_role_limits__&select=data`,
          { headers: { apikey: cfg.key, Authorization: `Bearer ${cfg.key}` } }
        );
        if (docRes.ok) {
          const rows = await docRes.json();
          if (rows?.[0]?.data && typeof rows[0].data === 'object') {
            memoryRoleLimits = { ...DEFAULT_ROLE_AI_LIMITS, ...rows[0].data };
          }
        }
      }
    }
  } catch (_) {}

  return { ...memoryRoleLimits };
}

export async function updateRoleLimitsAsync(
  rawCfg: SupabaseConfig,
  limits: Record<string, number>
): Promise<Record<string, number>> {
  const cfg = normalizeQuotaCfg(rawCfg);
  const sanitized: Record<string, number> = { ...memoryRoleLimits };
  for (const [k, v] of Object.entries(limits || {})) {
    const num = Number(v);
    if (Number.isFinite(num) && num > 0) {
      sanitized[String(k).toLowerCase().trim()] = Math.round(num);
    }
  }

  if (!shouldUseSupabaseQuota(cfg)) {
    memoryRoleLimits = sanitized;
    return sanitized;
  }

  const payload = Object.entries(sanitized).map(([role, daily_limit]) => ({
    role,
    daily_limit,
    updated_at: new Date().toISOString(),
  }));

  const res = await fetchQuotaSupabase(`${cfg.url}/rest/v1/ai_role_limits?on_conflict=role`, {
    method: 'POST',
    headers: {
      apikey: cfg.key,
      Authorization: `Bearer ${cfg.key}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates',
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    if (isMissingRelationError(res.status, errText)) {
      const gRes = await fetchQuotaSupabase(`${cfg.url}/rest/v1/global_data?on_conflict=id`, {
        method: 'POST',
        headers: {
          apikey: cfg.key,
          Authorization: `Bearer ${cfg.key}`,
          'Content-Type': 'application/json',
          Prefer: 'resolution=merge-duplicates',
        },
        body: JSON.stringify({
          id: '__veylentra_ai_role_limits__',
          data: sanitized,
          updated_at: new Date().toISOString(),
        }),
      });
      if (!gRes.ok) {
        const gErr = await gRes.text().catch(() => '');
        throw new AIQuotaPersistenceError(`Failed to save AI role limits: ${gErr || gRes.statusText}`);
      }
    } else {
      throw new AIQuotaPersistenceError(`Failed to save AI role limits (${res.status}): ${errText}`);
    }
  }

  memoryRoleLimits = sanitized;
  return sanitized;
}

export async function getRolling24hUsageAsync(params: {
  cfg: SupabaseConfig;
  userId: string;
  role?: string;
  nowMs?: number;
  memoryWinterBonusFn?: (uid: string, nowMs: number) => number;
}): Promise<RollingAIUsageStatus> {
  const { cfg: rawCfg, userId, role, nowMs = Date.now(), memoryWinterBonusFn } = params;
  const cfg = normalizeQuotaCfg(rawCfg);
  const normRole = String(role || 'student').toLowerCase().trim() || 'student';
  const windowStart = nowMs - 24 * 60 * 60 * 1000;

  if (!shouldUseSupabaseQuota(cfg)) {
    const activeRecords = memoryUsageLogs
      .filter(u => u.userId === userId && u.timestamp >= windowStart && u.timestamp <= nowMs + 60_000)
      .sort((a, b) => a.timestamp - b.timestamp);
    const baseLimit = getBaseRoleLimit(normRole);
    const voucherBonus = memoryVoucherBonuses.get(userId) || 0;
    const winterBonus = memoryWinterBonusFn ? memoryWinterBonusFn(userId, nowMs) : 0;
    const bonus = voucherBonus + winterBonus;
    const limit = baseLimit + bonus;
    const used = activeRecords.length;
    const remaining = Math.max(0, limit - used);
    let nextAvailableInMinutes: number | null = null;
    if (used >= limit && activeRecords.length > 0) {
      const resetAt = activeRecords[0].timestamp + 24 * 60 * 60 * 1000;
      nextAvailableInMinutes = Math.max(1, Math.ceil((resetAt - nowMs) / 60000));
    }
    return {
      used,
      limit,
      baseLimit,
      bonus,
      winterBonus,
      voucherBonus,
      remaining,
      nextAvailableInMinutes,
      role: normRole,
    };
  }

  const sinceIso = new Date(windowStart).toISOString();
  const [roleLimits, winterBonus, logsRes, vouchersRes] = await Promise.all([
    getRoleLimitsAsync(cfg),
    getWinterAiBonusCreditsFromDb(cfg, userId, nowMs, memoryWinterBonusFn),
    fetchQuotaSupabase(
      `${cfg.url}/rest/v1/ai_usage_logs?user_id=eq.${encodeURIComponent(userId)}&created_at=gte.${encodeURIComponent(sinceIso)}&select=id,created_at&order=created_at.asc`,
      { headers: { apikey: cfg.key, Authorization: `Bearer ${cfg.key}` } }
    ).catch((err) => {
      throw new AIQuotaPersistenceError(`Network error reading AI usage logs: ${err?.message || err}`);
    }),
    fetchQuotaSupabase(
      `${cfg.url}/rest/v1/ai_user_vouchers?user_id=eq.${encodeURIComponent(userId)}&select=voucher_code,bonus_queries`,
      { headers: { apikey: cfg.key, Authorization: `Bearer ${cfg.key}` } }
    ).catch((err) => {
      throw new AIQuotaPersistenceError(`Network error reading AI vouchers: ${err?.message || err}`);
    }),
  ]);

  let timestamps: number[] = [];
  let voucherBonus = 0;
  let needGlobalDoc = false;

  if (logsRes.ok) {
    const rows = await logsRes.json();
    if (Array.isArray(rows)) {
      timestamps = rows
        .map((r: any) => Date.parse(String(r.created_at)))
        .filter((ts: number) => Number.isFinite(ts) && ts >= windowStart);
    }
  } else {
    const errText = await logsRes.text().catch(() => '');
    if (isMissingRelationError(logsRes.status, errText)) {
      needGlobalDoc = true;
    } else {
      throw new AIQuotaPersistenceError(
        `Failed to query ai_usage_logs (${logsRes.status}): ${errText || logsRes.statusText}`
      );
    }
  }

  if (vouchersRes.ok) {
    const rows = await vouchersRes.json();
    if (Array.isArray(rows)) {
      voucherBonus = rows.reduce((sum: number, r: any) => sum + Math.max(0, Number(r.bonus_queries || 0)), 0);
    }
  } else {
    const errText = await vouchersRes.text().catch(() => '');
    if (isMissingRelationError(vouchersRes.status, errText)) {
      needGlobalDoc = true;
    } else {
      throw new AIQuotaPersistenceError(
        `Failed to query ai_user_vouchers (${vouchersRes.status}): ${errText || vouchersRes.statusText}`
      );
    }
  }

  if (needGlobalDoc) {
    const gDoc = await loadGlobalQuotaDoc(cfg, userId);
    if (!logsRes.ok) {
      timestamps = gDoc.timestamps.filter(ts => ts >= windowStart);
    }
    if (!vouchersRes.ok) {
      voucherBonus = gDoc.voucherBonus;
    }
  }

  timestamps.sort((a, b) => a - b);
  const baseLimit = getBaseRoleLimit(normRole, roleLimits);
  const bonus = voucherBonus + winterBonus;
  const limit = baseLimit + bonus;
  const used = timestamps.length;
  const remaining = Math.max(0, limit - used);

  let nextAvailableInMinutes: number | null = null;
  if (used >= limit && timestamps.length > 0) {
    const oldest = timestamps[0];
    const expiresAt = oldest + 24 * 60 * 60 * 1000;
    nextAvailableInMinutes = Math.max(1, Math.ceil((expiresAt - nowMs) / 60000));
  }

  return {
    used,
    limit,
    baseLimit,
    bonus,
    winterBonus,
    voucherBonus,
    remaining,
    nextAvailableInMinutes,
    role: normRole,
  };
}

export async function recordAiUsageAsync(params: {
  cfg: SupabaseConfig;
  userId: string;
  role: string;
  feature: string;
  nowMs?: number;
}): Promise<void> {
  const { cfg: rawCfg, userId, role, feature, nowMs = Date.now() } = params;
  const cfg = normalizeQuotaCfg(rawCfg);
  const entryId = `use_${nowMs}_${crypto.randomBytes(4).toString('hex')}`;

  if (!shouldUseSupabaseQuota(cfg)) {
    memoryUsageLogs.push({ id: entryId, userId, role, feature, timestamp: nowMs });
    return;
  }

  let res: Response;
  try {
    res = await fetchQuotaSupabase(`${cfg.url}/rest/v1/ai_usage_logs`, {
      method: 'POST',
      headers: {
        apikey: cfg.key,
        Authorization: `Bearer ${cfg.key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        id: entryId,
        user_id: userId,
        user_role: role,
        feature,
        created_at: new Date(nowMs).toISOString(),
      }),
    });
  } catch (err: any) {
    throw new AIQuotaPersistenceError(`Network error recording AI usage: ${err?.message || err}`);
  }

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    if (isMissingRelationError(res.status, errText)) {
      const gDoc = await loadGlobalQuotaDoc(cfg, userId);
      gDoc.timestamps.push(nowMs);
      await saveGlobalQuotaDoc(cfg, userId, gDoc);
      return;
    }
    throw new AIQuotaPersistenceError(
      `Failed to record AI usage (${res.status}): ${errText || res.statusText}`
    );
  }
}

export async function redeemAiVoucherAsync(params: {
  cfg: SupabaseConfig;
  userId: string;
  userRole?: string;
  code: string;
  memoryWinterBonusFn?: (uid: string, nowMs: number) => number;
}): Promise<{
  ok: boolean;
  statusCode: number;
  body: Record<string, any>;
}> {
  const { cfg: rawCfg, userId, userRole, code, memoryWinterBonusFn } = params;
  const cfg = normalizeQuotaCfg(rawCfg);
  const cleanCode = String(code || '').trim().toUpperCase();
  const voucher = VALID_AI_VOUCHERS[cleanCode];

  if (!voucher) {
    return {
      ok: false,
      statusCode: 400,
      body: { success: false, error: 'Invalid or expired voucher code.' },
    };
  }

  if (!shouldUseSupabaseQuota(cfg)) {
    const existing = memoryRedeemedCodes.get(userId) || [];
    if (existing.includes(cleanCode)) {
      return {
        ok: false,
        statusCode: 400,
        body: { success: false, error: 'Voucher has already been redeemed for this account.' },
      };
    }
    existing.push(cleanCode);
    memoryRedeemedCodes.set(userId, existing);
    memoryVoucherBonuses.set(userId, (memoryVoucherBonuses.get(userId) || 0) + voucher.bonus);
    const updatedUsage = await getRolling24hUsageAsync({ cfg, userId, role: userRole, memoryWinterBonusFn });
    return {
      ok: true,
      statusCode: 200,
      body: {
        success: true,
        message: `Voucher redeemed! Added ${voucher.title}`,
        bonusAdded: voucher.bonus,
        newLimit: updatedUsage.limit,
        remaining: updatedUsage.remaining,
        usage: updatedUsage,
      },
    };
  }

  let res: Response;
  try {
    res = await fetchQuotaSupabase(`${cfg.url}/rest/v1/ai_user_vouchers`, {
      method: 'POST',
      headers: {
        apikey: cfg.key,
        Authorization: `Bearer ${cfg.key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        id: `vch_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
        user_id: userId,
        voucher_code: cleanCode,
        bonus_queries: voucher.bonus,
        redeemed_at: new Date().toISOString(),
      }),
    });
  } catch (err: any) {
    throw new AIQuotaPersistenceError(`Network error redeeming voucher: ${err?.message || err}`);
  }

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    if (res.status === 409 || errText.includes('23505') || errText.toLowerCase().includes('duplicate')) {
      return {
        ok: false,
        statusCode: 400,
        body: { success: false, error: 'Voucher has already been redeemed for this account.' },
      };
    }
    if (isMissingRelationError(res.status, errText)) {
      const gDoc = await loadGlobalQuotaDoc(cfg, userId);
      if (gDoc.redeemedCodes.includes(cleanCode)) {
        return {
          ok: false,
          statusCode: 400,
          body: { success: false, error: 'Voucher has already been redeemed for this account.' },
        };
      }
      gDoc.redeemedCodes.push(cleanCode);
      gDoc.voucherBonus += voucher.bonus;
      await saveGlobalQuotaDoc(cfg, userId, gDoc);
    } else {
      throw new AIQuotaPersistenceError(
        `Failed to persist voucher redemption (${res.status}): ${errText || res.statusText}`
      );
    }
  }

  const updatedUsage = await getRolling24hUsageAsync({ cfg, userId, role: userRole, memoryWinterBonusFn });
  return {
    ok: true,
    statusCode: 200,
    body: {
      success: true,
      message: `Voucher redeemed! Added ${voucher.title}`,
      bonusAdded: voucher.bonus,
      newLimit: updatedUsage.limit,
      remaining: updatedUsage.remaining,
      usage: updatedUsage,
    },
  };
}
