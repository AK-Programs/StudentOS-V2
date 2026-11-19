import React, { useState, useEffect, useRef } from 'react';
import { Megaphone, X, BellRing } from 'lucide-react';
import { soundService } from '../lib/soundService';
import { supabase } from '../lib/supabase';
import {
  triggerBrowserPushNotification,
  isUserEligibleForNotification,
  dismissNotification,
} from '../lib/notifications';
import { UserProfile } from '../types';

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

  // Clear banner state cleanly when account or role changes
  useEffect(() => {
    setActivePopup(null);
    setStickyBanner(null);
    seenBroadcastIdsRef.current = new Set();
  }, [userId, activeRole]);

  useEffect(() => {
    if (!currentUser) return;

    const handleIncomingBroadcast = (broadcast: LiveBroadcastPayload) => {
      if (!broadcast || !broadcast.title || !broadcast.id) return;

      // Enforce per-user dismissal & deduplication across channels
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

  return (
    <>
      {stickyBanner && (
        <div className="bg-gradient-to-r from-amber-600 via-orange-600 to-amber-700 text-slate-950 px-4 py-2.5 flex items-center justify-between shadow-xl z-40 relative">
          <div className="flex items-center gap-3 min-w-0 mx-auto max-w-7xl">
            <span className="p-1.5 rounded-lg bg-black/20 text-white shrink-0">
              <Megaphone className="w-4 h-4" />
            </span>
            <div className="text-xs font-bold text-white flex items-center gap-2 truncate">
              <span className="px-2 py-0.5 rounded bg-black/30 font-black text-[10px] uppercase tracking-wider text-amber-200 shrink-0">
                {stickyBanner.priority} NOTICE
              </span>
              <span className="font-extrabold text-amber-100 shrink-0">{stickyBanner.title}:</span>
              <span className="font-normal text-white/90 truncate">{stickyBanner.message}</span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              persistDismissedId(stickyBanner.id);
              setStickyBanner(null);
            }}
            aria-label="Dismiss announcement banner"
            className="p-1 rounded-lg hover:bg-black/20 text-white/80 hover:text-white shrink-0 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {activePopup && (
        <div className="fixed bottom-6 right-6 z-50 max-w-md w-full bg-slate-900 border border-amber-500/50 rounded-2xl p-5 shadow-2xl shadow-amber-950/50">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-400">
                <BellRing className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] uppercase tracking-wider font-extrabold text-amber-300">
                  Live Broadcast · {activePopup.priority}
                </span>
                <h4 className="font-black text-white text-base mt-0.5">
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
              className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white border border-white/10 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <p className="text-xs text-slate-200 mt-3 leading-relaxed bg-slate-950/60 p-3 rounded-xl border border-white/5">
            {activePopup.message}
          </p>

          <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between text-[11px] text-slate-400">
            <span className="font-semibold text-amber-400">From {activePopup.senderName}</span>
            <span className="font-mono tabular-nums">
              {new Date(activePopup.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        </div>
      )}
    </>
  );
};
