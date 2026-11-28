import React, { useState } from 'react';
import { BookOpenCheck, Loader2, AlertTriangle, CheckCircle2, Sparkles } from 'lucide-react';
import { UserProfile, VaultNote } from '../../types';
import { buildWorkspaceAuthHeaders } from '../../lib/workspaceIntelligenceClient';

interface NotebookAuditResult {
  hasNotes: boolean;
  noteCount: number;
  completenessScore: number | null;
  summary: string;
  gaps: string[];
  organizationFindings: string[];
  suggestions: string[];
  perNoteAudit: Array<{
    noteId: string;
    title: string;
    subject: string;
    wordCount: number;
    completenessPercent: number;
    issues: string[];
  }>;
}

interface NotebookIntelligencePanelProps {
  currentUser: UserProfile | null;
  effectiveRole: string;
  notes: VaultNote[];
}

export const NotebookIntelligencePanel: React.FC<NotebookIntelligencePanelProps> = ({
  currentUser,
  effectiveRole,
  notes,
}) => {
  const [subject, setSubject] = useState('All');
  const [topicsInput, setTopicsInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<NotebookAuditResult | null>(null);

  const ownedNotes = notes.filter((n) => !n.userId || !currentUser?.uid || n.userId === currentUser.uid);

  const handleAnalyze = async () => {
    setLoading(true);
    setError('');
    try {
      const headers = await buildWorkspaceAuthHeaders(currentUser, effectiveRole);
      const res = await fetch('/api/assignments/notebook-intelligence', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          userId: currentUser?.uid || 'guest',
          userRole: effectiveRole,
          subject,
          topics: topicsInput
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean),
          notes: ownedNotes.map((n) => ({
            id: n.id,
            userId: n.userId || currentUser?.uid || 'guest',
            title: n.title,
            subject: n.subject,
            content: n.content,
            createdAt: n.createdAt,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || `Failed with HTTP ${res.status}`);
      }
      setResult(data);
    } catch (err: any) {
      setError(err?.message || 'Notebook analysis failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-slate-900/90 border border-white/10 rounded-2xl p-4 sm:p-5 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-3">
        <div>
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <BookOpenCheck className="w-4 h-4 text-indigo-400" />
            <span>Notebook Intelligence</span>
          </h3>
          <p className="text-xs text-slate-400">
            Audits your real Notes Vault ({ownedNotes.length} saved notes) for completeness, topic gaps, and structure.
          </p>
        </div>
        <button
          type="button"
          onClick={handleAnalyze}
          disabled={loading}
          className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
        >
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
          <span>{loading ? 'Analyzing Notes...' : 'Analyze My Notes'}</span>
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <select
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          className="bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
        >
          {['All', 'Mathematics', 'Physics', 'Chemistry', 'Biology', 'Computer Science', 'English', 'Social Science', 'General'].map((s) => (
            <option key={s} value={s}>
              {s === 'All' ? 'All Subjects' : s}
            </option>
          ))}
        </select>

        <input
          type="text"
          value={topicsInput}
          onChange={(e) => setTopicsInput(e.target.value)}
          placeholder="Curriculum topics to check (comma-separated)"
          className="bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
        />
      </div>

      {error && (
        <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300">
          {error}
        </div>
      )}

      {result && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="bg-slate-950/90 border border-white/10 rounded-xl p-3">
              <span className="text-[11px] text-slate-400">Real Notes Inspected</span>
              <p className="text-lg font-bold font-mono text-white tabular-nums">{result.noteCount}</p>
            </div>
            <div className="bg-slate-950/90 border border-white/10 rounded-xl p-3">
              <span className="text-[11px] text-slate-400">Structural Completeness</span>
              <p className="text-lg font-bold font-mono text-white tabular-nums">
                {result.completenessScore !== null ? `${result.completenessScore}%` : 'N/A'}
              </p>
            </div>
            <div className="bg-slate-950/90 border border-white/10 rounded-xl p-3 col-span-2 sm:col-span-1">
              <span className="text-[11px] text-slate-400">Detected Gaps</span>
              <p className="text-lg font-bold font-mono text-amber-300 tabular-nums">{result.gaps.length}</p>
            </div>
          </div>

          <p className="text-xs text-slate-200 bg-slate-950/70 border border-white/10 rounded-xl p-3">
            {result.summary}
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="bg-slate-950/90 border border-white/10 rounded-xl p-3.5 space-y-2">
              <h4 className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5" /> Concept &amp; Structure Gaps
              </h4>
              {result.gaps.length === 0 ? (
                <p className="text-xs text-slate-400">No missing topics or thin-note gaps detected.</p>
              ) : (
                <ul className="space-y-1.5 text-xs text-slate-300 list-disc pl-4">
                  {result.gaps.map((g, idx) => (
                    <li key={idx}>{g}</li>
                  ))}
                </ul>
              )}
            </div>

            <div className="bg-slate-950/90 border border-white/10 rounded-xl p-3.5 space-y-2">
              <h4 className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" /> Study Improvement Suggestions
              </h4>
              <ul className="space-y-1.5 text-xs text-slate-300 list-disc pl-4">
                {result.suggestions.map((s, idx) => (
                  <li key={idx}>{s}</li>
                ))}
              </ul>
            </div>
          </div>

          {result.perNoteAudit.length > 0 && (
            <div className="overflow-x-auto bg-slate-950/90 border border-white/10 rounded-xl">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-white/10 text-slate-400">
                  <tr>
                    <th className="px-3 py-2.5">Note Title</th>
                    <th className="px-3 py-2.5">Subject</th>
                    <th className="px-3 py-2.5 text-right">Words</th>
                    <th className="px-3 py-2.5 text-right">Completeness</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-slate-200">
                  {result.perNoteAudit.map((row) => (
                    <tr key={row.noteId} className="hover:bg-white/5">
                      <td className="px-3 py-2 font-medium">{row.title}</td>
                      <td className="px-3 py-2 text-slate-400">{row.subject}</td>
                      <td className="px-3 py-2 text-right font-mono tabular-nums">{row.wordCount}</td>
                      <td className="px-3 py-2 text-right font-mono tabular-nums">{row.completenessPercent}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
