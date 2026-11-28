/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Authoritative Conversation & Thread Ownership Isolation Registry + Verifier
 * - Enforces strict owner-to-conversation binding on /api/ai/chat (Express & Serverless)
 * - Checks both in-memory runtime registry and cold-start Supabase ai_buddy_chats table
 * - Strips foreign user messages via filterHistoryByOwner
 */

const conversationOwnerRegistry = new Map<string, string>();

export function clearConversationOwnerRegistryForTests(): void {
  conversationOwnerRegistry.clear();
}

export function bindConversationOwnerInRegistry(conversationId: string, ownerUserId: string): void {
  const cid = String(conversationId || '').trim();
  const uid = String(ownerUserId || '').trim();
  if (!cid || !uid || uid === 'guest' || uid === 'anonymous' || uid === 'user_guest') return;
  conversationOwnerRegistry.set(cid, uid);
}

export function getBoundConversationOwner(conversationId: string): string | undefined {
  const cid = String(conversationId || '').trim();
  if (!cid) return undefined;
  return conversationOwnerRegistry.get(cid);
}

export function filterHistoryByOwner<T extends { role?: string; content?: any; userId?: string; ownerId?: string }>(
  history: T[],
  actorUserId?: string | null
): T[] {
  if (!Array.isArray(history)) return [];
  const uid = String(actorUserId || '').trim();
  if (!uid) return [];
  return history.filter((item) => {
    if (!item || typeof item !== 'object') return false;
    const itemOwner = String(item.userId || item.ownerId || '').trim();
    if (!itemOwner) return true;
    return itemOwner === uid;
  });
}

export interface ConversationOwnershipCheckResult {
  allowed: boolean;
  ownerId?: string;
  source?: 'registry' | 'database' | 'new';
}

export async function verifyAndBindConversationOwnership(params: {
  conversationId?: string;
  threadId?: string;
  actorUserId: string;
  supabaseUrl?: string;
  supabaseKey?: string;
}): Promise<ConversationOwnershipCheckResult> {
  const actorUid = String(params.actorUserId || '').trim();
  const idsToCheck = Array.from(
    new Set(
      [params.conversationId, params.threadId]
        .map((v) => String(v || '').trim())
        .filter(Boolean)
    )
  );

  if (idsToCheck.length === 0) {
    return { allowed: true, source: 'new' };
  }

  for (const cid of idsToCheck) {
    const existingOwner = getBoundConversationOwner(cid);
    if (existingOwner) {
      if (existingOwner !== actorUid) {
        return { allowed: false, ownerId: existingOwner, source: 'registry' };
      }
      continue;
    }

    // Cold-start lookup against persisted ai_buddy_chats ownership in Supabase
    if (params.supabaseUrl && params.supabaseKey) {
      try {
        const resp = await fetch(
          `${params.supabaseUrl}/rest/v1/ai_buddy_chats?id=eq.${encodeURIComponent(cid)}&select=id,user_id&limit=1`,
          {
            headers: {
              apikey: params.supabaseKey,
              Authorization: `Bearer ${params.supabaseKey}`,
            },
          }
        );
        if (resp.ok) {
          const rows: any = await resp.json().catch(() => []);
          if (Array.isArray(rows) && rows[0]?.user_id) {
            const dbOwner = String(rows[0].user_id).trim();
            bindConversationOwnerInRegistry(cid, dbOwner);
            if (dbOwner !== actorUid) {
              return { allowed: false, ownerId: dbOwner, source: 'database' };
            }
          }
        }
      } catch {
        // Non-fatal network check; still bind new runtime ownership below if not matched
      }
    }

    bindConversationOwnerInRegistry(cid, actorUid);
  }

  return { allowed: true, ownerId: actorUid, source: 'new' };
}
