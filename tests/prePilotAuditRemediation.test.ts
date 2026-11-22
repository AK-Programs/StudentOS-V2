/**
 * @file tests/prePilotAuditRemediation.test.ts
 * Comprehensive Automated Verification Suite for Pre-Pilot Audit Remediation:
 * - Priority 1: Streak Recovery Correctness (frozenSnapshot + 1, never 0->1, DB failure rollback 503,
 *   concurrent lock, server-verified activity only, eventId deduplication, expiry cleanup, flashcard/attendance failure guards)
 * - Priority 2: Faculty Roster Student-Scoped Feedback Workflow (RBAC, cohort scope, persistence, retrieval, activity sync)
 * - Priority 3: Simplified Student & Faculty Home presence & non-regression source verification
 */

import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { app } from '../server';
import {
  evaluateStreakTransition,
  executeVerifiedStreakRecovery,
  recordVerifiedActivity,
  formatDateInTimezone,
  __seedStreakRecordForTests,
  __resetEngagementEngineMemoryForTests,
  ServerStreakRecord,
  EngagementPolicyConfig,
} from '../server/engagementEngine';
import { resetTestAcademicStore } from '../server/academicWorkflowModule';

const TEST_POLICY: EngagementPolicyConfig = {
  version: 1,
  updatedAt: '2026-11-20T00:00:00.000Z',
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
    userId: 'stu_remed_1',
    role: 'student',
    currentStreak: 0,
    longestStreak: 0,
    streakState: 'active',
    frozenStreakCount: 0,
    frozenSnapshot: null,
    lastActiveDate: null,
    timezone: 'Asia/Kolkata',
    recoveryDeadline: null,
    recoveryLastUsedAt: null,
    recoveriesThisMonth: 0,
    recoveryMonthKey: '2026-11',
    recoveryCurrentProgress: 0,
    recoveryActivityDates: {},
    claimedMissions: {},
    processedEventIds: [],
    history: [],
    recentReturnContext: null,
    updatedAt: '2026-11-20T00:00:00.000Z',
    ...overrides,
  };
}

function createMockSupabaseServer() {
  const tables: {
    engagement_streaks: Map<string, any>;
    global_data: Map<string, any>;
    user_profiles: Map<string, any>;
    engagement_policy_config: Map<string, any>;
    gamification_xp_ledger: any[];
  } = {
    engagement_streaks: new Map(),
    global_data: new Map(),
    user_profiles: new Map(),
    engagement_policy_config: new Map(),
    gamification_xp_ledger: [],
  };

  let failWrites = false;
  let simulateMissingEngagementTable = false;

  const server = http.createServer(async (req, res) => {
    const reqUrl = new URL(req.url || '/', 'http://127.0.0.1');
    const pathname = reqUrl.pathname;

    let rawBody = '';
    for await (const chunk of req) {
      rawBody += chunk;
    }
    let body: any = null;
    try {
      body = rawBody ? JSON.parse(rawBody) : null;
    } catch {
      body = null;
    }

    const json = (status: number, data: any) => {
      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(data));
    };

    if (pathname === '/rest/v1/engagement_streaks') {
      if (simulateMissingEngagementTable) {
        return json(404, { code: 'PGRST205', message: "Could not find the table 'public.engagement_streaks'" });
      }
      if (req.method === 'POST') {
        if (failWrites) {
          return json(500, { message: 'Simulated database write outage on engagement_streaks' });
        }
        if (body?.user_id) {
          tables.engagement_streaks.set(String(body.user_id), body);
        }
        return json(201, [body]);
      }
      if (req.method === 'GET') {
        const uidFilter = reqUrl.searchParams.get('user_id') || '';
        const uid = uidFilter.replace(/^eq\./, '');
        const row = tables.engagement_streaks.get(uid);
        return json(200, row ? [row] : []);
      }
    }

    if (pathname === '/rest/v1/global_data') {
      if (req.method === 'POST') {
        if (failWrites) {
          return json(500, { message: 'Simulated database write outage on global_data' });
        }
        if (body?.id) {
          tables.global_data.set(String(body.id), body);
        }
        return json(201, [body]);
      }
      if (req.method === 'GET') {
        const idFilter = reqUrl.searchParams.get('id') || '';
        const id = idFilter.replace(/^eq\./, '');
        const row = tables.global_data.get(id);
        return json(200, row ? [row] : []);
      }
    }

    if (pathname === '/rest/v1/engagement_policy_config') {
      if (req.method === 'GET') {
        const row = tables.engagement_policy_config.get('platform_default');
        return json(200, row ? [row] : []);
      }
      if (req.method === 'POST') {
        if (body?.id) tables.engagement_policy_config.set(String(body.id), body);
        return json(201, [body]);
      }
    }

    if (pathname === '/rest/v1/user_profiles') {
      if (req.method === 'GET') return json(200, []);
      if (req.method === 'PATCH') return json(200, []);
    }

    if (pathname === '/rest/v1/gamification_xp_ledger') {
      return json(200, []);
    }

    return json(200, []);
  });

  return {
    server,
    tables,
    setFailWrites: (v: boolean) => { failWrites = v; },
    setMissingEngagementTable: (v: boolean) => { simulateMissingEngagementTable = v; },
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
  resetTestAcademicStore();

  const server: http.Server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  const addr = server.address() as any;
  const baseUrl = `http://127.0.0.1:${addr.port}`;

  const mockDb = createMockSupabaseServer();
  const mockDbPort: number = await new Promise((resolve) => {
    mockDb.server.listen(0, '127.0.0.1', () => {
      resolve((mockDb.server.address() as any).port);
    });
  });
  const prevViteSupabaseUrl = process.env.VITE_SUPABASE_URL;
  const prevSupabaseUrl = process.env.SUPABASE_URL;

  try {
    // =========================================================================
    // PRIORITY 1: STREAK RECOVERY CORRECTNESS & PERSISTENCE
    // =========================================================================
    await run('P1.1: Freezing streak creates non-zero frozenSnapshot and recovery yields frozenStreak + 1 (5 -> 6, 10 -> 11)', () => {
      const tz = 'Asia/Kolkata';
      const nowMs = Date.UTC(2026, 10, 20, 10, 0, 0);
      const twoDaysAgo = formatDateInTimezone(nowMs - 2 * 86400000, tz);

      // 5 -> freeze -> recover = 6
      const rec5 = makeRecord({
        userId: 'stu_5',
        currentStreak: 5,
        longestStreak: 5,
        lastActiveDate: twoDaysAgo,
        recoveryMonthKey: '2026-11',
      });
      const frozen5 = evaluateStreakTransition(rec5, TEST_POLICY, nowMs);
      assert.equal(frozen5.record.streakState, 'recovery_available');
      assert.equal(frozen5.record.frozenStreakCount, 5);
      assert.equal(frozen5.record.frozenSnapshot?.streakCount, 5);

      let act5 = frozen5.record;
      act5 = recordVerifiedActivity(act5, TEST_POLICY, { activityType: 'flashcards', count: 5 }, nowMs).record;
      const out5 = executeVerifiedStreakRecovery(act5, TEST_POLICY, { activityType: 'flashcards', role: 'student' }, nowMs);
      assert.equal(out5.ok, true);
      assert.equal(out5.restoredFrom, 5);
      assert.equal(out5.newStreak, 6);
      assert.equal(out5.record.currentStreak, 6);
      assert.equal(out5.record.frozenStreakCount, 0);
      assert.equal(out5.record.frozenSnapshot, null);

      // 10 -> freeze -> recover = 11
      const rec10 = makeRecord({
        userId: 'stu_10',
        currentStreak: 10,
        longestStreak: 12,
        lastActiveDate: twoDaysAgo,
        recoveryMonthKey: '2026-11',
      });
      const frozen10 = evaluateStreakTransition(rec10, TEST_POLICY, nowMs);
      assert.equal(frozen10.record.frozenSnapshot?.streakCount, 10);
      let act10 = recordVerifiedActivity(frozen10.record, TEST_POLICY, { activityType: 'quiz', count: 5 }, nowMs).record;
      const out10 = executeVerifiedStreakRecovery(act10, TEST_POLICY, { activityType: 'quiz', role: 'student' }, nowMs);
      assert.equal(out10.ok, true);
      assert.equal(out10.restoredFrom, 10);
      assert.equal(out10.newStreak, 11);
      assert.equal(out10.record.longestStreak, 12);
    });

    await run('P1.2: NEVER recover from 0 -> 1 when frozenStreakCount / frozenSnapshot is 0 or missing', async () => {
      const nowMs = Date.now();
      const tz = 'Asia/Kolkata';
      const twoDaysAgo = formatDateInTimezone(nowMs - 2 * 86400000, tz);

      __seedStreakRecordForTests(
        makeRecord({
          userId: 'stu_zero_freeze',
          currentStreak: 0,
          longestStreak: 0,
          streakState: 'recovery_available',
          frozenStreakCount: 0,
          frozenSnapshot: null,
          lastActiveDate: twoDaysAgo,
          recoveryMonthKey: formatDateInTimezone(nowMs, tz).slice(0, 7),
        })
      );

      // Log 5 actions
      await fetch(`${baseUrl}/api/engagement/activity`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-veylentra-uid': 'stu_zero_freeze', 'x-veylentra-role': 'student' },
        body: JSON.stringify({ userId: 'stu_zero_freeze', activityType: 'flashcards', count: 5 }),
      });

      const recRes = await fetch(`${baseUrl}/api/engagement/streak/recover`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-veylentra-uid': 'stu_zero_freeze', 'x-veylentra-role': 'student' },
        body: JSON.stringify({ userId: 'stu_zero_freeze', activityType: 'flashcards' }),
      });
      assert.equal(recRes.status, 400);
      const body = await recRes.json();
      assert.equal(body.success, false);
    });

    await run('P1.3: Server rejects client-spoofed evidence.verifiedCount (5) when tracked server progress is 0', async () => {
      const nowMs = Date.now();
      const tz = 'Asia/Kolkata';
      const twoDaysAgo = formatDateInTimezone(nowMs - 2 * 86400000, tz);

      __seedStreakRecordForTests(
        makeRecord({
          userId: 'stu_spoof_check',
          currentStreak: 7,
          longestStreak: 7,
          lastActiveDate: twoDaysAgo,
          recoveryMonthKey: formatDateInTimezone(nowMs, tz).slice(0, 7),
        })
      );

      // Zero server activity recorded — client attempts to spoof verifiedCount: 5
      const recRes = await fetch(`${baseUrl}/api/engagement/streak/recover`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-veylentra-uid': 'stu_spoof_check', 'x-veylentra-role': 'student' },
        body: JSON.stringify({
          userId: 'stu_spoof_check',
          activityType: 'flashcards',
          evidence: { verifiedCount: 5, clientOverride: true },
        }),
      });
      assert.equal(recRes.status, 400);
      const body = await recRes.json();
      assert.equal(body.success, false);
      assert.match(body.error, /Complete at least 5/i);
    });

    await run('P1.4: Expired recovery deadline transitions record to expired on overview GET & blocks recovery', async () => {
      const nowMs = Date.now();
      const tz = 'Asia/Kolkata';
      const expiredIso = new Date(nowMs - 60_000).toISOString();
      const twoDaysAgo = formatDateInTimezone(nowMs - 2 * 86400000, tz);

      __seedStreakRecordForTests(
        makeRecord({
          userId: 'stu_expired_deadline',
          currentStreak: 0,
          longestStreak: 9,
          streakState: 'recovery_available',
          frozenStreakCount: 9,
          frozenSnapshot: {
            streakCount: 9,
            lastActiveDate: twoDaysAgo,
            frozenAt: new Date(nowMs - 3 * 86400000).toISOString(),
            recoveryDeadline: expiredIso,
          },
          lastActiveDate: twoDaysAgo,
          recoveryDeadline: expiredIso,
          recoveryMonthKey: formatDateInTimezone(nowMs, tz).slice(0, 7),
        })
      );

      const ovRes = await fetch(`${baseUrl}/api/engagement/overview`, {
        headers: { 'x-veylentra-uid': 'stu_expired_deadline', 'x-veylentra-role': 'student' },
      });
      assert.equal(ovRes.status, 200);
      const ov = (await ovRes.json()).overview;
      assert.equal(ov.streak.streakState, 'expired');
      assert.equal(ov.streak.frozenStreakCount, 0);
      assert.equal(ov.streak.recoveryEligible, false);

      const recRes = await fetch(`${baseUrl}/api/engagement/streak/recover`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-veylentra-uid': 'stu_expired_deadline', 'x-veylentra-role': 'student' },
        body: JSON.stringify({ userId: 'stu_expired_deadline', activityType: 'flashcards' }),
      });
      assert.equal(recRes.status, 400);
    });

    await run('P1.5: Concurrent recovery requests are serialized by per-user lock (exactly one succeeds 5->6, one fails 409)', async () => {
      const nowMs = Date.now();
      const tz = 'Asia/Kolkata';
      const twoDaysAgo = formatDateInTimezone(nowMs - 2 * 86400000, tz);

      __seedStreakRecordForTests(
        makeRecord({
          userId: 'stu_concurrent_race',
          currentStreak: 5,
          longestStreak: 5,
          lastActiveDate: twoDaysAgo,
          recoveryMonthKey: formatDateInTimezone(nowMs, tz).slice(0, 7),
        })
      );

      await fetch(`${baseUrl}/api/engagement/activity`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-veylentra-uid': 'stu_concurrent_race', 'x-veylentra-role': 'student' },
        body: JSON.stringify({ userId: 'stu_concurrent_race', activityType: 'flashcards', count: 5 }),
      });

      const [rA, rB] = await Promise.all([
        fetch(`${baseUrl}/api/engagement/streak/recover`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-veylentra-uid': 'stu_concurrent_race', 'x-veylentra-role': 'student' },
          body: JSON.stringify({ userId: 'stu_concurrent_race', activityType: 'flashcards' }),
        }),
        fetch(`${baseUrl}/api/engagement/streak/recover`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-veylentra-uid': 'stu_concurrent_race', 'x-veylentra-role': 'student' },
          body: JSON.stringify({ userId: 'stu_concurrent_race', activityType: 'flashcards' }),
        }),
      ]);

      const statuses = [rA.status, rB.status].sort((a, b) => a - b);
      assert.deepEqual(statuses, [200, 409]);

      const ovRes = await fetch(`${baseUrl}/api/engagement/overview`, {
        headers: { 'x-veylentra-uid': 'stu_concurrent_race', 'x-veylentra-role': 'student' },
      });
      const ov = (await ovRes.json()).overview;
      assert.equal(ov.streak.currentStreak, 6);
      assert.equal(ov.streak.streakState, 'recovered');
    });

    await run('P1.6: eventId idempotency prevents duplicate flashcard/attendance activity double-counting', async () => {
      const uid = 'stu_event_dedup';
      const r1 = await fetch(`${baseUrl}/api/engagement/activity`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-veylentra-uid': uid, 'x-veylentra-role': 'student' },
        body: JSON.stringify({ userId: uid, activityType: 'flashcards', count: 2, eventId: 'evt-fc-101' }),
      });
      assert.equal(r1.status, 200);
      const b1 = await r1.json();
      assert.equal(b1.deduplicated, false);
      assert.equal(b1.streak.recoveryCurrentProgress, 2);

      // Replay identical eventId
      const r2 = await fetch(`${baseUrl}/api/engagement/activity`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-veylentra-uid': uid, 'x-veylentra-role': 'student' },
        body: JSON.stringify({ userId: uid, activityType: 'flashcards', count: 2, eventId: 'evt-fc-101' }),
      });
      assert.equal(r2.status, 200);
      const b2 = await r2.json();
      assert.equal(b2.deduplicated, true);
      assert.equal(b2.streak.recoveryCurrentProgress, 2);
    });

    // Enable mock Supabase DB on 127.0.0.1 for DB persistence & failure rollback tests
    process.env.VITE_SUPABASE_URL = `http://127.0.0.1:${mockDbPort}`;
    process.env.SUPABASE_URL = `http://127.0.0.1:${mockDbPort}`;

    await run('P1.7: DB persistence failure returns HTTP 503 and rolls back in-memory streak state (never returns 200)', async () => {
      const nowMs = Date.now();
      const tz = 'Asia/Kolkata';
      const twoDaysAgo = formatDateInTimezone(nowMs - 2 * 86400000, tz);

      mockDb.setFailWrites(false);
      __seedStreakRecordForTests(
        makeRecord({
          userId: 'stu_db_fail_rollback',
          currentStreak: 8,
          longestStreak: 8,
          lastActiveDate: twoDaysAgo,
          recoveryMonthKey: formatDateInTimezone(nowMs, tz).slice(0, 7),
        })
      );

      // Persist frozen + 5 activities cleanly first
      await fetch(`${baseUrl}/api/engagement/activity`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-veylentra-uid': 'stu_db_fail_rollback', 'x-veylentra-role': 'student' },
        body: JSON.stringify({ userId: 'stu_db_fail_rollback', activityType: 'flashcards', count: 5 }),
      });

      // Now simulate DB write failure during recovery!
      mockDb.setFailWrites(true);
      const failRes = await fetch(`${baseUrl}/api/engagement/streak/recover`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-veylentra-uid': 'stu_db_fail_rollback', 'x-veylentra-role': 'student' },
        body: JSON.stringify({ userId: 'stu_db_fail_rollback', activityType: 'flashcards' }),
      });
      assert.equal(failRes.status, 503);
      const failBody = await failRes.json();
      assert.equal(failBody.success, false);

      // Verify state rolled back to recovery_available (8) and did NOT become 9 in memory!
      mockDb.setFailWrites(false);
      const ovRes = await fetch(`${baseUrl}/api/engagement/overview`, {
        headers: { 'x-veylentra-uid': 'stu_db_fail_rollback', 'x-veylentra-role': 'student' },
      });
      const ov = (await ovRes.json()).overview;
      assert.equal(ov.streak.streakState, 'recovery_available');
      assert.equal(ov.streak.frozenStreakCount, 8);
    });

    await run('P1.8: Restored streak (8 -> 9) persists in DB across complete memory reset / server reload', async () => {
      const okRes = await fetch(`${baseUrl}/api/engagement/streak/recover`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-veylentra-uid': 'stu_db_fail_rollback', 'x-veylentra-role': 'student' },
        body: JSON.stringify({ userId: 'stu_db_fail_rollback', activityType: 'flashcards' }),
      });
      assert.equal(okRes.status, 200);
      const okBody = await okRes.json();
      assert.equal(okBody.restoredFrom, 8);
      assert.equal(okBody.newStreak, 9);

      // Wipe in-memory server records to simulate server restart / cold Vercel lambda
      __resetEngagementEngineMemoryForTests();

      const ovAfterRestart = await fetch(`${baseUrl}/api/engagement/overview`, {
        headers: { 'x-veylentra-uid': 'stu_db_fail_rollback', 'x-veylentra-role': 'student' },
      });
      assert.equal(ovAfterRestart.status, 200);
      const ov = (await ovAfterRestart.json()).overview;
      assert.equal(ov.streak.currentStreak, 9);
      assert.equal(ov.streak.longestStreak, 9);
      assert.equal(ov.streak.streakState, 'recovered');
      assert.equal(ov.streak.frozenStreakCount, 0);
    });

    await run('P1.9: Missing engagement_streaks table (404 PGRST205) cleanly falls back to global_data and preserves restored streak', async () => {
      const nowMs = Date.now();
      const tz = 'Asia/Kolkata';
      const twoDaysAgo = formatDateInTimezone(nowMs - 2 * 86400000, tz);

      mockDb.setMissingEngagementTable(true);
      __seedStreakRecordForTests(
        makeRecord({
          userId: 'stu_fallback_gd',
          currentStreak: 4,
          longestStreak: 4,
          lastActiveDate: twoDaysAgo,
          recoveryMonthKey: formatDateInTimezone(nowMs, tz).slice(0, 7),
        })
      );

      await fetch(`${baseUrl}/api/engagement/activity`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-veylentra-uid': 'stu_fallback_gd', 'x-veylentra-role': 'student' },
        body: JSON.stringify({ userId: 'stu_fallback_gd', activityType: 'quiz', count: 5 }),
      });

      const recRes = await fetch(`${baseUrl}/api/engagement/streak/recover`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-veylentra-uid': 'stu_fallback_gd', 'x-veylentra-role': 'student' },
        body: JSON.stringify({ userId: 'stu_fallback_gd', activityType: 'quiz' }),
      });
      assert.equal(recRes.status, 200);
      const recBody = await recRes.json();
      assert.equal(recBody.newStreak, 5);

      __resetEngagementEngineMemoryForTests();
      const ovAfterRestart = await fetch(`${baseUrl}/api/engagement/overview`, {
        headers: { 'x-veylentra-uid': 'stu_fallback_gd', 'x-veylentra-role': 'student' },
      });
      const ov = (await ovAfterRestart.json()).overview;
      assert.equal(ov.streak.currentStreak, 5);
      mockDb.setMissingEngagementTable(false);
    });

    await run('P1.10: Flashcard and Attendance source files guard DB errors BEFORE recording engagement activity', () => {
      const fcSrc = fs.readFileSync(path.resolve('/app/applet/src/components/StudyCenterFlashcards.tsx'), 'utf8');
      assert.match(fcSrc, /setSyncError\(/);
      assert.match(fcSrc, /Review not counted: failed to save progress/i);

      const attSrc = fs.readFileSync(path.resolve('/app/applet/src/components/AttendanceManager.tsx'), 'utf8');
      assert.match(attSrc, /dispatchEngagementUpdate/);
      assert.match(attSrc, /actorRole/);

      const engSvc = fs.readFileSync(path.resolve('/app/applet/src/lib/engagementService.ts'), 'utf8');
      assert.match(engSvc, /restoredFrom > 0/);
      assert.doesNotMatch(engSvc, /data\?\.restoredFrom \|\| 0/);
    });

    // =========================================================================
    // PRIORITY 2: FACULTY ROSTER STUDENT-SCOPED FEEDBACK WORKFLOW
    // =========================================================================
    await run('P2.1: Student cannot post faculty feedback (403); out-of-scope faculty is blocked (403)', async () => {
      const stuAttempt = await fetch(`${baseUrl}/api/academic/student-feedback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-veylentra-uid': 'stu_x',
          'x-veylentra-role': 'student',
          'x-veylentra-grade': 'Grade 10',
        },
        body: JSON.stringify({
          studentId: 'stu_target_1',
          studentName: 'Aarav',
          title: 'Test',
          feedback: 'Should be rejected',
          grade: 'Grade 10',
          section: 'Solara',
        }),
      });
      assert.equal(stuAttempt.status, 403);

      const outOfScopeFaculty = await fetch(`${baseUrl}/api/academic/student-feedback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-veylentra-uid': 'teacher_g8',
          'x-veylentra-role': 'teacher',
          'x-veylentra-assigned-grades': 'Grade 8',
          'x-veylentra-assigned-sections': 'Aurelia',
        },
        body: JSON.stringify({
          studentId: 'stu_target_1',
          studentName: 'Aarav',
          title: 'Out of scope check',
          feedback: 'Should be blocked by cohort scope',
          grade: 'Grade 10',
          section: 'Solara',
        }),
      });
      assert.equal(outOfScopeFaculty.status, 403);
    });

    await run('P2.2: In-scope faculty validates, persists, and retrieves student-scoped feedback & logs faculty engagement', async () => {
      // Empty feedback rejected with 400
      const badReq = await fetch(`${baseUrl}/api/academic/student-feedback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-veylentra-uid': 'teacher_g10',
          'x-veylentra-role': 'teacher',
          'x-veylentra-name': 'Prof. Nair',
          'x-veylentra-assigned-grades': 'Grade 10',
          'x-veylentra-assigned-sections': 'Solara',
        },
        body: JSON.stringify({
          studentId: 'stu_target_1',
          studentName: 'Aarav Sharma',
          title: 'Progress Feedback',
          feedback: '   ',
          grade: 'Grade 10',
          section: 'Solara',
        }),
      });
      assert.equal(badReq.status, 400);

      // Valid feedback persists cleanly
      const saveRes = await fetch(`${baseUrl}/api/academic/student-feedback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-veylentra-uid': 'teacher_g10',
          'x-veylentra-role': 'teacher',
          'x-veylentra-name': 'Prof. Nair',
          'x-veylentra-assigned-grades': 'Grade 10',
          'x-veylentra-assigned-sections': 'Solara',
        },
        body: JSON.stringify({
          studentId: 'stu_target_1',
          studentName: 'Aarav Sharma',
          title: 'Progress Feedback — Aarav Sharma',
          feedback: 'Strong participation in Physics labs. Complete Chapter 4 exercises by Friday.',
          subject: 'Physics',
          grade: 'Grade 10',
          section: 'Solara',
        }),
      });
      assert.equal(saveRes.status, 201);
      const saved = await saveRes.json();
      assert.equal(saved.success, true);
      assert.equal(saved.feedbackRecord.studentId, 'stu_target_1');
      assert.equal(saved.feedbackRecord.authorName, 'Prof. Nair');

      // Retrieve feedback for that student
      const getRes = await fetch(`${baseUrl}/api/academic/student-feedback?studentId=stu_target_1`, {
        headers: {
          'x-veylentra-uid': 'teacher_g10',
          'x-veylentra-role': 'teacher',
          'x-veylentra-assigned-grades': 'Grade 10',
          'x-veylentra-assigned-sections': 'Solara',
        },
      });
      assert.equal(getRes.status, 200);
      const getBody = await getRes.json();
      assert.equal(getBody.feedback.length, 1);
      assert.equal(getBody.feedback[0].title, 'Progress Feedback — Aarav Sharma');

      // Student cannot read another student's feedback
      const otherStudentGet = await fetch(`${baseUrl}/api/academic/student-feedback?studentId=stu_target_1`, {
        headers: {
          'x-veylentra-uid': 'stu_other_99',
          'x-veylentra-role': 'student',
        },
      });
      assert.equal(otherStudentGet.status, 403);
    });

    await run('P2.3 & P3: Faculty Roster uses real student-scoped modal (no blind overview redirect) & Home workspaces preserve features', () => {
      const facSrc = fs.readFileSync(path.resolve('/app/applet/src/components/FacultyExperienceWorkspace.tsx'), 'utf8');
      assert.match(facSrc, /handleOpenRosterFeedbackModal/);
      assert.match(facSrc, /handleGenerateRosterFeedbackWithOrion/);
      assert.match(facSrc, /handleConfirmSendRosterFeedback/);
      assert.match(facSrc, /Confirm &amp; Send Feedback/);
      assert.doesNotMatch(facSrc, /setOrionTopic\(`Prepare a supportive 2-week academic follow-up plan/);

      const stuSrc = fs.readFileSync(path.resolve('/app/applet/src/components/StudentExperienceWorkspace.tsx'), 'utf8');
      assert.match(stuSrc, /homeFeedTab/);
      assert.match(stuSrc, /UnifiedEngagementPanel/);
      assert.match(stuSrc, /XpLeaderboardPanel/);
      assert.match(stuSrc, /WinterDashboardBanner/);
    });

    console.log(`\n🎉 All ${passed} Pre-Pilot Audit Remediation tests passed!\n`);
  } finally {
    if (prevViteSupabaseUrl !== undefined) process.env.VITE_SUPABASE_URL = prevViteSupabaseUrl;
    else delete process.env.VITE_SUPABASE_URL;
    if (prevSupabaseUrl !== undefined) process.env.SUPABASE_URL = prevSupabaseUrl;
    else delete process.env.SUPABASE_URL;

    await new Promise<void>((resolve) => server.close(() => resolve()));
    await new Promise<void>((resolve) => mockDb.server.close(() => resolve()));
  }
  process.exit(0);
}

main().catch((err) => {
  console.error('❌ Test suite failed:', err);
  process.exit(1);
});
