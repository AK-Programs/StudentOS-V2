import React, { useState, useEffect, useRef } from 'react';
import { BookOpen, Users, Save, Sparkles, Clock, Check, Eye, Lock } from 'lucide-react';
import { UserProfile } from '../types';
import { supabase } from '../lib/supabase';

interface CollaborativeLectureNotesProps {
  currentUser: UserProfile | null;
  lectureId?: string;
  lectureTitle?: string;
  subject?: string;
}

const AVAILABLE_SUBJECTS = [
  'Mathematics',
  'Chemistry',
  'Biology',
  'Physics',
  'English',
  'Computer Science',
  'Economics'
];

export const CollaborativeLectureNotes: React.FC<CollaborativeLectureNotesProps> = ({
  currentUser,
  lectureId = 'global_lecture_notes_default',
  lectureTitle = 'Live Collaborative Lecture Notes',
  subject = 'Mathematics',
}) => {
  const [content, setContent] = useState<string>('');
  const [title, setTitle] = useState<string>(lectureTitle);
  const [currentSubject, setCurrentSubject] = useState<string>(subject);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSavedTime, setLastSavedTime] = useState<string>('');
  const [activeEditors, setActiveEditors] = useState<{ uid: string; name: string; avatar?: string }[]>([]);

  const debounceTimerRef = useRef<any>(null);
  const channelRef = useRef<any>(null);
  const isRemoteUpdateRef = useRef(false);

  // Load existing note from Supabase
  useEffect(() => {
    const loadNote = async () => {
      try {
        let noteData = null;
        // 1. Try lecture_notes table
        const { data: lectureData, error: lErr } = await supabase
          .from('lecture_notes')
          .select('*')
          .eq('id', lectureId)
          .maybeSingle();

        if (!lErr && lectureData) {
          noteData = lectureData;
        } else {
          // 2. Fallback to notes table
          const { data: vaultData } = await supabase
            .from('notes')
            .select('*')
            .eq('id', lectureId)
            .maybeSingle();
          if (vaultData) noteData = vaultData;
        }

        if (noteData) {
          setTitle(noteData.title || lectureTitle);
          setContent(noteData.content || '');
          if (noteData.subject) {
            setCurrentSubject(noteData.subject);
          }
          if (noteData.created_at) {
            setLastSavedTime(new Date(noteData.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
          }
        }
      } catch (_) {}
    };

    loadNote();

    // Setup Supabase Realtime channel for live collaboration
    const channelName = `lecture_collab_${lectureId}`;
    const channel = supabase.channel(channelName, {
      config: {
        presence: {
          key: currentUser?.uid || 'guest',
        },
      },
    });

    channelRef.current = channel;

    // Listen to broadcast content edits
    channel.on('broadcast', { event: 'note_content_changed' }, (payload) => {
      if (payload && payload.payload && payload.payload.senderUid !== currentUser?.uid) {
        isRemoteUpdateRef.current = true;
        setContent(payload.payload.content);
        if (payload.payload.title) {
          setTitle(payload.payload.title);
        }
        if (payload.payload.subject) {
          setCurrentSubject(payload.payload.subject);
        }
      }
    });

    // Track presence
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
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [lectureId, currentUser]);

  // Handle local text edits with debounced autosave + realtime broadcast
  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newText = e.target.value;
    setContent(newText);
    saveAndBroadcast(newText, title, currentSubject);
  };

  const handleSubjectChange = (newSub: string) => {
    setCurrentSubject(newSub);
    saveAndBroadcast(content, title, newSub);
  };

  const saveAndBroadcast = (newText: string, newTitle: string, newSubject: string) => {
    // Broadcast live change to peers immediately
    if (channelRef.current) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'note_content_changed',
        payload: {
          content: newText,
          title: newTitle,
          subject: newSubject,
          senderUid: currentUser?.uid,
        },
      });
    }

    // Debounce save to Supabase database (500ms)
    setIsSaving(true);
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(async () => {
      try {
        const payload = {
          id: lectureId,
          title: newTitle,
          content: newText,
          subject: newSubject,
          icon: '📝',
          cover_bg: 'bg-indigo-900',
          user_id: currentUser?.uid || 'shared',
          created_at: new Date().toISOString(),
        };

        const { error: lErr } = await supabase.from('lecture_notes').upsert(payload);
        if (lErr) {
          await supabase.from('notes').upsert(payload);
        }
        setIsSaving(false);
        setLastSavedTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
      } catch (err) {
        console.warn('[COLLAB-NOTES] Save error:', err);
        setIsSaving(false);
      }
    }, 500);
  };

  return (
    <div className="bg-slate-900/90 border border-white/10 rounded-2xl sm:rounded-3xl p-3.5 sm:p-5 shadow-2xl flex flex-col h-[500px] sm:h-[650px] max-w-5xl mx-auto font-sans">
      
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4 shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-indigo-500/20 border border-indigo-500/30 text-indigo-400">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <input
              type="text"
              value={title}
              onChange={(e) => {
                const val = e.target.value;
                setTitle(val);
                saveAndBroadcast(content, val, currentSubject);
              }}
              className="bg-transparent font-black text-white text-base focus:outline-none focus:border-b border-indigo-500"
            />
            <div className="flex items-center gap-2 text-xs text-slate-400 mt-1">
              <select
                value={currentSubject}
                onChange={(e) => handleSubjectChange(e.target.value)}
                className="px-2.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-extrabold text-xs border border-indigo-500/30 focus:outline-none cursor-pointer"
              >
                {AVAILABLE_SUBJECTS.map((sub) => (
                  <option key={sub} value={sub} className="bg-slate-900 text-white">
                    {sub}
                  </option>
                ))}
              </select>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3 text-slate-500" />
                {lastSavedTime ? `Autosaved at ${lastSavedTime}` : 'Autosave active'}
              </span>
            </div>
          </div>
        </div>

        {/* Live Active Editors */}
        <div className="flex items-center gap-3 bg-slate-950/80 px-3.5 py-1.5 rounded-2xl border border-white/10">
          <div className="flex items-center gap-1 text-xs text-emerald-400 font-bold">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>{activeEditors.length} Live Collaborators</span>
          </div>

          <div className="flex -space-x-2">
            {activeEditors.slice(0, 5).map((ed) => (
              <div
                key={ed.uid}
                title={ed.name}
                className="w-7 h-7 rounded-full bg-indigo-600 border-2 border-slate-900 flex items-center justify-center text-[10px] font-bold text-white uppercase"
              >
                {ed.name.substring(0, 2)}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Editor Body */}
      <div className="flex-1 my-4 relative min-h-0">
        <textarea
          value={content}
          onChange={handleContentChange}
          placeholder="Start typing lecture notes here... All students watching this lecture will see changes live in real-time."
          className="w-full h-full p-4 rounded-2xl bg-slate-950 border border-white/10 text-slate-100 text-sm focus:outline-none focus:border-indigo-500/50 resize-none font-mono leading-relaxed scrollbar-thin placeholder-slate-600"
        />

        {/* Saving Status Badge */}
        <div className="absolute bottom-4 right-4 bg-slate-900/90 border border-white/10 backdrop-blur-md px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-300 flex items-center gap-2 shadow-lg">
          {isSaving ? (
            <>
              <div className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
              <span className="text-amber-300">Saving...</span>
            </>
          ) : (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-slate-400">Synced to Cloud</span>
            </>
          )}
        </div>
      </div>

      {/* Footer Instructions */}
      <div className="pt-3 border-t border-white/10 flex items-center justify-between text-xs text-slate-400 shrink-0">
        <span className="flex items-center gap-1.5 text-indigo-300">
          <Sparkles className="w-4 h-4 text-indigo-400" />
          Google Docs-style live collaborative editor powered by Supabase Realtime
        </span>
        <span className="text-slate-500 text-[11px]">Debounced 500ms cloud sync</span>
      </div>
    </div>
  );
};
