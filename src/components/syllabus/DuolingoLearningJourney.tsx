/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * StudentOS — Duolingo-Inspired Syllabus Learning Journey
 * Winding connected chapter nodes with state-aware animations,
 * SVG paths, and interactive lesson launches.
 * 
 * Sourced Animation Patterns:
 * - UIverse: https://uiverse.io/ (3D pushable node buttons & glowing beacons)
 * - Motion: https://motion.dev/ (Animated path drawing & spring physics)
 * - Magic UI: https://magicui.design/ (Shimmer ripple & border aura)
 * - Aceternity UI: https://ui.aceternity.com/ (Glowing stars & ambient particles)
 */

import React, { useMemo } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import {
  ArrowLeft,
  CheckCircle2,
  Crown,
  Lock,
  BookOpen,
  Sparkles,
  Flame,
  Star,
  Award,
  ChevronRight,
  Zap,
  Check,
  Compass
} from 'lucide-react';
import {
  OfficialSubjectSyllabus,
  SyllabusChapter,
  StudentChapterProgress,
  ChapterLearningStatus
} from '../../types/syllabusTimetable';
import { soundService } from '../../lib/soundService';

interface DuolingoLearningJourneyProps {
  syllabus: OfficialSubjectSyllabus;
  studentProgress: Record<string, StudentChapterProgress>;
  onSelectChapter: (chapter: SyllabusChapter) => void;
  onBackToSubjects: () => void;
}

export const DuolingoLearningJourney: React.FC<DuolingoLearningJourneyProps> = ({
  syllabus,
  studentProgress,
  onSelectChapter,
  onBackToSubjects
}) => {
  const shouldReduceMotion = useReducedMotion();

  // Compute overall subject progress
  const chapters = syllabus.chapters || [];
  const totalChapters = chapters.length;

  const { completedCount, revisedCount, progressPercentage, currentChapterId } = useMemo(() => {
    let completed = 0;
    let revised = 0;
    let firstIncompleteId: string | null = null;

    for (const ch of chapters) {
      const p = studentProgress[ch.id];
      if (p?.status === 'completed') completed++;
      else if (p?.status === 'revised') revised++;
      else if (!firstIncompleteId) firstIncompleteId = ch.id;
    }

    const totalDone = completed + revised;
    const pct = totalChapters > 0 ? Math.round((totalDone / totalChapters) * 100) : 0;
    const currentId = firstIncompleteId || (chapters.length > 0 ? chapters[chapters.length - 1].id : '');

    return {
      completedCount: completed,
      revisedCount: revised,
      progressPercentage: pct,
      currentChapterId: currentId
    };
  }, [chapters, studentProgress, totalChapters]);

  // Determine chapter node status
  const getChapterState = (chapter: SyllabusChapter, index: number) => {
    const prog = studentProgress[chapter.id];
    const status = prog?.status || 'not_started';

    // Real prerequisites check: only lock if prerequisite rule exists and is unfinished
    let isLocked = false;
    if (chapter.prerequisites && chapter.prerequisites.length > 0) {
      const prereqsMet = chapter.prerequisites.every(pId => {
        const pProg = studentProgress[pId];
        return pProg?.status === 'completed' || pProg?.status === 'revised';
      });
      if (!prereqsMet) isLocked = true;
    }

    const isCurrent = chapter.id === currentChapterId;

    return {
      status,
      isCurrent,
      isLocked,
      isCompleted: status === 'completed' || status === 'revised'
    };
  };

  // Node horizontal winding offsets: center, left, center, right, center, ...
  const getOffsetClass = (index: number) => {
    const cycle = index % 4;
    switch (cycle) {
      case 0:
        return 'translate-x-0';
      case 1:
        return '-translate-x-6 sm:-translate-x-12';
      case 2:
        return 'translate-x-0';
      case 3:
        return 'translate-x-6 sm:translate-x-12';
      default:
        return 'translate-x-0';
    }
  };

  return (
    <div className="space-y-8 max-w-3xl mx-auto pb-12">
      {/* ==================================================================== */}
      {/* 1. DUOLINGO-INSPIRED LEARNING PATH HEADER */}
      {/* ==================================================================== */}
      <div className="p-6 rounded-3xl bg-slate-950/90 border border-white/10 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <button
            type="button"
            onClick={() => {
              soundService.playButtonClick();
              onBackToSubjects();
            }}
            className="inline-flex items-center gap-2 text-xs font-bold text-slate-300 hover:text-white transition-colors cursor-pointer w-fit"
          >
            <ArrowLeft className="w-4 h-4 text-indigo-400" />
            <span>All Subjects</span>
          </button>

          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-400 font-mono">
              Grade {syllabus.grade || '10'} · {syllabus.board || 'Standard Curriculum'}
            </span>
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-950/80 border border-indigo-500/30 text-indigo-300 text-xs font-bold font-mono">
              <Zap className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
              <span>{completedCount * 50 + revisedCount * 25} XP</span>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2">
          <div className="space-y-1">
            <h2 className="text-2xl sm:text-3xl font-black text-white font-display flex items-center gap-2.5">
              <span>{syllabus.subject}</span>
              <span className="text-xs font-normal text-slate-400 font-mono">
                ({totalChapters} Chapters)
              </span>
            </h2>
            <p className="text-xs text-slate-400">
              Complete each chapter on the winding path to master this official subject syllabus.
            </p>
          </div>

          <div className="text-left sm:text-right shrink-0">
            <div className="font-mono text-2xl font-black text-indigo-400">
              {progressPercentage}%
            </div>
            <div className="text-[11px] font-bold text-slate-400">
              {completedCount + revisedCount} of {totalChapters} Mastered
            </div>
          </div>
        </div>

        {/* Overall Progress Bar */}
        <div className="w-full h-2.5 bg-slate-900 rounded-full overflow-hidden border border-white/5">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${progressPercentage}%` }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
            className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-emerald-400 rounded-full"
          />
        </div>
      </div>

      {/* ==================================================================== */}
      {/* 2. WINDING CHAPTER PATH JOURNEY */}
      {/* ==================================================================== */}
      <div className="relative py-4 flex flex-col items-center">
        {chapters.map((chapter, index) => {
          const { status, isCurrent, isLocked, isCompleted } = getChapterState(chapter, index);
          const prog = studentProgress[chapter.id];
          const completedTopicsCount = prog?.completedTopics?.length || 0;
          const totalTopics = chapter.topics?.length || 0;
          const isLast = index === chapters.length - 1;

          // Determine visual styling for the node
          let nodeBg = 'bg-slate-900 border-white/10 text-slate-400';
          let shadowStyle = '';
          let icon = <Star className="w-7 h-7" />;

          if (isCompleted) {
            nodeBg = 'bg-gradient-to-br from-emerald-500 to-teal-600 text-slate-950 border-emerald-400';
            shadowStyle = 'shadow-[0_6px_0_rgb(6,95,70)]';
            icon = <Check className="w-8 h-8 stroke-[3.5]" />;
          } else if (isCurrent) {
            nodeBg = 'bg-gradient-to-br from-indigo-500 via-purple-600 to-indigo-700 text-white border-indigo-400';
            shadowStyle = 'shadow-[0_6px_0_rgb(67,56,202)]';
            icon = <Crown className="w-8 h-8 text-amber-300 fill-amber-300 animate-pulse" />;
          } else if (status === 'in_progress') {
            nodeBg = 'bg-gradient-to-br from-amber-500 to-orange-600 text-slate-950 border-amber-400';
            shadowStyle = 'shadow-[0_6px_0_rgb(180,83,9)]';
            icon = <Flame className="w-7 h-7 fill-slate-950" />;
          } else if (isLocked) {
            nodeBg = 'bg-slate-900 border-white/5 text-slate-600 opacity-60';
            shadowStyle = 'shadow-[0_4px_0_rgb(30,41,59)]';
            icon = <Lock className="w-6 h-6" />;
          } else {
            // Available
            nodeBg = 'bg-slate-800 hover:bg-slate-700 text-indigo-300 border-indigo-500/30';
            shadowStyle = 'shadow-[0_5px_0_rgb(30,41,59)]';
            icon = <BookOpen className="w-7 h-7" />;
          }

          return (
            <div
              key={chapter.id}
              className={`flex flex-col items-center relative transition-transform ${getOffsetClass(index)}`}
            >
              {/* Connected Connector Line / Beam to Next Node */}
              {!isLast && (
                <div className="w-2 h-16 sm:h-20 bg-slate-800/80 rounded-full my-1 overflow-hidden relative">
                  <div
                    className={`w-full h-full transition-all ${
                      isCompleted
                        ? 'bg-gradient-to-b from-emerald-500 to-slate-800'
                        : isCurrent
                        ? 'bg-gradient-to-b from-indigo-500 to-slate-800'
                        : 'bg-slate-800'
                    }`}
                  />
                </div>
              )}

              {/* Current Active Beacon Glowing Aura (Magic UI Shimmer pattern) */}
              {isCurrent && !shouldReduceMotion && (
                <motion.div
                  initial={{ scale: 0.9, opacity: 0.5 }}
                  animate={{ scale: [1, 1.25, 1], opacity: [0.5, 0.1, 0.5] }}
                  transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
                  className="absolute w-28 h-28 rounded-full bg-indigo-500/30 blur-md pointer-events-none -top-1"
                />
              )}

              {/* "NEXT UP / START HERE" Tooltip Banner */}
              {isCurrent && (
                <motion.div
                  initial={{ y: 5, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  className="mb-2 py-1 px-3 rounded-full bg-gradient-to-r from-amber-400 to-orange-500 text-slate-950 font-black text-[10px] uppercase tracking-wider shadow-lg flex items-center gap-1 z-10"
                >
                  <Sparkles className="w-3 h-3 fill-slate-950" />
                  <span>Start Here</span>
                </motion.div>
              )}

              {/* CHAPTER CIRCULAR NODE BUTTON (UIverse 3D Pushable Pattern) */}
              <motion.button
                type="button"
                whileHover={!isLocked && !shouldReduceMotion ? { scale: 1.06 } : {}}
                whileTap={!isLocked && !shouldReduceMotion ? { scale: 0.94 } : {}}
                disabled={isLocked}
                onClick={() => {
                  soundService.playButtonClick();
                  onSelectChapter(chapter);
                }}
                aria-label={`Open Chapter ${chapter.chapterNumber}: ${chapter.title}`}
                className={`relative w-20 h-20 sm:w-24 sm:h-24 rounded-full border-2 flex items-center justify-center transition-all cursor-pointer ${nodeBg} ${shadowStyle} ${
                  isLocked ? 'cursor-not-allowed' : 'active:translate-y-1'
                } focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-indigo-400`}
              >
                {icon}

                {/* Chapter Number Badge */}
                <span className="absolute -bottom-1 -right-1 px-2 py-0.5 rounded-full bg-slate-950 border border-white/20 text-[10px] font-black font-mono text-white">
                  {chapter.chapterNumber}
                </span>
              </motion.button>

              {/* Chapter Card Pill Information */}
              <div
                onClick={() => {
                  if (!isLocked) {
                    soundService.playButtonClick();
                    onSelectChapter(chapter);
                  }
                }}
                className={`mt-2.5 max-w-xs text-center space-y-0.5 cursor-pointer p-2 rounded-xl transition-all ${
                  isCurrent
                    ? 'bg-indigo-950/40 border border-indigo-500/30'
                    : 'hover:bg-slate-900/60'
                }`}
              >
                <div className="flex items-center justify-center gap-1.5 flex-wrap">
                  <span className="text-xs font-black text-white line-clamp-1">
                    {chapter.title}
                  </span>
                </div>

                <div className="flex items-center justify-center gap-2 text-[10px] text-slate-400 font-mono">
                  <span>{totalTopics} Topics</span>
                  {completedTopicsCount > 0 && (
                    <span className="text-emerald-400 font-bold">
                      · {completedTopicsCount} Done
                    </span>
                  )}
                  {chapter.weightageMarks && (
                    <span className="text-indigo-400">· {chapter.weightageMarks}m</span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
