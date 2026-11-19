/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Role-Aware Engagement Mission & Checklist Registry (System 2.0)
 * Shared between server/engagementEngine.ts and frontend dashboards.
 */

export type MissionPeriod = 'daily' | 'weekly' | 'milestone';

export type MissionCategory =
  | 'study'
  | 'streak_recovery'
  | 'assessment'
  | 'teaching'
  | 'oversight'
  | 'operations';

export type MissionStatus =
  | 'available'
  | 'in_progress'
  | 'completed'
  | 'claimed'
  | 'expired';

export interface RoleMissionDefinition {
  id: string;
  title: string;
  description: string;
  applicableRoles: string[];
  requiredPermissions?: string[];
  category: MissionCategory;
  period: MissionPeriod;
  estimatedMinutes: number;
  targetCount: number;
  rewardActionKey: string;
  rewardXp: number;
  actionTab: string;
  actionSubTab?: string;
  actionLabel: string;
  cooldownHours: number;
  /** Optional predicate metadata evaluated server-side */
  requiresContextFlag?:
    | 'has_due_flashcards'
    | 'has_pending_homework'
    | 'has_unmarked_attendance'
    | 'has_pending_submissions'
    | 'has_frozen_streak'
    | 'has_pending_approvals';
}

export interface EvaluatedMission extends RoleMissionDefinition {
  status: MissionStatus;
  progressValue: number;
  targetValue: number;
  periodKey: string;
  xpAwarded: number;
  completedAt?: string | null;
  claimedAt?: string | null;
  reason?: string;
}

export const ROLE_TASK_REGISTRY: RoleMissionDefinition[] = [
  // =========================================================================
  // STUDENT DAILY, WEEKLY & MILESTONE MISSIONS
  // =========================================================================
  {
    id: 'student_daily_study_checkin',
    title: 'Focused Study Check-In',
    description: 'Complete at least 1 study activity (flashcards, note, quiz, or homework) today to strengthen your streak.',
    applicableRoles: ['student'],
    category: 'study',
    period: 'daily',
    estimatedMinutes: 5,
    targetCount: 1,
    rewardActionKey: 'daily_mission_complete',
    rewardXp: 25,
    actionTab: 'study_hub',
    actionSubTab: 'flashcards',
    actionLabel: 'Open Study Hub',
    cooldownHours: 24,
  },
  {
    id: 'student_flashcard_sprint',
    title: 'Active Recall Sprint',
    description: 'Review spaced-repetition flashcards from your study decks to reinforce long-term memory.',
    applicableRoles: ['student'],
    category: 'study',
    period: 'daily',
    estimatedMinutes: 8,
    targetCount: 5,
    rewardActionKey: 'daily_mission_complete',
    rewardXp: 25,
    actionTab: 'study_hub',
    actionSubTab: 'flashcards',
    actionLabel: 'Review Flashcards',
    cooldownHours: 24,
  },
  {
    id: 'student_homework_progress',
    title: 'Clear Pending Assignment',
    description: 'Work through and submit an open homework assignment assigned to your class cohort.',
    applicableRoles: ['student'],
    category: 'assessment',
    period: 'daily',
    estimatedMinutes: 15,
    targetCount: 1,
    rewardActionKey: 'daily_mission_complete',
    rewardXp: 25,
    actionTab: 'homework',
    actionLabel: 'Go to Homework',
    cooldownHours: 24,
    requiresContextFlag: 'has_pending_homework',
  },
  {
    id: 'student_weekly_consistency',
    title: '5-Day Weekly Consistency',
    description: 'Stay active on 5 distinct days this week across Study Hub, Homework, or Brain Battle.',
    applicableRoles: ['student'],
    category: 'study',
    period: 'weekly',
    estimatedMinutes: 20,
    targetCount: 5,
    rewardActionKey: 'weekly_mission_complete',
    rewardXp: 75,
    actionTab: 'study_hub',
    actionLabel: 'View Weekly Pace',
    cooldownHours: 168,
  },
  {
    id: 'student_milestone_streak_7',
    title: '7-Day Scholar Momentum',
    description: 'Build an authoritative 7-day learning streak without letting momentum expire.',
    applicableRoles: ['student'],
    category: 'study',
    period: 'milestone',
    estimatedMinutes: 15,
    targetCount: 7,
    rewardActionKey: 'milestone_mission_complete',
    rewardXp: 100,
    actionTab: 'gamification',
    actionLabel: 'View Milestones',
    cooldownHours: 720,
  },

  // =========================================================================
  // TEACHER DAILY & WEEKLY WORKFLOW MISSIONS
  // =========================================================================
  {
    id: 'teacher_daily_attendance',
    title: 'Complete Daily Attendance Register',
    description: 'Verify and submit today’s attendance roll for your assigned classroom sections.',
    applicableRoles: ['teacher'],
    requiredPermissions: ['mark_attendance'],
    category: 'teaching',
    period: 'daily',
    estimatedMinutes: 4,
    targetCount: 1,
    rewardActionKey: 'faculty_workflow_action',
    rewardXp: 25,
    actionTab: 'attendance_manager',
    actionLabel: 'Mark Attendance',
    cooldownHours: 24,
  },
  {
    id: 'teacher_evaluate_submissions',
    title: 'Evaluate Pending Student Submissions',
    description: 'Review student homework submissions in your authorized classes and release feedback.',
    applicableRoles: ['teacher'],
    requiredPermissions: ['evaluate_submissions'],
    category: 'teaching',
    period: 'daily',
    estimatedMinutes: 12,
    targetCount: 1,
    rewardActionKey: 'faculty_workflow_action',
    rewardXp: 25,
    actionTab: 'faculty',
    actionLabel: 'Review Submissions',
    cooldownHours: 24,
  },
  {
    id: 'teacher_weekly_teaching_rhythm',
    title: 'Weekly Teaching Cadence',
    description: 'Complete at least 4 verified classroom actions this week (attendance, grading, or assessment prep).',
    applicableRoles: ['teacher'],
    category: 'teaching',
    period: 'weekly',
    estimatedMinutes: 15,
    targetCount: 4,
    rewardActionKey: 'weekly_mission_complete',
    rewardXp: 75,
    actionTab: 'faculty',
    actionLabel: 'Open Faculty Hub',
    cooldownHours: 168,
  },

  // =========================================================================
  // COORDINATOR SCOPED ACADEMIC OVERSIGHT MISSIONS
  // =========================================================================
  {
    id: 'coordinator_cohort_attendance_audit',
    title: 'Audit Assigned Department Attendance',
    description: 'Review attendance patterns across your authorized grades and sections for follow-up.',
    applicableRoles: ['coordinator'],
    requiredPermissions: ['view_analytics'],
    category: 'oversight',
    period: 'daily',
    estimatedMinutes: 6,
    targetCount: 1,
    rewardActionKey: 'coordinator_oversight_action',
    rewardXp: 30,
    actionTab: 'faculty',
    actionLabel: 'Open Oversight',
    cooldownHours: 24,
  },
  {
    id: 'coordinator_submission_compliance',
    title: 'Department Submission & Assessment Check',
    description: 'Verify pending homework evaluations and upcoming assessments within your assigned cohorts.',
    applicableRoles: ['coordinator'],
    requiredPermissions: ['view_analytics'],
    category: 'oversight',
    period: 'daily',
    estimatedMinutes: 8,
    targetCount: 1,
    rewardActionKey: 'coordinator_oversight_action',
    rewardXp: 30,
    actionTab: 'faculty',
    actionLabel: 'Inspect Cohort Queue',
    cooldownHours: 24,
  },
  {
    id: 'coordinator_weekly_cohort_summary',
    title: 'Weekly Department Oversight Cadence',
    description: 'Complete 3 scoped cohort oversight reviews this week for your authorized grades.',
    applicableRoles: ['coordinator'],
    category: 'oversight',
    period: 'weekly',
    estimatedMinutes: 15,
    targetCount: 3,
    rewardActionKey: 'weekly_mission_complete',
    rewardXp: 75,
    actionTab: 'faculty',
    actionLabel: 'Department Summary',
    cooldownHours: 168,
  },

  // =========================================================================
  // ADMIN & SUPER ADMIN OPERATIONAL MISSIONS (ZERO STUDENT STUDY CARDS)
  // =========================================================================
  {
    id: 'admin_approvals_queue_review',
    title: 'Review Pending Approvals & Leaves',
    description: 'Inspect pending role elevation requests and leave approvals in the Admin Center.',
    applicableRoles: ['admin', 'super_admin'],
    category: 'operations',
    period: 'daily',
    estimatedMinutes: 5,
    targetCount: 1,
    rewardActionKey: 'admin_ops_action',
    rewardXp: 25,
    actionTab: 'admin',
    actionLabel: 'Open Admin Approvals',
    cooldownHours: 24,
  },
  {
    id: 'admin_policy_broadcast_audit',
    title: 'Notification & Engagement Policy Hygiene',
    description: 'Verify active broadcast expiry rules, engagement policy configuration, and audit logs.',
    applicableRoles: ['admin', 'super_admin'],
    category: 'operations',
    period: 'daily',
    estimatedMinutes: 5,
    targetCount: 1,
    rewardActionKey: 'admin_ops_action',
    rewardXp: 25,
    actionTab: 'admin',
    actionLabel: 'Inspect Policies & Logs',
    cooldownHours: 24,
  },
  {
    id: 'admin_weekly_governance_check',
    title: 'Weekly Campus Governance Audit',
    description: 'Complete 3 operational reviews or policy audits across the campus workspace this week.',
    applicableRoles: ['admin', 'super_admin'],
    category: 'operations',
    period: 'weekly',
    estimatedMinutes: 10,
    targetCount: 3,
    rewardActionKey: 'weekly_mission_complete',
    rewardXp: 75,
    actionTab: 'admin',
    actionLabel: 'Governance Console',
    cooldownHours: 168,
  },
];

/**
 * Resolve strictly deduplicated applicable missions for one or more roles.
 */
export function resolveApplicableMissionDefinitions(
  roles: string[],
  options?: {
    hasPendingHomework?: boolean;
    hasPendingApprovals?: boolean;
  }
): RoleMissionDefinition[] {
  const normalizedRoles = Array.from(
    new Set(roles.map(r => String(r || '').toLowerCase().trim()).filter(Boolean))
  );
  if (normalizedRoles.length === 0) normalizedRoles.push('student');

  const isStaffOrAdmin = normalizedRoles.some(r =>
    ['teacher', 'coordinator', 'admin', 'super_admin', 'parent'].includes(r)
  );

  const seenIds = new Set<string>();
  const resolved: RoleMissionDefinition[] = [];

  for (const def of ROLE_TASK_REGISTRY) {
    if (seenIds.has(def.id)) continue;
    // Never bleed student study missions into admin/staff accounts unless they literally have student role selected
    if (
      def.applicableRoles.length === 1 &&
      def.applicableRoles[0] === 'student' &&
      !normalizedRoles.includes('student')
    ) {
      continue;
    }
    if (isStaffOrAdmin && !normalizedRoles.includes('student') && def.category === 'study') {
      continue;
    }
    const matchesRole = def.applicableRoles.some(r => normalizedRoles.includes(r));
    if (!matchesRole) continue;

    if (def.requiresContextFlag === 'has_pending_homework' && options && options.hasPendingHomework === false) {
      continue;
    }

    seenIds.add(def.id);
    resolved.push(def);
  }

  return resolved;
}
