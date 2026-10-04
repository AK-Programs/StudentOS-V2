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

// VAPID Public Key for Web Push (client-safe)
export const DEFAULT_VAPID_KEY = 'BJrzpoU4JY2uj2YmpzKKMoNsa5aHr_iL6rmLvG55NsGqInuYW1BzI1_6vYjz20GTx8qid6znkPbsVdMdppQ1uf4';

let messagingInstance: Messaging | null = null;
let messagingSupported: boolean | null = null;

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
    console.log('[FCM] Firebase Messaging successfully initialized.');
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
  metadata?: { role?: string; grade?: string; section?: string; house?: string; schoolId?: string }
): Promise<{ success: boolean; token?: string; error?: string }> {
  if (typeof window === 'undefined' || !('Notification' in window) || !('serviceWorker' in navigator)) {
    return { success: false, error: 'Push notifications are not supported in this browser.' };
  }

  try {
    // 1. Request notification permission if not yet decided
    let permission = Notification.permission;
    if (permission === 'default') {
      permission = await Notification.requestPermission();
    }

    if (permission !== 'granted') {
      console.warn('[FCM] Push Notification permission was denied by user.');
      return { success: false, error: 'Notification permission was denied.' };
    }

    // 2. Register or retrieve active Service Worker
    let swRegistration = await navigator.serviceWorker.getRegistration('/');
    if (!swRegistration) {
      swRegistration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    }
    await navigator.serviceWorker.ready;

    // 3. Fetch public VAPID key from backend or default
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

    // 4. Retrieve Web Push native subscription via pushManager
    let pushSubscription: PushSubscription | null = null;
    if (swRegistration?.pushManager) {
      try {
        pushSubscription = await swRegistration.pushManager.getSubscription();
        if (!pushSubscription && vapidKey) {
          pushSubscription = await swRegistration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(vapidKey)
          });
        }
      } catch (subErr: any) {
        console.warn('[FCM] pushManager subscribe notice:', subErr?.message || subErr);
      }
    }

    // 5. Retrieve FCM Client & Token
    const messaging = await getFCMClient();
    let fcmToken: string | null = null;

    if (messaging && swRegistration) {
      try {
        fcmToken = await getToken(messaging, {
          vapidKey,
          serviceWorkerRegistration: swRegistration
        });
      } catch (tokenErr: any) {
        console.warn('[FCM] getToken notice:', tokenErr?.message || tokenErr);
      }
    }

    const primaryToken = fcmToken || pushSubscription?.endpoint;
    if (!primaryToken) {
      return { success: false, error: 'Could not generate push registration token for this device.' };
    }

    // Serialize subscription details (keys + endpoint) for backend dispatching
    let subscriptionJson: any = null;
    if (pushSubscription) {
      const rawJson = pushSubscription.toJSON();
      subscriptionJson = {
        endpoint: pushSubscription.endpoint,
        keys: rawJson.keys || {
          p256dh: pushSubscription.getKey ? btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(pushSubscription.getKey('p256dh') || new ArrayBuffer(0))))) : '',
          auth: pushSubscription.getKey ? btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(pushSubscription.getKey('auth') || new ArrayBuffer(0))))) : ''
        }
      };
    }

    // 6. Persist token to localStorage
    const deviceId = getFCMDeviceId();
    const deviceLabel = getDevicePlatformLabel();
    localStorage.setItem('s_os_fcm_token', primaryToken);
    localStorage.setItem('s_os_push_enabled', 'true');
    if (subscriptionJson) {
      localStorage.setItem('s_os_push_sub', JSON.stringify(subscriptionJson));
    }
    if (userId) {
      localStorage.setItem('s_os_fcm_user_id', userId);
    }

    // 7. Register token & subscription with backend server
    try {
      await fetch('/api/push/fcm-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: primaryToken,
          fcmToken: fcmToken || undefined,
          subscription: subscriptionJson,
          userId: userId || null,
          deviceId,
          deviceLabel,
          role: metadata?.role || 'student',
          grade: metadata?.grade || '',
          section: metadata?.section || '',
          house: metadata?.house || '',
          schoolId: metadata?.schoolId || 'default_school'
        })
      });
    } catch (apiErr) {
      console.warn('[FCM] Backend token registration notice:', apiErr);
    }

    // 8. Persist token to Supabase user_push_tokens & push_subscriptions tables
    try {
      const now = new Date().toISOString();
      await supabase.from('user_push_tokens').upsert({
        user_id: userId || null,
        token: primaryToken,
        platform: 'web_fcm',
        device_label: deviceLabel,
        is_active: true,
        last_seen_at: now,
        updated_at: now
      }, { onConflict: 'token' });

      if (subscriptionJson?.endpoint) {
        await supabase.from('push_subscriptions').upsert({
          user_id: userId || null,
          endpoint: subscriptionJson.endpoint,
          p256dh: subscriptionJson.keys?.p256dh || '',
          auth: subscriptionJson.keys?.auth || '',
          device_id: deviceId,
          device_type: deviceLabel,
          created_at: now,
          updated_at: now
        }, { onConflict: 'endpoint' });
      }
    } catch (sbErr) {
      console.warn('[FCM] Supabase token persistence notice:', sbErr);
    }

    console.log(`[FCM] Notification token registered successfully for ${deviceLabel} (Token: ${primaryToken.slice(0, 25)}...).`);
    return { success: true, token: primaryToken };
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
    const deviceId = getFCMDeviceId();

    // 1. Delete token from Firebase Messaging SDK
    const messaging = await getFCMClient();
    if (messaging) {
      try {
        await deleteToken(messaging);
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
    if (token) {
      try {
        await fetch('/api/push/fcm-token/delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token, userId, deviceId })
        });
      } catch (_) {}
    }

    // 4. Update Supabase token record
    if (token) {
      try {
        await supabase
          .from('user_push_tokens')
          .update({ is_active: false, updated_at: new Date().toISOString() })
          .eq('token', token);
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
 * Setup Foreground FCM Message listener
 */
export async function setupFCMForegroundListener(
  onNotificationReceived?: (payload: { title: string; body: string; data?: any }) => void
): Promise<(() => void) | null> {
  const messaging = await getFCMClient();
  if (!messaging) return null;

  try {
    const unsubscribe = onMessage(messaging, (payload) => {
      console.log('[FCM] Foreground Message Received:', payload);
      const title = payload.notification?.title || payload.data?.title || '📢 StudentOS Notification';
      const body = payload.notification?.body || payload.data?.body || payload.data?.message || '';
      const linkTab = payload.data?.linkTab || 'notice_viewer';

      // Play notification sound
      soundService.playAnnouncementSound();

      // Trigger in-app notification state update
      window.dispatchEvent(new CustomEvent('studentos-fcm-foreground-message', {
        detail: { title, body, linkTab, data: payload.data }
      }));

      if (onNotificationReceived) {
        onNotificationReceived({ title, body, data: payload.data });
      }
    });

    return unsubscribe;
  } catch (err) {
    console.warn('[FCM] Setup foreground listener warning:', err);
    return null;
  }
}

/**
 * Send a test FCM push notification to the current user
 */
export async function sendTestFCMNotification(
  userId: string,
  userRole?: string
): Promise<{ success: boolean; message: string; details?: any }> {
  try {
    const deviceLabel = getDevicePlatformLabel();
    const res = await fetch('/api/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: '🧪 StudentOS Push Notification Test',
        body: `FCM & Web Push delivery verified on ${deviceLabel} at ${new Date().toLocaleTimeString()}!`,
        linkTab: 'notifications',
        targetUserId: userId || 'all',
        targetRole: userRole || 'all'
      })
    });

    const data = await res.json().catch(() => ({}));
    if (res.ok && data.status === 'ok') {
      soundService.playSuccess();
      const countMsg = data.sentCount > 0 ? `Sent to ${data.sentCount} active device(s)` : 'Dispatched to push queue';
      return { 
        success: true, 
        message: `✓ ${countMsg}. Check your notification drawer!`,
        details: data
      };
    }
    return { 
      success: false, 
      message: data.error || 'Server could not deliver test push notification.',
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
