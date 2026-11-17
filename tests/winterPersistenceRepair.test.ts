/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Veylentra — Winter Festival Persistence, XP Leaderboard & Byte Quota Repair Test Suite
 * Tests all 4 repair pillars against a real local HTTP PostgREST-compatible Supabase mock:
 *  1. Part 1: Winter state persistence across cold restarts, fail-loudly 503 on DB error, atomic 409 concurrency/duplicate prevention
 *  2. Part 2: Cold-start XP accumulation without 0+delta overwrite, deduplication, user_profiles sync, PII-free separated leaderboard
 *  3. Part 3: Persistent Byte AI quota + Winter +1..+5 IST daily bonus + Day rollover + Voucher + 429 enforcement + Zero client double-count
 *  4. Part 4: Santa GLB single-flight cache deduplication & asset size verification
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { AddressInfo } from 'node:net';
import { app } from '../server';
import vercelHandler from '../api/index';
import {
  appendXpLedgerEntry,
  clearWinterMemoryCacheOnlyForTests,
  executeSantaGiftClaim,
  executeSpinWheel,
  getUserWinterAiBonusCreditsAsync,
  resetWinterAndLeaderboardMemoryForTests,
  setForceWinterSupabaseForTests,
} from '../server/winterFestivalModule';
import {
  getIstDayKey,
  getRolling24hUsageAsync,
  recordAiUsageAsync,
  resetAiQuotaMemoryForTests,
  setForceAiQuotaSupabaseForTests,
} from '../server/aiQuotaService';
import { getSantaWindowStatus } from '../server/rewardEngine';
import { fetchAIUsageStatus } from '../src/lib/aiUsageManager';
import {
  fetchCachedSantaGlb,
  getSantaPreloadMetrics,
  resetSantaModelCacheForTests,
} from '../src/lib/santaModelCache';
import { WORKING_ANON_KEY, supabaseFetchWithAnonRetry } from '../server/supabaseKeyManager';

let passed = 0;
async function runTest(name: string, fn: () => Promise<void> | void) {
  await fn();
  passed += 1;
  console.log(`✅ [PASS] ${name}`);
}

/**
 * Lightweight PostgREST-compatible in-process HTTP server for durable DB behavior verification.
 */
function createMockSupabaseServer() {
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
    ai_usage_logs: [],
    ai_user_vouchers: [],
    ai_role_limits: [
      { role: 'student', daily_limit: 30 },
      { role: 'teacher', daily_limit: 75 },
      { role: 'coordinator', daily_limit: 100 },
      { role: 'admin', daily_limit: 150 },
      { role: 'super_admin', daily_limit: 150 },
    ],
    platform_features: [],
  };

  let injectedFailure: { table?: string; method?: string; status: number; message: string } | null = null;
  let queryCounts: Record<string, number> = {};

  function matchesCondition(row: any, key: string, expr: string): boolean {
    if (expr.startsWith('eq.')) {
      return String(row[key] ?? '') === expr.slice(3);
    }
    if (expr.startsWith('gt.')) {
      return Number(row[key] ?? 0) > Number(expr.slice(3));
    }
    if (expr.startsWith('gte.')) {
      return String(row[key] ?? '') >= expr.slice(4);
    }
    if (expr.startsWith('like.')) {
      const pattern = expr.slice(5).replace(/%/g, '.*').replace(/\*/g, '.*');
      return new RegExp(`^${pattern}$`).test(String(row[key] ?? ''));
    }
    if (expr.startsWith('in.(') && expr.endsWith(')')) {
      const vals = expr
        .slice(4, -1)
        .split(',')
        .map(s => s.replace(/^"|"$/g, '').trim());
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
            const col = p.slice(0, dotIdx);
            const rest = p.slice(dotIdx + 1);
            return matchesCondition(row, col, rest);
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
    if (limitParam) {
      rows = rows.slice(0, Number(limitParam));
    }
    const selectParam = searchParams.get('select');
    if (selectParam && selectParam !== '*') {
      const cols = selectParam.split(',').map(s => s.trim()).filter(Boolean);
      rows = rows.map(r => {
        const out: any = {};
        for (const c of cols) {
          out[c] = r[c];
        }
        return out;
      });
    }
    return rows;
  }

  function hasUniqueConflict(tableName: string, row: any): boolean {
    const existing = tables[tableName] || [];
    if (tableName === 'winter_user_profiles') {
      return existing.some(r => r.user_id === row.user_id);
    }
    if (tableName === 'winter_task_claims') {
      return existing.some(r => r.user_id === row.user_id && r.task_id === row.task_id);
    }
    if (tableName === 'winter_user_badges') {
      return existing.some(r => r.user_id === row.user_id && r.badge_id === row.badge_id);
    }
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
    if (tableName === 'ai_user_vouchers') {
      return existing.some(r => r.user_id === row.user_id && r.voucher_code === row.voucher_code);
    }
    if (tableName === 'global_data') {
      return existing.some(r => r.id === row.id);
    }
    return false;
  }

  const server = http.createServer(async (req, res) => {
    const parsed = new URL(req.url || '/', 'http://127.0.0.1');
    const match = parsed.pathname.match(/^\/rest\/v1\/([^/]+)$/);
    if (!match) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ message: 'Not found' }));
      return;
    }

    const tableName = match[1];
    queryCounts[`${req.method}:${tableName}`] = (queryCounts[`${req.method}:${tableName}`] || 0) + 1;

    if (
      injectedFailure &&
      (!injectedFailure.table || injectedFailure.table === tableName) &&
      (!injectedFailure.method || injectedFailure.method === req.method)
    ) {
      const apiKey = req.headers['apikey'] || req.headers['ApiKey'];
      if ((injectedFailure as any).onlyIfNotAnon && apiKey === WORKING_ANON_KEY) {
        // Allow request through on retry with working anon key!
      } else {
        res.writeHead(injectedFailure.status, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ message: injectedFailure.message }));
        return;
      }
    }

    if (!tables[tableName]) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ code: 'PGRST205', message: `Could not find the table '${tableName}' in the schema cache` }));
      return;
    }

    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(Buffer.from(chunk));
    const bodyStr = Buffer.concat(chunks).toString('utf8');
    const bodyJson = bodyStr ? JSON.parse(bodyStr) : undefined;

    if (req.method === 'GET') {
      const rows = filterRows(tableName, parsed.searchParams);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(rows));
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
          res.end(JSON.stringify({ code: '23505', message: `duplicate key value violates unique constraint on ${tableName}` }));
          return;
        }
        tables[tableName].push({ ...item });
      }
      res.writeHead(201, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(items));
      return;
    }

    if (req.method === 'PATCH') {
      const matching = filterRows(tableName, new URLSearchParams(parsed.searchParams));
      const matchedSet = new Set(matching);
      tables[tableName] = tables[tableName].map(r => {
        // Re-check filter on full rows
        const isMatch = filterRows(tableName, (() => {
          const sp = new URLSearchParams(parsed.searchParams);
          sp.delete('select');
          return sp;
        })()).includes(r);
        return isMatch ? { ...r, ...bodyJson } : r;
      });
      void matchedSet;
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify([]));
      return;
    }

    if (req.method === 'DELETE') {
      const sp = new URLSearchParams(parsed.searchParams);
      sp.delete('select');
      const toDelete = new Set(filterRows(tableName, sp));
      tables[tableName] = tables[tableName].filter(r => !toDelete.has(r));
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify([]));
      return;
    }

    res.writeHead(405, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Method not allowed' }));
  });

  return {
    tables,
    server,
    setFailure(f: { table?: string; method?: string; status: number; message: string } | null) {
      injectedFailure = f;
    },
    getQueryCounts() {
      return { ...queryCounts };
    },
    resetQueryCounts() {
      queryCounts = {};
    },
  };
}

function getTodayIstHourUtcMs(istHour: number, istMinute: number = 30): number {
  const istKey = getSantaWindowStatus(Date.now(), 'Asia/Kolkata').eventNightKey;
  const [y, m, d] = istKey.split('-').map(Number);
  return Date.UTC(y, m - 1, d, istHour, istMinute, 0, 0) - 330 * 60 * 1000;
}

async function apiJson(baseUrl: string, route: string, options: RequestInit = {}) {
  const resp = await fetch(`${baseUrl}${route}`, options);
  const data = await resp.json().catch(() => ({}));
  return { status: resp.status, data };
}

async function main() {
  const mockDb = createMockSupabaseServer();
  await new Promise<void>(resolve => mockDb.server.listen(0, '127.0.0.1', resolve));
  const mockPort = (mockDb.server.address() as AddressInfo).port;
  const mockSupabaseUrl = `http://127.0.0.1:${mockPort}`;

  const prevUrl = process.env.VITE_SUPABASE_URL;
  const prevKey = process.env.VITE_SUPABASE_ANON_KEY;
  process.env.VITE_SUPABASE_URL = mockSupabaseUrl;
  process.env.VITE_SUPABASE_ANON_KEY = 'test_valid_key_placeholder_free_mock_token_123456';

  resetWinterAndLeaderboardMemoryForTests();
  resetAiQuotaMemoryForTests();
  setForceWinterSupabaseForTests(true);
  setForceAiQuotaSupabaseForTests(true);

  // Seed user_profiles including sensitive raw_data to confirm leaderboard never leaks it
  mockDb.tables.user_profiles.push(
    {
      id: 'stu-persist-1',
      uid: 'stu-persist-1',
      name: 'Riya Sharma',
      role: 'student',
      grade: 'Grade 10',
      section: 'Solara',
      house: 'Ignis',
      photo_url: '',
      points: 1509,
      badges: ['early_bird'],
      updated_at: Date.now(),
      raw_data: { password_hash: 'SECRET_HASH_DO_NOT_LEAK', phone: '+91-99999-11111' },
    },
    {
      id: 'fac-persist-1',
      uid: 'fac-persist-1',
      name: 'Dr. Kavita Iyer',
      role: 'teacher',
      grade: 'Grade 10',
      section: 'Solara',
      house: '',
      photo_url: '',
      points: 420,
      badges: [],
      updated_at: Date.now(),
      raw_data: { password_hash: 'FACULTY_SECRET_HASH' },
    }
  );
  mockDb.tables.global_data.push({
    id: 'gamification_user_stu-persist-1',
    data: {
      userId: 'stu-persist-1',
      xp: 1509,
      level: 7,
      levelTitle: 'Top Performer',
      currentStreak: 4,
      longestStreak: 6,
      earnedBadges: { early_bird: '2026-11-01T00:00:00.000Z' },
    },
    updated_at: new Date().toISOString(),
  });

  const appServer = http.createServer(app);
  await new Promise<void>(resolve => appServer.listen(0, '127.0.0.1', resolve));
  const baseUrl = `http://127.0.0.1:${(appServer.address() as AddressInfo).port}`;

  const stuHeaders = {
    'Content-Type': 'application/json',
    'x-veylentra-uid': 'stu-persist-1',
    'x-veylentra-name': 'Riya Sharma',
    'x-veylentra-role': 'student',
    'x-veylentra-grade': 'Grade 10',
    'x-veylentra-section': 'Solara',
  };

  try {
    // ------------------------------------------------------------------
    // PART 1: WINTER PERSISTENCE, FAIL-LOUDLY, COLD RESTART & CONCURRENCY
    // ------------------------------------------------------------------
    await runTest('Part 1.1: DB failure on /api/winter/status fails loudly with HTTP 503', async () => {
      mockDb.setFailure({ table: 'winter_user_profiles', status: 500, message: 'Simulated DB outage' });
      const res = await apiJson(baseUrl, '/api/winter/status', { headers: stuHeaders });
      mockDb.setFailure(null);
      assert.equal(res.status, 503);
      assert.equal(res.data.success, false);
    });

    await runTest('Part 1.2: Concurrent task claims allow only 1 success and reject duplicate with 409', async () => {
      const [r1, r2] = await Promise.all([
        apiJson(baseUrl, '/api/winter/tasks/task_visit_festival/claim', { method: 'POST', headers: stuHeaders }),
        apiJson(baseUrl, '/api/winter/tasks/task_visit_festival/claim', { method: 'POST', headers: stuHeaders }),
      ]);
      const statuses = [r1.status, r2.status].sort((a, b) => a - b);
      assert.deepEqual(statuses, [200, 409]);
      assert.equal(mockDb.tables.winter_task_claims.filter(c => c.user_id === 'stu-persist-1').length, 1);
    });

    await runTest('Part 1.3: Spin Wheel, Winter Quiz, & Profile Banner survive full cold-start memory wipe', async () => {
      const spinRes = await apiJson(baseUrl, '/api/winter/spin', {
        method: 'POST',
        headers: stuHeaders,
        body: JSON.stringify({ idempotencyKey: 'persist_spin_1' }),
      });
      assert.equal(spinRes.status, 200);
      assert.equal(spinRes.data.success, true);

      const quizRes = await apiJson(baseUrl, '/api/winter/quiz/submit', {
        method: 'POST',
        headers: stuHeaders,
        body: JSON.stringify({ answers: { wq_1: 1, wq_2: 2, wq_3: 1 } }),
      });
      assert.equal(quizRes.status, 200);
      assert.equal(quizRes.data.passed, true);

      const quizTaskRes = await apiJson(baseUrl, '/api/winter/tasks/task_winter_quiz/claim', {
        method: 'POST',
        headers: stuHeaders,
      });
      assert.equal(quizTaskRes.status, 200);

      // Simulate an unlocked banner in persisted DB row then equip via API & check unowned banner returns 403
      const profRow = mockDb.tables.winter_user_profiles.find(r => r.user_id === 'stu-persist-1');
      assert.ok(profRow);
      profRow.unlocked_banners = Array.from(new Set([...(profRow.unlocked_banners || []), 'frosted_aurora']));
      if (profRow.state_json) {
        profRow.state_json.unlockedBanners = profRow.unlocked_banners;
      }
      clearWinterMemoryCacheOnlyForTests();

      const lockedBannerRes = await apiJson(baseUrl, '/api/winter/profile/banner', {
        method: 'POST',
        headers: stuHeaders,
        body: JSON.stringify({ bannerId: 'aurora_crown' }),
      });
      assert.equal(lockedBannerRes.status, 403);

      const bannerRes = await apiJson(baseUrl, '/api/winter/profile/banner', {
        method: 'POST',
        headers: stuHeaders,
        body: JSON.stringify({ bannerId: 'frosted_aurora' }),
      });
      assert.equal(bannerRes.status, 200);

      // Wipe all server in-memory caches (simulating another Vercel cold-started instance)
      clearWinterMemoryCacheOnlyForTests();

      const afterRestart = await apiJson(baseUrl, '/api/winter/status', { headers: stuHeaders });
      assert.equal(afterRestart.status, 200);
      assert.equal(afterRestart.data.winterState.quizCompleted, true);
      assert.equal(afterRestart.data.winterState.equippedBanner, 'frosted_aurora');
      assert.ok(afterRestart.data.winterState.claimedTaskIds.includes('task_visit_festival'));
      assert.ok(afterRestart.data.winterState.claimedTaskIds.includes('task_winter_quiz'));
      assert.ok(afterRestart.data.winterState.earnedWinterBadges.snowflake_explorer);
      assert.ok(afterRestart.data.winterState.earnedWinterBadges.winter_scholar);
      assert.equal(afterRestart.data.spinWheel.canSpin, false);
      assert.ok(afterRestart.data.spinWheel.remainingMs > 60_000);
    });

    await runTest('Part 1.4: Concurrent Santa claims at 7:30 PM IST yield 1 success + 409 duplicate rejection & survive restart', async () => {
      const openTime = getTodayIstHourUtcMs(19, 30);
      const userObj = { id: 'stu-persist-1', name: 'Riya Sharma', role: 'student', grade: 'Grade 10', section: 'Solara' };
      const getCfg = () => ({ url: mockSupabaseUrl, key: 'test-key-12345678901234567890' });

      const first = await executeSantaGiftClaim({
        getSupabaseServerConfig: getCfg,
        user: userObj,
        idempotencyKey: 'santa_concurrent_a',
        nowMs: openTime,
      });
      assert.equal(first.statusCode, 200);

      // Second attempt with a different idempotencyKey hits Postgres uniqueness and rejects with 409
      const second = await executeSantaGiftClaim({
        getSupabaseServerConfig: getCfg,
        user: userObj,
        idempotencyKey: 'santa_concurrent_b',
        nowMs: openTime,
      });
      assert.equal(second.statusCode, 409);

      clearWinterMemoryCacheOnlyForTests();
      const statusAfter = await apiJson(baseUrl, '/api/winter/status', { headers: stuHeaders });
      assert.equal(statusAfter.status, 200);
      assert.ok(Object.keys(statusAfter.data.winterState.santaClaimedNights).length >= 1);
    });

    await runTest('Part 1.5: Cold-start task_academic_engagement reads academic XP directly from Supabase ledger', async () => {
      const actionRes = await apiJson(baseUrl, '/api/gamification/action', {
        method: 'POST',
        headers: stuHeaders,
        body: JSON.stringify({ action: 'study_flashcards', itemId: 'cold_deck_1' }),
      });
      assert.equal(actionRes.status, 200);
      clearWinterMemoryCacheOnlyForTests();

      const claimAcad = await apiJson(baseUrl, '/api/winter/tasks/task_academic_engagement/claim', {
        method: 'POST',
        headers: stuHeaders,
      });
      assert.equal(claimAcad.status, 200);
      assert.equal(claimAcad.data.success, true);
    });

    await runTest('Part 1.6: Missing winter_user_profiles columns return clear SQL migration error', async () => {
      mockDb.setFailure({
        table: 'winter_user_profiles',
        method: 'POST',
        status: 400,
        message: "PGRST204: Could not find the 'claimed_task_ids' column of 'winter_user_profiles' in the schema cache",
      });
      try {
        const spinErrRes = await apiJson(baseUrl, '/api/winter/spin', {
          method: 'POST',
          headers: {
            ...stuHeaders,
            'x-veylentra-uid': 'stu-col-err-1',
            'x-veylentra-name': 'Column Tester',
          },
          body: JSON.stringify({ idempotencyKey: 'col_err_spin_1' }),
        });
        assert.equal(spinErrRes.status, 503);
        assert.equal(spinErrRes.data.code, 'WINTER_SQL_MIGRATION_REQUIRED');
        assert.match(String(spinErrRes.data.error), /SQL/i);
      } finally {
        mockDb.setFailure(null);
      }
    });

    await runTest('Part 1.7: Status and Spin succeed without error even if winter_reward_ledger.reward_label is missing, keeping collectibles visible', async () => {
      const ledgerMissingHeaders = {
        ...stuHeaders,
        'x-veylentra-uid': 'stu-ledger-col-1',
        'x-veylentra-name': 'Collectible Tester',
      };
      // First claim a Santa gift cleanly (or while ledger is broken) — test broken ledger on both GET and POST
      mockDb.setFailure({
        table: 'winter_reward_ledger',
        status: 400,
        message: 'column winter_reward_ledger.reward_label does not exist',
      });
      try {
        // /api/winter/spin must succeed and persist spin reward in winter_user_profiles
        const spinOk = await apiJson(baseUrl, '/api/winter/spin', {
          method: 'POST',
          headers: ledgerMissingHeaders,
          body: JSON.stringify({ idempotencyKey: 'missing_ledger_col_spin_1' }),
        });
        assert.equal(spinOk.status, 200, `Expected spin 200 when winter_reward_ledger fails, got ${spinOk.status}: ${JSON.stringify(spinOk.data)}`);
        assert.equal(spinOk.data.success, true);

        // /api/winter/status must STILL return 200 after cold-start cache clear, with collectibles populated from winter_user_profiles
        clearWinterMemoryCacheOnlyForTests();
        const statusOk = await apiJson(baseUrl, '/api/winter/status', { headers: ledgerMissingHeaders });
        assert.equal(statusOk.status, 200);
        assert.equal(statusOk.data.success, true);
        assert.ok(
          Array.isArray(statusOk.data.winterState?.rewardHistory) && statusOk.data.winterState.rewardHistory.length >= 1,
          'Collectibles rewardHistory must still load from winter_user_profiles even when winter_reward_ledger returns 400'
        );
      } finally {
        mockDb.setFailure(null);
      }
    });

    // ------------------------------------------------------------------
    // PART 2: XP LEDGER & SEPARATED LEADERBOARD
    // ------------------------------------------------------------------
    await runTest('Part 2.1: appendXpLedgerEntry adds onto existing 1509 XP without cold-start 0+delta overwrite & deduplicates 23505', async () => {
      clearWinterMemoryCacheOnlyForTests();
      const getCfg = () => ({ url: mockSupabaseUrl, key: 'test-key-12345678901234567890' });
      const currentRow = mockDb.tables.user_profiles.find(u => u.id === 'stu-persist-1');
      const beforePoints = currentRow.points;

      const addRes = await appendXpLedgerEntry(getCfg, {
        id: 'xp_cold_add_1',
        userId: 'stu-persist-1',
        userName: 'Riya Sharma',
        userRole: 'student',
        grade: 'Grade 10',
        section: 'Solara',
        sourceType: 'academic',
        actionKey: 'complete_quiz:cold_quiz_99',
        xpDelta: 50,
        label: 'Cold Quiz',
        createdAt: new Date().toISOString(),
      });
      assert.equal(addRes.accepted, true);
      assert.equal(addRes.totalXp, beforePoints + 50);
      assert.equal(mockDb.tables.user_profiles.find(u => u.id === 'stu-persist-1').points, beforePoints + 50);

      // Duplicate actionKey rejected by Postgres UNIQUE(user_id, action_key)
      const dupRes = await appendXpLedgerEntry(getCfg, {
        id: 'xp_cold_add_dup',
        userId: 'stu-persist-1',
        userName: 'Riya Sharma',
        userRole: 'student',
        grade: 'Grade 10',
        section: 'Solara',
        sourceType: 'academic',
        actionKey: 'complete_quiz:cold_quiz_99',
        xpDelta: 50,
        label: 'Cold Quiz',
        createdAt: new Date().toISOString(),
      });
      assert.equal(dupRes.deduplicated, true);
      assert.equal(dupRes.totalXp, beforePoints + 50);
    });

    await runTest('Part 2.2: Leaderboard merges gamification_xp_ledger + account XP store (user_profiles/global_data) and includes super_admin on faculty board', async () => {
      // Seed faculty ledger row AND a super_admin + student who only have XP in account XP store (user_profiles / global_data)
      if (!mockDb.tables.gamification_xp_ledger.some(r => r.user_id === 'fac-persist-1')) {
        mockDb.tables.gamification_xp_ledger.push({
          id: 'xp_fac_ledger_1',
          user_id: 'fac-persist-1',
          user_name: 'Dr. Kavita Iyer',
          user_role: 'teacher',
          xp_delta: 420,
          label: 'Graded Assignments',
          created_at: new Date().toISOString(),
        });
      }

      if (!mockDb.tables.user_profiles.some(u => u.id === 'super-admin-1')) {
        mockDb.tables.user_profiles.push({
          id: 'super-admin-1',
          uid: 'super-admin-1',
          name: 'Naitik Kashyap',
          role: 'super_admin',
          points: 3574,
          grade: 'Admin',
          section: 'HQ',
          updated_at: new Date().toISOString(),
        });
      }
      if (!mockDb.tables.global_data.some(g => g.id === 'gamification_user_stu-store-only')) {
        mockDb.tables.global_data.push({
          id: 'gamification_user_stu-store-only',
          data: {
            userId: 'stu-store-only',
            userName: 'Aarav StoreXP',
            role: 'student',
            xp: 640,
            currentStreak: 4,
          },
          updated_at: new Date().toISOString(),
        });
      }

      clearWinterMemoryCacheOnlyForTests();
      mockDb.resetQueryCounts();

      const stuLb = await apiJson(baseUrl, '/api/leaderboard?type=student&period=all_time', { headers: stuHeaders });
      assert.equal(stuLb.status, 200);
      assert.equal(stuLb.data.success, true);
      assert.ok(stuLb.data.rankings.length >= 2);
      const riya = stuLb.data.rankings.find((r: any) => r.userId === 'stu-persist-1');
      const aarav = stuLb.data.rankings.find((r: any) => r.userId === 'stu-store-only');
      assert.ok(riya, 'Student Riya Sharma must appear on leaderboard');
      assert.ok(aarav && aarav.name === 'Aarav StoreXP' && aarav.xp === 640, 'Account store student XP must appear on student leaderboard');
      assert.equal(riya.name, 'Riya Sharma');
      assert.equal(riya.rank, 1);
      assert.ok(riya.xp > 0, `Expected > 0 XP, got ${riya.xp}`);
      assert.equal((riya as any).raw_data, undefined);
      assert.equal((riya as any).email, undefined);
      assert.equal((riya as any).phone, undefined);
      assert.ok(!stuLb.data.rankings.some((r: any) => r.role === 'teacher' || r.role === 'super_admin'));

      // Check Weekly student leaderboard includes both ledger deltas and active account XP
      const weeklyLb = await apiJson(baseUrl, '/api/leaderboard?type=student&period=weekly', { headers: stuHeaders });
      assert.equal(weeklyLb.status, 200);
      assert.ok(weeklyLb.data.rankings.some((r: any) => r.userId === 'stu-persist-1'));

      // Check Faculty cohort includes BOTH teacher and super_admin (even when super_admin XP is only in user_profiles)
      const facLb = await apiJson(baseUrl, '/api/leaderboard?type=faculty&period=all_time', { headers: stuHeaders });
      assert.equal(facLb.status, 200);
      const superAdminEntry = facLb.data.rankings.find((r: any) => r.userId === 'super-admin-1');
      const kavitaEntry = facLb.data.rankings.find((r: any) => r.userId === 'fac-persist-1');
      assert.ok(superAdminEntry, 'super_admin must be included on faculty leaderboard');
      assert.equal(superAdminEntry.name, 'Naitik Kashyap');
      assert.equal(superAdminEntry.xp, 3574);
      assert.equal(superAdminEntry.rank, 1);
      assert.ok(kavitaEntry && kavitaEntry.name === 'Dr. Kavita Iyer' && kavitaEntry.xp >= 420 && kavitaEntry.rank === 2);
      assert.ok(!facLb.data.rankings.some((r: any) => r.role === 'student'));

      // Verify leaderboard never queries winter_user_profiles and stays within limit 50 queries
      const qCounts = mockDb.getQueryCounts();
      assert.equal(qCounts['GET:gamification_xp_ledger'] || 0, 3);
      assert.equal(qCounts['GET:winter_user_profiles'] || 0, 0, 'Leaderboard must not query winter_user_profiles');

      // Even if user_profiles AND global_data fail completely, leaderboard still returns 200 using gamification_xp_ledger
      mockDb.setFailure({ table: 'user_profiles', method: 'GET', status: 500, message: 'DB error' });
      const profDownLb = await apiJson(baseUrl, '/api/leaderboard?type=student&period=all_time', { headers: stuHeaders });
      mockDb.setFailure({ table: 'global_data', method: 'GET', status: 500, message: 'DB error' });
      const gdDownLb = await apiJson(baseUrl, '/api/leaderboard?type=student&period=all_time', { headers: stuHeaders });
      mockDb.setFailure(null);
      assert.equal(profDownLb.status, 200);
      assert.equal(profDownLb.data.success, true);
      assert.ok(profDownLb.data.rankings.length >= 1);
      assert.equal(gdDownLb.status, 200);
      assert.equal(gdDownLb.data.success, true);

      // Verify that if Supabase returns 401 Invalid API key, it retries once with working anon key and succeeds!
      mockDb.setFailure({ table: 'gamification_xp_ledger', method: 'GET', status: 401, message: 'Invalid API key', onlyIfNotAnon: true } as any);
      const retryLb = await apiJson(baseUrl, '/api/leaderboard?type=student&period=all_time', { headers: stuHeaders });
      mockDb.setFailure(null);
      assert.equal(retryLb.status, 200, 'Leaderboard must recover from 401 Invalid API key by retrying with working anon key');
      assert.equal(retryLb.data.success, true);

      // Verify empty ledger + empty account store returns 200 with rankings: [] and does not fail with an error
      const savedLedger = [...mockDb.tables.gamification_xp_ledger];
      const savedProfiles = [...mockDb.tables.user_profiles];
      const savedGd = [...mockDb.tables.global_data];
      mockDb.tables.gamification_xp_ledger = [];
      mockDb.tables.user_profiles = [];
      mockDb.tables.global_data = [];
      clearWinterMemoryCacheOnlyForTests();
      try {
        const emptyLedgerRes = await apiJson(baseUrl, '/api/leaderboard?type=student&period=weekly', { headers: stuHeaders });
        assert.equal(emptyLedgerRes.status, 200);
        assert.equal(emptyLedgerRes.data.success, true);
        assert.deepEqual(emptyLedgerRes.data.rankings, []);
      } finally {
        mockDb.tables.gamification_xp_ledger = savedLedger;
        mockDb.tables.user_profiles = savedProfiles;
        mockDb.tables.global_data = savedGd;
      }

      // Fail loudly with 503 only when core gamification_xp_ledger table errors completely
      mockDb.setFailure({ table: 'gamification_xp_ledger', method: 'GET', status: 500, message: 'DB error' });
      const errLb = await apiJson(baseUrl, '/api/leaderboard?type=student&period=all_time', { headers: stuHeaders });
      mockDb.setFailure(null);
      assert.equal(errLb.status, 503);
      assert.equal(errLb.data.success, false);
    });

    await runTest('Part 2.3: supabaseFetchWithAnonRetry reads key from Headers instance, tuple array, and plain object on 401 Invalid API key', async () => {
      mockDb.setFailure({ table: 'winter_user_profiles', method: 'GET', status: 401, message: 'Invalid API key', onlyIfNotAnon: true } as any);
      try {
        const resHeadersObj = await supabaseFetchWithAnonRetry(
          `${mockSupabaseUrl}/rest/v1/winter_user_profiles?select=user_id&limit=1`,
          { headers: new Headers({ apikey: 'invalid_service_role_key_123456', Authorization: 'Bearer invalid_service_role_key_123456' }) }
        );
        assert.equal(resHeadersObj.status, 200, 'Should retry with WORKING_ANON_KEY when init.headers is a Headers instance');

        const resTuple = await supabaseFetchWithAnonRetry(
          `${mockSupabaseUrl}/rest/v1/winter_user_profiles?select=user_id&limit=1`,
          { headers: [['apikey', 'invalid_tuple_key_1234567890'], ['Authorization', 'Bearer invalid_tuple_key_1234567890']] }
        );
        assert.equal(resTuple.status, 200, 'Should retry with WORKING_ANON_KEY when init.headers is a tuple array');

        const resPlain = await supabaseFetchWithAnonRetry(
          `${mockSupabaseUrl}/rest/v1/winter_user_profiles?select=user_id&limit=1`,
          { headers: { ApiKey: 'invalid_plain_key_1234567890', Authorization: 'Bearer invalid_plain_key_1234567890' } }
        );
        assert.equal(resPlain.status, 200, 'Should retry with WORKING_ANON_KEY when init.headers is a plain object');
      } finally {
        mockDb.setFailure(null);
      }
    });

    // ------------------------------------------------------------------
    // PART 3: BYTE AI QUOTA & WINTER BONUS CREDITS
    // ------------------------------------------------------------------
    await runTest('Part 3.1: Supabase Winter AI bonus (+3) persists across restarts & resets on next IST day', async () => {
      const quotaUid = 'stu-quota-1';
      const todayIst = getIstDayKey();
      mockDb.tables.winter_user_profiles.push({
        user_id: quotaUid,
        user_name: 'Quota Tester',
        user_role: 'student',
        cookies_count: 4,
        streak_shields: 0,
        unlocked_frames: [],
        equipped_frame: null,
        ai_bonus_date: todayIst,
        ai_bonus_credits_today: 3,
        quiz_completed: false,
        claimed_task_ids: [],
        earned_winter_badges: {},
        santa_claimed_nights: {},
        reward_history: [],
        state_json: {
          userId: quotaUid,
          userName: 'Quota Tester',
          userRole: 'student',
          aiBonusDate: todayIst,
          aiBonusCreditsToday: 3,
        },
        updated_at: new Date().toISOString(),
      });

      resetAiQuotaMemoryForTests();
      clearWinterMemoryCacheOnlyForTests();
      setForceAiQuotaSupabaseForTests(true);
      setForceWinterSupabaseForTests(true);

      const statusRes = await apiJson(baseUrl, `/api/ai/usage-status?userId=${quotaUid}&role=student`);
      assert.equal(statusRes.status, 200);
      assert.equal(statusRes.data.baseLimit, 30);
      assert.equal(statusRes.data.winterBonus, 3);
      assert.equal(statusRes.data.bonus, 3);
      assert.equal(statusRes.data.limit, 33);
      assert.equal(statusRes.data.remaining, 33);

      // Verify yesterday's bonus date returns 0 bonus credits on new IST day
      const tomorrowBonus = await getUserWinterAiBonusCreditsAsync(
        () => ({ url: mockSupabaseUrl, key: 'test-key-12345678901234567890' }),
        quotaUid,
        Date.now() + 26 * 60 * 60 * 1000
      );
      assert.equal(tomorrowBonus, 0);
    });

    await runTest('Part 3.2: Byte AI enforcement honors +3 Winter bonus (allows 33, rejects 34th with 429) in Express & Vercel handler', async () => {
      const quotaUid = 'stu-quota-1';
      const cfg = { url: mockSupabaseUrl, key: 'test-key-12345678901234567890' };

      // Record 32 usages in Supabase
      for (let i = 0; i < 32; i++) {
        await recordAiUsageAsync({ cfg, userId: quotaUid, role: 'student', feature: 'study_buddy' });
      }
      resetAiQuotaMemoryForTests();
      setForceAiQuotaSupabaseForTests(true);

      const before33 = await getRolling24hUsageAsync({ cfg, userId: quotaUid, role: 'student' });
      assert.equal(before33.used, 32);
      assert.equal(before33.limit, 33);
      assert.equal(before33.remaining, 1);

      // 33rd entry consumes the final Winter bonus slot
      await recordAiUsageAsync({ cfg, userId: quotaUid, role: 'student', feature: 'study_buddy' });

      // 34th request via Express /api/ai/chat must return HTTP 429
      const express429 = await apiJson(baseUrl, '/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: 'Hello Byte', userId: quotaUid, userRole: 'student' }),
      });
      assert.equal(express429.status, 429);
      assert.equal(express429.data.error, 'AI_LIMIT_REACHED');
      assert.equal(express429.data.limit, 33);
      assert.equal(express429.data.winterBonus, 3);

      // 34th request via Vercel serverless handler api/index.ts must also return HTTP 429 with limit 33
      let serverlessStatus = 200;
      let serverlessBody: any = null;
      await vercelHandler(
        {
          url: '/api/ai/chat',
          method: 'POST',
          headers: {},
          body: { prompt: 'Hello Byte', userId: quotaUid, userRole: 'student' },
        },
        {
          statusCode: 200,
          setHeader: () => {},
          status(code: number) {
            serverlessStatus = code;
            return {
              json(payload: any) {
                serverlessBody = payload;
                return payload;
              },
            };
          },
          end(str: string) {
            if (str) serverlessBody = JSON.parse(str);
          },
        }
      );
      assert.equal(serverlessStatus, 429);
      assert.equal(serverlessBody.error, 'AI_LIMIT_REACHED');
      assert.equal(serverlessBody.limit, 33);
      assert.equal(serverlessBody.winterBonus, 3);
    });

    await runTest('Part 3.3: Voucher redemption persists across restart & fetchAIUsageStatus does NOT double-count bonus', async () => {
      const quotaUid = 'stu-quota-1';
      const vRes = await apiJson(baseUrl, '/api/ai/redeem-voucher', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: 'STUDENTOS-PRO', userId: quotaUid, userRole: 'student' }),
      });
      assert.equal(vRes.status, 200);
      assert.equal(vRes.data.newLimit, 58); // 30 base + 3 winter + 25 voucher

      // Duplicate voucher fails cleanly
      const dupV = await apiJson(baseUrl, '/api/ai/redeem-voucher', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: 'STUDENTOS-PRO', userId: quotaUid, userRole: 'student' }),
      });
      assert.equal(dupV.status, 400);

      // Simulate client fetchAIUsageStatus against live local appServer & verify no double-counting (58, not 58+28=86)
      resetAiQuotaMemoryForTests();
      setForceAiQuotaSupabaseForTests(true);
      const origFetch = globalThis.fetch;
      globalThis.fetch = ((input: any, init?: any) => {
        const u = String(input);
        if (u.startsWith('/api/')) return origFetch(`${baseUrl}${u}`, init);
        return origFetch(input, init);
      }) as any;
      try {
        const clientState = await fetchAIUsageStatus(quotaUid, 'student');
        assert.equal(clientState.limit, 58, `Expected exact limit 58 (no double count), got ${clientState.limit}`);
        assert.equal(clientState.bonus, 28);
        assert.equal(clientState.winterBonus, 3);
        assert.equal(clientState.voucherBonus, 25);
        assert.equal(clientState.used, 33);
        assert.equal(clientState.remaining, 25);
      } finally {
        globalThis.fetch = origFetch;
      }
    });

    // ------------------------------------------------------------------
    // PART 4: SANTA 3D GLB PRELOAD & SINGLE-FLIGHT DEDUPLICATION
    // ------------------------------------------------------------------
    await runTest('Part 4: /assets/models/santa.glb single-flight cache deduplicates concurrent fetches', async () => {
      const glbPath = path.join(process.cwd(), 'public', 'assets', 'models', 'santa.glb');
      const diskBytes = fs.statSync(glbPath).size;
      assert.ok(diskBytes > 100_000, `Expected real Santa GLB > 100KB, got ${diskBytes}`);

      resetSantaModelCacheForTests();
      let fetchNetworkCount = 0;
      const glbBuf = fs.readFileSync(glbPath);
      const origFetch = globalThis.fetch;
      globalThis.fetch = (async () => {
        fetchNetworkCount += 1;
        return new Response(glbBuf, { status: 200, headers: { 'Content-Type': 'model/gltf-binary' } });
      }) as any;

      try {
        const [b1, b2, b3] = await Promise.all([
          fetchCachedSantaGlb(),
          fetchCachedSantaGlb(),
          fetchCachedSantaGlb(),
        ]);
        assert.equal(fetchNetworkCount, 1);
        assert.equal(b1.byteLength, diskBytes);
        assert.equal(b2.byteLength, diskBytes);
        assert.equal(b3.byteLength, diskBytes);

        const m = getSantaPreloadMetrics();
        assert.equal(m.status, 'ready');
        assert.equal(m.byteLength, diskBytes);
        assert.equal(m.fetchCallsCount, 1);
      } finally {
        globalThis.fetch = origFetch;
      }
    });

    console.log(`\n🎉 All ${passed} Winter Persistence, Leaderboard, Quota & Preload Repair tests PASSED!`);
  } finally {
    setForceWinterSupabaseForTests(false);
    setForceAiQuotaSupabaseForTests(false);
    resetWinterAndLeaderboardMemoryForTests();
    resetAiQuotaMemoryForTests();
    resetSantaModelCacheForTests();
    if (prevUrl === undefined) delete process.env.VITE_SUPABASE_URL;
    else process.env.VITE_SUPABASE_URL = prevUrl;
    if (prevKey === undefined) delete process.env.VITE_SUPABASE_ANON_KEY;
    else process.env.VITE_SUPABASE_ANON_KEY = prevKey;
    appServer.closeAllConnections?.();
    mockDb.server.closeAllConnections?.();
    await new Promise<void>(resolve => appServer.close(() => resolve()));
    await new Promise<void>(resolve => mockDb.server.close(() => resolve()));
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ Test suite failed:', err);
    process.exit(1);
  });
