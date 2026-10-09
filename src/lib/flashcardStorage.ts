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

// ==========================================
// SUPABASE CLOUD CANONICAL PERSISTENCE
// ==========================================

export async function fetchSupabaseDecks(userId?: string): Promise<FlashcardDeck[]> {
  const combinedMap = new Map<string, FlashcardDeck>();

  // 1. Check Supabase flashcard_decks table
  if (supabase) {
    try {
      const query = supabase.from('flashcard_decks').select('*');
      if (userId) {
        query.or(`user_id.eq.${userId},user_id.eq.system,user_id.is.null`);
      }
      const { data, error } = await query;
      if (!error && Array.isArray(data) && data.length > 0) {
        data.forEach((d: any) => {
          combinedMap.set(d.id, {
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
          });
        });
      }
    } catch (_) {}

    // 2. Check Supabase global_data for permanent guaranteed persistence
    try {
      const keys = [`__flashcard_decks_${userId || 'default'}__`, '__flashcard_decks_system__'];
      for (const k of keys) {
        const { data: gdRow } = await supabase
          .from('global_data')
          .select('data')
          .eq('id', k)
          .maybeSingle();

        if (Array.isArray(gdRow?.data)) {
          gdRow.data.forEach((d: FlashcardDeck) => {
            if (!combinedMap.has(d.id)) {
              combinedMap.set(d.id, d);
            }
          });
        }
      }
    } catch (_) {}
  }

  // If Supabase returned decks, cache them and return
  if (combinedMap.size > 0) {
    const list = Array.from(combinedMap.values());
    saveStoredDecks(list);
    return list;
  }

  // Otherwise seed starter decks into Supabase and local cache
  const starters = [...STARTER_DECKS];
  saveStoredDecks(starters);
  if (supabase) {
    try {
      await supabase.from('global_data').upsert({
        id: `__flashcard_decks_${userId || 'default'}__`,
        data: starters
      });
    } catch (_) {}
  }
  return starters;
}

export async function fetchSupabaseCards(deckId?: string, userId?: string): Promise<Flashcard[]> {
  const cardMap = new Map<string, Flashcard>();

  if (supabase) {
    // 1. Direct table
    try {
      let query = supabase.from('flashcards').select('*');
      if (deckId) query = query.eq('deck_id', deckId);
      const { data, error } = await query;
      if (!error && Array.isArray(data) && data.length > 0) {
        data.forEach((c: any) => {
          cardMap.set(c.id, {
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
          });
        });
      }
    } catch (_) {}

    // 2. Supabase global_data
    try {
      const { data: gdRow } = await supabase
        .from('global_data')
        .select('data')
        .eq('id', `__flashcard_cards_${userId || 'default'}__`)
        .maybeSingle();

      if (Array.isArray(gdRow?.data)) {
        gdRow.data.forEach((c: Flashcard) => {
          if (!deckId || c.deckId === deckId) {
            if (!cardMap.has(c.id)) {
              cardMap.set(c.id, c);
            }
          }
        });
      }
    } catch (_) {}
  }

  if (cardMap.size > 0) {
    const list = Array.from(cardMap.values());
    // update cache
    const currentCached = getStoredCards().filter(c => deckId ? c.deckId !== deckId : false);
    saveStoredCards([...currentCached, ...list]);
    return list;
  }

  // Fallback to starter cards
  const allStarters = [...STARTER_CARDS];
  const relevant = deckId ? allStarters.filter(c => c.deckId === deckId) : allStarters;
  if (supabase) {
    try {
      await supabase.from('global_data').upsert({
        id: `__flashcard_cards_${userId || 'default'}__`,
        data: allStarters
      });
    } catch (_) {}
  }
  return relevant;
}

export async function persistDeckToSupabase(deck: FlashcardDeck, userId?: string): Promise<FlashcardDeck[]> {
  const currentDecks = getStoredDecks();
  const index = currentDecks.findIndex(d => d.id === deck.id);
  const updatedDeck = { ...deck, updatedAt: new Date().toISOString(), createdBy: userId || deck.createdBy || 'user' };
  let nextDecks: FlashcardDeck[];
  if (index >= 0) {
    nextDecks = [...currentDecks];
    nextDecks[index] = updatedDeck;
  } else {
    nextDecks = [updatedDeck, ...currentDecks];
  }
  saveStoredDecks(nextDecks);

  if (supabase) {
    try {
      await supabase.from('flashcard_decks').upsert({
        id: updatedDeck.id,
        user_id: userId || 'user',
        title: updatedDeck.title,
        description: updatedDeck.description,
        subject: updatedDeck.subject,
        color: updatedDeck.color,
        icon: updatedDeck.icon,
        tags: updatedDeck.tags || [],
        is_favorite: Boolean(updatedDeck.isFavorite),
        updated_at: new Date().toISOString()
      });
    } catch (_) {}

    try {
      await supabase.from('global_data').upsert({
        id: `__flashcard_decks_${userId || 'default'}__`,
        data: nextDecks
      });
    } catch (_) {}
  }

  return nextDecks;
}

export async function deleteDeckFromSupabase(deckId: string, userId?: string): Promise<{ decks: FlashcardDeck[]; cards: Flashcard[] }> {
  const nextDecks = getStoredDecks().filter(d => d.id !== deckId);
  const nextCards = getStoredCards().filter(c => c.deckId !== deckId);
  saveStoredDecks(nextDecks);
  saveStoredCards(nextCards);

  if (supabase) {
    try {
      await supabase.from('flashcard_decks').delete().eq('id', deckId);
      await supabase.from('flashcards').delete().eq('deck_id', deckId);
    } catch (_) {}

    try {
      await supabase.from('global_data').upsert({
        id: `__flashcard_decks_${userId || 'default'}__`,
        data: nextDecks
      });
      await supabase.from('global_data').upsert({
        id: `__flashcard_cards_${userId || 'default'}__`,
        data: nextCards
      });
    } catch (_) {}
  }

  return { decks: nextDecks, cards: nextCards };
}

export async function persistCardToSupabase(card: Flashcard, userId?: string): Promise<Flashcard[]> {
  const currentCards = getStoredCards();
  const index = currentCards.findIndex(c => c.id === card.id);
  let nextCards: Flashcard[];
  if (index >= 0) {
    nextCards = [...currentCards];
    nextCards[index] = card;
  } else {
    nextCards = [card, ...currentCards];
  }
  saveStoredCards(nextCards);

  if (supabase) {
    try {
      await supabase.from('flashcards').upsert({
        id: card.id,
        deck_id: card.deckId,
        user_id: userId || 'user',
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
    } catch (_) {}

    try {
      await supabase.from('global_data').upsert({
        id: `__flashcard_cards_${userId || 'default'}__`,
        data: nextCards
      });
    } catch (_) {}
  }

  return nextCards;
}

export async function deleteCardFromSupabase(cardId: string, userId?: string): Promise<Flashcard[]> {
  const nextCards = getStoredCards().filter(c => c.id !== cardId);
  saveStoredCards(nextCards);

  if (supabase) {
    try {
      await supabase.from('flashcards').delete().eq('id', cardId);
    } catch (_) {}
    try {
      await supabase.from('global_data').upsert({
        id: `__flashcard_cards_${userId || 'default'}__`,
        data: nextCards
      });
    } catch (_) {}
  }

  return nextCards;
}

export async function recordCardReviewInSupabase(
  cardId: string,
  quality: FlashcardQuality,
  userId?: string
): Promise<{ card: Flashcard; allCards: Flashcard[] }> {
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

  if (supabase) {
    try {
      await supabase.from('flashcards').upsert({
        id: updatedCard.id,
        deck_id: updatedCard.deckId,
        user_id: userId || 'user',
        front: updatedCard.front,
        back: updatedCard.back,
        hint: updatedCard.hint || null,
        tags: updatedCard.tags || [],
        interval: updatedCard.interval,
        repetition: updatedCard.repetition,
        ease_factor: updatedCard.easeFactor,
        next_review_date: updatedCard.nextReviewDate,
        last_reviewed_date: updatedCard.lastReviewedDate,
        state: updatedCard.state,
        history: updatedCard.history,
        updated_at: new Date().toISOString()
      });
    } catch (_) {}

    try {
      await supabase.from('global_data').upsert({
        id: `__flashcard_cards_${userId || 'default'}__`,
        data: updatedCards
      });
    } catch (_) {}
  }

  return { card: updatedCard, allCards: updatedCards };
}

export async function resetDeckProgressInSupabase(deckId: string, userId?: string): Promise<Flashcard[]> {
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

  if (supabase) {
    try {
      await supabase.from('global_data').upsert({
        id: `__flashcard_cards_${userId || 'default'}__`,
        data: updated
      });
    } catch (_) {}
  }
  return updated;
}

// Retain legacy synchronous signatures for backward-compatibility
export function upsertDeck(deck: FlashcardDeck): FlashcardDeck[] {
  const res = persistDeckToSupabase(deck);
  return getStoredDecks();
}
export function removeDeck(deckId: string): { decks: FlashcardDeck[]; cards: Flashcard[] } {
  deleteDeckFromSupabase(deckId);
  return { decks: getStoredDecks(), cards: getStoredCards() };
}
export function upsertCard(card: Flashcard): Flashcard[] {
  persistCardToSupabase(card);
  return getStoredCards();
}
export function removeCard(cardId: string): Flashcard[] {
  deleteCardFromSupabase(cardId);
  return getStoredCards();
}
export function logCardReview(cardId: string, quality: FlashcardQuality): { card: Flashcard; allCards: Flashcard[] } {
  recordCardReviewInSupabase(cardId, quality);
  const cards = getStoredCards();
  const card = cards.find(c => c.id === cardId) || cards[0];
  return { card, allCards: cards };
}
export function resetDeckProgress(deckId: string): Flashcard[] {
  resetDeckProgressInSupabase(deckId);
  return getStoredCards();
}
export async function syncDeckToSupabase(deck: FlashcardDeck, userId?: string): Promise<void> {
  await persistDeckToSupabase(deck, userId);
}
export async function syncCardToSupabase(card: Flashcard, userId?: string): Promise<void> {
  await persistCardToSupabase(card, userId);
}
