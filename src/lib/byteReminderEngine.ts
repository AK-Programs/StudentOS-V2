/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Byte Deterministic Productivity Reminder Engine
 *
 * Strict separation rule:
 * - Byte NEVER invokes LLMs or AI APIs.
 * - All reminders are generated strictly from real application & DB state.
 * - Explains WHY each reminder needs attention.
 * - Supports persistent dismiss, mark-handled, and snooze per user.
 * - Respects user notification preferences.
 */

import { AssignmentSubmission, GradebookAssessment, Homework, Task, UserProfile, UserRole } from '../types';
import { OfficialClassTimetable, ExamPreparationPlan } from '../types/syllabusTimetable';
import { getAuthorizedGrades, isFacultyRole } from '../config/facultyPermissions';
import { isAnnouncementEligibleForUser, isStudentMatchedToCohort } from './academicWorkflowService';

export interface AnnouncementItem {
  id?: string;
  title?: string;
  priority?: string;
  senderName?: string;
  targetGrade?: string;
  [key: string]: any;
}

export type ByteReminderPriority = 'urgent' | 'high' | 'normal';

export type ByteReminderCategory =
  | 'class'
  | 'assignment'
  | 'exam'
  | 'attendance'
  | 'flashcards'
  | 'task'
  | 'announcement'
  | 'faculty_attendance'
  | 'faculty_grading'
  | 'coordinator_alert';

export interface ByteReminderItem {
  id: string;
  title: string;
  subtitle: string;
  reason: string;
  type: ByteReminderCategory;
  priority: ByteReminderPriority;
  actionLabel: string;
  actionTab: string;
  actionSubTab?: string;
}

export interface ByteReminderPersistedState {
  dismissedIds: string[];
  handledIds: string[];
  snoozedUntil: Record<string, number>;
}

const STORAGE_PREFIX = 'veylentra_byte_reminders_v1_';

function getStorageKey(userId?: string | null): string {
  return `${STORAGE_PREFIX}${userId || 'guest'}`;
}

export function loadByteReminderState(userId?: string | null): ByteReminderPersistedState {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return { dismissedIds: [], handledIds: [], snoozedUntil: {} };
    }
    const raw = localStorage.getItem(getStorageKey(userId));
    if (!raw) return { dismissedIds: [], handledIds: [], snoozedUntil: {} };
    const parsed = JSON.parse(raw);
    return {
      dismissedIds: Array.isArray(parsed.dismissedIds) ? parsed.dismissedIds : [],
      handledIds: Array.isArray(parsed.handledIds) ? parsed.handledIds : [],
      snoozedUntil: parsed.snoozedUntil && typeof parsed.snoozedUntil === 'object' ? parsed.snoozedUntil : {}
    };
  } catch {
    return { dismissedIds: [], handledIds: [], snoozedUntil: {} };
  }
}

export function saveByteReminderState(userId: string | null | undefined, state: ByteReminderPersistedState): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    localStorage.setItem(getStorageKey(userId), JSON.stringify(state));
  } catch {
    // Ignore storage quota issues safely
  }
}

export function dismissByteReminder(userId: string | null | undefined, reminderId: string): ByteReminderPersistedState {
  const current = loadByteReminderState(userId);
  const next: ByteReminderPersistedState = {
    ...current,
    dismissedIds: Array.from(new Set([...current.dismissedIds, reminderId]))
  };
  saveByteReminderState(userId, next);
  return next;
}

export function markByteReminderHandled(userId: string | null | undefined, reminderId: string): ByteReminderPersistedState {
  const current = loadByteReminderState(userId);
  const next: ByteReminderPersistedState = {
    ...current,
    handledIds: Array.from(new Set([...current.handledIds, reminderId]))
  };
  saveByteReminderState(userId, next);
  return next;
}

export function snoozeByteReminder(
  userId: string | null | undefined,
  reminderId: string,
  durationMs: number = 60 * 60 * 1000
): ByteReminderPersistedState {
  const current = loadByteReminderState(userId);
  const next: ByteReminderPersistedState = {
    ...current,
    snoozedUntil: {
      ...current.snoozedUntil,
      [reminderId]: Date.now() + durationMs
    }
  };
  saveByteReminderState(userId, next);
  return next;
}

export function resetByteReminderState(userId?: string | null): ByteReminderPersistedState {
  const empty: ByteReminderPersistedState = { dismissedIds: [], handledIds: [], snoozedUntil: {} };
  saveByteReminderState(userId, empty);
  return empty;
}

function parseTimeToMinutes(hhmm?: string): number | null {
  if (!hhmm || typeof hhmm !== 'string') return null;
  const parts = hhmm.split(':');
  if (parts.length < 2) return null;
  const h = Number(parts[0]);
  const m = Number(parts[1]);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
}

function daysBetweenToday(dateStr?: string): number | null {
  if (!dateStr) return null;
  const target = new Date(dateStr);
  if (Number.isNaN(target.getTime())) return null;
  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startTarget = new Date(target.getFullYear(), target.getMonth(), target.getDate()).getTime();
  return Math.round((startTarget - startToday) / 86400000);
}

export interface BuildByteRemindersInput {
  currentUser: UserProfile;
  effectiveRole: UserRole | string;
  homeworkList?: Homework[];
  submissions?: AssignmentSubmission[];
  assessments?: GradebookAssessment[];
  tasks?: Task[];
  announcements?: AnnouncementItem[];
  dueCardsCount?: number;
  attendancePercentage?: number | null;
  attendanceTotalConducted?: number;
  timetable?: OfficialClassTimetable | null;
  upcomingExams?: ExamPreparationPlan[];
  todayAttendanceMarkedCount?: number;
  totalCohortStudentsCount?: number;
  now?: Date;
  ignorePersistedState?: boolean;
}

export function isCategoryEnabledByPrefs(currentUser: UserProfile, category: ByteReminderCategory): boolean {
  const prefs = currentUser?.raw_data?.notificationPreferences || {};
  if (prefs.muteAll === true || prefs.byteReminders === false) return false;
  if (category === 'assignment' && prefs.homeworkAlerts === false) return false;
  if (category === 'announcement' && prefs.announcements === false) return false;
  if ((category === 'attendance' || category === 'faculty_attendance') && prefs.attendanceAlerts === false) return false;
  return true;
}

export function buildByteReminders(input: BuildByteRemindersInput): ByteReminderItem[] {
  const {
    currentUser,
    effectiveRole,
    homeworkList = [],
    submissions = [],
    assessments = [],
    tasks = [],
    announcements = [],
    dueCardsCount = 0,
    attendancePercentage = null,
    attendanceTotalConducted = 0,
    timetable = null,
    upcomingExams = [],
    todayAttendanceMarkedCount,
    totalCohortStudentsCount,
    now = new Date(),
    ignorePersistedState = false
  } = input;

  const userId = currentUser?.uid || currentUser?.email || '';
  const role = String(effectiveRole || currentUser?.role || 'student').toLowerCase();
  const rawList: ByteReminderItem[] = [];
  const seenIds = new Set<string>();

  const pushUnique = (item: ByteReminderItem) => {
    if (seenIds.has(item.id)) return;
    if (!isCategoryEnabledByPrefs(currentUser, item.type)) return;
    seenIds.add(item.id);
    rawList.push(item);
  };

  // 1. Live Next Class / Teaching Period from Official Timetable
  if (timetable?.schedule?.length) {
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const todayName = dayNames[now.getDay()];
    const todaySchedule = timetable.schedule.find(d => d.day.toLowerCase() === todayName.toLowerCase());
    if (todaySchedule) {
      const currentMinutes = now.getHours() * 60 + now.getMinutes();
      const candidatePeriods = todaySchedule.periods.filter(p => !p.isBreak && p.subject);
      const scopedPeriods = role === 'teacher' && currentUser?.name
        ? candidatePeriods.filter(p =>
            !p.teacherName || p.teacherName.toLowerCase().includes(currentUser.name.toLowerCase())
          )
        : candidatePeriods;
      const listToSearch = scopedPeriods.length > 0 ? scopedPeriods : candidatePeriods;

      const upcomingOrCurrent = listToSearch.find(p => {
        const end = parseTimeToMinutes(p.endTime);
        return end !== null && end > currentMinutes;
      });

      if (upcomingOrCurrent) {
        const start = parseTimeToMinutes(upcomingOrCurrent.startTime);
        const minsUntil = start !== null ? start - currentMinutes : null;
        const isLive = minsUntil !== null && minsUntil <= 0;
        const isStartingSoon = minsUntil !== null && minsUntil > 0 && minsUntil <= 45;

        if (isLive || isStartingSoon) {
          pushUnique({
            id: `timetable-period-${todayName}-${upcomingOrCurrent.periodNumber}`,
            title: isLive
              ? `In Progress: ${upcomingOrCurrent.subject}`
              : `Next Class in ${minsUntil}m: ${upcomingOrCurrent.subject}`,
            subtitle: `${upcomingOrCurrent.startTime} - ${upcomingOrCurrent.endTime}${upcomingOrCurrent.room ? ` · ${upcomingOrCurrent.room}` : ''}`,
            reason: isLive
              ? `Period ${upcomingOrCurrent.periodNumber} is currently active on today's official timetable.`
              : `Period ${upcomingOrCurrent.periodNumber} starts in ${minsUntil} minutes.`,
            type: 'class',
            priority: isLive || (minsUntil !== null && minsUntil <= 15) ? 'urgent' : 'high',
            actionLabel: 'View Timetable',
            actionTab: role === 'student' ? 'timetable_viewer' : 'faculty'
          });
        }
      }
    }
  }

  // 2. Role-specific reminders
  if (role === 'student') {
    // Low attendance warning (<75%) from real DB counts
    if (attendancePercentage !== null && attendanceTotalConducted > 0 && attendancePercentage < 75) {
      pushUnique({
        id: 'student-attendance-threshold',
        title: `Attendance is ${attendancePercentage.toFixed(1)}% (below 75%)`,
        subtitle: `${attendanceTotalConducted} recorded sessions this term`,
        reason: 'Your recorded attendance is currently below the 75% threshold.',
        type: 'attendance',
        priority: 'urgent',
        actionLabel: 'Attendance Center',
        actionTab: 'attendance'
      });
    }

    // Connected Submissions: Evaluated marks released or Returned for Revision
    const studentSubs = submissions.filter(
      s => s.studentId === userId || (currentUser?.email && s.studentEmail === currentUser.email)
    );
    const hwById = new Map<string, Homework>(homeworkList.map(h => [h.id, h]));

    studentSubs
      .filter(s => s.status === 'returned_for_revision' || (s.status === 'evaluated' && s.resultsReleased))
      .slice(0, 3)
      .forEach(sub => {
        const parentHw = hwById.get(sub.assignmentId);
        const isRevision = sub.status === 'returned_for_revision';
        pushUnique({
          id: `hw-eval-${sub.assignmentId}-${sub.status}`,
          title: isRevision
            ? `Revision Requested: ${parentHw?.title || 'Assignment'}`
            : `Evaluated: ${parentHw?.title || 'Assignment'} (${sub.score !== null && sub.score !== undefined ? `${sub.score}/${sub.maxScore}` : 'Graded'})`,
          subtitle: sub.feedback ? `Feedback: ${sub.feedback.slice(0, 80)}` : `Reviewed by ${sub.evaluatedBy || 'Teacher'}`,
          reason: isRevision
            ? 'Your teacher returned this submission for revision — review feedback and resubmit.'
            : 'Teacher evaluation & marks have been released for your submission.',
          type: 'assignment',
          priority: isRevision ? 'urgent' : 'high',
          actionLabel: isRevision ? 'Revise & Resubmit' : 'View Feedback',
          actionTab: 'homework'
        });
      });

    // Overdue & Due-Soon Homework (respecting published status & grade/section targeting)
    const relevantHw = homeworkList.filter(hw => {
      if ((hw.status || 'published') !== 'published') return false;
      const sub =
        studentSubs.find(s => s.assignmentId === hw.id) ||
        ((hw as any).mySubmission as AssignmentSubmission | undefined);
      if (sub && sub.status !== 'returned_for_revision') return false;
      const done = (hw.completedList || []).includes(userId);
      if (done && (!sub || sub.status !== 'returned_for_revision')) return false;
      return isStudentMatchedToCohort(currentUser?.grade, currentUser?.section, hw.classGrade, hw.classSection);
    });

    relevantHw
      .map(hw => ({ hw, daysLeft: daysBetweenToday(hw.dueDate) }))
      .sort((a, b) => (a.daysLeft ?? 99) - (b.daysLeft ?? 99))
      .slice(0, 4)
      .forEach(({ hw, daysLeft }) => {
        const isOverdue = daysLeft !== null && daysLeft < 0;
        const isDueSoon = daysLeft !== null && daysLeft >= 0 && daysLeft <= 2;
        pushUnique({
          id: `hw-${hw.id}`,
          title: `${hw.subject || 'Assignment'}: ${hw.title}`,
          subtitle: hw.dueDate ? `Due ${hw.dueDate}` : 'Assigned homework',
          reason: isOverdue
            ? `Due date passed ${Math.abs(daysLeft)} day(s) ago and no submission is recorded.`
            : isDueSoon
            ? daysLeft === 0
              ? 'Due today — complete and submit your work to stay on track.'
              : `Due in ${daysLeft} day(s).`
            : 'Pending assignment assigned to your class.',
          type: 'assignment',
          priority: isOverdue ? 'urgent' : isDueSoon ? 'high' : 'normal',
          actionLabel: 'Open Assignment',
          actionTab: 'homework'
        });
      });

    // Upcoming published Gradebook Assessments + Released Exam Results (never leaks draft/cancelled)
    assessments
      .filter(a => a.status !== 'draft' && isStudentMatchedToCohort(currentUser?.grade, currentUser?.section, a.classGrade, a.classSection))
      .forEach(ass => {
        if (ass.status === 'published') {
          const daysLeft = daysBetweenToday(ass.date);
          if (daysLeft !== null && daysLeft >= 0 && daysLeft <= 10) {
            pushUnique({
              id: `ass-upcoming-${ass.id}`,
              title: `${ass.subject}: ${ass.title}`,
              subtitle: `${ass.date} (${daysLeft === 0 ? 'Today' : `in ${daysLeft}d`}) · ${ass.type}`,
              reason: ass.syllabusCoverage
                ? `Published assessment covering: ${ass.syllabusCoverage.slice(0, 90)}.`
                : `Published assessment scheduled ${daysLeft === 0 ? 'today' : `in ${daysLeft} day(s)`}.`,
              type: 'exam',
              priority: daysLeft <= 3 ? 'urgent' : 'high',
              actionLabel: 'Prep Exam',
              actionTab: 'dashboard'
            });
          }
          if (ass.resultsPublished) {
            pushUnique({
              id: `ass-res-${ass.id}`,
              title: `Results Published: ${ass.title}`,
              subtitle: `${ass.subject} (${ass.type})`,
              reason: 'Official assessment results have been released by your teacher.',
              type: 'exam',
              priority: 'normal',
              actionLabel: 'View Gradebook',
              actionTab: 'performance'
            });
          }
        }
      });

    // Upcoming exams within 10 days (ExamPreparationPlan schedule)
    upcomingExams
      .filter(ex => ex.status !== 'completed')
      .map(ex => ({ ex, daysLeft: daysBetweenToday(ex.examDate) }))
      .filter(item => item.daysLeft !== null && item.daysLeft >= 0 && item.daysLeft <= 10)
      .sort((a, b) => (a.daysLeft ?? 99) - (b.daysLeft ?? 99))
      .slice(0, 2)
      .forEach(({ ex, daysLeft }) => {
        pushUnique({
          id: `exam-${ex.id}`,
          title: `${ex.subject}: ${ex.examName}`,
          subtitle: `${ex.examDate} (${daysLeft === 0 ? 'Today' : `in ${daysLeft}d`})`,
          reason: `Official exam scheduled ${daysLeft === 0 ? 'today' : `in ${daysLeft} day(s)`} with ${ex.chaptersIncluded.length} included chapter(s).`,
          type: 'exam',
          priority: daysLeft !== null && daysLeft <= 3 ? 'urgent' : 'high',
          actionLabel: 'Prep Exam',
          actionTab: 'dashboard'
        });
      });

    // Due flashcards from SM-2 state
    if (dueCardsCount > 0) {
      pushUnique({
        id: 'flashcards-due',
        title: `${dueCardsCount} flashcard${dueCardsCount === 1 ? '' : 's'} due for review`,
        subtitle: 'Spaced repetition active recall',
        reason: `You have ${dueCardsCount} scheduled card(s) ready in your spaced-repetition queue.`,
        type: 'flashcards',
        priority: dueCardsCount >= 10 ? 'high' : 'normal',
        actionLabel: 'Review Cards',
        actionTab: 'study_hub',
        actionSubTab: 'flashcards'
      });
    }
  } else if (isFacultyRole(role)) {
    const authorizedGrades = getAuthorizedGrades(currentUser).map(g => g.toLowerCase());

    // Teacher attendance register check
    if (
      typeof totalCohortStudentsCount === 'number' &&
      totalCohortStudentsCount > 0 &&
      typeof todayAttendanceMarkedCount === 'number' &&
      todayAttendanceMarkedCount < totalCohortStudentsCount
    ) {
      const unmarked = totalCohortStudentsCount - todayAttendanceMarkedCount;
      pushUnique({
        id: `faculty-att-${now.toISOString().split('T')[0]}`,
        title: `Today's attendance register: ${unmarked} unmarked`,
        subtitle: `${todayAttendanceMarkedCount} of ${totalCohortStudentsCount} students marked`,
        reason: 'Some students in your authorized cohort do not have an attendance status recorded for today.',
        type: 'faculty_attendance',
        priority: 'high',
        actionLabel: 'Mark Attendance',
        actionTab: 'attendance_manager'
      });
    }

    // Connected Submissions waiting for evaluation + legacy completion fallback
    const scopedHomework = homeworkList.filter(hw => {
      if (hw.status === 'archived') return false;
      const byTeacher = hw.givenBy && currentUser?.name && hw.givenBy.toLowerCase() === currentUser.name.toLowerCase();
      const inGrade = hw.classGrade && authorizedGrades.includes(hw.classGrade.toLowerCase());
      return byTeacher || inGrade;
    });

    const pendingEvalSubs = submissions.filter(
      s => s.status === 'submitted' || s.status === 'late' || s.status === 'under_evaluation'
    );
    const pendingFromStats = scopedHomework.reduce((acc, hw: any) => acc + Number(hw?.stats?.pendingEvaluationCount || 0), 0);
    const totalPendingEvaluations = pendingEvalSubs.length > 0 ? pendingEvalSubs.length : pendingFromStats;

    if (totalPendingEvaluations > 0) {
      const lateCount = pendingEvalSubs.filter(s => s.isLate || s.status === 'late').length;
      pushUnique({
        id: `faculty-pending-eval-${scopedHomework[0]?.id || 'queue'}`,
        title: `${totalPendingEvaluations} submission${totalPendingEvaluations === 1 ? '' : 's'} awaiting evaluation`,
        subtitle: lateCount > 0 ? `Includes ${lateCount} late submission(s)` : 'Ready for review & feedback release',
        reason: 'Students have submitted work that still needs teacher marks or feedback.',
        type: 'faculty_grading',
        priority: lateCount > 0 ? 'urgent' : 'high',
        actionLabel: 'Evaluate Submissions',
        actionTab: 'faculty'
      });
    } else {
      const withSubmissions = scopedHomework.filter(hw => (hw.completedList?.length || 0) > 0);
      if (withSubmissions.length > 0) {
        const totalCompletions = withSubmissions.reduce((acc, hw) => acc + (hw.completedList?.length || 0), 0);
        pushUnique({
          id: `faculty-grading-${withSubmissions[0].id}`,
          title: `${totalCompletions} homework submission${totalCompletions === 1 ? '' : 's'} ready to review`,
          subtitle: `Across ${withSubmissions.length} active assignment${withSubmissions.length === 1 ? '' : 's'}`,
          reason: 'Students have submitted assigned homework; review submissions or update gradebook marks.',
          type: 'faculty_grading',
          priority: 'high',
          actionLabel: 'Review Work',
          actionTab: 'faculty'
        });
      }
    }

    // Upcoming faculty assessments that still have unpublished results after exam date
    assessments
      .filter(a => a.status === 'published' && !a.resultsPublished)
      .forEach(ass => {
        const daysLeft = daysBetweenToday(ass.date);
        if (daysLeft !== null && daysLeft < 0) {
          pushUnique({
            id: `faculty-ass-pub-${ass.id}`,
            title: `Results Pending Release: ${ass.title}`,
            subtitle: `${ass.classGrade} · Exam date ${ass.date}`,
            reason: 'Assessment date has passed and marks have not yet been published to students.',
            type: 'faculty_grading',
            priority: 'high',
            actionLabel: 'Open Gradebook',
            actionTab: 'gradebook'
          });
        }
      });

    if (role === 'coordinator') {
      pushUnique({
        id: 'coordinator-section-audit',
        title: `Coordinator Oversight: ${getAuthorizedGrades(currentUser).join(', ')}`,
        subtitle: 'Section compliance, timetable coverage & attendance alerts',
        reason: 'Review authorized section attendance trends and upcoming schedule coverage.',
        type: 'coordinator_alert',
        priority: 'normal',
        actionLabel: 'Open Oversight',
        actionTab: 'faculty'
      });
    }
  }

  // 3. Pending personal tasks (all non-parent roles)
  const pendingTasks = tasks.filter(t => !t.completed);
  if (pendingTasks.length > 0) {
    const highPriorityTask = pendingTasks.find(t => t.priority === 'high') || pendingTasks[0];
    pushUnique({
      id: `task-${highPriorityTask.id}`,
      title: pendingTasks.length === 1 ? `Task: ${highPriorityTask.title}` : `${pendingTasks.length} pending tasks`,
      subtitle: pendingTasks.length > 1 ? `Top priority: ${highPriorityTask.title}` : 'Personal checklist',
      reason: 'Open task remaining in your personal planner.',
      type: 'task',
      priority: highPriorityTask.priority === 'high' ? 'high' : 'normal',
      actionLabel: 'Open Tasks',
      actionTab: 'study_hub',
      actionSubTab: 'tasks'
    });
  }

  // 4. Latest eligible unread / high-priority circular (strictly scoped & published)
  const eligibleAnnouncements = announcements.filter(
    a => !a.isRead && isAnnouncementEligibleForUser(a, currentUser)
  );
  if (eligibleAnnouncements.length > 0) {
    const urgentAnn = eligibleAnnouncements.find(a => a.priority === 'urgent') || eligibleAnnouncements[0];
    pushUnique({
      id: `ann-${urgentAnn.id}`,
      title: urgentAnn.title || 'School Notice',
      subtitle: `${urgentAnn.authorName || urgentAnn.senderName || 'School Circular'}${urgentAnn.targetGrade && urgentAnn.targetGrade !== 'all' ? ` · ${urgentAnn.targetGrade}` : ''}`,
      reason: urgentAnn.priority === 'urgent' ? 'Marked urgent notice for your academic cohort.' : 'Unread targeted circular posted to your cohort.',
      type: 'announcement',
      priority: urgentAnn.priority === 'urgent' ? 'high' : 'normal',
      actionLabel: 'Read Notice',
      actionTab: 'notice_viewer'
    });
  }

  // Filter persisted dismissed, handled, or active snooze items
  const filtered = ignorePersistedState
    ? rawList
    : (() => {
        const persisted = loadByteReminderState(userId);
        const nowMs = now.getTime();
        return rawList.filter(item => {
          if (persisted.dismissedIds.includes(item.id)) return false;
          if (persisted.handledIds.includes(item.id)) return false;
          const snoozed = persisted.snoozedUntil[item.id];
          if (typeof snoozed === 'number' && snoozed > nowMs) return false;
          return true;
        });
      })();

  // Sort strictly: urgent -> high -> normal
  const priorityWeight: Record<ByteReminderPriority, number> = {
    urgent: 0,
    high: 1,
    normal: 2
  };
  return filtered.sort((a, b) => priorityWeight[a.priority] - priorityWeight[b.priority]);
}

/**
 * Deterministic natural-language matcher for Byte voice/text queries.
 * Uses ONLY real active reminders and schedule/state — NEVER calls AI.
 */
export function answerByteQueryLocally(
  query: string,
  reminders: ByteReminderItem[],
  context?: { nextClassText?: string | null; attendanceSummaryText?: string | null }
): { summary: string; matchingReminders: ByteReminderItem[] } {
  const q = (query || '').toLowerCase().trim();
  if (!q) {
    return {
      summary:
        reminders.length > 0
          ? `You have ${reminders.length} active reminder${reminders.length === 1 ? '' : 's'}. Top priority: ${reminders[0].title}.`
          : 'You are all caught up — no urgent reminders right now.',
      matchingReminders: reminders
    };
  }

  if (q.includes('class') || q.includes('timetable') || q.includes('schedule') || q.includes('period')) {
    const classItems = reminders.filter(r => r.type === 'class');
    return {
      summary:
        context?.nextClassText ||
        (classItems.length > 0
          ? `${classItems[0].title} (${classItems[0].subtitle}).`
          : 'No immediate class period is starting within the next 45 minutes.'),
      matchingReminders: classItems.length > 0 ? classItems : reminders.slice(0, 3)
    };
  }

  if (q.includes('homework') || q.includes('assignment') || q.includes('due') || q.includes('submit')) {
    const hwItems = reminders.filter(r => r.type === 'assignment' || r.type === 'faculty_grading');
    return {
      summary:
        hwItems.length > 0
          ? `Found ${hwItems.length} assignment reminder${hwItems.length === 1 ? '' : 's'}: ${hwItems.map(i => i.title).join('; ')}.`
          : 'No pending assignment reminders found right now.',
      matchingReminders: hwItems
    };
  }

  if (q.includes('attendance') || q.includes('present') || q.includes('absent')) {
    const attItems = reminders.filter(r => r.type === 'attendance' || r.type === 'faculty_attendance');
    return {
      summary:
        context?.attendanceSummaryText ||
        (attItems.length > 0 ? `${attItems[0].title} — ${attItems[0].reason}` : 'No attendance alerts right now.'),
      matchingReminders: attItems
    };
  }

  if (q.includes('exam') || q.includes('test')) {
    const examItems = reminders.filter(r => r.type === 'exam');
    return {
      summary:
        examItems.length > 0
          ? `Upcoming exam alert: ${examItems.map(i => `${i.title} (${i.subtitle})`).join('; ')}.`
          : 'No upcoming exams within the next 10 days in the official calendar.',
      matchingReminders: examItems
    };
  }

  if (q.includes('flashcard') || q.includes('card') || q.includes('task') || q.includes('todo')) {
    const studyItems = reminders.filter(r => r.type === 'flashcards' || r.type === 'task');
    return {
      summary:
        studyItems.length > 0
          ? studyItems.map(i => `${i.title}: ${i.reason}`).join(' ')
          : 'No due flashcards or pending tasks right now.',
      matchingReminders: studyItems
    };
  }

  // Fallback keyword filter across active reminders
  const tokens = q.split(/\s+/).filter(w => w.length > 2);
  const matched = reminders.filter(r => {
    const hay = `${r.title} ${r.subtitle} ${r.reason} ${r.type}`.toLowerCase();
    return tokens.some(t => hay.includes(t));
  });

  if (matched.length > 0) {
    return {
      summary: `Found ${matched.length} matching reminder${matched.length === 1 ? '' : 's'}: ${matched[0].title} — ${matched[0].reason}`,
      matchingReminders: matched
    };
  }

  return {
    summary:
      reminders.length > 0
        ? `Showing your ${reminders.length} current reminder${reminders.length === 1 ? '' : 's'}. For full AI explanations or creating plans, switch to Orion.`
        : 'All caught up in Byte reminders. For AI study help or drafting, switch to Orion.',
    matchingReminders: reminders
  };
}
