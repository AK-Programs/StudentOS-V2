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
  Sparkles,
  X
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
              {!readOnly ? (
                <input
                  type="text"
                  value={b.title}
                  onChange={e => onChange({ ...b, title: e.target.value })}
                  placeholder="Enter Concept Title..."
                  className="bg-transparent border-b border-transparent focus:border-indigo-500/50 px-0 py-0.5 text-sm font-bold text-white focus:outline-none w-full"
                />
              ) : (
                <h4 className="text-sm font-bold text-indigo-200">{b.title || 'Core Concept'}</h4>
              )}
            </div>
            {!readOnly && onDelete && (
              <button
                type="button"
                onClick={onDelete}
                className="opacity-0 group-hover:opacity-100 p-1 rounded text-rose-400 hover:bg-rose-500/20 text-xs cursor-pointer transition-opacity"
                title="Delete block"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Explanation */}
          {!readOnly ? (
            <textarea
              rows={Math.max(1, Math.ceil((b.explanation || '').length / 60))}
              value={b.explanation}
              onChange={e => onChange({ ...b, explanation: e.target.value })}
              placeholder="Write a detailed explanation of the concept..."
              className="w-full bg-transparent border-none p-0 text-xs text-slate-200 focus:outline-none resize-none"
            />
          ) : (
            <p className="text-xs text-slate-300 leading-relaxed">{b.explanation}</p>
          )}

          {/* Key Takeaway */}
          <div className="p-3 rounded-xl bg-indigo-900/30 border border-indigo-500/20 text-xs space-y-1">
            <span className="font-bold text-indigo-300 flex items-center gap-1.5 text-[11px] uppercase tracking-wider">
              <span>🎯</span> Key Takeaway
            </span>
            {!readOnly ? (
              <input
                type="text"
                value={b.keyTakeaway}
                onChange={e => onChange({ ...b, keyTakeaway: e.target.value })}
                placeholder="Enter the core rule or key takeaway..."
                className="w-full bg-transparent border-none px-0 py-0.5 text-xs text-slate-100 focus:outline-none"
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
              {!readOnly ? (
                <input
                  type="text"
                  value={b.name}
                  onChange={e => onChange({ ...b, name: e.target.value })}
                  placeholder="Formula Name..."
                  className="bg-transparent border-none p-0 text-xs font-bold text-purple-200 focus:outline-none"
                />
              ) : (
                <span className="text-xs font-bold text-purple-200">{b.name || 'Formula'}</span>
              )}
            </div>
            {!readOnly && (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => onOpenMathEditor && onOpenMathEditor(b.latex, b.name)}
                  className="px-2.5 py-1 rounded-lg bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-300 text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <Calculator className="w-3.5 h-3.5" />
                  <span>Edit LaTeX</span>
                </button>
                {onDelete && (
                  <button
                    type="button"
                    onClick={onDelete}
                    className="opacity-0 group-hover:opacity-100 p-1 rounded text-rose-400 hover:bg-rose-500/20 text-xs cursor-pointer ml-1 transition-opacity"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )}
          </div>

          {/* KaTeX Vector Display */}
          <div className="py-4 px-6 bg-slate-900/60 rounded-xl border border-slate-800 flex items-center justify-center overflow-x-auto shadow-inner min-h-[60px]">
            <div ref={mathRef} className="text-xl sm:text-2xl text-slate-100" />
          </div>

          {/* Explanation if present */}
          {!readOnly ? (
            <input
              type="text"
              value={b.explanation || ''}
              onChange={e => onChange({ ...b, explanation: e.target.value })}
              placeholder="Short derivation or context note (optional)..."
              className="w-full bg-transparent border-none p-0 text-xs text-slate-400 italic focus:outline-none"
            />
          ) : (
            b.explanation && <p className="text-xs text-slate-400 italic">{b.explanation}</p>
          )}

          {/* Variable definitions table */}
          {(b.variables && b.variables.length > 0 || !readOnly) && (
            <div className="overflow-x-auto pt-2 space-y-2">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-2">Variables:</span>
              <table className="w-full text-[11px] border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 font-semibold text-left">
                    <th className="py-1 px-2">Symbol</th>
                    <th className="py-1 px-2">Meaning</th>
                    <th className="py-1 px-2">SI Unit</th>
                    {!readOnly && <th className="w-8"></th>}
                  </tr>
                </thead>
                <tbody>
                  {(b.variables || []).map((v, vIdx) => (
                    <tr key={vIdx} className="border-b border-slate-800/40 text-slate-300">
                      <td className="py-1 px-2 font-serif">
                        {!readOnly ? (
                          <input
                            type="text"
                            value={v.symbol}
                            onChange={e => {
                              const newVars = [...b.variables];
                              newVars[vIdx].symbol = e.target.value;
                              onChange({ ...b, variables: newVars });
                            }}
                            className="bg-transparent border-none p-0 w-full font-bold text-purple-300 focus:outline-none"
                          />
                        ) : (
                          <span className="font-bold text-purple-300">${v.symbol}$</span>
                        )}
                      </td>
                      <td className="py-1 px-2">
                        {!readOnly ? (
                          <input
                            type="text"
                            value={v.meaning}
                            onChange={e => {
                              const newVars = [...b.variables];
                              newVars[vIdx].meaning = e.target.value;
                              onChange({ ...b, variables: newVars });
                            }}
                            className="bg-transparent border-none p-0 w-full focus:outline-none"
                          />
                        ) : v.meaning}
                      </td>
                      <td className="py-1 px-2 text-slate-400">
                        {!readOnly ? (
                          <input
                            type="text"
                            value={v.unit || ''}
                            onChange={e => {
                              const newVars = [...b.variables];
                              newVars[vIdx].unit = e.target.value;
                              onChange({ ...b, variables: newVars });
                            }}
                            placeholder="-"
                            className="bg-transparent border-none p-0 w-full focus:outline-none"
                          />
                        ) : (v.unit || '-')}
                      </td>
                      {!readOnly && (
                        <td className="py-1 px-1">
                          <button
                            type="button"
                            onClick={() => {
                              const newVars = b.variables.filter((_, idx) => idx !== vIdx);
                              onChange({ ...b, variables: newVars });
                            }}
                            className="p-1 rounded text-slate-600 hover:text-rose-400"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                  {!readOnly && (
                    <tr>
                      <td colSpan={4} className="pt-2">
                        <button
                          type="button"
                          onClick={() => {
                            const newVars = [...(b.variables || []), { symbol: '', meaning: '', unit: '' }];
                            onChange({ ...b, variables: newVars });
                          }}
                          className="text-[10px] font-bold text-indigo-400 hover:text-indigo-300 flex items-center gap-1 px-2"
                        >
                          <Plus className="w-3 h-3" /> Add Variable
                        </button>
                      </td>
                    </tr>
                  )}
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
            {!readOnly && onDelete && (
              <button
                type="button"
                onClick={onDelete}
                className="opacity-0 group-hover:opacity-100 p-1 rounded text-rose-400 hover:bg-rose-500/20 text-xs cursor-pointer transition-opacity"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Problem Statement */}
          <div className="space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Problem Statement:</span>
            {!readOnly ? (
              <textarea
                rows={Math.max(1, Math.ceil((b.problem || '').length / 70))}
                value={b.problem}
                onChange={e => onChange({ ...b, problem: e.target.value })}
                placeholder="Enter the problem statement here..."
                className="w-full bg-transparent border-none p-0 text-xs font-medium text-slate-100 focus:outline-none resize-none"
              />
            ) : (
              <p className="text-xs font-medium text-slate-100">{b.problem}</p>
            )}
          </div>

          {/* Given & Required */}
          {!readOnly || b.given || b.required ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800">
                <span className="text-[10px] font-bold text-slate-400 block mb-0.5 uppercase tracking-tighter">Given:</span>
                {!readOnly ? (
                  <input
                    type="text"
                    value={b.given || ''}
                    onChange={e => onChange({ ...b, given: e.target.value })}
                    placeholder="e.g. m = 5kg, v = 10m/s"
                    className="w-full bg-transparent border-none px-0 py-0.5 text-xs text-slate-200 focus:outline-none"
                  />
                ) : (
                  <span className="text-slate-300">{b.given}</span>
                )}
              </div>
              <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800">
                <span className="text-[10px] font-bold text-slate-400 block mb-0.5 uppercase tracking-tighter">Required:</span>
                {!readOnly ? (
                  <input
                    type="text"
                    value={b.required || ''}
                    onChange={e => onChange({ ...b, required: e.target.value })}
                    placeholder="e.g. Find net force (F)"
                    className="w-full bg-transparent border-none px-0 py-0.5 text-xs text-slate-200 focus:outline-none"
                  />
                ) : (
                  <span className="text-slate-300">{b.required}</span>
                )}
              </div>
            </div>
          ) : null}

          {/* Solution Steps */}
          <div className="space-y-1.5 pt-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Step-by-Step Solution:</span>
            <div className="space-y-1.5">
              {(b.steps || []).map((step, idx) => (
                <div key={idx} className="flex items-start gap-2 text-xs text-slate-300 group/step">
                  <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
                    {idx + 1}
                  </span>
                  {!readOnly ? (
                    <div className="flex-1 flex items-start gap-2">
                      <textarea
                        rows={Math.max(1, Math.ceil((step || '').length / 60))}
                        value={step}
                        onChange={e => {
                          const newSteps = [...b.steps];
                          newSteps[idx] = e.target.value;
                          onChange({ ...b, steps: newSteps });
                        }}
                        placeholder={`Explain step ${idx + 1}...`}
                        className="flex-1 bg-transparent border-none p-0 text-xs text-slate-200 focus:outline-none resize-none"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const newSteps = b.steps.filter((_, i) => i !== idx);
                          onChange({ ...b, steps: newSteps });
                        }}
                        className="opacity-0 group-hover/step:opacity-100 p-1 rounded text-slate-600 hover:text-rose-400 transition-opacity"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <p className="flex-1 leading-relaxed">{step}</p>
                  )}
                </div>
              ))}
              {!readOnly && (
                <button
                  type="button"
                  onClick={() => {
                    const newSteps = [...(b.steps || []), ''];
                    onChange({ ...b, steps: newSteps });
                  }}
                  className="text-[10px] font-bold text-emerald-400 hover:text-emerald-300 flex items-center gap-1 ml-7 px-0"
                >
                  <Plus className="w-3 h-3" /> Add Next Step
                </button>
              )}
            </div>
          </div>

          {/* Final Answer */}
          {!readOnly || b.finalAnswer ? (
            <div className="p-3 rounded-xl bg-emerald-900/40 border border-emerald-500/30 flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-300">Final Result:</span>
              {!readOnly ? (
                <input
                  type="text"
                  value={b.finalAnswer}
                  onChange={e => onChange({ ...b, finalAnswer: e.target.value })}
                  placeholder="Enter final answer..."
                  className="bg-transparent border-none p-0 text-right text-xs text-white font-bold focus:outline-none"
                />
              ) : (
                <span className="text-xs font-bold text-emerald-200 font-mono">{b.finalAnswer}</span>
              )}
            </div>
          ) : null}
        </div>
      );
    }

    case 'definition': {
      const b = block as DefinitionBlock;
      return (
        <div className="my-4 rounded-2xl border border-sky-500/30 bg-sky-950/20 p-5 space-y-2 relative group">
          <div className="flex items-center justify-between">
            <div className="flex items-baseline gap-2 flex-1">
              <span className="text-[11px] font-bold text-sky-400 uppercase tracking-wider flex items-center gap-1 shrink-0">
                <BookOpen className="w-3.5 h-3.5" />
                <span>Definition:</span>
              </span>
              {!readOnly ? (
                <div className="flex items-center gap-2 flex-1">
                  <input
                    type="text"
                    value={b.term}
                    onChange={e => onChange({ ...b, term: e.target.value })}
                    placeholder="Enter Term..."
                    className="bg-transparent border-none p-0 text-sm font-bold text-sky-200 focus:outline-none flex-1"
                  />
                  <input
                    type="text"
                    value={b.pronunciation || ''}
                    onChange={e => onChange({ ...b, pronunciation: e.target.value })}
                    placeholder="(pronunciation)"
                    className="bg-transparent border-none p-0 text-[10px] text-slate-500 italic focus:outline-none w-24 text-right"
                  />
                </div>
              ) : (
                <>
                  <span className="text-sm font-bold text-sky-200">{b.term}</span>
                  {b.pronunciation && (
                    <span className="text-[11px] text-slate-400 italic">({b.pronunciation})</span>
                  )}
                </>
              )}
            </div>
            {!readOnly && onDelete && (
              <button
                type="button"
                onClick={onDelete}
                className="opacity-0 group-hover:opacity-100 p-1 rounded text-rose-400 hover:bg-rose-500/20 text-xs cursor-pointer transition-opacity"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Definition Text */}
          {!readOnly ? (
            <textarea
              rows={Math.max(1, Math.ceil((b.definition || '').length / 70))}
              value={b.definition}
              onChange={e => onChange({ ...b, definition: e.target.value })}
              placeholder="Write the formal academic definition..."
              className="w-full bg-transparent border-none p-0 text-xs text-slate-200 focus:outline-none resize-none"
            />
          ) : (
            <p className="text-xs text-slate-300 leading-relaxed font-normal">{b.definition}</p>
          )}

          {/* Context */}
          {!readOnly ? (
            <div className="flex items-center gap-1 pt-1 border-t border-white/5">
              <span className="text-[10px] text-slate-500 font-bold uppercase shrink-0">Context:</span>
              <input
                type="text"
                value={b.context || ''}
                onChange={e => onChange({ ...b, context: e.target.value })}
                placeholder="Field of study or context..."
                className="bg-transparent border-none p-0 text-[10px] text-slate-400 italic focus:outline-none w-full"
              />
            </div>
          ) : (
            b.context && <p className="text-[11px] text-slate-400 italic pt-1">Context: {b.context}</p>
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
            <div className="flex items-center gap-2 flex-1">
              {icon}
              {!readOnly ? (
                <div className="flex items-center gap-2 flex-1">
                  <input
                    type="text"
                    value={b.title}
                    onChange={e => onChange({ ...b, title: e.target.value })}
                    placeholder="Callout Title..."
                    className="bg-transparent border-none p-0 text-xs font-bold text-slate-200 focus:outline-none flex-1"
                  />
                  <select
                    value={b.variant}
                    onChange={e => onChange({ ...b, variant: e.target.value as any })}
                    className="bg-slate-950/60 text-[9px] font-bold text-slate-400 rounded px-1 py-0.5 border border-white/10 focus:outline-none"
                  >
                    <option value="info">Info</option>
                    <option value="warning">Warning</option>
                    <option value="exam_tip">Exam Tip</option>
                    <option value="mistake">Common Mistake</option>
                  </select>
                </div>
              ) : (
                <span className="text-xs font-bold text-slate-200">{b.title || 'Note'}</span>
              )}
            </div>
            {!readOnly && onDelete && (
              <button
                type="button"
                onClick={onDelete}
                className="opacity-0 group-hover:opacity-100 p-1 rounded text-rose-400 hover:bg-rose-500/20 text-xs cursor-pointer transition-opacity"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          {!readOnly ? (
            <textarea
              rows={Math.max(1, Math.ceil((b.text || '').length / 70))}
              value={b.text}
              onChange={e => onChange({ ...b, text: e.target.value })}
              placeholder="Enter details..."
              className="w-full bg-transparent border-none p-0 text-xs text-slate-200 focus:outline-none resize-none"
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
            {!readOnly && onDelete && (
              <button
                type="button"
                onClick={onDelete}
                className="opacity-0 group-hover:opacity-100 p-1 rounded text-rose-400 hover:bg-rose-500/20 text-xs cursor-pointer transition-opacity"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Question */}
          {!readOnly ? (
            <textarea
              rows={Math.max(1, Math.ceil((b.question || '').length / 70))}
              value={b.question}
              onChange={e => onChange({ ...b, question: e.target.value })}
              placeholder="Question to test yourself..."
              className="w-full bg-transparent border-none p-0 text-xs text-white focus:outline-none resize-none font-semibold"
            />
          ) : (
            <p className="text-xs font-semibold text-slate-100">{b.question}</p>
          )}

          {/* Answer Card with Reveal Toggle */}
          <div className="pt-1">
            {isRevealed || !readOnly ? (
              <div className={`p-3.5 rounded-xl bg-slate-900/90 border border-violet-500/30 text-xs space-y-2 animate-in fade-in duration-200 ${!readOnly ? 'ring-1 ring-violet-500/20' : ''}`}>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Answer
                  </span>
                  {readOnly && (
                    <button
                      type="button"
                      onClick={() => onChange({ ...b, isRevealed: false })}
                      className="text-[10px] text-slate-400 hover:text-slate-200 flex items-center gap-1 cursor-pointer"
                    >
                      <EyeOff className="w-3 h-3" /> Hide Answer
                    </button>
                  )}
                </div>
                {!readOnly ? (
                  <textarea
                    rows={Math.max(1, Math.ceil((b.answer || '').length / 70))}
                    value={b.answer}
                    onChange={e => onChange({ ...b, answer: e.target.value })}
                    placeholder="Write the correct answer here..."
                    className="w-full bg-transparent border-none p-0 text-xs text-slate-200 focus:outline-none resize-none"
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
          {!readOnly ? (
            <input
              type="text"
              value={b.caption || ''}
              onChange={e => onChange({ ...b, caption: e.target.value })}
              placeholder="Add caption..."
              className="bg-transparent border-none p-0 text-xs text-slate-400 italic focus:outline-none w-full text-center"
            />
          ) : (
            b.caption && <p className="text-xs text-slate-400 italic">{b.caption}</p>
          )}
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
