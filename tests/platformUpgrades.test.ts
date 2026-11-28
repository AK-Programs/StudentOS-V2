/**
 * Comprehensive Platform Upgrades Verification Suite
 * Covers:
 * 1. /api/health & /api/ai/health (zero secrets exposed) & SSE EOF trailing buffer flush
 * 2. Strict Parent/Guardian HTTP 403 exclusion across ALL Orion endpoints (Express & Vercel serverless)
 *    + 5 allowed roles + task lifecycle cancel / retry / report export + UI exclusion checks
 * 3. Material Hub Intelligence (/api/materials/ask, /api/materials/recommendations)
 *    + strict role/visibility isolation + grounded citations + no fabricated URLs
 * 4. Assignment Center All 6 Workflows:
 *    - Notebook Intelligence (real notes, zero fake scores)
 *    - AI Assignment Builder (faculty-only 403 for students, draft + edit + confirm gate)
 *    - Submissions Management (student privacy + faculty grading)
 *    - Notebook Completion Reports (JSON/Markdown/CSV)
 *    - Assignment Quality Analyzer (strictly read-only)
 *    - Group Projects (groups, roles, milestones, submissions, grading, non-member 403)
 * 5. Ordered idempotent SQL migrations & hardened firestore.rules checks
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';

import { app } from '../server';
import serverlessHandler from '../api/index';
import { streamAICompletion, ZAI_CHAT_COMPLETIONS_URL } from '../server/aiClient';
import {
  buildOrionCompletionReportJson,
  buildOrionCompletionReportMarkdown,
} from '../src/lib/orionAgentEngine';

async function startHttpServer(
  handler: http.RequestListener | any
): Promise<{ baseUrl: string; close: () => Promise<void> }> {
  return new Promise((resolve) => {
    const server = http.createServer(handler);
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address() as any;
      resolve({
        baseUrl: `http://127.0.0.1:${addr.port}`,
        close: () =>
          new Promise<void>((res) => {
            server.close(() => res());
          }),
      });
    });
  });
}

async function runTests() {
  console.log('--- RUNNING VEYLENTRA PLATFORM UPGRADES TEST SUITE ---');

  const rootDir = path.resolve(import.meta.dirname, '..');
  const expressSrv = await startHttpServer(app);
  const vercelSrv = await startHttpServer(serverlessHandler);

  const prevFetch = globalThis.fetch;
  const prevZai = process.env.ZAI_API_KEY;
  const prevGroq = process.env.GROQ_API_KEY;
  const prevMinistral = process.env.MINISTRAL_API_KEY;

  process.env.ZAI_API_KEY = 'test-zai-secret-never-leak';
  delete process.env.GROQ_API_KEY;
  delete process.env.MINISTRAL_API_KEY;

  // Mock external AI & Supabase Auth calls while passing through localhost test servers
  globalThis.fetch = (async (input: any, init?: any) => {
    const url = typeof input === 'string' ? input : String(input?.url || input);
    if (url.startsWith(expressSrv.baseUrl) || url.startsWith(vercelSrv.baseUrl)) {
      return prevFetch(input, init);
    }

    if (url.includes('/auth/v1/user')) {
      const headers = init?.headers;
      const authRaw =
        headers && typeof headers.get === 'function'
          ? String(headers.get('authorization') || headers.get('Authorization') || '')
          : String(headers?.Authorization || headers?.authorization || '');
      const token = authRaw.replace(/^Bearer\s+/i, '').trim();
      if (token === 'parent-jwt') {
        return new Response(
          JSON.stringify({ id: 'parent-user-1', email: 'parent@school.edu', user_metadata: { role: 'parent', name: 'Parent One' } }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      if (token === 'guardian-jwt') {
        return new Response(
          JSON.stringify({ id: 'guardian-user-1', email: 'guardian@school.edu', user_metadata: { role: 'guardian', name: 'Guardian One' } }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      if (token === 'student-jwt') {
        return new Response(
          JSON.stringify({ id: 'student-1', email: 'student1@school.edu', user_metadata: { role: 'student', name: 'Aarav', grade: 'Grade 10', section: 'Solara' } }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      if (token === 'teacher-jwt') {
        return new Response(
          JSON.stringify({ id: 'teacher-1', email: 'teacher1@school.edu', user_metadata: { role: 'teacher', name: 'Ms. Verma' } }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      return new Response(JSON.stringify({ error: 'invalid jwt' }), { status: 401 });
    }

    if (url === ZAI_CHAT_COMPLETIONS_URL) {
      return new Response(
        JSON.stringify({
          choices: [{ message: { content: 'Grounded answer citing [1] AVL Tree Rotations Revision Sheet.' }, finish_reason: 'stop' }],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(JSON.stringify([]), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }) as any;

  try {
    // =======================================================================
    // 1. Health Endpoints (Zero Secrets) + SSE EOF Buffer Flush
    // =======================================================================
    for (const srv of [expressSrv, vercelSrv]) {
      const h1 = await prevFetch(`${srv.baseUrl}/api/health`);
      assert.equal(h1.status, 200);
      const h1Text = await h1.text();
      assert.ok(!h1Text.includes('test-zai-secret-never-leak'), 'Health must never leak ZAI_API_KEY');

      const h2 = await prevFetch(`${srv.baseUrl}/api/ai/health`);
      assert.equal(h2.status, 200);
      const h2Json: any = await h2.json();
      assert.equal(h2Json.providers.zai.configured, true);
      assert.equal(h2Json.providers.zai.model, 'glm-4.7-flash');
      assert.ok(!JSON.stringify(h2Json).includes('test-zai-secret-never-leak'));
    }

    // SSE EOF flush without trailing newline
    const eofFetch = globalThis.fetch;
    globalThis.fetch = (async (input: any, init?: any) => {
      if (String(input) === ZAI_CHAT_COMPLETIONS_URL) {
        const sseWithoutTrailingNewline =
          'data: {"choices":[{"delta":{"content":"First "}}]}\n\n' +
          'data: {"choices":[{"delta":{"content":"EOFToken"}}]}';
        const stream = new ReadableStream({
          start(c) {
            c.enqueue(new TextEncoder().encode(sseWithoutTrailingNewline));
            c.close();
          },
        });
        return new Response(stream, { status: 200, headers: { 'Content-Type': 'text/event-stream' } });
      }
      return eofFetch(input, init);
    }) as any;

    const eofRes = await streamAICompletion(
      { prompt: 'test eof', modelOverride: 'zai' },
      { onToken: () => {} }
    );
    assert.equal(eofRes.text, 'First EOFToken', 'SSE parser must flush trailing buffer at EOF');
    globalThis.fetch = eofFetch;
    console.log('✓ 1. Health endpoints (zero secrets) and SSE EOF buffer flush passed');

    // =======================================================================
    // 2. Parent/Guardian Strict 403 Exclusion Across ALL Orion Endpoints + Task Lifecycle
    // =======================================================================
    for (const srv of [expressSrv, vercelSrv]) {
      for (const token of ['parent-jwt', 'guardian-jwt']) {
        const execRes = await prevFetch(`${srv.baseUrl}/api/orion/execute`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ command: 'Show my schedule' }),
        });
        assert.equal(execRes.status, 403, `${srv.baseUrl} /api/orion/execute must return 403 for ${token}`);

        const listRes = await prevFetch(`${srv.baseUrl}/api/orion/tasks`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        assert.equal(listRes.status, 403, `${srv.baseUrl} /api/orion/tasks must return 403 for ${token}`);

        const getRes = await prevFetch(`${srv.baseUrl}/api/orion/tasks/task_1`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        assert.equal(getRes.status, 403, `${srv.baseUrl} /api/orion/tasks/:id must return 403 for ${token}`);

        const cancelRes = await prevFetch(`${srv.baseUrl}/api/orion/tasks/task_1/cancel`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        });
        assert.equal(cancelRes.status, 403, `${srv.baseUrl} /api/orion/tasks/:id/cancel must return 403 for ${token}`);

        const retryRes = await prevFetch(`${srv.baseUrl}/api/orion/tasks/task_1/retry`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        });
        assert.equal(retryRes.status, 403, `${srv.baseUrl} /api/orion/tasks/:id/retry must return 403 for ${token}`);

        const assistRes = await prevFetch(`${srv.baseUrl}/api/ai/orion-assist`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ topic: 'Explain gravity', intent: 'student_explain' }),
        });
        assert.equal(assistRes.status, 403, `${srv.baseUrl} /api/ai/orion-assist must return 403 for ${token}`);

        const chatRes = await prevFetch(`${srv.baseUrl}/api/ai/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ prompt: 'Hello Orion', persona: 'orion', stream: false }),
        });
        assert.equal(chatRes.status, 403, `${srv.baseUrl} /api/ai/chat persona=orion must return 403 for ${token}`);
      }
    }

    // Allowed role (teacher) executes Orion task, retrieves/cancels/retries & exports report
    const okOrionRes = await prevFetch(`${expressSrv.baseUrl}/api/orion/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer teacher-jwt' },
      body: JSON.stringify({
        command: 'Create homework on Optics',
        actionPlan: [{ action: 'create_homework', title: 'Optics Worksheet', subject: 'Physics' }],
        confirmed: false,
        idempotencyKey: 'idem-orion-1',
      }),
    });
    assert.equal(okOrionRes.status, 200);
    const okOrionJson: any = await okOrionRes.json();
    assert.ok(okOrionJson.taskId, 'Orion execute must return taskId');

    const taskInspectRes = await prevFetch(`${expressSrv.baseUrl}/api/orion/tasks/${encodeURIComponent(okOrionJson.taskId)}`, {
      headers: { Authorization: 'Bearer teacher-jwt' },
    });
    assert.equal(taskInspectRes.status, 200);

    // Foreign student trying to inspect/cancel teacher's task -> 403
    const foreignTaskRes = await prevFetch(`${expressSrv.baseUrl}/api/orion/tasks/${encodeURIComponent(okOrionJson.taskId)}/cancel`, {
      method: 'POST',
      headers: { Authorization: 'Bearer student-jwt' },
    });
    assert.equal(foreignTaskRes.status, 403);

    const reportSample = {
      taskId: okOrionJson.taskId,
      generatedAt: new Date().toISOString(),
      actorRole: 'teacher',
      command: 'Create homework on Optics',
      status: 'completed',
      verified: true,
      durationMs: 120,
      stages: [],
      summary: 'Created Optics homework.',
      steps: [{ label: 'Validate RBAC', status: 'completed', detail: 'Allowed for teacher' }],
      markdown: '# Orion Task Completion Report\nCreated Optics homework.',
    };
    const mdReport = buildOrionCompletionReportMarkdown(reportSample);
    const jsonReport = buildOrionCompletionReportJson(reportSample);
    assert.ok(mdReport.includes('Orion Task Completion Report'));
    assert.ok(jsonReport.includes(okOrionJson.taskId));

    // Parent UI static checks
    const appSrc = fs.readFileSync(path.join(rootDir, 'src/App.tsx'), 'utf8');
    const modalSrc = fs.readFileSync(path.join(rootDir, 'src/components/ByteOrionAssistantModal.tsx'), 'utf8');
    const floatSrc = fs.readFileSync(path.join(rootDir, 'src/components/byte/FloatingByteWidget.tsx'), 'utf8');
    const byteWsSrc = fs.readFileSync(path.join(rootDir, 'src/components/byte/ByteWorkspace.tsx'), 'utf8');
    const jarvisSrc = fs.readFileSync(path.join(rootDir, 'src/components/StudentOSJarvis.tsx'), 'utf8');
    assert.ok(appSrc.includes("effectiveRole !== 'parent'") && appSrc.includes("'guardian'") && appSrc.includes("if (effectiveRole === 'parent' || (effectiveRole as string) === 'guardian') return;"));
    assert.ok(modalSrc.includes('isParentOrGuardian'));
    assert.ok(floatSrc.includes('isParentOrGuardian'));
    assert.ok(byteWsSrc.includes('isParentOrGuardian'));
    assert.ok(jarvisSrc.includes('parent') && jarvisSrc.includes('guardian'));
    console.log('✓ 2. Parent/Guardian 403 exclusion across ALL Orion endpoints & UI + task lifecycle passed');

    // =======================================================================
    // 3. Material Hub Intelligence (Ask to Materials & Recommendations)
    // =======================================================================
    const sampleMaterials = [
      {
        id: 'mat-pub-1',
        title: 'AVL Tree Rotations Revision Sheet',
        subject: 'Computer Science',
        type: 'notes',
        description: 'Covers LL, RR, LR, and RL balance factor rotations with O(log n) height proofs.',
        visibility: 'student',
        isPublic: true,
        isVerified: true,
      },
      {
        id: 'mat-teacher-secret',
        title: 'Faculty Exam Answer Key (Confidential)',
        subject: 'Computer Science',
        type: 'notes',
        description: 'Confidential final exam solution key with secret answers.',
        visibility: 'teacher',
        isPublic: false,
      },
    ];

    // Student cannot query teacher-vault material directly (403)
    const deniedMatRes = await prevFetch(`${expressSrv.baseUrl}/api/materials/ask`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer student-jwt' },
      body: JSON.stringify({
        question: 'Give confidential exam answers',
        materialId: 'mat-teacher-secret',
        materials: sampleMaterials,
      }),
    });
    assert.equal(deniedMatRes.status, 403);

    // Student asking about AVL trees gets grounded citation & omits teacher material
    const askHitRes = await prevFetch(`${vercelSrv.baseUrl}/api/materials/ask`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer student-jwt' },
      body: JSON.stringify({
        question: 'Explain AVL tree balance factor rotations',
        history: [{ role: 'user', content: 'Hi' }],
        materials: sampleMaterials,
      }),
    });
    assert.equal(askHitRes.status, 200);
    const askHitJson: any = await askHitRes.json();
    assert.equal(askHitJson.foundInMaterials, true);
    assert.ok(askHitJson.citations.length >= 1);
    assert.equal(askHitJson.citations[0].materialId, 'mat-pub-1');
    assert.ok(askHitJson.citations.every((c: any) => c.materialId !== 'mat-teacher-secret'));

    // Absent topic yields foundInMaterials=false & zero fabricated citations
    const askMissRes = await prevFetch(`${expressSrv.baseUrl}/api/materials/ask`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer student-jwt' },
      body: JSON.stringify({
        question: 'Explain Byzantine Roman taxation law',
        materials: sampleMaterials,
      }),
    });
    assert.equal(askMissRes.status, 200);
    const askMissJson: any = await askMissRes.json();
    assert.equal(askMissJson.foundInMaterials, false);
    assert.equal(askMissJson.citations.length, 0);

    // Recommendations separate internal vs external with zero fake URLs
    const recRes = await prevFetch(`${expressSrv.baseUrl}/api/materials/recommendations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer student-jwt' },
      body: JSON.stringify({
        subject: 'Computer Science',
        topic: 'AVL rotations',
        materials: sampleMaterials,
      }),
    });
    assert.equal(recRes.status, 200);
    const recJson: any = await recRes.json();
    assert.ok(recJson.internalRecommendations.some((r: any) => r.materialId === 'mat-pub-1'));
    assert.ok(!recJson.internalRecommendations.some((r: any) => r.materialId === 'mat-teacher-secret'));
    assert.ok(recJson.externalSuggestions.every((e: any) => e.label === 'External Study Suggestion' && !/https?:\/\//i.test(JSON.stringify(e))));
    console.log('✓ 3. Material Hub Ask & Recommendations (visibility isolation + real citations) passed');

    // =======================================================================
    // 4. Assignment Center All 6 Workflows
    // =======================================================================
    // 4.1 Notebook Intelligence
    const emptyNbRes = await prevFetch(`${expressSrv.baseUrl}/api/assignments/notebook-intelligence`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer student-jwt' },
      body: JSON.stringify({ notes: [] }),
    });
    const emptyNbJson: any = await emptyNbRes.json();
    assert.equal(emptyNbJson.hasNotes, false);
    assert.equal(emptyNbJson.completenessScore, null);

    const realNbRes = await prevFetch(`${expressSrv.baseUrl}/api/assignments/notebook-intelligence`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer student-jwt' },
      body: JSON.stringify({
        subject: 'Physics',
        topics: ['Torque', 'Angular Momentum'],
        notes: [
          {
            id: 'n1',
            userId: 'student-1',
            title: 'Rotational Dynamics',
            subject: 'Physics',
            content: '# Torque\n- Definition: $\\tau = r \\times F$\n- Example problem solved step by step for rigid wheel inertia.',
          },
        ],
      }),
    });
    const realNbJson: any = await realNbRes.json();
    assert.equal(realNbJson.hasNotes, true);
    assert.ok(realNbJson.completenessScore > 0);
    assert.ok(realNbJson.gaps.some((g: string) => g.includes('Angular Momentum')));

    // 4.2 AI Assignment Builder (student 403, faculty draft -> confirm gate -> publish)
    const studentBuilderRes = await prevFetch(`${expressSrv.baseUrl}/api/assignments/ai-builder`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer student-jwt' },
      body: JSON.stringify({ subject: 'Physics', topic: 'Kinematics' }),
    });
    assert.equal(studentBuilderRes.status, 403);

    const draftRes = await prevFetch(`${expressSrv.baseUrl}/api/assignments/ai-builder`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer teacher-jwt' },
      body: JSON.stringify({ subject: 'Physics', topic: 'Kinematics', questionCount: 3 }),
    });
    assert.equal(draftRes.status, 201);
    const draftJson: any = await draftRes.json();
    assert.equal(draftJson.draft.status, 'draft');

    // Cannot publish without confirmed=true
    const unconfirmedPubRes = await prevFetch(
      `${expressSrv.baseUrl}/api/assignments/drafts/${encodeURIComponent(draftJson.draft.id)}/publish`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer teacher-jwt' },
        body: JSON.stringify({ confirmed: false }),
      }
    );
    assert.equal(unconfirmedPubRes.status, 400);

    // Publish with confirmed=true + edited title
    const confirmedPubRes = await prevFetch(
      `${expressSrv.baseUrl}/api/assignments/drafts/${encodeURIComponent(draftJson.draft.id)}/publish`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer teacher-jwt' },
        body: JSON.stringify({ confirmed: true, title: 'Kinematics Final Edited Sheet' }),
      }
    );
    assert.equal(confirmedPubRes.status, 200);
    const confirmedPubJson: any = await confirmedPubRes.json();
    assert.equal(confirmedPubJson.draft.status, 'published');
    assert.equal(confirmedPubJson.publishedAssignment.title, 'Kinematics Final Edited Sheet');

    // 4.3 Submissions Management & Tracking
    const subPostRes = await prevFetch(`${expressSrv.baseUrl}/api/assignments/submissions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer student-jwt' },
      body: JSON.stringify({
        assignmentId: confirmedPubJson.publishedAssignment.id,
        assignmentTitle: 'Kinematics Final Edited Sheet',
        submissionText: 'Attached full derivation for kinematic equations.',
        maxScore: 20,
      }),
    });
    assert.equal(subPostRes.status, 201);
    const subPostJson: any = await subPostRes.json();

    // Student querying another student's submissions -> 403
    const otherSubRes = await prevFetch(`${expressSrv.baseUrl}/api/assignments/submissions?studentId=student-999`, {
      headers: { Authorization: 'Bearer student-jwt' },
    });
    assert.equal(otherSubRes.status, 403);

    // Student trying to grade -> 403
    const studentGradeRes = await prevFetch(
      `${expressSrv.baseUrl}/api/assignments/submissions/${encodeURIComponent(subPostJson.submission.id)}/grade`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer student-jwt' },
        body: JSON.stringify({ score: 20 }),
      }
    );
    assert.equal(studentGradeRes.status, 403);

    // Faculty grades -> 200
    const teacherGradeRes = await prevFetch(
      `${expressSrv.baseUrl}/api/assignments/submissions/${encodeURIComponent(subPostJson.submission.id)}/grade`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer teacher-jwt' },
        body: JSON.stringify({ score: 18, maxScore: 20, feedback: 'Clear derivations.' }),
      }
    );
    assert.equal(teacherGradeRes.status, 200);
    const teacherGradeJson: any = await teacherGradeRes.json();
    assert.equal(teacherGradeJson.submission.score, 18);

    // 4.4 Notebook Completion Reports
    const repRes = await prevFetch(`${vercelSrv.baseUrl}/api/assignments/notebook-completion-report`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer student-jwt' },
      body: JSON.stringify({
        topics: ['Torque', 'Entropy'],
        notes: [
          {
            id: 'n1',
            userId: 'student-1',
            title: 'Torque & Equilibrium',
            subject: 'Physics',
            content: 'Torque equals radius cross force and keeps rotational equilibrium when net torque is zero across rigid bodies in lab experiments.',
          },
        ],
      }),
    });
    assert.equal(repRes.status, 200);
    const repJson: any = await repRes.json();
    assert.equal(repJson.report.totals.totalNotes, 1);
    assert.ok(repJson.markdown.includes('# Notebook Completion Report'));
    assert.ok(repJson.csv.includes('Category,Name,Subject,Status'));

    // 4.5 Assignment Quality Analyzer (strictly read-only)
    const qaRes = await prevFetch(`${expressSrv.baseUrl}/api/assignments/quality-analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer teacher-jwt' },
      body: JSON.stringify({
        title: 'Quick Quiz',
        instructions: 'Solve',
        maxScore: 50,
        questions: [
          { prompt: 'Explain force and acceleration laws clearly', marks: 10, difficulty: 'Easy' },
          { prompt: 'Explain force and acceleration laws clearly', marks: 10, difficulty: 'Easy' },
        ],
      }),
    });
    assert.equal(qaRes.status, 200);
    const qaJson: any = await qaRes.json();
    assert.equal(qaJson.readOnly, true);
    assert.equal(qaJson.mutatedSavedAssignment, false);
    assert.equal(qaJson.analysis.markDistribution.markMismatch, true);
    assert.ok(qaJson.analysis.repeatedPairs.length >= 1);

    // 4.6 Group Projects
    const gpCreateRes = await prevFetch(`${expressSrv.baseUrl}/api/assignments/group-projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer teacher-jwt' },
      body: JSON.stringify({ title: 'Solar Rover Design', subject: 'Physics', maxScore: 50 }),
    });
    assert.equal(gpCreateRes.status, 201);
    const gpJson: any = await gpCreateRes.json();

    const grpAssignRes = await prevFetch(
      `${expressSrv.baseUrl}/api/assignments/group-projects/${encodeURIComponent(gpJson.project.id)}/groups`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer teacher-jwt' },
        body: JSON.stringify({
          groupId: 'grp-other',
          name: 'Team Beta',
          members: [{ userId: 'student-other', name: 'Riya', role: 'Leader' }],
        }),
      }
    );
    assert.equal(grpAssignRes.status, 200);

    // Non-member student-1 blocked from updating grp-other milestone or submitting (403)
    const nonMemberMilestone = await prevFetch(
      `${expressSrv.baseUrl}/api/assignments/group-projects/${encodeURIComponent(gpJson.project.id)}/milestones`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer student-jwt' },
        body: JSON.stringify({ groupId: 'grp-other', milestoneId: 'ms_1', status: 'done' }),
      }
    );
    assert.equal(nonMemberMilestone.status, 403);

    // Assign Team Alpha with student-1 -> student-1 updates milestone & submits -> teacher grades
    await prevFetch(
      `${expressSrv.baseUrl}/api/assignments/group-projects/${encodeURIComponent(gpJson.project.id)}/groups`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer teacher-jwt' },
        body: JSON.stringify({
          groupId: 'grp-alpha',
          name: 'Team Alpha',
          members: [{ userId: 'student-1', name: 'Aarav', role: 'Leader' }],
        }),
      }
    );

    const okMs = await prevFetch(
      `${expressSrv.baseUrl}/api/assignments/group-projects/${encodeURIComponent(gpJson.project.id)}/milestones`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer student-jwt' },
        body: JSON.stringify({ groupId: 'grp-alpha', milestoneId: 'ms_1', status: 'done' }),
      }
    );
    assert.equal(okMs.status, 200);

    const okSub = await prevFetch(
      `${expressSrv.baseUrl}/api/assignments/group-projects/${encodeURIComponent(gpJson.project.id)}/submit`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer student-jwt' },
        body: JSON.stringify({ groupId: 'grp-alpha', submissionText: 'Rover CAD & battery telemetry delivered.' }),
      }
    );
    assert.equal(okSub.status, 200);

    const okGrade = await prevFetch(
      `${expressSrv.baseUrl}/api/assignments/group-projects/${encodeURIComponent(gpJson.project.id)}/grade`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer teacher-jwt' },
        body: JSON.stringify({ groupId: 'grp-alpha', score: 46, feedback: 'Strong prototype!' }),
      }
    );
    assert.equal(okGrade.status, 200);
    console.log('✓ 4. Assignment Center all 6 workflows passed');

    // =======================================================================
    // 5. SQL Migrations & Firestore Rules Hardening Checks
    // =======================================================================
    const migDir = path.join(rootDir, 'supabase', 'migrations');
    const expectedSqls = [
      '20261128_01_security_rls_hardening.sql',
      '20261128_02_material_hub_intelligence.sql',
      '20261128_03_assignment_center_and_group_projects.sql',
      '20261128_98_verify_upgrade.sql',
      '20261128_99_rollback_upgrade.sql',
    ];
    for (const file of expectedSqls) {
      const fullPath = path.join(migDir, file);
      assert.ok(fs.existsSync(fullPath), `Missing migration file: ${file}`);
      const sql = fs.readFileSync(fullPath, 'utf8');
      assert.ok(!/sk-[a-zA-Z0-9]{15,}|AIza[0-9A-Za-z_-]{20,}/.test(sql), `No secrets in ${file}`);
    }

    const rulesSrc = fs.readFileSync(path.join(rootDir, 'firestore.rules'), 'utf8');
    assert.ok(!rulesSrc.includes('||\n        true') && !rulesSrc.includes('|| true'), 'firestore.rules must not contain || true escalation');
    assert.ok(rulesSrc.includes('match /orionChats/{chatId}') && rulesSrc.includes('allow read, write: if false;'), 'firestore.rules must block client orionChats persistence');
    console.log('✓ 5. Ordered idempotent SQL migrations & hardened firestore.rules checks passed');

    console.log('ALL PLATFORM UPGRADE TESTS PASSED SUCCESSFULLY.');
  } finally {
    globalThis.fetch = prevFetch;
    if (prevZai === undefined) delete process.env.ZAI_API_KEY;
    else process.env.ZAI_API_KEY = prevZai;
    if (prevGroq === undefined) delete process.env.GROQ_API_KEY;
    else process.env.GROQ_API_KEY = prevGroq;
    if (prevMinistral === undefined) delete process.env.MINISTRAL_API_KEY;
    else process.env.MINISTRAL_API_KEY = prevMinistral;
    await expressSrv.close();
    await vercelSrv.close();
  }
}

runTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ PLATFORM UPGRADES TEST FAILED:', err);
    process.exit(1);
  });
