/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Study Center: Interactive Flashcards & SM-2 Spaced Repetition Engine
 */

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Layers, Sparkles, Brain, RotateCw, Play, CheckCircle2, Clock, 
  Flame, Plus, Search, Trash2, Edit3, BookOpen, Volume2, VolumeX, 
  ChevronLeft, ChevronRight, Filter, ArrowRight, Upload, Download, 
  RefreshCw, HelpCircle, Award, Zap, Check, X, ArrowUpRight, BarChart2,
  Bookmark, Share2, Tag, GraduationCap
} from 'lucide-react';
import { ProfessionalTabDropdown } from './ProfessionalTabDropdown';
import { Flashcard, FlashcardDeck, FlashcardQuality, UserProfile, VaultNote } from '../types';
import { 
  getStoredDecks, saveStoredDecks, getStoredCards, saveStoredCards,
  upsertDeck, removeDeck, upsertCard, removeCard, logCardReview, resetDeckProgress,
  fetchSupabaseDecks, fetchSupabaseCards, persistDeckToSupabase, deleteDeckFromSupabase,
  persistCardToSupabase, deleteCardFromSupabase, recordCardReviewInSupabase, resetDeckProgressInSupabase
} from '../lib/flashcardStorage';
import { 
  calculateSM2, formatIntervalDays, getButtonIntervalPreviews, 
  isCardDue, calculateDeckStats, DeckStats 
} from '../lib/sm2Algorithm';
import { generateFlashcardsWithAI, GeneratedFlashcardData } from '../lib/aiFlashcards';
import { getVaultNotes } from '../lib/supabaseNotes';
import { awardStudentXP } from '../lib/gamification';

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
  // Core state
  const [decks, setDecks] = useState<FlashcardDeck[]>([]);
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>('decks');
  const [activeDeckId, setActiveDeckId] = useState<string | null>(null);
  const [subjectFilter, setSubjectFilter] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Study session state
  const [studyCards, setStudyCards] = useState<Flashcard[]>([]);
  const [currentCardIndex, setCurrentCardIndex] = useState<number>(0);
  const [isFlipped, setIsFlipped] = useState<boolean>(false);
  const [completedCardIds, setCompletedCardIds] = useState<string[]>([]);
  const [showHint, setShowHint] = useState<boolean>(false);
  const [isCramMode, setIsCramMode] = useState<boolean>(false);
  const [sessionCompleted, setSessionCompleted] = useState<boolean>(false);
  const [sessionRatings, setSessionRatings] = useState<{ quality: FlashcardQuality; count: number }[]>([]);
  const [ttsEnabled, setTtsEnabled] = useState<boolean>(true);
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);

  // Deck creator / editor modal
  const [isDeckModalOpen, setIsDeckModalOpen] = useState<boolean>(false);
  const [deckForm, setDeckForm] = useState<{ id?: string; title: string; description: string; subject: string; icon: string }>({
    title: '',
    description: '',
    subject: 'General',
    icon: '📚'
  });

  // Card creator / editor modal
  const [isCardModalOpen, setIsCardModalOpen] = useState<boolean>(false);
  const [cardForm, setCardForm] = useState<{ id?: string; front: string; back: string; hint: string; tags: string }>({
    front: '',
    back: '',
    hint: '',
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
  const [aiGeneratedCards, setAiGeneratedCards] = useState<GeneratedFlashcardData[]>([]);
  const [aiDeckTitle, setAiDeckTitle] = useState<string>('');
  const [userNotes, setUserNotes] = useState<VaultNote[]>([]);
  const [selectedNoteId, setSelectedNoteId] = useState<string>('');

  // Load decks and cards on mount from Supabase as canonical source of truth
  useEffect(() => {
    // 1. Initial fast hydration from local cache
    setDecks(getStoredDecks());
    setCards(getStoredCards());

    // 2. Fetch canonical source of truth from Supabase
    fetchSupabaseDecks(currentUser?.uid).then(sbDecks => {
      if (Array.isArray(sbDecks) && sbDecks.length > 0) {
        setDecks(sbDecks);
      }
    });

    fetchSupabaseCards(undefined, currentUser?.uid).then(sbCards => {
      if (Array.isArray(sbCards) && sbCards.length > 0) {
        setCards(sbCards);
      }
    });

    // Fetch user notes for AI import
    if (currentUser?.uid) {
      getVaultNotes(currentUser.uid)
        .then(notes => setUserNotes(notes))
        .catch(err => console.warn('[StudyCenter] Failed to fetch vault notes:', err));
    }
  }, [currentUser?.uid]);

  // Overall statistics
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
      const matchSearch = searchQuery.trim() === '' || 
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

  // Start study session for a deck
  const startStudySession = (deckId: string, cram: boolean = false) => {
    const deckCards = cards.filter(c => c.deckId === deckId);
    if (deckCards.length === 0) {
      showNotification('This deck has no flashcards yet! Add some cards or use the AI Generator.');
      return;
    }

    let sessionPool: Flashcard[];
    if (cram) {
      // Cram mode reviews all cards
      sessionPool = [...deckCards].sort(() => Math.random() - 0.5);
    } else {
      // Spaced repetition mode prioritizes due and new cards
      const dueCards = deckCards.filter(c => isCardDue(c));
      if (dueCards.length === 0) {
        showNotification('🎉 No cards due for review right now! Starting Cram Mode to review all cards.');
        sessionPool = [...deckCards].sort(() => Math.random() - 0.5);
        cram = true;
      } else {
        sessionPool = [...dueCards].sort(() => Math.random() - 0.5);
      }
    }

    setActiveDeckId(deckId);
    setStudyCards(sessionPool);
    setCurrentCardIndex(0);
    setIsFlipped(false);
    setShowHint(false);
    setIsCramMode(cram);
    setSessionCompleted(false);
    setCompletedCardIds([]);
    setSessionRatings([]);
    setViewMode('study');
  };

  // Quick Start "Study All Due Cards Across All Decks"
  const startAllDueStudySession = () => {
    const dueCards = cards.filter(c => isCardDue(c));
    if (dueCards.length === 0) {
      showNotification('🎉 Amazing work! You have 0 cards due for review today across all decks.');
      return;
    }

    setActiveDeckId('all-due');
    setStudyCards([...dueCards].sort(() => Math.random() - 0.5));
    setCurrentCardIndex(0);
    setIsFlipped(false);
    setShowHint(false);
    setIsCramMode(false);
    setSessionCompleted(false);
    setCompletedCardIds([]);
    setSessionRatings([]);
    setViewMode('study');
  };

  // Active current card in session
  const currentCard = studyCards[currentCardIndex] || null;
  const isLastCard = Boolean(studyCards.length > 0 && currentCardIndex === studyCards.length - 1);

  // Real-time SM-2 preview intervals for the 4 rating buttons
  const intervalPreviews = useMemo(() => {
    if (!currentCard) return { again: '< 1d', hard: '1d', good: '3d', easy: '7d' };
    return getButtonIntervalPreviews(currentCard);
  }, [currentCard]);

  // Advance to next card in already-generated deck
  const handleNextCard = () => {
    if (!currentCard) return;

    // Track card completion
    setCompletedCardIds(prev => Array.from(new Set([...prev, currentCard.id])));

    // Log default 'Good' review if not explicitly rated
    if (!isCramMode) {
      try {
        const { allCards } = logCardReview(currentCard.id, 4);
        setCards(allCards);
      } catch (err) {
        console.error('Failed to log SM-2 review:', err);
      }
    }

    if (currentCardIndex + 1 < studyCards.length) {
      setIsFlipped(false);
      setShowHint(false);
      setCurrentCardIndex(prev => prev + 1);
    } else {
      setSessionCompleted(true);
      awardStudentXP(currentUser, 'study_flashcards', { flashcardCount: studyCards.length });
      showNotification('🎉 Deck complete! You finished all cards in this session.');
    }
  };

  // Restart deck from beginning
  const handleRestartDeck = () => {
    setCurrentCardIndex(0);
    setIsFlipped(false);
    setShowHint(false);
    setSessionCompleted(false);
    setCompletedCardIds([]);
    setSessionRatings([]);
  };

  // Handle rating a card
  const handleRateCard = (quality: FlashcardQuality) => {
    if (!currentCard) return;

    // Track card completion
    setCompletedCardIds(prev => Array.from(new Set([...prev, currentCard.id])));

    // Log in SM-2 unless in pure cram mode
    if (!isCramMode) {
      try {
        recordCardReviewInSupabase(currentCard.id, quality, currentUser?.uid).then(({ allCards }) => {
          setCards(allCards);
        });
      } catch (err) {
        console.error('Failed to log SM-2 review:', err);
      }
    }

    // Record session rating metrics
    setSessionRatings(prev => [...prev, { quality, count: 1 }]);

    // Move to next card or finish
    if (currentCardIndex + 1 < studyCards.length) {
      setIsFlipped(false);
      setShowHint(false);
      setCurrentCardIndex(prev => prev + 1);
    } else {
      setSessionCompleted(true);
      awardStudentXP(currentUser, 'study_flashcards', { flashcardCount: studyCards.length });
      showNotification('🎉 Review session completed! Your memory schedule has been updated.');
    }
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
    if (viewMode !== 'study' || sessionCompleted) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if user is typing in an input
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;

      if (e.code === 'Space') {
        e.preventDefault();
        setIsFlipped(prev => !prev);
      } else if (e.key === 'ArrowRight' || e.key === 'Enter') {
        e.preventDefault();
        if (isFlipped) {
          handleNextCard();
        } else {
          setIsFlipped(true);
        }
      } else if (e.key === 'h' || e.key === 'H') {
        setShowHint(prev => !prev);
      } else if (isFlipped) {
        if (e.key === '1') handleRateCard(1); // Again
        else if (e.key === '2') handleRateCard(3); // Hard
        else if (e.key === '3') handleRateCard(4); // Good
        else if (e.key === '4') handleRateCard(5); // Easy
      } else if (e.key === 'Escape') {
        setViewMode('decks');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [viewMode, isFlipped, sessionCompleted, currentCardIndex, studyCards]);

  // Handle deck save
  const handleSaveDeck = (e: React.FormEvent) => {
    e.preventDefault();
    if (!deckForm.title.trim()) return;

    const newDeck: FlashcardDeck = {
      id: deckForm.id || 'deck-' + Date.now(),
      title: deckForm.title.trim(),
      description: deckForm.description.trim(),
      subject: deckForm.subject,
      color: 'from-indigo-600 to-violet-800',
      icon: deckForm.icon || '📚',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: currentUser?.uid || 'user',
      tags: [deckForm.subject]
    };

    persistDeckToSupabase(newDeck, currentUser?.uid).then(updated => {
      setDecks(updated);
    });
    setIsDeckModalOpen(false);
    setDeckForm({ title: '', description: '', subject: 'General', icon: '📚' });
    showNotification(`✓ Deck "${newDeck.title}" saved to StudentOS Supabase!`);
  };

  // Handle card save
  const handleSaveCard = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cardForm.front.trim() || !cardForm.back.trim() || !activeDeckId) return;

    const parsedTags = cardForm.tags
      ? cardForm.tags.split(',').map(t => t.trim()).filter(Boolean)
      : [activeDeck?.subject || 'General'];

    const newCard: Flashcard = {
      id: cardForm.id || 'card-' + Date.now(),
      deckId: activeDeckId,
      front: cardForm.front.trim(),
      back: cardForm.back.trim(),
      hint: cardForm.hint.trim() || undefined,
      tags: parsedTags,
      interval: 0,
      repetition: 0,
      easeFactor: 2.5,
      nextReviewDate: new Date().toISOString(),
      state: 'new'
    };

    persistCardToSupabase(newCard, currentUser?.uid).then(updated => {
      setCards(updated);
    });
    setIsCardModalOpen(false);
    setCardForm({ front: '', back: '', hint: '', tags: '' });
    showNotification('✓ Flashcard saved to StudentOS Supabase!');
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
      showNotification(`✨ Generated ${response.cards.length} high-yield flashcards! Review and add to your library.`);
    } catch (err: any) {
      showNotification('Failed to generate flashcards: ' + (err?.message || 'Check connection.'));
    } finally {
      setAiLoading(false);
    }
  };

  // Save AI Generated Cards into a new or existing deck
  const handleSaveAiCards = (targetDeckId?: string) => {
    if (aiGeneratedCards.length === 0) return;

    let destinationDeckId = targetDeckId;

    if (!destinationDeckId) {
      // Create new deck
      const newDeck: FlashcardDeck = {
        id: 'deck-ai-' + Date.now(),
        title: aiDeckTitle || (aiTopic ? `${aiTopic} Deck` : `${aiSubject} AI Deck`),
        description: `AI-generated active recall deck on ${aiTopic || aiSubject}.`,
        subject: aiSubject,
        color: 'from-violet-600 to-indigo-900',
        icon: '✨',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: currentUser?.uid || 'user',
        tags: [aiSubject, 'AI Generated']
      };
      upsertDeck(newDeck);
      setDecks(getStoredDecks());
      destinationDeckId = newDeck.id;
    }

    // Insert cards
    const newCards: Flashcard[] = aiGeneratedCards.map((c, i) => ({
      id: `card-ai-${Date.now()}-${i}`,
      deckId: destinationDeckId!,
      front: c.front,
      back: c.back,
      hint: c.hint,
      tags: c.tags || [aiSubject],
      interval: 0,
      repetition: 0,
      easeFactor: 2.5,
      nextReviewDate: new Date().toISOString(),
      state: 'new'
    }));

    let allCurrent = getStoredCards();
    newCards.forEach(c => {
      allCurrent = [c, ...allCurrent];
    });
    saveStoredCards(allCurrent);
    setCards(allCurrent);

    setIsAiModalOpen(false);
    setAiGeneratedCards([]);
    setAiTopic('');
    setAiContent('');
    showNotification(`✓ Added ${newCards.length} flashcards to library!`);

    // Switch to that deck view
    setActiveDeckId(destinationDeckId);
    setViewMode('manage_deck');
  };

  // Convert selected user note to AI content
  const handleSelectNoteForImport = (noteId: string) => {
    setSelectedNoteId(noteId);
    const found = userNotes.find(n => n.id === noteId);
    if (found) {
      setAiTopic(found.title);
      setAiSubject(found.subject || 'General');
      setAiContent(found.content);
      showNotification(`✓ Loaded notes from "${found.title}"`);
    }
  };

  // Reset Progress of a deck
  const handleResetDeck = (deckId: string) => {
    if (confirm('Are you sure you want to reset your spaced repetition progress for all cards in this deck?')) {
      resetDeckProgressInSupabase(deckId, currentUser?.uid).then(updated => {
        setCards(updated);
      });
      showNotification('✓ Deck study progress has been reset in Supabase.');
    }
  };

  // Delete Deck
  const handleDeleteDeck = (deckId: string, title: string) => {
    if (confirm(`Delete deck "${title}" and all its flashcards? This cannot be undone.`)) {
      deleteDeckFromSupabase(deckId, currentUser?.uid).then(({ decks: updatedDecks, cards: updatedCards }) => {
        setDecks(updatedDecks);
        setCards(updatedCards);
        if (activeDeckId === deckId) {
          setViewMode('decks');
          setActiveDeckId(null);
        }
        showNotification(`✓ Deleted deck "${title}" from StudentOS.`);
      });
    }
  };

  // ==========================================
  // RENDER: STUDY SESSION VIEW (ANKI SM-2)
  // ==========================================
  if (viewMode === 'study' && currentCard && !sessionCompleted) {
    const progressPercent = Math.round(((currentCardIndex) / studyCards.length) * 100);

    return (
      <div className="space-y-6 max-w-4xl mx-auto animate-fadeIn py-2 sm:py-4">
        {/* Top Session Bar */}
        <div className="flex items-center justify-between bg-slate-900/80 backdrop-blur-md p-4 rounded-2xl border border-white/10 shadow-lg">
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                if (confirm('Exit study session? Your completed cards have been recorded.')) {
                  setViewMode('decks');
                }
              }}
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition-all flex items-center gap-1.5 text-xs font-semibold cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Exit</span>
            </button>
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <span>{activeDeck?.icon || '🧠'}</span>
                <span>{activeDeckId === 'all-due' ? 'All Due Flashcards' : activeDeck?.title}</span>
                {isCramMode && (
                  <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    Cram Mode
                  </span>
                )}
              </h3>
              <div className="flex items-center gap-2 text-[11px] text-slate-400">
                <span>Card {currentCardIndex + 1} of {studyCards.length}</span>
                <span>•</span>
                <span className="text-emerald-400 font-semibold">{completedCardIds.length} completed</span>
              </div>
            </div>
          </div>

          {/* Quick controls */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setTtsEnabled(!ttsEnabled)}
              className={`p-2 rounded-xl border transition-all text-xs font-semibold flex items-center gap-1.5 cursor-pointer ${
                ttsEnabled ? 'bg-indigo-600/20 border-indigo-500/40 text-indigo-300' : 'bg-white/5 border-white/5 text-slate-400 hover:text-white'
              }`}
              title="Toggle Audio Read-Aloud (TTS)"
            >
              {ttsEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>

            <div className="px-3 py-1.5 bg-black/40 rounded-xl border border-white/5 text-[11px] font-mono text-indigo-400 font-bold hidden sm:flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              <span>Interval: {formatIntervalDays(currentCard.interval)}</span>
            </div>
          </div>
        </div>

        {/* Progress bar */}
        <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden border border-white/5">
          <div 
            className="bg-gradient-to-r from-indigo-500 to-teal-400 h-full transition-all duration-300 rounded-full"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* 3D Flip Card Container */}
        <div 
          className="relative min-h-[340px] sm:min-h-[420px] w-full perspective-1000 cursor-pointer select-none"
          style={{ touchAction: 'manipulation' }}
          onClick={() => setIsFlipped(prev => !prev)}
        >
          <motion.div
            className="w-full h-full relative preserve-3d transition-transform duration-500"
            animate={{ rotateY: isFlipped ? 180 : 0 }}
            transition={{ duration: 0.5, ease: 'easeInOut' }}
          >
            {/* FRONT OF CARD */}
            <div className={`absolute inset-0 w-full min-h-[320px] sm:min-h-[420px] rounded-2xl sm:rounded-3xl p-4 sm:p-8 md:p-10 flex flex-col justify-between border backface-hidden shadow-2xl overflow-hidden ${
              isFlipped ? 'pointer-events-none' : ''
            } bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950/40 border-white/10`}>
              {/* Header */}
              <div className="flex items-center justify-between border-b border-white/5 pb-4">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-[10px] font-extrabold uppercase tracking-wider">
                    Question / Prompt
                  </span>
                  {currentCard.state && (
                    <span className={`text-[9px] uppercase font-mono px-2 py-0.5 rounded-full font-bold ${
                      currentCard.state === 'mastered' ? 'bg-emerald-500/20 text-emerald-300' :
                      currentCard.state === 'review' ? 'bg-blue-500/20 text-blue-300' :
                      currentCard.state === 'learning' ? 'bg-amber-500/20 text-amber-300' :
                      'bg-slate-500/20 text-slate-300'
                    }`}>
                      {currentCard.state}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {ttsEnabled && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        speakText(currentCard.front);
                      }}
                      className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition-all cursor-pointer"
                      title="Read question aloud"
                    >
                      <Volume2 className="w-4 h-4" />
                    </button>
                  )}
                  {currentCard.hint && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowHint(!showHint);
                      }}
                      className={`p-2 rounded-xl border text-xs font-semibold transition-all cursor-pointer flex items-center gap-1 ${
                        showHint ? 'bg-amber-500/20 text-amber-300 border-amber-500/30' : 'bg-white/5 text-slate-400 border-white/5 hover:text-white'
                      }`}
                      title="Show / Hide Hint"
                    >
                      <HelpCircle className="w-4 h-4" />
                      <span className="text-[10px] hidden sm:inline">Hint</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Main Prompt */}
              <div className="my-auto py-6 sm:py-10 text-center">
                <p className="text-xl sm:text-2xl md:text-3xl font-black text-white leading-relaxed font-display">
                  {currentCard.front}
                </p>

                {/* Collapsible Hint */}
                <AnimatePresence>
                  {showHint && currentCard.hint && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="mt-6 p-3 sm:p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs max-w-lg mx-auto leading-relaxed"
                    >
                      💡 <strong>Hint:</strong> {currentCard.hint}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Footer */}
              <div className="pt-4 border-t border-white/5 flex items-center justify-between text-xs text-slate-400">
                <div className="flex items-center gap-1.5 flex-wrap">
                  {currentCard.tags && currentCard.tags.map((t, i) => (
                    <span key={i} className="text-[10px] px-2 py-0.5 rounded-md bg-white/5 text-slate-400 font-mono">
                      #{t}
                    </span>
                  ))}
                </div>
                <div className="flex items-center gap-1 text-[11px] text-indigo-400 font-bold">
                  <span>Tap card or press Space to reveal answer</span>
                  <RotateCw className="w-3.5 h-3.5 animate-spin-slow" />
                </div>
              </div>
            </div>

            {/* BACK OF CARD */}
            <div 
              style={{ transform: 'rotateY(180deg)' }}
              className={`absolute inset-0 w-full min-h-[320px] sm:min-h-[420px] rounded-2xl sm:rounded-3xl p-4 sm:p-8 md:p-10 flex flex-col justify-between border backface-hidden shadow-2xl overflow-hidden bg-gradient-to-br from-slate-900 via-indigo-950/50 to-slate-950 border-indigo-500/30 ${
                !isFlipped ? 'pointer-events-none' : ''
              }`}
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-white/5 pb-4">
                <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-[10px] font-extrabold uppercase tracking-wider flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Answer & Explanation
                </span>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsFlipped(false);
                    }}
                    className="px-2.5 py-1 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 text-[10px] font-bold transition-all cursor-pointer flex items-center gap-1"
                    title="Flip back to question"
                  >
                    <RotateCw className="w-3 h-3" />
                    <span>Flip to Question</span>
                  </button>

                  {ttsEnabled && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        speakText(currentCard.back);
                      }}
                      className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition-all cursor-pointer"
                      title="Read answer aloud"
                    >
                      <Volume2 className="w-4 h-4" />
                    </button>
                  )}
                  <span className="text-[10px] text-slate-400 font-mono hidden sm:inline">
                    Ease: {(currentCard.easeFactor || 2.5).toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Main Answer */}
              <div className="my-auto py-6 sm:py-8 text-center max-w-2xl mx-auto overflow-y-auto max-h-[220px] scrollbar-thin">
                <div className="text-base sm:text-xl font-bold text-slate-100 leading-relaxed whitespace-pre-line">
                  {currentCard.back}
                </div>
              </div>

              {/* Footer */}
              <div className="pt-4 border-t border-white/5 flex items-center justify-between text-xs text-slate-400">
                <span className="text-[11px] text-slate-400">
                  Ready to proceed? Click <strong>Next Card</strong> or rate recall below:
                </span>
                <span className="text-[11px] text-indigo-400 font-semibold hidden sm:inline">
                  Keys 1-4 rate • Enter / → next
                </span>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Primary Action Controls */}
        {isFlipped ? (
          <div className="space-y-4 animate-fadeIn">
            {/* Prominent Next Card Action Row */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                onClick={() => setIsFlipped(false)}
                className="w-full sm:w-auto px-5 py-3 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white text-xs font-bold transition-all active:scale-95 flex items-center justify-center gap-2 cursor-pointer min-h-[46px]"
              >
                <RotateCw className="w-4 h-4" />
                <span>Flip Back to Prompt</span>
              </button>

              <button
                onClick={handleNextCard}
                className={`w-full sm:w-auto flex-1 max-w-md px-8 py-3.5 rounded-2xl text-white font-extrabold text-sm uppercase tracking-wider shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2 cursor-pointer min-h-[48px] ${
                  isLastCard
                    ? 'bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 shadow-emerald-600/30'
                    : 'bg-gradient-to-r from-indigo-600 via-indigo-500 to-teal-500 hover:from-indigo-500 hover:to-teal-400 shadow-indigo-600/30'
                }`}
              >
                {isLastCard ? (
                  <>
                    <CheckCircle2 className="w-5 h-5" />
                    <span>Complete Deck</span>
                  </>
                ) : (
                  <>
                    <span>Next Card ({currentCardIndex + 2} of {studyCards.length})</span>
                    <ArrowRight className="w-5 h-5" />
                  </>
                )}
              </button>
            </div>

            {/* Active Recall Difficulty Rating Buttons (SM-2 Algorithm) */}
            <div className="pt-2">
              <p className="text-[11px] font-bold text-slate-400 text-center uppercase tracking-wider mb-2">
                Or Rate Retention (SM-2 Spaced Repetition):
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
                {/* Button 1: AGAIN */}
                <button
                  onClick={() => handleRateCard(1)}
                  className="p-3.5 sm:p-4 rounded-2xl bg-rose-950/40 hover:bg-rose-900/60 border border-rose-500/30 hover:border-rose-400 text-left transition-all active:scale-95 group cursor-pointer shadow-lg shadow-rose-950/20 min-h-[52px]"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-rose-300 uppercase tracking-wider">
                      1. Again
                    </span>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 font-bold">
                      {intervalPreviews.again}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">Forgot completely</p>
                </button>

                {/* Button 2: HARD */}
                <button
                  onClick={() => handleRateCard(3)}
                  className="p-3.5 sm:p-4 rounded-2xl bg-amber-950/40 hover:bg-amber-900/60 border border-amber-500/30 hover:border-amber-400 text-left transition-all active:scale-95 group cursor-pointer shadow-lg shadow-amber-950/20 min-h-[52px]"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-amber-300 uppercase tracking-wider">
                      2. Hard
                    </span>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold">
                      {intervalPreviews.hard}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">High friction recall</p>
                </button>

                {/* Button 3: GOOD */}
                <button
                  onClick={() => handleRateCard(4)}
                  className="p-3.5 sm:p-4 rounded-2xl bg-blue-950/40 hover:bg-blue-900/60 border border-blue-500/30 hover:border-blue-400 text-left transition-all active:scale-95 group cursor-pointer shadow-lg shadow-blue-950/20 min-h-[52px]"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-blue-300 uppercase tracking-wider">
                      3. Good
                    </span>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 font-bold">
                      {intervalPreviews.good}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">Recalled correctly</p>
                </button>

                {/* Button 4: EASY */}
                <button
                  onClick={() => handleRateCard(5)}
                  className="p-3.5 sm:p-4 rounded-2xl bg-emerald-950/40 hover:bg-emerald-900/60 border border-emerald-500/30 hover:border-emerald-400 text-left transition-all active:scale-95 group cursor-pointer shadow-lg shadow-emerald-950/20 min-h-[52px]"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-emerald-300 uppercase tracking-wider">
                      4. Easy
                    </span>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold">
                      {intervalPreviews.easy}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">Instant fluent recall</p>
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex justify-center">
            <button
              onClick={() => setIsFlipped(true)}
              className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-gradient-to-r from-indigo-600 to-teal-500 hover:from-indigo-500 hover:to-teal-400 text-white font-extrabold text-sm uppercase tracking-wider shadow-lg shadow-indigo-600/30 transition-all active:scale-95 flex items-center justify-center gap-2.5 cursor-pointer min-h-[48px]"
            >
              <RotateCw className="w-5 h-5" />
              <span>Reveal Answer (Tap or Space)</span>
            </button>
          </div>
        )}

        {/* Keyboard hints strip */}
        <div className="flex items-center justify-center gap-3 sm:gap-4 text-[10px] text-slate-500 font-mono pt-1 flex-wrap">
          <span><kbd className="px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-slate-300">Space</kbd> Flip</span>
          <span><kbd className="px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-slate-300">Enter / →</kbd> Next</span>
          <span><kbd className="px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-slate-300">1-4</kbd> Rate</span>
          <span><kbd className="px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-slate-300">H</kbd> Hint</span>
          <span><kbd className="px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-slate-300">Esc</kbd> Exit</span>
        </div>
      </div>
    );
  }

  // ==========================================
  // RENDER: SESSION COMPLETED CELEBRATION
  // ==========================================
  if (viewMode === 'study' && sessionCompleted) {
    const totalReviewed = sessionRatings.length || completedCardIds.length;
    const goodOrEasyCount = sessionRatings.filter(r => r.quality >= 4).length;
    const accuracy = totalReviewed > 0 ? Math.round((goodOrEasyCount / totalReviewed) * 100) : 100;

    return (
      <div className="max-w-2xl mx-auto py-8 text-center space-y-6 animate-fadeIn">
        <div className="p-6 sm:p-10 rounded-3xl bg-slate-900 border border-indigo-500/30 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
          
          <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-tr from-amber-400 to-indigo-500 rounded-3xl flex items-center justify-center text-3xl sm:text-4xl shadow-xl mx-auto mb-4 animate-bounce">
            🏆
          </div>

          <h2 className="text-2xl sm:text-3xl font-black text-white font-display">Session Complete!</h2>
          <p className="text-slate-400 text-xs sm:text-sm mt-1 max-w-md mx-auto">
            You reviewed {totalReviewed} flashcards. SuperMemo SM-2 has rescheduled your next spaced intervals to maximize memory consolidation.
          </p>

          <div className="grid grid-cols-3 gap-2.5 sm:gap-4 my-6 sm:my-8">
            <div className="p-3 sm:p-4 rounded-2xl bg-white/5 border border-white/5">
              <span className="text-xl sm:text-2xl font-black text-white font-mono">{totalReviewed}</span>
              <p className="text-[9px] sm:text-[10px] uppercase font-bold text-slate-400 mt-1">Cards Reviewed</p>
            </div>
            <div className="p-3 sm:p-4 rounded-2xl bg-white/5 border border-white/5">
              <span className="text-xl sm:text-2xl font-black text-emerald-400 font-mono">{accuracy}%</span>
              <p className="text-[9px] sm:text-[10px] uppercase font-bold text-slate-400 mt-1">Recall Accuracy</p>
            </div>
            <div className="p-3 sm:p-4 rounded-2xl bg-white/5 border border-white/5">
              <span className="text-xl sm:text-2xl font-black text-indigo-400 font-mono">+{totalReviewed * 5}</span>
              <p className="text-[9px] sm:text-[10px] uppercase font-bold text-slate-400 mt-1">XP Points</p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              onClick={handleRestartDeck}
              className="w-full sm:w-auto px-6 py-3.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs uppercase tracking-wider transition-all shadow-lg active:scale-95 cursor-pointer flex items-center justify-center gap-2 min-h-[46px]"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Restart Deck</span>
            </button>
            <button
              onClick={() => {
                if (activeDeckId) {
                  startStudySession(activeDeckId, true);
                } else {
                  startAllDueStudySession();
                }
              }}
              className="w-full sm:w-auto px-6 py-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs uppercase tracking-wider transition-all shadow-lg active:scale-95 cursor-pointer flex items-center justify-center gap-2 min-h-[46px]"
            >
              <Zap className="w-4 h-4" />
              <span>Review Again (Cram)</span>
            </button>
            <button
              onClick={() => {
                setViewMode('decks');
                setActiveDeckId(null);
              }}
              className="w-full sm:w-auto px-6 py-3.5 rounded-2xl bg-white/5 hover:bg-white/10 text-slate-200 border border-white/10 font-bold text-xs uppercase tracking-wider transition-all cursor-pointer min-h-[46px]"
            >
              Return to Study Center
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
              onClick={() => setViewMode('decks')}
              className="p-2.5 rounded-2xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/5 transition-all cursor-pointer"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-2xl">{activeDeck.icon}</span>
                <h2 className="text-2xl font-black text-white font-display tracking-tight">{activeDeck.title}</h2>
                <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-300 font-extrabold uppercase border border-indigo-500/20">
                  {activeDeck.subject}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">{activeDeck.description}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => startStudySession(activeDeck.id, false)}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs uppercase tracking-wider shadow-md transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Study ({activeDeckStats.dueToday} Due)</span>
            </button>
            <button
              onClick={() => {
                setCardForm({ front: '', back: '', hint: '', tags: activeDeck.subject });
                setIsCardModalOpen(true);
              }}
              className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs uppercase tracking-wider shadow-md transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Card</span>
            </button>
            <button
              onClick={() => {
                setAiTopic(activeDeck.title);
                setAiSubject(activeDeck.subject);
                setIsAiModalOpen(true);
              }}
              className="px-3.5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-purple-300 hover:text-purple-200 border border-purple-500/20 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
              title="Use AI to generate more cards for this deck"
            >
              <Sparkles className="w-3.5 h-3.5 text-purple-400" />
              <span>AI Expand</span>
            </button>
            <button
              onClick={() => handleResetDeck(activeDeck.id)}
              className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white border border-white/5 transition-all cursor-pointer"
              title="Reset Spaced Repetition Intervals"
            >
              <RotateCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Deck metrics strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-4 rounded-2xl bg-slate-900 border border-white/5 flex items-center justify-between">
            <div>
              <p className="text-[10px] uppercase font-bold text-slate-400">Total Cards</p>
              <p className="text-xl font-black text-white font-mono mt-0.5">{activeDeckStats.total}</p>
            </div>
            <Layers className="w-5 h-5 text-indigo-400" />
          </div>

          <div className="p-4 rounded-2xl bg-slate-900 border border-white/5 flex items-center justify-between">
            <div>
              <p className="text-[10px] uppercase font-bold text-slate-400">Due Today</p>
              <p className="text-xl font-black text-rose-400 font-mono mt-0.5">{activeDeckStats.dueToday}</p>
            </div>
            <Clock className="w-5 h-5 text-rose-400" />
          </div>

          <div className="p-4 rounded-2xl bg-slate-900 border border-white/5 flex items-center justify-between">
            <div>
              <p className="text-[10px] uppercase font-bold text-slate-400">Retention Rate</p>
              <p className="text-xl font-black text-emerald-400 font-mono mt-0.5">{activeDeckStats.retentionRate}%</p>
            </div>
            <Brain className="w-5 h-5 text-emerald-400" />
          </div>

          <div className="p-4 rounded-2xl bg-slate-900 border border-white/5 flex items-center justify-between">
            <div>
              <p className="text-[10px] uppercase font-bold text-slate-400">Mastered</p>
              <p className="text-xl font-black text-blue-400 font-mono mt-0.5">{activeDeckStats.masteredCount}</p>
            </div>
            <CheckCircle2 className="w-5 h-5 text-blue-400" />
          </div>
        </div>

        {/* Cards list table */}
        <div className="bg-slate-900 rounded-3xl border border-white/10 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <span>Deck Flashcards</span>
              <span className="text-xs font-mono text-slate-500">({activeDeckCards.length})</span>
            </h3>
          </div>

          {activeDeckCards.length === 0 ? (
            <div className="py-12 text-center space-y-3">
              <span className="text-4xl">📭</span>
              <h4 className="text-base font-bold text-white">No cards in this deck</h4>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                Create your first active recall card manually or use AI to generate high-yield cards from a topic.
              </p>
              <button
                onClick={() => {
                  setCardForm({ front: '', back: '', hint: '', tags: activeDeck.subject });
                  setIsCardModalOpen(true);
                }}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold uppercase transition-all"
              >
                + Add First Card
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {activeDeckCards.map((card, idx) => (
                <div 
                  key={card.id}
                  className="p-4 rounded-2xl bg-slate-950/60 border border-white/5 hover:border-white/10 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] font-mono font-extrabold text-indigo-400">
                        #{idx + 1}
                      </span>
                      <span className={`text-[9px] uppercase font-mono px-2 py-0.5 rounded-full font-bold ${
                        card.state === 'mastered' ? 'bg-emerald-500/20 text-emerald-300' :
                        card.state === 'review' ? 'bg-blue-500/20 text-blue-300' :
                        card.state === 'learning' ? 'bg-amber-500/20 text-amber-300' :
                        'bg-slate-500/20 text-slate-300'
                      }`}>
                        {card.state || 'new'}
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono">
                        Interval: {formatIntervalDays(card.interval)}
                      </span>
                      {isCardDue(card) && (
                        <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 font-black">
                          DUE
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-bold text-white leading-snug">{card.front}</p>
                    <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">{card.back}</p>
                    {card.hint && (
                      <p className="text-[11px] text-amber-300/80 italic">💡 Hint: {card.hint}</p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => {
                        setCardForm({
                          id: card.id,
                          front: card.front,
                          back: card.back,
                          hint: card.hint || '',
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
                      onClick={() => {
                        if (confirm('Delete this card?')) {
                          deleteCardFromSupabase(card.id, currentUser?.uid).then(updated => {
                            setCards(updated);
                          });
                          showNotification('✓ Flashcard removed.');
                        }
                      }}
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
      </div>
    );
  }

  // ==========================================
  // RENDER: MAIN DECK BROWSER & STUDY HUB
  // ==========================================
  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Hero Study Center Banner */}
      <div className="p-6 sm:p-8 rounded-3xl relative overflow-hidden bg-gradient-to-r from-indigo-950/60 via-slate-900 to-purple-950/50 border border-indigo-500/20 shadow-2xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-xl">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-indigo-400 bg-indigo-500/10 px-2.5 py-1 rounded-full border border-indigo-500/20 flex items-center gap-1">
                <Brain className="w-3 h-3" /> Spaced Repetition System (SM-2)
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 font-bold">
                Active Recall
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-black text-white font-display tracking-tight">
              Study Center & Flashcards
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              Supercharge your retention with scientifically scheduled Anki-style review sessions. Turn lecture notes into mastery decks with intelligent AI prompts.
            </p>
          </div>

          {/* Quick Study Action Strip */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
            <button
              onClick={startAllDueStudySession}
              disabled={overallStats.dueToday === 0}
              className={`px-5 py-3.5 rounded-2xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-xl transition-all active:scale-95 cursor-pointer ${
                overallStats.dueToday > 0 
                  ? 'bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white shadow-indigo-600/30' 
                  : 'bg-white/5 text-slate-500 border border-white/5 cursor-not-allowed'
              }`}
            >
              <Zap className="w-4 h-4 fill-current text-amber-300" />
              <span>Study Due Today ({overallStats.dueToday})</span>
            </button>

            <button
              onClick={() => {
                setAiTopic('');
                setAiContent('');
                setIsAiModalOpen(true);
              }}
              className="px-4 py-3.5 rounded-2xl bg-white/5 hover:bg-white/10 text-purple-300 hover:text-purple-200 border border-purple-500/30 font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Sparkles className="w-4 h-4 text-purple-400" />
              <span>AI Deck Generator</span>
            </button>

            <button
              onClick={() => {
                setDeckForm({ title: '', description: '', subject: 'General', icon: '📚' });
                setIsDeckModalOpen(true);
              }}
              className="px-4 py-3.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-white border border-white/10 font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>New Deck</span>
            </button>
          </div>
        </div>
      </div>

      {/* Global Learning Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="p-4 rounded-2xl bg-slate-900/90 border border-white/5 shadow-md flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase text-slate-400">Total Cards</p>
            <p className="text-2xl font-black text-white font-mono mt-0.5">{overallStats.total}</p>
            <p className="text-[10px] text-slate-500 mt-0.5">{decks.length} Decks</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
            <Layers className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/90 border border-white/5 shadow-md flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase text-slate-400">Due For Review</p>
            <p className="text-2xl font-black text-rose-400 font-mono mt-0.5">{overallStats.dueToday}</p>
            <p className="text-[10px] text-slate-500 mt-0.5">{overallStats.newCount} New Cards</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/90 border border-white/5 shadow-md flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase text-slate-400">Memory Retention</p>
            <p className="text-2xl font-black text-emerald-400 font-mono mt-0.5">{overallStats.retentionRate}%</p>
            <p className="text-[10px] text-emerald-500/80 mt-0.5">SM-2 Efficiency</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <Brain className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/90 border border-white/5 shadow-md flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase text-slate-400">Mastered Concepts</p>
            <p className="text-2xl font-black text-blue-400 font-mono mt-0.5">{overallStats.masteredCount}</p>
            <p className="text-[10px] text-slate-500 mt-0.5">Interval &gt; 21 days</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-900/90 p-3 sm:p-4 rounded-2xl border border-white/10 relative z-20">
        {/* Subject Dropdown Filter */}
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

        {/* Search input */}
        <div className="relative w-full sm:max-w-xs">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search decks, topics, tags..."
            className="w-full pl-9 pr-4 py-2 bg-slate-950/80 rounded-xl border border-white/10 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
          />
        </div>
      </div>

      {/* Decks Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        {filteredDecks.map(deck => {
          const deckCards = cards.filter(c => c.deckId === deck.id);
          const stats = calculateDeckStats(deckCards);

          return (
            <div
              key={deck.id}
              className="group bg-slate-900/70 hover:bg-slate-900 border border-white/5 hover:border-indigo-500/40 rounded-3xl p-6 transition-all duration-300 hover:shadow-xl hover:shadow-indigo-500/10 flex flex-col justify-between"
            >
              <div>
                {/* Top strip */}
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-white/5 to-white/10 border border-white/10 flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">
                    {deck.icon}
                  </div>
                  <div className="flex items-center gap-1.5">
                    {stats.dueToday > 0 ? (
                      <span className="px-2.5 py-1 rounded-full bg-rose-500/20 border border-rose-500/30 text-rose-300 font-mono text-[10px] font-black animate-pulse">
                        {stats.dueToday} DUE
                      </span>
                    ) : (
                      <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 font-mono text-[10px] font-bold">
                        ✓ UP TO DATE
                      </span>
                    )}
                  </div>
                </div>

                {/* Title & Subject */}
                <div className="space-y-1">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-400">
                    {deck.subject}
                  </span>
                  <h3 className="text-lg font-black text-white group-hover:text-indigo-200 transition-colors line-clamp-1">
                    {deck.title}
                  </h3>
                  <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                    {deck.description}
                  </p>
                </div>

                {/* Progress bar */}
                <div className="mt-5 space-y-1.5">
                  <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
                    <span>{stats.total} cards</span>
                    <span>{stats.retentionRate}% retention</span>
                  </div>
                  <div className="w-full bg-slate-950 rounded-full h-1.5 overflow-hidden">
                    <div 
                      className="bg-indigo-500 h-full rounded-full"
                      style={{ width: `${Math.min(100, Math.max(5, (stats.masteredCount / Math.max(1, stats.total)) * 100))}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Bottom Actions */}
              <div className="pt-6 mt-6 border-t border-white/5 flex items-center justify-between gap-2">
                <button
                  onClick={() => startStudySession(deck.id, false)}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 active:scale-95 cursor-pointer shadow-md shadow-indigo-600/20"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Study</span>
                </button>

                <button
                  onClick={() => {
                    setActiveDeckId(deck.id);
                    setViewMode('manage_deck');
                  }}
                  className="py-2.5 px-3 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/5 transition-all text-xs font-semibold cursor-pointer"
                  title="Manage cards in this deck"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                </button>

                <button
                  onClick={() => handleDeleteDeck(deck.id, deck.title)}
                  className="py-2.5 px-3 rounded-xl bg-white/5 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 border border-white/5 transition-all text-xs cursor-pointer"
                  title="Delete Deck"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* ========================================== */}
      {/* MODAL: CREATE / EDIT DECK                   */}
      {/* ========================================== */}
      {isDeckModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-900 border border-white/10 rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/5 pb-3">
              <h3 className="text-lg font-black text-white">Create Flashcard Deck</h3>
              <button 
                onClick={() => setIsDeckModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

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
                    <option value="Biology">🧬 Biology</option>
                    <option value="Physics">⚛️ Physics</option>
                    <option value="Chemistry">🧪 Chemistry</option>
                    <option value="Mathematics">📐 Mathematics</option>
                    <option value="Computer Science">💻 Computer Science</option>
                    <option value="History">🏛️ History</option>
                    <option value="Literature">📖 Literature</option>
                    <option value="Languages">🌍 Languages</option>
                    <option value="General">📚 General</option>
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
                  className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold uppercase tracking-wider"
                >
                  Save Deck
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* MODAL: CREATE / EDIT INDIVIDUAL CARD        */}
      {/* ========================================== */}
      {isCardModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-900 border border-white/10 rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/5 pb-3">
              <h3 className="text-lg font-black text-white">
                {cardForm.id ? 'Edit Flashcard' : 'Add Flashcard to Deck'}
              </h3>
              <button 
                onClick={() => setIsCardModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveCard} className="space-y-4 text-xs">
              <div className="space-y-1.5">
                <label className="font-bold text-slate-300">Front (Prompt / Question / Theorem)</label>
                <textarea
                  rows={3}
                  required
                  value={cardForm.front}
                  onChange={e => setCardForm(prev => ({ ...prev, front: e.target.value }))}
                  placeholder="State the principle or pose a question..."
                  className="w-full px-3.5 py-2.5 bg-slate-950 rounded-xl border border-white/10 text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-slate-300">Back (Answer / Deep Explanation / Key Points)</label>
                <textarea
                  rows={4}
                  required
                  value={cardForm.back}
                  onChange={e => setCardForm(prev => ({ ...prev, back: e.target.value }))}
                  placeholder="Accurate, concise active recall answer..."
                  className="w-full px-3.5 py-2.5 bg-slate-950 rounded-xl border border-white/10 text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-slate-300">Subtle Memory Hint (Optional)</label>
                <input
                  type="text"
                  value={cardForm.hint}
                  onChange={e => setCardForm(prev => ({ ...prev, hint: e.target.value }))}
                  placeholder="Mnemonic or keyword to jog memory..."
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
                  className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold uppercase tracking-wider"
                >
                  Save Card
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* MODAL: AI DECK & FLASHCARD GENERATOR        */}
      {/* ========================================== */}
      {isAiModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-fadeIn">
          <div className="bg-slate-900 border border-purple-500/30 rounded-3xl max-w-2xl w-full p-6 space-y-5 shadow-2xl max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-white/5 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-white">AI Flashcard Generator</h3>
                  <p className="text-[11px] text-slate-400">Transform any lecture topic or note into SM-2 active recall cards</p>
                </div>
              </div>
              <button 
                onClick={() => {
                  setIsAiModalOpen(false);
                  setAiGeneratedCards([]);
                }}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Input controls */}
            {aiGeneratedCards.length === 0 ? (
              <div className="space-y-4 text-xs">
                {/* Note Importer quick picker */}
                {userNotes.length > 0 && (
                  <div className="p-3 bg-indigo-950/30 border border-indigo-500/20 rounded-2xl space-y-2">
                    <span className="text-[10px] font-extrabold text-indigo-300 uppercase tracking-wider flex items-center gap-1.5">
                      <BookOpen className="w-3.5 h-3.5" /> Import Directly from My Personal Notes:
                    </span>
                    <select
                      value={selectedNoteId}
                      onChange={e => handleSelectNoteForImport(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-950 rounded-xl border border-white/10 text-white focus:outline-none focus:border-indigo-500"
                    >
                      <option value="">-- Choose a note to convert to cards --</option>
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
                      <option value={4}>4 High-Yield Cards (Quick)</option>
                      <option value={6}>6 Flashcards (Standard)</option>
                      <option value={8}>8 Flashcards (Comprehensive)</option>
                      <option value={10}>10 Flashcards (Deep Exam Prep)</option>
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
                    placeholder="Paste lecture excerpt, syllabus bullet points, or raw notes here for the AI to extract key testable concepts..."
                    className="w-full px-3.5 py-2.5 bg-slate-950 rounded-xl border border-white/10 text-white focus:outline-none focus:border-indigo-500 leading-relaxed font-mono text-[11px]"
                  />
                </div>

                <div className="pt-3 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsAiModalOpen(false)}
                    className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 font-bold"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={aiLoading}
                    onClick={handleTriggerAIGeneration}
                    className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-purple-600/30 active:scale-95 cursor-pointer disabled:opacity-50"
                  >
                    {aiLoading ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Synthesizing Cards...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        <span>Generate Active Recall Cards</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            ) : (
              /* Preview Generated Cards */
              <div className="space-y-4 animate-fadeIn">
                <div className="p-3 bg-purple-950/30 border border-purple-500/20 rounded-2xl flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-bold text-white">{aiDeckTitle}</h4>
                    <p className="text-[11px] text-purple-300">
                      Generated {aiGeneratedCards.length} cards based on your inputs.
                    </p>
                  </div>
                  <button
                    onClick={() => setAiGeneratedCards([])}
                    className="text-xs text-slate-400 hover:text-white underline"
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
                          <span className="text-[10px] text-amber-300/80 italic">💡 {card.hint}</span>
                        )}
                      </div>
                      <p className="text-xs font-bold text-white">{card.front}</p>
                      <p className="text-[11px] text-slate-300 whitespace-pre-line border-t border-white/5 pt-1.5 mt-1">
                        {card.back}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="pt-3 border-t border-white/5 flex flex-col sm:flex-row items-center justify-end gap-2">
                  <button
                    onClick={() => handleSaveAiCards()}
                    className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs uppercase tracking-wider shadow-lg active:scale-95 cursor-pointer"
                  >
                    ✓ Save as New Deck
                  </button>
                  {activeDeck && (
                    <button
                      onClick={() => handleSaveAiCards(activeDeck.id)}
                      className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-200 border border-white/10 text-xs font-bold"
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
    </div>
  );
};

export default StudyCenterFlashcards;
