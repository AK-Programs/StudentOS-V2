import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  Check, 
  Code2, 
  Sparkles, 
  Calculator, 
  ChevronRight,
  ChevronDown,
  RotateCcw,
  BookOpen
} from 'lucide-react';
import katex from 'katex';

interface VisualMathEditorModalProps {
  isOpen: boolean;
  initialLatex?: string;
  initialName?: string;
  onClose: () => void;
  onSave: (latex: string, name?: string) => void;
}

interface MathItem {
  label: string;
  latexSnippet: string;
  desc?: string;
  cursorOffset?: number;
}

// Visual Structure Templates
const STRUCTURE_TEMPLATES: MathItem[] = [
  { label: 'Fraction', latexSnippet: '\\frac{a}{b}', desc: 'Fraction (a/b)', cursorOffset: 6 },
  { label: 'Power xⁿ', latexSnippet: 'x^{2}', desc: 'Superscript / Power', cursorOffset: 3 },
  { label: 'Subscript xᵢ', latexSnippet: 'x_{i}', desc: 'Subscript index', cursorOffset: 3 },
  { label: 'Super+Sub xᵢⁿ', latexSnippet: 'x_{i}^{2}', desc: 'Subscript & Superscript', cursorOffset: 3 },
  { label: 'Square Root √x', latexSnippet: '\\sqrt{x}', desc: 'Square Root', cursorOffset: 7 },
  { label: 'N-th Root ⁿ√x', latexSnippet: '\\sqrt[n]{x}', desc: 'N-th Root', cursorOffset: 7 },
  { label: 'Parentheses (x)', latexSnippet: '\\left( x \\right)', desc: 'Scaled Parentheses', cursorOffset: 7 },
  { label: 'Brackets [x]', latexSnippet: '\\left[ x \\right]', desc: 'Scaled Square Brackets', cursorOffset: 7 },
  { label: 'Absolute |x|', latexSnippet: '\\left| x \\right|', desc: 'Absolute Value', cursorOffset: 7 },
];

// Presets for rapid educational note taking
const EQUATION_PRESETS: { name: string; latex: string }[] = [
  { name: 'Centripetal Force', latex: 'F_c = \\frac{m v^2}{r}' },
  { name: 'Newton\'s Gravity', latex: 'F = G \\frac{m_1 m_2}{r^2}' },
  { name: 'Kinetic Energy', latex: 'E_k = \\frac{1}{2} m v^2' },
  { name: 'Einstein Mass-Energy', latex: 'E = m c^2' },
  { name: 'Quadratic Formula', latex: 'x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}' },
  { name: 'Wave Speed', latex: 'v = f \\lambda' },
  { name: 'Ohm\'s Law', latex: 'V = I \\cdot R' },
];

const SYMBOL_CATEGORIES: { id: string; name: string; items: MathItem[] }[] = [
  {
    id: 'arithmetic',
    name: 'Arithmetic & Relations',
    items: [
      { label: '±', latexSnippet: '\\pm ', desc: 'Plus-minus' },
      { label: '×', latexSnippet: '\\times ', desc: 'Multiply' },
      { label: '·', latexSnippet: '\\cdot ', desc: 'Dot product' },
      { label: '÷', latexSnippet: '\\div ', desc: 'Divide' },
      { label: '=', latexSnippet: ' = ', desc: 'Equals' },
      { label: '≠', latexSnippet: '\\neq ', desc: 'Not equal' },
      { label: '≈', latexSnippet: '\\approx ', desc: 'Approximately' },
      { label: '≤', latexSnippet: '\\le ', desc: 'Less than or equal' },
      { label: '≥', latexSnippet: '\\ge ', desc: 'Greater than or equal' },
      { label: '<', latexSnippet: ' < ', desc: 'Less than' },
      { label: '>', latexSnippet: ' > ', desc: 'Greater than' },
      { label: '∝', latexSnippet: '\\propto ', desc: 'Proportional to' },
      { label: '∞', latexSnippet: '\\infty ', desc: 'Infinity' },
      { label: '%', latexSnippet: '\\% ', desc: 'Percent' },
    ]
  },
  {
    id: 'greek',
    name: 'Greek Letters',
    items: [
      { label: 'α', latexSnippet: '\\alpha ', desc: 'Alpha' },
      { label: 'β', latexSnippet: '\\beta ', desc: 'Beta' },
      { label: 'γ', latexSnippet: '\\gamma ', desc: 'Gamma' },
      { label: 'δ', latexSnippet: '\\delta ', desc: 'Delta' },
      { label: 'θ', latexSnippet: '\\theta ', desc: 'Theta' },
      { label: 'λ', latexSnippet: '\\lambda ', desc: 'Lambda' },
      { label: 'μ', latexSnippet: '\\mu ', desc: 'Mu' },
      { label: 'π', latexSnippet: '\\pi ', desc: 'Pi' },
      { label: 'ρ', latexSnippet: '\\rho ', desc: 'Rho' },
      { label: 'σ', latexSnippet: '\\sigma ', desc: 'Sigma' },
      { label: 'τ', latexSnippet: '\\tau ', desc: 'Tau' },
      { label: 'φ', latexSnippet: '\\phi ', desc: 'Phi' },
      { label: 'ω', latexSnippet: '\\omega ', desc: 'Omega' },
      { label: 'Δ', latexSnippet: '\\Delta ', desc: 'Capital Delta' },
      { label: 'Ω', latexSnippet: '\\Omega ', desc: 'Capital Omega' },
    ]
  },
  {
    id: 'calculus',
    name: 'Calculus & Physics',
    items: [
      { label: '∫ dx', latexSnippet: '\\int_{a}^{b} f(x)\\,dx', desc: 'Definite integral', cursorOffset: 12 },
      { label: '∑', latexSnippet: '\\sum_{i=1}^{n} a_i', desc: 'Summation', cursorOffset: 7 },
      { label: '∏', latexSnippet: '\\prod_{i=1}^{n} x_i', desc: 'Product', cursorOffset: 7 },
      { label: 'lim', latexSnippet: '\\lim_{x \\to 0} f(x)', desc: 'Limit', cursorOffset: 7 },
      { label: 'df/dx', latexSnippet: '\\frac{df}{dx}', desc: 'Derivative' },
      { label: '∂f/∂x', latexSnippet: '\\frac{\\partial f}{\\partial x}', desc: 'Partial derivative' },
      { label: '∇', latexSnippet: '\\nabla ', desc: 'Nabla / Del' },
      { label: 'Δx', latexSnippet: '\\Delta x', desc: 'Change in x' },
      { label: 'v⃗', latexSnippet: '\\vec{v}', desc: 'Vector', cursorOffset: 5 },
    ]
  }
];

export const VisualMathEditorModal: React.FC<VisualMathEditorModalProps> = ({
  isOpen,
  initialLatex = '',
  initialName = '',
  onClose,
  onSave
}) => {
  const [latex, setLatex] = useState(initialLatex || 'F_c = \\frac{m v^2}{r}');
  const [equationName, setEquationName] = useState(initialName || '');
  const [activeCategory, setActiveCategory] = useState<string>('arithmetic');
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [showAdvancedLatex, setShowAdvancedLatex] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      setLatex(initialLatex || 'F_c = \\frac{m v^2}{r}');
      setEquationName(initialName || '');
      setShowAdvancedLatex(false);
    }
  }, [isOpen, initialLatex, initialName]);

  // Live KaTeX rendering
  useEffect(() => {
    if (!previewRef.current) return;
    try {
      katex.render(latex.trim() || 'f(x) = 0', previewRef.current, {
        displayMode: true,
        throwOnError: true
      });
      setPreviewError(null);
    } catch (err: any) {
      setPreviewError(err?.message || 'Syntax error in equation');
      if (previewRef.current) {
        previewRef.current.innerHTML = `<span class="text-rose-400 font-mono text-xs">${latex}</span>`;
      }
    }
  }, [latex]);

  if (!isOpen) return null;

  const handleInsertSnippet = (snippet: string, cursorOffset?: number) => {
    const textarea = textareaRef.current;
    if (!textarea) {
      setLatex(prev => (prev.trim() ? prev + ' ' + snippet : snippet));
      return;
    }

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const before = latex.substring(0, start);
    const after = latex.substring(end);
    const newLatex = before + snippet + after;
    setLatex(newLatex);

    setTimeout(() => {
      textarea.focus();
      const newPos = start + (cursorOffset !== undefined ? cursorOffset : snippet.length);
      textarea.setSelectionRange(newPos, newPos);
    }, 20);
  };

  const handleSave = () => {
    if (!latex.trim()) return;
    onSave(latex.trim(), equationName.trim());
    onClose();
  };

  const handleClear = () => {
    setLatex('');
    if (textareaRef.current) textareaRef.current.focus();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div 
        className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800 bg-slate-950/40">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center text-sm font-bold">
              ∑
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-100">Visual Equation Editor</h3>
              <p className="text-[11px] text-slate-400">Click structures and symbols to build formulas visually</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          {/* Equation Title (Optional) */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <div className="flex-1">
              <input
                type="text"
                value={equationName}
                onChange={e => setEquationName(e.target.value)}
                placeholder="Formula Name (e.g. Centripetal Force, Ohm's Law)..."
                className="w-full px-3 py-1.5 text-xs rounded-lg bg-slate-950 border border-slate-800 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
              />
            </div>
            {/* Quick Preset Selector */}
            <select
              onChange={e => {
                const found = EQUATION_PRESETS.find(p => p.name === e.target.value);
                if (found) {
                  setLatex(found.latex);
                  setEquationName(found.name);
                }
              }}
              defaultValue=""
              className="px-2.5 py-1.5 text-xs rounded-lg bg-slate-950 border border-slate-800 text-slate-300 focus:outline-none focus:border-indigo-500 cursor-pointer"
            >
              <option value="" disabled>Load standard formula...</option>
              {EQUATION_PRESETS.map((p, idx) => (
                <option key={idx} value={p.name}>{p.name}</option>
              ))}
            </select>
          </div>

          {/* Live KaTeX Rendered Preview Card */}
          <div>
            <div className="flex items-center justify-between mb-1 text-[11px] text-slate-400 font-medium">
              <span>Preview</span>
              {previewError ? (
                <span className="text-rose-400">Check formula syntax</span>
              ) : (
                <button
                  type="button"
                  onClick={handleClear}
                  className="hover:text-slate-200 text-slate-500 flex items-center gap-1 cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" /> Clear
                </button>
              )}
            </div>
            <div className="p-5 rounded-xl bg-slate-950 border border-slate-800/80 flex items-center justify-center min-h-[85px] overflow-x-auto shadow-inner text-slate-100">
              <div ref={previewRef} className="text-xl sm:text-2xl" />
            </div>
          </div>

          {/* Section 1: Visual Structure Templates */}
          <div className="space-y-1.5">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
              Insert Structure Template
            </span>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5">
              {STRUCTURE_TEMPLATES.map((item, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleInsertSnippet(item.latexSnippet, item.cursorOffset)}
                  title={item.desc}
                  className="py-2 px-2 rounded-lg bg-slate-800/90 hover:bg-indigo-600/25 border border-slate-700/60 hover:border-indigo-500/50 text-slate-200 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <span className="font-serif font-bold text-indigo-300 text-xs">{item.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Section 2: Symbol Categories */}
          <div className="space-y-2">
            <div className="flex items-center gap-1 border-b border-slate-800 pb-1.5">
              {SYMBOL_CATEGORIES.map(cat => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setActiveCategory(cat.id)}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                    activeCategory === cat.id
                      ? 'bg-slate-800 text-white font-semibold'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                  }`}
                >
                  {cat.name}
                </button>
              ))}
            </div>

            {/* Symbols Buttons Grid */}
            <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-9 gap-1.5 max-h-36 overflow-y-auto p-0.5">
              {SYMBOL_CATEGORIES.find(c => c.id === activeCategory)?.items.map((item, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleInsertSnippet(item.latexSnippet, item.cursorOffset)}
                  title={item.desc || item.label}
                  className="h-8 rounded-lg bg-slate-800/60 hover:bg-indigo-600/20 border border-slate-800 hover:border-indigo-500/40 text-slate-200 font-serif text-sm flex items-center justify-center transition-colors cursor-pointer"
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {/* Section 3: Advanced LaTeX Toggle (Hidden by default for simplicity) */}
          <div className="pt-2 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setShowAdvancedLatex(!showAdvancedLatex)}
              className="text-xs text-slate-400 hover:text-slate-200 font-medium flex items-center gap-1.5 cursor-pointer"
            >
              {showAdvancedLatex ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
              <span>Advanced: View & Edit LaTeX Code</span>
            </button>

            {showAdvancedLatex && (
              <div className="mt-2 space-y-1.5 animate-in fade-in duration-100">
                <textarea
                  ref={textareaRef}
                  rows={2}
                  value={latex}
                  onChange={e => setLatex(e.target.value)}
                  placeholder="e.g. F_c = \frac{m v^2}{r}"
                  className="w-full px-3 py-2 text-xs font-mono rounded-lg bg-slate-950 border border-slate-800 text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500 resize-none"
                />
                <p className="text-[10px] text-slate-500">
                  Tip: Fractions use <code className="text-slate-400 font-mono">\frac{`{num}`}{`{den}`}</code>, powers use <code className="text-slate-400 font-mono">x^{`{2}`}</code>, subscripts use <code className="text-slate-400 font-mono">F_{`{c}`}</code>.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-slate-800 bg-slate-950/40">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 text-xs font-medium text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!latex.trim()}
            className="px-4 py-1.5 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors disabled:opacity-50 cursor-pointer flex items-center gap-1.5 shadow-sm"
          >
            <Check className="w-3.5 h-3.5" />
            <span>Insert Equation</span>
          </button>
        </div>
      </div>
    </div>
  );
};
