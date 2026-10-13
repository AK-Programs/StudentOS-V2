/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * StudentOS — Official Syllabus Planner, Chapter Progress & Study Sessions System
 * Complete replacement for legacy manual Study Planner.
 * Backed by Supabase persistence, role-aware syllabus publishing,
 * AI personal study timetable generator (students only), and gamified sessions.
 */

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  BookOpen,
  Calendar,
  Clock,
  CheckCircle2,
  Sparkles,
  Play,
  RotateCcw,
  Plus,
  Flame,
  Award,
  AlertCircle,
  ChevronRight,
  Filter,
  Check,
  Star,
  Shield,
  Layers,
  ArrowRight,
  Trash2,
  Coffee,
  X,
  Zap,
  TrendingUp,
  FileText
} from 'lucide-react';
import { UserProfile, UserRole } from '../types';
import {
  OfficialSubjectSyllabus,
  SyllabusChapter,
  StudentChapterProgress,
  SubjectProgressSummary,
  StudySessionItem,
  StudySessionType,
  ExamPreparationPlan,
  ChapterLearningStatus
} from '../types/syllabusTimetable';
import { SyllabusTimetableService } from '../lib/syllabusTimetableService';
import { OfficialTimetableViewer } from './OfficialTimetableViewer';
import { soundService } from '../lib/soundService';
import { DuolingoLearningJourney } from './syllabus/DuolingoLearningJourney';
import { ChapterLearningScreen } from './syllabus/ChapterLearningScreen';
import { SubjectSelectionCards } from './syllabus/SubjectSelectionCards';
import { LearningCelebration } from './syllabus/LearningCelebration';

interface SyllabusStudyPlannerProps {
  currentUser: UserProfile;
  effectiveRole: UserRole;
  showNotification?: (msg: string) => void;
  onNavigateToTab?: (tab: string) => void;
  legacySchedules?: Array<{ id: string; subject: string; time: string; day: string }>;
}

export const SyllabusStudyPlanner: React.FC<SyllabusStudyPlannerProps> = ({
  currentUser,
  effectiveRole,
  showNotification,
  onNavigateToTab,
  legacySchedules
}) => {
  const userId = currentUser?.uid || currentUser?.email || 'student_default';
  const schoolId = 'default_school';
  const grade = currentUser?.grade || 'Grade 10';
  const userName = currentUser?.name || 'Scholar';

  const isStudent = effectiveRole === 'student';
  const isStaff = ['teacher', 'coordinator', 'admin', 'super_admin'].includes(effectiveRole);

  // Sub-navigation inside Planner
  const [activePlannerTab, setActivePlannerTab] = useState<
    'progress' | 'sessions' | 'ai_timetable' | 'official_timetable'
  >('progress');

  // Duolingo-Inspired Learning Module Sub-States
  const [learningJourneyView, setLearningJourneyView] = useState<'subjects' | 'path' | 'chapter'>('subjects');
  const [activeSubjectForPath, setActiveSubjectForPath] = useState<string>('Mathematics');
  const [activeChapterForScreen, setActiveChapterForScreen] = useState<SyllabusChapter | null>(null);
  const [celebrationChapterTitle, setCelebrationChapterTitle] = useState<string | null>(null);
  const [staffViewMode, setStaffViewMode] = useState<'duolingo' | 'table'>('duolingo');

  // Core Data State
  const [syllabuses, setSyllabuses] = useState<OfficialSubjectSyllabus[]>([]);
  const [studentProgress, setStudentProgress] = useState<Record<string, StudentChapterProgress>>({});
  const [studySessions, setStudySessions] = useState<StudySessionItem[]>([]);
  const [upcomingExams, setUpcomingExams] = useState<ExamPreparationPlan[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Filters
  const [selectedSubject, setSelectedSubject] = useState<string>('All Subjects');

  // AI Timetable Generation State (Students only)
  const [dailyStudyHours, setDailyStudyHours] = useState<number>(2.5);
  const [sessionDurationMinutes, setSessionDurationMinutes] = useState<number>(45);
  const [isGeneratingAi, setIsGeneratingAi] = useState<boolean>(false);
  const [proposedAiSessions, setProposedAiSessions] = useState<StudySessionItem[] | null>(null);

  // Active Interactive Session Runner (Focus Timer in-situ)
  const [runningSession, setRunningSession] = useState<StudySessionItem | null>(null);
  const [sessionTimerSeconds, setSessionTimerSeconds] = useState<number>(0);
  const [isTimerActive, setIsTimerActive] = useState<boolean>(false);

  // Modal: Add New Chapter (Staff only)
  const [showAddChapterModal, setShowAddChapterModal] = useState<boolean>(false);
  const [newChSubject, setNewChSubject] = useState<string>('Mathematics');
  const [newChNumber, setNewChNumber] = useState<string>('7');
  const [newChTitle, setNewChTitle] = useState<string>('');
  const [newChTopics, setNewChTopics] = useState<string>('');
  const [newChNotes, setNewChNotes] = useState<string>('');
  const [newChWeightage, setNewChWeightage] = useState<number>(8);
  const [newChRelevance, setNewChRelevance] = useState<'core' | 'high' | 'medium' | 'low'>('high');

  // Modal: Add Custom Study Session
  const [showAddSessionModal, setShowAddSessionModal] = useState<boolean>(false);
  const [newSessSubject, setNewSessSubject] = useState<string>('Mathematics');
  const [newSessType, setNewSessType] = useState<StudySessionType>('learn_chapter');
  const [newSessTime, setNewSessTime] = useState<string>('17:00');
  const [newSessDuration, setNewSessDuration] = useState<number>(45);
  const [newSessNotes, setNewSessNotes] = useState<string>('');

  // Initial Load & Safe Data Migration
  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      setLoading(true);
      try {
        const [sylList, prog, sess, exams] = await Promise.all([
          SyllabusTimetableService.getOfficialSyllabuses(schoolId, grade),
          SyllabusTimetableService.getStudentProgress(userId),
          SyllabusTimetableService.getStudySessions(userId, legacySchedules),
          SyllabusTimetableService.getOfficialExams(schoolId)
        ]);
        if (isMounted) {
          setSyllabuses(sylList);
          setStudentProgress(prog);
          setStudySessions(sess);
          setUpcomingExams(exams);
        }
      } catch (err) {
        console.warn('[Planner] Initial load warning:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    loadData();
    return () => {
      isMounted = false;
    };
  }, [userId, schoolId, grade, legacySchedules]);

  // Active Session Countdown Timer effect
  useEffect(() => {
    let interval: any = null;
    if (isTimerActive && sessionTimerSeconds > 0) {
      interval = setInterval(() => {
        setSessionTimerSeconds(prev => {
          if (prev <= 1) {
            setIsTimerActive(false);
            soundService.playLevelUp();
            if (showNotification) {
              showNotification('⏱️ Study Session Time Expired! Great focus!');
            }
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isTimerActive, sessionTimerSeconds, showNotification]);

  // Compute Subject Progress Summaries
  const subjectSummaries = useMemo(() => {
    return SyllabusTimetableService.computeSubjectSummaries(syllabuses, studentProgress);
  }, [syllabuses, studentProgress]);

  // Handle Chapter Status Toggle
  const handleUpdateChapterStatus = async (
    chapterId: string,
    subject: string,
    newStatus: ChapterLearningStatus
  ) => {
    soundService.playButtonClick();
    const updated = await SyllabusTimetableService.updateStudentChapterProgress(
      userId,
      chapterId,
      subject,
      { status: newStatus, lastStudiedAt: new Date().toISOString() }
    );
    setStudentProgress(prev => ({
      ...prev,
      [chapterId]: updated
    }));

    if (newStatus === 'completed') {
      soundService.playLevelUp();
      const targetSyl = syllabuses.find(s => s.subject.toLowerCase() === subject.toLowerCase());
      const targetChapter = targetSyl?.chapters.find(c => c.id === chapterId);
      setCelebrationChapterTitle(targetChapter?.title || 'Chapter');
      if (showNotification) showNotification(`🎉 Chapter marked Completed (+50 Scholar XP)!`);
    } else if (newStatus === 'revised') {
      soundService.playAchievementSound();
      if (showNotification) showNotification(`✓ Chapter Revision logged (+25 Scholar XP)!`);
    }
  };

  // Handle Topic Checklist Toggle (Duolingo-inspired lesson breakdown)
  const handleToggleTopic = async (chapterId: string, subject: string, topic: string) => {
    const currentProg = studentProgress[chapterId];
    const completedTopics = currentProg?.completedTopics || [];
    const isAlreadyDone = completedTopics.includes(topic);
    const updatedTopics = isAlreadyDone
      ? completedTopics.filter(t => t !== topic)
      : [...completedTopics, topic];

    const targetSyl = syllabuses.find(s => s.subject.toLowerCase() === subject.toLowerCase());
    const targetChapter = targetSyl?.chapters.find(c => c.id === chapterId);
    const totalTopics = targetChapter?.topics?.length || 0;

    let newStatus: ChapterLearningStatus = currentProg?.status || 'in_progress';
    if (updatedTopics.length === 0) {
      newStatus = 'not_started';
    } else if (totalTopics > 0 && updatedTopics.length >= totalTopics) {
      newStatus = 'completed';
    } else {
      newStatus = 'in_progress';
    }

    const updated = await SyllabusTimetableService.updateStudentChapterProgress(
      userId,
      chapterId,
      subject,
      {
        completedTopics: updatedTopics,
        status: newStatus,
        lastStudiedAt: new Date().toISOString()
      }
    );

    setStudentProgress(prev => ({
      ...prev,
      [chapterId]: updated
    }));

    if (newStatus === 'completed' && currentProg?.status !== 'completed') {
      soundService.playLevelUp();
      setCelebrationChapterTitle(targetChapter?.title || 'Chapter');
      if (showNotification) showNotification('🎉 All topics mastered! Chapter marked Completed (+50 XP)!');
    }
  };

  // Handle Complete Study Session
  const handleCompleteSession = async (sessionId: string) => {
    soundService.playButtonClick();
    const result = await SyllabusTimetableService.completeStudySession(userId, sessionId);
    if (result.success && result.session) {
      setStudySessions(prev =>
        prev.map(s => (s.id === sessionId ? (result.session as StudySessionItem) : s))
      );
      soundService.playLevelUp();
      if (showNotification) {
        showNotification(`🎉 Study Session Finished! +${result.xpEarned} Scholar XP earned.`);
      }
    }
  };

  // Start in-situ Interactive Session
  const handleStartSession = (session: StudySessionItem) => {
    soundService.playButtonClick();
    setRunningSession(session);
    setSessionTimerSeconds(session.durationMinutes * 60);
    setIsTimerActive(true);
    soundService.playAppearSound();
  };

  // Generate AI Timetable (Students only)
  const handleGenerateAiTimetable = async () => {
    soundService.playButtonClick();
    setIsGeneratingAi(true);
    try {
      const generated = await SyllabusTimetableService.generateAiPersonalStudySchedule({
        userId,
        studentName: userName,
        grade,
        availableDailyHours: dailyStudyHours,
        preferredSessionMinutes: sessionDurationMinutes,
        upcomingExams
      });
      setProposedAiSessions(generated);
      soundService.playAppearSound();
      if (showNotification) {
        showNotification('✨ AI Personal Study Timetable generated around your official school hours!');
      }
    } catch (_) {
      if (showNotification) showNotification('Could not generate timetable.');
    } finally {
      setIsGeneratingAi(false);
    }
  };

  // Accept Proposed AI Timetable
  const handleAcceptAiTimetable = async () => {
    if (!proposedAiSessions) return;
    soundService.playButtonClick();
    const merged = [...proposedAiSessions, ...studySessions];
    await SyllabusTimetableService.saveStudySessions(userId, merged);
    setStudySessions(merged);
    setProposedAiSessions(null);
    setActivePlannerTab('sessions');
    soundService.playLevelUp();
    if (showNotification) {
      showNotification('✓ AI Study Sessions accepted and saved to your personal planner!');
    }
  };

  // Staff: Publish New Chapter to Official Syllabus
  const handleCreateOfficialChapter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChTitle.trim()) {
      if (showNotification) showNotification('Please provide a chapter title.');
      return;
    }

    const targetSyl = syllabuses.find(s => s.subject.toLowerCase() === newChSubject.toLowerCase());
    if (!targetSyl) return;

    const newChapter: SyllabusChapter = {
      id: `${newChSubject.toLowerCase().slice(0, 4)}_${grade.toLowerCase().replace(/\s+/g, '')}_ch${newChNumber}`,
      chapterNumber: newChNumber,
      title: newChTitle.trim(),
      topics: newChTopics.split(',').map(t => t.trim()).filter(Boolean),
      syllabusNotes: newChNotes.trim() || 'Curriculum learning resource.',
      expectedCompletionDate: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
      examRelevance: newChRelevance,
      weightageMarks: newChWeightage,
      status: 'published',
      lastUpdated: new Date().toISOString(),
      updatedBy: userName,
      updatedByRole: effectiveRole
    };

    const ok = await SyllabusTimetableService.updateChapter(
      schoolId,
      targetSyl.id,
      newChapter,
      userName,
      effectiveRole
    );

    if (ok) {
      const updatedList = await SyllabusTimetableService.getOfficialSyllabuses(schoolId, grade);
      setSyllabuses(updatedList);
      setShowAddChapterModal(false);
      setNewChTitle('');
      setNewChTopics('');
      setNewChNotes('');
      soundService.playLevelUp();
      if (showNotification) showNotification('✓ New chapter published to official school syllabus!');
    }
  };

  // Create Custom Session
  const handleCreateCustomSession = async (e: React.FormEvent) => {
    e.preventDefault();
    const today = new Date().toISOString().split('T')[0];
    const newSess: StudySessionItem = {
      id: `sess_${Date.now()}`,
      userId,
      date: today,
      startTime: newSessTime,
      endTime: '18:00',
      durationMinutes: newSessDuration,
      subject: newSessSubject,
      sessionType: newSessType,
      status: 'pending',
      notes: newSessNotes.trim() || 'Personal study target',
      reminderEnabled: true,
      isAiGenerated: false
    };

    const updated = [newSess, ...studySessions];
    await SyllabusTimetableService.saveStudySessions(userId, updated);
    setStudySessions(updated);
    setShowAddSessionModal(false);
    setNewSessNotes('');
    soundService.playButtonClick();
    if (showNotification) showNotification('✓ Study session scheduled!');
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto animate-fadeIn">
      {/* Top Header & Sub-Tab Navigation */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-2xl sm:text-3xl font-black font-display text-white">
              Syllabus Planner & Study Sessions
            </h2>
            <span className="px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-[10px] uppercase font-bold tracking-wider">
              {grade}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            School curriculum breakdown, chapter-wise learning milestones, study sessions, and conflict-free AI timetable
          </p>
        </div>

        {/* Action button */}
        <div className="flex items-center gap-2">
          {isStaff ? (
            <button
              type="button"
              onClick={() => setShowAddChapterModal(true)}
              className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-md cursor-pointer transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Publish Official Chapter</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setShowAddSessionModal(true)}
              className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-md cursor-pointer transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Schedule Session</span>
            </button>
          )}
        </div>
      </div>

      {/* Sub-Tab Navigation Strip */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 bg-slate-900/60 p-1.5 rounded-2xl border border-white/5">
        <button
          type="button"
          onClick={() => {
            setActivePlannerTab('progress');
            soundService.playButtonClick();
          }}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
            activePlannerTab === 'progress'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <BookOpen className="w-3.5 h-3.5" />
          <span>Syllabus & Chapter Progress</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActivePlannerTab('sessions');
            soundService.playButtonClick();
          }}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
            activePlannerTab === 'sessions'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          <span>Study Sessions ({studySessions.filter(s => s.status === 'pending').length} Pending)</span>
        </button>

        {isStudent && (
          <button
            type="button"
            onClick={() => {
              setActivePlannerTab('ai_timetable');
              soundService.playButtonClick();
            }}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activePlannerTab === 'ai_timetable'
                ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            <span>AI Study Timetable</span>
          </button>
        )}

        <button
          type="button"
          onClick={() => {
            setActivePlannerTab('official_timetable');
            soundService.playButtonClick();
          }}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
            activePlannerTab === 'official_timetable'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Calendar className="w-3.5 h-3.5" />
          <span>Official School Timetable</span>
        </button>
      </div>

      {/* ==================================================================== */}
      {/* TAB 1: DUOLINGO-INSPIRED SYLLABUS LEARNING MODULE */}
      {/* ==================================================================== */}
      {activePlannerTab === 'progress' && (
        <div className="space-y-6">
          {/* Staff Mode Switcher (Teachers & Admins only) */}
          {isStaff && (
            <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-900 border border-white/10 flex-wrap gap-2">
              <span className="text-xs font-bold text-slate-300">Staff Curriculum View:</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setStaffViewMode('duolingo')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    staffViewMode === 'duolingo'
                      ? 'bg-indigo-600 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Duolingo Student Journey
                </button>
                <button
                  type="button"
                  onClick={() => setStaffViewMode('table')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    staffViewMode === 'table'
                      ? 'bg-indigo-600 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Curriculum Editor Table
                </button>
              </div>
            </div>
          )}

          {/* VIEW A: STAFF CURRICULUM EDITOR TABLE */}
          {isStaff && staffViewMode === 'table' ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-extrabold text-white">Official Curriculum Registry</h3>
                <button
                  type="button"
                  onClick={() => setShowAddChapterModal(true)}
                  className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-md"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Publish New Chapter</span>
                </button>
              </div>

              {syllabuses.map(syl => (
                <div key={syl.id} className="p-5 rounded-2xl bg-slate-950/80 border border-white/10 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-bold text-white">
                      {syl.subject} ({syl.chapters.length} Chapters)
                    </h4>
                    <span className="text-xs text-slate-400 font-mono">By {syl.publishedBy}</span>
                  </div>
                  <div className="divide-y divide-white/5">
                    {syl.chapters.map(ch => (
                      <div key={ch.id} className="py-2.5 flex items-center justify-between text-xs">
                        <span className="font-semibold text-slate-200">
                          Ch {ch.chapterNumber}: {ch.title}
                        </span>
                        <span className="font-mono text-indigo-400">{ch.examRelevance} relevance</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            /* VIEW B: DUOLINGO GUIDED LEARNING EXPERIENCE */
            <div>
              {/* Level 1: Subject Selection Cards */}
              {learningJourneyView === 'subjects' && (
                <SubjectSelectionCards
                  summaries={subjectSummaries}
                  onSelectSubject={subj => {
                    setActiveSubjectForPath(subj);
                    setLearningJourneyView('path');
                  }}
                  selectedSubject={activeSubjectForPath}
                />
              )}

              {/* Level 2: Duolingo-Inspired Learning Path */}
              {learningJourneyView === 'path' && (() => {
                const targetSyl =
                  syllabuses.find(s => s.subject.toLowerCase() === activeSubjectForPath.toLowerCase()) ||
                  syllabuses[0];

                if (!targetSyl) {
                  return (
                    <div className="p-8 rounded-3xl bg-slate-950 border border-white/10 text-center space-y-3">
                      <p className="text-sm text-slate-300">No syllabus found for this subject yet.</p>
                      <button
                        type="button"
                        onClick={() => setLearningJourneyView('subjects')}
                        className="px-4 py-2 rounded-xl bg-indigo-600 text-white font-bold text-xs"
                      >
                        Back to Subjects
                      </button>
                    </div>
                  );
                }

                return (
                  <DuolingoLearningJourney
                    syllabus={targetSyl}
                    studentProgress={studentProgress}
                    onSelectChapter={ch => {
                      setActiveChapterForScreen(ch);
                      setLearningJourneyView('chapter');
                    }}
                    onBackToSubjects={() => setLearningJourneyView('subjects')}
                  />
                );
              })()}

              {/* Level 3: Chapter Learning Screen */}
              {learningJourneyView === 'chapter' && activeChapterForScreen && (() => {
                const targetSyl =
                  syllabuses.find(s => s.subject.toLowerCase() === activeSubjectForPath.toLowerCase()) ||
                  syllabuses[0];

                if (!targetSyl) return null;

                return (
                  <ChapterLearningScreen
                    syllabus={targetSyl}
                    chapter={activeChapterForScreen}
                    progress={studentProgress[activeChapterForScreen.id]}
                    onBack={() => setLearningJourneyView('path')}
                    onUpdateStatus={async newStatus => {
                      await handleUpdateChapterStatus(
                        activeChapterForScreen.id,
                        targetSyl.subject,
                        newStatus
                      );
                    }}
                    onToggleTopic={async topic => {
                      await handleToggleTopic(
                        activeChapterForScreen.id,
                        targetSyl.subject,
                        topic
                      );
                    }}
                    onNextChapter={nextId => {
                      const nextCh = targetSyl.chapters.find(c => c.id === nextId);
                      if (nextCh) setActiveChapterForScreen(nextCh);
                    }}
                    onTriggerCelebration={title => {
                      setCelebrationChapterTitle(title);
                    }}
                  />
                );
              })()}
            </div>
          )}
        </div>
      )}

      {/* ==================================================================== */}
      {/* TAB 2: STUDY SESSIONS (Personal Execution Layer) */}
      {/* ==================================================================== */}
      {activePlannerTab === 'sessions' && (
        <div className="space-y-6">
          {/* Active Session Countdown Banner (If running) */}
          {runningSession && (
            <div className="p-6 rounded-3xl bg-gradient-to-r from-indigo-950/80 via-slate-900 to-indigo-950/80 border border-indigo-500/50 shadow-2xl flex flex-col sm:flex-row items-center justify-between gap-4 animate-fadeIn">
              <div className="space-y-1 text-center sm:text-left">
                <div className="flex items-center justify-center sm:justify-start gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
                  <span className="text-xs uppercase font-extrabold tracking-wider text-indigo-400">
                    Live Active Study Session
                  </span>
                </div>
                <h3 className="text-lg sm:text-xl font-black text-white">
                  {runningSession.subject} · {runningSession.chapterTitle || runningSession.sessionType.replace('_', ' ')}
                </h3>
                <p className="text-xs text-slate-400">{runningSession.notes}</p>
              </div>

              <div className="flex items-center gap-4">
                <div className="font-mono text-3xl sm:text-4xl font-black text-amber-400 bg-slate-950 px-5 py-2.5 rounded-2xl border border-white/10 tabular-nums">
                  {Math.floor(sessionTimerSeconds / 60)}:
                  {String(sessionTimerSeconds % 60).padStart(2, '0')}
                </div>
                <button
                  type="button"
                  onClick={() => handleCompleteSession(runningSession.id)}
                  className="px-4 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg cursor-pointer flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Mark Done (+50 XP)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setRunningSession(null)}
                  className="p-3 rounded-2xl bg-slate-800 text-slate-400 hover:text-white"
                  title="Close runner"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Sessions List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between px-1 text-xs text-slate-400">
              <span className="font-extrabold uppercase tracking-wider text-slate-300">
                Scheduled Study Blocks ({studySessions.length})
              </span>
              <span>Personal Execution Layer</span>
            </div>

            {studySessions.map(sess => {
              const isCompleted = sess.status === 'completed';

              return (
                <div
                  key={sess.id}
                  className={`p-4 sm:p-5 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                    isCompleted
                      ? 'bg-slate-950/40 border-white/5 opacity-70'
                      : 'bg-slate-950/80 border-white/10 hover:border-indigo-500/30'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold text-indigo-400">
                        {sess.subject}
                      </span>
                      <span className="text-[10px] uppercase font-extrabold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-white/5">
                        {sess.sessionType.replace('_', ' ')}
                      </span>
                      {sess.isAiGenerated && (
                        <span className="text-[9px] uppercase font-bold px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                          AI Scheduled
                        </span>
                      )}
                    </div>
                    <h4 className="text-sm sm:text-base font-bold text-white">
                      {sess.chapterTitle || `${sess.subject} Study Session`}
                    </h4>
                    <p className="text-xs text-slate-400">{sess.notes}</p>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right text-xs text-slate-400 font-mono">
                      <span>{sess.date}</span>
                      <span className="block text-indigo-400 font-bold">
                        {sess.startTime} · {sess.durationMinutes}m
                      </span>
                    </div>

                    {!isCompleted ? (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleStartSession(sess)}
                          className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-md cursor-pointer"
                        >
                          <Play className="w-3.5 h-3.5 fill-current" />
                          <span>Start</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleCompleteSession(sess.id)}
                          className="px-3 py-2 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/40 border border-emerald-500/30 text-emerald-300 font-bold text-xs cursor-pointer"
                        >
                          Done
                        </button>
                      </div>
                    ) : (
                      <span className="px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-bold text-xs flex items-center gap-1">
                        <Check className="w-3.5 h-3.5" /> Completed
                      </span>
                    )}
                  </div>
                </div>
              );
            })}

            {studySessions.length === 0 && (
              <div className="p-8 text-center rounded-2xl border border-dashed border-white/10 text-slate-500 text-xs">
                No personal study sessions scheduled yet. Use the AI Study Timetable or Schedule Session button above!
              </div>
            )}
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* TAB 3: AI PERSONAL STUDY TIMETABLE GENERATOR (STUDENTS ONLY) */}
      {/* ==================================================================== */}
      {activePlannerTab === 'ai_timetable' && isStudent && (
        <div className="space-y-6">
          <div className="p-6 sm:p-8 rounded-3xl bg-gradient-to-br from-slate-900 via-indigo-950/40 to-slate-900 border border-indigo-500/30 space-y-6 shadow-xl">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-400" />
                <h3 className="text-xl font-black text-white">AI Personal Study Timetable</h3>
              </div>
              <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
                Generates a realistic, conflict-free personal study schedule scheduled exclusively around your official school hours. Automatically prioritizes unfinished syllabus chapters and upcoming examinations.
              </p>
            </div>

            {/* Input Config Sliders */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 p-5 rounded-2xl bg-slate-950/70 border border-white/5">
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-bold text-slate-300">
                  <span>Target Daily Evening Study Time</span>
                  <span className="font-mono text-indigo-400">{dailyStudyHours} Hours</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="4"
                  step="0.5"
                  value={dailyStudyHours}
                  onChange={e => setDailyStudyHours(Number(e.target.value))}
                  className="w-full accent-indigo-500"
                />
                <span className="text-[10px] text-slate-500 block">
                  Scheduled after school dismissal (16:30 - 21:00)
                </span>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-xs font-bold text-slate-300">
                  <span>Preferred Session Block Length</span>
                  <span className="font-mono text-indigo-400">{sessionDurationMinutes} Minutes</span>
                </div>
                <input
                  type="range"
                  min="30"
                  max="60"
                  step="15"
                  value={sessionDurationMinutes}
                  onChange={e => setSessionDurationMinutes(Number(e.target.value))}
                  className="w-full accent-indigo-500"
                />
                <span className="text-[10px] text-slate-500 block">
                  Includes mandatory 15-minute breaks between blocks
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleGenerateAiTimetable}
              disabled={isGeneratingAi}
              className="w-full py-4 rounded-2xl bg-gradient-to-r from-purple-600 via-indigo-600 to-indigo-700 hover:from-purple-500 hover:to-indigo-600 text-white font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-xl shadow-indigo-600/20 active:scale-[0.99] transition-all cursor-pointer disabled:opacity-50"
            >
              <Sparkles className="w-4 h-4 fill-current text-amber-300" />
              <span>
                {isGeneratingAi
                  ? 'Analyzing Curriculum & Generating Plan...'
                  : 'Generate Optimized Personal Study Schedule'}
              </span>
            </button>
          </div>

          {/* Proposed Sessions Review Panel */}
          {proposedAiSessions && (
            <div className="p-6 rounded-3xl bg-slate-950/90 border border-indigo-500/40 space-y-4 shadow-2xl animate-fadeIn">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <h4 className="text-base font-black text-white">Proposed Study Schedule</h4>
                  <p className="text-xs text-slate-400">
                    Review generated sessions. You can accept, discard, or regenerate.
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setProposedAiSessions(null)}
                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs"
                  >
                    Discard
                  </button>
                  <button
                    type="button"
                    onClick={handleAcceptAiTimetable}
                    className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md flex items-center gap-1.5"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Accept & Save to Planner</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {proposedAiSessions.map((sess, i) => (
                  <div
                    key={i}
                    className="p-3.5 rounded-xl bg-slate-900 border border-white/5 space-y-1.5 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-indigo-400">{sess.subject}</span>
                      <span className="text-[10px] font-mono text-slate-400 font-bold">
                        {sess.dayOfWeek} · {sess.startTime}
                      </span>
                    </div>
                    <p className="font-bold text-white truncate">{sess.chapterTitle}</p>
                    <p className="text-[11px] text-slate-400 capitalize">
                      {sess.sessionType.replace('_', ' ')} · {sess.durationMinutes}m
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ==================================================================== */}
      {/* TAB 4: OFFICIAL SCHOOL TIMETABLE */}
      {/* ==================================================================== */}
      {activePlannerTab === 'official_timetable' && (
        <OfficialTimetableViewer
          currentUser={currentUser}
          effectiveRole={effectiveRole}
          showNotification={showNotification}
        />
      )}

      {/* Modal: Publish Chapter (Staff only) */}
      <AnimatePresence>
        {showAddChapterModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
            <motion.div
              initial={{ scale: 0.94, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.94, opacity: 0 }}
              className="w-full max-w-lg p-6 rounded-3xl bg-slate-900 border border-white/10 space-y-5 shadow-2xl text-left"
            >
              <div className="space-y-1">
                <h3 className="text-lg font-black text-white">Publish Official Syllabus Chapter</h3>
                <p className="text-xs text-slate-400">
                  Adds an official curriculum chapter visible to all students in {grade}.
                </p>
              </div>

              <form onSubmit={handleCreateOfficialChapter} className="space-y-3.5">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-bold text-slate-400">Subject</label>
                    <select
                      value={newChSubject}
                      onChange={e => setNewChSubject(e.target.value)}
                      className="w-full text-xs px-3 py-2.5 rounded-xl bg-slate-950 border border-white/10 text-white font-bold"
                    >
                      <option>Mathematics</option>
                      <option>Physics</option>
                      <option>Chemistry</option>
                      <option>Computer Science</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-bold text-slate-400">Chapter Number</label>
                    <input
                      type="text"
                      value={newChNumber}
                      onChange={e => setNewChNumber(e.target.value)}
                      placeholder="e.g. 7"
                      className="w-full text-xs px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-white"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold text-slate-400">Chapter Title</label>
                  <input
                    type="text"
                    value={newChTitle}
                    onChange={e => setNewChTitle(e.target.value)}
                    placeholder="e.g. Coordinate Geometry & Section Formula"
                    className="w-full text-xs px-3 py-2.5 rounded-xl bg-slate-950 border border-white/10 text-white"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold text-slate-400">Topics (Comma separated)</label>
                  <input
                    type="text"
                    value={newChTopics}
                    onChange={e => setNewChTopics(e.target.value)}
                    placeholder="Distance Formula, Section Formula, Area of Triangles"
                    className="w-full text-xs px-3 py-2.5 rounded-xl bg-slate-950 border border-white/10 text-white"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-bold text-slate-400">Weightage (Marks)</label>
                    <input
                      type="number"
                      value={newChWeightage}
                      onChange={e => setNewChWeightage(Number(e.target.value))}
                      className="w-full text-xs px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-white"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-bold text-slate-400">Exam Relevance</label>
                    <select
                      value={newChRelevance}
                      onChange={e => setNewChRelevance(e.target.value as any)}
                      className="w-full text-xs px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-white"
                    >
                      <option value="core">Core Curriculum</option>
                      <option value="high">High Weightage</option>
                      <option value="medium">Standard</option>
                      <option value="low">Elective</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold text-slate-400">Syllabus Guidance Notes</label>
                  <textarea
                    rows={2}
                    value={newChNotes}
                    onChange={e => setNewChNotes(e.target.value)}
                    placeholder="Provide official textbook hints or board examination focus."
                    className="w-full text-xs p-2.5 rounded-xl bg-slate-950 border border-white/10 text-white"
                  />
                </div>

                <div className="flex gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowAddChapterModal(false)}
                    className="flex-1 py-2.5 rounded-xl bg-slate-800 text-slate-300 font-bold text-xs"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md"
                  >
                    Publish to School
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal: Schedule Custom Study Session */}
      <AnimatePresence>
        {showAddSessionModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
            <motion.div
              initial={{ scale: 0.94, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.94, opacity: 0 }}
              className="w-full max-w-md p-6 rounded-3xl bg-slate-900 border border-white/10 space-y-4 shadow-2xl text-left"
            >
              <div className="space-y-1">
                <h3 className="text-lg font-black text-white">Schedule Study Session</h3>
                <p className="text-xs text-slate-400">
                  Plan a dedicated personal study session in your schedule.
                </p>
              </div>

              <form onSubmit={handleCreateCustomSession} className="space-y-3">
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold text-slate-400">Subject</label>
                  <select
                    value={newSessSubject}
                    onChange={e => setNewSessSubject(e.target.value)}
                    className="w-full text-xs px-3 py-2.5 rounded-xl bg-slate-950 border border-white/10 text-white font-bold"
                  >
                    <option>Mathematics</option>
                    <option>Physics</option>
                    <option>Chemistry</option>
                    <option>Computer Science</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-bold text-slate-400">Start Time</label>
                    <input
                      type="time"
                      value={newSessTime}
                      onChange={e => setNewSessTime(e.target.value)}
                      className="w-full text-xs px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-white"
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-bold text-slate-400">Duration (Minutes)</label>
                    <select
                      value={newSessDuration}
                      onChange={e => setNewSessDuration(Number(e.target.value))}
                      className="w-full text-xs px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-white"
                    >
                      <option value={30}>30 Minutes</option>
                      <option value={45}>45 Minutes</option>
                      <option value={60}>60 Minutes</option>
                      <option value={90}>90 Minutes</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold text-slate-400">Session Goal / Notes</label>
                  <input
                    type="text"
                    value={newSessNotes}
                    onChange={e => setNewSessNotes(e.target.value)}
                    placeholder="e.g. Solve textbook questions 1-10"
                    className="w-full text-xs px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-white"
                  />
                </div>

                <div className="flex gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowAddSessionModal(false)}
                    className="flex-1 py-2.5 rounded-xl bg-slate-800 text-slate-300 font-bold text-xs"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md"
                  >
                    Save Session
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Chapter Completion Celebratory Burst (React Bits / UIverse) */}
      {celebrationChapterTitle && (
        <LearningCelebration
          title={celebrationChapterTitle}
          subtitle="You've mastered this chapter on your learning path!"
          xpEarned={50}
          onClose={() => setCelebrationChapterTitle(null)}
        />
      )}
    </div>
  );
};
