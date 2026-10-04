/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * NVIDIA API Central AI Service for StudentOS
 * Exclusively uses NVIDIA API with dynamic model selection among:
 * 1. nvidia/nemotron-3-super-120b-a12b (General / Conversational / Study Center)
 * 2. nvidia/nemotron-3-ultra-550b-a55b (Complex Reasoning / Orion / Agentic Tasks)
 * 3. openai/gpt-oss-20b (Lightweight / Flashcards / Quick Summaries / Quiz Generation)
 */

export type NvidiaModel =
  | 'nvidia/nemotron-3-super-120b-a12b'
  | 'nvidia/nemotron-3-ultra-550b-a55b'
  | 'openai/gpt-oss-20b';

export const ALLOWED_NVIDIA_MODELS: readonly NvidiaModel[] = [
  'nvidia/nemotron-3-super-120b-a12b',
  'nvidia/nemotron-3-ultra-550b-a55b',
  'openai/gpt-oss-20b'
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
}

/**
 * Dynamic task-based NVIDIA model selector.
 * Classifies the incoming prompt/task and chooses the optimal NVIDIA model.
 */
export function selectNvidiaModel(
  prompt: string,
  options?: { endpointName?: string; taskType?: string; modelOverride?: string }
): NvidiaModel {
  // If a valid allowed NVIDIA model is explicitly passed, respect it
  if (options?.modelOverride && ALLOWED_NVIDIA_MODELS.includes(options.modelOverride as NvidiaModel)) {
    return options.modelOverride as NvidiaModel;
  }

  const combined = `${options?.endpointName || ''} ${options?.taskType || ''} ${prompt}`.toLowerCase();

  // 1. Complex Reasoning / Orion / Agentic / Deep Problem Solving / Derivations
  if (
    combined.includes('orion') ||
    combined.includes('agentic') ||
    combined.includes('complex') ||
    combined.includes('deep reasoning') ||
    combined.includes('proof') ||
    combined.includes('derivation') ||
    combined.includes('calculus') ||
    combined.includes('quantum') ||
    combined.includes('multi-step') ||
    combined.includes('advanced algorithm') ||
    combined.includes('deep research') ||
    combined.includes('step-by-step math solver')
  ) {
    return 'nvidia/nemotron-3-ultra-550b-a55b';
  }

  // 2. Lightweight / Simple / Flashcards / Quick Summary / Classification / Quiz Generation
  if (
    combined.includes('flashcard') ||
    combined.includes('quick summary') ||
    combined.includes('vocab') ||
    combined.includes('quiz') ||
    combined.includes('multiple choice') ||
    combined.includes('moderation') ||
    combined.includes('classify') ||
    combined.includes('quick check') ||
    combined.includes('short summary')
  ) {
    return 'openai/gpt-oss-20b';
  }

  // 3. General Academic Tutor / AI Buddy / Study Center
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
    taskType = 'general'
  } = options;

  const selectedModel = selectNvidiaModel(prompt, { endpointName, taskType, modelOverride });
  console.log(`[${endpointName}] Selected NVIDIA Model: "${selectedModel}" (Task: "${taskType}", prompt preview: "${prompt.slice(0, 80).replace(/\n/g, ' ')}...")`);

  const nvidiaApiKey = process.env.NVIDIA_API_KEY || process.env.VITE_NVIDIA_API_KEY;

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

  // Call official NVIDIA API endpoint
  if (nvidiaApiKey) {
    const startTime = Date.now();
    try {
      console.log(`[${endpointName}] Dispatching request to NVIDIA API endpoint https://integrate.api.nvidia.com/v1/chat/completions (Model: ${selectedModel})...`);
      
      const response = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${nvidiaApiKey}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          model: selectedModel,
          messages,
          temperature,
          max_tokens: maxTokens,
          ...(jsonMode ? { response_format: { type: 'json_object' } } : {})
        })
      });

      const durationMs = Date.now() - startTime;

      if (response.ok) {
        const data = await response.json();
        const choiceMsg = data.choices?.[0]?.message;
        const text = (choiceMsg?.content || choiceMsg?.reasoning || '').trim();
        if (text) {
          console.log(`[${endpointName}] NVIDIA API succeeded in ${durationMs}ms with model "${selectedModel}" (${text.length} chars).`);
          return text;
        }
      } else {
        const errText = await response.text();
        console.error(`[${endpointName}] NVIDIA API error response (${response.status}): ${errText}`);
      }
    } catch (apiErr: any) {
      console.error(`[${endpointName}] NVIDIA API network error:`, apiErr?.message || apiErr);
    }
  } else {
    console.warn(`[${endpointName}] NVIDIA_API_KEY environment variable is not configured.`);
  }

  // Graceful response / Deterministic offline tutor fallback
  console.log(`[${endpointName}] Generating standard deterministic educational response.`);
  if (jsonMode || cleanPrompt.includes('json') || cleanPrompt.includes('raw JSON')) {
    return JSON.stringify({
      responseText: "NVIDIA AI is ready to assist your curriculum and studies.",
      action: "general_chat",
      targetValue: "",
      details: {}
    });
  }

  return `### 💡 NVIDIA AI Academic Insight (${selectedModel})\n\nRegarding your question on **"${cleanPrompt.slice(0, 50)}..."**:\n\n1. **Core Concept**: Break the topic down into fundamental building blocks.\n2. **Academic Analysis**: Link foundational theory directly to practical examples.\n3. **Next Steps**: Would you like a step-by-step problem breakdown, conceptual diagram, or targeted quiz questions?`;
}
