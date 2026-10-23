/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * StudentOS — Floating Byte Widget with Duolingo-style Retention Mechanics
 * - Renders a 3D animated Byte character (idle bob, blink, wave, nod)
 * - Appears on Home, Study, Notices, Homework, and Tasks
 * - Small minimized bubble by default; student can toggle and state is remembered
 * - Positioned safely above phone bottom bar (never occludes buttons)
 * - Duolingo-style retention:
 *   - One short friend-like message at a time (no "As an AI", no walls of text)
 *   - Greet once per session, remind once if homework is due today, celebrate completed tasks
 *   - Single clear action button (Do homework, Open notice, Start challenge, Continue learning)
 *   - Session deduplication (never repeats same message in same session)
 *   - Softened streak mechanics (cushions missed days, never punishes, private practice)
 *   - Natural voice speech with mute toggle; text always visible on screen
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Byte3DCanvas, Byte3DMood } from './Byte3DCanvas';
import { UserProfile, Task, Homework } from '../../types';
import { 
  Flame, Sparkles, Volume2, VolumeX, X, Minus, 
  ArrowRight, CheckCircle2, Shield, Heart, Bell
} from 'lucide-react';
import { soundService } from '../../lib/soundService';
import { byteVoiceService } from '../../lib/byteVoiceService';

interface FloatingByteWidgetProps {
  activeTab: string;
  currentUser: UserProfile | null;
  tasks?: Task[];
  homeworkList?: Homework[];
  announcements?: any[];
  dueCardsCount?: number;
  onNavigateTab: (tabId: string) => void;
}

interface ByteNudge {
  id: string;
  type: 'greet' | 'homework' | 'task' | 'flashcard' | 'notice' | 'challenge' | 'celebrate';
  text: string;
  actionLabel: string;
  actionTab: string;
  mood: Byte3DMood;
}

const MINIMIZED_STORAGE_KEY = 'studentos_byte_minimized';
const STREAK_STORAGE_KEY = 'studentos_byte_streak';
const SHOWN_MESSAGES_SESSION_KEY = 'studentos_byte_shown_session_msgs';
const AUTOVOICE_STORAGE_KEY = 'studentos_byte_autovoice';

// Get today's local date string YYYY-MM-DD
function getTodayString(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export const FloatingByteWidget: React.FC<FloatingByteWidgetProps> = ({
  activeTab,
  currentUser,
  tasks = [],
  homeworkList = [],
  announcements = [],
  dueCardsCount = 0,
  onNavigateTab
}) => {
  // 1. Minimized state (defaults to true; student toggle remembered in localStorage)
  const [isMinimized, setIsMinimized] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    try {
      const stored = localStorage.getItem(MINIMIZED_STORAGE_KEY);
      return stored === null ? true : stored === 'true';
    } catch (_) {
      return true;
    }
  });

  // 2. Voice speech preference
  const [voiceEnabled, setVoiceEnabled] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    try {
      const stored = localStorage.getItem(AUTOVOICE_STORAGE_KEY);
      return stored === 'true';
    } catch (_) {
      return false;
    }
  });

  // 3. Duolingo-style Softened Streak state
  const [streakData, setStreakData] = useState<{ count: number; lastDate: string; softened: boolean }>(() => {
    const today = getTodayString();
    if (typeof window === 'undefined') return { count: 3, lastDate: today, softened: false };
    try {
      const raw = localStorage.getItem(STREAK_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        // Softened streak calculation
        const last = new Date(parsed.lastDate);
        const curr = new Date(today);
        const diffDays = Math.round((curr.getTime() - last.getTime()) / (1000 * 3600 * 24));

        if (diffDays === 0) {
          return parsed;
        } else if (diffDays === 1) {
          // Normal consecutive day
          return parsed;
        } else if (diffDays === 2) {
          // Missed 1 day: Duolingo-style SOFTENED streak freeze (never punishes the student)
          const softened = { count: parsed.count, lastDate: today, softened: true };
          localStorage.setItem(STREAK_STORAGE_KEY, JSON.stringify(softened));
          return softened;
        } else {
          // More than 2 days: gently restart at 1
          const fresh = { count: 1, lastDate: today, softened: false };
          localStorage.setItem(STREAK_STORAGE_KEY, JSON.stringify(fresh));
          return fresh;
        }
      }
    } catch (_) {}
    return { count: 3, lastDate: today, softened: false };
  });

  // 4. Session deduplication: track messages shown this session
  const [shownSessionIds, setShownSessionIds] = useState<Set<string>>(() => {
    if (typeof window === 'undefined') return new Set();
    try {
      const raw = sessionStorage.getItem(SHOWN_MESSAGES_SESSION_KEY);
      if (raw) return new Set(JSON.parse(raw));
    } catch (_) {}
    return new Set();
  });

  // Current active nudge
  const [activeNudge, setActiveNudge] = useState<ByteNudge | null>(null);
  const [currentMood, setCurrentMood] = useState<Byte3DMood>('idle');
  const [rewardToast, setRewardToast] = useState<string | null>(null);

  // Completed tasks count tracker to trigger celebratory nod
  const prevCompletedTasksCount = useRef<number>(tasks.filter(t => t.completed).length);

  // Check if current tab is one of the allowed tabs
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
      'whats-new'
    ];
    return allowed.includes(activeTab);
  }, [activeTab]);

  // Persist minimized state
  const handleToggleMinimize = (toMinimized: boolean) => {
    setIsMinimized(toMinimized);
    try {
      localStorage.setItem(MINIMIZED_STORAGE_KEY, String(toMinimized));
    } catch (_) {}
    if (!toMinimized) {
      // When opened: wave arm & trigger short speech if enabled
      setCurrentMood('wave');
      setTimeout(() => setCurrentMood('idle'), 2500);
      if (activeNudge && voiceEnabled) {
        speakLine(activeNudge.text);
      }
    }
  };

  // Toggle voice
  const handleToggleVoice = (e: React.MouseEvent) => {
    e.stopPropagation();
    const next = !voiceEnabled;
    setVoiceEnabled(next);
    try {
      localStorage.setItem(AUTOVOICE_STORAGE_KEY, String(next));
    } catch (_) {}
    if (next && activeNudge) {
      speakLine(activeNudge.text);
    }
  };

  // Clean up speech on unmount
  useEffect(() => {
    return () => {
      byteVoiceService.stop();
    };
  }, []);

  // Speaks aloud with natural Edge TTS voice (Hindi/English neural)
  const speakLine = (text: string) => {
    if (!text || !voiceEnabled) return;
    setCurrentMood('speaking');
    byteVoiceService.speak(text, {
      speed: 1.05,
      onEnd: () => {
        setCurrentMood('idle');
      },
      onError: () => {
        setCurrentMood('idle');
      }
    });
  };

  // Mark message as shown in session
  const markMessageShown = (id: string) => {
    setShownSessionIds(prev => {
      const next = new Set(prev);
      next.add(id);
      try {
        sessionStorage.setItem(SHOWN_MESSAGES_SESSION_KEY, JSON.stringify(Array.from(next)));
      } catch (_) {}
      return next;
    });
  };

  // --- RETENTION ENGINE: Pick the single highest-priority short update ---
  useEffect(() => {
    const today = getTodayString();
    const studentName = currentUser?.name?.split(' ')[0] || 'Friend';

    // 1. Priority A: Homework due today (Unfinished)
    const dueTodayHw = homeworkList.find(h => {
      if (!h.dueDate) return false;
      const isDue = h.dueDate.toLowerCase().includes('today') || h.dueDate === today;
      const isDone = (h.completedList || []).includes(currentUser?.uid || currentUser?.email || '');
      return isDue && !isDone;
    });

    if (dueTodayHw && !shownSessionIds.has(`hw-${dueTodayHw.id}`)) {
      const nudge: ByteNudge = {
        id: `hw-${dueTodayHw.id}`,
        type: 'homework',
        text: `${dueTodayHw.subject || 'Class'} homework is due today.`,
        actionLabel: 'Do homework',
        actionTab: 'homework',
        mood: 'wave'
      };
      setActiveNudge(nudge);
      return;
    }

    // 2. Priority B: Due flashcards from spaced repetition
    if (dueCardsCount > 0 && !shownSessionIds.has(`cards-${dueCardsCount}`)) {
      const nudge: ByteNudge = {
        id: `cards-${dueCardsCount}`,
        type: 'flashcard',
        text: dueCardsCount === 1 ? 'One card left from yesterday.' : `${dueCardsCount} cards ready for review.`,
        actionLabel: 'Continue learning',
        actionTab: 'study_hub',
        mood: 'wave'
      };
      setActiveNudge(nudge);
      return;
    }

    // 3. Priority C: Unfinished urgent task
    const pendingTask = tasks.find(t => !t.completed && (t.dueDate?.toLowerCase().includes('today') || t.dueDate?.toLowerCase().includes('tomorrow')));
    if (pendingTask && !shownSessionIds.has(`task-${pendingTask.id}`)) {
      const nudge: ByteNudge = {
        id: `task-${pendingTask.id}`,
        type: 'task',
        text: `"${pendingTask.title.substring(0, 28)}" is waiting for you.`,
        actionLabel: 'Continue learning',
        actionTab: 'study_hub',
        mood: 'idle'
      };
      setActiveNudge(nudge);
      return;
    }

    // 4. Priority D: New school circular / notice
    const unreadNotice = announcements.find(a => !shownSessionIds.has(`notice-${a.id || a.title}`));
    if (unreadNotice) {
      const nudge: ByteNudge = {
        id: `notice-${unreadNotice.id || unreadNotice.title}`,
        type: 'notice',
        text: `New circular: "${unreadNotice.title?.substring(0, 30) || 'School update'}".`,
        actionLabel: 'Open notice',
        actionTab: 'whats_new',
        mood: 'wave'
      };
      setActiveNudge(nudge);
      return;
    }

    // 5. Priority E: Daily Quiz / Class Challenge
    if (!shownSessionIds.has('daily-quiz-challenge')) {
      const nudge: ByteNudge = {
        id: 'daily-quiz-challenge',
        type: 'challenge',
        text: 'Quick 2-minute quiz challenge is ready.',
        actionLabel: 'Start challenge',
        actionTab: 'brain_battle',
        mood: 'happy'
      };
      setActiveNudge(nudge);
      return;
    }

    // 6. Default Fallback: Friendly peer greeting (Greet once on app open)
    if (!shownSessionIds.has('daily-greeting')) {
      const nudge: ByteNudge = {
        id: 'daily-greeting',
        type: 'greet',
        text: `Hey ${studentName}! Ready for a quick session?`,
        actionLabel: 'Continue learning',
        actionTab: 'study_hub',
        mood: 'wave'
      };
      setActiveNudge(nudge);
      return;
    }

    // If all cycled through, keep a warm gentle study nudge
    if (!activeNudge) {
      setActiveNudge({
        id: 'study-general',
        type: 'greet',
        text: "You're on track! Tap anytime to practice.",
        actionLabel: 'Continue learning',
        actionTab: 'study_hub',
        mood: 'idle'
      });
    }
  }, [homeworkList, tasks, announcements, dueCardsCount, currentUser?.name, shownSessionIds]);

  // Listen for task completion events to celebrate with nod animation
  useEffect(() => {
    const currentCompleted = tasks.filter(t => t.completed).length;
    if (currentCompleted > prevCompletedTasksCount.current) {
      // Celebratory nod & Duolingo-style streak reward
      setCurrentMood('celebration');
      try {
        soundService.playFlashcardKnowIt(5);
      } catch (_) {}

      // Increment streak
      const today = getTodayString();
      setStreakData(prev => {
        const nextCount = prev.lastDate === today ? prev.count : prev.count + 1;
        const updated = { count: nextCount, lastDate: today, softened: false };
        try {
          localStorage.setItem(STREAK_STORAGE_KEY, JSON.stringify(updated));
        } catch (_) {}
        return updated;
      });

      // Show reward toast
      setRewardToast('+15 Scholar XP • Streak protected 🔥');
      setTimeout(() => setRewardToast(null), 3500);

      // Short celebratory line
      const celebrateNudge: ByteNudge = {
        id: `celebrate-${Date.now()}`,
        type: 'celebrate',
        text: 'Nice, that task is done! 🔥',
        actionLabel: 'Continue learning',
        actionTab: 'study_hub',
        mood: 'celebration'
      };
      setActiveNudge(celebrateNudge);
      if (voiceEnabled) speakLine(celebrateNudge.text);

      setTimeout(() => setCurrentMood('idle'), 3000);
    }
    prevCompletedTasksCount.current = currentCompleted;
  }, [tasks, voiceEnabled]);

  // If not on an allowed tab, do not render
  if (!isAllowedTab) {
    return null;
  }

  // Handle Action Click
  const handleExecuteAction = () => {
    if (!activeNudge) return;
    markMessageShown(activeNudge.id);
    onNavigateTab(activeNudge.actionTab);
    // Smoothly minimize after starting action so student focuses on their work
    handleToggleMinimize(true);
  };

  return (
    <>
      {/* Small Reward Toast on Finish */}
      <AnimatePresence>
        {rewardToast && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.9 }}
            className="fixed bottom-28 right-4 sm:bottom-24 sm:right-6 z-50 bg-gradient-to-r from-amber-500 to-emerald-500 text-slate-950 px-4 py-2 rounded-2xl shadow-xl font-black text-xs flex items-center gap-2 border border-white/20 select-none"
          >
            <Sparkles className="w-4 h-4" />
            <span>{rewardToast}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Container: Positioned strictly above the phone bottom bar */}
      <div 
        className="fixed bottom-20 right-3.5 sm:bottom-6 sm:right-6 md:bottom-8 md:right-8 z-40 flex flex-col items-end pointer-events-none select-none"
        aria-label="Byte 3D Assistant"
      >
        <AnimatePresence mode="wait">
          {/* =========================================================
              EXPANDED MODE: Sleek Duolingo-style Speech Bubble + 3D Byte
          ========================================================== */}
          {!isMinimized && activeNudge && (
            <motion.div
              key="expanded"
              initial={{ opacity: 0, scale: 0.85, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.85, y: 15 }}
              transition={{ type: 'spring', damping: 25, stiffness: 350 }}
              className="pointer-events-auto mb-2 w-[275px] sm:w-[310px] bg-slate-950/95 backdrop-blur-2xl border border-white/15 rounded-3xl p-4 shadow-2xl space-y-3 relative overflow-hidden"
            >
              {/* Top Bar: Name, Streak Badge, Minimize & Voice Toggles */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="font-extrabold text-white text-xs tracking-tight">Byte</span>
                  {/* Softened Streak indicator (Never punitive, private) */}
                  <div 
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-[10px] font-black text-amber-400"
                    title={streakData.softened ? "Streak cushioned! You're back on track." : `${streakData.count} day study streak!`}
                  >
                    <Flame className="w-3 h-3 text-amber-400" />
                    <span>{streakData.count}</span>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  {/* Voice Speak toggle */}
                  <button
                    onClick={handleToggleVoice}
                    className="p-1 rounded-lg text-slate-400 hover:text-white transition-colors cursor-pointer"
                    title={voiceEnabled ? 'Mute voice' : 'Enable voice'}
                  >
                    {voiceEnabled ? (
                      <Volume2 className="w-3.5 h-3.5 text-cyan-400" />
                    ) : (
                      <VolumeX className="w-3.5 h-3.5" />
                    )}
                  </button>

                  {/* Minimize button */}
                  <button
                    onClick={() => handleToggleMinimize(true)}
                    className="p-1 rounded-lg text-slate-400 hover:text-white transition-colors cursor-pointer"
                    title="Minimize Byte"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Character + Message Row */}
              <div className="flex items-center gap-3">
                {/* 3D Byte Character */}
                <div className="shrink-0 w-16 h-16 flex items-center justify-center relative">
                  <div className="absolute inset-0 bg-cyan-500/10 rounded-full blur-md" />
                  <Byte3DCanvas
                    size={68}
                    mood={currentMood}
                    interactiveGaze={true}
                    onClick={() => {
                      setCurrentMood('wave');
                      if (voiceEnabled) speakLine(activeNudge.text);
                      setTimeout(() => setCurrentMood('idle'), 2500);
                    }}
                  />
                </div>

                {/* Natural Short Speech Text */}
                <div className="flex-1">
                  <p className="text-xs font-semibold text-slate-100 leading-snug">
                    {activeNudge.text}
                  </p>
                </div>
              </div>

              {/* Single Clear Action Button (Duolingo style) */}
              <button
                onClick={handleExecuteAction}
                className="w-full py-2 px-3 rounded-xl bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white font-black text-xs flex items-center justify-center gap-1.5 shadow-md shadow-cyan-600/20 transition-all cursor-pointer active:scale-98"
              >
                <span>{activeNudge.actionLabel}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </motion.div>
          )}

          {/* =========================================================
              MINIMIZED MODE: Cute Compact 3D Floating Bubble
          ========================================================== */}
          {isMinimized && (
            <motion.button
              key="minimized"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              whileHover={{ scale: 1.06 }}
              whileTap={{ scale: 0.94 }}
              onClick={() => handleToggleMinimize(false)}
              className="pointer-events-auto relative w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-slate-950/90 backdrop-blur-xl border border-cyan-500/30 p-0 flex items-center justify-center shadow-[0_8px_30px_rgb(6,182,212,0.25)] hover:border-cyan-400 transition-colors cursor-pointer group"
              title="Open Byte · 3D Study Buddy"
            >
              {/* Subtle ambient pulse ring */}
              <div className="absolute inset-0 rounded-full bg-cyan-500/10 group-hover:bg-cyan-500/20 transition-colors" />

              {/* 3D Byte Head Canvas */}
              <div className="relative w-full h-full flex items-center justify-center">
                <Byte3DCanvas
                  size={58}
                  mood={currentMood}
                  interactiveGaze={true}
                />
              </div>

              {/* Notification Badge if urgent homework or due card */}
              {(dueCardsCount > 0 || homeworkList.some(h => h.dueDate?.toLowerCase().includes('today'))) && (
                <span className="absolute top-0 right-0 w-3.5 h-3.5 rounded-full bg-rose-500 border-2 border-slate-950" />
              )}
            </motion.button>
          )}
        </AnimatePresence>
      </div>
    </>
  );
};
