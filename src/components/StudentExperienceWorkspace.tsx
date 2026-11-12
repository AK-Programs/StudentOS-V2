import React, { useState } from 'react';
import { motion } from 'motion/react';
import { 
  Sparkles, BookOpen, Clock, Calendar, CheckCircle2, AlertCircle, 
  ChevronRight, ArrowRight, Brain, FileText, Award, BarChart3, 
  TrendingUp, Users, Folder, Star, Bell, Plus
} from 'lucide-react';
import { UserProfile, Homework, Task } from '../types';
import { soundService } from '../lib/soundService';
import { VeylentraIcon } from './ui/VeylentraIcon';
import StudentAttendanceView from './StudentAttendanceView';
import StudentMarksCenter from './StudentMarksCenter';
import { OfficialTimetableViewer } from './OfficialTimetableViewer';

interface StudentExperienceWorkspaceProps {
  currentUser: UserProfile;
  effectiveRole: string;
  homeworkList: Homework[];
  tasks: Task[];
  announcements: any[];
  onNavigateTab: (tabId: string) => void;
  onOpenOrionFull: (initialQuery?: string) => void;
  showNotification: (msg: string) => void;
}

export const StudentExperienceWorkspace: React.FC<StudentExperienceWorkspaceProps> = ({
  currentUser,
  effectiveRole,
  homeworkList = [],
  tasks = [],
  announcements = [],
  onNavigateTab,
  onOpenOrionFull,
  showNotification
}) => {
  const [subSection, setSubSection] = useState<'dashboard' | 'academics' | 'assignments' | 'attendance' | 'study_space'>('dashboard');
  const [orionHelpTopic, setOrionHelpTopic] = useState('');
  const [isExplaining, setIsExplaining] = useState(false);
  const [aiExplanation, setAiExplanation] = useState<string | null>(null);

  // Date and Time calculation
  const today = new Date();
  const dateFormatted = today.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });

  // Filter pending vs completed homework
  const userIdentifier = currentUser.uid || currentUser.email || '';
  const myPendingHomework = homeworkList.filter(h => !(h.completedList || []).includes(userIdentifier));
  const myCompletedHomework = homeworkList.filter(h => (h.completedList || []).includes(userIdentifier));
  
  // Pending tasks
  const pendingTasks = tasks.filter(t => !t.completed);

  const handleAskOrionTopic = async (topic: string, subject?: string) => {
    setIsExplaining(true);
    setAiExplanation(null);
    soundService.playButtonClick();

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: `Please provide a clear, intuitive 3-step explanation of "${topic}" for a ${currentUser.grade || 'Grade 10'} student in ${subject || 'general academics'}, with one practical example and a practice check question.`,
          persona: 'tutor',
          context: `Grade: ${currentUser.grade || 'Grade 10'}. Subject: ${subject || 'Academics'}. Student: ${currentUser.name}.`
        })
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setAiExplanation(data.text || data.response || 'Here is the breakdown of this concept.');
      showNotification('Orion prepared an explanation for this topic.');
    } catch (e) {
      setAiExplanation('Unable to fetch AI explanation right now. Please try again or open Orion Copilot.');
    } finally {
      setIsExplaining(false);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12 animate-fadeIn select-text">
      {/* Top Academic Sub-navigation */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4">
        <div className="flex items-center gap-1.5 p-1 bg-slate-900 border border-white/10 rounded-2xl overflow-x-auto max-w-full">
          {[
            { id: 'dashboard', label: 'Command Center', icon: 'dashboard' },
            { id: 'academics', label: 'Academic Hub', icon: 'syllabus' },
            { id: 'assignments', label: 'Assignments & Assessments', icon: 'homework' },
            { id: 'attendance', label: 'Attendance', icon: 'attendance_manager' },
            { id: 'study_space', label: 'Study Space', icon: 'study_hub' }
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                soundService.playButtonClick();
                setSubSection(item.id as any);
              }}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 whitespace-nowrap transition-all cursor-pointer ${
                subSection === item.id
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <VeylentraIcon name={item.icon as any} size="sm" />
              <span>{item.label}</span>
            </button>
          ))}
        </div>

        {/* Orion Quick Prompt Trigger */}
        <button
          type="button"
          onClick={() => {
            soundService.playButtonClick();
            onOpenOrionFull('Explain my pending academic priorities for today.');
          }}
          className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-indigo-500/30 text-indigo-300 hover:text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
        >
          <Brain className="w-3.5 h-3.5 text-indigo-400" />
          <span>Ask Orion AI</span>
        </button>
      </div>

      {/* =========================================================================
          SUB-SECTION 1: STUDENT DASHBOARD — PERSONAL ACADEMIC COMMAND CENTER
      ========================================================================== */}
      {subSection === 'dashboard' && (
        <div className="space-y-6">
          {/* Welcome Header */}
          <div className="p-6 rounded-3xl bg-slate-900 border border-white/10 relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-md">
            <div className="space-y-1.5 relative z-10">
              <div className="flex items-center gap-2 text-xs font-semibold text-indigo-400">
                <span>{(currentUser as any).schoolName || 'Veylentra International Academy'}</span>
                <span>·</span>
                <span className="text-slate-300">{currentUser.grade || 'Grade 10'} {currentUser.section ? `(${currentUser.section})` : ''}</span>
                <span>·</span>
                <span className="text-slate-400 font-mono">{dateFormatted}</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                Welcome back, {currentUser.name?.split(' ')[0]}
              </h1>
              <p className="text-xs sm:text-sm text-slate-300 max-w-xl leading-relaxed">
                Here is your academic overview for today. You have {myPendingHomework.length} pending assignment{myPendingHomework.length !== 1 ? 's' : ''} and {pendingTasks.length} study task{pendingTasks.length !== 1 ? 's' : ''} scheduled.
              </p>
            </div>

            <div className="flex items-center gap-3 shrink-0 relative z-10">
              <button
                type="button"
                onClick={() => setSubSection('assignments')}
                className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-2 shadow-md transition-all cursor-pointer"
              >
                <span>View Assignments</span>
                <ChevronRight className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => onNavigateTab('timetable')}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-white/10 font-semibold text-xs transition-colors cursor-pointer"
              >
                Today's Classes
              </button>
            </div>
          </div>

          {/* Quick Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
            <div className="p-4 rounded-2xl bg-slate-900 border border-white/10 flex flex-col justify-between">
              <span className="text-xs font-bold text-slate-400">Pending Homework</span>
              <div className="flex items-baseline gap-2 mt-2">
                <span className="text-2xl font-black text-amber-400">{myPendingHomework.length}</span>
                <span className="text-[11px] text-slate-500">due soon</span>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900 border border-white/10 flex flex-col justify-between">
              <span className="text-xs font-bold text-slate-400">Completed Work</span>
              <div className="flex items-baseline gap-2 mt-2">
                <span className="text-2xl font-black text-emerald-400">{myCompletedHomework.length}</span>
                <span className="text-[11px] text-slate-500">submitted</span>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900 border border-white/10 flex flex-col justify-between">
              <span className="text-xs font-bold text-slate-400">Scheduled Tasks</span>
              <div className="flex items-baseline gap-2 mt-2">
                <span className="text-2xl font-black text-cyan-400">{pendingTasks.length}</span>
                <span className="text-[11px] text-slate-500">in planner</span>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900 border border-white/10 flex flex-col justify-between">
              <span className="text-xs font-bold text-slate-400">Next Upcoming Class</span>
              <div className="flex items-baseline gap-1 mt-2">
                <span className="text-base font-bold text-white truncate">Mathematics</span>
              </div>
            </div>
          </div>

          {/* Core Dashboard Content (2 Columns) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left 7 Cols: Today's Priorities & Assignments */}
            <div className="lg:col-span-7 space-y-6">
              <div className="p-6 rounded-3xl bg-slate-900 border border-white/10 space-y-4">
                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                  <div>
                    <h3 className="text-sm font-bold text-white">Pending Assignments</h3>
                    <p className="text-[11px] text-slate-400">Active coursework requiring submission</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSubSection('assignments')}
                    className="text-xs font-bold text-indigo-400 hover:text-indigo-300"
                  >
                    View All ({myPendingHomework.length})
                  </button>
                </div>

                {myPendingHomework.length === 0 ? (
                  <div className="p-6 rounded-2xl bg-slate-950/40 text-center space-y-1">
                    <CheckCircle2 className="w-6 h-6 text-emerald-400 mx-auto mb-1" />
                    <p className="text-xs font-bold text-white">No pending assignments</p>
                    <p className="text-[11px] text-slate-400">All assigned homework is submitted and up to date.</p>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {myPendingHomework.slice(0, 4).map((hw) => (
                      <div
                        key={hw.id}
                        className="p-3.5 rounded-2xl bg-slate-950/60 border border-white/5 flex items-center justify-between gap-3"
                      >
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded-md bg-indigo-500/15 text-[10px] font-bold text-indigo-300">
                              {hw.subject || 'Class'}
                            </span>
                            <span className="text-xs font-bold text-white">{hw.title}</span>
                          </div>
                          <p className="text-[11px] text-slate-400">
                            Due: {hw.dueDate || 'Standard deadline'} · Assigned by {hw.givenBy || 'Faculty'}
                          </p>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleAskOrionTopic(hw.title, hw.subject)}
                            title="Ask Orion AI to explain instructions"
                            className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 text-xs transition-colors"
                          >
                            <Brain className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onNavigateTab('homework')}
                            className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-xs font-semibold text-slate-200"
                          >
                            Open
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Orion Contextual Explanation Card */}
              {isExplaining && (
                <div className="p-4 rounded-2xl bg-indigo-950/40 border border-indigo-500/30 flex items-center gap-3 animate-pulse">
                  <Sparkles className="w-4 h-4 text-indigo-400 animate-spin" />
                  <span className="text-xs text-indigo-200">Orion is generating a step-by-step concept breakdown...</span>
                </div>
              )}

              {aiExplanation && (
                <div className="p-5 rounded-3xl bg-slate-900 border border-indigo-500/40 space-y-3">
                  <div className="flex items-center justify-between border-b border-white/10 pb-2">
                    <span className="text-xs font-bold text-indigo-400 flex items-center gap-1.5">
                      <Brain className="w-3.5 h-3.5" />
                      <span>Orion Concept Breakdown</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setAiExplanation(null)}
                      className="text-[11px] text-slate-400 hover:text-white"
                    >
                      Dismiss
                    </button>
                  </div>
                  <p className="text-xs text-slate-200 whitespace-pre-line leading-relaxed">
                    {aiExplanation}
                  </p>
                </div>
              )}
            </div>

            {/* Right 5 Cols: Today's Schedule & Announcements */}
            <div className="lg:col-span-5 space-y-6">
              {/* Important Announcements */}
              <div className="p-6 rounded-3xl bg-slate-900 border border-white/10 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Bell className="w-4 h-4 text-cyan-400" />
                    <span>School Announcements</span>
                  </h3>
                  <button
                    type="button"
                    onClick={() => onNavigateTab('whats_new')}
                    className="text-xs font-bold text-cyan-400 hover:text-cyan-300"
                  >
                    View All
                  </button>
                </div>

                <div className="space-y-2">
                  {announcements.slice(0, 3).map((a, idx) => (
                    <div
                      key={a.id || idx}
                      className="p-3 rounded-2xl bg-slate-950/60 border border-white/5 space-y-1"
                    >
                      <p className="text-xs font-bold text-white leading-snug">{a.title || 'Campus Circular'}</p>
                      <p className="text-[11px] text-slate-400 line-clamp-2">{a.content || a.description || 'Important update from administration.'}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Study Space Quick Access */}
              <div className="p-6 rounded-3xl bg-slate-900 border border-white/10 space-y-3">
                <h3 className="text-sm font-bold text-white">Study Space Quick Launch</h3>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => onNavigateTab('lecture_notes')}
                    className="p-3 rounded-2xl bg-slate-950/60 border border-white/5 hover:border-indigo-500/30 text-left transition-colors"
                  >
                    <span className="text-lg">📝</span>
                    <p className="text-xs font-bold text-white mt-1">Lecture Notes</p>
                    <p className="text-[10px] text-slate-400">Saved notes & OCR</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => onNavigateTab('study_hub')}
                    className="p-3 rounded-2xl bg-slate-950/60 border border-white/5 hover:border-indigo-500/30 text-left transition-colors"
                  >
                    <span className="text-lg">🗂️</span>
                    <p className="text-xs font-bold text-white mt-1">Flashcards</p>
                    <p className="text-[10px] text-slate-400">Spaced repetition</p>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          SUB-SECTION 2: ACADEMIC HUB (Timetable, Subjects, Syllabus)
      ========================================================================== */}
      {subSection === 'academics' && (
        <div className="space-y-6">
          <div className="p-6 rounded-3xl bg-slate-900 border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-white">Class Timetable & Academic Schedule</h2>
              <p className="text-xs text-slate-400">Official scheduled periods for {currentUser.grade || 'Grade 10'} {currentUser.section || ''}</p>
            </div>
            <button
              type="button"
              onClick={() => onNavigateTab('timetable')}
              className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold"
            >
              Open Interactive Viewer
            </button>
          </div>

          <OfficialTimetableViewer currentUser={currentUser} effectiveRole={effectiveRole as any} />
        </div>
      )}

      {/* =========================================================================
          SUB-SECTION 3: ASSIGNMENTS AND ASSESSMENTS
      ========================================================================== */}
      {subSection === 'assignments' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-white">Assignments & Assessment Center</h2>
              <p className="text-xs text-slate-400">Track deadlines, submissions, and teacher evaluations</p>
            </div>
            <button
              type="button"
              onClick={() => onNavigateTab('homework')}
              className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold"
            >
              Submit New Assignment
            </button>
          </div>

          {/* Pending assignments */}
          <div className="p-6 rounded-3xl bg-slate-900 border border-white/10 space-y-4">
            <h3 className="text-sm font-bold text-amber-400 flex items-center gap-2">
              <Clock className="w-4 h-4" />
              <span>Pending Submissions ({myPendingHomework.length})</span>
            </h3>

            {myPendingHomework.length === 0 ? (
              <p className="text-xs text-slate-400 py-3">No pending assignments!</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {myPendingHomework.map(hw => (
                  <div key={hw.id} className="p-4 rounded-2xl bg-slate-950/60 border border-white/10 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase text-indigo-400 px-2 py-0.5 rounded bg-indigo-500/10">
                        {hw.subject || 'Class'}
                      </span>
                      <span className="text-xs font-mono text-amber-400">Due: {hw.dueDate || 'Scheduled'}</span>
                    </div>
                    <h4 className="text-xs font-bold text-white">{hw.title}</h4>
                    <p className="text-[11px] text-slate-400 line-clamp-2">{(hw as any).description || hw.content || 'Complete coursework questions.'}</p>
                    <div className="pt-2 border-t border-white/5 flex items-center justify-between">
                      <button
                        type="button"
                        onClick={() => handleAskOrionTopic(hw.title, hw.subject)}
                        className="text-[11px] text-indigo-400 hover:text-indigo-300 font-semibold flex items-center gap-1"
                      >
                        <Brain className="w-3 h-3" />
                        <span>Explain Instructions</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onNavigateTab('homework')}
                        className="px-3 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold"
                      >
                        Submit
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Submitted assignments */}
          <div className="p-6 rounded-3xl bg-slate-900 border border-white/10 space-y-4">
            <h3 className="text-sm font-bold text-emerald-400 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              <span>Submitted & Evaluated Work ({myCompletedHomework.length})</span>
            </h3>

            {myCompletedHomework.length === 0 ? (
              <p className="text-xs text-slate-400 py-3">No completed assignments yet.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {myCompletedHomework.map(hw => (
                  <div key={hw.id} className="p-4 rounded-2xl bg-slate-950/60 border border-white/10 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase text-emerald-400 px-2 py-0.5 rounded bg-emerald-500/10">
                        {hw.subject || 'Class'}
                      </span>
                      <span className="text-xs text-emerald-400 font-semibold">Submitted</span>
                    </div>
                    <h4 className="text-xs font-bold text-white">{hw.title}</h4>
                    <p className="text-[11px] text-slate-400">{(hw as any).description || hw.content || 'Completed coursework.'}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* =========================================================================
          SUB-SECTION 4: ATTENDANCE EXPERIENCE
      ========================================================================== */}
      {subSection === 'attendance' && (
        <div className="space-y-6">
          <StudentAttendanceView currentUser={currentUser} />
        </div>
      )}

      {/* =========================================================================
          SUB-SECTION 5: STUDENT STUDY SPACE
      ========================================================================== */}
      {subSection === 'study_space' && (
        <div className="space-y-6">
          <div className="p-6 rounded-3xl bg-slate-900 border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-white">Personal Study Space & Revision Planner</h2>
              <p className="text-xs text-slate-400">Integrated learning tools, revision goals, and saved Lecture Notes</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onNavigateTab('lecture_notes')}
                className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold border border-white/10"
              >
                Lecture Notes
              </button>
              <button
                type="button"
                onClick={() => onNavigateTab('study_hub')}
                className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold"
              >
                Study Hub
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-5 rounded-2xl bg-slate-900 border border-white/10 space-y-2">
              <span className="text-2xl">📚</span>
              <h4 className="text-sm font-bold text-white">Lecture Notes</h4>
              <p className="text-xs text-slate-400">Math formulas, OCR diagrams, and structured notes.</p>
              <button
                type="button"
                onClick={() => onNavigateTab('lecture_notes')}
                className="text-xs text-indigo-400 font-bold hover:underline"
              >
                Open Notes Workspace →
              </button>
            </div>

            <div className="p-5 rounded-2xl bg-slate-900 border border-white/10 space-y-2">
              <span className="text-2xl">🧠</span>
              <h4 className="text-sm font-bold text-white">Flashcard Mastery</h4>
              <p className="text-xs text-slate-400">Spaced repetition system for long-term retention.</p>
              <button
                type="button"
                onClick={() => onNavigateTab('study_hub')}
                className="text-xs text-indigo-400 font-bold hover:underline"
              >
                Review Cards →
              </button>
            </div>

            <div className="p-5 rounded-2xl bg-slate-900 border border-white/10 space-y-2">
              <span className="text-2xl">🎯</span>
              <h4 className="text-sm font-bold text-white">Brain Battle Arena</h4>
              <p className="text-xs text-slate-400">Real-time educational quiz battles with fellow scholars.</p>
              <button
                type="button"
                onClick={() => onNavigateTab('brain_battle')}
                className="text-xs text-indigo-400 font-bold hover:underline"
              >
                Start Arena Challenge →
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
