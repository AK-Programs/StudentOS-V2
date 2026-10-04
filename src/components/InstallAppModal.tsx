import React, { useState, useEffect } from 'react';
import { Download, Smartphone, CheckCircle, AlertCircle, Sparkles, X, Shield, ArrowRight, ExternalLink, QrCode, Settings, RotateCcw, Link as LinkIcon, Check, Lock } from 'lucide-react';
import { 
  STUDENTOS_RELEASE_INFO, 
  isAndroidDevice, 
  triggerApkDownload, 
  getApkDownloadUrl, 
  getApkFileName, 
  setCustomApkConfig, 
  resetCustomApkConfig,
  syncApkConfigFromServer,
  publishGlobalApkConfig,
  isApkInstalledOnDevice,
  markApkInstalledOnDevice,
  resetApkInstalledOnDevice
} from '../config/appConfig';

interface InstallAppModalProps {
  isOpen: boolean;
  onClose: () => void;
  isSuperAdmin?: boolean;
  effectiveRole?: string;
  currentUserName?: string;
}

export function InstallAppModal({ 
  isOpen, 
  onClose,
  isSuperAdmin = false,
  effectiveRole = 'student',
  currentUserName = 'Super Admin'
}: InstallAppModalProps) {
  const [downloading, setDownloading] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const [isInstalled, setIsInstalled] = useState(() => isApkInstalledOnDevice());
  const [showConfig, setShowConfig] = useState(false);
  const [currentUrl, setCurrentUrl] = useState(() => getApkDownloadUrl());
  const [currentFileName, setCurrentFileName] = useState(() => getApkFileName());
  const [inputUrl, setInputUrl] = useState(() => getApkDownloadUrl());
  const [inputFileName, setInputFileName] = useState(() => getApkFileName());
  const [savedFeedback, setSavedFeedback] = useState<string | null>(null);
  const [saveLoading, setSaveLoading] = useState(false);

  const isAndroid = isAndroidDevice();
  const canConfigure = Boolean(isSuperAdmin || effectiveRole === 'super_admin' || effectiveRole === 'admin');

  useEffect(() => {
    // Sync latest authoritative destination set by Super Admin on the server
    syncApkConfigFromServer().then(data => {
      if (data) {
        setCurrentUrl(data.apkUrl);
        setCurrentFileName(data.apkFileName);
        setInputUrl(data.apkUrl);
        setInputFileName(data.apkFileName);
      }
    });

    const handleUpdate = () => {
      const url = getApkDownloadUrl();
      const fn = getApkFileName();
      setCurrentUrl(url);
      setCurrentFileName(fn);
      setInputUrl(url);
      setInputFileName(fn);
    };

    const handleInstallChanged = (e: any) => {
      setIsInstalled(Boolean(e.detail?.installed));
    };

    window.addEventListener('s_os_apk_config_updated', handleUpdate);
    window.addEventListener('studentos_apk_installed_changed', handleInstallChanged);
    return () => {
      window.removeEventListener('s_os_apk_config_updated', handleUpdate);
      window.removeEventListener('studentos_apk_installed_changed', handleInstallChanged);
    };
  }, []);

  if (!isOpen) return null;

  const handleDownload = () => {
    setDownloading(true);
    triggerApkDownload();
    markApkInstalledOnDevice(true);
    setIsInstalled(true);
    setTimeout(() => {
      setDownloading(false);
      setDownloaded(true);
    }, 1500);
  };

  const handleToggleInstalledState = () => {
    const next = !isInstalled;
    markApkInstalledOnDevice(next);
    setIsInstalled(next);
  };

  const handleSaveDestination = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canConfigure) return;

    setSaveLoading(true);
    const result = await publishGlobalApkConfig(inputUrl, inputFileName, {
      isSuperAdmin,
      userRole: effectiveRole,
      updatedBy: currentUserName
    });
    setSaveLoading(false);

    if (result.success) {
      setSavedFeedback('✓ Published! All students and teachers will now download from this destination.');
      setTimeout(() => setSavedFeedback(null), 4000);
    } else {
      setSavedFeedback(`⚠️ ${result.error || 'Failed to publish destination'}`);
      setTimeout(() => setSavedFeedback(null), 4000);
    }
  };

  const handleResetDestination = async () => {
    if (!canConfigure) return;
    setSaveLoading(true);
    await publishGlobalApkConfig('/studentos-v3.12.apk', 'studentos-v3.12.0.apk', {
      isSuperAdmin,
      userRole: effectiveRole,
      updatedBy: currentUserName
    });
    resetCustomApkConfig();
    setSaveLoading(false);
    setSavedFeedback('✓ Reset to default canonical APK destination.');
    setTimeout(() => setSavedFeedback(null), 3000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-xl bg-slate-900 border border-white/10 rounded-3xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header with decorative badge */}
        <div className="relative p-6 pb-4 bg-gradient-to-r from-indigo-900/60 via-slate-900 to-emerald-950/40 border-b border-white/10">
          <button
            onClick={onClose}
            className="absolute top-5 right-5 p-2 rounded-xl text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 transition-all active:scale-95"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/20 text-white">
              <Smartphone className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xl font-black text-white tracking-tight">StudentOS Android App</h3>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  {STUDENTOS_RELEASE_INFO.version}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Full-featured native experience for student & faculty devices
              </p>
            </div>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-6 overflow-y-auto scrollbar-thin scrollbar-thumb-white/10">
          {/* Device banner */}
          <div className={`p-4 rounded-2xl border ${isAndroid ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-indigo-500/10 border-indigo-500/30'} flex items-start gap-3`}>
            {isAndroid ? (
              <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            ) : (
              <Smartphone className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
            )}
            <div className="text-xs">
              <p className="font-bold text-white">
                {isAndroid ? 'Android Device Detected' : 'Android Package (APK)'}
              </p>
              <p className="text-slate-300 mt-0.5 leading-relaxed">
                {isAndroid
                  ? 'You are browsing on an Android device. Tap the download button below to install the APK directly onto your device.'
                  : 'This APK is tailored for Android smartphones & tablets. You can download it directly here or transfer it to an Android device.'}
              </p>
            </div>
          </div>

          {/* Quick Specifications */}
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3 bg-slate-950/60 border border-white/5 rounded-xl text-center">
              <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">File Size</span>
              <span className="text-sm font-black text-white mt-1 block">{STUDENTOS_RELEASE_INFO.apkSize}</span>
            </div>
            <div className="p-3 bg-slate-950/60 border border-white/5 rounded-xl text-center">
              <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">Target OS</span>
              <span className="text-sm font-black text-emerald-400 mt-1 block">Android 8.0+</span>
            </div>
            <div className="p-3 bg-slate-950/60 border border-white/5 rounded-xl text-center">
              <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">Security</span>
              <span className="text-sm font-black text-indigo-400 mt-1 block flex items-center justify-center gap-1">
                <Shield className="w-3.5 h-3.5" /> Verified
              </span>
            </div>
          </div>

          {/* Primary Action Button & Installed Status */}
          <div className="space-y-2.5">
            {isInstalled && (
              <div className="p-3 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-emerald-300 text-xs font-bold">
                  <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>StudentOS is marked as installed on this device</span>
                </div>
                <button
                  type="button"
                  onClick={handleToggleInstalledState}
                  className="text-[10px] text-slate-400 hover:text-white underline cursor-pointer"
                  title="Click to reset installation status"
                >
                  Reset status
                </button>
              </div>
            )}

            <button
              onClick={handleDownload}
              disabled={downloading}
              className={`w-full py-4 px-6 rounded-2xl font-black text-sm tracking-wide shadow-lg active:scale-[0.98] transition-all flex items-center justify-center gap-3 disabled:opacity-50 cursor-pointer ${
                isInstalled 
                  ? 'bg-slate-800 hover:bg-slate-700 text-white border border-white/10 shadow-slate-900/40' 
                  : 'bg-gradient-to-r from-emerald-600 to-indigo-600 hover:from-emerald-500 hover:to-indigo-500 text-white shadow-emerald-500/20'
              }`}
            >
              <Download className={`w-5 h-5 ${downloading ? 'animate-bounce' : ''}`} />
              <span>
                {downloading 
                  ? 'Starting APK Download...' 
                  : isInstalled 
                    ? 'Re-download StudentOS APK' 
                    : isAndroid 
                      ? 'Download & Install StudentOS APK' 
                      : 'Download Android APK'}
              </span>
              <span className="text-[11px] font-mono opacity-80">({STUDENTOS_RELEASE_INFO.apkSize})</span>
            </button>
            {downloaded && (
              <p className="text-[11px] text-emerald-400 text-center font-semibold animate-fadeIn">
                ✓ Download initiated! Check your browser downloads folder.
              </p>
            )}
          </div>

          {/* Download Destination Card & Configuration */}
          <div className="p-4 bg-slate-950/70 rounded-2xl border border-white/5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <LinkIcon className="w-3.5 h-3.5 text-indigo-400" />
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-300">Download Target</span>
                {canConfigure ? (
                  <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    Super Admin Controls
                  </span>
                ) : (
                  <span className="text-[9px] font-semibold px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-white/5 flex items-center gap-1">
                    <Lock className="w-2.5 h-2.5" /> Managed by Admin
                  </span>
                )}
              </div>
              
              {canConfigure && (
                <button
                  type="button"
                  onClick={() => setShowConfig(!showConfig)}
                  className="text-[11px] text-amber-400 hover:text-amber-300 font-bold flex items-center gap-1 hover:underline cursor-pointer"
                >
                  <Settings className="w-3 h-3" />
                  <span>{showConfig ? 'Hide Admin Settings' : 'Configure Global Destination'}</span>
                </button>
              )}
            </div>

            <div className="text-xs space-y-1">
              <div className="flex items-center gap-2 text-slate-400 text-[11px]">
                <span className="font-semibold text-slate-300">File:</span>
                <code className="text-emerald-300 font-mono text-[11px] bg-white/5 px-2 py-0.5 rounded">{currentFileName}</code>
              </div>
              <div className="flex items-start gap-2 text-slate-400 text-[11px]">
                <span className="font-semibold text-slate-300 shrink-0">Source URL:</span>
                <code className="text-indigo-300 font-mono text-[11px] bg-white/5 px-2 py-0.5 rounded break-all">{currentUrl}</code>
              </div>
            </div>

            {canConfigure && showConfig && (
              <form onSubmit={handleSaveDestination} className="pt-3 border-t border-white/10 space-y-3 animate-fadeIn">
                <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-300 flex items-start gap-2">
                  <Shield className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
                  <span>
                    <strong>Super Admin Authority:</strong> Modifying this URL updates the APK download destination for <strong>all users</strong> (students, parents, and teachers) across StudentOS.
                  </span>
                </div>

                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                    APK Download URL (Public Link or Local Relative Path):
                  </label>
                  <input
                    type="text"
                    value={inputUrl}
                    onChange={(e) => setInputUrl(e.target.value)}
                    placeholder="e.g. /studentos-v3.12.apk or https://..."
                    className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 font-mono focus:outline-none focus:border-amber-500"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">
                    Accepts Google Drive direct link, Cloudflare R2, AWS S3, Supabase Storage, or server files.
                  </p>
                </div>

                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                    Target File Name on Download:
                  </label>
                  <input
                    type="text"
                    value={inputFileName}
                    onChange={(e) => setInputFileName(e.target.value)}
                    placeholder="studentos-v3.12.0.apk"
                    className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 font-mono focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="submit"
                    disabled={saveLoading}
                    className="flex-1 py-2 px-3 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>{saveLoading ? 'Publishing...' : 'Publish Destination for All Users'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleResetDestination}
                    disabled={saveLoading}
                    className="py-2 px-3 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 font-bold text-xs flex items-center gap-1 transition-all cursor-pointer"
                    title="Reset to default destination"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Reset Default</span>
                  </button>
                </div>

                {savedFeedback && (
                  <p className="text-[11px] text-emerald-400 font-bold animate-fadeIn">
                    {savedFeedback}
                  </p>
                )}
              </form>
            )}
          </div>

          {/* Quick Installation Guide */}
          <div className="space-y-3 bg-slate-950/40 p-4 rounded-2xl border border-white/5">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
              How to Install APK on Android:
            </h4>
            <ol className="space-y-2 text-xs text-slate-300 list-decimal list-inside leading-relaxed">
              <li>Tap <strong className="text-white">Download Android APK</strong> above to save <code className="text-emerald-300 text-[11px]">{STUDENTOS_RELEASE_INFO.apkFileName}</code>.</li>
              <li>When prompted by Android, tap <strong className="text-white">"Open"</strong> or navigate to your Downloads folder.</li>
              <li>If asked, enable <strong className="text-white">"Install from unknown sources"</strong> for your browser in Settings.</li>
              <li>Tap <strong className="text-white">Install</strong> and launch StudentOS directly from your home screen.</li>
            </ol>
          </div>

          {/* Release Highlights */}
          <div className="space-y-2">
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Release Highlights ({STUDENTOS_RELEASE_INFO.releaseDate})</h4>
            <ul className="space-y-1.5 text-xs text-slate-300">
              {STUDENTOS_RELEASE_INFO.releaseNotes.map((note, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="text-emerald-400 text-xs mt-0.5">•</span>
                  <span>{note}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-950/80 border-t border-white/10 flex items-center justify-between text-xs text-slate-400">
          <span>StudentOS Official App &bull; {STUDENTOS_RELEASE_INFO.apkFileName}</span>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-bold text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 transition-all"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

interface AppInstallSectionProps {
  isSuperAdmin?: boolean;
  effectiveRole?: string;
  currentUserName?: string;
}

/**
 * Inline component for settings / about tab
 */
export function AppInstallSection({
  isSuperAdmin = false,
  effectiveRole = 'student',
  currentUserName = 'Super Admin'
}: AppInstallSectionProps) {
  const [downloading, setDownloading] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [currentUrl, setCurrentUrl] = useState(() => getApkDownloadUrl());
  const [currentFileName, setCurrentFileName] = useState(() => getApkFileName());
  const [inputUrl, setInputUrl] = useState(() => getApkDownloadUrl());
  const [inputFileName, setInputFileName] = useState(() => getApkFileName());
  const [savedFeedback, setSavedFeedback] = useState<string | null>(null);
  const [saveLoading, setSaveLoading] = useState(false);
  const [isInstalled, setIsInstalled] = useState(() => isApkInstalledOnDevice());

  const isAndroid = isAndroidDevice();
  const canConfigure = Boolean(isSuperAdmin || effectiveRole === 'super_admin' || effectiveRole === 'admin');

  useEffect(() => {
    // Sync latest authoritative destination from server
    syncApkConfigFromServer().then(data => {
      if (data) {
        setCurrentUrl(data.apkUrl);
        setCurrentFileName(data.apkFileName);
        setInputUrl(data.apkUrl);
        setInputFileName(data.apkFileName);
      }
    });

    const handleConfigUpdate = () => {
      const u = getApkDownloadUrl();
      const f = getApkFileName();
      setCurrentUrl(u);
      setCurrentFileName(f);
      setInputUrl(u);
      setInputFileName(f);
    };

    const handleInstallChanged = (e: any) => {
      setIsInstalled(Boolean(e.detail?.installed));
    };

    window.addEventListener('s_os_apk_config_updated', handleConfigUpdate);
    window.addEventListener('studentos_apk_installed_changed', handleInstallChanged);
    return () => {
      window.removeEventListener('s_os_apk_config_updated', handleConfigUpdate);
      window.removeEventListener('studentos_apk_installed_changed', handleInstallChanged);
    };
  }, []);

  const handleDownload = () => {
    setDownloading(true);
    triggerApkDownload();
    markApkInstalledOnDevice(true);
    setIsInstalled(true);
    setTimeout(() => {
      setDownloading(false);
      setDownloaded(true);
    }, 1500);
  };

  const handleToggleInstalled = () => {
    const next = !isInstalled;
    markApkInstalledOnDevice(next);
    setIsInstalled(next);
  };

  const handleSaveDestination = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canConfigure) return;

    setSaveLoading(true);
    const result = await publishGlobalApkConfig(inputUrl, inputFileName, {
      isSuperAdmin,
      userRole: effectiveRole,
      updatedBy: currentUserName
    });
    setSaveLoading(false);

    if (result.success) {
      setSavedFeedback('✓ Published! Global APK destination updated for all users.');
      setTimeout(() => setSavedFeedback(null), 4000);
    } else {
      setSavedFeedback(`⚠️ ${result.error || 'Failed to update destination.'}`);
      setTimeout(() => setSavedFeedback(null), 4000);
    }
  };

  const handleResetDestination = async () => {
    if (!canConfigure) return;
    setSaveLoading(true);
    await publishGlobalApkConfig('/studentos-v3.12.apk', 'studentos-v3.12.0.apk', {
      isSuperAdmin,
      userRole: effectiveRole,
      updatedBy: currentUserName
    });
    resetCustomApkConfig();
    setSaveLoading(false);
    setSavedFeedback('✓ Reset to canonical default APK destination.');
    setTimeout(() => setSavedFeedback(null), 3000);
  };

  return (
    <div className="p-6 bg-slate-950/60 border border-white/10 rounded-2xl space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center text-white font-black text-xl shadow-lg">
            📱
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-black text-white">StudentOS Android App</h3>
              <span className="px-2 py-0.5 text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-full">
                {STUDENTOS_RELEASE_INFO.version}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Optimized for Android smartphones and tablets &bull; Released {STUDENTOS_RELEASE_INFO.releaseDate}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {isInstalled && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-bold">
              <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
              <span>Installed</span>
              <button
                type="button"
                onClick={handleToggleInstalled}
                className="text-[10px] text-slate-400 hover:text-white underline ml-1 cursor-pointer"
                title="Reset installed indicator"
              >
                (Reset)
              </button>
            </div>
          )}
          {canConfigure && (
            <button
              type="button"
              onClick={() => setShowConfig(!showConfig)}
              className="py-3 px-3.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 hover:text-white border border-amber-500/30 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
              title="Configure Global Destination (Super Admin)"
            >
              <Settings className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden sm:inline">{showConfig ? 'Close Admin' : 'Admin: Set APK Destination'}</span>
            </button>
          )}
          <button
            onClick={handleDownload}
            disabled={downloading}
            className={`py-3 px-5 rounded-xl font-bold text-xs uppercase tracking-wider shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer ${
              isInstalled
                ? 'bg-slate-800 hover:bg-slate-700 text-white border border-white/10 shadow-slate-900/40'
                : 'bg-gradient-to-r from-emerald-600 to-indigo-600 hover:from-emerald-500 hover:to-indigo-500 text-white shadow-emerald-500/20'
            }`}
          >
            <Download className="w-4 h-4" />
            <span>
              {downloading 
                ? 'Downloading...' 
                : isInstalled 
                  ? 'Re-download APK' 
                  : isAndroid 
                    ? 'Download APK' 
                    : 'Download APK'}
            </span>
          </button>
        </div>
      </div>

      {downloaded && (
        <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-400 flex items-center gap-2">
          <CheckCircle className="w-4 h-4 shrink-0" />
          <span>APK download started! Check your downloads folder to install.</span>
        </div>
      )}

      {/* Destination info and configuration */}
      <div className="p-4 bg-slate-900/60 rounded-xl border border-white/5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <LinkIcon className="w-3.5 h-3.5 text-indigo-400" />
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-300">Configured Destination</span>
            {canConfigure ? (
              <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                Super Admin Controls
              </span>
            ) : (
              <span className="text-[9px] font-semibold px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-white/5 flex items-center gap-1">
                <Lock className="w-2.5 h-2.5" /> Managed by Admin
              </span>
            )}
          </div>
          {canConfigure && (
            <button
              type="button"
              onClick={() => setShowConfig(!showConfig)}
              className="text-[11px] text-amber-400 hover:text-amber-300 font-bold hover:underline cursor-pointer"
            >
              {showConfig ? 'Close' : 'Edit Destination'}
            </button>
          )}
        </div>

        <div className="text-xs space-y-1">
          <div className="flex items-center gap-2 text-slate-400 text-[11px]">
            <span className="font-semibold text-slate-300">File:</span>
            <code className="text-emerald-300 font-mono text-[11px] bg-white/5 px-2 py-0.5 rounded">{currentFileName}</code>
          </div>
          <div className="flex items-start gap-2 text-slate-400 text-[11px]">
            <span className="font-semibold text-slate-300 shrink-0">Source URL:</span>
            <code className="text-indigo-300 font-mono text-[11px] bg-white/5 px-2 py-0.5 rounded break-all">{currentUrl}</code>
          </div>
        </div>

        {canConfigure && showConfig && (
          <form onSubmit={handleSaveDestination} className="pt-3 border-t border-white/10 space-y-3 animate-fadeIn">
            <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-300 flex items-start gap-2">
              <Shield className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
              <span>
                <strong>Super Admin Notice:</strong> Changes made here set the official APK download link for all school users.
              </span>
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                Custom APK Download URL (Public or Local Path):
              </label>
              <input
                type="text"
                value={inputUrl}
                onChange={(e) => setInputUrl(e.target.value)}
                placeholder="e.g. /studentos-v3.12.apk or https://..."
                className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 font-mono focus:outline-none focus:border-amber-500"
              />
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                Target File Name on Download:
              </label>
              <input
                type="text"
                value={inputFileName}
                onChange={(e) => setInputFileName(e.target.value)}
                placeholder="studentos-v3.12.0.apk"
                className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 font-mono focus:outline-none focus:border-amber-500"
              />
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button
                type="submit"
                disabled={saveLoading}
                className="flex-1 py-2 px-3 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
              >
                <Check className="w-3.5 h-3.5" />
                <span>{saveLoading ? 'Publishing...' : 'Publish Destination for All Users'}</span>
              </button>
              <button
                type="button"
                onClick={handleResetDestination}
                disabled={saveLoading}
                className="py-2 px-3 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 font-bold text-xs flex items-center gap-1 transition-all cursor-pointer"
                title="Reset to default destination"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset Default</span>
              </button>
            </div>

            {savedFeedback && (
              <p className="text-[11px] text-emerald-400 font-bold animate-fadeIn">
                {savedFeedback}
              </p>
            )}
          </form>
        )}
      </div>

      {/* Specifications */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        <div className="p-3 bg-slate-900/60 rounded-xl border border-white/5">
          <span className="text-slate-400 text-[10px] uppercase font-bold">Package</span>
          <p className="text-white font-mono text-[11px] mt-0.5 truncate">{STUDENTOS_RELEASE_INFO.apkFileName}</p>
        </div>
        <div className="p-3 bg-slate-900/60 rounded-xl border border-white/5">
          <span className="text-slate-400 text-[10px] uppercase font-bold">Size</span>
          <p className="text-white font-bold mt-0.5">{STUDENTOS_RELEASE_INFO.apkSize}</p>
        </div>
        <div className="p-3 bg-slate-900/60 rounded-xl border border-white/5">
          <span className="text-slate-400 text-[10px] uppercase font-bold">Compatibility</span>
          <p className="text-emerald-400 font-bold mt-0.5">Android 8.0+</p>
        </div>
        <div className="p-3 bg-slate-900/60 rounded-xl border border-white/5">
          <span className="text-slate-400 text-[10px] uppercase font-bold">Build Date</span>
          <p className="text-slate-300 font-bold mt-0.5">{STUDENTOS_RELEASE_INFO.releaseDate}</p>
        </div>
      </div>

      {/* Installation Steps */}
      <div className="p-4 bg-slate-900/40 rounded-xl border border-white/5 space-y-2">
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-300">Android Installation Instructions</span>
        <ol className="list-decimal list-inside text-xs text-slate-400 space-y-1">
          <li>Click <strong className="text-slate-200">Download Android APK</strong> to fetch the installer.</li>
          <li>If your phone blocks the download, tap <strong className="text-slate-200">Keep / Download Anyway</strong>.</li>
          <li>Open the downloaded APK and grant permission to install from your browser or file manager.</li>
          <li>Tap <strong className="text-slate-200">Install</strong> to finalize installation.</li>
        </ol>
      </div>

      {/* Release Notes */}
      <div className="space-y-1.5">
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Release Notes</span>
        <ul className="text-xs text-slate-400 space-y-1 list-disc list-inside">
          {STUDENTOS_RELEASE_INFO.releaseNotes.map((note, idx) => (
            <li key={idx}><span className="text-slate-300">{note}</span></li>
          ))}
        </ul>
      </div>
    </div>
  );
}
