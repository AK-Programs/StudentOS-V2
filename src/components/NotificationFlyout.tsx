import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  BellRing,
  MessageSquare,
  MessageCircle,
  BookOpen,
  Award,
  Megaphone,
  Sparkles,
  X,
  ArrowRight,
} from 'lucide-react';
import { AppNotification } from '../types';
import { soundService } from '../lib/soundService';
import {
  isNotificationPopupEligible,
  markNotificationPopupPresented,
  dismissNotification,
} from '../lib/notifications';
import { useReducedMotionPreference } from '../lib/motionSystem';

interface NotificationFlyoutProps {
  notifications: AppNotification[];
  currentUserId?: string;
  effectiveRole?: string;
  userGrade?: string;
  userSection?: string;
  maxVisible?: number;
  cooldownSeconds?: number;
  onNavigateTab?: (tab: string) => void;
  onMarkAsRead?: (id: string) => void;
  onDismiss?: (id: string) => void;
}

interface ActiveFlyoutItem {
  id: string;
  notification: AppNotification;
  timerId: ReturnType<typeof setTimeout>;
  duration: number;
}

export const NotificationFlyout: React.FC<NotificationFlyoutProps> = ({
  notifications,
  currentUserId,
  effectiveRole = 'student',
  userGrade,
  userSection,
  maxVisible = 1,
  cooldownSeconds = 45,
  onNavigateTab,
  onMarkAsRead,
  onDismiss,
}) => {
  const prefersReduced = useReducedMotionPreference();
  const [activeFlyouts, setActiveFlyouts] = useState<ActiveFlyoutItem[]>([]);
  const [pendingQueue, setPendingQueue] = useState<AppNotification[]>([]);
  const shownIdsRef = useRef<Set<string>>(new Set());
  const baselineCapturedRef = useRef<boolean>(false);
  const activeAccountKeyRef = useRef<string>('');
  const lastFlyoutShownAtRef = useRef<number>(0);

  const accountKey = `${currentUserId || 'guest'}:${effectiveRole || 'student'}`;
  const storageKey = `veylentra_shown_flyouts_v2_${currentUserId || 'guest'}`;
  const safeMaxVisible = Math.max(1, Math.min(3, maxVisible || 1));

  // Clear queues & reset shown set cleanly whenever user account or role switches
  useEffect(() => {
    if (activeAccountKeyRef.current !== accountKey) {
      activeAccountKeyRef.current = accountKey;
      setActiveFlyouts((prev) => {
        prev.forEach((item) => clearTimeout(item.timerId));
        return [];
      });
      setPendingQueue([]);
      shownIdsRef.current = new Set();
      baselineCapturedRef.current = false;
      lastFlyoutShownAtRef.current = 0;

      if (currentUserId && typeof window !== 'undefined') {
        try {
          const stored = sessionStorage.getItem(storageKey);
          if (stored) {
            const parsed = JSON.parse(stored);
            if (Array.isArray(parsed)) {
              parsed.forEach((id: string) => shownIdsRef.current.add(id));
            }
          }
        } catch (_) {}
      }
    }
  }, [accountKey, currentUserId, storageKey]);

  const saveShownIds = () => {
    if (typeof window === 'undefined' || !currentUserId) return;
    try {
      const arr = Array.from(shownIdsRef.current).slice(-500);
      sessionStorage.setItem(storageKey, JSON.stringify(arr));
    } catch (_) {}
  };

  const dismissFlyout = (id: string, persistUserDismissal = false) => {
    setActiveFlyouts((prev) => {
      const item = prev.find((f) => f.id === id);
      if (item) clearTimeout(item.timerId);
      return prev.filter((f) => f.id !== id);
    });
    if (persistUserDismissal) {
      if (onDismiss) onDismiss(id);
      else dismissNotification(id, currentUserId).catch(() => {});
    }
  };

  // Remove read/dismissed notifications from queues immediately
  useEffect(() => {
    if (!Array.isArray(notifications)) return;
    const readIds = new Set(
      notifications.filter((n: any) => n.isRead || n.isDismissed).map((n) => n.id)
    );
    if (readIds.size === 0) return;

    setPendingQueue((prev) => prev.filter((n) => !readIds.has(n.id)));
    setActiveFlyouts((prev) => {
      const toRemove = prev.filter((item) => readIds.has(item.id));
      toRemove.forEach((item) => clearTimeout(item.timerId));
      return prev.filter((item) => !readIds.has(item.id));
    });
  }, [notifications]);

  // Process notifications with baseline capture (blocks historical replay on page load / login / reload)
  useEffect(() => {
    if (!currentUserId || !Array.isArray(notifications) || notifications.length === 0) return;

    const userContext = {
      uid: currentUserId,
      role: effectiveRole,
      grade: userGrade,
      section: userSection,
    };

    // On first hydration after mount/account switch, silently seed existing older notifications
    // Only allow genuinely fresh notifications created within the last 10 minutes that have not been presented yet
    const nowMs = Date.now();
    if (!baselineCapturedRef.current) {
      baselineCapturedRef.current = true;
      const freshLiveCandidates: AppNotification[] = [];
      for (const n of notifications) {
        const createdMs = new Date(n.createdAt || 0).getTime();
        const isJustCreated = Number.isFinite(createdMs) && nowMs - createdMs <= 10 * 60 * 1000;
        const eligible = isNotificationPopupEligible(n, userContext, { nowMs });
        if (eligible && isJustCreated && !shownIdsRef.current.has(n.id)) {
          freshLiveCandidates.push(n);
        }
        shownIdsRef.current.add(n.id);
      }
      saveShownIds();
      if (freshLiveCandidates.length === 0) return;

      const newestOnly = freshLiveCandidates
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, safeMaxVisible);
      setPendingQueue(newestOnly);
      return;
    }

    const eligibleNew = notifications.filter((n) => {
      if (shownIdsRef.current.has(n.id)) return false;
      return isNotificationPopupEligible(n, userContext, { nowMs });
    });

    if (eligibleNew.length === 0) return;

    const priorityMap: Record<string, number> = {
      emergency: 11,
      announcement: 10,
      urgent: 10,
      exam: 9,
      notice: 8,
      chat: 7,
      mention: 7,
      homework: 6,
      assignment: 6,
      marks: 5,
      attendance: 4,
      feedback: 4,
      ai_task: 3,
      reminder: 2,
    };

    const sortedNew = [...eligibleNew].sort((a, b) => {
      const pA = priorityMap[String((a as any).priority || a.type)] || 0;
      const pB = priorityMap[String((b as any).priority || b.type)] || 0;
      if (pA !== pB) return pB - pA;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    setPendingQueue((prev) => {
      const existingIds = new Set(prev.map((p) => p.id));
      const uniqueNew = sortedNew.filter((n) => !existingIds.has(n.id));
      return [...prev, ...uniqueNew].slice(0, 5);
    });

    eligibleNew.forEach((n) => shownIdsRef.current.add(n.id));
    saveShownIds();
  }, [notifications, currentUserId, effectiveRole, userGrade, userSection, safeMaxVisible]);

  // Throttle active flyout emission: max N visible, cooldown between non-emergency items
  useEffect(() => {
    if (pendingQueue.length === 0 || activeFlyouts.length >= safeMaxVisible) return;

    const nowMs = Date.now();
    const cooldownMs = Math.max(5, cooldownSeconds) * 1000;
    const head = pendingQueue[0];
    const isUrgentHead =
      String((head as any).priority || '').toLowerCase() === 'emergency' ||
      String((head as any).priority || '').toLowerCase() === 'urgent';

    if (
      lastFlyoutShownAtRef.current > 0 &&
      !isUrgentHead &&
      nowMs - lastFlyoutShownAtRef.current < cooldownMs
    ) {
      const waitTimer = setTimeout(() => {
        setPendingQueue((q) => [...q]);
      }, Math.max(500, cooldownMs - (nowMs - lastFlyoutShownAtRef.current)));
      return () => clearTimeout(waitTimer);
    }

    const nextBatch = pendingQueue.slice(0, Math.max(1, safeMaxVisible - activeFlyouts.length));
    const remainingQueue = pendingQueue.slice(nextBatch.length);
    lastFlyoutShownAtRef.current = nowMs;

    const presentedIds: string[] = [];
    nextBatch.forEach((n) => {
      presentedIds.push(n.id);
      const lowerTitle = (n.title || '').toLowerCase();
      const lowerMsg = (n.message || '').toLowerCase();

      if (n.type === 'chat' && (lowerTitle.includes('server') || lowerTitle.includes('channel') || lowerMsg.includes('server'))) {
        soundService.playServerMessageSound();
      } else if (n.type === 'chat' || n.type === 'mention' || lowerTitle.includes('dm') || lowerTitle.includes('direct')) {
        soundService.playDirectMessageSound();
      } else {
        soundService.playNewNotification();
      }

      let duration = 5500;
      if (n.type === 'announcement' || n.type === 'exam' || n.type === 'notice') duration = 7500;
      else if (n.type === 'chat' || n.type === 'mention') duration = 6000;

      const timerId = setTimeout(() => {
        dismissFlyout(n.id, false);
      }, duration);

      setActiveFlyouts((prev) => [...prev, { id: n.id, notification: n, timerId, duration }]);
    });

    if (presentedIds.length > 0 && currentUserId) {
      markNotificationPopupPresented(presentedIds, currentUserId).catch(() => {});
    }

    setPendingQueue(remainingQueue);
  }, [pendingQueue, activeFlyouts.length, safeMaxVisible, cooldownSeconds, currentUserId]);

  if (activeFlyouts.length === 0) return null;

  const getCategoryMeta = (n: AppNotification) => {
    switch (n.type) {
      case 'chat': {
        const isServer = (n.title || '').toLowerCase().includes('server') || (n.title || '').toLowerCase().includes('channel');
        return {
          icon: isServer ? <MessageSquare className="w-4 h-4 text-emerald-400" /> : <MessageCircle className="w-4 h-4 text-cyan-400" />,
          color: isServer ? 'border-emerald-500/30 bg-emerald-950/40 text-emerald-300' : 'border-cyan-500/30 bg-cyan-950/40 text-cyan-300',
          badge: isServer ? 'Server Chat' : 'Direct Message',
        };
      }
      case 'homework':
      case 'assignment':
        return {
          icon: <BookOpen className="w-4 h-4 text-purple-400" />,
          color: 'border-purple-500/30 bg-purple-950/40 text-purple-300',
          badge: 'Assignment',
        };
      case 'exam':
      case 'marks':
        return {
          icon: <Award className="w-4 h-4 text-amber-400" />,
          color: 'border-amber-500/30 bg-amber-950/40 text-amber-300',
          badge: 'Academic',
        };
      case 'announcement':
        return {
          icon: <Megaphone className="w-4 h-4 text-rose-400" />,
          color: 'border-rose-500/30 bg-rose-950/40 text-rose-300',
          badge: 'Announcement',
        };
      case 'ai_task':
        return {
          icon: <Sparkles className="w-4 h-4 text-yellow-300" />,
          color: 'border-yellow-500/30 bg-yellow-950/40 text-yellow-300',
          badge: 'AI Update',
        };
      default:
        return {
          icon: <BellRing className="w-4 h-4 text-indigo-400" />,
          color: 'border-indigo-500/30 bg-indigo-950/40 text-indigo-300',
          badge: 'Notification',
        };
    }
  };

  return (
    <div
      className="fixed top-16 right-4 sm:right-6 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none"
      aria-live="polite"
    >
      <AnimatePresence mode="popLayout">
        {activeFlyouts.map(({ id, notification: n, duration }) => {
          const meta = getCategoryMeta(n);

          return (
            <motion.div
              key={id}
              layout={!prefersReduced}
              initial={prefersReduced ? { opacity: 0 } : { opacity: 0, scale: 0.92, y: -12, x: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0, x: 0 }}
              exit={prefersReduced ? { opacity: 0 } : { opacity: 0, scale: 0.92, x: 40, transition: { duration: 0.2 } }}
              transition={{ duration: prefersReduced ? 0.1 : 0.25 }}
              className="pointer-events-auto group relative overflow-hidden rounded-2xl bg-slate-900/95 border border-white/10 shadow-2xl backdrop-blur-xl hover:border-indigo-500/40 transition-all cursor-pointer"
              onClick={() => {
                if (onMarkAsRead) onMarkAsRead(n.id);
                if (n.linkTab && onNavigateTab) {
                  onNavigateTab(n.linkTab);
                } else if (onNavigateTab && n.type === 'chat') {
                  onNavigateTab('chat');
                }
                dismissFlyout(id, false);
              }}
            >
              <div className="h-1 w-full bg-gradient-to-r from-indigo-500 via-purple-500 to-sky-500" />

              <div className="p-3.5 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="p-1.5 rounded-xl bg-slate-950 border border-white/10 shrink-0">
                      {meta.icon}
                    </div>
                    <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md border ${meta.color}`}>
                      {meta.badge}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (onMarkAsRead) onMarkAsRead(n.id);
                      dismissFlyout(id, true);
                    }}
                    className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                    title="Dismiss"
                    aria-label="Dismiss notification"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="space-y-1">
                  <h4 className="text-xs font-black font-display text-white line-clamp-1 group-hover:text-indigo-300 transition-colors">
                    {n.title}
                  </h4>
                  <p className="text-[11px] text-slate-300 line-clamp-2 leading-relaxed">
                    {n.message}
                  </p>
                </div>

                <div className="flex items-center justify-between pt-1 border-t border-white/5 text-[10px] text-slate-400">
                  <span className="font-mono">Live notice</span>
                  <div className="flex items-center gap-1 font-bold text-indigo-400 group-hover:translate-x-0.5 transition-transform">
                    <span>Open</span>
                    <ArrowRight className="w-3 h-3" />
                  </div>
                </div>
              </div>

              {!prefersReduced && (
                <motion.div
                  initial={{ width: '100%' }}
                  animate={{ width: '0%' }}
                  transition={{ duration: duration / 1000, ease: 'linear' }}
                  className="h-0.5 bg-indigo-500/60"
                />
              )}
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
};
