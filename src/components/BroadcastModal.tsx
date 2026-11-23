import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Megaphone,
  Send,
  X,
  Filter,
  ShieldAlert,
  Bell,
  Users,
  GraduationCap,
  Shield,
  BookOpen,
  Clock,
  Eye,
  CheckCircle2,
  AlertCircle,
  History,
  ArrowLeft,
  ArrowRight,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import { UserProfile, AppNotification } from '../types';
import { saveAppNotification, generateUUID, getAppNotifications } from '../lib/notifications';
import { buildAuthHeadersForUser } from '../lib/featureAccessService';
import { supabase } from '../lib/supabase';
import { soundService } from '../lib/soundService';
import { MOTION_EASE, MOTION_DURATION, useReducedMotionPreference } from '../lib/motionSystem';
import { AnimatedSkeleton } from './ui/animatedComponents';

interface BroadcastModalProps {
  currentUser: UserProfile | null;
  effectiveRole?: string;
  isOpen?: boolean;
  onClose: () => void;
  onBroadcastSent?: () => void;
  showNotification?: (msg: string) => void;
}

type ModalMode = 'compose' | 'history';
type ComposeStep = 'edit' | 'preview' | 'sent';
type PriorityLevel = 'normal' | 'urgent' | 'emergency';
type CategoryType = 'announcement' | 'homework' | 'exam' | 'reminder' | 'notice';
type AudienceType = 'all' | 'student' | 'faculty' | 'admin';

interface SentBroadcastSummary {
  id: string;
  title: string;
  message: string;
  priority: PriorityLevel;
  category: CategoryType;
  audienceLabel: string;
  cohortLabel: string;
  ttlHours: number;
  createdAt: string;
  targetRoleAudience: AudienceType;
  targetGrade: string;
  targetSection: string;
  targetSubject: string;
}

export const BroadcastModal: React.FC<BroadcastModalProps> = ({
  currentUser,
  effectiveRole,
  isOpen = true,
  onClose,
  onBroadcastSent,
  showNotification,
}) => {
  const prefersReduced = useReducedMotionPreference();
  const role = effectiveRole || currentUser?.role || 'student';
  const isPrincipal = role === 'admin' || role === 'super_admin' || role === 'coordinator';
  const isTeacher = role === 'teacher';

  const [mode, setMode] = useState<ModalMode>('compose');
  const [step, setStep] = useState<ComposeStep>('edit');

  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [priority, setPriority] = useState<PriorityLevel>('urgent');
  const [category, setCategory] = useState<CategoryType>('announcement');
  const [targetRoleAudience, setTargetRoleAudience] = useState<AudienceType>('all');
  const [ttlHours, setTtlHours] = useState<number>(72);

  const [targetGrade, setTargetGrade] = useState<string>('All Grades');
  const [targetSection, setTargetSection] = useState<string>('All Sections');
  const [targetSubject, setTargetSubject] = useState<string>('General');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [sentReceipt, setSentReceipt] = useState<SentBroadcastSummary | null>(null);

  const [historyItems, setHistoryItems] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const sessionHistoryKey = `veylentra_sent_broadcasts_${currentUser?.uid || 'staff'}`;

  useEffect(() => {
    if (!isOpen) return;
    setValidationError(null);
    setSubmitError(null);
    if (step === 'sent') {
      setStep('edit');
      setSentReceipt(null);
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isSubmitting) onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, isSubmitting, onClose]);

  useEffect(() => {
    if (!isOpen || mode !== 'history') return;
    let active = true;
    const fetchHistory = async () => {
      setHistoryLoading(true);
      try {
        let localSent: any[] = [];
        try {
          localSent = JSON.parse(sessionStorage.getItem(sessionHistoryKey) || '[]');
        } catch (_) {}

        const fetched = currentUser
          ? await getAppNotifications(currentUser.uid, currentUser.grade, currentUser.section, role)
          : [];

        const broadcastTypes = new Set(['announcement', 'broadcast', 'notice', 'urgent']);
        const filteredRemote = (fetched || []).filter(
          (n: any) => broadcastTypes.has(String(n.type || '').toLowerCase()) || ['urgent', 'high', 'emergency'].includes(String(n.priority || '').toLowerCase())
        );

        const merged = new Map<string, any>();
        for (const item of [...localSent, ...filteredRemote]) {
          if (item?.id && !merged.has(item.id)) {
            merged.set(item.id, item);
          }
        }
        const sorted = Array.from(merged.values()).sort(
          (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
        );
        if (active) setHistoryItems(sorted.slice(0, 20));
      } catch (_) {
        if (active) setHistoryItems([]);
      } finally {
        if (active) setHistoryLoading(false);
      }
    };
    fetchHistory();
    return () => {
      active = false;
    };
  }, [isOpen, mode, currentUser?.uid, currentUser?.grade, currentUser?.section, role, sessionHistoryKey]);

  const audienceMeta: Record<AudienceType, { label: string; desc: string; icon: React.ReactNode }> = {
    all: { label: 'All Campus', desc: 'Students, faculty & staff', icon: <Users className="w-4 h-4" /> },
    student: { label: 'Students', desc: 'Targeted learner cohorts', icon: <GraduationCap className="w-4 h-4" /> },
    faculty: { label: 'Faculty', desc: 'Teachers & coordinators', icon: <BookOpen className="w-4 h-4" /> },
    admin: { label: 'Leadership', desc: 'Admins & super admins', icon: <Shield className="w-4 h-4" /> },
  };

  const priorityMeta: Record<
    PriorityLevel,
    { label: string; badge: string; desc: string; border: string; activeBg: string; icon: React.ReactNode }
  > = {
    normal: {
      label: 'Normal',
      badge: 'Inbox Delivery',
      desc: 'Quietly delivered to recipient inbox',
      border: 'border-sky-500/35',
      activeBg: 'bg-sky-500/15 border-sky-400 text-sky-200',
      icon: <Bell className="w-4 h-4 text-sky-400" />,
    },
    urgent: {
      label: 'Urgent',
      badge: 'Banner + Toast',
      desc: 'Live banner & highlighted notice card',
      border: 'border-amber-500/35',
      activeBg: 'bg-amber-500/15 border-amber-400 text-amber-200',
      icon: <Megaphone className="w-4 h-4 text-amber-400" />,
    },
    emergency: {
      label: 'Emergency',
      badge: 'Priority Alert',
      desc: 'Immediate top-priority campus interrupt',
      border: 'border-rose-500/35',
      activeBg: 'bg-rose-500/15 border-rose-400 text-rose-200',
      icon: <ShieldAlert className="w-4 h-4 text-rose-400" />,
    },
  };

  const cohortSummary = useMemo(() => {
    if (!isTeacher && targetRoleAudience !== 'student') return 'All Sections · Campus-wide';
    const parts = [targetGrade, targetSection];
    if (targetSubject && targetSubject.trim() && targetSubject.trim() !== 'General') {
      parts.push(targetSubject.trim());
    }
    return parts.join(' · ');
  }, [isTeacher, targetRoleAudience, targetGrade, targetSection, targetSubject]);

  const validateDraft = (): boolean => {
    setValidationError(null);
    setSubmitError(null);
    if (title.trim().length < 3) {
      setValidationError('Please provide a clear broadcast title (at least 3 characters).');
      return false;
    }
    if (message.trim().length < 8) {
      setValidationError('Please enter a meaningful broadcast message (at least 8 characters).');
      return false;
    }
    return true;
  };

  const handleContinueToPreview = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateDraft()) return;
    soundService.playButtonClick();
    setStep('preview');
  };

  const handlePublishBroadcast = async () => {
    if (!validateDraft()) return;
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const notifId = generateUUID();
      const targetRoles =
        targetRoleAudience === 'faculty'
          ? ['teacher', 'coordinator']
          : targetRoleAudience === 'admin'
            ? ['admin', 'super_admin']
            : [targetRoleAudience];
      const expiresAt = new Date(Date.now() + ttlHours * 3600 * 1000).toISOString();
      const normalizedGrade = targetGrade !== 'All Grades' ? targetGrade : 'all';
      const normalizedSection = targetSection !== 'All Sections' ? targetSection : 'all';

      let deliveredViaServer = false;
      let serverErrorMsg: string | null = null;

      try {
        const headers = await buildAuthHeadersForUser({
          ...currentUser,
          role: role as any,
        });
        const res = await fetch('/api/notifications/broadcast', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            id: notifId,
            title: title.trim(),
            message: message.trim(),
            type: category === 'notice' ? 'announcement' : category,
            priority,
            targetUserId: 'all',
            targetRole: targetRoles[0],
            targetRoles,
            targetGrade: normalizedGrade,
            targetClass: normalizedGrade,
            targetSection: normalizedSection,
            linkTab: category === 'homework' ? 'homework' : 'notice_viewer',
            ttlHours,
            expiresInHours: ttlHours,
            dedupeKey: `broadcast:${role}:${targetRoleAudience}:${title.trim().toLowerCase().slice(0, 48)}:${Math.floor(Date.now() / 60000)}`,
          }),
        });
        if (res.ok) {
          deliveredViaServer = true;
        } else {
          const errJson = await res.json().catch(() => null);
          serverErrorMsg = errJson?.error || `Broadcast API error (${res.status})`;
        }
      } catch (err: any) {
        serverErrorMsg = err?.message || 'Unable to reach broadcast endpoint';
      }

      const newNotif: AppNotification = {
        id: notifId,
        title: title.trim(),
        message: message.trim(),
        type: category === 'notice' ? 'announcement' : category,
        createdAt: new Date().toISOString(),
        isRead: false,
        targetUserId: 'all',
        targetRole: targetRoles[0] as any,
        targetClass: normalizedGrade,
        targetSection: normalizedSection,
        linkTab: category === 'homework' ? 'homework' : 'notice_viewer',
      };

      if (!deliveredViaServer) {
        const fallbackResult = await saveAppNotification({
          ...newNotif,
          priority,
          targetRoles,
          expiresAt,
        } as any);
        if (!fallbackResult.success) {
          throw new Error(serverErrorMsg || fallbackResult.error || 'Failed to publish broadcast.');
        }
      }

      const broadcastPayload = {
        id: notifId,
        title: title.trim(),
        message: message.trim(),
        senderName: currentUser?.name || (isPrincipal ? 'School Principal' : 'Faculty Coordinator'),
        senderRole: role,
        priority,
        category,
        targetRole: targetRoles[0],
        targetRoles,
        targetGrade,
        targetClass: normalizedGrade,
        targetSection: normalizedSection,
        targetSubject,
        expiresAt,
        createdAt: new Date().toISOString(),
      };

      try {
        await supabase.channel('student-os-public').send({
          type: 'broadcast',
          event: 'principal_live_broadcast',
          payload: broadcastPayload,
        });
      } catch (_) {}

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('studentos-live-broadcast', { detail: broadcastPayload }));
        window.dispatchEvent(new CustomEvent('studentos-notif-state-change'));
      }

      const summary: SentBroadcastSummary = {
        id: notifId,
        title: title.trim(),
        message: message.trim(),
        priority,
        category,
        audienceLabel: audienceMeta[targetRoleAudience].label,
        cohortLabel: cohortSummary,
        ttlHours,
        createdAt: broadcastPayload.createdAt,
        targetRoleAudience,
        targetGrade,
        targetSection,
        targetSubject,
      };

      try {
        const existingLocal = JSON.parse(sessionStorage.getItem(sessionHistoryKey) || '[]');
        sessionStorage.setItem(
          sessionHistoryKey,
          JSON.stringify([broadcastPayload, ...existingLocal].slice(0, 20))
        );
      } catch (_) {}

      soundService.playSuccessSound();
      if (showNotification) {
        showNotification(`Broadcast published to ${audienceMeta[targetRoleAudience].label} (expires in ${ttlHours}h).`);
      }

      setSentReceipt(summary);
      setStep('sent');
      setTitle('');
      setMessage('');
      setIsSubmitting(false);
      if (onBroadcastSent) onBroadcastSent();
    } catch (err: any) {
      console.error('[BROADCAST] Error sending broadcast:', err);
      setSubmitError(err?.message || 'Broadcast failed to deliver. Your draft has been preserved.');
      setIsSubmitting(false);
    }
  };

  const resetComposeForm = () => {
    setValidationError(null);
    setSubmitError(null);
    setSentReceipt(null);
    setStep('edit');
  };

  const handleReuseHistoryItem = (item: any) => {
    soundService.playButtonClick();
    setTitle(item.title || '');
    setMessage(item.message || '');
    const p = String(item.priority || 'urgent').toLowerCase();
    setPriority(p === 'emergency' || p === 'normal' ? p : 'urgent');
    setMode('compose');
    setStep('edit');
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-label="Broadcast Composer"
        >
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: prefersReduced ? 0.08 : 0.18 }}
            onClick={() => !isSubmitting && onClose()}
            className="fixed inset-0 bg-slate-950/75 backdrop-blur-sm cursor-pointer"
          />

          {/* Modal Card */}
          <motion.div
            initial={prefersReduced ? { opacity: 0 } : { opacity: 0, scale: 0.97, y: 12 }}
            animate={prefersReduced ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0 }}
            exit={prefersReduced ? { opacity: 0 } : { opacity: 0, scale: 0.97, y: 10 }}
            transition={{ duration: prefersReduced ? 0.1 : 0.24, ease: MOTION_EASE.easeOutExpo }}
            className="relative z-10 w-full max-w-2xl bg-slate-900 border border-white/10 rounded-3xl shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col"
          >
            {/* Header */}
            <div className="px-5 py-4 border-b border-white/10 bg-slate-950/90 flex flex-wrap items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className="p-2.5 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-400 shrink-0">
                  <Megaphone className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-base sm:text-lg font-display font-bold text-white truncate">
                    {isPrincipal ? 'Institutional Live Broadcast' : 'Faculty Class Broadcast'}
                  </h3>
                  <p className="text-xs text-slate-400 truncate">
                    Role-targeted, expiring alerts with live campus delivery preview
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {/* Mode Switcher */}
                <div className="inline-flex items-center p-1 rounded-xl bg-slate-900 border border-white/10">
                  {(
                    [
                      { id: 'compose', label: 'Compose', icon: Send },
                      { id: 'history', label: 'History', icon: History },
                    ] as const
                  ).map((m) => {
                    const Icon = m.icon;
                    const active = mode === m.id;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => {
                          soundService.playButtonClick();
                          setMode(m.id);
                        }}
                        className={`relative px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                          active ? 'text-white' : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {active && !prefersReduced && (
                          <motion.div
                            layoutId="broadcast-mode-tab"
                            transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                            className="absolute inset-0 rounded-lg bg-indigo-600 shadow-sm"
                          />
                        )}
                        {active && prefersReduced && (
                          <span className="absolute inset-0 rounded-lg bg-indigo-600" />
                        )}
                        <span className="relative z-10 flex items-center gap-1.5">
                          <Icon className="w-3.5 h-3.5" />
                          <span>{m.label}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>

                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={onClose}
                  aria-label="Close broadcast panel"
                  className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white border border-white/10 transition-colors cursor-pointer disabled:opacity-50"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-5">
              <AnimatePresence mode="wait">
                {mode === 'history' ? (
                  <motion.div
                    key="history-view"
                    initial={prefersReduced ? { opacity: 0 } : { opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={prefersReduced ? { opacity: 0 } : { opacity: 0, y: -6 }}
                    transition={{ duration: MOTION_DURATION.fast }}
                    className="space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-sm font-bold text-white">Recent Campus Broadcasts</h4>
                        <p className="text-xs text-slate-400">
                          Re-use an announcement template or inspect active expiry windows
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setMode('compose')}
                        className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 cursor-pointer"
                      >
                        New Broadcast →
                      </button>
                    </div>

                    {historyLoading ? (
                      <div className="space-y-2.5 pt-2">
                        {[1, 2, 3].map((i) => (
                          <div key={i} className="p-4 rounded-2xl bg-slate-950/60 border border-white/5 space-y-2">
                            <AnimatedSkeleton width="40%" height={12} />
                            <AnimatedSkeleton width="85%" height={16} />
                            <AnimatedSkeleton width="100%" height={24} />
                          </div>
                        ))}
                      </div>
                    ) : historyItems.length === 0 ? (
                      <div className="p-8 rounded-2xl border border-white/10 bg-slate-950/40 text-center space-y-2">
                        <Megaphone className="w-8 h-8 text-slate-500 mx-auto" />
                        <p className="text-sm font-semibold text-slate-300">No recent broadcasts found</p>
                        <p className="text-xs text-slate-500">
                          Published campus or cohort broadcasts will appear here for reference.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-2.5">
                        {historyItems.map((item) => {
                          const p = String(item.priority || 'normal').toLowerCase();
                          return (
                            <div
                              key={item.id}
                              className="p-4 rounded-2xl bg-slate-950/70 border border-white/10 hover:border-indigo-500/30 transition-colors space-y-2"
                            >
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="flex items-center gap-2 text-[11px] font-semibold">
                                  <span
                                    className={`uppercase tracking-wider ${
                                      p === 'emergency'
                                        ? 'text-rose-400'
                                        : p === 'urgent' || p === 'high'
                                          ? 'text-amber-400'
                                          : 'text-sky-400'
                                    }`}
                                  >
                                    {p}
                                  </span>
                                  <span className="text-slate-600">·</span>
                                  <span className="text-slate-400 capitalize">
                                    Audience: {item.targetRole || 'all'}
                                  </span>
                                </div>
                                <span className="text-[11px] font-mono tabular-nums text-slate-500">
                                  {item.createdAt
                                    ? new Date(item.createdAt).toLocaleString(undefined, {
                                        month: 'short',
                                        day: 'numeric',
                                        hour: '2-digit',
                                        minute: '2-digit',
                                      })
                                    : 'Recent'}
                                </span>
                              </div>
                              <h5 className="text-sm font-bold text-white">{item.title}</h5>
                              <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">{item.message}</p>
                              <div className="pt-1 flex justify-end">
                                <button
                                  type="button"
                                  onClick={() => handleReuseHistoryItem(item)}
                                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-indigo-600/30 text-indigo-300 border border-white/10 text-[11px] font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                                >
                                  <RotateCcw className="w-3 h-3" />
                                  <span>Use as Template</span>
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </motion.div>
                ) : step === 'sent' && sentReceipt ? (
                  <motion.div
                    key="sent-step"
                    initial={prefersReduced ? { opacity: 0 } : { opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={prefersReduced ? { opacity: 0 } : { opacity: 0 }}
                    transition={{ duration: 0.25, ease: MOTION_EASE.easeOutExpo }}
                    className="py-6 text-center space-y-5"
                  >
                    <div className="w-16 h-16 rounded-2xl bg-emerald-500/15 border border-emerald-500/35 text-emerald-400 flex items-center justify-center mx-auto shadow-lg shadow-emerald-950/40">
                      <CheckCircle2 className="w-8 h-8" />
                    </div>

                    <div className="space-y-1.5 max-w-md mx-auto">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400">
                        Broadcast Delivered
                      </span>
                      <h4 className="text-xl font-display font-bold text-white">{sentReceipt.title}</h4>
                      <p className="text-xs text-slate-400 leading-relaxed">
                        Dispatched via realtime channel and notification inbox for eligible recipients.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-left max-w-lg mx-auto">
                      <div className="p-3 rounded-xl bg-slate-950/70 border border-white/10">
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 block">
                          Audience
                        </span>
                        <span className="text-xs font-bold text-white mt-0.5 block">
                          {sentReceipt.audienceLabel}
                        </span>
                      </div>
                      <div className="p-3 rounded-xl bg-slate-950/70 border border-white/10">
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 block">
                          Priority
                        </span>
                        <span className="text-xs font-bold text-amber-300 capitalize mt-0.5 block">
                          {sentReceipt.priority}
                        </span>
                      </div>
                      <div className="p-3 rounded-xl bg-slate-950/70 border border-white/10">
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 block">
                          Auto-Expiry
                        </span>
                        <span className="text-xs font-bold font-mono tabular-nums text-white mt-0.5 block">
                          {sentReceipt.ttlHours}h window
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                      <button
                        type="button"
                        onClick={resetComposeForm}
                        className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-white/10 transition-colors cursor-pointer"
                      >
                        Send Another Broadcast
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          resetComposeForm();
                          onClose();
                        }}
                        className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-colors cursor-pointer"
                      >
                        Done
                      </button>
                    </div>
                  </motion.div>
                ) : step === 'preview' ? (
                  <motion.div
                    key="preview-step"
                    initial={prefersReduced ? { opacity: 0 } : { opacity: 0, x: 14 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={prefersReduced ? { opacity: 0 } : { opacity: 0, x: -14 }}
                    transition={{ duration: MOTION_DURATION.fast }}
                    className="space-y-5"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-sm font-bold text-white flex items-center gap-2">
                          <Eye className="w-4 h-4 text-indigo-400" />
                          <span>Live Delivery Preview</span>
                        </h4>
                        <p className="text-xs text-slate-400">
                          Verify audience scope and visual presentation before publishing
                        </p>
                      </div>
                      <span className="text-[11px] font-mono tabular-nums text-slate-400">
                        Step 2 of 2
                      </span>
                    </div>

                    {/* Top Banner Preview */}
                    <div className="space-y-2">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                        {priority === 'normal' ? 'Inbox Card Preview' : 'Top Campus Banner Preview'}
                      </span>
                      <div
                        className={`rounded-2xl px-4 py-3 border flex items-center gap-3 ${
                          priority === 'emergency'
                            ? 'bg-gradient-to-r from-rose-900/90 via-rose-800/85 to-slate-900 border-rose-400/50 text-white'
                            : priority === 'urgent'
                              ? 'bg-gradient-to-r from-amber-600 via-orange-600 to-amber-700 border-amber-300/40 text-white'
                              : 'bg-slate-950 border-indigo-500/35 text-slate-100'
                        }`}
                      >
                        <span className="p-1.5 rounded-lg bg-black/25 shrink-0">
                          {priority === 'emergency' ? (
                            <ShieldAlert className="w-4 h-4 text-rose-200" />
                          ) : (
                            <Megaphone className="w-4 h-4 text-amber-200" />
                          )}
                        </span>
                        <div className="min-w-0 text-xs flex-1">
                          <span className="font-black uppercase tracking-wider text-[10px] mr-2 opacity-90">
                            {priority} · {category}
                          </span>
                          <span className="font-bold">{title.trim()}</span>
                          <span className="mx-1.5 opacity-70">—</span>
                          <span className="opacity-90 line-clamp-1">{message.trim()}</span>
                        </div>
                      </div>
                    </div>

                    {/* Full Notice Card Preview */}
                    <div className="p-4 rounded-2xl bg-slate-950/90 border border-white/10 space-y-2.5">
                      <div className="flex items-center justify-between text-[11px] text-slate-400">
                        <span className="font-semibold text-indigo-300">
                          From {currentUser?.name || 'Administrator'} ({role.replace('_', ' ')})
                        </span>
                        <span className="font-mono tabular-nums">Expires in {ttlHours}h</span>
                      </div>
                      <h5 className="text-base font-bold text-white">{title.trim()}</h5>
                      <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap">{message.trim()}</p>
                    </div>

                    {/* Targeting Summary Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                      <div className="p-3 rounded-xl bg-slate-950/60 border border-white/10">
                        <span className="text-[10px] uppercase tracking-wider text-slate-500 block">Target Role</span>
                        <span className="font-bold text-white mt-0.5 block">{audienceMeta[targetRoleAudience].label}</span>
                      </div>
                      <div className="p-3 rounded-xl bg-slate-950/60 border border-white/10">
                        <span className="text-[10px] uppercase tracking-wider text-slate-500 block">Cohort Scope</span>
                        <span className="font-bold text-white mt-0.5 block">{cohortSummary}</span>
                      </div>
                      <div className="p-3 rounded-xl bg-slate-950/60 border border-white/10">
                        <span className="text-[10px] uppercase tracking-wider text-slate-500 block">Delivery Channel</span>
                        <span className="font-bold text-amber-300 mt-0.5 block">
                          {priorityMeta[priority].badge}
                        </span>
                      </div>
                    </div>

                    {submitError && (
                      <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-500/40 text-xs text-rose-200 flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                        <span>{submitError}</span>
                      </div>
                    )}

                    <div className="pt-3 flex items-center justify-between gap-3 border-t border-white/10">
                      <button
                        type="button"
                        disabled={isSubmitting}
                        onClick={() => {
                          soundService.playButtonClick();
                          setStep('edit');
                        }}
                        className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <ArrowLeft className="w-3.5 h-3.5" />
                        <span>Back to Edit</span>
                      </button>

                      <button
                        type="button"
                        disabled={isSubmitting}
                        onClick={handlePublishBroadcast}
                        className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-slate-950 font-black text-xs flex items-center gap-2 shadow-lg shadow-amber-500/20 disabled:opacity-50 transition-all cursor-pointer"
                      >
                        <Send className="w-4 h-4" />
                        <span>{isSubmitting ? 'Publishing Broadcast...' : 'Confirm & Publish Broadcast'}</span>
                      </button>
                    </div>
                  </motion.div>
                ) : (
                  <motion.form
                    key="edit-step"
                    initial={prefersReduced ? { opacity: 0 } : { opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={prefersReduced ? { opacity: 0 } : { opacity: 0, x: 12 }}
                    transition={{ duration: MOTION_DURATION.fast }}
                    onSubmit={handleContinueToPreview}
                    className="space-y-4"
                  >
                    {/* Title Input */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label
                          htmlFor="broadcast-title-input"
                          className="text-xs font-bold uppercase tracking-wider text-slate-300"
                        >
                          Notice Title
                        </label>
                        <span className="text-[11px] font-mono tabular-nums text-slate-500">
                          {title.length}/160
                        </span>
                      </div>
                      <input
                        id="broadcast-title-input"
                        type="text"
                        maxLength={160}
                        placeholder={
                          isPrincipal
                            ? 'e.g. Tomorrow campus assembly at 8:30 AM'
                            : 'e.g. Physics Lab Assignment Due Tomorrow'
                        }
                        value={title}
                        onChange={(e) => {
                          setTitle(e.target.value);
                          if (validationError) setValidationError(null);
                        }}
                        className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-white/10 text-white text-sm focus:outline-none focus:border-indigo-500 placeholder-slate-500"
                      />
                    </div>

                    {/* Priority Selector Cards */}
                    <div>
                      <span className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-2">
                        Priority & Interrupt Level
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                        {(['normal', 'urgent', 'emergency'] as const).map((level) => {
                          const meta = priorityMeta[level];
                          const selected = priority === level;
                          return (
                            <button
                              key={level}
                              type="button"
                              onClick={() => {
                                soundService.playButtonClick();
                                setPriority(level);
                              }}
                              className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                                selected
                                  ? meta.activeBg
                                  : `bg-slate-950/60 border-white/10 text-slate-300 hover:border-white/20`
                              }`}
                            >
                              <div className="flex items-center justify-between gap-1.5">
                                <span className="flex items-center gap-1.5 text-xs font-bold">
                                  {meta.icon}
                                  <span>{meta.label}</span>
                                </span>
                                <span className="text-[10px] font-semibold opacity-80">{meta.badge}</span>
                              </div>
                              <p className="text-[11px] text-slate-400 mt-1 leading-snug">{meta.desc}</p>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Audience Scope Cards */}
                    <div>
                      <span className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-2">
                        Target Audience
                      </span>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {(['all', 'student', 'faculty', 'admin'] as const).map((aud) => {
                          const meta = audienceMeta[aud];
                          const selected = targetRoleAudience === aud;
                          return (
                            <button
                              key={aud}
                              type="button"
                              onClick={() => {
                                soundService.playButtonClick();
                                setTargetRoleAudience(aud);
                              }}
                              className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                                selected
                                  ? 'bg-indigo-600/20 border-indigo-400 text-white'
                                  : 'bg-slate-950/60 border-white/10 text-slate-300 hover:border-white/20'
                              }`}
                            >
                              <div className="flex items-center gap-1.5 text-xs font-bold">
                                <span className={selected ? 'text-indigo-300' : 'text-slate-400'}>
                                  {meta.icon}
                                </span>
                                <span className="truncate">{meta.label}</span>
                              </div>
                              <p className="text-[10px] text-slate-400 mt-0.5 line-clamp-1">{meta.desc}</p>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Category & Auto-Expiry Row */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label
                          htmlFor="broadcast-category-select"
                          className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5"
                        >
                          Category
                        </label>
                        <select
                          id="broadcast-category-select"
                          value={category}
                          onChange={(e) => setCategory(e.target.value as CategoryType)}
                          className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-white/10 text-white text-xs focus:outline-none focus:border-indigo-500"
                        >
                          <option value="announcement">Announcement</option>
                          <option value="homework">Homework / Task</option>
                          <option value="exam">Exam / Test</option>
                          <option value="reminder">Reminder</option>
                          <option value="notice">Faculty Notice</option>
                        </select>
                      </div>

                      <div>
                        <span className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                          Auto-Expiry Window
                        </span>
                        <div className="grid grid-cols-3 gap-1.5 bg-slate-950 p-1 rounded-xl border border-white/10">
                          {[
                            { hours: 24, label: '24h' },
                            { hours: 72, label: '72h' },
                            { hours: 168, label: '7d' },
                          ].map((opt) => (
                            <button
                              key={opt.hours}
                              type="button"
                              onClick={() => setTtlHours(opt.hours)}
                              className={`py-1.5 rounded-lg text-xs font-mono font-bold transition-colors cursor-pointer ${
                                ttlHours === opt.hours
                                  ? 'bg-indigo-600 text-white'
                                  : 'text-slate-400 hover:text-white'
                              }`}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Cohort Filters for Teachers or Student-Targeted Broadcasts */}
                    {(isTeacher || targetRoleAudience === 'student') && (
                      <div className="p-3.5 rounded-2xl bg-slate-950/75 border border-indigo-500/20 space-y-3">
                        <div className="flex items-center justify-between text-xs font-bold text-indigo-300">
                          <span className="flex items-center gap-2">
                            <Filter className="w-4 h-4 text-indigo-400" />
                            <span>Cohort Targeting (Optional)</span>
                          </span>
                          <span className="text-[11px] font-normal text-slate-400">{cohortSummary}</span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                          <div>
                            <label className="block text-[10px] text-slate-400 mb-1">Grade</label>
                            <select
                              value={targetGrade}
                              onChange={(e) => setTargetGrade(e.target.value)}
                              className="w-full px-2.5 py-2 rounded-lg bg-slate-900 border border-white/10 text-white text-xs"
                            >
                              <option value="All Grades">All Grades</option>
                              {Array.from({ length: 12 }, (_, i) => `Grade ${i + 1}`).map((g) => (
                                <option key={g} value={g}>
                                  {g}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="block text-[10px] text-slate-400 mb-1">Section</label>
                            <select
                              value={targetSection}
                              onChange={(e) => setTargetSection(e.target.value)}
                              className="w-full px-2.5 py-2 rounded-lg bg-slate-900 border border-white/10 text-white text-xs"
                            >
                              <option value="All Sections">All Sections</option>
                              <option value="Astra">Section Astra</option>
                              <option value="Elara">Section Elara</option>
                              <option value="Solara">Section Solara</option>
                              <option value="Vega">Section Vega</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-[10px] text-slate-400 mb-1">Subject</label>
                            <input
                              type="text"
                              value={targetSubject}
                              onChange={(e) => setTargetSubject(e.target.value)}
                              placeholder="e.g. Physics"
                              className="w-full px-2.5 py-2 rounded-lg bg-slate-900 border border-white/10 text-white text-xs"
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Message Body */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label
                          htmlFor="broadcast-message-input"
                          className="text-xs font-bold uppercase tracking-wider text-slate-300"
                        >
                          Broadcast Content
                        </label>
                        <span className="text-[11px] font-mono tabular-nums text-slate-500">
                          {message.length}/2000
                        </span>
                      </div>
                      <textarea
                        id="broadcast-message-input"
                        rows={4}
                        maxLength={2000}
                        placeholder="Write clear instructions, venue, time, or action required..."
                        value={message}
                        onChange={(e) => {
                          setMessage(e.target.value);
                          if (validationError) setValidationError(null);
                        }}
                        className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-white/10 text-white text-sm focus:outline-none focus:border-indigo-500 placeholder-slate-500 resize-none"
                      />
                    </div>

                    {validationError && (
                      <div className="p-3 rounded-xl bg-amber-950/60 border border-amber-500/35 text-xs text-amber-200 flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                        <span>{validationError}</span>
                      </div>
                    )}

                    <div className="pt-3 flex flex-wrap items-center justify-between gap-3 border-t border-white/10">
                      <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-slate-500" />
                        <span>
                          Delivering to <strong className="text-slate-200">{audienceMeta[targetRoleAudience].label}</strong>
                        </span>
                      </div>

                      <div className="flex items-center gap-2.5">
                        <button
                          type="button"
                          onClick={onClose}
                          className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs transition-colors cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-2 shadow-md transition-colors cursor-pointer"
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>Review & Preview</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </motion.form>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
