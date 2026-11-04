/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * StudentOS Multi-Provider AI Routing Engine
 * - Short chat, taskType "short", or modelOverride containing groq, llama, qwen, or gpt-oss:
 *   -> Groq (https://api.groq.com/openai/v1/chat/completions with GROQ_API_KEY)
 *   -> Rotates models: llama-3.1-8b-instant, openai/gpt-oss-120b, qwen/qwen3.8-27b
 * - General chat, complex tasks, revision guides, lecture notes, or modelOverride containing ministral or mistral:
 *   -> Ministral (https://api.mistral.ai/v1/chat/completions with MINISTRAL_API_KEY, model: ministral-8b-2410)
 * - Fast chat and normal Buddy chat:
 *   -> APInex (https://api.apinex.bond/v1/chat/completions with APINEX_API_KEY, model: free/gpt-6-luna, tools: free/glm-5.3-flash)
 * - Approved AI Providers strictly: APInex, Ministral, Groq.
 */

import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
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
  providerUsed: 'apinex' | 'groq' | 'ministral' | 'gemini';
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

// API Key Getters
export function getGeminiApiKey(): string {
  return (process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || '').trim().replace(/^["']|["']$/g, '');
}

let cachedGeminiClient: GoogleGenAI | null = null;
export function getGeminiClient(): GoogleGenAI | null {
  const key = getGeminiApiKey();
  if (!key) return null;
  if (!cachedGeminiClient) {
    cachedGeminiClient = new GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build'
        }
      }
    });
  }
  return cachedGeminiClient;
}

export function getApinexApiKey(): string {
  return (process.env.APINEX_API_KEY || process.env.VITE_APINEX_API_KEY || '').trim().replace(/^["']|["']$/g, '');
}

export function getMinistralApiKey(): string {
  return (process.env.MINISTRAL_API_KEY || process.env.MISTRAL_API_KEY || process.env.VITE_MINISTRAL_API_KEY || '')
    .trim()
    .replace(/^["']|["']$/g, '');
}

export function getGroqApiKey(): string {
  return (process.env.GROQ_API_KEY || process.env.VITE_GROQ_API_KEY || '').trim().replace(/^["']|["']$/g, '');
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
    override.includes('apinex') ||
    override.includes('gpt-6-luna') ||
    override.includes('glm-5.3-flash') ||
    taskType === 'short' ||
    taskType === 'general' ||
    taskType === 'fast' ||
    taskType === 'tool'
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
): { provider: 'apinex' | 'groq' | 'ministral'; model: string; tier: TaskComplexityTier } {
  const cleanPrompt = (prompt || '').trim();
  const lower = cleanPrompt.toLowerCase();
  const taskType = (ctx?.taskType || '').toLowerCase();
  const mode = (ctx?.mode || '').toLowerCase();
  const override = (ctx?.modelOverride || '').trim().toLowerCase();
  const endpoint = (ctx?.endpointName || '').toLowerCase();

  // 1. Explicit model overrides
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
  if (override.includes('apinex') || override.includes('gpt-6-luna') || override.includes('glm-5.3-flash')) {
    return {
      provider: 'apinex',
      model: override.includes('glm-5.3-flash') ? 'free/glm-5.3-flash' : 'free/gpt-6-luna',
      tier: override.includes('glm-5.3-flash') ? 'tool' : 'fast'
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
    return { provider: 'apinex', model: 'free/gpt-6-luna', tier: 'fast' };
  }
  if (taskType === 'tool' || taskType === 'orion_command') {
    return { provider: 'apinex', model: 'free/glm-5.3-flash', tier: 'tool' };
  }

  // 3. Long context, revision guides, essays, multi-chapter explanations, analysis -> Ministral (or Groq/APInex)
  if (isLongOrComplexPrompt(cleanPrompt, ctx)) {
    return {
      provider: 'ministral',
      model: 'ministral-8b-2410',
      tier: 'complex'
    };
  }

  // 4. Tool / JSON / Diagram / Flashcard / 3D task
  if (
    endpoint.includes('json') ||
    endpoint.includes('diagram') ||
    endpoint.includes('mermaid') ||
    endpoint.includes('3d') ||
    endpoint.includes('flashcard') ||
    lower.includes('raw json format') ||
    lower.includes('structured output')
  ) {
    return { provider: 'apinex', model: 'free/glm-5.3-flash', tier: 'tool' };
  }

  // 5. Mode-based routing if mode explicitly specifies short or general
  if (mode === 'short') {
    return { provider: 'groq', model: getNextGroqModel(), tier: 'short' };
  }
  if (mode === 'general') {
    return { provider: 'ministral', model: 'ministral-8b-2410', tier: 'general' };
  }

  // 6. Fast chat and normal Buddy chat stay on APInex free/gpt-6-luna
  return {
    provider: 'apinex',
    model: 'free/gpt-6-luna',
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

function getProviderEndpointAndKey(provider: 'apinex' | 'groq' | 'ministral'): {
  apiUrl: string;
  apiKey: string;
} {
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
  return {
    apiUrl: 'https://api.apinex.bond/v1/chat/completions',
    apiKey: getApinexApiKey()
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

  const provider = routing.provider;
  let model = routing.model;
  let retries = 0;

  const isAcademicTask = taskType === 'complex' || routing.tier === 'complex';
  const messages = buildMessagesArray(systemInstruction, prompt, history, images);
  const effectiveMaxTokens = maxTokens
    ? Math.max(maxTokens, 300)
    : routing.tier === 'short' || routing.tier === 'fast'
    ? 1500
    : 32768; // High budget for Lecture Notes and complex reasoning (20k+ requirement)

  console.log(`[AI_ROUTER] tier=${routing.tier} provider=${provider} model=${model} requestId=${requestId} budget=${effectiveMaxTokens} academic=${isAcademicTask}`);

  async function performCompletion(p: typeof provider, m: string, currentMessages: any[], budget: number) {
    // 0. Primary / Fallback: Google GenAI (Gemini)
    const gemini = getGeminiClient();
    const hasGroqKey = Boolean(getGroqApiKey());
    const hasMinistralKey = Boolean(getMinistralApiKey());
    const hasApinexKey = Boolean(getApinexApiKey());
    const providerKeyAvailable = 
      (p === 'groq' && hasGroqKey) ||
      (p === 'ministral' && hasMinistralKey) ||
      (p === 'apinex' && hasApinexKey);

    if (gemini && (!providerKeyAvailable || modelOverride?.toLowerCase().includes('gemini') || (images && images.length > 0))) {
      try {
        const imageParts = (images || []).map(img => ({
          inlineData: {
            mimeType: img.mimeType || 'image/jpeg',
            data: (img.data || '').replace(/^data:[^;]+;base64,/, '')
          }
        }));

        const contents = [
          ...history.slice(-8).map(h => ({
            role: h.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: String(h.content || '') }]
          })),
          {
            role: 'user',
            parts: [
              ...imageParts,
              { text: prompt }
            ]
          }
        ];

        const config: any = {
          temperature,
          systemInstruction,
          maxOutputTokens: isAcademicTask ? 8192 : Math.max(budget, 2048)
        };
        if (jsonMode) config.responseMimeType = 'application/json';

        const geminiRes = await gemini.models.generateContent({ model: 'gemini-2.5-flash', contents, config });
        return { text: geminiRes.text || '', finishReason: 'stop', provider: 'gemini', model: 'gemini-2.5-flash' };
      } catch (gErr: any) {
        console.warn('[Gemini AI Engine] Call error:', gErr?.message || gErr);
        if (!providerKeyAvailable) throw gErr;
      }
    }

    const { apiUrl, apiKey } = getProviderEndpointAndKey(p);
    if (!apiKey) {
      const err: any = new Error('API key not configured.');
      err.status = 500;
      throw err;
    }

    // SAFE CLAMPING: Most OpenAI-compatible providers (Groq, Ministral, APInex) 
    // cap output tokens between 4096 and 8192. Requesting 32k+ in one call 
    // often causes a 400 error. The continuation loop will handle the rest.
    const clampedBudget = p === 'ministral' ? Math.min(budget, 8192) : Math.min(budget, 4096);

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
        ...(jsonMode ? { response_format: { type: 'json_object' } } : {})
      })
    });

    if (!resp.ok) {
      const errBody = await resp.text().catch(() => '');
      const err: any = new Error(`${p} HTTP ${resp.status}: ${errBody || resp.statusText}`);
      err.status = resp.status;
      throw err;
    }

    const data = await resp.json();
    const text = extractTextFromChoice(data?.choices?.[0], data);
    const finishReason = data?.choices?.[0]?.finish_reason || 'stop';
    return { text, finishReason, provider: p, model: m };
  }

  let finalFullText = '';
  let activeProvider = provider;
  let activeModel = model;
  let lastFinishReason = 'stop';
  let continuationCount = 0;

  try {
    const result = await performCompletion(activeProvider, activeModel, messages, effectiveMaxTokens);
    finalFullText = result.text;
    lastFinishReason = result.finishReason;
    activeProvider = result.provider as any;
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

      // Increase temperature slightly for continuation to prevent repetition if stuck, 
      // but keep it stable for academic accuracy.
      const contResult = await performCompletion(activeProvider, activeModel, continuationMessages, effectiveMaxTokens);
      if (contResult.text) {
        // Check if there's overlapping text (common in some models)
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
      providerUsed: activeProvider as any,
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

  const activeProvider = routing.provider;
  let activeModel = routing.model;
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

  // 0. Primary / Fallback: Google GenAI (Gemini) Streaming
  const gemini = getGeminiClient();
  const hasGroqKey = Boolean(getGroqApiKey());
  const hasMinistralKey = Boolean(getMinistralApiKey());
  const hasApinexKey = Boolean(getApinexApiKey());
  const providerKeyAvailable = 
    (activeProvider === 'groq' && hasGroqKey) ||
    (activeProvider === 'ministral' && hasMinistralKey) ||
    (activeProvider === 'apinex' && hasApinexKey);

  if (gemini && (!providerKeyAvailable || modelOverride?.toLowerCase().includes('gemini') || (images && images.length > 0))) {
    try {
      callbacks.onMeta?.({ requestId, provider: 'gemini', model: 'gemini-2.5-flash', tier: routing.tier });
      const imageParts = (images || []).map(img => ({
        inlineData: {
          mimeType: img.mimeType || 'image/jpeg',
          data: (img.data || '').replace(/^data:[^;]+;base64,/, '')
        }
      }));

      const contents = [
        ...history.slice(-8).map(h => ({
          role: h.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: String(h.content || '') }]
        })),
        {
          role: 'user',
          parts: [
            ...imageParts,
            { text: prompt }
          ]
        }
      ];

      const config: any = {
        temperature,
        systemInstruction,
        maxOutputTokens: Math.max(effectiveMaxTokens, 1200)
      };

      const stream = await gemini.models.generateContentStream({
        model: 'gemini-2.5-flash',
        contents,
        config
      });

      let fullText = '';
      let firstTokenLatencyMs: number | null = null;
      for await (const chunk of stream) {
        if (abortSignal?.aborted) break;
        const piece = chunk.text || '';
        if (piece) {
          if (firstTokenLatencyMs === null) {
            firstTokenLatencyMs = Date.now() - requestStart;
          }
          fullText += piece;
          callbacks.onToken(piece, firstTokenLatencyMs);
        }
      }
      const telemetry: AIPerformanceTelemetry = {
        requestId,
        providerUsed: 'gemini',
        modelUsed: 'gemini-2.5-flash',
        complexityTier: routing.tier,
        requestStart,
        firstTokenLatencyMs,
        totalGenerationTimeMs: Date.now() - requestStart,
        retries: 0,
        fallbackTriggered: !providerKeyAvailable,
        streamed: true
      };
      callbacks.onComplete?.(fullText, telemetry);
      return { text: fullText, telemetry };
    } catch (gErr: any) {
      console.warn('[Gemini Stream Engine] Call error:', gErr?.message || gErr);
      if (!providerKeyAvailable) throw gErr;
    }
  }

  async function tryStreamOnce(
    p: 'apinex' | 'groq' | 'ministral',
    m: string,
    customMaxTokens?: number
  ): Promise<{ fullText: string; firstTokenLatencyMs: number | null; finishReason?: string }> {
    const { apiUrl: targetUrl, apiKey } = getProviderEndpointAndKey(p);

    if (!apiKey) {
      const keyName =
        p === 'groq'
          ? 'GROQ_API_KEY'
          : p === 'ministral'
          ? 'MINISTRAL_API_KEY'
          : 'APINEX_API_KEY';
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

    const response = await fetch(targetUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: m,
        messages,
        temperature,
        max_tokens: customMaxTokens || effectiveMaxTokens,
        stream: true
      }),
      signal: abortSignal
    });

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
  let finalProvider: 'apinex' | 'groq' | 'ministral' = activeProvider;

  if (activeProvider === 'ministral' || routing.tier === 'complex') {
    finalProvider = 'ministral';
    activeModel = 'ministral-8b-2410';
    try {
      streamResult = await tryStreamOnce('ministral', activeModel);
    } catch (mErr: any) {
      console.warn('[AI_STREAM_ROUTER] Ministral stream notice:', mErr?.message || mErr, '- attempting fallback to Groq/APInex');
      // Controlled fallback to Groq or APInex
      const groqKey = getGroqApiKey();
      if (groqKey) {
        try {
          finalProvider = 'groq';
          activeModel = getNextGroqModel();
          streamResult = await tryStreamOnce('groq', activeModel);
        } catch (_) {}
      }
      if (!streamResult || !streamResult.fullText.trim()) {
        finalProvider = 'apinex';
        activeModel = 'free/gpt-6-luna';
        streamResult = await tryStreamOnce('apinex', activeModel);
      }
    }
  } else if (activeProvider === 'groq') {
    const candidateModels = [activeModel, ...groqModels.filter((m) => m !== activeModel)];
    let lastErr: any = null;
    for (let i = 0; i < candidateModels.length; i++) {
      activeModel = candidateModels[i];
      if (i > 0) retries++;
      try {
        streamResult = await tryStreamOnce('groq', activeModel);
        if (streamResult.fullText.trim()) {
          break;
        }
      } catch (err: any) {
        lastErr = err;
        if (err?.status === 401 || err?.status === 403) break;
      }
    }
    if (!streamResult || !streamResult.fullText.trim()) {
      // Controlled fallback to APInex
      try {
        finalProvider = 'apinex';
        activeModel = 'free/gpt-6-luna';
        streamResult = await tryStreamOnce('apinex', activeModel);
      } catch {
        if (lastErr) throw lastErr;
        const err: any = new Error(`Groq HTTP 200 returned empty stream content for ${activeModel}.`);
        err.status = 502;
        err.providerUsed = 'groq';
        err.modelUsed = activeModel;
        throw err;
      }
    }
  } else {
    streamResult = await tryStreamOnce(activeProvider, activeModel);
    if (!streamResult.fullText.trim()) {
      const err: any = new Error(`${activeProvider} HTTP 200 returned empty stream content.`);
      err.status = 502;
      err.providerUsed = activeProvider;
      err.modelUsed = activeModel;
      throw err;
    }
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
