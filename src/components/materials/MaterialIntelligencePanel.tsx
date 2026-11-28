import React, { useState } from 'react';

type Item = { id?: string; title?: string; content?: string };
type Props = { currentUser?: { uid?: string; role?: string }; materials?: Item[] };

async function ask(prompt: string, user?: Props['currentUser']) {
  const res = await fetch('/api/ai/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, userId: user?.uid, userRole: user?.role, stream: false })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || data.message || `HTTP ${res.status}`);
  return data.text || data.reply || 'No answer.';
}

export function MaterialIntelligencePanel({ currentUser, materials = [] }: Props) {
  const [question, setQuestion] = useState('');
  const [subject, setSubject] = useState('');
  const [topic, setTopic] = useState('');
  const [answer, setAnswer] = useState('');
  const [recs, setRecs] = useState('');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  const titles = materials.map((m) => m.title).filter(Boolean).slice(0, 20).join(', ') || 'none listed';

  return (
    <div className="grid gap-3 md:grid-cols-2">
      <section className="rounded-2xl border border-white/10 bg-slate-950/80 p-4 space-y-3">
        <h3 className="text-sm font-semibold text-white">Ask your materials</h3>
        <p className="text-xs text-slate-400">Ask a question about files you can already open in Material Hub.</p>
        <textarea value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="What does the uploaded notes say about this topic?" className="w-full min-h-[80px] rounded-xl bg-slate-900 border border-white/10 px-3 py-2 text-sm text-white" />
        <button type="button" disabled={busy === 'ask'} onClick={async () => {
          setBusy('ask'); setError('');
          try {
            const context = materials.slice(0, 6).map((m, i) => `Source ${i + 1}: ${m.title || 'Untitled'}\n${String(m.content || '').slice(0, 1500)}`).join('\n\n');
            setAnswer(await ask(`Answer only from these materials. If they do not contain the answer, say so.\n\n${context}\n\nQuestion: ${question}`, currentUser));
          } catch (err: any) { setError(err.message); } finally { setBusy(''); }
        }} className="px-3 py-2 rounded-xl bg-indigo-600 text-white text-xs">Ask</button>
        {answer && <pre className="whitespace-pre-wrap text-sm text-slate-100">{answer}</pre>}
      </section>

      <section className="rounded-2xl border border-white/10 bg-slate-950/80 p-4 space-y-3">
        <h3 className="text-sm font-semibold text-white">Resource recommendations</h3>
        <p className="text-xs text-slate-400">Suggest study resources. Existing hub items are marked separately from new ideas.</p>
        <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject" className="w-full rounded-xl bg-slate-900 border border-white/10 px-3 py-2 text-sm text-white" />
        <input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Topic" className="w-full rounded-xl bg-slate-900 border border-white/10 px-3 py-2 text-sm text-white" />
        <button type="button" disabled={busy === 'rec'} onClick={async () => {
          setBusy('rec'); setError('');
          try {
            setRecs(await ask(`Recommend study resources for ${subject} / ${topic}. Existing Material Hub titles: ${titles}. Mark each as EXISTING or SUGGESTED. Do not invent URLs. Give one reason each.`, currentUser));
          } catch (err: any) { setError(err.message); } finally { setBusy(''); }
        }} className="px-3 py-2 rounded-xl bg-slate-800 text-white text-xs">Recommend</button>
        {recs && <pre className="whitespace-pre-wrap text-sm text-slate-100">{recs}</pre>}
      </section>
      {error && <p className="text-xs text-rose-300 md:col-span-2">{error}</p>}
    </div>
  );
}
