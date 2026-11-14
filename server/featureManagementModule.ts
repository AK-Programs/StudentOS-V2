/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Veylentra Authoritative Feature & Theme Management Backend Module
 * - Persists feature states & audit logs in Supabase (with global_data fallback + in-memory cache)
 * - Strictly enforces Super Admin authorization on all mutations
 * - Broadcasts live updates via WebSocket so connected clients react immediately
 * - Fails closed: unconfigured or disabled features block non-super-admins with 403
 * - Preserves Super Admin preview/testing capability even when a feature is OFF
 */

import express from 'express';
import crypto from 'crypto';
import {
  DEFAULT_FEATURE_REGISTRY,
  FEATURE_CATEGORIES,
  FeatureAuditLogEntry,
  FeatureCategory,
  PlatformFeatureRecord,
} from './featureRegistry';

export interface FeatureModuleDeps {
  getSupabaseServerConfig: () => { url: string; key: string };
  getVerifiedUserFromRequest: (req: express.Request) => Promise<{
    id: string;
    name: string;
    email?: string;
    role: string;
    grade?: string;
    section?: string;
    isVerifiedJwt: boolean;
  } | null>;
  broadcastToAllWs: (payload: any) => void;
}

const REGISTRY_GLOBAL_DOC_ID = '__veylentra_feature_registry_v1__';
const AUDIT_GLOBAL_DOC_ID = '__veylentra_feature_audit_v1__';

const memoryFeaturesMap = new Map<string, PlatformFeatureRecord>();
let memoryAuditLogs: FeatureAuditLogEntry[] = [];
let initializedFromDefaults = false;

function ensureDefaultsSeeded() {
  if (initializedFromDefaults) return;
  const now = new Date().toISOString();
  for (const def of DEFAULT_FEATURE_REGISTRY) {
    if (!memoryFeaturesMap.has(def.key)) {
      memoryFeaturesMap.set(def.key, {
        ...def,
        enabled: def.defaultEnabled,
        updatedAt: now,
        updatedBy: 'system',
        updatedByName: 'Veylentra Registry',
      });
    }
  }
  initializedFromDefaults = true;
}

ensureDefaultsSeeded();

function mapRowToRecord(row: any): PlatformFeatureRecord | null {
  if (!row || !row.key) return null;
  const def = DEFAULT_FEATURE_REGISTRY.find(d => d.key === row.key);
  return {
    key: String(row.key),
    displayName: String(row.display_name || row.displayName || def?.displayName || row.key),
    description: String(row.description ?? def?.description ?? ''),
    category: (row.category || def?.category || 'Other Platform Features') as FeatureCategory,
    defaultEnabled: typeof def?.defaultEnabled === 'boolean' ? def.defaultEnabled : Boolean(row.enabled),
    enabled: Boolean(row.enabled),
    releaseVersion: String(row.release_version || row.releaseVersion || def?.releaseVersion || '2026.12'),
    rolloutNote: String(row.rollout_note ?? row.rolloutNote ?? def?.rolloutNote ?? ''),
    isSeasonal: Boolean(row.is_seasonal ?? row.isSeasonal ?? def?.isSeasonal ?? false),
    canPreviewBySuperAdmin: Boolean(row.can_preview_by_super_admin ?? row.canPreviewBySuperAdmin ?? def?.canPreviewBySuperAdmin ?? true),
    dependencies: def?.dependencies,
    themeMetadata: row.theme_metadata || row.themeMetadata || def?.themeMetadata,
    config: row.config || def?.config,
    updatedAt: String(row.updated_at || row.updatedAt || new Date().toISOString()),
    updatedBy: String(row.updated_by || row.updatedBy || 'system'),
    updatedByName: String(row.updated_by_name || row.updatedByName || 'Super Admin'),
  };
}

async function persistAllToPlatformFeaturesTable(url: string, key: string): Promise<boolean> {
  const payload = Array.from(memoryFeaturesMap.values()).map(rec => ({
    key: rec.key,
    display_name: rec.displayName,
    description: rec.description,
    category: rec.category,
    enabled: rec.enabled,
    release_version: rec.releaseVersion,
    rollout_note: rec.rolloutNote,
    config: rec.config || {},
    theme_metadata: rec.themeMetadata || {},
    is_seasonal: rec.isSeasonal,
    can_preview_by_super_admin: rec.canPreviewBySuperAdmin,
    updated_by: rec.updatedBy,
    updated_by_name: rec.updatedByName,
    updated_at: rec.updatedAt,
  }));

  const res = await fetch(`${url}/rest/v1/platform_features?on_conflict=key`, {
    method: 'POST',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates',
    },
    body: JSON.stringify(payload),
  });
  return res.ok;
}

async function hydrateRegistryFromSupabase(
  getSupabaseServerConfig: FeatureModuleDeps['getSupabaseServerConfig']
): Promise<boolean> {
  ensureDefaultsSeeded();
  if (process.env.NODE_ENV === 'test') return true;
  const { url, key } = getSupabaseServerConfig();
  if (!url || !key) return false;

  try {
    const tableRes = await fetch(`${url}/rest/v1/platform_features?select=*`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    });

    if (tableRes.ok) {
      const rows = await tableRes.json();
      if (Array.isArray(rows) && rows.length > 0) {
        for (const r of rows) {
          const rec = mapRowToRecord(r);
          if (rec) memoryFeaturesMap.set(rec.key, rec);
        }
        return true;
      }
      await persistAllToPlatformFeaturesTable(url, key);
      return true;
    }

    const docRes = await fetch(
      `${url}/rest/v1/global_data?id=eq.${encodeURIComponent(REGISTRY_GLOBAL_DOC_ID)}&select=*`,
      { headers: { apikey: key, Authorization: `Bearer ${key}` } }
    );
    if (docRes.ok) {
      const rows = await docRes.json();
      const loaded = rows?.[0]?.data;
      if (loaded && typeof loaded === 'object') {
        Object.values(loaded).forEach((item: any) => {
          const rec = mapRowToRecord(item);
          if (rec) memoryFeaturesMap.set(rec.key, rec);
        });
        return true;
      }
    }
    return true;
  } catch (_) {
    return false;
  }
}

async function persistSingleFeature(
  getSupabaseServerConfig: FeatureModuleDeps['getSupabaseServerConfig'],
  record: PlatformFeatureRecord,
  auditEntry: FeatureAuditLogEntry
): Promise<{ ok: boolean; error?: string }> {
  const prevSnapshot = memoryFeaturesMap.get(record.key);
  memoryFeaturesMap.set(record.key, record);
  memoryAuditLogs = [auditEntry, ...memoryAuditLogs].slice(0, 200);

  if (process.env.NODE_ENV === 'test') {
    return { ok: true };
  }

  const { url, key } = getSupabaseServerConfig();
  if (!url || !key) {
    return { ok: true };
  }

  try {
    let persisted = false;

    const tableRes = await fetch(`${url}/rest/v1/platform_features?on_conflict=key`, {
      method: 'POST',
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates',
      },
      body: JSON.stringify({
        key: record.key,
        display_name: record.displayName,
        description: record.description,
        category: record.category,
        enabled: record.enabled,
        release_version: record.releaseVersion,
        rollout_note: record.rolloutNote,
        config: record.config || {},
        theme_metadata: record.themeMetadata || {},
        is_seasonal: record.isSeasonal,
        can_preview_by_super_admin: record.canPreviewBySuperAdmin,
        updated_by: record.updatedBy,
        updated_by_name: record.updatedByName,
        updated_at: record.updatedAt,
      }),
    });

    if (tableRes.ok) {
      persisted = true;
      await fetch(`${url}/rest/v1/platform_feature_audit_logs`, {
        method: 'POST',
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: auditEntry.id,
          feature_key: auditEntry.featureKey,
          previous_enabled: auditEntry.previousEnabled,
          new_enabled: auditEntry.newEnabled,
          action: auditEntry.action,
          actor_id: auditEntry.actorId,
          actor_name: auditEntry.actorName,
          actor_role: auditEntry.actorRole,
          reason: auditEntry.reason,
          created_at: auditEntry.createdAt,
        }),
      }).catch(() => {});
    }

    const mapObj: Record<string, PlatformFeatureRecord> = {};
    memoryFeaturesMap.forEach((v, k) => {
      mapObj[k] = v;
    });

    const docRes = await fetch(`${url}/rest/v1/global_data?on_conflict=id`, {
      method: 'POST',
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates',
      },
      body: JSON.stringify({
        id: REGISTRY_GLOBAL_DOC_ID,
        data: mapObj,
        updated_at: record.updatedAt,
      }),
    });

    if (docRes.ok) {
      persisted = true;
      await fetch(`${url}/rest/v1/global_data?on_conflict=id`, {
        method: 'POST',
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json',
          Prefer: 'resolution=merge-duplicates',
        },
        body: JSON.stringify({
          id: AUDIT_GLOBAL_DOC_ID,
          data: memoryAuditLogs.slice(0, 120),
          updated_at: record.updatedAt,
        }),
      }).catch(() => {});
    }

    if (!persisted) {
      if (prevSnapshot) memoryFeaturesMap.set(record.key, prevSnapshot);
      else memoryFeaturesMap.delete(record.key);
      return { ok: false, error: 'Database persistence failed while saving feature configuration.' };
    }

    return { ok: true };
  } catch (err: any) {
    if (prevSnapshot) memoryFeaturesMap.set(record.key, prevSnapshot);
    else memoryFeaturesMap.delete(record.key);
    return { ok: false, error: err?.message || 'Failed to persist feature state.' };
  }
}

async function fetchAuditLogs(
  getSupabaseServerConfig: FeatureModuleDeps['getSupabaseServerConfig']
): Promise<FeatureAuditLogEntry[]> {
  if (process.env.NODE_ENV === 'test') return [...memoryAuditLogs];
  const { url, key } = getSupabaseServerConfig();
  if (!url || !key) return [...memoryAuditLogs];

  try {
    const res = await fetch(
      `${url}/rest/v1/platform_feature_audit_logs?select=*&order=created_at.desc&limit=100`,
      { headers: { apikey: key, Authorization: `Bearer ${key}` } }
    );
    if (res.ok) {
      const rows = await res.json();
      if (Array.isArray(rows) && rows.length > 0) {
        const mapped: FeatureAuditLogEntry[] = rows.map((r: any) => ({
          id: String(r.id),
          featureKey: String(r.feature_key),
          previousEnabled: r.previous_enabled === null ? null : Boolean(r.previous_enabled),
          newEnabled: Boolean(r.new_enabled),
          action: (r.action || 'toggle') as FeatureAuditLogEntry['action'],
          actorId: String(r.actor_id || 'system'),
          actorName: String(r.actor_name || 'Super Admin'),
          actorRole: String(r.actor_role || 'super_admin'),
          reason: String(r.reason || ''),
          createdAt: String(r.created_at || new Date().toISOString()),
        }));
        memoryAuditLogs = mapped;
        return mapped;
      }
    }

    const docRes = await fetch(
      `${url}/rest/v1/global_data?id=eq.${encodeURIComponent(AUDIT_GLOBAL_DOC_ID)}&select=*`,
      { headers: { apikey: key, Authorization: `Bearer ${key}` } }
    );
    if (docRes.ok) {
      const rows = await docRes.json();
      if (Array.isArray(rows?.[0]?.data)) {
        memoryAuditLogs = rows[0].data;
        return rows[0].data;
      }
    }
  } catch (_) {}
  return [...memoryAuditLogs];
}

export function isFeatureEnabledInRegistry(featureKey: string): boolean {
  ensureDefaultsSeeded();
  const rec = memoryFeaturesMap.get(featureKey);
  if (!rec) return false;
  if (!rec.enabled) return false;
  if (Array.isArray(rec.dependencies) && rec.dependencies.length > 0) {
    for (const dep of rec.dependencies) {
      if (!isFeatureEnabledInRegistry(dep)) return false;
    }
  }
  return true;
}

export function isFeatureAccessibleForActor(
  featureKey: string,
  actorRole?: string | null,
  allowSuperAdminPreview: boolean = true
): boolean {
  ensureDefaultsSeeded();
  const rec = memoryFeaturesMap.get(featureKey);
  if (!rec) return false;
  if (rec.enabled) {
    if (Array.isArray(rec.dependencies)) {
      return rec.dependencies.every(dep => isFeatureAccessibleForActor(dep, actorRole, allowSuperAdminPreview));
    }
    return true;
  }
  const normalizedRole = String(actorRole || '').toLowerCase().trim();
  if (normalizedRole === 'super_admin' && allowSuperAdminPreview && rec.canPreviewBySuperAdmin) {
    return true;
  }
  return false;
}

export function getFeatureRecord(featureKey: string): PlatformFeatureRecord | null {
  ensureDefaultsSeeded();
  return memoryFeaturesMap.get(featureKey) || null;
}

export function getAllFeatureRecords(): PlatformFeatureRecord[] {
  ensureDefaultsSeeded();
  return Array.from(memoryFeaturesMap.values());
}

export function setFeatureStateForTestOnly(featureKey: string, enabled: boolean) {
  if (process.env.NODE_ENV !== 'test') return;
  ensureDefaultsSeeded();
  const existing = memoryFeaturesMap.get(featureKey);
  if (existing) {
    memoryFeaturesMap.set(featureKey, {
      ...existing,
      enabled,
      updatedAt: new Date().toISOString(),
    });
  }
}

export function registerFeatureManagementRoutes(app: express.Express, deps: FeatureModuleDeps) {
  const { getSupabaseServerConfig, getVerifiedUserFromRequest, broadcastToAllWs } = deps;

  const requireFeatureAccess = (featureKey: string): express.RequestHandler => {
    return async (req, res, next) => {
      await hydrateRegistryFromSupabase(getSupabaseServerConfig);
      const actor = await getVerifiedUserFromRequest(req);
      const role = actor?.role || '';
      if (isFeatureAccessibleForActor(featureKey, role, true)) {
        (req as any).verifiedActor = actor;
        return next();
      }
      return res.status(403).json({
        success: false,
        code: 'FEATURE_DISABLED',
        featureKey,
        error: `Feature "${featureKey}" is currently disabled by platform administration.`,
      });
    };
  };

  app.get('/api/features', async (req, res) => {
    await hydrateRegistryFromSupabase(getSupabaseServerConfig);
    const actor = await getVerifiedUserFromRequest(req);
    const isSuperAdmin = String(actor?.role || '').toLowerCase().trim() === 'super_admin';
    const includeAudit = String(req.query.includeAudit || '') === 'true';

    const features = getAllFeatureRecords().map(f => ({
      ...f,
      isPreviewableForCurrentUser: !f.enabled && isSuperAdmin && f.canPreviewBySuperAdmin,
    }));

    const effectiveFlags: Record<string, boolean> = {};
    features.forEach(f => {
      effectiveFlags[f.key] = isFeatureEnabledInRegistry(f.key);
    });

    let auditLogs: FeatureAuditLogEntry[] | undefined;
    if (includeAudit && isSuperAdmin) {
      auditLogs = await fetchAuditLogs(getSupabaseServerConfig);
    }

    return res.json({
      success: true,
      categories: FEATURE_CATEGORIES,
      features,
      effectiveFlags,
      canPreviewDisabled: isSuperAdmin,
      auditLogs,
      serverTime: new Date().toISOString(),
    });
  });

  app.patch('/api/features/:key', async (req, res) => {
    await hydrateRegistryFromSupabase(getSupabaseServerConfig);
    const actor = await getVerifiedUserFromRequest(req);
    if (!actor) {
      return res.status(401).json({ success: false, error: 'Authentication required.' });
    }
    if (String(actor.role || '').toLowerCase().trim() !== 'super_admin') {
      return res.status(403).json({
        success: false,
        error: 'Permission denied. Only Super Admins can modify platform features or seasonal themes.',
      });
    }

    const featureKey = String(req.params.key || '').trim();
    const existing = memoryFeaturesMap.get(featureKey);
    if (!existing) {
      return res.status(404).json({
        success: false,
        error: `Unknown feature key "${featureKey}". Register custom features via POST /api/features first.`,
      });
    }

    const { enabled, reason, rolloutNote, config } = req.body || {};
    if (typeof enabled !== 'boolean') {
      return res.status(400).json({
        success: false,
        error: 'Boolean field "enabled" is required.',
      });
    }

    const now = new Date().toISOString();
    const updatedRecord: PlatformFeatureRecord = {
      ...existing,
      enabled,
      rolloutNote: typeof rolloutNote === 'string' ? rolloutNote.slice(0, 300) : existing.rolloutNote,
      config: config && typeof config === 'object' ? { ...(existing.config || {}), ...config } : existing.config,
      updatedAt: now,
      updatedBy: actor.id,
      updatedByName: actor.name || 'Super Admin',
    };

    const auditEntry: FeatureAuditLogEntry = {
      id: `faudit_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
      featureKey,
      previousEnabled: existing.enabled,
      newEnabled: enabled,
      action: 'toggle',
      actorId: actor.id,
      actorName: actor.name || 'Super Admin',
      actorRole: actor.role,
      reason: typeof reason === 'string' ? reason.slice(0, 240) : '',
      createdAt: now,
    };

    const persisted = await persistSingleFeature(getSupabaseServerConfig, updatedRecord, auditEntry);
    if (!persisted.ok) {
      return res.status(500).json({
        success: false,
        error: persisted.error || 'Failed to persist feature update.',
      });
    }

    broadcastToAllWs({
      type: 'feature_flags:updated',
      featureKey,
      enabled,
      feature: updatedRecord,
      auditEntry,
      updatedAt: now,
    });

    return res.json({
      success: true,
      feature: updatedRecord,
      auditEntry,
    });
  });

  app.post('/api/features', async (req, res) => {
    await hydrateRegistryFromSupabase(getSupabaseServerConfig);
    const actor = await getVerifiedUserFromRequest(req);
    if (!actor) {
      return res.status(401).json({ success: false, error: 'Authentication required.' });
    }
    if (String(actor.role || '').toLowerCase().trim() !== 'super_admin') {
      return res.status(403).json({
        success: false,
        error: 'Permission denied. Only Super Admins can register platform features.',
      });
    }

    const {
      key,
      displayName,
      description = '',
      category = 'Other Platform Features',
      enabled = false,
      releaseVersion = '2026.12',
      rolloutNote = '',
      isSeasonal = false,
      canPreviewBySuperAdmin = true,
      config,
      themeMetadata,
    } = req.body || {};

    const cleanKey = String(key || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, '_');

    if (!cleanKey || cleanKey.length < 3 || !displayName) {
      return res.status(400).json({
        success: false,
        error: 'Valid alphanumeric feature "key" (>= 3 chars) and "displayName" are required.',
      });
    }

    const validCategory: FeatureCategory = FEATURE_CATEGORIES.includes(category)
      ? category
      : 'Other Platform Features';

    const existing = memoryFeaturesMap.get(cleanKey);
    const now = new Date().toISOString();
    const record: PlatformFeatureRecord = {
      key: cleanKey,
      displayName: String(displayName).slice(0, 100),
      description: String(description).slice(0, 400),
      category: validCategory,
      defaultEnabled: Boolean(enabled),
      enabled: Boolean(enabled),
      releaseVersion: String(releaseVersion).slice(0, 40),
      rolloutNote: String(rolloutNote).slice(0, 300),
      isSeasonal: Boolean(isSeasonal),
      canPreviewBySuperAdmin: Boolean(canPreviewBySuperAdmin),
      config: config && typeof config === 'object' ? config : existing?.config,
      themeMetadata: themeMetadata && typeof themeMetadata === 'object' ? themeMetadata : existing?.themeMetadata,
      updatedAt: now,
      updatedBy: actor.id,
      updatedByName: actor.name || 'Super Admin',
    };

    const auditEntry: FeatureAuditLogEntry = {
      id: `faudit_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
      featureKey: cleanKey,
      previousEnabled: existing ? existing.enabled : null,
      newEnabled: record.enabled,
      action: 'register',
      actorId: actor.id,
      actorName: actor.name || 'Super Admin',
      actorRole: actor.role,
      reason: 'Registered/updated via Feature Management console',
      createdAt: now,
    };

    const persisted = await persistSingleFeature(getSupabaseServerConfig, record, auditEntry);
    if (!persisted.ok) {
      return res.status(500).json({
        success: false,
        error: persisted.error || 'Failed to save new feature definition.',
      });
    }

    broadcastToAllWs({
      type: 'feature_flags:updated',
      featureKey: cleanKey,
      enabled: record.enabled,
      feature: record,
      auditEntry,
      updatedAt: now,
    });

    return res.status(201).json({
      success: true,
      feature: record,
      auditEntry,
    });
  });

  return {
    requireFeatureAccess,
    hydrateRegistry: () => hydrateRegistryFromSupabase(getSupabaseServerConfig),
  };
}
