/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * StudentOS Enterprise Audit Logging Service
 * Records promotions, Excel exports, password resets, and student spectate sessions.
 */

import { UserProfile } from '../types';

export type AuditActionType =
  | 'export_excel'
  | 'promote_class'
  | 'reset_password'
  | 'spectate_student'
  | 'feature_flag_toggle'
  | 'class_move'
  | 'leave_approval'
  | 'circular_approval';

export interface AuditLogEntry {
  id: string;
  timestamp: string; // ISO string
  actorUid: string;
  actorName: string;
  actorRole: string;
  actorEmail?: string;
  action: AuditActionType;
  details: string;
  targetStudentId?: string;
  targetStudentName?: string;
  sourceClass?: string;
  destinationClass?: string;
  schoolId?: string;
  metadata?: Record<string, any>;
}

export type LogAuditActionInput =
  | Omit<AuditLogEntry, 'id' | 'timestamp'>
  | {
      actor: UserProfile;
      actorUid?: string;
      actorName?: string;
      actorRole?: string;
      actorEmail?: string;
      action: AuditActionType;
      details: string;
      targetStudentId?: string;
      targetStudentName?: string;
      sourceClass?: string;
      destinationClass?: string;
      schoolId?: string;
      metadata?: Record<string, any>;
    };

const AUDIT_STORAGE_KEY = 'studentos_audit_logs';

// Default initial audit entries so the viewer shows realistic historical compliance
const INITIAL_AUDIT_LOGS: AuditLogEntry[] = [
  {
    id: 'audit-init-01',
    timestamp: new Date(Date.now() - 3600000 * 24 * 2).toISOString(),
    actorUid: 'admin-principal',
    actorName: 'Dr. Evelyn Reed',
    actorRole: 'admin',
    actorEmail: 'principal@school.edu',
    action: 'export_excel',
    details: 'Exported official monthly attendance sheet for Grade 10 - Solara (38 students) to Excel (.xlsx)',
    sourceClass: 'Grade 10 - Solara',
    schoolId: 'dps-main'
  },
  {
    id: 'audit-init-02',
    timestamp: new Date(Date.now() - 3600000 * 24).toISOString(),
    actorUid: 'demo-super',
    actorName: 'Naitik Kashyap',
    actorRole: 'super_admin',
    actorEmail: 'naitik.kashyap0015@gmail.com',
    action: 'spectate_student',
    details: 'Opened read-only student spectate session for Alice Smith (Grade 10 - Solara)',
    targetStudentId: 'demo_alice',
    targetStudentName: 'Alice Smith',
    sourceClass: 'Grade 10 - Solara',
    schoolId: 'dps-main'
  },
  {
    id: 'audit-init-03',
    timestamp: new Date(Date.now() - 3600000 * 12).toISOString(),
    actorUid: 'admin-principal',
    actorName: 'Dr. Evelyn Reed',
    actorRole: 'admin',
    actorEmail: 'principal@school.edu',
    action: 'reset_password',
    details: 'Issued secure single-use credential reset token for student Bob Jones (Grade 10 - Solara)',
    targetStudentId: 'demo_bob',
    targetStudentName: 'Bob Jones',
    schoolId: 'dps-main'
  },
  {
    id: 'audit-init-04',
    timestamp: new Date(Date.now() - 3600000 * 4).toISOString(),
    actorUid: 'admin-principal',
    actorName: 'Dr. Evelyn Reed',
    actorRole: 'admin',
    actorEmail: 'principal@school.edu',
    action: 'promote_class',
    details: 'Year-End Promotion: Promoted 32 active students from Grade 9 - Astra to Grade 10 - Astra (Academic Year 2026-2027)',
    sourceClass: 'Grade 9 - Astra',
    destinationClass: 'Grade 10 - Astra',
    schoolId: 'dps-main',
    metadata: { studentCount: 32, academicYear: '2026-2027' }
  }
];

export function getLocalAuditLogs(): AuditLogEntry[] {
  if (typeof window === 'undefined') return INITIAL_AUDIT_LOGS;
  try {
    const raw = localStorage.getItem(AUDIT_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (_) {}
  return INITIAL_AUDIT_LOGS;
}

export async function logAuditAction(
  entry: LogAuditActionInput
): Promise<AuditLogEntry> {
  const actor = 'actor' in entry ? entry.actor : undefined;
  const actorUid = actor?.uid || (entry as any).actorUid || 'unknown';
  const actorName = actor?.name || (entry as any).actorName || 'Staff Member';
  const actorRole = actor?.role || (entry as any).actorRole || 'admin';
  const actorEmail = actor?.email || (entry as any).actorEmail;

  const newEntry: AuditLogEntry = {
    id: `audit-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    timestamp: new Date().toISOString(),
    actorUid,
    actorName,
    actorRole,
    actorEmail,
    action: entry.action,
    details: entry.details,
    targetStudentId: entry.targetStudentId,
    targetStudentName: entry.targetStudentName,
    sourceClass: entry.sourceClass,
    destinationClass: entry.destinationClass,
    schoolId: entry.schoolId,
    metadata: entry.metadata
  };

  const current = getLocalAuditLogs();
  const updated = [newEntry, ...current].slice(0, 500); // retain last 500 records

  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(AUDIT_STORAGE_KEY, JSON.stringify(updated));
      window.dispatchEvent(
        new CustomEvent('studentos_audit_log_added', { detail: newEntry })
      );
    } catch (_) {}
  }

  return newEntry;
}

export function filterAuditLogs(
  logs: AuditLogEntry[],
  filters?: {
    action?: string;
    role?: string;
    searchQuery?: string;
    startDate?: string;
    endDate?: string;
  }
): AuditLogEntry[] {
  if (!filters) return logs;
  return logs.filter(log => {
    if (filters.action && filters.action !== 'all' && log.action !== filters.action) {
      return false;
    }
    if (filters.role && filters.role !== 'all' && log.actorRole !== filters.role) {
      return false;
    }
    if (filters.startDate) {
      const logDate = log.timestamp.split('T')[0];
      if (logDate < filters.startDate) return false;
    }
    if (filters.endDate) {
      const logDate = log.timestamp.split('T')[0];
      if (logDate > filters.endDate) return false;
    }
    if (filters.searchQuery) {
      const q = filters.searchQuery.toLowerCase();
      const match =
        log.actorName.toLowerCase().includes(q) ||
        log.details.toLowerCase().includes(q) ||
        (log.targetStudentName && log.targetStudentName.toLowerCase().includes(q)) ||
        (log.sourceClass && log.sourceClass.toLowerCase().includes(q));
      if (!match) return false;
    }
    return true;
  });
}
