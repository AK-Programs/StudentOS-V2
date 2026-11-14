/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Veylentra — Winter Festival, Super Admin Feature Control & Gamification 2.0 Verification Suite
 * Exercises:
 *  1. Feature registry initialization (16 flags across 8 categories)
 *  2. RBAC enforcement on feature mutations (401/403 vs super_admin + audit log)
 *  3. Dynamic new feature registration
 *  4. Fail-closed feature disable propagation (403 FEATURE_DISABLED vs Super Admin preview)
 *  5. Dependency gating (winter_theme OFF disables winter_snow_effects)
 *  6. Reversible theme safety (WinterThemeLayer never writes/removes localStorage)
 *  7. Separated Student & Faculty leaderboards + time windows + no PII + zero seedScholars
 *  8. Nightly Santa Gift strict IST window (19:00–21:00), duplicate guard, idempotent recovery
 *  9. Winter Spin Wheel strict 2-hour cooldown, valid segmentIndex 0..7 & 100% odds sum
 * 10. Daily AI Bonus Cap (+5/day max) merged into /api/ai/usage-status
 * 11. Winter Tasks & Separate Collectible Badges verification (Winter Quiz 2/3 pass -> badge)
 * 12. Anti-tamper XP action enforcement (study_flashcards = 15 XP, tampered/unknown rejected)
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { AddressInfo } from 'node:net';
import { app } from '../server';
import { DEFAULT_FEATURE_REGISTRY, FEATURE_CATEGORIES } from '../server/featureRegistry';
import { getFeatureRecord } from '../server/featureManagementModule';
import {
  MAX_DAILY_WINTER_AI_BONUS,
  SANTA_REWARD_TIERS,
  SPIN_WHEEL_COOLDOWN_MS,
  SPIN_WHEEL_SEGMENTS,
  getSantaWindowStatus,
} from '../server/rewardEngine';
import {
  executeSantaGiftClaim,
  executeSpinWheel,
  getUserWinterAiBonusCredits,
  resetWinterAndLeaderboardMemoryForTests,
  seedXpEntryForTests,
} from '../server/winterFestivalModule';

let passed = 0;

async function runTest(name: string, fn: () => Promise<void> | void) {
  await fn();
  passed += 1;
  console.log(`✅ [PASS] ${name}`);
}

const superAdminHeaders = {
  'Content-Type': 'application/json',
  'x-veylentra-uid': 'sa-root-1',
  'x-veylentra-name': 'Super Admin Root',
  'x-veylentra-role': 'super_admin',
  'x-veylentra-email': 'superadmin@veylentra.edu',
};

const studentHeaders = {
  'Content-Type': 'application/json',
  'x-veylentra-uid': 'stu-winter-1',
  'x-veylentra-name': 'Ananya Verma',
  'x-veylentra-role': 'student',
  'x-veylentra-grade': 'Grade 10',
  'x-veylentra-section': 'Solara',
  'x-veylentra-email': 'ananya.private@school.edu',
};

const teacherHeaders = {
  'Content-Type': 'application/json',
  'x-veylentra-uid': 'fac-winter-1',
  'x-veylentra-name': 'Prof. Vikram Rao',
  'x-veylentra-role': 'teacher',
  'x-veylentra-grade': 'Grade 10',
  'x-veylentra-section': 'Solara',
  'x-veylentra-email': 'vikram.private@school.edu',
};

async function apiJson(baseUrl: string, route: string, options: RequestInit = {}) {
  const resp = await fetch(`${baseUrl}${route}`, options);
  const data = await resp.json().catch(() => ({}));
  return { status: resp.status, data };
}

function getTodayIstHourUtcMs(istHour: number, istMinute: number = 30): number {
  const istKey = getSantaWindowStatus(Date.now(), 'Asia/Kolkata').eventNightKey; // YYYY-MM-DD in IST
  const [y, m, d] = istKey.split('-').map(Number);
  // IST is UTC+05:30 -> UTC = IST - 330 minutes
  return Date.UTC(y, m - 1, d, istHour, istMinute, 0, 0) - 330 * 60 * 1000;
}

const noopSupabase = () => ({ url: '', key: '' });

async function main() {
  resetWinterAndLeaderboardMemoryForTests();

  const server = http.createServer(app);
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const addr = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${addr.port}`;

  try {
    // 1. Feature registry initialization
    await runTest('1. Feature registry initializes all 16 flags across 8 categories', async () => {
      assert.equal(DEFAULT_FEATURE_REGISTRY.length, 16);
      assert.equal(FEATURE_CATEGORIES.length, 8);
      const { status, data } = await apiJson(baseUrl, '/api/features', { headers: superAdminHeaders });
      assert.equal(status, 200);
      assert.equal(data.success, true);
      assert.ok(Array.isArray(data.features));
      assert.ok(data.features.length >= 16);
      assert.equal(data.categories.length, 8);
    });

    // 2. RBAC enforcement on feature mutations + audit log
    await runTest('2. RBAC blocks student/teacher/unauth on feature writes; Super Admin succeeds with audit log', async () => {
      const unauth = await apiJson(baseUrl, '/api/features/winter_theme', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: false }),
      });
      assert.equal(unauth.status, 401);

      const stuPatch = await apiJson(baseUrl, '/api/features/winter_theme', {
        method: 'PATCH',
        headers: studentHeaders,
        body: JSON.stringify({ enabled: false }),
      });
      assert.equal(stuPatch.status, 403);

      const facPost = await apiJson(baseUrl, '/api/features', {
        method: 'POST',
        headers: teacherHeaders,
        body: JSON.stringify({ key: 'unauth_flag', displayName: 'Blocked Flag' }),
      });
      assert.equal(facPost.status, 403);

      const saPatch = await apiJson(baseUrl, '/api/features/winter_theme', {
        method: 'PATCH',
        headers: superAdminHeaders,
        body: JSON.stringify({ enabled: true, reason: 'Enable winter season kickoff' }),
      });
      assert.equal(saPatch.status, 200);
      assert.equal(saPatch.data.success, true);
      assert.equal(saPatch.data.auditEntry.actorId, 'sa-root-1');

      const auditRes = await apiJson(baseUrl, '/api/features?includeAudit=true', { headers: superAdminHeaders });
      assert.equal(auditRes.status, 200);
      assert.ok(Array.isArray(auditRes.data.auditLogs));
      assert.ok(auditRes.data.auditLogs.some((l: any) => l.featureKey === 'winter_theme'));
    });

    // 3. Dynamic new feature registration
    await runTest('3. Super Admin can dynamically register a new feature flag', async () => {
      const created = await apiJson(baseUrl, '/api/features', {
        method: 'POST',
        headers: superAdminHeaders,
        body: JSON.stringify({
          key: 'spring_science_fair_2027',
          displayName: 'Spring Science Fair 2027',
          description: 'Interactive seasonal STEM showcase.',
          category: 'Seasonal Events',
          enabled: true,
          isSeasonal: true,
        }),
      });
      assert.equal(created.status, 201);
      assert.equal(created.data.feature.key, 'spring_science_fair_2027');

      const listRes = await apiJson(baseUrl, '/api/features', { headers: studentHeaders });
      assert.equal(listRes.status, 200);
      assert.ok(listRes.data.features.some((f: any) => f.key === 'spring_science_fair_2027'));
    });

    // 4 & 5. Feature disable propagation + Dependency gating
    await runTest('4 & 5. Disabling Winter features returns 403 FEATURE_DISABLED for students while Super Admin previews, and winter_theme dependency gates winter_snow_effects', async () => {
      // Turn off all 5 winter flags to verify full Winter Hub fail-closed behavior for students
      const winterKeys = [
        'winter_theme',
        'winter_festival_tasks',
        'winter_badges',
        'winter_santa_gifts',
        'winter_spin_wheel',
      ];
      for (const k of winterKeys) {
        const r = await apiJson(baseUrl, `/api/features/${k}`, {
          method: 'PATCH',
          headers: superAdminHeaders,
          body: JSON.stringify({ enabled: false, reason: 'Maintenance test' }),
        });
        assert.equal(r.status, 200);
      }

      // Dependency check: winter_snow_effects depends on winter_theme
      const listForStudent = await apiJson(baseUrl, '/api/features', { headers: studentHeaders });
      assert.equal(listForStudent.status, 200);
      const snowFeature = listForStudent.data.features.find((f: any) => f.key === 'winter_snow_effects');
      assert.ok(snowFeature, 'winter_snow_effects exists in registry');
      assert.equal(listForStudent.data.effectiveFlags.winter_snow_effects, false, 'winter_snow_effects must be effectively disabled when winter_theme is OFF');

      const blockedStatus = await apiJson(baseUrl, '/api/winter/status', { headers: studentHeaders });
      assert.equal(blockedStatus.status, 403);
      assert.equal(blockedStatus.data.code, 'FEATURE_DISABLED');

      const blockedSpin = await apiJson(baseUrl, '/api/winter/spin', {
        method: 'POST',
        headers: studentHeaders,
        body: JSON.stringify({ idempotencyKey: 'blocked_spin_1' }),
      });
      assert.equal(blockedSpin.status, 403);
      assert.equal(blockedSpin.data.code, 'FEATURE_DISABLED');

      const saPreviewStatus = await apiJson(baseUrl, '/api/winter/status', { headers: superAdminHeaders });
      assert.equal(saPreviewStatus.status, 200);
      assert.equal(saPreviewStatus.data.success, true);

      // Re-enable all winter flags for subsequent tests
      for (const k of winterKeys) {
        await apiJson(baseUrl, `/api/features/${k}`, {
          method: 'PATCH',
          headers: superAdminHeaders,
          body: JSON.stringify({ enabled: true, reason: 'Re-enable after fail-closed test' }),
        });
      }
      assert.equal(getFeatureRecord('winter_theme')?.enabled, true);
    });

    // 6. Reversible theme safety
    await runTest('6. WinterThemeLayer never overwrites or removes localStorage studentos_theme', async () => {
      const themeLayerPath = path.resolve(process.cwd(), 'src/components/winter/WinterThemeLayer.tsx');
      const code = fs.readFileSync(themeLayerPath, 'utf8');
      assert.equal(code.includes('localStorage.setItem'), false, 'WinterThemeLayer must never call localStorage.setItem');
      assert.equal(code.includes('localStorage.removeItem'), false, 'WinterThemeLayer must never call localStorage.removeItem');
      assert.ok(code.includes('winter-theme-active'));
    });

    // 7. Separated Student & Faculty Leaderboards + Windows + No PII + Zero seedScholars
    await runTest('7. Student and Faculty leaderboards stay strictly separated, respect Weekly/Monthly/All-Time windows, exclude PII, and remove seedScholars', async () => {
      const now = Date.now();
      const threeDaysAgo = new Date(now - 3 * 24 * 60 * 60 * 1000).toISOString();
      const fifteenDaysAgo = new Date(now - 15 * 24 * 60 * 60 * 1000).toISOString();
      const sixtyDaysAgo = new Date(now - 60 * 24 * 60 * 60 * 1000).toISOString();

      seedXpEntryForTests({
        id: 'xp_seed_1',
        userId: 'stu-winter-1',
        userName: 'Ananya Verma',
        userRole: 'student',
        grade: 'Grade 10',
        section: 'Solara',
        sourceType: 'academic',
        actionKey: 'study_flashcards:d3',
        xpDelta: 40,
        label: 'Flashcards',
        createdAt: threeDaysAgo,
      });
      seedXpEntryForTests({
        id: 'xp_seed_2',
        userId: 'stu-winter-1',
        userName: 'Ananya Verma',
        userRole: 'student',
        grade: 'Grade 10',
        section: 'Solara',
        sourceType: 'academic',
        actionKey: 'study_flashcards:d15',
        xpDelta: 80,
        label: 'Flashcards',
        createdAt: fifteenDaysAgo,
      });
      seedXpEntryForTests({
        id: 'xp_seed_3',
        userId: 'stu-winter-1',
        userName: 'Ananya Verma',
        userRole: 'student',
        grade: 'Grade 10',
        section: 'Solara',
        sourceType: 'academic',
        actionKey: 'study_flashcards:d60',
        xpDelta: 100,
        label: 'Flashcards',
        createdAt: sixtyDaysAgo,
      });
      seedXpEntryForTests({
        id: 'xp_seed_fac_1',
        userId: 'fac-winter-1',
        userName: 'Prof. Vikram Rao',
        userRole: 'teacher',
        grade: 'Grade 10',
        section: 'Solara',
        sourceType: 'academic',
        actionKey: 'faculty_mark_attendance:d3',
        xpDelta: 55,
        label: 'Attendance',
        createdAt: threeDaysAgo,
      });

      const stuWeekly = await apiJson(baseUrl, '/api/leaderboard?type=student&period=weekly', { headers: studentHeaders });
      const stuMonthly = await apiJson(baseUrl, '/api/leaderboard?type=student&period=monthly', { headers: studentHeaders });
      const stuAll = await apiJson(baseUrl, '/api/leaderboard?type=student&period=all_time', { headers: studentHeaders });
      const facWeekly = await apiJson(baseUrl, '/api/leaderboard?type=faculty&period=weekly', { headers: teacherHeaders });

      assert.equal(stuWeekly.status, 200);
      assert.equal(stuWeekly.data.rankings.every((r: any) => r.role === 'student'), true);
      assert.equal(stuWeekly.data.rankings.some((r: any) => r.userId === 'fac-winter-1'), false);
      assert.equal(facWeekly.data.rankings.every((r: any) => ['teacher', 'coordinator', 'hod'].includes(r.role)), true);
      assert.equal(facWeekly.data.rankings.some((r: any) => r.userId === 'stu-winter-1'), false);

      const stuWRow = stuWeekly.data.rankings.find((r: any) => r.userId === 'stu-winter-1');
      const stuMRow = stuMonthly.data.rankings.find((r: any) => r.userId === 'stu-winter-1');
      const stuARow = stuAll.data.rankings.find((r: any) => r.userId === 'stu-winter-1');
      assert.equal(stuWRow.xp, 40);
      assert.equal(stuMRow.xp, 120);
      assert.equal(stuARow.xp, 220);

      // Private field exclusion
      const serialized = JSON.stringify(stuWeekly.data);
      assert.equal(serialized.includes('ananya.private@school.edu'), false);
      assert.equal('email' in stuWRow, false);
      assert.equal('phone' in stuWRow, false);
      assert.equal('password' in stuWRow, false);

      // Zero seedScholars in src/lib/gamification.ts
      const gamifSrc = fs.readFileSync(path.resolve(process.cwd(), 'src/lib/gamification.ts'), 'utf8');
      assert.equal(gamifSrc.includes('seedScholars'), false);
    });

    // 8. Nightly Santa Gift strict window + duplicate claim + idempotent recovery
    await runTest('8. Nightly Santa Gift enforces 7-9 PM IST, blocks duplicate claim, and recovers idempotently without re-rolling', async () => {
      const sumSantaOdds = SANTA_REWARD_TIERS.reduce((acc, t) => acc + t.oddsPercent, 0);
      assert.equal(sumSantaOdds, 100);

      const morningMs = getTodayIstHourUtcMs(10, 15);
      const eveningMs = getTodayIstHourUtcMs(19, 45);
      const santaUser = { id: 'stu-santa-test', name: 'Santa Tester', role: 'student', grade: 'Grade 10', section: 'Solara' };

      const outsideRes = await executeSantaGiftClaim({
        user: santaUser,
        idempotencyKey: 'santa_morning_attempt',
        nowMs: morningMs,
        getSupabaseServerConfig: noopSupabase,
      });
      assert.equal(outsideRes.statusCode, 403);
      assert.equal(outsideRes.body.code, 'OUTSIDE_SANTA_WINDOW');

      const claim1 = await executeSantaGiftClaim({
        user: santaUser,
        idempotencyKey: 'santa_evening_idemp_1',
        nowMs: eveningMs,
        getSupabaseServerConfig: noopSupabase,
      });
      assert.equal(claim1.statusCode, 200);
      assert.equal(claim1.body.alreadyClaimed, false);
      const originalRewardId = claim1.body.reward.id;

      // Idempotent replay with same key returns same reward ID without re-rolling
      const replay = await executeSantaGiftClaim({
        user: santaUser,
        idempotencyKey: 'santa_evening_idemp_1',
        nowMs: eveningMs + 2000,
        getSupabaseServerConfig: noopSupabase,
      });
      assert.equal(replay.statusCode, 200);
      assert.equal(replay.body.alreadyClaimed, true);
      assert.equal(replay.body.reward.id, originalRewardId);

      // Different key same night blocked 409
      const dupNight = await executeSantaGiftClaim({
        user: santaUser,
        idempotencyKey: 'santa_evening_idemp_2',
        nowMs: eveningMs + 5000,
        getSupabaseServerConfig: noopSupabase,
      });
      assert.equal(dupNight.statusCode, 409);
      assert.equal(dupNight.body.code, 'ALREADY_CLAIMED_TONIGHT');
    });

    // 9. Winter Spin Wheel strict 2-hour cooldown & segmentIndex
    await runTest('9. Winter Spin Wheel enforces 2-hour cooldown, valid segmentIndex 0..7, and 100% odds sum', async () => {
      assert.equal(SPIN_WHEEL_SEGMENTS.length, 8);
      const sumSpinOdds = SPIN_WHEEL_SEGMENTS.reduce((acc, s) => acc + s.oddsPercent, 0);
      assert.equal(sumSpinOdds, 100);
      assert.equal(SPIN_WHEEL_COOLDOWN_MS, 2 * 60 * 60 * 1000);

      const spinUser = { id: 'stu-spin-test', name: 'Wheel Tester', role: 'student', grade: 'Grade 10', section: 'Solara' };
      const t0 = getTodayIstHourUtcMs(14, 0);

      const spin1 = await executeSpinWheel({
        user: spinUser,
        idempotencyKey: 'spin_key_1',
        nowMs: t0,
        getSupabaseServerConfig: noopSupabase,
      });
      assert.equal(spin1.statusCode, 200);
      assert.ok(spin1.body.segmentIndex >= 0 && spin1.body.segmentIndex <= 7);

      // 30 minutes later -> blocked 429 cooldown
      const spinTooSoon = await executeSpinWheel({
        user: spinUser,
        idempotencyKey: 'spin_key_2',
        nowMs: t0 + 30 * 60 * 1000,
        getSupabaseServerConfig: noopSupabase,
      });
      assert.equal(spinTooSoon.statusCode, 429);
      assert.equal(spinTooSoon.body.code, 'SPIN_ON_COOLDOWN');
      assert.equal(spinTooSoon.body.remainingMs, 90 * 60 * 1000);

      // 2 hours + 1 second later -> allowed
      const spinAfter2h = await executeSpinWheel({
        user: spinUser,
        idempotencyKey: 'spin_key_3',
        nowMs: t0 + SPIN_WHEEL_COOLDOWN_MS + 1000,
        getSupabaseServerConfig: noopSupabase,
      });
      assert.equal(spinAfter2h.statusCode, 200);
      assert.ok(spinAfter2h.body.segmentIndex >= 0 && spinAfter2h.body.segmentIndex <= 7);
    });

    // 10. Daily AI Bonus Cap (+5/day max) merged into /api/ai/usage-status
    await runTest('10. Daily Winter AI Bonus queries cap at +5/day and merge into /api/ai/usage-status', async () => {
      const capUser = { id: 'stu-ai-cap-test', name: 'AI Bonus Tester', role: 'student', grade: 'Grade 10', section: 'Solara' };
      const spinStartNow = getTodayIstHourUtcMs(1, 0);
      const santaNow = getTodayIstHourUtcMs(19, 30);

      // Spin 6 times across the same IST day + claim Santa tonight
      for (let i = 0; i < 6; i++) {
        await executeSpinWheel({
          user: capUser,
          idempotencyKey: `cap_spin_${i}`,
          nowMs: spinStartNow + i * (SPIN_WHEEL_COOLDOWN_MS + 1000),
          getSupabaseServerConfig: noopSupabase,
        });
      }
      await executeSantaGiftClaim({
        user: capUser,
        idempotencyKey: 'cap_santa_1',
        nowMs: santaNow,
        getSupabaseServerConfig: noopSupabase,
      });

      const winterBonus = getUserWinterAiBonusCredits(capUser.id, Date.now());
      assert.ok(winterBonus <= MAX_DAILY_WINTER_AI_BONUS, `Winter bonus ${winterBonus} must never exceed ${MAX_DAILY_WINTER_AI_BONUS}`);

      const usageRes = await apiJson(baseUrl, `/api/ai/usage-status?userId=${capUser.id}&role=student`);
      assert.equal(usageRes.status, 200);
      assert.equal(usageRes.data.bonus, winterBonus);
      assert.equal(usageRes.data.limit, usageRes.data.baseLimit + winterBonus);
    });

    // 11. Winter Tasks & Separate Collectible Badges verification
    await runTest('11. Winter Knowledge Check requires 2/3 pass before claiming task_winter_quiz and awarding winter_scholar badge', async () => {
      // Attempting to claim task_winter_quiz before passing quiz fails 400
      const premClaim = await apiJson(baseUrl, '/api/winter/tasks/task_winter_quiz/claim', {
        method: 'POST',
        headers: studentHeaders,
      });
      assert.equal(premClaim.status, 400);

      // Submit failing quiz (0/3)
      const failQuiz = await apiJson(baseUrl, '/api/winter/quiz/submit', {
        method: 'POST',
        headers: studentHeaders,
        body: JSON.stringify({
          answers: { wq_1: 0, wq_2: 0, wq_3: 0 },
        }),
      });
      assert.equal(failQuiz.status, 200);
      assert.equal(failQuiz.data.passed, false);

      // Submit passing quiz (3/3)
      const passQuiz = await apiJson(baseUrl, '/api/winter/quiz/submit', {
        method: 'POST',
        headers: studentHeaders,
        body: JSON.stringify({
          answers: { wq_1: 1, wq_2: 2, wq_3: 1 },
        }),
      });
      assert.equal(passQuiz.status, 200);
      assert.equal(passQuiz.data.passed, true);
      assert.equal(passQuiz.data.correctCount, 3);

      // Claim task_winter_quiz -> unlocks winter_scholar separate collectible badge
      const claimRes = await apiJson(baseUrl, '/api/winter/tasks/task_winter_quiz/claim', {
        method: 'POST',
        headers: studentHeaders,
      });
      assert.equal(claimRes.status, 200);
      assert.ok(claimRes.data.winterState.earnedWinterBadges.winter_scholar);
    });

    // 12. Anti-tamper XP action enforcement
    await runTest('12. /api/gamification/action awards authoritative 15 XP for study_flashcards, rejects tampered client XP & unknown actions', async () => {
      const validAction = await apiJson(baseUrl, '/api/gamification/action', {
        method: 'POST',
        headers: studentHeaders,
        body: JSON.stringify({
          action: 'study_flashcards',
          itemId: 'deck_thermo_1',
        }),
      });
      assert.equal(validAction.status, 200);
      assert.equal(validAction.data.xpAdded, 15);

      const tamperedAction = await apiJson(baseUrl, '/api/gamification/action', {
        method: 'POST',
        headers: studentHeaders,
        body: JSON.stringify({
          action: 'study_flashcards',
          itemId: 'deck_tamper_2',
          xp: 9999,
        }),
      });
      assert.equal(tamperedAction.status, 403);
      assert.equal(tamperedAction.data.code, 'XP_TAMPER_REJECTED');

      const unknownAction = await apiJson(baseUrl, '/api/gamification/action', {
        method: 'POST',
        headers: studentHeaders,
        body: JSON.stringify({
          action: 'hack_infinite_xp',
          itemId: 'x1',
        }),
      });
      assert.equal(unknownAction.status, 400);
    });

    console.log(`\n🎉 All ${passed} Winter Festival, Feature Control & Gamification 2.0 tests passed!`);
  } finally {
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ Test suite failed:', err);
    process.exit(1);
  });
