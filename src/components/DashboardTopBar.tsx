import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ChevronLeft,
  Clock,
  Eye,
  Lock,
  Megaphone,
  Mic,
  ShieldCheck,
  Sliders,
  Sparkles,
  Type,
  Volume2,
  VolumeX,
  Check,
  ChevronDown,
} from 'lucide-react';
import { UserProfile } from '../types';
import { VeylentraIcon } from './ui/VeylentraIcon';
import { NotificationCenter } from './NotificationCenter';
import { soundService } from '../lib/soundService';
import { MOTION_EASE, MOTION_DURATION, useReducedMotionPreference } from '../lib/motionSystem';

export interface DashboardTopBarProps {
  activeTab: string;
  studyHubSubTab: 'dashboard' | 'tasks' | 'planner' | 'flashcards';
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  effectiveRole?: string;
  currentUser: UserProfile | null;
  clock: string;

  // Voice & Accessibility Controls
  ttsEnabled: boolean;
  onToggleTts: () => void;
  onOpenSoundSettings: () => void;
  onOpenVoiceAssistant: () => void;
  fontSize: 'standard' | 'large' | 'huge';
  onCycleFontSize: () => void;
  highContrast: boolean;
  onToggleHighContrast: () => void;

  // Security Controls
  presentationMode: boolean;
  hasPinConfigured: boolean;
  onOpenSecurityCenter: () => void;

  // Broadcast Controls
  onOpenBroadcast: () => void;

  // Notification Controls
  unreadNotificationsCount: number;
  showNotifCenter: boolean;
  onToggleNotifCenter: () => void;
  onCloseNotifCenter: () => void;
  onNavigateTab: (tab: string) => void;

  // What's New
  whatsNewUnreadCount: number;
}

const STAFF_SECURITY_ROLES = new Set(['teacher', 'coordinator', 'admin', 'super_admin']);
const STAFF_BROADCAST_ROLES = new Set(['super_admin', 'admin', 'teacher', 'coordinator']);

export function getActiveTabTitle(
  activeTab: string,
  studyHubSubTab: 'dashboard' | 'tasks' | 'planner' | 'flashcards'
): string {
  switch (activeTab) {
    case 'dashboard':
      return 'My Dashboard';
    case 'about':
      return 'About Veylentra';
    case 'meet':
      return 'Veylentra Meet';
    case 'study_hub':
    case 'tasks':
    case 'planner':
    case 'flashcards':
      if (studyHubSubTab === 'tasks') return 'Tasks & Focus Objectives';
      if (studyHubSubTab === 'planner') return 'Study Schedule Planner';
      return 'Study Center & Flashcards';
    case 'whiteboard':
      return 'Drawing Board';
    case 'houses':
      return 'House Standings';
    case 'leaderboard':
      return 'XP Leaderboard';
    case 'winter_festival':
      return 'Winter Festival';
    case 'materials':
      return 'Class Files & Materials';
    case 'assignments':
      return 'Assignment Center';
    case 'homework':
      return 'My Homework';
    case 'brain_battle':
    case 'quiz':
      return 'Brain Battle Arena';
    case 'feedback':
      return 'Feedback Box';
    case 'ai_teacher':
      return 'My AI Tutor';
    case 'peer_chat':
      return 'Class Chat Room';
    case 'faculty':
      return 'Teacher Dashboard';
    case 'attendance_manager':
      return 'Attendance Manager';
    case 'admin':
      return 'Admin Control Center';
    case 'panel_mode':
      return 'Panel Mode';
    case 'life':
    case 'studentos_life':
      return 'Veylentra Life';
    case 'funzone':
    case 'teacher_fun_zone':
      return 'Campus Fun Zone';
    case 'parent_portal':
      return 'Family Portal';
    case 'sports_activities':
      return 'Sports & Activities';
    case 'substitutes':
      return 'Substitute Schedule';
    case 'notice_viewer':
      return 'Class Notices';
    case 'assignment_viewer':
      return 'Assignments Archive';
    case 'worksheet_viewer':
      return 'Worksheets';
    case 'timetable_viewer':
      return 'Official Timetable';
    case 'gallery_viewer':
      return 'Event Photo Gallery';
    case 'notes':
      return 'My Personal Notes';
    case 'pomodoro':
      return 'Focus Timer';
    case 'analytics':
      return 'My Progress';
    case 'profile':
      return 'My Profile';
    case 'blogs':
      return 'Educational Blogs';
    case 'calendar':
      return 'Academic Calendar';
    case 'gradebook':
      return 'Digital Gradebook';
    case 'report_cards':
      return 'Official Report Cards';
    case 'whats_new':
    case 'whats-new':
      return "What's New & Release Logs";
    default:
      return 'Veylentra Workspace';
  }
}

export const DashboardTopBar: React.FC<DashboardTopBarProps> = ({
  activeTab,
  studyHubSubTab,
  sidebarOpen,
  onToggleSidebar,
  effectiveRole,
  currentUser,
  clock,
  ttsEnabled,
  onToggleTts,
  onOpenSoundSettings,
  onOpenVoiceAssistant,
  fontSize,
  onCycleFontSize,
  highContrast,
  onToggleHighContrast,
  presentationMode,
  hasPinConfigured,
  onOpenSecurityCenter,
  onOpenBroadcast,
  unreadNotificationsCount,
  showNotifCenter,
  onToggleNotifCenter,
  onCloseNotifCenter,
  onNavigateTab,
  whatsNewUnreadCount,
}) => {
  const prefersReduced = useReducedMotionPreference();
  const [voiceMenuOpen, setVoiceMenuOpen] = useState(false);
  const [soundPrefs, setSoundPrefs] = useState(() => soundService.getPreferences());
  const voicePopoverRef = useRef<HTMLDivElement>(null);

  const role = String(effectiveRole || currentUser?.role || '').toLowerCase();
  const canUseSecurity = STAFF_SECURITY_ROLES.has(role);
  const canBroadcast = STAFF_BROADCAST_ROLES.has(role);
  const isMuted = soundPrefs.muted;

  useEffect(() => {
    const syncPrefs = () => setSoundPrefs(soundService.getPreferences());
    window.addEventListener('studentos-sound-pref-changed', syncPrefs);
    return () => window.removeEventListener('studentos-sound-pref-changed', syncPrefs);
  }, []);

  useEffect(() => {
    if (!voiceMenuOpen) return;
    const handlePointerDown = (e: MouseEvent) => {
      if (voicePopoverRef.current && !voicePopoverRef.current.contains(e.target as Node)) {
        setVoiceMenuOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setVoiceMenuOpen(false);
    };
    document.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [voiceMenuOpen]);

  const pageTitle = getActiveTabTitle(activeTab, studyHubSubTab);
  const badgeText = unreadNotificationsCount > 99 ? '99+' : String(unreadNotificationsCount);

  return (
    <header
      className="sticky top-0 z-40 shrink-0 px-3 sm:px-6 py-2.5 flex items-center justify-between gap-2.5 sm:gap-4 border-b border-white/[0.08] bg-slate-950/85 backdrop-blur-xl shadow-[0_1px_0_0_rgba(255,255,255,0.03)]"
      role="banner"
    >
      {/* Left Navigation Context */}
      <div className="flex items-center gap-2.5 sm:gap-3.5 min-w-0 flex-1">
        <motion.button
          type="button"
          whileHover={prefersReduced ? undefined : { scale: 1.03 }}
          whileTap={prefersReduced ? undefined : { scale: 0.96 }}
          onClick={onToggleSidebar}
          className="h-9 w-9 sm:h-10 sm:w-10 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-slate-300 hover:text-white border border-white/[0.08] hover:border-white/15 transition-colors flex items-center justify-center shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/70"
          title={sidebarOpen ? 'Collapse navigation sidebar' : 'Expand navigation sidebar'}
          aria-label={sidebarOpen ? 'Collapse navigation sidebar' : 'Expand navigation sidebar'}
          aria-expanded={sidebarOpen}
        >
          <ChevronLeft
            className={`w-4 h-4 transition-transform duration-200 ${sidebarOpen ? '' : 'rotate-180'}`}
          />
        </motion.button>

        <div className="min-w-0 flex-1 flex items-center gap-2.5">
          <h2 className="text-sm sm:text-base md:text-lg font-semibold tracking-tight text-white font-display truncate min-w-0">
            {pageTitle}
          </h2>
          {role === 'student' && currentUser?.house && (
            <span className="hidden 2xl:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-white/[0.08] bg-slate-900/80 text-slate-300 font-medium text-[11px] shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
              <span>{currentUser.house} House</span>
            </span>
          )}
        </div>
      </div>

      {/* Right Unified Action Dock */}
      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
        {/* System Clock (Desktop) */}
        <div
          className="hidden xl:flex items-center gap-1.5 h-10 px-3 rounded-xl bg-slate-900/70 border border-white/[0.07] font-mono text-[11px] text-slate-300"
          aria-label="Current time"
        >
          <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <span className="tabular-nums">{clock || '--:--'}</span>
        </div>

        {/* Core Control Dock: Voice · Security · Broadcast · Notifications */}
        <div
          className="flex items-center gap-1 p-1 rounded-2xl bg-slate-900/80 border border-white/[0.09] shadow-[0_8px_24px_-10px_rgba(2,6,23,0.85)]"
          role="toolbar"
          aria-label="Workspace quick actions"
        >
          {/* 1. VOICE BUTTON + POPOVER */}
          <div className="relative" ref={voicePopoverRef}>
            <motion.button
              type="button"
              whileHover={prefersReduced ? undefined : { y: -0.5 }}
              whileTap={prefersReduced ? undefined : { scale: 0.96 }}
              onClick={() => {
                soundService.playButtonClick();
                setVoiceMenuOpen((prev) => !prev);
              }}
              aria-label="Voice & Audio Controls"
              aria-expanded={voiceMenuOpen}
              aria-haspopup="menu"
              title="Voice Assistance, Audio & Accessibility"
              className={`group relative h-8 sm:h-9 px-2 sm:px-2.5 rounded-xl border text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/70 ${
                voiceMenuOpen
                  ? 'bg-cyan-500/15 border-cyan-400/40 text-cyan-200 shadow-[0_0_16px_-6px_rgba(34,211,238,0.5)]'
                  : ttsEnabled
                  ? 'bg-amber-500/15 border-amber-400/35 text-amber-200 hover:bg-amber-500/20'
                  : 'bg-slate-950/60 border-white/[0.06] text-slate-300 hover:text-white hover:bg-slate-800/80 hover:border-white/15'
              }`}
            >
              <span className="relative flex items-center justify-center">
                {isMuted ? (
                  <VolumeX className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                ) : ttsEnabled ? (
                  <Volume2 className="w-3.5 h-3.5 text-amber-300 shrink-0" />
                ) : (
                  <Mic className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                )}
                {(ttsEnabled || isMuted) && (
                  <span
                    className={`absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full ${
                      isMuted ? 'bg-rose-400' : 'bg-amber-400'
                    }`}
                  />
                )}
              </span>
              <span className="hidden lg:inline tracking-tight">Voice</span>
              <ChevronDown
                className={`hidden sm:inline w-3 h-3 text-slate-400 transition-transform duration-150 ${
                  voiceMenuOpen ? 'rotate-180 text-cyan-300' : ''
                }`}
              />
            </motion.button>

            <AnimatePresence>
              {voiceMenuOpen && (
                <motion.div
                  role="menu"
                  aria-label="Voice and audio preferences"
                  initial={prefersReduced ? { opacity: 1 } : { opacity: 0, y: 6, scale: 0.97 }}
                  animate={prefersReduced ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
                  exit={prefersReduced ? { opacity: 0 } : { opacity: 0, y: 4, scale: 0.97 }}
                  transition={{ duration: prefersReduced ? 0.01 : MOTION_DURATION.fast, ease: MOTION_EASE.easeOutCubic }}
                  className="fixed sm:absolute right-3 sm:right-0 top-14 sm:top-full sm:mt-2 w-[min(19rem,calc(100vw-1.5rem))] bg-slate-950/95 backdrop-blur-2xl border border-white/15 rounded-2xl p-2 shadow-2xl z-50 space-y-1.5"
                >
                  <div className="px-2.5 py-1.5 flex items-center justify-between border-b border-white/[0.07]">
                    <div className="flex items-center gap-2">
                      <Mic className="w-3.5 h-3.5 text-cyan-400" />
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-300">
                        Voice &amp; Audio
                      </span>
                    </div>
                    <span className="text-[10px] font-mono text-slate-400 tabular-nums">
                      {isMuted ? 'Muted' : `${Math.round((soundPrefs.volume ?? 0.7) * 100)}%`}
                    </span>
                  </div>

                  {/* Read Aloud (TTS) */}
                  <button
                    type="button"
                    role="menuitemcheckbox"
                    aria-checked={ttsEnabled}
                    onClick={() => {
                      soundService.playButtonClick();
                      onToggleTts();
                    }}
                    className="w-full flex items-center justify-between gap-2.5 px-2.5 py-2 rounded-xl hover:bg-white/[0.06] text-left transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border ${
                          ttsEnabled
                            ? 'bg-amber-500/20 border-amber-400/35 text-amber-300'
                            : 'bg-slate-900 border-white/10 text-slate-400'
                        }`}
                      >
                        <Volume2 className="w-3.5 h-3.5" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-white truncate">Read Aloud (TTS)</div>
                        <div className="text-[10px] text-slate-400 truncate">Speak alerts &amp; tutor replies</div>
                      </div>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-semibold shrink-0 ${
                        ttsEnabled
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-400/30'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {ttsEnabled ? 'ON' : 'OFF'}
                    </span>
                  </button>

                  {/* Launch Voice Assistant */}
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      soundService.playButtonClick();
                      setVoiceMenuOpen(false);
                      onOpenVoiceAssistant();
                    }}
                    className="w-full flex items-center justify-between gap-2.5 px-2.5 py-2 rounded-xl hover:bg-cyan-500/10 text-left transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-7 h-7 rounded-lg bg-cyan-500/15 border border-cyan-400/30 text-cyan-300 flex items-center justify-center shrink-0">
                        <Mic className="w-3.5 h-3.5" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-white truncate">Voice Assistant</div>
                        <div className="text-[10px] text-slate-400 truncate">Speak to Byte or Orion</div>
                      </div>
                    </div>
                    <span className="text-[10px] font-semibold text-cyan-300 shrink-0">Open</span>
                  </button>

                  {/* Sound Effects & Audio Settings */}
                  <div className="flex items-center gap-1.5 pt-0.5">
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        soundService.toggleMute();
                        setSoundPrefs(soundService.getPreferences());
                      }}
                      className={`flex-1 flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-xl border text-[11px] font-semibold transition-colors cursor-pointer ${
                        isMuted
                          ? 'bg-rose-500/15 border-rose-500/30 text-rose-300 hover:bg-rose-500/25'
                          : 'bg-slate-900 border-white/[0.08] text-slate-200 hover:bg-slate-800'
                      }`}
                    >
                      {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5 text-indigo-400" />}
                      <span>{isMuted ? 'Unmute SFX' : 'Mute SFX'}</span>
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        soundService.playButtonClick();
                        setVoiceMenuOpen(false);
                        onOpenSoundSettings();
                      }}
                      className="flex-1 flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-white/[0.08] text-[11px] font-semibold text-slate-200 transition-colors cursor-pointer"
                    >
                      <Sliders className="w-3.5 h-3.5 text-indigo-400" />
                      <span>Audio Lab</span>
                    </button>
                  </div>

                  {/* Display & Accessibility Parity Row */}
                  <div className="pt-1.5 mt-1 border-t border-white/[0.07] grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        soundService.playButtonClick();
                        onCycleFontSize();
                      }}
                      className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-slate-900/90 hover:bg-slate-800 border border-white/[0.06] text-[11px] text-slate-300 cursor-pointer"
                      title="Cycle interface text scale"
                    >
                      <span className="flex items-center gap-1.5">
                        <Type className="w-3 h-3 text-indigo-400" />
                        Text Size
                      </span>
                      <span className="font-mono text-[10px] text-indigo-300 uppercase">{fontSize === 'standard' ? '1x' : fontSize === 'large' ? '1.15x' : '1.3x'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        soundService.playButtonClick();
                        onToggleHighContrast();
                      }}
                      className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg border text-[11px] cursor-pointer transition-colors ${
                        highContrast
                          ? 'bg-indigo-600/25 border-indigo-400/40 text-white'
                          : 'bg-slate-900/90 hover:bg-slate-800 border-white/[0.06] text-slate-300'
                      }`}
                      title="Toggle high contrast surface"
                    >
                      <span className="flex items-center gap-1.5">
                        <Eye className="w-3 h-3 text-indigo-400" />
                        Contrast
                      </span>
                      {highContrast && <Check className="w-3 h-3 text-indigo-300" />}
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* 2. SECURITY BUTTON (Role-gated: Faculty & Admin) */}
          {canUseSecurity && (
            <motion.button
              type="button"
              whileHover={prefersReduced ? undefined : { y: -0.5 }}
              whileTap={prefersReduced ? undefined : { scale: 0.96 }}
              onClick={() => {
                soundService.playButtonClick();
                onOpenSecurityCenter();
              }}
              aria-label="Classroom Security Center"
              title={
                presentationMode
                  ? 'Classroom Security Center (Presentation Mode Active)'
                  : hasPinConfigured
                  ? 'Classroom Security Center (PIN Protected)'
                  : 'Classroom Security Center'
              }
              className={`relative h-8 sm:h-9 px-2 sm:px-3 rounded-xl border text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/70 ${
                presentationMode
                  ? 'bg-indigo-600/25 border-indigo-400/50 text-indigo-100 shadow-[0_0_18px_-6px_rgba(99,102,241,0.65)]'
                  : 'bg-slate-950/60 border-white/[0.06] text-slate-300 hover:text-white hover:bg-slate-800/80 hover:border-white/15'
              }`}
            >
              {presentationMode ? (
                <Lock className="w-3.5 h-3.5 text-teal-300 shrink-0" />
              ) : (
                <ShieldCheck
                  className={`w-3.5 h-3.5 shrink-0 ${
                    hasPinConfigured ? 'text-emerald-400' : 'text-slate-300'
                  }`}
                />
              )}
              <span className="hidden sm:inline tracking-tight">Security</span>
              <span
                className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                  presentationMode
                    ? `bg-teal-400 ${prefersReduced ? '' : 'animate-pulse'}`
                    : hasPinConfigured
                    ? 'bg-emerald-400/85'
                    : 'bg-amber-400/85'
                }`}
                aria-hidden="true"
              />
            </motion.button>
          )}

          {/* 3. BROADCAST BOX BUTTON (Role-gated: Staff & Admin) */}
          {canBroadcast && (
            <motion.button
              type="button"
              whileHover={prefersReduced ? undefined : { y: -0.5 }}
              whileTap={prefersReduced ? undefined : { scale: 0.96 }}
              onClick={() => {
                soundService.playAppearSound();
                onOpenBroadcast();
              }}
              aria-label="Open Broadcast Composer"
              title="Send School or Class Broadcast"
              className="relative h-8 sm:h-9 px-2.5 sm:px-3 rounded-xl bg-gradient-to-b from-indigo-500 to-indigo-600 hover:from-indigo-400 hover:to-indigo-500 border border-indigo-300/30 text-white font-semibold text-xs flex items-center gap-1.5 shadow-[0_6px_18px_-6px_rgba(79,70,229,0.75)] transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300/80"
            >
              <Megaphone className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden sm:inline tracking-tight">Broadcast</span>
            </motion.button>
          )}

          {/* Hairline Divider before Notification Hub */}
          <span className="h-4 w-px bg-white/[0.08] mx-0.5 hidden sm:inline-block" aria-hidden="true" />

          {/* 4. NOTIFICATION BOX BUTTON */}
          <div className="relative">
            <motion.button
              type="button"
              whileHover={prefersReduced ? undefined : { y: -0.5 }}
              whileTap={prefersReduced ? undefined : { scale: 0.95 }}
              onClick={() => {
                soundService.playAppearSound();
                onToggleNotifCenter();
              }}
              aria-label={
                unreadNotificationsCount > 0
                  ? `Open Notifications Panel (${unreadNotificationsCount} unread)`
                  : 'Open Notifications Panel'
              }
              aria-expanded={showNotifCenter}
              title="Academic Notification Hub"
              className={`relative h-8 sm:h-9 min-w-[36px] sm:min-w-[38px] px-2 rounded-xl border flex items-center justify-center gap-1.5 transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/70 ${
                showNotifCenter
                  ? 'bg-indigo-500/20 border-indigo-400/50 text-white shadow-[0_0_18px_-6px_rgba(99,102,241,0.65)]'
                  : 'bg-slate-950/60 border-white/[0.06] text-slate-300 hover:text-white hover:bg-slate-800/80 hover:border-indigo-400/35'
              }`}
            >
              <VeylentraIcon name="notification" size={17} />
              {unreadNotificationsCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 min-w-4 px-1 items-center justify-center rounded-full bg-indigo-500 ring-2 ring-slate-950 text-[9px] font-bold text-white font-mono tabular-nums leading-none shadow-sm">
                  {badgeText}
                </span>
              )}
            </motion.button>

            <NotificationCenter
              currentUser={currentUser}
              isOpen={showNotifCenter}
              onClose={onCloseNotifCenter}
              onNavigateTab={onNavigateTab}
            />
          </div>
        </div>

        {/* What's New Release Indicator */}
        <motion.button
          type="button"
          whileHover={prefersReduced ? undefined : { y: -0.5 }}
          whileTap={prefersReduced ? undefined : { scale: 0.96 }}
          onClick={() => onNavigateTab('whats_new')}
          aria-label="What's New & Release Logs"
          title="What's New in Veylentra"
          className={`relative h-9 sm:h-10 px-2.5 sm:px-3 rounded-xl text-xs font-medium transition-colors flex items-center gap-1.5 border cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/70 ${
            activeTab === 'whats_new' || activeTab === 'whats-new'
              ? 'bg-indigo-600 text-white border-indigo-400/60 shadow-sm'
              : 'bg-slate-900/80 border-white/[0.08] hover:bg-slate-800 text-slate-300 hover:text-white'
          }`}
        >
          <Sparkles
            className={`w-3.5 h-3.5 shrink-0 ${
              activeTab === 'whats_new' || activeTab === 'whats-new' ? 'text-white' : 'text-indigo-400'
            }`}
          />
          <span className="hidden md:inline">What&apos;s New</span>
          {whatsNewUnreadCount > 0 && (
            <span className="flex h-4 min-w-4 px-1 items-center justify-center rounded-full bg-rose-500 text-[9px] font-bold text-white font-mono tabular-nums leading-none">
              {whatsNewUnreadCount}
            </span>
          )}
        </motion.button>
      </div>
    </header>
  );
};
