/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Client In-Memory Server Session & Auth Header Helper
 * Security Guarantee:
 * - Non-Supabase custom signed session tokens (`vlt_sess.`) are stored STRICTLY in
 *   JavaScript module memory (never written to localStorage or sessionStorage).
 * - Never attaches client-spoofed `x-veylentra-uid` / `x-veylentra-role` headers for auth.
 */

import { supabase } from './supabase';

let inMemorySessionToken: string | null = null;
let inMemorySessionUid: string | null = null;
let inflightDemoPromise: Promise<string | null> | null = null;

export function setClientSessionToken(token: string | null | undefined, uid?: string | null): void {
  const clean = typeof token === 'string' ? token.trim() : '';
  inMemorySessionToken = clean || null;
  inMemorySessionUid = clean && uid ? String(uid).trim() : clean ? inMemorySessionUid : null;
}

export function clearClientSessionToken(): void {
  inMemorySessionToken = null;
  inMemorySessionUid = null;
  inflightDemoPromise = null;
}

export function getClientSessionToken(): string | null {
  return inMemorySessionToken;
}

export function getClientSessionUid(): string | null {
  return inMemorySessionUid;
}

export async function establishDemoSession(uidOrRole: string = 'demo-student-uid'): Promise<string | null> {
  if (typeof fetch !== 'function') return null;
  if (inflightDemoPromise) return inflightDemoPromise;

  const target = String(uidOrRole || 'demo-student-uid').trim();
  const payload =
    target === 'parent' || target === 'demo-parent-uid'
      ? { userId: 'demo-parent-uid', role: 'parent' }
      : { userId: 'demo-student-uid', role: 'student' };

  inflightDemoPromise = (async () => {
    try {
      const resp = await fetch('/api/auth/demo-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json: any = await resp.json().catch(() => null);
      if (resp.ok && json?.sessionToken) {
        setClientSessionToken(String(json.sessionToken), json?.profile?.uid || payload.userId);
        return String(json.sessionToken);
      }
      return null;
    } catch {
      return null;
    } finally {
      inflightDemoPromise = null;
    }
  })();

  return inflightDemoPromise;
}

export async function getActiveServerToken(): Promise<string> {
  try {
    const { data } = await supabase.auth.getSession();
    const supaToken = data?.session?.access_token;
    if (supaToken) return supaToken;
  } catch {
    // Supabase may be unavailable in the restricted demo/offline experience.
  }

  // App startup establishes the restricted demo token asynchronously. Wait for
  // that exact request before allowing concurrent AI/usage calls to race ahead
  // with missing Authorization headers and generate repeated 401 toasts.
  if (!inMemorySessionToken && inflightDemoPromise) {
    await inflightDemoPromise;
  }

  return inMemorySessionToken || '';
}

export async function getServerAuthHeaders(options?: {
  includeContentType?: boolean;
  acceptSse?: boolean;
}): Promise<Record<string, string>> {
  const headers: Record<string, string> = {};
  if (options?.includeContentType !== false) {
    headers['Content-Type'] = 'application/json';
  }
  if (options?.acceptSse) {
    headers['Accept'] = 'text/event-stream, application/json';
  }

  const token = await getActiveServerToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
    if (token.startsWith('vlt_sess.')) {
      headers['x-veylentra-session'] = token;
    }
  }

  return headers;
}

export function extractApiErrorMessage(payload: any, fallback: string = 'Request failed.'): string {
  if (!payload || typeof payload !== 'object') return fallback;
  if (payload.error && typeof payload.error === 'object' && typeof payload.error.message === 'string') {
    return payload.error.message.trim() || fallback;
  }
  if (typeof payload.error === 'string' && payload.error.trim()) {
    return payload.error.trim();
  }
  if (typeof payload.message === 'string' && payload.message.trim()) {
    return payload.message.trim();
  }
  if (typeof payload.details === 'string' && payload.details.trim()) {
    return payload.details.trim();
  }
  if (typeof payload.finalResponse === 'string' && payload.finalResponse.trim()) {
    return payload.finalResponse.trim();
  }
  return fallback;
}
