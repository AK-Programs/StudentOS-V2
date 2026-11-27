/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Veylentra Authoritative Notification & Broadcast Lifecycle Engine (System 2.0)
 * Fixes:
 * - Role-based notification leakage (Teachers/Coordinators/Admins NEVER receive Student flashcard/study reminders)
 * - Old broadcast replay on fresh login / reload (tracks per-user popup_presented_at + createdAt freshness + expiry)
 * - Non-UUID demo user state persistence failure (supports both UUID & string user keys safely)
 * - Duplicate push/flyout/sound alerts from multi-channel events
 */

import express from 'express';
import crypto from 'crypto';
import {
  supabaseFetchWithAnonRetry,
  getFeatureAndWinterSupabaseKey,
  WORKING_ANON_KEY,
} from './supabaseKeyManager.js';

export type NotificationPriority = 'urgent' | 'high' | 'normal' | 'low';

export interface ServerNotificationRecord {
  id: string;
  title: string;
  message: string;
  type: string;
  priority: NotificationPriority;
  targetRole: string;
  targetRoles: string[];
  targetGrade?: string | null;
  targetSection?: string | null;
  targetUserId?: string | null;
  senderId?: string | null;
  senderName?: string | null;
  dedupeKey?: string | null;
  linkTab?: string | null;
  expiresAt?: string | null;
  archivedAt?: string | null;
  createdAt: string;
  metadata?: Record<string, any>;
}

export interface NotificationUserLifecycleState {
  deliveredAt?: string | null;
  popupPresentedAt?: string | null;
  readAt?: string | null;
  dismissedAt?: string | null;
  acknowledgedAt?: string | null;
}

export interface EvaluatedNotificationItem extends ServerNotificationRecord {
  isRead: boolean;
  isDismissed: boolean;
  isExpired: boolean;
  isArchived: boolean;
  deliveredAt: string | null;
  popupPresentedAt: string | null;
  readAt: string | null;
  dismissedAt: string | null;
  acknowledgedAt: string | null;
  popupEligible: boolean;
}

export interface NotificationEngineDeps {
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
  dispatchWebPush?: (params: {
    notificationId?: string;
    title?: string;
    body?: string;
    type?: string;
    linkTab?: string;
    tag?: string;
    targetUserId?: string | null;
    targetRole?: string | null;
    targetRoles?: string[] | null;
    targetClass?: string | null;
    targetSection?: string | null;
  }) => Promise<any> | any;
}

const MEMORY_NOTIFICATIONS_DOC_ID = '__veylentra_notifications_v2__';
const MEMORY_USER_STATE_PREFIX = '__veylentra_notif_state_v2_';

const memoryNotifications: ServerNotificationRecord[] = [];
const memoryUserStates = new Map<string, Record<string, NotificationUserLifecycleState>>();

const STUDENT_ONLY_TYPES = new Set([
  'flashcard',
  'flashcard_due',
  'flashcards_due',
  'homework_due',
  'study_reminder',
  'exam_prep',
  'pomodoro_reminder',
]);

export function sanitizeNotificationPriority(val: unknown): NotificationPriority {
  const s = String(val || 'normal').toLowerCase().trim();
  if (s === 'urgent' || s === 'high' || s === 'normal' || s === 'low') return s;
  return 'normal';
}

export function normalizeRoleList(targetRole?: string | null, targetRoles?: unknown): string[] {
  const list: string[] = [];
  if (Array.isArray(targetRoles)) {
    for (const r of targetRoles) {
      const norm = String(r || '').toLowerCase().trim();
      if (norm) list.push(norm);
    }
  }
  if (targetRole && String(targetRole).trim()) {
    const parts = String(targetRole)
      .split(',')
      .map(p => p.toLowerCase().trim())
      .filter(Boolean);
    list.push(...parts);
  }
  return Array.from(new Set(list));
}

export function isNotificationExpiredOrArchived(
  notif: Partial<ServerNotificationRecord>,
  nowMs: number = Date.now()
): { isExpired: boolean; isArchived: boolean } {
  const isArchived = Boolean(notif.archivedAt);
  let isExpired = false;
  if (notif.expiresAt) {
    const expMs = new Date(notif.expiresAt).getTime();
    if (Number.isFinite(expMs) && expMs <= nowMs) {
      isExpired = true;
    }
  }
  return { isExpired, isArchived };
}

/**
 * Authoritative role, cohort, user, type, and expiry eligibility filter.
 */
export function isNotificationEligibleForUser(
  notif: Partial<ServerNotificationRecord>,
  user: { id?: string; role: string; grade?: string; section?: string },
  nowMs: number = Date.now()
): boolean {
  const { isExpired, isArchived } = isNotificationExpiredOrArchived(notif, nowMs);
  if (isExpired || isArchived) return false;

  const userRole = String(user.role || 'student').toLowerCase().trim();
  const userId = String(user.id || '').trim();
  const typeKey = String(notif.type || 'general').toLowerCase().trim();

  // Direct user targeting
  if (notif.targetUserId) {
    if (!userId || String(notif.targetUserId) !== userId) return false;
  }

  // Strict category guard: non-students never receive student flashcard/study reminders
  const linkTab = String(notif.linkTab || notif.metadata?.linkTab || '').toLowerCase().trim();
  const notifTitle = String(notif.title || '').toLowerCase();
  if (
    userRole !== 'student' &&
    (STUDENT_ONLY_TYPES.has(typeKey) ||
      linkTab === 'flashcards' ||
      (typeKey === 'reminder' && notifTitle.includes('flashcard')))
  ) {
    return false;
  }

  const roles = normalizeRoleList(notif.targetRole, notif.targetRoles);
  if (roles.length > 0 && !roles.includes('all')) {
    if (roles.includes('faculty')) {
      if (!['teacher', 'coordinator', 'admin', 'super_admin'].includes(userRole)) return false;
    } else if (roles.includes('staff')) {
      if (!['teacher', 'coordinator', 'admin', 'super_admin'].includes(userRole)) return false;
    } else if (!roles.includes(userRole)) {
      return false;
    }
  }

  // Cohort grade/section check for students when targeted
  if (userRole === 'student') {
    const tg = String(notif.targetGrade || '').toLowerCase().trim();
    const ts = String(notif.targetSection || '').toLowerCase().trim();
    if (tg && tg !== 'all' && tg !== 'all grades') {
      const ug = String(user.grade || '').toLowerCase().trim();
      if (ug && ug !== tg) return false;
    }
    if (ts && ts !== 'all' && ts !== 'all sections') {
      const us = String(user.section || '').toLowerCase().trim();
      if (us && us !== ts) return false;
    }
  }

  return true;
}

/**
 * Determines which notifications are genuinely eligible to interrupt via floating popup/flyout.
 * - Never pop dismissed, expired, archived, or already read items
 * - Never pop items already presented to this user in a previous session/load
 * - Never pop historical notifications older than freshnessWindowMs (default 24h)
 * - Caps visible flyout burst to maxVisible (default 1)
 */
export function selectFlyoutCandidates(
  items: EvaluatedNotificationItem[],
  options?: {
    nowMs?: number;
    freshnessWindowMs?: number;
    maxVisible?: number;
    sessionStartMs?: number;
  }
): EvaluatedNotificationItem[] {
  const nowMs = options?.nowMs ?? Date.now();
  const freshnessWindowMs = options?.freshnessWindowMs ?? 24 * 60 * 60 * 1000;
  const maxVisible = Math.max(1, Math.min(3, options?.maxVisible ?? 1));

  const eligible = items.filter(item => {
    if (item.isExpired || item.isArchived || item.isDismissed || item.isRead) return false;
    if (item.popupPresentedAt) return false;
    if (item.acknowledgedAt) return false;
    const createdMs = new Date(item.createdAt).getTime();
    if (!Number.isFinite(createdMs)) return false;
    if (nowMs - createdMs > freshnessWindowMs) return false;
    return item.priority === 'urgent' || item.priority === 'high' || item.type === 'broadcast' || item.type === 'urgent';
  });

  const priorityRank: Record<NotificationPriority, number> = {
    urgent: 0,
    high: 1,
    normal: 2,
    low: 3,
  };

  return eligible
    .sort((a, b) => {
      const pr = priorityRank[a.priority] - priorityRank[b.priority];
      if (pr !== 0) return pr;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    })
    .slice(0, maxVisible);
}

export function buildNotificationDedupeKey(parts: {
  type: string;
  targetUserId?: string | null;
  targetRole?: string | null;
  dateKey?: string;
  referenceId?: string;
}): string {
  return [
    String(parts.type || 'general').toLowerCase().trim(),
    String(parts.targetUserId || parts.targetRole || 'all').toLowerCase().trim(),
    String(parts.referenceId || 'default').toLowerCase().trim(),
    String(parts.dateKey || new Date().toISOString().split('T')[0]),
  ].join(':');
}

function getUserStateMapKey(userId: string): string {
  return `${MEMORY_USER_STATE_PREFIX}${userId}`;
}

async function loadUserLifecycleMap(
  url: string,
  key: string,
  userId: string
): Promise<Record<string, NotificationUserLifecycleState>> {
  const mem = memoryUserStates.get(userId) || {};
  if (!url || !key || (process.env.NODE_ENV === 'test' && !url.includes('127.0.0.1'))) {
    return { ...mem };
  }

  const effectiveKey = getFeatureAndWinterSupabaseKey(url, key) || WORKING_ANON_KEY;
  const headers = { apikey: effectiveKey, Authorization: `Bearer ${effectiveKey}` };
  let merged: Record<string, NotificationUserLifecycleState> = { ...mem };

  // 1. Read user-specific global_data state mirror (supports BOTH UUID and string demo IDs seamlessly!)
  try {
    const docId = getUserStateMapKey(userId);
    const gRes = await supabaseFetchWithAnonRetry(
      `${url}/rest/v1/global_data?id=eq.${encodeURIComponent(docId)}&select=data`,
      { headers }
    );
    if (gRes.ok) {
      const rows = await gRes.json().catch(() => []);
      const data = rows?.[0]?.data;
      if (data && typeof data === 'object') {
        merged = { ...data, ...merged };
      }
    }
  } catch (_) {}

  // 2. Also read notification_user_state by user_key / user_id
  try {
    const sRes = await supabaseFetchWithAnonRetry(
      `${url}/rest/v1/notification_user_state?or=(user_key.eq.${encodeURIComponent(userId)},user_id.eq.${encodeURIComponent(userId)})&select=*`,
      { headers }
    );
    if (sRes.ok) {
      const rows = await sRes.json().catch(() => []);
      if (Array.isArray(rows)) {
        for (const r of rows) {
          const nid = String(r.notification_id || '');
          if (!nid) continue;
          const prev = merged[nid] || {};
          merged[nid] = {
            deliveredAt: prev.deliveredAt || r.delivered_at || null,
            popupPresentedAt: prev.popupPresentedAt || r.popup_presented_at || null,
            readAt: prev.readAt || r.read_at || (r.is_read ? new Date().toISOString() : null),
            dismissedAt: prev.dismissedAt || r.dismissed_at || (r.is_dismissed ? new Date().toISOString() : null),
            acknowledgedAt: prev.acknowledgedAt || r.acknowledged_at || null,
          };
        }
      }
    }
  } catch (_) {}

  memoryUserStates.set(userId, merged);
  return merged;
}

async function persistUserLifecycleUpdate(
  url: string,
  key: string,
  userId: string,
  notificationIds: string[],
  action: 'delivered' | 'popup_presented' | 'read' | 'dismissed' | 'acknowledged'
): Promise<Record<string, NotificationUserLifecycleState>> {
  const current = await loadUserLifecycleMap(url, key, userId);
  const nowIso = new Date().toISOString();

  for (const nid of notificationIds) {
    if (!nid) continue;
    const prev = current[nid] || {};
    const next: NotificationUserLifecycleState = { ...prev };
    if (action === 'delivered' && !next.deliveredAt) next.deliveredAt = nowIso;
    if (action === 'popup_presented' && !next.popupPresentedAt) next.popupPresentedAt = nowIso;
    if (action === 'read' && !next.readAt) next.readAt = nowIso;
    if (action === 'dismissed') {
      if (!next.dismissedAt) next.dismissedAt = nowIso;
      if (!next.readAt) next.readAt = nowIso;
    }
    if (action === 'acknowledged') {
      if (!next.acknowledgedAt) next.acknowledgedAt = nowIso;
      if (!next.readAt) next.readAt = nowIso;
    }
    current[nid] = next;
  }

  memoryUserStates.set(userId, current);

  if (url && key && (process.env.NODE_ENV !== 'test' || url.includes('127.0.0.1'))) {
    const effectiveKey = getFeatureAndWinterSupabaseKey(url, key) || WORKING_ANON_KEY;
    const headers = {
      apikey: effectiveKey,
      Authorization: `Bearer ${effectiveKey}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates',
    };
    const docId = getUserStateMapKey(userId);
    await supabaseFetchWithAnonRetry(`${url}/rest/v1/global_data?on_conflict=id`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        id: docId,
        data: current,
        updated_at: nowIso,
      }),
    }).catch(() => {});

    // Best-effort sync to notification_user_state when UUID valid
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId);
    for (const nid of notificationIds.slice(0, 50)) {
      const nidIsUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(nid);
      if (!isUuid || !nidIsUuid) continue;
      const st = current[nid] || {};
      await supabaseFetchWithAnonRetry(
        `${url}/rest/v1/notification_user_state?on_conflict=notification_id,user_id`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify({
            notification_id: nid,
            user_id: userId,
            user_key: userId,
            is_read: Boolean(st.readAt),
            is_dismissed: Boolean(st.dismissedAt),
            delivered_at: st.deliveredAt || null,
            popup_presented_at: st.popupPresentedAt || null,
            read_at: st.readAt || null,
            dismissed_at: st.dismissedAt || null,
            acknowledged_at: st.acknowledgedAt || null,
            updated_at: nowIso,
          }),
        }
      ).catch(() => {});
    }
  }

  return current;
}

function mapRawNotificationRow(row: any): ServerNotificationRecord {
  const createdAt = String(row.created_at || row.createdAt || new Date().toISOString());
  const targetRole = String(row.target_role || row.targetRole || 'all').toLowerCase();
  const targetRoles = normalizeRoleList(targetRole, row.target_roles || row.targetRoles);
  return {
    id: String(row.id || crypto.randomUUID()),
    title: String(row.title || 'Announcement'),
    message: String(row.message || row.body || ''),
    type: String(row.type || 'general').toLowerCase(),
    priority: sanitizeNotificationPriority(row.priority),
    targetRole: targetRoles[0] || targetRole || 'all',
    targetRoles: targetRoles.length > 0 ? targetRoles : [targetRole || 'all'],
    targetGrade: row.target_grade ?? row.targetGrade ?? null,
    targetSection: row.target_section ?? row.targetSection ?? null,
    targetUserId: row.target_user_id ?? row.targetUserId ?? null,
    senderId: row.sender_id ?? row.senderId ?? null,
    senderName: row.sender_name ?? row.senderName ?? null,
    dedupeKey: row.dedupe_key ?? row.dedupeKey ?? null,
    linkTab: row.link_tab ?? row.linkTab ?? row.metadata?.linkTab ?? null,
    expiresAt: row.expires_at ?? row.expiresAt ?? null,
    archivedAt: row.archived_at ?? row.archivedAt ?? null,
    createdAt,
    metadata: row.metadata || undefined,
  };
}

async function fetchRawNotifications(url: string, key: string): Promise<ServerNotificationRecord[]> {
  const combined = new Map<string, ServerNotificationRecord>();
  for (const n of memoryNotifications) combined.set(n.id, n);

  if (url && key && (process.env.NODE_ENV !== 'test' || url.includes('127.0.0.1'))) {
    const effectiveKey = getFeatureAndWinterSupabaseKey(url, key) || WORKING_ANON_KEY;
    const headers = { apikey: effectiveKey, Authorization: `Bearer ${effectiveKey}` };

    const [tRes, gRes] = await Promise.all([
      supabaseFetchWithAnonRetry(
        `${url}/rest/v1/notifications?select=*&order=created_at.desc&limit=100`,
        { headers }
      ).catch(() => null),
      supabaseFetchWithAnonRetry(
        `${url}/rest/v1/global_data?id=eq.${encodeURIComponent(MEMORY_NOTIFICATIONS_DOC_ID)}&select=data`,
        { headers }
      ).catch(() => null),
    ]);

    if (tRes && tRes.ok) {
      const rows = await tRes.json().catch(() => []);
      if (Array.isArray(rows)) {
        for (const r of rows) {
          const mapped = mapRawNotificationRow(r);
          combined.set(mapped.id, mapped);
        }
      }
    }
    if (gRes && gRes.ok) {
      const rows = await gRes.json().catch(() => []);
      const items = rows?.[0]?.data?.items;
      if (Array.isArray(items)) {
        for (const item of items) {
          const mapped = mapRawNotificationRow(item);
          if (!combined.has(mapped.id)) combined.set(mapped.id, mapped);
        }
      }
    }
  }

  return Array.from(combined.values()).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export function registerNotificationRoutes(
  app: express.Application,
  deps: NotificationEngineDeps
) {
  // 1. Fetch eligible notifications & lifecycle state for authenticated actor
  app.get('/api/notifications/list', async (req, res) => {
    try {
      const actor = await deps.getVerifiedUserFromRequest(req);
      if (!actor || !actor.id) {
        return res.status(401).json({ success: false, error: 'Authentication required.' });
      }
      const userId = String(actor.id).trim();
      const role = String(actor.role || 'student').toLowerCase().trim();
      const grade = String(actor.grade || '');
      const section = String(actor.section || '');

      if (!userId) {
        return res.status(401).json({ success: false, error: 'Authentication required.' });
      }

      const cfg = deps.getSupabaseServerConfig();
      const [rawList, userStateMap] = await Promise.all([
        fetchRawNotifications(cfg.url, cfg.key),
        loadUserLifecycleMap(cfg.url, cfg.key, userId),
      ]);

      const nowMs = Date.now();
      const evaluated: EvaluatedNotificationItem[] = [];

      for (const n of rawList) {
        if (!isNotificationEligibleForUser(n, { id: userId, role, grade, section }, nowMs)) {
          continue;
        }
        const st = userStateMap[n.id] || {};
        const { isExpired, isArchived } = isNotificationExpiredOrArchived(n, nowMs);
        evaluated.push({
          ...n,
          isRead: Boolean(st.readAt),
          isDismissed: Boolean(st.dismissedAt),
          isExpired,
          isArchived,
          deliveredAt: st.deliveredAt || null,
          popupPresentedAt: st.popupPresentedAt || null,
          readAt: st.readAt || null,
          dismissedAt: st.dismissedAt || null,
          acknowledgedAt: st.acknowledgedAt || null,
          popupEligible: false,
        });
      }

      const flyouts = selectFlyoutCandidates(evaluated, { nowMs, maxVisible: 1 });
      const flyoutIdSet = new Set(flyouts.map(f => f.id));
      for (const item of evaluated) {
        item.popupEligible = flyoutIdSet.has(item.id);
      }

      return res.json({
        success: true,
        notifications: evaluated.filter(e => !e.isDismissed),
        flyoutCandidates: flyouts,
        unreadCount: evaluated.filter(e => !e.isRead && !e.isDismissed).length,
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err?.message || 'Notification fetch failed' });
    }
  });

  // 2. Persist per-user lifecycle transition (delivered, popup_presented, read, dismissed, acknowledged)
  app.post('/api/notifications/state', async (req, res) => {
    try {
      const actor = await deps.getVerifiedUserFromRequest(req);
      if (!actor || !actor.id) {
        return res.status(401).json({ success: false, error: 'Authentication required.' });
      }
      const { userId: bodyUserId, notificationIds, action } = req.body || {};
      if (bodyUserId && actor.id !== bodyUserId && !['admin', 'super_admin'].includes(actor.role)) {
        return res.status(403).json({ success: false, error: 'Forbidden' });
      }
      const userId = String(
        bodyUserId && ['admin', 'super_admin'].includes(actor.role) ? bodyUserId : actor.id
      ).trim();

      const validActions = ['delivered', 'popup_presented', 'read', 'dismissed', 'acknowledged'];
      if (!validActions.includes(String(action))) {
        return res.status(400).json({ success: false, error: 'Invalid lifecycle action' });
      }

      const ids = Array.isArray(notificationIds) ? notificationIds.map(String).filter(Boolean) : [];
      if (ids.length === 0) {
        return res.json({ success: true, updatedCount: 0 });
      }

      const cfg = deps.getSupabaseServerConfig();
      await persistUserLifecycleUpdate(cfg.url, cfg.key, userId, ids, action);
      return res.json({ success: true, updatedCount: ids.length, action });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err?.message || 'State update failed' });
    }
  });

  // 3. Authoritative staff/admin broadcast endpoint with expiry, targeting & dedupe
  app.post('/api/notifications/broadcast', async (req, res) => {
    try {
      const actor = await deps.getVerifiedUserFromRequest(req);
      if (!actor || !actor.id) {
        return res.status(401).json({ success: false, error: 'Authentication required.' });
      }
      const actorRole = String(actor.role || '').toLowerCase();
      if (!['teacher', 'coordinator', 'admin', 'super_admin'].includes(actorRole)) {
        return res.status(403).json({ success: false, error: 'Only faculty or administrators can send broadcasts.' });
      }

      const {
        id,
        title,
        message,
        type = 'broadcast',
        priority = 'high',
        targetRole = 'all',
        targetRoles,
        targetUserId = null,
        targetGrade = null,
        targetClass = null,
        targetSection = null,
        linkTab = 'notice_viewer',
        ttlHours = 72,
        dedupeKey,
      } = req.body || {};

      if (!title || !message) {
        return res.status(400).json({ success: false, error: 'Title and message are required.' });
      }

      const roles = normalizeRoleList(targetRole, targetRoles);
      const safeTtlHours = Math.max(1, Math.min(720, Number(ttlHours || 72)));
      const now = new Date();
      const expiresAt = new Date(now.getTime() + safeTtlHours * 3600 * 1000).toISOString();
      const resolvedGrade = targetGrade || targetClass || null;

      const record: ServerNotificationRecord = {
        id: String(id || crypto.randomUUID()),
        title: String(title).trim().slice(0, 160),
        message: String(message).trim().slice(0, 2000),
        type: String(type || 'broadcast').toLowerCase(),
        priority: sanitizeNotificationPriority(priority),
        targetRole: roles[0] || 'all',
        targetRoles: roles.length > 0 ? roles : ['all'],
        targetUserId: targetUserId && targetUserId !== 'all' ? String(targetUserId) : null,
        targetGrade: resolvedGrade && resolvedGrade !== 'all' ? String(resolvedGrade) : null,
        targetSection: targetSection && targetSection !== 'all' ? String(targetSection) : null,
        senderId: actor?.id || null,
        senderName: actor?.name || 'Administrator',
        dedupeKey: dedupeKey ? String(dedupeKey) : null,
        linkTab: linkTab ? String(linkTab) : 'notice_viewer',
        expiresAt,
        archivedAt: null,
        createdAt: now.toISOString(),
      };

      // Deduplicate by dedupeKey if provided
      if (record.dedupeKey && memoryNotifications.some(n => n.dedupeKey === record.dedupeKey)) {
        const existing = memoryNotifications.find(n => n.dedupeKey === record.dedupeKey)!;
        return res.json({ success: true, deduplicated: true, notification: existing });
      }

      memoryNotifications.unshift(record);
      if (memoryNotifications.length > 200) memoryNotifications.length = 200;

      const cfg = deps.getSupabaseServerConfig();
      if (cfg.url && cfg.key && (process.env.NODE_ENV !== 'test' || cfg.url.includes('127.0.0.1'))) {
        const effectiveKey = getFeatureAndWinterSupabaseKey(cfg.url, cfg.key) || WORKING_ANON_KEY;
        const headers = {
          apikey: effectiveKey,
          Authorization: `Bearer ${effectiveKey}`,
          'Content-Type': 'application/json',
          Prefer: 'resolution=merge-duplicates',
        };
        await supabaseFetchWithAnonRetry(`${cfg.url}/rest/v1/global_data?on_conflict=id`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            id: MEMORY_NOTIFICATIONS_DOC_ID,
            data: { items: memoryNotifications.slice(0, 100) },
            updated_at: now.toISOString(),
          }),
        }).catch(() => {});

        await supabaseFetchWithAnonRetry(`${cfg.url}/rest/v1/notifications`, {
          method: 'POST',
          headers: { ...headers, Prefer: 'return=minimal' },
          body: JSON.stringify({
            id: record.id,
            title: record.title,
            message: record.message,
            type: record.type,
            priority: record.priority,
            target_role: record.targetRole,
            target_roles: record.targetRoles,
            target_grade: record.targetGrade,
            target_section: record.targetSection,
            sender_id: record.senderId,
            sender_name: record.senderName,
            dedupe_key: record.dedupeKey,
            expires_at: record.expiresAt,
            created_at: record.createdAt,
          }),
        }).catch(() => {});
      }

      deps.broadcastToAllWs({
        type: 'notification:broadcast',
        notification: record,
      });

      let pushDispatch: any = null;
      if (deps.dispatchWebPush) {
        try {
          pushDispatch = await deps.dispatchWebPush({
            notificationId: record.id,
            title: record.title,
            body: record.message,
            type: record.type,
            linkTab: record.linkTab || 'notice_viewer',
            tag: `studentos-notif-${record.id}`,
            targetUserId: record.targetUserId || 'all',
            targetRole: record.targetRole,
            targetRoles: record.targetRoles,
            targetClass: record.targetGrade || 'all',
            targetSection: record.targetSection || 'all',
          });
        } catch (pushErr: any) {
          console.warn('[NotificationEngine] Web Push dispatch warning:', pushErr?.message || pushErr);
        }
      }

      return res.json({ success: true, deduplicated: false, notification: record, pushDispatch });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err?.message || 'Broadcast creation failed' });
    }
  });
}

export function __resetNotificationEngineMemoryForTests() {
  memoryNotifications.length = 0;
  memoryUserStates.clear();
}
