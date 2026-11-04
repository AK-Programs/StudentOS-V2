import React, { useState, useEffect } from 'react';
import { 
  Sparkles, 
  X, 
  BookOpen, 
  Check, 
  RotateCw, 
  Save, 
  ArrowRight, 
  Columns, 
  FileText, 
  ShieldCheck, 
  AlertCircle,
  HelpCircle,
  Wand2
} from 'lucide-react';

interface LectureNotesAiModalProps {
  isOpen: boolean;
  mode: 'create' | 'edit';
  initialSubject?: string;
  noteTitle?: string;
  currentContent?: string;
  selectedText?: string;
  onClose: () => void;
  onSaveNewNote?: (title: string, subject: string, content: string) => Promise<void> | void;
  onApplyEdit?: (newContent: string) => Promise<void> | void;
  renderMarkdown: (text: string) => React.ReactNode;
}

const CREATE_SUGGESTION_CHIPS = [
  { label: 'Summary & Key Concepts', prompt: 'Generate a comprehensive lecture note summarizing the core concepts, principles, and key definitions in bold.' },
  { label: 'Formula Cheat Sheet & Equations', prompt: 'Create a formula cheat-sheet with clear LaTeX ($...$) notation, variable definitions, and step-by-step derivations.' },
  { label: 'Step-by-Step Problem Solving Guide', prompt: 'Produce a master problem-solving guide with concrete worked examples, dimensional analysis, and common pitfalls.' },
  { label: 'Active Recall Study Guide', prompt: 'Synthesize an active recall study guide with executive summary, concept tables, and 3 high-yield review questions.' },
  { label: 'Comparison Table & Taxonomy', prompt: 'Structure a detailed comparative note featuring clear Markdown tables comparing key mechanisms, properties, and trade-offs.' }
];

const EDIT_SUGGESTION_CHIPS = [
  { label: 'Simplify explanation & tone', prompt: 'Simplify the conceptual explanations to make them intuitive and easy to digest, while strictly keeping all equations and facts intact.' },
  { label: 'Add real-world examples & analogies', prompt: 'Add 2 vivid real-world analogies and concrete practical examples to illuminate the concepts.' },
  { label: 'Create Markdown comparison table', prompt: 'Condense the key categories or trade-offs into a well-structured, formatted Markdown comparison table.' },
  { label: 'Add LaTeX math formulas', prompt: 'Elevate mathematical derivations with clean LaTeX syntax ($...$ and $$...$$) and define all variables clearly.' },
  { label: 'Generate 3 active recall questions', prompt: 'Append 3 challenging active recall study questions with an expandable answer key at the bottom.' },
  { label: 'Proofread & fix grammar', prompt: 'Proofread for academic elegance and grammatical precision while strictly retaining all technical terms and formatting.' }
];

const SUBJECT_OPTIONS = [
  'Physics',
  'Chemistry',
  'Computer Science',
  'Mathematics',
  'Biology',
  'Geography',
  'History',
  'English',
  'Economics',
  'Syllabus General'
];

export const LectureNotesAiModal: React.FC<LectureNotesAiModalProps> = ({
  isOpen,
  mode,
  initialSubject = 'Computer Science',
  noteTitle = 'Lecture Note',
  currentContent = '',
  selectedText = '',
  onClose,
  onSaveNewNote,
  onApplyEdit,
  renderMarkdown
}) => {
  const [subject, setSubject] = useState(initialSubject);
  const [instruction, setInstruction] = useState('');
  const [topicPrompt, setTopicPrompt] = useState('');
  const [generatedContent, setGeneratedContent] = useState('');
  const [proposedTitle, setProposedTitle] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [previewTab, setPreviewTab] = useState<'preview' | 'side-by-side' | 'raw'>('preview');
  const [refineMode, setRefineMode] = useState(false);
  const [refineInstruction, setRefineInstruction] = useState('');

  // Determine editing scope: Selection vs Entire Note
  const isSelectionScope = Boolean(selectedText && selectedText.trim().length > 0);
  const targetTextForEdit = isSelectionScope ? selectedText.trim() : currentContent;

  useEffect(() => {
    if (isOpen) {
      setSubject(initialSubject || 'Computer Science');
      setInstruction('');
      setTopicPrompt('');
      setGeneratedContent('');
      setProposedTitle(mode === 'create' ? '' : noteTitle);
      setErrorMessage('');
      setIsLoading(false);
      setRefineMode(false);
      setRefineInstruction('');
    }
  }, [isOpen, mode, initialSubject, noteTitle]);

  if (!isOpen) return null;

  const handleGenerate = async (refinement?: string) => {
    setIsLoading(true);
    setErrorMessage('');

    try {
      let promptToUse = '';
      let actionToUse = 'generate_notes';
      let contentPayload = '';

      if (mode === 'create') {
        actionToUse = 'create_note';
        const mainPrompt = refinement 
          ? `${topicPrompt}\n\nRefinement Request: ${refinement}`
          : topicPrompt;
        promptToUse = mainPrompt;
      } else {
        actionToUse = 'edit_note';
        contentPayload = targetTextForEdit;
        const mainInstruction = refinement
          ? `${instruction}\n\nAdditional adjustment: ${refinement}`
          : instruction;
        promptToUse = mainInstruction;
      }

      const res = await fetch('/api/ai/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: actionToUse,
          topic: mode === 'create' ? promptToUse : noteTitle,
          subject,
          content: mode === 'create' ? '' : contentPayload,
          instruction: promptToUse
        })
      });

      const data = await res.json();

      if (!res.ok || !data.success || !data.text) {
        throw new Error(data.error || 'Failed to generate note content with AI.');
      }

      let cleanResult = data.text.trim();

      // If we were editing a partial selection, assemble the full note for final preview
      if (mode === 'edit' && isSelectionScope) {
        const fullAssembled = currentContent.replace(selectedText, cleanResult);
        setGeneratedContent(fullAssembled);
      } else {
        setGeneratedContent(cleanResult);
      }

      if (mode === 'create' && !proposedTitle) {
        // Derive clean title from prompt or first line
        const firstLineMatch = cleanResult.match(/^#\s+(.+)$/m);
        if (firstLineMatch) {
          setProposedTitle(firstLineMatch[1].replace(/[*#]/g, '').trim());
        } else {
          setProposedTitle(topicPrompt.slice(0, 45) || 'Generated Lecture Note');
        }
      }

      setRefineMode(false);
      setRefineInstruction('');
    } catch (err: any) {
      console.error('[LectureNotesAI] Generation error:', err);
      setErrorMessage(err.message || 'AI generation failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveOrApply = async () => {
    if (!generatedContent) return;

    if (mode === 'create') {
      if (onSaveNewNote) {
        await onSaveNewNote(
          proposedTitle.trim() || 'AI Lecture Note',
          subject,
          generatedContent
        );
      }
    } else {
      if (onApplyEdit) {
        await onApplyEdit(generatedContent);
      }
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div 
        className="w-full max-w-4xl max-h-[92vh] flex flex-col bg-slate-900 border border-indigo-500/30 rounded-3xl shadow-2xl overflow-hidden text-slate-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 bg-slate-950/60">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center text-white shadow-md">
              <Sparkles className="w-5 h-5 text-yellow-300" />
            </div>
            <div>
              <h3 className="text-base font-black font-display text-white tracking-tight flex items-center gap-2">
                <span>{mode === 'create' ? 'Create Note with AI' : 'Edit Note with AI'}</span>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                  {mode === 'create' ? 'Synthesizer' : 'Rich Transformer'}
                </span>
              </h3>
              <p className="text-[11px] text-slate-400">
                {mode === 'create'
                  ? 'Synthesize comprehensive academic lecture notes with tables, math, and active recall'
                  : isSelectionScope
                    ? `Transforming selected text block (${selectedText.length} characters)`
                    : `Refining entire note: "${noteTitle}"`}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
            title="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5">
          {/* Error Banner */}
          {errorMessage && (
            <div className="p-3.5 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
              <div className="flex-1">
                <span className="font-bold">Generation Notice: </span>
                {errorMessage}
              </div>
            </div>
          )}

          {/* Form Step: If no content generated yet OR user clicked refine */}
          {!generatedContent ? (
            <div className="space-y-4">
              {/* Context / Scope Indicator for Edit Mode */}
              {mode === 'edit' && (
                <div className="p-3 rounded-2xl bg-indigo-950/40 border border-indigo-500/25 flex items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-indigo-400 shrink-0" />
                    <div>
                      <span className="font-bold text-white">Target Scope: </span>
                      <span className="text-indigo-300">
                        {isSelectionScope ? 'Selected Text Passage' : 'Entire Active Note'}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Rich Content Guard Active</span>
                  </div>
                </div>
              )}

              {/* Subject Selector (Create Mode) */}
              {mode === 'create' && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-center">
                  <div className="sm:col-span-1">
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                      Academic Subject
                    </label>
                    <select
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      className="w-full text-xs px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer font-bold"
                    >
                      {SUBJECT_OPTIONS.map((sub) => (
                        <option key={sub} value={sub}>{sub}</option>
                      ))}
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                      Note Title (Optional)
                    </label>
                    <input
                      type="text"
                      value={proposedTitle}
                      onChange={(e) => setProposedTitle(e.target.value)}
                      placeholder="e.g. Quantum Wavefunction & Schrödinger Equation"
                      className="w-full text-xs px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 font-bold"
                    />
                  </div>
                </div>
              )}

              {/* Dedicated Instruction Prompt Field */}
              <div>
                <label className="block text-xs font-black font-display uppercase tracking-wider text-white mb-1.5 flex items-center justify-between">
                  <span>{mode === 'create' ? 'What would you like to create?' : 'What would you like to edit, clarify, or transform?'}</span>
                  <span className="text-[10px] font-sans font-normal text-slate-400">Natural language instructions</span>
                </label>
                <textarea
                  rows={4}
                  value={mode === 'create' ? topicPrompt : instruction}
                  onChange={(e) => mode === 'create' ? setTopicPrompt(e.target.value) : setInstruction(e.target.value)}
                  placeholder={
                    mode === 'create'
                      ? 'e.g. Generate master lecture notes on Newton\'s Laws of Motion. Include derivations for F=ma, free body diagrams explanation, markdown comparison tables of friction types, and 3 exam review questions.'
                      : 'e.g. Make this section clearer for exam revision. Format the key formulas into LaTeX and add a Markdown comparison table contrasting aerobic vs anaerobic respiration.'
                  }
                  className="w-full p-3.5 rounded-2xl bg-slate-950/80 border border-white/10 focus:border-indigo-500 text-xs text-white leading-relaxed focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none font-sans"
                />
              </div>

              {/* Quick Suggestion Chips */}
              <div className="space-y-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Quick Prompts:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {(mode === 'create' ? CREATE_SUGGESTION_CHIPS : EDIT_SUGGESTION_CHIPS).map((chip, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        if (mode === 'create') {
                          setTopicPrompt(prev => prev ? `${prev} ${chip.prompt}` : chip.prompt);
                        } else {
                          setInstruction(prev => prev ? `${prev} ${chip.prompt}` : chip.prompt);
                        }
                      }}
                      className="px-2.5 py-1 rounded-xl bg-slate-800/80 hover:bg-indigo-600/20 text-slate-300 hover:text-indigo-200 border border-white/5 hover:border-indigo-500/30 text-[10px] font-bold transition-all active:scale-95 cursor-pointer text-left"
                    >
                      + {chip.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Safe Content Guarantee Note */}
              <div className="p-3 rounded-2xl bg-slate-950/40 border border-white/5 text-[11px] text-slate-400 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>
                  {mode === 'create'
                    ? 'Outputs rich academic Markdown with headings, tables, mathematical equations, and active recall questions.'
                    : 'All valid existing tables, formulas, equations, headings, and formatting will be strictly preserved.'}
                </span>
              </div>
            </div>
          ) : (
            /* Review & Preview Step */
            <div className="space-y-4">
              {/* Header inside Review */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-2xl bg-slate-950/70 border border-white/5">
                <div className="flex-1">
                  {mode === 'create' ? (
                    <div>
                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">Note Title</label>
                      <input
                        type="text"
                        value={proposedTitle}
                        onChange={(e) => setProposedTitle(e.target.value)}
                        className="text-sm font-black text-white bg-transparent border-b border-indigo-500/40 focus:outline-none w-full"
                      />
                    </div>
                  ) : (
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Proposed Note Preview</span>
                      <h4 className="text-sm font-black text-white">{noteTitle}</h4>
                    </div>
                  )}
                </div>

                {/* Preview View Mode Switcher */}
                <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-white/5 self-start sm:self-center">
                  <button
                    onClick={() => setPreviewTab('preview')}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all ${
                      previewTab === 'preview' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Formatted Preview
                  </button>
                  {mode === 'edit' && (
                    <button
                      onClick={() => setPreviewTab('side-by-side')}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all ${
                        previewTab === 'side-by-side' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Side-by-Side
                    </button>
                  )}
                  <button
                    onClick={() => setPreviewTab('raw')}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all ${
                      previewTab === 'raw' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Raw Markdown
                  </button>
                </div>
              </div>

              {/* Preview Content Area */}
              <div className="p-4 sm:p-6 rounded-2xl bg-slate-950/90 border border-white/10 max-h-[50vh] overflow-y-auto leading-relaxed select-text">
                {previewTab === 'preview' && (
                  <div className="space-y-3 text-xs text-slate-200">
                    {renderMarkdown(generatedContent)}
                  </div>
                )}

                {previewTab === 'side-by-side' && mode === 'edit' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                    <div className="p-3 rounded-xl bg-slate-900/60 border border-white/5 space-y-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block border-b border-white/5 pb-1">
                        Original Note
                      </span>
                      <div className="space-y-2 opacity-75">
                        {renderMarkdown(currentContent)}
                      </div>
                    </div>
                    <div className="p-3 rounded-xl bg-indigo-950/20 border border-indigo-500/20 space-y-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400 block border-b border-indigo-500/20 pb-1">
                        Proposed AI Update
                      </span>
                      <div className="space-y-2 text-slate-100">
                        {renderMarkdown(generatedContent)}
                      </div>
                    </div>
                  </div>
                )}

                {previewTab === 'raw' && (
                  <pre className="font-mono text-xs text-indigo-200 whitespace-pre-wrap select-all">
                    {generatedContent}
                  </pre>
                )}
              </div>

              {/* Inline Refinement Drawer */}
              {refineMode && (
                <div className="p-3.5 rounded-2xl bg-indigo-950/30 border border-indigo-500/30 space-y-2 animate-fadeIn">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-indigo-300 flex items-center gap-1.5">
                      <Wand2 className="w-3.5 h-3.5" />
                      <span>Refine with Additional Instructions</span>
                    </span>
                    <button
                      onClick={() => setRefineMode(false)}
                      className="text-slate-400 hover:text-white"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <input
                    type="text"
                    value={refineInstruction}
                    onChange={(e) => setRefineInstruction(e.target.value)}
                    placeholder="e.g. Add 2 more worked examples with numerical steps..."
                    className="w-full text-xs px-3 py-2 rounded-xl bg-slate-900 border border-white/10 text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && refineInstruction.trim()) {
                        handleGenerate(refineInstruction.trim());
                      }
                    }}
                  />
                  <div className="flex justify-end">
                    <button
                      type="button"
                      disabled={!refineInstruction.trim() || isLoading}
                      onClick={() => handleGenerate(refineInstruction.trim())}
                      className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all disabled:opacity-50 cursor-pointer"
                    >
                      Apply Refinement
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer Controls */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-t border-white/10 bg-slate-950/80">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-all cursor-pointer"
          >
            Discard & Close
          </button>

          <div className="flex flex-wrap items-center gap-2">
            {!generatedContent ? (
              <button
                type="button"
                disabled={isLoading || (mode === 'create' ? !topicPrompt.trim() : !instruction.trim())}
                onClick={() => handleGenerate()}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold transition-all shadow-lg active:scale-95 disabled:opacity-50 flex items-center gap-2 cursor-pointer"
              >
                {isLoading ? (
                  <>
                    <RotateCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Synthesizing Note...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5 text-yellow-300" />
                    <span>{mode === 'create' ? 'Generate Complete Note' : 'Transform Note with AI'}</span>
                  </>
                )}
              </button>
            ) : (
              <>
                <button
                  type="button"
                  disabled={isLoading}
                  onClick={() => setRefineMode(!refineMode)}
                  className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-indigo-300 border border-indigo-500/20 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <Wand2 className="w-3.5 h-3.5" />
                  <span>Refine</span>
                </button>

                <button
                  type="button"
                  disabled={isLoading}
                  onClick={() => handleGenerate()}
                  className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <RotateCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                  <span>Regenerate</span>
                </button>

                <button
                  type="button"
                  disabled={isLoading}
                  onClick={handleSaveOrApply}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-md active:scale-95 flex items-center gap-2 cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>{mode === 'create' ? 'Save to Notes Vault' : 'Apply to Note'}</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
