/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Veylentra Authoritative Engagement, Streak, Mission & Policy Engine (System 2.0)
 * - Replaces hardcoded 8-day fallback streaks with trusted server-evaluated streak state
 * - Supports explicit states: active | at_risk | frozen | recovery_available | recovered | expired
 * - Verified Streak Recovery requires server-confirmed learning evidence (rejects unverified 1-click claims & duplicates)
 * - Role-aware mission & checklist evaluator (Student, Teacher, Coordinator, Admin, Super Admin)
 * - Admin & Super Admin configurable policies with versioned history & immutable audit trail
 */

import express from 'express';
import crypto from 'crypto';
import {
  supabaseFetchWithAnonRetry,
  getFeatureAndWinterSupabaseKey,
  WORKING_ANON_KEY,
} from './supabaseKeyManager';
import { ALLOWED_GAMIFICATION_ACTION_XP } from './rewardEngine';
import {
  EvaluatedMission,
  resolveApplicableMissionDefinitions,
} from '../src/lib/roleTaskRegistry';
import { hasTeacherRecordedAttendanceToday } from './academicWorkflowModule';

export type ServerStreakState =
  | 'active'
  | 'at_risk'
  | 'frozen'
  | 'recovery_available'
  | 'recovered'
  | 'expired';

export interface ServerStreakHistoryEntry {
  id: string;
  activityDate: string;
  eventType: 'maintained' | 'missed' | 'frozen' | 'recovery_available' | 'recovered' | 'expired';
  streakBefore: number;
  streakAfter: number;
  source?: string;
  createdAt: string;
}

export interface ServerStreakRecord {
  userId: string;
  currentStreak: number;
  longestStreak: number;
  streakState: ServerStreakState;
  frozenStreakCount: number;
  lastActiveDate: string | null;
  timezone: string;
  recoveryDeadline: string | null;
  recoveryLastUsedAt: string | null;
  recoveriesThisMonth: number;
  recoveryMonthKey: string | null;
  recoveryCurrentProgress: number;
  recoveryActivityDates: Record<string, { flashcards: number; quizzes: number; studyMinutes: number; actions: number; missionProgress: Record<string, number> }>;
  claimedMissions: Record<string, { claimedAt: string; xpAwarded: number }>;
  history: ServerStreakHistoryEntry[];
  recentReturnContext?: {
    title: string;
    subtitle: string;
    ctaLabel: string;
    actionTab: string;
    actionSubTab?: string;
    reason: string;
    updatedAt: string;
  } | null;
  updatedAt: string;
}

export interface EngagementPolicyConfig {
  version: number;
  updatedAt: string;
  updatedBy: string;
  streakRecoveryEnabled: boolean;
  maxMissedDaysForRecovery: number;
  requiredRecoveryActivity: 'review_flashcards' | 'complete_quiz' | 'review_flashcards_or_quiz' | 'study_session';
  recoveryRequiredCount: number;
  recoveryCooldownDays: number;
  maxRecoveriesPerMonth: number;
  defaultTimezone: string;
  weeklyStudentXpGoal: number;
  weeklyFacultyActionsGoal: number;
  maxVisibleFlyouts: number;
  flyoutCooldownSeconds: number;
  defaultBroadcastTtlHours: number;
  featureFlags: {
    dailyMissions: boolean;
    streakRecovery: boolean;
    levelUpCelebration: boolean;
    badgeCelebration: boolean;
    smartReturn: boolean;
    facultyChecklists: boolean;
    adminOpsTasks: boolean;
  };
}

export interface EngagementAuditEntry {
  id: string;
  actorUserId: string;
  actorEmail: string;
  actorRole: string;
  action: string;
  summary: string;
  previousConfig?: Partial<EngagementPolicyConfig>;
  nextConfig?: Partial<EngagementPolicyConfig>;
  createdAt: string;
}

export interface EngagementModuleDeps {
  getSupabaseServerConfig: () => { url: string; key: string };
  getVerifiedUserFromRequest: (req: express.Request) => Promise<{
    id: string;
    name: string;
    email?: string;
    role: string;
    grade?: string;
    section?: string;
    isVerifiedJwt: boolean;
  } | null>;
  broadcastToAllWs: (payload: any) => void;
  getGamificationStore: () => Record<string, any>;
}

const DEFAULT_POLICY_CONFIG: EngagementPolicyConfig = {
  version: 1,
  updatedAt: '2026-11-01T00:00:00.000Z',
  updatedBy: 'Veylentra System',
  streakRecoveryEnabled: true,
  maxMissedDaysForRecovery: 2,
  requiredRecoveryActivity: 'review_flashcards_or_quiz',
  recoveryRequiredCount: 5,
  recoveryCooldownDays: 7,
  maxRecoveriesPerMonth: 2,
  defaultTimezone: 'Asia/Kolkata',
  weeklyStudentXpGoal: 300,
  weeklyFacultyActionsGoal: 12,
  maxVisibleFlyouts: 1,
  flyoutCooldownSeconds: 45,
  defaultBroadcastTtlHours: 72,
  featureFlags: {
    dailyMissions: true,
    streakRecovery: true,
    levelUpCelebration: true,
    badgeCelebration: true,
    smartReturn: true,
    facultyChecklists: true,
    adminOpsTasks: true,
  },
};

const POLICY_DOC_ID = '__veylentra_engagement_policy_v2__';
const AUDIT_DOC_ID = '__veylentra_engagement_audit_v2__';
const USER_STREAK_DOC_PREFIX = 'engagement_streak_v2_';

let memoryPolicyConfig: EngagementPolicyConfig = {
  ...DEFAULT_POLICY_CONFIG,
  featureFlags: { ...DEFAULT_POLICY_CONFIG.featureFlags },
};
let memoryAuditLogs: EngagementAuditEntry[] = [];
const memoryUserRecords = new Map<string, ServerStreakRecord>();

const SERVER_LEVELS = [
  { level: 1, title: 'Curious Learner', minXp: 0 },
  { level: 2, title: 'Dedicated Scholar', minXp: 100 },
  { level: 3, title: 'Active Student', minXp: 250 },
  { level: 4, title: 'Focused Scholar', minXp: 450 },
  { level: 5, title: 'Knowledge Builder', minXp: 700 },
  { level: 6, title: 'Academic Achiever', minXp: 1000 },
  { level: 7, title: 'Top Performer', minXp: 1400 },
  { level: 8, title: 'Honor Student', minXp: 1900 },
  { level: 9, title: 'Master Scholar', minXp: 2500 },
  { level: 10, title: 'Campus Legend', minXp: 3200 },
];

export function formatDateInTimezone(nowMs: number, timeZone: string): string {
  const safeTz = timeZone || 'Asia/Kolkata';
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: safeTz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(new Date(nowMs));
    const y = parts.find(p => p.type === 'year')?.value;
    const m = parts.find(p => p.type === 'month')?.value;
    const d = parts.find(p => p.type === 'day')?.value;
    if (y && m && d) return `${y}-${m}-${d}`;
  } catch (_) {}
  return new Date(nowMs).toISOString().split('T')[0];
}

export function diffCalendarDays(fromYmd: string, toYmd: string): number {
  const [fy, fm, fd] = fromYmd.split('-').map(Number);
  const [ty, tm, td] = toYmd.split('-').map(Number);
  if (!fy || !fm || !fd || !ty || !tm || !td) return 999;
  const fromUtc = Date.UTC(fy, fm - 1, fd);
  const toUtc = Date.UTC(ty, tm - 1, td);
  return Math.round((toUtc - fromUtc) / 86400000);
}

export function getWeekPeriodKey(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(Number);
  const dt = new Date(Date.UTC(y, (m || 1) - 1, d || 1));
  const dayNum = dt.getUTCDay() || 7;
  dt.setUTCDate(dt.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(dt.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((dt.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${dt.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

export function getMonthKey(ymd: string): string {
  return ymd.slice(0, 7);
}

export function computeLevelBreakdown(xp: number) {
  const safeXp = Math.max(0, Number(xp || 0));
  let current = SERVER_LEVELS[0];
  let next: (typeof SERVER_LEVELS)[number] | null = SERVER_LEVELS[1] || null;
  for (let i = 0; i < SERVER_LEVELS.length; i++) {
    if (safeXp >= SERVER_LEVELS[i].minXp) {
      current = SERVER_LEVELS[i];
      next = SERVER_LEVELS[i + 1] || null;
    }
  }
  const span = next ? next.minXp - current.minXp : 1;
  const progress = next ? Math.min(100, Math.max(0, Math.round(((safeXp - current.minXp) / span) * 100))) : 100;
  return {
    level: current.level,
    levelTitle: current.title,
    nextLevelXp: next ? next.minXp : null,
    progressPercent: progress,
  };
}

/**
 * Pure deterministic streak evaluation based on trusted server time & policy.
 */
export function evaluateStreakTransition(
  record: ServerStreakRecord,
  policy: EngagementPolicyConfig,
  nowMs: number = Date.now()
): {
  record: ServerStreakRecord;
  todayDate: string;
  recoveryEligible: boolean;
  recoveryBlockedReason: string | null;
} {
  const tz = record.timezone || policy.defaultTimezone || 'Asia/Kolkata';
  const todayDate = formatDateInTimezone(nowMs, tz);
  const monthKey = getMonthKey(todayDate);

  const next: ServerStreakRecord = {
    ...record,
    timezone: tz,
    recoveryActivityDates: { ...(record.recoveryActivityDates || {}) },
    claimedMissions: { ...(record.claimedMissions || {}) },
    history: [...(record.history || [])],
  };

  if (next.recoveryMonthKey !== monthKey) {
    next.recoveriesThisMonth = 0;
    next.recoveryMonthKey = monthKey;
  }

  // Zero streak user stays cleanly at 0 (NEVER coerced to 1 or 8!)
  if (next.currentStreak <= 0 && next.frozenStreakCount <= 0 && !next.lastActiveDate) {
    next.currentStreak = 0;
    next.streakState = 'active';
    return {
      record: next,
      todayDate,
      recoveryEligible: false,
      recoveryBlockedReason: 'Start your first activity to begin a streak.',
    };
  }

  const lastDate = next.lastActiveDate;
  const daysGap = lastDate ? diffCalendarDays(lastDate, todayDate) : 0;

  if (daysGap <= 0) {
    // Active today (preserve 'recovered' badge for today if recovered today)
    if (next.streakState !== 'recovered') {
      next.streakState = 'active';
    }
    return {
      record: next,
      todayDate,
      recoveryEligible: false,
      recoveryBlockedReason: null,
    };
  }

  if (daysGap === 1) {
    // Last active yesterday -> streak is intact and at_risk today until an activity is completed
    if (next.currentStreak > 0) {
      next.streakState = 'at_risk';
    } else {
      next.streakState = 'active';
    }
    return {
      record: next,
      todayDate,
      recoveryEligible: false,
      recoveryBlockedReason: null,
    };
  }

  // Missed at least 1 full day (daysGap >= 2)
  const missedFullDays = daysGap - 1;
  const recoveryFeatureActive = policy.streakRecoveryEnabled && policy.featureFlags.streakRecovery;

  if (recoveryFeatureActive && missedFullDays <= policy.maxMissedDaysForRecovery) {
    const preservedCount = Math.max(next.frozenStreakCount || 0, next.currentStreak || 0);
    if (preservedCount > 0) {
      if (next.streakState !== 'recovery_available' && next.streakState !== 'frozen') {
        next.frozenStreakCount = preservedCount;
        next.streakState = 'recovery_available';
        // Deadline is end of the last allowed recovery day in UTC approximation
        next.recoveryDeadline = new Date(
          nowMs + Math.max(1, policy.maxMissedDaysForRecovery - missedFullDays + 1) * 86400000
        ).toISOString();
        next.history.unshift({
          id: `sh_${crypto.randomBytes(4).toString('hex')}`,
          activityDate: todayDate,
          eventType: 'frozen',
          streakBefore: preservedCount,
          streakAfter: preservedCount,
          source: 'server_evaluator',
          createdAt: new Date(nowMs).toISOString(),
        });
      }

      // Check cooldown & monthly limits
      let blockedReason: string | null = null;
      if (next.recoveriesThisMonth >= policy.maxRecoveriesPerMonth) {
        blockedReason = `Monthly recovery limit reached (${policy.maxRecoveriesPerMonth}/${policy.maxRecoveriesPerMonth}).`;
      } else if (next.recoveryLastUsedAt) {
        const lastUsedDate = formatDateInTimezone(new Date(next.recoveryLastUsedAt).getTime(), tz);
        const daysSinceLastRecovery = diffCalendarDays(lastUsedDate, todayDate);
        if (daysSinceLastRecovery < policy.recoveryCooldownDays) {
          const remaining = policy.recoveryCooldownDays - daysSinceLastRecovery;
          blockedReason = `Recovery cooldown active (${remaining} day${remaining === 1 ? '' : 's'} remaining).`;
        }
      }

      return {
        record: next,
        todayDate,
        recoveryEligible: blockedReason === null,
        recoveryBlockedReason: blockedReason,
      };
    }
  }

  // Beyond recovery window or recovery disabled -> Expired
  if (next.currentStreak > 0 || next.frozenStreakCount > 0) {
    const before = Math.max(next.currentStreak, next.frozenStreakCount);
    next.longestStreak = Math.max(next.longestStreak, before);
    next.currentStreak = 0;
    next.frozenStreakCount = 0;
    next.streakState = 'expired';
    next.recoveryDeadline = null;
    if (!next.history.some(h => h.activityDate === todayDate && h.eventType === 'expired')) {
      next.history.unshift({
        id: `sh_${crypto.randomBytes(4).toString('hex')}`,
        activityDate: todayDate,
        eventType: 'expired',
        streakBefore: before,
        streakAfter: 0,
        source: 'server_evaluator',
        createdAt: new Date(nowMs).toISOString(),
      });
    }
  } else {
    next.streakState = 'expired';
  }

  return {
    record: next,
    todayDate,
    recoveryEligible: false,
    recoveryBlockedReason: 'Recovery window has expired for missed days.',
  };
}

export function getRecoveryProgressForDate(
  record: ServerStreakRecord,
  dateYmd: string,
  policy: EngagementPolicyConfig,
  role: string = 'student'
): number {
  const dayEntry = record.recoveryActivityDates?.[dateYmd];
  if (!dayEntry) return 0;
  const userRole = String(role || 'student').toLowerCase();

  if (userRole === 'teacher') {
    return (dayEntry.missionProgress?.teacher_daily_attendance || 0) +
      (dayEntry.missionProgress?.teacher_evaluate_submissions || 0) +
      Math.min(1, dayEntry.actions || 0);
  }
  if (userRole === 'coordinator') {
    return (dayEntry.missionProgress?.coordinator_cohort_attendance_audit || 0) +
      (dayEntry.missionProgress?.coordinator_submission_compliance || 0) +
      Math.min(1, dayEntry.actions || 0);
  }
  if (userRole === 'admin' || userRole === 'super_admin') {
    return (dayEntry.missionProgress?.admin_approvals_queue_review || 0) +
      (dayEntry.missionProgress?.admin_policy_broadcast_audit || 0) +
      Math.min(1, dayEntry.actions || 0);
  }

  // Student learning steps
  switch (policy.requiredRecoveryActivity) {
    case 'review_flashcards':
      return dayEntry.flashcards || 0;
    case 'complete_quiz':
      return dayEntry.quizzes || 0;
    case 'study_session':
      return dayEntry.studyMinutes || dayEntry.actions || 0;
    case 'review_flashcards_or_quiz':
    default:
      return (dayEntry.flashcards || 0) + (dayEntry.quizzes || 0) * 5;
  }
}

/**
 * Server-side verified streak recovery execution.
 * Rejects unverified 1-click requests, duplicate claims, expired windows, and cooldown violations.
 */
export function executeVerifiedStreakRecovery(
  record: ServerStreakRecord,
  policy: EngagementPolicyConfig,
  evidence: {
    activityType?: string;
    verifiedCount?: number;
    role?: string;
  },
  nowMs: number = Date.now()
): {
  ok: boolean;
  status: number;
  error?: string;
  record: ServerStreakRecord;
  restoredFrom: number;
  newStreak: number;
} {
  const evaluated = evaluateStreakTransition(record, policy, nowMs);
  const rec = evaluated.record;
  const todayDate = evaluated.todayDate;
  const userRole = String(evidence.role || 'student').toLowerCase();

  if (!policy.streakRecoveryEnabled || !policy.featureFlags.streakRecovery) {
    return { ok: false, status: 403, error: 'Streak recovery is disabled by campus policy.', record: rec, restoredFrom: 0, newStreak: rec.currentStreak };
  }

  if (rec.streakState === 'recovered' && rec.lastActiveDate === todayDate) {
    return { ok: false, status: 409, error: 'Streak has already been recovered today.', record: rec, restoredFrom: rec.currentStreak, newStreak: rec.currentStreak };
  }

  if (rec.streakState !== 'frozen' && rec.streakState !== 'recovery_available') {
    return {
      ok: false,
      status: 400,
      error: rec.streakState === 'expired'
        ? 'Streak recovery window has expired.'
        : 'No frozen streak is currently available for recovery.',
      record: rec,
      restoredFrom: 0,
      newStreak: rec.currentStreak,
    };
  }

  if (!evaluated.recoveryEligible) {
    return {
      ok: false,
      status: 409,
      error: evaluated.recoveryBlockedReason || 'Recovery is not currently eligible.',
      record: rec,
      restoredFrom: rec.frozenStreakCount,
      newStreak: rec.currentStreak,
    };
  }

  if (rec.recoveryDeadline && new Date(rec.recoveryDeadline).getTime() < nowMs) {
    rec.streakState = 'expired';
    rec.currentStreak = 0;
    rec.frozenStreakCount = 0;
    return { ok: false, status: 400, error: 'Recovery deadline has passed.', record: rec, restoredFrom: 0, newStreak: 0 };
  }

  // Must satisfy verified role activity count on server OR corroborated server evidence
  const reqCount = userRole === 'student' ? policy.recoveryRequiredCount : 1;
  const trackedProgress = getRecoveryProgressForDate(rec, todayDate, policy, userRole);
  const verifiedPayloadCount = Math.max(0, Number(evidence.verifiedCount || 0));

  const validActivityTypes =
    userRole === 'teacher'
      ? ['attendance_mark', 'grade_submission', 'teaching_action', 'flashcards', 'quiz']
      : userRole === 'coordinator'
        ? ['oversight_review', 'cohort_audit', 'grade_submission', 'attendance_mark']
        : (userRole === 'admin' || userRole === 'super_admin')
          ? ['admin_audit', 'policy_update', 'leave_approval', 'role_approval', 'operational_action']
          : ['flashcards', 'quiz', 'study_session', 'homework'];

  const validActivityType = validActivityTypes.includes(
    String(evidence.activityType || '').toLowerCase()
  );
  const effectiveProgress = validActivityType ? Math.max(trackedProgress, verifiedPayloadCount) : trackedProgress;

  if (effectiveProgress < reqCount) {
    const activityName =
      userRole === 'teacher'
        ? 'attendance or grading workflow actions'
        : (userRole === 'admin' || userRole === 'super_admin')
          ? 'approvals review or governance audit actions'
          : userRole === 'coordinator'
            ? 'department oversight reviews'
            : 'verified learning steps';
    return {
      ok: false,
      status: 400,
      error: `Complete at least ${reqCount} ${activityName} (${effectiveProgress}/${reqCount} completed today) before recovering your streak.`,
      record: rec,
      restoredFrom: rec.frozenStreakCount,
      newStreak: rec.currentStreak,
    };
  }

  const restoredFrom = Math.max(rec.frozenStreakCount, rec.currentStreak);
  const newStreak = restoredFrom + 1;

  rec.currentStreak = newStreak;
  rec.longestStreak = Math.max(rec.longestStreak, newStreak);
  rec.frozenStreakCount = 0;
  rec.streakState = 'recovered';
  rec.lastActiveDate = todayDate;
  rec.recoveryDeadline = null;
  rec.recoveryLastUsedAt = new Date(nowMs).toISOString();
  rec.recoveriesThisMonth = (rec.recoveriesThisMonth || 0) + 1;
  rec.recoveryMonthKey = getMonthKey(todayDate);
  rec.updatedAt = new Date(nowMs).toISOString();

  rec.history.unshift({
    id: `sh_${crypto.randomBytes(4).toString('hex')}`,
    activityDate: todayDate,
    eventType: 'recovered',
    streakBefore: restoredFrom,
    streakAfter: newStreak,
    source: evidence.activityType || (userRole === 'teacher' ? 'verified_attendance_register' : (userRole === 'admin' || userRole === 'super_admin') ? 'verified_admin_audit' : 'verified_learning_mission'),
    createdAt: rec.updatedAt,
  });

  return {
    ok: true,
    status: 200,
    record: rec,
    restoredFrom,
    newStreak,
  };
}

/**
 * Record verified engagement activity using trusted server clock & update streak monotonically.
 */
export function recordVerifiedActivity(
  record: ServerStreakRecord,
  policy: EngagementPolicyConfig,
  input: {
    activityType: 'flashcards' | 'quiz' | 'homework' | 'study_session' | 'attendance_mark' | 'grade_submission' | 'oversight_review' | 'admin_audit' | 'daily_checkin';
    count?: number;
    returnContext?: ServerStreakRecord['recentReturnContext'];
  },
  nowMs: number = Date.now()
): {
  record: ServerStreakRecord;
  todayDate: string;
  streakIncremented: boolean;
} {
  const evaluated = evaluateStreakTransition(record, policy, nowMs);
  const rec = evaluated.record;
  const todayDate = evaluated.todayDate;
  const count = Math.max(1, Math.min(200, Number(input.count || 1)));

  const dayEntry = rec.recoveryActivityDates[todayDate] || {
    flashcards: 0,
    quizzes: 0,
    studyMinutes: 0,
    actions: 0,
    missionProgress: {},
  };

  dayEntry.actions += 1;
  if (input.activityType === 'flashcards') dayEntry.flashcards += count;
  if (input.activityType === 'quiz') dayEntry.quizzes += count;
  if (input.activityType === 'study_session') dayEntry.studyMinutes += count;

  // Increment relevant mission progress keys
  const incMission = (id: string, delta: number) => {
    dayEntry.missionProgress[id] = (dayEntry.missionProgress[id] || 0) + delta;
  };
  if (['flashcards', 'quiz', 'homework', 'study_session', 'daily_checkin'].includes(input.activityType)) {
    incMission('student_daily_study_checkin', 1);
  }
  if (input.activityType === 'flashcards') incMission('student_flashcard_sprint', count);
  if (input.activityType === 'homework') incMission('student_homework_progress', 1);
  if (input.activityType === 'attendance_mark') incMission('teacher_daily_attendance', 1);
  if (input.activityType === 'grade_submission') incMission('teacher_evaluate_submissions', 1);
  if (input.activityType === 'oversight_review') {
    incMission('coordinator_cohort_attendance_audit', 1);
    incMission('coordinator_submission_compliance', 1);
  }
  if (input.activityType === 'admin_audit') {
    incMission('admin_approvals_queue_review', 1);
    incMission('admin_policy_broadcast_audit', 1);
  }

  rec.recoveryActivityDates[todayDate] = dayEntry;
  if (input.returnContext) {
    rec.recentReturnContext = { ...input.returnContext, updatedAt: new Date(nowMs).toISOString() };
  }

  let streakIncremented = false;
  // Do NOT wipe frozen streak silently; if active or at_risk or brand new 0 streak, increment cleanly once per day
  if (rec.streakState !== 'frozen' && rec.streakState !== 'recovery_available') {
    if (rec.lastActiveDate !== todayDate) {
      const before = rec.currentStreak;
      rec.currentStreak = Math.max(0, rec.currentStreak) + 1;
      rec.longestStreak = Math.max(rec.longestStreak, rec.currentStreak);
      rec.streakState = 'active';
      rec.lastActiveDate = todayDate;
      streakIncremented = true;
      rec.history.unshift({
        id: `sh_${crypto.randomBytes(4).toString('hex')}`,
        activityDate: todayDate,
        eventType: 'maintained',
        streakBefore: before,
        streakAfter: rec.currentStreak,
        source: input.activityType,
        createdAt: new Date(nowMs).toISOString(),
      });
    } else if (rec.currentStreak === 0) {
      rec.currentStreak = 1;
      rec.longestStreak = Math.max(1, rec.longestStreak);
      rec.streakState = 'active';
      streakIncremented = true;
    }
  }

  rec.history = rec.history.slice(0, 60);
  rec.updatedAt = new Date(nowMs).toISOString();
  return { record: rec, todayDate, streakIncremented };
}

function shouldUseDb(url: string, key: string): boolean {
  return Boolean(url && key) && (process.env.NODE_ENV !== 'test' || url.includes('127.0.0.1') || url.includes('localhost'));
}

async function loadPolicyConfig(url: string, key: string): Promise<EngagementPolicyConfig> {
  if (!shouldUseDb(url, key)) return memoryPolicyConfig;
  const effectiveKey = getFeatureAndWinterSupabaseKey(url, key) || WORKING_ANON_KEY;
  const headers = { apikey: effectiveKey, Authorization: `Bearer ${effectiveKey}` };

  try {
    const pRes = await supabaseFetchWithAnonRetry(
      `${url}/rest/v1/engagement_policy_config?id=eq.platform_default&select=*`,
      { headers }
    );
    if (pRes.ok) {
      const rows = await pRes.json().catch(() => []);
      if (rows?.[0]?.config_json) {
        memoryPolicyConfig = {
          ...DEFAULT_POLICY_CONFIG,
          ...rows[0].config_json,
          featureFlags: { ...DEFAULT_POLICY_CONFIG.featureFlags, ...(rows[0].config_json.featureFlags || {}) },
          version: Number(rows[0].version || rows[0].config_json.version || 1),
        };
        return memoryPolicyConfig;
      }
    }
  } catch (_) {}

  try {
    const gRes = await supabaseFetchWithAnonRetry(
      `${url}/rest/v1/global_data?id=eq.${encodeURIComponent(POLICY_DOC_ID)}&select=data`,
      { headers }
    );
    if (gRes.ok) {
      const rows = await gRes.json().catch(() => []);
      if (rows?.[0]?.data) {
        memoryPolicyConfig = {
          ...DEFAULT_POLICY_CONFIG,
          ...rows[0].data,
          featureFlags: { ...DEFAULT_POLICY_CONFIG.featureFlags, ...(rows[0].data.featureFlags || {}) },
        };
      }
    }
  } catch (_) {}

  return memoryPolicyConfig;
}

async function persistPolicyConfigAndAudit(
  url: string,
  key: string,
  nextConfig: EngagementPolicyConfig,
  audit: EngagementAuditEntry
): Promise<void> {
  memoryPolicyConfig = nextConfig;
  memoryAuditLogs.unshift(audit);
  if (memoryAuditLogs.length > 150) memoryAuditLogs.length = 150;

  if (!shouldUseDb(url, key)) return;
  const effectiveKey = getFeatureAndWinterSupabaseKey(url, key) || WORKING_ANON_KEY;
  const headers = {
    apikey: effectiveKey,
    Authorization: `Bearer ${effectiveKey}`,
    'Content-Type': 'application/json',
    Prefer: 'resolution=merge-duplicates',
  };

  await Promise.allSettled([
    supabaseFetchWithAnonRetry(`${url}/rest/v1/global_data?on_conflict=id`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ id: POLICY_DOC_ID, data: nextConfig, updated_at: nextConfig.updatedAt }),
    }),
    supabaseFetchWithAnonRetry(`${url}/rest/v1/global_data?on_conflict=id`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ id: AUDIT_DOC_ID, data: { entries: memoryAuditLogs.slice(0, 100) }, updated_at: nextConfig.updatedAt }),
    }),
    supabaseFetchWithAnonRetry(`${url}/rest/v1/engagement_policy_config?on_conflict=id`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        id: 'platform_default',
        scope: 'platform',
        version: nextConfig.version,
        config_json: nextConfig,
        updated_by: audit.actorUserId,
        updated_at: nextConfig.updatedAt,
      }),
    }),
    supabaseFetchWithAnonRetry(`${url}/rest/v1/engagement_config_audit_logs`, {
      method: 'POST',
      headers: { ...headers, Prefer: 'return=minimal' },
      body: JSON.stringify({
        id: audit.id,
        actor_user_id: audit.actorUserId,
        actor_email: audit.actorEmail,
        actor_role: audit.actorRole,
        action: audit.action,
        previous_config: audit.previousConfig || {},
        next_config: audit.nextConfig || {},
        summary: audit.summary,
        created_at: audit.createdAt,
      }),
    }),
  ]);
}

async function loadAuditLogs(url: string, key: string): Promise<EngagementAuditEntry[]> {
  if (!shouldUseDb(url, key)) return [...memoryAuditLogs];
  const effectiveKey = getFeatureAndWinterSupabaseKey(url, key) || WORKING_ANON_KEY;
  const headers = { apikey: effectiveKey, Authorization: `Bearer ${effectiveKey}` };

  try {
    const tRes = await supabaseFetchWithAnonRetry(
      `${url}/rest/v1/engagement_config_audit_logs?select=*&order=created_at.desc&limit=50`,
      { headers }
    );
    if (tRes.ok) {
      const rows = await tRes.json().catch(() => []);
      if (Array.isArray(rows) && rows.length > 0) {
        return rows.map((r: any) => ({
          id: String(r.id),
          actorUserId: String(r.actor_user_id),
          actorEmail: String(r.actor_email || ''),
          actorRole: String(r.actor_role || 'admin'),
          action: String(r.action),
          summary: String(r.summary || ''),
          previousConfig: r.previous_config,
          nextConfig: r.next_config,
          createdAt: String(r.created_at),
        }));
      }
    }
  } catch (_) {}

  try {
    const gRes = await supabaseFetchWithAnonRetry(
      `${url}/rest/v1/global_data?id=eq.${encodeURIComponent(AUDIT_DOC_ID)}&select=data`,
      { headers }
    );
    if (gRes.ok) {
      const rows = await gRes.json().catch(() => []);
      if (Array.isArray(rows?.[0]?.data?.entries)) {
        return rows[0].data.entries;
      }
    }
  } catch (_) {}

  return [...memoryAuditLogs];
}

async function loadOrInitializeUserStreakRecord(
  url: string,
  key: string,
  userId: string,
  policy: EngagementPolicyConfig
): Promise<{
  record: ServerStreakRecord;
  xp: number;
  name: string;
  role: string;
  grade: string;
  section: string;
  earnedBadges: Record<string, string>;
}> {
  const memExisting = memoryUserRecords.get(userId);
  let xp = 0;
  let name = 'Member';
  let role = 'student';
  let grade = '';
  let section = '';
  let earnedBadges: Record<string, string> = {};
  let profileRow: any = null;
  let gamificationDoc: any = null;
  let storedStreakDoc: any = null;

  if (shouldUseDb(url, key)) {
    const effectiveKey = getFeatureAndWinterSupabaseKey(url, key) || WORKING_ANON_KEY;
    const headers = { apikey: effectiveKey, Authorization: `Bearer ${effectiveKey}` };
    const encUid = encodeURIComponent(userId);

    const [pRes, gRes, sRes, lRes] = await Promise.all([
      supabaseFetchWithAnonRetry(
        `${url}/rest/v1/user_profiles?or=(id.eq.${encUid},uid.eq.${encUid})&select=*&limit=2`,
        { headers }
      ).catch(() => null),
      supabaseFetchWithAnonRetry(
        `${url}/rest/v1/global_data?id=eq.${encodeURIComponent(`gamification_user_${userId}`)}&select=data`,
        { headers }
      ).catch(() => null),
      supabaseFetchWithAnonRetry(
        `${url}/rest/v1/global_data?id=eq.${encodeURIComponent(`${USER_STREAK_DOC_PREFIX}${userId}`)}&select=data`,
        { headers }
      ).catch(() => null),
      supabaseFetchWithAnonRetry(
        `${url}/rest/v1/gamification_xp_ledger?user_id=eq.${encUid}&select=xp_delta`,
        { headers }
      ).catch(() => null),
    ]);

    if (pRes && pRes.ok) {
      const rows = await pRes.json().catch(() => []);
      if (Array.isArray(rows) && rows[0]) {
        profileRow = rows[0];
        name = String(profileRow.name || name);
        role = String(profileRow.role || role).toLowerCase();
        grade = String(profileRow.grade || '');
        section = String(profileRow.section || '');
        xp = Math.max(xp, Number(profileRow.points || 0));
      }
    }
    if (gRes && gRes.ok) {
      const rows = await gRes.json().catch(() => []);
      if (rows?.[0]?.data) {
        gamificationDoc = rows[0].data;
        xp = Math.max(xp, Number(gamificationDoc.xp || 0));
        if (gamificationDoc.earnedBadges && typeof gamificationDoc.earnedBadges === 'object') {
          earnedBadges = gamificationDoc.earnedBadges;
        }
      }
    }
    if (sRes && sRes.ok) {
      const rows = await sRes.json().catch(() => []);
      if (rows?.[0]?.data) storedStreakDoc = rows[0].data;
    }
    if (lRes && lRes.ok) {
      const rows = await lRes.json().catch(() => []);
      if (Array.isArray(rows)) {
        const ledgerSum = rows.reduce((s: number, r: any) => s + Math.max(0, Number(r?.xp_delta || 0)), 0);
        xp = Math.max(xp, ledgerSum);
      }
    }
  }

  // Build authoritative StreakRecord respecting real DB columns & never inventing an 8-day streak
  const baseSource = memExisting || storedStreakDoc;
  const dbStreak = profileRow?.streak_days !== undefined && profileRow?.streak_days !== null
    ? Number(profileRow.streak_days)
    : undefined;
  const dbLongest = profileRow?.longest_streak !== undefined && profileRow?.longest_streak !== null
    ? Number(profileRow.longest_streak)
    : undefined;

  const currentStreakVal = baseSource
    ? Number(baseSource.currentStreak ?? dbStreak ?? 0)
    : Number(dbStreak ?? 0);

  const longestStreakVal = Math.max(
    currentStreakVal,
    Number(baseSource?.longestStreak ?? dbLongest ?? 0),
    Number(gamificationDoc?.longestStreak ?? 0)
  );

  const record: ServerStreakRecord = baseSource
    ? {
        ...baseSource,
        userId,
        currentStreak: currentStreakVal,
        longestStreak: longestStreakVal,
        timezone: baseSource.timezone || profileRow?.streak_timezone || policy.defaultTimezone,
      }
    : {
        userId,
        currentStreak: currentStreakVal,
        longestStreak: longestStreakVal,
        streakState: (profileRow?.streak_state as ServerStreakState) || 'active',
        frozenStreakCount: Number(profileRow?.frozen_streak_count || 0),
        lastActiveDate: profileRow?.last_active_date || gamificationDoc?.lastActiveDate || null,
        timezone: profileRow?.streak_timezone || policy.defaultTimezone,
        recoveryDeadline: profileRow?.streak_recovery_deadline || null,
        recoveryLastUsedAt: profileRow?.streak_recovery_last_used_at || null,
        recoveriesThisMonth: Number(profileRow?.streak_recoveries_this_month || 0),
        recoveryMonthKey: profileRow?.streak_recovery_month || null,
        recoveryCurrentProgress: 0,
        recoveryActivityDates: {},
        claimedMissions: {},
        history: [],
        recentReturnContext: null,
        updatedAt: new Date().toISOString(),
      };

  memoryUserRecords.set(userId, record);
  return { record, xp, name, role, grade, section, earnedBadges };
}

async function persistUserStreakRecord(
  url: string,
  key: string,
  record: ServerStreakRecord
): Promise<void> {
  memoryUserRecords.set(record.userId, record);
  if (!shouldUseDb(url, key)) return;
  const effectiveKey = getFeatureAndWinterSupabaseKey(url, key) || WORKING_ANON_KEY;
  const headers = {
    apikey: effectiveKey,
    Authorization: `Bearer ${effectiveKey}`,
    'Content-Type': 'application/json',
    Prefer: 'resolution=merge-duplicates',
  };
  const encUid = encodeURIComponent(record.userId);

  await Promise.allSettled([
    supabaseFetchWithAnonRetry(`${url}/rest/v1/global_data?on_conflict=id`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        id: `${USER_STREAK_DOC_PREFIX}${record.userId}`,
        data: record,
        updated_at: record.updatedAt,
      }),
    }),
    supabaseFetchWithAnonRetry(`${url}/rest/v1/user_profiles?or=(id.eq.${encUid},uid.eq.${encUid})`, {
      method: 'PATCH',
      headers: { apikey: effectiveKey, Authorization: `Bearer ${effectiveKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        streak_days: record.currentStreak,
        longest_streak: record.longestStreak,
        streak_state: record.streakState,
        frozen_streak_count: record.frozenStreakCount,
        last_active_date: record.lastActiveDate,
        streak_timezone: record.timezone,
        streak_recovery_deadline: record.recoveryDeadline,
        streak_recovery_last_used_at: record.recoveryLastUsedAt,
        streak_recoveries_this_month: record.recoveriesThisMonth,
        streak_recovery_month: record.recoveryMonthKey,
        streak_updated_at: record.updatedAt,
      }),
    }),
  ]);
}

export function evaluateMissionsForRecord(
  role: string,
  record: ServerStreakRecord,
  todayDate: string,
  contextFlags?: { hasPendingHomework?: boolean; hasPendingApprovals?: boolean }
): EvaluatedMission[] {
  const weekKey = getWeekPeriodKey(todayDate);
  const defs = resolveApplicableMissionDefinitions([role], {
    hasPendingHomework: contextFlags?.hasPendingHomework,
    hasPendingApprovals: contextFlags?.hasPendingApprovals,
  });

  const dayProgress = record.recoveryActivityDates?.[todayDate]?.missionProgress || {};
  // Sum weekly active days & actions across recoveryActivityDates inside current weekKey
  let weeklyActiveDays = 0;
  let weeklyTeacherActions = 0;
  let weeklyCoordinatorActions = 0;
  let weeklyAdminActions = 0;

  for (const [dKey, entry] of Object.entries(record.recoveryActivityDates || {})) {
    if (getWeekPeriodKey(dKey) === weekKey) {
      if ((entry.actions || 0) > 0) weeklyActiveDays += 1;
      weeklyTeacherActions += (entry.missionProgress?.teacher_daily_attendance || 0) + (entry.missionProgress?.teacher_evaluate_submissions || 0);
      weeklyCoordinatorActions += entry.missionProgress?.coordinator_cohort_attendance_audit || 0;
      weeklyAdminActions += entry.missionProgress?.admin_approvals_queue_review || 0;
    }
  }

  return defs.map(def => {
    const periodKey =
      def.period === 'daily' ? todayDate : def.period === 'weekly' ? weekKey : 'lifetime';
    const claimKey = `${def.id}:${periodKey}`;
    const claimed = record.claimedMissions?.[claimKey];

    let progressValue = 0;
    if (def.period === 'daily') {
      progressValue = Number(dayProgress[def.id] || 0);
    } else if (def.id === 'student_weekly_consistency') {
      progressValue = weeklyActiveDays;
    } else if (def.id === 'student_milestone_streak_7') {
      progressValue = Math.max(record.currentStreak, record.longestStreak);
    } else if (def.id === 'teacher_weekly_teaching_rhythm') {
      progressValue = weeklyTeacherActions;
    } else if (def.id === 'coordinator_weekly_cohort_summary') {
      progressValue = weeklyCoordinatorActions;
    } else if (def.id === 'admin_weekly_governance_check') {
      progressValue = weeklyAdminActions;
    }

    const capped = Math.min(def.targetCount, progressValue);
    let status: EvaluatedMission['status'] = 'available';
    if (claimed) {
      status = 'claimed';
    } else if (capped >= def.targetCount) {
      status = 'completed';
    } else if (capped > 0) {
      status = 'in_progress';
    }

    return {
      ...def,
      status,
      progressValue: capped,
      targetValue: def.targetCount,
      periodKey,
      xpAwarded: claimed?.xpAwarded || 0,
      completedAt: capped >= def.targetCount ? record.updatedAt : null,
      claimedAt: claimed?.claimedAt || null,
    };
  });
}

export function registerEngagementSystemRoutes(
  app: express.Application,
  deps: EngagementModuleDeps
) {
  // 1. Unified Engagement Overview (Streak + Missions + Smart Return + Weekly Summary + Policy)
  app.get('/api/engagement/overview', async (req, res) => {
    try {
      const actor = await deps.getVerifiedUserFromRequest(req);
      const userId = String(actor?.id || req.query.userId || '').trim();
      if (!userId) {
        return res.status(400).json({ success: false, error: 'userId is required' });
      }
      const requestedRole = String(req.query.role || actor?.role || '').toLowerCase().trim();
      const cfg = deps.getSupabaseServerConfig();
      const policy = await loadPolicyConfig(cfg.url, cfg.key);
      const loaded = await loadOrInitializeUserStreakRecord(cfg.url, cfg.key, userId, policy);

      // Prefer verified actor role, fall back safely
      const effectiveRole = requestedRole || loaded.role || 'student';
      const evaluated = evaluateStreakTransition(loaded.record, policy);

      // Reconcile real workflow completions for faculty & admin if already recorded today
      const todayDate = evaluated.todayDate;
      const dayEntry = evaluated.record.recoveryActivityDates[todayDate] || {
        flashcards: 0,
        quizzes: 0,
        studyMinutes: 0,
        actions: 0,
        missionProgress: {},
      };
      let recordUpdated = false;

      if (effectiveRole === 'teacher') {
        const teacherMarkedMemory = hasTeacherRecordedAttendanceToday(userId, loaded.name, todayDate);
        let teacherMarkedDb = false;
        if (!teacherMarkedMemory && shouldUseDb(cfg.url, cfg.key)) {
          try {
            const effectiveKey = getFeatureAndWinterSupabaseKey(cfg.url, cfg.key) || WORKING_ANON_KEY;
            const attRes = await supabaseFetchWithAnonRetry(
              `${cfg.url}/rest/v1/attendance?date=eq.${todayDate}&select=id&limit=1`,
              { headers: { apikey: effectiveKey, Authorization: `Bearer ${effectiveKey}` } }
            );
            if (attRes.ok) {
              const rows = await attRes.json().catch(() => []);
              if (Array.isArray(rows) && rows.length > 0) teacherMarkedDb = true;
            }
          } catch (_) {}
        }
        if (teacherMarkedMemory || teacherMarkedDb) {
          if (!dayEntry.missionProgress.teacher_daily_attendance) {
            dayEntry.missionProgress.teacher_daily_attendance = 1;
            dayEntry.actions = Math.max(1, dayEntry.actions || 0);
            evaluated.record.recoveryActivityDates[todayDate] = dayEntry;
            recordUpdated = true;
          }
        }
      } else if (effectiveRole === 'admin' || effectiveRole === 'super_admin') {
        const adminAuditedToday = memoryAuditLogs.some(
          log => log.actorUserId === userId && log.timestamp && log.timestamp.startsWith(todayDate)
        );
        if (adminAuditedToday) {
          if (!dayEntry.missionProgress.admin_policy_broadcast_audit) {
            dayEntry.missionProgress.admin_policy_broadcast_audit = 1;
            dayEntry.actions = Math.max(1, dayEntry.actions || 0);
            evaluated.record.recoveryActivityDates[todayDate] = dayEntry;
            recordUpdated = true;
          }
        }
      }

      await persistUserStreakRecord(cfg.url, cfg.key, evaluated.record);

      const storeUser = deps.getGamificationStore()?.[userId];
      const authoritativeXp = Math.max(loaded.xp, Number(storeUser?.xp || 0));
      const lvl = computeLevelBreakdown(authoritativeXp);
      const recoveryProgress = getRecoveryProgressForDate(evaluated.record, evaluated.todayDate, policy, effectiveRole);
      const missions = evaluateMissionsForRecord(effectiveRole, evaluated.record, evaluated.todayDate);

      const weekKey = getWeekPeriodKey(evaluated.todayDate);
      let activeDaysThisWeek = 0;
      let actionsCompletedThisWeek = 0;
      for (const [dKey, entry] of Object.entries(evaluated.record.recoveryActivityDates || {})) {
        if (getWeekPeriodKey(dKey) === weekKey && (entry.actions || 0) > 0) {
          activeDaysThisWeek += 1;
          actionsCompletedThisWeek += entry.actions || 0;
        }
      }

      const defaultSmartReturn =
        effectiveRole === 'student' && policy.featureFlags.smartReturn
          ? evaluated.record.recentReturnContext || {
              title: evaluated.record.streakState === 'recovery_available' || evaluated.record.streakState === 'frozen'
                ? `Welcome back — restore your ${evaluated.record.frozenStreakCount}-day streak`
                : 'Continue where you left off',
              subtitle: 'Review your scheduled spaced-repetition flashcards or pending assignments in Study Hub.',
              ctaLabel: 'Resume Study Hub',
              actionTab: 'study_hub',
              actionSubTab: 'flashcards',
              reason: 'Recommended calm starting point based on your active study queue.',
            }
          : null;

      const roleReqActivity =
        effectiveRole === 'teacher'
          ? 'attendance_mark'
          : (effectiveRole === 'admin' || effectiveRole === 'super_admin')
            ? 'admin_audit'
            : effectiveRole === 'coordinator'
              ? 'oversight_review'
              : policy.requiredRecoveryActivity;
      const roleReqCount = effectiveRole === 'student' ? policy.recoveryRequiredCount : 1;

      return res.json({
        success: true,
        overview: {
          userId,
          role: effectiveRole,
          name: actor?.name || loaded.name,
          xp: authoritativeXp,
          level: lvl.level,
          levelTitle: lvl.levelTitle,
          nextLevelXp: lvl.nextLevelXp,
          progressPercent: lvl.progressPercent,
          streak: {
            currentStreak: evaluated.record.currentStreak,
            longestStreak: evaluated.record.longestStreak,
            streakState: evaluated.record.streakState,
            frozenStreakCount: evaluated.record.frozenStreakCount,
            lastActiveDate: evaluated.record.lastActiveDate,
            todayDate: evaluated.todayDate,
            timezone: evaluated.record.timezone,
            recoveryDeadline: evaluated.record.recoveryDeadline,
            recoveriesThisMonth: evaluated.record.recoveriesThisMonth,
            maxRecoveriesPerMonth: policy.maxRecoveriesPerMonth,
            recoveryEligible: evaluated.recoveryEligible,
            recoveryBlockedReason: evaluated.recoveryBlockedReason,
            recoveryRequiredActivity: roleReqActivity,
            recoveryRequiredCount: roleReqCount,
            recoveryCurrentProgress: recoveryProgress,
            history: evaluated.record.history.slice(0, 30),
          },
          missions,
          weeklySummary: {
            activeDaysThisWeek,
            xpEarnedThisWeek: Number(storeUser?.dailyTrackers?.xpEarnedToday || 0),
            actionsCompletedThisWeek,
            weeklyGoalTarget: effectiveRole === 'student' ? policy.weeklyStudentXpGoal : policy.weeklyFacultyActionsGoal,
            weeklyGoalUnit: effectiveRole === 'student' ? 'XP' : 'actions',
          },
          smartReturn: defaultSmartReturn,
          policy,
          badgeCount: Object.keys(loaded.earnedBadges || {}).length,
          earnedBadges: loaded.earnedBadges || {},
        },
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err?.message || 'Failed to compute engagement overview' });
    }
  });

  // 2. Record Verified Learning / Teaching / Ops Activity
  app.post('/api/engagement/activity', async (req, res) => {
    try {
      const actor = await deps.getVerifiedUserFromRequest(req);
      const { userId: bodyUserId, activityType, count, returnContext, role } = req.body || {};
      const userId = String(actor?.id || bodyUserId || '').trim();
      if (!userId || !activityType) {
        return res.status(400).json({ success: false, error: 'userId and activityType are required' });
      }
      if (actor && bodyUserId && actor.id !== bodyUserId && !['admin', 'super_admin'].includes(actor.role)) {
        return res.status(403).json({ success: false, error: 'Forbidden' });
      }

      const cfg = deps.getSupabaseServerConfig();
      const policy = await loadPolicyConfig(cfg.url, cfg.key);
      const loaded = await loadOrInitializeUserStreakRecord(cfg.url, cfg.key, userId, policy);
      const result = recordVerifiedActivity(loaded.record, policy, { activityType, count, returnContext });
      await persistUserStreakRecord(cfg.url, cfg.key, result.record);

      const effectiveRole = String(role || actor?.role || loaded.role || 'student').toLowerCase();
      const roleReqCount = effectiveRole === 'student' ? policy.recoveryRequiredCount : 1;
      return res.json({
        success: true,
        streakIncremented: result.streakIncremented,
        streak: {
          currentStreak: result.record.currentStreak,
          longestStreak: result.record.longestStreak,
          streakState: result.record.streakState,
          frozenStreakCount: result.record.frozenStreakCount,
          recoveryCurrentProgress: getRecoveryProgressForDate(result.record, result.todayDate, policy, effectiveRole),
          recoveryRequiredCount: roleReqCount,
        },
        missions: evaluateMissionsForRecord(effectiveRole, result.record, result.todayDate),
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err?.message || 'Activity log failed' });
    }
  });

  // 3. Server-Verified Streak Recovery Endpoint
  app.post('/api/engagement/streak/recover', async (req, res) => {
    try {
      const actor = await deps.getVerifiedUserFromRequest(req);
      const { userId: bodyUserId, activityType, verifiedCount, role } = req.body || {};
      const userId = String(actor?.id || bodyUserId || '').trim();
      if (!userId) {
        return res.status(400).json({ success: false, error: 'userId is required' });
      }
      if (actor && bodyUserId && actor.id !== bodyUserId && !['admin', 'super_admin'].includes(actor.role)) {
        return res.status(403).json({ success: false, error: 'Forbidden' });
      }

      const cfg = deps.getSupabaseServerConfig();
      const policy = await loadPolicyConfig(cfg.url, cfg.key);
      const loaded = await loadOrInitializeUserStreakRecord(cfg.url, cfg.key, userId, policy);
      const effectiveRole = String(role || actor?.role || loaded.role || 'student').toLowerCase();
      const outcome = executeVerifiedStreakRecovery(loaded.record, policy, {
        activityType,
        verifiedCount,
        role: effectiveRole,
      });
      await persistUserStreakRecord(cfg.url, cfg.key, outcome.record);

      if (!outcome.ok) {
        return res.status(outcome.status).json({ success: false, error: outcome.error });
      }

      const bonusXp = ALLOWED_GAMIFICATION_ACTION_XP.streak_recovery?.xp || 35;
      return res.json({
        success: true,
        restoredFrom: outcome.restoredFrom,
        newStreak: outcome.newStreak,
        streakState: outcome.record.streakState,
        xpRewarded: bonusXp,
        actionKey: 'streak_recovery',
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err?.message || 'Streak recovery failed' });
    }
  });

  // 4. Server-Verified Mission / Checklist Claim Endpoint
  app.post('/api/engagement/missions/claim', async (req, res) => {
    try {
      const actor = await deps.getVerifiedUserFromRequest(req);
      const { userId: bodyUserId, missionId, role } = req.body || {};
      const userId = String(actor?.id || bodyUserId || '').trim();
      if (!userId || !missionId) {
        return res.status(400).json({ success: false, error: 'userId and missionId are required' });
      }
      if (actor && bodyUserId && actor.id !== bodyUserId && !['admin', 'super_admin'].includes(actor.role)) {
        return res.status(403).json({ success: false, error: 'Forbidden' });
      }

      const cfg = deps.getSupabaseServerConfig();
      const policy = await loadPolicyConfig(cfg.url, cfg.key);
      const loaded = await loadOrInitializeUserStreakRecord(cfg.url, cfg.key, userId, policy);
      const effectiveRole = String(role || actor?.role || loaded.role || 'student').toLowerCase();
      const evaluated = evaluateStreakTransition(loaded.record, policy);
      const missions = evaluateMissionsForRecord(effectiveRole, evaluated.record, evaluated.todayDate);
      const target = missions.find(m => m.id === missionId);

      if (!target) {
        return res.status(404).json({ success: false, error: 'Mission is not eligible for your current role.' });
      }
      if (target.status === 'claimed') {
        return res.status(409).json({ success: false, error: 'Mission reward already claimed for this period.' });
      }
      if (target.status !== 'completed') {
        return res.status(400).json({
          success: false,
          error: `Complete the mission requirements first (${target.progressValue}/${target.targetValue}).`,
        });
      }

      const serverAction = ALLOWED_GAMIFICATION_ACTION_XP[target.rewardActionKey];
      const xpAwarded = serverAction ? serverAction.xp : target.rewardXp;
      const claimKey = `${target.id}:${target.periodKey}`;
      evaluated.record.claimedMissions[claimKey] = {
        claimedAt: new Date().toISOString(),
        xpAwarded,
      };
      evaluated.record.updatedAt = new Date().toISOString();
      await persistUserStreakRecord(cfg.url, cfg.key, evaluated.record);

      return res.json({
        success: true,
        missionId: target.id,
        periodKey: target.periodKey,
        xpAwarded,
        actionKey: target.rewardActionKey,
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err?.message || 'Mission claim failed' });
    }
  });

  // 5. Policy Configuration Read & Update (Admin / Super Admin RBAC + Audit Trail)
  app.get('/api/engagement/config', async (_req, res) => {
    try {
      const cfg = deps.getSupabaseServerConfig();
      const policy = await loadPolicyConfig(cfg.url, cfg.key);
      return res.json({ success: true, config: policy });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err?.message || 'Failed to read config' });
    }
  });

  app.post('/api/engagement/config', async (req, res) => {
    try {
      const actor = await deps.getVerifiedUserFromRequest(req);
      const actorRole = String(actor?.role || '').toLowerCase();
      if (!actor || (actorRole !== 'admin' && actorRole !== 'super_admin')) {
        return res.status(403).json({ success: false, error: 'Administrator clearance required to modify engagement policies.' });
      }

      const cfg = deps.getSupabaseServerConfig();
      const previous = await loadPolicyConfig(cfg.url, cfg.key);
      const patch = req.body?.config && typeof req.body.config === 'object' ? req.body.config : req.body;

      // School Admins can edit operational recovery/flyout/goal settings, but Super Admin-only controls guard global featureFlags
      const nextFeatureFlags =
        actorRole === 'super_admin' && patch?.featureFlags && typeof patch.featureFlags === 'object'
          ? { ...previous.featureFlags, ...patch.featureFlags }
          : { ...previous.featureFlags };

      const nowIso = new Date().toISOString();
      const next: EngagementPolicyConfig = {
        ...previous,
        streakRecoveryEnabled: typeof patch?.streakRecoveryEnabled === 'boolean' ? patch.streakRecoveryEnabled : previous.streakRecoveryEnabled,
        maxMissedDaysForRecovery: patch?.maxMissedDaysForRecovery !== undefined
          ? Math.max(1, Math.min(7, Number(patch.maxMissedDaysForRecovery)))
          : previous.maxMissedDaysForRecovery,
        requiredRecoveryActivity: ['review_flashcards', 'complete_quiz', 'review_flashcards_or_quiz', 'study_session'].includes(patch?.requiredRecoveryActivity)
          ? patch.requiredRecoveryActivity
          : previous.requiredRecoveryActivity,
        recoveryRequiredCount: patch?.recoveryRequiredCount !== undefined
          ? Math.max(1, Math.min(25, Number(patch.recoveryRequiredCount)))
          : previous.recoveryRequiredCount,
        recoveryCooldownDays: patch?.recoveryCooldownDays !== undefined
          ? Math.max(0, Math.min(30, Number(patch.recoveryCooldownDays)))
          : previous.recoveryCooldownDays,
        maxRecoveriesPerMonth: patch?.maxRecoveriesPerMonth !== undefined
          ? Math.max(0, Math.min(10, Number(patch.maxRecoveriesPerMonth)))
          : previous.maxRecoveriesPerMonth,
        defaultTimezone: typeof patch?.defaultTimezone === 'string' && patch.defaultTimezone.trim()
          ? patch.defaultTimezone.trim()
          : previous.defaultTimezone,
        weeklyStudentXpGoal: patch?.weeklyStudentXpGoal !== undefined
          ? Math.max(50, Math.min(5000, Number(patch.weeklyStudentXpGoal)))
          : previous.weeklyStudentXpGoal,
        weeklyFacultyActionsGoal: patch?.weeklyFacultyActionsGoal !== undefined
          ? Math.max(1, Math.min(100, Number(patch.weeklyFacultyActionsGoal)))
          : previous.weeklyFacultyActionsGoal,
        maxVisibleFlyouts: patch?.maxVisibleFlyouts !== undefined
          ? Math.max(1, Math.min(3, Number(patch.maxVisibleFlyouts)))
          : previous.maxVisibleFlyouts,
        flyoutCooldownSeconds: patch?.flyoutCooldownSeconds !== undefined
          ? Math.max(5, Math.min(600, Number(patch.flyoutCooldownSeconds)))
          : previous.flyoutCooldownSeconds,
        defaultBroadcastTtlHours: patch?.defaultBroadcastTtlHours !== undefined
          ? Math.max(1, Math.min(720, Number(patch.defaultBroadcastTtlHours)))
          : previous.defaultBroadcastTtlHours,
        featureFlags: nextFeatureFlags,
        version: (previous.version || 1) + 1,
        updatedAt: nowIso,
        updatedBy: actor.name || actor.email || actor.id,
      };

      const audit: EngagementAuditEntry = {
        id: `eng_aud_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
        actorUserId: actor.id,
        actorEmail: actor.email || '',
        actorRole,
        action: 'update_engagement_policy',
        summary: `${actor.name} (${actorRole}) updated Engagement Policy v${next.version}`,
        previousConfig: previous,
        nextConfig: next,
        createdAt: nowIso,
      };

      await persistPolicyConfigAndAudit(cfg.url, cfg.key, next, audit);
      deps.broadcastToAllWs({ type: 'engagement:policy_updated', version: next.version });
      return res.json({ success: true, config: next, audit });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err?.message || 'Failed to update config' });
    }
  });

  app.get('/api/engagement/audit', async (req, res) => {
    try {
      const actor = await deps.getVerifiedUserFromRequest(req);
      const actorRole = String(actor?.role || '').toLowerCase();
      if (!actor || (actorRole !== 'admin' && actorRole !== 'super_admin')) {
        return res.status(403).json({ success: false, error: 'Administrator clearance required.' });
      }
      const cfg = deps.getSupabaseServerConfig();
      const logs = await loadAuditLogs(cfg.url, cfg.key);
      return res.json({ success: true, logs });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err?.message || 'Failed to read audit logs' });
    }
  });
}

export async function recordEngagementActivityServer(
  url: string,
  key: string,
  userId: string,
  role: string,
  activityType: 'flashcards' | 'quiz' | 'homework' | 'study_session' | 'attendance_mark' | 'grade_submission' | 'oversight_review' | 'admin_audit' | 'daily_checkin',
  count: number = 1
): Promise<{ ok: boolean; streakIncremented: boolean; currentStreak: number }> {
  try {
    const policy = await loadPolicyConfig(url, key);
    const loaded = await loadOrInitializeUserStreakRecord(url, key, userId, policy);
    const result = recordVerifiedActivity(loaded.record, policy, { activityType, count });
    await persistUserStreakRecord(url, key, result.record);
    return { ok: true, streakIncremented: result.streakIncremented, currentStreak: result.record.currentStreak };
  } catch (err) {
    console.warn('[engagement-engine] recordEngagementActivityServer failed:', err);
    return { ok: false, streakIncremented: false, currentStreak: 0 };
  }
}

export function __seedStreakRecordForTests(record: ServerStreakRecord) {
  memoryUserRecords.set(record.userId, record);
}

export function __resetEngagementEngineMemoryForTests() {
  memoryPolicyConfig = {
    ...DEFAULT_POLICY_CONFIG,
    featureFlags: { ...DEFAULT_POLICY_CONFIG.featureFlags },
  };
  memoryAuditLogs = [];
  memoryUserRecords.clear();
}
