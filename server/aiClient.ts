/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * StudentOS Multi-Provider AI Routing Engine
 * - Tier 1 Auto-Routing:
 *   - Fast questions/tasks -> APInex (free/gpt-6-luna)
 *   - Short questions/messages -> Groq (single key with model rotation: llama-3.1-8b-instant, gpt-oss-120b, qwen3.8-27b)
 *   - General questions/messages -> Ministral (ministral-8b-2410)
 *   (Tier 1 fallback order if a Tier 1 provider is unavailable: APInex -> Ministral -> Groq)
 * - Long Reasoning & Multi-Chapter / Deep Explanations:
 *   - Nara Router ONLY (https://router.bynara.id/v1 with model: combo/free)
 */

import dotenv from 'dotenv';
dotenv.config();

export type TaskComplexityTier = 'short' | 'fast' | 'general' | 'complex' | 'tool';

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
  providerUsed: 'apinex' | 'groq' | 'ministral' | 'nara_router';
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
}

// API Key Getters
export function getApinexApiKey(): string {
  return (process.env.APINEX_API_KEY || process.env.VITE_APINEX_API_KEY || '').trim().replace(/^["']|["']$/g, '');
}

export function getMinistralApiKey(): string {
  return (process.env.MINISTRAL_API_KEY || process.env.MISTRAL_API_KEY || '').trim().replace(/^["']|["']$/g, '');
}

export function getGroqApiKey(): string {
  return (process.env.GROQ_API_KEY || '').trim().replace(/^["']|["']$/g, '');
}

export function getNaraRouterApiKey(): string {
  return (process.env.NARA_ROUTER_API_KEY || process.env.NVIDIA_API_KEY || '').trim().replace(/^["']|["']$/g, '');
}

export function getNaraRouterBaseUrl(): string {
  const raw = (process.env.NARA_ROUTER_BASE_URL || 'https://router.bynara.id/v1').trim().replace(/\/+$/, '');
  return raw.replace(/\/chat\/completions$/i, '').replace(/\/combo\/free$/i, '');
}

export function getNaraRouterModel(): string {
  return (process.env.NARA_ROUTER_MODEL || 'combo/free').trim() || 'combo/free';
}

// Groq Model Rotation Manager (single key rotating: llama-3.1-8b-instant, gpt-oss-120b, qwen3.8-27b)
export const groqModels = ['llama-3.1-8b-instant', 'gpt-oss-120b', 'qwen3.8-27b'];
let groqModelIndex = 0;
export function getNextGroqModel(): string {
  const model = groqModels[groqModelIndex % groqModels.length];
  groqModelIndex++;
  return model;
}

/**
 * Auto-Routing Classifier:
 * - Long reasoning / multi-chapter / deep explanations -> Nara Router ONLY (model: combo/free)
 * - Fast requests -> APInex (free/gpt-6-luna)
 * - Short requests -> Groq (with model rotation: llama-3.1-8b-instant, gpt-oss-120b, qwen3.8-27b)
 * - General requests -> Ministral (ministral-8b-2410)
 */
export function classifyTaskComplexity(
  prompt: string,
  ctx?: ModelRoutingContext
): { provider: 'apinex' | 'groq' | 'ministral' | 'nara_router'; model: string; tier: TaskComplexityTier } {
  const cleanPrompt = (prompt || '').trim();
  const lower = cleanPrompt.toLowerCase();
  const taskType = ctx?.taskType;
  const mode = (ctx?.mode || '').toLowerCase();
  const override = (ctx?.modelOverride || '').trim().toLowerCase();

  // 1. Explicit model overrides
  if (
    override.includes('nara') ||
    override.includes('combo/free') ||
    override.includes('combo') ||
    override.includes('nvidia') ||
    override.includes('lightning') ||
    override.includes('ultra')
  ) {
    return { provider: 'nara_router', model: 'combo/free', tier: 'complex' };
  }
  if (override.includes('groq') || override.includes('llama') || override.includes('qwen') || override.includes('gpt-oss')) {
    return { provider: 'groq', model: getNextGroqModel(), tier: 'short' };
  }
  if (override.includes('ministral') || override.includes('mistral')) {
    return { provider: 'ministral', model: 'ministral-8b-2410', tier: 'general' };
  }
  if (override.includes('apinex') || override.includes('gpt-6-luna')) {
    return { provider: 'apinex', model: 'free/gpt-6-luna', tier: 'fast' };
  }

  // 2. Explicit taskType overrides (e.g. internal tool/command endpoints)
  if (taskType === 'complex') {
    return { provider: 'nara_router', model: 'combo/free', tier: 'complex' };
  }
  if (taskType === 'fast' || taskType === 'tool' || (taskType as string) === 'orion_command') {
    return { provider: 'apinex', model: 'free/gpt-6-luna', tier: 'fast' };
  }
  if (taskType === 'short') {
    return { provider: 'groq', model: getNextGroqModel(), tier: 'short' };
  }
  if (taskType === 'general') {
    return { provider: 'ministral', model: 'ministral-8b-2410', tier: 'general' };
  }

  // 3. Long Reasoning & Multi-Chapter / Deep Explanations -> Nara Router ONLY (model: combo/free)
  const longReasoningPatterns = [
    // Multi-chapter, chapter explanations, units, full syllabus
    /\b(chapters?|units?|modules?|syllabus|curriculum)\b/i,
    /\b(\d+\s*(chapters?|topics?|units?|lessons?|modules?|concepts?|questions?|problems?|laws?|theorems?))\b/i,
    /\b(two|three|four|five|six|multiple|all|entire|full|whole)\s+(chapters?|topics?|units?|lessons?|modules?)\b/i,
    // Deep explanation & analytical reasoning
    /\b(explain\s+in\s+detail|detailed|in[\s-]*depth|deep\s*dive|step[\s-]*by[\s-]*step|comprehensive|thorough|thoroughly|elaborate|full\s*explanation|complete\s*guide|breakdown|break\s+down|walk\s+me\s+through)\b/i,
    /\b(compare\s+and\s+contrast|critically|analyze|analysis|evaluate|essay|research|long\s*answer|long\s*reasoning|reason\s*through|revision\s*guide|study\s*guide|exam\s*prep|masterclass)\b/i,
    // STEM / Mathematical / Scientific reasoning
    /\b(prove|proof|derive|derivation|theorem|calculus|integral|differential|eigenvalue|matrix|trigonometric|quantum|thermodynamics|stoichiometry|organic\s*chemistry|mechanism|kinematics|electromagnetism|genetics|algorithm|data\s*structure|architecture|system\s*design)\b/i,
    // Broad "explain ..." requests covering multiple concepts or extended scope
    /\bexplain\b.*\b(and|with|including|from|between|how|why)\b/i
  ];

  const wordCount = cleanPrompt.split(/\s+/).filter(Boolean).length;

  const isLongReasoning =
    mode.includes('step') ||
    mode.includes('deep') ||
    mode.includes('reasoning') ||
    longReasoningPatterns.some((regex) => regex.test(lower)) ||
    (/\b(explain|teach|elaborate|describe|discuss|solve)\b/i.test(lower) && wordCount >= 6) ||
    cleanPrompt.length > 220 ||
    Boolean(ctx?.contextLength && ctx.contextLength > 2500);

  if (isLongReasoning) {
    return {
      provider: 'nara_router',
      model: 'combo/free',
      tier: 'complex'
    };
  }

  // 4. Tier 1 Auto-Routing: Fast vs Short vs General
  // Fast -> APInex (free/gpt-6-luna)
  const fastPatterns = [
    /\b(fast|quick|quickly|rapid|instant|brief|briefly|tldr|tl;dr|bullet\s*points?|flashcards?|quiz|mcq|hint|one[\s-]*liner|key\s*points?|takeaways|checklist|grammar|fix|translate|paraphrase)\b/i
  ];

  const isFast =
    mode.includes('fast') ||
    mode.includes('quick') ||
    fastPatterns.some((regex) => regex.test(lower));

  if (isFast) {
    return {
      provider: 'apinex',
      model: 'free/gpt-6-luna',
      tier: 'fast'
    };
  }

  // Short -> Groq (with model rotation: llama-3.1-8b-instant, gpt-oss-120b, qwen3.8-27b)
  const isShort =
    mode.includes('short') ||
    wordCount <= 8 ||
    cleanPrompt.length <= 50;

  if (isShort) {
    return {
      provider: 'groq',
      model: getNextGroqModel(),
      tier: 'short'
    };
  }

  // General -> Ministral (ministral-8b-2410)
  return {
    provider: 'ministral',
    model: 'ministral-8b-2410',
    tier: 'general'
  };
}

export function extractTextFromChoice(choice: any): string {
  if (!choice) return '';
  const msg = choice.message || choice.delta || choice;

  if (msg && msg.content) {
    if (typeof msg.content === 'string' && msg.content.trim()) {
      return msg.content.trim();
    }
    if (Array.isArray(msg.content)) {
      const textParts = msg.content
        .map((part: any) => (typeof part === 'string' ? part : part?.text || part?.content || ''))
        .filter(Boolean);
      const joined = textParts.join('').trim();
      if (joined) return joined;
    }
  }

  if (msg && typeof msg.reasoning_content === 'string' && msg.reasoning_content.trim()) {
    return msg.reasoning_content.trim();
  }
  if (msg && typeof msg.reasoning === 'string' && msg.reasoning.trim()) {
    return msg.reasoning.trim();
  }
  if (msg && typeof msg.output_text === 'string' && msg.output_text.trim()) {
    return msg.output_text.trim();
  }
  if (typeof choice.text === 'string' && choice.text.trim()) {
    return choice.text.trim();
  }
  return '';
}

export function extractStreamingToken(choice: any): string {
  if (!choice) return '';
  const delta = choice.delta || choice.message || choice;
  if (!delta) return '';

  if (typeof delta.content === 'string') {
    return delta.content;
  }
  if (Array.isArray(delta.content)) {
    return delta.content
      .map((part: any) => (typeof part === 'string' ? part : part?.text || part?.content || ''))
      .join('');
  }
  if (typeof delta.reasoning_content === 'string') {
    return delta.reasoning_content;
  }
  if (typeof delta.reasoning === 'string') {
    return delta.reasoning;
  }
  if (typeof delta.output_text === 'string') {
    return delta.output_text;
  }
  if (typeof choice.text === 'string') {
    return choice.text;
  }
  return '';
}

function buildMessagesArray(
  systemInstruction: string,
  prompt: string,
  history: { role: 'user' | 'assistant'; content: string }[] = []
): any[] {
  let imageUrl: string | null = null;
  let cleanPrompt = prompt;

  const imageMatch = prompt.match(/Image Data: (data:(image\/[a-zA-Z+.-]+);base64,([A-Za-z0-9+/=\s\r\n]+))/);
  if (imageMatch) {
    imageUrl = imageMatch[1].trim();
    cleanPrompt = prompt.replace(/Image Data: data:image\/[a-zA-Z+.-]+;base64,[A-Za-z0-9+/=\s\r\n]+/, '[Attached Diagram/Image]');
  }

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

  messages.push({
    role: 'user',
    content: imageUrl
      ? [
          { type: 'text', text: cleanPrompt },
          { type: 'image_url', image_url: { url: imageUrl } }
        ]
      : cleanPrompt
  });

  return messages;
}

function getProviderEndpointAndKey(provider: 'apinex' | 'groq' | 'ministral' | 'nara_router'): {
  apiUrl: string;
  apiKey: string;
} {
  if (provider === 'apinex') {
    return {
      apiUrl: 'https://api.apinex.bond/v1/chat/completions',
      apiKey: getApinexApiKey()
    };
  }
  if (provider === 'ministral') {
    return {
      apiUrl: 'https://api.mistral.ai/v1/chat/completions',
      apiKey: getMinistralApiKey()
    };
  }
  if (provider === 'groq') {
    return {
      apiUrl: 'https://api.groq.com/openai/v1/chat/completions',
      apiKey: getGroqApiKey()
    };
  }
  // nara_router: https://router.bynara.id/v1/chat/completions with model: combo/free
  return {
    apiUrl: `${getNaraRouterBaseUrl()}/chat/completions`,
    apiKey: getNaraRouterApiKey()
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
    contextLength
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

  let provider = routing.provider;
  let model = routing.model;
  let fallbackTriggered = false;
  let retries = 0;

  const messages = buildMessagesArray(systemInstruction, prompt, history);
  const effectiveMaxTokens = maxTokens
    ? Math.max(maxTokens, 300)
    : routing.tier === 'short' || routing.tier === 'fast'
    ? 1200
    : 2500;

  console.log(`[AI_ROUTER] tier=${routing.tier} provider=${provider} model=${model} requestId=${requestId}`);

  async function callProviderOnce(
    p: 'apinex' | 'groq' | 'ministral' | 'nara_router',
    m: string,
    customUrl?: string
  ): Promise<string | null> {
    try {
      const { apiUrl: defaultUrl, apiKey } = getProviderEndpointAndKey(p);
      const targetUrl = customUrl || defaultUrl;

      // Require API key for Tier 1 providers; for Nara Router combo/free allow with or without key
      if (p !== 'nara_router' && !apiKey) {
        return null;
      }

      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };
      if (apiKey) {
        headers['Authorization'] = `Bearer ${apiKey}`;
      }

      const resp = await fetch(targetUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: m,
          messages,
          temperature,
          max_tokens: effectiveMaxTokens,
          ...(jsonMode ? { response_format: { type: 'json_object' } } : {})
        })
      });

      if (resp.ok) {
        const data = await resp.json();
        const text = extractTextFromChoice(data.choices?.[0]);
        if (text) return text;
      } else {
        const errBody = await resp.text().catch(() => '');
        console.warn(`[AI Provider ${p} (${m}) HTTP ${resp.status}]: ${errBody.slice(0, 200)}`);
        // If Nara Router /v1/chat/completions returned 404/400, try /v1/combo/free/chat/completions as well
        if (p === 'nara_router' && !customUrl && (resp.status === 404 || resp.status === 400)) {
          const altUrl = `${getNaraRouterBaseUrl()}/combo/free/chat/completions`;
          return await callProviderOnce(p, m, altUrl);
        }
      }
    } catch (err) {
      console.warn(`[AI Provider ${p} (${m}) error]:`, err);
    }
    return null;
  }

  let text: string | null = null;

  // CASE 1: Long Reasoning -> Nara Router ONLY (model: combo/free)
  if (routing.tier === 'complex' || provider === 'nara_router') {
    provider = 'nara_router';
    model = 'combo/free';
    text = await callProviderOnce('nara_router', 'combo/free');
    if (!text) {
      throw new Error(
        '[NARA ROUTER ERROR] Nara Router (https://router.bynara.id/v1, model: combo/free) could not complete this long-reasoning request. Please verify NARA_ROUTER_API_KEY.'
      );
    }
  } else {
    // CASE 2: Tier 1 Auto-Routing (fast -> apinex, short -> groq with model rotation, general -> ministral)
    if (provider === 'groq') {
      // Try rotated Groq models on the single GROQ_API_KEY
      for (let i = 0; i < groqModels.length; i++) {
        const candidateModel = i === 0 ? model : getNextGroqModel();
        text = await callProviderOnce('groq', candidateModel);
        if (text) {
          model = candidateModel;
          break;
        }
        retries++;
      }
    } else {
      text = await callProviderOnce(provider, model);
    }

    // If the auto-routed Tier 1 provider failed or its key is unconfigured, fallback across Tier 1: APInex -> Ministral -> Groq
    if (!text) {
      fallbackTriggered = true;
      const tier1Chain: Array<{ p: 'apinex' | 'ministral' | 'groq'; getM: () => string }> = [
        { p: 'apinex', getM: () => 'free/gpt-6-luna' },
        { p: 'ministral', getM: () => 'ministral-8b-2410' },
        { p: 'groq', getM: () => getNextGroqModel() }
      ];

      for (const step of tier1Chain) {
        if (step.p === provider) continue;
        if (step.p === 'groq') {
          for (let i = 0; i < groqModels.length; i++) {
            const gModel = getNextGroqModel();
            text = await callProviderOnce('groq', gModel);
            if (text) {
              provider = 'groq';
              model = gModel;
              break;
            }
          }
          if (text) break;
        } else {
          const candidateModel = step.getM();
          text = await callProviderOnce(step.p, candidateModel);
          if (text) {
            provider = step.p;
            model = candidateModel;
            break;
          }
        }
      }
    }

    if (!text) {
      throw new Error('[AI ERROR] Tier 1 AI providers (APInex, Ministral, Groq) failed to return a valid response.');
    }
  }

  const telemetry: AIPerformanceTelemetry = {
    requestId,
    providerUsed: provider,
    modelUsed: model,
    complexityTier: routing.tier,
    requestStart,
    firstTokenLatencyMs: Date.now() - requestStart,
    totalGenerationTimeMs: Date.now() - requestStart,
    retries,
    fallbackTriggered,
    streamed: false
  };

  return { text, telemetry };
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
    contextLength
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

  let activeProvider = routing.provider;
  let activeModel = routing.model;
  let fallbackTriggered = false;
  let retries = 0;

  const messages = buildMessagesArray(systemInstruction, prompt, history);
  const effectiveMaxTokens = maxTokens
    ? Math.max(maxTokens, 300)
    : routing.tier === 'short' || routing.tier === 'fast'
    ? 1200
    : 2500;

  console.log(
    `[AI_STREAM_ROUTER] tier=${routing.tier} provider=${activeProvider} model=${activeModel} requestId=${requestId}`
  );

  async function tryStreamFromProvider(
    p: 'apinex' | 'groq' | 'ministral' | 'nara_router',
    m: string,
    customUrl?: string
  ): Promise<{ fullText: string; firstTokenLatencyMs: number | null } | null> {
    const { apiUrl: defaultUrl, apiKey } = getProviderEndpointAndKey(p);
    const targetUrl = customUrl || defaultUrl;

    if (p !== 'nara_router' && !apiKey) {
      return null;
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'text/event-stream, application/json'
    };
    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }

    const response = await fetch(targetUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: m,
        messages,
        temperature,
        max_tokens: effectiveMaxTokens,
        stream: true
      }),
      signal: abortSignal
    });

    if (!response.ok || !response.body) {
      const errBody = await response.text().catch(() => '');
      console.warn(`[AI Stream ${p} (${m}) HTTP ${response.status}]: ${errBody.slice(0, 200)}`);
      if (p === 'nara_router' && !customUrl && (response.status === 404 || response.status === 400)) {
        const altUrl = `${getNaraRouterBaseUrl()}/combo/free/chat/completions`;
        return await tryStreamFromProvider(p, m, altUrl);
      }
      return null;
    }

    // Notify metadata once the connection succeeds
    callbacks.onMeta?.({ requestId, provider: p, model: m, tier: routing.tier });

    const contentType = (response.headers.get('content-type') || '').toLowerCase();
    // Handle case where provider returns standard JSON despite stream: true
    if (contentType.includes('application/json') && !contentType.includes('text/event-stream')) {
      const data = await response.json();
      const text = extractTextFromChoice(data.choices?.[0]);
      if (!text) return null;
      const firstTokenLatencyMs = Date.now() - requestStart;
      callbacks.onToken(text, firstTokenLatencyMs);
      return { fullText: text, firstTokenLatencyMs };
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';
    let fullText = '';
    let firstTokenLatencyMs: number | null = null;

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
          const token = extractStreamingToken(choice);

          if (token) {
            if (firstTokenLatencyMs === null) {
              firstTokenLatencyMs = Date.now() - requestStart;
            }
            fullText += token;
            callbacks.onToken(token, firstTokenLatencyMs);
          }
        } catch {}
      }
    }

    if (!fullText.trim()) {
      return null;
    }

    return { fullText, firstTokenLatencyMs };
  }

  try {
    let streamResult: { fullText: string; firstTokenLatencyMs: number | null } | null = null;

    // CASE 1: Long Reasoning -> Nara Router ONLY (model: combo/free)
    if (routing.tier === 'complex' || activeProvider === 'nara_router') {
      activeProvider = 'nara_router';
      activeModel = 'combo/free';
      streamResult = await tryStreamFromProvider('nara_router', 'combo/free');
      if (!streamResult) {
        throw new Error(
          '[NARA ROUTER ERROR] Nara Router (https://router.bynara.id/v1, model: combo/free) could not complete this long-reasoning request. Please verify NARA_ROUTER_API_KEY.'
        );
      }
    } else {
      // CASE 2: Tier 1 Auto-Routing (fast -> apinex, short -> groq with model rotation, general -> ministral)
      if (activeProvider === 'groq') {
        for (let i = 0; i < groqModels.length; i++) {
          const candidateModel = i === 0 ? activeModel : getNextGroqModel();
          streamResult = await tryStreamFromProvider('groq', candidateModel);
          if (streamResult) {
            activeModel = candidateModel;
            break;
          }
          retries++;
        }
      } else {
        streamResult = await tryStreamFromProvider(activeProvider, activeModel);
      }

      // Tier 1 Fallback if the primary Tier 1 provider is unavailable: APInex -> Ministral -> Groq
      if (!streamResult) {
        fallbackTriggered = true;
        const tier1Chain: Array<{ p: 'apinex' | 'ministral' | 'groq'; getM: () => string }> = [
          { p: 'apinex', getM: () => 'free/gpt-6-luna' },
          { p: 'ministral', getM: () => 'ministral-8b-2410' },
          { p: 'groq', getM: () => getNextGroqModel() }
        ];

        for (const step of tier1Chain) {
          if (step.p === activeProvider) continue;
          if (step.p === 'groq') {
            for (let i = 0; i < groqModels.length; i++) {
              const gModel = getNextGroqModel();
              streamResult = await tryStreamFromProvider('groq', gModel);
              if (streamResult) {
                activeProvider = 'groq';
                activeModel = gModel;
                break;
              }
            }
            if (streamResult) break;
          } else {
            const candidateModel = step.getM();
            streamResult = await tryStreamFromProvider(step.p, candidateModel);
            if (streamResult) {
              activeProvider = step.p;
              activeModel = candidateModel;
              break;
            }
          }
        }
      }

      if (!streamResult) {
        throw new Error('[AI ERROR] Tier 1 AI providers (APInex, Ministral, Groq) failed to stream a valid response.');
      }
    }

    const telemetry: AIPerformanceTelemetry = {
      requestId,
      providerUsed: activeProvider,
      modelUsed: activeModel,
      complexityTier: routing.tier,
      requestStart,
      firstTokenLatencyMs: streamResult.firstTokenLatencyMs ?? (Date.now() - requestStart),
      totalGenerationTimeMs: Date.now() - requestStart,
      retries,
      fallbackTriggered,
      streamed: true
    };

    callbacks.onComplete?.(streamResult.fullText, telemetry);
    return { text: streamResult.fullText, telemetry };
  } catch (err: any) {
    if (abortSignal?.aborted) throw err;
    throw new Error(err?.message || 'Stream completion failed.');
  }
}
