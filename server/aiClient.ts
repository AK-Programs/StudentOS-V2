/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * NVIDIA API Central AI Service for StudentOS
 * Exclusively uses official NVIDIA API (https://integrate.api.nvidia.com/v1/chat/completions)
 * Dynamic model selection among verified official NVIDIA models:
 * 1. meta/llama-3.3-70b-instruct (Flagship General / Academic Tutor / Curriculum Explainer)
 * 2. nvidia/llama-3.1-nemotron-70b-instruct (NVIDIA Flagship Reasoning / Multi-step Logic)
 * 3. deepseek-ai/deepseek-r1 (Complex Reasoning / Math Derivations / Proofs)
 * 4. meta/llama-3.1-8b-instruct (Ultra Fast / Flashcards / Summaries / Quizzes / Moderation)
 * 5. nvidia/nemotron-4-340b-instruct (Heavy Academic Synthesis)
 */

export type NvidiaModel =
  | 'nvidia/nemotron-3-super-120b-a12b'
  | 'nvidia/nemotron-3-ultra-550b-a55b'
  | 'openai/gpt-oss-20b'
  | 'meta/llama-3.3-70b-instruct'
  | 'nvidia/llama-3.1-nemotron-70b-instruct'
  | 'deepseek-ai/deepseek-r1'
  | 'meta/llama-3.1-8b-instruct'
  | 'nvidia/nemotron-4-340b-instruct';

export const ALLOWED_NVIDIA_MODELS: readonly string[] = [
  'nvidia/nemotron-3-super-120b-a12b',
  'nvidia/nemotron-3-ultra-550b-a55b',
  'openai/gpt-oss-20b',
  'meta/llama-3.3-70b-instruct',
  'nvidia/llama-3.1-nemotron-70b-instruct',
  'deepseek-ai/deepseek-r1',
  'meta/llama-3.1-8b-instruct',
  'nvidia/nemotron-4-340b-instruct'
] as const;

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
}

/**
 * Dynamic task-based NVIDIA model selector.
 * Prioritizes the approved NVIDIA models.
 */
export function selectNvidiaModel(
  prompt: string,
  options?: { endpointName?: string; taskType?: string; modelOverride?: string }
): NvidiaModel {
  if (options?.modelOverride) {
    return options.modelOverride as NvidiaModel;
  }

  const combined = `${options?.endpointName || ''} ${options?.taskType || ''} ${prompt}`.toLowerCase();

  // 1. Complex Reasoning / Orion / Derivations / Math
  if (
    combined.includes('orion') ||
    combined.includes('agentic') ||
    combined.includes('complex') ||
    combined.includes('deep reasoning') ||
    combined.includes('proof') ||
    combined.includes('derivation') ||
    combined.includes('calculus') ||
    combined.includes('quantum')
  ) {
    return 'nvidia/nemotron-3-ultra-550b-a55b';
  }

  // 2. Lightweight / Flashcards / Quick Summary / Quiz
  if (
    combined.includes('flashcard') ||
    combined.includes('quick summary') ||
    combined.includes('vocab') ||
    combined.includes('quiz') ||
    combined.includes('moderation') ||
    combined.includes('classify')
  ) {
    return 'openai/gpt-oss-20b';
  }

  // 3. Flagship Academic Tutor / AI Buddy / Study Center
  return 'nvidia/nemotron-3-super-120b-a12b';
}

/**
 * Universal NVIDIA AI Completion Engine.
 * Shared across AI Buddy, Orion, Study Center, Flashcard Generator, Summarizer, and Canvas Engine.
 */
export async function generateAICompletion(
  param1: string | AICompletionOptions,
  param2?: string,
  param3: any[] = []
): Promise<string> {
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
    temperature = 0.7,
    jsonMode = false,
    modelOverride,
    maxTokens = 3000,
    endpointName = 'NVIDIA AI',
    taskType = 'general',
    requestId = 'req_' + Math.random().toString(36).substring(2, 10)
  } = options;

  const rawKey =
    process.env.NVIDIA_API_KEY ||
    process.env.VITE_NVIDIA_API_KEY ||
    process.env.NIM_API_KEY ||
    process.env.NGC_API_KEY ||
    process.env.AI_API_KEY ||
    '';
  const nvidiaApiKey = rawKey.trim().replace(/^["']|["']$/g, '');

  console.log(`[NVIDIA AI DEBUG] Request ID: ${requestId}`);
  console.log(`[NVIDIA AI DEBUG] Route: /api/ai/chat`);
  console.log(`[NVIDIA AI DEBUG] NVIDIA_API_KEY present: ${Boolean(nvidiaApiKey)}`);

  if (!nvidiaApiKey) {
    console.error(`[AI P0 ERROR] Request ID: ${requestId} - NVIDIA_API_KEY environment variable is not configured.`);
    throw new Error('NVIDIA_API_KEY is not configured on the server.');
  }

  const primaryModel = selectNvidiaModel(prompt, { endpointName, taskType, modelOverride });
  
  // Model cascade: try requested approved model first, then verified catalog fallbacks if rejected
  const candidateModels: string[] = [
    primaryModel,
    'nvidia/nemotron-3-super-120b-a12b',
    'meta/llama-3.3-70b-instruct',
    'nvidia/llama-3.1-nemotron-70b-instruct',
    'deepseek-ai/deepseek-r1',
    'meta/llama-3.1-8b-instruct'
  ].filter((m, i, arr) => arr.indexOf(m) === i);

  // Image extraction if present
  let imageUrl: string | null = null;
  let cleanPrompt = prompt;

  const imageMatch = prompt.match(/Image Data: (data:(image\/[a-zA-Z+.-]+);base64,([A-Za-z0-9+/=\s\r\n]+))/);
  if (imageMatch) {
    imageUrl = imageMatch[1].trim();
    cleanPrompt = prompt.replace(/Image Data: data:image\/[a-zA-Z+.-]+;base64,[A-Za-z0-9+/=\s\r\n]+/, '[Attached Diagram/Image]');
  }

  // Construct standard chat completion message array
  const messages: any[] = [];
  if (systemInstruction) {
    messages.push({ role: 'system', content: systemInstruction });
  }

  for (const msg of history) {
    if (msg && msg.content) {
      messages.push({
        role: msg.role === 'assistant' ? 'assistant' : 'user',
        content: msg.content
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

  let lastStatus = 0;
  let lastErrorText = '';

  for (const modelToTry of candidateModels) {
    const startTime = Date.now();
    try {
      console.log(`[NVIDIA AI DEBUG] Selected model: ${modelToTry}`);
      console.log(`[NVIDIA AI DEBUG] NVIDIA request started`);
      
      const response = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${nvidiaApiKey}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          model: modelToTry,
          messages,
          temperature,
          max_tokens: maxTokens,
          ...(jsonMode ? { response_format: { type: 'json_object' } } : {})
        })
      });

      const durationMs = Date.now() - startTime;
      lastStatus = response.status;
      console.log(`[NVIDIA AI DEBUG] NVIDIA HTTP status: ${response.status}`);

      if (response.ok) {
        const data = await response.json();
        const choiceMsg = data.choices?.[0]?.message;
        const text = (choiceMsg?.content || choiceMsg?.reasoning || '').trim();
        if (text) {
          console.log(`[NVIDIA AI DEBUG] NVIDIA response: ${text.slice(0, 100).replace(/\n/g, ' ')}...`);
          console.log(`[NVIDIA AI DEBUG] Request completed successfully in ${durationMs}ms`);
          return text;
        }
        console.warn(`[NVIDIA AI DEBUG] Message content was empty on model "${modelToTry}".`);
      } else {
        const errText = await response.text();
        lastErrorText = errText;
        console.error(`[NVIDIA AI DEBUG] Response body: ${errText.slice(0, 300)}`);
      }
    } catch (apiErr: any) {
      lastErrorText = apiErr?.message || String(apiErr);
      console.error(`[AI P0 ERROR] Request ID: ${requestId} - Model ${modelToTry} fetch error:`, lastErrorText);
    }
  }

  const finalError = new Error(`NVIDIA API request failed (HTTP ${lastStatus || 'NETWORK_ERROR'}): ${lastErrorText || 'Unable to complete request'}`);
  console.error(`[AI P0 ERROR] Request ID: ${requestId}`, finalError);
  throw finalError;
}

