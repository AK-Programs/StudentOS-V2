/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Central AI Provider Service for StudentOS
 * Powered EXCLUSIVELY by APInex (https://api.apinex.bond/v1).
 *
 * Approved APInex Models:
 * - gpt-6-luna (Normal and short conversational AI Buddy chat)
 * - deepseek-v4-pro (Hard math, proof, STEM, or long reasoning)
 * - glm-5.3-flash (JSON, flashcards, diagrams, 3D, and agent tools)
 */

import dotenv from 'dotenv';
dotenv.config();

export type ApinexModel = 'gpt-6-luna' | 'deepseek-v4-pro' | 'glm-5.3-flash';
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
  providerUsed: 'apinex';
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

export function getApinexApiKey(): string {
  const rawKey =
    process.env.APINEX_API_KEY ||
    process.env.VITE_APINEX_API_KEY ||
    '';
  return rawKey.trim().replace(/^["']|["']$/g, '');
}

/**
 * Validates whether a model string is a supported APInex model ID.
 * Ignores non-APInex overrides (e.g. nvidia/nemotron-...).
 */
export function isApinexModel(modelName?: string): boolean {
  if (!modelName || typeof modelName !== 'string') return false;
  const clean = modelName.trim().toLowerCase();
  const validApinexModels = [
    'gpt-6-luna',
    'deepseek-v4-pro',
    'glm-5.3-flash',
    'free/gpt-6-luna',
    'free/glm-5.3-flash'
  ];
  return validApinexModels.includes(clean) || clean.startsWith('free/');
}

/**
 * Resolves the appropriate APInex model to use.
 * Only accepts modelOverride if it is one of: gpt-6-luna, deepseek-v4-pro, glm-5.3-flash.
 */
export function resolveApinexModel(modelOverride?: string, fallbackModel: ApinexModel = 'gpt-6-luna'): string {
  if (modelOverride && isApinexModel(modelOverride)) {
    return modelOverride.trim();
  }
  return fallbackModel;
}

/**
 * Task-based APInex Model Routing.
 * - Normal and short AI Buddy chat: gpt-6-luna
 * - Hard math, proof, or long reasoning: deepseek-v4-pro
 * - JSON, flashcards, or diagrams: glm-5.3-flash
 */
export function classifyTaskComplexity(
  prompt: string,
  ctx?: ModelRoutingContext
): { apinexModel: ApinexModel; tier: TaskComplexityTier } {
  const cleanPrompt = (prompt || '').trim();
  const lower = cleanPrompt.toLowerCase();
  const endpoint = (ctx?.endpointName || '').toLowerCase();
  const taskType = ctx?.taskType;

  // Tool / JSON / Diagram / Flashcard / 3D task -> glm-5.3-flash
  if (
    taskType === 'tool' ||
    endpoint.includes('json') ||
    endpoint.includes('diagram') ||
    endpoint.includes('mermaid') ||
    endpoint.includes('3d') ||
    endpoint.includes('flashcard') ||
    lower.includes('json') ||
    lower.includes('structured output')
  ) {
    return { apinexModel: 'glm-5.3-flash', tier: 'tool' };
  }

  // Complex reasoning / STEM proof / Calculus -> deepseek-v4-pro
  const complexPatterns = [
    /\b(prove|proof|derive|derivation|theorem|calculus|integral|differential|eigenvalue|matrix|trigonometric identity|quadratic formula proof|quantum|thermodynamics|stoichiometry|electrochemistry|organic synthesis)\b/i,
    /\b(multi-step|comprehensive analysis|school-wide analytics|deep analysis|detailed academic report|correlate|regression|comparative analysis|root cause)\b/i,
    /\b(solve step by step|system of equations|simultaneous equations|polynomial|logarithm|vector calculus|complex number)\b/i
  ];

  const isComplex =
    taskType === 'complex' ||
    complexPatterns.some(regex => regex.test(lower)) ||
    cleanPrompt.length > 2500;

  if (isComplex) {
    return { apinexModel: 'deepseek-v4-pro', tier: 'complex' };
  }

  // Fast / Short / Normal Chat -> gpt-6-luna
  const isFast =
    taskType === 'fast' ||
    cleanPrompt.split(/\s+/).length <= 15 ||
    /^(hi|hello|hey|good morning|thanks|thank you|ok|okay|who are you|help)\b/i.test(lower);

  if (isFast) {
    return { apinexModel: 'gpt-6-luna', tier: 'fast' };
  }

  // Default general chat -> gpt-6-luna
  return { apinexModel: 'gpt-6-luna', tier: 'general' };
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

/**
 * Universal Central AI Completion Engine.
 * Powered EXCLUSIVELY by APInex (https://api.apinex.bond/v1).
 */
export async function generateAICompletion(
  param1: string | AICompletionOptions,
  param2?: string,
  param3: any[] = []
): Promise<string> {
  const result = await generateAICompletionWithTelemetry(param1, param2, param3);
  return result.text;
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
  const apinexKey = getApinexApiKey();

  const { apinexModel, tier } = classifyTaskComplexity(prompt, {
    endpointName,
    taskType,
    modelOverride,
    userRole,
    mode,
    persona,
    contextLength
  });

  // Ignore modelOverride unless it is gpt-6-luna, deepseek-v4-pro, or glm-5.3-flash
  const effectiveApinexModel = resolveApinexModel(modelOverride, apinexModel);
  const messages = buildMessagesArray(systemInstruction, prompt, history);
  const effectiveMaxTokens = maxTokens || (tier === 'fast' ? 900 : tier === 'complex' ? 3200 : 2048);

  console.log(`[AI_REQUEST] provider=apinex model=${effectiveApinexModel} requestId=${requestId}`);

  if (!apinexKey) {
    console.error(`[APINEX CONFIG ERROR] APINEX_API_KEY environment variable is missing on server. requestId=${requestId}`);
    throw new Error('[APINEX CONFIG ERROR] APINEX_API_KEY environment variable is not configured on the server.');
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 25000);

  try {
    const resp = await fetch('https://api.apinex.bond/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apinexKey}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        model: effectiveApinexModel,
        messages,
        temperature,
        max_tokens: effectiveMaxTokens,
        ...(jsonMode ? { response_format: { type: 'json_object' } } : {})
      }),
      signal: controller.signal
    });

    clearTimeout(timer);

    if (resp.ok) {
      const data = await resp.json();
      const choiceMsg = data.choices?.[0]?.message;

      // Read first non-empty reply field: content, reasoning_content, or reasoning
      const text = (
        choiceMsg?.content ||
        choiceMsg?.reasoning_content ||
        choiceMsg?.reasoning ||
        ''
      ).trim();

      if (text) {
        const telemetry: AIPerformanceTelemetry = {
          requestId,
          providerUsed: 'apinex',
          modelUsed: effectiveApinexModel,
          complexityTier: tier,
          requestStart,
          firstTokenLatencyMs: Date.now() - requestStart,
          totalGenerationTimeMs: Date.now() - requestStart,
          retries: 0,
          fallbackTriggered: false,
          streamed: false
        };
        console.log(`[AI_RESPONSE] provider=apinex model=${effectiveApinexModel} status=200 requestId=${requestId} durationMs=${telemetry.totalGenerationTimeMs}`);
        return { text, telemetry };
      } else {
        throw new Error('[APINEX RESPONSE ERROR] APInex returned HTTP 200 but response content/reasoning fields were empty.');
      }
    } else {
      const errBody = await resp.text().catch(() => '');
      console.error(`[APINEX HTTP ERROR] status=${resp.status} requestId=${requestId} body=${errBody.slice(0, 200)}`);
      throw new Error(`[APINEX HTTP ${resp.status} ERROR] ${errBody.slice(0, 180) || 'APInex request failed'}`);
    }
  } catch (apinexErr: any) {
    clearTimeout(timer);
    console.error(`[APINEX ERROR] requestId=${requestId}:`, apinexErr?.message || apinexErr);
    throw new Error(apinexErr?.message || 'APInex AI request failed.');
  }
}

/**
 * Server-Side Streaming Completion Engine.
 * Powered EXCLUSIVELY by APInex (https://api.apinex.bond/v1).
 */
export async function streamAICompletion(
  options: AICompletionOptions,
  callbacks: {
    onMeta?: (meta: { requestId: string; provider: 'apinex'; model: string; tier: TaskComplexityTier }) => void;
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
  const apinexKey = getApinexApiKey();

  const { apinexModel, tier } = classifyTaskComplexity(prompt, {
    endpointName,
    taskType,
    modelOverride,
    userRole,
    mode,
    persona,
    contextLength
  });

  // Ignore modelOverride unless it is gpt-6-luna, deepseek-v4-pro, or glm-5.3-flash
  const effectiveApinexModel = resolveApinexModel(modelOverride, apinexModel);
  const messages = buildMessagesArray(systemInstruction, prompt, history);
  const effectiveMaxTokens = maxTokens || (tier === 'fast' ? 950 : 2048);

  console.log(`[AI_REQUEST] provider=apinex model=${effectiveApinexModel} stream=true requestId=${requestId}`);

  if (!apinexKey) {
    console.error(`[APINEX CONFIG ERROR] APINEX_API_KEY environment variable is missing on server. requestId=${requestId}`);
    throw new Error('[APINEX CONFIG ERROR] APINEX_API_KEY environment variable is not configured on the server.');
  }

  try {
    const response = await fetch('https://api.apinex.bond/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apinexKey}`,
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream'
      },
      body: JSON.stringify({
        model: effectiveApinexModel,
        messages,
        temperature,
        max_tokens: effectiveMaxTokens,
        stream: true
      }),
      signal: abortSignal
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      console.error(`[APINEX STREAM HTTP ERROR] status=${response.status} requestId=${requestId} body=${errText.slice(0, 180)}`);
      throw new Error(`[APINEX HTTP ${response.status} ERROR] ${errText.slice(0, 160) || 'APInex stream request failed'}`);
    }

    if (!response.body) {
      throw new Error('[APINEX STREAM ERROR] APInex stream response body is empty.');
    }

    callbacks.onMeta?.({ requestId, provider: 'apinex', model: effectiveApinexModel, tier });

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
          const delta = parsed.choices?.[0]?.delta;

          // Read first non-empty delta field: content, reasoning_content, or reasoning
          const token = (
            delta?.content ||
            delta?.reasoning_content ||
            delta?.reasoning ||
            ''
          );

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

    if (fullText.trim().length > 0) {
      const telemetry: AIPerformanceTelemetry = {
        requestId,
        providerUsed: 'apinex',
        modelUsed: effectiveApinexModel,
        complexityTier: tier,
        requestStart,
        firstTokenLatencyMs: firstTokenLatencyMs ?? (Date.now() - requestStart),
        totalGenerationTimeMs: Date.now() - requestStart,
        retries: 0,
        fallbackTriggered: false,
        streamed: true
      };
      console.log(`[AI_RESPONSE] provider=apinex model=${effectiveApinexModel} status=200 stream=true requestId=${requestId} durationMs=${telemetry.totalGenerationTimeMs}`);
      callbacks.onComplete?.(fullText, telemetry);
      return { text: fullText, telemetry };
    } else {
      throw new Error('[APINEX STREAM ERROR] Stream finished without returning any text tokens.');
    }
  } catch (apinexErr: any) {
    if (abortSignal?.aborted) throw apinexErr;
    console.error(`[APINEX STREAM ERROR] requestId=${requestId}:`, apinexErr?.message || apinexErr);
    throw new Error(apinexErr?.message || 'APInex stream request failed.');
  }
}
