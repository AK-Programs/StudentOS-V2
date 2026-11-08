import React, { useState, useEffect, useRef } from 'react';
import { 
  Lightbulb, 
  AlertTriangle, 
  HelpCircle, 
  BookOpen, 
  Target, 
  XCircle, 
  CheckCircle2, 
  Eye, 
  EyeOff, 
  Edit3, 
  Trash2, 
  Copy, 
  Plus, 
  Calculator,
  GraduationCap,
  Sparkles
} from 'lucide-react';
import katex from 'katex';
import { 
  EducationalBlock, 
  ConceptBlock, 
  FormulaBlock, 
  WorkedExampleBlock, 
  DefinitionBlock, 
  CalloutBlock, 
  RecallQuestionBlock, 
  DiagramBlock,
  SketchBlock
} from '../../../lib/lectureNotes/types';
import { VisualTableEditor } from '../VisualTableEditor';

interface EducationalBlockRendererProps {
  block: EducationalBlock;
  onChange: (updatedBlock: EducationalBlock) => void;
  onDelete?: () => void;
  onOpenMathEditor?: (latex: string, name?: string) => void;
  readOnly?: boolean;
}

export const EducationalBlockRenderer: React.FC<EducationalBlockRendererProps> = ({
  block,
  onChange,
  onDelete,
  onOpenMathEditor,
  readOnly = false
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const mathRef = useRef<HTMLDivElement>(null);

  // KaTeX rendering for formulas
  useEffect(() => {
    if (block.type === 'formula' && mathRef.current) {
      try {
        katex.render(block.latex || 'E = mc^2', mathRef.current, {
          displayMode: true,
          throwOnError: false
        });
      } catch (err) {
        if (mathRef.current) mathRef.current.innerText = block.latex || '';
      }
    }
  }, [block]);

  // Render by Block Type
  switch (block.type) {
    case 'concept': {
      const b = block as ConceptBlock;
      return (
        <div className="my-4 rounded-2xl border border-indigo-500/30 bg-indigo-950/20 p-5 space-y-3 relative group transition-all">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-xl bg-indigo-500/20 text-indigo-400">
                <Lightbulb className="w-4 h-4" />
              </span>
              {isEditing ? (
                <input
                  type="text"
                  value={b.title}
                  onChange={e => onChange({ ...b, title: e.target.value })}
                  placeholder="Concept Title"
                  className="bg-slate-900 border border-slate-700 px-2 py-1 rounded text-sm font-bold text-white focus:outline-none"
                />
              ) : (
                <h4 className="text-sm font-bold text-indigo-200">{b.title || 'Core Concept'}</h4>
              )}
            </div>
            {!readOnly && (
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  type="button"
                  onClick={() => setIsEditing(!isEditing)}
                  className="p-1 rounded text-slate-400 hover:text-white hover:bg-white/10 text-xs cursor-pointer"
                  title="Toggle edit mode"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                </button>
                {onDelete && (
                  <button
                    type="button"
                    onClick={onDelete}
                    className="p-1 rounded text-rose-400 hover:bg-rose-500/20 text-xs cursor-pointer"
                    title="Delete block"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Explanation */}
          {isEditing ? (
            <textarea
              rows={2}
              value={b.explanation}
              onChange={e => onChange({ ...b, explanation: e.target.value })}
              placeholder="Detailed explanation of the concept..."
              className="w-full bg-slate-900 border border-slate-700 p-2 rounded text-xs text-slate-200 focus:outline-none"
            />
          ) : (
            <p className="text-xs text-slate-300 leading-relaxed">{b.explanation}</p>
          )}

          {/* Key Takeaway */}
          <div className="p-3 rounded-xl bg-indigo-900/30 border border-indigo-500/20 text-xs space-y-1">
            <span className="font-bold text-indigo-300 flex items-center gap-1.5 text-[11px] uppercase tracking-wider">
              <span>🎯</span> Key Takeaway
            </span>
            {isEditing ? (
              <input
                type="text"
                value={b.keyTakeaway}
                onChange={e => onChange({ ...b, keyTakeaway: e.target.value })}
                placeholder="Core rule or takeaway..."
                className="w-full bg-slate-900 border border-slate-700 px-2 py-1 rounded text-xs text-slate-100 focus:outline-none"
              />
            ) : (
              <p className="text-slate-200 font-medium">{b.keyTakeaway}</p>
            )}
          </div>
        </div>
      );
    }

    case 'formula': {
      const b = block as FormulaBlock;
      return (
        <div className="my-4 rounded-2xl border border-slate-700/60 bg-slate-950/60 p-5 space-y-3 relative group">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-xl bg-purple-500/20 text-purple-400 font-serif font-bold text-xs">
                ∑
              </span>
              <span className="text-xs font-bold text-purple-200">{b.name || 'Formula'}</span>
            </div>
            {!readOnly && (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => onOpenMathEditor && onOpenMathEditor(b.latex, b.name)}
                  className="px-2.5 py-1 rounded-lg bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-300 text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <Calculator className="w-3.5 h-3.5" />
                  <span>Edit in Math Builder</span>
                </button>
                {onDelete && (
                  <button
                    type="button"
                    onClick={onDelete}
                    className="p-1 rounded text-rose-400 hover:bg-rose-500/20 text-xs cursor-pointer ml-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )}
          </div>

          {/* KaTeX Vector Display */}
          <div className="py-4 px-6 bg-slate-900/60 rounded-xl border border-slate-800 flex items-center justify-center overflow-x-auto shadow-inner">
            <div ref={mathRef} className="text-xl sm:text-2xl text-slate-100" />
          </div>

          {/* Explanation if present */}
          {b.explanation && (
            <p className="text-xs text-slate-400 italic">{b.explanation}</p>
          )}

          {/* Variable definitions table if present */}
          {b.variables && b.variables.length > 0 && (
            <div className="overflow-x-auto pt-2">
              <table className="w-full text-[11px] border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 font-semibold text-left">
                    <th className="py-1 px-2">Symbol</th>
                    <th className="py-1 px-2">Quantity / Meaning</th>
                    <th className="py-1 px-2">SI Unit</th>
                  </tr>
                </thead>
                <tbody>
                  {b.variables.map((v, vIdx) => (
                    <tr key={vIdx} className="border-b border-slate-800/40 text-slate-300">
                      <td className="py-1 px-2 font-serif font-bold text-purple-300">${v.symbol}$</td>
                      <td className="py-1 px-2">{v.meaning}</td>
                      <td className="py-1 px-2 text-slate-400">{v.unit || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      );
    }

    case 'worked_example': {
      const b = block as WorkedExampleBlock;
      return (
        <div className="my-4 rounded-2xl border border-emerald-500/30 bg-emerald-950/20 p-5 space-y-3 relative group">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-xl bg-emerald-500/20 text-emerald-400">
                <GraduationCap className="w-4 h-4" />
              </span>
              <h4 className="text-xs font-bold text-emerald-300 uppercase tracking-wider">
                Worked Example
              </h4>
            </div>
            {!readOnly && (
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  type="button"
                  onClick={() => setIsEditing(!isEditing)}
                  className="p-1 rounded text-slate-400 hover:text-white hover:bg-white/10 text-xs cursor-pointer"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                </button>
                {onDelete && (
                  <button
                    type="button"
                    onClick={onDelete}
                    className="p-1 rounded text-rose-400 hover:bg-rose-500/20 text-xs cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Problem Statement */}
          <div className="space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Problem:</span>
            {isEditing ? (
              <textarea
                rows={2}
                value={b.problem}
                onChange={e => onChange({ ...b, problem: e.target.value })}
                className="w-full bg-slate-900 border border-slate-700 p-2 rounded text-xs text-white focus:outline-none"
              />
            ) : (
              <p className="text-xs font-medium text-slate-100">{b.problem}</p>
            )}
          </div>

          {/* Given & Required */}
          {(b.given || b.required || isEditing) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              {(b.given || isEditing) && (
                <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800">
                  <span className="text-[10px] font-bold text-slate-400 block mb-0.5">Given:</span>
                  {isEditing ? (
                    <input
                      type="text"
                      value={b.given || ''}
                      onChange={e => onChange({ ...b, given: e.target.value })}
                      className="w-full bg-transparent border-b border-slate-700 text-xs text-slate-200 focus:outline-none"
                    />
                  ) : (
                    <span className="text-slate-300">{b.given}</span>
                  )}
                </div>
              )}
              {(b.required || isEditing) && (
                <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800">
                  <span className="text-[10px] font-bold text-slate-400 block mb-0.5">Required:</span>
                  {isEditing ? (
                    <input
                      type="text"
                      value={b.required || ''}
                      onChange={e => onChange({ ...b, required: e.target.value })}
                      className="w-full bg-transparent border-b border-slate-700 text-xs text-slate-200 focus:outline-none"
                    />
                  ) : (
                    <span className="text-slate-300">{b.required}</span>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Solution Steps */}
          <div className="space-y-1.5 pt-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Solution Steps:</span>
            <div className="space-y-1.5">
              {(b.steps || []).map((step, idx) => (
                <div key={idx} className="flex items-start gap-2 text-xs text-slate-300">
                  <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
                    {idx + 1}
                  </span>
                  {isEditing ? (
                    <input
                      type="text"
                      value={step}
                      onChange={e => {
                        const newSteps = [...b.steps];
                        newSteps[idx] = e.target.value;
                        onChange({ ...b, steps: newSteps });
                      }}
                      className="flex-1 bg-slate-900 border border-slate-700 px-2 py-1 rounded text-xs text-slate-200 focus:outline-none"
                    />
                  ) : (
                    <p className="flex-1 leading-relaxed">{step}</p>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Final Answer */}
          {(b.finalAnswer || isEditing) && (
            <div className="p-3 rounded-xl bg-emerald-900/40 border border-emerald-500/30 flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-300">Final Answer:</span>
              {isEditing ? (
                <input
                  type="text"
                  value={b.finalAnswer}
                  onChange={e => onChange({ ...b, finalAnswer: e.target.value })}
                  className="bg-slate-900 border border-slate-700 px-2 py-1 rounded text-xs text-white font-bold focus:outline-none"
                />
              ) : (
                <span className="text-xs font-bold text-emerald-200 font-mono">{b.finalAnswer}</span>
              )}
            </div>
          )}
        </div>
      );
    }

    case 'definition': {
      const b = block as DefinitionBlock;
      return (
        <div className="my-4 rounded-2xl border border-sky-500/30 bg-sky-950/20 p-5 space-y-2 relative group">
          <div className="flex items-center justify-between">
            <div className="flex items-baseline gap-2">
              <span className="text-[11px] font-bold text-sky-400 uppercase tracking-wider flex items-center gap-1">
                <BookOpen className="w-3.5 h-3.5" />
                <span>Definition:</span>
              </span>
              {isEditing ? (
                <input
                  type="text"
                  value={b.term}
                  onChange={e => onChange({ ...b, term: e.target.value })}
                  placeholder="Term"
                  className="bg-slate-900 border border-slate-700 px-2 py-0.5 rounded text-xs font-bold text-white focus:outline-none"
                />
              ) : (
                <span className="text-sm font-bold text-sky-200">{b.term}</span>
              )}
              {b.pronunciation && (
                <span className="text-[11px] text-slate-400 italic">({b.pronunciation})</span>
              )}
            </div>
            {!readOnly && (
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  type="button"
                  onClick={() => setIsEditing(!isEditing)}
                  className="p-1 rounded text-slate-400 hover:text-white hover:bg-white/10 text-xs cursor-pointer"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                </button>
                {onDelete && (
                  <button
                    type="button"
                    onClick={onDelete}
                    className="p-1 rounded text-rose-400 hover:bg-rose-500/20 text-xs cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Definition Text */}
          {isEditing ? (
            <textarea
              rows={2}
              value={b.definition}
              onChange={e => onChange({ ...b, definition: e.target.value })}
              className="w-full bg-slate-900 border border-slate-700 p-2 rounded text-xs text-slate-200 focus:outline-none"
            />
          ) : (
            <p className="text-xs text-slate-300 leading-relaxed font-normal">{b.definition}</p>
          )}

          {b.context && (
            <p className="text-[11px] text-slate-400 italic pt-1">Context: {b.context}</p>
          )}
        </div>
      );
    }

    case 'callout': {
      const b = block as CalloutBlock;
      const isWarn = b.variant === 'warning' || b.variant === 'mistake';
      const isTip = b.variant === 'exam_tip';
      const borderClass = isWarn 
        ? 'border-amber-500/30 bg-amber-950/20' 
        : isTip 
        ? 'border-purple-500/30 bg-purple-950/20' 
        : 'border-blue-500/30 bg-blue-950/20';

      const icon = isWarn ? <AlertTriangle className="w-4 h-4 text-amber-400" /> : isTip ? <Target className="w-4 h-4 text-purple-400" /> : <Lightbulb className="w-4 h-4 text-blue-400" />;

      return (
        <div className={`my-4 rounded-2xl border ${borderClass} p-4 space-y-2 relative group`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {icon}
              <span className="text-xs font-bold text-slate-200">{b.title || 'Note'}</span>
            </div>
            {!readOnly && (
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  type="button"
                  onClick={() => setIsEditing(!isEditing)}
                  className="p-1 rounded text-slate-400 hover:text-white hover:bg-white/10 text-xs cursor-pointer"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                </button>
                {onDelete && (
                  <button
                    type="button"
                    onClick={onDelete}
                    className="p-1 rounded text-rose-400 hover:bg-rose-500/20 text-xs cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )}
          </div>
          {isEditing ? (
            <textarea
              rows={2}
              value={b.text}
              onChange={e => onChange({ ...b, text: e.target.value })}
              className="w-full bg-slate-900 border border-slate-700 p-2 rounded text-xs text-slate-200 focus:outline-none"
            />
          ) : (
            <p className="text-xs text-slate-300 leading-relaxed">{b.text}</p>
          )}
        </div>
      );
    }

    case 'recall_question': {
      const b = block as RecallQuestionBlock;
      const isRevealed = b.isRevealed ?? false;

      return (
        <div className="my-4 rounded-2xl border border-violet-500/30 bg-violet-950/20 p-5 space-y-3 relative group">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-xl bg-violet-500/20 text-violet-400">
                <HelpCircle className="w-4 h-4" />
              </span>
              <span className="text-xs font-bold text-violet-300 uppercase tracking-wider">
                Active Recall Self-Test
              </span>
            </div>
            {!readOnly && (
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  type="button"
                  onClick={() => setIsEditing(!isEditing)}
                  className="p-1 rounded text-slate-400 hover:text-white hover:bg-white/10 text-xs cursor-pointer"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                </button>
                {onDelete && (
                  <button
                    type="button"
                    onClick={onDelete}
                    className="p-1 rounded text-rose-400 hover:bg-rose-500/20 text-xs cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Question */}
          {isEditing ? (
            <textarea
              rows={2}
              value={b.question}
              onChange={e => onChange({ ...b, question: e.target.value })}
              placeholder="Question to test yourself..."
              className="w-full bg-slate-900 border border-slate-700 p-2 rounded text-xs text-white focus:outline-none"
            />
          ) : (
            <p className="text-xs font-semibold text-slate-100">{b.question}</p>
          )}

          {/* Answer Card with Reveal Toggle */}
          <div className="pt-1">
            {isRevealed ? (
              <div className="p-3.5 rounded-xl bg-slate-900/90 border border-violet-500/30 text-xs space-y-2 animate-in fade-in duration-200">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Answer
                  </span>
                  <button
                    type="button"
                    onClick={() => onChange({ ...b, isRevealed: false })}
                    className="text-[10px] text-slate-400 hover:text-slate-200 flex items-center gap-1 cursor-pointer"
                  >
                    <EyeOff className="w-3 h-3" /> Hide Answer
                  </button>
                </div>
                {isEditing ? (
                  <textarea
                    rows={2}
                    value={b.answer}
                    onChange={e => onChange({ ...b, answer: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 p-1.5 rounded text-xs text-slate-200 focus:outline-none"
                  />
                ) : (
                  <p className="text-slate-200 font-medium leading-relaxed">{b.answer}</p>
                )}
              </div>
            ) : (
              <button
                type="button"
                onClick={() => onChange({ ...b, isRevealed: true })}
                className="w-full py-2.5 px-4 rounded-xl bg-violet-600/20 hover:bg-violet-600/30 border border-violet-500/30 text-violet-300 text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm active:scale-98"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Test Yourself — Click to Reveal Answer</span>
              </button>
            )}
          </div>
        </div>
      );
    }

    case 'table': {
      return (
        <VisualTableEditor
          block={block as any}
          onChange={onChange as any}
          onDelete={onDelete}
          readOnly={readOnly}
        />
      );
    }

    case 'diagram': {
      const b = block as DiagramBlock;
      return (
        <div className="my-4 rounded-2xl border border-cyan-500/30 bg-cyan-950/20 p-5 space-y-3 relative group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-cyan-300 flex items-center gap-1.5">
              <span>📊</span> {b.title || 'Educational Flowchart / Diagram'}
            </span>
            {!readOnly && onDelete && (
              <button
                type="button"
                onClick={onDelete}
                className="p-1 rounded text-rose-400 hover:bg-rose-500/20 text-xs cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
            {(b.nodes || []).map((node, nIdx) => (
              <div key={nIdx} className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 text-xs space-y-1">
                <span className="font-bold text-slate-200 block">{node.label}</span>
                {node.details && <p className="text-[11px] text-slate-400">{node.details}</p>}
              </div>
            ))}
          </div>
        </div>
      );
    }

    case 'sketch': {
      const b = block as SketchBlock;
      return (
        <div className="my-4 rounded-2xl border border-slate-800 bg-slate-950/60 p-4 space-y-2 relative group text-center">
          <img 
            src={b.dataUrl} 
            alt={b.caption || 'Handwritten sketch'} 
            className="max-h-72 mx-auto rounded-xl shadow-md"
          />
          {b.caption && <p className="text-xs text-slate-400 italic">{b.caption}</p>}
          {!readOnly && onDelete && (
            <button
              type="button"
              onClick={onDelete}
              className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/60 text-rose-400 hover:bg-black/90 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      );
    }

    default:
      return null;
  }
};
