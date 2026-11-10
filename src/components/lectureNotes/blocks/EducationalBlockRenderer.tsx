import React, { useState, useEffect, useRef } from 'react';
import { 
  Lightbulb, 
  AlertTriangle, 
  HelpCircle, 
  BookOpen, 
  Target, 
  CheckCircle2, 
  Eye, 
  EyeOff, 
  Trash2, 
  Plus, 
  Calculator,
  GraduationCap,
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

export function isEducationalBlockEmpty(block: EducationalBlock): boolean {
  switch (block.type) {
    case 'concept':
      return !(block as ConceptBlock).title?.trim() && 
             !(block as ConceptBlock).explanation?.trim() && 
             !(block as ConceptBlock).keyTakeaway?.trim();
    case 'definition':
      return !(block as DefinitionBlock).term?.trim() && 
             !(block as DefinitionBlock).definition?.trim();
    case 'worked_example': {
      const b = block as WorkedExampleBlock;
      return !b.problem?.trim() && 
             (!b.steps || b.steps.every(s => !s.trim())) && 
             !b.finalAnswer?.trim();
    }
    case 'callout':
      return !(block as CalloutBlock).title?.trim() && 
             !(block as CalloutBlock).text?.trim();
    case 'recall_question':
      return !(block as RecallQuestionBlock).question?.trim() && 
             !(block as RecallQuestionBlock).answer?.trim();
    case 'formula':
      return !(block as FormulaBlock).latex?.trim() && 
             !(block as FormulaBlock).name?.trim();
    default:
      return false;
  }
}

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

  // Handle auto-cleanup on blur when leaving the entire block
  const handleContainerBlur = (e: React.FocusEvent<HTMLDivElement>) => {
    if (!readOnly && onDelete && !e.currentTarget.contains(e.relatedTarget as Node)) {
      if (isEducationalBlockEmpty(block)) {
        onDelete();
      }
    }
  };

  switch (block.type) {
    case 'concept': {
      const b = block as ConceptBlock;
      return (
        <div 
          onBlur={handleContainerBlur}
          className="my-3 rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-3 relative group transition-colors"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 flex-1">
              <span className="p-1 rounded-md bg-indigo-500/10 text-indigo-400">
                <Lightbulb className="w-3.5 h-3.5" />
              </span>
              {!readOnly ? (
                <input
                  type="text"
                  value={b.title}
                  onChange={e => onChange({ ...b, title: e.target.value })}
                  placeholder="Concept Title..."
                  className="bg-transparent border-b border-transparent focus:border-indigo-500/40 px-0 py-0.5 text-xs font-semibold text-white focus:outline-none flex-1"
                />
              ) : (
                <h4 className="text-xs font-semibold text-slate-100">{b.title || 'Core Concept'}</h4>
              )}
            </div>
            {!readOnly && onDelete && (
              <button
                type="button"
                onClick={onDelete}
                className="opacity-0 group-hover:opacity-100 p-1 rounded text-slate-500 hover:text-rose-400 text-xs cursor-pointer transition-opacity"
                title="Delete block"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Explanation */}
          {!readOnly ? (
            <textarea
              rows={Math.max(1, Math.ceil((b.explanation || '').length / 75))}
              value={b.explanation}
              onChange={e => onChange({ ...b, explanation: e.target.value })}
              placeholder="Write a clear explanation of this concept..."
              className="w-full bg-transparent border-none p-0 text-xs text-slate-300 leading-relaxed focus:outline-none resize-none font-sans"
            />
          ) : (
            <p className="text-xs text-slate-300 leading-relaxed font-sans">{b.explanation}</p>
          )}

          {/* Key Takeaway */}
          <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800/80 text-xs space-y-1">
            <span className="font-semibold text-indigo-300 text-[11px] block">
              Key Takeaway
            </span>
            {!readOnly ? (
              <input
                type="text"
                value={b.keyTakeaway}
                onChange={e => onChange({ ...b, keyTakeaway: e.target.value })}
                placeholder="Core rule or summary..."
                className="w-full bg-transparent border-none px-0 py-0.5 text-xs text-slate-200 focus:outline-none"
              />
            ) : (
              <p className="text-slate-200">{b.keyTakeaway}</p>
            )}
          </div>
        </div>
      );
    }

    case 'formula': {
      const b = block as FormulaBlock;
      return (
        <div 
          onBlur={handleContainerBlur}
          className="my-3 rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-3 relative group"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="p-1 rounded-md bg-purple-500/10 text-purple-400 font-serif font-bold text-xs">
                ∑
              </span>
              {!readOnly ? (
                <input
                  type="text"
                  value={b.name}
                  onChange={e => onChange({ ...b, name: e.target.value })}
                  placeholder="Formula Name..."
                  className="bg-transparent border-none p-0 text-xs font-semibold text-slate-200 focus:outline-none"
                />
              ) : (
                <span className="text-xs font-semibold text-slate-200">{b.name || 'Formula'}</span>
              )}
            </div>
            {!readOnly && (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => onOpenMathEditor && onOpenMathEditor(b.latex, b.name)}
                  className="px-2.5 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <Calculator className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Edit Equation</span>
                </button>
                {onDelete && (
                  <button
                    type="button"
                    onClick={onDelete}
                    className="opacity-0 group-hover:opacity-100 p-1 rounded text-slate-500 hover:text-rose-400 cursor-pointer transition-opacity"
                    title="Delete formula"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )}
          </div>

          {/* KaTeX Vector Display */}
          <div className="py-3 px-4 bg-slate-950 rounded-lg border border-slate-800/80 flex items-center justify-center overflow-x-auto min-h-[55px]">
            <div ref={mathRef} className="text-lg sm:text-xl text-slate-100" />
          </div>

          {/* Explanation if present */}
          {!readOnly ? (
            <input
              type="text"
              value={b.explanation || ''}
              onChange={e => onChange({ ...b, explanation: e.target.value })}
              placeholder="Context or derivation note (optional)..."
              className="w-full bg-transparent border-none p-0 text-xs text-slate-400 italic focus:outline-none"
            />
          ) : (
            b.explanation && <p className="text-xs text-slate-400 italic">{b.explanation}</p>
          )}

          {/* Variable definitions table */}
          {((b.variables && b.variables.length > 0) || !readOnly) && (
            <div className="overflow-x-auto pt-1 space-y-1.5">
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Variables:</span>
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 font-medium text-left text-[11px]">
                    <th className="py-1 px-2">Symbol</th>
                    <th className="py-1 px-2">Meaning</th>
                    <th className="py-1 px-2">Unit</th>
                    {!readOnly && <th className="w-6"></th>}
                  </tr>
                </thead>
                <tbody>
                  {(b.variables || []).map((v, vIdx) => (
                    <tr key={vIdx} className="border-b border-slate-800/40 text-slate-300">
                      <td className="py-1 px-2 font-serif font-semibold text-indigo-300">
                        {!readOnly ? (
                          <input
                            type="text"
                            value={v.symbol}
                            onChange={e => {
                              const newVars = [...b.variables];
                              newVars[vIdx].symbol = e.target.value;
                              onChange({ ...b, variables: newVars });
                            }}
                            className="bg-transparent border-none p-0 w-full focus:outline-none"
                          />
                        ) : (
                          v.symbol
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
                        ) : (
                          v.meaning
                        )}
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
                        ) : (
                          v.unit || '-'
                        )}
                      </td>
                      {!readOnly && (
                        <td className="py-1 px-1">
                          <button
                            type="button"
                            onClick={() => {
                              const newVars = b.variables.filter((_, idx) => idx !== vIdx);
                              onChange({ ...b, variables: newVars });
                            }}
                            className="p-0.5 rounded text-slate-500 hover:text-rose-400 cursor-pointer"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                  {!readOnly && (
                    <tr>
                      <td colSpan={4} className="pt-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            const newVars = [...(b.variables || []), { symbol: '', meaning: '', unit: '' }];
                            onChange({ ...b, variables: newVars });
                          }}
                          className="text-[11px] font-medium text-indigo-400 hover:text-indigo-300 flex items-center gap-1 cursor-pointer"
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
        <div 
          onBlur={handleContainerBlur}
          className="my-3 rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-3 relative group"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="p-1 rounded-md bg-emerald-500/10 text-emerald-400">
                <GraduationCap className="w-3.5 h-3.5" />
              </span>
              <h4 className="text-xs font-semibold text-slate-200">
                Worked Example
              </h4>
            </div>
            {!readOnly && onDelete && (
              <button
                type="button"
                onClick={onDelete}
                className="opacity-0 group-hover:opacity-100 p-1 rounded text-slate-500 hover:text-rose-400 text-xs cursor-pointer transition-opacity"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Problem Statement */}
          <div className="space-y-1">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Problem:</span>
            {!readOnly ? (
              <textarea
                rows={Math.max(1, Math.ceil((b.problem || '').length / 75))}
                value={b.problem}
                onChange={e => onChange({ ...b, problem: e.target.value })}
                placeholder="Enter problem statement..."
                className="w-full bg-transparent border-none p-0 text-xs text-slate-200 leading-relaxed focus:outline-none resize-none font-sans"
              />
            ) : (
              <p className="text-xs text-slate-200 leading-relaxed">{b.problem}</p>
            )}
          </div>

          {/* Given & Required */}
          {(!readOnly || b.given || b.required) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <div className="p-2 rounded-lg bg-slate-950 border border-slate-800">
                <span className="text-[10px] font-semibold text-slate-400 block mb-0.5">Given:</span>
                {!readOnly ? (
                  <input
                    type="text"
                    value={b.given || ''}
                    onChange={e => onChange({ ...b, given: e.target.value })}
                    placeholder="e.g. m = 5 kg, v = 10 m/s"
                    className="w-full bg-transparent border-none px-0 py-0.5 text-xs text-slate-200 focus:outline-none"
                  />
                ) : (
                  <span className="text-slate-300">{b.given}</span>
                )}
              </div>
              <div className="p-2 rounded-lg bg-slate-950 border border-slate-800">
                <span className="text-[10px] font-semibold text-slate-400 block mb-0.5">Required:</span>
                {!readOnly ? (
                  <input
                    type="text"
                    value={b.required || ''}
                    onChange={e => onChange({ ...b, required: e.target.value })}
                    placeholder="e.g. Centripetal Force (F_c)"
                    className="w-full bg-transparent border-none px-0 py-0.5 text-xs text-slate-200 focus:outline-none"
                  />
                ) : (
                  <span className="text-slate-300">{b.required}</span>
                )}
              </div>
            </div>
          )}

          {/* Solution Steps */}
          <div className="space-y-1.5 pt-1">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Solution Steps:</span>
            <div className="space-y-1.5">
              {(b.steps || []).map((step, idx) => (
                <div key={idx} className="flex items-start gap-2 text-xs text-slate-300 group/step">
                  <span className="w-4 h-4 rounded-full bg-slate-800 text-slate-300 flex items-center justify-center font-semibold text-[10px] shrink-0 mt-0.5">
                    {idx + 1}
                  </span>
                  {!readOnly ? (
                    <div className="flex-1 flex items-start gap-2">
                      <textarea
                        rows={Math.max(1, Math.ceil((step || '').length / 70))}
                        value={step}
                        onChange={e => {
                          const newSteps = [...b.steps];
                          newSteps[idx] = e.target.value;
                          onChange({ ...b, steps: newSteps });
                        }}
                        placeholder={`Step ${idx + 1}...`}
                        className="flex-1 bg-transparent border-none p-0 text-xs text-slate-200 focus:outline-none resize-none"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const newSteps = b.steps.filter((_, i) => i !== idx);
                          onChange({ ...b, steps: newSteps });
                        }}
                        className="opacity-0 group-hover/step:opacity-100 p-0.5 rounded text-slate-500 hover:text-rose-400 transition-opacity cursor-pointer"
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
                  className="text-[11px] font-medium text-emerald-400 hover:text-emerald-300 flex items-center gap-1 ml-6 cursor-pointer"
                >
                  <Plus className="w-3 h-3" /> Add Step
                </button>
              )}
            </div>
          </div>

          {/* Final Answer */}
          {(!readOnly || b.finalAnswer) && (
            <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-300">Final Result:</span>
              {!readOnly ? (
                <input
                  type="text"
                  value={b.finalAnswer}
                  onChange={e => onChange({ ...b, finalAnswer: e.target.value })}
                  placeholder="e.g. 50 N"
                  className="bg-transparent border-none p-0 text-right text-xs text-emerald-300 font-semibold focus:outline-none"
                />
              ) : (
                <span className="font-semibold text-emerald-300 font-mono">{b.finalAnswer}</span>
              )}
            </div>
          )}
        </div>
      );
    }

    case 'definition': {
      const b = block as DefinitionBlock;
      return (
        <div 
          onBlur={handleContainerBlur}
          className="my-3 rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-2 relative group"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-baseline gap-2 flex-1">
              <span className="text-[11px] font-semibold text-sky-400 uppercase tracking-wider flex items-center gap-1 shrink-0">
                <BookOpen className="w-3.5 h-3.5" />
                <span>Definition:</span>
              </span>
              {!readOnly ? (
                <div className="flex items-center gap-2 flex-1">
                  <input
                    type="text"
                    value={b.term}
                    onChange={e => onChange({ ...b, term: e.target.value })}
                    placeholder="Term..."
                    className="bg-transparent border-none p-0 text-xs font-semibold text-sky-200 focus:outline-none flex-1"
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
                  <span className="text-xs font-semibold text-sky-200">{b.term}</span>
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
                className="opacity-0 group-hover:opacity-100 p-1 rounded text-slate-500 hover:text-rose-400 text-xs cursor-pointer transition-opacity"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Definition Text */}
          {!readOnly ? (
            <textarea
              rows={Math.max(1, Math.ceil((b.definition || '').length / 75))}
              value={b.definition}
              onChange={e => onChange({ ...b, definition: e.target.value })}
              placeholder="Formal definition..."
              className="w-full bg-transparent border-none p-0 text-xs text-slate-300 focus:outline-none resize-none font-sans"
            />
          ) : (
            <p className="text-xs text-slate-300 leading-relaxed font-sans">{b.definition}</p>
          )}

          {/* Context */}
          {!readOnly ? (
            <div className="flex items-center gap-1 pt-1 border-t border-slate-800/80">
              <span className="text-[10px] text-slate-500 font-medium uppercase shrink-0">Context:</span>
              <input
                type="text"
                value={b.context || ''}
                onChange={e => onChange({ ...b, context: e.target.value })}
                placeholder="Field or subject context..."
                className="bg-transparent border-none p-0 text-[11px] text-slate-400 italic focus:outline-none w-full"
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

      return (
        <div 
          onBlur={handleContainerBlur}
          className="my-3 rounded-xl border border-slate-800 bg-slate-900/60 p-3.5 space-y-2 relative group"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 flex-1">
              {isWarn ? (
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              ) : isTip ? (
                <Target className="w-3.5 h-3.5 text-purple-400 shrink-0" />
              ) : (
                <Lightbulb className="w-3.5 h-3.5 text-blue-400 shrink-0" />
              )}
              {!readOnly ? (
                <div className="flex items-center gap-2 flex-1">
                  <input
                    type="text"
                    value={b.title}
                    onChange={e => onChange({ ...b, title: e.target.value })}
                    placeholder="Callout Title..."
                    className="bg-transparent border-none p-0 text-xs font-semibold text-slate-200 focus:outline-none flex-1"
                  />
                  <select
                    value={b.variant}
                    onChange={e => onChange({ ...b, variant: e.target.value as any })}
                    className="bg-slate-950 text-[10px] text-slate-400 rounded px-1.5 py-0.5 border border-slate-800 focus:outline-none cursor-pointer"
                  >
                    <option value="info">Info</option>
                    <option value="warning">Warning</option>
                    <option value="exam_tip">Exam Tip</option>
                    <option value="mistake">Common Mistake</option>
                  </select>
                </div>
              ) : (
                <span className="text-xs font-semibold text-slate-200">{b.title || 'Note'}</span>
              )}
            </div>
            {!readOnly && onDelete && (
              <button
                type="button"
                onClick={onDelete}
                className="opacity-0 group-hover:opacity-100 p-1 rounded text-slate-500 hover:text-rose-400 text-xs cursor-pointer transition-opacity"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          {!readOnly ? (
            <textarea
              rows={Math.max(1, Math.ceil((b.text || '').length / 75))}
              value={b.text}
              onChange={e => onChange({ ...b, text: e.target.value })}
              placeholder="Enter note or warning details..."
              className="w-full bg-transparent border-none p-0 text-xs text-slate-300 leading-relaxed focus:outline-none resize-none font-sans"
            />
          ) : (
            <p className="text-xs text-slate-300 leading-relaxed font-sans">{b.text}</p>
          )}
        </div>
      );
    }

    case 'recall_question': {
      const b = block as RecallQuestionBlock;
      const isRevealed = b.isRevealed ?? false;

      return (
        <div 
          onBlur={handleContainerBlur}
          className="my-3 rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-3 relative group"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="p-1 rounded-md bg-violet-500/10 text-violet-400">
                <HelpCircle className="w-3.5 h-3.5" />
              </span>
              <span className="text-xs font-semibold text-slate-200">
                Active Recall Self-Test
              </span>
            </div>
            {!readOnly && onDelete && (
              <button
                type="button"
                onClick={onDelete}
                className="opacity-0 group-hover:opacity-100 p-1 rounded text-slate-500 hover:text-rose-400 text-xs cursor-pointer transition-opacity"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Question */}
          {!readOnly ? (
            <textarea
              rows={Math.max(1, Math.ceil((b.question || '').length / 75))}
              value={b.question}
              onChange={e => onChange({ ...b, question: e.target.value })}
              placeholder="Question to test yourself..."
              className="w-full bg-transparent border-none p-0 text-xs text-white focus:outline-none resize-none font-medium"
            />
          ) : (
            <p className="text-xs font-medium text-slate-100">{b.question}</p>
          )}

          {/* Answer Card with Reveal Toggle */}
          <div className="pt-1">
            {isRevealed || !readOnly ? (
              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 text-xs space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-semibold text-emerald-400 uppercase tracking-wider flex items-center gap-1">
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
                    rows={Math.max(1, Math.ceil((b.answer || '').length / 75))}
                    value={b.answer}
                    onChange={e => onChange({ ...b, answer: e.target.value })}
                    placeholder="Write the correct answer here..."
                    className="w-full bg-transparent border-none p-0 text-xs text-slate-200 focus:outline-none resize-none"
                  />
                ) : (
                  <p className="text-slate-200 leading-relaxed">{b.answer}</p>
                )}
              </div>
            ) : (
              <button
                type="button"
                onClick={() => onChange({ ...b, isRevealed: true })}
                className="w-full py-2 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <Eye className="w-3.5 h-3.5 text-violet-400" />
                <span>Click to Reveal Answer</span>
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
        <div className="my-3 rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-3 relative group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-200">
              {b.title || 'Process Diagram'}
            </span>
            {!readOnly && onDelete && (
              <button
                type="button"
                onClick={onDelete}
                className="p-1 rounded text-slate-500 hover:text-rose-400 text-xs cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
            {(b.nodes || []).map((node, nIdx) => (
              <div key={nIdx} className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-xs space-y-1">
                <span className="font-semibold text-slate-200 block">{node.label}</span>
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
        <div className="my-3 rounded-xl border border-slate-800 bg-slate-900/60 p-3 space-y-2 relative group text-center">
          <img 
            src={b.dataUrl} 
            alt={b.caption || 'Handwritten sketch'} 
            className="max-h-72 mx-auto rounded-lg shadow-sm"
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
              className="absolute top-2 right-2 p-1 rounded-md bg-slate-900/80 text-slate-400 hover:text-rose-400 cursor-pointer"
              title="Remove sketch"
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
