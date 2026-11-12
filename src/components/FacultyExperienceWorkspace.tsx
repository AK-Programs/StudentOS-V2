import React, { useState } from 'react';
import { motion } from 'motion/react';
import { 
  Sparkles, Users, BookOpen, Calendar, CheckCircle2, Clock, 
  Award, BarChart3, FileText, ChevronRight, ArrowRight, Brain, 
  Shield, Bell, Plus, Filter, Search, Layers, Megaphone
} from 'lucide-react';
import { UserProfile, Homework } from '../types';
import { soundService } from '../lib/soundService';
import { VeylentraIcon } from './ui/VeylentraIcon';
import StudentMarksCenter from './StudentMarksCenter';
import AttendanceManager from './AttendanceManager';
import { OfficialTimetableViewer } from './OfficialTimetableViewer';

interface FacultyExperienceWorkspaceProps {
  currentUser: UserProfile;
  effectiveRole: string; // 'teacher' | 'coordinator' | 'admin' | 'super_admin'
  homeworkList: Homework[];
  announcements: any[];
  onNavigateTab: (tabId: string) => void;
  onOpenOrionFull: (initialQuery?: string) => void;
  showNotification: (msg: string) => void;
}

export const FacultyExperienceWorkspace: React.FC<FacultyExperienceWorkspaceProps> = ({
  currentUser,
  effectiveRole,
  homeworkList = [],
  announcements = [],
  onNavigateTab,
  onOpenOrionFull,
  showNotification
}) => {
  const isCoordinator = effectiveRole === 'coordinator';
  const defaultSubSection = isCoordinator ? 'coordinator_workspace' : 'command_center';
  const [subSection, setSubSection] = useState<'command_center' | 'teacher_workspace' | 'coordinator_workspace' | 'classrooms' | 'teaching_assessments'>(defaultSubSection);

  // Orion Contextual Drafting State
  const [draftPrompt, setDraftPrompt] = useState('');
  const [isDrafting, setIsDrafting] = useState(false);
  const [draftResult, setDraftResult] = useState<string | null>(null);

  const assignedGradesList = currentUser.assignedGrades && currentUser.assignedGrades.length > 0
    ? currentUser.assignedGrades
    : [currentUser.grade || 'Grade 10'];
  const assignedSectionsList = currentUser.assignedSections && currentUser.assignedSections.length > 0
    ? currentUser.assignedSections
    : [currentUser.section || 'Solara'];

  const teacherHomework = homeworkList.filter(hw =>
    assignedGradesList.includes(hw.classGrade) || hw.givenBy === currentUser.name
  );
  const pendingSubmissionsToReview = teacherHomework.reduce(
    (acc, hw) => acc + (hw.completedList ? hw.completedList.length : 0),
    0
  );

  const handleDraftWithOrion = async (taskType: string) => {
    setIsDrafting(true);
    setDraftResult(null);
    soundService.playButtonClick();

    let promptText = '';
    if (taskType === 'assignment') {
      promptText = `Draft a high-quality academic assignment for ${assignedGradesList.join(', ')} in ${currentUser.department || 'General Science'}. Include title, 3 learning objectives, 4 progressive problem tasks, and submission criteria.`;
    } else if (taskType === 'lesson_plan') {
      promptText = `Draft a modern 45-minute structured lesson plan for ${assignedGradesList.join(', ')} on upcoming curriculum concepts. Include 5-minute hook, 20-minute core instruction, 15-minute collaborative exercise, and 5-minute exit ticket.`;
    } else if (taskType === 'announcement') {
      promptText = `Draft a professional, inspiring classroom announcement for students in ${assignedGradesList.join(', ')} regarding upcoming deadlines and study preparations.`;
    } else {
      promptText = `Assist faculty in preparing academic resources for ${assignedGradesList.join(', ')}.`;
    }

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: promptText,
          persona: 'faculty_mentor',
          context: `Faculty member: ${currentUser.name}. Role: ${effectiveRole}. Department: ${currentUser.department || 'Academics'}. Cohort: ${assignedGradesList.join(', ')}.`
        })
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setDraftResult(data.text || data.response || 'Draft created successfully.');
      showNotification(`Orion prepared a ${taskType.replace('_', ' ')} draft.`);
    } catch (e) {
      setDraftResult('Could not complete drafting request right now. Please try again.');
    } finally {
      setIsDrafting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12 animate-fadeIn select-text">
      {/* Top Faculty Workspace Sub-navigation */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4">
        <div className="flex items-center gap-1.5 p-1 bg-slate-900 border border-white/10 rounded-2xl overflow-x-auto max-w-full">
          <button
            type="button"
            onClick={() => {
              soundService.playButtonClick();
              setSubSection('command_center');
            }}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 whitespace-nowrap transition-all cursor-pointer ${
              subSection === 'command_center'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <VeylentraIcon name="dashboard" size="sm" />
            <span>Command Center</span>
          </button>

          <button
            type="button"
            onClick={() => {
              soundService.playButtonClick();
              setSubSection('teacher_workspace');
            }}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 whitespace-nowrap transition-all cursor-pointer ${
              subSection === 'teacher_workspace'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <VeylentraIcon name="study_hub" size="sm" />
            <span>Teacher Workspace</span>
          </button>

          {isCoordinator && (
            <button
              type="button"
              onClick={() => {
                soundService.playButtonClick();
                setSubSection('coordinator_workspace');
              }}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 whitespace-nowrap transition-all cursor-pointer ${
                subSection === 'coordinator_workspace'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <VeylentraIcon name="admin" size="sm" />
              <span>Coordinator Module</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              soundService.playButtonClick();
              setSubSection('classrooms');
            }}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 whitespace-nowrap transition-all cursor-pointer ${
              subSection === 'classrooms'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <VeylentraIcon name="editor" size="sm" />
            <span>Classroom & Attendance</span>
          </button>

          <button
            type="button"
            onClick={() => {
              soundService.playButtonClick();
              setSubSection('teaching_assessments');
            }}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 whitespace-nowrap transition-all cursor-pointer ${
              subSection === 'teaching_assessments'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <VeylentraIcon name="analytics" size="sm" />
            <span>Marks & Gradebook</span>
          </button>
        </div>

        {/* Orion Quick Prompt Trigger */}
        <button
          type="button"
          onClick={() => {
            soundService.playButtonClick();
            onOpenOrionFull('Assist me with preparing this week\'s academic coursework and lesson schedule.');
          }}
          className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-indigo-500/30 text-indigo-300 hover:text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
        >
          <Brain className="w-3.5 h-3.5 text-indigo-400" />
          <span>Faculty Orion Copilot</span>
        </button>
      </div>

      {/* =========================================================================
          SUB-SECTION 1: FACULTY COMMAND CENTER
      ========================================================================== */}
      {subSection === 'command_center' && (
        <div className="space-y-6">
          {/* Welcome Banner */}
          <div className="p-6 rounded-3xl bg-slate-900 border border-white/10 relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-md">
            <div className="space-y-1.5 relative z-10">
              <div className="flex items-center gap-2 text-xs font-semibold text-indigo-400">
                <span>Faculty Operations</span>
                <span>·</span>
                <span className="text-slate-300">{currentUser.department || 'Academic Department'}</span>
                <span>·</span>
                <span className="text-slate-400 font-mono">Role: {effectiveRole.toUpperCase()}</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                Good day, {currentUser.name}
              </h1>
              <p className="text-xs sm:text-sm text-slate-300 max-w-xl leading-relaxed">
                Assigned cohorts: {assignedGradesList.join(', ')} ({assignedSectionsList.join(', ')}). You have {pendingSubmissionsToReview} student submission{pendingSubmissionsToReview !== 1 ? 's' : ''} awaiting grading.
              </p>
            </div>

            <div className="flex items-center gap-3 shrink-0 relative z-10">
              <button
                type="button"
                onClick={() => onNavigateTab('whiteboard')}
                className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-2 shadow-md transition-all cursor-pointer"
              >
                <span>Launch Smartboard</span>
                <ChevronRight className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setSubSection('classrooms')}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-white/10 font-semibold text-xs transition-colors cursor-pointer"
              >
                Take Attendance
              </button>
            </div>
          </div>

          {/* Quick Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
            <div className="p-4 rounded-2xl bg-slate-900 border border-white/10 flex flex-col justify-between">
              <span className="text-xs font-bold text-slate-400">Assigned Cohorts</span>
              <div className="flex items-baseline gap-2 mt-2">
                <span className="text-2xl font-black text-white">{assignedGradesList.length}</span>
                <span className="text-[11px] text-slate-500">grades</span>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900 border border-white/10 flex flex-col justify-between">
              <span className="text-xs font-bold text-slate-400">Pending Reviews</span>
              <div className="flex items-baseline gap-2 mt-2">
                <span className="text-2xl font-black text-amber-400">{pendingSubmissionsToReview}</span>
                <span className="text-[11px] text-slate-500">to grade</span>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900 border border-white/10 flex flex-col justify-between">
              <span className="text-xs font-bold text-slate-400">Active Assignments</span>
              <div className="flex items-baseline gap-2 mt-2">
                <span className="text-2xl font-black text-indigo-400">{teacherHomework.length}</span>
                <span className="text-[11px] text-slate-500">issued</span>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900 border border-white/10 flex flex-col justify-between">
              <span className="text-xs font-bold text-slate-400">Teaching Mode</span>
              <div className="flex items-baseline gap-1 mt-2">
                <span className="text-base font-bold text-emerald-400">Active</span>
              </div>
            </div>
          </div>

          {/* Orion Faculty Action Cards */}
          <div className="p-6 rounded-3xl bg-slate-900 border border-white/10 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Brain className="w-4 h-4 text-indigo-400" />
                  <span>Orion Faculty Drafting Tools</span>
                </h3>
                <p className="text-[11px] text-slate-400">Instantly draft curriculum-aligned materials for your assigned cohorts</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <button
                type="button"
                onClick={() => handleDraftWithOrion('assignment')}
                className="p-4 rounded-2xl bg-slate-950/60 border border-white/5 hover:border-indigo-500/30 text-left transition-colors cursor-pointer group"
              >
                <span className="text-xl">📓</span>
                <h4 className="text-xs font-bold text-white group-hover:text-indigo-300 mt-2">Draft Assignment</h4>
                <p className="text-[10px] text-slate-400 mt-1">Generate complete assignment prompt with rubric & criteria.</p>
              </button>

              <button
                type="button"
                onClick={() => handleDraftWithOrion('lesson_plan')}
                className="p-4 rounded-2xl bg-slate-950/60 border border-white/5 hover:border-indigo-500/30 text-left transition-colors cursor-pointer group"
              >
                <span className="text-xl">📋</span>
                <h4 className="text-xs font-bold text-white group-hover:text-indigo-300 mt-2">Draft Lesson Plan</h4>
                <p className="text-[10px] text-slate-400 mt-1">Generate 45-minute lesson structure with active activities.</p>
              </button>

              <button
                type="button"
                onClick={() => handleDraftWithOrion('announcement')}
                className="p-4 rounded-2xl bg-slate-950/60 border border-white/5 hover:border-indigo-500/30 text-left transition-colors cursor-pointer group"
              >
                <span className="text-xl">📢</span>
                <h4 className="text-xs font-bold text-white group-hover:text-indigo-300 mt-2">Draft Announcement</h4>
                <p className="text-[10px] text-slate-400 mt-1">Generate clear notice for exam alerts or project deadlines.</p>
              </button>
            </div>

            {isDrafting && (
              <div className="p-4 rounded-2xl bg-indigo-950/40 border border-indigo-500/30 flex items-center gap-3 animate-pulse">
                <Sparkles className="w-4 h-4 text-indigo-400 animate-spin" />
                <span className="text-xs text-indigo-200">Orion is drafting your faculty resource...</span>
              </div>
            )}

            {draftResult && (
              <div className="p-5 rounded-2xl bg-slate-950 border border-indigo-500/40 space-y-3">
                <div className="flex items-center justify-between border-b border-white/10 pb-2">
                  <span className="text-xs font-bold text-indigo-400 flex items-center gap-1.5">
                    <Brain className="w-3.5 h-3.5" />
                    <span>Orion Faculty Draft Result</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setDraftResult(null)}
                    className="text-[11px] text-slate-400 hover:text-white"
                  >
                    Dismiss
                  </button>
                </div>
                <p className="text-xs text-slate-200 whitespace-pre-line leading-relaxed">
                  {draftResult}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* =========================================================================
          SUB-SECTION 2: TEACHER WORKSPACE
      ========================================================================== */}
      {subSection === 'teacher_workspace' && (
        <div className="space-y-6">
          <div className="p-6 rounded-3xl bg-slate-900 border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-white">Teacher Schedule & Roster Hub</h2>
              <p className="text-xs text-slate-400">Class timetable, syllabus progress, and teaching materials</p>
            </div>
            <button
              type="button"
              onClick={() => onNavigateTab('timetable')}
              className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold"
            >
              Interactive Timetable
            </button>
          </div>

          <OfficialTimetableViewer currentUser={currentUser} effectiveRole={effectiveRole as any} />
        </div>
      )}

      {/* =========================================================================
          SUB-SECTION 3: COORDINATOR WORKSPACE
      ========================================================================== */}
      {subSection === 'coordinator_workspace' && isCoordinator && (
        <div className="space-y-6">
          <div className="p-6 rounded-3xl bg-slate-900 border border-white/10 space-y-2">
            <h2 className="text-lg font-bold text-white">Academic Coordination Command</h2>
            <p className="text-xs text-slate-400">
              Authorized grade-level supervision, section coverage tracking, and campus circular alerts for assigned cohorts: {assignedGradesList.join(', ')}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-5 rounded-2xl bg-slate-900 border border-white/10 space-y-3">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-indigo-400" />
                <h3 className="text-sm font-bold text-white">Grade Cohort Supervision</h3>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Supervising educational continuity for {assignedGradesList.join(', ')}. All teacher syllabi updates and attendance sheets are synchronized with your coordinator console.
              </p>
              <button
                type="button"
                onClick={() => onNavigateTab('attendance_manager')}
                className="text-xs text-indigo-400 font-bold hover:underline"
              >
                Inspect Attendance Trends →
              </button>
            </div>

            <div className="p-5 rounded-2xl bg-slate-900 border border-white/10 space-y-3">
              <div className="flex items-center gap-2">
                <Megaphone className="w-4 h-4 text-cyan-400" />
                <h3 className="text-sm font-bold text-white">Academic Bulletins</h3>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Publish grade-specific announcements and alerts directly to student and parent dashboards.
              </p>
              <button
                type="button"
                onClick={() => onNavigateTab('whats_new')}
                className="text-xs text-cyan-400 font-bold hover:underline"
              >
                Post Circular →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          SUB-SECTION 4: CLASSROOMS & ATTENDANCE
      ========================================================================== */}
      {subSection === 'classrooms' && (
        <div className="space-y-6">
          <AttendanceManager currentUser={currentUser} effectiveRole={effectiveRole as any} />
        </div>
      )}

      {/* =========================================================================
          SUB-SECTION 5: TEACHING & ASSESSMENTS (Gradebook & Marks)
      ========================================================================== */}
      {subSection === 'teaching_assessments' && (
        <div className="space-y-6">
          <StudentMarksCenter 
            currentUser={currentUser} 
            effectiveRole={effectiveRole} 
            showNotification={showNotification} 
          />
        </div>
      )}
    </div>
  );
};
