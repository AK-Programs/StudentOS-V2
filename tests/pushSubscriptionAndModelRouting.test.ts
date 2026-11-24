/**
 * Verification test for Push Subscriptions and Apinex free/glm-5.3-flash routing
 */
import assert from 'assert';
import { classifyTaskComplexity } from '../server/aiClient';
import { doesSubscriptionMatchPushTarget, expandTargetRoleSet } from '../server';

async function runTests() {
  console.log('--- RUNNING PUSH SUBSCRIPTION & MODEL ROUTING TESTS ---');

  // Test 1: Verify Apinex free/gpt-6-luna is completely removed and replaced with free/glm-5.3-flash
  const fastRouting = classifyTaskComplexity('Hi Byte, what is biology?', { taskType: 'fast' });
  assert.strictEqual(fastRouting.provider, 'apinex');
  assert.strictEqual(fastRouting.model, 'free/glm-5.3-flash', 'Fast tier must route to free/glm-5.3-flash');
  assert.notStrictEqual(fastRouting.model, 'free/gpt-6-luna', 'gpt-6-luna must never be returned');

  // Test 2: If modelOverride contains gpt-6-luna, route to free/glm-5.3-flash safely
  const overrideRouting = classifyTaskComplexity('Test prompt', { modelOverride: 'free/gpt-6-luna' });
  assert.strictEqual(overrideRouting.provider, 'apinex');
  assert.strictEqual(overrideRouting.model, 'free/glm-5.3-flash', 'gpt-6-luna override must be redirected to free/glm-5.3-flash');

  // Test 3: Default chat routing
  const defaultRouting = classifyTaskComplexity('Tell me a fun science fact', {});
  assert.strictEqual(defaultRouting.provider, 'apinex');
  assert.strictEqual(defaultRouting.model, 'free/glm-5.3-flash');

  // Test 4: Tool tier routing
  const toolRouting = classifyTaskComplexity('Generate structured json', { taskType: 'tool' });
  assert.strictEqual(toolRouting.provider, 'apinex');
  assert.strictEqual(toolRouting.model, 'free/glm-5.3-flash');

  // Test 5: Verify push subscription columns matching
  const matchingSub = {
    userId: 'usr_student_01',
    role: 'student',
    grade: '10',
    section: 'A',
    schoolId: 'sch_central'
  };

  const matchesDirect = doesSubscriptionMatchPushTarget(matchingSub, {
    targetSchoolId: 'sch_central',
    targetUserId: 'usr_student_01',
    targetRole: 'student',
    targetClass: '10',
    targetSection: 'A'
  });
  assert.strictEqual(matchesDirect, true, 'Matching subscription should match');

  const matchesAll = doesSubscriptionMatchPushTarget(matchingSub, {
    targetSchoolId: 'sch_central',
    targetUserId: 'all',
    targetRole: 'all',
    targetClass: 'all',
    targetSection: 'all'
  });
  assert.strictEqual(matchesAll, true, 'All target should match');

  console.log('✓ All 5 Unit Tests Passed Cleanly!');
  process.exit(0);
}

runTests().catch(err => {
  console.error('Test failure:', err);
  process.exit(1);
});
