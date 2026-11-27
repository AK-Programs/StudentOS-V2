/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Canonical Server-Side Session & Identity Verification
 * - Cryptographically verifies Supabase Bearer JWTs against Supabase Auth.
 * - Issues & verifies HMAC-SHA256 expiring server session tokens (`vlt_sess.<payload>.<sig>`)
 *   exclusively after server-side password/PIN verification or restricted non-privileged demo sandbox entry.
 * - NEVER trusts client-supplied `x-veylentra-uid`, `x-veylentra-email`, `x-veylentra-role`,
 *   body `userId`/`userRole`, or unverified base64 JWT payload decoding.
 */

import crypto from 'node:crypto';
import { getSupabaseServerConfig } from './runtimeConfig.js';
import { getFeatureAndWinterSupabaseKey, WORKING_ANON_KEY } from './supabaseKeyManager.js';

export interface SupabaseConnectionCfg {
  url: string;
  key: string;
}

export interface VerifiedSessionActor {
  userId: string;
  email?: string;
  name: string;
  role: string;
  grade?: string;
  section?: string;
  schoolId?: string;
  assignedGrades?: string[];
  assignedSections?: string[];
  assignedClasses?: string[];
  sessionType: 'supabase_jwt' | 'signed_session';
  authenticated: boolean;
  authToken?: string;
}

export interface SignedSessionClaims {
  v: 1;
  uid: string;
  email?: string;
  name: string;
  role: string;
  grade?: string;
  section?: string;
  schoolId?: string;
  assignedGrades?: string[];
  assignedSections?: string[];
  assignedClasses?: string[];
  sessionType: 'login' | 'demo' | 'pin';
  iat: number;
  exp: number;
}

const DEFAULT_SESSION_TTL_MS = 12 * 60 * 60 * 1000;

const VALID_SERVER_SESSION_PREFIX = 'vlt_sess.';

const SAFE_DEMO_PERSONAS: Record<
  string,
  { uid: string; name: string; email: string; role: 'student' | 'parent'; grade?: string; section?: string }
> = {
  'demo-student-uid': {
    uid: 'demo-student-uid',
    name: 'Aarav Sharma',
    email: 'student@demo.com',
    role: 'student',
    grade: 'Grade 10',
    section: 'Astra',
  },
  'demo-parent-uid': {
    uid: 'demo-parent-uid',
    name: 'Rajesh Kashyap',
    email: 'parent@demo.com',
    role: 'parent',
  },
};

function getSessionSigningSecret(): string {
  const envSecret =
    process.env.SESSION_SIGNING_SECRET ||
    process.env.VEYLENTRA_SESSION_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    '';
  const cleaned = String(envSecret).trim();
  if (cleaned.length >= 16) return cleaned;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('SESSION_SIGNING_SECRET is not configured. Set a stable server-side SESSION_SIGNING_SECRET (at least 16 characters) or SUPABASE_SERVICE_ROLE_KEY in the hosting environment.');
  }
  // Local development/tests may use a process-scoped fallback. Never rely on it in production.
  return 'veylentra-local-development-session-secret';
}

function toBase64Url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function fromBase64Url(input: string): Buffer {
  const padded = input.replace(/-/g, '+').replace(/_/g, '/');
  const padLen = (4 - (padded.length % 4)) % 4;
  return Buffer.from(padded + '='.repeat(padLen), 'base64');
}

function signHmac(payloadB64: string): Buffer {
  return crypto.createHmac('sha256', getSessionSigningSecret()).update(payloadB64).digest();
}

export function createSignedSessionToken(params: {
  uid: string;
  email?: string;
  name: string;
  role: string;
  grade?: string;
  section?: string;
  schoolId?: string;
  assignedGrades?: string[];
  assignedSections?: string[];
  assignedClasses?: string[];
  sessionType: 'login' | 'demo' | 'pin';
  ttlMs?: number;
}): { token: string; claims: SignedSessionClaims } {
  const now = Date.now();
  const ttl = typeof params.ttlMs === 'number' && params.ttlMs > 0 ? params.ttlMs : DEFAULT_SESSION_TTL_MS;
  const claims: SignedSessionClaims = {
    v: 1,
    uid: String(params.uid).trim(),
    email: params.email ? String(params.email).trim().toLowerCase() : undefined,
    name: String(params.name || 'Campus Member').trim(),
    role: String(params.role || 'student').trim().toLowerCase(),
    grade: params.grade ? String(params.grade).trim() : undefined,
    section: params.section ? String(params.section).trim() : undefined,
    schoolId: params.schoolId ? String(params.schoolId).trim() : undefined,
    ...(Array.isArray(params.assignedGrades) ? { assignedGrades: params.assignedGrades } : {}),
    ...(Array.isArray(params.assignedSections) ? { assignedSections: params.assignedSections } : {}),
    ...(Array.isArray(params.assignedClasses) ? { assignedClasses: params.assignedClasses } : {}),
    sessionType: params.sessionType,
    iat: now,
    exp: now + ttl,
  };
  const payloadB64 = toBase64Url(JSON.stringify(claims));
  const sigB64 = toBase64Url(signHmac(payloadB64));
  return {
    token: `${VALID_SERVER_SESSION_PREFIX}${payloadB64}.${sigB64}`,
    claims,
  };
}

export function verifySignedSessionToken(rawToken?: string | null): SignedSessionClaims | null {
  const token = String(rawToken || '').trim();
  if (!token.startsWith(VALID_SERVER_SESSION_PREFIX)) return null;
  const body = token.slice(VALID_SERVER_SESSION_PREFIX.length);
  const dotIdx = body.indexOf('.');
  if (dotIdx <= 0) return null;

  const payloadB64 = body.slice(0, dotIdx);
  const sigB64 = body.slice(dotIdx + 1);
  if (!payloadB64 || !sigB64) return null;

  let expectedSig: Buffer;
  let actualSig: Buffer;
  try {
    expectedSig = signHmac(payloadB64);
    actualSig = fromBase64Url(sigB64);
  } catch {
    return null;
  }

  if (expectedSig.length !== actualSig.length || !crypto.timingSafeEqual(expectedSig, actualSig)) {
    return null;
  }

  try {
    const parsed = JSON.parse(fromBase64Url(payloadB64).toString('utf8')) as SignedSessionClaims;
    if (!parsed || parsed.v !== 1 || !parsed.uid || !parsed.role) return null;
    if (typeof parsed.exp !== 'number' || parsed.exp <= Date.now()) return null;
    const uidLower = parsed.uid.toLowerCase();
    if (['guest', 'anonymous', 'user_guest'].includes(uidLower)) return null;
    return {
      ...parsed,
      role: String(parsed.role).toLowerCase().trim(),
    };
  } catch {
    return null;
  }
}

export function issueRestrictedDemoSession(targetUidOrRole?: string | null):
  | { ok: true; token: string; claims: SignedSessionClaims; profile: Record<string, any>; status?: never; error?: never }
  | { ok: false; status: number; error: string; token?: never; claims?: never; profile?: never } {
  const raw = String(targetUidOrRole || 'demo-student-uid').trim().toLowerCase();
  const normalizedKey =
    raw === 'student' || raw === 'demo-student-uid'
      ? 'demo-student-uid'
      : raw === 'parent' || raw === 'demo-parent-uid'
        ? 'demo-parent-uid'
        : raw;

  const persona = SAFE_DEMO_PERSONAS[normalizedKey];
  if (!persona) {
    return {
      ok: false,
      status: 403,
      error: 'Demo session tokens are restricted to sandbox student/parent previews. Privileged roles require authenticated sign-in.',
    };
  }

  const { token, claims } = createSignedSessionToken({
    uid: persona.uid,
    email: persona.email,
    name: persona.name,
    role: persona.role,
    grade: persona.grade,
    section: persona.section,
    sessionType: 'demo',
    ttlMs: 4 * 60 * 60 * 1000,
  });

  return {
    ok: true,
    token,
    claims,
    profile: {
      uid: persona.uid,
      name: persona.name,
      email: persona.email,
      role: persona.role,
      grade: persona.grade || '',
      section: persona.section || '',
      accountStatus: 'approved',
      isDemo: true,
    },
  };
}

function getHeaderCaseInsensitive(headers: Record<string, any> | undefined, name: string): string {
  if (!headers || typeof headers !== 'object') return '';
  const target = name.toLowerCase();
  for (const key of Object.keys(headers)) {
    if (key.toLowerCase() === target && headers[key] !== undefined && headers[key] !== null) {
      const val = Array.isArray(headers[key]) ? headers[key][0] : headers[key];
      return String(val).trim();
    }
  }
  return '';
}

export function extractBearerOrSessionToken(headers: Record<string, any> | undefined): {
  token: string;
  isSignedSession: boolean;
  hasAttemptedAuth: boolean;
} {
  const authHeader = getHeaderCaseInsensitive(headers, 'authorization');
  const supabaseAuthHeader = getHeaderCaseInsensitive(headers, 'x-supabase-auth');
  const veylentraSessionHeader = getHeaderCaseInsensitive(headers, 'x-veylentra-session');

  const rawBearer = (authHeader || supabaseAuthHeader).replace(/^Bearer\s+/i, '').trim();
  if (rawBearer) {
    return {
      token: rawBearer,
      isSignedSession: rawBearer.startsWith(VALID_SERVER_SESSION_PREFIX),
      hasAttemptedAuth: true,
    };
  }
  if (veylentraSessionHeader) {
    return {
      token: veylentraSessionHeader,
      isSignedSession: veylentraSessionHeader.startsWith(VALID_SERVER_SESSION_PREFIX),
      hasAttemptedAuth: true,
    };
  }
  return { token: '', isSignedSession: false, hasAttemptedAuth: false };
}

export async function resolveVerifiedActor(params: {
  headers?: Record<string, any>;
  cfg?: SupabaseConnectionCfg | null;
  fetchFn?: typeof fetch;
}): Promise<
  | { ok: true; actor: VerifiedSessionActor; status?: never; error?: never }
  | { ok: false; actor?: never; status: number; error: string }
> {
  const headers = params.headers || {};
  const { token, isSignedSession, hasAttemptedAuth } = extractBearerOrSessionToken(headers);

  if (!hasAttemptedAuth || !token) {
    return {
      ok: false,
      status: 401,
      error: 'Authentication required. Please sign in to continue.',
    };
  }

  // 1. Server-signed expiring session token (`vlt_sess.`)
  if (isSignedSession || token.startsWith(VALID_SERVER_SESSION_PREFIX)) {
    const claims = verifySignedSessionToken(token);
    if (!claims) {
      return {
        ok: false,
        status: 401,
        error: 'Invalid or expired session token. Please sign in again.',
      };
    }
    return {
      ok: true,
      actor: {
        userId: claims.uid,
        email: claims.email,
        name: claims.name,
        role: claims.role,
        grade: claims.grade,
        section: claims.section,
        schoolId: claims.schoolId,
        assignedGrades: claims.assignedGrades,
        assignedSections: claims.assignedSections,
        assignedClasses: claims.assignedClasses,
        sessionType: 'signed_session',
        authenticated: true,
        authToken: token,
      },
    };
  }

  // 2. Cryptographic/server verification of Supabase Bearer JWT via /auth/v1/user
  const resolvedCfg = params.cfg && params.cfg.url ? params.cfg : getSupabaseServerConfig();
  const cfgKey = resolvedCfg.key || WORKING_ANON_KEY;
  if (!resolvedCfg.url || !cfgKey) {
    return {
      ok: false,
      status: 503,
      error: 'Authentication provider configuration unavailable.',
    };
  }

  const fetcher = params.fetchFn || globalThis.fetch;
  try {
    const userRes = await fetcher(`${resolvedCfg.url}/auth/v1/user`, {
      headers: {
        apikey: cfgKey,
        Authorization: `Bearer ${token}`,
      },
    });

    if (!userRes.ok) {
      return {
        ok: false,
        status: 401,
        error: 'Invalid or expired authentication token.',
      };
    }

    const user: any = await userRes.json().catch(() => null);
    if (!user || !user.id) {
      return {
        ok: false,
        status: 401,
        error: 'Invalid authentication session.',
      };
    }

    const email = String(user.email || '').toLowerCase().trim();
    let role = String(user.user_metadata?.role || 'student').toLowerCase().trim();
    let name = String(
      user.user_metadata?.name || user.user_metadata?.full_name || (email ? email.split('@')[0] : 'Campus Member')
    );
    let grade = String(user.user_metadata?.grade || '');
    let section = String(user.user_metadata?.section || '');
    let schoolId = String(user.user_metadata?.school_id || '');
    let assignedGrades: string[] | undefined = Array.isArray(user.user_metadata?.assigned_grades)
      ? user.user_metadata.assigned_grades.map(String)
      : undefined;
    let assignedSections: string[] | undefined = Array.isArray(user.user_metadata?.assigned_sections)
      ? user.user_metadata.assigned_sections.map(String)
      : undefined;
    let assignedClasses: string[] | undefined = Array.isArray(user.user_metadata?.assigned_classes)
      ? user.user_metadata.assigned_classes.map(String)
      : undefined;

    // Authoritative user_profiles DB role & metadata lookup (never trusts client headers)
    try {
      const lookupKey = getFeatureAndWinterSupabaseKey(resolvedCfg.url, cfgKey);
      const profRes = await fetcher(
        `${resolvedCfg.url}/rest/v1/user_profiles?or=(id.eq.${encodeURIComponent(user.id)},uid.eq.${encodeURIComponent(user.id)},email.eq.${encodeURIComponent(email || user.id)})&select=id,name,role,grade,section,school_id,raw_data`,
        {
          headers: {
            apikey: lookupKey,
            Authorization: `Bearer ${lookupKey}`,
          },
        }
      );
      if (profRes.ok) {
        const rows: any = await profRes.json().catch(() => []);
        if (Array.isArray(rows) && rows[0]) {
          if (rows[0].role) role = String(rows[0].role).toLowerCase().trim();
          if (rows[0].name) name = String(rows[0].name).trim();
          if (rows[0].grade) grade = String(rows[0].grade).trim();
          if (rows[0].section) section = String(rows[0].section).trim();
          if (rows[0].school_id) schoolId = String(rows[0].school_id).trim();
          if (Array.isArray(rows[0].raw_data?.assignedGrades)) {
            assignedGrades = rows[0].raw_data.assignedGrades.map(String);
          }
          if (Array.isArray(rows[0].raw_data?.assignedSections)) {
            assignedSections = rows[0].raw_data.assignedSections.map(String);
          }
          if (Array.isArray(rows[0].raw_data?.assignedClasses)) {
            assignedClasses = rows[0].raw_data.assignedClasses.map(String);
          }
        }
      }
    } catch {
      // Non-fatal: retain metadata verified directly from Supabase Auth user record
    }

    return {
      ok: true,
      actor: {
        userId: String(user.id),
        email: email || undefined,
        name,
        role: role || 'student',
        grade: grade || undefined,
        section: section || undefined,
        schoolId: schoolId || undefined,
        assignedGrades,
        assignedSections,
        assignedClasses,
        sessionType: 'supabase_jwt',
        authenticated: true,
        authToken: token,
      },
    };
  } catch (err: any) {
    return {
      ok: false,
      status: 502,
      error: err?.message || 'Unable to reach authentication verification service.',
    };
  }
}

export function normalizePublicErrorMessage(err: any, fallback = 'Request failed on server.'): string {
  const raw = String(err?.message || err || fallback).trim();
  if (!raw) return fallback;
  // Strip any internal file paths or stack traces from client-facing responses
  return raw
    .split('\n')[0]
    .replace(/\/[a-zA-Z0-9_.\-\/]+\.(ts|tsx|js|cjs|mjs)(:\d+:\d+)?/g, '[server]')
    .slice(0, 320);
}

export function buildErrorEnvelope(params: {
  code: string;
  message: string;
  requestId: string;
  statusText?: string;
  extra?: Record<string, any>;
}): Record<string, any> {
  return {
    success: false,
    ...(params.statusText ? { status: params.statusText } : {}),
    error: {
      code: params.code,
      message: params.message,
      requestId: params.requestId,
    },
    message: params.message,
    requestId: params.requestId,
    ...(params.extra || {}),
  };
}
 