// Stub file replacing Firebase completely with Supabase-backed or mockup variables.
// No firebase imports are present.

export const auth: any = {
  currentUser: null
};

export const db: any = {};
export const storage: any = {};

export class GoogleAuthProvider {
  setCustomParameters(...args: any[]) {}
}

export async function signInWithPopup(...args: any[]) {
  return { user: null };
}

export async function signOut(...args: any[]) {}

export function doc(...args: any[]): any { return {}; }
export function collection(...args: any[]): any { return {}; }
export function query(...args: any[]): any { return {}; }
export function where(...args: any[]): any { return {}; }
export function onSnapshot(...args: any[]): any { return () => {}; }
export async function setDoc(...args: any[]) {}
export async function updateDoc(...args: any[]) {}
export async function deleteDoc(...args: any[]) {}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  console.error('[STUB] Firestore Error Handled:', error, operationType, path);
  throw error;
}

export const sendNotificationToUsers = async (data: any) => {
  console.log('[STUB] Send notification to users:', data);
  const event = new CustomEvent('s_os_notification_created', { detail: data });
  window.dispatchEvent(event);
};
