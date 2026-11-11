/**
 * @file tests/inputSanitization.test.ts
 * Automated Security Audit Suite - Input Validation & Sanitization Controls
 */

import { recordFailedAttempt, resetRateLimit, verifyPinHash, hashPin } from '../server/securityService';

async function runInputSanitizationTests() {
  console.log('--- RUNNING INPUT SANITIZATION & SECURITY SERVICE TESTS ---');
  let passed = 0;
  let failed = 0;

  // Test 1: Rate limiting tracker enforces cooldown after max failed attempts
  try {
    const testKey = 'test_ip_rate_limit_check';
    resetRateLimit(testKey);

    let res = recordFailedAttempt(testKey);
    for (let i = 0; i < 4; i++) {
      res = recordFailedAttempt(testKey);
    }

    if (res.isRateLimited) {
      console.log('✅ Test 1 Passed: Rate limiter enforced lockout after 5 failed attempts.');
      passed++;
    } else {
      console.error('❌ Test 1 Failed: Rate limiter did not lock out after 5 attempts.');
      failed++;
    }
    resetRateLimit(testKey);
  } catch (err) {
    console.error('❌ Test 1 Exception:', err);
    failed++;
  }

  // Test 2: PIN hash timing-safe verification
  try {
    const testPin = '123456';
    const hashed = hashPin(testPin);

    const match = verifyPinHash(testPin, hashed);
    const wrongMatch = verifyPinHash('654321', hashed);

    if (match && !wrongMatch) {
      console.log('✅ Test 2 Passed: Scrypt PIN hashing and timing-safe verification work correctly.');
      passed++;
    } else {
      console.error('❌ Test 2 Failed: PIN verification returned incorrect match result.');
      failed++;
    }
  } catch (err) {
    console.error('❌ Test 2 Exception:', err);
    failed++;
  }

  console.log(`\nInput Sanitization Test Summary: ${passed} Passed, ${failed} Failed.`);
  if (failed > 0) {
    process.exit(1);
  }
  process.exit(0);
}

runInputSanitizationTests();
