/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Veylentra Academic Hierarchy Configuration
 * Centralized, standardized grade & section definitions enforced across:
 * - Student & Teacher Signups
 * - Attendance Manager
 * - Homework & Assignments
 * - Classroom Panel Board
 * - Performance Analytics & Gradebook
 * 
 * Standard:
 * - Classes 1 to 8: Sections Astra, Elera, Solara, Vega
 * - Classes 9 to 12: Sections Astra, Elera, Solara
 */

export const GRADES_JUNIOR = [1, 2, 3, 4, 5, 6, 7, 8] as const;
export const GRADES_SENIOR = [9, 10, 11, 12] as const;
export const ALL_GRADES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;

export const SECTIONS_1_TO_8 = ['Astra', 'Elera', 'Solara', 'Vega'] as const;
export const SECTIONS_9_TO_12 = ['Astra', 'Elera', 'Solara'] as const;

export type JuniorGrade = typeof GRADES_JUNIOR[number];
export type SeniorGrade = typeof GRADES_SENIOR[number];
export type AcademicGrade = typeof ALL_GRADES[number];

export type SectionJunior = typeof SECTIONS_1_TO_8[number];
export type SectionSenior = typeof SECTIONS_9_TO_12[number];
export type AcademicSection = SectionJunior;

/**
 * Extracts numeric grade from string like "Grade 10", "Class 8", "10", etc.
 */
export function getGradeNumber(grade: string | number | undefined | null): number {
  if (typeof grade === 'number') return grade;
  if (!grade) return 10;
  const match = String(grade).match(/\d+/);
  return match ? parseInt(match[0], 10) : 10;
}

/**
 * Returns formatted grade string, e.g. "Grade 10"
 */
export function formatGradeString(grade: string | number): string {
  const num = getGradeNumber(grade);
  return `Grade ${num}`;
}

/**
 * Centralized authority for valid sections for a given grade
 */
export function getSectionsForGrade(grade: string | number | undefined | null): string[] {
  const num = getGradeNumber(grade);
  if (num >= 1 && num <= 8) {
    return [...SECTIONS_1_TO_8];
  }
  return [...SECTIONS_9_TO_12];
}

/**
 * Validates whether a section is permitted in a grade
 */
export function isValidGradeSection(grade: string | number, section: string): boolean {
  if (!section) return false;
  const allowed = getSectionsForGrade(grade);
  const normalized = section.trim().toLowerCase();
  return allowed.some(s => s.toLowerCase() === normalized || (s === 'Elera' && normalized === 'elara'));
}

/**
 * All grade labels for dropdowns: ["Grade 1", "Grade 2", ..., "Grade 12"]
 */
export const ALL_GRADE_OPTIONS: string[] = ALL_GRADES.map(g => `Grade ${g}`);
