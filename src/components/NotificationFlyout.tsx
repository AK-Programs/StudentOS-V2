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
  Calendar,
  CheckCircle2
} from 'lucide-react';
import { AppNotification } from '../types';
import { soundService } from '../lib/soundService';

interface NotificationFlyoutProps {
  notifications: AppNotification[];
  onNavigateTab?: (tab: string) => void;
  onMarkAsRead?: (id: string) => void;
}

interface ActiveFlyoutItem {
  id: string;
  notification: AppNotification;
  timerId: NodeJS.Timeout;
}

export const NotificationFlyout: React.FC<NotificationFlyoutProps> = ({
  notifications,
  onNavigateTab,
  onMarkAsRead
}) => {
  const [activeFlyouts, setActiveFlyouts] = useState<ActiveFlyoutItem[]>([]);
  const shownIdsRef = useRef<Set<string>>(new Set());

  // Initialize shown IDs from sessionStorage to prevent spamming after page refresh
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem('veylentra_shown_flyouts');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          parsed.forEach((id: string) => shownIdsRef.current.add(id));
        }
      }
    } catch (_) {}
  }, []);

  const saveShownIds = () => {
    try {
      const arr = Array.from(shownIdsRef.current).slice(-200);
      sessionStorage.setItem('veylentra_shown_flyouts', JSON.stringify(arr));
    } catch (_) {}
  };

  const dismissFlyout = (id: string) => {
    setActiveFlyouts((prev) => {
      const item = prev.find((f) => f.id === id);
      if (item) clearTimeout(item.timerId);
      return prev.filter((f) => f.id !== id);
    });
  };

  // Inspect incoming unread notifications
  useEffect(() => {
    if (!Array.isArray(notifications) || notifications.length === 0) return;

    // Filter unread notifications that have not been shown in this session
    const unreadUnshown = notifications.filter((n) => {
      return !n.isRead && !shownIdsRef.current.has(n.id);
    });

    if (unreadUnshown.length === 0) return;

    // Process top 2 newest unshown notifications to avoid overwhelming the screen
    const newItems = unreadUnshown.slice(0, 2);

    newItems.forEach((n) => {
      shownIdsRef.current.add(n.id);

      // Select appropriate verified sound effect
      const lowerTitle = (n.title || '').toLowerCase();
      const lowerMsg = (n.message || '').toLowerCase();

      if (n.type === 'chat' && (lowerTitle.includes('server') || lowerTitle.includes('channel') || lowerMsg.includes('server'))) {
        soundService.playServerMessageSound();
      } else if (n.type === 'chat' || n.type === 'mention' || lowerTitle.includes('dm') || lowerTitle.includes('direct')) {
        soundService.playDirectMessageSound();
      } else {
        soundService.playNewNotification();
      }

      // Auto dismiss after 5.5s
      const timerId = setTimeout(() => {
        dismissFlyout(n.id);
      }, 5500);

      setActiveFlyouts((prev) => {
        // Keep max 3 notifications visible at any time
        const trimmed = prev.length >= 3 ? prev.slice(1) : prev;
        return [...trimmed, { id: n.id, notification: n, timerId }];
      });
    });

    saveShownIds();
  }, [notifications]);

  if (activeFlyouts.length === 0) return null;

  const getCategoryMeta = (n: AppNotification) => {
    switch (n.type) {
      case 'chat': {
        const isServer = (n.title || '').toLowerCase().includes('server') || (n.title || '').toLowerCase().includes('channel');
        return {
          icon: isServer ? <MessageSquare className="w-4 h-4 text-emerald-400" /> : <MessageCircle className="w-4 h-4 text-cyan-400" />,
          color: isServer ? 'border-emerald-500/30 bg-emerald-950/40 text-emerald-300' : 'border-cyan-500/30 bg-cyan-950/40 text-cyan-300',
          badge: isServer ? 'Server Chat' : 'Direct Message'
        };
      }
      case 'homework':
      case 'assignment':
        return {
          icon: <BookOpen className="w-4 h-4 text-purple-400" />,
          color: 'border-purple-500/30 bg-purple-950/40 text-purple-300',
          badge: 'Assignment'
        };
      case 'exam':
      case 'marks':
        return {
          icon: <Award className="w-4 h-4 text-amber-400" />,
          color: 'border-amber-500/30 bg-amber-950/40 text-amber-300',
          badge: 'Academic'
        };
      case 'announcement':
        return {
          icon: <Megaphone className="w-4 h-4 text-rose-400" />,
          color: 'border-rose-500/30 bg-rose-950/40 text-rose-300',
          badge: 'Announcement'
        };
      case 'ai_task':
        return {
          icon: <Sparkles className="w-4 h-4 text-yellow-300" />,
          color: 'border-yellow-500/30 bg-yellow-950/40 text-yellow-300',
          badge: 'AI Update'
        };
      default:
        return {
          icon: <BellRing className="w-4 h-4 text-indigo-400" />,
          color: 'border-indigo-500/30 bg-indigo-950/40 text-indigo-300',
          badge: 'Notification'
        };
    }
  };

  return (
    <div 
      className="fixed top-16 right-4 sm:right-6 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none"
      aria-live="polite"
    >
      <AnimatePresence mode="popLayout">
        {activeFlyouts.map(({ id, notification: n }) => {
          const meta = getCategoryMeta(n);

          return (
            <motion.div
              key={id}
              layout
              initial={{ opacity: 0, scale: 0.4, y: -24, x: 24 }}
              animate={{ opacity: 1, scale: 1, y: 0, x: 0 }}
              exit={{ opacity: 0, scale: 0.85, x: 60, transition: { duration: 0.25 } }}
              transition={{ type: 'spring', stiffness: 420, damping: 28 }}
              className="pointer-events-auto group relative overflow-hidden rounded-2xl bg-slate-900/95 border border-white/10 shadow-2xl backdrop-blur-xl hover:border-indigo-500/40 transition-all cursor-pointer"
              onClick={() => {
                if (onMarkAsRead) onMarkAsRead(n.id);
                if (n.linkTab && onNavigateTab) {
                  onNavigateTab(n.linkTab);
                } else if (onNavigateTab && n.type === 'chat') {
                  onNavigateTab('chat');
                }
                dismissFlyout(id);
              }}
            >
              {/* Top Accent Gradient Border */}
              <div className="h-1 w-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500" />

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
                    onClick={(e) => {
                      e.stopPropagation();
                      if (onMarkAsRead) onMarkAsRead(n.id);
                      dismissFlyout(id);
                    }}
                    className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
                    title="Dismiss"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Content */}
                <div className="space-y-1">
                  <h4 className="text-xs font-black font-display text-white line-clamp-1 group-hover:text-indigo-300 transition-colors">
                    {n.title}
                  </h4>
                  <p className="text-[11px] text-slate-300 line-clamp-2 leading-relaxed">
                    {n.message}
                  </p>
                </div>

                {/* Bottom Navigation Hint */}
                <div className="flex items-center justify-between pt-1 border-t border-white/5 text-[10px] text-slate-400">
                  <span className="font-mono">Just now</span>
                  <div className="flex items-center gap-1 font-bold text-indigo-400 group-hover:translate-x-0.5 transition-transform">
                    <span>View</span>
                    <ArrowRight className="w-3 h-3" />
                  </div>
                </div>
              </div>

              {/* Progress bar animation for auto-dismissal */}
              <motion.div
                initial={{ width: '100%' }}
                animate={{ width: '0%' }}
                transition={{ duration: 5.5, ease: 'linear' }}
                className="h-0.5 bg-indigo-500/60"
              />
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
};
