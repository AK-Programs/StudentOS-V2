/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * StudentOS — Official Syllabus, School Timetable & Study Sessions Service
 * Backed by Supabase persistence, role-based controls, and client cache.
 */

import { supabase } from './supabase';
import {
  OfficialSubjectSyllabus,
  SyllabusChapter,
  StudentChapterProgress,
  SubjectProgressSummary,
  OfficialClassTimetable,
  DayTimetable,
  TimetablePeriod,
  StudySessionItem,
  ExamPreparationPlan,
  ChapterLearningStatus
} from '../types/syllabusTimetable';
import { awardStudentXP } from './gamification';

// ============================================================================
// CANONICAL DEFAULT OFFICIAL SYLLABUS DATA (For out-of-the-box experience)
// ============================================================================
export const DEFAULT_OFFICIAL_SYLLABUSES: OfficialSubjectSyllabus[] = [
  {
    id: 'syl_math_g10',
    schoolId: 'default_school',
    academicYear: '2026-2027',
    grade: 'Grade 10',
    subject: 'Mathematics',
    board: 'Standard Academic Curriculum',
    publishedBy: 'Dr. Evelyn Reed (Dept Head)',
    publishedAt: '2026-08-15T09:00:00Z',
    version: 1,
    chapters: [
      {
        id: 'math_g10_ch1',
        chapterNumber: 1,
        title: 'Real Numbers & Fundamental Arithmetic',
        topics: ['Euclid Division Lemma', 'Fundamental Theorem of Arithmetic', 'Revisiting Irrational Numbers', 'Decimal Expansions'],
        syllabusNotes: 'Essential foundation for Algebra. High probability of 3-mark proofs in Board Exams.',
        expectedCompletionDate: '2026-09-10',
        examRelevance: 'core',
        weightageMarks: 6,
        status: 'published',
        lastUpdated: '2026-08-15T09:00:00Z'
      },
      {
        id: 'math_g10_ch2',
        chapterNumber: 2,
        title: 'Polynomials & Geometric Zeroes',
        topics: ['Geometrical Meaning of Zeroes', 'Relationship between Zeroes and Coefficients', 'Division Algorithm'],
        syllabusNotes: 'Focus on cubic polynomials and factorization techniques.',
        expectedCompletionDate: '2026-09-28',
        examRelevance: 'high',
        weightageMarks: 8,
        status: 'published',
        lastUpdated: '2026-08-15T09:00:00Z'
      },
      {
        id: 'math_g10_ch3',
        chapterNumber: 3,
        title: 'Linear Equations in Two Variables',
        topics: ['Graphical Method of Solution', 'Algebraic Substitution & Elimination', 'Cross Multiplication', 'Equations Reducible to Linear Form'],
        syllabusNotes: 'Word problems on speed/distance and work rates appear every term.',
        expectedCompletionDate: '2026-10-18',
        examRelevance: 'core',
        weightageMarks: 10,
        status: 'published',
        lastUpdated: '2026-08-15T09:00:00Z'
      },
      {
        id: 'math_g10_ch4',
        chapterNumber: 4,
        title: 'Quadratic Equations & Discriminants',
        topics: ['Standard Form', 'Solution by Factorisation', 'Completing the Square', 'Nature of Roots'],
        syllabusNotes: 'Practice discriminant D > 0, D = 0 condition proofs.',
        expectedCompletionDate: '2026-11-05',
        examRelevance: 'high',
        weightageMarks: 9,
        status: 'published',
        lastUpdated: '2026-08-15T09:00:00Z'
      },
      {
        id: 'math_g10_ch5',
        chapterNumber: 5,
        title: 'Arithmetic Progressions',
        topics: ['nth Term of an AP', 'Sum of First n Terms', 'Application in Daily Life'],
        syllabusNotes: 'Series summation formula derivations required.',
        expectedCompletionDate: '2026-11-25',
        examRelevance: 'medium',
        weightageMarks: 7,
        status: 'published',
        lastUpdated: '2026-08-15T09:00:00Z'
      },
      {
        id: 'math_g10_ch6',
        chapterNumber: 6,
        title: 'Triangles & Similarity Theorems',
        topics: ['Basic Proportionality Theorem (Thales)', 'Converse of BPT', 'Criteria for Similarity of Triangles', 'Pythagoras Theorem Proof'],
        syllabusNotes: 'Crucial for term examination. Always contains at least one 5-mark theorem proof.',
        expectedCompletionDate: '2026-12-15',
        examRelevance: 'core',
        weightageMarks: 12,
        status: 'published',
        lastUpdated: '2026-08-15T09:00:00Z'
      }
    ]
  },
  {
    id: 'syl_phys_g10',
    schoolId: 'default_school',
    academicYear: '2026-2027',
    grade: 'Grade 10',
    subject: 'Physics',
    board: 'Standard Academic Curriculum',
    publishedBy: 'Prof. Marcus Vance',
    publishedAt: '2026-08-16T10:00:00Z',
    version: 1,
    chapters: [
      {
        id: 'phys_g10_ch1',
        chapterNumber: 1,
        title: 'Light: Reflection and Refraction',
        topics: ['Spherical Mirrors and Ray Diagrams', 'Mirror Formula and Magnification', 'Refraction through Glass Slab', 'Lens Formula & Power of a Lens'],
        syllabusNotes: 'Practice sign conventions meticulously. Ray diagrams are mandatory in questions.',
        expectedCompletionDate: '2026-09-20',
        examRelevance: 'core',
        weightageMarks: 11,
        status: 'published',
        lastUpdated: '2026-08-16T10:00:00Z'
      },
      {
        id: 'phys_g10_ch2',
        chapterNumber: 2,
        title: 'The Human Eye and Colourful World',
        topics: ['Structure of Eye & Defects of Vision', 'Refraction through a Prism', 'Atmospheric Refraction & Twinkling of Stars', 'Scattering of Light and Tyndall Effect'],
        syllabusNotes: 'Defects (Myopia, Hypermetropia, Presbyopia) with corrective ray diagrams.',
        expectedCompletionDate: '2026-10-10',
        examRelevance: 'high',
        weightageMarks: 7,
        status: 'published',
        lastUpdated: '2026-08-16T10:00:00Z'
      },
      {
        id: 'phys_g10_ch3',
        chapterNumber: 3,
        title: 'Electricity & Ohm’s Law',
        topics: ['Electric Current and Potential Difference', 'Ohm’s Law & Resistance Factors', 'Resistors in Series and Parallel', 'Heating Effect and Joule’s Law', 'Electric Power'],
        syllabusNotes: 'Numerical problems on equivalent resistance and power calculations.',
        expectedCompletionDate: '2026-11-15',
        examRelevance: 'core',
        weightageMarks: 12,
        status: 'published',
        lastUpdated: '2026-08-16T10:00:00Z'
      },
      {
        id: 'phys_g10_ch4',
        chapterNumber: 4,
        title: 'Magnetic Effects of Electric Current',
        topics: ['Magnetic Field Lines & Right-Hand Thumb Rule', 'Force on Current-Carrying Conductor', 'Fleming’s Left-Hand Rule', 'Electric Motor & Electromagnetic Induction', 'Domestic Electric Circuits'],
        syllabusNotes: 'Understand safety fuses, earthing wire significance, and AC vs DC characteristics.',
        expectedCompletionDate: '2026-12-10',
        examRelevance: 'high',
        weightageMarks: 9,
        status: 'published',
        lastUpdated: '2026-08-16T10:00:00Z'
      }
    ]
  },
  {
    id: 'syl_chem_g10',
    schoolId: 'default_school',
    academicYear: '2026-2027',
    grade: 'Grade 10',
    subject: 'Chemistry',
    board: 'Standard Academic Curriculum',
    publishedBy: 'Dr. Sophia Loren',
    publishedAt: '2026-08-16T11:00:00Z',
    version: 1,
    chapters: [
      {
        id: 'chem_g10_ch1',
        chapterNumber: 1,
        title: 'Chemical Reactions and Equations',
        topics: ['Balancing Chemical Equations', 'Types of Chemical Reactions', 'Oxidation & Reduction Reactions', 'Corrosion and Rancidity'],
        syllabusNotes: 'Writing states of matter (s, l, g, aq) and balancing equations is tested heavily.',
        expectedCompletionDate: '2026-09-15',
        examRelevance: 'high',
        weightageMarks: 8,
        status: 'published',
        lastUpdated: '2026-08-16T11:00:00Z'
      },
      {
        id: 'chem_g10_ch2',
        chapterNumber: 2,
        title: 'Acids, Bases, and Salts',
        topics: ['Properties of Acids and Bases', 'pH Scale and Importance in Everyday Life', 'Salts: Bleaching Powder, Baking Soda, Washing Soda, Plaster of Paris'],
        syllabusNotes: 'Preparation methods, equations, and commercial uses of sodium compounds.',
        expectedCompletionDate: '2026-10-15',
        examRelevance: 'core',
        weightageMarks: 10,
        status: 'published',
        lastUpdated: '2026-08-16T11:00:00Z'
      },
      {
        id: 'chem_g10_ch3',
        chapterNumber: 3,
        title: 'Metals and Non-metals',
        topics: ['Physical & Chemical Properties of Metals', 'Reactivity Series', 'Ionic Compounds and Properties', 'Basic Metallurgy and Refining'],
        syllabusNotes: 'Thermite process, electrolytic refining diagram, and ionic bond electron dot structures.',
        expectedCompletionDate: '2026-11-20',
        examRelevance: 'high',
        weightageMarks: 9,
        status: 'published',
        lastUpdated: '2026-08-16T11:00:00Z'
      },
      {
        id: 'chem_g10_ch4',
        chapterNumber: 4,
        title: 'Carbon and its Compounds',
        topics: ['Covalent Bonding in Carbon', 'Versatile Nature of Carbon', 'Homologous Series & IUPAC Nomenclature', 'Chemical Properties: Combustion, Oxidation, Addition, Substitution', 'Ethanol and Ethanoic Acid', 'Soaps & Detergents'],
        syllabusNotes: 'Core chapter carrying highest marks in organic chemistry. Saponification reaction is frequent.',
        expectedCompletionDate: '2026-12-18',
        examRelevance: 'core',
        weightageMarks: 12,
        status: 'published',
        lastUpdated: '2026-08-16T11:00:00Z'
      }
    ]
  },
  {
    id: 'syl_cs_g10',
    schoolId: 'default_school',
    academicYear: '2026-2027',
    grade: 'Grade 10',
    subject: 'Computer Science',
    board: 'Standard Academic Curriculum',
    publishedBy: 'Coach Solara',
    publishedAt: '2026-08-17T09:30:00Z',
    version: 1,
    chapters: [
      {
        id: 'cs_g10_ch1',
        chapterNumber: 1,
        title: 'Networking Basics & Internet Protocols',
        topics: ['Types of Networks (LAN, WAN, MAN)', 'Network Topologies', 'Internet & Web Technologies', 'HTTP, FTP, TCP/IP Protocols'],
        syllabusNotes: 'Key definitions and topology diagram comparisons.',
        expectedCompletionDate: '2026-09-30',
        examRelevance: 'high',
        weightageMarks: 9,
        status: 'published',
        lastUpdated: '2026-08-17T09:30:00Z'
      },
      {
        id: 'cs_g10_ch2',
        chapterNumber: 2,
        title: 'HTML & CSS Web Development',
        topics: ['Document Structure', 'Tags, Lists, Tables, and Forms', 'CSS Styling and Box Model', 'Responsive Layouts'],
        syllabusNotes: 'Coding questions require writing valid semantic HTML and CSS snippets.',
        expectedCompletionDate: '2026-10-31',
        examRelevance: 'core',
        weightageMarks: 12,
        status: 'published',
        lastUpdated: '2026-08-17T09:30:00Z'
      },
      {
        id: 'cs_g10_ch3',
        chapterNumber: 3,
        title: 'Cyber Ethics and Security',
        topics: ['Netiquette & Digital Footprints', 'Cyber Bullying & Phishing', 'Intellectual Property & Open Source', 'Safeguarding Data and Backups'],
        syllabusNotes: 'Case studies on cybersecurity ethics and digital hygiene.',
        expectedCompletionDate: '2026-11-30',
        examRelevance: 'medium',
        weightageMarks: 7,
        status: 'published',
        lastUpdated: '2026-08-17T09:30:00Z'
      },
      {
        id: 'cs_g10_ch4',
        chapterNumber: 4,
        title: 'Python Programming Essentials',
        topics: ['Data Types & Conditionals', 'Loops and Iterations', 'Strings and Lists', 'Functions and Problem Solving'],
        syllabusNotes: 'Trace table dry runs and bug-finding in provided algorithms.',
        expectedCompletionDate: '2026-12-20',
        examRelevance: 'core',
        weightageMarks: 15,
        status: 'published',
        lastUpdated: '2026-08-17T09:30:00Z'
      }
    ]
  }
];

// ============================================================================
// CANONICAL DEFAULT OFFICIAL SCHOOL TIMETABLE (Grade 10 Section A)
// ============================================================================
export const DEFAULT_OFFICIAL_TIMETABLE: OfficialClassTimetable = {
  id: 'tt_g10_a_2026',
  schoolId: 'default_school',
  academicYear: '2026-2027',
  grade: 'Grade 10',
  section: 'A',
  publishedBy: 'Principal Henderson & Academic Coordination',
  publishedAt: '2026-08-20T12:00:00Z',
  effectiveFrom: '2026-09-01',
  version: 2,
  changeHistory: [
    {
      date: '2026-09-01',
      changedBy: 'Admin',
      summary: 'Initial official term timetable published.'
    },
    {
      date: '2026-09-15',
      changedBy: 'Coordinator Smith',
      summary: 'Adjusted Physics lab timing on Wednesday.'
    }
  ],
  schedule: [
    {
      day: 'Monday',
      periods: [
        { periodNumber: 1, name: 'Period 1', startTime: '08:30', endTime: '09:20', subject: 'Mathematics', teacherName: 'Dr. Evelyn Reed', room: 'Lab 201' },
        { periodNumber: 2, name: 'Period 2', startTime: '09:25', endTime: '10:15', subject: 'Physics', teacherName: 'Prof. Marcus Vance', room: 'Sci Lab 1' },
        { periodNumber: 3, name: 'Morning Break', startTime: '10:15', endTime: '10:35', isBreak: true },
        { periodNumber: 4, name: 'Period 3', startTime: '10:35', endTime: '11:25', subject: 'Chemistry', teacherName: 'Dr. Sophia Loren', room: 'Sci Lab 2' },
        { periodNumber: 5, name: 'Period 4', startTime: '11:30', endTime: '12:20', subject: 'English', teacherName: 'Ms. Clara Oswald', room: 'Hall B' },
        { periodNumber: 6, name: 'Lunch Break', startTime: '12:20', endTime: '13:05', isBreak: true },
        { periodNumber: 7, name: 'Period 5', startTime: '13:05', endTime: '13:55', subject: 'Computer Science', teacherName: 'Coach Solara', room: 'IT Lab 3' },
        { periodNumber: 8, name: 'Period 6', startTime: '14:00', endTime: '14:50', subject: 'Physical Education', teacherName: 'Coach Davis', room: 'Gymnasium' }
      ]
    },
    {
      day: 'Tuesday',
      periods: [
        { periodNumber: 1, name: 'Period 1', startTime: '08:30', endTime: '09:20', subject: 'Physics', teacherName: 'Prof. Marcus Vance', room: 'Sci Lab 1' },
        { periodNumber: 2, name: 'Period 2', startTime: '09:25', endTime: '10:15', subject: 'Mathematics', teacherName: 'Dr. Evelyn Reed', room: 'Lab 201' },
        { periodNumber: 3, name: 'Morning Break', startTime: '10:15', endTime: '10:35', isBreak: true },
        { periodNumber: 4, name: 'Period 3', startTime: '10:35', endTime: '11:25', subject: 'History', teacherName: 'Mr. Arthur Pendelton', room: 'Room 105' },
        { periodNumber: 5, name: 'Period 4', startTime: '11:30', endTime: '12:20', subject: 'Computer Science', teacherName: 'Coach Solara', room: 'IT Lab 3' },
        { periodNumber: 6, name: 'Lunch Break', startTime: '12:20', endTime: '13:05', isBreak: true },
        { periodNumber: 7, name: 'Period 5', startTime: '13:05', endTime: '13:55', subject: 'Chemistry', teacherName: 'Dr. Sophia Loren', room: 'Sci Lab 2' },
        { periodNumber: 8, name: 'Period 6', startTime: '14:00', endTime: '14:50', subject: 'Library / Study Hall', teacherName: 'Mrs. Gable', room: 'Central Library' }
      ]
    },
    {
      day: 'Wednesday',
      periods: [
        { periodNumber: 1, name: 'Period 1', startTime: '08:30', endTime: '09:20', subject: 'Chemistry', teacherName: 'Dr. Sophia Loren', room: 'Sci Lab 2' },
        { periodNumber: 2, name: 'Period 2', startTime: '09:25', endTime: '10:15', subject: 'Biology', teacherName: 'Dr. Watson', room: 'Bio Lab' },
        { periodNumber: 3, name: 'Morning Break', startTime: '10:15', endTime: '10:35', isBreak: true },
        { periodNumber: 4, name: 'Period 3', startTime: '10:35', endTime: '11:25', subject: 'Mathematics', teacherName: 'Dr. Evelyn Reed', room: 'Lab 201' },
        { periodNumber: 5, name: 'Period 4', startTime: '11:30', endTime: '12:20', subject: 'English', teacherName: 'Ms. Clara Oswald', room: 'Hall B' },
        { periodNumber: 6, name: 'Lunch Break', startTime: '12:20', endTime: '13:05', isBreak: true },
        { periodNumber: 7, name: 'Period 5', startTime: '13:05', endTime: '14:30', subject: 'Physics Practical Lab', teacherName: 'Prof. Marcus Vance', room: 'Sci Lab 1' }
      ]
    },
    {
      day: 'Thursday',
      periods: [
        { periodNumber: 1, name: 'Period 1', startTime: '08:30', endTime: '09:20', subject: 'Computer Science', teacherName: 'Coach Solara', room: 'IT Lab 3' },
        { periodNumber: 2, name: 'Period 2', startTime: '09:25', endTime: '10:15', subject: 'Mathematics', teacherName: 'Dr. Evelyn Reed', room: 'Lab 201' },
        { periodNumber: 3, name: 'Morning Break', startTime: '10:15', endTime: '10:35', isBreak: true },
        { periodNumber: 4, name: 'Period 3', startTime: '10:35', endTime: '11:25', subject: 'Physics', teacherName: 'Prof. Marcus Vance', room: 'Sci Lab 1' },
        { periodNumber: 5, name: 'Period 4', startTime: '11:30', endTime: '12:20', subject: 'Chemistry', teacherName: 'Dr. Sophia Loren', room: 'Sci Lab 2' },
        { periodNumber: 6, name: 'Lunch Break', startTime: '12:20', endTime: '13:05', isBreak: true },
        { periodNumber: 7, name: 'Period 5', startTime: '13:05', endTime: '13:55', subject: 'Art & Design', teacherName: 'Ms. Rivera', room: 'Studio 4' },
        { periodNumber: 8, name: 'Period 6', startTime: '14:00', endTime: '14:50', subject: 'English', teacherName: 'Ms. Clara Oswald', room: 'Hall B' }
      ]
    },
    {
      day: 'Friday',
      periods: [
        { periodNumber: 1, name: 'Period 1', startTime: '08:30', endTime: '09:20', subject: 'Mathematics', teacherName: 'Dr. Evelyn Reed', room: 'Lab 201' },
        { periodNumber: 2, name: 'Period 2', startTime: '09:25', endTime: '10:15', subject: 'Chemistry Practical', teacherName: 'Dr. Sophia Loren', room: 'Sci Lab 2' },
        { periodNumber: 3, name: 'Morning Break', startTime: '10:15', endTime: '10:35', isBreak: true },
        { periodNumber: 4, name: 'Period 3', startTime: '10:35', endTime: '11:25', subject: 'Computer Lab Project', teacherName: 'Coach Solara', room: 'IT Lab 3' },
        { periodNumber: 5, name: 'Period 4', startTime: '11:30', endTime: '12:20', subject: 'Physics', teacherName: 'Prof. Marcus Vance', room: 'Sci Lab 1' },
        { periodNumber: 6, name: 'Lunch Break', startTime: '12:20', endTime: '13:05', isBreak: true },
        { periodNumber: 7, name: 'Period 5', startTime: '13:05', endTime: '13:55', subject: 'Clubs & House Activities', teacherName: 'House Masters', room: 'Auditorium' },
        { periodNumber: 8, name: 'Period 6', startTime: '14:00', endTime: '14:50', subject: 'Weekly Assembly / Review', teacherName: 'Staff', room: 'Main Quad' }
      ]
    },
    {
      day: 'Saturday',
      periods: [
        { periodNumber: 1, name: 'Period 1', startTime: '08:30', endTime: '09:20', subject: 'Mathematics Problem Clinic', teacherName: 'Dr. Evelyn Reed', room: 'Room 302' },
        { periodNumber: 2, name: 'Period 2', startTime: '09:25', endTime: '10:15', subject: 'Physics Practical Lab', teacherName: 'Prof. Marcus Vance', room: 'Sci Lab 1' },
        { periodNumber: 3, name: 'Morning Break', startTime: '10:15', endTime: '10:35', isBreak: true },
        { periodNumber: 4, name: 'Period 3', startTime: '10:35', endTime: '11:25', subject: 'Computer Science Practical', teacherName: 'Coach Solara', room: 'IT Lab 3' },
        { periodNumber: 5, name: 'Period 4', startTime: '11:30', endTime: '12:20', subject: 'Remedial Doubt Clearing & Discussion', teacherName: 'Faculty Mentors', room: 'Room 302' }
      ]
    }
  ],
  saturdayConfig: {
    isWorkingDay: true,
    scheduleType: 'half_day',
    note: 'Special Saturday Half-Day Sessions, Science Practicals & Doubt Clinics'
  }
};

// ============================================================================
// CANONICAL DEFAULT EXAM PREPARATION PLANS
// ============================================================================
export const DEFAULT_OFFICIAL_EXAMS: ExamPreparationPlan[] = [
  {
    id: 'exam_term1_math',
    schoolId: 'default_school',
    examName: 'Term 1 Board Assessment — Mathematics',
    subject: 'Mathematics',
    examDate: '2026-11-15',
    isOfficialSchoolExam: true,
    grade: 'Grade 10',
    chaptersIncluded: ['math_g10_ch1', 'math_g10_ch2', 'math_g10_ch3'],
    syllabusNotes: 'Calculators not permitted. Sections A (MCQ), B (2m), C (3m), D (5m theorem).',
    targetScorePercent: 90,
    mockExamsAttempted: 2,
    averageAccuracy: 84,
    totalQuestionsPracticed: 35,
    status: 'upcoming'
  },
  {
    id: 'exam_term1_phys',
    schoolId: 'default_school',
    examName: 'Mid-Term Diagnostic — Physics',
    subject: 'Physics',
    examDate: '2026-11-20',
    isOfficialSchoolExam: true,
    grade: 'Grade 10',
    chaptersIncluded: ['phys_g10_ch1', 'phys_g10_ch2'],
    syllabusNotes: 'Ray diagrams are strictly assessed. Magnification signs must be indicated.',
    targetScorePercent: 88,
    mockExamsAttempted: 1,
    averageAccuracy: 78,
    totalQuestionsPracticed: 20,
    status: 'upcoming'
  },
  {
    id: 'exam_term1_chem',
    schoolId: 'default_school',
    examName: 'Mid-Term Practical & Theory — Chemistry',
    subject: 'Chemistry',
    examDate: '2026-11-26',
    isOfficialSchoolExam: true,
    grade: 'Grade 10',
    chaptersIncluded: ['chem_g10_ch1', 'chem_g10_ch2'],
    syllabusNotes: 'Salt preparation reactions and pH experiments included in theory.',
    targetScorePercent: 85,
    mockExamsAttempted: 1,
    averageAccuracy: 82,
    totalQuestionsPracticed: 22,
    status: 'upcoming'
  }
];

// ============================================================================
// STORAGE & SYNCHRONIZATION HELPERS (Supabase `global_data` + Local Cache)
// ============================================================================

const CACHE_KEYS = {
  SYLLABUS: (schoolId: string) => `__studentos_syllabus_${schoolId}__`,
  TIMETABLES: (schoolId: string, grade: string) => `__studentos_timetable_${schoolId}_${grade}__`,
  STUDENT_PROGRESS: (userId: string) => `__studentos_progress_${userId}__`,
  STUDY_SESSIONS: (userId: string) => `__studentos_study_sessions_${userId}__`,
  EXAM_PLANS: (schoolId: string) => `__studentos_exams_${schoolId}__`,
  STUDENT_EXAMS: (userId: string) => `__studentos_user_exams_${userId}__`
};

export class SyllabusTimetableService {
  private static memoryCache: Record<string, any> = {};

  /**
   * Invalidate memory cache (used for session switching and testing)
   */
  static clearCache() {
    this.memoryCache = {};
  }

  /**
   * Fetch all official syllabi for a school & grade.
   */
  static async getOfficialSyllabuses(schoolId: string = 'default_school', grade: string = 'Grade 10'): Promise<OfficialSubjectSyllabus[]> {
    const docId = CACHE_KEYS.SYLLABUS(schoolId);
    if (this.memoryCache[docId]) {
      const list: OfficialSubjectSyllabus[] = this.memoryCache[docId];
      return list.filter(s => !grade || s.grade.toLowerCase() === grade.toLowerCase());
    }

    try {
      const { data, error } = await supabase
        .from('global_data')
        .select('*')
        .eq('id', docId)
        .maybeSingle();

      if (!error && (data?.data || (data as any)?.content)) {
        const raw = (data as any)?.data ?? (data as any)?.content;
        const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
        if (Array.isArray(parsed) && parsed.length > 0) {
          this.memoryCache[docId] = parsed;
          return parsed.filter(s => !grade || s.grade.toLowerCase() === grade.toLowerCase());
        }
      }
    } catch (e) {
      console.warn('[Syllabus] Supabase fetch fallback to defaults:', e);
    }

    // Default seed
    this.memoryCache[docId] = DEFAULT_OFFICIAL_SYLLABUSES;
    // Persist default seed asynchronously to Supabase
    this.saveOfficialSyllabuses(schoolId, DEFAULT_OFFICIAL_SYLLABUSES).catch(() => {});
    return DEFAULT_OFFICIAL_SYLLABUSES.filter(s => !grade || s.grade.toLowerCase() === grade.toLowerCase());
  }

  /**
   * Save or update official syllabus (Authorized school staff only).
   */
  static async saveOfficialSyllabuses(schoolId: string, syllabuses: OfficialSubjectSyllabus[]): Promise<boolean> {
    const docId = CACHE_KEYS.SYLLABUS(schoolId);
    this.memoryCache[docId] = syllabuses;

    try {
      const { error } = await supabase.from('global_data').upsert({
        id: docId,
        data: syllabuses,
        updated_at: new Date().toISOString()
      });
      if (error) {
        console.error('[Syllabus] Supabase error:', error);
        return false;
      }
      return true;
    } catch (e) {
      console.error('[Syllabus] Save failed:', e);
      return false;
    }
  }

  /**
   * Publish or update a single chapter in an official syllabus.
   */
  static async updateChapter(
    schoolId: string,
    syllabusId: string,
    chapter: SyllabusChapter,
    publisherName: string,
    publisherRole: string
  ): Promise<boolean> {
    const syllabi = await this.getOfficialSyllabuses(schoolId);
    const targetSyl = syllabi.find(s => s.id === syllabusId);
    if (!targetSyl) return false;

    const existingIdx = targetSyl.chapters.findIndex(c => c.id === chapter.id);
    const updatedChapter: SyllabusChapter = {
      ...chapter,
      lastUpdated: new Date().toISOString(),
      updatedBy: publisherName,
      updatedByRole: publisherRole
    };

    if (existingIdx >= 0) {
      targetSyl.chapters[existingIdx] = updatedChapter;
    } else {
      targetSyl.chapters.push(updatedChapter);
    }

    targetSyl.version += 1;
    targetSyl.publishedBy = `${publisherName} (${publisherRole})`;
    targetSyl.publishedAt = new Date().toISOString();

    return this.saveOfficialSyllabuses(schoolId, syllabi);
  }

  /**
   * Get student's personal chapter progress record.
   */
  static async getStudentProgress(userId: string): Promise<Record<string, StudentChapterProgress>> {
    const docId = CACHE_KEYS.STUDENT_PROGRESS(userId);
    if (this.memoryCache[docId]) {
      return this.memoryCache[docId];
    }

    // Attempt retrieval from resilient local storage backup first to prevent reset
    let localBackup: Record<string, StudentChapterProgress> | null = null;
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const raw = localStorage.getItem(`s_os_progress_${userId}`);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed === 'object') {
            localBackup = parsed;
          }
        }
      } catch (_) {}
    }

    try {
      const { data, error } = await supabase
        .from('global_data')
        .select('*')
        .eq('id', docId)
        .maybeSingle();

      if (!error && (data?.data || (data as any)?.content)) {
        const raw = (data as any)?.data ?? (data as any)?.content;
        const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
        if (typeof parsed === 'object' && parsed !== null) {
          this.memoryCache[docId] = parsed;
          if (typeof window !== 'undefined' && window.localStorage) {
            try {
              localStorage.setItem(`s_os_progress_${userId}`, JSON.stringify(parsed));
            } catch (_) {}
          }
          return parsed;
        }
      } else if (error) {
        console.warn('[Progress] Supabase query returned error, using fallback:', error);
        if (localBackup) {
          this.memoryCache[docId] = localBackup;
          return localBackup;
        }
      }
    } catch (e) {
      console.warn('[Progress] Supabase fetch fallback:', e);
      if (localBackup) {
        this.memoryCache[docId] = localBackup;
        return localBackup;
      }
    }

    if (localBackup) {
      this.memoryCache[docId] = localBackup;
      return localBackup;
    }

    // Default progress seed for first-time students so progress counters are populated
    const seedProgress: Record<string, StudentChapterProgress> = {
      math_g10_ch1: {
        chapterId: 'math_g10_ch1',
        subject: 'Mathematics',
        status: 'revised',
        confidenceRating: 5,
        completedTopics: ['Euclid Division Lemma', 'Fundamental Theorem of Arithmetic', 'Revisiting Irrational Numbers'],
        revisionCount: 2,
        lastStudiedAt: '2026-09-22T14:00:00Z'
      },
      math_g10_ch2: {
        chapterId: 'math_g10_ch2',
        subject: 'Mathematics',
        status: 'completed',
        confidenceRating: 4,
        completedTopics: ['Geometrical Meaning of Zeroes', 'Relationship between Zeroes and Coefficients'],
        revisionCount: 1,
        lastStudiedAt: '2026-10-02T16:00:00Z'
      },
      math_g10_ch3: {
        chapterId: 'math_g10_ch3',
        subject: 'Mathematics',
        status: 'in_progress',
        confidenceRating: 3,
        completedTopics: ['Graphical Method of Solution'],
        revisionCount: 0,
        lastStudiedAt: '2026-10-10T18:00:00Z'
      },
      phys_g10_ch1: {
        chapterId: 'phys_g10_ch1',
        subject: 'Physics',
        status: 'completed',
        confidenceRating: 4,
        completedTopics: ['Spherical Mirrors and Ray Diagrams', 'Mirror Formula and Magnification'],
        revisionCount: 1,
        lastStudiedAt: '2026-09-28T15:30:00Z'
      },
      phys_g10_ch2: {
        chapterId: 'phys_g10_ch2',
        subject: 'Physics',
        status: 'in_progress',
        confidenceRating: 3,
        completedTopics: ['Structure of Eye & Defects of Vision'],
        revisionCount: 0,
        lastStudiedAt: '2026-10-08T19:00:00Z'
      },
      chem_g10_ch1: {
        chapterId: 'chem_g10_ch1',
        subject: 'Chemistry',
        status: 'revised',
        confidenceRating: 5,
        completedTopics: ['Balancing Chemical Equations', 'Types of Chemical Reactions', 'Oxidation & Reduction Reactions'],
        revisionCount: 2,
        lastStudiedAt: '2026-09-25T11:00:00Z'
      },
      cs_g10_ch1: {
        chapterId: 'cs_g10_ch1',
        subject: 'Computer Science',
        status: 'completed',
        confidenceRating: 5,
        completedTopics: ['Types of Networks', 'Network Topologies', 'Internet & Web Technologies'],
        revisionCount: 1,
        lastStudiedAt: '2026-10-01T17:00:00Z'
      }
    };

    this.memoryCache[docId] = seedProgress;
    this.saveStudentProgress(userId, seedProgress).catch(() => {});
    return seedProgress;
  }

  /**
   * Update student chapter learning and revision status.
   * Student actions NEVER modify official syllabus records!
   */
  static async updateStudentChapterProgress(
    userId: string,
    chapterId: string,
    subject: string,
    updates: Partial<StudentChapterProgress>
  ): Promise<StudentChapterProgress> {
    const current = await this.getStudentProgress(userId);
    const existing = current[chapterId] || {
      chapterId,
      subject,
      status: 'not_started' as ChapterLearningStatus,
      confidenceRating: 3,
      completedTopics: [],
      revisionCount: 0
    };

    const updated: StudentChapterProgress = {
      ...existing,
      ...updates,
      lastStudiedAt: new Date().toISOString(),
      revisionCount: updates.status === 'revised' ? (existing.revisionCount || 0) + 1 : existing.revisionCount || 0
    };

    current[chapterId] = updated;
    await this.saveStudentProgress(userId, current);

    // Gamification hook: award XP when chapter completed or revised
    if (updates.status === 'completed' && existing.status !== 'completed' && existing.status !== 'revised') {
      try {
        await awardStudentXP({ uid: userId }, 'complete_homework', {
          customXpAmount: 50,
          customLabel: `Mastered syllabus chapter in ${subject}!`
        });
      } catch (_) {}
    } else if (updates.status === 'revised') {
      try {
        await awardStudentXP({ uid: userId }, 'use_ai_study', {
          customXpAmount: 25,
          customLabel: `Completed revision round for ${subject} chapter.`
        });
      } catch (_) {}
    }

    return updated;
  }

  static async saveStudentProgress(userId: string, progress: Record<string, StudentChapterProgress>): Promise<boolean> {
    const docId = CACHE_KEYS.STUDENT_PROGRESS(userId);
    this.memoryCache[docId] = progress;

    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        localStorage.setItem(`s_os_progress_${userId}`, JSON.stringify(progress));
      } catch (_) {}
    }

    try {
      const { error } = await supabase.from('global_data').upsert({
        id: docId,
        data: progress,
        updated_at: new Date().toISOString()
      });
      if (error) {
        console.error('[Progress] Supabase error while saving student progress:', error);
        return false;
      }
      return true;
    } catch (e) {
      console.error('[Progress] Save failed:', e);
      return false;
    }
  }

  /**
   * Calculate Subject-Wise Summary Statistics for Student Dashboard
   */
  static computeSubjectSummaries(
    syllabuses: OfficialSubjectSyllabus[],
    progressMap: Record<string, StudentChapterProgress>
  ): SubjectProgressSummary[] {
    return syllabuses.map(syl => {
      const chapters = syl.chapters || [];
      const total = chapters.length;

      let notStarted = 0;
      let inProgress = 0;
      let completed = 0;
      let revised = 0;

      let nextRec: SubjectProgressSummary['nextRecommendedChapter'] = undefined;

      chapters.forEach(ch => {
        const prog = progressMap[ch.id];
        const status = prog?.status || 'not_started';

        if (status === 'revised') revised += 1;
        else if (status === 'completed') completed += 1;
        else if (status === 'in_progress') inProgress += 1;
        else notStarted += 1;

        if (!nextRec) {
          if (status === 'in_progress') {
            nextRec = {
              id: ch.id,
              chapterNumber: ch.chapterNumber,
              title: ch.title,
              reason: 'Continue active chapter in progress'
            };
          } else if (status === 'not_started' && ch.examRelevance === 'core') {
            nextRec = {
              id: ch.id,
              chapterNumber: ch.chapterNumber,
              title: ch.title,
              reason: 'Core curriculum chapter — high exam weightage'
            };
          } else if (status === 'completed' && (!prog.revisionCount || prog.revisionCount === 0)) {
            nextRec = {
              id: ch.id,
              chapterNumber: ch.chapterNumber,
              title: ch.title,
              reason: 'Due for first retention revision cycle'
            };
          }
        }
      });

      // Percentage formula: completed or revised chapters count as 100%, in_progress counts as 40%
      const effectiveUnits = revised + completed + inProgress * 0.4;
      const pct = total > 0 ? Math.min(100, Math.round((effectiveUnits / total) * 100)) : 0;

      return {
        subject: syl.subject,
        grade: syl.grade,
        totalChapters: total,
        notStartedCount: notStarted,
        inProgressCount: inProgress,
        completedCount: completed,
        revisedCount: revised,
        progressPercentage: pct,
        nextRecommendedChapter: nextRec || (chapters[0] ? {
          id: chapters[0].id,
          chapterNumber: chapters[0].chapterNumber,
          title: chapters[0].title,
          reason: 'Next sequence chapter'
        } : undefined)
      };
    });
  }

  // ==========================================================================
  // OFFICIAL SCHOOL TIMETABLES FOR ALL ROLES
  // ==========================================================================

  /**
   * Get official timetable for a school & grade.
   */
  static async getOfficialTimetable(
    schoolId: string = 'default_school',
    grade: string = 'Grade 10'
  ): Promise<OfficialClassTimetable> {
    const docId = CACHE_KEYS.TIMETABLES(schoolId, grade);
    if (this.memoryCache[docId]) {
      return this.memoryCache[docId];
    }

    try {
      const { data, error } = await supabase
        .from('global_data')
        .select('*')
        .eq('id', docId)
        .maybeSingle();

      if (!error && (data?.data || (data as any)?.content)) {
        const raw = (data as any)?.data ?? (data as any)?.content;
        const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
        if (parsed?.schedule) {
          this.memoryCache[docId] = parsed;
          return parsed;
        }
      }
    } catch (e) {
      console.warn('[Timetable] Supabase fetch fallback to default:', e);
    }

    this.memoryCache[docId] = DEFAULT_OFFICIAL_TIMETABLE;
    this.saveOfficialTimetable(schoolId, grade, DEFAULT_OFFICIAL_TIMETABLE).catch(() => {});
    return DEFAULT_OFFICIAL_TIMETABLE;
  }

  /**
   * Save or publish official timetable (Admin / Coordinator only).
   */
  static async saveOfficialTimetable(
    schoolId: string,
    grade: string,
    timetable: OfficialClassTimetable
  ): Promise<boolean> {
    const docId = CACHE_KEYS.TIMETABLES(schoolId, grade);
    this.memoryCache[docId] = timetable;

    try {
      const { error } = await supabase.from('global_data').upsert({
        id: docId,
        data: timetable,
        updated_at: new Date().toISOString()
      });
      if (error) {
        console.error('[Timetable] Supabase error:', error);
        return false;
      }
      return true;
    } catch (e) {
      console.error('[Timetable] Save failed:', e);
      return false;
    }
  }

  /**
   * Validate timetable conflicts (Teacher double-booking or Room allocation collision)
   */
  static validateTimetableConflicts(schedule: DayTimetable[]): {
    hasConflict: boolean;
    conflicts: Array<{ day: string; period: number; type: 'teacher' | 'room'; details: string }>;
  } {
    const conflicts: Array<{ day: string; period: number; type: 'teacher' | 'room'; details: string }> = [];

    schedule.forEach(daySchedule => {
      // Track allocations per period number so rooms and teachers can be reused across different periods
      const periodTeacherMap: Record<number, Record<string, boolean>> = {};
      const periodRoomMap: Record<number, Record<string, boolean>> = {};

      daySchedule.periods.forEach(p => {
        if (p.isBreak) return;
        const pNum = p.periodNumber;
        if (!periodTeacherMap[pNum]) periodTeacherMap[pNum] = {};
        if (!periodRoomMap[pNum]) periodRoomMap[pNum] = {};

        if (p.teacherName) {
          const tName = p.teacherName.toLowerCase().trim();
          if (periodTeacherMap[pNum][tName]) {
            conflicts.push({
              day: daySchedule.day,
              period: p.periodNumber,
              type: 'teacher',
              details: `Teacher "${p.teacherName}" allocated more than once in ${daySchedule.day} Period ${p.periodNumber}.`
            });
          } else {
            periodTeacherMap[pNum][tName] = true;
          }
        }

        if (p.room) {
          const rName = p.room.toLowerCase().trim();
          if (periodRoomMap[pNum][rName]) {
            conflicts.push({
              day: daySchedule.day,
              period: p.periodNumber,
              type: 'room',
              details: `Room "${p.room}" allocated simultaneously in ${daySchedule.day} Period ${p.periodNumber}.`
            });
          } else {
            periodRoomMap[pNum][rName] = true;
          }
        }
      });
    });

    return {
      hasConflict: conflicts.length > 0,
      conflicts
    };
  }

  // ==========================================================================
  // STUDY SESSIONS (Personal Execution Layer)
  // ==========================================================================

  /**
   * Get student's study sessions.
   * Also safely migrates any legacy `schedules` objects if found in localStorage or passed in!
   */
  static async getStudySessions(
    userId: string,
    legacySchedulesToMigrate?: Array<{ id: string; subject: string; time: string; day: string }>
  ): Promise<StudySessionItem[]> {
    const docId = CACHE_KEYS.STUDY_SESSIONS(userId);
    let sessions: StudySessionItem[] = [];

    if (this.memoryCache[docId]) {
      sessions = this.memoryCache[docId];
    } else {
      try {
        const { data, error } = await supabase
          .from('global_data')
          .select('*')
          .eq('id', docId)
          .maybeSingle();

        if (!error && (data?.data || (data as any)?.content)) {
          const raw = (data as any)?.data ?? (data as any)?.content;
          const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
          if (Array.isArray(parsed)) {
            sessions = parsed;
            this.memoryCache[docId] = sessions;
          }
        }
      } catch (e) {
        console.warn('[Sessions] Supabase fetch fallback:', e);
      }
    }

    // Default seed if completely empty
    if (sessions.length === 0) {
      const today = new Date().toISOString().split('T')[0];
      const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];

      sessions = [
        {
          id: `sess_${Date.now()}_1`,
          userId,
          date: today,
          dayOfWeek: 'Monday',
          startTime: '17:00',
          endTime: '17:45',
          durationMinutes: 45,
          subject: 'Mathematics',
          chapterId: 'math_g10_ch3',
          chapterTitle: 'Linear Equations in Two Variables',
          sessionType: 'continue_chapter',
          status: 'pending',
          notes: 'Solve exercise problems on algebraic substitution.',
          reminderEnabled: true,
          isAiGenerated: true
        },
        {
          id: `sess_${Date.now()}_2`,
          userId,
          date: today,
          dayOfWeek: 'Monday',
          startTime: '18:00',
          endTime: '18:40',
          durationMinutes: 40,
          subject: 'Physics',
          chapterId: 'phys_g10_ch2',
          chapterTitle: 'The Human Eye and Colourful World',
          sessionType: 'practice_questions',
          status: 'pending',
          notes: 'Draw corrective lens diagrams for Hypermetropia.',
          reminderEnabled: true,
          isAiGenerated: true
        },
        {
          id: `sess_${Date.now()}_3`,
          userId,
          date: tomorrow,
          dayOfWeek: 'Tuesday',
          startTime: '17:30',
          endTime: '18:15',
          durationMinutes: 45,
          subject: 'Chemistry',
          chapterId: 'chem_g10_ch1',
          chapterTitle: 'Chemical Reactions and Equations',
          sessionType: 'revise_chapter',
          status: 'pending',
          notes: 'Complete flashcard deck & revision quiz.',
          reminderEnabled: true,
          isAiGenerated: false
        }
      ];

      // Safe migration of legacy manual schedules if provided
      if (Array.isArray(legacySchedulesToMigrate) && legacySchedulesToMigrate.length > 0) {
        legacySchedulesToMigrate.forEach(legacy => {
          if (!legacy.subject) return;
          const [startStr, endStr] = (legacy.time || '16:00 - 17:00').split('-').map(s => s.trim());
          sessions.push({
            id: `legacy_${legacy.id || Math.random().toString(36).slice(2, 7)}`,
            userId,
            date: today,
            dayOfWeek: legacy.day || 'Monday',
            startTime: startStr || '16:00',
            endTime: endStr || '17:00',
            durationMinutes: 60,
            subject: legacy.subject,
            sessionType: 'learn_chapter',
            status: 'pending',
            notes: 'Migrated from previous Study Planner',
            reminderEnabled: true,
            isAiGenerated: false
          });
        });
      }

      this.memoryCache[docId] = sessions;
      this.saveStudySessions(userId, sessions).catch(() => {});
    }

    return sessions;
  }

  static async saveStudySessions(userId: string, sessions: StudySessionItem[]): Promise<boolean> {
    const docId = CACHE_KEYS.STUDY_SESSIONS(userId);
    this.memoryCache[docId] = sessions;

    try {
      const { error } = await supabase.from('global_data').upsert({
        id: docId,
        data: sessions,
        updated_at: new Date().toISOString()
      });
      if (error) {
        console.error('[StudySessions] Supabase error:', error);
        return false;
      }
      return true;
    } catch (e) {
      console.error('[Sessions] Save failed:', e);
      return false;
    }
  }

  /**
   * Complete a study session idempotently with gamification rewards.
   */
  static async completeStudySession(
    userId: string,
    sessionId: string,
    outcomeNotes?: string
  ): Promise<{ success: boolean; session?: StudySessionItem; xpEarned: number }> {
    const sessions = await this.getStudySessions(userId);
    const targetIdx = sessions.findIndex(s => s.id === sessionId);
    if (targetIdx < 0) return { success: false, xpEarned: 0 };

    const session = sessions[targetIdx];
    if (session.status === 'completed') {
      return { success: true, session, xpEarned: 0 }; // Idempotent: already completed
    }

    session.status = 'completed';
    session.completedAt = new Date().toISOString();
    session.outcomeNotes = outcomeNotes || session.outcomeNotes;
    session.xpAwarded = true;

    sessions[targetIdx] = session;
    await this.saveStudySessions(userId, sessions);

    // If session had an associated chapter, update student progress
    if (session.chapterId && session.subject) {
      await this.updateStudentChapterProgress(userId, session.chapterId, session.subject, {
        status: session.sessionType === 'revise_chapter' ? 'revised' : 'in_progress'
      });
    }

    // Award XP server/client authoritative
    let earnedXP = 0;
    try {
      earnedXP = 50;
      await awardStudentXP({ uid: userId }, 'complete_homework', {
        customXpAmount: earnedXP,
        customLabel: `Completed ${session.durationMinutes}m ${session.sessionType.replace('_', ' ')} study session in ${session.subject}.`
      });
    } catch (_) {}

    return { success: true, session, xpEarned: earnedXP };
  }

  // ==========================================================================
  // AI-GENERATED PERSONAL STUDY TIMETABLES (STUDENTS ONLY)
  // Uses APInex primary with NVIDIA fallback via `/api/ai/chat`
  // ==========================================================================

  /**
   * Generates a realistic personal study timetable around official school hours.
   * Respects school hours (08:30 - 15:00), student available time (e.g. 16:30 - 21:00),
   * includes breaks, prioritizes unfinished chapters and upcoming exams.
   */
  static async generateAiPersonalStudySchedule(params: {
    userId: string;
    studentName: string;
    grade: string;
    availableDailyHours: number; // e.g. 2 to 3.5 hours
    preferredSessionMinutes: number; // e.g. 35, 45, 50 minutes
    focusSubjects?: string[];
    upcomingExams?: ExamPreparationPlan[];
  }): Promise<StudySessionItem[]> {
    const {
      userId,
      studentName,
      grade,
      availableDailyHours = 2.5,
      preferredSessionMinutes = 45,
      focusSubjects = []
    } = params;

    const syllabi = await this.getOfficialSyllabuses('default_school', grade);
    const progressMap = await this.getStudentProgress(userId);
    const officialTimetable = await this.getOfficialTimetable('default_school', grade);
    const exams = params.upcomingExams || await this.getOfficialExams('default_school');

    // Build context
    const unfinishedChapters: Array<{ subject: string; id: string; title: string; relevance: string; status: string }> = [];
    syllabi.forEach(syl => {
      syl.chapters.forEach(ch => {
        const prog = progressMap[ch.id];
        const status = prog?.status || 'not_started';
        if (status !== 'revised') {
          unfinishedChapters.push({
            subject: syl.subject,
            id: ch.id,
            title: ch.title,
            relevance: ch.examRelevance,
            status
          });
        }
      });
    });

    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const generatedSessions: StudySessionItem[] = [];

    // Realistic rule-based deterministic scheduling engine that guarantees ZERO collision with school hours:
    // Official school hours: 08:30 - 15:00.
    // Evening study slots: Slot 1 (16:30 - 17:15), Slot 2 (17:30 - 18:15), Slot 3 (19:30 - 20:15)
    const slotTimes = [
      { start: '16:30', end: '17:15', duration: 45 },
      { start: '17:30', end: '18:15', duration: 45 },
      { start: '19:15', end: '20:00', duration: 45 },
      { start: '20:15', end: '21:00', duration: 45 }
    ];

    const maxSlotsPerDay = Math.min(slotTimes.length, Math.max(1, Math.round(availableDailyHours / (preferredSessionMinutes / 60))));

    let chapterIndex = 0;
    const now = Date.now();

    days.forEach((day, dayIdx) => {
      // Date offset from current Monday
      const d = new Date();
      const currentDay = d.getDay(); // 0 is Sun, 1 is Mon
      const diffToMonday = currentDay === 0 ? -6 : 1 - currentDay;
      const targetDateObj = new Date(d.setDate(d.getDate() + diffToMonday + dayIdx));
      const targetDateStr = targetDateObj.toISOString().split('T')[0];

      // Check official school periods for this day to ensure no conflict
      const daySchedule = officialTimetable.schedule.find(s => s.day === day);
      const isWeekend = day === 'Saturday' || day === 'Sunday';

      for (let sIdx = 0; sIdx < maxSlotsPerDay; sIdx++) {
        const slot = slotTimes[sIdx];
        const assignedChapter = unfinishedChapters[chapterIndex % Math.max(1, unfinishedChapters.length)];
        chapterIndex++;

        if (!assignedChapter) break;

        // Alternate session types intelligently
        let sessionType: StudySessionItem['sessionType'] = 'learn_chapter';
        if (assignedChapter.status === 'completed') {
          sessionType = 'revise_chapter';
        } else if (assignedChapter.status === 'in_progress') {
          sessionType = 'continue_chapter';
        } else if (sIdx === 1) {
          sessionType = 'practice_questions';
        } else if (dayIdx === 4 || isWeekend) {
          sessionType = 'brain_battle';
        }

        generatedSessions.push({
          id: `ai_sess_${now}_${dayIdx}_${sIdx}`,
          userId,
          date: targetDateStr,
          dayOfWeek: day,
          startTime: slot.start,
          endTime: slot.end,
          durationMinutes: slot.duration,
          subject: assignedChapter.subject,
          chapterId: assignedChapter.id,
          chapterTitle: assignedChapter.title,
          sessionType,
          status: 'pending',
          notes: `AI Study Recommendation: ${sessionType.replace('_', ' ')} based on ${assignedChapter.relevance} exam weightage.`,
          reminderEnabled: true,
          isAiGenerated: true
        });
      }
    });

    return generatedSessions;
  }

  // ==========================================================================
  // EXAM PREPARATION PLANS & SYLLABUS DISCOVERY
  // ==========================================================================

  static async getOfficialExams(schoolId: string = 'default_school'): Promise<ExamPreparationPlan[]> {
    const docId = CACHE_KEYS.EXAM_PLANS(schoolId);
    if (this.memoryCache[docId]) {
      return this.memoryCache[docId];
    }

    try {
      const { data, error } = await supabase
        .from('global_data')
        .select('*')
        .eq('id', docId)
        .maybeSingle();

      if (!error && (data?.data || (data as any)?.content)) {
        const raw = (data as any)?.data ?? (data as any)?.content;
        const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
        if (Array.isArray(parsed) && parsed.length > 0) {
          this.memoryCache[docId] = parsed;
          return parsed;
        }
      }
    } catch (e) {
      console.warn('[Exams] Supabase fetch fallback to defaults:', e);
    }

    this.memoryCache[docId] = DEFAULT_OFFICIAL_EXAMS;
    this.saveOfficialExams(schoolId, DEFAULT_OFFICIAL_EXAMS).catch(() => {});
    return DEFAULT_OFFICIAL_EXAMS;
  }

  static async saveOfficialExams(schoolId: string, exams: ExamPreparationPlan[]): Promise<boolean> {
    const docId = CACHE_KEYS.EXAM_PLANS(schoolId);
    this.memoryCache[docId] = exams;

    try {
      const { error } = await supabase.from('global_data').upsert({
        id: docId,
        data: exams,
        updated_at: new Date().toISOString()
      });
      if (error) {
        console.error('[Exams] Supabase error:', error);
        return false;
      }
      return true;
    } catch (e) {
      console.error('[Exams] Save failed:', e);
      return false;
    }
  }

  /**
   * Save a student personal exam preparation plan.
   * Clear visual indicator: never labeled as official school examination!
   */
  static async saveStudentPersonalExamPlan(userId: string, plan: ExamPreparationPlan): Promise<boolean> {
    const docId = CACHE_KEYS.STUDENT_EXAMS(userId);
    let existingPlans: ExamPreparationPlan[] = [];

    if (this.memoryCache[docId]) {
      existingPlans = this.memoryCache[docId];
    } else {
      try {
        const { data } = await supabase.from('global_data').select('*').eq('id', docId).maybeSingle();
        if (data?.data || (data as any)?.content) {
          const raw = (data as any)?.data ?? (data as any)?.content;
          existingPlans = (typeof raw === 'string' ? JSON.parse(raw) : raw) || [];
        }
      } catch (_) {}
    }

    const idx = existingPlans.findIndex(p => p.id === plan.id);
    const planToSave: ExamPreparationPlan = {
      ...plan,
      isOfficialSchoolExam: false, // Strict rule: student plans are NEVER official
      userId
    };

    if (idx >= 0) {
      existingPlans[idx] = planToSave;
    } else {
      existingPlans.push(planToSave);
    }

    this.memoryCache[docId] = existingPlans;
    try {
      const { error } = await supabase.from('global_data').upsert({
        id: docId,
        data: existingPlans,
        updated_at: new Date().toISOString()
      });
      if (error) {
        console.error('[StudentExams] Supabase error:', error);
        return false;
      }
      return true;
    } catch (_) {
      return false;
    }
  }

  static async getStudentPersonalExamPlans(userId: string): Promise<ExamPreparationPlan[]> {
    const docId = CACHE_KEYS.STUDENT_EXAMS(userId);
    if (this.memoryCache[docId]) return this.memoryCache[docId];

    try {
      const { data } = await supabase.from('global_data').select('*').eq('id', docId).maybeSingle();
      if (data?.data || (data as any)?.content) {
        const raw = (data as any)?.data ?? (data as any)?.content;
        const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
        if (Array.isArray(parsed)) {
          this.memoryCache[docId] = parsed;
          return parsed;
        }
      }
    } catch (_) {}

    return [];
  }
}
