/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { UserProfile } from '../types';

declare global {
  interface Window {
    OneSignalDeferred?: any[];
    OneSignal?: any;
  }
}

export interface OneSignalPushResult {
  success: boolean;
  optedIn: boolean;
  permission?: 'default' | 'granted' | 'denied';
  subscriptionId?: string;
  error?: string;
}

/**
 * Request notification permission via OneSignal and opt user in to Web Push
 */
export async function enableOneSignalWebPush(
  userId?: string,
  userRole?: string,
  extraTags?: Record<string, string>
): Promise<OneSignalPushResult> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') {
      return resolve({ success: false, optedIn: false, error: 'Window environment not available.' });
    }

    try {
      window.OneSignalDeferred = window.OneSignalDeferred || [];
      window.OneSignalDeferred.push(async function (OneSignal: any) {
        try {
          console.log('[OneSignal] Prompting for notification permission...');

          // 1. Request browser notification permission
          await OneSignal.Notifications.requestPermission();
          const permission = (await OneSignal.Notifications.permission) ? 'granted' : 'denied';

          if (permission === 'granted') {
            // 2. Opt in to push subscription
            await OneSignal.User.PushSubscription.optIn();

            // 3. Link external user ID for targeted messaging
            if (userId) {
              try {
                await OneSignal.login(userId);
              } catch (loginErr) {
                console.warn('[OneSignal] User login notice:', loginErr);
              }
            }

            // 4. Attach audience tags for role-targeted notifications
            const tagsToSet: Record<string, string> = {
              studentos_web_push: 'enabled',
              role: (userRole || 'student').toLowerCase(),
              ...(extraTags || {})
            };

            try {
              await OneSignal.User.addTags(tagsToSet);
            } catch (tagErr) {
              console.warn('[OneSignal] Tags notice:', tagErr);
            }

            const subscriptionId = OneSignal.User.PushSubscription?.id || undefined;
            const optedIn = Boolean(OneSignal.User.PushSubscription?.optedIn);

            console.log('[OneSignal] Push subscription active:', { subscriptionId, optedIn });

            resolve({
              success: true,
              optedIn: true,
              permission: 'granted',
              subscriptionId
            });
          } else {
            console.warn('[OneSignal] Notification permission was denied or dismissed by user.');
            resolve({
              success: false,
              optedIn: false,
              permission: 'denied',
              error: 'Browser notification permission was not granted.'
            });
          }
        } catch (err: any) {
          console.error('[OneSignal] Exception during enableWebPush:', err);
          resolve({
            success: false,
            optedIn: false,
            error: err.message || 'OneSignal initialization error.'
          });
        }
      });
    } catch (e: any) {
      resolve({ success: false, optedIn: false, error: e.message });
    }
  });
}

/**
 * Opt out of OneSignal Web Push notifications
 */
export async function disableOneSignalWebPush(): Promise<{ success: boolean }> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') return resolve({ success: true });

    try {
      window.OneSignalDeferred = window.OneSignalDeferred || [];
      window.OneSignalDeferred.push(async function (OneSignal: any) {
        try {
          await OneSignal.User.PushSubscription.optOut();
          await OneSignal.User.addTags({ studentos_web_push: 'disabled' });
          console.log('[OneSignal] User opted out of push notifications.');
          resolve({ success: true });
        } catch (err) {
          console.warn('[OneSignal] Error opting out:', err);
          resolve({ success: false });
        }
      });
    } catch (_) {
      resolve({ success: false });
    }
  });
}

/**
 * Get current OneSignal permission and opt-in status
 */
export async function getOneSignalPushStatus(): Promise<{
  supported: boolean;
  permission: 'default' | 'granted' | 'denied';
  optedIn: boolean;
  subscriptionId?: string;
}> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return resolve({
        supported: false,
        permission: 'default',
        optedIn: false
      });
    }

    try {
      window.OneSignalDeferred = window.OneSignalDeferred || [];
      window.OneSignalDeferred.push(async function (OneSignal: any) {
        try {
          const isPerm = await OneSignal.Notifications.permission;
          const permission = isPerm ? 'granted' : Notification.permission === 'denied' ? 'denied' : 'default';
          const optedIn = Boolean(OneSignal.User?.PushSubscription?.optedIn);
          const subscriptionId = OneSignal.User?.PushSubscription?.id || undefined;

          resolve({
            supported: true,
            permission,
            optedIn,
            subscriptionId
          });
        } catch (_) {
          resolve({
            supported: true,
            permission: Notification.permission as any,
            optedIn: false
          });
        }
      });
    } catch (_) {
      resolve({
        supported: true,
        permission: Notification.permission as any,
        optedIn: false
      });
    }
  });
}

/**
 * Synchronize user tags with OneSignal for relevant segment targeting
 */
export async function syncOneSignalUserTags(user: UserProfile): Promise<void> {
  if (typeof window === 'undefined') return;

  try {
    window.OneSignalDeferred = window.OneSignalDeferred || [];
    window.OneSignalDeferred.push(async function (OneSignal: any) {
      try {
        if (user.uid) {
          await OneSignal.login(user.uid);
        }
        await OneSignal.User.addTags({
          role: (user.role || 'student').toLowerCase(),
          house: user.house || 'None',
          grade: user.grade || '10',
          section: user.section || 'A',
          studentos_active: 'true'
        });
      } catch (e) {
        console.warn('[OneSignal] Sync tags notice:', e);
      }
    });
  } catch (_) {}
}
