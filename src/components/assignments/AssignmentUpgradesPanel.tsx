import React, { useState } from 'react';

const FEATURES = [
  { id: 'builder', label: 'AI Assignment Builder' },
  { id: 'notebook', label: 'Notebook Intelligence' },
  { id: 'quality', label: 'Quality Analyzer' },
  { id: 'reports', label: 'Notebook Reports' },
  { id: 'submissions', label: 'Submissions Tracker' },
  { id: 'groups', label: 'Group Projects' }
] as const;

type Feature = (typeof FEATURES)[number]['id'];

export function AssignmentUpgradesPanel() {
  const [active, setActive] = useState<Feature>('builder');
  const [subject, setSubject] = useState('Physics');
  const [topic, setTopic] = useState('');
  const [grade, setGrade] = useState('Grade 10');
  const [notes, setNotes] = useState('');
  const [result, setResult] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const run = async () => {
    setBusy(true); setError('');
    const prompts: Record<Feature, string> = {
      builder: `Draft an assignment for ${grade} ${subject} on ${topic}. Include objectives, questions, and marks. This is a draft for a teacher to review.`,
      notebook: `Analyze this notebook for ${subject}. List covered topics, missing topics, and improvements. Do not invent work.\n${notes}`,
      quality: `Review this assignment for clarity, alignment, difficulty, and marks. Do not publish it.\n${notes}`,
      reports: `Write a notebook completion report for ${grade} ${subject}. Use only this text.\n${notes}`,
      submissions: `Summarize submission tracking for ${subject} / ${topic}. Use only the notes below. Do not invent student names.\n${notes}`,
      groups: `Plan a group project for ${grade} ${subject} on ${topic}. Include roles, milestones, and a submission step.`
    };
    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: prompts[active], stream: false })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || data.message || `HTTP ${res.status}`);
      setResult(data.text || data.reply || 'No result.');
    } catch (err: any) {
      setError(err.message || 'Request failed.');
    } finally {
      setBusy(false);
    }
  };

  const needsNotes = active === 'notebook' || active === 'quality' || active === 'reports' || active === 'submissions';

  return (
    <section className="rounded-2xl border border-white/10 bg-slate-950/80 p-4 space-y-4">
      <div className="flex flex-wrap gap-2">
        {FEATURES.map((f) => (
          <button key={f.id} type="button" onClick={() => { setActive(f.id); setResult(''); }} className={`px-3 py-2 rounded-xl text-xs ${active === f.id ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-200'}`}>{f.label}</button>
        ))}
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject" className="rounded-xl bg-slate-900 border border-white/10 px-3 py-2 text-sm text-white" />
        <input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Topic" className="rounded-xl bg-slate-900 border border-white/10 px-3 py-2 text-sm text-white" />
        <input value={grade} onChange={(e) => setGrade(e.target.value)} placeholder="Grade" className="rounded-xl bg-slate-900 border border-white/10 px-3 py-2 text-sm text-white" />
      </div>
      {needsNotes && (
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Paste the notebook, assignment, or submission text for this feature" className="w-full min-h-[120px] rounded-xl bg-slate-900 border border-white/10 px-3 py-2 text-sm text-white" />
      )}
      <button type="button" onClick={run} disabled={busy} className="px-3 py-2 rounded-xl bg-indigo-600 text-white text-xs">{busy ? 'Working...' : FEATURES.find((f) => f.id === active)?.label}</button>
      {error && <p className="text-xs text-rose-300">{error}</p>}
      {result && <pre className="whitespace-pre-wrap text-sm text-slate-100">{result}</pre>}
    </section>
  );
}
