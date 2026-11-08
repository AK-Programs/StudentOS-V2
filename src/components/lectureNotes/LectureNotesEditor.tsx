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
  MoreVertical,
  PenTool,
  Search,
  Sparkles,
  Link2,
  X
} from 'lucide-react';
import { 
  EducationalBlock, 
  EducationalDocument, 
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
  const [isMathModalOpen, setIsMathModalOpen] = useState(false);
  const [mathModalData, setMathModalData] = useState<{ latex: string; name?: string; targetBlockId?: string }>({ latex: 'E = mc^2' });
  const [isSketchModalOpen, setIsSketchModalOpen] = useState(false);
  const [slashMenuOpen, setSlashMenuOpen] = useState(false);
  const [slashQuery, setSlashQuery] = useState('');
  const [slashBlockId, setSlashBlockId] = useState<string | null>(null);

  // Sync internal blocks when note selection changes externally
  useEffect(() => {
    setBlocks(markdownToBlocks(initialContent));
  }, [initialContent]);

  // Propagate changes to parent in clean serialized Markdown
  const updateBlocks = (newBlocks: EducationalBlock[]) => {
    setBlocks(newBlocks);
    const md = blocksToMarkdown(newBlocks);
    onChange(md);
  };

  const handleBlockChange = (idx: number, updated: EducationalBlock) => {
    const next = [...blocks];
    next[idx] = updated;
    updateBlocks(next);
  };

  const handleAddBlockBelow = (idx: number, type: EducationalBlock['type'] = 'paragraph') => {
    const id = 'blk_' + Math.random().toString(36).substring(2, 9);
    let newBlock: EducationalBlock;

    switch (type) {
      case 'heading':
        newBlock = { id, type: 'heading', level: 2, text: '' };
        break;
      case 'concept':
        newBlock = { id, type: 'concept', title: 'New Concept', explanation: '', keyTakeaway: '' };
        break;
      case 'formula':
        newBlock = { id, type: 'formula', name: 'Formula', latex: 'F = m a', variables: [] };
        break;
      case 'worked_example':
        newBlock = { id, type: 'worked_example', problem: '', steps: [''], finalAnswer: '' };
        break;
      case 'definition':
        newBlock = { id, type: 'definition', term: '', definition: '' };
        break;
      case 'callout':
        newBlock = { id, type: 'callout', variant: 'info', title: 'Important Takeaway', text: '' };
        break;
      case 'recall_question':
        newBlock = { id, type: 'recall_question', question: '', answer: '', isRevealed: false };
        break;
      case 'table':
        newBlock = { id, type: 'table', headers: ['Variable', 'Description', 'Value'], rows: [['', '', '']] };
        break;
      case 'list':
        newBlock = { id, type: 'list', listType: 'bullet', items: [{ id: 'it_1', text: '' }] };
        break;
      default:
        newBlock = { id, type: 'paragraph', text: '' };
        break;
    }

    const next = [...blocks];
    next.splice(idx + 1, 0, newBlock);
    updateBlocks(next);
    setActiveBlockId(id);
  };

  const handleDeleteBlock = (idx: number) => {
    if (blocks.length <= 1) {
      updateBlocks([{ id: 'blk_1', type: 'paragraph', text: '' }]);
      return;
    }
    const next = blocks.filter((_, i) => i !== idx);
    updateBlocks(next);
  };

  const handleMoveBlock = (idx: number, direction: 'up' | 'down') => {
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= blocks.length) return;
    const next = [...blocks];
    const temp = next[idx];
    next[idx] = next[targetIdx];
    next[targetIdx] = temp;
    updateBlocks(next);
  };

  const handleDuplicateBlock = (idx: number) => {
    const clone = JSON.parse(JSON.stringify(blocks[idx]));
    clone.id = 'blk_' + Math.random().toString(36).substring(2, 9);
    const next = [...blocks];
    next.splice(idx + 1, 0, clone);
    updateBlocks(next);
  };

  // Slash commands registry
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
    { label: 'Sketch / Diagram', desc: 'Handwritten diagram canvas', type: 'sketch', icon: '✏️' },
    { label: 'Divider', desc: 'Horizontal visual separator', type: 'divider', icon: '—' }
  ];

  const handleSelectSlash = (opt: typeof slashOptions[0]) => {
    setSlashMenuOpen(false);
    const currentIdx = blocks.findIndex(b => b.id === slashBlockId);
    const insertIdx = currentIdx >= 0 ? currentIdx : blocks.length - 1;

    if (opt.type === 'h1' || opt.type === 'h2' || opt.type === 'h3') {
      const level = opt.type === 'h1' ? 1 : opt.type === 'h2' ? 2 : 3;
      handleBlockChange(insertIdx, {
        id: slashBlockId || 'blk_h',
        type: 'heading',
        level: level as 1 | 2 | 3,
        text: ''
      });
    } else if (opt.type === 'formula') {
      setMathModalData({ latex: 'F_c = \\frac{m v^2}{r}', name: 'Formula', targetBlockId: slashBlockId || undefined });
      setIsMathModalOpen(true);
    } else if (opt.type === 'sketch') {
      setIsSketchModalOpen(true);
    } else {
      handleAddBlockBelow(insertIdx, opt.type as any);
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Floating Formatting Bar */}
      {!readOnly && (
        <div className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-2 p-2 rounded-2xl bg-slate-900/90 border border-slate-700/80 backdrop-blur-md shadow-lg">
          <div className="flex flex-wrap items-center gap-1">
            <button
              type="button"
              onClick={() => handleAddBlockBelow(blocks.length - 1, 'heading')}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer text-xs font-bold"
              title="Add Heading"
            >
              <Heading2 className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => handleAddBlockBelow(blocks.length - 1, 'paragraph')}
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
              onClick={() => handleAddBlockBelow(blocks.length - 1, 'table')}
              className="px-2.5 py-1 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
              title="Insert Table"
            >
              <TableIcon className="w-3.5 h-3.5" />
              <span>+ Table</span>
            </button>
            <button
              type="button"
              onClick={() => handleAddBlockBelow(blocks.length - 1, 'concept')}
              className="px-2 py-1 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
              title="Insert Concept Block"
            >
              <Lightbulb className="w-3.5 h-3.5" />
              <span>Concept</span>
            </button>
            <button
              type="button"
              onClick={() => handleAddBlockBelow(blocks.length - 1, 'worked_example')}
              className="px-2 py-1 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
              title="Insert Worked Example"
            >
              <GraduationCap className="w-3.5 h-3.5" />
              <span>Example</span>
            </button>
            <button
              type="button"
              onClick={() => handleAddBlockBelow(blocks.length - 1, 'recall_question')}
              className="px-2 py-1 rounded-lg bg-violet-600/20 hover:bg-violet-600/30 text-violet-300 border border-violet-500/30 text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
              title="Insert Recall Question"
            >
              <HelpCircle className="w-3.5 h-3.5" />
              <span>Recall</span>
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

      {/* Main Blocks List */}
      <div className="space-y-3 min-h-[360px] pb-12">
        {blocks.map((block, idx) => {
          const isHeading = block.type === 'heading';
          const isParagraph = block.type === 'paragraph';
          const isList = block.type === 'list';

          return (
            <div 
              key={block.id}
              className={`group relative rounded-2xl transition-all ${
                activeBlockId === block.id ? 'ring-1 ring-indigo-500/40 bg-slate-900/40 p-2' : 'p-1 hover:bg-slate-900/20'
              }`}
              onClick={() => setActiveBlockId(block.id)}
            >
              {/* Block Handle & Reorder controls (on hover/focus) */}
              {!readOnly && (
                <div className="absolute -left-8 top-2 hidden group-hover:flex md:flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
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

              {/* Native Heading */}
              {isHeading && (
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono text-indigo-400 font-bold shrink-0">
                    H{(block as HeadingBlock).level}
                  </span>
                  <input
                    type="text"
                    value={(block as HeadingBlock).text}
                    readOnly={readOnly}
                    onChange={e => handleBlockChange(idx, { ...block, text: e.target.value })}
                    placeholder="Heading..."
                    className={`w-full bg-transparent border-b border-transparent focus:border-indigo-500/50 focus:outline-none font-bold text-white transition-colors ${
                      (block as HeadingBlock).level === 1 ? 'text-2xl font-display' : (block as HeadingBlock).level === 2 ? 'text-xl font-display' : 'text-base'
                    }`}
                  />
                </div>
              )}

              {/* Native Paragraph */}
              {isParagraph && (
                <div className="relative">
                  <textarea
                    rows={Math.max(2, Math.ceil(((block as ParagraphBlock).text || '').length / 90))}
                    value={(block as ParagraphBlock).text}
                    readOnly={readOnly}
                    onChange={e => {
                      const val = e.target.value;
                      if (val.endsWith('/') && !slashMenuOpen) {
                        setSlashBlockId(block.id);
                        setSlashMenuOpen(true);
                      }
                      handleBlockChange(idx, { ...block, text: val });
                    }}
                    placeholder="Click to type... (Type / for commands)"
                    className="w-full bg-transparent text-xs text-slate-200 leading-relaxed focus:outline-none resize-none font-sans"
                  />
                </div>
              )}

              {/* Native List */}
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
                        placeholder="List item..."
                        className="flex-1 bg-transparent focus:outline-none border-b border-transparent focus:border-slate-700 py-0.5"
                      />
                    </div>
                  ))}
                  {!readOnly && (
                    <button
                      type="button"
                      onClick={() => {
                        const newItems = [...(block as ListBlock).items, { id: 'it_' + Date.now(), text: '' }];
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

      {/* Slash Command Palette Modal / Dropdown */}
      {slashMenuOpen && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in"
          onClick={() => setSlashMenuOpen(false)}
        >
          <div 
            className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-4 space-y-3"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" /> Slash Commands
              </span>
              <button 
                onClick={() => setSlashMenuOpen(false)}
                className="p-1 rounded text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <input
              type="text"
              autoFocus
              value={slashQuery}
              onChange={e => setSlashQuery(e.target.value)}
              placeholder="Search command (math, table, concept...)"
              className="w-full px-3 py-2 text-xs rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
            <div className="grid grid-cols-2 gap-1.5 max-h-56 overflow-y-auto pr-1">
              {slashOptions
                .filter(o => !slashQuery || o.label.toLowerCase().includes(slashQuery.toLowerCase()))
                .map((opt, oIdx) => (
                  <button
                    key={oIdx}
                    type="button"
                    onClick={() => handleSelectSlash(opt)}
                    className="flex items-center gap-2 p-2 rounded-xl bg-slate-800/60 hover:bg-indigo-600/20 border border-slate-800 hover:border-indigo-500/40 text-left transition-colors cursor-pointer group"
                  >
                    <span className="w-7 h-7 rounded-lg bg-slate-900 flex items-center justify-center text-xs font-bold text-indigo-400 group-hover:text-white shrink-0">
                      {opt.icon}
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-slate-200 group-hover:text-white truncate">{opt.label}</p>
                      <p className="text-[10px] text-slate-400 truncate">{opt.desc}</p>
                    </div>
                  </button>
                ))}
            </div>
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
            const newFormula: FormulaBlock = {
              id: 'blk_math_' + Date.now(),
              type: 'formula',
              latex,
              name: name || 'Formula',
              variables: []
            };
            updateBlocks([...blocks, newFormula]);
          }
        }}
      />

      {/* Sketch Canvas Modal */}
      <SketchCanvasModal
        isOpen={isSketchModalOpen}
        onClose={() => setIsSketchModalOpen(false)}
        onSave={(dataUrl, caption) => {
          const newSketch = {
            id: 'blk_sketch_' + Date.now(),
            type: 'sketch' as const,
            dataUrl,
            caption
          };
          updateBlocks([...blocks, newSketch]);
        }}
      />
    </div>
  );
};
