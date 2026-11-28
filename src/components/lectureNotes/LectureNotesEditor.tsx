import React, { useState, useEffect, useRef } from 'react';
import { 
  Heading2, 
  Calculator, 
  Table as TableIcon, 
  Lightbulb, 
  GraduationCap, 
  HelpCircle, 
  Copy, 
  ArrowUp, 
  ArrowDown, 
  PenTool,
  Sparkles,
  Link2,
  X,
  Trash2,
  Plus,
  Wand2
} from 'lucide-react';
import { 
  EducationalBlock, 
  HeadingBlock, 
  ParagraphBlock, 
  ListBlock, 
  FormulaBlock 
} from '../../lib/lectureNotes/types';
import { markdownToBlocks, blocksToMarkdown } from '../../lib/lectureNotes/documentBridge';
import { EducationalBlockRenderer, isEducationalBlockEmpty } from './blocks/EducationalBlockRenderer';
import { VisualMathEditorModal } from './VisualMathEditorModal';
import { SketchCanvasModal } from './SketchCanvasModal';
import { VaultNote } from '../../types';

// Robust caret coordinate measurement helper for textarea
function getCaretCoordinates(element: HTMLTextAreaElement, position: number) {
  const div = document.createElement('div');
  const style = window.getComputedStyle(element);

  const properties = [
    'direction', 'boxSizing', 'width', 'height', 'overflowX', 'overflowY',
    'borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth', 'borderStyle',
    'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
    'fontStyle', 'fontVariant', 'fontWeight', 'fontStretch', 'fontSize',
    'lineHeight', 'fontFamily', 'textAlign', 'textTransform', 'textIndent',
    'textDecoration', 'letterSpacing', 'wordSpacing', 'tabSize'
  ];

  properties.forEach(prop => {
    (div.style as any)[prop] = (style as any)[prop];
  });

  div.style.position = 'absolute';
  div.style.top = '0px';
  div.style.left = '-9999px';
  div.style.visibility = 'hidden';
  div.style.whiteSpace = 'pre-wrap';
  div.style.wordWrap = 'break-word';

  div.textContent = element.value.substring(0, position);

  const span = document.createElement('span');
  span.textContent = element.value.substring(position) || '.';
  div.appendChild(span);

  document.body.appendChild(div);

  const coordinates = {
    top: span.offsetTop + parseInt(style.borderTopWidth || '0', 10),
    left: span.offsetLeft + parseInt(style.borderLeftWidth || '0', 10),
    height: parseInt(style.lineHeight || '18', 10) || 18
  };

  document.body.removeChild(div);
  return coordinates;
}

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
  const [mathModalData, setMathModalData] = useState<{ latex: string; name?: string; targetBlockId?: string }>({ latex: 'F_c = \\frac{m v^2}{r}' });
  const [isSketchModalOpen, setIsSketchModalOpen] = useState(false);

  // Caret-anchored Slash Menu State
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
  const [isAIEditModalOpen, setIsAIEditModalOpen] = useState(false);
  const [aiInstruction, setAiInstruction] = useState('Improve clarity, flow, and formatting');
  const [aiActionMode, setAiActionMode] = useState<'replace' | 'insert_below' | 'append'>('replace');
  const prevBlocksBackupRef = useRef<EducationalBlock[] | null>(null);
  const [canUndoAI, setCanUndoAI] = useState(false);

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
      if (isNoteChanged) {
        setSelectedBlockIds([]);
        setIsMultiSelectMode(false);
      }
    }
  }, [noteId, initialContent]);

  // Global Keyboard Shortcuts (Ctrl+A / Cmd+A scoped to editor, Delete, Copy, Cut, Typing replacement)
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if user is typing in a modal or slash menu
      if (isMathModalOpen || isSketchModalOpen || slashMenuOpen || isAIEditModalOpen) return;

      const activeElement = document.activeElement;
      const isInsideEditor = editorRef.current?.contains(activeElement as Node);

      // Ctrl+A / Cmd+A - Select Entire Note (Scoped strictly to this note editor)
      if ((e.ctrlKey || e.metaKey) && (e.key === 'a' || e.key === 'A')) {
        if (isInsideEditor || document.activeElement === document.body) {
          e.preventDefault();
          setSelectedBlockIds(blocks.map(b => b.id));
          setIsMultiSelectMode(true);
          if (activeElement instanceof HTMLElement) activeElement.blur();
        }
      }

      // If blocks are selected across the document:
      if (selectedBlockIds.length > 0) {
        // Ctrl+C / Cmd+C - Copy Entire Selected Note
        if ((e.ctrlKey || e.metaKey) && (e.key === 'c' || e.key === 'C')) {
          e.preventDefault();
          const selected = blocks.filter(b => selectedBlockIds.includes(b.id));
          const md = blocksToMarkdown(selected);
          navigator.clipboard.writeText(md);
        }

        // Ctrl+X / Cmd+X - Cut Entire Selected Note
        if ((e.ctrlKey || e.metaKey) && (e.key === 'x' || e.key === 'X')) {
          e.preventDefault();
          const selected = blocks.filter(b => selectedBlockIds.includes(b.id));
          const md = blocksToMarkdown(selected);
          navigator.clipboard.writeText(md);
          handleDeleteSelectedBlocks();
        }

        // Delete / Backspace when blocks are selected
        if (e.key === 'Delete' || e.key === 'Backspace') {
          e.preventDefault();
          handleDeleteSelectedBlocks();
        }

        // Typing replacement: typing any printable character replaces all selected content
        if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
          e.preventDefault();
          const newId = 'blk_' + Date.now();
          const newBlock: ParagraphBlock = { id: newId, type: 'paragraph', text: e.key };
          
          if (selectedBlockIds.length === blocks.length) {
            updateBlocks([newBlock], newId, 1);
          } else {
            const firstIdx = blocks.findIndex(b => b.id === selectedBlockIds[0]);
            const remaining = blocks.filter(b => !selectedBlockIds.includes(b.id));
            const insertIdx = firstIdx >= 0 ? Math.min(firstIdx, remaining.length) : 0;
            remaining.splice(insertIdx, 0, newBlock);
            updateBlocks(remaining, newId, 1);
          }
          setSelectedBlockIds([]);
          setIsMultiSelectMode(false);
        }

        // Escape clears selection
        if (e.key === 'Escape') {
          setSelectedBlockIds([]);
          setIsMultiSelectMode(false);
        }
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [blocks, selectedBlockIds, isMathModalOpen, isSketchModalOpen, slashMenuOpen, isAIEditModalOpen]);

  // Delete selected blocks. If all blocks selected, leave 1 valid empty paragraph and focus it.
  const handleDeleteSelectedBlocks = () => {
    if (selectedBlockIds.length === 0) return;
    
    if (selectedBlockIds.length === blocks.length) {
      const resetId = 'blk_' + Date.now();
      updateBlocks([{ id: resetId, type: 'paragraph', text: '' }], resetId, 0);
    } else {
      const next = blocks.filter(b => !selectedBlockIds.includes(b.id));
      if (next.length === 0) {
        const resetId = 'blk_' + Date.now();
        updateBlocks([{ id: resetId, type: 'paragraph', text: '' }], resetId, 0);
      } else {
        const firstIdx = blocks.findIndex(b => b.id === selectedBlockIds[0]);
        const focusId = next[Math.max(0, Math.min(firstIdx, next.length - 1))]?.id;
        updateBlocks(next, focusId);
      }
    }
    setSelectedBlockIds([]);
    setIsMultiSelectMode(false);
  };

  // Propagate changes to parent in clean serialized Markdown
  const updateBlocks = (newBlocks: EducationalBlock[], shouldFocusId?: string, cursorOffset?: number) => {
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
          if (cursorOffset !== undefined && (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement)) {
            el.setSelectionRange(cursorOffset, cursorOffset);
          }
        }
      }, 30);
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
        newBlock = { id, type: 'concept', title: '', explanation: '', keyTakeaway: '' };
        break;
      case 'formula':
        newBlock = { id, type: 'formula', name: '', latex: 'F_c = \\frac{m v^2}{r}', variables: [] };
        break;
      case 'worked_example':
        newBlock = { id, type: 'worked_example', problem: '', steps: [''], finalAnswer: '' };
        break;
      case 'definition':
        newBlock = { id, type: 'definition', term: '', definition: '' };
        break;
      case 'callout':
        newBlock = { id, type: 'callout', variant: 'info', title: '', text: '' };
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
      updateBlocks([{ id: resetId, type: 'paragraph', text: '' }], resetId, 0);
      return;
    }
    const next = blocks.filter((_, i) => i !== idx);
    const prevBlock = next[Math.max(0, idx - 1)];
    const prevId = prevBlock?.id;
    const cursorOffset = (prevBlock && 'text' in prevBlock) ? (prevBlock as any).text.length : undefined;
    updateBlocks(next, prevId, cursorOffset);
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

  // Backspace at position 0 merge logic
  const handleBackspaceAtStart = (idx: number) => {
    if (idx === 0) {
      // First block: if empty and there are other blocks, remove it
      if (blocks[0].type === 'paragraph' && !(blocks[0] as ParagraphBlock).text && blocks.length > 1) {
        handleDeleteBlock(0);
      }
      return;
    }

    const currentBlock = blocks[idx];
    const prevBlock = blocks[idx - 1];

    // If current block is empty, delete it and focus previous block at end
    if (
      (currentBlock.type === 'paragraph' && !(currentBlock as ParagraphBlock).text) ||
      (currentBlock.type === 'heading' && !(currentBlock as HeadingBlock).text)
    ) {
      handleDeleteBlock(idx);
      return;
    }

    // If both current and previous blocks are text (paragraph or heading): merge!
    if (
      (currentBlock.type === 'paragraph' || currentBlock.type === 'heading') &&
      (prevBlock.type === 'paragraph' || prevBlock.type === 'heading')
    ) {
      const prevText = (prevBlock as ParagraphBlock | HeadingBlock).text || '';
      const currentText = (currentBlock as ParagraphBlock | HeadingBlock).text || '';
      const mergedText = prevText + currentText;

      const next = blocks.filter((_, i) => i !== idx);
      next[idx - 1] = {
        ...prevBlock,
        text: mergedText
      };

      updateBlocks(next, prevBlock.id, prevText.length);
      return;
    }

    // If previous block is non-text, move focus to it
    setActiveBlockId(prevBlock.id);
  };

  // Delete at end of block merge logic
  const handleDeleteAtEnd = (idx: number) => {
    if (idx >= blocks.length - 1) return;

    const currentBlock = blocks[idx];
    const nextBlock = blocks[idx + 1];

    // If next block is empty, remove it
    if (
      (nextBlock.type === 'paragraph' && !(nextBlock as ParagraphBlock).text) ||
      (nextBlock.type === 'heading' && !(nextBlock as HeadingBlock).text) ||
      isEducationalBlockEmpty(nextBlock)
    ) {
      const next = blocks.filter((_, i) => i !== idx + 1);
      updateBlocks(next, currentBlock.id);
      return;
    }

    // If both current and next blocks are text: merge next into current!
    if (
      (currentBlock.type === 'paragraph' || currentBlock.type === 'heading') &&
      (nextBlock.type === 'paragraph' || nextBlock.type === 'heading')
    ) {
      const currentText = (currentBlock as ParagraphBlock | HeadingBlock).text || '';
      const nextText = (nextBlock as ParagraphBlock | HeadingBlock).text || '';
      const mergedText = currentText + nextText;

      const next = blocks.filter((_, i) => i !== idx + 1);
      next[idx] = {
        ...currentBlock,
        text: mergedText
      };

      updateBlocks(next, currentBlock.id, currentText.length);
    }
  };

  // Slash commands options
  const slashOptions = [
    { label: 'Paragraph', desc: 'Standard body text', type: 'paragraph', icon: '¶' },
    { label: 'Heading 1', desc: 'Large chapter title', type: 'h1', icon: 'H1' },
    { label: 'Heading 2', desc: 'Section heading', type: 'h2', icon: 'H2' },
    { label: 'Heading 3', desc: 'Sub-section heading', type: 'h3', icon: 'H3' },
    { label: 'Bullet List', desc: 'Unordered bullet list', type: 'bullet', icon: '•' },
    { label: 'Numbered List', desc: 'Ordered numbered list', type: 'number', icon: '1.' },
    { label: 'Checklist', desc: 'Interactive task checklist', type: 'checklist', icon: '☑' },
    { label: 'Math Equation', desc: 'Visual formula builder', type: 'formula', icon: '∑' },
    { label: 'Table', desc: 'Grid data table', type: 'table', icon: '▦' },
    { label: 'Concept Block', desc: 'Core principle card', type: 'concept', icon: '💡' },
    { label: 'Worked Example', desc: 'Step-by-step problem solver', type: 'worked_example', icon: '🎓' },
    { label: 'Definition', desc: 'Formal academic term', type: 'definition', icon: '📖' },
    { label: 'Recall Question', desc: 'Active recall self-test', type: 'recall_question', icon: '❓' },
    { label: 'Warning / Exam Tip', desc: 'Exam tip or common mistake', type: 'callout', icon: '⚠️' },
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
      setMathModalData({ latex: 'F_c = \\frac{m v^2}{r}', name: 'Equation', targetBlockId: slashBlockId || undefined });
      setIsMathModalOpen(true);
    } else if (opt.type === 'sketch') {
      setIsSketchModalOpen(true);
    } else {
      handleAddBlockBelow(insertIdx, opt.type as any);
    }
  };

  const handleExecuteAIEdit = async () => {
    if (selectedBlockIds.length === 0 && !activeBlockId) return;
    
    setIsAIProcessing(true);
    const targetIds = selectedBlockIds.length > 0 ? selectedBlockIds : [activeBlockId!];
    const selectedBlocks = blocks.filter(b => targetIds.includes(b.id));
    const contentToEdit = blocksToMarkdown(selectedBlocks);

    // Save backup for undo
    prevBlocksBackupRef.current = [...blocks];

    try {
      const res = await fetch('/api/ai/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'edit_note',
          content: contentToEdit,
          instruction: aiInstruction || 'Refine and improve this section.',
          subject: noteSubject
        })
      });

      if (!res.ok) throw new Error('AI Edit failed');
      const data = await res.json();
      
      const returnedText = data.text || data.content;
      if (data.success && returnedText) {
        const newBlocks = markdownToBlocks(returnedText);
        const startIdx = blocks.findIndex(b => b.id === targetIds[0]);
        const next = [...blocks];

        if (aiActionMode === 'replace') {
          next.splice(startIdx >= 0 ? startIdx : 0, targetIds.length, ...newBlocks);
        } else if (aiActionMode === 'insert_below') {
          const lastIdx = blocks.findIndex(b => b.id === targetIds[targetIds.length - 1]);
          next.splice((lastIdx >= 0 ? lastIdx : blocks.length) + 1, 0, ...newBlocks);
        } else {
          next.push(...newBlocks);
        }

        updateBlocks(next);
        setSelectedBlockIds([]);
        setIsMultiSelectMode(false);
        setIsAIEditModalOpen(false);
        setCanUndoAI(true);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsAIProcessing(false);
    }
  };

  const handleUndoAIEdit = () => {
    if (prevBlocksBackupRef.current) {
      updateBlocks(prevBlocksBackupRef.current);
      prevBlocksBackupRef.current = null;
      setCanUndoAI(false);
    }
  };

  const toggleBlockSelection = (id: string, e: React.MouseEvent) => {
    if (e.shiftKey) {
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
      setSelectedBlockIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
      setIsMultiSelectMode(true);
    } else {
      if (isMultiSelectMode) {
        setSelectedBlockIds([id]);
      }
    }
  };

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
    <div className="relative space-y-3" ref={editorRef}>
      {/* Floating Selection Toolbar */}
      {selectedBlockIds.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 p-1.5 rounded-xl bg-slate-900 border border-slate-700 shadow-xl animate-in slide-in-from-bottom-2 duration-150">
          <div className="px-2.5 border-r border-slate-700 text-xs font-medium text-slate-300">
            {selectedBlockIds.length} selected
          </div>
          <button
            onClick={() => setIsAIEditModalOpen(true)}
            disabled={isAIProcessing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition-colors disabled:opacity-50 cursor-pointer shadow-sm"
            title="Edit selection with AI"
          >
            {isAIProcessing ? <Sparkles className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
            <span>Edit with AI</span>
          </button>
          <button
            onClick={() => {
              const selected = blocks.filter(b => selectedBlockIds.includes(b.id));
              const md = blocksToMarkdown(selected);
              navigator.clipboard.writeText(md);
            }}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
            title="Copy selection"
          >
            <Copy className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleDeleteSelectedBlocks}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-900/40 text-slate-400 hover:text-rose-300 transition-colors cursor-pointer"
            title="Delete selection"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => {
              setSelectedBlockIds([]);
              setIsMultiSelectMode(false);
            }}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
            title="Clear selection"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Top Document Formatting Toolbar */}
      {!readOnly && (
        <div className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-1.5 p-2 rounded-xl bg-slate-900/95 border border-slate-800 backdrop-blur-md shadow-sm">
          <div className="flex flex-wrap items-center gap-1 text-xs">
            <button
              type="button"
              onClick={() => handleAddBlockBelow(undefined, 'heading')}
              className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer font-bold"
              title="Add Heading"
            >
              <Heading2 className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => handleAddBlockBelow(undefined, 'paragraph')}
              className="px-2 py-1 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer font-serif font-bold text-xs"
              title="Add Paragraph"
            >
              ¶
            </button>
            <div className="w-px h-3.5 bg-slate-800 mx-0.5" />
            <button
              type="button"
              onClick={() => {
                setMathModalData({ latex: 'F_c = \\frac{m v^2}{r}', name: 'Equation' });
                setIsMathModalOpen(true);
              }}
              className="px-2 py-1 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/50 text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer"
              title="Visual Equation Builder"
            >
              <Calculator className="w-3.5 h-3.5 text-indigo-400" />
              <span>Equation</span>
            </button>
            <button
              type="button"
              onClick={() => handleAddBlockBelow(undefined, 'table')}
              className="px-2 py-1 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/50 text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer"
              title="Insert Table"
            >
              <TableIcon className="w-3.5 h-3.5 text-blue-400" />
              <span>Table</span>
            </button>
            <button
              type="button"
              onClick={() => handleAddBlockBelow(undefined, 'concept')}
              className="px-2 py-1 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/50 text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer"
              title="Insert Concept Block"
            >
              <Lightbulb className="w-3.5 h-3.5 text-amber-400" />
              <span>Concept</span>
            </button>
            <button
              type="button"
              onClick={() => handleAddBlockBelow(undefined, 'worked_example')}
              className="px-2 py-1 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/50 text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer"
              title="Insert Worked Example"
            >
              <GraduationCap className="w-3.5 h-3.5 text-emerald-400" />
              <span>Example</span>
            </button>
            <button
              type="button"
              onClick={() => handleAddBlockBelow(undefined, 'recall_question')}
              className="px-2 py-1 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/50 text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer"
              title="Insert Recall Question"
            >
              <HelpCircle className="w-3.5 h-3.5 text-violet-400" />
              <span>Recall</span>
            </button>
            <button
              type="button"
              onClick={() => setIsSketchModalOpen(true)}
              className="px-2 py-1 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/50 text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer"
              title="Draw Diagram / Sketch"
            >
              <PenTool className="w-3.5 h-3.5 text-sky-400" />
              <span>Sketch</span>
            </button>
          </div>

          {/* Right Action Shortcuts */}
          <div className="flex items-center gap-1.5">
            {canUndoAI && (
              <button
                type="button"
                onClick={handleUndoAIEdit}
                className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer"
                title="Undo last AI edit"
              >
                <span>↩ Undo AI</span>
              </button>
            )}
            {onOpenHomeworkLinking && (
              <button
                type="button"
                onClick={onOpenHomeworkLinking}
                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer"
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
                className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer shadow-sm"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>To Tools</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Main Continuous Document Writing Surface */}
      <div 
        className="space-y-2 min-h-[440px] pb-16 cursor-text"
        onClick={handleDocumentSurfaceClick}
      >
        {blocks.map((block, idx) => {
          const isHeading = block.type === 'heading';
          const isParagraph = block.type === 'paragraph';
          const isList = block.type === 'list';
          const isSelected = selectedBlockIds.includes(block.id);

          return (
            <div 
              key={block.id}
              className={`group relative rounded-xl transition-colors ${
                isSelected 
                  ? 'ring-1 ring-indigo-500/80 bg-indigo-500/10 p-2' 
                  : activeBlockId === block.id 
                    ? 'ring-1 ring-slate-700/60 bg-slate-900/30 p-1.5' 
                    : 'p-1 hover:bg-slate-900/20'
              }`}
              onClick={(e) => {
                setActiveBlockId(block.id);
                toggleBlockSelection(block.id, e);
              }}
            >
              {/* Block Controls & Reorder handle */}
              {!readOnly && (
                <div className="absolute -left-7 top-1.5 hidden group-hover:flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                  <button
                    type="button"
                    onClick={() => handleMoveBlock(idx, 'up')}
                    disabled={idx === 0}
                    className="p-0.5 rounded text-slate-500 hover:text-white disabled:opacity-20 cursor-pointer"
                    title="Move up"
                  >
                    <ArrowUp className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleMoveBlock(idx, 'down')}
                    disabled={idx === blocks.length - 1}
                    className="p-0.5 rounded text-slate-500 hover:text-white disabled:opacity-20 cursor-pointer"
                    title="Move down"
                  >
                    <ArrowDown className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDuplicateBlock(idx)}
                    className="p-0.5 rounded text-slate-500 hover:text-white cursor-pointer"
                    title="Duplicate block"
                  >
                    <Copy className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteBlock(idx)}
                    className="p-0.5 rounded text-slate-500 hover:text-rose-400 cursor-pointer"
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
                      } else if (e.key === 'Backspace' && e.currentTarget.selectionStart === 0 && e.currentTarget.selectionEnd === 0) {
                        e.preventDefault();
                        handleBackspaceAtStart(idx);
                      } else if (e.key === 'Delete' && e.currentTarget.selectionStart === e.currentTarget.value.length && e.currentTarget.selectionEnd === e.currentTarget.value.length) {
                        e.preventDefault();
                        handleDeleteAtEnd(idx);
                      }
                    }}
                    placeholder="Heading..."
                    className={`w-full bg-transparent border-b border-transparent focus:border-indigo-500/50 focus:outline-none font-bold text-white transition-colors ${
                      (block as HeadingBlock).level === 1 ? 'text-2xl' : (block as HeadingBlock).level === 2 ? 'text-xl' : 'text-base'
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

                        // Exact Caret-Anchored Viewport Positioning
                        const el = e.currentTarget;
                        const caretCoords = getCaretCoordinates(el, el.selectionStart);
                        const rect = el.getBoundingClientRect();
                        const menuWidth = 288;
                        const menuHeight = 250;

                        const caretViewportX = rect.left + caretCoords.left - el.scrollLeft;
                        const caretViewportY = rect.top + caretCoords.top - el.scrollTop;

                        const spaceBelow = window.innerHeight - (caretViewportY + caretCoords.height + menuHeight + 16);
                        const flip = spaceBelow < 0;

                        const clampedX = Math.max(16, Math.min(window.innerWidth - menuWidth - 16, caretViewportX));
                        const finalTop = flip 
                          ? Math.max(16, caretViewportY - menuHeight - 8)
                          : caretViewportY + caretCoords.height + 6;

                        setSlashMenuPosition({
                          top: finalTop,
                          left: clampedX,
                          flip
                        });
                      } else {
                        if (slashMenuOpen) setSlashMenuOpen(false);
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
                      } else if (e.key === 'Backspace' && e.currentTarget.selectionStart === 0 && e.currentTarget.selectionEnd === 0) {
                        e.preventDefault();
                        handleBackspaceAtStart(idx);
                      } else if (e.key === 'Delete' && e.currentTarget.selectionStart === e.currentTarget.value.length && e.currentTarget.selectionEnd === e.currentTarget.value.length) {
                        e.preventDefault();
                        handleDeleteAtEnd(idx);
                      }
                    }}
                    placeholder="Type notes here... (Type / for commands)"
                    className="w-full bg-transparent text-xs text-slate-200 leading-relaxed focus:outline-none resize-none font-sans"
                  />
                </div>
              )}

              {/* List Block */}
              {isList && (
                <div className="space-y-1 pl-2">
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
                              const newItems = (block as ListBlock).items.filter((_, i) => i !== itIdx);
                              if (newItems.length === 0) {
                                handleBlockChange(idx, { id: block.id, type: 'paragraph', text: '' });
                              } else {
                                handleBlockChange(idx, { ...block, items: newItems });
                                handleAddBlockBelow(idx, 'paragraph');
                              }
                            } else {
                              const newItemId = 'it_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
                              const newItems = [...(block as ListBlock).items];
                              newItems.splice(itIdx + 1, 0, { id: newItemId, text: '', checked: false });
                              handleBlockChange(idx, { ...block, items: newItems });
                            }
                          } else if (e.key === 'Backspace' && e.currentTarget.selectionStart === 0 && e.currentTarget.selectionEnd === 0) {
                            if (!item.text) {
                              e.preventDefault();
                              const newItems = (block as ListBlock).items.filter((_, i) => i !== itIdx);
                              if (newItems.length === 0) {
                                handleDeleteBlock(idx);
                              } else {
                                handleBlockChange(idx, { ...block, items: newItems });
                              }
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
                      className="text-[11px] text-indigo-400 hover:text-indigo-300 font-medium flex items-center gap-1 pt-0.5 cursor-pointer"
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

      {/* Fixed Caret-Anchored Slash Popover Dropdown */}
      {slashMenuOpen && (
        <div 
          style={{ 
            position: 'fixed',
            left: `${slashMenuPosition.left}px`, 
            top: `${slashMenuPosition.top}px`,
            zIndex: 9999
          }}
          className="w-72 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-1.5 space-y-1 animate-in fade-in zoom-in-95 duration-100"
        >
          <div className="px-2 py-1 flex items-center justify-between border-b border-slate-800 text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
            <span>Insert Block</span>
            <span className="text-slate-500">↑↓ to navigate</span>
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
                  className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left transition-colors cursor-pointer ${
                    slashSelectedIndex === oIdx ? 'bg-indigo-600 text-white font-semibold' : 'text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <span className="w-5 h-5 rounded bg-slate-950 flex items-center justify-center text-xs font-bold text-indigo-400 shrink-0">
                    {opt.icon}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs truncate">{opt.label}</p>
                    <p className="text-[10px] text-slate-400 truncate">{opt.desc}</p>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}

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

      {/* AI Edit Modal Dialog */}
      {isAIEditModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div 
            className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-2xl relative"
            onClick={e => e.stopPropagation()}
          >
            {/* Top Bar */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2 text-indigo-400 font-semibold text-sm">
                <Wand2 className="w-4 h-4 text-indigo-400" />
                <h3 className="text-white text-sm font-semibold">Edit Selection with AI</h3>
              </div>
              <button onClick={() => setIsAIEditModalOpen(false)} className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Quick Action Presets */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Quick Actions</label>
              <div className="flex flex-wrap gap-1">
                {[
                  { label: 'Improve Clarity', prompt: 'Improve clarity, flow, and academic tone while preserving all formulas and formatting' },
                  { label: 'Fix Grammar', prompt: 'Proofread and fix grammar, spelling, and sentence structure' },
                  { label: 'Simplify', prompt: 'Simplify the explanation so it is easy for a student to understand' },
                  { label: 'Convert to Example', prompt: 'Transform this text into a structured Worked Example block with step-by-step solution' },
                  { label: 'Recall Questions', prompt: 'Generate 2 Active Recall self-test questions based on this text' },
                  { label: 'Summarize', prompt: 'Summarize key takeaways into a concise bullet list' }
                ].map((preset, pIdx) => (
                  <button
                    key={pIdx}
                    type="button"
                    onClick={() => setAiInstruction(preset.prompt)}
                    className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-[11px] font-medium border border-slate-700/50 transition-colors cursor-pointer"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Instruction Input */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300">Instruction</label>
              <textarea
                rows={3}
                value={aiInstruction}
                onChange={e => setAiInstruction(e.target.value)}
                placeholder="Describe what edits or transformation you want..."
                className="w-full p-2.5 text-xs rounded-lg bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-indigo-500 resize-none font-sans"
              />
            </div>

            {/* Action Mode Selection */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300">Apply Mode</label>
              <div className="grid grid-cols-3 gap-2 text-xs">
                {[
                  { id: 'replace', label: 'Replace Selection' },
                  { id: 'insert_below', label: 'Insert Below' },
                  { id: 'append', label: 'Append to Note' }
                ].map(mode => (
                  <button
                    key={mode.id}
                    type="button"
                    onClick={() => setAiActionMode(mode.id as any)}
                    className={`py-1.5 px-2 rounded-lg text-xs font-medium border transition-colors cursor-pointer text-center ${
                      aiActionMode === mode.id
                        ? 'bg-indigo-600/30 text-indigo-200 border-indigo-500/50'
                        : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
                    }`}
                  >
                    {mode.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setIsAIEditModalOpen(false)}
                className="px-3.5 py-1.5 text-xs font-medium text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!aiInstruction.trim() || isAIProcessing}
                onClick={handleExecuteAIEdit}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium shadow-sm transition-colors disabled:opacity-50 cursor-pointer"
              >
                {isAIProcessing ? (
                  <>
                    <Sparkles className="w-3.5 h-3.5 animate-spin" />
                    <span>Processing...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Apply Edits</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

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
