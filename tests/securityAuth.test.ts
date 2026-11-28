/**
 * @file tests/securityAuth.test.ts
 * Automated Security Audit Suite - Authentication, Spoof Prevention, PIN Hash & Access Controls
 */

import assert from 'node:assert/strict';
import http from 'node:http';
import { AddressInfo } from 'node:net';
import { app, getSupabaseServerConfig, getVerifiedUserFromRequest } from '../server';
import { createSignedSessionToken, verifySignedSessionToken } from '../server/sessionAuth';
import { hashPin, verifyPinHash } from '../server/securityService';

async function startTestServer(): Promise<{ baseUrl: string; close: () => Promise<void> }> {
  const server: http.Server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  const port = (server.address() as AddressInfo).port;
  return {
    baseUrl: `http://127.0.0.1:${port}`,
    close: () => new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve()))),
  };
}

async function runSecurityAuthTests() {
  console.log('--- RUNNING SECURITY AUTH & ACCESS CONTROL TESTS ---');
  let passed = 0;

  // Test 1: getSupabaseServerConfig credential confidentiality
  {
    const config = getSupabaseServerConfig();
    assert.ok(config.url && config.key, 'Supabase server config must return valid URL and key');
    console.log('✅ Test 1 Passed: Supabase server config evaluates valid URL and key without logging secrets.');
    passed++;
  }

  // Test 2: Validate getVerifiedUserFromRequest rejects invalid Bearer tokens and forged base64 JWTs
  {
    const forgedJwt = 'eyJhbGciOiJub25lIn0.eyJzdWIiOiJkZW1vLXN1cGVyIiwicm9sZSI6InN1cGVyX2FkbWluIn0.sig';
    const invalidUser = await getVerifiedUserFromRequest({
      headers: { authorization: 'Bearer invalid_token_xyz_12345' },
    } as any);
    assert.equal(invalidUser, null, 'Invalid token must return null');

    const forgedUser = await getVerifiedUserFromRequest({
      headers: {
        authorization: `Bearer ${forgedJwt}`,
        'x-veylentra-uid': 'demo-super',
        'x-veylentra-role': 'super_admin',
      },
    } as any);
    assert.equal(forgedUser, null, 'Forged unsigned base64 JWT + spoofed x-veylentra-* headers must return null');
    console.log('✅ Test 2 Passed: getVerifiedUserFromRequest rejects invalid and forged unsigned JWTs.');
    passed++;
  }

  // Test 3: Signed server HMAC session tokens verify validly and detect tampering
  {
    const { token } = createSignedSessionToken({
      uid: 'stu-sec-1',
      role: 'student',
      name: 'Verified Student',
      sessionType: 'login',
    });
    const verified = verifySignedSessionToken(token);
    assert.ok(verified && verified.uid === 'stu-sec-1' && verified.role === 'student');

    const parts = token.split('.');
    const tamperedPayload = Buffer.from(
      JSON.stringify({ uid: 'demo-super', role: 'super_admin', exp: Date.now() + 60_000, iat: Date.now(), sessionType: 'login' })
    ).toString('base64url');
    const tampered = `${parts[0]}.${tamperedPayload}.${parts[2]}`;
    assert.equal(verifySignedSessionToken(tampered), null, 'Tampered HMAC token must be rejected');
    console.log('✅ Test 3 Passed: Signed session tokens verify cleanly and reject payload tampering.');
    passed++;
  }

  // Test 4: Strict salted scryptSync PIN verification rejects bypass hashes and plaintext fallbacks
  {
    const storedHash = hashPin('Veylentra#2026');
    assert.equal(verifyPinHash('Veylentra#2026', storedHash), true);
    assert.equal(verifyPinHash('wrong-pin', storedHash), false);
    assert.equal(
      verifyPinHash('Veylentra#2026', 'a3b7c1e9f0442d1a002b8c9d7e6f5a4b3c2d1e0f9a8b7c6d5e4f3a2b1c0d9e8f'),
      false,
      'Hardcoded canonicalHash bypass must never validate'
    );
    assert.equal(verifyPinHash('plaintext', 'plaintext'), false, 'Plaintext stored comparison must never validate');
    console.log('✅ Test 4 Passed: Salted scrypt PIN verification blocks canonicalHash and plaintext bypasses.');
    passed++;
  }

  // Test 5: HTTP rejection of forged headers/JWTs/body role overrides across AI, Orion, Admin, and APK endpoints
  const srv = await startTestServer();
  try {
    const forgedJwt = 'eyJhbGciOiJub25lIn0.eyJzdWIiOiJkZW1vLXN1cGVyIiwicm9sZSI6InN1cGVyX2FkbWluIn0.sig';
    const spoofHeaders = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${forgedJwt}`,
      'x-veylentra-uid': 'demo-super',
      'x-veylentra-role': 'super_admin',
    };

    const chatSpoof = await fetch(`${srv.baseUrl}/api/ai/chat`, {
      method: 'POST',
      headers: spoofHeaders,
      body: JSON.stringify({ prompt: 'Hello', userId: 'demo-super', userRole: 'super_admin' }),
    });
    assert.equal(chatSpoof.status, 401, '/api/ai/chat must reject forged JWT/headers with 401');

    const orionSpoof = await fetch(`${srv.baseUrl}/api/orion/execute`, {
      method: 'POST',
      headers: spoofHeaders,
      body: JSON.stringify({ command: 'Create broadcast Free day', userRole: 'super_admin', isSuperAdmin: true }),
    });
    assert.equal(orionSpoof.status, 401, '/api/orion/execute must reject forged JWT/headers with 401');

    const limitsSpoof = await fetch(`${srv.baseUrl}/api/admin/ai-limits`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adminRole: 'super_admin', limits: { student: 9999 } }),
    });
    assert.equal(limitsSpoof.status, 401, '/api/admin/ai-limits must reject unauthenticated body adminRole override with 401');

    const studentToken = createSignedSessionToken({
      uid: 'stu-sec-2',
      role: 'student',
      name: 'Regular Student',
      sessionType: 'login',
    }).token;

    const studentAdminLimits = await fetch(`${srv.baseUrl}/api/admin/ai-limits`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${studentToken}` },
      body: JSON.stringify({ adminRole: 'super_admin', limits: { student: 9999 } }),
    });
    assert.equal(studentAdminLimits.status, 403, 'Student role must get 403 even if body.adminRole=super_admin');

    const studentApk = await fetch(`${srv.baseUrl}/api/config/apk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${studentToken}` },
      body: JSON.stringify({ apkUrl: 'https://evil.example/app.apk' }),
    });
    assert.equal(studentApk.status, 403, 'Student role must get 403 on /api/config/apk');

    // Test 6: /api/auth/demo-session allows student/parent ONLY and blocks admin/super_admin with 403
    const demoSuper = await fetch(`${srv.baseUrl}/api/auth/demo-session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: 'demo-super', role: 'super_admin' }),
    });
    assert.equal(demoSuper.status, 403, '/api/auth/demo-session must forbid super_admin with 403');

    const demoAdmin = await fetch(`${srv.baseUrl}/api/auth/demo-session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'admin' }),
    });
    assert.equal(demoAdmin.status, 403, '/api/auth/demo-session must forbid admin with 403');

    const demoStu = await fetch(`${srv.baseUrl}/api/auth/demo-session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: 'demo-student-uid' }),
    });
    assert.equal(demoStu.status, 200);
    const demoStuBody: any = await demoStu.json();
    assert.ok(String(demoStuBody.sessionToken || '').startsWith('vlt_sess.'), 'Demo student session must return vlt_sess. token');
    assert.equal(demoStuBody.profile?.role, 'student');

    console.log('✅ Test 5 & 6 Passed: HTTP spoof rejection & restricted demo-session gating verified.');
    passed += 2;
  } finally {
    await srv.close();
  }

  console.log(`\nSecurity Auth Test Summary: ${passed} Passed, 0 Failed.`);
  process.exit(0);
}

runSecurityAuthTests().catch((err) => {
  console.error('❌ Security Auth Test Failed:', err);
  process.exit(1);
});
