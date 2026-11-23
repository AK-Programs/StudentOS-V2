/**
 * Veylentra Notification Navigation & Deep-Link Resolver
 *
 * Centralizes cold-start URL parsing, Service Worker postMessage bridging,
 * tab alias normalization, role-aware fallback, pending queue persistence
 * during auth/session restoration, and short-window deduplication.
 */

export interface NotificationNavIntent {
  tab?: string;
  linkTab?: string;
  route?: string;
  url?: string;
  notifId?: string;
  notificationId?: string;
  type?: string;
  callId?: string;
  action?: string;
  source?: 'url' | 'sw' | 'foreground' | 'local';
  receivedAt?: number;
}

export interface ResolvedNotificationDestination {
  tab: string;
  subTab?: 'dashboard' | 'tasks' | 'planner' | 'flashcards';
  openNotificationCenter: boolean;
  notifId: string;
  type: string;
  callId: string;
  usedFallback: boolean;
  wasRestrictedForRole: boolean;
}

export const PENDING_NOTIF_NAV_STORAGE_KEY = 's_os_pending_notif_nav';

export const VALID_APP_TABS = new Set<string>([
  'dashboard',
  'about',
  'meet',
  'study_hub',
  'whiteboard',
  'houses',
  'leaderboard',
  'winter_festival',
  'materials',
  'assignments',
  'homework',
  'brain_battle',
  'feedback',
  'ai_teacher',
  'peer_chat',
  'faculty',
  'notes',
  'pomodoro',
  'analytics',
  'gradebook',
  'report_cards',
  'profile',
  'blogs',
  'calendar',
  'whats_new',
  'panel_mode',
  'parent_portal',
  'sports_activities',
  'substitutes',
  'gallery_viewer',
  'timetable_viewer',
  'worksheet_viewer',
  'assignment_viewer',
  'notice_viewer',
  'attendance_manager',
  'admin',
  'life',
  'funzone',
]);

const TAB_ALIASES: Record<string, { tab: string; subTab?: 'dashboard' | 'tasks' | 'planner' | 'flashcards'; openNotificationCenter?: boolean }> = {
  dashboard: { tab: 'dashboard' },
  home: { tab: 'dashboard' },
  overview: { tab: 'dashboard' },
  student_experience: { tab: 'dashboard' },

  notifications: { tab: 'dashboard', openNotificationCenter: true },
  notification: { tab: 'dashboard', openNotificationCenter: true },
  notification_center: { tab: 'dashboard', openNotificationCenter: true },
  notif_center: { tab: 'dashboard', openNotificationCenter: true },
  inbox: { tab: 'dashboard', openNotificationCenter: true },

  notices: { tab: 'notice_viewer' },
  notice: { tab: 'notice_viewer' },
  notice_viewer: { tab: 'notice_viewer' },
  announcement: { tab: 'notice_viewer' },
  announcements: { tab: 'notice_viewer' },

  study_hub: { tab: 'study_hub', subTab: 'dashboard' },
  'study-hub': { tab: 'study_hub', subTab: 'dashboard' },
  study_center: { tab: 'study_hub', subTab: 'dashboard' },
  'study-center': { tab: 'study_hub', subTab: 'dashboard' },
  flashcards: { tab: 'study_hub', subTab: 'flashcards' },
  tasks: { tab: 'study_hub', subTab: 'tasks' },
  planner: { tab: 'study_hub', subTab: 'planner' },

  whats_new: { tab: 'whats_new' },
  'whats-new': { tab: 'whats_new' },
  updates: { tab: 'whats_new' },

  life: { tab: 'life' },
  studentos_life: { tab: 'life' },
  'studentos-life': { tab: 'life' },

  quiz: { tab: 'brain_battle' },
  quizzes: { tab: 'brain_battle' },
  brain_battle: { tab: 'brain_battle' },

  chat: { tab: 'peer_chat' },
  messages: { tab: 'peer_chat' },
  dm: { tab: 'peer_chat' },
  call: { tab: 'peer_chat' },
  calls: { tab: 'peer_chat' },
  peer_chat: { tab: 'peer_chat' },

  attendance: { tab: 'attendance_manager' },
  attendance_tracker: { tab: 'attendance_manager' },
  attendance_manager: { tab: 'attendance_manager' },

  marks: { tab: 'gradebook' },
  grades: { tab: 'gradebook' },
  scores: { tab: 'gradebook' },
  gradebook: { tab: 'gradebook' },

  performance: { tab: 'analytics' },
  progress: { tab: 'analytics' },
  analytics: { tab: 'analytics' },

  teacher: { tab: 'faculty' },
  teacher_dashboard: { tab: 'faculty' },
  faculty: { tab: 'faculty' },

  admin_center: { tab: 'admin' },
  'admin-center': { tab: 'admin' },
  admin: { tab: 'admin' },

  schedule: { tab: 'calendar' },
  calendar: { tab: 'calendar' },

  teacher_fun_zone: { tab: 'funzone' },
  funzone: { tab: 'funzone' },

  assignment: { tab: 'assignments' },
  assignments: { tab: 'assignments' },
  homework: { tab: 'homework' },
  worksheet: { tab: 'worksheet_viewer' },
  worksheets: { tab: 'worksheet_viewer' },
  timetable: { tab: 'timetable_viewer' },
  gallery: { tab: 'gallery_viewer' },
  winter: { tab: 'winter_festival' },
  winter_festival: { tab: 'winter_festival' },
};

const PARENT_ALLOWED_TABS = new Set(['parent_portal', 'profile', 'whats_new', 'about']);
const STUDENT_FORBIDDEN_TABS = new Set(['faculty', 'attendance_manager', 'admin', 'panel_mode']);
const STAFF_ROLES = new Set(['teacher', 'coordinator', 'hod', 'admin', 'super_admin']);
const ADMIN_ROLES = new Set(['admin', 'super_admin']);

/**
 * Extract raw query parameters from a URL string or search string.
 */
function extractParamsFromUrlString(rawUrl?: string): URLSearchParams | null {
  if (!rawUrl || typeof rawUrl !== 'string') return null;
  try {
    const qIndex = rawUrl.indexOf('?');
    if (qIndex >= 0) {
      return new URLSearchParams(rawUrl.slice(qIndex + 1).split('#')[0]);
    }
    if (rawUrl.startsWith('tab=') || rawUrl.includes('&tab=')) {
      return new URLSearchParams(rawUrl);
    }
  } catch (_) {}
  return null;
}

/**
 * Parse notification navigation intent from window.location.search / hash.
 */
export function parseNotificationIntentFromLocation(
  search: string = typeof window !== 'undefined' ? window.location.search : '',
  hash: string = typeof window !== 'undefined' ? window.location.hash : ''
): NotificationNavIntent | null {
  try {
    const params = new URLSearchParams(search || '');
    let tab =
      params.get('tab') ||
      params.get('linkTab') ||
      params.get('route') ||
      params.get('target') ||
      '';
    let notifId =
      params.get('notifId') ||
      params.get('notificationId') ||
      '';
    let callId = params.get('callId') || '';
    const type = params.get('type') || (callId ? 'call' : '');
    const fcmOpen = params.get('fcm_open');

    // Fallback: check hash query segment if present (e.g. #/?tab=homework)
    if (!tab && !notifId && hash && hash.includes('?')) {
      const hashParams = extractParamsFromUrlString(hash);
      if (hashParams) {
        tab = hashParams.get('tab') || hashParams.get('linkTab') || hashParams.get('route') || '';
        notifId = hashParams.get('notifId') || hashParams.get('notificationId') || '';
        if (!callId) callId = hashParams.get('callId') || '';
      }
    }

    if (!tab && !notifId && !callId && !fcmOpen) {
      return null;
    }

    return {
      tab: tab || undefined,
      linkTab: tab || undefined,
      notifId: notifId || undefined,
      type: type || undefined,
      callId: callId || undefined,
      source: 'url',
      receivedAt: Date.now(),
    };
  } catch (_) {
    return null;
  }
}

/**
 * Resolve raw notification payload/URL metadata to a validated app tab + drawer state.
 */
export function resolveNotificationDestination(
  intent: NotificationNavIntent | null | undefined,
  userRole?: string | null
): ResolvedNotificationDestination {
  const role = String(userRole || 'student').toLowerCase().trim();
  const notifId = String(intent?.notifId || intent?.notificationId || '').trim();
  const callId = String(intent?.callId || '').trim();
  const type = String(intent?.type || (callId ? 'call' : 'announcement')).toLowerCase().trim();

  // Pull missing parameters from embedded URL if needed
  const urlParams = extractParamsFromUrlString(intent?.url);
  const rawTabCandidate = String(
    intent?.linkTab ||
      intent?.tab ||
      intent?.route ||
      urlParams?.get('tab') ||
      urlParams?.get('linkTab') ||
      urlParams?.get('route') ||
      ''
  )
    .toLowerCase()
    .trim();

  const resolvedNotifId =
    notifId ||
    String(urlParams?.get('notifId') || urlParams?.get('notificationId') || '').trim();
  const resolvedCallId = callId || String(urlParams?.get('callId') || '').trim();

  // Incoming call notifications always route to peer_chat (unless parent)
  if ((type === 'call' || type === 'incoming_call' || Boolean(resolvedCallId)) && !rawTabCandidate) {
    if (role === 'parent') {
      return {
        tab: 'parent_portal',
        openNotificationCenter: true,
        notifId: resolvedNotifId,
        type: 'call',
        callId: resolvedCallId,
        usedFallback: true,
        wasRestrictedForRole: true,
      };
    }
    return {
      tab: 'peer_chat',
      openNotificationCenter: false,
      notifId: resolvedNotifId,
      type: 'call',
      callId: resolvedCallId,
      usedFallback: false,
      wasRestrictedForRole: false,
    };
  }

  let mappedTab = '';
  let mappedSubTab: ResolvedNotificationDestination['subTab'];
  let openNotificationCenter = false;
  let usedFallback = false;

  if (rawTabCandidate && TAB_ALIASES[rawTabCandidate]) {
    const alias = TAB_ALIASES[rawTabCandidate];
    mappedTab = alias.tab;
    mappedSubTab = alias.subTab;
    openNotificationCenter = Boolean(alias.openNotificationCenter);
  } else if (rawTabCandidate && VALID_APP_TABS.has(rawTabCandidate)) {
    mappedTab = rawTabCandidate;
  } else {
    // Missing or unrecognized destination metadata -> graceful fallback
    mappedTab = 'dashboard';
    openNotificationCenter = true;
    usedFallback = true;
  }

  // Enforce role-aware route eligibility so users never hit an empty or forbidden screen
  let wasRestrictedForRole = false;
  if (role === 'parent') {
    if (!PARENT_ALLOWED_TABS.has(mappedTab)) {
      mappedTab = 'parent_portal';
      mappedSubTab = undefined;
      openNotificationCenter = true;
      wasRestrictedForRole = true;
      usedFallback = true;
    }
  } else if (role === 'student') {
    if (STUDENT_FORBIDDEN_TABS.has(mappedTab)) {
      mappedTab = 'dashboard';
      mappedSubTab = undefined;
      openNotificationCenter = true;
      wasRestrictedForRole = true;
      usedFallback = true;
    }
  } else if (!STAFF_ROLES.has(role)) {
    if (STUDENT_FORBIDDEN_TABS.has(mappedTab)) {
      mappedTab = 'dashboard';
      mappedSubTab = undefined;
      openNotificationCenter = true;
      wasRestrictedForRole = true;
      usedFallback = true;
    }
  } else if (mappedTab === 'admin' && !ADMIN_ROLES.has(role)) {
    mappedTab = 'dashboard';
    mappedSubTab = undefined;
    openNotificationCenter = true;
    wasRestrictedForRole = true;
    usedFallback = true;
  }

  return {
    tab: mappedTab,
    subTab: mappedSubTab,
    openNotificationCenter,
    notifId: resolvedNotifId,
    type,
    callId: resolvedCallId,
    usedFallback,
    wasRestrictedForRole,
  };
}

/**
 * Build a clean deep-link URL for push payloads.
 */
export function buildNotificationUrl(
  linkTab?: string,
  notifId?: string,
  extra?: { callId?: string; autoAccept?: boolean }
): string {
  const safeTab = (linkTab || 'notice_viewer').trim() || 'notice_viewer';
  const params = new URLSearchParams();
  params.set('tab', safeTab);
  if (notifId) params.set('notifId', notifId);
  if (extra?.callId) params.set('callId', extra.callId);
  if (extra?.autoAccept) params.set('autoAccept', '1');
  return `/?${params.toString()}`;
}

let inMemoryPendingIntent: NotificationNavIntent | null = null;
let lastDispatchedSignature = '';
let lastDispatchedTimestamp = 0;

export function persistPendingNotificationIntent(intent: NotificationNavIntent | null): void {
  inMemoryPendingIntent = intent;
  if (typeof window === 'undefined') return;
  try {
    if (intent) {
      sessionStorage.setItem(PENDING_NOTIF_NAV_STORAGE_KEY, JSON.stringify(intent));
    } else {
      sessionStorage.removeItem(PENDING_NOTIF_NAV_STORAGE_KEY);
    }
  } catch (_) {}
}

export function peekPendingNotificationIntent(): NotificationNavIntent | null {
  if (inMemoryPendingIntent) return inMemoryPendingIntent;
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(PENDING_NOTIF_NAV_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as NotificationNavIntent;
    // Expire stale pending intents older than 10 minutes
    if (parsed?.receivedAt && Date.now() - parsed.receivedAt > 10 * 60 * 1000) {
      sessionStorage.removeItem(PENDING_NOTIF_NAV_STORAGE_KEY);
      return null;
    }
    inMemoryPendingIntent = parsed;
    return parsed;
  } catch (_) {
    return null;
  }
}

export function consumePendingNotificationIntent(): NotificationNavIntent | null {
  const intent = peekPendingNotificationIntent();
  persistPendingNotificationIntent(null);
  return intent;
}

/**
 * Clean notification deep-link query params from browser address bar after consuming.
 */
export function stripNotificationParamsFromUrl(): void {
  if (typeof window === 'undefined') return;
  try {
    const urlParams = new URLSearchParams(window.location.search);
    const keysToStrip = ['tab', 'linkTab', 'route', 'target', 'notifId', 'notificationId', 'fcm_open'];
    let changed = false;
    for (const key of keysToStrip) {
      if (urlParams.has(key)) {
        urlParams.delete(key);
        changed = true;
      }
    }
    if (changed) {
      const qs = urlParams.toString();
      const nextUrl = window.location.pathname + (qs ? `?${qs}` : '') + (window.location.hash || '');
      window.history.replaceState(null, '', nextUrl);
    }
  } catch (_) {}
}

/**
 * Deduplicated dispatch of notification navigation intent both into pending queue and DOM event.
 */
export function dispatchNotificationNavigation(intent: NotificationNavIntent): boolean {
  const tabKey = String(intent.linkTab || intent.tab || intent.route || '').trim();
  const notifKey = String(intent.notifId || intent.notificationId || '').trim();
  const callKey = String(intent.callId || '').trim();
  const actionKey = String(intent.action || '').trim();
  const sig = `${tabKey}|${notifKey}|${callKey}|${actionKey}`;
  const now = Date.now();

  if (sig && sig === lastDispatchedSignature && now - lastDispatchedTimestamp < 900) {
    return false;
  }

  lastDispatchedSignature = sig;
  lastDispatchedTimestamp = now;

  const normalizedIntent: NotificationNavIntent = {
    ...intent,
    tab: tabKey || undefined,
    linkTab: tabKey || undefined,
    notifId: notifKey || undefined,
    callId: callKey || undefined,
    receivedAt: intent.receivedAt || now,
  };

  persistPendingNotificationIntent(normalizedIntent);

  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('studentos-navigate-tab', {
        detail: normalizedIntent,
      })
    );
  }
  return true;
}

let swBridgeInstalled = false;

export function isServiceWorkerNavigationBridgeInstalled(): boolean {
  return swBridgeInstalled;
}

/**
 * Install the single canonical Service Worker -> Window navigation listener.
 * Captures notificationclick messages even before React mounts App.tsx.
 */
export function installServiceWorkerNavigationBridge(): () => void {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return () => {};
  }
  if (swBridgeInstalled) {
    return () => {};
  }

  const handler = (event: MessageEvent) => {
    const data = event?.data;
    if (!data || typeof data !== 'object') return;
    if (data.type === 'STUDENTOS_NAVIGATE_TAB' || data.type === 'STUDENTOS_INCOMING_CALL') {
      dispatchNotificationNavigation({
        tab: data.tab || data.linkTab,
        linkTab: data.linkTab || data.tab,
        notifId: data.notifId || data.notificationId,
        callId: data.callId,
        type: data.type === 'STUDENTOS_INCOMING_CALL' ? 'call' : data.notifType || data.type,
        action: data.action,
        url: data.url,
        source: 'sw',
      });
    }
  };

  navigator.serviceWorker.addEventListener('message', handler);
  swBridgeInstalled = true;

  return () => {
    navigator.serviceWorker.removeEventListener('message', handler);
    swBridgeInstalled = false;
  };
}
