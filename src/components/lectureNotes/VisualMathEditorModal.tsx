import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  Check, 
  HelpCircle, 
  Code2, 
  Sparkles, 
  Calculator, 
  ChevronRight,
  BookOpen,
  ArrowRight
} from 'lucide-react';
import katex from 'katex';

interface VisualMathEditorModalProps {
  isOpen: boolean;
  initialLatex?: string;
  initialName?: string;
  onClose: () => void;
  onSave: (latex: string, name?: string) => void;
}

interface MathSymbolButton {
  label: string;
  latexSnippet: string;
  cursorOffset?: number; // offset to position cursor inside braces
  desc?: string;
}

const CATEGORIES: { id: string; name: string; items: MathSymbolButton[] }[] = [
  {
    id: 'common',
    name: 'Basic & Powers',
    items: [
      { label: 'a/b', latexSnippet: '\\frac{a}{b}', cursorOffset: 6, desc: 'Fraction' },
      { label: 'xⁿ', latexSnippet: 'x^{2}', cursorOffset: 3, desc: 'Superscript / Power' },
      { label: 'xᵢ', latexSnippet: 'x_{i}', cursorOffset: 3, desc: 'Subscript' },
      { label: '√x', latexSnippet: '\\sqrt{x}', cursorOffset: 7, desc: 'Square Root' },
      { label: 'ⁿ√x', latexSnippet: '\\sqrt[n]{x}', cursorOffset: 7, desc: 'N-th Root' },
      { label: '( ... )', latexSnippet: '\\left( x \\right)', cursorOffset: 7, desc: 'Scaled Parentheses' },
      { label: '[ ... ]', latexSnippet: '\\left[ x \\right]', cursorOffset: 7, desc: 'Scaled Brackets' },
      { label: '| x |', latexSnippet: '\\left| x \\right|', cursorOffset: 7, desc: 'Absolute Value' },
      { label: '±', latexSnippet: '\\pm ', desc: 'Plus-Minus' },
      { label: '×', latexSnippet: '\\times ', desc: 'Multiplication' },
      { label: '·', latexSnippet: '\\cdot ', desc: 'Dot Product' },
      { label: '÷', latexSnippet: '\\div ', desc: 'Division' },
      { label: '≠', latexSnippet: '\\neq ', desc: 'Not Equal' },
      { label: '≈', latexSnippet: '\\approx ', desc: 'Approximately' },
      { label: '≤', latexSnippet: '\\le ', desc: 'Less or Equal' },
      { label: '≥', latexSnippet: '\\ge ', desc: 'Greater or Equal' },
      { label: '∞', latexSnippet: '\\infty ', desc: 'Infinity' }
    ]
  },
  {
    id: 'calculus',
    name: 'Calculus & Series',
    items: [
      { label: '∫ dx', latexSnippet: '\\int_{a}^{b} f(x)\\,dx', cursorOffset: 12, desc: 'Definite Integral' },
      { label: '∬', latexSnippet: '\\iint_{D} f(x,y)\\,dA', desc: 'Double Integral' },
      { label: '∑', latexSnippet: '\\sum_{i=1}^{n} a_i', cursorOffset: 7, desc: 'Summation' },
      { label: '∏', latexSnippet: '\\prod_{i=1}^{n} x_i', desc: 'Product' },
      { label: 'lim', latexSnippet: '\\lim_{x \\to 0} f(x)', cursorOffset: 7, desc: 'Limit' },
      { label: 'df/dx', latexSnippet: '\\frac{df}{dx}', desc: 'Derivative' },
      { label: '∂f/∂x', latexSnippet: '\\frac{\\partial f}{\\partial x}', desc: 'Partial Derivative' },
      { label: '∇', latexSnippet: '\\nabla ', desc: 'Nabla / Del' },
      { label: 'Δx', latexSnippet: '\\Delta x', desc: 'Delta / Change' }
    ]
  },
  {
    id: 'greek',
    name: 'Greek Symbols',
    items: [
      { label: 'α', latexSnippet: '\\alpha ', desc: 'alpha' },
      { label: 'β', latexSnippet: '\\beta ', desc: 'beta' },
      { label: 'γ', latexSnippet: '\\gamma ', desc: 'gamma' },
      { label: 'θ', latexSnippet: '\\theta ', desc: 'theta' },
      { label: 'λ', latexSnippet: '\\lambda ', desc: 'lambda' },
      { label: 'μ', latexSnippet: '\\mu ', desc: 'mu' },
      { label: 'π', latexSnippet: '\\pi ', desc: 'pi' },
      { label: 'ρ', latexSnippet: '\\rho ', desc: 'rho' },
      { label: 'σ', latexSnippet: '\\sigma ', desc: 'sigma' },
      { label: 'τ', latexSnippet: '\\tau ', desc: 'tau' },
      { label: 'φ', latexSnippet: '\\phi ', desc: 'phi' },
      { label: 'ω', latexSnippet: '\\omega ', desc: 'omega' },
      { label: 'Ω', latexSnippet: '\\Omega ', desc: 'Capital Omega' },
      { label: 'Δ', latexSnippet: '\\Delta ', desc: 'Capital Delta' }
    ]
  },
  {
    id: 'algebra',
    name: 'Matrices & Vectors',
    items: [
      { label: '2×2 Mat', latexSnippet: '\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}', desc: '2x2 Matrix' },
      { label: '3×3 Mat', latexSnippet: '\\begin{pmatrix} a & b & c \\\\ d & e & f \\\\ g & h & i \\end{pmatrix}', desc: '3x3 Matrix' },
      { label: 'v⃗', latexSnippet: '\\vec{v}', cursorOffset: 5, desc: 'Vector' },
      { label: 'Aᵀ', latexSnippet: 'A^{T}', desc: 'Transpose' },
      { label: 'A⁻¹', latexSnippet: 'A^{-1}', desc: 'Inverse Matrix' },
      { label: 'det(A)', latexSnippet: '\\det(A)', desc: 'Determinant' },
      { label: 'log(x)', latexSnippet: '\\log_{10}(x)', desc: 'Logarithm' },
      { label: 'ln(x)', latexSnippet: '\\ln(x)', desc: 'Natural Logarithm' },
      { label: 'sin', latexSnippet: '\\sin(\\theta)', desc: 'Sine' },
      { label: 'cos', latexSnippet: '\\cos(\\theta)', desc: 'Cosine' },
      { label: 'tan', latexSnippet: '\\tan(\\theta)', desc: 'Tangent' }
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
  const [activeCategory, setActiveCategory] = useState<string>('common');
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [showLatexSource, setShowLatexSource] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      setLatex(initialLatex || 'F_c = \\frac{m v^2}{r}');
      setEquationName(initialName || '');
    }
  }, [isOpen, initialLatex, initialName]);

  // Live KaTeX rendering effect
  useEffect(() => {
    if (!previewRef.current) return;
    try {
      katex.render(latex.trim() || 'f(x) = 0', previewRef.current, {
        displayMode: true,
        throwOnError: true
      });
      setPreviewError(null);
    } catch (err: any) {
      setPreviewError(err?.message || 'Invalid equation syntax');
      if (previewRef.current) {
        previewRef.current.innerHTML = `<span class="text-rose-400 font-mono text-xs">${latex}</span>`;
      }
    }
  }, [latex]);

  if (!isOpen) return null;

  const handleInsertSnippet = (snippet: string, cursorOffset?: number) => {
    const textarea = textareaRef.current;
    if (!textarea) {
      setLatex(prev => prev + ' ' + snippet);
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className="w-full max-w-2xl bg-slate-900 border border-slate-700/60 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/40">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center text-sm font-bold">
              ∑
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-100">Visual Mathematical Equation Editor</h3>
              <p className="text-[11px] text-slate-400">Click mathematical symbols to build or edit formulas visually</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {/* Equation Title (Optional) */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
              Equation Name / Label (Optional)
            </label>
            <input
              type="text"
              value={equationName}
              onChange={e => setEquationName(e.target.value)}
              placeholder="e.g. Centripetal Force, Quadratic Formula, Ohm's Law"
              className="w-full px-3.5 py-2 text-xs rounded-xl bg-slate-950 border border-slate-800 text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-colors"
            />
          </div>

          {/* Live KaTeX Rendered Preview Card */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Live Formula Preview (Vector)
              </span>
              {previewError && (
                <span className="text-[10px] text-rose-400 font-medium">Syntax error in expression</span>
              )}
            </div>
            <div className="p-6 rounded-2xl bg-slate-950/80 border border-slate-800/80 flex items-center justify-center min-h-[96px] overflow-x-auto shadow-inner text-slate-100">
              <div ref={previewRef} className="text-xl sm:text-2xl" />
            </div>
          </div>

          {/* Visual Palette Categories */}
          <div>
            <div className="flex items-center gap-1.5 border-b border-slate-800 pb-2 mb-3 overflow-x-auto">
              {CATEGORIES.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors cursor-pointer ${
                    activeCategory === cat.id
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                  }`}
                >
                  {cat.name}
                </button>
              ))}
            </div>

            {/* Symbol Buttons Grid */}
            <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2 max-h-44 overflow-y-auto p-1">
              {CATEGORIES.find(c => c.id === activeCategory)?.items.map((item, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleInsertSnippet(item.latexSnippet, item.cursorOffset)}
                  title={item.desc || item.label}
                  className="h-10 px-2 rounded-xl bg-slate-800/80 hover:bg-indigo-600/30 border border-slate-700/60 hover:border-indigo-500/40 text-slate-200 font-serif text-sm flex items-center justify-center transition-all active:scale-95 cursor-pointer shadow-sm"
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {/* Underlying LaTeX Input / Editor */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                LaTeX Formula Source
              </label>
              <button
                type="button"
                onClick={() => setShowLatexSource(!showLatexSource)}
                className="text-[10px] text-indigo-400 hover:text-indigo-300 font-medium flex items-center gap-1 cursor-pointer"
              >
                <Code2 className="w-3 h-3" />
                <span>{showLatexSource ? 'Hide Source Help' : 'LaTeX Help'}</span>
              </button>
            </div>
            <textarea
              ref={textareaRef}
              rows={3}
              value={latex}
              onChange={e => setLatex(e.target.value)}
              placeholder="e.g. F = G \frac{m_1 m_2}{r^2}"
              className="w-full px-3.5 py-2.5 text-xs font-mono rounded-xl bg-slate-950 border border-slate-800 text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none transition-colors"
            />
            {showLatexSource && (
              <div className="mt-2 p-3 rounded-xl bg-slate-950 border border-slate-800 text-[11px] text-slate-400 space-y-1">
                <p className="font-semibold text-slate-300">Quick Tips:</p>
                <p>• Fractions: <code className="text-indigo-300 font-mono">\frac{`{numerator}`}{`{denominator}`}</code></p>
                <p>• Powers / Subscripts: <code className="text-indigo-300 font-mono">x^{`{2}`}</code>, <code className="text-indigo-300 font-mono">F_{`{c}`}</code></p>
                <p>• Greek: <code className="text-indigo-300 font-mono">\alpha, \beta, \omega, \theta, \Delta</code></p>
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-800 bg-slate-950/60">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!latex.trim()}
            className="px-5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl transition-all shadow-md active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1.5"
          >
            <Check className="w-3.5 h-3.5" />
            <span>Insert Equation</span>
          </button>
        </div>
      </div>
    </div>
  );
};
