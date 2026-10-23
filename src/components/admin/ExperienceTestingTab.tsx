/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * StudentOS — Super Admin Byte Voice, Character & Experience Testing Suite
 * Strictly isolated diagnostic and preview console for Super Admins:
 * 1. Onboarding Preview (Step through 5-step flow without mutating real student profiles)
 * 2. Byte Voice Laboratory (Microsoft Edge TTS neural voices, math/science/Hinglish test phrases, speed controls, latency/cache stats)
 * 3. Byte Character Preview (All 12 states, Claymorphism / Glassmorphism shaders, mouth visualizer, arm gestures)
 * 4. Learning Retention Sandbox (Streak calculation, daily mission completions, nudge previews, safe sandbox mode)
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Sparkles, Play, Square, RotateCcw, Volume2, VolumeX, Shield, 
  Layers, CheckCircle2, AlertTriangle, Eye, FlaskConical, Sliders, 
  Bot, Clock, Flame, Zap, ArrowRight, RefreshCw, Cpu, Award, BookOpen
} from 'lucide-react';
import { Byte3DCanvas, Byte3DState, Byte3DMood } from '../byte/Byte3DCanvas';
import { byteVoiceService, EdgeVoiceOption } from '../../lib/byteVoiceService';
import { soundService } from '../../lib/soundService';
import { UserProfile, UserRole } from '../../types';
import { StudentOSOnboardingModal } from '../onboarding/StudentOSOnboardingModal';
import { GuidedProductTour } from '../onboarding/GuidedProductTour';
import { 
  DailyMission, 
  getDailyMissions, 
  recordMissionProgress, 
  claimMissionReward,
  calculateSoftenedStreak,
  StreakState,
  getSmartRevisionQueue
} from '../../lib/learningRetentionService';

interface ExperienceTestingTabProps {
  currentUser: UserProfile;
  showNotification: (msg: string) => void;
}

const TEST_PHRASES = [
  {
    id: 'greeting',
    label: 'Warm Academic Greeting',
    category: 'General',
    text: 'Good morning! Welcome back to StudentOS. I am Byte, your study partner for today.'
  },
  {
    id: 'math_formula',
    label: 'Math Equation & Formula',
    category: 'Mathematics',
    text: 'Let us solve $x^2 + 5x + 6 = 0$. Using the quadratic formula, $x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}$, the roots are $-2$ and $-3$.'
  },
  {
    id: 'science_equation',
    label: 'Science & Chemistry Reaction',
    category: 'Science',
    text: 'In photosynthesis, $6CO_2 + 6H_2O \\to C_6H_{12}O_6 + 6O_2$. Carbon dioxide and water transform into glucose and oxygen.'
  },
  {
    id: 'hinglish_concept',
    label: 'Mixed Hindi-English (Hinglish)',
    category: 'Bilingual',
    text: 'Namaste! Aaj hum Physics ka chapter cover karenge. Focus on Newton’s second law, jisme force equals mass into acceleration hota hai.'
  },
  {
    id: 'encouragement',
    label: 'Encouraging Response',
    category: 'Pedagogy',
    text: 'Brilliant thinking! You spotted the trick in this problem. Let us take on the next challenge together.'
  },
  {
    id: 'error_correction',
    label: 'Constructive Correction',
    category: 'Pedagogy',
    text: 'Good try! You missed a sign change in step two. Remember that a negative times a negative produces a positive.'
  }
];

const ALL_12_STATES: { state: Byte3DState; label: string; description: string }[] = [
  { state: 'idle', label: 'Idle', description: 'Gentle breathing bob and intermittent eye blinks' },
  { state: 'listening', label: 'Listening', description: 'Attentive posture, tilted head, glowing visor' },
  { state: 'thinking', label: 'Thinking', description: 'Slow head scan, pulsating arc reactor' },
  { state: 'speaking', label: 'Speaking', description: 'Active visor LED mouth visualizer responding to speech' },
  { state: 'explaining', label: 'Explaining', description: 'Animated hands emphasizing key points' },
  { state: 'encouraging', label: 'Encouraging', description: 'Warm supportive posture with soft eye glow' },
  { state: 'correct_answer', label: 'Correct Answer', description: 'Celebratory nod and bright green visor pulse' },
  { state: 'incorrect_answer', label: 'Incorrect Answer', description: 'Sympathetic head tilt, encouraging posture' },
  { state: 'celebration', label: 'Celebration', description: 'Upward victory arm wave with particle burst' },
  { state: 'confused', label: 'Confused', description: 'Curious double-take, tilted antennae' },
  { state: 'recoverable_error', label: 'Recoverable Error', description: 'Reassuring smile, ready to retry immediately' },
  { state: 'quiet', label: 'Quiet / Asleep', description: 'Dimmed LEDs, low-energy resting posture' }
];

export const ExperienceTestingTab: React.FC<ExperienceTestingTabProps> = ({
  currentUser,
  showNotification
}) => {
  const [activeSubSection, setActiveSubSection] = useState<'voice' | 'character' | 'onboarding' | 'retention'>('voice');

  // --- 1. VOICE LABORATORY STATE ---
  const [availableVoices, setAvailableVoices] = useState<EdgeVoiceOption[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<string>('hi-IN-SwaraNeural');
  const [customText, setCustomText] = useState<string>(TEST_PHRASES[0].text);
  const [speakingSpeed, setSpeakingSpeed] = useState<number>(1.0);
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const [voiceTelemetry, setVoiceTelemetry] = useState<{
    latencyMs: number;
    durationMs?: number;
    cacheHit?: boolean;
    voiceUsed?: string;
  } | null>(null);

  // --- 2. CHARACTER PREVIEW STATE ---
  const [characterState, setCharacterState] = useState<Byte3DState>('idle');
  const [characterMood, setCharacterMood] = useState<Byte3DMood>('idle');
  const [themeStyle, setThemeStyle] = useState<'clay' | 'glass' | 'standard'>('clay');
  const [energyLevel, setEnergyLevel] = useState<number>(1.0);
  const [isSpeakingSimulated, setIsSpeakingSimulated] = useState<boolean>(false);

  // --- 3. ONBOARDING PREVIEW STATE ---
  const [showOnboardingPreview, setShowOnboardingPreview] = useState<boolean>(false);
  const [showTourPreview, setShowTourPreview] = useState<boolean>(false);
  const [simulatedRole, setSimulatedRole] = useState<UserRole>('student');
  const [simulatedGrade, setSimulatedGrade] = useState<string>('Grade 10');

  // --- 4. RETENTION SANDBOX STATE ---
  const [sandboxMissions, setSandboxMissions] = useState<DailyMission[]>(() => getDailyMissions(undefined, true));
  const [sandboxStreak, setSandboxStreak] = useState<StreakState>(() => calculateSoftenedStreak(undefined, true));
  const [sandboxRewardToast, setSandboxRewardToast] = useState<string | null>(null);

  // Load voices on mount
  useEffect(() => {
    byteVoiceService.getAvailableVoices().then(v => {
      setAvailableVoices(v);
      if (v.length > 0 && !v.some(item => item.id === selectedVoice)) {
        setSelectedVoice(v[0].id);
      }
    });
  }, []);

  // Stop audio on unmount
  useEffect(() => {
    return () => {
      byteVoiceService.stop();
    };
  }, []);

  // Voice synthesis preview handler
  const handlePlayVoice = async (textToPlay: string) => {
    byteVoiceService.stop();
    setIsSpeaking(true);
    setCharacterState('speaking');
    const start = performance.now();

    try {
      await byteVoiceService.speak(textToPlay, {
        voiceId: selectedVoice,
        speed: speakingSpeed,
        onStart: () => {
          const latency = Math.round(performance.now() - start);
          setVoiceTelemetry({
            latencyMs: latency,
            voiceUsed: selectedVoice,
            cacheHit: latency < 40
          });
        },
        onEnd: () => {
          setIsSpeaking(false);
          setCharacterState('idle');
        },
        onError: (err) => {
          setIsSpeaking(false);
          setCharacterState('idle');
          showNotification(`Audio playback notification: ${err.message || 'Falling back to web speech'}`);
        }
      });
    } catch (e: any) {
      setIsSpeaking(false);
      setCharacterState('idle');
    }
  };

  const handleStopVoice = () => {
    byteVoiceService.stop();
    setIsSpeaking(false);
    setCharacterState('idle');
  };

  // Retention sandbox simulation actions
  const handleSimulateMissionStep = (category: DailyMission['category']) => {
    soundService.playButtonClick();
    const result = recordMissionProgress(category, 1, undefined, true);
    setSandboxMissions(result.updatedMissions);
    if (result.newlyCompleted) {
      soundService.playFlashcardKnowIt(5);
      setSandboxRewardToast(`🎉 Mission Completed: "${result.newlyCompleted.title}"! (+${result.newlyCompleted.rewardXp} Sandbox XP)`);
      setTimeout(() => setSandboxRewardToast(null), 4000);
    }
  };

  const handleSimulateClaimReward = async (missionId: string) => {
    const result = await claimMissionReward(missionId, null, true);
    if (result.success) {
      setSandboxMissions(prev => prev.map(m => m.id === missionId ? { ...m, claimed: true } : m));
      soundService.playBadgeCelebration();
      showNotification(`✓ Claimed ${result.xpAwarded} Sandbox XP! (Real student balances untouched)`);
    }
  };

  const handleResetSandbox = () => {
    soundService.playButtonClick();
    setSandboxMissions(getDailyMissions(undefined, true));
    setSandboxStreak(calculateSoftenedStreak(undefined, true));
    showNotification('✓ Sandbox environment reset to initial state.');
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Sandbox Banner Indicator */}
      <div className="p-4 bg-gradient-to-r from-amber-500/10 via-purple-500/10 to-indigo-500/10 border border-amber-500/30 rounded-2xl flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400">
            <FlaskConical className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-black text-white">Super Admin Experience & Voice Laboratory</h4>
              <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/30">
                SANDBOX ISOLATED
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Test onboarding flows, neural Edge voices, 12 character states, and retention mechanics without mutating live student records.
            </p>
          </div>
        </div>

        <button
          onClick={handleResetSandbox}
          className="px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-bold border border-white/10 flex items-center gap-1.5 cursor-pointer transition-all"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Reset Sandbox</span>
        </button>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex gap-2 border-b border-white/5 pb-2 overflow-x-auto">
        {[
          { id: 'voice', label: 'Byte Voice Laboratory', icon: Volume2 },
          { id: 'character', label: 'Byte Character & 12 States', icon: Bot },
          { id: 'onboarding', label: 'Onboarding & Product Tour', icon: Sparkles },
          { id: 'retention', label: 'Learning Retention Sandbox', icon: Flame }
        ].map(tab => {
          const Icon = tab.icon;
          const active = activeSubSection === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => {
                soundService.playButtonClick();
                setActiveSubSection(tab.id as any);
              }}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
                active
                  ? 'bg-gradient-to-r from-amber-600 to-indigo-600 text-white shadow-lg shadow-indigo-500/20'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* =========================================================================
          SECTION 1: BYTE VOICE LABORATORY
      ========================================================================= */}
      {activeSubSection === 'voice' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fadeIn">
          {/* Left 2 Cols: Voice Controls & Test Suite */}
          <div className="lg:col-span-2 space-y-5">
            {/* Voice Selector & Speed */}
            <div className="p-5 bg-slate-900/80 border border-white/10 rounded-2xl space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Sliders className="w-4 h-4 text-amber-400" />
                  Neural Voice Configuration
                </span>
                {voiceTelemetry && (
                  <span className="text-[11px] text-emerald-400 font-mono bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20">
                    TTFB: {voiceTelemetry.latencyMs}ms • {voiceTelemetry.cacheHit ? '⚡ Cache Hit' : '🌐 Generated via Edge'}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 block">
                    Active Edge TTS Voice
                  </label>
                  <select
                    value={selectedVoice}
                    onChange={(e) => setSelectedVoice(e.target.value)}
                    className="w-full bg-slate-950 border border-white/15 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-amber-500"
                  >
                    {availableVoices.map(v => (
                      <option key={v.id} value={v.id}>
                        {v.name} ({v.language.toUpperCase()} • {v.gender})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                      Speaking Speed
                    </label>
                    <span className="text-xs font-mono text-amber-400 font-bold">{speakingSpeed.toFixed(2)}x</span>
                  </div>
                  <input
                    type="range"
                    min="0.75"
                    max="1.50"
                    step="0.05"
                    value={speakingSpeed}
                    onChange={(e) => setSpeakingSpeed(parseFloat(e.target.value))}
                    className="w-full accent-amber-500 cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-slate-500 mt-1">
                    <span>0.75x (Calm)</span>
                    <span>1.0x (Normal)</span>
                    <span>1.50x (Brisk)</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Curated Test Phrases */}
            <div className="p-5 bg-slate-900/80 border border-white/10 rounded-2xl space-y-3">
              <span className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
                Standard Diagnostic Phrases
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {TEST_PHRASES.map(item => (
                  <div
                    key={item.id}
                    onClick={() => setCustomText(item.text)}
                    className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${
                      customText === item.text
                        ? 'bg-amber-500/10 border-amber-500/40 text-white'
                        : 'bg-white/5 border-white/5 text-slate-300 hover:bg-white/10 hover:border-white/15'
                    }`}
                  >
                    <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 mb-1">
                      <span>{item.category}</span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handlePlayVoice(item.text);
                        }}
                        className="px-2 py-0.5 rounded bg-amber-500/20 hover:bg-amber-500 text-amber-300 hover:text-black font-bold text-[10px] flex items-center gap-1 cursor-pointer transition-all"
                      >
                        <Play className="w-2.5 h-2.5 fill-current" />
                        <span>Play</span>
                      </button>
                    </div>
                    <p className="text-xs font-semibold text-white">{item.label}</p>
                    <p className="text-[11px] text-slate-400 mt-1 line-clamp-2 italic">"{item.text}"</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Custom Speech Synthesis Input */}
            <div className="p-5 bg-slate-900/80 border border-white/10 rounded-2xl space-y-3">
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
                Freeform Speech Input (Supports Math & Hinglish)
              </label>
              <textarea
                value={customText}
                onChange={(e) => setCustomText(e.target.value)}
                rows={3}
                placeholder="Enter custom Hindi, English, or mathematical equations..."
                className="w-full bg-slate-950 border border-white/15 rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 resize-none font-mono"
              />
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handlePlayVoice(customText)}
                  disabled={isSpeaking || !customText.trim()}
                  className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-black text-xs uppercase tracking-wider flex items-center gap-2 cursor-pointer transition-all shadow-md disabled:opacity-50"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Synthesize & Speak</span>
                </button>
                {isSpeaking && (
                  <button
                    onClick={handleStopVoice}
                    className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs uppercase tracking-wider flex items-center gap-2 cursor-pointer transition-all"
                  >
                    <Square className="w-3.5 h-3.5 fill-current" />
                    <span>Stop</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Right Col: Live Byte Character Responsive Visualizer */}
          <div className="p-5 bg-slate-900/80 border border-white/10 rounded-2xl flex flex-col items-center justify-between text-center space-y-4">
            <div className="w-full text-left">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Live Character Output</span>
              <p className="text-sm font-bold text-white">Byte Speaking State</p>
            </div>

            <div className="w-48 h-56 flex items-center justify-center">
              <Byte3DCanvas
                state={characterState}
                mood={characterMood}
                themeStyle={themeStyle}
                isSpeaking={isSpeaking}
                size="md"
              />
            </div>

            <div className="w-full p-3 bg-slate-950 rounded-xl border border-white/5 text-left space-y-1.5">
              <div className="flex justify-between text-[11px]">
                <span className="text-slate-400">Current State:</span>
                <span className="text-amber-400 font-bold uppercase">{characterState}</span>
              </div>
              <div className="flex justify-between text-[11px]">
                <span className="text-slate-400">LED Mouth Visor:</span>
                <span className={isSpeaking ? 'text-emerald-400 font-bold' : 'text-slate-500'}>
                  {isSpeaking ? '● Pulsing Audio Wave' : '○ Standby Line'}
                </span>
              </div>
              <div className="flex justify-between text-[11px]">
                <span className="text-slate-400">Voice Engine:</span>
                <span className="text-indigo-400 font-bold">Microsoft Edge TTS</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          SECTION 2: BYTE CHARACTER & 12 STATES PREVIEW
      ========================================================================= */}
      {activeSubSection === 'character' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fadeIn">
          {/* Left Col: Interactive 3D Model Viewport */}
          <div className="p-6 bg-slate-900/80 border border-white/10 rounded-2xl flex flex-col items-center justify-between space-y-4">
            <div className="w-full flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">3D Procedural Rig</span>
                <h4 className="text-base font-black text-white">Byte Character Preview</h4>
              </div>
              <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                {themeStyle.toUpperCase()} SHADER
              </span>
            </div>

            <div className="w-64 h-72 flex items-center justify-center">
              <Byte3DCanvas
                state={characterState}
                mood={characterMood}
                themeStyle={themeStyle}
                isSpeaking={isSpeakingSimulated}
                size="lg"
              />
            </div>

            {/* Quick Actions & Shaders */}
            <div className="w-full space-y-3">
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">
                  Material & Shader Mode
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  {(['clay', 'glass', 'standard'] as const).map(style => (
                    <button
                      key={style}
                      onClick={() => setThemeStyle(style)}
                      className={`py-1.5 px-2 rounded-lg text-[11px] font-bold uppercase transition-all cursor-pointer ${
                        themeStyle === style
                          ? 'bg-amber-500 text-black shadow-md'
                          : 'bg-white/5 text-slate-400 hover:text-white'
                      }`}
                    >
                      {style}
                    </button>
                  ))}
                </div>
              </div>

              {/* Mouth & Gesture Simulation */}
              <div className="flex gap-2">
                <button
                  onClick={() => setIsSpeakingSimulated(prev => !prev)}
                  className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    isSpeakingSimulated
                      ? 'bg-emerald-600 text-white'
                      : 'bg-white/5 text-slate-300 hover:bg-white/10 border border-white/10'
                  }`}
                >
                  {isSpeakingSimulated ? 'Stop Mouth Wave' : 'Simulate Mouth LED Wave'}
                </button>
                <button
                  onClick={() => {
                    setCharacterMood('wave');
                    setTimeout(() => setCharacterMood('idle'), 2500);
                  }}
                  className="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-bold border border-white/10 cursor-pointer"
                >
                  Wave Hand
                </button>
                <button
                  onClick={() => {
                    setCharacterMood('nod');
                    setTimeout(() => setCharacterMood('idle'), 2500);
                  }}
                  className="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-bold border border-white/10 cursor-pointer"
                >
                  Nod
                </button>
              </div>
            </div>
          </div>

          {/* Right 2 Cols: 12 States Selector Grid */}
          <div className="lg:col-span-2 p-6 bg-slate-900/80 border border-white/10 rounded-2xl space-y-4">
            <div>
              <h4 className="text-sm font-black text-white">12 Pedagogical Character States</h4>
              <p className="text-xs text-slate-400">
                Click any state below to immediately inspect Byte’s procedural head tilt, facial LED color, antenna rotation, and arm gestures.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {ALL_12_STATES.map(s => {
                const active = characterState === s.state;
                return (
                  <div
                    key={s.state}
                    onClick={() => {
                      soundService.playButtonClick();
                      setCharacterState(s.state);
                    }}
                    className={`p-3.5 rounded-xl border text-left cursor-pointer transition-all ${
                      active
                        ? 'bg-gradient-to-r from-amber-500/20 to-indigo-500/20 border-amber-500 text-white shadow-md'
                        : 'bg-white/5 border-white/5 text-slate-300 hover:bg-white/10 hover:border-white/10'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-black text-white">{s.label}</span>
                      {active && (
                        <span className="text-[10px] font-bold text-amber-400 bg-amber-500/20 px-2 py-0.5 rounded-md">
                          ACTIVE
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400 leading-relaxed">{s.description}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          SECTION 3: ONBOARDING & PRODUCT TOUR PREVIEW
      ========================================================================= */}
      {activeSubSection === 'onboarding' && (
        <div className="space-y-6 animate-fadeIn">
          {/* Controls Bar */}
          <div className="p-5 bg-slate-900/80 border border-white/10 rounded-2xl space-y-4">
            <div>
              <h4 className="text-sm font-black text-white">Role-Aware Onboarding & Tour Simulator</h4>
              <p className="text-xs text-slate-400">
                Preview the interactive first-time setup guide and spotlight tour with arbitrary student roles and classes without touching any real student account.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">
                  Simulated Role
                </label>
                <select
                  value={simulatedRole}
                  onChange={(e) => setSimulatedRole(e.target.value as UserRole)}
                  className="w-full bg-slate-950 border border-white/15 rounded-xl px-3 py-2 text-xs text-white"
                >
                  <option value="student">Student</option>
                  <option value="teacher">Teacher</option>
                  <option value="admin">School Admin / Principal</option>
                  <option value="parent">Parent</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">
                  Simulated Grade
                </label>
                <select
                  value={simulatedGrade}
                  onChange={(e) => setSimulatedGrade(e.target.value)}
                  className="w-full bg-slate-950 border border-white/15 rounded-xl px-3 py-2 text-xs text-white"
                >
                  <option value="Grade 9">Grade 9</option>
                  <option value="Grade 10">Grade 10</option>
                  <option value="Grade 11">Grade 11</option>
                  <option value="Grade 12">Grade 12</option>
                </select>
              </div>

              <div className="flex items-end gap-2">
                <button
                  onClick={() => setShowOnboardingPreview(true)}
                  className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer transition-all shadow-md"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Launch 5-Step Setup</span>
                </button>
                <button
                  onClick={() => setShowTourPreview(true)}
                  className="flex-1 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer transition-all shadow-md"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>Launch Tour</span>
                </button>
              </div>
            </div>
          </div>

          {/* Setup Architecture Breakdown */}
          <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
            {[
              { num: 'A', title: 'Welcome', desc: 'Friendly non-intrusive introduction with 3D Byte character' },
              { num: 'B', title: 'Language', desc: 'Hindi / English interface toggle with live voice sample preview' },
              { num: 'C', title: 'Learning Goals', desc: 'Target subject selection, explanation style, session pace' },
              { num: 'D', title: 'Guided Tour', desc: 'Interactive spotlight through Home, Study, Homework, AI' },
              { num: 'E', title: 'Summary Launch', desc: 'Immediate transition into active learning without delays' }
            ].map(step => (
              <div key={step.num} className="p-4 bg-slate-900/60 border border-white/10 rounded-2xl space-y-1.5">
                <span className="w-6 h-6 rounded-lg bg-indigo-500/20 text-indigo-400 font-bold text-xs flex items-center justify-center">
                  {step.num}
                </span>
                <h5 className="text-xs font-bold text-white">{step.title}</h5>
                <p className="text-[11px] text-slate-400 leading-snug">{step.desc}</p>
              </div>
            ))}
          </div>

          {/* Modal Mounts (Sandbox Test Mode Enabled) */}
          {showOnboardingPreview && (
            <StudentOSOnboardingModal
              currentUser={{
                ...currentUser,
                role: simulatedRole,
                grade: simulatedGrade
              }}
              isOpen={showOnboardingPreview}
              onClose={() => setShowOnboardingPreview(false)}
              onStartTour={() => {
                setShowOnboardingPreview(false);
                setShowTourPreview(true);
              }}
              isTestMode={true}
            />
          )}

          {showTourPreview && (
            <GuidedProductTour
              userRole={simulatedRole}
              isTestMode={true}
              onComplete={() => {
                setShowTourPreview(false);
                showNotification('✓ Onboarding Tour completed (Sandbox mode).');
              }}
              onSkip={() => {
                setShowTourPreview(false);
                showNotification('Onboarding Tour closed.');
              }}
            />
          )}
        </div>
      )}

      {/* =========================================================================
          SECTION 4: LEARNING RETENTION SANDBOX
      ========================================================================= */}
      {activeSubSection === 'retention' && (
        <div className="space-y-6 animate-fadeIn">
          {sandboxRewardToast && (
            <div className="p-3.5 bg-emerald-500/20 border border-emerald-500/40 rounded-xl text-emerald-300 font-bold text-xs flex items-center gap-2 animate-bounce">
              <Sparkles className="w-4 h-4" />
              <span>{sandboxRewardToast}</span>
            </div>
          )}

          {/* Streak Simulation Card */}
          <div className="p-5 bg-slate-900/80 border border-white/10 rounded-2xl space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Flame className="w-5 h-5 text-amber-400 fill-amber-400" />
                <h4 className="text-sm font-black text-white">Softened Streak Mechanics (Duolingo-Style)</h4>
              </div>
              <span className="text-xs text-slate-400 font-mono">
                Streak: <strong className="text-amber-400">{sandboxStreak.currentStreak} Days</strong> • Freezes: <strong className="text-sky-400">{sandboxStreak.freezesRemaining}</strong>
              </span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              When a student misses a single day, StudentOS activates an automatic <strong>Streak Freeze</strong>. The streak is softened rather than wiped out, keeping motivation high and eliminating punishment anxiety.
            </p>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => {
                  setSandboxStreak(prev => ({
                    ...prev,
                    currentStreak: prev.currentStreak + 1,
                    isSoftened: false
                  }));
                  soundService.playStreakFire();
                  showNotification('🔥 Simulated active consecutive day (+1 Streak)');
                }}
                className="px-3 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500 text-amber-300 hover:text-black font-bold text-xs transition-all cursor-pointer"
              >
                +1 Consecutive Day
              </button>
              <button
                onClick={() => {
                  setSandboxStreak(prev => ({
                    ...prev,
                    isSoftened: true,
                    freezesRemaining: Math.max(0, prev.freezesRemaining - 1)
                  }));
                  soundService.playStreakShield();
                  showNotification('🛡️ Simulated 1 missed day (Streak Softened & Preserved)');
                }}
                className="px-3 py-2 rounded-xl bg-sky-500/20 hover:bg-sky-500 text-sky-300 hover:text-black font-bold text-xs transition-all cursor-pointer"
              >
                Simulate Missed Day (Softened Freeze)
              </button>
              <button
                onClick={() => {
                  setSandboxStreak(prev => ({
                    ...prev,
                    currentStreak: 1,
                    isSoftened: false,
                    freezesRemaining: 1
                  }));
                  showNotification('Simulated gentle restart (1 Day)');
                }}
                className="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 font-bold text-xs transition-all cursor-pointer"
              >
                Gentle Restart
              </button>
            </div>
          </div>

          {/* Daily Missions Preview */}
          <div className="p-5 bg-slate-900/80 border border-white/10 rounded-2xl space-y-4">
            <div>
              <h4 className="text-sm font-black text-white">Daily Missions Engine (3 Academic Goals)</h4>
              <p className="text-xs text-slate-400">
                Click "Simulate Progress" to step through missions and claim idempotent Scholar XP rewards.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {sandboxMissions.map(m => (
                <div
                  key={m.id}
                  className={`p-4 rounded-2xl border transition-all space-y-3 ${
                    m.completed
                      ? 'bg-emerald-500/10 border-emerald-500/40'
                      : 'bg-slate-950/80 border-white/10'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-2xl">{m.icon}</span>
                    <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md ${
                      m.completed ? 'bg-emerald-500/20 text-emerald-300' : 'bg-white/10 text-slate-400'
                    }`}>
                      +{m.rewardXp} XP
                    </span>
                  </div>

                  <div>
                    <h5 className="text-xs font-bold text-white">{m.title}</h5>
                    <p className="text-[11px] text-slate-400 leading-snug">{m.description}</p>
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px] font-mono text-slate-400">
                      <span>Progress</span>
                      <span>{m.currentCount} / {m.targetCount}</span>
                    </div>
                    <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-amber-500 to-emerald-500 transition-all duration-300"
                        style={{ width: `${Math.min(100, (m.currentCount / m.targetCount) * 100)}%` }}
                      />
                    </div>
                  </div>

                  <div className="flex gap-2">
                    {!m.completed ? (
                      <button
                        onClick={() => handleSimulateMissionStep(m.category)}
                        className="w-full py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white font-bold text-[11px] transition-all cursor-pointer"
                      >
                        +1 Step
                      </button>
                    ) : !m.claimed ? (
                      <button
                        onClick={() => handleSimulateClaimReward(m.id)}
                        className="w-full py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] transition-all cursor-pointer animate-pulse"
                      >
                        Claim Reward
                      </button>
                    ) : (
                      <span className="w-full py-1.5 rounded-lg bg-emerald-500/20 text-emerald-300 font-bold text-[11px] text-center block">
                        ✓ Claimed
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
