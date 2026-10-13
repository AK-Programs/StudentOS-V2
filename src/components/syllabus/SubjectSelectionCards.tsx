/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * StudentOS — Duolingo-Inspired Subject Selection Grid
 * Sourced Animation Patterns:
 * - UIverse: https://uiverse.io/ (Pushable buttons and subtle rim highlights)
 * - Motion: https://motion.dev/ (Smooth entrance stagger and layout animations)
 * - React Bits: https://reactbits.dev/ (Spotlight glow and smooth progress feedback)
 */

import React from 'react';
import { motion, useReducedMotion } from 'motion/react';
import {
  BookOpen,
  Calculator,
  Zap,
  FlaskConical,
  Dna,
  Laptop,
  Globe,
  Landmark,
  ArrowRight,
  Sparkles,
  CheckCircle2,
  Clock,
  Compass
} from 'lucide-react';
import { SubjectProgressSummary } from '../../types/syllabusTimetable';
import { soundService } from '../../lib/soundService';

interface SubjectSelectionCardsProps {
  summaries: SubjectProgressSummary[];
  onSelectSubject: (subject: string) => void;
  selectedSubject?: string;
}

// Map subject names to recognizable learning icons
function getSubjectIcon(subject: string) {
  const s = subject.toLowerCase();
  if (s.includes('math')) return <Calculator className="w-6 h-6 text-indigo-400" />;
  if (s.includes('phys')) return <Zap className="w-6 h-6 text-amber-400" />;
  if (s.includes('chem')) return <FlaskConical className="w-6 h-6 text-emerald-400" />;
  if (s.includes('bio')) return <Dna className="w-6 h-6 text-rose-400" />;
  if (s.includes('comp') || s.includes('cs') || s.includes('code')) return <Laptop className="w-6 h-6 text-cyan-400" />;
  if (s.includes('geo')) return <Globe className="w-6 h-6 text-blue-400" />;
  if (s.includes('hist')) return <Landmark className="w-6 h-6 text-orange-400" />;
  return <BookOpen className="w-6 h-6 text-purple-400" />;
}

export const SubjectSelectionCards: React.FC<SubjectSelectionCardsProps> = ({
  summaries,
  onSelectSubject
}) => {
  const shouldReduceMotion = useReducedMotion();

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h3 className="text-lg font-black text-white font-display flex items-center gap-2">
            <span>Your Learning Subjects</span>
            <span className="text-xs font-mono font-normal text-indigo-400">
              ({summaries.length} Active Courses)
            </span>
          </h3>
          <p className="text-xs text-slate-400">
            Pick a subject to explore its guided chapter path and track real syllabus mastery.
          </p>
        </div>
      </div>

      {/* Grid of Subject Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {summaries.map((summary, idx) => {
          const completedTotal = summary.completedCount + summary.revisedCount;
          const nextCh = summary.nextRecommendedChapter;

          return (
            <motion.div
              key={summary.subject}
              initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05, duration: 0.3 }}
              whileHover={shouldReduceMotion ? {} : { y: -3, transition: { duration: 0.15 } }}
              onClick={() => {
                soundService.playButtonClick();
                onSelectSubject(summary.subject);
              }}
              className="p-6 rounded-3xl bg-slate-950/80 hover:bg-slate-900/90 border border-white/10 hover:border-indigo-500/40 transition-all shadow-lg hover:shadow-indigo-500/10 cursor-pointer flex flex-col justify-between space-y-5 relative group overflow-hidden"
            >
              {/* Subtle top gradient accent on hover */}
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-emerald-400 opacity-60 group-hover:opacity-100 transition-opacity" />

              <div className="space-y-4">
                {/* Subject Header */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3.5">
                    <div className="w-12 h-12 rounded-2xl bg-slate-900 border border-white/10 flex items-center justify-center shadow-inner group-hover:border-indigo-500/40 group-hover:scale-105 transition-all">
                      {getSubjectIcon(summary.subject)}
                    </div>
                    <div>
                      <h4 className="text-base font-extrabold text-white group-hover:text-indigo-200 transition-colors">
                        {summary.subject}
                      </h4>
                      <span className="text-[11px] font-mono text-slate-400">
                        {summary.grade || 'Standard Curriculum'}
                      </span>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="font-mono text-lg font-black text-indigo-400">
                      {summary.progressPercentage}%
                    </span>
                    <span className="block text-[10px] uppercase font-bold text-slate-500">
                      Mastery
                    </span>
                  </div>
                </div>

                {/* Persisted Real Progress Bar */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
                    <span>
                      {completedTotal} / {summary.totalChapters} Chapters Done
                    </span>
                    {summary.revisedCount > 0 && (
                      <span className="text-emerald-400 font-semibold">
                        {summary.revisedCount} Revised
                      </span>
                    )}
                  </div>
                  <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden border border-white/5">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${summary.progressPercentage}%` }}
                      transition={{ duration: 0.6, ease: 'easeOut' }}
                      className="h-full bg-gradient-to-r from-indigo-500 to-emerald-400 rounded-full"
                    />
                  </div>
                </div>

                {/* Current & Next Activity */}
                <div className="p-3 rounded-2xl bg-white/[0.02] border border-white/5 space-y-1 text-xs">
                  {nextCh ? (
                    <>
                      <div className="flex items-center gap-1.5 text-indigo-400 font-bold text-[11px]">
                        <Compass className="w-3.5 h-3.5 shrink-0" />
                        <span>Recommended Next:</span>
                      </div>
                      <p className="text-slate-200 font-medium truncate">
                        Ch {nextCh.chapterNumber} · {nextCh.title}
                      </p>
                    </>
                  ) : (
                    <div className="flex items-center gap-1.5 text-emerald-400 text-[11px] font-bold">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>All chapters completed! Time for revision.</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Continue Learning Action - UIverse 3D Pushable Button */}
              <div className="pt-2">
                <button
                  type="button"
                  className="w-full py-2.5 px-4 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs transition-all flex items-center justify-center gap-2 group-hover:shadow-[0_4px_0_rgb(67,56,202)] active:translate-y-0.5 cursor-pointer"
                >
                  <span>Continue Learning</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                </button>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};
