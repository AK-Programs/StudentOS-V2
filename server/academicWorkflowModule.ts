/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Veylentra Connected Academic Workflow 2.0 — Authoritative Backend Module
 * Handles:
 * - Role & cohort-scoped Assignments + Submissions + Evaluations
 * - Assessments & Exams + Results Publication Gating
 * - Controlled Attendance Submission + Auditable Correction History
 * - Targeted Announcements + Per-user Read Tracking
 * - WebSocket / Realtime Event Scoping Helpers
 */

import express from 'express';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

export interface RequestActor {
  id: string;
  name: string;
  email?: string;
  role: string;
  grade?: string;
  section?: string;
  assignedGrades?: string[];
  assignedSections?: string[];
  assignedClasses?: string[];
  isVerifiedJwt: boolean;
}

export interface AcademicEventScope {
  targetUserId?: string;
  targetRole?: string;
  targetGrade?: string;
  targetSection?: string;
  sensitive?: boolean;
}

export function normalizeGrade(val?: string | null): string {
  const raw = String(val || '').trim().toLowerCase();
  if (!raw || raw === 'all' || raw === 'all grades') return 'all';
  const numMatch = raw.match(/\d+/);
  if (numMatch) return `grade ${numMatch[0]}`;
  return raw;
}

export function normalizeSection(val?: string | null): string {
  const raw = String(val || '').trim().toLowerCase();
  if (!raw || raw === 'all' || raw === 'all sections') return 'all';
  return raw;
}

export function isFacultyOrAdminRole(role?: string | null): boolean {
  const r = String(role || '').toLowerCase().trim();
  return ['teacher', 'coordinator', 'hod', 'admin', 'super_admin'].includes(r);
}

export function isStudentEligibleForCohort(
  studentGrade?: string | null,
  studentSection?: string | null,
  targetGrade?: string | null,
  targetSection?: string | null
): boolean {
  const tg = normalizeGrade(targetGrade);
  const sg = normalizeGrade(studentGrade);
  if (tg !== 'all' && sg && tg !== sg) return false;
  if (tg !== 'all' && !sg) return false;

  const ts = normalizeSection(targetSection);
  const ss = normalizeSection(studentSection);
  if (ts !== 'all' && ss && ts !== ss && !ss.includes(ts)) return false;
  if (ts !== 'all' && !ss) return false;

  return true;
}

export function isFacultyAuthorizedForScope(
  actor: Pick<RequestActor, 'role' | 'grade' | 'section' | 'assignedGrades' | 'assignedSections' | 'assignedClasses'>,
  targetGrade?: string | null,
  targetSection?: string | null
): boolean {
  const role = String(actor.role || '').toLowerCase().trim();
  if (role === 'admin' || role === 'super_admin') return true;
  if (!['teacher', 'coordinator', 'hod'].includes(role)) return false;

  const tg = normalizeGrade(targetGrade);
  const ts = normalizeSection(targetSection);

  // Extract allowed grades/sections
  const allowedGrades = new Set<string>();
  const allowedSections = new Set<string>();

  if (Array.isArray(actor.assignedClasses) && actor.assignedClasses.length > 0) {
    actor.assignedClasses.forEach(entry => {
      const parts = String(entry || '').split(/[_|]/).map(s => s.trim()).filter(Boolean);
      if (parts[0]) allowedGrades.add(normalizeGrade(parts[0]));
      if (parts[1]) allowedSections.add(normalizeSection(parts[1]));
    });
  }
  if (Array.isArray(actor.assignedGrades)) {
    actor.assignedGrades.forEach(g => {
      const ng = normalizeGrade(g);
      if (ng !== 'all') allowedGrades.add(ng);
    });
  }
  if (Array.isArray(actor.assignedSections)) {
    actor.assignedSections.forEach(s => {
      const ns = normalizeSection(s);
      if (ns !== 'all') allowedSections.add(ns);
    });
  }
  if (allowedGrades.size === 0 && actor.grade) {
    allowedGrades.add(normalizeGrade(actor.grade));
  }
  if (allowedSections.size === 0 && actor.section) {
    allowedSections.add(normalizeSection(actor.section));
  }

  // If faculty has explicit scope configured, verify target falls inside it
  if (tg !== 'all' && allowedGrades.size > 0 && !allowedGrades.has(tg)) {
    return false;
  }

  // Coordinators oversee all sections inside their assigned grades unless explicit sections are locked
  if (
    ts !== 'all' &&
    allowedSections.size > 0 &&
    !allowedSections.has(ts) &&
    !(role === 'coordinator' && (!actor.assignedSections || actor.assignedSections.length === 0))
  ) {
    return false;
  }

  return true;
}

export function isWsClientEligibleForAcademicEvent(
  socketUser: {
    authenticated?: boolean;
    role?: string;
    userId?: string;
    grade?: string;
    section?: string;
  },
  scope: AcademicEventScope
): boolean {
  const role = String(socketUser.role || 'student').toLowerCase();
  if (role === 'admin' || role === 'super_admin') return true;

  // Sensitive student-specific payloads (submission marks/feedback, personal attendance) must NEVER go to other students
  if (scope.sensitive && scope.targetUserId && scope.targetUserId !== 'all') {
    if (role === 'student' || role === 'parent') {
      return Boolean(socketUser.userId && socketUser.userId === scope.targetUserId);
    }
    return isFacultyOrAdminRole(role);
  }

  if (scope.targetUserId && scope.targetUserId !== 'all') {
    if (socketUser.userId && socketUser.userId === scope.targetUserId) return true;
    if (!isFacultyOrAdminRole(role)) return false;
  }

  if (scope.targetRole && scope.targetRole !== 'all') {
    if (scope.targetRole.toLowerCase() !== role && !isFacultyOrAdminRole(role)) {
      return false;
    }
  }

  if (role === 'student' || role === 'parent') {
    return isStudentEligibleForCohort(
      socketUser.grade,
      socketUser.section,
      scope.targetGrade,
      scope.targetSection
    );
  }

  return true;
}

export function isAnnouncementVisibleToUser(
  ann: any,
  user: { id?: string; role?: string; grade?: string; section?: string }
): boolean {
  const role = String(user.role || 'student').toLowerCase();
  const status = String(ann.status || 'published').toLowerCase();

  // Admins / faculty can manage drafts or archived if author/staff, students never see drafts or archived
  if (role === 'student' || role === 'parent') {
    if (status !== 'published') return false;
  } else if (status === 'draft' && ann.authorId && user.id && ann.authorId !== user.id && !['admin', 'super_admin', 'coordinator'].includes(role)) {
    return false;
  }

  const targetRole = String(ann.targetRole || ann.target_role || 'all').toLowerCase();
  if (targetRole !== 'all' && targetRole !== role) {
    // Let faculty see notices they created or faculty-targeted notices
    if (!(isFacultyOrAdminRole(role) && (ann.authorId === user.id || ['admin', 'super_admin'].includes(role)))) {
      return false;
    }
  }

  const targetGrade = ann.targetGrade || ann.target_grade || 'all';
  const targetSection = ann.targetSection || ann.target_section || 'all';
  if (role === 'student' || role === 'parent') {
    return isStudentEligibleForCohort(user.grade, user.section, targetGrade, targetSection);
  }

  return true;
}

// ============================================================================
// HYBRID STORE (Supabase Primary + Resilient Memory Mirror for Offline/Test)
// ============================================================================
interface AcademicStore {
  assignments: Map<string, any>;
  submissions: Map<string, any>; // key = `${assignmentId}::${studentId}`
  assessments: Map<string, any>;
  gradeEntries: Map<string, any>; // key = `${assessmentId}::${studentId}`
  attendance: Map<string, any>; // key = `${studentId}::${date}::${subject}`
  attendanceAuditLogs: any[];
  announcements: Map<string, any>;
  announcementReads: Map<string, Set<string>>; // announcementId -> Set<userId>
}

const memoryStore: AcademicStore = {
  assignments: new Map(),
  submissions: new Map(),
  assessments: new Map(),
  gradeEntries: new Map(),
  attendance: new Map(),
  attendanceAuditLogs: [],
  announcements: new Map(),
  announcementReads: new Map()
};

export function resetTestAcademicStore() {
  memoryStore.assignments.clear();
  memoryStore.submissions.clear();
  memoryStore.assessments.clear();
  memoryStore.gradeEntries.clear();
  memoryStore.attendance.clear();
  memoryStore.attendanceAuditLogs = [];
  memoryStore.announcements.clear();
  memoryStore.announcementReads.clear();
}

export interface AcademicRouteDependencies {
  getSupabaseServerConfig: () => { url: string; key: string | null };
  getVerifiedUserFromRequest: (req: express.Request) => Promise<{
    id: string;
    email?: string;
    role: string;
    user_metadata?: any;
  } | null>;
  emitScopedBroadcast?: (eventType: string, payload: any, scope: AcademicEventScope) => void;
}

export function registerAcademicWorkflowRoutes(
  app: express.Express,
  deps: AcademicRouteDependencies
) {
  const getSb = () => {
    const { url, key } = deps.getSupabaseServerConfig();
    if (!url || !key) return null;
    return createClient(url, key, { auth: { persistSession: false } });
  };

  async function resolveActor(req: express.Request): Promise<{ actor: RequestActor | null; errorStatus?: number; errorMsg?: string }> {
    const authHeader = req.headers.authorization || (req.headers['x-supabase-auth'] as string) || '';
    const hasBearer = Boolean(authHeader.replace(/^Bearer\s+/i, '').trim());
    const verified = await deps.getVerifiedUserFromRequest(req);

    if (hasBearer && !verified) {
      return { actor: null, errorStatus: 401, errorMsg: 'Invalid or expired authentication token.' };
    }

    const headerUid = String(req.headers['x-veylentra-uid'] || req.body?.actorId || req.body?.studentId || '').trim();
    const headerRole = String(req.headers['x-veylentra-role'] || '').trim().toLowerCase();
    const headerGrade = String(req.headers['x-veylentra-grade'] || '').trim();
    const headerSection = String(req.headers['x-veylentra-section'] || '').trim();
    const headerName = String(req.headers['x-veylentra-name'] || '').trim();

    let assignedGrades: string[] | undefined;
    let assignedSections: string[] | undefined;
    let assignedClasses: string[] | undefined;
    let dbRole: string | undefined;
    let dbGrade = headerGrade;
    let dbSection = headerSection;
    let dbName = headerName;

    const uid = verified?.id || headerUid;
    if (!uid && !headerRole) {
      return { actor: null, errorStatus: 401, errorMsg: 'Authentication context required.' };
    }

    // Look up authoritative profile in Supabase if available (non-blocking in test env)
    if (uid && process.env.NODE_ENV !== 'test') {
      try {
        const sb = getSb();
        if (sb) {
          const { data: prof } = await sb
            .from('user_profiles')
            .select('role, grade, section, name, raw_data')
            .or(`id.eq.${uid},uid.eq.${uid}`)
            .limit(1)
            .maybeSingle();
          if (prof) {
            if (prof.role) dbRole = String(prof.role).toLowerCase();
            if (prof.grade) dbGrade = prof.grade;
            if (prof.section) dbSection = prof.section;
            if (prof.name) dbName = prof.name;
            if (prof.raw_data) {
              assignedGrades = prof.raw_data.assignedGrades;
              assignedSections = prof.raw_data.assignedSections;
              assignedClasses = prof.raw_data.assignedClasses;
            }
          }
        }
      } catch (_) {}
    }

    // Parse optional JSON arrays in headers for assigned scope
    const parseArrHeader = (h: unknown): string[] | undefined => {
      if (typeof h !== 'string' || !h.trim()) return undefined;
      try {
        const parsed = JSON.parse(h);
        return Array.isArray(parsed) ? parsed.map(String) : undefined;
      } catch {
        return h.split(',').map(s => s.trim()).filter(Boolean);
      }
    };

    const resolvedRole = verified?.role || dbRole || headerRole || 'student';

    // Prevent role escalation when a non-faculty DB profile tries sending a faculty header
    if (dbRole && !isFacultyOrAdminRole(dbRole) && headerRole && isFacultyOrAdminRole(headerRole) && !verified) {
      return { actor: null, errorStatus: 403, errorMsg: 'Forbidden: role escalation is not permitted.' };
    }

    return {
      actor: {
        id: uid || 'anonymous',
        name: dbName || verified?.user_metadata?.name || verified?.email || 'Veylentra User',
        email: verified?.email || String(req.headers['x-veylentra-email'] || ''),
        role: resolvedRole,
        grade: dbGrade || verified?.user_metadata?.grade || '',
        section: dbSection || verified?.user_metadata?.section || '',
        assignedGrades: assignedGrades || parseArrHeader(req.headers['x-veylentra-assigned-grades']),
        assignedSections: assignedSections || parseArrHeader(req.headers['x-veylentra-assigned-sections']),
        assignedClasses: assignedClasses || parseArrHeader(req.headers['x-veylentra-assigned-classes']),
        isVerifiedJwt: Boolean(verified)
      }
    };
  }

  async function persistNotificationRecord(notif: {
    title: string;
    message: string;
    type: string;
    targetUserId?: string;
    targetRole?: string;
    targetClass?: string;
    targetSection?: string;
    linkTab?: string;
    dedupeKey?: string;
  }) {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    if (deps.emitScopedBroadcast) {
      deps.emitScopedBroadcast(
        'academic:notification',
        { id, ...notif, createdAt: now },
        {
          targetUserId: notif.targetUserId,
          targetRole: notif.targetRole,
          targetGrade: notif.targetClass,
          targetSection: notif.targetSection
        }
      );
    }

    if (process.env.NODE_ENV === 'test') return;
    try {
      const sb = getSb();
      if (!sb) return;
      await sb.from('notifications').upsert({
        id,
        title: notif.title,
        message: notif.message,
        content: notif.message,
        type: notif.type,
        target_user_id: notif.targetUserId || 'all',
        target_class: notif.targetClass || 'all',
        target_section: notif.targetSection || 'all',
        is_read: false,
        created_at: now,
        payload: {
          id,
          title: notif.title,
          message: notif.message,
          type: notif.type,
          targetUserId: notif.targetUserId || 'all',
          targetRole: notif.targetRole || 'all',
          targetClass: notif.targetClass || 'all',
          targetSection: notif.targetSection || 'all',
          linkTab: notif.linkTab || 'homework',
          dedupeKey: notif.dedupeKey || null,
          createdAt: now
        }
      });
    } catch (_) {}
  }

  // --------------------------------------------------------------------------
  // 1. ASSIGNMENTS & SUBMISSIONS LIFECYCLE
  // --------------------------------------------------------------------------

  // GET /api/academic/assignments
  app.get('/api/academic/assignments', async (req, res) => {
    const resolved = await resolveActor(req);
    if (!resolved.actor) return res.status(resolved.errorStatus || 401).json({ success: false, error: resolved.errorMsg });
    const actor = resolved.actor;

    try {
      let rows: any[] = [];
      if (process.env.NODE_ENV !== 'test') {
        const sb = getSb();
        if (sb) {
          const { data, error } = await sb.from('homework').select('*').order('created_at', { ascending: false });
          if (!error && Array.isArray(data)) {
            rows = data.map((item: any) => ({
              id: item.id,
              title: item.title,
              subject: item.subject,
              content: item.content,
              dueDate: item.due_date,
              classGrade: item.class_grade,
              classSection: item.class_section || 'All Sections',
              givenBy: item.given_by,
              teacherId: item.teacher_id || '',
              status: item.status || 'published',
              attachments: Array.isArray(item.attachments) ? item.attachments : [],
              submissionRequirements: item.submission_requirements || 'text_or_link',
              maxScore: Number(item.max_score || 100),
              allowLate: item.allow_late !== false,
              createdAt: item.created_at,
              updatedAt: item.updated_at,
              completedList: typeof item.completed_list === 'string'
                ? JSON.parse(item.completed_list || '[]')
                : (item.completed_list || [])
            }));
          }
        }
      }

      // Merge memory store items cleanly
      const map = new Map<string, any>();
      rows.forEach(r => map.set(r.id, r));
      memoryStore.assignments.forEach((v, k) => {
        if (!map.has(k)) map.set(k, v);
      });

      let list = Array.from(map.values());
      const role = actor.role.toLowerCase();
      if (role === 'student' || role === 'parent') {
        list = list.filter(hw =>
          (hw.status || 'published') === 'published' &&
          isStudentEligibleForCohort(actor.grade, actor.section, hw.classGrade, hw.classSection)
        );
      } else if (role === 'teacher' || role === 'coordinator' || role === 'hod') {
        list = list.filter(hw =>
          hw.teacherId === actor.id ||
          hw.givenBy === actor.name ||
          isFacultyAuthorizedForScope(actor, hw.classGrade, hw.classSection)
        );
      }

      // Attach submission summary
      const submissionsAll = await fetchAllSubmissionsFromStore();
      const enriched = list.map(hw => {
        const hwSubs = submissionsAll.filter(s => s.assignmentId === hw.id);
        if (role === 'student' || role === 'parent') {
          const mine = hwSubs.find(s => s.studentId === actor.id || (actor.email && s.studentEmail === actor.email)) || null;
          return {
            ...hw,
            mySubmission: mine
              ? {
                  ...mine,
                  score: mine.resultsReleased ? mine.score : null,
                  feedback: mine.resultsReleased ? mine.feedback : (mine.status === 'returned_for_revision' ? mine.feedback : '')
                }
              : null
          };
        }
        return {
          ...hw,
          stats: {
            submittedCount: hwSubs.length,
            lateCount: hwSubs.filter(s => s.isLate).length,
            evaluatedCount: hwSubs.filter(s => s.status === 'evaluated').length,
            pendingEvaluationCount: hwSubs.filter(s => s.status === 'submitted' || s.status === 'late' || s.status === 'under_evaluation').length
          }
        };
      });

      return res.json({ success: true, assignments: enriched });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err?.message || 'Failed to load assignments.' });
    }
  });

  async function fetchAllSubmissionsFromStore(assignmentId?: string): Promise<any[]> {
    const merged = new Map<string, any>();
    if (process.env.NODE_ENV !== 'test') {
      try {
        const sb = getSb();
        if (sb) {
          let q = sb.from('assignment_submissions').select('*');
          if (assignmentId) q = q.eq('assignment_id', assignmentId);
          const { data, error } = await q.order('submitted_at', { ascending: false });
          if (!error && Array.isArray(data)) {
            data.forEach((s: any) => {
              const key = `${s.assignment_id}::${s.student_id}`;
              merged.set(key, {
                id: s.id,
                assignmentId: s.assignment_id,
                studentId: s.student_id,
                studentName: s.student_name,
                studentEmail: s.student_email,
                classGrade: s.class_grade,
                classSection: s.class_section,
                status: s.status,
                submissionText: s.submission_text || '',
                attachmentUrl: s.attachment_url || '',
                attachmentName: s.attachment_name || '',
                isLate: Boolean(s.is_late),
                submittedAt: s.submitted_at,
                score: s.score,
                maxScore: s.max_score,
                feedback: s.feedback || '',
                evaluatedBy: s.evaluated_by,
                evaluatedAt: s.evaluated_at,
                resultsReleased: Boolean(s.results_released),
                updatedAt: s.updated_at
              });
            });
          }
        }
      } catch (_) {}
    }
    memoryStore.submissions.forEach((v, k) => {
      if (!assignmentId || v.assignmentId === assignmentId) {
        merged.set(k, v);
      }
    });
    return Array.from(merged.values());
  }

  // POST /api/academic/assignments (Faculty only)
  app.post('/api/academic/assignments', async (req, res) => {
    const resolved = await resolveActor(req);
    if (!resolved.actor) return res.status(resolved.errorStatus || 401).json({ success: false, error: resolved.errorMsg });
    const actor = resolved.actor;

    if (!isFacultyOrAdminRole(actor.role)) {
      return res.status(403).json({ success: false, error: 'Permission denied: only faculty can create assignments.' });
    }

    const body = req.body || {};
    const title = String(body.title || '').trim();
    const content = String(body.content || '').trim();
    const subject = String(body.subject || 'General').trim();
    const classGrade = String(body.classGrade || actor.grade || 'Grade 10').trim();
    const classSection = String(body.classSection || 'All Sections').trim();
    const dueDate = String(body.dueDate || new Date(Date.now() + 86400000 * 3).toISOString().split('T')[0]).trim();
    const status = ['draft', 'published', 'archived'].includes(body.status) ? body.status : 'published';
    const maxScore = Math.max(1, Number(body.maxScore || 100));

    if (!title || !content) {
      return res.status(400).json({ success: false, error: 'Assignment title and instructions are required.' });
    }

    if (!isFacultyAuthorizedForScope(actor, classGrade, classSection)) {
      return res.status(403).json({ success: false, error: `Scope denied: you are not authorized to assign work to ${classGrade} (${classSection}).` });
    }

    const now = new Date().toISOString();
    const assignment = {
      id: body.id || `hw-${Date.now()}-${crypto.randomBytes(2).toString('hex')}`,
      title,
      subject,
      content,
      dueDate,
      classGrade,
      classSection,
      givenBy: body.givenBy || actor.name || 'Faculty',
      teacherId: actor.id,
      status,
      attachments: Array.isArray(body.attachments) ? body.attachments : [],
      submissionRequirements: body.submissionRequirements || 'text_or_link',
      maxScore,
      allowLate: body.allowLate !== false,
      createdAt: body.createdAt || now,
      updatedAt: now,
      completedList: Array.isArray(body.completedList) ? body.completedList : []
    };

    memoryStore.assignments.set(assignment.id, assignment);

    if (process.env.NODE_ENV !== 'test') {
      const sb = getSb();
      if (sb) {
        const fullRow = {
          id: assignment.id,
          title: assignment.title,
          subject: assignment.subject,
          content: assignment.content,
          due_date: assignment.dueDate,
          class_grade: assignment.classGrade,
          class_section: assignment.classSection,
          given_by: assignment.givenBy,
          teacher_id: assignment.teacherId,
          status: assignment.status,
          attachments: assignment.attachments,
          submission_requirements: assignment.submissionRequirements,
          max_score: assignment.maxScore,
          allow_late: assignment.allowLate,
          completed_list: JSON.stringify(assignment.completedList),
          created_at: assignment.createdAt,
          updated_at: assignment.updatedAt
        };
        const { error } = await sb.from('homework').upsert(fullRow);
        if (error && (error.code === 'PGRST204' || error.message?.includes('column'))) {
          await sb.from('homework').upsert({
            id: assignment.id,
            title: assignment.title,
            subject: assignment.subject,
            content: assignment.content,
            due_date: assignment.dueDate,
            class_grade: assignment.classGrade,
            class_section: assignment.classSection,
            given_by: assignment.givenBy,
            completed_list: JSON.stringify(assignment.completedList),
            created_at: assignment.createdAt
          });
        } else if (error && error.code !== '42P01') {
          return res.status(500).json({ success: false, error: error.message });
        }
      }
    }

    if (assignment.status === 'published') {
      await persistNotificationRecord({
        title: `📝 Assignment Published: ${assignment.title}`,
        message: `${assignment.subject} · Due ${assignment.dueDate} (${assignment.givenBy})`,
        type: 'homework',
        targetRole: 'student',
        targetClass: assignment.classGrade,
        targetSection: assignment.classSection === 'All Sections' ? 'all' : assignment.classSection,
        linkTab: 'homework',
        dedupeKey: `hw_pub_${assignment.id}`
      });
      if (deps.emitScopedBroadcast) {
        deps.emitScopedBroadcast('homework:received', assignment, {
          targetRole: 'student',
          targetGrade: assignment.classGrade,
          targetSection: assignment.classSection
        });
      }
    }

    return res.status(201).json({ success: true, assignment });
  });

  // PATCH /api/academic/assignments/:id (Faculty edit/publish/archive)
  app.patch('/api/academic/assignments/:id', async (req, res) => {
    const resolved = await resolveActor(req);
    if (!resolved.actor) return res.status(resolved.errorStatus || 401).json({ success: false, error: resolved.errorMsg });
    const actor = resolved.actor;

    if (!isFacultyOrAdminRole(actor.role)) {
      return res.status(403).json({ success: false, error: 'Permission denied: only faculty can modify assignments.' });
    }

    const id = req.params.id;
    let existing = memoryStore.assignments.get(id);
    if (!existing && process.env.NODE_ENV !== 'test') {
      const sb = getSb();
      if (sb) {
        const { data } = await sb.from('homework').select('*').eq('id', id).maybeSingle();
        if (data) {
          existing = {
            id: data.id,
            title: data.title,
            subject: data.subject,
            content: data.content,
            dueDate: data.due_date,
            classGrade: data.class_grade,
            classSection: data.class_section,
            givenBy: data.given_by,
            teacherId: data.teacher_id,
            status: data.status || 'published',
            attachments: data.attachments || [],
            submissionRequirements: data.submission_requirements || 'text_or_link',
            maxScore: Number(data.max_score || 100),
            allowLate: data.allow_late !== false,
            createdAt: data.created_at,
            completedList: typeof data.completed_list === 'string' ? JSON.parse(data.completed_list || '[]') : (data.completed_list || [])
          };
        }
      }
    }
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Assignment not found.' });
    }

    if (!isFacultyAuthorizedForScope(actor, existing.classGrade, existing.classSection)) {
      return res.status(403).json({ success: false, error: 'Scope denied: cannot modify another cohort assignment.' });
    }

    const patch = req.body || {};
    const prevStatus = existing.status || 'published';
    const updated = {
      ...existing,
      ...(patch.title !== undefined ? { title: String(patch.title).trim() } : {}),
      ...(patch.subject !== undefined ? { subject: String(patch.subject).trim() } : {}),
      ...(patch.content !== undefined ? { content: String(patch.content).trim() } : {}),
      ...(patch.dueDate !== undefined ? { dueDate: String(patch.dueDate).trim() } : {}),
      ...(patch.classGrade !== undefined ? { classGrade: String(patch.classGrade).trim() } : {}),
      ...(patch.classSection !== undefined ? { classSection: String(patch.classSection).trim() } : {}),
      ...(patch.status !== undefined ? { status: patch.status } : {}),
      ...(patch.attachments !== undefined ? { attachments: patch.attachments } : {}),
      ...(patch.submissionRequirements !== undefined ? { submissionRequirements: patch.submissionRequirements } : {}),
      ...(patch.maxScore !== undefined ? { maxScore: Math.max(1, Number(patch.maxScore)) } : {}),
      ...(patch.allowLate !== undefined ? { allowLate: Boolean(patch.allowLate) } : {}),
      updatedAt: new Date().toISOString()
    };

    memoryStore.assignments.set(id, updated);

    if (process.env.NODE_ENV !== 'test') {
      const sb = getSb();
      if (sb) {
        const { error } = await sb.from('homework').update({
          title: updated.title,
          subject: updated.subject,
          content: updated.content,
          due_date: updated.dueDate,
          class_grade: updated.classGrade,
          class_section: updated.classSection,
          status: updated.status,
          attachments: updated.attachments,
          submission_requirements: updated.submissionRequirements,
          max_score: updated.maxScore,
          allow_late: updated.allowLate,
          updated_at: updated.updatedAt
        }).eq('id', id);
        if (error && (error.code === 'PGRST204' || error.message?.includes('column'))) {
          await sb.from('homework').update({
            title: updated.title,
            subject: updated.subject,
            content: updated.content,
            due_date: updated.dueDate,
            class_grade: updated.classGrade,
            class_section: updated.classSection
          }).eq('id', id);
        }
      }
    }

    if (prevStatus !== 'published' && updated.status === 'published') {
      await persistNotificationRecord({
        title: `📝 Assignment Published: ${updated.title}`,
        message: `${updated.subject} · Due ${updated.dueDate}`,
        type: 'homework',
        targetRole: 'student',
        targetClass: updated.classGrade,
        targetSection: updated.classSection === 'All Sections' ? 'all' : updated.classSection,
        linkTab: 'homework',
        dedupeKey: `hw_pub_${updated.id}`
      });
    }

    if (deps.emitScopedBroadcast) {
      deps.emitScopedBroadcast('homework:updated', updated, {
        targetGrade: updated.classGrade,
        targetSection: updated.classSection
      });
    }

    return res.json({ success: true, assignment: updated });
  });

  // GET /api/academic/assignments/:id/submissions
  app.get('/api/academic/assignments/:id/submissions', async (req, res) => {
    const resolved = await resolveActor(req);
    if (!resolved.actor) return res.status(resolved.errorStatus || 401).json({ success: false, error: resolved.errorMsg });
    const actor = resolved.actor;
    const assignmentId = req.params.id;

    const allSubs = await fetchAllSubmissionsFromStore(assignmentId);
    const role = actor.role.toLowerCase();

    if (role === 'student' || role === 'parent') {
      const own = allSubs.filter(s => s.studentId === actor.id || (actor.email && s.studentEmail === actor.email));
      return res.json({
        success: true,
        submissions: own.map(s => ({
          ...s,
          score: s.resultsReleased ? s.score : null,
          feedback: s.resultsReleased ? s.feedback : (s.status === 'returned_for_revision' ? s.feedback : '')
        }))
      });
    }

    const assignment = memoryStore.assignments.get(assignmentId);
    if (assignment && !isFacultyAuthorizedForScope(actor, assignment.classGrade, assignment.classSection)) {
      return res.status(403).json({ success: false, error: 'Scope denied: assignment belongs to another cohort.' });
    }

    return res.json({ success: true, submissions: allSubs });
  });

  // POST /api/academic/assignments/:id/submit (Student submission)
  app.post('/api/academic/assignments/:id/submit', async (req, res) => {
    const resolved = await resolveActor(req);
    if (!resolved.actor) return res.status(resolved.errorStatus || 401).json({ success: false, error: resolved.errorMsg });
    const actor = resolved.actor;

    if (actor.role.toLowerCase() !== 'student') {
      return res.status(403).json({ success: false, error: 'Only students can submit assignment work.' });
    }

    const assignmentId = req.params.id;
    let assignment = memoryStore.assignments.get(assignmentId);
    if (!assignment && process.env.NODE_ENV !== 'test') {
      const sb = getSb();
      if (sb) {
        const { data } = await sb.from('homework').select('*').eq('id', assignmentId).maybeSingle();
        if (data) {
          assignment = {
            id: data.id,
            title: data.title,
            subject: data.subject,
            dueDate: data.due_date,
            classGrade: data.class_grade,
            classSection: data.class_section,
            givenBy: data.given_by,
            teacherId: data.teacher_id,
            status: data.status || 'published',
            maxScore: Number(data.max_score || 100),
            allowLate: data.allow_late !== false,
            completedList: typeof data.completed_list === 'string' ? JSON.parse(data.completed_list || '[]') : (data.completed_list || [])
          };
        }
      }
    }

    if (!assignment) {
      return res.status(404).json({ success: false, error: 'Assignment not found.' });
    }
    if ((assignment.status || 'published') !== 'published') {
      return res.status(400).json({ success: false, error: 'This assignment is not currently accepting submissions.' });
    }
    if (!isStudentEligibleForCohort(actor.grade, actor.section, assignment.classGrade, assignment.classSection)) {
      return res.status(403).json({ success: false, error: 'Access denied: this assignment is targeted to a different class/section.' });
    }

    const { submissionText = '', attachmentUrl = '', attachmentName = '' } = req.body || {};
    if (!String(submissionText).trim() && !String(attachmentUrl).trim()) {
      return res.status(400).json({ success: false, error: 'Please include response notes or an attachment/link before submitting.' });
    }

    const existingSubs = await fetchAllSubmissionsFromStore(assignmentId);
    const prevSub = existingSubs.find(s => s.studentId === actor.id);
    if (prevSub && prevSub.status === 'evaluated') {
      return res.status(409).json({
        success: false,
        error: 'This submission has already been evaluated and cannot be overwritten unless returned for revision.'
      });
    }

    const now = new Date();
    let isLate = false;
    if (assignment.dueDate && /^\d{4}-\d{2}-\d{2}/.test(assignment.dueDate)) {
      const dueEnd = new Date(`${assignment.dueDate.slice(0, 10)}T23:59:59.999Z`);
      if (!Number.isNaN(dueEnd.getTime()) && now > dueEnd) {
        isLate = true;
      }
    }
    if (isLate && assignment.allowLate === false) {
      return res.status(400).json({ success: false, error: 'Deadline passed and late submissions are disabled for this assignment.' });
    }

    const subKey = `${assignmentId}::${actor.id}`;
    const submission = {
      id: prevSub?.id || `sub-${assignmentId}-${actor.id}`.slice(0, 120),
      assignmentId,
      studentId: actor.id,
      studentName: actor.name,
      studentEmail: actor.email || '',
      classGrade: actor.grade || assignment.classGrade,
      classSection: actor.section || assignment.classSection,
      status: isLate ? 'late' : 'submitted',
      submissionText: String(submissionText).trim(),
      attachmentUrl: String(attachmentUrl).trim(),
      attachmentName: String(attachmentName).trim(),
      isLate,
      submittedAt: now.toISOString(),
      score: null,
      maxScore: assignment.maxScore || 100,
      feedback: '',
      evaluatedBy: null,
      evaluatedAt: null,
      resultsReleased: false,
      updatedAt: now.toISOString()
    };

    memoryStore.submissions.set(subKey, submission);

    // Update assignment completedList idempotently
    const completedSet = new Set<string>(Array.isArray(assignment.completedList) ? assignment.completedList : []);
    completedSet.add(actor.id);
    if (actor.email) completedSet.add(actor.email);
    assignment.completedList = Array.from(completedSet);
    memoryStore.assignments.set(assignmentId, assignment);

    if (process.env.NODE_ENV !== 'test') {
      const sb = getSb();
      if (sb) {
        await sb.from('assignment_submissions').upsert({
          id: submission.id,
          assignment_id: submission.assignmentId,
          student_id: submission.studentId,
          student_name: submission.studentName,
          student_email: submission.studentEmail,
          class_grade: submission.classGrade,
          class_section: submission.classSection,
          status: submission.status,
          submission_text: submission.submissionText,
          attachment_url: submission.attachmentUrl,
          attachment_name: submission.attachmentName,
          is_late: submission.isLate,
          submitted_at: submission.submittedAt,
          max_score: submission.maxScore,
          results_released: false,
          updated_at: submission.updatedAt
        }, { onConflict: 'assignment_id,student_id' });

        await sb.from('homework').update({
          completed_list: JSON.stringify(assignment.completedList)
        }).eq('id', assignmentId);
      }
    }

    await persistNotificationRecord({
      title: `📥 Submission Received: ${assignment.title}`,
      message: `${actor.name} (${actor.grade || ''}) submitted${isLate ? ' (Late)' : ''}.`,
      type: 'assignment',
      targetUserId: assignment.teacherId || 'all',
      targetRole: 'teacher',
      targetClass: assignment.classGrade,
      targetSection: assignment.classSection === 'All Sections' ? 'all' : assignment.classSection,
      linkTab: 'faculty',
      dedupeKey: `sub_${assignmentId}_${actor.id}`
    });

    if (deps.emitScopedBroadcast) {
      deps.emitScopedBroadcast('academic:submission_received', { assignmentId, submission }, {
        targetRole: 'teacher',
        targetGrade: assignment.classGrade,
        targetSection: assignment.classSection,
        targetUserId: actor.id,
        sensitive: true
      });
    }

    return res.status(200).json({ success: true, submission });
  });

  // POST /api/academic/assignments/:id/evaluate (Faculty evaluates & releases feedback/marks)
  app.post('/api/academic/assignments/:id/evaluate', async (req, res) => {
    const resolved = await resolveActor(req);
    if (!resolved.actor) return res.status(resolved.errorStatus || 401).json({ success: false, error: resolved.errorMsg });
    const actor = resolved.actor;

    if (!isFacultyOrAdminRole(actor.role)) {
      return res.status(403).json({ success: false, error: 'Permission denied: only faculty can evaluate submissions.' });
    }

    const assignmentId = req.params.id;
    const {
      studentId,
      studentName,
      score,
      feedback = '',
      action = 'evaluate', // 'evaluate' | 'return_for_revision'
      resultsReleased = true
    } = req.body || {};

    if (!studentId) {
      return res.status(400).json({ success: false, error: 'studentId is required.' });
    }

    const assignment = memoryStore.assignments.get(assignmentId);
    if (assignment && !isFacultyAuthorizedForScope(actor, assignment.classGrade, assignment.classSection)) {
      return res.status(403).json({ success: false, error: 'Scope denied: cannot evaluate submissions outside your assigned cohorts.' });
    }

    const maxScore = Number(assignment?.maxScore || req.body?.maxScore || 100);
    let numericScore: number | null = null;
    if (score !== undefined && score !== null && score !== '') {
      numericScore = Number(score);
      if (Number.isNaN(numericScore) || numericScore < 0 || numericScore > maxScore) {
        return res.status(400).json({ success: false, error: `Score must be between 0 and ${maxScore}.` });
      }
    }

    const subKey = `${assignmentId}::${studentId}`;
    const existingList = await fetchAllSubmissionsFromStore(assignmentId);
    const existing = existingList.find(s => s.studentId === studentId);
    const now = new Date().toISOString();
    const nextStatus = action === 'return_for_revision' ? 'returned_for_revision' : 'evaluated';

    const updated = {
      ...(existing || {
        id: `sub-${assignmentId}-${studentId}`.slice(0, 120),
        assignmentId,
        studentId,
        studentName: studentName || 'Student',
        classGrade: assignment?.classGrade || actor.grade,
        classSection: assignment?.classSection || actor.section,
        submissionText: '',
        isLate: false,
        submittedAt: now
      }),
      status: nextStatus,
      score: numericScore,
      maxScore,
      feedback: String(feedback || '').trim(),
      evaluatedBy: actor.name || 'Teacher',
      evaluatedAt: now,
      resultsReleased: action === 'return_for_revision' ? true : Boolean(resultsReleased),
      updatedAt: now
    };

    memoryStore.submissions.set(subKey, updated);

    if (process.env.NODE_ENV !== 'test') {
      const sb = getSb();
      if (sb) {
        await sb.from('assignment_submissions').upsert({
          id: updated.id,
          assignment_id: updated.assignmentId,
          student_id: updated.studentId,
          student_name: updated.studentName,
          class_grade: updated.classGrade,
          class_section: updated.classSection,
          status: updated.status,
          score: updated.score,
          max_score: updated.maxScore,
          feedback: updated.feedback,
          evaluated_by: updated.evaluatedBy,
          evaluated_at: updated.evaluatedAt,
          results_released: updated.resultsReleased,
          updated_at: updated.updatedAt
        }, { onConflict: 'assignment_id,student_id' });
      }
    }

    if (updated.resultsReleased) {
      await persistNotificationRecord({
        title: nextStatus === 'returned_for_revision'
          ? `🔁 Revision Requested: ${assignment?.title || 'Assignment'}`
          : `✅ Assignment Evaluated: ${assignment?.title || 'Assignment'}`,
        message: nextStatus === 'returned_for_revision'
          ? `${actor.name} requested a revision: "${updated.feedback || 'See feedback details.'}"`
          : `Score: ${updated.score !== null ? `${updated.score}/${updated.maxScore}` : 'Graded'}${updated.feedback ? ` · ${updated.feedback}` : ''}`,
        type: 'feedback',
        targetUserId: studentId,
        targetRole: 'student',
        linkTab: 'homework',
        dedupeKey: `eval_${assignmentId}_${studentId}_${nextStatus}`
      });

      if (deps.emitScopedBroadcast) {
        deps.emitScopedBroadcast('academic:submission_evaluated', { assignmentId, submission: updated }, {
          targetUserId: studentId,
          targetRole: 'student',
          sensitive: true
        });
      }
    }

    return res.json({ success: true, submission: updated });
  });

  // --------------------------------------------------------------------------
  // 2. ASSESSMENTS & EXAMS LIFECYCLE + RESULT PUBLICATION GATING
  // --------------------------------------------------------------------------

  app.get('/api/academic/assessments', async (req, res) => {
    const resolved = await resolveActor(req);
    if (!resolved.actor) return res.status(resolved.errorStatus || 401).json({ success: false, error: resolved.errorMsg });
    const actor = resolved.actor;

    const merged = new Map<string, any>();
    if (process.env.NODE_ENV !== 'test') {
      try {
        const sb = getSb();
        if (sb) {
          const { data } = await sb.from('gradebook_assessments').select('*').order('date', { ascending: false });
          (data || []).forEach((a: any) => {
            merged.set(a.id, {
              id: a.id,
              title: a.title,
              classGrade: a.class_grade,
              classSection: a.class_section,
              subject: a.subject,
              period: a.period,
              type: a.type,
              maxScore: Number(a.max_score || 100),
              date: a.date,
              teacherId: a.teacher_id,
              teacherName: a.teacher_name,
              status: a.status || 'published',
              syllabusCoverage: a.syllabus_coverage || '',
              instructions: a.instructions || '',
              resources: Array.isArray(a.resources) ? a.resources : [],
              resultsPublished: a.results_published !== false,
              createdAt: a.created_at,
              updatedAt: a.updated_at
            });
          });
        }
      } catch (_) {}
    }
    memoryStore.assessments.forEach((v, k) => merged.set(k, v));

    let list = Array.from(merged.values());
    const role = actor.role.toLowerCase();
    if (role === 'student' || role === 'parent') {
      list = list.filter(a =>
        (a.status || 'published') !== 'draft' &&
        isStudentEligibleForCohort(actor.grade, actor.section, a.classGrade, a.classSection)
      );
    } else if (role === 'teacher' || role === 'coordinator' || role === 'hod') {
      list = list.filter(a =>
        a.teacherId === actor.id ||
        isFacultyAuthorizedForScope(actor, a.classGrade, a.classSection)
      );
    }

    return res.json({ success: true, assessments: list });
  });

  app.post('/api/academic/assessments', async (req, res) => {
    const resolved = await resolveActor(req);
    if (!resolved.actor) return res.status(resolved.errorStatus || 401).json({ success: false, error: resolved.errorMsg });
    const actor = resolved.actor;

    if (!isFacultyOrAdminRole(actor.role)) {
      return res.status(403).json({ success: false, error: 'Permission denied: only faculty can schedule assessments.' });
    }

    const b = req.body || {};
    const title = String(b.title || '').trim();
    const maxScore = Number(b.maxScore || 100);
    const classGrade = String(b.classGrade || actor.grade || 'Grade 10').trim();
    const classSection = String(b.classSection || actor.section || 'All Sections').trim();

    if (!title || Number.isNaN(maxScore) || maxScore <= 0) {
      return res.status(400).json({ success: false, error: 'Valid assessment title and positive maxScore are required.' });
    }
    if (!isFacultyAuthorizedForScope(actor, classGrade, classSection)) {
      return res.status(403).json({ success: false, error: 'Scope denied for target grade/section.' });
    }

    const now = new Date().toISOString();
    const assessment = {
      id: b.id || crypto.randomUUID(),
      title,
      classGrade,
      classSection,
      subject: String(b.subject || 'Mathematics').trim(),
      period: String(b.period || 'Term 1').trim(),
      type: String(b.type || 'Unit Test').trim(),
      maxScore,
      date: String(b.date || now.split('T')[0]).trim(),
      teacherId: actor.id,
      teacherName: actor.name,
      status: ['draft', 'published', 'cancelled'].includes(b.status) ? b.status : 'published',
      syllabusCoverage: String(b.syllabusCoverage || '').trim(),
      instructions: String(b.instructions || '').trim(),
      resources: Array.isArray(b.resources) ? b.resources : [],
      resultsPublished: Boolean(b.resultsPublished ?? false),
      createdAt: now,
      updatedAt: now
    };

    memoryStore.assessments.set(assessment.id, assessment);

    if (process.env.NODE_ENV !== 'test') {
      const sb = getSb();
      if (sb) {
        const { error } = await sb.from('gradebook_assessments').upsert({
          id: assessment.id,
          title: assessment.title,
          class_grade: assessment.classGrade,
          class_section: assessment.classSection,
          subject: assessment.subject,
          period: assessment.period,
          type: assessment.type,
          max_score: assessment.maxScore,
          date: assessment.date,
          teacher_id: assessment.teacherId,
          teacher_name: assessment.teacherName,
          status: assessment.status,
          syllabus_coverage: assessment.syllabusCoverage,
          instructions: assessment.instructions,
          resources: assessment.resources,
          results_published: assessment.resultsPublished,
          updated_at: assessment.updatedAt
        });
        if (error && (error.code === 'PGRST204' || error.message?.includes('column'))) {
          await sb.from('gradebook_assessments').upsert({
            id: assessment.id,
            title: assessment.title,
            class_grade: assessment.classGrade,
            class_section: assessment.classSection,
            subject: assessment.subject,
            period: assessment.period,
            type: assessment.type,
            max_score: assessment.maxScore,
            date: assessment.date,
            teacher_id: assessment.teacherId,
            teacher_name: assessment.teacherName
          });
        }
      }
    }

    if (assessment.status === 'published') {
      await persistNotificationRecord({
        title: `📅 Exam Scheduled: ${assessment.title}`,
        message: `${assessment.subject} (${assessment.type}) on ${assessment.date}${assessment.syllabusCoverage ? ` · Syllabus: ${assessment.syllabusCoverage}` : ''}`,
        type: 'exam',
        targetRole: 'student',
        targetClass: assessment.classGrade,
        targetSection: assessment.classSection === 'All Sections' ? 'all' : assessment.classSection,
        linkTab: 'calendar',
        dedupeKey: `exam_sched_${assessment.id}`
      });
    }

    return res.status(201).json({ success: true, assessment });
  });

  app.patch('/api/academic/assessments/:id', async (req, res) => {
    const resolved = await resolveActor(req);
    if (!resolved.actor) return res.status(resolved.errorStatus || 401).json({ success: false, error: resolved.errorMsg });
    const actor = resolved.actor;

    if (!isFacultyOrAdminRole(actor.role)) {
      return res.status(403).json({ success: false, error: 'Permission denied: only faculty can update assessments.' });
    }

    const id = req.params.id;
    let existing = memoryStore.assessments.get(id);
    if (!existing && process.env.NODE_ENV !== 'test') {
      const sb = getSb();
      if (sb) {
        const { data } = await sb.from('gradebook_assessments').select('*').eq('id', id).maybeSingle();
        if (data) {
          existing = {
            id: data.id,
            title: data.title,
            classGrade: data.class_grade,
            classSection: data.class_section,
            subject: data.subject,
            period: data.period,
            type: data.type,
            maxScore: Number(data.max_score || 100),
            date: data.date,
            teacherId: data.teacher_id,
            teacherName: data.teacher_name,
            status: data.status || 'published',
            syllabusCoverage: data.syllabus_coverage || '',
            instructions: data.instructions || '',
            resources: data.resources || [],
            resultsPublished: data.results_published !== false
          };
        }
      }
    }

    if (!existing) return res.status(404).json({ success: false, error: 'Assessment not found.' });
    if (!isFacultyAuthorizedForScope(actor, existing.classGrade, existing.classSection)) {
      return res.status(403).json({ success: false, error: 'Scope denied.' });
    }

    const p = req.body || {};
    const prevResultsPublished = Boolean(existing.resultsPublished);
    const prevStatus = existing.status;

    const updated = {
      ...existing,
      ...(p.title !== undefined ? { title: String(p.title).trim() } : {}),
      ...(p.date !== undefined ? { date: String(p.date).trim() } : {}),
      ...(p.status !== undefined ? { status: p.status } : {}),
      ...(p.syllabusCoverage !== undefined ? { syllabusCoverage: String(p.syllabusCoverage).trim() } : {}),
      ...(p.instructions !== undefined ? { instructions: String(p.instructions).trim() } : {}),
      ...(p.resources !== undefined ? { resources: p.resources } : {}),
      ...(p.resultsPublished !== undefined ? { resultsPublished: Boolean(p.resultsPublished) } : {}),
      updatedAt: new Date().toISOString()
    };

    memoryStore.assessments.set(id, updated);

    if (process.env.NODE_ENV !== 'test') {
      const sb = getSb();
      if (sb) {
        await sb.from('gradebook_assessments').update({
          title: updated.title,
          date: updated.date,
          status: updated.status,
          syllabus_coverage: updated.syllabusCoverage,
          instructions: updated.instructions,
          resources: updated.resources,
          results_published: updated.resultsPublished,
          updated_at: updated.updatedAt
        }).eq('id', id);
      }
    }

    if (!prevResultsPublished && updated.resultsPublished) {
      await persistNotificationRecord({
        title: `🎓 Results Released: ${updated.title}`,
        message: `${updated.subject} (${updated.type}) marks are now available in your Student Gradebook.`,
        type: 'marks',
        targetRole: 'student',
        targetClass: updated.classGrade,
        targetSection: updated.classSection === 'All Sections' ? 'all' : updated.classSection,
        linkTab: 'performance',
        dedupeKey: `exam_res_${updated.id}`
      });
    } else if (prevStatus !== 'cancelled' && updated.status === 'cancelled') {
      await persistNotificationRecord({
        title: `⚠️ Assessment Cancelled: ${updated.title}`,
        message: `${updated.subject} scheduled for ${updated.date} has been cancelled by ${actor.name}.`,
        type: 'exam',
        targetRole: 'student',
        targetClass: updated.classGrade,
        targetSection: updated.classSection === 'All Sections' ? 'all' : updated.classSection,
        linkTab: 'calendar',
        dedupeKey: `exam_cancel_${updated.id}`
      });
    }

    return res.json({ success: true, assessment: updated });
  });

  // POST /api/academic/assessments/:id/entries (Faculty saves marks with strict validation)
  app.post('/api/academic/assessments/:id/entries', async (req, res) => {
    const resolved = await resolveActor(req);
    if (!resolved.actor) return res.status(resolved.errorStatus || 401).json({ success: false, error: resolved.errorMsg });
    const actor = resolved.actor;

    if (!isFacultyOrAdminRole(actor.role)) {
      return res.status(403).json({ success: false, error: 'Permission denied: only faculty can enter marks.' });
    }

    const assessmentId = req.params.id;
    const assessment = memoryStore.assessments.get(assessmentId);
    if (assessment && !isFacultyAuthorizedForScope(actor, assessment.classGrade, assessment.classSection)) {
      return res.status(403).json({ success: false, error: 'Scope denied.' });
    }

    const entriesInput = Array.isArray(req.body?.entries) ? req.body.entries : [];
    const maxScore = Number(assessment?.maxScore || req.body?.maxScore || 100);
    const saved: any[] = [];

    for (const item of entriesInput) {
      const score = Number(item.score);
      if (Number.isNaN(score) || score < 0 || score > maxScore) {
        return res.status(400).json({ success: false, error: `Invalid score ${item.score} for ${item.studentName || item.studentId}. Must be 0..${maxScore}.` });
      }
      const pct = Math.round((score / maxScore) * 100);
      const letterGrade = pct >= 90 ? 'A+' : pct >= 80 ? 'A' : pct >= 70 ? 'B' : pct >= 60 ? 'C' : pct >= 50 ? 'D' : 'F';
      const rec = {
        id: item.id || `${assessmentId}_${item.studentId}`,
        assessmentId,
        studentId: item.studentId,
        studentName: item.studentName || 'Student',
        subject: assessment?.subject || item.subject || 'Subject',
        score,
        maxScore,
        percentage: pct,
        letterGrade,
        comment: item.comment || '',
        updatedBy: actor.name,
        updatedAt: new Date().toISOString()
      };
      memoryStore.gradeEntries.set(`${assessmentId}::${item.studentId}`, rec);
      saved.push(rec);
    }

    if (process.env.NODE_ENV !== 'test' && saved.length > 0) {
      const sb = getSb();
      if (sb) {
        await sb.from('gradebook_entries').upsert(
          saved.map(s => ({
            assessment_id: s.assessmentId,
            student_id: s.studentId,
            student_name: s.studentName,
            subject: s.subject,
            score: s.score,
            max_score: s.maxScore,
            percentage: s.percentage,
            letter_grade: s.letterGrade,
            comment: s.comment,
            updated_at: s.updatedAt,
            updated_by: s.updatedBy
          })),
          { onConflict: 'assessment_id,student_id' }
        );
      }
    }

    return res.json({ success: true, entries: saved });
  });

  // GET /api/academic/gradebook-entries (Student sees strictly own entries & only published results)
  app.get('/api/academic/gradebook-entries', async (req, res) => {
    const resolved = await resolveActor(req);
    if (!resolved.actor) return res.status(resolved.errorStatus || 401).json({ success: false, error: resolved.errorMsg });
    const actor = resolved.actor;
    const role = actor.role.toLowerCase();

    const merged = new Map<string, any>();
    if (process.env.NODE_ENV !== 'test') {
      const sb = getSb();
      if (sb) {
        let q = sb.from('gradebook_entries').select('*');
        if (role === 'student') q = q.eq('student_id', actor.id);
        const { data } = await q.order('updated_at', { ascending: false });
        (data || []).forEach((e: any) => {
          merged.set(`${e.assessment_id}::${e.student_id}`, {
            id: e.id,
            assessmentId: e.assessment_id,
            studentId: e.student_id,
            studentName: e.student_name,
            subject: e.subject,
            score: e.score,
            maxScore: e.max_score,
            percentage: e.percentage,
            letterGrade: e.letter_grade,
            comment: e.comment,
            updatedAt: e.updated_at
          });
        });
      }
    }
    memoryStore.gradeEntries.forEach((v, k) => merged.set(k, v));

    let list = Array.from(merged.values());
    if (role === 'student' || role === 'parent') {
      list = list.filter(e => {
        if (role === 'student' && e.studentId !== actor.id) return false;
        const parentAss = memoryStore.assessments.get(e.assessmentId);
        if (parentAss && parentAss.resultsPublished === false) return false;
        if (parentAss && parentAss.status === 'draft') return false;
        return true;
      });
    }

    return res.json({ success: true, entries: list });
  });

  // --------------------------------------------------------------------------
  // 3. ATTENDANCE RECORDING & AUDITABLE CORRECTION HISTORY
  // --------------------------------------------------------------------------

  app.post('/api/academic/attendance/record', async (req, res) => {
    const resolved = await resolveActor(req);
    if (!resolved.actor) return res.status(resolved.errorStatus || 401).json({ success: false, error: resolved.errorMsg });
    const actor = resolved.actor;

    if (!isFacultyOrAdminRole(actor.role)) {
      return res.status(403).json({ success: false, error: 'Permission denied: students cannot modify official attendance records.' });
    }

    const {
      studentId,
      studentName = 'Student',
      date,
      status,
      grade,
      section,
      subject = 'General / Homeroom',
      reason = ''
    } = req.body || {};

    if (!studentId || !date || !['present', 'absent', 'late', 'leave', 'holiday'].includes(status)) {
      return res.status(400).json({ success: false, error: 'Valid studentId, date, and attendance status are required.' });
    }
    if (!isFacultyAuthorizedForScope(actor, grade, section)) {
      return res.status(403).json({ success: false, error: 'Scope denied for student cohort.' });
    }

    const attKey = `${studentId}::${date}::${subject}`;
    const existing = memoryStore.attendance.get(attKey);
    const previousStatus = existing?.status || null;
    const now = new Date().toISOString();

    const record = {
      id: existing?.id || `${studentId}_${date}`,
      studentId,
      studentName,
      date,
      status,
      grade,
      section,
      subject,
      updatedBy: actor.name,
      updatedAt: now
    };
    memoryStore.attendance.set(attKey, record);

    let auditEntry: any = null;
    if (previousStatus && previousStatus !== status) {
      auditEntry = {
        id: crypto.randomUUID(),
        attendanceId: record.id,
        studentId,
        studentName,
        date,
        subject,
        grade,
        section,
        previousStatus,
        newStatus: status,
        reason: String(reason || 'Faculty register correction').trim(),
        actorId: actor.id,
        actorName: actor.name,
        actorRole: actor.role,
        createdAt: now
      };
      memoryStore.attendanceAuditLogs.unshift(auditEntry);
    }

    if (process.env.NODE_ENV !== 'test') {
      const sb = getSb();
      if (sb) {
        const { data: dbExisting } = await sb
          .from('attendance')
          .select('id, status')
          .eq('date', date)
          .or(`user_id.eq.${studentId},student_id.eq.${studentId}`)
          .maybeSingle();

        const dbPrevStatus = dbExisting?.status || previousStatus;
        if (dbExisting?.id) {
          await sb.from('attendance').update({
            status,
            subject,
            grade,
            section,
            updated_by: actor.name,
            updated_at: now
          }).eq('id', dbExisting.id);
        } else {
          await sb.from('attendance').insert({
            id: record.id,
            user_id: studentId,
            student_id: studentId,
            student_name: studentName,
            date,
            status,
            grade,
            section,
            subject,
            updated_by: actor.name,
            updated_at: now
          });
        }

        if (dbPrevStatus && dbPrevStatus !== status) {
          if (!auditEntry) {
            auditEntry = {
              id: crypto.randomUUID(),
              attendanceId: record.id,
              studentId,
              studentName,
              date,
              subject,
              grade,
              section,
              previousStatus: dbPrevStatus,
              newStatus: status,
              reason: String(reason || 'Faculty register correction').trim(),
              actorId: actor.id,
              actorName: actor.name,
              actorRole: actor.role,
              createdAt: now
            };
            memoryStore.attendanceAuditLogs.unshift(auditEntry);
          }
          await sb.from('attendance_audit_logs').insert({
            id: auditEntry.id,
            attendance_id: auditEntry.attendanceId,
            student_id: auditEntry.studentId,
            student_name: auditEntry.studentName,
            date: auditEntry.date,
            subject: auditEntry.subject,
            grade: auditEntry.grade,
            section: auditEntry.section,
            previous_status: auditEntry.previousStatus,
            new_status: auditEntry.newStatus,
            reason: auditEntry.reason,
            actor_id: auditEntry.actorId,
            actor_name: auditEntry.actorName,
            actor_role: auditEntry.actorRole,
            created_at: auditEntry.createdAt
          });
        }
      }
    }

    if (status === 'absent' || auditEntry) {
      await persistNotificationRecord({
        title: auditEntry ? `📋 Attendance Updated (${date})` : `⚠️ Marked Absent (${date})`,
        message: auditEntry
          ? `${subject}: Status corrected from ${auditEntry.previousStatus} to ${status.toUpperCase()} by ${actor.name}.`
          : `${subject}: You were marked ABSENT on ${date} by ${actor.name}.`,
        type: 'attendance',
        targetUserId: studentId,
        targetRole: 'student',
        linkTab: 'attendance',
        dedupeKey: `att_${studentId}_${date}_${status}`
      });
    }

    if (deps.emitScopedBroadcast) {
      deps.emitScopedBroadcast('academic:attendance_updated', { record, auditEntry }, {
        targetUserId: studentId,
        sensitive: true
      });
    }

    return res.json({ success: true, record, auditEntry });
  });

  app.get('/api/academic/attendance/history', async (req, res) => {
    const resolved = await resolveActor(req);
    if (!resolved.actor) return res.status(resolved.errorStatus || 401).json({ success: false, error: resolved.errorMsg });
    const actor = resolved.actor;
    const role = actor.role.toLowerCase();

    const merged = new Map<string, any>();
    memoryStore.attendanceAuditLogs.forEach(a => merged.set(a.id, a));

    if (process.env.NODE_ENV !== 'test') {
      const sb = getSb();
      if (sb) {
        let q = sb.from('attendance_audit_logs').select('*').order('created_at', { ascending: false }).limit(100);
        if (role === 'student') q = q.eq('student_id', actor.id);
        const { data } = await q;
        (data || []).forEach((row: any) => {
          merged.set(row.id, {
            id: row.id,
            attendanceId: row.attendance_id,
            studentId: row.student_id,
            studentName: row.student_name,
            date: row.date,
            subject: row.subject,
            grade: row.grade,
            section: row.section,
            previousStatus: row.previous_status,
            newStatus: row.new_status,
            reason: row.reason,
            actorId: row.actor_id,
            actorName: row.actor_name,
            actorRole: row.actor_role,
            createdAt: row.created_at
          });
        });
      }
    }

    let logs = Array.from(merged.values());
    if (role === 'student' || role === 'parent') {
      logs = logs.filter(l => l.studentId === actor.id);
    } else if (role === 'teacher' || role === 'coordinator' || role === 'hod') {
      logs = logs.filter(l => isFacultyAuthorizedForScope(actor, l.grade, l.section));
    }

    return res.json({ success: true, auditLogs: logs });
  });

  // --------------------------------------------------------------------------
  // 4. TARGETED ANNOUNCEMENTS & PER-USER READ TRACKING
  // --------------------------------------------------------------------------

  app.get('/api/academic/announcements', async (req, res) => {
    const resolved = await resolveActor(req);
    if (!resolved.actor) return res.status(resolved.errorStatus || 401).json({ success: false, error: resolved.errorMsg });
    const actor = resolved.actor;

    const merged = new Map<string, any>();
    if (process.env.NODE_ENV !== 'test') {
      const sb = getSb();
      if (sb) {
        const { data, error } = await sb.from('announcements').select('*').order('created_at', { ascending: false });
        if (!error && Array.isArray(data)) {
          data.forEach((a: any) => {
            merged.set(a.id, {
              id: a.id,
              title: a.title,
              content: a.content,
              tag: a.tag || 'Notice',
              priority: a.priority || 'normal',
              targetRole: a.target_role || 'all',
              targetGrade: a.target_grade || 'all',
              targetSection: a.target_section || 'all',
              targetSubject: a.target_subject || 'all',
              attachments: Array.isArray(a.attachments) ? a.attachments : [],
              status: a.status || 'published',
              authorId: a.author_id,
              authorName: a.author_name,
              authorRole: a.author_role,
              createdAt: a.created_at,
              updatedAt: a.updated_at
            });
          });
        }
      }
    }
    memoryStore.announcements.forEach((v, k) => merged.set(k, v));

    const readsForActor = new Set<string>();
    memoryStore.announcementReads.forEach((readers, annId) => {
      if (readers.has(actor.id)) readsForActor.add(annId);
    });

    if (process.env.NODE_ENV !== 'test') {
      try {
        const sb = getSb();
        if (sb) {
          const { data: rData } = await sb
            .from('announcement_reads')
            .select('announcement_id')
            .eq('user_id', actor.id);
          (rData || []).forEach((r: any) => readsForActor.add(r.announcement_id));
        }
      } catch (_) {}
    }

    const visible = Array.from(merged.values())
      .filter(ann => isAnnouncementVisibleToUser(ann, actor))
      .map(ann => ({
        ...ann,
        isRead: readsForActor.has(ann.id)
      }))
      .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());

    return res.json({ success: true, announcements: visible });
  });

  app.post('/api/academic/announcements', async (req, res) => {
    const resolved = await resolveActor(req);
    if (!resolved.actor) return res.status(resolved.errorStatus || 401).json({ success: false, error: resolved.errorMsg });
    const actor = resolved.actor;

    if (!isFacultyOrAdminRole(actor.role)) {
      return res.status(403).json({ success: false, error: 'Permission denied: only faculty or coordinators can post announcements.' });
    }

    const b = req.body || {};
    const title = String(b.title || '').trim();
    const content = String(b.content || '').trim();
    const targetRole = String(b.targetRole || 'all').toLowerCase();
    const targetGrade = String(b.targetGrade || 'all').trim();
    const targetSection = String(b.targetSection || 'all').trim();
    const targetSubject = String(b.targetSubject || 'all').trim();
    const status = ['draft', 'published', 'archived'].includes(b.status) ? b.status : 'published';

    if (!title || !content) {
      return res.status(400).json({ success: false, error: 'Announcement title and content are required.' });
    }
    if (!isFacultyAuthorizedForScope(actor, targetGrade, targetSection)) {
      return res.status(403).json({ success: false, error: 'Scope denied: target grade/section outside your faculty authorization.' });
    }

    const now = new Date().toISOString();
    const announcement = {
      id: b.id || `ann-${Date.now()}-${crypto.randomBytes(2).toString('hex')}`,
      title,
      content,
      tag: String(b.tag || (b.priority === 'urgent' ? 'Urgent' : 'Circular')),
      priority: ['normal', 'important', 'urgent'].includes(b.priority) ? b.priority : 'normal',
      targetRole,
      targetGrade,
      targetSection,
      targetSubject,
      attachments: Array.isArray(b.attachments) ? b.attachments : [],
      status,
      authorId: actor.id,
      authorName: actor.name,
      authorRole: actor.role,
      date: now.split('T')[0],
      createdAt: now,
      updatedAt: now
    };

    memoryStore.announcements.set(announcement.id, announcement);

    if (process.env.NODE_ENV !== 'test') {
      const sb = getSb();
      if (sb) {
        await sb.from('announcements').upsert({
          id: announcement.id,
          title: announcement.title,
          content: announcement.content,
          tag: announcement.tag,
          priority: announcement.priority,
          target_role: announcement.targetRole,
          target_grade: announcement.targetGrade,
          target_section: announcement.targetSection,
          target_subject: announcement.targetSubject,
          attachments: announcement.attachments,
          status: announcement.status,
          author_id: announcement.authorId,
          author_name: announcement.authorName,
          author_role: announcement.authorRole,
          created_at: announcement.createdAt,
          updated_at: announcement.updatedAt
        });
      }
    }

    if (announcement.status === 'published') {
      await persistNotificationRecord({
        title: `📢 ${announcement.title}`,
        message: announcement.content.slice(0, 180),
        type: 'announcement',
        targetRole: announcement.targetRole,
        targetClass: announcement.targetGrade,
        targetSection: announcement.targetSection,
        linkTab: 'notice_viewer',
        dedupeKey: `ann_pub_${announcement.id}`
      });

      if (deps.emitScopedBroadcast) {
        deps.emitScopedBroadcast('announcement:received', announcement, {
          targetRole: announcement.targetRole,
          targetGrade: announcement.targetGrade,
          targetSection: announcement.targetSection
        });
      }
    }

    return res.status(201).json({ success: true, announcement });
  });

  app.patch('/api/academic/announcements/:id', async (req, res) => {
    const resolved = await resolveActor(req);
    if (!resolved.actor) return res.status(resolved.errorStatus || 401).json({ success: false, error: resolved.errorMsg });
    const actor = resolved.actor;

    if (!isFacultyOrAdminRole(actor.role)) {
      return res.status(403).json({ success: false, error: 'Permission denied.' });
    }

    const id = req.params.id;
    const existing = memoryStore.announcements.get(id);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Announcement not found.' });
    }
    if (!isFacultyAuthorizedForScope(actor, existing.targetGrade, existing.targetSection)) {
      return res.status(403).json({ success: false, error: 'Scope denied.' });
    }

    const p = req.body || {};
    const updated = {
      ...existing,
      ...(p.title !== undefined ? { title: String(p.title).trim() } : {}),
      ...(p.content !== undefined ? { content: String(p.content).trim() } : {}),
      ...(p.status !== undefined ? { status: p.status } : {}),
      ...(p.priority !== undefined ? { priority: p.priority } : {}),
      ...(p.targetGrade !== undefined ? { targetGrade: p.targetGrade } : {}),
      ...(p.targetSection !== undefined ? { targetSection: p.targetSection } : {}),
      updatedAt: new Date().toISOString()
    };
    memoryStore.announcements.set(id, updated);

    if (process.env.NODE_ENV !== 'test') {
      const sb = getSb();
      if (sb) {
        await sb.from('announcements').update({
          title: updated.title,
          content: updated.content,
          status: updated.status,
          priority: updated.priority,
          target_grade: updated.targetGrade,
          target_section: updated.targetSection,
          updated_at: updated.updatedAt
        }).eq('id', id);
      }
    }

    return res.json({ success: true, announcement: updated });
  });

  app.post('/api/academic/announcements/:id/read', async (req, res) => {
    const resolved = await resolveActor(req);
    if (!resolved.actor) return res.status(resolved.errorStatus || 401).json({ success: false, error: resolved.errorMsg });
    const actor = resolved.actor;
    const id = req.params.id;

    if (!memoryStore.announcementReads.has(id)) {
      memoryStore.announcementReads.set(id, new Set());
    }
    memoryStore.announcementReads.get(id)!.add(actor.id);

    if (process.env.NODE_ENV !== 'test') {
      try {
        const sb = getSb();
        if (sb) {
          await sb.from('announcement_reads').upsert({
            announcement_id: id,
            user_id: actor.id,
            read_at: new Date().toISOString()
          }, { onConflict: 'announcement_id,user_id' });
        }
      } catch (_) {}
    }

    return res.json({ success: true, read: true });
  });
}
