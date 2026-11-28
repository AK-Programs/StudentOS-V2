/**
 * Comprehensive verification suite for Veylentra Byte & Orion Intelligence Upgrade:
 * - Streaming-safe LaTeX/Chemistry parser + PDF math tokenizer regression check
 * - Byte multi-role intelligence across all 6 roles + strict Parent-Child isolation
 * - Orion RBAC, confirmation gating, live progress timeline stages & post-execution verification
 * - Orion strict ephemeral zero-persistence privacy audit
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import {
  expandChemistryMacros,
  preprocessLatex,
  segmentMarkdownAndMath,
  splitInlineTextWithMath,
  stabilizeStreamingMarkdown,
} from '../src/lib/mathMarkdownParser';
import { tokenizeMath } from '../src/lib/pdfGenerator';
import {
  ROLE_CAPABILITY_PROFILES,
  buildRoleAwareByteContext,
  clearByteContextCache,
  normalizeByteRole,
} from '../src/lib/byteIntelligence';
import {
  executeGetChildOverview,
  validateActionPermission,
} from '../src/lib/orionActionExecutor';
import {
  OrionAgentProgressSnapshot,
  runOrionAgentTask,
  verifyActionExecution,
} from '../src/lib/orionAgentEngine';

function makeMockSupabase(options: {
  tables?: Record<string, any[]>;
  failTable?: string;
} = {}) {
  const tables = options.tables || {};
  return {
    from(tableName: string) {
      const state: { eqs: Record<string, any>; ins: Record<string, any[]> } = {
        eqs: {},
        ins: {},
      };
      const builder: any = {
        select() {
          return builder;
        },
        eq(col: string, val: any) {
          state.eqs[col] = val;
          return builder;
        },
        in(col: string, vals: any[]) {
          state.ins[col] = vals;
          return builder;
        },
        order() {
          return builder;
        },
        limit() {
          return builder;
        },
        async maybeSingle() {
          if (options.failTable === tableName) {
            return { data: null, error: { message: 'Simulated read error' } };
          }
          const rows = (tables[tableName] || []).filter((r) => {
            for (const [k, v] of Object.entries(state.eqs)) {
              if (r[k] !== v) return false;
            }
            return true;
          });
          return { data: rows[0] || null, error: null };
        },
        then(resolve: any, reject: any) {
          if (options.failTable === tableName) {
            return Promise.resolve({ data: null, error: { message: 'Simulated error' } }).then(resolve, reject);
          }
          let rows = [...(tables[tableName] || [])];
          for (const [k, v] of Object.entries(state.eqs)) {
            rows = rows.filter((r) => r[k] === v);
          }
          for (const [k, vals] of Object.entries(state.ins)) {
            rows = rows.filter((r) => vals.includes(r[k]));
          }
          return Promise.resolve({ data: rows, error: null }).then(resolve, reject);
        },
      };
      return builder;
    },
  };
}

async function runTests() {
  console.log('--- RUNNING BYTE & ORION NEXT-GEN UPGRADE TESTS ---');

  // =========================================================================
  // 1. LaTeX, Chemistry & Streaming Markdown Stabilization Tests
  // =========================================================================
  {
    const chemExpanded = expandChemistryMacros('\\ce{2H2 + O2 -> 2H2O}');
    assert.ok(chemExpanded.includes('\\rightarrow'), 'Should expand -> arrow to \\rightarrow');
    assert.ok(chemExpanded.includes('H}_{2}'), 'Should subscript element counts in \\ce');

    const chemIon = expandChemistryMacros('\\ce{SO4^2- + Ca^2+ -> CaSO4}');
    assert.ok(chemIon.includes('^{2-}'), 'Should preserve ionic charge superscript');

    const preprocessed = preprocessLatex('A \\implies B \\iff C');
    assert.ok(preprocessed.includes('\\Rightarrow') && preprocessed.includes('\\Leftrightarrow'));

    // Inline math vs ordinary currency
    const inlineTokens = splitInlineTextWithMath('Buy books for $5 to $12.99, then solve $x^2 + y^2 = r^2$ and \\(a_n\\).');
    const mathTokens = inlineTokens.filter((t) => t.type === 'math');
    assert.equal(mathTokens.length, 2, 'Should parse 2 math tokens and ignore currency $5 / $12.99');
    assert.equal(mathTokens[0].formula, 'x^2 + y^2 = r^2');
    assert.equal(mathTokens[1].formula, 'a_n');

    // Display math blocks: $$, \[\], \begin{aligned}, \begin{pmatrix}
    const mdSample = [
      '# Quadratic & Matrix',
      '$$x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}$$',
      '\\[\\int_0^1 x^2\\,dx = \\frac{1}{3}\\]',
      '\\begin{aligned}f(x) &= x^2 \\\\ f\'(x) &= 2x\\end{aligned}',
      '```ts\nconst ok = true;\n```',
    ].join('\n');

    const blocks = segmentMarkdownAndMath(mdSample);
    const displayMathCount = blocks.filter((b) => b.type === 'math_display').length;
    assert.equal(displayMathCount, 3, 'Should segment $$, \\[...\\], and \\begin{aligned} blocks');
    assert.ok(blocks.some((b) => b.type === 'code' && b.language === 'ts'), 'Should segment fenced code block');

    // Streaming stabilization guards
    const partialDisplay = stabilizeStreamingMarkdown('Result:\n$$\n\\frac{a}{b', true);
    assert.equal(partialDisplay.pendingKind, 'display_math');
    assert.equal(partialDisplay.stableText.trim(), 'Result:');

    const partialBracket = stabilizeStreamingMarkdown('Proof:\n\\[\nx^2 + ', true);
    assert.equal(partialBracket.pendingKind, 'display_math');
    assert.equal(partialBracket.stableText.trim(), 'Proof:');

    const partialEnv = stabilizeStreamingMarkdown('System:\n\\begin{aligned}\nx &= 1', true);
    assert.equal(partialEnv.pendingKind, 'display_math');
    assert.equal(partialEnv.stableText.trim(), 'System:');

    const partialCode = stabilizeStreamingMarkdown('Snippet:\n```python\nprint("hi"', true);
    assert.equal(partialCode.pendingKind, 'code');
    assert.equal(partialCode.stableText.trim(), 'Snippet:');

    const partialInline = stabilizeStreamingMarkdown('Compute $x^2 + y^', true);
    assert.equal(partialInline.pendingKind, 'inline_math');
    assert.equal(partialInline.stableText, 'Compute');

    const finalized = stabilizeStreamingMarkdown('Compute $x^2 + y^2$', false);
    assert.equal(finalized.pendingKind, null);
    assert.equal(finalized.stableText, 'Compute $x^2 + y^2$');

    // pdfGenerator tokenizeMath regression sanity
    const pdfNodes = tokenizeMath('\\frac{a^2 + b_1}{c}');
    assert.equal(pdfNodes[0].type, 'frac', 'pdfGenerator tokenizeMath must remain intact');
    console.log('✓ 1. LaTeX, Chemistry, Streaming Stabilization & PDF Math checks passed');
  }

  // =========================================================================
  // 2. Byte Multi-Role Intelligence & Strict Parent Isolation Tests
  // =========================================================================
  {
    clearByteContextCache();
    assert.equal(normalizeByteRole('hod'), 'coordinator');
    assert.equal(normalizeByteRole('faculty'), 'teacher');
    assert.equal(normalizeByteRole('guardian'), 'parent');
    assert.equal(normalizeByteRole('admin'), 'admin');
    assert.equal(normalizeByteRole('super_admin'), 'super_admin');
    assert.equal(normalizeByteRole('student'), 'student');

    for (const r of ['student', 'teacher', 'coordinator', 'admin', 'super_admin', 'parent'] as const) {
      const profile = ROLE_CAPABILITY_PROFILES[r];
      assert.ok(profile.starterPrompts.length >= 3, `${r} should have role starterPrompts`);
      assert.ok(profile.followUpSuggestions.length >= 4, `${r} should have followUpSuggestions`);
      assert.ok(profile.modules.length >= 3, `${r} should have Veylentra modules`);
    }

    // Strict unlinked parent check: zero student leakage
    const mockDbWithOtherStudent = makeMockSupabase({
      tables: {
        attendance: [{ user_id: 'other-student-999', status: 'absent', date: '2026-11-20' }],
        homework: [{ id: 'hw-1', title: 'Secret Assignment', class_grade: 'Grade 10', completed_list: [] }],
      },
    });

    const unlinkedRes = await buildRoleAwareByteContext(
      'Show my child attendance and pending homework',
      { uid: 'parent-1', role: 'parent', name: 'Parent One' },
      'parent',
      {
        supabaseClient: mockDbWithOtherStudent,
        fetchLinkedChildren: async () => [],
      }
    );
    assert.equal(unlinkedRes.normalizedRole, 'parent');
    assert.equal(unlinkedRes.unlinkedParent, true);
    assert.ok(unlinkedRes.contextString.includes('parent_portal'));
    assert.ok(!unlinkedRes.contextString.includes('other-student-999'));
    assert.ok(!unlinkedRes.contextString.includes('Secret Assignment'));

    // Linked parent: sees ONLY verified child data
    const linkedDb = makeMockSupabase({
      tables: {
        attendance: [
          { user_id: 'child-101', status: 'present', date: '2026-11-24' },
          { user_id: 'other-999', status: 'absent', date: '2026-11-24' },
        ],
        homework: [
          { id: 'hw-child', title: 'Linear Equations', subject: 'Math', class_grade: 'Grade 9', due_date: '2026-11-28', completed_list: [] },
        ],
      },
    });
    const linkedRes = await buildRoleAwareByteContext(
      'Check my child homework and attendance today',
      { uid: 'parent-1', role: 'parent', name: 'Parent One' },
      'parent',
      {
        supabaseClient: linkedDb,
        linkedStudents: [{ uid: 'child-101', name: 'Aarav', grade: 'Grade 9', section: 'Astra', role: 'student' } as any],
      }
    );
    assert.equal(linkedRes.unlinkedParent, false);
    assert.ok(linkedRes.contextString.includes('Aarav'));
    assert.ok(linkedRes.contextString.includes('Linear Equations'));
    assert.ok(linkedRes.contextString.includes('100%')); // only child-101's present record, not other-999's absent

    // Teacher & Coordinator role contexts
    const teacherDb = makeMockSupabase({
      tables: {
        homework: [{ id: 'hw-t1', title: 'Optics Lab', subject: 'Physics', class_grade: 'Grade 10', class_section: 'Solara', completed_list: ['s1'] }],
        attendance: [{ date: '2026-11-24', status: 'present', grade: 'Grade 10', section: 'Solara', user_id: 's1' }],
        users: [{ uid: 's1', name: 'Student 1', role: 'student', grade: 'Grade 10', section: 'Solara' }],
        calendar_events: [],
        announcements: [],
      },
    });
    const teacherRes = await buildRoleAwareByteContext(
      'Summarize my class homework and attendance today',
      { uid: 'teacher-1', role: 'teacher', name: 'Ms. Rao', assignedGrades: ['Grade 10'], assignedSections: ['Solara'] },
      'teacher',
      { supabaseClient: teacherDb }
    );
    assert.equal(teacherRes.normalizedRole, 'teacher');
    assert.ok(teacherRes.contextString.includes('Optics Lab'));

    const coordRes = await buildRoleAwareByteContext(
      'Give me department cohort attendance overview',
      { uid: 'hod-1', role: 'hod', name: 'Dr. Nair', assignedGrades: ['Grade 10'] },
      'hod',
      { supabaseClient: teacherDb }
    );
    assert.equal(coordRes.normalizedRole, 'coordinator');
    assert.ok(coordRes.hasVeylentraData);

    // Admin & Super Admin context
    const adminRes = await buildRoleAwareByteContext(
      'Give me institutional overview of attendance and notices today',
      { uid: 'sa-1', role: 'super_admin', name: 'Director' },
      'super_admin',
      { supabaseClient: teacherDb }
    );
    assert.equal(adminRes.normalizedRole, 'super_admin');
    assert.ok(adminRes.contextString.includes('Ministral & Groq'));
    console.log('✓ 2. Byte Multi-Role Intelligence & Parent Isolation checks passed');
  }

  // =========================================================================
  // 3. Orion RBAC, Agent Execution Engine, & Post-Write Verification Tests
  // =========================================================================
  {
    // RBAC across all 6 roles
    assert.equal(validateActionPermission('get_child_overview', 'parent').allowed, true);
    assert.equal(validateActionPermission('create_broadcast', 'parent').allowed, false);
    assert.equal(validateActionPermission('delete_item', 'parent').allowed, false);

    assert.equal(validateActionPermission('create_study_plan', 'student').allowed, true);
    assert.equal(validateActionPermission('get_attendance', 'student').allowed, false);

    assert.equal(validateActionPermission('create_homework', 'teacher').allowed, true);
    assert.equal(validateActionPermission('create_broadcast', 'teacher').allowed, false);

    assert.equal(validateActionPermission('create_broadcast', 'coordinator').allowed, true);
    assert.equal(validateActionPermission('create_broadcast', 'hod').allowed, true);
    assert.equal(validateActionPermission('create_broadcast', 'admin').allowed, true);
    assert.equal(validateActionPermission('create_broadcast', 'super_admin').allowed, true);

    // Parent unlinked child overview isolation
    const unlinkedChildRes = await executeGetChildOverview(
      { action: 'get_child_overview' },
      { userId: 'parent-1', userRole: 'parent', linkedStudentIds: [], linkedStudents: [] }
    );
    assert.equal(unlinkedChildRes.success, false);
    assert.equal(unlinkedChildRes.error, 'NO_LINKED_CHILDREN');

    // Agent engine: RBAC failure blocks execution at preparing stage
    const snapshotsBlocked: OrionAgentProgressSnapshot[] = [];
    const blockedRes = await runOrionAgentTask({
      rawCommand: 'Broadcast school holiday',
      actions: [{ action: 'create_broadcast', title: 'Holiday' }],
      userContext: { userId: 'stu-1', userRole: 'student' },
      onProgress: (s) => snapshotsBlocked.push(s),
    });
    assert.equal(blockedRes.snapshot.phase, 'failed');
    assert.equal(blockedRes.snapshot.verified, false);
    assert.equal(blockedRes.results[0].success, false);

    // Agent engine: consequential action triggers awaiting_confirmation when !isConfirmed
    const waitRes = await runOrionAgentTask({
      rawCommand: 'Publish school notice',
      actions: [{ action: 'create_broadcast', title: 'Science Fair' }],
      userContext: { userId: 'admin-1', userRole: 'admin' },
      isConfirmed: false,
    });
    assert.equal(waitRes.snapshot.phase, 'awaiting_confirmation');
    assert.ok(waitRes.pendingConfirmation, 'Must ask confirmation before consequential write');

    // Agent engine: Full progression + verified DB success
    const stagesSeen: OrionAgentProgressSnapshot[] = [];
    const okRes = await runOrionAgentTask({
      rawCommand: 'Assign Math homework',
      actions: [{ action: 'create_homework', title: 'Algebra Sheet' }],
      userContext: { userId: 't-1', userRole: 'teacher' },
      isConfirmed: true,
      onProgress: (s) => stagesSeen.push(s),
      executor: async () => ({
        results: [
          {
            success: true,
            action: 'create_homework',
            recordId: 'hw-saved-1',
            message: 'Saved',
            summaryText: 'Saved homework.',
          },
        ],
        combinedSummary: 'Saved homework.',
        structuredCards: [],
      }),
      verifier: async (_act, res) =>
        verifyActionExecution(
          { action: 'create_homework' },
          res,
          makeMockSupabase({ tables: { homework: [{ id: 'hw-saved-1' }] } })
        ),
    });
    assert.equal(okRes.snapshot.phase, 'completed');
    assert.equal(okRes.snapshot.verified, true);
    assert.ok(stagesSeen.some((s) => s.phase === 'analyzing'));
    assert.ok(stagesSeen.some((s) => s.phase === 'planning'));
    assert.ok(stagesSeen.some((s) => s.phase === 'preparing'));
    assert.ok(stagesSeen.some((s) => s.phase === 'executing'));
    assert.ok(stagesSeen.some((s) => s.phase === 'verifying'));

    // Agent engine: Post-write verification MUST fail honestly when row is missing after write
    const badVerifyRes = await runOrionAgentTask({
      rawCommand: 'Assign Math homework',
      actions: [{ action: 'create_homework', title: 'Ghost Homework' }],
      userContext: { userId: 't-1', userRole: 'teacher' },
      isConfirmed: true,
      executor: async () => ({
        results: [
          {
            success: true,
            action: 'create_homework',
            recordId: 'hw-missing-999',
            message: 'Saved',
            summaryText: 'Saved homework.',
          },
        ],
        combinedSummary: 'Saved homework.',
        structuredCards: [],
      }),
      verifier: async (_act, res) =>
        verifyActionExecution(
          { action: 'create_homework' },
          res,
          makeMockSupabase({ tables: { homework: [] } })
        ),
    });
    assert.equal(badVerifyRes.snapshot.phase, 'failed');
    assert.equal(badVerifyRes.snapshot.verified, false);
    assert.ok(badVerifyRes.combinedSummary.includes('Verification Check'));
    console.log('✓ 3. Orion RBAC, Confirmation Gating & Post-Write Verification checks passed');
  }

  // =========================================================================
  // 4. Orion Strict Privacy Audit & Prompt-Dialog Elimination Checks
  // =========================================================================
  {
    const rootDir = path.resolve(import.meta.dirname, '..');
    const orionFiles = [
      'src/components/StudentOSJarvis.tsx',
      'src/lib/orionActionExecutor.ts',
      'src/lib/orionAgentEngine.ts',
      'src/components/orion/OrionActivityTimeline.tsx',
      'src/components/ByteOrionAssistantModal.tsx',
    ];

    for (const relPath of orionFiles) {
      const code = fs.readFileSync(path.join(rootDir, relPath), 'utf8');
      assert.ok(!code.includes('orion_chats'), `${relPath} must contain ZERO orion_chats persistence`);
      assert.ok(!code.includes('teacher_commands'), `${relPath} must contain ZERO teacher_commands persistence`);
      assert.ok(!code.includes('localStorage'), `${relPath} must contain ZERO localStorage usage`);
      assert.ok(!code.includes('sessionStorage'), `${relPath} must contain ZERO sessionStorage usage`);
      assert.ok(!code.includes('indexedDB'), `${relPath} must contain ZERO indexedDB usage`);
    }

    const executorSrc = fs.readFileSync(path.join(rootDir, 'src/lib/orionActionExecutor.ts'), 'utf8');
    assert.ok(!executorSrc.includes('User command received'), 'orionActionExecutor must not log raw command');
    assert.ok(!/console\.\w+\([^\n]*(summaryText|rawCommand)/.test(executorSrc), 'orionActionExecutor must not log rawCommand or summaryText');

    const jarvisSrc = fs.readFileSync(path.join(rootDir, 'src/components/StudentOSJarvis.tsx'), 'utf8');
    assert.ok(!jarvisSrc.includes('Voice Log'), 'Voice Log history view must be removed');
    assert.ok(jarvisSrc.includes('isExplicitTabNavigationCommand'), 'Navigation hijack fix guard must exist');

    const byteWorkspaceSrc = fs.readFileSync(path.join(rootDir, 'src/components/byte/ByteWorkspace.tsx'), 'utf8');
    assert.ok(!byteWorkspaceSrc.includes('window.prompt('), 'ByteWorkspace must not use blocking window.prompt');
    assert.ok(!byteWorkspaceSrc.includes('window.alert('), 'ByteWorkspace must not use blocking window.alert');
    console.log('✓ 4. Orion Strict Ephemeral Privacy & UI Interaction checks passed');
  }

  console.log('ALL BYTE & ORION UPGRADE TESTS PASSED SUCCESSFULLY.');
}

runTests().catch((err) => {
  console.error('❌ BYTE & ORION UPGRADE TEST FAILED:', err);
  process.exit(1);
});
