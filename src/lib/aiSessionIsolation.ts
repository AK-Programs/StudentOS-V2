/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Strict Per-User AI Session & Storage Isolation Utilities
 * - Scopes thread & active-thread keys strictly to UID
 * - Purges legacy unscoped keys (s_os_ai_threads, s_os_ai_active_id)
 * - Prevents cross-account stream chunk bleed via epoch + UID checks
 */

export interface StorageLike {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
}

const LEGACY_UNSCOPED_KEYS = [
  's_os_ai_threads',
  's_os_ai_active_id',
  'byte_ai_threads',
  'byte_active_thread_id',
];

function getDefaultStorage(): StorageLike | null {
  if (typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage;
  }
  return null;
}

export function getScopedAiThreadsStorageKey(userId?: string | null): string {
  const uid = String(userId || '').trim();
  return uid ? `veylentra_ai_threads__${uid}` : 'veylentra_ai_threads__guest';
}

export function getScopedActiveThreadStorageKey(userId?: string | null): string {
  const uid = String(userId || '').trim();
  return uid ? `veylentra_ai_active_id__${uid}` : 'veylentra_ai_active_id__guest';
}

export function purgeLegacyUnscopedAiStorage(storage: StorageLike | null = getDefaultStorage()): void {
  if (!storage) return;
  for (const key of LEGACY_UNSCOPED_KEYS) {
    try {
      storage.removeItem(key);
    } catch {}
  }
}

export function filterThreadsForUser<T extends { userId?: string }>(
  threads: T[],
  userId?: string | null
): T[] {
  const uid = String(userId || '').trim();
  if (!uid || !Array.isArray(threads)) return [];
  return threads.filter((t) => Boolean(t && typeof t === 'object' && t.userId === uid));
}

export function readScopedAiThreadsFromStorage<T extends { userId?: string } = any>(
  userId?: string | null,
  storage: StorageLike | null = getDefaultStorage()
): T[] {
  purgeLegacyUnscopedAiStorage(storage);
  const uid = String(userId || '').trim();
  if (!uid || !storage) return [];
  try {
    const raw = storage.getItem(getScopedAiThreadsStorageKey(uid));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return filterThreadsForUser(parsed, uid) as T[];
  } catch {
    return [];
  }
}

export function writeScopedAiThreadsToStorage<T extends { userId?: string }>(
  userId: string | null | undefined,
  threads: T[],
  storage: StorageLike | null = getDefaultStorage()
): void {
  purgeLegacyUnscopedAiStorage(storage);
  const uid = String(userId || '').trim();
  if (!uid || !storage) return;
  try {
    const owned = filterThreadsForUser(threads, uid);
    storage.setItem(getScopedAiThreadsStorageKey(uid), JSON.stringify(owned));
  } catch {}
}

export function readScopedActiveThreadIdFromStorage(
  userId?: string | null,
  storage: StorageLike | null = getDefaultStorage()
): string {
  purgeLegacyUnscopedAiStorage(storage);
  const uid = String(userId || '').trim();
  if (!uid || !storage) return '';
  try {
    return storage.getItem(getScopedActiveThreadStorageKey(uid)) || '';
  } catch {
    return '';
  }
}

export function writeScopedActiveThreadIdToStorage(
  userId: string | null | undefined,
  threadId: string,
  storage: StorageLike | null = getDefaultStorage()
): void {
  purgeLegacyUnscopedAiStorage(storage);
  const uid = String(userId || '').trim();
  if (!uid || !storage) return;
  try {
    if (threadId) {
      storage.setItem(getScopedActiveThreadStorageKey(uid), threadId);
    } else {
      storage.removeItem(getScopedActiveThreadStorageKey(uid));
    }
  } catch {}
}

export function isStreamSessionStillOwned(params: {
  currentEpoch: number;
  capturedEpoch: number;
  currentOwnerUid?: string | null;
  capturedOwnerUid?: string | null;
}): boolean {
  const curUid = String(params.currentOwnerUid || '').trim();
  const capUid = String(params.capturedOwnerUid || '').trim();
  if (!curUid || !capUid) return false;
  if (params.currentEpoch !== params.capturedEpoch) return false;
  return curUid === capUid;
}
