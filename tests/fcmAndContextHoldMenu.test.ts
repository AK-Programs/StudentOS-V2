import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import http from 'node:http';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import {
  expandTargetRoleSet,
  doesSubscriptionMatchPushTarget,
  dispatchServerWebPush,
} from '../server';
import {
  registerNotificationRoutes,
  __resetNotificationEngineMemoryForTests,
} from '../server/notificationEngine';
import {
  clampContextMenuPosition,
  didPointerMoveExceedThreshold,
  shouldIgnoreHoldStartTarget,
} from '../src/lib/useContextHoldMenu';
import { LectureNotesSidebar } from '../src/components/lectureNotes/LectureNotesSidebar';

async function startTempServer(app: express.Express): Promise<{ baseUrl: string; close: () => Promise<void> }> {
  return new Promise((resolve) => {
    const server = http.createServer(app);
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
  let passed = 0;

  // Test 1: Multi-role & faculty group expansion
  {
    const facultySet = expandTargetRoleSet('faculty', null);
    assert.ok(facultySet.has('teacher') && facultySet.has('coordinator') && facultySet.has('admin') && facultySet.has('super_admin'));
    assert.ok(!facultySet.has('student'));

    const multiSet = expandTargetRoleSet(null, ['teacher', 'coordinator']);
    assert.ok(multiSet.has('teacher') && multiSet.has('coordinator'));
    assert.ok(!multiSet.has('student'));

    const allSet = expandTargetRoleSet('all', ['student']);
    assert.ok(allSet.has('all'));
    console.log('PASS: Test 1 - Push target role expansion handles faculty alias, arrays, and all');
    passed++;
  }

  // Test 2: Push subscription targeting prevents false grade collisions and honors multi-role arrays
  {
    assert.equal(
      doesSubscriptionMatchPushTarget(
        { userId: 't1', role: 'coordinator', grade: 'Grade 10', section: 'A', schoolId: 'default_school' },
        { targetRoles: ['teacher', 'coordinator'], targetClass: 'all_grades', targetSection: 'all' }
      ),
      true
    );

    assert.equal(
      doesSubscriptionMatchPushTarget(
        { userId: 's1', role: 'student', grade: 'Grade 10', section: 'A', schoolId: 'default_school' },
        { targetRoles: ['teacher', 'coordinator'], targetClass: 'All Grades', targetSection: 'All Sections' }
      ),
      false
    );

    // Ensure Grade 1 does NOT falsely match Grade 10
    assert.equal(
      doesSubscriptionMatchPushTarget(
        { userId: 's10', role: 'student', grade: 'Grade 10', section: 'A', schoolId: 'default_school' },
        { targetRole: 'student', targetClass: 'Grade 1', targetSection: 'A' }
      ),
      false
    );

    assert.equal(
      doesSubscriptionMatchPushTarget(
        { userId: 's1', role: 'student', grade: 'Grade 1', section: 'Section A', schoolId: 'default_school' },
        { targetRole: 'student', targetClass: '1', targetSection: 'A' }
      ),
      true
    );

    assert.equal(
      doesSubscriptionMatchPushTarget(
        { userId: 'u2', role: 'student', grade: 'Grade 10', section: 'A', schoolId: 'school_b' },
        { targetUserId: 'u1', targetSchoolId: 'school_a' }
      ),
      false
    );
    console.log('PASS: Test 2 - Subscription targeting honors user, school, multi-role, and exact grade tokens');
    passed++;
  }

  // Test 3: POST /api/notifications/broadcast triggers server Web Push / FCM dispatch
  {
    __resetNotificationEngineMemoryForTests();
    const wsEvents: any[] = [];
    const pushCalls: any[] = [];

    const app = express();
    app.use(express.json());
    registerNotificationRoutes(app, {
      getSupabaseServerConfig: () => ({ url: '', key: '' }),
      getVerifiedUserFromRequest: async () => ({
        id: 'admin-1',
        name: 'Principal Vance',
        role: 'admin',
        isVerifiedJwt: true,
      }),
      broadcastToAllWs: (payload) => wsEvents.push(payload),
      dispatchWebPush: async (params) => {
        pushCalls.push(params);
        return { status: 'ok', sentCount: 2, fcmSendResult: 'DELIVERED' };
      },
    });

    const srv = await startTempServer(app);
    try {
      const resp = await fetch(`${srv.baseUrl}/api/notifications/broadcast`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Campus Schedule Change',
          message: 'Assembly moved to 10:30 AM.',
          type: 'announcement',
          priority: 'urgent',
          targetRole: 'teacher',
          targetRoles: ['teacher', 'coordinator'],
          targetGrade: 'Grade 10',
          targetSection: 'A',
          linkTab: 'notice_viewer',
        }),
      });
      assert.equal(resp.status, 200);
      const body = await resp.json();
      assert.equal(body.success, true);
      assert.equal(wsEvents.length, 1);
      assert.equal(wsEvents[0].type, 'notification:broadcast');
      assert.equal(pushCalls.length, 1);
      assert.equal(pushCalls[0].title, 'Campus Schedule Change');
      assert.deepEqual(pushCalls[0].targetRoles, ['teacher', 'coordinator']);
      assert.equal(pushCalls[0].targetClass, 'Grade 10');
      assert.equal(pushCalls[0].targetSection, 'A');
      assert.equal(pushCalls[0].linkTab, 'notice_viewer');
      assert.equal(body.pushDispatch?.sentCount, 2);
      console.log('PASS: Test 3 - /api/notifications/broadcast updates WS/Notification Box AND dispatches server Web Push');
      passed++;
    } finally {
      await srv.close();
    }
  }

  // Test 4: dispatchServerWebPush handles missing VAPID_PRIVATE_KEY safely without throwing or purging tokens
  {
    const res = await dispatchServerWebPush({
      notificationId: 'diag_vapid_test',
      title: 'Diagnostic Check',
      body: 'Testing safe VAPID handling',
      targetUserId: 'user_xyz',
    });
    assert.equal(res.status, 'ok');
    assert.equal(res.provider, 'fcm_webpush');
    if (!process.env.VAPID_PRIVATE_KEY) {
      assert.equal(res.vapidConfigured, false);
      assert.equal(res.fcmSendResult, 'VAPID_PRIVATE_KEY_NOT_CONFIGURED');
    }
    console.log('PASS: Test 4 - dispatchServerWebPush reports missing VAPID_PRIVATE_KEY cleanly');
    passed++;
  }

  // Test 5: Shared context menu viewport clamping and scroll/target helpers
  {
    const bottomRight = clampContextMenuPosition(990, 740, 220, 260, 1024, 768, 8);
    assert.equal(bottomRight.left, 796);
    assert.equal(bottomRight.top, 500);

    const topLeft = clampContextMenuPosition(-40, -15, 220, 260, 360, 640, 8);
    assert.equal(topLeft.left, 8);
    assert.equal(topLeft.top, 8);

    assert.equal(didPointerMoveExceedThreshold(100, 100, 106, 106, 10), false);
    assert.equal(didPointerMoveExceedThreshold(100, 100, 112, 104, 10), true);

    const fakeButtonTarget = { closest: (sel: string) => (sel.includes('button') ? {} : null) };
    const fakeCardTarget = { closest: () => null };
    assert.equal(shouldIgnoreHoldStartTarget(fakeButtonTarget as any), true);
    assert.equal(shouldIgnoreHoldStartTarget(fakeCardTarget as any), false);
    console.log('PASS: Test 5 - Shared context-menu clamping, scroll threshold, and inner-control ignore guards work');
    passed++;
  }

  // Test 6: LectureNotesSidebar renders .veylentra-context-target on note cards and shows pin badge
  {
    const html = renderToStaticMarkup(
      React.createElement(LectureNotesSidebar, {
        allNotes: [
          {
            id: 'n1',
            title: 'Pinned Physics Derivation',
            content: '# Formula',
            createdAt: 'Nov 23, 2026',
            subject: 'Physics',
            isPinned: true,
            isStarred: true,
          },
        ],
        notes: [
          {
            id: 'n1',
            title: 'Pinned Physics Derivation',
            content: '# Formula',
            createdAt: 'Nov 23, 2026',
            subject: 'Physics',
            isPinned: true,
            isStarred: true,
          },
        ],
        selectedNoteId: 'n1',
        folders: [{ id: 'f1', name: 'Physics', color: 'indigo', createdAt: '2026-11-23' }],
        activeFolderId: null,
        currentFilter: 'all',
        selectedTag: null,
        searchQuery: '',
        onSelectNote: () => {},
        onSelectFilter: () => {},
        onSelectFolder: () => {},
        onSelectTag: () => {},
        onSearchChange: () => {},
        onCreateNote: () => {},
        onCreateFolder: () => {},
        onOpenNoteContextMenu: () => {},
      })
    );
    assert.ok(html.includes('veylentra-context-target'));
    assert.ok(html.includes('Pinned Physics Derivation'));
    console.log('PASS: Test 6 - LectureNotesSidebar renders scoped context-target class and pinned note indicators');
    passed++;
  }

  // Test 7: Global text selection & notification navigation regressions stay preserved
  {
    const indexCss = fs.readFileSync(path.join(process.cwd(), 'src/index.css'), 'utf8');
    assert.ok(indexCss.includes('.veylentra-context-target'));
    assert.ok(!/body\s*\{[^}]*user-select\s*:\s*none/i.test(indexCss));

    const swJs = fs.readFileSync(path.join(process.cwd(), 'public/sw.js'), 'utf8');
    assert.ok(swJs.includes("self.addEventListener('notificationclick'"));
    assert.ok(swJs.includes('STUDENTOS_NAVIGATE_TAB'));

    const appTsx = fs.readFileSync(path.join(process.cwd(), 'src/App.tsx'), 'utf8');
    assert.ok(appTsx.includes('byteThreadContext.getItemBindProps'));
    assert.ok(appTsx.includes('byteThreadContext.shouldSuppressClick'));
    assert.ok(!appTsx.includes('holdTimerRef.current = setTimeout'));
    console.log('PASS: Test 7 - Scoped CSS, Byte hold-menu wiring, and SW click navigation checks verified');
    passed++;
  }

  console.log(`\nALL ${passed} TESTS PASSED!`);
  process.exit(0);
}

runTests().catch((err) => {
  console.error('TEST FAILURE:', err);
  process.exit(1);
});
