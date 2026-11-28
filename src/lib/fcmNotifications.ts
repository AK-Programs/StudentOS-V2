/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Firebase Cloud Messaging (FCM) & Web Push Engine for StudentOS
 * Provides reliable foreground & background push delivery for Android Chrome, PWA Standalone, & Desktop.
 */

import { initializeApp, getApps, getApp } from 'firebase/app';
import { getMessaging, getToken, onMessage, isSupported, deleteToken, Messaging } from 'firebase/messaging';
import { getFirestore, doc, setDoc } from 'firebase/firestore';
import { supabase } from './supabase';
import { soundService } from './soundService';
import {
  buildNotificationUrl,
  dispatchNotificationNavigation,
  isServiceWorkerNavigationBridgeInstalled,
} from './notificationNavigation';

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

export function isAnonymousPushUserId(uid?: string | null): boolean {
  const norm = String(uid || '').trim().toLowerCase();
  return !norm || norm === 'usr_anonymous' || norm === 'anonymous' || norm === 'guest' || norm === 'user_guest';
}

export async function buildPushApiAuthHeaders(
  explicitUserId?: string | null,
  metadata?: { role?: string; grade?: string; section?: string }
): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };
  if (typeof window === 'undefined') {
    return headers;
  }

  let cachedUser: any = {};
  try {
    cachedUser = JSON.parse(localStorage.getItem('s_os_user') || '{}') || {};
  } catch (_) {
    cachedUser = {};
  }

  let accessToken = '';
  let sessionUser: any = null;
  try {
    const { data } = await supabase.auth.getSession();
    accessToken = data?.session?.access_token || '';
    sessionUser = data?.session?.user || null;
  } catch (_) {}

  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  const uid = String(
    (!isAnonymousPushUserId(explicitUserId) ? explicitUserId : '') ||
    sessionUser?.id ||
    cachedUser?.uid ||
    cachedUser?.id ||
    cachedUser?.email ||
    ''
  ).trim();
  const email = String(sessionUser?.email || cachedUser?.email || '').trim();
  const name = String(cachedUser?.name || sessionUser?.user_metadata?.name || '').trim();
  const role = String(metadata?.role || cachedUser?.role || sessionUser?.user_metadata?.role || '').trim();
  const grade = String(metadata?.grade || cachedUser?.grade || '').trim();
  const section = String(metadata?.section || cachedUser?.section || '').trim();

  if (uid) headers['x-veylentra-uid'] = uid;
  if (email) headers['x-veylentra-email'] = email;
  if (name) headers['x-veylentra-name'] = name;
  if (role) headers['x-veylentra-role'] = role;
  if (grade) headers['x-veylentra-grade'] = grade;
  if (section) headers['x-veylentra-section'] = section;

  return headers;
}

async function waitForActiveServiceWorker(registration: ServiceWorkerRegistration): Promise<ServiceWorkerRegistration> {
  if (registration.waiting) {
    try {
      registration.waiting.postMessage({ type: 'SKIP_WAITING' });
    } catch (_) {}
  }
  if (registration.active && !registration.waiting && !registration.installing) {
    return registration;
  }
  const worker = registration.installing || registration.waiting;
  if (worker) {
    await new Promise<void>((resolve) => {
      let settled = false;
      const done = () => {
        if (settled) return;
        settled = true;
        worker.removeEventListener('statechange', onStateChange);
        resolve();
      };
      const onStateChange = () => {
        if (worker.state === 'activated' || worker.state === 'redundant') {
          done();
        }
      };
      worker.addEventListener('statechange', onStateChange);
      setTimeout(done, 5000);
    });
  }
  try {
    const ready = await Promise.race([
      navigator.serviceWorker.ready,
      new Promise<ServiceWorkerRegistration>((resolve) => setTimeout(() => resolve(registration), 3000))
    ]);
    return ready || registration;
  } catch (_) {
    return registration;
  }
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
 * Save FCM Token to Firestore collection `fcmTokens`
 */
let hasLoggedFirestorePermissionNotice = false;

export async function saveFCMTokenToFirestore(
  fcmToken: string,
  userId?: string,
  metadata?: { role?: string; grade?: string; section?: string; house?: string; schoolId?: string }
): Promise<boolean> {
  if (!fcmToken) return false;
  if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission !== 'granted') {
    if (!hasLoggedFirestorePermissionNotice) {
      console.warn('[FCM] Notification permission missing; skipping Firestore fcmTokens update.');
      hasLoggedFirestorePermissionNotice = true;
    }
    return false;
  }

  try {
    const firebaseConfig = {
      apiKey: (import.meta as any).env?.VITE_FIREBASE_API_KEY || defaultFirebaseConfig.apiKey,
      authDomain: (import.meta as any).env?.VITE_FIREBASE_AUTH_DOMAIN || defaultFirebaseConfig.authDomain,
      projectId: (import.meta as any).env?.VITE_FIREBASE_PROJECT_ID || defaultFirebaseConfig.projectId,
      storageBucket: (import.meta as any).env?.VITE_FIREBASE_STORAGE_BUCKET || defaultFirebaseConfig.storageBucket,
      messagingSenderId: (import.meta as any).env?.VITE_FIREBASE_MESSAGING_SENDER_ID || defaultFirebaseConfig.messagingSenderId,
      appId: (import.meta as any).env?.VITE_FIREBASE_APP_ID || defaultFirebaseConfig.appId
    };

    const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
    const db = getFirestore(app);

    const deviceId = getFCMDeviceId();
    const platform = getDevicePlatformLabel();
    const now = new Date().toISOString();

    const docId = (fcmToken || deviceId).replace(/[^a-zA-Z0-9_\-]/g, '_').substring(0, 120) || deviceId;

    await setDoc(doc(db, 'fcmTokens', docId), {
      id: docId,
      token: fcmToken,
      userId: userId || 'usr_anonymous',
      deviceId,
      platform: platform.includes('PWA') ? 'Android TWA / PWA' : platform,
      role: metadata?.role || 'student',
      grade: metadata?.grade || '',
      section: metadata?.section || '',
      house: metadata?.house || '',
      schoolId: metadata?.schoolId || 'default_school',
      createdAt: now,
      updatedAt: now
    }, { merge: true });

    console.log(`[FCM STAGE 3/4] FCM Token saved to Firestore collection "fcmTokens" (docId: ${docId})`);
    return true;
  } catch (err: any) {
    if (!hasLoggedFirestorePermissionNotice) {
      console.warn('[FCM] Notice saving token to Firestore fcmTokens:', err?.message || err);
      hasLoggedFirestorePermissionNotice = true;
    }
    return false;
  }
}

let inFlightFcmRegistration: Promise<{ success: boolean; token?: string; error?: string }> | null = null;
let inFlightFcmKey = '';
const recentPushTags = new Map<string, number>();

export function markPushTagHandled(tag?: string | null): void {
  const key = String(tag || '').trim();
  if (!key) return;
  const now = Date.now();
  recentPushTags.set(key, now);
  if (recentPushTags.size > 200) {
    for (const [k, ts] of recentPushTags.entries()) {
      if (now - ts > 30000) recentPushTags.delete(k);
    }
  }
}

export function hasPushTagRecentlyHandled(tag?: string | null, windowMs: number = 12000): boolean {
  const key = String(tag || '').trim();
  if (!key) return false;
  const ts = recentPushTags.get(key);
  if (!ts) return false;
  if (Date.now() - ts <= windowMs) return true;
  recentPushTags.delete(key);
  return false;
}

/**
 * Request FCM & Web Push Notification permission and register active device token & subscription.
 * Uses single-flight deduplication per user/metadata signature to prevent race conditions during auth hydration.
 */
export async function requestFCMPermission(
  userId?: string,
  metadata?: { role?: string; grade?: string; section?: string; house?: string; schoolId?: string },
  options?: { silentIfDefault?: boolean }
): Promise<{ success: boolean; token?: string; error?: string }> {
  if (typeof window === 'undefined' || !('Notification' in window) || !('serviceWorker' in navigator)) {
    return { success: false, error: 'Push notifications are not supported in this browser.' };
  }

  const requestKey = [
    userId || 'anon',
    metadata?.role || '',
    metadata?.grade || '',
    metadata?.section || '',
    metadata?.schoolId || '',
    options?.silentIfDefault ? 'silent' : 'prompt'
  ].join('|');

  if (inFlightFcmRegistration && inFlightFcmKey === requestKey) {
    return inFlightFcmRegistration;
  }

  const runRegistration = async (): Promise<{ success: boolean; token?: string; error?: string }> => {

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

    // Always ensure the unified /sw.js worker is registered and updated (activates waiting workers too)
    let swRegistration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    if (!options?.silentIfDefault) {
      swRegistration.update().catch(() => {});
    }
    swRegistration = await waitForActiveServiceWorker(swRegistration);
    if (!swRegistration?.pushManager) {
      return { success: false, error: 'Service worker pushManager is unavailable on this browser.' };
    }

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

    // 5. Resolve authenticated user metadata cleanly (reject anonymous/guest users)
    let sessionUser: any = null;
    try {
      const { data } = await supabase.auth.getSession();
      sessionUser = data?.session?.user || null;
    } catch (_) {}

    let effectiveUserId = !isAnonymousPushUserId(userId) ? String(userId).trim() : '';
    let effectiveMeta = metadata || {};
    if (typeof window !== 'undefined') {
      try {
        const cachedUser = JSON.parse(localStorage.getItem('s_os_user') || '{}');
        if (!effectiveUserId) {
          effectiveUserId = String(sessionUser?.id || cachedUser.uid || cachedUser.id || cachedUser.email || '').trim();
        }
        effectiveMeta = {
          role: effectiveMeta.role || cachedUser.role || 'student',
          grade: effectiveMeta.grade || cachedUser.grade || '',
          section: effectiveMeta.section || cachedUser.section || '',
          house: effectiveMeta.house || cachedUser.house || '',
          schoolId: effectiveMeta.schoolId || cachedUser.schoolId || 'default_school'
        };
      } catch (_) {}
    }

    if (isAnonymousPushUserId(effectiveUserId)) {
      return { success: false, error: 'Sign in required before registering push notifications.' };
    }

    if (!subscriptionJson?.endpoint || !subscriptionJson?.keys?.p256dh || !subscriptionJson?.keys?.auth) {
      return {
        success: false,
        error: 'Web Push subscription did not include required endpoint and encryption keys (p256dh/auth).'
      };
    }

    // 6. Persist token to localStorage
    const deviceId = getFCMDeviceId();
    const deviceLabel = getDevicePlatformLabel();
    localStorage.setItem('s_os_fcm_token', fcmToken || primaryEndpoint);
    localStorage.setItem('s_os_push_enabled', 'true');
    localStorage.setItem('s_os_push_sub', JSON.stringify(subscriptionJson));
    localStorage.setItem('s_os_fcm_user_id', effectiveUserId);

    // 7. When an authenticated Supabase Auth session owns this user_id, persist directly via RLS-compliant client write too.
    // Otherwise server /api/push/fcm-token performs the authoritative service-role persistence cleanly.
    let directSbError: string | null = null;
    if (sessionUser?.id && sessionUser.id === effectiveUserId) {
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
          user_id: effectiveUserId,
          endpoint: subscriptionJson.endpoint,
          p256dh: subscriptionJson.keys.p256dh,
          auth: subscriptionJson.keys.auth,
          role: effectiveMeta.role || 'student',
          grade: effectiveMeta.grade || '',
          section: effectiveMeta.section || '',
          school_id: effectiveMeta.schoolId || 'default_school',
          keys: richKeys,
          updated_at: now
        }, { onConflict: 'endpoint' });

        if (sbErr) {
          directSbError = sbErr.message;
          console.error('[FCM] Supabase push_subscriptions upsert warning:', sbErr.message);
        } else {
          console.log(`[FCM STAGE 3/4] FCM token & WebPush subscription stored in Supabase (userId: ${effectiveUserId}, active: yes)`);
        }
      } catch (sbEx: any) {
        directSbError = sbEx?.message || String(sbEx);
        console.error('[FCM] Supabase token persistence exception:', sbEx);
      }
    }

    // 8. Register token & subscription with backend server (authoritative Supabase write & memory sync)
    const authHeaders = await buildPushApiAuthHeaders(effectiveUserId, effectiveMeta);
    const apiRes = await fetch('/api/push/fcm-token', {
      method: 'POST',
      headers: authHeaders,
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

    const apiData = await apiRes.json().catch(() => ({}));
    if (!apiRes.ok || apiData.status === 'error' || apiData.error || apiData.tokenStored === false) {
      const errMsg = apiData.details || apiData.error || directSbError || `Server registration failed (${apiRes.status})`;
      console.error('[FCM] Backend subscription persistence failed:', errMsg);
      return { success: false, error: errMsg };
    }

    // 9. Register token directly in Firestore 'fcmTokens' collection
    try {
      await saveFCMTokenToFirestore(fcmToken || primaryEndpoint, effectiveUserId || undefined, effectiveMeta);
    } catch (_) {}

    return { success: true, token: fcmToken || primaryEndpoint };
  } catch (err: any) {
    console.error('[FCM] Error requesting FCM permission:', err);
    return { success: false, error: err?.message || 'Failed to enable push notifications.' };
  }
  };

  inFlightFcmKey = requestKey;
  const promise = runRegistration().finally(() => {
    if (inFlightFcmRegistration === promise) {
      inFlightFcmRegistration = null;
      inFlightFcmKey = '';
    }
  });
  inFlightFcmRegistration = promise;
  return promise;
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

    // 3. Notify backend server with caller auth headers
    if (endpoint) {
      try {
        const authHeaders = await buildPushApiAuthHeaders(userId);
        await fetch('/api/push/fcm-token/delete', {
          method: 'POST',
          headers: authHeaders,
          body: JSON.stringify({ token: endpoint, userId, deviceId })
        });
      } catch (_) {}
    }

    // 4. Delete from Supabase push_subscriptions table when user owns a Supabase session
    if (endpoint) {
      try {
        const { data } = await supabase.auth.getSession();
        if (data?.session?.user?.id) {
          await supabase
            .from('push_subscriptions')
            .delete()
            .eq('endpoint', endpoint)
            .eq('user_id', data.session.user.id);
        }
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
 * Build a normalized foreground push notification event payload from either Service Worker postMessage or Firebase onMessage.
 */
export function buildForegroundPushDetail(raw: {
  title?: string;
  body?: string;
  linkTab?: string;
  notifId?: string;
  notificationId?: string;
  callId?: string;
  type?: string;
  notifType?: string;
  schoolId?: string;
  url?: string;
  tag?: string;
  data?: any;
}) {
  const d = raw?.data && typeof raw.data === 'object' ? raw.data : {};
  const callId = String(raw?.callId || d.callId || '').trim();
  const notifType = String(raw?.notifType || raw?.type || d.type || (callId ? 'call' : 'announcement')).trim();
  const linkTab = String(
    raw?.linkTab || d.linkTab || d.route || d.tab || (callId ? 'peer_chat' : 'notice_viewer')
  ).trim();
  const notifId = String(raw?.notifId || raw?.notificationId || d.notificationId || d.notifId || '').trim();
  const title = String(raw?.title || d.title || '📢 Veylentra Notice').trim();
  const body = String(raw?.body || d.body || d.message || '').trim();
  const tag = String(
    raw?.tag || d.tag || (notifId ? `studentos-notif-${notifId}` : `studentos-notif-${Date.now()}`)
  ).trim();
  const url = String(raw?.url || d.url || buildNotificationUrl(linkTab, notifId, { callId: callId || undefined }));
  return {
    title,
    body,
    linkTab,
    notifId,
    callId,
    type: notifType,
    schoolId: String(raw?.schoolId || d.schoolId || 'default_school'),
    tag,
    url,
    data: {
      ...d,
      title,
      body,
      linkTab,
      notifId,
      callId,
      type: notifType,
      url,
      tag,
    },
  };
}

/**
 * Setup Foreground FCM Message listener + ServiceWorker notification bridge
 */
export async function setupFCMForegroundListener(
  onNotificationReceived?: (payload: { title: string; body: string; data?: any }) => void
): Promise<(() => void) | null> {
  if (typeof window === 'undefined') return null;

  // Listen for Service Worker postMessage events (when SW receives a push while app is open OR user clicks notification)
  const swMessageHandler = (event: MessageEvent) => {
    const data = event.data;
    if (!data) return;
    if (data.type === 'FCM_SW_NOTIFICATION_DISPLAYED' || data.type === 'FCM_SW_INCOMING_CALL') {
      const detail = buildForegroundPushDetail({
        ...data,
        type: data.notifType || (data.type === 'FCM_SW_INCOMING_CALL' ? 'call' : 'announcement'),
      });
      const alreadyHandled = hasPushTagRecentlyHandled(detail.tag, 8000);
      markPushTagHandled(detail.tag);

      console.log('[FCM STAGE 4/4] Service Worker received push while app active:', {
        title: detail.title,
        tag: detail.tag,
        linkTab: detail.linkTab,
        alreadyHandled,
      });

      if (!alreadyHandled) {
        if (detail.type !== 'call' && detail.type !== 'incoming_call') {
          soundService.playAnnouncementSound();
        }
        window.dispatchEvent(new CustomEvent('studentos-fcm-foreground-message', { detail }));
        if (onNotificationReceived) {
          onNotificationReceived({ title: detail.title, body: detail.body, data: detail.data });
        }
      }
    } else if (data.type === 'STUDENTOS_NAVIGATE_TAB' && (data.tab || data.linkTab)) {
      if (!isServiceWorkerNavigationBridgeInstalled()) {
        dispatchNotificationNavigation({
          tab: data.tab || data.linkTab,
          linkTab: data.linkTab || data.tab,
          notifId: data.notifId || data.notificationId,
          callId: data.callId,
          type: data.notifType || data.type,
          url: data.url,
          source: 'sw',
        });
      }
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
        const detail = buildForegroundPushDetail({
          title: payload.notification?.title || payload.data?.title || '📢 StudentOS Notification',
          body: payload.notification?.body || payload.data?.body || payload.data?.message || '',
          data: payload.data,
        });

        const alreadyDisplayed = hasPushTagRecentlyHandled(detail.tag, 8000);
        markPushTagHandled(detail.tag);

        if (!alreadyDisplayed) {
          soundService.playAnnouncementSound();
          // Display system notification via Service Worker so Android Chrome / Desktop shows it in system tray too
          if ('serviceWorker' in navigator && Notification.permission === 'granted') {
            try {
              const reg = await navigator.serviceWorker.ready;
              await reg.showNotification(detail.title, {
                body: detail.body,
                icon: '/icons/icon-192.png',
                badge: '/icons/icon-192.png',
                tag: detail.tag,
                renotify: true,
                data: {
                  linkTab: detail.linkTab,
                  tab: detail.linkTab,
                  notifId: detail.notifId,
                  callId: detail.callId,
                  type: detail.type,
                  url: detail.url,
                }
              } as any);
            } catch (_) {}
          }

          window.dispatchEvent(new CustomEvent('studentos-fcm-foreground-message', { detail }));
          if (onNotificationReceived) {
            onNotificationReceived({ title: detail.title, body: detail.body, data: detail.data });
          }
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
    const regRes = await requestFCMPermission(userId, { role: userRole || 'student' });
    if (!regRes.success) {
      return {
        success: false,
        message: `Subscription registration failed: ${regRes.error || 'Could not save subscription to public.push_subscriptions'}`,
        details: regRes
      };
    }

    const deviceLabel = getDevicePlatformLabel();
    const notifId = `test_${Date.now()}`;
    const authHeaders = await buildPushApiAuthHeaders(userId, { role: userRole || 'student' });
    const resolvedTargetUid = !isAnonymousPushUserId(userId)
      ? userId
      : (authHeaders['x-veylentra-uid'] || localStorage.getItem('s_os_fcm_user_id') || 'all');
    const res = await fetch('/api/push/send', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        notificationId: notifId,
        title: '🔔 StudentOS System Push Verified',
        body: `Real FCM / Web Push delivered to ${deviceLabel} at ${new Date().toLocaleTimeString()}!`,
        linkTab: 'notifications',
        type: 'announcement',
        targetUserId: resolvedTargetUid,
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

    if (data.fcmSendResult === 'VAPID_PRIVATE_KEY_NOT_CONFIGURED' || data.vapidConfigured === false) {
      return {
        success: false,
        message: 'Device subscription is synced, but the server VAPID_PRIVATE_KEY environment variable is not configured yet in this deployment.',
        details: data
      };
    }

    return {
      success: false,
      message: data.sentCount === 0
        ? (data.totalCandidates > 0
            ? (data.error || `Push delivery failed for ${data.totalCandidates} subscribed device(s).`)
            : 'No active push subscription found on server. Please toggle Push Notifications OFF and ON once to refresh your device token.')
        : (data.error || 'Server could not deliver test push notification.'),
      details: data
    };
  } catch (err: any) {
    return { success: false, message: err?.message || 'Network error sending test push notification.' };
  }
}

/**
 * Notification Settings Test Helper:
 * Registers this device to public.push_subscriptions and triggers a live verification push.
 * Displays the real success or exact Supabase/server error.
 */
export async function registerAndVerifyPushSubscription(
  userId: string,
  meta?: { role?: string; grade?: string; section?: string; house?: string; schoolId?: string }
): Promise<{ success: boolean; message: string; details?: any }> {
  try {
    const regRes = await requestFCMPermission(userId, meta);
    if (!regRes.success) {
      return {
        success: false,
        message: `Registration failed: ${regRes.error || 'Could not save subscription to public.push_subscriptions'}`,
        details: regRes
      };
    }

    const testRes = await sendTestFCMNotification(userId, meta?.role);
    if (testRes.success) {
      return {
        success: true,
        message: `✓ Device registered in public.push_subscriptions! Test push delivered to tray.`,
        details: testRes.details
      };
    }

    return {
      success: false,
      message: `Device registered, but test push notice: ${testRes.message}`,
      details: testRes.details
    };
  } catch (err: any) {
    return {
      success: false,
      message: err?.message || 'Error executing push subscription test.',
      details: err
    };
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
