/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * StudentOS — Premium Animated Robot Teacher ("Byte" / Orion AI Tutor)
 * Expressive interactive vector robot tutor featuring:
 * - Sleek cybernetic chassis with metallic finish and floating magnetic joints
 * - Interactive gaze tracking (eyes subtly follow cursor position)
 * - Holographic LED visor with mood-specific expressions (happy, thinking, teaching, guiding, curious, idle)
 * - Dynamic 7-band soundwave mouth visualizer synchronized with speech synthesis
 * - Quantum Arc Reactor chest with orbital particle rings
 * - Articulated magnetic limbs with gesture animations (pointing stylus, celebrating hands, thinking chin-tap)
 * - Plasma ion thrusters with shimmering exhaust flame
 * - Intelligent Auto-Voice robotic speech engine with speed controls & voice preference persistence
 * - Next-level holographic HUD speech bubble with quick pedagogical action chips
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Volume2,
  VolumeX,
  Sparkles,
  Lightbulb,
  Brain,
  Zap,
  HelpCircle,
  X,
  RotateCcw,
  Compass,
  ArrowRight
} from 'lucide-react';
import { soundService } from '../../lib/soundService';

export type RobotMood = 'idle' | 'teaching' | 'thinking' | 'happy' | 'guiding' | 'curious';

export interface RobotBubbleAction {
  label: string;
  icon?: string;
  actionType: 'simpler' | 'analogy' | 'exam_tip' | 'quiz';
}

interface AnimatedRobotTeacherProps {
  mood?: RobotMood;
  speechText?: string;
  autoSpeak?: boolean;
  bubbleMessage?: string;
  bubbleTitle?: string;
  size?: 'sm' | 'md' | 'lg' | 'hero';
  onSpeechEnd?: () => void;
  onBubbleAction?: (actionType: 'simpler' | 'analogy' | 'exam_tip' | 'quiz') => void;
  className?: string;
  showAutoSpeakToggle?: boolean;
}

export const AnimatedRobotTeacher: React.FC<AnimatedRobotTeacherProps> = ({
  mood = 'idle',
  speechText = '',
  autoSpeak,
  bubbleMessage,
  bubbleTitle = 'Byte · AI Tutor',
  size = 'md',
  onSpeechEnd,
  onBubbleAction,
  className = '',
  showAutoSpeakToggle = true
}) => {
  // Speech Synthesis & Voice State
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const [speechRate, setSpeechRate] = useState<number>(1.05);
  const [isBubbleDismissed, setIsBubbleDismissed] = useState<boolean>(false);
  const [internalMood, setInternalMood] = useState<RobotMood>(mood);
  
  // Interactive Cursor Tracking
  const [mouseOffset, setMouseOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  // Auto-Voice User Preference (Stored in localStorage)
  const [autoVoiceEnabled, setAutoVoiceEnabled] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    if (autoSpeak !== undefined) return autoSpeak;
    const stored = localStorage.getItem('studentos_byte_autovoice');
    return stored === null ? true : stored === 'true';
  });

  // Track cursor movement relative to robot to create subtle eye tracking
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const deltaX = Math.max(-1, Math.min(1, (e.clientX - centerX) / (window.innerWidth / 2)));
      const deltaY = Math.max(-1, Math.min(1, (e.clientY - centerY) / (window.innerHeight / 2)));
      setMouseOffset({ x: deltaX * 3.5, y: deltaY * 2.5 });
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  // Sync internal mood with prop or override when speaking
  useEffect(() => {
    if (isSpeaking) {
      setInternalMood('teaching');
    } else {
      setInternalMood(mood);
    }
  }, [mood, isSpeaking]);

  // Reset bubble dismissal whenever message changes
  useEffect(() => {
    setIsBubbleDismissed(false);
  }, [bubbleMessage]);

  // Clean up speech synthesis on unmount
  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  // Clean raw text for speech synthesis
  const cleanSpeechForTTS = (text: string): string => {
    return text
      .replace(/```[\s\S]*?```/g, ' ')
      .replace(/`.*?`/g, ' ')
      .replace(/\[(.*?)\]\(.*?\)/g, '$1')
      .replace(/[#*_~>[\]()]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  };

  // Perform Speech Synthesis
  const speakText = useCallback((textToSpeak: string) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

    const cleaned = cleanSpeechForTTS(textToSpeak);
    if (!cleaned) return;

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(cleaned);
    utterance.rate = speechRate;
    utterance.pitch = 1.08; // Slightly elevated cheerful robotic pitch

    // Select the best available natural/Google/English voice
    const voices = window.speechSynthesis.getVoices();
    const preferredVoice = voices.find(
      v =>
        v.lang.startsWith('en') &&
        (v.name.includes('Natural') ||
          v.name.includes('Google') ||
          v.name.includes('Samantha') ||
          v.name.includes('Karen') ||
          v.name.includes('Ava') ||
          v.name.includes('Zira'))
    ) || voices.find(v => v.lang.startsWith('en'));

    if (preferredVoice) utterance.voice = preferredVoice;

    utterance.onstart = () => {
      setIsSpeaking(true);
    };

    utterance.onend = () => {
      setIsSpeaking(false);
      if (onSpeechEnd) onSpeechEnd();
    };

    utterance.onerror = () => {
      setIsSpeaking(false);
    };

    utteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  }, [speechRate, onSpeechEnd]);

  // Auto-speak when speechText changes and autoVoice is enabled
  useEffect(() => {
    if (!speechText || !autoVoiceEnabled) return;

    // Small delay to let UI mount smoothly before audio starts
    const timer = setTimeout(() => {
      speakText(speechText);
    }, 400);

    return () => clearTimeout(timer);
  }, [speechText, autoVoiceEnabled, speakText]);

  // Toggle voice playback manually
  const handleToggleVoice = () => {
    if (isSpeaking) {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      setIsSpeaking(false);
    } else {
      const targetText = speechText || bubbleMessage || '';
      if (targetText) {
        speakText(targetText);
      }
    }
  };

  // Toggle Auto-Voice preference
  const handleToggleAutoVoice = () => {
    const nextVal = !autoVoiceEnabled;
    setAutoVoiceEnabled(nextVal);
    if (typeof window !== 'undefined') {
      localStorage.setItem('studentos_byte_autovoice', String(nextVal));
    }
    soundService.playButtonClick();
    if (!nextVal && isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }
  };

  // Cycle speech rate (0.9x -> 1.05x -> 1.25x)
  const handleCycleRate = () => {
    const nextRate = speechRate === 1.05 ? 1.25 : speechRate === 1.25 ? 0.9 : 1.05;
    setSpeechRate(nextRate);
    if (utteranceRef.current) {
      utteranceRef.current.rate = nextRate;
    }
  };

  // Interactive Click on Robot Body (Easter Egg / Encouragement)
  const handleRobotClick = () => {
    soundService.playMessagePing();
    setInternalMood('happy');
    const cheers = [
      "Let's conquer this concept together! ✨",
      "Your brain is forming new neural connections right now! 🧠",
      "Curiosity is the superpower of elite scholars! 🚀",
      "Ready for any question! Try me! ⚡"
    ];
    const pick = cheers[Math.floor(Math.random() * cheers.length)];
    if (autoVoiceEnabled) {
      speakText(pick);
    }
  };

  // Dimensional scale based on size prop
  const scale = size === 'sm' ? 0.72 : size === 'lg' ? 1.25 : size === 'hero' ? 1.5 : 1.0;
  const width = Math.round(180 * scale);
  const height = Math.round(200 * scale);

  // Dynamic cyber color palette matching active mood
  const moodTheme = {
    idle: {
      primary: '#38bdf8', // Neon Sky Blue
      secondary: '#818cf8', // Indigo
      glow: 'rgba(56, 189, 248, 0.5)',
      accent: '#67e8f9'
    },
    teaching: {
      primary: '#06b6d4', // Cyan
      secondary: '#3b82f6', // Blue
      glow: 'rgba(6, 182, 212, 0.6)',
      accent: '#a5f3fc'
    },
    thinking: {
      primary: '#c084fc', // Purple
      secondary: '#a855f7', // Violet
      glow: 'rgba(192, 132, 252, 0.6)',
      accent: '#e9d5ff'
    },
    happy: {
      primary: '#34d399', // Emerald
      secondary: '#fbbf24', // Amber
      glow: 'rgba(52, 211, 153, 0.65)',
      accent: '#fef08a'
    },
    guiding: {
      primary: '#fbbf24', // Amber Gold
      secondary: '#f97316', // Orange
      glow: 'rgba(251, 191, 36, 0.6)',
      accent: '#fed7aa'
    },
    curious: {
      primary: '#38bdf8', // Cyan
      secondary: '#ec4899', // Pink
      glow: 'rgba(56, 189, 248, 0.55)',
      accent: '#fbcfe8'
    }
  }[internalMood];

  return (
    <div
      ref={containerRef}
      className={`flex flex-col items-center select-none relative group ${className}`}
    >
      {/* ==================================================================== */}
      {/* 1. NEXT-LEVEL SCI-FI HOLOGRAPHIC HUD SPEECH BUBBLE */}
      {/* ==================================================================== */}
      <AnimatePresence>
        {bubbleMessage && !isBubbleDismissed && (
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.94 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            className="mb-3 w-full max-w-sm sm:max-w-md p-4 rounded-3xl bg-slate-900/95 border border-cyan-500/40 text-white shadow-[0_12px_36px_rgba(6,182,212,0.22)] backdrop-blur-xl relative z-20"
          >
            {/* Top Bar: Robot Identification & Voice Equalizer Badge */}
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-white/10 text-xs">
              <div className="flex items-center gap-2">
                <div
                  className="w-2.5 h-2.5 rounded-full animate-ping"
                  style={{ backgroundColor: moodTheme.primary }}
                />
                <span className="font-extrabold tracking-wider font-mono text-cyan-300 text-[11px] uppercase flex items-center gap-1.5">
                  {internalMood === 'happy' && <Sparkles className="w-3.5 h-3.5 text-amber-400" />}
                  {internalMood === 'guiding' && <Lightbulb className="w-3.5 h-3.5 text-amber-400" />}
                  {internalMood === 'thinking' && <Brain className="w-3.5 h-3.5 text-purple-400" />}
                  {internalMood === 'teaching' && <Zap className="w-3.5 h-3.5 text-cyan-400" />}
                  {internalMood === 'idle' && <Compass className="w-3.5 h-3.5 text-sky-400" />}
                  <span>{bubbleTitle}</span>
                </span>
              </div>

              <div className="flex items-center gap-2">
                {/* Live Speaking Indicator Wave */}
                {isSpeaking && (
                  <div className="flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-cyan-500/20 border border-cyan-500/40 text-[10px] font-mono text-cyan-200">
                    <span className="w-1 h-2.5 bg-cyan-400 animate-pulse rounded-full" />
                    <span className="w-1 h-3.5 bg-cyan-300 animate-pulse delay-75 rounded-full" />
                    <span className="w-1 h-2 bg-cyan-400 animate-pulse delay-150 rounded-full" />
                    <span className="ml-1 text-[9px] font-bold uppercase">Speaking</span>
                  </div>
                )}

                {/* Dismiss Button */}
                <button
                  type="button"
                  onClick={() => setIsBubbleDismissed(true)}
                  className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                  title="Dismiss thought"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Bubble Message Text */}
            <p className="text-slate-100 text-xs sm:text-sm leading-relaxed font-sans font-medium">
              {bubbleMessage}
            </p>

            {/* Interactive Action Quick-Chips (Pedagogical Accelerators) */}
            {onBubbleAction && (
              <div className="mt-3 pt-2.5 border-t border-white/10 flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => onBubbleAction('simpler')}
                  className="px-2.5 py-1 rounded-xl bg-slate-800/90 hover:bg-slate-700 border border-white/10 hover:border-cyan-400/50 text-[11px] font-medium text-slate-300 hover:text-white transition-all flex items-center gap-1 cursor-pointer"
                >
                  <span>💡 Simpler</span>
                </button>
                <button
                  type="button"
                  onClick={() => onBubbleAction('analogy')}
                  className="px-2.5 py-1 rounded-xl bg-slate-800/90 hover:bg-slate-700 border border-white/10 hover:border-purple-400/50 text-[11px] font-medium text-slate-300 hover:text-white transition-all flex items-center gap-1 cursor-pointer"
                >
                  <span>🌍 Real Analogy</span>
                </button>
                <button
                  type="button"
                  onClick={() => onBubbleAction('exam_tip')}
                  className="px-2.5 py-1 rounded-xl bg-slate-800/90 hover:bg-slate-700 border border-white/10 hover:border-amber-400/50 text-[11px] font-medium text-slate-300 hover:text-white transition-all flex items-center gap-1 cursor-pointer"
                >
                  <span>🎯 Exam Trick</span>
                </button>
                <button
                  type="button"
                  onClick={() => onBubbleAction('quiz')}
                  className="px-2.5 py-1 rounded-xl bg-cyan-950/60 hover:bg-cyan-900 border border-cyan-500/40 text-[11px] font-bold text-cyan-200 transition-all flex items-center gap-1 cursor-pointer"
                >
                  <span>⚡ Quiz Me</span>
                </button>
              </div>
            )}

            {/* Holographic Arrow Pointer */}
            <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-slate-900 border-r border-b border-cyan-500/40 rotate-45" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ==================================================================== */}
      {/* 2. PREMIUM ANIMATED VECTOR ROBOT CHASSIS ("BYTE") */}
      {/* ==================================================================== */}
      <motion.div
        onClick={handleRobotClick}
        animate={
          internalMood === 'happy'
            ? { y: [0, -14, 0], rotate: [-1.5, 2, -1.5] }
            : internalMood === 'thinking'
            ? { y: [0, -4, 0], rotate: [0, 1, 0] }
            : { y: [0, -7, 0] }
        }
        transition={{
          duration: internalMood === 'happy' ? 1.1 : 2.6,
          repeat: Infinity,
          ease: 'easeInOut'
        }}
        className="relative cursor-pointer group-hover:drop-shadow-[0_0_24px_rgba(56,189,248,0.4)] transition-all"
        style={{ width, height }}
      >
        <svg
          viewBox="0 0 180 200"
          width={width}
          height={height}
          className="overflow-visible select-none drop-shadow-2xl"
        >
          <defs>
            {/* Metallic Head/Body Chassis Gradient */}
            <linearGradient id="byteChassisGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#334155" />
              <stop offset="40%" stopColor="#1e293b" />
              <stop offset="100%" stopColor="#0f172a" />
            </linearGradient>

            {/* Deep Holographic Visor Screen */}
            <linearGradient id="byteVisorGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#050811" />
              <stop offset="70%" stopColor="#0b1120" />
              <stop offset="100%" stopColor="#030712" />
            </linearGradient>

            {/* Mood Neon Gradient */}
            <linearGradient id="byteNeonGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor={moodTheme.primary} />
              <stop offset="100%" stopColor={moodTheme.secondary} />
            </linearGradient>

            {/* Visor Diagonal Gloss Sheen */}
            <linearGradient id="byteGlossGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0.32" />
              <stop offset="45%" stopColor="#ffffff" stopOpacity="0.06" />
              <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
            </linearGradient>

            {/* Glow Filter */}
            <filter id="byteNeonGlow" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="3.5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>

            {/* Plasma Flame Filter */}
            <filter id="plasmaFlameGlow" x="-40%" y="-40%" width="180%" height="180%">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* ============================================================== */}
          {/* A. PLASMA ION THRUSTERS & SHIMMERING PARTICLES */}
          {/* ============================================================== */}
          <g>
            {/* Dual Thruster Nozzles */}
            <ellipse cx="74" cy="172" rx="10" ry="3.5" fill="#1e293b" stroke="#475569" strokeWidth="1.5" />
            <ellipse cx="106" cy="172" rx="10" ry="3.5" fill="#1e293b" stroke="#475569" strokeWidth="1.5" />

            {/* Left Ion Flame */}
            <motion.path
              d="M 68 173 Q 74 195 80 173 Z"
              fill={moodTheme.primary}
              filter="url(#plasmaFlameGlow)"
              animate={{
                d: [
                  'M 68 173 Q 74 195 80 173 Z',
                  'M 67 173 Q 74 204 81 173 Z',
                  'M 68 173 Q 74 195 80 173 Z'
                ],
                opacity: [0.75, 1, 0.75]
              }}
              transition={{ duration: 0.6, repeat: Infinity, ease: 'easeInOut' }}
            />

            {/* Right Ion Flame */}
            <motion.path
              d="M 100 173 Q 106 195 112 173 Z"
              fill={moodTheme.primary}
              filter="url(#plasmaFlameGlow)"
              animate={{
                d: [
                  'M 100 173 Q 106 195 112 173 Z',
                  'M 99 173 Q 106 204 113 173 Z',
                  'M 100 173 Q 106 195 112 173 Z'
                ],
                opacity: [0.75, 1, 0.75]
              }}
              transition={{ duration: 0.6, repeat: Infinity, ease: 'easeInOut', delay: 0.1 }}
            />
          </g>

          {/* ============================================================== */}
          {/* B. ROBOT TORSO & QUANTUM ARC REACTOR */}
          {/* ============================================================== */}
          <g>
            {/* Magnetic Neck Joint */}
            <rect x="76" y="116" width="28" height="9" rx="4" fill="#1e293b" stroke="#475569" strokeWidth="1.5" />
            <circle cx="82" cy="120.5" r="2" fill={moodTheme.primary} />
            <circle cx="98" cy="120.5" r="2" fill={moodTheme.primary} />

            {/* Chest Armor Plate */}
            <path
              d="M 50 125 L 130 125 L 118 168 L 62 168 Z"
              fill="url(#byteChassisGrad)"
              stroke="#475569"
              strokeWidth="2.5"
            />

            {/* Cyber Seam Lines */}
            <line x1="56" y1="135" x2="74" y2="135" stroke="#475569" strokeWidth="1.5" />
            <line x1="106" y1="135" x2="124" y2="135" stroke="#475569" strokeWidth="1.5" />

            {/* Quantum Arc Reactor Outer Ring */}
            <circle cx="90" cy="146" r="13" fill="#030712" stroke="#334155" strokeWidth="2" />
            <circle cx="90" cy="146" r="10" fill="none" stroke={moodTheme.secondary} strokeWidth="1" strokeDasharray="3 3" opacity="0.8" />

            {/* Pulsing Quantum Core Plasma */}
            <motion.circle
              cx="90"
              cy="146"
              r="7"
              fill={moodTheme.primary}
              filter="url(#byteNeonGlow)"
              animate={{
                r: [6.5, 8.5, 6.5],
                opacity: [0.75, 1, 0.75]
              }}
              transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
            />

            {/* Telemetry Battery / Power Bars */}
            <g opacity="0.7">
              <rect x="68" y="156" width="3" height="4" rx="1" fill={moodTheme.primary} />
              <rect x="73" y="156" width="3" height="4" rx="1" fill={moodTheme.primary} />
              <rect x="104" y="156" width="3" height="4" rx="1" fill={moodTheme.primary} />
              <rect x="109" y="156" width="3" height="4" rx="1" fill={moodTheme.primary} />
            </g>
          </g>

          {/* ============================================================== */}
          {/* C. ARTICULATED MAGNETIC ARMS & GESTURES */}
          {/* ============================================================== */}
          <g>
            {/* Left Magnetic Shoulder Sphere */}
            <circle cx="44" cy="132" r="7" fill="#334155" stroke="#64748b" strokeWidth="1.5" />
            <circle cx="44" cy="132" r="3" fill={moodTheme.primary} />

            {/* Right Magnetic Shoulder Sphere */}
            <circle cx="136" cy="132" r="7" fill="#334155" stroke="#64748b" strokeWidth="1.5" />
            <circle cx="136" cy="132" r="3" fill={moodTheme.primary} />

            {/* Arm Gestures based on Mood */}
            {internalMood === 'happy' ? (
              /* Both Arms Raised Celebrating! */
              <g stroke="#334155" strokeWidth="7" strokeLinecap="round" fill="none">
                <path d="M 44 132 Q 28 116 26 100" />
                <path d="M 136 132 Q 152 116 154 100" />
                <circle cx="26" cy="100" r="6" fill={moodTheme.primary} filter="url(#byteNeonGlow)" stroke="none" />
                <circle cx="154" cy="100" r="6" fill={moodTheme.primary} filter="url(#byteNeonGlow)" stroke="none" />
              </g>
            ) : internalMood === 'teaching' ? (
              /* Right Arm Holding Holographic Pointer Stylus */
              <g>
                {/* Left Arm Resting */}
                <path d="M 44 132 Q 38 148 42 160" stroke="#334155" strokeWidth="6" strokeLinecap="round" fill="none" />
                <circle cx="42" cy="160" r="5" fill="#475569" />

                {/* Right Arm Pointing Stylus */}
                <path d="M 136 132 Q 150 135 158 126" stroke="#334155" strokeWidth="6" strokeLinecap="round" fill="none" />
                <circle cx="158" cy="126" r="5" fill="#475569" />
                {/* Laser Pointer Beam */}
                <line x1="158" y1="126" x2="174" y2="114" stroke={moodTheme.primary} strokeWidth="2.5" strokeLinecap="round" filter="url(#byteNeonGlow)" />
                <circle cx="174" cy="114" r="3" fill="#ffffff" filter="url(#byteNeonGlow)" />
              </g>
            ) : internalMood === 'thinking' ? (
              /* Left Arm Tapping Head/Visor */
              <g>
                <path d="M 44 132 Q 30 110 38 88" stroke="#334155" strokeWidth="6" strokeLinecap="round" fill="none" />
                <circle cx="38" cy="88" r="5" fill={moodTheme.primary} filter="url(#byteNeonGlow)" />
                {/* Right Arm Resting */}
                <path d="M 136 132 Q 142 148 138 160" stroke="#334155" strokeWidth="6" strokeLinecap="round" fill="none" />
                <circle cx="138" cy="160" r="5" fill="#475569" />
              </g>
            ) : (
              /* Idle Resting Floating Arms */
              <g stroke="#334155" strokeWidth="6" strokeLinecap="round" fill="none">
                <path d="M 44 132 Q 38 148 42 160" />
                <circle cx="42" cy="160" r="5" fill="#475569" stroke="none" />
                <path d="M 136 132 Q 142 148 138 160" />
                <circle cx="138" cy="160" r="5" fill="#475569" stroke="none" />
              </g>
            )}
          </g>

          {/* ============================================================== */}
          {/* D. ANTENNA & QUANTUM BEACON */}
          {/* ============================================================== */}
          <g>
            {/* Antenna Stem */}
            <line x1="90" y1="36" x2="90" y2="16" stroke="#64748b" strokeWidth="4" strokeLinecap="round" />
            <circle cx="90" cy="24" r="4.5" fill="none" stroke={moodTheme.primary} strokeWidth="2" opacity="0.8" />

            {/* Glowing Beacon Head */}
            {internalMood === 'guiding' ? (
              /* Lightbulb Spark when Guiding */
              <g>
                <circle cx="90" cy="10" r="9" fill="#fef08a" opacity="0.95" filter="url(#byteNeonGlow)" />
                <line x1="90" y1="-1" x2="90" y2="-5" stroke="#fef08a" strokeWidth="2.5" strokeLinecap="round" />
                <line x1="102" y1="4" x2="106" y2="1" stroke="#fef08a" strokeWidth="2.5" strokeLinecap="round" />
                <line x1="78" y1="4" x2="74" y2="1" stroke="#fef08a" strokeWidth="2.5" strokeLinecap="round" />
              </g>
            ) : (
              /* Glowing Neon Beacon Orb */
              <motion.circle
                cx="90"
                cy="12"
                r="7.5"
                fill={moodTheme.primary}
                filter="url(#byteNeonGlow)"
                animate={
                  internalMood === 'thinking'
                    ? { r: [6.5, 9.5, 6.5], opacity: [0.7, 1, 0.7] }
                    : { opacity: [0.8, 1, 0.8] }
                }
                transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
              />
            )}
          </g>

          {/* ============================================================== */}
          {/* E. ROBOT HEAD / HELMET & CYBERNETIC VISOR */}
          {/* ============================================================== */}
          <g>
            {/* Audio Sensor Ear Node (Left) */}
            <rect x="22" y="56" width="10" height="28" rx="5" fill="#1e293b" stroke="#475569" strokeWidth="1.5" />
            <circle cx="27" cy="70" r="2.5" fill={moodTheme.primary} />

            {/* Audio Sensor Ear Node (Right) */}
            <rect x="148" y="56" width="10" height="28" rx="5" fill="#1e293b" stroke="#475569" strokeWidth="1.5" />
            <circle cx="153" cy="70" r="2.5" fill={moodTheme.primary} />

            {/* Main Rounded Cyber Helmet */}
            <rect
              x="30"
              y="36"
              width="120"
              height="82"
              rx="28"
              fill="url(#byteChassisGrad)"
              stroke="#475569"
              strokeWidth="2.5"
            />

            {/* Visor Screen Recess Frame */}
            <rect
              x="40"
              y="46"
              width="100"
              height="62"
              rx="18"
              fill="url(#byteVisorGrad)"
              stroke="#0f172a"
              strokeWidth="2.5"
            />

            {/* Diagonal Visor Gloss Reflection */}
            <path
              d="M 44 52 Q 90 46 136 52 Q 120 70 52 86 Z"
              fill="url(#byteGlossGrad)"
              pointerEvents="none"
            />

            {/* ========================================================== */}
            {/* F. HIGHLY EXPRESSIVE LED VISOR EYES (With Cursor Tracking) */}
            {/* ========================================================== */}
            <g transform={`translate(${mouseOffset.x}, ${mouseOffset.y})`}>
              {internalMood === 'happy' ? (
                /* Joyful Arched Smile Eyes with Star Sparkles */
                <g stroke={moodTheme.primary} strokeWidth="5" strokeLinecap="round" fill="none" filter="url(#byteNeonGlow)">
                  <path d="M 58 74 Q 67 62 76 74" />
                  <path d="M 104 74 Q 113 62 122 74" />
                  <circle cx="78" cy="62" r="1.5" fill="#ffffff" stroke="none" />
                  <circle cx="102" cy="62" r="1.5" fill="#ffffff" stroke="none" />
                </g>
              ) : internalMood === 'thinking' ? (
                /* High-Tech Horizontal Laser Scanning Beam */
                <g filter="url(#byteNeonGlow)">
                  {/* Left Scan Track */}
                  <rect x="54" y="70" width="28" height="6.5" rx="3.25" fill="#1e293b" />
                  {/* Right Scan Track */}
                  <rect x="98" y="70" width="28" height="6.5" rx="3.25" fill="#1e293b" />
                  {/* Sweeping Laser Pulse */}
                  <motion.rect
                    x="54"
                    y="70"
                    width="14"
                    height="6.5"
                    rx="3.25"
                    fill={moodTheme.primary}
                    animate={{ x: [54, 112, 54] }}
                    transition={{ duration: 1.3, repeat: Infinity, ease: 'easeInOut' }}
                  />
                </g>
              ) : internalMood === 'teaching' ? (
                /* Focused Concentric Lenses with Aperture Rings */
                <g filter="url(#byteNeonGlow)">
                  {/* Left Lens */}
                  <circle cx="67" cy="72" r="11" fill="none" stroke={moodTheme.primary} strokeWidth="2.5" />
                  <circle cx="67" cy="72" r="6" fill={moodTheme.primary} />
                  <circle cx="69" cy="70" r="2.5" fill="#ffffff" />

                  {/* Right Lens */}
                  <circle cx="113" cy="72" r="11" fill="none" stroke={moodTheme.primary} strokeWidth="2.5" />
                  <circle cx="113" cy="72" r="6" fill={moodTheme.primary} />
                  <circle cx="115" cy="70" r="2.5" fill="#ffffff" />
                </g>
              ) : internalMood === 'guiding' ? (
                /* Caring Warm Eyes with Amber Glow */
                <g filter="url(#byteNeonGlow)">
                  <ellipse cx="67" cy="72" rx="9" ry="11" fill={moodTheme.primary} />
                  <ellipse cx="113" cy="72" rx="9" ry="11" fill={moodTheme.primary} />
                  <circle cx="69" cy="69" r="3" fill="#ffffff" />
                  <circle cx="115" cy="69" r="3" fill="#ffffff" />
                </g>
              ) : (
                /* Standard Calm Eyes with Realistic Eyelid Blinking */
                <g filter="url(#byteNeonGlow)">
                  <motion.ellipse
                    cx="67"
                    cy="72"
                    rx="8.5"
                    ry="10.5"
                    fill={moodTheme.primary}
                    animate={{ scaleY: [1, 1, 0.08, 1] }}
                    transition={{ duration: 3.6, repeat: Infinity, times: [0, 0.9, 0.94, 1] }}
                  />
                  <motion.ellipse
                    cx="113"
                    cy="72"
                    rx="8.5"
                    ry="10.5"
                    fill={moodTheme.primary}
                    animate={{ scaleY: [1, 1, 0.08, 1] }}
                    transition={{ duration: 3.6, repeat: Infinity, times: [0, 0.9, 0.94, 1] }}
                  />
                  {/* Eye Highlights */}
                  <circle cx="69" cy="70" r="2.8" fill="#ffffff" />
                  <circle cx="115" cy="70" r="2.8" fill="#ffffff" />
                </g>
              )}
            </g>

            {/* ========================================================== */}
            {/* G. DYNAMIC 7-BAND SOUNDWAVE MOUTH EQUALIZER */}
            {/* ========================================================== */}
            {isSpeaking || internalMood === 'teaching' ? (
              /* Synchronized 7-Bar Frequency Equalizer */
              <g filter="url(#byteNeonGlow)">
                {/* Bar 1 */}
                <motion.line
                  x1="70"
                  y1="94"
                  x2="70"
                  y2="98"
                  stroke={moodTheme.secondary}
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  animate={{ y1: [94, 91, 94], y2: [98, 101, 98] }}
                  transition={{ duration: 0.28, repeat: Infinity }}
                />
                {/* Bar 2 */}
                <motion.line
                  x1="76"
                  y1="93"
                  x2="76"
                  y2="99"
                  stroke={moodTheme.primary}
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  animate={{ y1: [93, 89, 93], y2: [99, 103, 99] }}
                  transition={{ duration: 0.22, repeat: Infinity }}
                />
                {/* Bar 3 */}
                <motion.line
                  x1="83"
                  y1="92"
                  x2="83"
                  y2="100"
                  stroke={moodTheme.primary}
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  animate={{ y1: [92, 87, 92], y2: [100, 105, 100] }}
                  transition={{ duration: 0.3, repeat: Infinity }}
                />
                {/* Bar 4 (Center Apex) */}
                <motion.line
                  x1="90"
                  y1="91"
                  x2="90"
                  y2="101"
                  stroke="#ffffff"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  animate={{ y1: [91, 85, 91], y2: [101, 107, 101] }}
                  transition={{ duration: 0.18, repeat: Infinity }}
                />
                {/* Bar 5 */}
                <motion.line
                  x1="97"
                  y1="92"
                  x2="97"
                  y2="100"
                  stroke={moodTheme.primary}
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  animate={{ y1: [92, 88, 92], y2: [100, 104, 100] }}
                  transition={{ duration: 0.25, repeat: Infinity }}
                />
                {/* Bar 6 */}
                <motion.line
                  x1="104"
                  y1="93"
                  x2="104"
                  y2="99"
                  stroke={moodTheme.primary}
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  animate={{ y1: [93, 90, 93], y2: [99, 102, 99] }}
                  transition={{ duration: 0.32, repeat: Infinity }}
                />
                {/* Bar 7 */}
                <motion.line
                  x1="110"
                  y1="94"
                  x2="110"
                  y2="98"
                  stroke={moodTheme.secondary}
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  animate={{ y1: [94, 92, 94], y2: [98, 100, 98] }}
                  transition={{ duration: 0.35, repeat: Infinity }}
                />
              </g>
            ) : internalMood === 'happy' ? (
              /* Luminescent Smiling Mouth Arc */
              <path
                d="M 80 94 Q 90 102 100 94"
                stroke={moodTheme.primary}
                strokeWidth="2.5"
                strokeLinecap="round"
                fill="none"
                filter="url(#byteNeonGlow)"
              />
            ) : (
              /* Subtle Neutral LED Strip */
              <line
                x1="84"
                y1="95"
                x2="96"
                y2="95"
                stroke={moodTheme.primary}
                strokeWidth="2"
                strokeLinecap="round"
                opacity="0.65"
              />
            )}
          </g>
        </svg>
      </motion.div>

      {/* ==================================================================== */}
      {/* 3. ROBOT CONTROLS & AUTO-VOICE SYSTEM BAR */}
      {/* ==================================================================== */}
      <div className="mt-3 flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900/90 border border-white/10 shadow-xl backdrop-blur-md text-xs">
        {/* Listen / Voice Playback Button */}
        {(speechText || bubbleMessage) && (
          <button
            type="button"
            onClick={handleToggleVoice}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold transition-all cursor-pointer ${
              isSpeaking
                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 animate-pulse'
                : 'bg-cyan-600/30 hover:bg-cyan-600/50 text-cyan-200 border border-cyan-500/30'
            }`}
          >
            {isSpeaking ? (
              <>
                <VolumeX className="w-3.5 h-3.5" />
                <span>Pause</span>
              </>
            ) : (
              <>
                <Volume2 className="w-3.5 h-3.5 text-cyan-400" />
                <span>Listen Aloud</span>
              </>
            )}
          </button>
        )}

        {/* Auto-Voice Switch */}
        {showAutoSpeakToggle && (
          <button
            type="button"
            onClick={handleToggleAutoVoice}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all cursor-pointer ${
              autoVoiceEnabled
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                : 'bg-slate-800 text-slate-400 border border-white/5 hover:text-slate-200'
            }`}
            title="When active, Byte will automatically speak explanations aloud"
          >
            <span className={`w-1.5 h-1.5 rounded-full ${autoVoiceEnabled ? 'bg-emerald-400' : 'bg-slate-500'}`} />
            <span>Auto-Voice: {autoVoiceEnabled ? 'ON' : 'OFF'}</span>
          </button>
        )}

        {/* Speed Multiplier Button */}
        {isSpeaking && (
          <button
            type="button"
            onClick={handleCycleRate}
            className="px-2 py-0.5 rounded-md bg-slate-800 text-[10px] font-mono text-slate-300 hover:text-white"
            title="Toggle speech pace"
          >
            {speechRate}x
          </button>
        )}
      </div>
    </div>
  );
};
