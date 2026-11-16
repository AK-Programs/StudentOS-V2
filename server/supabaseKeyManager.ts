/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Supabase Key Manager & Working Anon Key Fallback
 * - Hardcodes the known working Supabase anon key for project zwpoutanhsujezglbson.
 * - Detects invalid/expired/mismatched API keys.
 * - Never trusts SUPABASE_SERVICE_ROLE_KEY unless a real test probe returns HTTP 200.
 * - Provides supabaseFetchWithAnonRetry() reading keys from Headers objects, tuple arrays, or plain objects.
 */

export const WORKING_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp3cG91dGFuaHN1amV6Z2xic29uIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE2OTA2MDEsImV4cCI6MjA5NzI2NjYwMX0.Y48u9duD3WohxzDD6czXevPaG1mFRFS0rdRuu4840pQ';

export const knownInvalidSupabaseKeys = new Set<string>();
export const verifiedServiceRoleKeys = new Set<string>();
const serviceRoleProbePromises = new Map<string, Promise<boolean>>();

export function markSupabaseKeyInvalid(key?: string | null): void {
  if (key && typeof key === 'string') {
    const trimmed = key.trim();
    if (trimmed && trimmed !== WORKING_ANON_KEY) {
      knownInvalidSupabaseKeys.add(trimmed);
      verifiedServiceRoleKeys.delete(trimmed);
    }
  }
}

export function isKnownInvalidSupabaseKey(key?: string | null, targetUrl?: string): boolean {
  if (!key) return true;
  const trimmed = key.trim();
  if (trimmed.length < 20) return true;
  if (knownInvalidSupabaseKeys.has(trimmed)) return true;
  const lower = trimmed.toLowerCase();
  if (lower.includes('your_') || lower.includes('placeholder')) return true;

  if (targetUrl) {
    try {
      const parts = trimmed.split('.');
      if (parts.length === 3) {
        const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));
        if (payload && typeof payload === 'object') {
          const match = targetUrl.match(/https?:\/\/([a-z0-9_-]+)\.supabase\./i);
          const expectedRef = match ? match[1] : '';
          if (expectedRef && payload.ref && payload.ref !== expectedRef) {
            knownInvalidSupabaseKeys.add(trimmed);
            return true;
          }
          if (payload.exp && typeof payload.exp === 'number' && payload.exp * 1000 < Date.now()) {
            knownInvalidSupabaseKeys.add(trimmed);
            return true;
          }
        }
      }
    } catch {
      // ignore decode error
    }
  }

  return false;
}

/**
 * Probes SUPABASE_SERVICE_ROLE_KEY with a lightweight 200 check before allowing it.
 * Never returns true unless a real request with the key returns HTTP 200.
 */
export async function probeServiceRoleKey(url: string, serviceRoleKey?: string | null): Promise<boolean> {
  if (!url || isKnownInvalidSupabaseKey(serviceRoleKey, url)) {
    return false;
  }
  const trimmed = serviceRoleKey!.trim();
  if (verifiedServiceRoleKeys.has(trimmed)) {
    return true;
  }
  if (serviceRoleProbePromises.has(trimmed)) {
    return serviceRoleProbePromises.get(trimmed)!;
  }

  const probe = (async () => {
    try {
      const res = await fetch(`${url}/rest/v1/user_profiles?select=id&limit=1`, {
        headers: {
          apikey: trimmed,
          Authorization: `Bearer ${trimmed}`,
        },
      });
      if (res.status === 200) {
        verifiedServiceRoleKeys.add(trimmed);
        return true;
      }
      markSupabaseKeyInvalid(trimmed);
      return false;
    } catch {
      return false;
    } finally {
      serviceRoleProbePromises.delete(trimmed);
    }
  })();

  serviceRoleProbePromises.set(trimmed, probe);
  return probe;
}

/**
 * Returns the key to use for winter, leaderboard, collectible, quota, and feature reads/writes.
 * Uses WORKING_ANON_KEY unless SUPABASE_SERVICE_ROLE_KEY was explicitly verified by a 200 test call
 * (or running against a local mock DB in test mode).
 */
export function getFeatureAndWinterSupabaseKey(url?: string, configuredKey?: string | null): string {
  const isLocalMock = Boolean(url && (url.includes('127.0.0.1') || url.includes('localhost')));
  if (isLocalMock && configuredKey && configuredKey.trim().length >= 20) {
    return configuredKey.trim();
  }
  if (configuredKey && verifiedServiceRoleKeys.has(configuredKey.trim())) {
    return configuredKey.trim();
  }
  const srKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (srKey && verifiedServiceRoleKeys.has(srKey) && !isKnownInvalidSupabaseKey(srKey, url)) {
    return srKey;
  }
  return WORKING_ANON_KEY;
}

/**
 * Extracts apikey / Authorization Bearer token from a Headers instance, tuple array, or plain object.
 */
export function extractApiKeyFromHeaders(headersInit?: HeadersInit): string {
  if (!headersInit) return '';

  if (typeof Headers !== 'undefined' && headersInit instanceof Headers) {
    const apiKey = headersInit.get('apikey');
    if (apiKey) return apiKey.trim();
    const auth = headersInit.get('authorization');
    if (auth) return auth.replace(/^Bearer\s+/i, '').trim();
    return '';
  }

  if (Array.isArray(headersInit)) {
    for (const entry of headersInit) {
      if (Array.isArray(entry) && String(entry[0]).toLowerCase() === 'apikey' && entry[1]) {
        return String(entry[1]).trim();
      }
    }
    for (const entry of headersInit) {
      if (Array.isArray(entry) && String(entry[0]).toLowerCase() === 'authorization' && entry[1]) {
        return String(entry[1]).replace(/^Bearer\s+/i, '').trim();
      }
    }
    return '';
  }

  const record = headersInit as Record<string, string>;
  for (const key of Object.keys(record)) {
    if (key.toLowerCase() === 'apikey' && record[key]) {
      return String(record[key]).trim();
    }
  }
  for (const key of Object.keys(record)) {
    if (key.toLowerCase() === 'authorization' && record[key]) {
      return String(record[key]).replace(/^Bearer\s+/i, '').trim();
    }
  }
  return '';
}

/**
 * Executes a Supabase REST fetch and, on 401 / Invalid API key, marks the failed key invalid
 * and retries once with WORKING_ANON_KEY regardless of whether init.headers is a Headers object or plain object.
 */
export async function supabaseFetchWithAnonRetry(url: string, init: RequestInit = {}): Promise<Response> {
  let res = await fetch(url, init);
  if (res.status === 401 || !res.ok) {
    let shouldRetry = res.status === 401;
    if (!shouldRetry) {
      const clone = res.clone();
      const bodyText = await clone.text().catch(() => '');
      if (bodyText.toLowerCase().includes('invalid api key')) {
        shouldRetry = true;
      }
    }

    if (shouldRetry) {
      const usedKey = extractApiKeyFromHeaders(init.headers);
      if (usedKey !== WORKING_ANON_KEY) {
        if (usedKey) {
          markSupabaseKeyInvalid(usedKey);
        }
        const retryHeaders = new Headers(init.headers || {});
        retryHeaders.set('apikey', WORKING_ANON_KEY);
        retryHeaders.set('Authorization', `Bearer ${WORKING_ANON_KEY}`);
        res = await fetch(url, {
          ...init,
          headers: retryHeaders,
        });
      }
    }
  }
  return res;
}
