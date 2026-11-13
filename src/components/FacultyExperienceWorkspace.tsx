/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Veylentra Faculty Experience 2.0
 * Config-driven unified workspace for Teachers, Coordinators, and extensible faculty roles
 * (e.g., HOD). Scopes student rosters, homework, attendance, marks, timetable supervision,
 * deterministic Byte reminders, and confirmation-gated Orion AI drafting workflows.
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
  Calendar,
  CheckCircle2,
  Clock,
  ChevronRight,
  Search,
  Plus,
  Loader2,
  AlertTriangle,
  Send,
  X,
  Users,
  Check,
  ShieldCheck,
  SlidersHorizontal,
  FileText,
  ExternalLink,
  Megaphone
} from 'lucide-react';
import {
  UserProfile,
  Homework,
  AssignmentSubmission,
  AssignmentAttachment,
  AssignmentLifecycleStatus,
  TargetedAnnouncement
} from '../types';
import { OfficialClassTimetable } from '../types/syllabusTimetable';
import { soundService } from '../lib/soundService';
import { VeylentraIcon } from './ui/VeylentraIcon';
import {
  getFacultyRoleConfig,
  hasFacultyCapability,
  getAuthorizedGrades,
  getAuthorizedSections,
  isStudentInFacultyScope
} from '../config/facultyPermissions';
import {
  buildByteReminders,
  dismissByteReminder,
  markByteReminderHandled,
  snoozeByteReminder
} from '../lib/byteReminderEngine';
import {
  fetchAssignments,
  saveAssignment,
  fetchAssignmentSubmissions,
  evaluateAssignmentSubmission,
  fetchTargetedAnnouncements,
  createTargetedAnnouncement,
  updateTargetedAnnouncement,
  isStudentMatchedToCohort
} from '../lib/academicWorkflowService';
import { SyllabusTimetableService } from '../lib/syllabusTimetableService';
import { fetchAllSupabaseUsers } from '../lib/supabaseUsers';
import { saveSupabaseHomework } from '../lib/supabaseHomework';
import { saveVaultNoteToSupabase } from '../lib/supabaseNotes';
import { supabase } from '../lib/supabase';
import StudentMarksCenter from './StudentMarksCenter';
import AttendanceManager from './AttendanceManager';
import CoordinatorModule from './CoordinatorModule';
import { OfficialTimetableViewer } from './OfficialTimetableViewer';
import { getSectionsForGrade } from '../config/academicHierarchy';

interface FacultyExperienceWorkspaceProps {
  currentUser: UserProfile;
  effectiveRole: string;
  homeworkList: Homework[];
  announcements: any[];
  onNavigateTab: (tabId: string) => void;
  onOpenOrionFull: (initialQuery?: string) => void;
  showNotification: (msg: string) => void;
}

type FacultySubSection =
  | 'overview'
  | 'classes'
  | 'assignments'
  | 'attendance'
  | 'gradebook'
  | 'coordination';

type OrionFacultyIntent =
  | 'draft_assignment'
  | 'draft_lesson_plan'
  | 'draft_quiz'
  | 'draft_announcement'
  | 'draft_feedback'
  | 'draft_assessment_outline'
  | 'summarize_submission_progress'
  | 'summarize_cohort_coordination'
  | 'summarize_class_insights';

interface PendingOrionDraft {
  intent: OrionFacultyIntent;
  title: string;
  subject: string;
  grade: string;
  section: string;
  content: string;
  provider?: string;
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
  const roleConfig = useMemo(() => getFacultyRoleConfig(effectiveRole), [effectiveRole]);
  const authorizedGrades = useMemo(() => getAuthorizedGrades(currentUser), [currentUser]);
  const authorizedSections = useMemo(() => getAuthorizedSections(currentUser), [currentUser]);

  const isCoordinatorPlus = hasFacultyCapability(effectiveRole, 'view_grade_section_oversight');

  const [subSection, setSubSection] = useState<FacultySubSection>(() =>
    roleConfig.defaultSubTab === 'coordination' && isCoordinatorPlus ? 'coordination' : 'overview'
  );

  // Real data states
  const [scopedStudents, setScopedStudents] = useState<UserProfile[]>([]);
  const [backendAssignments, setBackendAssignments] = useState<Array<Homework & { stats?: any }>>([]);
  const [targetedAnnouncements, setTargetedAnnouncements] = useState<TargetedAnnouncement[]>([]);
  const [todayAttCount, setTodayAttCount] = useState<number>(0);
  const [lowAttendanceStudents, setLowAttendanceStudents] = useState<
    Array<{ uid: string; name: string; grade: string; section: string; pct: number; total: number }>
  >([]);
  const [timetable, setTimetable] = useState<OfficialClassTimetable | null>(null);
  const [loadingCohort, setLoadingCohort] = useState<boolean>(true);
  const [rosterSearch, setRosterSearch] = useState<string>('');
  const [cohortGradeFilter, setCohortGradeFilter] = useState<string>('All');
  const [reminderVersion, setReminderVersion] = useState<number>(0);

  // Assignment creation + lifecycle + evaluation state
  const [showCreateAssignment, setShowCreateAssignment] = useState<boolean>(false);
  const [newHwTitle, setNewHwTitle] = useState<string>('');
  const [newHwSubject, setNewHwSubject] = useState<string>(currentUser.department || 'Mathematics');
  const [newHwGrade, setNewHwGrade] = useState<string>(authorizedGrades[0] || 'Grade 10');
  const [newHwSection, setNewHwSection] = useState<string>(authorizedSections[0] || 'Solara');
  const [newHwDueDate, setNewHwDueDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 3);
    return d.toISOString().split('T')[0];
  });
  const [newHwContent, setNewHwContent] = useState<string>('');
  const [newHwStatus, setNewHwStatus] = useState<AssignmentLifecycleStatus>('published');
  const [newHwMaxScore, setNewHwMaxScore] = useState<number>(100);
  const [newHwAttachName, setNewHwAttachName] = useState<string>('');
  const [newHwAttachUrl, setNewHwAttachUrl] = useState<string>('');
  const [savingAssignment, setSavingAssignment] = useState<boolean>(false);

  // Connected Submission Inspection & Evaluation state
  const [expandedSubmissionHwId, setExpandedSubmissionHwId] = useState<string | null>(null);
  const [submissionsByHw, setSubmissionsByHw] = useState<Record<string, AssignmentSubmission[]>>({});
  const [loadingSubsHwId, setLoadingSubsHwId] = useState<string | null>(null);
  const [evalDrafts, setEvalDrafts] = useState<
    Record<string, { score: string; feedback: string; saving?: boolean; error?: string; orionLoading?: boolean }>
  >({});

  // Targeted Announcement Composer state
  const [showAnnComposer, setShowAnnComposer] = useState<boolean>(false);
  const [annTitle, setAnnTitle] = useState<string>('');
  const [annContent, setAnnContent] = useState<string>('');
  const [annPriority, setAnnPriority] = useState<'normal' | 'important' | 'urgent'>('normal');
  const [annTargetRole, setAnnTargetRole] = useState<'all' | 'student' | 'teacher' | 'parent'>('student');
  const [annTargetGrade, setAnnTargetGrade] = useState<string>(authorizedGrades[0] || 'all');
  const [annTargetSection, setAnnTargetSection] = useState<string>(authorizedSections[0] || 'all');
  const [annStatus, setAnnStatus] = useState<'published' | 'draft'>('published');
  const [annAttachUrl, setAnnAttachUrl] = useState<string>('');
  const [savingAnn, setSavingAnn] = useState<boolean>(false);

  const [reviewedHwIds, setReviewedHwIds] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem(`veylentra_reviewed_hw_${currentUser.uid || 'faculty'}`);
      return raw ? new Set(JSON.parse(raw)) : new Set();
    } catch {
      return new Set();
    }
  });

  // Orion Faculty Copilot Drafting & Explicit Confirmation State
  const [orionSubject, setOrionSubject] = useState<string>(currentUser.department || 'General Science');
  const [orionTopic, setOrionTopic] = useState<string>('');
  const [orionGrade, setOrionGrade] = useState<string>(authorizedGrades[0] || 'Grade 10');
  const [orionLoading, setOrionLoading] = useState<boolean>(false);
  const [orionError, setOrionError] = useState<string | null>(null);
  const [pendingDraft, setPendingDraft] = useState<PendingOrionDraft | null>(null);
  const [committingDraft, setCommittingDraft] = useState<boolean>(false);

  const userId = currentUser?.uid || currentUser?.email || 'faculty_default';

  useEffect(() => {
    let mounted = true;

    async function loadFacultyWorkspaceData() {
      setLoadingCohort(true);
      try {
        const primaryGrade = authorizedGrades[0] || 'Grade 10';
        const primarySection = authorizedSections[0] || 'Solara';
        const todayStr = new Date().toISOString().split('T')[0];

        const [allUsers, tt, attRes, apiHwRes, apiAnnRes] = await Promise.all([
          fetchAllSupabaseUsers().catch(() => [] as UserProfile[]),
          SyllabusTimetableService.getOfficialTimetable('default_school', primaryGrade).catch(() => null),
          supabase
            .from('attendance')
            .select('user_id, date, status, grade, section')
            .order('date', { ascending: false })
            .limit(800),
          fetchAssignments(currentUser),
          fetchTargetedAnnouncements(currentUser)
        ]);

        if (!mounted) return;

        if (apiHwRes.ok && apiHwRes.data) {
          setBackendAssignments(apiHwRes.data);
        }
        if (apiAnnRes.ok && apiAnnRes.data) {
          setTargetedAnnouncements(apiAnnRes.data);
        }

        const studentsInScope = allUsers.filter(
          u => u.role === 'student' && isStudentInFacultyScope(u, currentUser, effectiveRole)
        );
        setScopedStudents(studentsInScope);
        if (tt) setTimetable(tt);

        const attRows = Array.isArray(attRes?.data) ? attRes.data : [];
        const scopedUidSet = new Set(studentsInScope.map(s => s.uid).filter(Boolean));
        const scopedAttRows = attRows.filter((row: any) => scopedUidSet.has(row.user_id));

        const markedToday = new Set(
          scopedAttRows.filter((row: any) => row.date === todayStr).map((row: any) => row.user_id)
        );
        setTodayAttCount(markedToday.size);

        // Compute per-student attendance % for threshold alerts (<75%)
        const studentRollup: Record<string, { present: number; total: number }> = {};
        scopedAttRows.forEach((r: any) => {
          if (!studentRollup[r.user_id]) studentRollup[r.user_id] = { present: 0, total: 0 };
          studentRollup[r.user_id].total += 1;
          if (r.status === 'present' || r.status === 'late') {
            studentRollup[r.user_id].present += 1;
          }
        });

        const lowList = studentsInScope
          .map(st => {
            const rec = studentRollup[st.uid];
            if (!rec || rec.total < 3) return null;
            const pct = Math.round((rec.present / rec.total) * 100);
            if (pct >= 75) return null;
            return {
              uid: st.uid,
              name: st.name,
              grade: st.grade || 'Grade 10',
              section: st.section || 'Solara',
              pct,
              total: rec.total
            };
          })
          .filter(Boolean) as Array<{ uid: string; name: string; grade: string; section: string; pct: number; total: number }>;

        setLowAttendanceStudents(lowList);
      } catch (err) {
        console.warn('[FacultyExperience] Failed loading scoped cohort data:', err);
      } finally {
        if (mounted) setLoadingCohort(false);
      }
    }

    loadFacultyWorkspaceData();

    const handleSyncUpdate = async (e: any) => {
      const tbl = e?.detail?.table;
      if (tbl === 'homework' || tbl === 'assignment_submissions') {
        const res = await fetchAssignments(currentUser);
        if (mounted && res.ok && res.data) setBackendAssignments(res.data);
      }
      if (tbl === 'announcements') {
        const res = await fetchTargetedAnnouncements(currentUser);
        if (mounted && res.ok && res.data) setTargetedAnnouncements(res.data);
      }
    };
    window.addEventListener('studentos-db-update', handleSyncUpdate);

    return () => {
      mounted = false;
      window.removeEventListener('studentos-db-update', handleSyncUpdate);
    };
  }, [currentUser, effectiveRole, authorizedGrades, authorizedSections]);

  // Merge backend authoritative assignments with legacy homework prop
  const mergedHomeworkList = useMemo(() => {
    const map = new Map<string, Homework & { stats?: any }>();
    homeworkList.forEach(h => map.set(h.id, h));
    backendAssignments.forEach(h => {
      const prev = map.get(h.id);
      map.set(h.id, { ...prev, ...h });
    });
    return Array.from(map.values());
  }, [homeworkList, backendAssignments]);

  // Assignments scoped to authorized grades OR created by current faculty user
  const teacherHomework = useMemo(() => {
    const authSet = new Set(authorizedGrades.map(g => g.toLowerCase()));
    return mergedHomeworkList.filter(hw => {
      const byMe = hw.givenBy && currentUser.name && hw.givenBy.toLowerCase() === currentUser.name.toLowerCase();
      const inGrade = hw.classGrade && authSet.has(hw.classGrade.toLowerCase());
      return byMe || inGrade;
    });
  }, [mergedHomeworkList, authorizedGrades, currentUser.name]);

  const pendingSubmissionsToReview = useMemo(
    () =>
      teacherHomework.reduce((acc, hw: any) => {
        if (typeof hw?.stats?.pendingEvaluationCount === 'number') {
          return acc + hw.stats.pendingEvaluationCount;
        }
        return !reviewedHwIds.has(hw.id) ? acc + (hw.completedList ? hw.completedList.length : 0) : acc;
      }, 0),
    [teacherHomework, reviewedHwIds]
  );

  // Today's teaching schedule from official timetable
  const todayTeachingSchedule = useMemo(() => {
    if (!timetable?.schedule?.length) return { dayLabel: 'Today', periods: [] as any[] };
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const todayName = dayNames[new Date().getDay()];
    const todayDay = timetable.schedule.find(d => d.day.toLowerCase() === todayName.toLowerCase());
    const fallbackDay = timetable.schedule.find(d => d.day === 'Monday') || timetable.schedule[0];
    const targetDay = todayDay && todayDay.periods.length > 0 ? todayDay : fallbackDay;

    const periods = (targetDay?.periods || []).filter(p => !p.isBreak && p.subject);
    return {
      dayLabel: todayDay && todayDay.periods.length > 0 ? todayName : `${fallbackDay?.day || 'Monday'} (Next)`,
      periods
    };
  }, [timetable]);

  // Real Recharts dataset: Homework Completion Rate per Active Assignment (No fake stats)
  const assignmentCompletionChartData = useMemo(() => {
    const denom = Math.max(scopedStudents.length, 1);
    return teacherHomework.slice(0, 6).map(hw => {
      const submittedCount = hw.completedList ? hw.completedList.length : 0;
      const pct = scopedStudents.length > 0 ? Math.min(100, Math.round((submittedCount / denom) * 100)) : submittedCount;
      return {
        name: hw.title.length > 14 ? `${hw.title.slice(0, 12)}..` : hw.title,
        fullTitle: hw.title,
        submitted: submittedCount,
        completionPct: pct
      };
    });
  }, [teacherHomework, scopedStudents.length]);

  // Deterministic Byte Faculty Reminders (Zero AI)
  const flattenedSubmissions = useMemo(
    () => Object.values(submissionsByHw).flat(),
    [submissionsByHw]
  );

  const facultyByteReminders = useMemo(
    () =>
      buildByteReminders({
        currentUser,
        effectiveRole,
        homeworkList: teacherHomework,
        submissions: flattenedSubmissions,
        announcements,
        timetable,
        todayAttendanceMarkedCount: todayAttCount,
        totalCohortStudentsCount: scopedStudents.length
      }),
    [currentUser, effectiveRole, teacherHomework, flattenedSubmissions, announcements, timetable, todayAttCount, scopedStudents.length, reminderVersion]
  );

  const filteredRoster = useMemo(() => {
    const q = rosterSearch.trim().toLowerCase();
    return scopedStudents.filter(st => {
      if (cohortGradeFilter !== 'All' && (st.grade || '').toLowerCase() !== cohortGradeFilter.toLowerCase()) {
        return false;
      }
      if (!q) return true;
      return (
        (st.name || '').toLowerCase().includes(q) ||
        (st.email || '').toLowerCase().includes(q) ||
        (st.section || '').toLowerCase().includes(q)
      );
    });
  }, [scopedStudents, rosterSearch, cohortGradeFilter]);

  const handleMarkAssignmentReviewed = (hwId: string) => {
    soundService.playButtonClick();
    setReviewedHwIds(prev => {
      const next = new Set(prev);
      if (next.has(hwId)) next.delete(hwId);
      else next.add(hwId);
      try {
        localStorage.setItem(`veylentra_reviewed_hw_${userId}`, JSON.stringify(Array.from(next)));
      } catch {
        // ignore storage failure
      }
      return next;
    });
    showNotification('Updated assignment review marker.');
  };

  const handleCreateAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newHwTitle.trim() || !newHwContent.trim()) {
      showNotification('Please provide an assignment title and instructions.');
      return;
    }
    setSavingAssignment(true);
    soundService.playButtonClick();
    try {
      const attachments: AssignmentAttachment[] = [];
      if (newHwAttachUrl.trim()) {
        attachments.push({
          id: `att-${Date.now()}`,
          name: newHwAttachName.trim() || 'Assignment Resource',
          url: newHwAttachUrl.trim()
        });
      }
      const newHw: Homework = {
        id: `hw-${Date.now()}`,
        classGrade: newHwGrade,
        classSection: newHwSection as any,
        subject: newHwSubject,
        title: newHwTitle.trim(),
        content: newHwContent.trim(),
        dueDate: newHwDueDate,
        givenBy: currentUser.name || 'Faculty',
        teacherId: userId,
        status: newHwStatus,
        maxScore: Math.max(1, Number(newHwMaxScore) || 100),
        attachments,
        allowLate: true,
        createdAt: new Date().toISOString(),
        completedList: []
      };
      const apiRes = await saveAssignment(currentUser, newHw, true);
      if (!apiRes.ok) {
        throw new Error(apiRes.error || 'Could not save assignment.');
      }
      await saveSupabaseHomework(apiRes.data || newHw).catch(() => {});
      if (apiRes.data) {
        setBackendAssignments(prev => [apiRes.data!, ...prev.filter(x => x.id !== apiRes.data!.id)]);
      }
      setShowCreateAssignment(false);
      setNewHwTitle('');
      setNewHwContent('');
      setNewHwAttachName('');
      setNewHwAttachUrl('');
      showNotification(
        newHwStatus === 'draft'
          ? `✓ Saved draft "${newHw.title}" (hidden from students until published).`
          : `✓ Assignment "${newHw.title}" published to ${newHwGrade} (${newHwSection}).`
      );
    } catch (err: any) {
      showNotification(err?.message || 'Could not save assignment.');
    } finally {
      setSavingAssignment(false);
    }
  };

  const handleToggleAssignmentLifecycle = async (hw: Homework, nextStatus: AssignmentLifecycleStatus) => {
    soundService.playButtonClick();
    const res = await saveAssignment(currentUser, { id: hw.id, status: nextStatus }, false);
    if (!res.ok) {
      showNotification(res.error || 'Failed updating assignment status.');
      return;
    }
    if (res.data) {
      setBackendAssignments(prev => prev.map(x => (x.id === hw.id ? { ...x, ...res.data! } : x)));
    }
    showNotification(`Assignment updated to ${nextStatus.toUpperCase()}.`);
  };

  const handleToggleSubmissionsPanel = async (hwId: string) => {
    soundService.playButtonClick();
    if (expandedSubmissionHwId === hwId) {
      setExpandedSubmissionHwId(null);
      return;
    }
    setExpandedSubmissionHwId(hwId);
    setLoadingSubsHwId(hwId);
    const res = await fetchAssignmentSubmissions(currentUser, hwId);
    setLoadingSubsHwId(null);
    if (!res.ok) {
      showNotification(res.error || 'Could not load submissions.');
      return;
    }
    const subs = res.data || [];
    setSubmissionsByHw(prev => ({ ...prev, [hwId]: subs }));
    setEvalDrafts(prev => {
      const next = { ...prev };
      subs.forEach(s => {
        const key = `${hwId}::${s.studentId}`;
        if (!next[key]) {
          next[key] = {
            score: s.score !== null && s.score !== undefined ? String(s.score) : '',
            feedback: s.feedback || ''
          };
        }
      });
      return next;
    });
  };

  const handleSaveEvaluation = async (
    hw: Homework,
    sub: AssignmentSubmission,
    action: 'evaluate' | 'return_for_revision'
  ) => {
    const key = `${hw.id}::${sub.studentId}`;
    const draft = evalDrafts[key] || { score: '', feedback: '' };
    const maxScore = hw.maxScore || 100;
    let parsedScore: number | null = null;
    if (draft.score.trim() !== '') {
      parsedScore = Number(draft.score);
      if (Number.isNaN(parsedScore) || parsedScore < 0 || parsedScore > maxScore) {
        setEvalDrafts(prev => ({ ...prev, [key]: { ...draft, error: `Score must be between 0 and ${maxScore}.` } }));
        return;
      }
    }
    if (action === 'return_for_revision' && !draft.feedback.trim()) {
      setEvalDrafts(prev => ({ ...prev, [key]: { ...draft, error: 'Please include feedback explaining what to revise.' } }));
      return;
    }

    setEvalDrafts(prev => ({ ...prev, [key]: { ...draft, saving: true, error: undefined } }));
    soundService.playButtonClick();

    const res = await evaluateAssignmentSubmission(currentUser, hw.id, {
      studentId: sub.studentId,
      studentName: sub.studentName,
      score: parsedScore,
      maxScore,
      feedback: draft.feedback.trim(),
      action,
      resultsReleased: true
    });

    if (!res.ok || !res.data) {
      setEvalDrafts(prev => ({ ...prev, [key]: { ...draft, saving: false, error: res.error || 'Evaluation save failed.' } }));
      return;
    }

    setEvalDrafts(prev => ({ ...prev, [key]: { ...draft, saving: false, error: undefined } }));
    setSubmissionsByHw(prev => ({
      ...prev,
      [hw.id]: (prev[hw.id] || []).map(item => (item.studentId === sub.studentId ? res.data! : item))
    }));
    const refreshHw = await fetchAssignments(currentUser);
    if (refreshHw.ok && refreshHw.data) setBackendAssignments(refreshHw.data);
    showNotification(
      action === 'return_for_revision'
        ? `Returned ${sub.studentName}'s work for revision.`
        : `✓ Evaluated & released marks for ${sub.studentName}.`
    );
  };

  const handleDraftSubmissionFeedbackWithOrion = async (hw: Homework, sub: AssignmentSubmission) => {
    const key = `${hw.id}::${sub.studentId}`;
    const currentDraft = evalDrafts[key] || { score: '', feedback: '' };
    setEvalDrafts(prev => ({ ...prev, [key]: { ...currentDraft, orionLoading: true, error: undefined } }));
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
          userRole: effectiveRole,
          intent: 'draft_feedback',
          subject: hw.subject,
          grade: hw.classGrade,
          topic: `Draft concise evaluation feedback for ${sub.studentName} on "${hw.title}"`,
          contextData: `Assignment max score: ${hw.maxScore || 100}. Proposed score: ${currentDraft.score || 'Pending'}. Student response: ${(sub.submissionText || '').slice(0, 1200)}`
        })
      });
      const json = await resp.json();
      if (!resp.ok || !json.success || !json.text) {
        throw new Error(json.error || `Orion returned status ${resp.status}`);
      }
      setEvalDrafts(prev => ({
        ...prev,
        [key]: { ...currentDraft, feedback: json.text.trim(), orionLoading: false, error: undefined }
      }));
    } catch (err: any) {
      setEvalDrafts(prev => ({
        ...prev,
        [key]: { ...currentDraft, orionLoading: false, error: err?.message || 'Could not draft feedback.' }
      }));
    }
  };

  const handleSaveTargetedAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!annTitle.trim() || !annContent.trim()) {
      showNotification('Announcement title and content are required.');
      return;
    }
    setSavingAnn(true);
    soundService.playButtonClick();
    try {
      const attachments: AssignmentAttachment[] = annAttachUrl.trim()
        ? [{ id: `ann-att-${Date.now()}`, name: 'Attachment', url: annAttachUrl.trim() }]
        : [];
      const res = await createTargetedAnnouncement(currentUser, {
        title: annTitle.trim(),
        content: annContent.trim(),
        priority: annPriority,
        targetRole: annTargetRole,
        targetGrade: annTargetGrade,
        targetSection: annTargetSection,
        status: annStatus,
        attachments
      });
      if (!res.ok || !res.data) {
        throw new Error(res.error || 'Failed to save announcement.');
      }
      setTargetedAnnouncements(prev => [res.data!, ...prev.filter(a => a.id !== res.data!.id)]);
      setShowAnnComposer(false);
      setAnnTitle('');
      setAnnContent('');
      setAnnAttachUrl('');
      showNotification(
        annStatus === 'draft'
          ? `Saved circular draft "${res.data.title}".`
          : `✓ Targeted circular published to ${annTargetGrade} (${annTargetSection}).`
      );
    } catch (err: any) {
      showNotification(err?.message || 'Failed posting circular.');
    } finally {
      setSavingAnn(false);
    }
  };

  // Orion Faculty Copilot Drafting (APInex / Ministral / Groq via /api/ai/orion-assist)
  const handleRunOrionDraft = async (intent: OrionFacultyIntent, customTopic?: string) => {
    const requestedTopic =
      (customTopic || orionTopic).trim() ||
      (intent === 'summarize_class_insights'
        ? `Cohort engagement & attendance summary for ${orionGrade}`
        : intent === 'summarize_submission_progress'
        ? `Assignment submission & late work summary for ${orionGrade}`
        : intent === 'summarize_cohort_coordination'
        ? `Academic coordination & assessment pacing briefing for ${authorizedGrades.join(', ')}`
        : `${orionSubject} classroom resource for ${orionGrade}`);

    setOrionLoading(true);
    setOrionError(null);
    setPendingDraft(null);
    soundService.playButtonClick();

    const totalSubmitted = teacherHomework.reduce((a, h: any) => a + Number(h?.stats?.submittedCount ?? (h.completedList?.length || 0)), 0);
    const totalLate = teacherHomework.reduce((a, h: any) => a + Number(h?.stats?.lateCount || 0), 0);
    const totalEvaluated = teacherHomework.reduce((a, h: any) => a + Number(h?.stats?.evaluatedCount || 0), 0);

    const cohortContext =
      intent === 'summarize_submission_progress'
        ? `Assignments active: ${teacherHomework.length}. Total submissions: ${totalSubmitted}. Pending evaluation: ${pendingSubmissionsToReview}. Late submissions: ${totalLate}. Evaluated: ${totalEvaluated}. Scoped cohort size: ${scopedStudents.length}.`
        : intent === 'summarize_class_insights' || intent === 'summarize_cohort_coordination'
        ? `Authorized students: ${scopedStudents.length}. Marked today attendance: ${todayAttCount}. Below 75% attendance count: ${lowAttendanceStudents.length}. Active assignments: ${teacherHomework.length}. Pending evaluations: ${pendingSubmissionsToReview}.`
        : `Faculty role: ${effectiveRole}. Authorized grades: ${authorizedGrades.join(', ')}. Cohort size: ${scopedStudents.length}.`;

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
          userRole: effectiveRole,
          intent,
          subject: orionSubject,
          grade: orionGrade,
          topic: requestedTopic,
          contextData: cohortContext
        })
      });

      const data = await resp.json();
      if (!resp.ok || !data.success || !data.text) {
        throw new Error(data.error || `Orion returned status ${resp.status}`);
      }

      const defaultTitleMap: Record<OrionFacultyIntent, string> = {
        draft_assignment: `${orionSubject}: ${requestedTopic}`,
        draft_lesson_plan: `Lesson Plan — ${orionSubject}: ${requestedTopic}`,
        draft_quiz: `Formative Quiz — ${orionSubject}`,
        draft_announcement: `${orionGrade} Academic Update`,
        draft_feedback: `Evaluation Feedback — ${orionSubject}`,
        draft_assessment_outline: `Assessment Outline — ${orionSubject} (${orionGrade})`,
        summarize_submission_progress: `Submission Progress Summary — ${orionGrade}`,
        summarize_cohort_coordination: `Cohort Coordination Brief`,
        summarize_class_insights: `Cohort Insights — ${orionGrade}`
      };

      setPendingDraft({
        intent,
        title: defaultTitleMap[intent],
        subject: orionSubject,
        grade: orionGrade,
        section: authorizedSections[0] || 'Solara',
        content: data.text,
        provider: data.providerUsed ? `${data.providerUsed} · ${data.modelUsed || ''}` : undefined
      });
    } catch (err: any) {
      setOrionError(err?.message || 'Unable to generate faculty draft right now.');
    } finally {
      setOrionLoading(false);
    }
  };

  // Explicit Confirmation Action before committing Orion output to Supabase / Backend
  const handleConfirmCommitDraft = async () => {
    if (!pendingDraft) return;
    setCommittingDraft(true);
    soundService.playButtonClick();

    try {
      if (pendingDraft.intent === 'draft_assignment' || pendingDraft.intent === 'draft_quiz') {
        const due = new Date();
        due.setDate(due.getDate() + 4);
        const hwPayload: Homework = {
          id: `hw-orion-${Date.now()}`,
          classGrade: pendingDraft.grade,
          classSection: (pendingDraft.section || 'All Sections') as any,
          subject: pendingDraft.subject,
          title: pendingDraft.title,
          content: pendingDraft.content,
          dueDate: due.toISOString().split('T')[0],
          givenBy: currentUser.name || 'Faculty',
          teacherId: userId,
          status: 'published',
          maxScore: 100,
          createdAt: new Date().toISOString(),
          completedList: []
        };
        const apiRes = await saveAssignment(currentUser, hwPayload, true);
        if (!apiRes.ok) throw new Error(apiRes.error || 'Failed to publish assignment.');
        await saveSupabaseHomework(apiRes.data || hwPayload).catch(() => {});
        showNotification(`✓ Confirmed & published assignment "${pendingDraft.title}" to ${pendingDraft.grade}.`);
      } else if (pendingDraft.intent === 'draft_announcement') {
        const annRes = await createTargetedAnnouncement(currentUser, {
          title: pendingDraft.title,
          content: pendingDraft.content,
          priority: 'normal',
          targetRole: 'student',
          targetGrade: pendingDraft.grade,
          targetSection: pendingDraft.section || 'all',
          status: 'published'
        });
        if (!annRes.ok) throw new Error(annRes.error || 'Failed to publish announcement.');
        if (annRes.data) {
          setTargetedAnnouncements(prev => [annRes.data!, ...prev]);
        }
        showNotification(`✓ Confirmed & dispatched targeted notice to ${pendingDraft.grade}.`);
      } else {
        await saveVaultNoteToSupabase(
          {
            id: `note-faculty-${Date.now()}`,
            title: pendingDraft.title,
            subject: pendingDraft.subject,
            content: pendingDraft.content,
            createdAt: new Date().toLocaleDateString(),
            userId
          },
          userId
        );
        showNotification(`✓ Confirmed & saved "${pendingDraft.title}" to Lecture Notes.`);
      }
      setPendingDraft(null);
    } catch (err: any) {
      showNotification(err?.message || 'Failed to save confirmed draft.');
    } finally {
      setCommittingDraft(false);
    }
  };

  const navTabs: Array<{
    id: FacultySubSection;
    label: string;
    icon: 'dashboard' | 'graduation' | 'attendance_manager' | 'homework' | 'analytics' | 'admin';
    visible: boolean;
  }> = [
    { id: 'overview', label: 'Overview', icon: 'dashboard', visible: true },
    {
      id: 'classes',
      label: 'Classes & Roster',
      icon: 'graduation',
      visible: hasFacultyCapability(effectiveRole, 'view_assigned_classes')
    },
    {
      id: 'assignments',
      label: 'Assignments',
      icon: 'homework',
      visible: hasFacultyCapability(effectiveRole, 'manage_assignments')
    },
    {
      id: 'attendance',
      label: 'Attendance',
      icon: 'attendance_manager',
      visible: hasFacultyCapability(effectiveRole, 'mark_attendance')
    },
    {
      id: 'gradebook',
      label: 'Marks & Gradebook',
      icon: 'analytics',
      visible: hasFacultyCapability(effectiveRole, 'manage_marks')
    },
    {
      id: 'coordination',
      label: 'Coordinator Oversight',
      icon: 'admin',
      visible: isCoordinatorPlus
    }
  ];

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12 select-text">
      {/* Top Sub-Navigation & Orion Copilot Launch */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4">
        <div className="flex items-center gap-1.5 p-1 bg-slate-900 border border-white/10 rounded-xl overflow-x-auto max-w-full">
          {navTabs
            .filter(t => t.visible)
            .map(tab => {
              const active = subSection === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    soundService.playButtonClick();
                    setSubSection(tab.id);
                  }}
                  className={`px-3.5 py-2 rounded-lg text-xs font-bold flex items-center gap-2 whitespace-nowrap transition-colors cursor-pointer ${
                    active
                      ? 'bg-sky-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  <VeylentraIcon name={tab.icon} size="sm" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
        </div>

        <button
          type="button"
          onClick={() => {
            soundService.playButtonClick();
            onOpenOrionFull(
              `Help me prepare lessons, assignments, or cohort analysis for ${authorizedGrades.join(', ')}.`
            );
          }}
          className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-sky-500/30 text-sky-300 hover:text-white text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer"
        >
          <VeylentraIcon name="orion" size="sm" />
          <span>Full Orion Copilot</span>
        </button>
      </div>

      {/* =====================================================================
          1. OVERVIEW HUB
      ====================================================================== */}
      {subSection === 'overview' && (
        <div className="space-y-6">
          {/* Faculty Header Card */}
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="bento-card p-6 bg-slate-900 border border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-6"
          >
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                <span className="font-semibold text-sky-400">{roleConfig.label}</span>
                <span aria-hidden="true">·</span>
                <span>{currentUser.department || 'Academic Department'}</span>
                <span aria-hidden="true">·</span>
                <span>{authorizedGrades.join(', ')}</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                {roleConfig.workspaceTitle}
              </h1>
              <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
                {roleConfig.workspaceSubtitle}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 shrink-0">
              <button
                type="button"
                onClick={() => {
                  soundService.playButtonClick();
                  setSubSection('attendance');
                }}
                className="px-4 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer"
              >
                <VeylentraIcon name="attendance_manager" size="sm" />
                <span>Mark Attendance</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  soundService.playButtonClick();
                  onNavigateTab('whiteboard');
                }}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <span>Open Whiteboard</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </motion.div>

          {/* Scoped Real KPI Strip */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
            <div className="bento-card p-4 bg-slate-900 border border-slate-800">
              <span className="text-xs font-semibold text-slate-400">Students in Scope</span>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-extrabold text-white tabular-nums">
                  {loadingCohort ? '...' : scopedStudents.length}
                </span>
                <span className="text-[11px] text-slate-500">
                  {authorizedGrades.length} grade{authorizedGrades.length === 1 ? '' : 's'}
                </span>
              </div>
            </div>

            <div className="bento-card p-4 bg-slate-900 border border-slate-800">
              <span className="text-xs font-semibold text-slate-400">Attendance Marked Today</span>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-extrabold text-emerald-400 tabular-nums">
                  {loadingCohort ? '...' : todayAttCount}
                </span>
                <span className="text-[11px] text-slate-500 tabular-nums">
                  / {scopedStudents.length}
                </span>
              </div>
            </div>

            <div className="bento-card p-4 bg-slate-900 border border-slate-800">
              <span className="text-xs font-semibold text-slate-400">Submissions to Review</span>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-extrabold text-amber-400 tabular-nums">
                  {pendingSubmissionsToReview}
                </span>
                <span className="text-[11px] text-slate-500">across {teacherHomework.length} tasks</span>
              </div>
            </div>

            <div className="bento-card p-4 bg-slate-900 border border-slate-800">
              <span className="text-xs font-semibold text-slate-400">Below 75% Attendance</span>
              <div className="mt-2 flex items-baseline gap-2">
                <span
                  className={`text-2xl font-extrabold tabular-nums ${
                    lowAttendanceStudents.length > 0 ? 'text-rose-400' : 'text-slate-200'
                  }`}
                >
                  {loadingCohort ? '...' : lowAttendanceStudents.length}
                </span>
                <span className="text-[11px] text-slate-500">need follow-up</span>
              </div>
            </div>
          </div>

          {/* Byte Faculty Reminders Strip (Non-AI Deterministic) */}
          <div className="bento-card p-5 bg-slate-900 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <VeylentraIcon name="byte" size="sm" />
                <div>
                  <h2 className="text-sm font-bold text-white">Byte Action Queue</h2>
                  <p className="text-[11px] text-slate-400">
                    Deterministic reminders from your live roster, schedule, and assignments
                  </p>
                </div>
              </div>
              <span className="text-[11px] font-semibold text-slate-400 tabular-nums">
                {facultyByteReminders.length} active
              </span>
            </div>

            {facultyByteReminders.length === 0 ? (
              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 text-xs text-slate-400 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>All faculty operational items are currently handled or snoozed.</span>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {facultyByteReminders.slice(0, 4).map(rem => (
                  <div
                    key={rem.id}
                    className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 flex flex-col justify-between gap-2.5"
                  >
                    <div className="space-y-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-xs font-bold text-white leading-snug">{rem.title}</p>
                        <span
                          className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-md shrink-0 ${
                            rem.priority === 'urgent'
                              ? 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
                              : rem.priority === 'high'
                              ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                              : 'bg-slate-800 text-slate-300'
                          }`}
                        >
                          {rem.priority}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400">{rem.reason}</p>
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-800/80">
                      <button
                        type="button"
                        onClick={() => {
                          soundService.playButtonClick();
                          if (rem.type === 'faculty_attendance') setSubSection('attendance');
                          else if (rem.type === 'faculty_grading') setSubSection('assignments');
                          else if (rem.type === 'coordinator_alert' && isCoordinatorPlus) setSubSection('coordination');
                          else onNavigateTab(rem.actionTab);
                        }}
                        className="text-xs font-bold text-sky-400 hover:text-sky-300 cursor-pointer"
                      >
                        {rem.actionLabel}
                      </button>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            snoozeByteReminder(userId, rem.id);
                            setReminderVersion(v => v + 1);
                            showNotification('Snoozed reminder for 1 hour.');
                          }}
                          className="px-2 py-1 rounded-md bg-slate-900 hover:bg-slate-800 text-[10px] text-slate-300 border border-slate-700 cursor-pointer"
                        >
                          Snooze 1h
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            markByteReminderHandled(userId, rem.id);
                            setReminderVersion(v => v + 1);
                          }}
                          className="px-2 py-1 rounded-md bg-emerald-500/15 hover:bg-emerald-500/25 text-[10px] font-semibold text-emerald-300 border border-emerald-500/30 cursor-pointer"
                        >
                          Done
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            dismissByteReminder(userId, rem.id);
                            setReminderVersion(v => v + 1);
                          }}
                          className="p-1 text-slate-500 hover:text-slate-200 cursor-pointer"
                          title="Dismiss reminder"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Split Row: Today's Schedule + Assignment Completion Chart */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Teaching Schedule */}
            <div className="bento-card p-5 bg-slate-900 border border-slate-800 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-sky-400" />
                  <h3 className="text-sm font-bold text-white">
                    Schedule · {todayTeachingSchedule.dayLabel}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => onNavigateTab('timetable_viewer')}
                  className="text-xs font-semibold text-sky-400 hover:underline cursor-pointer"
                >
                  Full Timetable
                </button>
              </div>

              {todayTeachingSchedule.periods.length === 0 ? (
                <p className="text-xs text-slate-400 py-6 text-center">
                  No periods loaded for your cohort timetable yet.
                </p>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                  {todayTeachingSchedule.periods.map((p: any, idx: number) => (
                    <div
                      key={`${p.periodNumber}-${idx}`}
                      className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="w-7 h-7 rounded-lg bg-slate-800 text-slate-200 text-xs font-bold flex items-center justify-center shrink-0 tabular-nums">
                          P{p.periodNumber}
                        </span>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-white truncate">{p.subject}</p>
                          <p className="text-[11px] text-slate-400 truncate">
                            {p.teacherName || currentUser.name} {p.room ? `· ${p.room}` : ''}
                          </p>
                        </div>
                      </div>
                      <span className="text-[11px] font-medium text-slate-400 shrink-0 tabular-nums">
                        {p.startTime} - {p.endTime}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Real Homework Completion Chart */}
            <div className="bento-card p-5 bg-slate-900 border border-slate-800 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white">Assignment Completion Overview</h3>
                  <p className="text-[11px] text-slate-400">
                    Real student completion rate across your recent assignments
                  </p>
                </div>
                <span className="text-xs font-bold text-slate-400 tabular-nums">
                  {teacherHomework.length} total
                </span>
              </div>

              {assignmentCompletionChartData.length === 0 ? (
                <div className="h-52 flex items-center justify-center text-xs text-slate-400 border border-dashed border-slate-800 rounded-xl">
                  No cohort assignments issued yet. Create one in Assignments.
                </div>
              ) : (
                <div className="h-56 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={assignmentCompletionChartData} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                      <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                      <YAxis domain={[0, 100]} tick={{ fill: '#94a3b8', fontSize: 11 }} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#020617',
                          border: '1px solid #334155',
                          borderRadius: '10px',
                          fontSize: '12px',
                          color: '#f8fafc'
                        }}
                        formatter={(value: any, _name: any, entry: any) => [
                          `${value}% (${entry?.payload?.submitted || 0} completed)`,
                          entry?.payload?.fullTitle || 'Completion'
                        ]}
                      />
                      <Bar dataKey="completionPct" radius={[6, 6, 0, 0]}>
                        {assignmentCompletionChartData.map((entry, idx) => (
                          <Cell
                            key={`cell-${idx}`}
                            fill={entry.completionPct >= 75 ? '#10b981' : '#0ea5e9'}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>

          {/* Orion Faculty Drafting Studio (Explicit Confirmation Before Saving) */}
          {hasFacultyCapability(effectiveRole, 'use_faculty_orion') && (
            <div className="bento-card p-6 bg-slate-900 border border-slate-800 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <VeylentraIcon name="orion" size="md" />
                  <div>
                    <h3 className="text-sm font-bold text-white">Orion Faculty Drafting & Insights</h3>
                    <p className="text-[11px] text-slate-400">
                      Generate drafts cleanly — nothing is saved or sent to students until you review and confirm.
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <input
                  type="text"
                  value={orionSubject}
                  onChange={e => setOrionSubject(e.target.value)}
                  placeholder="Subject (e.g. Physics)"
                  className="px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-sky-500"
                />
                <select
                  value={orionGrade}
                  onChange={e => setOrionGrade(e.target.value)}
                  className="px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-sky-500"
                >
                  {authorizedGrades.map(g => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  value={orionTopic}
                  onChange={e => setOrionTopic(e.target.value)}
                  placeholder="Topic or prompt (e.g. Newton's Laws Lab)"
                  className="px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-sky-500"
                />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <button
                  type="button"
                  disabled={orionLoading}
                  onClick={() => handleRunOrionDraft('draft_assignment')}
                  className="p-3 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-sky-500/40 text-left transition-colors cursor-pointer disabled:opacity-50"
                >
                  <p className="text-xs font-bold text-white">Draft Assignment</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">Tasks + rubric</p>
                </button>
                <button
                  type="button"
                  disabled={orionLoading}
                  onClick={() => handleRunOrionDraft('draft_lesson_plan')}
                  className="p-3 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-sky-500/40 text-left transition-colors cursor-pointer disabled:opacity-50"
                >
                  <p className="text-xs font-bold text-white">Draft Lesson Plan</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">45-min flow</p>
                </button>
                <button
                  type="button"
                  disabled={orionLoading}
                  onClick={() => handleRunOrionDraft('draft_assessment_outline')}
                  className="p-3 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-sky-500/40 text-left transition-colors cursor-pointer disabled:opacity-50"
                >
                  <p className="text-xs font-bold text-white">Assessment Outline</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">Blueprint + marks</p>
                </button>
                <button
                  type="button"
                  disabled={orionLoading}
                  onClick={() => handleRunOrionDraft('draft_quiz')}
                  className="p-3 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-sky-500/40 text-left transition-colors cursor-pointer disabled:opacity-50"
                >
                  <p className="text-xs font-bold text-white">Draft Quick Quiz</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">5 Qs + key</p>
                </button>
                <button
                  type="button"
                  disabled={orionLoading}
                  onClick={() => handleRunOrionDraft('draft_announcement')}
                  className="p-3 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-sky-500/40 text-left transition-colors cursor-pointer disabled:opacity-50"
                >
                  <p className="text-xs font-bold text-white">Draft Circular</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">Notice preview</p>
                </button>
                <button
                  type="button"
                  disabled={orionLoading}
                  onClick={() => handleRunOrionDraft('summarize_submission_progress')}
                  className="p-3 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-amber-500/40 text-left transition-colors cursor-pointer disabled:opacity-50"
                >
                  <p className="text-xs font-bold text-amber-300">Submission Summary</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">Pending &amp; late brief</p>
                </button>
                <button
                  type="button"
                  disabled={orionLoading}
                  onClick={() => handleRunOrionDraft('summarize_class_insights')}
                  className="p-3 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-emerald-500/40 text-left transition-colors cursor-pointer disabled:opacity-50"
                >
                  <p className="text-xs font-bold text-emerald-300">Cohort Insights</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">Real data brief</p>
                </button>
                {isCoordinatorPlus && (
                  <button
                    type="button"
                    disabled={orionLoading}
                    onClick={() => handleRunOrionDraft('summarize_cohort_coordination')}
                    className="p-3 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-sky-500/40 text-left transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <p className="text-xs font-bold text-sky-300">Coord. Oversight Brief</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">Attendance &amp; pacing</p>
                  </button>
                )}
              </div>

              {orionLoading && (
                <div className="p-4 rounded-xl bg-slate-950 border border-sky-500/30 flex items-center gap-3 text-xs text-sky-300">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Orion is preparing an editable draft for your review...</span>
                </div>
              )}

              {orionError && (
                <div className="p-4 rounded-xl bg-rose-950/30 border border-rose-500/30 flex items-center justify-between gap-3 text-xs text-rose-300">
                  <span>{orionError}</span>
                  <button
                    type="button"
                    onClick={() => setOrionError(null)}
                    className="text-rose-200 underline cursor-pointer"
                  >
                    Dismiss
                  </button>
                </div>
              )}

              {pendingDraft && (
                <div className="p-5 rounded-2xl bg-slate-950 border border-sky-500/40 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
                    <div>
                      <span className="text-xs font-bold text-sky-400 flex items-center gap-1.5">
                        <ShieldCheck className="w-4 h-4" />
                        <span>Draft Ready — Review & Edit Before Saving</span>
                      </span>
                      {pendingDraft.provider && (
                        <p className="text-[10px] text-slate-500 mt-0.5">
                          Generated via {pendingDraft.provider}
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => setPendingDraft(null)}
                      className="text-xs text-slate-400 hover:text-white cursor-pointer"
                    >
                      Discard Draft
                    </button>
                  </div>

                  <input
                    type="text"
                    value={pendingDraft.title}
                    onChange={e =>
                      setPendingDraft(prev => (prev ? { ...prev, title: e.target.value } : null))
                    }
                    className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-xs font-bold text-white focus:outline-none focus:border-sky-500"
                  />

                  <textarea
                    rows={8}
                    value={pendingDraft.content}
                    onChange={e =>
                      setPendingDraft(prev => (prev ? { ...prev, content: e.target.value } : null))
                    }
                    className="w-full p-3 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-200 leading-relaxed focus:outline-none focus:border-sky-500"
                  />

                  <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                    <p className="text-[11px] text-slate-400">
                      Target cohort: {pendingDraft.grade} ({pendingDraft.section})
                    </p>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setPendingDraft(null)}
                        className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        disabled={committingDraft}
                        onClick={handleConfirmCommitDraft}
                        className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                      >
                        {committingDraft ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Check className="w-3.5 h-3.5" />
                        )}
                        <span>
                          {pendingDraft.intent === 'draft_assignment' ||
                          pendingDraft.intent === 'draft_quiz'
                            ? 'Confirm & Publish Assignment'
                            : pendingDraft.intent === 'draft_announcement'
                            ? 'Confirm & Send Announcement'
                            : 'Confirm & Save to Notes'}
                        </span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Targeted Circulars & Announcements Panel */}
          <div className="bento-card p-5 bg-slate-900 border border-slate-800 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <Megaphone className="w-4 h-4 text-sky-400" />
                <div>
                  <h3 className="text-sm font-bold text-white">Targeted Circulars &amp; Announcements</h3>
                  <p className="text-[11px] text-slate-400">
                    Publish grade/section-scoped circulars with draft/archive control and read tracking
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  soundService.playButtonClick();
                  setShowAnnComposer(v => !v);
                }}
                className="px-3.5 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{showAnnComposer ? 'Close Composer' : 'New Circular'}</span>
              </button>
            </div>

            {showAnnComposer && (
              <form
                onSubmit={handleSaveTargetedAnnouncement}
                className="p-4 rounded-xl bg-slate-950 border border-sky-500/30 space-y-3"
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
                  <input
                    type="text"
                    required
                    value={annTitle}
                    onChange={e => setAnnTitle(e.target.value)}
                    placeholder="Circular title"
                    className="sm:col-span-2 px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-xs text-white focus:outline-none focus:border-sky-500"
                  />
                  <select
                    value={annTargetRole}
                    onChange={e => setAnnTargetRole(e.target.value as any)}
                    className="px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-xs text-white"
                  >
                    <option value="student">Students</option>
                    <option value="all">All Roles</option>
                    <option value="parent">Parents</option>
                    <option value="teacher">Faculty Only</option>
                  </select>
                  <select
                    value={annTargetGrade}
                    onChange={e => setAnnTargetGrade(e.target.value)}
                    className="px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-xs text-white"
                  >
                    <option value="all">All Authorized Grades</option>
                    {authorizedGrades.map(g => (
                      <option key={g} value={g}>{g}</option>
                    ))}
                  </select>
                  <select
                    value={annTargetSection}
                    onChange={e => setAnnTargetSection(e.target.value)}
                    className="px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-xs text-white"
                  >
                    <option value="all">All Sections</option>
                    {(annTargetGrade !== 'all' ? getSectionsForGrade(annTargetGrade) : authorizedSections).map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>

                <textarea
                  rows={3}
                  required
                  value={annContent}
                  onChange={e => setAnnContent(e.target.value)}
                  placeholder="Write the circular details for your target cohort..."
                  className="w-full p-3 rounded-lg bg-slate-900 border border-slate-800 text-xs text-white focus:outline-none focus:border-sky-500"
                />

                <div className="flex flex-wrap items-center justify-between gap-2.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      value={annPriority}
                      onChange={e => setAnnPriority(e.target.value as any)}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-white"
                    >
                      <option value="normal">Priority: Normal</option>
                      <option value="important">Priority: Important</option>
                      <option value="urgent">Priority: Urgent</option>
                    </select>
                    <select
                      value={annStatus}
                      onChange={e => setAnnStatus(e.target.value as any)}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-white"
                    >
                      <option value="published">Publish Immediately</option>
                      <option value="draft">Save as Draft</option>
                    </select>
                    <input
                      type="url"
                      value={annAttachUrl}
                      onChange={e => setAnnAttachUrl(e.target.value)}
                      placeholder="Optional resource URL (https://...)"
                      className="px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-white w-56"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={savingAnn}
                    className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    {savingAnn ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                    <span>{annStatus === 'draft' ? 'Save Draft' : 'Publish Circular'}</span>
                  </button>
                </div>
              </form>
            )}

            {targetedAnnouncements.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {targetedAnnouncements.slice(0, 4).map(ann => (
                  <div
                    key={ann.id}
                    className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 flex flex-col justify-between gap-2"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] font-bold uppercase text-sky-400">
                          {ann.targetGrade === 'all' ? 'All Grades' : ann.targetGrade} · {ann.targetSection === 'all' ? 'All Sections' : ann.targetSection}
                        </span>
                        <span
                          className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${
                            ann.status === 'draft'
                              ? 'bg-slate-800 text-slate-300'
                              : ann.status === 'archived'
                              ? 'bg-slate-900 text-slate-500'
                              : ann.priority === 'urgent'
                              ? 'bg-rose-500/20 text-rose-300'
                              : 'bg-emerald-500/15 text-emerald-300'
                          }`}
                        >
                          {ann.status}
                        </span>
                      </div>
                      <p className="text-xs font-bold text-white mt-1">{ann.title}</p>
                      <p className="text-[11px] text-slate-400 line-clamp-2 mt-0.5">{ann.content}</p>
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 text-[10px] text-slate-400">
                      <span>{ann.authorName} · {ann.targetRole}</span>
                      <div className="flex items-center gap-2">
                        {ann.status === 'draft' && (
                          <button
                            type="button"
                            onClick={async () => {
                              const res = await updateTargetedAnnouncement(currentUser, ann.id, { status: 'published' });
                              if (res.ok && res.data) {
                                setTargetedAnnouncements(prev => prev.map(x => (x.id === ann.id ? res.data! : x)));
                                showNotification('Circular published.');
                              }
                            }}
                            className="text-emerald-400 font-bold hover:underline cursor-pointer"
                          >
                            Publish
                          </button>
                        )}
                        {ann.status === 'published' && (
                          <button
                            type="button"
                            onClick={async () => {
                              const res = await updateTargetedAnnouncement(currentUser, ann.id, { status: 'archived' });
                              if (res.ok && res.data) {
                                setTargetedAnnouncements(prev => prev.map(x => (x.id === ann.id ? res.data! : x)));
                                showNotification('Circular archived.');
                              }
                            }}
                            className="text-slate-400 hover:text-white cursor-pointer"
                          >
                            Archive
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* =====================================================================
          2. CLASSES & SCOPED STUDENT ROSTER
      ====================================================================== */}
      {subSection === 'classes' && (
        <div className="space-y-6">
          <div className="bento-card p-5 bg-slate-900 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-white">Authorized Cohorts & Student Roster</h2>
              <p className="text-xs text-slate-400">
                Scoped strictly to {authorizedGrades.join(', ')} ({authorizedSections.join(', ')})
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={rosterSearch}
                  onChange={e => setRosterSearch(e.target.value)}
                  placeholder="Search student..."
                  className="pl-8 pr-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-sky-500"
                />
              </div>
              <select
                value={cohortGradeFilter}
                onChange={e => setCohortGradeFilter(e.target.value)}
                className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-sky-500"
              >
                <option value="All">All Authorized Grades</option>
                {authorizedGrades.map(g => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="bento-card overflow-hidden bg-slate-900 border border-slate-800">
            {filteredRoster.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">
                {loadingCohort
                  ? 'Loading authorized cohort roster...'
                  : 'No students matched the current authorized grade/section filter.'}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950 text-slate-400 border-b border-slate-800">
                    <tr>
                      <th className="py-3 px-4 font-semibold">Student</th>
                      <th className="py-3 px-4 font-semibold">Grade / Section</th>
                      <th className="py-3 px-4 font-semibold">House</th>
                      <th className="py-3 px-4 font-semibold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/70">
                    {filteredRoster.slice(0, 60).map(st => (
                      <tr key={st.uid || st.email} className="hover:bg-slate-800/40">
                        <td className="py-3 px-4">
                          <p className="font-bold text-white">{st.name}</p>
                          <p className="text-[11px] text-slate-500">{st.email}</p>
                        </td>
                        <td className="py-3 px-4 text-slate-300">
                          {st.grade || '—'} · {st.section || '—'}
                        </td>
                        <td className="py-3 px-4 text-slate-400">{st.house || '—'}</td>
                        <td className="py-3 px-4 text-right">
                          <button
                            type="button"
                            onClick={() => {
                              setOrionTopic(`Prepare a supportive 2-week academic follow-up plan for ${st.name}`);
                              setSubSection('overview');
                            }}
                            className="text-xs font-semibold text-sky-400 hover:underline cursor-pointer"
                          >
                            Draft Feedback
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* =====================================================================
          3. ASSIGNMENTS & EVALUATION WORKFLOW
      ====================================================================== */}
      {subSection === 'assignments' && (
        <div className="space-y-6">
          <div className="bento-card p-5 bg-slate-900 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-white">Assignments & Submission Review</h2>
              <p className="text-xs text-slate-400">
                Publish homework for {authorizedGrades.join(', ')} and track completion status
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                soundService.playButtonClick();
                setShowCreateAssignment(v => !v);
              }}
              className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>{showCreateAssignment ? 'Close Form' : 'New Assignment'}</span>
            </button>
          </div>

          {showCreateAssignment && (
            <form
              onSubmit={handleCreateAssignment}
              className="bento-card p-5 bg-slate-900 border border-sky-500/30 space-y-4"
            >
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-bold text-white">Create Scoped Class Assignment</h3>
                <select
                  value={newHwStatus}
                  onChange={e => setNewHwStatus(e.target.value as AssignmentLifecycleStatus)}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs font-semibold text-white"
                >
                  <option value="published">Status: Publish Now</option>
                  <option value="draft">Status: Save as Draft</option>
                </select>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <input
                  type="text"
                  required
                  value={newHwTitle}
                  onChange={e => setNewHwTitle(e.target.value)}
                  placeholder="Assignment title"
                  className="px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-sky-500"
                />
                <input
                  type="text"
                  required
                  value={newHwSubject}
                  onChange={e => setNewHwSubject(e.target.value)}
                  placeholder="Subject"
                  className="px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-sky-500"
                />
                <select
                  value={newHwGrade}
                  onChange={e => {
                    setNewHwGrade(e.target.value);
                    const secs = getSectionsForGrade(e.target.value);
                    if (secs.length > 0 && !secs.includes(newHwSection)) setNewHwSection(secs[0]);
                  }}
                  className="px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-sky-500"
                >
                  {authorizedGrades.map(g => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </select>
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={newHwSection}
                    onChange={e => setNewHwSection(e.target.value)}
                    className="px-2.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-sky-500"
                  >
                    <option value="All Sections">All Sections</option>
                    {getSectionsForGrade(newHwGrade).map(s => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                  <input
                    type="date"
                    value={newHwDueDate}
                    onChange={e => setNewHwDueDate(e.target.value)}
                    className="px-2.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-sky-500"
                  />
                </div>
              </div>
              <textarea
                rows={4}
                required
                value={newHwContent}
                onChange={e => setNewHwContent(e.target.value)}
                placeholder="Instructions, problems, and submission expectations..."
                className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-sky-500"
              />
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[10px] font-semibold text-slate-400 mb-1">Max Marks</label>
                  <input
                    type="number"
                    min={1}
                    max={1000}
                    value={newHwMaxScore}
                    onChange={e => setNewHwMaxScore(Number(e.target.value) || 100)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-slate-400 mb-1">Attachment Label (optional)</label>
                  <input
                    type="text"
                    value={newHwAttachName}
                    onChange={e => setNewHwAttachName(e.target.value)}
                    placeholder="e.g. Lab Worksheet PDF"
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-slate-400 mb-1">Resource Link (optional)</label>
                  <input
                    type="url"
                    value={newHwAttachUrl}
                    onChange={e => setNewHwAttachUrl(e.target.value)}
                    placeholder="https://..."
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreateAssignment(false)}
                  className="px-3.5 py-2 rounded-xl bg-slate-800 text-xs font-semibold text-slate-300 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingAssignment}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {savingAssignment ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  <span>{newHwStatus === 'draft' ? 'Save Draft Assignment' : 'Publish Assignment'}</span>
                </button>
              </div>
            </form>
          )}

          {teacherHomework.length === 0 ? (
            <div className="bento-card p-8 bg-slate-900 border border-slate-800 text-center text-xs text-slate-400">
              No assignments recorded for your authorized classes yet.
            </div>
          ) : (
            <div className="space-y-4">
              {teacherHomework.map((hw: any) => {
                const cohortEligibleStudents = scopedStudents.filter(st =>
                  isStudentMatchedToCohort(st.grade, st.section, hw.classGrade, hw.classSection)
                );
                const submittedCount = Number(hw?.stats?.submittedCount ?? (hw.completedList?.length || 0));
                const evaluatedCount = Number(hw?.stats?.evaluatedCount || 0);
                const lateCount = Number(hw?.stats?.lateCount || 0);
                const pendingCount = Math.max(0, cohortEligibleStudents.length - submittedCount);
                const isExpanded = expandedSubmissionHwId === hw.id;
                const subsList = submissionsByHw[hw.id] || [];
                const submittedStudentIds = new Set(subsList.map(s => s.studentId));
                const notSubmittedStudents = cohortEligibleStudents.filter(st => !submittedStudentIds.has(st.uid));
                const statusBadge = (hw.status || 'published').toLowerCase();

                return (
                  <div
                    key={hw.id}
                    className="bento-card p-5 bg-slate-900 border border-slate-800 space-y-4"
                  >
                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[11px] font-semibold text-sky-400">
                            {hw.subject} · {hw.classGrade} ({hw.classSection})
                          </span>
                          <span
                            className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                              statusBadge === 'draft'
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                : statusBadge === 'archived'
                                ? 'bg-slate-800 text-slate-400'
                                : 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                            }`}
                          >
                            {statusBadge}
                          </span>
                          <span className="text-[11px] text-slate-400 tabular-nums">
                            Max {hw.maxScore || 100} pts · Due {hw.dueDate}
                          </span>
                        </div>
                        <h4 className="text-base font-bold text-white">{hw.title}</h4>
                        <p className="text-xs text-slate-300 whitespace-pre-line">{hw.content}</p>
                        {Array.isArray(hw.attachments) && hw.attachments.length > 0 && (
                          <div className="flex flex-wrap gap-2 pt-1">
                            {hw.attachments.map((att: AssignmentAttachment) => (
                              <a
                                key={att.id}
                                href={att.url}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-[11px] text-sky-300 hover:border-sky-500/40"
                              >
                                <FileText className="w-3 h-3" />
                                <span>{att.name}</span>
                                <ExternalLink className="w-2.5 h-2.5" />
                              </a>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        {statusBadge === 'draft' && (
                          <button
                            type="button"
                            onClick={() => handleToggleAssignmentLifecycle(hw, 'published')}
                            className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold cursor-pointer"
                          >
                            Publish to Students
                          </button>
                        )}
                        {statusBadge === 'published' && (
                          <button
                            type="button"
                            onClick={() => handleToggleAssignmentLifecycle(hw, 'archived')}
                            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer"
                          >
                            Archive
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleToggleSubmissionsPanel(hw.id)}
                          className="px-3.5 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold cursor-pointer"
                        >
                          {isExpanded ? 'Hide Submissions' : `Inspect Submissions (${submittedCount})`}
                        </button>
                      </div>
                    </div>

                    {/* Real-time Assignment Progress Strip */}
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-3 border-t border-slate-800 text-center">
                      <div className="p-2 rounded-lg bg-slate-950/70 border border-slate-800">
                        <p className="text-[10px] text-slate-400">Assigned Cohort</p>
                        <p className="text-sm font-bold text-white tabular-nums">{cohortEligibleStudents.length}</p>
                      </div>
                      <div className="p-2 rounded-lg bg-slate-950/70 border border-slate-800">
                        <p className="text-[10px] text-slate-400">Submitted</p>
                        <p className="text-sm font-bold text-sky-400 tabular-nums">{submittedCount}</p>
                      </div>
                      <div className="p-2 rounded-lg bg-slate-950/70 border border-slate-800">
                        <p className="text-[10px] text-slate-400">Pending</p>
                        <p className="text-sm font-bold text-amber-400 tabular-nums">{pendingCount}</p>
                      </div>
                      <div className="p-2 rounded-lg bg-slate-950/70 border border-slate-800">
                        <p className="text-[10px] text-slate-400">Late</p>
                        <p className="text-sm font-bold text-rose-400 tabular-nums">{lateCount}</p>
                      </div>
                      <div className="p-2 rounded-lg bg-slate-950/70 border border-slate-800">
                        <p className="text-[10px] text-slate-400">Evaluated</p>
                        <p className="text-sm font-bold text-emerald-400 tabular-nums">{evaluatedCount}</p>
                      </div>
                    </div>

                    {/* Expandable Submissions & Evaluation Panel */}
                    {isExpanded && (
                      <div className="pt-3 border-t border-slate-800 space-y-4">
                        {loadingSubsHwId === hw.id ? (
                          <div className="p-4 text-xs text-sky-300 flex items-center gap-2">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>Loading student submissions...</span>
                          </div>
                        ) : (
                          <>
                            {subsList.length === 0 ? (
                              <p className="text-xs text-slate-400 p-3 rounded-xl bg-slate-950 border border-slate-800">
                                No student submissions received for this assignment yet.
                              </p>
                            ) : (
                              <div className="space-y-3">
                                <h5 className="text-xs font-bold text-slate-300 uppercase tracking-wide">
                                  Submitted Work ({subsList.length})
                                </h5>
                                {subsList.map(sub => {
                                  const key = `${hw.id}::${sub.studentId}`;
                                  const draft = evalDrafts[key] || {
                                    score: sub.score !== null && sub.score !== undefined ? String(sub.score) : '',
                                    feedback: sub.feedback || ''
                                  };
                                  return (
                                    <div
                                      key={sub.id}
                                      className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3"
                                    >
                                      <div className="flex flex-wrap items-center justify-between gap-2">
                                        <div>
                                          <span className="text-xs font-bold text-white">{sub.studentName}</span>
                                          <span className="text-[11px] text-slate-400 ml-2">
                                            {sub.classGrade} · {sub.classSection} · {new Date(sub.submittedAt).toLocaleString()}
                                          </span>
                                        </div>
                                        <span
                                          className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                                            sub.status === 'evaluated'
                                              ? 'bg-emerald-500/20 text-emerald-300'
                                              : sub.status === 'returned_for_revision'
                                              ? 'bg-amber-500/20 text-amber-300'
                                              : sub.isLate
                                              ? 'bg-rose-500/20 text-rose-300'
                                              : 'bg-sky-500/20 text-sky-300'
                                          }`}
                                        >
                                          {sub.status.replace(/_/g, ' ')}
                                        </span>
                                      </div>

                                      {sub.submissionText && (
                                        <p className="text-xs text-slate-200 bg-slate-900/90 p-3 rounded-lg border border-slate-800 whitespace-pre-wrap">
                                          {sub.submissionText}
                                        </p>
                                      )}

                                      {sub.attachmentUrl && (
                                        <a
                                          href={sub.attachmentUrl}
                                          target="_blank"
                                          rel="noreferrer"
                                          className="inline-flex items-center gap-1.5 text-xs text-sky-400 hover:underline"
                                        >
                                          <FileText className="w-3.5 h-3.5" />
                                          <span>{sub.attachmentName || sub.attachmentUrl}</span>
                                          <ExternalLink className="w-3 h-3" />
                                        </a>
                                      )}

                                      <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5 items-start">
                                        <div>
                                          <label className="block text-[10px] text-slate-400 mb-1">
                                            Score (0–{hw.maxScore || 100})
                                          </label>
                                          <input
                                            type="number"
                                            min={0}
                                            max={hw.maxScore || 100}
                                            value={draft.score}
                                            onChange={e =>
                                              setEvalDrafts(prev => ({
                                                ...prev,
                                                [key]: { ...draft, score: e.target.value, error: undefined }
                                              }))
                                            }
                                            placeholder={`/${hw.maxScore || 100}`}
                                            className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white tabular-nums"
                                          />
                                        </div>
                                        <div className="sm:col-span-3">
                                          <label className="block text-[10px] text-slate-400 mb-1">
                                            Teacher Feedback (released to student on save)
                                          </label>
                                          <textarea
                                            rows={2}
                                            value={draft.feedback}
                                            onChange={e =>
                                              setEvalDrafts(prev => ({
                                                ...prev,
                                                [key]: { ...draft, feedback: e.target.value, error: undefined }
                                              }))
                                            }
                                            placeholder="Constructive evaluation notes..."
                                            className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white"
                                          />
                                        </div>
                                      </div>

                                      {draft.error && (
                                        <p className="text-[11px] text-rose-400 font-semibold">{draft.error}</p>
                                      )}

                                      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                                        <button
                                          type="button"
                                          disabled={draft.orionLoading}
                                          onClick={() => handleDraftSubmissionFeedbackWithOrion(hw, sub)}
                                          className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-sky-500/30 text-[11px] font-semibold text-sky-300 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                                        >
                                          {draft.orionLoading ? (
                                            <Loader2 className="w-3 h-3 animate-spin" />
                                          ) : (
                                            <VeylentraIcon name="orion" size="sm" />
                                          )}
                                          <span>Draft Feedback with Orion</span>
                                        </button>

                                        <div className="flex items-center gap-2">
                                          <button
                                            type="button"
                                            disabled={draft.saving}
                                            onClick={() => handleSaveEvaluation(hw, sub, 'return_for_revision')}
                                            className="px-3 py-1.5 rounded-lg bg-amber-600/20 hover:bg-amber-600/30 border border-amber-500/40 text-amber-200 text-xs font-bold cursor-pointer disabled:opacity-50"
                                          >
                                            Return for Revision
                                          </button>
                                          <button
                                            type="button"
                                            disabled={draft.saving}
                                            onClick={() => handleSaveEvaluation(hw, sub, 'evaluate')}
                                            className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                                          >
                                            {draft.saving ? (
                                              <Loader2 className="w-3 h-3 animate-spin" />
                                            ) : (
                                              <Check className="w-3.5 h-3.5" />
                                            )}
                                            <span>Save &amp; Release Evaluation</span>
                                          </button>
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}

                            {notSubmittedStudents.length > 0 && (
                              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1.5">
                                <p className="text-[11px] font-bold text-amber-300">
                                  Not Yet Submitted ({notSubmittedStudents.length})
                                </p>
                                <div className="flex flex-wrap gap-1.5">
                                  {notSubmittedStudents.slice(0, 20).map(st => (
                                    <span
                                      key={st.uid || st.email}
                                      className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-[11px] text-slate-300"
                                    >
                                      {st.name}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* =====================================================================
          4. SCOPED ATTENDANCE REGISTER
      ====================================================================== */}
      {subSection === 'attendance' && (
        <div className="space-y-4">
          <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-300 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>
              Scoped to authorized classes ({authorizedGrades.join(', ')}). Status overwrites and bulk updates require confirmation before saving.
            </span>
          </div>
          <AttendanceManager currentUser={currentUser} effectiveRole={effectiveRole as any} />
        </div>
      )}

      {/* =====================================================================
          5. MARKS & DIGITAL GRADEBOOK
      ====================================================================== */}
      {subSection === 'gradebook' && (
        <div className="space-y-4">
          <StudentMarksCenter
            currentUser={currentUser}
            effectiveRole={effectiveRole}
            showNotification={showNotification}
          />
        </div>
      )}

      {/* =====================================================================
          6. COORDINATOR / HOD OVERSIGHT (Role-Gated)
      ====================================================================== */}
      {subSection === 'coordination' && isCoordinatorPlus && (
        <div className="space-y-6">
          {/* Scoped Attendance Compliance Alerts */}
          <div className="bento-card p-5 bg-slate-900 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                <h3 className="text-sm font-bold text-white">
                  Authorized Cohort Attendance Threshold Alerts (&lt;75%)
                </h3>
              </div>
              <span className="text-xs text-slate-400 tabular-nums">
                {lowAttendanceStudents.length} flagged
              </span>
            </div>

            {lowAttendanceStudents.length === 0 ? (
              <p className="text-xs text-slate-400">
                No students with at least 3 recorded sessions are below 75% in your authorized cohort.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                {lowAttendanceStudents.slice(0, 9).map(st => (
                  <div
                    key={st.uid}
                    className="p-3 rounded-xl bg-slate-950/70 border border-rose-500/20 flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-white truncate">{st.name}</p>
                      <p className="text-[11px] text-slate-400">
                        {st.grade} ({st.section}) · {st.total} sessions
                      </p>
                    </div>
                    <span className="text-xs font-extrabold text-rose-400 tabular-nums shrink-0">
                      {st.pct}%
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <CoordinatorModule currentUser={currentUser} showNotification={showNotification} />
          <OfficialTimetableViewer currentUser={currentUser} effectiveRole={effectiveRole as any} />
        </div>
      )}
    </div>
  );
};
