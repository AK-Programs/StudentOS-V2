/**
 * @file tests/engagementSystem2.test.ts
 * Automated Verification Suite for Veylentra Attention, Engagement & Retention System 2.0
 * Covers Student, Faculty (Teacher + Coordinator), Admin/Super Admin, Celebrations, Timezone & Integrity tests.
 */

import assert from 'node:assert/strict';
import http from 'node:http';
import { app } from '../server';
import {
  evaluateStreakTransition,
  executeVerifiedStreakRecovery,
  recordVerifiedActivity,
  evaluateMissionsForRecord,
  formatDateInTimezone,
  diffCalendarDays,
  getWeekPeriodKey,
  computeLevelBreakdown,
  __seedStreakRecordForTests,
  __resetEngagementEngineMemoryForTests,
  ServerStreakRecord,
  EngagementPolicyConfig,
} from '../server/engagementEngine';
import { resolveApplicableMissionDefinitions } from '../src/lib/roleTaskRegistry';
import {
  seedCelebrationBaseline,
  dispatchLevelUpIfNew,
  dispatchRegularBadgesIfNew,
} from '../src/lib/engagementService';

const TEST_POLICY: EngagementPolicyConfig = {
  version: 1,
  updatedAt: '2026-11-19T00:00:00.000Z',
  updatedBy: 'System',
  streakRecoveryEnabled: true,
  maxMissedDaysForRecovery: 2,
  requiredRecoveryActivity: 'review_flashcards_or_quiz',
  recoveryRequiredCount: 5,
  recoveryCooldownDays: 7,
  maxRecoveriesPerMonth: 2,
  defaultTimezone: 'Asia/Kolkata',
  weeklyStudentXpGoal: 300,
  weeklyFacultyActionsGoal: 12,
  maxVisibleFlyouts: 1,
  flyoutCooldownSeconds: 45,
  defaultBroadcastTtlHours: 72,
  featureFlags: {
    dailyMissions: true,
    streakRecovery: true,
    levelUpCelebration: true,
    badgeCelebration: true,
    smartReturn: true,
    facultyChecklists: true,
    adminOpsTasks: true,
  },
};

function makeRecord(overrides: Partial<ServerStreakRecord> = {}): ServerStreakRecord {
  return {
    userId: 'stu_1',
    currentStreak: 0,
    longestStreak: 0,
    streakState: 'active',
    frozenStreakCount: 0,
    lastActiveDate: null,
    timezone: 'Asia/Kolkata',
    recoveryDeadline: null,
    recoveryLastUsedAt: null,
    recoveriesThisMonth: 0,
    recoveryMonthKey: '2026-11',
    recoveryCurrentProgress: 0,
    recoveryActivityDates: {},
    claimedMissions: {},
    history: [],
    recentReturnContext: null,
    updatedAt: '2026-11-19T00:00:00.000Z',
    ...overrides,
  };
}

async function main() {
  let passed = 0;
  const run = async (name: string, fn: () => Promise<void> | void) => {
    await fn();
    console.log(`✅ ${name}`);
    passed++;
  };

  __resetEngagementEngineMemoryForTests();

  const server: http.Server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  const addr = server.address() as any;
  const baseUrl = `http://127.0.0.1:${addr.port}`;

  try {
    // =========================================================================
    // STUDENT LIFECYCLE & RECOVERY TESTS
    // =========================================================================
    await run('Student 1: Brand new student with 0 streak reports exact 0 (never 8 or 1)', async () => {
      const res = await fetch(`${baseUrl}/api/engagement/overview`, {
        headers: { 'x-veylentra-uid': 'stu_brand_new', 'x-veylentra-role': 'student' },
      });
      assert.equal(res.status, 200);
      const body = await res.json();
      assert.equal(body.overview.streak.currentStreak, 0);
      assert.equal(body.overview.streak.longestStreak, 0);
      assert.equal(body.overview.streak.streakState, 'active');
    });

    await run('Student 2: Active streak increments cleanly once per calendar day', () => {
      const day1 = Date.UTC(2026, 10, 18, 10, 0, 0);
      const day2 = Date.UTC(2026, 10, 19, 10, 0, 0);
      let rec = makeRecord({ userId: 'stu_active' });

      const r1 = recordVerifiedActivity(rec, TEST_POLICY, { activityType: 'flashcards', count: 3 }, day1);
      assert.equal(r1.record.currentStreak, 1);
      assert.equal(r1.streakIncremented, true);

      // Same calendar day repeat activity must NOT double-increment streak
      const r1Repeat = recordVerifiedActivity(r1.record, TEST_POLICY, { activityType: 'quiz', count: 1 }, day1 + 3600000);
      assert.equal(r1Repeat.record.currentStreak, 1);
      assert.equal(r1Repeat.streakIncremented, false);

      // Next day increments to 2
      const r2 = recordVerifiedActivity(r1Repeat.record, TEST_POLICY, { activityType: 'homework', count: 1 }, day2);
      assert.equal(r2.record.currentStreak, 2);
      assert.equal(r2.record.longestStreak, 2);
      assert.equal(r2.streakIncremented, true);
    });

    await run('Student 3: Missing 1 day sets streakState to at_risk without wiping streak', () => {
      const todayMs = Date.UTC(2026, 10, 19, 10, 0, 0); // 2026-11-19 IST
      const rec = makeRecord({
        currentStreak: 14,
        longestStreak: 14,
        lastActiveDate: '2026-11-18',
      });
      const ev = evaluateStreakTransition(rec, TEST_POLICY, todayMs);
      assert.equal(ev.record.streakState, 'at_risk');
      assert.equal(ev.record.currentStreak, 14);
    });

    await run('Student 4-7: Missing 2 days freezes streak, rejects 1-click spoof recovery (400), accepts verified recovery (200), blocks duplicate (409)', async () => {
      const nowMs = Date.now();
      const tz = 'Asia/Kolkata';
      // 2 calendar days ago -> missedFullDays = 1 <= maxMissedDaysForRecovery (2)
      const twoDaysAgoYmd = formatDateInTimezone(nowMs - 2 * 86400000, tz);

      __seedStreakRecordForTests(
        makeRecord({
          userId: 'stu_frozen_1',
          currentStreak: 11,
          longestStreak: 11,
          lastActiveDate: twoDaysAgoYmd,
          recoveryMonthKey: formatDateInTimezone(nowMs, tz).slice(0, 7),
        })
      );

      // 4a. Overview automatically freezes streak into recovery_available
      const ovRes = await fetch(`${baseUrl}/api/engagement/overview`, {
        headers: { 'x-veylentra-uid': 'stu_frozen_1', 'x-veylentra-role': 'student' },
      });
      const ovBody = await ovRes.json();
      assert.equal(ovBody.overview.streak.streakState, 'recovery_available');
      assert.equal(ovBody.overview.streak.frozenStreakCount, 11);
      assert.equal(ovBody.overview.streak.recoveryEligible, true);

      // 4b. Unverified 1-click recovery attempt MUST fail with 400
      const spoofRes = await fetch(`${baseUrl}/api/engagement/streak/recover`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-veylentra-uid': 'stu_frozen_1',
          'x-veylentra-role': 'student',
        },
        body: JSON.stringify({}),
      });
      assert.equal(spoofRes.status, 400);

      // 4c. Complete 5 verified flashcards first
      const actRes = await fetch(`${baseUrl}/api/engagement/activity`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-veylentra-uid': 'stu_frozen_1',
          'x-veylentra-role': 'student',
        },
        body: JSON.stringify({ activityType: 'flashcards', count: 5 }),
      });
      assert.equal(actRes.status, 200);
      const actBody = await actRes.json();
      assert.equal(actBody.streak.recoveryCurrentProgress, 5);

      // 4d. Verified recovery succeeds and restores 11 -> 12
      const recRes = await fetch(`${baseUrl}/api/engagement/streak/recover`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-veylentra-uid': 'stu_frozen_1',
          'x-veylentra-role': 'student',
        },
        body: JSON.stringify({ activityType: 'flashcards' }),
      });
      assert.equal(recRes.status, 200);
      const recBody = await recRes.json();
      assert.equal(recBody.restoredFrom, 11);
      assert.equal(recBody.newStreak, 12);
      assert.equal(recBody.streakState, 'recovered');
      assert.equal(recBody.xpRewarded, 35);

      // 4e. Duplicate recovery claim rejected with 409
      const dupRes = await fetch(`${baseUrl}/api/engagement/streak/recover`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-veylentra-uid': 'stu_frozen_1',
          'x-veylentra-role': 'student',
        },
        body: JSON.stringify({ activityType: 'flashcards' }),
      });
      assert.equal(dupRes.status, 409);
    });

    await run('Student 8: Exceeding grace window expires streak cleanly while preserving longestStreak', () => {
      const nowMs = Date.UTC(2026, 10, 19, 10, 0, 0);
      const rec = makeRecord({
        currentStreak: 19,
        longestStreak: 19,
        lastActiveDate: '2026-11-12', // 7-day gap > 2 missed days
      });
      const ev = evaluateStreakTransition(rec, TEST_POLICY, nowMs);
      assert.equal(ev.record.streakState, 'expired');
      assert.equal(ev.record.currentStreak, 0);
      assert.equal(ev.record.longestStreak, 19);
      assert.equal(ev.recoveryEligible, false);

      const attempt = executeVerifiedStreakRecovery(ev.record, TEST_POLICY, { activityType: 'flashcards', verifiedCount: 5 }, nowMs);
      assert.equal(attempt.ok, false);
      assert.equal(attempt.status, 400);
    });

    await run('Student 9: Recovery cooldown & monthly cap enforced server-side', () => {
      const nowMs = Date.UTC(2026, 10, 19, 10, 0, 0);
      const recCooldown = makeRecord({
        currentStreak: 6,
        longestStreak: 6,
        lastActiveDate: '2026-11-17',
        recoveryLastUsedAt: new Date(nowMs - 2 * 86400000).toISOString(),
        recoveriesThisMonth: 1,
        recoveryMonthKey: '2026-11',
      });
      const evCd = evaluateStreakTransition(recCooldown, TEST_POLICY, nowMs);
      assert.equal(evCd.recoveryEligible, false);
      assert.match(evCd.recoveryBlockedReason || '', /cooldown/i);

      const recCap = makeRecord({
        currentStreak: 6,
        longestStreak: 6,
        lastActiveDate: '2026-11-17',
        recoveryLastUsedAt: new Date(nowMs - 20 * 86400000).toISOString(),
        recoveriesThisMonth: 2,
        recoveryMonthKey: '2026-11',
      });
      const evCap = evaluateStreakTransition(recCap, TEST_POLICY, nowMs);
      assert.equal(evCap.recoveryEligible, false);
      assert.match(evCap.recoveryBlockedReason || '', /monthly recovery limit/i);
    });

    await run('Student 10: Daily mission completion, server XP reward claim, and duplicate period claim block (409)', async () => {
      // Claiming before completion returns 400
      const earlyClaim = await fetch(`${baseUrl}/api/engagement/missions/claim`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-veylentra-uid': 'stu_mission_1',
          'x-veylentra-role': 'student',
        },
        body: JSON.stringify({ missionId: 'student_daily_study_checkin', role: 'student' }),
      });
      assert.equal(earlyClaim.status, 400);

      // Record flashcard sprint (count: 5 completes both daily check-in and flashcard sprint)
      await fetch(`${baseUrl}/api/engagement/activity`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-veylentra-uid': 'stu_mission_1',
          'x-veylentra-role': 'student',
        },
        body: JSON.stringify({ activityType: 'flashcards', count: 5 }),
      });

      const claim1 = await fetch(`${baseUrl}/api/engagement/missions/claim`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-veylentra-uid': 'stu_mission_1',
          'x-veylentra-role': 'student',
        },
        body: JSON.stringify({ missionId: 'student_daily_study_checkin', role: 'student' }),
      });
      assert.equal(claim1.status, 200);
      const claim1Body = await claim1.json();
      assert.equal(claim1Body.xpAwarded, 25);

      const claimDup = await fetch(`${baseUrl}/api/engagement/missions/claim`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-veylentra-uid': 'stu_mission_1',
          'x-veylentra-role': 'student',
        },
        body: JSON.stringify({ missionId: 'student_daily_study_checkin', role: 'student' }),
      });
      assert.equal(claimDup.status, 409);
    });

    await run('Student 11: Level calculation & per-user celebration deduplication never replay historical rewards on reload or account switch', () => {
      const lvl = computeLevelBreakdown(460);
      assert.equal(lvl.level, 4);
      assert.equal(lvl.levelTitle, 'Focused Scholar');

      // Seed historical baseline as happens on initial load / reload
      seedCelebrationBaseline('stu_cel_1', 4, ['first_login', 'week_warrior']);
      assert.equal(
        dispatchLevelUpIfNew('stu_cel_1', 3, { level: 4, title: 'Focused Scholar', minXp: 450, icon: '🎓', color: 'indigo' }, 460),
        false,
        'Historical level must not replay'
      );
      assert.equal(
        dispatchRegularBadgesIfNew('stu_cel_1', [{ id: 'first_login', name: 'First Login', description: '', icon: '', category: 'study', xpBonus: 10 } as any]),
        false,
        'Historical badge must not replay'
      );

      // Genuine progression unlocks trigger once and never duplicate
      assert.equal(
        dispatchLevelUpIfNew('stu_cel_1', 4, { level: 5, title: 'Knowledge Builder', minXp: 700, icon: '⚡', color: 'amber' }, 710),
        true
      );
      assert.equal(
        dispatchLevelUpIfNew('stu_cel_1', 4, { level: 5, title: 'Knowledge Builder', minXp: 700, icon: '⚡', color: 'amber' }, 710),
        false,
        'Duplicate level 5 blocked'
      );

      assert.equal(
        dispatchRegularBadgesIfNew('stu_cel_1', [{ id: 'honor_scholar', name: 'Honor Scholar', description: '', icon: '', category: 'milestone', xpBonus: 50 } as any]),
        true
      );
      assert.equal(
        dispatchRegularBadgesIfNew('stu_cel_1', [{ id: 'honor_scholar', name: 'Honor Scholar', description: '', icon: '', category: 'milestone', xpBonus: 50 } as any]),
        false
      );

      // Account switch isolation: User B can still earn honor_scholar
      seedCelebrationBaseline('stu_cel_2', 1, []);
      assert.equal(
        dispatchRegularBadgesIfNew('stu_cel_2', [{ id: 'honor_scholar', name: 'Honor Scholar', description: '', icon: '', category: 'milestone', xpBonus: 50 } as any]),
        true
      );
    });

    // =========================================================================
    // FACULTY TESTS (TEACHER & COORDINATOR)
    // =========================================================================
    await run('Faculty 1 & 2: Teacher receives classroom missions, completes attendance/grading, zero student study tasks', async () => {
      const ovRes = await fetch(`${baseUrl}/api/engagement/overview`, {
        headers: { 'x-veylentra-uid': 'teacher_test_1', 'x-veylentra-role': 'teacher' },
      });
      const ovBody = await ovRes.json();
      assert.equal(ovBody.overview.smartReturn, null, 'Teachers should not receive student Smart Return study banner');
      assert.ok(ovBody.overview.missions.every((m: any) => m.category !== 'study'));
      assert.ok(ovBody.overview.missions.some((m: any) => m.id === 'teacher_daily_attendance'));
      assert.ok(ovBody.overview.missions.some((m: any) => m.id === 'teacher_evaluate_submissions'));

      // Teacher cannot claim student mission
      const crossClaim = await fetch(`${baseUrl}/api/engagement/missions/claim`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-veylentra-uid': 'teacher_test_1',
          'x-veylentra-role': 'teacher',
        },
        body: JSON.stringify({ missionId: 'student_flashcard_sprint', role: 'teacher' }),
      });
      assert.equal(crossClaim.status, 404);

      // Teacher completes attendance action -> mission completed & claimable
      await fetch(`${baseUrl}/api/engagement/activity`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-veylentra-uid': 'teacher_test_1',
          'x-veylentra-role': 'teacher',
        },
        body: JSON.stringify({ activityType: 'attendance_mark', count: 1 }),
      });
      const claimRes = await fetch(`${baseUrl}/api/engagement/missions/claim`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-veylentra-uid': 'teacher_test_1',
          'x-veylentra-role': 'teacher',
        },
        body: JSON.stringify({ missionId: 'teacher_daily_attendance', role: 'teacher' }),
      });
      assert.equal(claimRes.status, 200);
      const claimBody = await claimRes.json();
      assert.equal(claimBody.xpAwarded, 25);
    });

    await run('Faculty 3 & 4: Coordinator oversight missions & multi-role deduplication', () => {
      const coordMissions = resolveApplicableMissionDefinitions(['coordinator']);
      assert.ok(coordMissions.every(m => m.category === 'oversight'));
      assert.equal(coordMissions.some(m => m.id.startsWith('student_')), false);

      const multiMissions = resolveApplicableMissionDefinitions(['teacher', 'coordinator']);
      const ids = multiMissions.map(m => m.id);
      assert.equal(ids.length, new Set(ids).size, 'Multi-role mission list must contain zero duplicates');
      assert.ok(ids.includes('teacher_daily_attendance'));
      assert.ok(ids.includes('coordinator_cohort_attendance_audit'));
    });

    // =========================================================================
    // ADMIN, SUPER ADMIN & POLICY GOVERNANCE TESTS
    // =========================================================================
    await run('Admin 1-3: Admin & Super Admin receive operational tasks only and accurate diverse streaks (0, 8, 14, 25, 50)', async () => {
      for (const expectedStreak of [0, 8, 14, 25, 50]) {
        const uid = `admin_streak_${expectedStreak}`;
        const todayYmd = formatDateInTimezone(Date.now(), 'Asia/Kolkata');
        __seedStreakRecordForTests(
          makeRecord({
            userId: uid,
            currentStreak: expectedStreak,
            longestStreak: expectedStreak,
            lastActiveDate: expectedStreak > 0 ? todayYmd : null,
          })
        );
        const res = await fetch(`${baseUrl}/api/engagement/overview`, {
          headers: { 'x-veylentra-uid': uid, 'x-veylentra-role': 'admin' },
        });
        const body = await res.json();
        assert.equal(body.overview.streak.currentStreak, expectedStreak);
        assert.ok(body.overview.missions.every((m: any) => m.category === 'operations'));
        assert.equal(body.overview.missions.some((m: any) => m.category === 'study'), false);
      }

      const superMissions = resolveApplicableMissionDefinitions(['super_admin']);
      assert.ok(superMissions.every(m => m.category === 'operations'));
      assert.equal(superMissions.some(m => m.category === 'study'), false);
    });

    await run('Admin 4: Non-admin roles blocked (403) from policy config & audit logs; Super Admin guards featureFlags', async () => {
      const studentPost = await fetch(`${baseUrl}/api/engagement/config`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-veylentra-uid': 'stu_1',
          'x-veylentra-role': 'student',
        },
        body: JSON.stringify({ config: { weeklyStudentXpGoal: 9999 } }),
      });
      assert.equal(studentPost.status, 403);

      const teacherAudit = await fetch(`${baseUrl}/api/engagement/audit`, {
        headers: { 'x-veylentra-uid': 'teacher_1', 'x-veylentra-role': 'teacher' },
      });
      assert.equal(teacherAudit.status, 403);

      // Institution admin can update weeklyStudentXpGoal, but featureFlags remain protected
      const adminUpdate = await fetch(`${baseUrl}/api/engagement/config`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-veylentra-uid': 'inst_admin_1',
          'x-veylentra-role': 'admin',
        },
        body: JSON.stringify({
          config: {
            weeklyStudentXpGoal: 420,
            featureFlags: { dailyMissions: false },
          },
        }),
      });
      assert.equal(adminUpdate.status, 200);
      const adminJson = await adminUpdate.json();
      assert.equal(adminJson.config.weeklyStudentXpGoal, 420);
      assert.equal(adminJson.config.featureFlags.dailyMissions, true, 'Only Super Admin may modify featureFlags');

      // Super Admin can toggle featureFlags and audit log captures immutable history
      const superUpdate = await fetch(`${baseUrl}/api/engagement/config`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-veylentra-uid': 'super_admin_1',
          'x-veylentra-role': 'super_admin',
        },
        body: JSON.stringify({
          config: {
            featureFlags: { smartReturn: false },
          },
        }),
      });
      assert.equal(superUpdate.status, 200);
      const superJson = await superUpdate.json();
      assert.equal(superJson.config.featureFlags.smartReturn, false);
      assert.ok(superJson.config.version >= 3);

      const auditRes = await fetch(`${baseUrl}/api/engagement/audit`, {
        headers: { 'x-veylentra-uid': 'super_admin_1', 'x-veylentra-role': 'super_admin' },
      });
      assert.equal(auditRes.status, 200);
      const auditJson = await auditRes.json();
      assert.ok(auditJson.logs.length >= 2);
    });

    // =========================================================================
    // DATA INTEGRITY & TIMEZONE BOUNDARY TESTS
    // =========================================================================
    await run('Integrity 1: Cross-account activity & recovery mutation rejected with 403', async () => {
      const actRes = await fetch(`${baseUrl}/api/engagement/activity`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-veylentra-uid': 'stu_actor_a',
          'x-veylentra-role': 'student',
        },
        body: JSON.stringify({ userId: 'stu_victim_b', activityType: 'flashcards', count: 5 }),
      });
      assert.equal(actRes.status, 403);

      const recRes = await fetch(`${baseUrl}/api/engagement/streak/recover`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-veylentra-uid': 'stu_actor_a',
          'x-veylentra-role': 'student',
        },
        body: JSON.stringify({ userId: 'stu_victim_b', activityType: 'flashcards' }),
      });
      assert.equal(recRes.status, 403);

      const claimRes = await fetch(`${baseUrl}/api/engagement/missions/claim`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-veylentra-uid': 'stu_actor_a',
          'x-veylentra-role': 'student',
        },
        body: JSON.stringify({ userId: 'stu_victim_b', missionId: 'student_daily_study_checkin' }),
      });
      assert.equal(claimRes.status, 403);
    });

    await run('Integrity 2: Timezone calendar day boundaries (IST vs UTC vs EST) and ISO week keys evaluate accurately', () => {
      // 2026-11-19T20:00:00Z -> Nov 19 in UTC, Nov 20 in Asia/Kolkata (+05:30), Nov 19 in America/New_York
      const instant = Date.UTC(2026, 10, 19, 20, 0, 0);
      assert.equal(formatDateInTimezone(instant, 'UTC'), '2026-11-19');
      assert.equal(formatDateInTimezone(instant, 'Asia/Kolkata'), '2026-11-20');
      assert.equal(formatDateInTimezone(instant, 'America/New_York'), '2026-11-19');

      assert.equal(diffCalendarDays('2026-11-18', '2026-11-19'), 1);
      assert.equal(diffCalendarDays('2026-11-16', '2026-11-19'), 3);
      assert.equal(getWeekPeriodKey('2026-11-19'), getWeekPeriodKey('2026-11-20'));

      // Verify evaluateMissionsForRecord isolates daily progress across dates cleanly
      const rec = makeRecord({
        recoveryActivityDates: {
          '2026-11-18': { flashcards: 5, quizzes: 0, studyMinutes: 0, actions: 1, missionProgress: { student_flashcard_sprint: 5 } },
          '2026-11-19': { flashcards: 2, quizzes: 0, studyMinutes: 0, actions: 1, missionProgress: { student_flashcard_sprint: 2 } },
        },
      });
      const missions = evaluateMissionsForRecord('student', rec, '2026-11-19');
      const sprint = missions.find(m => m.id === 'student_flashcard_sprint')!;
      assert.equal(sprint.progressValue, 2);
      assert.equal(sprint.status, 'in_progress');
    });

    console.log(`\n🎉 Engagement System 2.0 Verification Complete: ${passed}/${passed} checks passed.`);
  } finally {
    server.close();
  }
  process.exit(0);
}

main().catch((err) => {
  console.error('❌ Engagement System 2.0 test failure:', err);
  process.exit(1);
});
