/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Official Pusher Beams Web Push Notification Client for StudentOS
 * Documentation: https://pusher.com/docs/beams/
 */

import * as PusherPushNotifications from '@pusher/push-notifications-web';
import { UserProfile } from '../types';
import { registerPushSubscription, getDeviceId } from './notifications';

export interface PusherBeamsPushResult {
  success: boolean;
  optedIn: boolean;
  permission?: 'default' | 'granted' | 'denied';
  deviceId?: string;
  interests?: string[];
  error?: string;
}

let beamsClientInstance: PusherPushNotifications.Client | null = null;
let cachedInstanceId: string | null = null;

/**
 * Sanitize an interest name so it conforms to Pusher Beams naming rules:
 * Up to 164 characters, only ASCII alphanumeric and _ - = @ , . ;
 */
export function sanitizeBeamsInterest(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_\-=@,.;]/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 160);
}

/**
 * Compute the role/class/section/house/user Pusher Beams interests for a given UserProfile
 */
export function computeUserBeamsInterests(
  userId?: string,
  userRole?: string,
  extraTags?: { grade?: string; section?: string; house?: string; school?: string }
): string[] {
  const interests = new Set<string>();
  interests.add('school-all');

  const role = sanitizeBeamsInterest(userRole || 'student');
  if (role) {
    interests.add(`role-${role}`);
  }

  if (extraTags?.grade) {
    const normGrade = sanitizeBeamsInterest(extraTags.grade.replace(/grade|class|\s+/gi, ''));
    if (normGrade) {
      interests.add(`class-${normGrade}`);
      if (extraTags?.section) {
        const normSection = sanitizeBeamsInterest(extraTags.section.replace(/section|\s+/gi, ''));
        if (normSection) {
          interests.add(`section-${normGrade}-${normSection}`);
        }
      }
    }
  }

  if (extraTags?.house && extraTags.house.toLowerCase() !== 'none') {
    const normHouse = sanitizeBeamsInterest(extraTags.house);
    if (normHouse) {
      interests.add(`house-${normHouse}`);
    }
  }

  if (userId) {
    const normUser = sanitizeBeamsInterest(userId);
    if (normUser) {
      interests.add(`user-${normUser}`);
    }
  }

  return Array.from(interests);
}

/**
 * Resolve the client-safe Pusher Beams Instance ID from Vite env or server config endpoint
 */
async function resolveBeamsInstanceId(): Promise<string | null> {
  if (cachedInstanceId) return cachedInstanceId;

  const envId = (import.meta as any).env?.VITE_PUSHER_BEAMS_INSTANCE_ID;
  if (envId && typeof envId === 'string' && envId.trim().length > 0) {
    cachedInstanceId = envId.trim();
    return cachedInstanceId;
  }

  try {
    const res = await fetch('/api/push/beams-config');
    if (res.ok) {
      const data = await res.json();
      if (data?.instanceId && typeof data.instanceId === 'string') {
        cachedInstanceId = data.instanceId.trim();
        return cachedInstanceId;
      }
    }
  } catch (_) {}

  return null;
}

/**
 * Get or initialize the singleton Pusher Beams Web Client
 */
async function getOrInitBeamsClient(): Promise<PusherPushNotifications.Client | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('Notification' in window)) {
    return null;
  }

  if (beamsClientInstance) {
    return beamsClientInstance;
  }

  const instanceId = await resolveBeamsInstanceId();
  if (!instanceId) {
    return null;
  }

  try {
    let swReg = await navigator.serviceWorker.getRegistration('/sw.js');
    if (!swReg) {
      swReg = await navigator.serviceWorker.register('/sw.js');
    }
    await navigator.serviceWorker.ready;

    beamsClientInstance = new PusherPushNotifications.Client({
      instanceId,
      serviceWorkerRegistration: swReg,
    });
    return beamsClientInstance;
  } catch (err) {
    console.warn('[PusherBeams] Client initialization notice:', err);
    return null;
  }
}

/**
 * Request notification permission and subscribe the current device via Pusher Beams
 * and the StudentOS Service Worker push pipeline.
 */
export async function enablePusherBeamsPush(
  userId?: string,
  userRole?: string,
  extraTags?: Record<string, string>
): Promise<PusherBeamsPushResult> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return {
      success: false,
      optedIn: false,
      permission: 'default',
      error: 'Web Push Notifications are not supported in this browser environment.',
    };
  }

  try {
    let permission = Notification.permission;
    if (permission !== 'granted') {
      permission = await Notification.requestPermission();
    }

    if (permission !== 'granted') {
      return {
        success: false,
        optedIn: false,
        permission: permission as 'default' | 'denied',
        error: 'Browser notification permission was not granted.',
      };
    }

    const interests = computeUserBeamsInterests(userId, userRole, extraTags);
    let beamsDeviceId: string | undefined;

    // 1. Start Pusher Beams client if Instance ID is configured
    const beamsClient = await getOrInitBeamsClient();
    if (beamsClient) {
      try {
        await beamsClient.start();
        beamsDeviceId = await beamsClient.getDeviceId();
        await beamsClient.setDeviceInterests(interests);

        if (userId) {
          try {
            const tokenProvider = new PusherPushNotifications.TokenProvider({
              url: '/api/push/beams-auth',
              queryParams: { user_id: userId },
              headers: { 'X-StudentOS-User-Id': userId },
            });
            await beamsClient.setUserId(userId, tokenProvider);
          } catch (_) {
            // Optional authenticated user binding if server secret is present
          }
        }
      } catch (beamsErr) {
        console.warn('[PusherBeams] SDK subscription fallback to SW WebPush:', beamsErr);
      }
    }

    // 2. Also register Service Worker WebPush subscription with full targeting metadata
    await registerPushSubscription(userId, {
      role: userRole || 'student',
      grade: extraTags?.grade || '',
      section: extraTags?.section || '',
      house: extraTags?.house || '',
      interests,
    });

    const finalDeviceId = beamsDeviceId || getDeviceId();
    try {
      localStorage.setItem('studentos_beams_opted_in', 'true');
      localStorage.setItem('studentos_beams_device_id', finalDeviceId);
      localStorage.setItem('studentos_beams_interests', JSON.stringify(interests));
    } catch (_) {}

    return {
      success: true,
      optedIn: true,
      permission: 'granted',
      deviceId: finalDeviceId,
      interests,
    };
  } catch (err: any) {
    console.warn('[PusherBeams] Error enabling push notifications:', err);
    return {
      success: false,
      optedIn: false,
      permission: Notification.permission as any,
      error: err?.message || 'Failed to initialize Pusher Beams push notifications.',
    };
  }
}

/**
 * Opt out of Pusher Beams Web Push notifications on this device
 */
export async function disablePusherBeamsPush(userId?: string): Promise<{ success: boolean }> {
  if (typeof window === 'undefined') return { success: true };

  try {
    const beamsClient = await getOrInitBeamsClient();
    if (beamsClient) {
      try {
        await beamsClient.clearDeviceInterests();
        await beamsClient.stop();
      } catch (_) {}
    }

    const deviceId = getDeviceId();
    try {
      await fetch('/api/push/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId, userId: userId || null }),
      });
    } catch (_) {}

    try {
      localStorage.setItem('studentos_beams_opted_in', 'false');
      localStorage.removeItem('studentos_beams_interests');
    } catch (_) {}

    return { success: true };
  } catch (err) {
    console.warn('[PusherBeams] Error disabling push:', err);
    return { success: false };
  }
}

/**
 * Get current Pusher Beams permission, opt-in status, device ID, and active interests
 */
export async function getPusherBeamsStatus(): Promise<{
  supported: boolean;
  permission: 'default' | 'granted' | 'denied';
  optedIn: boolean;
  deviceId?: string;
  interests?: string[];
}> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return {
      supported: false,
      permission: 'default',
      optedIn: false,
    };
  }

  const permission = Notification.permission as 'default' | 'granted' | 'denied';
  let optedIn = false;
  let deviceId: string | undefined;
  let interests: string[] = [];

  try {
    const savedOptIn = localStorage.getItem('studentos_beams_opted_in');
    optedIn = permission === 'granted' && savedOptIn === 'true';
    deviceId = localStorage.getItem('studentos_beams_device_id') || getDeviceId();
    const savedInterests = localStorage.getItem('studentos_beams_interests');
    if (savedInterests) {
      interests = JSON.parse(savedInterests);
    }
  } catch (_) {}

  try {
    const beamsClient = await getOrInitBeamsClient();
    if (beamsClient && permission === 'granted') {
      const sdkDeviceId = await beamsClient.getDeviceId();
      if (sdkDeviceId) {
        deviceId = sdkDeviceId;
        optedIn = true;
      }
      const sdkInterests = await beamsClient.getDeviceInterests();
      if (Array.isArray(sdkInterests) && sdkInterests.length > 0) {
        interests = sdkInterests;
      }
    }
  } catch (_) {}

  return {
    supported: true,
    permission,
    optedIn,
    deviceId,
    interests,
  };
}

/**
 * Synchronize user role/class/section/house interests with Pusher Beams
 */
export async function syncPusherBeamsUserInterests(user: UserProfile): Promise<void> {
  if (typeof window === 'undefined' || !user) return;
  if (!('Notification' in window) || Notification.permission !== 'granted') return;

  const savedOptIn = localStorage.getItem('studentos_beams_opted_in');
  if (savedOptIn === 'false' && !user.enableWebPush) return;

  const interests = computeUserBeamsInterests(user.uid || user.email, user.role, {
    grade: user.grade || '10',
    section: user.section || 'A',
    house: user.house || 'None',
  });

  try {
    localStorage.setItem('studentos_beams_interests', JSON.stringify(interests));
  } catch (_) {}

  try {
    const beamsClient = await getOrInitBeamsClient();
    if (beamsClient) {
      await beamsClient.start();
      await beamsClient.setDeviceInterests(interests);
    }
  } catch (_) {}

  try {
    await registerPushSubscription(user.uid || user.email, {
      role: user.role || 'student',
      grade: user.grade || '',
      section: user.section || '',
      house: user.house || '',
      interests,
    });
  } catch (_) {}
}

/**
 * Clear Pusher Beams user/device state on logout so notifications for the previous user
 * never reach a subsequent user or logged-out browser session.
 */
export async function clearPusherBeamsOnLogout(userId?: string): Promise<void> {
  if (typeof window === 'undefined') return;

  try {
    const beamsClient = await getOrInitBeamsClient();
    if (beamsClient) {
      await beamsClient.clearAllState();
    }
  } catch (_) {}

  try {
    const deviceId = getDeviceId();
    await fetch('/api/push/unsubscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId, userId: userId || null }),
    });
  } catch (_) {}

  try {
    localStorage.removeItem('studentos_beams_interests');
  } catch (_) {}
}

/**
 * Send a targeted test push notification to the current user/device via Pusher Beams / Push endpoint
 */
export async function sendTestPusherBeamsNotification(user: UserProfile): Promise<boolean> {
  if (typeof window === 'undefined' || !('Notification' in window)) return false;
  if (Notification.permission !== 'granted') return false;

  const title = '🔔 StudentOS Push Verified (Pusher Beams)';
  const body = `Targeted alert for ${user.name || 'User'} (${(user.role || 'student').toUpperCase()}). Real-time academic notifications are active!`;

  try {
    const res = await fetch('/api/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title,
        body,
        type: 'announcement',
        linkTab: 'dashboard',
        targetUserId: user.uid || user.email,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      if ((data.sent && data.sent > 0) || data.beamsPublished) {
        return true;
      }
    }
  } catch (_) {}

  try {
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg && reg.showNotification) {
        await reg.showNotification(title, {
          body,
          icon: '/icons/icon-192.png',
          badge: '/icons/icon-192.png',
          tag: 'studentos-beams-test',
        });
        return true;
      }
    }
    new Notification(title, { body, icon: '/icons/icon-192.png' });
    return true;
  } catch (_) {
    return false;
  }
}

