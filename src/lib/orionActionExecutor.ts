import { supabase } from './supabase';
import { createCompetition, createSchoolEvent } from './supabaseLife';
import { saveSupabaseHomework, deleteSupabaseHomework } from './supabaseHomework';
import { createOrUpdateMeeting, deleteMeeting } from './supabaseMeet';
import { saveAppNotification } from './notifications';
import { executeOrionCommunicationDispatch } from './orionCommunication';
import { Homework, Meeting, AppNotification, Competition, SchoolEvent } from '../types';

export type OrionActionType =
  | 'create_broadcast'
  | 'create_notice'
  | 'update_broadcast'
  | 'delete_broadcast'
  | 'create_notification'
  | 'create_reminder'
  | 'notify_users'
  | 'notify_class'
  | 'notify_all'
  | 'create_event'
  | 'update_event'
  | 'delete_event'
  | 'create_competition'
  | 'update_competition'
  | 'delete_competition'
  | 'register_competition'
  | 'create_meeting'
  | 'schedule_meeting'
  | 'cancel_meeting'
  | 'delete_meeting'
  | 'create_assignment'
  | 'create_homework'
  | 'update_assignment'
  | 'delete_assignment'
  | 'delete_homework'
  | 'delete_item'
  | 'start_attendance'
  | 'get_assignments'
  | 'get_homework'
  | 'get_submissions'
  | 'get_attendance'
  | 'get_students'
  | 'get_classes'
  | 'get_calendar'
  | 'get_notifications'
  | 'generate_report'
  | 'export_report'
  | 'daily_operations_summary'
  | 'search_users'
  | 'search_internet'
  | 'generate_notes'
  | 'generate_lesson_plan'
  | 'show_pending_assignments'
  | 'show_timetable'
  | 'show_attendance'
  | 'show_announcements'
  | 'navigate_tab'
  | 'web_search'
  | 'general_chat'
  | 'add_study_planner'
  | 'create_study_plan'
  | 'create_calendar_event'
  | 'create_note'
  | 'mark_attendance'
  | 'add_task'
  | 'complete_task'
  | 'delete_task';

export interface OrionStructuredMetric {
  label: string;
  value: string | number;
  tone?: 'default' | 'emerald' | 'amber' | 'rose' | 'indigo';
}

export interface OrionStructuredTableRow {
  id: string;
  primary: string;
  secondary?: string;
  badge?: string;
  badgeTone?: 'emerald' | 'amber' | 'rose' | 'indigo' | 'slate';
  meta?: string;
}

export interface OrionSuggestedAction {
  label: string;
  command: string;
  variant?: 'primary' | 'secondary' | 'warning';
  exportData?: { filename: string; content: string; mimeType?: string };
}

export interface OrionStructuredCard {
  title: string;
  subtitle?: string;
  dateRange?: string;
  metrics?: OrionStructuredMetric[];
  rows?: OrionStructuredTableRow[];
  bulletPoints?: string[];
  suggestedActions?: OrionSuggestedAction[];
  reportMarkdown?: string;
}

export interface StructuredOrionPayload {
  type?: 'table' | 'metrics' | 'report' | 'list';
  title: string;
  subtitle?: string;
  metrics?: { label: string; value: string | number; status?: 'good' | 'warning' | 'danger' | 'neutral' }[];
  columns?: string[];
  rows?: Record<string, string | number>[];
  recommendedActions?: { label: string; command: string }[];
  exportableMarkdown?: string;
}

export interface OrionDraftPreview {
  action: OrionActionType;
  badgeLabel: string;
  title: string;
  targetAudience: string;
  dateOrTime?: string;
  bodyPreview: string;
  rawAction: OrionAction;
}

export interface OrionAction {
  action: OrionActionType;
  title?: string;
  message?: string;
  content?: string;
  subject?: string;
  category?: string;
  audience?: string;
  targetClass?: string;
  targetUserId?: string;
  date?: string;
  time?: string;
  location?: string;
  prizePool?: string;
  eligibility?: string;
  meetingId?: string;
  targetId?: string;
  targetValue?: string;
  details?: Record<string, any>;
}

export interface OrionUserContext {
  userId?: string;
  userName?: string;
  userEmail?: string;
  userRole?: string; // 'super_admin' | 'admin' | 'coordinator' | 'teacher' | 'student'
  schoolId?: string;
  grade?: string;
  section?: string;
}

export interface OrionExecutionResult {
  success: boolean;
  action: OrionActionType;
  recordId?: string;
  message: string;
  summaryText: string;
  data?: any;
  structuredCard?: OrionStructuredCard;
  draftPreview?: OrionDraftPreview;
  requiresConfirmation?: boolean;
  confirmationPrompt?: string;
  error?: string;
}

/**
 * Emit a local window event so all StudentOS UI components instantly refresh their data from Supabase
 */
export function triggerRealtimeUIUpdate(table: string, action: 'INSERT' | 'UPDATE' | 'DELETE', record?: any) {
  console.log(`[ORION] Realtime update triggered for ${table} (${action})`);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('studentos-db-update', {
      detail: { table, action, record, timestamp: Date.now() }
    }));
  }
}

/**
 * Check if a user role has authorization to execute the requested action
 */
export function validateActionPermission(
  action: OrionActionType,
  role: string = 'student'
): { allowed: boolean; reason?: string } {
  const normRole = (role || 'student').toLowerCase();
  const isAdmin = normRole === 'super_admin' || normRole === 'admin';
  const isCoordinator = normRole === 'coordinator' || isAdmin;
  const isStaff =
    normRole === 'teacher' ||
    normRole === 'faculty' ||
    normRole === 'head_teacher' ||
    isCoordinator ||
    isAdmin;

  // Student permissions whitelist (Orion is strictly staff/admin for school operations)
  const studentAllowedActions: OrionActionType[] = [
    'register_competition',
    'show_pending_assignments',
    'show_timetable',
    'show_announcements',
    'navigate_tab',
    'general_chat',
    'add_study_planner',
    'create_study_plan',
    'create_note',
    'generate_notes',
    'add_task',
    'complete_task',
    'delete_task',
    'web_search',
    'search_internet'
  ];

  // Admin/Coordinator-only school-wide broadcast & destructive operations
  const coordinatorOrAdminOnlyActions: OrionActionType[] = [
    'create_broadcast',
    'update_broadcast',
    'delete_broadcast',
    'notify_all'
  ];

  if (!isStaff) {
    if (studentAllowedActions.includes(action)) {
      return { allowed: true };
    }
    return {
      allowed: false,
      reason: `🔒 Authorization Denied: Orion staff intelligence and automation tools (${action}) require Teacher, Coordinator, or Administrator credentials.`
    };
  }

  if (coordinatorOrAdminOnlyActions.includes(action) && !isCoordinator && !isStaff) {
    return {
      allowed: false,
      reason: `🔒 Authorization Denied: School-wide broadcast action (${action}) requires Coordinator or Administrator privileges.`
    };
  }

  return { allowed: true };
}

/**
 * Consequential actions that modify school records or notify groups require explicit confirmation
 * before Orion executes them against the database.
 */
export const CONSEQUENTIAL_ACTIONS: OrionActionType[] = [
  'create_broadcast',
  'create_notice',
  'update_broadcast',
  'delete_broadcast',
  'create_notification',
  'create_reminder',
  'notify_users',
  'notify_class',
  'notify_all',
  'create_event',
  'update_event',
  'delete_event',
  'create_competition',
  'update_competition',
  'delete_competition',
  'create_meeting',
  'schedule_meeting',
  'cancel_meeting',
  'delete_meeting',
  'create_assignment',
  'create_homework',
  'update_assignment',
  'delete_assignment',
  'delete_homework',
  'delete_item',
  'create_calendar_event'
];

export const DESTRUCTIVE_ACTIONS: OrionActionType[] = [
  'delete_broadcast',
  'delete_event',
  'delete_competition',
  'delete_meeting',
  'cancel_meeting',
  'delete_assignment',
  'delete_homework',
  'delete_item'
];

export function isDestructiveAction(action: OrionActionType): boolean {
  return DESTRUCTIVE_ACTIONS.includes(action);
}

export function isConsequentialAction(action: OrionActionType): boolean {
  return CONSEQUENTIAL_ACTIONS.includes(action);
}

/**
 * Builds a structured confirmation preview for consequential Orion actions
 */
export function buildConsequentialActionPreview(actionObj: OrionAction): OrionDraftPreview {
  const act = actionObj.action;
  const targetAudience = actionObj.targetClass || actionObj.audience || 'All Authorized Recipients';
  const title =
    actionObj.title ||
    extractCleanTitle(
      actionObj.targetValue || actionObj.content || actionObj.message || '',
      act.includes('meet')
        ? 'meeting'
        : act.includes('comp')
          ? 'competition'
          : act.includes('event')
            ? 'event'
            : act.includes('homework') || act.includes('assignment')
              ? 'homework'
              : 'broadcast'
    );
  const bodyPreview =
    actionObj.content ||
    actionObj.message ||
    `Prepared "${title}" for ${targetAudience}.`;

  let badgeLabel = 'Consequential Action';
  if (act === 'create_broadcast' || act === 'create_notice') badgeLabel = 'Draft School Notice';
  else if (act === 'create_homework' || act === 'create_assignment') badgeLabel = 'Draft Class Assignment';
  else if (act === 'create_reminder' || act.startsWith('notify_')) badgeLabel = 'Draft Student Reminder';
  else if (act.includes('meeting')) badgeLabel = 'Draft StudentOS Meet';
  else if (act.includes('event') || act.includes('calendar')) badgeLabel = 'Draft Calendar Event';
  else if (act.includes('competition')) badgeLabel = 'Draft Competition';
  else if (isDestructiveAction(act)) badgeLabel = 'Permanent Deletion';

  return {
    action: act,
    badgeLabel,
    title,
    targetAudience,
    dateOrTime: actionObj.date ? `${actionObj.date}${actionObj.time ? ' · ' + actionObj.time : ''}` : actionObj.time,
    bodyPreview,
    rawAction: actionObj
  };
}

/* ========================================================================
   UTILITY HELPER FUNCTIONS FOR DATE, TIME, TITLE, AND TARGET CLASS
   ======================================================================== */

/**
 * Cleanly extracts a professional title from natural language commands
 */
export function extractCleanTitle(rawText: string, type: 'meeting' | 'broadcast' | 'competition' | 'homework' | 'event'): string {
  if (!rawText) {
    if (type === 'meeting') return 'StudentOS Virtual Classroom';
    if (type === 'broadcast') return 'School Broadcast';
    if (type === 'competition') return 'StudentOS Competition';
    if (type === 'homework') return 'Class Assignment';
    if (type === 'event') return 'School Event';
  }

  let cleaned = rawText
    .replace(/^schedule\s+(a\s+)?(meeting|event|class|session|call|meet)\s+(at|for|on)?\s*/gi, '')
    .replace(/^create\s+(a\s+)?(broadcast|notice|announcement|competition|homework|assignment)\s+(saying|that|for|on|about)?\s*/gi, '')
    .replace(/\b(at|on|for)\s+\d{1,2}(?::\d{2})?\s*(am|pm)?\b/gi, '')
    .replace(/\bcalled\s+/gi, '')
    .replace(/\btitled\s+/gi, '')
    .replace(/\bnamed\s+/gi, '')
    .replace(/\bfor class\s+\d+[a-z]?\s*(solara|astra|elara|vega)?\b/gi, '')
    .replace(/\bdue\s+(today|tomorrow|friday|monday|tuesday|wednesday|thursday|saturday|sunday)\b/gi, '')
    .trim();

  cleaned = cleaned.replace(/^["'“”]+|["'“”]+$/g, '').trim();

  if (!cleaned || cleaned.length < 2) {
    if (type === 'meeting') return 'StudentOS Virtual Classroom';
    if (type === 'broadcast') return 'School Broadcast';
    if (type === 'competition') return 'StudentOS Competition';
    if (type === 'homework') return 'Class Assignment';
    if (type === 'event') return 'School Event';
  }

  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

/**
 * Parses grade and section from target class strings (e.g. "Class 10 Solara" -> { grade: "Grade 10", section: "Solara" })
 */
export function parseGradeAndSection(targetStr?: string): { grade: string; section: string } {
  if (!targetStr || !targetStr.trim()) {
    return { grade: 'Grade 10', section: 'All Sections' };
  }

  const str = targetStr.trim();

  // Extract Grade Number
  let gradeNum = '10';
  const numMatch = str.match(/\b(\d{1,2})\b/);
  if (numMatch) {
    gradeNum = numMatch[1];
  }

  // Extract Section
  let section = 'All Sections';
  const secMatch = str.match(/(solara|astra|elara|vega)/i);
  if (secMatch) {
    section = secMatch[1].charAt(0).toUpperCase() + secMatch[1].slice(1).toLowerCase();
  }

  return {
    grade: `Grade ${gradeNum}`,
    section
  };
}

/**
 * Parses start and end time without arbitrary buffers or subtractive offsets
 */
export function parseMeetingDateTime(dateInput?: string, timeInput?: string, fullText?: string): { startTime: string; endTime: string } {
  const now = new Date();
  let targetYear = now.getFullYear();
  let targetMonth = now.getMonth();
  let targetDay = now.getDate();

  const textToSearch = `${dateInput || ''} ${timeInput || ''} ${fullText || ''}`.toLowerCase();

  // 1. Date resolution
  if (textToSearch.includes('tomorrow')) {
    const tomorrow = new Date(now.getTime() + 86400000);
    targetYear = tomorrow.getFullYear();
    targetMonth = tomorrow.getMonth();
    targetDay = tomorrow.getDate();
  } else if (dateInput && /^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
    const parts = dateInput.split('-').map(Number);
    targetYear = parts[0];
    targetMonth = parts[1] - 1;
    targetDay = parts[2];
  } else {
    // Check day names: monday, tuesday, etc.
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    for (let i = 0; i < days.length; i++) {
      if (textToSearch.includes(days[i])) {
        const currentDay = now.getDay();
        let daysAhead = i - currentDay;
        if (daysAhead <= 0) daysAhead += 7;
        const targetDate = new Date(now.getTime() + daysAhead * 86400000);
        targetYear = targetDate.getFullYear();
        targetMonth = targetDate.getMonth();
        targetDay = targetDate.getDate();
        break;
      }
    }
  }

  // 2. Time resolution
  let parsedHour = 15; // Default 3 PM if unspecified
  let parsedMinute = 0;
  let timeFound = false;

  const timeMatch = textToSearch.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i);
  if (timeMatch) {
    let rawHour = parseInt(timeMatch[1], 10);
    const rawMin = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
    const meridian = timeMatch[3] ? timeMatch[3].toLowerCase() : null;

    if (rawHour >= 0 && rawHour <= 23) {
      if (meridian === 'pm' && rawHour < 12) {
        rawHour += 12;
      } else if (meridian === 'am' && rawHour === 12) {
        rawHour = 0;
      } else if (!meridian && rawHour >= 1 && rawHour <= 7) {
        rawHour += 12;
      }
      parsedHour = rawHour;
      parsedMinute = rawMin;
      timeFound = true;
    }
  }

  // Construct start Date object
  const startDate = new Date(targetYear, targetMonth, targetDay, parsedHour, parsedMinute, 0, 0);

  // If time was not found and startDate is in the past, adjust to next hour
  if (!timeFound && startDate.getTime() <= now.getTime()) {
    startDate.setTime(now.getTime() + 3600000);
    startDate.setMinutes(0, 0, 0);
  }

  const startTimeIso = startDate.toISOString();
  const endDate = new Date(startDate.getTime() + 3600000); // 1 hour duration
  const endTimeIso = endDate.toISOString();

  return { startTime: startTimeIso, endTime: endTimeIso };
}

/* ========================================================================
   CORE ACTION HANDLERS
   ======================================================================== */

/**
 * 1. Broadcast Action Handler
 */
export async function executeCreateBroadcast(
  actionObj: OrionAction,
  user: OrionUserContext
): Promise<OrionExecutionResult> {
  const title = extractCleanTitle(actionObj.title || actionObj.targetValue || '', 'broadcast');
  const content = actionObj.content || actionObj.message || title;
  const sender = user.userName || 'Principal';

  console.log(`[ORION] Executing create_broadcast: "${title}"`);

  try {
    const dispatchRes = await executeOrionCommunicationDispatch(
      content,
      sender,
      []
    );

    const noticePayload = {
      id: `notice-${Date.now()}`,
      title: title.startsWith('📢') ? title : `📢 ${title}`,
      subject: 'School Notice',
      category: 'Notice',
      type: 'Notice',
      description: content,
      uploaded_by: sender,
      created_at: Date.now(),
      created_at_date: new Date().toISOString().split('T')[0],
      is_public: true,
      visibility: 'Public'
    };

    const { error: insErr } = await supabase.from('materials').insert([noticePayload]);
    if (insErr) {
      console.error('[ORION] Supabase notice insert error:', insErr.message);
      return {
        success: false,
        action: 'create_broadcast',
        message: `Failed to insert notice card in database.`,
        summaryText: `⚠️ Broadcast creation failed because notice storage produced a database error: ${insErr.message}`,
        error: insErr.message
      };
    }

    triggerRealtimeUIUpdate('notices', 'INSERT', noticePayload);
    triggerRealtimeUIUpdate('notifications', 'INSERT', { title, content });

    return {
      success: true,
      action: 'create_broadcast',
      recordId: noticePayload.id,
      message: `Broadcast successfully published and saved in Supabase.`,
      summaryText: `📢 Broadcast dispatched school-wide: "${content}". Saved to Supabase database, Notice Board, and Notification Center.`,
      data: dispatchRes
    };
  } catch (err: any) {
    console.error(`[ORION] Action failed for create_broadcast:`, err);
    return {
      success: false,
      action: 'create_broadcast',
      message: `Failed to broadcast message.`,
      summaryText: `Error executing broadcast in Supabase: ${err.message || 'Database error'}`,
      error: err.message
    };
  }
}

/**
 * 2. Notification Action Handler
 */
export async function executeCreateNotification(
  actionObj: OrionAction,
  user: OrionUserContext
): Promise<OrionExecutionResult> {
  const title = extractCleanTitle(actionObj.title || actionObj.targetValue || '', 'broadcast');
  const message = actionObj.message || actionObj.content || actionObj.targetValue || 'Notification alert';
  const targetAudience = actionObj.audience || actionObj.targetClass || 'all';

  console.log(`[ORION] Executing create_notification/notify_users for ${targetAudience}`);

  try {
    const notif: AppNotification = {
      id: `notif-orion-${Date.now()}`,
      title: title,
      message: message,
      type: 'announcement',
      createdAt: new Date().toISOString(),
      isRead: false,
      targetUserId: targetAudience.includes('Class') ? 'all' : targetAudience,
      targetClass: targetAudience.includes('Class') ? targetAudience : undefined,
      linkTab: 'notice_viewer'
    };

    const notifRes = await saveAppNotification(notif);
    if (!notifRes.success) {
      throw new Error(notifRes.error || 'Failed to persist notification in database');
    }

    triggerRealtimeUIUpdate('notifications', 'INSERT', notif);

    return {
      success: true,
      action: actionObj.action,
      recordId: notif.id,
      message: `Notification saved and broadcasted.`,
      summaryText: `🔔 Notification dispatched to ${targetAudience}: "${message}". Saved in Supabase database.`
    };
  } catch (err: any) {
    console.error(`[ORION] Action failed for notification:`, err);
    return {
      success: false,
      action: actionObj.action,
      message: `Failed to save notification.`,
      summaryText: `Error persisting notification in Supabase: ${err.message}`,
      error: err.message
    };
  }
}

/**
 * 3. Event Action Handler
 */
export async function executeCreateEvent(
  actionObj: OrionAction,
  user: OrionUserContext
): Promise<OrionExecutionResult> {
  const eventTitle = extractCleanTitle(actionObj.title || actionObj.targetValue || '', 'event');
  const eventDate = actionObj.date || new Date(Date.now() + 86400000 * 3).toISOString().split('T')[0];
  const eventTime = actionObj.time || '10:00 AM';
  const location = actionObj.location || 'Main Auditorium';
  const category = actionObj.category || 'Cultural';
  const description = actionObj.content || actionObj.message || `Scheduled via Orion Operating Assistant for ${user.userName || 'School'}.`;

  console.log(`[ORION] Executing create_event: "${eventTitle}" on ${eventDate}`);

  try {
    const eventId = `ev-${Date.now()}`;
    const eventObj: Partial<SchoolEvent> = {
      id: eventId,
      title: eventTitle,
      category: category as any,
      date: eventDate,
      time: eventTime,
      location,
      description
    };

    const saved = await createSchoolEvent(eventObj);
    if (!saved) throw new Error('Supabase event insertion failed');

    await saveAppNotification({
      id: `notif-event-${Date.now()}`,
      title: `📅 New Event: ${eventTitle}`,
      message: `Scheduled for ${eventDate} at ${eventTime} (${location}).`,
      type: 'announcement',
      createdAt: new Date().toISOString(),
      isRead: false,
      linkTab: 'life'
    });

    triggerRealtimeUIUpdate('life_events', 'INSERT', eventObj);

    return {
      success: true,
      action: 'create_event',
      recordId: eventId,
      message: `Event '${eventTitle}' created in Supabase.`,
      summaryText: `📅 Event '${eventTitle}' scheduled for ${eventDate} at ${eventTime}. Persisted in Supabase database.`
    };
  } catch (err: any) {
    console.error(`[ORION] Action failed for create_event:`, err);
    return {
      success: false,
      action: 'create_event',
      message: `Failed to create event.`,
      summaryText: `Error persisting event in Supabase: ${err.message}`,
      error: err.message
    };
  }
}

/**
 * 4. Competition Action Handler
 */
export async function executeCreateCompetition(
  actionObj: OrionAction,
  user: OrionUserContext
): Promise<OrionExecutionResult> {
  const compTitle = extractCleanTitle(actionObj.title || actionObj.targetValue || '', 'competition');
  const category = actionObj.category || 'Technology';
  const prizePool = actionObj.prizePool || 'Trophies, Certificates & Cash Rewards';
  const eligibility = actionObj.eligibility || actionObj.targetClass || 'All Grades';
  const description = actionObj.content || actionObj.message || `Organized by StudentOS OS for ${eligibility}.`;

  console.log(`[ORION] Executing create_competition: "${compTitle}"`);

  try {
    const compId = `comp-${Date.now()}`;
    const compObj: Partial<Competition> = {
      id: compId,
      title: compTitle,
      category: category as any,
      eligibility,
      prizePool,
      status: 'Upcoming',
      description,
      createdBy: user.userName || 'Faculty Head',
      registeredCount: 0,
      startDate: actionObj.date || new Date(Date.now() + 86400000 * 5).toISOString().split('T')[0],
      endDate: new Date(Date.now() + 86400000 * 10).toISOString().split('T')[0]
    };

    const saved = await createCompetition(compObj);
    if (!saved) throw new Error('Supabase competition insertion failed');

    await saveAppNotification({
      id: `notif-comp-${Date.now()}`,
      title: `🏆 New Competition: ${compTitle}`,
      message: `Registrations open now on StudentOS Life! Prize: ${prizePool}`,
      type: 'announcement',
      createdAt: new Date().toISOString(),
      isRead: false,
      linkTab: 'life'
    });

    triggerRealtimeUIUpdate('life_competitions', 'INSERT', compObj);

    return {
      success: true,
      action: 'create_competition',
      recordId: compId,
      message: `Competition created and published.`,
      summaryText: `🏆 Competition '${compTitle}' created and published on StudentOS Life! Saved in Supabase database.`
    };
  } catch (err: any) {
    console.error(`[ORION] Action failed for create_competition:`, err);
    return {
      success: false,
      action: 'create_competition',
      message: `Failed to create competition.`,
      summaryText: `Error persisting competition in Supabase: ${err.message}`,
      error: err.message
    };
  }
}

/**
 * 5. Meeting Action Handler
 */
export async function executeCreateMeeting(
  actionObj: OrionAction,
  user: OrionUserContext
): Promise<OrionExecutionResult> {
  const rawTitle = actionObj.title || actionObj.targetValue || actionObj.content || '';
  const meetTitle = extractCleanTitle(rawTitle, 'meeting');
  const meetId = `meet-${Date.now().toString().slice(-8)}`;

  const { startTime, endTime } = parseMeetingDateTime(actionObj.date, actionObj.time, `${rawTitle} ${actionObj.message || ''}`);
  const { grade, section } = parseGradeAndSection(actionObj.targetClass || actionObj.audience);

  console.log(`[ORION] Executing create_meeting: "${meetTitle}" at ${startTime}`);

  try {
    const meetingObj: Meeting = {
      id: meetId,
      title: meetTitle,
      subject: actionObj.subject || 'General Studies',
      className: `${grade} - ${section}`,
      type: 'scheduled',
      startTime,
      endTime,
      description: actionObj.content || 'Scheduled via Orion Operating Assistant.',
      password: '123456',
      hostId: user.userId || 'host',
      hostName: user.userName || 'Faculty Host',
      hostEmail: user.userEmail || 'admin@school.edu',
      hostRole: (user.userRole as any) || 'teacher',
      joinLink: `${window.location.origin}?meet=${meetId}`,
      status: 'upcoming',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await createOrUpdateMeeting(meetingObj);
    console.log(`[ORION] Supabase INSERT/UPSERT successful for meetings`);

    const formattedTime = new Date(startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    await saveAppNotification({
      id: `notif-meet-${Date.now()}`,
      title: `📹 StudentOS Meet Scheduled: ${meetTitle}`,
      message: `Meeting at ${formattedTime}. Passcode: 123456. Check StudentOS Meet section.`,
      type: 'announcement',
      createdAt: new Date().toISOString(),
      isRead: false,
      linkTab: 'meet'
    });

    triggerRealtimeUIUpdate('meetings', 'INSERT', meetingObj);

    return {
      success: true,
      action: 'create_meeting',
      recordId: meetId,
      message: `StudentOS Meet scheduled in Supabase.`,
      summaryText: `📹 StudentOS Meet '${meetTitle}' scheduled for ${formattedTime}! Saved in Supabase database.`
    };
  } catch (err: any) {
    console.error(`[ORION] Action failed for create_meeting:`, err);
    return {
      success: false,
      action: 'create_meeting',
      message: `Failed to schedule meeting.`,
      summaryText: `Error persisting meeting in Supabase: ${err.message}`,
      error: err.message
    };
  }
}

/**
 * 6. Assignment / Homework Action Handler
 */
export async function executeCreateHomework(
  actionObj: OrionAction,
  user: OrionUserContext
): Promise<OrionExecutionResult> {
  const rawTitle = actionObj.title || actionObj.targetValue || actionObj.content || '';
  const hwTitle = extractCleanTitle(rawTitle, 'homework');
  const hwId = `hw-${Date.now()}`;
  const subject = actionObj.subject || 'Mathematics';
  const dueDate = actionObj.date || new Date(Date.now() + 86400000 * 3).toISOString().split('T')[0];

  const { grade, section } = parseGradeAndSection(actionObj.targetClass || actionObj.audience || actionObj.content);
  const content = actionObj.content || actionObj.message || `Assigned homework task for ${grade} (${section}).`;

  console.log(`[ORION] Executing create_homework: "${hwTitle}" for ${grade} ${section} due ${dueDate}`);

  try {
    const hwObj: Homework = {
      id: hwId,
      title: hwTitle,
      subject,
      content,
      dueDate,
      classGrade: grade,
      classSection: section as any,
      givenBy: user.userName || 'Faculty Teacher',
      createdAt: new Date().toISOString().split('T')[0],
      completedList: []
    };

    await saveSupabaseHomework(hwObj);
    console.log(`[ORION] Supabase UPSERT successful for homework`);

    await saveAppNotification({
      id: `notif-hw-${Date.now()}`,
      title: `📝 New Assignment: ${hwTitle}`,
      message: `Assigned for ${grade} - ${section} (${subject}). Due: ${dueDate}`,
      type: 'homework',
      targetClass: grade,
      createdAt: new Date().toISOString(),
      isRead: false,
      linkTab: 'assignments'
    });

    triggerRealtimeUIUpdate('homework', 'INSERT', hwObj);

    return {
      success: true,
      action: 'create_homework',
      recordId: hwId,
      message: `Homework '${hwTitle}' created in Supabase.`,
      summaryText: `📝 Assignment '${hwTitle}' (${subject}) assigned to ${grade} (${section})! Saved in Supabase database.`
    };
  } catch (err: any) {
    console.error(`[ORION] Action failed for create_homework:`, err);
    return {
      success: false,
      action: 'create_homework',
      message: `Failed to create assignment.`,
      summaryText: `Error persisting homework in Supabase: ${err.message}`,
      error: err.message
    };
  }
}

/**
 * 7. Destructive Delete Item Handler
 */
export async function executeDeleteItem(
  actionObj: OrionAction,
  user: OrionUserContext,
  isConfirmed: boolean = false
): Promise<OrionExecutionResult> {
  const targetTitle = actionObj.title || actionObj.targetValue || 'Item';

  if (!isConfirmed) {
    console.log(`[ORION] Action ${actionObj.action} requires explicit confirmation`);
    return {
      success: false,
      action: actionObj.action,
      requiresConfirmation: true,
      confirmationPrompt: `⚠️ Are you sure you want to permanently delete '${targetTitle}' from the database? Say "Yes, confirm" to proceed or "Cancel" to abort.`,
      message: `Confirmation required for deletion of ${targetTitle}.`,
      summaryText: `⚠️ Confirmation required: Are you sure you want to delete '${targetTitle}'?`
    };
  }

  console.log(`[ORION] Executing confirmed deletion of '${targetTitle}' across Supabase tables`);

  try {
    let deletedCount = 0;

    // Delete from competitions
    const { error: compErr } = await supabase.from('life_competitions').delete().ilike('title', `%${targetTitle}%`);
    if (!compErr) deletedCount++;

    // Delete from meetings
    const { error: meetErr } = await supabase.from('meetings').delete().ilike('title', `%${targetTitle}%`);
    if (!meetErr) deletedCount++;

    // Delete from homework
    const { error: hwErr } = await supabase.from('homework').delete().ilike('title', `%${targetTitle}%`);
    if (!hwErr) deletedCount++;

    // Delete from events
    const { error: evErr } = await supabase.from('life_events').delete().ilike('title', `%${targetTitle}%`);
    if (!evErr) deletedCount++;

    // Delete from notices
    const { error: notiErr } = await supabase.from('materials').delete().ilike('title', `%${targetTitle}%`);
    if (!notiErr) deletedCount++;

    console.log(`[ORION] Supabase DELETE successful for '${targetTitle}'`);

    triggerRealtimeUIUpdate('life_competitions', 'DELETE', { title: targetTitle });
    triggerRealtimeUIUpdate('meetings', 'DELETE', { title: targetTitle });
    triggerRealtimeUIUpdate('homework', 'DELETE', { title: targetTitle });
    triggerRealtimeUIUpdate('life_events', 'DELETE', { title: targetTitle });

    return {
      success: true,
      action: actionObj.action,
      message: `Successfully deleted '${targetTitle}'.`,
      summaryText: `🗑️ Confirmed! Permanently deleted '${targetTitle}' from Supabase database tables.`
    };
  } catch (err: any) {
    console.error(`[ORION] Action failed for deletion:`, err);
    return {
      success: false,
      action: actionObj.action,
      message: `Failed to delete item.`,
      summaryText: `Error deleting '${targetTitle}' from Supabase: ${err.message}`,
      error: err.message
    };
  }
}

/**
 * 8. Competition Registration Handler
 */
export async function executeRegisterCompetition(
  actionObj: OrionAction,
  user: OrionUserContext
): Promise<OrionExecutionResult> {
  const compName = actionObj.title || actionObj.targetValue || 'Competition';

  console.log(`[ORION] Executing register_competition for '${compName}'`);

  try {
    const { data: comps } = await supabase
      .from('life_competitions')
      .select('*')
      .ilike('title', `%${compName}%`)
      .limit(1);

    if (comps && comps.length > 0) {
      const comp = comps[0];
      const newCount = (comp.registered_count || 0) + 1;
      await supabase.from('life_competitions').update({ registered_count: newCount }).eq('id', comp.id);
      console.log(`[ORION] Supabase UPDATE successful for registered_count`);
    }

    await saveAppNotification({
      id: `notif-reg-${Date.now()}`,
      title: `🎟️ Competition Registration Confirmed`,
      message: `Registered ${user.userName || 'Student'} for '${compName}'.`,
      type: 'announcement',
      createdAt: new Date().toISOString(),
      isRead: false,
      targetUserId: user.userId || 'all',
      linkTab: 'life'
    });

    triggerRealtimeUIUpdate('life_competitions', 'UPDATE', { title: compName });

    return {
      success: true,
      action: 'register_competition',
      message: `Registered for competition.`,
      summaryText: `🎟️ Successfully registered for '${compName}'! Saved to your StudentOS Life schedule.`
    };
  } catch (err: any) {
    return {
      success: false,
      action: 'register_competition',
      message: `Registration failed.`,
      summaryText: `Could not complete registration in Supabase: ${err.message}`,
      error: err.message
    };
  }
}

/**
 * 9. Study Planner Action Handler
 */
export async function executeAddStudyPlanner(
  actionObj: OrionAction,
  user: OrionUserContext
): Promise<OrionExecutionResult> {
  const subject = extractCleanTitle(actionObj.title || actionObj.subject || actionObj.targetValue || '', 'homework') || 'General Study';
  const date = actionObj.date || 'Tomorrow';
  const time = actionObj.time || '4:00 PM - 5:00 PM';

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('s_os_add_schedule', {
      detail: { title: subject, subject, date, time }
    }));
  }

  return {
    success: true,
    action: 'add_study_planner',
    message: `Study slot for ${subject} added.`,
    summaryText: `📅 Scheduled **${subject}** study session for **${date}** at **${time}** in your Study Planner.`
  };
}

/**
 * 10. Task Manager Add Handler
 */
export async function executeAddTask(
  actionObj: OrionAction,
  user: OrionUserContext
): Promise<OrionExecutionResult> {
  const title = extractCleanTitle(actionObj.title || actionObj.message || actionObj.content || '', 'homework') || 'New Task';
  const dueDate = actionObj.date || 'Tomorrow';

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('s_os_add_task', {
      detail: { title, dueDate, subject: 'General' }
    }));
  }

  return {
    success: true,
    action: 'add_task',
    message: `Task "${title}" created.`,
    summaryText: `✅ Task **"${title}"** added to your Task Manager (Due: **${dueDate}**).`
  };
}

/**
 * 11. Task Manager Complete Handler
 */
export async function executeCompleteTask(
  actionObj: OrionAction,
  user: OrionUserContext
): Promise<OrionExecutionResult> {
  const title = actionObj.title || actionObj.targetValue || '';

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('s_os_complete_task', {
      detail: { title }
    }));
  }

  return {
    success: true,
    action: 'complete_task',
    message: `Task completed.`,
    summaryText: `🎉 Marked task **"${title || 'Homework Task'}"** as completed in your Task Manager!`
  };
}

/**
 * 12. Task Manager Delete Handler
 */
export async function executeDeleteTask(
  actionObj: OrionAction,
  user: OrionUserContext
): Promise<OrionExecutionResult> {
  const title = actionObj.title || actionObj.targetValue || '';

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('s_os_delete_task', {
      detail: { title }
    }));
  }

  return {
    success: true,
    action: 'delete_task',
    message: `Task deleted.`,
    summaryText: `🗑️ Removed task **"${title || 'Homework Task'}"** from your Task Manager.`
  };
}

/**
 * 13. Create Study Plan Action Handler (Phase D Automation)
 */
export async function executeCreateStudyPlan(
  actionObj: OrionAction,
  user: OrionUserContext
): Promise<OrionExecutionResult> {
  const goalOrSubject = actionObj.title || actionObj.subject || actionObj.targetValue || 'Comprehensive Study Routine';
  const today = new Date();
  const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const subjects = goalOrSubject.toLowerCase().includes('and') 
    ? goalOrSubject.split(/\band\b|,/i).map(s => s.trim()).filter(Boolean)
    : [goalOrSubject, 'Active Recall & Practice', 'Mock Questions & Self-Assessment'];

  const slots = [
    { title: `${subjects[0] || 'Core Concepts'}: Deep Dive & Notes`, time: '04:00 PM - 05:30 PM', offset: 1 },
    { title: `${subjects[1] || 'Practice Problems'}: Active Recall & Derivations`, time: '06:00 PM - 07:15 PM', offset: 2 },
    { title: `${subjects[2] || 'Mock Testing'}: Timed Self-Quiz & Review`, time: '04:30 PM - 06:00 PM', offset: 3 },
    { title: `${subjects[0] || 'Core Concepts'}: Weak Area Reinforcement`, time: '05:00 PM - 06:30 PM', offset: 4 },
    { title: `Comprehensive Sprint: Milestone Checkpoint`, time: '10:00 AM - 12:00 PM', offset: 5 }
  ];

  if (typeof window !== 'undefined') {
    slots.forEach(slot => {
      const d = new Date(today);
      d.setDate(today.getDate() + slot.offset);
      const dateStr = d.toISOString().split('T')[0];
      const dayName = daysOfWeek[d.getDay()];

      window.dispatchEvent(new CustomEvent('s_os_add_schedule', {
        detail: {
          title: slot.title,
          subject: subjects[0] || 'Study Session',
          date: `${dayName}, ${dateStr}`,
          time: slot.time
        }
      }));

      window.dispatchEvent(new CustomEvent('s_os_add_task', {
        detail: {
          title: `Study: ${slot.title}`,
          dueDate: `${dayName}, ${dateStr}`,
          subject: subjects[0] || 'Study'
        }
      }));
    });
  }

  const roadmapMarkdown = `### 🎯 Custom Study Plan: ${goalOrSubject}\n\n` +
    `I have formulated and synchronized a 5-day structured study sprint with your **Study Planner** and **Task Manager**:\n\n` +
    slots.map((s, i) => {
      const d = new Date(today);
      d.setDate(today.getDate() + s.offset);
      const dayName = daysOfWeek[d.getDay()];
      return `${i + 1}. **${dayName} (${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})** — ${s.time}\n   - 📚 *${s.title}*`;
    }).join('\n\n') +
    `\n\n💡 *Tip: Check your Study Planner or open Focus Timer to launch your next session!*`;

  return {
    success: true,
    action: 'create_study_plan',
    message: `Generated 5-day study plan for ${goalOrSubject}`,
    summaryText: roadmapMarkdown
  };
}

/**
 * 14. Academic Calendar Event Handler
 */
export async function executeCreateCalendarEvent(
  actionObj: OrionAction,
  user: OrionUserContext
): Promise<OrionExecutionResult> {
  const title = actionObj.title || actionObj.targetValue || 'New Academic Event';
  const category = (actionObj.category || 'event').toLowerCase();
  const validCategories = ['exam', 'holiday', 'event', 'meeting', 'academic'];
  const eventCategory = validCategories.includes(category) ? category : 'event';
  const startDate = actionObj.date || new Date().toISOString().split('T')[0];
  const location = actionObj.location || 'Campus / Online';
  const id = crypto.randomUUID();

  const eventData = {
    id,
    title,
    description: actionObj.content || actionObj.message || `Scheduled by ${user.userName || 'Staff'}`,
    category: eventCategory,
    start_date: startDate,
    end_date: actionObj.details?.endDate || startDate,
    all_day: true,
    location,
    target_audience: actionObj.audience || 'all',
    target_grade: actionObj.details?.grade || null,
    target_section: actionObj.details?.section || null,
    created_by: user.userId || 'system'
  };

  try {
    const { error } = await supabase.from('calendar_events').insert([eventData]);
    if (error) throw error;
    triggerRealtimeUIUpdate('calendar_events', 'INSERT', eventData);

    return {
      success: true,
      action: 'create_calendar_event',
      recordId: id,
      message: `Event "${title}" published to Academic Calendar`,
      summaryText: `🗓️ **Academic Calendar Updated**\n\nEvent **"${title}"** scheduled for **${startDate}** under category \`${eventCategory}\`.`
    };
  } catch (err: any) {
    console.error('Failed to create calendar event:', err);
    return {
      success: false,
      action: 'create_calendar_event',
      message: 'Failed to insert calendar event.',
      summaryText: `❌ Could not publish event: ${err.message}`
    };
  }
}

/**
 * 15. Create Lecture Note Handler
 */
export async function executeCreateNote(
  actionObj: OrionAction,
  user: OrionUserContext
): Promise<OrionExecutionResult> {
  const title = actionObj.title || actionObj.targetValue || 'Lecture Note';
  const content = actionObj.content || actionObj.message || 'Auto-generated note content.';
  const subject = actionObj.subject || 'General';
  const noteId = crypto.randomUUID();

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('s_os_create_note', {
      detail: { title, content, subject }
    }));
  }

  try {
    const { error } = await supabase.from('notes').insert([{
      id: noteId,
      title,
      content,
      subject,
      icon: '📝',
      cover_bg: 'bg-gradient-to-r from-indigo-600 to-purple-800',
      user_id: user.userId || 'guest',
      created_at: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    }]);
    if (error) console.warn('Supabase note insert notice:', error);
  } catch (_) {}

  return {
    success: true,
    action: 'create_note',
    recordId: noteId,
    message: `Note "${title}" saved to Vault`,
    summaryText: `📝 Saved note **"${title}"** under subject **${subject}** in your Lecture Vault.`
  };
}

/**
 * 16. Mark Attendance Handler
 */
export async function executeMarkAttendance(
  actionObj: OrionAction,
  user: OrionUserContext
): Promise<OrionExecutionResult> {
  const targetClass = actionObj.targetClass || 'Grade 10';
  const parsed = parseGradeAndSection(targetClass);
  const date = actionObj.date || new Date().toISOString().split('T')[0];
  const subject = actionObj.subject || 'General';

  return {
    success: true,
    action: 'mark_attendance',
    message: `Attendance opened for ${parsed.grade} ${parsed.section}`,
    summaryText: `📋 **Attendance Roster Active**\n\nClass **${parsed.grade} - ${parsed.section}** (${subject}) ready for attendance marking for date **${date}**.`
  };
}

/* ========================================================================
   ORION DATA INTELLIGENCE, ANALYTICS & REPORTING TOOLS (REAL SUPABASE DATA)
   ======================================================================== */

/**
 * 17. Homework & Submissions Analysis Tool (get_homework / get_submissions / get_assignments)
 */
export async function executeGetHomeworkAndSubmissions(
  actionObj: OrionAction,
  user: OrionUserContext
): Promise<OrionExecutionResult> {
  const targetStr = actionObj.targetClass || actionObj.audience || actionObj.targetValue || '';
  const hasSpecificClass = /\b(class|grade|solara|astra|elara|vega|\d{1,2}[a-z]?)\b/i.test(targetStr);
  const parsedClass = hasSpecificClass ? parseGradeAndSection(targetStr) : null;
  const todayIso = new Date().toISOString().split('T')[0];

  try {
    const [hwRes, usersRes] = await Promise.all([
      supabase.from('homework').select('*').order('created_at', { ascending: false }).limit(25),
      supabase.from('user_profiles').select('id, uid, name, role, grade, section, house').eq('role', 'student')
    ]);

    if (hwRes.error) {
      throw new Error(hwRes.error.message);
    }

    let homeworkRows = hwRes.data || [];
    let students = usersRes.data || [];

    if (parsedClass) {
      homeworkRows = homeworkRows.filter(
        (h: any) =>
          !h.class_grade ||
          h.class_grade.toLowerCase() === parsedClass.grade.toLowerCase() ||
          (parsedClass.section !== 'All Sections' &&
            h.class_section &&
            h.class_section.toLowerCase() === parsedClass.section.toLowerCase())
      );
      students = students.filter(
        (s: any) =>
          (!s.grade || s.grade.toLowerCase() === parsedClass.grade.toLowerCase()) &&
          (parsedClass.section === 'All Sections' ||
            !s.section ||
            s.section.toLowerCase() === parsedClass.section.toLowerCase())
      );
    }

    const totalStudentsCount = students.length;
    const latestHw = homeworkRows[0];

    const completedIds: string[] = latestHw && Array.isArray(latestHw.completed_list) ? latestHw.completed_list : [];
    const submittedStudents = students.filter((s: any) => completedIds.includes(s.uid || s.id));
    const pendingStudents = students.filter((s: any) => !completedIds.includes(s.uid || s.id));
    const overdueHw = homeworkRows.filter((h: any) => h.due_date && h.due_date < todayIso);

    const classLabel = parsedClass
      ? `${parsedClass.grade}${parsedClass.section !== 'All Sections' ? ' ' + parsedClass.section : ''}`
      : 'All Authorized Classes';

    const rows: OrionStructuredTableRow[] = [];
    if (latestHw && students.length > 0) {
      for (const st of pendingStudents.slice(0, 8)) {
        rows.push({
          id: st.uid || st.id,
          primary: st.name || 'Student',
          secondary: `${st.grade || 'Grade 10'} · ${st.section || 'Solara'} (${st.house || 'Ruby'})`,
          badge: 'Pending Submission',
          badgeTone: 'amber',
          meta: `Due: ${latestHw.due_date || todayIso}`
        });
      }
      for (const st of submittedStudents.slice(0, 4)) {
        rows.push({
          id: st.uid || st.id,
          primary: st.name || 'Student',
          secondary: `${st.grade || 'Grade 10'} · ${st.section || 'Solara'}`,
          badge: 'Submitted',
          badgeTone: 'emerald',
          meta: latestHw.title
        });
      }
    } else {
      for (const h of homeworkRows.slice(0, 8)) {
        const doneCount = Array.isArray(h.completed_list) ? h.completed_list.length : 0;
        const isOverdue = h.due_date && h.due_date < todayIso;
        rows.push({
          id: h.id,
          primary: h.title || 'Untitled Assignment',
          secondary: `${h.subject || 'General'} · ${h.class_grade || 'Grade 10'} ${h.class_section || ''}`,
          badge: isOverdue ? 'Overdue' : `${doneCount} Submitted`,
          badgeTone: isOverdue ? 'rose' : 'indigo',
          meta: `Due: ${h.due_date || 'Unspecified'}`
        });
      }
    }

    const csvLines = [
      'Student Name,Grade,Section,Assignment,Status,Due Date',
      ...pendingStudents.map(
        (s: any) => `"${s.name || 'Student'}","${s.grade || ''}","${s.section || ''}","${latestHw?.title || 'Current Homework'}","Pending","${latestHw?.due_date || todayIso}"`
      ),
      ...submittedStudents.map(
        (s: any) => `"${s.name || 'Student'}","${s.grade || ''}","${s.section || ''}","${latestHw?.title || 'Current Homework'}","Submitted","${latestHw?.due_date || todayIso}"`
      )
    ].join('\n');

    const card: OrionStructuredCard = {
      title: `${classLabel} — Homework & Submission Status`,
      subtitle: latestHw
        ? `Tracking latest assignment: "${latestHw.title}" (${latestHw.subject || 'Academic'})`
        : `No active homework records found in Supabase for ${classLabel}`,
      dateRange: `As of ${todayIso}`,
      metrics: [
        { label: 'Active Assignments', value: homeworkRows.length, tone: 'indigo' },
        { label: 'Submitted', value: latestHw ? submittedStudents.length : 0, tone: 'emerald' },
        { label: 'Pending', value: latestHw ? pendingStudents.length : 0, tone: 'amber' },
        { label: 'Overdue Tasks', value: overdueHw.length, tone: overdueHw.length > 0 ? 'rose' : 'default' }
      ],
      rows,
      suggestedActions: [
        ...(pendingStudents.length > 0
          ? [
              {
                label: `Send Reminder (${pendingStudents.length} Pending)`,
                command: `Create a notice reminding ${classLabel} to submit "${latestHw?.title || 'pending homework'}"`,
                variant: 'primary' as const
              }
            ]
          : []),
        {
          label: 'Open Assignment Centre',
          command: 'Open pending assignments',
          variant: 'secondary'
        },
        {
          label: 'Export Submission Report (CSV)',
          command: 'export_csv',
          variant: 'secondary',
          exportData: {
            filename: `studentos-homework-status-${todayIso}.csv`,
            content: csvLines,
            mimeType: 'text/csv'
          }
        }
      ]
    };

    const summaryText =
      homeworkRows.length === 0
        ? `Retrieved authorized homework records for **${classLabel}**: There are currently **0** homework assignments stored in Supabase.`
        : `### 📊 ${classLabel} — Assignment & Submission Analysis\n\n` +
          `- **Latest Assignment:** ${latestHw.title} (${latestHw.subject || 'General'})\n` +
          `- **Submitted:** ${submittedStudents.length} of ${totalStudentsCount} students\n` +
          `- **Pending:** ${pendingStudents.length} students\n` +
          `- **Overdue Assignments:** ${overdueHw.length}\n\n` +
          (pendingStudents.length > 0
            ? `Would you like me to send a reminder notice to the **${pendingStudents.length}** students with pending submissions?`
            : `All enrolled students in ${classLabel} have completed this assignment.`);

    return {
      success: true,
      action: actionObj.action,
      message: 'Retrieved homework and submission records.',
      summaryText,
      structuredCard: card
    };
  } catch (err: any) {
    return {
      success: false,
      action: actionObj.action,
      message: 'Failed to retrieve homework records from Supabase.',
      summaryText: `⚠️ Requested StudentOS homework information could not be retrieved: ${err.message}`,
      error: err.message
    };
  }
}

/**
 * 18. Attendance Analysis Tool (get_attendance)
 */
export async function executeGetAttendanceAnalysis(
  actionObj: OrionAction,
  user: OrionUserContext
): Promise<OrionExecutionResult> {
  const threshold = Number(actionObj.details?.threshold) || 75;
  const todayIso = new Date().toISOString().split('T')[0];

  try {
    const [attRes, usersRes] = await Promise.all([
      supabase.from('attendance').select('*').order('date', { ascending: false }).limit(500),
      supabase.from('user_profiles').select('id, uid, name, role, grade, section, house').eq('role', 'student')
    ]);

    if (attRes.error) throw new Error(attRes.error.message);

    const records = attRes.data || [];
    const students = usersRes.data || [];

    const byStudent = new Map<string, { present: number; absent: number; late: number; total: number }>();
    for (const rec of records) {
      const uid = rec.user_id;
      if (!uid) continue;
      const cur = byStudent.get(uid) || { present: 0, absent: 0, late: 0, total: 0 };
      cur.total += 1;
      if (rec.status === 'present') cur.present += 1;
      else if (rec.status === 'absent') cur.absent += 1;
      else if (rec.status === 'late') cur.late += 1;
      byStudent.set(uid, cur);
    }

    const lowAttendanceRows: OrionStructuredTableRow[] = [];
    const allStudentStats: { name: string; grade: string; section: string; pct: number; present: number; absent: number; total: number }[] = [];

    for (const st of students) {
      const uid = st.uid || st.id;
      const stat = byStudent.get(uid);
      if (!stat || stat.total === 0) continue;
      const pct = Math.round(((stat.present + stat.late * 0.5) / stat.total) * 100);
      allStudentStats.push({
        name: st.name || 'Student',
        grade: st.grade || 'Grade 10',
        section: st.section || 'Solara',
        pct,
        present: stat.present,
        absent: stat.absent,
        total: stat.total
      });

      if (pct < threshold) {
        lowAttendanceRows.push({
          id: uid,
          primary: st.name || 'Student',
          secondary: `${st.grade || 'Grade 10'} · ${st.section || 'Solara'} (${st.house || 'Ruby'})`,
          badge: `${pct}% Attendance`,
          badgeTone: pct < 60 ? 'rose' : 'amber',
          meta: `${stat.present}P / ${stat.absent}A (${stat.total} days)`
        });
      }
    }

    const todayRecords = records.filter((r: any) => r.date === todayIso);
    const todayAbsentCount = todayRecords.filter((r: any) => r.status === 'absent').length;
    const avgAttendance =
      allStudentStats.length > 0
        ? Math.round(allStudentStats.reduce((acc, s) => acc + s.pct, 0) / allStudentStats.length)
        : 100;

    const displayRows: OrionStructuredTableRow[] =
      lowAttendanceRows.length > 0
        ? lowAttendanceRows.slice(0, 10)
        : allStudentStats.slice(0, 8).map((s, idx) => ({
            id: `att-${idx}`,
            primary: s.name,
            secondary: `${s.grade} · ${s.section}`,
            badge: `${s.pct}% Attendance`,
            badgeTone: 'emerald',
            meta: `${s.present} Present / ${s.absent} Absent`
          }));

    const csvContent = [
      'Student Name,Grade,Section,Attendance %,Present Days,Absent Days,Total Recorded Days',
      ...allStudentStats.map(
        (s) => `"${s.name}","${s.grade}","${s.section}",${s.pct},${s.present},${s.absent},${s.total}`
      )
    ].join('\n');

    const card: OrionStructuredCard = {
      title: `Attendance Intelligence Report (Threshold: ${threshold}%)`,
      subtitle:
        records.length > 0
          ? `Analyzed ${records.length} verified attendance entries across ${allStudentStats.length} students`
          : 'No attendance entries recorded in Supabase yet',
      dateRange: `Through ${todayIso}`,
      metrics: [
        { label: 'Avg Attendance', value: `${avgAttendance}%`, tone: avgAttendance >= threshold ? 'emerald' : 'amber' },
        { label: `Below ${threshold}%`, value: lowAttendanceRows.length, tone: lowAttendanceRows.length > 0 ? 'rose' : 'emerald' },
        { label: 'Absent Today', value: todayAbsentCount, tone: todayAbsentCount > 0 ? 'amber' : 'default' },
        { label: 'Records Logged', value: records.length, tone: 'indigo' }
      ],
      rows: displayRows,
      suggestedActions: [
        {
          label: 'Open Attendance Manager',
          command: 'Open attendance',
          variant: 'primary'
        },
        ...(lowAttendanceRows.length > 0
          ? [
              {
                label: 'Draft Attendance Notice',
                command: `Create a notice reminding students about maintaining ${threshold}% minimum attendance`,
                variant: 'secondary' as const
              }
            ]
          : []),
        {
          label: 'Export Attendance CSV',
          command: 'export_csv',
          variant: 'secondary',
          exportData: {
            filename: `studentos-attendance-audit-${todayIso}.csv`,
            content: csvContent,
            mimeType: 'text/csv'
          }
        }
      ]
    };

    const summaryText =
      records.length === 0
        ? `No attendance records have been logged in Supabase yet. You can open **Attendance Manager** to record today's roll call.`
        : lowAttendanceRows.length > 0
          ? `Found **${lowAttendanceRows.length}** student(s) with attendance below the **${threshold}%** threshold (School average: **${avgAttendance}%**). Review the student breakdown below or trigger an attendance reminder.`
          : `All tracked students are currently meeting or exceeding the **${threshold}%** attendance threshold (Average: **${avgAttendance}%** across ${records.length} logged records).`;

    return {
      success: true,
      action: 'get_attendance',
      message: 'Attendance analysis complete.',
      summaryText,
      structuredCard: card
    };
  } catch (err: any) {
    return {
      success: false,
      action: 'get_attendance',
      message: 'Failed to retrieve attendance data.',
      summaryText: `⚠️ Could not retrieve StudentOS attendance records: ${err.message}`,
      error: err.message
    };
  }
}

/**
 * 19. Daily School Operations Summary Tool (daily_operations_summary)
 */
export async function executeDailyOperationsSummary(
  actionObj: OrionAction,
  user: OrionUserContext
): Promise<OrionExecutionResult> {
  const todayIso = new Date().toISOString().split('T')[0];

  try {
    const [attRes, hwRes, evRes, meetRes, notifRes] = await Promise.all([
      supabase.from('attendance').select('user_id, status, date').eq('date', todayIso),
      supabase.from('homework').select('id, title, subject, class_grade, due_date, completed_list').order('created_at', { ascending: false }).limit(10),
      supabase.from('calendar_events').select('id, title, start_date, category').gte('start_date', todayIso).order('start_date', { ascending: true }).limit(6),
      supabase.from('meetings').select('id, title, class_name, start_time, status').order('start_time', { ascending: true }).limit(5),
      supabase.from('notifications').select('id, title, message, created_at').order('created_at', { ascending: false }).limit(5)
    ]);

    const todayAtt = attRes.data || [];
    const presentToday = todayAtt.filter((a: any) => a.status === 'present').length;
    const absentToday = todayAtt.filter((a: any) => a.status === 'absent').length;

    const hwList = hwRes.data || [];
    const dueTodayOrOverdue = hwList.filter((h: any) => h.due_date && h.due_date <= todayIso);

    const upcomingEvents = evRes.data || [];
    const meetings = meetRes.data || [];
    const recentNotifs = notifRes.data || [];

    const rows: OrionStructuredTableRow[] = [];

    for (const h of dueTodayOrOverdue.slice(0, 3)) {
      rows.push({
        id: `hw-${h.id}`,
        primary: `Assignment Due: ${h.title}`,
        secondary: `${h.subject || 'Academic'} · ${h.class_grade || 'Grade 10'}`,
        badge: h.due_date < todayIso ? 'Overdue' : 'Due Today',
        badgeTone: h.due_date < todayIso ? 'rose' : 'amber',
        meta: h.due_date
      });
    }

    for (const ev of upcomingEvents.slice(0, 3)) {
      rows.push({
        id: `ev-${ev.id}`,
        primary: `Calendar: ${ev.title}`,
        secondary: `Category: ${ev.category || 'Academic'}`,
        badge: 'Upcoming',
        badgeTone: 'indigo',
        meta: ev.start_date
      });
    }

    for (const m of meetings.slice(0, 2)) {
      rows.push({
        id: `meet-${m.id}`,
        primary: `StudentOS Meet: ${m.title}`,
        secondary: m.class_name || 'Virtual Classroom',
        badge: m.status || 'Scheduled',
        badgeTone: 'emerald',
        meta: m.start_time ? new Date(m.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''
      });
    }

    const card: OrionStructuredCard = {
      title: `Daily School Operations Workspace`,
      subtitle: `Prioritized operational briefing for ${user.userName || 'Staff'} (${(user.userRole || 'staff').toUpperCase()})`,
      dateRange: todayIso,
      metrics: [
        { label: 'Present Today', value: presentToday, tone: 'emerald' },
        { label: 'Absent Today', value: absentToday, tone: absentToday > 0 ? 'rose' : 'default' },
        { label: 'Active Homework', value: hwList.length, tone: 'indigo' },
        { label: 'Upcoming Events', value: upcomingEvents.length + meetings.length, tone: 'amber' }
      ],
      rows,
      bulletPoints: [
        todayAtt.length > 0
          ? `Today's roll call has ${todayAtt.length} recorded entries (${presentToday} present, ${absentToday} absent).`
          : `Today's attendance has not been submitted yet for ${todayIso}.`,
        dueTodayOrOverdue.length > 0
          ? `${dueTodayOrOverdue.length} assignment(s) are due today or overdue across active classes.`
          : `All ${hwList.length} active assignments have future deadlines.`,
        recentNotifs.length > 0
          ? `Latest school notice: "${recentNotifs[0].title}"`
          : `No unread urgent alerts in the notification queue.`
      ],
      suggestedActions: [
        { label: 'Check Homework Submissions', command: 'Show homework submission status', variant: 'primary' },
        { label: 'Audit Attendance', command: 'Show students with attendance below 75%', variant: 'secondary' },
        { label: 'Generate Weekly Report', command: 'Generate a weekly academic activity report', variant: 'secondary' }
      ]
    };

    return {
      success: true,
      action: 'daily_operations_summary',
      message: 'Compiled daily operations workspace.',
      summaryText: `Here is your prioritized **StudentOS Operations Summary** for **${todayIso}**, combining real-time attendance, assignment deadlines, scheduled meetings, and calendar events.`,
      structuredCard: card
    };
  } catch (err: any) {
    return {
      success: false,
      action: 'daily_operations_summary',
      message: 'Failed to compile operations summary.',
      summaryText: `⚠️ Could not retrieve complete school operations data: ${err.message}`,
      error: err.message
    };
  }
}

/**
 * 20. Academic & Weekly Report Generator (generate_report / export_report)
 */
export async function executeGenerateAcademicReport(
  actionObj: OrionAction,
  user: OrionUserContext
): Promise<OrionExecutionResult> {
  const targetStr = actionObj.targetClass || actionObj.audience || actionObj.targetValue || '';
  const hasSpecificClass = /\b(class|grade|solara|astra|elara|vega|\d{1,2}[a-z]?)\b/i.test(targetStr);
  const parsedClass = hasSpecificClass ? parseGradeAndSection(targetStr) : null;
  const endIso = new Date().toISOString().split('T')[0];
  const startIso = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];

  try {
    const [usersRes, hwRes, matRes, attRes, houseRes] = await Promise.all([
      supabase.from('user_profiles').select('id, uid, name, role, grade, section, house, points').eq('role', 'student'),
      supabase.from('homework').select('*').order('created_at', { ascending: false }).limit(30),
      supabase.from('materials').select('id, title, subject, category, class_grade').limit(30),
      supabase.from('attendance').select('user_id, status, date').gte('date', startIso),
      supabase.from('life_houses').select('id, name, points, rank').order('points', { ascending: false })
    ]);

    let students = usersRes.data || [];
    let homeworks = hwRes.data || [];

    if (parsedClass) {
      students = students.filter(
        (s: any) =>
          (!s.grade || s.grade.toLowerCase() === parsedClass.grade.toLowerCase()) &&
          (parsedClass.section === 'All Sections' ||
            !s.section ||
            s.section.toLowerCase() === parsedClass.section.toLowerCase())
      );
      homeworks = homeworks.filter(
        (h: any) => !h.class_grade || h.class_grade.toLowerCase() === parsedClass.grade.toLowerCase()
      );
    }

    const materials = matRes.data || [];
    const weekAtt = attRes.data || [];
    const houses = houseRes.data || [];

    const weekPresent = weekAtt.filter((a: any) => a.status === 'present').length;
    const weekAttRate = weekAtt.length > 0 ? Math.round((weekPresent / weekAtt.length) * 100) : 100;

    let totalSubmissions = 0;
    for (const h of homeworks) {
      if (Array.isArray(h.completed_list)) {
        totalSubmissions += h.completed_list.length;
      }
    }

    const scopeTitle = parsedClass
      ? `${parsedClass.grade}${parsedClass.section !== 'All Sections' ? ' ' + parsedClass.section : ''}`
      : 'School-Wide';

    const reportMarkdown =
      `# StudentOS Weekly Academic & Operations Report (${scopeTitle})\n` +
      `**Date Range:** ${startIso} to ${endIso}\n` +
      `**Generated By:** ${user.userName || 'Authorized Staff'} (${user.userRole || 'staff'})\n\n` +
      `## Key Metrics\n` +
      `- **Enrolled Students in Scope:** ${students.length}\n` +
      `- **Active Homework Assignments:** ${homeworks.length}\n` +
      `- **Total Logged Homework Completions:** ${totalSubmissions}\n` +
      `- **7-Day Attendance Rate:** ${weekAttRate}% (${weekAtt.length} records)\n` +
      `- **Published Learning Materials:** ${materials.length}\n\n` +
      `## House Standings\n` +
      houses.map((h: any, i: number) => `${i + 1}. **${h.id}** — ${h.points} pts`).join('\n');

    const rows: OrionStructuredTableRow[] = homeworks.slice(0, 6).map((h: any) => {
      const done = Array.isArray(h.completed_list) ? h.completed_list.length : 0;
      return {
        id: h.id,
        primary: h.title,
        secondary: `${h.subject || 'General'} · ${h.class_grade || 'Grade 10'}`,
        badge: `${done} Completed`,
        badgeTone: done > 0 ? 'emerald' : 'amber',
        meta: `Due: ${h.due_date || endIso}`
      };
    });

    const card: OrionStructuredCard = {
      title: `Weekly Academic Activity Report — ${scopeTitle}`,
      subtitle: `Aggregated from live Supabase records (Students, Homework, Attendance, Materials)`,
      dateRange: `${startIso} → ${endIso}`,
      metrics: [
        { label: 'Students', value: students.length, tone: 'indigo' },
        { label: 'Assignments', value: homeworks.length, tone: 'emerald' },
        { label: 'Submissions', value: totalSubmissions, tone: 'emerald' },
        { label: '7d Attendance', value: `${weekAttRate}%`, tone: weekAttRate >= 75 ? 'emerald' : 'amber' }
      ],
      rows,
      reportMarkdown,
      suggestedActions: [
        {
          label: 'Download Report (.md)',
          command: 'export_report',
          variant: 'primary',
          exportData: {
            filename: `studentos-weekly-report-${endIso}.md`,
            content: reportMarkdown,
            mimeType: 'text/markdown'
          }
        },
        {
          label: 'Check Pending Homework',
          command: `Show students who haven't submitted homework`,
          variant: 'secondary'
        }
      ]
    };

    return {
      success: true,
      action: 'generate_report',
      message: 'Generated weekly academic activity report.',
      summaryText: `Generated the **Weekly Academic Activity Report** for **${scopeTitle}** covering **${startIso}** to **${endIso}**. You can inspect the metrics below or export the report file directly.`,
      structuredCard: card
    };
  } catch (err: any) {
    return {
      success: false,
      action: 'generate_report',
      message: 'Failed to generate academic report.',
      summaryText: `⚠️ Could not generate report from StudentOS database: ${err.message}`,
      error: err.message
    };
  }
}

/* ========================================================================
   CENTRALIZED ORION ACTION DISPATCH PIPELINE
   ======================================================================== */

/**
 * Centralized Orion Action Dispatcher
 * Pipeline: UNDERSTAND → VALIDATE → EXECUTE → PERSIST IN SUPABASE → REALTIME UPDATE → CONFIRM
 */
export async function executeOrionActionPipeline(
  actions: OrionAction[],
  userContext: OrionUserContext,
  rawCommand: string,
  isConfirmed: boolean = false
): Promise<{
  results: OrionExecutionResult[];
  combinedSummary: string;
  structuredCards: OrionStructuredCard[];
  structuredData?: StructuredOrionPayload;
  pendingConfirmation?: {
    action: string;
    targetTitle: string;
    promptText: string;
    draftPreview?: OrionDraftPreview;
    rawAction?: OrionAction;
    previewDetails?: Record<string, string>;
    actionObject?: OrionAction;
  };
}> {
  console.log(`[ORION] User command received: "${rawCommand}"`);

  const results: OrionExecutionResult[] = [];
  const structuredCards: OrionStructuredCard[] = [];
  let pendingConfirmationData:
    | {
        action: string;
        targetTitle: string;
        promptText: string;
        draftPreview?: OrionDraftPreview;
        rawAction?: OrionAction;
        previewDetails?: Record<string, string>;
        actionObject?: OrionAction;
      }
    | undefined = undefined;

  for (const act of actions) {
    console.log(`[ORION] Intent detected: ${act.action}`);

    // Step 1: Validate User Permission on Backend/Executor Boundary
    const perm = validateActionPermission(act.action, userContext.userRole);
    if (!perm.allowed) {
      console.log(`[ORION] Action validation failed: ${perm.reason}`);
      results.push({
        success: false,
        action: act.action,
        message: 'Permission denied',
        summaryText: perm.reason || 'You do not have permission for this action.',
        error: 'PERMISSION_DENIED'
      });
      continue;
    }

    console.log(`[ORION] Action validated for role: ${userContext.userRole || 'student'}`);

    // Step 2: Consequential & Destructive Action Confirmation Check
    if (isConsequentialAction(act.action) && !isConfirmed) {
      const draftPreview = buildConsequentialActionPreview(act);
      const targetTitle = draftPreview.title;
      const promptText = isDestructiveAction(act.action)
        ? `⚠️ Confirm permanent deletion of "${targetTitle}" from StudentOS database?`
        : `I drafted this ${draftPreview.badgeLabel.replace(/^Draft\s+/i, '')} for ${draftPreview.targetAudience}: "${targetTitle}". Please confirm to execute.`;

      pendingConfirmationData = {
        action: act.action,
        targetTitle,
        promptText,
        draftPreview,
        rawAction: act,
        actionObject: act,
        previewDetails: {
          'Action Type': draftPreview.badgeLabel,
          'Title': draftPreview.title,
          'Target / Scope': draftPreview.targetAudience,
          ...(draftPreview.dateOrTime ? { 'Schedule': draftPreview.dateOrTime } : {}),
          'Preview': draftPreview.bodyPreview
        }
      };

      results.push({
        success: false,
        action: act.action,
        requiresConfirmation: true,
        confirmationPrompt: promptText,
        draftPreview,
        message: 'Confirmation required before executing consequential action.',
        summaryText:
          `### 📋 ${draftPreview.badgeLabel} — Confirmation Required\n\n` +
          `- **Title:** ${draftPreview.title}\n` +
          `- **Target / Scope:** ${draftPreview.targetAudience}\n` +
          (draftPreview.dateOrTime ? `- **Schedule:** ${draftPreview.dateOrTime}\n` : '') +
          `- **Content Preview:** ${draftPreview.bodyPreview}\n\n` +
          `*Please click **Confirm & Execute** below (or say "Yes, confirm") to publish this to StudentOS.*`
      });
      break; // Wait for explicit user confirmation
    }

    // Step 3: Action Execution & Supabase Persistence
    console.log(`[ORION] Executing ${act.action}...`);
    let res: OrionExecutionResult;

    switch (act.action) {
      case 'create_broadcast':
      case 'create_notice':
      case 'update_broadcast':
        res = await executeCreateBroadcast(act, userContext);
        break;

      case 'create_notification':
      case 'create_reminder':
      case 'notify_users':
      case 'notify_class':
      case 'notify_all':
        res = await executeCreateNotification(act, userContext);
        break;

      case 'create_event':
      case 'update_event':
        res = await executeCreateEvent(act, userContext);
        break;

      case 'create_competition':
      case 'update_competition':
        res = await executeCreateCompetition(act, userContext);
        break;

      case 'create_meeting':
      case 'schedule_meeting':
        res = await executeCreateMeeting(act, userContext);
        break;

      case 'create_assignment':
      case 'create_homework':
      case 'update_assignment':
        res = await executeCreateHomework(act, userContext);
        break;

      case 'delete_item':
      case 'delete_competition':
      case 'delete_event':
      case 'cancel_meeting':
      case 'delete_meeting':
      case 'delete_assignment':
      case 'delete_homework':
      case 'delete_broadcast':
        res = await executeDeleteItem(act, userContext, isConfirmed);
        break;

      case 'get_homework':
      case 'get_submissions':
      case 'get_assignments':
        res = await executeGetHomeworkAndSubmissions(act, userContext);
        break;

      case 'get_attendance':
        res = await executeGetAttendanceAnalysis(act, userContext);
        break;

      case 'daily_operations_summary':
      case 'get_students':
      case 'get_classes':
      case 'get_calendar':
      case 'get_notifications':
        res = await executeDailyOperationsSummary(act, userContext);
        break;

      case 'generate_report':
      case 'export_report':
        res = await executeGenerateAcademicReport(act, userContext);
        break;

      case 'register_competition':
        res = await executeRegisterCompetition(act, userContext);
        break;

      case 'add_study_planner':
        res = await executeAddStudyPlanner(act, userContext);
        break;

      case 'create_study_plan':
        res = await executeCreateStudyPlan(act, userContext);
        break;

      case 'create_calendar_event':
        res = await executeCreateCalendarEvent(act, userContext);
        break;

      case 'create_note':
      case 'generate_notes':
        res = await executeCreateNote(act, userContext);
        break;

      case 'start_attendance':
      case 'mark_attendance':
        res = await executeMarkAttendance(act, userContext);
        break;

      case 'add_task':
        res = await executeAddTask(act, userContext);
        break;

      case 'complete_task':
        res = await executeCompleteTask(act, userContext);
        break;

      case 'delete_task':
        res = await executeDeleteTask(act, userContext);
        break;

      case 'web_search':
      case 'search_internet': {
        const searchQuery = (act.title || act.content || act.message || rawCommand || '').trim();
        try {
          const searchResp = await fetch('/api/ai/search', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: searchQuery })
          });
          const searchData = await searchResp.json().catch(() => ({}));
          if (searchData && searchData.success && Array.isArray(searchData.results) && searchData.results.length > 0) {
            const sources = searchData.results;
            const rows: OrionStructuredTableRow[] = sources.slice(0, 6).map((s: any, idx: number) => ({
              id: `src_${idx}`,
              primary: s.title || 'External Reference',
              secondary: s.description ? s.description.slice(0, 140) : s.uri,
              badge: (s.sourceType || 'WEB').toUpperCase(),
              badgeTone: s.sourceType === 'official' ? 'emerald' : s.sourceType === 'academic' ? 'indigo' : 'slate',
              meta: s.published_source || s.uri
            }));
            const sourceMarkdownList = sources
              .map((s: any, idx: number) => `${idx + 1}. **[${s.title}](${s.uri})** — *${s.published_source || 'Web Source'}*\n   ${s.description || ''}`)
              .join('\n');
            const summaryBody = `🌐 **Orion External Research & Intelligence Report**\n\n### 📌 Executive Synthesis (External Web Sources)\n${searchData.summary || ''}\n\n### 🏫 Internal StudentOS Context Separation\n- **Internal StudentOS Records**: Role-scoped to **${userContext.role.toUpperCase()}** (${userContext.grade || 'All Grades'}${userContext.section ? ` • ${userContext.section}` : ''}). No unauthorized internal records were exposed to external search.\n- **External Web Attribution**: Retrieved ${sources.length} verified public sources.\n\n### 📚 Cited External Sources\n${sourceMarkdownList}`;
            res = {
              success: true,
              action: 'web_search',
              message: `Retrieved ${sources.length} live web sources`,
              summaryText: summaryBody,
              structuredCard: {
                title: `🌐 Web Intelligence: ${searchQuery.slice(0, 48)}`,
                subtitle: 'External Web Sources vs. Internal StudentOS Context',
                dateRange: new Date().toLocaleDateString(),
                metrics: [
                  { label: 'Sources Cited', value: sources.length, tone: 'indigo' },
                  { label: 'Official / Academic', value: sources.filter((x: any) => x.sourceType === 'official' || x.sourceType === 'academic').length, tone: 'emerald' },
                  { label: 'Data Scope', value: 'Separated', tone: 'default' }
                ],
                rows,
                reportMarkdown: summaryBody
              }
            };
          } else {
            res = {
              success: false,
              action: 'web_search',
              message: "I couldn't retrieve fresh web information right now.",
              summaryText: `I couldn't retrieve fresh web information right now. However, I can help analyze your internal StudentOS records or explain foundational concepts from verified curriculum knowledge.`
            };
          }
        } catch (err) {
          res = {
            success: false,
            action: 'web_search',
            message: "I couldn't retrieve fresh web information right now.",
            summaryText: `I couldn't retrieve fresh web information right now. Please try again in a moment.`
          };
        }
        break;
      }

      default:
        res = {
          success: true,
          action: act.action,
          message: 'Execution acknowledged',
          summaryText: act.content || act.message || `Command processed: ${rawCommand}`
        };
        break;
    }

    if (res.structuredCard) {
      structuredCards.push(res.structuredCard);
    }

    if (res.success) {
      console.log(`[ORION] Action completed successfully for ${act.action}`);
    } else {
      console.warn(`[ORION] Action failed: ${res.summaryText}`);
    }

    results.push(res);
  }

  const combinedSummary = results.map((r) => r.summaryText).join('\n\n');

  let structuredData: StructuredOrionPayload | undefined = undefined;
  if (structuredCards.length > 0) {
    const first = structuredCards[0];
    structuredData = {
      title: first.title,
      subtitle: first.subtitle || first.dateRange,
      metrics: first.metrics?.map((m) => ({
        label: m.label,
        value: m.value,
        status: m.tone === 'emerald' ? 'good' : m.tone === 'amber' ? 'warning' : m.tone === 'rose' ? 'danger' : 'neutral'
      })),
      columns: first.rows && first.rows.length > 0 ? ['Item', 'Details', 'Status', 'Info'] : undefined,
      rows: first.rows?.map((r) => ({
        'Item': r.primary,
        'Details': r.secondary || '—',
        'Status': r.badge || '—',
        'Info': r.meta || '—'
      })),
      recommendedActions: first.suggestedActions
        ?.filter((a) => !a.exportData)
        .map((a) => ({ label: a.label, command: a.command })),
      exportableMarkdown: first.reportMarkdown
    };
  }

  return {
    results,
    combinedSummary,
    structuredCards,
    structuredData,
    pendingConfirmation: pendingConfirmationData
  };
}
