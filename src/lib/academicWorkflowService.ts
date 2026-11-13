/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Shared Academic Workflow Service
 * Bridges Student Dashboard, Faculty Workspace, Digital Gradebook, Attendance Manager,
 * Academic Calendar, Notifications, Byte, and Orion through /api/academic/* endpoints
 * with real Supabase/Backend persistence and cross-view event synchronization.
 */

import { supabase } from './supabase';
import {
  AssignmentSubmission,
  AttendanceAuditLog,
  GradebookAssessment,
  GradebookEntry,
  Homework,
  TargetedAnnouncement,
  UserProfile
} from '../types';

export interface AcademicApiResult<T> {
  ok: boolean;
  data?: T;
  error?: string;
}

export type DerivedAssignmentStatus =
  | 'upcoming'
  | 'pending'
  | 'submitted'
  | 'late'
  | 'under_evaluation'
  | 'evaluated'
  | 'returned_for_revision'
  | 'completed';

async function buildAcademicHeaders(user?: UserProfile | null): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };

  try {
    const { data } = await supabase.auth.getSession();
    const token = data?.session?.access_token;
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  } catch (_) {}

  if (user) {
    const uid = user.uid || user.email || '';
    if (uid) headers['x-veylentra-uid'] = uid;
    if (user.role) headers['x-veylentra-role'] = String(user.role);
    if (user.grade) headers['x-veylentra-grade'] = String(user.grade);
    if (user.section) headers['x-veylentra-section'] = String(user.section);
    if (user.name) headers['x-veylentra-name'] = String(user.name);
    if (Array.isArray(user.assignedGrades) && user.assignedGrades.length > 0) {
      headers['x-veylentra-assigned-grades'] = user.assignedGrades.join(',');
    }
    if (Array.isArray(user.assignedSections) && user.assignedSections.length > 0) {
      headers['x-veylentra-assigned-sections'] = user.assignedSections.join(',');
    }
  }

  return headers;
}

export function dispatchAcademicSyncEvent(table: string, action: 'INSERT' | 'UPDATE' | 'DELETE', record?: any) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent('studentos-db-update', {
      detail: { table, action, record, timestamp: Date.now() }
    })
  );
}

export function normalizeCohortGrade(val?: string | null): string {
  const raw = String(val || '').trim().toLowerCase();
  if (!raw || raw === 'all' || raw === 'all grades') return 'all';
  const match = raw.match(/\d+/);
  return match ? `grade ${match[0]}` : raw;
}

export function normalizeCohortSection(val?: string | null): string {
  const raw = String(val || '').trim().toLowerCase();
  if (!raw || raw === 'all' || raw === 'all sections') return 'all';
  return raw;
}

export function isStudentMatchedToCohort(
  studentGrade?: string | null,
  studentSection?: string | null,
  targetGrade?: string | null,
  targetSection?: string | null
): boolean {
  const tg = normalizeCohortGrade(targetGrade);
  const sg = normalizeCohortGrade(studentGrade);
  if (tg !== 'all') {
    if (!sg || sg !== tg) return false;
  }

  const ts = normalizeCohortSection(targetSection);
  const ss = normalizeCohortSection(studentSection);
  if (ts !== 'all') {
    if (!ss) return false;
    if (ss !== ts && !ss.includes(ts)) return false;
  }

  return true;
}

export function isAnnouncementEligibleForUser(
  ann: any,
  user?: UserProfile | null
): boolean {
  if (!user) return false;
  const role = String(user.role || 'student').toLowerCase();
  const status = String(ann?.status || 'published').toLowerCase();

  if (role === 'student' || role === 'parent') {
    if (status !== 'published') return false;
  } else if (status === 'draft' && ann?.authorId && (user.uid || user.email) && ann.authorId !== (user.uid || user.email) && !['admin', 'super_admin', 'coordinator'].includes(role)) {
    return false;
  }

  const targetRole = String(ann?.targetRole || ann?.target_role || 'all').toLowerCase();
  if (targetRole !== 'all' && targetRole !== role) {
    if (!(['teacher', 'coordinator', 'hod', 'admin', 'super_admin'].includes(role) && ann?.authorId === (user.uid || user.email))) {
      return false;
    }
  }

  if (role === 'student' || role === 'parent') {
    return isStudentMatchedToCohort(
      user.grade,
      user.section,
      ann?.targetGrade || ann?.target_grade || ann?.targetClass || 'all',
      ann?.targetSection || ann?.target_section || 'all'
    );
  }

  return true;
}

export function deriveAssignmentDisplayStatus(
  hw: Homework & { mySubmission?: AssignmentSubmission | null },
  submission?: AssignmentSubmission | null,
  userId?: string | null
): DerivedAssignmentStatus {
  const sub = submission || hw.mySubmission || null;
  if (sub) {
    if (sub.status === 'returned_for_revision') return 'returned_for_revision';
    if (sub.status === 'evaluated') return sub.resultsReleased ? 'evaluated' : 'under_evaluation';
    if (sub.status === 'under_evaluation') return 'under_evaluation';
    if (sub.status === 'late') return 'late';
    if (sub.status === 'submitted') return 'submitted';
  }

  if (userId && Array.isArray(hw.completedList) && hw.completedList.includes(userId)) {
    return 'completed';
  }

  if (hw.dueDate) {
    const due = new Date(`${String(hw.dueDate).slice(0, 10)}T23:59:59`);
    if (!Number.isNaN(due.getTime())) {
      const diffDays = (due.getTime() - Date.now()) / 86400000;
      if (diffDays > 5) return 'upcoming';
    }
  }

  return 'pending';
}

// ---------------- ASSIGNMENTS & SUBMISSIONS ----------------

export async function fetchAssignments(
  user?: UserProfile | null
): Promise<AcademicApiResult<Array<Homework & { mySubmission?: AssignmentSubmission | null; stats?: any }>>> {
  try {
    const headers = await buildAcademicHeaders(user);
    const resp = await fetch('/api/academic/assignments', { headers });
    const json = await resp.json().catch(() => ({}));
    if (!resp.ok || !json.success) {
      return { ok: false, error: json.error || `Request failed (${resp.status})` };
    }
    return { ok: true, data: Array.isArray(json.assignments) ? json.assignments : [] };
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Network error fetching assignments.' };
  }
}

export async function saveAssignment(
  user: UserProfile | null | undefined,
  assignment: Partial<Homework>,
  isNew: boolean = true
): Promise<AcademicApiResult<Homework>> {
  try {
    const headers = await buildAcademicHeaders(user);
    const url = isNew || !assignment.id
      ? '/api/academic/assignments'
      : `/api/academic/assignments/${encodeURIComponent(assignment.id)}`;
    const method = isNew || !assignment.id ? 'POST' : 'PATCH';
    const resp = await fetch(url, {
      method,
      headers,
      body: JSON.stringify(assignment)
    });
    const json = await resp.json().catch(() => ({}));
    if (!resp.ok || !json.success) {
      return { ok: false, error: json.error || `Failed to save assignment (${resp.status})` };
    }
    dispatchAcademicSyncEvent('homework', isNew ? 'INSERT' : 'UPDATE', json.assignment);
    return { ok: true, data: json.assignment };
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Network error saving assignment.' };
  }
}

export async function fetchAssignmentSubmissions(
  user: UserProfile | null | undefined,
  assignmentId: string
): Promise<AcademicApiResult<AssignmentSubmission[]>> {
  try {
    const headers = await buildAcademicHeaders(user);
    const resp = await fetch(`/api/academic/assignments/${encodeURIComponent(assignmentId)}/submissions`, { headers });
    const json = await resp.json().catch(() => ({}));
    if (!resp.ok || !json.success) {
      return { ok: false, error: json.error || `Failed to fetch submissions (${resp.status})` };
    }
    return { ok: true, data: Array.isArray(json.submissions) ? json.submissions : [] };
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Network error fetching submissions.' };
  }
}

export async function submitAssignmentWork(
  user: UserProfile | null | undefined,
  assignmentId: string,
  payload: { submissionText?: string; attachmentUrl?: string; attachmentName?: string }
): Promise<AcademicApiResult<AssignmentSubmission>> {
  try {
    const headers = await buildAcademicHeaders(user);
    const resp = await fetch(`/api/academic/assignments/${encodeURIComponent(assignmentId)}/submit`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    });
    const json = await resp.json().catch(() => ({}));
    if (!resp.ok || !json.success) {
      return { ok: false, error: json.error || `Failed to submit assignment (${resp.status})` };
    }
    dispatchAcademicSyncEvent('assignment_submissions', 'INSERT', json.submission);
    dispatchAcademicSyncEvent('homework', 'UPDATE', { id: assignmentId });
    return { ok: true, data: json.submission };
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Network error submitting assignment.' };
  }
}

export async function evaluateAssignmentSubmission(
  user: UserProfile | null | undefined,
  assignmentId: string,
  payload: {
    studentId: string;
    studentName?: string;
    score?: number | null;
    maxScore?: number;
    feedback?: string;
    action?: 'evaluate' | 'return_for_revision';
    resultsReleased?: boolean;
  }
): Promise<AcademicApiResult<AssignmentSubmission>> {
  try {
    const headers = await buildAcademicHeaders(user);
    const resp = await fetch(`/api/academic/assignments/${encodeURIComponent(assignmentId)}/evaluate`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    });
    const json = await resp.json().catch(() => ({}));
    if (!resp.ok || !json.success) {
      return { ok: false, error: json.error || `Failed to evaluate submission (${resp.status})` };
    }
    dispatchAcademicSyncEvent('assignment_submissions', 'UPDATE', json.submission);
    dispatchAcademicSyncEvent('homework', 'UPDATE', { id: assignmentId });
    return { ok: true, data: json.submission };
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Network error evaluating submission.' };
  }
}

// ---------------- ASSESSMENTS & GRADEBOOK ----------------

export async function fetchAssessments(
  user?: UserProfile | null
): Promise<AcademicApiResult<GradebookAssessment[]>> {
  try {
    const headers = await buildAcademicHeaders(user);
    const resp = await fetch('/api/academic/assessments', { headers });
    const json = await resp.json().catch(() => ({}));
    if (!resp.ok || !json.success) {
      return { ok: false, error: json.error || `Failed to fetch assessments (${resp.status})` };
    }
    return { ok: true, data: Array.isArray(json.assessments) ? json.assessments : [] };
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Network error fetching assessments.' };
  }
}

export async function createAssessment(
  user: UserProfile | null | undefined,
  payload: Partial<GradebookAssessment>
): Promise<AcademicApiResult<GradebookAssessment>> {
  try {
    const headers = await buildAcademicHeaders(user);
    const resp = await fetch('/api/academic/assessments', {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    });
    const json = await resp.json().catch(() => ({}));
    if (!resp.ok || !json.success) {
      return { ok: false, error: json.error || `Failed to create assessment (${resp.status})` };
    }
    dispatchAcademicSyncEvent('gradebook_assessments', 'INSERT', json.assessment);
    return { ok: true, data: json.assessment };
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Network error creating assessment.' };
  }
}

export async function updateAssessment(
  user: UserProfile | null | undefined,
  assessmentId: string,
  patch: Partial<GradebookAssessment>
): Promise<AcademicApiResult<GradebookAssessment>> {
  try {
    const headers = await buildAcademicHeaders(user);
    const resp = await fetch(`/api/academic/assessments/${encodeURIComponent(assessmentId)}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(patch)
    });
    const json = await resp.json().catch(() => ({}));
    if (!resp.ok || !json.success) {
      return { ok: false, error: json.error || `Failed to update assessment (${resp.status})` };
    }
    dispatchAcademicSyncEvent('gradebook_assessments', 'UPDATE', json.assessment);
    return { ok: true, data: json.assessment };
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Network error updating assessment.' };
  }
}

export async function saveAssessmentEntries(
  user: UserProfile | null | undefined,
  assessmentId: string,
  entries: Array<Partial<GradebookEntry>>,
  maxScore: number
): Promise<AcademicApiResult<GradebookEntry[]>> {
  try {
    const headers = await buildAcademicHeaders(user);
    const resp = await fetch(`/api/academic/assessments/${encodeURIComponent(assessmentId)}/entries`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ entries, maxScore })
    });
    const json = await resp.json().catch(() => ({}));
    if (!resp.ok || !json.success) {
      return { ok: false, error: json.error || `Failed to save marks (${resp.status})` };
    }
    dispatchAcademicSyncEvent('gradebook_entries', 'UPDATE', { assessmentId });
    return { ok: true, data: Array.isArray(json.entries) ? json.entries : [] };
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Network error saving marks.' };
  }
}

export async function fetchGradebookEntries(
  user?: UserProfile | null
): Promise<AcademicApiResult<GradebookEntry[]>> {
  try {
    const headers = await buildAcademicHeaders(user);
    const resp = await fetch('/api/academic/gradebook-entries', { headers });
    const json = await resp.json().catch(() => ({}));
    if (!resp.ok || !json.success) {
      return { ok: false, error: json.error || `Failed to fetch gradebook entries (${resp.status})` };
    }
    return { ok: true, data: Array.isArray(json.entries) ? json.entries : [] };
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Network error fetching gradebook entries.' };
  }
}

// ---------------- ATTENDANCE + AUDIT LOGS ----------------

export async function recordAttendanceWithAudit(
  user: UserProfile | null | undefined,
  payload: {
    studentId: string;
    studentName?: string;
    date: string;
    status: 'present' | 'absent' | 'late' | 'leave' | 'holiday';
    grade?: string;
    section?: string;
    subject?: string;
    reason?: string;
  }
): Promise<AcademicApiResult<{ record: any; auditEntry: AttendanceAuditLog | null }>> {
  try {
    const headers = await buildAcademicHeaders(user);
    const resp = await fetch('/api/academic/attendance/record', {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    });
    const json = await resp.json().catch(() => ({}));
    if (!resp.ok || !json.success) {
      return { ok: false, error: json.error || `Failed to record attendance (${resp.status})` };
    }
    dispatchAcademicSyncEvent('attendance', 'UPDATE', json.record);
    return { ok: true, data: { record: json.record, auditEntry: json.auditEntry || null } };
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Network error recording attendance.' };
  }
}

export async function fetchAttendanceAuditHistory(
  user?: UserProfile | null
): Promise<AcademicApiResult<AttendanceAuditLog[]>> {
  try {
    const headers = await buildAcademicHeaders(user);
    const resp = await fetch('/api/academic/attendance/history', { headers });
    const json = await resp.json().catch(() => ({}));
    if (!resp.ok || !json.success) {
      return { ok: false, error: json.error || `Failed to fetch attendance history (${resp.status})` };
    }
    return { ok: true, data: Array.isArray(json.auditLogs) ? json.auditLogs : [] };
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Network error fetching attendance history.' };
  }
}

// ---------------- TARGETED ANNOUNCEMENTS ----------------

export async function fetchTargetedAnnouncements(
  user?: UserProfile | null
): Promise<AcademicApiResult<TargetedAnnouncement[]>> {
  try {
    const headers = await buildAcademicHeaders(user);
    const resp = await fetch('/api/academic/announcements', { headers });
    const json = await resp.json().catch(() => ({}));
    if (!resp.ok || !json.success) {
      return { ok: false, error: json.error || `Failed to fetch announcements (${resp.status})` };
    }
    return { ok: true, data: Array.isArray(json.announcements) ? json.announcements : [] };
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Network error fetching announcements.' };
  }
}

export async function createTargetedAnnouncement(
  user: UserProfile | null | undefined,
  payload: Partial<TargetedAnnouncement>
): Promise<AcademicApiResult<TargetedAnnouncement>> {
  try {
    const headers = await buildAcademicHeaders(user);
    const resp = await fetch('/api/academic/announcements', {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    });
    const json = await resp.json().catch(() => ({}));
    if (!resp.ok || !json.success) {
      return { ok: false, error: json.error || `Failed to create announcement (${resp.status})` };
    }
    dispatchAcademicSyncEvent('announcements', 'INSERT', json.announcement);
    return { ok: true, data: json.announcement };
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Network error creating announcement.' };
  }
}

export async function updateTargetedAnnouncement(
  user: UserProfile | null | undefined,
  announcementId: string,
  patch: Partial<TargetedAnnouncement>
): Promise<AcademicApiResult<TargetedAnnouncement>> {
  try {
    const headers = await buildAcademicHeaders(user);
    const resp = await fetch(`/api/academic/announcements/${encodeURIComponent(announcementId)}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(patch)
    });
    const json = await resp.json().catch(() => ({}));
    if (!resp.ok || !json.success) {
      return { ok: false, error: json.error || `Failed to update announcement (${resp.status})` };
    }
    dispatchAcademicSyncEvent('announcements', 'UPDATE', json.announcement);
    return { ok: true, data: json.announcement };
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Network error updating announcement.' };
  }
}

export async function markTargetedAnnouncementRead(
  user: UserProfile | null | undefined,
  announcementId: string
): Promise<AcademicApiResult<{ read: boolean }>> {
  try {
    const headers = await buildAcademicHeaders(user);
    const resp = await fetch(`/api/academic/announcements/${encodeURIComponent(announcementId)}/read`, {
      method: 'POST',
      headers
    });
    const json = await resp.json().catch(() => ({}));
    if (!resp.ok || !json.success) {
      return { ok: false, error: json.error || `Failed to mark announcement read (${resp.status})` };
    }
    return { ok: true, data: { read: true } };
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Network error marking announcement read.' };
  }
}
