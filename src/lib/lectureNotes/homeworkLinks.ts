/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Veylentra Note-to-Homework Bidirectional Linking Service
 * Secure, role-aware linking between Lecture Notes and Homework.
 */

import { supabase } from '../supabase';
import { NoteHomeworkLink } from './types';
import { Homework, VaultNote } from '../../types';

export type { NoteHomeworkLink };

const LOCAL_STORAGE_KEY = 'veylentra_note_homework_links_v1';

export function getLocalNoteHomeworkLinks(): NoteHomeworkLink[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (_) {}
  return [];
}

export function saveLocalNoteHomeworkLinks(links: NoteHomeworkLink[]): void {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(links));
  } catch (_) {}
}

/**
 * Fetch all homework links for a specific note.
 */
export async function getLinksForNote(noteId: string): Promise<NoteHomeworkLink[]> {
  const local = getLocalNoteHomeworkLinks().filter(l => l.noteId === noteId);
  try {
    const { data, error } = await supabase
      .from('lecture_note_homework_links')
      .select('*')
      .eq('note_id', noteId);

    if (error) {
      if (error.code !== '42P01') console.warn('[HomeworkLinks] Supabase query note error:', error.message);
      return local;
    }

    if (data && data.length > 0) {
      const remote = data.map((d: any) => ({
        id: d.id,
        noteId: d.note_id,
        homeworkId: d.homework_id,
        linkedBy: d.linked_by,
        createdAt: d.created_at
      }));
      // Merge remote with local
      const linkMap = new Map<string, NoteHomeworkLink>();
      for (const l of local) linkMap.set(`${l.noteId}_${l.homeworkId}`, l);
      for (const r of remote) linkMap.set(`${r.noteId}_${r.homeworkId}`, r);
      return Array.from(linkMap.values());
    }
  } catch (_) {}
  return local;
}

/**
 * Fetch all note links for a specific homework.
 */
export async function getLinksForHomework(homeworkId: string): Promise<NoteHomeworkLink[]> {
  const local = getLocalNoteHomeworkLinks().filter(l => l.homeworkId === homeworkId);
  try {
    const { data, error } = await supabase
      .from('lecture_note_homework_links')
      .select('*')
      .eq('homework_id', homeworkId);

    if (error) {
      if (error.code !== '42P01') console.warn('[HomeworkLinks] Supabase query homework error:', error.message);
      return local;
    }

    if (data && data.length > 0) {
      const remote = data.map((d: any) => ({
        id: d.id,
        noteId: d.note_id,
        homeworkId: d.homework_id,
        linkedBy: d.linked_by,
        createdAt: d.created_at
      }));
      const linkMap = new Map<string, NoteHomeworkLink>();
      for (const l of local) linkMap.set(`${l.noteId}_${l.homeworkId}`, l);
      for (const r of remote) linkMap.set(`${r.noteId}_${r.homeworkId}`, r);
      return Array.from(linkMap.values());
    }
  } catch (_) {}
  return local;
}

/**
 * Link a note to a homework item.
 */
export async function linkNoteToHomework(
  note: { id: string; title: string; subject?: string },
  homework: { id: string; title: string; subject?: string; dueDate?: string },
  userId: string
): Promise<NoteHomeworkLink> {
  const newLink: NoteHomeworkLink = {
    id: 'link_' + Math.random().toString(36).substring(2, 10) + '_' + Date.now(),
    noteId: note.id,
    homeworkId: homework.id,
    linkedBy: userId || 'guest',
    createdAt: new Date().toISOString(),
    noteTitle: note.title,
    noteSubject: note.subject,
    homeworkTitle: homework.title,
    homeworkSubject: homework.subject,
    dueDate: homework.dueDate
  };

  const current = getLocalNoteHomeworkLinks();
  const exists = current.some(l => l.noteId === note.id && l.homeworkId === homework.id);
  if (!exists) {
    current.push(newLink);
    saveLocalNoteHomeworkLinks(current);
  }

  try {
    await supabase.from('lecture_note_homework_links').upsert({
      id: newLink.id,
      note_id: note.id,
      homework_id: homework.id,
      linked_by: userId || 'guest',
      created_at: newLink.createdAt
    });
  } catch (_) {}

  return newLink;
}

/**
 * Unlink a note from a homework item.
 */
export async function unlinkNoteFromHomework(noteId: string, homeworkId: string): Promise<void> {
  const current = getLocalNoteHomeworkLinks().filter(
    l => !(l.noteId === noteId && l.homeworkId === homeworkId)
  );
  saveLocalNoteHomeworkLinks(current);

  try {
    await supabase
      .from('lecture_note_homework_links')
      .delete()
      .match({ note_id: noteId, homework_id: homeworkId });
  } catch (_) {}
}
