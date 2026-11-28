/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Material Hub Intelligence Service
 * - Grounded "Ask to Materials" Q&A strictly scoped to role & visibility-authorized materials
 * - Never fabricates citations, excerpts, URLs, or scores
 * - Separates internal Material Hub matches from clearly labeled external study suggestions
 */

import { generateAICompletionWithTelemetry } from './aiClient';
import { supabaseFetchWithAnonRetry } from './supabaseKeyManager';

export interface MaterialActor {
  id: string;
  role: string;
  grade?: string;
  section?: string;
  name?: string;
  email?: string;
  authenticated?: boolean;
}

export interface MaterialRecord {
  id: string;
  title: string;
  subject: string;
  type: string;
  description: string;
  content?: string;
  extractedText?: string;
  aiSummary?: string;
  fileName?: string;
  uploadedBy?: string;
  uploaderUid?: string;
  visibility?: string;
  isPublic?: boolean;
  isVerified?: boolean;
  classGrade?: string;
  visibleToGrades?: string[];
  questionPaperYear?: string;
  downloads?: number;
  likes?: number;
  url?: string;
}

export interface MaterialCitation {
  materialId: string;
  title: string;
  subject: string;
  sectionOrPage: string;
  excerpt: string;
  score: number;
}

export interface AskMaterialsResult {
  success: boolean;
  answer: string;
  foundInMaterials: boolean;
  citations: MaterialCitation[];
  authorizedMaterialCount: number;
  disclaimer: string;
  followUpSuggestions: string[];
  providerUsed?: string;
  modelUsed?: string;
  error?: string;
}

export interface InternalMaterialRecommendation {
  materialId: string;
  title: string;
  subject: string;
  type: string;
  isVerified: boolean;
  reason: string;
  relevanceScore: number;
}

export interface ExternalStudySuggestion {
  label: 'External Study Suggestion';
  title: string;
  resourceType: 'Concept Guide' | 'Practice Problems' | 'Reference Topic' | 'Video Search Topic';
  suggestedSearchQuery: string;
  reason: string;
}

export interface MaterialRecommendationsResult {
  success: boolean;
  internalRecommendations: InternalMaterialRecommendation[];
  externalSuggestions: ExternalStudySuggestion[];
  externalDisclaimer: string;
  providerUsed?: string;
  modelUsed?: string;
  error?: string;
}

const STOP_WORDS = new Set([
  'the', 'is', 'at', 'which', 'on', 'and', 'or', 'for', 'to', 'of', 'in', 'a', 'an',
  'what', 'why', 'how', 'when', 'where', 'who', 'can', 'you', 'explain', 'me', 'tell',
  'about', 'from', 'with', 'this', 'that', 'these', 'those', 'are', 'was', 'were',
  'does', 'do', 'did', 'please', 'find', 'show', 'give', 'my', 'our', 'your', 'materials',
  'material', 'notes', 'chapter', 'topic', 'help', 'study',
]);

export function tokenizeAcademicQuery(text: string): string[] {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s\-+]/g, ' ')
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2 && !STOP_WORDS.has(t));
}

export function normalizeRoleLower(role?: string | null): string {
  return String(role || 'student').toLowerCase().trim();
}

export function isFacultyTier(role?: string | null): boolean {
  const r = normalizeRoleLower(role);
  return ['teacher', 'faculty', 'head_teacher', 'coordinator', 'hod', 'admin', 'super_admin'].includes(r);
}

/**
 * Authoritative visibility check for a Material Hub document.
 * - `teacher` / `faculty` vault materials are NEVER visible to students, parents, or guardians.
 * - `private` materials are ONLY visible to the uploader (matching uploaderUid) or super_admin/admin.
 */
export function isMaterialAuthorizedForActor(mat: MaterialRecord, actor: MaterialActor): boolean {
  const role = normalizeRoleLower(actor.role);
  const visibility = String(mat.visibility || 'student').toLowerCase().trim();
  const isStaff = isFacultyTier(role);

  if ((visibility === 'teacher' || visibility === 'faculty' || visibility === 'staff') && !isStaff) {
    return false;
  }

  if (visibility === 'private') {
    const ownerId = String(mat.uploaderUid || '').trim();
    if (role !== 'admin' && role !== 'super_admin' && (!ownerId || ownerId !== actor.id)) {
      return false;
    }
  }

  // Cohort / grade scoping for students if material explicitly restricts grades
  if (role === 'student' && Array.isArray(mat.visibleToGrades) && mat.visibleToGrades.length > 0 && mat.isPublic === false) {
    const actorGrade = String(actor.grade || '').toLowerCase().trim();
    if (actorGrade) {
      const normalizedAllowed = mat.visibleToGrades.map((g) => String(g).toLowerCase().trim());
      if (!normalizedAllowed.some((g) => g === actorGrade || g === 'all' || g === 'all grades')) {
        return false;
      }
    }
  }

  return true;
}

export function normalizeMaterialRecord(row: any): MaterialRecord {
  const raw = row?.raw_data && typeof row.raw_data === 'object' ? row.raw_data : {};
  return {
    id: String(row?.id || raw?.id || ''),
    title: String(row?.title || raw?.title || 'Untitled Material'),
    subject: String(row?.subject || raw?.subject || 'General'),
    type: String(row?.type || raw?.type || 'notes'),
    description: String(row?.description || raw?.description || ''),
    content: String(row?.content || raw?.content || ''),
    extractedText: String(row?.extracted_text || raw?.extractedText || row?.extractedText || ''),
    aiSummary: String(row?.ai_summary || raw?.aiSummary || row?.aiSummary || ''),
    fileName: String(row?.file_name || raw?.fileName || row?.fileName || ''),
    uploadedBy: String(row?.uploaded_by || raw?.uploadedBy || row?.uploadedBy || ''),
    uploaderUid: String(row?.uploader_uid || raw?.uploaderUid || row?.uploaderUid || ''),
    visibility: String(row?.visibility || raw?.visibility || (row?.is_public === false ? 'private' : 'student')),
    isPublic: row?.is_public ?? raw?.isPublic ?? row?.isPublic ?? true,
    isVerified: Boolean(row?.is_verified ?? raw?.isVerified ?? row?.isVerified ?? false),
    classGrade: String(row?.class_grade || raw?.classGrade || row?.classGrade || ''),
    visibleToGrades: Array.isArray(row?.visible_to_grades)
      ? row.visible_to_grades
      : Array.isArray(raw?.visibleToGrades)
      ? raw.visibleToGrades
      : Array.isArray(row?.visibleToGrades)
      ? row.visibleToGrades
      : [],
    questionPaperYear: String(row?.question_paper_year || raw?.questionPaperYear || row?.questionPaperYear || ''),
    downloads: Number(row?.downloads ?? raw?.downloads ?? 0),
    likes: Number(row?.likes ?? raw?.likes ?? 0),
    url: String(row?.url || row?.file_url || raw?.url || ''),
  };
}

export async function loadMaterialsForIntelligence(
  cfg: { url: string; key: string },
  clientMaterials?: any[]
): Promise<MaterialRecord[]> {
  const byId = new Map<string, MaterialRecord>();

  if (cfg?.url && cfg?.key && process.env.NODE_ENV !== 'test') {
    try {
      const res = await supabaseFetchWithAnonRetry(
        `${cfg.url}/rest/v1/materials?select=*&limit=250`,
        {
          headers: {
            apikey: cfg.key,
            Authorization: `Bearer ${cfg.key}`,
          },
        }
      );
      if (res.ok) {
        const rows = (await res.json().catch(() => [])) as any[];
        if (Array.isArray(rows)) {
          for (const row of rows) {
            const norm = normalizeMaterialRecord(row);
            if (norm.id) byId.set(norm.id, norm);
          }
        }
      }
    } catch {
      // Fall back gracefully to caller snapshot if Supabase is unavailable
    }
  }

  if (Array.isArray(clientMaterials)) {
    for (const item of clientMaterials) {
      const norm = normalizeMaterialRecord(item);
      if (norm.id && !byId.has(norm.id)) {
        byId.set(norm.id, norm);
      }
    }
  }

  return Array.from(byId.values());
}

interface CandidateChunk {
  material: MaterialRecord;
  sectionOrPage: string;
  text: string;
  score: number;
}

function buildChunksForMaterial(mat: MaterialRecord): Array<{ sectionOrPage: string; text: string }> {
  const chunks: Array<{ sectionOrPage: string; text: string }> = [];
  if (mat.description && mat.description.trim()) {
    chunks.push({ sectionOrPage: 'Summary & Description', text: mat.description.trim() });
  }
  if (mat.aiSummary && mat.aiSummary.trim()) {
    chunks.push({ sectionOrPage: 'Study Summary', text: mat.aiSummary.trim() });
  }
  const fullBody = [mat.extractedText, mat.content].filter(Boolean).join('\n\n').trim();
  if (fullBody) {
    const paragraphs = fullBody
      .split(/\n{2,}|(?=^#{1,3}\s+)/m)
      .map((p) => p.trim())
      .filter((p) => p.length > 0);
    if (paragraphs.length === 0) {
      chunks.push({ sectionOrPage: 'Document Body (Page 1)', text: fullBody.slice(0, 600) });
    } else {
      paragraphs.slice(0, 12).forEach((para, idx) => {
        const headingMatch = para.match(/^#{1,3}\s+([^\n]+)/);
        const label = headingMatch
          ? `Section: ${headingMatch[1].trim().slice(0, 48)}`
          : `Section ${idx + 1}`;
        chunks.push({ sectionOrPage: label, text: para.slice(0, 650) });
      });
    }
  }
  if (chunks.length === 0) {
    chunks.push({
      sectionOrPage: 'Title & Metadata',
      text: `${mat.title} (${mat.subject} · ${mat.type})`,
    });
  }
  return chunks;
}

export function retrieveMaterialCitations(
  question: string,
  authorizedMaterials: MaterialRecord[],
  options?: { materialId?: string; subject?: string; limit?: number }
): CandidateChunk[] {
  const queryTokens = tokenizeAcademicQuery(question);
  const targetMaterialId = String(options?.materialId || '').trim();
  const targetSubject = String(options?.subject || '').toLowerCase().trim();
  const limit = options?.limit ?? 5;

  const pool = authorizedMaterials.filter((m) => {
    if (targetMaterialId && m.id !== targetMaterialId) return false;
    if (targetSubject && targetSubject !== 'all' && m.subject.toLowerCase() !== targetSubject) return false;
    return true;
  });

  const scored: CandidateChunk[] = [];
  const lowerQuestion = question.toLowerCase().trim();

  for (const mat of pool) {
    const titleLower = mat.title.toLowerCase();
    const subjectLower = mat.subject.toLowerCase();
    const chunks = buildChunksForMaterial(mat);

    for (const chunk of chunks) {
      const haystack = `${titleLower} ${subjectLower} ${chunk.text.toLowerCase()} ${(mat.fileName || '').toLowerCase()}`;
      let score = 0;

      if (queryTokens.length === 0) {
        score = targetMaterialId ? 3 : 0;
      } else {
        for (const tok of queryTokens) {
          if (titleLower.includes(tok)) score += 3;
          if (subjectLower.includes(tok)) score += 2;
          if (chunk.text.toLowerCase().includes(tok)) score += 2;
        }
        if (lowerQuestion.length >= 6 && haystack.includes(lowerQuestion)) {
          score += 5;
        }
      }

      if (score > 0) {
        if (mat.isVerified) score += 0.5;
        scored.push({
          material: mat,
          sectionOrPage: chunk.sectionOrPage,
          text: chunk.text,
          score,
        });
      }
    }
  }

  scored.sort((a, b) => b.score - a.score);

  // Deduplicate by (materialId + sectionOrPage)
  const seen = new Set<string>();
  const top: CandidateChunk[] = [];
  for (const item of scored) {
    const key = `${item.material.id}::${item.sectionOrPage}`;
    if (!seen.has(key)) {
      seen.add(key);
      top.push(item);
      if (top.length >= limit) break;
    }
  }
  return top;
}

export async function handleAskMaterialsRequest(params: {
  cfg: { url: string; key: string };
  actor: MaterialActor;
  body: any;
  requestId?: string;
}): Promise<{ httpStatus: number; payload: AskMaterialsResult }> {
  const { cfg, actor, body, requestId } = params;
  const question = String(body?.question || body?.prompt || '').trim();
  if (!question) {
    return {
      httpStatus: 400,
      payload: {
        success: false,
        answer: 'Please enter a specific question about your course materials.',
        foundInMaterials: false,
        citations: [],
        authorizedMaterialCount: 0,
        disclaimer: '',
        followUpSuggestions: [],
        error: 'Question is required.',
      },
    };
  }

  const allMaterials = await loadMaterialsForIntelligence(cfg, body?.materials);
  const authorizedMaterials = allMaterials.filter((m) => isMaterialAuthorizedForActor(m, actor));

  // If user requested a specific materialId that exists in store but is unauthorized, refuse cleanly with 403
  const requestedMatId = String(body?.materialId || '').trim();
  if (requestedMatId) {
    const targetMat = allMaterials.find((m) => m.id === requestedMatId);
    if (targetMat && !isMaterialAuthorizedForActor(targetMat, actor)) {
      return {
        httpStatus: 403,
        payload: {
          success: false,
          answer: 'Permission denied: you are not authorized to query this restricted material.',
          foundInMaterials: false,
          citations: [],
          authorizedMaterialCount: authorizedMaterials.length,
          disclaimer: 'Restricted material access denied.',
          followUpSuggestions: [],
          error: 'Forbidden: restricted material.',
        },
      };
    }
  }

  const hits = retrieveMaterialCitations(question, authorizedMaterials, {
    materialId: requestedMatId || undefined,
    subject: typeof body?.subject === 'string' ? body.subject : undefined,
    limit: 5,
  });

  const citations: MaterialCitation[] = hits.map((h) => ({
    materialId: h.material.id,
    title: h.material.title,
    subject: h.material.subject,
    sectionOrPage: h.sectionOrPage,
    excerpt: h.text.slice(0, 260),
    score: Number(h.score.toFixed(1)),
  }));

  if (citations.length === 0) {
    return {
      httpStatus: 200,
      payload: {
        success: true,
        foundInMaterials: false,
        citations: [],
        authorizedMaterialCount: authorizedMaterials.length,
        disclaimer:
          'Not found in your authorized Material Hub files. No synthetic citations were generated.',
        answer:
          `I searched ${authorizedMaterials.length} authorized Material Hub resource(s), and none directly cover "${question}".\n\n` +
          `Try broadening your subject filter, uploading notes for this chapter, or checking Resources Recommendations for related study topics.`,
        followUpSuggestions: [
          'Broaden search across all subjects in Material Hub',
          'Show study topic recommendations for this question',
        ],
      },
    };
  }

  const groundedContext = hits
    .map(
      (h, i) =>
        `[${i + 1}] MaterialID: ${h.material.id} | Title: "${h.material.title}" | Subject: ${h.material.subject} | Location: ${h.sectionOrPage}\nExcerpt: ${h.text}`
    )
    .join('\n\n');

  const history = Array.isArray(body?.history)
    ? body.history
        .filter((h: any) => h && typeof h.content === 'string')
        .slice(-6)
        .map((h: any) => ({
          role: (h.role === 'assistant' ? 'assistant' : 'user') as 'user' | 'assistant',
          content: String(h.content).slice(0, 1200),
        }))
    : [];

  let finalAnswer = '';
  let providerUsed: string | undefined;
  let modelUsed: string | undefined;

  try {
    const aiRes = await generateAICompletionWithTelemetry({
      systemInstruction:
        'You are Veylentra Material Hub Q&A Assistant. Answer the user question strictly from the provided Material Hub excerpts. ' +
        'Cite sources inline using [1], [2], etc. matching ONLY the provided excerpts. ' +
        'If the excerpts only partially answer the question, state clearly what is covered and what is missing. NEVER invent page numbers, citations, or URLs.',
      prompt: `Authorized Material Hub Excerpts:\n${groundedContext}\n\nQuestion: ${question}`,
      history,
      taskType: 'general',
      maxTokens: 2048,
      requestId,
      endpointName: '/api/materials/ask',
      userRole: actor.role,
    });
    finalAnswer = aiRes.text;
    providerUsed = aiRes.telemetry.providerUsed;
    modelUsed = aiRes.telemetry.modelUsed;
  } catch {
    // Deterministic grounded synthesis when external AI keys are unavailable
    finalAnswer =
      `Based on ${citations.length} authorized Material Hub source(s):\n\n` +
      citations
        .map((c, idx) => `- **[${idx + 1}] ${c.title}** (${c.sectionOrPage}): ${c.excerpt}`)
        .join('\n');
  }

  return {
    httpStatus: 200,
    payload: {
      success: true,
      foundInMaterials: true,
      answer: finalAnswer,
      citations,
      authorizedMaterialCount: authorizedMaterials.length,
      disclaimer: 'Grounded strictly in authorized Material Hub entries.',
      followUpSuggestions: [
        `Summarize key takeaways from ${citations[0].title}`,
        `Generate 3 practice check questions from ${citations[0].subject} materials`,
      ],
      providerUsed,
      modelUsed,
    },
  };
}

export async function handleMaterialRecommendationsRequest(params: {
  cfg: { url: string; key: string };
  actor: MaterialActor;
  body: any;
  requestId?: string;
}): Promise<{ httpStatus: number; payload: MaterialRecommendationsResult }> {
  const { cfg, actor, body, requestId } = params;
  const subject = String(body?.subject || '').trim();
  const topic = String(body?.topic || '').trim();
  const grade = String(body?.grade || actor.grade || 'Grade 10').trim();
  const weakAreas: string[] = Array.isArray(body?.weakAreas)
    ? body.weakAreas.map((w: any) => String(w || '').trim()).filter(Boolean)
    : [];

  const allMaterials = await loadMaterialsForIntelligence(cfg, body?.materials);
  const authorizedMaterials = allMaterials.filter((m) => isMaterialAuthorizedForActor(m, actor));

  const querySeed = [subject, topic, ...weakAreas].filter(Boolean).join(' ');
  const tokens = tokenizeAcademicQuery(querySeed);

  const scoredInternal = authorizedMaterials
    .map((m) => {
      const hay = `${m.title} ${m.subject} ${m.description} ${m.type}`.toLowerCase();
      let score = 0;
      if (subject && m.subject.toLowerCase() === subject.toLowerCase()) score += 4;
      for (const tok of tokens) {
        if (m.title.toLowerCase().includes(tok)) score += 3;
        if (hay.includes(tok)) score += 1.5;
      }
      if (m.isVerified) score += 1;
      if (!tokens.length && !subject) {
        score = (m.isVerified ? 2 : 1) + Math.min(2, (m.downloads || 0) / 50);
      }

      const reasons: string[] = [];
      if (subject && m.subject.toLowerCase() === subject.toLowerCase()) {
        reasons.push(`Matches ${subject}`);
      }
      const matchedTerms = tokens.filter((t) => hay.includes(t));
      if (matchedTerms.length > 0) {
        reasons.push(`Covers ${matchedTerms.slice(0, 3).join(', ')}`);
      }
      if (m.isVerified) {
        reasons.push('Faculty verified');
      }
      if (reasons.length === 0) {
        reasons.push(`Available ${m.subject} ${m.type} in Material Hub`);
      }

      return {
        materialId: m.id,
        title: m.title,
        subject: m.subject,
        type: m.type,
        isVerified: Boolean(m.isVerified),
        reason: reasons.join(' · '),
        relevanceScore: Number(score.toFixed(1)),
      };
    })
    .filter((item) => item.relevanceScore > 0)
    .sort((a, b) => b.relevanceScore - a.relevanceScore)
    .slice(0, 6);

  // External study suggestions: NO fabricated URLs; descriptive study topics & search terms only
  const focusSubject = subject || scoredInternal[0]?.subject || 'Core Academic Studies';
  const focusTopic = topic || weakAreas[0] || `${focusSubject} fundamentals`;

  let externalSuggestions: ExternalStudySuggestion[] = [
    {
      label: 'External Study Suggestion',
      title: `${focusSubject}: Worked Examples on ${focusTopic}`,
      resourceType: 'Practice Problems',
      suggestedSearchQuery: `${grade} ${focusSubject} ${focusTopic} worked examples problems`,
      reason: weakAreas.length
        ? `Targets identified weak area: ${weakAreas[0]}.`
        : `Reinforces conceptual application for ${focusTopic}.`,
    },
    {
      label: 'External Study Suggestion',
      title: `${focusSubject}: Concept Summary & Formula Sheet (${grade})`,
      resourceType: 'Concept Guide',
      suggestedSearchQuery: `${grade} ${focusSubject} ${focusTopic} concept summary formula sheet`,
      reason: `Provides quick revision scaffolding alongside your Material Hub notes.`,
    },
    {
      label: 'External Study Suggestion',
      title: `${focusSubject}: Visual Walkthrough — ${focusTopic}`,
      resourceType: 'Video Search Topic',
      suggestedSearchQuery: `${focusSubject} ${focusTopic} step by step explanation`,
      reason: `Helps clarify multi-step reasoning visually.`,
    },
  ];

  let providerUsed: string | undefined;
  let modelUsed: string | undefined;

  if (querySeed) {
    try {
      const aiRes = await generateAICompletionWithTelemetry({
        systemInstruction:
          'Suggest up to 3 external study topic ideas as a JSON array of objects with keys: "title", "resourceType" (one of "Concept Guide","Practice Problems","Reference Topic","Video Search Topic"), "suggestedSearchQuery", "reason". ' +
          'NEVER include URLs or domains. Output valid JSON array only.',
        prompt: `Grade: ${grade}\nSubject: ${focusSubject}\nTopic: ${focusTopic}\nWeak areas: ${weakAreas.join(', ') || 'None specified'}`,
        jsonMode: true,
        taskType: 'fast',
        maxTokens: 700,
        requestId,
        endpointName: '/api/materials/recommendations',
        userRole: actor.role,
      });
      providerUsed = aiRes.telemetry.providerUsed;
      modelUsed = aiRes.telemetry.modelUsed;
      const parsed = JSON.parse(aiRes.text);
      const arr = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.suggestions) ? parsed.suggestions : [];
      if (arr.length > 0) {
        externalSuggestions = arr.slice(0, 3).map((item: any) => ({
          label: 'External Study Suggestion' as const,
          title: String(item?.title || `${focusSubject} Study Topic`).replace(/https?:\/\/\S+/gi, '').trim(),
          resourceType: (['Concept Guide', 'Practice Problems', 'Reference Topic', 'Video Search Topic'].includes(
            String(item?.resourceType)
          )
            ? item.resourceType
            : 'Reference Topic') as ExternalStudySuggestion['resourceType'],
          suggestedSearchQuery: String(item?.suggestedSearchQuery || `${focusSubject} ${focusTopic}`)
            .replace(/https?:\/\/\S+/gi, '')
            .trim(),
          reason: String(item?.reason || `Recommended for ${focusTopic}.`).slice(0, 220),
        }));
      }
    } catch {
      // Keep deterministic grounded suggestions with zero fake URLs
    }
  }

  return {
    httpStatus: 200,
    payload: {
      success: true,
      internalRecommendations: scoredInternal,
      externalSuggestions,
      externalDisclaimer:
        'External Study Suggestions list topic queries outside your school Material Hub—no unverified links are generated.',
      providerUsed,
      modelUsed,
    },
  };
}
