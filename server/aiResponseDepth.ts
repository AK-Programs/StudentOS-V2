/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Adaptive Byte AI Response-Depth Classifier & Provider Output Token Budget Manager
 * Scales response depth naturally to user intent while accounting for provider
 * output limits (especially Z.ai GLM-4.7-Flash 128K output / 200K context and
 * default thinking-token allocation so reasoning never truncates visible answers).
 */

export type ByteResponseDepthMode =
  | 'quick_answer'
  | 'normal_explanation'
  | 'detailed_explanation'
  | 'full_chapter'
  | 'step_by_step_tutorial'
  | 'deep_dive'
  | 'revision_notes'
  | 'comparison'
  | 'summary';

export interface ResponseDepthClassification {
  depth: ByteResponseDepthMode;
  reason: string;
  isLongForm: boolean;
  requiresWebFreshnessHint: boolean;
  targetOutputBudget: number;
}

export function classifyByteResponseDepth(params: {
  prompt?: string;
  intentType?: string;
  mode?: string;
  reasoningMode?: boolean;
  history?: any[];
  taskType?: string;
}): ResponseDepthClassification {
  const rawPrompt = String(params.prompt || '').trim();
  const lower = rawPrompt.toLowerCase();
  const wordCount = rawPrompt ? rawPrompt.split(/\s+/).length : 0;
  const intent = String(params.intentType || '').toLowerCase();
  const mode = String(params.mode || '').toLowerCase();

  const requiresWebFreshnessHint =
    /\b(latest|recent|update|patch|version|current meta|today|2025|2026|2027|news|score|standings|genshin|valorant|minecraft|fortnite|release date|new character|tier list)\b/i.test(
      rawPrompt
    );

  // Explicit user length / format intent takes priority
  if (
    /\b(full chapter|complete chapter|entire chapter|chapter in full|in full detail|explain everything|from start to finish|teach me everything|zero to hero|whole chapter|complete guide)\b/i.test(
      lower
    )
  ) {
    return {
      depth: 'full_chapter',
      reason: 'User explicitly requested full chapter / complete teaching coverage',
      isLongForm: true,
      requiresWebFreshnessHint,
      targetOutputBudget: 24576,
    };
  }

  if (/\b(deep dive|in-depth|comprehensive analysis|exhaustive|advanced breakdown)\b/i.test(lower)) {
    return {
      depth: 'deep_dive',
      reason: 'User requested deep dive / comprehensive analysis',
      isLongForm: true,
      requiresWebFreshnessHint,
      targetOutputBudget: 16384,
    };
  }

  if (/\b(revision notes|cheat sheet|formula sheet|study notes|exam notes|key notes|flashcard notes)\b/i.test(lower)) {
    return {
      depth: 'revision_notes',
      reason: 'User requested structured revision notes',
      isLongForm: true,
      requiresWebFreshnessHint,
      targetOutputBudget: 8192,
    };
  }

  if (/\b(compare|comparison|difference between|differences between|distinguish between|\bvs\b|versus)\b/i.test(lower)) {
    return {
      depth: 'comparison',
      reason: 'User requested comparison breakdown',
      isLongForm: false,
      requiresWebFreshnessHint,
      targetOutputBudget: 2500,
    };
  }

  if (/\b(step by step|step-by-step|derive|derivation|solve step|walk me through|walkthrough|how to solve|guide on)\b/i.test(lower)) {
    return {
      depth: 'step_by_step_tutorial',
      reason: 'User requested step-by-step tutorial or mathematical derivation',
      isLongForm: true,
      requiresWebFreshnessHint,
      targetOutputBudget: 8192,
    };
  }

  if (/\b(summarize|summary|tldr|tl;dr|recap|overview in short)\b/i.test(lower)) {
    return {
      depth: 'summary',
      reason: 'User requested concise summary',
      isLongForm: false,
      requiresWebFreshnessHint,
      targetOutputBudget: 1500,
    };
  }

  if (
    /\b(in detail|detailed|explain thoroughly|all topics|with examples|worked examples|elaborate|cover all)\b/i.test(
      lower
    ) ||
    mode === 'detailed' ||
    intent === 'chapter_explanation'
  ) {
    return {
      depth: 'detailed_explanation',
      reason: 'User requested detailed explanation with examples',
      isLongForm: true,
      requiresWebFreshnessHint,
      targetOutputBudget: 12288,
    };
  }

  if (
    /\b(briefly|in one line|short answer|quick answer|just tell me|one sentence|quickly|yes or no|what is the value of)\b/i.test(
      lower
    ) ||
    (wordCount > 0 &&
      wordCount <= 6 &&
      !params.reasoningMode &&
      !/\b(chapter|explain|prove|derive|tutorial|notes|essay)\b/i.test(lower))
  ) {
    return {
      depth: 'quick_answer',
      reason: 'Short direct query or explicit brief answer request',
      isLongForm: false,
      requiresWebFreshnessHint,
      targetOutputBudget: 600,
    };
  }

  if (params.reasoningMode) {
    return {
      depth: 'detailed_explanation',
      reason: 'Deep Reasoning mode enabled',
      isLongForm: true,
      requiresWebFreshnessHint,
      targetOutputBudget: 12288,
    };
  }

  return {
    depth: 'normal_explanation',
    reason: 'Balanced standard explanation',
    isLongForm: false,
    requiresWebFreshnessHint,
    targetOutputBudget: 3500,
  };
}

/**
 * Official model output specs:
 * - Z.ai glm-4.7-flash: 200K context, 128K (131072) max output. Default thinking consumes part of max_tokens!
 * - Ministral (ministral-8b-2410): 128K context, generous output capacity.
 * - Groq (llama-3.1-8b-instant / gpt-oss-120b / qwen3.8-27b): 8192 max completion tokens safe limit on instant models.
 */
export function resolveProviderOutputTokenBudget(
  first:
    | {
        provider: 'zai' | 'ministral' | 'groq';
        depth?: ByteResponseDepthMode;
        requestedMaxTokens?: number;
        reasoningMode?: boolean;
      }
    | 'zai'
    | 'ministral'
    | 'groq',
  second?: any,
  third?: any
): { maxTokens: number; disableThinking?: boolean; valueOf(): number } {
  let provider: 'zai' | 'ministral' | 'groq' = 'groq';
  let depth: ByteResponseDepthMode = 'normal_explanation';
  let requestedMaxTokens: number | undefined;
  let reasoningMode = false;

  if (typeof first === 'object' && first !== null) {
    provider = first.provider || 'groq';
    depth = first.depth || 'normal_explanation';
    requestedMaxTokens = first.requestedMaxTokens;
    reasoningMode = Boolean(first.reasoningMode);
  } else {
    provider = first as 'zai' | 'ministral' | 'groq';
    if (typeof second === 'number') {
      requestedMaxTokens = second;
      if (typeof third === 'string') depth = third as ByteResponseDepthMode;
      else if (second >= 16384) depth = 'full_chapter';
      else if (second >= 8192) depth = 'step_by_step_tutorial';
    } else if (typeof second === 'string') {
      depth = second as ByteResponseDepthMode;
      if (typeof third === 'number') requestedMaxTokens = third;
    }
  }

  let result: { maxTokens: number; disableThinking?: boolean };

  if (provider === 'zai') {
    const zaiDefaults: Record<ByteResponseDepthMode, number> = {
      quick_answer: 4096,
      summary: 6144,
      comparison: 8192,
      normal_explanation: 8192,
      revision_notes: 12288,
      step_by_step_tutorial: 16384,
      detailed_explanation: 16384,
      deep_dive: 20480,
      full_chapter: 24576,
    };
    const base = zaiDefaults[depth] || 8192;
    const desired =
      typeof requestedMaxTokens === 'number' && Number.isFinite(requestedMaxTokens) && requestedMaxTokens > 0
        ? Math.max(base, requestedMaxTokens)
        : base;
    const clamped = Math.min(32768, Math.max(2048, desired));
    const disableThinking =
      !reasoningMode && (depth === 'quick_answer' || depth === 'summary');
    result = { maxTokens: clamped, disableThinking };
  } else if (provider === 'ministral') {
    const ministralDefaults: Record<ByteResponseDepthMode, number> = {
      quick_answer: 2048,
      summary: 3072,
      comparison: 4096,
      normal_explanation: 4096,
      revision_notes: 6144,
      step_by_step_tutorial: 8192,
      detailed_explanation: 8192,
      deep_dive: 10240,
      full_chapter: 12288,
    };
    const base = ministralDefaults[depth] || 4096;
    const desired =
      typeof requestedMaxTokens === 'number' && Number.isFinite(requestedMaxTokens) && requestedMaxTokens > 0
        ? Math.max(base, requestedMaxTokens)
        : base;
    result = { maxTokens: Math.min(16384, Math.max(1024, desired)) };
  } else {
    const groqDefaults: Record<ByteResponseDepthMode, number> = {
      quick_answer: 1536,
      summary: 2560,
      comparison: 3584,
      normal_explanation: 4096,
      revision_notes: 5120,
      step_by_step_tutorial: 6144,
      detailed_explanation: 6144,
      deep_dive: 8192,
      full_chapter: 8192,
    };
    const base = groqDefaults[depth] || 4096;
    const desired =
      typeof requestedMaxTokens === 'number' && Number.isFinite(requestedMaxTokens) && requestedMaxTokens > 0
        ? Math.max(base, requestedMaxTokens)
        : base;
    result = { maxTokens: Math.min(8192, Math.max(1024, desired)) };
  }

  return {
    ...result,
    valueOf() {
      return result.maxTokens;
    }
  };
}

export function buildAdaptiveDepthSystemDirectives(
  first: string | ResponseDepthClassification | undefined,
  second?: ResponseDepthClassification
): string {
  const classification = second || (typeof first === 'object' && first !== null ? (first as ResponseDepthClassification) : undefined);
  const existingPrompt = typeof first === 'string' ? first : '';

  if (!classification) {
    return existingPrompt;
  }

  const depthGuide: Record<ByteResponseDepthMode, string> = {
    quick_answer:
      'RESPONSE DEPTH (quick_answer): Answer directly and crisply without unnecessary padding, while staying accurate.',
    normal_explanation:
      'RESPONSE DEPTH (normal_explanation): Provide a clear, well-structured explanation with key ideas, clean math formatting, and an illustrative example.',
    summary:
      'RESPONSE DEPTH (summary): Present a crisp, high-signal bulleted overview covering core concepts and formulas.',
    comparison:
      'RESPONSE DEPTH (comparison): Use a clean comparison table plus concise analytical takeaways highlighting key contrasts.',
    revision_notes:
      'RESPONSE DEPTH (revision_notes): Organize into high-yield revision headings, key definitions, formula bank (with variable meanings), common traps, and quick recall prompts.',
    step_by_step_tutorial:
      'RESPONSE DEPTH (step_by_step_tutorial): Show every step sequentially without skipping algebra, reasoning, or intermediate results.',
    detailed_explanation:
      'RESPONSE DEPTH (detailed_explanation): Teach thoroughly with clear section headings, intuitive reasoning, formulas (with variable meanings and SI units), worked examples, and key takeaways. Do NOT prematurely summarize or cut topics short.',
    deep_dive:
      'RESPONSE DEPTH (deep_dive): Deliver a thorough conceptual and analytical deep dive with rigorous derivations, edge cases, worked problems, and synthesis.',
    full_chapter: `RESPONSE DEPTH (full_chapter): Teach the COMPLETE chapter thoroughly without truncating or skipping sections. Structure cleanly with:
1. Chapter Roadmap & Prerequisites
2. Core Concepts & Intuitions (every major sub-topic covered in sequence)
3. Key Formulas & Laws (every symbol/variable defined with units in LaTeX)
4. Solved Worked Examples (step-by-step)
5. Common Exam Mistakes & Misconceptions
6. Concise Revision Recap & Self-Test Practice Questions`,
  };

  const directives: string[] = [
    `ADAPTIVE RESPONSE DEPTH DIRECTIVE: ${classification.depth.toUpperCase()}`,
    depthGuide[classification.depth] || depthGuide.normal_explanation,
    'Do not cut off mid-thought. Finish all planned sections cleanly.'
  ];

  if (classification.requiresWebFreshnessHint) {
    directives.push('TEMPORAL FRESHNESS NOTE: State clearly which date, season, version, or school term this information refers to.');
  }

  const directiveText = directives.join('\n');
  return existingPrompt ? `${existingPrompt}\n\n${directiveText}` : directiveText;
}
