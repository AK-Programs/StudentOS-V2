/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * StudentOS — Intelligent Learning Reminder & Notification Dispatcher (System 2.0)
 * Strictly scoped:
 * - Student learning/flashcard reminders are NEVER dispatched for Teachers, Coordinators, Admins, Super Admins, or Parents.
 * - Per-user dedupe keys prevent cross-account or reload spam.
 * - Quiet hours & notification preferences are enforced before creating reminders.
 */

import { saveAppNotification, generateUUID } from './notifications';
import { SyllabusTimetableService } from './syllabusTimetableService';
import { getStoredCards, getCanonicalUserId } from './flashcardStorage';
import { isCardDue } from './sm2Algorithm';
import { LearningReminder } from '../types/syllabusTimetable';

function getDedupeCacheKey(userId: string): string {
  return `studentos_reminders_sent_v2_${userId}`;
}

export class ReminderService {
  private static getSentReminderIds(userId: string): Set<string> {
    try {
      const raw = localStorage.getItem(getDedupeCacheKey(userId));
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) return new Set(arr);
      }
    } catch (_) {}
    return new Set();
  }

  private static markReminderSent(userId: string, id: string) {
    try {
      const sent = this.getSentReminderIds(userId);
      sent.add(id);
      const list = Array.from(sent).slice(-500);
      localStorage.setItem(getDedupeCacheKey(userId), JSON.stringify(list));
    } catch (_) {}
  }

  /**
   * Run comprehensive check for due learning activities for STUDENTS ONLY.
   */
  static async checkAndDispatchLearningReminders(
    userId: string,
    _userName?: string,
    options?: {
      role?: string;
      notificationPreferences?: {
        muteAll?: boolean;
        studyReminders?: boolean;
        quietHoursEnabled?: boolean;
        quietStartHour?: number;
        quietEndHour?: number;
      };
    }
  ): Promise<LearningReminder[]> {
    if (!userId || userId === 'user_guest' || userId === 'guest') return [];

    // Resolve role safely (explicit option first, fallback to s_os_user only if matching userId)
    let resolvedRole = String(options?.role || '').toLowerCase().trim();
    let prefs = options?.notificationPreferences;

    if (!resolvedRole && typeof window !== 'undefined') {
      try {
        const cached = JSON.parse(localStorage.getItem('s_os_user') || '{}');
        if (cached && (cached.uid === userId || cached.id === userId || cached.email === userId)) {
          resolvedRole = String(cached.role || '').toLowerCase().trim();
          prefs = prefs || cached?.raw_data?.notificationPreferences;
        }
      } catch (_) {}
    }

    // CRITICAL FIX: Teachers, Coordinators, Admins, Super Admins & Parents must NEVER receive student flashcard/study reminders
    if (resolvedRole !== 'student') {
      return [];
    }

    if (prefs?.muteAll === true || prefs?.studyReminders === false) {
      return [];
    }

    if (prefs?.quietHoursEnabled) {
      const hr = new Date().getHours();
      const qs = Number(prefs.quietStartHour ?? 22);
      const qe = Number(prefs.quietEndHour ?? 7);
      const inQuiet = qs > qe ? (hr >= qs || hr < qe) : (hr >= qs && hr < qe);
      if (inQuiet) return [];
    }

    const dispatched: LearningReminder[] = [];
    const sentIds = this.getSentReminderIds(userId);
    const todayStr = new Date().toISOString().split('T')[0];

    // 1. Check Due Flashcards strictly scoped to this student's canonical ID
    try {
      const canonicalId = getCanonicalUserId(userId);
      const cards = getStoredCards();
      const dueCards = cards.filter(c => {
        const owner = (c as any).createdBy;
        return (!owner || owner === canonicalId || owner === userId || owner === 'system') && isCardDue(c);
      });
      if (dueCards && dueCards.length > 0) {
        const dedupeId = `flashcards_due:${userId}:${todayStr}`;
        if (!sentIds.has(dedupeId)) {
          const reminder: LearningReminder = {
            id: dedupeId,
            userId,
            category: 'flashcard_due',
            title: `${dueCards.length} Flashcard${dueCards.length > 1 ? 's' : ''} Due for Review`,
            message: `Maintain spaced repetition mastery! You have ${dueCards.length} cards scheduled for recall today.`,
            targetDate: todayStr,
            deepLinkTab: 'flashcards',
            isRead: false,
            isAcknowledged: false,
            createdAt: new Date().toISOString()
          };

          await saveAppNotification({
            id: generateUUID(),
            createdAt: new Date().toISOString(),
            isRead: false,
            title: reminder.title,
            message: reminder.message,
            type: 'flashcard_due',
            targetRole: 'student',
            targetUserId: userId,
            linkTab: 'flashcards',
            dedupeKey: dedupeId,
          });

          this.markReminderSent(userId, dedupeId);
          dispatched.push(reminder);
        }
      }
    } catch (e) {
      console.warn('[Reminders] Flashcard check warning:', e);
    }

    // 2. Check Study Sessions (Upcoming today or pending)
    try {
      const sessions = await SyllabusTimetableService.getStudySessions(userId);
      const pendingToday = sessions.filter(s => s.date === todayStr && s.status === 'pending');

      for (const sess of pendingToday.slice(0, 2)) {
        const dedupeId = `study_sess:${userId}:${sess.id}:${todayStr}`;
        if (!sentIds.has(dedupeId)) {
          const reminder: LearningReminder = {
            id: dedupeId,
            userId,
            category: 'study_session',
            title: `Upcoming Study Session: ${sess.subject}`,
            message: `${sess.durationMinutes} min session scheduled: ${sess.chapterTitle || sess.sessionType.replace('_', ' ')} at ${sess.startTime}.`,
            targetDate: todayStr,
            targetTime: sess.startTime,
            deepLinkTab: 'planner',
            relatedEntityId: sess.id,
            isRead: false,
            isAcknowledged: false,
            createdAt: new Date().toISOString()
          };

          await saveAppNotification({
            id: generateUUID(),
            createdAt: new Date().toISOString(),
            isRead: false,
            title: reminder.title,
            message: reminder.message,
            type: 'study_reminder',
            targetRole: 'student',
            targetUserId: userId,
            linkTab: 'planner',
            dedupeKey: dedupeId,
          });

          this.markReminderSent(userId, dedupeId);
          dispatched.push(reminder);
        }
      }
    } catch (e) {
      console.warn('[Reminders] Study sessions check warning:', e);
    }

    // 3. Check Upcoming Examinations & Revision Countdown
    try {
      const officialExams = await SyllabusTimetableService.getOfficialExams();
      const personalExams = await SyllabusTimetableService.getStudentPersonalExamPlans(userId);
      const allExams = [...officialExams, ...personalExams];

      const nowTime = new Date().getTime();
      for (const exam of allExams) {
        if (!exam.examDate) continue;
        const examTime = new Date(exam.examDate).getTime();
        const daysLeft = Math.ceil((examTime - nowTime) / (1000 * 60 * 60 * 24));

        if (daysLeft >= 0 && daysLeft <= 14) {
          const dedupeId = `exam_alert:${userId}:${exam.id}:days_${daysLeft}`;
          if (!sentIds.has(dedupeId)) {
            const urgency = daysLeft <= 3 ? 'Urgent Exam Alert' : 'Upcoming Exam';
            const reminder: LearningReminder = {
              id: dedupeId,
              userId,
              category: 'exam_preparation',
              title: `${urgency}: ${exam.examName}`,
              message: `${daysLeft === 0 ? 'Today!' : daysLeft === 1 ? 'Tomorrow!' : `${daysLeft} days remaining.`} Practice mock exam questions in Brain Battle Arena.`,
              targetDate: exam.examDate,
              deepLinkTab: 'brain_battle',
              relatedEntityId: exam.id,
              isRead: false,
              isAcknowledged: false,
              createdAt: new Date().toISOString()
            };

            await saveAppNotification({
              id: generateUUID(),
              createdAt: new Date().toISOString(),
              isRead: false,
              title: reminder.title,
              message: reminder.message,
              type: 'exam_prep',
              targetRole: 'student',
              targetUserId: userId,
              linkTab: 'brain_battle',
              dedupeKey: dedupeId,
            });

            this.markReminderSent(userId, dedupeId);
            dispatched.push(reminder);
          }
        }
      }
    } catch (e) {
      console.warn('[Reminders] Exam alert check warning:', e);
    }

    return dispatched;
  }
}
