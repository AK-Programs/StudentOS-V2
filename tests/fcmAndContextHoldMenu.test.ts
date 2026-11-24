import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import http from 'node:http';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import vm from 'node:vm';
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
  shouldBlockPostHoldInteraction,
  isTouchTriggeredContextMenu,
} from '../src/lib/useContextHoldMenu';
import {
  setupFCMForegroundListener,
  hasPushTagRecentlyHandled,
  buildForegroundPushDetail,
} from '../src/lib/fcmNotifications';
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

  // Test 5: Shared context menu viewport clamping, scroll/target helpers, and post-hold finger-lift guard
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

    // Post-hold finger-lift synthetic-click guard:
    assert.equal(shouldBlockPostHoldInteraction(true, 0, 1000), true);
    assert.equal(shouldBlockPostHoldInteraction(false, 1500, 1200), true);
    assert.equal(shouldBlockPostHoldInteraction(false, 1500, 1501), false);

    // Touch-triggered onContextMenu (Android Chrome emitting contextmenu before JS holdDelayMs):
    assert.equal(
      isTouchTriggeredContextMenu({ sourceCapabilities: { firesTouchEvents: true } }, null, 't1', 0, 1000),
      true
    );
    assert.equal(
      isTouchTriggeredContextMenu({ pointerType: 'mouse' }, 't1', 't1', 700, 1000),
      true
    );
    assert.equal(
      isTouchTriggeredContextMenu({ pointerType: 'mouse' }, 'other', 't1', 700, 1000),
      false
    );
    console.log('PASS: Test 5 - Shared context-menu clamping, scroll threshold, and finger-lift synthetic-click guards work');
    passed++;
  }

  // Test 6: LectureNotesSidebar renders .veylentra-context-target, active highlight, and decouples Starred from Pinned
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
            isStarred: false,
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
            isStarred: false,
          },
        ],
        selectedNoteId: 'n1',
        activeMenuNoteId: 'n1',
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
    assert.ok(html.includes('veylentra-context-active'));
    assert.ok(html.includes('data-context-active="true"'));
    assert.ok(html.includes('Pinned Physics Derivation'));
    // A pinned note with isStarred: false must NOT render Starred filter count >= 1 or star badge text
    const sidebarSource = fs.readFileSync(path.join(process.cwd(), 'src/components/lectureNotes/LectureNotesSidebar.tsx'), 'utf8');
    assert.ok(sidebarSource.includes('const isStarred = Boolean(note.isStarred);'));
    assert.ok(!sidebarSource.includes('Boolean(note.isStarred || isPinned)'));
    console.log('PASS: Test 6 - LectureNotesSidebar renders scoped context-target, active highlight, and decouples Starred from Pinned');
    passed++;
  }

  // Test 7: Global text selection, contextual menu wiring, restrictive SQL RLS, and notification click nav preserved
  {
    const indexCss = fs.readFileSync(path.join(process.cwd(), 'src/index.css'), 'utf8');
    assert.ok(indexCss.includes('.veylentra-context-target'));
    assert.ok(indexCss.includes('.veylentra-context-holding'));
    assert.ok(indexCss.includes('.veylentra-context-active'));
    assert.ok(!/body\s*\{[^}]*user-select\s*:\s*none/i.test(indexCss));

    const swJs = fs.readFileSync(path.join(process.cwd(), 'public/sw.js'), 'utf8');
    assert.ok(swJs.includes("self.addEventListener('notificationclick'"));
    assert.ok(swJs.includes('STUDENTOS_NAVIGATE_TAB'));

    const appTsx = fs.readFileSync(path.join(process.cwd(), 'src/App.tsx'), 'utf8');
    assert.ok(appTsx.includes('byteThreadContext.getItemBindProps'));
    assert.ok(appTsx.includes('byteThreadContext.shouldSuppressClick'));
    assert.ok(appTsx.includes('byteThreadContext.isInteractionGuarded'));
    assert.ok(appTsx.includes('studentos-fcm-foreground-message'));
    assert.ok(appTsx.includes('NativeContextMenu'));
    assert.ok(appTsx.includes('vaultNotesRef'));
    assert.ok(!appTsx.includes('holdTimerRef.current = setTimeout'));

    const notesWs = fs.readFileSync(path.join(process.cwd(), 'src/components/lectureNotes/LectureNotesWorkspace.tsx'), 'utf8');
    assert.ok(notesWs.includes('noteHoldGuardRef'));
    assert.ok(notesWs.includes('NativeContextMenu'));
    assert.ok(notesWs.includes('activeMenuNoteId={noteContextMenu?.noteId || null}'));

    for (const sqlRelPath of ['supabase-complete-schema.sql', 'supabase/setup.sql']) {
      const sql = fs.readFileSync(path.join(process.cwd(), sqlRelPath), 'utf8');
      assert.ok(sql.includes('CREATE TABLE IF NOT EXISTS public.push_subscriptions') || sql.includes('create table if not exists public.push_subscriptions'));
      assert.ok(sql.includes('auth.uid() IS NOT NULL AND auth.uid()::text = user_id'));
      assert.ok(!sql.includes('CREATE POLICY "push rw"'));
    }

    console.log('PASS: Test 7 - Scoped CSS, Byte/Notes NativeContextMenu & active highlights, SW navigation, and RLS SQL verified');
    passed++;
  }

  // Test 8: Service Worker push + fallback showNotification + postMessage + notificationclick navigation runtime check
  {
    const swCode = fs.readFileSync(path.join(process.cwd(), 'public/sw.js'), 'utf8');
    const listeners = new Map<string, (ev: any) => void>();
    const shownNotifications: Array<{ title: string; opts: any }> = [];
    const clientMessages: any[] = [];
    const openedUrls: string[] = [];
    let failRichShowNotificationOnce = true;

    const fakeClient = {
      url: 'https://veylentra-web.vercel.app/',
      focused: true,
      visibilityState: 'visible',
      postMessage: (msg: any) => clientMessages.push(msg),
      focus: async () => fakeClient,
    };

    const swGlobal: any = {
      location: { origin: 'https://veylentra-web.vercel.app' },
      URL,
      URLSearchParams,
      Date,
      console: { log: () => {}, warn: () => {} },
      addEventListener: (name: string, fn: (ev: any) => void) => listeners.set(name, fn),
      skipWaiting: () => {},
      registration: {
        showNotification: async (title: string, opts: any) => {
          if (failRichShowNotificationOnce && opts?.actions) {
            failRichShowNotificationOnce = false;
            throw new Error('Actions unsupported in simulated environment');
          }
          shownNotifications.push({ title, opts });
        },
      },
      clients: {
        claim: async () => {},
        matchAll: async () => [fakeClient],
        openWindow: async (u: string) => {
          openedUrls.push(u);
          return null;
        },
      },
      caches: {
        keys: async () => [],
        match: async () => null,
        delete: async () => true,
      },
      fetch: async () => ({ ok: true }),
    };
    swGlobal.self = swGlobal;

    vm.runInNewContext(swCode, swGlobal);
    const pushHandler = listeners.get('push');
    const clickHandler = listeners.get('notificationclick');
    assert.ok(pushHandler && clickHandler, 'Service Worker must register push and notificationclick listeners');

    let waitPromise: Promise<any> = Promise.resolve();
    pushHandler!({
      data: {
        json: () => ({
          notification: { title: 'Exam Schedule Posted', body: 'Finals start Monday' },
          linkTab: 'calendar',
          notifId: 'exam_99',
          fcmOptions: { link: '/?tab=calendar&notifId=exam_99' },
        }),
      },
      waitUntil: (p: Promise<any>) => {
        waitPromise = p;
      },
    });
    await waitPromise;

    assert.equal(shownNotifications.length, 1, 'SW must fall back cleanly if rich options fail and still display OS notification');
    assert.equal(shownNotifications[0].title, 'Exam Schedule Posted');
    assert.equal(shownNotifications[0].opts.data.linkTab, 'calendar');
    assert.equal(shownNotifications[0].opts.data.notifId, 'exam_99');

    assert.equal(clientMessages.length, 1);
    assert.equal(clientMessages[0].type, 'FCM_SW_NOTIFICATION_DISPLAYED');
    assert.equal(clientMessages[0].linkTab, 'calendar');
    assert.equal(clientMessages[0].notifId, 'exam_99');

    // Now simulate notification click in background/open window
    let clickWait: Promise<any> = Promise.resolve();
    let notificationClosed = false;
    clickHandler!({
      action: 'open',
      notification: {
        data: shownNotifications[0].opts.data,
        close: () => {
          notificationClosed = true;
        },
      },
      waitUntil: (p: Promise<any>) => {
        clickWait = p;
      },
    });
    await clickWait;
    assert.equal(notificationClosed, true);
    const navMsg = clientMessages.find((m) => m.type === 'STUDENTOS_NAVIGATE_TAB');
    assert.ok(navMsg, 'Notification click must post STUDENTOS_NAVIGATE_TAB to active client');
    assert.equal(navMsg.tab, 'calendar');
    assert.equal(navMsg.notifId, 'exam_99');
    console.log('PASS: Test 8 - SW runtime push payload normalization, fallback showNotification, foreground bridge & click nav verified');
    passed++;
  }

  // Test 9: Foreground SW -> Window bridge emits studentos-fcm-foreground-message and prevents duplicate OS toast
  {
    const detail = buildForegroundPushDetail({
      title: 'Live Broadcast',
      body: 'Assembly in 5 minutes',
      linkTab: 'notice_viewer',
      notifId: 'fg_test_1',
    });
    assert.equal(detail.tag, 'studentos-notif-fg_test_1');

    const prevWin = (globalThis as any).window;
    const prevNavDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
    const swListeners = new Map<string, (ev: any) => void>();
    const dispatchedWinEvents: any[] = [];
    const callbackPayloads: any[] = [];

    const mockWin: any = {
      dispatchEvent: (ev: any) => dispatchedWinEvents.push(ev),
      addEventListener: () => {},
      removeEventListener: () => {},
      CustomEvent: class MockCustomEvent {
        type: string;
        detail: any;
        constructor(type: string, init?: any) {
          this.type = type;
          this.detail = init?.detail;
        }
      },
    };
    (globalThis as any).CustomEvent = mockWin.CustomEvent;
    (globalThis as any).window = mockWin;
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      writable: true,
      value: {
        userAgent: 'TestBrowser',
        serviceWorker: {
          addEventListener: (name: string, fn: (ev: any) => void) => swListeners.set(name, fn),
          removeEventListener: () => {},
        },
      },
    });

    try {
      const cleanup = await setupFCMForegroundListener((p) => callbackPayloads.push(p));
      const msgHandler = swListeners.get('message');
      assert.ok(msgHandler, 'setupFCMForegroundListener must bind serviceWorker message handler');

      msgHandler!({
        data: {
          type: 'FCM_SW_NOTIFICATION_DISPLAYED',
          title: 'Live Broadcast',
          body: 'Assembly in 5 minutes',
          linkTab: 'notice_viewer',
          notifId: 'fg_test_1',
          tag: 'studentos-notif-fg_test_1',
        },
      });

      assert.equal(callbackPayloads.length, 1);
      assert.equal(callbackPayloads[0].title, 'Live Broadcast');
      assert.equal(dispatchedWinEvents.length, 1);
      assert.equal(dispatchedWinEvents[0].type, 'studentos-fcm-foreground-message');
      assert.equal(hasPushTagRecentlyHandled('studentos-notif-fg_test_1'), true);
      if (cleanup) cleanup();
      console.log('PASS: Test 9 - Foreground SW message bridge triggers in-app event + deduplication cleanly');
      passed++;
    } finally {
      (globalThis as any).window = prevWin;
      if (prevNavDescriptor) {
        Object.defineProperty(globalThis, 'navigator', prevNavDescriptor);
      }
    }
  }

  console.log(`\nALL ${passed} TESTS PASSED!`);
  process.exit(0);
}

runTests().catch((err) => {
  console.error('TEST FAILURE:', err);
  process.exit(1);
});
