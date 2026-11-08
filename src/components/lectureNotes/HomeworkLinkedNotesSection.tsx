/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Veylentra Homework Linked Notes Section
 * Displays linked lecture notes inside homework assignment cards.
 * Enables quick jumping to study notes, attaching existing notes, or creating a dedicated note.
 * Does NOT expose private submissions or student work.
 */

import React, { useState, useEffect } from 'react';
import { BookOpen, Plus, ExternalLink, Unlink, Check, ChevronDown } from 'lucide-react';
import { Homework, VaultNote } from '../../types';
import { 
  getLinksForHomework, 
  linkNoteToHomework, 
  unlinkNoteFromHomework
} from '../../lib/lectureNotes/homeworkLinks';
import { NoteHomeworkLink } from '../../lib/lectureNotes/types';

interface HomeworkLinkedNotesSectionProps {
  homework: Homework;
  notes: VaultNote[];
  currentUserId?: string;
  onOpenNote: (noteId: string) => void;
  onCreateNoteForHomework: (homework: Homework) => void;
  onShowNotification?: (msg: string) => void;
}

export const HomeworkLinkedNotesSection: React.FC<HomeworkLinkedNotesSectionProps> = ({
  homework,
  notes,
  currentUserId,
  onOpenNote,
  onCreateNoteForHomework,
  onShowNotification
}) => {
  const [links, setLinks] = useState<NoteHomeworkLink[]>([]);
  const [isLinkingOpen, setIsLinkingOpen] = useState(false);
  const [selectedNoteToLink, setSelectedNoteToLink] = useState('');

  const loadLinks = async () => {
    try {
      const active = await getLinksForHomework(homework.id);
      setLinks(active);
    } catch (_) {}
  };

  useEffect(() => {
    loadLinks();
  }, [homework.id]);

  const handleLinkExisting = async () => {
    if (!selectedNoteToLink) return;
    const targetNote = notes.find(n => n.id === selectedNoteToLink);
    if (!targetNote) return;

    await linkNoteToHomework(
      { id: targetNote.id, title: targetNote.title, subject: targetNote.subject },
      { id: homework.id, title: homework.title, subject: homework.subject, dueDate: homework.dueDate },
      currentUserId || 'guest'
    );

    setSelectedNoteToLink('');
    setIsLinkingOpen(false);
    await loadLinks();
    onShowNotification?.(`✓ Attached note "${targetNote.title}" to this homework.`);
  };

  const handleUnlink = async (noteId: string, noteTitle: string) => {
    await unlinkNoteFromHomework(noteId, homework.id);
    await loadLinks();
    onShowNotification?.(`Removed link to "${noteTitle}".`);
  };

  // Find linked note objects
  const linkedNotes = links.map(link => {
    const note = notes.find(n => n.id === link.noteId);
    return {
      link,
      note,
      title: note?.title || link.noteTitle || 'Untitled Note',
      subject: note?.subject || link.noteSubject || homework.subject || 'General'
    };
  });

  return (
    <div className="mt-3 pt-3 border-t border-white/5 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-300">
          <BookOpen className="w-3.5 h-3.5 text-indigo-400" />
          <span>Linked Lecture Notes</span>
          {linkedNotes.length > 0 && (
            <span className="px-1.5 py-0.2 rounded-full bg-indigo-500/20 text-indigo-300 text-[10px] font-mono font-bold">
              {linkedNotes.length}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setIsLinkingOpen(prev => !prev)}
            className="text-[10px] text-indigo-400 hover:text-indigo-300 font-medium px-2 py-1 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 transition-colors flex items-center gap-1"
            title="Attach an existing lecture note"
          >
            <Plus className="w-3 h-3" />
            <span>Link Note</span>
          </button>
          <button
            onClick={() => onCreateNoteForHomework(homework)}
            className="text-[10px] text-emerald-400 hover:text-emerald-300 font-medium px-2 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 transition-colors flex items-center gap-1"
            title="Create a new note pre-filled with this homework's topic"
          >
            <span>+ New Note</span>
          </button>
        </div>
      </div>

      {/* Link Picker Accordion */}
      {isLinkingOpen && (
        <div className="p-2.5 rounded-xl bg-slate-900/80 border border-indigo-500/20 flex flex-col sm:flex-row items-center gap-2 animate-fadeIn">
          <select
            value={selectedNoteToLink}
            onChange={e => setSelectedNoteToLink(e.target.value)}
            className="w-full sm:flex-1 px-2.5 py-1.5 bg-slate-950 border border-white/10 rounded-lg text-xs text-white focus:outline-none focus:border-indigo-500"
          >
            <option value="">Select a note to link...</option>
            {notes
              .filter(n => !links.some(l => l.noteId === n.id))
              .map(n => (
                <option key={n.id} value={n.id}>
                  {n.title} ({n.subject || 'General'})
                </option>
              ))}
          </select>
          <div className="flex items-center gap-1.5 w-full sm:w-auto justify-end">
            <button
              disabled={!selectedNoteToLink}
              onClick={handleLinkExisting}
              className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-[11px] font-bold flex items-center gap-1 transition-colors"
            >
              <Check className="w-3 h-3" />
              <span>Attach</span>
            </button>
            <button
              onClick={() => setIsLinkingOpen(false)}
              className="px-2 py-1.5 rounded-lg text-slate-400 hover:text-white text-[11px]"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Chips of linked notes */}
      {linkedNotes.length > 0 ? (
        <div className="flex flex-wrap gap-1.5 pt-0.5">
          {linkedNotes.map(({ link, note, title, subject }) => (
            <div
              key={link.id}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-950/40 border border-indigo-500/25 text-xs text-indigo-200 group hover:border-indigo-400/50 transition-colors"
            >
              <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider">{subject}:</span>
              <button
                onClick={() => onOpenNote(link.noteId)}
                className="font-medium hover:underline flex items-center gap-1 max-w-[200px] truncate text-white"
                title={`Open note: ${title}`}
              >
                <span className="truncate">{title}</span>
                <ExternalLink className="w-2.5 h-2.5 opacity-60 group-hover:opacity-100 flex-shrink-0" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleUnlink(link.noteId, title);
                }}
                className="text-slate-400 hover:text-rose-400 p-0.5 rounded transition-colors ml-1"
                title="Unlink note"
              >
                <Unlink className="w-2.5 h-2.5" />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-[11px] text-slate-500 italic">
          No notes linked yet. Connect lecture notes to review theoretical concepts while doing this homework.
        </p>
      )}
    </div>
  );
};
