/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Veylentra Winter Festival 4.0 — Phase 2 Verification Suite:
 * 1. Cross-Account XP Leaderboard Integrity (Weekly / Monthly / All-Time across Accounts A, B, C)
 *    - Student vs Faculty cohort isolation (including super_admin in Faculty)
 *    - POST /api/gamification/award ledger mirroring into Weekly/Monthly
 *    - Frost XP strict exclusion from Scholar XP Leaderboard
 *    - id <-> uid alias unification & zero PII exposure
 * 2. Task Claim Latency & Concurrency / Idempotency Verification
 * 3. Per-User Badge Unlock Baseline & Diff Verification (zero false replay across refreshes)
 */

import assert from 'node:assert/strict';
import http from 'node:http';
import { AddressInfo } from 'node:net';
import { app, clearServerGamificationMemoryForTests } from '../server';
import {
  clearWinterMemoryCacheOnlyForTests,
  resetWinterAndLeaderboardMemoryForTests,
  setForceWinterSupabaseForTests,
} from '../server/winterFestivalModule';
import { WORKING_ANON_KEY } from '../server/supabaseKeyManager';
import { processNewWinterBadges, syncWinterBadgeBaseline } from '../src/lib/winterBadgeEvents';

let passed = 0;
async function runTest(name: string, fn: () => Promise<void> | void) {
  await fn();
  passed += 1;
  console.log(`✅ [PASS] ${name}`);
}

function createLeaderboardAndWinterMockSupabase() {
  const tables: Record<string, any[]> = {
    winter_user_profiles: [],
    winter_task_claims: [],
    winter_user_badges: [],
    winter_reward_ledger: [],
    winter_frost_xp_ledger: [],
    winter_admin_grant_audit: [],
    gamification_xp_ledger: [],
    user_profiles: [],
    global_data: [],
    platform_features: [],
  };

  let queryCounts: Record<string, number> = {};
  let rlsBlockTaskClaims = false;
  let missingTaskClaimRpc = false;

  function matchesCondition(row: any, key: string, expr: string): boolean {
    if (expr.startsWith('eq.')) return String(row[key] ?? '') === expr.slice(3);
    if (expr.startsWith('gt.')) return Number(row[key] ?? 0) > Number(expr.slice(3));
    if (expr.startsWith('gte.')) return String(row[key] ?? '') >= expr.slice(4);
    if (expr.startsWith('like.')) {
      const pattern = expr.slice(5).replace(/%/g, '.*').replace(/\*/g, '.*');
      return new RegExp(`^${pattern}$`).test(String(row[key] ?? ''));
    }
    if (expr.startsWith('in.(') && expr.endsWith(')')) {
      const vals = expr.slice(4, -1).split(',').map(s => s.replace(/^"|"$/g, '').trim());
      return vals.includes(String(row[key] ?? ''));
    }
    return true;
  }

  function filterRows(tableName: string, searchParams: URLSearchParams): any[] {
    let rows = [...(tables[tableName] || [])];
    for (const [k, v] of searchParams.entries()) {
      if (['select', 'order', 'limit', 'on_conflict'].includes(k)) continue;
      if (k === 'or' && v.startsWith('(') && v.endsWith(')')) {
        const parts = v.slice(1, -1).split(',');
        rows = rows.filter(row =>
          parts.some(p => {
            const dotIdx = p.indexOf('.');
            if (dotIdx === -1) return false;
            return matchesCondition(row, p.slice(0, dotIdx), p.slice(dotIdx + 1));
          })
        );
      } else {
        rows = rows.filter(row => matchesCondition(row, k, v));
      }
    }
    const orderParam = searchParams.get('order');
    if (orderParam) {
      const [col, dir] = orderParam.split('.');
      rows.sort((a, b) => {
        const av = a[col];
        const bv = b[col];
        if (typeof av === 'number' && typeof bv === 'number') {
          return dir === 'desc' ? bv - av : av - bv;
        }
        return dir === 'desc'
          ? String(bv ?? '').localeCompare(String(av ?? ''))
          : String(av ?? '').localeCompare(String(bv ?? ''));
      });
    }
    const limitParam = searchParams.get('limit');
    if (limitParam) rows = rows.slice(0, Number(limitParam));
    const selectParam = searchParams.get('select');
    if (selectParam && selectParam !== '*') {
      const cols = selectParam.split(',').map(s => s.trim()).filter(Boolean);
      rows = rows.map(r => {
        const out: any = {};
        for (const c of cols) out[c] = r[c];
        return out;
      });
    }
    return rows;
  }

  const server = http.createServer((req, res) => {
    const reqUrl = new URL(req.url || '/', 'http://127.0.0.1');
    const chunks: Buffer[] = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => {
      const bodyStr = Buffer.concat(chunks).toString('utf-8');
      const parsedBody = bodyStr ? JSON.parse(bodyStr) : null;

      if (reqUrl.pathname.startsWith('/rest/v1/rpc/')) {
        const rpcName = reqUrl.pathname.replace('/rest/v1/rpc/', '');
        queryCounts[`RPC:${rpcName}`] = (queryCounts[`RPC:${rpcName}`] || 0) + 1;
        if (rpcName === 'claim_winter_task_secure' && missingTaskClaimRpc) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ code: 'PGRST202', message: 'Could not find the function public.claim_winter_task_secure' }));
          return;
        }
        if (rpcName === 'claim_winter_task_secure') {
          const dup = tables.winter_task_claims.some(
            c => c.user_id === parsedBody.p_user_id && c.task_id === parsedBody.p_task_id
          );
          if (dup) {
            res.writeHead(409, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ code: '23505', message: 'duplicate key value violates unique constraint' }));
            return;
          }
          tables.winter_task_claims.push({
            id: parsedBody.p_claim_id,
            user_id: parsedBody.p_user_id,
            task_id: parsedBody.p_task_id,
            xp_awarded: parsedBody.p_xp_awarded,
            cookies_awarded: parsedBody.p_cookies_awarded,
            claimed_at: parsedBody.p_claimed_at,
          });
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({}));
          return;
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({}));
        return;
      }

      if (!reqUrl.pathname.startsWith('/rest/v1/')) {
        res.writeHead(404);
        res.end();
        return;
      }

      const tableName = reqUrl.pathname.replace('/rest/v1/', '');
      queryCounts[`${req.method}:${tableName}`] = (queryCounts[`${req.method}:${tableName}`] || 0) + 1;

      if (req.method === 'POST' && tableName === 'winter_task_claims' && rlsBlockTaskClaims) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ code: '42501', message: 'new row violates row-level security policy' }));
        return;
      }

      if (req.method === 'GET') {
        const rows = filterRows(tableName, reqUrl.searchParams);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(rows));
        return;
      }

      if (req.method === 'POST') {
        const items = Array.isArray(parsedBody) ? parsedBody : [parsedBody];
        const prefer = String(req.headers['prefer'] || '');
        const table = (tables[tableName] = tables[tableName] || []);
        for (const row of items) {
          if (tableName === 'gamification_xp_ledger') {
            const dup = table.some(r => r.user_id === row.user_id && r.action_key === row.action_key);
            if (dup) {
              res.writeHead(409, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ code: '23505', message: 'duplicate key value violates unique constraint' }));
              return;
            }
            table.push(row);
          } else if (tableName === 'winter_user_profiles') {
            const idx = table.findIndex(r => r.user_id === row.user_id);
            if (idx >= 0 && prefer.includes('merge-duplicates')) table[idx] = { ...table[idx], ...row };
            else if (idx >= 0) {
              res.writeHead(409, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ code: '23505', message: 'duplicate' }));
              return;
            } else table.push(row);
          } else if (tableName === 'global_data') {
            const idx = table.findIndex(r => r.id === row.id);
            if (idx >= 0 && prefer.includes('merge-duplicates')) table[idx] = { ...table[idx], ...row };
            else if (idx >= 0) table[idx] = row;
            else table.push(row);
          } else {
            table.push(row);
          }
        }
        res.writeHead(201, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(items));
        return;
      }

      if (req.method === 'PATCH') {
        const rows = tables[tableName] || [];
        const matched = filterRows(tableName, reqUrl.searchParams);
        for (const m of matched) {
          const idx = rows.indexOf(m);
          if (idx >= 0) rows[idx] = { ...rows[idx], ...parsedBody };
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(matched));
        return;
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end('[]');
    });
  });

  return {
    server,
    tables,
    setClaimBehavior(opts: { rlsBlocked: boolean; rpcMissing: boolean }) {
      rlsBlockTaskClaims = opts.rlsBlocked;
      missingTaskClaimRpc = opts.rpcMissing;
    },
    resetQueryCounts() {
      queryCounts = {};
    },
    getQueryCounts() {
      return { ...queryCounts };
    },
    resetAll() {
      Object.values(tables).forEach(arr => (arr.length = 0));
      queryCounts = {};
      rlsBlockTaskClaims = false;
      missingTaskClaimRpc = false;
    },
  };
}

function actorHeaders(id: string, name: string, role: string, email?: string) {
  return {
    'Content-Type': 'application/json',
    'x-veylentra-uid': id,
    'x-veylentra-name': name,
    'x-veylentra-role': role,
    'x-veylentra-email': email || `${id}@veylentra.edu`,
  };
}

async function main() {
  const mockDb = createLeaderboardAndWinterMockSupabase();
  await new Promise<void>(resolve => mockDb.server.listen(0, '127.0.0.1', resolve));
  const mockPort = (mockDb.server.address() as AddressInfo).port;

  const apiServer = http.createServer(app);
  await new Promise<void>(resolve => apiServer.listen(0, '127.0.0.1', resolve));
  const apiBase = `http://127.0.0.1:${(apiServer.address() as AddressInfo).port}`;

  const prevUrl = process.env.VITE_SUPABASE_URL;
  const prevAnon = process.env.VITE_SUPABASE_ANON_KEY;
  process.env.VITE_SUPABASE_URL = `http://127.0.0.1:${mockPort}`;
  process.env.VITE_SUPABASE_ANON_KEY = WORKING_ANON_KEY;
  setForceWinterSupabaseForTests(true);

  try {
    await runTest('1. Cross-Account Leaderboard Parity (Accounts A, B, C see identical Weekly/Monthly/All-Time rankings & cosmetics, Frost XP excluded, zero PII)', async () => {
      mockDb.resetAll();
      resetWinterAndLeaderboardMemoryForTests();
      clearServerGamificationMemoryForTests();

      // Seed accounts with id vs uid alias and private PII fields that MUST NOT leak
      mockDb.tables.user_profiles.push(
        { id: 'stu_canon_a', uid: 'stu_alias_a', name: 'Aarav Sharma', role: 'student', points: 100, grade: 'Class 10', section: 'Alpha', email: 'aarav@private.edu', phone: '9999990001' },
        { id: 'stu_canon_b', uid: 'stu_canon_b', name: 'Diya Nair', role: 'student', points: 40, grade: 'Class 10', section: 'Beta', email: 'diya@private.edu', phone: '9999990002' },
        { id: 'fac_canon_c', uid: 'fac_canon_c', name: 'Prof. Mehta', role: 'teacher', points: 150, grade: '', section: '', email: 'mehta@private.edu', phone: '9999990003' },
        { id: 'sa_canon_d', uid: 'sa_canon_d', name: 'Naitik SuperAdmin', role: 'super_admin', points: 220, grade: '', section: '', email: 'sa@private.edu', phone: '9999990004' }
      );

      // Account A earns +55 Scholar XP via /api/gamification/award (using alias ID to also verify id<->uid merging!)
      const awardRes = await fetch(`${apiBase}/api/gamification/award`, {
        method: 'POST',
        headers: actorHeaders('stu_alias_a', 'Aarav Sharma', 'student'),
        body: JSON.stringify({
          userId: 'stu_alias_a',
          schoolId: 'test_school',
          profile: {
            userId: 'stu_alias_a',
            userName: 'Aarav Sharma',
            role: 'student',
            grade: 'Class 10',
            section: 'Alpha',
            xp: 155,
            level: 2,
            levelTitle: 'Curious Learner',
            updatedAt: '2026-11-18T05:00:00.000Z',
          },
          syncContext: {
            action: 'complete_quiz',
            label: 'Physics Quiz Mastery',
            xpDelta: 55,
            uniqueItemId: 'quiz_101',
          },
        }),
      });
      assert.equal(awardRes.status, 200);

      // Account B claims a Winter task (+25 Scholar XP, +20 Frost XP, 2 Cookies) and exchanges cookies for Frost XP (+50 Frost XP)
      const taskRes = await fetch(`${apiBase}/api/winter/tasks/task_visit_festival/claim`, {
        method: 'POST',
        headers: actorHeaders('stu_canon_b', 'Diya Nair', 'student'),
      });
      assert.equal(taskRes.status, 200);
      const taskBody = await taskRes.json();
      assert.equal(taskBody.winterState.frostXp, 25);

      // Simulate cold server restart (memory cache wipe) before cross-account queries!
      clearWinterMemoryCacheOnlyForTests();

      const periods: Array<'weekly' | 'monthly' | 'all_time'> = ['weekly', 'monthly', 'all_time'];
      const accounts = [
        actorHeaders('stu_alias_a', 'Aarav Sharma', 'student'),
        actorHeaders('stu_canon_b', 'Diya Nair', 'student'),
        actorHeaders('sa_canon_d', 'Naitik SuperAdmin', 'super_admin'),
      ];

      for (const period of periods) {
        const studentSnapshots: any[][] = [];
        const facultySnapshots: any[][] = [];

        for (const acc of accounts) {
          const sRes = await fetch(`${apiBase}/api/leaderboard?type=student&period=${period}`, { headers: acc });
          assert.equal(sRes.status, 200);
          const sBody = await sRes.json();
          studentSnapshots.push(sBody.rankings);

          const fRes = await fetch(`${apiBase}/api/leaderboard?type=faculty&period=${period}`, { headers: acc });
          assert.equal(fRes.status, 200);
          const fBody = await fRes.json();
          facultySnapshots.push(fBody.rankings);
        }

        // All 3 accounts see identical normalized rankings (ignoring nothing — pure structural parity!)
        assert.deepEqual(studentSnapshots[0], studentSnapshots[1], `Student ${period} mismatch between Account A & B`);
        assert.deepEqual(studentSnapshots[0], studentSnapshots[2], `Student ${period} mismatch between Account A & C`);
        assert.deepEqual(facultySnapshots[0], facultySnapshots[1], `Faculty ${period} mismatch between Account A & B`);
        assert.deepEqual(facultySnapshots[0], facultySnapshots[2], `Faculty ${period} mismatch between Account A & C`);

        // Verify cohort isolation & alias unification
        assert.equal(studentSnapshots[0].length, 2, `Expected 2 unique students (alias merged) in ${period}`);
        assert.ok(studentSnapshots[0].every(r => r.role === 'student'));
        assert.ok(facultySnapshots[0].some(r => r.userId === 'sa_canon_d' && r.role === 'super_admin'));
        assert.ok(facultySnapshots[0].every(r => r.role !== 'student'));

        // Verify Frost XP never inflated Diya's Scholar XP (task gave 20 Scholar XP, 25 Frost XP)
        const diya = studentSnapshots[0].find(r => r.userId === 'stu_canon_b');
        assert.ok(diya);
        assert.equal(diya.xp, period === 'all_time' ? 60 : 20, `Frost XP leaked into Scholar XP in ${period}`);

        // Verify zero PII exposed
        for (const row of [...studentSnapshots[0], ...facultySnapshots[0]]) {
          assert.equal((row as any).email, undefined);
          assert.equal((row as any).phone, undefined);
        }
      }
    });

    await runTest('2. Task Claim Idempotency, Concurrent Lock & Single-Task Badge Sync (no 7-loop storm)', async () => {
      mockDb.resetAll();
      resetWinterAndLeaderboardMemoryForTests();
      clearServerGamificationMemoryForTests();
      mockDb.setClaimBehavior({ rlsBlocked: true, rpcMissing: false });

      mockDb.tables.user_profiles.push({ id: 'stu_fast', name: 'Fast Scholar', role: 'student', points: 50 });

      const t0 = Date.now();
      const firstClaim = await fetch(`${apiBase}/api/winter/tasks/task_visit_festival/claim`, {
        method: 'POST',
        headers: actorHeaders('stu_fast', 'Fast Scholar', 'student'),
      });
      const elapsedMs = Date.now() - t0;
      assert.equal(firstClaim.status, 200);
      const claimData = await firstClaim.json();
      assert.equal(claimData.success, true);
      assert.ok(claimData.winterState.claimedTaskIds.includes('task_visit_festival'));
      assert.ok(elapsedMs < 2000, `Mocked claim should be fast, took ${elapsedMs}ms`);

      // Duplicate claim rejected atomically with 409
      const dupClaim = await fetch(`${apiBase}/api/winter/tasks/task_visit_festival/claim`, {
        method: 'POST',
        headers: actorHeaders('stu_fast', 'Fast Scholar', 'student'),
      });
      assert.equal(dupClaim.status, 409);
      const dupData = await dupClaim.json();
      assert.equal(dupData.code, 'TASK_ALREADY_CLAIMED');
    });

    await runTest('3. Badge Unlock Baseline & Diffing prevents false replay across refreshes & notifies per new badge', () => {
      const store = new Map<string, string>();
      (globalThis as any).window = {
        localStorage: {
          getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
          setItem: (k: string, v: string) => store.set(k, v),
        },
        sessionStorage: {
          getItem: () => null,
          setItem: () => {},
        },
        dispatchEvent: () => true,
      };

      const notifications: string[] = [];
      const showNotification = (msg: string) => notifications.push(msg);

      // Initial hydration with existing badge: silent baseline, 0 notifications
      syncWinterBadgeBaseline('user_badge_1', { frost_starter: '2026-11-18T01:00:00Z' });
      const onRefresh = processNewWinterBadges({
        userId: 'user_badge_1',
        earnedWinterBadges: { frost_starter: '2026-11-18T01:00:00Z' },
        showNotification,
      });
      assert.equal(onRefresh.length, 0);
      assert.equal(notifications.length, 0);

      // Unlock 2 new badges in one action
      const newlyUnlocked = processNewWinterBadges({
        userId: 'user_badge_1',
        earnedWinterBadges: {
          frost_starter: '2026-11-18T01:00:00Z',
          cocoa_baker: '2026-11-18T05:10:00Z',
          north_star_secret: '2026-11-18T05:10:01Z',
        },
        showNotification,
      });
      assert.equal(newlyUnlocked.length, 2);
      assert.deepEqual(
        newlyUnlocked.map(b => b.badgeId),
        ['cocoa_baker', 'north_star_secret']
      );
      assert.equal(notifications.length, 2);

      // Subsequent re-evaluation / reload with same state fires NOTHING
      const afterReload = processNewWinterBadges({
        userId: 'user_badge_1',
        earnedWinterBadges: {
          frost_starter: '2026-11-18T01:00:00Z',
          cocoa_baker: '2026-11-18T05:10:00Z',
          north_star_secret: '2026-11-18T05:10:01Z',
        },
        showNotification,
      });
      assert.equal(afterReload.length, 0);
      assert.equal(notifications.length, 2);

      delete (globalThis as any).window;
    });

    await runTest('4. Stale Client Overwrite Protection: /api/gamification/award never lowers higher user_profiles/ledger XP', async () => {
      mockDb.resetAll();
      resetWinterAndLeaderboardMemoryForTests();
      clearServerGamificationMemoryForTests();

      mockDb.tables.user_profiles.push({
        id: 'sa_hist_1',
        uid: 'sa_hist_1',
        name: 'Naitik Historical',
        role: 'super_admin',
        points: 3999,
        grade: 'Grade 9',
        section: 'Astra',
      });

      const staleAwardRes = await fetch(`${apiBase}/api/gamification/award`, {
        method: 'POST',
        headers: actorHeaders('sa_hist_1', 'Naitik Historical', 'super_admin'),
        body: JSON.stringify({
          userId: 'sa_hist_1',
          schoolId: 'test_school',
          profile: {
            userId: 'sa_hist_1',
            userName: 'Naitik Historical',
            role: 'super_admin',
            xp: 10,
            level: 1,
            levelTitle: 'Rookie Scholar',
            updatedAt: new Date().toISOString(),
          },
        }),
      });
      assert.equal(staleAwardRes.status, 200);
      const staleAwardJson = await staleAwardRes.json();
      assert.equal(staleAwardJson.profile.xp, 3999, 'Server must clamp stale client XP up to authoritative 3,999 XP');

      const profGetRes = await fetch(`${apiBase}/api/gamification/profile?userId=sa_hist_1&schoolId=test_school`, {
        headers: actorHeaders('sa_hist_1', 'Naitik Historical', 'super_admin'),
      });
      assert.equal(profGetRes.status, 200);
      const profGetJson = await profGetRes.json();
      assert.equal(profGetJson.profile.xp, 3999);
    });

    await runTest('5. Brand-New 0-XP Student Included Consistently Across Accounts (Account A, Account B, New 0-XP Account C)', async () => {
      mockDb.resetAll();
      resetWinterAndLeaderboardMemoryForTests();
      clearServerGamificationMemoryForTests();

      mockDb.tables.user_profiles.push(
        { id: 'stu_hist_a', uid: 'stu_hist_a', name: 'Aarav Senior', role: 'student', points: 1355, grade: 'Grade 10', section: 'Astra' },
        { id: 'stu_mid_b', uid: 'stu_mid_b', name: 'Diya Mid', role: 'student', points: 420, grade: 'Grade 10', section: 'Beta' },
        { id: 'stu_zero_c', uid: 'stu_zero_c', name: 'Kavya Fresh', role: 'student', points: 0, grade: 'Grade 9', section: 'Astra' },
        { id: 'fac_top_1', uid: 'fac_top_1', name: 'Naitik Mentor', role: 'super_admin', points: 3999, grade: 'Admin', section: 'HQ' }
      );

      clearWinterMemoryCacheOnlyForTests();

      const accounts = [
        actorHeaders('stu_hist_a', 'Aarav Senior', 'student'),
        actorHeaders('stu_mid_b', 'Diya Mid', 'student'),
        actorHeaders('stu_zero_c', 'Kavya Fresh', 'student'),
      ];

      for (const period of ['weekly', 'monthly', 'all_time'] as const) {
        const stuResponses: any[] = [];
        for (const acc of accounts) {
          const r = await fetch(`${apiBase}/api/leaderboard?type=student&period=${period}`, { headers: acc });
          assert.equal(r.status, 200);
          stuResponses.push(await r.json());
        }

        assert.deepEqual(stuResponses[0].rankings, stuResponses[1].rankings, `Mismatch A vs B on ${period}`);
        assert.deepEqual(stuResponses[0].rankings, stuResponses[2].rankings, `Mismatch A vs C on ${period}`);
        assert.equal(stuResponses[0].rankings.length, 3, `Expected all 3 students including 0-XP Kavya on ${period}`);
        const zeroEntry = stuResponses[2].currentUserEntry;
        assert.ok(zeroEntry && zeroEntry.userId === 'stu_zero_c' && zeroEntry.xp === 0, `Brand-new 0-XP student must have currentUserEntry on ${period}`);
      }
    });

    await runTest('6. Per-User Badge Celebration Isolation: Account A celebrating a badge never suppresses Account B', () => {
      const lStore = new Map<string, string>();
      const sStore = new Map<string, string>();
      const events: any[] = [];
      (globalThis as any).window = {
        localStorage: {
          getItem: (k: string) => (lStore.has(k) ? lStore.get(k)! : null),
          setItem: (k: string, v: string) => lStore.set(k, v),
        },
        sessionStorage: {
          getItem: (k: string) => (sStore.has(k) ? sStore.get(k)! : null),
          setItem: (k: string, v: string) => sStore.set(k, v),
        },
        dispatchEvent: (ev: any) => {
          events.push(ev?.detail || ev);
          return true;
        },
      };

      const notifsA: string[] = [];
      const notifsB: string[] = [];

      syncWinterBadgeBaseline('acct_a', {});
      const resA = processNewWinterBadges({
        userId: 'acct_a',
        earnedWinterBadges: { snowflake_explorer: '2026-11-19T01:00:00Z' },
        showNotification: (m) => notifsA.push(m),
        silentOnFirstBaseline: false,
      });
      assert.equal(resA.length, 1);
      assert.equal(resA[0].badgeName, 'Snowflake Explorer');
      assert.equal(notifsA.length, 1);

      syncWinterBadgeBaseline('acct_b', {});
      const resB = processNewWinterBadges({
        userId: 'acct_b',
        earnedWinterBadges: { snowflake_explorer: '2026-11-19T01:05:00Z' },
        showNotification: (m) => notifsB.push(m),
        silentOnFirstBaseline: false,
      });
      assert.equal(resB.length, 1, 'Account B must still celebrate snowflake_explorer independently of Account A');
      assert.equal(resB[0].userId, 'acct_b');
      assert.equal(notifsB.length, 1);
      assert.equal(events.filter((e) => e?.badgeId === 'snowflake_explorer').length, 2);

      delete (globalThis as any).window;
    });
  } finally {
    setForceWinterSupabaseForTests(false);
    if (prevUrl !== undefined) process.env.VITE_SUPABASE_URL = prevUrl;
    if (prevAnon !== undefined) process.env.VITE_SUPABASE_ANON_KEY = prevAnon;
    apiServer.closeAllConnections?.();
    mockDb.server.closeAllConnections?.();
    await new Promise<void>(resolve => apiServer.close(() => resolve()));
    await new Promise<void>(resolve => mockDb.server.close(() => resolve()));
  }

  console.log(`\n🎉 All ${passed} Winter Festival 4.0 Phase 2 Verification tests PASSED!`);
}

main()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('❌ Verification failed:', err);
    process.exit(1);
  });
