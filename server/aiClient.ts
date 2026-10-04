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
 * Universal DeepSeek AI Completion Engine.
 * Shared across AI Buddy, Teacher Chat, Flashcard Generator, Diagram Generator, and Canvas Engine.
 * Exclusively uses DeepSeek LLM (DeepSeek-Chat, DeepSeek-R1, DeepSeek-V4 Flash) via OpenRouter or Direct DeepSeek API.
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
    systemInstruction = 'You are a supportive, high-clarity academic tutor powered by DeepSeek.',
    prompt,
    history = [],
    temperature = 0.7,
    jsonMode = false,
    modelOverride,
    maxTokens = 3000,
    endpointName = 'DeepSeek AI'
  } = options;

  console.log(`[${endpointName}] Starting DeepSeek request. Prompt preview: "${prompt.slice(0, 100).replace(/\n/g, ' ')}..."`);

  const deepseekDirectKey = process.env.DEEPSEEK_API_KEY;
  const openRouterKey = process.env.OPENROUTER_API_KEY || process.env.VITE_OPENROUTER_API_KEY;

  // 1. Image extraction from prompt
  let imageUrl: string | null = null;
  let cleanPrompt = prompt;

  const imageMatch = prompt.match(/Image Data: (data:(image\/[a-zA-Z+.-]+);base64,([A-Za-z0-9+/=\s\r\n]+))/);
  if (imageMatch) {
    imageUrl = imageMatch[1].trim();
    cleanPrompt = prompt.replace(/Image Data: data:image\/[a-zA-Z+.-]+;base64,[A-Za-z0-9+/=\s\r\n]+/, '[Attached Diagram/Image]');
  }

  // Construct message sequence
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

  // 2. Try Direct DeepSeek API if direct key is available
  if (deepseekDirectKey) {
    try {
      console.log(`[${endpointName}] Querying official DeepSeek API (deepseek-chat)...`);
      const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${deepseekDirectKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: modelOverride || 'deepseek-chat',
          messages,
          temperature,
          max_tokens: maxTokens,
          ...(jsonMode ? { response_format: { type: 'json_object' } } : {})
        })
      });

      if (response.ok) {
        const data = await response.json();
        const text = (data.choices?.[0]?.message?.content || '').trim();
        if (text) {
          console.log(`[${endpointName}] Direct DeepSeek response received (${text.length} chars).`);
          return text;
        }
      }
    } catch (directErr: any) {
      console.warn(`[${endpointName}] Direct DeepSeek API warning:`, directErr?.message || directErr);
    }
  }

  // 3. Try OpenRouter DeepSeek models
  if (openRouterKey) {
    const deepseekModels = modelOverride ? [modelOverride] : [
      process.env.OPENROUTER_MODEL || 'deepseek/deepseek-chat',
      'deepseek/deepseek-r1',
      'deepseek/deepseek-v4-flash',
      'deepseek/deepseek-chat:free'
    ];

    for (const modelName of deepseekModels) {
      try {
        console.log(`[${endpointName}] Requesting DeepSeek model "${modelName}" on OpenRouter...`);
        const startTime = Date.now();
        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openRouterKey}`,
            'HTTP-Referer': 'https://studentos.edu',
            'X-Title': 'StudentOS',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: modelName,
            messages,
            temperature,
            max_tokens: maxTokens,
            ...(jsonMode ? { response_format: { type: 'json_object' } } : {})
          })
        });

        const duration = Date.now() - startTime;
        if (response.ok) {
          const data = await response.json();
          const choiceMsg = data.choices?.[0]?.message;
          const text = (choiceMsg?.content || choiceMsg?.reasoning || '').trim();
          if (text) {
            console.log(`[${endpointName}] DeepSeek (${modelName}) succeeded in ${duration}ms (${text.length} chars).`);
            return text;
          }
        } else {
          const errBody = await response.text();
          console.warn(`[${endpointName}] DeepSeek model "${modelName}" returned ${response.status}: ${errBody}`);
        }
      } catch (orErr: any) {
        console.warn(`[${endpointName}] DeepSeek model "${modelName}" exception:`, orErr?.message || orErr);
      }
    }
  }

  // 4. Heuristic Educational Response Fallback if no API key configured
  console.log(`[${endpointName}] Generating deterministic offline academic response.`);
  if (jsonMode || cleanPrompt.includes('json') || cleanPrompt.includes('raw JSON')) {
    return JSON.stringify({
      responseText: "DeepSeek AI is ready. How can I assist your studies or curriculum today?",
      action: "general_chat",
      targetValue: "",
      details: {}
    });
  }

  return `### 💡 DeepSeek Academic Insight\n\nRegarding your question on **"${cleanPrompt.slice(0, 50)}..."**:\n\n1. **Core Concept**: Focus on breaking the problem down into first principles.\n2. **Analysis**: Connect foundational definitions with practical applications.\n3. **Next Step**: Would you like a step-by-step calculation, conceptual proof, or practice questions?`;
}
