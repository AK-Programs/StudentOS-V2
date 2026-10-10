import crypto from 'crypto';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://zwpoutanhsujezglbson.supabase.co';
const SUPABASE_ANON_KEY =
  process.env.VITE_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp3cG91dGFuaHN1amV6Z2xic29uIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE2OTA2MDEsImV4cCI6MjA5NzI2NjYwMX0.Y48u9duD3WohxzDD6czXevPaG1mFRFS0rdRuu4840pQ';

export interface WorkspaceSecurityRecord {
  id: string;
  is_locked: boolean;
  pin_hash: string | null;
  locked_at: string | null;
  locked_by: string | null;
  updated_at: string;
}

// In-memory fallback and rate limiting cache
let memoryState: WorkspaceSecurityRecord = {
  id: 'global_workspace',
  is_locked: false,
  pin_hash: null,
  locked_at: null,
  locked_by: null,
  updated_at: new Date().toISOString()
};

interface RateLimitTracker {
  failedAttempts: number;
  lastAttemptAt: number;
  lockedUntil: number;
}

const rateLimitMap = new Map<string, RateLimitTracker>();
const MAX_FAILED_ATTEMPTS = 5;
const COOLDOWN_MS = 30000; // 30 seconds after 5 failed attempts

function getRateLimit(key: string): RateLimitTracker {
  const existing = rateLimitMap.get(key);
  const now = Date.now();
  if (!existing) {
    return { failedAttempts: 0, lastAttemptAt: 0, lockedUntil: 0 };
  }
  // Reset window if more than 5 minutes since last attempt and not currently locked
  if (now > existing.lockedUntil && now - existing.lastAttemptAt > 300000) {
    return { failedAttempts: 0, lastAttemptAt: 0, lockedUntil: 0 };
  }
  return existing;
}

function recordFailedAttempt(key: string): { isRateLimited: boolean; retryAfterSeconds: number; attemptsRemaining: number } {
  const tracker = getRateLimit(key);
  tracker.failedAttempts += 1;
  tracker.lastAttemptAt = Date.now();
  if (tracker.failedAttempts >= MAX_FAILED_ATTEMPTS) {
    tracker.lockedUntil = Date.now() + COOLDOWN_MS;
  }
  rateLimitMap.set(key, tracker);

  const isRateLimited = Date.now() < tracker.lockedUntil;
  const retryAfterSeconds = isRateLimited ? Math.ceil((tracker.lockedUntil - Date.now()) / 1000) : 0;
  const attemptsRemaining = Math.max(0, MAX_FAILED_ATTEMPTS - tracker.failedAttempts);

  return { isRateLimited, retryAfterSeconds, attemptsRemaining };
}

function resetRateLimit(key: string): void {
  rateLimitMap.delete(key);
}

/**
 * Hash a PIN using salted scrypt (memory-hard, resistant to GPU/ASIC brute forcing)
 */
export function hashPin(pin: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(pin, salt, 64).toString('hex');
  return `scrypt$${salt}$${derived}`;
}

/**
 * Timing-safe verification of PIN against stored salted scrypt hash
 */
export function verifyPinHash(pin: string, storedHash: string | null): boolean {
  if (!storedHash || !pin) return false;
  try {
    const parts = storedHash.split('$');
    if (parts.length !== 3 || parts[0] !== 'scrypt') return false;
    const salt = parts[1];
    const hashHex = parts[2];
    const derived = crypto.scryptSync(pin, salt, 64).toString('hex');

    const bufA = Buffer.from(derived, 'hex');
    const bufB = Buffer.from(hashHex, 'hex');
    if (bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
  } catch (err) {
    console.error('[SecurityService] PIN verification exception:', err);
    return false;
  }
}

/**
 * Fetch authoritative security state from Supabase
 */
export async function fetchAuthoritativeSecurity(workspaceId = 'global_workspace'): Promise<WorkspaceSecurityRecord> {
  try {
    const resp = await fetch(`${SUPABASE_URL}/rest/v1/workspace_security?id=eq.${encodeURIComponent(workspaceId)}&select=*`, {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`
      }
    });

    if (resp.ok) {
      const rows = await resp.json();
      if (Array.isArray(rows) && rows.length > 0) {
        memoryState = {
          id: rows[0].id || workspaceId,
          is_locked: Boolean(rows[0].is_locked),
          pin_hash: rows[0].pin_hash || null,
          locked_at: rows[0].locked_at || null,
          locked_by: rows[0].locked_by || null,
          updated_at: rows[0].updated_at || new Date().toISOString()
        };
        return memoryState;
      }
    }
  } catch (err) {
    console.warn('[SecurityService] Supabase fetch error, using cache:', err);
  }
  return memoryState;
}

/**
 * Persist updated security state to Supabase
 */
export async function persistSecurityState(
  updates: Partial<WorkspaceSecurityRecord>,
  workspaceId = 'global_workspace'
): Promise<WorkspaceSecurityRecord> {
  const updatedRecord: WorkspaceSecurityRecord = {
    ...memoryState,
    ...updates,
    id: workspaceId,
    updated_at: new Date().toISOString()
  };

  memoryState = updatedRecord;

  try {
    const resp = await fetch(`${SUPABASE_URL}/rest/v1/workspace_security?id=eq.${encodeURIComponent(workspaceId)}`, {
      method: 'PATCH',
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation'
      },
      body: JSON.stringify({
        is_locked: updatedRecord.is_locked,
        pin_hash: updatedRecord.pin_hash,
        locked_at: updatedRecord.locked_at,
        locked_by: updatedRecord.locked_by,
        updated_at: updatedRecord.updated_at
      })
    });

    if (resp.ok) {
      const rows = await resp.json();
      if (Array.isArray(rows) && rows.length > 0) {
        memoryState = {
          id: rows[0].id || workspaceId,
          is_locked: Boolean(rows[0].is_locked),
          pin_hash: rows[0].pin_hash || null,
          locked_at: rows[0].locked_at || null,
          locked_by: rows[0].locked_by || null,
          updated_at: rows[0].updated_at || new Date().toISOString()
        };
      }
    } else {
      console.warn('[SecurityService] PATCH failed with status:', resp.status);
    }
  } catch (err) {
    console.error('[SecurityService] Failed to persist security state to Supabase:', err);
  }

  return memoryState;
}

export { getRateLimit, recordFailedAttempt, resetRateLimit, MAX_FAILED_ATTEMPTS, COOLDOWN_MS };
