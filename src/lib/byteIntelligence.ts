/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Byte Multi-Role Intelligence & Scoped Context Engine
 * - Tailored capabilities, terminology, module guidance, and starter prompts for ALL 6 roles:
 *   student | teacher | coordinator (also maps hod) | admin | super_admin | parent
 * - Strict RBAC & Parent-Child Isolation (parents only ever receive linked-child records)
 * - Understands natural follow-ups, role operations, Veylentra navigation, and pure concept help
 */

import { supabase as defaultSupabase } from './supabase';
import { getAuthorizedGrades, getAuthorizedSections } from '../config/facultyPermissions';
import { UserProfile } from '../types';

export type ByteNormalizedRole =
  | 'student'
  | 'teacher'
  | 'coordinator'
  | 'admin'
  | 'super_admin'
  | 'parent';

export interface ByteStarterPrompt {
  title: string;
  subtitle: string;
  prompt: string;
  category: string;
}

export interface ByteModuleShortcut {
  label: string;
  tabId: string;
  description: string;
}

export interface ByteRoleProfile {
  role: ByteNormalizedRole;
  displayLabel: string;
  greetingTagline: string;
  capabilitiesSummary: string;
  scopeBoundaryNote: string;
  starterPrompts: ByteStarterPrompt[];
  followUpSuggestions: { label: string; prompt: string }[];
  modules: ByteModuleShortcut[];
}

export type ByteIntentCategory =
  | 'academic_concept'
  | 'math_science_derivation'
  | 'role_workspace_data'
  | 'platform_guidance'
  | 'follow_up_refinement'
  | 'web_research';

export interface ByteLocalSnapshot {
  homeworkList?: any[];
  vaultNotes?: any[];
  materials?: any[];
  schedule?: any[];
  tasks?: any[];
  notifications?: any[];
}

export interface BuildByteContextOptions {
  activeTab?: string;
  linkedStudents?: UserProfile[];
  localSnapshot?: ByteLocalSnapshot;
  supabaseClient?: any;
  fetchLinkedChildren?: (parentUid: string) => Promise<UserProfile[]>;
}

export interface BuiltByteContextResult {
  normalizedRole: ByteNormalizedRole;
  contextString: string;
  retrievalMs: number;
  hasVeylentraData: boolean;
  intentCategory: ByteIntentCategory;
  scopeSummary: string;
  unlinkedParent?: boolean;
}

const SHORT_CACHE_TTL_MS = 25000;
const roleContextCache = new Map<string, { timestamp: number; result: BuiltByteContextResult }>();

if (typeof window !== 'undefined') {
  window.addEventListener('studentos-db-update', () => {
    roleContextCache.clear();
  });
}

export function clearByteContextCache(): void {
  roleContextCache.clear();
}

export function normalizeByteRole(rawRole?: string | null): ByteNormalizedRole {
  const norm = String(rawRole || 'student').toLowerCase().trim();
  if (norm === 'super_admin') return 'super_admin';
  if (norm === 'admin') return 'admin';
  if (norm === 'coordinator' || norm === 'hod') return 'coordinator';
  if (norm === 'teacher' || norm === 'faculty' || norm === 'head_teacher') return 'teacher';
  if (norm === 'parent' || norm === 'guardian') return 'parent';
  return 'student';
}

export function sanitizeByteContextText(input: unknown, maxLen = 320): string {
  if (input === null || input === undefined) return '';
  return String(input)
    .replace(/<\/?studentos_authorized_context>/gi, '')
    .replace(/\b(ignore previous instructions|system prompt|override permissions|you are now)\b/gi, '[filtered]')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLen);
}

export const ROLE_CAPABILITY_PROFILES: Record<ByteNormalizedRole, ByteRoleProfile> = {
  student: {
    role: 'student',
    displayLabel: 'Student',
    greetingTagline: 'Step-by-step derivations, assignment help, exam prep & personal Veylentra insights.',
    capabilitiesSummary:
      'Explains formulas cleanly in LaTeX, checks your pending homework & personal attendance, plans revision, and builds flashcards or interactive lessons.',
    scopeBoundaryNote: 'Scoped to your own notes, personal attendance, and your grade assignments.',
    starterPrompts: [
      {
        title: 'Check Due Work',
        subtitle: 'Summarize my pending assignments & next steps',
        prompt: 'What homework or deadlines are pending for my class right now, and how should I prioritize them?',
        category: 'My Workload'
      },
      {
        title: 'Calculus Derivation',
        subtitle: 'Chain rule & integrals with full LaTeX steps',
        prompt: 'Derive the chain rule and integrate $\\int x e^{x^2} \\, dx$ step by step with LaTeX formatting.',
        category: 'Mathematics'
      },
      {
        title: 'Chemistry Equations',
        subtitle: 'Stoichiometry, equilibrium & balanced reactions',
        prompt: 'Explain Le Chatelier principle with a balanced reaction like $\\ce{N2 + 3H2 <=> 2NH3}$ and exam tips.',
        category: 'Science'
      },
      {
        title: '5-Day Revision Plan',
        subtitle: 'Structured study schedule from my topics',
        prompt: 'Build a focused 5-day revision schedule based on my upcoming schedule and pending subjects.',
        category: 'Study Plan'
      }
    ],
    followUpSuggestions: [
      { label: 'Explain Simply', prompt: 'Explain the previous concept more simply with an everyday analogy.' },
      { label: 'Step-by-Step Math', prompt: 'Show every algebraic and calculus step cleanly using LaTeX.' },
      { label: 'Worked Examples', prompt: 'Give 2 exam-style worked examples with complete solutions.' },
      { label: 'Quiz Me (5 Qs)', prompt: 'Quiz me with 5 targeted practice questions and provide solutions at the end.' },
      { label: 'Make Flashcards', prompt: 'Create 6 Q: / A: flashcards for the key formulas and definitions above.' },
      { label: 'Quick Summary', prompt: 'Condense the key takeaways into a concise formula and concept sheet.' }
    ],
    modules: [
      { label: 'Homework', tabId: 'homework', description: 'View class assignments and due dates' },
      { label: 'Lecture Notes', tabId: 'notes', description: 'Personal study vault and formulas' },
      { label: 'Study Hub', tabId: 'study_hub', description: 'Planner, tasks & flashcards' },
      { label: 'Attendance', tabId: 'attendance_manager', description: 'Personal attendance percentage' }
    ]
  },

  teacher: {
    role: 'teacher',
    displayLabel: 'Faculty / Teacher',
    greetingTagline: 'Lesson design, rubric creation, class submission triage & cohort support.',
    capabilitiesSummary:
      'Assists with assigned class homework tracking, submission backlogs, differentiated worksheets, grading rubrics, LaTeX exam papers, and parent communication drafts.',
    scopeBoundaryNote: 'Scoped strictly to your assigned grades, sections, and teaching materials.',
    starterPrompts: [
      {
        title: 'Class Workload Check',
        subtitle: 'Review active homework & submission gaps',
        prompt: 'Summarize my current assigned class homework and highlight where submissions need follow-up.',
        category: 'Class Ops'
      },
      {
        title: 'Differentiated Lesson Plan',
        subtitle: '45-min lesson with starter, lab & exit ticket',
        prompt: 'Draft a 45-minute lesson plan for my class including misconceptions, a worked math/science example, and an exit ticket.',
        category: 'Pedagogy'
      },
      {
        title: 'Exam Paper Equations',
        subtitle: 'Formatted question set + marking rubric',
        prompt: 'Create a 5-question medium-to-hard quiz with LaTeX equations and an analytical marking rubric.',
        category: 'Assessment'
      },
      {
        title: 'Parent Update Draft',
        subtitle: 'Constructive feedback note template',
        prompt: 'Draft a supportive, concrete parent progress message for a student missing recent assignments.',
        category: 'Communication'
      }
    ],
    followUpSuggestions: [
      { label: 'Add Marking Rubric', prompt: 'Add a clear point-by-point marking rubric for the assessment above.' },
      { label: 'Scaffold for Beginners', prompt: 'Create a simpler scaffolded version for students needing extra support.' },
      { label: 'Challenge Extension', prompt: 'Add 2 Olympiad/extension questions with worked solutions.' },
      { label: 'Quiz Format', prompt: 'Convert this topic into 5 formative check questions.' },
      { label: 'Make Flashcards', prompt: 'Generate 6 revision flashcards I can share with my students.' }
    ],
    modules: [
      { label: 'Faculty Center', tabId: 'faculty', description: 'Classes, gradebook & evaluation' },
      { label: 'Attendance', tabId: 'attendance_manager', description: 'Take daily class attendance' },
      { label: 'Homework', tabId: 'homework', description: 'Publish and inspect class tasks' },
      { label: 'Materials', tabId: 'materials', description: 'Upload curriculum notes & slides' }
    ]
  },

  coordinator: {
    role: 'coordinator',
    displayLabel: 'Academic Coordinator',
    greetingTagline: 'Cross-section oversight, attendance compliance, circulars & curriculum pacing.',
    capabilitiesSummary:
      'Monitors attendance compliance across authorized grades, reviews homework completion coverage, drafts academic circulars, and supports timetable coordination.',
    scopeBoundaryNote: 'Scoped to your authorized grades and sections.',
    starterPrompts: [
      {
        title: 'Cohort Health Snapshot',
        subtitle: 'Attendance compliance & assignment pace',
        prompt: 'Give me an operational summary of attendance compliance and active assignments across my authorized grades.',
        category: 'Oversight'
      },
      {
        title: 'Academic Circular Draft',
        subtitle: 'Pre-exam readiness notice for students & staff',
        prompt: 'Draft a clear academic circular reminding teachers and students about upcoming assessment timelines and submission standards.',
        category: 'Circulars'
      },
      {
        title: 'Low-Attendance Action Plan',
        subtitle: 'Early intervention workflow across sections',
        prompt: 'Suggest a structured intervention checklist for sections showing rising absences or late trends.',
        category: 'Compliance'
      },
      {
        title: 'Department Calibration',
        subtitle: 'Standardize rubrics & syllabus checkpoints',
        prompt: 'Create a syllabus pacing & rubric calibration agenda for a 30-minute department sync.',
        category: 'Leadership'
      }
    ],
    followUpSuggestions: [
      { label: 'Convert to Circular', prompt: 'Format the recommendations above as a ready-to-send school circular.' },
      { label: 'Action Checklist', prompt: 'Turn this into a prioritized action checklist by section and owner.' },
      { label: 'Faculty Talking Points', prompt: 'Summarize key talking points for my next faculty briefing.' },
      { label: 'Deep Analysis', prompt: 'Break down root causes and measurable metrics step by step.' }
    ],
    modules: [
      { label: 'Coordinator Workspace', tabId: 'faculty', description: 'Section oversight & circulars' },
      { label: 'Attendance Alerts', tabId: 'attendance_manager', description: 'Grade attendance health' },
      { label: 'Broadcasts', tabId: 'broadcasts', description: 'Publish school & grade notices' },
      { label: 'Timetable', tabId: 'timetable_viewer', description: 'Schedule and coverage' }
    ]
  },

  admin: {
    role: 'admin',
    displayLabel: 'School Administrator',
    greetingTagline: 'Institutional pulse, communications governance, operations & policy intelligence.',
    capabilitiesSummary:
      'Provides institution-wide attendance and academic workload summaries, drafts official notices and policy briefs, and helps coordinate cross-role school operations.',
    scopeBoundaryNote: 'Institutional oversight scope across school records.',
    starterPrompts: [
      {
        title: 'Institutional Operations Brief',
        subtitle: 'Active users, today attendance & deadlines',
        prompt: 'Provide a concise institutional operations briefing from available Veylentra records.',
        category: 'Executive'
      },
      {
        title: 'Campus Policy Notice',
        subtitle: 'Clear official announcement for all roles',
        prompt: 'Draft a concise, high-clarity school announcement regarding exam conduct and attendance expectations.',
        category: 'Governance'
      },
      {
        title: 'Term Calendar Audit',
        subtitle: 'Review upcoming events & scheduling risks',
        prompt: 'Review our upcoming school calendar events and flag scheduling overlaps or communication needs.',
        category: 'Planning'
      },
      {
        title: 'Staff Alignment Brief',
        subtitle: 'Weekly priorities for teachers & coordinators',
        prompt: 'Prepare a structured weekly leadership agenda covering attendance, grading turnaround, and parent engagement.',
        category: 'Leadership'
      }
    ],
    followUpSuggestions: [
      { label: 'Executive Summary', prompt: 'Condense that into a 5-bullet executive briefing.' },
      { label: 'Draft Broadcast Copy', prompt: 'Draft crisp student and parent broadcast messages from this.' },
      { label: 'Risk Checklist', prompt: 'Identify operational risks and concrete mitigations.' },
      { label: 'Quant Metrics', prompt: 'Present the figures and comparisons in a clean table.' }
    ],
    modules: [
      { label: 'Admin Control', tabId: 'admin', description: 'User approvals & school settings' },
      { label: 'Faculty Oversight', tabId: 'faculty', description: 'Academic quality & gradebooks' },
      { label: 'Broadcast Center', tabId: 'broadcasts', description: 'Targeted institutional notices' },
      { label: 'Veylentra Life', tabId: 'life', description: 'Events, houses & competitions' }
    ]
  },

  super_admin: {
    role: 'super_admin',
    displayLabel: 'Super Administrator',
    greetingTagline: 'Full platform governance, diagnostics, AI routing insights & institutional analytics.',
    capabilitiesSummary:
      'Combines institutional data intelligence with platform governance guidance, diagnostics reasoning, role-boundary auditing, and strategic summaries.',
    scopeBoundaryNote: 'Full administrative scope (never fabricates hidden runtime logs).',
    starterPrompts: [
      {
        title: 'Platform & School Audit',
        subtitle: 'Directory breakdown, attendance & active modules',
        prompt: 'Give me a verified snapshot of current Veylentra users, recent attendance activity, and active academic modules.',
        category: 'Platform'
      },
      {
        title: 'RBAC & Parent Isolation Check',
        subtitle: 'Verify role permissions & data boundaries',
        prompt: 'Outline how Veylentra role permissions separate Student, Teacher, Coordinator, Parent, Admin, and Super Admin scopes.',
        category: 'Security'
      },
      {
        title: 'AI Routing Architecture',
        subtitle: 'Ministral, Groq & Z.ai (GLM-4.7 Flash) summary',
        prompt: 'Summarize how Byte and Orion route requests across Ministral, Groq, and Z.ai GLM-4.7 Flash while keeping Orion ephemeral.',
        category: 'Diagnostics'
      },
      {
        title: 'Executive Readiness Report',
        subtitle: 'School-wide engagement & priority actions',
        prompt: 'Build an executive readiness report from currently available Veylentra database counts and upcoming events.',
        category: 'Strategy'
      }
    ],
    followUpSuggestions: [
      { label: 'Security Audit Lens', prompt: 'Inspect edge cases and permission checks for that workflow.' },
      { label: 'Executive Brief', prompt: 'Turn that into a structured markdown report.' },
      { label: 'Draft System Notice', prompt: 'Draft a clear system notice for staff and students.' },
      { label: 'Compare Metrics', prompt: 'Display the comparative breakdown in a structured table.' }
    ],
    modules: [
      { label: 'System Admin', tabId: 'admin', description: 'Directory, quotas & diagnostics' },
      { label: 'Feature Governance', tabId: 'admin', description: 'Role access & module toggles' },
      { label: 'Broadcast Center', tabId: 'broadcasts', description: 'Platform-wide announcements' },
      { label: 'Faculty Oversight', tabId: 'faculty', description: 'Academic operations view' }
    ]
  },

  parent: {
    role: 'parent',
    displayLabel: 'Parent / Guardian',
    greetingTagline: 'Clarity on your linked child’s homework, attendance, upcoming dates & study support.',
    capabilitiesSummary:
      'Shares verified updates strictly for your OTP-linked child (or guides you to link your child in Parental Portal), plus explains school concepts simply so you can help at home.',
    scopeBoundaryNote: 'Strictly isolated to your verified linked children only.',
    starterPrompts: [
      {
        title: 'Child Weekly Summary',
        subtitle: 'Attendance, pending homework & upcoming dates',
        prompt: 'How is my child doing right now? Summarize their recent attendance and any pending homework.',
        category: 'Child Progress'
      },
      {
        title: 'Homework Support Guide',
        subtitle: 'How I can help my child study at home',
        prompt: 'Help me understand what homework is due for my child and suggest practical ways I can support them tonight.',
        category: 'Home Study'
      },
      {
        title: 'Explain Topic Simply',
        subtitle: 'Parent-friendly explanation of a math/science topic',
        prompt: 'Explain quadratic equations simply so I can walk through a homework question with my child step by step.',
        category: 'Concept Helper'
      },
      {
        title: 'Upcoming School Dates',
        subtitle: 'Events, exams & recent parent notices',
        prompt: 'What upcoming school calendar events or parent notices should our family keep in mind?',
        category: 'Calendar'
      }
    ],
    followUpSuggestions: [
      { label: 'Simple Parent Guide', prompt: 'Explain how I can guide my child through this in 5 minutes without giving away the answer.' },
      { label: 'Evening Study Plan', prompt: 'Turn my child’s pending tasks into a calm 45-minute evening routine.' },
      { label: 'Practice Check', prompt: 'Give 3 quick oral check questions I can ask my child.' },
      { label: 'Step-by-Step Worked Key', prompt: 'Provide the full worked solution in clear LaTeX so I can check my child’s work.' }
    ],
    modules: [
      { label: 'Parental Portal', tabId: 'parent_portal', description: 'Linked child overview & OTP linking' },
      { label: 'Calendar & Notices', tabId: 'notice_viewer', description: 'Official school announcements' },
      { label: 'Timetable', tabId: 'timetable_viewer', description: 'Weekly class schedule' }
    ]
  }
};

export function classifyByteIntent(
  prompt: string,
  role: ByteNormalizedRole,
  activeTab?: string
): ByteIntentCategory {
  const lower = (prompt || '').toLowerCase().trim();

  if (/^(explain the previous|break this down|give 2|quiz me|create 6|condense|simpler|why does|step-by-step|follow up)/i.test(lower)) {
    return 'follow_up_refinement';
  }

  if (/\b(where is|how do i open|which tab|navigate|go to|how to link|parental portal|veylentra life|material hub|study hub|faculty center)\b/i.test(lower)) {
    return 'platform_guidance';
  }

  if (/\b(search|look up|latest|current news|who won|find online|recent updates on)\b/i.test(lower)) {
    return 'web_research';
  }

  if (doesPromptNeedRoleContext(prompt, role, activeTab)) {
    return 'role_workspace_data';
  }

  if (/\b(equation|derive|integral|derivative|matrix|vector|theorem|pythagor|trigonometry|calculus|stoichiometry|molarity|physics|chemistry|chemical|algebra|quadratic|polynomial|fraction|limit|probability)\b/i.test(lower)) {
    return 'math_science_derivation';
  }

  return 'academic_concept';
}

export function doesPromptNeedRoleContext(
  prompt: string,
  role?: string | ByteNormalizedRole,
  _activeTab?: string
): boolean {
  const lower = (prompt || '').toLowerCase();
  const normRole = normalizeByteRole(role);

  const sharedContextPatterns = [
    /\b(my|our|school|class|classes|section|sections|grade|grades|veylentra|studentos)\b/i,
    /\b(homework|assignment|assignments|due|deadline|deadlines|pending|overdue|submit|submission|submissions)\b/i,
    /\b(note|notes|lecture|vault|material|materials|resource|resources|syllabus|chapter)\b/i,
    /\b(test|exam|quiz|schedule|timetable|planner|study plan|calendar|event|events|tomorrow|today|this week|upcoming)\b/i,
    /\b(attendance|present|absent|late|leave|compliance)\b/i,
    /\b(flashcard|flashcards|deck|study center)\b/i,
    /\b(house|ruby|emerald|sapphire|topaz|points|xp|streak|level|badge|badges|leaderboard|competition|club|clubs|poll)\b/i,
    /\b(notice|notices|announcement|announcements|notification|notifications|broadcast|circular|meet|meeting)\b/i
  ];

  if (sharedContextPatterns.some((rx) => rx.test(lower))) {
    return true;
  }

  if (normRole === 'parent') {
    return /\b(child|children|kid|kids|son|daughter|ward|linked|parent|progress|report|doing)\b/i.test(lower);
  }

  if (normRole === 'teacher' || normRole === 'coordinator') {
    return /\b(student|students|cohort|roster|backlog|evaluate|grading|evaluation|department|pacing|assigned)\b/i.test(lower);
  }

  if (normRole === 'admin' || normRole === 'super_admin') {
    return /\b(institutional|overview|briefing|users|directory|analytics|audit|diagnostics|system|health|approval|approvals|quota|status)\b/i.test(lower);
  }

  return false;
}

function readLocalLinkedChildren(parentUid: string, email?: string): UserProfile[] {
  if (typeof localStorage === 'undefined') return [];
  const candidateKeys = [
    `s_os_linked_students_${parentUid}`,
    email ? `s_os_linked_students_${email}` : ''
  ].filter(Boolean);

  for (const k of candidateKeys) {
    try {
      const raw = localStorage.getItem(k);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch {
      // ignore corrupted local cache
    }
  }
  return [];
}

async function resolveVerifiedLinkedChildren(
  currentUser: any,
  options?: BuildByteContextOptions
): Promise<UserProfile[]> {
  if (Array.isArray(options?.linkedStudents)) {
    return options.linkedStudents;
  }

  const uid = String(currentUser?.uid || currentUser?.id || '').trim();
  if (!uid || uid === 'guest') return [];

  if (options?.fetchLinkedChildren) {
    try {
      const fetched = await options.fetchLinkedChildren(uid);
      if (Array.isArray(fetched)) return fetched;
    } catch {
      // fall through
    }
  }

  // Try API endpoint when running in browser
  if (typeof fetch === 'function') {
    try {
      const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
      const timer = controller ? setTimeout(() => controller.abort(), 1400) : null;
      const res = await fetch(`/api/parent/linked-children?parentUid=${encodeURIComponent(uid)}`, {
        signal: controller?.signal
      });
      if (timer) clearTimeout(timer);
      if (res.ok) {
        const json = await res.json().catch(() => null);
        if (json?.success && Array.isArray(json.children)) {
          return json.children;
        }
      }
    } catch {
      // fall back to local verified cache if offline
    }
  }

  return readLocalLinkedChildren(uid, currentUser?.email);
}

/**
 * Builds role-authorized, strictly scoped Veylentra context for Byte AI across all 6 roles.
 */
export async function buildRoleAwareByteContext(
  prompt: string,
  currentUser: any,
  effectiveRole: string,
  options: BuildByteContextOptions = {}
): Promise<BuiltByteContextResult> {
  const start = Date.now();
  const normalizedRole = normalizeByteRole(effectiveRole || currentUser?.role);
  const roleProfile = ROLE_CAPABILITY_PROFILES[normalizedRole];
  const intentCategory = classifyByteIntent(prompt, normalizedRole, options.activeTab);

  if (!currentUser) {
    return {
      normalizedRole,
      contextString: `Active Role: ${roleProfile.displayLabel} | Scope: Guest`,
      retrievalMs: 0,
      hasVeylentraData: false,
      intentCategory,
      scopeSummary: 'Guest session'
    };
  }

  const userId = String(currentUser.uid || currentUser.id || currentUser.email || 'guest');
  const userGrade = String(currentUser.grade || 'Grade 10');
  const userSection = String(currentUser.section || 'Solara');
  const schoolId = String(currentUser.school_id || currentUser.schoolId || 'default_school');
  const sb = options.supabaseClient !== undefined ? options.supabaseClient : defaultSupabase;

  const authorizedGrades =
    normalizedRole === 'teacher' || normalizedRole === 'coordinator'
      ? getAuthorizedGrades(currentUser)
      : [userGrade];
  const authorizedSections =
    normalizedRole === 'teacher' || normalizedRole === 'coordinator'
      ? getAuthorizedSections(currentUser)
      : [userSection];

  const scopeSummary =
    normalizedRole === 'student'
      ? `${userGrade} · ${userSection}`
      : normalizedRole === 'teacher'
        ? `Assigned: ${authorizedGrades.join(', ')} (${authorizedSections.join(', ')})`
        : normalizedRole === 'coordinator'
          ? `Oversight: ${authorizedGrades.join(', ')}`
          : normalizedRole === 'parent'
            ? 'Linked Children Only'
            : 'Institutional Scope';

  const profileHeader = [
    `Authenticated User: ${sanitizeByteContextText(currentUser.name || roleProfile.displayLabel, 80)}`,
    `Active Role: ${normalizedRole} (${roleProfile.displayLabel})`,
    `Scope: ${scopeSummary}`,
    options.activeTab ? `Current Module Tab: ${sanitizeByteContextText(options.activeTab, 40)}` : '',
    `School ID: ${sanitizeByteContextText(schoolId, 60)}`,
    `Current Date: ${new Date().toISOString().split('T')[0]}`
  ]
    .filter(Boolean)
    .join(' | ');

  const moduleMapText = `Available Veylentra Modules for ${roleProfile.displayLabel}: ${roleProfile.modules
    .map((m) => `${m.label} (tab:${m.tabId} — ${m.description})`)
    .join('; ')}`;

  const needsContext = doesPromptNeedRoleContext(prompt, normalizedRole, options.activeTab);
  if (!needsContext) {
    return {
      normalizedRole,
      contextString: `User Profile: ${profileHeader}\n${moduleMapText}`,
      retrievalMs: Date.now() - start,
      hasVeylentraData: false,
      intentCategory,
      scopeSummary
    };
  }

  const cacheKey = `${userId}:${normalizedRole}:${scopeSummary}:${options.activeTab || ''}`;
  const cached = roleContextCache.get(cacheKey);
  if (
    !options.supabaseClient &&
    !options.linkedStudents &&
    cached &&
    Date.now() - cached.timestamp < SHORT_CACHE_TTL_MS
  ) {
    return {
      ...cached.result,
      retrievalMs: Date.now() - start,
      intentCategory
    };
  }

  const sections: string[] = [`User Profile: ${profileHeader}`, moduleMapText];
  let hasVeylentraData = false;
  let unlinkedParent = false;

  // Include local memory snapshot when available
  if (options.localSnapshot?.vaultNotes && options.localSnapshot.vaultNotes.length > 0) {
    const noteLines = options.localSnapshot.vaultNotes.slice(0, 5).map(
      (n: any) =>
        `- [${sanitizeByteContextText(n.subject || 'General', 40)}] "${sanitizeByteContextText(n.title, 80)}": ${sanitizeByteContextText(n.content, 200)}`
    );
    sections.push(`Personal Lecture Notes (${options.localSnapshot.vaultNotes.length} total):\n${noteLines.join('\n')}`);
    hasVeylentraData = true;
  }

  if (options.localSnapshot?.schedule && options.localSnapshot.schedule.length > 0) {
    const schedLines = options.localSnapshot.schedule.slice(0, 6).map(
      (s: any) =>
        `- ${sanitizeByteContextText(s.day || s.date || 'Scheduled', 40)} (${sanitizeByteContextText(s.time || '', 40)}): ${sanitizeByteContextText(s.subject || s.title || 'Session', 80)}`
    );
    sections.push(`Study Schedule:\n${schedLines.join('\n')}`);
    hasVeylentraData = true;
  }

  try {
    // =========================================================================
    // ROLE 1: PARENT — Strictly isolated to verified OTP-linked children ONLY
    // =========================================================================
    if (normalizedRole === 'parent') {
      const linkedChildren = await resolveVerifiedLinkedChildren(currentUser, options);
      if (linkedChildren.length === 0) {
        unlinkedParent = true;
        sections.push(
          `Verified Linked Children: NONE.\n` +
            `STRICT PRIVACY RULE FOR PARENT: No child account is currently verified/linked to this parent account. Do NOT guess or fabricate any child's grades, homework, or attendance. Tell the user clearly that no child is linked yet and direct them to "Parental Portal" (tab: parent_portal) to link their child via OTP email verification.`
        );
      } else {
        hasVeylentraData = true;
        const childSummaries = linkedChildren.map((child) => {
          const cid = child.uid || child.email || 'linked-child';
          return `- ${sanitizeByteContextText(child.name, 70)} (ID: ${sanitizeByteContextText(cid, 48)} | ${sanitizeByteContextText(child.grade || 'Grade N/A', 20)} - ${sanitizeByteContextText(child.section || 'Section N/A', 20)} | House: ${sanitizeByteContextText(child.house || 'N/A', 20)})`;
        });
        sections.push(`Verified Linked Children (${linkedChildren.length}):\n${childSummaries.join('\n')}`);

        if (sb && userId !== 'guest') {
          const childIds = linkedChildren.map((c) => c.uid).filter(Boolean) as string[];
          const childGrades = Array.from(new Set(linkedChildren.map((c) => c.grade).filter(Boolean) as string[]));

          const [hwRes, attRes, calRes, noticeRes] = await Promise.allSettled([
            childGrades.length > 0
              ? sb
                  .from('homework')
                  .select('id, title, subject, class_grade, class_section, due_date, completed_list')
                  .in('class_grade', childGrades)
                  .order('created_at', { ascending: false })
                  .limit(10)
              : Promise.resolve({ data: [] }),
            childIds.length > 0
              ? sb
                  .from('attendance')
                  .select('user_id, date, status, subject, remarks')
                  .in('user_id', childIds)
                  .order('date', { ascending: false })
                  .limit(20)
              : Promise.resolve({ data: [] }),
            sb.from('calendar_events').select('title, start_date, category').order('start_date', { ascending: true }).limit(6),
            sb.from('announcements').select('title, target_audience, created_at').order('created_at', { ascending: false }).limit(5)
          ]);

          if (hwRes.status === 'fulfilled' && Array.isArray(hwRes.value?.data) && hwRes.value.data.length > 0) {
            const hwLines = hwRes.value.data.map((h: any) => {
              const completedArr = Array.isArray(h.completed_list) ? h.completed_list : [];
              const completedByChild = childIds.some((cid) => completedArr.includes(cid));
              return `- [${completedByChild ? 'COMPLETED' : 'PENDING'}] ${sanitizeByteContextText(h.subject, 35)}: "${sanitizeByteContextText(h.title, 75)}" (${sanitizeByteContextText(h.class_grade, 20)}) | Due: ${h.due_date || 'Unspecified'}`;
            });
            sections.push(`Linked Child Authorized Homework:\n${hwLines.join('\n')}`);
          }

          if (attRes.status === 'fulfilled' && Array.isArray(attRes.value?.data) && attRes.value.data.length > 0) {
            const recs = attRes.value.data;
            const present = recs.filter((r: any) => r.status === 'present').length;
            const absent = recs.filter((r: any) => r.status === 'absent').length;
            const late = recs.filter((r: any) => r.status === 'late').length;
            const pct = Math.round(((present + late * 0.5) / recs.length) * 100);
            sections.push(
              `Linked Child Attendance (${recs.length} recent records): ${pct}% (${present} Present, ${absent} Absent, ${late} Late). Latest: ${recs[0].date} (${recs[0].status}).`
            );
          }

          if (calRes.status === 'fulfilled' && Array.isArray(calRes.value?.data) && calRes.value.data.length > 0) {
            sections.push(
              `Upcoming School Calendar:\n${calRes.value.data
                .map((c: any) => `- ${c.start_date} [${sanitizeByteContextText(c.category, 25)}]: "${sanitizeByteContextText(c.title, 75)}"`)
                .join('\n')}`
            );
          }

          if (noticeRes.status === 'fulfilled' && Array.isArray(noticeRes.value?.data) && noticeRes.value.data.length > 0) {
            sections.push(
              `Recent School Notices:\n${noticeRes.value.data
                .map((n: any) => `- "${sanitizeByteContextText(n.title, 80)}" (Audience: ${sanitizeByteContextText(n.target_audience || 'all', 30)})`)
                .join('\n')}`
            );
          }
        }
      }
    }

    // =========================================================================
    // ROLE 2 & 3: TEACHER & COORDINATOR / HOD — Scoped strictly to assigned grades/sections
    // =========================================================================
    else if ((normalizedRole === 'teacher' || normalizedRole === 'coordinator') && sb && userId !== 'guest') {
      const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 2400));
      const queriesPromise = Promise.allSettled([
        sb
          .from('homework')
          .select('id, title, subject, class_grade, class_section, due_date, completed_list, submissions')
          .in('class_grade', authorizedGrades)
          .order('created_at', { ascending: false })
          .limit(12),
        sb
          .from('attendance')
          .select('date, status, grade, section, user_id')
          .in('grade', authorizedGrades)
          .order('date', { ascending: false })
          .limit(60),
        sb
          .from('users')
          .select('uid, name, role, grade, section')
          .eq('role', 'student')
          .in('grade', authorizedGrades)
          .limit(80),
        sb
          .from('calendar_events')
          .select('title, start_date, category')
          .order('start_date', { ascending: true })
          .limit(6),
        sb
          .from('announcements')
          .select('title, target_audience, created_at')
          .order('created_at', { ascending: false })
          .limit(5)
      ]);

      const settled = await Promise.race([queriesPromise, timeoutPromise]);
      if (settled && Array.isArray(settled)) {
        hasVeylentraData = true;
        const [hwRes, attRes, rosterRes, calRes, noticeRes] = settled;

        const roster =
          rosterRes.status === 'fulfilled' && Array.isArray(rosterRes.value?.data)
            ? rosterRes.value.data.filter((s: any) => {
                if (normalizedRole === 'coordinator' && (!currentUser.assignedSections || currentUser.assignedSections.length === 0)) {
                  return true;
                }
                const sec = String(s.section || '').toLowerCase();
                return !sec || authorizedSections.map((x) => x.toLowerCase()).includes(sec);
              })
            : [];

        if (roster.length > 0) {
          sections.push(
            `Authorized Student Roster Count: ${roster.length} students across ${authorizedGrades.join(', ')} (${authorizedSections.join(', ')}).`
          );
        }

        if (hwRes.status === 'fulfilled' && Array.isArray(hwRes.value?.data) && hwRes.value.data.length > 0) {
          const hwLines = hwRes.value.data.map((h: any) => {
            const completedCount = Array.isArray(h.completed_list) ? h.completed_list.length : 0;
            const subCount = Array.isArray(h.submissions) ? h.submissions.length : completedCount;
            const denom = roster.length > 0 ? `/${roster.length}` : '';
            return `- ${sanitizeByteContextText(h.subject, 35)}: "${sanitizeByteContextText(h.title, 70)}" (${sanitizeByteContextText(h.class_grade, 16)} ${sanitizeByteContextText(h.class_section || '', 16)}) | Due: ${h.due_date || 'Unspecified'} | Submitted: ${subCount}${denom}`;
          });
          sections.push(`Scoped Homework & Submission Queue:\n${hwLines.join('\n')}`);
        } else {
          sections.push(`Scoped Homework: No active homework found for ${authorizedGrades.join(', ')}.`);
        }

        if (attRes.status === 'fulfilled' && Array.isArray(attRes.value?.data) && attRes.value.data.length > 0) {
          const recs = attRes.value.data.filter((r: any) => {
            if (normalizedRole === 'coordinator' && (!currentUser.assignedSections || currentUser.assignedSections.length === 0)) {
              return true;
            }
            const sec = String(r.section || '').toLowerCase();
            return !sec || authorizedSections.map((x) => x.toLowerCase()).includes(sec);
          });
          if (recs.length > 0) {
            const present = recs.filter((r: any) => r.status === 'present').length;
            const absent = recs.filter((r: any) => r.status === 'absent').length;
            const late = recs.filter((r: any) => r.status === 'late').length;
            const pct = Math.round(((present + late * 0.5) / recs.length) * 100);
            sections.push(
              `Cohort Attendance Compliance (${recs.length} recent records): ${pct}% (${present} Present, ${absent} Absent, ${late} Late).`
            );
          }
        }

        if (calRes.status === 'fulfilled' && Array.isArray(calRes.value?.data) && calRes.value.data.length > 0) {
          sections.push(
            `Upcoming Calendar Events:\n${calRes.value.data
              .map((c: any) => `- ${c.start_date} [${sanitizeByteContextText(c.category, 25)}]: "${sanitizeByteContextText(c.title, 75)}"`)
              .join('\n')}`
          );
        }

        if (noticeRes.status === 'fulfilled' && Array.isArray(noticeRes.value?.data) && noticeRes.value.data.length > 0) {
          sections.push(
            `Recent Circulars & Announcements:\n${noticeRes.value.data
              .map((n: any) => `- "${sanitizeByteContextText(n.title, 75)}" (${sanitizeByteContextText(n.target_audience || 'all', 25)})`)
              .join('\n')}`
          );
        }
      }
    }

    // =========================================================================
    // ROLE 4 & 5: ADMIN & SUPER_ADMIN — Institutional overview
    // =========================================================================
    else if ((normalizedRole === 'admin' || normalizedRole === 'super_admin') && sb && userId !== 'guest') {
      const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 2400));
      const todayIso = new Date().toISOString().split('T')[0];

      const queriesPromise = Promise.allSettled([
        sb.from('users').select('uid, role, account_status, grade').limit(250),
        sb.from('homework').select('id, title, subject, class_grade, due_date').order('created_at', { ascending: false }).limit(10),
        sb.from('attendance').select('date, status, grade').eq('date', todayIso).limit(200),
        sb.from('calendar_events').select('title, start_date, category').order('start_date', { ascending: true }).limit(6),
        sb.from('announcements').select('title, target_audience, created_at').order('created_at', { ascending: false }).limit(6)
      ]);

      const settled = await Promise.race([queriesPromise, timeoutPromise]);
      if (settled && Array.isArray(settled)) {
        hasVeylentraData = true;
        const [usersRes, hwRes, attRes, calRes, noticeRes] = settled;

        if (usersRes.status === 'fulfilled' && Array.isArray(usersRes.value?.data)) {
          const allUsers = usersRes.value.data;
          const byRole: Record<string, number> = {};
          let pendingApprovals = 0;
          for (const u of allUsers) {
            const r = String(u.role || 'student').toLowerCase();
            byRole[r] = (byRole[r] || 0) + 1;
            if (String(u.account_status || '').startsWith('pending')) pendingApprovals++;
          }
          const roleBreakdown = Object.entries(byRole)
            .map(([r, c]) => `${r}: ${c}`)
            .join(', ');
          sections.push(
            `Institutional Directory Summary (${allUsers.length} sampled records): ${roleBreakdown} | Pending Account Approvals: ${pendingApprovals}.`
          );
        }

        if (attRes.status === 'fulfilled' && Array.isArray(attRes.value?.data)) {
          const todayRecs = attRes.value.data;
          if (todayRecs.length > 0) {
            const present = todayRecs.filter((r: any) => r.status === 'present').length;
            const absent = todayRecs.filter((r: any) => r.status === 'absent').length;
            sections.push(
              `Today's Attendance (${todayIso}): ${todayRecs.length} logged (${present} Present, ${absent} Absent).`
            );
          } else {
            sections.push(`Today's Attendance (${todayIso}): No attendance rows logged yet today.`);
          }
        }

        if (hwRes.status === 'fulfilled' && Array.isArray(hwRes.value?.data) && hwRes.value.data.length > 0) {
          sections.push(
            `Recent Institutional Homework:\n${hwRes.value.data
              .slice(0, 6)
              .map((h: any) => `- [${sanitizeByteContextText(h.class_grade, 15)}] ${sanitizeByteContextText(h.subject, 30)}: "${sanitizeByteContextText(h.title, 70)}" (Due: ${h.due_date || 'Unspecified'})`)
              .join('\n')}`
          );
        }

        if (calRes.status === 'fulfilled' && Array.isArray(calRes.value?.data) && calRes.value.data.length > 0) {
          sections.push(
            `Upcoming School Calendar:\n${calRes.value.data
              .map((c: any) => `- ${c.start_date} [${sanitizeByteContextText(c.category, 25)}]: "${sanitizeByteContextText(c.title, 75)}"`)
              .join('\n')}`
          );
        }

        if (noticeRes.status === 'fulfilled' && Array.isArray(noticeRes.value?.data) && noticeRes.value.data.length > 0) {
          sections.push(
            `Recent Broadcasts / Notices:\n${noticeRes.value.data
              .map((n: any) => `- "${sanitizeByteContextText(n.title, 75)}" (Target: ${sanitizeByteContextText(n.target_audience || 'all', 25)})`)
              .join('\n')}`
          );
        }

        if (normalizedRole === 'super_admin') {
          sections.push(
            `Super Admin Governance Context: Active AI Providers configured for Ministral & Groq, plus Z.ai (GLM-4.7 Flash). Ephemeral privacy enforced on Orion interactions.`
          );
        }
      }
    }

    // =========================================================================
    // ROLE 6: STUDENT — Personal & grade-scoped context
    // =========================================================================
    else if (sb && userId !== 'guest') {
      const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 2200));
      const queriesPromise = Promise.allSettled([
        sb
          .from('homework')
          .select('id, title, subject, content, class_grade, class_section, due_date, completed_list')
          .eq('class_grade', userGrade)
          .order('created_at', { ascending: false })
          .limit(8),
        sb
          .from('notes')
          .select('title, subject, content, updated_at')
          .eq('user_id', userId)
          .order('updated_at', { ascending: false })
          .limit(6),
        sb
          .from('materials')
          .select('title, subject, category, description, class_grade, due_date')
          .eq('is_public', true)
          .order('created_at', { ascending: false })
          .limit(6),
        sb
          .from('attendance')
          .select('date, status, subject, remarks')
          .eq('user_id', userId)
          .order('date', { ascending: false })
          .limit(15),
        sb
          .from('calendar_events')
          .select('title, start_date, category, description')
          .order('start_date', { ascending: true })
          .limit(6),
        sb
          .from('student_gamification')
          .select('xp, level, level_title, current_streak, longest_streak')
          .eq('user_id', userId)
          .maybeSingle(),
        sb.from('life_houses').select('id, name, points, rank').order('points', { ascending: false }).limit(4)
      ]);

      const settled = await Promise.race([queriesPromise, timeoutPromise]);
      if (settled && Array.isArray(settled)) {
        hasVeylentraData = true;
        const [hwRes, notesRes, matRes, attRes, calRes, gamRes, houseRes] = settled;

        if (hwRes.status === 'fulfilled' && Array.isArray(hwRes.value?.data) && hwRes.value.data.length > 0) {
          const hwLines = hwRes.value.data.map((h: any) => {
            const completedArr = Array.isArray(h.completed_list) ? h.completed_list : [];
            const isDone = completedArr.includes(userId);
            return `- [${isDone ? 'COMPLETED' : 'PENDING'}] ${sanitizeByteContextText(h.subject, 35)}: "${sanitizeByteContextText(h.title, 75)}" (${sanitizeByteContextText(h.class_grade, 15)} ${sanitizeByteContextText(h.class_section || '', 15)}) | Due: ${h.due_date || 'Unspecified'} | Details: ${sanitizeByteContextText(h.content, 120)}`;
          });
          sections.push(`Authorized Homework (${userGrade}):\n${hwLines.join('\n')}`);
        } else {
          sections.push(`Authorized Homework: No homework records listed in Supabase for ${userGrade}.`);
        }

        if (
          (!options.localSnapshot?.vaultNotes || options.localSnapshot.vaultNotes.length === 0) &&
          notesRes.status === 'fulfilled' &&
          Array.isArray(notesRes.value?.data) &&
          notesRes.value.data.length > 0
        ) {
          sections.push(
            `Student's Lecture Notes:\n${notesRes.value.data
              .map(
                (n: any) =>
                  `- [${sanitizeByteContextText(n.subject, 35)}] "${sanitizeByteContextText(n.title, 75)}": ${sanitizeByteContextText(n.content, 200)}`
              )
              .join('\n')}`
          );
        }

        if (matRes.status === 'fulfilled' && Array.isArray(matRes.value?.data) && matRes.value.data.length > 0) {
          sections.push(
            `Recent School Materials:\n${matRes.value.data
              .map(
                (m: any) =>
                  `- [${sanitizeByteContextText(m.category || m.subject, 35)}] "${sanitizeByteContextText(m.title, 75)}": ${sanitizeByteContextText(m.description, 120)}`
              )
              .join('\n')}`
          );
        }

        if (attRes.status === 'fulfilled' && Array.isArray(attRes.value?.data) && attRes.value.data.length > 0) {
          const records = attRes.value.data;
          const presentCount = records.filter((r: any) => r.status === 'present').length;
          const absentCount = records.filter((r: any) => r.status === 'absent').length;
          const lateCount = records.filter((r: any) => r.status === 'late').length;
          const pct = Math.round(((presentCount + lateCount * 0.5) / records.length) * 100);
          sections.push(
            `Personal Attendance (${records.length} recorded days): ${pct}% (${presentCount} Present, ${absentCount} Absent, ${lateCount} Late). Latest: ${records[0].date} (${records[0].status}).`
          );
        }

        if (calRes.status === 'fulfilled' && Array.isArray(calRes.value?.data) && calRes.value.data.length > 0) {
          sections.push(
            `Upcoming School Calendar:\n${calRes.value.data
              .map((c: any) => `- ${c.start_date} [${sanitizeByteContextText(c.category, 25)}]: "${sanitizeByteContextText(c.title, 75)}"`)
              .join('\n')}`
          );
        }

        if (gamRes.status === 'fulfilled' && gamRes.value?.data) {
          const g = gamRes.value.data;
          sections.push(
            `Gamification Progress: Level ${g.level} (${sanitizeByteContextText(g.level_title, 40)}) | ${g.xp} XP | Streak: ${g.current_streak} days (Best: ${g.longest_streak} days).`
          );
        }

        if (houseRes.status === 'fulfilled' && Array.isArray(houseRes.value?.data) && houseRes.value.data.length > 0) {
          const hSummary = houseRes.value.data
            .map((h: any, idx: number) => `#${idx + 1} ${sanitizeByteContextText(h.id || h.name, 20)} (${h.points} pts)`)
            .join(', ');
          sections.push(`House Standings: ${hSummary}`);
        }
      }
    }
  } catch (err) {
    console.warn('[ByteIntelligence] Context fetch warning:', err instanceof Error ? err.message : 'partial');
  }

  const finalResult: BuiltByteContextResult = {
    normalizedRole,
    contextString: sections.join('\n\n'),
    retrievalMs: Date.now() - start,
    hasVeylentraData,
    intentCategory,
    scopeSummary,
    unlinkedParent
  };

  if (!options.supabaseClient && !options.linkedStudents) {
    roleContextCache.set(cacheKey, { timestamp: Date.now(), result: finalResult });
  }

  return finalResult;
}
