import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Megaphone, X, BellRing, ShieldAlert, Check } from 'lucide-react';
import { soundService } from '../lib/soundService';
import { supabase } from '../lib/supabase';
import {
  triggerBrowserPushNotification,
  isUserEligibleForNotification,
  dismissNotification,
  markNotificationAsRead,
} from '../lib/notifications';
import { UserProfile } from '../types';
import { MOTION_EASE, useReducedMotionPreference } from '../lib/motionSystem';

interface LiveBroadcastPayload {
  id: string;
  title: string;
  message: string;
  senderName: string;
  senderRole: string;
  priority: 'normal' | 'urgent' | 'emergency';
  category: string;
  targetRole?: string;
  targetRoles?: string[];
  targetGrade?: string;
  targetClass?: string;
  targetSection?: string;
  expiresAt?: string | null;
  createdAt: string;
}

interface LiveBroadcastBannerProps {
  currentUser?: UserProfile | null;
  effectiveRole?: string;
}

export const LiveBroadcastBanner: React.FC<LiveBroadcastBannerProps> = ({
  currentUser,
  effectiveRole,
}) => {
  const prefersReduced = useReducedMotionPreference();
  const [activePopup, setActivePopup] = useState<LiveBroadcastPayload | null>(null);
  const [stickyBanner, setStickyBanner] = useState<LiveBroadcastPayload | null>(null);
  const seenBroadcastIdsRef = useRef<Set<string>>(new Set());

  const userId = currentUser?.uid || '';
  const activeRole = (effectiveRole || currentUser?.role || 'student').toLowerCase();
  const dismissedKey = `veylentra_banner_dismissed_v2_${userId || 'guest'}`;

  const getDismissedIds = (): Set<string> => {
    if (typeof window === 'undefined' || !userId) return new Set();
    try {
      const raw = localStorage.getItem(dismissedKey);
      return new Set<string>(raw ? JSON.parse(raw) : []);
    } catch {
      return new Set();
    }
  };

  const persistDismissedId = (id: string) => {
    if (typeof window === 'undefined' || !userId || !id) return;
    try {
      const set = getDismissedIds();
      set.add(id);
      localStorage.setItem(dismissedKey, JSON.stringify(Array.from(set).slice(-300)));
    } catch (_) {}
    dismissNotification(id, userId).catch(() => {});
  };

  useEffect(() => {
    setActivePopup(null);
    setStickyBanner(null);
    seenBroadcastIdsRef.current = new Set();
  }, [userId, activeRole]);

  useEffect(() => {
    if (!currentUser) return;

    const handleIncomingBroadcast = (broadcast: LiveBroadcastPayload) => {
      if (!broadcast || !broadcast.title || !broadcast.id) return;

      if (seenBroadcastIdsRef.current.has(broadcast.id)) return;
      if (getDismissedIds().has(broadcast.id)) return;

      const eligible = isUserEligibleForNotification(
        {
          ...broadcast,
          type: broadcast.category || 'announcement',
          targetRole: broadcast.targetRole || 'all',
          targetRoles: broadcast.targetRoles,
          targetClass: broadcast.targetClass || broadcast.targetGrade || 'all',
          targetSection: broadcast.targetSection || 'all',
        },
        {
          uid: currentUser.uid,
          role: activeRole,
          grade: currentUser.grade,
          section: currentUser.section,
        }
      );

      if (!eligible) return;

      seenBroadcastIdsRef.current.add(broadcast.id);
      setActivePopup(broadcast);
      setStickyBanner(broadcast);
      soundService.playAnnouncementSound();

      triggerBrowserPushNotification(broadcast.title, {
        body: broadcast.message,
        tag: `studentos-notif-${broadcast.id}`,
        notifId: broadcast.id,
        linkTab: 'notice_viewer',
      });
    };

    const channel = supabase
      .channel(`student-os-public-banner-${userId || 'anon'}`)
      .on('broadcast', { event: 'principal_live_broadcast' }, (payload) => {
        if (payload && payload.payload) {
          handleIncomingBroadcast(payload.payload as LiveBroadcastPayload);
        }
      })
      .subscribe();

    const handleWindowBroadcast = (e: Event) => {
      const detail = (e as CustomEvent<LiveBroadcastPayload>).detail;
      if (detail) {
        handleIncomingBroadcast(detail);
      }
    };
    window.addEventListener('studentos-live-broadcast', handleWindowBroadcast);

    return () => {
      window.removeEventListener('studentos-live-broadcast', handleWindowBroadcast);
      supabase.removeChannel(channel);
    };
  }, [currentUser?.uid, activeRole, currentUser?.grade, currentUser?.section]);

  const getPriorityStyle = (priority: LiveBroadcastPayload['priority']) => {
    if (priority === 'emergency') {
      return {
        bannerBg: 'bg-gradient-to-r from-rose-900 via-rose-800 to-slate-900 border-b border-rose-400/40',
        badgeClass: 'bg-rose-950/70 text-rose-200 border border-rose-400/30',
        popupBorder: 'border-rose-500/50 shadow-rose-950/60',
        iconWrap: 'bg-rose-500/20 border-rose-500/40 text-rose-300',
        accentText: 'text-rose-300',
        Icon: ShieldAlert,
      };
    }
    if (priority === 'normal') {
      return {
        bannerBg: 'bg-gradient-to-r from-indigo-900 via-indigo-800 to-slate-900 border-b border-indigo-400/35',
        badgeClass: 'bg-indigo-950/70 text-indigo-200 border border-indigo-400/30',
        popupBorder: 'border-indigo-500/50 shadow-indigo-950/60',
        iconWrap: 'bg-indigo-500/20 border-indigo-500/40 text-indigo-300',
        accentText: 'text-indigo-300',
        Icon: BellRing,
      };
    }
    return {
      bannerBg: 'bg-gradient-to-r from-amber-600 via-orange-600 to-amber-700 border-b border-amber-300/30',
      badgeClass: 'bg-black/35 text-amber-100 border border-white/15',
      popupBorder: 'border-amber-500/50 shadow-amber-950/50',
      iconWrap: 'bg-amber-500/20 border-amber-500/40 text-amber-300',
      accentText: 'text-amber-300',
      Icon: Megaphone,
    };
  };

  return (
    <>
      <AnimatePresence>
        {stickyBanner && (() => {
          const style = getPriorityStyle(stickyBanner.priority);
          const BannerIcon = style.Icon;
          return (
            <motion.div
              key={`banner-${stickyBanner.id}`}
              initial={prefersReduced ? { opacity: 0 } : { opacity: 0, y: -16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={prefersReduced ? { opacity: 0 } : { opacity: 0, y: -16 }}
              transition={{ duration: prefersReduced ? 0.1 : 0.22, ease: MOTION_EASE.easeOutExpo }}
              className={`${style.bannerBg} text-white px-4 py-2.5 flex items-center justify-between gap-3 shadow-xl z-40 relative`}
              role="region"
              aria-label="Live broadcast announcement banner"
            >
              <div className="flex items-center gap-2.5 min-w-0 mx-auto max-w-7xl flex-1">
                <span className="p-1.5 rounded-lg bg-black/25 text-white shrink-0">
                  <BannerIcon className="w-4 h-4" />
                </span>
                <div className="text-xs font-medium text-white flex items-center gap-2 min-w-0 truncate">
                  <span
                    className={`px-2 py-0.5 rounded-md font-bold text-[10px] uppercase tracking-wider shrink-0 ${style.badgeClass}`}
                  >
                    {stickyBanner.priority} notice
                  </span>
                  <span className="font-bold text-white shrink-0">{stickyBanner.title}:</span>
                  <span className="text-white/90 truncate">{stickyBanner.message}</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  persistDismissedId(stickyBanner.id);
                  setStickyBanner(null);
                }}
                aria-label="Dismiss announcement banner"
                className="p-1.5 rounded-lg hover:bg-black/25 text-white/85 hover:text-white shrink-0 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </motion.div>
          );
        })()}
      </AnimatePresence>

      <AnimatePresence>
        {activePopup && (() => {
          const style = getPriorityStyle(activePopup.priority);
          const PopupIcon = style.Icon;
          return (
            <motion.div
              key={`popup-${activePopup.id}`}
              initial={prefersReduced ? { opacity: 0 } : { opacity: 0, y: 20, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={prefersReduced ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.96 }}
              transition={
                prefersReduced
                  ? { duration: 0.1 }
                  : { type: 'spring', stiffness: 320, damping: 28 }
              }
              className={`fixed bottom-4 left-4 right-4 sm:left-auto sm:bottom-6 sm:right-6 z-50 sm:max-w-md sm:w-full bg-slate-900/95 backdrop-blur-xl border rounded-2xl p-4 sm:p-5 shadow-2xl ${style.popupBorder}`}
              role="alertdialog"
              aria-label={`Live broadcast: ${activePopup.title}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`p-2.5 rounded-xl border shrink-0 ${style.iconWrap}`}>
                    <PopupIcon className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <span className={`text-[10px] uppercase tracking-wider font-extrabold ${style.accentText}`}>
                      Live Broadcast · {activePopup.priority}
                    </span>
                    <h4 className="font-display font-bold text-white text-sm sm:text-base mt-0.5 break-words">
                      {activePopup.title}
                    </h4>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    persistDismissedId(activePopup.id);
                    setActivePopup(null);
                  }}
                  aria-label="Dismiss live broadcast popup"
                  className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white border border-white/10 cursor-pointer shrink-0 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <p className="text-xs text-slate-200 mt-3 leading-relaxed bg-slate-950/70 p-3 rounded-xl border border-white/10">
                {activePopup.message}
              </p>

              <div className="mt-3.5 pt-3 border-t border-white/10 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400">
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`font-semibold truncate ${style.accentText}`}>
                    From {activePopup.senderName}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono tabular-nums shrink-0">
                    {new Date(activePopup.createdAt).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    if (userId) {
                      markNotificationAsRead(activePopup.id, userId).catch(() => {});
                    }
                    persistDismissedId(activePopup.id);
                    setActivePopup(null);
                  }}
                  className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-emerald-500/20 text-slate-200 hover:text-emerald-300 border border-white/10 text-[11px] font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <Check className="w-3 h-3 text-emerald-400" />
                  <span>Acknowledge</span>
                </button>
              </div>
            </motion.div>
          );
        })()}
      </AnimatePresence>
    </>
  );
};
