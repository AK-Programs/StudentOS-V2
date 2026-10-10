/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Study Center: Interactive Flashcards & SM-2 Spaced Repetition Engine
 * Canonical Source of Truth: StudentOS Supabase (`flashcard_decks`, `flashcards`, `flashcard_study_progress`)
 */

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Layers, Sparkles, Brain, RotateCw, Play, CheckCircle2, Clock,
  Plus, Search, Trash2, Edit3, BookOpen, Volume2, VolumeX,
  ChevronLeft, ChevronRight, ArrowRight, RefreshCw, HelpCircle,
  Zap, Check, X, GraduationCap, Shuffle, AlertTriangle, Eye, EyeOff, Sliders
} from 'lucide-react';
import { ProfessionalTabDropdown } from './ProfessionalTabDropdown';
import { Flashcard, FlashcardDeck, FlashcardQuality, UserProfile, VaultNote } from '../types';
import {
  getStoredDecks, getStoredCards,
  fetchSupabaseDecks, fetchSupabaseCards, persistDeckToSupabase, deleteDeckFromSupabase,
  persistCardToSupabase, persistCardsBatchToSupabase, deleteCardFromSupabase,
  recordCardReviewInSupabase, resetDeckProgressInSupabase, getCanonicalUserId
} from '../lib/flashcardStorage';
import {
  formatIntervalDays, getButtonIntervalPreviews,
  isCardDue, calculateDeckStats
} from '../lib/sm2Algorithm';
import { generateFlashcardsWithAI, GeneratedFlashcardData } from '../lib/aiFlashcards';
import { getVaultNotes } from '../lib/supabaseNotes';
import { awardStudentXP } from '../lib/gamification';
import { soundService } from '../lib/soundService';
import { saveSupabaseUserProfile } from '../lib/supabaseUsers';

interface StudyCenterProps {
  currentUser?: UserProfile | null;
  showNotification?: (msg: string) => void;
  onNavigateTab?: (tab: string) => void;
}

type ViewMode = 'decks' | 'study' | 'manage_deck';

export const StudyCenterFlashcards: React.FC<StudyCenterProps> = ({
  currentUser,
  showNotification = (msg: string) => console.log(msg),
  onNavigateTab
}) => {
  const userId = useMemo(
    () => getCanonicalUserId(currentUser?.uid || currentUser?.email),
    [currentUser?.uid, currentUser?.email]
  );

  // Core canonical data state
  const [decks, setDecks] = useState<FlashcardDeck[]>(() => getStoredDecks());
  const [cards, setCards] = useState<Flashcard[]>(() => getStoredCards());
  const [isLoadingData, setIsLoadingData] = useState<boolean>(true);
  const [syncError, setSyncError] = useState<string | null>(null);

  const [viewMode, setViewMode] = useState<ViewMode>('decks');
  const [activeDeckId, setActiveDeckId] = useState<string | null>(null);
  const [subjectFilter, setSubjectFilter] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Study session state — uses stable card IDs (`studyQueueIds`) so card content is always derived live from `cards`
  const [studyQueueIds, setStudyQueueIds] = useState<string[]>([]);
  const [currentCardIndex, setCurrentCardIndex] = useState<number>(0);
  const [isFlipped, setIsFlipped] = useState<boolean>(false);
  const [completedCardIds, setCompletedCardIds] = useState<string[]>([]);
  const [showHint, setShowHint] = useState<boolean>(false);
  const [isCramMode, setIsCramMode] = useState<boolean>(false);
  const [sessionCompleted, setSessionCompleted] = useState<boolean>(false);
  const [sessionRatings, setSessionRatings] = useState<{ cardId: string; quality: FlashcardQuality; response: string }[]>([]);
  const [ttsEnabled, setTtsEnabled] = useState<boolean>(true);
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const [isSavingProgress, setIsSavingProgress] = useState<boolean>(false);

  // Flashcard Sound Effects & Volume Preferences (synced with StudentOS soundService & user profile)
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => soundService.isFlashcardSoundEnabled());
  const [soundVolume, setSoundVolume] = useState<number>(() => soundService.getVolume());
  const [isSoundSettingsOpen, setIsSoundSettingsOpen] = useState<boolean>(false);

  useEffect(() => {
    soundService.syncWithUserProfile(currentUser);
    const prefs = soundService.getPreferences();
    setSoundEnabled(!prefs.muted && prefs.flashcardSoundEnabled);
    setSoundVolume(prefs.volume);

    const handlePrefChange = () => {
      const latest = soundService.getPreferences();
      setSoundEnabled(!latest.muted && latest.flashcardSoundEnabled);
      setSoundVolume(latest.volume);
    };
    window.addEventListener('studentos-sound-pref-changed', handlePrefChange);
    return () => window.removeEventListener('studentos-sound-pref-changed', handlePrefChange);
  }, [currentUser]);

  const persistSoundPrefsToStudentOS = useCallback(
    (nextEnabled: boolean, nextVolume: number) => {
      if (!currentUser) return;
      try {
        const updatedUser: UserProfile = {
          ...currentUser,
          raw_data: {
            ...(currentUser.raw_data || {}),
            flashcardSoundEnabled: nextEnabled,
            soundVolume: nextVolume
          }
        };
        localStorage.setItem('s_os_user', JSON.stringify(updatedUser));
        saveSupabaseUserProfile(updatedUser).catch(() => {});
      } catch (_) {}
    },
    [currentUser]
  );

  const handleToggleFlashcardSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    soundService.setFlashcardSoundEnabled(next);
    if (next) {
      soundService.playFlashcardReveal();
    }
    persistSoundPrefsToStudentOS(next, soundVolume);
  };

  const handleChangeSoundVolume = (nextVol: number) => {
    const clamped = Math.max(0, Math.min(1, nextVol));
    setSoundVolume(clamped);
    soundService.setVolume(clamped);
    persistSoundPrefsToStudentOS(soundEnabled, clamped);
  };

  // Deck creator / editor modal state
  const [isDeckModalOpen, setIsDeckModalOpen] = useState<boolean>(false);
  const [isSavingDeck, setIsSavingDeck] = useState<boolean>(false);
  const [deckSaveError, setDeckSaveError] = useState<string | null>(null);
  const [deckForm, setDeckForm] = useState<{ id?: string; title: string; description: string; subject: string; icon: string }>({
    title: '',
    description: '',
    subject: 'General',
    icon: '📚'
  });

  // Card creator / editor modal state
  const [isCardModalOpen, setIsCardModalOpen] = useState<boolean>(false);
  const [isSavingCard, setIsSavingCard] = useState<boolean>(false);
  const [cardSaveError, setCardSaveError] = useState<string | null>(null);
  const [cardForm, setCardForm] = useState<{
    id?: string;
    front: string;
    back: string;
    hint: string;
    explanation: string;
    tags: string;
  }>({
    front: '',
    back: '',
    hint: '',
    explanation: '',
    tags: ''
  });

  // AI Generator Modal
  const [isAiModalOpen, setIsAiModalOpen] = useState<boolean>(false);
  const [aiTopic, setAiTopic] = useState<string>('');
  const [aiSubject, setAiSubject] = useState<string>('Biology');
  const [aiContent, setAiContent] = useState<string>('');
  const [aiCount, setAiCount] = useState<number>(6);
  const [aiDifficulty, setAiDifficulty] = useState<'beginner' | 'intermediate' | 'advanced'>('intermediate');
  const [aiLoading, setAiLoading] = useState<boolean>(false);
  const [isSavingAiCards, setIsSavingAiCards] = useState<boolean>(false);
  const [aiGeneratedCards, setAiGeneratedCards] = useState<GeneratedFlashcardData[]>([]);
  const [aiDeckTitle, setAiDeckTitle] = useState<string>('');
  const [userNotes, setUserNotes] = useState<VaultNote[]>([]);
  const [selectedNoteId, setSelectedNoteId] = useState<string>('');

  // Race-condition guard for deck switching
  const fetchRequestIdRef = useRef<number>(0);

  // Load decks, cards, and user progress from Supabase
  const loadFlashcardsFromSupabase = useCallback(async (targetDeckId?: string) => {
    const reqId = ++fetchRequestIdRef.current;
    setIsLoadingData(true);
    setSyncError(null);

    try {
      const [sbDecks, sbCards] = await Promise.all([
        fetchSupabaseDecks(userId),
        fetchSupabaseCards(undefined, userId)
      ]);

      if (reqId !== fetchRequestIdRef.current) return;

      if (Array.isArray(sbDecks) && sbDecks.length > 0) {
        setDecks(sbDecks);
      }
      if (Array.isArray(sbCards) && sbCards.length > 0) {
        setCards(sbCards);
      }

      if (targetDeckId && targetDeckId !== 'all-due') {
        const deckSpecificCards = await fetchSupabaseCards(targetDeckId, userId);
        if (reqId !== fetchRequestIdRef.current) return;
        if (Array.isArray(deckSpecificCards) && deckSpecificCards.length > 0) {
          setCards(prev => {
            const other = prev.filter(c => c.deckId !== targetDeckId);
            return [...other, ...deckSpecificCards];
          });
        }
      }
    } catch (err: any) {
      if (reqId !== fetchRequestIdRef.current) return;
      console.error('[Flashcards] Error syncing from Supabase:', err);
      setSyncError(err?.message || 'Unable to sync flashcards from Supabase. Showing cached data.');
    } finally {
      if (reqId === fetchRequestIdRef.current) {
        setIsLoadingData(false);
      }
    }
  }, [userId]);

  useEffect(() => {
    loadFlashcardsFromSupabase();

    if (currentUser?.uid) {
      getVaultNotes(currentUser.uid)
        .then(notes => setUserNotes(notes))
        .catch(err => console.warn('[StudyCenter] Failed to fetch vault notes:', err));
    }
  }, [loadFlashcardsFromSupabase, currentUser?.uid]);

  // Map of cards by ID for O(1) lookup without stale copies
  const cardsById = useMemo(() => {
    const map = new Map<string, Flashcard>();
    for (const c of cards) {
      map.set(c.id, c);
    }
    return map;
  }, [cards]);

  // Derive active study session cards directly from canonical `cards` state via `studyQueueIds`
  const studyCards = useMemo(() => {
    return studyQueueIds
      .map(id => cardsById.get(id))
      .filter((c): c is Flashcard => {
        if (!c) return false;
        if (activeDeckId && activeDeckId !== 'all-due' && c.deckId !== activeDeckId) {
          return false;
        }
        return true;
      });
  }, [studyQueueIds, cardsById, activeDeckId]);

  // Current active card in study session
  const currentCard = useMemo(() => {
    if (studyCards.length === 0) return null;
    const safeIdx = Math.min(Math.max(0, currentCardIndex), studyCards.length - 1);
    return studyCards[safeIdx] || null;
  }, [studyCards, currentCardIndex]);

  const isLastCard = Boolean(studyCards.length > 0 && currentCardIndex >= studyCards.length - 1);

  // Guarantee that changing the active card or deck ALWAYS resets `isFlipped` and `showHint`
  useEffect(() => {
    setIsFlipped(false);
    setShowHint(false);
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }
  }, [currentCard?.id, activeDeckId]);

  // Overall statistics across all decks
  const overallStats = useMemo(() => {
    return calculateDeckStats(cards);
  }, [cards]);

  // Unique subjects
  const subjects = useMemo(() => {
    const set = new Set<string>();
    decks.forEach(d => {
      if (d.subject) set.add(d.subject);
    });
    return ['All', ...Array.from(set)];
  }, [decks]);

  // Filtered decks
  const filteredDecks = useMemo(() => {
    return decks.filter(deck => {
      const matchSubject = subjectFilter === 'All' || deck.subject === subjectFilter;
      const matchSearch =
        searchQuery.trim() === '' ||
        deck.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        deck.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (deck.tags && deck.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase())));
      return matchSubject && matchSearch;
    });
  }, [decks, subjectFilter, searchQuery]);

  // Active Deck
  const activeDeck = useMemo(() => {
    return decks.find(d => d.id === activeDeckId) || null;
  }, [decks, activeDeckId]);

  // Active Deck Cards
  const activeDeckCards = useMemo(() => {
    if (!activeDeckId) return [];
    return cards.filter(c => c.deckId === activeDeckId);
  }, [cards, activeDeckId]);

  // Active Deck Stats
  const activeDeckStats = useMemo(() => {
    return calculateDeckStats(activeDeckCards);
  }, [activeDeckCards]);

  // Open a deck to manage/inspect its cards and refresh from Supabase
  const handleOpenManageDeck = async (deckId: string) => {
    setActiveDeckId(deckId);
    setViewMode('manage_deck');
    try {
      const latestDeckCards = await fetchSupabaseCards(deckId, userId);
      if (Array.isArray(latestDeckCards) && latestDeckCards.length > 0) {
        setCards(prev => {
          const others = prev.filter(c => c.deckId !== deckId);
          return [...others, ...latestDeckCards];
        });
      }
    } catch (_) {}
  };

  // Start study session for a specific deck
  const startStudySession = async (deckId: string, cram: boolean = false) => {
    // Ensure we have latest cards for this deck
    let deckCards = cards.filter(c => c.deckId === deckId);
    try {
      const fetched = await fetchSupabaseCards(deckId, userId);
      if (Array.isArray(fetched) && fetched.length > 0) {
        deckCards = fetched;
        setCards(prev => [...prev.filter(c => c.deckId !== deckId), ...fetched]);
      }
    } catch (_) {}

    if (deckCards.length === 0) {
      showNotification('This deck has no flashcards yet! Add some cards or use the AI Generator.');
      return;
    }

    let sessionPool: Flashcard[];
    let effectiveCram = cram;
    if (cram) {
      sessionPool = [...deckCards];
    } else {
      const dueCards = deckCards.filter(c => isCardDue(c));
      if (dueCards.length === 0) {
        showNotification('All cards in this deck are up to date! Opening full deck review.');
        sessionPool = [...deckCards];
        effectiveCram = true;
      } else {
        sessionPool = [...dueCards];
      }
    }

    setActiveDeckId(deckId);
    setStudyQueueIds(sessionPool.map(c => c.id));
    setCurrentCardIndex(0);
    setIsFlipped(false);
    setShowHint(false);
    setIsCramMode(effectiveCram);
    setSessionCompleted(false);
    setCompletedCardIds([]);
    setSessionRatings([]);
    setViewMode('study');
  };

  // Study all due cards across all decks
  const startAllDueStudySession = () => {
    const dueCards = cards.filter(c => isCardDue(c));
    if (dueCards.length === 0) {
      showNotification('You have 0 cards due for review right now across all decks.');
      return;
    }

    setActiveDeckId('all-due');
    setStudyQueueIds(dueCards.map(c => c.id));
    setCurrentCardIndex(0);
    setIsFlipped(false);
    setShowHint(false);
    setIsCramMode(false);
    setSessionCompleted(false);
    setCompletedCardIds([]);
    setSessionRatings([]);
    setViewMode('study');
  };

  // Shuffle cards in the current study session while preserving exact card IDs and Q/A pairings
  const handleShuffleStudySession = () => {
    if (studyQueueIds.length <= 1) return;
    soundService.playFlashcardShuffle();
    const shuffled = [...studyQueueIds];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    setStudyQueueIds(shuffled);
    setCurrentCardIndex(0);
    setIsFlipped(false);
    setShowHint(false);
    showNotification('Shuffled study deck order.');
  };

  // Real-time SM-2 preview intervals for the 4 rating buttons
  const intervalPreviews = useMemo(() => {
    if (!currentCard) return { again: '< 1d', hard: '1d', good: '3d', easy: '7d' };
    return getButtonIntervalPreviews(currentCard);
  }, [currentCard]);

  // Handle rating a card ("Still Learning" / "Know It" or SM-2 1..4) and persisting progress to Supabase
  const handleRateCard = async (
    quality: FlashcardQuality,
    responseLabel?: 'know_it' | 'still_learning' | 'again' | 'hard' | 'good' | 'easy'
  ) => {
    if (!currentCard || isSavingProgress) return;
    const targetCardId = currentCard.id;
    const resolvedLabel = responseLabel || (quality >= 3 ? 'know_it' : 'still_learning');
    const willCompleteSession = currentCardIndex + 1 >= studyCards.length;

    // Play immediate, non-overlapping auditory feedback on user interaction
    if (willCompleteSession) {
      soundService.playFlashcardSessionComplete();
    } else if (quality >= 4 || resolvedLabel === 'know_it' || resolvedLabel === 'good' || resolvedLabel === 'easy') {
      soundService.playFlashcardKnowIt(quality);
    } else {
      soundService.playFlashcardStillLearning();
    }

    setIsSavingProgress(true);
    try {
      const { allCards } = await recordCardReviewInSupabase(targetCardId, quality, userId, resolvedLabel);
      setCards(allCards);
      setSyncError(null);
    } catch (err: any) {
      console.error('[Flashcards] Failed to persist card review to Supabase:', err);
      setSyncError('Failed to save progress to Supabase: ' + (err?.message || 'Network error'));
      showNotification('Warning: Progress could not be synced to Supabase. Check your connection.');
    } finally {
      setIsSavingProgress(false);
    }

    setCompletedCardIds(prev => (prev.includes(targetCardId) ? prev : [...prev, targetCardId]));
    setSessionRatings(prev => [
      ...prev.filter(r => r.cardId !== targetCardId),
      { cardId: targetCardId, quality, response: resolvedLabel }
    ]);

    if (!willCompleteSession) {
      setIsFlipped(false);
      setShowHint(false);
      setCurrentCardIndex(prev => prev + 1);
    } else {
      setSessionCompleted(true);
      awardStudentXP(currentUser, 'study_flashcards', { flashcardCount: studyCards.length });
      showNotification('Review session completed! Your progress has been saved to Supabase.');
    }
  };

  // Navigate to next card (records "Know It" / Good if not yet rated in this session)
  const handleNextCard = async () => {
    if (!currentCard) return;
    const alreadyRated = sessionRatings.some(r => r.cardId === currentCard.id);
    if (!alreadyRated) {
      await handleRateCard(4, 'know_it');
      return;
    }

    if (currentCardIndex + 1 < studyCards.length) {
      soundService.playFlashcardNavigate('next');
      setIsFlipped(false);
      setShowHint(false);
      setCurrentCardIndex(prev => prev + 1);
    } else {
      soundService.playFlashcardSessionComplete();
      setSessionCompleted(true);
      awardStudentXP(currentUser, 'study_flashcards', { flashcardCount: studyCards.length });
      showNotification('Deck complete! All progress has been saved to Supabase.');
    }
  };

  // Navigate to previous card
  const handlePrevCard = () => {
    if (currentCardIndex > 0) {
      soundService.playFlashcardNavigate('prev');
      setIsFlipped(false);
      setShowHint(false);
      setCurrentCardIndex(prev => prev - 1);
    }
  };

  // Restart deck from beginning
  const handleRestartDeck = () => {
    soundService.playFlashcardShuffle();
    setCurrentCardIndex(0);
    setIsFlipped(false);
    setShowHint(false);
    setSessionCompleted(false);
    setCompletedCardIds([]);
    setSessionRatings([]);
  };

  // Text to Speech
  const speakText = (text: string) => {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    if (isSpeaking) {
      setIsSpeaking(false);
      return;
    }
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.95;
    utterance.pitch = 1.0;
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    setIsSpeaking(true);
    window.speechSynthesis.speak(utterance);
  };

  // Keyboard navigation during study session
  useEffect(() => {
    if (viewMode !== 'study' || sessionCompleted || !currentCard) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return; // Ignore auto-repeat from held keys to prevent duplicate audio/skips
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) return;

      if (e.code === 'Space') {
        e.preventDefault();
        setIsFlipped(prev => {
          const next = !prev;
          if (next) soundService.playFlashcardReveal();
          else soundService.playFlashcardHide();
          return next;
        });
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (!isFlipped) {
          soundService.playFlashcardReveal();
          setIsFlipped(true);
        } else {
          handleNextCard();
        }
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        if (currentCardIndex + 1 < studyCards.length) {
          soundService.playFlashcardNavigate('next');
          setIsFlipped(false);
          setShowHint(false);
          setCurrentCardIndex(prev => prev + 1);
        }
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        if (currentCardIndex > 0) {
          soundService.playFlashcardNavigate('prev');
          setIsFlipped(false);
          setShowHint(false);
          setCurrentCardIndex(prev => prev - 1);
        }
      } else if (e.key === 'h' || e.key === 'H') {
        if (currentCard.hint) {
          soundService.playFlashcardNavigate('hint');
          setShowHint(prev => !prev);
        }
      } else if (isFlipped) {
        if (e.key === '1') handleRateCard(1, 'again');
        else if (e.key === '2') handleRateCard(3, 'hard');
        else if (e.key === '3') handleRateCard(4, 'good');
        else if (e.key === '4') handleRateCard(5, 'easy');
      } else if (e.key === 'Escape') {
        setViewMode('decks');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [viewMode, isFlipped, sessionCompleted, currentCard, currentCardIndex, studyCards.length]);

  // Handle deck save (awaited Supabase write with error/retry handling)
  const handleSaveDeck = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deckForm.title.trim() || isSavingDeck) return;

    setIsSavingDeck(true);
    setDeckSaveError(null);

    const existingDeck = deckForm.id ? decks.find(d => d.id === deckForm.id) : undefined;
    const newDeck: FlashcardDeck = {
      id: deckForm.id || `deck-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      title: deckForm.title.trim(),
      description: deckForm.description.trim(),
      subject: deckForm.subject,
      color: existingDeck?.color || 'from-indigo-600 to-violet-800',
      icon: deckForm.icon || '📚',
      createdAt: existingDeck?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: userId,
      tags: existingDeck?.tags || [deckForm.subject]
    };

    try {
      const updatedDecks = await persistDeckToSupabase(newDeck, userId);
      setDecks(updatedDecks);
      setIsDeckModalOpen(false);
      setDeckForm({ title: '', description: '', subject: 'General', icon: '📚' });
      showNotification(`Saved deck "${newDeck.title}" to StudentOS Supabase.`);
      if (!deckForm.id) {
        setActiveDeckId(newDeck.id);
        setViewMode('manage_deck');
      }
    } catch (err: any) {
      console.error('[Flashcards] Failed to save deck:', err);
      setDeckSaveError(err?.message || 'Failed to save deck to Supabase. Please retry.');
    } finally {
      setIsSavingDeck(false);
    }
  };

  // Handle card save (awaited Supabase write, preserves existing progress on edit)
  const handleSaveCard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cardForm.front.trim() || !cardForm.back.trim() || !activeDeckId || isSavingCard) return;

    setIsSavingCard(true);
    setCardSaveError(null);

    const parsedTags = cardForm.tags
      ? cardForm.tags.split(',').map(t => t.trim()).filter(Boolean)
      : [activeDeck?.subject || 'General'];

    const existingCard = cardForm.id ? cards.find(c => c.id === cardForm.id) : undefined;

    const cardToSave: Flashcard = {
      id: cardForm.id || `card-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      deckId: activeDeckId,
      front: cardForm.front.trim(),
      back: cardForm.back.trim(),
      hint: cardForm.hint.trim() || undefined,
      explanation: cardForm.explanation.trim() || undefined,
      tags: parsedTags,
      interval: existingCard?.interval ?? 0,
      repetition: existingCard?.repetition ?? 0,
      easeFactor: existingCard?.easeFactor ?? 2.5,
      nextReviewDate: existingCard?.nextReviewDate || new Date().toISOString(),
      lastReviewedDate: existingCard?.lastReviewedDate,
      state: existingCard?.state || 'new',
      reviewed: existingCard?.reviewed ?? false,
      lastResponse: existingCard?.lastResponse,
      correctCount: existingCard?.correctCount ?? 0,
      incorrectCount: existingCard?.incorrectCount ?? 0,
      history: existingCard?.history || []
    };

    try {
      const updatedCards = await persistCardToSupabase(cardToSave, userId);
      setCards(updatedCards);
      setIsCardModalOpen(false);
      setCardForm({ front: '', back: '', hint: '', explanation: '', tags: '' });
      showNotification(cardForm.id ? 'Updated flashcard in Supabase.' : 'Added flashcard to Supabase.');
    } catch (err: any) {
      console.error('[Flashcards] Failed to save card:', err);
      setCardSaveError(err?.message || 'Failed to save flashcard to Supabase. Please retry.');
    } finally {
      setIsSavingCard(false);
    }
  };

  // Handle AI Flashcard Generation
  const handleTriggerAIGeneration = async () => {
    if (!aiTopic.trim() && !aiContent.trim()) {
      showNotification('Please enter a topic or paste text to generate cards.');
      return;
    }

    setAiLoading(true);
    try {
      const response = await generateFlashcardsWithAI({
        topic: aiTopic,
        content: aiContent,
        count: aiCount,
        difficulty: aiDifficulty,
        subject: aiSubject
      });

      setAiGeneratedCards(response.cards || []);
      setAiDeckTitle(response.deckTitle || (aiTopic ? `${aiTopic} Deck` : `${aiSubject} Flashcards`));
      showNotification(`Generated ${response.cards.length} flashcards. Review and save to Supabase.`);
    } catch (err: any) {
      showNotification('Failed to generate flashcards: ' + (err?.message || 'Check connection.'));
    } finally {
      setAiLoading(false);
    }
  };

  // Save AI Generated Cards into a new or existing deck in Supabase
  const handleSaveAiCards = async (targetDeckId?: string) => {
    if (aiGeneratedCards.length === 0 || isSavingAiCards) return;

    setIsSavingAiCards(true);
    try {
      let destinationDeckId = targetDeckId;

      if (!destinationDeckId) {
        const newDeck: FlashcardDeck = {
          id: `deck-ai-${Date.now()}`,
          title: aiDeckTitle || (aiTopic ? `${aiTopic} Deck` : `${aiSubject} AI Deck`),
          description: `AI-generated active recall deck on ${aiTopic || aiSubject}.`,
          subject: aiSubject,
          color: 'from-violet-600 to-indigo-900',
          icon: '✨',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          createdBy: userId,
          tags: [aiSubject, 'AI Generated']
        };
        const updatedDecks = await persistDeckToSupabase(newDeck, userId);
        setDecks(updatedDecks);
        destinationDeckId = newDeck.id;
      }

      const nowTs = Date.now();
      const newCards: Flashcard[] = aiGeneratedCards.map((c, i) => ({
        id: `card-ai-${nowTs}-${i}`,
        deckId: destinationDeckId!,
        front: c.front.trim(),
        back: c.back.trim(),
        hint: c.hint?.trim() || undefined,
        explanation: c.explanation?.trim() || undefined,
        tags: c.tags || [aiSubject],
        interval: 0,
        repetition: 0,
        easeFactor: 2.5,
        nextReviewDate: new Date().toISOString(),
        state: 'new'
      }));

      const updatedCards = await persistCardsBatchToSupabase(newCards, userId);
      setCards(updatedCards);

      setIsAiModalOpen(false);
      setAiGeneratedCards([]);
      setAiTopic('');
      setAiContent('');
      showNotification(`Saved ${newCards.length} flashcards to StudentOS Supabase.`);

      setActiveDeckId(destinationDeckId);
      setViewMode('manage_deck');
    } catch (err: any) {
      console.error('[Flashcards] Failed to save AI cards:', err);
      showNotification('Failed to save AI flashcards to Supabase: ' + (err?.message || 'Retry'));
    } finally {
      setIsSavingAiCards(false);
    }
  };

  // Convert selected user note to AI content
  const handleSelectNoteForImport = (noteId: string) => {
    setSelectedNoteId(noteId);
    const found = userNotes.find(n => n.id === noteId);
    if (found) {
      setAiTopic(found.title);
      setAiSubject(found.subject || 'General');
      setAiContent(found.content);
      showNotification(`Loaded notes from "${found.title}"`);
    }
  };

  // Reset Progress of a deck
  const handleResetDeck = async (deckId: string) => {
    if (confirm('Reset your study progress for all cards in this deck? Card questions and answers will not be affected.')) {
      try {
        const updated = await resetDeckProgressInSupabase(deckId, userId);
        setCards(updated);
        showNotification('Deck study progress has been reset in Supabase.');
      } catch (err: any) {
        showNotification('Failed to reset progress: ' + (err?.message || 'Try again.'));
      }
    }
  };

  // Delete Deck
  const handleDeleteDeck = async (deckId: string, title: string) => {
    if (confirm(`Delete deck "${title}" and all its flashcards from Supabase? This cannot be undone.`)) {
      try {
        const { decks: updatedDecks, cards: updatedCards } = await deleteDeckFromSupabase(deckId, userId);
        setDecks(updatedDecks);
        setCards(updatedCards);
        if (activeDeckId === deckId) {
          setViewMode('decks');
          setActiveDeckId(null);
        }
        showNotification(`Deleted deck "${title}" from StudentOS Supabase.`);
      } catch (err: any) {
        showNotification('Failed to delete deck: ' + (err?.message || 'Try again.'));
      }
    }
  };

  // Delete single card
  const handleDeleteCard = async (cardId: string) => {
    if (confirm('Delete this flashcard permanently from Supabase?')) {
      try {
        const updated = await deleteCardFromSupabase(cardId, userId);
        setCards(updated);
        showNotification('Flashcard deleted from Supabase.');
      } catch (err: any) {
        showNotification('Failed to delete card: ' + (err?.message || 'Try again.'));
      }
    }
  };

  // ==========================================
  // RENDER: STUDY SESSION VIEW (ACTIVE RECALL + SM-2)
  // ==========================================
  if (viewMode === 'study' && currentCard && !sessionCompleted) {
    const progressPercent = Math.round(((currentCardIndex + (isFlipped ? 0.5 : 0)) / Math.max(1, studyCards.length)) * 100);
    const cardDeck = decks.find(d => d.id === currentCard.deckId) || activeDeck;

    return (
      <div className="space-y-5 max-w-4xl mx-auto animate-fadeIn py-2 sm:py-4">
        {/* Sync Error Retry Banner */}
        {syncError && (
          <div className="p-3.5 rounded-2xl bg-rose-950/60 border border-rose-500/40 flex items-center justify-between gap-3 text-xs text-rose-200">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{syncError}</span>
            </div>
            <button
              type="button"
              onClick={() => loadFlashcardsFromSupabase(activeDeckId || undefined)}
              className="px-3 py-1.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 border border-rose-400/30 text-rose-100 font-bold shrink-0 cursor-pointer"
            >
              Retry Sync
            </button>
          </div>
        )}

        {/* Top Session Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900/90 backdrop-blur-md p-3.5 sm:p-4 rounded-2xl border border-white/10 shadow-lg">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setViewMode('decks')}
              className="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-200 hover:text-white border border-white/10 transition-all flex items-center gap-1.5 text-xs font-semibold cursor-pointer shrink-0"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Decks</span>
            </button>
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-white flex items-center gap-2 truncate">
                <span>{cardDeck?.icon || '🧠'}</span>
                <span className="truncate">
                  {activeDeckId === 'all-due' ? 'All Due Flashcards' : cardDeck?.title || 'Study Session'}
                </span>
              </h3>
              <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5 flex-wrap">
                <span className="font-mono font-semibold text-slate-300">
                  Card {currentCardIndex + 1} of {studyCards.length}
                </span>
                <span aria-hidden="true">·</span>
                <span className="text-emerald-400 font-semibold">{completedCardIds.length} reviewed</span>
                {currentCard.correctCount !== undefined && (currentCard.correctCount > 0 || (currentCard.incorrectCount || 0) > 0) && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="text-slate-400 font-mono">
                      {currentCard.correctCount} correct / {currentCard.incorrectCount || 0} learning
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Session Controls */}
          <div className="flex items-center gap-2 relative">
            <button
              type="button"
              onClick={handleShuffleStudySession}
              disabled={studyCards.length <= 1}
              className="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white transition-all text-xs font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
              title="Shuffle remaining cards in this deck"
            >
              <Shuffle className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Shuffle</span>
            </button>

            <button
              type="button"
              onClick={handleToggleFlashcardSound}
              aria-pressed={soundEnabled}
              className={`px-2.5 py-2 rounded-xl border transition-all text-xs font-semibold flex items-center gap-1.5 cursor-pointer ${
                soundEnabled
                  ? 'bg-indigo-600/20 border-indigo-500/40 text-indigo-300'
                  : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'
              }`}
              title={soundEnabled ? 'Flashcard Sound Effects: ON (Click to mute)' : 'Flashcard Sound Effects: OFF (Click to enable)'}
            >
              {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
              <span className="hidden md:inline">{soundEnabled ? 'Sound ON' : 'Muted'}</span>
            </button>

            <button
              type="button"
              onClick={() => setIsSoundSettingsOpen(prev => !prev)}
              aria-expanded={isSoundSettingsOpen}
              className={`p-2 rounded-xl border transition-all text-xs font-semibold flex items-center gap-1 cursor-pointer ${
                isSoundSettingsOpen
                  ? 'bg-indigo-600 text-white border-indigo-500'
                  : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'
              }`}
              title="Flashcard Sound & Voice Settings"
            >
              <Sliders className="w-4 h-4" />
            </button>

            <div className="px-3 py-1.5 bg-slate-950/80 rounded-xl border border-white/10 text-[11px] font-mono text-indigo-300 font-semibold hidden sm:flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              <span>Interval: {formatIntervalDays(currentCard.interval)}</span>
            </div>
          </div>
        </div>

        {/* Collapsible Flashcard Audio & Study Settings Bar */}
        {isSoundSettingsOpen && renderFlashcardSoundSettingsPanel()}

        {/* Progress Bar */}
        <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden border border-white/5">
          <div
            className="bg-gradient-to-r from-indigo-500 to-teal-400 h-full transition-all duration-300 rounded-full"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* Active Study Card — Keyed by `currentCard.id` with zero horizontal rotation */}
        <div
          key={currentCard.id}
          data-card-id={currentCard.id}
          className="w-full rounded-3xl bg-slate-900 border border-white/10 shadow-2xl overflow-hidden transition-colors duration-200"
        >
          {/* Card Top Metadata Bar */}
          <div className="px-5 sm:px-8 py-4 border-b border-white/10 bg-slate-950/40 flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2.5 text-xs text-slate-400">
              <span className="font-semibold text-indigo-400">
                {isFlipped ? 'Question & Revealed Answer' : 'Question Prompt'}
              </span>
              <span aria-hidden="true">·</span>
              <span className="font-mono capitalize text-slate-300">
                Status: {currentCard.state || 'new'}
              </span>
              {currentCard.lastResponse && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="text-slate-400">
                    Last: {currentCard.lastResponse === 'know_it' || currentCard.lastResponse === 'good' || currentCard.lastResponse === 'easy' ? 'Know It' : 'Still Learning'}
                  </span>
                </>
              )}
            </div>

            <div className="flex items-center gap-2">
              {ttsEnabled && (
                <button
                  type="button"
                  onClick={() => speakText(isFlipped ? currentCard.back : currentCard.front)}
                  className="px-2.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer"
                  title={isFlipped ? 'Read answer aloud' : 'Read question aloud'}
                >
                  <Volume2 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">{isFlipped ? 'Read Answer' : 'Read Question'}</span>
                </button>
              )}

              {currentCard.hint && (
                <button
                  type="button"
                  onClick={() => {
                    soundService.playFlashcardNavigate('hint');
                    setShowHint(prev => !prev);
                  }}
                  className={`px-2.5 py-1.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                    showHint
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                      : 'bg-white/5 text-slate-300 border-white/10 hover:text-white'
                  }`}
                >
                  <HelpCircle className="w-3.5 h-3.5" />
                  <span>{showHint ? 'Hide Hint' : 'Hint'}</span>
                </button>
              )}
            </div>
          </div>

          {/* Card Body: Question + Deterministic Answer Reveal */}
          <div className="p-6 sm:p-8 md:p-10 space-y-6">
            {/* QUESTION BLOCK (Always visible so Question and Answer are paired unambiguously) */}
            <div
              data-testid="flashcard-question"
              className={
                isFlipped
                  ? 'p-4 sm:p-5 rounded-2xl bg-slate-950/70 border border-white/10 text-left'
                  : 'py-8 sm:py-12 text-center'
              }
            >
              <div className="text-xs font-semibold text-indigo-400 mb-2">
                Question #{currentCardIndex + 1}
              </div>
              <p
                className={
                  isFlipped
                    ? 'text-base sm:text-lg font-bold text-slate-200 leading-relaxed break-words'
                    : 'text-xl sm:text-2xl md:text-3xl font-extrabold text-white leading-relaxed font-display max-w-2xl mx-auto break-words'
                }
              >
                {currentCard.front}
              </p>

              {/* Optional Hint */}
              {showHint && currentCard.hint && (
                <div className="mt-4 p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs sm:text-sm max-w-xl mx-auto text-left leading-relaxed">
                  <strong className="font-bold text-amber-300">Hint: </strong>
                  <span>{currentCard.hint}</span>
                </div>
              )}
            </div>

            {/* ANSWER BLOCK — Rendered directly when `isFlipped === true` */}
            {isFlipped && (
              <motion.div
                key={`answer-${currentCard.id}`}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                data-testid="flashcard-answer"
                className="p-5 sm:p-7 rounded-2xl bg-emerald-950/25 border border-emerald-500/30 space-y-4 text-left"
              >
                <div className="flex items-center justify-between gap-2 border-b border-emerald-500/20 pb-3">
                  <div className="flex items-center gap-2 text-emerald-300 text-xs font-bold">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>Verified Answer</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      soundService.playFlashcardHide();
                      setIsFlipped(false);
                    }}
                    className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white text-xs font-medium flex items-center gap-1 cursor-pointer"
                  >
                    <EyeOff className="w-3.5 h-3.5" />
                    <span>Hide Answer</span>
                  </button>
                </div>

                <div className="text-base sm:text-xl font-bold text-white leading-relaxed whitespace-pre-line break-words max-h-[320px] overflow-y-auto pr-1">
                  {currentCard.back}
                </div>

                {currentCard.explanation && (
                  <div className="pt-3 border-t border-white/10 text-xs sm:text-sm text-slate-300 leading-relaxed whitespace-pre-line">
                    <strong className="text-indigo-300 font-semibold block mb-1">Explanation:</strong>
                    {currentCard.explanation}
                  </div>
                )}

                {!showHint && currentCard.hint && (
                  <div className="pt-2 text-xs text-slate-400">
                    <strong className="text-slate-300">Memory Hint:</strong> {currentCard.hint}
                  </div>
                )}
              </motion.div>
            )}
          </div>

          {/* Card Footer Metadata */}
          <div className="px-5 sm:px-8 py-3.5 border-t border-white/10 bg-slate-950/40 flex items-center justify-between gap-3 flex-wrap text-xs text-slate-400">
            <div className="flex items-center gap-2 flex-wrap">
              {currentCard.tags && currentCard.tags.length > 0 && (
                <span>Tags: {currentCard.tags.join(' · ')}</span>
              )}
            </div>
            <div className="font-mono text-[11px] text-slate-400">
              Ease {(currentCard.easeFactor || 2.5).toFixed(2)} · Reps {currentCard.repetition || 0}
            </div>
          </div>
        </div>

        {/* Action Controls Below Card */}
        {!isFlipped ? (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <button
              type="button"
              onClick={handlePrevCard}
              disabled={currentCardIndex === 0}
              className="w-full sm:w-auto px-4 py-3 rounded-2xl bg-slate-900 hover:bg-slate-800 border border-white/10 text-slate-300 hover:text-white text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-40 min-h-[46px]"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Previous</span>
            </button>

            <button
              type="button"
              data-testid="reveal-answer-btn"
              onClick={() => {
                soundService.playFlashcardReveal();
                setIsFlipped(true);
              }}
              className="w-full sm:flex-1 max-w-md px-8 py-4 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm shadow-lg shadow-indigo-600/25 transition-all active:scale-98 flex items-center justify-center gap-2.5 cursor-pointer min-h-[50px]"
            >
              <Eye className="w-5 h-5" />
              <span>Reveal Answer</span>
            </button>

            <button
              type="button"
              onClick={() => {
                if (currentCardIndex + 1 < studyCards.length) {
                  soundService.playFlashcardNavigate('next');
                  setIsFlipped(false);
                  setShowHint(false);
                  setCurrentCardIndex(prev => prev + 1);
                }
              }}
              disabled={isLastCard}
              className="w-full sm:w-auto px-4 py-3 rounded-2xl bg-slate-900 hover:bg-slate-800 border border-white/10 text-slate-300 hover:text-white text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-40 min-h-[46px]"
            >
              <span>Skip</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="space-y-4 animate-fadeIn">
            {/* Primary Response Row: Still Learning vs Know It */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                disabled={isSavingProgress}
                onClick={() => handleRateCard(1, 'still_learning')}
                className="px-6 py-4 rounded-2xl bg-amber-950/50 hover:bg-amber-900/60 border border-amber-500/40 text-amber-200 font-bold text-sm transition-all active:scale-98 flex items-center justify-between gap-3 cursor-pointer min-h-[52px]"
              >
                <div className="flex items-center gap-2.5">
                  <RotateCw className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>Still Learning</span>
                </div>
                <span className="text-xs font-mono text-amber-300/90">
                  Review in {intervalPreviews.again}
                </span>
              </button>

              <button
                type="button"
                disabled={isSavingProgress}
                onClick={() => handleRateCard(4, 'know_it')}
                className="px-6 py-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm shadow-lg shadow-emerald-600/25 transition-all active:scale-98 flex items-center justify-between gap-3 cursor-pointer min-h-[52px]"
              >
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-5 h-5 shrink-0" />
                  <span>Know It</span>
                </div>
                <span className="text-xs font-mono text-emerald-100">
                  Next in {intervalPreviews.good}
                </span>
              </button>
            </div>

            {/* Fine-grained SM-2 Spaced Repetition Schedule Buttons */}
            <div className="p-4 rounded-2xl bg-slate-900/80 border border-white/10 space-y-2.5">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span className="font-semibold">Spaced Repetition Interval (SM-2)</span>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={handlePrevCard}
                    disabled={currentCardIndex === 0}
                    className="text-slate-400 hover:text-white disabled:opacity-40 cursor-pointer flex items-center gap-1"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    <span>Prev</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleNextCard}
                    className="text-indigo-400 hover:text-indigo-300 font-semibold cursor-pointer flex items-center gap-1"
                  >
                    <span>{isLastCard ? 'Finish Session' : 'Next Card'}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <button
                  type="button"
                  disabled={isSavingProgress}
                  onClick={() => handleRateCard(1, 'again')}
                  className="p-3 rounded-xl bg-rose-950/40 hover:bg-rose-900/60 border border-rose-500/30 text-left transition-all cursor-pointer"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-rose-300">1. Again</span>
                    <span className="text-[11px] font-mono text-rose-300">{intervalPreviews.again}</span>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-0.5">Reset interval</p>
                </button>

                <button
                  type="button"
                  disabled={isSavingProgress}
                  onClick={() => handleRateCard(3, 'hard')}
                  className="p-3 rounded-xl bg-amber-950/40 hover:bg-amber-900/60 border border-amber-500/30 text-left transition-all cursor-pointer"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-300">2. Hard</span>
                    <span className="text-[11px] font-mono text-amber-300">{intervalPreviews.hard}</span>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-0.5">Difficult recall</p>
                </button>

                <button
                  type="button"
                  disabled={isSavingProgress}
                  onClick={() => handleRateCard(4, 'good')}
                  className="p-3 rounded-xl bg-blue-950/40 hover:bg-blue-900/60 border border-blue-500/30 text-left transition-all cursor-pointer"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-blue-300">3. Good</span>
                    <span className="text-[11px] font-mono text-blue-300">{intervalPreviews.good}</span>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-0.5">Standard recall</p>
                </button>

                <button
                  type="button"
                  disabled={isSavingProgress}
                  onClick={() => handleRateCard(5, 'easy')}
                  className="p-3 rounded-xl bg-emerald-950/40 hover:bg-emerald-900/60 border border-emerald-500/30 text-left transition-all cursor-pointer"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-emerald-300">4. Easy</span>
                    <span className="text-[11px] font-mono text-emerald-300">{intervalPreviews.easy}</span>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-0.5">Instant recall</p>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Keyboard shortcuts bar */}
        <div className="flex items-center justify-center gap-4 text-[11px] text-slate-500 font-mono pt-1 flex-wrap">
          <span>Space: Reveal / Hide Answer</span>
          <span>·</span>
          <span>1–4: Rate Recall</span>
          <span>·</span>
          <span>← / →: Navigate Cards</span>
          <span>·</span>
          <span>H: Toggle Hint</span>
        </div>
      </div>
    );
  }

  // ==========================================
  // RENDER: SESSION COMPLETED SUMMARY
  // ==========================================
  if (viewMode === 'study' && sessionCompleted) {
    const totalReviewed = sessionRatings.length || completedCardIds.length;
    const knowItCount = sessionRatings.filter(r => r.quality >= 3).length;
    const stillLearningCount = sessionRatings.filter(r => r.quality < 3).length;
    const accuracy = totalReviewed > 0 ? Math.round((knowItCount / totalReviewed) * 100) : 100;

    return (
      <div className="max-w-2xl mx-auto py-8 text-center space-y-6 animate-fadeIn">
        <div className="p-6 sm:p-10 rounded-3xl bg-slate-900 border border-indigo-500/30 shadow-2xl space-y-6">
          <div className="w-16 h-16 bg-indigo-600/20 border border-indigo-500/30 rounded-2xl flex items-center justify-center text-indigo-400 mx-auto">
            <CheckCircle2 className="w-8 h-8" />
          </div>

          <div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white font-display">Session Complete</h2>
            <p className="text-slate-400 text-xs sm:text-sm mt-1.5 max-w-md mx-auto">
              Your per-card study progress and SM-2 spaced repetition schedule have been saved to your StudentOS Supabase account.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="p-4 rounded-2xl bg-slate-950/60 border border-white/5">
              <span className="text-2xl font-extrabold text-white font-mono tabular-nums">{totalReviewed}</span>
              <p className="text-xs text-slate-400 mt-1">Reviewed</p>
            </div>
            <div className="p-4 rounded-2xl bg-slate-950/60 border border-white/5">
              <span className="text-2xl font-extrabold text-emerald-400 font-mono tabular-nums">{knowItCount}</span>
              <p className="text-xs text-slate-400 mt-1">Know It ({accuracy}%)</p>
            </div>
            <div className="p-4 rounded-2xl bg-slate-950/60 border border-white/5">
              <span className="text-2xl font-extrabold text-amber-400 font-mono tabular-nums">{stillLearningCount}</span>
              <p className="text-xs text-slate-400 mt-1">Still Learning</p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2 flex-wrap">
            {stillLearningCount > 0 && (
              <button
                type="button"
                onClick={() => {
                  soundService.playFlashcardShuffle();
                  const difficultIds = sessionRatings.filter(r => r.quality < 3).map(r => r.cardId);
                  setStudyQueueIds(difficultIds);
                  setCurrentCardIndex(0);
                  setIsFlipped(false);
                  setShowHint(false);
                  setSessionCompleted(false);
                  setCompletedCardIds([]);
                  setSessionRatings([]);
                }}
                className="w-full sm:w-auto px-6 py-3.5 rounded-2xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs transition-all cursor-pointer flex items-center justify-center gap-2 min-h-[46px]"
              >
                <RotateCw className="w-4 h-4" />
                <span>Review Still Learning ({stillLearningCount})</span>
              </button>
            )}
            <button
              type="button"
              onClick={handleRestartDeck}
              className="w-full sm:w-auto px-6 py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition-all cursor-pointer flex items-center justify-center gap-2 min-h-[46px]"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Study Deck Again</span>
            </button>
            <button
              type="button"
              onClick={() => {
                soundService.playFlashcardNavigate('prev');
                setViewMode('decks');
                setActiveDeckId(null);
              }}
              className="w-full sm:w-auto px-6 py-3.5 rounded-2xl bg-white/5 hover:bg-white/10 text-slate-200 border border-white/10 font-bold text-xs transition-all cursor-pointer min-h-[46px]"
            >
              Return to All Decks
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ==========================================
  // RENDER: DECK MANAGEMENT & CARD EDITOR
  // ==========================================
  if (viewMode === 'manage_deck' && activeDeck) {
    return (
      <div className="space-y-6 animate-fadeIn">
        {/* Header bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 bg-slate-900 rounded-3xl border border-white/10 shadow-xl">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => setViewMode('decks')}
              className="p-2.5 rounded-2xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 transition-all cursor-pointer"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <span className="text-2xl">{activeDeck.icon}</span>
                <h2 className="text-xl sm:text-2xl font-extrabold text-white font-display tracking-tight">
                  {activeDeck.title}
                </h2>
                <span className="text-xs text-indigo-400 font-semibold">· {activeDeck.subject}</span>
              </div>
              <p className="text-xs text-slate-400 mt-1">{activeDeck.description}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => startStudySession(activeDeck.id, false)}
              className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Study Deck ({activeDeckStats.dueToday} Due)</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setCardSaveError(null);
                setCardForm({
                  front: '',
                  back: '',
                  hint: '',
                  explanation: '',
                  tags: activeDeck.subject
                });
                setIsCardModalOpen(true);
              }}
              className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Card</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setAiTopic(activeDeck.title);
                setAiSubject(activeDeck.subject);
                setIsAiModalOpen(true);
              }}
              className="px-3.5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-purple-300 border border-purple-500/20 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-purple-400" />
              <span>AI Expand</span>
            </button>
            <button
              type="button"
              onClick={() => handleResetDeck(activeDeck.id)}
              className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white border border-white/10 transition-all cursor-pointer"
              title="Reset Study Progress for This Deck"
            >
              <RotateCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Deck metrics strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-4 rounded-2xl bg-slate-900 border border-white/5 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-400">Total Cards</p>
              <p className="text-xl font-extrabold text-white font-mono tabular-nums mt-0.5">{activeDeckStats.total}</p>
            </div>
            <Layers className="w-5 h-5 text-indigo-400" />
          </div>

          <div className="p-4 rounded-2xl bg-slate-900 border border-white/5 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-400">Due Today</p>
              <p className="text-xl font-extrabold text-rose-400 font-mono tabular-nums mt-0.5">{activeDeckStats.dueToday}</p>
            </div>
            <Clock className="w-5 h-5 text-rose-400" />
          </div>

          <div className="p-4 rounded-2xl bg-slate-900 border border-white/5 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-400">Retention Rate</p>
              <p className="text-xl font-extrabold text-emerald-400 font-mono tabular-nums mt-0.5">{activeDeckStats.retentionRate}%</p>
            </div>
            <Brain className="w-5 h-5 text-emerald-400" />
          </div>

          <div className="p-4 rounded-2xl bg-slate-900 border border-white/5 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-400">Mastered</p>
              <p className="text-xl font-extrabold text-blue-400 font-mono tabular-nums mt-0.5">{activeDeckStats.masteredCount}</p>
            </div>
            <CheckCircle2 className="w-5 h-5 text-blue-400" />
          </div>
        </div>

        {/* Cards list */}
        <div className="bg-slate-900 rounded-3xl border border-white/10 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <span>Cards in Deck</span>
              <span className="text-xs font-mono text-slate-400">({activeDeckCards.length})</span>
            </h3>
          </div>

          {activeDeckCards.length === 0 ? (
            <div className="py-12 text-center space-y-3">
              <h4 className="text-base font-bold text-white">No flashcards in this deck yet</h4>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                Add your first question and answer pair manually or generate cards from your study notes.
              </p>
              <button
                type="button"
                onClick={() => {
                  setCardSaveError(null);
                  setCardForm({ front: '', back: '', hint: '', explanation: '', tags: activeDeck.subject });
                  setIsCardModalOpen(true);
                }}
                className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                + Add First Card
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {activeDeckCards.map((card, idx) => (
                <div
                  key={card.id}
                  className="p-4 rounded-2xl bg-slate-950/60 border border-white/5 hover:border-white/10 transition-all flex flex-col md:flex-row md:items-start justify-between gap-4"
                >
                  <div className="space-y-2 flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap text-xs text-slate-400 font-mono">
                      <span className="font-bold text-indigo-400">Card #{idx + 1}</span>
                      <span>·</span>
                      <span className="capitalize">{card.state || 'new'}</span>
                      <span>·</span>
                      <span>Interval: {formatIntervalDays(card.interval)}</span>
                      {card.reviewed && (
                        <>
                          <span>·</span>
                          <span className="text-emerald-400">
                            Reviewed ({card.correctCount || 0}✓ / {card.incorrectCount || 0}✗)
                          </span>
                        </>
                      )}
                      {isCardDue(card) && (
                        <>
                          <span>·</span>
                          <span className="text-rose-400 font-bold">Due now</span>
                        </>
                      )}
                    </div>
                    <div>
                      <span className="text-[11px] font-semibold text-slate-400 block">Question:</span>
                      <p className="text-sm font-bold text-white leading-snug break-words">{card.front}</p>
                    </div>
                    <div>
                      <span className="text-[11px] font-semibold text-emerald-400/90 block">Answer:</span>
                      <p className="text-xs text-slate-200 whitespace-pre-line leading-relaxed break-words">{card.back}</p>
                    </div>
                    {card.hint && (
                      <p className="text-[11px] text-amber-300/90">Hint: {card.hint}</p>
                    )}
                    {card.explanation && (
                      <p className="text-[11px] text-indigo-300/90">Explanation: {card.explanation}</p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        setCardSaveError(null);
                        setCardForm({
                          id: card.id,
                          front: card.front,
                          back: card.back,
                          hint: card.hint || '',
                          explanation: card.explanation || '',
                          tags: (card.tags || []).join(', ')
                        });
                        setIsCardModalOpen(true);
                      }}
                      className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition-all cursor-pointer"
                      title="Edit Card"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteCard(card.id)}
                      className="p-2 rounded-xl bg-white/5 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 transition-all cursor-pointer"
                      title="Delete Card"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Ensure Card Modal & AI Modal also render while in `manage_deck` view! */}
        {renderModals()}
      </div>
    );
  }

  function renderFlashcardSoundSettingsPanel() {
    return (
      <div className="p-4 sm:p-5 rounded-2xl bg-slate-900/95 border border-indigo-500/30 shadow-xl space-y-4 animate-fadeIn">
        <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-indigo-400" />
            <h4 className="text-xs sm:text-sm font-bold text-white">Flashcard Sound & Audio Preferences</h4>
          </div>
          <button
            type="button"
            onClick={() => setIsSoundSettingsOpen(false)}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/5 cursor-pointer"
            aria-label="Close sound settings"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Toggle 1: Flashcard Sound Effects */}
          <div className="p-3.5 rounded-xl bg-slate-950/70 border border-white/5 flex items-center justify-between gap-3">
            <div>
              <span className="text-xs font-bold text-white block">Study Sound Effects</span>
              <span className="text-[11px] text-slate-400">
                Subtle chimes for Reveal, Know It, Still Learning, Shuffle & Complete.
              </span>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={soundEnabled}
              onClick={handleToggleFlashcardSound}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer shrink-0 ${
                soundEnabled
                  ? 'bg-indigo-600 text-white border-indigo-500 shadow-sm'
                  : 'bg-white/5 text-slate-400 border-white/10 hover:text-white'
              }`}
            >
              {soundEnabled ? 'ON' : 'OFF'}
            </button>
          </div>

          {/* Control 2: Volume Slider + Preview */}
          <div className="p-3.5 rounded-xl bg-slate-950/70 border border-white/5 flex flex-col justify-between gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white">Effect Volume</span>
              <span className="text-xs font-mono font-bold text-indigo-400">{Math.round(soundVolume * 100)}%</span>
            </div>
            <div className="flex items-center gap-2.5">
              <VolumeX className="w-3.5 h-3.5 text-slate-500 shrink-0" />
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={Math.round(soundVolume * 100)}
                onChange={e => handleChangeSoundVolume(Number(e.target.value) / 100)}
                aria-label="Flashcard sound effects volume"
                className="w-full accent-indigo-500 cursor-pointer"
              />
              <Volume2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <button
                type="button"
                onClick={() => soundService.playFlashcardKnowIt(4)}
                disabled={!soundEnabled || soundVolume <= 0}
                className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-slate-200 text-[11px] font-semibold border border-white/10 cursor-pointer disabled:opacity-40 shrink-0"
              >
                Test
              </button>
            </div>
          </div>

          {/* Toggle 3: Read-Aloud Speech Synthesis */}
          <div className="p-3.5 rounded-xl bg-slate-950/70 border border-white/5 flex items-center justify-between gap-3">
            <div>
              <span className="text-xs font-bold text-white block">Read-Aloud Voice (TTS)</span>
              <span className="text-[11px] text-slate-400">
                Show button to speak questions and answers aloud.
              </span>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={ttsEnabled}
              onClick={() => {
                const next = !ttsEnabled;
                setTtsEnabled(next);
                if (!next && 'speechSynthesis' in window) {
                  window.speechSynthesis.cancel();
                  setIsSpeaking(false);
                }
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer shrink-0 ${
                ttsEnabled
                  ? 'bg-indigo-600 text-white border-indigo-500 shadow-sm'
                  : 'bg-white/5 text-slate-400 border-white/10 hover:text-white'
              }`}
            >
              {ttsEnabled ? 'ON' : 'OFF'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  function renderModals() {
    return (
      <>
        {/* MODAL: CREATE / EDIT DECK */}
        {isDeckModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
            <div className="bg-slate-900 border border-white/10 rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl">
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <h3 className="text-lg font-extrabold text-white">
                  {deckForm.id ? 'Edit Flashcard Deck' : 'Create Flashcard Deck'}
                </h3>
                <button
                  type="button"
                  onClick={() => setIsDeckModalOpen(false)}
                  className="text-slate-400 hover:text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {deckSaveError && (
                <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-500/40 text-xs text-rose-200 flex items-center justify-between gap-2">
                  <span>{deckSaveError}</span>
                </div>
              )}

              <form onSubmit={handleSaveDeck} className="space-y-4 text-xs">
                <div className="space-y-1.5">
                  <label className="font-bold text-slate-300">Deck Title</label>
                  <input
                    type="text"
                    required
                    value={deckForm.title}
                    onChange={e => setDeckForm(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="e.g. Molecular Genetics & Biochemistry"
                    className="w-full px-3.5 py-2.5 bg-slate-950 rounded-xl border border-white/10 text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="font-bold text-slate-300">Subject</label>
                    <select
                      value={deckForm.subject}
                      onChange={e => setDeckForm(prev => ({ ...prev, subject: e.target.value }))}
                      className="w-full px-3 py-2.5 bg-slate-950 rounded-xl border border-white/10 text-white focus:outline-none focus:border-indigo-500"
                    >
                      <option value="Biology">Biology</option>
                      <option value="Physics">Physics</option>
                      <option value="Chemistry">Chemistry</option>
                      <option value="Mathematics">Mathematics</option>
                      <option value="Computer Science">Computer Science</option>
                      <option value="History">History</option>
                      <option value="Literature">Literature</option>
                      <option value="Languages">Languages</option>
                      <option value="General">General</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="font-bold text-slate-300">Icon Emoji</label>
                    <input
                      type="text"
                      value={deckForm.icon}
                      onChange={e => setDeckForm(prev => ({ ...prev, icon: e.target.value }))}
                      placeholder="📚"
                      className="w-full px-3.5 py-2.5 bg-slate-950 rounded-xl border border-white/10 text-white focus:outline-none focus:border-indigo-500 text-center text-base"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="font-bold text-slate-300">Description</label>
                  <textarea
                    rows={3}
                    value={deckForm.description}
                    onChange={e => setDeckForm(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Summary of concepts covered in this deck..."
                    className="w-full px-3.5 py-2.5 bg-slate-950 rounded-xl border border-white/10 text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="pt-3 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsDeckModalOpen(false)}
                    className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 font-bold cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingDeck}
                    className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold cursor-pointer disabled:opacity-50"
                  >
                    {isSavingDeck ? 'Saving to Supabase...' : deckSaveError ? 'Retry Save Deck' : 'Save Deck'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL: CREATE / EDIT INDIVIDUAL CARD */}
        {isCardModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
            <div className="bg-slate-900 border border-white/10 rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <h3 className="text-lg font-extrabold text-white">
                  {cardForm.id ? 'Edit Flashcard' : 'Add Flashcard to Deck'}
                </h3>
                <button
                  type="button"
                  onClick={() => setIsCardModalOpen(false)}
                  className="text-slate-400 hover:text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {cardSaveError && (
                <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-500/40 text-xs text-rose-200">
                  {cardSaveError}
                </div>
              )}

              <form onSubmit={handleSaveCard} className="space-y-4 text-xs">
                <div className="space-y-1.5">
                  <label className="font-bold text-slate-300">Question / Front Prompt</label>
                  <textarea
                    rows={3}
                    required
                    value={cardForm.front}
                    onChange={e => setCardForm(prev => ({ ...prev, front: e.target.value }))}
                    placeholder="Enter the question or concept prompt..."
                    className="w-full px-3.5 py-2.5 bg-slate-950 rounded-xl border border-white/10 text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="font-bold text-slate-300">Answer / Back</label>
                  <textarea
                    rows={4}
                    required
                    value={cardForm.back}
                    onChange={e => setCardForm(prev => ({ ...prev, back: e.target.value }))}
                    placeholder="Enter the exact answer to reveal..."
                    className="w-full px-3.5 py-2.5 bg-slate-950 rounded-xl border border-white/10 text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="font-bold text-slate-300">Hint (Optional)</label>
                  <input
                    type="text"
                    value={cardForm.hint}
                    onChange={e => setCardForm(prev => ({ ...prev, hint: e.target.value }))}
                    placeholder="Mnemonic or clue..."
                    className="w-full px-3.5 py-2.5 bg-slate-950 rounded-xl border border-white/10 text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="font-bold text-slate-300">Additional Explanation (Optional)</label>
                  <textarea
                    rows={2}
                    value={cardForm.explanation}
                    onChange={e => setCardForm(prev => ({ ...prev, explanation: e.target.value }))}
                    placeholder="Optional deeper context shown after revealing the answer..."
                    className="w-full px-3.5 py-2.5 bg-slate-950 rounded-xl border border-white/10 text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="font-bold text-slate-300">Tags (Comma-separated)</label>
                  <input
                    type="text"
                    value={cardForm.tags}
                    onChange={e => setCardForm(prev => ({ ...prev, tags: e.target.value }))}
                    placeholder="ExamPrep, Genetics, HighYield"
                    className="w-full px-3.5 py-2.5 bg-slate-950 rounded-xl border border-white/10 text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="pt-3 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsCardModalOpen(false)}
                    className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 font-bold cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingCard}
                    className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold cursor-pointer disabled:opacity-50"
                  >
                    {isSavingCard ? 'Saving to Supabase...' : cardSaveError ? 'Retry Save Card' : 'Save Card'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL: AI DECK & FLASHCARD GENERATOR */}
        {isAiModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-fadeIn">
            <div className="bg-slate-900 border border-purple-500/30 rounded-3xl max-w-2xl w-full p-6 space-y-5 shadow-2xl max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-extrabold text-white">AI Flashcard Generator</h3>
                    <p className="text-[11px] text-slate-400">
                      Generate structured Question & Answer cards and save them to Supabase
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setIsAiModalOpen(false);
                    setAiGeneratedCards([]);
                  }}
                  className="text-slate-400 hover:text-white cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {aiGeneratedCards.length === 0 ? (
                <div className="space-y-4 text-xs">
                  {userNotes.length > 0 && (
                    <div className="p-3 bg-indigo-950/30 border border-indigo-500/20 rounded-2xl space-y-2">
                      <span className="text-[11px] font-bold text-indigo-300 flex items-center gap-1.5">
                        <BookOpen className="w-3.5 h-3.5" /> Import from My Lecture Notes:
                      </span>
                      <select
                        value={selectedNoteId}
                        onChange={e => handleSelectNoteForImport(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-950 rounded-xl border border-white/10 text-white focus:outline-none focus:border-indigo-500"
                      >
                        <option value="">-- Choose a note to convert to flashcards --</option>
                        {userNotes.map(n => (
                          <option key={n.id} value={n.id}>
                            {n.title} ({n.subject || 'General'})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="font-bold text-slate-300">Target Topic / Chapter</label>
                      <input
                        type="text"
                        value={aiTopic}
                        onChange={e => setAiTopic(e.target.value)}
                        placeholder="e.g. Thermodynamics & Entropy"
                        className="w-full px-3.5 py-2.5 bg-slate-950 rounded-xl border border-white/10 text-white focus:outline-none focus:border-indigo-500"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="font-bold text-slate-300">Academic Subject</label>
                      <select
                        value={aiSubject}
                        onChange={e => setAiSubject(e.target.value)}
                        className="w-full px-3 py-2.5 bg-slate-950 rounded-xl border border-white/10 text-white focus:outline-none focus:border-indigo-500"
                      >
                        <option value="Biology">Biology</option>
                        <option value="Physics">Physics</option>
                        <option value="Chemistry">Chemistry</option>
                        <option value="Mathematics">Mathematics</option>
                        <option value="Computer Science">Computer Science</option>
                        <option value="History">History</option>
                        <option value="Literature">Literature</option>
                        <option value="General">General</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="font-bold text-slate-300">Card Count</label>
                      <select
                        value={aiCount}
                        onChange={e => setAiCount(Number(e.target.value))}
                        className="w-full px-3 py-2.5 bg-slate-950 rounded-xl border border-white/10 text-white focus:outline-none focus:border-indigo-500"
                      >
                        <option value={4}>4 Flashcards</option>
                        <option value={6}>6 Flashcards</option>
                        <option value={8}>8 Flashcards</option>
                        <option value={10}>10 Flashcards</option>
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="font-bold text-slate-300">Difficulty</label>
                      <select
                        value={aiDifficulty}
                        onChange={e => setAiDifficulty(e.target.value as any)}
                        className="w-full px-3 py-2.5 bg-slate-950 rounded-xl border border-white/10 text-white focus:outline-none focus:border-indigo-500"
                      >
                        <option value="beginner">Beginner / Foundational</option>
                        <option value="intermediate">Intermediate / High School</option>
                        <option value="advanced">Advanced / AP & College Level</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="font-bold text-slate-300">Paste Study Notes / Textbook Text (Optional)</label>
                    <textarea
                      rows={5}
                      value={aiContent}
                      onChange={e => setAiContent(e.target.value)}
                      placeholder="Paste lecture excerpt, syllabus points, or raw notes here..."
                      className="w-full px-3.5 py-2.5 bg-slate-950 rounded-xl border border-white/10 text-white focus:outline-none focus:border-indigo-500 leading-relaxed font-mono text-[11px]"
                    />
                  </div>

                  <div className="pt-3 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setIsAiModalOpen(false)}
                      className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 font-bold cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={aiLoading}
                      onClick={handleTriggerAIGeneration}
                      className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold flex items-center gap-2 shadow-lg cursor-pointer disabled:opacity-50"
                    >
                      {aiLoading ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          <span>Generating Cards...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4" />
                          <span>Generate Flashcards</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4 animate-fadeIn">
                  <div className="p-3.5 bg-purple-950/30 border border-purple-500/20 rounded-2xl flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-bold text-white">{aiDeckTitle}</h4>
                      <p className="text-[11px] text-purple-300">
                        Generated {aiGeneratedCards.length} question & answer pairs.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setAiGeneratedCards([])}
                      className="text-xs text-slate-400 hover:text-white underline cursor-pointer"
                    >
                      Back to Generator
                    </button>
                  </div>

                  <div className="space-y-2.5 max-h-[360px] overflow-y-auto pr-1">
                    {aiGeneratedCards.map((card, idx) => (
                      <div key={idx} className="p-3.5 bg-slate-950 rounded-2xl border border-white/5 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-mono text-purple-400 font-bold">Card #{idx + 1}</span>
                          {card.hint && (
                            <span className="text-[10px] text-amber-300/80">Hint: {card.hint}</span>
                          )}
                        </div>
                        <p className="text-xs font-bold text-white">Q: {card.front}</p>
                        <p className="text-[11px] text-emerald-300 whitespace-pre-line border-t border-white/5 pt-1.5 mt-1">
                          A: {card.back}
                        </p>
                      </div>
                    ))}
                  </div>

                  <div className="pt-3 border-t border-white/10 flex flex-col sm:flex-row items-center justify-end gap-2">
                    <button
                      type="button"
                      disabled={isSavingAiCards}
                      onClick={() => handleSaveAiCards()}
                      className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-lg cursor-pointer disabled:opacity-50"
                    >
                      {isSavingAiCards ? 'Saving to Supabase...' : 'Save as New Deck'}
                    </button>
                    {activeDeck && (
                      <button
                        type="button"
                        disabled={isSavingAiCards}
                        onClick={() => handleSaveAiCards(activeDeck.id)}
                        className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-200 border border-white/10 text-xs font-bold cursor-pointer disabled:opacity-50"
                      >
                        Add to Current Deck ({activeDeck.title})
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </>
    );
  }

  // ==========================================
  // RENDER: MAIN DECK BROWSER & STUDY HUB
  // ==========================================
  return (
    <div className="space-y-6 animate-fadeIn">
      {syncError && (
        <div className="p-3.5 rounded-2xl bg-rose-950/60 border border-rose-500/40 flex items-center justify-between gap-3 text-xs text-rose-200">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{syncError}</span>
          </div>
          <button
            type="button"
            onClick={() => loadFlashcardsFromSupabase()}
            className="px-3 py-1.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 border border-rose-400/30 text-rose-100 font-bold shrink-0 cursor-pointer"
          >
            Retry Sync
          </button>
        </div>
      )}

      {/* Hero Study Center Banner */}
      <div className="p-6 sm:p-8 rounded-3xl relative overflow-hidden bg-slate-900 border border-white/10 shadow-xl">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-xl">
            <div className="flex items-center gap-2 text-xs text-indigo-400 font-semibold">
              <Brain className="w-4 h-4" />
              <span>Spaced Repetition System (SM-2) · Active Recall</span>
              {isLoadingData && (
                <span className="text-slate-400 flex items-center gap-1 ml-2">
                  <RefreshCw className="w-3 h-3 animate-spin" /> Syncing Supabase...
                </span>
              )}
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white font-display tracking-tight">
              Study Center & Flashcards
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              Master course concepts with scheduled active-recall decks. All decks, cards, and your personal review progress are synced with StudentOS Supabase.
            </p>
          </div>

          {/* Quick Study Action Strip */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={startAllDueStudySession}
              disabled={overallStats.dueToday === 0}
              className={`px-5 py-3 rounded-2xl font-bold text-xs flex items-center justify-center gap-2 shadow-lg transition-all cursor-pointer ${
                overallStats.dueToday > 0
                  ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/25'
                  : 'bg-white/5 text-slate-500 border border-white/5 cursor-not-allowed'
              }`}
            >
              <Zap className="w-4 h-4 text-amber-300" />
              <span>Study Due ({overallStats.dueToday})</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setAiTopic('');
                setAiContent('');
                setIsAiModalOpen(true);
              }}
              className="px-4 py-3 rounded-2xl bg-white/5 hover:bg-white/10 text-purple-300 border border-purple-500/30 font-bold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Sparkles className="w-4 h-4 text-purple-400" />
              <span>AI Generator</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setDeckSaveError(null);
                setDeckForm({ title: '', description: '', subject: 'General', icon: '📚' });
                setIsDeckModalOpen(true);
              }}
              className="px-4 py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-white border border-white/10 font-bold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>New Deck</span>
            </button>

            <button
              type="button"
              onClick={() => setIsSoundSettingsOpen(prev => !prev)}
              aria-expanded={isSoundSettingsOpen}
              className={`px-3.5 py-3 rounded-2xl border font-bold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                soundEnabled
                  ? 'bg-white/5 hover:bg-white/10 text-indigo-300 border-indigo-500/30'
                  : 'bg-white/5 hover:bg-white/10 text-slate-400 border-white/10'
              }`}
              title="Flashcard Sound Effects & Volume Settings"
            >
              {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
              <span className="hidden sm:inline">{soundEnabled ? 'Sound' : 'Muted'}</span>
            </button>
          </div>
        </div>
      </div>

      {isSoundSettingsOpen && renderFlashcardSoundSettingsPanel()}

      {/* Global Learning Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="p-4 rounded-2xl bg-slate-900 border border-white/5 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-400">Total Cards</p>
            <p className="text-2xl font-extrabold text-white font-mono tabular-nums mt-0.5">{overallStats.total}</p>
            <p className="text-[11px] text-slate-500 mt-0.5">{decks.length} Decks</p>
          </div>
          <Layers className="w-5 h-5 text-indigo-400" />
        </div>

        <div className="p-4 rounded-2xl bg-slate-900 border border-white/5 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-400">Due For Review</p>
            <p className="text-2xl font-extrabold text-rose-400 font-mono tabular-nums mt-0.5">{overallStats.dueToday}</p>
            <p className="text-[11px] text-slate-500 mt-0.5">{overallStats.newCount} New</p>
          </div>
          <Clock className="w-5 h-5 text-rose-400" />
        </div>

        <div className="p-4 rounded-2xl bg-slate-900 border border-white/5 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-400">Retention Rate</p>
            <p className="text-2xl font-extrabold text-emerald-400 font-mono tabular-nums mt-0.5">{overallStats.retentionRate}%</p>
            <p className="text-[11px] text-slate-500 mt-0.5">Per-User Progress</p>
          </div>
          <Brain className="w-5 h-5 text-emerald-400" />
        </div>

        <div className="p-4 rounded-2xl bg-slate-900 border border-white/5 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-400">Mastered Cards</p>
            <p className="text-2xl font-extrabold text-blue-400 font-mono tabular-nums mt-0.5">{overallStats.masteredCount}</p>
            <p className="text-[11px] text-slate-500 mt-0.5">Interval ≥ 21d</p>
          </div>
          <CheckCircle2 className="w-5 h-5 text-blue-400" />
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-900 p-3 sm:p-4 rounded-2xl border border-white/10 relative z-20">
        <div className="w-full sm:w-64">
          <ProfessionalTabDropdown
            options={subjects.map(s => ({
              id: s,
              label: s === 'All' ? 'All Subjects' : s,
              icon: s === 'All' ? <BookOpen className="w-4 h-4" /> : <GraduationCap className="w-4 h-4" />,
              badge: s === 'All' ? decks.length : decks.filter(d => d.subject === s).length
            }))}
            selectedId={subjectFilter}
            onSelect={setSubjectFilter}
            size="sm"
          />
        </div>

        <div className="relative w-full sm:max-w-xs">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search decks, topics, tags..."
            className="w-full pl-9 pr-4 py-2 bg-slate-950 rounded-xl border border-white/10 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
          />
        </div>
      </div>

      {/* Decks Grid */}
      {filteredDecks.length === 0 ? (
        <div className="p-12 rounded-3xl bg-slate-900 border border-white/10 text-center space-y-3">
          <h3 className="text-base font-bold text-white">No matching flashcard decks</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            Create a new deck or clear your search filter to see all saved decks.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {filteredDecks.map(deck => {
            const deckCards = cards.filter(c => c.deckId === deck.id);
            const stats = calculateDeckStats(deckCards);
            const reviewedInDeck = deckCards.filter(c => c.reviewed).length;

            return (
              <div
                key={deck.id}
                className="group bg-slate-900 hover:bg-slate-900/95 border border-white/10 hover:border-indigo-500/40 rounded-3xl p-6 transition-all duration-200 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-11 h-11 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-2xl">
                      {deck.icon}
                    </div>
                    <div className="text-xs font-mono">
                      {stats.dueToday > 0 ? (
                        <span className="text-rose-400 font-bold">{stats.dueToday} due</span>
                      ) : (
                        <span className="text-emerald-400 font-semibold">Up to date</span>
                      )}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <span className="text-[11px] font-semibold text-indigo-400">{deck.subject}</span>
                    <h3 className="text-lg font-extrabold text-white group-hover:text-indigo-200 transition-colors line-clamp-1">
                      {deck.title}
                    </h3>
                    <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">{deck.description}</p>
                  </div>

                  <div className="mt-5 space-y-1.5">
                    <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
                      <span>{stats.total} cards · {reviewedInDeck} reviewed</span>
                      <span>{stats.retentionRate}% retention</span>
                    </div>
                    <div className="w-full bg-slate-950 rounded-full h-1.5 overflow-hidden">
                      <div
                        className="bg-indigo-500 h-full rounded-full transition-all"
                        style={{
                          width: `${Math.min(100, Math.max(4, (reviewedInDeck / Math.max(1, stats.total)) * 100))}%`
                        }}
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-5 mt-5 border-t border-white/5 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => startStudySession(deck.id, false)}
                    className="flex-1 py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Study</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleOpenManageDeck(deck.id)}
                    className="py-2.5 px-3 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 transition-all text-xs font-semibold cursor-pointer flex items-center gap-1"
                    title="Manage cards in this deck"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Cards</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDeleteDeck(deck.id, deck.title)}
                    className="py-2.5 px-3 rounded-xl bg-white/5 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 border border-white/10 transition-all text-xs cursor-pointer"
                    title="Delete Deck"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {renderModals()}
    </div>
  );
};

export default StudyCenterFlashcards;
