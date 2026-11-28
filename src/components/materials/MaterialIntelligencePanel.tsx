import React, { useState } from 'react';

type Props = {
  currentUser?: { uid?: string; role?: string };
  materials?: { id?: string; title?: string; content?: string }[];
};

export function MaterialIntelligencePanel({ currentUser, materials = [] }: Props) {
  const [question, setQuestion] = useState('');
  const [topic, setTopic] = useState('');
  const [answer, setAnswer] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const ask = async (mode: 'ask' | 'recommend') => {
    setBusy(true);
    setError('');
    try {
      const prompt = mode === 'ask'
        ? question
        : `Recommend resources for ${topic}. Existing titles: ${materials.map((m) => m.title).filter(Boolean).join(', ')}`;
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          userId: currentUser?.uid,
          userRole: currentUser?.role,
          persona: 'study_buddy',
          stream: false
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.message || `HTTP ${res.status}`);
      setAnswer(data.text || data.reply || 'No answer.');
    } catch (err: any) {
      setError(err?.message || 'Could not ask the AI server.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-2xl border border-white/10 bg-slate-950/80 p-4 space-y-3">
      <h3 className="text-sm font-semibold text-white">Ask your materials</h3>
      <textarea
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        placeholder="Ask about a file in Material Hub"
        className="w-full min-h-[72px] rounded-xl bg-slate-900 border border-white/10 px-3 py-2 text-sm text-white"
      />
      <div className="flex gap-2">
        <button type="button" onClick={() => ask('ask')} disabled={busy} className="px-3 py-2 rounded-xl bg-indigo-600 text-white text-xs">Ask</button>
        <input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Topic for recommendations" className="flex-1 rounded-xl bg-slate-900 border border-white/10 px-3 text-sm text-white" />
        <button type="button" onClick={() => ask('recommend')} disabled={busy} className="px-3 py-2 rounded-xl bg-slate-800 text-white text-xs">Recommend</button>
      </div>
      {error && <p className="text-xs text-rose-300">{error}</p>}
      {answer && <pre className="whitespace-pre-wrap text-sm text-slate-100">{answer}</pre>}
    </section>
  );
}
