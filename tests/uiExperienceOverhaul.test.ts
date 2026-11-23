/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Veylentra — Notifications, Broadcast & Veylentra Life UI/UX Overhaul Verification
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  CampusCoverArtwork,
  GalleryPlaceholderTile,
  LifeCategoryIcon,
  resolveCategoryTheme,
} from '../src/components/life/LifeVisuals';
import { BroadcastModal } from '../src/components/BroadcastModal';
import { LiveBroadcastBanner } from '../src/components/LiveBroadcastBanner';
import { NotificationCenter } from '../src/components/NotificationCenter';
import { StudentOSLife } from '../src/components/StudentOSLife';
import { UserProfile } from '../src/types';

let passed = 0;
function runTest(name: string, fn: () => void) {
  fn();
  passed += 1;
  console.log(`✅ [PASS] ${name}`);
}

const studentUser: UserProfile = {
  uid: 'student-ui-1',
  name: 'Aarav Sharma',
  email: 'aarav@veylentra.edu',
  role: 'student',
  house: 'Ruby',
  grade: 'Grade 11',
  section: 'Astra',
  streakDays: 4,
  studyHours: 12,
};

const adminUser: UserProfile = {
  uid: 'admin-ui-1',
  name: 'Principal Dr. V. K. Sharma',
  email: 'principal@veylentra.edu',
  role: 'admin',
  house: 'Sapphire',
  grade: 'All',
  section: 'Astra',
  streakDays: 10,
  studyHours: 20,
};

runTest('LifeVisuals excludes legacy broken Unsplash URLs and falls back to SVG artwork', () => {
  const brokenHtml = renderToStaticMarkup(
    React.createElement(CampusCoverArtwork, {
      category: 'Robotics',
      title: 'Robotics Showcase',
      imageUrl: 'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?auto=format&fit=crop&q=80',
    })
  );
  assert.equal(brokenHtml.includes('<img'), false);
  assert.ok(brokenHtml.includes('<svg'));
  assert.ok(brokenHtml.includes('Robotics Showcase visual backdrop'));

  const customHtml = renderToStaticMarkup(
    React.createElement(CampusCoverArtwork, {
      category: 'Annual Day',
      title: 'Annual Cultural Night',
      imageUrl: 'https://cdn.veylentra.edu/gallery/annual-day.jpg',
    })
  );
  assert.ok(customHtml.includes('<img'));
  assert.ok(customHtml.includes('referrerPolicy="no-referrer"') || customHtml.includes('referrerpolicy="no-referrer"'));

  const tileHtml = renderToStaticMarkup(
    React.createElement(GalleryPlaceholderTile, { category: 'Sports', index: 2, title: 'Track Meet' })
  );
  assert.ok(tileHtml.includes('<svg'));
});

runTest('LifeCategoryIcon renders crisp Lucide SVGs instead of raw emoji characters', () => {
  for (const token of ['🤖', '💻', '🏆', '📚', '🎵']) {
    const html = renderToStaticMarkup(React.createElement(LifeCategoryIcon, { token }));
    assert.ok(html.includes('<svg'), `Expected SVG output for token ${token}`);
    assert.equal(html.includes(token), false, `Raw emoji ${token} should not leak into DOM`);
  }
  assert.equal(resolveCategoryTheme('Ruby').pattern, 'crest');
  assert.equal(resolveCategoryTheme('Coding').pattern, 'circuit');
});

runTest('BroadcastModal renders multi-step workflow, audience scopes, priority cards, and closed state cleanly', () => {
  const closedHtml = renderToStaticMarkup(
    React.createElement(BroadcastModal, {
      currentUser: adminUser,
      effectiveRole: 'admin',
      isOpen: false,
      onClose: () => {},
    })
  );
  assert.equal(closedHtml, '');

  const openHtml = renderToStaticMarkup(
    React.createElement(BroadcastModal, {
      currentUser: adminUser,
      effectiveRole: 'admin',
      isOpen: true,
      onClose: () => {},
    })
  );
  assert.ok(openHtml.includes('Institutional Live Broadcast'));
  assert.ok(openHtml.includes('Notice Title'));
  assert.ok(openHtml.includes('Priority &amp; Interrupt Level'));
  assert.ok(openHtml.includes('All Campus'));
  assert.ok(openHtml.includes('Review &amp; Preview'));
  assert.ok(openHtml.includes('History'));
});

runTest('LiveBroadcastBanner and NotificationCenter export cleanly and handle SSR safely', () => {
  const bannerHtml = renderToStaticMarkup(
    React.createElement(LiveBroadcastBanner, { currentUser: studentUser, effectiveRole: 'student' })
  );
  assert.equal(bannerHtml, '');

  const notifHtml = renderToStaticMarkup(
    React.createElement(NotificationCenter, {
      currentUser: studentUser,
      isOpen: true,
      onClose: () => {},
    })
  );
  assert.equal(notifHtml, '');
});

runTest('StudentOSLife renders full dark-academic hub with role-scoped staff controls and zero broken patterns', () => {
  const studentHtml = renderToStaticMarkup(
    React.createElement(StudentOSLife, { currentUser: studentUser })
  );
  assert.ok(studentHtml.includes('Veylentra'));
  assert.ok(studentHtml.includes('Student Portal'));
  assert.ok(studentHtml.includes('role="tablist"'));
  for (const tab of ['Overview', 'Competitions', 'Leaderboards', 'Houses', 'Clubs', 'Calendar', 'Badges', 'Gallery', 'News', 'Polls']) {
    assert.ok(studentHtml.includes(tab), `Missing tab ${tab}`);
  }
  assert.equal(studentHtml.includes('Create Competition'), false);
  assert.equal(studentHtml.includes('Award Badge'), false);

  const adminHtml = renderToStaticMarkup(
    React.createElement(StudentOSLife, { currentUser: adminUser })
  );
  assert.ok(adminHtml.includes('Create Competition'));
  assert.ok(adminHtml.includes('Award Badge'));
});

runTest('Touched components enforce reduced motion, clean patterns, and App.tsx integration', () => {
  const ncSrc = fs.readFileSync(path.resolve(process.cwd(), 'src/components/NotificationCenter.tsx'), 'utf8');
  const bmSrc = fs.readFileSync(path.resolve(process.cwd(), 'src/components/BroadcastModal.tsx'), 'utf8');
  const lbbSrc = fs.readFileSync(path.resolve(process.cwd(), 'src/components/LiveBroadcastBanner.tsx'), 'utf8');
  const lifeSrc = fs.readFileSync(path.resolve(process.cwd(), 'src/components/StudentOSLife.tsx'), 'utf8');
  const appSrc = fs.readFileSync(path.resolve(process.cwd(), 'src/App.tsx'), 'utf8');

  for (const [name, src] of [
    ['NotificationCenter', ncSrc],
    ['BroadcastModal', bmSrc],
    ['LiveBroadcastBanner', lbbSrc],
    ['StudentOSLife', lifeSrc],
  ] as const) {
    assert.ok(src.includes('useReducedMotionPreference'), `${name} should use useReducedMotionPreference`);
    assert.equal(src.includes('animate-pulse'), false, `${name} should not contain animate-pulse`);
    assert.equal(src.includes('border-l-4'), false, `${name} should not contain border-l-4`);
  }

  assert.ok(ncSrc.includes('Veylentra Realtime Notification Engine'));
  assert.ok(ncSrc.includes('createPortal'));
  assert.ok(bmSrc.includes('ttlHours'));
  assert.ok(bmSrc.includes('expiresInHours'));
  assert.ok(bmSrc.includes('targetGrade'));
  assert.ok(bmSrc.includes('targetClass'));
  assert.equal(appSrc.includes('{isBroadcastModalOpen && ('), false);
  assert.ok(appSrc.includes('isOpen={isBroadcastModalOpen}'));
});

console.log(`\n🎉 All ${passed} UI/UX Overhaul tests passed!`);
