/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Veylentra — FCM Notification Click Navigation, Standalone PWA Text Selection & Top Bar Tests
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  buildNotificationUrl,
  consumePendingNotificationIntent,
  dispatchNotificationNavigation,
  parseNotificationIntentFromLocation,
  peekPendingNotificationIntent,
  persistPendingNotificationIntent,
  resolveNotificationDestination,
} from '../src/lib/notificationNavigation';
import { DashboardTopBar, getActiveTabTitle } from '../src/components/DashboardTopBar';
import { UserProfile } from '../src/types';

let passed = 0;
function runTest(name: string, fn: () => void) {
  fn();
  passed += 1;
  console.log(`✅ [PASS] ${name}`);
}

const studentUser: UserProfile = {
  uid: 'stu-nav-1',
  name: 'Rohan Mehta',
  email: 'rohan@veylentra.edu',
  role: 'student',
  house: 'Sapphire',
  grade: 'Grade 10',
  section: 'Astra',
  streakDays: 5,
  studyHours: 8,
};

const teacherUser: UserProfile = {
  uid: 'tch-nav-1',
  name: 'Prof. Ananya Iyer',
  email: 'ananya@veylentra.edu',
  role: 'teacher',
  house: 'Emerald',
  grade: 'Grade 10',
  section: 'Astra',
  streakDays: 14,
  studyHours: 22,
};

const adminUser: UserProfile = {
  uid: 'adm-nav-1',
  name: 'Principal Vikram Rao',
  email: 'principal@veylentra.edu',
  role: 'admin',
  house: 'Ruby',
  grade: 'All',
  section: 'Astra',
  streakDays: 20,
  studyHours: 35,
};

runTest('resolveNotificationDestination maps aliases, subTabs, and notification center targets accurately', () => {
  const hw = resolveNotificationDestination({ linkTab: 'homework', notifId: 'n-1' }, 'student');
  assert.equal(hw.tab, 'homework');
  assert.equal(hw.notifId, 'n-1');
  assert.equal(hw.usedFallback, false);

  const notifAlias = resolveNotificationDestination({ linkTab: 'notifications', notifId: 'n-2' }, 'student');
  assert.equal(notifAlias.tab, 'dashboard');
  assert.equal(notifAlias.openNotificationCenter, true);
  assert.equal(notifAlias.notifId, 'n-2');

  const attAlias = resolveNotificationDestination({ linkTab: 'attendance' }, 'teacher');
  assert.equal(attAlias.tab, 'attendance_manager');

  const marksAlias = resolveNotificationDestination({ linkTab: 'marks' }, 'student');
  assert.equal(marksAlias.tab, 'gradebook');

  const perfAlias = resolveNotificationDestination({ linkTab: 'performance' }, 'student');
  assert.equal(perfAlias.tab, 'analytics');

  const flashcardsAlias = resolveNotificationDestination({ linkTab: 'flashcards' }, 'student');
  assert.equal(flashcardsAlias.tab, 'study_hub');
  assert.equal(flashcardsAlias.subTab, 'flashcards');

  const tasksAlias = resolveNotificationDestination({ linkTab: 'tasks' }, 'student');
  assert.equal(tasksAlias.tab, 'study_hub');
  assert.equal(tasksAlias.subTab, 'tasks');

  const adminAlias = resolveNotificationDestination({ linkTab: 'admin-center' }, 'admin');
  assert.equal(adminAlias.tab, 'admin');

  const callIntent = resolveNotificationDestination({ type: 'call', callId: 'call_42' }, 'student');
  assert.equal(callIntent.tab, 'peer_chat');
  assert.equal(callIntent.callId, 'call_42');
});

runTest('resolveNotificationDestination enforces role permissions and safe fallbacks for invalid destinations', () => {
  const studentAdminAttempt = resolveNotificationDestination({ linkTab: 'admin', notifId: 'n-sec' }, 'student');
  assert.equal(studentAdminAttempt.tab, 'dashboard');
  assert.equal(studentAdminAttempt.openNotificationCenter, true);
  assert.equal(studentAdminAttempt.wasRestrictedForRole, true);

  const teacherAdminAttempt = resolveNotificationDestination({ linkTab: 'admin' }, 'teacher');
  assert.equal(teacherAdminAttempt.tab, 'dashboard');
  assert.equal(teacherAdminAttempt.wasRestrictedForRole, true);

  const parentNoticeAttempt = resolveNotificationDestination({ linkTab: 'homework' }, 'parent');
  assert.equal(parentNoticeAttempt.tab, 'parent_portal');
  assert.equal(parentNoticeAttempt.openNotificationCenter, true);
  assert.equal(parentNoticeAttempt.wasRestrictedForRole, true);

  const missingMeta = resolveNotificationDestination({}, 'student');
  assert.equal(missingMeta.tab, 'dashboard');
  assert.equal(missingMeta.openNotificationCenter, true);
  assert.equal(missingMeta.usedFallback, true);
});

runTest('parseNotificationIntentFromLocation & pending intent queue handle cold-start URLs and dedupe', () => {
  const parsed = parseNotificationIntentFromLocation('?tab=homework&notifId=abc-123&type=homework', '');
  assert.ok(parsed);
  assert.equal(parsed?.tab, 'homework');
  assert.equal(parsed?.notifId, 'abc-123');
  assert.equal(parsed?.type, 'homework');

  const hashParsed = parseNotificationIntentFromLocation('', '#/?tab=assignments&notifId=xyz-9');
  assert.ok(hashParsed);
  assert.equal(hashParsed?.tab, 'assignments');
  assert.equal(hashParsed?.notifId, 'xyz-9');

  const empty = parseNotificationIntentFromLocation('?foo=bar', '');
  assert.equal(empty, null);

  const urlBuilt = buildNotificationUrl('assignments', 'n-99', { callId: 'c-7' });
  assert.ok(urlBuilt.includes('tab=assignments'));
  assert.ok(urlBuilt.includes('notifId=n-99'));
  assert.ok(urlBuilt.includes('callId=c-7'));

  persistPendingNotificationIntent({ linkTab: 'gradebook', notifId: 'n-pending', source: 'sw', receivedAt: Date.now() });
  assert.equal(peekPendingNotificationIntent()?.notifId, 'n-pending');
  const consumed = consumePendingNotificationIntent();
  assert.equal(consumed?.linkTab, 'gradebook');
  assert.equal(peekPendingNotificationIntent(), null);

  const firstDispatch = dispatchNotificationNavigation({ linkTab: 'homework', notifId: 'dup-1', source: 'sw' });
  const duplicateDispatch = dispatchNotificationNavigation({ linkTab: 'homework', notifId: 'dup-1', source: 'sw' });
  assert.equal(firstDispatch, true);
  assert.equal(duplicateDispatch, false);
  consumePendingNotificationIntent();
});

runTest('Service workers preserve notifId/callId/tab deep links and handle notificationclick', () => {
  const swCode = fs.readFileSync(path.resolve('public/sw.js'), 'utf-8');
  assert.ok(swCode.includes('buildCanonicalNotificationUrl'));
  assert.ok(swCode.includes('parsed.data.callId || parsed.callId'));
  assert.ok(swCode.includes("self.addEventListener('notificationclick'"));
  assert.ok(swCode.includes('clients.openWindow(targetUrl)'));
  assert.ok(swCode.includes('STUDENTOS_NAVIGATE_TAB'));

  const fcmSwCode = fs.readFileSync(path.resolve('public/firebase-messaging-sw.js'), 'utf-8');
  assert.ok(fcmSwCode.includes("self.addEventListener('notificationclick'"));
  assert.ok(fcmSwCode.includes('notifId'));
  assert.ok(fcmSwCode.includes('STUDENTOS_NAVIGATE_TAB'));
});

runTest('Installed Chrome PWA (display-mode: standalone) allows normal text selection while keeping input & chat safeguards', () => {
  const cssCode = fs.readFileSync(path.resolve('src/index.css'), 'utf-8');
  const standaloneIdx = cssCode.indexOf('@media (display-mode: standalone)');
  assert.ok(standaloneIdx >= 0, 'Expected standalone display-mode media query');
  const standaloneBlock = cssCode.slice(standaloneIdx, standaloneIdx + 400);
  assert.equal(
    /body\s*\{[^}]*user-select\s*:\s*none/i.test(standaloneBlock),
    false,
    'Standalone PWA CSS must NOT disable body text selection'
  );
  assert.ok(standaloneBlock.includes('user-select: auto'));
  assert.ok(standaloneBlock.includes('user-select: text'));

  const chatCode = fs.readFileSync(path.resolve('src/components/ChatSystem.tsx'), 'utf-8');
  assert.ok(chatCode.includes('onContextMenu'));
});

runTest('DashboardTopBar renders all four upgraded controls cleanly with role permissions and a11y labels', () => {
  const studentHtml = renderToStaticMarkup(
    React.createElement(DashboardTopBar, {
      activeTab: 'homework',
      studyHubSubTab: 'dashboard',
      sidebarOpen: true,
      onToggleSidebar: () => {},
      effectiveRole: 'student',
      currentUser: studentUser,
      clock: '10:42 AM',
      ttsEnabled: false,
      onToggleTts: () => {},
      onOpenSoundSettings: () => {},
      onOpenVoiceAssistant: () => {},
      fontSize: 'standard',
      onCycleFontSize: () => {},
      highContrast: false,
      onToggleHighContrast: () => {},
      presentationMode: false,
      hasPinConfigured: false,
      onOpenSecurityCenter: () => {},
      onOpenBroadcast: () => {},
      unreadNotificationsCount: 124,
      showNotifCenter: false,
      onToggleNotifCenter: () => {},
      onCloseNotifCenter: () => {},
      onNavigateTab: () => {},
      whatsNewUnreadCount: 2,
    })
  );

  assert.ok(studentHtml.includes('My Homework'));
  assert.ok(studentHtml.includes('Voice &amp; Audio Controls'));
  assert.ok(studentHtml.includes('Open Notifications Panel (124 unread)'));
  assert.ok(studentHtml.includes('99+'));
  assert.equal(studentHtml.includes('Classroom Security Center'), false, 'Students must not see faculty Security control');
  assert.equal(studentHtml.includes('Open Broadcast Composer'), false, 'Students must not see staff Broadcast control');

  const staffHtml = renderToStaticMarkup(
    React.createElement(DashboardTopBar, {
      activeTab: 'attendance_manager',
      studyHubSubTab: 'dashboard',
      sidebarOpen: false,
      onToggleSidebar: () => {},
      effectiveRole: 'admin',
      currentUser: adminUser,
      clock: '10:45 AM',
      ttsEnabled: true,
      onToggleTts: () => {},
      onOpenSoundSettings: () => {},
      onOpenVoiceAssistant: () => {},
      fontSize: 'large',
      onCycleFontSize: () => {},
      highContrast: false,
      onToggleHighContrast: () => {},
      presentationMode: true,
      hasPinConfigured: true,
      onOpenSecurityCenter: () => {},
      onOpenBroadcast: () => {},
      unreadNotificationsCount: 5,
      showNotifCenter: false,
      onToggleNotifCenter: () => {},
      onCloseNotifCenter: () => {},
      onNavigateTab: () => {},
      whatsNewUnreadCount: 0,
    })
  );

  assert.ok(staffHtml.includes('Attendance Manager'));
  assert.ok(staffHtml.includes('Voice &amp; Audio Controls'));
  assert.ok(staffHtml.includes('Classroom Security Center'));
  assert.ok(staffHtml.includes('Open Broadcast Composer'));
  assert.ok(staffHtml.includes('Open Notifications Panel (5 unread)'));
  assert.equal(getActiveTabTitle('admin', 'dashboard'), 'Admin Control Center');
  assert.equal(getActiveTabTitle('life', 'dashboard'), 'Veylentra Life');

  const teacherTitle = getActiveTabTitle('faculty', 'dashboard');
  assert.equal(teacherTitle, 'Teacher Dashboard');
  void teacherUser;
});

console.log(`\n🎉 All ${passed} notification navigation, text selection & DashboardTopBar tests passed!`);
