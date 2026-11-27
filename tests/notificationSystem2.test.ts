/**
 * @file tests/notificationSystem2.test.ts
 * Automated Verification Suite for Veylentra Notification & Broadcast Lifecycle (System 2.0)
 * Covers all 13 Phase 8 notification scenarios + live Express endpoints.
 */

import assert from 'node:assert/strict';
import http from 'node:http';
import { app } from '../server';
import {
  isNotificationEligibleForUser,
  selectFlyoutCandidates,
  isNotificationExpiredOrArchived,
  buildNotificationDedupeKey,
  __resetNotificationEngineMemoryForTests,
} from '../server/notificationEngine';
import {
  isUserEligibleForNotification,
  isNotificationPopupEligible,
} from '../src/lib/notifications';
import { createSignedSessionToken } from '../server/sessionAuth';

function bearerHeaders(claims: Parameters<typeof createSignedSessionToken>[0]) {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${createSignedSessionToken(claims).token}`,
  };
}

const adminAuth = bearerHeaders({ uid: 'admin_test_1', role: 'admin', name: 'Campus Admin', sessionType: 'login' });
const stu1Auth = bearerHeaders({ uid: 'stu_test_1', role: 'student', name: 'Student One', sessionType: 'login' });
const stu2Auth = bearerHeaders({ uid: 'stu_test_2', role: 'student', name: 'Student Two', sessionType: 'login' });
const stuG10Auth = bearerHeaders({ uid: 'stu_g10_a', name: 'Student G10', role: 'student', grade: 'Grade 10', section: 'A', sessionType: 'login' });
const stuG9Auth = bearerHeaders({ uid: 'stu_g9_b', name: 'Student G9', role: 'student', grade: 'Grade 9', section: 'B', sessionType: 'login' });
const teacher1Auth = bearerHeaders({ uid: 'teacher_1', name: 'Teacher One', role: 'teacher', sessionType: 'login' });
const stuHackerAuth = bearerHeaders({ uid: 'stu_hacker', name: 'Student Hacker', role: 'student', sessionType: 'login' });

async function main() {
  let passed = 0;
  const run = async (name: string, fn: () => Promise<void> | void) => {
    await fn();
    console.log(`✅ ${name}`);
    passed++;
  };

  __resetNotificationEngineMemoryForTests();

  const server: http.Server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  const addr = server.address() as any;
  const baseUrl = `http://127.0.0.1:${addr.port}`;

  try {
    // 1. Fresh new broadcast -> eligible & popup candidate once
    await run('1. Fresh broadcast is eligible and surfaces once in flyoutCandidates', async () => {
      const res = await fetch(`${baseUrl}/api/notifications/broadcast`, {
        method: 'POST',
        headers: adminAuth,
        body: JSON.stringify({
          id: 'notif_fresh_1',
          title: 'Campus Assembly Notice',
          message: 'Auditorium assembly starts at 10 AM.',
          type: 'broadcast',
          priority: 'high',
          targetRole: 'all',
          ttlHours: 48,
          dedupeKey: 'assembly_notice_today',
        }),
      });
      assert.equal(res.status, 200);
      const created = await res.json();
      assert.equal(created.success, true);
      assert.equal(created.deduplicated, false);

      const listRes = await fetch(`${baseUrl}/api/notifications/list`, {
        headers: stu1Auth,
      });
      assert.equal(listRes.status, 200);
      const listBody = await listRes.json();
      assert.equal(listBody.notifications.length, 1);
      assert.equal(listBody.flyoutCandidates.length, 1);
      assert.equal(listBody.flyoutCandidates[0].id, 'notif_fresh_1');
      assert.equal(listBody.unreadCount, 1);
    });

    // 2. React remount / repeated application reload -> popup_presented blocks replay
    await run('2 & 10 & 12. Marking popup_presented stops broadcast replay across reloads and remounts', async () => {
      const markRes = await fetch(`${baseUrl}/api/notifications/state`, {
        method: 'POST',
        headers: stu1Auth,
        body: JSON.stringify({
          notificationIds: ['notif_fresh_1'],
          action: 'popup_presented',
        }),
      });
      assert.equal(markRes.status, 200);

      // Simulate reload 1 & reload 2
      for (let i = 0; i < 2; i++) {
        const listRes = await fetch(`${baseUrl}/api/notifications/list`, {
          headers: stu1Auth,
        });
        const listBody = await listRes.json();
        assert.equal(listBody.notifications.length, 1);
        assert.equal(listBody.flyoutCandidates.length, 0, 'Already-presented broadcast must not re-pop');
      }
    });

    // 3. Already-read broadcast -> stays read & non-popup
    await run('3. Already-read broadcast stays excluded from unreadCount and flyoutCandidates', async () => {
      await fetch(`${baseUrl}/api/notifications/state`, {
        method: 'POST',
        headers: stu1Auth,
        body: JSON.stringify({
          notificationIds: ['notif_fresh_1'],
          action: 'read',
        }),
      });
      const listRes = await fetch(`${baseUrl}/api/notifications/list`, {
        headers: stu1Auth,
      });
      const listBody = await listRes.json();
      assert.equal(listBody.unreadCount, 0);
      assert.equal(listBody.notifications[0].isRead, true);
      assert.equal(listBody.flyoutCandidates.length, 0);
    });

    // 4 & 11. Dismissed broadcast + account switching isolation
    await run('4 & 11. Dismissed broadcast stays hidden for User A while remaining visible to User B', async () => {
      await fetch(`${baseUrl}/api/notifications/state`, {
        method: 'POST',
        headers: stu1Auth,
        body: JSON.stringify({
          notificationIds: ['notif_fresh_1'],
          action: 'dismissed',
        }),
      });

      const resA = await fetch(`${baseUrl}/api/notifications/list`, {
        headers: stu1Auth,
      });
      const bodyA = await resA.json();
      assert.equal(bodyA.notifications.length, 0);

      // Account switch to stu_test_2 (independent per-user state)
      const resB = await fetch(`${baseUrl}/api/notifications/list`, {
        headers: stu2Auth,
      });
      const bodyB = await resB.json();
      assert.equal(bodyB.notifications.length, 1);
      assert.equal(bodyB.unreadCount, 1);
    });

    // 5. Expired and archived broadcasts excluded
    await run('5. Expired and archived notifications are strictly excluded on client & server', () => {
      const nowMs = Date.UTC(2026, 10, 19, 12, 0, 0);
      const expired = {
        id: 'exp_1',
        title: 'Expired Notice',
        type: 'broadcast',
        priority: 'urgent' as const,
        targetRole: 'all',
        targetRoles: ['all'],
        expiresAt: new Date(nowMs - 1000).toISOString(),
        createdAt: new Date(nowMs - 3600000).toISOString(),
      };
      const archived = {
        ...expired,
        id: 'arch_1',
        expiresAt: new Date(nowMs + 3600000).toISOString(),
        archivedAt: new Date(nowMs - 1000).toISOString(),
      };
      assert.equal(isNotificationExpiredOrArchived(expired, nowMs).isExpired, true);
      assert.equal(isNotificationEligibleForUser(expired, { id: 'u1', role: 'student' }, nowMs), false);
      assert.equal(isUserEligibleForNotification(expired, { uid: 'u1', role: 'student' }, nowMs), false);
      assert.equal(isNotificationEligibleForUser(archived, { id: 'u1', role: 'student' }, nowMs), false);
      assert.equal(isUserEligibleForNotification(archived, { uid: 'u1', role: 'student' }, nowMs), false);
    });

    // 6. Target role & cohort isolation
    await run('6. Broadcasts targeted to a specific role/grade/section do not leak to other users', async () => {
      await fetch(`${baseUrl}/api/notifications/broadcast`, {
        method: 'POST',
        headers: adminAuth,
        body: JSON.stringify({
          id: 'notif_grade10_only',
          title: 'Grade 10 Physics Lab',
          message: 'Bring lab coats for Section A.',
          type: 'broadcast',
          priority: 'high',
          targetRole: 'student',
          targetGrade: '10',
          targetSection: 'A',
        }),
      });

      const matchRes = await fetch(`${baseUrl}/api/notifications/list`, {
        headers: stuG10Auth,
      });
      const matchBody = await matchRes.json();
      assert.ok(matchBody.notifications.some((n: any) => n.id === 'notif_grade10_only'));

      const mismatchRes = await fetch(`${baseUrl}/api/notifications/list`, {
        headers: stuG9Auth,
      });
      const mismatchBody = await mismatchRes.json();
      assert.equal(mismatchBody.notifications.some((n: any) => n.id === 'notif_grade10_only'), false);

      // Teacher must not see student-targeted broadcast
      const teacherRes = await fetch(`${baseUrl}/api/notifications/list`, {
        headers: teacher1Auth,
      });
      const teacherBody = await teacherRes.json();
      assert.equal(teacherBody.notifications.some((n: any) => n.id === 'notif_grade10_only'), false);
    });

    // 7 & 8. Student flashcard/study reminders MUST NEVER reach Teacher, Coordinator, Admin, Super Admin, Parent
    await run('7 & 8. Student flashcard & study reminders are strictly blocked for non-student roles', () => {
      const studentOnlyNotifs = [
        { id: 'fc1', type: 'flashcard', title: '5 Flashcards Due', targetRole: 'all' },
        { id: 'fc2', type: 'flashcard_due', title: 'Review Deck', targetRole: 'all' },
        { id: 'fc3', type: 'study_reminder', title: 'Exam Study Reminder', targetRole: 'all' },
        { id: 'fc4', type: 'homework_due', title: 'Math Homework Due', targetRole: 'all' },
        { id: 'fc5', type: 'reminder', title: 'Flashcard Sprint Ready', linkTab: 'flashcards', targetRole: 'all' },
      ];

      for (const n of studentOnlyNotifs) {
        assert.equal(isUserEligibleForNotification(n, { uid: 's1', role: 'student' }), true);
        for (const nonStudentRole of ['teacher', 'coordinator', 'admin', 'super_admin', 'parent']) {
          assert.equal(
            isUserEligibleForNotification(n, { uid: `u_${nonStudentRole}`, role: nonStudentRole }),
            false,
            `${n.type} leaked to ${nonStudentRole} on client check`
          );
          assert.equal(
            isNotificationEligibleForUser({ ...n, targetRoles: ['all'] }, { id: `u_${nonStudentRole}`, role: nonStudentRole }),
            false,
            `${n.type} leaked to ${nonStudentRole} on server check`
          );
        }
      }
    });

    // 9. Multiple realtime events with same dedupeKey are collapsed server-side
    await run('9. Identical realtime/broadcast events sharing a dedupeKey are deduplicated', async () => {
      const key = buildNotificationDedupeKey({
        type: 'broadcast',
        targetRole: 'all',
        referenceId: 'assembly',
        dateKey: '2026-11-19',
      });
      const r1 = await fetch(`${baseUrl}/api/notifications/broadcast`, {
        method: 'POST',
        headers: adminAuth,
        body: JSON.stringify({
          title: 'Dedupe Test',
          message: 'First trigger',
          dedupeKey: key,
        }),
      });
      const j1 = await r1.json();
      assert.equal(j1.deduplicated, false);

      const r2 = await fetch(`${baseUrl}/api/notifications/broadcast`, {
        method: 'POST',
        headers: adminAuth,
        body: JSON.stringify({
          title: 'Dedupe Test',
          message: 'Duplicate trigger',
          dedupeKey: key,
        }),
      });
      const j2 = await r2.json();
      assert.equal(j2.deduplicated, true);
      assert.equal(j2.notification.id, j1.notification.id);
    });

    // 10. Multiple simultaneous eligible notifications & historical threshold
    await run('13. selectFlyoutCandidates caps burst to maxVisible=1, ranks urgent first, and suppresses stale history', () => {
      const nowMs = Date.UTC(2026, 10, 19, 12, 0, 0);
      const candidates = [
        {
          id: 'stale_old',
          title: 'Old Broadcast',
          message: 'From last week',
          type: 'broadcast',
          priority: 'urgent' as const,
          targetRole: 'all',
          targetRoles: ['all'],
          createdAt: new Date(nowMs - 48 * 3600 * 1000).toISOString(),
          isRead: false,
          isDismissed: false,
          isExpired: false,
          isArchived: false,
          deliveredAt: null,
          popupPresentedAt: null,
          readAt: null,
          dismissedAt: null,
          acknowledgedAt: null,
          popupEligible: true,
        },
        {
          id: 'fresh_high',
          title: 'High Priority',
          message: 'New update',
          type: 'broadcast',
          priority: 'high' as const,
          targetRole: 'all',
          targetRoles: ['all'],
          createdAt: new Date(nowMs - 60000).toISOString(),
          isRead: false,
          isDismissed: false,
          isExpired: false,
          isArchived: false,
          deliveredAt: null,
          popupPresentedAt: null,
          readAt: null,
          dismissedAt: null,
          acknowledgedAt: null,
          popupEligible: true,
        },
        {
          id: 'fresh_urgent',
          title: 'Urgent Dispatch',
          message: 'Immediate action',
          type: 'urgent',
          priority: 'urgent' as const,
          targetRole: 'all',
          targetRoles: ['all'],
          createdAt: new Date(nowMs - 120000).toISOString(),
          isRead: false,
          isDismissed: false,
          isExpired: false,
          isArchived: false,
          deliveredAt: null,
          popupPresentedAt: null,
          readAt: null,
          dismissedAt: null,
          acknowledgedAt: null,
          popupEligible: true,
        },
      ];

      const selected = selectFlyoutCandidates(candidates, { nowMs, maxVisible: 1 });
      assert.equal(selected.length, 1);
      assert.equal(selected[0].id, 'fresh_urgent');

      // Client helper agrees old broadcast is not popup-eligible
      assert.equal(isNotificationPopupEligible(candidates[0], { uid: 's1', role: 'student' }, { nowMs }), false);
      assert.equal(isNotificationPopupEligible(candidates[2], { uid: 's1', role: 'student' }, { nowMs }), true);
    });

    // 14. Security: Student cannot send campus broadcast & unsigned request gets 401
    await run('14. Student role attempting POST /api/notifications/broadcast is rejected with 403 and unsigned with 401', async () => {
      const unauth = await fetch(`${baseUrl}/api/notifications/broadcast`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-veylentra-uid': 'admin_test_1', 'x-veylentra-role': 'admin' },
        body: JSON.stringify({ title: 'Fake Alert', message: 'Unsigned header' }),
      });
      assert.equal(unauth.status, 401);

      const res = await fetch(`${baseUrl}/api/notifications/broadcast`, {
        method: 'POST',
        headers: stuHackerAuth,
        body: JSON.stringify({ title: 'Fake Alert', message: 'No class today' }),
      });
      assert.equal(res.status, 403);
    });

    console.log(`\n🎉 Notification System 2.0 Verification Complete: ${passed}/${passed} checks passed.`);
  } finally {
    server.close();
  }
  process.exit(0);
}

main().catch((err) => {
  console.error('❌ Notification System 2.0 test failure:', err);
  process.exit(1);
});
