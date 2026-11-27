/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Authoritative Server-Side Orion Agent Service
 * - Strict RBAC verification against verified user identity (never trusts client-spoofed roles)
 * - Multi-stage pipeline: Analyze -> Clarify -> Plan -> Permission Check -> Confirm Gate -> Execute -> Read-Back Verify -> Synthesize
 * - Zero database or disk persistence of Orion chat history (strictly ephemeral)
 */

import {
  generateAICompletionWithTelemetry,
  getGroqApiKey,
  getMinistralApiKey,
  getZaiApiKey,
} from './aiClient.js';
import { performControlledWebSearch } from './webSearchEngine.js';
import {
  buildErrorEnvelope,
  normalizePublicErrorMessage,
  resolveVerifiedActor,
} from './sessionAuth.js';

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

const ORION_IDEMPOTENCY_TTL_MS = 15 * 60 * 1000;
const orionIdempotencyCache = new Map<string, { timestamp: number; response: { httpStatus: number; body: Record<string, any> } }>();
const orionInFlightExecutions = new Map<string, Promise<{ httpStatus: number; body: Record<string, any> }>>();

function pruneOrionIdempotencyCache() {
  const now = Date.now();
  for (const [k, entry] of orionIdempotencyCache.entries()) {
    if (now - entry.timestamp > ORION_IDEMPOTENCY_TTL_MS) {
      orionIdempotencyCache.delete(k);
    }
  }
  while (orionIdempotencyCache.size > 500) {
    const oldest = orionIdempotencyCache.keys().next().value;
    if (!oldest) break;
    orionIdempotencyCache.delete(oldest);
  }
}

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

const PARENT_ALLOWED = new Set<OrionServerActionType>([
  'get_child_overview',
  'get_notifications',
  'get_calendar',
  'navigate_tab',
  'general_chat',
  'add_study_planner',
  'create_study_plan',
  'create_note',
  'add_task',
  'complete_task',
  'delete_task',
  'web_search',
  'search_internet',
]);

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
  const isAdmin = normRole === 'super_admin' || normRole === 'admin';
  const isCoordinator = normRole === 'coordinator' || normRole === 'hod' || isAdmin;
  const isStaff =
    normRole === 'teacher' ||
    normRole === 'faculty' ||
    normRole === 'head_teacher' ||
    isCoordinator ||
    isAdmin;

  if (normRole === 'parent' || normRole === 'guardian') {
    if (PARENT_ALLOWED.has(action)) return { allowed: true };
    return {
      allowed: false,
      reason: `Authorization denied: Parent accounts cannot run "${action}". Parent accounts can inspect their verified linked ward overview, notices, calendar, and study tools.`,
    };
  }

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

/**
 * Resolves the authoritative actor strictly from a verified Supabase Bearer JWT
 * or an expiring HMAC-signed server session token (`vlt_sess.`).
 * NEVER trusts client body `userRole` or bare `x-veylentra-uid`/`x-veylentra-role`.
 */
export async function resolveVerifiedOrionActor(
  reqOrHeaders: any,
  cfg: SupabaseCfg
): Promise<
  | { ok: true; actor: VerifiedOrionActor; status?: never; error?: never }
  | { ok: false; actor?: never; status: number; error: string }
> {
  const headers =
    reqOrHeaders?.headers && typeof reqOrHeaders.headers === 'object'
      ? reqOrHeaders.headers
      : reqOrHeaders && typeof reqOrHeaders === 'object'
        ? reqOrHeaders
        : {};

  const resolved = await resolveVerifiedActor({ headers, cfg });
  if (!resolved.ok) {
    return {
      ok: false,
      status: resolved.status,
      error: resolved.error,
    };
  }

  return {
    ok: true,
    actor: {
      userId: resolved.actor.userId,
      email: resolved.actor.email,
      name: resolved.actor.name,
      role: resolved.actor.role,
      grade: resolved.actor.grade,
      section: resolved.actor.section,
      schoolId: resolved.actor.schoolId,
      authenticated: true,
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
  if ((commandLower.includes('homework') || commandLower.includes('assignment')) && /\b(create|assign|publish|give|add|dispatch|send|issue|post)\b/.test(commandLower)) {
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
      .replace(/^(create|assign|add|publish|dispatch|send|issue|post)\s+(a\s+|an\s+|the\s+)?(new\s+)?(homework|assignment)\s*(for|to|on|about)?\s*/i, '')
      .replace(/\b(for\s+)?(class|grade|standard|std)\s+\d+[a-z]*(?:\s+(?:astra|solara|elara|vega|ruby|emerald|sapphire|topaz|section\s+[a-z0-9]+))?/gi, '')
      .replace(/\bsubject\s*[-:]\s*[a-zA-Z &]+[:,;]?\s*/gi, '')
      .trim();
    const hasTopic =
      (cleanTitle && !genericWords.test(cleanTitle) && !genericPhrase.test(cleanTitle)) ||
      (stripped.length >= 3 && !genericWords.test(stripped) && !genericPhrase.test(cmdClean));

    const { hasExplicitGrade } = parseClassAndSection(act.targetClass || cmdClean);

    if (!hasTopic || !hasExplicitGrade) {
      const missing: string[] = [];
      if (!hasTopic) missing.push('assignment topic/title');
      if (!hasExplicitGrade) missing.push('target class / cohort');
      return {
        valid: false,
        missingFields: missing,
        clarificationQuestion: !hasTopic
          ? 'Please specify the homework title or topic and target class (e.g., "Assign Algebra Worksheet to Class 10 Astra due Friday").'
          : 'Which class or cohort should this homework be assigned to (e.g., "Class 10 Astra" or "Grade 9 Solara")?',
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

export function parseClassAndSection(input?: string): {
  grade: string;
  section: string;
  hasExplicitGrade: boolean;
  hasExplicitSection: boolean;
} {
  const str = (input || '').trim();
  if (!str) {
    return { grade: '', section: 'All Sections', hasExplicitGrade: false, hasExplicitSection: false };
  }

  // Match class/grade tokens: "Class 10 Astra", "Grade 10", "10th Astra", "Standard 10", "10 Astra"
  const gradeMatch =
    str.match(/\b(?:class|grade|standard|std)?\s*(\d{1,2})(?:st|nd|rd|th)?\b/i) ||
    str.match(/\b(\d{1,2})(?:st|nd|rd|th)?\s+(?:grade|class|standard|astra|solara|elara|vega|ruby|emerald|sapphire|topaz)\b/i);

  const explicitGrade = gradeMatch && gradeMatch[1] ? `Grade ${gradeMatch[1]}` : '';

  // Match sections: Astra, Solara, Elara, Vega, Ruby, Emerald, Sapphire, Topaz, or Section A/B/C/D
  const secMatch = str.match(/\b(astra|solara|elara|vega|ruby|emerald|sapphire|topaz)\b/i);
  const secLetterMatch = str.match(/\bsection\s+([a-z0-9]+)\b/i);

  let section = 'All Sections';
  let hasExplicitSection = false;

  if (secMatch) {
    section = secMatch[1].charAt(0).toUpperCase() + secMatch[1].slice(1).toLowerCase();
    hasExplicitSection = true;
  } else if (secLetterMatch) {
    section = secLetterMatch[1].toUpperCase();
    hasExplicitSection = true;
  } else if (/\ball\s*(?:sections?|cohorts?)\b/i.test(str)) {
    section = 'All Sections';
    hasExplicitSection = true;
  }

  return {
    grade: explicitGrade,
    section,
    hasExplicitGrade: Boolean(explicitGrade),
    hasExplicitSection,
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

const SUBJECT_ALIASES: Record<string, string> = {
  math: 'Mathematics',
  maths: 'Mathematics',
  mathematics: 'Mathematics',
  sci: 'Science',
  science: 'Science',
  phys: 'Physics',
  physics: 'Physics',
  chem: 'Chemistry',
  chemistry: 'Chemistry',
  bio: 'Biology',
  biology: 'Biology',
  eng: 'English',
  english: 'English',
  cs: 'Computer Science',
  'comp sci': 'Computer Science',
  'computer science': 'Computer Science',
  sst: 'Social Studies',
  'social studies': 'Social Studies',
  hist: 'History',
  history: 'History',
  geo: 'Geography',
  geography: 'Geography',
  hindi: 'Hindi',
};

function normalizeSubjectName(raw?: string): string {
  const cleaned = String(raw || '').replace(/[:.,;-]+$/g, '').trim();
  if (!cleaned) return '';
  const alias = SUBJECT_ALIASES[cleaned.toLowerCase()];
  if (alias) return alias;
  return cleaned
    .split(/\s+/)
    .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : ''))
    .join(' ');
}

export function extractHomeworkDetails(command: string, existing?: OrionActionStep): {
  title: string;
  content: string;
  subject: string;
  targetClass: string;
  grade: string;
  section: string;
} {
  const cmd = String(command || '').trim();
  const parsedCohort = parseClassAndSection(existing?.targetClass || cmd);
  const grade = parsedCohort.grade;
  const section = parsedCohort.section;
  const targetClass =
    existing?.targetClass && parseClassAndSection(existing.targetClass).hasExplicitGrade
      ? existing.targetClass
      : [grade, section].filter(Boolean).join(' ').trim();

  // Extract explicit subject field e.g. "subject- Maths: ..." or "subject: Physics,"
  let parsedSubject = '';
  const subjMatch = cmd.match(/\bsubject\s*[-:]\s*([A-Za-z &]+?)(?=\s*[:;,\n]|\s+(?:complete|solve|read|write|do|prepare|submit|revise)\b|$)/i);
  if (subjMatch && subjMatch[1]) {
    parsedSubject = normalizeSubjectName(subjMatch[1]);
  }
  const existingSubj = existing?.subject ? normalizeSubjectName(existing.subject) : '';
  const subject = existingSubj || parsedSubject || 'General Studies';

  // Extract instructions after colon or after stripping command lead-ins
  let extractedContent = '';
  const colonIdx = cmd.indexOf(':');
  if (colonIdx !== -1 && colonIdx < cmd.length - 1) {
    extractedContent = cmd.slice(colonIdx + 1).trim();
  } else {
    extractedContent = cmd
      .replace(/^(create|assign|add|publish|dispatch|send|issue|post)\s+(a\s+|an\s+|the\s+)?(new\s+)?(homework|assignment)\s*(for|to|on|about)?\s*/i, '')
      .replace(/\b(for\s+)?(class|grade|standard|std)\s+\d{1,2}(?:st|nd|rd|th)?(?:\s+(?:astra|solara|elara|vega|ruby|emerald|sapphire|topaz|section\s+[a-z0-9]+))?\s*,?\s*/gi, '')
      .replace(/\bsubject\s*[-:]\s*[A-Za-z &]+[:,;]?\s*/gi, '')
      .replace(/^(on|about|regarding)\s+/i, '')
      .trim();
  }

  const rawExistingContent = existing?.content || existing?.message || '';
  const contentIsJustRawCommand = !rawExistingContent || rawExistingContent.trim() === cmd;
  const content = (!contentIsJustRawCommand ? rawExistingContent.trim() : extractedContent || cmd).trim();

  const rawExistingTitle = existing?.title || (existing?.targetValue && existing.targetValue !== cmd ? existing.targetValue : '') || '';
  const genericTitle = /^(homework|assignment|dispatch homework|create homework|assign homework)$/i.test(rawExistingTitle.trim());
  let title = rawExistingTitle && !genericTitle ? rawExistingTitle.trim() : '';

  if (!title) {
    const snippet = extractedContent || content;
    const capSnippet = snippet ? snippet.charAt(0).toUpperCase() + snippet.slice(1) : 'Assignment';
    title = subject && subject !== 'General Studies'
      ? `${subject}: ${capSnippet}`.slice(0, 120)
      : capSnippet.slice(0, 120);
  }

  return {
    title,
    content,
    subject,
    targetClass,
    grade,
    section,
  };
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
  idempotencyKey?: string;
  requestId?: string;
  dispatchPushFn?: (payload: any) => Promise<any>;
}): Promise<{ httpStatus: number; body: Record<string, any> }> {
  const requestId = params.requestId || `req_${Math.random().toString(36).slice(2, 10)}`;
  const idempotencyKey = typeof params.idempotencyKey === 'string' ? params.idempotencyKey.trim().slice(0, 128) : '';
  let idempCacheKey = '';
  let resolveInFlight: ((val: { httpStatus: number; body: Record<string, any> }) => void) | null = null;

  try {
  const { cfg, actor, command, actionPlan, confirmed = false, activeTab = 'dashboard', modelOverride, history = [], dispatchPushFn } = params;
  const startedAt = Date.now();

  if (!actor?.authenticated) {
    const reason = 'Authentication required: Please sign in to execute Orion actions.';
    return {
      httpStatus: 401,
      body: {
        ...buildErrorEnvelope({ code: 'UNAUTHORIZED', message: reason, requestId, statusText: 'unauthorized' }),
        finalResponse: reason,
      },
    };
  }

  const cmdTrimmed = String(command || '').trim();
  const cmdLower = cmdTrimmed.toLowerCase();

  if (!cmdTrimmed) {
    const reason = 'Command or instruction is required.';
    return {
      httpStatus: 400,
      body: {
        ...buildErrorEnvelope({ code: 'INVALID_REQUEST', message: reason, requestId, statusText: 'error' }),
        finalResponse: reason,
      },
    };
  }

  if (confirmed && idempotencyKey) {
    pruneOrionIdempotencyCache();
    idempCacheKey = `${actor.userId}::${idempotencyKey}`;
    const existingCompleted = orionIdempotencyCache.get(idempCacheKey);
    if (existingCompleted && Date.now() - existingCompleted.timestamp < ORION_IDEMPOTENCY_TTL_MS) {
      return {
        httpStatus: existingCompleted.response.httpStatus,
        body: {
          ...existingCompleted.response.body,
          idempotentReplay: true,
        },
      };
    }
    const existingFlight = orionInFlightExecutions.get(idempCacheKey);
    if (existingFlight) {
      const flightRes = await existingFlight;
      return {
        httpStatus: flightRes.httpStatus,
        body: {
          ...flightRes.body,
          idempotentReplay: true,
        },
      };
    }
    const flightPromise = new Promise<{ httpStatus: number; body: Record<string, any> }>((resolve) => {
      resolveInFlight = resolve;
    });
    orionInFlightExecutions.set(idempCacheKey, flightPromise);
  }

  // Stage 1: Analyze & Plan
  let plannedSteps: OrionActionStep[] = Array.isArray(actionPlan) && actionPlan.length > 0 ? actionPlan : [];
  let aiResponseText = '';
  let modelUsed = '';
  let providerUsed = '';
  let plannerAiError = '';
  const analyzeStart = Date.now();

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
        plannerAiError = String(planErr?.message || planErr || '').trim();
        console.warn('[ORION_SERVICE] Planner LLM notice:', plannerAiError);
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

  const analyzeDurationMs = Math.max(0, Date.now() - analyzeStart);
  const planStart = Date.now();
  // Enrich structured homework parameters cleanly before clarification/preview/execution
  plannedSteps = plannedSteps.map((step) => {
    if (step.action === 'create_homework' || step.action === 'create_assignment') {
      const extracted = extractHomeworkDetails(cmdTrimmed, step);
      return {
        ...step,
        title: extracted.title,
        content: extracted.content,
        message: extracted.content,
        subject: extracted.subject,
        targetClass: extracted.targetClass || step.targetClass,
      };
    }
    return step;
  });
  const planDurationMs = Math.max(0, Date.now() - planStart);

  const stages: any[] = [
    { phase: 'analyzing', label: 'Analyzing intent', status: 'completed', durationMs: analyzeDurationMs },
    { phase: 'planning', label: 'Planning steps', status: 'completed', durationMs: planDurationMs, detail: `${plannedSteps.length} step${plannedSteps.length > 1 ? 's' : ''}` },
  ];

  const prepStart = Date.now();
  // Stage 2: Missing Parameter Clarification Gate
  for (const step of plannedSteps) {
    const paramCheck = validateActionParametersServer(step, cmdTrimmed);
    if (!paramCheck.valid) {
      stages.push({
        phase: 'preparing',
        label: 'Checking prerequisites & details',
        status: 'failed',
        durationMs: Math.max(0, Date.now() - prepStart),
        detail: 'Missing required details',
      });
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
          requestId,
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
      stages.push({
        phase: 'preparing',
        label: 'Checking permissions & prerequisites',
        status: 'failed',
        durationMs: Math.max(0, Date.now() - prepStart),
        detail: reason,
      });
      return {
        httpStatus: 401,
        body: {
          ...buildErrorEnvelope({ code: 'UNAUTHORIZED', message: reason, requestId, statusText: 'unauthorized' }),
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
      stages.push({
        phase: 'preparing',
        label: 'Checking permissions & prerequisites',
        status: 'failed',
        durationMs: Math.max(0, Date.now() - prepStart),
        detail: perm.reason,
      });
      return {
        httpStatus: 403,
        body: {
          ...buildErrorEnvelope({
            code: 'FORBIDDEN',
            message: perm.reason || 'Authorization denied by server RBAC.',
            requestId,
            statusText: 'forbidden',
          }),
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
    durationMs: Math.max(0, Date.now() - prepStart),
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
      ...(primary.subject ? { Subject: primary.subject } : {}),
      ...(primary.date ? { Date: primary.date } : {}),
      ...(primary.time ? { Time: primary.time } : {}),
      Preview: primary.content || primary.message || cmdTrimmed,
    };
    const isDestructive = plannedSteps.some((s) => DESTRUCTIVE_ACTION_SET.has(s.action));
    const promptText = isDestructive
      ? `Confirm permanent removal of "${targetTitle}"? This database action cannot be undone.`
      : `Review the planned details for "${targetTitle}" and confirm to execute.`;

    stages.push({
      phase: 'executing',
      label: 'Executing action',
      status: 'completed',
      durationMs: 0,
      detail: 'Awaiting explicit confirmation',
    });

    return {
      httpStatus: 200,
      body: {
        success: true,
        status: 'awaiting_confirmation',
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
        requestId,
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
      },
    };
  }

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
          try {
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
          } catch (aiErr: any) {
            const reason = normalizePublicErrorMessage(
              aiErr?.message || plannerAiError,
              'AI provider (Ministral, Groq, Z.ai) failed to respond.'
            );
            stages.push({
              phase: 'executing',
              label: 'Executing action',
              status: 'failed',
              durationMs: Math.max(0, Date.now() - execStart),
              detail: reason,
            });
            return {
              httpStatus: 502,
              body: {
                ...buildErrorEnvelope({ code: 'AI_PROVIDER_ERROR', message: reason, requestId, statusText: 'failed' }),
                finalResponse: reason,
                providerUsed,
                modelUsed,
                plan: plannedSteps,
                results: [
                  ...stepResults,
                  { ...stepLog, status: 'failed', verificationNote: reason },
                ],
                snapshot: {
                  phase: 'failed',
                  headline: 'AI provider unavailable.',
                  stages,
                  steps: [
                    ...stepResults,
                    { ...stepLog, status: 'failed', verificationNote: reason },
                  ],
                  startedAt,
                  finishedAt: Date.now(),
                  verified: false,
                },
              },
            };
          }
        }
        if (!reply) {
          const reason = normalizePublicErrorMessage(
            plannerAiError,
            'No AI provider API key (Ministral, Groq, or Z.ai) is currently configured on the server.'
          );
          return {
            httpStatus: 502,
            body: {
              ...buildErrorEnvelope({ code: 'AI_PROVIDER_UNCONFIGURED', message: reason, requestId, statusText: 'failed' }),
              finalResponse: reason,
              providerUsed,
              modelUsed,
              plan: plannedSteps,
              results: [
                ...stepResults,
                { ...stepLog, status: 'failed', verificationNote: reason },
              ],
            },
          };
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
        const linksRes = await fetchJsonSafe(
          `${cfg.url}/rest/v1/parent_student_links?parent_uid=eq.${encodeURIComponent(actor.userId)}&status=eq.verified&select=student_uid`,
          { headers: { apikey: cfg.key, Authorization: `Bearer ${cfg.key}` } }
        );
        const childIds = Array.isArray(linksRes.data)
          ? linksRes.data.map((r: any) => String(r.student_uid)).filter(Boolean)
          : [];
        if (childIds.length === 0) {
          stepLog.status = 'failed';
          stepLog.verificationNote = 'NO_LINKED_CHILDREN';
          allSucceeded = false;
          allVerified = false;
          summaryParts.push('No verified linked child was found on your Parent account. Please open Parental Portal to link your child via OTP verification first.');
        } else {
          const attRes = await fetchJsonSafe(
            `${cfg.url}/rest/v1/attendance?user_id=in.(${childIds.map(encodeURIComponent).join(',')})&select=user_id,status,date&order=date.desc&limit=20`,
            { headers: { apikey: cfg.key, Authorization: `Bearer ${cfg.key}` } }
          );
          const attRows: any[] = attRes.ok && Array.isArray(attRes.data) ? attRes.data : [];
          const presentCount = attRows.filter((a) => String(a.status).toLowerCase() === 'present').length;
          stepLog.status = 'verified';
          stepLog.verificationNote = `Verified data strictly for ${childIds.length} linked ward(s)`;
          summaryParts.push(`Verified overview for **${childIds.length} linked ward${childIds.length > 1 ? 's' : ''}**: ${presentCount}/${attRows.length} recent attendance days marked Present.`);
        }
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
        const hwDetails = extractHomeworkDetails(cmdTrimmed, act);
        const title = hwDetails.title.slice(0, 140);
        const { grade, section } = { grade: hwDetails.grade, section: hwDetails.section };
        const hwId = `hw_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        const effectiveDueDate = act.date || new Date(Date.now() + 86400000 * 3).toISOString().split('T')[0];
        const effectiveContent = hwDetails.content;
        const effectiveSubject = hwDetails.subject;
        const effectiveGivenBy = actor.name || 'Faculty';

        const fullHwPayload: Record<string, any> = {
          id: hwId,
          title,
          content: effectiveContent,
          subject: effectiveSubject,
          class_grade: grade,
          class_section: section,
          due_date: effectiveDueDate,
          given_by: effectiveGivenBy,
          teacher_id: actor.userId,
          status: 'published',
          completed_list: [],
          created_at: new Date().toISOString(),
        };

        let ins = await fetchJsonSafe(`${cfg.url}/rest/v1/homework`, {
          method: 'POST',
          headers: {
            apikey: cfg.key,
            Authorization: `Bearer ${cfg.key}`,
            'Content-Type': 'application/json',
            Prefer: 'return=representation',
          },
          body: JSON.stringify(fullHwPayload),
        });

        // Fallback for minimal column schema if optional columns (e.g. teacher_id, status) are rejected
        if (!ins.ok && (ins.status === 400 || (ins.errorText && /column|schema cache|PGRST204/i.test(ins.errorText)))) {
          const minimalHwPayload = {
            id: hwId,
            title,
            content: effectiveContent,
            subject: effectiveSubject,
            class_grade: grade,
            class_section: section,
            due_date: effectiveDueDate,
            given_by: effectiveGivenBy,
            completed_list: [],
            created_at: fullHwPayload.created_at,
          };
          ins = await fetchJsonSafe(`${cfg.url}/rest/v1/homework`, {
            method: 'POST',
            headers: {
              apikey: cfg.key,
              Authorization: `Bearer ${cfg.key}`,
              'Content-Type': 'application/json',
              Prefer: 'return=representation',
            },
            body: JSON.stringify(minimalHwPayload),
          });
        }

        if (!ins.ok) throw new Error(`Failed to create homework: ${ins.errorText}`);

        // Read-back verification 1: verify persisted row in homework
        const checkHw = await fetchJsonSafe(
          `${cfg.url}/rest/v1/homework?id=eq.${encodeURIComponent(hwId)}&select=id,title,class_grade,class_section`,
          { headers: { apikey: cfg.key, Authorization: `Bearer ${cfg.key}` } }
        );
        const persistedRows: any[] = Array.isArray(checkHw.data) ? checkHw.data : [];
        const persistedHw = persistedRows.find((r) => String(r?.id) === String(hwId));

        if (!checkHw.ok || !persistedHw) {
          allVerified = false;
          stepLog.status = 'failed';
          stepLog.verificationDetails = { homeworkVerified: false, notificationVerified: false };
          stepLog.verificationNote = `Read-back verification failed: homework ${hwId} not found in database.`;
          summaryParts.push(stepLog.verificationNote);
        } else {
          refreshTables.add('homework');

          // Notification insert & separate read-back verification in public.notifications
          const notifId = `notif_hw_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
          const notifTitle = `📝 New Assignment: ${title}`;
          const notifMsg = `${effectiveSubject} · Due ${effectiveDueDate} (${effectiveGivenBy})`;
          let notifInserted = false;
          let notifVerified = false;
          let notifNote = 'Notification insert failed.';

          try {
            const notifIns = await fetchJsonSafe(`${cfg.url}/rest/v1/notifications`, {
              method: 'POST',
              headers: {
                apikey: cfg.key,
                Authorization: `Bearer ${cfg.key}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                id: notifId,
                title: notifTitle,
                message: notifMsg,
                type: 'homework',
                target_role: 'student',
                target_class: grade,
                target_section: section === 'All Sections' ? 'all' : section,
                link_tab: 'homework',
                is_read: false,
                created_at: new Date().toISOString(),
              }),
            });
            notifInserted = notifIns.ok;
            if (notifInserted) {
              const verNotif = await verifyRowPersisted(cfg, 'notifications', notifId);
              notifVerified = verNotif.verified;
              notifNote = verNotif.note;
              if (notifVerified) refreshTables.add('notifications');
            } else {
              notifNote = `Notification write failed (${notifIns.errorText || `HTTP ${notifIns.status}`}).`;
            }
          } catch (notifErr: any) {
            notifNote = `Notification dispatch exception: ${notifErr?.message || 'unknown'}`;
          }

          if (!notifVerified) {
            allVerified = false;
          }

          stepLog.status = notifVerified ? 'verified' : 'failed';
          stepLog.recordId = hwId;
          stepLog.notificationId = notifInserted ? notifId : undefined;
          stepLog.verificationDetails = {
            homeworkVerified: true,
            notificationVerified: notifVerified,
          };
          stepLog.verificationNote =
            `Homework verified (${hwId}) for ${persistedHw.class_grade || grade} (${persistedHw.class_section || section}). ${notifNote}`;

          // Push delivery invocation with honest delivery reporting
          let deliveredDevices = 0;
          if (dispatchPushFn) {
            try {
              const pushRes = await dispatchPushFn({
                notificationId: notifId,
                title: notifTitle,
                body: notifMsg,
                targetRole: 'student',
                targetClass: grade,
                targetSection: section,
                targetTab: 'homework',
                schoolId: actor.schoolId,
              });
              if (pushRes && typeof pushRes.deliveredCount === 'number') {
                deliveredDevices = pushRes.deliveredCount;
              }
            } catch (_) {}
          }

          let summaryMsg = `Assigned and verified homework **"${title}"** for **${grade} (${section})** (ID: \`${hwId}\`).`;
          if (notifVerified) {
            summaryMsg += deliveredDevices > 0
              ? ` Classroom notification verified and delivered to ${deliveredDevices} device(s).`
              : ' Classroom notification verified in database.';
          } else {
            summaryMsg += ` Warning: homework saved, but notification could not be verified (${notifNote}).`;
          }
          summaryParts.push(summaryMsg);
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

  const execDurationMs = Math.max(0, Date.now() - execStart);
  stages.push({
    phase: 'executing',
    label: 'Executing action',
    status: allSucceeded ? 'completed' : 'failed',
    durationMs: execDurationMs,
  });

  const verifyStageStart = Date.now();
  const needsVerifyStage = plannedSteps.some((s) => s.action !== 'general_chat' && s.action !== 'navigate_tab');
  if (needsVerifyStage) {
    stages.push({
      phase: 'verifying',
      label: 'Verifying outcome',
      status: allVerified ? 'completed' : 'failed',
      durationMs: Math.max(0, Date.now() - verifyStageStart),
      detail: allVerified ? 'All outcomes verified' : 'One or more steps reported issues',
    });
  }

  const finalResponse = summaryParts.filter(Boolean).join('\n\n') || 'Task processed.';
  const finalPhase = !allSucceeded || !allVerified ? 'failed' : 'completed';

  const resultPayload = {
    httpStatus: 200,
    body: {
      success: allSucceeded && allVerified,
      status: finalPhase,
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
      requestId,
      snapshot: {
        phase: finalPhase,
        headline:
          finalPhase === 'completed'
            ? 'Completed and verified.'
            : 'Execution finished with warnings or errors.',
        stages,
        steps: stepResults,
        startedAt,
        finishedAt: Date.now(),
        verified: allVerified,
      },
    },
  };

  if (confirmed && idempCacheKey && resultPayload.body.success) {
    orionIdempotencyCache.set(idempCacheKey, { timestamp: Date.now(), response: resultPayload });
  }
  if (resolveInFlight) resolveInFlight(resultPayload);
  if (idempCacheKey) orionInFlightExecutions.delete(idempCacheKey);
  return resultPayload;
  } catch (err: any) {
    const reason = normalizePublicErrorMessage(err, 'Orion execution failed on server.');
    const errResult = {
      httpStatus: 502,
      body: {
        ...buildErrorEnvelope({ code: 'ORION_EXECUTION_ERROR', message: reason, requestId, statusText: 'failed' }),
        finalResponse: reason,
      },
    };
    if (resolveInFlight) resolveInFlight(errResult);
    if (idempCacheKey) orionInFlightExecutions.delete(idempCacheKey);
    return errResult;
  }
}
