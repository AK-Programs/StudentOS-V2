/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Supabase Key Manager & Working Anon Key Fallback
 * - Hardcodes the known working Supabase anon key for project zwpoutanhsujezglbson.
 * - Detects invalid/expired/mismatched API keys.
 * - Tracks known bad keys in-memory so subsequent requests do not repeat 401s.
 */

export const WORKING_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp3cG91dGFuaHN1amV6Z2xic29uIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE2OTA2MDEsImV4cCI6MjA5NzI2NjYwMX0.Y48u9duD3WohxzDD6czXevPaG1mFRFS0rdRuu4840pQ';

export const knownInvalidSupabaseKeys = new Set<string>();

export function markSupabaseKeyInvalid(key?: string | null): void {
  if (key && typeof key === 'string') {
    const trimmed = key.trim();
    if (trimmed && trimmed !== WORKING_ANON_KEY) {
      knownInvalidSupabaseKeys.add(trimmed);
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
