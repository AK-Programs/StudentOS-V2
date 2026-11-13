/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Veylentra — Floating Byte Companion Widget
 * - Deterministic non-AI productivity reminders powered by byteReminderEngine
 * - Explains WHY each reminder needs attention and offers Done / Snooze / Dismiss
 * - Reliable 3000ms long-press using pointer events + movement threshold (>10px cancels hold)
 *   so scrolling, dragging, and quick taps work without interference
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Byte3DCanvas, Byte3DMood } from './Byte3DCanvas';
import { UserProfile, Task, Homework } from '../../types';
import {
  Flame,
  Volume2,
  VolumeX,
  X,
  Minus,
  ArrowRight,
  Check,
  Clock,
  Mic
} from 'lucide-react';
import { soundService } from '../../lib/soundService';
import { byteVoiceService } from '../../lib/byteVoiceService';
import {
  buildByteReminders,
  dismissByteReminder,
  markByteReminderHandled,
  snoozeByteReminder
} from '../../lib/byteReminderEngine';

interface FloatingByteWidgetProps {
  activeTab: string;
  currentUser: UserProfile | null;
  effectiveRole?: string;
  tasks?: Task[];
  homeworkList?: Homework[];
  submissions?: any[];
  assessments?: any[];
  announcements?: any[];
  dueCardsCount?: number;
  onNavigateTab: (tabId: string) => void;
  onOpenByteOrionModal?: (initialMode?: 'select' | 'byte' | 'orion') => void;
}

const MINIMIZED_STORAGE_KEY = 'studentos_byte_minimized';
const STREAK_STORAGE_KEY = 'studentos_byte_streak';
const AUTOVOICE_STORAGE_KEY = 'studentos_byte_autovoice';
const LONG_PRESS_DURATION_MS = 3000;
const MOVE_CANCEL_THRESHOLD_PX = 10;

function getTodayString(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export const FloatingByteWidget: React.FC<FloatingByteWidgetProps> = ({
  activeTab,
  currentUser,
  effectiveRole,
  tasks = [],
  homeworkList = [],
  submissions = [],
  assessments = [],
  announcements = [],
  dueCardsCount = 0,
  onNavigateTab,
  onOpenByteOrionModal
}) => {
  if (!currentUser) {
    return null;
  }

  const userId = currentUser.uid || currentUser.email || 'guest';
  const activeRole = effectiveRole || currentUser.role || 'student';

  const [isMinimized, setIsMinimized] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    try {
      const stored = localStorage.getItem(MINIMIZED_STORAGE_KEY);
      return stored === null ? true : stored === 'true';
    } catch {
      return true;
    }
  });

  const [voiceEnabled, setVoiceEnabled] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    try {
      return localStorage.getItem(AUTOVOICE_STORAGE_KEY) === 'true';
    } catch {
      return false;
    }
  });

  const [streakData, setStreakData] = useState<{ count: number; lastDate: string; softened: boolean }>(() => {
    const today = getTodayString();
    if (typeof window === 'undefined') return { count: 1, lastDate: today, softened: false };
    try {
      const raw = localStorage.getItem(STREAK_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        const last = new Date(parsed.lastDate);
        const curr = new Date(today);
        const diffDays = Math.round((curr.getTime() - last.getTime()) / (1000 * 3600 * 24));
        if (diffDays <= 1) return parsed;
        if (diffDays === 2) {
          const softened = { count: parsed.count, lastDate: today, softened: true };
          localStorage.setItem(STREAK_STORAGE_KEY, JSON.stringify(softened));
          return softened;
        }
        const fresh = { count: 1, lastDate: today, softened: false };
        localStorage.setItem(STREAK_STORAGE_KEY, JSON.stringify(fresh));
        return fresh;
      }
    } catch {
      // ignore storage errors
    }
    return { count: 1, lastDate: today, softened: false };
  });

  const [reminderVersion, setReminderVersion] = useState<number>(0);
  const [currentMood, setCurrentMood] = useState<Byte3DMood>('idle');
  const [rewardToast, setRewardToast] = useState<string | null>(null);
  const prevCompletedTasksCount = useRef<number>(tasks.filter(t => t.completed).length);

  // Pointer-safe 3000ms long-press refs & state
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pressOriginRef = useRef<{ x: number; y: number } | null>(null);
  const isLongPressTriggeredRef = useRef<boolean>(false);
  const [isPressing, setIsPressing] = useState<boolean>(false);
  const [pressProgress, setPressProgress] = useState<number>(0);

  const clearLongPressTimers = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    if (pressIntervalRef.current) {
      clearInterval(pressIntervalRef.current);
      pressIntervalRef.current = null;
    }
    pressOriginRef.current = null;
    setIsPressing(false);
    setPressProgress(0);
  };

  useEffect(() => {
    return () => {
      clearLongPressTimers();
      byteVoiceService.stop();
    };
  }, []);

  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    clearLongPressTimers();
    isLongPressTriggeredRef.current = false;
    pressOriginRef.current = { x: e.clientX, y: e.clientY };
    setIsPressing(true);
    setPressProgress(0);

    const startTime = Date.now();
    pressIntervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      setPressProgress(Math.min(100, Math.round((elapsed / LONG_PRESS_DURATION_MS) * 100)));
    }, 60);

    longPressTimerRef.current = setTimeout(() => {
      isLongPressTriggeredRef.current = true;
      clearLongPressTimers();
      soundService.playButtonClick();
      onOpenByteOrionModal?.('select');
    }, LONG_PRESS_DURATION_MS);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!pressOriginRef.current) return;
    const dx = e.clientX - pressOriginRef.current.x;
    const dy = e.clientY - pressOriginRef.current.y;
    if (Math.hypot(dx, dy) > MOVE_CANCEL_THRESHOLD_PX) {
      clearLongPressTimers();
    }
  };

  const handlePointerUp = () => {
    const triggered = isLongPressTriggeredRef.current;
    clearLongPressTimers();
    if (!triggered) {
      handleToggleMinimize(false);
    }
  };

  const isAllowedTab = useMemo(() => {
    const allowed = [
      'dashboard',
      'study_hub',
      'tasks',
      'planner',
      'flashcards',
      'materials',
      'homework',
      'assignment_center',
      'whats_new',
      'whats-new',
      'faculty',
      'academics',
      'attendance',
      'attendance_manager',
      'gradebook',
      'classes'
    ];
    return allowed.includes(activeTab);
  }, [activeTab]);

  // Real deterministic reminders from Byte Engine (zero AI)
  const activeReminders = useMemo(
    () =>
      buildByteReminders({
        currentUser,
        effectiveRole: activeRole,
        homeworkList,
        submissions,
        assessments,
        tasks,
        announcements,
        dueCardsCount
      }),
    [currentUser, activeRole, homeworkList, submissions, assessments, tasks, announcements, dueCardsCount, reminderVersion]
  );

  const topReminder = activeReminders[0] || null;

  const speakLine = (text: string) => {
    if (!text || !voiceEnabled) return;
    setCurrentMood('speaking');
    byteVoiceService.speak(text, {
      speed: 1.05,
      onEnd: () => setCurrentMood('idle'),
      onError: () => setCurrentMood('idle')
    });
  };

  const handleToggleMinimize = (toMinimized: boolean) => {
    setIsMinimized(toMinimized);
    try {
      localStorage.setItem(MINIMIZED_STORAGE_KEY, String(toMinimized));
    } catch {
      // ignore storage errors
    }
    if (!toMinimized) {
      setCurrentMood('wave');
      setTimeout(() => setCurrentMood('idle'), 2400);
      if (topReminder && voiceEnabled) {
        speakLine(`${topReminder.title}. ${topReminder.reason}`);
      }
    }
  };

  const handleToggleVoice = (e: React.MouseEvent) => {
    e.stopPropagation();
    const next = !voiceEnabled;
    setVoiceEnabled(next);
    try {
      localStorage.setItem(AUTOVOICE_STORAGE_KEY, String(next));
    } catch {
      // ignore
    }
    if (next && topReminder) {
      speakLine(topReminder.title);
    } else if (!next) {
      byteVoiceService.stop();
      setCurrentMood('idle');
    }
  };

  // Celebrate completed personal tasks
  useEffect(() => {
    const currentCompleted = tasks.filter(t => t.completed).length;
    if (currentCompleted > prevCompletedTasksCount.current) {
      setCurrentMood('celebration');
      try {
        soundService.playFlashcardKnowIt(5);
      } catch {
        // ignore audio errors
      }
      const today = getTodayString();
      setStreakData(prev => {
        const nextCount = prev.lastDate === today ? prev.count : prev.count + 1;
        const updated = { count: nextCount, lastDate: today, softened: false };
        try {
          localStorage.setItem(STREAK_STORAGE_KEY, JSON.stringify(updated));
        } catch {
          // ignore
        }
        return updated;
      });
      setRewardToast('+15 XP · Task Completed');
      setTimeout(() => setRewardToast(null), 3200);
      setTimeout(() => setCurrentMood('idle'), 2800);
    }
    prevCompletedTasksCount.current = currentCompleted;
  }, [tasks]);

  if (!isAllowedTab) {
    return null;
  }

  return (
    <>
      <AnimatePresence>
        {rewardToast && (
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.94 }}
            className="fixed bottom-28 right-4 sm:bottom-24 sm:right-6 z-50 bg-emerald-500 text-slate-950 px-4 py-2 rounded-xl shadow-xl font-extrabold text-xs flex items-center gap-2 border border-white/20 select-none"
          >
            <Check className="w-4 h-4" />
            <span>{rewardToast}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <div
        className="fixed bottom-20 right-3.5 sm:bottom-6 sm:right-6 md:bottom-8 md:right-8 z-40 flex flex-col items-end pointer-events-none select-none"
        aria-label="Byte Productivity Companion"
      >
        <AnimatePresence mode="wait">
          {!isMinimized && (
            <motion.div
              key="expanded"
              initial={{ opacity: 0, scale: 0.9, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 12 }}
              transition={{ type: 'spring', damping: 26, stiffness: 340 }}
              className="pointer-events-auto mb-2 w-[290px] sm:w-[325px] bg-slate-950/95 backdrop-blur-2xl border border-slate-800 rounded-2xl p-4 shadow-2xl space-y-3"
            >
              {/* Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-extrabold text-white text-xs tracking-tight">Byte</span>
                  <div
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/15 border border-amber-500/30 text-[10px] font-bold text-amber-300 tabular-nums"
                    title={streakData.softened ? 'Streak protected' : `${streakData.count}-day streak`}
                  >
                    <Flame className="w-3 h-3 text-amber-400" />
                    <span>{streakData.count}</span>
                  </div>
                  <span className="text-[10px] font-semibold text-slate-400 tabular-nums">
                    {activeReminders.length} queued
                  </span>
                </div>

                <div className="flex items-center gap-1">
                  {onOpenByteOrionModal && (
                    <button
                      type="button"
                      onClick={() => onOpenByteOrionModal('select')}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-cyan-300 hover:bg-slate-800 transition-colors cursor-pointer"
                      title="Voice & Byte / Orion Selector"
                    >
                      <Mic className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleToggleVoice}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                    title={voiceEnabled ? 'Mute voice' : 'Enable voice'}
                  >
                    {voiceEnabled ? (
                      <Volume2 className="w-3.5 h-3.5 text-cyan-400" />
                    ) : (
                      <VolumeX className="w-3.5 h-3.5" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleToggleMinimize(true)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                    title="Minimize Byte"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Character + Active Deterministic Reminder */}
              <div className="flex items-start gap-3">
                <div className="shrink-0 w-16 h-16 flex items-center justify-center relative">
                  <Byte3DCanvas
                    size={64}
                    mood={currentMood}
                    interactiveGaze={true}
                    onClick={() => {
                      setCurrentMood('wave');
                      if (voiceEnabled && topReminder) speakLine(topReminder.title);
                      setTimeout(() => setCurrentMood('idle'), 2200);
                    }}
                  />
                </div>

                <div className="flex-1 min-w-0 space-y-1">
                  {topReminder ? (
                    <>
                      <p className="text-xs font-bold text-white leading-snug">
                        {topReminder.title}
                      </p>
                      <p className="text-[11px] text-slate-400 leading-snug">
                        {topReminder.reason}
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-xs font-bold text-emerald-300 leading-snug">
                        All caught up
                      </p>
                      <p className="text-[11px] text-slate-400 leading-snug">
                        No pending deadlines or urgent alerts right now.
                      </p>
                    </>
                  )}
                </div>
              </div>

              {/* Action Row */}
              {topReminder ? (
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={() => {
                      soundService.playButtonClick();
                      onNavigateTab(topReminder.actionTab);
                      handleToggleMinimize(true);
                    }}
                    className="w-full py-2 px-3 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <span>{topReminder.actionLabel}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>

                  <div className="grid grid-cols-3 gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        markByteReminderHandled(userId, topReminder.id);
                        setReminderVersion(v => v + 1);
                      }}
                      className="py-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/25 text-[10px] font-bold flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <Check className="w-3 h-3" />
                      <span>Done</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        snoozeByteReminder(userId, topReminder.id);
                        setReminderVersion(v => v + 1);
                      }}
                      className="py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 text-[10px] font-semibold flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <Clock className="w-3 h-3" />
                      <span>Snooze 1h</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        dismissByteReminder(userId, topReminder.id);
                        setReminderVersion(v => v + 1);
                      }}
                      className="py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 text-[10px] font-semibold flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                      <span>Dismiss</span>
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => onOpenByteOrionModal?.('select')}
                  className="w-full py-2 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Mic className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Open Byte / Orion Assistant</span>
                </button>
              )}
            </motion.div>
          )}

          {isMinimized && (
            <div className="relative">
              {isPressing && (
                <div className="absolute -inset-1.5 rounded-full pointer-events-none z-10 flex items-center justify-center">
                  <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="46" fill="none" stroke="rgba(14, 165, 233, 0.25)" strokeWidth="6" />
                    <circle
                      cx="50"
                      cy="50"
                      r="46"
                      fill="none"
                      stroke="#0ea5e9"
                      strokeWidth="6"
                      strokeDasharray="289"
                      strokeDashoffset={289 - (289 * pressProgress) / 100}
                      strokeLinecap="round"
                    />
                  </svg>
                  <span className="absolute -top-7 text-[10px] font-bold text-cyan-200 bg-slate-950/95 px-2.5 py-0.5 rounded-md border border-sky-500/40 whitespace-nowrap">
                    Hold 3s for Byte / Orion
                  </span>
                </div>
              )}

              <motion.button
                key="minimized"
                type="button"
                initial={{ scale: 0.85, opacity: 0 }}
                animate={{ scale: isPressing ? 1.08 : 1, opacity: 1 }}
                exit={{ scale: 0.85, opacity: 0 }}
                whileHover={{ scale: 1.05 }}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={clearLongPressTimers}
                onKeyDown={e => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleToggleMinimize(false);
                  }
                }}
                className="pointer-events-auto relative w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-slate-950/95 backdrop-blur-xl border border-sky-500/35 p-0 flex items-center justify-center shadow-[0_8px_30px_rgba(14,165,233,0.25)] hover:border-sky-400 transition-colors cursor-pointer touch-none"
                title="Tap to open Byte · Hold 3s for Byte / Orion Selector"
              >
                <div className="relative w-full h-full flex items-center justify-center">
                  <Byte3DCanvas size={58} mood={currentMood} interactiveGaze={true} />
                </div>

                {activeReminders.some(r => r.priority === 'urgent' || r.priority === 'high') && (
                  <span className="absolute top-0 right-0 w-3.5 h-3.5 rounded-full bg-rose-500 border-2 border-slate-950" />
                )}
              </motion.button>
            </div>
          )}
        </AnimatePresence>
      </div>
    </>
  );
};
