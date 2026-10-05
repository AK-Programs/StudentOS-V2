/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Firebase Cloud Messaging (FCM) & Web Push Engine for StudentOS
 * Provides reliable foreground & background push delivery for Android Chrome, PWA Standalone, & Desktop.
 */

import { initializeApp, getApps, getApp } from 'firebase/app';
import { getMessaging, getToken, onMessage, isSupported, deleteToken, Messaging } from 'firebase/messaging';
import { supabase } from './supabase';
import { soundService } from './soundService';

// Default public Firebase config (safe for client, matches firebase-applet-config.json)
const defaultFirebaseConfig = {
  projectId: "gen-lang-client-0785563242",
  appId: "1:940502459076:web:843c78167b4b83a1c25f91",
  apiKey: "AIzaSyCtFjAhG_Y3G28t2iDV_0GzNvFRNUj9nFA",
  authDomain: "gen-lang-client-0785563242.firebaseapp.com",
  storageBucket: "gen-lang-client-0785563242.firebasestorage.app",
  messagingSenderId: "940502459076"
};

// Canonical matched VAPID Public Key for Web Push / FCM (client-safe, matches server.ts)
export const DEFAULT_VAPID_KEY = 'BLdXVgRSMH1XO-DH4Y8hJ5qzd-BlUw6rVC7BmoBvrTp5sbNcrO05MdgeVSSaI7MPZVl_PLJd8nbNy989mkA3Wfs';

let messagingInstance: Messaging | null = null;
let messagingSupported: boolean | null = null;

function isValidUUID(str?: string | null): boolean {
  if (!str) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
}

/**
 * Utility to convert base64 VAPID public key to Uint8Array for PushManager
 */
export function urlBase64ToUint8Array(base64String: string): Uint8Array {
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
 * Compare existing PushSubscription applicationServerKey with target VAPID key bytes
 */
function doesSubscriptionKeyMatch(sub: PushSubscription, expectedKeyBytes: Uint8Array): boolean {
  try {
    const existingBuf = sub.options?.applicationServerKey;
    if (!existingBuf) return false;
    const existingBytes = new Uint8Array(existingBuf);
    if (existingBytes.length !== expectedKeyBytes.length) return false;
    for (let i = 0; i < existingBytes.length; i++) {
      if (existingBytes[i] !== expectedKeyBytes[i]) return false;
    }
    return true;
  } catch (_) {
    return false;
  }
}

/**
 * Helper to get or create persistent device ID
 */
export function getFCMDeviceId(): string {
  if (typeof window === 'undefined') return 'device_server';
  let devId = localStorage.getItem('s_os_device_id');
  if (!devId) {
    devId = 'fcm_dev_' + Math.random().toString(36).substring(2, 10) + '_' + Date.now().toString(36);
    localStorage.setItem('s_os_device_id', devId);
  }
  return devId;
}

/**
 * Get device platform label for token database
 */
export function getDevicePlatformLabel(): string {
  if (typeof window === 'undefined') return 'Web/Browser';
  const ua = navigator.userAgent || '';
  const isPWA = window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone === true;
  
  let os = 'Desktop Web';
  if (/Android/i.test(ua)) os = 'Android Chrome';
  else if (/iPhone|iPad|iPod/i.test(ua)) os = 'iOS Safari';
  else if (/Macintosh|Mac OS X/i.test(ua)) os = 'macOS Chrome/Safari';
  else if (/Windows/i.test(ua)) os = 'Windows Chrome/Edge';
  else if (/Linux/i.test(ua)) os = 'Linux Chrome/Firefox';

  return isPWA ? `${os} (PWA Standalone)` : `${os} (Browser)`;
}

/**
 * Initialize Firebase Messaging client instance safely
 */
export async function getFCMClient(): Promise<Messaging | null> {
  if (typeof window === 'undefined') return null;
  if (messagingInstance) return messagingInstance;

  try {
    if (messagingSupported === null) {
      messagingSupported = await isSupported();
    }
    if (!messagingSupported) {
      console.warn('[FCM] Firebase Messaging is not supported in this browser environment.');
      return null;
    }

    const firebaseConfig = {
      apiKey: (import.meta as any).env?.VITE_FIREBASE_API_KEY || defaultFirebaseConfig.apiKey,
      authDomain: (import.meta as any).env?.VITE_FIREBASE_AUTH_DOMAIN || defaultFirebaseConfig.authDomain,
      projectId: (import.meta as any).env?.VITE_FIREBASE_PROJECT_ID || defaultFirebaseConfig.projectId,
      storageBucket: (import.meta as any).env?.VITE_FIREBASE_STORAGE_BUCKET || defaultFirebaseConfig.storageBucket,
      messagingSenderId: (import.meta as any).env?.VITE_FIREBASE_MESSAGING_SENDER_ID || defaultFirebaseConfig.messagingSenderId,
      appId: (import.meta as any).env?.VITE_FIREBASE_APP_ID || defaultFirebaseConfig.appId
    };

    const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
    messagingInstance = getMessaging(app);
    console.log('[FCM STAGE 1/4] FCM initialized');
    return messagingInstance;
  } catch (err: any) {
    console.warn('[FCM] Initialization notice:', err?.message || err);
    return null;
  }
}

/**
 * Request FCM & Web Push Notification permission and register active device token & subscription
 */
export async function requestFCMPermission(
  userId?: string,
  metadata?: { role?: string; grade?: string; section?: string; house?: string; schoolId?: string },
  options?: { silentIfDefault?: boolean }
): Promise<{ success: boolean; token?: string; error?: string }> {
  if (typeof window === 'undefined' || !('Notification' in window) || !('serviceWorker' in navigator)) {
    return { success: false, error: 'Push notifications are not supported in this browser.' };
  }

  try {
    // 1. Check / request notification permission
    let permission = Notification.permission;
    if (permission === 'default') {
      if (options?.silentIfDefault) {
        return { success: false, error: 'Notification permission not yet requested.' };
      }
      permission = await Notification.requestPermission();
    }

    if (permission !== 'granted') {
      console.warn('[FCM] Push Notification permission is:', permission);
      return {
        success: false,
        error: permission === 'denied'
          ? 'Notification permission is blocked in Chrome/Android settings. Tap the lock icon in your address bar -> Permissions -> Notifications -> Allow.'
          : 'Notification permission was not granted.'
      };
    }

    // 2. Register or retrieve single unified Service Worker (/sw.js)
    const allRegs = await navigator.serviceWorker.getRegistrations();
    // Clean up any legacy conflicting service workers not rooted at /sw.js
    for (const reg of allRegs) {
      const scriptURL = reg.active?.scriptURL || reg.installing?.scriptURL || reg.waiting?.scriptURL || '';
      if (scriptURL && !scriptURL.endsWith('/sw.js')) {
        try {
          await reg.unregister();
          console.log('[FCM SW] Unregistered legacy conflicting service worker:', scriptURL);
        } catch (_) {}
      }
    }

    let swRegistration = await navigator.serviceWorker.getRegistration('/');
    if (!swRegistration) {
      swRegistration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    }
    const readyRegistration = await navigator.serviceWorker.ready;
    swRegistration = readyRegistration || swRegistration;

    // 3. Fetch authoritative public VAPID key from backend or canonical default
    let vapidKey = DEFAULT_VAPID_KEY;
    try {
      const vRes = await fetch('/api/push/fcm-config');
      if (vRes.ok) {
        const vData = await vRes.json();
        if (vData.vapidPublicKey) {
          vapidKey = vData.vapidPublicKey;
        }
      }
    } catch (_) {}

    const expectedServerKeyBytes = urlBase64ToUint8Array(vapidKey);

    // 4. Retrieve or create Web Push subscription on the Service Worker's pushManager
    // IMPORTANT: Do NOT call Firebase getToken() with a custom web-push VAPID key after subscribing,
    // because Chrome's PushManager already creates an FCM endpoint (https://fcm.googleapis.com/fcm/send/...)
    // bound to expectedServerKeyBytes. If an existing subscription uses an old/mismatched VAPID key,
    // we unsubscribe and re-subscribe with expectedServerKeyBytes so server webpush signing never gets 403!
    let pushSubscription: PushSubscription | null = null;
    if (swRegistration?.pushManager) {
      try {
        pushSubscription = await swRegistration.pushManager.getSubscription();
        if (pushSubscription && !doesSubscriptionKeyMatch(pushSubscription, expectedServerKeyBytes)) {
          console.log('[FCM] Existing PushSubscription had a stale VAPID key; refreshing subscription...');
          try {
            await pushSubscription.unsubscribe();
          } catch (_) {}
          pushSubscription = null;
        }

        if (!pushSubscription) {
          pushSubscription = await swRegistration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: expectedServerKeyBytes
          });
        }
      } catch (subErr: any) {
        console.warn('[FCM] pushManager subscribe notice, retrying after unsubscribe:', subErr?.message || subErr);
        try {
          const oldSub = await swRegistration.pushManager.getSubscription();
          if (oldSub) await oldSub.unsubscribe();
          pushSubscription = await swRegistration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: expectedServerKeyBytes
          });
        } catch (retryErr: any) {
          console.warn('[FCM] pushManager retry failed:', retryErr?.message || retryErr);
        }
      }
    }

    // Extract FCM token from FCM PushSubscription endpoint (https://fcm.googleapis.com/fcm/send/<token>)
    let fcmToken: string | null = null;
    if (pushSubscription?.endpoint) {
      const endpointParts = pushSubscription.endpoint.split('/');
      fcmToken = endpointParts[endpointParts.length - 1] || pushSubscription.endpoint;
      console.log('[FCM STAGE 2/4] FCM token generated via Chrome PushManager FCM endpoint');
    } else {
      // Fallback to Firebase Messaging SDK getToken if PushManager didn't return an endpoint
      const messaging = await getFCMClient();
      if (messaging && swRegistration) {
        try {
          fcmToken = await getToken(messaging, {
            vapidKey,
            serviceWorkerRegistration: swRegistration
          });
          if (fcmToken) {
            console.log('[FCM STAGE 2/4] FCM token generated via Firebase SDK');
          }
          pushSubscription = await swRegistration.pushManager.getSubscription();
        } catch (tokenErr: any) {
          console.warn('[FCM] getToken fallback notice:', tokenErr?.message || tokenErr);
        }
      }
    }

    const primaryEndpoint = pushSubscription?.endpoint || fcmToken;
    if (!primaryEndpoint) {
      return { success: false, error: 'Could not generate push registration token for this device.' };
    }

    // Serialize subscription details (keys + endpoint) for backend WebPush / FCM dispatching
    let subscriptionJson: any = null;
    if (pushSubscription) {
      const rawJson = pushSubscription.toJSON();
      const p256dh = rawJson.keys?.p256dh || (
        pushSubscription.getKey
          ? btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(pushSubscription.getKey('p256dh') || new ArrayBuffer(0)))))
          : ''
      );
      const auth = rawJson.keys?.auth || (
        pushSubscription.getKey
          ? btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(pushSubscription.getKey('auth') || new ArrayBuffer(0)))))
          : ''
      );
      subscriptionJson = {
        endpoint: pushSubscription.endpoint,
        keys: { p256dh, auth }
      };
    }

    // 5. Resolve user metadata if not explicitly passed
    let effectiveUserId = userId || null;
    let effectiveMeta = metadata || {};
    if (typeof window !== 'undefined') {
      try {
        const cachedUser = JSON.parse(localStorage.getItem('s_os_user') || '{}');
        if (!effectiveUserId) effectiveUserId = cachedUser.uid || cachedUser.id || cachedUser.email || null;
        effectiveMeta = {
          role: effectiveMeta.role || cachedUser.role || 'student',
          grade: effectiveMeta.grade || cachedUser.grade || '',
          section: effectiveMeta.section || cachedUser.section || '',
          house: effectiveMeta.house || cachedUser.house || '',
          schoolId: effectiveMeta.schoolId || cachedUser.schoolId || 'default_school'
        };
      } catch (_) {}
    }

    // 6. Persist token to localStorage
    const deviceId = getFCMDeviceId();
    const deviceLabel = getDevicePlatformLabel();
    localStorage.setItem('s_os_fcm_token', fcmToken || primaryEndpoint);
    localStorage.setItem('s_os_push_enabled', 'true');
    if (subscriptionJson) {
      localStorage.setItem('s_os_push_sub', JSON.stringify(subscriptionJson));
    }
    if (effectiveUserId) {
      localStorage.setItem('s_os_fcm_user_id', effectiveUserId);
    }

    // 7. Persist directly to Supabase push_subscriptions table using exact verified schema
    // Columns in public.push_subscriptions: id, user_id (UUID nullable), endpoint (TEXT UNIQUE), keys (JSONB NOT NULL), p256dh, auth, created_at, updated_at
    if (subscriptionJson?.endpoint && subscriptionJson?.keys?.p256dh && subscriptionJson?.keys?.auth) {
      try {
        const now = new Date().toISOString();
        const richKeys = {
          p256dh: subscriptionJson.keys.p256dh,
          auth: subscriptionJson.keys.auth,
          userId: effectiveUserId,
          deviceId,
          deviceLabel,
          role: effectiveMeta.role || 'student',
          grade: effectiveMeta.grade || '',
          section: effectiveMeta.section || '',
          house: effectiveMeta.house || '',
          schoolId: effectiveMeta.schoolId || 'default_school',
          fcmToken: fcmToken || primaryEndpoint,
          isActive: true,
          updatedAt: now
        };

        const { error: sbErr } = await supabase.from('push_subscriptions').upsert({
          user_id: isValidUUID(effectiveUserId) ? effectiveUserId : null,
          endpoint: subscriptionJson.endpoint,
          keys: richKeys,
          p256dh: subscriptionJson.keys.p256dh,
          auth: subscriptionJson.keys.auth,
          updated_at: now
        }, { onConflict: 'endpoint' });

        if (sbErr) {
          console.warn('[FCM] Supabase push_subscriptions upsert warning:', sbErr.message);
        } else {
          console.log(`[FCM STAGE 3/4] FCM token & WebPush subscription stored in Supabase (userId: ${effectiveUserId || 'anon'}, active: yes)`);
        }
      } catch (sbEx) {
        console.warn('[FCM] Supabase token persistence exception:', sbEx);
      }
    }

    // 8. Register token & subscription with backend server
    try {
      await fetch('/api/push/fcm-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: primaryEndpoint,
          fcmToken: fcmToken || primaryEndpoint,
          subscription: subscriptionJson,
          userId: effectiveUserId,
          deviceId,
          deviceLabel,
          role: effectiveMeta.role || 'student',
          grade: effectiveMeta.grade || '',
          section: effectiveMeta.section || '',
          house: effectiveMeta.house || '',
          schoolId: effectiveMeta.schoolId || 'default_school'
        })
      });
    } catch (apiErr) {
      console.warn('[FCM] Backend token registration notice:', apiErr);
    }

    return { success: true, token: fcmToken || primaryEndpoint };
  } catch (err: any) {
    console.error('[FCM] Error requesting FCM permission:', err);
    return { success: false, error: err?.message || 'Failed to enable push notifications.' };
  }
}

/**
 * Disable FCM Push notifications on current device
 */
export async function disableFCMPush(userId?: string): Promise<boolean> {
  try {
    const token = localStorage.getItem('s_os_fcm_token');
    const savedSubRaw = localStorage.getItem('s_os_push_sub');
    const savedSub = savedSubRaw ? JSON.parse(savedSubRaw) : null;
    const endpoint = savedSub?.endpoint || token;
    const deviceId = getFCMDeviceId();

    // 1. Delete token from Firebase Messaging SDK if initialized
    if (messagingInstance) {
      try {
        await deleteToken(messagingInstance);
      } catch (_) {}
    }

    // 2. Unregister push subscription from ServiceWorker pushManager
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      try {
        const reg = await navigator.serviceWorker.getRegistration('/');
        const sub = await reg?.pushManager?.getSubscription();
        if (sub) {
          await sub.unsubscribe();
        }
      } catch (_) {}
    }

    // 3. Notify backend server
    if (endpoint) {
      try {
        await fetch('/api/push/fcm-token/delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: endpoint, userId, deviceId })
        });
      } catch (_) {}
    }

    // 4. Delete from Supabase push_subscriptions table
    if (endpoint) {
      try {
        await supabase
          .from('push_subscriptions')
          .delete()
          .eq('endpoint', endpoint);
      } catch (_) {}
    }

    localStorage.removeItem('s_os_fcm_token');
    localStorage.removeItem('s_os_push_sub');
    localStorage.setItem('s_os_push_enabled', 'false');
    console.log('[FCM] Push notifications disabled on this device.');
    return true;
  } catch (err) {
    console.error('[FCM] Error disabling push notifications:', err);
    return false;
  }
}

/**
 * Setup Foreground FCM Message listener + ServiceWorker notification bridge
 */
export async function setupFCMForegroundListener(
  onNotificationReceived?: (payload: { title: string; body: string; data?: any }) => void
): Promise<(() => void) | null> {
  if (typeof window === 'undefined') return null;

  // Listen for Service Worker postMessage events (e.g. when SW displays a push notification or user clicks it)
  const swMessageHandler = (event: MessageEvent) => {
    const data = event.data;
    if (!data) return;
    if (data.type === 'FCM_SW_NOTIFICATION_DISPLAYED') {
      console.log('[FCM STAGE 4/4] Service Worker received push & displayed system notification:', {
        title: data.title,
        tag: data.tag,
        linkTab: data.linkTab
      });
    } else if (data.type === 'STUDENTOS_NAVIGATE_TAB' && (data.tab || data.linkTab)) {
      window.dispatchEvent(new CustomEvent('studentos-navigate-tab', {
        detail: { linkTab: data.tab || data.linkTab, notifId: data.notifId }
      }));
    }
  };

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', swMessageHandler);
  }

  const messaging = await getFCMClient();
  let fcmUnsub: (() => void) | null = null;

  if (messaging) {
    try {
      fcmUnsub = onMessage(messaging, async (payload) => {
        console.log('[FCM] Foreground Message Received:', payload);
        const title = payload.notification?.title || payload.data?.title || '📢 StudentOS Notification';
        const body = payload.notification?.body || payload.data?.body || payload.data?.message || '';
        const linkTab = payload.data?.linkTab || payload.data?.route || 'notice_viewer';
        const notifId = payload.data?.notificationId || payload.data?.notifId || '';

        soundService.playAnnouncementSound();

        // Also display system notification via Service Worker so Android Chrome shows it in system tray
        if ('serviceWorker' in navigator && Notification.permission === 'granted') {
          try {
            const reg = await navigator.serviceWorker.ready;
            await reg.showNotification(title, {
              body,
              icon: '/icons/icon-192.png',
              badge: '/icons/icon-192.png',
              tag: notifId ? `studentos-notif-${notifId}` : `studentos-notif-${Date.now()}`,
              renotify: true,
              data: { linkTab, notifId, url: `/?tab=${encodeURIComponent(linkTab)}` }
            } as any);
          } catch (_) {}
        }

        window.dispatchEvent(new CustomEvent('studentos-fcm-foreground-message', {
          detail: { title, body, linkTab, data: payload.data }
        }));

        if (onNotificationReceived) {
          onNotificationReceived({ title, body, data: payload.data });
        }
      });
    } catch (err) {
      console.warn('[FCM] Setup foreground listener warning:', err);
    }
  }

  return () => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.removeEventListener('message', swMessageHandler);
    }
    if (fcmUnsub) fcmUnsub();
  };
}

/**
 * Send a real server-side FCM / Web Push notification test to the current user
 */
export async function sendTestFCMNotification(
  userId: string,
  userRole?: string
): Promise<{ success: boolean; message: string; details?: any }> {
  try {
    // Ensure current device token is registered and synced before testing
    await requestFCMPermission(userId, { role: userRole || 'student' });

    const deviceLabel = getDevicePlatformLabel();
    const notifId = `test_${Date.now()}`;
    const res = await fetch('/api/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        notificationId: notifId,
        title: '🔔 StudentOS System Push Verified',
        body: `Real FCM / Web Push delivered to ${deviceLabel} at ${new Date().toLocaleTimeString()}!`,
        linkTab: 'notifications',
        type: 'announcement',
        targetUserId: userId || 'all',
        targetRole: 'all'
      })
    });

    const data = await res.json().catch(() => ({}));
    console.log('[FCM SERVER SEND RESULT]', data);

    if (res.ok && data.status === 'ok' && data.sentCount > 0) {
      soundService.playSuccess();
      return { 
        success: true, 
        message: `✓ Server delivered push to ${data.sentCount} device(s) (Msg ID: ${data.deliveryLogs?.[0]?.messageId || 'verified'}). Check your Android/Chrome notification tray!`,
        details: data
      };
    }

    return { 
      success: false, 
      message: data.sentCount === 0
        ? `No active push subscription found on server (${data.totalCandidates || 0} candidates checked). Please toggle Push Notifications OFF and ON once to refresh your device token.`
        : (data.error || 'Server could not deliver test push notification.'),
      details: data
    };
  } catch (err: any) {
    return { success: false, message: err?.message || 'Network error sending test push notification.' };
  }
}

/**
 * Get current FCM push notification status for this device
 */
export function getFCMStatus(): {
  isSupported: boolean;
  permission: NotificationPermission | 'unsupported';
  isEnabled: boolean;
  token: string | null;
  deviceId: string;
} {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return {
      isSupported: false,
      permission: 'unsupported',
      isEnabled: false,
      token: null,
      deviceId: 'server'
    };
  }

  const token = localStorage.getItem('s_os_fcm_token');
  const isEnabled = localStorage.getItem('s_os_push_enabled') === 'true' && Notification.permission === 'granted';

  return {
    isSupported: true,
    permission: Notification.permission,
    isEnabled,
    token,
    deviceId: getFCMDeviceId()
  };
}
