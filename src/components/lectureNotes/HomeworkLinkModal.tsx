import React, { useState, useEffect } from 'react';
import { 
  X, 
  Link2, 
  Unlink, 
  Search, 
  Calendar, 
  BookOpen, 
  Check, 
  Plus,
  ArrowRight
} from 'lucide-react';
import { Homework, VaultNote } from '../../types';
import { 
  getLinksForNote, 
  linkNoteToHomework, 
  unlinkNoteFromHomework 
} from '../../lib/lectureNotes/homeworkLinks';
import { NoteHomeworkLink } from '../../lib/lectureNotes/types';

interface HomeworkLinkModalProps {
  isOpen: boolean;
  activeNote: VaultNote;
  allHomework: Homework[];
  currentUserId?: string;
  onClose: () => void;
  onNotify?: (message: string) => void;
}

export const HomeworkLinkModal: React.FC<HomeworkLinkModalProps> = ({
  isOpen,
  activeNote,
  allHomework = [],
  currentUserId = 'guest',
  onClose,
  onNotify
}) => {
  const [links, setLinks] = useState<NoteHomeworkLink[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen && activeNote?.id) {
      loadLinks();
    }
  }, [isOpen, activeNote]);

  const loadLinks = async () => {
    setIsLoading(true);
    try {
      const data = await getLinksForNote(activeNote.id);
      setLinks(data);
    } catch (_) {}
    setIsLoading(false);
  };

  if (!isOpen || !activeNote) return null;

  const linkedHwIds = new Set(links.map(l => l.homeworkId));

  const filteredHomework = allHomework.filter(hw => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      hw.title.toLowerCase().includes(q) ||
      hw.subject.toLowerCase().includes(q) ||
      (hw.classGrade || '').toLowerCase().includes(q)
    );
  });

  const handleLink = async (hw: Homework) => {
    try {
      const newLink = await linkNoteToHomework(
        { id: activeNote.id, title: activeNote.title, subject: activeNote.subject },
        { id: hw.id, title: hw.title, subject: hw.subject, dueDate: hw.dueDate },
        currentUserId
      );
      setLinks(prev => [...prev, newLink]);
      onNotify?.(`✓ Linked to "${hw.title}"!`);
    } catch (err: any) {
      onNotify?.(`❌ Failed to link homework: ${err.message}`);
    }
  };

  const handleUnlink = async (hwId: string) => {
    try {
      await unlinkNoteFromHomework(activeNote.id, hwId);
      setLinks(prev => prev.filter(l => l.homeworkId !== hwId));
      onNotify?.('✓ Unlinked homework.');
    } catch (err: any) {
      onNotify?.(`❌ Failed to unlink: ${err.message}`);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className="w-full max-w-xl bg-slate-900 border border-slate-700/80 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/40">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center">
              <Link2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-100">Link Homework to Note</h3>
              <p className="text-[11px] text-slate-400">Connect "{activeNote.title}" with relevant assignments</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-5">
          {/* Currently Linked Homework */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
              Currently Linked ({links.length})
            </h4>
            {links.length === 0 ? (
              <p className="text-xs text-slate-500 italic p-3 rounded-xl bg-slate-950/40 border border-slate-800">
                No homework linked to this note yet. Search below to connect an assignment.
              </p>
            ) : (
              <div className="space-y-2">
                {links.map(link => {
                  const hw = allHomework.find(h => h.id === link.homeworkId);
                  return (
                    <div 
                      key={link.id}
                      className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between text-xs"
                    >
                      <div>
                        <span className="font-bold text-slate-200 block">
                          {link.homeworkTitle || hw?.title || 'Homework Assignment'}
                        </span>
                        <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5">
                          <span>{link.homeworkSubject || hw?.subject || 'Subject'}</span>
                          <span>•</span>
                          <span>Due: {link.dueDate || hw?.dueDate || 'Not set'}</span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleUnlink(link.homeworkId)}
                        className="px-2.5 py-1 rounded-lg text-rose-400 hover:bg-rose-500/10 text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                      >
                        <Unlink className="w-3.5 h-3.5" />
                        <span>Unlink</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Search & Link More Homework */}
          <div className="space-y-3 pt-2 border-t border-slate-800">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Available Assignments
            </h4>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search homework by title, subject, or class..."
                className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-slate-950 border border-slate-800 text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {filteredHomework.map(hw => {
                const isLinked = linkedHwIds.has(hw.id);
                return (
                  <div
                    key={hw.id}
                    className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 hover:border-slate-700 flex items-center justify-between text-xs transition-colors"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-200">{hw.title}</span>
                        <span className="text-[10px] text-indigo-400 bg-indigo-500/10 px-1.5 py-0.2 rounded font-semibold">
                          {hw.subject}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Due: {hw.dueDate} • {hw.classGrade} ({hw.classSection})
                      </p>
                    </div>
                    {isLinked ? (
                      <span className="text-[11px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-lg border border-emerald-500/20 flex items-center gap-1">
                        <Check className="w-3 h-3" /> Linked
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleLink(hw)}
                        className="px-3 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1 cursor-pointer transition-all active:scale-95"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Link</span>
                      </button>
                    )}
                  </div>
                );
              })}
              {filteredHomework.length === 0 && (
                <p className="text-center py-4 text-xs text-slate-500">
                  No matching homework assignments found.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-950/60 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 text-xs font-semibold text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
