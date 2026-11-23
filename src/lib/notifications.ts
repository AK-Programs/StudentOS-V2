import { supabase } from './supabase';
import { AppNotification } from '../types';
import { soundService } from './soundService';
import { buildNotificationUrl, dispatchNotificationNavigation } from './notificationNavigation';

function isValidUUID(str?: string): boolean {
  if (!str) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
}

export function generateUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Helper to check if a user profile is eligible to receive a notification
 */
const STUDENT_ONLY_NOTIFICATION_TYPES = new Set([
  'flashcard',
  'flashcard_due',
  'flashcards_due',
  'homework_due',
  'study_reminder',
  'exam_prep',
  'pomodoro_reminder',
]);

/**
 * Helper to check if a user profile is eligible to receive a notification.
 * Enforces expiry, archival, direct user targeting, multi-role rules, cohort grade/section,
 * and ensures student flashcard/study reminders NEVER reach Teachers, Coordinators, Admins, or Parents.
 */
export function isUserEligibleForNotification(
  notif: AppNotification | any,
  user?: { uid?: string; id?: string; grade?: string; classGrade?: string; section?: string; role?: string },
  nowMs: number = Date.now()
): boolean {
  if (!notif) return false;
  if (notif.archivedAt || notif.archived_at) return false;
  const rawExpires = notif.expiresAt || notif.expires_at;
  if (rawExpires) {
    const expMs = new Date(rawExpires).getTime();
    if (Number.isFinite(expMs) && expMs <= nowMs) return false;
  }

  if (!user) return true;
  const userId = user.uid || user.id;
  const userGrade = user.grade || user.classGrade || '';
  const userSection = user.section || '';
  const userRole = (user.role || 'student').toLowerCase().trim();

  const targetUser = notif.targetUserId || notif.target_user_id || notif.user_id || 'all';
  const targetRole = notif.targetRole || notif.target_role || 'all';
  const targetRolesRaw = Array.isArray(notif.targetRoles || notif.target_roles)
    ? (notif.targetRoles || notif.target_roles)
    : [];
  const targetClass = notif.targetClass || notif.target_class || notif.targetGrade || notif.target_grade || 'all';
  const targetSection = notif.targetSection || notif.target_section || 'all';

  const notifType = String(notif.type || 'general').toLowerCase().trim();
  const linkTab = String(notif.linkTab || '').toLowerCase().trim();
  const notifTitle = String(notif.title || '').toLowerCase();

  // Strict guard: Student study/flashcard reminders must NEVER appear on non-student roles
  if (
    userRole !== 'student' &&
    (STUDENT_ONLY_NOTIFICATION_TYPES.has(notifType) ||
      linkTab === 'flashcards' ||
      (notifType === 'reminder' && notifTitle.includes('flashcard')))
  ) {
    return false;
  }

  // 1. User ID matching
  if (targetUser && targetUser !== 'all' && targetUser !== null && userId && targetUser !== userId) {
    return false;
  }

  // 2. Role / multi-role matching
  const allowedRoles = Array.from(
    new Set(
      [
        ...targetRolesRaw.map((r: any) => String(r || '').toLowerCase().trim()),
        ...String(targetRole || '')
          .split(',')
          .map(r => r.toLowerCase().trim()),
      ].filter(Boolean)
    )
  );
  if (allowedRoles.length > 0 && !allowedRoles.includes('all')) {
    if (allowedRoles.includes('faculty') || allowedRoles.includes('staff')) {
      if (!['teacher', 'coordinator', 'admin', 'super_admin'].includes(userRole)) {
        return false;
      }
    } else if (!allowedRoles.includes(userRole)) {
      return false;
    }
  }

  // 3. Class/Grade matching (applies primarily to students when cohort-scoped)
  const rawTargetClass = String(targetClass || 'all').trim().toLowerCase();
  const isAllGrades = !rawTargetClass || rawTargetClass === 'all' || rawTargetClass === 'all grades';
  if (!isAllGrades && userRole === 'student') {
    if (!userGrade) return false;
    const normTargetC = rawTargetClass.replace(/class|grade|\s+/g, '');
    const normUserC = userGrade.toString().toLowerCase().replace(/class|grade|\s+/g, '');
    if (!normUserC.includes(normTargetC) && !normTargetC.includes(normUserC)) {
      return false;
    }
  }

  // 4. Section matching
  const rawTargetSec = String(targetSection || 'all').trim().toLowerCase();
  const isAllSections = !rawTargetSec || rawTargetSec === 'all' || rawTargetSec === 'all sections';
  if (!isAllSections && userRole === 'student') {
    if (!userSection) return false;
    const normUserS = userSection.toString().toLowerCase().trim();
    if (normUserS !== rawTargetSec && !normUserS.includes(rawTargetSec)) {
      return false;
    }
  }

  return true;
}

/**
 * Determines if a notification is eligible to auto-pop as a floating toast/flyout.
 * Blocks old broadcast replays, dismissed, read, expired, or previously presented items.
 */
export function isNotificationPopupEligible(
  notif: any,
  user?: { uid?: string; id?: string; grade?: string; classGrade?: string; section?: string; role?: string },
  options?: { nowMs?: number; freshnessWindowMs?: number }
): boolean {
  const nowMs = options?.nowMs ?? Date.now();
  const freshnessWindowMs = options?.freshnessWindowMs ?? 24 * 60 * 60 * 1000;
  if (!isUserEligibleForNotification(notif, user, nowMs)) return false;
  if (notif.isRead || notif.isDismissed || notif.readAt || notif.dismissedAt) return false;
  if (notif.popupPresentedAt || notif.popup_presented_at || notif.acknowledgedAt) return false;

  const createdMs = new Date(notif.createdAt || notif.created_at || 0).getTime();
  if (!Number.isFinite(createdMs) || nowMs - createdMs > freshnessWindowMs) return false;

  const prio = String(notif.priority || '').toLowerCase();
  const type = String(notif.type || '').toLowerCase();
  return prio === 'urgent' || prio === 'high' || type === 'broadcast' || type === 'urgent';
}

/**
 * Helper to convert urlBase64 to Uint8Array for VAPID applicationServerKey
 */
function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Fetch notifications from Supabase with targeting and per-user state
 */
export async function getAppNotifications(
  userId?: string, 
  userClass?: string, 
  userSection?: string, 
  userRole?: string
): Promise<Array<AppNotification & { priority?: string; expiresAt?: string | null; popupPresentedAt?: string | null; deliveredAt?: string | null; acknowledgedAt?: string | null; targetRoles?: string[] }>> {
  const notifMap = new Map<string, any>();
  const userStateMap = new Map<string, { isRead: boolean; isDismissed: boolean; popupPresentedAt?: string | null; deliveredAt?: string | null; acknowledgedAt?: string | null }>();

  // 1. Local per-user lifecycle cache
  if (typeof window !== 'undefined' && userId) {
    try {
      const local = JSON.parse(localStorage.getItem(`s_os_notif_states_${userId}`) || '{}');
      Object.keys(local).forEach(id => {
        userStateMap.set(id, {
          isRead: Boolean(local[id].isRead),
          isDismissed: Boolean(local[id].isDismissed),
          popupPresentedAt: local[id].popupPresentedAt || null,
          deliveredAt: local[id].deliveredAt || null,
          acknowledgedAt: local[id].acknowledgedAt || null,
        });
      });
    } catch (_) {}
  }

  // 2. Authoritative backend notification lifecycle list (handles demo & UUID users + server expiry)
  if (typeof window !== 'undefined' && userId) {
    try {
      const params = new URLSearchParams({
        userId,
        role: userRole || 'student',
        grade: userClass || '',
        section: userSection || '',
      });
      const apiRes = await fetch(`/api/notifications/list?${params.toString()}`);
      if (apiRes.ok) {
        const apiData = await apiRes.json().catch(() => null);
        if (apiData?.success && Array.isArray(apiData.notifications)) {
          for (const item of apiData.notifications) {
            const localSt = userStateMap.get(item.id);
            const mergedRead = Boolean(item.isRead || localSt?.isRead);
            const mergedDismissed = Boolean(item.isDismissed || localSt?.isDismissed);
            const mergedPresented = item.popupPresentedAt || localSt?.popupPresentedAt || null;
            if (mergedDismissed) continue;
            const merged = {
              ...item,
              isRead: mergedRead,
              popupPresentedAt: mergedPresented,
              deliveredAt: item.deliveredAt || localSt?.deliveredAt || null,
              acknowledgedAt: item.acknowledgedAt || localSt?.acknowledgedAt || null,
            };
            if (isUserEligibleForNotification(merged, { uid: userId, grade: userClass, section: userSection, role: userRole })) {
              notifMap.set(merged.id, merged);
            }
          }
        }
      }
    } catch (_) {}
  }

  // 3. Fetch per-user notification state from Supabase notification_user_state
  if (userId) {
    try {
      const { data: userStates } = await supabase
        .from('notification_user_state')
        .select('notification_id, read_at, dismissed_at, popup_presented_at, delivered_at, acknowledged_at')
        .or(`user_id.eq.${userId},user_key.eq.${userId}`);

      if (userStates && userStates.length > 0) {
        userStates.forEach((us: any) => {
          const existing = userStateMap.get(us.notification_id) || { isRead: false, isDismissed: false };
          userStateMap.set(us.notification_id, {
            isRead: existing.isRead || Boolean(us.read_at),
            isDismissed: existing.isDismissed || Boolean(us.dismissed_at),
            popupPresentedAt: existing.popupPresentedAt || us.popup_presented_at || null,
            deliveredAt: existing.deliveredAt || us.delivered_at || null,
            acknowledgedAt: existing.acknowledgedAt || us.acknowledged_at || null,
          });
        });
      }
    } catch (_) {}
  }

  try {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);

    if (!error && data) {
      data.forEach(item => {
        const payload = item.payload && typeof item.payload === 'object' ? item.payload : {};
        const id = item.id || payload.id || generateUUID();
        const uState = userStateMap.get(id);
        if (uState?.isDismissed) {
          notifMap.delete(id);
          return;
        }

        const notifObj: any = {
          id,
          title: payload.title || item.title || 'StudentOS Alert',
          message: payload.message || item.message || payload.content || item.content || '',
          type: item.type || payload.type || 'announcement',
          priority: item.priority || payload.priority || 'normal',
          createdAt: item.created_at ? new Date(item.created_at).toISOString() : new Date().toISOString(),
          expiresAt: item.expires_at || payload.expiresAt || null,
          archivedAt: item.archived_at || payload.archivedAt || null,
          isRead: uState ? uState.isRead : false,
          popupPresentedAt: uState?.popupPresentedAt || null,
          deliveredAt: uState?.deliveredAt || null,
          acknowledgedAt: uState?.acknowledgedAt || null,
          targetUserId: payload.targetUserId || item.target_user_id || item.user_id || 'all',
          targetClass: payload.targetClass || item.target_class || 'all',
          targetSection: payload.targetSection || item.target_section || 'all',
          targetRole: payload.targetRole || item.target_role || 'all',
          targetRoles: item.target_roles || payload.targetRoles || [],
          linkTab: payload.linkTab || 'notice_viewer'
        };

        if (isUserEligibleForNotification(notifObj, { uid: userId, grade: userClass, section: userSection, role: userRole })) {
          const prev = notifMap.get(notifObj.id);
          notifMap.set(notifObj.id, {
            ...(prev || {}),
            ...notifObj,
            isRead: Boolean(prev?.isRead || notifObj.isRead),
            popupPresentedAt: prev?.popupPresentedAt || notifObj.popupPresentedAt || null,
          });
        }
      });
    }
  } catch (err) {
    console.warn('[SUPABASE-NOTIFS] Error fetching notifications:', err);
  }

  return Array.from(notifMap.values()).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

/**
 * Get or create a persistent device identifier stored in localStorage
 */
export function getDeviceId(): string {
  if (typeof window === 'undefined') return 'device_server';
  let devId = localStorage.getItem('s_os_device_id');
  if (!devId) {
    devId = 'dev_' + Math.random().toString(36).substring(2, 10) + '_' + Date.now().toString(36);
    localStorage.setItem('s_os_device_id', devId);
  }
  return devId;
}

/**
 * Register push subscription and associate with current device & StudentOS account
 */
export async function registerPushSubscription(
  userId?: string,
  metadata?: { role?: string; grade?: string; section?: string; house?: string; interests?: string[] }
): Promise<boolean> {
  if (typeof window === 'undefined' || !('Notification' in window) || !('serviceWorker' in navigator)) {
    return false;
  }
  try {
    const { requestFCMPermission } = await import('./fcmNotifications');
    const result = await requestFCMPermission(userId, {
      role: metadata?.role,
      grade: metadata?.grade,
      section: metadata?.section,
      house: metadata?.house
    }, { silentIfDefault: true });
    return result.success;
  } catch (err) {
    console.warn('[WebPush] Subscription error:', err);
    return false;
  }
}

/**
 * Request Browser Push Notification permission
 */
export async function requestWebPushPermission(userId?: string): Promise<boolean> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return false;
  }
  try {
    const { requestFCMPermission } = await import('./fcmNotifications');
    const res = await requestFCMPermission(userId);
    return res.success;
  } catch (_) {
    return false;
  }
}

/**
 * Dispatch real browser desktop/mobile push notification via ServiceWorker or Notification API
 */
export async function triggerBrowserPushNotification(
  title: string,
  options?: NotificationOptions & { linkTab?: string; notifId?: string }
) {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  
  if (Notification.permission === 'granted') {
    const notifId = options?.notifId || (options?.data as any)?.notifId || '';
    const deterministicTag =
      options?.tag ||
      (notifId ? `studentos-notif-${notifId}` : `studentos-notif-${Date.now()}`);
    const extraData =
      options?.data && typeof options.data === 'object' ? (options.data as Record<string, any>) : {};
    const linkTab = options?.linkTab || extraData.linkTab || extraData.tab || 'notice_viewer';
    const callId = extraData.callId || '';
    const canonicalUrl = extraData.url || buildNotificationUrl(linkTab, notifId, { callId: callId || undefined });

    const notifOptions: any = {
      ...options,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      tag: deterministicTag,
      renotify: (options as any)?.renotify ?? true,
      requireInteraction: options?.requireInteraction ?? false,
      vibrate: [200, 100, 200],
      body: options?.body || '',
      data: {
        ...extraData,
        linkTab,
        tab: extraData.tab || linkTab,
        notifId,
        url: canonicalUrl,
      },
    };

    try {
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.ready;
        if (registration && registration.showNotification) {
          await registration.showNotification(title, notifOptions);
          console.log('[FCM / SW SYSTEM NOTIFICATION] Displayed in Chrome/Android notification tray:', {
            title,
            tag: deterministicTag,
            linkTab
          });
          return;
        }
      }
    } catch (swErr) {
      console.warn('[WebPush] SW notification fallback to standard Notification:', swErr);
    }

    try {
      const n = new Notification(title, notifOptions);
      n.onclick = (e) => {
        e.preventDefault();
        window.focus();
        if (typeof window !== 'undefined') {
          dispatchNotificationNavigation({
            tab: notifOptions.data?.tab || notifOptions.data?.linkTab,
            linkTab: notifOptions.data?.linkTab || notifOptions.data?.tab,
            notifId: notifOptions.data?.notifId,
            callId: notifOptions.data?.callId,
            type: notifOptions.data?.type,
            url: notifOptions.data?.url,
            source: 'local',
          });
        }
      };
    } catch (e) {
      console.warn('[WebPush] Push notification trigger warning:', e);
    }
  }
}

const recentDedupeKeys = new Map<string, number>();

/**
 * Save notification to Supabase and broadcast in realtime
 */
export async function saveAppNotification(notif: AppNotification): Promise<{ success: boolean; error?: string }> {
  // Deduplicate rapid repeated triggers sharing a dedupeKey within 15 minutes
  if (notif.dedupeKey) {
    const prevTs = recentDedupeKeys.get(notif.dedupeKey);
    if (prevTs && Date.now() - prevTs < 15 * 60 * 1000) {
      return { success: true };
    }
    recentDedupeKeys.set(notif.dedupeKey, Date.now());
  }

  console.log('[SUPABASE-NOTIFS] Saving notification:', notif.title);

  const finalId = isValidUUID(notif.id) ? notif.id : generateUUID();
  const targetUser = notif.targetUserId || 'all';
  const deterministicTag = `studentos-notif-${finalId}`;

  // Check if the current active browser user is eligible and has preferences enabled before triggering local chime/toast
  let localUserEligible = true;
  if (typeof window !== 'undefined') {
    try {
      const cachedUser = JSON.parse(localStorage.getItem('s_os_user') || '{}');
      if (cachedUser && (cachedUser.uid || cachedUser.id || cachedUser.role)) {
        localUserEligible = isUserEligibleForNotification(notif, cachedUser);
        const prefs = cachedUser?.raw_data?.notificationPreferences || {};
        if (prefs.muteAll === true) localUserEligible = false;
        if ((notif.type === 'homework' || notif.type === 'assignment') && prefs.homeworkAlerts === false) localUserEligible = false;
        if (notif.type === 'announcement' && prefs.announcements === false) localUserEligible = false;
        if (notif.type === 'attendance' && prefs.attendanceAlerts === false) localUserEligible = false;
      }
    } catch (_) {}
  }

  if (localUserEligible) {
    // Play audio chime locally
    triggerNotificationSound(notif.type);

    // Trigger Web Push Notification locally if eligible
    triggerBrowserPushNotification(notif.title, {
      body: notif.message,
      tag: deterministicTag,
      notifId: finalId,
      data: { linkTab: notif.linkTab || 'notice_viewer', notifId: finalId }
    });
  }

  // Call server push endpoint (FCM + targeted Web Push) cleanly; push errors must not fail DB save
  try {
    fetch('/api/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        notificationId: finalId,
        title: notif.title,
        body: notif.message,
        type: notif.type || 'announcement',
        linkTab: notif.linkTab || 'notice_viewer',
        tag: deterministicTag,
        targetUserId: notif.targetUserId || 'all',
        targetRole: notif.targetRole || 'all',
        targetRoles: (notif as any).targetRoles || undefined,
        targetClass: notif.targetClass || 'all',
        targetSection: notif.targetSection || 'all',
        targetSchoolId: (notif as any).targetSchoolId || undefined
      })
    })
      .then(async (r) => {
        const resJson = await r.json().catch(() => ({}));
        console.log('[FCM SERVER DISPATCH LOG]', {
          notificationId: finalId,
          targetUser,
          sentCount: resJson.sentCount ?? 0,
          totalCandidates: resJson.totalCandidates ?? 0,
          fcmSendResult: resJson.sentCount > 0 ? 'DELIVERED_TO_FCM' : 'NO_ACTIVE_DEVICE_TOKENS_MATCHED',
          deliveryLogs: resJson.deliveryLogs || []
        });
      })
      .catch((pushErr) => {
        console.warn('[FCM SERVER DISPATCH ERROR]', pushErr);
      });
  } catch (_) {}

  const title = notif.title || 'StudentOS Alert';
  const message = notif.message || '';

  const dbRow: any = {
    id: finalId,
    title: title,
    message: message,
    content: message,
    type: notif.type || 'announcement',
    user_id: (targetUser !== 'all' && isValidUUID(targetUser)) ? targetUser : null,
    target_user_id: targetUser,
    target_class: notif.targetClass || 'all',
    target_section: notif.targetSection || 'all',
    is_read: notif.isRead || false,
    created_at: notif.createdAt ? new Date(notif.createdAt).toISOString() : new Date().toISOString(),
    payload: {
      id: finalId,
      title: title,
      message: message,
      type: notif.type,
      createdAt: notif.createdAt || new Date().toISOString(),
      isRead: notif.isRead || false,
      targetUserId: targetUser,
      targetRole: notif.targetRole || 'all',
      targetClass: notif.targetClass || null,
      targetSection: notif.targetSection || 'all',
      linkTab: notif.linkTab || 'notice_viewer',
      dedupeKey: notif.dedupeKey || null
    }
  };

  let saveSuccess = true;
  let saveErrorMessage: string | undefined;

  try {
    const { error } = await supabase.from('notifications').upsert(dbRow);
    if (error) {
      if (error.code === '23503' || error.message?.includes('foreign key') || error.message?.includes('notifications_user_id_fkey')) {
        console.warn('[SUPABASE-NOTIFS] Target user_id does not exist in auth.users; retrying with user_id = null');
        const fallbackRow = { ...dbRow, user_id: null };
        const { error: err2 } = await supabase.from('notifications').upsert(fallbackRow);
        if (err2) {
          console.warn('[SUPABASE-NOTIFS] Fallback notification insert skipped:', err2.message);
        } else {
          saveSuccess = true;
        }
      } else {
        console.error('[SUPABASE-NOTIFS] Error upserting notification:', error.message);
        saveSuccess = false;
        saveErrorMessage = error.message;
      }
    } else {
      console.log('[SUPABASE-NOTIFS] Successfully saved notification to Supabase:', finalId);
    }
  } catch (err: any) {
    console.warn('[SUPABASE-NOTIFS] Exception saving notification:', err);
    saveSuccess = false;
    saveErrorMessage = err?.message || 'Database error';
  }

  // Broadcast Realtime Event to all connected clients
  try {
    const channel = supabase.channel('student-os-public');
    await channel.send({
      type: 'broadcast',
      event: 'new_app_notification',
      payload: { ...notif, id: finalId }
    });
  } catch (_) {}

  // Trigger local window realtime event
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('studentos-db-update', {
      detail: { table: 'notifications', action: 'INSERT', record: { ...notif, id: finalId }, timestamp: Date.now() }
    }));
  }

  return { success: saveSuccess, error: saveErrorMessage };
}

async function syncServerNotificationState(
  userId: string | undefined,
  notificationIds: string[],
  action: 'delivered' | 'popup_presented' | 'read' | 'dismissed' | 'acknowledged'
): Promise<void> {
  if (!userId || notificationIds.length === 0 || typeof window === 'undefined') return;
  try {
    await fetch('/api/notifications/state', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, notificationIds, action }),
    });
  } catch (_) {}
}

export async function markNotificationPopupPresented(notifIds: string[], userId?: string): Promise<void> {
  if (!userId && typeof window !== 'undefined') {
    try {
      const u = JSON.parse(localStorage.getItem('s_os_user') || '{}');
      userId = u.uid || u.id;
    } catch (_) {}
  }
  if (!userId || notifIds.length === 0) return;
  const now = new Date().toISOString();
  try {
    const cacheKey = `s_os_notif_states_${userId}`;
    const local = JSON.parse(localStorage.getItem(cacheKey) || '{}');
    for (const nid of notifIds) {
      local[nid] = { ...local[nid], popupPresentedAt: local[nid]?.popupPresentedAt || now, deliveredAt: local[nid]?.deliveredAt || now };
    }
    localStorage.setItem(cacheKey, JSON.stringify(local));
  } catch (_) {}
  await syncServerNotificationState(userId, notifIds, 'popup_presented');
}

/**
 * Mark notification as read per-user without modifying authoritative global notification row
 */
export async function markNotificationAsRead(notifId: string, userId?: string): Promise<void> {
  if (!userId && typeof window !== 'undefined') {
    try {
      const u = JSON.parse(localStorage.getItem('s_os_user') || '{}');
      userId = u.uid || u.id;
    } catch (_) {}
  }

  const now = new Date().toISOString();

  if (userId) {
    try {
      const cacheKey = `s_os_notif_states_${userId}`;
      const local = JSON.parse(localStorage.getItem(cacheKey) || '{}');
      local[notifId] = { ...local[notifId], isRead: true, readAt: now, popupPresentedAt: local[notifId]?.popupPresentedAt || now };
      localStorage.setItem(cacheKey, JSON.stringify(local));
    } catch (_) {}
  }

  await syncServerNotificationState(userId, [notifId], 'read');

  if (userId && isValidUUID(userId) && isValidUUID(notifId)) {
    try {
      await supabase.from('notification_user_state').upsert({
        notification_id: notifId,
        user_id: userId,
        user_key: userId,
        read_at: now,
        updated_at: now
      }, { onConflict: 'notification_id,user_id' });
    } catch (_) {}
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('studentos-notif-state-change', { detail: { notifId, action: 'read', userId } }));
  }
}

/**
 * Mark all notifications as read for current user
 */
export async function markAllNotificationsAsRead(notificationsList?: AppNotification[], userId?: string): Promise<void> {
  if (!userId && typeof window !== 'undefined') {
    try {
      const u = JSON.parse(localStorage.getItem('s_os_user') || '{}');
      userId = u.uid || u.id;
    } catch (_) {}
  }

  const now = new Date().toISOString();
  const ids = (notificationsList || []).map(n => n.id).filter(Boolean);

  if (userId) {
    try {
      const cacheKey = `s_os_notif_states_${userId}`;
      const local = JSON.parse(localStorage.getItem(cacheKey) || '{}');
      ids.forEach(nid => {
        local[nid] = { ...local[nid], isRead: true, readAt: now, popupPresentedAt: local[nid]?.popupPresentedAt || now };
      });
      localStorage.setItem(cacheKey, JSON.stringify(local));
    } catch (_) {}
  }

  await syncServerNotificationState(userId, ids, 'read');

  if (userId && notificationsList && notificationsList.length > 0) {
    const upserts = notificationsList
      .filter(n => isValidUUID(n.id) && isValidUUID(userId!))
      .map(n => ({
        notification_id: n.id,
        user_id: userId,
        user_key: userId,
        read_at: now,
        updated_at: now
      }));

    if (upserts.length > 0) {
      try {
        await supabase.from('notification_user_state').upsert(upserts, { onConflict: 'notification_id,user_id' });
      } catch (_) {}
    }
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('studentos-notif-state-change', { detail: { action: 'read_all', userId } }));
  }
}

/**
 * Dismiss/delete notification from user's own box without deleting authoritative notification row
 */
export async function dismissNotification(notifId: string, userId?: string): Promise<void> {
  if (!userId && typeof window !== 'undefined') {
    try {
      const u = JSON.parse(localStorage.getItem('s_os_user') || '{}');
      userId = u.uid || u.id;
    } catch (_) {}
  }

  const now = new Date().toISOString();

  if (userId) {
    try {
      const cacheKey = `s_os_notif_states_${userId}`;
      const local = JSON.parse(localStorage.getItem(cacheKey) || '{}');
      local[notifId] = { ...local[notifId], isRead: true, isDismissed: true, dismissedAt: now, popupPresentedAt: local[notifId]?.popupPresentedAt || now };
      localStorage.setItem(cacheKey, JSON.stringify(local));
    } catch (_) {}
  }

  await syncServerNotificationState(userId, [notifId], 'dismissed');

  if (userId && isValidUUID(userId) && isValidUUID(notifId)) {
    try {
      await supabase.from('notification_user_state').upsert({
        notification_id: notifId,
        user_id: userId,
        user_key: userId,
        dismissed_at: now,
        read_at: now,
        updated_at: now
      }, { onConflict: 'notification_id,user_id' });
    } catch (_) {}
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('studentos-notif-state-change', { detail: { notifId, action: 'dismiss', userId } }));
  }
}

/**
 * Delete a notification (Per-user dismissal)
 */
export async function deleteNotification(notifId: string, userId?: string): Promise<void> {
  await dismissNotification(notifId, userId);
}

/**
 * Trigger sound based on notification type using official Pixabay sound effects
 */
export function triggerNotificationSound(type: string) {
  if (type === 'announcement' || type === 'grade' || type === 'attendance' || type === 'system') {
    soundService.playNewNotification();
  } else if (type === 'mention') {
    soundService.playMentionSound();
  } else if (type === 'homework' || type === 'assignment') {
    soundService.playNewNotification();
  } else {
    soundService.playNewNotification();
  }
}

