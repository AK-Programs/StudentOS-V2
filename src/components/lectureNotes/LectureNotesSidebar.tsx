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
  ChevronRight, 
  ChevronDown,
  X,
  Sparkles
} from 'lucide-react';
import { VaultNote } from '../../types';
import { NoteFolder } from '../../lib/lectureNotes/types';

interface LectureNotesSidebarProps {
  allNotes?: VaultNote[];
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
  allNotes = [],
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

  const sourceNotes = allNotes.length > 0 ? allNotes : notes;

  // Extract all unique tags across source notes
  const allTags = Array.from(
    new Set(
      sourceNotes.flatMap(n => {
        const t = (n as any).tags;
        return Array.isArray(t) ? t : [];
      })
    )
  );

  return (
    <div className="flex flex-col h-full min-h-[580px] bg-slate-950/80 rounded-3xl border border-white/5 overflow-hidden p-3.5 space-y-3.5">
      {/* Search Input with Clear Button */}
      <div className="relative">
        <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-500" />
        <input
          type="text"
          value={searchQuery}
          onChange={e => onSearchChange(e.target.value)}
          placeholder="Search title, content, formulas..."
          className="w-full pl-8 pr-7 py-1.5 text-xs rounded-xl bg-slate-900 border border-slate-800 text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => onSearchChange('')}
            className="absolute right-2.5 top-2.5 text-slate-500 hover:text-white"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Main Navigation Views */}
      <div className="space-y-0.5 text-xs font-semibold">
        {[
          { id: 'all', label: 'All Notes', icon: <FileText className="w-3.5 h-3.5" />, count: sourceNotes.filter(n => !n.isArchived && !(n as any).isDeleted).length },
          { id: 'recent', label: 'Recent Documents', icon: <Clock className="w-3.5 h-3.5 text-sky-400" />, count: sourceNotes.filter(n => !n.isArchived).slice(0, 5).length },
          { id: 'starred', label: 'Favorites / Starred', icon: <Star className="w-3.5 h-3.5 text-amber-400" />, count: sourceNotes.filter(n => n.isStarred || (n as any).isPinned).length },
          { id: 'shared', label: 'Shared / Collab', icon: <Users2 className="w-3.5 h-3.5 text-cyan-400" />, count: sourceNotes.filter(n => n.collabCode).length },
          { id: 'archived', label: 'Archived Notes', icon: <Archive className="w-3.5 h-3.5 text-slate-400" />, count: sourceNotes.filter(n => n.isArchived).length }
        ].map(item => (
          <button
            key={item.id}
            type="button"
            onClick={() => {
              onSelectFilter(item.id as any);
              onSelectFolder(null);
              onSelectTag(null);
            }}
            className={`w-full flex items-center justify-between px-3 py-1.5 rounded-xl transition-colors cursor-pointer ${
              currentFilter === item.id && !activeFolderId && !selectedTag
                ? 'bg-indigo-600 text-white shadow-sm font-bold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
            }`}
          >
            <div className="flex items-center gap-2">
              {item.icon}
              <span>{item.label}</span>
            </div>
            <span className="text-[10px] font-mono opacity-70 bg-black/30 px-1.5 py-0.2 rounded-full">{item.count}</span>
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
          <div className="space-y-0.5 max-h-32 overflow-y-auto pr-1">
            {folders.map(folder => (
              <button
                key={folder.id}
                type="button"
                onClick={() => onSelectFolder(folder.id)}
                className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                  activeFolderId === folder.id 
                    ? 'bg-indigo-600 text-white shadow-sm font-bold' 
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
                }`}
              >
                <Folder className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span className="truncate flex-1 text-left">{folder.name}</span>
                <span className="text-[10px] font-mono opacity-60">
                  {sourceNotes.filter(n => (n as any).folder_id === folder.id || (n as any).folderId === folder.id).length}
                </span>
              </button>
            ))}
            {folders.length === 0 && (
              <p className="px-3 py-1 text-[11px] text-slate-600 italic">No custom folders</p>
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
            <div className="flex flex-wrap gap-1 p-1 max-h-24 overflow-y-auto">
              {allTags.map(tag => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => onSelectTag(selectedTag === tag ? null : tag)}
                  className={`text-[11px] px-2 py-0.5 rounded-lg transition-colors cursor-pointer ${
                    selectedTag === tag 
                      ? 'bg-indigo-600 text-white font-bold' 
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

      {/* Actual Note List Results Section */}
      <div className="pt-2 border-t border-white/5 flex-1 flex flex-col min-h-0 space-y-1.5">
        <div className="flex items-center justify-between px-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
          <span>
            {activeFolderId 
              ? `Folder Notes (${notes.length})` 
              : selectedTag 
              ? `#${selectedTag} (${notes.length})`
              : searchQuery 
              ? `Results (${notes.length})` 
              : `Notes (${notes.length})`}
          </span>
          {notes.length > 0 && (
            <span className="text-[9px] font-mono text-slate-500">Sorted by date</span>
          )}
        </div>

        <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 min-h-[180px]">
          {notes.length === 0 ? (
            <div className="p-4 rounded-2xl bg-slate-900/40 border border-dashed border-white/5 text-center space-y-2 my-2">
              <span className="text-2xl block">📂</span>
              <p className="text-xs font-semibold text-slate-300">No notes found</p>
              <p className="text-[11px] text-slate-500">
                {searchQuery 
                  ? `No matches for "${searchQuery}"`
                  : activeFolderId
                  ? 'This folder is empty'
                  : selectedTag
                  ? `No notes tagged #${selectedTag}`
                  : 'No notes in this view'}
              </p>
              {(searchQuery || activeFolderId || selectedTag) && (
                <button
                  type="button"
                  onClick={() => {
                    onSearchChange('');
                    onSelectFolder(null);
                    onSelectTag(null);
                    onSelectFilter('all');
                  }}
                  className="text-[11px] text-indigo-400 hover:text-indigo-300 font-bold underline cursor-pointer"
                >
                  Reset filters
                </button>
              )}
            </div>
          ) : (
            notes.map(note => {
              const isSelected = selectedNoteId === note.id;
              const isStarred = Boolean(note.isStarred || (note as any).isPinned);

              return (
                <div
                  key={note.id}
                  onClick={() => onSelectNote(note.id)}
                  className={`group relative p-2.5 rounded-2xl border transition-all cursor-pointer space-y-1.5 ${
                    isSelected 
                      ? 'bg-indigo-600/25 border-indigo-500/50 text-white shadow-md' 
                      : 'bg-slate-900/50 hover:bg-slate-900 border-white/5 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0 flex-1">
                      <span className="text-sm shrink-0">{note.icon || '📝'}</span>
                      <h4 className={`text-xs font-bold truncate ${isSelected ? 'text-white' : 'text-slate-200'}`}>
                        {note.title || 'Untitled Note'}
                      </h4>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {onToggleStar && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onToggleStar(note.id);
                          }}
                          className={`p-1 rounded transition-colors ${
                            isStarred ? 'text-amber-400' : 'text-slate-600 group-hover:text-slate-400 hover:text-amber-400'
                          }`}
                          title={isStarred ? 'Unstar Note' : 'Star Note'}
                        >
                          <Star className={`w-3.5 h-3.5 ${isStarred ? 'fill-amber-400' : ''}`} />
                        </button>
                      )}
                      {onDeleteNote && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteNote(note.id);
                          }}
                          className="opacity-0 group-hover:opacity-100 p-1 text-slate-500 hover:text-rose-400 transition-opacity"
                          title="Delete Note"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-slate-400 gap-2">
                    <span className="px-1.5 py-0.2 rounded bg-slate-950 border border-white/5 font-semibold text-indigo-300 truncate max-w-[110px]">
                      {note.subject || 'General'}
                    </span>
                    <span className="font-mono text-slate-500 shrink-0">{note.createdAt}</span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

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
