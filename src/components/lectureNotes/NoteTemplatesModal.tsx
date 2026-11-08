import React from 'react';
import { 
  X, 
  LayoutTemplate, 
  BookOpen, 
  FlaskConical, 
  Calculator, 
  GraduationCap, 
  Check, 
  FileText,
  ArrowRight
} from 'lucide-react';

interface NoteTemplatesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyTemplate: (title: string, subject: string, content: string) => void;
}

const TEMPLATES = [
  {
    id: 'cornell',
    title: 'Cornell Note-Taking System',
    subject: 'General',
    desc: 'Classic Cornell framework with Cue questions, core lecture content, and executive summary.',
    icon: <BookOpen className="w-5 h-5 text-indigo-400" />,
    content: `# [Topic Title] — Cornell Lecture Notes\n\n## Overview & Essential Questions\n- What is the primary mechanism governing this phenomenon?\n- How does this correlate with previous curriculum units?\n\n## Core Lecture Notes\n> 💡 **Concept: Primary Law**\n> Detailed explanation of the main principle and its scientific basis.\n>\n> **Key Takeaway**: Must remember for examination.\n\n### Mathematical Formulation\n$$\nE = m c^2\n$$\n\n| Variable | Meaning | SI Unit |\n|---|---|---|\n| $E$ | Energy | Joules (J) |\n| $m$ | Mass | Kilograms (kg) |\n| $c$ | Speed of Light | $3 \\times 10^8$ m/s |\n\n## Summary & Review Scaffolding\nSynthesize the key points from this lecture in 2-3 concise sentences.`
  },
  {
    id: 'physics_lab',
    title: 'Science & Physics Laboratory Report',
    subject: 'Physics',
    desc: 'Structured lab documentation: Objective, Governing Equations, Observations table, and Error Analysis.',
    icon: <FlaskConical className="w-5 h-5 text-rose-400" />,
    content: `# Laboratory Investigation: [Experiment Name]\n\n## 1. Objective & Hypothesis\n- **Objective**: Investigate the relationship between force and acceleration.\n- **Hypothesis**: Acceleration is directly proportional to applied net force.\n\n## 2. Governing Equations\n$$\nF_{net} = m \\cdot a\n$$\n\n## 3. Experimental Data & Observations\n| Trial | Mass (kg) | Applied Force (N) | Measured Accel (m/s²) |\n|---|---|---|---|\n| Trial 1 | 0.50 | 1.0 | 1.98 |\n| Trial 2 | 0.50 | 2.0 | 3.95 |\n| Trial 3 | 0.50 | 3.0 | 5.92 |\n\n## 4. Error Analysis & Uncertainty\n- Percentage error: $\\approx 1.5\\%$\n- Systematic uncertainties: Sensor friction, air drag.\n\n## 5. Conclusion\nThe experimental data verified Newton's Second Law within experimental uncertainty.`
  },
  {
    id: 'math_derivation',
    title: 'Mathematical Derivation & Proof',
    subject: 'Mathematics',
    desc: 'Axioms, Theorem statement, rigorous step-by-step algebraic steps, and dimensional check.',
    icon: <Calculator className="w-5 h-5 text-purple-400" />,
    content: `# Theorem & Derivation: [Theorem Name]\n\n## Statement of the Theorem\n> 📖 **Definition (Theorem)**: Every non-zero single-variable polynomial of degree $n$ has exactly $n$ complex roots.\n\n## Derivation & Analytical Proof\n### Step 1: Baseline Axioms\nLet $P(x) = a_n x^n + \\dots + a_1 x + a_0$.\n\n### Step 2: Intermediate Algebraic Expansion\n$$\n\\lim_{x \\to \\infty} \\frac{P(x)}{a_n x^n} = 1\n$$\n\n### Step 3: Deduction & Final Answer\nTherefore, by the Fundamental Theorem of Algebra, the statement holds for all degrees $n \\ge 1$.`
  },
  {
    id: 'exam_revision',
    title: 'High-Yield Exam Revision Cheat-Sheet',
    subject: 'Chemistry',
    desc: 'Ultra-compact memory sheet with formulas, common pitfalls, and 3 active recall questions.',
    icon: <FileText className="w-5 h-5 text-amber-400" />,
    content: `# Exam Revision Cheat Sheet: [Chapter Name]\n\n> ⚠️ **Common Mistake**: Do not confuse molarity (mol/L) with molality (mol/kg solvent).\n\n## Core Formula Matrix\n$$\npH = -\\log_{10}[H^+]\n$$\n$$\npOH = -\\log_{10}[OH^-]\n$$\n$$\npH + pOH = 14 \\quad (25^\\circ\\text{C})\n$$\n\n## High-Yield Active Recall Questions\n> ❓ **Recall Question**: What happens to $K_w$ when temperature increases?\n>\n> 💡 **Answer**: The auto-ionization of water is endothermic, so $K_w$ increases with temperature.\n\n> ❓ **Recall Question**: What is a buffer solution?\n>\n> 💡 **Answer**: A mixture of a weak acid and its conjugate base that resists drastic pH changes upon addition of small amounts of strong acid or base.`
  },
  {
    id: 'lesson_plan',
    title: 'Teacher Curriculum Lesson Plan',
    subject: 'Syllabus General',
    desc: 'Learning objectives, teaching phases, guided student practice, and exit ticket assessment.',
    icon: <GraduationCap className="w-5 h-5 text-emerald-400" />,
    content: `# Curriculum Lesson Plan: [Lesson Title]\n\n## Class & Syllabus Context\n- **Subject**: Science / Academic\n- **Target Grade**: Grade 10 / Secondary\n- **Duration**: 45 Minutes\n\n## 1. Learning Objectives (Bloom's Taxonomy)\n- Students will be able to define the core principles of the topic.\n- Students will be able to calculate unknown variables using standard equations.\n\n## 2. Lesson Breakdown\n- **0-10 min**: Hook / Starter Question & Real-World Analogy\n- **10-25 min**: Direct Instruction & Board Worked Examples\n- **25-35 min**: Paired Problem Solving Worksheet\n- **35-45 min**: Exit Ticket Assessment & Homework Link`
  }
];

export const NoteTemplatesModal: React.FC<NoteTemplatesModalProps> = ({
  isOpen,
  onClose,
  onApplyTemplate
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className="w-full max-w-2xl bg-slate-900 border border-slate-700/80 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/40">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-cyan-600/20 text-cyan-400 border border-cyan-500/30 flex items-center justify-center">
              <LayoutTemplate className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-100">Educational Note Templates</h3>
              <p className="text-[11px] text-slate-400">Initialize a note using battle-tested pedagogical frameworks</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Templates List */}
        <div className="p-6 overflow-y-auto flex-1 space-y-3">
          {TEMPLATES.map(tmpl => (
            <div
              key={tmpl.id}
              className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 hover:border-slate-700 flex items-start justify-between gap-4 transition-all group"
            >
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-xl bg-slate-900 border border-slate-800 shrink-0">
                  {tmpl.icon}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-bold text-slate-100 group-hover:text-cyan-300 transition-colors">
                      {tmpl.title}
                    </h4>
                    <span className="text-[10px] font-semibold text-slate-400 bg-slate-800 px-2 py-0.5 rounded">
                      {tmpl.subject}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                    {tmpl.desc}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  onApplyTemplate(tmpl.title, tmpl.subject, tmpl.content);
                  onClose();
                }}
                className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shrink-0 transition-all active:scale-95 cursor-pointer flex items-center gap-1 shadow-sm"
              >
                <span>Use Template</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
