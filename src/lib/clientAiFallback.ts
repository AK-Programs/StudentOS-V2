/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * StudentOS Client AI Handler
 * Routes requests securely through the server-side NVIDIA AI engine.
 * Absolutely NO mock, template, or hardcoded fake AI fallbacks.
 */

export function sanitizeHistory(history: any[] = []): any[] {
  if (!Array.isArray(history) || history.length === 0) return [];
  
  const filtered = history.filter(h => h && typeof h.content === 'string' && h.content.trim().length > 0);
  if (filtered.length === 0) return [];

  const sanitized: any[] = [];

  for (const msg of filtered) {
    const role = (msg.role === 'assistant' || msg.role === 'model') ? 'assistant' : 'user';
    if (sanitized.length === 0) {
      sanitized.push({ role, content: msg.content.trim() });
    } else {
      const last = sanitized[sanitized.length - 1];
      if (last.role === role) {
        last.content += '\n' + msg.content.trim();
      } else {
        sanitized.push({ role, content: msg.content.trim() });
      }
    }
  }

  return sanitized;
}

/**
 * Universal Client-Side AI Completion powered exclusively by NVIDIA AI via StudentOS backend.
 * Never returns fake/mock academic responses on failure.
 */
export async function clientSideNvidiaAI(
  userMessage: string, 
  history: any[] = [], 
  systemInstruction?: string,
  modelOverride?: string
): Promise<string> {
  const sanitized = sanitizeHistory(history);

  const res = await fetch('/api/ai/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt: userMessage,
      history: sanitized,
      systemInstruction,
      modelOverride
    })
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    const errorMsg = errData.message || errData.error || `AI request failed (HTTP ${res.status})`;
    throw new Error(errorMsg);
  }

  const data = await res.json();
  if (data.text && typeof data.text === 'string' && data.text.trim()) {
    return data.text.trim();
  }

  if (data.error) {
    throw new Error(data.error);
  }

  throw new Error('AI is temporarily unavailable. Please try again.');
}

// Exported universal alias
export const clientSideAI = clientSideNvidiaAI;

