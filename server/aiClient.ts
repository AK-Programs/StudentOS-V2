/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Unified AI Service for StudentOS
 * Powered by Google GenAI (Gemini 3.8 Flash) & NVIDIA API
 * Approved Models:
 * 1. Google Gemini (gemini-3.8-flash) via @google/genai
 * 2. NVIDIA AI (openai/gpt-oss-20b, nvidia/nemotron-3-super-120b-a12b, nvidia/nemotron-3-ultra-550b-a55b)
 */

import { GoogleGenAI } from '@google/genai';

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
  modelUsed: string;
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

export function getGeminiApiKey(): string {
  const rawKey =
    process.env.GEMINI_API_KEY ||
    process.env.VITE_GEMINI_API_KEY ||
    process.env.GOOGLE_API_KEY ||
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

  return { model: 'nvidia/nemotron-3-super-120b-a12b', tier: 'general' };
}

export function selectNvidiaModel(
  prompt: string,
  options?: ModelRoutingContext
): NvidiaModel {
  return classifyTaskComplexity(prompt, options).model;
}

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
 * Universal AI Completion Engine.
 * Supports Google Gemini (gemini-3.8-flash) & NVIDIA AI.
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
    temperature = 0.65,
    jsonMode = false,
    modelOverride,
    maxTokens,
    endpointName = 'StudentOS AI',
    taskType = 'general',
    requestId = 'req_' + Math.random().toString(36).substring(2, 10),
    userRole,
    mode,
    persona,
    contextLength
  } = options;

  const requestStart = Date.now();
  const geminiKey = getGeminiApiKey();
  const nvidiaApiKey = getNvidiaApiKey();

  // Try Google GenAI SDK (Gemini 3.8 Flash) first if configured
  if (geminiKey || process.env.GEMINI_API_KEY) {
    try {
      const ai = new GoogleGenAI();
      const effectiveModel = 'gemini-3.8-flash';
      
      let contents: any[] = [];
      const recentHistory = history.slice(-8);
      for (const msg of recentHistory) {
        if (msg && msg.content) {
          contents.push({
            role: msg.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: String(msg.content) }]
          });
        }
      }
      contents.push({
        role: 'user',
        parts: [{ text: prompt }]
      });

      const response = await ai.models.generateContent({
        model: effectiveModel,
        contents,
        config: {
          systemInstruction,
          temperature,
          maxOutputTokens: maxTokens || (jsonMode ? 2500 : 2048),
          responseMimeType: jsonMode ? 'application/json' : undefined
        }
      });

      const text = (response.text || '').trim();
      if (text) {
        const telemetry: AIPerformanceTelemetry = {
          requestId,
          modelUsed: effectiveModel,
          complexityTier: 'general',
          requestStart,
          firstTokenLatencyMs: Date.now() - requestStart,
          totalGenerationTimeMs: Date.now() - requestStart,
          retries: 0,
          streamed: false
        };
        console.log(`[GEMINI AI TELEMETRY] Request=${requestId} Model=${effectiveModel} TotalMs=${telemetry.totalGenerationTimeMs}`);
        return { text, telemetry };
      }
    } catch (geminiErr: any) {
      console.warn(`[GEMINI AI NOTICE] Request ${requestId} Gemini attempt notice:`, geminiErr?.message || geminiErr);
    }
  }

  // Fallback or Direct to NVIDIA API
  const { model: primaryModel, tier } = classifyTaskComplexity(prompt, {
    endpointName,
    taskType,
    modelOverride,
    userRole,
    mode,
    persona,
    contextLength
  });

  if (!nvidiaApiKey && !geminiKey) {
    console.error(`[AI ERROR] Neither GEMINI_API_KEY nor NVIDIA_API_KEY is configured.`);
    throw new Error('AI API credentials are not configured on the server.');
  }

  if (nvidiaApiKey) {
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
        } else {
          const errText = await response.text();
          lastErr = new Error(`NVIDIA API HTTP ${response.status}: ${errText || 'Request failed'}`);
          retries++;
        }
      } catch (apiErr: any) {
        lastErr = apiErr;
        retries++;
      }
    }
  }

  throw new Error('AI completion service is currently unavailable.');
}

/**
 * Server-Side Streaming Completion Engine.
 */
export async function streamAICompletion(
  options: AICompletionOptions,
  callbacks: {
    onMeta?: (meta: { requestId: string; model: string; tier: TaskComplexityTier }) => void;
    onToken: (token: string, firstTokenLatencyMs: number) => void;
    onComplete?: (fullText: string, telemetry: AIPerformanceTelemetry) => void;
  },
  abortSignal?: AbortSignal
): Promise<{ text: string; telemetry: AIPerformanceTelemetry }> {
  const {
    systemInstruction = 'You are a supportive, high-clarity academic tutor for StudentOS.',
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

  const requestStart = Date.now();
  const geminiKey = getGeminiApiKey();
  const nvidiaApiKey = getNvidiaApiKey();

  // Try Google GenAI Stream if available
  if (geminiKey || process.env.GEMINI_API_KEY) {
    try {
      const ai = new GoogleGenAI();
      const effectiveModel = 'gemini-3.8-flash';
      callbacks.onMeta?.({ requestId, model: effectiveModel, tier: 'general' });

      let contents: any[] = [];
      const recentHistory = history.slice(-8);
      for (const msg of recentHistory) {
        if (msg && msg.content) {
          contents.push({
            role: msg.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: String(msg.content) }]
          });
        }
      }
      contents.push({
        role: 'user',
        parts: [{ text: prompt }]
      });

      const responseStream = await ai.models.generateContentStream({
        model: effectiveModel,
        contents,
        config: {
          systemInstruction,
          temperature,
          maxOutputTokens: maxTokens || 2048
        }
      });

      let fullText = '';
      let firstTokenLatencyMs: number | null = null;

      for await (const chunk of responseStream) {
        if (abortSignal?.aborted) break;
        const token = chunk.text || '';
        if (token) {
          if (firstTokenLatencyMs === null) {
            firstTokenLatencyMs = Date.now() - requestStart;
          }
          fullText += token;
          callbacks.onToken(token, firstTokenLatencyMs);
        }
      }

      if (fullText.trim().length > 0) {
        const telemetry: AIPerformanceTelemetry = {
          requestId,
          modelUsed: effectiveModel,
          complexityTier: 'general',
          requestStart,
          firstTokenLatencyMs: firstTokenLatencyMs ?? (Date.now() - requestStart),
          totalGenerationTimeMs: Date.now() - requestStart,
          retries: 0,
          streamed: true
        };
        callbacks.onComplete?.(fullText, telemetry);
        return { text: fullText, telemetry };
      }
    } catch (streamErr: any) {
      if (abortSignal?.aborted) throw streamErr;
      console.warn(`[GEMINI STREAM NOTICE] Falling back to NVIDIA stream:`, streamErr?.message || streamErr);
    }
  }

  // Fallback to NVIDIA Stream
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
    throw new Error('No AI streaming provider is configured.');
  }

  const effectiveMaxTokens = maxTokens || (tier === 'fast' ? 950 : tier === 'general' ? 2048 : 3200);
  const messages = buildMessagesArray(systemInstruction, prompt, history);
  const candidateModels = getModelFallbackOrder(primaryModel);

  for (const candidateModel of candidateModels) {
    if (abortSignal?.aborted) throw new Error('Request cancelled by user.');

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

      if (!response.ok || !response.body) continue;

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
            const token = delta?.content || '';
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
          modelUsed: candidateModel,
          complexityTier: tier,
          requestStart,
          firstTokenLatencyMs: firstTokenLatencyMs ?? (Date.now() - requestStart),
          totalGenerationTimeMs: Date.now() - requestStart,
          retries: 0,
          streamed: true
        };
        callbacks.onComplete?.(fullText, telemetry);
        return { text: fullText, telemetry };
      }
    } catch (err: any) {
      if (abortSignal?.aborted || err?.name === 'AbortError') throw err;
    }
  }

  throw new Error('AI streaming service is temporarily unavailable.');
}



