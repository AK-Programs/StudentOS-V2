/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * NVIDIA API Central AI Service for StudentOS
 * Exclusively uses official NVIDIA API (https://integrate.api.nvidia.com/v1/chat/completions)
 * Approved Models:
 * 1. openai/gpt-oss-20b (Fast Tasks: greetings, simple explanations, short summaries, basic lookups)
 * 2. nvidia/nemotron-3-super-120b-a12b (General Tasks: normal student/teacher questions, lesson explanations, study planning, normal reports)
 * 3. nvidia/nemotron-3-ultra-550b-a55b (Complex Tasks: complex reasoning, difficult math/derivations, multi-step analysis, complex Orion workflows)
 */

export type NvidiaModel =
  | 'nvidia/nemotron-3-super-120b-a12b'
  | 'nvidia/nemotron-3-ultra-550b-a55b'
  | 'openai/gpt-oss-20b';

export const ALLOWED_NVIDIA_MODELS: readonly NvidiaModel[] = [
  'openai/gpt-oss-20b',
  'nvidia/nemotron-3-super-120b-a12b',
  'nvidia/nemotron-3-ultra-550b-a55b'
] as const;

export type TaskComplexityTier = 'fast' | 'general' | 'complex';

export interface ModelRoutingContext {
  endpointName?: string;
  taskType?: string;
  modelOverride?: string;
  userRole?: string;
  mode?: string;
  persona?: string;
  contextLength?: number;
  historyLength?: number;
}

export interface AIPerformanceTelemetry {
  requestId: string;
  modelUsed: NvidiaModel;
  complexityTier: TaskComplexityTier;
  requestStart: number;
  firstTokenLatencyMs: number | null;
  totalGenerationTimeMs: number;
  dataRetrievalLatencyMs?: number;
  toolExecutionLatencyMs?: number;
  retries: number;
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
  taskType?: string;
  requestId?: string;
  userRole?: string;
  mode?: string;
  persona?: string;
  contextLength?: number;
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
 * Classifies a request into 'fast', 'general', or 'complex' based on
 * user role, prompt complexity, mathematical depth, context volume, and latency needs.
 */
export function classifyTaskComplexity(
  prompt: string,
  ctx?: ModelRoutingContext
): { model: NvidiaModel; tier: TaskComplexityTier } {
  if (ctx?.modelOverride && (ALLOWED_NVIDIA_MODELS as readonly string[]).includes(ctx.modelOverride)) {
    const m = ctx.modelOverride as NvidiaModel;
    const tier: TaskComplexityTier =
      m === 'openai/gpt-oss-20b' ? 'fast' : m === 'nvidia/nemotron-3-ultra-550b-a55b' ? 'complex' : 'general';
    return { model: m, tier };
  }

  const cleanPrompt = (prompt || '').trim();
  const lower = cleanPrompt.toLowerCase();
  const endpoint = (ctx?.endpointName || '').toLowerCase();
  const taskType = (ctx?.taskType || '').toLowerCase();
  const wordCount = cleanPrompt.split(/\s+/).filter(Boolean).length;
  const contextSize = (ctx?.contextLength || 0) + cleanPrompt.length;

  // 1. Explicit Fast / Lightweight endpoints & tasks
  if (
    taskType === 'fast' ||
    endpoint.includes('minimal') ||
    endpoint.includes('diagnostic') ||
    endpoint.includes('moderation') ||
    endpoint.includes('classify') ||
    endpoint.includes('flashcard')
  ) {
    return { model: 'openai/gpt-oss-20b', tier: 'fast' };
  }

  // 2. Complex Tasks -> nvidia/nemotron-3-ultra-550b-a55b
  // Difficult math, derivations, proofs, multi-step school analytics, large reports, complex Orion reasoning
  const complexPatterns = [
    /\b(prove|proof|derive|derivation|theorem|calculus|integral|differential|eigenvalue|matrix|trigonometric identity|quadratic formula proof|quantum|thermodynamics|stochiometry|electrochemistry|organic synthesis)\b/i,
    /\b(multi-step|comprehensive analysis|school-wide analytics|deep analysis|detailed academic report|correlate|regression|comparative analysis|root cause)\b/i,
    /\b(solve step by step|system of equations|simultaneous equations|polynomial|logarithm|bola|conic|vector calculus|complex number)\b/i
  ];

  const isComplexMatch = complexPatterns.some((regex) => regex.test(lower));
  const isHeavyDataAnalysis =
    contextSize > 4500 &&
    /\b(analyze|compare|evaluate|synthesize|trend|performance|audit|insight)\b/i.test(lower);

  if (taskType === 'complex' || isComplexMatch || isHeavyDataAnalysis) {
    return { model: 'nvidia/nemotron-3-ultra-550b-a55b', tier: 'complex' };
  }

  // 3. Fast Tasks -> openai/gpt-oss-20b
  // Greetings, short definitions, quick lookups, basic rewrites, simple homework checks, short conversational turns
  const isGreetingOrChitchat =
    wordCount <= 12 &&
    /^(hi|hello|hey|good morning|good afternoon|good evening|thanks|thank you|ok|okay|who are you|what can you do|help|yo|sup)\b/i.test(lower);

  const isSimpleLookupOrDefinition =
    wordCount <= 22 &&
    !lower.includes('step-by-step') &&
    !lower.includes('comprehensive') &&
    !lower.includes('detailed') &&
    (/^(what is|what are|define|meaning of|who was|when is|do i have|show my|list my|check my|summarize briefly|rewrite|fix grammar|translate)\b/i.test(lower) ||
      /\b(homework tomorrow|pending homework|attendance today|my streak|my xp|house points|next class|upcoming event)\b/i.test(lower));

  const isSimpleCalculation =
    wordCount <= 15 &&
    /^(\d+|\s|[+\-*/^=().,]|what is|calculate|compute|solve)+$/i.test(lower);

  if (
    isGreetingOrChitchat ||
    isSimpleLookupOrDefinition ||
    isSimpleCalculation ||
    (wordCount <= 10 && contextSize < 600 && ctx?.mode !== 'socratic' && ctx?.mode !== 'coder')
  ) {
    return { model: 'openai/gpt-oss-20b', tier: 'fast' };
  }

  // 4. General Tasks -> nvidia/nemotron-3-super-120b-a12b
  // Normal student/teacher questions, lesson explanations (e.g. "Explain lines and angles"), study planning, normal reports
  return { model: 'nvidia/nemotron-3-super-120b-a12b', tier: 'general' };
}

/**
 * Dynamic task-based NVIDIA model selector.
 * Exclusively uses the 3 approved NVIDIA models.
 */
export function selectNvidiaModel(
  prompt: string,
  options?: ModelRoutingContext
): NvidiaModel {
  return classifyTaskComplexity(prompt, options).model;
}

/**
 * Returns ordered fallback sequence of approved NVIDIA models starting with the routed primary model.
 */
export function getModelFallbackOrder(primary: NvidiaModel): NvidiaModel[] {
  if (primary === 'openai/gpt-oss-20b') {
    return ['openai/gpt-oss-20b', 'nvidia/nemotron-3-super-120b-a12b', 'nvidia/nemotron-3-ultra-550b-a55b'];
  }
  if (primary === 'nvidia/nemotron-3-ultra-550b-a55b') {
    return ['nvidia/nemotron-3-ultra-550b-a55b', 'nvidia/nemotron-3-super-120b-a12b', 'openai/gpt-oss-20b'];
  }
  return ['nvidia/nemotron-3-super-120b-a12b', 'openai/gpt-oss-20b', 'nvidia/nemotron-3-ultra-550b-a55b'];
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

  // Keep recent relevant history to avoid bloated prompt latency
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
 * Universal NVIDIA AI Completion Engine (Non-Streaming).
 * Shared across AI Buddy, Orion, Study Center, Flashcard Generator, Summarizer, and Canvas Engine.
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
    systemInstruction = 'You are a supportive, high-clarity academic tutor powered by NVIDIA AI.',
    prompt,
    history = [],
    temperature = 0.65,
    jsonMode = false,
    modelOverride,
    maxTokens,
    endpointName = 'NVIDIA AI',
    taskType = 'general',
    requestId = 'req_' + Math.random().toString(36).substring(2, 10),
    userRole,
    mode,
    persona,
    contextLength
  } = options;

  const nvidiaApiKey = getNvidiaApiKey();
  const requestStart = Date.now();

  const { model: primaryModel, tier } = classifyTaskComplexity(prompt, {
    endpointName,
    taskType,
    modelOverride,
    userRole,
    mode,
    persona,
    contextLength
  });

  if (!nvidiaApiKey) {
    console.error(`[AI P0 ERROR] Request ID: ${requestId} - NVIDIA_API_KEY environment variable is not configured.`);
    throw new Error('NVIDIA_API_KEY is not configured on the server.');
  }

  const effectiveMaxTokens = maxTokens || (tier === 'fast' ? 900 : tier === 'general' ? 2048 : 3200);
  const messages = buildMessagesArray(systemInstruction, prompt, history);
  const candidateModels = getModelFallbackOrder(primaryModel);

  let lastErr: any = null;
  let retries = 0;

  for (const candidateModel of candidateModels) {
    const attemptStart = Date.now();
    try {
      const controller = new AbortController();
      const timeoutMs = candidateModel === 'openai/gpt-oss-20b' ? 18000 : 38000;
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      const response = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${nvidiaApiKey}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          model: candidateModel,
          messages,
          temperature,
          max_tokens: effectiveMaxTokens,
          ...(jsonMode ? { response_format: { type: 'json_object' } } : {})
        }),
        signal: controller.signal
      });

      clearTimeout(timer);
      const durationMs = Date.now() - attemptStart;

      if (response.ok) {
        const data = await response.json();
        const choiceMsg = data.choices?.[0]?.message;
        const text = (choiceMsg?.content || choiceMsg?.reasoning_content || choiceMsg?.reasoning || '').trim();
        if (text) {
          const telemetry: AIPerformanceTelemetry = {
            requestId,
            modelUsed: candidateModel,
            complexityTier: tier,
            requestStart,
            firstTokenLatencyMs: durationMs,
            totalGenerationTimeMs: Date.now() - requestStart,
            retries,
            streamed: false
          };
          console.log(`[NVIDIA AI TELEMETRY] Request=${requestId} Tier=${tier} Model=${candidateModel} TotalMs=${telemetry.totalGenerationTimeMs} Retries=${retries}`);
          return { text, telemetry };
        }
        throw new Error(`Empty response content returned by model "${candidateModel}".`);
      } else {
        const errText = await response.text();
        console.warn(`[NVIDIA AI WARN] Model ${candidateModel} HTTP ${response.status}: ${errText.slice(0, 200)}`);
        lastErr = new Error(`NVIDIA API HTTP ${response.status}: ${errText || 'Request failed'}`);
        retries++;
      }
    } catch (apiErr: any) {
      console.warn(`[NVIDIA AI WARN] Request ID: ${requestId} - Model ${candidateModel} attempt failed:`, apiErr?.message || apiErr);
      lastErr = apiErr;
      retries++;
    }
  }

  console.error(`[AI P0 ERROR] Request ID: ${requestId} - All approved NVIDIA models failed:`, lastErr?.message || lastErr);
  throw lastErr || new Error('AI service is temporarily unavailable.');
}

/**
 * Real Server-Side Streaming Completion Engine for NVIDIA API.
 * Streams tokens immediately as SSE chunks arrive from https://integrate.api.nvidia.com/v1/chat/completions.
 */
export async function streamAICompletion(
  options: AICompletionOptions,
  callbacks: {
    onMeta?: (meta: { requestId: string; model: NvidiaModel; tier: TaskComplexityTier }) => void;
    onToken: (token: string, firstTokenLatencyMs: number) => void;
    onComplete?: (fullText: string, telemetry: AIPerformanceTelemetry) => void;
  },
  abortSignal?: AbortSignal
): Promise<{ text: string; telemetry: AIPerformanceTelemetry }> {
  const {
    systemInstruction = 'You are a supportive, high-clarity academic tutor powered by NVIDIA AI.',
    prompt,
    history = [],
    temperature = 0.65,
    modelOverride,
    maxTokens,
    endpointName = 'AIChatStream',
    taskType = 'general',
    requestId = 'req_' + Math.random().toString(36).substring(2, 10),
    userRole,
    mode,
    persona,
    contextLength
  } = options;

  const nvidiaApiKey = getNvidiaApiKey();
  const requestStart = Date.now();

  const { model: primaryModel, tier } = classifyTaskComplexity(prompt, {
    endpointName,
    taskType,
    modelOverride,
    userRole,
    mode,
    persona,
    contextLength
  });

  if (!nvidiaApiKey) {
    throw new Error('NVIDIA_API_KEY is not configured on the server.');
  }

  const effectiveMaxTokens = maxTokens || (tier === 'fast' ? 950 : tier === 'general' ? 2048 : 3200);
  const messages = buildMessagesArray(systemInstruction, prompt, history);
  const candidateModels = getModelFallbackOrder(primaryModel);

  let lastErr: any = null;
  let retries = 0;

  for (const candidateModel of candidateModels) {
    if (abortSignal?.aborted) {
      throw new Error('Request cancelled by user.');
    }

    try {
      const response = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${nvidiaApiKey}`,
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream'
        },
        body: JSON.stringify({
          model: candidateModel,
          messages,
          temperature,
          max_tokens: effectiveMaxTokens,
          stream: true
        }),
        signal: abortSignal
      });

      if (!response.ok || !response.body) {
        const errText = await response.text().catch(() => '');
        console.warn(`[NVIDIA STREAM WARN] Model ${candidateModel} HTTP ${response.status}: ${errText.slice(0, 200)}`);
        lastErr = new Error(`NVIDIA API HTTP ${response.status}`);
        retries++;
        continue;
      }

      callbacks.onMeta?.({ requestId, model: candidateModel, tier });

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
            // Forward content tokens immediately (only user-facing content, or reasoning if content is empty on final)
            const token = delta?.content || '';
            if (token) {
              if (firstTokenLatencyMs === null) {
                firstTokenLatencyMs = Date.now() - requestStart;
              }
              fullText += token;
              callbacks.onToken(token, firstTokenLatencyMs);
            }
          } catch {
            // Ignore partial JSON line
          }
        }
      }

      if (fullText.trim().length > 0) {
        const telemetry: AIPerformanceTelemetry = {
          requestId,
          modelUsed: candidateModel,
          complexityTier: tier,
          requestStart,
          firstTokenLatencyMs: firstTokenLatencyMs ?? (Date.now() - requestStart),
          totalGenerationTimeMs: Date.now() - requestStart,
          retries,
          streamed: true
        };
        console.log(
          `[NVIDIA STREAM TELEMETRY] Request=${requestId} Tier=${tier} Model=${candidateModel} FirstTokenMs=${telemetry.firstTokenLatencyMs} TotalMs=${telemetry.totalGenerationTimeMs}`
        );
        callbacks.onComplete?.(fullText, telemetry);
        return { text: fullText, telemetry };
      }

      // If stream yielded 0 content tokens (e.g., reasoning-only chunking), try next model
      retries++;
      lastErr = new Error(`Model ${candidateModel} returned empty stream.`);
    } catch (err: any) {
      if (abortSignal?.aborted || err?.name === 'AbortError') {
        throw err;
      }
      console.warn(`[NVIDIA STREAM WARN] Model ${candidateModel} error:`, err?.message || err);
      lastErr = err;
      retries++;
    }
  }

  throw lastErr || new Error('AI streaming service is temporarily unavailable.');
}


