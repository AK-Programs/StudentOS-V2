import { supabase } from './supabase';
import { VaultNote } from '../types';

function getLocalNotesKey(userId: string): string {
  return `s_os_vault_notes_${userId || 'guest'}`;
}

function getDefaultNotesForUser(userId: string): VaultNote[] {
  const dateStr = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  if (userId === 'demo-teacher-uid' || userId.includes('teacher')) {
    return [
      {
        id: `note-${userId}-1`,
        title: 'AP Physics Lecture Plan — Rotational Dynamics',
        subject: 'Physics',
        content: '# Rotational Dynamics Lecture Plan\n\n## Learning Objectives\n- Derive moment of inertia for rigid bodies ($I = \\sum m_i r_i^2$)\n- Demonstrate conservation of angular momentum ($L = I\\omega$)\n- Solve inclined plane rolling without slipping problems',
        createdAt: dateStr,
        icon: '🔬',
        coverBg: 'bg-gradient-to-r from-emerald-600 to-teal-900',
        userId
      }
    ];
  }
  if (userId === 'demo-admin-uid' || userId === 'demo-super-admin-uid' || userId.includes('admin')) {
    return [
      {
        id: `note-${userId}-1`,
        title: 'Academic Term Operations & Faculty Audit Notes',
        subject: 'Syllabus General',
        content: '# Institutional Operations Checklist\n\n- Review Grade 10 & Grade 12 mid-term assessment schedules\n- Verify House Championship standings (Ruby, Emerald, Sapphire, Topaz)\n- Audit AI Buddy quota usage and faculty resource uploads',
        createdAt: dateStr,
        icon: '🏛️',
        coverBg: 'bg-gradient-to-r from-rose-600 to-amber-900',
        userId
      }
    ];
  }
  return [
    {
      id: `note-${userId}-1`,
      title: 'Lecture Notes — Centripetal Mechanics & Orbits',
      subject: 'Physics',
      content: '# Centripetal Mechanics\n\nCentripetal force is directed toward the center of curvature:\n$$F_c = \\frac{m v^2}{r}$$\n\n- No work is performed in circular orbits because the force vector is perpendicular to instantaneous displacement.',
      createdAt: dateStr,
      icon: '📝',
      coverBg: 'bg-gradient-to-r from-violet-600 to-indigo-900',
      userId
    },
    {
      id: `note-${userId}-2`,
      title: 'Organic Chemistry Acid-Base Synthesis Notes',
      subject: 'Chemistry',
      content: '# Lewis Acids & Bases\n\n- **Lewis Acid**: Electron pair acceptor\n- **Lewis Base**: Electron pair donor\n- Lower $pK_a$ indicates a stronger acid and more stable conjugate base.',
      createdAt: dateStr,
      icon: '🧪',
      coverBg: 'bg-gradient-to-r from-cyan-600 to-blue-900',
      userId
    }
  ];
}

function getLocalVaultNotes(userId: string): VaultNote[] {
  try {
    const raw = localStorage.getItem(getLocalNotesKey(userId));
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.filter((n: any) => !n.userId || n.userId === userId);
      }
    }
  } catch (e) {}
  const seeded = getDefaultNotesForUser(userId);
  try {
    localStorage.setItem(getLocalNotesKey(userId), JSON.stringify(seeded));
  } catch (_) {}
  return seeded;
}

function saveLocalVaultNotes(userId: string, notes: VaultNote[]): void {
  try {
    localStorage.setItem(getLocalNotesKey(userId), JSON.stringify(notes));
  } catch (e) {}
}

export async function getVaultNotes(userId: string): Promise<VaultNote[]> {
  const localNotes = getLocalVaultNotes(userId);
  try {
    const { data, error } = await supabase.from('notes').select('*').eq('user_id', userId);
    if (error) {
      if (error.code === '42P01') {
        return localNotes;
      }
      throw error;
    }
    if (data && data.length > 0) {
      const remoteNotes: VaultNote[] = data
        .filter(n => n.title !== '__SYSTEM_NOTIFICATION__' && !n.id.startsWith('notif_') && !n.id.startsWith('chat_'))
        .map(n => ({
          id: n.id,
          title: n.title,
          content: n.content,
          createdAt: n.created_at || new Date().toLocaleDateString(),
          subject: n.subject || '',
          icon: n.icon || '📝',
          coverBg: n.cover_bg || 'bg-gradient-to-r from-violet-600 to-indigo-900',
          userId: n.user_id,
          folder_id: n.folder_id || null,
          isPinned: Boolean(n.is_pinned),
          collabCode: n.collab_code || undefined,
          isCollab: Boolean(n.is_collab || n.collab_code)
        }));
      const mergedMap = new Map<string, VaultNote>();
      for (const ln of localNotes) mergedMap.set(ln.id, ln);
      for (const rn of remoteNotes) mergedMap.set(rn.id, rn);
      const merged = Array.from(mergedMap.values());
      saveLocalVaultNotes(userId, merged);
      return merged;
    }
  } catch (err) {
    console.error("Failed to get notes from supabase", err);
  }
  return localNotes;
}

export async function saveVaultNoteToSupabase(note: VaultNote): Promise<void> {
  const uid = note.userId || 'guest';
  const current = getLocalVaultNotes(uid);
  const idx = current.findIndex(n => n.id === note.id);
  if (idx >= 0) {
    current[idx] = note;
  } else {
    current.push(note);
  }
  saveLocalVaultNotes(uid, current);

  // If note has a collabCode, mirror it in local collab cache for cross-tab instant joining
  if (note.collabCode) {
    try {
      localStorage.setItem(`s_os_collab_note_${note.collabCode}`, JSON.stringify(note));
    } catch (_) {}
  }

  try {
    const payload: any = {
      id: note.id,
      title: note.title,
      content: note.content,
      subject: note.subject,
      icon: note.icon,
      cover_bg: note.coverBg,
      user_id: note.userId,
      created_at: note.createdAt,
      folder_id: (note as any).folder_id || null,
      is_pinned: (note as any).isPinned || false
    };

    if (note.collabCode) {
      payload.collab_code = note.collabCode;
      payload.is_collab = true;
    }

    const { error } = await supabase.from('notes').upsert(payload);
    if (error && error.code !== '42P01') throw error;
  } catch (err) {
    console.error("Failed to save note to supabase", err);
  }
}

export async function deleteVaultNoteFromSupabase(noteId: string, userId: string): Promise<void> {
  const uid = userId || 'guest';
  const filtered = getLocalVaultNotes(uid).filter(n => n.id !== noteId);
  saveLocalVaultNotes(uid, filtered);

  try {
    const { error } = await supabase.from('notes').delete().eq('id', noteId);
    if (error && error.code !== '42P01') throw error;
  } catch (err) {}
}

/**
 * Searches for a note by a 6-digit collab code.
 * Checks local cache first for instant sync, then queries Supabase.
 */
export async function getNoteByCollabCode(code: string): Promise<VaultNote | null> {
  const cleanCode = code.trim();
  if (!cleanCode) return null;

  // 1. Try local cache
  try {
    const cached = localStorage.getItem(`s_os_collab_note_${cleanCode}`);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (parsed && parsed.title) {
        return parsed as VaultNote;
      }
    }
  } catch (_) {}

  // 2. Query Supabase
  try {
    const { data, error } = await supabase
      .from('notes')
      .select('*')
      .eq('collab_code', cleanCode)
      .maybeSingle();

    if (!error && data) {
      return {
        id: data.id,
        title: data.title,
        content: data.content,
        createdAt: data.created_at || new Date().toLocaleDateString(),
        subject: data.subject || '',
        icon: data.icon || '📝',
        coverBg: data.cover_bg || 'bg-gradient-to-r from-violet-600 to-indigo-900',
        userId: data.user_id,
        folder_id: null,
        isPinned: false,
        collabCode: cleanCode,
        isCollab: true
      };
    }
  } catch (err) {
    console.warn('[Collab] Remote lookup error:', err);
  }

  return null;
}






