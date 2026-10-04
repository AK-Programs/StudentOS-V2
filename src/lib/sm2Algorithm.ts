/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * SuperMemo SM-2 Spaced Repetition Algorithm Implementation (Anki-Style)
 */

import { Flashcard, FlashcardQuality, FlashcardState } from '../types';

export interface SM2Result {
  interval: number; // in days
  repetition: number;
  easeFactor: number;
  nextReviewDate: string; // ISO string
  state: FlashcardState;
}

/**
 * Standard SuperMemo SM-2 calculation adapted for Anki 4-button review:
 * - Again (1): Blackout or forgot
 * - Hard (3): Recalled with high friction
 * - Good (4): Normal recall after standard interval
 * - Easy (5): Instant fluent recall
 */
export function calculateSM2(
  card: Pick<Flashcard, 'interval' | 'repetition' | 'easeFactor'>,
  quality: FlashcardQuality,
  currentDate: Date = new Date()
): SM2Result {
  let { interval, repetition, easeFactor } = card;

  // Ensure baseline defaults
  if (typeof easeFactor !== 'number' || isNaN(easeFactor) || easeFactor < 1.3) {
    easeFactor = 2.5;
  }
  if (typeof repetition !== 'number' || isNaN(repetition)) {
    repetition = 0;
  }
  if (typeof interval !== 'number' || isNaN(interval)) {
    interval = 0;
  }

  let nextInterval: number;
  let nextRepetition: number;
  let nextEaseFactor: number;
  let nextState: FlashcardState;

  if (quality < 3) {
    // FAIL / AGAIN: Reset repetitions, review tomorrow or in 1 day
    nextRepetition = 0;
    nextInterval = 1;
    // Penalize ease factor slightly
    nextEaseFactor = Math.max(1.3, easeFactor - 0.2);
    nextState = 'learning';
  } else if (quality === 3) {
    // HARD: Slower interval growth, reduce ease factor
    nextRepetition = repetition + 1;
    if (repetition === 0) {
      nextInterval = 1;
    } else if (repetition === 1) {
      nextInterval = 3;
    } else {
      nextInterval = Math.max(interval + 1, Math.round(interval * 1.2));
    }
    nextEaseFactor = Math.max(1.3, easeFactor - 0.15);
    nextState = 'review';
  } else if (quality === 4) {
    // GOOD: Standard SM-2 interval progression
    nextRepetition = repetition + 1;
    if (repetition === 0) {
      nextInterval = 1;
    } else if (repetition === 1) {
      nextInterval = 6;
    } else {
      nextInterval = Math.max(interval + 1, Math.round(interval * easeFactor));
    }
    // Standard SM-2 formula: EF' = EF + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
    const delta = 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02);
    nextEaseFactor = Math.max(1.3, Number((easeFactor + delta).toFixed(2)));
    nextState = nextInterval >= 21 ? 'mastered' : 'review';
  } else {
    // EASY (quality >= 5): Boost interval & ease factor
    nextRepetition = repetition + 1;
    if (repetition === 0) {
      nextInterval = 3;
    } else if (repetition === 1) {
      nextInterval = 8;
    } else {
      nextInterval = Math.max(interval + 2, Math.round(interval * easeFactor * 1.35));
    }
    nextEaseFactor = Math.min(3.5, Number((easeFactor + 0.15).toFixed(2)));
    nextState = nextInterval >= 21 ? 'mastered' : 'review';
  }

  // Calculate Next Review Date
  const nextDate = new Date(currentDate.getTime());
  nextDate.setHours(currentDate.getHours() + nextInterval * 24);

  return {
    interval: nextInterval,
    repetition: nextRepetition,
    easeFactor: nextEaseFactor,
    nextReviewDate: nextDate.toISOString(),
    state: nextState
  };
}

/**
 * Human friendly format for next review interval label on buttons
 */
export function formatIntervalDays(days: number): string {
  if (days <= 0) return '< 1d';
  if (days === 1) return '1d';
  if (days < 7) return `${days}d`;
  if (days < 30) {
    const weeks = Math.round(days / 7);
    return `${weeks}w`;
  }
  const months = Math.round(days / 30);
  return `${months}mo`;
}

/**
 * Preview what the interval will be for each of the 4 buttons on a card
 */
export function getButtonIntervalPreviews(card: Pick<Flashcard, 'interval' | 'repetition' | 'easeFactor'>) {
  const again = calculateSM2(card, 1);
  const hard = calculateSM2(card, 3);
  const good = calculateSM2(card, 4);
  const easy = calculateSM2(card, 5);

  return {
    again: formatIntervalDays(again.interval),
    hard: formatIntervalDays(hard.interval),
    good: formatIntervalDays(good.interval),
    easy: formatIntervalDays(easy.interval)
  };
}

/**
 * Filter due cards for spaced repetition
 */
export function isCardDue(card: Flashcard, now: Date = new Date()): boolean {
  if (card.state === 'new') return true;
  if (!card.nextReviewDate) return true;
  return new Date(card.nextReviewDate).getTime() <= now.getTime();
}

/**
 * Compute deck-wide retention and progress statistics
 */
export interface DeckStats {
  total: number;
  dueToday: number;
  newCount: number;
  learningCount: number;
  reviewCount: number;
  masteredCount: number;
  retentionRate: number; // percentage 0-100
  avgEaseFactor: number;
}

export function calculateDeckStats(cards: Flashcard[], now: Date = new Date()): DeckStats {
  if (!cards || cards.length === 0) {
    return {
      total: 0,
      dueToday: 0,
      newCount: 0,
      learningCount: 0,
      reviewCount: 0,
      masteredCount: 0,
      retentionRate: 100,
      avgEaseFactor: 2.5
    };
  }

  let dueToday = 0;
  let newCount = 0;
  let learningCount = 0;
  let reviewCount = 0;
  let masteredCount = 0;
  let totalEase = 0;
  let successfulReviews = 0;
  let totalReviews = 0;

  for (const card of cards) {
    if (isCardDue(card, now)) {
      dueToday++;
    }

    if (card.state === 'new') newCount++;
    else if (card.state === 'learning') learningCount++;
    else if (card.state === 'review') reviewCount++;
    else if (card.state === 'mastered') masteredCount++;

    totalEase += card.easeFactor || 2.5;

    if (card.history && card.history.length > 0) {
      for (const h of card.history) {
        totalReviews++;
        if (h.rating >= 3) {
          successfulReviews++;
        }
      }
    }
  }

  const avgEase = Number((totalEase / cards.length).toFixed(2));
  const retentionRate = totalReviews > 0
    ? Math.round((successfulReviews / totalReviews) * 100)
    : Math.round(((masteredCount * 1.0 + reviewCount * 0.75 + learningCount * 0.4) / Math.max(1, cards.length)) * 100);

  return {
    total: cards.length,
    dueToday,
    newCount,
    learningCount,
    reviewCount,
    masteredCount,
    retentionRate: Math.max(10, Math.min(100, retentionRate)),
    avgEaseFactor: avgEase
  };
}
