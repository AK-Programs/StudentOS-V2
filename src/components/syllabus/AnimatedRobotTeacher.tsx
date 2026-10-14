/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * StudentOS — Animated Robot Teacher ("Byte" / Orion AI Tutor)
 * Expressive interactive vector robot tutor with dynamic mood animations,
 * digital soundwave mouth visualizer, glowing energy reactor,
 * and built-in text-to-speech classroom instruction.
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Volume2,
  VolumeX,
  Sparkles,
  Lightbulb,
  CheckCircle,
  HelpCircle,
  Brain,
  Zap,
  RotateCcw
} from 'lucide-react';

export type RobotMood = 'idle' | 'teaching' | 'thinking' | 'happy' | 'guiding' | 'curious';

interface AnimatedRobotTeacherProps {
  mood?: RobotMood;
  speechText?: string;
  autoSpeak?: boolean;
  bubbleMessage?: string;
  size?: 'sm' | 'md' | 'lg';
  onSpeechEnd?: () => void;
  className?: string;
}

export const AnimatedRobotTeacher: React.FC<AnimatedRobotTeacherProps> = ({
  mood = 'idle',
  speechText = '',
  autoSpeak = false,
  bubbleMessage,
  size = 'md',
  onSpeechEnd,
  className = ''
}) => {
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const [speechRate, setSpeechRate] = useState<number>(1.0);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [internalMood, setInternalMood] = useState<RobotMood>(mood);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  // Synchronize internal mood with prop or override when speaking
  useEffect(() => {
    if (isSpeaking) {
      setInternalMood('teaching');
    } else {
      setInternalMood(mood);
    }
  }, [mood, isSpeaking]);

  // Clean up speech on unmount
  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  // Handle Speech Synthesis
  const handleToggleSpeech = () => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }

    if (!speechText) return;

    // Clean markdown/HTML symbols from spoken text
    const cleanSpeech = speechText
      .replace(/[#*_`~>[\]()]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (!cleanSpeech) return;

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(cleanSpeech);
    utterance.rate = speechRate;
    utterance.pitch = 1.05; // Slightly cheerful, friendly pitch

    // Prefer high-quality English voice if available
    const voices = window.speechSynthesis.getVoices();
    const friendlyVoice = voices.find(
      v => v.lang.startsWith('en') && (v.name.includes('Natural') || v.name.includes('Google') || v.name.includes('Samantha') || v.name.includes('Karen'))
    );
    if (friendlyVoice) utterance.voice = friendlyVoice;

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
  };

  // Dimensions based on size prop
  const scale = size === 'sm' ? 0.75 : size === 'lg' ? 1.25 : 1.0;
  const width = Math.round(180 * scale);
  const height = Math.round(200 * scale);

  // Dynamic colors based on mood
  const moodColors = {
    idle: { primary: '#38bdf8', secondary: '#818cf8', glow: 'rgba(56, 189, 248, 0.4)' },
    teaching: { primary: '#60a5fa', secondary: '#38bdf8', glow: 'rgba(96, 165, 250, 0.5)' },
    thinking: { primary: '#c084fc', secondary: '#a855f7', glow: 'rgba(192, 132, 252, 0.5)' },
    happy: { primary: '#34d399', secondary: '#fbbf24', glow: 'rgba(52, 211, 153, 0.6)' },
    guiding: { primary: '#fbbf24', secondary: '#f97316', glow: 'rgba(251, 191, 36, 0.5)' },
    curious: { primary: '#38bdf8', secondary: '#f43f5e', glow: 'rgba(56, 189, 248, 0.4)' }
  }[internalMood];

  return (
    <div className={`flex flex-col items-center select-none relative ${className}`}>
      {/* Speech Bubble / Direct Guidance */}
      <AnimatePresence>
        {bubbleMessage && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 5, scale: 0.9 }}
            className="mb-2 max-w-xs px-3.5 py-2 rounded-2xl bg-slate-900/95 border border-indigo-500/30 text-white shadow-xl text-xs relative backdrop-blur-md"
          >
            <div className="flex items-center gap-1.5 font-bold text-indigo-300 text-[11px] mb-0.5">
              {internalMood === 'happy' && <Sparkles className="w-3.5 h-3.5 text-amber-400" />}
              {internalMood === 'guiding' && <Lightbulb className="w-3.5 h-3.5 text-amber-400" />}
              {internalMood === 'thinking' && <Brain className="w-3.5 h-3.5 text-purple-400" />}
              {internalMood === 'teaching' && <Zap className="w-3.5 h-3.5 text-cyan-400" />}
              {internalMood === 'idle' && <HelpCircle className="w-3.5 h-3.5 text-blue-400" />}
              <span>Byte · AI Teacher</span>
            </div>
            <p className="text-slate-200 text-xs leading-relaxed font-sans">{bubbleMessage}</p>
            {/* Bubble Tail */}
            <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-slate-900 border-r border-b border-indigo-500/30 rotate-45" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Animated Robot SVG Canvas */}
      <motion.div
        animate={
          internalMood === 'happy'
            ? { y: [0, -12, 0], rotate: [-1, 2, -1] }
            : internalMood === 'thinking'
            ? { y: [0, -3, 0], rotate: [0, 1, 0] }
            : { y: [0, -6, 0] }
        }
        transition={{
          duration: internalMood === 'happy' ? 1.2 : 2.8,
          repeat: Infinity,
          ease: 'easeInOut'
        }}
        className="relative"
        style={{ width, height }}
      >
        <svg
          viewBox="0 0 180 200"
          width={width}
          height={height}
          className="drop-shadow-2xl overflow-visible"
        >
          <defs>
            {/* Outer Helmet Gradient */}
            <linearGradient id="robotBodyGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#1e293b" />
              <stop offset="50%" stopColor="#0f172a" />
              <stop offset="100%" stopColor="#020617" />
            </linearGradient>

            {/* Glowing Visor Gradient */}
            <linearGradient id="robotVisorGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#090d16" />
              <stop offset="100%" stopColor="#0f172a" />
            </linearGradient>

            {/* Accent Neon Gradient */}
            <linearGradient id="neonGlowGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor={moodColors.primary} />
              <stop offset="100%" stopColor={moodColors.secondary} />
            </linearGradient>

            {/* Visor Reflection Gloss */}
            <linearGradient id="visorGloss" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0.25" />
              <stop offset="50%" stopColor="#ffffff" stopOpacity="0.05" />
              <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
            </linearGradient>

            {/* Glow Filter */}
            <filter id="robotNeonFilter" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* ========================================================== */}
          {/* 1. ANTENNA & LIGHTBULB / ENERGY BEACON */}
          {/* ========================================================== */}
          <g>
            {/* Antenna Stem */}
            <line
              x1="90"
              y1="38"
              x2="90"
              y2="18"
              stroke="#64748b"
              strokeWidth="4"
              strokeLinecap="round"
            />
            {/* Antenna Ring */}
            <circle
              cx="90"
              cy="24"
              r="4"
              fill="none"
              stroke={moodColors.primary}
              strokeWidth="2"
              opacity="0.8"
            />

            {/* Lightbulb over antenna if mood is 'guiding' */}
            {internalMood === 'guiding' ? (
              <g>
                <circle cx="90" cy="12" r="10" fill="#fef08a" opacity="0.9" filter="url(#robotNeonFilter)" />
                <path d="M 86 16 L 94 16 L 92 19 L 88 19 Z" fill="#94a3b8" />
                <line x1="90" y1="0" x2="90" y2="-4" stroke="#fef08a" strokeWidth="2" strokeLinecap="round" />
                <line x1="102" y1="6" x2="105" y2="3" stroke="#fef08a" strokeWidth="2" strokeLinecap="round" />
                <line x1="78" y1="6" x2="75" y2="3" stroke="#fef08a" strokeWidth="2" strokeLinecap="round" />
              </g>
            ) : (
              /* Glowing Orb Beacon */
              <motion.circle
                cx="90"
                cy="14"
                r="7"
                fill={moodColors.primary}
                filter="url(#robotNeonFilter)"
                animate={
                  internalMood === 'thinking'
                    ? { r: [6, 9, 6], opacity: [0.7, 1, 0.7] }
                    : { opacity: [0.8, 1, 0.8] }
                }
                transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
              />
            )}
          </g>

          {/* ========================================================== */}
          {/* 2. ROBOT HEAD / HELMET */}
          {/* ========================================================== */}
          <g>
            {/* Left Ear Sensor */}
            <rect x="24" y="58" width="10" height="26" rx="5" fill="#334155" stroke="#475569" strokeWidth="1.5" />
            <circle cx="29" cy="71" r="2.5" fill={moodColors.primary} />

            {/* Right Ear Sensor */}
            <rect x="146" y="58" width="10" height="26" rx="5" fill="#334155" stroke="#475569" strokeWidth="1.5" />
            <circle cx="151" cy="71" r="2.5" fill={moodColors.primary} />

            {/* Main Rounded Helmet */}
            <rect
              x="32"
              y="38"
              width="116"
              height="80"
              rx="28"
              fill="url(#robotBodyGrad)"
              stroke="#475569"
              strokeWidth="2.5"
            />

            {/* Visor Screen Recess */}
            <rect
              x="42"
              y="48"
              width="96"
              height="58"
              rx="18"
              fill="url(#robotVisorGrad)"
              stroke="#1e293b"
              strokeWidth="2"
            />

            {/* Visor Diagonal Gloss Highlight */}
            <path
              d="M 46 54 Q 90 48 134 54 Q 120 70 54 84 Z"
              fill="url(#visorGloss)"
              pointerEvents="none"
            />

            {/* ========================================================== */}
            {/* 3. EXPRESSIVE DIGITAL LED EYES */}
            {/* ========================================================== */}
            {internalMood === 'happy' ? (
              /* Joyful Arched / Star Eyes */
              <g stroke={moodColors.primary} strokeWidth="4.5" strokeLinecap="round" fill="none" filter="url(#robotNeonFilter)">
                {/* Left Arc Eye */}
                <path d="M 58 75 Q 67 64 76 75" />
                {/* Right Arc Eye */}
                <path d="M 104 75 Q 113 64 122 75" />
              </g>
            ) : internalMood === 'thinking' ? (
              /* Cycling Scanning Beams */
              <g filter="url(#robotNeonFilter)">
                <motion.rect
                  x="56"
                  y="71"
                  width="24"
                  height="7"
                  rx="3.5"
                  fill={moodColors.primary}
                  animate={{ opacity: [0.4, 1, 0.4] }}
                  transition={{ duration: 0.8, repeat: Infinity }}
                />
                <motion.rect
                  x="100"
                  y="71"
                  width="24"
                  height="7"
                  rx="3.5"
                  fill={moodColors.primary}
                  animate={{ opacity: [1, 0.4, 1] }}
                  transition={{ duration: 0.8, repeat: Infinity }}
                />
              </g>
            ) : internalMood === 'guiding' ? (
              /* Caring Warm Eyes with Sparkle */
              <g filter="url(#robotNeonFilter)">
                <ellipse cx="67" cy="73" rx="9" ry="11" fill={moodColors.primary} />
                <ellipse cx="113" cy="73" rx="9" ry="11" fill={moodColors.primary} />
                <circle cx="69" cy="70" r="3" fill="#ffffff" />
                <circle cx="115" cy="70" r="3" fill="#ffffff" />
              </g>
            ) : (
              /* Standard Glowing Oval Eyes with Blinking */
              <g filter="url(#robotNeonFilter)">
                <motion.ellipse
                  cx="67"
                  cy="73"
                  rx="8"
                  ry="10"
                  fill={moodColors.primary}
                  animate={{ scaleY: [1, 1, 0.1, 1] }}
                  transition={{ duration: 3.5, repeat: Infinity, times: [0, 0.9, 0.95, 1] }}
                />
                <motion.ellipse
                  cx="113"
                  cy="73"
                  rx="8"
                  ry="10"
                  fill={moodColors.primary}
                  animate={{ scaleY: [1, 1, 0.1, 1] }}
                  transition={{ duration: 3.5, repeat: Infinity, times: [0, 0.9, 0.95, 1] }}
                />
                {/* Pupils Highlight */}
                <circle cx="69" cy="71" r="2.5" fill="#ffffff" />
                <circle cx="115" cy="71" r="2.5" fill="#ffffff" />
              </g>
            )}

            {/* ========================================================== */}
            {/* 4. DIGITAL SOUNDWAVE / MOUTH VISUALIZER */}
            {/* ========================================================== */}
            {isSpeaking || internalMood === 'teaching' ? (
              /* Dynamic Audio Wave Bars */
              <g filter="url(#robotNeonFilter)">
                <motion.line
                  x1="74"
                  y1="94"
                  x2="74"
                  y2="98"
                  stroke={moodColors.secondary}
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  animate={{ y1: [94, 91, 94], y2: [98, 101, 98] }}
                  transition={{ duration: 0.35, repeat: Infinity }}
                />
                <motion.line
                  x1="82"
                  y1="92"
                  x2="82"
                  y2="100"
                  stroke={moodColors.primary}
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  animate={{ y1: [92, 88, 92], y2: [100, 103, 100] }}
                  transition={{ duration: 0.28, repeat: Infinity }}
                />
                <motion.line
                  x1="90"
                  y1="91"
                  x2="90"
                  y2="101"
                  stroke="#ffffff"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  animate={{ y1: [91, 87, 91], y2: [101, 104, 101] }}
                  transition={{ duration: 0.22, repeat: Infinity }}
                />
                <motion.line
                  x1="98"
                  y1="92"
                  x2="98"
                  y2="100"
                  stroke={moodColors.primary}
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  animate={{ y1: [92, 89, 92], y2: [100, 103, 100] }}
                  transition={{ duration: 0.3, repeat: Infinity }}
                />
                <motion.line
                  x1="106"
                  y1="94"
                  x2="106"
                  y2="98"
                  stroke={moodColors.secondary}
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  animate={{ y1: [94, 92, 94], y2: [98, 100, 98] }}
                  transition={{ duration: 0.38, repeat: Infinity }}
                />
              </g>
            ) : internalMood === 'happy' ? (
              /* Smiling mouth line */
              <path
                d="M 80 94 Q 90 102 100 94"
                stroke={moodColors.primary}
                strokeWidth="2.5"
                strokeLinecap="round"
                fill="none"
                filter="url(#robotNeonFilter)"
              />
            ) : (
              /* Subtle neutral neon LED bar */
              <line
                x1="84"
                y1="95"
                x2="96"
                y2="95"
                stroke={moodColors.primary}
                strokeWidth="2"
                strokeLinecap="round"
                opacity="0.6"
              />
            )}
          </g>

          {/* ========================================================== */}
          {/* 5. ROBOT BODY & CORE REACTOR */}
          {/* ========================================================== */}
          <g>
            {/* Neck Joint */}
            <rect x="78" y="118" width="24" height="8" rx="3" fill="#334155" />
            <line x1="82" y1="122" x2="98" y2="122" stroke="#64748b" strokeWidth="2" />

            {/* Torso Chassis */}
            <path
              d="M 52 126 L 128 126 L 118 168 L 62 168 Z"
              fill="url(#robotBodyGrad)"
              stroke="#475569"
              strokeWidth="2"
            />

            {/* Core Reactor / Battery Matrix */}
            <circle cx="90" cy="146" r="10" fill="#090d16" stroke="#334155" strokeWidth="1.5" />
            <motion.circle
              cx="90"
              cy="146"
              r="6.5"
              fill={moodColors.primary}
              filter="url(#robotNeonFilter)"
              animate={{ opacity: [0.7, 1, 0.7] }}
              transition={{ duration: 1.8, repeat: Infinity }}
            />

            {/* Mechanical Left Arm */}
            <g>
              <rect x="36" y="128" width="12" height="24" rx="6" fill="#334155" stroke="#475569" strokeWidth="1.5" />
              <circle cx="42" cy="158" r="5" fill="#475569" />
            </g>

            {/* Mechanical Right Arm */}
            {internalMood === 'happy' ? (
              /* Raised celebrating hand */
              <g>
                <path d="M 132 136 Q 146 118 152 108" stroke="#334155" strokeWidth="8" strokeLinecap="round" fill="none" />
                <circle cx="152" cy="108" r="6" fill={moodColors.primary} filter="url(#robotNeonFilter)" />
              </g>
            ) : (
              /* Resting arm */
              <g>
                <rect x="132" y="128" width="12" height="24" rx="6" fill="#334155" stroke="#475569" strokeWidth="1.5" />
                <circle cx="138" cy="158" r="5" fill="#475569" />
              </g>
            )}

            {/* Floating Thruster Ring / Base */}
            <ellipse cx="90" cy="172" rx="20" ry="5" fill="#1e293b" stroke="#334155" strokeWidth="1.5" />
            <motion.ellipse
              cx="90"
              cy="176"
              rx="12"
              ry="3"
              fill={moodColors.primary}
              filter="url(#robotNeonFilter)"
              animate={{ rx: [10, 14, 10], opacity: [0.6, 0.9, 0.6] }}
              transition={{ duration: 1.0, repeat: Infinity }}
            />
          </g>
        </svg>
      </motion.div>

      {/* Interactive Speech & Audio Toolbar */}
      {speechText && (
        <div className="mt-3 flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900/90 border border-white/10 shadow-lg backdrop-blur-md">
          <button
            type="button"
            onClick={handleToggleSpeech}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold transition-all cursor-pointer ${
              isSpeaking
                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 animate-pulse'
                : 'bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-200 border border-indigo-500/30'
            }`}
          >
            {isSpeaking ? (
              <>
                <VolumeX className="w-3.5 h-3.5" />
                <span>Pause Voice</span>
              </>
            ) : (
              <>
                <Volume2 className="w-3.5 h-3.5 text-indigo-400" />
                <span>Read Lesson Aloud</span>
              </>
            )}
          </button>

          {isSpeaking && (
            <button
              type="button"
              onClick={() => {
                const next = speechRate === 1.0 ? 1.25 : speechRate === 1.25 ? 0.9 : 1.0;
                setSpeechRate(next);
                if (utteranceRef.current) utteranceRef.current.rate = next;
              }}
              className="px-2 py-0.5 rounded-md bg-slate-800 text-[10px] font-mono text-slate-300 hover:text-white"
              title="Change speech rate"
            >
              {speechRate}x
            </button>
          )}
        </div>
      )}
    </div>
  );
};
