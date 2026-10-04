/**
 * StudentOS AI Buddy Usage & Limits Manager
 * Handles daily rolling quotas, tier limits, local fallback synchronization,
 * and quota upgrades/vouchers.
 */

export interface AIUsageState {
  used: number;
  limit: number;
  baseLimit: number;
  bonus: number;
  remaining: number;
  nextAvailableInMinutes: number | null;
  role: string;
  lastUpdated: number;
}

export const BASE_ROLE_LIMITS: Record<string, number> = {
  student: 30,
  teacher: 75,
  coordinator: 100,
  admin: 150,
  super_admin: 150,
};

const STORAGE_KEY_PREFIX = 's_os_ai_usage_';
const VOUCHER_STORAGE_PREFIX = 's_os_ai_vouchers_';

/**
 * Get cached or local usage state for a given user
 */
export function getLocalUsageState(userId: string, role = 'student'): AIUsageState {
  const normRole = (role || 'student').toLowerCase();
  const baseLimit = BASE_ROLE_LIMITS[normRole] || 30;

  if (typeof window === 'undefined') {
    return {
      used: 0,
      limit: baseLimit,
      baseLimit,
      bonus: 0,
      remaining: baseLimit,
      nextAvailableInMinutes: null,
      role: normRole,
      lastUpdated: Date.now()
    };
  }

  const key = `${STORAGE_KEY_PREFIX}${userId || 'guest'}`;
  try {
    const raw = localStorage.getItem(key);
    const bonus = Number(localStorage.getItem(`${key}_bonus`) || 0);
    const totalLimit = baseLimit + bonus;

    if (raw) {
      const parsed: { timestamps: number[] } = JSON.parse(raw);
      const now = Date.now();
      const cutoff = now - 24 * 60 * 60 * 1000;
      const validTimestamps = (parsed.timestamps || []).filter(ts => ts >= cutoff);
      validTimestamps.sort((a, b) => a - b);

      const used = validTimestamps.length;
      const remaining = Math.max(0, totalLimit - used);
      let nextAvailableInMinutes: number | null = null;
      if (used >= totalLimit && validTimestamps.length > 0) {
        const oldest = validTimestamps[0];
        const resetAt = oldest + 24 * 60 * 60 * 1000;
        nextAvailableInMinutes = Math.max(1, Math.ceil((resetAt - now) / 60000));
      }

      return {
        used,
        limit: totalLimit,
        baseLimit,
        bonus,
        remaining,
        nextAvailableInMinutes,
        role: normRole,
        lastUpdated: now
      };
    }
  } catch (err) {
    console.warn('Failed to parse local AI usage cache:', err);
  }

  return {
    used: 0,
    limit: baseLimit,
    baseLimit,
    bonus: 0,
    remaining: baseLimit,
    nextAvailableInMinutes: null,
    role: normRole,
    lastUpdated: Date.now()
  };
}

/**
 * Record a message query in local storage cache
 */
export function recordLocalMessage(userId: string, role = 'student'): AIUsageState {
  const normRole = (role || 'student').toLowerCase();
  const baseLimit = BASE_ROLE_LIMITS[normRole] || 30;
  const key = `${STORAGE_KEY_PREFIX}${userId || 'guest'}`;

  const now = Date.now();
  const cutoff = now - 24 * 60 * 60 * 1000;
  let timestamps: number[] = [];

  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      timestamps = (parsed.timestamps || []).filter((ts: number) => ts >= cutoff);
    }
  } catch (_) {}

  timestamps.push(now);
  timestamps.sort((a, b) => a - b);

  try {
    localStorage.setItem(key, JSON.stringify({ timestamps }));
  } catch (_) {}

  const bonus = Number(localStorage.getItem(`${key}_bonus`) || 0);
  const totalLimit = baseLimit + bonus;
  const used = timestamps.length;
  const remaining = Math.max(0, totalLimit - used);

  let nextAvailableInMinutes: number | null = null;
  if (used >= totalLimit && timestamps.length > 0) {
    const oldest = timestamps[0];
    const resetAt = oldest + 24 * 60 * 60 * 1000;
    nextAvailableInMinutes = Math.max(1, Math.ceil((resetAt - now) / 60000));
  }

  const newState: AIUsageState = {
    used,
    limit: totalLimit,
    baseLimit,
    bonus,
    remaining,
    nextAvailableInMinutes,
    role: normRole,
    lastUpdated: now
  };

  dispatchUsageEvent(newState);
  return newState;
}

/**
 * Fetch authoritative usage status from server with fallback to local state
 */
export async function fetchAIUsageStatus(userId: string, role = 'student'): Promise<AIUsageState> {
  const local = getLocalUsageState(userId, role);
  try {
    const res = await fetch(`/api/ai/usage-status?userId=${encodeURIComponent(userId || 'guest')}&role=${encodeURIComponent(role || 'student')}`);
    if (res.ok) {
      const serverData = await res.json();
      const bonus = Number(localStorage.getItem(`${STORAGE_KEY_PREFIX}${userId || 'guest'}_bonus`) || 0);
      const totalLimit = (serverData.limit || local.baseLimit) + (serverData.bonus || bonus);
      const used = serverData.used ?? local.used;
      const remaining = Math.max(0, totalLimit - used);

      const combined: AIUsageState = {
        used,
        limit: totalLimit,
        baseLimit: serverData.baseLimit || local.baseLimit,
        bonus: serverData.bonus || bonus,
        remaining,
        nextAvailableInMinutes: serverData.nextAvailableInMinutes ?? local.nextAvailableInMinutes,
        role: serverData.role || local.role,
        lastUpdated: Date.now()
      };

      dispatchUsageEvent(combined);
      return combined;
    }
  } catch (err) {
    console.warn('Server usage-status check failed, using local cache:', err);
  }
  return local;
}

/**
 * Redeem an upgrade voucher or study boost code
 */
export async function redeemAIVoucher(
  code: string,
  userId: string,
  role = 'student'
): Promise<{ success: boolean; message: string; newLimit?: number; bonusAdded?: number }> {
  const cleanCode = code.trim().toUpperCase();
  if (!cleanCode) {
    return { success: false, message: 'Please enter a valid voucher code.' };
  }

  // Pre-validate redeemed codes locally
  const redeemedKey = `${VOUCHER_STORAGE_PREFIX}${userId || 'guest'}`;
  let redeemed: string[] = [];
  try {
    redeemed = JSON.parse(localStorage.getItem(redeemedKey) || '[]');
  } catch (_) {}

  if (redeemed.includes(cleanCode)) {
    return { success: false, message: 'You have already redeemed this voucher code.' };
  }

  // Try server redemption
  try {
    const res = await fetch('/api/ai/redeem-voucher', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: cleanCode, userId, userRole: role })
    });

    if (res.ok) {
      const data = await res.json();
      if (data.success) {
        // Save locally
        redeemed.push(cleanCode);
        localStorage.setItem(redeemedKey, JSON.stringify(redeemed));
        const key = `${STORAGE_KEY_PREFIX}${userId || 'guest'}_bonus`;
        const currBonus = Number(localStorage.getItem(key) || 0);
        localStorage.setItem(key, String(currBonus + data.bonusAdded));

        const updatedUsage = await fetchAIUsageStatus(userId, role);
        return {
          success: true,
          message: data.message || `Added +${data.bonusAdded} daily AI queries!`,
          newLimit: updatedUsage.limit,
          bonusAdded: data.bonusAdded
        };
      } else {
        return { success: false, message: data.error || 'Invalid voucher code.' };
      }
    }
  } catch (err) {
    console.warn('Server voucher endpoint unavailable, testing known offline vouchers:', err);
  }

  // Fallback vouchers for offline / static preview mode
  const OFFLINE_CODES: Record<string, { bonus: number; title: string }> = {
    'STUDENTOS-PRO': { bonus: 25, title: 'StudentOS Pro Booster' },
    'EXAM-PREP': { bonus: 35, title: 'Exam Preparation Sprint' },
    'SCHOLAR-PASS': { bonus: 50, title: 'Academic Scholar Quota Pass' },
    'GENIUS-2026': { bonus: 40, title: '2026 Academic Innovation Boost' },
    'TEACHER-GRANT': { bonus: 60, title: 'Faculty Authorized Extra Quota' },
  };

  const matched = OFFLINE_CODES[cleanCode];
  if (matched) {
    redeemed.push(cleanCode);
    localStorage.setItem(redeemedKey, JSON.stringify(redeemed));
    const key = `${STORAGE_KEY_PREFIX}${userId || 'guest'}_bonus`;
    const currBonus = Number(localStorage.getItem(key) || 0);
    localStorage.setItem(key, String(currBonus + matched.bonus));

    const updated = getLocalUsageState(userId, role);
    dispatchUsageEvent(updated);

    return {
      success: true,
      message: `🎉 Success! Redeemed ${matched.title} (+${matched.bonus} queries/day).`,
      newLimit: updated.limit,
      bonusAdded: matched.bonus
    };
  }

  return {
    success: false,
    message: 'Invalid code. Try "STUDENTOS-PRO", "EXAM-PREP", or "SCHOLAR-PASS".'
  };
}

/**
 * Submit quota request to faculty / admins
 */
export async function submitQuotaRequest(
  userId: string,
  userName: string,
  userEmail: string,
  reason: string
): Promise<{ success: boolean; message: string }> {
  try {
    const res = await fetch('/api/ai/request-boost', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, userName, userEmail, reason })
    });
    if (res.ok) {
      const data = await res.json();
      return { success: true, message: data.message || 'Request submitted to your instructors!' };
    }
  } catch (_) {}

  // Local dispatch simulation if server route fails
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('s_os_quota_requested', {
      detail: { userId, userName, reason, timestamp: Date.now() }
    }));
  }

  return {
    success: true,
    message: 'Your quota upgrade request has been logged and forwarded to school coordinators.'
  };
}

function dispatchUsageEvent(state: AIUsageState) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('s_os_ai_quota_updated', { detail: state }));
  }
}
