import React, { useState } from 'react';
import { Loader2, ShieldCheck, CheckCircle2, AlertCircle } from 'lucide-react';
import { Homework, UserProfile } from '../../types';
import { buildWorkspaceAuthHeaders } from '../../lib/workspaceIntelligenceClient';

interface QualityAnalysisResponse {
  readOnly: boolean;
  mutatedSavedAssignment: boolean;
  analysis: {
    clarityScore: number;
    questionQualityScore: number;
    missingInstructions: string[];
    difficultyBalance: { Easy: number; Medium: number; Hard: number; Unspecified: number };
    repeatedPairs: Array<{ q1: number; q2: number; similarity: number }>;
    markDistribution: {
      questionCount: number;
      sumQuestionMarks: number;
      declaredMaxScore: number;
      markMismatch: boolean;
    };
    recommendations: string[];
  };
}

interface AssignmentQualityPanelProps {
  currentUser: UserProfile | null;
  effectiveRole: string;
  homeworkList: Homework[];
}

export const AssignmentQualityPanel: React.FC<AssignmentQualityPanelProps> = ({
  currentUser,
  effectiveRole,
  homeworkList,
}) => {
  const [title, setTitle] = useState(homeworkList[0]?.title || 'Rotational Mechanics Problem Set');
  const [instructions, setInstructions] = useState(homeworkList[0]?.content || '');
  const [objectivesText, setObjectivesText] = useState('');
  const [questionsText, setQuestionsText] = useState('');
  const [maxScore, setMaxScore] = useState(20);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<QualityAnalysisResponse | null>(null);

  const loadFromHomework = (hwId: string) => {
    const hw = homeworkList.find((h) => h.id === hwId);
    if (!hw) return;
    setTitle(hw.title);
    setInstructions(hw.content || '');
  };

  const handleAnalyze = async () => {
    setLoading(true);
    setError('');
    try {
      const parsedQuestions = questionsText
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => {
          const markMatch = line.match(/\((\d+)\s*m(?:arks?)?\)/i);
          const diffMatch = line.match(/\b(easy|medium|hard)\b/i);
          return {
            prompt: line,
            marks: markMatch ? Number(markMatch[1]) : 5,
            difficulty: diffMatch ? diffMatch[1] : 'Medium',
          };
        });

      const headers = await buildWorkspaceAuthHeaders(currentUser, effectiveRole);
      const res = await fetch('/api/assignments/quality-analyze', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          userId: currentUser?.uid || 'guest',
          userRole: effectiveRole,
          title,
          instructions,
          objectives: objectivesText.split('\n').map((o) => o.trim()).filter(Boolean),
          questions: parsedQuestions,
          maxScore,
          dueDate: homeworkList[0]?.dueDate || '2026-12-01',
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || `Failed with HTTP ${res.status}`);
      setResult(data);
    } catch (err: any) {
      setError(err?.message || 'Quality analysis failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-slate-900/90 border border-white/10 rounded-2xl p-4 sm:p-5 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-3">
        <div>
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Assignment Quality Analyzer</span>
          </h3>
          <p className="text-xs text-slate-400">
            Checks clarity, objectives, difficulty balance, repetition, marks, and missing instructions. Strictly read-only.
          </p>
        </div>

        <span className="text-[11px] font-mono px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 self-start sm:self-auto">
          Read-Only Audit · Never Modifies Published Work
        </span>
      </div>

      {homeworkList.length > 0 && (
        <div>
          <label className="block text-[11px] font-semibold text-slate-400 mb-1">Load Existing Assignment (Read-Only Inspect)</label>
          <select
            onChange={(e) => loadFromHomework(e.target.value)}
            defaultValue=""
            className="w-full sm:w-96 bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white"
          >
            <option value="">Select posted assignment or enter text below...</option>
            {homeworkList.map((hw) => (
              <option key={hw.id} value={hw.id}>
                {hw.title} ({hw.subject})
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="space-y-2.5">
          <div className="flex gap-2">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Assignment title"
              className="flex-1 bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white"
            />
            <input
              type="number"
              min={1}
              value={maxScore}
              onChange={(e) => setMaxScore(Number(e.target.value || 20))}
              title="Declared Max Score"
              className="w-24 bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-xs font-mono text-white"
            />
          </div>
          <textarea
            rows={4}
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            placeholder="Paste assignment instructions and rubric criteria..."
            className="w-full bg-slate-950 border border-white/10 rounded-xl p-3 text-xs text-white placeholder-slate-500"
          />
        </div>
        <div className="space-y-2.5">
          <textarea
            rows={2}
            value={objectivesText}
            onChange={(e) => setObjectivesText(e.target.value)}
            placeholder="Learning objectives (one per line, optional)"
            className="w-full bg-slate-950 border border-white/10 rounded-xl p-2.5 text-xs text-white placeholder-slate-500"
          />
          <textarea
            rows={3}
            value={questionsText}
            onChange={(e) => setQuestionsText(e.target.value)}
            placeholder="Questions (one per line, e.g. '(5m) Easy: Derive torque equation')"
            className="w-full bg-slate-950 border border-white/10 rounded-xl p-2.5 text-xs text-white placeholder-slate-500"
          />
        </div>
      </div>

      <button
        type="button"
        onClick={handleAnalyze}
        disabled={loading}
        className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
      >
        {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
        <span>{loading ? 'Auditing...' : 'Run Quality Audit'}</span>
      </button>

      {error && (
        <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300">{error}</div>
      )}

      {result && (
        <div className="space-y-3 bg-slate-950/90 border border-white/10 rounded-xl p-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-2.5 rounded-lg bg-slate-900 border border-white/5">
              <span className="text-[11px] text-slate-400">Clarity Audit</span>
              <p className="text-base font-bold font-mono text-white tabular-nums">{result.analysis.clarityScore}/100</p>
            </div>
            <div className="p-2.5 rounded-lg bg-slate-900 border border-white/5">
              <span className="text-[11px] text-slate-400">Question Quality</span>
              <p className="text-base font-bold font-mono text-white tabular-nums">{result.analysis.questionQualityScore}/100</p>
            </div>
            <div className="p-2.5 rounded-lg bg-slate-900 border border-white/5">
              <span className="text-[11px] text-slate-400">Marks Sum</span>
              <p className="text-base font-bold font-mono text-white tabular-nums">
                {result.analysis.markDistribution.sumQuestionMarks} / {result.analysis.markDistribution.declaredMaxScore}
              </p>
            </div>
            <div className="p-2.5 rounded-lg bg-slate-900 border border-white/5">
              <span className="text-[11px] text-slate-400">Difficulty Mix (E/M/H)</span>
              <p className="text-base font-bold font-mono text-white tabular-nums">
                {result.analysis.difficultyBalance.Easy}/{result.analysis.difficultyBalance.Medium}/{result.analysis.difficultyBalance.Hard}
              </p>
            </div>
          </div>

          <div className="space-y-1.5">
            <h4 className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
              {result.analysis.missingInstructions.length > 0 ? (
                <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
              ) : (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              )}
              <span>Audit Recommendations</span>
            </h4>
            <ul className="list-disc pl-4 space-y-1 text-xs text-slate-300">
              {result.analysis.recommendations.map((rec, i) => (
                <li key={i}>{rec}</li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};
