/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { supabase } from './supabase';
import { 
  SystemUpdate, SystemUpdateRead, SystemUpdateAuditLog, UserRole,
  StudentOSRelease, ReleaseStatus, DeploymentStatus, WhatsNewReleaseStatus
} from '../types';

const STORAGE_KEY_UPDATES = 's_os_system_updates_cache';
const STORAGE_KEY_READS = 's_os_system_update_reads_cache';
const STORAGE_KEY_DISMISSED_MAJOR = 's_os_dismissed_major_releases';
const STORAGE_KEY_RELEASES = 's_os_releases_cache';

// Canonical initial official updates for StudentOS to bootstrap high-fidelity release history
export const DEFAULT_SYSTEM_UPDATES: SystemUpdate[] = [
  {
    id: 'update-v3-12-0',
    version: 'v3.12.0',
    title: 'StudentOS Meet Virtual Classroom & What’s New Release Hub',
    summary: 'Introducing unified HD virtual classroom conferencing with screen sharing, breakout rooms, and official release notes.',
    category: 'feature',
    content: `### 🚀 What's New in StudentOS v3.12.0

We are thrilled to launch the **StudentOS Meet Virtual Classroom** alongside our brand new **Official What’s New Release Hub**.

#### 📹 Virtual Classroom Highlights
- **Interactive Multi-User Video & Audio**: Real-time WebRTC grid with dynamic speaker detection.
- **Presenter Screen Sharing**: Share desktop windows, slide decks, and code editors directly in sessions.
- **Integrated Live Chat & Reactions**: Raise hands, ask questions, and send instant feedback to instructors.
- **Role-Gated Security Controls**: Faculty members can mute all participants, lock the room, and manage admission.

#### 📢 Centralized What's New Portal
- Follow versioned release updates across web, PWA, and Android APK.
- Filter releases by category (Features, Improvements, Fixes, Maintenance).
- Server-synced read states follow your StudentOS account across devices.
`,
    status: 'published',
    audienceRoles: ['all'],
    isMajorRelease: true,
    actionUrl: 'meet',
    actionLabel: 'Launch StudentOS Meet',
    mediaUrls: [
      'https://images.unsplash.com/photo-1588196749597-9ff075ee6b5b?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1531403009284-440f080d1e12?auto=format&fit=crop&w=1200&q=80'
    ],
    authorId: 'super-admin-root',
    authorName: 'StudentOS Core Team',
    authorRole: 'super_admin',
    publishedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    id: 'update-v3-11-2',
    version: 'v3.11.2',
    title: 'Digital Gradebook Performance & Classroom Security PIN Enhancement',
    summary: 'Speed improvements for multi-class grade records, attendance sync speedup, and teacher quick-lock screen.',
    category: 'improvement',
    content: `### ⚡ Digital Gradebook & Security Enhancements

This update brings speed optimizations and faculty safety controls when operating in front of classroom smart boards.

#### 🛡️ Teacher Security Mode
- **Quick-Lock Screen**: Single-tap workspace lock requiring your 4-to-6 digit PIN.
- **Smart Board Display Mode**: Enlarged high-contrast touch controls designed for classroom interactive displays.
- **Presentation Privacy Filter**: Automatically obscures student contact emails and private assessment notes while projecting.

#### 📊 Gradebook Performance
- Instant calculation of GPA, class medians, and letter grades.
- Bulk export of official assessment summaries to PDF.
`,
    status: 'published',
    audienceRoles: ['all'],
    isMajorRelease: false,
    actionUrl: 'gradebook',
    actionLabel: 'View Digital Gradebook',
    authorId: 'super-admin-root',
    authorName: 'Academic Systems Team',
    authorRole: 'super_admin',
    publishedAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(),
    createdAt: new Date(Date.now() - 9 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    id: 'update-v3-10-0',
    version: 'v3.10.0',
    title: 'Offline PWA Support & Direct Android APK Distribution',
    summary: 'Install StudentOS directly onto your Android smartphone, tablet, or Chromebook with full offline capability.',
    category: 'feature',
    content: `### 📱 Android APK & Progressive Web App (PWA) Release

StudentOS is now available everywhere you study!

#### 🚀 Key Features
- **Standalone Android APK**: Download the certified APK directly from within the app header.
- **Offline Notes & Study Planner**: Access your saved lecture notes and timetable even when internet is disconnected.
- **Background Web Push Alerts**: Receive instant broadcast notices, homework reminders, and release alerts.
`,
    status: 'published',
    audienceRoles: ['all'],
    isMajorRelease: true,
    actionUrl: 'dashboard',
    actionLabel: 'Explore Dashboard',
    authorId: 'super-admin-root',
    authorName: 'Engineering Core',
    authorRole: 'super_admin',
    publishedAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(),
    createdAt: new Date(Date.now() - 22 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    id: 'update-v3-9-5',
    version: 'v3.9.5',
    title: 'Whiteboard Vector Shapes & Collaborative Real-Time Drawing Fix',
    summary: 'Resolved stroke latency across parallel browser sessions and added shape alignment guides.',
    category: 'bugfix',
    content: `### 🐛 Whiteboard Sync Stability & Drawing Fixes

#### What was fixed:
- Addressed WebSocket stroke buffer reconnection delay when switching WiFi networks.
- Improved geometric shape snap alignment for circle, rectangle, and arrow tools.
- Fixed dark/light mode canvas snapshot export background inversion.
`,
    status: 'published',
    audienceRoles: ['all'],
    isMajorRelease: false,
    actionUrl: 'whiteboard',
    actionLabel: 'Open Drawing Board',
    authorId: 'super-admin-root',
    authorName: 'Canvas Graphics Team',
    authorRole: 'super_admin',
    publishedAt: new Date(Date.now() - 35 * 24 * 60 * 60 * 1000).toISOString(),
    createdAt: new Date(Date.now() - 36 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 35 * 24 * 60 * 60 * 1000).toISOString()
  }
];

function getCachedUpdates(): SystemUpdate[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_UPDATES);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (_) {}
  return DEFAULT_SYSTEM_UPDATES;
}

function setCachedUpdates(updates: SystemUpdate[]) {
  try {
    localStorage.setItem(STORAGE_KEY_UPDATES, JSON.stringify(updates));
  } catch (_) {}
}

function mapRowToUpdate(row: any): SystemUpdate {
  return {
    id: row.id,
    version: row.version || 'v1.0.0',
    title: row.title || 'Untitled Update',
    summary: row.summary || '',
    category: row.category || 'feature',
    content: row.content || '',
    status: row.status || 'published',
    audienceRoles: Array.isArray(row.audience_roles)
      ? row.audience_roles
      : (row.audience_roles ? JSON.parse(row.audience_roles) : ['all']),
    isMajorRelease: Boolean(row.is_major_release),
    actionUrl: row.action_url || undefined,
    actionLabel: row.action_label || undefined,
    mediaUrls: Array.isArray(row.media_urls)
      ? row.media_urls
      : (row.media_urls ? JSON.parse(row.media_urls) : []),
    authorId: row.author_id || 'super-admin',
    authorName: row.author_name || 'Super Admin',
    authorRole: row.author_role || 'super_admin',
    scheduledPublishAt: row.scheduled_publish_at || undefined,
    publishedAt: row.published_at || undefined,
    archivedAt: row.archived_at || undefined,
    createdAt: row.created_at || new Date().toISOString(),
    updatedAt: row.updated_at || new Date().toISOString(),
    raw_data: row.raw_data
  };
}

function mapUpdateToRow(update: SystemUpdate) {
  return {
    id: update.id,
    version: update.version,
    title: update.title,
    summary: update.summary,
    category: update.category,
    content: update.content,
    status: update.status,
    audience_roles: update.audienceRoles,
    is_major_release: Boolean(update.isMajorRelease),
    action_url: update.actionUrl || null,
    action_label: update.actionLabel || null,
    media_urls: update.mediaUrls || [],
    author_id: update.authorId,
    author_name: update.authorName,
    author_role: update.authorRole || 'super_admin',
    scheduled_publish_at: update.scheduledPublishAt || null,
    published_at: update.publishedAt || null,
    archived_at: update.archivedAt || null,
    created_at: update.createdAt,
    updated_at: update.updatedAt,
    raw_data: update.raw_data || {}
  };
}

/**
 * Fetch updates visible to the current user.
 * Strictly enforces:
 *  - status = 'published'
 *  - published_at <= current time
 *  - audience_roles contains 'all' OR user's role
 */
export async function getPublishedUpdates(userRole: UserRole = 'student'): Promise<SystemUpdate[]> {
  const nowIso = new Date().toISOString();
  try {
    const { data, error } = await supabase
      .from('system_updates')
      .select('*')
      .eq('status', 'published')
      .order('published_at', { ascending: false });

    if (!error && Array.isArray(data) && data.length > 0) {
      const mapped = data.map(mapRowToUpdate);
      // Defensive server-time & audience filter
      const nowMs = Date.now();
      const filtered = mapped.filter(u => {
        // Scheduled defensive check
        if (u.publishedAt && new Date(u.publishedAt).getTime() > nowMs) {
          return false;
        }
        // Audience filter
        const roles = u.audienceRoles || ['all'];
        if (roles.includes('all')) return true;
        if (roles.includes(userRole)) return true;
        if (userRole === 'super_admin') return true;
        return false;
      });

      // Merge defaults if database has only fresh items
      const combined = [...filtered];
      DEFAULT_SYSTEM_UPDATES.forEach(def => {
        if (!combined.some(c => c.id === def.id || c.version === def.version)) {
          combined.push(def);
        }
      });
      combined.sort((a, b) => {
        const timeA = new Date(a.publishedAt || a.createdAt).getTime();
        const timeB = new Date(b.publishedAt || b.createdAt).getTime();
        return timeB - timeA;
      });
      setCachedUpdates(combined);
      return combined;
    }
  } catch (err) {
    console.warn('[WhatsNew] Note querying Supabase system_updates:', err);
  }

  // Local fallback
  const cached = getCachedUpdates();
  const nowMs = Date.now();
  return cached.filter(u => {
    if (u.status !== 'published') return false;
    if (u.publishedAt && new Date(u.publishedAt).getTime() > nowMs) return false;
    const roles = u.audienceRoles || ['all'];
    return roles.includes('all') || roles.includes(userRole) || userRole === 'super_admin';
  }).sort((a, b) => {
    const timeA = new Date(a.publishedAt || a.createdAt).getTime();
    const timeB = new Date(b.publishedAt || b.createdAt).getTime();
    return timeB - timeA;
  });
}

/**
 * Fetch all updates for Super Admin (drafts, scheduled, published, archived).
 */
export async function getAllUpdatesForSuperAdmin(): Promise<SystemUpdate[]> {
  try {
    const { data, error } = await supabase
      .from('system_updates')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && Array.isArray(data) && data.length > 0) {
      const mapped = data.map(mapRowToUpdate);
      // Ensure default releases are present
      DEFAULT_SYSTEM_UPDATES.forEach(def => {
        if (!mapped.some(m => m.id === def.id || m.version === def.version)) {
          mapped.push(def);
        }
      });
      mapped.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setCachedUpdates(mapped);
      return mapped;
    }
  } catch (err) {
    console.warn('[WhatsNew] Note fetching all updates for Super Admin:', err);
  }

  return getCachedUpdates();
}

/**
 * Save / Create an update in Supabase and local cache.
 */
export async function saveSystemUpdate(
  update: SystemUpdate,
  actor: { id: string; name: string; role: string }
): Promise<SystemUpdate> {
  const row = mapUpdateToRow(update);

  try {
    const { data, error } = await supabase
      .from('system_updates')
      .upsert(row, { onConflict: 'id' })
      .select()
      .single();

    if (error) {
      console.warn('[WhatsNew] Upsert note on system_updates:', error.message);
    }
  } catch (err) {
    console.warn('[WhatsNew] Exception upserting update to Supabase:', err);
  }

  // Update local cache
  const cached = getCachedUpdates();
  const existingIdx = cached.findIndex(u => u.id === update.id);
  let updatedList: SystemUpdate[];
  if (existingIdx >= 0) {
    updatedList = [...cached];
    updatedList[existingIdx] = update;
  } else {
    updatedList = [update, ...cached];
  }
  setCachedUpdates(updatedList);

  // Record audit log
  await recordAuditLog({
    id: 'audit-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
    updateId: update.id,
    action: existingIdx >= 0 ? (update.status === 'published' ? 'publish' : 'edit') : 'create',
    actorId: actor.id,
    actorName: actor.name,
    actorRole: actor.role,
    timestamp: new Date().toISOString(),
    details: `${update.version} - ${update.title} [Status: ${update.status.toUpperCase()}]`
  });

  return update;
}

/**
 * Delete an update (draft or archived) by ID.
 */
export async function deleteSystemUpdate(
  updateId: string,
  actor: { id: string; name: string; role: string }
): Promise<boolean> {
  try {
    await supabase.from('system_updates').delete().eq('id', updateId);
  } catch (err) {
    console.warn('[WhatsNew] Delete note on Supabase:', err);
  }

  const cached = getCachedUpdates();
  const filtered = cached.filter(u => u.id !== updateId);
  setCachedUpdates(filtered);

  await recordAuditLog({
    id: 'audit-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
    updateId,
    action: 'delete',
    actorId: actor.id,
    actorName: actor.name,
    actorRole: actor.role,
    timestamp: new Date().toISOString(),
    details: `Deleted update ${updateId}`
  });

  return true;
}

// ============================================================
// READ STATE PERSISTENCE (Follows user account across devices)
// ============================================================

export async function getUserReadUpdateIds(userId: string): Promise<Set<string>> {
  if (!userId) return new Set();

  const readSet = new Set<string>();

  // 1. Read from localStorage cache first for zero-latency UI
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY_READS}_${userId}`);
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) {
        arr.forEach(id => readSet.add(id));
      }
    }
  } catch (_) {}

  // 2. Fetch authoritative state from Supabase
  try {
    const { data, error } = await supabase
      .from('system_update_reads')
      .select('update_id')
      .eq('user_id', userId);

    if (!error && Array.isArray(data)) {
      data.forEach(row => {
        if (row.update_id) readSet.add(row.update_id);
      });
      // Save merged to cache
      try {
        localStorage.setItem(`${STORAGE_KEY_READS}_${userId}`, JSON.stringify(Array.from(readSet)));
      } catch (_) {}
    }
  } catch (err) {
    console.warn('[WhatsNew] Reads query note:', err);
  }

  return readSet;
}

export async function markUpdateAsRead(updateId: string, userId: string): Promise<void> {
  if (!userId || !updateId) return;

  // 1. Instant local cache update
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY_READS}_${userId}`);
    const set = new Set(raw ? JSON.parse(raw) : []);
    set.add(updateId);
    localStorage.setItem(`${STORAGE_KEY_READS}_${userId}`, JSON.stringify(Array.from(set)));
  } catch (_) {}

  // 2. Persist to Supabase
  try {
    await supabase.from('system_update_reads').upsert({
      id: `${updateId}_${userId}`,
      update_id: updateId,
      user_id: userId,
      read_at: new Date().toISOString()
    }, { onConflict: 'id' });
  } catch (err) {
    console.warn('[WhatsNew] Upsert read state note:', err);
  }
}

export async function markAllUpdatesAsRead(userId: string, updateIds: string[]): Promise<void> {
  if (!userId || !updateIds || updateIds.length === 0) return;

  // 1. Instant local cache update
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY_READS}_${userId}`);
    const set = new Set(raw ? JSON.parse(raw) : []);
    updateIds.forEach(id => set.add(id));
    localStorage.setItem(`${STORAGE_KEY_READS}_${userId}`, JSON.stringify(Array.from(set)));
  } catch (_) {}

  // 2. Batch persist to Supabase
  try {
    const rows = updateIds.map(id => ({
      id: `${id}_${userId}`,
      update_id: id,
      user_id: userId,
      read_at: new Date().toISOString()
    }));
    await supabase.from('system_update_reads').upsert(rows, { onConflict: 'id' });
  } catch (err) {
    console.warn('[WhatsNew] Batch mark all reads note:', err);
  }
}

// ============================================================
// MAJOR RELEASE NOTICE DISMISSAL TRACKING
// ============================================================

export function isMajorReleaseDismissed(userId: string, releaseId: string): boolean {
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY_DISMISSED_MAJOR}_${userId}`);
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr) && arr.includes(releaseId)) {
        return true;
      }
    }
  } catch (_) {}
  return false;
}

export function dismissMajorRelease(userId: string, releaseId: string): void {
  try {
    const key = `${STORAGE_KEY_DISMISSED_MAJOR}_${userId}`;
    const raw = localStorage.getItem(key);
    const set = new Set(raw ? JSON.parse(raw) : []);
    set.add(releaseId);
    localStorage.setItem(key, JSON.stringify(Array.from(set)));
  } catch (_) {}
}

// ============================================================
// AUDIT LOG TRACKING
// ============================================================

export async function recordAuditLog(log: SystemUpdateAuditLog): Promise<void> {
  try {
    await supabase.from('system_update_audit_logs').insert({
      id: log.id,
      update_id: log.updateId,
      action: log.action,
      actor_id: log.actorId,
      actor_name: log.actorName,
      actor_role: log.actorRole,
      timestamp: log.timestamp,
      details: log.details || null
    });
  } catch (err) {
    console.warn('[WhatsNew] Audit log insert note:', err);
  }
}

export async function fetchAuditLogs(updateId?: string): Promise<SystemUpdateAuditLog[]> {
  try {
    let query = supabase.from('system_update_audit_logs').select('*').order('timestamp', { ascending: false }).limit(100);
    if (updateId) {
      query = query.eq('update_id', updateId);
    }
    const { data, error } = await query;
    if (!error && Array.isArray(data)) {
      return data.map(r => ({
        id: r.id,
        updateId: r.update_id,
        action: r.action,
        actorId: r.actor_id,
        actorName: r.actor_name,
        actorRole: r.actor_role,
        timestamp: r.timestamp,
        details: r.details
      }));
    }
  } catch (err) {
    console.warn('[WhatsNew] Fetch audit logs note:', err);
  }
  return [];
}

// ============================================================
// SCHEDULED STUDENTOS RELEASE SYSTEM
// ============================================================

export const DEFAULT_STUDENTOS_RELEASES: StudentOSRelease[] = [
  {
    id: 'rel-2.9.0',
    release_id: 'rel-2.9.0',
    version: '2.9.0',
    title: 'StudentOS v2.9.0 — Orion Nova & High-Yield Study Center',
    description: 'Interactive SM-2 active recall flashcards, deterministic PWA detection, and responsive audit across all devices.',
    content: `### 🚀 StudentOS v2.9.0 Highlights\n\n* **Study Center UX Upgrades**: Redesigned flashcard session controls with permanent answer reveal, Next Card deck progression, and touch-optimized flip mechanics.\n* **App Environment Engine**: Centralized detection of Website, installed PWA, and APK/Native wrappers with standalone display-mode synchronization.\n* **Scheduled Release System**: Super Admin release coordination pipeline with automated What's New synchronizer.\n* **Responsive Excellence**: Multi-device viewport audit ensuring seamless navigation from 320px mobile to 1920px desktop displays.`,
    category: 'feature',
    status: 'RELEASED',
    scheduled_release_at: '2026-10-01T10:00:00.000Z',
    actual_released_at: '2026-10-01T10:00:00.000Z',
    deployment_status: 'DEPLOYED',
    whats_new_status: 'PUBLISHED',
    audience_roles: ['all'],
    created_by: 'super_admin_system',
    created_by_name: 'Super Admin',
    created_at: '2026-09-30T12:00:00.000Z',
    updated_at: '2026-09-30T12:00:00.000Z',
    is_major: true
  },
  {
    id: 'rel-2.8.5',
    release_id: 'rel-2.8.5',
    version: '2.8.5',
    title: 'StudentOS v2.8.5 — Teacher Portal & Analytics Sub-tabs',
    description: 'Dropdown navigation, Performance Analytics refactor, and Pusher Beams web push integration.',
    content: `* ProfessionalTabDropdown integration for Material Hub, Study Hub, and Performance Analytics.\n* Real-time push notification syncing and VAPID key fail-safe.`,
    category: 'improvement',
    status: 'RELEASED',
    scheduled_release_at: '2026-09-25T14:00:00.000Z',
    actual_released_at: '2026-09-25T14:00:00.000Z',
    deployment_status: 'DEPLOYED',
    whats_new_status: 'PUBLISHED',
    audience_roles: ['all'],
    created_by: 'super_admin_system',
    created_by_name: 'Super Admin',
    created_at: '2026-09-25T10:00:00.000Z',
    updated_at: '2026-09-25T14:00:00.000Z',
    is_major: false
  }
];

function getCachedReleases(): StudentOSRelease[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_RELEASES);
    if (raw) return JSON.parse(raw);
  } catch (_) {}
  return DEFAULT_STUDENTOS_RELEASES;
}

function setCachedReleases(releases: StudentOSRelease[]) {
  try {
    localStorage.setItem(STORAGE_KEY_RELEASES, JSON.stringify(releases));
  } catch (_) {}
}

export async function getAllReleases(): Promise<StudentOSRelease[]> {
  try {
    const { data, error } = await supabase
      .from('studentos_releases')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && Array.isArray(data) && data.length > 0) {
      const mapped = data.map((r: any): StudentOSRelease => ({
        id: r.id,
        release_id: r.release_id || r.id,
        version: r.version,
        title: r.title,
        description: r.description,
        content: r.content || '',
        category: r.category || 'feature',
        status: r.status || 'DRAFT',
        scheduled_release_at: r.scheduled_release_at,
        actual_released_at: r.actual_released_at,
        deployment_status: r.deployment_status || 'PENDING',
        whats_new_status: r.whats_new_status || 'DRAFT',
        audience_roles: r.audience_roles || ['all'],
        created_by: r.created_by,
        created_by_name: r.created_by_name,
        created_at: r.created_at,
        updated_at: r.updated_at,
        is_major: r.is_major
      }));

      // Merge defaults
      const combined = [...mapped];
      DEFAULT_STUDENTOS_RELEASES.forEach(def => {
        if (!combined.some(c => c.id === def.id || c.version === def.version)) {
          combined.push(def);
        }
      });
      setCachedReleases(combined);
      return combined;
    }
  } catch (err) {
    console.warn('[Releases] Fetch releases notice:', err);
  }

  return getCachedReleases();
}

export async function saveRelease(
  release: StudentOSRelease,
  actor: { id: string; name: string; role: string }
): Promise<StudentOSRelease> {
  const row = {
    id: release.id,
    release_id: release.release_id,
    version: release.version,
    title: release.title,
    description: release.description,
    content: release.content,
    category: release.category,
    status: release.status,
    scheduled_release_at: release.scheduled_release_at,
    actual_released_at: release.actual_released_at,
    deployment_status: release.deployment_status,
    whats_new_status: release.whats_new_status,
    audience_roles: release.audience_roles,
    created_by: release.created_by,
    created_by_name: release.created_by_name,
    created_at: release.created_at,
    updated_at: new Date().toISOString(),
    is_major: release.is_major
  };

  try {
    await supabase.from('studentos_releases').upsert(row, { onConflict: 'id' });
  } catch (err) {
    console.warn('[Releases] Upsert release notice:', err);
  }

  // Update local cache
  const cached = getCachedReleases();
  const existingIdx = cached.findIndex(r => r.id === release.id);
  let updatedList: StudentOSRelease[];
  if (existingIdx >= 0) {
    updatedList = [...cached];
    updatedList[existingIdx] = release;
  } else {
    updatedList = [release, ...cached];
  }
  setCachedReleases(updatedList);

  // If status is RELEASED, automatically ensure corresponding What's New entry is published
  if (release.status === 'RELEASED') {
    await publishCorrespondingWhatsNew(release, actor);
  }

  return release;
}

export async function publishReleaseNow(
  releaseId: string,
  actor: { id: string; name: string; role: string }
): Promise<StudentOSRelease> {
  const all = await getAllReleases();
  const release = all.find(r => r.id === releaseId || r.release_id === releaseId);
  if (!release) throw new Error('Release not found');

  const nowIso = new Date().toISOString();
  const updated: StudentOSRelease = {
    ...release,
    status: 'RELEASED',
    actual_released_at: nowIso,
    deployment_status: 'DEPLOYED',
    whats_new_status: 'PUBLISHED',
    updated_at: nowIso
  };

  return await saveRelease(updated, actor);
}

export async function scheduleRelease(
  releaseId: string,
  scheduledIso: string,
  actor: { id: string; name: string; role: string }
): Promise<StudentOSRelease> {
  const all = await getAllReleases();
  const release = all.find(r => r.id === releaseId || r.release_id === releaseId);
  if (!release) throw new Error('Release not found');

  const nowIso = new Date().toISOString();
  const updated: StudentOSRelease = {
    ...release,
    status: 'SCHEDULED',
    scheduled_release_at: scheduledIso,
    deployment_status: 'READY',
    whats_new_status: 'READY',
    updated_at: nowIso
  };

  return await saveRelease(updated, actor);
}

export async function cancelScheduledRelease(
  releaseId: string,
  actor: { id: string; name: string; role: string }
): Promise<StudentOSRelease> {
  const all = await getAllReleases();
  const release = all.find(r => r.id === releaseId || r.release_id === releaseId);
  if (!release) throw new Error('Release not found');

  const nowIso = new Date().toISOString();
  const updated: StudentOSRelease = {
    ...release,
    status: 'CANCELLED',
    deployment_status: 'PENDING',
    whats_new_status: 'DRAFT',
    updated_at: nowIso
  };

  return await saveRelease(updated, actor);
}

export async function deleteRelease(
  releaseId: string,
  actor: { id: string; name: string; role: string }
): Promise<void> {
  try {
    await supabase.from('studentos_releases').delete().eq('id', releaseId);
  } catch (_) {}

  const cached = getCachedReleases();
  setCachedReleases(cached.filter(r => r.id !== releaseId));
}

/**
 * Publishes a What's New entry matching an officially released StudentOS version.
 */
async function publishCorrespondingWhatsNew(
  release: StudentOSRelease,
  actor: { id: string; name: string; role: string }
): Promise<void> {
  const updateId = `update-${release.version.replace(/\./g, '-')}`;
  const nowIso = release.actual_released_at || new Date().toISOString();

  const update: SystemUpdate = {
    id: updateId,
    version: release.version.startsWith('v') ? release.version : `v${release.version}`,
    title: release.title,
    summary: release.description,
    category: release.category,
    content: release.content,
    status: 'published',
    audienceRoles: release.audience_roles,
    isMajorRelease: release.is_major,
    authorId: actor.id,
    authorName: actor.name,
    authorRole: actor.role,
    publishedAt: nowIso,
    createdAt: release.created_at,
    updatedAt: nowIso
  };

  await saveSystemUpdate(update, actor);

  // Broadcast window event
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('studentos_whats_new_updated', {
      detail: { type: 'whats_new:published', update }
    }));
  }
}

/**
 * Checks for scheduled releases whose release time has arrived, promoting them to RELEASED.
 */
export async function checkAndPromoteScheduledReleases(
  actor = { id: 'system_cron', name: 'System Release Engine', role: 'system' }
): Promise<{ promotedCount: number }> {
  const releases = await getAllReleases();
  const nowMs = Date.now();
  let promotedCount = 0;

  for (const rel of releases) {
    if (rel.status === 'SCHEDULED' && rel.scheduled_release_at) {
      const scheduledMs = new Date(rel.scheduled_release_at).getTime();
      if (scheduledMs <= nowMs) {
        await publishReleaseNow(rel.id, actor);
        promotedCount++;
      }
    }
  }

  return { promotedCount };
}

