import React, { useState } from 'react';

const TABS = ['Builder', 'Notebook', 'Quality', 'Groups'] as const;

export function AssignmentUpgradesPanel({ currentUser }: { currentUser?: { uid?: string; role?: string } }) {
  const [tab, setTab] = useState<(typeof TABS)[number]>('Builder');
  const [subject, setSubject] = useState('Physics');
  const [topic, setTopic] = useState('');
  const [notes, setNotes] = useState('');
  const [result, setResult] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const run = async (prompt: string) => {
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, userId: currentUser?.uid, userRole: currentUser?.role, stream: false })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.message || `HTTP ${res.status}`);
      setResult(data.text || data.reply || 'No result.');
    } catch (err: any) {
      setError(err?.message || 'AI request failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-2xl border border-white/10 bg-slate-950/80 p-4 space-y-3">
      <div className="flex flex-wrap gap-2">
        {TABS.map((name) => (
          <button key={name} type="button" onClick={() => setTab(name)} className={`px-2 py-1.5 rounded-lg text-xs ${tab === name ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-200'}`}>{name}</button>
        ))}
      </div>
      <input value={subject} onChange={(e) => setSubject(e.target.value)} className="w-full rounded-xl bg-slate-900 border border-white/10 px-3 py-2 text-sm text-white" placeholder="Subject" />
      <input value={topic} onChange={(e) => setTopic(e.target.value)} className="w-full rounded-xl bg-slate-900 border border-white/10 px-3 py-2 text-sm text-white" placeholder="Topic" />
      <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full min-h-[90px] rounded-xl bg-slate-900 border border-white/10 px-3 py-2 text-sm text-white" placeholder="Paste notebook text or assignment text" />
      <button
        type="button"
        disabled={busy}
        onClick={() => run(
          tab === 'Builder' ? `Draft an assignment for ${subject} on ${topic}. Include questions and marks. Mark it as a draft.` :
          tab === 'Notebook' ? `Analyze this notebook for ${subject}. Do not invent missing work.\n${notes}` :
          tab === 'Quality' ? `Review this assignment quality. Do not publish it.\n${notes}` :
          `Plan a group project for ${subject} on ${topic} with milestones and roles.`
        )}
        className="px-3 py-2 rounded-xl bg-indigo-600 text-white text-xs"
      >
        {busy ? 'Workingâ€¦' : 'Run'}
      </button>
      {error && <p className="text-xs text-rose-300">{error}</p>}
      {result && <pre className="whitespace-pre-wrap text-sm text-slate-100">{result}</pre>}
    </section>
  );
}