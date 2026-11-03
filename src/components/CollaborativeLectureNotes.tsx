import React, { useState, useEffect, useRef } from 'react';
import {
  BookOpen, Users, Save, Sparkles, Clock, Check, Eye, Edit3, Plus,
  Trash2, Search, Download, Brain, Wand2, ListChecks, FileText, Columns, Phone,
  FolderPlus, MoreVertical, Pin, Share2, Move, Edit2, Lock, Unlock, Hash,
  Settings, CheckSquare, Square, Copy, Shield, AlertCircle, X, ChevronDown
} from 'lucide-react';
import { UserProfile } from '../types';
import { supabase } from '../lib/supabase';
import { sendRealtimeEvent, subscribeRealtimeEvents } from '../lib/wsHelper';
import { saveStudyOutputToFlashcards, formatMathematicalText } from '../lib/studentosAiEngine';
import { generateFormattedPdf } from '../lib/pdfGenerator';
import { getFolders, Folder, createFolder, renameFolder, deleteFolder } from '../lib/supabaseFolders';

interface CollaborativeLectureNotesProps {
  currentUser: UserProfile | null;
  lectureId?: string;
  lectureTitle?: string;
  subject?: string;
}

export interface LectureNoteItem {
  id: string;
  title: string;
  content: string;
  subject: string;
  icon?: string;
  updatedAt: string;
  authorName?: string;
  userId?: string;
  folder_id?: string | null;
  collab_code?: string | null;
  permission?: 'private' | 'view' | 'edit';
  isPinned?: boolean;
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

const NOTE_ICONS = ['📝', '🔬', '🧪', '📐', '💻', '📚', '💡', '🌍', '🎨', '🏛️', '📊', '🚀', '⚡', '🧠'];

const LOCAL_STORAGE_KEY = 'studentos_lecture_notes_v3';

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
        id: 'lecture_default_math',
        title: 'Mathematics Lecture — Calculus & Linear Algebra',
        content: `# Calculus & Linear Algebra Lecture Notes\n\n## Key Concepts\n- Derivative defines instantaneous rate of change: $f'(x) = \\lim_{\\Delta x \\to 0} \\frac{f(x+\\Delta x) - f(x)}{\\Delta x}$\n- Matrix multiplication is associative but non-commutative ($AB \\neq BA$).\n\n## Formula Reference Table\n| Rule Name | Mathematical Form | Domain Validity |\n|---|---|---|\n| Power Rule | $\\frac{d}{dx} x^n = n x^{n-1}$ | $n \\in \\mathbb{R}$ |\n| Product Rule | $(uv)' = u'v + uv'$ | Differentiable $u, v$ |\n| Quotient Rule | $(\\frac{u}{v})' = \\frac{u'v - uv'}{v^2}$ | $v(x) \\neq 0$ |\n| Chain Rule | $\\frac{d}{dx} f(g(x)) = f'(g(x))g'(x)$ | Composite functions |\n\n## Action Items\n- [x] Complete problem set 4 exercises 1-12\n- [ ] Review inverse trigonometric substitution\n- [ ] Prepare revision flashcards for Friday seminar\n\n> 💡 **Key Takeaway:** Always check denominator boundary constraints before applying L'Hôpital's rule.`,
        subject: 'Mathematics',
        icon: '📐',
        updatedAt: new Date().toISOString(),
        authorName: currentUser?.name || 'Classroom Faculty',
        userId: currentUser?.uid || 'shared',
        permission: 'edit',
        collab_code: '482910'
      }
    ];
  });

  const [activeNoteId, setActiveNoteId] = useState<string | null>(() => notesList[0]?.id || null);
  const [content, setContent] = useState<string>(() => notesList[0]?.content || '');
  const [title, setTitle] = useState<string>(() => notesList[0]?.title || '');
  const [currentSubject, setCurrentSubject] = useState<string>(() => notesList[0]?.subject || subject);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [subjectFilter, setSubjectFilter] = useState<string>('All Subjects');
  const [viewMode, setViewMode] = useState<'write' | 'split' | 'preview'>('write');
  const [isSaving, setIsSaving] = useState(false);
  const [saveStateLabel, setSaveStateLabel] = useState<string>('Synced');
  const [lastSavedTime, setLastSavedTime] = useState<string>('');
  const [activeEditors, setActiveEditors] = useState<{ uid: string; name: string; avatar?: string }[]>([]);
  const [realtimeStatus, setRealtimeStatus] = useState<'connecting' | 'connected' | 'reconnecting' | 'offline' | 'error'>('connecting');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [aiBusy, setAiBusy] = useState<string | null>(null);
  const [statusToast, setStatusToast] = useState<string | null>(null);

  // Folder states
  const [folders, setFolders] = useState<Folder[]>([]);
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');

  // Hold menu state
  const [holdMenu, setHoldMenu] = useState<{
    noteId: string;
    x: number;
    y: number;
  } | null>(null);
  const holdTimerRef = useRef<any>(null);

  // Join Note Modal
  const [joinCode, setJoinCode] = useState('');
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [isJoining, setIsJoining] = useState(false);

  // AI Prompt & Proposal State
  const [aiCustomPrompt, setAiCustomPrompt] = useState('');
  const [aiProposedResult, setAiProposedResult] = useState<string | null>(null);

  // Note Settings Modal (Owner Only)
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [settingsTitle, setSettingsTitle] = useState('');
  const [settingsIcon, setSettingsIcon] = useState('📝');
  const [settingsFolderId, setSettingsFolderId] = useState<string | null>(null);
  const [settingsSubject, setSettingsSubject] = useState('Mathematics');
  const [settingsPermission, setSettingsPermission] = useState<'private' | 'view' | 'edit'>('edit');
  const [settingsCollabCode, setSettingsCollabCode] = useState<string | null>(null);
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  // Collaboration references
  const debounceTimerRef = useRef<any>(null);
  const channelRef = useRef<any>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const revisionRef = useRef<number>(1);
  const lastRemoteTimestampRef = useRef<number>(0);

  const activeNote = notesList.find(n => n.id === activeNoteId);
  const isOwner = Boolean(
    !activeNote?.userId ||
    activeNote.userId === currentUser?.uid ||
    currentUser?.role === 'admin' ||
    currentUser?.role === 'super_admin'
  );
  const canEdit = isOwner || activeNote?.permission === 'edit';

  const showToast = (msg: string) => {
    setStatusToast(msg);
    setTimeout(() => setStatusToast(prev => (prev === msg ? null : prev)), 3500);
  };

  const persistLocalNotes = (items: LectureNoteItem[]) => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(items));
    } catch (_) {}
  };

  // 1. Initial Load: Fetch from Supabase canonical `notes` table
  useEffect(() => {
    let mounted = true;
    const loadAllLectureNotes = async () => {
      try {
        if (currentUser?.uid) {
          const f = await getFolders(currentUser.uid, 'notes');
          if (mounted) setFolders(f);
        }

        const mergedMap = new Map<string, LectureNoteItem>();
        notesList.forEach(item => mergedMap.set(item.id, item));

        // Load personal notes and shared collaborative notes from Supabase `notes`
        const query = currentUser?.uid
          ? supabase
              .from('notes')
              .select('*')
              .or(`user_id.eq.${currentUser.uid},collab_code.not.is.null`)
              .order('created_at', { ascending: false })
              .limit(100)
          : supabase
              .from('notes')
              .select('*')
              .not('collab_code', 'is', null)
              .order('created_at', { ascending: false })
              .limit(50);

        const { data: dbNotes, error: nErr } = await query;

        if (!nErr && Array.isArray(dbNotes)) {
          dbNotes
            .filter(n => n.title !== '__SYSTEM_NOTIFICATION__' && !n.id.startsWith('notif_') && !n.id.startsWith('chat_'))
            .forEach((row: any) => {
              mergedMap.set(row.id, {
                id: row.id,
                title: row.title || 'Untitled Note',
                content: row.content || '',
                subject: row.subject || 'Mathematics',
                icon: row.icon || '📝',
                updatedAt: row.inserted_at || row.created_at || new Date().toISOString(),
                userId: row.user_id,
                folder_id: row.folder_id || null,
                collab_code: row.collab_code || null,
                permission: row.cover_bg === 'perm_view' ? 'view' : (row.permission || (row.collab_code ? 'edit' : 'private')),
                isPinned: Boolean(row.is_pinned)
              });
            });
        }

        if (!mounted) return;
        const finalItems = Array.from(mergedMap.values());
        if (finalItems.length > 0) {
          setNotesList(finalItems);
          persistLocalNotes(finalItems);

          if (!activeNoteId || !finalItems.some(n => n.id === activeNoteId)) {
            const first = finalItems[0];
            setActiveNoteId(first.id);
            setTitle(first.title);
            setContent(first.content);
            setCurrentSubject(first.subject || 'Mathematics');
          }
        }
      } catch (err) {
        console.warn('[LectureNotes] Load warning:', err);
      }
    };

    loadAllLectureNotes();
    return () => {
      mounted = false;
    };
  }, [currentUser?.uid]);

  // 2. Synchronize active note fields when switching activeNoteId
  useEffect(() => {
    if (!activeNoteId) return;
    const found = notesList.find(n => n.id === activeNoteId);
    if (found) {
      setTitle(found.title);
      setContent(found.content);
      setCurrentSubject(found.subject || 'Mathematics');
    }
  }, [activeNoteId]);

  // 3. Realtime Channel + Presence for the active note
  useEffect(() => {
    if (!activeNoteId) return;

    const channelName = `lecture_collab_${activeNoteId}`;

    // A. Subscribe to WebSocket broadcast bus
    const unsubscribeBus = subscribeRealtimeEvents(channelName, {
      note_content_changed: (payload: any) => {
        if (!payload || payload.senderUid === currentUser?.uid) return;

        const incomingTimestamp = payload.timestamp || 0;
        if (incomingTimestamp < lastRemoteTimestampRef.current) return;
        lastRemoteTimestampRef.current = incomingTimestamp;

        // Cancel any pending debounced save of stale local content
        if (debounceTimerRef.current) {
          clearTimeout(debounceTimerRef.current);
          debounceTimerRef.current = null;
        }

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

        setSaveStateLabel(`Synced with ${payload.senderName || 'Collaborator'}`);
      },

      note_settings_changed: (payload: any) => {
        if (!payload) return;
        if (payload.title) setTitle(payload.title);
        if (payload.subject) setCurrentSubject(payload.subject);

        setNotesList(prev => {
          const updated = prev.map(n =>
            n.id === activeNoteId
              ? {
                  ...n,
                  title: payload.title || n.title,
                  subject: payload.subject || n.subject,
                  icon: payload.icon || n.icon,
                  folder_id: payload.folder_id !== undefined ? payload.folder_id : n.folder_id,
                  permission: payload.permission || n.permission,
                  collab_code: payload.collab_code !== undefined ? payload.collab_code : n.collab_code,
                  updatedAt: new Date().toISOString()
                }
              : n
          );
          persistLocalNotes(updated);
          return updated;
        });

        showToast(`⚙️ Note settings updated by owner (${payload.title || 'Note'})`);
      }
    });

    // B. Supabase Presence tracking
    const channel = supabase.channel(`presence_${channelName}`, {
      config: {
        presence: {
          key: currentUser?.uid || `guest_${Date.now()}`
        }
      }
    });
    channelRef.current = channel;

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const editors: { uid: string; name: string; avatar?: string }[] = [];
        Object.keys(state).forEach(k => {
          const pres = state[k] as any[];
          if (pres && pres[0]) {
            editors.push({
              uid: pres[0].uid,
              name: pres[0].name || 'Classmate',
              avatar: pres[0].avatar
            });
          }
        });
        setActiveEditors(editors);
      })
      .subscribe(async status => {
        if (status === 'SUBSCRIBED' && currentUser) {
          await channel.track({
            uid: currentUser.uid,
            name: currentUser.name || 'Student',
            avatar: currentUser.avatar
          });
        }
      });

    // C. Postgres changes subscription for the specific active note
    const dbChannel = supabase
      .channel(`db_note_sync_${activeNoteId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'notes', filter: `id=eq.${activeNoteId}` },
        payload => {
          const row = payload.new as any;
          if (row && row.id === activeNoteId) {
            setContent(row.content || '');
            setTitle(row.title || '');
            setCurrentSubject(row.subject || 'Mathematics');
            setNotesList(prev => {
              const updated = prev.map(n =>
                n.id === activeNoteId
                  ? {
                      ...n,
                      title: row.title || n.title,
                      content: row.content || n.content,
                      subject: row.subject || n.subject,
                      icon: row.icon || n.icon,
                      collab_code: row.collab_code !== undefined ? row.collab_code : n.collab_code,
                      permission: row.permission || n.permission,
                      updatedAt: new Date().toISOString()
                    }
                  : n
              );
              persistLocalNotes(updated);
              return updated;
            });
          }
        }
      )
      .subscribe();

    return () => {
      unsubscribeBus();
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
      supabase.removeChannel(dbChannel);
    };
  }, [activeNoteId, currentUser?.uid]);

  // 4. Persistence to Supabase canonical `notes` table
  const flushSaveToCloud = async (noteId: string, newText: string, newTitle: string, newSubject: string, overrideNote?: Partial<LectureNoteItem>) => {
    const current = overrideNote || notesList.find(n => n.id === noteId);

    // Permission check: if note is view-only for non-owners, reject edit
    if (current && current.permission === 'view' && current.userId && current.userId !== currentUser?.uid && currentUser?.role !== 'admin' && currentUser?.role !== 'super_admin') {
      showToast('🔒 View-only note: changes cannot be saved to the shared document.');
      setIsSaving(false);
      setSaveStateLabel('View Only');
      return;
    }

    const nowIso = new Date().toISOString();
    try {
      const isNoteOwner = !current?.userId || current.userId === currentUser?.uid || currentUser?.role === 'admin' || currentUser?.role === 'super_admin';

      if (!isNoteOwner && current?.collab_code) {
        // Collaborator update: perform targeted UPDATE so RLS update policy passes
        const updatePayload: any = {
          title: newTitle,
          content: newText,
          subject: newSubject,
          icon: current?.icon || '📝',
          updated_at: nowIso
        };
        const { error: updErr } = await supabase
          .from('notes')
          .update(updatePayload)
          .eq('id', noteId);

        if (updErr) {
          console.warn('[Collab Save Update Warning]:', updErr);
          const payload: any = {
            id: noteId,
            title: newTitle,
            content: newText,
            subject: newSubject,
            icon: current?.icon || '📝',
            user_id: current?.userId,
            collab_code: current?.collab_code,
            permission: current?.permission || 'edit',
            created_at: current?.updatedAt || nowIso
          };
          await supabase.from('notes').upsert(payload);
        }
      } else {
        // Owner update or new note: perform UPSERT
        const payload: any = {
          id: noteId,
          title: newTitle,
          content: newText,
          subject: newSubject,
          icon: current?.icon || '📝',
          cover_bg: current?.permission === 'view' ? 'perm_view' : 'perm_edit',
          user_id: current?.userId || currentUser?.uid || 'shared',
          folder_id: current?.folder_id || null,
          collab_code: current?.collab_code || null,
          is_pinned: current?.isPinned || false,
          permission: current?.permission || 'edit',
          created_at: current?.updatedAt || nowIso
        };

        let { error: err } = await supabase.from('notes').upsert(payload);
        if (err && err.code === 'PGRST204') {
          delete payload.permission;
          const res = await supabase.from('notes').upsert(payload);
          err = res.error;
        }
        if (err) throw err;
      }

      setIsSaving(false);
      setSaveStateLabel('Synced to Cloud');
      setLastSavedTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    } catch (err) {
      console.warn('[Notes Save Error]:', err);
      setIsSaving(false);
      setSaveStateLabel('Saved Locally');
      setLastSavedTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    }
  };

  // 5. Broadcast changes and queue debounce save
  const saveAndBroadcast = (newText: string, newTitle: string, newSubject: string) => {
    if (!canEdit) {
      showToast('🔒 View-only note: you do not have permission to edit this document.');
      return;
    }

    revisionRef.current += 1;
    const timestamp = Date.now();

    sendRealtimeEvent(`lecture_collab_${activeNoteId}`, 'note_content_changed', {
      content: newText,
      title: newTitle,
      subject: newSubject,
      senderUid: currentUser?.uid,
      senderName: currentUser?.name || 'Classmate',
      rev: revisionRef.current,
      timestamp
    });

    setIsSaving(true);
    setSaveStateLabel('Saving...');

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    const targetId = activeNoteId;
    debounceTimerRef.current = setTimeout(() => {
      if (targetId) {
        flushSaveToCloud(targetId, newText, newTitle, newSubject);
      }
    }, 400);
  };

  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (!canEdit) return;
    const newText = e.target.value;
    setContent(newText);
    saveAndBroadcast(newText, title, currentSubject);
  };

  const handleTitleChange = (newTitle: string) => {
    if (!canEdit) return;
    setTitle(newTitle);
    saveAndBroadcast(content, newTitle, currentSubject);
  };

  const handleSubjectChange = (newSub: string) => {
    if (!canEdit) return;
    setCurrentSubject(newSub);
    saveAndBroadcast(content, title, newSub);
  };

  // 6. Join Note by 6-digit Code: Look up in Supabase `notes`
  const handleJoinNote = async () => {
    const cleanCode = joinCode.trim();
    if (!cleanCode || cleanCode.length < 5) {
      showToast('⚠️ Please enter a valid 6-digit collaboration code.');
      return;
    }

    setIsJoining(true);
    try {
      const { data, error } = await supabase
        .from('notes')
        .select('*')
        .eq('collab_code', cleanCode)
        .maybeSingle();

      if (error || !data) {
        showToast('⚠️ Invalid 6-digit code or note is private.');
        setIsJoining(false);
        return;
      }

      const joinedNote: LectureNoteItem = {
        id: data.id,
        title: data.title || 'Collaborative Lecture Note',
        content: data.content || '',
        subject: data.subject || 'Mathematics',
        icon: data.icon || '📝',
        updatedAt: data.created_at || new Date().toISOString(),
        authorName: data.author_name || 'Classmate',
        userId: data.user_id,
        folder_id: data.folder_id || null,
        collab_code: data.collab_code,
        permission: data.cover_bg === 'perm_view' ? 'view' : (data.permission || 'edit'),
        isPinned: Boolean(data.is_pinned)
      };

      setNotesList(prev => {
        const filtered = prev.filter(n => n.id !== joinedNote.id);
        const updated = [joinedNote, ...filtered];
        persistLocalNotes(updated);
        return updated;
      });

      setActiveNoteId(joinedNote.id);
      setTitle(joinedNote.title);
      setContent(joinedNote.content);
      setCurrentSubject(joinedNote.subject);
      setShowJoinModal(false);
      setJoinCode('');
      showToast(`👥 Joined note: ${joinedNote.title} (${joinedNote.permission === 'view' ? 'View Only' : 'Can Edit'})`);
    } catch (_) {
      showToast('⚠️ Error connecting to collaborative note.');
    } finally {
      setIsJoining(false);
    }
  };

  // 7. Create New Lecture Note
  const handleCreateNewLectureNote = () => {
    const newId = `lecture_${Date.now()}`;
    const defaultSub = subjectFilter !== 'All Subjects' ? subjectFilter : currentSubject || 'Mathematics';
    const newNote: LectureNoteItem = {
      id: newId,
      title: `${defaultSub} Lecture — ${new Date().toLocaleDateString()}`,
      content: `# ${defaultSub} Lecture Notes\n\n## Key Concepts\n- \n\n## Important Formulas & Definitions\n`,
      subject: defaultSub,
      icon: '📝',
      updatedAt: new Date().toISOString(),
      authorName: currentUser?.name || 'Student',
      userId: currentUser?.uid || 'shared',
      permission: 'edit',
      collab_code: Math.floor(100000 + Math.random() * 900000).toString()
    };

    const updated = [newNote, ...notesList];
    setNotesList(updated);
    persistLocalNotes(updated);
    setActiveNoteId(newId);
    setTitle(newNote.title);
    setContent(newNote.content);
    setCurrentSubject(newNote.subject);
    flushSaveToCloud(newId, newNote.content, newNote.title, newNote.subject, newNote);
    showToast('📝 Created new lecture note');
  };

  // 8. Delete Lecture Note
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
      await supabase.from('notes').delete().eq('id', idToDelete);
    } catch (_) {}
    showToast('🗑️ Lecture note deleted');
  };

  // 9. Open Note Settings Modal
  const handleOpenSettings = () => {
    if (!activeNote) return;
    setSettingsTitle(activeNote.title || '');
    setSettingsIcon(activeNote.icon || '📝');
    setSettingsFolderId(activeNote.folder_id || null);
    setSettingsSubject(activeNote.subject || 'Mathematics');
    setSettingsPermission(activeNote.permission || (activeNote.collab_code ? 'edit' : 'private'));
    setSettingsCollabCode(activeNote.collab_code || null);
    setShowSettingsModal(true);
  };

  // 10. Save Note Settings (Owner Only)
  const handleSaveSettings = async () => {
    if (!activeNote) return;
    if (!isOwner) {
      showToast('🔒 Only the note owner can modify note settings.');
      return;
    }

    setIsSavingSettings(true);
    try {
      let finalCode = settingsCollabCode;
      if (settingsPermission === 'private') {
        finalCode = null;
      } else if (!finalCode) {
        finalCode = Math.floor(100000 + Math.random() * 900000).toString();
      }

      const updatedNote: LectureNoteItem = {
        ...activeNote,
        title: settingsTitle.trim() || activeNote.title,
        icon: settingsIcon,
        folder_id: settingsFolderId,
        subject: settingsSubject,
        permission: settingsPermission,
        collab_code: finalCode,
        updatedAt: new Date().toISOString()
      };

      // Update state
      setTitle(updatedNote.title);
      setCurrentSubject(updatedNote.subject);
      setNotesList(prev => {
        const next = prev.map(n => (n.id === activeNote.id ? updatedNote : n));
        persistLocalNotes(next);
        return next;
      });

      // Save to Supabase `notes`
      const dbPayload: any = {
        title: updatedNote.title,
        icon: updatedNote.icon,
        folder_id: updatedNote.folder_id,
        subject: updatedNote.subject,
        permission: updatedNote.permission,
        cover_bg: updatedNote.permission === 'view' ? 'perm_view' : 'perm_edit',
        collab_code: updatedNote.collab_code
      };

      const { error: updErr } = await supabase
        .from('notes')
        .update(dbPayload)
        .eq('id', activeNote.id);

      if (updErr && updErr.code === 'PGRST204') {
        delete dbPayload.permission;
        await supabase.from('notes').update(dbPayload).eq('id', activeNote.id);
      }

      // Broadcast settings update to Realtime channel
      sendRealtimeEvent(`lecture_collab_${activeNote.id}`, 'note_settings_changed', {
        title: updatedNote.title,
        icon: updatedNote.icon,
        folder_id: updatedNote.folder_id,
        subject: updatedNote.subject,
        permission: updatedNote.permission,
        collab_code: updatedNote.collab_code
      });

      setShowSettingsModal(false);
      showToast('⚙️ Note settings saved successfully');
    } catch (err: any) {
      showToast('⚠️ Failed to save note settings: ' + (err.message || 'Error'));
    } finally {
      setIsSavingSettings(false);
    }
  };

  // 11. Folder creation
  const handleCreateFolder = async () => {
    if (!newFolderName.trim() || !currentUser?.uid) return;
    const f = await createFolder(newFolderName, 'notes', currentUser.uid);
    if (f) {
      setFolders([f, ...folders]);
      setNewFolderName('');
      setShowFolderModal(false);
      showToast('📁 Folder created');
    }
  };

  // 12. Markdown token injection
  const injectMarkdownToken = (prefix: string, suffix = '') => {
    if (!canEdit) return;
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

  // 13. PDF Export
  const handleExportPdf = () => {
    generateFormattedPdf(title || 'Lecture Note', currentSubject, content);
    showToast('⬇️ Downloaded Formatted PDF (Matches Reader View)');
  };

  const handleCopyCollabCode = () => {
    if (activeNote?.collab_code) {
      navigator.clipboard.writeText(activeNote.collab_code);
      showToast(`📋 Code copied: ${activeNote.collab_code}`);
    }
  };

  // AI study helper tools
  const handleRunAiStudyTool = async (mode: 'summarize' | 'takeaways' | 'structure') => {
    if (!canEdit) {
      showToast('🔒 View-only note: cannot run AI modifications.');
      return;
    }
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
        saveAndBroadcast(nextContent, title, currentSubject);
        showToast('✨ AI study enhancement added to note');
      } else {
        showToast('⚠️ AI service returned an empty response.');
      }
    } catch (_) {
      showToast('⚠️ Could not reach AI service. Note saved safely.');
    } finally {
      setAiBusy(null);
    }
  };

  const handleRunCustomAiPrompt = async (presetAction?: string, overridePrompt?: string) => {
    if (!canEdit) {
      showToast('🔒 View-only note: cannot modify with AI.');
      return;
    }
    const targetPrompt = overridePrompt || aiCustomPrompt;
    if (!targetPrompt.trim() && !presetAction) {
      showToast('⚠️ Type an AI prompt or select a quick action chip first.');
      return;
    }
    setAiBusy('custom');
    try {
      const res = await fetch('/api/ai/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: presetAction || 'custom',
          content,
          customPrompt: targetPrompt
        })
      });
      const data = await res.json();
      const text = (data?.text || '').trim();
      if (text) {
        setAiProposedResult(text);
        showToast('✨ AI Proposal ready! Review changes below.');
      } else {
        showToast('⚠️ AI service returned an empty proposal.');
      }
    } catch (_) {
      showToast('⚠️ Error generating AI proposal.');
    } finally {
      setAiBusy(null);
    }
  };

  const handleApplyAiProposal = (mode: 'replace' | 'append') => {
    if (!aiProposedResult || !canEdit) return;
    const nextContent = mode === 'replace'
      ? aiProposedResult
      : `${content.trim()}\n\n---\n${aiProposedResult}`;
    setContent(nextContent);
    saveAndBroadcast(nextContent, title, currentSubject);
    setAiProposedResult(null);
    setAiCustomPrompt('');
    showToast(mode === 'replace' ? '✨ Replaced note with AI proposal!' : '✨ Appended AI proposal to note!');
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

  const safeNotesList = notesList || [];
  const filteredNotes = safeNotesList.filter(n => {
    if (!n) return false;
    const matchesSub = subjectFilter === 'All Subjects' || n.subject === subjectFilter;
    const q = (searchQuery || '').trim().toLowerCase();
    const titleStr = (n.title || '').toLowerCase();
    const contentStr = (n.content || '').toLowerCase();
    const subjectStr = (n.subject || '').toLowerCase();
    const matchesSearch = !q || titleStr.includes(q) || contentStr.includes(q) || subjectStr.includes(q);
    return matchesSub && matchesSearch;
  });

  const safeContent = content || '';
  const wordCount = safeContent.trim() ? safeContent.trim().split(/\s+/).length : 0;

  // 14. High-Fidelity Reader View Renderer with Markdown Tables, Code Blocks, and Callouts
  const renderFormattedPreview = (raw: string) => {
    const safeRaw = raw || '';
    if (!safeRaw.trim()) {
      return (
        <div className="py-12 text-center text-slate-500 italic text-xs">
          No content written yet. Switch to Write mode to take notes.
        </div>
      );
    }

    const lines = safeRaw.split('\n');
    const elements: React.ReactNode[] = [];
    let i = 0;

    const parseInline = (text: string) => {
      const parts = text.split(/(\*\*.*?\*\*|\*.*?\*|`.*?`|\$\$.*?\$\$)/g);
      return parts.map((part, idx) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return <strong key={idx} className="font-extrabold text-white">{part.slice(2, -2)}</strong>;
        }
        if (part.startsWith('*') && part.endsWith('*')) {
          return <em key={idx} className="italic text-slate-300">{part.slice(1, -1)}</em>;
        }
        if (part.startsWith('`') && part.endsWith('`')) {
          return <code key={idx} className="px-1.5 py-0.5 rounded bg-slate-950 text-indigo-300 font-mono text-[11px] border border-white/10">{part.slice(1, -1)}</code>;
        }
        if (part.startsWith('$$') && part.endsWith('$$')) {
          return <span key={idx} className="px-1.5 py-0.5 rounded bg-indigo-950/60 text-indigo-200 font-mono text-xs border border-indigo-500/30">{part.slice(2, -2)}</span>;
        }
        return part;
      });
    };

    while (i < lines.length) {
      const line = lines[i];
      const trimmed = line.trim();

      if (!trimmed) {
        elements.push(<div key={`blank-${i}`} className="h-2" />);
        i++;
        continue;
      }

      // Horizontal Divider
      if (trimmed === '---' || trimmed === '***') {
        elements.push(<hr key={`hr-${i}`} className="border-white/10 my-4" />);
        i++;
        continue;
      }

      // Code Block ```lang
      if (trimmed.startsWith('```')) {
        const lang = trimmed.slice(3).trim() || 'code';
        const codeLines: string[] = [];
        i++;
        while (i < lines.length && !lines[i].trim().startsWith('```')) {
          codeLines.push(lines[i]);
          i++;
        }
        if (i < lines.length && lines[i].trim().startsWith('```')) {
          i++;
        }
        const fullCode = codeLines.join('\n');
        elements.push(
          <div key={`code-${i}`} className="my-3 rounded-2xl overflow-hidden border border-white/10 bg-slate-950 text-xs font-mono shadow-md">
            <div className="flex items-center justify-between px-4 py-2 bg-slate-900 border-b border-white/5 text-[10px] text-slate-400 font-bold uppercase tracking-wider">
              <span>{lang}</span>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(fullCode);
                  showToast('📋 Code copied to clipboard');
                }}
                className="px-2 py-0.5 rounded bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition-colors cursor-pointer"
              >
                Copy
              </button>
            </div>
            <pre className="p-4 overflow-x-auto text-slate-100 whitespace-pre scrollbar-thin">
              <code>{fullCode}</code>
            </pre>
          </div>
        );
        continue;
      }

      // Markdown Table: Detect rows starting and ending with |
      if (trimmed.startsWith('|') && trimmed.endsWith('|') && trimmed.includes('|')) {
        const tableLines: string[] = [];
        while (i < lines.length && lines[i].trim().startsWith('|') && lines[i].trim().endsWith('|')) {
          tableLines.push(lines[i].trim());
          i++;
        }

        const parseCells = (rowStr: string) => rowStr.slice(1, -1).split('|').map(c => c.trim());
        const isSep = (rowStr: string) => /^\|[\s\-:|]+\|$/.test(rowStr);

        let headers: string[] = [];
        const bodyRows: string[][] = [];

        if (tableLines.length >= 2 && isSep(tableLines[1])) {
          headers = parseCells(tableLines[0]);
          for (let r = 2; r < tableLines.length; r++) {
            if (!isSep(tableLines[r])) bodyRows.push(parseCells(tableLines[r]));
          }
        } else {
          headers = parseCells(tableLines[0]);
          for (let r = 1; r < tableLines.length; r++) {
            if (!isSep(tableLines[r])) bodyRows.push(parseCells(tableLines[r]));
          }
        }

        elements.push(
          <div key={`table-${i}`} className="my-4 rounded-2xl overflow-hidden border border-white/10 bg-slate-950/70 shadow-lg">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-900 border-b border-white/10 text-white font-bold">
                    {headers.map((h, hIdx) => (
                      <th key={hIdx} className="px-3.5 py-2.5 text-indigo-300 font-extrabold tracking-tight">
                        {parseInline(h)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {bodyRows.map((row, rIdx) => (
                    <tr key={rIdx} className="even:bg-white/[0.02] hover:bg-white/[0.04] transition-colors">
                      {headers.map((_, cIdx) => (
                        <td key={cIdx} className="px-3.5 py-2 text-slate-200">
                          {parseInline(row[cIdx] || '')}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
        continue;
      }

      // Blockquotes and Callouts (> text)
      if (trimmed.startsWith('>')) {
        const text = trimmed.replace(/^>\s?/, '');
        elements.push(
          <blockquote key={`quote-${i}`} className="my-2.5 border-l-4 border-indigo-500 bg-indigo-500/10 px-4 py-2.5 rounded-r-2xl text-xs sm:text-sm text-indigo-100 italic leading-relaxed">
            {parseInline(text)}
          </blockquote>
        );
        i++;
        continue;
      }

      // Headings
      if (line.startsWith('# ')) {
        elements.push(<h2 key={`h1-${i}`} className="text-lg sm:text-xl font-black text-white mt-4 mb-2 tracking-tight">{parseInline(line.slice(2))}</h2>);
        i++;
        continue;
      }
      if (line.startsWith('## ')) {
        elements.push(<h3 key={`h2-${i}`} className="text-base sm:text-lg font-black text-indigo-300 mt-3.5 mb-1.5 tracking-tight">{parseInline(line.slice(3))}</h3>);
        i++;
        continue;
      }
      if (line.startsWith('### ')) {
        elements.push(<h4 key={`h3-${i}`} className="text-sm sm:text-base font-extrabold text-indigo-200 mt-3 mb-1 tracking-tight">{parseInline(line.slice(4))}</h4>);
        i++;
        continue;
      }

      // Task Items
      if (trimmed.startsWith('- [ ] ') || trimmed.startsWith('- [x] ') || trimmed.startsWith('- [X] ')) {
        const checked = trimmed.startsWith('- [x] ') || trimmed.startsWith('- [X] ');
        elements.push(
          <div key={`task-${i}`} className="flex items-center gap-2 pl-2 my-1 text-xs sm:text-sm">
            <span className={`w-4 h-4 rounded-md flex items-center justify-center border text-[10px] shrink-0 ${checked ? 'bg-emerald-600 border-emerald-400 text-white font-bold' : 'border-white/30 text-transparent'}`}>
              {checked ? '✓' : ''}
            </span>
            <span className={checked ? 'line-through text-slate-500' : 'text-slate-200'}>
              {parseInline(trimmed.slice(6))}
            </span>
          </div>
        );
        i++;
        continue;
      }

      // Bullet List
      if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
        elements.push(
          <div key={`bullet-${i}`} className="flex items-start gap-2 pl-2 my-1 text-xs sm:text-sm text-slate-200">
            <span className="text-indigo-400 font-bold">•</span>
            <span className="leading-relaxed">{parseInline(trimmed.slice(2))}</span>
          </div>
        );
        i++;
        continue;
      }

      // Numbered List
      const numMatch = trimmed.match(/^(\d+)\.\s+(.*)/);
      if (numMatch) {
        elements.push(
          <div key={`num-${i}`} className="flex items-start gap-2 pl-2 my-1 text-xs sm:text-sm text-slate-200">
            <span className="text-indigo-400 font-bold font-mono">{numMatch[1]}.</span>
            <span className="leading-relaxed">{parseInline(numMatch[2])}</span>
          </div>
        );
        i++;
        continue;
      }

      // Standard Paragraph
      elements.push(
        <p key={`p-${i}`} className="text-xs sm:text-sm text-slate-200 leading-relaxed my-1 break-words">
          {parseInline(line)}
        </p>
      );
      i++;
    }

    return <div className="space-y-1">{elements}</div>;
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
            className="px-2.5 py-1.5 rounded-xl bg-slate-900 border border-white/10 text-xs text-slate-200 font-bold focus:outline-none cursor-pointer"
          >
            {AVAILABLE_SUBJECTS.map(sub => (
              <option key={sub} value={sub} className="bg-slate-900 text-white">{sub}</option>
            ))}
          </select>

          <button
            onClick={() => setShowJoinModal(true)}
            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-indigo-300 text-xs font-bold flex items-center gap-1.5 shadow-md transition-all active:scale-95 shrink-0 border border-indigo-500/30 cursor-pointer"
          >
            <Users className="w-3.5 h-3.5 text-indigo-400" />
            <span>Join with Code</span>
          </button>

          <button
            onClick={handleCreateNewLectureNote}
            className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-md transition-all active:scale-95 shrink-0 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Note</span>
          </button>
        </div>

        {/* Live Collaborators Presence */}
        <div className="flex items-center justify-between sm:justify-end gap-2.5 bg-slate-900 px-3 py-1.5 rounded-xl border border-white/10 shrink-0">
          <div className="flex items-center gap-1.5 text-[11px] text-emerald-400 font-bold">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>{Math.max(1, (activeEditors || []).length)} Active</span>
          </div>
          <div className="flex -space-x-1.5">
            {((activeEditors && activeEditors.length > 0) ? activeEditors : [{ uid: currentUser?.uid || 'me', name: currentUser?.name || 'You' }])
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

      {/* Folders & Notes Navigation */}
      <div className="flex flex-col gap-3">
        {/* Folder Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none no-scrollbar">
          <button
            onClick={() => setActiveFolderId(null)}
            className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider border transition-all cursor-pointer ${!activeFolderId ? 'bg-indigo-600 border-indigo-400 text-white shadow-lg shadow-indigo-500/20' : 'bg-slate-950/60 border-white/5 text-slate-400 hover:bg-slate-900'}`}
          >
            All Notes
          </button>
          {folders.map(f => (
            <button
              key={f.id}
              onClick={() => setActiveFolderId(f.id)}
              className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider border transition-all cursor-pointer ${activeFolderId === f.id ? 'bg-indigo-600 border-indigo-400 text-white shadow-lg shadow-indigo-500/20' : 'bg-slate-950/60 border-white/5 text-slate-400 hover:bg-slate-900'}`}
            >
              📁 {f.name}
            </button>
          ))}
          <button
            onClick={() => setShowFolderModal(true)}
            className="p-1.5 rounded-xl bg-slate-950/60 border border-dashed border-white/20 text-slate-500 hover:text-indigo-400 hover:border-indigo-500/40 transition-all cursor-pointer"
            title="Create Folder"
          >
            <FolderPlus className="w-4 h-4" />
          </button>
        </div>

        {/* Note Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
          {filteredNotes
            .filter(n => !activeFolderId || n.folder_id === activeFolderId)
            .sort((a, b) => {
              if (a.isPinned && !b.isPinned) return -1;
              if (!a.isPinned && b.isPinned) return 1;
              return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
            })
            .map((note) => {
              const isSelected = note.id === activeNoteId;
              return (
                <div
                  key={note.id}
                  className={`group flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-bold shrink-0 transition-all cursor-pointer relative ${
                    isSelected
                      ? 'bg-indigo-600/20 border-indigo-500/50 text-white shadow-md'
                      : 'bg-slate-950/60 border-white/5 text-slate-400 hover:text-white hover:bg-slate-900'
                  }`}
                  onClick={() => setActiveNoteId(note.id)}
                >
                  {note.isPinned && <Pin className="w-2.5 h-2.5 text-amber-400 absolute -top-1 -right-1 rotate-45" />}
                  <span className="text-sm shrink-0">{note.icon || '📝'}</span>
                  <span className="truncate max-w-[140px]">{note.title || 'Untitled'}</span>
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/5 text-indigo-300 font-mono">{note.subject}</span>
                  {note.collab_code && (
                    <span title={note.permission === 'view' ? 'View-Only Collab' : 'Editable Collab'}>
                      {note.permission === 'view' ? (
                        <Eye className="w-3 h-3 text-amber-400" />
                      ) : (
                        <Users className="w-3 h-3 text-emerald-400" />
                      )}
                    </span>
                  )}
                </div>
              );
            })}
        </div>
      </div>

      {/* Active Note Header & Action Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-3">
        <div className="flex items-start sm:items-center gap-3 flex-1 min-w-0">
          <div className="p-2.5 rounded-2xl bg-indigo-500/20 border border-indigo-500/30 text-indigo-400 shrink-0 text-xl flex items-center justify-center">
            {activeNote?.icon || '📝'}
          </div>
          <div className="flex-1 min-w-0">
            <input
              type="text"
              value={title}
              disabled={!canEdit}
              onChange={(e) => handleTitleChange(e.target.value)}
              placeholder="Lecture Note Title..."
              className={`w-full bg-transparent font-black text-white text-sm sm:text-base focus:outline-none focus:border-b border-indigo-500 truncate ${!canEdit ? 'opacity-90 cursor-default' : ''}`}
            />
            <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400 mt-1">
              <select
                value={currentSubject}
                disabled={!canEdit}
                onChange={(e) => handleSubjectChange(e.target.value)}
                className="px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-extrabold text-[11px] border border-indigo-500/30 focus:outline-none cursor-pointer disabled:opacity-75"
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
              {activeNote?.permission === 'view' && !isOwner && (
                <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold text-[10px] border border-amber-500/30">
                  🔒 View-Only Collab
                </span>
              )}
            </div>
          </div>
        </div>

        {/* View Mode & Actions Toolbar */}
        <div className="flex flex-wrap items-center gap-1.5">
          {/* Owner Note Settings Button */}
          <button
            onClick={handleOpenSettings}
            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-white/10 text-[11px] font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
            title="Note Settings (Title, Icon, Folder & Permissions)"
          >
            <Settings className="w-3.5 h-3.5 text-indigo-400" />
            <span>Settings</span>
          </button>

          {/* View Mode Switcher */}
          <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-white/10">
            <button
              onClick={() => setViewMode('write')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer ${viewMode === 'write' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}
            >
              <Edit3 className="w-3 h-3" /> Write
            </button>
            <button
              onClick={() => setViewMode('split')}
              className={`hidden md:flex px-2.5 py-1 rounded-lg text-[11px] font-bold items-center gap-1 transition-all cursor-pointer ${viewMode === 'split' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}
            >
              <Columns className="w-3 h-3" /> Split
            </button>
            <button
              onClick={() => setViewMode('preview')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer ${viewMode === 'preview' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}
            >
              <Eye className="w-3 h-3" /> Reader View
            </button>
          </div>

          {canEdit && (
            <button
              onClick={() => flushSaveToCloud(activeNoteId!, content, title, currentSubject)}
              className="px-2.5 py-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer"
              title="Save Note Now"
            >
              <Save className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Save</span>
            </button>
          )}

          {/* Download Formatted PDF */}
          <button
            onClick={handleExportPdf}
            className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-[11px] font-bold flex items-center gap-1.5 transition-all shadow-lg shadow-rose-500/20 cursor-pointer"
            title="Download Formatted PDF (Tables, fonts & formatting preserved)"
          >
            <Download className="w-3.5 h-3.5" />
            <span>PDF Export</span>
          </button>
        </div>
      </div>

      {/* Collaboration Status Bar (if code exists) */}
      {activeNote?.collab_code && (
        <div className="flex items-center justify-between bg-emerald-500/10 border border-emerald-500/30 px-4 py-2 rounded-2xl">
          <div className="flex items-center gap-2">
            <Unlock className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-bold text-emerald-200">
              Shared Note • {activeNote.permission === 'view' ? 'View Only for Collaborators' : 'Live Collaboration Enabled'}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 bg-slate-950 px-3 py-1 rounded-xl border border-white/10">
              <span className="text-[10px] text-slate-500 font-black uppercase">Code:</span>
              <span className="text-sm font-mono font-black text-white tracking-widest">{activeNote.collab_code}</span>
            </div>
            <button
              onClick={handleCopyCollabCode}
              className="p-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-all cursor-pointer"
              title="Copy Join Code"
            >
              <Copy className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Formatting & Study Toolbar (only in write / split mode) */}
      {(viewMode === 'write' || viewMode === 'split') && (
        <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-950/60 p-2 rounded-2xl border border-white/5">
          <div className="flex flex-wrap items-center gap-1">
            <button onClick={() => injectMarkdownToken('# ', '\n')} className="px-2 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 text-[10px] font-bold border border-white/5 cursor-pointer">H1</button>
            <button onClick={() => injectMarkdownToken('## ', '\n')} className="px-2 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 text-[10px] font-bold border border-white/5 cursor-pointer">H2</button>
            <button onClick={() => injectMarkdownToken('### ', '\n')} className="px-2 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 text-[10px] font-bold border border-white/5 cursor-pointer">H3</button>
            <button onClick={() => injectMarkdownToken('**', '**')} className="px-2 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 text-[10px] font-black border border-white/5 cursor-pointer">B</button>
            <button onClick={() => injectMarkdownToken('*', '*')} className="px-2 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 text-[10px] italic border border-white/5 cursor-pointer">I</button>
            <button onClick={() => injectMarkdownToken('\n| Header 1 | Header 2 | Header 3 |\n|---|---|---|\n| Item A | Value 1 | Active |\n| Item B | Value 2 | Pending |\n', '')} className="px-2 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-indigo-300 text-[10px] font-bold border border-indigo-500/20 cursor-pointer">⊞ Table</button>
            <button onClick={() => injectMarkdownToken('- ', '')} className="px-2 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 text-[10px] font-bold border border-white/5 cursor-pointer">• List</button>
            <button onClick={() => injectMarkdownToken('- [ ] ', '')} className="px-2 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 text-[10px] font-bold border border-white/5 cursor-pointer">☑ Task</button>
            <button onClick={() => injectMarkdownToken('$$ ', ' $$')} className="px-2 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-indigo-300 text-[10px] font-mono border border-white/5 cursor-pointer">∑ Math</button>
            <button onClick={() => injectMarkdownToken('```\n', '\n```')} className="px-2 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-amber-300 text-[10px] font-mono border border-white/5 cursor-pointer">{'</>'} Code</button>
            <button onClick={() => injectMarkdownToken('> 💡 **Key Takeaway:** ', '\n')} className="px-2 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-emerald-300 text-[10px] font-bold border border-white/5 cursor-pointer">💡 Callout</button>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <button
              onClick={() => handleRunAiStudyTool('summarize')}
              disabled={Boolean(aiBusy) || !canEdit}
              className="px-2.5 py-1 rounded-xl bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-300 border border-indigo-500/30 text-[10px] font-bold flex items-center gap-1 disabled:opacity-40 transition-all cursor-pointer"
            >
              <Sparkles className="w-3 h-3" />
              <span>{aiBusy === 'summarize' ? 'Summarizing...' : 'Summarize'}</span>
            </button>
            <button
              onClick={() => handleRunAiStudyTool('takeaways')}
              disabled={Boolean(aiBusy) || !canEdit}
              className="px-2.5 py-1 rounded-xl bg-purple-500/15 hover:bg-purple-500/25 text-purple-300 border border-purple-500/30 text-[10px] font-bold flex items-center gap-1 disabled:opacity-40 transition-all cursor-pointer"
            >
              <ListChecks className="w-3 h-3" />
              <span>{aiBusy === 'takeaways' ? 'Extracting...' : 'Exam Q&A'}</span>
            </button>
            <button
              onClick={handleSaveToFlashcards}
              className="px-2.5 py-1 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 text-[10px] font-bold flex items-center gap-1 transition-all cursor-pointer"
              title="Convert Lecture Note into Study Center Flashcards"
            >
              <Brain className="w-3 h-3" />
              <span>To Flashcards</span>
            </button>
          </div>
        </div>
      )}

      {/* AI Prompt & Quick Action Bar */}
      {(viewMode === 'write' || viewMode === 'split') && (
        <div className="flex flex-col gap-2.5 bg-gradient-to-r from-indigo-950/40 via-purple-950/30 to-slate-950/60 p-3 rounded-2xl border border-indigo-500/20 shadow-inner">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-indigo-400 shrink-0 animate-pulse" />
            <input
              type="text"
              value={aiCustomPrompt}
              onChange={(e) => setAiCustomPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !aiBusy) {
                  e.preventDefault();
                  handleRunCustomAiPrompt();
                }
              }}
              placeholder="Ask Orion AI to generate, rewrite, format table, add examples, or solve problems..."
              className="flex-1 bg-slate-950/80 border border-indigo-500/30 px-3.5 py-1.5 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-400 font-medium"
            />
            <button
              onClick={() => handleRunCustomAiPrompt()}
              disabled={Boolean(aiBusy) || !canEdit || !aiCustomPrompt.trim()}
              className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-xs font-bold flex items-center gap-1.5 shrink-0 shadow-md cursor-pointer transition-all"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{aiBusy === 'custom' ? 'Thinking...' : 'AI Generate'}</span>
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
            <span className="text-slate-500 font-bold uppercase tracking-wider text-[9px]">Quick Chips:</span>
            <button
              onClick={() => handleRunCustomAiPrompt('improve', 'Format into clear structured headings, bullet points, definitions, and code/math blocks.')}
              disabled={Boolean(aiBusy) || !canEdit}
              className="px-2.5 py-1 rounded-lg bg-indigo-500/15 hover:bg-indigo-500/25 border border-indigo-500/30 text-indigo-300 font-bold transition-all cursor-pointer disabled:opacity-40"
            >
              ✨ Improve Structure
            </button>
            <button
              onClick={() => handleRunCustomAiPrompt('summarize', 'Create key takeaways, core definitions, and 3 high-yield exam Q&A questions.')}
              disabled={Boolean(aiBusy) || !canEdit}
              className="px-2.5 py-1 rounded-lg bg-purple-500/15 hover:bg-purple-500/25 border border-purple-500/30 text-purple-300 font-bold transition-all cursor-pointer disabled:opacity-40"
            >
              📝 Summarize
            </button>
            <button
              onClick={() => handleRunCustomAiPrompt('expand', 'Expand this note with real-world examples, step-by-step solutions, and detailed explanations.')}
              disabled={Boolean(aiBusy) || !canEdit}
              className="px-2.5 py-1 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 font-bold transition-all cursor-pointer disabled:opacity-40"
            >
              🔍 Expand Examples
            </button>
            <button
              onClick={() => handleRunCustomAiPrompt('simplify', 'Simplify this note into plain, easy-to-understand student language.')}
              disabled={Boolean(aiBusy) || !canEdit}
              className="px-2.5 py-1 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 font-bold transition-all cursor-pointer disabled:opacity-40"
            >
              💡 Simplify Language
            </button>
            <button
              onClick={() => handleRunCustomAiPrompt('fixGrammar', 'Fix all spelling, grammar, punctuation, and typographical mistakes without changing content meaning.')}
              disabled={Boolean(aiBusy) || !canEdit}
              className="px-2.5 py-1 rounded-lg bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/30 text-cyan-300 font-bold transition-all cursor-pointer disabled:opacity-40"
            >
              🛠️ Fix Grammar
            </button>
          </div>
        </div>
      )}

      {/* Editor & Reader View Container */}
      <div className={`grid gap-4 min-h-[380px] sm:min-h-[460px] relative ${viewMode === 'split' ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1'}`}>
        {!activeNoteId ? (
          <div className="flex flex-col items-center justify-center bg-slate-950/50 rounded-2xl border border-dashed border-white/10 p-10 text-center">
            <BookOpen className="w-12 h-12 text-slate-700 mb-4" />
            <h3 className="text-lg font-bold text-slate-300">No Lecture Note Selected</h3>
            <p className="text-xs text-slate-500 max-w-xs mt-2">Select a note from the list above or create a new one to start collaborating.</p>
            <div className="flex items-center gap-3 mt-6">
              <button onClick={handleCreateNewLectureNote} className="px-4 py-2 bg-indigo-600 rounded-xl text-white text-xs font-bold shadow-lg cursor-pointer">New Note</button>
              <button onClick={() => setShowJoinModal(true)} className="px-4 py-2 bg-slate-800 rounded-xl text-indigo-300 text-xs font-bold border border-indigo-500/20 cursor-pointer">Join with Code</button>
            </div>
          </div>
        ) : (
          <>
            {(viewMode === 'write' || viewMode === 'split') && (
              <div className="relative flex flex-col h-full min-h-[360px]">
                <textarea
                  ref={textareaRef}
                  value={content}
                  readOnly={!canEdit}
                  onChange={handleContentChange}
                  placeholder={canEdit ? "Start typing lecture notes here... Changes sync live with classmates and save automatically." : "This note is in View-Only mode."}
                  className={`w-full flex-1 p-4 rounded-2xl bg-slate-950 border border-white/10 text-slate-100 text-xs sm:text-sm focus:outline-none focus:border-indigo-500/50 resize-none font-mono leading-relaxed scrollbar-thin placeholder-slate-600 ${!canEdit ? 'opacity-80 cursor-not-allowed' : ''}`}
                />
              </div>
            )}

            {(viewMode === 'preview' || viewMode === 'split') && (
              <div className="p-5 sm:p-6 rounded-2xl bg-slate-950/90 border border-white/10 overflow-y-auto max-h-[520px] scrollbar-thin">
                <div className="border-b border-white/10 pb-3 mb-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{activeNote?.icon || '📝'}</span>
                    <div>
                      <h3 className="text-sm sm:text-base font-extrabold text-white">{title || 'Untitled Note'}</h3>
                      <p className="text-[11px] text-indigo-400 font-semibold">{currentSubject} • Reader View</p>
                    </div>
                  </div>
                  <span className="text-[10px] text-slate-500 font-mono">Verified Veylentra Document</span>
                </div>
                {renderFormattedPreview(content)}
              </div>
            )}
          </>
        )}

        {/* Live Saving Status Pill */}
        {activeNoteId && (
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
        )}
      </div>

      {/* Owner Note Settings Modal */}
      {showSettingsModal && activeNote && (
        <div className="fixed inset-0 z-[115] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="w-full max-w-md bg-slate-900 border border-white/10 rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <Settings className="w-5 h-5 text-indigo-400" />
                <h3 className="text-base font-black text-white">Note Settings</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowSettingsModal(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {!isOwner && (
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs flex items-center gap-2">
                <Shield className="w-4 h-4 text-amber-400 shrink-0" />
                <span>Only the owner of this note can modify its title, icon, folder, and collaboration permissions.</span>
              </div>
            )}

            {/* A. Identity: Title & Icon */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-300">Note Title & Icon</label>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <div className="w-11 h-11 rounded-xl bg-slate-950 border border-white/10 flex items-center justify-center text-xl cursor-pointer">
                    {settingsIcon}
                  </div>
                </div>
                <input
                  type="text"
                  disabled={!isOwner}
                  value={settingsTitle}
                  onChange={(e) => setSettingsTitle(e.target.value)}
                  placeholder="Note Title"
                  className="flex-1 px-3.5 py-2.5 bg-slate-950 border border-white/10 rounded-xl text-white text-xs font-bold focus:outline-none focus:border-indigo-500 disabled:opacity-60"
                />
              </div>

              {isOwner && (
                <div className="flex items-center gap-1.5 overflow-x-auto py-1 scrollbar-none">
                  {NOTE_ICONS.map((icon) => (
                    <button
                      key={icon}
                      type="button"
                      onClick={() => setSettingsIcon(icon)}
                      className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm transition-all cursor-pointer ${settingsIcon === icon ? 'bg-indigo-600 ring-2 ring-indigo-400 scale-105' : 'bg-slate-950 hover:bg-slate-800'}`}
                    >
                      {icon}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* B. Organization: Folder & Subject */}
            <div className="grid grid-cols-2 gap-3 pt-2">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Folder / Place</label>
                <select
                  disabled={!isOwner}
                  value={settingsFolderId || ''}
                  onChange={(e) => setSettingsFolderId(e.target.value || null)}
                  className="w-full px-3 py-2 bg-slate-950 border border-white/10 rounded-xl text-white text-xs focus:outline-none focus:border-indigo-500 disabled:opacity-60 cursor-pointer"
                >
                  <option value="">📂 Root / No Folder</option>
                  {folders.map(f => (
                    <option key={f.id} value={f.id}>📁 {f.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Subject</label>
                <select
                  disabled={!isOwner}
                  value={settingsSubject}
                  onChange={(e) => setSettingsSubject(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-white/10 rounded-xl text-white text-xs focus:outline-none focus:border-indigo-500 disabled:opacity-60 cursor-pointer"
                >
                  {AVAILABLE_SUBJECTS.filter(s => s !== 'All Subjects').map(sub => (
                    <option key={sub} value={sub}>{sub}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* C. Editing Permissions */}
            <div className="space-y-2 pt-2 border-t border-white/10">
              <label className="block text-xs font-bold text-slate-300">Collaboration Permission</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { level: 'private', label: 'Private', icon: Lock, desc: 'Owner only' },
                  { level: 'view', label: 'View Only', icon: Eye, desc: 'Guests read' },
                  { level: 'edit', label: 'Can Edit', icon: Edit3, desc: 'Collaborate' }
                ].map((item) => {
                  const selected = settingsPermission === item.level;
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.level}
                      type="button"
                      disabled={!isOwner}
                      onClick={() => setSettingsPermission(item.level as any)}
                      className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer disabled:opacity-60 ${
                        selected
                          ? 'bg-indigo-600/25 border-indigo-500 text-white shadow-sm'
                          : 'bg-slate-950/60 border-white/10 text-slate-400 hover:text-white'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <Icon className="w-3.5 h-3.5 text-indigo-400" />
                        {selected && <Check className="w-3 h-3 text-indigo-300" />}
                      </div>
                      <div className="text-xs font-bold text-white">{item.label}</div>
                      <div className="text-[9px] text-slate-500">{item.desc}</div>
                    </button>
                  );
                })}
              </div>

              {settingsPermission !== 'private' && (
                <div className="p-3 rounded-xl bg-slate-950 border border-white/10 flex items-center justify-between gap-2 mt-2">
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">6-Digit Collab Code</span>
                    <span className="font-mono text-sm font-black text-emerald-400 tracking-wider">
                      {settingsCollabCode || 'Will generate on save'}
                    </span>
                  </div>
                  {isOwner && (
                    <button
                      type="button"
                      onClick={() => {
                        const newCode = Math.floor(100000 + Math.random() * 900000).toString();
                        setSettingsCollabCode(newCode);
                        showToast(`Generated new code: ${newCode}`);
                      }}
                      className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-bold border border-white/10 cursor-pointer"
                    >
                      Regenerate
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-3 pt-3 border-t border-white/10">
              <button
                type="button"
                onClick={() => setShowSettingsModal(false)}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold cursor-pointer"
              >
                Close
              </button>
              {isOwner && (
                <button
                  type="button"
                  disabled={isSavingSettings}
                  onClick={handleSaveSettings}
                  className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold shadow-lg shadow-indigo-600/20 cursor-pointer"
                >
                  {isSavingSettings ? 'Saving...' : 'Apply & Save'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Join Note Modal */}
      {showJoinModal && (
        <div className="fixed inset-0 z-[115] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-slate-900 border border-white/10 rounded-3xl p-6 shadow-2xl">
            <h3 className="text-lg font-black text-white mb-2 flex items-center gap-2">
              <Users className="w-5 h-5 text-emerald-400" />
              Join Collaborative Note
            </h3>
            <p className="text-[11px] text-slate-400 mb-4">
              Enter the 6-digit code shared by the note owner to view or edit together in real time.
            </p>
            <div className="relative">
              <Hash className="w-4 h-4 text-slate-600 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                maxLength={6}
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.replace(/\D/g, ''))}
                placeholder="6-digit code"
                className="w-full pl-9 pr-4 py-3 bg-slate-950 border border-white/10 rounded-xl text-white text-center text-lg font-mono font-black tracking-widest focus:outline-none focus:border-emerald-500"
                autoFocus
              />
            </div>
            <div className="flex items-center gap-3 mt-6">
              <button
                onClick={() => setShowJoinModal(false)}
                className="flex-1 px-4 py-2.5 bg-slate-800 text-slate-300 rounded-xl text-xs font-bold cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleJoinNote}
                disabled={isJoining || joinCode.length < 5}
                className="flex-1 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-lg cursor-pointer"
              >
                {isJoining ? 'Joining...' : 'Join Note'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Folder Creation Modal */}
      {showFolderModal && (
        <div className="fixed inset-0 z-[115] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-slate-900 border border-white/10 rounded-3xl p-6 shadow-2xl">
            <h3 className="text-lg font-black text-white mb-4 flex items-center gap-2">
              <FolderPlus className="w-5 h-5 text-indigo-400" />
              Create New Folder
            </h3>
            <input
              type="text"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              placeholder="Folder Name (e.g. AP Calculus)"
              className="w-full px-4 py-3 bg-slate-950 border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-indigo-500"
              autoFocus
            />
            <div className="flex items-center gap-3 mt-6">
              <button
                onClick={() => setShowFolderModal(false)}
                className="flex-1 px-4 py-2.5 bg-slate-800 text-slate-300 rounded-xl text-xs font-bold cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateFolder}
                className="flex-1 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold shadow-lg cursor-pointer"
              >
                Create Folder
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AI Proposal Preview Modal */}
      {aiProposedResult && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md">
          <div className="w-full max-w-2xl bg-slate-900 border border-indigo-500/30 rounded-3xl p-6 shadow-2xl flex flex-col max-h-[85vh] overflow-hidden">
            <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-4">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-indigo-400 animate-pulse" />
                <h3 className="text-base sm:text-lg font-black text-white">Orion AI Note Proposal</h3>
              </div>
              <button
                onClick={() => setAiProposedResult(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-400 mb-3">
              Review the AI proposed update below. You can replace the whole note or append it to the end of your current text.
            </p>

            <div className="flex-1 overflow-y-auto p-4 rounded-2xl bg-slate-950 border border-white/10 text-xs font-mono text-slate-200 leading-relaxed scrollbar-thin whitespace-pre-wrap">
              {aiProposedResult}
            </div>

            <div className="flex flex-wrap items-center justify-end gap-3 mt-5 pt-3 border-t border-white/10">
              <button
                onClick={() => setAiProposedResult(null)}
                className="px-4 py-2.5 bg-slate-800 text-slate-300 rounded-xl text-xs font-bold hover:bg-slate-700 cursor-pointer"
              >
                Discard
              </button>
              <button
                onClick={() => handleApplyAiProposal('append')}
                className="px-4 py-2.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold shadow-lg cursor-pointer"
              >
                Append to End
              </button>
              <button
                onClick={() => handleApplyAiProposal('replace')}
                className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold shadow-lg cursor-pointer"
              >
                Replace Entire Note
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer Info Strip */}
      <div className="pt-2 border-t border-white/10 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400">
        <span className="flex items-center gap-1.5 text-indigo-300 font-medium">
          <Sparkles className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
          Synchronized Classroom Document • Real-time Collaboration & Formatted PDF Exports
        </span>
        <span className="text-slate-500 font-mono text-[10px]">Markdown Tables • Formula Reference • Conflict Safe</span>
      </div>
    </div>
  );
};
