/**
 * Comprehensive Verification Suite:
 * 1. Z.ai (GLM-4.7 Flash) provider routing, security (server-only ZAI_API_KEY),
 *    thinking-trace stripping, 400 JSON-mode retry, 429 fallback, timeout & SSE stream handling.
 * 2. Authoritative Server-Side Orion Agent Pipeline (/api/orion/execute & /api/ai/orion-assist):
 *    - 401 on invalid Bearer JWT
 *    - 403 RBAC enforcement preventing body/header role spoofing
 *    - Clarification gating (needs_clarification)
 *    - Confirmation gating (awaiting_confirmation) -> DB write + read-back verification (completed)
 *    - Honest failure on missing read-back row (verified: false)
 *    - Student real end-to-end DB query (non-generic finalResponse + structuredData)
 * 3. ByteWorkspace & Ephemeral Privacy static checks.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';

import {
  classifyTaskComplexity as classifyServerTaskComplexity,
  generateAICompletionWithTelemetry,
  getZaiApiKey,
  streamAICompletion,
  ZAI_CHAT_COMPLETIONS_URL,
  ZAI_MODEL_ID,
} from '../server/aiClient';
import {
  classifyTaskComplexity as classifyApiTaskComplexity,
  getZaiApiKey as getApiZaiKey,
  ZAI_MODEL_ID as API_ZAI_MODEL_ID,
} from '../api/index';
import { app } from '../server';

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
  console.log('--- RUNNING Z.AI & ORION PIPELINE VERIFICATION TESTS ---');

  // =========================================================================
  // 1. Z.ai Routing & Key Security
  // =========================================================================
  {
    assert.equal(ZAI_MODEL_ID, 'glm-4.7-flash');
    assert.equal(API_ZAI_MODEL_ID, 'glm-4.7-flash');

    for (const [label, classify] of [
      ['server/aiClient.ts', classifyServerTaskComplexity],
      ['api/index.ts', classifyApiTaskComplexity],
    ] as const) {
      for (const override of ['zai', 'zai/glm-4.7-flash', 'glm-4.7-flash']) {
        const res = classify('Explain Newton second law', { modelOverride: override });
        assert.equal(res.provider, 'zai', `${label}: ${override} must route to zai`);
        assert.equal(res.model, 'glm-4.7-flash', `${label}: exact Z.ai model ID must be glm-4.7-flash`);
      }
      // Must NOT route free/glm-5.3-flash to zai
      const legacy = classify('Hello', { modelOverride: 'free/glm-5.3-flash' });
      assert.ok(legacy.provider === 'groq' || legacy.provider === 'ministral', `${label}: glm-5.3-flash must stay on groq/ministral`);
    }

    const prevZai = process.env.ZAI_API_KEY;
    const prevViteZai = process.env.VITE_ZAI_API_KEY;
    try {
      delete process.env.ZAI_API_KEY;
      process.env.VITE_ZAI_API_KEY = 'client_exposed_should_never_be_used';
      assert.equal(getZaiApiKey(), '', 'Server getZaiApiKey must ignore VITE_ZAI_API_KEY');
      assert.equal(getApiZaiKey(), '', 'Serverless getZaiApiKey must ignore VITE_ZAI_API_KEY');

      process.env.ZAI_API_KEY = 'server_secret_zai_test_key';
      assert.equal(getZaiApiKey(), 'server_secret_zai_test_key');
      assert.equal(getApiZaiKey(), 'server_secret_zai_test_key');
    } finally {
      if (prevZai === undefined) delete process.env.ZAI_API_KEY;
      else process.env.ZAI_API_KEY = prevZai;
      if (prevViteZai === undefined) delete process.env.VITE_ZAI_API_KEY;
      else process.env.VITE_ZAI_API_KEY = prevViteZai;
    }

    console.log('✓ 1. Z.ai routing & strict server-only ZAI_API_KEY checks passed');
  }

  // =========================================================================
  // 2. Z.ai Provider Protocol (Payload, Thinking Strip, 400 Retry, 429 Fallback, Timeout, Stream)
  // =========================================================================
  {
    const prevFetch = globalThis.fetch;
    const prevZai = process.env.ZAI_API_KEY;
    const prevMinistral = process.env.MINISTRAL_API_KEY;
    const prevGroq = process.env.GROQ_API_KEY;

    try {
      process.env.ZAI_API_KEY = 'zai-secret-12345';
      process.env.MINISTRAL_API_KEY = 'ministral-secret-12345';
      delete process.env.GROQ_API_KEY;

      // 2a. Exact endpoint, glm-4.7-flash model, Bearer auth, strips reasoning_content, retries 400 json_object
      const recordedBodies: any[] = [];
      let callCount = 0;
      globalThis.fetch = (async (input: any, init: any) => {
        const url = String(input);
        assert.equal(url, ZAI_CHAT_COMPLETIONS_URL);
        assert.equal(init?.headers?.Authorization, 'Bearer zai-secret-12345');
        const body = JSON.parse(String(init?.body || '{}'));
        recordedBodies.push(body);
        callCount++;
        if (callCount === 1) {
          assert.equal(body.model, 'glm-4.7-flash');
          assert.deepEqual(body.response_format, { type: 'json_object' });
          return new Response(JSON.stringify({ error: { message: 'response_format json_object unsupported' } }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        assert.equal(body.response_format, undefined, '400 retry must omit response_format');
        return new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  reasoning_content: 'SECRET INTERNAL CHAIN OF THOUGHT SHOULD NOT APPEAR',
                  content: '{"status":"ok","answer":"42"}',
                },
                finish_reason: 'stop',
              },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }) as any;

      const retryRes = await generateAICompletionWithTelemetry({
        prompt: 'Return JSON status',
        jsonMode: true,
        modelOverride: 'zai',
      });
      assert.equal(recordedBodies.length, 2);
      assert.equal(retryRes.telemetry.providerUsed, 'zai');
      assert.equal(retryRes.telemetry.modelUsed, 'glm-4.7-flash');
      assert.equal(retryRes.text, '{"status":"ok","answer":"42"}');
      assert.ok(!retryRes.text.includes('SECRET INTERNAL CHAIN OF THOUGHT'));

      // 2b. HTTP 429 on Z.ai falls back cleanly to Ministral
      const seenUrls: string[] = [];
      globalThis.fetch = (async (input: any) => {
        const url = String(input);
        seenUrls.push(url);
        if (url === ZAI_CHAT_COMPLETIONS_URL) {
          return new Response('Rate limited', { status: 429 });
        }
        return new Response(
          JSON.stringify({
            choices: [{ message: { content: 'Fallback Ministral answer' }, finish_reason: 'stop' }],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }) as any;

      const fallbackRes = await generateAICompletionWithTelemetry({
        prompt: 'Explain photosynthesis',
        modelOverride: 'zai',
      });
      assert.equal(seenUrls[0], ZAI_CHAT_COMPLETIONS_URL);
      assert.ok(seenUrls[1].includes('api.mistral.ai'));
      assert.equal(fallbackRes.telemetry.providerUsed, 'ministral');
      assert.equal(fallbackRes.telemetry.fallbackTriggered, true);
      assert.equal(fallbackRes.text, 'Fallback Ministral answer');

      // 2c. Timeout error never exposes ZAI_API_KEY
      delete process.env.MINISTRAL_API_KEY;
      globalThis.fetch = (async () => {
        const err: any = new Error('The operation was aborted');
        err.name = 'AbortError';
        throw err;
      }) as any;

      await assert.rejects(
        () => generateAICompletionWithTelemetry({ prompt: 'Hello', modelOverride: 'zai' }),
        (err: any) => {
          assert.equal(err.status, 504);
          assert.ok(!String(err.message).includes('zai-secret-12345'), 'Error must never leak API key');
          return true;
        }
      );

      // 2d. Streaming SSE strips delta.reasoning_content and yields clean content tokens
      globalThis.fetch = (async (input: any) => {
        assert.equal(String(input), ZAI_CHAT_COMPLETIONS_URL);
        const sseChunks = [
          'data: {"choices":[{"delta":{"reasoning_content":"hidden thought "}}]}\n\n',
          'data: {"choices":[{"delta":{"content":"Hello "}}]}\n\n',
          'data: {"choices":[{"delta":{"content":"from GLM-4.7 Flash!"}}]}\n\n',
          'data: [DONE]\n\n',
        ].join('');
        const stream = new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode(sseChunks));
            controller.close();
          },
        });
        return new Response(stream, {
          status: 200,
          headers: { 'Content-Type': 'text/event-stream' },
        });
      }) as any;

      const streamedTokens: string[] = [];
      const streamRes = await streamAICompletion(
        { prompt: 'Say hello', modelOverride: 'zai' },
        { onToken: (tok) => streamedTokens.push(tok) }
      );
      assert.equal(streamRes.telemetry.providerUsed, 'zai');
      assert.equal(streamRes.telemetry.modelUsed, 'glm-4.7-flash');
      assert.equal(streamRes.text, 'Hello from GLM-4.7 Flash!');
      assert.ok(!streamedTokens.join('').includes('hidden thought'));
    } finally {
      globalThis.fetch = prevFetch;
      if (prevZai === undefined) delete process.env.ZAI_API_KEY;
      else process.env.ZAI_API_KEY = prevZai;
      if (prevMinistral === undefined) delete process.env.MINISTRAL_API_KEY;
      else process.env.MINISTRAL_API_KEY = prevMinistral;
      if (prevGroq === undefined) delete process.env.GROQ_API_KEY;
      else process.env.GROQ_API_KEY = prevGroq;
    }

    console.log('✓ 2. Z.ai endpoint, glm-4.7-flash payload, trace stripping, 400 retry, 429 fallback & SSE passed');
  }

  // =========================================================================
  // 3. Authoritative Server-Side Orion Execution (/api/orion/execute & /api/ai/orion-assist)
  // =========================================================================
  {
    const prevSupabaseUrl = process.env.VITE_SUPABASE_URL;
    const prevServiceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const prevGroq = process.env.GROQ_API_KEY;
    const prevMinistral = process.env.MINISTRAL_API_KEY;
    const prevZai = process.env.ZAI_API_KEY;

    let failReadBack = false;
    const insertedMaterials: any[] = [];
    const seededHomework = [
      { id: 'hw-1', title: 'Quadratic Equations Set A', subject: 'Mathematics', class_grade: 'Grade 10', due_date: '2026-12-01' },
      { id: 'hw-2', title: 'Organic Chemistry Worksheet', subject: 'Chemistry', class_grade: 'Grade 10', due_date: '2026-12-03' },
    ];

    const mockSupabase = await startHttpServer((req, res) => {
      const urlPath = req.url || '';
      if (urlPath.startsWith('/auth/v1/user')) {
        const auth = String(req.headers.authorization || '');
        if (auth === 'Bearer valid-student-jwt') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ id: 'stu-100', email: 'stu@school.edu', user_metadata: { name: 'Asha', role: 'student', grade: 'Grade 10' } }));
          return;
        }
        if (auth === 'Bearer valid-admin-jwt') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ id: 'adm-100', email: 'principal@school.edu', user_metadata: { name: 'Principal Rao', role: 'admin' } }));
          return;
        }
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'invalid_jwt' }));
        return;
      }

      if (urlPath.startsWith('/rest/v1/user_profiles')) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        if (urlPath.includes('adm-100')) {
          res.end(JSON.stringify([{ id: 'adm-100', name: 'Principal Rao', role: 'admin', grade: 'All', section: 'All' }]));
        } else {
          res.end(JSON.stringify([{ id: 'stu-100', name: 'Asha', role: 'student', grade: 'Grade 10', section: 'Solara' }]));
        }
        return;
      }

      if (urlPath.startsWith('/rest/v1/homework')) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(seededHomework));
        return;
      }

      if (urlPath.startsWith('/rest/v1/materials')) {
        if (req.method === 'POST') {
          let raw = '';
          req.on('data', (c) => (raw += c));
          req.on('end', () => {
            const parsed = JSON.parse(raw || '{}');
            if (!failReadBack) insertedMaterials.push(parsed);
            res.writeHead(201, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify([parsed]));
          });
          return;
        }
        if (req.method === 'GET') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(failReadBack ? [] : insertedMaterials));
          return;
        }
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end('[]');
    });

    process.env.VITE_SUPABASE_URL = mockSupabase.baseUrl;
    process.env.SUPABASE_SERVICE_ROLE_KEY = '';
    delete process.env.GROQ_API_KEY;
    delete process.env.MINISTRAL_API_KEY;
    delete process.env.ZAI_API_KEY;

    const appSrv = await startHttpServer(app);

    try {
      // 3a. Invalid Bearer JWT -> HTTP 401
      const badJwtRes = await fetch(`${appSrv.baseUrl}/api/orion/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer bad_token_123' },
        body: JSON.stringify({ command: 'What homework is due?' }),
      });
      assert.equal(badJwtRes.status, 401);

      // 3b. Student spoofing userRole: 'admin' attempting create_broadcast -> HTTP 403
      const spoofRes = await fetch(`${appSrv.baseUrl}/api/orion/execute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-student-jwt',
          'x-veylentra-role': 'admin',
        },
        body: JSON.stringify({
          command: 'Broadcast tomorrow holiday to all students',
          userRole: 'admin',
          actionPlan: [{ action: 'create_broadcast', title: 'Fake Holiday' }],
          confirmed: true,
        }),
      });
      assert.equal(spoofRes.status, 403);
      const spoofJson = await spoofRes.json();
      assert.equal(spoofJson.status, 'forbidden');
      assert.equal(insertedMaterials.length, 0);

      // 3c. Ambiguous consequential command triggers clarification gate
      const clarifyRes = await fetch(`${appSrv.baseUrl}/api/orion/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer valid-admin-jwt' },
        body: JSON.stringify({ command: 'Delete competition' }),
      });
      assert.equal(clarifyRes.status, 200);
      const clarifyJson = await clarifyRes.json();
      assert.equal(clarifyJson.status, 'needs_clarification');
      assert.ok(Array.isArray(clarifyJson.missingFields) && clarifyJson.missingFields.length > 0);

      // 3d. Authorized Admin consequential action requires confirmation first, then writes & verifies on confirm
      const previewRes = await fetch(`${appSrv.baseUrl}/api/orion/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer valid-admin-jwt' },
        body: JSON.stringify({
          command: 'Create broadcast Annual Science Exhibition on Friday at 9 AM',
          confirmed: false,
        }),
      });
      assert.equal(previewRes.status, 200);
      const previewJson = await previewRes.json();
      assert.equal(previewJson.status, 'awaiting_confirmation');
      assert.ok(previewJson.pendingConfirmation?.previewDetails);
      assert.equal(insertedMaterials.length, 0, 'Must NOT insert row prior to user confirmation');

      const confirmRes = await fetch(`${appSrv.baseUrl}/api/orion/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer valid-admin-jwt' },
        body: JSON.stringify({
          command: 'Create broadcast Annual Science Exhibition on Friday at 9 AM',
          actionPlan: previewJson.pendingConfirmation.plannedSteps,
          confirmed: true,
        }),
      });
      assert.equal(confirmRes.status, 200);
      const confirmJson = await confirmRes.json();
      assert.equal(confirmJson.success, true);
      assert.equal(confirmJson.status, 'completed');
      assert.equal(confirmJson.snapshot.verified, true);
      assert.ok(confirmJson.refreshTables.includes('materials'));
      assert.equal(insertedMaterials.length, 1);

      // 3e. Failed read-back verification reports failure honestly (verified: false)
      failReadBack = true;
      const failVerRes = await fetch(`${appSrv.baseUrl}/api/orion/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer valid-admin-jwt' },
        body: JSON.stringify({
          command: 'Create broadcast Ghost Notice',
          actionPlan: [{ action: 'create_broadcast', title: 'Ghost Notice', content: 'Test' }],
          confirmed: true,
        }),
      });
      assert.equal(failVerRes.status, 200);
      const failVerJson = await failVerRes.json();
      assert.equal(failVerJson.success, false);
      assert.equal(failVerJson.status, 'failed');
      assert.equal(failVerJson.snapshot.verified, false);
      failReadBack = false;

      // 3f. Safe student real end-to-end query ("What homework do I have pending?")
      const stuHwRes = await fetch(`${appSrv.baseUrl}/api/orion/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer valid-student-jwt' },
        body: JSON.stringify({ command: 'What homework do I have pending?' }),
      });
      assert.equal(stuHwRes.status, 200);
      const stuHwJson = await stuHwRes.json();
      assert.equal(stuHwJson.success, true);
      assert.equal(stuHwJson.status, 'completed');
      assert.ok(stuHwJson.structuredData?.rows?.length === 2);
      assert.ok(!stuHwJson.finalResponse.includes("I'm ready to assist you"));
      assert.ok(stuHwJson.finalResponse.includes('Quadratic Equations Set A'));

      // 3g. /api/ai/orion-assist invalid Bearer JWT -> 401 & student role spoof -> 403
      const assist401 = await fetch(`${appSrv.baseUrl}/api/ai/orion-assist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer invalid_jwt' },
        body: JSON.stringify({ intent: 'student_study', topic: 'Optics' }),
      });
      assert.equal(assist401.status, 401);

      const assist403 = await fetch(`${appSrv.baseUrl}/api/ai/orion-assist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer valid-student-jwt' },
        body: JSON.stringify({ intent: 'draft_lesson_plan', userRole: 'teacher', topic: 'Optics' }),
      });
      assert.equal(assist403.status, 403);
    } finally {
      if (prevSupabaseUrl === undefined) delete process.env.VITE_SUPABASE_URL;
      else process.env.VITE_SUPABASE_URL = prevSupabaseUrl;
      if (prevServiceRole === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
      else process.env.SUPABASE_SERVICE_ROLE_KEY = prevServiceRole;
      if (prevGroq === undefined) delete process.env.GROQ_API_KEY;
      else process.env.GROQ_API_KEY = prevGroq;
      if (prevMinistral === undefined) delete process.env.MINISTRAL_API_KEY;
      else process.env.MINISTRAL_API_KEY = prevMinistral;
      if (prevZai === undefined) delete process.env.ZAI_API_KEY;
      else process.env.ZAI_API_KEY = prevZai;

      await appSrv.close();
      await mockSupabase.close();
    }

    console.log('✓ 3. Orion server RBAC, clarification, confirmation, read-back verification & E2E query passed');
  }

  // =========================================================================
  // 4. Static Security & Ephemeral Audits
  // =========================================================================
  {
    const rootDir = path.resolve(import.meta.dirname, '..');
    const orionServerSrc = fs.readFileSync(path.join(rootDir, 'server/orionService.ts'), 'utf8');
    for (const forbidden of ['orion_chats', 'teacher_commands', 'localStorage', 'sessionStorage', 'indexedDB']) {
      assert.ok(!orionServerSrc.includes(forbidden), `server/orionService.ts must never reference ${forbidden}`);
    }

    const byteWorkspaceSrc = fs.readFileSync(path.join(rootDir, 'src/components/byte/ByteWorkspace.tsx'), 'utf8');
    assert.ok(byteWorkspaceSrc.includes('Z.ai (GLM-4.7 Flash)'), 'Super Admin selector must expose Z.ai (GLM-4.7 Flash)');
    assert.ok(byteWorkspaceSrc.includes('value="zai"'), 'Super Admin selector must use zai value');
    assert.ok(!byteWorkspaceSrc.includes('window.prompt('));
    assert.ok(!byteWorkspaceSrc.includes('window.alert('));

    const envExample = fs.readFileSync(path.join(rootDir, '.env.example'), 'utf8');
    assert.ok(envExample.includes('ZAI_API_KEY='), '.env.example must define ZAI_API_KEY placeholder');
    console.log('✓ 4. Static Ephemeral, UI & Env Security audits passed');
  }

  console.log('ALL Z.AI & ORION PIPELINE TESTS PASSED SUCCESSFULLY.');
  process.exit(0);
}

runTests().catch((err) => {
  console.error('❌ TEST SUITE FAILED:', err);
  process.exit(1);
});
