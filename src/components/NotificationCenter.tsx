import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  Bell,
  BellRing,
  ShieldAlert,
  CheckCheck,
  Trash2,
  Volume2,
  VolumeX,
  Megaphone,
  BookOpen,
  MessageSquare,
  AtSign,
  Award,
  Sparkles,
  X,
  Check,
  Search,
  RefreshCw,
  ArrowUpRight,
  ChevronDown,
  AlertTriangle,
  Inbox,
} from 'lucide-react';
import { AppNotification, UserProfile } from '../types';
import {
  getAppNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
  triggerNotificationSound,
  isUserEligibleForNotification,
  requestWebPushPermission,
  triggerBrowserPushNotification,
} from '../lib/notifications';
import { requestFCMPermission } from '../lib/fcmNotifications';
import { saveSupabaseUserProfile } from '../lib/supabaseUsers';
import { soundService } from '../lib/soundService';
import { supabase } from '../lib/supabase';
import { MOTION_EASE, MOTION_DURATION, useReducedMotionPreference } from '../lib/motionSystem';
import { AnimatedSkeleton } from './ui/animatedComponents';
import { VeylentraIcon } from './ui/VeylentraIcon';

interface NotificationCenterProps {
  currentUser: UserProfile | null;
  onNavigateTab?: (tab: string) => void;
  isOpen: boolean;
  onClose: () => void;
}

type EnrichedNotification = AppNotification & {
  priority?: string;
  senderName?: string;
  expiresAt?: string | null;
};

type FilterTab = 'all' | 'unread' | 'broadcast' | 'mention' | 'academic';

function formatRelativeTime(isoString?: string): string {
  if (!isoString) return 'Just now';
  const ts = new Date(isoString).getTime();
  if (!Number.isFinite(ts)) return 'Recent';
  const diffSec = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (diffSec < 60) return 'Just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDays = Math.floor(diffHr / 24);
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function getActionLabel(linkTab?: string, type?: string): string {
  switch (linkTab) {
    case 'homework':
      return 'Open Homework';
    case 'assignments':
      return 'View Assignment';
    case 'gradebook':
    case 'marks':
      return 'View Marks';
    case 'calendar':
      return 'Open Calendar';
    case 'peer_chat':
    case 'chat':
      return 'Open Chat';
    case 'life':
    case 'studentos_life':
      return 'Open Veylentra Life';
    case 'admin':
      return 'Open Admin Center';
    case 'attendance':
      return 'Open Attendance';
    default:
      return type === 'chat' ? 'Open Chat' : 'View Details';
  }
}

export const NotificationCenter: React.FC<NotificationCenterProps> = ({
  currentUser,
  onNavigateTab,
  isOpen,
  onClose,
}) => {
  const prefersReduced = useReducedMotionPreference();
  const [notifications, setNotifications] = useState<EnrichedNotification[]>([]);
  const [filter, setFilter] = useState<FilterTab>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [markedAllFeedback, setMarkedAllFeedback] = useState(false);

  const [isMuted, setIsMuted] = useState<boolean>(soundService.getMuted());
  const [permissionState, setPermissionState] = useState<string>(
    typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'granted'
  );

  const handleEnablePushPermissions = async () => {
    const res = await requestFCMPermission(currentUser?.uid || currentUser?.email, {
      role: currentUser?.role,
      grade: currentUser?.grade || '10',
      section: currentUser?.section || 'A',
      house: currentUser?.house || 'None',
    });

    await requestWebPushPermission(currentUser?.uid);

    if (res.success && currentUser) {
      soundService.playSuccessSound();
      const updated: UserProfile = {
        ...currentUser,
        enableWebPush: true,
        fcmToken: res.token,
        raw_data: {
          ...(currentUser.raw_data || {}),
          enableWebPush: true,
          fcmSubscribed: true,
          fcmToken: res.token,
        },
      };
      saveSupabaseUserProfile(updated).catch(() => {});
      try {
        localStorage.setItem('s_os_user', JSON.stringify(updated));
      } catch (_) {}
    }

    if (typeof window !== 'undefined' && 'Notification' in window) {
      setPermissionState(Notification.permission);
    }
  };

  const processedRealtimeIdsRef = React.useRef<Set<string>>(new Set());

  const loadNotifications = async (showSpinner = false) => {
    if (!currentUser) {
      setNotifications([]);
      setLoadError(null);
      return;
    }
    if (showSpinner) setIsLoading(true);
    setLoadError(null);
    try {
      const data = await getAppNotifications(
        currentUser.uid,
        currentUser.grade,
        currentUser.section,
        currentUser.role
      );
      if (data) {
        setNotifications(data);
      }
    } catch (e: any) {
      console.warn('[NOTIF-CENTER] Error loading notifications:', e);
      setLoadError(e?.message || 'Unable to sync notifications right now.');
    } finally {
      if (showSpinner) setIsLoading(false);
    }
  };

  useEffect(() => {
    setNotifications([]);
    processedRealtimeIdsRef.current = new Set();
    loadNotifications(true);

    const channel = supabase
      .channel(`student-os-public-notifcenter-${currentUser?.uid || 'anon'}`)
      .on('broadcast', { event: 'new_app_notification' }, (payload) => {
        if (payload && payload.payload) {
          const notif = payload.payload as EnrichedNotification;
          if (isUserEligibleForNotification(notif, currentUser || {})) {
            setNotifications((prev) => [notif, ...prev.filter((n) => n.id !== notif.id)]);
            if (!processedRealtimeIdsRef.current.has(notif.id)) {
              processedRealtimeIdsRef.current.add(notif.id);
              triggerNotificationSound(notif.type);
              triggerBrowserPushNotification(notif.title, {
                body: notif.message,
                tag: notif.id ? `studentos-notif-${notif.id}` : `studentos-notif-${Date.now()}`,
                notifId: notif.id,
                linkTab: notif.linkTab || 'notice_viewer',
              });
            }
          }
        }
      })
      .subscribe();

    const handleStateChange = () => {
      loadNotifications(false);
    };
    const handleSoundPrefChange = (e: any) => {
      if (e.detail && typeof e.detail.muted === 'boolean') {
        setIsMuted(e.detail.muted);
      } else {
        setIsMuted(soundService.getMuted());
      }
    };
    window.addEventListener('studentos-notif-state-change', handleStateChange);
    window.addEventListener('studentos-sound-pref-changed', handleSoundPrefChange);

    return () => {
      supabase.removeChannel(channel);
      window.removeEventListener('studentos-notif-state-change', handleStateChange);
      window.removeEventListener('studentos-sound-pref-changed', handleSoundPrefChange);
    };
  }, [currentUser?.uid, currentUser?.grade, currentUser?.section, currentUser?.role]);

  // Escape-to-close + scroll lock while drawer is open
  useEffect(() => {
    if (!isOpen) {
      document.body.style.overflow = '';
      return;
    }
    document.body.style.overflow = 'hidden';
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [isOpen, onClose]);

  const toggleSound = () => {
    const muted = soundService.toggleMute();
    setIsMuted(muted);
  };

  const handleMarkAsRead = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    soundService.playButtonClick();
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
    await markNotificationAsRead(id, currentUser?.uid);
  };

  const handleMarkAllRead = async () => {
    soundService.playSuccessSound();
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setMarkedAllFeedback(true);
    setTimeout(() => setMarkedAllFeedback(false), 1800);
    await markAllNotificationsAsRead(notifications, currentUser?.uid);
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    soundService.playButtonClick();
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    await deleteNotification(id, currentUser?.uid);
  };

  const handleNotificationClick = (notif: EnrichedNotification) => {
    if (!notif.isRead) {
      markNotificationAsRead(notif.id, currentUser?.uid);
      setNotifications((prev) => prev.map((n) => (n.id === notif.id ? { ...n, isRead: true } : n)));
    }
    if (notif.linkTab && onNavigateTab && notif.linkTab !== 'notice_viewer') {
      onNavigateTab(notif.linkTab);
      onClose();
    } else {
      setExpandedIds((prev) => ({ ...prev, [notif.id]: !prev[notif.id] }));
    }
  };

  const unreadCount = useMemo(() => notifications.filter((n) => !n.isRead).length, [notifications]);
  const urgentCount = useMemo(
    () =>
      notifications.filter(
        (n) => !n.isRead && ['emergency', 'urgent', 'high'].includes(String(n.priority || '').toLowerCase())
      ).length,
    [notifications]
  );

  const filteredNotifications = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return notifications.filter((n) => {
      if (filter === 'unread' && n.isRead) return false;
      if (filter === 'broadcast' && !['announcement', 'broadcast', 'substitute', 'notice', 'urgent'].includes(n.type))
        return false;
      if (filter === 'mention' && !['mention', 'chat'].includes(n.type)) return false;
      if (
        filter === 'academic' &&
        !['homework', 'assignment', 'exam', 'marks', 'resource', 'attendance'].includes(n.type)
      )
        return false;

      if (q) {
        const hay = `${n.title || ''} ${n.message || ''} ${n.type || ''} ${n.senderName || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [notifications, filter, searchQuery]);

  const { priorityOrUnread, earlierItems } = useMemo(() => {
    const firstGroup: EnrichedNotification[] = [];
    const secondGroup: EnrichedNotification[] = [];
    for (const item of filteredNotifications) {
      const isUrgent = ['emergency', 'urgent', 'high'].includes(String(item.priority || '').toLowerCase());
      if (!item.isRead || isUrgent) {
        firstGroup.push(item);
      } else {
        secondGroup.push(item);
      }
    }
    return { priorityOrUnread: firstGroup, earlierItems: secondGroup };
  }, [filteredNotifications]);

  const getTypeStyle = (notif: EnrichedNotification) => {
    const prio = String(notif.priority || '').toLowerCase();
    if (prio === 'emergency') {
      return {
        icon: <ShieldAlert className="w-4 h-4 text-rose-400" />,
        iconBg: 'bg-rose-500/15 border-rose-500/30',
        label: 'Emergency',
        labelTone: 'text-rose-300',
        cardBorder: !notif.isRead ? 'border-rose-500/45 bg-rose-950/20' : 'border-rose-500/20 bg-slate-900/60',
      };
    }
    if (prio === 'urgent' || prio === 'high' || notif.type === 'broadcast') {
      return {
        icon: <Megaphone className="w-4 h-4 text-amber-400" />,
        iconBg: 'bg-amber-500/15 border-amber-500/30',
        label: prio === 'urgent' ? 'Urgent Broadcast' : 'Broadcast',
        labelTone: 'text-amber-300',
        cardBorder: !notif.isRead ? 'border-amber-500/40 bg-slate-800/85' : 'border-white/[0.06] bg-slate-900/50',
      };
    }
    switch (notif.type) {
      case 'announcement':
      case 'notice':
        return {
          icon: <Megaphone className="w-4 h-4 text-amber-400" />,
          iconBg: 'bg-amber-500/10 border-amber-500/25',
          label: 'Announcement',
          labelTone: 'text-amber-300',
          cardBorder: !notif.isRead ? 'border-indigo-500/35 bg-slate-800/85' : 'border-white/[0.06] bg-slate-900/50',
        };
      case 'mention':
        return {
          icon: <AtSign className="w-4 h-4 text-purple-400" />,
          iconBg: 'bg-purple-500/10 border-purple-500/25',
          label: 'Mention',
          labelTone: 'text-purple-300',
          cardBorder: !notif.isRead ? 'border-purple-500/35 bg-slate-800/85' : 'border-white/[0.06] bg-slate-900/50',
        };
      case 'homework':
      case 'assignment':
        return {
          icon: <BookOpen className="w-4 h-4 text-emerald-400" />,
          iconBg: 'bg-emerald-500/10 border-emerald-500/25',
          label: 'Academic Task',
          labelTone: 'text-emerald-300',
          cardBorder: !notif.isRead ? 'border-emerald-500/35 bg-slate-800/85' : 'border-white/[0.06] bg-slate-900/50',
        };
      case 'chat':
        return {
          icon: <MessageSquare className="w-4 h-4 text-cyan-400" />,
          iconBg: 'bg-cyan-500/10 border-cyan-500/25',
          label: 'Message',
          labelTone: 'text-cyan-300',
          cardBorder: !notif.isRead ? 'border-cyan-500/35 bg-slate-800/85' : 'border-white/[0.06] bg-slate-900/50',
        };
      case 'exam':
      case 'marks':
        return {
          icon: <Award className="w-4 h-4 text-rose-400" />,
          iconBg: 'bg-rose-500/10 border-rose-500/25',
          label: 'Assessment',
          labelTone: 'text-rose-300',
          cardBorder: !notif.isRead ? 'border-indigo-500/35 bg-slate-800/85' : 'border-white/[0.06] bg-slate-900/50',
        };
      default:
        return {
          icon: <Sparkles className="w-4 h-4 text-sky-400" />,
          iconBg: 'bg-sky-500/10 border-sky-500/25',
          label: notif.type || 'Update',
          labelTone: 'text-sky-300',
          cardBorder: !notif.isRead ? 'border-indigo-500/35 bg-slate-800/85' : 'border-white/[0.06] bg-slate-900/50',
        };
    }
  };

  if (typeof document === 'undefined') return null;

  const filterTabs: { id: FilterTab; label: string; count?: number }[] = [
    { id: 'all', label: 'All', count: notifications.length },
    { id: 'unread', label: 'Unread', count: unreadCount },
    { id: 'broadcast', label: 'Broadcasts' },
    { id: 'mention', label: 'Mentions' },
    { id: 'academic', label: 'Academic' },
  ];

  const renderCard = (notif: EnrichedNotification) => {
    const style = getTypeStyle(notif);
    const isExpanded = Boolean(expandedIds[notif.id]);
    const isLongMessage = (notif.message || '').length > 130;
    const hasDestination = Boolean(notif.linkTab && notif.linkTab !== 'notice_viewer' && onNavigateTab);

    return (
      <motion.div
        key={notif.id}
        layout={!prefersReduced}
        initial={prefersReduced ? { opacity: 0 } : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={prefersReduced ? { opacity: 0 } : { opacity: 0, x: 24, transition: { duration: 0.16 } }}
        transition={{ duration: prefersReduced ? 0.08 : 0.2, ease: MOTION_EASE.easeOutExpo }}
        onClick={() => handleNotificationClick(notif)}
        className={`group relative rounded-2xl border p-3.5 transition-colors cursor-pointer ${style.cardBorder} hover:border-indigo-400/45`}
      >
        <div className="flex items-start gap-3">
          <div className={`p-2 rounded-xl border shrink-0 mt-0.5 ${style.iconBg}`}>
            {style.icon}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-400 mb-0.5">
                  <span className={`font-semibold capitalize ${style.labelTone}`}>{style.label}</span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono tabular-nums text-slate-400">
                    {formatRelativeTime(notif.createdAt)}
                  </span>
                </div>
                <h4
                  className={`text-xs sm:text-sm leading-snug break-words transition-colors ${
                    !notif.isRead
                      ? 'font-bold text-white group-hover:text-indigo-200'
                      : 'font-semibold text-slate-300 group-hover:text-white'
                  }`}
                >
                  {notif.title}
                </h4>
              </div>

              {!notif.isRead && (
                <span
                  aria-label="Unread notification"
                  className="w-2 h-2 rounded-full bg-indigo-400 shrink-0 mt-1.5"
                />
              )}
            </div>

            <p
              className={`text-xs mt-1.5 leading-relaxed break-words ${
                !notif.isRead ? 'text-slate-200' : 'text-slate-400'
              } ${!isExpanded ? 'line-clamp-3' : ''}`}
            >
              {notif.message}
            </p>

            {/* Footer actions row */}
            <div className="flex flex-wrap items-center justify-between gap-2 mt-2.5 pt-2 border-t border-white/[0.06]">
              <div className="flex items-center gap-2 min-w-0">
                {isLongMessage && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setExpandedIds((prev) => ({ ...prev, [notif.id]: !prev[notif.id] }));
                    }}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-400 hover:text-slate-200 cursor-pointer py-0.5"
                  >
                    <span>{isExpanded ? 'Show less' : 'Read full'}</span>
                    <ChevronDown
                      className={`w-3 h-3 transition-transform duration-150 ${isExpanded ? 'rotate-180' : ''}`}
                    />
                  </button>
                )}

                {hasDestination && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleNotificationClick(notif);
                    }}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-400 hover:text-indigo-300 cursor-pointer py-0.5"
                  >
                    <span>{getActionLabel(notif.linkTab, notif.type)}</span>
                    <ArrowUpRight className="w-3 h-3" />
                  </button>
                )}

                {notif.senderName && (
                  <span className="text-[11px] text-slate-500 truncate">
                    From {notif.senderName}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                {!notif.isRead && (
                  <button
                    type="button"
                    onClick={(e) => handleMarkAsRead(notif.id, e)}
                    title="Mark as read"
                    aria-label="Mark notification as read"
                    className="min-h-[32px] px-2 py-1 rounded-lg bg-slate-900/90 hover:bg-emerald-500/20 text-slate-300 hover:text-emerald-300 border border-white/10 text-[11px] font-medium flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="sm:hidden">Read</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={(e) => handleDelete(notif.id, e)}
                  title="Dismiss notification"
                  aria-label="Dismiss notification"
                  className="min-h-[32px] px-2 py-1 rounded-lg bg-slate-900/90 hover:bg-rose-500/20 text-slate-300 hover:text-rose-300 border border-white/10 text-[11px] font-medium flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                  <span className="sm:hidden">Dismiss</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    );
  };

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div
          className="fixed inset-0 z-[99999] flex justify-end overflow-hidden pointer-events-auto"
          role="dialog"
          aria-modal="true"
          aria-label="Notifications panel"
        >
          {/* Animated Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: prefersReduced ? 0.08 : 0.18 }}
            onClick={onClose}
            aria-label="Close notification overlay"
            className="fixed inset-0 bg-slate-950/75 backdrop-blur-sm cursor-pointer"
          />

          {/* Slide-over Drawer Container */}
          <motion.aside
            initial={prefersReduced ? { opacity: 0 } : { x: '100%' }}
            animate={prefersReduced ? { opacity: 1 } : { x: 0 }}
            exit={prefersReduced ? { opacity: 0 } : { x: '100%' }}
            transition={
              prefersReduced
                ? { duration: 0.1 }
                : { type: 'spring', stiffness: 320, damping: 32, mass: 0.85 }
            }
            className="relative z-10 w-full sm:w-[440px] sm:max-w-md bg-slate-900 border-l border-white/10 h-full flex flex-col shadow-2xl overflow-hidden"
          >
            {/* Header */}
            <div className="px-4 py-3.5 border-b border-white/10 bg-slate-950/90 shrink-0 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="p-1.5 rounded-xl bg-indigo-500/15 border border-indigo-500/25 shrink-0">
                    <VeylentraIcon name="bell" size={20} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h2 className="font-display font-bold text-white text-base tracking-tight truncate">
                        Notifications
                      </h2>
                      {unreadCount > 0 && (
                        <span className="px-2 py-0.5 text-[11px] font-mono font-bold tabular-nums bg-indigo-600 text-white rounded-md shrink-0">
                          {unreadCount} unread
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400 truncate">
                      {urgentCount > 0
                        ? `${urgentCount} high-priority notice${urgentCount > 1 ? 's' : ''} requiring attention`
                        : 'Academic alerts, broadcasts & activity'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      soundService.playButtonClick();
                      setShowSearch((prev) => !prev);
                      if (showSearch) setSearchQuery('');
                    }}
                    title="Search notifications"
                    aria-label="Toggle notification search"
                    className={`min-h-[36px] min-w-[36px] flex items-center justify-center rounded-xl border transition-colors cursor-pointer ${
                      showSearch
                        ? 'bg-indigo-600/25 border-indigo-500/40 text-indigo-300'
                        : 'bg-slate-800/90 border-white/10 text-slate-300 hover:text-white hover:bg-slate-800'
                    }`}
                  >
                    <Search className="w-4 h-4" />
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      soundService.playButtonClick();
                      loadNotifications(true);
                    }}
                    title="Refresh notifications"
                    aria-label="Refresh notifications"
                    className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-xl bg-slate-800/90 hover:bg-slate-800 text-slate-300 hover:text-white border border-white/10 transition-colors cursor-pointer"
                  >
                    <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-indigo-400' : ''}`} />
                  </button>

                  <button
                    type="button"
                    onClick={toggleSound}
                    title={isMuted ? 'Unmute notification sounds' : 'Mute notification sounds'}
                    aria-label={isMuted ? 'Unmute notification sounds' : 'Mute notification sounds'}
                    className={`min-h-[36px] min-w-[36px] flex items-center justify-center rounded-xl border transition-colors cursor-pointer ${
                      isMuted
                        ? 'bg-rose-500/15 border-rose-500/30 text-rose-400 hover:bg-rose-500/25'
                        : 'bg-slate-800/90 border-white/10 text-slate-300 hover:text-white hover:bg-slate-800'
                    }`}
                  >
                    {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                  </button>

                  <button
                    type="button"
                    onClick={onClose}
                    aria-label="Close notification panel"
                    className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-xl bg-slate-800/90 hover:bg-slate-700 text-slate-300 hover:text-white border border-white/10 transition-colors cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Expandable Search Input */}
              <AnimatePresence initial={false}>
                {showSearch && (
                  <motion.div
                    initial={prefersReduced ? { opacity: 0 } : { height: 0, opacity: 0 }}
                    animate={prefersReduced ? { opacity: 1 } : { height: 'auto', opacity: 1 }}
                    exit={prefersReduced ? { opacity: 0 } : { height: 0, opacity: 0 }}
                    transition={{ duration: MOTION_DURATION.fast }}
                    className="overflow-hidden"
                  >
                    <div className="relative pt-1">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 mt-0.5 pointer-events-none" />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Filter by title, message, or sender..."
                        className="w-full pl-9 pr-8 py-2 rounded-xl bg-slate-900 border border-white/10 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                      />
                      {searchQuery && (
                        <button
                          type="button"
                          onClick={() => setSearchQuery('')}
                          aria-label="Clear search query"
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 mt-0.5 text-slate-400 hover:text-white cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Push Notification Permission Prompt */}
            {permissionState === 'default' && (
              <div className="p-3.5 bg-indigo-950/70 border-b border-indigo-500/25 flex flex-col gap-2.5 shrink-0">
                <div className="flex items-start gap-2.5">
                  <div className="p-2 bg-indigo-500/20 text-indigo-300 rounded-xl shrink-0">
                    <BellRing className="w-4 h-4" />
                  </div>
                  <div className="flex-1 text-xs min-w-0">
                    <p className="font-bold text-white">Enable Push Notifications</p>
                    <p className="text-slate-300 mt-0.5 leading-snug">
                      Receive urgent campus broadcasts, homework alerts, and mentions even when the tab is closed.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleEnablePushPermissions}
                  className="w-full py-2 px-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Bell className="w-3.5 h-3.5" />
                  Enable Push Notifications
                </button>
              </div>
            )}

            {permissionState === 'denied' && (
              <div className="p-3 bg-amber-950/40 border-b border-amber-500/20 text-xs text-amber-300 flex items-center gap-2.5 shrink-0">
                <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-amber-200">Browser push alerts blocked</p>
                  <p className="text-[11px] text-amber-300/80 mt-0.5">
                    Allow notifications in your browser settings for instant background alerts.
                  </p>
                </div>
              </div>
            )}

            {/* Animated Filter Tabs + Quick Mark All Read */}
            <div className="px-3 py-2.5 border-b border-white/10 bg-slate-900/80 flex items-center justify-between gap-2 shrink-0">
              <div
                role="tablist"
                aria-label="Filter notifications"
                className="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5"
              >
                {filterTabs.map((item) => {
                  const isActive = filter === item.id;
                  return (
                    <button
                      key={item.id}
                      role="tab"
                      aria-selected={isActive}
                      type="button"
                      onClick={() => {
                        soundService.playButtonClick();
                        setFilter(item.id);
                      }}
                      className={`relative px-2.5 py-1.5 rounded-lg whitespace-nowrap text-xs font-semibold transition-colors shrink-0 cursor-pointer select-none ${
                        isActive ? 'text-white' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                      }`}
                    >
                      {isActive && !prefersReduced && (
                        <motion.div
                          layoutId="notif-center-filter-pill"
                          transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                          className="absolute inset-0 rounded-lg bg-indigo-600 shadow-sm"
                        />
                      )}
                      {isActive && prefersReduced && (
                        <span className="absolute inset-0 rounded-lg bg-indigo-600" />
                      )}
                      <span className="relative z-10 flex items-center gap-1.5">
                        <span>{item.label}</span>
                        {item.count !== undefined && (
                          <span className="font-mono text-[10px] tabular-nums opacity-85">
                            {item.count}
                          </span>
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>

              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={handleMarkAllRead}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-800/90 hover:bg-emerald-500/20 border border-white/10 text-[11px] font-semibold text-emerald-300 flex items-center gap-1.5 shrink-0 transition-colors cursor-pointer"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">{markedAllFeedback ? 'Done' : 'Mark all'}</span>
                </button>
              )}
            </div>

            {/* Error Banner */}
            {loadError && (
              <div className="mx-3.5 mt-3 p-3 rounded-xl bg-rose-950/60 border border-rose-500/30 text-xs text-rose-200 flex items-center justify-between gap-2 shrink-0">
                <div className="flex items-center gap-2 min-w-0">
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span className="truncate">{loadError}</span>
                </div>
                <button
                  type="button"
                  onClick={() => loadNotifications(true)}
                  className="px-2.5 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 font-semibold shrink-0 cursor-pointer"
                >
                  Retry
                </button>
              </div>
            )}

            {/* Notification List */}
            <div className="flex-1 overflow-y-auto overflow-x-hidden p-3.5 space-y-4">
              {isLoading && notifications.length === 0 ? (
                <div className="space-y-3" aria-label="Loading notifications">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="p-3.5 rounded-2xl border border-white/5 bg-slate-950/40 space-y-2.5">
                      <div className="flex items-center gap-3">
                        <AnimatedSkeleton width={34} height={34} borderRadius="0.75rem" />
                        <div className="flex-1 space-y-1.5">
                          <AnimatedSkeleton width="45%" height={10} />
                          <AnimatedSkeleton width="78%" height={14} />
                        </div>
                      </div>
                      <AnimatedSkeleton width="100%" height={24} />
                    </div>
                  ))}
                </div>
              ) : filteredNotifications.length === 0 ? (
                <div className="h-full min-h-[260px] flex flex-col items-center justify-center text-center p-6 space-y-3">
                  <div className="p-4 rounded-2xl bg-slate-800/60 border border-white/10 text-slate-400">
                    <Inbox className="w-7 h-7" />
                  </div>
                  <div className="space-y-1 max-w-xs">
                    <p className="text-sm font-bold text-slate-200">
                      {notifications.length > 0 ? 'No matching notifications' : 'You are all caught up'}
                    </p>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      {notifications.length > 0
                        ? 'Try another category tab or clear your current search filter.'
                        : 'New school announcements, homework updates, and mentions will appear here in real time.'}
                    </p>
                  </div>
                  {(filter !== 'all' || searchQuery) && (
                    <button
                      type="button"
                      onClick={() => {
                        setFilter('all');
                        setSearchQuery('');
                      }}
                      className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-colors cursor-pointer"
                    >
                      Reset filters
                    </button>
                  )}
                </div>
              ) : (
                <>
                  {priorityOrUnread.length > 0 && (
                    <section className="space-y-2.5">
                      <div className="flex items-center justify-between px-1">
                        <h3 className="text-[11px] font-bold uppercase tracking-wider text-indigo-300">
                          New & Priority ({priorityOrUnread.length})
                        </h3>
                      </div>
                      <AnimatePresence mode="popLayout">
                        {priorityOrUnread.map(renderCard)}
                      </AnimatePresence>
                    </section>
                  )}

                  {earlierItems.length > 0 && (
                    <section className="space-y-2.5">
                      <div className="flex items-center justify-between px-1">
                        <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                          Earlier ({earlierItems.length})
                        </h3>
                      </div>
                      <AnimatePresence mode="popLayout">
                        {earlierItems.map(renderCard)}
                      </AnimatePresence>
                    </section>
                  )}
                </>
              )}
            </div>

            {/* Footer */}
            <div className="px-4 py-2.5 border-t border-white/10 bg-slate-950 flex items-center justify-between text-[11px] text-slate-500 shrink-0">
              <span>Veylentra Realtime Notification Engine</span>
              <span className="font-mono tabular-nums">{notifications.length} total</span>
            </div>
          </motion.aside>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
};
