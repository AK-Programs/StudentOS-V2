/**
 * Comprehensive Cross-Account AI Isolation & Leakage Regression Suite (Priority 0 & 1)
 *
 * Verifies:
 * 1. Super Admin -> Student switch (no Gravitation history/prompt bleed)
 * 2. Student -> Super Admin switch (no Student thread leakage)
 * 3. Conversation ID / Thread ID manipulation rejected with HTTP 403 (Express + Serverless + Supabase cold-start check)
 * 4. Direct API invalid/missing auth (401) and body userId spoofing / mismatch (403)
 * 5. Mid-stream account switch & abort ownership checks (isStreamSessionStillOwned)
 * 6. Browser reload storage isolation & legacy unscoped key purging
 * 7. Role & context cache clearing (clearByteContextCache / clearStudentOSContextCache)
 * 8. Concurrent multi-user /api/ai/chat requests never cross-pollinate prompts or histories
 */
import assert from 'node:assert/strict';
import http from 'node:http';

import { app } from '../server';
import serverlessHandler from '../api/index';
import {
  clearConversationOwnerRegistryForTests,
  bindConversationOwnerInRegistry,
  getBoundConversationOwner,
  filterHistoryByOwner,
} from '../server/aiConversationOwnership';
import {
  getScopedAiThreadsStorageKey,
  getScopedActiveThreadStorageKey,
  purgeLegacyUnscopedAiStorage,
  filterThreadsForUser,
  readScopedAiThreadsFromStorage,
  readScopedActiveThreadIdFromStorage,
  writeScopedActiveThreadIdToStorage,
  isStreamSessionStillOwned,
} from '../src/lib/aiSessionIsolation';
import {
  buildAuthorizedByteContext,
  clearByteContextCache,
} from '../src/lib/byteIntelligence';

function createMemoryStorage(initial: Record<string, string> = {}) {
  const map = new Map<string, string>(Object.entries(initial));
  return {
    getItem(key: string) {
      return map.has(key) ? map.get(key)! : null;
    },
    setItem(key: string, value: string) {
      map.set(key, String(value));
    },
    removeItem(key: string) {
      map.delete(key);
    },
    has(key: string) {
      return map.has(key);
    },
  };
}

async function startHttpServer(
  handler: http.RequestListener | any
): Promise<{ baseUrl: string; close: () => Promise<void> }> {
  return new Promise((resolve) => {
    const server = http.createServer(handler);
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address() as any;
      resolve({
        baseUrl: `http://127.0.0.1:${addr.port}`,
        close: () => new Promise<void>((res) => server.close(() => res())),
      });
    });
  });
}

async function runTests() {
  console.log('--- RUNNING CROSS-ACCOUNT AI ISOLATION TESTS ---');

  // =========================================================================
  // 1 & 2 & 6. Frontend Session, Thread & Storage Isolation Across Account Switches
  // =========================================================================
  {
    const superAdminUid = 'demo-super';
    const studentUid = 'demo-student-uid';

    const storage = createMemoryStorage({
      // Legacy shared unscoped keys that caused cross-account leakage
      s_os_ai_threads: JSON.stringify([
        {
          id: 'legacy-grav-1',
          title: 'Gravitation Chapter 9',
          userId: superAdminUid,
          messages: [
            { role: 'user', content: 'Explain Gravitation from Class 9 Science' },
            { role: 'assistant', content: 'Newton law of universal gravitation...' },
          ],
        },
      ]),
      s_os_ai_active_id: 'legacy-grav-1',
      // Properly scoped per-user storage
      [getScopedAiThreadsStorageKey(superAdminUid)]: JSON.stringify([
        {
          id: 'super-thread-1',
          title: 'Gravitation Chapter 9',
          personaId: 'elara',
          mode: 'explanatory',
          userId: superAdminUid,
          messages: [
            { role: 'user', content: 'Explain Gravitation' },
            { role: 'assistant', content: 'Universal gravitation explanation...' },
          ],
        },
      ]),
      [getScopedAiThreadsStorageKey(studentUid)]: JSON.stringify([
        {
          id: 'student-thread-1',
          title: 'Quadratic Equations',
          personaId: 'study_buddy',
          mode: 'explanatory',
          userId: studentUid,
          messages: [
            { role: 'user', content: 'Explain quadratic formula' },
            { role: 'assistant', content: 'x = (-b +- sqrt(b^2 - 4ac)) / 2a' },
          ],
        },
      ]),
    });

    writeScopedActiveThreadIdToStorage(superAdminUid, 'super-thread-1', storage);
    writeScopedActiveThreadIdToStorage(studentUid, 'student-thread-1', storage);

    // 1. Switch Super Admin -> Demo Student & reload
    const studentThreads = readScopedAiThreadsFromStorage(studentUid, storage);
    assert.equal(studentThreads.length, 1);
    assert.equal(studentThreads[0].id, 'student-thread-1');
    assert.ok(!JSON.stringify(studentThreads).includes('Gravitation'), 'Student storage read must never contain Super Admin Gravitation thread');
    assert.equal(readScopedActiveThreadIdFromStorage(studentUid, storage), 'student-thread-1');

    // Legacy shared keys must have been purged automatically
    assert.equal(storage.has('s_os_ai_threads'), false, 'Legacy unscoped s_os_ai_threads must be purged');
    assert.equal(storage.has('s_os_ai_active_id'), false, 'Legacy unscoped s_os_ai_active_id must be purged');

    // 2. Switch Student -> Super Admin
    const superThreads = readScopedAiThreadsFromStorage(superAdminUid, storage);
    assert.equal(superThreads.length, 1);
    assert.equal(superThreads[0].id, 'super-thread-1');
    assert.ok(!JSON.stringify(superThreads).includes('Quadratic Equations'), 'Super Admin storage must never contain Student thread');

    // 3. Unknown / mixed memory threads list filtered strictly by UID
    const mixedThreads = [
      { id: 't1', userId: superAdminUid, title: 'Gravitation' },
      { id: 't2', userId: studentUid, title: 'Algebra' },
      { id: 't3', title: 'Missing owner thread' },
    ];
    const filteredForStudent = filterThreadsForUser(mixedThreads, studentUid);
    assert.deepEqual(filteredForStudent.map((t) => t.id), ['t2']);
    assert.deepEqual(filterThreadsForUser(mixedThreads, null), []);

    // Explicit purge check
    storage.setItem('s_os_ai_threads', 'bad');
    purgeLegacyUnscopedAiStorage(storage);
    assert.equal(storage.has('s_os_ai_threads'), false);

    console.log('✓ 1, 2 & 6. Per-user storage & thread filtering prevent Super Admin <-> Student leakage');
  }

  // =========================================================================
  // 5. Stream Ownership & Mid-Stream Account Switch Guard
  // =========================================================================
  {
    assert.equal(
      isStreamSessionStillOwned({
        currentEpoch: 3,
        capturedEpoch: 3,
        currentOwnerUid: 'demo-super',
        capturedOwnerUid: 'demo-super',
      }),
      true
    );
    // Epoch incremented on logout/switch mid-stream -> must reject stale chunks
    assert.equal(
      isStreamSessionStillOwned({
        currentEpoch: 4,
        capturedEpoch: 3,
        currentOwnerUid: 'demo-super',
        capturedOwnerUid: 'demo-super',
      }),
      false
    );
    // Owner changed from demo-super -> demo-student-uid -> must reject stale chunks
    assert.equal(
      isStreamSessionStillOwned({
        currentEpoch: 3,
        capturedEpoch: 3,
        currentOwnerUid: 'demo-student-uid',
        capturedOwnerUid: 'demo-super',
      }),
      false
    );
    // Empty / logged out UID -> must reject
    assert.equal(
      isStreamSessionStillOwned({
        currentEpoch: 3,
        capturedEpoch: 3,
        currentOwnerUid: '',
        capturedOwnerUid: 'demo-super',
      }),
      false
    );
    console.log('✓ 5. Mid-stream account switch & abort epoch checks block stale writes');
  }

  // =========================================================================
  // 7. Context Cache Clearing & Per-Role / Per-UID Cache Key Isolation
  // =========================================================================
  {
    clearByteContextCache();
    const superCtx = await buildAuthorizedByteContext(
      'Check my homework and assignments today',
      {
        uid: 'demo-super',
        name: 'Naitik Kashyap',
        email: 'naitik.kashyap0015@gmail.com',
        role: 'super_admin',
        grade: 'Grade 10',
        section: 'Astra',
      },
      'super_admin',
      {
        localSnapshot: {
          homeworkList: [{ title: 'Gravitation Worksheet', subject: 'Physics', classGrade: 'Grade 9', classSection: 'Astra', dueDate: 'Tomorrow' }],
        },
      }
    );
    const studentCtx = await buildAuthorizedByteContext(
      'Check my homework and assignments today',
      {
        uid: 'demo-student-uid',
        name: 'Aarav Sharma',
        email: 'student@demo.com',
        role: 'student',
        grade: 'Grade 10',
        section: 'Astra',
      },
      'student',
      {
        localSnapshot: {
          homeworkList: [{ title: 'Trigonometry Practice', subject: 'Math', classGrade: 'Grade 10', classSection: 'Astra', dueDate: 'Friday' }],
        },
      }
    );

    assert.ok(superCtx.contextString.includes('Gravitation Worksheet'));
    assert.ok(!studentCtx.contextString.includes('Gravitation Worksheet'), 'Student context cache must never return Super Admin context');
    assert.ok(studentCtx.contextString.includes('Trigonometry Practice'));
    clearByteContextCache();
    console.log('✓ 7. Role & UID context cache isolation verified');
  }

  // =========================================================================
  // 3, 4 & 8. Backend Express + Serverless Auth, Ownership & Concurrency Tests
  // =========================================================================
  {
    clearConversationOwnerRegistryForTests();

    const prevFetch = globalThis.fetch;
    const prevZai = process.env.ZAI_API_KEY;
    const prevMinistral = process.env.MINISTRAL_API_KEY;
    const prevGroq = process.env.GROQ_API_KEY;

    // Seed fake DB rows for conversation ownership cold-start check + usage quota check
    const remoteConversations: Record<string, string> = {
      'conv-super-gravitation': 'demo-super',
    };
    const capturedProviderRequests: Array<{ prompt: string; history: any[] }> = [];

    globalThis.fetch = (async (input: any, init: any) => {
      const url = String(input);

      // Pass local test server requests to real fetch
      if (url.startsWith('http://127.0.0.1') || url.startsWith('http://localhost')) {
        return prevFetch(input, init);
      }

      // Mock Supabase Auth verification
      if (url.includes('/auth/v1/user')) {
        const authHeader = String(init?.headers?.Authorization || init?.headers?.authorization || '');
        if (authHeader === 'Bearer token-super') {
          return new Response(
            JSON.stringify({
              id: 'demo-super',
              email: 'naitik.kashyap0015@gmail.com',
              user_metadata: { role: 'super_admin' },
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          );
        }
        if (authHeader === 'Bearer token-student') {
          return new Response(
            JSON.stringify({
              id: 'demo-student-uid',
              email: 'student@demo.com',
              user_metadata: { role: 'student' },
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          );
        }
        return new Response(JSON.stringify({ error: 'Invalid JWT' }), { status: 401 });
      }

      // Mock Supabase user_profiles lookup
      if (url.includes('/rest/v1/user_profiles')) {
        if (url.includes('demo-super')) {
          return new Response(JSON.stringify([{ uid: 'demo-super', role: 'super_admin', name: 'Naitik' }]), { status: 200 });
        }
        if (url.includes('demo-student-uid')) {
          return new Response(JSON.stringify([{ uid: 'demo-student-uid', role: 'student', name: 'Aarav' }]), { status: 200 });
        }
        return new Response(JSON.stringify([]), { status: 200 });
      }

      // Mock Supabase ai_buddy_chats ownership lookup
      if (url.includes('/rest/v1/ai_buddy_chats')) {
        const match = url.match(/id=eq\.([^&]+)/);
        const convId = match ? decodeURIComponent(match[1]) : '';
        if (remoteConversations[convId]) {
          return new Response(JSON.stringify([{ id: convId, user_id: remoteConversations[convId] }]), { status: 200 });
        }
        return new Response(JSON.stringify([]), { status: 200 });
      }

      // Mock Supabase ai_usage_logs / limits / winter bonus
      if (url.includes('/rest/v1/')) {
        return new Response(JSON.stringify([]), { status: 200 });
      }

      // Mock Z.ai provider returning an echo of only the received prompt + history
      if (url.includes('api.z.ai')) {
        const body = JSON.parse(String(init?.body || '{}'));
        const msgs = Array.isArray(body.messages) ? body.messages : [];
        const userMessages = msgs.filter((m: any) => m.role !== 'system');
        const lastPrompt = userMessages[userMessages.length - 1]?.content || '';
        const priorHistory = userMessages.slice(0, -1);
        capturedProviderRequests.push({ prompt: lastPrompt, history: priorHistory });

        return new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: `ECHO:${lastPrompt}|HIST_LEN:${priorHistory.length}|HIST:${priorHistory.map((h: any) => h.content).join(';')}`,
                },
                finish_reason: 'stop',
              },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }

      return new Response('{}', { status: 200 });
    }) as any;

    process.env.ZAI_API_KEY = 'test-zai-key';
    delete process.env.MINISTRAL_API_KEY;
    delete process.env.GROQ_API_KEY;

    const srv = await startHttpServer(app);
    const serverlessSrv = await startHttpServer(serverlessHandler);

    try {
      // Test 4a: Unauthenticated / invalid Bearer token -> 401 on BOTH Express and Serverless
      for (const base of [srv.baseUrl, serverlessSrv.baseUrl]) {
        const r401 = await fetch(`${base}/api/ai/chat`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer forged-bad-jwt',
          },
          body: JSON.stringify({
            prompt: 'Explain physics',
            userId: 'demo-student-uid',
          }),
        });
        assert.equal(r401.status, 401, `${base} must reject invalid Bearer token with 401`);

        // Test 4b: Authenticated Student spoofing Super Admin userId in body -> 403
        const rMismatch = await fetch(`${base}/api/ai/chat`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer token-student',
          },
          body: JSON.stringify({
            prompt: 'Explain gravitation',
            userId: 'demo-super',
          }),
        });
        assert.equal(rMismatch.status, 403, `${base} must reject body.userId !== JWT uid with 403`);

        // Test 4c: Unsigned x-veylentra-uid header without verified Bearer token -> 401
        const rHeaderSpoof = await fetch(`${base}/api/ai/chat`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-veylentra-uid': 'demo-student-uid',
          },
          body: JSON.stringify({
            prompt: 'Explain gravitation',
            userId: 'demo-super',
          }),
        });
        assert.equal(rHeaderSpoof.status, 401, `${base} must reject unsigned x-veylentra-uid header with 401`);
      }

      // Test 3a: Cold-start DB conversation ownership check:
      // Student tries to use 'conv-super-gravitation' (owned by demo-super in ai_buddy_chats DB) -> 403
      for (const base of [srv.baseUrl, serverlessSrv.baseUrl]) {
        const rConv403 = await fetch(`${base}/api/ai/chat`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer token-student',
          },
          body: JSON.stringify({
            prompt: 'Continue previous chapter',
            userId: 'demo-student-uid',
            conversationId: 'conv-super-gravitation',
          }),
        });
        assert.equal(rConv403.status, 403, `${base} must block Student accessing Super Admin conversationId from DB with 403`);
      }

      // Test 3b: Runtime conversation ownership binding:
      // Super Admin sends a message in 'conv-runtime-grav' -> binds to demo-super -> Student cannot reuse it
      const rSuperOk = await fetch(`${srv.baseUrl}/api/ai/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer token-super',
        },
        body: JSON.stringify({
          prompt: 'Explain Gravitation Chapter 9',
          userId: 'demo-super',
          conversationId: 'conv-runtime-grav',
          modelOverride: 'zai',
        }),
      });
      assert.equal(rSuperOk.status, 200);
      assert.equal(getBoundConversationOwner('conv-runtime-grav'), 'demo-super');

      const rStudentSteal = await fetch(`${srv.baseUrl}/api/ai/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer token-student',
        },
        body: JSON.stringify({
          prompt: 'Hello Byte',
          userId: 'demo-student-uid',
          threadId: 'conv-runtime-grav',
          modelOverride: 'zai',
        }),
      });
      assert.equal(rStudentSteal.status, 403, 'Student must receive 403 when reusing runtime-bound Super Admin threadId');

      // Test 8: Concurrent multi-user requests (Super Admin + Student simultaneously)
      capturedProviderRequests.length = 0;
      const [resAdmin, resStudent] = await Promise.all([
        fetch(`${srv.baseUrl}/api/ai/chat`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer token-super',
          },
          body: JSON.stringify({
            prompt: 'Teach Gravitation universal constant G',
            userId: 'demo-super',
            conversationId: 'conv-concurrent-admin',
            history: [{ role: 'user', content: 'Previous Gravitation note', userId: 'demo-super' }],
            modelOverride: 'zai',
          }),
        }).then((r) => r.json()),
        fetch(`${srv.baseUrl}/api/ai/chat`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer token-student',
          },
          body: JSON.stringify({
            prompt: 'What is sin(30)?',
            userId: 'demo-student-uid',
            conversationId: 'conv-concurrent-student',
            history: [
              { role: 'user', content: 'Previous Trigonometry note', userId: 'demo-student-uid' },
              // Even if client somehow passed a tagged foreign message, backend filterHistoryByOwner strips it!
              { role: 'assistant', content: 'Do you want to continue Gravitation chapter explanation?', userId: 'demo-super' },
            ],
            modelOverride: 'zai',
          }),
        }).then((r) => r.json()),
      ]);

      assert.ok(String(resAdmin.reply).includes('Teach Gravitation universal constant G'));
      assert.ok(!String(resAdmin.reply).includes('sin(30)'), 'Admin reply must not contain Student query');

      assert.ok(String(resStudent.reply).includes('What is sin(30)?'));
      assert.ok(String(resStudent.reply).includes('Previous Trigonometry note'));
      assert.ok(!String(resStudent.reply).includes('Gravitation'), 'Student reply/history must NEVER contain Gravitation from Super Admin!');

      // Also directly verify filterHistoryByOwner unit behavior
      const filteredHist = filterHistoryByOwner(
        [
          { role: 'user', content: 'Owned msg', userId: 'demo-student-uid' },
          { role: 'assistant', content: 'Unowned Gravitation msg', userId: 'demo-super' },
          { role: 'user', content: 'Untagged msg' },
        ],
        'demo-student-uid'
      );
      assert.equal(filteredHist.length, 2);
      assert.ok(!filteredHist.some((m) => m.content.includes('Gravitation')));

      console.log('✓ 3, 4 & 8. Backend 401/403 ownership, cold-start DB check & concurrent isolation passed');
    } finally {
      await srv.close();
      await serverlessSrv.close();
      globalThis.fetch = prevFetch;
      if (prevZai === undefined) delete process.env.ZAI_API_KEY;
      else process.env.ZAI_API_KEY = prevZai;
      if (prevMinistral === undefined) delete process.env.MINISTRAL_API_KEY;
      else process.env.MINISTRAL_API_KEY = prevMinistral;
      if (prevGroq === undefined) delete process.env.GROQ_API_KEY;
      else process.env.GROQ_API_KEY = prevGroq;
    }
  }

  console.log('--- ALL CROSS-ACCOUNT ISOLATION TESTS PASSED ---');
}

runTests().catch((err) => {
  console.error('Cross-account isolation test suite failed:', err);
  process.exit(1);
});
