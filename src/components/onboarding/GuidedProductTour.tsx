/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * StudentOS — Dynamic Interactive Guided Product Tour
 * Spotlight overlay with anchored tooltips, pedagogical explanations,
 * role-aware stops, and mobile-safe viewport calculations.
 */

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Sparkles, ArrowRight, ArrowLeft, X, CheckCircle2, 
  HelpCircle, ExternalLink, Compass, Shield
} from 'lucide-react';
import { useTranslation } from '../../lib/i18n';
import { soundService } from '../../lib/soundService';
import { UserRole } from '../../types';

export interface TourStop {
  id: string;
  tabId: string;
  targetSelector?: string; // CSS selector for spotlight targeting
  title: string;
  icon: string;
  whatItIsFor: string;
  whatYouCanDo: string;
  howItConnects: string;
  quickActionLabel?: string;
  allowedRoles?: UserRole[];
}

export const ALL_TOUR_STOPS: TourStop[] = [
  {
    id: 'dashboard',
    tabId: 'dashboard',
    targetSelector: '[data-tour="dashboard"], #tab-dashboard',
    title: 'Home Dashboard',
    icon: '🏠',
    whatItIsFor: 'Your daily academic command center and personal progress overview.',
    whatYouCanDo: 'View today’s class schedule, attendance status, upcoming homework deadlines, and current XP streak.',
    howItConnects: 'Helps you organize your morning and stay ahead of every school day with zero missed assignments.',
    quickActionLabel: 'View Dashboard'
  },
  {
    id: 'study_hub',
    tabId: 'study_hub',
    targetSelector: '[data-tour="study_hub"], #tab-study_hub',
    title: 'Study Hub & Tasks',
    icon: '🎯',
    whatItIsFor: 'Structured task manager, syllabus progression, and spaced-repetition flashcards.',
    whatYouCanDo: 'Organize study tasks, review due cards using SM-2 memory intervals, and follow your chapter roadmap.',
    howItConnects: 'Turns overwhelming exam preparation into manageable 10-minute daily practice sessions.',
    quickActionLabel: 'Explore Study Hub'
  },
  {
    id: 'homework',
    tabId: 'homework',
    targetSelector: '[data-tour="homework"], #tab-homework',
    title: 'Homework Portal',
    icon: '📚',
    whatItIsFor: 'Official homework assignments and submissions for your class and section.',
    whatYouCanDo: 'Check assignment details, teacher notes, attached PDF worksheets, and mark tasks as done.',
    howItConnects: 'Keeps your assignments synchronized with your teachers in real time without paper losses.',
    quickActionLabel: 'Check Homework'
  },
  {
    id: 'materials',
    tabId: 'materials',
    targetSelector: '[data-tour="materials"], #tab-materials',
    title: 'Material Hub',
    icon: '📂',
    whatItIsFor: 'Central digital library for official school textbooks, reference documents, and formula sheets.',
    whatYouCanDo: 'Browse resources filtered by subject and grade, read PDFs in the built-in viewer, and save favorites.',
    howItConnects: 'Ensures you always have textbook access anywhere, on both desktop computers and school phones.',
    quickActionLabel: 'Browse Library'
  },
  {
    id: 'ai_teacher',
    tabId: 'ai_teacher',
    targetSelector: '[data-tour="ai_teacher"], #tab-ai_teacher',
    title: 'Byte · AI Robot Tutor',
    icon: '🤖',
    whatItIsFor: 'Your 24/7 personalized academic tutor with natural Hindi and English speech.',
    whatYouCanDo: 'Ask concept questions, request step-by-step worked examples, practice quiz questions, and listen aloud.',
    howItConnects: 'Provides patient, judgment-free explanations whenever you get stuck outside class hours.',
    quickActionLabel: 'Talk with Byte'
  },
  {
    id: 'brain_battle',
    tabId: 'brain_battle',
    targetSelector: '[data-tour="brain_battle"], #tab-brain_battle',
    title: 'Brain Battle Arena',
    icon: '⚔️',
    whatItIsFor: 'Engaging, fast-paced academic quizzes and house championship tournaments.',
    whatYouCanDo: 'Test your knowledge across physics, math, and general knowledge in quick 60-second challenges.',
    howItConnects: 'Reinforces learning through active recall and earns Scholar XP for your house ranking.',
    quickActionLabel: 'Enter Arena'
  },
  {
    id: 'whiteboard',
    tabId: 'whiteboard',
    targetSelector: '[data-tour="whiteboard"], #tab-whiteboard',
    title: 'Smart Whiteboard & Panel',
    icon: '🖊️',
    whatItIsFor: 'Freeform sketching, mathematical derivation canvas, and classroom smartboard mode.',
    whatYouCanDo: 'Draw diagrams, solve geometry proofs, take lecture notes, and export snapshots as images.',
    howItConnects: 'Perfect for visual thinkers and classroom presentations on interactive panels.',
    quickActionLabel: 'Open Canvas'
  },
  {
    id: 'settings',
    tabId: 'settings',
    targetSelector: '[data-tour="settings"], #tab-settings',
    title: 'Themes & Personalization',
    icon: '🎨',
    whatItIsFor: 'Customize StudentOS with Claymorphism, Glassmorphism, and your favorite color accents.',
    whatYouCanDo: 'Switch themes, adjust speaking voices, set workspace security PINs, and update learning goals.',
    howItConnects: 'Gives you complete control over your visual comfort during day and night study sessions.',
    quickActionLabel: 'View Themes'
  }
];

interface GuidedProductTourProps {
  userRole?: UserRole;
  isTestMode?: boolean;
  onNavigateTab?: (tabId: string) => void;
  onComplete: () => void;
  onSkip: () => void;
}

export const GuidedProductTour: React.FC<GuidedProductTourProps> = ({
  userRole = 'student',
  isTestMode = false,
  onNavigateTab,
  onComplete,
  onSkip
}) => {
  const { t } = useTranslation();
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  // Filter tour stops appropriate for user role
  const stops = useMemo(() => {
    return ALL_TOUR_STOPS.filter(stop => {
      if (!stop.allowedRoles) return true;
      return stop.allowedRoles.includes(userRole);
    });
  }, [userRole]);

  const currentStop = stops[currentStepIndex] || stops[0];
  const isLastStep = currentStepIndex === stops.length - 1;

  // Navigate app tab when tour step changes to keep UI contextual
  useEffect(() => {
    if (currentStop && onNavigateTab) {
      onNavigateTab(currentStop.tabId);
    }
  }, [currentStop, onNavigateTab]);

  const handleNext = () => {
    soundService.playButtonClick();
    if (isLastStep) {
      soundService.playFlashcardKnowIt(5);
      onComplete();
    } else {
      setCurrentStepIndex(prev => Math.min(stops.length - 1, prev + 1));
    }
  };

  const handlePrev = () => {
    soundService.playButtonClick();
    setCurrentStepIndex(prev => Math.max(0, prev - 1));
  };

  const handleSkip = () => {
    soundService.playButtonClick();
    onSkip();
  };

  const handleQuickAction = () => {
    soundService.playButtonClick();
    if (onNavigateTab && currentStop) {
      onNavigateTab(currentStop.tabId);
    }
  };

  return (
    <div className="fixed inset-0 z-[250] pointer-events-auto flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
      {/* Test Mode Top Bar Indicator */}
      {isTestMode && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[260] px-4 py-1.5 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs font-mono font-bold flex items-center gap-2 shadow-lg backdrop-blur-md">
          <Shield className="w-3.5 h-3.5 text-amber-400" />
          <span>SUPER ADMIN TOUR PREVIEW (Sandbox Mode • No Student Records Modified)</span>
        </div>
      )}

      {/* Centered Elevated Spotlight Card */}
      <motion.div
        key={currentStop.id}
        initial={{ opacity: 0, y: 16, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -16, scale: 0.96 }}
        transition={{ duration: 0.24, ease: 'easeOut' }}
        className="w-full max-w-lg rounded-3xl bg-slate-900 border border-cyan-500/30 text-white shadow-[0_20px_60px_rgba(6,182,212,0.25)] p-6 sm:p-7 relative overflow-hidden backdrop-blur-xl"
      >
        {/* Top Accent Line */}
        <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-cyan-500 via-indigo-500 to-purple-500" />

        {/* Header: Step counter & Skip Button */}
        <div className="flex items-center justify-between pb-3 mb-4 border-b border-white/10 text-xs">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-cyan-950/80 text-cyan-300 border border-cyan-500/30 font-bold font-mono text-[11px]">
              {t.tourStepCount(currentStepIndex + 1, stops.length)}
            </span>
            <span className="text-slate-400 font-medium">Interactive Guide</span>
          </div>

          <button
            onClick={handleSkip}
            className="text-slate-400 hover:text-white flex items-center gap-1 text-xs px-2 py-1 rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
            title="Skip tour"
          >
            <span>Skip Tour</span>
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Feature Identity */}
        <div className="flex items-center gap-3.5 mb-5">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-indigo-500/20 border border-cyan-500/30 flex items-center justify-center text-3xl shadow-inner shrink-0">
            {currentStop.icon}
          </div>
          <div>
            <h3 className="text-xl font-black text-white tracking-tight">{currentStop.title}</h3>
            <p className="text-xs text-cyan-300 font-medium mt-0.5">{currentStop.whatItIsFor}</p>
          </div>
        </div>

        {/* Pedagogical 3-Point Explanations */}
        <div className="space-y-3 mb-6 bg-slate-950/60 p-4 rounded-2xl border border-white/5 text-xs">
          <div className="flex items-start gap-2.5">
            <span className="w-5 h-5 rounded-md bg-cyan-500/20 text-cyan-400 flex items-center justify-center shrink-0 mt-0.5 font-bold">1</span>
            <div>
              <strong className="text-slate-200 block mb-0.5 font-semibold">{t.whatYouCanDo}</strong>
              <span className="text-slate-400 leading-relaxed">{currentStop.whatYouCanDo}</span>
            </div>
          </div>

          <div className="flex items-start gap-2.5 pt-2 border-t border-white/5">
            <span className="w-5 h-5 rounded-md bg-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0 mt-0.5 font-bold">2</span>
            <div>
              <strong className="text-slate-200 block mb-0.5 font-semibold">{t.howItConnects}</strong>
              <span className="text-slate-400 leading-relaxed">{currentStop.howItConnects}</span>
            </div>
          </div>

          {currentStop.quickActionLabel && (
            <div className="pt-2 border-t border-white/5 flex items-center justify-between">
              <span className="text-slate-400 text-[11px]">Experience it now:</span>
              <button
                onClick={handleQuickAction}
                className="px-2.5 py-1 rounded-lg bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-300 border border-cyan-500/30 font-semibold text-xs flex items-center gap-1 transition-all cursor-pointer"
              >
                <span>{currentStop.quickActionLabel}</span>
                <ExternalLink className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>

        {/* Controls: Prev, Step Dots, Next */}
        <div className="flex items-center justify-between gap-3 pt-2">
          <button
            onClick={handlePrev}
            disabled={currentStepIndex === 0}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
              currentStepIndex === 0
                ? 'opacity-30 cursor-not-allowed text-slate-500 bg-white/5'
                : 'text-slate-300 bg-white/5 hover:bg-white/10 hover:text-white'
            }`}
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>{t.previousStep}</span>
          </button>

          {/* Dots Indicator */}
          <div className="flex items-center gap-1.5">
            {stops.map((s, idx) => (
              <span
                key={s.id}
                className={`transition-all rounded-full ${
                  idx === currentStepIndex
                    ? 'w-5 h-1.5 bg-cyan-400'
                    : 'w-1.5 h-1.5 bg-slate-700'
                }`}
              />
            ))}
          </div>

          <button
            onClick={handleNext}
            className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 shadow-lg shadow-cyan-600/25 flex items-center gap-1.5 transition-all cursor-pointer active:scale-98"
          >
            <span>{isLastStep ? 'Finish Tour' : t.nextStep}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </motion.div>
    </div>
  );
};
