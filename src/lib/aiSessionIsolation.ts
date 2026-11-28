/** Byte threads stay on the signed-in account. Does not change layout. */
export function filterThreadsForUser<T extends { userId?: string | null }>(
  threads: T[] | null | undefined,
  uid?: string | null
): T[] {
  const id = String(uid || '').trim();
  if (!id || !Array.isArray(threads)) return [];
  return threads.filter((t) => String(t?.userId || '').trim() === id);
}

export function scopedThreadKey(uid: string): string {
  return `s_os_ai_threads__${String(uid || '').replace(/[^a-zA-Z0-9._@-]/g, '_')}`;
}
