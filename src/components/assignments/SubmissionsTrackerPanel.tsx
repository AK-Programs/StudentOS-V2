import React, { useEffect, useState } from 'react';
import { ClipboardCheck, Loader2, RefreshCw, Send } from 'lucide-react';
import { Homework, UserProfile } from '../../types';
import { buildWorkspaceAuthHeaders } from '../../lib/workspaceIntelligenceClient';

interface TrackedSubmission {
  id: string;
  assignmentId: string;
  assignmentTitle: string;
  subject: string;
  classGrade: string;
  classSection: string;
  studentId: string;
  studentName: string;
  submissionText: string;
  status: string;
  isLate: boolean;
  submittedAt: string | null;
  score: number | null;
  maxScore: number;
  feedback: string;
}

interface SubmissionsTrackerPanelProps {
  currentUser: UserProfile | null;
  effectiveRole: string;
  homeworkList: Homework[];
}

export const SubmissionsTrackerPanel: React.FC<SubmissionsTrackerPanelProps> = ({
  currentUser,
  effectiveRole,
  homeworkList,
}) => {
  const isFaculty = ['teacher', 'faculty', 'head_teacher', 'coordinator', 'hod', 'admin', 'super_admin'].includes(
    effectiveRole
  );
  const [submissions, setSubmissions] = useState<TrackedSubmission[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Student submit state
  const [selectedHwId, setSelectedHwId] = useState(homeworkList[0]?.id || '');
  const [submissionText, setSubmissionText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Faculty grading state
  const [gradeDrafts, setGradeDrafts] = useState<Record<string, { score: string; feedback: string }>>({});

  const loadSubmissions = async () => {
    setLoading(true);
    setError('');
    try {
      const headers = await buildWorkspaceAuthHeaders(currentUser, effectiveRole);
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.set('status', statusFilter);
      const res = await fetch(`/api/assignments/submissions?${params.toString()}`, { headers });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || `Failed with HTTP ${res.status}`);
      setSubmissions(Array.isArray(data.submissions) ? data.submissions : []);
    } catch (err: any) {
      setError(err?.message || 'Failed to load submissions.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSubmissions();
  }, [statusFilter, currentUser?.uid, effectiveRole]);

  const handleSubmitWork = async () => {
    const hw = homeworkList.find((h) => h.id === selectedHwId) || homeworkList[0];
    const targetId = hw?.id || selectedHwId || 'hw_general';
    if (!submissionText.trim()) return;
    setSubmitting(true);
    setError('');
    try {
      const headers = await buildWorkspaceAuthHeaders(currentUser, effectiveRole);
      const res = await fetch('/api/assignments/submissions', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          userId: currentUser?.uid || 'guest',
          userRole: effectiveRole,
          userName: currentUser?.name || 'Student',
          assignmentId: targetId,
          assignmentTitle: hw?.title || 'Coursework Submission',
          subject: hw?.subject || 'General',
          classGrade: hw?.classGrade || currentUser?.grade || 'Grade 10',
          classSection: hw?.classSection || currentUser?.section || 'Solara',
          dueDate: hw?.dueDate,
          submissionText: submissionText.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || `Failed with HTTP ${res.status}`);
      setSubmissionText('');
      await loadSubmissions();
    } catch (err: any) {
      setError(err?.message || 'Submission failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleGrade = async (sub: TrackedSubmission) => {
    const draft = gradeDrafts[sub.id] || { score: String(sub.score ?? ''), feedback: sub.feedback || '' };
    setError('');
    try {
      const headers = await buildWorkspaceAuthHeaders(currentUser, effectiveRole);
      const res = await fetch(`/api/assignments/submissions/${encodeURIComponent(sub.id)}/grade`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          userId: currentUser?.uid || 'guest',
          userRole: effectiveRole,
          userName: currentUser?.name || 'Faculty',
          score: draft.score === '' ? null : Number(draft.score),
          maxScore: sub.maxScore,
          feedback: draft.feedback,
          resultsReleased: true,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || `Failed with HTTP ${res.status}`);
      await loadSubmissions();
    } catch (err: any) {
      setError(err?.message || 'Grading failed.');
    }
  };

  return (
    <div className="bg-slate-900/90 border border-white/10 rounded-2xl p-4 sm:p-5 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-3">
        <div>
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <ClipboardCheck className="w-4 h-4 text-indigo-400" />
            <span>Submissions Management &amp; Tracking</span>
          </h3>
          <p className="text-xs text-slate-400">
            {isFaculty
              ? 'Review student submissions, late indicators, scores, and feedback across cohorts.'
              : 'Submit coursework and track evaluation status and teacher feedback privately.'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-950 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white"
          >
            <option value="all">All Statuses</option>
            <option value="submitted">Submitted</option>
            <option value="late">Late</option>
            <option value="evaluated">Evaluated</option>
          </select>
          <button
            type="button"
            onClick={loadSubmissions}
            className="p-2 rounded-xl bg-slate-950 border border-white/10 text-slate-300 hover:text-white cursor-pointer"
            title="Refresh submissions"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {!isFaculty && (
        <div className="bg-slate-950/90 border border-white/10 rounded-xl p-3.5 space-y-2.5">
          <p className="text-xs font-semibold text-slate-200">Submit Assignment Work</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <select
              value={selectedHwId}
              onChange={(e) => setSelectedHwId(e.target.value)}
              className="bg-slate-900 border border-white/10 rounded-lg px-3 py-2 text-xs text-white"
            >
              {homeworkList.length === 0 ? (
                <option value="hw_general">General Assignment Submission</option>
              ) : (
                homeworkList.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.title} ({h.subject})
                  </option>
                ))
              )}
            </select>
            <button
              type="button"
              onClick={handleSubmitWork}
              disabled={submitting || !submissionText.trim()}
              className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
            >
              {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              <span>{submitting ? 'Submitting...' : 'Submit Response'}</span>
            </button>
          </div>
          <textarea
            rows={3}
            value={submissionText}
            onChange={(e) => setSubmissionText(e.target.value)}
            placeholder="Write your answers, methodology, or link to deliverables..."
            className="w-full bg-slate-900 border border-white/10 rounded-lg p-2.5 text-xs text-white placeholder-slate-500"
          />
        </div>
      )}

      {error && (
        <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300">{error}</div>
      )}

      {submissions.length === 0 ? (
        <div className="text-center py-8 bg-slate-950/70 rounded-xl border border-white/10 text-xs text-slate-400">
          No tracked submissions match your current filter.
        </div>
      ) : (
        <div className="space-y-2.5">
          {submissions.map((sub) => {
            const gDraft = gradeDrafts[sub.id] || {
              score: sub.score !== null ? String(sub.score) : '',
              feedback: sub.feedback || '',
            };
            return (
              <div key={sub.id} className="bg-slate-950/90 border border-white/10 rounded-xl p-3.5 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-xs font-bold text-white">{sub.assignmentTitle}</p>
                    <p className="text-[11px] text-slate-400">
                      {sub.studentName} · {sub.classGrade} ({sub.classSection}) · {sub.submittedAt ? new Date(sub.submittedAt).toLocaleString() : 'Not submitted'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {sub.isLate && (
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30">
                        LATE
                      </span>
                    )}
                    <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
                      {sub.status}
                    </span>
                    {sub.score !== null && (
                      <span className="text-xs font-mono font-bold text-emerald-400 tabular-nums">
                        {sub.score}/{sub.maxScore}
                      </span>
                    )}
                  </div>
                </div>

                {sub.submissionText && (
                  <p className="text-xs text-slate-300 bg-slate-900 p-2.5 rounded-lg border border-white/5 whitespace-pre-wrap">
                    {sub.submissionText}
                  </p>
                )}

                {sub.feedback && !isFaculty && (
                  <p className="text-xs text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 p-2.5 rounded-lg">
                    Teacher Feedback: {sub.feedback}
                  </p>
                )}

                {isFaculty && (
                  <div className="flex flex-col sm:flex-row gap-2 pt-1">
                    <input
                      type="number"
                      min={0}
                      max={sub.maxScore}
                      value={gDraft.score}
                      onChange={(e) =>
                        setGradeDrafts({ ...gradeDrafts, [sub.id]: { ...gDraft, score: e.target.value } })
                      }
                      placeholder={`Score / ${sub.maxScore}`}
                      className="w-28 bg-slate-900 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs font-mono text-white"
                    />
                    <input
                      type="text"
                      value={gDraft.feedback}
                      onChange={(e) =>
                        setGradeDrafts({ ...gradeDrafts, [sub.id]: { ...gDraft, feedback: e.target.value } })
                      }
                      placeholder="Constructive evaluation feedback..."
                      className="flex-1 bg-slate-900 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white"
                    />
                    <button
                      type="button"
                      onClick={() => handleGrade(sub)}
                      className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold cursor-pointer shrink-0"
                    >
                      Save Grade
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
