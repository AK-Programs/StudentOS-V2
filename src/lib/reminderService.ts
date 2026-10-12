/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * StudentOS — Intelligent Learning Reminder & Notification Dispatcher
 * Integrates directly with Supabase notifications, deduplication, and user quiet-hours.
 */

import { saveAppNotification, generateUUID } from './notifications';
import { SyllabusTimetableService } from './syllabusTimetableService';
import { getStoredCards } from './flashcardStorage';
import { isCardDue } from './sm2Algorithm';
import { LearningReminder } from '../types/syllabusTimetable';

const DEDUPE_CACHE_KEY = 'studentos_reminders_sent_v1';

export class ReminderService {
  private static getSentReminderIds(): Set<string> {
    try {
      const raw = localStorage.getItem(DEDUPE_CACHE_KEY);
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) return new Set(arr);
      }
    } catch (_) {}
    return new Set();
  }

  private static markReminderSent(id: string) {
    try {
      const sent = this.getSentReminderIds();
      sent.add(id);
      // Keep up to 500 recent deduplication keys
      const list = Array.from(sent).slice(-500);
      localStorage.setItem(DEDUPE_CACHE_KEY, JSON.stringify(list));
    } catch (_) {}
  }

  /**
   * Run comprehensive check for due learning activities.
   * Called on session start or when user navigates to Study Hub.
   * Respects idempotency and avoids spamming.
   */
  static async checkAndDispatchLearningReminders(userId: string, userName?: string): Promise<LearningReminder[]> {
    if (!userId || userId === 'user_guest' || userId === 'guest') return [];

    const dispatched: LearningReminder[] = [];
    const sentIds = this.getSentReminderIds();
    const todayStr = new Date().toISOString().split('T')[0];

    // 1. Check Due Flashcards
    try {
      const cards = getStoredCards();
      const dueCards = cards.filter(c => isCardDue(c));
      if (dueCards && dueCards.length > 0) {
        const dedupeId = `flashcards_due_${userId}_${todayStr}_${Math.min(dueCards.length, 5)}`;
        if (!sentIds.has(dedupeId)) {
          const reminder: LearningReminder = {
            id: dedupeId,
            userId,
            category: 'flashcard_due',
            title: `🗂️ ${dueCards.length} Flashcard${dueCards.length > 1 ? 's' : ''} Due for Review`,
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
            type: 'reminder',
            targetUserId: userId,
            linkTab: 'flashcards'
          });

          this.markReminderSent(dedupeId);
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
        const dedupeId = `study_sess_${sess.id}_${todayStr}`;
        if (!sentIds.has(dedupeId)) {
          const reminder: LearningReminder = {
            id: dedupeId,
            userId,
            category: 'study_session',
            title: `⏱️ Upcoming Study Session: ${sess.subject}`,
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
            type: 'reminder',
            targetUserId: userId,
            linkTab: 'planner'
          });

          this.markReminderSent(dedupeId);
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
          const dedupeId = `exam_alert_${exam.id}_days_${daysLeft}`;
          if (!sentIds.has(dedupeId)) {
            const urgency = daysLeft <= 3 ? '🚨 CRITICAL' : '📅 Upcoming';
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
              type: 'exam',
              targetUserId: userId,
              linkTab: 'brain_battle'
            });

            this.markReminderSent(dedupeId);
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
