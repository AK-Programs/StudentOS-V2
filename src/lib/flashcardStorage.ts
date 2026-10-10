/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Flashcard Deck, Card, and Per-User Progress Storage
 * Canonical Source of Truth: StudentOS Supabase (`flashcard_decks`, `flashcards`, `flashcard_study_progress`, `global_data`)
 * Browser storage is used solely as a fast temporary cache and unsaved-work recovery layer.
 */

import { Flashcard, FlashcardDeck, FlashcardQuality, FlashcardState, FlashcardStudyProgress, FlashcardReviewLog } from '../types';
import { calculateSM2 } from './sm2Algorithm';
import { supabase } from './supabase';

const DECKS_CACHE_KEY = 'studentos_flashcard_decks_v2';
const CARDS_CACHE_KEY = 'studentos_flashcard_cards_v2';
const PROGRESS_CACHE_PREFIX = 'studentos_flashcard_progress_v2_';

export function getCanonicalUserId(userId?: string | null): string {
  if (userId && typeof userId === 'string' && userId.trim().length > 0) {
    return userId.trim();
  }
  try {
    const rawUser = localStorage.getItem('s_os_user');
    if (rawUser) {
      const parsed = JSON.parse(rawUser);
      if (parsed?.uid) return String(parsed.uid).trim();
      if (parsed?.email) return String(parsed.email).trim();
    }
  } catch (_) {}
  return 'default_student';
}

export const STARTER_DECKS: FlashcardDeck[] = [
  {
    id: 'deck-bio-cell',
    title: 'Cellular Biology & Genetics',
    description: 'Master ATP synthesis, molecular replication, cellular respiration, and CRISPR mechanisms.',
    subject: 'Biology',
    color: 'from-emerald-500 to-teal-700',
    icon: '🧬',
    createdAt: '2026-09-25T10:00:00.000Z',
    updatedAt: '2026-09-25T10:00:00.000Z',
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
    createdAt: '2026-09-26T10:00:00.000Z',
    updatedAt: '2026-09-26T10:00:00.000Z',
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
    createdAt: '2026-09-27T10:00:00.000Z',
    updatedAt: '2026-09-27T10:00:00.000Z',
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
    createdAt: '2026-09-28T10:00:00.000Z',
    updatedAt: '2026-09-28T10:00:00.000Z',
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
    createdAt: '2026-09-29T10:00:00.000Z',
    updatedAt: '2026-09-29T10:00:00.000Z',
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
    interval: 0,
    repetition: 0,
    easeFactor: 2.5,
    nextReviewDate: '2026-09-25T10:00:00.000Z',
    state: 'new'
  },
  {
    id: 'card-bio-2',
    deckId: 'deck-bio-cell',
    front: 'What are the three core stages of the Calvin Cycle in photosynthesis?',
    back: '1. Carbon Fixation (catalyzed by the enzyme RuBisCO)\n2. Reduction of 3-PGA to G3P (using ATP and NADPH)\n3. Regeneration of RuBP (Ribulose 1,5-bisphosphate)',
    hint: 'Fixation -> Reduction -> Regeneration.',
    tags: ['Photosynthesis', 'Light-Independent'],
    interval: 0,
    repetition: 0,
    easeFactor: 2.5,
    nextReviewDate: '2026-09-25T10:00:00.000Z',
    state: 'new'
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
    nextReviewDate: '2026-09-25T10:00:00.000Z',
    state: 'new'
  },
  {
    id: 'card-bio-4',
    deckId: 'deck-bio-cell',
    front: 'Differentiate between Mitosis and Meiosis in terms of daughter cells and genetic variation.',
    back: '• Mitosis: Produces 2 genetically identical diploid (2n) somatic cells with 1 division.\n• Meiosis: Produces 4 genetically unique haploid (n) gametes through 2 divisions, with crossing over in Prophase I.',
    hint: 'Somatic identity vs gametic variation.',
    tags: ['Cell Division', 'Genetics'],
    interval: 0,
    repetition: 0,
    easeFactor: 2.5,
    nextReviewDate: '2026-09-25T10:00:00.000Z',
    state: 'new'
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
    nextReviewDate: '2026-09-25T10:00:00.000Z',
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
    interval: 0,
    repetition: 0,
    easeFactor: 2.5,
    nextReviewDate: '2026-09-25T10:00:00.000Z',
    state: 'new'
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
    nextReviewDate: '2026-09-25T10:00:00.000Z',
    state: 'new'
  },
  {
    id: 'card-phys-3',
    deckId: 'deck-physics-mech',
    front: 'What is the formula for the Escape Velocity from a celestial body of mass M and radius R?',
    back: 'v_esc = √(2 · G · M / R)\nDerived by equating initial kinetic energy (½ m v²) to the gravitational potential binding energy (G M m / R).',
    hint: 'Square root of 2GM/R.',
    tags: ['Gravitation', 'Orbital Mechanics'],
    interval: 0,
    repetition: 0,
    easeFactor: 2.5,
    nextReviewDate: '2026-09-25T10:00:00.000Z',
    state: 'new'
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
    nextReviewDate: '2026-09-25T10:00:00.000Z',
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
    interval: 0,
    repetition: 0,
    easeFactor: 2.5,
    nextReviewDate: '2026-09-25T10:00:00.000Z',
    state: 'new'
  },
  {
    id: 'card-cs-2',
    deckId: 'deck-cs-dsa',
    front: 'What is the difference between Dynamic Programming and Divide & Conquer?',
    back: '• Divide & Conquer breaks a problem into independent, non-overlapping subproblems (e.g. MergeSort).\n• Dynamic Programming is applied when subproblems overlap and exhibit optimal substructure, caching results (memoization/tabulation) to avoid duplicate computation.',
    hint: 'Overlapping subproblems vs independent subproblems.',
    tags: ['DP', 'Optimization'],
    interval: 0,
    repetition: 0,
    easeFactor: 2.5,
    nextReviewDate: '2026-09-25T10:00:00.000Z',
    state: 'new'
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
    nextReviewDate: '2026-09-25T10:00:00.000Z',
    state: 'new'
  },
  {
    id: 'card-cs-4',
    deckId: 'deck-cs-dsa',
    front: 'What are the time complexities for Red-Black Tree operations (Search, Insert, Delete)?',
    back: 'All primary operations (Search, Insert, Delete) are strictly O(log n) in both average and worst cases due to guaranteed logarithmic height (h ≤ 2 log₂(n + 1)).',
    hint: 'Self-balancing property guarantees logarithmic bounds.',
    tags: ['Trees', 'Data Structures'],
    interval: 0,
    repetition: 0,
    easeFactor: 2.5,
    nextReviewDate: '2026-09-25T10:00:00.000Z',
    state: 'new'
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
    nextReviewDate: '2026-09-25T10:00:00.000Z',
    state: 'new'
  },
  {
    id: 'card-calc-2',
    deckId: 'deck-calc-math',
    front: 'What is Euler\'s Formula, and what famous identity does it produce when θ = π?',
    back: '• Euler\'s Formula: e^(iθ) = cos(θ) + i · sin(θ)\n• When θ = π, it yields Euler\'s Identity: e^(iπ) + 1 = 0, connecting e, i, π, 1, and 0.',
    hint: 'Exponential relation to sine and cosine.',
    tags: ['Complex Numbers', 'Trigonometry'],
    interval: 0,
    repetition: 0,
    easeFactor: 2.5,
    nextReviewDate: '2026-09-25T10:00:00.000Z',
    state: 'new'
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
    nextReviewDate: '2026-09-25T10:00:00.000Z',
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
    nextReviewDate: '2026-09-25T10:00:00.000Z',
    state: 'new'
  },
  {
    id: 'card-hist-2',
    deckId: 'deck-world-history',
    front: 'What were the four M-A-I-N long-term causes that led to World War I?',
    back: '1. Militarism: Arms races, especially naval buildup between Britain & Germany.\n2. Alliances: Secret pacts (Triple Entente vs Triple Alliance).\n3. Imperialism: Scramble for African and Asian resources.\n4. Nationalism: Intense Slavic and ethnic self-determination aspirations in the Balkans.',
    hint: 'M - A - I - N acronym.',
    tags: ['WWI', '20th Century'],
    interval: 0,
    repetition: 0,
    easeFactor: 2.5,
    nextReviewDate: '2026-09-25T10:00:00.000Z',
    state: 'new'
  }
];

const STARTER_CARD_BY_ID = new Map<string, Flashcard>(STARTER_CARDS.map(c => [c.id, c]));

// ==========================================
// DATA-ACCESS BOUNDARY NORMALIZATION
// ==========================================

export function normalizeFlashcardDeck(raw: any): FlashcardDeck {
  const id = String(raw?.id || raw?.deck_id || `deck-${Date.now()}`).trim();
  const title = String(raw?.title || raw?.name || raw?.deckTitle || 'Untitled Deck').trim();
  const description = String(raw?.description || raw?.summary || '').trim();
  const subject = String(raw?.subject || raw?.category || 'General').trim();
  const color = String(raw?.color || 'from-indigo-600 to-violet-800').trim();
  const icon = String(raw?.icon || '📚').trim();
  const tags = Array.isArray(raw?.tags)
    ? raw.tags.map((t: any) => String(t).trim()).filter(Boolean)
    : [subject];

  return {
    id,
    title,
    description,
    subject,
    color,
    icon,
    tags,
    isFavorite: Boolean(raw?.isFavorite ?? raw?.is_favorite ?? false),
    createdAt: String(raw?.createdAt || raw?.created_at || new Date().toISOString()),
    updatedAt: String(raw?.updatedAt || raw?.updated_at || new Date().toISOString()),
    createdBy: String(raw?.createdBy || raw?.user_id || raw?.owner_id || 'system')
  };
}

export function normalizeFlashcard(raw: any, fallbackDeckId?: string): Flashcard {
  const id = String(raw?.id || raw?.card_id || `card-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`).trim();
  const starterMatch = STARTER_CARD_BY_ID.get(id);

  const deckId = String(
    raw?.deckId || raw?.deck_id || fallbackDeckId || starterMatch?.deckId || 'deck-bio-cell'
  ).trim();

  // Resolve front/question across all possible field aliases without losing data
  const rawFront =
    raw?.front ??
    raw?.question ??
    raw?.front_text ??
    raw?.frontText ??
    raw?.prompt ??
    raw?.term ??
    starterMatch?.front ??
    '';
  const front = String(rawFront).trim() || (starterMatch ? starterMatch.front : '');

  // Resolve back/answer across all possible field aliases, never overwriting with empty fallback
  const rawBack =
    raw?.back ??
    raw?.answer ??
    raw?.back_text ??
    raw?.backText ??
    raw?.definition ??
    raw?.response ??
    starterMatch?.back ??
    '';
  const back = String(rawBack).trim() || (starterMatch ? starterMatch.back : '');

  const rawHint = raw?.hint ?? raw?.hint_text ?? raw?.hintText ?? starterMatch?.hint;
  const hint = rawHint && String(rawHint).trim().length > 0 ? String(rawHint).trim() : undefined;

  const rawExplanation = raw?.explanation ?? raw?.explanation_text ?? raw?.notes ?? raw?.details;
  const explanation =
    rawExplanation && String(rawExplanation).trim().length > 0
      ? String(rawExplanation).trim()
      : undefined;

  const tags = Array.isArray(raw?.tags)
    ? raw.tags.map((t: any) => String(t).trim()).filter(Boolean)
    : starterMatch?.tags || [];

  const interval = typeof raw?.interval === 'number' && !isNaN(raw.interval) ? Math.max(0, raw.interval) : 0;
  const repetition = typeof raw?.repetition === 'number' && !isNaN(raw.repetition) ? Math.max(0, raw.repetition) : 0;
  const rawEase = Number(raw?.easeFactor ?? raw?.ease_factor ?? 2.5);
  const easeFactor = !isNaN(rawEase) && rawEase >= 1.3 ? rawEase : 2.5;

  const validStates: FlashcardState[] = ['new', 'learning', 'review', 'mastered'];
  const rawState = String(raw?.state || 'new') as FlashcardState;
  const state: FlashcardState = validStates.includes(rawState) ? rawState : 'new';

  const history: FlashcardReviewLog[] = Array.isArray(raw?.history)
    ? raw.history.map((h: any) => ({
        date: String(h?.date || new Date().toISOString()),
        rating: Number(h?.rating || 4),
        interval: Number(h?.interval || 0),
        responseType: h?.responseType
      }))
    : [];

  const correctCount =
    typeof raw?.correctCount === 'number'
      ? raw.correctCount
      : typeof raw?.correct_count === 'number'
      ? raw.correct_count
      : history.filter(h => h.rating >= 3).length;

  const incorrectCount =
    typeof raw?.incorrectCount === 'number'
      ? raw.incorrectCount
      : typeof raw?.incorrect_count === 'number'
      ? raw.incorrect_count
      : history.filter(h => h.rating < 3).length;

  const reviewed = Boolean(
    raw?.reviewed ?? (history.length > 0 || repetition > 0 || Boolean(raw?.lastReviewedDate || raw?.last_reviewed_date))
  );

  return {
    id,
    deckId,
    front,
    back,
    hint,
    explanation,
    tags,
    interval,
    repetition,
    easeFactor,
    nextReviewDate: String(raw?.nextReviewDate || raw?.next_review_date || new Date().toISOString()),
    lastReviewedDate: raw?.lastReviewedDate || raw?.last_reviewed_date || undefined,
    state,
    reviewed,
    lastResponse: raw?.lastResponse || raw?.last_response || undefined,
    correctCount,
    incorrectCount,
    updatedAt: raw?.updatedAt || raw?.updated_at || undefined,
    history
  };
}

/**
 * Overlay a specific student's progress onto a card without ever overwriting front/back/hint/deckId
 */
export function applyUserProgressToCard(card: Flashcard, progress?: FlashcardStudyProgress | null): Flashcard {
  if (!progress) {
    // If this is a shared starter card and the current user has no progress record for it yet,
    // return clean unreviewed baseline so another user's progress never leaks.
    if (STARTER_CARD_BY_ID.has(card.id)) {
      return {
        ...card,
        interval: 0,
        repetition: 0,
        easeFactor: 2.5,
        nextReviewDate: '2026-09-25T10:00:00.000Z',
        lastReviewedDate: undefined,
        state: 'new',
        reviewed: false,
        lastResponse: undefined,
        correctCount: 0,
        incorrectCount: 0,
        history: []
      };
    }
    return card;
  }

  return {
    ...card,
    // Strictly preserve card identity and question/answer content
    id: card.id,
    deckId: card.deckId,
    front: card.front,
    back: card.back,
    hint: card.hint,
    explanation: card.explanation,
    tags: card.tags,
    // Apply per-user progress fields
    interval: progress.interval ?? 0,
    repetition: progress.repetition ?? 0,
    easeFactor: progress.easeFactor ?? 2.5,
    state: progress.state || 'new',
    nextReviewDate: progress.nextReviewDate || new Date().toISOString(),
    lastReviewedDate: progress.lastReviewedDate,
    reviewed: Boolean(progress.reviewed),
    lastResponse: progress.lastResponse,
    correctCount: progress.correctCount ?? 0,
    incorrectCount: progress.incorrectCount ?? 0,
    history: Array.isArray(progress.history) ? progress.history : [],
    updatedAt: progress.updatedAt
  };
}

// ==========================================
// LOCAL CACHE HELPERS (Non-canonical cache only)
// ==========================================

export function getStoredDecks(): FlashcardDeck[] {
  try {
    const raw = localStorage.getItem(DECKS_CACHE_KEY) || localStorage.getItem('studentos_flashcard_decks_v1');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map(normalizeFlashcardDeck);
      }
    }
  } catch (e) {
    console.warn('[Flashcards] Failed to read cached decks:', e);
  }
  return [...STARTER_DECKS];
}

export function saveStoredDecks(decks: FlashcardDeck[]): void {
  try {
    const normalized = decks.map(normalizeFlashcardDeck);
    localStorage.setItem(DECKS_CACHE_KEY, JSON.stringify(normalized));
  } catch (e) {
    console.warn('[Flashcards] Failed to update local deck cache:', e);
  }
}

export function getStoredCards(): Flashcard[] {
  try {
    const raw = localStorage.getItem(CARDS_CACHE_KEY) || localStorage.getItem('studentos_flashcard_cards_v1');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map(c => normalizeFlashcard(c));
      }
    }
  } catch (e) {
    console.warn('[Flashcards] Failed to read cached cards:', e);
  }
  return [...STARTER_CARDS];
}

export function saveStoredCards(cards: Flashcard[]): void {
  try {
    const normalized = cards.map(c => normalizeFlashcard(c));
    localStorage.setItem(CARDS_CACHE_KEY, JSON.stringify(normalized));
  } catch (e) {
    console.warn('[Flashcards] Failed to update local card cache:', e);
  }
}

function getCachedProgressMap(userId?: string): Record<string, FlashcardStudyProgress> {
  const uid = getCanonicalUserId(userId);
  try {
    const raw = localStorage.getItem(`${PROGRESS_CACHE_PREFIX}${uid}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') return parsed;
    }
  } catch (_) {}
  return {};
}

function saveCachedProgressMap(userId: string | undefined, map: Record<string, FlashcardStudyProgress>): void {
  const uid = getCanonicalUserId(userId);
  try {
    localStorage.setItem(`${PROGRESS_CACHE_PREFIX}${uid}`, JSON.stringify(map));
  } catch (_) {}
}

// ==========================================
// SUPABASE PER-USER PROGRESS PERSISTENCE
// ==========================================

export async function fetchUserProgressFromSupabase(
  userId?: string
): Promise<Record<string, FlashcardStudyProgress>> {
  const uid = getCanonicalUserId(userId);
  const progressMap: Record<string, FlashcardStudyProgress> = {
    ...getCachedProgressMap(uid)
  };

  if (!supabase) return progressMap;

  // 1. Primary: Check global_data per-user progress document
  try {
    const { data: gdRow, error: gdErr } = await supabase
      .from('global_data')
      .select('data')
      .eq('id', `__flashcard_progress_${uid}__`)
      .maybeSingle();

    if (!gdErr && gdRow?.data && typeof gdRow.data === 'object' && !Array.isArray(gdRow.data)) {
      for (const [cardId, prog] of Object.entries(gdRow.data as Record<string, any>)) {
        if (prog && typeof prog === 'object') {
          progressMap[cardId] = {
            userId: uid,
            deckId: String(prog.deckId || prog.deck_id || ''),
            cardId,
            reviewed: Boolean(prog.reviewed ?? true),
            lastResponse: prog.lastResponse || prog.last_response,
            correctCount: Number(prog.correctCount ?? prog.correct_count ?? 0),
            incorrectCount: Number(prog.incorrectCount ?? prog.incorrect_count ?? 0),
            interval: Number(prog.interval ?? 0),
            repetition: Number(prog.repetition ?? 0),
            easeFactor: Number(prog.easeFactor ?? prog.ease_factor ?? 2.5),
            state: (prog.state as FlashcardState) || 'new',
            lastReviewedDate: prog.lastReviewedDate || prog.last_reviewed_date,
            nextReviewDate: String(prog.nextReviewDate || prog.next_review_date || new Date().toISOString()),
            history: Array.isArray(prog.history) ? prog.history : [],
            updatedAt: String(prog.updatedAt || prog.updated_at || new Date().toISOString())
          };
        }
      }
    }
  } catch (_) {}

  // 2. Also check dedicated flashcard_study_progress table if provisioned
  try {
    const { data: rows, error } = await supabase
      .from('flashcard_study_progress')
      .select('*')
      .eq('user_id', uid);

    if (!error && Array.isArray(rows) && rows.length > 0) {
      for (const r of rows) {
        const cardId = String(r.card_id);
        const existing = progressMap[cardId];
        const rowUpdated = new Date(r.updated_at || 0).getTime();
        const existingUpdated = existing?.updatedAt ? new Date(existing.updatedAt).getTime() : 0;
        if (!existing || rowUpdated >= existingUpdated) {
          progressMap[cardId] = {
            userId: uid,
            deckId: String(r.deck_id || ''),
            cardId,
            reviewed: Boolean(r.reviewed ?? true),
            lastResponse: r.last_response || undefined,
            correctCount: Number(r.correct_count ?? 0),
            incorrectCount: Number(r.incorrect_count ?? 0),
            interval: Number(r.interval ?? 0),
            repetition: Number(r.repetition ?? 0),
            easeFactor: Number(r.ease_factor ?? 2.5),
            state: (r.state as FlashcardState) || 'new',
            lastReviewedDate: r.last_reviewed_date || undefined,
            nextReviewDate: String(r.next_review_date || new Date().toISOString()),
            history: Array.isArray(r.history) ? r.history : [],
            updatedAt: String(r.updated_at || new Date().toISOString())
          };
        }
      }
    }
  } catch (_) {}

  // 3. Migrate any legacy progress stored inside __flashcard_cards_${uid}__
  try {
    const { data: legacyRow } = await supabase
      .from('global_data')
      .select('data')
      .eq('id', `__flashcard_cards_${uid}__`)
      .maybeSingle();

    if (Array.isArray(legacyRow?.data)) {
      let migratedAny = false;
      for (const rawCard of legacyRow.data) {
        const c = normalizeFlashcard(rawCard);
        const hasRealHistory = Array.isArray(c.history) && c.history.length > 0;
        if (hasRealHistory && !progressMap[c.id]) {
          progressMap[c.id] = {
            userId: uid,
            deckId: c.deckId,
            cardId: c.id,
            reviewed: true,
            lastResponse: c.lastResponse || (c.history![c.history!.length - 1]?.rating >= 3 ? 'know_it' : 'still_learning'),
            correctCount: c.correctCount ?? c.history!.filter(h => h.rating >= 3).length,
            incorrectCount: c.incorrectCount ?? c.history!.filter(h => h.rating < 3).length,
            interval: c.interval,
            repetition: c.repetition,
            easeFactor: c.easeFactor,
            state: c.state,
            lastReviewedDate: c.lastReviewedDate,
            nextReviewDate: c.nextReviewDate,
            history: c.history || [],
            updatedAt: c.lastReviewedDate || new Date().toISOString()
          };
          migratedAny = true;
        }
      }
      if (migratedAny) {
        await supabase.from('global_data').upsert({
          id: `__flashcard_progress_${uid}__`,
          data: progressMap
        });
      }
    }
  } catch (_) {}

  saveCachedProgressMap(uid, progressMap);
  return progressMap;
}

async function persistUserProgressMapToSupabase(
  userId: string,
  progressMap: Record<string, FlashcardStudyProgress>,
  singleProgressItem?: FlashcardStudyProgress
): Promise<void> {
  const uid = getCanonicalUserId(userId);
  saveCachedProgressMap(uid, progressMap);

  if (!supabase) {
    throw new Error('Supabase client is not initialized.');
  }

  let savedToSupabase = false;
  let lastError: any = null;

  // 1. Write to global_data per-user progress store
  try {
    const { error: gdErr } = await supabase.from('global_data').upsert({
      id: `__flashcard_progress_${uid}__`,
      data: progressMap,
      updated_at: new Date().toISOString()
    });
    if (!gdErr) {
      savedToSupabase = true;
    } else {
      lastError = gdErr;
    }
  } catch (err) {
    lastError = err;
  }

  // 2. Also write to flashcard_study_progress table if provisioned
  if (singleProgressItem) {
    try {
      const { error: spErr } = await supabase.from('flashcard_study_progress').upsert(
        {
          id: `${uid}__${singleProgressItem.cardId}`,
          user_id: uid,
          deck_id: singleProgressItem.deckId,
          card_id: singleProgressItem.cardId,
          reviewed: singleProgressItem.reviewed,
          last_response: singleProgressItem.lastResponse || null,
          correct_count: singleProgressItem.correctCount,
          incorrect_count: singleProgressItem.incorrectCount,
          interval: singleProgressItem.interval,
          repetition: singleProgressItem.repetition,
          ease_factor: singleProgressItem.easeFactor,
          state: singleProgressItem.state,
          last_reviewed_date: singleProgressItem.lastReviewedDate || null,
          next_review_date: singleProgressItem.nextReviewDate,
          history: singleProgressItem.history,
          updated_at: singleProgressItem.updatedAt
        },
        { onConflict: 'id' }
      );
      if (!spErr) {
        savedToSupabase = true;
      }
    } catch (_) {}
  }

  if (!savedToSupabase && lastError) {
    throw new Error(lastError?.message || 'Failed to save study progress to Supabase.');
  }
}

// ==========================================
// SUPABASE CLOUD CANONICAL PERSISTENCE
// ==========================================

async function getDeletedIdsFromSupabase(userId?: string): Promise<{ decks: Set<string>; cards: Set<string> }> {
  const uid = getCanonicalUserId(userId);
  const decks = new Set<string>();
  const cards = new Set<string>();
  if (!supabase) return { decks, cards };
  try {
    const { data } = await supabase
      .from('global_data')
      .select('data')
      .eq('id', `__flashcard_deleted_${uid}__`)
      .maybeSingle();
    if (data?.data) {
      if (Array.isArray(data.data.decks)) data.data.decks.forEach((id: string) => decks.add(String(id)));
      if (Array.isArray(data.data.cards)) data.data.cards.forEach((id: string) => cards.add(String(id)));
    }
  } catch (_) {}
  return { decks, cards };
}

async function markDeletedIdInSupabase(type: 'deck' | 'card', id: string, userId?: string): Promise<void> {
  const uid = getCanonicalUserId(userId);
  if (!supabase) return;
  try {
    const current = await getDeletedIdsFromSupabase(uid);
    if (type === 'deck') current.decks.add(id);
    else current.cards.add(id);
    await supabase.from('global_data').upsert({
      id: `__flashcard_deleted_${uid}__`,
      data: {
        decks: Array.from(current.decks),
        cards: Array.from(current.cards)
      },
      updated_at: new Date().toISOString()
    });
  } catch (_) {}
}

export async function fetchSupabaseDecks(userId?: string): Promise<FlashcardDeck[]> {
  const uid = getCanonicalUserId(userId);
  const combinedMap = new Map<string, FlashcardDeck>();

  if (!supabase) {
    return getStoredDecks();
  }

  const deleted = await getDeletedIdsFromSupabase(uid);

  // 1. Seed starter decks first (unless deleted by user) so starter decks are always available
  for (const starter of STARTER_DECKS) {
    if (!deleted.decks.has(starter.id)) {
      combinedMap.set(starter.id, normalizeFlashcardDeck(starter));
    }
  }

  // 2. Query Supabase `flashcard_decks` table (canonical table)
  try {
    const { data, error } = await supabase
      .from('flashcard_decks')
      .select('*')
      .order('updated_at', { ascending: false });

    if (!error && Array.isArray(data)) {
      for (const row of data) {
        const deck = normalizeFlashcardDeck(row);
        if (deleted.decks.has(deck.id)) continue;
        // Include system decks, current user's decks, and shared/default decks
        const owner = deck.createdBy;
        if (!owner || owner === 'system' || owner === 'user' || owner === 'default' || owner === uid) {
          combinedMap.set(deck.id, deck);
        }
      }
    }
  } catch (err) {
    console.warn('[Flashcards] Error querying flashcard_decks:', err);
  }

  // 3. Also check Supabase `global_data` for user-created decks
  try {
    const keys = [`__flashcard_decks_${uid}__`, '__flashcard_decks_default__', '__flashcard_decks_system__'];
    const { data: gdRows } = await supabase
      .from('global_data')
      .select('id, data')
      .in('id', keys);

    if (Array.isArray(gdRows)) {
      for (const row of gdRows) {
        if (Array.isArray(row?.data)) {
          for (const rawDeck of row.data) {
            const deck = normalizeFlashcardDeck(rawDeck);
            if (!deleted.decks.has(deck.id) && !combinedMap.has(deck.id)) {
              combinedMap.set(deck.id, deck);
            }
          }
        }
      }
    }
  } catch (_) {}

  const list = Array.from(combinedMap.values());
  saveStoredDecks(list);
  return list;
}

export async function fetchSupabaseCards(deckId?: string, userId?: string): Promise<Flashcard[]> {
  const uid = getCanonicalUserId(userId);
  const cardMap = new Map<string, Flashcard>();

  if (!supabase) {
    const localCards = getStoredCards();
    return deckId ? localCards.filter(c => c.deckId === deckId) : localCards;
  }

  const [deleted, progressMap] = await Promise.all([
    getDeletedIdsFromSupabase(uid),
    fetchUserProgressFromSupabase(uid)
  ]);

  // 1. Include starter cards as base layer (unless deleted by user)
  for (const starter of STARTER_CARDS) {
    if (deleted.cards.has(starter.id) || deleted.decks.has(starter.deckId)) continue;
    if (!deckId || starter.deckId === deckId) {
      cardMap.set(starter.id, normalizeFlashcard(starter));
    }
  }

  // 2. Query Supabase `flashcards` table (canonical table)
  try {
    let query = supabase.from('flashcards').select('*');
    if (deckId) {
      query = query.eq('deck_id', deckId);
    }
    const { data, error } = await query;

    if (!error && Array.isArray(data)) {
      for (const row of data) {
        const normalized = normalizeFlashcard(row, deckId);
        if (deleted.cards.has(normalized.id) || deleted.decks.has(normalized.deckId)) continue;
        if (normalized.front && normalized.back) {
          cardMap.set(normalized.id, normalized);
        }
      }
    }
  } catch (err) {
    console.warn('[Flashcards] Error querying flashcards table:', err);
  }

  // 3. Also check Supabase `global_data` for any user-saved cards
  try {
    const keys = [`__flashcard_cards_${uid}__`, '__flashcard_cards_default__'];
    const { data: gdRows } = await supabase
      .from('global_data')
      .select('id, data')
      .in('id', keys);

    if (Array.isArray(gdRows)) {
      for (const row of gdRows) {
        if (Array.isArray(row?.data)) {
          for (const rawCard of row.data) {
            const normalized = normalizeFlashcard(rawCard);
            if (deleted.cards.has(normalized.id) || deleted.decks.has(normalized.deckId)) continue;
            if ((!deckId || normalized.deckId === deckId) && normalized.front && normalized.back) {
              if (!cardMap.has(normalized.id)) {
                cardMap.set(normalized.id, normalized);
              }
            }
          }
        }
      }
    }
  } catch (_) {}

  // 4. Apply the authenticated user's progress to each card without overwriting front/back
  const finalCards = Array.from(cardMap.values()).map(card =>
    applyUserProgressToCard(card, progressMap[card.id])
  );

  // Update local cache
  if (deckId) {
    const otherCached = getStoredCards().filter(c => c.deckId !== deckId);
    saveStoredCards([...otherCached, ...finalCards]);
  } else {
    saveStoredCards(finalCards);
  }

  return finalCards;
}

export async function persistDeckToSupabase(deck: FlashcardDeck, userId?: string): Promise<FlashcardDeck[]> {
  const uid = getCanonicalUserId(userId);
  const normalizedDeck = normalizeFlashcardDeck({
    ...deck,
    updatedAt: new Date().toISOString(),
    createdBy: uid
  });

  if (!supabase) {
    throw new Error('Supabase connection is required to save decks.');
  }

  let savedToSupabase = false;
  let lastError: any = null;

  // 1. Write to canonical `flashcard_decks` table
  try {
    const { error } = await supabase.from('flashcard_decks').upsert(
      {
        id: normalizedDeck.id,
        user_id: uid,
        title: normalizedDeck.title,
        description: normalizedDeck.description,
        subject: normalizedDeck.subject,
        color: normalizedDeck.color,
        icon: normalizedDeck.icon,
        tags: normalizedDeck.tags || [],
        is_favorite: Boolean(normalizedDeck.isFavorite),
        updated_at: normalizedDeck.updatedAt
      },
      { onConflict: 'id' }
    );
    if (!error) {
      savedToSupabase = true;
    } else {
      lastError = error;
    }
  } catch (err) {
    lastError = err;
  }

  // Update list of decks
  const currentDecks = getStoredDecks();
  const idx = currentDecks.findIndex(d => d.id === normalizedDeck.id);
  const nextDecks =
    idx >= 0
      ? currentDecks.map((d, i) => (i === idx ? normalizedDeck : d))
      : [normalizedDeck, ...currentDecks];

  // 2. Mirror to `global_data` in Supabase
  try {
    const { error: gdErr } = await supabase.from('global_data').upsert({
      id: `__flashcard_decks_${uid}__`,
      data: nextDecks,
      updated_at: new Date().toISOString()
    });
    if (!gdErr) {
      savedToSupabase = true;
    } else if (!lastError) {
      lastError = gdErr;
    }
  } catch (err) {
    if (!lastError) lastError = err;
  }

  if (!savedToSupabase) {
    throw new Error(lastError?.message || 'Failed to save deck to Supabase.');
  }

  saveStoredDecks(nextDecks);
  return nextDecks;
}

export async function deleteDeckFromSupabase(
  deckId: string,
  userId?: string
): Promise<{ decks: FlashcardDeck[]; cards: Flashcard[] }> {
  const uid = getCanonicalUserId(userId);
  if (!supabase) {
    throw new Error('Supabase connection is required to delete decks.');
  }

  let deletedFromSupabase = false;
  let lastError: any = null;

  // Mark as deleted if it was a starter deck so it won't auto-reseed
  await markDeletedIdInSupabase('deck', deckId, uid);

  try {
    const { error: dErr } = await supabase.from('flashcard_decks').delete().eq('id', deckId);
    await supabase.from('flashcards').delete().eq('deck_id', deckId);
    if (!dErr) {
      deletedFromSupabase = true;
    } else {
      lastError = dErr;
    }
  } catch (err) {
    lastError = err;
  }

  const nextDecks = getStoredDecks().filter(d => d.id !== deckId);
  const nextCards = getStoredCards().filter(c => c.deckId !== deckId);

  try {
    const { error: gdErr } = await supabase.from('global_data').upsert({
      id: `__flashcard_decks_${uid}__`,
      data: nextDecks,
      updated_at: new Date().toISOString()
    });
    await supabase.from('global_data').upsert({
      id: `__flashcard_cards_${uid}__`,
      data: nextCards,
      updated_at: new Date().toISOString()
    });
    if (!gdErr) {
      deletedFromSupabase = true;
    }
  } catch (err) {
    if (!lastError) lastError = err;
  }

  if (!deletedFromSupabase && lastError) {
    throw new Error(lastError?.message || 'Failed to delete deck from Supabase.');
  }

  saveStoredDecks(nextDecks);
  saveStoredCards(nextCards);
  return { decks: nextDecks, cards: nextCards };
}

export async function persistCardToSupabase(card: Flashcard, userId?: string): Promise<Flashcard[]> {
  const uid = getCanonicalUserId(userId);
  const currentCards = getStoredCards();
  const existing = currentCards.find(c => c.id === card.id);

  // Merge with existing card so editing question/answer never wipes out study progress
  const normalizedCard = normalizeFlashcard({
    ...existing,
    ...card,
    front: card.front,
    back: card.back,
    hint: card.hint,
    explanation: card.explanation,
    tags: card.tags,
    updatedAt: new Date().toISOString()
  });

  if (!normalizedCard.front || !normalizedCard.back) {
    throw new Error('Both question (front) and answer (back) are required.');
  }

  if (!supabase) {
    throw new Error('Supabase connection is required to save flashcards.');
  }

  let savedToSupabase = false;
  let lastError: any = null;

  // 1. Upsert into canonical `flashcards` table
  try {
    const { error } = await supabase.from('flashcards').upsert(
      {
        id: normalizedCard.id,
        deck_id: normalizedCard.deckId,
        user_id: uid,
        front: normalizedCard.front,
        back: normalizedCard.back,
        hint: normalizedCard.hint || null,
        tags: normalizedCard.tags || [],
        interval: normalizedCard.interval || 0,
        repetition: normalizedCard.repetition || 0,
        ease_factor: normalizedCard.easeFactor || 2.5,
        next_review_date: normalizedCard.nextReviewDate || new Date().toISOString(),
        last_reviewed_date: normalizedCard.lastReviewedDate || null,
        state: normalizedCard.state || 'new',
        history: normalizedCard.history || [],
        updated_at: new Date().toISOString()
      },
      { onConflict: 'id' }
    );
    if (!error) {
      savedToSupabase = true;
    } else {
      lastError = error;
    }
  } catch (err) {
    lastError = err;
  }

  const idx = currentCards.findIndex(c => c.id === normalizedCard.id);
  const nextCards =
    idx >= 0
      ? currentCards.map((c, i) => (i === idx ? normalizedCard : c))
      : [normalizedCard, ...currentCards];

  // 2. Mirror to `global_data`
  try {
    const { error: gdErr } = await supabase.from('global_data').upsert({
      id: `__flashcard_cards_${uid}__`,
      data: nextCards,
      updated_at: new Date().toISOString()
    });
    if (!gdErr) {
      savedToSupabase = true;
    } else if (!lastError) {
      lastError = gdErr;
    }
  } catch (err) {
    if (!lastError) lastError = err;
  }

  if (!savedToSupabase) {
    throw new Error(lastError?.message || 'Failed to save flashcard to Supabase.');
  }

  saveStoredCards(nextCards);
  return nextCards;
}

export async function persistCardsBatchToSupabase(cardsToSave: Flashcard[], userId?: string): Promise<Flashcard[]> {
  const uid = getCanonicalUserId(userId);
  if (!supabase) {
    throw new Error('Supabase connection is required to save flashcards.');
  }

  const normalizedBatch = cardsToSave
    .map(c => normalizeFlashcard(c))
    .filter(c => c.front.length > 0 && c.back.length > 0);

  if (normalizedBatch.length === 0) {
    throw new Error('No valid flashcards to save.');
  }

  let savedToSupabase = false;
  let lastError: any = null;

  try {
    const rows = normalizedBatch.map(c => ({
      id: c.id,
      deck_id: c.deckId,
      user_id: uid,
      front: c.front,
      back: c.back,
      hint: c.hint || null,
      tags: c.tags || [],
      interval: c.interval || 0,
      repetition: c.repetition || 0,
      ease_factor: c.easeFactor || 2.5,
      next_review_date: c.nextReviewDate || new Date().toISOString(),
      last_reviewed_date: c.lastReviewedDate || null,
      state: c.state || 'new',
      history: c.history || [],
      updated_at: new Date().toISOString()
    }));

    const { error } = await supabase.from('flashcards').upsert(rows, { onConflict: 'id' });
    if (!error) {
      savedToSupabase = true;
    } else {
      lastError = error;
    }
  } catch (err) {
    lastError = err;
  }

  const currentCards = getStoredCards();
  const batchIds = new Set(normalizedBatch.map(c => c.id));
  const nextCards = [...normalizedBatch, ...currentCards.filter(c => !batchIds.has(c.id))];

  try {
    const { error: gdErr } = await supabase.from('global_data').upsert({
      id: `__flashcard_cards_${uid}__`,
      data: nextCards,
      updated_at: new Date().toISOString()
    });
    if (!gdErr) {
      savedToSupabase = true;
    } else if (!lastError) {
      lastError = gdErr;
    }
  } catch (err) {
    if (!lastError) lastError = err;
  }

  if (!savedToSupabase) {
    throw new Error(lastError?.message || 'Failed to save flashcards batch to Supabase.');
  }

  saveStoredCards(nextCards);
  return nextCards;
}

export async function deleteCardFromSupabase(cardId: string, userId?: string): Promise<Flashcard[]> {
  const uid = getCanonicalUserId(userId);
  if (!supabase) {
    throw new Error('Supabase connection is required to delete flashcards.');
  }

  let deletedFromSupabase = false;
  let lastError: any = null;

  await markDeletedIdInSupabase('card', cardId, uid);

  try {
    const { error } = await supabase.from('flashcards').delete().eq('id', cardId);
    if (!error) {
      deletedFromSupabase = true;
    } else {
      lastError = error;
    }
  } catch (err) {
    lastError = err;
  }

  const nextCards = getStoredCards().filter(c => c.id !== cardId);

  try {
    const { error: gdErr } = await supabase.from('global_data').upsert({
      id: `__flashcard_cards_${uid}__`,
      data: nextCards,
      updated_at: new Date().toISOString()
    });
    if (!gdErr) {
      deletedFromSupabase = true;
    }
  } catch (err) {
    if (!lastError) lastError = err;
  }

  if (!deletedFromSupabase && lastError) {
    throw new Error(lastError?.message || 'Failed to delete card from Supabase.');
  }

  saveStoredCards(nextCards);
  return nextCards;
}

export async function recordCardReviewInSupabase(
  cardId: string,
  quality: FlashcardQuality,
  userId?: string,
  responseLabel?: 'know_it' | 'still_learning' | 'again' | 'hard' | 'good' | 'easy'
): Promise<{ card: Flashcard; allCards: Flashcard[] }> {
  const uid = getCanonicalUserId(userId);
  const cards = getStoredCards();
  const cardIndex = cards.findIndex(c => c.id === cardId);
  if (cardIndex < 0) {
    throw new Error('Card not found: ' + cardId);
  }

  const existing = cards[cardIndex];
  const now = new Date();
  const sm2Result = calculateSM2(existing, quality, now);

  const resolvedResponse: 'know_it' | 'still_learning' | 'again' | 'hard' | 'good' | 'easy' =
    responseLabel || (quality >= 3 ? 'know_it' : 'still_learning');

  const newLog: FlashcardReviewLog = {
    date: now.toISOString(),
    rating: quality,
    interval: sm2Result.interval,
    responseType: resolvedResponse
  };

  const nextHistory = [...(existing.history || []), newLog];
  const prevCorrect = existing.correctCount ?? (existing.history || []).filter(h => h.rating >= 3).length;
  const prevIncorrect = existing.incorrectCount ?? (existing.history || []).filter(h => h.rating < 3).length;

  const progressItem: FlashcardStudyProgress = {
    userId: uid,
    deckId: existing.deckId,
    cardId: existing.id,
    reviewed: true,
    lastResponse: resolvedResponse,
    correctCount: quality >= 3 ? prevCorrect + 1 : prevCorrect,
    incorrectCount: quality < 3 ? prevIncorrect + 1 : prevIncorrect,
    interval: sm2Result.interval,
    repetition: sm2Result.repetition,
    easeFactor: sm2Result.easeFactor,
    state: sm2Result.state,
    lastReviewedDate: now.toISOString(),
    nextReviewDate: sm2Result.nextReviewDate,
    history: nextHistory,
    updatedAt: now.toISOString()
  };

  // Update card in memory while strictly preserving existing.front and existing.back
  const updatedCard: Flashcard = applyUserProgressToCard(existing, progressItem);
  const updatedCards = [...cards];
  updatedCards[cardIndex] = updatedCard;
  saveStoredCards(updatedCards);

  // Persist per-user progress to Supabase without overwriting shared card front/back
  const progressMap = await fetchUserProgressFromSupabase(uid);
  progressMap[cardId] = progressItem;
  await persistUserProgressMapToSupabase(uid, progressMap, progressItem);

  return { card: updatedCard, allCards: updatedCards };
}

export async function resetDeckProgressInSupabase(deckId: string, userId?: string): Promise<Flashcard[]> {
  const uid = getCanonicalUserId(userId);
  const cards = getStoredCards();
  const progressMap = await fetchUserProgressFromSupabase(uid);

  const updated = cards.map(c => {
    if (c.deckId === deckId) {
      delete progressMap[c.id];
      return {
        ...c,
        interval: 0,
        repetition: 0,
        easeFactor: 2.5,
        nextReviewDate: new Date().toISOString(),
        state: 'new' as const,
        reviewed: false,
        lastResponse: undefined,
        correctCount: 0,
        incorrectCount: 0,
        lastReviewedDate: undefined,
        history: []
      };
    }
    return c;
  });

  saveStoredCards(updated);
  await persistUserProgressMapToSupabase(uid, progressMap);

  if (supabase) {
    try {
      await supabase
        .from('flashcard_study_progress')
        .delete()
        .eq('user_id', uid)
        .eq('deck_id', deckId);
    } catch (_) {}
  }

  return updated;
}

// Retain synchronous/legacy wrappers that delegate to Supabase persistence
export function upsertDeck(deck: FlashcardDeck, userId?: string): FlashcardDeck[] {
  persistDeckToSupabase(deck, userId).catch(err =>
    console.error('[Flashcards] Async deck persist error:', err)
  );
  const currentDecks = getStoredDecks();
  const normalized = normalizeFlashcardDeck(deck);
  const idx = currentDecks.findIndex(d => d.id === normalized.id);
  const next = idx >= 0 ? currentDecks.map((d, i) => (i === idx ? normalized : d)) : [normalized, ...currentDecks];
  saveStoredDecks(next);
  return next;
}

export function removeDeck(deckId: string, userId?: string): { decks: FlashcardDeck[]; cards: Flashcard[] } {
  deleteDeckFromSupabase(deckId, userId).catch(err =>
    console.error('[Flashcards] Async deck delete error:', err)
  );
  const decks = getStoredDecks().filter(d => d.id !== deckId);
  const cards = getStoredCards().filter(c => c.deckId !== deckId);
  saveStoredDecks(decks);
  saveStoredCards(cards);
  return { decks, cards };
}

export function upsertCard(card: Flashcard, userId?: string): Flashcard[] {
  persistCardToSupabase(card, userId).catch(err =>
    console.error('[Flashcards] Async card persist error:', err)
  );
  const currentCards = getStoredCards();
  const normalized = normalizeFlashcard(card);
  const idx = currentCards.findIndex(c => c.id === normalized.id);
  const next = idx >= 0 ? currentCards.map((c, i) => (i === idx ? normalized : c)) : [normalized, ...currentCards];
  saveStoredCards(next);
  return next;
}

export function removeCard(cardId: string, userId?: string): Flashcard[] {
  deleteCardFromSupabase(cardId, userId).catch(err =>
    console.error('[Flashcards] Async card delete error:', err)
  );
  const next = getStoredCards().filter(c => c.id !== cardId);
  saveStoredCards(next);
  return next;
}

export function logCardReview(
  cardId: string,
  quality: FlashcardQuality,
  userId?: string
): { card: Flashcard; allCards: Flashcard[] } {
  recordCardReviewInSupabase(cardId, quality, userId).catch(err =>
    console.error('[Flashcards] Async review persist error:', err)
  );
  const cards = getStoredCards();
  const card = cards.find(c => c.id === cardId) || cards[0];
  return { card, allCards: cards };
}

export function resetDeckProgress(deckId: string, userId?: string): Flashcard[] {
  resetDeckProgressInSupabase(deckId, userId).catch(err =>
    console.error('[Flashcards] Async reset progress error:', err)
  );
  return getStoredCards();
}

export async function syncDeckToSupabase(deck: FlashcardDeck, userId?: string): Promise<void> {
  await persistDeckToSupabase(deck, userId);
}

export async function syncCardToSupabase(card: Flashcard, userId?: string): Promise<void> {
  await persistCardToSupabase(card, userId);
}
