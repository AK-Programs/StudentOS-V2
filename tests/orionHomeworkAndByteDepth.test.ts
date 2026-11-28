import assert from 'node:assert/strict';
import {
  parseClassAndSection,
  validateActionParametersServer,
  executeOrionServerRequest,
  validateOrionRolePermission,
  VerifiedOrionActor,
  SupabaseCfg
} from '../server/orionService';
import {
  classifyByteResponseDepth,
  resolveProviderOutputTokenBudget,
  buildAdaptiveDepthSystemDirectives
} from '../server/aiResponseDepth';

async function runTests() {
  console.log('--- STARTING ORION HOMEWORK & BYTE DEPTH SUITE ---');

  const dummyCfg: SupabaseCfg = {
    url: 'https://mock.supabase.co',
    key: 'mock_anon_key'
  };

  // TEST 1: parseClassAndSection extracts class and section cleanly
  console.log('Test 1: parseClassAndSection precision parsing');
  {
    const r1 = parseClassAndSection('Class 10 Astra');
    assert.equal(r1.grade, 'Grade 10');
    assert.equal(r1.section, 'Astra');
    assert.equal(r1.hasExplicitGrade, true);
    assert.equal(r1.hasExplicitSection, true);

    const r2 = parseClassAndSection('Assign homework to 10th Astra on Quadratic Equations');
    assert.equal(r2.grade, 'Grade 10');
    assert.equal(r2.section, 'Astra');
    assert.equal(r2.hasExplicitGrade, true);

    const r3 = parseClassAndSection('Grade 9 Solara');
    assert.equal(r3.grade, 'Grade 9');
    assert.equal(r3.section, 'Solara');
    assert.equal(r3.hasExplicitGrade, true);

    const r4 = parseClassAndSection('Class 10 Section B');
    assert.equal(r4.grade, 'Grade 10');
    assert.equal(r4.section, 'B');
    assert.equal(r4.hasExplicitGrade, true);

    const r5 = parseClassAndSection('Just general homework without a grade');
    assert.equal(r5.hasExplicitGrade, false);
    assert.equal(r5.section, 'All Sections');
  }
  console.log('✓ parseClassAndSection passed');

  // TEST 2: Clarification gate prevents ambiguous homework creation
  console.log('Test 2: Clarification gate prevents ambiguous homework creation');
  {
    const ambiguousVal = validateActionParametersServer(
      { action: 'create_homework', title: 'homework' },
      'Assign homework'
    );
    assert.equal(ambiguousVal.valid, false);
    assert.ok(ambiguousVal.missingFields.length > 0);
    assert.ok(ambiguousVal.clarificationQuestion.length > 0);

    const validVal = validateActionParametersServer(
      { action: 'create_homework', title: 'Calculus Problem Set 4', targetClass: 'Class 10 Astra' },
      'Assign Calculus Problem Set 4 to Class 10 Astra'
    );
    assert.equal(validVal.valid, true);
  }
  console.log('✓ Clarification gate passed');

  // TEST 3: Student role forbidden from creating homework
  console.log('Test 3: RBAC blocks student from creating homework');
  {
    const perm = validateOrionRolePermission('create_homework', 'student');
    assert.equal(perm.allowed, false);

    const teacherPerm = validateOrionRolePermission('create_homework', 'teacher');
    assert.equal(teacherPerm.allowed, true);

    const adminPerm = validateOrionRolePermission('create_homework', 'admin');
    assert.equal(adminPerm.allowed, true);
  }
  console.log('✓ RBAC checks passed');

  // TEST 4: Orion homework execution writes content, given_by, verifies read-back and creates notification
  console.log('Test 4: Orion homework execution with read-back verification');
  {
    const recordedRequests: { url: string; method: string; body?: any }[] = [];
    const insertedHomework: any[] = [];
    const insertedNotifications: any[] = [];

    // Intercept fetch
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (input: any, init?: any) => {
      const url = String(input);
      const method = init?.method || 'GET';
      const body = init?.body ? JSON.parse(init.body) : undefined;
      recordedRequests.push({ url, method, body });

      if (url.includes('/rest/v1/homework')) {
        if (method === 'POST') {
          insertedHomework.push(body);
          return new Response(JSON.stringify(body), { status: 201, headers: { 'Content-Type': 'application/json' } });
        }
        if (method === 'GET') {
          return new Response(JSON.stringify(insertedHomework), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }
      }

      if (url.includes('/rest/v1/notifications')) {
        if (method === 'POST') {
          insertedNotifications.push(body);
          return new Response(JSON.stringify(body), { status: 201, headers: { 'Content-Type': 'application/json' } });
        }
        if (method === 'GET') {
          return new Response(JSON.stringify(insertedNotifications), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }
      }

      return new Response(JSON.stringify([]), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }) as any;

    try {
      const teacherActor: VerifiedOrionActor = {
        userId: 'teacher-101',
        name: 'Dr. John Doe',
        email: 'teacher@veylentra.edu',
        role: 'teacher',
        schoolId: 'school_alpha',
        grade: 'Grade 10',
        section: 'Astra',
        authenticated: true
      };

      let pushDelivered = 0;
      const res = await executeOrionServerRequest({
        cfg: dummyCfg,
        command: 'Assign Quadratic Equations Worksheet to Class 10 Astra due Friday',
        confirmed: true,
        actionPlan: [
          {
            action: 'create_homework',
            title: 'Quadratic Equations Worksheet',
            content: 'Complete exercises 1 to 15 on page 42.',
            subject: 'Mathematics',
            targetClass: 'Class 10 Astra',
            date: '2026-12-05'
          }
        ],
        actor: teacherActor,
        dispatchPushFn: async (payload) => {
          pushDelivered++;
          return { deliveredCount: 1, failedEndpoints: [] };
        }
      });

      assert.equal(res.httpStatus, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.snapshot.verified, true);

      // Verify inserted columns
      assert.equal(insertedHomework.length, 1);
      const hw = insertedHomework[0];
      assert.equal(hw.title, 'Quadratic Equations Worksheet');
      assert.equal(hw.content, 'Complete exercises 1 to 15 on page 42.');
      assert.equal(hw.subject, 'Mathematics');
      assert.equal(hw.class_grade, 'Grade 10');
      assert.equal(hw.class_section, 'Astra');
      assert.equal(hw.given_by, 'Dr. John Doe');
      assert.equal(hw.teacher_id, 'teacher-101');
      assert.equal(hw.status, 'published');
      assert.deepEqual(hw.completed_list, []);

      // Verify notification created
      assert.equal(insertedNotifications.length, 1);
      assert.equal(insertedNotifications[0].target_role, 'student');
      assert.equal(insertedNotifications[0].target_class, 'Grade 10');
      assert.equal(insertedNotifications[0].target_section, 'Astra');

      // Verify push dispatched
      assert.equal(pushDelivered, 1);
    } finally {
      globalThis.fetch = originalFetch;
    }
  }
  console.log('✓ Orion homework execution with read-back passed');

  // TEST 5: Orion execution fails honestly when read-back verification fails
  console.log('Test 5: Read-back failure reports verified: false');
  {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (input: any, init?: any) => {
      const url = String(input);
      const method = init?.method || 'GET';
      if (url.includes('/rest/v1/homework')) {
        if (method === 'POST') {
          return new Response(JSON.stringify({ id: 'hw_fake' }), { status: 201 });
        }
        if (method === 'GET') {
          // Return empty array simulating write lost or rejected
          return new Response(JSON.stringify([]), { status: 200 });
        }
      }
      return new Response(JSON.stringify([]), { status: 200 });
    }) as any;

    try {
      const teacherActor: VerifiedOrionActor = {
        userId: 'teacher-101',
        name: 'Dr. John Doe',
        email: 'teacher@veylentra.edu',
        role: 'teacher',
        schoolId: 'school_alpha',
        grade: 'Grade 10',
        section: 'Astra',
        authenticated: true
      };

      const res = await executeOrionServerRequest({
        cfg: dummyCfg,
        command: 'Assign Quadratic Equations Worksheet to Class 10 Astra',
        confirmed: true,
        actionPlan: [
          {
            action: 'create_homework',
            title: 'Quadratic Equations Worksheet',
            targetClass: 'Class 10 Astra'
          }
        ],
        actor: teacherActor
      });

      assert.equal(res.body.success, false);
      assert.equal(res.body.snapshot.verified, false);
      assert.equal(res.body.snapshot.steps[0].status, 'failed');
    } finally {
      globalThis.fetch = originalFetch;
    }
  }
  console.log('✓ Read-back failure verification passed');

  // TEST 6: Byte adaptive response depth classification & token budgets
  console.log('Test 6: Byte adaptive response depth classification');
  {
    // Quick answer
    const d1 = classifyByteResponseDepth({ prompt: 'What is photosynthesis?' });
    assert.equal(d1.depth, 'quick_answer');
    assert.equal(d1.targetOutputBudget <= 800, true);

    // Full chapter explanation
    const d2 = classifyByteResponseDepth({ prompt: 'Explain Chapter 4 Thermodynamics in full detail with all derivations, laws, and examples.' });
    assert.equal(d2.depth, 'full_chapter');
    assert.equal(d2.targetOutputBudget >= 16384, true);

    // Step by step tutorial
    const d3 = classifyByteResponseDepth({ prompt: 'Provide a step by step guide on building a custom React hook with TypeScript' });
    assert.equal(d3.depth, 'step_by_step_tutorial');
    assert.equal(d3.targetOutputBudget >= 8192, true);

    // Revision notes
    const d4 = classifyByteResponseDepth({ prompt: 'Generate comprehensive revision notes and cheat sheet for Class 10 Periodic Table' });
    assert.equal(d4.depth, 'revision_notes');
    assert.equal(d4.targetOutputBudget >= 8192, true);
  }
  console.log('✓ Response depth classification passed');

  // TEST 7: Provider token budget scaling
  console.log('Test 7: Provider token budget scaling (no clamp to 2048/4096 on Z.ai)');
  {
    const zaiBudgetFull = resolveProviderOutputTokenBudget('zai', 24576);
    assert.equal(zaiBudgetFull.maxTokens, 24576);

    const zaiBudgetCap = resolveProviderOutputTokenBudget('zai', 50000);
    assert.equal(zaiBudgetCap.maxTokens, 32768);

    const ministralBudget = resolveProviderOutputTokenBudget('ministral', 20000);
    assert.equal(ministralBudget.maxTokens, 16384);

    const groqBudget = resolveProviderOutputTokenBudget('groq', 12000);
    assert.equal(groqBudget.maxTokens, 8192);
  }
  console.log('✓ Provider token budgets scaling passed');

  // TEST 8: System directives injection for adaptive depth
  console.log('Test 8: buildAdaptiveDepthSystemDirectives');
  {
    const depthInfo = classifyByteResponseDepth({ prompt: 'Explain full Chapter 5 in full detail from start to finish' });
    const directives = buildAdaptiveDepthSystemDirectives('You are Byte.', depthInfo);
    assert.ok(directives.includes('ADAPTIVE RESPONSE DEPTH DIRECTIVE: FULL_CHAPTER'));
    assert.ok(directives.includes('Do not cut off'));
  }
  console.log('✓ System directives injection passed');

  console.log('--- ALL ORION HOMEWORK & BYTE DEPTH TESTS PASSED ---');
}

runTests().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
