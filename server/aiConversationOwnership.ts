/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Server-Side AI Conversation Ownership & History Isolation Registry
 * Prevents cross-account conversation/thread hijacking, enforces cold-start
 * Supabase ai_buddy_chats ownership checks, and filters leaked foreign turns.
 */

const conversationOwnerRegistry = new Map<string, string>();
const MAX_REGISTRY_ENTRIES = 10000;

export function clearConversationOwnerRegistryForTests(): void {
  conversationOwnerRegistry.clear();
}

export function getBoundConversationOwner(conversationId?: string | null): string | null {
  const id = String(conversationId || '').trim();
  if (!id) return null;
  return conversationOwnerRegistry.get(id) || null;
}

export function bindConversationOwnerInRegistry(
  conversationId?: string | null,
  ownerUid?: string | null
): boolean {
  const id = String(conversationId || '').trim();
  const uid = String(ownerUid || '').trim();
  if (!id || !uid) return false;

  const existing = conversationOwnerRegistry.get(id);
  if (existing && existing !== uid) {
    return false;
  }

  if (conversationOwnerRegistry.size >= MAX_REGISTRY_ENTRIES && !existing) {
    const oldestKey = conversationOwnerRegistry.keys().next().value;
    if (oldestKey) conversationOwnerRegistry.delete(oldestKey);
  }
  conversationOwnerRegistry.set(id, uid);
  return true;
}

export function filterHistoryByOwner<
  T extends { role?: string; content?: string; userId?: string | null; ownerUid?: string | null }
>(history: T[] | null | undefined, actorUid?: string | null): T[] {
  if (!Array.isArray(history)) return [];
  const cleanActor = String(actorUid || '').trim();
  return history.filter((item) => {
    if (!item || typeof item !== 'object') return false;
    const itemOwner = String(item.userId || item.ownerUid || '').trim();
    if (!itemOwner) return true;
    if (!cleanActor) return false;
    return itemOwner === cleanActor;
  });
}

export async function verifyAndBindConversationOwnership(params: {
  cfg?: { url: string; key: string } | null;
  conversationId?: string | null;
  actorUid?: string | null;
  fetchFn?: typeof fetch;
}): Promise<{ allowed: boolean; status?: number; error?: string; reason?: string; ownerUid?: string | null }> {
  const convId = String(params.conversationId || '').trim();
  const actorUid = String(params.actorUid || '').trim();

  if (!convId) {
    return { allowed: true, ownerUid: actorUid || null };
  }
  if (!actorUid || actorUid === 'anonymous' || actorUid === 'guest' || actorUid === 'usr_anonymous') {
    const errorMsg = 'Authentication is required to access or bind a conversation thread.';
    return {
      allowed: false,
      status: 401,
      error: errorMsg,
      reason: errorMsg,
    };
  }

  const inMemOwner = getBoundConversationOwner(convId);
  if (inMemOwner && inMemOwner !== actorUid) {
    const errorMsg = 'Forbidden: this conversation thread belongs to another user account.';
    return {
      allowed: false,
      status: 403,
      error: errorMsg,
      reason: errorMsg,
      ownerUid: inMemOwner,
    };
  }

  // Cold-start authoritative check against Supabase ai_buddy_chats if not yet bound in memory
  if (!inMemOwner && params.cfg?.url && params.cfg?.key) {
    const fetcher = params.fetchFn || globalThis.fetch;
    try {
      const lookupUrl = `${params.cfg.url}/rest/v1/ai_buddy_chats?id=eq.${encodeURIComponent(convId)}&select=id,user_id&limit=1`;
      const resp = await fetcher(lookupUrl, {
        headers: {
          apikey: params.cfg.key,
          Authorization: `Bearer ${params.cfg.key}`,
        },
      });
      if (resp.ok) {
        const rows: any = await resp.json().catch(() => []);
        const row = Array.isArray(rows) ? rows[0] : null;
        const dbOwner = String(row?.user_id || '').trim();
        if (dbOwner) {
          bindConversationOwnerInRegistry(convId, dbOwner);
          if (dbOwner !== actorUid) {
            const errorMsg = 'Forbidden: this conversation thread is owned by another account.';
            return {
              allowed: false,
              status: 403,
              error: errorMsg,
              reason: errorMsg,
              ownerUid: dbOwner,
            };
          }
          return { allowed: true, ownerUid: dbOwner };
        }
      }
    } catch (_) {
      // Fall through only if registry had no conflict; do not leak across users
    }
  }

  const bound = bindConversationOwnerInRegistry(convId, actorUid);
  if (!bound) {
    const conflictOwner = getBoundConversationOwner(convId);
    const errorMsg = 'Forbidden: conversation ownership conflict detected.';
    return {
      allowed: false,
      status: 403,
      error: errorMsg,
      reason: errorMsg,
      ownerUid: conflictOwner,
    };
  }
  return { allowed: true, ownerUid: actorUid };
}
