/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Central AI Provider Service for StudentOS
 * APInex (Primary) -> NVIDIA (Fallback ONLY for genuine 5xx / 429 / outages)
 * ZERO Gemini / OpenRouter dependencies.
 *
 * APInex Configuration:
 * Base URL: https://api.apinex.bond/v1
 * Chat Endpoint: POST https://api.apinex.bond/v1/chat/completions
 * Primary Models:
 * - gpt-6-luna (Fast / general conversational tasks)
 * - deepseek-v4-pro (Complex reasoning / planning / STEM)
 * - glm-5.3-flash (Fast tool / agent / structured JSON output)
 */

import dotenv from 'dotenv';
dotenv.config();

export type ApinexModel = 'gpt-6-luna' | 'deepseek-v4-pro' | 'glm-5.3-flash';
export type NvidiaModel = 'nvidia/nemotron-3-super-120b-a12b' | 'nvidia/nemotron-3-ultra-550b-a55b' | 'openai/gpt-oss-20b';

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
  providerUsed: 'apinex' | 'nvidia';
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

export function getNvidiaApiKey(): string {
  const rawKey =
    process.env.NVIDIA_API_KEY ||
    process.env.VITE_NVIDIA_API_KEY ||
    process.env.NIM_API_KEY ||
    process.env.NGC_API_KEY ||
    process.env.AI_API_KEY ||
    '';
  return rawKey.trim().replace(/^["']|["']$/g, '');
}

/**
 * Validates whether a model string is a supported APInex model ID.
 * Prevents NVIDIA model overrides (e.g. nvidia/nemotron-...) from being sent to APInex.
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
 * Ignores modelOverride if it contains an NVIDIA/OpenAI model ID.
 */
export function resolveApinexModel(modelOverride?: string, fallbackModel: ApinexModel = 'gpt-6-luna'): string {
  if (modelOverride && isApinexModel(modelOverride)) {
    return modelOverride.trim();
  }
  return fallbackModel;
}

/**
 * Task-based model routing for APInex and NVIDIA.
 */
export function classifyTaskComplexity(
  prompt: string,
  ctx?: ModelRoutingContext
): { apinexModel: ApinexModel; nvidiaModel: NvidiaModel; tier: TaskComplexityTier } {
  const cleanPrompt = (prompt || '').trim();
  const lower = cleanPrompt.toLowerCase();
  const endpoint = (ctx?.endpointName || '').toLowerCase();
  const taskType = ctx?.taskType;

  // Explicit tool/agent/JSON task
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
    return {
      apinexModel: 'glm-5.3-flash',
      nvidiaModel: 'openai/gpt-oss-20b',
      tier: 'tool'
    };
  }

  // Complex reasoning
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
    return {
      apinexModel: 'deepseek-v4-pro',
      nvidiaModel: 'nvidia/nemotron-3-ultra-550b-a55b',
      tier: 'complex'
    };
  }

  // Fast / simple (e.g., "Hi", "Hello", short questions)
  const isFast =
    taskType === 'fast' ||
    cleanPrompt.split(/\s+/).length <= 15 ||
    /^(hi|hello|hey|good morning|thanks|thank you|ok|okay|who are you|help)\b/i.test(lower);

  if (isFast) {
    return {
      apinexModel: 'gpt-6-luna',
      nvidiaModel: 'openai/gpt-oss-20b',
      tier: 'fast'
    };
  }

  // Default general
  return {
    apinexModel: 'gpt-6-luna',
    nvidiaModel: 'nvidia/nemotron-3-super-120b-a12b',
    tier: 'general'
  };
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
 * Primary: APInex (https://api.apinex.bond/v1)
 * Fallback: NVIDIA API
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
  const nvidiaKey = getNvidiaApiKey();

  const { apinexModel, nvidiaModel, tier } = classifyTaskComplexity(prompt, {
    endpointName,
    taskType,
    modelOverride,
    userRole,
    mode,
    persona,
    contextLength
  });

  // CRITICAL FIX 1: Ignore modelOverride if it's an NVIDIA model ID, use proper APInex model ID
  const effectiveApinexModel = resolveApinexModel(modelOverride, apinexModel);
  const messages = buildMessagesArray(systemInstruction, prompt, history);
  const effectiveMaxTokens = maxTokens || (tier === 'fast' ? 900 : tier === 'complex' ? 3200 : 2048);

  console.log(`[AI_REQUEST] provider=apinex model=${effectiveApinexModel} requestId=${requestId}`);

  if (!apinexKey) {
    console.error(`[APINEX CONFIG ERROR] APINEX_API_KEY environment variable is missing on server. requestId=${requestId}`);
    if (!nvidiaKey) {
      throw new Error('[APINEX CONFIG ERROR] APINEX_API_KEY is not configured on the server. Please add APINEX_API_KEY to your server environment.');
    }
    console.log(`[AI_FALLBACK] from=apinex to=nvidia reason="APINEX_API_KEY missing" requestId=${requestId}`);
  } else {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 22000);

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
        
        // CRITICAL FIX 2: Check content, reasoning, AND reasoning_content for APInex models
        const text = (
          choiceMsg?.content ||
          choiceMsg?.reasoning ||
          choiceMsg?.reasoning_content ||
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
          console.warn(`[APINEX WARN] APInex returned HTTP 200 but choice message content/reasoning was empty. requestId=${requestId}`);
        }
      } else {
        const errBody = await resp.text().catch(() => '');
        console.error(`[APINEX HTTP ERROR] status=${resp.status} requestId=${requestId} body=${errBody.slice(0, 200)}`);
        
        // CRITICAL FIX 3: DO NOT Fallback on 400, 401, 403, 404
        if (resp.status === 400 || resp.status === 401 || resp.status === 403 || resp.status === 404) {
          throw new Error(`[APINEX ${resp.status} ERROR] HTTP ${resp.status}: ${errBody.slice(0, 160) || 'APInex API Error'}`);
        }

        // Only fallback for genuine 5xx / 429
        console.log(`[AI_FALLBACK] from=apinex to=nvidia reason="APInex HTTP ${resp.status}" requestId=${requestId}`);
      }
    } catch (apinexErr: any) {
      if (apinexErr?.message?.includes('APINEX')) {
        throw apinexErr;
      }
      console.warn(`[AI_FALLBACK] from=apinex to=nvidia reason="${apinexErr?.message || apinexErr}" requestId=${requestId}`);
    }
  }

  // 2. FALLBACK ONLY: NVIDIA API (For genuine 5xx / outages)
  if (nvidiaKey) {
    try {
      console.log(`[AI_REQUEST] provider=nvidia model=${nvidiaModel} requestId=${requestId}`);
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 28000);

      const resp = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${nvidiaKey}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          model: nvidiaModel,
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
        const text = (
          choiceMsg?.content ||
          choiceMsg?.reasoning ||
          choiceMsg?.reasoning_content ||
          ''
        ).trim();

        if (text) {
          const telemetry: AIPerformanceTelemetry = {
            requestId,
            providerUsed: 'nvidia',
            modelUsed: nvidiaModel,
            complexityTier: tier,
            requestStart,
            firstTokenLatencyMs: Date.now() - requestStart,
            totalGenerationTimeMs: Date.now() - requestStart,
            retries: 1,
            fallbackTriggered: true,
            streamed: false
          };
          console.log(`[AI_RESPONSE] provider=nvidia model=${nvidiaModel} status=200 requestId=${requestId} durationMs=${telemetry.totalGenerationTimeMs}`);
          return { text, telemetry };
        }
      }
    } catch (nvidiaErr: any) {
      console.error(`[NVIDIA FALLBACK ERROR] requestId=${requestId}:`, nvidiaErr?.message || nvidiaErr);
    }
  }

  throw new Error('APInex AI is currently unavailable or improperly configured. Please check your APINEX_API_KEY environment variable.');
}

/**
 * Server-Side Streaming Completion Engine.
 * APInex (Primary) -> NVIDIA (Fallback)
 */
export async function streamAICompletion(
  options: AICompletionOptions,
  callbacks: {
    onMeta?: (meta: { requestId: string; provider: 'apinex' | 'nvidia'; model: string; tier: TaskComplexityTier }) => void;
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
  const nvidiaKey = getNvidiaApiKey();

  const { apinexModel, nvidiaModel, tier } = classifyTaskComplexity(prompt, {
    endpointName,
    taskType,
    modelOverride,
    userRole,
    mode,
    persona,
    contextLength
  });

  // CRITICAL FIX 1: Ignore modelOverride if it's an NVIDIA model ID, use proper APInex model ID
  const effectiveApinexModel = resolveApinexModel(modelOverride, apinexModel);
  const messages = buildMessagesArray(systemInstruction, prompt, history);
  const effectiveMaxTokens = maxTokens || (tier === 'fast' ? 950 : 2048);

  console.log(`[AI_REQUEST] provider=apinex model=${effectiveApinexModel} stream=true requestId=${requestId}`);

  if (!apinexKey) {
    console.error(`[APINEX CONFIG ERROR] APINEX_API_KEY environment variable is missing on server. requestId=${requestId}`);
    if (!nvidiaKey) {
      throw new Error('[APINEX CONFIG ERROR] APINEX_API_KEY is not configured on the server.');
    }
    console.log(`[AI_FALLBACK] from=apinex to=nvidia reason="APINEX_API_KEY missing" requestId=${requestId}`);
  } else {
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
        
        // CRITICAL FIX 3: DO NOT Fallback on 400, 401, 403, 404
        if (response.status === 400 || response.status === 401 || response.status === 403 || response.status === 404) {
          throw new Error(`[APINEX ${response.status} ERROR] HTTP ${response.status}: ${errText.slice(0, 160) || 'APInex API Error'}`);
        }

        console.log(`[AI_FALLBACK] from=apinex to=nvidia reason="APInex Stream HTTP ${response.status}" requestId=${requestId}`);
      } else if (response.body) {
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
              
              // CRITICAL FIX 2: Check content, reasoning, AND reasoning_content in streaming delta
              const token = (
                delta?.content ||
                delta?.reasoning ||
                delta?.reasoning_content ||
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
        }
      }
    } catch (apinexErr: any) {
      if (abortSignal?.aborted) throw apinexErr;
      if (apinexErr?.message?.includes('APINEX')) {
        throw apinexErr;
      }
      console.warn(`[AI_FALLBACK] from=apinex to=nvidia reason="${apinexErr?.message || apinexErr}" requestId=${requestId}`);
    }
  }

  // 2. FALLBACK ONLY: NVIDIA Streaming
  if (nvidiaKey) {
    try {
      console.log(`[AI_REQUEST] provider=nvidia model=${nvidiaModel} stream=true requestId=${requestId}`);
      const response = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${nvidiaKey}`,
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream'
        },
        body: JSON.stringify({
          model: nvidiaModel,
          messages,
          temperature,
          max_tokens: effectiveMaxTokens,
          stream: true
        }),
        signal: abortSignal
      });

      if (response.ok && response.body) {
        callbacks.onMeta?.({ requestId, provider: 'nvidia', model: nvidiaModel, tier });

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
              const token = (
                delta?.content ||
                delta?.reasoning ||
                delta?.reasoning_content ||
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
            providerUsed: 'nvidia',
            modelUsed: nvidiaModel,
            complexityTier: tier,
            requestStart,
            firstTokenLatencyMs: firstTokenLatencyMs ?? (Date.now() - requestStart),
            totalGenerationTimeMs: Date.now() - requestStart,
            retries: 1,
            fallbackTriggered: true,
            streamed: true
          };
          console.log(`[AI_RESPONSE] provider=nvidia model=${nvidiaModel} status=200 stream=true requestId=${requestId} durationMs=${telemetry.totalGenerationTimeMs}`);
          callbacks.onComplete?.(fullText, telemetry);
          return { text: fullText, telemetry };
        }
      }
    } catch (nvidiaErr: any) {
      if (abortSignal?.aborted) throw nvidiaErr;
      console.error(`[NVIDIA STREAM FALLBACK ERROR]:`, nvidiaErr?.message || nvidiaErr);
    }
  }

  throw new Error('APInex AI is currently unavailable or improperly configured. Please check your APINEX_API_KEY environment variable.');
}
