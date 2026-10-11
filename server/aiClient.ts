/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * StudentOS Multi-Provider AI Routing Engine
 * Fallback Chain: APInex -> Ministral -> Groq (with model rotation: llama-3.1-8b-instant, gpt-oss-120b, qwen3.8-27b)
 * Long Reasoning & Large Context: Nara Router / NVIDIA models.
 */

import dotenv from 'dotenv';
dotenv.config();

export type TaskComplexityTier = 'fast' | 'general' | 'complex' | 'tool';

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

// Groq Model Rotation Manager (llama-3.1-8b-instant, gpt-oss-120b, qwen3.8-27b)
const groqModels = ['llama-3.1-8b-instant', 'gpt-oss-120b', 'qwen3.8-27b'];
let groqModelIndex = 0;
export function getNextGroqModel(): string {
  const model = groqModels[groqModelIndex % groqModels.length];
  groqModelIndex++;
  return model;
}

// Task Complexity & Provider Routing Policy
export function classifyTaskComplexity(
  prompt: string,
  ctx?: ModelRoutingContext
): { provider: 'apinex' | 'groq' | 'ministral' | 'nara_router'; model: string; tier: TaskComplexityTier } {
  const cleanPrompt = (prompt || '').trim();
  const lower = cleanPrompt.toLowerCase();
  const endpoint = (ctx?.endpointName || '').toLowerCase();
  const taskType = ctx?.taskType;
  const override = (ctx?.modelOverride || '').trim().toLowerCase();

  if (override.includes('nara') || override.includes('nvidia') || override.includes('lightning') || override.includes('ultra')) {
    const model = override.includes('ultra') ? 'nvidia/nemotron-3-ultra-550b-a55b' : 'nvidia/nemotron-3-super-120b-a12b';
    return { provider: 'nara_router', model, tier: 'complex' };
  }
  if (override.includes('groq') || override.includes('llama') || override.includes('qwen') || override.includes('gpt-oss')) {
    return { provider: 'groq', model: getNextGroqModel(), tier: 'fast' };
  }
  if (override.includes('ministral')) {
    return { provider: 'ministral', model: 'ministral-8b-2410', tier: 'general' };
  }

  // Complex reasoning -> Nara Router if key present
  const complexPatterns = [
    /\b(prove|proof|derive|derivation|theorem|calculus|integral|differential|eigenvalue|matrix|trigonometric identity|quantum|thermodynamics|stoichiometry)\b/i,
    /\b(multi-step|comprehensive analysis|school-wide analytics|deep analysis|detailed academic report)\b/i
  ];

  const isComplex =
    taskType === 'complex' ||
    complexPatterns.some(regex => regex.test(lower)) ||
    cleanPrompt.length > 2500;

  if (isComplex && getNaraRouterApiKey()) {
    return {
      provider: 'nara_router',
      model: 'nvidia/nemotron-3-super-120b-a12b',
      tier: 'complex'
    };
  }

  // Default Primary: APInex
  return { provider: 'apinex', model: 'free/gpt-6-luna', tier: 'general' };
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
    return delta.content; // Preserves leading spaces and whitespace tokens correctly
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

// Fallback Chain: APInex -> Ministral -> Groq (with model rotation)
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
      history: param3,
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
  const routing = classifyTaskComplexity(prompt, { endpointName, taskType, modelOverride, userRole, mode, persona, contextLength });

  let provider = routing.provider;
  let model = routing.model;
  let fallbackTriggered = false;
  let retries = 0;

  const messages = buildMessagesArray(systemInstruction, prompt, history);
  const effectiveMaxTokens = maxTokens ? Math.max(maxTokens, 300) : (routing.tier === 'fast' ? 1200 : 2048);

  console.log(`[AI_REQUEST] initial_provider=${provider} model=${model} requestId=${requestId}`);

  async function callProvider(p: string, m: string): Promise<string | null> {
    try {
      let apiUrl = '';
      let apiKey = '';

      if (p === 'apinex') {
        apiUrl = 'https://api.apinex.bond/v1/chat/completions';
        apiKey = getApinexApiKey();
      } else if (p === 'ministral') {
        apiUrl = 'https://api.mistral.ai/v1/chat/completions';
        apiKey = getMinistralApiKey();
      } else if (p === 'groq') {
        apiUrl = 'https://api.groq.com/openai/v1/chat/completions';
        apiKey = getGroqApiKey();
      } else if (p === 'nara_router') {
        apiUrl = `${process.env.NARA_ROUTER_BASE_URL || 'https://router.bynara.id/v1/combo/free'}/chat/completions`;
        apiKey = getNaraRouterApiKey();
      }

      if (!apiKey) return null;

      const resp = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
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
      }
    } catch (err) {
      console.warn(`[AI Provider ${p} (${m}) failed]:`, err);
    }
    return null;
  }

  let text: string | null = null;

  // 1. Try Primary Routing (APInex or Nara Router if complex)
  text = await callProvider(provider, model);

  // 2. Fallback Chain: APInex -> Ministral -> Groq (with model rotation)
  if (!text) {
    fallbackTriggered = true;
    console.log(`[AI_FALLBACK] Primary provider ${provider} failed or unavailable. Trying First Fallback: Ministral...`);
    
    // Try Ministral
    text = await callProvider('ministral', 'ministral-8b-2410');
    if (text) {
      provider = 'ministral';
      model = 'ministral-8b-2410';
    }
  }

  if (!text) {
    console.log(`[AI_FALLBACK] Ministral unavailable. Trying Second Fallback: Groq with model rotation...`);
    // Try Groq with model rotation across llama-3.1-8b-instant, gpt-oss-120b, qwen3.8-27b
    for (let i = 0; i < groqModels.length; i++) {
      const groqModel = getNextGroqModel();
      text = await callProvider('groq', groqModel);
      if (text) {
        provider = 'groq';
        model = groqModel;
        break;
      }
    }
  }

  if (!text) {
    // Ultimate fallback to APInex default
    console.log(`[AI_FALLBACK] All fallbacks exhausted. Final fallback to APInex gpt-6-luna...`);
    provider = 'apinex';
    model = 'free/gpt-6-luna';
    text = await callProvider('apinex', model);
  }

  if (!text) {
    throw new Error('[AI ERROR] All AI providers (APInex, Ministral, Groq, Nara Router) failed to return a valid response.');
  }

  const telemetry: AIPerformanceTelemetry = {
    requestId,
    providerUsed: provider as any,
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
  const routing = classifyTaskComplexity(prompt, { endpointName, taskType, modelOverride, userRole, mode, persona, contextLength });

  const provider = routing.provider;
  const model = routing.model;

  const messages = buildMessagesArray(systemInstruction, prompt, history);
  const effectiveMaxTokens = maxTokens ? Math.max(maxTokens, 300) : 2048;

  const apinexKey = getApinexApiKey();
  if (!apinexKey) {
    throw new Error('[APINEX CONFIG ERROR] APINEX_API_KEY is not configured.');
  }

  try {
    callbacks.onMeta?.({ requestId, provider, model, tier: routing.tier });

    const response = await fetch('https://api.apinex.bond/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apinexKey}`,
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream'
      },
      body: JSON.stringify({
        model: 'free/gpt-6-luna',
        messages,
        temperature,
        max_tokens: effectiveMaxTokens,
        stream: true
      }),
      signal: abortSignal
    });

    if (!response.ok || !response.body) {
      throw new Error(`Stream HTTP error status ${response.status}`);
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
            fullText += token; // Correctly preserves leading spaces and whitespace tokens
            callbacks.onToken(token, firstTokenLatencyMs);
          }
        } catch {}
      }
    }

    const telemetry: AIPerformanceTelemetry = {
      requestId,
      providerUsed: 'apinex',
      modelUsed: 'free/gpt-6-luna',
      complexityTier: routing.tier,
      requestStart,
      firstTokenLatencyMs: firstTokenLatencyMs ?? (Date.now() - requestStart),
      totalGenerationTimeMs: Date.now() - requestStart,
      retries: 0,
      fallbackTriggered: false,
      streamed: true
    };

    callbacks.onComplete?.(fullText, telemetry);
    return { text: fullText, telemetry };
  } catch (err: any) {
    if (abortSignal?.aborted) throw err;
    throw new Error(err?.message || 'Stream completion failed.');
  }
}
