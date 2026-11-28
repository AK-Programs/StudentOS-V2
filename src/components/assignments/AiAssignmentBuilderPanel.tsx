import React, { useState } from 'react';
import { FilePlus2, Loader2, CheckCircle2, Lock, Send } from 'lucide-react';
import { UserProfile } from '../../types';
import { buildWorkspaceAuthHeaders } from '../../lib/workspaceIntelligenceClient';

interface DraftQuestion {
  id: string;
  prompt: string;
  type: string;
  difficulty: string;
  marks: number;
  answerKey?: string;
}

interface AssignmentDraft {
  id: string;
  title: string;
  subject: string;
  classGrade: string;
  classSection: string;
  dueDate: string;
  maxScore: number;
  instructions: string;
  objectives: string[];
  questions: DraftQuestion[];
  rubric: string[];
  status: 'draft' | 'published';
  confirmed: boolean;
}

interface AiAssignmentBuilderPanelProps {
  currentUser: UserProfile | null;
  effectiveRole: string;
  onPublished?: () => void;
}

export const AiAssignmentBuilderPanel: React.FC<AiAssignmentBuilderPanelProps> = ({
  currentUser,
  effectiveRole,
  onPublished,
}) => {
  const isFaculty = ['teacher', 'faculty', 'head_teacher', 'coordinator', 'hod', 'admin', 'super_admin'].includes(
    effectiveRole
  );

  const [subject, setSubject] = useState('Physics');
  const [topic, setTopic] = useState('');
  const [classGrade, setClassGrade] = useState('Grade 10');
  const [classSection, setClassSection] = useState('All Sections');
  const [difficulty, setDifficulty] = useState<'Easy' | 'Medium' | 'Hard'>('Medium');
  const [questionCount, setQuestionCount] = useState(4);
  const [dueDate, setDueDate] = useState(new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0]);

  const [loading, setLoading] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState('');
  const [statusMsg, setStatusMsg] = useState('');
  const [draft, setDraft] = useState<AssignmentDraft | null>(null);
  const [confirmedReview, setConfirmedReview] = useState(false);

  if (!isFaculty) {
    return (
      <div className="bg-slate-900/90 border border-white/10 rounded-2xl p-6 text-center space-y-2">
        <Lock className="w-6 h-6 text-slate-400 mx-auto" />
        <h3 className="text-sm font-bold text-white">Faculty-Only Tool</h3>
        <p className="text-xs text-slate-400">
          AI Assignment Builder is restricted to teachers, coordinators, and administrators.
        </p>
      </div>
    );
  }

  const handleBuildDraft = async () => {
    if (!topic.trim()) return;
    setLoading(true);
    setError('');
    setStatusMsg('');
    setConfirmedReview(false);
    try {
      const headers = await buildWorkspaceAuthHeaders(currentUser, effectiveRole);
      const res = await fetch('/api/assignments/ai-builder', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          userId: currentUser?.uid || 'guest',
          userRole: effectiveRole,
          userName: currentUser?.name || 'Faculty',
          subject,
          topic: topic.trim(),
          classGrade,
          classSection,
          difficulty,
          questionCount,
          dueDate,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || `Failed with HTTP ${res.status}`);
      setDraft(data.draft);
      setStatusMsg('Draft generated. Review and edit fields below before confirming publication.');
    } catch (err: any) {
      setError(err?.message || 'Failed to build draft.');
    } finally {
      setLoading(false);
    }
  };

  const handlePublish = async () => {
    if (!draft || !confirmedReview) return;
    setPublishing(true);
    setError('');
    try {
      const headers = await buildWorkspaceAuthHeaders(currentUser, effectiveRole);
      const res = await fetch(`/api/assignments/drafts/${encodeURIComponent(draft.id)}/publish`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          userId: currentUser?.uid || 'guest',
          userRole: effectiveRole,
          userName: currentUser?.name || 'Faculty',
          confirmed: true,
          title: draft.title,
          instructions: draft.instructions,
          dueDate: draft.dueDate,
          classGrade: draft.classGrade,
          classSection: draft.classSection,
          questions: draft.questions,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || `Failed with HTTP ${res.status}`);
      setDraft(data.draft);
      setStatusMsg(`Assignment "${data.draft.title}" published to ${draft.classGrade} (${draft.classSection}).`);
      if (onPublished) onPublished();
    } catch (err: any) {
      setError(err?.message || 'Publish failed.');
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div className="bg-slate-900/90 border border-white/10 rounded-2xl p-4 sm:p-5 space-y-4">
      <div className="border-b border-white/10 pb-3">
        <h3 className="text-base font-bold text-white flex items-center gap-2">
          <FilePlus2 className="w-4 h-4 text-indigo-400" />
          <span>AI Assignment Builder (Draft &amp; Confirmation Gate)</span>
        </h3>
        <p className="text-xs text-slate-400">
          Generates structured drafts only. Faculty must review, edit, and explicitly confirm before publishing to students.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
        <input
          type="text"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Subject"
          className="bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
        />
        <input
          type="text"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="Topic (e.g. Rotational Torque)"
          className="sm:col-span-2 bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
        />
        <select
          value={classGrade}
          onChange={(e) => setClassGrade(e.target.value)}
          className="bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white"
        >
          {['Grade 8', 'Grade 9', 'Grade 10', 'Grade 11', 'Grade 12'].map((g) => (
            <option key={g} value={g}>{g}</option>
          ))}
        </select>
        <select
          value={difficulty}
          onChange={(e) => setDifficulty(e.target.value as 'Easy' | 'Medium' | 'Hard')}
          className="bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white"
        >
          <option value="Easy">Easy</option>
          <option value="Medium">Medium</option>
          <option value="Hard">Hard</option>
        </select>
        <button
          type="button"
          onClick={handleBuildDraft}
          disabled={loading || !topic.trim()}
          className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
        >
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FilePlus2 className="w-3.5 h-3.5" />}
          <span>{loading ? 'Drafting...' : 'Build Draft'}</span>
        </button>
      </div>

      {error && (
        <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300">{error}</div>
      )}
      {statusMsg && (
        <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-300 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{statusMsg}</span>
        </div>
      )}

      {draft && (
        <div className="bg-slate-950/90 border border-white/10 rounded-xl p-4 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-[11px] font-mono uppercase px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30">
              Status: {draft.status}
            </span>
            <span className="text-xs font-mono text-slate-400">
              Total Marks: {draft.questions.reduce((s, q) => s + Number(q.marks || 0), 0)}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">Assignment Title (Editable)</label>
              <input
                type="text"
                value={draft.title}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                className="w-full bg-slate-900 border border-white/10 rounded-lg px-3 py-2 text-xs text-white"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">Due Date</label>
              <input
                type="date"
                value={draft.dueDate}
                onChange={(e) => {
                  setDueDate(e.target.value);
                  setDraft({ ...draft, dueDate: e.target.value });
                }}
                className="w-full bg-slate-900 border border-white/10 rounded-lg px-3 py-2 text-xs text-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-400 mb-1">Instructions (Editable)</label>
            <textarea
              rows={2}
              value={draft.instructions}
              onChange={(e) => setDraft({ ...draft, instructions: e.target.value })}
              className="w-full bg-slate-900 border border-white/10 rounded-lg p-2.5 text-xs text-white"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-[11px] font-semibold text-slate-400">Draft Questions ({draft.questions.length})</label>
            {draft.questions.map((q, idx) => (
              <div key={q.id} className="p-3 rounded-lg bg-slate-900 border border-white/10 space-y-2">
                <div className="flex items-center justify-between gap-2 text-[11px] text-slate-400">
                  <span>Question {idx + 1} · {q.type} · {q.difficulty}</span>
                  <div className="flex items-center gap-1.5">
                    <span>Marks:</span>
                    <input
                      type="number"
                      min={1}
                      max={100}
                      value={q.marks}
                      onChange={(e) => {
                        const next = [...draft.questions];
                        next[idx] = { ...q, marks: Math.max(1, Number(e.target.value || 1)) };
                        setDraft({ ...draft, questions: next });
                      }}
                      className="w-14 bg-slate-950 border border-white/10 rounded px-2 py-0.5 text-xs font-mono text-white"
                    />
                  </div>
                </div>
                <textarea
                  rows={2}
                  value={q.prompt}
                  onChange={(e) => {
                    const next = [...draft.questions];
                    next[idx] = { ...q, prompt: e.target.value };
                    setDraft({ ...draft, questions: next });
                  }}
                  className="w-full bg-slate-950 border border-white/10 rounded px-2.5 py-1.5 text-xs text-white"
                />
              </div>
            ))}
          </div>

          {draft.status !== 'published' && (
            <div className="pt-2 border-t border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={confirmedReview}
                  onChange={(e) => setConfirmedReview(e.target.checked)}
                  className="rounded border-white/20"
                />
                <span>I reviewed and edited this draft and confirm publishing it to {draft.classGrade}.</span>
              </label>

              <button
                type="button"
                onClick={handlePublish}
                disabled={!confirmedReview || publishing}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
              >
                {publishing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                <span>{publishing ? 'Publishing...' : 'Confirm & Publish'}</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
