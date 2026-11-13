/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Extensible Role & Permission Matrix for Veylentra Faculty Workspace
 * Config-driven so additional roles (e.g., hod, academic_dean, counselor)
 * can be added in one registry without conditional clutter in UI components.
 */

import { UserProfile, UserRole } from '../types';
import { getGradeNumber } from '../config/academicHierarchy';

export type FacultyCapability =
  | 'view_assigned_classes'
  | 'view_grade_section_oversight'
  | 'mark_attendance'
  | 'view_attendance_alerts'
  | 'manage_assignments'
  | 'evaluate_submissions'
  | 'manage_marks'
  | 'manage_materials'
  | 'post_class_announcements'
  | 'manage_academic_circulars'
  | 'manage_timetable_coverage'
  | 'manage_houses'
  | 'use_faculty_orion';

export type FacultyScopeLevel = 'assigned_classes' | 'assigned_grades_sections' | 'institutional';

export interface FacultyRoleConfig {
  id: string;
  label: string;
  shortLabel: string;
  workspaceTitle: string;
  workspaceSubtitle: string;
  scopeLevel: FacultyScopeLevel;
  defaultSubTab: 'overview' | 'classes' | 'attendance' | 'assignments' | 'gradebook' | 'insights' | 'materials' | 'coordination';
  capabilities: ReadonlyArray<FacultyCapability>;
}

const TEACHER_CAPABILITIES: FacultyCapability[] = [
  'view_assigned_classes',
  'mark_attendance',
  'manage_assignments',
  'evaluate_submissions',
  'manage_marks',
  'manage_materials',
  'post_class_announcements',
  'use_faculty_orion'
];

const COORDINATOR_CAPABILITIES: FacultyCapability[] = [
  'view_assigned_classes',
  'view_grade_section_oversight',
  'mark_attendance',
  'view_attendance_alerts',
  'manage_assignments',
  'evaluate_submissions',
  'manage_marks',
  'manage_materials',
  'post_class_announcements',
  'manage_academic_circulars',
  'manage_timetable_coverage',
  'manage_houses',
  'use_faculty_orion'
];

const EXTENDED_ADMIN_CAPABILITIES: FacultyCapability[] = [
  ...COORDINATOR_CAPABILITIES
];

export const FACULTY_ROLE_REGISTRY: Record<string, FacultyRoleConfig> = {
  teacher: {
    id: 'teacher',
    label: 'Subject & Class Teacher',
    shortLabel: 'Teacher',
    workspaceTitle: 'Faculty Teaching Workspace',
    workspaceSubtitle: 'Assigned classes, daily schedule, attendance register, assignment evaluation, and gradebook.',
    scopeLevel: 'assigned_classes',
    defaultSubTab: 'overview',
    capabilities: TEACHER_CAPABILITIES
  },
  coordinator: {
    id: 'coordinator',
    label: 'Academic Coordinator',
    shortLabel: 'Coordinator',
    workspaceTitle: 'Coordinator Oversight Workspace',
    workspaceSubtitle: 'Authorized grade & section supervision, timetable coverage, attendance compliance, and academic circulars.',
    scopeLevel: 'assigned_grades_sections',
    defaultSubTab: 'overview',
    capabilities: COORDINATOR_CAPABILITIES
  },
  // Extensible example role supported automatically without altering component UI trees
  hod: {
    id: 'hod',
    label: 'Head of Department',
    shortLabel: 'HOD',
    workspaceTitle: 'Department Leadership Workspace',
    workspaceSubtitle: 'Department syllabus pacing, faculty coordination, and assessment calibration.',
    scopeLevel: 'assigned_grades_sections',
    defaultSubTab: 'coordination',
    capabilities: COORDINATOR_CAPABILITIES
  },
  admin: {
    id: 'admin',
    label: 'Academic Administrator',
    shortLabel: 'Admin',
    workspaceTitle: 'Academic Administration View',
    workspaceSubtitle: 'Institutional academic oversight and faculty support tools.',
    scopeLevel: 'institutional',
    defaultSubTab: 'overview',
    capabilities: EXTENDED_ADMIN_CAPABILITIES
  },
  super_admin: {
    id: 'super_admin',
    label: 'Super Administrator',
    shortLabel: 'Super Admin',
    workspaceTitle: 'Academic Administration View',
    workspaceSubtitle: 'Institutional academic oversight and faculty support tools.',
    scopeLevel: 'institutional',
    defaultSubTab: 'overview',
    capabilities: EXTENDED_ADMIN_CAPABILITIES
  }
};

export function getFacultyRoleConfig(role?: UserRole | string | null): FacultyRoleConfig {
  const normalized = String(role || 'teacher').toLowerCase().trim();
  return FACULTY_ROLE_REGISTRY[normalized] || FACULTY_ROLE_REGISTRY.teacher;
}

export function hasFacultyCapability(role: UserRole | string | undefined | null, capability: FacultyCapability): boolean {
  const cfg = getFacultyRoleConfig(role);
  return cfg.capabilities.includes(capability);
}

export function isFacultyRole(role?: UserRole | string | null): boolean {
  const normalized = String(role || '').toLowerCase().trim();
  return normalized in FACULTY_ROLE_REGISTRY;
}

function parseAssignedClass(entry: string | { grade?: string; section?: string } | null | undefined): {
  grade?: string;
  section?: string;
} {
  if (!entry) return {};
  if (typeof entry === 'string') {
    const parts = entry.split(/[_|]/).map(p => p.trim()).filter(Boolean);
    return {
      grade: parts[0],
      section: parts[1]
    };
  }
  return {
    grade: entry.grade,
    section: entry.section
  };
}

/**
 * Extracts normalized grades authorized for the faculty member.
 * Falls back cleanly to currentUser.grade when explicit assignment arrays are not populated.
 */
export function getAuthorizedGrades(user?: UserProfile | null): string[] {
  if (!user) return ['Grade 10'];
  const gradeSet = new Set<string>();

  if (Array.isArray(user.assignedClasses)) {
    user.assignedClasses.forEach(raw => {
      const c = parseAssignedClass(raw as any);
      if (c.grade) gradeSet.add(`Grade ${getGradeNumber(c.grade)}`);
    });
  }
  if (Array.isArray(user.assignedGrades)) {
    user.assignedGrades.forEach(g => {
      if (g) gradeSet.add(`Grade ${getGradeNumber(g)}`);
    });
  }
  if (gradeSet.size === 0 && user.grade) {
    gradeSet.add(`Grade ${getGradeNumber(user.grade)}`);
  }
  if (gradeSet.size === 0) {
    gradeSet.add('Grade 10');
  }
  return Array.from(gradeSet);
}

/**
 * Extracts normalized sections authorized for the faculty member.
 */
export function getAuthorizedSections(user?: UserProfile | null): string[] {
  if (!user) return ['Solara'];
  const secSet = new Set<string>();

  if (Array.isArray(user.assignedClasses)) {
    user.assignedClasses.forEach(raw => {
      const c = parseAssignedClass(raw as any);
      if (c.section) secSet.add(String(c.section).trim());
    });
  }
  if (Array.isArray(user.assignedSections)) {
    user.assignedSections.forEach(s => {
      if (s) secSet.add(String(s).trim());
    });
  }
  if (secSet.size === 0 && user.section) {
    secSet.add(String(user.section).trim());
  }
  if (secSet.size === 0) {
    secSet.add('Solara');
  }
  return Array.from(secSet);
}

/**
 * Checks whether a student record is within a teacher's or coordinator's authorized class scope.
 */
export function isStudentInFacultyScope(
  student: Pick<UserProfile, 'grade' | 'section'>,
  facultyUser: UserProfile | null | undefined,
  effectiveRole?: UserRole | string | null
): boolean {
  const cfg = getFacultyRoleConfig(effectiveRole || facultyUser?.role);
  if (cfg.scopeLevel === 'institutional') return true;
  if (!facultyUser) return false;

  const studentGrade = student.grade ? `Grade ${getGradeNumber(student.grade)}` : '';
  const studentSection = (student.section || '').trim().toLowerCase();

  // Exact class pairs take priority when configured
  if (Array.isArray(facultyUser.assignedClasses) && facultyUser.assignedClasses.length > 0) {
    return facultyUser.assignedClasses.some(raw => {
      const pair = parseAssignedClass(raw as any);
      const pairGrade = pair.grade ? `Grade ${getGradeNumber(pair.grade)}` : '';
      const pairSec = (pair.section || '').trim().toLowerCase();
      const gradeMatch = !pairGrade || !studentGrade || pairGrade === studentGrade;
      const sectionMatch = !pairSec || !studentSection || pairSec === studentSection;
      return gradeMatch && sectionMatch;
    });
  }

  const allowedGrades = getAuthorizedGrades(facultyUser);
  const allowedSections = getAuthorizedSections(facultyUser).map(s => s.toLowerCase());

  const gradeOk = !studentGrade || allowedGrades.includes(studentGrade);
  const sectionOk = !studentSection || allowedSections.includes(studentSection);

  // Coordinators oversee whole assigned grades across sections if no explicit section lock is set
  if (cfg.scopeLevel === 'assigned_grades_sections' && (!facultyUser.assignedSections || facultyUser.assignedSections.length === 0)) {
    return gradeOk;
  }

  return gradeOk && sectionOk;
}
