import React, { useState } from 'react';
import { BarChart3, Download, Loader2 } from 'lucide-react';
import { UserProfile, VaultNote } from '../../types';
import { buildWorkspaceAuthHeaders, triggerFileDownload } from '../../lib/workspaceIntelligenceClient';

interface CompletionReportData {
  report: {
    generatedAt: string;
    studentName: string;
    subjectScope: string;
    insufficientData: boolean;
    totals: {
      totalNotes: number;
      totalWords: number;
      topicsTracked: number;
      completedTopics: number;
      partialTopics: number;
      missingTopics: number;
      coveragePercent: number;
    };
    bySubject: Array<{
      subject: string;
      noteCount: number;
      totalWords: number;
      structuredCount: number;
    }>;
  };
  markdown: string;
  csv: string;
}

interface NotebookCompletionReportPanelProps {
  currentUser: UserProfile | null;
  effectiveRole: string;
  notes: VaultNote[];
}

export const NotebookCompletionReportPanel: React.FC<NotebookCompletionReportPanelProps> = ({
  currentUser,
  effectiveRole,
  notes,
}) => {
  const [subject, setSubject] = useState('All');
  const [topicsInput, setTopicsInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [data, setData] = useState<CompletionReportData | null>(null);

  const ownedNotes = notes.filter((n) => !n.userId || !currentUser?.uid || n.userId === currentUser.uid);

  const handleGenerate = async () => {
    setLoading(true);
    setError('');
    try {
      const headers = await buildWorkspaceAuthHeaders(currentUser, effectiveRole);
      const res = await fetch('/api/assignments/notebook-completion-report', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          userId: currentUser?.uid || 'guest',
          userRole: effectiveRole,
          userName: currentUser?.name || 'Student',
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
          })),
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || `Failed with HTTP ${res.status}`);
      setData(json);
    } catch (err: any) {
      setError(err?.message || 'Could not compute completion report.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-slate-900/90 border border-white/10 rounded-2xl p-4 sm:p-5 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-3">
        <div>
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-indigo-400" />
            <span>Notebook Completion Reports</span>
          </h3>
          <p className="text-xs text-slate-400">
            Computes real syllabus &amp; note coverage strictly from your Vault notes with timestamped exports.
          </p>
        </div>

        <button
          type="button"
          onClick={handleGenerate}
          disabled={loading}
          className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
        >
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <BarChart3 className="w-3.5 h-3.5" />}
          <span>{loading ? 'Computing...' : 'Generate Report'}</span>
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <select
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          className="bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white"
        >
          {['All', 'Mathematics', 'Physics', 'Chemistry', 'Biology', 'Computer Science', 'English', 'Social Science', 'General'].map((s) => (
            <option key={s} value={s}>{s === 'All' ? 'All Subjects' : s}</option>
          ))}
        </select>
        <input
          type="text"
          value={topicsInput}
          onChange={(e) => setTopicsInput(e.target.value)}
          placeholder="Checklist topics (comma-separated, optional)"
          className="bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500"
        />
      </div>

      {error && (
        <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300">{error}</div>
      )}

      {data && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
            <span className="font-mono">Generated: {new Date(data.report.generatedAt).toLocaleString()}</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => triggerFileDownload('notebook-completion-report.json', JSON.stringify(data.report, null, 2), 'application/json')}
                className="px-2.5 py-1 rounded-lg bg-slate-950 border border-white/10 hover:border-indigo-500/40 text-xs text-slate-200 flex items-center gap-1 cursor-pointer"
              >
                <Download className="w-3 h-3" /> JSON
              </button>
              <button
                type="button"
                onClick={() => triggerFileDownload('notebook-completion-report.md', data.markdown, 'text/markdown')}
                className="px-2.5 py-1 rounded-lg bg-slate-950 border border-white/10 hover:border-indigo-500/40 text-xs text-slate-200 flex items-center gap-1 cursor-pointer"
              >
                <Download className="w-3 h-3" /> Markdown
              </button>
              <button
                type="button"
                onClick={() => triggerFileDownload('notebook-completion-report.csv', data.csv, 'text/csv')}
                className="px-2.5 py-1 rounded-lg bg-slate-950 border border-white/10 hover:border-indigo-500/40 text-xs text-slate-200 flex items-center gap-1 cursor-pointer"
              >
                <Download className="w-3 h-3" /> CSV
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-slate-950/90 border border-white/10 rounded-xl p-3">
              <span className="text-[11px] text-slate-400">Coverage</span>
              <p className="text-lg font-bold font-mono text-white tabular-nums">{data.report.totals.coveragePercent}%</p>
            </div>
            <div className="bg-slate-950/90 border border-white/10 rounded-xl p-3">
              <span className="text-[11px] text-slate-400">Total Notes</span>
              <p className="text-lg font-bold font-mono text-white tabular-nums">{data.report.totals.totalNotes}</p>
            </div>
            <div className="bg-slate-950/90 border border-white/10 rounded-xl p-3">
              <span className="text-[11px] text-slate-400">Total Words</span>
              <p className="text-lg font-bold font-mono text-white tabular-nums">{data.report.totals.totalWords}</p>
            </div>
            <div className="bg-slate-950/90 border border-white/10 rounded-xl p-3">
              <span className="text-[11px] text-slate-400">Missing Topics</span>
              <p className="text-lg font-bold font-mono text-amber-300 tabular-nums">{data.report.totals.missingTopics}</p>
            </div>
          </div>

          {data.report.bySubject.length > 0 && (
            <div className="overflow-x-auto bg-slate-950/90 border border-white/10 rounded-xl">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-white/10 text-slate-400">
                  <tr>
                    <th className="px-3 py-2">Subject</th>
                    <th className="px-3 py-2 text-right">Notes</th>
                    <th className="px-3 py-2 text-right">Words</th>
                    <th className="px-3 py-2 text-right">Structured</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-slate-200">
                  {data.report.bySubject.map((row) => (
                    <tr key={row.subject}>
                      <td className="px-3 py-2 font-medium">{row.subject}</td>
                      <td className="px-3 py-2 text-right font-mono tabular-nums">{row.noteCount}</td>
                      <td className="px-3 py-2 text-right font-mono tabular-nums">{row.totalWords}</td>
                      <td className="px-3 py-2 text-right font-mono tabular-nums">{row.structuredCount}</td>
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
