import React, { useState, useEffect, useRef } from 'react';
import { 
  Bold, 
  Italic, 
  Highlighter, 
  List, 
  ListOrdered, 
  CheckSquare, 
  Heading1, 
  Heading2, 
  Heading3, 
  Calculator, 
  Table as TableIcon, 
  Lightbulb, 
  BookOpen, 
  GraduationCap, 
  AlertTriangle, 
  HelpCircle, 
  Code2, 
  Quote, 
  Plus, 
  Trash2, 
  Copy, 
  ArrowUp, 
  ArrowDown, 
  PenTool,
  Search,
  Sparkles,
  Link2,
  X,
  ChevronRight,
  MousePointer2,
  Settings,
  MoreVertical,
  Wand2,
  Type
} from 'lucide-react';
import { 
  EducationalBlock, 
  HeadingBlock, 
  ParagraphBlock, 
  ListBlock, 
  TableBlock, 
  FormulaBlock 
} from '../../lib/lectureNotes/types';
import { markdownToBlocks, blocksToMarkdown } from '../../lib/lectureNotes/documentBridge';
import { EducationalBlockRenderer } from './blocks/EducationalBlockRenderer';
import { VisualMathEditorModal } from './VisualMathEditorModal';
import { VisualTableEditor } from './VisualTableEditor';
import { SketchCanvasModal } from './SketchCanvasModal';
import { VaultNote } from '../../types';

interface LectureNotesEditorProps {
  noteId?: string;
  initialContent: string;
  noteTitle: string;
  noteSubject: string;
  allNotes?: VaultNote[];
  onChange: (markdownContent: string) => void;
  onOpenLearningTools?: (tool: 'flashcards' | 'quiz' | 'revision' | 'lesson') => void;
  onOpenHomeworkLinking?: () => void;
  onNavigateToNote?: (noteId: string) => void;
  readOnly?: boolean;
}

export const LectureNotesEditor: React.FC<LectureNotesEditorProps> = ({
  noteId,
  initialContent,
  noteTitle,
  noteSubject,
  allNotes = [],
  onChange,
  onOpenLearningTools,
  onOpenHomeworkLinking,
  onNavigateToNote,
  readOnly = false
}) => {
  const [blocks, setBlocks] = useState<EducationalBlock[]>(() => markdownToBlocks(initialContent));
  const [activeBlockId, setActiveBlockId] = useState<string | null>(null);
  
  // Track last serialized Markdown to prevent reparsing local edits
  const lastSerializedMdRef = useRef<string>('');
  const prevNoteIdRef = useRef<string | undefined>(noteId);
  
  // Modals state
  const [isMathModalOpen, setIsMathModalOpen] = useState(false);
  const [mathModalData, setMathModalData] = useState<{ latex: string; name?: string; targetBlockId?: string }>({ latex: 'E = mc^2' });
  const [isSketchModalOpen, setIsSketchModalOpen] = useState(false);

  // Compact Inline Slash Menu State
  const [slashMenuOpen, setSlashMenuOpen] = useState(false);
  const [slashQuery, setSlashQuery] = useState('');
  const [slashBlockId, setSlashBlockId] = useState<string | null>(null);
  const [slashSelectedIndex, setSlashSelectedIndex] = useState(0);
  const [slashMenuPosition, setSlashMenuPosition] = useState<{ top: number; left: number; flip: boolean }>({ top: 0, left: 0, flip: false });

  // Selection & Multi-block State
  const [selectedBlockIds, setSelectedBlockIds] = useState<string[]>([]);
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);
  const editorRef = useRef<HTMLDivElement>(null);
  const [isAIProcessing, setIsAIProcessing] = useState(false);

  // Refs for focusing inputs
  const blockInputRefs = useRef<{ [key: string]: HTMLElement | null }>({});

  // Synchronize internal blocks when note ID changes OR external update occurs
  useEffect(() => {
    const isNoteChanged = noteId !== prevNoteIdRef.current;
    prevNoteIdRef.current = noteId;

    if (isNoteChanged || (initialContent !== lastSerializedMdRef.current && initialContent.trim() !== '')) {
      const parsed = markdownToBlocks(initialContent);
      setBlocks(parsed);
      lastSerializedMdRef.current = initialContent;
      // Reset selection on note change
      if (isNoteChanged) {
        setSelectedBlockIds([]);
        setIsMultiSelectMode(false);
      }
    }
  }, [noteId, initialContent]);

  // Global Keyboard Shortcuts (Ctrl+A, Delete)
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if user is typing in a modal or something else specific
      if (isMathModalOpen || isSketchModalOpen || slashMenuOpen) return;

      // Ctrl+A / Cmd+A
      if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
        const activeElement = document.activeElement;
        const isInput = activeElement?.tagName === 'INPUT' || activeElement?.tagName === 'TEXTAREA';
        
        // Only trigger document-wide select if we are in the editor area or nothing is focused
        if (!isInput || (activeElement && editorRef.current?.contains(activeElement))) {
          e.preventDefault();
          setSelectedBlockIds(blocks.map(b => b.id));
          setIsMultiSelectMode(true);
          // Blur current input to show selection clearly
          if (activeElement instanceof HTMLElement) activeElement.blur();
        }
      }

      // Delete / Backspace for multi-selection
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedBlockIds.length > 0 && !document.activeElement?.tagName.match(/INPUT|TEXTAREA/)) {
        e.preventDefault();
        handleDeleteSelectedBlocks();
      }

      // Escape to clear selection
      if (e.key === 'Escape' && selectedBlockIds.length > 0) {
        setSelectedBlockIds([]);
        setIsMultiSelectMode(false);
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [blocks, selectedBlockIds, isMathModalOpen, isSketchModalOpen, slashMenuOpen]);

  const handleDeleteSelectedBlocks = () => {
    if (selectedBlockIds.length === 0) return;
    
    // If all blocks selected, reset to one empty paragraph
    if (selectedBlockIds.length === blocks.length) {
      const resetId = 'blk_' + Date.now();
      updateBlocks([{ id: resetId, type: 'paragraph', text: '' }], resetId);
    } else {
      const next = blocks.filter(b => !selectedBlockIds.includes(b.id));
      if (next.length === 0) {
        const resetId = 'blk_' + Date.now();
        updateBlocks([{ id: resetId, type: 'paragraph', text: '' }], resetId);
      } else {
        updateBlocks(next);
      }
    }
    setSelectedBlockIds([]);
    setIsMultiSelectMode(false);
  };

  // Propagate changes to parent in clean serialized Markdown
  const updateBlocks = (newBlocks: EducationalBlock[], shouldFocusId?: string) => {
    setBlocks(newBlocks);
    const md = blocksToMarkdown(newBlocks);
    lastSerializedMdRef.current = md;
    onChange(md);

    if (shouldFocusId) {
      setActiveBlockId(shouldFocusId);
      setTimeout(() => {
        const el = blockInputRefs.current[shouldFocusId];
        if (el) {
          el.focus();
          el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      }, 50);
    }
  };

  const handleBlockChange = (idx: number, updated: EducationalBlock) => {
    const next = [...blocks];
    next[idx] = updated;
    updateBlocks(next);
  };

  const handleAddBlockBelow = (targetIdx?: number, type: EducationalBlock['type'] = 'paragraph') => {
    const activeIdx = targetIdx !== undefined 
      ? targetIdx 
      : activeBlockId 
      ? blocks.findIndex(b => b.id === activeBlockId)
      : blocks.length - 1;

    const insertIdx = activeIdx >= 0 ? activeIdx : blocks.length - 1;
    const id = 'blk_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
    let newBlock: EducationalBlock;

    switch (type) {
      case 'heading':
        newBlock = { id, type: 'heading', level: 2, text: '' };
        break;
      case 'concept':
        newBlock = { id, type: 'concept', title: 'New Concept', explanation: '', keyTakeaway: '' };
        break;
      case 'formula':
        newBlock = { id, type: 'formula', name: 'Formula', latex: 'F_c = \\frac{m v^2}{r}', variables: [] };
        break;
      case 'worked_example':
        newBlock = { id, type: 'worked_example', problem: '', steps: [''], finalAnswer: '' };
        break;
      case 'definition':
        newBlock = { id, type: 'definition', term: '', definition: '' };
        break;
      case 'callout':
        newBlock = { id, type: 'callout', variant: 'info', title: 'Important Note', text: '' };
        break;
      case 'recall_question':
        newBlock = { id, type: 'recall_question', question: '', answer: '', isRevealed: false };
        break;
      case 'table':
        newBlock = { id, type: 'table', headers: ['Variable', 'Description', 'Value'], rows: [['', '', '']] };
        break;
      case 'list':
        newBlock = { id, type: 'list', listType: 'bullet', items: [{ id: 'it_' + Date.now() + '_1', text: '' }] };
        break;
      default:
        newBlock = { id, type: 'paragraph', text: '' };
        break;
    }

    const next = [...blocks];
    next.splice(insertIdx + 1, 0, newBlock);
    updateBlocks(next, id);
  };

  const handleDeleteBlock = (idx: number) => {
    if (blocks.length <= 1) {
      const resetId = 'blk_' + Date.now();
      updateBlocks([{ id: resetId, type: 'paragraph', text: '' }], resetId);
      return;
    }
    const next = blocks.filter((_, i) => i !== idx);
    const prevId = next[Math.max(0, idx - 1)]?.id;
    updateBlocks(next, prevId);
  };

  const handleMoveBlock = (idx: number, direction: 'up' | 'down') => {
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= blocks.length) return;
    const next = [...blocks];
    const temp = next[idx];
    next[idx] = next[targetIdx];
    next[targetIdx] = temp;
    updateBlocks(next, temp.id);
  };

  const handleDuplicateBlock = (idx: number) => {
    const clone = JSON.parse(JSON.stringify(blocks[idx]));
    clone.id = 'blk_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
    const next = [...blocks];
    next.splice(idx + 1, 0, clone);
    updateBlocks(next, clone.id);
  };

  // Slash commands options
  const slashOptions = [
    { label: 'Paragraph', desc: 'Normal body text', type: 'paragraph', icon: '¶' },
    { label: 'Heading 1', desc: 'Main chapter heading', type: 'h1', icon: 'H1' },
    { label: 'Heading 2', desc: 'Section heading', type: 'h2', icon: 'H2' },
    { label: 'Heading 3', desc: 'Sub-section heading', type: 'h3', icon: 'H3' },
    { label: 'Bullet List', desc: 'Bulleted list points', type: 'bullet', icon: '•' },
    { label: 'Numbered List', desc: 'Step-by-step numbers', type: 'number', icon: '1.' },
    { label: 'Checklist', desc: 'Interactive task checklist', type: 'checklist', icon: '☑' },
    { label: 'Math Formula', desc: 'Vector LaTeX equation', type: 'formula', icon: '∑' },
    { label: 'Table', desc: 'Visual editable table grid', type: 'table', icon: '▦' },
    { label: 'Concept Block', desc: 'Core principle & takeaway card', type: 'concept', icon: '💡' },
    { label: 'Worked Example', desc: 'Step-by-step problem solver', type: 'worked_example', icon: '🎓' },
    { label: 'Definition Block', desc: 'Academic definition with context', type: 'definition', icon: '📖' },
    { label: 'Recall Question', desc: 'Self-testing with hidden answer', type: 'recall_question', icon: '❓' },
    { label: 'Warning / Exam Tip', desc: 'Important exam note or common mistake', type: 'callout', icon: '⚠️' },
    { label: 'Sketch / Diagram', desc: 'Handwritten diagram canvas', type: 'sketch', icon: '✏️' }
  ];

  const filteredSlashOptions = slashOptions.filter(o => 
    !slashQuery || o.label.toLowerCase().includes(slashQuery.toLowerCase()) || o.desc.toLowerCase().includes(slashQuery.toLowerCase())
  );

  const handleSelectSlash = (opt: typeof slashOptions[0]) => {
    setSlashMenuOpen(false);
    setSlashQuery('');
    
    // Clean slash text from active block
    const currentIdx = blocks.findIndex(b => b.id === slashBlockId);
    if (currentIdx >= 0 && blocks[currentIdx].type === 'paragraph') {
      const p = blocks[currentIdx] as ParagraphBlock;
      const cleanText = p.text.replace(/\/[\w]*$/, '').trim();
      handleBlockChange(currentIdx, { ...p, text: cleanText });
    }

    const insertIdx = currentIdx >= 0 ? currentIdx : blocks.length - 1;

    if (opt.type === 'h1' || opt.type === 'h2' || opt.type === 'h3') {
      const level = opt.type === 'h1' ? 1 : opt.type === 'h2' ? 2 : 3;
      const hId = slashBlockId || 'blk_h_' + Date.now();
      handleBlockChange(insertIdx, {
        id: hId,
        type: 'heading',
        level: level as 1 | 2 | 3,
        text: ''
      });
      setActiveBlockId(hId);
    } else if (opt.type === 'bullet' || opt.type === 'number' || opt.type === 'checklist') {
      const listId = 'blk_list_' + Date.now();
      handleBlockChange(insertIdx, {
        id: listId,
        type: 'list',
        listType: opt.type as any,
        items: [{ id: 'it_' + Date.now() + '_1', text: '', checked: false }]
      });
      setActiveBlockId(listId);
    } else if (opt.type === 'formula') {
      setMathModalData({ latex: 'F_c = \\frac{m v^2}{r}', name: 'Formula', targetBlockId: slashBlockId || undefined });
      setIsMathModalOpen(true);
    } else if (opt.type === 'sketch') {
      setIsSketchModalOpen(true);
    } else {
      handleAddBlockBelow(insertIdx, opt.type as any);
    }
  };

  const handleEditWithAI = async (instruction?: string) => {
    if (selectedBlockIds.length === 0 && !activeBlockId) return;
    
    setIsAIProcessing(true);
    const targetIds = selectedBlockIds.length > 0 ? selectedBlockIds : [activeBlockId!];
    const selectedBlocks = blocks.filter(b => targetIds.includes(b.id));
    const contentToEdit = blocksToMarkdown(selectedBlocks);

    try {
      const res = await fetch('/api/ai/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'edit_note',
          content: contentToEdit,
          instruction: instruction || 'Refine and improve this section.',
          subject: noteSubject
        })
      });

      if (!res.ok) throw new Error('AI Edit failed');
      const data = await res.json();
      
      if (data.success && data.content) {
        const newBlocks = markdownToBlocks(data.content);
        const startIdx = blocks.findIndex(b => b.id === targetIds[0]);
        const next = [...blocks];
        // Replace selected blocks with new AI-generated blocks
        next.splice(startIdx, targetIds.length, ...newBlocks);
        updateBlocks(next);
        setSelectedBlockIds([]);
        setIsMultiSelectMode(false);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsAIProcessing(false);
    }
  };

  const toggleBlockSelection = (id: string, e: React.MouseEvent) => {
    if (e.shiftKey) {
      // Range selection
      const lastSelected = selectedBlockIds[selectedBlockIds.length - 1];
      if (!lastSelected) {
        setSelectedBlockIds([id]);
      } else {
        const startIdx = blocks.findIndex(b => b.id === lastSelected);
        const endIdx = blocks.findIndex(b => b.id === id);
        const range = blocks.slice(Math.min(startIdx, endIdx), Math.max(startIdx, endIdx) + 1).map(b => b.id);
        setSelectedBlockIds(Array.from(new Set([...selectedBlockIds, ...range])));
      }
      setIsMultiSelectMode(true);
    } else if (e.ctrlKey || e.metaKey) {
      // Toggle selection
      setSelectedBlockIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
      setIsMultiSelectMode(true);
    } else {
      // Single click selection handled by activeBlockId if not in multi-select mode
      if (isMultiSelectMode) {
        setSelectedBlockIds([id]);
      }
    }
  };

  // Click empty document surface to focus or create paragraph
  const handleDocumentSurfaceClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      setSelectedBlockIds([]);
      setIsMultiSelectMode(false);
      if (blocks.length > 0) {
        const lastBlock = blocks[blocks.length - 1];
        if (lastBlock.type === 'paragraph' && !(lastBlock as ParagraphBlock).text.trim()) {
          setActiveBlockId(lastBlock.id);
          blockInputRefs.current[lastBlock.id]?.focus();
        } else {
          handleAddBlockBelow(blocks.length - 1, 'paragraph');
        }
      } else {
        handleAddBlockBelow(0, 'paragraph');
      }
    }
  };

  return (
    <div className="relative space-y-4" ref={editorRef}>
      {/* Selection Toolbar (Floating) */}
      {selectedBlockIds.length > 0 && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 p-2 rounded-2xl bg-slate-900 border border-indigo-500/50 shadow-2xl animate-in slide-in-from-bottom-4 duration-200">
          <div className="px-3 border-r border-slate-700 text-xs font-bold text-indigo-400">
            {selectedBlockIds.length} Selected
          </div>
          <button
            onClick={() => handleEditWithAI()}
            disabled={isAIProcessing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all disabled:opacity-50"
          >
            {isAIProcessing ? <Sparkles className="w-3.5 h-3.5 animate-pulse" /> : <Wand2 className="w-3.5 h-3.5" />}
            <span>Edit with AI</span>
          </button>
          <button
            onClick={() => {
              const selected = blocks.filter(b => selectedBlockIds.includes(b.id));
              const md = blocksToMarkdown(selected);
              navigator.clipboard.writeText(md);
            }}
            className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white"
            title="Copy Selection"
          >
            <Copy className="w-4 h-4" />
          </button>
          <button
            onClick={handleDeleteSelectedBlocks}
            className="p-1.5 rounded-xl bg-slate-800 hover:bg-rose-900/40 text-slate-400 hover:text-rose-400"
            title="Delete Selection"
          >
            <Trash2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => {
              setSelectedBlockIds([]);
              setIsMultiSelectMode(false);
            }}
            className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Top Floating Formatting Toolbar */}
      {!readOnly && (
        <div className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-2 p-2 rounded-2xl bg-slate-900/90 border border-slate-700/80 backdrop-blur-md shadow-lg">
          <div className="flex flex-wrap items-center gap-1">
            <button
              type="button"
              onClick={() => handleAddBlockBelow(undefined, 'heading')}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer text-xs font-bold"
              title="Add Heading"
            >
              <Heading2 className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => handleAddBlockBelow(undefined, 'paragraph')}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer text-xs"
              title="Add Paragraph"
            >
              ¶
            </button>
            <div className="w-px h-4 bg-slate-700 mx-0.5" />
            <button
              type="button"
              onClick={() => {
                setMathModalData({ latex: 'F_c = \\frac{m v^2}{r}', name: 'Formula' });
                setIsMathModalOpen(true);
              }}
              className="px-2.5 py-1 rounded-lg bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/30 text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
              title="Visual Equation Builder"
            >
              <Calculator className="w-3.5 h-3.5" />
              <span>+ Equation</span>
            </button>
            <button
              type="button"
              onClick={() => handleAddBlockBelow(undefined, 'table')}
              className="px-2.5 py-1 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
              title="Insert Table"
            >
              <TableIcon className="w-3.5 h-3.5" />
              <span>+ Table</span>
            </button>
            <button
              type="button"
              onClick={() => handleAddBlockBelow(undefined, 'concept')}
              className="px-2 py-1 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
              title="Insert Concept Block"
            >
              <Lightbulb className="w-3.5 h-3.5" />
              <span>Concept</span>
            </button>
            <button
              type="button"
              onClick={() => handleAddBlockBelow(undefined, 'worked_example')}
              className="px-2 py-1 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
              title="Insert Worked Example"
            >
              <GraduationCap className="w-3.5 h-3.5" />
              <span>Example</span>
            </button>
            <button
              type="button"
              onClick={() => handleAddBlockBelow(undefined, 'recall_question')}
              className="px-2 py-1 rounded-lg bg-violet-600/20 hover:bg-violet-600/30 text-violet-300 border border-violet-500/30 text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
              title="Insert Recall Question"
            >
              <HelpCircle className="w-3.5 h-3.5" />
              <span>Recall</span>
            </button>
            <button
              type="button"
              onClick={() => setIsSketchModalOpen(true)}
              className="px-2 py-1 rounded-lg bg-sky-600/20 hover:bg-sky-600/30 text-sky-300 border border-sky-500/30 text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
              title="Draw Diagram"
            >
              <PenTool className="w-3.5 h-3.5" />
              <span>Sketch</span>
            </button>
          </div>

          {/* Right Action Shortcuts */}
          <div className="flex items-center gap-1.5">
            {onOpenHomeworkLinking && (
              <button
                type="button"
                onClick={onOpenHomeworkLinking}
                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                title="Link Homework to Note"
              >
                <Link2 className="w-3.5 h-3.5 text-indigo-400" />
                <span>Link HW</span>
              </button>
            )}
            {onOpenLearningTools && (
              <button
                type="button"
                onClick={() => onOpenLearningTools('flashcards')}
                className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer shadow-sm"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>To Flashcards</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Main Document Block List (Writing Surface) */}
      <div 
        className="space-y-3 min-h-[420px] pb-16 cursor-text"
        onClick={handleDocumentSurfaceClick}
      >
        {blocks.map((block, idx) => {
          const isHeading = block.type === 'heading';
          const isParagraph = block.type === 'paragraph';
          const isList = block.type === 'list';

          return (
            <div 
              key={block.id}
              className={`group relative rounded-2xl transition-all ${
                selectedBlockIds.includes(block.id) 
                  ? 'ring-2 ring-indigo-500 bg-indigo-500/10 p-2' 
                  : activeBlockId === block.id 
                    ? 'ring-1 ring-indigo-500/40 bg-slate-900/40 p-2' 
                    : 'p-1 hover:bg-slate-900/20'
              }`}
              onClick={(e) => {
                setActiveBlockId(block.id);
                toggleBlockSelection(block.id, e);
              }}
            >
              {/* Block Controls & Reorder handle */}
              {!readOnly && (
                <div className="absolute -left-8 top-2 hidden group-hover:flex md:flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                  <button
                    type="button"
                    onClick={() => handleMoveBlock(idx, 'up')}
                    disabled={idx === 0}
                    className="p-1 rounded text-slate-500 hover:text-white disabled:opacity-20 cursor-pointer"
                    title="Move up"
                  >
                    <ArrowUp className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleMoveBlock(idx, 'down')}
                    disabled={idx === blocks.length - 1}
                    className="p-1 rounded text-slate-500 hover:text-white disabled:opacity-20 cursor-pointer"
                    title="Move down"
                  >
                    <ArrowDown className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDuplicateBlock(idx)}
                    className="p-1 rounded text-slate-500 hover:text-white cursor-pointer"
                    title="Duplicate block"
                  >
                    <Copy className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteBlock(idx)}
                    className="p-1 rounded text-slate-500 hover:text-rose-400 cursor-pointer"
                    title="Delete block"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              )}

              {/* Heading Block */}
              {isHeading && (
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono text-indigo-400 font-bold shrink-0">
                    H{(block as HeadingBlock).level}
                  </span>
                  <input
                    ref={el => { blockInputRefs.current[block.id] = el; }}
                    type="text"
                    value={(block as HeadingBlock).text}
                    readOnly={readOnly}
                    onChange={e => handleBlockChange(idx, { ...block, text: e.target.value })}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddBlockBelow(idx, 'paragraph');
                      }
                    }}
                    placeholder="Heading..."
                    className={`w-full bg-transparent border-b border-transparent focus:border-indigo-500/50 focus:outline-none font-bold text-white transition-colors ${
                      (block as HeadingBlock).level === 1 ? 'text-2xl font-display' : (block as HeadingBlock).level === 2 ? 'text-xl font-display' : 'text-base'
                    }`}
                  />
                </div>
              )}

              {/* Paragraph Block */}
              {isParagraph && (
                <div className="relative">
                  <textarea
                    ref={el => { blockInputRefs.current[block.id] = el; }}
                    rows={Math.max(1, Math.ceil(((block as ParagraphBlock).text || '').length / 85))}
                    value={(block as ParagraphBlock).text}
                    readOnly={readOnly}
                    onChange={e => {
                      const val = e.target.value;
                      const match = val.match(/\/(\w*)$/);
                      if (match) {
                        setSlashBlockId(block.id);
                        setSlashQuery(match[1]);
                        setSlashMenuOpen(true);
                        setSlashSelectedIndex(0);
                      } else {
                        if (slashMenuOpen) setSlashMenuOpen(false);
                      }
                      
                      // Calculate position for slash menu
                      if (match && blockInputRefs.current[block.id]) {
                        const el = blockInputRefs.current[block.id] as HTMLTextAreaElement;
                        const rect = el.getBoundingClientRect();
                        const cursorIdx = el.selectionStart;
                        const textBefore = el.value.substring(0, cursorIdx);
                        const lines = textBefore.split('\n');
                        const lineCount = lines.length;
                        const lastLineLen = lines[lines.length - 1].length;
                        
                        // Approximate cursor position (since it's a textarea)
                        const charWidth = 7; // Average char width for text-xs
                        const lineHeight = 16;
                        
                        const left = Math.min(rect.width - 280, lastLineLen * charWidth);
                        const top = lineCount * lineHeight;
                        
                        // Check viewport overflow
                        const viewportHeight = window.innerHeight;
                        const spaceBelow = viewportHeight - (rect.top + top + 200);
                        const flip = spaceBelow < 0;
                        
                        setSlashMenuPosition({ top, left, flip });
                      }

                      handleBlockChange(idx, { ...block, text: val });
                    }}
                    onKeyDown={e => {
                      if (slashMenuOpen) {
                        if (e.key === 'ArrowDown') {
                          e.preventDefault();
                          setSlashSelectedIndex(prev => (prev + 1) % Math.max(1, filteredSlashOptions.length));
                          return;
                        }
                        if (e.key === 'ArrowUp') {
                          e.preventDefault();
                          setSlashSelectedIndex(prev => (prev - 1 + filteredSlashOptions.length) % Math.max(1, filteredSlashOptions.length));
                          return;
                        }
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          if (filteredSlashOptions[slashSelectedIndex]) {
                            handleSelectSlash(filteredSlashOptions[slashSelectedIndex]);
                          }
                          return;
                        }
                        if (e.key === 'Escape') {
                          e.preventDefault();
                          setSlashMenuOpen(false);
                          return;
                        }
                      }

                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleAddBlockBelow(idx, 'paragraph');
                      } else if (e.key === 'Backspace' && !(block as ParagraphBlock).text && blocks.length > 1) {
                        e.preventDefault();
                        handleDeleteBlock(idx);
                      }
                    }}
                    placeholder="Click to write... (Type / for options)"
                    className="w-full bg-transparent text-xs text-slate-200 leading-relaxed focus:outline-none resize-none font-sans"
                  />

                  {/* Compact Contextual Slash Popover Dropdown */}
                  {slashMenuOpen && slashBlockId === block.id && (
                    <div 
                      style={{ 
                        left: `${slashMenuPosition.left}px`, 
                        top: slashMenuPosition.flip ? 'auto' : `${slashMenuPosition.top}px`,
                        bottom: slashMenuPosition.flip ? '100%' : 'auto',
                        marginBottom: slashMenuPosition.flip ? '8px' : '0'
                      }}
                      className="absolute z-30 w-72 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-2 space-y-1 animate-in fade-in zoom-in-95 duration-100"
                    >
                      <div className="px-2 py-1 flex items-center justify-between border-b border-slate-800 text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                        <span>Insert Block</span>
                        <span className="text-indigo-400">↑↓ to navigate</span>
                      </div>
                      <div className="max-h-48 overflow-y-auto space-y-0.5">
                        {filteredSlashOptions.length === 0 ? (
                          <p className="p-2 text-xs text-slate-500 italic">No commands matching "{slashQuery}"</p>
                        ) : (
                          filteredSlashOptions.map((opt, oIdx) => (
                            <button
                              key={oIdx}
                              type="button"
                              onClick={() => handleSelectSlash(opt)}
                              className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl text-left transition-colors cursor-pointer ${
                                slashSelectedIndex === oIdx ? 'bg-indigo-600 text-white font-bold' : 'text-slate-300 hover:bg-slate-800'
                              }`}
                            >
                              <span className="w-5 h-5 rounded bg-slate-950 flex items-center justify-center text-xs font-bold text-indigo-400 shrink-0">
                                {opt.icon}
                              </span>
                              <div className="min-w-0 flex-1">
                                <p className="text-xs truncate">{opt.label}</p>
                                <p className="text-[9px] text-slate-400 truncate opacity-80">{opt.desc}</p>
                              </div>
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* List Block */}
              {isList && (
                <div className="space-y-1.5 pl-2">
                  {(block as ListBlock).items.map((item, itIdx) => (
                    <div key={item.id} className="flex items-center gap-2 text-xs text-slate-200">
                      {(block as ListBlock).listType === 'checklist' ? (
                        <input
                          type="checkbox"
                          checked={item.checked || false}
                          disabled={readOnly}
                          onChange={e => {
                            const newItems = [...(block as ListBlock).items];
                            newItems[itIdx].checked = e.target.checked;
                            handleBlockChange(idx, { ...block, items: newItems });
                          }}
                          className="rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                        />
                      ) : (block as ListBlock).listType === 'number' ? (
                        <span className="font-mono text-slate-400 font-bold text-[11px] w-4 shrink-0">
                          {itIdx + 1}.
                        </span>
                      ) : (
                        <span className="text-indigo-400 font-bold shrink-0">•</span>
                      )}
                      <input
                        type="text"
                        value={item.text}
                        readOnly={readOnly}
                        onChange={e => {
                          const newItems = [...(block as ListBlock).items];
                          newItems[itIdx].text = e.target.value;
                          handleBlockChange(idx, { ...block, items: newItems });
                        }}
                        onKeyDown={e => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            if (!item.text.trim()) {
                              // Exit list if current item is empty
                              const newItems = (block as ListBlock).items.filter((_, i) => i !== itIdx);
                              if (newItems.length === 0) {
                                handleBlockChange(idx, { id: block.id, type: 'paragraph', text: '' });
                              } else {
                                handleBlockChange(idx, { ...block, items: newItems });
                                handleAddBlockBelow(idx, 'paragraph');
                              }
                            } else {
                              // Add new list item with unique ID
                              const newItemId = 'it_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
                              const newItems = [...(block as ListBlock).items];
                              newItems.splice(itIdx + 1, 0, { id: newItemId, text: '', checked: false });
                              handleBlockChange(idx, { ...block, items: newItems });
                            }
                          }
                        }}
                        placeholder="List item..."
                        className="flex-1 bg-transparent focus:outline-none border-b border-transparent focus:border-slate-700 py-0.5"
                      />
                    </div>
                  ))}
                  {!readOnly && (
                    <button
                      type="button"
                      onClick={() => {
                        const newItemId = 'it_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
                        const newItems = [...(block as ListBlock).items, { id: newItemId, text: '', checked: false }];
                        handleBlockChange(idx, { ...block, items: newItems });
                      }}
                      className="text-[11px] text-indigo-400 hover:text-indigo-300 font-medium flex items-center gap-1 pt-1 cursor-pointer"
                    >
                      <Plus className="w-3 h-3" /> Add item
                    </button>
                  )}
                </div>
              )}

              {/* Educational Specialty Blocks */}
              {!isHeading && !isParagraph && !isList && (
                <EducationalBlockRenderer
                  block={block}
                  onChange={updated => handleBlockChange(idx, updated)}
                  onDelete={() => handleDeleteBlock(idx)}
                  onOpenMathEditor={(latex, name) => {
                    setMathModalData({ latex, name, targetBlockId: block.id });
                    setIsMathModalOpen(true);
                  }}
                  readOnly={readOnly}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Visual Math Builder Modal */}
      <VisualMathEditorModal
        isOpen={isMathModalOpen}
        initialLatex={mathModalData.latex}
        initialName={mathModalData.name}
        onClose={() => setIsMathModalOpen(false)}
        onSave={(latex, name) => {
          if (mathModalData.targetBlockId) {
            const idx = blocks.findIndex(b => b.id === mathModalData.targetBlockId);
            if (idx >= 0) {
              handleBlockChange(idx, {
                id: mathModalData.targetBlockId,
                type: 'formula',
                latex,
                name: name || 'Formula',
                variables: []
              });
            }
          } else {
            const activeIdx = activeBlockId ? blocks.findIndex(b => b.id === activeBlockId) : blocks.length - 1;
            const insertIdx = activeIdx >= 0 ? activeIdx : blocks.length - 1;
            const newFormula: FormulaBlock = {
              id: 'blk_math_' + Date.now(),
              type: 'formula',
              latex,
              name: name || 'Formula',
              variables: []
            };
            const next = [...blocks];
            next.splice(insertIdx + 1, 0, newFormula);
            updateBlocks(next, newFormula.id);
          }
        }}
      />

      {/* Sketch Canvas Modal */}
      <SketchCanvasModal
        isOpen={isSketchModalOpen}
        onClose={() => setIsSketchModalOpen(false)}
        onSave={(dataUrl, caption) => {
          const activeIdx = activeBlockId ? blocks.findIndex(b => b.id === activeBlockId) : blocks.length - 1;
          const insertIdx = activeIdx >= 0 ? activeIdx : blocks.length - 1;
          const newSketch = {
            id: 'blk_sketch_' + Date.now(),
            type: 'sketch' as const,
            dataUrl,
            caption
          };
          const next = [...blocks];
          next.splice(insertIdx + 1, 0, newSketch);
          updateBlocks(next, newSketch.id);
        }}
      />
    </div>
  );
};
