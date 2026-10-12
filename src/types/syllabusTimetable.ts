/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * StudentOS — Official Timetable + Syllabus Planner + Exam Preparation Types
 */

export type SyllabusExamRelevance = 'core' | 'high' | 'medium' | 'low';
export type ChapterLearningStatus = 'not_started' | 'in_progress' | 'completed' | 'revised';

export interface SyllabusTopic {
  id: string;
  title: string;
  learningObjectives?: string[];
  isCompleted?: boolean;
}

export interface SyllabusChapter {
  id: string;
  chapterNumber: number | string;
  title: string;
  description?: string;
  topics: string[];
  syllabusNotes?: string;
  authorizedResources?: Array<{
    title: string;
    url?: string;
    type: 'document' | 'video' | 'link' | 'textbook';
  }>;
  expectedCompletionDate?: string; // YYYY-MM-DD
  examRelevance: SyllabusExamRelevance;
  weightageMarks?: number; // e.g. 15 marks
  prerequisites?: string[];
  status: 'published' | 'draft' | 'archived';
  lastUpdated: string;
  updatedBy?: string;
  updatedByRole?: string;
}

export interface OfficialSubjectSyllabus {
  id: string;
  schoolId: string;
  academicYear: string; // e.g. "2026-2027"
  grade: string; // e.g. "Grade 10", "Grade 11"
  subject: string;
  board?: string; // e.g. "CBSE", "IB", "Cambridge", "State"
  chapters: SyllabusChapter[];
  publishedBy: string;
  publishedAt: string;
  version: number;
}

export interface StudentChapterProgress {
  chapterId: string;
  subject: string;
  status: ChapterLearningStatus;
  confidenceRating: number; // 1 to 5
  targetDate?: string;
  notes?: string;
  completedTopics: string[];
  revisionCount: number;
  lastStudiedAt?: string;
}

export interface SubjectProgressSummary {
  subject: string;
  grade: string;
  totalChapters: number;
  notStartedCount: number;
  inProgressCount: number;
  completedCount: number;
  revisedCount: number;
  progressPercentage: number;
  nextRecommendedChapter?: {
    id: string;
    chapterNumber: number | string;
    title: string;
    reason: string;
  };
  upcomingExamDate?: string;
}

// ==========================================
// OFFICIAL SCHOOL TIMETABLES
// ==========================================

export interface TimetablePeriod {
  periodNumber: number;
  name: string; // e.g. "Period 1", "Morning Assembly", "Lunch Break"
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  isBreak?: boolean;
  subject?: string;
  teacherId?: string;
  teacherName?: string;
  room?: string;
  substitutionTeacherName?: string;
  changeNote?: string;
}

export interface DayTimetable {
  day: 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday' | 'Sunday';
  periods: TimetablePeriod[];
}

export interface OfficialClassTimetable {
  id: string;
  schoolId: string;
  academicYear: string;
  grade: string;
  section?: string; // e.g. "A", "B"
  schedule: DayTimetable[];
  publishedBy: string;
  publishedAt: string;
  effectiveFrom: string; // YYYY-MM-DD
  version: number;
  changeHistory?: Array<{
    date: string;
    changedBy: string;
    summary: string;
  }>;
}

// ==========================================
// STUDY SESSIONS (Personal Execution Layer)
// ==========================================

export type StudySessionType =
  | 'learn_chapter'
  | 'continue_chapter'
  | 'revise_chapter'
  | 'practice_questions'
  | 'review_flashcards'
  | 'brain_battle'
  | 'exam_prep'
  | 'catch_up';

export type StudySessionStatus = 'pending' | 'in_progress' | 'completed' | 'skipped' | 'rescheduled';

export interface StudySessionItem {
  id: string;
  userId: string;
  date: string; // YYYY-MM-DD
  dayOfWeek?: string;
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  durationMinutes: number;
  subject: string;
  chapterId?: string;
  chapterTitle?: string;
  sessionType: StudySessionType;
  status: StudySessionStatus;
  notes?: string;
  reminderEnabled: boolean;
  isAiGenerated?: boolean;
  completedAt?: string;
  outcomeNotes?: string;
  xpAwarded?: boolean;
}

// ==========================================
// EXAM PREPARATION
// ==========================================

export interface ExamPreparationPlan {
  id: string;
  schoolId: string;
  userId?: string; // if student personal plan
  examName: string;
  subject: string;
  examDate: string; // YYYY-MM-DD
  isOfficialSchoolExam: boolean;
  grade: string;
  chaptersIncluded: string[]; // chapter IDs
  syllabusNotes?: string;
  targetScorePercent?: number;
  mockExamsAttempted: number;
  averageAccuracy: number;
  totalQuestionsPracticed: number;
  lastPracticedAt?: string;
  status: 'upcoming' | 'ongoing' | 'completed';
}

// ==========================================
// REMINDERS & NOTIFICATIONS
// ==========================================

export type ReminderCategory =
  | 'flashcard_due'
  | 'brain_battle_practice'
  | 'study_session'
  | 'exam_preparation'
  | 'timetable_change';

export interface LearningReminder {
  id: string;
  userId: string;
  category: ReminderCategory;
  title: string;
  message: string;
  targetDate: string;
  targetTime?: string;
  deepLinkTab: string; // e.g. 'planner', 'flashcards', 'brain_battle', 'timetable_viewer'
  relatedEntityId?: string;
  isRead: boolean;
  isAcknowledged: boolean;
  createdAt: string;
}
