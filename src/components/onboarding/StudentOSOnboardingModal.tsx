/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * StudentOS — First-Time Setup & Personalization Guide
 * Multi-step interactive onboarding experience guided by Byte in 3D:
 * - Step A: Welcome (Non-intrusive introduction with 3D Byte & skip option)
 * - Step B: Language Preference (English / Hindi interface & Byte voice with live preview)
 * - Step C: Learning Preferences (Subjects, explanation style, session length, auto-voice)
 * - Step D: Guided Product Tour Launcher
 * - Step E: Summary & Immediate Launch
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Sparkles, Check, ArrowRight, ArrowLeft, Volume2, Globe, 
  BookOpen, Brain, Zap, Clock, Bell, Compass, CheckCircle2, X 
} from 'lucide-react';
import { Byte3DCanvas } from '../byte/Byte3DCanvas';
import { useTranslation, SupportedLanguage } from '../../lib/i18n';
import { 
  LearningPreferences, 
  DEFAULT_LEARNING_PREFERENCES,
  saveOnboardingState 
} from '../../lib/onboardingService';
import { byteVoiceService } from '../../lib/byteVoiceService';
import { soundService } from '../../lib/soundService';
import { UserProfile } from '../../types';

interface StudentOSOnboardingModalProps {
  currentUser: UserProfile | null;
  isOpen: boolean;
  onClose: () => void;
  onStartTour: () => void;
  isTestMode?: boolean;
}

const AVAILABLE_SUBJECTS = [
  'Mathematics',
  'Physics',
  'Chemistry',
  'Biology',
  'Computer Science',
  'English Language',
  'History & Civics'
];

export const StudentOSOnboardingModal: React.FC<StudentOSOnboardingModalProps> = ({
  currentUser,
  isOpen,
  onClose,
  onStartTour,
  isTestMode = false
}) => {
  const { t, setLanguage, currentLanguage } = useTranslation();

  const [step, setStep] = useState<'welcome' | 'language' | 'preferences' | 'tour' | 'finish'>('welcome');
  const [prefs, setPrefs] = useState<LearningPreferences>({
    ...DEFAULT_LEARNING_PREFERENCES,
    interfaceLanguage: currentLanguage
  });
  const [previewingVoice, setPreviewingVoice] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleNext = () => {
    soundService.playButtonClick();
    if (step === 'welcome') setStep('language');
    else if (step === 'language') setStep('preferences');
    else if (step === 'preferences') setStep('tour');
    else if (step === 'tour') setStep('finish');
    else handleComplete();
  };

  const handleBack = () => {
    soundService.playButtonClick();
    if (step === 'language') setStep('welcome');
    else if (step === 'preferences') setStep('language');
    else if (step === 'tour') setStep('preferences');
    else if (step === 'finish') setStep('tour');
  };

  const handleSkip = async () => {
    soundService.playButtonClick();
    if (!isTestMode && currentUser?.uid) {
      await saveOnboardingState(currentUser.uid, {
        completed: true,
        tourSkipped: true,
        preferences: prefs
      });
    }
    onClose();
  };

  const handleComplete = async () => {
    soundService.playFlashcardKnowIt(5);
    if (!isTestMode && currentUser?.uid) {
      await saveOnboardingState(currentUser.uid, {
        completed: true,
        currentStep: 'finish',
        preferences: prefs,
        completedAt: new Date().toISOString()
      });
    }
    onClose();
  };

  const toggleSubject = (sub: string) => {
    soundService.playButtonClick();
    setPrefs(prev => {
      const exists = prev.targetSubjects.includes(sub);
      const updated = exists
        ? prev.targetSubjects.filter(s => s !== sub)
        : [...prev.targetSubjects, sub];
      return { ...prev, targetSubjects: updated.length > 0 ? updated : [sub] };
    });
  };

  const handlePreviewVoice = async () => {
    setPreviewingVoice(true);
    soundService.playButtonClick();
    const voiceId = prefs.speakingLanguage === 'hi'
      ? prefs.hindiVoiceId || 'hi-IN-SwaraNeural'
      : prefs.englishVoiceId || 'en-IN-NeerjaNeural';
    
    await byteVoiceService.previewVoice(voiceId, 1.0);
    setPreviewingVoice(false);
  };

  return (
    <div className="fixed inset-0 z-[240] pointer-events-auto flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-fadeIn">
      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.94, y: 16 }}
        className="w-full max-w-xl rounded-3xl bg-slate-900 border border-cyan-500/30 text-white shadow-[0_24px_70px_rgba(6,182,212,0.22)] p-6 sm:p-8 relative overflow-hidden backdrop-blur-2xl"
      >
        {/* Subtle Ambient Background Aura */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Top Bar: Progress Dots & Skip */}
        <div className="flex items-center justify-between pb-3 mb-5 border-b border-white/10 text-xs relative z-10">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping" />
            <span className="font-bold text-cyan-300 font-mono text-[11px] uppercase tracking-wider">
              StudentOS · Setup Guide
            </span>
          </div>

          <button
            onClick={handleSkip}
            className="text-slate-400 hover:text-white px-2.5 py-1 rounded-lg hover:bg-white/5 transition-colors text-xs font-semibold cursor-pointer"
          >
            {t.skipSetup}
          </button>
        </div>

        {/* STEP CONTENT CONTAINER */}
        <div className="relative z-10 min-h-[300px] flex flex-col justify-center">
          <AnimatePresence mode="wait">
            {/* =========================================================
                STEP A: WELCOME
            ========================================================== */}
            {step === 'welcome' && (
              <motion.div
                key="welcome"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="text-center py-2 space-y-4"
              >
                <div className="w-28 h-28 mx-auto flex items-center justify-center relative">
                  <div className="absolute inset-0 rounded-full bg-cyan-500/20 blur-xl" />
                  <Byte3DCanvas size={110} mood="celebration" interactiveGaze={true} />
                </div>

                <div className="space-y-1.5">
                  <h2 className="text-2xl font-black text-white tracking-tight">{t.welcomeTitle}</h2>
                  <p className="text-xs sm:text-sm text-slate-300 max-w-md mx-auto leading-relaxed">
                    {t.welcomeSubtitle}
                  </p>
                </div>

                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-cyan-950/60 border border-cyan-500/30 text-cyan-300 text-xs font-mono">
                  <Clock className="w-3.5 h-3.5 text-cyan-400" />
                  <span>{t.setupTimeEstimate}</span>
                </div>
              </motion.div>
            )}

            {/* =========================================================
                STEP B: LANGUAGE PREFERENCE
            ========================================================== */}
            {step === 'language' && (
              <motion.div
                key="language"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-5 py-1"
              >
                <div>
                  <h3 className="text-xl font-black text-white tracking-tight">{t.languageSelectTitle}</h3>
                  <p className="text-xs text-slate-400 mt-1">{t.languageSelectDesc}</p>
                </div>

                {/* Interface Language Options */}
                <div className="space-y-2">
                  <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider">
                    {t.interfaceLanguageLabel}
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setLanguage('en');
                        setPrefs(p => ({ ...p, interfaceLanguage: 'en' }));
                      }}
                      className={`p-3.5 rounded-2xl border text-left flex items-center justify-between transition-all cursor-pointer ${
                        prefs.interfaceLanguage === 'en'
                          ? 'bg-cyan-500/15 border-cyan-400 text-white shadow-md shadow-cyan-500/10'
                          : 'bg-slate-950/60 border-white/10 text-slate-300 hover:border-white/20'
                      }`}
                    >
                      <div>
                        <span className="block font-bold text-sm">English</span>
                        <span className="block text-[11px] text-slate-400">Default interface</span>
                      </div>
                      {prefs.interfaceLanguage === 'en' && <Check className="w-4 h-4 text-cyan-400" />}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setLanguage('hi');
                        setPrefs(p => ({ ...p, interfaceLanguage: 'hi' }));
                      }}
                      className={`p-3.5 rounded-2xl border text-left flex items-center justify-between transition-all cursor-pointer ${
                        prefs.interfaceLanguage === 'hi'
                          ? 'bg-cyan-500/15 border-cyan-400 text-white shadow-md shadow-cyan-500/10'
                          : 'bg-slate-950/60 border-white/10 text-slate-300 hover:border-white/20'
                      }`}
                    >
                      <div>
                        <span className="block font-bold text-sm">हिन्दी (Hindi)</span>
                        <span className="block text-[11px] text-slate-400">भारतीय भाषा इंटरफ़ेस</span>
                      </div>
                      {prefs.interfaceLanguage === 'hi' && <Check className="w-4 h-4 text-cyan-400" />}
                    </button>
                  </div>
                </div>

                {/* Byte Speaking Voice Selection */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider">
                      {t.byteVoiceLanguageLabel}
                    </label>
                    <button
                      type="button"
                      onClick={handlePreviewVoice}
                      disabled={previewingVoice}
                      className="text-cyan-400 hover:text-cyan-300 text-xs font-semibold flex items-center gap-1 cursor-pointer"
                    >
                      <Volume2 className="w-3.5 h-3.5" />
                      <span>{previewingVoice ? 'Speaking...' : 'Listen Sample'}</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: 'mixed', label: 'Mixed (Hinglish)', desc: 'Hindi & English naturally' },
                      { id: 'en', label: 'Indian English', desc: 'Neerja & Prabhat' },
                      { id: 'hi', label: 'Pure Hindi', desc: 'Swara & Madhur' }
                    ].map(opt => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setPrefs(p => ({ ...p, speakingLanguage: opt.id as any }))}
                        className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                          prefs.speakingLanguage === opt.id
                            ? 'bg-indigo-600/20 border-indigo-400 text-white shadow-sm'
                            : 'bg-slate-950/50 border-white/5 text-slate-400 hover:border-white/15'
                        }`}
                      >
                        <span className="block text-xs font-bold">{opt.label}</span>
                        <span className="block text-[10px] text-slate-400 mt-0.5">{opt.desc}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}

            {/* =========================================================
                STEP C: LEARNING PREFERENCES
            ========================================================== */}
            {step === 'preferences' && (
              <motion.div
                key="preferences"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-4 py-1"
              >
                <div>
                  <h3 className="text-xl font-black text-white tracking-tight">{t.learningPrefsTitle}</h3>
                  <p className="text-xs text-slate-400 mt-0.5">{t.learningPrefsDesc}</p>
                </div>

                {/* Target Subjects Selection */}
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider">
                    {t.targetSubjectsLabel}
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {AVAILABLE_SUBJECTS.map(sub => {
                      const selected = prefs.targetSubjects.includes(sub);
                      return (
                        <button
                          key={sub}
                          type="button"
                          onClick={() => toggleSubject(sub)}
                          className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                            selected
                              ? 'bg-cyan-500 text-slate-950 font-bold shadow-sm shadow-cyan-500/25'
                              : 'bg-slate-950 border border-white/10 text-slate-300 hover:border-white/20'
                          }`}
                        >
                          {selected ? `✓ ${sub}` : `+ ${sub}`}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Preferred Explanation Style */}
                <div className="space-y-1.5 pt-1">
                  <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider">
                    {t.explanationStyleLabel}
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { id: 'step_by_step', label: 'Step-by-Step Logic', icon: '🔢' },
                      { id: 'examples', label: 'Real-World Examples', icon: '🌍' },
                      { id: 'visuals', label: 'Visuals & Diagrams', icon: '📊' },
                      { id: 'practice_questions', label: 'Direct Practice Questions', icon: '⚡' }
                    ].map(style => (
                      <button
                        key={style.id}
                        type="button"
                        onClick={() => setPrefs(p => ({ ...p, explanationStyle: style.id as any }))}
                        className={`p-2 rounded-xl border text-left flex items-center gap-2 transition-all cursor-pointer ${
                          prefs.explanationStyle === style.id
                            ? 'bg-indigo-600/20 border-indigo-400 text-white'
                            : 'bg-slate-950/60 border-white/5 text-slate-400 hover:text-white'
                        }`}
                      >
                        <span className="text-base">{style.icon}</span>
                        <span className="text-xs font-bold">{style.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Toggles: Auto-Voice & Revision Reminders */}
                <div className="grid grid-cols-2 gap-2 pt-1 text-xs">
                  <div className="p-2.5 rounded-xl bg-slate-950/60 border border-white/5 flex items-center justify-between">
                    <div>
                      <span className="font-bold text-white block">Auto-Voice</span>
                      <span className="text-[10px] text-slate-400">Read explanations aloud</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={prefs.autoVoice}
                      onChange={e => setPrefs(p => ({ ...p, autoVoice: e.target.checked }))}
                      className="w-4 h-4 rounded text-cyan-500 focus:ring-0 cursor-pointer"
                    />
                  </div>

                  <div className="p-2.5 rounded-xl bg-slate-950/60 border border-white/5 flex items-center justify-between">
                    <div>
                      <span className="font-bold text-white block">Revision Alerts</span>
                      <span className="text-[10px] text-slate-400">SM-2 memory cues</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={prefs.revisionReminders}
                      onChange={e => setPrefs(p => ({ ...p, revisionReminders: e.target.checked }))}
                      className="w-4 h-4 rounded text-cyan-500 focus:ring-0 cursor-pointer"
                    />
                  </div>
                </div>
              </motion.div>
            )}

            {/* =========================================================
                STEP D: GUIDED TOUR OPTION
            ========================================================== */}
            {step === 'tour' && (
              <motion.div
                key="tour"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="text-center py-4 space-y-5"
              >
                <div className="w-16 h-16 rounded-2xl bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center text-3xl mx-auto shadow-inner">
                  <Compass className="w-8 h-8 text-cyan-400" />
                </div>

                <div className="space-y-1.5">
                  <h3 className="text-xl font-black text-white tracking-tight">{t.guidedTourTitle}</h3>
                  <p className="text-xs text-slate-300 max-w-sm mx-auto leading-relaxed">
                    {t.guidedTourDesc}
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row gap-2 max-w-sm mx-auto pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      onStartTour();
                      onClose();
                    }}
                    className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-cyan-600/20 transition-all cursor-pointer"
                  >
                    <Sparkles className="w-4 h-4 text-cyan-300" />
                    <span>{t.startTourBtn}</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleNext}
                    className="py-3 px-4 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-semibold transition-all cursor-pointer"
                  >
                    <span>{t.skipTourBtn}</span>
                  </button>
                </div>
              </motion.div>
            )}

            {/* =========================================================
                STEP E: FINISH & SUMMARY
            ========================================================== */}
            {step === 'finish' && (
              <motion.div
                key="finish"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="text-center py-2 space-y-4"
              >
                <div className="w-20 h-20 mx-auto flex items-center justify-center relative">
                  <div className="absolute inset-0 rounded-full bg-emerald-500/20 blur-xl" />
                  <Byte3DCanvas size={84} mood="celebration" interactiveGaze={true} />
                </div>

                <div>
                  <h3 className="text-2xl font-black text-white tracking-tight">{t.setupCompleteTitle}</h3>
                  <p className="text-xs text-slate-300 mt-1 max-w-sm mx-auto">
                    {t.setupCompleteDesc}
                  </p>
                </div>

                {/* Preferences Summary Box */}
                <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-white/5 text-left text-xs space-y-1.5 max-w-md mx-auto font-mono">
                  <div className="flex justify-between text-slate-300">
                    <span className="text-slate-500">Language:</span>
                    <span className="font-bold text-cyan-300">{prefs.interfaceLanguage === 'hi' ? 'हिन्दी' : 'English'}</span>
                  </div>
                  <div className="flex justify-between text-slate-300">
                    <span className="text-slate-500">Byte Voice:</span>
                    <span className="font-bold text-indigo-300">{prefs.speakingLanguage.toUpperCase()}</span>
                  </div>
                  <div className="flex justify-between text-slate-300">
                    <span className="text-slate-500">Focus Subjects:</span>
                    <span className="font-bold text-white truncate max-w-[200px]">{prefs.targetSubjects.join(', ')}</span>
                  </div>
                  <div className="flex justify-between text-slate-300">
                    <span className="text-slate-500">Style:</span>
                    <span className="font-bold text-emerald-400 capitalize">{prefs.explanationStyle.replace(/_/g, ' ')}</span>
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    type="button"
                    onClick={handleComplete}
                    className="w-full max-w-md mx-auto py-3 px-5 rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white font-extrabold text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/25 transition-all cursor-pointer active:scale-98"
                  >
                    <span>{t.startLearningBtn}</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* BOTTOM NAVIGATION CONTROLS */}
        {step !== 'welcome' && step !== 'finish' && step !== 'tour' && (
          <div className="flex items-center justify-between pt-5 mt-4 border-t border-white/10 text-xs">
            <button
              type="button"
              onClick={handleBack}
              className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 flex items-center gap-1.5 font-bold transition-all cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>{t.previousStep}</span>
            </button>

            <button
              type="button"
              onClick={handleNext}
              className="px-5 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white flex items-center gap-1.5 font-bold shadow-md shadow-cyan-600/20 transition-all cursor-pointer active:scale-98"
            >
              <span>{t.nextStep}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {step === 'welcome' && (
          <div className="pt-5 mt-4 border-t border-white/10 flex justify-center">
            <button
              type="button"
              onClick={handleNext}
              className="w-full py-3 px-6 rounded-2xl bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-cyan-600/20 transition-all cursor-pointer active:scale-98"
            >
              <span>{t.startSetup}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
};
