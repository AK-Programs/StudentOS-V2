/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * StudentOS Enterprise Excel (.xlsx) Export Engine
 * Generates verified Microsoft Excel spreadsheets with styling, metadata, and audit logging.
 */

import * as XLSX from 'xlsx';
import { UserProfile, UserRole } from '../types';
import { logAuditAction } from './auditLogService';

export function canUserExport(role?: UserRole | string): boolean {
  if (!role) return false;
  return ['teacher', 'coordinator', 'admin', 'super_admin'].includes(role);
}

export interface AttendanceExportItem {
  date: string;
  grade: string;
  section: string;
  studentName: string;
  status: 'present' | 'absent' | 'late' | 'leave' | 'holiday' | string;
  subject?: string;
  remarks?: string;
}

export interface MarksExportItem {
  studentName: string;
  grade: string;
  section?: string;
  subject: string;
  examName: string;
  marks: number;
  maxMarks: number;
  percentage?: number;
  letterGrade?: string;
}

export interface ReportCardExportItem {
  rollNo?: string;
  studentName: string;
  grade: string;
  section: string;
  term: string;
  academicYear?: string;
  subjectScores: Record<string, number>; // e.g. { Mathematics: 92, Science: 88, English: 95 }
  totalMarksObtained: number;
  totalMaxMarks: number;
  overallPercentage: number;
  overallGrade: string;
  attendancePercentage?: number;
  rankOrRemarks?: string;
}

/**
 * Exports Attendance Records to real .xlsx file
 * Schema: Date, Class, Section, Student Name, Status
 */
export async function exportAttendanceToExcel(
  items: AttendanceExportItem[],
  options: {
    grade: string;
    section?: string;
    date?: string;
    currentUser: UserProfile;
    effectiveRole?: UserRole;
  }
): Promise<{ success: boolean; filename: string }> {
  if (!canUserExport(options.effectiveRole || options.currentUser.role)) {
    throw new Error('Unauthorized: Students cannot export class attendance records.');
  }

  const exportRows = items.map(item => ({
    'Date': item.date,
    'Class / Grade': item.grade,
    'Section': item.section || 'General',
    'Student Name': item.studentName,
    'Status': item.status.toUpperCase(),
    'Subject': item.subject || 'Full Day Attendance',
    'Remarks': item.remarks || ''
  }));

  const worksheet = XLSX.utils.json_to_sheet(exportRows);

  // Column width hints
  worksheet['!cols'] = [
    { wch: 14 }, // Date
    { wch: 14 }, // Grade
    { wch: 12 }, // Section
    { wch: 26 }, // Student Name
    { wch: 14 }, // Status
    { wch: 22 }, // Subject
    { wch: 20 }  // Remarks
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Attendance');

  const safeDate = options.date || new Date().toISOString().split('T')[0];
  const safeClass = `${options.grade.replace(/\s+/g, '_')}_${options.section || 'All'}`;
  const filename = `Attendance_${safeClass}_${safeDate}.xlsx`;

  XLSX.writeFile(workbook, filename);

  // Record audit log
  await logAuditAction({
    actorUid: options.currentUser.uid || options.currentUser.email || 'system',
    actorName: options.currentUser.name || 'Staff Member',
    actorRole: options.effectiveRole || options.currentUser.role || 'staff',
    actorEmail: options.currentUser.email,
    action: 'export_excel',
    details: `Exported attendance sheet for ${options.grade} ${options.section || ''} (${items.length} records) to Excel (.xlsx)`,
    sourceClass: `${options.grade} ${options.section || ''}`.trim(),
    metadata: {
      type: 'attendance',
      recordCount: items.length,
      filename,
      date: safeDate
    }
  });

  return { success: true, filename };
}

/**
 * Exports Marks / Gradebook to real .xlsx file
 * Schema: Student Name, Class, Subject, Exam Name, Marks, Max Marks
 */
export async function exportMarksToExcel(
  items: MarksExportItem[],
  options: {
    grade: string;
    section?: string;
    subject?: string;
    examName?: string;
    currentUser: UserProfile;
    effectiveRole?: UserRole;
  }
): Promise<{ success: boolean; filename: string }> {
  if (!canUserExport(options.effectiveRole || options.currentUser.role)) {
    throw new Error('Unauthorized: Students cannot export class marks.');
  }

  const exportRows = items.map(item => {
    const percentage = item.percentage ?? Math.round((item.marks / Math.max(1, item.maxMarks)) * 100);
    return {
      'Student Name': item.studentName,
      'Class': item.grade,
      'Section': item.section || 'All',
      'Subject': item.subject,
      'Exam Name': item.examName,
      'Marks Obtained': item.marks,
      'Max Marks': item.maxMarks,
      'Percentage': `${percentage}%`,
      'Letter Grade': item.letterGrade || (percentage >= 90 ? 'A+' : percentage >= 80 ? 'A' : percentage >= 70 ? 'B' : percentage >= 60 ? 'C' : percentage >= 50 ? 'D' : 'F')
    };
  });

  const worksheet = XLSX.utils.json_to_sheet(exportRows);

  worksheet['!cols'] = [
    { wch: 26 }, // Student Name
    { wch: 14 }, // Class
    { wch: 12 }, // Section
    { wch: 20 }, // Subject
    { wch: 24 }, // Exam Name
    { wch: 16 }, // Marks Obtained
    { wch: 14 }, // Max Marks
    { wch: 14 }, // Percentage
    { wch: 14 }  // Letter Grade
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Gradebook');

  const safeSubject = (options.subject || 'All_Subjects').replace(/[^a-zA-Z0-9]/g, '_');
  const safeClass = `${options.grade.replace(/\s+/g, '_')}_${options.section || 'All'}`;
  const filename = `Marks_${safeClass}_${safeSubject}.xlsx`;

  XLSX.writeFile(workbook, filename);

  // Record audit log
  await logAuditAction({
    actorUid: options.currentUser.uid || options.currentUser.email || 'system',
    actorName: options.currentUser.name || 'Staff Member',
    actorRole: options.effectiveRole || options.currentUser.role || 'staff',
    actorEmail: options.currentUser.email,
    action: 'export_excel',
    details: `Exported student evaluation marks for ${options.grade} ${options.section || ''} (${options.subject || 'All Subjects'}) to Excel (.xlsx)`,
    sourceClass: `${options.grade} ${options.section || ''}`.trim(),
    metadata: {
      type: 'marks',
      recordCount: items.length,
      filename,
      subject: options.subject
    }
  });

  return { success: true, filename };
}

/**
 * Exports Comprehensive Student Report Cards to real .xlsx file
 * Schema: One row per student with subject marks and total
 */
export async function exportReportCardsToExcel(
  items: ReportCardExportItem[],
  options: {
    grade: string;
    section?: string;
    term: string;
    currentUser: UserProfile;
    effectiveRole?: UserRole;
  }
): Promise<{ success: boolean; filename: string }> {
  if (!canUserExport(options.effectiveRole || options.currentUser.role)) {
    throw new Error('Unauthorized: Students cannot export institutional report cards.');
  }

  // Collect all unique subjects across students
  const subjectSet = new Set<string>();
  items.forEach(it => {
    Object.keys(it.subjectScores || {}).forEach(sub => subjectSet.add(sub));
  });
  const subjectList = Array.from(subjectSet);

  const exportRows = items.map((item, idx) => {
    const row: Record<string, any> = {
      'Roll No': item.rollNo || idx + 1,
      'Student Name': item.studentName,
      'Class': item.grade,
      'Section': item.section,
      'Evaluation Term': item.term
    };

    // Add dynamic subject columns
    subjectList.forEach(sub => {
      row[sub] = item.subjectScores[sub] !== undefined ? item.subjectScores[sub] : 'N/A';
    });

    row['Total Obtained'] = item.totalMarksObtained;
    row['Max Total'] = item.totalMaxMarks;
    row['Percentage'] = `${item.overallPercentage}%`;
    row['Final Grade'] = item.overallGrade;
    if (item.attendancePercentage !== undefined) {
      row['Attendance %'] = `${item.attendancePercentage}%`;
    }
    row['Remarks / Rank'] = item.rankOrRemarks || 'Satisfactory Academic Performance';

    return row;
  });

  const worksheet = XLSX.utils.json_to_sheet(exportRows);

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Report_Cards');

  const safeTerm = options.term.replace(/[^a-zA-Z0-9]/g, '_');
  const safeClass = `${options.grade.replace(/\s+/g, '_')}_${options.section || 'All'}`;
  const filename = `ReportCards_${safeClass}_${safeTerm}.xlsx`;

  XLSX.writeFile(workbook, filename);

  // Record audit log
  await logAuditAction({
    actorUid: options.currentUser.uid || options.currentUser.email || 'system',
    actorName: options.currentUser.name || 'Staff Member',
    actorRole: options.effectiveRole || options.currentUser.role || 'staff',
    actorEmail: options.currentUser.email,
    action: 'export_excel',
    details: `Exported comprehensive institutional report cards for ${options.grade} ${options.section || ''} (${options.term}) to Excel (.xlsx)`,
    sourceClass: `${options.grade} ${options.section || ''}`.trim(),
    metadata: {
      type: 'report_cards',
      studentCount: items.length,
      filename,
      term: options.term
    }
  });

  return { success: true, filename };
}
