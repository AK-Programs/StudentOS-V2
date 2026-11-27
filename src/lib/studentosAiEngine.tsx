import React, { useState } from 'react';
import { supabase } from './supabase';
import { extractApiErrorMessage, getServerAuthHeaders } from './clientSession';
import { persistDeckToSupabase, persistCardsBatchToSupabase } from './flashcardStorage';
import { Flashcard, FlashcardDeck } from '../types';
import {
  buildRoleAwareByteContext,
  clearByteContextCache,
  doesPromptNeedRoleContext,
  BuildByteContextOptions
} from './byteIntelligence';

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
  complexityTier?: 'short' | 'fast' | 'general' | 'complex' | 'tool';
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

export function clearStudentOSContextCache(): void {
  userContextCache.clear();
  clearByteContextCache();
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

export function doesPromptNeedStudentOSContext(prompt: string, role?: string): boolean {
  return doesPromptNeedRoleContext(prompt, role);
}

/**
 * Retrieves authorized StudentOS / Veylentra context strictly scoped to the authenticated user's identity,
 * role, grade, section, and verified parent links. Uses parallel queries and isolated per-user caching.
 */
export async function buildAuthorizedStudentOSContext(
  prompt: string,
  currentUser: any,
  effectiveRole: string,
  localSnapshotOrOptions?: StudentOSLocalContextSnapshot | BuildByteContextOptions
): Promise<{
  contextString: string;
  retrievalMs: number;
  hasStudentOSData: boolean;
  normalizedRole?: string;
  scopeSummary?: string;
  intentCategory?: string;
  unlinkedParent?: boolean;
}> {
  const opts: BuildByteContextOptions =
    localSnapshotOrOptions &&
    ('activeTab' in localSnapshotOrOptions ||
      'linkedStudents' in localSnapshotOrOptions ||
      'localSnapshot' in localSnapshotOrOptions ||
      'supabaseClient' in localSnapshotOrOptions)
      ? (localSnapshotOrOptions as BuildByteContextOptions)
      : { localSnapshot: localSnapshotOrOptions as StudentOSLocalContextSnapshot | undefined };

  const res = await buildRoleAwareByteContext(prompt, currentUser, effectiveRole, opts);
  return {
    contextString: res.contextString,
    retrievalMs: res.retrievalMs,
    hasStudentOSData: res.hasVeylentraData,
    normalizedRole: res.normalizedRole,
    scopeSummary: res.scopeSummary,
    intentCategory: res.intentCategory,
    unlinkedParent: res.unlinkedParent
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
    conversationId?: string;
    threadId?: string;
    reasoningMode?: boolean;
    activeTab?: string;
    intentType?: string;
    modelOverride?: string;
    taskType?: string;
    dataRetrievalLatencyMs?: number;
    webSearchMode?: 'auto' | 'always' | 'force' | 'off';
    images?: { name?: string; mimeType: string; data: string }[];
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
      tier: 'short' | 'fast' | 'general' | 'complex' | 'tool';
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
      finishReason?: string;
      truncated?: boolean;
    }) => void;
  },
  abortSignal?: AbortSignal
): Promise<{
  text: string;
  usage?: any;
  telemetry: AIStreamTelemetry;
  webSearchUsed?: boolean;
  webSources?: WebSearchSourceInfo[];
  finishReason?: string;
  truncated?: boolean;
}> {
  const requestStart = Date.now();
  const dataRetrievalLatencyMs = payload.dataRetrievalLatencyMs || 0;

  const reqHeaders = await getServerAuthHeaders({ acceptSse: true });

  const res = await fetch('/api/ai/chat', {
    method: 'POST',
    headers: reqHeaders,
    body: JSON.stringify({
      ...payload,
      stream: true
    }),
    signal: abortSignal
  });

  if (res.redirected) {
    throw new Error(`API request was redirected (HTTP ${res.status}). Ensure backend /api/ai/chat route is reachable on the current host.`);
  }

  if (res.status === 429) {
    const limitData = await res.json().catch(() => ({}));
    const limitErr: any = new Error(extractApiErrorMessage(limitData, 'Daily AI message limit reached.'));
    limitErr.isLimitReached = true;
    limitErr.limitData = limitData;
    throw limitErr;
  }

  if (!res.ok) {
    let errMessage = '';
    try {
      const errData = await res.json();
      errMessage = extractApiErrorMessage(errData, `HTTP error ${res.status}`);
    } catch (_) {
      const textErr = await res.text().catch(() => '');
      errMessage = textErr.slice(0, 200) || `HTTP error ${res.status}`;
    }
    throw new Error(errMessage || `HTTP ${res.status}`);
  }

  const contentType = res.headers.get('content-type') || '';

  // Handle real SSE stream
  if (contentType.includes('text/event-stream') && res.body) {
    const reader = res.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';
    let accumulated = '';
    let firstTokenMs: number | null = null;
    let modelUsed = 'ministral-8b-2410';
    let complexityTier: 'short' | 'fast' | 'general' | 'complex' | 'tool' = 'general';
    let requestId = '';
    let usageData: any = undefined;
    let webSearchUsed = false;
    let webSources: WebSearchSourceInfo[] = [];
    let finishReason: string | undefined = undefined;
    let truncated = false;

    const processSseLine = (rawLine: string) => {
      const line = rawLine.trim();
      if (!line || !line.startsWith('data:')) return;
      const jsonStr = line.slice(5).trim();
      if (!jsonStr || jsonStr === '[DONE]') return;

      let eventObj: any;
      try {
        eventObj = JSON.parse(jsonStr);
      } catch {
        return;
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
        if (typeof eventObj.finishReason === 'string') finishReason = eventObj.finishReason;
        if (typeof eventObj.truncated === 'boolean') truncated = eventObj.truncated;
        else if (finishReason === 'length') truncated = true;
      } else if (eventObj.type === 'error') {
        const message =
          (typeof eventObj.error === 'string' && eventObj.error) ||
          eventObj.error?.message ||
          eventObj.message ||
          eventObj.details ||
          'AI streaming failed.';
        const streamError: any = new Error(message);
        streamError.code = eventObj.code || eventObj.error?.code;
        streamError.requestId = eventObj.requestId;
        streamError.status = eventObj.status;
        throw streamError;
      }
    };

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
      for (const rawLine of lines) processSseLine(rawLine);
    }

    // Flush any incomplete UTF-8 sequence and parse the final SSE line. Some
    // proxies/providers close a stream without a trailing newline; dropping
    // this buffer can discard the final `done` or `error` event.
    buffer += decoder.decode();
    if (buffer.trim()) processSseLine(buffer);

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

    const finalResult = {
      text: accumulated.trim(),
      usage: usageData,
      telemetry,
      webSearchUsed,
      webSources,
      finishReason,
      truncated
    };
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

  const text = parsedRes.text || parsedRes.reply || '';
  const elapsed = Date.now() - requestStart;
  if (text) {
    callbacks.onToken(text, text, elapsed);
  }

  const telemetry: AIStreamTelemetry = {
    requestId: parsedRes.requestId,
    modelUsed: parsedRes.telemetry?.modelUsed || 'ministral-8b-2410',
    complexityTier: parsedRes.telemetry?.complexityTier || 'general',
    requestStart,
    firstTokenLatencyMs: elapsed,
    totalGenerationTimeMs: elapsed,
    dataRetrievalLatencyMs,
    streamed: false,
    webSearchUsed: Boolean(parsedRes.webSearchUsed),
    webSources: parsedRes.webSources || []
  };

  const finishReason = typeof parsedRes.finishReason === 'string' ? parsedRes.finishReason : undefined;
  const truncated = typeof parsedRes.truncated === 'boolean' ? parsedRes.truncated : finishReason === 'length';

  const finalResult = {
    text,
    usage: parsedRes.usage,
    telemetry,
    webSearchUsed: Boolean(parsedRes.webSearchUsed),
    webSources: parsedRes.webSources || [],
    finishReason,
    truncated
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
 * Detects whether a student prompt is requesting to be taught or learn any topic interactively,
 * returning the normalized topic title for Byte Interactive Classroom.
 */
export function extractTopicTeachingIntent(text: string): string | null {
  if (!text || typeof text !== 'string') return null;
  const clean = text.trim();
  
  const patterns = [
    /(?:teach\s+me|give\s+me\s+a\s+lesson\s+on|interactive\s+lesson\s+on|master|study|explain\s+in\s+detail|learn)\s+(?:about\s+)?(?:the\s+topic\s+of\s+)?([a-zA-Z0-9\s\-+'":]{2,50})/i,
    /^(?:can\s+you\s+teach\s+me|prepare\s+a\s+lesson\s+for\s+me\s+on)\s+([a-zA-Z0-9\s\-+'":]{2,50})/i
  ];

  for (const pat of patterns) {
    const match = clean.match(pat);
    if (match && match[1]) {
      let topic = match[1].replace(/[?.!]+$/, '').trim();
      topic = topic.replace(/\s+(please|step by step|in detail|for beginners|simply)$/i, '').trim();
      if (topic.length >= 3 && topic.length <= 45 && !/^(it|that|this|something|anything|me)$/i.test(topic)) {
        return topic;
      }
    }
  }
  return null;
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

  await persistDeckToSupabase(newDeck, userId);

  const nowTs = Date.now();
  const cardBatch: Flashcard[] = cards.map((c, i) => ({
    id: `card-ai-${nowTs}-${i}`,
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
  }));

  await persistCardsBatchToSupabase(cardBatch, userId);

  return { deck: newDeck, count: cardBatch.length };
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
import katex from 'katex';
import 'katex/dist/katex.min.css';

/**
 * Robust mathematical text formatting using KaTeX.
 * Handles both inline \(...\) or $...$ and display \[...\] or $$...$$ delimiters.
 */
export function formatMathematicalText(raw: string): string {
  if (!raw) return '';
  
  // If the string starts/ends with math delimiters, render it fully as math
  const isDisplay = (raw.startsWith('$$') && raw.endsWith('$$')) || (raw.startsWith('\\\[') && raw.endsWith('\\\]'));
  const isInline = (raw.startsWith('$') && raw.endsWith('$')) || (raw.startsWith('\\\(') && raw.endsWith('\\\)'));

  if (isDisplay || isInline) {
    const formula = raw.replace(/^(\$\$|\\\[|\$|\\\()|(\$\$|\\\]|\$|\\\))$/g, '').trim();
    try {
      return katex.renderToString(formula, {
        displayMode: isDisplay,
        throwOnError: false,
        strict: false
      });
    } catch (e) {
      console.warn('KaTeX render error:', e);
      return raw;
    }
  }

  // Otherwise, attempt to find and replace math patterns within text
  // This is a bit more complex, we'll let the higher-level renderer handle it usually
  // but for legacy compatibility we'll do a basic pass
  let processed = raw;
  
  // Replace display blocks $$...$$
  processed = processed.replace(/\$\$([\s\S]+?)\$\$/g, (_, formula) => {
    try {
      return katex.renderToString(formula.trim(), { displayMode: true, throwOnError: false });
    } catch { return _; }
  });

  // Replace inline blocks $...$
  processed = processed.replace(/\$([^\$]+?)\$/g, (_, formula) => {
    try {
      return katex.renderToString(formula.trim(), { displayMode: false, throwOnError: false });
    } catch { return _; }
  });

  return processed;
}

/**
 * A React component to render LaTeX math safely.
 */
export const MathRenderer: React.FC<{ formula: string; display?: boolean; className?: string }> = ({ formula, display = false, className = '' }) => {
  const containerRef = React.useRef<HTMLSpanElement>(null);

  React.useEffect(() => {
    if (containerRef.current) {
      try {
        katex.render(formula, containerRef.current, {
          displayMode: display,
          throwOnError: false,
          strict: false
        });
      } catch (err) {
        containerRef.current.textContent = formula;
      }
    }
  }, [formula, display]);

  return <span ref={containerRef} className={className} />;
};

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
    conversationId?: string;
    threadId?: string;
    reasoningMode?: boolean;
    activeTab?: string;
    intentType?: string;
    modelOverride?: string;
    webSearchMode?: 'auto' | 'always' | 'force' | 'off';
    images?: { name?: string; mimeType: string; data: string }[];
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
      tier: 'short' | 'fast' | 'general' | 'complex' | 'tool';
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
      finishReason?: string;
      truncated?: boolean;
    }) => void;
  }
): Promise<{
  text: string;
  model: string;
  usage?: any;
  telemetry: AIStreamTelemetry;
  webSearchUsed?: boolean;
  webSources?: WebSearchSourceInfo[];
  finishReason?: string;
  truncated?: boolean;
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
          webSources: res.webSources,
          finishReason: res.finishReason,
          truncated: res.truncated
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
    webSources: result.webSources,
    finishReason: result.finishReason,
    truncated: result.truncated
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

