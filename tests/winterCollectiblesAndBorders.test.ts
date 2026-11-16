/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Veylentra — Winter Collectibles, Winter Borders, RLS Recovery & Faculty Leaderboard Verification Suite
 */

import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import http from 'node:http';
import { AddressInfo } from 'node:net';
import { app } from '../server';
import {
  clearWinterMemoryCacheOnlyForTests,
  executeSantaGiftClaim,
  executeSpinWheel,
  loadUserWinterState,
  resetWinterAndLeaderboardMemoryForTests,
  saveUserWinterState,
  setForceWinterSupabaseForTests,
} from '../server/winterFestivalModule';
import {
  getAllWinterCollectibleIds,
  SANTA_REWARD_TIERS,
  SPIN_WHEEL_SEGMENTS,
  WINTER_FESTIVAL_BADGES,
  WINTER_FESTIVAL_TASKS,
  WINTER_PROFILE_BORDERS,
  WINTER_PROFILE_FRAMES,
} from '../server/rewardEngine';
import { WORKING_ANON_KEY } from '../server/supabaseKeyManager';

let passed = 0;
async function runTest(name: string, fn: () => Promise<void> | void) {
  await fn();
  passed += 1;
  console.log(`✅ [PASS] ${name}`);
}

function createExtendedMockSupabaseServer() {
  const tables: Record<string, any[]> = {
    winter_user_profiles: [],
    winter_task_claims: [],
    winter_user_badges: [],
    winter_reward_ledger: [],
    gamification_xp_ledger: [],
    user_profiles: [],
    global_data: [],
    platform_features: [],
  };

  let injectedFailures: Array<{
    table?: string;
    method?: string;
    rpcName?: string;
    status: number;
    code?: string;
    message: string;
  }> = [];

  let queryCounts: Record<string, number> = {};

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

  function hasUniqueConflict(tableName: string, row: any): boolean {
    const existing = tables[tableName] || [];
    if (tableName === 'winter_user_profiles') return existing.some(r => r.user_id === row.user_id);
    if (tableName === 'winter_task_claims') return existing.some(r => r.user_id === row.user_id && r.task_id === row.task_id);
    if (tableName === 'winter_user_badges') return existing.some(r => r.user_id === row.user_id && r.badge_id === row.badge_id);
    if (tableName === 'winter_reward_ledger') {
      return existing.some(
        r =>
          r.id === row.id ||
          (r.user_id === row.user_id && r.feature_type === row.feature_type && r.idempotency_key === row.idempotency_key) ||
          (r.feature_type === 'santa_gift' && r.user_id === row.user_id && r.event_night_key && r.event_night_key === row.event_night_key)
      );
    }
    if (tableName === 'gamification_xp_ledger') {
      return existing.some(r => r.id === row.id || (r.user_id === row.user_id && r.action_key === row.action_key));
    }
    if (tableName === 'global_data') return existing.some(r => r.id === row.id);
    return false;
  }

  const server = http.createServer(async (req, res) => {
    const parsed = new URL(req.url || '/', 'http://127.0.0.1');
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(Buffer.from(chunk));
    const bodyStr = Buffer.concat(chunks).toString('utf8');
    const bodyJson = bodyStr ? JSON.parse(bodyStr) : undefined;

    // Handle RPC endpoints
    const rpcMatch = parsed.pathname.match(/^\/rest\/v1\/rpc\/([^/]+)$/);
    if (rpcMatch) {
      const rpcName = rpcMatch[1];
      queryCounts[`RPC:${rpcName}`] = (queryCounts[`RPC:${rpcName}`] || 0) + 1;

      const failRule = injectedFailures.find(f => f.rpcName === rpcName);
      if (failRule) {
        res.writeHead(failRule.status, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ code: failRule.code || String(failRule.status), message: failRule.message }));
        return;
      }

      if (rpcName === 'claim_winter_task_secure') {
        const uid = String(bodyJson?.p_user_id || '');
        const taskId = String(bodyJson?.p_task_id || '');
        const dup = tables.winter_task_claims.some(r => r.user_id === uid && r.task_id === taskId);
        if (dup) {
          res.writeHead(409, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ code: '23505', message: 'duplicate key value violates unique constraint winter_task_claims_pkey' }));
          return;
        }
        const row = {
          id: bodyJson?.p_claim_id,
          user_id: uid,
          task_id: taskId,
          xp_awarded: Number(bodyJson?.p_xp_awarded || 0),
          cookies_awarded: Number(bodyJson?.p_cookies_awarded || 0),
          claimed_at: bodyJson?.p_claimed_at || new Date().toISOString(),
        };
        tables.winter_task_claims.push(row);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(row));
        return;
      }

      if (rpcName === 'rollback_winter_task_claim_secure') {
        const uid = String(bodyJson?.p_user_id || '');
        const id = String(bodyJson?.p_claim_id || '');
        const before = tables.winter_task_claims.length;
        tables.winter_task_claims = tables.winter_task_claims.filter(
          r => !(r.user_id === uid && r.id === id)
        );
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(before > tables.winter_task_claims.length));
        return;
      }

      if (rpcName === 'sync_winter_badge_secure') {
        const uid = String(bodyJson?.p_user_id || '');
        const badgeId = String(bodyJson?.p_badge_id || '');
        const idx = tables.winter_user_badges.findIndex(r => r.user_id === uid && r.badge_id === badgeId);
        const row = {
          id: bodyJson?.p_row_id || `${uid}__${badgeId}`,
          user_id: uid,
          badge_id: badgeId,
          rarity: bodyJson?.p_rarity || 'seasonal',
          unlocked_at: bodyJson?.p_unlocked_at || new Date().toISOString(),
        };
        if (idx >= 0) tables.winter_user_badges[idx] = row;
        else tables.winter_user_badges.push(row);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(true));
        return;
      }

      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ message: `RPC ${rpcName} not found` }));
      return;
    }

    const match = parsed.pathname.match(/^\/rest\/v1\/([^/]+)$/);
    if (!match) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ message: 'Not found' }));
      return;
    }

    const tableName = match[1];
    queryCounts[`${req.method}:${tableName}`] = (queryCounts[`${req.method}:${tableName}`] || 0) + 1;

    const failRule = injectedFailures.find(
      f => !f.rpcName && (!f.table || f.table === tableName) && (!f.method || f.method === req.method)
    );
    if (failRule) {
      res.writeHead(failRule.status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ code: failRule.code || String(failRule.status), message: failRule.message }));
      return;
    }

    if (!tables[tableName]) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ code: 'PGRST205', message: `Missing table ${tableName}` }));
      return;
    }

    if (req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(filterRows(tableName, parsed.searchParams)));
      return;
    }

    if (req.method === 'POST') {
      const prefer = String(req.headers['prefer'] || '');
      const items = Array.isArray(bodyJson) ? bodyJson : [bodyJson];
      const onConflict = parsed.searchParams.get('on_conflict');
      const isMerge = prefer.includes('resolution=merge-duplicates');
      const isIgnore = prefer.includes('resolution=ignore-duplicates');

      for (const item of items) {
        if (hasUniqueConflict(tableName, item)) {
          if (isIgnore) continue;
          if (isMerge && onConflict) {
            const keys = onConflict.split(',');
            const idx = tables[tableName].findIndex(r => keys.every(k => String(r[k]) === String(item[k])));
            if (idx >= 0) {
              tables[tableName][idx] = { ...tables[tableName][idx], ...item };
              continue;
            }
          }
          res.writeHead(409, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ code: '23505', message: `duplicate key on ${tableName}` }));
          return;
        }
        tables[tableName].push({ ...item });
      }
      res.writeHead(201, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(items));
      return;
    }

    if (req.method === 'PATCH') {
      const updated: any[] = [];
      for (const row of tables[tableName]) {
        let matched = true;
        for (const [k, v] of parsed.searchParams.entries()) {
          if (k === 'select') continue;
          if (k === 'or' && v.startsWith('(') && v.endsWith(')')) {
            const parts = v.slice(1, -1).split(',');
            matched = parts.some(p => {
              const dotIdx = p.indexOf('.');
              return dotIdx !== -1 && matchesCondition(row, p.slice(0, dotIdx), p.slice(dotIdx + 1));
            });
          } else if (!matchesCondition(row, k, v)) {
            matched = false;
          }
          if (!matched) break;
        }
        if (matched) {
          Object.assign(row, bodyJson || {});
          updated.push(row);
        }
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(updated));
      return;
    }

    if (req.method === 'DELETE') {
      const toKeep: any[] = [];
      for (const row of tables[tableName]) {
        let matched = true;
        for (const [k, v] of parsed.searchParams.entries()) {
          if (!matchesCondition(row, k, v)) {
            matched = false;
            break;
          }
        }
        if (!matched) toKeep.push(row);
      }
      tables[tableName] = toKeep;
      res.writeHead(204);
      res.end();
      return;
    }

    res.writeHead(405);
    res.end();
  });

  return {
    tables,
    server,
    setFailureRules(rules: typeof injectedFailures) {
      injectedFailures = rules;
    },
    getQueryCounts() {
      return { ...queryCounts };
    },
    resetCounts() {
      queryCounts = {};
    },
    resetAll() {
      for (const k of Object.keys(tables)) tables[k] = [];
      injectedFailures = [];
      queryCounts = {};
    },
  };
}

async function main() {
  const mockDb = createExtendedMockSupabaseServer();
  await new Promise<void>((resolve) => mockDb.server.listen(0, '127.0.0.1', resolve));
  const mockPort = (mockDb.server.address() as AddressInfo).port;
  const mockUrl = `http://127.0.0.1:${mockPort}`;

  const apiServer = http.createServer(app);
  await new Promise<void>((resolve) => apiServer.listen(0, '127.0.0.1', resolve));
  const apiPort = (apiServer.address() as AddressInfo).port;
  const apiBase = `http://127.0.0.1:${apiPort}`;

  const prevUrl = process.env.VITE_SUPABASE_URL;
  const prevKey = process.env.VITE_SUPABASE_ANON_KEY;
  process.env.VITE_SUPABASE_URL = mockUrl;
  process.env.VITE_SUPABASE_ANON_KEY = WORKING_ANON_KEY;
  setForceWinterSupabaseForTests(true);

  const actorHeaders = (uid: string, name: string, role: string, email = `${uid}@veylentra.edu`) => ({
    'Content-Type': 'application/json',
    'x-veylentra-uid': uid,
    'x-veylentra-name': name,
    'x-veylentra-role': role,
    'x-veylentra-email': email,
  });

  try {
    // 1. Faculty XP Leaderboard & Deterministic Tie-Breaking & Zero PII
    await runTest('Part 1: Faculty Leaderboard excludes students, includes all faculty roles, uses deterministic tie-breaking, and exposes zero PII', async () => {
      mockDb.resetAll();
      resetWinterAndLeaderboardMemoryForTests();

      // Seed 60 high-XP students to ensure students cannot crowd out faculty in user_profiles
      for (let i = 0; i < 60; i++) {
        mockDb.tables.user_profiles.push({
          id: `stu_${i}`,
          uid: `stu_${i}`,
          name: `Student ${i}`,
          email: `stu_${i}@private.edu`,
          phone: `+1555000${i}`,
          role: 'student',
          points: 5000 + i,
          raw_data: { secretNotes: 'private', currentStreak: 4 },
        });
      }

      // Seed Faculty across all faculty roles, including equal-XP tie pair
      mockDb.tables.user_profiles.push(
        { id: 'fac_z', uid: 'fac_z', name: 'Dr. Zeke', email: 'zeke@private.edu', role: 'teacher', points: 400, raw_data: { currentStreak: 2 } },
        { id: 'fac_a', uid: 'fac_a', name: 'Dr. Alice', email: 'alice@private.edu', role: 'coordinator', points: 400, raw_data: { currentStreak: 6 } },
        { id: 'fac_hod', uid: 'fac_hod', name: 'Prof. Patel', email: 'patel@private.edu', role: 'hod', points: 850, raw_data: { currentStreak: 9 } },
        { id: 'fac_sa', uid: 'fac_sa', name: 'Dean Rao', email: 'rao@private.edu', role: 'super_admin', points: 620, raw_data: { currentStreak: 5 } },
        { id: 'fac_adm', uid: 'fac_adm', name: 'Registrar Kim', email: 'kim@private.edu', role: 'admin', points: 510, raw_data: { currentStreak: 3 } }
      );
      mockDb.tables.gamification_xp_ledger.push({
        id: 'led_hod_1',
        user_id: 'fac_hod',
        user_name: 'Prof. Patel',
        user_role: 'hod',
        xp_delta: 50,
        source_type: 'xp_action',
        action_key: 'act_1',
        created_at: new Date().toISOString(),
      });

      const res = await fetch(`${apiBase}/api/leaderboard?type=faculty&period=weekly`, {
        headers: actorHeaders('fac_a', 'Dr. Alice', 'coordinator'),
      });
      assert.equal(res.status, 200);
      const body = await res.json();
      assert.equal(body.success, true);
      assert.equal(body.type, 'faculty');
      assert.equal(body.rankings.length, 5, 'All 5 faculty roles must be ranked without student crowding');
      assert.equal(body.rankings[0].userId, 'fac_hod');
      assert.equal(body.rankings[1].userId, 'fac_sa');
      assert.equal(body.rankings[2].userId, 'fac_adm');
      // Tie-breaker: both have 400 XP, so alphabetical name ('Dr. Alice' < 'Dr. Zeke') must win rank 4
      assert.equal(body.rankings[3].userId, 'fac_a');
      assert.equal(body.rankings[4].userId, 'fac_z');
      for (const r of body.rankings) {
        assert.equal((r as any).email, undefined);
        assert.equal((r as any).phone, undefined);
        assert.equal((r as any).raw_data, undefined);
        assert.ok(r.equippedBorder === null || typeof r.equippedBorder === 'string');
      }
    });

    await runTest('Part 1B: Empty Faculty Leaderboard resolves cleanly with 200 and rankings: []', async () => {
      mockDb.resetAll();
      resetWinterAndLeaderboardMemoryForTests();
      const res = await fetch(`${apiBase}/api/leaderboard?type=faculty&period=all_time`, {
        headers: actorHeaders('fac_empty', 'Teacher One', 'teacher'),
      });
      assert.equal(res.status, 200);
      const body = await res.json();
      assert.equal(body.success, true);
      assert.deepEqual(body.rankings, []);
      assert.equal(mockDb.getQueryCounts()['GET:winter_user_profiles'] || 0, 0);
    });

    // 2. RLS 42501 Recovery, Atomic 409 & Rollback
    await runTest('Part 2A: Task claim auto-recovers from 42501 RLS on winter_task_claims via claim_winter_task_secure RPC and grants border + badge', async () => {
      mockDb.resetAll();
      resetWinterAndLeaderboardMemoryForTests();
      mockDb.setFailureRules([
        {
          table: 'winter_task_claims',
          method: 'POST',
          status: 401,
          code: '42501',
          message: 'new row violates row-level security policy for table "winter_task_claims"',
        },
        {
          table: 'winter_user_badges',
          method: 'POST',
          status: 401,
          code: '42501',
          message: 'new row violates row-level security policy for table "winter_user_badges"',
        },
      ]);

      const claimRes = await fetch(`${apiBase}/api/winter/tasks/task_visit_festival/claim`, {
        method: 'POST',
        headers: actorHeaders('stu_rls_1', 'Riya', 'student'),
      });
      assert.equal(claimRes.status, 200);
      const claimBody = await claimRes.json();
      assert.equal(claimBody.success, true);
      assert.equal(mockDb.getQueryCounts()['RPC:claim_winter_task_secure'], 1);
      assert.equal(mockDb.getQueryCounts()['RPC:sync_winter_badge_secure'], 1);
      assert.ok(claimBody.winterState.unlockedBorders.includes('frosted_ice_border'));
      assert.ok(claimBody.winterState.earnedWinterBadges.snowflake_explorer);

      // Duplicate claim MUST reject with 409 even through RPC path
      const dupRes = await fetch(`${apiBase}/api/winter/tasks/task_visit_festival/claim`, {
        method: 'POST',
        headers: actorHeaders('stu_rls_1', 'Riya', 'student'),
      });
      assert.equal(dupRes.status, 409);
      const dupBody = await dupRes.json();
      assert.equal(dupBody.code, 'TASK_ALREADY_CLAIMED');
    });

    await runTest('Part 2B: Downstream profile save failure rolls back task claim via rollback_winter_task_claim_secure; total RLS block returns safe 503 with zero XP mutation', async () => {
      mockDb.resetAll();
      resetWinterAndLeaderboardMemoryForTests();
      mockDb.setFailureRules([
        {
          table: 'winter_task_claims',
          method: 'POST',
          status: 401,
          code: '42501',
          message: 'new row violates row-level security policy for table "winter_task_claims"',
        },
        {
          table: 'winter_user_profiles',
          method: 'POST',
          status: 500,
          message: 'simulated DB error during state save',
        },
      ]);

      const failRes = await fetch(`${apiBase}/api/winter/tasks/task_visit_festival/claim`, {
        method: 'POST',
        headers: actorHeaders('stu_rollback_1', 'Dev', 'student'),
      });
      assert.equal(failRes.status, 503);
      assert.equal(mockDb.getQueryCounts()['RPC:rollback_winter_task_claim_secure'], 1);
      assert.equal(mockDb.tables.winter_task_claims.length, 0, 'Task claim row must be rolled back');
      assert.equal(mockDb.tables.gamification_xp_ledger.length, 0, 'XP must not be granted on rollback');

      // Both table and RPC blocked -> clean 503 WINTER_TASK_CLAIMS_RLS_BLOCKED
      mockDb.resetAll();
      resetWinterAndLeaderboardMemoryForTests();
      mockDb.setFailureRules([
        {
          table: 'winter_task_claims',
          method: 'POST',
          status: 401,
          code: '42501',
          message: 'RLS blocked',
        },
        {
          rpcName: 'claim_winter_task_secure',
          status: 404,
          code: 'PGRST202',
          message: 'Could not find the function public.claim_winter_task_secure',
        },
      ]);

      const rlsErrRes = await fetch(`${apiBase}/api/winter/tasks/task_visit_festival/claim`, {
        method: 'POST',
        headers: actorHeaders('stu_rls_2', 'Sam', 'student'),
      });
      assert.equal(rlsErrRes.status, 503);
      const rlsErrBody = await rlsErrRes.json();
      assert.equal(rlsErrBody.code, 'WINTER_TASK_CLAIMS_RLS_BLOCKED');
      assert.equal(mockDb.tables.gamification_xp_ledger.length, 0, 'No XP mutation when claim blocked');
    });

    // 3. Complete Collectibles Unlock Matrix (4 Frames, 9 Badges, 5 Borders)
    await runTest('Part 3 & 4: Full Collectibles Matrix — 4 Frames, 9 Badges, 5 Borders have real unlock paths & persist across refresh', async () => {
      mockDb.resetAll();
      resetWinterAndLeaderboardMemoryForTests();

      const ids = getAllWinterCollectibleIds();
      assert.deepEqual(ids.frameIds.sort(), ['aurora_crown', 'candy_ribbon', 'frosted_aurora', 'starlight_gold']);
      assert.equal(ids.badgeIds.length, 9);
      assert.deepEqual(ids.borderIds.sort(), [
        'candy_cane_border',
        'frosted_ice_border',
        'golden_festival_border',
        'snowflake_border',
        'winter_glow_border',
      ]);

      const uid = 'stu_collector_1';
      // Path A: Unlock all 5 tasks cleanly
      // 1) task_visit_festival -> snowflake_explorer + frosted_ice_border
      let r = await fetch(`${apiBase}/api/winter/tasks/task_visit_festival/claim`, {
        method: 'POST',
        headers: actorHeaders(uid, 'Aarav', 'student'),
      });
      assert.equal(r.status, 200);

      // 2) Pass Quiz + claim task_winter_quiz -> winter_scholar + snowflake_border
      const qRes = await fetch(`${apiBase}/api/winter/quiz/submit`, {
        method: 'POST',
        headers: actorHeaders(uid, 'Aarav', 'student'),
        body: JSON.stringify({ answers: { wq_1: 1, wq_2: 2, wq_3: 1 } }),
      });
      assert.equal(qRes.status, 200);
      r = await fetch(`${apiBase}/api/winter/tasks/task_winter_quiz/claim`, {
        method: 'POST',
        headers: actorHeaders(uid, 'Aarav', 'student'),
      });
      assert.equal(r.status, 200);

      // 3) task_academic_engagement -> frosty_focus + winter_glow_border
      r = await fetch(`${apiBase}/api/winter/tasks/task_academic_engagement/claim`, {
        method: 'POST',
        headers: actorHeaders(uid, 'Aarav', 'student'),
      });
      assert.equal(r.status, 200);

      // 4) task_collect_cookies (already 2+3+3=8 cookies >= 5!) -> cookie_collector + candy_cane_border
      r = await fetch(`${apiBase}/api/winter/tasks/task_collect_cookies/claim`, {
        method: 'POST',
        headers: actorHeaders(uid, 'Aarav', 'student'),
      });
      assert.equal(r.status, 200);

      // 5) Spin Wheel (Jackpot -> winter_wheel_ace + candy_ribbon + golden_festival_border) + Santa Rare/Legendary/Insane via deterministic crypto.randomInt
      const origRandomInt = crypto.randomInt;
      const stubRandomInt = (val: number) => {
        (crypto as any).randomInt = () => val;
      };

      try {
        // Segment 7 (frost_jackpot) weight range is [9700, 10000)
        stubRandomInt(9800);
        const spinRes = await executeSpinWheel({
          user: { id: uid, name: 'Aarav', role: 'student' },
          getSupabaseServerConfig: () => ({ url: mockUrl, key: WORKING_ANON_KEY }),
          idempotencyKey: 'spin_jackpot_matrix',
        });
        assert.equal(spinRes.statusCode, 200);
        assert.equal(spinRes.body.reward.frameId, 'candy_ribbon');
        assert.equal(spinRes.body.reward.borderId, 'golden_festival_border');

        // 6) Claim task_seasonal_wheel_or_gift -> winter_champion
        r = await fetch(`${apiBase}/api/winter/tasks/task_seasonal_wheel_or_gift/claim`, {
          method: 'POST',
          headers: actorHeaders(uid, 'Aarav', 'student'),
        });
        assert.equal(r.status, 200);

        // 7) Claim Santa Rare / Legendary / Insane tiers across distinct nights
        const santaNights = [
          { key: '2026-12-20', rollVal: 7000 }, // rare -> frosted_aurora + winter_glow_border
          { key: '2026-12-21', rollVal: 9000 }, // legendary -> sleigh_keeper + starlight_gold + golden_festival_border
          { key: '2026-12-22', rollVal: 9800 }, // insane -> aurora_miracle + aurora_crown + golden_festival_border
        ];
        for (const sn of santaNights) {
          stubRandomInt(sn.rollVal);
          const sRes = await executeSantaGiftClaim({
            user: { id: uid, name: 'Aarav', role: 'student' },
            getSupabaseServerConfig: () => ({ url: mockUrl, key: WORKING_ANON_KEY }),
            idempotencyKey: `santa_${sn.key}`,
            nowMs: Date.parse(`${sn.key}T19:30:00+05:30`),
          });
          assert.equal(sRes.statusCode, 200);
        }
      } finally {
        (crypto as any).randomInt = origRandomInt;
      }

      // Also verify every Frame, Badge, & Border has a documented unlock path in rewardEngine
      for (const f of WINTER_PROFILE_FRAMES) {
        const reachable =
          SANTA_REWARD_TIERS.some(t => t.frameId === f.id) ||
          SPIN_WHEEL_SEGMENTS.some(s => s.frameId === f.id);
        assert.ok(reachable, `Frame ${f.id} must have a reachable unlock path`);
      }
      for (const b of WINTER_PROFILE_BORDERS) {
        const reachable =
          WINTER_FESTIVAL_TASKS.some(t => t.borderId === b.id) ||
          SANTA_REWARD_TIERS.some(t => t.borderId === b.id) ||
          SPIN_WHEEL_SEGMENTS.some(s => s.borderId === b.id) ||
          b.id === 'golden_festival_border';
        assert.ok(reachable, `Border ${b.id} must have a reachable unlock path`);
      }

      // Clear memory cache to simulate full browser refresh / cold server restart!
      clearWinterMemoryCacheOnlyForTests();

      const statusRes = await fetch(`${apiBase}/api/winter/status`, {
        headers: actorHeaders(uid, 'Aarav', 'student'),
      });
      assert.equal(statusRes.status, 200);
      const statusBody = await statusRes.json();

      // Verify all 4 Frames unlocked
      for (const f of WINTER_PROFILE_FRAMES) {
        assert.ok(statusBody.winterState.unlockedFrames.includes(f.id), `Expected frame unlocked: ${f.id}`);
      }
      // Verify all 5 Borders unlocked
      for (const b of WINTER_PROFILE_BORDERS) {
        assert.ok(statusBody.winterState.unlockedBorders.includes(b.id), `Expected border unlocked: ${b.id}`);
      }
      // Verify all 9 Badges earned (including north_star_secret since >=15 cookies & >=3 tasks!)
      for (const badge of WINTER_FESTIVAL_BADGES) {
        assert.ok(statusBody.winterState.earnedWinterBadges[badge.id], `Expected badge unlocked: ${badge.id}`);
      }
    });

    // 4. Equip/Unequip Ownership & Stacking + Negative Tests
    await runTest('Part 5 & 6: Stackable Frame + Border equip/unequip, 403 unowned, 400 invalid ID, 401 unauthenticated, and Leaderboard display', async () => {
      // Unauthenticated -> 401
      const unauthBorder = await fetch(`${apiBase}/api/winter/profile/border`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ borderId: 'frosted_ice_border' }),
      });
      assert.equal(unauthBorder.status, 401);

      const freshUid = 'stu_cos_test';
      await saveUserWinterState(() => ({ url: mockUrl, key: WORKING_ANON_KEY }), {
        userId: freshUid,
        userName: 'Mira',
        userRole: 'student',
        cookiesCount: 3,
        streakShields: 0,
        unlockedFrames: ['frosted_aurora'],
        equippedFrame: null,
        unlockedBorders: ['frosted_ice_border', 'candy_cane_border'],
        equippedBorder: null,
        spinNextEligibleAt: null,
        lastSpinAt: null,
        lastWheelNotifiedCycle: null,
        aiBonusDate: '2026-12-20',
        aiBonusCreditsToday: 0,
        quizCompleted: false,
        claimedTaskIds: [],
        earnedWinterBadges: {},
        santaClaimedNights: {},
        rewardHistory: [],
        updatedAt: new Date().toISOString(),
      });

      // 400 Invalid border ID
      const badBorder = await fetch(`${apiBase}/api/winter/profile/border`, {
        method: 'POST',
        headers: actorHeaders(freshUid, 'Mira', 'student'),
        body: JSON.stringify({ borderId: 'nonexistent_border' }),
      });
      assert.equal(badBorder.status, 400);

      // 400 Invalid frame ID
      const badFrame = await fetch(`${apiBase}/api/winter/profile/frame`, {
        method: 'POST',
        headers: actorHeaders(freshUid, 'Mira', 'student'),
        body: JSON.stringify({ frameId: 'nonexistent_frame' }),
      });
      assert.equal(badFrame.status, 400);

      // 403 Unowned border
      const lockedBorder = await fetch(`${apiBase}/api/winter/profile/border`, {
        method: 'POST',
        headers: actorHeaders(freshUid, 'Mira', 'student'),
        body: JSON.stringify({ borderId: 'golden_festival_border' }),
      });
      assert.equal(lockedBorder.status, 403);

      // 403 Unowned frame
      const lockedFrame = await fetch(`${apiBase}/api/winter/profile/frame`, {
        method: 'POST',
        headers: actorHeaders(freshUid, 'Mira', 'student'),
        body: JSON.stringify({ frameId: 'aurora_crown' }),
      });
      assert.equal(lockedFrame.status, 403);

      // Equip BOTH Frame + Border simultaneously (stacking!)
      const eqF = await fetch(`${apiBase}/api/winter/profile/frame`, {
        method: 'POST',
        headers: actorHeaders(freshUid, 'Mira', 'student'),
        body: JSON.stringify({ frameId: 'frosted_aurora' }),
      });
      assert.equal(eqF.status, 200);

      const eqB = await fetch(`${apiBase}/api/winter/profile/border`, {
        method: 'POST',
        headers: actorHeaders(freshUid, 'Mira', 'student'),
        body: JSON.stringify({ borderId: 'candy_cane_border' }),
      });
      assert.equal(eqB.status, 200);

      // Verify after memory clear via public cosmetics endpoint
      clearWinterMemoryCacheOnlyForTests();
      const cosRes = await fetch(`${apiBase}/api/winter/profile/cosmetics/${freshUid}`);
      assert.equal(cosRes.status, 200);
      const cosBody = await cosRes.json();
      assert.equal(cosBody.cosmetics.equippedFrame, 'frosted_aurora');
      assert.equal(cosBody.cosmetics.equippedBorder, 'candy_cane_border');

      // Seed XP so Mira appears on Student Leaderboard and verify leaderboard shows BOTH equippedFrame + equippedBorder
      mockDb.tables.user_profiles.push({
        id: freshUid,
        uid: freshUid,
        name: 'Mira',
        role: 'student',
        points: 350,
      });
      const lbRes = await fetch(`${apiBase}/api/leaderboard?type=student&period=all_time`, {
        headers: actorHeaders(freshUid, 'Mira', 'student'),
      });
      const lbBody = await lbRes.json();
      const miraEntry = lbBody.rankings.find((r: any) => r.userId === freshUid);
      assert.ok(miraEntry);
      assert.equal(miraEntry.equippedFrame, 'frosted_aurora');
      assert.equal(miraEntry.equippedBorder, 'candy_cane_border');

      // Unequip border cleanly
      const unB = await fetch(`${apiBase}/api/winter/profile/border`, {
        method: 'POST',
        headers: actorHeaders(freshUid, 'Mira', 'student'),
        body: JSON.stringify({ borderId: null }),
      });
      assert.equal(unB.status, 200);
      const reloaded = await loadUserWinterState(
        () => ({ url: mockUrl, key: WORKING_ANON_KEY }),
        { id: freshUid, name: 'Mira', role: 'student' }
      );
      assert.equal(reloaded.equippedBorder, null);
      assert.equal(reloaded.equippedFrame, 'frosted_aurora', 'Unequipping border must preserve equipped frame');
    });

    // 5. Feature Flags & Super Admin Preview Isolation
    await runTest('Part 7: Feature flag gating preserves existing collectibles; Super Admin Spin/Santa preview never persists real rewards', async () => {
      const uid = 'stu_cos_test';

      // Turn OFF winter_badges via real Super Admin feature endpoint -> equipping must reject 403, NOT delete unlocked inventory
      const disableRes = await fetch(`${apiBase}/api/features/winter_badges`, {
        method: 'PATCH',
        headers: actorHeaders('sa_flag_admin', 'Super Admin', 'super_admin'),
        body: JSON.stringify({ enabled: false, reason: 'Test feature gating' }),
      });
      assert.equal(disableRes.status, 200);

      const gatedRes = await fetch(`${apiBase}/api/winter/profile/border`, {
        method: 'POST',
        headers: actorHeaders(uid, 'Mira', 'student'),
        body: JSON.stringify({ borderId: 'frosted_ice_border' }),
      });
      assert.equal(gatedRes.status, 403);

      // Re-enable winter_badges -> unlocked inventory is intact and equippable again!
      const enableRes = await fetch(`${apiBase}/api/features/winter_badges`, {
        method: 'PATCH',
        headers: actorHeaders('sa_flag_admin', 'Super Admin', 'super_admin'),
        body: JSON.stringify({ enabled: true, reason: 'Restore feature' }),
      });
      assert.equal(enableRes.status, 200);

      const restoredRes = await fetch(`${apiBase}/api/winter/profile/border`, {
        method: 'POST',
        headers: actorHeaders(uid, 'Mira', 'student'),
        body: JSON.stringify({ borderId: 'frosted_ice_border' }),
      });
      assert.equal(restoredRes.status, 200);

      // Super Admin Spin Preview must NOT write spin cooldown or ledger
      const saUid = 'sa_preview_test';
      const spinPrev = await fetch(`${apiBase}/api/winter/spin`, {
        method: 'POST',
        headers: actorHeaders(saUid, 'Super Admin', 'super_admin'),
        body: JSON.stringify({ idempotencyKey: 'preview_spin_1', isPreview: true }),
      });
      assert.equal(spinPrev.status, 200);
      const spinPrevBody = await spinPrev.json();
      assert.equal(spinPrevBody.isPreview, true);

      const saState = await loadUserWinterState(
        () => ({ url: mockUrl, key: WORKING_ANON_KEY }),
        { id: saUid, name: 'Super Admin', role: 'super_admin' }
      );
      assert.equal(saState.lastSpinAt, null, 'Preview spin must not trigger real spin cooldown');
      assert.equal(saState.rewardHistory.length, 0, 'Preview spin must not save rewards');

      // Super Admin Santa Preview must NOT consume tonight's claim
      const santaPrev = await fetch(`${apiBase}/api/winter/santa/claim`, {
        method: 'POST',
        headers: actorHeaders(saUid, 'Super Admin', 'super_admin'),
        body: JSON.stringify({ idempotencyKey: 'preview_santa_1', isPreview: true }),
      });
      assert.equal(santaPrev.status, 200);
      const santaPrevBody = await santaPrev.json();
      assert.equal(santaPrevBody.isPreview, true);
      const saStateAfterSanta = await loadUserWinterState(
        () => ({ url: mockUrl, key: WORKING_ANON_KEY }),
        { id: saUid, name: 'Super Admin', role: 'super_admin' }
      );
      assert.equal(Object.keys(saStateAfterSanta.santaClaimedNights).length, 0);
    });

    console.log(`\n🎉 All ${passed} Winter Collectibles, Borders, RLS & Faculty Leaderboard tests passed!`);
  } finally {
    setForceWinterSupabaseForTests(false);
    if (prevUrl === undefined) delete process.env.VITE_SUPABASE_URL;
    else process.env.VITE_SUPABASE_URL = prevUrl;
    if (prevKey === undefined) delete process.env.VITE_SUPABASE_ANON_KEY;
    else process.env.VITE_SUPABASE_ANON_KEY = prevKey;

    await new Promise<void>((resolve) => apiServer.close(() => resolve()));
    await new Promise<void>((resolve) => mockDb.server.close(() => resolve()));
  }
}

main().catch((err) => {
  console.error('❌ Test suite failed:', err);
  process.exit(1);
});
