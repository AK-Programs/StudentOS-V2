/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Centralized StudentOS App Environment & Platform Detection
 * 
 * Accurately distinguishes:
 * - WEBSITE: Standard browser tab/window
 * - PWA: Installed Progressive Web App running in standalone/minimal-ui/fullscreen mode
 * - APK: Native Android wrapper/WebView exposing deterministic native bridge signals
 * - UNKNOWN: Indeterminate environments
 * 
 * Separately tracks:
 * - isPWARunning: Running in standalone display mode
 * - isPWAInstalled: Persistent installation confirmation
 * - canInstallPWA: Platform capability
 * - isInstallPromptAvailable: beforeinstallprompt event captured and ready
 */

import React, { useState, useEffect } from 'react';

export type AppEnvironmentType = 'web' | 'pwa' | 'apk' | 'unknown';
export type DisplayMode = 'browser' | 'standalone' | 'fullscreen' | 'minimal-ui';

export interface CentralizedAppEnvironment {
  environment: AppEnvironmentType;
  platform: 'web' | 'pwa' | 'android-app'; // Backward compatibility
  isWeb: boolean;
  isPWA: boolean;
  isAPK: boolean;
  isInstalledApp: boolean;
  isPWARunning: boolean;
  isPWAInstalled: boolean;
  canInstallPWA: boolean;
  isInstallPromptAvailable: boolean;
  displayMode: DisplayMode;
  badgeLabel: string;
  badgeVariant: 'default' | 'success' | 'indigo' | 'warning';
  details: string;
}

// Global reference for deferred install prompt
let deferredInstallPrompt: any = null;
const installListeners = new Set<() => void>();

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e: Event) => {
    // Prevent the mini-infobar from appearing on mobile
    e.preventDefault();
    deferredInstallPrompt = e;
    installListeners.forEach(fn => fn());
  });

  window.addEventListener('appinstalled', () => {
    deferredInstallPrompt = null;
    try {
      localStorage.setItem('studentos_pwa_installed', 'true');
    } catch (_) {}
    installListeners.forEach(fn => fn());
  });
}

/**
 * Prompt the user to install the PWA if the prompt is available.
 */
export async function promptPWAInstall(): Promise<{ outcome: 'accepted' | 'dismissed' | 'unavailable' }> {
  if (!deferredInstallPrompt) {
    return { outcome: 'unavailable' };
  }

  try {
    const promptEvent = deferredInstallPrompt;
    promptEvent.prompt();
    const { outcome } = await promptEvent.userChoice;
    if (outcome === 'accepted') {
      try {
        localStorage.setItem('studentos_pwa_installed', 'true');
      } catch (_) {}
    }
    deferredInstallPrompt = null;
    installListeners.forEach(fn => fn());
    return { outcome };
  } catch (err) {
    console.warn('[AppEnvironment] Error triggering install prompt:', err);
    return { outcome: 'unavailable' };
  }
}

/**
 * Determines whether the app is currently running in a standalone/installed display mode.
 * Evaluates W3C display-mode media queries and iOS standalone navigator property.
 */
export function getDisplayMode(): DisplayMode {
  if (typeof window === 'undefined') return 'browser';

  try {
    if (window.matchMedia('(display-mode: standalone)').matches) return 'standalone';
    if (window.matchMedia('(display-mode: fullscreen)').matches) return 'fullscreen';
    if (window.matchMedia('(display-mode: minimal-ui)').matches) return 'minimal-ui';
    // iOS Safari home-screen shortcut
    if ((navigator as any)?.standalone === true) return 'standalone';
  } catch (err) {
    console.warn('[AppEnvironment] Error checking display-mode media query:', err);
  }

  return 'browser';
}

/**
 * Inspects whether a deterministic native wrapper signal exists.
 * Does NOT falsely treat every Android browser as an APK.
 */
export function isDeterministicNativeSignal(): boolean {
  if (typeof window === 'undefined') return false;

  try {
    const win = window as any;
    // 1. Explicit native JavaScript bridge flags injected by Android/iOS WebView
    if (win.StudentOSNativeApp === true) return true;
    if (typeof win.AndroidInterface !== 'undefined') return true;
    if (typeof win.StudentOSNative !== 'undefined') return true;

    // 2. Explicit User-Agent custom identifier injected by native app wrapper
    const ua = navigator.userAgent || '';
    if (/StudentOSApp|StudentOSNative/i.test(ua)) return true;

    // 3. Android WebView token accompanied by custom package parameter
    if (/wv|\.wv\b/i.test(ua) && typeof document !== 'undefined' && document.referrer?.startsWith('android-app://com.studentos')) {
      return true;
    }
  } catch (_) {}

  return false;
}

/**
 * Accurately determines the current runtime environment.
 */
export function getAppEnvironment(): CentralizedAppEnvironment {
  if (typeof window === 'undefined') {
    return {
      environment: 'web',
      platform: 'web',
      isWeb: true,
      isPWA: false,
      isAPK: false,
      isInstalledApp: false,
      isPWARunning: false,
      isPWAInstalled: false,
      canInstallPWA: false,
      isInstallPromptAvailable: false,
      displayMode: 'browser',
      badgeLabel: 'Website (Browser)',
      badgeVariant: 'default',
      details: 'Running inside a standard web browser.'
    };
  }

  const displayMode = getDisplayMode();
  const isPWARunning = displayMode !== 'browser';
  const isAPK = isDeterministicNativeSignal();
  const isInstallPromptAvailable = deferredInstallPrompt !== null;

  let isPWAInstalled = isPWARunning;
  try {
    if (!isPWAInstalled) {
      isPWAInstalled = localStorage.getItem('studentos_pwa_installed') === 'true';
    }
  } catch (_) {}

  const canInstallPWA = typeof window !== 'undefined' && 
    ('serviceWorker' in navigator) && 
    !isPWARunning && 
    !isAPK;

  // 1. Deterministic Native APK / Wrapper
  if (isAPK) {
    return {
      environment: 'apk',
      platform: 'android-app',
      isWeb: false,
      isPWA: false,
      isAPK: true,
      isInstalledApp: true,
      isPWARunning,
      isPWAInstalled: true,
      canInstallPWA: false,
      isInstallPromptAvailable: false,
      displayMode,
      badgeLabel: 'StudentOS App (APK)',
      badgeVariant: 'success',
      details: 'Running inside the native StudentOS Android/iOS application shell.'
    };
  }

  // 2. Installed Progressive Web App (Standalone / Minimal-UI / Fullscreen)
  if (isPWARunning) {
    return {
      environment: 'pwa',
      platform: 'pwa',
      isWeb: false,
      isPWA: true,
      isAPK: false,
      isInstalledApp: true,
      isPWARunning: true,
      isPWAInstalled: true,
      canInstallPWA: false,
      isInstallPromptAvailable: false,
      displayMode,
      badgeLabel: 'Installed PWA',
      badgeVariant: 'indigo',
      details: `Installed Progressive Web App running in ${displayMode} mode without browser chrome.`
    };
  }

  // 3. Regular browser website
  return {
    environment: 'web',
    platform: 'web',
    isWeb: true,
    isPWA: false,
    isAPK: false,
    isInstalledApp: false,
    isPWARunning: false,
    isPWAInstalled,
    canInstallPWA,
    isInstallPromptAvailable,
    displayMode: 'browser',
    badgeLabel: 'Website (Browser)',
    badgeVariant: 'default',
    details: 'Accessible directly through standard web browser navigation.'
  };
}

/**
 * React hook that continuously reflects environment changes (e.g. prompt available, app installed).
 */
export function useAppEnvironment(): CentralizedAppEnvironment {
  const [env, setEnv] = useState<CentralizedAppEnvironment>(() => getAppEnvironment());

  useEffect(() => {
    const update = () => setEnv(getAppEnvironment());

    // Listen for display mode media query changes
    try {
      const matchStandalone = window.matchMedia('(display-mode: standalone)');
      const matchMinimalUi = window.matchMedia('(display-mode: minimal-ui)');
      const matchFullscreen = window.matchMedia('(display-mode: fullscreen)');

      if (matchStandalone.addEventListener) {
        matchStandalone.addEventListener('change', update);
        matchMinimalUi.addEventListener('change', update);
        matchFullscreen.addEventListener('change', update);
      } else if ((matchStandalone as any).addListener) {
        (matchStandalone as any).addListener(update);
        (matchMinimalUi as any).addListener(update);
        (matchFullscreen as any).addListener(update);
      }
    } catch (_) {}

    window.addEventListener('appinstalled', update);
    installListeners.add(update);

    return () => {
      try {
        const matchStandalone = window.matchMedia('(display-mode: standalone)');
        const matchMinimalUi = window.matchMedia('(display-mode: minimal-ui)');
        const matchFullscreen = window.matchMedia('(display-mode: fullscreen)');

        if (matchStandalone.removeEventListener) {
          matchStandalone.removeEventListener('change', update);
          matchMinimalUi.removeEventListener('change', update);
          matchFullscreen.removeEventListener('change', update);
        } else if ((matchStandalone as any).removeListener) {
          (matchStandalone as any).removeListener(update);
          (matchMinimalUi as any).removeListener(update);
          (matchFullscreen as any).removeListener(update);
        }
      } catch (_) {}

      window.removeEventListener('appinstalled', update);
      installListeners.delete(update);
    };
  }, []);

  return env;
}

