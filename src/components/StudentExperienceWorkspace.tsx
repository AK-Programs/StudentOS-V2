/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Veylentra Student Experience 2.0
 * Integrated daily academic command center combining live official timetable,
 * subject-wise academic hub (syllabus, lecture notes, materials, assignments, marks),
 * assignment & exam readiness center, Recharts analytics + threshold estimate calculator,
 * study space launcher, and deterministic Byte reminders + Orion AI study assistant.
 */

import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'motion/react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell
} from 'recharts';
import {
  Clock,
  ChevronRight,
  Search,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Loader2,
  X,
  Calendar,
  BookOpen,
  SlidersHorizontal,
  FileText,
  ExternalLink,
  Send
} from 'lucide-react';
import {
  UserProfile,
  UserRole,
  Homework,
  Task,
  VaultNote,
  FlashcardDeck,
  GradebookEntry,
  GradebookAssessment,
  AssignmentSubmission,
  AssignmentAttachment
} from '../types';
import {
  OfficialSubjectSyllabus,
  OfficialClassTimetable,
  StudentChapterProgress,
  ExamPreparationPlan,
  TimetablePeriod
} from '../types/syllabusTimetable';
import { SyllabusTimetableService } from '../lib/syllabusTimetableService';
import { getVaultNotes } from '../lib/supabaseNotes';
import { fetchSupabaseDecks, getCanonicalUserId } from '../lib/flashcardStorage';
import { getSupabaseMaterials } from '../lib/supabaseResources';
import { saveSupabaseHomework } from '../lib/supabaseHomework';
import { savePersonalTask } from '../lib/supabaseTasks';
import { supabase } from '../lib/supabase';
import { computeAttendanceSummary, calculateAttendanceProjection } from '../lib/attendanceCalculator';
import {
  buildByteReminders,
  dismissByteReminder,
  markByteReminderHandled,
  snoozeByteReminder
} from '../lib/byteReminderEngine';
import {
  fetchAssignments,
  submitAssignmentWork,
  fetchAssessments,
  fetchGradebookEntries,
  fetchTargetedAnnouncements,
  markTargetedAnnouncementRead,
  isAnnouncementEligibleForUser,
  deriveAssignmentDisplayStatus,
  isStudentMatchedToCohort,
  dispatchAcademicSyncEvent
} from '../lib/academicWorkflowService';
import { VeylentraIcon } from './ui/VeylentraIcon';
import { soundService } from '../lib/soundService';
import { WinterDashboardBanner } from './winter/WinterFestivalHub';
import { XpLeaderboardPanel } from './gamification/XpLeaderboardPanel';
import { awardServerActionXp } from '../lib/winterFestivalService';

export interface StudentExperienceWorkspaceProps {
  currentUser: UserProfile;
  effectiveRole: UserRole;
  homeworkList: Homework[];
  tasks: Task[];
  announcements: any[];
  dueCardsCount?: number;
  onNavigateTab: (tab: string, subTab?: string) => void;
  onOpenOrionFull: (initialQuery?: string) => void;
  showNotification: (msg: string) => void;
}

type StudentSubTab = 'home' | 'subjects' | 'assignments' | 'analytics' | 'study_space';
type AssignmentFilter = 'pending' | 'upcoming' | 'overdue' | 'completed' | 'all';

function parseHHMM(val?: string): number | null {
  if (!val) return null;
  const parts = val.split(':');
  if (parts.length < 2) return null;
  const h = Number(parts[0]);
  const m = Number(parts[1]);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
}

function getDaysDiff(dateStr?: string): number | null {
  if (!dateStr) return null;
  const parsed = new Date(dateStr);
  if (Number.isNaN(parsed.getTime())) return null;
  const now = new Date();
  const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const dueMidnight = new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate()).getTime();
  return Math.round((dueMidnight - todayMidnight) / 86400000);
}

export const StudentExperienceWorkspace: React.FC<StudentExperienceWorkspaceProps> = ({
  currentUser,
  homeworkList,
  tasks,
  announcements,
  dueCardsCount = 0,
  onNavigateTab,
  onOpenOrionFull,
  showNotification
}) => {
  const userId = currentUser?.uid || currentUser?.email || 'student_default';
  const grade = currentUser?.grade || 'Grade 10';
  const schoolId = 'default_school';

  const [subTab, setSubTab] = useState<StudentSubTab>('home');
  const [loading, setLoading] = useState<boolean>(true);

  // Live Domain State
  const [syllabuses, setSyllabuses] = useState<OfficialSubjectSyllabus[]>([]);
  const [progressMap, setProgressMap] = useState<Record<string, StudentChapterProgress>>({});
  const [timetable, setTimetable] = useState<OfficialClassTimetable | null>(null);
  const [exams, setExams] = useState<ExamPreparationPlan[]>([]);
  const [connectedAssignments, setConnectedAssignments] = useState<Array<Homework & { mySubmission?: AssignmentSubmission | null }>>([]);
  const [publishedAssessments, setPublishedAssessments] = useState<GradebookAssessment[]>([]);
  const [notes, setNotes] = useState<VaultNote[]>([]);
  const [materials, setMaterials] = useState<any[]>([]);
  const [decks, setDecks] = useState<FlashcardDeck[]>([]);
  const [attendanceRows, setAttendanceRows] = useState<any[]>([]);
  const [gradeEntries, setGradeEntries] = useState<GradebookEntry[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<any[]>([]);
  const [targetedAnnouncements, setTargetedAnnouncements] = useState<any[]>([]);

  // Inline Assignment Submission Drawer state
  const [activeSubmitHwId, setActiveSubmitHwId] = useState<string | null>(null);
  const [subDrafts, setSubDrafts] = useState<
    Record<string, { text: string; url: string; attachmentName: string; submitting?: boolean; error?: string }>
  >({});

  // UI Filter & Interactive State
  const [selectedSubject, setSelectedSubject] = useState<string>('');
  const [assignmentSearch, setAssignmentSearch] = useState<string>('');
  const [assignmentFilter, setAssignmentFilter] = useState<AssignmentFilter>('pending');
  const [targetAttendancePct, setTargetAttendancePct] = useState<number>(75);
  const [orionQuickQuery, setOrionQuickQuery] = useState<string>('');
  const [orionInlineAnswer, setOrionInlineAnswer] = useState<{ title: string; content: string; provider?: string } | null>(null);
  const [orionLoading, setOrionLoading] = useState<boolean>(false);
  const [orionError, setOrionError] = useState<string | null>(null);
  const [reminderVersion, setReminderVersion] = useState<number>(0);
  const [localCompletedHwIds, setLocalCompletedHwIds] = useState<string[]>([]);

  useEffect(() => {
    let mounted = true;
    async function loadWorkspaceData() {
      setLoading(true);
      try {
        const canonicalId = getCanonicalUserId(userId);
        const [
          syls,
          prog,
          tt,
          officialExams,
          vaultNotes,
          allMaterials,
          userDecks,
          attRes,
          apiGradesRes,
          eventsRes,
          apiHwRes,
          apiAssRes,
          apiAnnRes
        ] = await Promise.all([
          SyllabusTimetableService.getOfficialSyllabuses(schoolId, grade),
          SyllabusTimetableService.getStudentProgress(userId),
          SyllabusTimetableService.getOfficialTimetable(schoolId, grade),
          SyllabusTimetableService.getOfficialExams(schoolId),
          getVaultNotes(userId).catch(() => []),
          getSupabaseMaterials().catch(() => []),
          fetchSupabaseDecks(canonicalId).catch(() => []),
          supabase.from('attendance').select('*').eq('user_id', userId).order('date', { ascending: true }),
          fetchGradebookEntries(currentUser),
          supabase.from('calendar_events').select('*').order('event_date', { ascending: true }).limit(20),
          fetchAssignments(currentUser),
          fetchAssessments(currentUser),
          fetchTargetedAnnouncements(currentUser)
        ]);

        if (!mounted) return;
        setSyllabuses(syls);
        setProgressMap(prog);
        setTimetable(tt);
        setExams(officialExams);
        if (apiHwRes.ok && apiHwRes.data) setConnectedAssignments(apiHwRes.data);
        if (apiAssRes.ok && apiAssRes.data) setPublishedAssessments(apiAssRes.data);
        if (apiAnnRes.ok && apiAnnRes.data) setTargetedAnnouncements(apiAnnRes.data);
        setNotes(vaultNotes || []);
        setMaterials(allMaterials || []);
        setDecks(userDecks || []);
        setAttendanceRows(attRes?.data || []);
        if (apiGradesRes.ok && apiGradesRes.data) {
          setGradeEntries(apiGradesRes.data);
        }
        setCalendarEvents(eventsRes?.data || []);
        if (syls.length > 0 && !selectedSubject) {
          setSelectedSubject(syls[0].subject);
        }
      } catch (err) {
        console.warn('[StudentWorkspace] Data load notice:', err);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    loadWorkspaceData();

    const handleSyncUpdate = async (e: any) => {
      const tbl = e?.detail?.table;
      if (tbl === 'homework' || tbl === 'assignment_submissions') {
        const res = await fetchAssignments(currentUser);
        if (mounted && res.ok && res.data) setConnectedAssignments(res.data);
      }
      if (tbl === 'gradebook_assessments' || tbl === 'gradebook_entries') {
        const [assRes, entRes] = await Promise.all([
          fetchAssessments(currentUser),
          fetchGradebookEntries(currentUser)
        ]);
        if (mounted && assRes.ok && assRes.data) setPublishedAssessments(assRes.data);
        if (mounted && entRes.ok && entRes.data) setGradeEntries(entRes.data);
      }
      if (tbl === 'announcements') {
        const annRes = await fetchTargetedAnnouncements(currentUser);
        if (mounted && annRes.ok && annRes.data) setTargetedAnnouncements(annRes.data);
      }
      if (tbl === 'attendance') {
        const { data } = await supabase.from('attendance').select('*').eq('user_id', userId).order('date', { ascending: true });
        if (mounted && data) setAttendanceRows(data);
      }
    };
    window.addEventListener('studentos-db-update', handleSyncUpdate);

    return () => {
      mounted = false;
      window.removeEventListener('studentos-db-update', handleSyncUpdate);
    };
  }, [userId, grade, currentUser]);

  // Subject Summaries from Syllabus Service
  const subjectSummaries = useMemo(
    () => SyllabusTimetableService.computeSubjectSummaries(syllabuses, progressMap),
    [syllabuses, progressMap]
  );

  // Scoped Published Homework merged with live submission & evaluation state
  const studentHomework = useMemo(() => {
    const mergedMap = new Map<string, Homework & { mySubmission?: AssignmentSubmission | null }>();
    homeworkList.forEach(hw => {
      if ((hw.status || 'published') !== 'published') return;
      if (!isStudentMatchedToCohort(currentUser?.grade, currentUser?.section, hw.classGrade, hw.classSection)) return;
      mergedMap.set(hw.id, hw);
    });
    connectedAssignments.forEach(hw => {
      if ((hw.status || 'published') !== 'published') return;
      if (!isStudentMatchedToCohort(currentUser?.grade, currentUser?.section, hw.classGrade, hw.classSection)) return;
      const prev = mergedMap.get(hw.id);
      mergedMap.set(hw.id, { ...prev, ...hw });
    });
    return Array.from(mergedMap.values());
  }, [homeworkList, connectedAssignments, currentUser?.grade, currentUser?.section]);

  const studentSubmissionsList = useMemo(
    () => studentHomework.map(hw => hw.mySubmission).filter(Boolean) as AssignmentSubmission[],
    [studentHomework]
  );

  const isHwCompleted = (hw: Homework & { mySubmission?: AssignmentSubmission | null }) => {
    if (hw.mySubmission) {
      if (hw.mySubmission.status === 'returned_for_revision') return false;
      return true;
    }
    return localCompletedHwIds.includes(hw.id) || (hw.completedList || []).includes(userId);
  };

  const pendingHomework = useMemo(
    () => studentHomework.filter(hw => !isHwCompleted(hw)),
    [studentHomework, localCompletedHwIds, userId]
  );

  const filteredAssignments = useMemo(() => {
    const q = assignmentSearch.trim().toLowerCase();
    return studentHomework
      .filter(hw => {
        if (q) {
          const match =
            (hw.title || '').toLowerCase().includes(q) ||
            (hw.subject || '').toLowerCase().includes(q) ||
            (hw.content || '').toLowerCase().includes(q);
          if (!match) return false;
        }
        const done = isHwCompleted(hw);
        const daysLeft = getDaysDiff(hw.dueDate);
        if (assignmentFilter === 'pending') return !done;
        if (assignmentFilter === 'completed') return done;
        if (assignmentFilter === 'overdue') return !done && daysLeft !== null && daysLeft < 0;
        if (assignmentFilter === 'upcoming') return !done && daysLeft !== null && daysLeft >= 0 && daysLeft <= 3;
        return true;
      })
      .sort((a, b) => (getDaysDiff(a.dueDate) ?? 999) - (getDaysDiff(b.dueDate) ?? 999));
  }, [studentHomework, assignmentSearch, assignmentFilter, localCompletedHwIds, userId]);

  // Attendance summary & projection calculator
  const attendanceStats = useMemo(() => computeAttendanceSummary(attendanceRows), [attendanceRows]);
  const attendanceProjection = useMemo(
    () =>
      calculateAttendanceProjection(
        attendanceStats.effectivePresent,
        attendanceStats.totalConducted,
        targetAttendancePct
      ),
    [attendanceStats.effectivePresent, attendanceStats.totalConducted, targetAttendancePct]
  );

  // Compute live / next period from Official Timetable
  const liveScheduleInfo = useMemo(() => {
    if (!timetable?.schedule?.length) return null;
    const now = new Date();
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const todayName = dayNames[now.getDay()];
    const todaySch = timetable.schedule.find(d => d.day.toLowerCase() === todayName.toLowerCase());

    if (!todaySch || todaySch.periods.length === 0) {
      // Fall back to next instructional day (e.g. Monday on weekend)
      const monday = timetable.schedule.find(d => d.day === 'Monday') || timetable.schedule[0];
      const firstPeriod = monday?.periods.find(p => !p.isBreak && p.subject) || null;
      return {
        isToday: false,
        dayLabel: monday?.day || 'Monday',
        statusLabel: 'Next School Day',
        activePeriod: firstPeriod,
        todayPeriods: [] as TimetablePeriod[]
      };
    }

    const nowMins = now.getHours() * 60 + now.getMinutes();
    const instructionalPeriods = todaySch.periods.filter(p => !p.isBreak && p.subject);
    const currentOrNext =
      instructionalPeriods.find(p => {
        const end = parseHHMM(p.endTime);
        return end !== null && end > nowMins;
      }) || null;

    let statusLabel = 'Completed for Today';
    if (currentOrNext) {
      const start = parseHHMM(currentOrNext.startTime);
      if (start !== null && start <= nowMins) {
        statusLabel = 'In Progress Now';
      } else if (start !== null) {
        statusLabel = `Starts in ${start - nowMins} min`;
      } else {
        statusLabel = 'Upcoming Today';
      }
    }

    return {
      isToday: true,
      dayLabel: todayName,
      statusLabel,
      activePeriod: currentOrNext,
      todayPeriods: todaySch.periods
    };
  }, [timetable]);

  const eligibleAnnouncements = useMemo(() => {
    const map = new Map<string, any>();
    [...targetedAnnouncements, ...(announcements || [])].forEach(a => {
      if (a && a.id && isAnnouncementEligibleForUser(a, currentUser)) {
        if (!map.has(a.id)) map.set(a.id, a);
      }
    });
    return Array.from(map.values());
  }, [targetedAnnouncements, announcements, currentUser]);

  // Deterministic Byte Reminders (connected with real submissions & published assessments)
  const byteReminders = useMemo(
    () =>
      buildByteReminders({
        currentUser,
        effectiveRole: 'student',
        homeworkList: studentHomework,
        submissions: studentSubmissionsList,
        assessments: publishedAssessments,
        tasks,
        announcements: eligibleAnnouncements,
        dueCardsCount,
        attendancePercentage: attendanceStats.percentage,
        attendanceTotalConducted: attendanceStats.totalConducted,
        timetable,
        upcomingExams: exams
      }),
    [
      currentUser,
      studentHomework,
      studentSubmissionsList,
      publishedAssessments,
      tasks,
      eligibleAnnouncements,
      dueCardsCount,
      attendanceStats.percentage,
      attendanceStats.totalConducted,
      timetable,
      exams,
      reminderVersion
    ]
  );

  // Average Marks Percentage
  const marksSummary = useMemo(() => {
    if (gradeEntries.length === 0) return null;
    const avg = gradeEntries.reduce((acc, g) => acc + Number(g.percentage || 0), 0) / gradeEntries.length;
    return {
      average: Number(avg.toFixed(1)),
      count: gradeEntries.length,
      latest: gradeEntries[0]
    };
  }, [gradeEntries]);

  // Chart datasets (Real data only)
  const subjectChartData = useMemo(
    () =>
      subjectSummaries.map(s => ({
        subject: s.subject.length > 11 ? `${s.subject.slice(0, 10)}.` : s.subject,
        fullSubject: s.subject,
        progress: s.progressPercentage
      })),
    [subjectSummaries]
  );

  const marksChartData = useMemo(() => {
    const bySubj: Record<string, { sum: number; count: number }> = {};
    gradeEntries.forEach(entry => {
      const k = entry.subject || 'General';
      if (!bySubj[k]) bySubj[k] = { sum: 0, count: 0 };
      bySubj[k].sum += Number(entry.percentage || 0);
      bySubj[k].count += 1;
    });
    return Object.entries(bySubj).map(([subject, stat]) => ({
      subject: subject.length > 11 ? `${subject.slice(0, 10)}.` : subject,
      score: Math.round(stat.sum / stat.count)
    }));
  }, [gradeEntries]);

  // Active Subject Drilldown Data
  const activeSubjectSyllabus = useMemo(
    () =>
      syllabuses.find(s => s.subject.toLowerCase() === (selectedSubject || '').toLowerCase()) ||
      syllabuses[0] ||
      null,
    [syllabuses, selectedSubject]
  );

  const activeSubjectNotes = useMemo(() => {
    const target = (activeSubjectSyllabus?.subject || selectedSubject || '').toLowerCase();
    return notes.filter(n => !target || (n.subject || '').toLowerCase().includes(target));
  }, [notes, activeSubjectSyllabus, selectedSubject]);

  const activeSubjectMaterials = useMemo(() => {
    const target = (activeSubjectSyllabus?.subject || selectedSubject || '').toLowerCase();
    return materials.filter(m => !target || (m.subject || '').toLowerCase().includes(target));
  }, [materials, activeSubjectSyllabus, selectedSubject]);

  const activeSubjectHomework = useMemo(() => {
    const target = (activeSubjectSyllabus?.subject || selectedSubject || '').toLowerCase();
    return studentHomework.filter(h => !target || (h.subject || '').toLowerCase().includes(target));
  }, [studentHomework, activeSubjectSyllabus, selectedSubject]);

  const activeSubjectMarks = useMemo(() => {
    const target = (activeSubjectSyllabus?.subject || selectedSubject || '').toLowerCase();
    return gradeEntries.filter(g => !target || (g.subject || '').toLowerCase().includes(target));
  }, [gradeEntries, activeSubjectSyllabus, selectedSubject]);

  // Handlers
  const handleToggleHomeworkDone = async (hw: Homework) => {
    soundService.playButtonClick();
    const currentlyDone = isHwCompleted(hw);
    const updatedCompletedList = currentlyDone
      ? (hw.completedList || []).filter(id => id !== userId)
      : Array.from(new Set([...(hw.completedList || []), userId]));

    setLocalCompletedHwIds(prev =>
      currentlyDone ? prev.filter(id => id !== hw.id) : Array.from(new Set([...prev, hw.id]))
    );

    try {
      await saveSupabaseHomework({ ...hw, completedList: updatedCompletedList });
      showNotification(currentlyDone ? 'Marked assignment pending.' : '✓ Assignment marked complete.');
    } catch {
      showNotification('Updated assignment state locally.');
    }
  };

  const handleSubmitAssignmentWork = async (hw: Homework) => {
    const draft = subDrafts[hw.id] || { text: '', url: '', attachmentName: '' };
    if (draft.submitting) return; // Prevent duplicate rapid submission
    if (!draft.text.trim() && !draft.url.trim()) {
      setSubDrafts(prev => ({
        ...prev,
        [hw.id]: { ...draft, error: 'Please write response notes or attach a link before submitting.' }
      }));
      return;
    }

    setSubDrafts(prev => ({ ...prev, [hw.id]: { ...draft, submitting: true, error: undefined } }));
    soundService.playButtonClick();

    const res = await submitAssignmentWork(currentUser, hw.id, {
      submissionText: draft.text.trim(),
      attachmentUrl: draft.url.trim(),
      attachmentName: draft.attachmentName.trim() || (draft.url.trim() ? 'Submitted Link' : '')
    });

    if (!res.ok || !res.data) {
      setSubDrafts(prev => ({
        ...prev,
        [hw.id]: { ...draft, submitting: false, error: res.error || 'Submission failed. Please retry.' }
      }));
      return;
    }

    setConnectedAssignments(prev => {
      const idx = prev.findIndex(item => item.id === hw.id);
      const updatedItem = { ...hw, mySubmission: res.data! };
      if (idx >= 0) {
        const clone = [...prev];
        clone[idx] = { ...clone[idx], mySubmission: res.data! };
        return clone;
      }
      return [updatedItem, ...prev];
    });
    setLocalCompletedHwIds(prev => Array.from(new Set([...prev, hw.id])));
    setSubDrafts(prev => ({
      ...prev,
      [hw.id]: { ...draft, submitting: false, error: undefined }
    }));
    setActiveSubmitHwId(null);
    void awardServerActionXp(currentUser, 'complete_homework', hw.id);
    showNotification(
      res.data.isLate
        ? `✓ Late work submitted for "${hw.title}". Your teacher has been notified.`
        : `✓ Assignment "${hw.title}" submitted successfully!`
    );
  };

  const handleCreateExamStudyTask = async (title: string, subject: string) => {
    soundService.playButtonClick();
    const task: Task = {
      id: `task-exam-${Date.now()}`,
      title: `Prep ${subject}: ${title}`,
      completed: false,
      priority: 'high',
      dueDate: new Date().toISOString().split('T')[0],
      category: 'Study'
    };
    try {
      await savePersonalTask(task, userId);
      dispatchAcademicSyncEvent('tasks', 'INSERT', task);
      showNotification(`✓ Added "${task.title}" to your Study Planner tasks.`);
    } catch {
      showNotification('Could not save task right now.');
    }
  };

  const handleToggleChapterDone = async (chapterId: string, subject: string) => {
    soundService.playButtonClick();
    const existing = progressMap[chapterId];
    const nextStatus = existing?.status === 'completed' ? 'in_progress' : 'completed';
    const updated = await SyllabusTimetableService.updateStudentChapterProgress(userId, chapterId, subject, {
      status: nextStatus,
      lastStudiedAt: new Date().toISOString()
    });
    setProgressMap(prev => ({ ...prev, [chapterId]: updated }));
    showNotification(nextStatus === 'completed' ? '✓ Chapter marked completed.' : 'Chapter status set to in progress.');
  };

  const handleAskOrionInline = async (
    intent:
      | 'student_explain'
      | 'student_summarize'
      | 'student_study_plan'
      | 'student_breakdown_assignment'
      | 'student_understand_feedback'
      | 'student_prep_assessment',
    subject: string,
    topic: string,
    contextData?: string
  ) => {
    soundService.playButtonClick();
    setOrionLoading(true);
    setOrionError(null);
    setOrionInlineAnswer(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      const resp = await fetch('/api/ai/orion-assist', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {})
        },
        body: JSON.stringify({
          userId,
          userRole: 'student',
          intent,
          subject,
          grade,
          topic,
          contextData
        })
      });
      const data = await resp.json();
      if (!resp.ok || !data.success || !data.text) {
        throw new Error(data.error || 'Orion is temporarily unavailable.');
      }
      setOrionInlineAnswer({
        title: `${subject}: ${topic}`,
        content: data.text,
        provider: data.providerUsed ? `${data.providerUsed} (${data.modelUsed || ''})` : undefined
      });
      setSubTab('home');
    } catch (err: any) {
      setOrionError(err?.message || 'Could not reach Orion right now.');
    } finally {
      setOrionLoading(false);
    }
  };

  const navItems: Array<{ id: StudentSubTab; label: string; iconName: 'dashboard' | 'syllabus' | 'homework' | 'analytics' | 'study_hub' }> = [
    { id: 'home', label: 'Command Center', iconName: 'dashboard' },
    { id: 'subjects', label: 'Academic Hub', iconName: 'syllabus' },
    { id: 'assignments', label: 'Assignments & Exams', iconName: 'homework' },
    { id: 'analytics', label: 'Attendance & Marks', iconName: 'analytics' },
    { id: 'study_space', label: 'Study Space & Calendar', iconName: 'study_hub' }
  ];

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto py-20 flex flex-col items-center justify-center space-y-3">
        <Loader2 className="w-7 h-7 text-blue-400 animate-spin" />
        <p className="text-xs text-slate-400 font-medium">Loading academic workspace...</p>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="max-w-7xl mx-auto space-y-5 pb-12"
    >
      {/* Clean Student Workspace Header */}
      <div className="bento-card rounded-2xl p-5 sm:p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
            <span className="font-semibold text-blue-400">Student Workspace</span>
            <span aria-hidden="true">·</span>
            <span className="text-slate-200 font-medium">{grade}{currentUser.section ? ` (${currentUser.section})` : ''}</span>
            {currentUser.house && (
              <>
                <span aria-hidden="true">·</span>
                <span>{currentUser.house} House</span>
              </>
            )}
          </div>
          <h1 className="text-xl sm:text-2xl font-bold font-display text-white tracking-tight">
            Welcome back, {currentUser.name || 'Student'}
          </h1>
          <p className="text-xs text-slate-400">
            Track today&apos;s classes, syllabus progress, pending deadlines, attendance standing, and exam readiness.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => onNavigateTab('notes')}
            className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-white/10 text-xs font-semibold text-slate-200 flex items-center gap-2 cursor-pointer"
          >
            <VeylentraIcon name="notes" size="xs" />
            <span>Lecture Notes</span>
          </button>
          <button
            type="button"
            onClick={() => onNavigateTab('brain_battle')}
            className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-white/10 text-xs font-semibold text-slate-200 flex items-center gap-2 cursor-pointer"
          >
            <VeylentraIcon name="brain_battle" size="xs" />
            <span>Brain Battle</span>
          </button>
          <button
            type="button"
            onClick={() => onOpenOrionFull()}
            className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center gap-2 cursor-pointer"
          >
            <VeylentraIcon name="orion" size="xs" />
            <span>Open Orion</span>
          </button>
        </div>
      </div>

      {/* Sub-Navigation Bar */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-white/10">
        {navItems.map(item => {
          const active = subTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                soundService.playButtonClick();
                setSubTab(item.id);
              }}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-colors shrink-0 cursor-pointer ${
                active
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <VeylentraIcon name={item.iconName} size="xs" />
              <span>{item.label}</span>
              {item.id === 'assignments' && pendingHomework.length > 0 && (
                <span className="px-1.5 py-0.5 rounded bg-black/25 font-mono text-[10px] tabular-nums">
                  {pendingHomework.length}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Inline Orion Result Panel (with loading, error/retry, dismiss) */}
      {(orionLoading || orionError || orionInlineAnswer) && (
        <div className="bento-card rounded-2xl p-4 sm:p-5 border border-teal-500/30 bg-slate-950/80 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <VeylentraIcon name="orion" size="sm" />
              <div>
                <h3 className="text-sm font-bold text-white">
                  {orionInlineAnswer ? orionInlineAnswer.title : 'Orion Study Assistant'}
                </h3>
                {orionInlineAnswer?.provider && (
                  <p className="text-[11px] text-slate-400">Generated via {orionInlineAnswer.provider}</p>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setOrionInlineAnswer(null);
                setOrionError(null);
              }}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 cursor-pointer"
              aria-label="Close Orion answer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {orionLoading && (
            <div className="py-4 flex items-center gap-2 text-xs text-slate-300">
              <Loader2 className="w-4 h-4 text-teal-400 animate-spin" />
              <span>Preparing structured explanation...</span>
            </div>
          )}

          {orionError && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-between text-xs text-rose-200">
              <span>{orionError}</span>
              <button
                type="button"
                onClick={() => onOpenOrionFull(orionQuickQuery)}
                className="px-2.5 py-1 rounded-lg bg-rose-500/20 text-white font-semibold cursor-pointer"
              >
                Open Full Orion
              </button>
            </div>
          )}

          {orionInlineAnswer && (
            <div className="space-y-3">
              <div className="text-xs text-slate-200 leading-relaxed whitespace-pre-wrap max-h-72 overflow-y-auto bg-slate-900/70 p-3.5 rounded-xl border border-white/5">
                {orionInlineAnswer.content}
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => onOpenOrionFull(`Continue helping with ${orionInlineAnswer.title}`)}
                  className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold cursor-pointer"
                >
                  Continue in Orion
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ================================================================== */}
      {/* TAB 1: STUDENT COMMAND CENTER                                      */}
      {/* ================================================================== */}
      {subTab === 'home' && (
        <div className="space-y-5">
          {/* Top KPI Summary Row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bento-card rounded-2xl p-4 space-y-1.5">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Live / Next Class</span>
                <Clock className="w-3.5 h-3.5 text-blue-400" />
              </div>
              <p className="text-base font-bold text-white truncate">
                {liveScheduleInfo?.activePeriod?.subject || 'No Upcoming Class'}
              </p>
              <p className="text-[11px] text-slate-400 truncate">
                {liveScheduleInfo?.activePeriod
                  ? `${liveScheduleInfo.dayLabel} · ${liveScheduleInfo.activePeriod.startTime}–${liveScheduleInfo.activePeriod.endTime}`
                  : 'All scheduled classes complete today'}
              </p>
            </div>

            <div className="bento-card rounded-2xl p-4 space-y-1.5">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Pending Assignments</span>
                <VeylentraIcon name="homework" size="xs" />
              </div>
              <p className="text-2xl font-bold text-white tabular-nums">{pendingHomework.length}</p>
              <p className="text-[11px] text-slate-400 truncate">
                {pendingHomework[0]?.dueDate
                  ? `Next due ${pendingHomework[0].dueDate}`
                  : 'No urgent homework queued'}
              </p>
            </div>

            <div className="bento-card rounded-2xl p-4 space-y-1.5">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Recorded Attendance</span>
                <VeylentraIcon name="attendance" size="xs" />
              </div>
              <p
                className={`text-2xl font-bold tabular-nums ${
                  attendanceStats.totalConducted > 0 && attendanceStats.percentage < 75
                    ? 'text-amber-400'
                    : 'text-emerald-400'
                }`}
              >
                {attendanceStats.totalConducted > 0 ? `${attendanceStats.percentage}%` : 'No Records'}
              </p>
              <p className="text-[11px] text-slate-400">
                {attendanceStats.totalConducted > 0
                  ? `${attendanceStats.effectivePresent}/${attendanceStats.totalConducted} sessions attended`
                  : 'Awaiting attendance entries'}
              </p>
            </div>

            <div className="bento-card rounded-2xl p-4 space-y-1.5">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Marks / Active Recall</span>
                <VeylentraIcon name="quiz" size="xs" />
              </div>
              <p className="text-2xl font-bold text-white tabular-nums">
                {marksSummary ? `${marksSummary.average}%` : `${dueCardsCount} due`}
              </p>
              <p className="text-[11px] text-slate-400">
                {marksSummary
                  ? `Across ${marksSummary.count} graded assessment${marksSummary.count === 1 ? '' : 's'}`
                  : `${decks.length} flashcard deck${decks.length === 1 ? '' : 's'} synced`}
              </p>
            </div>
          </div>

          {/* Low attendance alert if < 75% and real records exist */}
          {attendanceStats.totalConducted > 0 && attendanceStats.percentage < 75 && (
            <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-2.5 text-xs text-amber-200">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-white">Attendance Threshold Alert ({attendanceStats.percentage}%)</p>
                  <p className="text-[11px] text-amber-200/90 mt-0.5">
                    Estimated {attendanceProjection.classesNeededForTarget} consecutive session(s) needed to reach 75% (planning estimate).
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSubTab('analytics')}
                className="px-3 py-1.5 rounded-lg bg-amber-500 text-slate-950 text-xs font-bold shrink-0 cursor-pointer"
              >
                Open Calculator
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Left 2 Columns: Timetable Schedule + Subject Progress Chart + Quick Orion */}
            <div className="lg:col-span-2 space-y-5">
              {/* Today's Official Periods Strip */}
              <div className="bento-card rounded-2xl p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-bold text-white">
                      {liveScheduleInfo?.isToday ? `Today's Schedule (${liveScheduleInfo.dayLabel})` : 'Official School Schedule'}
                    </h2>
                    <p className="text-xs text-slate-400">{liveScheduleInfo?.statusLabel || 'Synchronized with school timetable'}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onNavigateTab('timetable_viewer')}
                    className="text-xs font-semibold text-blue-400 hover:text-blue-300 flex items-center gap-1 cursor-pointer"
                  >
                    <span>Full Timetable</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                {liveScheduleInfo && liveScheduleInfo.todayPeriods.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                    {liveScheduleInfo.todayPeriods
                      .filter(p => !p.isBreak)
                      .slice(0, 6)
                      .map(period => {
                        const isNext = liveScheduleInfo.activePeriod?.periodNumber === period.periodNumber;
                        return (
                          <div
                            key={period.periodNumber}
                            className={`p-3 rounded-xl border text-xs ${
                              isNext
                                ? 'bg-blue-600/15 border-blue-500/50 text-white'
                                : 'bg-slate-950/70 border-white/10 text-slate-300'
                            }`}
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-mono text-[11px] text-blue-400 font-semibold">
                                P{period.periodNumber} · {period.startTime}
                              </span>
                              {isNext && (
                                <span className="text-[10px] font-bold text-emerald-300">Current/Next</span>
                              )}
                            </div>
                            <p className="font-bold text-white truncate">{period.subject}</p>
                            <p className="text-[11px] text-slate-400 truncate">
                              {period.room || 'Classroom'}{period.teacherName ? ` · ${period.teacherName}` : ''}
                            </p>
                          </div>
                        );
                      })}
                  </div>
                ) : (
                  <div className="p-4 rounded-xl bg-slate-950/60 border border-white/10 text-xs text-slate-400 flex items-center justify-between">
                    <span>
                      {liveScheduleInfo?.activePeriod
                        ? `Next instructional day (${liveScheduleInfo.dayLabel}) begins with ${liveScheduleInfo.activePeriod.subject} at ${liveScheduleInfo.activePeriod.startTime}.`
                        : 'No instructional periods scheduled today.'}
                    </span>
                    <button
                      type="button"
                      onClick={() => onNavigateTab('timetable_viewer')}
                      className="text-blue-400 font-semibold cursor-pointer shrink-0 ml-2"
                    >
                      View Week
                    </button>
                  </div>
                )}
              </div>

              {/* Subject Mastery Progress Visualization (Recharts) */}
              <div className="bento-card rounded-2xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-bold text-white">Subject Syllabus Progress</h2>
                    <p className="text-xs text-slate-400">Based on completed &amp; revised syllabus chapters</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSubTab('subjects')}
                    className="text-xs font-semibold text-blue-400 hover:text-blue-300 flex items-center gap-1 cursor-pointer"
                  >
                    <span>Explore Subjects</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                {subjectChartData.length > 0 ? (
                  <div className="h-48 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={subjectChartData} margin={{ top: 6, right: 8, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.12)" vertical={false} />
                        <XAxis dataKey="subject" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                        <YAxis domain={[0, 100]} tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                        <Tooltip
                          formatter={(value: any) => [`${value}%`, 'Mastery']}
                          contentStyle={{
                            backgroundColor: '#0f172a',
                            borderColor: 'rgba(255,255,255,0.12)',
                            borderRadius: '10px',
                            fontSize: '12px',
                            color: '#f8fafc'
                          }}
                        />
                        <Bar dataKey="progress" radius={[6, 6, 0, 0]} barSize={32}>
                          {subjectChartData.map((_, idx) => (
                            <Cell key={idx} fill={idx % 2 === 0 ? '#2563eb' : '#0d9488'} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 py-6 text-center">No published syllabus subjects found for {grade}.</p>
                )}
              </div>

              {/* Orion Contextual Study Prompt Bar */}
              <form
                onSubmit={e => {
                  e.preventDefault();
                  const q = orionQuickQuery.trim();
                  if (!q) return;
                  handleAskOrionInline('student_explain', selectedSubject || 'General Studies', q);
                }}
                className="bento-card rounded-2xl p-4 flex flex-col sm:flex-row items-stretch sm:items-center gap-3"
              >
                <div className="flex items-center gap-2.5 flex-1">
                  <VeylentraIcon name="orion" size="sm" />
                  <input
                    type="text"
                    value={orionQuickQuery}
                    onChange={e => setOrionQuickQuery(e.target.value)}
                    placeholder="Ask Orion to explain a concept, summarize notes, or plan study..."
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="submit"
                    disabled={!orionQuickQuery.trim() || orionLoading}
                    className="px-3.5 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-semibold disabled:opacity-50 cursor-pointer"
                  >
                    Quick Answer
                  </button>
                  <button
                    type="button"
                    onClick={() => onOpenOrionFull(orionQuickQuery.trim() || undefined)}
                    className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-white/10 text-slate-200 text-xs font-semibold cursor-pointer"
                  >
                    Full Orion
                  </button>
                </div>
              </form>
            </div>

            {/* Right Column: Byte Deterministic Reminders + Contextual Study Recommendations */}
            <div className="space-y-5">
              {/* Byte Smart Reminders Strip */}
              <div className="bento-card rounded-2xl p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <VeylentraIcon name="byte" size="sm" />
                    <div>
                      <h3 className="text-sm font-bold text-white">Byte Reminders</h3>
                      <p className="text-[11px] text-slate-400">Live priority actions</p>
                    </div>
                  </div>
                  <span className="text-xs font-mono text-slate-400 tabular-nums">{byteReminders.length}</span>
                </div>

                <div className="space-y-2.5">
                  {byteReminders.slice(0, 4).map(rem => (
                    <div
                      key={rem.id}
                      className="p-3 rounded-xl bg-slate-950/80 border border-white/10 space-y-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <span
                            className={`text-[10px] font-bold uppercase tracking-wider ${
                              rem.priority === 'urgent'
                                ? 'text-rose-400'
                                : rem.priority === 'high'
                                ? 'text-amber-400'
                                : 'text-blue-400'
                            }`}
                          >
                            {rem.priority} · {rem.type.replace('_', ' ')}
                          </span>
                          <p className="text-xs font-bold text-white mt-0.5 leading-snug">{rem.title}</p>
                        </div>
                      </div>
                      <p className="text-[11px] text-slate-400 leading-relaxed">{rem.reason}</p>
                      <div className="flex flex-wrap items-center justify-between gap-1.5 pt-1">
                        <button
                          type="button"
                          onClick={() => onNavigateTab(rem.actionTab, rem.actionSubTab)}
                          className="px-2.5 py-1 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 text-[11px] font-semibold cursor-pointer"
                        >
                          {rem.actionLabel}
                        </button>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              snoozeByteReminder(userId, rem.id, 60 * 60 * 1000);
                              setReminderVersion(v => v + 1);
                              showNotification('Snoozed reminder for 1 hour.');
                            }}
                            className="px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-[10px] text-slate-400 hover:text-white cursor-pointer"
                          >
                            Snooze 1h
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              markByteReminderHandled(userId, rem.id);
                              setReminderVersion(v => v + 1);
                            }}
                            className="px-2 py-1 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-[10px] text-emerald-300 cursor-pointer"
                          >
                            Done
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              dismissByteReminder(userId, rem.id);
                              setReminderVersion(v => v + 1);
                            }}
                            className="p-1 rounded-lg text-slate-500 hover:text-white cursor-pointer"
                            aria-label="Dismiss reminder"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                  {byteReminders.length === 0 && (
                    <div className="p-4 text-center rounded-xl bg-slate-950/50 border border-dashed border-white/10 text-xs text-slate-400">
                      All active reminders handled.
                    </div>
                  )}
                </div>
              </div>

              {/* Contextual Next Study Recommendations */}
              <div className="bento-card rounded-2xl p-5 space-y-3">
                <h3 className="text-sm font-bold text-white">Recommended Next Steps</h3>
                <div className="space-y-2">
                  {subjectSummaries
                    .filter(s => s.nextRecommendedChapter)
                    .slice(0, 3)
                    .map(summary => (
                      <button
                        type="button"
                        key={summary.subject}
                        onClick={() => {
                          setSelectedSubject(summary.subject);
                          setSubTab('subjects');
                        }}
                        className="w-full text-left p-3 rounded-xl bg-slate-950/75 border border-white/10 hover:border-blue-500/40 transition-colors cursor-pointer"
                      >
                        <div className="flex items-center justify-between text-[11px] font-semibold text-blue-400">
                          <span>{summary.subject}</span>
                          <span className="tabular-nums">{summary.progressPercentage}%</span>
                        </div>
                        <p className="text-xs font-bold text-white mt-0.5 truncate">
                          Ch {summary.nextRecommendedChapter?.chapterNumber}: {summary.nextRecommendedChapter?.title}
                        </p>
                        <p className="text-[11px] text-slate-400 truncate mt-0.5">
                          {summary.nextRecommendedChapter?.reason}
                        </p>
                      </button>
                    ))}
                </div>
              </div>

              {/* Scoped Academic Circulars & Announcements */}
              <div className="bento-card rounded-2xl p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-white">Academic Circulars</h3>
                  <span className="text-[11px] font-mono text-slate-400">{eligibleAnnouncements.length}</span>
                </div>
                {eligibleAnnouncements.length === 0 ? (
                  <p className="text-xs text-slate-400">No active circulars for your cohort.</p>
                ) : (
                  <div className="space-y-2">
                    {eligibleAnnouncements.slice(0, 3).map(ann => (
                      <div key={ann.id} className="p-3 rounded-xl bg-slate-950/75 border border-white/10 space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[10px] font-bold uppercase text-teal-300">
                            {ann.targetSubject || ann.tag || 'Circular'}
                          </span>
                          <span className="text-[10px] text-slate-500">{ann.date || 'Active'}</span>
                        </div>
                        <p className="text-xs font-bold text-white leading-snug">{ann.title}</p>
                        <p className="text-[11px] text-slate-400 line-clamp-2">{ann.content}</p>
                        {!ann.isRead && (
                          <button
                            type="button"
                            onClick={async () => {
                              await markTargetedAnnouncementRead(currentUser, ann.id);
                              setTargetedAnnouncements(prev => prev.map(x => x.id === ann.id ? { ...x, isRead: true } : x));
                              setReminderVersion(v => v + 1);
                            }}
                            className="px-2.5 py-1 rounded-lg bg-teal-600/20 hover:bg-teal-600/30 text-teal-300 text-[10px] font-semibold cursor-pointer"
                          >
                            Mark as Read
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <WinterDashboardBanner
            currentUser={currentUser}
            showNotification={(msg) => showNotification(msg)}
            onNavigateTab={(t) => onNavigateTab(t)}
          />

          <XpLeaderboardPanel
            type="student"
            compact
            maxRows={5}
            currentUser={currentUser}
            onViewFull={() => onNavigateTab('leaderboard')}
          />
        </div>
      )}

      {/* ================================================================== */}
      {/* TAB 2: ACADEMIC HUB (SUBJECT WORKSPACES & CHAPTER TRACKER)         */}
      {/* ================================================================== */}
      {subTab === 'subjects' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Subject List */}
          <div className="bento-card rounded-2xl p-4 space-y-2.5 h-fit">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider px-1">
              Curriculum Subjects ({grade})
            </h2>
            {subjectSummaries.map(s => {
              const isSelected = (activeSubjectSyllabus?.subject || '').toLowerCase() === s.subject.toLowerCase();
              return (
                <button
                  type="button"
                  key={s.subject}
                  onClick={() => {
                    soundService.playButtonClick();
                    setSelectedSubject(s.subject);
                  }}
                  className={`w-full text-left p-3.5 rounded-xl border transition-colors cursor-pointer space-y-2 ${
                    isSelected
                      ? 'bg-blue-600/15 border-blue-500/50 text-white'
                      : 'bg-slate-950/70 border-white/10 text-slate-300 hover:border-white/25'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-white">{s.subject}</span>
                    <span className="text-xs font-mono font-bold text-blue-400 tabular-nums">{s.progressPercentage}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden">
                    <div className="h-full bg-teal-500 transition-all" style={{ width: `${s.progressPercentage}%` }} />
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-400 tabular-nums">
                    <span>{s.completedCount + s.revisedCount}/{s.totalChapters} chapters</span>
                    {s.upcomingExamDate && <span>Exam {s.upcomingExamDate}</span>}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Selected Subject Workspace */}
          <div className="lg:col-span-2 space-y-5">
            {activeSubjectSyllabus ? (
              <>
                <div className="bento-card rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <span className="text-xs font-semibold text-blue-400">
                      {activeSubjectSyllabus.grade} · {activeSubjectSyllabus.board || 'Official Curriculum'}
                    </span>
                    <h2 className="text-xl font-bold text-white mt-0.5">{activeSubjectSyllabus.subject}</h2>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {activeSubjectNotes.length} notes · {activeSubjectMaterials.length} class files · {activeSubjectHomework.length} assignments
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        handleAskOrionInline(
                          'student_summarize',
                          activeSubjectSyllabus.subject,
                          `${activeSubjectSyllabus.subject} Key Concepts`,
                          activeSubjectSyllabus.chapters.map(c => `Ch ${c.chapterNumber}: ${c.title} (${c.topics.join(', ')})`).join('\n')
                        )
                      }
                      className="px-3 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-semibold cursor-pointer"
                    >
                      Summarize Subject
                    </button>
                    <button
                      type="button"
                      onClick={() => onNavigateTab('notes')}
                      className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-white/10 text-xs font-semibold text-slate-200 cursor-pointer"
                    >
                      Open Lecture Notes
                    </button>
                  </div>
                </div>

                {/* Syllabus Chapters */}
                <div className="bento-card rounded-2xl p-5 space-y-3">
                  <h3 className="text-sm font-bold text-white">Syllabus Chapters &amp; Readiness</h3>
                  <div className="space-y-2.5">
                    {activeSubjectSyllabus.chapters.map(ch => {
                      const prog = progressMap[ch.id];
                      const done = prog?.status === 'completed' || prog?.status === 'revised' || prog?.status === 'mastered';
                      return (
                        <div
                          key={ch.id}
                          className="p-3.5 rounded-xl bg-slate-950/75 border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                        >
                          <div className="space-y-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-mono text-blue-400 font-semibold">
                                Ch {ch.chapterNumber}
                              </span>
                              <span className="text-xs font-bold text-white truncate">{ch.title}</span>
                            </div>
                            <p className="text-[11px] text-slate-400 line-clamp-1">
                              {ch.topics.join(' · ')}
                            </p>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              type="button"
                              onClick={() =>
                                handleAskOrionInline(
                                  'student_explain',
                                  activeSubjectSyllabus.subject,
                                  ch.title,
                                  `Topics: ${ch.topics.join(', ')}\nNotes: ${ch.syllabusNotes || ''}`
                                )
                              }
                              className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-white/10 text-[11px] font-semibold text-slate-300 cursor-pointer"
                            >
                              Explain
                            </button>
                            <button
                              type="button"
                              onClick={() => handleToggleChapterDone(ch.id, activeSubjectSyllabus.subject)}
                              className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold flex items-center gap-1 cursor-pointer ${
                                done
                                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                  : 'bg-blue-600/20 text-blue-300 border border-blue-500/30'
                              }`}
                            >
                              <CheckCircle2 className="w-3 h-3" />
                              <span>{done ? 'Completed' : 'Mark Done'}</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Linked Resources & Subject Marks */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bento-card rounded-2xl p-4 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-white uppercase tracking-wider">Linked Notes &amp; Files</h4>
                      <button
                        type="button"
                        onClick={() => onNavigateTab('materials')}
                        className="text-[11px] font-semibold text-blue-400 cursor-pointer"
                      >
                        Materials Hub
                      </button>
                    </div>
                    {activeSubjectNotes.slice(0, 3).map(n => (
                      <div key={n.id} className="p-2.5 rounded-lg bg-slate-950/70 border border-white/5 text-xs">
                        <p className="font-semibold text-slate-200 truncate">{n.title}</p>
                        <p className="text-[11px] text-slate-500">Lecture Note · {n.createdAt}</p>
                      </div>
                    ))}
                    {activeSubjectMaterials.slice(0, 2).map((m: any) => (
                      <div key={m.id} className="p-2.5 rounded-lg bg-slate-950/70 border border-white/5 text-xs">
                        <p className="font-semibold text-slate-200 truncate">{m.title}</p>
                        <p className="text-[11px] text-slate-500">Class Material</p>
                      </div>
                    ))}
                    {activeSubjectNotes.length === 0 && activeSubjectMaterials.length === 0 && (
                      <p className="text-xs text-slate-500 py-3">No subject notes or uploaded files yet.</p>
                    )}
                  </div>

                  <div className="bento-card rounded-2xl p-4 space-y-2.5">
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider">Subject Assessment Marks</h4>
                    {activeSubjectMarks.slice(0, 4).map(m => (
                      <div key={m.id} className="p-2.5 rounded-lg bg-slate-950/70 border border-white/5 flex items-center justify-between text-xs">
                        <span className="font-semibold text-slate-200 truncate">{m.subject}</span>
                        <span className="font-mono font-bold text-emerald-400 tabular-nums">
                          {m.score}/{m.maxScore} ({m.percentage}%)
                        </span>
                      </div>
                    ))}
                    {activeSubjectMarks.length === 0 && (
                      <p className="text-xs text-slate-500 py-3">No published gradebook entries for this subject yet.</p>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <div className="bento-card rounded-2xl p-8 text-center text-xs text-slate-400">
                Select a subject on the left to inspect chapters, notes, materials, and marks.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ================================================================== */}
      {/* TAB 3: ASSIGNMENTS & EXAM CENTER                                   */}
      {/* ================================================================== */}
      {subTab === 'assignments' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Assignments Manager */}
          <div className="lg:col-span-2 bento-card rounded-2xl p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-white">Assignments &amp; Deadlines</h2>
                <p className="text-xs text-slate-400">Filter pending, upcoming, overdue, and completed coursework</p>
              </div>
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={assignmentSearch}
                  onChange={e => setAssignmentSearch(e.target.value)}
                  placeholder="Search assignments..."
                  className="bg-slate-950 border border-white/10 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {(['pending', 'upcoming', 'overdue', 'completed', 'all'] as AssignmentFilter[]).map(f => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setAssignmentFilter(f)}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold capitalize cursor-pointer ${
                    assignmentFilter === f
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-950 border border-white/10 text-slate-400 hover:text-white'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>

            <div className="space-y-3">
              {filteredAssignments.map(hw => {
                const sub = hw.mySubmission || null;
                const status = deriveAssignmentDisplayStatus(hw, sub, userId);
                const done = isHwCompleted(hw);
                const daysLeft = getDaysDiff(hw.dueDate);
                const overdue = !done && daysLeft !== null && daysLeft < 0;
                const isDrawerOpen = activeSubmitHwId === hw.id;
                const draft = subDrafts[hw.id] || {
                  text: sub?.submissionText || '',
                  url: sub?.attachmentUrl || '',
                  attachmentName: sub?.attachmentName || ''
                };
                const isLockedEvaluated = sub?.status === 'evaluated';

                return (
                  <div
                    key={hw.id}
                    className={`p-4 rounded-xl border space-y-3 ${
                      status === 'returned_for_revision'
                        ? 'bg-amber-950/20 border-amber-500/40'
                        : overdue
                        ? 'bg-rose-950/20 border-rose-500/30'
                        : 'bg-slate-950/75 border-white/10'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                      <div className="space-y-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 text-[11px]">
                          <span className="font-semibold text-blue-400">{hw.subject || 'Coursework'}</span>
                          <span className="text-slate-500">·</span>
                          <span
                            className={`px-2 py-0.5 rounded font-bold uppercase text-[10px] ${
                              status === 'evaluated'
                                ? 'bg-emerald-500/20 text-emerald-300'
                                : status === 'returned_for_revision'
                                ? 'bg-amber-500/20 text-amber-300'
                                : status === 'late'
                                ? 'bg-rose-500/20 text-rose-300'
                                : status === 'submitted' || status === 'under_evaluation'
                                ? 'bg-sky-500/20 text-sky-300'
                                : overdue
                                ? 'bg-rose-500/20 text-rose-300'
                                : 'bg-slate-800 text-slate-300'
                            }`}
                          >
                            {status.replace(/_/g, ' ')}
                          </span>
                          <span className={overdue ? 'text-rose-400 font-semibold' : 'text-slate-400'}>
                            {hw.dueDate ? `Due ${hw.dueDate}` : 'No due date'}
                            {daysLeft !== null && !done && (
                              <> ({daysLeft < 0 ? `${Math.abs(daysLeft)}d overdue` : daysLeft === 0 ? 'today' : `in ${daysLeft}d`})</>
                            )}
                          </span>
                        </div>
                        <h3 className="text-sm font-bold text-white">{hw.title}</h3>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() =>
                            handleAskOrionInline(
                              'student_breakdown_assignment',
                              hw.subject || 'Assignment',
                              `Break down "${hw.title}"`,
                              hw.content || 'Break down key steps and deliverables for this assignment.'
                            )
                          }
                          className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-white/10 text-[11px] font-semibold text-teal-300 cursor-pointer"
                        >
                          Break Down Steps
                        </button>

                        {!isLockedEvaluated && (
                          <button
                            type="button"
                            onClick={() => setActiveSubmitHwId(isDrawerOpen ? null : hw.id)}
                            className="px-3 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-bold cursor-pointer"
                          >
                            {isDrawerOpen
                              ? 'Close'
                              : status === 'returned_for_revision'
                              ? 'Revise & Resubmit'
                              : sub
                              ? 'Edit Submission'
                              : 'Submit Work'}
                          </button>
                        )}
                      </div>
                    </div>

                    {hw.content && <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-line">{hw.content}</p>}

                    {Array.isArray(hw.attachments) && hw.attachments.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {hw.attachments.map((att: AssignmentAttachment) => (
                          <a
                            key={att.id}
                            href={att.url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-900 border border-white/10 text-[11px] text-blue-300 hover:border-blue-400/50"
                          >
                            <FileText className="w-3 h-3" />
                            <span>{att.name}</span>
                            <ExternalLink className="w-2.5 h-2.5" />
                          </a>
                        ))}
                      </div>
                    )}

                    {/* Released Score & Teacher Evaluation Feedback */}
                    {sub && (sub.resultsReleased || sub.status === 'returned_for_revision') && (sub.score !== null || sub.feedback) && (
                      <div className="p-3 rounded-xl bg-slate-900/90 border border-emerald-500/30 space-y-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-xs font-bold text-emerald-300">
                            {sub.status === 'returned_for_revision' ? 'Revision Feedback' : 'Teacher Evaluation'}
                            {sub.evaluatedBy ? ` · ${sub.evaluatedBy}` : ''}
                          </span>
                          {sub.score !== null && sub.score !== undefined && (
                            <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono text-xs font-bold tabular-nums">
                              {sub.score} / {sub.maxScore || hw.maxScore || 100}
                            </span>
                          )}
                        </div>
                        {sub.feedback && <p className="text-xs text-slate-200 whitespace-pre-line">{sub.feedback}</p>}
                        {sub.feedback && (
                          <button
                            type="button"
                            onClick={() =>
                              handleAskOrionInline(
                                'student_understand_feedback',
                                hw.subject || 'Assignment',
                                `Understand Feedback on "${hw.title}"`,
                                `Score: ${sub.score ?? 'Unscored'}/${sub.maxScore || hw.maxScore || 100}. Teacher feedback: "${sub.feedback}"`
                              )
                            }
                            className="text-[11px] font-semibold text-teal-300 hover:underline cursor-pointer"
                          >
                            Ask Orion to explain improvement steps →
                          </button>
                        )}
                      </div>
                    )}

                    {/* Inline Submission Composer */}
                    {isDrawerOpen && !isLockedEvaluated && (
                      <div className="p-3.5 rounded-xl bg-slate-900 border border-blue-500/30 space-y-2.5">
                        <textarea
                          rows={3}
                          value={draft.text}
                          onChange={e =>
                            setSubDrafts(prev => ({
                              ...prev,
                              [hw.id]: { ...draft, text: e.target.value, error: undefined }
                            }))
                          }
                          placeholder="Write your answer, summary, or solution notes..."
                          className="w-full p-2.5 rounded-lg bg-slate-950 border border-white/10 text-xs text-white focus:outline-none focus:border-blue-500"
                        />
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <input
                            type="text"
                            value={draft.attachmentName}
                            onChange={e =>
                              setSubDrafts(prev => ({
                                ...prev,
                                [hw.id]: { ...draft, attachmentName: e.target.value }
                              }))
                            }
                            placeholder="Attachment label (e.g. Lab Report)"
                            className="px-2.5 py-1.5 rounded-lg bg-slate-950 border border-white/10 text-xs text-white"
                          />
                          <input
                            type="url"
                            value={draft.url}
                            onChange={e =>
                              setSubDrafts(prev => ({
                                ...prev,
                                [hw.id]: { ...draft, url: e.target.value, error: undefined }
                              }))
                            }
                            placeholder="Document/Drive link URL (https://...)"
                            className="px-2.5 py-1.5 rounded-lg bg-slate-950 border border-white/10 text-xs text-white"
                          />
                        </div>
                        {draft.error && <p className="text-[11px] text-rose-400 font-semibold">{draft.error}</p>}
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => handleToggleHomeworkDone(hw)}
                            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 cursor-pointer"
                          >
                            {done ? 'Unmark Local Done' : 'Mark Completed Only'}
                          </button>
                          <button
                            type="button"
                            disabled={draft.submitting}
                            onClick={() => handleSubmitAssignmentWork(hw)}
                            className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                          >
                            {draft.submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                            <span>{status === 'returned_for_revision' ? 'Submit Revision' : 'Submit to Teacher'}</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              {filteredAssignments.length === 0 && (
                <div className="p-8 text-center rounded-xl border border-dashed border-white/10 text-xs text-slate-400">
                  No assignments match the current filter.
                </div>
              )}
            </div>
          </div>

          {/* Exam & Readiness Center */}
          <div className="bento-card rounded-2xl p-5 space-y-4 h-fit">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <VeylentraIcon name="exam" size="sm" />
                <div>
                  <h3 className="text-sm font-bold text-white">Exams &amp; Readiness</h3>
                  <p className="text-[11px] text-slate-400">Official assessment schedule &amp; results</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onNavigateTab('calendar')}
                className="text-xs font-semibold text-blue-400 cursor-pointer"
              >
                Calendar
              </button>
            </div>

            <div className="space-y-2.5">
              {/* Published Gradebook Assessments */}
              {publishedAssessments
                .filter(a => a.status !== 'draft')
                .map(ass => {
                  const daysLeft = getDaysDiff(ass.date);
                  const myEntry = ass.resultsPublished
                    ? gradeEntries.find(g => g.assessmentId === ass.id)
                    : undefined;
                  const isCancelled = ass.status === 'cancelled';

                  return (
                    <div
                      key={ass.id}
                      className={`p-3.5 rounded-xl border space-y-2 ${
                        isCancelled
                          ? 'bg-slate-950/40 border-rose-500/20 opacity-75'
                          : 'bg-slate-950/75 border-white/10'
                      }`}
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-white">{ass.subject}</span>
                        <span
                          className={`font-mono text-[11px] tabular-nums ${
                            isCancelled ? 'text-rose-400 line-through' : 'text-amber-400'
                          }`}
                        >
                          {ass.date}
                          {!isCancelled && daysLeft !== null && daysLeft >= 0 ? ` (${daysLeft}d)` : ''}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-semibold text-slate-200">{ass.title}</p>
                        <span
                          className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${
                            isCancelled
                              ? 'bg-rose-500/20 text-rose-300'
                              : ass.resultsPublished
                              ? 'bg-emerald-500/20 text-emerald-300'
                              : 'bg-sky-500/20 text-sky-300'
                          }`}
                        >
                          {isCancelled ? 'Cancelled' : ass.resultsPublished ? 'Results Out' : ass.type}
                        </span>
                      </div>
                      {ass.syllabusCoverage && (
                        <p className="text-[11px] text-slate-400 leading-snug">
                          Syllabus: {ass.syllabusCoverage}
                        </p>
                      )}
                      {myEntry && (
                        <div className="px-2.5 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-between text-xs">
                          <span className="text-emerald-300 font-semibold">Released Mark</span>
                          <span className="font-mono font-bold text-emerald-300 tabular-nums">
                            {myEntry.score}/{myEntry.maxScore} ({myEntry.percentage}%) · {myEntry.letterGrade}
                          </span>
                        </div>
                      )}
                      {!isCancelled && (
                        <div className="flex flex-wrap items-center gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() =>
                              handleAskOrionInline(
                                'student_prep_assessment',
                                ass.subject,
                                `Prep Plan: ${ass.title}`,
                                `Exam Date: ${ass.date}. Type: ${ass.type}. Syllabus coverage: ${ass.syllabusCoverage || 'Full unit review'}. Instructions: ${ass.instructions || 'None'}`
                              )
                            }
                            className="px-2.5 py-1 rounded-lg bg-teal-600/20 hover:bg-teal-600/30 text-teal-300 text-[11px] font-semibold cursor-pointer"
                          >
                            Prep Plan
                          </button>
                          <button
                            type="button"
                            onClick={() => handleCreateExamStudyTask(ass.title, ass.subject)}
                            className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 text-[11px] font-semibold cursor-pointer"
                          >
                            + Study Task
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}

              {exams.map(ex => {
                const daysLeft = getDaysDiff(ex.examDate);
                const subSummary = subjectSummaries.find(
                  s => s.subject.toLowerCase() === ex.subject.toLowerCase()
                );
                const readinessPct = subSummary?.progressPercentage ?? 0;
                return (
                  <div key={ex.id} className="p-3.5 rounded-xl bg-slate-950/75 border border-white/10 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-white">{ex.subject}</span>
                      <span className="font-mono text-[11px] text-amber-400 tabular-nums">
                        {ex.examDate}{daysLeft !== null && daysLeft >= 0 ? ` (${daysLeft}d)` : ''}
                      </span>
                    </div>
                    <p className="text-xs text-slate-300">{ex.examName}</p>
                    <div className="space-y-1">
                      <div className="flex justify-between text-[11px] text-slate-400">
                        <span>Syllabus readiness</span>
                        <span className="tabular-nums font-semibold text-slate-200">{readinessPct}%</span>
                      </div>
                      <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-500" style={{ width: `${readinessPct}%` }} />
                      </div>
                    </div>
                    <div className="flex items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() =>
                          handleAskOrionInline(
                            'student_study_plan',
                            ex.subject,
                            `${ex.examName} Study Plan`,
                            `Exam Date: ${ex.examDate}. Included chapters: ${ex.chaptersIncluded.join(', ')}. Target score: ${ex.targetScorePercent || 85}%.`
                          )
                        }
                        className="px-2.5 py-1 rounded-lg bg-teal-600/20 hover:bg-teal-600/30 text-teal-300 text-[11px] font-semibold cursor-pointer"
                      >
                        Revision Plan
                      </button>
                      <button
                        type="button"
                        onClick={() => onNavigateTab('brain_battle')}
                        className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 text-[11px] font-semibold cursor-pointer"
                      >
                        Practice Arena
                      </button>
                    </div>
                  </div>
                );
              })}
              {exams.length === 0 && publishedAssessments.filter(a => a.status !== 'draft').length === 0 && (
                <p className="text-xs text-slate-400 py-4 text-center">No upcoming exams published yet.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ================================================================== */}
      {/* TAB 4: ATTENDANCE & PERFORMANCE CENTER (READ-ONLY RECORDS)         */}
      {/* ================================================================== */}
      {subTab === 'analytics' && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Attendance Projection & Summary Card */}
            <div className="bento-card rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-white">Attendance Overview &amp; Threshold Estimator</h2>
                  <p className="text-xs text-slate-400">Read-only official records from school attendance register</p>
                </div>
                <button
                  type="button"
                  onClick={() => onNavigateTab('attendance')}
                  className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-white/10 text-xs font-semibold text-blue-400 cursor-pointer"
                >
                  Full Log &amp; Leave
                </button>
              </div>

              <div className="grid grid-cols-4 gap-2.5">
                <div className="p-3 rounded-xl bg-slate-950/75 border border-white/10">
                  <span className="text-[11px] text-slate-400 block">Present</span>
                  <span className="text-lg font-bold text-emerald-400 tabular-nums">{attendanceStats.presentCount}</span>
                </div>
                <div className="p-3 rounded-xl bg-slate-950/75 border border-white/10">
                  <span className="text-[11px] text-slate-400 block">Late</span>
                  <span className="text-lg font-bold text-amber-400 tabular-nums">{attendanceStats.lateCount}</span>
                </div>
                <div className="p-3 rounded-xl bg-slate-950/75 border border-white/10">
                  <span className="text-[11px] text-slate-400 block">Absent</span>
                  <span className="text-lg font-bold text-rose-400 tabular-nums">{attendanceStats.absentCount}</span>
                </div>
                <div className="p-3 rounded-xl bg-slate-950/75 border border-white/10">
                  <span className="text-[11px] text-slate-400 block">Rate</span>
                  <span className="text-lg font-bold text-white tabular-nums">
                    {attendanceStats.totalConducted > 0 ? `${attendanceStats.percentage}%` : 'N/A'}
                  </span>
                </div>
              </div>

              {/* Planning Estimate Calculator */}
              <div className="p-4 rounded-xl bg-slate-950/80 border border-white/10 space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-white flex items-center gap-1.5">
                    <SlidersHorizontal className="w-3.5 h-3.5 text-blue-400" />
                    Target Attendance Estimate ({targetAttendancePct}%)
                  </span>
                  <span className="px-2 py-0.5 rounded bg-blue-500/15 text-blue-300 text-[10px] font-semibold">
                    Planning Estimate
                  </span>
                </div>
                <input
                  type="range"
                  min={65}
                  max={95}
                  step={5}
                  value={targetAttendancePct}
                  onChange={e => setTargetAttendancePct(Number(e.target.value))}
                  className="w-full accent-blue-500"
                />
                <p className="text-xs text-slate-200">
                  {attendanceStats.totalConducted === 0 ? (
                    'No conducted sessions recorded yet to calculate projection.'
                  ) : attendanceProjection.isMeetingTarget ? (
                    <>
                      You currently meet {targetAttendancePct}%. Estimated buffer:{' '}
                      <strong className="text-emerald-400 tabular-nums">{attendanceProjection.canMissSafely}</strong> session(s) before dropping below threshold.
                    </>
                  ) : (
                    <>
                      Estimated{' '}
                      <strong className="text-amber-400 tabular-nums">
                        {attendanceProjection.classesNeededForTarget}
                      </strong>{' '}
                      consecutive attended session(s) needed to reach {targetAttendancePct}%.
                    </>
                  )}
                </p>
                <p className="text-[11px] text-slate-500">{attendanceProjection.disclaimer}</p>
              </div>
            </div>

            {/* Marks & Performance Visualization */}
            <div className="bento-card rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-white">Assessment Performance</h2>
                  <p className="text-xs text-slate-400">Verified gradebook entries (read-only student access)</p>
                </div>
                <button
                  type="button"
                  onClick={() => onNavigateTab('performance')}
                  className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-white/10 text-xs font-semibold text-blue-400 cursor-pointer"
                >
                  Report Cards
                </button>
              </div>

              {marksChartData.length > 0 ? (
                <div className="h-52 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={marksChartData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.12)" vertical={false} />
                      <XAxis dataKey="subject" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis domain={[0, 100]} tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                      <Tooltip
                        formatter={(v: any) => [`${v}%`, 'Average Score']}
                        contentStyle={{
                          backgroundColor: '#0f172a',
                          borderColor: 'rgba(255,255,255,0.12)',
                          borderRadius: '10px',
                          fontSize: '12px',
                          color: '#f8fafc'
                        }}
                      />
                      <Bar dataKey="score" fill="#10b981" radius={[6, 6, 0, 0]} barSize={32} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="p-8 text-center rounded-xl bg-slate-950/60 border border-dashed border-white/10 text-xs text-slate-400 space-y-2">
                  <p>No published assessment marks recorded yet.</p>
                  <button
                    type="button"
                    onClick={() => onNavigateTab('performance')}
                    className="text-blue-400 font-semibold cursor-pointer"
                  >
                    Open Performance Analytics Center
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ================================================================== */}
      {/* TAB 5: INTEGRATED STUDY SPACE & ACADEMIC CALENDAR                  */}
      {/* ================================================================== */}
      {subTab === 'study_space' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Unified Study Launchpad */}
          <div className="lg:col-span-2 bento-card rounded-2xl p-5 space-y-4">
            <div>
              <h2 className="text-base font-bold text-white">Integrated Study Space</h2>
              <p className="text-xs text-slate-400">
                Launch your notes, spaced-repetition flashcards, syllabus study planner, and focus timer
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => onNavigateTab('notes')}
                className="p-4 rounded-xl bg-slate-950/75 border border-white/10 hover:border-blue-500/40 text-left flex items-start gap-3 transition-colors cursor-pointer"
              >
                <VeylentraIcon name="notes" size="md" />
                <div>
                  <h3 className="text-sm font-bold text-white">Lecture Notes &amp; OCR</h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {notes.length} saved note{notes.length === 1 ? '' : 's'} · Includes Image-to-Note capture &amp; math blocks
                  </p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => onNavigateTab('study_hub', 'flashcards')}
                className="p-4 rounded-xl bg-slate-950/75 border border-white/10 hover:border-blue-500/40 text-left flex items-start gap-3 transition-colors cursor-pointer"
              >
                <VeylentraIcon name="quiz" size="md" />
                <div>
                  <h3 className="text-sm font-bold text-white">Spaced Repetition Flashcards</h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {dueCardsCount} due today across {decks.length} study deck{decks.length === 1 ? '' : 's'}
                  </p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => onNavigateTab('study_hub', 'planner')}
                className="p-4 rounded-xl bg-slate-950/75 border border-white/10 hover:border-blue-500/40 text-left flex items-start gap-3 transition-colors cursor-pointer"
              >
                <VeylentraIcon name="syllabus" size="md" />
                <div>
                  <h3 className="text-sm font-bold text-white">Syllabus &amp; AI Study Planner</h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Chapter checkpoints and conflict-free evening study sessions
                  </p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => onNavigateTab('pomodoro')}
                className="p-4 rounded-xl bg-slate-950/75 border border-white/10 hover:border-blue-500/40 text-left flex items-start gap-3 transition-colors cursor-pointer"
              >
                <VeylentraIcon name="timer" size="md" />
                <div>
                  <h3 className="text-sm font-bold text-white">Focus Timer</h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Distraction-free Pomodoro sessions and study streaks
                  </p>
                </div>
              </button>
            </div>
          </div>

          {/* Upcoming Calendar Events & Milestones */}
          <div className="bento-card rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-blue-400" />
                <h3 className="text-sm font-bold text-white">Academic Calendar</h3>
              </div>
              <button
                type="button"
                onClick={() => onNavigateTab('calendar')}
                className="text-xs font-semibold text-blue-400 hover:text-blue-300 cursor-pointer"
              >
                Full Calendar
              </button>
            </div>

            <div className="space-y-2.5">
              {calendarEvents.slice(0, 5).map((ev: any) => (
                <div key={ev.id} className="p-3 rounded-xl bg-slate-950/75 border border-white/10 text-xs space-y-0.5">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-blue-400 capitalize">{ev.event_type || 'Event'}</span>
                    <span className="font-mono text-[11px] text-slate-400 tabular-nums">{ev.event_date}</span>
                  </div>
                  <p className="font-bold text-white">{ev.title}</p>
                </div>
              ))}
              {calendarEvents.length === 0 && (
                <div className="p-4 text-center rounded-xl bg-slate-950/50 border border-dashed border-white/10 text-xs text-slate-400">
                  <BookOpen className="w-4 h-4 mx-auto mb-1 text-slate-500" />
                  <p>No upcoming calendar events posted yet.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
};
