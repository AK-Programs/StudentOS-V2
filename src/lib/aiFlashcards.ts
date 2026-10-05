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

  const res = await fetch('/api/ai/flashcards', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ topic, content, count, difficulty, subject })
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.message || errData.error || `AI Flashcards service error (HTTP ${res.status})`);
  }

  const data = await res.json();
  if (data && Array.isArray(data.cards) && data.cards.length > 0) {
    return {
      deckTitle: data.deckTitle || (topic ? `${topic} High-Yield Flashcards` : `${subject} Study Deck`),
      subject: data.subject || subject,
      cards: data.cards
    };
  }

  throw new Error('AI was unable to generate flashcards for this topic. Please try again.');
}
