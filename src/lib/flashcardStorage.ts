/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Flashcard Deck and Card Storage with Local Persistence & Supabase Sync
 */

import { Flashcard, FlashcardDeck, FlashcardQuality } from '../types';
import { calculateSM2 } from './sm2Algorithm';
import { supabase } from './supabase';

const DECKS_STORAGE_KEY = 'studentos_flashcard_decks_v1';
const CARDS_STORAGE_KEY = 'studentos_flashcard_cards_v1';

export const STARTER_DECKS: FlashcardDeck[] = [
  {
    id: 'deck-bio-cell',
    title: 'Cellular Biology & Genetics',
    description: 'Master ATP synthesis, molecular replication, cellular respiration, and CRISPR mechanisms.',
    subject: 'Biology',
    color: 'from-emerald-500 to-teal-700',
    icon: '🧬',
    createdAt: new Date(Date.now() - 86400000 * 10).toISOString(),
    updatedAt: new Date(Date.now() - 86400000 * 2).toISOString(),
    createdBy: 'system',
    tags: ['AP Bio', 'Genetics', 'Cellular Respiration'],
    isFavorite: true
  },
  {
    id: 'deck-physics-mech',
    title: 'AP Physics: Mechanics & Kinematics',
    description: 'Newtonian dynamics, conservation laws, momentum, torque, and simple harmonic oscillations.',
    subject: 'Physics',
    color: 'from-blue-600 to-indigo-800',
    icon: '⚛️',
    createdAt: new Date(Date.now() - 86400000 * 8).toISOString(),
    updatedAt: new Date(Date.now() - 86400000 * 1).toISOString(),
    createdBy: 'system',
    tags: ['AP Physics', 'Mechanics', 'Kinematics', 'Formulas'],
    isFavorite: true
  },
  {
    id: 'deck-cs-dsa',
    title: 'Data Structures & Algorithms',
    description: 'Big-O notation, tree traversals, dynamic programming, sorting bounds, and graph search.',
    subject: 'Computer Science',
    color: 'from-violet-600 to-purple-900',
    icon: '💻',
    createdAt: new Date(Date.now() - 86400000 * 6).toISOString(),
    updatedAt: new Date(Date.now() - 86400000 * 1).toISOString(),
    createdBy: 'system',
    tags: ['Algorithms', 'Data Structures', 'Coding Prep'],
    isFavorite: true
  },
  {
    id: 'deck-calc-math',
    title: 'Calculus: High-Yield Theorems',
    description: 'Differentiation rules, integration techniques, Taylor expansions, and fundamental theorems.',
    subject: 'Mathematics',
    color: 'from-amber-500 to-orange-700',
    icon: '📐',
    createdAt: new Date(Date.now() - 86400000 * 5).toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: 'system',
    tags: ['Calculus', 'Limits', 'Derivatives', 'Integrals'],
    isFavorite: false
  },
  {
    id: 'deck-world-history',
    title: 'World History: Global Turning Points',
    description: 'Westphalian sovereignty, Industrial revolution, Enlightenment philosophy, and world wars.',
    subject: 'History',
    color: 'from-rose-500 to-pink-800',
    icon: '🏛️',
    createdAt: new Date(Date.now() - 86400000 * 4).toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: 'system',
    tags: ['World History', 'AP Euro', 'Modern Era'],
    isFavorite: false
  }
];

export const STARTER_CARDS: Flashcard[] = [
  // Deck 1: Biology
  {
    id: 'card-bio-1',
    deckId: 'deck-bio-cell',
    front: 'What is the primary role of ATP Synthase in cellular respiration?',
    back: 'It utilizes the proton (H+) electrochemical gradient across the inner mitochondrial membrane to phosphorylate ADP into ATP via chemiosmosis.',
    hint: 'Think about rotary motor catalysis and proton gradients.',
    tags: ['Mitochondria', 'Chemiosmosis'],
    interval: 6,
    repetition: 2,
    easeFactor: 2.5,
    nextReviewDate: new Date(Date.now() + 86400000 * 2).toISOString(),
    state: 'review'
  },
  {
    id: 'card-bio-2',
    deckId: 'deck-bio-cell',
    front: 'What are the three core stages of the Calvin Cycle in photosynthesis?',
    back: '1. Carbon Fixation (catalyzed by the enzyme RuBisCO)\n2. Reduction of 3-PGA to G3P (using ATP and NADPH)\n3. Regeneration of RuBP (Ribulose 1,5-bisphosphate)',
    hint: 'Fixation -> Reduction -> Regeneration.',
    tags: ['Photosynthesis', 'Light-Independent'],
    interval: 1,
    repetition: 1,
    easeFactor: 2.4,
    nextReviewDate: new Date(Date.now() - 86400000).toISOString(), // Due today
    state: 'learning'
  },
  {
    id: 'card-bio-3',
    deckId: 'deck-bio-cell',
    front: 'How does the CRISPR-Cas9 complex achieve site-specific DNA cleavage?',
    back: 'A single guide RNA (sgRNA) matches a 20-nucleotide target DNA sequence immediately adjacent to a Protospacer Adjacent Motif (PAM). Cas9 introduces a double-stranded break (DSB) 3-4 nucleotides upstream of the PAM.',
    hint: 'Requires both guide RNA and a PAM recognition motif.',
    tags: ['Biotechnology', 'Gene Editing'],
    interval: 0,
    repetition: 0,
    easeFactor: 2.5,
    nextReviewDate: new Date().toISOString(), // Due now
    state: 'new'
  },
  {
    id: 'card-bio-4',
    deckId: 'deck-bio-cell',
    front: 'Differentiate between Mitosis and Meiosis in terms of daughter cells and genetic variation.',
    back: '• Mitosis: Produces 2 genetically identical diploid (2n) somatic cells with 1 division.\n• Meiosis: Produces 4 genetically unique haploid (n) gametes through 2 divisions, with crossing over in Prophase I.',
    hint: 'Somatic identity vs gametic variation.',
    tags: ['Cell Division', 'Genetics'],
    interval: 24,
    repetition: 4,
    easeFactor: 2.65,
    nextReviewDate: new Date(Date.now() + 86400000 * 14).toISOString(),
    state: 'mastered'
  },
  {
    id: 'card-bio-5',
    deckId: 'deck-bio-cell',
    front: 'What is the function of DNA Ligase during lagging-strand DNA replication?',
    back: 'It catalyzes phosphodiester bonds between adjacent 3\'-hydroxyl and 5\'-phosphate ends, sealing nicks and joining Okazaki fragments.',
    hint: 'Molecular glue of the lagging strand.',
    tags: ['DNA Replication'],
    interval: 0,
    repetition: 0,
    easeFactor: 2.5,
    nextReviewDate: new Date().toISOString(),
    state: 'new'
  },

  // Deck 2: Physics
  {
    id: 'card-phys-1',
    deckId: 'deck-physics-mech',
    front: 'State Newton\'s Second Law in both acceleration and momentum forms.',
    back: '• Acceleration form: F_net = m · a\n• Momentum form: F_net = dp/dt (Net force is the time rate of change of linear momentum)',
    hint: 'Force relates to rate of momentum change.',
    tags: ['Newtonian Mechanics', 'Dynamics'],
    interval: 1,
    repetition: 1,
    easeFactor: 2.5,
    nextReviewDate: new Date(Date.now() - 3600000).toISOString(), // Due
    state: 'review'
  },
  {
    id: 'card-phys-2',
    deckId: 'deck-physics-mech',
    front: 'What defines a conservative force, and what are two classical examples?',
    back: 'A force is conservative if the work done moving a particle between two points is path-independent (closed loop work = 0).\nExamples: Gravity (F_g = mg) and Spring Hookean force (F_s = -kx).',
    hint: 'Path independence and potential energy functions.',
    tags: ['Energy', 'Forces'],
    interval: 0,
    repetition: 0,
    easeFactor: 2.5,
    nextReviewDate: new Date().toISOString(),
    state: 'new'
  },
  {
    id: 'card-phys-3',
    deckId: 'deck-physics-mech',
    front: 'What is the formula for the Escape Velocity from a celestial body of mass M and radius R?',
    back: 'v_esc = √(2 · G · M / R)\nDerived by equating initial kinetic energy (½ m v²) to the gravitational potential binding energy (G M m / R).',
    hint: 'Square root of 2GM/R.',
    tags: ['Gravitation', 'Orbital Mechanics'],
    interval: 8,
    repetition: 2,
    easeFactor: 2.6,
    nextReviewDate: new Date(Date.now() + 86400000 * 5).toISOString(),
    state: 'review'
  },
  {
    id: 'card-phys-4',
    deckId: 'deck-physics-mech',
    front: 'What is the period (T) of a simple pendulum and a mass-spring oscillator?',
    back: '• Simple Pendulum: T = 2π √(L / g) (for small angle θ < 15°)\n• Mass-Spring: T = 2π √(m / k)',
    hint: '2π times square root of length/gravity or mass/k.',
    tags: ['SHM', 'Oscillations'],
    interval: 0,
    repetition: 0,
    easeFactor: 2.5,
    nextReviewDate: new Date().toISOString(),
    state: 'new'
  },

  // Deck 3: CS DSA
  {
    id: 'card-cs-1',
    deckId: 'deck-cs-dsa',
    front: 'Explain the Time & Space complexities of QuickSort in best, average, and worst cases.',
    back: '• Best / Average Time: O(n log n)\n• Worst Time: O(n²) (when pivot is consistently minimum/maximum on already sorted data without random pivot)\n• Auxiliary Space: O(log n) call stack space.',
    hint: 'Consider unbalanced partitions for worst case.',
    tags: ['Sorting', 'Algorithms'],
    interval: 1,
    repetition: 1,
    easeFactor: 2.5,
    nextReviewDate: new Date(Date.now() - 7200000).toISOString(),
    state: 'learning'
  },
  {
    id: 'card-cs-2',
    deckId: 'deck-cs-dsa',
    front: 'What is the difference between Dynamic Programming and Divide & Conquer?',
    back: '• Divide & Conquer breaks a problem into independent, non-overlapping subproblems (e.g. MergeSort).\n• Dynamic Programming is applied when subproblems overlap and exhibit optimal substructure, caching results (memoization/tabulation) to avoid duplicate computation.',
    hint: 'Overlapping subproblems vs independent subproblems.',
    tags: ['DP', 'Optimization'],
    interval: 15,
    repetition: 3,
    easeFactor: 2.7,
    nextReviewDate: new Date(Date.now() + 86400000 * 8).toISOString(),
    state: 'review'
  },
  {
    id: 'card-cs-3',
    deckId: 'deck-cs-dsa',
    front: 'How does Dijkstra\'s Algorithm operate, and why does it fail on negative edge weights?',
    back: 'It uses a Min-Priority Queue to greedily explore the shortest known path distance. It fails on negative edge weights because once a vertex is marked "visited", Dijkstra assumes its optimal distance is finalized and never re-relaxes edges (use Bellman-Ford instead).',
    hint: 'Greedy assumption violated by negative cycle/weights.',
    tags: ['Graphs', 'Shortest Path'],
    interval: 0,
    repetition: 0,
    easeFactor: 2.5,
    nextReviewDate: new Date().toISOString(),
    state: 'new'
  },
  {
    id: 'card-cs-4',
    deckId: 'deck-cs-dsa',
    front: 'What are the time complexities for Red-Black Tree operations (Search, Insert, Delete)?',
    back: 'All primary operations (Search, Insert, Delete) are strictly O(log n) in both average and worst cases due to guaranteed logarithmic height (h ≤ 2 log₂(n + 1)).',
    hint: 'Self-balancing property guarantees logarithmic bounds.',
    tags: ['Trees', 'Data Structures'],
    interval: 25,
    repetition: 5,
    easeFactor: 2.8,
    nextReviewDate: new Date(Date.now() + 86400000 * 20).toISOString(),
    state: 'mastered'
  },

  // Deck 4: Calculus
  {
    id: 'card-calc-1',
    deckId: 'deck-calc-math',
    front: 'State the Fundamental Theorem of Calculus (Part 1 and Part 2).',
    back: '• Part 1: If g(x) = ∫[a to x] f(t) dt, then g\'(x) = f(x).\n• Part 2: ∫[a to b] f(x) dx = F(b) - F(a), where F is any antiderivative of f (F\' = f).',
    hint: 'Connecting differentiation and integration.',
    tags: ['Calculus', 'Theorems'],
    interval: 0,
    repetition: 0,
    easeFactor: 2.5,
    nextReviewDate: new Date().toISOString(),
    state: 'new'
  },
  {
    id: 'card-calc-2',
    deckId: 'deck-calc-math',
    front: 'What is Euler\'s Formula, and what famous identity does it produce when θ = π?',
    back: '• Euler\'s Formula: e^(iθ) = cos(θ) + i · sin(θ)\n• When θ = π, it yields Euler\'s Identity: e^(iπ) + 1 = 0, connecting e, i, π, 1, and 0.',
    hint: 'Exponential relation to sine and cosine.',
    tags: ['Complex Numbers', 'Trigonometry'],
    interval: 3,
    repetition: 1,
    easeFactor: 2.6,
    nextReviewDate: new Date(Date.now() - 3600000).toISOString(),
    state: 'review'
  },
  {
    id: 'card-calc-3',
    deckId: 'deck-calc-math',
    front: 'Write the Integration by Parts formula and explain the LIATE priority rule.',
    back: 'Formula: ∫ u dv = u·v - ∫ v du\nLIATE priority order for choosing \'u\':\n1. L = Logarithmic\n2. I = Inverse Trigonometric\n3. A = Algebraic\n4. T = Trigonometric\n5. E = Exponential',
    hint: 'u times v minus integral of v du.',
    tags: ['Integration', 'Techniques'],
    interval: 0,
    repetition: 0,
    easeFactor: 2.5,
    nextReviewDate: new Date().toISOString(),
    state: 'new'
  },

  // Deck 5: History
  {
    id: 'card-hist-1',
    deckId: 'deck-world-history',
    front: 'What was the revolutionary geopolitical doctrine established by the 1648 Peace of Westphalia?',
    back: 'It established Westphalian Sovereignty: the principle of international law that each sovereign state has exclusive territorial jurisdiction over its domestic affairs and religious governance without external interference.',
    hint: 'Concept of modern nation-state sovereignty.',
    tags: ['International Relations', 'European History'],
    interval: 0,
    repetition: 0,
    easeFactor: 2.5,
    nextReviewDate: new Date().toISOString(),
    state: 'new'
  },
  {
    id: 'card-hist-2',
    deckId: 'deck-world-history',
    front: 'What were the four M-A-I-N long-term causes that led to World War I?',
    back: '1. Militarism: Arms races, especially naval buildup between Britain & Germany.\n2. Alliances: Secret pacts (Triple Entente vs Triple Alliance).\n3. Imperialism: Scramble for African and Asian resources.\n4. Nationalism: Intense Slavic and ethnic self-determination aspirations in the Balkans.',
    hint: 'M - A - I - N acronym.',
    tags: ['WWI', '20th Century'],
    interval: 4,
    repetition: 2,
    easeFactor: 2.5,
    nextReviewDate: new Date(Date.now() - 86400000).toISOString(),
    state: 'review'
  }
];

// Helper to safely load decks from LocalStorage with seed fallback
export function getStoredDecks(): FlashcardDeck[] {
  try {
    const raw = localStorage.getItem(DECKS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.warn('[Flashcards] Failed to read stored decks:', e);
  }

  // Seed default decks
  try {
    localStorage.setItem(DECKS_STORAGE_KEY, JSON.stringify(STARTER_DECKS));
  } catch (e) {}
  return [...STARTER_DECKS];
}

// Helper to save decks
export function saveStoredDecks(decks: FlashcardDeck[]): void {
  try {
    localStorage.setItem(DECKS_STORAGE_KEY, JSON.stringify(decks));
  } catch (e) {
    console.error('[Flashcards] Failed to persist decks:', e);
  }
}

// Helper to load cards
export function getStoredCards(): Flashcard[] {
  try {
    const raw = localStorage.getItem(CARDS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.warn('[Flashcards] Failed to read stored cards:', e);
  }

  // Seed default cards
  try {
    localStorage.setItem(CARDS_STORAGE_KEY, JSON.stringify(STARTER_CARDS));
  } catch (e) {}
  return [...STARTER_CARDS];
}

// Helper to save cards
export function saveStoredCards(cards: Flashcard[]): void {
  try {
    localStorage.setItem(CARDS_STORAGE_KEY, JSON.stringify(cards));
  } catch (e) {
    console.error('[Flashcards] Failed to persist cards:', e);
  }
}

// Save or Update a single Deck
export function upsertDeck(deck: FlashcardDeck): FlashcardDeck[] {
  const current = getStoredDecks();
  const index = current.findIndex(d => d.id === deck.id);
  let updated: FlashcardDeck[];
  if (index >= 0) {
    updated = [...current];
    updated[index] = { ...deck, updatedAt: new Date().toISOString() };
  } else {
    updated = [deck, ...current];
  }
  saveStoredDecks(updated);
  return updated;
}

// Delete Deck and associated cards
export function removeDeck(deckId: string): { decks: FlashcardDeck[]; cards: Flashcard[] } {
  const decks = getStoredDecks().filter(d => d.id !== deckId);
  const cards = getStoredCards().filter(c => c.deckId !== deckId);
  saveStoredDecks(decks);
  saveStoredCards(cards);
  return { decks, cards };
}

// Add or edit a Card
export function upsertCard(card: Flashcard): Flashcard[] {
  const current = getStoredCards();
  const index = current.findIndex(c => c.id === card.id);
  let updated: Flashcard[];
  if (index >= 0) {
    updated = [...current];
    updated[index] = card;
  } else {
    updated = [card, ...current];
  }
  saveStoredCards(updated);
  return updated;
}

// Delete a single Card
export function removeCard(cardId: string): Flashcard[] {
  const updated = getStoredCards().filter(c => c.id !== cardId);
  saveStoredCards(updated);
  return updated;
}

// Process an SM-2 Review response for a card
export function logCardReview(cardId: string, quality: FlashcardQuality): { card: Flashcard; allCards: Flashcard[] } {
  const cards = getStoredCards();
  const cardIndex = cards.findIndex(c => c.id === cardId);
  if (cardIndex < 0) {
    throw new Error('Card not found: ' + cardId);
  }

  const existing = cards[cardIndex];
  const now = new Date();
  const sm2Result = calculateSM2(existing, quality, now);

  const newLog = {
    date: now.toISOString(),
    rating: quality,
    interval: sm2Result.interval
  };

  const updatedCard: Flashcard = {
    ...existing,
    interval: sm2Result.interval,
    repetition: sm2Result.repetition,
    easeFactor: sm2Result.easeFactor,
    nextReviewDate: sm2Result.nextReviewDate,
    lastReviewedDate: now.toISOString(),
    state: sm2Result.state,
    history: [...(existing.history || []), newLog]
  };

  const updatedCards = [...cards];
  updatedCards[cardIndex] = updatedCard;
  saveStoredCards(updatedCards);

  return { card: updatedCard, allCards: updatedCards };
}

// Reset deck progress (restart spaced repetition for all cards in deck)
export function resetDeckProgress(deckId: string): Flashcard[] {
  const cards = getStoredCards();
  const updated = cards.map(c => {
    if (c.deckId === deckId) {
      return {
        ...c,
        interval: 0,
        repetition: 0,
        easeFactor: 2.5,
        nextReviewDate: new Date().toISOString(),
        state: 'new' as const,
        lastReviewedDate: undefined
      };
    }
    return c;
  });
  saveStoredCards(updated);
  return updated;
}

// ==========================================
// SUPABASE CLOUD SYNCHRONIZATION HELPERS
// ==========================================

export async function fetchSupabaseDecks(userId?: string): Promise<FlashcardDeck[] | null> {
  if (!supabase) return null;
  try {
    const query = supabase.from('flashcard_decks').select('*');
    if (userId) {
      query.or(`user_id.eq.${userId},user_id.eq.system,user_id.is.null`);
    }
    const { data, error } = await query;
    if (error || !data) return null;

    return data.map((d: any) => ({
      id: d.id,
      title: d.title,
      description: d.description || '',
      subject: d.subject || 'General',
      color: d.color || 'from-indigo-600 to-violet-800',
      icon: d.icon || '📚',
      tags: Array.isArray(d.tags) ? d.tags : [],
      isFavorite: Boolean(d.is_favorite),
      createdAt: d.created_at || new Date().toISOString(),
      updatedAt: d.updated_at || new Date().toISOString(),
      createdBy: d.user_id || 'system'
    }));
  } catch (err) {
    console.warn('[Flashcards] Supabase decks fetch error (using local storage):', err);
    return null;
  }
}

export async function fetchSupabaseCards(deckId?: string): Promise<Flashcard[] | null> {
  if (!supabase) return null;
  try {
    let query = supabase.from('flashcards').select('*');
    if (deckId) {
      query = query.eq('deck_id', deckId);
    }
    const { data, error } = await query;
    if (error || !data) return null;

    return data.map((c: any) => ({
      id: c.id,
      deckId: c.deck_id,
      front: c.front,
      back: c.back,
      hint: c.hint || undefined,
      tags: Array.isArray(c.tags) ? c.tags : [],
      interval: c.interval || 0,
      repetition: c.repetition || 0,
      easeFactor: Number(c.ease_factor) || 2.5,
      nextReviewDate: c.next_review_date || new Date().toISOString(),
      lastReviewedDate: c.last_reviewed_date || undefined,
      state: (c.state as any) || 'new',
      history: Array.isArray(c.history) ? c.history : []
    }));
  } catch (err) {
    console.warn('[Flashcards] Supabase cards fetch error (using local storage):', err);
    return null;
  }
}

export async function syncDeckToSupabase(deck: FlashcardDeck, userId?: string): Promise<void> {
  if (!supabase) return;
  try {
    await supabase.from('flashcard_decks').upsert({
      id: deck.id,
      user_id: userId || deck.createdBy || 'system',
      title: deck.title,
      description: deck.description,
      subject: deck.subject,
      color: deck.color,
      icon: deck.icon,
      tags: deck.tags || [],
      is_favorite: Boolean(deck.isFavorite),
      updated_at: new Date().toISOString()
    });
  } catch (err) {
    console.warn('[Flashcards] Failed to sync deck to Supabase:', err);
  }
}

export async function syncCardToSupabase(card: Flashcard, userId?: string): Promise<void> {
  if (!supabase) return;
  try {
    await supabase.from('flashcards').upsert({
      id: card.id,
      deck_id: card.deckId,
      user_id: userId || 'system',
      front: card.front,
      back: card.back,
      hint: card.hint || null,
      tags: card.tags || [],
      interval: card.interval,
      repetition: card.repetition,
      ease_factor: card.easeFactor,
      next_review_date: card.nextReviewDate,
      last_reviewed_date: card.lastReviewedDate || null,
      state: card.state,
      history: card.history || [],
      updated_at: new Date().toISOString()
    });
  } catch (err) {
    console.warn('[Flashcards] Failed to sync card to Supabase:', err);
  }
}
