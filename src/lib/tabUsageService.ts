/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * StudentOS Tab Usage Analytics Engine
 * Tracks tab views and generates analytics reports for Super Admin.
 */

export interface TabUsageEvent {
  id: string;
  tabId: string;
  tabLabel: string;
  role: string;
  grade?: string;
  section?: string;
  schoolId?: string;
  timestamp: string; // ISO date
}

export interface TabUsageSummary {
  tabId: string;
  tabLabel: string;
  openCount: number;
  percentage: number;
}

export interface TabUsageReport {
  totalOpens: number;
  startDate: string;
  endDate: string;
  mostUsedTab: TabUsageSummary | null;
  leastUsedTab: TabUsageSummary | null;
  allTabs: TabUsageSummary[];
  roleBreakdown: Record<string, number>;
}

const TAB_USAGE_STORAGE_KEY = 'studentos_tab_usage_events';

export const KNOWN_TABS: Record<string, string> = {
  dashboard: 'Home / Dashboard',
  study_hub: 'Study Hub & Planner',
  peer_chat: 'Peer & Global Chat',
  ai_teacher: 'Byte AI Study Assistant',
  attendance_manager: 'Attendance Manager',
  homework: 'Class Homework',
  whiteboard: 'Class Whiteboard',
  gradebook: 'Digital Gradebook',
  report_cards: 'Digital Report Cards',
  brain_battle: 'Brain Battle Arena',
  materials: 'Materials Hub',
  meet: 'Virtual Classroom (Meet)',
  profile: 'Student Profile & Settings',
  admin: 'Admin & Control Center'
};

function generateInitialTabUsage(): TabUsageEvent[] {
  const events: TabUsageEvent[] = [];
  const roles = ['student', 'student', 'student', 'teacher', 'admin'];
  const grades = ['Grade 9', 'Grade 10', 'Grade 11', 'Grade 12'];
  const sections = ['Astra', 'Solara', 'Elara', 'Vega'];
  const tabKeys = Object.keys(KNOWN_TABS);

  // Pre-seed 300 realistic events over the past 7 days
  const now = Date.now();
  for (let i = 0; i < 300; i++) {
    const ageMs = Math.floor(Math.random() * (7 * 24 * 3600 * 1000));
    // Bias towards dashboard, study_hub, ai_teacher, homework
    const weightedTabs = [
      'dashboard', 'dashboard', 'dashboard',
      'study_hub', 'study_hub',
      'ai_teacher', 'ai_teacher', 'ai_teacher',
      'homework', 'homework',
      'peer_chat', 'whiteboard',
      'attendance_manager', 'gradebook', 'brain_battle', 'materials'
    ];
    const tabId = weightedTabs[Math.floor(Math.random() * weightedTabs.length)] || tabKeys[i % tabKeys.length];
    events.push({
      id: `ev-${i}`,
      tabId,
      tabLabel: KNOWN_TABS[tabId] || tabId,
      role: roles[Math.floor(Math.random() * roles.length)],
      grade: grades[Math.floor(Math.random() * grades.length)],
      section: sections[Math.floor(Math.random() * sections.length)],
      schoolId: 'dps-main',
      timestamp: new Date(now - ageMs).toISOString()
    });
  }
  return events;
}

export function getStoredTabEvents(): TabUsageEvent[] {
  if (typeof window === 'undefined') return generateInitialTabUsage();
  try {
    const raw = localStorage.getItem(TAB_USAGE_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (_) {}
  const seeded = generateInitialTabUsage();
  try {
    localStorage.setItem(TAB_USAGE_STORAGE_KEY, JSON.stringify(seeded));
  } catch (_) {}
  return seeded;
}

export function logTabOpen(
  tabId: string,
  user?: { role?: string; grade?: string; section?: string; schoolId?: string }
) {
  if (typeof window === 'undefined') return;

  const event: TabUsageEvent = {
    id: `ev-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    tabId,
    tabLabel: KNOWN_TABS[tabId] || tabId,
    role: user?.role || 'student',
    grade: user?.grade,
    section: user?.section,
    schoolId: user?.schoolId || 'dps-main',
    timestamp: new Date().toISOString()
  };

  try {
    const events = getStoredTabEvents();
    const updated = [event, ...events].slice(0, 2000); // keep recent 2000 events
    localStorage.setItem(TAB_USAGE_STORAGE_KEY, JSON.stringify(updated));
  } catch (_) {}
}

export function generateTabUsageReport(options?: {
  startDate?: string;
  endDate?: string;
  roleFilter?: string;
  gradeFilter?: string;
  schoolId?: string;
}): TabUsageReport {
  const events = getStoredTabEvents();

  const now = new Date();
  const defaultStart = new Date(now.getTime() - 7 * 24 * 3600 * 1000).toISOString().split('T')[0];
  const defaultEnd = now.toISOString().split('T')[0];

  const startDate = options?.startDate || defaultStart;
  const endDate = options?.endDate || defaultEnd;

  // Filter events
  const filtered = events.filter(e => {
    const eventDate = e.timestamp.split('T')[0];
    if (eventDate < startDate || eventDate > endDate) return false;
    if (options?.roleFilter && options.roleFilter !== 'all' && e.role !== options.roleFilter) {
      return false;
    }
    if (options?.gradeFilter && options.gradeFilter !== 'all' && e.grade !== options.gradeFilter) {
      return false;
    }
    if (options?.schoolId && options.schoolId !== 'all' && e.schoolId && e.schoolId !== options.schoolId) {
      return false;
    }
    return true;
  });

  const totalOpens = filtered.length;
  const countsMap: Record<string, number> = {};
  const roleBreakdown: Record<string, number> = {};

  filtered.forEach(e => {
    countsMap[e.tabId] = (countsMap[e.tabId] || 0) + 1;
    roleBreakdown[e.role] = (roleBreakdown[e.role] || 0) + 1;
  });

  const allTabs: TabUsageSummary[] = Object.keys(KNOWN_TABS).map(tabId => {
    const openCount = countsMap[tabId] || 0;
    const percentage = totalOpens > 0 ? Math.round((openCount / totalOpens) * 100) : 0;
    return {
      tabId,
      tabLabel: KNOWN_TABS[tabId] || tabId,
      openCount,
      percentage
    };
  }).sort((a, b) => b.openCount - a.openCount);

  // Determine most and least used (active ones)
  const activeTabs = allTabs.filter(t => t.openCount > 0);
  const mostUsedTab = activeTabs.length > 0 ? activeTabs[0] : allTabs[0];
  const leastUsedTab = activeTabs.length > 0 ? activeTabs[activeTabs.length - 1] : allTabs[allTabs.length - 1];

  return {
    totalOpens,
    startDate,
    endDate,
    mostUsedTab,
    leastUsedTab,
    allTabs,
    roleBreakdown
  };
}
