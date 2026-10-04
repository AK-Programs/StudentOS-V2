import { supabase } from './supabase';
import { AppNotification } from '../types';
import { soundService } from './soundService';

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
export function isUserEligibleForNotification(
  notif: AppNotification | any,
  user?: { uid?: string; id?: string; grade?: string; classGrade?: string; section?: string; role?: string }
): boolean {
  if (!user) return true;
  const userId = user.uid || user.id;
  const userGrade = user.grade || user.classGrade || '';
  const userSection = user.section || '';
  const userRole = (user.role || 'student').toLowerCase();

  const targetUser = notif.targetUserId || notif.target_user_id || notif.user_id || 'all';
  const targetRole = notif.targetRole || notif.target_role || 'all';
  const targetClass = notif.targetClass || notif.target_class || 'all';
  const targetSection = notif.targetSection || notif.target_section || 'all';

  // 1. User ID matching
  if (targetUser !== 'all' && targetUser !== null && userId && targetUser !== userId) {
    return false;
  }

  // 2. Role matching
  if (targetRole && targetRole !== 'all' && targetRole.toLowerCase() !== userRole) {
    return false;
  }

  // 3. Class/Grade matching
  if (targetClass && targetClass !== 'all' && userGrade) {
    const normTargetC = targetClass.toString().toLowerCase().replace(/class|grade|\s+/g, '');
    const normUserC = userGrade.toString().toLowerCase().replace(/class|grade|\s+/g, '');
    if (!normUserC.includes(normTargetC) && !normTargetC.includes(normUserC)) {
      return false;
    }
  }

  // 4. Section matching
  if (targetSection && targetSection !== 'all' && targetSection !== 'All Sections' && userSection) {
    const normTargetS = targetSection.toString().toLowerCase().trim();
    const normUserS = userSection.toString().toLowerCase().trim();
    if (normUserS !== normTargetS && !normUserS.includes(normTargetS)) {
      return false;
    }
  }

  return true;
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
): Promise<AppNotification[]> {
  console.log('[SUPABASE-NOTIFS] Fetching notifications from Supabase...');
  const notifMap = new Map<string, AppNotification>();

  // 1. Build map of user-specific read/dismiss states
  const userStateMap = new Map<string, { isRead: boolean; isDismissed: boolean }>();

  // Local storage cache for zero-latency UI update
  if (typeof window !== 'undefined' && userId) {
    try {
      const local = JSON.parse(localStorage.getItem(`s_os_notif_states_${userId}`) || '{}');
      Object.keys(local).forEach(id => {
        userStateMap.set(id, {
          isRead: Boolean(local[id].isRead),
          isDismissed: Boolean(local[id].isDismissed)
        });
      });
    } catch (_) {}
  }

  // Fetch per-user notification state from Supabase notification_user_state
  if (userId) {
    try {
      const { data: userStates } = await supabase
        .from('notification_user_state')
        .select('notification_id, read_at, dismissed_at')
        .eq('user_id', userId);

      if (userStates && userStates.length > 0) {
        userStates.forEach(us => {
          const existing = userStateMap.get(us.notification_id) || { isRead: false, isDismissed: false };
          userStateMap.set(us.notification_id, {
            isRead: existing.isRead || Boolean(us.read_at),
            isDismissed: existing.isDismissed || Boolean(us.dismissed_at)
          });
        });
      }
    } catch (e) {
      console.warn('[SUPABASE-NOTIFS] Notice fetching user notification states:', e);
    }
  }

  try {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data) {
      data.forEach(item => {
        const payload = item.payload && typeof item.payload === 'object' ? item.payload : {};
        const id = item.id || payload.id || generateUUID();
        const uState = userStateMap.get(id);

        // If user has dismissed this notification from their own box, skip it
        if (uState?.isDismissed) {
          return;
        }

        const notifObj: AppNotification = {
          id,
          title: payload.title || item.title || 'StudentOS Alert',
          message: payload.message || item.message || payload.content || item.content || '',
          type: item.type || payload.type || 'announcement',
          createdAt: item.created_at ? new Date(item.created_at).toISOString() : new Date().toISOString(),
          isRead: uState ? uState.isRead : false,
          targetUserId: payload.targetUserId || item.target_user_id || item.user_id || 'all',
          targetClass: payload.targetClass || item.target_class || 'all',
          targetSection: payload.targetSection || item.target_section || 'all',
          targetRole: payload.targetRole || item.target_role || 'all',
          linkTab: payload.linkTab || 'notice_viewer'
        };

        if (isUserEligibleForNotification(notifObj, { uid: userId, grade: userClass, section: userSection, role: userRole })) {
          notifMap.set(notifObj.id, notifObj);
        }
      });
    } else if (error) {
      console.warn('[SUPABASE-NOTIFS] Warning fetching notifications:', error.message);
    }
  } catch (err) {
    console.warn('[SUPABASE-NOTIFS] Error fetching notifications:', err);
  }

  // Return fetched notifications sorted by created_at
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
export async function registerPushSubscription(userId?: string): Promise<boolean> {
  if (typeof window === 'undefined' || !('Notification' in window) || !('serviceWorker' in navigator)) {
    return false;
  }
  try {
    const deviceId = getDeviceId();
    let registration = await navigator.serviceWorker.getRegistration('/sw.js');
    if (!registration) {
      registration = await navigator.serviceWorker.register('/sw.js');
    }
    await navigator.serviceWorker.ready;

    let applicationServerKey: Uint8Array | undefined;
    try {
      const vRes = await fetch('/api/push/vapid-public-key');
      if (vRes.ok) {
        const vData = await vRes.json();
        if (vData.publicKey) {
          applicationServerKey = urlBase64ToUint8Array(vData.publicKey);
        }
      }
    } catch (_) {}

    let subscription = await registration.pushManager.getSubscription();
    if (!subscription && applicationServerKey) {
      try {
        const subOptions: PushSubscriptionOptionsInit = {
          userVisibleOnly: true,
          applicationServerKey
        };
        subscription = await registration.pushManager.subscribe(subOptions);
      } catch (subErr) {
        console.warn('[WebPush] PushManager subscribe notice:', subErr);
      }
    }

    if (subscription) {
      const subJson = subscription.toJSON();
      const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : 'Unknown';

      // 1. Register with backend memory store for device-level targeting
      try {
        await fetch('/api/push/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            subscription: subJson,
            userId: userId || null,
            deviceId,
            userAgent
          })
        });
      } catch (_) {}

      // 2. Upsert subscription and device-user association to Supabase push_subscriptions table
      try {
        await supabase.from('push_subscriptions').upsert({
          device_id: deviceId,
          user_id: userId || null,
          endpoint: subJson.endpoint,
          keys: subJson.keys,
          p256dh: subJson.keys?.p256dh,
          auth: subJson.keys?.auth,
          user_agent: userAgent,
          updated_at: new Date().toISOString()
        }, { onConflict: 'endpoint' });
      } catch (dbErr) {
        console.warn('[WebPush] Saving subscription to database notice:', dbErr);
      }
    }
    return true;
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
  if (Notification.permission === 'granted') {
    await registerPushSubscription(userId);
    return true;
  }
  if (Notification.permission !== 'denied') {
    try {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        await registerPushSubscription(userId);
        return true;
      }
      return false;
    } catch (_) {
      return false;
    }
  }
  return false;
}

/**
 * Dispatch real browser desktop/mobile push notification via ServiceWorker or Notification API
 */
export async function triggerBrowserPushNotification(title: string, options?: NotificationOptions & { linkTab?: string }) {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  
  if (Notification.permission === 'granted') {
    const notifOptions = {
      icon: '/icon.svg',
      badge: '/icon.svg',
      tag: options?.tag || `studentos-alert-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      renotify: true,
      body: options?.body || '',
      data: {
        linkTab: options?.linkTab || options?.data?.linkTab || 'notice_viewer'
      },
      ...options
    };

    try {
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.ready;
        if (registration && registration.showNotification) {
          await registration.showNotification(title, notifOptions);
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
        if (notifOptions.data?.linkTab && typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('studentos-navigate-tab', { detail: { tab: notifOptions.data.linkTab } }));
        }
      };
    } catch (e) {
      console.warn('[WebPush] Push notification trigger warning:', e);
    }
  }
}

/**
 * Save notification to Supabase and broadcast in realtime
 */
export async function saveAppNotification(notif: AppNotification): Promise<{ success: boolean; error?: string }> {
  console.log('[SUPABASE-NOTIFS] Saving notification:', notif.title);

  // Play audio chime locally
  triggerNotificationSound(notif.type);

  // Trigger Web Push Notification
  triggerBrowserPushNotification(notif.title, {
    body: notif.message,
    data: { linkTab: notif.linkTab || 'notice_viewer' }
  });

  // Call server push endpoint
  try {
    fetch('/api/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: notif.title,
        body: notif.message,
        linkTab: notif.linkTab || 'notice_viewer',
        targetUserId: notif.targetUserId || 'all'
      })
    }).catch(() => {});
  } catch (_) {}

  const finalId = isValidUUID(notif.id) ? notif.id : generateUUID();
  const targetUser = notif.targetUserId || 'all';

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
      targetClass: notif.targetClass || null,
      linkTab: notif.linkTab || 'notice_viewer'
    }
  };

  let saveSuccess = true;
  let saveErrorMessage: string | undefined;

  try {
    const { error } = await supabase.from('notifications').upsert(dbRow);
    if (error) {
      console.error('[SUPABASE-NOTIFS] Error upserting notification:', error.message);
      saveSuccess = false;
      saveErrorMessage = error.message;
    } else {
      console.log('[SUPABASE-NOTIFS] Successfully saved notification to Supabase:', finalId);
    }
  } catch (err: any) {
    console.error('[SUPABASE-NOTIFS] Exception saving notification:', err);
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

  // 1. Update local cache
  if (userId) {
    try {
      const cacheKey = `s_os_notif_states_${userId}`;
      const local = JSON.parse(localStorage.getItem(cacheKey) || '{}');
      local[notifId] = { ...local[notifId], isRead: true, readAt: now };
      localStorage.setItem(cacheKey, JSON.stringify(local));
    } catch (_) {}
  }

  // 2. Persist to Supabase notification_user_state table
  if (userId && isValidUUID(userId) && isValidUUID(notifId)) {
    try {
      await supabase.from('notification_user_state').upsert({
        notification_id: notifId,
        user_id: userId,
        read_at: now,
        updated_at: now
      }, { onConflict: 'notification_id,user_id' });
    } catch (err) {
      console.warn('[SUPABASE-NOTIFS] Error marking read in notification_user_state:', err);
    }
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

  if (userId) {
    try {
      const cacheKey = `s_os_notif_states_${userId}`;
      const local = JSON.parse(localStorage.getItem(cacheKey) || '{}');
      if (notificationsList && notificationsList.length > 0) {
        notificationsList.forEach(n => {
          local[n.id] = { ...local[n.id], isRead: true, readAt: now };
        });
      }
      localStorage.setItem(cacheKey, JSON.stringify(local));
    } catch (_) {}
  }

  if (userId && notificationsList && notificationsList.length > 0) {
    const upserts = notificationsList
      .filter(n => isValidUUID(n.id) && isValidUUID(userId!))
      .map(n => ({
        notification_id: n.id,
        user_id: userId,
        read_at: now,
        updated_at: now
      }));

    if (upserts.length > 0) {
      try {
        await supabase.from('notification_user_state').upsert(upserts, { onConflict: 'notification_id,user_id' });
      } catch (err) {
        console.warn('[SUPABASE-NOTIFS] Error marking all read in database:', err);
      }
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

  // 1. Update local cache
  if (userId) {
    try {
      const cacheKey = `s_os_notif_states_${userId}`;
      const local = JSON.parse(localStorage.getItem(cacheKey) || '{}');
      local[notifId] = { ...local[notifId], isDismissed: true, dismissedAt: now };
      localStorage.setItem(cacheKey, JSON.stringify(local));
    } catch (_) {}
  }

  // 2. Persist to Supabase notification_user_state table
  if (userId && isValidUUID(userId) && isValidUUID(notifId)) {
    try {
      await supabase.from('notification_user_state').upsert({
        notification_id: notifId,
        user_id: userId,
        dismissed_at: now,
        updated_at: now
      }, { onConflict: 'notification_id,user_id' });
    } catch (err) {
      console.warn('[SUPABASE-NOTIFS] Error saving dismiss state to notification_user_state:', err);
    }
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
 * Trigger sound based on notification type
 */
export function triggerNotificationSound(type: string) {
  if (type === 'announcement') {
    soundService.playAnnouncementSound();
  } else if (type === 'mention') {
    soundService.playMentionSound();
  } else if (type === 'homework' || type === 'assignment') {
    soundService.playHomeworkSound();
  } else {
    soundService.playMessageSound();
  }
}

