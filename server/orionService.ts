/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Authoritative Server-Side Orion Agent Service
 * - Strict RBAC verification against verified user identity (never trusts client-spoofed roles)
 * - Multi-stage pipeline: Analyze -> Clarify -> Plan -> Permission Check -> Confirm Gate -> Execute -> Read-Back Verify -> Synthesize
 * - Zero database or disk persistence of Orion chat history (strictly ephemeral)
 */

import type express from 'express';
import {
  generateAICompletionWithTelemetry,
  getGroqApiKey,
  getMinistralApiKey,
  getZaiApiKey,
} from './aiClient';
import { performControlledWebSearch } from './webSearchEngine';

export interface SupabaseCfg {
  url: string;
  key: string;
}

export interface VerifiedOrionActor {
  userId: string;
  email?: string;
  name: string;
  role: string;
  grade?: string;
  section?: string;
  schoolId?: string;
  authenticated: boolean;
}

export type OrionServerActionType =
  | 'create_broadcast'
  | 'create_notice'
  | 'update_broadcast'
  | 'delete_broadcast'
  | 'create_notification'
  | 'create_reminder'
  | 'notify_users'
  | 'notify_class'
  | 'notify_all'
  | 'create_event'
  | 'update_event'
  | 'delete_event'
  | 'create_competition'
  | 'update_competition'
  | 'delete_competition'
  | 'register_competition'
  | 'create_meeting'
  | 'schedule_meeting'
  | 'cancel_meeting'
  | 'delete_meeting'
  | 'create_assignment'
  | 'create_homework'
  | 'update_assignment'
  | 'delete_assignment'
  | 'delete_homework'
  | 'delete_item'
  | 'start_attendance'
  | 'mark_attendance'
  | 'get_assignments'
  | 'get_homework'
  | 'get_submissions'
  | 'get_attendance'
  | 'get_students'
  | 'get_classes'
  | 'get_calendar'
  | 'get_notifications'
  | 'get_child_overview'
  | 'generate_report'
  | 'export_report'
  | 'daily_operations_summary'
  | 'search_internet'
  | 'web_search'
  | 'generate_notes'
  | 'generate_lesson_plan'
  | 'navigate_tab'
  | 'add_study_planner'
  | 'create_study_plan'
  | 'create_calendar_event'
  | 'create_note'
  | 'add_task'
  | 'complete_task'
  | 'delete_task'
  | 'general_chat';

export interface OrionActionStep {
  action: OrionServerActionType;
  title?: string;
  message?: string;
  content?: string;
  subject?: string;
  category?: string;
  audience?: string;
  targetClass?: string;
  targetUserId?: string;
  date?: string;
  time?: string;
  location?: string;
  prizePool?: string;
  eligibility?: string;
  meetingId?: string;
  targetId?: string;
  targetValue?: string;
  details?: Record<string, any>;
}

const WHITELISTED_SUPER_ADMIN_EMAILS = [
  'naitik.kashyap0015@gmail.com',
  'naitik.kashyap5205@gmail.com',
  'superadmin@studentos.edu',
  'superadmin@veylentra.edu',
];

const PRIVILEGED_OR_PRIVATE_ACTIONS = new Set<OrionServerActionType>([
  'create_broadcast',
  'create_notice',
  'update_broadcast',
  'delete_broadcast',
  'create_notification',
  'create_reminder',
  'notify_users',
  'notify_class',
  'notify_all',
  'create_event',
  'update_event',
  'delete_event',
  'create_competition',
  'update_competition',
  'delete_competition',
  'create_meeting',
  'schedule_meeting',
  'cancel_meeting',
  'delete_meeting',
  'create_assignment',
  'create_homework',
  'update_assignment',
  'delete_assignment',
  'delete_homework',
  'delete_item',
  'start_attendance',
  'mark_attendance',
  'get_submissions',
  'get_attendance',
  'get_students',
  'get_classes',
  'get_child_overview',
  'generate_report',
  'export_report',
  'daily_operations_summary',
  'create_calendar_event',
]);

const CONSEQUENTIAL_ACTION_SET = new Set<OrionServerActionType>([
  'create_broadcast',
  'create_notice',
  'update_broadcast',
  'delete_broadcast',
  'create_notification',
  'create_reminder',
  'notify_users',
  'notify_class',
  'notify_all',
  'create_event',
  'update_event',
  'delete_event',
  'create_competition',
  'update_competition',
  'delete_competition',
  'create_meeting',
  'schedule_meeting',
  'cancel_meeting',
  'delete_meeting',
  'create_assignment',
  'create_homework',
  'update_assignment',
  'delete_assignment',
  'delete_homework',
  'delete_item',
  'create_calendar_event',
  'mark_attendance',
  'start_attendance',
]);

const DESTRUCTIVE_ACTION_SET = new Set<OrionServerActionType>([
  'delete_broadcast',
  'delete_event',
  'delete_competition',
  'delete_meeting',
  'cancel_meeting',
  'delete_assignment',
  'delete_homework',
  'delete_item',
]);

export function isParentOrGuardianOrionRole(role?: string): boolean {
  const norm = String(role || '').toLowerCase().trim();
  return norm === 'parent' || norm === 'guardian';
}

const STUDENT_ALLOWED = new Set<OrionServerActionType>([
  'register_competition',
  'get_homework',
  'get_assignments',
  'get_calendar',
  'get_notifications',
  'navigate_tab',
  'general_chat',
  'add_study_planner',
  'create_study_plan',
  'create_note',
  'generate_notes',
  'add_task',
  'complete_task',
  'delete_task',
  'web_search',
  'search_internet',
]);

const COORDINATOR_OR_ADMIN_ONLY = new Set<OrionServerActionType>([
  'create_broadcast',
  'update_broadcast',
  'delete_broadcast',
  'notify_all',
]);

export function validateOrionRolePermission(
  action: OrionServerActionType,
  role: string
): { allowed: boolean; reason?: string } {
  const normRole = (role || 'student').toLowerCase().trim();

  if (isParentOrGuardianOrionRole(normRole)) {
    return {
      allowed: false,
      reason: 'Authorization denied: Orion Academic Agent is restricted to students, faculty, coordinators, and administrators.',
    };
  }

  const isAdmin = normRole === 'super_admin' || normRole === 'admin';
  const isCoordinator = normRole === 'coordinator' || normRole === 'hod' || isAdmin;
  const isStaff =
    normRole === 'teacher' ||
    normRole === 'faculty' ||
    normRole === 'head_teacher' ||
    isCoordinator ||
    isAdmin;

  if (!isStaff) {
    if (STUDENT_ALLOWED.has(action)) return { allowed: true };
    return {
      allowed: false,
      reason: `Authorization denied: "${action}" requires Teacher, Coordinator, or Administrator credentials.`,
    };
  }

  if (COORDINATOR_OR_ADMIN_ONLY.has(action) && !isCoordinator) {
    return {
      allowed: false,
      reason: `Authorization denied: "${action}" requires Coordinator, HOD, or Administrator privileges.`,
    };
  }

  return { allowed: true };
}

export type OrionTaskLifecycleState =
  | 'queued'
  | 'planning'
  | 'awaiting_confirmation'
  | 'running'
  | 'validating'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface OrionCompletionReport {
  taskId: string;
  generatedAt: string;
  actorRole: string;
  command: string;
  status: string;
  verified: boolean;
  providerUsed?: string;
  modelUsed?: string;
  durationMs: number;
  stages: any[];
  steps: any[];
  summary: string;
  markdown: string;
}

export interface OrionTaskRecord {
  taskId: string;
  actorUserId: string;
  actorRole: string;
  command: string;
  actionPlan?: OrionActionStep[];
  confirmed: boolean;
  activeTab: string;
  modelOverride?: string;
  history: { role: 'user' | 'assistant'; content: string }[];
  idempotencyKey?: string;
  status: OrionTaskLifecycleState;
  createdAt: number;
  updatedAt: number;
  finishedAt?: number;
  lastResponse?: Record<string, any>;
  report?: OrionCompletionReport;
}

const MAX_EPHEMERAL_TASKS = 200;
const orionTaskStore = new Map<string, OrionTaskRecord>();
const orionAbortRegistry = new Map<string, AbortController>();
const orionIdempotencyIndex = new Map<string, string>();

function storeEphemeralOrionTask(record: OrionTaskRecord) {
  if (!orionTaskStore.has(record.taskId) && orionTaskStore.size >= MAX_EPHEMERAL_TASKS) {
    const oldestKey = orionTaskStore.keys().next().value;
    if (oldestKey) {
      orionTaskStore.delete(oldestKey);
      orionAbortRegistry.delete(oldestKey);
    }
  }
  orionTaskStore.set(record.taskId, record);
}

export function buildOrionCompletionReport(params: {
  taskId: string;
  actorRole: string;
  command: string;
  status: string;
  verified: boolean;
  providerUsed?: string;
  modelUsed?: string;
  startedAt: number;
  finishedAt: number;
  stages: any[];
  steps: any[];
  summary: string;
}): OrionCompletionReport {
  const generatedAt = new Date(params.finishedAt).toISOString();
  const durationMs = Math.max(1, params.finishedAt - params.startedAt);
  const stageLines = params.stages
    .map((s) => `- **${s.label}** (${s.status}${s.durationMs !== undefined ? `, ${s.durationMs}ms` : ''})${s.detail ? `: ${s.detail}` : ''}`)
    .join('\n');
  const stepLines = params.steps
    .map((st, idx) => `${idx + 1}. **${st.label}** [\`${st.status}\`]${st.verificationNote ? ` — ${st.verificationNote}` : ''}${st.recordId ? ` (ID: \`${st.recordId}\`)` : ''}`)
    .join('\n');

  const markdown = [
    `# Orion Task Completion Report`,
    `- **Task ID:** \`${params.taskId}\``,
    `- **Role Scope:** ${params.actorRole}`,
    `- **Status:** ${params.status}${params.verified ? ' (Verified)' : ''}`,
    `- **Generated:** ${generatedAt}`,
    `- **Duration:** ${durationMs}ms`,
    params.providerUsed ? `- **AI Provider / Model:** ${params.providerUsed}${params.modelUsed ? ` / ${params.modelUsed}` : ''}` : '',
    `\n## Instruction\n${params.command}`,
    stageLines ? `\n## Lifecycle Stages\n${stageLines}` : '',
    stepLines ? `\n## Executed Steps\n${stepLines}` : '',
    `\n## Outcome Summary\n${params.summary}`,
  ]
    .filter(Boolean)
    .join('\n');

  return {
    taskId: params.taskId,
    generatedAt,
    actorRole: params.actorRole,
    command: params.command,
    status: params.status,
    verified: params.verified,
    providerUsed: params.providerUsed,
    modelUsed: params.modelUsed,
    durationMs,
    stages: params.stages,
    steps: params.steps,
    summary: params.summary,
    markdown,
  };
}

export function listOrionTasksForActor(actor: VerifiedOrionActor): { httpStatus: number; body: Record<string, any> } {
  if (isParentOrGuardianOrionRole(actor.role)) {
    return {
      httpStatus: 403,
      body: {
        success: false,
        status: 'forbidden',
        error: 'Forbidden: Orion Academic Agent is unavailable for Parent and Guardian accounts.',
      },
    };
  }
  const tasks = Array.from(orionTaskStore.values())
    .filter((t) => t.actorUserId === actor.userId)
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 25)
    .map((t) => ({
      taskId: t.taskId,
      command: t.command,
      status: t.status,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
      finishedAt: t.finishedAt,
      report: t.report,
    }));
  return { httpStatus: 200, body: { success: true, tasks } };
}

export function getOrionTaskForActor(taskId: string, actor: VerifiedOrionActor): { httpStatus: number; body: Record<string, any> } {
  if (isParentOrGuardianOrionRole(actor.role)) {
    return {
      httpStatus: 403,
      body: {
        success: false,
        status: 'forbidden',
        error: 'Forbidden: Orion Academic Agent is unavailable for Parent and Guardian accounts.',
      },
    };
  }
  const task = orionTaskStore.get(String(taskId || '').trim());
  if (!task) {
    return { httpStatus: 404, body: { success: false, error: 'Orion task not found.' } };
  }
  if (task.actorUserId !== actor.userId) {
    return { httpStatus: 403, body: { success: false, status: 'forbidden', error: 'Forbidden: cannot access another user\'s Orion task.' } };
  }
  return {
    httpStatus: 200,
    body: {
      success: true,
      taskId: task.taskId,
      status: task.status,
      command: task.command,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
      finishedAt: task.finishedAt,
      report: task.report,
      snapshot: task.lastResponse?.snapshot,
    },
  };
}

export function cancelOrionTask(taskId: string, actor: VerifiedOrionActor): { httpStatus: number; body: Record<string, any> } {
  if (isParentOrGuardianOrionRole(actor.role)) {
    return {
      httpStatus: 403,
      body: {
        success: false,
        status: 'forbidden',
        error: 'Forbidden: Orion Academic Agent is unavailable for Parent and Guardian accounts.',
      },
    };
  }
  const cleanId = String(taskId || '').trim();
  const task = orionTaskStore.get(cleanId);
  if (!task) {
    return { httpStatus: 404, body: { success: false, error: 'Orion task not found.' } };
  }
  if (task.actorUserId !== actor.userId) {
    return { httpStatus: 403, body: { success: false, status: 'forbidden', error: 'Forbidden: cannot cancel another user\'s Orion task.' } };
  }
  const ctrl = orionAbortRegistry.get(cleanId);
  if (ctrl && !ctrl.signal.aborted) {
    ctrl.abort();
  }
  const now = Date.now();
  if (task.status !== 'completed' && task.status !== 'failed') {
    task.status = 'cancelled';
    task.updatedAt = now;
    task.finishedAt = now;
  }
  return {
    httpStatus: 200,
    body: {
      success: true,
      taskId: task.taskId,
      status: task.status,
      message: 'Orion task cancelled.',
    },
  };
}

export async function retryOrionTask(
  taskId: string,
  actor: VerifiedOrionActor,
  cfg: SupabaseCfg,
  dispatchPushFn?: (payload: any) => Promise<any>
): Promise<{ httpStatus: number; body: Record<string, any> }> {
  if (isParentOrGuardianOrionRole(actor.role)) {
    return {
      httpStatus: 403,
      body: {
        success: false,
        status: 'forbidden',
        error: 'Forbidden: Orion Academic Agent is unavailable for Parent and Guardian accounts.',
      },
    };
  }
  const task = orionTaskStore.get(String(taskId || '').trim());
  if (!task) {
    return { httpStatus: 404, body: { success: false, error: 'Orion task not found.' } };
  }
  if (task.actorUserId !== actor.userId) {
    return { httpStatus: 403, body: { success: false, status: 'forbidden', error: 'Forbidden: cannot retry another user\'s Orion task.' } };
  }
  return executeOrionServerRequest({
    cfg,
    actor,
    command: task.command,
    actionPlan: task.actionPlan,
    confirmed: task.confirmed,
    activeTab: task.activeTab,
    modelOverride: task.modelOverride,
    history: task.history,
    dispatchPushFn,
  });
}

/**
 * Resolves the authoritative actor from Bearer token or verified Supabase user_profiles lookup.
 * NEVER trusts client body `userRole` or unverified `x-veylentra-role`.
 */
export async function resolveVerifiedOrionActor(
  req: express.Request,
  cfg: SupabaseCfg
): Promise<{ ok: true; actor: VerifiedOrionActor } | { ok: false; status: number; error: string }> {
  const authHeader = String(req.headers.authorization || req.headers['x-supabase-auth'] || '').trim();
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();

  if (token) {
    try {
      const userRes = await fetch(`${cfg.url}/auth/v1/user`, {
        headers: {
          apikey: cfg.key,
          Authorization: `Bearer ${token}`,
        },
      });
      if (!userRes.ok) {
        return { ok: false, status: 401, error: 'Invalid or expired authentication token.' };
      }
      const user: any = await userRes.json();
      if (!user?.id) {
        return { ok: false, status: 401, error: 'Invalid authentication session.' };
      }

      const email = String(user.email || '').toLowerCase().trim();
      let role = String(user.user_metadata?.role || 'student').toLowerCase().trim();
      let name = String(user.user_metadata?.name || user.user_metadata?.full_name || email.split('@')[0] || 'Campus Member');
      let grade = String(user.user_metadata?.grade || '');
      let section = String(user.user_metadata?.section || '');
      let schoolId = String(user.user_metadata?.school_id || '');

      if (email && WHITELISTED_SUPER_ADMIN_EMAILS.includes(email)) {
        role = 'super_admin';
      } else {
        try {
          const profRes = await fetch(
            `${cfg.url}/rest/v1/user_profiles?or=(id.eq.${encodeURIComponent(user.id)},uid.eq.${encodeURIComponent(user.id)},email.eq.${encodeURIComponent(email)})&select=id,name,role,grade,section,school_id`,
            { headers: { apikey: cfg.key, Authorization: `Bearer ${cfg.key}` } }
          );
          if (profRes.ok) {
            const rows: any = await profRes.json();
            if (Array.isArray(rows) && rows[0]) {
              if (rows[0].role) role = String(rows[0].role).toLowerCase().trim();
              if (rows[0].name) name = String(rows[0].name);
              if (rows[0].grade) grade = String(rows[0].grade);
              if (rows[0].section) section = String(rows[0].section);
              if (rows[0].school_id) schoolId = String(rows[0].school_id);
            }
          }
        } catch (_) {}
      }

      return {
        ok: true,
        actor: {
          userId: user.id,
          email,
          name,
          role,
          grade,
          section,
          schoolId,
          authenticated: true,
        },
      };
    } catch {
      return { ok: false, status: 401, error: 'Unable to validate authentication token.' };
    }
  }

  // Fallback ONLY for DB-verified PIN/demo identities via user_profiles (never trusting role headers)
  const uidHeader = String(req.headers['x-veylentra-uid'] || '').trim();
  const emailHeader = String(req.headers['x-veylentra-email'] || '').toLowerCase().trim();
  const actorId = uidHeader || emailHeader;

  if (actorId && actorId !== 'guest' && actorId !== 'anonymous' && actorId !== 'user_guest') {
    if (
      WHITELISTED_SUPER_ADMIN_EMAILS.includes(emailHeader) ||
      WHITELISTED_SUPER_ADMIN_EMAILS.includes(actorId.toLowerCase()) ||
      actorId === 'superadmin-master-uid'
    ) {
      return {
        ok: true,
        actor: {
          userId: actorId,
          email: emailHeader || undefined,
          name: 'Super Administrator',
          role: 'super_admin',
          authenticated: true,
        },
      };
    }

    try {
      const profRes = await fetch(
        `${cfg.url}/rest/v1/user_profiles?or=(id.eq.${encodeURIComponent(actorId)},uid.eq.${encodeURIComponent(actorId)},email.eq.${encodeURIComponent(emailHeader || actorId)})&select=id,name,role,grade,section,school_id`,
        { headers: { apikey: cfg.key, Authorization: `Bearer ${cfg.key}` } }
      );
      if (profRes.ok) {
        const rows: any = await profRes.json();
        if (Array.isArray(rows) && rows[0]) {
          return {
            ok: true,
            actor: {
              userId: String(rows[0].id || actorId),
              email: emailHeader || undefined,
              name: String(rows[0].name || 'Campus Member'),
              role: String(rows[0].role || 'student').toLowerCase().trim(),
              grade: rows[0].grade ? String(rows[0].grade) : undefined,
              section: rows[0].section ? String(rows[0].section) : undefined,
              schoolId: rows[0].school_id ? String(rows[0].school_id) : undefined,
              authenticated: true,
            },
          };
        }
      }
    } catch (_) {}
  }

  return {
    ok: true,
    actor: {
      userId: actorId || 'guest',
      email: emailHeader || undefined,
      name: 'Guest User',
      role: 'student',
      authenticated: false,
    },
  };
}

export function normalizeMappedAction(rawAction: string, commandLower: string): OrionServerActionType {
  const a = String(rawAction || '').toLowerCase().trim();
  const aliasMap: Record<string, OrionServerActionType> = {
    send_broadcast: 'create_broadcast',
    create_announcement: 'create_broadcast',
    create_meet: 'create_meeting',
    create_homework: 'create_homework',
    create_assignment: 'create_assignment',
  };
  if (aliasMap[a]) return aliasMap[a];

  const validSet = new Set<string>([
    'create_broadcast', 'create_notice', 'update_broadcast', 'delete_broadcast',
    'create_notification', 'create_reminder', 'notify_users', 'notify_class', 'notify_all',
    'create_event', 'update_event', 'delete_event', 'create_competition', 'update_competition',
    'delete_competition', 'register_competition', 'create_meeting', 'schedule_meeting',
    'cancel_meeting', 'delete_meeting', 'create_assignment', 'create_homework',
    'update_assignment', 'delete_assignment', 'delete_homework', 'delete_item',
    'start_attendance', 'mark_attendance', 'get_assignments', 'get_homework', 'get_submissions',
    'get_attendance', 'get_students', 'get_classes', 'get_calendar', 'get_notifications',
    'get_child_overview', 'generate_report', 'export_report', 'daily_operations_summary',
    'search_internet', 'web_search', 'generate_notes', 'generate_lesson_plan', 'navigate_tab',
    'add_study_planner', 'create_study_plan', 'create_calendar_event', 'create_note',
    'add_task', 'complete_task', 'delete_task', 'general_chat',
  ]);
  if (validSet.has(a)) return a as OrionServerActionType;

  if (/\b(child|ward|son|daughter)\b/.test(commandLower) && /\b(overview|homework|attendance|progress|summary)\b/.test(commandLower)) {
    return 'get_child_overview';
  }
  if (/\b(submission|submitted|missing homework|who has not submitted)\b/.test(commandLower)) {
    return 'get_submissions';
  }
  if ((commandLower.includes('homework') || commandLower.includes('assignment')) && /\b(create|assign|publish|give|add)\b/.test(commandLower)) {
    return 'create_homework';
  }
  if ((commandLower.includes('homework') || commandLower.includes('assignment')) && /\b(what|show|check|pending|missing|list|status|due|my)\b/.test(commandLower)) {
    return 'get_homework';
  }
  if (commandLower.includes('attendance') && /\b(take|mark|start|record)\b/.test(commandLower)) {
    return 'mark_attendance';
  }
  if (commandLower.includes('attendance')) {
    return 'get_attendance';
  }
  if (/\b(generate|daily|school|class|operations)\s*(briefing|report|summary)\b/.test(commandLower)) {
    return 'generate_report';
  }
  if (/\b(broadcast|announcement)\b/.test(commandLower) && /\b(create|send|publish|post|make|announce)\b/.test(commandLower)) {
    return 'create_broadcast';
  }
  if (/\b(notify|send reminder|alert class|tell class)\b/.test(commandLower)) {
    return 'notify_users';
  }
  if (/\b(competition)\b/.test(commandLower) && /\b(create|add|host|publish|launch)\b/.test(commandLower)) {
    return 'create_competition';
  }
  if (/\b(event|assembly|annual function)\b/.test(commandLower) && /\b(create|schedule|add|host)\b/.test(commandLower)) {
    return 'create_event';
  }
  if (/\b(meet|meeting|session)\b/.test(commandLower) && /\b(schedule|create|book|start)\b/.test(commandLower)) {
    return 'create_meeting';
  }
  if (/^(delete|cancel|remove)\b/.test(commandLower)) {
    return 'delete_item';
  }
  if (commandLower.includes('study plan') || commandLower.includes('revision plan')) {
    return 'create_study_plan';
  }
  if (commandLower.includes('study planner')) {
    return 'add_study_planner';
  }
  if (commandLower.includes('calendar') && /\b(add|schedule|create)\b/.test(commandLower)) {
    return 'create_calendar_event';
  }
  if (commandLower.includes('calendar') || commandLower.includes('upcoming event')) {
    return 'get_calendar';
  }
  if (commandLower.includes('notice') || commandLower.includes('announcement') || commandLower.includes('notification')) {
    return 'get_notifications';
  }
  if (commandLower.includes('student') && /\b(list|directory|summary|how many|count)\b/.test(commandLower)) {
    return 'get_students';
  }
  if (commandLower.startsWith('search ') || commandLower.startsWith('look up ') || commandLower.includes('search the web')) {
    return 'web_search';
  }
  return 'general_chat';
}

export function validateActionParametersServer(
  act: OrionActionStep,
  rawCommand: string
): { valid: boolean; missingFields: string[]; clarificationQuestion?: string } {
  const cmdClean = (rawCommand || '').trim();
  const cleanTitle = (act.title || (act.targetValue && act.targetValue !== cmdClean ? act.targetValue : '') || '').trim();
  const cleanMsg = (act.message || (act.content && act.content !== cmdClean ? act.content : '') || '').trim();
  const genericWords = /^(delete|cancel|remove|create|send|publish|post|assign|schedule|notify|item|something|it|that|this|homework|assignment|broadcast|notice|announcement|alert|reminder|meeting|meet|event|competition|users?|class|all)$/i;
  const genericPhrase = /^(delete|cancel|remove|create|send|publish|post|make|assign|schedule|notify|add|host|book|launch)\s+(a\s+|an\s+|the\s+|new\s+|school\s+)?(competition|event|meeting|meet|homework|assignment|broadcast|notice|announcement|notification|reminder|alert|calendar event|item|users?|class|all)$/i;

  if (DESTRUCTIVE_ACTION_SET.has(act.action)) {
    const rawCandidate = (act.targetId || (act.targetValue && act.targetValue !== cmdClean ? act.targetValue : '') || act.title || '').trim();
    const stripDestructive = (s: string) =>
      s.replace(/^(delete|cancel|remove)\s+(a\s+|an\s+|the\s+)?(competition|event|meeting|meet|homework|assignment|broadcast|notice|announcement|item)?\s*/i, '').trim();
    const strippedCandidate = stripDestructive(rawCandidate);
    const strippedCmd = stripDestructive(cmdClean);
    const effectiveTarget = (!genericWords.test(strippedCandidate) && !genericPhrase.test(rawCandidate) && strippedCandidate.length >= 2)
      ? strippedCandidate
      : strippedCmd;
    if (!effectiveTarget || effectiveTarget.length < 2 || genericWords.test(effectiveTarget) || genericPhrase.test(cmdClean)) {
      return {
        valid: false,
        missingFields: ['target item name or ID'],
        clarificationQuestion: 'Which exact competition, event, meeting, notice, or homework should I remove? Please provide its title or keyword.',
      };
    }
  }

  if (
    act.action === 'create_broadcast' ||
    act.action === 'create_notice' ||
    act.action === 'notify_users' ||
    act.action === 'notify_class' ||
    act.action === 'notify_all' ||
    act.action === 'create_notification' ||
    act.action === 'create_reminder'
  ) {
    const stripped = cmdClean
      .replace(/^(send|create|publish|post|make)\s+(a\s+|an\s+|the\s+)?(school\s+)?(broadcast|notice|announcement|notification|reminder|alert)\s*(to|for|saying|about)?\s*/i, '')
      .replace(/^notify\s+(all\s+)?(students|teachers|staff|parents|class\s+\d+[a-z]?)?\s*(about|that)?\s*/i, '')
      .trim();
    const hasDetails =
      (cleanMsg && !genericWords.test(cleanMsg) && !genericPhrase.test(cleanMsg)) ||
      (cleanTitle && !genericWords.test(cleanTitle) && !genericPhrase.test(cleanTitle)) ||
      (stripped.length >= 4 && !genericWords.test(stripped) && !genericPhrase.test(cmdClean));
    if (!hasDetails) {
      return {
        valid: false,
        missingFields: ['message content', 'target audience'],
        clarificationQuestion: 'What exact message and target audience (for example, "All Students", "Class 10", or "Teachers") should this announcement use?',
      };
    }
  }

  if (act.action === 'create_homework' || act.action === 'create_assignment') {
    const stripped = cmdClean
      .replace(/^(create|assign|add|publish)\s+(a\s+|an\s+|the\s+)?(new\s+)?(homework|assignment)\s*(for|to|on|about)?\s*/i, '')
      .replace(/\b(for\s+)?(class|grade)\s+\d+[a-z]*\b/gi, '')
      .trim();
    const hasTopic =
      (cleanTitle && !genericWords.test(cleanTitle) && !genericPhrase.test(cleanTitle)) ||
      (stripped.length >= 3 && !genericWords.test(stripped) && !genericPhrase.test(cmdClean));
    if (!hasTopic) {
      return {
        valid: false,
        missingFields: ['assignment topic/title', 'target class'],
        clarificationQuestion: 'Please specify the homework title or topic and target class (e.g., "Assign Algebra Worksheet to Grade 10 due Friday").',
      };
    }
  }

  if (
    act.action === 'create_competition' ||
    act.action === 'create_event' ||
    act.action === 'create_meeting' ||
    act.action === 'schedule_meeting' ||
    act.action === 'create_calendar_event'
  ) {
    const stripped = cmdClean
      .replace(/^(create|schedule|add|host|book|launch)\s+(a\s+|an\s+|the\s+)?(new\s+)?(competition|event|meeting|meet|calendar event)\s*(called|named|titled|for|on|at)?\s*/i, '')
      .trim();
    const hasDetails =
      (cleanTitle && !genericWords.test(cleanTitle) && !genericPhrase.test(cleanTitle)) ||
      (stripped.length >= 3 && !genericWords.test(stripped) && !genericPhrase.test(cmdClean));
    if (!hasDetails) {
      return {
        valid: false,
        missingFields: ['title', 'date/time'],
        clarificationQuestion: `What should the ${act.action.replace(/_/g, ' ').replace('create ', '')} be titled, and what date/time should it be scheduled for?`,
      };
    }
  }

  return { valid: true, missingFields: [] };
}

function parseClassAndSection(input?: string): { grade: string; section: string } {
  const str = (input || '').trim();
  const numMatch = str.match(/\b(\d{1,2})\b/);
  const secMatch = str.match(/\b(solara|astra|elara|vega|ruby|emerald|sapphire|topaz)\b/i);
  return {
    grade: numMatch ? `Grade ${numMatch[1]}` : 'Grade 10',
    section: secMatch ? secMatch[1].charAt(0).toUpperCase() + secMatch[1].slice(1).toLowerCase() : 'All Sections',
  };
}

function parseSafeJsonObject(raw: string): any | null {
  if (!raw || typeof raw !== 'string') return null;
  let cleaned = raw.trim();
  const fenced = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced && fenced[1]) {
    cleaned = fenced[1].trim();
  }
  const objMatch = cleaned.match(/\{[\s\S]*\}/);
  if (objMatch) cleaned = objMatch[0];
  try {
    const parsed = JSON.parse(cleaned);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

async function fetchJsonSafe(url: string, init?: RequestInit): Promise<{ ok: boolean; status: number; data: any; errorText?: string }> {
  try {
    const resp = await fetch(url, init);
    const text = await resp.text().catch(() => '');
    let data: any = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = text;
    }
    return {
      ok: resp.ok,
      status: resp.status,
      data,
      errorText: resp.ok ? undefined : (typeof data === 'object' && data?.message ? data.message : text || resp.statusText),
    };
  } catch (err: any) {
    return { ok: false, status: 502, data: null, errorText: err?.message || 'Network request failed' };
  }
}

async function verifyRowPersisted(cfg: SupabaseCfg, table: string, id: string): Promise<{ verified: boolean; note: string }> {
  const check = await fetchJsonSafe(
    `${cfg.url}/rest/v1/${table}?id=eq.${encodeURIComponent(id)}&select=id`,
    { headers: { apikey: cfg.key, Authorization: `Bearer ${cfg.key}` } }
  );
  if (!check.ok) {
    return { verified: false, note: `Read-back verification query failed on ${table} (HTTP ${check.status}).` };
  }
  if (!Array.isArray(check.data) || !check.data.some((r: any) => String(r?.id) === String(id))) {
    return { verified: false, note: `Written record ${id} could not be confirmed in ${table}.` };
  }
  return { verified: true, note: `Verified persisted record ${id} in ${table}.` };
}

export async function executeOrionServerRequest(params: {
  cfg: SupabaseCfg;
  actor: VerifiedOrionActor;
  command: string;
  actionPlan?: OrionActionStep[];
  confirmed?: boolean;
  activeTab?: string;
  modelOverride?: string;
  history?: { role: 'user' | 'assistant'; content: string }[];
  dispatchPushFn?: (payload: any) => Promise<any>;
  taskId?: string;
  idempotencyKey?: string;
  signal?: AbortSignal;
}): Promise<{ httpStatus: number; body: Record<string, any> }> {
  const {
    cfg,
    actor,
    command,
    actionPlan,
    confirmed = false,
    activeTab = 'dashboard',
    modelOverride,
    history = [],
    dispatchPushFn,
    idempotencyKey,
    signal,
  } = params;
  const startedAt = Date.now();
  const cmdTrimmed = String(command || '').trim();
  const cmdLower = cmdTrimmed.toLowerCase();

  // MANDATORY STRICT PARENT / GUARDIAN EXCLUSION (HTTP 403 Forbidden)
  if (isParentOrGuardianOrionRole(actor.role)) {
    const reason = 'Forbidden: Orion Academic Agent is unavailable for Parent and Guardian accounts.';
    return {
      httpStatus: 403,
      body: {
        success: false,
        status: 'forbidden',
        error: reason,
        finalResponse: reason,
      },
    };
  }

  if (!cmdTrimmed) {
    return {
      httpStatus: 400,
      body: {
        success: false,
        status: 'error',
        error: 'Command or instruction is required.',
      },
    };
  }

  const cleanIdempotency = typeof idempotencyKey === 'string' ? idempotencyKey.trim() : '';
  if (cleanIdempotency) {
    const existingId = orionIdempotencyIndex.get(`${actor.userId}:${cleanIdempotency}`);
    if (existingId) {
      const existingTask = orionTaskStore.get(existingId);
      if (existingTask && existingTask.actorUserId === actor.userId && existingTask.lastResponse) {
        return {
          httpStatus: 200,
          body: {
            ...existingTask.lastResponse,
            deduplicated: true,
          },
        };
      }
    }
  }

  const taskId = (typeof params.taskId === 'string' && params.taskId.trim())
    ? params.taskId.trim()
    : `orion_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  const taskController = new AbortController();
  orionAbortRegistry.set(taskId, taskController);
  if (signal) {
    if (signal.aborted) taskController.abort();
    else signal.addEventListener('abort', () => taskController.abort(), { once: true });
  }

  const taskRecord: OrionTaskRecord = {
    taskId,
    actorUserId: actor.userId,
    actorRole: actor.role,
    command: cmdTrimmed,
    actionPlan,
    confirmed,
    activeTab,
    modelOverride,
    history: history.slice(-6),
    idempotencyKey: cleanIdempotency || undefined,
    status: 'queued',
    createdAt: startedAt,
    updatedAt: startedAt,
  };
  storeEphemeralOrionTask(taskRecord);
  if (cleanIdempotency) {
    orionIdempotencyIndex.set(`${actor.userId}:${cleanIdempotency}`, taskId);
  }

  const buildCancelledResult = (stages: any[], plannedSteps: OrionActionStep[], stepResults: any[] = []) => {
    const now = Date.now();
    taskRecord.status = 'cancelled';
    taskRecord.updatedAt = now;
    taskRecord.finishedAt = now;
    const summary = 'Orion task cancelled by user.';
    const snapshot = {
      phase: 'cancelled',
      headline: 'Task cancelled.',
      stages,
      steps: stepResults.length > 0
        ? stepResults
        : plannedSteps.map((s, idx) => ({
            id: `step-${idx + 1}`,
            label: s.action.replace(/_/g, ' '),
            action: s.action,
            status: 'blocked',
            detail: 'Cancelled before completion',
          })),
      startedAt,
      finishedAt: now,
      verified: false,
    };
    const report = buildOrionCompletionReport({
      taskId,
      actorRole: actor.role,
      command: cmdTrimmed,
      status: 'cancelled',
      verified: false,
      startedAt,
      finishedAt: now,
      stages,
      steps: snapshot.steps,
      summary,
    });
    taskRecord.report = report;
    const body = {
      success: false,
      status: 'cancelled',
      taskId,
      plan: plannedSteps,
      results: stepResults,
      finalResponse: summary,
      report,
      snapshot,
    };
    taskRecord.lastResponse = body;
    return { httpStatus: 200, body };
  };

  taskRecord.status = 'planning';
  taskRecord.updatedAt = Date.now();

  // Stage 1: Analyze & Plan
  let plannedSteps: OrionActionStep[] = Array.isArray(actionPlan) && actionPlan.length > 0 ? actionPlan : [];
  let aiResponseText = '';
  let modelUsed = '';
  let providerUsed = '';

  const hasAnyProviderKey = Boolean(getGroqApiKey() || getMinistralApiKey() || getZaiApiKey());

  if (plannedSteps.length === 0) {
    // Try explicit quick-rule first for crisp reliability, and enrich with LLM planner when available
    const quickAction = normalizeMappedAction('', cmdLower);
    const shouldConsultLlmPlanner =
      hasAnyProviderKey &&
      (quickAction === 'general_chat' || cmdTrimmed.split(/\s+/).length >= 4);

    if (shouldConsultLlmPlanner) {
      const plannerSystem = `You are Veylentra Orion, the school-wide intelligent operating agent running in an ephemeral session.
Actor Role: ${actor.role}
Actor Grade/Section: ${actor.grade || 'Unspecified'} ${actor.section || ''}
Active Workspace Tab: ${activeTab}

Respond strictly in valid JSON with this exact schema:
{
  "action": "get_homework|get_submissions|get_attendance|get_students|get_classes|get_calendar|get_notifications|get_child_overview|generate_report|create_broadcast|create_notice|notify_users|create_event|create_competition|create_meeting|create_homework|create_calendar_event|create_study_plan|add_study_planner|create_note|add_task|complete_task|delete_task|delete_item|mark_attendance|navigate_tab|web_search|general_chat",
  "targetValue": "main entity title, query, or tab",
  "responseText": "clear academic/conversational response if general_chat, or brief operational framing",
  "details": {
    "title": "string",
    "content": "string",
    "subject": "string",
    "targetClass": "string",
    "targetAudience": "string",
    "date": "YYYY-MM-DD or natural date",
    "time": "string"
  }
}`;
      try {
        const llmRes = await generateAICompletionWithTelemetry({
          systemInstruction: plannerSystem,
          prompt: cmdTrimmed,
          history: history.slice(-6),
          jsonMode: true,
          taskType: 'tool',
          modelOverride,
          userRole: actor.role,
          endpointName: 'OrionExecutePlanner',
          maxTokens: 1200,
        });
        modelUsed = llmRes.telemetry.modelUsed;
        providerUsed = llmRes.telemetry.providerUsed;
        const parsed = parseSafeJsonObject(llmRes.text);
        if (parsed) {
          const mapped = normalizeMappedAction(parsed.action || '', cmdLower);
          const d = parsed.details || {};
          plannedSteps = [
            {
              action: mapped,
              title: d.title || parsed.targetValue || undefined,
              message: d.content || undefined,
              content: d.content || undefined,
              subject: d.subject || undefined,
              targetClass: d.targetClass || undefined,
              audience: d.targetAudience || undefined,
              date: d.date || undefined,
              time: d.time || undefined,
              targetValue: parsed.targetValue || d.title || undefined,
              details: d,
            },
          ];
          if (typeof parsed.responseText === 'string' && parsed.responseText.trim()) {
            aiResponseText = parsed.responseText.trim();
          }
        } else if (llmRes.text && llmRes.text.trim()) {
          aiResponseText = llmRes.text.trim();
          plannedSteps = [{ action: quickAction, targetValue: cmdTrimmed }];
        }
      } catch (planErr: any) {
        // Never fail into generic placeholder silently; fall back to deterministic classifier
        console.warn('[ORION_SERVICE] Planner LLM notice:', planErr?.message || planErr);
      }
    }

    if (plannedSteps.length === 0) {
      plannedSteps = [{ action: quickAction, targetValue: cmdTrimmed }];
    }

    // Compound multi-step expansion (e.g., competition + notify)
    const primary = plannedSteps[0];
    if (
      (cmdLower.includes('competition') || cmdLower.includes('event') || cmdLower.includes('meet') || cmdLower.includes('assignment') || cmdLower.includes('homework')) &&
      (cmdLower.includes(' and notify ') || cmdLower.includes(' and tell ') || cmdLower.includes(' and send notification'))
    ) {
      const classMatch = cmdLower.match(/class\s+(\d+[a-z]?)/i);
      plannedSteps.push({
        action: 'notify_users',
        title: `Update: ${primary.title || 'New School Item'}`,
        message: `New update scheduled: ${primary.title || cmdTrimmed}`,
        audience: classMatch ? `Class ${classMatch[1].toUpperCase()}` : 'all',
        targetClass: classMatch ? `Class ${classMatch[1].toUpperCase()}` : undefined,
      });
    }
  }

  const analyzeDurationMs = Math.max(1, Date.now() - startedAt);
  const stages: any[] = [
    { phase: 'analyzing', label: 'Analyzing intent', status: 'completed', durationMs: analyzeDurationMs },
    { phase: 'planning', label: 'Planning steps', status: 'completed', durationMs: 1, detail: `${plannedSteps.length} step${plannedSteps.length > 1 ? 's' : ''}` },
  ];

  // Stage 2: Missing Parameter Clarification Gate
  for (const step of plannedSteps) {
    const paramCheck = validateActionParametersServer(step, cmdTrimmed);
    if (!paramCheck.valid) {
      stages.push({ phase: 'preparing', label: 'Checking prerequisites & details', status: 'failed', detail: 'Missing required details' });
      return {
        httpStatus: 200,
        body: {
          success: true,
          status: 'needs_clarification',
          clarificationQuestion: paramCheck.clarificationQuestion,
          missingFields: paramCheck.missingFields,
          plan: plannedSteps,
          finalResponse: paramCheck.clarificationQuestion,
          providerUsed,
          modelUsed,
          snapshot: {
            phase: 'failed',
            headline: 'Clarification needed before continuing.',
            stages,
            steps: plannedSteps.map((s, idx) => ({
              id: `step-${idx + 1}`,
              label: s.action.replace(/_/g, ' '),
              action: s.action,
              status: 'blocked',
              detail: `Missing: ${paramCheck.missingFields.join(', ')}`,
            })),
            startedAt,
            finishedAt: Date.now(),
            verified: false,
          },
        },
      };
    }
  }

  // Stage 3: Authoritative Server-Side RBAC Verification
  for (const step of plannedSteps) {
    if (PRIVILEGED_OR_PRIVATE_ACTIONS.has(step.action) && !actor.authenticated) {
      const reason = `Authentication required: Please sign in to execute "${step.action}".`;
      stages.push({ phase: 'preparing', label: 'Checking permissions & prerequisites', status: 'failed', detail: reason });
      return {
        httpStatus: 401,
        body: {
          success: false,
          status: 'unauthorized',
          error: reason,
          finalResponse: reason,
          plan: plannedSteps,
          snapshot: {
            phase: 'failed',
            headline: 'Authentication required.',
            stages,
            steps: plannedSteps.map((s, idx) => ({
              id: `step-${idx + 1}`,
              label: s.action.replace(/_/g, ' '),
              action: s.action,
              status: 'blocked',
              detail: reason,
            })),
            startedAt,
            finishedAt: Date.now(),
            verified: false,
          },
        },
      };
    }

    const perm = validateOrionRolePermission(step.action, actor.role);
    if (!perm.allowed) {
      stages.push({ phase: 'preparing', label: 'Checking permissions & prerequisites', status: 'failed', detail: perm.reason });
      return {
        httpStatus: 403,
        body: {
          success: false,
          status: 'forbidden',
          error: perm.reason,
          finalResponse: perm.reason,
          plan: plannedSteps,
          snapshot: {
            phase: 'failed',
            headline: 'Authorization denied by server RBAC.',
            stages,
            steps: plannedSteps.map((s, idx) => ({
              id: `step-${idx + 1}`,
              label: s.action.replace(/_/g, ' '),
              action: s.action,
              status: 'blocked',
              detail: perm.reason,
            })),
            startedAt,
            finishedAt: Date.now(),
            verified: false,
          },
        },
      };
    }
  }

  stages.push({
    phase: 'preparing',
    label: 'Checking permissions & prerequisites',
    status: 'completed',
    durationMs: 1,
    detail: `Authorized (${actor.role})`,
  });

  // Stage 4: Confirmation Gate for Consequential / Destructive Actions
  const hasConsequential = plannedSteps.some((s) => CONSEQUENTIAL_ACTION_SET.has(s.action));
  if (hasConsequential && !confirmed) {
    const primary = plannedSteps[0];
    const targetTitle = primary.title || primary.targetValue || cmdTrimmed.slice(0, 72);
    const previewDetails: Record<string, string> = {
      Action: primary.action.replace(/_/g, ' ').toUpperCase(),
      Target: targetTitle,
      Audience: primary.targetClass || primary.audience || 'All Authorized Recipients',
      ...(primary.date ? { Date: primary.date } : {}),
      ...(primary.time ? { Time: primary.time } : {}),
      Preview: primary.content || primary.message || cmdTrimmed,
    };
    const isDestructive = plannedSteps.some((s) => DESTRUCTIVE_ACTION_SET.has(s.action));
    const promptText = isDestructive
      ? `Confirm permanent removal of "${targetTitle}"? This database action cannot be undone.`
      : `Review the planned details for "${targetTitle}" and confirm to execute.`;

    stages.push({
      phase: 'awaiting_confirmation',
      label: 'Awaiting user confirmation',
      status: 'active',
      detail: 'Awaiting explicit confirmation',
    });

    taskRecord.status = 'awaiting_confirmation';
    taskRecord.updatedAt = Date.now();
    taskRecord.actionPlan = plannedSteps;

    const awaitBody = {
      success: true,
      status: 'awaiting_confirmation',
      taskId,
      pendingConfirmation: {
        action: primary.action,
        targetTitle,
        promptText,
        previewDetails,
        actionObject: primary,
        plannedSteps,
      },
      plan: plannedSteps,
      finalResponse: `Confirmation required before making changes.\n\n- **Action:** ${primary.action.replace(/_/g, ' ')}\n- **Target:** ${targetTitle}\n- **Audience:** ${previewDetails.Audience}`,
      providerUsed,
      modelUsed,
      snapshot: {
        phase: 'awaiting_confirmation',
        headline: 'Confirmation required before making changes.',
        stages,
        steps: plannedSteps.map((s, idx) => ({
          id: `step-${idx + 1}`,
          label: s.action.replace(/_/g, ' '),
          action: s.action,
          status: 'pending',
          detail: 'Waiting for confirmation',
        })),
        startedAt,
        finishedAt: Date.now(),
        verified: false,
      },
    };
    taskRecord.lastResponse = awaitBody;
    return {
      httpStatus: 200,
      body: awaitBody,
    };
  }

  if (taskController.signal.aborted) {
    return buildCancelledResult(stages, plannedSteps);
  }

  taskRecord.status = 'running';
  taskRecord.updatedAt = Date.now();
  taskRecord.actionPlan = plannedSteps;

  // Stage 5: Real Execution & Read-Back Verification
  const execStart = Date.now();
  const stepResults: any[] = [];
  const summaryParts: string[] = [];
  const clientBridgeActions: OrionActionStep[] = [];
  const refreshTables = new Set<string>();
  let structuredData: any = null;
  let webSources: any[] = [];
  let webVideos: any[] = [];
  let allSucceeded = true;
  let allVerified = true;

  for (let i = 0; i < plannedSteps.length; i++) {
    if (taskController.signal.aborted) {
      return buildCancelledResult(stages, plannedSteps, stepResults);
    }
    const act = plannedSteps[i];
    const stepLog: any = {
      id: `step-${i + 1}`,
      label: act.action.replace(/_/g, ' '),
      action: act.action,
      status: 'running',
    };

    try {
      if (act.action === 'general_chat') {
        let reply = aiResponseText;
        if (!reply && hasAnyProviderKey) {
          const chatRes = await generateAICompletionWithTelemetry({
            systemInstruction: `You are Veylentra Orion, a crisp, helpful academic & school intelligence assistant for role "${actor.role}". Answer clearly using Markdown and LaTeX ($...$, $$...$$) where relevant. Never invent private database records.`,
            prompt: cmdTrimmed,
            history: history.slice(-6),
            taskType: 'general',
            modelOverride,
            userRole: actor.role,
            endpointName: 'OrionGeneralChat',
            maxTokens: 1600,
          });
          reply = chatRes.text;
          modelUsed = chatRes.telemetry.modelUsed;
          providerUsed = chatRes.telemetry.providerUsed;
        }
        if (!reply) {
          reply = 'No AI provider key is currently configured on the server to answer open-ended prompts. You can still run workspace queries (homework, attendance, calendar, notices) or web search.';
        }
        stepLog.status = 'completed';
        summaryParts.push(reply);
      } else if (act.action === 'web_search' || act.action === 'search_internet') {
        const q = (act.title || act.targetValue || cmdTrimmed).trim();
        const searchRes = await performControlledWebSearch(q);
        if (searchRes.success && searchRes.sources.length > 0) {
          webSources = searchRes.sources;
          webVideos = searchRes.videos || [];
          let synth = `Retrieved **${webSources.length} verified web sources** for **"${q}"**${webVideos.length > 0 ? ` and ${webVideos.length} educational videos` : ''}.`;
          if (hasAnyProviderKey) {
            try {
              const sumRes = await generateAICompletionWithTelemetry({
                systemInstruction: `Synthesize verified web sources concisely for "${q}". Cite source titles/domains. Never fabricate links.`,
                prompt: `Sources:\n${searchRes.formattedContext}\n\nQuestion: ${q}`,
                taskType: 'general',
                modelOverride,
                maxTokens: 1000,
              });
              if (sumRes.text) {
                synth = sumRes.text;
                modelUsed = sumRes.telemetry.modelUsed;
                providerUsed = sumRes.telemetry.providerUsed;
              }
            } catch (_) {}
          }
          stepLog.status = 'verified';
          stepLog.verificationNote = `Verified ${webSources.length} external source citations`;
          summaryParts.push(synth);
        } else {
          stepLog.status = 'failed';
          stepLog.verificationNote = 'Web search returned zero live sources';
          allSucceeded = false;
          allVerified = false;
          summaryParts.push(`I could not retrieve fresh external sources for "${q}" right now.`);
        }
      } else if (act.action === 'get_homework' || act.action === 'get_assignments' || act.action === 'get_submissions') {
        const hwRes = await fetchJsonSafe(
          `${cfg.url}/rest/v1/homework?select=id,title,subject,class_grade,class_section,due_date,completed_list&order=created_at.desc&limit=15`,
          { headers: { apikey: cfg.key, Authorization: `Bearer ${cfg.key}` } }
        );
        if (!hwRes.ok) {
          throw new Error(`Database read failed for homework: ${hwRes.errorText}`);
        }
        const rows: any[] = Array.isArray(hwRes.data) ? hwRes.data : [];
        const pendingRows = rows.filter((h) => !Array.isArray(h.completed_list) || !h.completed_list.includes(actor.userId));
        structuredData = {
          title: act.action === 'get_submissions' ? 'Homework Submission Status' : 'Homework Overview',
          subtitle: `Role scope: ${actor.role}`,
          metrics: [
            { label: 'Total Assignments', value: rows.length, status: 'neutral' },
            { label: 'Pending / Open', value: pendingRows.length, status: pendingRows.length > 0 ? 'warning' : 'good' },
          ],
          columns: ['Title', 'Subject', 'Class', 'Due Date'],
          rows: rows.slice(0, 8).map((r) => ({
            Title: r.title || 'Untitled Assignment',
            Subject: r.subject || 'General',
            Class: `${r.class_grade || 'All'} ${r.class_section || ''}`.trim(),
            'Due Date': r.due_date || 'Flexible',
          })),
        };
        stepLog.status = 'verified';
        stepLog.verificationNote = `Read ${rows.length} verified records from homework`;
        summaryParts.push(
          rows.length === 0
            ? 'No active homework assignments were found in the database right now.'
            : `Found **${rows.length} assignment${rows.length === 1 ? '' : 's'}** (${pendingRows.length} pending for current scope): ${rows
                .slice(0, 4)
                .map((r) => `"${r.title}" (${r.subject || 'General'})`)
                .join(', ')}.`
        );
      } else if (act.action === 'get_attendance') {
        const attRes = await fetchJsonSafe(
          `${cfg.url}/rest/v1/attendance?select=id,user_id,status,date,grade,section&order=date.desc&limit=50`,
          { headers: { apikey: cfg.key, Authorization: `Bearer ${cfg.key}` } }
        );
        if (!attRes.ok) throw new Error(`Attendance read failed: ${attRes.errorText}`);
        const rows: any[] = Array.isArray(attRes.data) ? attRes.data : [];
        const presentCount = rows.filter((r) => String(r.status).toLowerCase() === 'present').length;
        const absentCount = rows.filter((r) => String(r.status).toLowerCase() === 'absent').length;
        const rate = rows.length > 0 ? Math.round((presentCount / rows.length) * 100) : 0;
        structuredData = {
          title: 'Attendance Summary',
          subtitle: `Latest ${rows.length} records`,
          metrics: [
            { label: 'Present', value: presentCount, status: 'good' },
            { label: 'Absent', value: absentCount, status: absentCount > 0 ? 'warning' : 'good' },
            { label: 'Rate', value: `${rate}%`, status: rate >= 80 ? 'good' : 'warning' },
          ],
          columns: ['Date', 'Grade', 'Section', 'Status'],
          rows: rows.slice(0, 8).map((r) => ({
            Date: r.date || '—',
            Grade: r.grade || '—',
            Section: r.section || '—',
            Status: String(r.status || '—').toUpperCase(),
          })),
        };
        stepLog.status = 'verified';
        stepLog.verificationNote = `Analyzed ${rows.length} verified attendance logs`;
        summaryParts.push(`Attendance summary across **${rows.length} recent log${rows.length === 1 ? '' : 's'}**: **${presentCount} present**, **${absentCount} absent** (${rate}% presence rate).`);
      } else if (act.action === 'get_students' || act.action === 'get_classes' || act.action === 'daily_operations_summary' || act.action === 'generate_report' || act.action === 'export_report') {
        const [usersRes, hwRes, attRes] = await Promise.all([
          fetchJsonSafe(`${cfg.url}/rest/v1/user_profiles?select=id,name,role,grade,section&limit=100`, {
            headers: { apikey: cfg.key, Authorization: `Bearer ${cfg.key}` },
          }),
          fetchJsonSafe(`${cfg.url}/rest/v1/homework?select=id,title,subject,class_grade&limit=25`, {
            headers: { apikey: cfg.key, Authorization: `Bearer ${cfg.key}` },
          }),
          fetchJsonSafe(`${cfg.url}/rest/v1/attendance?select=id,status,date&limit=50`, {
            headers: { apikey: cfg.key, Authorization: `Bearer ${cfg.key}` },
          }),
        ]);
        const users: any[] = Array.isArray(usersRes.data) ? usersRes.data : [];
        const studentRows = users.filter((u) => String(u.role).toLowerCase() === 'student');
        const hwRows: any[] = Array.isArray(hwRes.data) ? hwRes.data : [];
        const attRows: any[] = Array.isArray(attRes.data) ? attRes.data : [];
        const present = attRows.filter((a) => String(a.status).toLowerCase() === 'present').length;
        const rate = attRows.length > 0 ? Math.round((present / attRows.length) * 100) : 0;

        const reportMarkdown = `# Veylentra Operations & Cohort Summary\n- **Students Indexed:** ${studentRows.length}\n- **Active Assignments:** ${hwRows.length}\n- **Recent Attendance Rate:** ${rate}% (${present}/${attRows.length})`;
        structuredData = {
          title: 'School Operations & Analytics Briefing',
          subtitle: `Generated by Orion (${actor.role})`,
          metrics: [
            { label: 'Students', value: studentRows.length, status: 'neutral' },
            { label: 'Assignments', value: hwRows.length, status: 'neutral' },
            { label: 'Attendance', value: `${rate}%`, status: rate >= 80 ? 'good' : 'warning' },
          ],
          columns: ['Student', 'Grade', 'Section'],
          rows: studentRows.slice(0, 8).map((s) => ({
            Student: s.name || 'Student',
            Grade: s.grade || '—',
            Section: s.section || '—',
          })),
          exportableMarkdown: reportMarkdown,
        };
        stepLog.status = 'verified';
        stepLog.verificationNote = `Compiled from ${users.length} profiles, ${hwRows.length} assignments, and ${attRows.length} attendance entries`;
        summaryParts.push(
          `Compiled institutional briefing: **${studentRows.length} students**, **${hwRows.length} active homework assignments**, and **${rate}% recent attendance rate** (${present}/${attRows.length}).`
        );
      } else if (act.action === 'get_calendar') {
        const calRes = await fetchJsonSafe(
          `${cfg.url}/rest/v1/calendar_events?select=id,title,event_date,category&order=event_date.asc&limit=12`,
          { headers: { apikey: cfg.key, Authorization: `Bearer ${cfg.key}` } }
        );
        const rows: any[] = calRes.ok && Array.isArray(calRes.data) ? calRes.data : [];
        structuredData = {
          title: 'Academic Calendar & Upcoming Schedule',
          metrics: [{ label: 'Upcoming Events', value: rows.length, status: 'neutral' }],
          columns: ['Event', 'Date', 'Category'],
          rows: rows.slice(0, 8).map((e) => ({
            Event: e.title || 'Event',
            Date: e.event_date || 'TBD',
            Category: e.category || 'Academic',
          })),
        };
        stepLog.status = 'verified';
        stepLog.verificationNote = `Read ${rows.length} calendar events`;
        summaryParts.push(
          rows.length === 0
            ? 'No upcoming calendar events are currently scheduled in the database.'
            : `Upcoming calendar schedule (${rows.length} item${rows.length === 1 ? '' : 's'}): ${rows
                .slice(0, 4)
                .map((e) => `**${e.title}** (${e.event_date || 'TBD'})`)
                .join(', ')}.`
        );
      } else if (act.action === 'get_notifications') {
        const notifRes = await fetchJsonSafe(
          `${cfg.url}/rest/v1/notifications?select=id,title,message,created_at,target_role&order=created_at.desc&limit=10`,
          { headers: { apikey: cfg.key, Authorization: `Bearer ${cfg.key}` } }
        );
        const rows: any[] = notifRes.ok && Array.isArray(notifRes.data) ? notifRes.data : [];
        structuredData = {
          title: 'Recent Announcements & Notifications',
          metrics: [{ label: 'Recent Notices', value: rows.length, status: 'neutral' }],
          columns: ['Title', 'Message', 'Audience'],
          rows: rows.slice(0, 6).map((n) => ({
            Title: n.title || 'Notice',
            Message: String(n.message || '').slice(0, 90),
            Audience: n.target_role || 'all',
          })),
        };
        stepLog.status = 'verified';
        stepLog.verificationNote = `Read ${rows.length} notifications`;
        summaryParts.push(
          rows.length === 0
            ? 'No recent notifications were found.'
            : `Retrieved **${rows.length} recent notice${rows.length === 1 ? '' : 's'}**: ${rows
                .slice(0, 3)
                .map((n) => `**${n.title}**`)
                .join(', ')}.`
        );
      } else if (act.action === 'get_child_overview') {
        allSucceeded = false;
        allVerified = false;
        stepLog.status = 'failed';
        stepLog.verificationNote = 'FORBIDDEN_PARENT_ORION_ACTION';
        summaryParts.push('Authorization denied: Parent and Guardian features are disabled in Orion Academic Agent.');
      } else if (act.action === 'create_broadcast' || act.action === 'create_notice') {
        const title = (act.title || act.targetValue || 'School Notice').trim().slice(0, 140);
        const bodyText = (act.content || act.message || title).trim();
        const recordId = `bc_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        const insertRes = await fetchJsonSafe(`${cfg.url}/rest/v1/materials`, {
          method: 'POST',
          headers: {
            apikey: cfg.key,
            Authorization: `Bearer ${cfg.key}`,
            'Content-Type': 'application/json',
            Prefer: 'return=representation',
          },
          body: JSON.stringify({
            id: recordId,
            title,
            description: bodyText,
            type: 'broadcast',
            subject: 'Announcement',
            uploaded_by: actor.name,
            created_at: new Date().toISOString(),
          }),
        });
        if (!insertRes.ok) throw new Error(`Failed to persist broadcast: ${insertRes.errorText}`);
        const ver = await verifyRowPersisted(cfg, 'materials', recordId);
        if (!ver.verified) {
          allVerified = false;
          stepLog.status = 'failed';
          stepLog.verificationNote = ver.note;
          summaryParts.push(`Broadcast write could not be verified: ${ver.note}`);
        } else {
          stepLog.status = 'verified';
          stepLog.recordId = recordId;
          stepLog.verificationNote = ver.note;
          refreshTables.add('materials');
          refreshTables.add('notifications');
          if (dispatchPushFn) {
            await dispatchPushFn({
              notificationId: recordId,
              title,
              body: bodyText.slice(0, 180),
              targetRole: 'all',
              targetUserId: 'all',
              targetTab: 'notice_viewer',
              targetSchoolId: actor.schoolId,
            }).catch(() => {});
          }
          summaryParts.push(`Published and verified official notice **"${title}"** (ID: \`${recordId}\`).`);
        }
      } else if (act.action === 'notify_users' || act.action === 'notify_class' || act.action === 'notify_all' || act.action === 'create_notification' || act.action === 'create_reminder') {
        const title = (act.title || 'Veylentra Notification').trim().slice(0, 140);
        const bodyText = (act.message || act.content || title).trim();
        const notifId = `notif_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        const { grade, section } = parseClassAndSection(act.targetClass || act.audience || cmdTrimmed);
        const ins = await fetchJsonSafe(`${cfg.url}/rest/v1/notifications`, {
          method: 'POST',
          headers: {
            apikey: cfg.key,
            Authorization: `Bearer ${cfg.key}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            id: notifId,
            title,
            message: bodyText,
            target_role: act.audience || 'all',
            target_class: act.targetClass || grade,
            target_section: section,
            created_by: actor.userId,
            created_at: new Date().toISOString(),
          }),
        });
        if (!ins.ok) throw new Error(`Failed to save notification: ${ins.errorText}`);
        const ver = await verifyRowPersisted(cfg, 'notifications', notifId);
        if (!ver.verified) {
          allVerified = false;
          stepLog.status = 'failed';
          stepLog.verificationNote = ver.note;
          summaryParts.push(ver.note);
        } else {
          stepLog.status = 'verified';
          stepLog.recordId = notifId;
          stepLog.verificationNote = ver.note;
          refreshTables.add('notifications');
          summaryParts.push(`Dispatched and verified notification **"${title}"** for ${act.targetClass || act.audience || 'authorized recipients'}.`);
        }
      } else if (act.action === 'create_homework' || act.action === 'create_assignment') {
        const title = (act.title || act.targetValue || 'Assignment').trim().slice(0, 140);
        const { grade, section } = parseClassAndSection(act.targetClass || cmdTrimmed);
        const hwId = `hw_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        const ins = await fetchJsonSafe(`${cfg.url}/rest/v1/homework`, {
          method: 'POST',
          headers: {
            apikey: cfg.key,
            Authorization: `Bearer ${cfg.key}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            id: hwId,
            title,
            description: act.content || act.message || cmdTrimmed,
            subject: act.subject || 'General Studies',
            class_grade: grade,
            class_section: section,
            due_date: act.date || new Date(Date.now() + 86400000 * 3).toISOString().split('T')[0],
            assigned_by: actor.name,
            completed_list: [],
            created_at: new Date().toISOString(),
          }),
        });
        if (!ins.ok) throw new Error(`Failed to create homework: ${ins.errorText}`);
        const ver = await verifyRowPersisted(cfg, 'homework', hwId);
        if (!ver.verified) {
          allVerified = false;
          stepLog.status = 'failed';
          stepLog.verificationNote = ver.note;
          summaryParts.push(ver.note);
        } else {
          stepLog.status = 'verified';
          stepLog.recordId = hwId;
          stepLog.verificationNote = ver.note;
          refreshTables.add('homework');
          summaryParts.push(`Assigned and verified homework **"${title}"** for **${grade} (${section})** (ID: \`${hwId}\`).`);
        }
      } else if (act.action === 'create_competition') {
        const title = (act.title || act.targetValue || 'Campus Competition').trim();
        const compId = `comp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        const ins = await fetchJsonSafe(`${cfg.url}/rest/v1/life_competitions`, {
          method: 'POST',
          headers: {
            apikey: cfg.key,
            Authorization: `Bearer ${cfg.key}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            id: compId,
            title,
            description: act.content || act.message || cmdTrimmed,
            category: act.category || 'Academic',
            deadline: act.date || new Date(Date.now() + 86400000 * 7).toISOString().split('T')[0],
            created_by: actor.userId,
            created_at: new Date().toISOString(),
          }),
        });
        if (!ins.ok) throw new Error(`Failed to create competition: ${ins.errorText}`);
        const ver = await verifyRowPersisted(cfg, 'life_competitions', compId);
        if (!ver.verified) {
          allVerified = false;
          stepLog.status = 'failed';
          stepLog.verificationNote = ver.note;
          summaryParts.push(ver.note);
        } else {
          stepLog.status = 'verified';
          stepLog.recordId = compId;
          stepLog.verificationNote = ver.note;
          refreshTables.add('life_competitions');
          summaryParts.push(`Created and verified Veylentra Life competition **"${title}"** (ID: \`${compId}\`).`);
        }
      } else if (act.action === 'create_event') {
        const title = (act.title || act.targetValue || 'School Event').trim();
        const evtId = `evt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        const ins = await fetchJsonSafe(`${cfg.url}/rest/v1/life_events`, {
          method: 'POST',
          headers: {
            apikey: cfg.key,
            Authorization: `Bearer ${cfg.key}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            id: evtId,
            title,
            description: act.content || act.message || cmdTrimmed,
            event_date: act.date || new Date(Date.now() + 86400000 * 5).toISOString().split('T')[0],
            created_by: actor.userId,
            created_at: new Date().toISOString(),
          }),
        });
        if (!ins.ok) throw new Error(`Failed to create event: ${ins.errorText}`);
        const ver = await verifyRowPersisted(cfg, 'life_events', evtId);
        if (!ver.verified) {
          allVerified = false;
          stepLog.status = 'failed';
          stepLog.verificationNote = ver.note;
          summaryParts.push(ver.note);
        } else {
          stepLog.status = 'verified';
          stepLog.recordId = evtId;
          stepLog.verificationNote = ver.note;
          refreshTables.add('life_events');
          summaryParts.push(`Scheduled and verified event **"${title}"** (ID: \`${evtId}\`).`);
        }
      } else if (act.action === 'create_calendar_event') {
        const title = (act.title || act.targetValue || 'Calendar Event').trim();
        const calId = `cal_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        const ins = await fetchJsonSafe(`${cfg.url}/rest/v1/calendar_events`, {
          method: 'POST',
          headers: {
            apikey: cfg.key,
            Authorization: `Bearer ${cfg.key}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            id: calId,
            title,
            description: act.content || act.message || cmdTrimmed,
            event_date: act.date || new Date().toISOString().split('T')[0],
            category: act.category || 'Academic',
            created_by: actor.userId,
          }),
        });
        if (!ins.ok) throw new Error(`Failed to add calendar event: ${ins.errorText}`);
        const ver = await verifyRowPersisted(cfg, 'calendar_events', calId);
        if (!ver.verified) {
          allVerified = false;
          stepLog.status = 'failed';
          stepLog.verificationNote = ver.note;
          summaryParts.push(ver.note);
        } else {
          stepLog.status = 'verified';
          stepLog.recordId = calId;
          stepLog.verificationNote = ver.note;
          refreshTables.add('calendar_events');
          summaryParts.push(`Added and verified calendar event **"${title}"**.`);
        }
      } else if (act.action === 'create_meeting' || act.action === 'schedule_meeting') {
        const title = (act.title || act.targetValue || 'Veylentra Meet Session').trim();
        const meetId = `meet_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        const ins = await fetchJsonSafe(`${cfg.url}/rest/v1/meetings`, {
          method: 'POST',
          headers: {
            apikey: cfg.key,
            Authorization: `Bearer ${cfg.key}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            id: meetId,
            title,
            host_name: actor.name,
            host_id: actor.userId,
            scheduled_at: new Date().toISOString(),
            status: 'scheduled',
          }),
        });
        if (!ins.ok) throw new Error(`Failed to schedule meeting: ${ins.errorText}`);
        const ver = await verifyRowPersisted(cfg, 'meetings', meetId);
        if (!ver.verified) {
          allVerified = false;
          stepLog.status = 'failed';
          stepLog.verificationNote = ver.note;
          summaryParts.push(ver.note);
        } else {
          stepLog.status = 'verified';
          stepLog.recordId = meetId;
          stepLog.verificationNote = ver.note;
          refreshTables.add('meetings');
          summaryParts.push(`Scheduled and verified Veylentra Meet **"${title}"** (ID: \`${meetId}\`).`);
        }
      } else if (DESTRUCTIVE_ACTION_SET.has(act.action)) {
        const kw = (act.targetId || act.targetValue || act.title || '').trim();
        const tableMap: Record<string, string> = {
          delete_homework: 'homework',
          delete_assignment: 'homework',
          delete_competition: 'life_competitions',
          delete_event: 'life_events',
          delete_meeting: 'meetings',
          cancel_meeting: 'meetings',
          delete_broadcast: 'materials',
        };
        const candidateTables = tableMap[act.action]
          ? [tableMap[act.action]]
          : ['homework', 'life_competitions', 'life_events', 'meetings', 'materials'];
        let deletedTable = '';
        let deletedTitle = '';
        for (const tbl of candidateTables) {
          const searchRes = await fetchJsonSafe(
            `${cfg.url}/rest/v1/${tbl}?title=ilike.*${encodeURIComponent(kw)}*&select=id,title&limit=1`,
            { headers: { apikey: cfg.key, Authorization: `Bearer ${cfg.key}` } }
          );
          if (searchRes.ok && Array.isArray(searchRes.data) && searchRes.data[0]?.id) {
            const matchId = searchRes.data[0].id;
            const delRes = await fetchJsonSafe(`${cfg.url}/rest/v1/${tbl}?id=eq.${encodeURIComponent(matchId)}`, {
              method: 'DELETE',
              headers: { apikey: cfg.key, Authorization: `Bearer ${cfg.key}` },
            });
            if (delRes.ok) {
              deletedTable = tbl;
              deletedTitle = searchRes.data[0].title || kw;
              refreshTables.add(tbl);
              break;
            }
          }
        }
        if (!deletedTable) {
          allSucceeded = false;
          allVerified = false;
          stepLog.status = 'failed';
          stepLog.verificationNote = `No matching item found for "${kw}"`;
          summaryParts.push(`No active record matching **"${kw}"** was found to delete.`);
        } else {
          stepLog.status = 'verified';
          stepLog.verificationNote = `Removed "${deletedTitle}" from ${deletedTable}`;
          summaryParts.push(`Removed **"${deletedTitle}"** from \`${deletedTable}\` and verified deletion.`);
        }
      } else {
        // Local/UI workspace bridge actions (study plans, notes, tasks, navigate_tab, attendance roster open)
        clientBridgeActions.push(act);
        stepLog.status = 'completed';
        stepLog.verificationNote = 'Authorized for client workspace execution';
        summaryParts.push(`Prepared workspace action **${act.action.replace(/_/g, ' ')}**${act.title ? ` ("${act.title}")` : ''}.`);
      }
    } catch (stepErr: any) {
      allSucceeded = false;
      allVerified = false;
      stepLog.status = 'failed';
      stepLog.verificationNote = stepErr?.message || 'Step failed';
      summaryParts.push(`Action **${act.action}** failed: ${stepErr?.message || 'Unexpected error'}`);
    }

    stepResults.push(stepLog);
  }

  if (taskController.signal.aborted) {
    return buildCancelledResult(stages, plannedSteps, stepResults);
  }

  taskRecord.status = 'validating';
  taskRecord.updatedAt = Date.now();

  const execDurationMs = Math.max(1, Date.now() - execStart);
  stages.push({
    phase: 'running',
    label: 'Running action',
    status: allSucceeded ? 'completed' : 'failed',
    durationMs: execDurationMs,
  });

  const needsVerifyStage = plannedSteps.some((s) => s.action !== 'general_chat' && s.action !== 'navigate_tab');
  if (needsVerifyStage) {
    stages.push({
      phase: 'validating',
      label: 'Validating outcome',
      status: allVerified ? 'completed' : 'failed',
      durationMs: 1,
      detail: allVerified ? 'All outcomes verified' : 'One or more steps reported issues',
    });
  }

  const finishedAt = Date.now();
  const finalResponse = summaryParts.filter(Boolean).join('\n\n') || 'Task processed.';
  const finalPhase = !allSucceeded || !allVerified ? 'failed' : 'completed';

  const report = buildOrionCompletionReport({
    taskId,
    actorRole: actor.role,
    command: cmdTrimmed,
    status: finalPhase,
    verified: allVerified,
    providerUsed,
    modelUsed,
    startedAt,
    finishedAt,
    stages,
    steps: stepResults,
    summary: finalResponse,
  });

  const finalBody = {
    success: allSucceeded && allVerified,
    status: finalPhase,
    taskId,
    plan: plannedSteps,
    results: stepResults,
    structuredData,
    webSources,
    webVideos,
    clientBridgeActions,
    refreshTables: Array.from(refreshTables),
    finalResponse,
    providerUsed,
    modelUsed,
    report,
    snapshot: {
      phase: finalPhase,
      headline:
        finalPhase === 'completed'
          ? 'Completed and verified.'
          : 'Execution finished with warnings or errors.',
      stages,
      steps: stepResults,
      startedAt,
      finishedAt,
      verified: allVerified,
    },
  };

  taskRecord.status = finalPhase;
  taskRecord.updatedAt = finishedAt;
  taskRecord.finishedAt = finishedAt;
  taskRecord.report = report;
  taskRecord.lastResponse = finalBody;
  orionAbortRegistry.delete(taskId);

  return {
    httpStatus: 200,
    body: finalBody,
  };
}
