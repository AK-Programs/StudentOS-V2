/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { BellRing, RefreshCw, Send } from 'lucide-react';
import { UserProfile } from '../types';
import {
  requestFCMPermission,
  disableFCMPush,
  getFCMStatus,
  sendTestFCMNotification
} from '../lib/fcmNotifications';
import { saveSupabaseUserProfile } from '../lib/supabaseUsers';
import { soundService } from '../lib/soundService';

interface WebPushNotificationToggleProps {
  currentUser: UserProfile;
  variant?: 'card' | 'compact' | 'settings';
  onUpdateUser?: (updated: UserProfile) => void;
  onProfileUpdated?: (updated: any) => void;
  showNotification?: (message: string) => void;
}

export const WebPushNotificationToggle: React.FC<WebPushNotificationToggleProps> = ({
  currentUser,
  variant = 'card',
  onUpdateUser,
  onProfileUpdated,
  showNotification
}) => {
  const rawData = currentUser?.raw_data || {};
  const [isEnabled, setIsEnabled] = useState<boolean>(() => {
    return Boolean(currentUser?.enableWebPush ?? rawData.enableWebPush ?? false);
  });
  const [loading, setLoading] = useState<boolean>(false);
  const [notice, setNotice] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [fcmStatus, setFcmStatus] = useState<{
    isSupported: boolean;
    permission: NotificationPermission | 'unsupported';
    isEnabled: boolean;
    token: string | null;
    deviceId: string;
  }>({
    isSupported: true,
    permission: 'default',
    isEnabled: false,
    token: null,
    deviceId: 'dev'
  });

  useEffect(() => {
    const status = getFCMStatus();
    setFcmStatus(status);
    if (status.isEnabled) {
      setIsEnabled(true);
    }
  }, []);

  const handleToggle = async (checked: boolean) => {
    if (!currentUser) return;
    setLoading(true);
    setNotice(null);
    soundService.playToggleSound(checked);

    if (checked) {
      setNotice({ text: 'Initializing Firebase Cloud Messaging (FCM) push subscription...', type: 'info' });

      const result = await requestFCMPermission(
        currentUser.uid || currentUser.email,
        {
          role: currentUser.role,
          house: currentUser.house || 'None',
          grade: currentUser.grade || '10',
          section: currentUser.section || 'A'
        }
      );

      if (result.success) {
        setIsEnabled(true);
        setFcmStatus(getFCMStatus());
        soundService.playSuccessSound();
        setNotice({
          text: '✓ Web Push Notifications enabled! Firebase Cloud Messaging will deliver targeted school updates to this device.',
          type: 'success'
        });
        showNotification?.('🔔 Firebase Cloud Messaging (FCM) Notifications enabled!');

        const updatedUser: UserProfile = {
          ...currentUser,
          enableWebPush: true,
          fcmToken: result.token,
          raw_data: {
            ...(currentUser.raw_data || {}),
            enableWebPush: true,
            fcmSubscribed: true,
            fcmToken: result.token
          }
        };

        try {
          await saveSupabaseUserProfile(updatedUser);
          onUpdateUser?.(updatedUser);
          onProfileUpdated?.(updatedUser);
          localStorage.setItem('s_os_user', JSON.stringify(updatedUser));
        } catch (saveErr) {
          console.warn('[WebPushToggle] Error saving subscription preference to Supabase:', saveErr);
        }
      } else {
        setIsEnabled(false);
        setFcmStatus(getFCMStatus());
        setNotice({
          text: result.error || 'Notification permission was denied. Please allow notifications in your browser or device settings.',
          type: 'error'
        });
        showNotification?.('⚠️ Web push permission was not granted by the browser.');
      }
    } else {
      await disableFCMPush(currentUser.uid || currentUser.email);
      setIsEnabled(false);
      setFcmStatus(getFCMStatus());
      setNotice({
        text: 'Web push notifications disabled for this account.',
        type: 'info'
      });
      showNotification?.('Web push notifications disabled.');

      const updatedUser: UserProfile = {
        ...currentUser,
        enableWebPush: false,
        raw_data: {
          ...(currentUser.raw_data || {}),
          enableWebPush: false,
          fcmSubscribed: false
        }
      };

      try {
        await saveSupabaseUserProfile(updatedUser);
        onUpdateUser?.(updatedUser);
        onProfileUpdated?.(updatedUser);
        localStorage.setItem('s_os_user', JSON.stringify(updatedUser));
      } catch (saveErr) {
        console.warn('[WebPushToggle] Error saving push disable preference to Supabase:', saveErr);
      }
    }
    setLoading(false);
  };

  const handleSendTestPush = async () => {
    if (!currentUser) return;
    const res = await sendTestFCMNotification(currentUser.uid || currentUser.email || 'user', currentUser.role);
    if (res.success) {
      showNotification?.('✓ FCM test notification triggered! Check your desktop/device notification tray.');
    } else {
      showNotification?.(`⚠️ ${res.message}`);
    }
  };

  return (
    <div className={`rounded-2xl border transition-all uiverse-card-hover ${
      variant === 'compact'
        ? 'p-4 bg-slate-900/80 border-white/10'
        : 'p-4 sm:p-5 bg-gradient-to-r from-indigo-950/70 via-slate-900 to-purple-950/70 border-indigo-500/30 shadow-xl'
    }`}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5 min-w-0">
          <div className="p-2.5 rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 shrink-0 mt-0.5">
            <BellRing className="w-5 h-5" />
          </div>
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="text-sm font-black text-white tracking-tight">
                Enable Web Push Notifications
              </h4>
              <span className="px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-mono text-[9px] font-black uppercase">
                Firebase FCM
              </span>
              {isEnabled && fcmStatus.permission === 'granted' ? (
                <span className="uiverse-status-badge px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Subscribed & Active
                </span>
              ) : fcmStatus.permission === 'denied' ? (
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                  ⚠️ Permission Blocked
                </span>
              ) : (
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-white/5 text-slate-400 border border-white/10">
                  ○ Inactive
                </span>
              )}
            </div>
            <p className="text-xs text-slate-300 leading-relaxed max-w-xl">
              Receive immediate desktop, Android APK, and PWA alerts via Firebase Cloud Messaging for announcements, assignment deadlines, grade updates, and release notes — even when StudentOS is closed.
            </p>
          </div>
        </div>

        {/* UIverse-inspired Toggle Switch */}
        <div className="flex items-center gap-2.5 shrink-0 self-start sm:self-center">
          {loading && (
            <RefreshCw className="w-4 h-4 text-indigo-400 animate-spin" />
          )}
          <button
            type="button"
            role="switch"
            aria-checked={isEnabled}
            disabled={loading}
            onClick={() => handleToggle(!isEnabled)}
            className={`uiverse-switch relative inline-flex h-7 w-13 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-all duration-200 ease-in-out focus:outline-none disabled:opacity-50 ${
              isEnabled ? 'bg-indigo-600 shadow-[0_0_14px_rgba(99,102,241,0.55)]' : 'bg-slate-800'
            }`}
          >
            <span
              aria-hidden="true"
              className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                isEnabled ? 'translate-x-6' : 'translate-x-0'
              }`}
            />
          </button>
        </div>
      </div>

      {/* Feedback Notice */}
      {notice && (
        <div className={`mt-3 p-3 rounded-xl border text-xs font-semibold animate-fadeIn flex items-center justify-between gap-2 ${
          notice.type === 'success'
            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
            : notice.type === 'error'
              ? 'bg-rose-500/10 border-rose-500/20 text-rose-300'
              : 'bg-indigo-500/10 border-indigo-500/20 text-indigo-300'
        }`}>
          <span>{notice.text}</span>
          <button
            onClick={() => setNotice(null)}
            className="text-slate-400 hover:text-white text-xs font-bold px-1"
          >
            ✕
          </button>
        </div>
      )}

      {/* Targeting Segments & Test Push Button */}
      <div className="mt-3 pt-3 border-t border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] font-black uppercase text-slate-400 font-mono">FCM Targeting:</span>
          <span className="px-2 py-0.5 rounded bg-black/30 border border-white/10 text-indigo-300 font-mono text-[10px] font-bold">
            role: {currentUser?.role || 'student'}
          </span>
          {currentUser?.grade && (
            <span className="px-2 py-0.5 rounded bg-black/30 border border-white/10 text-slate-300 font-mono text-[10px]">
              grade: {currentUser.grade}
            </span>
          )}
          {currentUser?.section && (
            <span className="px-2 py-0.5 rounded bg-black/30 border border-white/10 text-slate-300 font-mono text-[10px]">
              section: {currentUser.section}
            </span>
          )}
          {currentUser?.house && (
            <span className="px-2 py-0.5 rounded bg-black/30 border border-white/10 text-slate-300 font-mono text-[10px]">
              house: {currentUser.house}
            </span>
          )}
        </div>

        {isEnabled && fcmStatus.permission === 'granted' && (
          <button
            type="button"
            onClick={handleSendTestPush}
            className="uiverse-btn-primary px-3 py-1 rounded-lg bg-indigo-600/30 hover:bg-indigo-600 border border-indigo-500/40 text-indigo-200 hover:text-white text-[11px] font-bold transition-all flex items-center gap-1.5 self-start sm:self-auto shrink-0 cursor-pointer"
          >
            <Send className="w-3 h-3" />
            <span>Send FCM Test Alert</span>
          </button>
        )}
      </div>
    </div>
  );
};
