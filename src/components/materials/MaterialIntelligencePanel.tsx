import React, { useState } from 'react';
import { BookOpen, Compass, Loader2, Search, Send, Sparkles, AlertCircle, CheckCircle2, FileText } from 'lucide-react';
import { MaterialResource, UserProfile } from '../../types';
import { buildWorkspaceAuthHeaders } from '../../lib/workspaceIntelligenceClient';

interface MaterialCitation {
  materialId: string;
  title: string;
  subject: string;
  sectionOrPage: string;
  excerpt: string;
  score: number;
}

interface AskTurn {
  role: 'user' | 'assistant';
  content: string;
  foundInMaterials?: boolean;
  citations?: MaterialCitation[];
  disclaimer?: string;
}

interface InternalRecommendation {
  materialId: string;
  title: string;
  subject: string;
  type: string;
  isVerified: boolean;
  reason: string;
  relevanceScore: number;
}

interface ExternalSuggestion {
  label: string;
  title: string;
  resourceType: string;
  suggestedSearchQuery: string;
  reason: string;
}

interface MaterialIntelligencePanelProps {
  currentUser: UserProfile | null;
  effectiveRole: string;
  materials: MaterialResource[];
  onSelectMaterial?: (mat: MaterialResource) => void;
}

export const MaterialIntelligencePanel: React.FC<MaterialIntelligencePanelProps> = ({
  currentUser,
  effectiveRole,
  materials,
  onSelectMaterial,
}) => {
  const [activeMode, setActiveMode] = useState<'ask' | 'recommend'>('ask');

  // Ask to Materials state
  const [question, setQuestion] = useState('');
  const [subjectScope, setSubjectScope] = useState('All');
  const [selectedMaterialId, setSelectedMaterialId] = useState('');
  const [askLoading, setAskLoading] = useState(false);
  const [askError, setAskError] = useState('');
  const [turns, setTurns] = useState<AskTurn[]>([]);
  const [followUps, setFollowUps] = useState<string[]>([]);

  // Recommendations state
  const [recSubject, setRecSubject] = useState('All');
  const [recTopic, setRecTopic] = useState('');
  const [recWeakAreas, setRecWeakAreas] = useState('');
  const [recLoading, setRecLoading] = useState(false);
  const [recError, setRecError] = useState('');
  const [internalRecs, setInternalRecs] = useState<InternalRecommendation[]>([]);
  const [externalRecs, setExternalRecs] = useState<ExternalSuggestion[]>([]);
  const [externalDisclaimer, setExternalDisclaimer] = useState('');

  // Client-side pre-filter mirrors server-side visibility rules for payload hygiene
  const authorizedClientMaterials = materials.filter((m) => {
    const vis = String(m.visibility || 'student').toLowerCase();
    const isStaff = ['teacher', 'coordinator', 'hod', 'admin', 'super_admin'].includes(effectiveRole);
    if ((vis === 'teacher' || vis === 'faculty') && !isStaff) return false;
    if (vis === 'private' && m.uploaderUid && m.uploaderUid !== currentUser?.uid && !['admin', 'super_admin'].includes(effectiveRole)) {
      return false;
    }
    return true;
  });

  const handleAsk = async (customQuestion?: string) => {
    const q = (customQuestion ?? question).trim();
    if (!q || askLoading) return;
    setAskLoading(true);
    setAskError('');
    const nextTurns: AskTurn[] = [...turns, { role: 'user', content: q }];
    setTurns(nextTurns);
    if (!customQuestion) setQuestion('');

    try {
      const headers = await buildWorkspaceAuthHeaders(currentUser, effectiveRole);
      const res = await fetch('/api/materials/ask', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          userId: currentUser?.uid || 'guest',
          userRole: effectiveRole,
          question: q,
          subject: subjectScope,
          materialId: selectedMaterialId || undefined,
          history: turns.slice(-6).map((t) => ({ role: t.role, content: t.content })),
          materials: authorizedClientMaterials.slice(0, 60).map((m) => ({
            id: m.id,
            title: m.title,
            subject: m.subject,
            type: m.type,
            description: m.description,
            aiSummary: m.aiSummary,
            fileName: m.fileName,
            visibility: m.visibility,
            uploaderUid: m.uploaderUid,
            isPublic: m.isPublic,
            isVerified: m.isVerified,
            visibleToGrades: m.visibleToGrades,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || `Failed with HTTP ${res.status}`);
      }
      setTurns([
        ...nextTurns,
        {
          role: 'assistant',
          content: data.answer,
          foundInMaterials: Boolean(data.foundInMaterials),
          citations: Array.isArray(data.citations) ? data.citations : [],
          disclaimer: data.disclaimer,
        },
      ]);
      setFollowUps(Array.isArray(data.followUpSuggestions) ? data.followUpSuggestions : []);
    } catch (err: any) {
      setAskError(err?.message || 'Unable to query Material Hub.');
    } finally {
      setAskLoading(false);
    }
  };

  const handleGetRecommendations = async () => {
    setRecLoading(true);
    setRecError('');
    try {
      const headers = await buildWorkspaceAuthHeaders(currentUser, effectiveRole);
      const res = await fetch('/api/materials/recommendations', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          userId: currentUser?.uid || 'guest',
          userRole: effectiveRole,
          subject: recSubject === 'All' ? '' : recSubject,
          topic: recTopic.trim(),
          grade: currentUser?.grade || 'Grade 10',
          weakAreas: recWeakAreas
            .split(',')
            .map((w) => w.trim())
            .filter(Boolean),
          materials: authorizedClientMaterials.slice(0, 60).map((m) => ({
            id: m.id,
            title: m.title,
            subject: m.subject,
            type: m.type,
            description: m.description,
            visibility: m.visibility,
            uploaderUid: m.uploaderUid,
            isPublic: m.isPublic,
            isVerified: m.isVerified,
            downloads: m.downloads,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || `Failed with HTTP ${res.status}`);
      }
      setInternalRecs(Array.isArray(data.internalRecommendations) ? data.internalRecommendations : []);
      setExternalRecs(Array.isArray(data.externalSuggestions) ? data.externalSuggestions : []);
      setExternalDisclaimer(data.externalDisclaimer || '');
    } catch (err: any) {
      setRecError(err?.message || 'Failed to generate recommendations.');
    } finally {
      setRecLoading(false);
    }
  };

  const subjects = ['All', 'Mathematics', 'Physics', 'Chemistry', 'Biology', 'Computer Science', 'English', 'Social Science', 'General'];

  return (
    <div className="bg-slate-900/90 border border-white/10 rounded-2xl p-4 sm:p-5 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-3.5">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2 text-xs font-semibold text-indigo-400">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Material Hub Intelligence</span>
          </div>
          <h4 className="text-base font-bold text-white tracking-tight">
            Grounded Document Q&amp;A &amp; Study Discovery
          </h4>
        </div>

        <div className="flex items-center gap-1.5 bg-slate-950/90 p-1 rounded-xl border border-white/10 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setActiveMode('ask')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
              activeMode === 'ask' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Ask to Materials</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveMode('recommend')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
              activeMode === 'recommend' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Compass className="w-3.5 h-3.5" />
            <span>Resources Recommendations</span>
          </button>
        </div>
      </div>

      {activeMode === 'ask' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <select
              value={subjectScope}
              onChange={(e) => setSubjectScope(e.target.value)}
              aria-label="Filter Q&A by subject"
              className="bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
            >
              {subjects.map((s) => (
                <option key={s} value={s}>
                  {s === 'All' ? 'Scope: All Authorized Subjects' : `Subject: ${s}`}
                </option>
              ))}
            </select>

            <select
              value={selectedMaterialId}
              onChange={(e) => setSelectedMaterialId(e.target.value)}
              aria-label="Scope Q&A to specific material"
              className="bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
            >
              <option value="">Search across {authorizedClientMaterials.length} authorized files</option>
              {authorizedClientMaterials.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.title} ({m.subject})
                </option>
              ))}
            </select>
          </div>

          {turns.length > 0 && (
            <div className="space-y-3 max-h-[340px] overflow-y-auto pr-1">
              {turns.map((t, idx) => (
                <div
                  key={idx}
                  className={`p-3.5 rounded-xl border text-xs leading-relaxed space-y-2.5 ${
                    t.role === 'user'
                      ? 'bg-indigo-600/15 border-indigo-500/30 text-white ml-4 sm:ml-10'
                      : 'bg-slate-950/90 border-white/10 text-slate-200 mr-2 sm:mr-6'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      {t.role === 'user' ? 'Your Question' : 'Material Hub Answer'}
                    </span>
                    {t.role === 'assistant' && typeof t.foundInMaterials === 'boolean' && (
                      <span
                        className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-md border ${
                          t.foundInMaterials
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                            : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                        }`}
                      >
                        {t.foundInMaterials ? (
                          <>
                            <CheckCircle2 className="w-3 h-3" /> Grounded in Materials
                          </>
                        ) : (
                          <>
                            <AlertCircle className="w-3 h-3" /> Not Found in Materials
                          </>
                        )}
                      </span>
                    )}
                  </div>

                  <div className="whitespace-pre-wrap">{t.content}</div>

                  {t.citations && t.citations.length > 0 && (
                    <div className="pt-2 border-t border-white/10 space-y-1.5">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-300">
                        Verified Source Citations ({t.citations.length})
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {t.citations.map((cit, cIdx) => (
                          <div
                            key={`${cit.materialId}-${cIdx}`}
                            onClick={() => {
                              const found = authorizedClientMaterials.find((m) => m.id === cit.materialId);
                              if (found && onSelectMaterial) onSelectMaterial(found);
                            }}
                            className="p-2.5 rounded-lg bg-slate-900 border border-white/10 hover:border-indigo-500/40 cursor-pointer space-y-1"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-semibold text-white truncate flex items-center gap-1">
                                <FileText className="w-3 h-3 text-indigo-400 shrink-0" />
                                [{cIdx + 1}] {cit.title}
                              </span>
                            </div>
                            <p className="text-[10px] font-mono text-indigo-300">{cit.sectionOrPage}</p>
                            <p className="text-[11px] text-slate-400 line-clamp-2">{cit.excerpt}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {followUps.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {followUps.map((f, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => handleAsk(f)}
                  className="text-[11px] bg-slate-950 hover:bg-indigo-600/20 text-indigo-300 border border-indigo-500/25 px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
                >
                  {f}
                </button>
              ))}
            </div>
          )}

          {askError && (
            <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300">
              {askError}
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAsk();
                  }
                }}
                placeholder="Ask a question grounded in your Material Hub notes & PDFs..."
                className="w-full pl-9 pr-3 py-2.5 bg-slate-950 border border-white/10 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-3" />
            </div>
            <button
              type="button"
              onClick={() => handleAsk()}
              disabled={askLoading || !question.trim()}
              className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
            >
              {askLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              <span>{askLoading ? 'Searching...' : 'Ask Materials'}</span>
            </button>
          </div>
        </div>
      )}

      {activeMode === 'recommend' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <select
              value={recSubject}
              onChange={(e) => setRecSubject(e.target.value)}
              className="bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
            >
              {subjects.map((s) => (
                <option key={s} value={s}>
                  {s === 'All' ? 'All Subjects' : s}
                </option>
              ))}
            </select>
            <input
              type="text"
              value={recTopic}
              onChange={(e) => setRecTopic(e.target.value)}
              placeholder="Current chapter or topic (e.g. AVL Trees)"
              className="bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
            <input
              type="text"
              value={recWeakAreas}
              onChange={(e) => setRecWeakAreas(e.target.value)}
              placeholder="Weak areas (comma-separated)"
              className="bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <button
            type="button"
            onClick={handleGetRecommendations}
            disabled={recLoading}
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
          >
            {recLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Compass className="w-3.5 h-3.5" />}
            <span>{recLoading ? 'Finding Resources...' : 'Recommend Study Resources'}</span>
          </button>

          {recError && (
            <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300">
              {recError}
            </div>
          )}

          {(internalRecs.length > 0 || externalRecs.length > 0) && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Internal Material Hub Matches */}
              <div className="bg-slate-950/90 border border-white/10 rounded-xl p-3.5 space-y-2.5">
                <div className="flex items-center justify-between border-b border-white/10 pb-2">
                  <h5 className="text-xs font-bold text-emerald-400">
                    Inside Material Hub ({internalRecs.length})
                  </h5>
                  <span className="text-[10px] font-mono text-slate-400">Authorized Files</span>
                </div>
                {internalRecs.length === 0 ? (
                  <p className="text-xs text-slate-400">No close matches found in current Material Hub files.</p>
                ) : (
                  <div className="space-y-2">
                    {internalRecs.map((item) => (
                      <div
                        key={item.materialId}
                        onClick={() => {
                          const mat = authorizedClientMaterials.find((m) => m.id === item.materialId);
                          if (mat && onSelectMaterial) onSelectMaterial(mat);
                        }}
                        className="p-2.5 rounded-lg bg-slate-900 border border-white/10 hover:border-emerald-500/40 cursor-pointer space-y-1"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-semibold text-white truncate">{item.title}</span>
                          <span className="text-[10px] font-mono text-emerald-300 shrink-0">
                            {item.subject}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400">{item.reason}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Clearly Labeled External Study Suggestions */}
              <div className="bg-slate-950/90 border border-amber-500/20 rounded-xl p-3.5 space-y-2.5">
                <div className="flex items-center justify-between border-b border-white/10 pb-2">
                  <h5 className="text-xs font-bold text-amber-300">
                    External Study Suggestions ({externalRecs.length})
                  </h5>
                  <span className="text-[10px] font-mono text-amber-400/80">Outside Material Hub</span>
                </div>
                <div className="space-y-2">
                  {externalRecs.map((ext, idx) => (
                    <div key={idx} className="p-2.5 rounded-lg bg-slate-900 border border-white/10 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-white">{ext.title}</span>
                        <span className="text-[10px] font-mono text-amber-300 shrink-0">{ext.resourceType}</span>
                      </div>
                      <p className="text-[11px] text-slate-400">{ext.reason}</p>
                      <p className="text-[10px] font-mono text-slate-300 bg-slate-950 px-2 py-1 rounded border border-white/5">
                        Suggested search: {ext.suggestedSearchQuery}
                      </p>
                    </div>
                  ))}
                </div>
                {externalDisclaimer && (
                  <p className="text-[10px] text-slate-400 pt-1">{externalDisclaimer}</p>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
