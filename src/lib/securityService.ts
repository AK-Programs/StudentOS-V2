import { supabase } from './supabase';

export interface SecurityStatus {
  isLocked: boolean;
  hasPinConfigured: boolean;
  lockedAt: string | null;
  lockedBy: string | null;
  isRateLimited: boolean;
  retryAfterSeconds: number;
}

export async function getSecurityStatus(): Promise<SecurityStatus> {
  try {
    const res = await fetch('/api/security/status');
    if (res.ok) {
      const data = await res.json();
      return {
        isLocked: Boolean(data.isLocked),
        hasPinConfigured: Boolean(data.hasPinConfigured),
        lockedAt: data.lockedAt || null,
        lockedBy: data.lockedBy || null,
        isRateLimited: Boolean(data.isRateLimited),
        retryAfterSeconds: Number(data.retryAfterSeconds || 0)
      };
    }
  } catch (err) {
    console.warn('[SecurityClient] Failed to fetch server status, checking Supabase directly:', err);
  }

  // Fallback direct check against Supabase
  try {
    const { data } = await supabase
      .from('workspace_security')
      .select('*')
      .eq('id', 'global_workspace')
      .maybeSingle();

    if (data) {
      return {
        isLocked: Boolean(data.is_locked),
        hasPinConfigured: Boolean(data.pin_hash),
        lockedAt: data.locked_at || null,
        lockedBy: data.locked_by || null,
        isRateLimited: false,
        retryAfterSeconds: 0
      };
    }
  } catch (supabaseErr) {
    console.error('[SecurityClient] Supabase fallback check error:', supabaseErr);
  }

  return {
    isLocked: false,
    hasPinConfigured: false,
    lockedAt: null,
    lockedBy: null,
    isRateLimited: false,
    retryAfterSeconds: 0
  };
}

export async function lockWorkspace(params?: { userId?: string; userName?: string }): Promise<{ success: boolean; isLocked?: boolean; error?: string }> {
  try {
    const res = await fetch('/api/security/lock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params || {})
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      return { success: false, error: data.error || 'Failed to lock workspace' };
    }
    return { success: true, isLocked: true };
  } catch (err: any) {
    console.error('[SecurityClient] lock error:', err);
    return { success: false, error: 'Network error while attempting to lock workspace.' };
  }
}

export async function unlockWorkspace(pin: string): Promise<{ success: boolean; isLocked?: boolean; error?: string; isRateLimited?: boolean; retryAfterSeconds?: number }> {
  try {
    const res = await fetch('/api/security/unlock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin })
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      return {
        success: false,
        error: data.error || 'Incorrect security PIN.',
        isRateLimited: Boolean(data.isRateLimited),
        retryAfterSeconds: data.retryAfterSeconds || 0
      };
    }
    return { success: true, isLocked: false };
  } catch (err: any) {
    console.error('[SecurityClient] unlock error:', err);
    return { success: false, error: 'Network error during unlock verification. Check connection.' };
  }
}

export async function setWorkspacePin(newPin: string, currentPin?: string, userId?: string): Promise<{ success: boolean; error?: string; isRateLimited?: boolean; retryAfterSeconds?: number }> {
  try {
    const res = await fetch('/api/security/set-pin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin: newPin, currentPin, userId })
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      return {
        success: false,
        error: data.error || 'Failed to save security PIN.',
        isRateLimited: Boolean(data.isRateLimited),
        retryAfterSeconds: data.retryAfterSeconds || 0
      };
    }
    return { success: true };
  } catch (err: any) {
    console.error('[SecurityClient] set-pin error:', err);
    return { success: false, error: 'Network error while saving security PIN.' };
  }
}

export async function verifySecurityPin(pin: string): Promise<{ success: boolean; error?: string; isRateLimited?: boolean; retryAfterSeconds?: number }> {
  try {
    const res = await fetch('/api/security/verify-pin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin })
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      return {
        success: false,
        error: data.error || 'Incorrect security PIN.',
        isRateLimited: Boolean(data.isRateLimited),
        retryAfterSeconds: data.retryAfterSeconds || 0
      };
    }
    return { success: true };
  } catch (err: any) {
    console.error('[SecurityClient] verify-pin error:', err);
    return { success: false, error: 'Network error during verification.' };
  }
}

/**
 * Subscribes to Supabase Realtime changes on workspace_security table
 * to propagate cross-device lock & unlock immediately
 */
export function subscribeToWorkspaceLockChanges(onLockChange: (isLocked: boolean) => void) {
  try {
    const channel = supabase
      .channel('public:workspace_security:sub')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'workspace_security' },
        (payload: any) => {
          if (payload?.new && typeof payload.new.is_locked === 'boolean') {
            onLockChange(payload.new.is_locked);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  } catch (err) {
    console.warn('[SecurityClient] Realtime subscription warning:', err);
    return () => {};
  }
}
