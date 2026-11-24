/**
 * Verification tests for Push Subscriptions (auth, persistence, honest errors, 410-only pruning)
 * and AI Model Routing (strictly Groq + Ministral, zero APinex / gpt-6-luna / glm-5.3-flash).
 */
import assert from 'node:assert/strict';
import http from 'node:http';
import webpush from 'web-push';
import { classifyTaskComplexity as classifyServerTaskComplexity, groqModels } from '../server/aiClient';
import { classifyTaskComplexity as classifyApiTaskComplexity } from '../api/index';
import {
  app,
  doesSubscriptionMatchPushTarget,
  expandTargetRoleSet,
  dispatchServerWebPush,
} from '../server';

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
  console.log('--- RUNNING PUSH SUBSCRIPTION & MODEL ROUTING TESTS ---');

  // 1. Model Routing: strictly Groq and Ministral across BOTH server/aiClient.ts & api/index.ts
  for (const [label, classifyFn] of [
    ['server/aiClient.ts', classifyServerTaskComplexity],
    ['api/index.ts', classifyApiTaskComplexity],
  ] as const) {
    const fastRouting = classifyFn('Hi Byte, what is biology?', { taskType: 'fast' });
    assert.equal(fastRouting.provider, 'groq', `${label}: fast tier must route to groq`);
    assert.ok(groqModels.includes(fastRouting.model), `${label}: must pick approved Groq model`);

    const defaultRouting = classifyFn('Tell me a fun science fact', {});
    assert.equal(defaultRouting.provider, 'groq', `${label}: short chat must route to groq`);
    assert.ok(groqModels.includes(defaultRouting.model));

    const complexRouting = classifyFn(
      'Write a comprehensive multi-chapter revision guide and proof for thermodynamics.',
      { taskType: 'complex' }
    );
    assert.equal(complexRouting.provider, 'ministral', `${label}: complex tier must route to ministral`);
    assert.equal(complexRouting.model, 'ministral-8b-2410');

    const toolRouting = classifyFn('Generate structured json', { taskType: 'tool' });
    assert.equal(toolRouting.provider, 'ministral', `${label}: tool tier must route to ministral`);
    assert.equal(toolRouting.model, 'ministral-8b-2410');

    // Legacy APinex / gpt-6-luna / glm-5.3-flash overrides must NEVER select APinex
    for (const legacyOverride of ['apinex', 'free/gpt-6-luna', 'free/glm-5.3-flash', 'gpt-6-luna']) {
      const routed = classifyFn('Test prompt', { modelOverride: legacyOverride });
      assert.ok(
        routed.provider === 'groq' || routed.provider === 'ministral',
        `${label}: legacy override "${legacyOverride}" must stay on approved providers`
      );
      assert.ok(!String(routed.model).includes('gpt-6-luna'));
      assert.ok(!String(routed.model).includes('glm-5.3'));
    }

    // Rotate across all 3 approved Groq models
    const rotated = new Set<string>();
    for (let i = 0; i < 6; i++) {
      rotated.add(classifyFn(`Question ${i}`, { taskType: 'fast' }).model);
    }
    for (const expectedModel of ['llama-3.1-8b-instant', 'openai/gpt-oss-120b', 'qwen/qwen3.8-27b']) {
      assert.ok(rotated.has(expectedModel), `${label}: Groq rotation must include ${expectedModel}`);
    }
  }
  console.log('PASS: Test 1 - AI routing strictly uses Ministral & Groq (zero APinex)');

  // 2. Subscription target matching
  {
    const matchingSub = {
      userId: 'usr_student_01',
      role: 'student',
      grade: '10',
      section: 'A',
      schoolId: 'sch_central',
    };

    assert.equal(
      doesSubscriptionMatchPushTarget(matchingSub, {
        targetSchoolId: 'sch_central',
        targetUserId: 'usr_student_01',
        targetRole: 'student',
        targetClass: '10',
        targetSection: 'A',
      }),
      true
    );

    assert.equal(
      doesSubscriptionMatchPushTarget(matchingSub, {
        targetSchoolId: 'sch_central',
        targetUserId: 'all',
        targetRole: 'all',
        targetClass: 'all',
        targetSection: 'all',
      }),
      true
    );

    const roleSet = expandTargetRoleSet('faculty', null);
    assert.ok(roleSet.has('teacher') && roleSet.has('coordinator') && roleSet.has('admin'));
    console.log('PASS: Test 2 - Push subscription targeting & role expansion verified');
  }

  // 3. End-to-end Express HTTP verification for /api/push/fcm-token & 404/410-only cleanup
  {
    const prevSupabaseUrl = process.env.VITE_SUPABASE_URL;
    const prevServiceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const prevVapidPub = process.env.VAPID_PUBLIC_KEY;
    const prevVapidPriv = process.env.VAPID_PRIVATE_KEY;

    let failUpsertWithStatus: number | null = null;
    const recordedUpserts: any[] = [];
    const recordedDeletes: string[] = [];

    const mockSupabase = await startHttpServer((req, res) => {
      const urlPath = req.url || '';
      if (urlPath.startsWith('/auth/v1/user')) {
        const auth = String(req.headers.authorization || '');
        if (auth === 'Bearer valid-student-jwt') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(
            JSON.stringify({
              id: 'usr_student_real_1',
              email: 'student1@school.edu',
              role: 'authenticated',
              user_metadata: { name: 'Riya Sharma', role: 'student' },
            })
          );
          return;
        }
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'invalid_jwt' }));
        return;
      }

      if (urlPath.startsWith('/rest/v1/user_profiles')) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify([
            {
              id: 'usr_student_real_1',
              name: 'Riya Sharma',
              role: 'student',
              grade: 'Grade 10',
              section: 'A',
            },
          ])
        );
        return;
      }

      if (urlPath.startsWith('/rest/v1/push_subscriptions')) {
        if (req.method === 'POST') {
          let raw = '';
          req.on('data', (c) => (raw += c));
          req.on('end', () => {
            if (failUpsertWithStatus) {
              res.writeHead(failUpsertWithStatus, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ message: `new row violates row-level security policy (${failUpsertWithStatus})` }));
              return;
            }
            recordedUpserts.push(JSON.parse(raw || '{}'));
            res.writeHead(201, { 'Content-Type': 'application/json' });
            res.end('');
          });
          return;
        }
        if (req.method === 'GET') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(recordedUpserts));
          return;
        }
        if (req.method === 'DELETE') {
          recordedDeletes.push(urlPath);
          res.writeHead(204);
          res.end();
          return;
        }
      }

      res.writeHead(404);
      res.end();
    });

    process.env.VITE_SUPABASE_URL = mockSupabase.baseUrl;
    process.env.SUPABASE_SERVICE_ROLE_KEY = '';
    const appSrv = await startHttpServer(app);

    try {
      // 3a. Unauthenticated / anonymous caller is rejected with 401
      const unauthResp = await fetch(`${appSrv.baseUrl}/api/push/fcm-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: 'usr_anonymous',
          subscription: {
            endpoint: 'https://fcm.googleapis.com/fcm/send/anon-sub',
            keys: { p256dh: 'p256dh-k', auth: 'auth-k' },
          },
        }),
      });
      assert.equal(unauthResp.status, 401);
      const unauthJson = await unauthResp.json();
      assert.equal(unauthJson.tokenStored, false);

      // 3b. Missing p256dh/auth keys rejected with 400
      const incompleteResp = await fetch(`${appSrv.baseUrl}/api/push/fcm-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-student-jwt',
        },
        body: JSON.stringify({
          subscription: {
            endpoint: 'https://fcm.googleapis.com/fcm/send/incomplete-sub',
            keys: { p256dh: '' },
          },
        }),
      });
      assert.equal(incompleteResp.status, 400);
      const incompleteJson = await incompleteResp.json();
      assert.equal(incompleteJson.tokenStored, false);

      // 3c. Supabase error propagates honestly as 502 with tokenStored: false
      failUpsertWithStatus = 403;
      const errResp = await fetch(`${appSrv.baseUrl}/api/push/fcm-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-student-jwt',
        },
        body: JSON.stringify({
          schoolId: 'sch_central',
          subscription: {
            endpoint: 'https://fcm.googleapis.com/fcm/send/real-sub-1',
            keys: { p256dh: 'p256dh-real-1', auth: 'auth-real-1' },
          },
        }),
      });
      assert.equal(errResp.status, 502);
      const errJson = await errResp.json();
      assert.equal(errJson.tokenStored, false);
      assert.ok(String(errJson.details || '').includes('row-level security'));

      // 3d. Valid authenticated subscription saves full metadata row to public.push_subscriptions
      failUpsertWithStatus = null;
      const okResp = await fetch(`${appSrv.baseUrl}/api/push/fcm-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-student-jwt',
        },
        body: JSON.stringify({
          schoolId: 'sch_central',
          deviceId: 'dev_pixel_9',
          deviceLabel: 'Chrome Android',
          subscription: {
            endpoint: 'https://fcm.googleapis.com/fcm/send/real-sub-1',
            keys: { p256dh: 'p256dh-real-1', auth: 'auth-real-1' },
          },
        }),
      });
      assert.equal(okResp.status, 200);
      const okJson = await okResp.json();
      assert.equal(okJson.tokenStored, true);
      assert.equal(recordedUpserts.length, 1);
      assert.equal(recordedUpserts[0].user_id, 'usr_student_real_1');
      assert.equal(recordedUpserts[0].endpoint, 'https://fcm.googleapis.com/fcm/send/real-sub-1');
      assert.equal(recordedUpserts[0].p256dh, 'p256dh-real-1');
      assert.equal(recordedUpserts[0].auth, 'auth-real-1');
      assert.equal(recordedUpserts[0].role, 'student');
      assert.equal(recordedUpserts[0].grade, 'Grade 10');
      assert.equal(recordedUpserts[0].section, 'A');
      assert.equal(recordedUpserts[0].school_id, 'sch_central');

      // 3e. dispatchServerWebPush does NOT delete on 401/403, ONLY deletes on 404/410
      const origSendNotification = webpush.sendNotification;
      const generatedVapid = webpush.generateVAPIDKeys();
      webpush.setVapidDetails('mailto:test@veylentra.edu', generatedVapid.publicKey, generatedVapid.privateKey);
      process.env.VAPID_PUBLIC_KEY = generatedVapid.publicKey;
      process.env.VAPID_PRIVATE_KEY = generatedVapid.privateKey;

      try {
        (webpush as any).sendNotification = async () => {
          const err: any = new Error('Unauthorized VAPID');
          err.statusCode = 403;
          throw err;
        };
        await dispatchServerWebPush({
          notificationId: 'n_403_test',
          title: 'Test 403',
          body: 'Should preserve subscription',
          targetUserId: 'usr_student_real_1',
          targetSchoolId: 'sch_central',
        });
        assert.equal(recordedDeletes.length, 0, 'Must NEVER delete push_subscriptions on 401/403');

        (webpush as any).sendNotification = async () => {
          const err: any = new Error('Subscription gone');
          err.statusCode = 410;
          throw err;
        };
        await dispatchServerWebPush({
          notificationId: 'n_410_test',
          title: 'Test 410',
          body: 'Should prune 410 gone subscription',
          targetUserId: 'usr_student_real_1',
          targetSchoolId: 'sch_central',
        });
        assert.equal(recordedDeletes.length, 1, 'Must delete expired push_subscriptions on 410 Gone');
        assert.ok(recordedDeletes[0].includes('real-sub-1'));
      } finally {
        (webpush as any).sendNotification = origSendNotification;
      }

      console.log('PASS: Test 3 - /api/push/fcm-token auth, full DB upsert, error propagation, and 410-only pruning verified');
    } finally {
      if (prevSupabaseUrl === undefined) delete process.env.VITE_SUPABASE_URL;
      else process.env.VITE_SUPABASE_URL = prevSupabaseUrl;

      if (prevServiceRole === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
      else process.env.SUPABASE_SERVICE_ROLE_KEY = prevServiceRole;

      if (prevVapidPub === undefined) delete process.env.VAPID_PUBLIC_KEY;
      else process.env.VAPID_PUBLIC_KEY = prevVapidPub;

      if (prevVapidPriv === undefined) delete process.env.VAPID_PRIVATE_KEY;
      else process.env.VAPID_PRIVATE_KEY = prevVapidPriv;

      await appSrv.close();
      await mockSupabase.close();
    }
  }

  console.log('All Push Subscription & Model Routing tests passed!');
  process.exit(0);
}

runTests().catch((err) => {
  console.error('Test failure:', err);
  process.exit(1);
});
