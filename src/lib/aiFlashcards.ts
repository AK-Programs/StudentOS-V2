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
  explanation?: string;
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
    const normalizedCards: GeneratedFlashcardData[] = data.cards
      .map((c: any) => ({
        front: String(c?.front ?? c?.question ?? c?.front_text ?? c?.prompt ?? '').trim(),
        back: String(c?.back ?? c?.answer ?? c?.back_text ?? c?.definition ?? '').trim(),
        hint: c?.hint ? String(c.hint).trim() : undefined,
        explanation: c?.explanation ? String(c.explanation).trim() : undefined,
        tags: Array.isArray(c?.tags) ? c.tags.map((t: any) => String(t)) : [subject]
      }))
      .filter((c: GeneratedFlashcardData) => c.front.length > 0 && c.back.length > 0);

    if (normalizedCards.length > 0) {
      return {
        deckTitle: data.deckTitle || (topic ? `${topic} High-Yield Flashcards` : `${subject} Study Deck`),
        subject: data.subject || subject,
        cards: normalizedCards
      };
    }
  }

  throw new Error('AI was unable to generate flashcards for this topic. Please try again.');
}
