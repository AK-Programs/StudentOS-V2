/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Cross-Account AI Session & Storage Isolation Utilities
 * Strictly scopes persisted Byte threads, active thread IDs, and streaming
 * async epochs to the currently authenticated user UID so account switches
 * or mid-stream logouts can never leak prompts, replies, or threads.
 */

export interface AiStorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

const LEGACY_UNSCOPED_AI_KEYS = [
  's_os_ai_threads',
  's_os_ai_active_id',
  's_os_ai_buddy_chats',
  'byte_threads',
  'byte_active_thread_id',
] as const;

function sanitizeUidSegment(uid?: string | null): string {
  return String(uid || '')
    .trim()
    .replace(/[^a-zA-Z0-9._@-]/g, '_');
}

function resolveStorage(customStorage?: AiStorageLike | null): AiStorageLike | null {
  if (customStorage) return customStorage;
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage;
    }
  } catch (_) {}
  return null;
}

export function getScopedAiThreadsStorageKey(uid: string): string {
  const clean = sanitizeUidSegment(uid);
  return clean ? `s_os_ai_threads__${clean}` : '';
}

export function getScopedActiveThreadStorageKey(uid: string): string {
  const clean = sanitizeUidSegment(uid);
  return clean ? `s_os_ai_active_id__${clean}` : '';
}

export function purgeLegacyUnscopedAiStorage(storage?: AiStorageLike | null): void {
  const store = resolveStorage(storage);
  if (!store) return;
  for (const key of LEGACY_UNSCOPED_AI_KEYS) {
    try {
      store.removeItem(key);
    } catch (_) {}
  }
}

export function filterThreadsForUser<T extends { id?: string; userId?: string | null }>(
  threads: T[] | null | undefined,
  uid?: string | null
): T[] {
  const cleanUid = String(uid || '').trim();
  if (!cleanUid || !Array.isArray(threads)) return [];
  return threads.filter((t) => {
    if (!t || typeof t !== 'object') return false;
    const owner = String(t.userId || '').trim();
    return owner.length > 0 && owner === cleanUid;
  });
}

export function readScopedAiThreadsFromStorage<T extends { id?: string; userId?: string | null }>(
  uid?: string | null,
  storage?: AiStorageLike | null
): T[] {
  const store = resolveStorage(storage);
  if (!store) return [];
  purgeLegacyUnscopedAiStorage(store);

  const cleanUid = String(uid || '').trim();
  if (!cleanUid) return [];

  const scopedKey = getScopedAiThreadsStorageKey(cleanUid);
  if (!scopedKey) return [];

  try {
    const raw = store.getItem(scopedKey);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return filterThreadsForUser<T>(parsed, cleanUid);
  } catch (_) {
    return [];
  }
}

export function writeScopedAiThreadsToStorage<T extends { id?: string; userId?: string | null }>(
  uid: string | null | undefined,
  threads: T[],
  storage?: AiStorageLike | null
): void {
  const store = resolveStorage(storage);
  if (!store) return;
  purgeLegacyUnscopedAiStorage(store);

  const cleanUid = String(uid || '').trim();
  if (!cleanUid) return;

  const scopedKey = getScopedAiThreadsStorageKey(cleanUid);
  if (!scopedKey) return;

  try {
    const owned = filterThreadsForUser(threads, cleanUid).map((t) => ({
      ...t,
      userId: cleanUid,
    }));
    store.setItem(scopedKey, JSON.stringify(owned));
  } catch (_) {}
}

export function readScopedActiveThreadIdFromStorage(
  uid?: string | null,
  storage?: AiStorageLike | null
): string {
  const store = resolveStorage(storage);
  if (!store) return '';
  purgeLegacyUnscopedAiStorage(store);

  const cleanUid = String(uid || '').trim();
  if (!cleanUid) return '';

  const scopedKey = getScopedActiveThreadStorageKey(cleanUid);
  if (!scopedKey) return '';

  try {
    return String(store.getItem(scopedKey) || '').trim();
  } catch (_) {
    return '';
  }
}

export function writeScopedActiveThreadIdToStorage(
  uid: string | null | undefined,
  threadId: string | null | undefined,
  storage?: AiStorageLike | null
): void {
  const store = resolveStorage(storage);
  if (!store) return;
  purgeLegacyUnscopedAiStorage(store);

  const cleanUid = String(uid || '').trim();
  if (!cleanUid) return;

  const scopedKey = getScopedActiveThreadStorageKey(cleanUid);
  if (!scopedKey) return;

  try {
    const cleanThreadId = String(threadId || '').trim();
    if (!cleanThreadId) {
      store.removeItem(scopedKey);
    } else {
      store.setItem(scopedKey, cleanThreadId);
    }
  } catch (_) {}
}

export function deduplicateThreadsById<
  T extends { id?: string; updatedAt?: number; messages?: any[] }
>(threads: T[] | null | undefined): T[] {
  if (!Array.isArray(threads)) return [];
  const byId = new Map<string, { item: T; order: number }>();
  let order = 0;

  for (const thread of threads) {
    if (!thread || typeof thread !== 'object') continue;
    const cleanId = String(thread.id || '').trim();
    if (!cleanId) continue;

    const existing = byId.get(cleanId);
    if (!existing) {
      byId.set(cleanId, { item: thread, order: order++ });
      continue;
    }

    const prevCount = Array.isArray(existing.item.messages) ? existing.item.messages.length : 0;
    const nextCount = Array.isArray(thread.messages) ? thread.messages.length : 0;
    const prevUpdated = Number(existing.item.updatedAt || 0);
    const nextUpdated = Number(thread.updatedAt || 0);

    if (nextUpdated > prevUpdated || (nextUpdated === prevUpdated && nextCount >= prevCount)) {
      byId.set(cleanId, { item: thread, order: existing.order });
    }
  }

  return Array.from(byId.values())
    .sort((a, b) => a.order - b.order)
    .map((entry) => entry.item);
}

export function isStreamSessionStillOwned(params: {
  currentEpoch: number;
  capturedEpoch: number;
  currentOwnerUid?: string | null;
  capturedOwnerUid?: string | null;
}): boolean {
  const currentUid = String(params.currentOwnerUid || '').trim();
  const capturedUid = String(params.capturedOwnerUid || '').trim();
  if (!currentUid || !capturedUid) return false;
  if (currentUid !== capturedUid) return false;
  if (params.currentEpoch !== params.capturedEpoch) return false;
  return true;
}
