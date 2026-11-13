/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Veylentra — Student–Faculty Connected Academic Workflow 2.0 Verification Suite
 * Exercises Scenarios A–F against the live Express router, authorization guards,
 * WebSocket scope filters, notification eligibility, Byte determinism, and AI lock.
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { AddressInfo } from 'node:net';
import { app } from '../server';
import {
  isWsClientEligibleForAcademicEvent,
  resetTestAcademicStore
} from '../server/academicWorkflowModule';
import { isUserEligibleForNotification } from '../src/lib/notifications';
import { buildByteReminders } from '../src/lib/byteReminderEngine';
import { UserProfile } from '../src/types';

let passed = 0;

async function runAsyncTest(name: string, fn: () => Promise<void> | void) {
  await fn();
  passed += 1;
  console.log(`✅ [PASS] ${name}`);
}

const teacherHeaders = {
  'Content-Type': 'application/json',
  'x-veylentra-uid': 'fac-elena-1',
  'x-veylentra-name': 'Dr. Elena Rostova',
  'x-veylentra-role': 'teacher',
  'x-veylentra-grade': 'Grade 10',
  'x-veylentra-section': 'Solara',
  'x-veylentra-assigned-grades': 'Grade 10',
  'x-veylentra-assigned-sections': 'Solara'
};

const outOfScopeTeacherHeaders = {
  'Content-Type': 'application/json',
  'x-veylentra-uid': 'fac-out-2',
  'x-veylentra-name': 'Prof. Orion Locke',
  'x-veylentra-role': 'teacher',
  'x-veylentra-grade': 'Grade 12',
  'x-veylentra-section': 'Vega',
  'x-veylentra-assigned-grades': 'Grade 12',
  'x-veylentra-assigned-sections': 'Vega'
};

const studentSolaraHeaders = {
  'Content-Type': 'application/json',
  'x-veylentra-uid': 'stu-solara-1',
  'x-veylentra-name': 'Aarav Patel',
  'x-veylentra-email': 'aarav@school.edu',
  'x-veylentra-role': 'student',
  'x-veylentra-grade': 'Grade 10',
  'x-veylentra-section': 'Solara'
};

const studentSolaraPeerHeaders = {
  'Content-Type': 'application/json',
  'x-veylentra-uid': 'stu-solara-2',
  'x-veylentra-name': 'Diya Sharma',
  'x-veylentra-email': 'diya@school.edu',
  'x-veylentra-role': 'student',
  'x-veylentra-grade': 'Grade 10',
  'x-veylentra-section': 'Solara'
};

const studentAstraHeaders = {
  'Content-Type': 'application/json',
  'x-veylentra-uid': 'stu-astra-3',
  'x-veylentra-name': 'Liam Chen',
  'x-veylentra-email': 'liam@school.edu',
  'x-veylentra-role': 'student',
  'x-veylentra-grade': 'Grade 11',
  'x-veylentra-section': 'Astra'
};

async function apiJson(baseUrl: string, route: string, options: RequestInit = {}) {
  const resp = await fetch(`${baseUrl}${route}`, options);
  const data = await resp.json().catch(() => ({}));
  return { status: resp.status, data };
}

async function main() {
  console.log('--- RUNNING CONNECTED ACADEMIC WORKFLOWS 2.0 TEST SUITE ---');
  resetTestAcademicStore();

  const server: http.Server = await new Promise((resolve) => {
    const srv = app.listen(0, '127.0.0.1', () => resolve(srv));
  });
  const port = (server.address() as AddressInfo).port;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    // =========================================================================
    // SCENARIO A: Full Assignment Lifecycle + Evaluation + Revision Guard
    // =========================================================================
    let assignmentId = '';

    await runAsyncTest('Scenario A1: Draft assignment is hidden from students until published', async () => {
      const createRes = await apiJson(baseUrl, '/api/academic/assignments', {
        method: 'POST',
        headers: teacherHeaders,
        body: JSON.stringify({
          title: 'Kinematics Lab Report',
          subject: 'Physics',
          content: 'Analyze projectile trajectories and plot error bars.',
          classGrade: 'Grade 10',
          classSection: 'Solara',
          status: 'draft',
          maxScore: 50,
          dueDate: new Date(Date.now() + 86400000 * 4).toISOString().split('T')[0]
        })
      });
      assert.equal(createRes.status, 201);
      assert.equal(createRes.data.success, true);
      assignmentId = createRes.data.assignment.id;

      const solaraFeed = await apiJson(baseUrl, '/api/academic/assignments', { headers: studentSolaraHeaders });
      assert.equal(solaraFeed.status, 200);
      assert.equal(solaraFeed.data.assignments.some((a: any) => a.id === assignmentId), false);
    });

    await runAsyncTest('Scenario A2: Publishing scopes assignment strictly to Grade 10 Solara', async () => {
      const pubRes = await apiJson(baseUrl, `/api/academic/assignments/${assignmentId}`, {
        method: 'PATCH',
        headers: teacherHeaders,
        body: JSON.stringify({ status: 'published' })
      });
      assert.equal(pubRes.status, 200);
      assert.equal(pubRes.data.assignment.status, 'published');

      const solaraFeed = await apiJson(baseUrl, '/api/academic/assignments', { headers: studentSolaraHeaders });
      assert.equal(solaraFeed.data.assignments.some((a: any) => a.id === assignmentId), true);

      const astraFeed = await apiJson(baseUrl, '/api/academic/assignments', { headers: studentAstraHeaders });
      assert.equal(astraFeed.data.assignments.some((a: any) => a.id === assignmentId), false);

      // Out-of-cohort student cannot submit to Solara assignment
      const forbiddenSub = await apiJson(baseUrl, `/api/academic/assignments/${assignmentId}/submit`, {
        method: 'POST',
        headers: studentAstraHeaders,
        body: JSON.stringify({ submissionText: 'Attempting cross-cohort submit' })
      });
      assert.equal(forbiddenSub.status, 403);
    });

    await runAsyncTest('Scenario A3: Student submission, faculty metrics, score validation, evaluation, and revision flow', async () => {
      // Empty submission returns 400
      const emptySub = await apiJson(baseUrl, `/api/academic/assignments/${assignmentId}/submit`, {
        method: 'POST',
        headers: studentSolaraHeaders,
        body: JSON.stringify({ submissionText: '', attachmentUrl: '' })
      });
      assert.equal(emptySub.status, 400);

      // Valid submission succeeds
      const subRes = await apiJson(baseUrl, `/api/academic/assignments/${assignmentId}/submit`, {
        method: 'POST',
        headers: studentSolaraHeaders,
        body: JSON.stringify({
          submissionText: 'Completed trajectory table and error propagation notes.',
          attachmentUrl: 'https://example.org/lab-report.pdf',
          attachmentName: 'lab-report.pdf'
        })
      });
      assert.equal(subRes.status, 200);
      assert.equal(subRes.data.submission.status, 'submitted');

      // Teacher inspects submissions and stats
      const subsList = await apiJson(baseUrl, `/api/academic/assignments/${assignmentId}/submissions`, {
        headers: teacherHeaders
      });
      assert.equal(subsList.status, 200);
      assert.equal(subsList.data.submissions.length, 1);

      const facFeed = await apiJson(baseUrl, '/api/academic/assignments', { headers: teacherHeaders });
      const targetHw = facFeed.data.assignments.find((a: any) => a.id === assignmentId);
      assert.equal(targetHw.stats.submittedCount, 1);
      assert.equal(targetHw.stats.pendingEvaluationCount, 1);

      // Invalid score > maxScore returns 400
      const badEval = await apiJson(baseUrl, `/api/academic/assignments/${assignmentId}/evaluate`, {
        method: 'POST',
        headers: teacherHeaders,
        body: JSON.stringify({
          studentId: 'stu-solara-1',
          score: 75,
          maxScore: 50,
          feedback: 'Too high'
        })
      });
      assert.equal(badEval.status, 400);

      // Valid evaluation releases marks & feedback
      const evalRes = await apiJson(baseUrl, `/api/academic/assignments/${assignmentId}/evaluate`, {
        method: 'POST',
        headers: teacherHeaders,
        body: JSON.stringify({
          studentId: 'stu-solara-1',
          studentName: 'Aarav Patel',
          score: 46,
          maxScore: 50,
          feedback: 'Strong derivation and clean graph.',
          action: 'evaluate',
          resultsReleased: true
        })
      });
      assert.equal(evalRes.status, 200);
      assert.equal(evalRes.data.submission.status, 'evaluated');
      assert.equal(evalRes.data.submission.score, 46);

      // Evaluated work cannot be overwritten by student without revision authorization -> 409
      const dupSub = await apiJson(baseUrl, `/api/academic/assignments/${assignmentId}/submit`, {
        method: 'POST',
        headers: studentSolaraHeaders,
        body: JSON.stringify({ submissionText: 'Trying to overwrite graded work' })
      });
      assert.equal(dupSub.status, 409);

      // Teacher returns for revision -> student can now re-submit
      const revRes = await apiJson(baseUrl, `/api/academic/assignments/${assignmentId}/evaluate`, {
        method: 'POST',
        headers: teacherHeaders,
        body: JSON.stringify({
          studentId: 'stu-solara-1',
          feedback: 'Please attach uncertainty table.',
          action: 'return_for_revision'
        })
      });
      assert.equal(revRes.status, 200);
      assert.equal(revRes.data.submission.status, 'returned_for_revision');

      const reSub = await apiJson(baseUrl, `/api/academic/assignments/${assignmentId}/submit`, {
        method: 'POST',
        headers: studentSolaraHeaders,
        body: JSON.stringify({ submissionText: 'Added uncertainty table in Appendix B.' })
      });
      assert.equal(reSub.status, 200);
      assert.equal(reSub.data.submission.status, 'submitted');
    });

    // =========================================================================
    // SCENARIO B: Assessments & Results Publication Gating + Student Isolation
    // =========================================================================
    let assessmentId = '';

    await runAsyncTest('Scenario B: Draft hiding, resultsPublished gating, and per-student grade isolation', async () => {
      const createAss = await apiJson(baseUrl, '/api/academic/assessments', {
        method: 'POST',
        headers: teacherHeaders,
        body: JSON.stringify({
          title: 'Midterm Mechanics Exam',
          subject: 'Physics',
          classGrade: 'Grade 10',
          classSection: 'Solara',
          period: 'Midterm',
          type: 'Midterm',
          maxScore: 100,
          date: new Date(Date.now() + 86400000 * 6).toISOString().split('T')[0],
          syllabusCoverage: 'Chapters 1-4: Vectors, Kinematics, Newton Laws',
          status: 'draft',
          resultsPublished: false
        })
      });
      assert.equal(createAss.status, 201);
      assessmentId = createAss.data.assessment.id;

      // Draft excluded from student assessments
      const stuAss1 = await apiJson(baseUrl, '/api/academic/assessments', { headers: studentSolaraHeaders });
      assert.equal(stuAss1.data.assessments.some((a: any) => a.id === assessmentId), false);

      // Publish assessment (resultsPublished still false)
      const pubAss = await apiJson(baseUrl, `/api/academic/assessments/${assessmentId}`, {
        method: 'PATCH',
        headers: teacherHeaders,
        body: JSON.stringify({ status: 'published', resultsPublished: false })
      });
      assert.equal(pubAss.status, 200);

      const stuAss2 = await apiJson(baseUrl, '/api/academic/assessments', { headers: studentSolaraHeaders });
      assert.equal(stuAss2.data.assessments.some((a: any) => a.id === assessmentId), true);

      // Save marks for two students
      const saveMarks = await apiJson(baseUrl, `/api/academic/assessments/${assessmentId}/entries`, {
        method: 'POST',
        headers: teacherHeaders,
        body: JSON.stringify({
          maxScore: 100,
          entries: [
            { studentId: 'stu-solara-1', studentName: 'Aarav Patel', subject: 'Physics', score: 88 },
            { studentId: 'stu-solara-2', studentName: 'Diya Sharma', subject: 'Physics', score: 94 }
          ]
        })
      });
      assert.equal(saveMarks.status, 200);

      // While resultsPublished is false, student sees zero released marks
      const hiddenGrades = await apiJson(baseUrl, '/api/academic/gradebook-entries', { headers: studentSolaraHeaders });
      assert.equal(hiddenGrades.data.entries.some((e: any) => e.assessmentId === assessmentId), false);

      // Publish results -> student1 sees ONLY their own mark
      const relRes = await apiJson(baseUrl, `/api/academic/assessments/${assessmentId}`, {
        method: 'PATCH',
        headers: teacherHeaders,
        body: JSON.stringify({ resultsPublished: true })
      });
      assert.equal(relRes.status, 200);

      const visibleGrades = await apiJson(baseUrl, '/api/academic/gradebook-entries', { headers: studentSolaraHeaders });
      const matchingEntries = visibleGrades.data.entries.filter((e: any) => e.assessmentId === assessmentId);
      assert.equal(matchingEntries.length, 1);
      assert.equal(matchingEntries[0].studentId, 'stu-solara-1');
      assert.equal(matchingEntries[0].score, 88);
    });

    // =========================================================================
    // SCENARIO C: Controlled Attendance Submission + Audit History
    // =========================================================================
    await runAsyncTest('Scenario C: Student write blocked (403), out-of-scope blocked (403), and overwrite creates audit log', async () => {
      const todayStr = new Date().toISOString().split('T')[0];

      // Student cannot modify attendance
      const stuAtt = await apiJson(baseUrl, '/api/academic/attendance/record', {
        method: 'POST',
        headers: studentSolaraHeaders,
        body: JSON.stringify({
          studentId: 'stu-solara-1',
          date: todayStr,
          status: 'present',
          grade: 'Grade 10',
          section: 'Solara'
        })
      });
      assert.equal(stuAtt.status, 403);

      // Out-of-scope teacher cannot mark Grade 10 Solara student
      const outAtt = await apiJson(baseUrl, '/api/academic/attendance/record', {
        method: 'POST',
        headers: outOfScopeTeacherHeaders,
        body: JSON.stringify({
          studentId: 'stu-solara-1',
          date: todayStr,
          status: 'present',
          grade: 'Grade 10',
          section: 'Solara'
        })
      });
      assert.equal(outAtt.status, 403);

      // Authorized teacher marks present
      const mark1 = await apiJson(baseUrl, '/api/academic/attendance/record', {
        method: 'POST',
        headers: teacherHeaders,
        body: JSON.stringify({
          studentId: 'stu-solara-1',
          studentName: 'Aarav Patel',
          date: todayStr,
          status: 'present',
          grade: 'Grade 10',
          section: 'Solara',
          subject: 'Physics'
        })
      });
      assert.equal(mark1.status, 200);

      // Overwrite present -> absent creates audit trail record
      const mark2 = await apiJson(baseUrl, '/api/academic/attendance/record', {
        method: 'POST',
        headers: teacherHeaders,
        body: JSON.stringify({
          studentId: 'stu-solara-1',
          studentName: 'Aarav Patel',
          date: todayStr,
          status: 'absent',
          grade: 'Grade 10',
          section: 'Solara',
          subject: 'Physics',
          reason: 'Attended medical checkup'
        })
      });
      assert.equal(mark2.status, 200);
      assert.ok(mark2.data.auditEntry);
      assert.equal(mark2.data.auditEntry.previousStatus, 'present');
      assert.equal(mark2.data.auditEntry.newStatus, 'absent');
      assert.equal(mark2.data.auditEntry.reason, 'Attended medical checkup');

      const historyRes = await apiJson(baseUrl, '/api/academic/attendance/history', { headers: teacherHeaders });
      assert.equal(historyRes.status, 200);
      assert.ok(
        historyRes.data.auditLogs.some(
          (l: any) => l.studentId === 'stu-solara-1' && l.previousStatus === 'present' && l.newStatus === 'absent'
        )
      );
    });

    // =========================================================================
    // SCENARIO D: Targeted Announcements & Per-User Read Tracking
    // =========================================================================
    await runAsyncTest('Scenario D: Cohort-targeted circulars visibility, read tracking, and draft/archive hiding', async () => {
      const pubCircular = await apiJson(baseUrl, '/api/academic/announcements', {
        method: 'POST',
        headers: teacherHeaders,
        body: JSON.stringify({
          title: 'Solara Physics Lab Rescheduled',
          content: 'Lab moves to Room 204 tomorrow.',
          targetGrade: 'Grade 10',
          targetSection: 'Solara',
          targetSubject: 'Physics',
          targetRole: 'student',
          status: 'published'
        })
      });
      assert.equal(pubCircular.status, 201);
      const circId = pubCircular.data.announcement.id;

      const draftCircular = await apiJson(baseUrl, '/api/academic/announcements', {
        method: 'POST',
        headers: teacherHeaders,
        body: JSON.stringify({
          title: 'Internal Draft Circular',
          content: 'Not ready for students.',
          targetGrade: 'Grade 10',
          targetSection: 'Solara',
          targetRole: 'student',
          status: 'draft'
        })
      });
      assert.equal(draftCircular.status, 201);
      const draftId = draftCircular.data.announcement.id;

      // Solara student sees published circular (unread) and never sees draft
      const solaraAnns1 = await apiJson(baseUrl, '/api/academic/announcements', { headers: studentSolaraHeaders });
      const foundSolara = solaraAnns1.data.announcements.find((a: any) => a.id === circId);
      assert.ok(foundSolara);
      assert.equal(foundSolara.isRead, false);
      assert.equal(solaraAnns1.data.announcements.some((a: any) => a.id === draftId), false);

      // Astra student (Grade 11) sees neither
      const astraAnns = await apiJson(baseUrl, '/api/academic/announcements', { headers: studentAstraHeaders });
      assert.equal(astraAnns.data.announcements.some((a: any) => a.id === circId), false);

      // Solara student marks circular read (does not mark peer unread circular as read)
      const readRes = await apiJson(baseUrl, `/api/academic/announcements/${circId}/read`, {
        method: 'POST',
        headers: studentSolaraHeaders
      });
      assert.equal(readRes.status, 200);

      const solaraAnns2 = await apiJson(baseUrl, '/api/academic/announcements', { headers: studentSolaraHeaders });
      assert.equal(solaraAnns2.data.announcements.find((a: any) => a.id === circId)?.isRead, true);

      const peerAnns = await apiJson(baseUrl, '/api/academic/announcements', { headers: studentSolaraPeerHeaders });
      assert.equal(peerAnns.data.announcements.find((a: any) => a.id === circId)?.isRead, false);

      // Archiving hides announcement from students
      await apiJson(baseUrl, `/api/academic/announcements/${circId}`, {
        method: 'PATCH',
        headers: teacherHeaders,
        body: JSON.stringify({ status: 'archived' })
      });
      const solaraAnns3 = await apiJson(baseUrl, '/api/academic/announcements', { headers: studentSolaraHeaders });
      assert.equal(solaraAnns3.data.announcements.some((a: any) => a.id === circId), false);
    });

    // =========================================================================
    // SCENARIO E: Orion Role Guard, WebSocket Cohort Scoping & AI Provider Lock
    // =========================================================================
    await runAsyncTest('Scenario E: Orion faculty intents blocked for students (403), WS scoping & AI provider lock verified', async () => {
      const orionForbidden = await apiJson(baseUrl, '/api/ai/orion-assist', {
        method: 'POST',
        headers: studentSolaraHeaders,
        body: JSON.stringify({
          intent: 'draft_assessment_outline',
          userRole: 'student',
          subject: 'Physics',
          topic: 'Draft midterm paper'
        })
      });
      assert.equal(orionForbidden.status, 403);

      // Sensitive user-targeted WS event must never leak to peer student
      assert.equal(
        isWsClientEligibleForAcademicEvent(
          { role: 'student', userId: 'stu-solara-2', grade: 'Grade 10', section: 'Solara' },
          { sensitive: true, targetUserId: 'stu-solara-1', targetGrade: 'Grade 10', targetSection: 'Solara' }
        ),
        false
      );
      assert.equal(
        isWsClientEligibleForAcademicEvent(
          { role: 'student', userId: 'stu-solara-1', grade: 'Grade 10', section: 'Solara' },
          { sensitive: true, targetUserId: 'stu-solara-1', targetGrade: 'Grade 10', targetSection: 'Solara' }
        ),
        true
      );
      // Cohort WS event must not leak to unrelated grade/section
      assert.equal(
        isWsClientEligibleForAcademicEvent(
          { role: 'student', userId: 'stu-astra-3', grade: 'Grade 11', section: 'Astra' },
          { targetRole: 'student', targetGrade: 'Grade 10', targetSection: 'Solara' }
        ),
        false
      );

      // AI lock: only APInex, Ministral, Groq; zero @google/genai
      const aiClientSource = fs.readFileSync(path.resolve(process.cwd(), 'server/aiClient.ts'), 'utf8');
      assert.equal(aiClientSource.includes('@google/genai'), false);
      assert.equal(aiClientSource.includes("'apinex'") && aiClientSource.includes("'ministral'") && aiClientSource.includes("'groq'"), true);
    });

    // =========================================================================
    // SCENARIO F: Invalid Token Rejection, Notification Eligibility & Deterministic Byte
    // =========================================================================
    await runAsyncTest('Scenario F1: Invalid Bearer token returns 401 across protected academic routes', async () => {
      const badTokenRes = await apiJson(baseUrl, '/api/academic/assignments', {
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer invalid.jwt.signature.token'
        }
      });
      assert.equal(badTokenRes.status, 401);
    });

    await runAsyncTest('Scenario F2: Notification eligibility & Byte deterministic connected reminders', async () => {
      const solaraStudent: UserProfile = {
        uid: 'stu-solara-1',
        name: 'Aarav Patel',
        email: 'aarav@school.edu',
        role: 'student',
        grade: 'Grade 10',
        section: 'Solara',
        house: 'Ruby'
      };
      const astraStudent: UserProfile = {
        uid: 'stu-astra-3',
        name: 'Liam Chen',
        email: 'liam@school.edu',
        role: 'student',
        grade: 'Grade 11',
        section: 'Astra',
        house: 'Sapphire'
      };

      const scopedNotif = {
        id: 'n-1',
        userId: 'all',
        title: 'Solara Lab Update',
        message: 'Bring lab manual',
        type: 'announcement',
        targetRole: 'student',
        targetClass: 'Grade 10',
        targetSection: 'Solara',
        read: false,
        createdAt: new Date().toISOString()
      };

      assert.equal(isUserEligibleForNotification(scopedNotif, solaraStudent), true);
      assert.equal(isUserEligibleForNotification(scopedNotif, astraStudent), false);
      assert.equal(
        isUserEligibleForNotification(scopedNotif, { ...solaraStudent, grade: undefined, section: undefined }),
        false
      );

      const byteItems = buildByteReminders({
        currentUser: solaraStudent,
        effectiveRole: 'student',
        homeworkList: [
          {
            id: 'hw-eval-1',
            title: 'Kinematics Lab Report',
            subject: 'Physics',
            content: 'Analyze trajectories',
            dueDate: new Date(Date.now() + 86400000).toISOString().split('T')[0],
            classGrade: 'Grade 10',
            classSection: 'Solara',
            givenBy: 'Dr. Elena Rostova',
            createdAt: new Date().toISOString(),
            completedList: [],
            status: 'published',
            maxScore: 50
          }
        ],
        submissions: [
          {
            id: 'sub-1',
            assignmentId: 'hw-eval-1',
            studentId: 'stu-solara-1',
            studentName: 'Aarav Patel',
            status: 'evaluated',
            submissionText: 'Attached trajectory calculations.',
            isLate: false,
            score: 46,
            maxScore: 50,
            resultsReleased: true,
            feedback: 'Great job',
            submittedAt: new Date().toISOString()
          }
        ],
        assessments: [
          {
            id: 'ass-1',
            title: 'Midterm Mechanics Exam',
            classGrade: 'Grade 10',
            classSection: 'Solara',
            subject: 'Physics',
            period: 'Midterm',
            type: 'Midterm',
            maxScore: 100,
            date: new Date(Date.now() + 86400000 * 3).toISOString().split('T')[0],
            teacherId: 'fac-elena-1',
            status: 'published',
            resultsPublished: true
          }
        ],
        tasks: [],
        announcements: [
          {
            id: 'ann-1',
            title: 'Solara Physics Lab Rescheduled',
            content: 'Room 204 tomorrow',
            targetGrade: 'Grade 10',
            targetSection: 'Solara',
            targetRole: 'student',
            status: 'published',
            isRead: false
          }
        ],
        dueCardsCount: 0
      });

      assert.ok(byteItems.some(r => r.id.includes('eval-hw-eval-1')));
      assert.ok(byteItems.some(r => r.id.includes('ass-res-ass-1')));
      assert.ok(byteItems.some(r => r.id.includes('ass-upcoming-ass-1')));
      assert.ok(byteItems.some(r => r.id.includes('ann-ann-1')));
    });

    console.log(`\n🎉 Connected Academic Workflows 2.0 Test Summary: ${passed} Passed, 0 Failed.`);
  } finally {
    server.close();
  }
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error('❌ Connected Workflows test failure:', err);
    process.exit(1);
  });
