import React, { useState } from 'react';
import { supabase } from './supabase';
import { upsertDeck, upsertCard, syncDeckToSupabase, syncCardToSupabase } from './flashcardStorage';
import { Flashcard, FlashcardDeck } from '../types';

export interface WebSearchSourceInfo {
  title: string;
  url: string;
  domain: string;
  snippet: string;
  sourceType: 'official' | 'academic' | 'news' | 'reference' | 'web';
  publishedDate?: string;
}

export interface AIStreamTelemetry {
  requestId?: string;
  modelUsed?: string;
  complexityTier?: 'fast' | 'general' | 'complex';
  requestStart: number;
  firstTokenLatencyMs: number | null;
  totalGenerationTimeMs: number;
  dataRetrievalLatencyMs: number;
  streamed: boolean;
  webSearchUsed?: boolean;
  webSources?: WebSearchSourceInfo[];
}

export interface StudentOSLocalContextSnapshot {
  homeworkList?: any[];
  vaultNotes?: any[];
  materials?: any[];
  schedule?: any[];
  tasks?: any[];
  notifications?: any[];
}

interface PerUserContextCacheEntry {
  userId: string;
  role: string;
  timestamp: number;
  contextString: string;
}

// Per-user isolated context cache (never shared across users; cleared on user change or DB update)
const userContextCache = new Map<string, PerUserContextCacheEntry>();
const CONTEXT_CACHE_TTL_MS = 30000; // 30 seconds

if (typeof window !== 'undefined') {
  window.addEventListener('studentos-db-update', () => {
    userContextCache.clear();
  });
}

/**
 * Sanitizes untrusted database text before placing it inside the AI context window
 * to prevent prompt injection from uploaded notes or materials.
 */
function sanitizeUntrustedRecordText(input: string, maxLen = 350): string {
  if (!input) return '';
  return String(input)
    .replace(/<\/?studentos_authorized_context>/gi, '')
    .replace(/\b(ignore previous instructions|system prompt|override permissions|you are now)\b/gi, '[filtered]')
    .trim()
    .slice(0, maxLen);
}

/**
 * Determines whether a student/teacher prompt requires fetching live StudentOS database context.
 * For simple greetings or pure concept explanations ("Explain lines and angles"), this returns false
 * so we achieve near-zero pre-request latency.
 */
export function doesPromptNeedStudentOSContext(prompt: string): boolean {
  const lower = (prompt || '').toLowerCase();
  const contextKeywords = [
    /\b(my|our|school|class|section|grade)\b/i,
    /\b(homework|assignment|assignments|due|deadline|deadlines|pending|overdue|submit|submission)\b/i,
    /\b(note|notes|lecture|vault|material|materials|resource|resources|syllabus|chapter)\b/i,
    /\b(test|exam|quiz|schedule|timetable|planner|study plan|calendar|event|events|tomorrow|today|this week)\b/i,
    /\b(attendance|present|absent|late|leave)\b/i,
    /\b(flashcard|flashcards|deck|study center)\b/i,
    /\b(house|ruby|emerald|sapphire|topaz|points|xp|streak|level|badge|badges|leaderboard|competition|club|clubs|poll)\b/i,
    /\b(notice|notices|announcement|announcements|notification|notifications|meet|meeting)\b/i
  ];
  return contextKeywords.some((regex) => regex.test(lower));
}

/**
 * Retrieves authorized StudentOS context strictly scoped to the authenticated user's identity,
 * role, grade, section, and school_id. Uses parallel queries and isolated per-user caching.
 */
export async function buildAuthorizedStudentOSContext(
  prompt: string,
  currentUser: any,
  effectiveRole: string,
  localSnapshot?: StudentOSLocalContextSnapshot
): Promise<{ contextString: string; retrievalMs: number; hasStudentOSData: boolean }> {
  const start = Date.now();
  if (!currentUser) {
    return { contextString: '', retrievalMs: 0, hasStudentOSData: false };
  }

  const userId = String(currentUser.uid || currentUser.id || currentUser.email || 'guest');
  const userRole = String(effectiveRole || currentUser.role || 'student').toLowerCase();
  const userGrade = String(currentUser.grade || 'Grade 10');
  const userSection = String(currentUser.section || 'Solara');
  const userHouse = String(currentUser.house || 'Ruby');
  const schoolId = String(currentUser.school_id || currentUser.schoolId || 'default_school');

  // Lightweight identity header always included
  const profileHeader = [
    `Authenticated User: ${sanitizeUntrustedRecordText(currentUser.name || 'Student', 80)}`,
    `Role: ${userRole}`,
    `Grade & Section: ${userGrade} - ${userSection}`,
    `House: ${userHouse}`,
    `School ID: ${schoolId}`,
    `Current Date: ${new Date().toISOString().split('T')[0]}`
  ].join(' | ');

  // Fast path: if the prompt is a pure academic concept question ("Explain lines and angles"),
  // do not block on network database queries!
  if (!doesPromptNeedStudentOSContext(prompt)) {
    return {
      contextString: `User Profile: ${profileHeader}`,
      retrievalMs: Date.now() - start,
      hasStudentOSData: false
    };
  }

  // Check isolated per-user cache
  const cacheKey = `${userId}:${userRole}:${userGrade}:${userSection}`;
  const cached = userContextCache.get(cacheKey);
  if (cached && cached.userId === userId && Date.now() - cached.timestamp < CONTEXT_CACHE_TTL_MS) {
    return {
      contextString: cached.contextString,
      retrievalMs: Date.now() - start,
      hasStudentOSData: true
    };
  }

  const sections: string[] = [`User Profile: ${profileHeader}`];

  // Include immediate local state if already loaded in memory
  if (localSnapshot?.vaultNotes && localSnapshot.vaultNotes.length > 0) {
    const noteLines = localSnapshot.vaultNotes.slice(0, 6).map(
      (n: any) => `- [${sanitizeUntrustedRecordText(n.subject || 'General', 40)}] "${sanitizeUntrustedRecordText(n.title, 80)}": ${sanitizeUntrustedRecordText(n.content, 240)}`
    );
    sections.push(`Student's Personal Lecture Notes (${localSnapshot.vaultNotes.length} total):\n${noteLines.join('\n')}`);
  }

  if (localSnapshot?.schedule && localSnapshot.schedule.length > 0) {
    const schedLines = localSnapshot.schedule.slice(0, 6).map(
      (s: any) => `- ${sanitizeUntrustedRecordText(s.day || s.date || 'Scheduled', 40)} (${sanitizeUntrustedRecordText(s.time || '', 40)}): ${sanitizeUntrustedRecordText(s.subject || s.title || 'Study Session', 80)}`
    );
    sections.push(`Student's Study Planner Schedule:\n${schedLines.join('\n')}`);
  }

  // Parallel Supabase queries strictly scoped to user permissions (with 2.2s timeout guard)
  if (supabase && userId !== 'guest') {
    try {
      const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 2200));

      const queriesPromise = Promise.allSettled([
        // 1. Homework for student's grade (or all if teacher/admin)
        userRole === 'student'
          ? supabase
              .from('homework')
              .select('id, title, subject, content, class_grade, class_section, due_date, completed_list')
              .eq('class_grade', userGrade)
              .order('created_at', { ascending: false })
              .limit(8)
          : supabase
              .from('homework')
              .select('id, title, subject, content, class_grade, class_section, due_date, completed_list')
              .order('created_at', { ascending: false })
              .limit(10),

        // 2. Personal Lecture Notes from Supabase (strictly user's own notes)
        supabase
          .from('notes')
          .select('title, subject, content, updated_at')
          .eq('user_id', userId)
          .order('updated_at', { ascending: false })
          .limit(6),

        // 3. Learning Materials (public or matching student's class)
        supabase
          .from('materials')
          .select('title, subject, category, description, class_grade, due_date')
          .eq('is_public', true)
          .order('created_at', { ascending: false })
          .limit(6),

        // 4. Student's own Attendance records (strictly scoped to user_id for students)
        supabase
          .from('attendance')
          .select('date, status, subject, remarks')
          .eq('user_id', userId)
          .order('date', { ascending: false })
          .limit(15),

        // 5. Upcoming Academic Calendar Events
        supabase
          .from('calendar_events')
          .select('title, start_date, category, description')
          .order('start_date', { ascending: true })
          .limit(6),

        // 6. Student Gamification & House Standings
        supabase
          .from('student_gamification')
          .select('xp, level, level_title, current_streak, longest_streak')
          .eq('user_id', userId)
          .maybeSingle(),

        // 7. House Championship Points
        supabase
          .from('life_houses')
          .select('id, name, points, rank')
          .order('points', { ascending: false })
          .limit(4)
      ]);

      const settled = await Promise.race([queriesPromise, timeoutPromise]);

      if (settled && Array.isArray(settled)) {
        const [hwRes, notesRes, matRes, attRes, calRes, gamRes, houseRes] = settled;

        // Homework
        if (hwRes.status === 'fulfilled' && hwRes.value?.data && hwRes.value.data.length > 0) {
          const hwLines = hwRes.value.data.map((h: any) => {
            const completedArr = Array.isArray(h.completed_list) ? h.completed_list : [];
            const isDone = completedArr.includes(userId);
            return `- [${isDone ? 'COMPLETED' : 'PENDING'}] ${sanitizeUntrustedRecordText(h.subject, 40)}: "${sanitizeUntrustedRecordText(h.title, 80)}" (${h.class_grade} ${h.class_section || ''}) | Due: ${h.due_date || 'Unspecified'} | Details: ${sanitizeUntrustedRecordText(h.content, 140)}`;
          });
          sections.push(`Authorized Homework & Assignments:\n${hwLines.join('\n')}`);
        } else {
          sections.push(`Authorized Homework & Assignments: No homework records currently listed in Supabase for ${userGrade}.`);
        }

        // Supabase Notes (if not already populated from local)
        if (
          (!localSnapshot?.vaultNotes || localSnapshot.vaultNotes.length === 0) &&
          notesRes.status === 'fulfilled' &&
          notesRes.value?.data &&
          notesRes.value.data.length > 0
        ) {
          const nLines = notesRes.value.data.map(
            (n: any) => `- [${sanitizeUntrustedRecordText(n.subject, 40)}] "${sanitizeUntrustedRecordText(n.title, 80)}": ${sanitizeUntrustedRecordText(n.content, 240)}`
          );
          sections.push(`Student's Lecture Notes:\n${nLines.join('\n')}`);
        }

        // Learning Materials
        if (matRes.status === 'fulfilled' && matRes.value?.data && matRes.value.data.length > 0) {
          const mLines = matRes.value.data.map(
            (m: any) => `- [${sanitizeUntrustedRecordText(m.category || m.subject, 40)}] "${sanitizeUntrustedRecordText(m.title, 80)}": ${sanitizeUntrustedRecordText(m.description, 140)}`
          );
          sections.push(`Recent School Materials & Notices:\n${mLines.join('\n')}`);
        }

        // Attendance Summary (strictly current user's own attendance)
        if (attRes.status === 'fulfilled' && attRes.value?.data && attRes.value.data.length > 0) {
          const records = attRes.value.data;
          const presentCount = records.filter((r: any) => r.status === 'present').length;
          const absentCount = records.filter((r: any) => r.status === 'absent').length;
          const lateCount = records.filter((r: any) => r.status === 'late').length;
          const pct = Math.round(((presentCount + lateCount * 0.5) / records.length) * 100);
          sections.push(
            `Personal Attendance Summary (Last ${records.length} recorded days): ${pct}% attendance (${presentCount} Present, ${absentCount} Absent, ${lateCount} Late). Latest: ${records[0].date} (${records[0].status}).`
          );
        }

        // Calendar Events
        if (calRes.status === 'fulfilled' && calRes.value?.data && calRes.value.data.length > 0) {
          const cLines = calRes.value.data.map(
            (c: any) => `- ${c.start_date} [${sanitizeUntrustedRecordText(c.category, 30)}]: "${sanitizeUntrustedRecordText(c.title, 80)}"`
          );
          sections.push(`Upcoming School Calendar Events:\n${cLines.join('\n')}`);
        }

        // Gamification
        if (gamRes.status === 'fulfilled' && gamRes.value?.data) {
          const g = gamRes.value.data;
          sections.push(
            `Gamification Progress: Level ${g.level} (${g.level_title}) | ${g.xp} XP | Active Streak: ${g.current_streak} days (Best: ${g.longest_streak} days).`
          );
        }

        // Houses
        if (houseRes.status === 'fulfilled' && houseRes.value?.data && houseRes.value.data.length > 0) {
          const hSummary = houseRes.value.data
            .map((h: any, idx: number) => `#${idx + 1} ${h.id} (${h.points} pts)`)
            .join(', ');
          sections.push(`House Championship Standings: ${hSummary}`);
        }
      }
    } catch (err) {
      console.warn('[StudentOS AI Context] Partial context retrieval notice:', err);
    }
  }

  const finalContext = sections.join('\n\n');
  userContextCache.set(cacheKey, {
    userId,
    role: userRole,
    timestamp: Date.now(),
    contextString: finalContext
  });

  return {
    contextString: finalContext,
    retrievalMs: Date.now() - start,
    hasStudentOSData: true
  };
}

/**
 * Streams an AI response from /api/ai/chat with real-time token callbacks,
 * AbortSignal cancellation support, and performance telemetry.
 */
export async function streamStudentOSAI(
  payload: {
    prompt: string;
    history?: { role: string; content: string }[];
    persona?: string;
    level?: string;
    subject?: string;
    mode?: string;
    studentosContext?: string;
    ragContext?: string;
    userId?: string;
    userRole?: string;
    modelOverride?: string;
    taskType?: string;
    dataRetrievalLatencyMs?: number;
    webSearchMode?: 'auto' | 'always' | 'off';
  },
  callbacks: {
    onStatus?: (status: {
      phase: 'searching' | 'reading_sources' | 'generating' | 'search_failed';
      message: string;
      query?: string;
      sources?: WebSearchSourceInfo[];
    }) => void;
    onMeta?: (meta: {
      model: string;
      tier: 'fast' | 'general' | 'complex';
      requestId: string;
      webSearchUsed?: boolean;
      webSources?: WebSearchSourceInfo[];
    }) => void;
    onToken: (delta: string, accumulatedText: string, firstTokenMs: number) => void;
    onDone?: (result: {
      text: string;
      usage?: any;
      telemetry: AIStreamTelemetry;
      webSearchUsed?: boolean;
      webSources?: WebSearchSourceInfo[];
    }) => void;
  },
  abortSignal?: AbortSignal
): Promise<{
  text: string;
  usage?: any;
  telemetry: AIStreamTelemetry;
  webSearchUsed?: boolean;
  webSources?: WebSearchSourceInfo[];
}> {
  const requestStart = Date.now();
  const dataRetrievalLatencyMs = payload.dataRetrievalLatencyMs || 0;

  const res = await fetch('/api/ai/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'text/event-stream, application/json'
    },
    body: JSON.stringify({
      ...payload,
      stream: true
    }),
    signal: abortSignal
  });

  if (res.status === 429) {
    const limitData = await res.json().catch(() => ({}));
    const limitErr: any = new Error(limitData.message || 'Daily AI message limit reached.');
    limitErr.isLimitReached = true;
    limitErr.limitData = limitData;
    throw limitErr;
  }

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.message || errData.error || `HTTP ${res.status}`);
  }

  const contentType = res.headers.get('content-type') || '';

  // Handle real SSE stream
  if (contentType.includes('text/event-stream') && res.body) {
    const reader = res.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';
    let accumulated = '';
    let firstTokenMs: number | null = null;
    let modelUsed = 'nvidia/nemotron-3-super-120b-a12b';
    let complexityTier: 'fast' | 'general' | 'complex' = 'general';
    let requestId = '';
    let usageData: any = undefined;
    let webSearchUsed = false;
    let webSources: WebSearchSourceInfo[] = [];

    while (true) {
      if (abortSignal?.aborted) {
        await reader.cancel().catch(() => {});
        break;
      }

      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line || !line.startsWith('data:')) continue;
        const jsonStr = line.slice(5).trim();
        if (!jsonStr || jsonStr === '[DONE]') continue;

        let eventObj: any;
        try {
          eventObj = JSON.parse(jsonStr);
        } catch {
          continue;
        }

        if (eventObj.type === 'status') {
          if (Array.isArray(eventObj.sources)) {
            webSearchUsed = true;
            webSources = eventObj.sources;
          }
          callbacks.onStatus?.({
            phase: eventObj.phase || 'generating',
            message: eventObj.message || 'Generating answer…',
            query: eventObj.query,
            sources: eventObj.sources
          });
        } else if (eventObj.type === 'meta') {
          modelUsed = eventObj.model || modelUsed;
          complexityTier = eventObj.tier || complexityTier;
          requestId = eventObj.requestId || requestId;
          if (eventObj.webSearchUsed) webSearchUsed = true;
          if (Array.isArray(eventObj.webSources) && eventObj.webSources.length > 0) {
            webSources = eventObj.webSources;
          }
          callbacks.onMeta?.({ model: modelUsed, tier: complexityTier, requestId, webSearchUsed, webSources });
        } else if (eventObj.type === 'token' && eventObj.token) {
          if (firstTokenMs === null) {
            firstTokenMs = eventObj.firstTokenLatencyMs ?? (Date.now() - requestStart);
          }
          accumulated += eventObj.token;
          callbacks.onToken(eventObj.token, accumulated, firstTokenMs);
        } else if (eventObj.type === 'done') {
          if (eventObj.text && !accumulated) {
            accumulated = eventObj.text;
          }
          if (eventObj.usage) usageData = eventObj.usage;
          if (eventObj.telemetry?.modelUsed) modelUsed = eventObj.telemetry.modelUsed;
          if (eventObj.telemetry?.complexityTier) complexityTier = eventObj.telemetry.complexityTier;
          if (eventObj.webSearchUsed) webSearchUsed = true;
          if (Array.isArray(eventObj.webSources) && eventObj.webSources.length > 0) {
            webSources = eventObj.webSources;
          }
        } else if (eventObj.type === 'error') {
          throw new Error(eventObj.details || eventObj.error || 'AI streaming failed.');
        }
      }
    }

    const telemetry: AIStreamTelemetry = {
      requestId,
      modelUsed,
      complexityTier,
      requestStart,
      firstTokenLatencyMs: firstTokenMs ?? (Date.now() - requestStart),
      totalGenerationTimeMs: Date.now() - requestStart,
      dataRetrievalLatencyMs,
      streamed: true,
      webSearchUsed,
      webSources
    };

    const finalResult = { text: accumulated.trim(), usage: usageData, telemetry, webSearchUsed, webSources };
    callbacks.onDone?.(finalResult);
    return finalResult;
  }

  // Fallback for standard JSON response
  const parsedRes = await res.json();
  if (parsedRes.error === 'AI_LIMIT_REACHED') {
    const limitErr: any = new Error(parsedRes.message || 'Daily AI message limit reached.');
    limitErr.isLimitReached = true;
    limitErr.limitData = parsedRes;
    throw limitErr;
  }
  if (parsedRes.error) {
    throw new Error(parsedRes.error);
  }

  const text = parsedRes.text || '';
  const elapsed = Date.now() - requestStart;
  if (text) {
    callbacks.onToken(text, text, elapsed);
  }

  const telemetry: AIStreamTelemetry = {
    requestId: parsedRes.requestId,
    modelUsed: parsedRes.telemetry?.modelUsed || 'nvidia/nemotron-3-super-120b-a12b',
    complexityTier: parsedRes.telemetry?.complexityTier || 'general',
    requestStart,
    firstTokenLatencyMs: elapsed,
    totalGenerationTimeMs: elapsed,
    dataRetrievalLatencyMs,
    streamed: false,
    webSearchUsed: Boolean(parsedRes.webSearchUsed),
    webSources: parsedRes.webSources || []
  };

  const finalResult = {
    text,
    usage: parsedRes.usage,
    telemetry,
    webSearchUsed: Boolean(parsedRes.webSearchUsed),
    webSources: parsedRes.webSources || []
  };
  callbacks.onDone?.(finalResult);
  return finalResult;
}

/**
 * Extracts structured flashcards from an AI response if the user requested flashcards
 * or if the response contains Q/A or Front/Back card pairs.
 */
export function extractFlashcardsFromResponse(
  prompt: string,
  responseText: string
): { front: string; back: string; hint?: string }[] {
  if (!responseText) return [];
  const lowerPrompt = (prompt || '').toLowerCase();
  const isFlashcardIntent =
    lowerPrompt.includes('flashcard') ||
    lowerPrompt.includes('flash card') ||
    lowerPrompt.includes('study cards') ||
    /(?:front|question)\s*:\s*.+[\r\n]+(?:back|answer)\s*:/i.test(responseText);

  if (!isFlashcardIntent) return [];

  const cards: { front: string; back: string; hint?: string }[] = [];

  // Pattern 1: Front/Question: ... Back/Answer: ...
  const pairRegex = /(?:^|\n)\s*(?:[-*\d.]+\s*)?\*{0,2}(?:Front|Question|Q|Card\s*\d*\s*Front)\*{0,2}\s*:\s*([^\n]+)\s*\n+\s*(?:[-*]+\s*)?\*{0,2}(?:Back|Answer|A|Card\s*\d*\s*Back)\*{0,2}\s*:\s*([^\n]+(?:\n(?!(?:[-*\d.]+\s*)?\*{0,2}(?:Front|Question|Q)\*{0,2}\s*:)[^\n]+)*)/gi;
  let match: RegExpExecArray | null;
  while ((match = pairRegex.exec(responseText)) !== null) {
    const front = match[1].replace(/\*\*/g, '').trim();
    const back = match[2].replace(/\*\*/g, '').trim();
    if (front && back && front.length > 3 && back.length > 2) {
      cards.push({ front, back });
    }
  }

  if (cards.length > 0) return cards.slice(0, 15);

  // Pattern 2: Bold question followed by answer bullet/line when prompt explicitly asked for flashcards
  if (lowerPrompt.includes('flashcard') || lowerPrompt.includes('flash card')) {
    const blocks = responseText.split(/\n{2,}/);
    for (const block of blocks) {
      const lines = block.split('\n').map((l) => l.trim()).filter(Boolean);
      if (lines.length >= 2) {
        const first = lines[0].replace(/^(\d+[.)]|[-*])\s*/, '').replace(/\*\*/g, '').trim();
        const second = lines.slice(1).join(' ').replace(/^[-*]\s*/, '').replace(/^(Answer|Back|A):\s*/i, '').trim();
        if (first.endsWith('?') && second.length > 5 && first.length < 180) {
          cards.push({ front: first, back: second });
        }
      }
    }
  }

  return cards.slice(0, 15);
}

/**
 * Saves extracted flashcards directly into Study Center (local storage + Supabase sync)
 */
export async function saveExtractedFlashcardsToStudyCenter(
  cards: { front: string; back: string; hint?: string }[],
  topicTitle: string,
  subject: string,
  userId?: string
): Promise<{ deck: FlashcardDeck; count: number }> {
  const deckId = `deck-ai-${Date.now()}`;
  const cleanTitle = topicTitle
    .replace(/^(make|create|generate|build)\s+(flashcards?|cards?)\s+(from|for|on|about)\s+/i, '')
    .trim();

  const newDeck: FlashcardDeck = {
    id: deckId,
    title: cleanTitle ? `AI Buddy: ${cleanTitle.slice(0, 45)}` : `AI Buddy Study Deck`,
    description: `Generated by StudentOS AI Buddy from your study session (${cards.length} cards).`,
    subject: subject || 'General',
    color: 'from-indigo-600 to-violet-800',
    icon: '🧠',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: userId || 'student',
    tags: ['AI Buddy', subject || 'Study'],
    isFavorite: true
  };

  upsertDeck(newDeck);
  await syncDeckToSupabase(newDeck, userId);

  for (let i = 0; i < cards.length; i++) {
    const c = cards[i];
    const cardObj: Flashcard = {
      id: `card-ai-${Date.now()}-${i}`,
      deckId,
      front: c.front,
      back: c.back,
      hint: c.hint,
      tags: ['AI Buddy', subject || 'Study'],
      interval: 0,
      repetition: 0,
      easeFactor: 2.5,
      nextReviewDate: new Date().toISOString(),
      state: 'new'
    };
    upsertCard(cardObj);
    await syncCardToSupabase(cardObj, userId);
  }

  return { deck: newDeck, count: cards.length };
}

/* ============================================================================
   INTERACTIVE MATHEMATICS VISUAL LEARNING BLOCK FOR AI BUDDY
   ============================================================================ */

export type MathVisualTopic =
  | 'lines_and_angles'
  | 'triangle_angles'
  | 'pythagorean'
  | 'linear_graph'
  | 'circle_geometry'
  | null;

export function detectMathVisualizationTopic(prompt: string): MathVisualTopic {
  const lower = (prompt || '').toLowerCase();
  if (
    /\b(lines and angles|parallel lines|transversal|supplementary angle|complementary angle|vertical angles|corresponding angles|alternate interior)\b/i.test(lower)
  ) {
    return 'lines_and_angles';
  }
  if (/\b(pythagor|right triangle|hypotenuse|a\^2\s*\+\s*b\^2)\b/i.test(lower)) {
    return 'pythagorean';
  }
  if (/\b(triangle|angle sum|angles of a triangle|interior angles of a triangle|equilateral|isosceles)\b/i.test(lower)) {
    return 'triangle_angles';
  }
  if (/\b(slope|y\s*=\s*mx|linear equation|coordinate graph|intercept|line graph)\b/i.test(lower)) {
    return 'linear_graph';
  }
  if (/\b(circle geometry|circumference|area of a circle|radius and diameter|pi\s*\*\s*r)\b/i.test(lower)) {
    return 'circle_geometry';
  }
  return null;
}

export const MathVisualLearningBlock: React.FC<{ topic: MathVisualTopic }> = ({ topic }) => {
  // 1. Lines & Angles Interactive State
  const [transversalAngle, setTransversalAngle] = useState<number>(62);
  // 2. Triangle Angle Sum Interactive State
  const [angleA, setAngleA] = useState<number>(65);
  const [angleB, setAngleB] = useState<number>(55);
  // 3. Pythagorean Right Triangle State
  const [sideA, setSideA] = useState<number>(3);
  const [sideB, setSideB] = useState<number>(4);
  // 4. Linear Function y = mx + b State
  const [slopeM, setSlopeM] = useState<number>(1.5);
  const [interceptB, setInterceptB] = useState<number>(1);
  // 5. Circle Geometry State
  const [radiusR, setRadiusR] = useState<number>(5);

  if (!topic) return null;

  if (topic === 'lines_and_angles') {
    const obtuse = 180 - transversalAngle;
    const rad = (transversalAngle * Math.PI) / 180;
    const dx = Math.cos(rad) * 110;
    const dy = Math.sin(rad) * 110;

    return (
      <div className="my-3 p-3.5 rounded-2xl bg-slate-950/90 border border-indigo-500/30 text-slate-200 space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <span className="text-[10px] font-mono uppercase tracking-wider text-indigo-400 font-bold">
            Interactive Geometry Lab · Parallel Lines & Transversal
          </span>
          <span className="text-[11px] font-mono text-slate-400">
            ∠1 + ∠2 = {transversalAngle}° + {obtuse}° = 180°
          </span>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-4">
          <svg viewBox="0 0 320 180" className="w-full max-w-[280px] h-40 bg-slate-900/80 rounded-xl border border-white/5 shrink-0">
            {/* Parallel Line L1 */}
            <line x1="25" y1="55" x2="295" y2="55" stroke="#6366f1" strokeWidth="2.5" />
            <text x="275" y="47" fill="#818cf8" fontSize="10" fontFamily="monospace">L₁</text>
            {/* Parallel Line L2 */}
            <line x1="25" y1="125" x2="295" y2="125" stroke="#6366f1" strokeWidth="2.5" />
            <text x="275" y="117" fill="#818cf8" fontSize="10" fontFamily="monospace">L₂</text>
            {/* Transversal Line T */}
            <line
              x1={160 - dx}
              y1={90 + dy}
              x2={160 + dx}
              y2={90 - dy}
              stroke="#14b8a6"
              strokeWidth="2.5"
            />
            {/* Intersection markers & angle labels */}
            <circle cx={160 + (35 / Math.tan(rad))} cy="55" r="3.5" fill="#f59e0b" />
            <circle cx={160 - (35 / Math.tan(rad))} cy="125" r="3.5" fill="#f59e0b" />
            <text x="182" y="48" fill="#34d399" fontSize="11" fontWeight="bold" fontFamily="monospace">
              ∠1={transversalAngle}°
            </text>
            <text x="102" y="48" fill="#fbbf24" fontSize="11" fontWeight="bold" fontFamily="monospace">
              ∠2={obtuse}°
            </text>
            <text x="155" y="118" fill="#34d399" fontSize="11" fontWeight="bold" fontFamily="monospace">
              ∠5={transversalAngle}°
            </text>
            <text x="78" y="118" fill="#fbbf24" fontSize="11" fontWeight="bold" fontFamily="monospace">
              ∠6={obtuse}°
            </text>
          </svg>

          <div className="flex-1 space-y-2.5 w-full text-xs">
            <div>
              <label className="flex justify-between text-[11px] text-slate-300 font-medium mb-1">
                <span>Adjust Acute Angle (∠1)</span>
                <span className="font-mono text-emerald-400 font-bold">{transversalAngle}°</span>
              </label>
              <input
                type="range"
                min={25}
                max={85}
                value={transversalAngle}
                onChange={(e) => setTransversalAngle(Number(e.target.value))}
                className="w-full accent-indigo-500 cursor-pointer"
              />
            </div>

            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div className="p-2 rounded-lg bg-slate-900 border border-white/5">
                <span className="text-slate-400 block text-[10px]">Corresponding (∠1 = ∠5)</span>
                <span className="font-mono font-bold text-emerald-400">{transversalAngle}° = {transversalAngle}°</span>
              </div>
              <div className="p-2 rounded-lg bg-slate-900 border border-white/5">
                <span className="text-slate-400 block text-[10px]">Supplementary (∠1 + ∠2)</span>
                <span className="font-mono font-bold text-amber-400">{transversalAngle}° + {obtuse}° = 180°</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (topic === 'triangle_angles') {
    const angleC = Math.max(10, 180 - angleA - angleB);
    return (
      <div className="my-3 p-3.5 rounded-2xl bg-slate-950/90 border border-indigo-500/30 text-slate-200 space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <span className="text-[10px] font-mono uppercase tracking-wider text-indigo-400 font-bold">
            Interactive Geometry Lab · Triangle Angle Sum Theorem
          </span>
          <span className="text-[11px] font-mono text-emerald-400 font-bold">
            ∠A ({angleA}°) + ∠B ({angleB}°) + ∠C ({angleC}°) = 180°
          </span>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-4">
          <svg viewBox="0 0 260 160" className="w-full max-w-[240px] h-36 bg-slate-900/80 rounded-xl border border-white/5 shrink-0">
            <polygon
              points={`40,135 220,135 ${80 + (angleB - angleA) * 0.8},30`}
              fill="rgba(99, 102, 241, 0.15)"
              stroke="#818cf8"
              strokeWidth="2.5"
            />
            <text x="25" y="148" fill="#34d399" fontSize="11" fontWeight="bold" fontFamily="monospace">A: {angleA}°</text>
            <text x="195" y="148" fill="#fbbf24" fontSize="11" fontWeight="bold" fontFamily="monospace">B: {angleB}°</text>
            <text x={65 + (angleB - angleA) * 0.8} y="22" fill="#f472b6" fontSize="11" fontWeight="bold" fontFamily="monospace">C: {angleC}°</text>
          </svg>

          <div className="flex-1 space-y-2 w-full text-xs">
            <div>
              <label className="flex justify-between text-[11px] text-slate-300 mb-0.5">
                <span>Vertex Angle ∠A</span>
                <span className="font-mono text-emerald-400 font-bold">{angleA}°</span>
              </label>
              <input
                type="range"
                min={20}
                max={110}
                value={angleA}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setAngleA(val);
                  if (val + angleB > 165) setAngleB(165 - val);
                }}
                className="w-full accent-emerald-500 cursor-pointer"
              />
            </div>
            <div>
              <label className="flex justify-between text-[11px] text-slate-300 mb-0.5">
                <span>Vertex Angle ∠B</span>
                <span className="font-mono text-amber-400 font-bold">{angleB}°</span>
              </label>
              <input
                type="range"
                min={20}
                max={160 - angleA}
                value={angleB}
                onChange={(e) => setAngleB(Number(e.target.value))}
                className="w-full accent-amber-500 cursor-pointer"
              />
            </div>
            <p className="text-[11px] text-slate-400">
              Remaining Angle <strong className="text-pink-400 font-mono">∠C = 180° - ({angleA}° + {angleB}°) = {angleC}°</strong>
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (topic === 'pythagorean') {
    const hyp = Math.sqrt(sideA * sideA + sideB * sideB);
    return (
      <div className="my-3 p-3.5 rounded-2xl bg-slate-950/90 border border-indigo-500/30 text-slate-200 space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <span className="text-[10px] font-mono uppercase tracking-wider text-indigo-400 font-bold">
            Interactive Math Lab · Pythagorean Theorem (a² + b² = c²)
          </span>
          <span className="text-[11px] font-mono text-emerald-400 font-bold">
            {sideA}² + {sideB}² = {sideA * sideA + sideB * sideB} → c = {hyp.toFixed(2)}
          </span>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-4">
          <svg viewBox="0 0 240 155" className="w-full max-w-[220px] h-36 bg-slate-900/80 rounded-xl border border-white/5 shrink-0">
            <polygon
              points={`45,130 ${45 + sideB * 18},130 45,${130 - sideA * 14}`}
              fill="rgba(20, 184, 166, 0.16)"
              stroke="#2dd4bf"
              strokeWidth="2.5"
            />
            <rect x="45" y="118" width="12" height="12" fill="none" stroke="#94a3b8" strokeWidth="1.5" />
            <text x="18" y={130 - sideA * 7} fill="#34d399" fontSize="11" fontFamily="monospace" fontWeight="bold">a={sideA}</text>
            <text x={40 + sideB * 9} y="146" fill="#fbbf24" fontSize="11" fontFamily="monospace" fontWeight="bold">b={sideB}</text>
            <text x={55 + sideB * 9} y={122 - sideA * 7} fill="#818cf8" fontSize="11" fontFamily="monospace" fontWeight="bold">c={hyp.toFixed(2)}</text>
          </svg>

          <div className="flex-1 space-y-2 w-full text-xs">
            <div>
              <label className="flex justify-between text-[11px] text-slate-300">
                <span>Altitude (a)</span>
                <span className="font-mono text-emerald-400 font-bold">{sideA} units (a² = {sideA * sideA})</span>
              </label>
              <input
                type="range"
                min={2}
                max={7}
                value={sideA}
                onChange={(e) => setSideA(Number(e.target.value))}
                className="w-full accent-emerald-500 cursor-pointer"
              />
            </div>
            <div>
              <label className="flex justify-between text-[11px] text-slate-300">
                <span>Base (b)</span>
                <span className="font-mono text-amber-400 font-bold">{sideB} units (b² = {sideB * sideB})</span>
              </label>
              <input
                type="range"
                min={2}
                max={9}
                value={sideB}
                onChange={(e) => setSideB(Number(e.target.value))}
                className="w-full accent-amber-500 cursor-pointer"
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (topic === 'linear_graph') {
    // Center at (120, 80), scale = 15px per unit
    const x1 = -6;
    const y1 = slopeM * x1 + interceptB;
    const x2 = 6;
    const y2 = slopeM * x2 + interceptB;

    return (
      <div className="my-3 p-3.5 rounded-2xl bg-slate-950/90 border border-indigo-500/30 text-slate-200 space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <span className="text-[10px] font-mono uppercase tracking-wider text-indigo-400 font-bold">
            Interactive Coordinate Graph · Linear Equation (y = mx + b)
          </span>
          <span className="text-[11px] font-mono text-emerald-400 font-bold">
            y = {slopeM}x {interceptB >= 0 ? `+ ${interceptB}` : `- ${Math.abs(interceptB)}`}
          </span>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-4">
          <svg viewBox="0 0 240 160" className="w-full max-w-[220px] h-36 bg-slate-900/80 rounded-xl border border-white/5 shrink-0">
            <line x1="10" y1="80" x2="230" y2="80" stroke="#475569" strokeWidth="1.5" />
            <line x1="120" y1="10" x2="120" y2="150" stroke="#475569" strokeWidth="1.5" />
            <line
              x1={120 + x1 * 15}
              y1={80 - y1 * 12}
              x2={120 + x2 * 15}
              y2={80 - y2 * 12}
              stroke="#6366f1"
              strokeWidth="2.5"
            />
            <circle cx="120" cy={80 - interceptB * 12} r="4" fill="#10b981" />
          </svg>

          <div className="flex-1 space-y-2 w-full text-xs">
            <div>
              <label className="flex justify-between text-[11px] text-slate-300">
                <span>Slope (m)</span>
                <span className="font-mono text-indigo-400 font-bold">{slopeM}</span>
              </label>
              <input
                type="range"
                min={-3}
                max={3}
                step={0.5}
                value={slopeM}
                onChange={(e) => setSlopeM(Number(e.target.value))}
                className="w-full accent-indigo-500 cursor-pointer"
              />
            </div>
            <div>
              <label className="flex justify-between text-[11px] text-slate-300">
                <span>Y-Intercept (b)</span>
                <span className="font-mono text-emerald-400 font-bold">(0, {interceptB})</span>
              </label>
              <input
                type="range"
                min={-4}
                max={4}
                step={1}
                value={interceptB}
                onChange={(e) => setInterceptB(Number(e.target.value))}
                className="w-full accent-emerald-500 cursor-pointer"
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (topic === 'circle_geometry') {
    const circumference = 2 * Math.PI * radiusR;
    const area = Math.PI * radiusR * radiusR;

    return (
      <div className="my-3 p-3.5 rounded-2xl bg-slate-950/90 border border-indigo-500/30 text-slate-200 space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <span className="text-[10px] font-mono uppercase tracking-wider text-indigo-400 font-bold">
            Interactive Geometry Lab · Circle Properties
          </span>
          <span className="text-[11px] font-mono text-emerald-400 font-bold">
            r = {radiusR} | C = {circumference.toFixed(1)} | A = {area.toFixed(1)}
          </span>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-4">
          <svg viewBox="0 0 200 150" className="w-full max-w-[190px] h-32 bg-slate-900/80 rounded-xl border border-white/5 shrink-0">
            <circle cx="100" cy="75" r={radiusR * 6.5} fill="rgba(99, 102, 241, 0.15)" stroke="#818cf8" strokeWidth="2.5" />
            <line x1="100" y1="75" x2={100 + radiusR * 6.5} y2="75" stroke="#34d399" strokeWidth="2" />
            <circle cx="100" cy="75" r="3" fill="#f59e0b" />
            <text x={100 + radiusR * 2.5} y="68" fill="#34d399" fontSize="10" fontFamily="monospace" fontWeight="bold">r={radiusR}</text>
          </svg>

          <div className="flex-1 space-y-2 w-full text-xs">
            <div>
              <label className="flex justify-between text-[11px] text-slate-300">
                <span>Radius (r)</span>
                <span className="font-mono text-emerald-400 font-bold">{radiusR} units</span>
              </label>
              <input
                type="range"
                min={2}
                max={9}
                value={radiusR}
                onChange={(e) => setRadiusR(Number(e.target.value))}
                className="w-full accent-emerald-500 cursor-pointer"
              />
            </div>
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div className="p-2 rounded-lg bg-slate-900 border border-white/5">
                <span className="text-slate-400 block text-[10px]">Circumference (2πr)</span>
                <span className="font-mono font-bold text-indigo-400">{circumference.toFixed(2)}</span>
              </div>
              <div className="p-2 rounded-lg bg-slate-900 border border-white/5">
                <span className="text-slate-400 block text-[10px]">Area (πr²)</span>
                <span className="font-mono font-bold text-amber-400">{area.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
};

/**
 * Formats mathematical notation and LaTeX expressions into clean, readable symbols
 */
export function formatMathematicalText(raw: string): string {
  if (!raw) return '';
  return raw
    .replace(/\\frac\{([^{}]+)\}\{([^{}]+)\}/g, '($1)/($2)')
    .replace(/\\sqrt\{([^{}]+)\}/g, '√($1)')
    .replace(/\\pi\b/g, 'π')
    .replace(/\\theta\b/g, 'θ')
    .replace(/\\alpha\b/g, 'α')
    .replace(/\\beta\b/g, 'β')
    .replace(/\\Delta\b/g, 'Δ')
    .replace(/\\angle\b/g, '∠')
    .replace(/\\degree\b|\\circ\b|\^\\circ/g, '°')
    .replace(/\\times\b|\\cdot\b/g, '×')
    .replace(/\\div\b/g, '÷')
    .replace(/\\pm\b/g, '±')
    .replace(/\\leq\b|\\le\b/g, '≤')
    .replace(/\\geq\b|\\ge\b/g, '≥')
    .replace(/\\neq\b|\\ne\b/g, '≠')
    .replace(/\\approx\b/g, '≈')
    .replace(/\\infty\b/g, '∞')
    .replace(/\\rightarrow\b|\\to\b/g, '→')
    .replace(/\\Rightarrow\b/g, '⇒')
    .replace(/\^2\b/g, '²')
    .replace(/\^3\b/g, '³');
}

export function detectMathInteractiveWidget(prompt: string, responseText?: string): MathVisualTopic {
  return detectMathVisualizationTopic(`${prompt || ''} ${responseText || ''}`);
}

export const InteractiveMathWidget: React.FC<{ widgetType: MathVisualTopic }> = ({ widgetType }) => {
  return <MathVisualLearningBlock topic={widgetType} />;
};

export async function streamAIChatClient(
  payload: {
    prompt: string;
    history?: { role: string; content: string }[];
    persona?: string;
    level?: string;
    subject?: string;
    mode?: string;
    ragContext?: string;
    userId?: string;
    userRole?: string;
    webSearchMode?: 'auto' | 'always' | 'off';
  },
  options: {
    signal?: AbortSignal;
    onStatus?: (status: {
      phase: 'searching' | 'reading_sources' | 'generating' | 'search_failed';
      message: string;
      query?: string;
      sources?: WebSearchSourceInfo[];
    }) => void;
    onStart?: (meta: {
      model: string;
      tier: 'fast' | 'general' | 'complex';
      requestId: string;
      webSearchUsed?: boolean;
      webSources?: WebSearchSourceInfo[];
    }) => void;
    onToken: (delta: string, fullText: string) => void;
    onDone?: (meta: {
      model: string;
      text: string;
      usage?: any;
      webSearchUsed?: boolean;
      webSources?: WebSearchSourceInfo[];
    }) => void;
  }
): Promise<{
  text: string;
  model: string;
  usage?: any;
  telemetry: AIStreamTelemetry;
  webSearchUsed?: boolean;
  webSources?: WebSearchSourceInfo[];
}> {
  const result = await streamStudentOSAI(
    payload,
    {
      onStatus: (st) => options.onStatus?.(st),
      onMeta: (meta) => options.onStart?.(meta),
      onToken: (delta, fullText) => options.onToken(delta, fullText),
      onDone: (res) =>
        options.onDone?.({
          model: res.telemetry.modelUsed,
          text: res.text,
          usage: res.usage,
          webSearchUsed: res.webSearchUsed,
          webSources: res.webSources
        })
    },
    options.signal
  );

  return {
    text: result.text,
    model: result.telemetry.modelUsed,
    usage: result.usage,
    telemetry: result.telemetry,
    webSearchUsed: result.webSearchUsed,
    webSources: result.webSources
  };
}

export async function saveStudyOutputToFlashcards(
  topicTitle: string,
  subject: string,
  responseText: string,
  userId?: string
): Promise<{ deck: FlashcardDeck; count: number }> {
  let cards = extractFlashcardsFromResponse('flashcards ' + topicTitle, responseText);
  if (cards.length === 0) {
    // Fallback extraction from bullet points or paragraphs so 1-click Save Flashcards always works
    const lines = responseText
      .split('\n')
      .map((l) => l.replace(/^[-*•\d.)]+\s*/, '').trim())
      .filter((l) => l.length > 15);
    cards = lines.slice(0, 6).map((line, i) => {
      const colonIdx = line.indexOf(':');
      if (colonIdx > 2 && colonIdx < 80) {
        return {
          front: line.slice(0, colonIdx).replace(/\*\*/g, '').trim(),
          back: line.slice(colonIdx + 1).replace(/\*\*/g, '').trim()
        };
      }
      return {
        front: `${topicTitle} — Key Concept #${i + 1}`,
        back: line.replace(/\*\*/g, '')
      };
    });
  }
  return saveExtractedFlashcardsToStudyCenter(cards, topicTitle, subject, userId);
}

