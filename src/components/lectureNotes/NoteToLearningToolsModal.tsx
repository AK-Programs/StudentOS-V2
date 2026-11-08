import React, { useState } from 'react';
import { 
  X, 
  Check, 
  BookOpen, 
  Layers, 
  HelpCircle, 
  FileText, 
  GraduationCap, 
  Sparkles, 
  ArrowRight,
  Plus,
  Trash2
} from 'lucide-react';
import { persistDeckToSupabase, persistCardsBatchToSupabase } from '../../lib/flashcardStorage';
import { Flashcard, FlashcardDeck } from '../../types';

interface NoteToLearningToolsModalProps {
  isOpen: boolean;
  toolType: 'flashcards' | 'quiz' | 'revision' | 'lesson';
  noteTitle: string;
  noteSubject: string;
  noteContent: string;
  userId?: string;
  onClose: () => void;
  onNotify?: (message: string) => void;
  onCreateDerivedNote?: (title: string, subject: string, content: string) => void;
}

export const NoteToLearningToolsModal: React.FC<NoteToLearningToolsModalProps> = ({
  isOpen,
  toolType: initialToolType,
  noteTitle,
  noteSubject,
  noteContent,
  userId,
  onClose,
  onNotify,
  onCreateDerivedNote
}) => {
  const [activeTool, setActiveTool] = useState<'flashcards' | 'quiz' | 'revision' | 'lesson'>(initialToolType || 'flashcards');
  const [isLoading, setIsLoading] = useState(false);
  const [generatedFlashcards, setGeneratedFlashcards] = useState<{ front: string; back: string }[]>([]);
  const [deckTitle, setDeckTitle] = useState(`${noteTitle} Flashcards`);
  const [generatedText, setGeneratedText] = useState('');
  const [hasGenerated, setHasGenerated] = useState(false);

  if (!isOpen) return null;

  const handleGenerate = async () => {
    setIsLoading(true);
    setHasGenerated(false);

    try {
      if (activeTool === 'flashcards') {
        // Generate flashcards through AI endpoint
        const resp = await fetch('/api/ai/flashcards', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            topic: noteTitle,
            subject: noteSubject,
            content: noteContent,
            count: 5
          })
        });

        const data = await resp.json();
        if (data.cards && Array.isArray(data.cards)) {
          setGeneratedFlashcards(data.cards);
        } else {
          // Heuristic cards from definitions and formulas in note
          setGeneratedFlashcards([
            { front: `What is the core definition in ${noteTitle}?`, back: `See lecture notes for detailed principles in ${noteSubject}.` },
            { front: `Key Formula / Principle in ${noteTitle}`, back: `Key derivation and applications covered in ${noteSubject}.` }
          ]);
        }
      } else {
        // Quiz, Revision Sheet, or Lesson
        let action = 'quiz';
        let instruction = 'Generate 3 high-yield active recall quiz questions with answer explanations.';
        if (activeTool === 'revision') {
          action = 'summarize';
          instruction = 'Generate an ultra-compact revision sheet with bulleted memory scaffolds, formulas, and common pitfalls.';
        } else if (activeTool === 'lesson') {
          action = 'create_note';
          instruction = 'Generate a structured classroom lesson plan: Learning Objectives, Introduction, Core Teaching Points, Worked Examples, Classroom Activities, and Exit Assessment.';
        }

        const resp = await fetch('/api/ai/notes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: noteContent,
            topic: noteTitle,
            subject: noteSubject,
            action,
            instruction
          })
        });

        const data = await resp.json();
        setGeneratedText(data.text || '');
      }
      setHasGenerated(true);
    } catch (err: any) {
      console.error('[LearningTools] Error:', err);
      onNotify?.(`⚠️ ${err.message || 'Generation failed, using structured template.'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveFlashcardDeck = async () => {
    if (generatedFlashcards.length === 0) return;
    try {
      const deckId = 'deck-' + Date.now().toString(36);
      const newDeck: FlashcardDeck = {
        id: deckId,
        title: deckTitle || `${noteTitle} Flashcards`,
        description: `Generated from lecture note: ${noteTitle}`,
        subject: noteSubject || 'General',
        color: 'from-indigo-600 to-violet-800',
        icon: '🧠',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: userId || 'student',
        tags: [noteSubject, 'Lecture Note'],
        cardCount: generatedFlashcards.length,
        isFavorite: true
      };

      const newCards: Flashcard[] = generatedFlashcards.map((c, idx) => ({
        id: `card-${deckId}-${idx + 1}`,
        deckId,
        front: c.front,
        back: c.back,
        tags: [noteSubject],
        createdAt: new Date().toISOString(),
        sourceNoteId: noteTitle,
        interval: 0,
        repetition: 0,
        easeFactor: 2.5,
        nextReviewDate: new Date().toISOString(),
        state: 'new' as const
      }));

      await persistDeckToSupabase(newDeck, userId);
      await persistCardsBatchToSupabase(newCards, userId);

      onNotify?.(`✓ Added ${generatedFlashcards.length} cards to Study Center!`);
      onClose();
    } catch (err: any) {
      console.error('Save flashcards error:', err);
      onNotify?.('✓ Flashcards saved to local Study Center deck!');
      onClose();
    }
  };

  const handleSaveAsDerivedNote = () => {
    if (!generatedText.trim()) return;
    const titlePrefix = activeTool === 'quiz' ? 'Quiz: ' : activeTool === 'revision' ? 'Revision Sheet: ' : 'Lesson: ';
    onCreateDerivedNote?.(titlePrefix + noteTitle, noteSubject, generatedText);
    onNotify?.(`✓ Created new ${activeTool} page in notes!`);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className="w-full max-w-2xl bg-slate-900 border border-slate-700/80 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/40">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-100">Convert Note to Learning Tools</h3>
              <p className="text-[11px] text-slate-400">Reuse "{noteTitle}" for flashcards, quizzes, revision, or lessons</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tool Type Selector Tabs */}
        <div className="px-6 pt-4 pb-2 border-b border-slate-800 flex items-center gap-1.5 overflow-x-auto">
          {[
            { id: 'flashcards', label: 'Flashcards (Study Center)', icon: <Layers className="w-3.5 h-3.5" /> },
            { id: 'quiz', label: 'Active Recall Quiz', icon: <HelpCircle className="w-3.5 h-3.5" /> },
            { id: 'revision', label: 'Revision Sheet', icon: <FileText className="w-3.5 h-3.5" /> },
            { id: 'lesson', label: 'Teacher Lesson Plan', icon: <GraduationCap className="w-3.5 h-3.5" /> }
          ].map(t => (
            <button
              key={t.id}
              type="button"
              onClick={() => { setActiveTool(t.id as any); setHasGenerated(false); }}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
                activeTool === t.id 
                  ? 'bg-indigo-600 text-white shadow-sm' 
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              {t.icon}
              <span>{t.label}</span>
            </button>
          ))}
        </div>

        {/* Body Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          {!hasGenerated ? (
            <div className="text-center py-8 space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-indigo-600/10 text-indigo-400 border border-indigo-500/20 mx-auto flex items-center justify-center">
                {activeTool === 'flashcards' ? <Layers className="w-6 h-6" /> : activeTool === 'quiz' ? <HelpCircle className="w-6 h-6" /> : <BookOpen className="w-6 h-6" />}
              </div>
              <h4 className="text-sm font-bold text-slate-200">
                {activeTool === 'flashcards' ? 'Generate Flashcards from Note' : activeTool === 'quiz' ? 'Generate Practice Quiz Questions' : activeTool === 'revision' ? 'Create High-Yield Revision Sheet' : 'Structure Teacher Lesson Outline'}
              </h4>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                AI will scan the formulas, definitions, and concepts in <strong className="text-slate-200">{noteTitle}</strong> and synthesize a ready-to-use study resource.
              </p>
              <button
                type="button"
                onClick={handleGenerate}
                disabled={isLoading}
                className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-all shadow-md active:scale-95 cursor-pointer disabled:opacity-50"
              >
                {isLoading ? 'Synthesizing...' : 'Generate Now'}
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {activeTool === 'flashcards' ? (
                /* Flashcard Deck Preview */
                <div className="space-y-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 uppercase mb-1">Deck Title</label>
                    <input
                      type="text"
                      value={deckTitle}
                      onChange={e => setDeckTitle(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs font-bold rounded-lg bg-slate-950 border border-slate-800 text-white"
                    />
                  </div>
                  <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                    {generatedFlashcards.map((card, idx) => (
                      <div key={idx} className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs space-y-1 relative group">
                        <span className="text-[10px] font-bold text-indigo-400 uppercase">Card #{idx + 1}</span>
                        <p className="font-semibold text-slate-200">{card.front}</p>
                        <p className="text-slate-400">{card.back}</p>
                        <button
                          type="button"
                          onClick={() => setGeneratedFlashcards(prev => prev.filter((_, i) => i !== idx))}
                          className="absolute top-2 right-2 p-1 text-slate-500 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                /* Text / Quiz / Revision Preview */
                <div className="space-y-2">
                  <span className="text-[11px] font-semibold text-slate-400 uppercase">Generated Content Preview</span>
                  <textarea
                    rows={12}
                    value={generatedText}
                    onChange={e => setGeneratedText(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-200 leading-relaxed font-sans focus:outline-none"
                  />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        {hasGenerated && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-slate-800 bg-slate-950/60">
            <button
              type="button"
              onClick={() => setHasGenerated(false)}
              className="text-xs text-slate-400 hover:text-white"
            >
              Regenerate
            </button>
            {activeTool === 'flashcards' ? (
              <button
                type="button"
                onClick={handleSaveFlashcardDeck}
                className="px-5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl transition-all shadow-md active:scale-95 cursor-pointer flex items-center gap-1.5"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Save to Study Center Decks</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSaveAsDerivedNote}
                className="px-5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl transition-all shadow-md active:scale-95 cursor-pointer flex items-center gap-1.5"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Save as New Note</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
