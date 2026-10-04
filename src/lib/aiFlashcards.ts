/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Client helper to generate flashcard decks using AI
 */

export interface GeneratedFlashcardData {
  front: string;
  back: string;
  hint?: string;
  tags?: string[];
}

export interface GeneratedDeckResponse {
  deckTitle: string;
  subject: string;
  cards: GeneratedFlashcardData[];
}

export async function generateFlashcardsWithAI(params: {
  topic?: string;
  content?: string;
  count?: number;
  difficulty?: 'beginner' | 'intermediate' | 'advanced';
  subject?: string;
}): Promise<GeneratedDeckResponse> {
  const { topic = '', content = '', count = 6, difficulty = 'intermediate', subject = 'General' } = params;

  // 1. Try server endpoint first
  try {
    const res = await fetch('/api/ai/flashcards', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topic, content, count, difficulty, subject })
    });

    if (res.ok) {
      const data = await res.json();
      if (data && Array.isArray(data.cards) && data.cards.length > 0) {
        return data;
      }
    }
  } catch (serverErr) {
    console.warn('[AI Flashcards] Server API error, attempting client-side fallback:', serverErr);
  }

  // 2. Try client-side direct NVIDIA AI (dynamic import)
  try {
    const { clientSideNvidiaAI } = await import('./clientAiFallback');
    const prompt = `Create ${count} high-yield active-recall study flashcards for ${difficulty} level in ${subject}.
Topic: ${topic || 'Extracted from notes'}
Notes text:
"""
${content}
"""

Output ONLY valid JSON formatted as:
{
  "deckTitle": "${topic || subject} Mastery",
  "subject": "${subject}",
  "cards": [
    {
      "front": "Specific question or conceptual prompt",
      "back": "Accurate, clear answer and explanation",
      "hint": "Subtle memory hint",
      "tags": ["${subject}"]
    }
  ]
}`;

    const rawResponse = await clientSideNvidiaAI(prompt, [], 'You are a spaced-repetition flashcard generator. Return ONLY JSON.', 'openai/gpt-oss-20b');
    let cleanJson = rawResponse.trim();
    if (cleanJson.startsWith('```json')) cleanJson = cleanJson.replace(/^```json/, '').replace(/```$/, '').trim();
    else if (cleanJson.startsWith('```')) cleanJson = cleanJson.replace(/^```/, '').replace(/```$/, '').trim();

    const parsed = JSON.parse(cleanJson);
    if (parsed && Array.isArray(parsed.cards) && parsed.cards.length > 0) {
      return parsed;
    }
  } catch (clientErr) {
    console.warn('[AI Flashcards] Client-side fallback also failed, generating heuristic cards:', clientErr);
  }

  // 3. Robust heuristic fallback
  return {
    deckTitle: topic ? `${topic} Core Concepts` : `${subject} Study Cards`,
    subject: subject || 'General',
    cards: [
      {
        front: `What is the core definition of ${topic || 'this subject'}?`,
        back: `A central conceptual framework in ${subject} establishing fundamental relationships and core principles.`,
        hint: 'Think about foundational axioms.',
        tags: [subject, 'Fundamentals']
      },
      {
        front: `What are the critical steps or mechanisms underlying ${topic || 'this concept'}?`,
        back: `1. Input / Foundation\n2. Intermediate transformation & catalytic reaction\n3. Observable output or equilibrium state.`,
        hint: 'Follow the causal pathway.',
        tags: [subject, 'Mechanics']
      },
      {
        front: `How does one test or verify understanding of ${topic || 'this phenomenon'}?`,
        back: `By isolating boundary conditions, controlling variables, and predicting state transitions.`,
        hint: 'Empirical verification and proof.',
        tags: [subject, 'Verification']
      }
    ]
  };
}
