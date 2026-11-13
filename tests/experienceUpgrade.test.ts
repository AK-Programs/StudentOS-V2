/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Veylentra — Student, Faculty, Byte & Orion AI Provider Lock Test Suite
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  getFacultyRoleConfig,
  hasFacultyCapability,
  isFacultyRole,
  getAuthorizedGrades,
  getAuthorizedSections,
  isStudentInFacultyScope
} from '../src/config/facultyPermissions';
import {
  computeAttendanceSummary,
  calculateAttendanceProjection
} from '../src/lib/attendanceCalculator';
import {
  buildByteReminders,
  answerByteQueryLocally,
  isCategoryEnabledByPrefs
} from '../src/lib/byteReminderEngine';
import { UserProfile, Homework } from '../src/types';

let passed = 0;

function runTest(name: string, fn: () => void) {
  fn();
  passed += 1;
  console.log(`✅ [PASS] ${name}`);
}

const sampleTeacher: UserProfile = {
  uid: 'teacher-1',
  name: 'Dr. Elena Rostova',
  email: 'elena@school.edu',
  role: 'teacher',
  house: 'Sapphire',
  grade: 'Grade 10',
  section: 'Solara',
  assignedGrades: ['Grade 10'],
  assignedSections: ['Solara'],
  streakDays: 0,
  studyHours: 0
};

const sampleCoordinator: UserProfile = {
  uid: 'coord-1',
  name: 'Marcus Vance',
  email: 'marcus@school.edu',
  role: 'coordinator',
  house: 'Emerald',
  grade: 'Grade 10',
  section: 'Astra',
  assignedGrades: ['Grade 10', 'Grade 11'],
  assignedSections: ['Astra', 'Solara'],
  streakDays: 0,
  studyHours: 0
};

const sampleStudentInScope: UserProfile = {
  uid: 'stu-1',
  name: 'Aarav Patel',
  email: 'aarav@school.edu',
  role: 'student',
  house: 'Ruby',
  grade: 'Grade 10',
  section: 'Solara',
  streakDays: 3,
  studyHours: 5
};

const sampleStudentOutOfScope: UserProfile = {
  uid: 'stu-2',
  name: 'Nora Lin',
  email: 'nora@school.edu',
  role: 'student',
  house: 'Topaz',
  grade: 'Grade 12',
  section: 'Vega',
  streakDays: 1,
  studyHours: 2
};

runTest('Faculty role registry separates teacher, coordinator, and extensible hod capabilities', () => {
  assert.equal(isFacultyRole('teacher'), true);
  assert.equal(isFacultyRole('coordinator'), true);
  assert.equal(isFacultyRole('hod'), true);
  assert.equal(isFacultyRole('student'), false);

  assert.equal(hasFacultyCapability('teacher', 'mark_attendance'), true);
  assert.equal(hasFacultyCapability('teacher', 'view_grade_section_oversight'), false);
  assert.equal(hasFacultyCapability('coordinator', 'view_grade_section_oversight'), true);
  assert.equal(hasFacultyCapability('hod', 'manage_timetable_coverage'), true);
  assert.equal(getFacultyRoleConfig('hod').shortLabel, 'HOD');
});

runTest('Student scope checker strictly restricts teachers and coordinators to authorized cohorts', () => {
  assert.deepEqual(getAuthorizedGrades(sampleTeacher), ['Grade 10']);
  assert.deepEqual(getAuthorizedSections(sampleTeacher), ['Solara']);

  assert.equal(isStudentInFacultyScope(sampleStudentInScope, sampleTeacher, 'teacher'), true);
  assert.equal(isStudentInFacultyScope(sampleStudentOutOfScope, sampleTeacher, 'teacher'), false);
  assert.equal(isStudentInFacultyScope(sampleStudentOutOfScope, sampleCoordinator, 'coordinator'), false);
  assert.equal(isStudentInFacultyScope(sampleStudentOutOfScope, sampleCoordinator, 'admin'), true);
});

runTest('Attendance summary and projection calculator perform accurate math and flag estimates', () => {
  const stats = computeAttendanceSummary([
    { status: 'present' },
    { status: 'present' },
    { status: 'late' },
    { status: 'absent' },
    { status: 'holiday' }
  ]);
  assert.equal(stats.totalConducted, 4);
  assert.equal(stats.effectivePresent, 3);
  assert.equal(stats.percentage, 75);

  const below = calculateAttendanceProjection(6, 10, 75);
  assert.equal(below.isMeetingTarget, false);
  assert.equal(below.classesNeededForTarget, 6); // (6+6)/(10+6) = 12/16 = 75%
  assert.equal(below.isEstimate, true);
  assert.ok(below.disclaimer.toLowerCase().includes('estimate'));

  const above = calculateAttendanceProjection(9, 10, 75);
  assert.equal(above.isMeetingTarget, true);
  assert.equal(above.canMissSafely, 2); // 9/12 = 75%
});

runTest('Byte reminder engine deterministically prioritizes role-scoped items with reasons and zero AI', () => {
  const hwList: Homework[] = [
    {
      id: 'hw-1',
      classGrade: 'Grade 10',
      classSection: 'Solara',
      subject: 'Physics',
      title: 'Kinematics Set A',
      content: 'Solve problems 1-5',
      dueDate: new Date(Date.now() - 86400000).toISOString().split('T')[0],
      givenBy: 'Dr. Elena Rostova',
      createdAt: new Date().toISOString(),
      completedList: []
    },
    {
      id: 'hw-1',
      classGrade: 'Grade 10',
      classSection: 'Solara',
      subject: 'Physics',
      title: 'Kinematics Set A',
      content: 'Duplicate entry check',
      dueDate: new Date().toISOString().split('T')[0],
      givenBy: 'Dr. Elena Rostova',
      createdAt: new Date().toISOString(),
      completedList: []
    }
  ];

  const studentReminders = buildByteReminders({
    currentUser: sampleStudentInScope,
    effectiveRole: 'student',
    homeworkList: hwList,
    dueCardsCount: 4,
    attendancePercentage: 70,
    attendanceTotalConducted: 10,
    ignorePersistedState: true
  });

  // Deduplicated homework + low attendance + due flashcards
  assert.equal(studentReminders.filter(r => r.id === 'hw-hw-1').length, 1);
  assert.ok(studentReminders.some(r => r.type === 'attendance' && r.priority === 'urgent'));
  assert.ok(studentReminders.every(r => Boolean(r.reason && r.actionLabel)));

  const localReply = answerByteQueryLocally('physics homework', studentReminders);
  assert.ok(localReply.matchingReminders.some(r => r.id === 'hw-hw-1'));
  assert.ok(localReply.summary.includes('Kinematics Set A'));

  const mutedUser: UserProfile = {
    ...sampleStudentInScope,
    raw_data: { notificationPreferences: { muteAll: true } }
  };
  assert.equal(isCategoryEnabledByPrefs(mutedUser, 'assignment'), false);

  const coordReminders = buildByteReminders({
    currentUser: sampleCoordinator,
    effectiveRole: 'coordinator',
    homeworkList: hwList,
    todayAttendanceMarkedCount: 12,
    totalCohortStudentsCount: 25,
    ignorePersistedState: true
  });
  assert.ok(coordReminders.some(r => r.type === 'faculty_attendance'));
  assert.ok(coordReminders.some(r => r.type === 'coordinator_alert'));
});

runTest('Backend AI client strictly locks providers to APInex, Ministral, and Groq (no Gemini)', () => {
  const aiClientPath = path.resolve(process.cwd(), 'server/aiClient.ts');
  const content = fs.readFileSync(aiClientPath, 'utf8');
  assert.equal(content.includes('@google/genai'), false);
  assert.equal(content.includes('getGeminiClient'), false);
  assert.equal(content.includes('getGeminiApiKey'), false);
  assert.ok(content.includes("'apinex'") && content.includes("'groq'") && content.includes("'ministral'"));
});

console.log(`\n🎉 All ${passed} Experience Upgrade tests passed!`);
