import { GoogleGenAI } from '@google/genai';

let aiInstance: GoogleGenAI | null = null;

export function getAIClient(): GoogleGenAI | null {
  if (aiInstance) return aiInstance;
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn('[AI Client] GEMINI_API_KEY is not set. Native Gemini SDK will be unavailable.');
    return null;
  }
  
  try {
    aiInstance = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
    console.log('[AI Client] Successfully initialized GoogleGenAI client.');
    return aiInstance;
  } catch (err: any) {
    console.error('[AI Client] Failed to initialize Gemini SDK Client. Stack trace:\n', err.stack || err);
    return null;
  }
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
}

/**
 * Universal AI Completion Engine.
 * Shared across AI Buddy, Teacher Chat, SVG Diagram Generator, Mermaid Generator, and Canvas Engine.
 * Supports OpenRouter (DeepSeek V4 Flash / Gemini) with native Gemini SDK fallback.
 * Supports options object OR legacy (systemInstruction, prompt, history) parameters.
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
    systemInstruction = 'You are a helpful, accurate educational assistant.',
    prompt,
    history = [],
    temperature = 0.7,
    jsonMode = false,
    modelOverride,
    maxTokens = 3000,
    endpointName = 'AI'
  } = options;

  console.log(`[${endpointName}] Starting AI request. Prompt preview: "${prompt.slice(0, 100).replace(/\n/g, ' ')}..."`);

  const openRouterKey = process.env.OPENROUTER_API_KEY || process.env.VITE_OPENROUTER_API_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;

  console.log(`[${endpointName}] API Keys detected -> OpenRouter: ${openRouterKey ? 'YES' : 'NO'}, Gemini: ${geminiKey ? 'YES' : 'NO'}`);

  // 1. Image extraction from prompt
  let imageUrl: string | null = null;
  let cleanPrompt = prompt;

  const imageMatch = prompt.match(/Image Data: (data:(image\/[a-zA-Z+.-]+);base64,([A-Za-z0-9+/=\s\r\n]+))/);
  if (imageMatch) {
    imageUrl = imageMatch[1].trim();
    cleanPrompt = prompt.replace(/Image Data: data:image\/[a-zA-Z+.-]+;base64,[A-Za-z0-9+/=\s\r\n]+/, '[See attached diagram/image]');
  }

  // 2. Try OpenRouter if key is available
  if (openRouterKey) {
    const candidateModels = modelOverride ? [modelOverride] : [
      process.env.OPENROUTER_MODEL || 'deepseek/deepseek-v4-flash',
      'deepseek/deepseek-chat',
      'deepseek/deepseek-r1',
      'google/gemini-2.5-flash',
      'qwen/qwen-2.5-72b-instruct'
    ];

    for (const modelName of candidateModels) {
      try {
        console.log(`[${endpointName}] Requesting OpenRouter model "${modelName}"...`);

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

        const reqBody: any = {
          model: modelName,
          messages: messages,
          temperature: temperature,
          max_tokens: maxTokens,
        };

        if (jsonMode) {
          reqBody.response_format = { type: 'json_object' };
        }

        const startTime = Date.now();
        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openRouterKey}`,
            'HTTP-Referer': 'https://ai.studio/build',
            'X-Title': 'StudentOS',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(reqBody)
        });

        const duration = Date.now() - startTime;
        console.log(`[${endpointName}] OpenRouter response received in ${duration}ms. Status: ${response.status}`);

        if (response.ok) {
          const data = await response.json();
          const choiceMsg = data.choices?.[0]?.message;
          const text = (choiceMsg?.content || choiceMsg?.reasoning || '').trim();
          if (text && typeof text === 'string' && text.length > 0) {
            console.log(`[${endpointName}] Successfully received ${text.length} characters from OpenRouter (${modelName}).`);
            return text;
          }
          console.warn(`[${endpointName}] OpenRouter returned empty text content.`);
        } else {
          const errText = await response.text();
          console.warn(`[${endpointName}] OpenRouter model "${modelName}" failed (Status ${response.status}): ${errText}`);
        }
      } catch (err: any) {
        console.warn(`[${endpointName}] OpenRouter model "${modelName}" threw exception: ${err.message || err}`);
      }
    }
  }

  // 3. Fallback to Native Gemini SDK
  const ai = getAIClient();
  if (ai) {
    const candidateGeminiModels = ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-pro'];

    for (const modelName of candidateGeminiModels) {
      try {
        console.log(`[${endpointName}] Requesting Native Gemini SDK model "${modelName}"...`);
        const contentsList: any[] = [];

        for (const msg of history) {
          if (msg && msg.content) {
            contentsList.push({
              role: msg.role === 'assistant' ? 'model' : 'user',
              parts: [{ text: msg.content }]
            });
          }
        }

        if (imageUrl) {
          const rawBase64 = imageUrl.split(';base64,')[1];
          const mimeType = imageUrl.split(';base64,')[0].replace('data:', '');
          contentsList.push({
            role: 'user',
            parts: [
              { inlineData: { mimeType, data: rawBase64 } },
              { text: cleanPrompt }
            ]
          });
        } else {
          contentsList.push({
            role: 'user',
            parts: [{ text: cleanPrompt }]
          });
        }

        const startTime = Date.now();
        const response = await ai.models.generateContent({
          model: modelName,
          contents: contentsList,
          config: {
            systemInstruction: systemInstruction,
            temperature: temperature,
            maxOutputTokens: maxTokens,
            ...(jsonMode ? { responseMimeType: 'application/json' } : {})
          }
        });

        const duration = Date.now() - startTime;
        console.log(`[${endpointName}] Native Gemini SDK response received in ${duration}ms.`);

        if (response && response.text) {
          console.log(`[${endpointName}] Successfully received ${response.text.length} characters from Gemini SDK (${modelName}).`);
          return response.text;
        }
      } catch (err: any) {
        console.warn(`[${endpointName}] Native Gemini SDK model "${modelName}" failed: ${err.message || err}`);
      }
    }
  }

  throw new Error(`[${endpointName}] All AI providers failed. Check API keys and network connectivity.`);
}
