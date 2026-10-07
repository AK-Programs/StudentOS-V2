import React, { useState, useEffect, useRef } from 'react';
import {
  BookOpen, Users, Save, Sparkles, Clock, Check, Eye, Edit3, Plus,
  Trash2, Search, Download, Brain, Wand2, ListChecks, FileText, Columns, Phone
} from 'lucide-react';
import { UserProfile } from '../types';
import { supabase } from '../lib/supabase';
import { sendRealtimeEvent, subscribeRealtimeEvents } from '../lib/wsHelper';
import { saveStudyOutputToFlashcards, formatMathematicalText } from '../lib/studentosAiEngine';
import { startSchoolCall } from '../lib/callService';

interface CollaborativeLectureNotesProps {
  currentUser: UserProfile | null;
  lectureId?: string;
  lectureTitle?: string;
  subject?: string;
}

interface LectureNoteItem {
  id: string;
  title: string;
  content: string;
  subject: string;
  updatedAt: string;
  authorName?: string;
  userId?: string;
}

const AVAILABLE_SUBJECTS = [
  'All Subjects',
  'Mathematics',
  'Physics',
  'Chemistry',
  'Biology',
  'Computer Science',
  'English',
  'Economics',
  'History',
  'Geography'
];

const LOCAL_STORAGE_KEY = 'studentos_lecture_notes_v2';

export const CollaborativeLectureNotes: React.FC<CollaborativeLectureNotesProps> = ({
  currentUser,
  lectureId = 'global_lecture_notes_default',
  lectureTitle = 'Live Collaborative Lecture Notes',
  subject = 'Mathematics',
}) => {
  const [notesList, setNotesList] = useState<LectureNoteItem[]>(() => {
    try {
      const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (_) {}
    return [
      {
        id: lectureId,
        title: lectureTitle,
        content: '# Lecture Overview\n\nStart typing live classroom notes, formulas, and key definitions here.\n\n> 💡 **Tip:** Use the AI Study tools above to summarize or convert notes into flashcards.',
        subject,
        updatedAt: new Date().toISOString(),
        authorName: currentUser?.name || 'Instructor',
        userId: currentUser?.uid || 'shared'
      }
    ];
  });

  const [activeNoteId, setActiveNoteId] = useState<string>(lectureId);
  const [content, setContent] = useState<string>('');
  const [title, setTitle] = useState<string>(lectureTitle);
  const [currentSubject, setCurrentSubject] = useState<string>(subject);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [subjectFilter, setSubjectFilter] = useState<string>('All Subjects');
  const [viewMode, setViewMode] = useState<'write' | 'split' | 'preview'>('write');
  const [isSaving, setIsSaving] = useState(false);
  const [saveStateLabel, setSaveStateLabel] = useState<string>('Synced');
  const [lastSavedTime, setLastSavedTime] = useState<string>('');
  const [activeEditors, setActiveEditors] = useState<{ uid: string; name: string; avatar?: string }[]>([]);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [aiBusy, setAiBusy] = useState<string | null>(null);
  const [statusToast, setStatusToast] = useState<string | null>(null);

  const debounceTimerRef = useRef<any>(null);
  const channelRef = useRef<any>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const showToast = (msg: string) => {
    setStatusToast(msg);
    setTimeout(() => setStatusToast(prev => (prev === msg ? null : prev)), 3500);
  };

  // Persist notesList to localStorage
  const persistLocalNotes = (items: LectureNoteItem[]) => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(items));
    } catch (_) {}
  };

  // Load all lecture notes from Supabase + local cache on mount
  useEffect(() => {
    let mounted = true;
    const loadAllLectureNotes = async () => {
      try {
        const mergedMap = new Map<string, LectureNoteItem>();
        notesList.forEach(item => mergedMap.set(item.id, item));

        const { data: lectureRows, error: lErr } = await supabase
          .from('lecture_notes')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(50);

        if (!lErr && Array.isArray(lectureRows)) {
          lectureRows.forEach((row: any) => {
            mergedMap.set(row.id, {
              id: row.id,
              title: row.title || 'Untitled Lecture Note',
              content: row.content || '',
              subject: row.subject || 'Mathematics',
              updatedAt: row.created_at || new Date().toISOString(),
              userId: row.user_id
            });
          });
        }

        const { data: vaultRows } = await supabase
          .from('notes')
          .select('*')
          .or(`id.eq.${lectureId},id.like.lecture_%`)
          .order('created_at', { ascending: false })
          .limit(50);

        if (Array.isArray(vaultRows)) {
          vaultRows.forEach((row: any) => {
            if (!mergedMap.has(row.id)) {
              mergedMap.set(row.id, {
                id: row.id,
                title: row.title || 'Untitled Lecture Note',
                content: row.content || '',
                subject: row.subject || 'Mathematics',
                updatedAt: row.created_at || new Date().toISOString(),
                userId: row.user_id
              });
            }
          });
        }

        if (!mounted) return;
        const finalItems = Array.from(mergedMap.values());
        if (finalItems.length > 0) {
          setNotesList(finalItems);
          persistLocalNotes(finalItems);
          const current = finalItems.find(n => n.id === activeNoteId) || finalItems[0];
          if (current) {
            setActiveNoteId(current.id);
            setTitle(current.title);
            setContent(current.content);
            setCurrentSubject(current.subject || 'Mathematics');
            if (current.updatedAt) {
              setLastSavedTime(new Date(current.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
            }
          }
        }
      } catch (_) {}
    };

    loadAllLectureNotes();
    return () => {
      mounted = false;
    };
  }, []);

  // Sync active note fields when activeNoteId changes
  useEffect(() => {
    const found = notesList.find(n => n.id === activeNoteId);
    if (found) {
      setTitle(found.title);
      setContent(found.content);
      setCurrentSubject(found.subject || 'Mathematics');
    }
  }, [activeNoteId]);

  // Setup RealtimeBus + Supabase Presence for activeNoteId
  useEffect(() => {
    const channelName = `lecture_collab_${activeNoteId}`;

    const unsubscribeBus = subscribeRealtimeEvents(channelName, {
      note_content_changed: (payload: any) => {
        if (payload && payload.senderUid !== currentUser?.uid) {
          if (typeof payload.content === 'string') setContent(payload.content);
          if (payload.title) setTitle(payload.title);
          if (payload.subject) setCurrentSubject(payload.subject);
          setNotesList(prev => {
            const updated = prev.map(n =>
              n.id === activeNoteId
                ? {
                    ...n,
                    content: typeof payload.content === 'string' ? payload.content : n.content,
                    title: payload.title || n.title,
                    subject: payload.subject || n.subject,
                    updatedAt: new Date().toISOString()
                  }
                : n
            );
            persistLocalNotes(updated);
            return updated;
          });
        }
      }
    });

    const channel = supabase.channel(`presence_${channelName}`, {
      config: {
        presence: {
          key: currentUser?.uid || 'guest',
        },
      },
    });

    channelRef.current = channel;

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const editors: { uid: string; name: string; avatar?: string }[] = [];
        Object.keys(state).forEach((k) => {
          const pres = state[k] as any[];
          if (pres && pres[0]) {
            editors.push({
              uid: pres[0].uid,
              name: pres[0].name,
              avatar: pres[0].avatar,
            });
          }
        });
        setActiveEditors(editors);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED' && currentUser) {
          await channel.track({
            uid: currentUser.uid,
            name: currentUser.name,
            avatar: currentUser.avatar,
          });
        }
      });

    return () => {
      unsubscribeBus();
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [activeNoteId, currentUser?.uid]);

  const flushSaveToCloud = async (noteId: string, newText: string, newTitle: string, newSubject: string) => {
    setIsSaving(true);
    setSaveStateLabel('Saving...');
    const nowIso = new Date().toISOString();

    setNotesList(prev => {
      const exists = prev.some(n => n.id === noteId);
      const updated = exists
        ? prev.map(n =>
            n.id === noteId
              ? { ...n, title: newTitle, content: newText, subject: newSubject, updatedAt: nowIso }
              : n
          )
        : [
            {
              id: noteId,
              title: newTitle,
              content: newText,
              subject: newSubject,
              updatedAt: nowIso,
              authorName: currentUser?.name || 'Student',
              userId: currentUser?.uid || 'shared'
            },
            ...prev
          ];
      persistLocalNotes(updated);
      return updated;
    });

    try {
      const payload = {
        id: noteId,
        title: newTitle,
        content: newText,
        subject: newSubject,
        icon: '📝',
        cover_bg: 'bg-indigo-900',
        user_id: currentUser?.uid || 'shared',
        created_at: nowIso,
      };

      const { error: lErr } = await supabase.from('lecture_notes').upsert(payload);
      if (lErr) {
        await supabase.from('notes').upsert(payload);
      }
      setIsSaving(false);
      setSaveStateLabel('Synced to Cloud');
      setLastSavedTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    } catch (err) {
      setIsSaving(false);
      setSaveStateLabel('Saved Locally');
      setLastSavedTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    }
  };

  const saveAndBroadcast = (newText: string, newTitle: string, newSubject: string) => {
    sendRealtimeEvent(`lecture_collab_${activeNoteId}`, 'note_content_changed', {
      content: newText,
      title: newTitle,
      subject: newSubject,
      senderUid: currentUser?.uid,
    });

    setIsSaving(true);
    setSaveStateLabel('Saving...');
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    const targetId = activeNoteId;
    debounceTimerRef.current = setTimeout(() => {
      flushSaveToCloud(targetId, newText, newTitle, newSubject);
    }, 450);
  };

  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newText = e.target.value;
    setContent(newText);
    saveAndBroadcast(newText, title, currentSubject);
  };

  const handleSubjectChange = (newSub: string) => {
    setCurrentSubject(newSub);
    saveAndBroadcast(content, title, newSub);
  };

  const handleCreateNewLectureNote = () => {
    const newId = `lecture_${Date.now()}`;
    const defaultSub = subjectFilter !== 'All Subjects' ? subjectFilter : currentSubject || 'Mathematics';
    const newNote: LectureNoteItem = {
      id: newId,
      title: `${defaultSub} Lecture — ${new Date().toLocaleDateString()}`,
      content: `# ${defaultSub} Lecture Notes\n\n## Key Concepts\n- \n\n## Formulas & Definitions\n`,
      subject: defaultSub,
      updatedAt: new Date().toISOString(),
      authorName: currentUser?.name || 'Student',
      userId: currentUser?.uid || 'shared'
    };
    const updated = [newNote, ...notesList];
    setNotesList(updated);
    persistLocalNotes(updated);
    setActiveNoteId(newId);
    setTitle(newNote.title);
    setContent(newNote.content);
    setCurrentSubject(newNote.subject);
    flushSaveToCloud(newId, newNote.content, newNote.title, newNote.subject);
    showToast('📝 Created new lecture note');
  };

  const handleDeleteLectureNote = async (idToDelete: string) => {
    if (notesList.length <= 1) {
      showToast('⚠️ Cannot delete the last remaining lecture note.');
      setConfirmDeleteId(null);
      return;
    }
    const remaining = notesList.filter(n => n.id !== idToDelete);
    setNotesList(remaining);
    persistLocalNotes(remaining);
    setConfirmDeleteId(null);
    if (activeNoteId === idToDelete && remaining[0]) {
      setActiveNoteId(remaining[0].id);
    }
    try {
      await supabase.from('lecture_notes').delete().eq('id', idToDelete);
      await supabase.from('notes').delete().eq('id', idToDelete);
    } catch (_) {}
    showToast('🗑️ Lecture note deleted');
  };

  const injectMarkdownToken = (prefix: string, suffix = '') => {
    const el = textareaRef.current;
    if (!el) {
      const next = `${content}\n${prefix}${suffix}`;
      setContent(next);
      saveAndBroadcast(next, title, currentSubject);
      return;
    }
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const selected = content.substring(start, end) || 'text';
    const next = content.substring(0, start) + prefix + selected + suffix + content.substring(end);
    setContent(next);
    saveAndBroadcast(next, title, currentSubject);
    setTimeout(() => {
      el.focus();
      el.setSelectionRange(start + prefix.length, start + prefix.length + selected.length);
    }, 30);
  };

  const handleRunAiStudyTool = async (mode: 'summarize' | 'takeaways' | 'structure') => {
    if (!content.trim()) {
      showToast('⚠️ Write some lecture notes first before running AI tools.');
      return;
    }
    setAiBusy(mode);
    const actionMap = {
      summarize: 'Summarize these lecture notes into concise, high-yield bullet points based strictly on the provided text.',
      takeaways: 'Extract the top key takeaways and generate 3 likely exam questions with short answers based strictly on these lecture notes.',
      structure: 'Clean up and organize these lecture notes with clear Markdown headings, bullet points, and highlighted definitions without inventing new facts.'
    };
    try {
      const res = await fetch('/api/ai/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: mode === 'summarize' ? 'summarize' : 'improve',
          content,
          customPrompt: actionMap[mode]
        })
      });
      const data = await res.json();
      const generated = (data?.text || '').trim();
      if (generated) {
        const nextContent =
          mode === 'structure'
            ? generated
            : `${content.trim()}\n\n---\n### ✨ AI ${mode === 'summarize' ? 'Lecture Summary' : 'Key Takeaways & Exam Prep'}\n${generated}`;
        setContent(nextContent);
        await flushSaveToCloud(activeNoteId, nextContent, title, currentSubject);
        showToast('✨ AI study enhancement added to note');
      } else {
        showToast('⚠️ AI service returned an empty response.');
      }
    } catch (_) {
      showToast('⚠️ Could not reach AI service. Your note is safely saved.');
    } finally {
      setAiBusy(null);
    }
  };

  const handleSaveToFlashcards = async () => {
    if (!content.trim()) {
      showToast('⚠️ Add lecture content first to generate flashcards.');
      return;
    }
    const result = await saveStudyOutputToFlashcards(title || 'Lecture Note', currentSubject || 'General', content, currentUser?.uid);
    const count = typeof result === 'number' ? result : (result?.count || 0);
    if (count > 0) {
      showToast(`🃏 Saved ${count} flashcards to Study Center (${currentSubject})!`);
    } else {
      showToast('⚠️ Add more detail to your notes to extract flashcards.');
    }
  };

  const handleExportMarkdown = () => {
    const blob = new Blob([`# ${title}\nSubject: ${currentSubject}\n\n${content}`], { type: 'text/markdown' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${(title || 'lecture_notes').replace(/\s+/g, '_').toLowerCase()}.md`;
    link.click();
    showToast('⬇️ Downloaded Markdown file (.md)');
  };

  const filteredNotes = notesList.filter(n => {
    const matchesSub = subjectFilter === 'All Subjects' || n.subject === subjectFilter;
    const q = searchQuery.trim().toLowerCase();
    const matchesSearch = !q || n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q) || n.subject.toLowerCase().includes(q);
    return matchesSub && matchesSearch;
  });

  const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0;

  const renderFormattedPreview = (raw: string) => {
    if (!raw.trim()) {
      return <p className="text-slate-500 italic text-xs">Nothing written yet. Switch to Write mode to start taking notes.</p>;
    }
    const formatted = formatMathematicalText(raw);
    const lines = formatted.split('\n');
    return (
      <div className="space-y-2 text-xs sm:text-sm text-slate-200 leading-relaxed">
        {lines.map((line, i) => {
          const trimmed = line.trim();
          if (!trimmed) return <div key={i} className="h-1.5" />;
          if (trimmed === '---') return <hr key={i} className="border-white/10 my-3" />;
          if (line.startsWith('# ')) return <h2 key={i} className="text-base sm:text-lg font-black text-white mt-3">{line.slice(2)}</h2>;
          if (line.startsWith('## ')) return <h3 key={i} className="text-sm sm:text-base font-extrabold text-indigo-300 mt-2.5">{line.slice(3)}</h3>;
          if (line.startsWith('### ')) return <h4 key={i} className="text-xs sm:text-sm font-bold text-indigo-200 mt-2">{line.slice(4)}</h4>;
          if (trimmed.startsWith('> ')) {
            return (
              <blockquote key={i} className="border-l-4 border-indigo-500 bg-indigo-500/10 px-3 py-2 rounded-r-xl text-indigo-100">
                {trimmed.slice(2)}
              </blockquote>
            );
          }
          if (trimmed.startsWith('- [ ] ') || trimmed.startsWith('- [x] ')) {
            const checked = trimmed.startsWith('- [x] ');
            return (
              <div key={i} className="flex items-center gap-2 pl-2">
                <span className={`w-3.5 h-3.5 rounded flex items-center justify-center border text-[9px] ${checked ? 'bg-emerald-600 border-emerald-400 text-white' : 'border-white/30'}`}>
                  {checked ? '✓' : ''}
                </span>
                <span className={checked ? 'line-through text-slate-400' : 'text-slate-200'}>{trimmed.slice(6)}</span>
              </div>
            );
          }
          if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
            return (
              <div key={i} className="flex items-start gap-2 pl-2">
                <span className="text-indigo-400 font-bold">•</span>
                <span>{trimmed.slice(2)}</span>
              </div>
            );
          }
          return <p key={i} className="break-words">{line}</p>;
        })}
      </div>
    );
  };

  return (
    <div className="bg-slate-900/90 border border-white/10 rounded-2xl sm:rounded-3xl p-3 sm:p-5 shadow-2xl flex flex-col max-w-6xl mx-auto font-sans space-y-4 relative">
      {statusToast && (
        <div className="fixed top-4 right-4 z-50 bg-slate-900/95 border border-indigo-500/40 text-indigo-200 px-4 py-2.5 rounded-xl shadow-2xl text-xs font-bold flex items-center gap-2 backdrop-blur-md">
          <Sparkles className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
          <span>{statusToast}</span>
        </div>
      )}

      {/* Top Lecture Selector & Filter Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-2.5 bg-slate-950/70 p-2.5 sm:p-3 rounded-2xl border border-white/5">
        <div className="flex flex-wrap items-center gap-2 flex-1 min-w-0">
          <div className="relative flex-1 min-w-[140px] sm:max-w-xs">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search lecture notes..."
              className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-slate-900 border border-white/10 text-xs text-white focus:outline-none focus:border-indigo-500"
            />
          </div>

          <select
            value={subjectFilter}
            onChange={(e) => setSubjectFilter(e.target.value)}
            className="px-2.5 py-1.5 rounded-xl bg-slate-900 border border-white/10 text-xs text-slate-200 font-bold focus:outline-none"
          >
            {AVAILABLE_SUBJECTS.map(sub => (
              <option key={sub} value={sub} className="bg-slate-900 text-white">{sub}</option>
            ))}
          </select>

          <button
            onClick={handleCreateNewLectureNote}
            className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-md transition-all active:scale-95 shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Note</span>
          </button>
        </div>

        {/* Live Collaborators Badge */}
        <div className="flex items-center justify-between sm:justify-end gap-2.5 bg-slate-900 px-3 py-1.5 rounded-xl border border-white/10 shrink-0">
          <div className="flex items-center gap-1.5 text-[11px] text-emerald-400 font-bold">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>{Math.max(1, activeEditors.length)} Active</span>
          </div>
          <div className="flex -space-x-1.5">
            {(activeEditors.length > 0 ? activeEditors : [{ uid: currentUser?.uid || 'me', name: currentUser?.name || 'You' }])
              .slice(0, 4)
              .map((ed) => (
                <div
                  key={ed.uid}
                  title={ed.name}
                  className="w-6 h-6 rounded-full bg-indigo-600 border-2 border-slate-900 flex items-center justify-center text-[9px] font-bold text-white uppercase"
                >
                  {(ed.name || 'U').substring(0, 2)}
                </div>
              ))}
          </div>
        </div>
      </div>

      {/* Horizontal Scrollable Lecture Note Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
        {filteredNotes.map((note) => {
          const isSelected = note.id === activeNoteId;
          return (
            <div
              key={note.id}
              className={`group flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-bold shrink-0 transition-all cursor-pointer ${
                isSelected
                  ? 'bg-indigo-600/20 border-indigo-500/50 text-white shadow-md'
                  : 'bg-slate-950/60 border-white/5 text-slate-400 hover:text-white hover:bg-slate-900'
              }`}
              onClick={() => setActiveNoteId(note.id)}
            >
              <FileText className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
              <span className="truncate max-w-[150px]">{note.title || 'Untitled'}</span>
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/5 text-indigo-300 font-mono">{note.subject}</span>
              {notesList.length > 1 && (
                confirmDeleteId === note.id ? (
                  <div className="flex items-center gap-1 ml-1" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => handleDeleteLectureNote(note.id)}
                      className="px-1.5 py-0.5 bg-rose-600 text-white rounded text-[9px] font-black"
                    >
                      Del
                    </button>
                    <button
                      onClick={() => setConfirmDeleteId(null)}
                      className="px-1 py-0.5 bg-slate-800 text-slate-300 rounded text-[9px]"
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setConfirmDeleteId(note.id);
                    }}
                    className="opacity-60 hover:opacity-100 text-slate-400 hover:text-rose-400 p-0.5"
                    title="Delete Note"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )
              )}
            </div>
          );
        })}
        {filteredNotes.length === 0 && (
          <div className="text-xs text-slate-500 py-1 px-2">
            No lecture notes match your filter. Click "New Note" to create one.
          </div>
        )}
      </div>

      {/* Active Note Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-3">
        <div className="flex items-start sm:items-center gap-3 flex-1 min-w-0">
          <div className="p-2.5 rounded-2xl bg-indigo-500/20 border border-indigo-500/30 text-indigo-400 shrink-0">
            <BookOpen className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <input
              type="text"
              value={title}
              onChange={(e) => {
                const val = e.target.value;
                setTitle(val);
                saveAndBroadcast(content, val, currentSubject);
              }}
              placeholder="Lecture Note Title..."
              className="w-full bg-transparent font-black text-white text-sm sm:text-base focus:outline-none focus:border-b border-indigo-500 truncate"
            />
            <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400 mt-1">
              <select
                value={currentSubject}
                onChange={(e) => handleSubjectChange(e.target.value)}
                className="px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-extrabold text-[11px] border border-indigo-500/30 focus:outline-none cursor-pointer"
              >
                {AVAILABLE_SUBJECTS.filter(s => s !== 'All Subjects').map((sub) => (
                  <option key={sub} value={sub} className="bg-slate-900 text-white">
                    {sub}
                  </option>
                ))}
              </select>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3 text-slate-500" />
                {lastSavedTime ? `Saved ${lastSavedTime}` : 'Autosave active'}
              </span>
              <span>•</span>
              <span className="font-mono text-[10px] text-slate-500">{wordCount} words</span>
            </div>
          </div>
        </div>

        {/* View Mode & Manual Save / Export */}
        <div className="flex flex-wrap items-center gap-1.5">
          <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-white/10">
            <button
              onClick={() => setViewMode('write')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-all ${viewMode === 'write' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}
            >
              <Edit3 className="w-3 h-3" /> Write
            </button>
            <button
              onClick={() => setViewMode('split')}
              className={`hidden md:flex px-2.5 py-1 rounded-lg text-[11px] font-bold items-center gap-1 transition-all ${viewMode === 'split' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}
            >
              <Columns className="w-3 h-3" /> Split
            </button>
            <button
              onClick={() => setViewMode('preview')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-all ${viewMode === 'preview' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}
            >
              <Eye className="w-3 h-3" /> Reader
            </button>
          </div>

          <button
            onClick={() => flushSaveToCloud(activeNoteId, content, title, currentSubject)}
            className="px-2.5 py-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 text-[11px] font-bold flex items-center gap-1 transition-all"
            title="Save Note Immediately"
          >
            <Save className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Save</span>
          </button>

          <button
            onClick={handleExportMarkdown}
            className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-white/10 text-[11px] font-bold flex items-center gap-1 transition-all"
            title="Download Markdown (.md)"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">.MD</span>
          </button>
        </div>
      </div>

      {/* Formatting + AI Study Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-950/60 p-2 rounded-2xl border border-white/5">
        <div className="flex flex-wrap items-center gap-1">
          <button onClick={() => injectMarkdownToken('# ', '\n')} className="px-2 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 text-[10px] font-bold border border-white/5">H1</button>
          <button onClick={() => injectMarkdownToken('## ', '\n')} className="px-2 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 text-[10px] font-bold border border-white/5">H2</button>
          <button onClick={() => injectMarkdownToken('**', '**')} className="px-2 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 text-[10px] font-black border border-white/5">B</button>
          <button onClick={() => injectMarkdownToken('*', '*')} className="px-2 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 text-[10px] italic border border-white/5">I</button>
          <button onClick={() => injectMarkdownToken('- ', '')} className="px-2 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 text-[10px] font-bold border border-white/5">• List</button>
          <button onClick={() => injectMarkdownToken('- [ ] ', '')} className="px-2 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 text-[10px] font-bold border border-white/5">☑ Task</button>
          <button onClick={() => injectMarkdownToken('$$ ', ' $$')} className="px-2 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-indigo-300 text-[10px] font-mono border border-white/5">∑ Math</button>
          <button onClick={() => injectMarkdownToken('```\n', '\n```')} className="px-2 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-amber-300 text-[10px] font-mono border border-white/5">{'</>'} Code</button>
          <button onClick={() => injectMarkdownToken('> 💡 **Key Point:** ', '\n')} className="px-2 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-emerald-300 text-[10px] font-bold border border-white/5">💡 Callout</button>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <button
            onClick={() => handleRunAiStudyTool('summarize')}
            disabled={Boolean(aiBusy)}
            className="px-2.5 py-1 rounded-xl bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-300 border border-indigo-500/30 text-[10px] font-bold flex items-center gap-1 disabled:opacity-40 transition-all"
          >
            <Sparkles className="w-3 h-3" />
            <span>{aiBusy === 'summarize' ? 'Summarizing...' : 'Summarize'}</span>
          </button>
          <button
            onClick={() => handleRunAiStudyTool('takeaways')}
            disabled={Boolean(aiBusy)}
            className="px-2.5 py-1 rounded-xl bg-purple-500/15 hover:bg-purple-500/25 text-purple-300 border border-purple-500/30 text-[10px] font-bold flex items-center gap-1 disabled:opacity-40 transition-all"
          >
            <ListChecks className="w-3 h-3" />
            <span>{aiBusy === 'takeaways' ? 'Extracting...' : 'Exam Q&A'}</span>
          </button>
          <button
            onClick={() => handleRunAiStudyTool('structure')}
            disabled={Boolean(aiBusy)}
            className="px-2.5 py-1 rounded-xl bg-teal-500/15 hover:bg-teal-500/25 text-teal-300 border border-teal-500/30 text-[10px] font-bold flex items-center gap-1 disabled:opacity-40 transition-all"
          >
            <Wand2 className="w-3 h-3" />
            <span>{aiBusy === 'structure' ? 'Formatting...' : 'Clean Structure'}</span>
          </button>
          <button
            onClick={handleSaveToFlashcards}
            className="px-2.5 py-1 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 text-[10px] font-bold flex items-center gap-1 transition-all"
            title="Convert Lecture Note into Study Center Flashcards"
          >
            <Brain className="w-3 h-3" />
            <span>To Flashcards</span>
          </button>
        </div>
      </div>

      {/* Editor / Preview Body */}
      <div className={`grid gap-4 min-h-[380px] sm:min-h-[460px] relative ${viewMode === 'split' ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1'}`}>
        {(viewMode === 'write' || viewMode === 'split') && (
          <div className="relative flex flex-col h-full min-h-[360px]">
            <textarea
              ref={textareaRef}
              value={content}
              onChange={handleContentChange}
              placeholder="Start typing lecture notes here... Changes sync live with classmates and save automatically."
              className="w-full flex-1 p-4 rounded-2xl bg-slate-950 border border-white/10 text-slate-100 text-xs sm:text-sm focus:outline-none focus:border-indigo-500/50 resize-none font-mono leading-relaxed scrollbar-thin placeholder-slate-600"
            />
          </div>
        )}

        {(viewMode === 'preview' || viewMode === 'split') && (
          <div className="p-4 sm:p-5 rounded-2xl bg-slate-950/90 border border-white/10 overflow-y-auto max-h-[500px] scrollbar-thin">
            {renderFormattedPreview(content)}
          </div>
        )}

        {/* Saving Status Badge */}
        <div className="absolute bottom-3 right-3 bg-slate-900/90 border border-white/10 backdrop-blur-md px-3 py-1 rounded-xl text-[11px] font-semibold text-slate-300 flex items-center gap-1.5 shadow-lg pointer-events-none">
          {isSaving ? (
            <>
              <div className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
              <span className="text-amber-300">Saving...</span>
            </>
          ) : (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-slate-400">{saveStateLabel}</span>
            </>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="pt-2 border-t border-white/10 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400">
        <span className="flex items-center gap-1.5 text-indigo-300">
          <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
          Live Collaborative Classroom Notes • Instant Cross-Device & Offline-Safe Sync
        </span>
        <span className="text-slate-500 font-mono text-[10px]">Autosave + Markdown & Math Support</span>
      </div>
    </div>
  );
};

