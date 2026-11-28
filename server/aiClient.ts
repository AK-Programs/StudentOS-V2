/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * StudentOS Multi-Provider AI Routing Engine
 * - Short chat, fast Buddy chat, taskType "short"/"fast", or modelOverride containing groq, llama, qwen, or gpt-oss:
 *   -> Groq (https://api.groq.com/openai/v1/chat/completions with GROQ_API_KEY)
 *   -> Rotates models: llama-3.1-8b-instant, openai/gpt-oss-120b, qwen/qwen3.8-27b
 * - General chat, complex tasks, revision guides, lecture notes, structured tool/JSON, or modelOverride containing ministral or mistral:
 *   -> Ministral (https://api.mistral.ai/v1/chat/completions with MINISTRAL_API_KEY, model: ministral-8b-2410)
 * - Z.ai explicit provider / modelOverride containing zai or glm-4.7:
 *   -> Z.ai (https://api.z.ai/api/paas/v4/chat/completions with server-only ZAI_API_KEY, model: glm-4.7-flash)
 * - Approved AI Providers strictly: Ministral, Groq, and Z.ai.
 */

import dotenv from 'dotenv';
dotenv.config();

export type AIProviderName = 'groq' | 'ministral' | 'zai';
export type TaskComplexityTier = 'short' | 'fast' | 'general' | 'complex' | 'tool';

export const ZAI_API_BASE_URL = 'https://api.z.ai/api/paas/v4';
export const ZAI_CHAT_COMPLETIONS_URL = 'https://api.z.ai/api/paas/v4/chat/completions';
export const ZAI_MODEL_ID = 'glm-4.7-flash';

export interface ModelRoutingContext {
  endpointName?: string;
  taskType?: TaskComplexityTier;
  modelOverride?: string;
  userRole?: string;
  mode?: string;
  persona?: string;
  contextLength?: number;
  historyLength?: number;
}

export interface AIPerformanceTelemetry {
  requestId: string;
  providerUsed: AIProviderName;
  modelUsed: string;
  complexityTier: TaskComplexityTier;
  requestStart: number;
  firstTokenLatencyMs: number | null;
  totalGenerationTimeMs: number;
  retries: number;
  fallbackTriggered: boolean;
  streamed: boolean;
}

export interface AICompletionOptions {
  systemInstruction?: string;
  prompt: string;
  history?: { role: 'user' | 'assistant'; content: string }[];
  temperature?: number;
  jsonMode?: boolean;
  modelOverride?: string;
  maxTokens?: number;
  endpointName?: string;
  taskType?: TaskComplexityTier;
  requestId?: string;
  userRole?: string;
  mode?: string;
  persona?: string;
  contextLength?: number;
  reasoningMode?: boolean;
  images?: { name?: string; mimeType: string; data: string }[];
}

// Approved AI Provider API Key Getters (Strictly Ministral, Groq, and Z.ai)

export function getMinistralApiKey(): string {
  return (process.env.MINISTRAL_API_KEY || process.env.MISTRAL_API_KEY || process.env.VITE_MINISTRAL_API_KEY || '')
    .trim()
    .replace(/^["']|["']$/g, '');
}

export function getGroqApiKey(): string {
  return (process.env.GROQ_API_KEY || process.env.VITE_GROQ_API_KEY || '').trim().replace(/^["']|["']$/g, '');
}

// Security rule: Z.ai key is strictly read from server-side ZAI_API_KEY (never VITE_ZAI_API_KEY).
export function getZaiApiKey(): string {
  return (process.env.ZAI_API_KEY || '').trim().replace(/^["']|["']$/g, '');
}

// Groq Model Rotation Manager (single key rotating: llama-3.1-8b-instant, openai/gpt-oss-120b, qwen/qwen3.8-27b)
export const groqModels = ['llama-3.1-8b-instant', 'openai/gpt-oss-120b', 'qwen/qwen3.8-27b'];
let groqModelIndex = 0;
export function getNextGroqModel(): string {
  const model = groqModels[groqModelIndex % groqModels.length];
  groqModelIndex++;
  return model;
}

function resolveGroqModel(modelOverride?: string): string {
  if (modelOverride && typeof modelOverride === 'string') {
    const lower = modelOverride.trim().toLowerCase();
    if (lower.includes('llama')) return 'llama-3.1-8b-instant';
    if (lower.includes('gpt-oss')) return 'openai/gpt-oss-120b';
    if (lower.includes('qwen')) return 'qwen/qwen3.8-27b';
  }
  return getNextGroqModel();
}

function isShortPrompt(prompt: string): boolean {
  const clean = (prompt || '').trim();
  const words = clean.split(/\s+/).filter(Boolean);
  if (words.length <= 20 && clean.length < 200) {
    const lower = clean.toLowerCase();
    const longAndComplexPatterns = [
      /\b(revision\s*guide|study\s*guide|complete\s*guide|comprehensive\s*guide|exam\s*prep|masterclass)\b/i,
      /\b(essay|long\s*answer|long\s*reasoning|long\s*class|long\s*explanation|long\s*note|in\s+detail|detailed|in[\s-]*depth|deep\s*dive|comprehensive|thorough|thoroughly|elaborate|full\s*explanation|step[\s-]*by[\s-]*step|walk\s+me\s+through|breakdown|break\s+down)\b/i,
      /\b(analysis|analyze|analyse|critically|evaluate|compare\s+and\s+contrast|comparative\s+analysis|correlate|regression|root\s+cause|detailed\s+academic\s+report|school-wide\s+analytics)\b/i,
      /\b(multi[\s-]*chapter|chapters?|units?|modules?|syllabus|curriculum)\b/i,
      /\b(\d+\s*(chapters?|topics?|units?|lessons?|modules?))\b/i,
      /\b(two|three|four|five|six|multiple|all|entire|full|whole)\s+(chapters?|topics?|units?|lessons?|modules?)\b/i,
      /\b(prove|proof|derive|derivation|theorem|calculus|integral|differential|eigenvalue|matrix|trigonometric\s+identity|quadratic\s+formula\s+proof|quantum|thermodynamics|stoichiometry|electrochemistry|organic\s+synthesis|system\s+of\s+equations|simultaneous\s+equations|vector\s+calculus)\b/i
    ];
    return !longAndComplexPatterns.some((regex) => regex.test(lower));
  }
  return false;
}

export function isLongOrComplexPrompt(
  prompt: string,
  ctx?: ModelRoutingContext
): boolean {
  const clean = (prompt || '').trim();
  const lower = clean.toLowerCase();
  const taskType = (ctx?.taskType || '').toLowerCase();
  const mode = (ctx?.mode || '').toLowerCase();
  const override = (ctx?.modelOverride || '').trim().toLowerCase();

  if (
    override.includes('groq') ||
    override.includes('llama') ||
    override.includes('qwen') ||
    override.includes('gpt-oss') ||
    override.includes('ministral') ||
    override.includes('mistral') ||
    override === 'zai' ||
    override.startsWith('zai/') ||
    override.includes('glm-4.7') ||
    taskType === 'short' ||
    taskType === 'general' ||
    taskType === 'fast' ||
    taskType === 'tool' ||
    taskType === 'zai'
  ) {
    return false;
  }

  if (isShortPrompt(clean)) {
    return false;
  }

  if (taskType === 'complex') {
    return !isShortPrompt(clean);
  }

  if (clean.length > 2500) {
    return true;
  }

  if (mode.includes('step') || mode.includes('deep') || mode.includes('reasoning')) {
    return true;
  }

  const longAndComplexPatterns = [
    /\b(revision\s*guide|study\s*guide|complete\s*guide|comprehensive\s*guide|exam\s*prep|masterclass)\b/i,
    /\b(essay|long\s*answer|long\s*reasoning|long\s*class|long\s*explanation|long\s*note|in\s+detail|detailed|in[\s-]*depth|deep\s*dive|comprehensive|thorough|thoroughly|elaborate|full\s*explanation|step[\s-]*by[\s-]*step|walk\s+me\s+through|breakdown|break\s+down)\b/i,
    /\b(analysis|analyze|analyse|critically|evaluate|compare\s+and\s+contrast|comparative\s+analysis|correlate|regression|root\s+cause|detailed\s+academic\s+report|school-wide\s+analytics)\b/i,
    /\b(multi[\s-]*chapter|chapters?|units?|modules?|syllabus|curriculum)\b/i,
    /\b(\d+\s*(chapters?|topics?|units?|lessons?|modules?))\b/i,
    /\b(two|three|four|five|six|multiple|all|entire|full|whole)\s+(chapters?|topics?|units?|lessons?|modules?)\b/i,
    /\b(prove|proof|derive|derivation|theorem|calculus|integral|differential|eigenvalue|matrix|trigonometric\s+identity|quadratic\s+formula\s+proof|quantum|thermodynamics|stoichiometry|electrochemistry|organic\s+synthesis|system\s+of\s+equations|simultaneous\s+equations|vector\s+calculus)\b/i
  ];

  return longAndComplexPatterns.some((regex) => regex.test(lower));
}

export function classifyTaskComplexity(
  prompt: string,
  ctx?: ModelRoutingContext
): { provider: AIProviderName; model: string; tier: TaskComplexityTier } {
  const cleanPrompt = (prompt || '').trim();
  const lower = cleanPrompt.toLowerCase();
  const taskType = (ctx?.taskType || '').toLowerCase();
  const mode = (ctx?.mode || '').toLowerCase();
  const override = (ctx?.modelOverride || '').trim().toLowerCase();
  const endpoint = (ctx?.endpointName || '').toLowerCase();

  // 1. Explicit model overrides (Groq, Ministral, or Z.ai — never legacy glm-5.3 or apinex)
  if (
    override.includes('groq') ||
    override.includes('llama') ||
    override.includes('qwen') ||
    override.includes('gpt-oss')
  ) {
    return { provider: 'groq', model: resolveGroqModel(ctx?.modelOverride), tier: 'short' };
  }
  if (override.includes('ministral') || override.includes('mistral')) {
    return { provider: 'ministral', model: 'ministral-8b-2410', tier: 'general' };
  }
  if (override === 'zai' || override.startsWith('zai/') || override.includes('glm-4.7') || taskType === 'zai') {
    return {
      provider: 'zai',
      model: ZAI_MODEL_ID,
      tier: taskType === 'complex' ? 'complex' : 'general'
    };
  }

  // 2. Explicit taskType overrides
  if (taskType === 'complex') {
    if (!isShortPrompt(cleanPrompt)) {
      return { provider: 'ministral', model: 'ministral-8b-2410', tier: 'complex' };
    }
  }
  if (taskType === 'short') {
    return { provider: 'groq', model: resolveGroqModel(ctx?.modelOverride), tier: 'short' };
  }
  if (taskType === 'general') {
    return { provider: 'ministral', model: 'ministral-8b-2410', tier: 'general' };
  }
  if (taskType === 'fast') {
    return { provider: 'groq', model: resolveGroqModel(ctx?.modelOverride), tier: 'fast' };
  }
  if (taskType === 'tool' || taskType === 'orion_command') {
    return { provider: 'ministral', model: 'ministral-8b-2410', tier: 'tool' };
  }

  // 3. Long context, revision guides, essays, multi-chapter explanations, analysis -> Ministral
  if (isLongOrComplexPrompt(cleanPrompt, ctx)) {
    return {
      provider: 'ministral',
      model: 'ministral-8b-2410',
      tier: 'complex'
    };
  }

  // 4. Tool / JSON / Diagram / Flashcard / 3D task -> Ministral structured model
  if (
    endpoint.includes('json') ||
    endpoint.includes('diagram') ||
    endpoint.includes('mermaid') ||
    endpoint.includes('3d') ||
    endpoint.includes('flashcard') ||
    lower.includes('raw json format') ||
    lower.includes('structured output')
  ) {
    return { provider: 'ministral', model: 'ministral-8b-2410', tier: 'tool' };
  }

  // 5. Mode-based routing if mode explicitly specifies short or general
  if (mode === 'short') {
    return { provider: 'groq', model: getNextGroqModel(), tier: 'short' };
  }
  if (mode === 'general') {
    return { provider: 'ministral', model: 'ministral-8b-2410', tier: 'general' };
  }

  // 6. Fast chat and normal Buddy chat default to Groq (with Ministral fallback at execution time)
  return {
    provider: 'groq',
    model: getNextGroqModel(),
    tier: 'fast'
  };
}

export function extractTextFromChoice(choice: any, rootData?: any): string {
  if (!choice && !rootData) return '';
  const msg = choice?.message || choice?.delta || choice || {};

  if (msg && msg.content !== undefined && msg.content !== null) {
    if (typeof msg.content === 'string' && msg.content.trim()) {
      return msg.content.trim();
    }
    if (Array.isArray(msg.content)) {
      const textParts = msg.content
        .map((part: any) => (typeof part === 'string' ? part : part?.text || part?.content || part?.output_text || ''))
        .filter(Boolean);
      const joined = textParts.join('').trim();
      if (joined) return joined;
    }
  }

  if (msg && typeof msg.output_text === 'string' && msg.output_text.trim()) {
    return msg.output_text.trim();
  }
  if (typeof choice?.output_text === 'string' && choice.output_text.trim()) {
    return choice.output_text.trim();
  }
  if (typeof rootData?.output_text === 'string' && rootData.output_text.trim()) {
    return rootData.output_text.trim();
  }
  if (typeof choice?.text === 'string' && choice.text.trim()) {
    return choice.text.trim();
  }
  return '';
}

export function extractStreamingToken(choice: any): string {
  if (!choice) return '';
  const delta = choice.delta || choice.message || choice;
  if (!delta) return '';

  if (typeof delta.content === 'string' && delta.content.length > 0) {
    return delta.content;
  }
  if (Array.isArray(delta.content)) {
    const joined = delta.content
      .map((part: any) => (typeof part === 'string' ? part : part?.text || part?.content || ''))
      .join('');
    if (joined.length > 0) {
      return joined;
    }
  }
  // Note: Never return internal reasoning_content or raw thinking traces to students.
  // Wait for real content tokens to stream.
  if (typeof delta.output_text === 'string' && delta.output_text.length > 0) {
    return delta.output_text;
  }
  if (typeof choice.output_text === 'string' && choice.output_text.length > 0) {
    return choice.output_text;
  }
  if (typeof choice.text === 'string' && choice.text.length > 0) {
    return choice.text;
  }
  return '';
}

function buildMessagesArray(
  systemInstruction: string,
  prompt: string,
  history: { role: 'user' | 'assistant'; content: string }[] = [],
  images?: { name?: string; mimeType: string; data: string }[]
): any[] {
  let cleanPrompt = prompt;
  const messages: any[] = [];
  if (systemInstruction) {
    messages.push({ role: 'system', content: systemInstruction });
  }

  const recentHistory = history.slice(-10);
  for (const msg of recentHistory) {
    if (msg && msg.content) {
      messages.push({
        role: msg.role === 'assistant' ? 'assistant' : 'user',
        content: String(msg.content)
      });
    }
  }

  if (images && images.length > 0) {
    const userContentParts: any[] = [
      { type: 'text', text: cleanPrompt }
    ];
    for (const img of images) {
      const dataUrl = img.data.startsWith('data:')
        ? img.data
        : `data:${img.mimeType || 'image/jpeg'};base64,${img.data}`;
      userContentParts.push({
        type: 'image_url',
        image_url: { url: dataUrl }
      });
    }
    messages.push({
      role: 'user',
      content: userContentParts
    });
  } else {
    const imageMatch = prompt.match(/Image Data: (data:(image\/[a-zA-Z+.-]+);base64,([A-Za-z0-9+/=\s\r\n]+))/);
    if (imageMatch) {
      const imageUrl = imageMatch[1].trim();
      cleanPrompt = prompt.replace(/Image Data: data:image\/[a-zA-Z+.-]+;base64,[A-Za-z0-9+/=\s\r\n]+/, '[Attached Diagram/Image]');
      messages.push({
        role: 'user',
        content: [
          { type: 'text', text: cleanPrompt },
          { type: 'image_url', image_url: { url: imageUrl } }
        ]
      });
    } else {
      messages.push({
        role: 'user',
        content: cleanPrompt
      });
    }
  }

  return messages;
}

function getProviderEndpointAndKey(provider: AIProviderName): {
  apiUrl: string;
  apiKey: string;
} {
  if (provider === 'ministral') {
    return {
      apiUrl: 'https://api.mistral.ai/v1/chat/completions',
      apiKey: getMinistralApiKey()
    };
  }
  if (provider === 'zai') {
    return {
      apiUrl: ZAI_CHAT_COMPLETIONS_URL,
      apiKey: getZaiApiKey()
    };
  }
  return {
    apiUrl: 'https://api.groq.com/openai/v1/chat/completions',
    apiKey: getGroqApiKey()
  };
}

export async function generateAICompletionWithTelemetry(
  param1: string | AICompletionOptions,
  param2?: string,
  param3: any[] = []
): Promise<{ text: string; telemetry: AIPerformanceTelemetry }> {
  let options: AICompletionOptions;

  if (typeof param1 === 'string') {
    options = {
      systemInstruction: param1,
      prompt: param2 || '',
      history: param3
    };
  } else {
    options = param1;
  }

  const {
    systemInstruction = 'You are a supportive, high-clarity academic tutor for StudentOS.',
    prompt,
    history = [],
    temperature = 0.6,
    jsonMode = false,
    modelOverride,
    maxTokens,
    endpointName = 'StudentOS AI',
    taskType,
    requestId = 'req_' + Math.random().toString(36).substring(2, 10),
    userRole,
    mode,
    persona,
    contextLength,
    images
  } = options;

  const requestStart = Date.now();
  const routing = classifyTaskComplexity(prompt, {
    endpointName,
    taskType,
    modelOverride,
    userRole,
    mode,
    persona,
    contextLength
  });

  const hasImages = (Array.isArray(images) && images.length > 0) || /Image Data: data:image\//i.test(prompt || '');
  const provider: AIProviderName = hasImages ? 'ministral' : routing.provider;
  const model = provider === 'ministral' ? 'ministral-8b-2410' : routing.model;
  let retries = 0;

  const isAcademicTask = taskType === 'complex' || routing.tier === 'complex';
  const messages = buildMessagesArray(systemInstruction, prompt, history, images);
  const effectiveMaxTokens = maxTokens
    ? Math.max(maxTokens, 300)
    : routing.tier === 'short' || routing.tier === 'fast'
    ? 1500
    : 32768; // High budget for Lecture Notes and complex reasoning

  console.log(`[AI_ROUTER] tier=${routing.tier} provider=${provider} model=${model} requestId=${requestId} budget=${effectiveMaxTokens} academic=${isAcademicTask}`);

  async function callApprovedProvider(
    p: AIProviderName,
    m: string,
    currentMessages: any[],
    budget: number,
    allowJsonFormat = jsonMode
  ) {
    const { apiUrl, apiKey } = getProviderEndpointAndKey(p);
    if (!apiKey) {
      const envName = p === 'zai' ? 'ZAI_API_KEY' : p === 'ministral' ? 'MINISTRAL_API_KEY' : 'GROQ_API_KEY';
      const err: any = new Error(`${envName} is not configured on the server.`);
      err.status = 500;
      err.providerUsed = p;
      err.modelUsed = m;
      throw err;
    }

    // Clamp single-request token budget cleanly for OpenAI-compatible endpoints
    const clampedBudget = p === 'ministral' ? Math.min(budget, 8192) : Math.min(budget, 4096);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 28000);

    try {
      const resp = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          model: m,
          messages: currentMessages,
          temperature,
          max_tokens: clampedBudget,
          ...(allowJsonFormat ? { response_format: { type: 'json_object' } } : {})
        }),
        signal: controller.signal
      });

      clearTimeout(timeout);

      if (!resp.ok) {
        const errBody = await resp.text().catch(() => '');
        // Some models/endpoints reject response_format: json_object with HTTP 400; retry cleanly without it once
        if (resp.status === 400 && allowJsonFormat && /response_format|json_object|unsupported/i.test(errBody)) {
          return await callApprovedProvider(p, m, currentMessages, budget, false);
        }
        const err: any = new Error(`${p} HTTP ${resp.status}: ${errBody || resp.statusText}`);
        err.status = resp.status;
        err.providerUsed = p;
        err.modelUsed = m;
        throw err;
      }

      const data = await resp.json();
      const text = extractTextFromChoice(data?.choices?.[0], data);
      const finishReason = data?.choices?.[0]?.finish_reason || 'stop';
      return { text, finishReason, provider: p, model: m };
    } catch (fetchErr: any) {
      clearTimeout(timeout);
      if (fetchErr?.providerUsed) throw fetchErr;
      const isTimeout = fetchErr?.name === 'AbortError' || String(fetchErr?.message || '').toLowerCase().includes('abort');
      const err: any = new Error(
        isTimeout ? `${p} request timed out after 28 seconds.` : (fetchErr?.message || `${p} request failed`)
      );
      err.status = isTimeout ? 504 : 502;
      err.providerUsed = p;
      err.modelUsed = m;
      throw err;
    }
  }

  async function performCompletion(primaryProvider: AIProviderName, primaryModel: string, currentMessages: any[], budget: number) {
    const candidates: Array<{ p: AIProviderName; m: string }> = [
      { p: primaryProvider, m: primaryModel }
    ];
    if (primaryProvider === 'zai') {
      if (getMinistralApiKey()) {
        candidates.push({ p: 'ministral', m: 'ministral-8b-2410' });
      }
      if (getGroqApiKey()) {
        candidates.push({ p: 'groq', m: getNextGroqModel() });
      }
    } else if (primaryProvider === 'groq') {
      for (const altModel of groqModels) {
        if (altModel !== primaryModel) {
          candidates.push({ p: 'groq', m: altModel });
        }
      }
      if (getMinistralApiKey()) {
        candidates.push({ p: 'ministral', m: 'ministral-8b-2410' });
      }
      if (getZaiApiKey()) {
        candidates.push({ p: 'zai', m: ZAI_MODEL_ID });
      }
    } else if (!hasImages) {
      if (getGroqApiKey()) {
        candidates.push({ p: 'groq', m: getNextGroqModel() });
      }
      if (getZaiApiKey()) {
        candidates.push({ p: 'zai', m: ZAI_MODEL_ID });
      }
    }

    let lastErr: any = null;
    for (let i = 0; i < candidates.length; i++) {
      const candidate = candidates[i];
      if (!getProviderEndpointAndKey(candidate.p).apiKey) {
        if (i === 0) {
          const envName = candidate.p === 'zai' ? 'ZAI_API_KEY' : candidate.p === 'ministral' ? 'MINISTRAL_API_KEY' : 'GROQ_API_KEY';
          lastErr = Object.assign(new Error(`${envName} is not configured on the server.`), {
            status: 500,
            providerUsed: candidate.p,
            modelUsed: candidate.m,
          });
        }
        continue;
      }
      if (i > 0) retries++;
      try {
        const res = await callApprovedProvider(candidate.p, candidate.m, currentMessages, budget);
        if (res.text && res.text.trim()) return res;
      } catch (err: any) {
        lastErr = err;
        console.warn(`[AI_ROUTER] Provider ${candidate.p} (${candidate.m}) fallback trigger:`, err?.message || err);
      }
    }

    throw lastErr || new Error('No configured approved AI providers (Ministral, Groq, Z.ai) succeeded.');
  }

  let finalFullText = '';
  let activeProvider: AIProviderName = provider;
  let activeModel = model;
  let lastFinishReason = 'stop';
  let continuationCount = 0;

  try {
    const result = await performCompletion(activeProvider, activeModel, messages, effectiveMaxTokens);
    finalFullText = result.text;
    lastFinishReason = result.finishReason;
    activeProvider = result.provider;
    activeModel = result.model;

    // Continuation Logic for Truncated Notes (Max 8 continuations for massive academic documents)
    const maxContinuations = isAcademicTask ? 8 : 2;

    while (lastFinishReason === 'length' && continuationCount < maxContinuations && !jsonMode) {
      continuationCount++;
      console.log(`[AI_CONTINUATION] Truncation detected for ${activeProvider} (Segment ${continuationCount + 1}). Budgeting for full synthesis...`);
      
      const continuationMessages = [
        ...messages,
        { role: 'assistant', content: finalFullText },
        { role: 'user', content: 'The previous response was truncated due to output limits. Please continue EXACTLY from where you left off, resuming the sentence or table immediately. Do NOT repeat the introduction, previous sections, or add meta-commentary. Focus on completing the remaining sections of the full document until finished.' }
      ];

      const contResult = await performCompletion(activeProvider, activeModel, continuationMessages, effectiveMaxTokens);
      if (contResult.text) {
        const newSegment = contResult.text.trim();
        finalFullText += (finalFullText.endsWith('\n') ? '' : '\n') + newSegment;
        lastFinishReason = contResult.finishReason;
      } else {
        break;
      }
    }

    if (!finalFullText) {
      const err: any = new Error(`${activeProvider} returned empty content.`);
      err.status = 502;
      err.providerUsed = activeProvider;
      err.modelUsed = activeModel;
      throw err;
    }

    const telemetry: AIPerformanceTelemetry = {
      requestId,
      providerUsed: activeProvider,
      modelUsed: activeModel,
      complexityTier: routing.tier,
      requestStart,
      firstTokenLatencyMs: Date.now() - requestStart,
      totalGenerationTimeMs: Date.now() - requestStart,
      retries,
      fallbackTriggered: activeProvider !== provider,
      streamed: false
    };

    if (continuationCount > 0) {
      console.log(`[AI_COMPLETE] Successfully assembled ${continuationCount + 1} segments. Final length: ${finalFullText.length} chars.`);
    }

    return { text: finalFullText.trim(), telemetry };
  } catch (outerErr: any) {
    console.error(`[AI_ERROR] RequestId=${requestId}:`, outerErr.message);
    throw outerErr;
  }
}

export async function generateAICompletion(
  param1: string | AICompletionOptions,
  param2?: string,
  param3: any[] = []
): Promise<string> {
  const result = await generateAICompletionWithTelemetry(param1, param2, param3);
  return result.text;
}

export async function streamAICompletion(
  options: AICompletionOptions,
  callbacks: {
    onMeta?: (meta: { requestId: string; provider: string; model: string; tier: TaskComplexityTier }) => void;
    onToken: (token: string, firstTokenLatencyMs: number) => void;
    onComplete?: (fullText: string, telemetry: AIPerformanceTelemetry) => void;
  },
  abortSignal?: AbortSignal
): Promise<{ text: string; telemetry: AIPerformanceTelemetry }> {
  const {
    systemInstruction = 'You are a supportive, high-clarity academic tutor for StudentOS.',
    prompt,
    history = [],
    temperature = 0.6,
    modelOverride,
    maxTokens,
    endpointName = 'AIChatStream',
    taskType,
    requestId = 'req_' + Math.random().toString(36).substring(2, 10),
    userRole,
    mode,
    persona,
    contextLength,
    images
  } = options;

  const requestStart = Date.now();
  const routing = classifyTaskComplexity(prompt, {
    endpointName,
    taskType,
    modelOverride,
    userRole,
    mode,
    persona,
    contextLength
  });

  const hasImages = (Array.isArray(images) && images.length > 0) || /Image Data: data:image\//i.test(prompt || '');
  const activeProvider: AIProviderName = hasImages ? 'ministral' : routing.provider;
  let activeModel = activeProvider === 'ministral' ? 'ministral-8b-2410' : routing.model;
  let retries = 0;

  const messages = buildMessagesArray(systemInstruction, prompt, history, images);
  const effectiveMaxTokens = maxTokens
    ? Math.max(maxTokens, 300)
    : routing.tier === 'short' || routing.tier === 'fast'
    ? 1200
    : 4096;

  console.log(
    `[AI_STREAM_ROUTER] tier=${routing.tier} provider=${activeProvider} model=${activeModel} requestId=${requestId}`
  );

  async function tryStreamOnce(
    p: AIProviderName,
    m: string,
    customMaxTokens?: number
  ): Promise<{ fullText: string; firstTokenLatencyMs: number | null; finishReason?: string }> {
    const { apiUrl: targetUrl, apiKey } = getProviderEndpointAndKey(p);

    if (!apiKey) {
      const keyName = p === 'zai' ? 'ZAI_API_KEY' : p === 'groq' ? 'GROQ_API_KEY' : 'MINISTRAL_API_KEY';
      const err: any = new Error(`${keyName} environment variable is not configured on the server.`);
      err.status = 500;
      err.providerUsed = p;
      err.modelUsed = m;
      throw err;
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'text/event-stream, application/json',
      'Authorization': `Bearer ${apiKey}`
    };

    const requestController = new AbortController();
    const timeoutId = setTimeout(() => requestController.abort(), 30000);
    const onExternalAbort = () => requestController.abort();
    abortSignal?.addEventListener('abort', onExternalAbort, { once: true });

    let response: Response;
    try {
      response = await fetch(targetUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: m,
          messages,
          temperature,
          max_tokens: customMaxTokens || effectiveMaxTokens,
          stream: true
        }),
        signal: requestController.signal
      });
    } catch (fetchErr: any) {
      clearTimeout(timeoutId);
      abortSignal?.removeEventListener('abort', onExternalAbort);
      const err: any = new Error(
        fetchErr?.name === 'AbortError'
          ? `${p} stream request timed out after 30 seconds.`
          : (fetchErr?.message || `${p} stream request failed`)
      );
      err.status = fetchErr?.name === 'AbortError' ? 504 : 502;
      err.providerUsed = p;
      err.modelUsed = m;
      throw err;
    }
    clearTimeout(timeoutId);
    abortSignal?.removeEventListener('abort', onExternalAbort);

    if (!response.ok || !response.body) {
      const errBody = await response.text().catch(() => '');
      const err: any = new Error(`${p} HTTP ${response.status}: ${errBody || response.statusText || 'Stream request failed'}`);
      err.status = response.status;
      err.providerUsed = p;
      err.modelUsed = m;
      throw err;
    }

    if (!customMaxTokens) {
      callbacks.onMeta?.({ requestId, provider: p, model: m, tier: routing.tier });
    }

    const contentType = (response.headers.get('content-type') || '').toLowerCase();
    if (contentType.includes('application/json') && !contentType.includes('text/event-stream')) {
      const data = await response.json();
      const choice = data.choices?.[0];
      const text = extractTextFromChoice(choice, data);
      const finishReason = String(choice?.finish_reason || data?.finish_reason || '').toLowerCase();
      if (!text) return { fullText: '', firstTokenLatencyMs: null, finishReason };
      const firstTokenLatencyMs = Date.now() - requestStart;
      callbacks.onToken(text, firstTokenLatencyMs);
      return { fullText: text, firstTokenLatencyMs, finishReason };
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';
    let fullText = '';
    let firstTokenLatencyMs: number | null = null;
    let lastChoice: any = null;

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
        const payload = line.slice(5).trim();
        if (payload === '[DONE]') continue;

        try {
          const parsed = JSON.parse(payload);
          const choice = parsed.choices?.[0];
          if (choice) lastChoice = choice;
          const token = extractStreamingToken(choice);

          if (token.length > 0) {
            if (firstTokenLatencyMs === null) {
              firstTokenLatencyMs = Date.now() - requestStart;
            }
            fullText += token;
            callbacks.onToken(token, firstTokenLatencyMs);
          }
        } catch {}
      }
    }

    const finishReason = String(lastChoice?.finish_reason || '').toLowerCase();
    return { fullText, firstTokenLatencyMs, finishReason };
  }

  let streamResult: { fullText: string; firstTokenLatencyMs: number | null; finishReason?: string } | null = null;
  let finalProvider: AIProviderName = activeProvider;

  const streamPlan: Array<{ p: AIProviderName; m: string }> = [];
  if (activeProvider === 'zai' && !hasImages) {
    streamPlan.push({ p: 'zai', m: ZAI_MODEL_ID });
    if (getMinistralApiKey()) streamPlan.push({ p: 'ministral', m: 'ministral-8b-2410' });
    if (getGroqApiKey()) {
      for (const gm of groqModels) streamPlan.push({ p: 'groq', m: gm });
    }
  } else if (activeProvider === 'ministral' || routing.tier === 'complex' || hasImages) {
    streamPlan.push({ p: 'ministral', m: 'ministral-8b-2410' });
    if (!hasImages) {
      if (getGroqApiKey()) {
        for (const gm of groqModels) streamPlan.push({ p: 'groq', m: gm });
      }
      if (getZaiApiKey()) streamPlan.push({ p: 'zai', m: ZAI_MODEL_ID });
    }
  } else {
    for (const gm of [activeModel, ...groqModels.filter((m) => m !== activeModel)]) {
      streamPlan.push({ p: 'groq', m: gm });
    }
    if (getMinistralApiKey()) streamPlan.push({ p: 'ministral', m: 'ministral-8b-2410' });
    if (getZaiApiKey()) streamPlan.push({ p: 'zai', m: ZAI_MODEL_ID });
  }

  let lastStreamErr: any = null;
  for (let i = 0; i < streamPlan.length; i++) {
    const candidate = streamPlan[i];
    if (!getProviderEndpointAndKey(candidate.p).apiKey) {
      if (i === 0) {
        const keyName = candidate.p === 'zai' ? 'ZAI_API_KEY' : candidate.p === 'groq' ? 'GROQ_API_KEY' : 'MINISTRAL_API_KEY';
        lastStreamErr = Object.assign(new Error(`${keyName} environment variable is not configured on the server.`), {
          status: 500,
          providerUsed: candidate.p,
          modelUsed: candidate.m,
        });
      }
      continue;
    }
    if (i > 0) retries++;
    finalProvider = candidate.p;
    activeModel = candidate.m;
    try {
      const attempt = await tryStreamOnce(candidate.p, candidate.m);
      if (attempt.fullText.trim()) {
        streamResult = attempt;
        break;
      }
    } catch (err: any) {
      lastStreamErr = err;
      console.warn(`[AI_STREAM_ROUTER] ${candidate.p} (${candidate.m}) fallback notice:`, err?.message || err);
    }
  }

  if (!streamResult || !streamResult.fullText.trim()) {
    if (lastStreamErr) throw lastStreamErr;
    const err: any = new Error(`${finalProvider} returned empty stream content.`);
    err.status = 502;
    err.providerUsed = finalProvider;
    err.modelUsed = activeModel;
    throw err;
  }

  const finishedReply = streamResult.fullText.trim();

  const telemetry: AIPerformanceTelemetry = {
    requestId,
    providerUsed: finalProvider,
    modelUsed: activeModel,
    complexityTier: routing.tier,
    requestStart,
    firstTokenLatencyMs: streamResult.firstTokenLatencyMs ?? (Date.now() - requestStart),
    totalGenerationTimeMs: Date.now() - requestStart,
    retries,
    fallbackTriggered: finalProvider !== activeProvider,
    streamed: true
  };

  callbacks.onComplete?.(finishedReply, telemetry);
  return { text: finishedReply, telemetry };
}

