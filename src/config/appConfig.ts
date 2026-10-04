/**
 * Central configuration for StudentOS Application & APK distribution.
 * Modify this configuration when publishing new APK builds.
 */

export interface AppReleaseInfo {
  version: string;
  versionCode: number;
  releaseDate: string;
  apkFileName: string;
  apkDownloadUrl: string;
  apkSize: string;
  minAndroidVersion: string;
  targetAndroidVersion: string;
  releaseNotes: string[];
}

// Check localStorage override first, then environment variables, then fallback
export const getApkDownloadUrl = (): string => {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const stored = window.localStorage.getItem('s_os_apk_download_url');
      if (stored && stored.trim()) return stored.trim();
    }
  } catch (_) {}

  try {
    const metaEnv = (import.meta as any)?.env;
    if (metaEnv?.VITE_STUDENTOS_APK_URL && metaEnv.VITE_STUDENTOS_APK_URL.trim()) {
      return metaEnv.VITE_STUDENTOS_APK_URL.trim();
    }
  } catch (_) {}

  return '/studentos-v3.12.apk';
};

export const getApkFileName = (): string => {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const stored = window.localStorage.getItem('s_os_apk_file_name');
      if (stored && stored.trim()) return stored.trim();
    }
  } catch (_) {}

  try {
    const metaEnv = (import.meta as any)?.env;
    if (metaEnv?.VITE_STUDENTOS_APK_FILENAME && metaEnv.VITE_STUDENTOS_APK_FILENAME.trim()) {
      return metaEnv.VITE_STUDENTOS_APK_FILENAME.trim();
    }
  } catch (_) {}

  return 'studentos-v3.12.0.apk';
};

/**
 * Syncs the global APK destination from the server (configured by Super Admin)
 */
export async function syncApkConfigFromServer(): Promise<{ apkUrl: string; apkFileName: string; updatedAt?: string; updatedBy?: string } | null> {
  try {
    const res = await fetch('/api/config/apk');
    if (!res.ok) return null;
    const data = await res.json();
    if (data.apkUrl && typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem('s_os_apk_download_url', data.apkUrl);
      if (data.apkFileName) {
        window.localStorage.setItem('s_os_apk_file_name', data.apkFileName);
      }
      window.dispatchEvent(new CustomEvent('s_os_apk_config_updated', {
        detail: { url: data.apkUrl, fileName: data.apkFileName, updatedAt: data.updatedAt, updatedBy: data.updatedBy }
      }));
    }
    return data;
  } catch (err) {
    console.warn('[APK Config] Could not sync from server:', err);
    return null;
  }
}

/**
 * Super Admin only: Publish a new APK destination globally so all users download from this URL
 */
export async function publishGlobalApkConfig(
  url: string,
  fileName: string,
  auth: { isSuperAdmin?: boolean; userRole?: string; updatedBy?: string }
): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    const res = await fetch('/api/config/apk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        apkUrl: url.trim(),
        apkFileName: fileName.trim(),
        isSuperAdmin: auth.isSuperAdmin,
        userRole: auth.userRole,
        updatedBy: auth.updatedBy || 'Super Admin'
      })
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      return { success: false, error: data.error || 'Failed to update APK destination.' };
    }

    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem('s_os_apk_download_url', data.apkUrl);
      window.localStorage.setItem('s_os_apk_file_name', data.apkFileName);
      window.dispatchEvent(new CustomEvent('s_os_apk_config_updated', {
        detail: { url: data.apkUrl, fileName: data.apkFileName, updatedAt: data.updatedAt, updatedBy: data.updatedBy }
      }));
    }

    return { success: true, message: data.message };
  } catch (err: any) {
    return { success: false, error: err.message || 'Network error updating APK destination.' };
  }
}

/**
 * Configure custom APK download destination (can be relative e.g. /my-app.apk or absolute URL)
 */
export function setCustomApkConfig(url: string, fileName?: string): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  if (url && url.trim()) {
    window.localStorage.setItem('s_os_apk_download_url', url.trim());
  } else {
    window.localStorage.removeItem('s_os_apk_download_url');
  }
  if (fileName && fileName.trim()) {
    window.localStorage.setItem('s_os_apk_file_name', fileName.trim());
  } else {
    window.localStorage.removeItem('s_os_apk_file_name');
  }
  window.dispatchEvent(new CustomEvent('s_os_apk_config_updated', {
    detail: { url: getApkDownloadUrl(), fileName: getApkFileName() }
  }));
}

export function resetCustomApkConfig(): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  window.localStorage.removeItem('s_os_apk_download_url');
  window.localStorage.removeItem('s_os_apk_file_name');
  window.dispatchEvent(new CustomEvent('s_os_apk_config_updated', {
    detail: { url: getApkDownloadUrl(), fileName: getApkFileName() }
  }));
}

export const STUDENTOS_APK_URL = getApkDownloadUrl();

export const STUDENTOS_RELEASE_INFO: AppReleaseInfo = {
  version: '3.12.0',
  versionCode: 312,
  releaseDate: 'September 2026',
  apkFileName: 'studentos-v3.12.0.apk',
  get apkDownloadUrl() {
    return getApkDownloadUrl();
  },
  apkSize: '24.8 MB',
  minAndroidVersion: 'Android 8.0 (Oreo) or higher',
  targetAndroidVersion: 'Android 14 (API 34)',
  releaseNotes: [
    'Native Android integration with instant push notifications',
    'Offline study planner and lecture notes caching',
    'High-performance PDF canvas viewer and smart blackboard',
    'Direct access to StudentOS Meet virtual classrooms',
    'Real-time attendance tracker and digital gradebook reports'
  ]
};

export const APK_INSTALLED_STORAGE_KEY = 'studentos_apk_installed';

/**
 * Checks if the user has installed the StudentOS APK
 */
export function isApkInstalledOnDevice(): boolean {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage.getItem(APK_INSTALLED_STORAGE_KEY) === 'true';
    }
  } catch (_) {}
  return false;
}

/**
 * Updates the persistent installed state for the APK
 */
export function markApkInstalledOnDevice(installed: boolean = true): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      if (installed) {
        window.localStorage.setItem(APK_INSTALLED_STORAGE_KEY, 'true');
      } else {
        window.localStorage.removeItem(APK_INSTALLED_STORAGE_KEY);
      }
      window.dispatchEvent(new CustomEvent('studentos_apk_installed_changed', {
        detail: { installed }
      }));
    }
  } catch (_) {}
}

/**
 * Resets the APK installed status so download CTAs reappear
 */
export function resetApkInstalledOnDevice(): void {
  markApkInstalledOnDevice(false);
}

/**
 * Utility helper to detect Android user agent
 */
export function isAndroidDevice(): boolean {
  if (typeof window === 'undefined' || !navigator) return false;
  return /Android/i.test(navigator.userAgent);
}

/**
 * Utility helper to trigger APK download directly
 */
export function triggerApkDownload(): void {
  if (typeof window === 'undefined') return;
  const currentUrl = getApkDownloadUrl();
  const currentFileName = getApkFileName();

  // Mark APK as installed/downloaded
  markApkInstalledOnDevice(true);

  const link = document.createElement('a');
  link.href = currentUrl;
  link.download = currentFileName;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
