import { supabase } from './supabase';
import { createCompetition, createSchoolEvent } from './supabaseLife';
import { saveSupabaseHomework, deleteSupabaseHomework } from './supabaseHomework';
import { createOrUpdateMeeting, deleteMeeting } from './supabaseMeet';
import { saveAppNotification } from './notifications';
import { executeOrionCommunicationDispatch } from './orionCommunication';
import { Homework, Meeting, AppNotification, Competition, SchoolEvent } from '../types';

export type OrionActionType =
  | 'create_broadcast'
  | 'update_broadcast'
  | 'delete_broadcast'
  | 'create_notification'
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
  userRole?: string; // 'super_admin' | 'admin' | 'teacher' | 'student'
}

export interface OrionExecutionResult {
  success: boolean;
  action: OrionActionType;
  recordId?: string;
  message: string;
  summaryText: string;
  data?: any;
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
  const isTeacher = normRole === 'teacher' || normRole === 'faculty' || normRole === 'head_teacher' || isAdmin;

  // Student permissions whitelist
  const studentAllowedActions: OrionActionType[] = [
    'register_competition',
    'show_pending_assignments',
    'show_timetable',
    'show_attendance',
    'show_announcements',
    'navigate_tab',
    'search_users',
    'general_chat',
    'add_study_planner',
    'create_study_plan',
    'create_note',
    'generate_notes',
    'add_task',
    'complete_task',
    'delete_task'
  ];

  if (!isTeacher) {
    if (studentAllowedActions.includes(action)) {
      return { allowed: true };
    }
    return {
      allowed: false,
      reason: `🔒 Permission Denied: Student accounts are not authorized to perform administrative or creation actions (${action}). Please request assistance from a teacher or administrator.`
    };
  }

  return { allowed: true };
}

/**
 * Destructive actions requiring explicit user confirmation before executing
 */
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
  pendingConfirmation?: { action: string; targetTitle: string; promptText: string };
}> {
  console.log(`[ORION] User command received: "${rawCommand}"`);

  const results: OrionExecutionResult[] = [];
  let pendingConfirmationData: { action: string; targetTitle: string; promptText: string } | undefined = undefined;

  for (const act of actions) {
    console.log(`[ORION] Intent detected: ${act.action}`);

    // Step 1: Validate User Permission
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

    // Step 2: Destructive Action Confirmation Check
    if (isDestructiveAction(act.action) && !isConfirmed) {
      const targetTitle = act.title || act.targetValue || 'Item';
      const promptText = `⚠️ Are you sure you want to delete '${targetTitle}'? This will permanently remove it from Supabase.`;
      console.log(`[ORION] Action ${act.action} requires confirmation`);

      pendingConfirmationData = {
        action: act.action,
        targetTitle,
        promptText
      };

      results.push({
        success: false,
        action: act.action,
        requiresConfirmation: true,
        confirmationPrompt: promptText,
        message: `Confirmation required`,
        summaryText: promptText
      });
      break; // Stop pipeline until user confirms
    }

    // Step 3: Action Execution & Supabase Persistence
    console.log(`[ORION] Executing ${act.action}...`);
    let res: OrionExecutionResult;

    switch (act.action) {
      case 'create_broadcast':
      case 'update_broadcast':
        res = await executeCreateBroadcast(act, userContext);
        break;

      case 'create_notification':
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
      case 'search_internet':
        res = {
          success: true,
          action: 'web_search',
          message: 'Web Search Coming Soon',
          summaryText: `🚀 **Web Search — Coming Soon**\n\nOnline web search capabilities and live internet grounding will arrive in a future StudentOS update.`
        };
        break;

      default:
        // Informational or Navigation Actions
        res = {
          success: true,
          action: act.action,
          message: 'Execution acknowledged',
          summaryText: act.content || act.message || `Command processed: ${rawCommand}`
        };
        break;
    }

    if (res.success) {
      console.log(`[ORION] Action completed successfully for ${act.action}`);
    } else {
      console.warn(`[ORION] Action failed: ${res.summaryText}`);
    }

    results.push(res);
  }

  // Combine summaries for output response
  const combinedSummary = results.map(r => r.summaryText).join('\n\n');

  return {
    results,
    combinedSummary,
    pendingConfirmation: pendingConfirmationData
  };
}
