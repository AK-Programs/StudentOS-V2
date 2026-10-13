/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * StudentOS — Structured Chapter Learning Experience
 * Follows Duolingo-inspired lesson breakdown: objectives, topic checklist,
 * authorized notes, quick knowledge check, and completion actions.
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowLeft,
  CheckCircle2,
  BookOpen,
  Sparkles,
  HelpCircle,
  FileText,
  ExternalLink,
  ChevronRight,
  Award,
  Zap,
  Check,
  RotateCcw,
  Clock,
  Compass
} from 'lucide-react';
import {
  OfficialSubjectSyllabus,
  SyllabusChapter,
  StudentChapterProgress,
  ChapterLearningStatus
} from '../../types/syllabusTimetable';
import { MOCK_QUIZZES } from '../../mockData';
import { soundService } from '../../lib/soundService';

interface ChapterLearningScreenProps {
  syllabus: OfficialSubjectSyllabus;
  chapter: SyllabusChapter;
  progress?: StudentChapterProgress;
  onBack: () => void;
  onUpdateStatus: (newStatus: ChapterLearningStatus) => Promise<void>;
  onToggleTopic: (topic: string) => Promise<void>;
  onNextChapter?: (nextChapterId: string) => void;
  onTriggerCelebration: (chapterTitle: string) => void;
}

export const ChapterLearningScreen: React.FC<ChapterLearningScreenProps> = ({
  syllabus,
  chapter,
  progress,
  onBack,
  onUpdateStatus,
  onToggleTopic,
  onNextChapter,
  onTriggerCelebration
}) => {
  const currentStatus = progress?.status || 'not_started';
  const completedTopics = progress?.completedTopics || [];
  const totalTopics = chapter.topics?.length || 0;
  const completedCount = completedTopics.length;
  const progressPercent = totalTopics > 0 ? Math.round((completedCount / totalTopics) * 100) : 0;

  // Active sub-tab inside chapter screen
  const [activeTab, setActiveTab] = useState<'topics' | 'notes' | 'quiz'>('topics');

  // Quick Knowledge Check state (from MOCK_QUIZZES)
  const availableQuizzes = MOCK_QUIZZES[syllabus.subject] || [];
  // Pick deterministic question based on chapter number
  const chNum = typeof chapter.chapterNumber === 'number' ? chapter.chapterNumber : parseInt(String(chapter.chapterNumber)) || 1;
  const selectedQuestion = availableQuizzes.length > 0 ? availableQuizzes[(chNum - 1) % availableQuizzes.length] : null;

  const [selectedQuizOption, setSelectedQuizOption] = useState<number | null>(null);
  const [quizSubmitted, setQuizSubmitted] = useState<boolean>(false);
  const [quizCorrect, setQuizCorrect] = useState<boolean | null>(null);

  // Find next chapter if available
  const currentIndex = syllabus.chapters.findIndex(c => c.id === chapter.id);
  const nextChapter = currentIndex >= 0 && currentIndex < syllabus.chapters.length - 1 ? syllabus.chapters[currentIndex + 1] : null;

  const handleCompleteChapter = async () => {
    soundService.playButtonClick();
    await onUpdateStatus('completed');
    onTriggerCelebration(chapter.title);
  };

  const handleMarkRevised = async () => {
    soundService.playAchievementSound();
    await onUpdateStatus('revised');
  };

  const handleAnswerQuiz = (index: number) => {
    if (quizSubmitted) return;
    soundService.playButtonClick();
    setSelectedQuizOption(index);
    setQuizSubmitted(true);
    const isCorrect = selectedQuestion ? index === selectedQuestion.correctOptionIndex : false;
    setQuizCorrect(isCorrect);
    if (isCorrect) {
      soundService.playLevelUp();
    } else {
      soundService.playAppearSound();
    }
  };

  const resetQuiz = () => {
    setSelectedQuizOption(null);
    setQuizSubmitted(false);
    setQuizCorrect(null);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -15 }}
      transition={{ duration: 0.25 }}
      className="space-y-6 max-w-4xl mx-auto"
    >
      {/* Top Navigation Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-white/10">
        <button
          type="button"
          onClick={() => {
            soundService.playButtonClick();
            onBack();
          }}
          className="inline-flex items-center gap-2 text-xs font-bold text-slate-300 hover:text-white transition-colors cursor-pointer w-fit"
        >
          <ArrowLeft className="w-4 h-4 text-indigo-400" />
          <span>Back to Learning Journey</span>
        </button>

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400 font-mono">
            {syllabus.subject} · Chapter {chapter.chapterNumber} of {syllabus.chapters.length}
          </span>
          <span
            className={`text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-full border ${
              currentStatus === 'completed'
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                : currentStatus === 'revised'
                ? 'bg-purple-500/20 text-purple-300 border-purple-500/40'
                : currentStatus === 'in_progress'
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                : 'bg-slate-800 text-slate-400 border-white/10'
            }`}
          >
            {currentStatus.replace('_', ' ')}
          </span>
        </div>
      </div>

      {/* Chapter Hero Card */}
      <div className="p-6 sm:p-8 rounded-3xl bg-gradient-to-br from-indigo-950/60 via-slate-900 to-slate-950 border border-indigo-500/30 shadow-xl relative overflow-hidden">
        {/* Subtle accent glow */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative space-y-4">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="px-3 py-1 rounded-xl bg-indigo-600/30 border border-indigo-500/40 text-xs font-extrabold font-mono text-indigo-300">
              Chapter {chapter.chapterNumber}
            </span>
            <span className="text-[11px] font-bold text-slate-400">
              Exam Relevance: <strong className="text-amber-400 uppercase">{chapter.examRelevance}</strong>
            </span>
            {chapter.weightageMarks && (
              <span className="text-[11px] font-mono text-indigo-400">
                · {chapter.weightageMarks} Marks
              </span>
            )}
            {chapter.expectedCompletionDate && (
              <span className="text-[11px] text-slate-400 flex items-center gap-1">
                <Clock className="w-3 h-3 text-slate-500" />
                Target: {chapter.expectedCompletionDate}
              </span>
            )}
          </div>

          <h2 className="text-2xl sm:text-3xl font-black text-white font-display">
            {chapter.title}
          </h2>

          {chapter.description ? (
            <p className="text-sm text-slate-300 leading-relaxed max-w-2xl">
              {chapter.description}
            </p>
          ) : (
            <p className="text-xs text-slate-400 leading-relaxed max-w-2xl">
              Official curriculum topic series approved by school department head. Complete each topic checklist item to reinforce your understanding.
            </p>
          )}

          {/* Chapter Progress Bar */}
          <div className="pt-2 max-w-md space-y-1.5">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-slate-400">Topics Mastered</span>
              <span className="font-bold text-indigo-300">
                {completedCount}/{totalTopics} ({progressPercent}%)
              </span>
            </div>
            <div className="w-full h-2.5 bg-slate-950 rounded-full overflow-hidden border border-white/10">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${progressPercent}%` }}
                transition={{ duration: 0.6, ease: 'easeOut' }}
                className="h-full bg-gradient-to-r from-indigo-500 to-emerald-400 rounded-full"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Tab Switcher - Segmented control */}
      <div className="flex items-center gap-2 p-1.5 rounded-2xl bg-slate-950 border border-white/10 w-fit">
        <button
          type="button"
          onClick={() => {
            soundService.playButtonClick();
            setActiveTab('topics');
          }}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'topics'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Compass className="w-3.5 h-3.5" />
          <span>Topic Learning Path ({totalTopics})</span>
        </button>

        <button
          type="button"
          onClick={() => {
            soundService.playButtonClick();
            setActiveTab('notes');
          }}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'notes'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <BookOpen className="w-3.5 h-3.5" />
          <span>Curriculum Notes & Resources</span>
        </button>

        {selectedQuestion && (
          <button
            type="button"
            onClick={() => {
              soundService.playButtonClick();
              setActiveTab('quiz');
            }}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'quiz'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            <span>Knowledge Check</span>
          </button>
        )}
      </div>

      {/* TAB CONTENT 1: TOPICS CHECKLIST */}
      {activeTab === 'topics' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
              <span>Chapter Syllabus Topics</span>
              <span className="text-xs font-mono text-slate-400 font-normal">
                (Click to toggle mastery)
              </span>
            </h3>
            <span className="text-xs text-indigo-400 font-mono font-bold">
              {completedCount} of {totalTopics} completed
            </span>
          </div>

          {chapter.topics && chapter.topics.length > 0 ? (
            <div className="space-y-2.5">
              {chapter.topics.map((topic, idx) => {
                const isDone = completedTopics.includes(topic);
                return (
                  <motion.div
                    key={idx}
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                    onClick={() => {
                      soundService.playButtonClick();
                      onToggleTopic(topic);
                    }}
                    className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                      isDone
                        ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-200 shadow-sm'
                        : 'bg-slate-950/70 hover:bg-slate-900 border-white/10 text-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-3.5">
                      <div
                        className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold transition-all ${
                          isDone
                            ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/30'
                            : 'bg-slate-900 border border-white/15 text-slate-400'
                        }`}
                      >
                        {isDone ? <Check className="w-3.5 h-3.5 stroke-[3]" /> : idx + 1}
                      </div>
                      <span className={`text-sm font-semibold ${isDone ? 'line-through text-slate-400' : 'text-white'}`}>
                        {topic}
                      </span>
                    </div>

                    <span className={`text-[11px] font-mono ${isDone ? 'text-emerald-400 font-bold' : 'text-slate-500'}`}>
                      {isDone ? 'Mastered' : 'Pending'}
                    </span>
                  </motion.div>
                );
              })}
            </div>
          ) : (
            <div className="p-8 rounded-2xl bg-slate-950 border border-white/10 text-center space-y-2">
              <FileText className="w-8 h-8 text-slate-500 mx-auto" />
              <p className="text-sm font-bold text-slate-300">No individual topics listed</p>
              <p className="text-xs text-slate-500">
                This chapter covers overall core material. Review curriculum notes below.
              </p>
            </div>
          )}
        </div>
      )}

      {/* TAB CONTENT 2: CURRICULUM NOTES & RESOURCES */}
      {activeTab === 'notes' && (
        <div className="space-y-4">
          <div className="p-6 rounded-2xl bg-slate-950/80 border border-white/10 space-y-3">
            <h4 className="text-sm font-bold text-white flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-indigo-400" />
              <span>Official Department Study Notes</span>
            </h4>
            {chapter.syllabusNotes ? (
              <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-line p-4 rounded-xl bg-white/[0.02] border border-white/5">
                {chapter.syllabusNotes}
              </p>
            ) : (
              <p className="text-xs text-slate-500 italic p-4 rounded-xl bg-white/[0.02] border border-white/5">
                No extra teacher notes attached for this chapter yet. Refer to your standard curriculum textbook.
              </p>
            )}
          </div>

          {/* Authorized Resources */}
          {chapter.authorizedResources && chapter.authorizedResources.length > 0 && (
            <div className="p-6 rounded-2xl bg-slate-950/80 border border-white/10 space-y-3">
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <FileText className="w-4 h-4 text-indigo-400" />
                <span>Authorized Learning Resources</span>
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {chapter.authorizedResources.map((res, i) => (
                  <div
                    key={i}
                    className="p-3.5 rounded-xl bg-slate-900 border border-white/10 flex items-center justify-between gap-3"
                  >
                    <div className="space-y-0.5 truncate">
                      <span className="text-[10px] uppercase font-bold text-indigo-400 block">
                        {res.type}
                      </span>
                      <span className="text-xs font-semibold text-white truncate block">
                        {res.title}
                      </span>
                    </div>
                    {res.url && (
                      <a
                        href={res.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB CONTENT 3: KNOWLEDGE CHECK (Quiz from MOCK_QUIZZES) */}
      {activeTab === 'quiz' && selectedQuestion && (
        <div className="p-6 sm:p-8 rounded-3xl bg-slate-950 border border-indigo-500/30 space-y-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-bold text-indigo-400 flex items-center gap-1.5">
              <HelpCircle className="w-3.5 h-3.5" />
              Quick Knowledge Check
            </span>
            <span className="text-[11px] uppercase font-extrabold px-2 py-0.5 rounded-full bg-slate-900 border border-white/10 text-slate-400">
              Curriculum Check
            </span>
          </div>

          <h3 className="text-base sm:text-lg font-bold text-white leading-snug">
            {selectedQuestion.question}
          </h3>

          {/* Options */}
          <div className="space-y-2.5">
            {selectedQuestion.options.map((opt, optIdx) => {
              const isSelected = selectedQuizOption === optIdx;
              const isCorrectOption = optIdx === selectedQuestion.correctOptionIndex;

              let btnStyle = 'bg-slate-900 border-white/10 text-slate-200 hover:bg-slate-800';
              if (quizSubmitted) {
                if (isCorrectOption) {
                  btnStyle = 'bg-emerald-950 border-emerald-500 text-emerald-200 ring-1 ring-emerald-500';
                } else if (isSelected && !isCorrectOption) {
                  btnStyle = 'bg-rose-950 border-rose-500 text-rose-200 ring-1 ring-rose-500';
                }
              }

              return (
                <button
                  key={optIdx}
                  type="button"
                  disabled={quizSubmitted}
                  onClick={() => handleAnswerQuiz(optIdx)}
                  className={`w-full p-4 rounded-2xl border text-left text-sm font-medium transition-all flex items-center justify-between gap-3 cursor-pointer ${btnStyle}`}
                >
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-lg bg-black/40 border border-white/10 flex items-center justify-center text-xs font-bold font-mono">
                      {String.fromCharCode(65 + optIdx)}
                    </span>
                    <span>{opt}</span>
                  </div>

                  {quizSubmitted && isCorrectOption && (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Feedback & Explanation */}
          {quizSubmitted && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`p-4 rounded-2xl border text-xs space-y-1.5 ${
                quizCorrect
                  ? 'bg-emerald-950/50 border-emerald-500/40 text-emerald-200'
                  : 'bg-rose-950/50 border-rose-500/40 text-rose-200'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-bold font-mono text-sm">
                  {quizCorrect ? '🎉 Correct Answer!' : '❌ Not quite right'}
                </span>
                <button
                  type="button"
                  onClick={resetQuiz}
                  className="inline-flex items-center gap-1 text-[11px] font-bold underline hover:opacity-80 cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                  Try Again
                </button>
              </div>
              {selectedQuestion.explanation && (
                <p className="text-slate-300 leading-relaxed">
                  {selectedQuestion.explanation}
                </p>
              )}
            </motion.div>
          )}
        </div>
      )}

      {/* Bottom Action Footer - UIverse Pushable Buttons */}
      <div className="pt-4 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          {currentStatus !== 'completed' && (
            <button
              type="button"
              onClick={handleCompleteChapter}
              className="py-3 px-6 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 text-slate-950 font-black text-sm transition-all transform active:scale-95 shadow-[0_4px_0_rgb(6,95,70)] hover:brightness-110 flex items-center gap-2 cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Mark Chapter Completed (+50 XP)</span>
            </button>
          )}

          {currentStatus === 'completed' && (
            <button
              type="button"
              onClick={handleMarkRevised}
              className="py-2.5 px-5 rounded-2xl bg-indigo-900/80 hover:bg-indigo-800 text-indigo-200 border border-indigo-500/40 font-bold text-xs transition-all flex items-center gap-2 cursor-pointer"
            >
              <Award className="w-3.5 h-3.5 text-amber-400" />
              <span>Log Revision (+25 XP)</span>
            </button>
          )}
        </div>

        {nextChapter && (
          <button
            type="button"
            onClick={() => {
              soundService.playButtonClick();
              if (onNextChapter) onNextChapter(nextChapter.id);
            }}
            className="py-3 px-6 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs transition-all flex items-center gap-2 cursor-pointer shadow-md"
          >
            <span>Next: Ch {nextChapter.chapterNumber}</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        )}
      </div>
    </motion.div>
  );
};
