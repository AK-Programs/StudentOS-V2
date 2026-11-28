/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Canonical AI Request Access, Ownership, Health, and Shared Helpers.
 * Zero Express/side-effect imports so both Express (`server.ts`) and Vercel
 * serverless (`api/index.ts`) share identical auth, isolation, and RBAC rules.
 */

import {
  filterHistoryByOwner,
  verifyAndBindConversationOwnership,
} from './aiConversationOwnership';

export interface SupabaseCfg {
  url: string;
  key: string;
}

export const CANONICAL_SUPER_ADMIN_EMAILS = [
  'naitik.kashyap0015@gmail.com',
  'naitik.kashyap5205@gmail.com',
  'superadmin@studentos.edu',
  'superadmin@veylentra.edu',
];

export function isAnonymousActorId(val?: string | null): boolean {
  const clean = String(val || '').trim().toLowerCase();
  return !clean || clean === 'anonymous' || clean === 'guest' || clean === 'user_guest';
}

export function normalizeCanonicalRole(role?: string | null): string {
  const clean = String(role || 'student').toLowerCase().trim();
  if (!clean) return 'student';
  if (clean === 'guardian') return 'parent';
  return clean;
}

export function isParentOrGuardianRole(role?: string | null): boolean {
  const raw = String(role || '').toLowerCase().trim();
  return raw === 'parent' || raw === 'guardian';
}

export function isOrionAllowedRole(role?: string | null): boolean {
  const raw = String(role || '').toLowerCase().trim();
  if (!raw || raw === 'parent' || raw === 'guardian' || raw === 'guest' || raw === 'anonymous') {
    return false;
  }
  return new Set([
    'student',
    'teacher',
    'faculty',
    'head_teacher',
    'coordinator',
    'hod',
    'admin',
    'super_admin',
  ]).has(raw);
}

export function sanitizeChatHistoryServer(history: any[]): { role: 'user' | 'assistant'; content: string }[] {
  if (!Array.isArray(history)) return [];
  const valid: { role: 'user' | 'assistant'; content: string }[] = [];
  for (const item of history) {
    if (!item || typeof item !== 'object') continue;
    const role = item.role === 'model' || item.role === 'assistant' ? 'assistant' : 'user';
    const content =
      typeof item.text === 'string'
        ? item.text
        : typeof item.content === 'string'
        ? item.content
        : '';
    if (content.trim()) {
      valid.push({ role, content: content.trim() });
    }
  }
  return valid;
}

export interface CanonicalHealthOptions {
  runtime: 'express' | 'vercel-serverless';
  groqConfigured: boolean;
  ministralConfigured: boolean;
  zaiConfigured: boolean;
  groqModels: string[];
  ministralModel: string;
  zaiModel: string;
  databaseStatus?: {
    configured: boolean;
    reachable?: boolean;
    status: 'connected' | 'unconfigured' | 'unreachable';
  };
}

export function buildCanonicalAiHealthPayload(opts: CanonicalHealthOptions) {
  const anyProviderConfigured = opts.groqConfigured || opts.ministralConfigured || opts.zaiConfigured;
  return {
    status: anyProviderConfigured ? 'ok' : 'degraded',
    ready: anyProviderConfigured,
    time: new Date().toISOString(),
    runtime: opts.runtime,
    provider: 'multi-provider',
    providers: {
      zai: {
        configured: opts.zaiConfigured,
        model: opts.zaiModel,
      },
      groq: {
        configured: opts.groqConfigured,
        models: opts.groqModels,
      },
      ministral: {
        configured: opts.ministralConfigured,
        model: opts.ministralModel,
      },
    },
    groqConfigured: opts.groqConfigured,
    ministralConfigured: opts.ministralConfigured,
    zaiConfigured: opts.zaiConfigured,
    groqModels: opts.groqModels,
    ministralModel: opts.ministralModel,
    zaiModel: opts.zaiModel,
    ...(opts.databaseStatus ? { database: opts.databaseStatus } : {}),
  };
}

export async function verifySupabaseBearerToken(
  token: string,
  cfg: SupabaseCfg
): Promise<{ id: string; email: string; role: string; user_metadata?: any } | null> {
  if (!token || !cfg.url || !cfg.key) return null;
  try {
    const authRes = await fetch(`${cfg.url}/auth/v1/user`, {
      headers: {
        apikey: cfg.key,
        Authorization: `Bearer ${token}`,
      },
    });
    if (!authRes.ok) return null;
    const user: any = await authRes.json().catch(() => null);
    if (!user || !user.id) return null;

    const email = String(user.email || '').toLowerCase().trim();
    let role = CANONICAL_SUPER_ADMIN_EMAILS.includes(email)
      ? 'super_admin'
      : String(user.user_metadata?.role || 'student').toLowerCase().trim();

    if (!CANONICAL_SUPER_ADMIN_EMAILS.includes(email)) {
      try {
        const profRes = await fetch(
          `${cfg.url}/rest/v1/user_profiles?or=(id.eq.${encodeURIComponent(user.id)},uid.eq.${encodeURIComponent(user.id)},email.eq.${encodeURIComponent(email || user.id)})&select=role`,
          { headers: { apikey: cfg.key, Authorization: `Bearer ${cfg.key}` } }
        );
        if (profRes.ok) {
          const rows: any = await profRes.json().catch(() => []);
          if (Array.isArray(rows) && rows[0]?.role) {
            role = String(rows[0].role).toLowerCase().trim();
          }
        }
      } catch {}
    }

    return {
      id: String(user.id),
      email,
      role,
      user_metadata: user.user_metadata,
    };
  } catch {
    return null;
  }
}

export interface CanonicalChatAccessResult {
  ok: boolean;
  status: number;
  error?: string;
  activeUserId: string;
  activeRole: string;
  isVerifiedJwt: boolean;
  effectiveConversationId: string;
  sanitizedHistory: { role: 'user' | 'assistant'; content: string }[];
}

export async function resolveCanonicalChatAccess(params: {
  headers: Record<string, any>;
  body: Record<string, any>;
  cfg: SupabaseCfg;
  verifyTokenFn?: (token: string, cfg: SupabaseCfg) => Promise<{ id: string; email?: string; role: string; user_metadata?: any } | null>;
}): Promise<CanonicalChatAccessResult> {
  const { headers = {}, body = {}, cfg, verifyTokenFn } = params;
  const authHeader = String(headers.authorization || headers['x-supabase-auth'] || '').trim();
  const bearerToken = authHeader.replace(/^Bearer\s+/i, '').trim();
  const hasBearer = Boolean(bearerToken);

  const headerUid = String(headers['x-veylentra-uid'] || '').trim();
  const headerEmail = String(headers['x-veylentra-email'] || '').toLowerCase().trim();
  const headerRole = String(headers['x-veylentra-role'] || '').toLowerCase().trim();

  const bodyUserId = String(body.userId || '').trim();
  const bodyRole = String(body.userRole || '').toLowerCase().trim();
  const persona = String(body.persona || 'study_buddy').toLowerCase().trim();
  const conversationId = typeof body.conversationId === 'string' ? body.conversationId.trim() : '';
  const threadId = typeof body.threadId === 'string' ? body.threadId.trim() : '';

  const denied = (status: number, error: string): CanonicalChatAccessResult => ({
    ok: false,
    status,
    error,
    activeUserId: '',
    activeRole: 'student',
    isVerifiedJwt: false,
    effectiveConversationId: '',
    sanitizedHistory: [],
  });

  let verifiedUser: { id: string; email?: string; role: string; user_metadata?: any } | null = null;
  if (hasBearer) {
    verifiedUser = verifyTokenFn
      ? await verifyTokenFn(bearerToken, cfg)
      : await verifySupabaseBearerToken(bearerToken, cfg);
    if (!verifiedUser || !verifiedUser.id) {
      return denied(401, 'Invalid or expired authentication token.');
    }

    if (!isAnonymousActorId(bodyUserId) && bodyUserId !== verifiedUser.id) {
      return denied(403, 'Forbidden: authenticated account does not match requested userId.');
    }

    if (!isAnonymousActorId(headerUid) && headerUid !== verifiedUser.id) {
      return denied(403, 'Forbidden: authenticated account does not match session header.');
    }
  } else {
    // Even without Bearer JWT, reject forged cross-user header vs payload UID mismatch
    if (!isAnonymousActorId(headerUid) && !isAnonymousActorId(bodyUserId) && headerUid !== bodyUserId) {
      return denied(403, 'Forbidden: session header UID does not match payload userId.');
    }
  }

  let activeUserId = 'user_guest';
  let activeRole = 'student';

  if (verifiedUser) {
    activeUserId = verifiedUser.id;
    activeRole = String(verifiedUser.role || 'student').toLowerCase().trim();
    const userEmail = String(verifiedUser.email || '').toLowerCase().trim();
    if (CANONICAL_SUPER_ADMIN_EMAILS.includes(userEmail)) {
      activeRole = 'super_admin';
    }
  } else {
    activeUserId = !isAnonymousActorId(bodyUserId)
      ? bodyUserId
      : !isAnonymousActorId(headerUid)
      ? headerUid
      : bodyUserId || 'user_guest';
    activeRole = (bodyRole || headerRole || 'student').toLowerCase().trim();
    if (
      (headerEmail && CANONICAL_SUPER_ADMIN_EMAILS.includes(headerEmail)) ||
      CANONICAL_SUPER_ADMIN_EMAILS.includes(activeUserId.toLowerCase())
    ) {
      activeRole = 'super_admin';
    }
  }

  // Mandatory security rule: Parent & Guardian accounts are strictly excluded from Orion.
  if (persona === 'orion' && isParentOrGuardianRole(activeRole)) {
    return denied(403, 'Forbidden: Orion Academic Agent is unavailable for Parent and Guardian accounts.');
  }

  const ownership = await verifyAndBindConversationOwnership({
    conversationId,
    threadId,
    actorUserId: activeUserId,
    supabaseUrl: cfg.url,
    supabaseKey: cfg.key,
  });

  if (!ownership.allowed) {
    return denied(403, 'Forbidden: conversation belongs to another account.');
  }

  const ownerFilteredHistory = filterHistoryByOwner(
    Array.isArray(body.history) ? body.history : [],
    activeUserId
  );

  return {
    ok: true,
    status: 200,
    activeUserId,
    activeRole,
    isVerifiedJwt: Boolean(verifiedUser),
    effectiveConversationId: conversationId || threadId || '',
    sanitizedHistory: sanitizeChatHistoryServer(ownerFilteredHistory),
  };
}
