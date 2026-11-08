import React, { useState } from 'react';
import { 
  FileText, 
  Folder, 
  FolderPlus, 
  Star, 
  Clock, 
  Archive, 
  Trash2, 
  Users2, 
  Search, 
  Tag, 
  Plus, 
  LayoutTemplate, 
  ChevronRight, 
  ChevronDown,
  Pin,
  MoreVertical,
  BookOpen
} from 'lucide-react';
import { VaultNote } from '../../types';
import { NoteFolder } from '../../lib/lectureNotes/types';

interface LectureNotesSidebarProps {
  notes: VaultNote[];
  selectedNoteId: string | null;
  folders: NoteFolder[];
  activeFolderId: string | null;
  currentFilter: 'all' | 'recent' | 'starred' | 'shared' | 'archived' | 'trash';
  selectedTag: string | null;
  searchQuery: string;
  onSelectNote: (noteId: string) => void;
  onSelectFilter: (filter: 'all' | 'recent' | 'starred' | 'shared' | 'archived' | 'trash') => void;
  onSelectFolder: (folderId: string | null) => void;
  onSelectTag: (tag: string | null) => void;
  onSearchChange: (query: string) => void;
  onCreateNote: () => void;
  onCreateFolder: () => void;
  onToggleStar?: (noteId: string) => void;
  onDeleteNote?: (noteId: string) => void;
}

export const LectureNotesSidebar: React.FC<LectureNotesSidebarProps> = ({
  notes = [],
  selectedNoteId,
  folders = [],
  activeFolderId,
  currentFilter,
  selectedTag,
  searchQuery,
  onSelectNote,
  onSelectFilter,
  onSelectFolder,
  onSelectTag,
  onSearchChange,
  onCreateNote,
  onCreateFolder,
  onToggleStar,
  onDeleteNote
}) => {
  const [foldersExpanded, setFoldersExpanded] = useState(true);
  const [tagsExpanded, setTagsExpanded] = useState(false);

  // Extract all unique tags across notes
  const allTags = Array.from(
    new Set(
      notes.flatMap(n => {
        const t = (n as any).tags;
        return Array.isArray(t) ? t : [];
      })
    )
  );

  return (
    <div className="flex flex-col h-full bg-slate-950/60 rounded-3xl border border-white/5 overflow-hidden p-3.5 space-y-4">
      {/* Search Input */}
      <div className="relative">
        <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-500" />
        <input
          type="text"
          value={searchQuery}
          onChange={e => onSearchChange(e.target.value)}
          placeholder="Search notes, tags, formulas..."
          className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl bg-slate-900 border border-slate-800 text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
      </div>

      {/* Main Navigation Views */}
      <div className="space-y-0.5 text-xs font-semibold">
        {[
          { id: 'all', label: 'All Notes', icon: <FileText className="w-3.5 h-3.5" />, count: notes.filter(n => !n.isArchived).length },
          { id: 'recent', label: 'Recent Documents', icon: <Clock className="w-3.5 h-3.5" />, count: notes.slice(0, 5).length },
          { id: 'starred', label: 'Favorites / Starred', icon: <Star className="w-3.5 h-3.5 text-amber-400" />, count: notes.filter(n => n.isStarred || n.isPinned).length },
          { id: 'shared', label: 'Shared / Collab', icon: <Users2 className="w-3.5 h-3.5 text-cyan-400" />, count: notes.filter(n => n.collabCode).length },
          { id: 'archived', label: 'Archived Notes', icon: <Archive className="w-3.5 h-3.5 text-slate-400" />, count: notes.filter(n => n.isArchived).length }
        ].map(item => (
          <button
            key={item.id}
            type="button"
            onClick={() => {
              onSelectFilter(item.id as any);
              onSelectFolder(null);
              onSelectTag(null);
            }}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-xl transition-colors cursor-pointer ${
              currentFilter === item.id && !activeFolderId && !selectedTag
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
            }`}
          >
            <div className="flex items-center gap-2.5">
              {item.icon}
              <span>{item.label}</span>
            </div>
            <span className="text-[10px] font-mono opacity-60">{item.count}</span>
          </button>
        ))}
      </div>

      {/* Folders Section */}
      <div className="space-y-1 pt-2 border-t border-white/5">
        <div className="flex items-center justify-between px-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">
          <button
            type="button"
            onClick={() => setFoldersExpanded(!foldersExpanded)}
            className="flex items-center gap-1 hover:text-slate-300 cursor-pointer"
          >
            {foldersExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
            <span>Folders ({folders.length})</span>
          </button>
          <button
            type="button"
            onClick={onCreateFolder}
            className="p-1 rounded hover:bg-white/5 text-indigo-400 hover:text-indigo-300 cursor-pointer"
            title="Create Folder"
          >
            <FolderPlus className="w-3.5 h-3.5" />
          </button>
        </div>

        {foldersExpanded && (
          <div className="space-y-0.5 max-h-36 overflow-y-auto">
            {folders.map(folder => (
              <button
                key={folder.id}
                type="button"
                onClick={() => onSelectFolder(folder.id)}
                className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                  activeFolderId === folder.id 
                    ? 'bg-indigo-600 text-white shadow-sm' 
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
                }`}
              >
                <Folder className="w-3.5 h-3.5 text-amber-400" />
                <span className="truncate flex-1 text-left">{folder.name}</span>
              </button>
            ))}
            {folders.length === 0 && (
              <p className="px-3 py-1.5 text-[11px] text-slate-600 italic">No custom folders</p>
            )}
          </div>
        )}
      </div>

      {/* Tags Section */}
      {allTags.length > 0 && (
        <div className="space-y-1 pt-2 border-t border-white/5">
          <button
            type="button"
            onClick={() => setTagsExpanded(!tagsExpanded)}
            className="w-full flex items-center justify-between px-2 text-[10px] font-bold uppercase tracking-wider text-slate-500 hover:text-slate-300 cursor-pointer"
          >
            <div className="flex items-center gap-1">
              {tagsExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
              <span>Tags ({allTags.length})</span>
            </div>
            {selectedTag && (
              <span 
                onClick={(e) => { e.stopPropagation(); onSelectTag(null); }}
                className="text-[9px] text-rose-400 hover:underline"
              >
                Clear
              </span>
            )}
          </button>

          {tagsExpanded && (
            <div className="flex flex-wrap gap-1 p-1 max-h-28 overflow-y-auto">
              {allTags.map(tag => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => onSelectTag(selectedTag === tag ? null : tag)}
                  className={`text-[11px] px-2 py-0.5 rounded-lg transition-colors cursor-pointer ${
                    selectedTag === tag 
                      ? 'bg-indigo-600 text-white' 
                      : 'bg-slate-900 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  #{tag}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Bottom Action: New Note Button */}
      <div className="pt-2 border-t border-white/5 mt-auto">
        <button
          type="button"
          onClick={onCreateNote}
          className="w-full py-2 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-md active:scale-95 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>New Lecture Note</span>
        </button>
      </div>
    </div>
  );
};
