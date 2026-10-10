import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Lock, X, Shield, ShieldCheck, ShieldAlert, KeyRound, Clock, EyeOff, Loader2 } from 'lucide-react';

interface SecurityDialogProps {
  isOpen: boolean;
  onClose: () => void;
  isLocked: boolean;
  hasPinConfigured: boolean;
  isLoading: boolean;
  presentationMode: boolean;
  onTogglePresentationMode: () => void;
  autoLockTime: number;
  onChangeAutoLockTime: (minutes: number) => void;
  onOpenPinSetup: () => void;
  onLockWorkspace: () => void;
  isLocking: boolean;
  statusError?: string;
}

export const SecurityDialog: React.FC<SecurityDialogProps> = ({
  isOpen,
  onClose,
  isLocked,
  hasPinConfigured,
  isLoading,
  presentationMode,
  onTogglePresentationMode,
  autoLockTime,
  onChangeAutoLockTime,
  onOpenPinSetup,
  onLockWorkspace,
  isLocking,
  statusError
}) => {
  const dialogRef = useRef<HTMLDivElement>(null);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Prevent background scrolling while open
  useEffect(() => {
    if (!isOpen) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const content = (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="security-dialog-title"
      className="fixed inset-0 z-[160] flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-fadeIn"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-950/80 backdrop-blur-md transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Dialog Card */}
      <div
        ref={dialogRef}
        className="relative w-full max-w-md my-auto bg-slate-900 border border-white/10 rounded-3xl p-5 sm:p-6 shadow-2xl text-slate-100 z-10 space-y-4 max-h-[90vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h3 id="security-dialog-title" className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                Classroom Security Center
              </h3>
              <p className="text-[11px] text-slate-400">Authoritative workspace guard & locks</p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close Security Dialog"
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Error notification if any */}
        {statusError && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-2xl flex items-center gap-2.5 text-xs text-rose-300">
            <ShieldAlert className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{statusError}</span>
          </div>
        )}

        {/* Status Card */}
        <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-white/5 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400 font-medium">Workspace Status:</span>
            {isLoading ? (
              <span className="inline-flex items-center gap-1.5 text-indigo-400 font-bold">
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Verifying...
              </span>
            ) : isLocked ? (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 font-bold">
                <Lock className="w-3 h-3" /> Locked
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-bold">
                <ShieldCheck className="w-3 h-3" /> Active & Protected
              </span>
            )}
          </div>

          <div className="flex items-center justify-between text-xs pt-1 border-t border-white/5">
            <span className="text-slate-400 font-medium">Security PIN:</span>
            <div className="flex items-center gap-2">
              <span className={`font-mono text-[11px] ${hasPinConfigured ? 'text-emerald-400' : 'text-amber-400'}`}>
                {hasPinConfigured ? '●●●● Enforced' : 'Not Configured'}
              </span>
              <button
                onClick={() => {
                  onClose();
                  onOpenPinSetup();
                }}
                className="text-[11px] font-bold text-indigo-400 hover:text-indigo-300 hover:underline inline-flex items-center gap-1"
              >
                <KeyRound className="w-3 h-3" />
                {hasPinConfigured ? 'Change' : 'Set PIN'}
              </button>
            </div>
          </div>
        </div>

        {/* Interactive Controls */}
        <div className="space-y-3 pt-1">
          {/* 1. Lock Workspace Action Button */}
          <button
            type="button"
            disabled={isLocking || isLoading}
            onClick={onLockWorkspace}
            className={`w-full py-3 px-4 rounded-2xl text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-lg cursor-pointer ${
              isLocking
                ? 'bg-rose-900/50 text-rose-200 cursor-not-allowed border border-rose-500/20'
                : 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-600/20 active:scale-[0.98]'
            }`}
          >
            {isLocking ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Enforcing Lock on Server...</span>
              </>
            ) : (
              <>
                <Lock className="w-4 h-4" />
                <span>Lock Workspace Now</span>
              </>
            )}
          </button>

          {/* 2. Presentation Mode Toggle */}
          <div className="flex items-center justify-between gap-3 p-3 bg-white/5 rounded-2xl border border-white/5">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="p-2 rounded-xl bg-teal-500/10 text-teal-400 shrink-0">
                <EyeOff className="w-4 h-4" />
              </div>
              <div className="flex flex-col text-left min-w-0">
                <span className="text-xs font-bold text-white truncate">Presentation Mode</span>
                <span className="text-[10px] text-slate-400">Hide student emails & confidential tabs</span>
              </div>
            </div>
            <button
              type="button"
              onClick={onTogglePresentationMode}
              className={`px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase transition-all shrink-0 cursor-pointer ${
                presentationMode
                  ? 'bg-teal-500 text-slate-950 font-black shadow-md shadow-teal-500/20'
                  : 'bg-white/10 hover:bg-white/15 text-slate-300'
              }`}
            >
              {presentationMode ? 'Active' : 'Enable'}
            </button>
          </div>

          {/* 3. Auto-Lock Duration Selector */}
          <div className="flex items-center justify-between gap-3 p-3 bg-white/5 rounded-2xl border border-white/5">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 shrink-0">
                <Clock className="w-4 h-4" />
              </div>
              <div className="flex flex-col text-left min-w-0">
                <span className="text-xs font-bold text-white truncate">Inactivity Auto-Lock</span>
                <span className="text-[10px] text-slate-400">Lock workspace automatically when idle</span>
              </div>
            </div>
            <select
              value={autoLockTime}
              onChange={(e) => onChangeAutoLockTime(parseInt(e.target.value, 10))}
              className="bg-slate-950 border border-white/10 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-200 outline-none cursor-pointer shrink-0"
            >
              <option value={0}>Disabled</option>
              <option value={5}>5 Minutes</option>
              <option value={10}>10 Minutes</option>
              <option value={15}>15 Minutes</option>
              <option value={30}>30 Minutes</option>
            </select>
          </div>
        </div>

        {/* Footer info */}
        <p className="text-[10px] text-slate-500 text-center uppercase tracking-widest pt-1 font-mono">
          StudentOS Cross-Device Protection Active
        </p>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(content, document.body) : null;
};
