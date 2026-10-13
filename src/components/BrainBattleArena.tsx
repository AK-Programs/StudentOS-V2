/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * StudentOS Brain Battle — Complete Mini-Game Implementation
 *
 * Integrated Animated UI Components from requested libraries:
 * 1. Magic UI (`NumberTicker` & `AnimatedCircularProgressBar`) — Spring-interpolated tabular counter & circular countdown/mastery ring.
 * 2. Aceternity UI (`CardSpotlight` & `MovingBorderCard`) — Mouse-tracking radial spotlight surface and animated conic border card.
 * 3. React Bits (`SplitTextReveal` & `TiltedCard`) — Staggered spring word/character entrance reveal & 3D perspective interactive tilt card.
 * 4. UIverse (`UIversePushableButton` & `UIverseTactileOptionButton`) — Multi-layered 3D tactile arcade Play button & option cards.
 * 5. Motion (`motion/react` `AnimatePresence` & `layoutId` shared layout transitions) — Smooth question slides, tab indicator, and leaderboard reordering.
 */

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  motion,
  AnimatePresence,
  useMotionValue,
  useSpring,
  useTransform,
  useReducedMotion
} from 'motion/react';
import {
  Trophy,
  Zap,
  Flame,
  Users,
  Play,
  Clock,
  CheckCircle2,
  XCircle,
  Award,
  Sparkles,
  BookOpen,
  Plus,
  ChevronRight,
  RotateCcw,
  Shield,
  Crown,
  Target,
  Volume2,
  VolumeX,
  Copy,
  Check,
  ArrowLeft,
  HelpCircle,
  Swords,
  History,
  Layers
} from 'lucide-react';
import { UserProfile, UserRole } from '../types';
import { MOCK_QUIZZES } from '../mockData';
import {
  SCHOLAR_LEVELS,
  GAMIFICATION_BADGES,
  StudentGamificationStats,
  calculateLevelInfo,
  getLocalGamificationProfile,
  fetchGamificationLeaderboard,
  awardStudentXP,
  getTodayDateString
} from '../lib/gamification';
import { subscribeRealtimeEvents, sendRealtimeEvent } from '../lib/wsHelper';
import { supabase } from '../lib/supabase';
import { soundService } from '../lib/soundService';
import { BrainBattleExamPrep } from './BrainBattleExamPrep';

export interface BrainBattleQuestion {
  id: string;
  subject: string;
  question: string;
  options: string[];
  correctOptionIndex: number;
  explanation: string;
  difficulty: 'easy' | 'medium' | 'hard';
  grade?: string;
  createdBy?: string;
  createdByName?: string;
}

export interface BrainBattleHistoryItem {
  id: string;
  userId: string;
  userName: string;
  userRole: string;
  house?: string;
  grade?: string;
  mode: 'quick_play' | 'daily_challenge' | 'multiplayer' | 'custom_practice';
  subject: string;
  score: number;
  correctCount: number;
  totalQuestions: number;
  accuracyPercent: number;
  xpEarned: number;
  streakPeak: number;
  durationSec: number;
  roomCode?: string;
  rankInMatch?: number;
  timestamp: string;
}

interface BrainBattlePlayerState {
  userId: string;
  name: string;
  role: string;
  house?: string;
  grade?: string;
  avatar?: string;
  score: number;
  correctCount: number;
  streak: number;
  answeredCurrentIndex: number;
  lastAnswerCorrect?: boolean;
  joinedAt: number;
}

interface BrainBattleRoomState {
  code: string;
  hostId: string;
  hostName: string;
  subject: string;
  difficulty: 'all' | 'easy' | 'medium' | 'hard';
  questionCount: number;
  timePerQuestion: number;
  status: 'lobby' | 'active' | 'completed';
  currentQuestionIndex: number;
  questionStartedAt: number;
  questions: BrainBattleQuestion[];
  players: Record<string, BrainBattlePlayerState>;
  createdAt: number;
  updatedAt: number;
}

// ============================================================================
// 1. MAGIC UI COMPONENT: NumberTicker (Spring-animated tabular numeric counter)
// Source: https://magicui.design/docs/components/number-ticker
// ============================================================================
export const MagicNumberTicker: React.FC<{
  value: number;
  prefix?: string;
  suffix?: string;
  className?: string;
}> = ({ value, prefix = '', suffix = '', className = '' }) => {
  const prefersReducedMotion = useReducedMotion();
  const motionVal = useMotionValue(0);
  const springVal = useSpring(motionVal, {
    damping: 28,
    stiffness: 180,
    mass: 0.8
  });
  const [displayValue, setDisplayValue] = useState<number>(value);

  useEffect(() => {
    if (prefersReducedMotion) {
      setDisplayValue(value);
      return;
    }
    motionVal.set(value);
  }, [value, motionVal, prefersReducedMotion]);

  useEffect(() => {
    const unsub = springVal.on('change', (latest) => {
      setDisplayValue(Math.round(latest));
    });
    return () => unsub();
  }, [springVal]);

  return (
    <span className={`font-mono tabular-nums ${className}`}>
      {prefix}
      {displayValue.toLocaleString()}
      {suffix}
    </span>
  );
};

// ============================================================================
// 2. MAGIC UI COMPONENT: AnimatedCircularProgressBar
// Source: https://magicui.design/docs/components/animated-circular-progress-bar
// ============================================================================
export const MagicCircularProgress: React.FC<{
  value: number;
  max: number;
  size?: number;
  strokeWidth?: number;
  label?: string;
  sublabel?: string;
  dangerThreshold?: number;
}> = ({
  value,
  max,
  size = 64,
  strokeWidth = 6,
  label,
  sublabel,
  dangerThreshold = 4
}) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0;
  const strokeDashoffset = circumference - pct * circumference;
  const isDanger = value <= dangerThreshold;

  return (
    <div className="relative inline-flex items-center justify-center shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90 transform">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="transparent"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-slate-800"
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="transparent"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          animate={{ strokeDashoffset }}
          transition={{ duration: 0.35, ease: 'easeOut' }}
          strokeLinecap="round"
          className={isDanger ? 'text-rose-500' : 'text-indigo-400'}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className={`font-mono font-black tabular-nums text-xs sm:text-sm ${isDanger ? 'text-rose-400 animate-pulse' : 'text-white'}`}>
          {label ?? `${value}s`}
        </span>
        {sublabel && <span className="text-[8px] uppercase text-slate-400 font-bold">{sublabel}</span>}
      </div>
    </div>
  );
};

// ============================================================================
// 3. ACETERNITY UI COMPONENT: CardSpotlight (Mouse-tracking radial spotlight)
// Source: https://ui.aceternity.com/components/card-spotlight
// ============================================================================
export const AceternityCardSpotlight: React.FC<{
  children: React.ReactNode;
  className?: string;
  spotlightColor?: string;
  onClick?: () => void;
}> = ({
  children,
  className = '',
  spotlightColor = 'rgba(99, 102, 241, 0.16)',
  onClick
}) => {
  const divRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [opacity, setOpacity] = useState(0);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!divRef.current) return;
    const rect = divRef.current.getBoundingClientRect();
    setPosition({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  return (
    <div
      ref={divRef}
      onClick={onClick}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setOpacity(1)}
      onMouseLeave={() => setOpacity(0)}
      className={`relative overflow-hidden rounded-3xl border border-white/10 bg-slate-900/75 backdrop-blur-xl transition-colors duration-200 ${
        onClick ? 'cursor-pointer hover:border-indigo-500/40' : ''
      } ${className}`}
    >
      <div
        className="pointer-events-none absolute -inset-px transition-opacity duration-300"
        style={{
          opacity,
          background: `radial-gradient(450px circle at ${position.x}px ${position.y}px, ${spotlightColor}, transparent 45%)`
        }}
      />
      <div className="relative z-10 h-full">{children}</div>
    </div>
  );
};

// ============================================================================
// 4. REACT BITS COMPONENT: SplitTextReveal (Staggered word/character entrance)
// Source: https://reactbits.dev/text-animations/split-text
// ============================================================================
export const ReactBitsSplitText: React.FC<{
  text: string;
  className?: string;
  delayStep?: number;
}> = ({ text, className = '', delayStep = 0.035 }) => {
  const prefersReducedMotion = useReducedMotion();
  const words = text.split(' ');

  if (prefersReducedMotion) {
    return <span className={className}>{text}</span>;
  }

  return (
    <span className={`inline-flex flex-wrap gap-x-[0.28em] ${className}`}>
      {words.map((word, idx) => (
        <motion.span
          key={`${word}-${idx}`}
          initial={{ opacity: 0, y: 12, filter: 'blur(4px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          transition={{
            duration: 0.32,
            delay: idx * delayStep,
            ease: [0.22, 1, 0.36, 1]
          }}
          className="inline-block"
        >
          {word}
        </motion.span>
      ))}
    </span>
  );
};

// ============================================================================
// 5. REACT BITS COMPONENT: TiltedCard (Interactive 3D perspective card)
// Source: https://reactbits.dev/components/tilted-card
// ============================================================================
export const ReactBitsTiltedCard: React.FC<{
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}> = ({ children, className = '', onClick }) => {
  const prefersReducedMotion = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  const rotateX = useTransform(y, [-0.5, 0.5], [5, -5]);
  const rotateY = useTransform(x, [-0.5, 0.5], [-5, 5]);

  const springRotateX = useSpring(rotateX, { stiffness: 260, damping: 24 });
  const springRotateY = useSpring(rotateY, { stiffness: 260, damping: 24 });

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (prefersReducedMotion || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const normX = (e.clientX - rect.left) / rect.width - 0.5;
    const normY = (e.clientY - rect.top) / rect.height - 0.5;
    x.set(normX);
    y.set(normY);
  };

  const handleMouseLeave = () => {
    x.set(0);
    y.set(0);
  };

  return (
    <motion.div
      ref={ref}
      onClick={onClick}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={
        prefersReducedMotion
          ? undefined
          : {
              rotateX: springRotateX,
              rotateY: springRotateY,
              transformPerspective: 900
            }
      }
      className={`transition-shadow duration-200 ${onClick ? 'cursor-pointer' : ''} ${className}`}
    >
      {children}
    </motion.div>
  );
};

// ============================================================================
// 6. UIVERSE COMPONENT: UIversePushableButton (3D tactile arcade CTA button)
// Source: https://uiverse.io/buttons (3D Pushable Arcade CTA Pattern)
// ============================================================================
export const UIversePushableButton: React.FC<{
  onClick?: () => void;
  disabled?: boolean;
  variant?: 'indigo' | 'amber' | 'emerald' | 'rose' | 'slate';
  children: React.ReactNode;
  className?: string;
  type?: 'button' | 'submit';
}> = ({
  onClick,
  disabled = false,
  variant = 'indigo',
  children,
  className = '',
  type = 'button'
}) => {
  const palette = {
    indigo: {
      edge: 'bg-indigo-900',
      front: 'bg-gradient-to-r from-indigo-600 via-violet-600 to-indigo-600 text-white border-indigo-400/40'
    },
    amber: {
      edge: 'bg-amber-800',
      front: 'bg-gradient-to-r from-amber-500 via-orange-500 to-amber-500 text-slate-950 border-amber-300/50'
    },
    emerald: {
      edge: 'bg-emerald-900',
      front: 'bg-gradient-to-r from-emerald-600 via-teal-500 to-emerald-600 text-white border-emerald-400/40'
    },
    rose: {
      edge: 'bg-rose-900',
      front: 'bg-gradient-to-r from-rose-600 to-red-600 text-white border-rose-400/40'
    },
    slate: {
      edge: 'bg-slate-950',
      front: 'bg-slate-800 hover:bg-slate-700 text-slate-100 border-white/10'
    }
  }[variant];

  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={`group relative border-none bg-transparent p-0 cursor-pointer outline-offset-4 select-none disabled:opacity-50 disabled:pointer-events-none ${className}`}
    >
      <span className="absolute inset-0 rounded-2xl bg-black/40 translate-y-1.5 transition-transform duration-150 group-hover:translate-y-2 group-active:translate-y-0.5" />
      <span className={`absolute inset-0 rounded-2xl ${palette.edge} translate-y-1`} />
      <span
        className={`relative flex items-center justify-center gap-2 rounded-2xl border px-5 py-3 font-extrabold text-xs sm:text-sm tracking-tight transition-transform duration-150 -translate-y-0.5 group-hover:-translate-y-1 group-active:translate-y-0.5 ${palette.front}`}
      >
        {children}
      </span>
    </button>
  );
};

// ============================================================================
// EXTENDED BUILT-IN ACADEMIC QUESTION BANK
// Combines MOCK_QUIZZES from StudentOS with rich grade-aligned questions
// ============================================================================
const EXTENDED_BRAIN_BATTLE_QUESTIONS: BrainBattleQuestion[] = [
  // Seeded from MOCK_QUIZZES + expanded across subjects & difficulty levels
  ...Object.entries(MOCK_QUIZZES).flatMap(([subject, qList]) =>
    qList.map((q, idx) => ({
      id: q.id || `mock_${subject}_${idx}`,
      subject,
      question: q.question,
      options: q.options,
      correctOptionIndex: q.correctOptionIndex,
      explanation: q.explanation,
      difficulty: (idx === 0 ? 'easy' : idx === 1 ? 'medium' : 'hard') as 'easy' | 'medium' | 'hard',
      grade: 'All Grades',
      createdByName: 'StudentOS Curriculum'
    }))
  ),
  {
    id: 'bb-phy-4',
    subject: 'Physics',
    question: 'According to Ohm’s Law, if the voltage across a fixed resistor is doubled, what happens to the electric current?',
    options: [
      'It is reduced by half',
      'It doubles proportionally',
      'It quadruples',
      'It remains unchanged'
    ],
    correctOptionIndex: 1,
    explanation: 'By V = I × R, when resistance R is constant, current I is directly proportional to voltage V.',
    difficulty: 'easy',
    grade: 'Grade 10'
  },
  {
    id: 'bb-phy-5',
    subject: 'Physics',
    question: 'What is the escape velocity from Earth’s surface (ignoring atmospheric drag)?',
    options: [
      '7.9 km/s',
      '9.8 km/s',
      '11.2 km/s',
      '29.8 km/s'
    ],
    correctOptionIndex: 2,
    explanation: 'Derived from setting kinetic energy equal to gravitational potential energy: v = √(2GM/R) ≈ 11.2 km/s.',
    difficulty: 'medium',
    grade: 'Grade 11'
  },
  {
    id: 'bb-chem-3',
    subject: 'Chemistry',
    question: 'Which element has the highest electronegativity on the Pauling scale?',
    options: [
      'Oxygen (O)',
      'Chlorine (Cl)',
      'Fluorine (F)',
      'Nitrogen (N)'
    ],
    correctOptionIndex: 2,
    explanation: 'Fluorine has a Pauling electronegativity of 3.98, the highest of all chemical elements due to its small atomic radius and nuclear charge.',
    difficulty: 'easy',
    grade: 'Grade 10'
  },
  {
    id: 'bb-chem-4',
    subject: 'Chemistry',
    question: 'What is the oxidation state of Chromium (Cr) in the dichromate ion (Cr₂O₇²⁻)?',
    options: [
      '+3',
      '+5',
      '+6',
      '+7'
    ],
    correctOptionIndex: 2,
    explanation: 'Let Cr = x. Since Oxygen is -2: 2x + 7(-2) = -2 → 2x = 12 → x = +6.',
    difficulty: 'hard',
    grade: 'Grade 11'
  },
  {
    id: 'bb-math-3',
    subject: 'Mathematics',
    question: 'What is the derivative of f(x) = e^(2x) with respect to x?',
    options: [
      'e^(2x)',
      '2e^(2x)',
      '2x·e^(2x-1)',
      '0.5e^(2x)'
    ],
    correctOptionIndex: 1,
    explanation: 'Applying the chain rule: d/dx [e^(2x)] = e^(2x) · d/dx(2x) = 2e^(2x).',
    difficulty: 'medium',
    grade: 'Grade 12'
  },
  {
    id: 'bb-math-4',
    subject: 'Mathematics',
    question: 'In a right-angled triangle with legs of length 6 cm and 8 cm, what is the length of the hypotenuse?',
    options: [
      '10 cm',
      '12 cm',
      '14 cm',
      '100 cm'
    ],
    correctOptionIndex: 0,
    explanation: 'By the Pythagorean theorem: c = √(6² + 8²) = √(36 + 64) = √100 = 10 cm.',
    difficulty: 'easy',
    grade: 'Grade 9'
  },
  {
    id: 'bb-cs-3',
    subject: 'Computer Science',
    question: 'Which data structure operates strictly on a Last-In, First-Out (LIFO) principle?',
    options: [
      'Queue',
      'Stack',
      'Min-Heap',
      'Hash Table'
    ],
    correctOptionIndex: 1,
    explanation: 'A Stack pushes and pops elements from the top, meaning the most recently added item is the first removed (LIFO).',
    difficulty: 'easy',
    grade: 'Grade 10'
  },
  {
    id: 'bb-cs-4',
    subject: 'Computer Science',
    question: 'In HTTP/REST architecture, which status code indicates that a resource was successfully created?',
    options: [
      '200 OK',
      '201 Created',
      '204 No Content',
      '304 Not Modified'
    ],
    correctOptionIndex: 1,
    explanation: 'HTTP 201 Created indicates that the request has succeeded and has led to the creation of a new resource.',
    difficulty: 'medium',
    grade: 'Grade 11'
  },
  {
    id: 'bb-bio-1',
    subject: 'Biology',
    question: 'Which cellular organelle is responsible for synthesizing ATP through oxidative phosphorylation?',
    options: [
      'Golgi Apparatus',
      'Mitochondria',
      'Endoplasmic Reticulum',
      'Lysosome'
    ],
    correctOptionIndex: 1,
    explanation: 'Mitochondria house the electron transport chain and ATP synthase on their inner membrane, generating cellular ATP.',
    difficulty: 'easy',
    grade: 'Grade 10'
  },
  {
    id: 'bb-bio-2',
    subject: 'Biology',
    question: 'During DNA replication, which enzyme unwinds the double helix by breaking hydrogen bonds between bases?',
    options: [
      'DNA Polymerase III',
      'DNA Helicase',
      'RNA Primase',
      'DNA Ligase'
    ],
    correctOptionIndex: 1,
    explanation: 'DNA Helicase separates double-stranded DNA into single strands at the replication fork.',
    difficulty: 'medium',
    grade: 'Grade 11'
  },
  {
    id: 'bb-gk-1',
    subject: 'General Knowledge',
    question: 'Which Indian space mission successfully placed a lander near the lunar south pole in August 2023?',
    options: [
      'Chandrayaan-2',
      'Chandrayaan-3',
      'Aditya-L1',
      'Mangalyaan'
    ],
    correctOptionIndex: 1,
    explanation: 'ISRO’s Chandrayaan-3 Vikram lander touched down near the lunar south pole on August 23, 2023.',
    difficulty: 'easy',
    grade: 'All Grades'
  },
  {
    id: 'bb-gk-2',
    subject: 'General Knowledge',
    question: 'Which literary device involves giving human traits or emotions to non-human objects or abstract ideas?',
    options: [
      'Alliteration',
      'Personification',
      'Hyperbole',
      'Oxymoron'
    ],
    correctOptionIndex: 1,
    explanation: 'Personification attributes human nature or characteristics to inanimate objects or abstract notions.',
    difficulty: 'easy',
    grade: 'All Grades'
  }
];

interface BrainBattleArenaProps {
  currentUser: UserProfile;
  effectiveRole: UserRole;
  showNotification?: (msg: string) => void;
}

export const BrainBattleArena: React.FC<BrainBattleArenaProps> = ({
  currentUser,
  effectiveRole,
  showNotification
}) => {
  const userId = currentUser?.uid || currentUser?.email || 'student_default';
  const schoolId = 'default_school';
  const isStaff = ['teacher', 'coordinator', 'admin', 'super_admin'].includes(effectiveRole);

  // Navigation sub-screens inside Brain Battle
  const [activeView, setActiveView] = useState<
    'home' | 'playing' | 'results' | 'multiplayer_lobby' | 'leaderboard' | 'question_bank' | 'exam_prep'
  >('home');

  // Gamification & Leaderboard State
  const [gamificationProfile, setGamificationProfile] = useState<StudentGamificationStats>(() =>
    getLocalGamificationProfile(currentUser)
  );
  const [leaderboard, setLeaderboard] = useState<StudentGamificationStats[]>([]);
  const [leaderboardScope, setLeaderboardScope] = useState<'school' | 'class' | 'house'>('school');

  // Question Bank & Match History State
  const [customQuestions, setCustomQuestions] = useState<BrainBattleQuestion[]>([]);
  const [matchHistory, setMatchHistory] = useState<BrainBattleHistoryItem[]>(() => {
    try {
      const saved = localStorage.getItem(`s_os_bb_history_${userId}`);
      return saved ? JSON.parse(saved) : [];
    } catch (_) {
      return [];
    }
  });
  const [recentCampusMatches, setRecentCampusMatches] = useState<BrainBattleHistoryItem[]>([]);

  // Solo / Setup Configuration
  const [selectedSubject, setSelectedSubject] = useState<string>('Mixed Arena');
  const [selectedDifficulty, setSelectedDifficulty] = useState<'all' | 'easy' | 'medium' | 'hard'>('all');
  const [selectedQuestionCount, setSelectedQuestionCount] = useState<number>(5);
  const [soundMuted, setSoundMuted] = useState<boolean>(() => soundService.getPreferences().muted);

  // Active Match State
  const [matchMode, setMatchMode] = useState<'quick_play' | 'daily_challenge' | 'multiplayer' | 'custom_practice'>('quick_play');
  const [activeQuestions, setActiveQuestions] = useState<BrainBattleQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [isSubmitted, setIsSubmitted] = useState<boolean>(false);
  const [timeLeft, setTimeLeft] = useState<number>(15);
  const [timePerQuestion, setTimePerQuestion] = useState<number>(15);
  const [matchScore, setMatchScore] = useState<number>(0);
  const [correctCount, setCorrectCount] = useState<number>(0);
  const [currentStreak, setCurrentStreak] = useState<number>(0);
  const [peakStreak, setPeakStreak] = useState<number>(0);
  const [matchStartedAt, setMatchStartedAt] = useState<number>(0);
  const [matchSessionId, setMatchSessionId] = useState<string>('');
  const [questionResults, setQuestionResults] = useState<
    Array<{
      question: BrainBattleQuestion;
      chosenIndex: number | null;
      isCorrect: boolean;
      pointsEarned: number;
    }>
  >([]);

  // Reward & Results State
  const [lastXpAwarded, setLastXpAwarded] = useState<number>(0);
  const [lastLeveledUp, setLastLeveledUp] = useState<boolean>(false);
  const [lastUnlockedBadges, setLastUnlockedBadges] = useState<any[]>([]);

  // Multiplayer Room State
  const [roomCodeInput, setRoomCodeInput] = useState<string>('');
  const [activeRoom, setActiveRoom] = useState<BrainBattleRoomState | null>(null);
  const [availableRooms, setAvailableRooms] = useState<any[]>([]);
  const [roomError, setRoomError] = useState<string>('');
  const [copiedCode, setCopiedCode] = useState<boolean>(false);

  // Faculty Question Creator Form State
  const [newQSubject, setNewQSubject] = useState<string>('Physics');
  const [newQDifficulty, setNewQDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [newQText, setNewQText] = useState<string>('');
  const [newQOptions, setNewQOptions] = useState<string[]>(['', '', '', '']);
  const [newQCorrectIdx, setNewQCorrectIdx] = useState<number>(0);
  const [newQExplanation, setNewQExplanation] = useState<string>('');
  const [savingQuestion, setSavingQuestion] = useState<boolean>(false);

  const timerRef = useRef<any>(null);

  // Combine Built-in + Custom Questions
  const allQuestions = useMemo(() => {
    const map = new Map<string, BrainBattleQuestion>();
    customQuestions.forEach(q => map.set(q.id, q));
    EXTENDED_BRAIN_BATTLE_QUESTIONS.forEach(q => {
      if (!map.has(q.id)) map.set(q.id, q);
    });
    return Array.from(map.values());
  }, [customQuestions]);

  const availableSubjects = useMemo(() => {
    const set = new Set<string>(['Mixed Arena']);
    allQuestions.forEach(q => {
      if (q.subject) set.add(q.subject);
    });
    return Array.from(set);
  }, [allQuestions]);

  const levelInfo = useMemo(() => calculateLevelInfo(gamificationProfile.xp), [gamificationProfile.xp]);
  const todayStr = getTodayDateString();
  const isDailyCompletedToday = useMemo(() => {
    return (
      Boolean(gamificationProfile.dailyTrackers?.dailyChallengeClaimed && gamificationProfile.dailyTrackers?.date === todayStr) ||
      matchHistory.some(m => m.mode === 'daily_challenge' && m.timestamp.startsWith(todayStr))
    );
  }, [gamificationProfile, matchHistory, todayStr]);

  // Load initial state from server + gamification engine
  const refreshArenaData = useCallback(async () => {
    const localProf = getLocalGamificationProfile(currentUser);
    setGamificationProfile(localProf);

    try {
      const [lb, stateRes] = await Promise.all([
        fetchGamificationLeaderboard(currentUser),
        fetch(`/api/brain-battle/state?schoolId=${encodeURIComponent(schoolId)}&userId=${encodeURIComponent(userId)}`)
      ]);
      setLeaderboard(lb);
      if (stateRes.ok) {
        const data = await stateRes.json();
        if (Array.isArray(data.customQuestions)) {
          setCustomQuestions(data.customQuestions);
        }
        if (Array.isArray(data.history) && data.history.length > 0) {
          setMatchHistory(prev => {
            const combined = [...data.history, ...prev];
            const seen = new Set<string>();
            return combined.filter(item => {
              if (!item || seen.has(item.id)) return false;
              seen.add(item.id);
              return true;
            }).slice(0, 25);
          });
        }
        if (Array.isArray(data.recentCampusMatches)) {
          setRecentCampusMatches(data.recentCampusMatches);
        }
        if (Array.isArray(data.activeRooms)) {
          setAvailableRooms(data.activeRooms);
        }
      }
    } catch (_) {}
  }, [currentUser, schoolId, userId]);

  useEffect(() => {
    refreshArenaData();
    const handleGamUpdate = () => {
      setGamificationProfile(getLocalGamificationProfile(currentUser));
    };
    window.addEventListener('studentos-gamification-updated', handleGamUpdate);
    return () => window.removeEventListener('studentos-gamification-updated', handleGamUpdate);
  }, [refreshArenaData, currentUser]);

  // Subscribe to active multiplayer room events when in a room
  useEffect(() => {
    if (!activeRoom?.code) return;
    const channelName = `brain_battle_room_${activeRoom.code}`;
    const unsub = subscribeRealtimeEvents(channelName, {
      'room:state': (updatedRoom: BrainBattleRoomState) => {
        if (!updatedRoom || updatedRoom.code !== activeRoom.code) return;
        setActiveRoom(updatedRoom);
        if (updatedRoom.status === 'active' && activeView === 'multiplayer_lobby') {
          // Transition into live multiplayer match
          setMatchMode('multiplayer');
          setActiveQuestions(updatedRoom.questions);
          setCurrentIndex(updatedRoom.currentQuestionIndex || 0);
          setSelectedOption(null);
          setIsSubmitted(false);
          setTimePerQuestion(updatedRoom.timePerQuestion || 15);
          setTimeLeft(updatedRoom.timePerQuestion || 15);
          setMatchScore(updatedRoom.players[userId]?.score || 0);
          setCorrectCount(updatedRoom.players[userId]?.correctCount || 0);
          setCurrentStreak(updatedRoom.players[userId]?.streak || 0);
          setPeakStreak(0);
          setQuestionResults([]);
          setMatchStartedAt(Date.now());
          setMatchSessionId(`mp_${updatedRoom.code}_${ updatedRoom.createdAt }_${userId}`);
          setActiveView('playing');
        } else if (updatedRoom.status === 'active' && activeView === 'playing') {
          if (updatedRoom.currentQuestionIndex !== currentIndex) {
            setCurrentIndex(updatedRoom.currentQuestionIndex);
            setSelectedOption(null);
            setIsSubmitted(false);
            setTimeLeft(updatedRoom.timePerQuestion || 15);
          }
        } else if (updatedRoom.status === 'completed' && activeView === 'playing') {
          finishMatchNow(
            updatedRoom.players[userId]?.score ?? matchScore,
            updatedRoom.players[userId]?.correctCount ?? correctCount,
            peakStreak,
            updatedRoom
          );
        }
      }
    });

    // 1.5s Active Room Heartbeat Polling Fallback (ensures 100% sync reliability across all networks/devices)
    const pollTimer = setInterval(async () => {
      try {
        let syncedRoom: BrainBattleRoomState | null = null;
        try {
          const resp = await fetch(`/api/brain-battle/rooms/${activeRoom.code}`);
          if (resp.ok) {
            const data = await resp.json();
            if (data?.room) syncedRoom = data.room;
          }
        } catch (_) {}

        // Supabase direct cloud persistence fallback
        if (!syncedRoom) {
          try {
            const { data: row } = await supabase
              .from('global_data')
              .select('*')
              .eq('id', `__bb_room_${activeRoom.code}__`)
              .maybeSingle();
            const parsed = (row as any)?.data ?? ((row as any)?.content ? JSON.parse((row as any).content) : null);
            if (parsed && parsed.code) syncedRoom = parsed;
          } catch (_) {}
        }

        if (syncedRoom) {
          const r = syncedRoom;
          setActiveRoom(prev => {
            if (JSON.stringify(prev) !== JSON.stringify(r)) {
              return r;
            }
            return prev;
          });
          if (r.status === 'active' && activeView === 'multiplayer_lobby') {
            setMatchMode('multiplayer');
            setActiveQuestions(r.questions);
            setCurrentIndex(r.currentQuestionIndex || 0);
            setSelectedOption(null);
            setIsSubmitted(false);
            setTimePerQuestion(r.timePerQuestion || 15);
            setTimeLeft(r.timePerQuestion || 15);
            setMatchScore(r.players[userId]?.score || 0);
            setCorrectCount(r.players[userId]?.correctCount || 0);
            setCurrentStreak(r.players[userId]?.streak || 0);
            setPeakStreak(0);
            setQuestionResults([]);
            setMatchStartedAt(Date.now());
            setMatchSessionId(`mp_${r.code}_${r.createdAt}_${userId}`);
            setActiveView('playing');
          } else if (r.status === 'completed' && activeView === 'playing') {
            finishMatchNow(
              r.players[userId]?.score ?? matchScore,
              r.players[userId]?.correctCount ?? correctCount,
              peakStreak,
              r
            );
          }
        }
      } catch (_) {}
    }, 1500);

    return () => {
      unsub();
      clearInterval(pollTimer);
    };
  }, [activeRoom?.code, activeView, currentIndex, userId]);

  // Deterministic Daily Challenge Question Selector
  const getDailyChallengeQuestions = useCallback((): BrainBattleQuestion[] => {
    const seedStr = getTodayDateString();
    let hash = 0;
    for (let i = 0; i < seedStr.length; i++) {
      hash = (hash * 31 + seedStr.charCodeAt(i)) >>> 0;
    }
    const pool = [...allQuestions];
    const picked: BrainBattleQuestion[] = [];
    const count = Math.min(5, pool.length);
    for (let i = 0; i < count; i++) {
      const idx = (hash + i * 7) % pool.length;
      picked.push(pool[idx]);
      pool.splice(idx, 1);
    }
    return picked;
  }, [allQuestions]);

  // Build filtered question set for Quick Play or Custom Practice
  const buildQuestionDeck = useCallback(
    (subject: string, difficulty: 'all' | 'easy' | 'medium' | 'hard', count: number): BrainBattleQuestion[] => {
      let filtered = allQuestions.filter(q => {
        const subjectMatch = subject === 'Mixed Arena' || q.subject.toLowerCase() === subject.toLowerCase();
        const diffMatch = difficulty === 'all' || q.difficulty === difficulty;
        return subjectMatch && diffMatch;
      });
      if (filtered.length < count) {
        // Fallback to broader subject pool if strict difficulty filter has fewer items
        const broader = allQuestions.filter(
          q => subject === 'Mixed Arena' || q.subject.toLowerCase() === subject.toLowerCase()
        );
        filtered = broader.length >= count ? broader : [...allQuestions];
      }
      const shuffled = [...filtered].sort(() => Math.random() - 0.5);
      return shuffled.slice(0, Math.min(count, shuffled.length));
    },
    [allQuestions]
  );

  // Start Solo or Daily Match
  const startMatch = (mode: 'quick_play' | 'daily_challenge' | 'custom_practice', overrideSubject?: string) => {
    soundService.unlockFromUserGesture();
    const targetSubject = overrideSubject || selectedSubject;
    const deck =
      mode === 'daily_challenge'
        ? getDailyChallengeQuestions()
        : buildQuestionDeck(targetSubject, selectedDifficulty, selectedQuestionCount);

    if (deck.length === 0) {
      if (showNotification) showNotification('No questions available for this filter.');
      return;
    }

    const sessionKey =
      mode === 'daily_challenge'
        ? `daily_${todayStr}_${userId}`
        : `solo_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    setMatchMode(mode);
    setActiveQuestions(deck);
    setCurrentIndex(0);
    setSelectedOption(null);
    setIsSubmitted(false);
    setTimePerQuestion(15);
    setTimeLeft(15);
    setMatchScore(0);
    setCorrectCount(0);
    setCurrentStreak(0);
    setPeakStreak(0);
    setQuestionResults([]);
    setMatchStartedAt(Date.now());
    setMatchSessionId(sessionKey);
    setLastXpAwarded(0);
    setLastLeveledUp(false);
    setLastUnlockedBadges([]);
    soundService.playAppearSound();
    setActiveView('playing');
  };

  // Complete Match & Award Verified XP
  const finishMatchNow = async (
    finalScore: number,
    finalCorrect: number,
    finalPeakStreak: number,
    completedRoom?: BrainBattleRoomState | null
  ) => {
    if (timerRef.current) clearInterval(timerRef.current);

    const totalQ = Math.max(1, activeQuestions.length);
    const accuracy = Math.round((finalCorrect / totalQ) * 100);
    const durationSec = Math.max(1, Math.round((Date.now() - matchStartedAt) / 1000));

    // Calculate fair XP reward based on performance (same rules for all roles)
    let calculatedXp = 25 + finalCorrect * 6 + finalPeakStreak * 4;
    if (accuracy >= 80) calculatedXp += 20;
    if (accuracy === 100) calculatedXp += 15;
    if (matchMode === 'daily_challenge') calculatedXp += 25;

    let rankInMatch = 1;
    const roomToUse = completedRoom || activeRoom;
    if (matchMode === 'multiplayer' && roomToUse) {
      const sortedPlayers = Object.values(roomToUse.players).sort((a, b) => b.score - a.score);
      const myIdx = sortedPlayers.findIndex(p => p.userId === userId);
      rankInMatch = myIdx >= 0 ? myIdx + 1 : 1;
      if (rankInMatch === 1 && sortedPlayers.length > 1) {
        calculatedXp += 25;
      }
    }

    const actionType =
      matchMode === 'daily_challenge'
        ? 'brain_battle_daily'
        : matchMode === 'multiplayer' && rankInMatch === 1
        ? 'brain_battle_multiplayer_win'
        : 'brain_battle_round';

    const label =
      matchMode === 'daily_challenge'
        ? `Daily Brain Battle (${accuracy}% Accuracy)`
        : matchMode === 'multiplayer'
        ? `Multiplayer Brain Battle #${rankInMatch} (${accuracy}%)`
        : `Brain Battle: ${selectedSubject} (${accuracy}% Accuracy)`;

    const xpResult = await awardStudentXP(currentUser, actionType, {
      uniqueItemId: matchSessionId,
      quizScorePercent: accuracy,
      customXpAmount: calculatedXp,
      customLabel: label
    });

    const actualXp = xpResult.awarded ? xpResult.xpAdded : 0;
    setLastXpAwarded(actualXp);
    setLastLeveledUp(xpResult.leveledUp);
    setLastUnlockedBadges(xpResult.newBadges || []);

    const historyItem: BrainBattleHistoryItem = {
      id: matchSessionId || `bb_${Date.now()}`,
      userId,
      userName: currentUser.name || 'Scholar',
      userRole: effectiveRole,
      house: currentUser.house,
      grade: currentUser.grade,
      mode: matchMode,
      subject: matchMode === 'daily_challenge' ? 'Daily Challenge' : selectedSubject,
      score: finalScore,
      correctCount: finalCorrect,
      totalQuestions: totalQ,
      accuracyPercent: accuracy,
      xpEarned: actualXp,
      streakPeak: finalPeakStreak,
      durationSec,
      roomCode: roomToUse?.code,
      rankInMatch: matchMode === 'multiplayer' ? rankInMatch : undefined,
      timestamp: new Date().toISOString()
    };

    setMatchHistory(prev => {
      const updated = [historyItem, ...prev.filter(i => i.id !== historyItem.id)].slice(0, 25);
      try {
        localStorage.setItem(`s_os_bb_history_${userId}`, JSON.stringify(updated));
      } catch (_) {}
      return updated;
    });

    try {
      await fetch('/api/brain-battle/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schoolId,
          matchResult: historyItem
        })
      });
    } catch (_) {}

    if (xpResult.leveledUp) {
      soundService.playLevelUp();
    } else if ((xpResult.newBadges || []).length > 0) {
      soundService.playAchievementUnlocked();
    } else {
      soundService.playAchievementUnlocked();
    }
    refreshArenaData();
    setActiveView('results');
  };

  // Commit Answer for Current Question
  const handleCommitAnswer = useCallback(
    async (optionIdx: number | null) => {
      if (isSubmitted || activeView !== 'playing') return;
      if (timerRef.current) clearInterval(timerRef.current);

      const currentQ = activeQuestions[currentIndex];
      if (!currentQ) return;

      setSelectedOption(optionIdx);
      setIsSubmitted(true);

      const isCorrect = optionIdx !== null && optionIdx === currentQ.correctOptionIndex;
      let pointsEarned = 0;
      let nextStreak = currentStreak;
      let nextPeak = peakStreak;
      let nextCorrect = correctCount;

      if (isCorrect) {
        nextCorrect += 1;
        nextStreak += 1;
        if (nextStreak > nextPeak) nextPeak = nextStreak;
        const speedBonus = Math.max(0, Math.round(timeLeft * 3));
        const streakBonus = Math.min(60, (nextStreak - 1) * 15);
        pointsEarned = 100 + speedBonus + streakBonus;
        soundService.playCorrectAnswer();
      } else {
        nextStreak = 0;
      }

      const nextScore = matchScore + pointsEarned;
      setMatchScore(nextScore);
      setCorrectCount(nextCorrect);
      setCurrentStreak(nextStreak);
      setPeakStreak(nextPeak);
      setQuestionResults(prev => [
        ...prev,
        {
          question: currentQ,
          chosenIndex: optionIdx,
          isCorrect,
          pointsEarned
        }
      ]);

      // If in multiplayer room, send answer to authoritative server
      if (matchMode === 'multiplayer' && activeRoom?.code) {
        try {
          const resp = await fetch('/api/brain-battle/rooms/action', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              code: activeRoom.code,
              action: 'answer',
              userId,
              optionIndex: optionIdx,
              timeLeftSec: timeLeft
            })
          });
          if (resp.ok) {
            const data = await resp.json();
            if (data.room) {
              setActiveRoom(data.room);
              sendRealtimeEvent(`brain_battle_room_${activeRoom.code}`, 'room:state', data.room);
            }
          }
        } catch (_) {}
      }
    },
    [
      isSubmitted,
      activeView,
      activeQuestions,
      currentIndex,
      currentStreak,
      peakStreak,
      correctCount,
      timeLeft,
      matchScore,
      matchMode,
      activeRoom?.code,
      userId
    ]
  );

  // Per-Question Countdown Timer
  useEffect(() => {
    if (activeView !== 'playing' || isSubmitted) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          handleCommitAnswer(null);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [activeView, isSubmitted, currentIndex, handleCommitAnswer]);

  // Keyboard Accessibility (1-4 / A-D to answer, Enter/Space to advance)
  useEffect(() => {
    if (activeView !== 'playing') return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const currentQ = activeQuestions[currentIndex];
      if (!currentQ) return;

      if (!isSubmitted) {
        const keyMap: Record<string, number> = {
          '1': 0,
          '2': 1,
          '3': 2,
          '4': 3,
          a: 0,
          b: 1,
          c: 2,
          d: 3
        };
        const mapped = keyMap[e.key.toLowerCase()];
        if (typeof mapped === 'number' && mapped < currentQ.options.length) {
          e.preventDefault();
          handleCommitAnswer(mapped);
        }
      } else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleNextQuestion();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeView, isSubmitted, currentIndex, activeQuestions, handleCommitAnswer]);

  // Advance to Next Question or Results
  const handleNextQuestion = async () => {
    if (matchMode === 'multiplayer' && activeRoom?.code) {
      try {
        const resp = await fetch('/api/brain-battle/rooms/action', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            code: activeRoom.code,
            action: 'next',
            userId
          })
        });
        if (resp.ok) {
          const data = await resp.json();
          if (data.room) {
            try {
              await supabase.from('global_data').upsert({
                id: `__bb_room_${activeRoom.code}__`,
                data: data.room,
                updated_at: new Date().toISOString()
              });
            } catch (_) {}
            setActiveRoom(data.room);
            sendRealtimeEvent(`brain_battle_room_${activeRoom.code}`, 'room:state', data.room);
            if (data.room.status === 'completed') {
              finishMatchNow(
                data.room.players[userId]?.score ?? matchScore,
                data.room.players[userId]?.correctCount ?? correctCount,
                peakStreak,
                data.room
              );
              return;
            }
            setCurrentIndex(data.room.currentQuestionIndex);
            setSelectedOption(null);
            setIsSubmitted(false);
            setTimeLeft(data.room.timePerQuestion || 15);
            return;
          }
        }
      } catch (_) {}
    }

    if (currentIndex + 1 < activeQuestions.length) {
      setCurrentIndex(prev => prev + 1);
      setSelectedOption(null);
      setIsSubmitted(false);
      setTimeLeft(timePerQuestion);
    } else {
      finishMatchNow(matchScore, correctCount, peakStreak);
    }
  };

  // Multiplayer Room Creation & Joining
  const handleCreateMultiplayerRoom = async () => {
    setRoomError('');
    const deck = buildQuestionDeck(selectedSubject, selectedDifficulty, selectedQuestionCount);
    try {
      const resp = await fetch('/api/brain-battle/rooms/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          host: {
            userId,
            name: currentUser.name,
            role: effectiveRole,
            house: currentUser.house,
            grade: currentUser.grade,
            avatar: currentUser.photoURL || currentUser.avatar
          },
          subject: selectedSubject,
          difficulty: selectedDifficulty,
          questionCount: selectedQuestionCount,
          timePerQuestion: 15,
          questions: deck
        })
      });
      const data = await resp.json();
      if (resp.ok && data.room) {
        // Direct cloud persistence backup in Supabase
        await supabase.from('global_data').upsert({
          id: `__bb_room_${data.room.code}__`,
          data: data.room,
          updated_at: new Date().toISOString()
        });
        setActiveRoom(data.room);
        sendRealtimeEvent(`brain_battle_room_${data.room.code}`, 'room:state', data.room);
        setActiveView('multiplayer_lobby');
      } else {
        setRoomError(data.error || 'Could not create room.');
      }
    } catch (_) {
      setRoomError('Network error while creating battle room.');
    }
  };

  const handleJoinMultiplayerRoom = async (codeToJoin?: string) => {
    const cleanCode = (codeToJoin || roomCodeInput).toUpperCase().trim();
    if (!cleanCode) {
      setRoomError('Enter a 6-character room code.');
      return;
    }
    setRoomError('');

    const newPlayerData = {
      userId,
      name: currentUser.name || 'Scholar',
      role: effectiveRole,
      house: currentUser.house || 'Emerald',
      grade: currentUser.grade || '',
      avatar: currentUser.photoURL || currentUser.avatar || '',
      score: 0,
      correctCount: 0,
      streak: 0,
      answeredCurrentIndex: -1,
      joinedAt: Date.now()
    };

    try {
      const resp = await fetch('/api/brain-battle/rooms/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: cleanCode,
          player: newPlayerData
        })
      });
      const data = await resp.json();
      if (resp.ok && data.room) {
        // Direct cloud persistence backup in Supabase
        await supabase.from('global_data').upsert({
          id: `__bb_room_${cleanCode}__`,
          data: data.room,
          updated_at: new Date().toISOString()
        });
        setActiveRoom(data.room);
        sendRealtimeEvent(`brain_battle_room_${cleanCode}`, 'room:state', data.room);
        soundService.playAppearSound();
        setActiveView('multiplayer_lobby');
        return;
      }
    } catch (_) {}

    // Resilient Direct Supabase Join Fallback
    try {
      const { data: row } = await supabase
        .from('global_data')
        .select('*')
        .eq('id', `__bb_room_${cleanCode}__`)
        .maybeSingle();

      const parsedRoom = (row as any)?.data ?? ((row as any)?.content ? JSON.parse((row as any).content) : null);
      if (parsedRoom && parsedRoom.code && parsedRoom.status !== 'completed') {
        const room: BrainBattleRoomState = parsedRoom;
        if (!room.players) room.players = {};
        room.players[userId] = newPlayerData;
        room.updatedAt = Date.now();

        await supabase.from('global_data').upsert({
          id: `__bb_room_${cleanCode}__`,
          data: room,
          updated_at: new Date().toISOString()
        });

        setActiveRoom(room);
        sendRealtimeEvent(`brain_battle_room_${cleanCode}`, 'room:state', room);
        soundService.playAppearSound();
        setActiveView('multiplayer_lobby');
        return;
      }
    } catch (_) {}
    setRoomError('Battle Room not found. Verify the 6-character code.');
  };

  const handleStartMultiplayerMatch = async () => {
    if (!activeRoom) return;
    const now = Date.now();
    const updatedRoom: BrainBattleRoomState = {
      ...activeRoom,
      status: 'active',
      currentQuestionIndex: 0,
      questionStartedAt: now,
      updatedAt: now
    };
    Object.values(updatedRoom.players).forEach(p => {
      p.score = 0;
      p.correctCount = 0;
      p.streak = 0;
      p.answeredCurrentIndex = -1;
    });

    try {
      await fetch('/api/brain-battle/rooms/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: activeRoom.code,
          action: 'start',
          userId
        })
      });
    } catch (_) {}

    // Authoritative state update in Supabase
    try {
      await supabase.from('global_data').upsert({
        id: `__bb_room_${activeRoom.code}__`,
        data: updatedRoom,
        updated_at: new Date().toISOString()
      });
    } catch (_) {}

    setActiveRoom(updatedRoom);
    sendRealtimeEvent(`brain_battle_room_${activeRoom.code}`, 'room:state', updatedRoom);
    setMatchMode('multiplayer');
    setActiveQuestions(updatedRoom.questions);
    setCurrentIndex(0);
    setSelectedOption(null);
    setIsSubmitted(false);
    setTimePerQuestion(updatedRoom.timePerQuestion || 15);
    setTimeLeft(updatedRoom.timePerQuestion || 15);
    setMatchScore(0);
    setCorrectCount(0);
    setCurrentStreak(0);
    setPeakStreak(0);
    setQuestionResults([]);
    setMatchStartedAt(now);
    setMatchSessionId(`mp_${updatedRoom.code}_${updatedRoom.createdAt}_${userId}`);
    setActiveView('playing');
  };

  // Faculty Question Bank Submission
  const handleCreateCustomQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newQText.trim() || newQOptions.some(o => !o.trim())) {
      if (showNotification) showNotification('Please fill in the question and all 4 options.');
      return;
    }
    setSavingQuestion(true);
    try {
      const resp = await fetch('/api/brain-battle/questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schoolId,
          userRole: effectiveRole,
          question: {
            subject: newQSubject,
            difficulty: newQDifficulty,
            question: newQText.trim(),
            options: newQOptions.map(o => o.trim()),
            correctOptionIndex: newQCorrectIdx,
            explanation: newQExplanation.trim() || 'Reviewed by faculty.',
            grade: currentUser.grade || 'All Grades',
            createdBy: userId,
            createdByName: currentUser.name
          }
        })
      });
      const data = await resp.json();
      if (resp.ok && Array.isArray(data.customQuestions)) {
        setCustomQuestions(data.customQuestions);
        setNewQText('');
        setNewQOptions(['', '', '', '']);
        setNewQExplanation('');
        if (showNotification) showNotification('Added new question to the Brain Battle Arena!');
      }
    } catch (_) {
    } finally {
      setSavingQuestion(false);
    }
  };

  const toggleSound = () => {
    const nextMuted = !soundMuted;
    setSoundMuted(nextMuted);
    try {
      localStorage.setItem('studentos_sound_muted', JSON.stringify(nextMuted));
    } catch (_) {}
  };

  // Filtered Leaderboard
  const filteredLeaderboard = useMemo(() => {
    if (leaderboardScope === 'school') return leaderboard;
    if (leaderboardScope === 'house') {
      const myHouse = (currentUser.house || 'Sapphire').toLowerCase();
      const matches = leaderboard.filter(i => (i.house || '').toLowerCase() === myHouse);
      return matches.length > 0 ? matches : leaderboard;
    }
    const targetGrade = (currentUser.grade || 'Grade 10').toLowerCase().replace(/class|grade|\s+/g, '');
    const classMatches = leaderboard.filter(item => {
      const g = (item.grade || '').toLowerCase().replace(/class|grade|\s+/g, '');
      return !targetGrade || g === targetGrade || g.includes(targetGrade);
    });
    return classMatches.length > 0 ? classMatches : leaderboard;
  }, [leaderboard, leaderboardScope, currentUser.grade, currentUser.house]);

  const myLeaderboardRank = useMemo(() => {
    const idx = filteredLeaderboard.findIndex(i => i.userId === userId);
    return idx >= 0 ? idx + 1 : 1;
  }, [filteredLeaderboard, userId]);

  const earnedBadgesList = useMemo(
    () => GAMIFICATION_BADGES.filter(b => Boolean(gamificationProfile.earnedBadges?.[b.id])),
    [gamificationProfile.earnedBadges]
  );

  // ============================================================================
  // RENDER: ACTIVE GAMEPLAY SCREEN
  // ============================================================================
  if (activeView === 'playing') {
    const currentQuestion = activeQuestions[currentIndex];
    if (!currentQuestion) return null;

    const progressPct = Math.round(((currentIndex + (isSubmitted ? 1 : 0)) / activeQuestions.length) * 100);

    return (
      <div className="max-w-4xl mx-auto space-y-5">
        {/* Top Arena HUD Bar */}
        <div className="smart-glass p-4 sm:p-5 rounded-3xl border border-indigo-500/25 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                if (timerRef.current) clearInterval(timerRef.current);
                setActiveView('home');
              }}
              className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-white/10 text-slate-300 hover:text-white cursor-pointer"
              title="Leave Match"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <span className="font-bold text-indigo-400">{currentQuestion.subject}</span>
                <span aria-hidden="true">·</span>
                <span className="capitalize">{currentQuestion.difficulty}</span>
                {matchMode === 'multiplayer' && activeRoom && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono text-amber-400">Room {activeRoom.code}</span>
                  </>
                )}
              </div>
              <h3 className="text-sm sm:text-base font-black text-white">
                Question {currentIndex + 1} of {activeQuestions.length}
              </h3>
            </div>
          </div>

          {/* Score, Combo Streak & Magic UI Circular Timer */}
          <div className="flex items-center gap-4">
            <div className="text-right">
              <span className="text-[10px] uppercase tracking-wider text-slate-400 block font-semibold">
                Match Score
              </span>
              <MagicNumberTicker
                value={matchScore}
                suffix=" pts"
                className="text-base sm:text-lg font-black text-amber-400"
              />
            </div>

            {currentStreak > 0 && (
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="px-3 py-1.5 rounded-2xl bg-orange-500/15 border border-orange-500/30 flex items-center gap-1.5"
              >
                <Flame className="w-4 h-4 text-orange-400" />
                <span className="font-mono font-black text-xs text-orange-300 tabular-nums">
                  {currentStreak}x Streak
                </span>
              </motion.div>
            )}

            <MagicCircularProgress
              value={timeLeft}
              max={timePerQuestion}
              size={54}
              strokeWidth={5}
              dangerThreshold={4}
            />
          </div>
        </div>

        {/* Question Progress Bar */}
        <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden border border-white/5">
          <motion.div
            className="h-full bg-gradient-to-r from-indigo-500 via-violet-500 to-amber-400"
            animate={{ width: `${progressPct}%` }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
          />
        </div>

        {/* Multiplayer Live Opponent Strip */}
        {matchMode === 'multiplayer' && activeRoom && (
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {Object.values(activeRoom.players)
              .sort((a, b) => b.score - a.score)
              .map(p => (
                <div
                  key={p.userId}
                  className={`px-3 py-2 rounded-2xl border flex items-center gap-2.5 shrink-0 text-xs ${
                    p.userId === userId
                      ? 'bg-indigo-950/70 border-indigo-500/40 text-white'
                      : 'bg-slate-900/80 border-white/10 text-slate-300'
                  }`}
                >
                  <div className="w-2 h-2 rounded-full bg-emerald-400" />
                  <span className="font-bold truncate max-w-[110px]">{p.name}</span>
                  <span className="font-mono font-black text-amber-400 tabular-nums">{p.score}</span>
                  {p.answeredCurrentIndex === currentIndex && (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  )}
                </div>
              ))}
          </div>
        )}

        {/* Animated Question Card with Motion AnimatePresence */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentQuestion.id + '_' + currentIndex}
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -24 }}
            transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
          >
            <AceternityCardSpotlight className="p-5 sm:p-8 space-y-6">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>Select the single best answer before the timer expires</span>
                  <span className="font-mono">Keyboard: 1–4</span>
                </div>
                <h2 className="text-lg sm:text-2xl font-extrabold text-white leading-snug">
                  {currentQuestion.question}
                </h2>
              </div>

              {/* 4 Answer Options with Tactile Feedback */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {currentQuestion.options.map((optText, idx) => {
                  const isCorrectOption = idx === currentQuestion.correctOptionIndex;
                  const isChosen = selectedOption === idx;

                  let cardStyle =
                    'bg-slate-950/80 hover:bg-slate-900 border-white/10 hover:border-indigo-500/50 text-slate-100';
                  let badgeStyle = 'bg-slate-800 text-slate-300';

                  if (isSubmitted) {
                    if (isCorrectOption) {
                      cardStyle =
                        'bg-emerald-950/60 border-emerald-500 text-emerald-200 shadow-lg shadow-emerald-500/10';
                      badgeStyle = 'bg-emerald-500 text-slate-950';
                    } else if (isChosen && !isCorrectOption) {
                      cardStyle = 'bg-rose-950/60 border-rose-500 text-rose-200';
                      badgeStyle = 'bg-rose-500 text-white';
                    } else {
                      cardStyle = 'bg-slate-950/40 border-white/5 text-slate-500 opacity-65';
                    }
                  } else if (isChosen) {
                    cardStyle = 'bg-indigo-950/70 border-indigo-500 text-white';
                    badgeStyle = 'bg-indigo-500 text-white';
                  }

                  return (
                    <motion.button
                      key={idx}
                      type="button"
                      disabled={isSubmitted}
                      whileHover={!isSubmitted ? { y: -2 } : undefined}
                      whileTap={!isSubmitted ? { scale: 0.985 } : undefined}
                      onClick={() => handleCommitAnswer(idx)}
                      className={`w-full p-4 sm:p-5 rounded-2xl border-2 text-left transition-colors flex items-start gap-3.5 cursor-pointer disabled:cursor-default ${cardStyle}`}
                    >
                      <span
                        className={`w-7 h-7 rounded-xl font-mono font-black text-xs flex items-center justify-center shrink-0 mt-0.5 ${badgeStyle}`}
                      >
                        {String.fromCharCode(65 + idx)}
                      </span>
                      <span className="flex-1 text-xs sm:text-sm font-bold leading-relaxed">
                        {optText}
                      </span>
                      {isSubmitted && isCorrectOption && (
                        <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                      )}
                      {isSubmitted && isChosen && !isCorrectOption && (
                        <XCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                      )}
                    </motion.button>
                  );
                })}
              </div>

              {/* Explanation & Next Action Drawer */}
              <AnimatePresence>
                {isSubmitted && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="pt-4 border-t border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div className="space-y-1 max-w-2xl">
                      <div className="flex items-center gap-2 text-xs font-extrabold">
                        {selectedOption === currentQuestion.correctOptionIndex ? (
                          <span className="text-emerald-400 flex items-center gap-1">
                            <CheckCircle2 className="w-4 h-4" /> Correct Answer!
                          </span>
                        ) : selectedOption === null ? (
                          <span className="text-amber-400 flex items-center gap-1">
                            <Clock className="w-4 h-4" /> Time Expired!
                          </span>
                        ) : (
                          <span className="text-rose-400 flex items-center gap-1">
                            <XCircle className="w-4 h-4" /> Not quite right
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-300 leading-relaxed">
                        {currentQuestion.explanation}
                      </p>
                    </div>

                    <UIversePushableButton
                      variant="emerald"
                      onClick={handleNextQuestion}
                      className="shrink-0"
                    >
                      <span>
                        {currentIndex + 1 < activeQuestions.length ? 'Next Question' : 'View Results'}
                      </span>
                      <ChevronRight className="w-4 h-4" />
                    </UIversePushableButton>
                  </motion.div>
                )}
              </AnimatePresence>
            </AceternityCardSpotlight>
          </motion.div>
        </AnimatePresence>
      </div>
    );
  }

  // ============================================================================
  // RENDER: ANIMATED RESULTS & REWARD PRESENTATION SCREEN
  // ============================================================================
  if (activeView === 'results') {
    const totalQ = Math.max(1, activeQuestions.length);
    const accuracy = Math.round((correctCount / totalQ) * 100);

    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        >
          <AceternityCardSpotlight
            spotlightColor="rgba(245, 158, 11, 0.18)"
            className="p-6 sm:p-9 text-center space-y-6 border-amber-500/30"
          >
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-gradient-to-br from-amber-400 to-orange-600 text-slate-950 shadow-xl shadow-amber-500/20 mx-auto">
              <Trophy className="w-10 h-10" />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-center gap-2 text-xs text-amber-400 font-bold">
                <span>{matchMode === 'daily_challenge' ? 'Daily Challenge Complete' : 'Brain Battle Complete'}</span>
                <span aria-hidden="true">·</span>
                <span>{selectedSubject}</span>
              </div>
              <h2 className="text-2xl sm:text-4xl font-black font-display text-white">
                <ReactBitsSplitText
                  text={
                    accuracy === 100
                      ? 'Flawless Victory!'
                      : accuracy >= 80
                      ? 'Outstanding Mastery!'
                      : accuracy >= 50
                      ? 'Solid Arena Effort!'
                      : 'Keep Practicing, Scholar!'
                  }
                />
              </h2>
            </div>

            {/* Animated Score & XP Metrics Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 max-w-2xl mx-auto">
              <div className="p-4 rounded-2xl bg-slate-950/80 border border-white/10">
                <span className="text-[11px] text-slate-400 block font-semibold">Final Score</span>
                <MagicNumberTicker
                  value={matchScore}
                  className="text-xl sm:text-2xl font-black text-white mt-1 block"
                />
              </div>
              <div className="p-4 rounded-2xl bg-slate-950/80 border border-white/10">
                <span className="text-[11px] text-slate-400 block font-semibold">Accuracy</span>
                <MagicNumberTicker
                  value={accuracy}
                  suffix="%"
                  className="text-xl sm:text-2xl font-black text-emerald-400 mt-1 block"
                />
              </div>
              <div className="p-4 rounded-2xl bg-slate-950/80 border border-amber-500/30">
                <span className="text-[11px] text-amber-300 block font-semibold">XP Earned</span>
                <MagicNumberTicker
                  value={lastXpAwarded}
                  prefix="+"
                  suffix=" XP"
                  className="text-xl sm:text-2xl font-black text-amber-400 mt-1 block"
                />
              </div>
              <div className="p-4 rounded-2xl bg-slate-950/80 border border-white/10">
                <span className="text-[11px] text-slate-400 block font-semibold">Best Streak</span>
                <MagicNumberTicker
                  value={peakStreak}
                  suffix="x"
                  className="text-xl sm:text-2xl font-black text-orange-400 mt-1 block"
                />
              </div>
            </div>

            {/* Level Progress Bar with Animated Fill */}
            <div className="max-w-xl mx-auto p-4 rounded-2xl bg-slate-950/90 border border-white/10 text-left space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-extrabold text-white">
                  {levelInfo.current.icon} Level {levelInfo.current.level} · {levelInfo.current.title}
                </span>
                <span className="font-mono font-bold text-amber-400 tabular-nums">
                  {gamificationProfile.xp.toLocaleString()} XP Total
                </span>
              </div>
              <div className="w-full h-2.5 bg-slate-900 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${levelInfo.progressPercent}%` }}
                  transition={{ duration: 0.7, ease: 'easeOut' }}
                  className="h-full bg-gradient-to-r from-amber-400 via-orange-500 to-indigo-500"
                />
              </div>
              {lastLeveledUp && (
                <p className="text-xs font-extrabold text-amber-300">
                  🎉 Level Up Unlocked! You reached {levelInfo.current.title}!
                </p>
              )}
              {lastUnlockedBadges.length > 0 && (
                <div className="pt-2 flex flex-wrap items-center gap-2">
                  <span className="text-xs font-bold text-emerald-400">New Badge Unlocked:</span>
                  {lastUnlockedBadges.map((b: any) => (
                    <span
                      key={b.id}
                      className="text-xs font-bold text-white bg-emerald-500/20 border border-emerald-500/40 px-2.5 py-1 rounded-xl"
                    >
                      {b.icon} {b.name}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Multiplayer Standings Podium if applicable */}
            {matchMode === 'multiplayer' && activeRoom && (
              <div className="max-w-xl mx-auto space-y-2 text-left">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Multiplayer Match Standings (Room {activeRoom.code})
                </h4>
                <div className="space-y-2">
                  {Object.values(activeRoom.players)
                    .sort((a, b) => b.score - a.score)
                    .map((p, idx) => (
                      <div
                        key={p.userId}
                        className="p-3 rounded-2xl bg-slate-950/80 border border-white/10 flex items-center justify-between text-xs"
                      >
                        <div className="flex items-center gap-3">
                          <span className="font-mono font-black text-amber-400">#{idx + 1}</span>
                          <span className="font-bold text-white">{p.name}</span>
                          <span className="text-slate-400 capitalize">{p.role.replace('_', ' ')}</span>
                        </div>
                        <span className="font-mono font-black text-white tabular-nums">
                          {p.score} pts ({p.correctCount}/{activeQuestions.length})
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <UIversePushableButton
                variant="indigo"
                onClick={() => startMatch('quick_play')}
              >
                <RotateCcw className="w-4 h-4" />
                <span>Play Again</span>
              </UIversePushableButton>

              <UIversePushableButton
                variant="amber"
                onClick={() => setActiveView('leaderboard')}
              >
                <Trophy className="w-4 h-4" />
                <span>View Leaderboard</span>
              </UIversePushableButton>

              <UIversePushableButton
                variant="slate"
                onClick={() => setActiveView('home')}
              >
                <span>Back to Arena Home</span>
              </UIversePushableButton>
            </div>
          </AceternityCardSpotlight>
        </motion.div>

        {/* Detailed Question Breakdown */}
        {questionResults.length > 0 && (
          <div className="smart-glass p-5 sm:p-6 rounded-3xl space-y-4">
            <h3 className="text-sm font-extrabold text-white">Round Question Review</h3>
            <div className="space-y-3">
              {questionResults.map((item, idx) => (
                <div
                  key={idx}
                  className="p-4 rounded-2xl bg-slate-950/70 border border-white/10 space-y-1.5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-xs sm:text-sm font-bold text-white">
                      {idx + 1}. {item.question.question}
                    </p>
                    <span
                      className={`font-mono text-xs font-bold shrink-0 ${
                        item.isCorrect ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {item.isCorrect ? `+${item.pointsEarned} pts` : '0 pts'}
                    </span>
                  </div>
                  <p className="text-xs text-emerald-400 font-semibold">
                    Correct Answer: {item.question.options[item.question.correctOptionIndex]}
                  </p>
                  <p className="text-xs text-slate-400">{item.question.explanation}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // ============================================================================
  // RENDER: MULTIPLAYER LOBBY SCREEN
  // ============================================================================
  if (activeView === 'multiplayer_lobby' && activeRoom) {
    const isHost = activeRoom.hostId === userId;
    const playersList = Object.values(activeRoom.players);

    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <AceternityCardSpotlight className="p-6 sm:p-8 space-y-6">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <button
              type="button"
              onClick={() => {
                setActiveRoom(null);
                setActiveView('home');
              }}
              className="flex items-center gap-2 text-xs font-bold text-slate-400 hover:text-white cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Leave Lobby</span>
            </button>
            <div className="flex items-center gap-2 text-xs text-emerald-400 font-semibold">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <span>Live Real-Time Arena Synced</span>
            </div>
          </div>

          <div className="text-center space-y-2">
            <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider">
              Multiplayer Battle Room Code
            </span>
            <div className="flex items-center justify-center gap-3">
              <span className="text-3xl sm:text-5xl font-mono font-black tracking-widest text-white bg-slate-950 px-6 py-3 rounded-2xl border border-indigo-500/40">
                {activeRoom.code}
              </span>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(activeRoom.code);
                  setCopiedCode(true);
                  setTimeout(() => setCopiedCode(false), 2000);
                }}
                className="p-3.5 rounded-2xl bg-slate-950 hover:bg-slate-800 border border-white/10 text-slate-200 cursor-pointer"
                title="Copy Room Code"
              >
                {copiedCode ? <Check className="w-5 h-5 text-emerald-400" /> : <Copy className="w-5 h-5" />}
              </button>
            </div>
            <p className="text-xs text-slate-400">
              Share this 6-character code with classmates, teachers, or another open tab to battle live!
            </p>
          </div>

          {/* Connected Contenders */}
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="font-bold text-white">Connected Players ({playersList.length})</span>
              <span>{activeRoom.subject} · {activeRoom.questions.length} Questions</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {playersList.map(p => (
                <div
                  key={p.userId}
                  className="p-4 rounded-2xl bg-slate-950/80 border border-white/10 flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center font-black text-indigo-300">
                      {p.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-xs sm:text-sm font-bold text-white flex items-center gap-1.5">
                        <span>{p.name}</span>
                        {p.userId === activeRoom.hostId && (
                          <Crown className="w-3.5 h-3.5 text-amber-400" />
                        )}
                      </p>
                      <p className="text-[11px] text-slate-400 capitalize">
                        {p.role.replace('_', ' ')} {p.house ? `· ${p.house}` : ''}
                      </p>
                    </div>
                  </div>
                  <span className="text-xs font-mono text-emerald-400 font-bold">Ready</span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-center pt-2">
            {isHost ? (
              <UIversePushableButton
                variant="emerald"
                onClick={handleStartMultiplayerMatch}
              >
                <Play className="w-4 h-4 fill-current" />
                <span>Launch Live Battle Now</span>
              </UIversePushableButton>
            ) : (
              <div className="text-xs text-amber-300 font-bold flex items-center gap-2">
                <Clock className="w-4 h-4 animate-spin" />
                <span>Waiting for {activeRoom.hostName} to launch the battle...</span>
              </div>
            )}
          </div>
        </AceternityCardSpotlight>
      </div>
    );
  }

  // ============================================================================
  // RENDER: LEADERBOARD & BADGES SUB-SCREEN
  // ============================================================================
  if (activeView === 'leaderboard') {
    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setActiveView('home')}
              className="p-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-white/10 text-slate-300 hover:text-white cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <h2 className="text-xl sm:text-2xl font-black font-display text-white">
                Brain Battle Standings & Hall of Fame
              </h2>
              <p className="text-xs text-slate-400">
                Real-time campus XP rankings across Students, Teachers, Coordinators, and Admins
              </p>
            </div>
          </div>

          {/* Scope Filter Tabs */}
          <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-900 border border-white/10">
            {(['school', 'class', 'house'] as const).map(sc => (
              <button
                key={sc}
                type="button"
                onClick={() => setLeaderboardScope(sc)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold capitalize transition-colors cursor-pointer ${
                  leaderboardScope === sc
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {sc === 'school' ? 'School-Wide' : sc === 'class' ? 'My Grade' : 'My House'}
              </button>
            ))}
          </div>
        </div>

        {/* Top 3 Podium Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {filteredLeaderboard.slice(0, 3).map((scholar, idx) => (
            <ReactBitsTiltedCard key={scholar.userId}>
              <AceternityCardSpotlight
                spotlightColor={
                  idx === 0
                    ? 'rgba(245, 158, 11, 0.22)'
                    : idx === 1
                    ? 'rgba(148, 163, 184, 0.18)'
                    : 'rgba(217, 119, 6, 0.18)'
                }
                className="p-5 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="text-2xl">
                    {idx === 0 ? '🥇' : idx === 1 ? '🥈' : '🥉'}
                  </span>
                  <span className="font-mono text-xs font-bold text-amber-400 tabular-nums">
                    Level {scholar.level} · {scholar.levelTitle}
                  </span>
                </div>
                <div>
                  <h3 className="text-base font-black text-white truncate">
                    {scholar.name}
                  </h3>
                  <p className="text-xs text-slate-400">
                    {scholar.grade || 'Campus'} · {scholar.house || 'Scholar'}
                  </p>
                </div>
                <div className="pt-2 border-t border-white/10 flex items-center justify-between">
                  <MagicNumberTicker
                    value={scholar.xp}
                    suffix=" XP"
                    className="text-lg font-black text-amber-400"
                  />
                  <span className="text-xs text-orange-400 font-mono">
                    🔥 {scholar.currentStreak}d streak
                  </span>
                </div>
              </AceternityCardSpotlight>
            </ReactBitsTiltedCard>
          ))}
        </div>

        {/* Full Standings Table */}
        <div className="smart-glass rounded-3xl overflow-hidden border border-white/10">
          <div className="p-4 sm:p-5 border-b border-white/10 flex items-center justify-between">
            <h3 className="text-sm font-extrabold text-white">Official Arena Leaderboard</h3>
            <span className="text-xs text-slate-400 font-mono">
              Your Rank: #{myLeaderboardRank}
            </span>
          </div>
          <div className="divide-y divide-white/5">
            {filteredLeaderboard.slice(0, 15).map((item, idx) => {
              const isMe = item.userId === userId;
              return (
                <motion.div
                  key={item.userId}
                  layout
                  className={`p-4 flex items-center justify-between gap-4 ${
                    isMe ? 'bg-indigo-950/40' : 'hover:bg-white/[0.02]'
                  }`}
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <span className="w-7 font-mono font-black text-xs text-slate-400 tabular-nums">
                      #{idx + 1}
                    </span>
                    <div className="w-9 h-9 rounded-xl bg-slate-800 flex items-center justify-center font-bold text-xs text-white shrink-0">
                      {item.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs sm:text-sm font-bold text-white truncate">
                        {item.name} {isMe && <span className="text-indigo-400">(You)</span>}
                      </p>
                      <p className="text-[11px] text-slate-400">
                        Level {item.level} ({item.levelTitle}) · {item.grade || 'Campus'}
                      </p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <MagicNumberTicker
                      value={item.xp}
                      suffix=" XP"
                      className="text-xs sm:text-sm font-black text-amber-400 block"
                    />
                    <span className="text-[11px] text-slate-400 font-mono">
                      🔥 {item.currentStreak}d
                    </span>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // ============================================================================
  // RENDER: FACULTY QUESTION BANK STUDIO SUB-SCREEN
  // ============================================================================
  if (activeView === 'question_bank' && isStaff) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setActiveView('home')}
              className="p-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-white/10 text-slate-300 hover:text-white cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <h2 className="text-xl font-black font-display text-white">
                Campus Brain Battle Question Studio
              </h2>
              <p className="text-xs text-slate-400">
                Author custom curriculum questions for students and staff across all Brain Battle modes
              </p>
            </div>
          </div>
        </div>

        <form onSubmit={handleCreateCustomQuestion} className="smart-glass p-6 rounded-3xl space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">Subject</label>
              <input
                type="text"
                value={newQSubject}
                onChange={e => setNewQSubject(e.target.value)}
                placeholder="e.g. Physics, Mathematics, History"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-white/10 text-xs text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">Difficulty</label>
              <select
                value={newQDifficulty}
                onChange={e => setNewQDifficulty(e.target.value as any)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-white/10 text-xs text-white"
              >
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1.5">Question Prompt</label>
            <textarea
              rows={2}
              value={newQText}
              onChange={e => setNewQText(e.target.value)}
              placeholder="Enter a clear, unambiguous academic question..."
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-white/10 text-xs text-white"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {newQOptions.map((opt, idx) => (
              <div key={idx} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-300">Option {String.fromCharCode(65 + idx)}</span>
                  <label className="flex items-center gap-1.5 text-emerald-400 cursor-pointer">
                    <input
                      type="radio"
                      name="correctOpt"
                      checked={newQCorrectIdx === idx}
                      onChange={() => setNewQCorrectIdx(idx)}
                    />
                    <span>Correct</span>
                  </label>
                </div>
                <input
                  type="text"
                  value={opt}
                  onChange={e => {
                    const copy = [...newQOptions];
                    copy[idx] = e.target.value;
                    setNewQOptions(copy);
                  }}
                  placeholder={`Option ${String.fromCharCode(65 + idx)}`}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-white/10 text-xs text-white"
                />
              </div>
            ))}
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1.5">Mastery Explanation</label>
            <input
              type="text"
              value={newQExplanation}
              onChange={e => setNewQExplanation(e.target.value)}
              placeholder="Explain why the correct answer is right..."
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-white/10 text-xs text-white"
            />
          </div>

          <div className="flex justify-end">
            <UIversePushableButton type="submit" variant="emerald" disabled={savingQuestion}>
              <Plus className="w-4 h-4" />
              <span>{savingQuestion ? 'Saving...' : 'Publish to Campus Question Bank'}</span>
            </UIversePushableButton>
          </div>
        </form>

        <div className="smart-glass p-6 rounded-3xl space-y-3">
          <h3 className="text-sm font-extrabold text-white">
            Active Question Pool ({allQuestions.length} Verified Questions)
          </h3>
          <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1">
            {allQuestions.map((q, idx) => (
              <div key={q.id} className="p-3.5 rounded-2xl bg-slate-950/70 border border-white/10 text-xs space-y-1">
                <div className="flex items-center justify-between text-slate-400">
                  <span className="font-bold text-indigo-400">{q.subject} · {q.difficulty}</span>
                  <span>{q.createdByName || 'Curriculum'}</span>
                </div>
                <p className="font-bold text-white">{idx + 1}. {q.question}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ============================================================================
  // RENDER: EXAM PREPARATION SUB-SCREEN
  // ============================================================================
  if (activeView === 'exam_prep') {
    return (
      <BrainBattleExamPrep
        currentUser={currentUser}
        effectiveRole={effectiveRole}
        onGoBack={() => setActiveView('home')}
        showNotification={showNotification}
        onStartExamMatch={({ subject, chapters, isMockExam, questionCount, difficulty }) => {
          setSelectedSubject(subject);
          setSelectedDifficulty(difficulty);
          setSelectedQuestionCount(questionCount);
          setTimePerQuestion(isMockExam ? 25 : 15);
          startMatch('custom_practice', subject);
        }}
      />
    );
  }

  // ============================================================================
  // RENDER: BRAIN BATTLE HOME SCREEN (MAIN HUB)
  // ============================================================================
  return (
    <div className="space-y-6">
      {/* 1. Animated Hero Banner with SplitTextReveal, Spotlight, and UIverse 3D Play CTA */}
      <AceternityCardSpotlight
        spotlightColor="rgba(99, 102, 241, 0.22)"
        className="p-6 sm:p-8 border-indigo-500/30 bg-gradient-to-br from-slate-900/95 via-indigo-950/40 to-slate-900"
      >
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          <div className="lg:col-span-7 space-y-4">
            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-indigo-400">
              <span className="flex items-center gap-1.5 text-amber-400 font-bold">
                <Swords className="w-4 h-4" /> StudentOS Brain Battle Arena
              </span>
              <span aria-hidden="true">·</span>
              <span className="text-slate-300 capitalize">
                Open to All Campus Roles ({effectiveRole.replace('_', ' ')})
              </span>
              <span aria-hidden="true">·</span>
              <span className="text-slate-400">{allQuestions.length} Verified Questions</span>
            </div>

            <h1 className="text-2xl sm:text-4xl font-black font-display text-white tracking-tight leading-tight">
              <ReactBitsSplitText text="Test Your Mastery. Climb the Campus Standings." />
            </h1>

            <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
              Compete in rapid-fire solo rounds, conquer the daily campus challenge, or host live real-time multiplayer battles. Every verified round awards Scholar XP, advances your level, and unlocks merit badges.
            </p>

            {/* Primary Play Controls */}
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <UIversePushableButton
                variant="indigo"
                onClick={() => startMatch('quick_play')}
              >
                <Play className="w-4 h-4 fill-current" />
                <span>Play Now ({selectedSubject})</span>
              </UIversePushableButton>

              <UIversePushableButton
                variant="amber"
                onClick={() => startMatch('daily_challenge')}
              >
                <Flame className="w-4 h-4" />
                <span>{isDailyCompletedToday ? 'Replay Daily Challenge' : 'Daily Challenge (+50 XP)'}</span>
              </UIversePushableButton>

              <UIversePushableButton
                variant="indigo"
                onClick={() => {
                  soundService.playButtonClick();
                  setActiveView('exam_prep');
                }}
              >
                <BookOpen className="w-4 h-4 text-purple-300" />
                <span>Exam Preparation</span>
              </UIversePushableButton>

              <button
                type="button"
                onClick={() => setActiveView('leaderboard')}
                className="px-4 py-3 rounded-2xl bg-slate-950/80 hover:bg-slate-900 border border-white/10 text-xs font-bold text-slate-200 hover:text-white flex items-center gap-2 cursor-pointer transition-colors"
              >
                <Trophy className="w-4 h-4 text-amber-400" />
                <span>Leaderboard (#{myLeaderboardRank})</span>
              </button>

              {isStaff && (
                <button
                  type="button"
                  onClick={() => setActiveView('question_bank')}
                  className="px-4 py-3 rounded-2xl bg-emerald-950/60 hover:bg-emerald-900/60 border border-emerald-500/30 text-xs font-bold text-emerald-300 flex items-center gap-1.5 cursor-pointer transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  <span>Question Studio</span>
                </button>
              )}

              <button
                type="button"
                onClick={toggleSound}
                className="p-3 rounded-2xl bg-slate-950/80 hover:bg-slate-900 border border-white/10 text-slate-300 hover:text-white cursor-pointer"
                title={soundMuted ? 'Unmute Arena Audio' : 'Mute Arena Audio'}
              >
                {soundMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4 text-indigo-400" />}
              </button>
            </div>
          </div>

          {/* Right: Player Level, Animated XP Progress & Badges Card */}
          <div className="lg:col-span-5">
            <ReactBitsTiltedCard>
              <div className="p-5 rounded-3xl bg-slate-950/85 border border-white/10 space-y-4 shadow-xl">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-13 h-13 rounded-2xl bg-gradient-to-br ${levelInfo.current.color} flex flex-col items-center justify-center text-xl shadow-md border border-white/20 shrink-0`}
                    >
                      <span>{levelInfo.current.icon}</span>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400 block">
                        Level {levelInfo.current.level} · {levelInfo.current.title}
                      </span>
                      <h3 className="text-base font-black text-white truncate">
                        {currentUser.name}
                      </h3>
                    </div>
                  </div>
                  <div className="text-right">
                    <MagicNumberTicker
                      value={gamificationProfile.xp}
                      suffix=" XP"
                      className="text-lg font-black text-amber-400 block"
                    />
                    <span className="text-[11px] text-orange-400 font-mono">
                      🔥 {gamificationProfile.currentStreak}d Streak
                    </span>
                  </div>
                </div>

                {/* Level Progress Bar */}
                <div className="space-y-1.5">
                  <div className="w-full h-2.5 bg-slate-900 rounded-full overflow-hidden border border-white/10">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${levelInfo.progressPercent}%` }}
                      transition={{ duration: 0.6, ease: 'easeOut' }}
                      className="h-full bg-gradient-to-r from-amber-400 via-orange-500 to-indigo-500"
                    />
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    {levelInfo.next ? (
                      <>
                        <span>{levelInfo.progressPercent}% to Level {levelInfo.next.level}</span>
                        <span className="font-mono text-amber-300">{levelInfo.xpRequiredForNext} XP needed</span>
                      </>
                    ) : (
                      <span className="text-amber-300 font-bold">Maximum Level Reached!</span>
                    )}
                  </div>
                </div>

                {/* Earned Badges Strip */}
                <div className="pt-2 border-t border-white/10 flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-slate-400">
                    Earned Badges ({earnedBadgesList.length}/{GAMIFICATION_BADGES.length})
                  </span>
                  <div className="flex items-center gap-1.5">
                    {earnedBadgesList.length > 0 ? (
                      earnedBadgesList.slice(0, 6).map(b => (
                        <span
                          key={b.id}
                          title={`${b.name}: ${b.description}`}
                          className="w-7 h-7 rounded-lg bg-slate-900 border border-white/10 flex items-center justify-center text-sm"
                        >
                          {b.icon}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-slate-500">Complete 1 match to unlock ⚔️</span>
                    )}
                  </div>
                </div>
              </div>
            </ReactBitsTiltedCard>
          </div>
        </div>
      </AceternityCardSpotlight>

      {/* 2. Three Primary Game Modes Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Mode 1: Quick Play & Subject Selector */}
        <AceternityCardSpotlight className="p-5 sm:p-6 flex flex-col justify-between space-y-5">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-2xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                <Zap className="w-5 h-5" />
              </div>
              <span className="text-xs font-mono text-indigo-400 font-bold">+35–75 XP / Round</span>
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-white">Quick Play & Subject Mastery</h3>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                Choose a subject and difficulty to launch an instant timed round with instant explanations.
              </p>
            </div>

            {/* Subject Pills */}
            <div className="space-y-2 pt-1">
              <span className="text-[11px] font-bold text-slate-400 block">Select Subject</span>
              <div className="flex flex-wrap gap-1.5">
                {availableSubjects.map(subj => (
                  <button
                    key={subj}
                    type="button"
                    onClick={() => setSelectedSubject(subj)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                      selectedSubject === subj
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'bg-slate-950/80 text-slate-300 hover:text-white border border-white/10'
                    }`}
                  >
                    {subj}
                  </button>
                ))}
              </div>
            </div>

            {/* Difficulty & Length Controls */}
            <div className="grid grid-cols-2 gap-2.5 pt-1">
              <div>
                <label className="text-[11px] font-bold text-slate-400 block mb-1">Difficulty</label>
                <select
                  value={selectedDifficulty}
                  onChange={e => setSelectedDifficulty(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-xs text-white font-semibold"
                >
                  <option value="all">All Levels</option>
                  <option value="easy">Easy</option>
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
                </select>
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-400 block mb-1">Questions</label>
                <select
                  value={selectedQuestionCount}
                  onChange={e => setSelectedQuestionCount(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-xs text-white font-semibold"
                >
                  <option value={3}>3 Questions (Fast)</option>
                  <option value={5}>5 Questions (Standard)</option>
                  <option value={8}>8 Questions (Deep)</option>
                </select>
              </div>
            </div>
          </div>

          <UIversePushableButton
            variant="indigo"
            onClick={() => startMatch('quick_play')}
            className="w-full"
          >
            <Play className="w-4 h-4 fill-current" />
            <span>Start {selectedSubject} Battle</span>
          </UIversePushableButton>
        </AceternityCardSpotlight>

        {/* Mode 2: Daily Campus Challenge */}
        <AceternityCardSpotlight
          spotlightColor="rgba(245, 158, 11, 0.16)"
          className="p-5 sm:p-6 flex flex-col justify-between space-y-5"
        >
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
                <Flame className="w-5 h-5" />
              </div>
              <span className="text-xs font-mono text-amber-400 font-bold">
                {isDailyCompletedToday ? '✓ Claimed Today' : 'Daily Bonus +50 XP'}
              </span>
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-white">Daily Campus Challenge</h3>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                A curated 5-question cross-disciplinary gauntlet updated every 24 hours for the entire school.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-950/80 border border-white/10 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Today’s Date</span>
                <span className="font-mono font-bold text-white">{todayStr}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Format</span>
                <span className="font-bold text-amber-300">5 Mixed Questions · 15s Timer</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Badge Unlock</span>
                <span className="font-bold text-emerald-400">🌅 Daily Conqueror</span>
              </div>
            </div>
          </div>

          <UIversePushableButton
            variant="amber"
            onClick={() => startMatch('daily_challenge')}
            className="w-full"
          >
            <Sparkles className="w-4 h-4" />
            <span>{isDailyCompletedToday ? 'Practice Today’s Challenge' : 'Play Daily Challenge'}</span>
          </UIversePushableButton>
        </AceternityCardSpotlight>

        {/* Mode 3: Real-Time Multiplayer Battles */}
        <AceternityCardSpotlight
          spotlightColor="rgba(16, 185, 129, 0.16)"
          className="p-5 sm:p-6 flex flex-col justify-between space-y-5"
        >
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <Users className="w-5 h-5" />
              </div>
              <span className="text-xs font-mono text-emerald-400 font-bold">Live WebSockets</span>
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-white">Multiplayer Arena Duels</h3>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                Host a live room or join with a 6-character code to compete head-to-head in real time.
              </p>
            </div>

            {/* Join Room by Code */}
            <div className="space-y-2 pt-1">
              <div className="flex gap-2">
                <input
                  type="text"
                  maxLength={6}
                  value={roomCodeInput}
                  onChange={e => setRoomCodeInput(e.target.value.toUpperCase())}
                  placeholder="ROOM CODE"
                  className="flex-1 px-3.5 py-2.5 rounded-xl bg-slate-950 border border-white/10 font-mono text-xs font-bold text-white uppercase tracking-widest"
                />
                <button
                  type="button"
                  onClick={() => handleJoinMultiplayerRoom()}
                  className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs cursor-pointer transition-colors"
                >
                  Join
                </button>
              </div>
              {roomError && <p className="text-xs text-rose-400 font-semibold">{roomError}</p>}
            </div>

            {/* Open Campus Rooms List */}
            {availableRooms.filter(r => r.status === 'lobby').length > 0 && (
              <div className="space-y-1.5">
                <span className="text-[11px] font-bold text-slate-400 block">Open Rooms</span>
                {availableRooms
                  .filter(r => r.status === 'lobby')
                  .slice(0, 2)
                  .map(r => (
                    <div
                      key={r.code}
                      className="p-2.5 rounded-xl bg-slate-950/80 border border-white/10 flex items-center justify-between text-xs"
                    >
                      <div>
                        <span className="font-mono font-bold text-emerald-400">{r.code}</span>
                        <span className="text-slate-400 ml-2">{r.hostName} ({r.playerCount}p)</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleJoinMultiplayerRoom(r.code)}
                        className="text-indigo-400 hover:text-white font-bold cursor-pointer"
                      >
                        Join →
                      </button>
                    </div>
                  ))}
              </div>
            )}
          </div>

          <UIversePushableButton
            variant="emerald"
            onClick={handleCreateMultiplayerRoom}
            className="w-full"
          >
            <Swords className="w-4 h-4" />
            <span>Create Live Battle Room</span>
          </UIversePushableButton>
        </AceternityCardSpotlight>
      </div>

      {/* 3. Bottom Split: Recent Match History & How XP / Rewards Work */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Recent Match History */}
        <div className="lg:col-span-7 smart-glass p-5 sm:p-6 rounded-3xl space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <History className="w-4 h-4 text-indigo-400" />
              <h3 className="text-sm font-extrabold text-white">Recent Brain Battle Results</h3>
            </div>
            <span className="text-xs text-slate-400 font-mono">
              {matchHistory.length} Matches Recorded
            </span>
          </div>

          {matchHistory.length === 0 ? (
            <div className="p-8 rounded-2xl bg-slate-950/60 border border-white/5 text-center space-y-2">
              <p className="text-xs font-bold text-slate-300">No matches played yet in this session</p>
              <p className="text-xs text-slate-500">
                Launch Quick Play or the Daily Challenge above to record your first score and unlock the Arena Challenger badge!
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {matchHistory.slice(0, 5).map(item => (
                <div
                  key={item.id}
                  className="p-3.5 rounded-2xl bg-slate-950/80 border border-white/10 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="font-bold text-white truncate">{item.subject}</span>
                      <span aria-hidden="true" className="text-slate-600">·</span>
                      <span className="text-slate-400 capitalize">{item.mode.replace('_', ' ')}</span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {item.correctCount}/{item.totalQuestions} Correct ({item.accuracyPercent}% Accuracy) · {item.streakPeak}x Peak Streak
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="font-mono font-black text-xs text-amber-400 block tabular-nums">
                      +{item.xpEarned} XP
                    </span>
                    <span className="font-mono text-[11px] text-slate-400 tabular-nums">
                      {item.score} pts
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* How XP, Levels & Fair Play Rules Work */}
        <div className="lg:col-span-5 smart-glass p-5 sm:p-6 rounded-3xl space-y-4">
          <div className="flex items-center gap-2">
            <Award className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm font-extrabold text-white">How XP & Arena Rewards Work</h3>
          </div>

          <div className="space-y-2.5 text-xs text-slate-300">
            <div className="p-3 rounded-2xl bg-slate-950/70 border border-white/10 flex items-center justify-between">
              <span>Base Match Completion + Speed</span>
              <span className="font-mono font-bold text-indigo-400">+25 to +55 XP</span>
            </div>
            <div className="p-3 rounded-2xl bg-slate-950/70 border border-white/10 flex items-center justify-between">
              <span>High Accuracy Mastery (80%+)</span>
              <span className="font-mono font-bold text-emerald-400">+20 XP Bonus</span>
            </div>
            <div className="p-3 rounded-2xl bg-slate-950/70 border border-white/10 flex items-center justify-between">
              <span>Daily Campus Challenge</span>
              <span className="font-mono font-bold text-amber-400">+50 XP (1x/day)</span>
            </div>
            <div className="p-3 rounded-2xl bg-slate-950/70 border border-white/10 flex items-center justify-between">
              <span>Live Multiplayer Victory</span>
              <span className="font-mono font-bold text-purple-400">+45 XP + Shield Badge</span>
            </div>
          </div>

          <p className="text-[11px] text-slate-400 leading-relaxed pt-1">
            All StudentOS roles—Students, Teachers, Coordinators, and Administrators—compete under identical scoring and anti-duplicate verification rules.
          </p>
        </div>
      </div>
    </div>
  );
};

export default BrainBattleArena;
