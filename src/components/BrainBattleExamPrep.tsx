/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * StudentOS Brain Battle — Official Syllabus-Connected Exam Preparation
 * Integrates official school exam calendars, chapter-scoped practice,
 * timed mock exams, and Study Planner synchronization.
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  BookOpen,
  Calendar,
  Clock,
  Target,
  Trophy,
  ArrowLeft,
  Plus,
  Play,
  CheckCircle2,
  Sparkles,
  Shield,
  Layers,
  Flame,
  AlertCircle
} from 'lucide-react';
import { UserProfile, UserRole } from '../types';
import {
  ExamPreparationPlan,
  OfficialSubjectSyllabus,
  StudentChapterProgress
} from '../types/syllabusTimetable';
import { SyllabusTimetableService } from '../lib/syllabusTimetableService';
import { soundService } from '../lib/soundService';

interface BrainBattleExamPrepProps {
  currentUser: UserProfile;
  effectiveRole: UserRole;
  onStartExamMatch: (params: {
    subject: string;
    chapters: string[];
    isMockExam: boolean;
    questionCount: number;
    difficulty: 'all' | 'easy' | 'medium' | 'hard';
  }) => void;
  onGoBack: () => void;
  showNotification?: (msg: string) => void;
}

export const BrainBattleExamPrep: React.FC<BrainBattleExamPrepProps> = ({
  currentUser,
  effectiveRole,
  onStartExamMatch,
  onGoBack,
  showNotification
}) => {
  const userId = currentUser?.uid || currentUser?.email || 'student_default';
  const schoolId = 'default_school';
  const grade = currentUser?.grade || 'Grade 10';

  const [officialExams, setOfficialExams] = useState<ExamPreparationPlan[]>([]);
  const [personalExams, setPersonalExams] = useState<ExamPreparationPlan[]>([]);
  const [syllabuses, setSyllabuses] = useState<OfficialSubjectSyllabus[]>([]);
  const [studentProgress, setStudentProgress] = useState<Record<string, StudentChapterProgress>>({});
  const [loading, setLoading] = useState<boolean>(true);

  // Active Practice Config State
  const [selectedExam, setSelectedExam] = useState<ExamPreparationPlan | null>(null);
  const [selectedSubject, setSelectedSubject] = useState<string>('Mathematics');
  const [selectedChapterIds, setSelectedChapterIds] = useState<string[]>([]);
  const [isMockExamMode, setIsMockExamMode] = useState<boolean>(false);
  const [questionCount, setQuestionCount] = useState<number>(10);
  const [difficulty, setDifficulty] = useState<'all' | 'easy' | 'medium' | 'hard'>('all');

  // New Personal Exam Modal State
  const [showAddPersonalModal, setShowAddPersonalModal] = useState<boolean>(false);
  const [newExamName, setNewExamName] = useState<string>('');
  const [newExamSubject, setNewExamSubject] = useState<string>('Mathematics');
  const [newExamDate, setNewExamDate] = useState<string>('');
  const [newExamNotes, setNewExamNotes] = useState<string>('');

  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      setLoading(true);
      try {
        const [offEx, persEx, sylList, prog] = await Promise.all([
          SyllabusTimetableService.getOfficialExams(schoolId),
          SyllabusTimetableService.getStudentPersonalExamPlans(userId),
          SyllabusTimetableService.getOfficialSyllabuses(schoolId, grade),
          SyllabusTimetableService.getStudentProgress(userId)
        ]);
        if (isMounted) {
          setOfficialExams(offEx);
          setPersonalExams(persEx);
          setSyllabuses(sylList);
          setStudentProgress(prog);
          if (offEx.length > 0) {
            setSelectedExam(offEx[0]);
            setSelectedSubject(offEx[0].subject);
            setSelectedChapterIds(offEx[0].chaptersIncluded || []);
          }
        }
      } catch (err) {
        console.warn('[ExamPrep] Load warning:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    loadData();
    return () => {
      isMounted = false;
    };
  }, [userId, schoolId, grade]);

  // Handle Exam Selection
  const handleSelectExam = (exam: ExamPreparationPlan) => {
    setSelectedExam(exam);
    setSelectedSubject(exam.subject);
    setSelectedChapterIds(exam.chaptersIncluded || []);
    soundService.playButtonClick();
  };

  // Toggle chapter selection
  const toggleChapterSelection = (chapterId: string) => {
    soundService.playButtonClick();
    setSelectedChapterIds(prev =>
      prev.includes(chapterId)
        ? prev.filter(id => id !== chapterId)
        : [...prev, chapterId]
    );
  };

  // Add revision session to Study Planner
  const handleAddToStudyPlanner = async (exam: ExamPreparationPlan) => {
    soundService.playButtonClick();
    try {
      const today = new Date().toISOString().split('T')[0];
      const newSession = {
        id: `exam_prep_sess_${Date.now()}`,
        userId,
        date: today,
        dayOfWeek: 'Today',
        startTime: '18:00',
        endTime: '19:00',
        durationMinutes: 60,
        subject: exam.subject,
        sessionType: 'exam_prep' as const,
        status: 'pending' as const,
        notes: `Brain Battle revision block for ${exam.examName}. Target date: ${exam.examDate}.`,
        reminderEnabled: true,
        isAiGenerated: false
      };

      const existingSessions = await SyllabusTimetableService.getStudySessions(userId);
      await SyllabusTimetableService.saveStudySessions(userId, [newSession, ...existingSessions]);

      if (showNotification) {
        showNotification(`✓ Revision session for ${exam.subject} added to Study Planner!`);
      }
      soundService.playAppearSound();
    } catch (_) {
      if (showNotification) {
        showNotification('Failed to add session to planner.');
      }
    }
  };

  // Create personal exam plan
  const handleCreatePersonalExam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newExamName.trim() || !newExamDate) {
      if (showNotification) showNotification('Please provide exam title and target date.');
      return;
    }

    const currentSyl = syllabuses.find(s => s.subject.toLowerCase() === newExamSubject.toLowerCase());
    const chapterIds = currentSyl ? currentSyl.chapters.map(c => c.id) : [];

    const plan: ExamPreparationPlan = {
      id: `personal_exam_${Date.now()}`,
      schoolId,
      userId,
      examName: newExamName.trim(),
      subject: newExamSubject,
      examDate: newExamDate,
      isOfficialSchoolExam: false,
      grade,
      chaptersIncluded: chapterIds,
      syllabusNotes: newExamNotes.trim() || 'Personal student revision target.',
      targetScorePercent: 90,
      mockExamsAttempted: 0,
      averageAccuracy: 0,
      totalQuestionsPracticed: 0,
      status: 'upcoming'
    };

    await SyllabusTimetableService.saveStudentPersonalExamPlan(userId, plan);
    setPersonalExams(prev => [plan, ...prev]);
    setSelectedExam(plan);
    setSelectedSubject(plan.subject);
    setSelectedChapterIds(plan.chaptersIncluded);
    setShowAddPersonalModal(false);
    setNewExamName('');
    setNewExamDate('');
    setNewExamNotes('');

    if (showNotification) {
      showNotification('✓ Personal exam target created and scoped to syllabus!');
    }
    soundService.playLevelUp();
  };

  // Launch practice match
  const handleLaunchPractice = () => {
    soundService.playButtonClick();
    onStartExamMatch({
      subject: selectedSubject,
      chapters: selectedChapterIds,
      isMockExam: isMockExamMode,
      questionCount,
      difficulty
    });
  };

  const currentSyllabus = syllabuses.find(
    s => s.subject.toLowerCase() === selectedSubject.toLowerCase()
  );

  const allExamsList = [...officialExams, ...personalExams];

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onGoBack}
            className="p-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-white/10 text-slate-300 hover:text-white cursor-pointer transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl sm:text-2xl font-black font-display text-white">
                Exam Preparation & Mock Arena
              </h2>
              <span className="px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-[10px] uppercase font-bold tracking-wider">
                Syllabus Connected
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Practice syllabus chapters, sit timed mock examinations, and sync revision goals with your Study Planner
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowAddPersonalModal(true)}
          className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-2 cursor-pointer transition-colors shadow-md"
        >
          <Plus className="w-4 h-4" />
          <span>Add Personal Exam Target</span>
        </button>
      </div>

      {/* Grid: Left = Upcoming Exams Strip & Diagnostics; Right = Chapter Practice Selector */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Exam Cards */}
        <div className="lg:col-span-5 space-y-4">
          <div className="flex items-center justify-between text-xs text-slate-400 px-1">
            <span className="font-extrabold uppercase tracking-wider text-slate-300">
              Exam Milestones ({allExamsList.length})
            </span>
            <span className="text-[11px] font-mono">Real Dates</span>
          </div>

          <div className="space-y-3">
            {allExamsList.map(exam => {
              const isSelected = selectedExam?.id === exam.id;
              const daysLeft = Math.ceil(
                (new Date(exam.examDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
              );

              return (
                <div
                  key={exam.id}
                  onClick={() => handleSelectExam(exam)}
                  className={`p-4 sm:p-5 rounded-2xl border transition-all cursor-pointer relative overflow-hidden ${
                    isSelected
                      ? 'bg-indigo-950/60 border-indigo-500/60 shadow-lg shadow-indigo-500/10'
                      : 'bg-slate-950/70 hover:bg-slate-900 border-white/10'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-bold text-indigo-400">
                          {exam.subject}
                        </span>
                        {exam.isOfficialSchoolExam ? (
                          <span className="text-[9px] px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-extrabold uppercase tracking-wider flex items-center gap-1">
                            <Shield className="w-2.5 h-2.5" /> Official School Exam
                          </span>
                        ) : (
                          <span className="text-[9px] px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 font-bold uppercase tracking-wider">
                            Personal Target Plan
                          </span>
                        )}
                      </div>
                      <h4 className="text-sm font-bold text-white truncate">{exam.examName}</h4>
                    </div>

                    <div className="text-right shrink-0">
                      <span
                        className={`text-xs font-mono font-black px-2.5 py-1 rounded-xl border ${
                          daysLeft <= 7
                            ? 'bg-rose-500/15 text-rose-300 border-rose-500/30 animate-pulse'
                            : 'bg-slate-900 text-slate-300 border-white/10'
                        }`}
                      >
                        {daysLeft <= 0 ? 'Today!' : `${daysLeft}d left`}
                      </span>
                    </div>
                  </div>

                  <p className="text-xs text-slate-400 mt-2 line-clamp-2">{exam.syllabusNotes}</p>

                  <div className="flex items-center justify-between pt-3 mt-3 border-t border-white/10 text-xs text-slate-400">
                    <span className="flex items-center gap-1.5 font-mono">
                      <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                      {exam.examDate}
                    </span>
                    <button
                      type="button"
                      onClick={e => {
                        e.stopPropagation();
                        handleAddToStudyPlanner(exam);
                      }}
                      className="text-indigo-400 hover:text-indigo-300 font-bold hover:underline cursor-pointer flex items-center gap-1"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Add to Study Planner</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Interactive Practice & Mock Exam Configuration */}
        <div className="lg:col-span-7 space-y-4">
          <div className="p-5 sm:p-7 rounded-3xl bg-slate-950/80 border border-white/10 space-y-6 shadow-xl">
            {/* Header info */}
            <div className="space-y-1">
              <span className="text-xs uppercase font-extrabold text-indigo-400 tracking-wider">
                Exam Practice Scope
              </span>
              <h3 className="text-lg sm:text-xl font-black text-white">
                {selectedExam ? selectedExam.examName : `${selectedSubject} Practice`}
              </h3>
              <p className="text-xs text-slate-400">
                Choose syllabus chapters, select difficulty, and challenge your understanding with instant feedback or timed mock simulation.
              </p>
            </div>

            {/* Subject Selector */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-300 block">Focus Subject</label>
              <div className="flex flex-wrap gap-2">
                {syllabuses.map(s => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => {
                      setSelectedSubject(s.subject);
                      setSelectedChapterIds(s.chapters.map(c => c.id));
                      soundService.playButtonClick();
                    }}
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      selectedSubject === s.subject
                        ? 'bg-indigo-600 text-white shadow-md'
                        : 'bg-slate-900 border border-white/10 text-slate-400 hover:text-white'
                    }`}
                  >
                    {s.subject}
                  </button>
                ))}
              </div>
            </div>

            {/* Chapter Selection Matrix */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-300">
                <span className="font-bold">Select Chapters to Include</span>
                <button
                  type="button"
                  onClick={() => {
                    if (currentSyllabus) {
                      if (selectedChapterIds.length === currentSyllabus.chapters.length) {
                        setSelectedChapterIds([]);
                      } else {
                        setSelectedChapterIds(currentSyllabus.chapters.map(c => c.id));
                      }
                      soundService.playButtonClick();
                    }
                  }}
                  className="text-indigo-400 hover:underline font-bold text-[11px] cursor-pointer"
                >
                  {currentSyllabus && selectedChapterIds.length === currentSyllabus.chapters.length
                    ? 'Deselect All'
                    : 'Select All Chapters'}
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-56 overflow-y-auto pr-1">
                {currentSyllabus?.chapters.map(ch => {
                  const isChecked = selectedChapterIds.includes(ch.id);
                  const prog = studentProgress[ch.id];
                  const status = prog?.status || 'not_started';

                  return (
                    <div
                      key={ch.id}
                      onClick={() => toggleChapterSelection(ch.id)}
                      className={`p-3 rounded-xl border flex items-center justify-between gap-2.5 text-xs transition-all cursor-pointer ${
                        isChecked
                          ? 'bg-indigo-950/50 border-indigo-500/50 text-white'
                          : 'bg-slate-900/60 border-white/5 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <div className="min-w-0">
                        <p className="font-bold truncate">
                          Ch {ch.chapterNumber}: {ch.title}
                        </p>
                        <p className="text-[10px] text-slate-400 capitalize mt-0.5">
                          {status.replace('_', ' ')} · {ch.weightageMarks} marks
                        </p>
                      </div>
                      <div
                        className={`w-5 h-5 rounded-lg border flex items-center justify-center shrink-0 ${
                          isChecked
                            ? 'bg-indigo-600 border-indigo-500 text-white'
                            : 'border-white/20 text-transparent'
                        }`}
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Mode & Question Settings */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-white/10">
              <div className="space-y-1">
                <label className="text-[11px] uppercase font-bold text-slate-400">Mode</label>
                <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-slate-900 border border-white/10">
                  <button
                    type="button"
                    onClick={() => {
                      setIsMockExamMode(false);
                      soundService.playButtonClick();
                    }}
                    className={`py-1.5 rounded-lg text-xs font-bold transition-all ${
                      !isMockExamMode
                        ? 'bg-indigo-600 text-white'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Practice
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsMockExamMode(true);
                      soundService.playButtonClick();
                    }}
                    className={`py-1.5 rounded-lg text-xs font-bold transition-all ${
                      isMockExamMode
                        ? 'bg-amber-600 text-white'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Mock Exam
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] uppercase font-bold text-slate-400">Questions</label>
                <select
                  value={questionCount}
                  onChange={e => setQuestionCount(Number(e.target.value))}
                  className="w-full text-xs px-3 py-2 rounded-xl bg-slate-900 border border-white/10 text-white font-bold"
                >
                  <option value={5}>5 Questions (Quick)</option>
                  <option value={10}>10 Questions (Standard)</option>
                  <option value={15}>15 Questions (Full Mock)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] uppercase font-bold text-slate-400">Difficulty</label>
                <select
                  value={difficulty}
                  onChange={e => setDifficulty(e.target.value as any)}
                  className="w-full text-xs px-3 py-2 rounded-xl bg-slate-900 border border-white/10 text-white font-bold"
                >
                  <option value="all">Mixed Arena</option>
                  <option value="easy">Foundational (Easy)</option>
                  <option value="medium">Board Level (Medium)</option>
                  <option value="hard">Exemplar (Hard)</option>
                </select>
              </div>
            </div>

            {/* Launch Action */}
            <div className="pt-2">
              <button
                type="button"
                onClick={handleLaunchPractice}
                disabled={selectedChapterIds.length === 0}
                className="w-full py-4 rounded-2xl bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white font-black text-sm uppercase tracking-wider flex items-center justify-center gap-2 shadow-xl shadow-indigo-600/20 active:scale-[0.99] transition-all cursor-pointer disabled:opacity-40"
              >
                <Play className="w-4 h-4 fill-current" />
                <span>
                  {isMockExamMode ? 'Launch Timed Mock Exam' : 'Start Exam Practice Session'}
                </span>
              </button>
              <p className="text-[11px] text-slate-500 text-center mt-2">
                Practice accuracy reflects learning readiness. Answers and score updates are verified server-side.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Modal: Add Personal Exam Target */}
      <AnimatePresence>
        {showAddPersonalModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
            <motion.div
              initial={{ scale: 0.94, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.94, opacity: 0 }}
              className="w-full max-w-md p-6 rounded-3xl bg-slate-900 border border-white/10 space-y-5 shadow-2xl text-left"
            >
              <div className="space-y-1">
                <h3 className="text-lg font-black text-white">Create Personal Exam Target</h3>
                <p className="text-xs text-slate-400">
                  Set a personal examination date or self-study milestone. Stored safely in your account.
                </p>
              </div>

              <form onSubmit={handleCreatePersonalExam} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold text-slate-400">Exam Title</label>
                  <input
                    type="text"
                    value={newExamName}
                    onChange={e => setNewExamName(e.target.value)}
                    placeholder="e.g. Self-Study Board Prep"
                    className="w-full text-xs px-3.5 py-3 rounded-xl bg-slate-950 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-bold text-slate-400">Subject</label>
                    <select
                      value={newExamSubject}
                      onChange={e => setNewExamSubject(e.target.value)}
                      className="w-full text-xs px-3 py-3 rounded-xl bg-slate-950 border border-white/10 text-white"
                    >
                      <option>Mathematics</option>
                      <option>Physics</option>
                      <option>Chemistry</option>
                      <option>Computer Science</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-bold text-slate-400">Target Date</label>
                    <input
                      type="date"
                      value={newExamDate}
                      onChange={e => setNewExamDate(e.target.value)}
                      className="w-full text-xs px-3 py-2.5 rounded-xl bg-slate-950 border border-white/10 text-white"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold text-slate-400">Notes / Objectives</label>
                  <textarea
                    rows={2}
                    value={newExamNotes}
                    onChange={e => setNewExamNotes(e.target.value)}
                    placeholder="e.g. Master high-weightage chapters 1 through 3 before term ends."
                    className="w-full text-xs p-3 rounded-xl bg-slate-950 border border-white/10 text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowAddPersonalModal(false)}
                    className="flex-1 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md"
                  >
                    Save Target
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
