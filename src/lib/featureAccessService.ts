/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Client-side Feature & Theme Management Store
 * - Hydrates live feature flags from /api/features
 * - Subscribes to WebSocket, BroadcastChannel, and Supabase Realtime updates
 * - Fails closed when unhydrated/offline
 * - Supports Super Admin Preview Mode for testing disabled features without exposing them to others
 */

import { useEffect, useState } from 'react';
import { supabase } from './supabase';
import { getServerAuthHeaders } from './clientSession';
import { UserProfile } from '../types';

export type FeatureCategory =
  | 'Themes & Seasonal Events'
  | 'Gamification & Rewards'
  | 'Leaderboards'
  | 'Student Workspace Features'
  | 'Faculty Workspace Features'
  | 'AI & Voice Tools'
  | 'Experimental / Beta Features'
  | 'Other Platform Features';

export interface PlatformFeatureRecord {
  key: string;
  displayName: string;
  description: string;
  category: FeatureCategory;
  defaultEnabled: boolean;
  enabled: boolean;
  releaseVersion: string;
  rolloutNote: string;
  isSeasonal: boolean;
  canPreviewBySuperAdmin: boolean;
  dependencies?: string[];
  themeMetadata?: {
    className?: string;
    accentColor?: string;
    snowParticles?: boolean;
  };
  config?: Record<string, any>;
  updatedAt: string;
  updatedBy: string;
  updatedByName: string;
}

export interface FeatureAuditLogEntry {
  id: string;
  featureKey: string;
  previousEnabled: boolean | null;
  newEnabled: boolean;
  action: 'enable' | 'disable' | 'register' | 'update';
  actorId: string;
  actorName: string;
  actorRole: string;
  reason?: string;
  createdAt: string;
}

export interface FeatureRegistrySnapshot {
  hydrated: boolean;
  loading: boolean;
  features: Record<string, PlatformFeatureRecord>;
  orderedFeatures: PlatformFeatureRecord[];
  categories: FeatureCategory[];
  auditLogs: FeatureAuditLogEntry[];
  previewDisabledFeatures: boolean;
  error: string | null;
}

const PREVIEW_STORAGE_KEY = 'veylentra_super_admin_preview_disabled';
const FEATURE_BC_NAME = 'veylentra-feature-flags-sync';

function getStoredPreviewFlag(): boolean {
  try {
    return typeof window !== 'undefined' && sessionStorage.getItem(PREVIEW_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

let snapshot: FeatureRegistrySnapshot = {
  hydrated: false,
  loading: false,
  features: {},
  orderedFeatures: [],
  categories: [],
  auditLogs: [],
  previewDisabledFeatures: getStoredPreviewFlag(),
  error: null,
};

const listeners = new Set<() => void>();
let inflightRefresh: Promise<void> | null = null;
let realtimeSubscribed = false;
let broadcastChannel: BroadcastChannel | null = null;

function notifyListeners() {
  listeners.forEach(fn => {
    try {
      fn();
    } catch (_) {}
  });
}

let cachedSessionToken: { token: string; expiresAtMs: number } | null = null;
let inflightSessionPromise: Promise<string | undefined> | null = null;

async function getFastAccessToken(): Promise<string | undefined> {
  const nowMs = Date.now();
  if (cachedSessionToken && cachedSessionToken.expiresAtMs > nowMs + 60_000) {
    return cachedSessionToken.token;
  }
  if (inflightSessionPromise) {
    return inflightSessionPromise;
  }

  const withTimeout = <T,>(promise: Promise<T>, ms: number, fallback: T): Promise<T> =>
    Promise.race([
      promise,
      new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
    ]);

  inflightSessionPromise = (async () => {
    try {
      const sessionRes = await withTimeout(
        supabase.auth.getSession().catch(() => ({ data: { session: null } } as any)),
        600,
        { data: { session: null } } as any
      );
      const session = sessionRes?.data?.session || null;
      let token: string | undefined = session?.access_token;
      const expiresAtMs = session?.expires_at ? Number(session.expires_at) * 1000 : nowMs + 300_000;
      const isExpired = session?.expires_at ? expiresAtMs <= nowMs : false;
      const isNearExpiry = session?.expires_at ? expiresAtMs < nowMs + 60_000 : false;

      if (session && isExpired) {
        const refreshRes = await withTimeout(
          supabase.auth.refreshSession().catch(() => ({ data: { session: null }, error: true } as any)),
          900,
          { data: { session: null }, error: true } as any
        );
        if (!refreshRes?.error && refreshRes?.data?.session?.access_token) {
          token = refreshRes.data.session.access_token;
          const nextExp = refreshRes.data.session.expires_at
            ? Number(refreshRes.data.session.expires_at) * 1000
            : nowMs + 300_000;
          cachedSessionToken = { token, expiresAtMs: nextExp };
          return token;
        }
        cachedSessionToken = null;
        return undefined;
      }

      if (session && isNearExpiry) {
        // Return valid token immediately and refresh quietly in background
        void supabase.auth.refreshSession().then((refreshRes) => {
          const nextSess = refreshRes?.data?.session;
          if (nextSess?.access_token) {
            cachedSessionToken = {
              token: nextSess.access_token,
              expiresAtMs: nextSess.expires_at ? Number(nextSess.expires_at) * 1000 : Date.now() + 300_000,
            };
          }
        }).catch(() => {});
      }

      if (token) {
        cachedSessionToken = { token, expiresAtMs };
        return token;
      }
      cachedSessionToken = null;
      return undefined;
    } catch {
      return undefined;
    } finally {
      inflightSessionPromise = null;
    }
  })();

  return inflightSessionPromise;
}

export async function buildAuthHeadersForUser(_user?: Partial<UserProfile> | null): Promise<Record<string, string>> {
  return getServerAuthHeaders();
}

export function isSuperAdminRole(role?: string | null): boolean {
  return String(role || '').toLowerCase().trim() === 'super_admin';
}

export function setSuperAdminPreviewDisabled(enabled: boolean) {
  try {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem(PREVIEW_STORAGE_KEY, enabled ? 'true' : 'false');
    }
  } catch (_) {}
  snapshot = {
    ...snapshot,
    previewDisabledFeatures: enabled,
  };
  notifyListeners();
}

export async function refreshFeatureRegistry(user?: Partial<UserProfile> | null): Promise<void> {
  if (inflightRefresh) return inflightRefresh;

  snapshot = { ...snapshot, loading: true };
  notifyListeners();

  inflightRefresh = (async () => {
    try {
      const headers = await buildAuthHeadersForUser(user);
      const res = await fetch('/api/features', { headers });
      if (!res.ok) {
        throw new Error(`Feature service unavailable (${res.status})`);
      }
      const data = await res.json();
      const list: PlatformFeatureRecord[] = Array.isArray(data.features) ? data.features : [];
      const map: Record<string, PlatformFeatureRecord> = {};
      list.forEach(item => {
        if (item?.key) map[item.key] = item;
      });

      snapshot = {
        ...snapshot,
        hydrated: true,
        loading: false,
        features: map,
        orderedFeatures: list,
        categories: Array.isArray(data.categories) ? data.categories : snapshot.categories,
        auditLogs: Array.isArray(data.auditLogs) ? data.auditLogs : snapshot.auditLogs,
        error: null,
      };
    } catch (err: any) {
      snapshot = {
        ...snapshot,
        hydrated: true,
        loading: false,
        error: err?.message || 'Unable to load feature flags',
      };
    } finally {
      inflightRefresh = null;
      notifyListeners();
    }
  })();

  return inflightRefresh;
}

export function ensureFeatureRealtimeSync(user?: Partial<UserProfile> | null) {
  if (typeof window === 'undefined') return;
  if (!realtimeSubscribed) {
    realtimeSubscribed = true;

    try {
      if (typeof BroadcastChannel !== 'undefined') {
        broadcastChannel = new BroadcastChannel(FEATURE_BC_NAME);
        broadcastChannel.onmessage = (evt) => {
          if (evt?.data?.type === 'feature_flags:updated') {
            refreshFeatureRegistry(user);
          }
        };
      }
    } catch (_) {}

    window.addEventListener('veylentra-feature-flags-updated', () => {
      refreshFeatureRegistry(user);
    });

    try {
      supabase
        .channel('veylentra-platform-features-live')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'platform_features' },
          () => {
            refreshFeatureRegistry(user);
          }
        )
        .subscribe();
    } catch (_) {}
  }
}

export async function togglePlatformFeature(params: {
  key: string;
  enabled: boolean;
  reason?: string;
  user?: Partial<UserProfile> | null;
}): Promise<{ ok: boolean; feature?: PlatformFeatureRecord; error?: string }> {
  try {
    const headers = await buildAuthHeadersForUser(params.user);
    const res = await fetch(`/api/features/${encodeURIComponent(params.key)}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({
        enabled: params.enabled,
        reason: params.reason || '',
      }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      return { ok: false, error: data?.error || `Failed (${res.status})` };
    }

    if (data.feature) {
      const updatedMap: Record<string, PlatformFeatureRecord> = {
        ...snapshot.features,
        [data.feature.key]: data.feature,
      };
      const ordered: PlatformFeatureRecord[] = Object.values(updatedMap);
      const nextLogs = data.auditEntry
        ? [data.auditEntry, ...snapshot.auditLogs].slice(0, 100)
        : snapshot.auditLogs;
      snapshot = {
        ...snapshot,
        features: updatedMap,
        orderedFeatures: ordered,
        auditLogs: nextLogs,
      };
      notifyListeners();
    }

    try {
      broadcastChannel?.postMessage({ type: 'feature_flags:updated', featureKey: params.key });
      window.dispatchEvent(new CustomEvent('veylentra-feature-flags-updated', { detail: { featureKey: params.key } }));
    } catch (_) {}

    return { ok: true, feature: data.feature };
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Network error updating feature flag' };
  }
}

export async function registerPlatformFeature(params: {
  key: string;
  displayName: string;
  description: string;
  category: FeatureCategory;
  enabled: boolean;
  releaseVersion?: string;
  rolloutNote?: string;
  isSeasonal?: boolean;
  canPreviewBySuperAdmin?: boolean;
  user?: Partial<UserProfile> | null;
}): Promise<{ ok: boolean; feature?: PlatformFeatureRecord; error?: string }> {
  try {
    const headers = await buildAuthHeadersForUser(params.user);
    const res = await fetch('/api/features', {
      method: 'POST',
      headers,
      body: JSON.stringify(params),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      return { ok: false, error: data?.error || `Failed (${res.status})` };
    }
    await refreshFeatureRegistry(params.user);
    try {
      broadcastChannel?.postMessage({ type: 'feature_flags:updated', featureKey: params.key });
      window.dispatchEvent(new CustomEvent('veylentra-feature-flags-updated', { detail: { featureKey: params.key } }));
    } catch (_) {}
    return { ok: true, feature: data.feature };
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Network error registering feature' };
  }
}

/**
 * Fail-closed check: returns true only when feature is explicitly enabled (and dependencies enabled)
 * OR when the user is a verified Super Admin with Preview Mode turned ON (or previewAllowedOverride).
 */
export function checkFeatureAccess(
  featureKey: string,
  userRole?: string | null,
  options?: { allowPreviewOverride?: boolean }
): {
  accessible: boolean;
  globallyEnabled: boolean;
  isPreviewOnly: boolean;
  record: PlatformFeatureRecord | undefined;
} {
  const rec = snapshot.features[featureKey];
  if (!rec) {
    return { accessible: false, globallyEnabled: false, isPreviewOnly: false, record: undefined };
  }

  let globallyEnabled = Boolean(rec.enabled);
  if (globallyEnabled && Array.isArray(rec.dependencies) && rec.dependencies.length > 0) {
    for (const depKey of rec.dependencies) {
      const dep = snapshot.features[depKey];
      if (!dep || !dep.enabled) {
        globallyEnabled = false;
        break;
      }
    }
  }

  if (globallyEnabled) {
    return { accessible: true, globallyEnabled: true, isPreviewOnly: false, record: rec };
  }

  const isSA = isSuperAdminRole(userRole);
  const previewActive = snapshot.previewDisabledFeatures || Boolean(options?.allowPreviewOverride);
  if (isSA && rec.canPreviewBySuperAdmin && previewActive) {
    return { accessible: true, globallyEnabled: false, isPreviewOnly: true, record: rec };
  }

  return { accessible: false, globallyEnabled: false, isPreviewOnly: false, record: rec };
}

export function useFeatureRegistry(user?: Partial<UserProfile> | null): FeatureRegistrySnapshot {
  const [state, setState] = useState<FeatureRegistrySnapshot>(snapshot);

  useEffect(() => {
    const onChange = () => setState({ ...snapshot });
    listeners.add(onChange);
    ensureFeatureRealtimeSync(user);
    if (!snapshot.hydrated && !snapshot.loading) {
      refreshFeatureRegistry(user);
    }
    return () => {
      listeners.delete(onChange);
    };
  }, [user?.uid, user?.role]);

  return state;
}

export function useFeatureAccess(featureKey: string, user?: Partial<UserProfile> | null) {
  const registry = useFeatureRegistry(user);
  const access = checkFeatureAccess(featureKey, user?.role);
  return {
    ...access,
    hydrated: registry.hydrated,
    loading: registry.loading,
    previewModeActive: registry.previewDisabledFeatures && isSuperAdminRole(user?.role),
  };
}
