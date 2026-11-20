/**
 * @file tests/workflowEngagement2_1.test.ts
 * Automated Verification Suite: Attention & Retention System 2.1
 * Validates:
 * 1. Admin task navigation vs real completion (Issue 1)
 * 2. Teacher attendance synchronization (Issue 2)
 * 3. Role-aware streak recovery for Faculty, Admin, and Student (Issue 3)
 * 4. Idempotent reward claiming and prevention of duplicate claims
 * 5. Notification spam guard preservation
 */

import assert from 'node:assert/strict';
import {
  DEFAULT_POLICY_CONFIG,
  ServerStreakRecord,
  executeVerifiedStreakRecovery,
  recordVerifiedActivity,
  evaluateMissionsForRecord,
  getRecoveryProgressForDate,
  __resetEngagementEngineMemoryForTests,
} from '../server/engagementEngine';
import { resolveApplicableMissionDefinitions } from '../src/lib/roleTaskRegistry';
import { hasTeacherRecordedAttendanceToday } from '../server/academicWorkflowModule';

async function runTests() {
  console.log('--- STARTING RETENTION SYSTEM 2.1 TEST SUITE ---');

  __resetEngagementEngineMemoryForTests();

  // --------------------------------------------------------------------------
  // TEST 1: Admin Task Navigation & Real Workflow Completion (Issue 1)
  // --------------------------------------------------------------------------
  console.log('Testing Issue 1: Admin Task Navigation & Real Workflow Completion...');
  {
    const adminMissions = resolveApplicableMissionDefinitions(['admin']);
    const approvalsMission = adminMissions.find(m => m.id === 'admin_approvals_queue_review');
    const auditMission = adminMissions.find(m => m.id === 'admin_policy_broadcast_audit');

    assert.ok(approvalsMission, 'approvalsMission must exist');
    assert.equal(approvalsMission.actionTab, 'admin');
    assert.equal(approvalsMission.actionSubTab, 'requests');

    assert.ok(auditMission, 'auditMission must exist');
    assert.equal(auditMission.actionTab, 'admin');
    assert.equal(auditMission.actionSubTab, 'engagement_policies');

    const today = '2026-11-20';
    const record: ServerStreakRecord = {
      userId: 'admin_test_01',
      currentStreak: 4,
      longestStreak: 10,
      streakState: 'active',
      frozenStreakCount: 0,
      lastActiveDate: today,
      timezone: 'UTC',
      recoveryDeadline: null,
      recoveryLastUsedAt: null,
      recoveriesThisMonth: 0,
      recoveryMonthKey: null,
      recoveryCurrentProgress: 0,
      recoveryActivityDates: {},
      claimedMissions: {},
      history: [],
      recentReturnContext: null,
      updatedAt: new Date().toISOString(),
    };

    // 1. Initial state: progress is 0, status is available (navigation alone does NOT complete the task)
    let evaluated = evaluateMissionsForRecord('admin', record, today);
    const initialTask = evaluated.find(m => m.id === 'admin_approvals_queue_review');
    assert.equal(initialTask?.status, 'available');
    assert.equal(initialTask?.progressValue, 0);

    // 2. Admin performs an actual verified governance / approvals action
    const actResult = recordVerifiedActivity(record, DEFAULT_POLICY_CONFIG, {
      activityType: 'admin_audit',
      count: 1,
    });

    // 3. Task is now completed and ready to claim
    evaluated = evaluateMissionsForRecord('admin', actResult.record, today);
    const completedTask = evaluated.find(m => m.id === 'admin_approvals_queue_review');
    assert.equal(completedTask?.status, 'completed');
    assert.equal(completedTask?.progressValue, 1);
    console.log('✓ Issue 1 passed: Admin navigation mapped to subtabs and completion tied to real admin action.');
  }

  // --------------------------------------------------------------------------
  // TEST 2: Teacher Attendance Synchronization (Issue 2)
  // --------------------------------------------------------------------------
  console.log('Testing Issue 2: Teacher Attendance Workflow Synchronization...');
  {
    const teacherMissions = resolveApplicableMissionDefinitions(['teacher']);
    const attMission = teacherMissions.find(m => m.id === 'teacher_daily_attendance');
    assert.ok(attMission, 'teacher_daily_attendance must exist');
    assert.equal(attMission.actionTab, 'attendance_manager');

    const today = '2026-11-20';
    const record: ServerStreakRecord = {
      userId: 'teacher_smith',
      currentStreak: 5,
      longestStreak: 12,
      streakState: 'active',
      frozenStreakCount: 0,
      lastActiveDate: '2026-11-19',
      timezone: 'UTC',
      recoveryDeadline: null,
      recoveryLastUsedAt: null,
      recoveriesThisMonth: 0,
      recoveryMonthKey: null,
      recoveryCurrentProgress: 0,
      recoveryActivityDates: {},
      claimedMissions: {},
      history: [],
      recentReturnContext: null,
      updatedAt: new Date().toISOString(),
    };

    // Mark attendance
    const actResult = recordVerifiedActivity(record, DEFAULT_POLICY_CONFIG, {
      activityType: 'attendance_mark',
      count: 1,
    });

    assert.equal(actResult.streakIncremented, true, 'Streak should increment on first activity of the day');
    assert.equal(actResult.record.currentStreak, 6);

    const missions = evaluateMissionsForRecord('teacher', actResult.record, today);
    const attTask = missions.find(m => m.id === 'teacher_daily_attendance');
    assert.equal(attTask?.status, 'completed');
    assert.equal(attTask?.progressValue, 1);

    // Idempotent claiming simulation
    const claimKey = `teacher_daily_attendance:${today}`;
    actResult.record.claimedMissions[claimKey] = {
      claimedAt: new Date().toISOString(),
      xpAwarded: 25,
    };

    const claimedMissions = evaluateMissionsForRecord('teacher', actResult.record, today);
    const claimedTask = claimedMissions.find(m => m.id === 'teacher_daily_attendance');
    assert.equal(claimedTask?.status, 'claimed');
    console.log('✓ Issue 2 passed: Teacher attendance synchronizes to task completion with idempotent claims.');
  }

  // --------------------------------------------------------------------------
  // TEST 3: Role-Aware Streak Recovery (Issue 3)
  // --------------------------------------------------------------------------
  console.log('Testing Issue 3: Role-Aware Streak Recovery for Teacher, Admin, and Student...');
  {
    const makeFrozenRecord = (userId: string, frozenStreak: number): ServerStreakRecord => {
      return {
        userId,
        currentStreak: 0,
        longestStreak: frozenStreak + 3,
        streakState: 'frozen',
        frozenStreakCount: frozenStreak,
        lastActiveDate: '2026-11-18', // 2 days ago
        timezone: 'UTC',
        recoveryDeadline: new Date(Date.now() + 86400000).toISOString(),
        recoveryLastUsedAt: null,
        recoveriesThisMonth: 0,
        recoveryMonthKey: null,
        recoveryCurrentProgress: 0,
        recoveryActivityDates: {},
        claimedMissions: {},
        history: [],
        recentReturnContext: null,
        updatedAt: new Date().toISOString(),
      };
    };

    const today = '2026-11-20';

    // A. Teacher Recovery
    const teacherRec = makeFrozenRecord('teacher_jones', 7);
    const teacherFail = executeVerifiedStreakRecovery(teacherRec, DEFAULT_POLICY_CONFIG, {
      activityType: 'attendance_mark',
      verifiedCount: 0,
      role: 'teacher',
    });
    assert.equal(teacherFail.ok, false);
    assert.ok(teacherFail.error?.includes('Complete at least 1 attendance or grading workflow actions'));

    const teacherAct = recordVerifiedActivity(teacherRec, DEFAULT_POLICY_CONFIG, {
      activityType: 'attendance_mark',
      count: 1,
    });
    const teacherSuccess = executeVerifiedStreakRecovery(teacherAct.record, DEFAULT_POLICY_CONFIG, {
      activityType: 'attendance_mark',
      verifiedCount: 1,
      role: 'teacher',
    });
    assert.equal(teacherSuccess.ok, true);
    assert.equal(teacherSuccess.restoredFrom, 7);
    assert.equal(teacherSuccess.newStreak, 8);
    assert.equal(teacherSuccess.record.streakState, 'recovered');

    // Duplicate recovery rejected
    const teacherDup = executeVerifiedStreakRecovery(teacherSuccess.record, DEFAULT_POLICY_CONFIG, {
      activityType: 'attendance_mark',
      verifiedCount: 1,
      role: 'teacher',
    });
    assert.equal(teacherDup.ok, false);
    assert.equal(teacherDup.status, 409);

    // B. Admin Recovery
    const adminRec = makeFrozenRecord('admin_principal', 14);
    const adminAct = recordVerifiedActivity(adminRec, DEFAULT_POLICY_CONFIG, {
      activityType: 'admin_audit',
      count: 1,
    });
    const adminSuccess = executeVerifiedStreakRecovery(adminAct.record, DEFAULT_POLICY_CONFIG, {
      activityType: 'admin_audit',
      verifiedCount: 1,
      role: 'admin',
    });
    assert.equal(adminSuccess.ok, true);
    assert.equal(adminSuccess.restoredFrom, 14);
    assert.equal(adminSuccess.newStreak, 15);
    assert.equal(adminSuccess.record.streakState, 'recovered');

    // C. Student Recovery requires 5 steps
    const studentRec = makeFrozenRecord('student_alex', 5);
    const studentActPartial = recordVerifiedActivity(studentRec, DEFAULT_POLICY_CONFIG, {
      activityType: 'flashcards',
      count: 3,
    });
    const studentFail = executeVerifiedStreakRecovery(studentActPartial.record, DEFAULT_POLICY_CONFIG, {
      activityType: 'flashcards',
      verifiedCount: 3,
      role: 'student',
    });
    assert.equal(studentFail.ok, false);
    assert.ok(studentFail.error?.includes('3/5'));

    const studentActFull = recordVerifiedActivity(studentActPartial.record, DEFAULT_POLICY_CONFIG, {
      activityType: 'flashcards',
      count: 2,
    });
    const studentSuccess = executeVerifiedStreakRecovery(studentActFull.record, DEFAULT_POLICY_CONFIG, {
      activityType: 'flashcards',
      verifiedCount: 5,
      role: 'student',
    });
    assert.equal(studentSuccess.ok, true);
    assert.equal(studentSuccess.restoredFrom, 5);
    assert.equal(studentSuccess.newStreak, 6);
    assert.equal(studentSuccess.record.streakState, 'recovered');
    console.log('✓ Issue 3 passed: Streak recovery is decoupled per role with verified monotonic restoration.');
  }

  // --------------------------------------------------------------------------
  // TEST 4: Notification Spam Guard Preservation
  // --------------------------------------------------------------------------
  console.log('Testing Notification Spam Guard Preservation...');
  {
    assert.equal(DEFAULT_POLICY_CONFIG.maxVisibleFlyouts, 1);
    assert.equal(DEFAULT_POLICY_CONFIG.streakRecoveryEnabled, true);
    assert.equal(DEFAULT_POLICY_CONFIG.featureFlags.streakRecovery, true);
    console.log('✓ Anti-spam policy limits preserved (maxVisibleFlyouts: 1).');
  }

  console.log('\n ALL RETENTION SYSTEM 2.1 TESTS PASSED SUCCESSFULLY! \n');
}

runTests().catch(err => {
  console.error('Test run failed:', err);
  process.exit(1);
});
