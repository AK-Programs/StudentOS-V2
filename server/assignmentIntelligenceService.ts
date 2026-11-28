/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Assignment Center Intelligence Service (6 Core Workflows)
 * 1. Notebook Intelligence (real user notes only — zero fabricated scores)
 * 2. AI Assignment Builder (faculty-only structured drafts + edit-before-publish + confirmation gate)
 * 3. Submissions Management & Tracking (strict student privacy + faculty grading)
 * 4. Notebook Completion Reports (computed from real notes & curriculum topics, JSON/MD/CSV exports)
 * 5. Assignment Quality Analyzer (strictly read-only audit — never auto-modifies published work)
 * 6. Group Projects (groups, roles, milestones, submissions, grading with strict membership checks)
 */

import { generateAICompletionWithTelemetry } from './aiClient';
import { supabaseFetchWithAnonRetry } from './supabaseKeyManager';

export interface AssignmentActor {
  id: string;
  name: string;
  email?: string;
  role: string;
  grade?: string;
  section?: string;
  authenticated?: boolean;
}

export function normalizeRole(role?: string | null): string {
  return String(role || 'student').toLowerCase().trim();
}

export function isFacultyRole(role?: string | null): boolean {
  return ['teacher', 'faculty', 'head_teacher', 'coordinator', 'hod', 'admin', 'super_admin'].includes(
    normalizeRole(role)
  );
}

export function isParentOrGuardian(role?: string | null): boolean {
  const r = normalizeRole(role);
  return r === 'parent' || r === 'guardian';
}

export interface RealNoteRecord {
  id: string;
  userId: string;
  title: string;
  subject: string;
  content: string;
  createdAt?: string;
  updatedAt?: string;
  folderId?: string | null;
}

export interface AssignmentDraft {
  id: string;
  title: string;
  subject: string;
  classGrade: string;
  classSection: string;
  dueDate: string;
  maxScore: number;
  instructions: string;
  objectives: string[];
  questions: Array<{
    id: string;
    prompt: string;
    type: 'MCQ' | 'Short Answer' | 'Long Answer' | 'Case Study' | 'Problem Solving';
    difficulty: 'Easy' | 'Medium' | 'Hard';
    marks: number;
    answerKey?: string;
  }>;
  rubric: string[];
  status: 'draft' | 'published';
  confirmed: boolean;
  createdBy: string;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
  publishedAssignmentId?: string;
}

export interface TrackedSubmission {
  id: string;
  assignmentId: string;
  assignmentTitle: string;
  subject: string;
  classGrade: string;
  classSection: string;
  studentId: string;
  studentName: string;
  studentEmail?: string;
  submissionText: string;
  attachmentUrl?: string;
  attachmentName?: string;
  status: 'pending' | 'submitted' | 'late' | 'missing' | 'evaluated' | 'returned_for_revision';
  isLate: boolean;
  submittedAt: string | null;
  dueDate?: string;
  score: number | null;
  maxScore: number;
  feedback: string;
  evaluatedBy?: string;
  evaluatedAt?: string;
  resultsReleased: boolean;
  updatedAt: string;
}

export interface ProjectGroupMember {
  userId: string;
  name: string;
  role: 'Leader' | 'Researcher' | 'Builder' | 'Presenter' | 'Reviewer';
}

export interface ProjectMilestone {
  id: string;
  title: string;
  dueDate?: string;
  status: 'todo' | 'in_progress' | 'done';
  progressNote?: string;
  updatedBy?: string;
  updatedAt?: string;
}

export interface ProjectGroup {
  id: string;
  name: string;
  members: ProjectGroupMember[];
  milestones: ProjectMilestone[];
  submissionText?: string;
  attachmentUrl?: string;
  submittedBy?: string;
  submittedAt?: string;
  score?: number | null;
  feedback?: string;
  gradedBy?: string;
  gradedAt?: string;
  status: 'active' | 'submitted' | 'graded';
}

export interface GroupProjectRecord {
  id: string;
  title: string;
  subject: string;
  description: string;
  classGrade: string;
  classSection: string;
  dueDate: string;
  maxScore: number;
  createdBy: string;
  createdByName: string;
  createdAt: string;
  groups: ProjectGroup[];
}

// Ephemeral / test-safe runtime backing stores synced with Supabase REST when available
const runtimeDrafts = new Map<string, AssignmentDraft>();
const runtimeSubmissions = new Map<string, TrackedSubmission>();
const runtimeGroupProjects = new Map<string, GroupProjectRecord>();

function sbHeaders(key: string, extra?: Record<string, string>): Record<string, string> {
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
    ...extra,
  };
}

async function fetchOwnedNotes(
  cfg: { url: string; key: string },
  actor: AssignmentActor,
  clientNotes?: any[]
): Promise<RealNoteRecord[]> {
  const byId = new Map<string, RealNoteRecord>();

  if (cfg?.url && cfg?.key && process.env.NODE_ENV !== 'test') {
    try {
      const res = await supabaseFetchWithAnonRetry(
        `${cfg.url}/rest/v1/notes?user_id=eq.${encodeURIComponent(actor.id)}&select=*&limit=200`,
        { headers: sbHeaders(cfg.key) }
      );
      if (res.ok) {
        const rows = (await res.json().catch(() => [])) as any[];
        if (Array.isArray(rows)) {
          for (const n of rows) {
            if (!n?.id || n.title === '__SYSTEM_NOTIFICATION__' || String(n.id).startsWith('notif_')) continue;
            byId.set(String(n.id), {
              id: String(n.id),
              userId: String(n.user_id || actor.id),
              title: String(n.title || 'Untitled Note'),
              subject: String(n.subject || 'General'),
              content: String(n.content || ''),
              createdAt: n.created_at ? String(n.created_at) : undefined,
              updatedAt: n.updated_at ? String(n.updated_at) : undefined,
              folderId: n.folder_id || null,
            });
          }
        }
      }
    } catch {
      // Fallback gracefully to caller's authorized notes list
    }
  }

  if (Array.isArray(clientNotes)) {
    for (const raw of clientNotes) {
      if (!raw || typeof raw !== 'object') continue;
      const ownerId = String(raw.userId || raw.user_id || '').trim();
      if (ownerId && ownerId !== actor.id) continue; // Strict cross-account isolation
      const id = String(raw.id || '').trim();
      if (!id || byId.has(id)) continue;
      byId.set(id, {
        id,
        userId: actor.id,
        title: String(raw.title || 'Untitled Note'),
        subject: String(raw.subject || 'General'),
        content: String(raw.content || ''),
        createdAt: raw.createdAt ? String(raw.createdAt) : undefined,
        updatedAt: raw.updatedAt ? String(raw.updatedAt) : undefined,
        folderId: raw.folder_id || raw.folderId || null,
      });
    }
  }

  return Array.from(byId.values());
}

// ============================================================================
// 1. Notebook Intelligence (Zero Fabricated Scores)
// ============================================================================

export async function handleNotebookIntelligence(params: {
  cfg: { url: string; key: string };
  actor: AssignmentActor;
  body: any;
  requestId?: string;
}) {
  const { cfg, actor, body, requestId } = params;
  const targetSubject = String(body?.subject || '').trim();
  const syllabusTopics: string[] = Array.isArray(body?.topics)
    ? body.topics.map((t: any) => String(t || '').trim()).filter(Boolean)
    : [];

  let notes = await fetchOwnedNotes(cfg, actor, body?.notes);
  if (targetSubject && targetSubject.toLowerCase() !== 'all') {
    notes = notes.filter((n) => n.subject.toLowerCase() === targetSubject.toLowerCase());
  }

  if (notes.length === 0) {
    return {
      httpStatus: 200,
      payload: {
        success: true,
        hasNotes: false,
        noteCount: 0,
        completenessScore: null,
        summary: targetSubject
          ? `No notes found in ${targetSubject} for your account yet.`
          : 'No notes found in your Notes Vault yet.',
        gaps: syllabusTopics.length > 0
          ? syllabusTopics.map((t) => `Missing study note for syllabus topic: ${t}`)
          : ['Add or import notes in Vault to measure completeness and concept coverage.'],
        organizationFindings: [],
        suggestions: [
          'Create structured notes with clear headings, key definitions, and worked examples.',
        ],
        perNoteAudit: [],
      },
    };
  }

  const perNoteAudit = notes.map((n) => {
    const content = n.content.trim();
    const words = content ? content.split(/\s+/).filter(Boolean).length : 0;
    const hasHeadings = /^#{1,3}\s+/m.test(content);
    const hasBulletsOrSteps = /^(\s*[-*+]|\s*\d+\.)\s+/m.test(content);
    const hasFormulasOrExamples = /(\$.*\$|=|example|definition|theorem|proof)/i.test(content);
    const issues: string[] = [];
    if (words < 30) issues.push('Very short note (< 30 words) — lacks depth');
    if (!hasHeadings) issues.push('Missing section headings');
    if (!hasBulletsOrSteps) issues.push('No bullet points or structured steps');
    if (!hasFormulasOrExamples) issues.push('Add concrete examples or key definitions');

    // Deterministic metric computed transparently from the 4 real structural properties
    const checksPassed =
      (words >= 40 ? 25 : words >= 15 ? 12 : 0) +
      (hasHeadings ? 25 : 0) +
      (hasBulletsOrSteps ? 25 : 0) +
      (hasFormulasOrExamples ? 25 : 0);

    return {
      noteId: n.id,
      title: n.title,
      subject: n.subject,
      wordCount: words,
      hasHeadings,
      hasBulletsOrSteps,
      hasFormulasOrExamples,
      completenessPercent: checksPassed,
      issues,
    };
  });

  const avgCompleteness = Math.round(
    perNoteAudit.reduce((sum, x) => sum + x.completenessPercent, 0) / perNoteAudit.length
  );

  const combinedCorpus = notes.map((n) => `${n.title} ${n.subject} ${n.content}`).join(' ').toLowerCase();
  const missingTopics = syllabusTopics.filter((topic) => !combinedCorpus.includes(topic.toLowerCase()));

  const gaps: string[] = [];
  for (const mt of missingTopics) {
    gaps.push(`Topic not covered in your current notes: "${mt}"`);
  }
  const thinNotes = perNoteAudit.filter((n) => n.wordCount < 30);
  if (thinNotes.length > 0) {
    gaps.push(`${thinNotes.length} note(s) have fewer than 30 words (${thinNotes.map((t) => t.title).slice(0, 3).join(', ')})`);
  }

  const organizationFindings: string[] = [];
  const noHeadingsCount = perNoteAudit.filter((n) => !n.hasHeadings).length;
  if (noHeadingsCount > 0) {
    organizationFindings.push(`${noHeadingsCount} of ${notes.length} notes lack Markdown headings for quick revision.`);
  }
  const uncategorizedCount = notes.filter((n) => !n.subject || n.subject === 'General').length;
  if (uncategorizedCount > 0) {
    organizationFindings.push(`${uncategorizedCount} note(s) are filed under General rather than a specific subject.`);
  }
  if (organizationFindings.length === 0) {
    organizationFindings.push('All inspected notes have subject labels and clear section headings.');
  }

  let suggestions: string[] = [
    ...gaps.slice(0, 2).map((g) => `Address gap: ${g}`),
    ...(noHeadingsCount > 0 ? ['Add H2 headings (## Key Concepts, ## Examples) to untitled sections.'] : []),
    'Add 2 self-check practice questions at the bottom of your newest note.',
  ];
  let providerUsed: string | undefined;
  let modelUsed: string | undefined;

  try {
    const noteDigest = perNoteAudit
      .slice(0, 8)
      .map((a) => `- "${a.title}" (${a.subject}, ${a.wordCount} words, completeness ${a.completenessPercent}%): ${a.issues.join('; ') || 'well structured'}`)
      .join('\n');
    const aiRes = await generateAICompletionWithTelemetry({
      systemInstruction:
        'Provide up to 4 concise, actionable study suggestions as a JSON array of strings based strictly on the provided real note audit. Never invent statistics.',
      prompt: `Note Audit (${notes.length} notes, average structural completeness ${avgCompleteness}%):\n${noteDigest}\nMissing syllabus topics: ${missingTopics.join(', ') || 'None specified'}`,
      jsonMode: true,
      taskType: 'fast',
      maxTokens: 600,
      requestId,
      endpointName: '/api/assignments/notebook-intelligence',
      userRole: actor.role,
    });
    providerUsed = aiRes.telemetry.providerUsed;
    modelUsed = aiRes.telemetry.modelUsed;
    const parsed = JSON.parse(aiRes.text);
    const arr = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.suggestions) ? parsed.suggestions : [];
    if (arr.length > 0) {
      suggestions = arr.slice(0, 4).map((s: any) => String(s || '').trim()).filter(Boolean);
    }
  } catch {
    // Keep deterministic grounded suggestions
  }

  return {
    httpStatus: 200,
    payload: {
      success: true,
      hasNotes: true,
      noteCount: notes.length,
      completenessScore: avgCompleteness,
      summary: `Analyzed ${notes.length} real note(s) across ${new Set(notes.map((n) => n.subject)).size} subject(s). Average structural completeness: ${avgCompleteness}%.`,
      gaps,
      organizationFindings,
      suggestions,
      perNoteAudit,
      providerUsed,
      modelUsed,
    },
  };
}

// ============================================================================
// 2. AI Assignment Builder (Faculty-Only, Draft First + Edit-Before-Publish)
// ============================================================================

export async function handleAiAssignmentBuilder(params: {
  cfg: { url: string; key: string };
  actor: AssignmentActor;
  body: any;
  requestId?: string;
}) {
  const { cfg, actor, body, requestId } = params;
  if (!isFacultyRole(actor.role)) {
    return {
      httpStatus: 403,
      payload: { success: false, error: 'Forbidden: Only teachers, coordinators, and admins can create assignment drafts.' },
    };
  }

  const subject = String(body?.subject || 'General').trim();
  const topic = String(body?.topic || '').trim();
  const classGrade = String(body?.classGrade || 'Grade 10').trim();
  const classSection = String(body?.classSection || 'All Sections').trim();
  const difficulty = (['Easy', 'Medium', 'Hard'].includes(String(body?.difficulty)) ? body.difficulty : 'Medium') as
    | 'Easy'
    | 'Medium'
    | 'Hard';
  const questionCount = Math.min(12, Math.max(2, Number(body?.questionCount || 4)));
  const dueDate = String(body?.dueDate || new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0]);

  if (!topic) {
    return {
      httpStatus: 400,
      payload: { success: false, error: 'Topic is required to generate an assignment draft.' },
    };
  }

  const now = new Date().toISOString();
  const draftId = `draft_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

  let draft: AssignmentDraft = {
    id: draftId,
    title: `${subject}: ${topic} (${difficulty} Practice Set)`,
    subject,
    classGrade,
    classSection,
    dueDate,
    maxScore: questionCount * 5,
    instructions: `Read every prompt carefully, show intermediate steps clearly, and submit your work in the Assignment Center before ${dueDate}.`,
    objectives: [
      `Demonstrate core conceptual mastery of ${topic} in ${subject}.`,
      `Apply structured reasoning and quantitative/written justification to ${difficulty.toLowerCase()} problems.`,
    ],
    questions: Array.from({ length: questionCount }, (_, idx) => ({
      id: `q_${idx + 1}`,
      prompt: `${idx === 0 ? 'Define and illustrate' : idx === questionCount - 1 ? 'Analyze a real-world scenario involving' : 'Solve step by step a problem on'} ${topic} (Part ${idx + 1}).`,
      type: idx === 0 ? 'Short Answer' : idx === questionCount - 1 ? 'Case Study' : 'Problem Solving',
      difficulty,
      marks: 5,
      answerKey: `Expected rubric points covering ${topic} reasoning and final verification.`,
    })),
    rubric: [
      'Conceptual accuracy and terminology (40%)',
      'Step-by-step reasoning and clarity (40%)',
      'Presentation and completeness (20%)',
    ],
    status: 'draft',
    confirmed: false,
    createdBy: actor.id,
    createdByName: actor.name,
    createdAt: now,
    updatedAt: now,
  };

  let providerUsed: string | undefined;
  let modelUsed: string | undefined;

  try {
    const aiRes = await generateAICompletionWithTelemetry({
      systemInstruction:
        'Generate a structured academic assignment DRAFT in JSON with keys: "title", "instructions", "objectives" (string[]), ' +
        '"questions" (array of { "id", "prompt", "type" ("MCQ"|"Short Answer"|"Long Answer"|"Case Study"|"Problem Solving"), "difficulty" ("Easy"|"Medium"|"Hard"), "marks" (number), "answerKey" }), ' +
        'and "rubric" (string[]). Never publish directly.',
      prompt: `Subject: ${subject}\nTopic: ${topic}\nGrade: ${classGrade} (${classSection})\nTarget Difficulty: ${difficulty}\nQuestions requested: ${questionCount}`,
      jsonMode: true,
      taskType: 'general',
      maxTokens: 2500,
      requestId,
      endpointName: '/api/assignments/ai-builder',
      userRole: actor.role,
    });
    providerUsed = aiRes.telemetry.providerUsed;
    modelUsed = aiRes.telemetry.modelUsed;
    const parsed = JSON.parse(aiRes.text);
    if (parsed && Array.isArray(parsed.questions) && parsed.questions.length > 0) {
      const qs = parsed.questions.slice(0, 15).map((q: any, i: number) => ({
        id: String(q?.id || `q_${i + 1}`),
        prompt: String(q?.prompt || `Question ${i + 1} on ${topic}`),
        type: (['MCQ', 'Short Answer', 'Long Answer', 'Case Study', 'Problem Solving'].includes(String(q?.type))
          ? q.type
          : 'Short Answer') as AssignmentDraft['questions'][0]['type'],
        difficulty: (['Easy', 'Medium', 'Hard'].includes(String(q?.difficulty)) ? q.difficulty : difficulty) as
          | 'Easy'
          | 'Medium'
          | 'Hard',
        marks: Math.max(1, Number(q?.marks || 5)),
        answerKey: q?.answerKey ? String(q.answerKey) : undefined,
      }));
      draft = {
        ...draft,
        title: String(parsed.title || draft.title),
        instructions: String(parsed.instructions || draft.instructions),
        objectives: Array.isArray(parsed.objectives) && parsed.objectives.length ? parsed.objectives.map(String) : draft.objectives,
        questions: qs,
        maxScore: qs.reduce((acc: number, q: any) => acc + Number(q.marks || 0), 0),
        rubric: Array.isArray(parsed.rubric) && parsed.rubric.length ? parsed.rubric.map(String) : draft.rubric,
      };
    }
  } catch {
    // Use structured deterministic draft
  }

  await persistDraft(cfg, draft);

  return {
    httpStatus: 201,
    payload: {
      success: true,
      draft,
      requiresReviewAndConfirmation: true,
      message: 'Draft generated. Review and edit before publishing to students.',
      providerUsed,
      modelUsed,
    },
  };
}

async function persistDraft(cfg: { url: string; key: string }, draft: AssignmentDraft) {
  runtimeDrafts.set(draft.id, draft);
  if (cfg?.url && cfg?.key && process.env.NODE_ENV !== 'test') {
    try {
      await supabaseFetchWithAnonRetry(`${cfg.url}/rest/v1/assignment_drafts`, {
        method: 'POST',
        headers: sbHeaders(cfg.key, { Prefer: 'resolution=merge-duplicates,return=representation' }),
        body: JSON.stringify({
          id: draft.id,
          title: draft.title,
          subject: draft.subject,
          class_grade: draft.classGrade,
          class_section: draft.classSection,
          due_date: draft.dueDate,
          max_score: draft.maxScore,
          instructions: draft.instructions,
          objectives: draft.objectives,
          questions: draft.questions,
          rubric: draft.rubric,
          status: draft.status,
          created_by: draft.createdBy,
          created_by_name: draft.createdByName,
          published_assignment_id: draft.publishedAssignmentId || null,
          updated_at: draft.updatedAt,
        }),
      });
    } catch {
      // Keep runtime draft store intact
    }
  }
}

export async function listAssignmentDrafts(cfg: { url: string; key: string }, actor: AssignmentActor) {
  if (!isFacultyRole(actor.role)) {
    return {
      httpStatus: 403,
      payload: { success: false, error: 'Forbidden: Only faculty and admins can view assignment drafts.' },
    };
  }
  const byId = new Map<string, AssignmentDraft>();
  if (cfg?.url && cfg?.key && process.env.NODE_ENV !== 'test') {
    try {
      const res = await supabaseFetchWithAnonRetry(
        `${cfg.url}/rest/v1/assignment_drafts?select=*&order=updated_at.desc&limit=100`,
        { headers: sbHeaders(cfg.key) }
      );
      if (res.ok) {
        const rows = (await res.json().catch(() => [])) as any[];
        if (Array.isArray(rows)) {
          for (const r of rows) {
            byId.set(String(r.id), {
              id: String(r.id),
              title: String(r.title || ''),
              subject: String(r.subject || 'General'),
              classGrade: String(r.class_grade || 'Grade 10'),
              classSection: String(r.class_section || 'All Sections'),
              dueDate: String(r.due_date || ''),
              maxScore: Number(r.max_score || 20),
              instructions: String(r.instructions || ''),
              objectives: Array.isArray(r.objectives) ? r.objectives : [],
              questions: Array.isArray(r.questions) ? r.questions : [],
              rubric: Array.isArray(r.rubric) ? r.rubric : [],
              status: r.status === 'published' ? 'published' : 'draft',
              confirmed: r.status === 'published',
              createdBy: String(r.created_by || ''),
              createdByName: String(r.created_by_name || 'Faculty'),
              createdAt: String(r.created_at || r.updated_at || new Date().toISOString()),
              updatedAt: String(r.updated_at || new Date().toISOString()),
              publishedAssignmentId: r.published_assignment_id || undefined,
            });
          }
        }
      }
    } catch {}
  }
  runtimeDrafts.forEach((d, id) => {
    if (!byId.has(id)) byId.set(id, d);
  });

  const drafts = Array.from(byId.values()).filter((d) => {
    if (['admin', 'super_admin', 'coordinator', 'hod'].includes(normalizeRole(actor.role))) return true;
    return !d.createdBy || d.createdBy === actor.id;
  });

  return { httpStatus: 200, payload: { success: true, drafts } };
}

export async function saveAssignmentDraft(cfg: { url: string; key: string }, actor: AssignmentActor, body: any) {
  if (!isFacultyRole(actor.role)) {
    return { httpStatus: 403, payload: { success: false, error: 'Forbidden: Only faculty can save assignment drafts.' } };
  }
  const id = String(body?.id || `draft_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`);
  const existing = runtimeDrafts.get(id);
  const now = new Date().toISOString();
  const questions = Array.isArray(body?.questions) ? body.questions : existing?.questions || [];
  const draft: AssignmentDraft = {
    id,
    title: String(body?.title || existing?.title || 'Untitled Assignment Draft'),
    subject: String(body?.subject || existing?.subject || 'General'),
    classGrade: String(body?.classGrade || existing?.classGrade || 'Grade 10'),
    classSection: String(body?.classSection || existing?.classSection || 'All Sections'),
    dueDate: String(body?.dueDate || existing?.dueDate || now.split('T')[0]),
    maxScore: Number(body?.maxScore || questions.reduce((s: number, q: any) => s + Number(q.marks || 0), 0) || 20),
    instructions: String(body?.instructions || existing?.instructions || ''),
    objectives: Array.isArray(body?.objectives) ? body.objectives.map(String) : existing?.objectives || [],
    questions,
    rubric: Array.isArray(body?.rubric) ? body.rubric.map(String) : existing?.rubric || [],
    status: 'draft',
    confirmed: false,
    createdBy: existing?.createdBy || actor.id,
    createdByName: existing?.createdByName || actor.name,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  };
  await persistDraft(cfg, draft);
  return { httpStatus: 200, payload: { success: true, draft } };
}

export async function publishAssignmentDraft(
  cfg: { url: string; key: string },
  actor: AssignmentActor,
  draftId: string,
  body: any
) {
  if (!isFacultyRole(actor.role)) {
    return {
      httpStatus: 403,
      payload: { success: false, error: 'Forbidden: Only faculty and admins can publish assignments.' },
    };
  }
  if (body?.confirmed !== true) {
    return {
      httpStatus: 400,
      payload: {
        success: false,
        requiresConfirmation: true,
        error: 'Explicit confirmation (confirmed: true) after reviewing/editing the draft is required before publishing.',
      },
    };
  }

  let draft = runtimeDrafts.get(draftId);
  if (!draft && cfg?.url && cfg?.key && process.env.NODE_ENV !== 'test') {
    try {
      const res = await supabaseFetchWithAnonRetry(
        `${cfg.url}/rest/v1/assignment_drafts?id=eq.${encodeURIComponent(draftId)}&limit=1`,
        { headers: sbHeaders(cfg.key) }
      );
      if (res.ok) {
        const rows = (await res.json().catch(() => [])) as any[];
        if (rows[0]) {
          const r = rows[0];
          draft = {
            id: String(r.id),
            title: String(r.title || ''),
            subject: String(r.subject || 'General'),
            classGrade: String(r.class_grade || 'Grade 10'),
            classSection: String(r.class_section || 'All Sections'),
            dueDate: String(r.due_date || ''),
            maxScore: Number(r.max_score || 20),
            instructions: String(r.instructions || ''),
            objectives: Array.isArray(r.objectives) ? r.objectives : [],
            questions: Array.isArray(r.questions) ? r.questions : [],
            rubric: Array.isArray(r.rubric) ? r.rubric : [],
            status: r.status === 'published' ? 'published' : 'draft',
            confirmed: Boolean(r.status === 'published'),
            createdBy: String(r.created_by || actor.id),
            createdByName: String(r.created_by_name || actor.name),
            createdAt: String(r.created_at || new Date().toISOString()),
            updatedAt: String(r.updated_at || new Date().toISOString()),
          };
        }
      }
    } catch {}
  }

  if (!draft) {
    return { httpStatus: 404, payload: { success: false, error: 'Assignment draft not found.' } };
  }

  const editedQuestions = Array.isArray(body?.questions) ? body.questions : draft.questions;
  const publishedHwId = draft.publishedAssignmentId || `hw_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const now = new Date().toISOString();

  const updatedDraft: AssignmentDraft = {
    ...draft,
    title: String(body?.title || draft.title).trim(),
    instructions: String(body?.instructions || draft.instructions).trim(),
    dueDate: String(body?.dueDate || draft.dueDate),
    classGrade: String(body?.classGrade || draft.classGrade),
    classSection: String(body?.classSection || draft.classSection),
    questions: editedQuestions,
    maxScore: Number(body?.maxScore || editedQuestions.reduce((s: number, q: any) => s + Number(q.marks || 0), 0) || draft.maxScore),
    status: 'published',
    confirmed: true,
    updatedAt: now,
    publishedAssignmentId: publishedHwId,
  };

  await persistDraft(cfg, updatedDraft);

  // Also publish into `homework` table so students see it in Homework Desk cleanly
  const contentMarkdown = [
    updatedDraft.instructions,
    '',
    '### Questions',
    ...updatedDraft.questions.map((q, i) => `${i + 1}. (${q.marks} marks · ${q.difficulty}) ${q.prompt}`),
  ].join('\n');

  if (cfg?.url && cfg?.key && process.env.NODE_ENV !== 'test') {
    try {
      await supabaseFetchWithAnonRetry(`${cfg.url}/rest/v1/homework`, {
        method: 'POST',
        headers: sbHeaders(cfg.key, { Prefer: 'resolution=merge-duplicates' }),
        body: JSON.stringify({
          id: publishedHwId,
          title: updatedDraft.title,
          subject: updatedDraft.subject,
          content: contentMarkdown,
          due_date: updatedDraft.dueDate,
          class_grade: updatedDraft.classGrade,
          class_section: updatedDraft.classSection,
          given_by: actor.name,
          created_at: now,
          completed_list: '[]',
        }),
      });
    } catch {}
  }

  return {
    httpStatus: 200,
    payload: {
      success: true,
      draft: updatedDraft,
      publishedAssignment: {
        id: publishedHwId,
        title: updatedDraft.title,
        subject: updatedDraft.subject,
        content: contentMarkdown,
        dueDate: updatedDraft.dueDate,
        classGrade: updatedDraft.classGrade,
        classSection: updatedDraft.classSection,
        givenBy: actor.name,
        maxScore: updatedDraft.maxScore,
        status: 'published',
      },
    },
  };
}

// ============================================================================
// 3. Submissions Management & Tracking
// ============================================================================

export async function listAssignmentSubmissions(cfg: { url: string; key: string }, actor: AssignmentActor, query: any) {
  if (isParentOrGuardian(actor.role)) {
    return {
      httpStatus: 403,
      payload: { success: false, error: 'Forbidden: Submission management workspace is restricted to students and faculty.' },
    };
  }

  const byId = new Map<string, TrackedSubmission>();
  if (cfg?.url && cfg?.key && process.env.NODE_ENV !== 'test') {
    try {
      const res = await supabaseFetchWithAnonRetry(
        `${cfg.url}/rest/v1/assignment_submissions?select=*&order=submitted_at.desc&limit=200`,
        { headers: sbHeaders(cfg.key) }
      );
      if (res.ok) {
        const rows = (await res.json().catch(() => [])) as any[];
        if (Array.isArray(rows)) {
          for (const s of rows) {
            byId.set(String(s.id), {
              id: String(s.id),
              assignmentId: String(s.assignment_id || ''),
              assignmentTitle: String(s.assignment_title || s.assignment_id || 'Assignment'),
              subject: String(s.subject || 'General'),
              classGrade: String(s.class_grade || 'Grade 10'),
              classSection: String(s.class_section || 'Solara'),
              studentId: String(s.student_id || ''),
              studentName: String(s.student_name || 'Student'),
              studentEmail: s.student_email ? String(s.student_email) : undefined,
              submissionText: String(s.submission_text || ''),
              attachmentUrl: s.attachment_url || undefined,
              attachmentName: s.attachment_name || undefined,
              status: (s.status || 'submitted') as TrackedSubmission['status'],
              isLate: Boolean(s.is_late),
              submittedAt: s.submitted_at || null,
              dueDate: s.due_date || undefined,
              score: s.score !== null && s.score !== undefined ? Number(s.score) : null,
              maxScore: Number(s.max_score || 100),
              feedback: String(s.feedback || ''),
              evaluatedBy: s.evaluated_by || undefined,
              evaluatedAt: s.evaluated_at || undefined,
              resultsReleased: Boolean(s.results_released),
              updatedAt: String(s.updated_at || new Date().toISOString()),
            });
          }
        }
      }
    } catch {}
  }

  runtimeSubmissions.forEach((sub, id) => {
    byId.set(id, sub);
  });

  const isStaff = isFacultyRole(actor.role);
  const requestedStudentId = String(query?.studentId || '').trim();
  if (!isStaff && requestedStudentId && requestedStudentId !== actor.id) {
    return {
      httpStatus: 403,
      payload: { success: false, error: 'Forbidden: Students can only view their own submissions.' },
    };
  }

  let items = Array.from(byId.values());
  if (!isStaff) {
    items = items.filter((s) => s.studentId === actor.id || (actor.email && s.studentEmail === actor.email));
  } else {
    if (requestedStudentId) items = items.filter((s) => s.studentId === requestedStudentId);
    if (query?.classGrade && query.classGrade !== 'All') {
      items = items.filter((s) => s.classGrade.toLowerCase() === String(query.classGrade).toLowerCase());
    }
    if (query?.classSection && query.classSection !== 'All') {
      items = items.filter((s) => s.classSection.toLowerCase() === String(query.classSection).toLowerCase());
    }
  }
  if (query?.assignmentId) items = items.filter((s) => s.assignmentId === String(query.assignmentId));
  if (query?.status && query.status !== 'all') items = items.filter((s) => s.status === String(query.status));

  return {
    httpStatus: 200,
    payload: {
      success: true,
      submissions: items,
      summary: {
        total: items.length,
        submitted: items.filter((s) => s.status === 'submitted').length,
        late: items.filter((s) => s.isLate || s.status === 'late').length,
        missing: items.filter((s) => s.status === 'missing').length,
        evaluated: items.filter((s) => s.status === 'evaluated').length,
      },
    },
  };
}

export async function submitAssignmentWork(cfg: { url: string; key: string }, actor: AssignmentActor, body: any) {
  if (isParentOrGuardian(actor.role)) {
    return { httpStatus: 403, payload: { success: false, error: 'Forbidden: Parents cannot submit student coursework.' } };
  }
  const assignmentId = String(body?.assignmentId || '').trim();
  const submissionText = String(body?.submissionText || '').trim();
  const attachmentUrl = String(body?.attachmentUrl || '').trim();
  if (!assignmentId || (!submissionText && !attachmentUrl)) {
    return {
      httpStatus: 400,
      payload: { success: false, error: 'assignmentId and either submissionText or attachmentUrl are required.' },
    };
  }

  const now = new Date().toISOString();
  const dueDateStr = body?.dueDate ? String(body.dueDate) : '';
  const dueMs = dueDateStr ? Date.parse(dueDateStr) : NaN;
  const isLate = !Number.isNaN(dueMs) && Date.now() > dueMs + 86399000;
  const subId = `sub_${assignmentId}_${actor.id}`.replace(/[^a-zA-Z0-9_-]/g, '_');

  const record: TrackedSubmission = {
    id: subId,
    assignmentId,
    assignmentTitle: String(body?.assignmentTitle || assignmentId),
    subject: String(body?.subject || 'General'),
    classGrade: String(body?.classGrade || actor.grade || 'Grade 10'),
    classSection: String(body?.classSection || actor.section || 'Solara'),
    studentId: actor.id,
    studentName: actor.name,
    studentEmail: actor.email,
    submissionText,
    attachmentUrl: attachmentUrl || undefined,
    attachmentName: body?.attachmentName ? String(body.attachmentName) : undefined,
    status: isLate ? 'late' : 'submitted',
    isLate,
    submittedAt: now,
    dueDate: dueDateStr || undefined,
    score: null,
    maxScore: Number(body?.maxScore || 100),
    feedback: '',
    resultsReleased: false,
    updatedAt: now,
  };

  runtimeSubmissions.set(subId, record);

  if (cfg?.url && cfg?.key && process.env.NODE_ENV !== 'test') {
    try {
      await supabaseFetchWithAnonRetry(`${cfg.url}/rest/v1/assignment_submissions`, {
        method: 'POST',
        headers: sbHeaders(cfg.key, { Prefer: 'resolution=merge-duplicates' }),
        body: JSON.stringify({
          id: record.id,
          assignment_id: record.assignmentId,
          student_id: record.studentId,
          student_name: record.studentName,
          student_email: record.studentEmail || '',
          class_grade: record.classGrade,
          class_section: record.classSection,
          status: record.status,
          submission_text: record.submissionText,
          attachment_url: record.attachmentUrl || '',
          attachment_name: record.attachmentName || '',
          is_late: record.isLate,
          submitted_at: record.submittedAt,
          max_score: record.maxScore,
          results_released: false,
          updated_at: now,
        }),
      });
    } catch {}
  }

  return { httpStatus: 201, payload: { success: true, submission: record } };
}

export async function gradeAssignmentSubmission(
  cfg: { url: string; key: string },
  actor: AssignmentActor,
  submissionId: string,
  body: any
) {
  if (!isFacultyRole(actor.role)) {
    return {
      httpStatus: 403,
      payload: { success: false, error: 'Forbidden: Only authorized faculty can grade or review submissions.' },
    };
  }
  const existing = runtimeSubmissions.get(submissionId);
  const maxScore = Number(body?.maxScore ?? existing?.maxScore ?? 100);
  const rawScore = body?.score !== undefined && body?.score !== null ? Number(body.score) : null;
  if (rawScore !== null && (Number.isNaN(rawScore) || rawScore < 0 || rawScore > maxScore)) {
    return {
      httpStatus: 400,
      payload: { success: false, error: `Score must be between 0 and ${maxScore}.` },
    };
  }

  const now = new Date().toISOString();
  const nextStatus = body?.returnForRevision ? 'returned_for_revision' : 'evaluated';
  const feedback = String(body?.feedback || existing?.feedback || '').trim();
  const resultsReleased = body?.resultsReleased !== false;

  const updated: TrackedSubmission = existing
    ? {
        ...existing,
        score: rawScore,
        maxScore,
        feedback,
        status: nextStatus,
        evaluatedBy: actor.name,
        evaluatedAt: now,
        resultsReleased,
        updatedAt: now,
      }
    : {
        id: submissionId,
        assignmentId: String(body?.assignmentId || 'assignment'),
        assignmentTitle: String(body?.assignmentTitle || 'Assignment'),
        subject: String(body?.subject || 'General'),
        classGrade: String(body?.classGrade || 'Grade 10'),
        classSection: String(body?.classSection || 'Solara'),
        studentId: String(body?.studentId || 'unknown'),
        studentName: String(body?.studentName || 'Student'),
        submissionText: '',
        status: nextStatus,
        isLate: false,
        submittedAt: now,
        score: rawScore,
        maxScore,
        feedback,
        evaluatedBy: actor.name,
        evaluatedAt: now,
        resultsReleased,
        updatedAt: now,
      };

  runtimeSubmissions.set(submissionId, updated);

  if (cfg?.url && cfg?.key && process.env.NODE_ENV !== 'test') {
    try {
      await supabaseFetchWithAnonRetry(
        `${cfg.url}/rest/v1/assignment_submissions?id=eq.${encodeURIComponent(submissionId)}`,
        {
          method: 'PATCH',
          headers: sbHeaders(cfg.key),
          body: JSON.stringify({
            score: rawScore,
            max_score: maxScore,
            feedback,
            status: nextStatus,
            evaluated_by: actor.name,
            evaluated_at: now,
            results_released: resultsReleased,
            updated_at: now,
          }),
        }
      );
    } catch {}
  }

  return { httpStatus: 200, payload: { success: true, submission: updated } };
}

// ============================================================================
// 4. Notebook Completion Reports (Real Data + JSON / Markdown / CSV)
// ============================================================================

export async function handleNotebookCompletionReport(params: {
  cfg: { url: string; key: string };
  actor: AssignmentActor;
  body: any;
}) {
  const { cfg, actor, body } = params;
  const notes = await fetchOwnedNotes(cfg, actor, body?.notes);
  const topics: Array<{ topic: string; subject: string }> = Array.isArray(body?.topics)
    ? body.topics
        .map((t: any) =>
          typeof t === 'string'
            ? { topic: t.trim(), subject: String(body?.subject || 'General') }
            : { topic: String(t?.topic || t?.title || '').trim(), subject: String(t?.subject || body?.subject || 'General') }
        )
        .filter((t: any) => t.topic)
    : [];

  const subjectFilter = String(body?.subject || '').trim();
  const scopedNotes =
    subjectFilter && subjectFilter.toLowerCase() !== 'all'
      ? notes.filter((n) => n.subject.toLowerCase() === subjectFilter.toLowerCase())
      : notes;

  const corpus = scopedNotes.map((n) => `${n.title} ${n.subject} ${n.content}`).join(' ').toLowerCase();
  const topicRows = topics.map((t) => {
    const matchedNote = scopedNotes.find((n) => `${n.title} ${n.content}`.toLowerCase().includes(t.topic.toLowerCase()));
    const wordCount = matchedNote ? matchedNote.content.split(/\s+/).filter(Boolean).length : 0;
    const status = !matchedNote ? 'missing' : wordCount >= 40 ? 'complete' : 'partial';
    return {
      topic: t.topic,
      subject: t.subject,
      status,
      matchedNoteTitle: matchedNote?.title || null,
      wordCount,
    };
  });

  const subjectsPresent = Array.from(new Set(scopedNotes.map((n) => n.subject || 'General')));
  const bySubject = subjectsPresent.map((subj) => {
    const sNotes = scopedNotes.filter((n) => (n.subject || 'General') === subj);
    const totalWords = sNotes.reduce((sum, n) => sum + (n.content ? n.content.split(/\s+/).filter(Boolean).length : 0), 0);
    return {
      subject: subj,
      noteCount: sNotes.length,
      totalWords,
      structuredCount: sNotes.filter((n) => /^#{1,3}\s+/m.test(n.content)).length,
    };
  });

  const completedTopics = topicRows.filter((r) => r.status === 'complete').length;
  const partialTopics = topicRows.filter((r) => r.status === 'partial').length;
  const missingTopicsCount = topicRows.filter((r) => r.status === 'missing').length;
  const coveragePercent =
    topicRows.length > 0
      ? Math.round(((completedTopics + partialTopics * 0.5) / topicRows.length) * 100)
      : scopedNotes.length > 0
      ? Math.round(
          (scopedNotes.filter((n) => (n.content || '').split(/\s+/).filter(Boolean).length >= 30).length /
            scopedNotes.length) *
            100
        )
      : 0;

  const generatedAt = new Date().toISOString();
  const report = {
    generatedAt,
    studentId: actor.id,
    studentName: actor.name,
    subjectScope: subjectFilter || 'All Subjects',
    insufficientData: scopedNotes.length === 0 && topicRows.length === 0,
    totals: {
      totalNotes: scopedNotes.length,
      totalWords: scopedNotes.reduce((s, n) => s + (n.content ? n.content.split(/\s+/).filter(Boolean).length : 0), 0),
      topicsTracked: topicRows.length,
      completedTopics,
      partialTopics,
      missingTopics: missingTopicsCount,
      coveragePercent,
    },
    bySubject,
    topicCoverage: topicRows,
  };

  const mdLines = [
    `# Notebook Completion Report — ${actor.name}`,
    `Generated: ${generatedAt}`,
    `Scope: ${report.subjectScope}`,
    '',
    `- Total Notes: ${report.totals.totalNotes}`,
    `- Total Words: ${report.totals.totalWords}`,
    `- Coverage: ${report.totals.coveragePercent}%`,
    '',
    '## Subject Breakdown',
    ...(bySubject.length
      ? bySubject.map((s) => `- **${s.subject}**: ${s.noteCount} note(s), ${s.totalWords} words, ${s.structuredCount} structured`)
      : ['- No notes available yet.']),
    ...(topicRows.length
      ? [
          '',
          '## Topic Checklist',
          ...topicRows.map((t) => `- [${t.status.toUpperCase()}] ${t.topic} (${t.subject})${t.matchedNoteTitle ? ` — ${t.matchedNoteTitle}` : ''}`),
        ]
      : []),
  ];

  const csvRows = [
    'Category,Name,Subject,Status,CountOrWords,Reference',
    ...bySubject.map((s) => `Subject,"${s.subject.replace(/"/g, '""')}","${s.subject.replace(/"/g, '""')}",notes,${s.noteCount},"${s.totalWords} words"`),
    ...topicRows.map((t) => `Topic,"${t.topic.replace(/"/g, '""')}","${t.subject.replace(/"/g, '""')}",${t.status},${t.wordCount},"${(t.matchedNoteTitle || '').replace(/"/g, '""')}"`),
  ];

  return {
    httpStatus: 200,
    payload: {
      success: true,
      report,
      markdown: mdLines.join('\n'),
      csv: csvRows.join('\n'),
    },
  };
}

// ============================================================================
// 5. Assignment Quality Analyzer (Strictly Read-Only — NEVER Modifies Saved Work)
// ============================================================================

export async function handleAssignmentQualityAnalyze(params: {
  actor: AssignmentActor;
  body: any;
  requestId?: string;
}) {
  const { actor, body, requestId } = params;
  const title = String(body?.title || '').trim();
  const instructions = String(body?.instructions || body?.content || '').trim();
  const objectives: string[] = Array.isArray(body?.objectives)
    ? body.objectives.map((o: any) => String(o || '').trim()).filter(Boolean)
    : [];
  const questions: Array<{ prompt: string; marks?: number; difficulty?: string }> = Array.isArray(body?.questions)
    ? body.questions
        .map((q: any) =>
          typeof q === 'string'
            ? { prompt: q.trim(), marks: 5, difficulty: 'Medium' }
            : { prompt: String(q?.prompt || q?.text || '').trim(), marks: Number(q?.marks || 0), difficulty: String(q?.difficulty || '') }
        )
        .filter((q: any) => q.prompt)
    : [];
  const maxScore = Number(body?.maxScore || 0);

  if (!title && !instructions && questions.length === 0) {
    return {
      httpStatus: 400,
      payload: { success: false, error: 'Provide assignment title, instructions, or questions to analyze.' },
    };
  }

  // Clarity & Missing instructions check
  const missingInstructions: string[] = [];
  if (!title) missingInstructions.push('Assignment title is missing.');
  if (instructions.length < 25) missingInstructions.push('Instructions are too brief (< 25 chars); specify submission format and expectations.');
  if (!/rubric|marks|points|grading|step/i.test(`${instructions} ${JSON.stringify(body?.rubric || [])}`)) {
    missingInstructions.push('Grading criteria or mark expectations are not stated in instructions.');
  }
  if (!body?.dueDate) missingInstructions.push('Due date is not specified.');

  // Difficulty balance
  const counts = { Easy: 0, Medium: 0, Hard: 0, Unspecified: 0 };
  for (const q of questions) {
    const d = (q.difficulty || '').toLowerCase();
    if (d.includes('easy') || d.includes('found')) counts.Easy++;
    else if (d.includes('hard') || d.includes('adv') || d.includes('hots')) counts.Hard++;
    else if (d.includes('med') || d.includes('std')) counts.Medium++;
    else counts.Unspecified++;
  }

  // Repetition detection across question prompts via token Jaccard similarity
  const repeatedPairs: Array<{ q1: number; q2: number; similarity: number }> = [];
  const tokenized = questions.map((q) => new Set(q.prompt.toLowerCase().split(/\W+/).filter((w) => w.length >= 4)));
  for (let i = 0; i < tokenized.length; i++) {
    for (let j = i + 1; j < tokenized.length; j++) {
      const a = tokenized[i];
      const b = tokenized[j];
      if (!a.size || !b.size) continue;
      let inter = 0;
      a.forEach((tok) => {
        if (b.has(tok)) inter++;
      });
      const union = a.size + b.size - inter;
      const sim = union > 0 ? inter / union : 0;
      if (sim >= 0.6) {
        repeatedPairs.push({ q1: i + 1, q2: j + 1, similarity: Number(sim.toFixed(2)) });
      }
    }
  }

  // Mark distribution check
  const sumQuestionMarks = questions.reduce((s, q) => s + (Number.isFinite(q.marks) ? Number(q.marks) : 0), 0);
  const markMismatch = maxScore > 0 && questions.length > 0 && sumQuestionMarks !== maxScore;

  // Objective alignment check
  const questionTextLower = questions.map((q) => q.prompt.toLowerCase()).join(' ');
  const unalignedObjectives = objectives.filter((obj) => {
    const kws = obj.toLowerCase().split(/\W+/).filter((w) => w.length >= 4);
    return kws.length > 0 && !kws.some((kw) => questionTextLower.includes(kw));
  });

  const clarityScore = Math.max(20, 100 - missingInstructions.length * 20);
  const questionQualityScore = questions.length > 0 ? Math.max(30, 100 - repeatedPairs.length * 20 - (markMismatch ? 15 : 0)) : 50;

  let recommendations: string[] = [
    ...missingInstructions,
    ...(markMismatch ? [`Total question marks (${sumQuestionMarks}) do not equal assignment maxScore (${maxScore}).`] : []),
    ...(repeatedPairs.length ? [`Questions ${repeatedPairs.map((p) => `#${p.q1} & #${p.q2}`).join(', ')} have high lexical overlap.`] : []),
    ...(unalignedObjectives.length ? [`Objective(s) not clearly tested by questions: ${unalignedObjectives.join('; ')}`] : []),
  ];
  if (recommendations.length === 0) {
    recommendations = ['Assignment instructions, objectives, difficulty mix, and mark distribution look balanced.'];
  }

  let providerUsed: string | undefined;
  let modelUsed: string | undefined;
  if (questions.length > 0) {
    try {
      const aiRes = await generateAICompletionWithTelemetry({
        systemInstruction:
          'You are an academic quality reviewer. Return up to 3 concise improvement recommendations as a JSON array of strings. Read-only audit.',
        prompt: `Title: ${title}\nInstructions: ${instructions}\nObjectives: ${objectives.join('; ')}\nQuestions:\n${questions.map((q, i) => `${i + 1}. (${q.marks}m, ${q.difficulty || 'unspecified'}) ${q.prompt}`).join('\n')}`,
        jsonMode: true,
        taskType: 'fast',
        maxTokens: 500,
        requestId,
        endpointName: '/api/assignments/quality-analyze',
        userRole: actor.role,
      });
      providerUsed = aiRes.telemetry.providerUsed;
      modelUsed = aiRes.telemetry.modelUsed;
      const parsed = JSON.parse(aiRes.text);
      const arr = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.recommendations) ? parsed.recommendations : [];
      if (arr.length > 0) {
        const aiRecs = arr.slice(0, 3).map(String).filter(Boolean);
        recommendations = Array.from(new Set([...recommendations, ...aiRecs])).slice(0, 6);
      }
    } catch {}
  }

  return {
    httpStatus: 200,
    payload: {
      success: true,
      readOnly: true,
      mutatedSavedAssignment: false,
      analysis: {
        clarityScore,
        questionQualityScore,
        missingInstructions,
        difficultyBalance: counts,
        repeatedPairs,
        markDistribution: {
          questionCount: questions.length,
          sumQuestionMarks,
          declaredMaxScore: maxScore || sumQuestionMarks,
          markMismatch,
        },
        objectiveAlignment: {
          totalObjectives: objectives.length,
          unalignedObjectives,
        },
        recommendations,
      },
      providerUsed,
      modelUsed,
    },
  };
}

// ============================================================================
// 6. Group Projects (Creation, Groups, Roles, Milestones, Submissions, Grading)
// ============================================================================

function findUserGroupInProject(project: GroupProjectRecord, userId: string): ProjectGroup | undefined {
  return project.groups.find((g) => g.members.some((m) => m.userId === userId));
}

export async function listGroupProjects(cfg: { url: string; key: string }, actor: AssignmentActor) {
  if (isParentOrGuardian(actor.role)) {
    return { httpStatus: 403, payload: { success: false, error: 'Forbidden: Group Projects are unavailable for parent accounts.' } };
  }
  const byId = new Map<string, GroupProjectRecord>();
  if (cfg?.url && cfg?.key && process.env.NODE_ENV !== 'test') {
    try {
      const res = await supabaseFetchWithAnonRetry(
        `${cfg.url}/rest/v1/group_projects?select=*&order=created_at.desc&limit=100`,
        { headers: sbHeaders(cfg.key) }
      );
      if (res.ok) {
        const rows = (await res.json().catch(() => [])) as any[];
        if (Array.isArray(rows)) {
          for (const r of rows) {
            byId.set(String(r.id), {
              id: String(r.id),
              title: String(r.title || ''),
              subject: String(r.subject || 'General'),
              description: String(r.description || ''),
              classGrade: String(r.class_grade || 'Grade 10'),
              classSection: String(r.class_section || 'All Sections'),
              dueDate: String(r.due_date || ''),
              maxScore: Number(r.max_score || 100),
              createdBy: String(r.created_by || ''),
              createdByName: String(r.created_by_name || 'Faculty'),
              createdAt: String(r.created_at || new Date().toISOString()),
              groups: Array.isArray(r.groups) ? r.groups : [],
            });
          }
        }
      }
    } catch {}
  }

  runtimeGroupProjects.forEach((p, id) => byId.set(id, p));

  const isStaff = isFacultyRole(actor.role);
  const projects = Array.from(byId.values()).map((proj) => {
    if (isStaff) return proj;
    // Students only see full group workspace for their own group
    const ownGroups = proj.groups.filter((g) => g.members.some((m) => m.userId === actor.id));
    return {
      ...proj,
      groups: ownGroups,
    };
  });

  return { httpStatus: 200, payload: { success: true, projects } };
}

async function persistGroupProject(cfg: { url: string; key: string }, project: GroupProjectRecord) {
  runtimeGroupProjects.set(project.id, project);
  if (cfg?.url && cfg?.key && process.env.NODE_ENV !== 'test') {
    try {
      await supabaseFetchWithAnonRetry(`${cfg.url}/rest/v1/group_projects`, {
        method: 'POST',
        headers: sbHeaders(cfg.key, { Prefer: 'resolution=merge-duplicates' }),
        body: JSON.stringify({
          id: project.id,
          title: project.title,
          subject: project.subject,
          description: project.description,
          class_grade: project.classGrade,
          class_section: project.classSection,
          due_date: project.dueDate,
          max_score: project.maxScore,
          created_by: project.createdBy,
          created_by_name: project.createdByName,
          created_at: project.createdAt,
          groups: project.groups,
        }),
      });
    } catch {}
  }
}

export async function createGroupProject(cfg: { url: string; key: string }, actor: AssignmentActor, body: any) {
  if (!isFacultyRole(actor.role)) {
    return { httpStatus: 403, payload: { success: false, error: 'Forbidden: Only faculty can create group projects.' } };
  }
  const title = String(body?.title || '').trim();
  if (!title) {
    return { httpStatus: 400, payload: { success: false, error: 'Project title is required.' } };
  }
  const now = new Date().toISOString();
  const project: GroupProjectRecord = {
    id: String(body?.id || `gp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`),
    title,
    subject: String(body?.subject || 'General').trim(),
    description: String(body?.description || '').trim(),
    classGrade: String(body?.classGrade || 'Grade 10').trim(),
    classSection: String(body?.classSection || 'All Sections').trim(),
    dueDate: String(body?.dueDate || new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0]),
    maxScore: Number(body?.maxScore || 100),
    createdBy: actor.id,
    createdByName: actor.name,
    createdAt: now,
    groups: Array.isArray(body?.groups) ? body.groups : [],
  };
  await persistGroupProject(cfg, project);
  return { httpStatus: 201, payload: { success: true, project } };
}

export async function upsertProjectGroup(
  cfg: { url: string; key: string },
  actor: AssignmentActor,
  projectId: string,
  body: any
) {
  if (!isFacultyRole(actor.role)) {
    return { httpStatus: 403, payload: { success: false, error: 'Forbidden: Only faculty can create or assign project groups.' } };
  }
  const project = runtimeGroupProjects.get(projectId);
  if (!project) return { httpStatus: 404, payload: { success: false, error: 'Group project not found.' } };

  const groupId = String(body?.groupId || `grp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`);
  const groupName = String(body?.name || 'Team Alpha').trim();
  const members: ProjectGroupMember[] = Array.isArray(body?.members)
    ? body.members
        .filter((m: any) => m?.userId || m?.name)
        .map((m: any) => ({
          userId: String(m.userId || m.id || m.name),
          name: String(m.name || m.userId || 'Member'),
          role: (['Leader', 'Researcher', 'Builder', 'Presenter', 'Reviewer'].includes(String(m.role))
            ? m.role
            : 'Builder') as ProjectGroupMember['role'],
        }))
    : [];
  const milestones: ProjectMilestone[] = Array.isArray(body?.milestones)
    ? body.milestones.map((ms: any, idx: number) => ({
        id: String(ms?.id || `ms_${idx + 1}`),
        title: String(ms?.title || `Milestone ${idx + 1}`),
        dueDate: ms?.dueDate ? String(ms.dueDate) : undefined,
        status: (['todo', 'in_progress', 'done'].includes(String(ms?.status)) ? ms.status : 'todo') as ProjectMilestone['status'],
        progressNote: ms?.progressNote ? String(ms.progressNote) : undefined,
      }))
    : [
        { id: 'ms_1', title: 'Research & Planning', status: 'todo' },
        { id: 'ms_2', title: 'Draft Deliverable & Review', status: 'todo' },
      ];

  const existingIdx = project.groups.findIndex((g) => g.id === groupId);
  const nextGroup: ProjectGroup = {
    ...(existingIdx >= 0 ? project.groups[existingIdx] : {}),
    id: groupId,
    name: groupName,
    members,
    milestones,
    status: existingIdx >= 0 ? project.groups[existingIdx].status : 'active',
  };

  const nextGroups = [...project.groups];
  if (existingIdx >= 0) nextGroups[existingIdx] = nextGroup;
  else nextGroups.push(nextGroup);

  const updated = { ...project, groups: nextGroups };
  await persistGroupProject(cfg, updated);
  return { httpStatus: 200, payload: { success: true, project: updated, group: nextGroup } };
}

export async function updateProjectMilestone(
  cfg: { url: string; key: string },
  actor: AssignmentActor,
  projectId: string,
  body: any
) {
  if (isParentOrGuardian(actor.role)) {
    return { httpStatus: 403, payload: { success: false, error: 'Forbidden: Parents cannot update project milestones.' } };
  }
  const project = runtimeGroupProjects.get(projectId);
  if (!project) return { httpStatus: 404, payload: { success: false, error: 'Group project not found.' } };

  const groupId = String(body?.groupId || '').trim();
  const group = groupId
    ? project.groups.find((g) => g.id === groupId)
    : findUserGroupInProject(project, actor.id);
  if (!group) return { httpStatus: 404, payload: { success: false, error: 'Project group not found.' } };

  const isStaff = isFacultyRole(actor.role);
  const isMember = group.members.some((m) => m.userId === actor.id);
  if (!isStaff && !isMember) {
    return {
      httpStatus: 403,
      payload: { success: false, error: 'Forbidden: You are not a member of this project group.' },
    };
  }

  const milestoneId = String(body?.milestoneId || '').trim();
  const msIdx = group.milestones.findIndex((m) => m.id === milestoneId);
  const now = new Date().toISOString();
  const nextStatus = (['todo', 'in_progress', 'done'].includes(String(body?.status)) ? body.status : 'in_progress') as ProjectMilestone['status'];

  const nextMilestones = [...group.milestones];
  if (msIdx >= 0) {
    nextMilestones[msIdx] = {
      ...nextMilestones[msIdx],
      status: nextStatus,
      progressNote: body?.progressNote !== undefined ? String(body.progressNote) : nextMilestones[msIdx].progressNote,
      updatedBy: actor.name,
      updatedAt: now,
    };
  } else {
    nextMilestones.push({
      id: milestoneId || `ms_${Date.now()}`,
      title: String(body?.title || 'Project Milestone'),
      status: nextStatus,
      progressNote: body?.progressNote ? String(body.progressNote) : undefined,
      updatedBy: actor.name,
      updatedAt: now,
    });
  }

  const nextGroups = project.groups.map((g) => (g.id === group.id ? { ...g, milestones: nextMilestones } : g));
  const updated = { ...project, groups: nextGroups };
  await persistGroupProject(cfg, updated);
  return { httpStatus: 200, payload: { success: true, project: updated } };
}

export async function submitGroupProject(
  cfg: { url: string; key: string },
  actor: AssignmentActor,
  projectId: string,
  body: any
) {
  if (isParentOrGuardian(actor.role)) {
    return { httpStatus: 403, payload: { success: false, error: 'Forbidden: Parents cannot submit group projects.' } };
  }
  const project = runtimeGroupProjects.get(projectId);
  if (!project) return { httpStatus: 404, payload: { success: false, error: 'Group project not found.' } };

  const groupId = String(body?.groupId || '').trim();
  const group = groupId
    ? project.groups.find((g) => g.id === groupId)
    : findUserGroupInProject(project, actor.id);
  if (!group) return { httpStatus: 404, payload: { success: false, error: 'Project group not found.' } };

  const isStaff = isFacultyRole(actor.role);
  const isMember = group.members.some((m) => m.userId === actor.id);
  if (!isStaff && !isMember) {
    return {
      httpStatus: 403,
      payload: { success: false, error: 'Forbidden: Only members of this group can submit deliverables.' },
    };
  }

  const submissionText = String(body?.submissionText || '').trim();
  if (!submissionText && !body?.attachmentUrl) {
    return { httpStatus: 400, payload: { success: false, error: 'Submission summary or attachment URL is required.' } };
  }

  const now = new Date().toISOString();
  const nextGroups = project.groups.map((g) =>
    g.id === group.id
      ? {
          ...g,
          submissionText,
          attachmentUrl: body?.attachmentUrl ? String(body.attachmentUrl) : g.attachmentUrl,
          submittedBy: actor.name,
          submittedAt: now,
          status: 'submitted' as const,
        }
      : g
  );
  const updated = { ...project, groups: nextGroups };
  await persistGroupProject(cfg, updated);
  return { httpStatus: 200, payload: { success: true, project: updated } };
}

export async function gradeGroupProject(
  cfg: { url: string; key: string },
  actor: AssignmentActor,
  projectId: string,
  body: any
) {
  if (!isFacultyRole(actor.role)) {
    return {
      httpStatus: 403,
      payload: { success: false, error: 'Forbidden: Only faculty can grade group project submissions.' },
    };
  }
  const project = runtimeGroupProjects.get(projectId);
  if (!project) return { httpStatus: 404, payload: { success: false, error: 'Group project not found.' } };

  const groupId = String(body?.groupId || '').trim();
  const group = project.groups.find((g) => g.id === groupId);
  if (!group) return { httpStatus: 404, payload: { success: false, error: 'Project group not found.' } };

  const score = Number(body?.score);
  if (Number.isNaN(score) || score < 0 || score > project.maxScore) {
    return { httpStatus: 400, payload: { success: false, error: `Score must be between 0 and ${project.maxScore}.` } };
  }

  const now = new Date().toISOString();
  const nextGroups = project.groups.map((g) =>
    g.id === group.id
      ? {
          ...g,
          score,
          feedback: String(body?.feedback || '').trim(),
          gradedBy: actor.name,
          gradedAt: now,
          status: 'graded' as const,
        }
      : g
  );
  const updated = { ...project, groups: nextGroups };
  await persistGroupProject(cfg, updated);
  return { httpStatus: 200, payload: { success: true, project: updated } };
}
