import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { AddressInfo } from 'node:net';
import { app } from '../server';
import serverlessHandler from '../api/index';
import { recordAiUsageAsync, setForceAiQuotaSupabaseForTests } from '../server/aiQuotaService';

async function startServer(): Promise<{ baseUrl: string; close: () => Promise<void> }> {
  const server: http.Server = await new Promise((resolve) => {
    const srv = app.listen(0, '127.0.0.1', () => resolve(srv));
  });
  const port = (server.address() as AddressInfo).port;
  return {
    baseUrl: `http://127.0.0.1:${port}`,
    close: () => new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve()))),
  };
}

async function invokeServerlessEndpoint(
  url: string,
  options: {
    headers?: Record<string, string>;
    body?: any;
  }
): Promise<{ status: number; data: any }> {
  let statusCode = 200;
  let payload: any = null;
  const mockReq: any = {
    url,
    method: 'POST',
    headers: options.headers || {},
    body: options.body ?? {},
  };
  const mockRes: any = {
    statusCode: 200,
    setHeader() {},
    status(code: number) {
      statusCode = code;
      return this;
    },
    json(obj: any) {
      payload = obj;
      return this;
    },
    end(raw?: string) {
      if (raw) {
        try {
          payload = JSON.parse(raw);
        } catch {
          payload = raw;
        }
      }
      return this;
    },
  };
  await serverlessHandler(mockReq, mockRes);
  return { status: statusCode, data: payload };
}

async function invokeServerlessOrionAssist(options: {
  headers?: Record<string, string>;
  body?: any;
}): Promise<{ status: number; data: any }> {
  return invokeServerlessEndpoint('/api/ai/orion-assist', options);
}

async function invokeServerlessOrionExecute(options: {
  headers?: Record<string, string>;
  body?: any;
}): Promise<{ status: number; data: any }> {
  return invokeServerlessEndpoint('/api/orion/execute', options);
}

async function runTests() {
  console.log('--- RUNNING BYTE SCROLL & ORION 500 REMEDIATION SUITE ---');

  const rootDir = path.resolve(import.meta.dirname, '..');

  // 1. Byte Scroll Fix Verification
  {
    const byteSrc = fs.readFileSync(path.join(rootDir, 'src/components/byte/ByteWorkspace.tsx'), 'utf8');
    const appSrc = fs.readFileSync(path.join(rootDir, 'src/App.tsx'), 'utf8');
    const cssSrc = fs.readFileSync(path.join(rootDir, 'src/index.css'), 'utf8');
    const topBarSrc = fs.readFileSync(path.join(rootDir, 'src/components/DashboardTopBar.tsx'), 'utf8');

    assert.ok(!byteSrc.includes('h-[calc(100dvh-130px)]'), 'ByteWorkspace must no longer hardcode h-[calc(100dvh-130px)]');
    assert.ok(byteSrc.includes('h-full flex-1 min-h-0 flex rounded-3xl'), 'ByteWorkspace root must fill container cleanly');
    assert.ok(byteSrc.includes('flex-1 min-w-0 min-h-0 flex flex-col overflow-hidden'), 'ByteWorkspace studio column must propagate min-h-0 and overflow-hidden');
    assert.ok(byteSrc.includes('id="ai-dialog-scroll"') && byteSrc.includes('overscroll-contain') && byteSrc.includes('touch-pan-y'), '#ai-dialog-scroll must isolate scroll on desktop and touch devices');
    assert.ok(byteSrc.includes('shrink-0 border-t border-white/10'), 'ByteWorkspace bottom composer must stay docked');

    assert.ok(appSrc.includes("const isByteViewportLocked = activeTab === 'ai_teacher'"), 'App.tsx must lock viewport when Byte is active');
    assert.ok(appSrc.includes("fixed inset-0 h-dvh max-h-dvh w-full overflow-hidden flex flex-col"), 'App.tsx outer wrapper must lock viewport and prevent outer document scroll when Byte is active');
    assert.ok(appSrc.includes("byte-viewport-locked") && appSrc.includes("window.scrollTo(0, 0)"), 'App.tsx must toggle byte-viewport-locked and reset scroll position');
    assert.ok(cssSrc.includes('html.byte-viewport-locked') && cssSrc.includes('overflow: hidden !important'), 'index.css must lock html/body/#root overflow when byte-viewport-locked is active');
    assert.ok(appSrc.includes("min-h-0 overflow-hidden flex flex-col"), 'App.tsx main/motion wrappers must keep Byte inside viewport');
    assert.ok(appSrc.includes("pb-[calc(4.75rem+env(safe-area-inset-bottom))] md:pb-6"), 'App.tsx must keep mobile bottom nav clear of Byte composer');
    assert.ok(topBarSrc.includes('sticky top-0 z-40 shrink-0'), 'DashboardTopBar must include shrink-0');

    console.log('✓ 1. Byte viewport-lock & single scroll container checks passed');
  }

  // 2. Approved Providers Only (Zero free/gpt-6-luna) & Client Caller Identity Headers
  {
    const filesToScan = [
      'server.ts',
      'api/index.ts',
      'server/aiClient.ts',
      'server/orionService.ts',
      'src/components/ByteOrionAssistantModal.tsx',
      'src/components/StudentExperienceWorkspace.tsx',
      'src/components/FacultyExperienceWorkspace.tsx',
    ];
    for (const rel of filesToScan) {
      const content = fs.readFileSync(path.join(rootDir, rel), 'utf8');
      assert.ok(!content.toLowerCase().includes('gpt-6-luna'), `${rel} must never reference gpt-6-luna`);
      assert.ok(!content.toLowerCase().includes('apinex.io') && !content.toLowerCase().includes('apinex_api_key'), `${rel} must never call apinex`);
    }

    for (const callerRel of [
      'src/components/ByteOrionAssistantModal.tsx',
      'src/components/StudentExperienceWorkspace.tsx',
      'src/components/FacultyExperienceWorkspace.tsx',
    ]) {
      const callerSrc = fs.readFileSync(path.join(rootDir, callerRel), 'utf8');
      assert.ok(callerSrc.includes("'x-veylentra-uid'"), `${callerRel} must send signed-in x-veylentra-uid header`);
    }

    console.log('✓ 2. Approved provider lock & Orion client auth header checks passed');
  }

  // 3. Express /api/ai/orion-assist & Serverless /api/ai/orion-assist Integration Tests
  const prevFetch = globalThis.fetch;
  const prevMinistral = process.env.MINISTRAL_API_KEY;
  const prevGroq = process.env.GROQ_API_KEY;
  const prevZai = process.env.ZAI_API_KEY;
  const prevSupabaseUrl = process.env.VITE_SUPABASE_URL;

  setForceAiQuotaSupabaseForTests(false);
  process.env.VITE_SUPABASE_URL = 'https://mock-orion-test.supabase.co';
  process.env.MINISTRAL_API_KEY = 'test-ministral-key';
  process.env.GROQ_API_KEY = 'test-groq-key';
  process.env.ZAI_API_KEY = 'test-zai-key';

  let aiShouldFail = false;
  let aiFailureMessage = 'Upstream Ministral service overloaded (503)';
  let serverlessQuotaCount = 0;
  const calledAiUrls: string[] = [];

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;

    // Pass through localhost calls to Express test server
    if (url.startsWith('http://127.0.0.1') || url.startsWith('http://localhost')) {
      return prevFetch(input as any, init);
    }

    // Supabase Auth check
    if (url.includes('/auth/v1/user')) {
      const auth = String((init?.headers as any)?.Authorization || '');
      if (auth === 'Bearer throw-auth-error') {
        throw new Error('Simulated Supabase auth network outage');
      }
      if (auth === 'Bearer valid-stu-jwt') {
        return new Response(
          JSON.stringify({ id: 'stu-orion-jwt-1', email: 'student@veylentra.edu', user_metadata: { role: 'student' } }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      return new Response(JSON.stringify({ message: 'Invalid JWT' }), { status: 401 });
    }

    // Supabase user_profiles lookup
    if (url.includes('/rest/v1/user_profiles')) {
      return new Response(JSON.stringify([]), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    // Supabase serverless quota endpoints
    if (url.includes('/rest/v1/ai_role_limits')) {
      return new Response(JSON.stringify([]), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    if (url.includes('/rest/v1/winter_user_profiles')) {
      return new Response(JSON.stringify([]), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    if (url.includes('/rest/v1/ai_vouchers') || url.includes('/rest/v1/ai_user_vouchers')) {
      return new Response(JSON.stringify([]), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    if (url.includes('/rest/v1/ai_usage_logs')) {
      if (init?.method === 'POST') {
        serverlessQuotaCount++;
        return new Response(JSON.stringify({ ok: true }), { status: 201, headers: { 'Content-Type': 'application/json' } });
      }
      const nowIso = new Date().toISOString();
      const rows = Array.from({ length: serverlessQuotaCount }, (_, idx) => ({
        id: `log_${idx}`,
        created_at: nowIso,
      }));
      return new Response(JSON.stringify(rows), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    // Approved AI Providers (Ministral, Groq, Z.ai)
    if (
      url.includes('api.mistral.ai') ||
      url.includes('api.groq.com') ||
      url.includes('api.z.ai')
    ) {
      calledAiUrls.push(url);
      if (aiShouldFail) {
        return new Response(aiFailureMessage, { status: 503, statusText: 'Service Unavailable' });
      }
      return new Response(
        JSON.stringify({
          choices: [
            {
              message: { content: 'Structured Orion explanation for Newton laws.' },
              finish_reason: 'stop',
            },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(JSON.stringify({}), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }) as typeof fetch;

  const srv = await startServer();

  try {
    // 3a. Express: Unsigned user -> 401
    {
      const rNoAuth = await fetch(`${srv.baseUrl}/api/ai/orion-assist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ intent: 'student_explain', topic: 'Optics' }),
      });
      assert.equal(rNoAuth.status, 401, 'Express must return 401 when no user is signed in');

      const rAnonHeader = await fetch(`${srv.baseUrl}/api/ai/orion-assist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-veylentra-uid': 'anonymous' },
        body: JSON.stringify({ intent: 'student_explain', topic: 'Optics' }),
      });
      assert.equal(rAnonHeader.status, 401, 'Express must return 401 for anonymous uid header');

      const rBadJwt = await fetch(`${srv.baseUrl}/api/ai/orion-assist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer expired_bad_jwt' },
        body: JSON.stringify({ intent: 'student_explain', topic: 'Optics' }),
      });
      assert.equal(rBadJwt.status, 401, 'Express must return 401 for invalid Bearer JWT');
    }

    // 3b. Serverless: Unsigned user -> 401
    {
      const sNoAuth = await invokeServerlessOrionAssist({
        headers: { 'content-type': 'application/json' },
        body: { intent: 'student_explain', topic: 'Optics' },
      });
      assert.equal(sNoAuth.status, 401, 'Serverless must return 401 when no user is signed in');

      const sAnon = await invokeServerlessOrionAssist({
        headers: { 'x-veylentra-uid': 'guest' },
        body: { intent: 'student_explain', topic: 'Optics' },
      });
      assert.equal(sAnon.status, 401, 'Serverless must return 401 for guest header');

      const sBadJwt = await invokeServerlessOrionAssist({
        headers: { authorization: 'Bearer invalid_jwt' },
        body: { intent: 'student_explain', topic: 'Optics' },
      });
      assert.equal(sBadJwt.status, 401, 'Serverless must return 401 for invalid JWT');
    }

    // 3c. Express & Serverless: Provider failure -> 502 with real reason (NEVER 500)
    {
      aiShouldFail = true;
      aiFailureMessage = 'Provider rate-limit or backend maintenance (mock-503)';

      const r502 = await fetch(`${srv.baseUrl}/api/ai/orion-assist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer valid-stu-jwt' },
        body: JSON.stringify({ intent: 'student_explain', topic: 'Newton Second Law' }),
      });
      const r502Json: any = await r502.json();
      assert.equal(r502.status, 502, `Expected 502 on AI provider failure, got ${r502.status}`);
      assert.notEqual(r502.status, 500);
      assert.equal(r502Json.success, false);
      assert.ok(String(r502Json.error || '').includes('503'), `502 error should include real provider reason: ${r502Json.error}`);

      const s502 = await invokeServerlessOrionAssist({
        headers: { authorization: 'Bearer valid-stu-jwt' },
        body: { intent: 'student_explain', topic: 'Newton Second Law' },
      });
      assert.equal(s502.status, 502, `Serverless expected 502 on provider failure, got ${s502.status}`);
      assert.notEqual(s502.status, 500);
      assert.equal(s502.data?.success, false);
      assert.ok(String(s502.data?.error || '').includes('503'), `Serverless 502 should include real reason: ${s502.data?.error}`);

      aiShouldFail = false;
    }

    // 3d. Express & Serverless: Valid request -> 200 using approved provider
    {
      calledAiUrls.length = 0;
      const r200 = await fetch(`${srv.baseUrl}/api/ai/orion-assist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-veylentra-uid': 'demo-student-uid', 'x-veylentra-role': 'student' },
        body: JSON.stringify({ intent: 'student_explain', topic: 'Newton Second Law' }),
      });
      const r200Json: any = await r200.json();
      assert.equal(r200.status, 200);
      assert.equal(r200Json.success, true);
      assert.ok(r200Json.text.includes('Newton'));
      assert.ok(['ministral', 'groq', 'zai'].includes(r200Json.providerUsed));

      const s200 = await invokeServerlessOrionAssist({
        headers: { 'x-veylentra-uid': 'demo-student-uid', 'x-veylentra-role': 'student' },
        body: { intent: 'student_explain', topic: 'Newton Second Law' },
      });
      assert.equal(s200.status, 200);
      assert.equal(s200.data?.success, true);
      assert.ok(['ministral', 'groq', 'zai'].includes(s200.data?.providerUsed));
      assert.ok(calledAiUrls.every((u) => !u.includes('gpt-6-luna') && !u.includes('apinex')));
    }

    // 3e. Express & Serverless: Daily limit reached -> 429
    {
      const limitUid = 'stu-quota-exhausted-orion';
      for (let i = 0; i < 30; i++) {
        await recordAiUsageAsync({
          cfg: { url: process.env.VITE_SUPABASE_URL!, key: 'mock' },
          userId: limitUid,
          role: 'student',
          feature: 'orion_student_explain',
        });
      }

      const r429 = await fetch(`${srv.baseUrl}/api/ai/orion-assist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-veylentra-uid': limitUid, 'x-veylentra-role': 'student' },
        body: JSON.stringify({ intent: 'student_explain', topic: 'Thermodynamics' }),
      });
      const r429Json: any = await r429.json();
      assert.equal(r429.status, 429, `Expected 429 when daily limit reached, got ${r429.status}`);
      assert.equal(r429Json.success, false);
      assert.ok(String(r429Json.error || '').toLowerCase().includes('limit'));

      serverlessQuotaCount = 30;
      const s429 = await invokeServerlessOrionAssist({
        headers: { 'x-veylentra-uid': limitUid, 'x-veylentra-role': 'student' },
        body: { intent: 'student_explain', topic: 'Thermodynamics' },
      });
      assert.equal(s429.status, 429, `Serverless expected 429 when daily limit reached, got ${s429.status}`);
      assert.equal(s429.data?.success, false);
      assert.ok(String(s429.data?.error || '').toLowerCase().includes('limit'));
    }

    console.log('✓ 3. Express & Serverless /api/ai/orion-assist 401/429/502/200 checks passed');

    // 4. Express & Serverless /api/orion/execute 401 / 502 / 200 / Malformed JSON Checks
    // 4a. Express: Unsigned user & thrown auth lookup -> 401 / never 500
    {
      const eNoAuth = await fetch(`${srv.baseUrl}/api/orion/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: 'Explain photosynthesis' }),
      });
      assert.equal(eNoAuth.status, 401, 'Express /api/orion/execute must return 401 when not signed in');

      const eGuest = await fetch(`${srv.baseUrl}/api/orion/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-veylentra-uid': 'guest' },
        body: JSON.stringify({ command: 'Explain photosynthesis' }),
      });
      assert.equal(eGuest.status, 401, 'Express /api/orion/execute must return 401 for guest');

      const eThrowAuth = await fetch(`${srv.baseUrl}/api/orion/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer throw-auth-error' },
        body: JSON.stringify({ command: 'Explain photosynthesis' }),
      });
      assert.notEqual(eThrowAuth.status, 500, 'Express /api/orion/execute must never return raw 500 if auth lookup throws');
      assert.ok([401, 502].includes(eThrowAuth.status), `Expected 401 or 502 on auth throw, got ${eThrowAuth.status}`);

      const eBadJson = await fetch(`${srv.baseUrl}/api/orion/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer valid-stu-jwt' },
        body: '{invalid-json',
      });
      assert.equal(eBadJson.status, 400, 'Express /api/orion/execute must return 400 JSON on malformed JSON');
    }

    // 4b. Serverless: Unsigned user & thrown auth lookup -> 401 / never 500
    {
      const sNoAuth = await invokeServerlessOrionExecute({
        headers: { 'content-type': 'application/json' },
        body: { command: 'Explain photosynthesis' },
      });
      assert.equal(sNoAuth.status, 401, 'Serverless /api/orion/execute must return 401 when not signed in');

      const sAnon = await invokeServerlessOrionExecute({
        headers: { 'x-veylentra-uid': 'anonymous' },
        body: { command: 'Explain photosynthesis' },
      });
      assert.equal(sAnon.status, 401, 'Serverless /api/orion/execute must return 401 for anonymous user');

      const sThrowAuth = await invokeServerlessOrionExecute({
        headers: { authorization: 'Bearer throw-auth-error' },
        body: { command: 'Explain photosynthesis' },
      });
      assert.notEqual(sThrowAuth.status, 500, 'Serverless /api/orion/execute must never return raw 500 if auth throws');
      assert.ok([401, 502].includes(sThrowAuth.status));
    }

    // 4c. Express & Serverless: Ministral / Groq / Z.ai failure -> 502 with real reason (NEVER 500 or 200)
    {
      aiShouldFail = true;
      aiFailureMessage = 'Upstream Ministral/Groq/Z.ai error (mock-503)';

      const e502 = await fetch(`${srv.baseUrl}/api/orion/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer valid-stu-jwt' },
        body: JSON.stringify({ command: 'Explain quantum tunneling simply' }),
      });
      const e502Json: any = await e502.json();
      assert.equal(e502.status, 502, `Express /api/orion/execute expected 502 on AI provider failure, got ${e502.status}`);
      assert.notEqual(e502.status, 500);
      assert.equal(e502Json.success, false);
      assert.ok(String(e502Json.error || '').includes('503'), `Express 502 error must expose real upstream reason: ${e502Json.error}`);

      const s502 = await invokeServerlessOrionExecute({
        headers: { authorization: 'Bearer valid-stu-jwt' },
        body: { command: 'Explain quantum tunneling simply' },
      });
      assert.equal(s502.status, 502, `Serverless /api/orion/execute expected 502 on AI provider failure, got ${s502.status}`);
      assert.notEqual(s502.status, 500);
      assert.equal(s502.data?.success, false);
      assert.ok(String(s502.data?.error || '').includes('503'), `Serverless 502 error must expose real upstream reason: ${s502.data?.error}`);

      aiShouldFail = false;
    }

    // 4d. Express & Serverless: Valid signed-in request (JWT & demo-student-uid) -> 200 with approved providers
    {
      calledAiUrls.length = 0;
      const e200 = await fetch(`${srv.baseUrl}/api/orion/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-veylentra-uid': 'demo-student-uid' },
        body: JSON.stringify({ command: 'Explain Newton laws briefly' }),
      });
      const e200Json: any = await e200.json();
      assert.equal(e200.status, 200, `Expected 200 for demo-student-uid, got ${e200.status}`);
      assert.equal(e200Json.success, true);
      assert.ok(['ministral', 'groq', 'zai'].includes(e200Json.providerUsed));

      const s200 = await invokeServerlessOrionExecute({
        headers: { authorization: 'Bearer valid-stu-jwt' },
        body: { command: 'Explain Newton laws briefly' },
      });
      assert.equal(s200.status, 200, `Serverless expected 200 for valid JWT, got ${s200.status}`);
      assert.equal(s200.data?.success, true);
      assert.ok(['ministral', 'groq', 'zai'].includes(s200.data?.providerUsed));
      assert.ok(calledAiUrls.every((u) => !u.includes('gpt-6-luna') && !u.includes('apinex')));
    }

    console.log('✓ 4. Express & Serverless /api/orion/execute 401/502/200/malformed-JSON checks passed');
  } finally {
    await srv.close();
    globalThis.fetch = prevFetch;
    if (prevMinistral === undefined) delete process.env.MINISTRAL_API_KEY;
    else process.env.MINISTRAL_API_KEY = prevMinistral;
    if (prevGroq === undefined) delete process.env.GROQ_API_KEY;
    else process.env.GROQ_API_KEY = prevGroq;
    if (prevZai === undefined) delete process.env.ZAI_API_KEY;
    else process.env.ZAI_API_KEY = prevZai;
    if (prevSupabaseUrl === undefined) delete process.env.VITE_SUPABASE_URL;
    else process.env.VITE_SUPABASE_URL = prevSupabaseUrl;
  }

  console.log('ALL BYTE SCROLL & ORION 500 REMEDIATION CHECKS PASSED!');
}

runTests().catch((err) => {
  console.error('TEST SUITE FAILED:', err);
  process.exit(1);
});
