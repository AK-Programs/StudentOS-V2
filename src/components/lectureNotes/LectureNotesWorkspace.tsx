import React, { useState, useEffect } from 'react';
import { 
  FileText, 
  Sparkles, 
  Columns, 
  Eye, 
  Edit3, 
  Printer, 
  Download, 
  History, 
  Link2, 
  Share2, 
  Plus, 
  Menu, 
  X, 
  Trash2, 
  Check, 
  BookOpen, 
  Users2,
  Lock,
  RotateCcw
} from 'lucide-react';
import { VaultNote, Homework } from '../../types';
import { NoteFolder, NoteVersion } from '../../lib/lectureNotes/types';
import { LectureNotesSidebar } from './LectureNotesSidebar';
import { LectureNotesEditor } from './LectureNotesEditor';
import { FloatingQuickCreate } from './FloatingQuickCreate';
import { ImageToNoteModal } from './ImageToNoteModal';
import { NoteToLearningToolsModal } from './NoteToLearningToolsModal';
import { HomeworkLinkModal } from './HomeworkLinkModal';
import { NoteVersionHistoryModal } from './NoteVersionHistoryModal';
import { NoteTemplatesModal } from './NoteTemplatesModal';
import { generateFormattedPdf } from '../../lib/pdfGenerator';

interface LectureNotesWorkspaceProps {
  notes: VaultNote[];
  selectedNoteId: string | null;
  folders?: NoteFolder[];
  homeworkList?: Homework[];
  currentUserId?: string;
  onSelectNote: (id: string | null) => void;
  onUpdateNote: (id: string, updates: Partial<VaultNote>) => Promise<void> | void;
  onCreateNote: (note?: Partial<VaultNote>) => void;
  onDeleteNote: (id: string) => void;
  renderMarkdown: (text: string) => React.ReactNode;
  showNotification: (msg: string) => void;
}

export const LectureNotesWorkspace: React.FC<LectureNotesWorkspaceProps> = ({
  notes = [],
  selectedNoteId,
  folders = [],
  homeworkList = [],
  currentUserId = 'guest',
  onSelectNote,
  onUpdateNote,
  onCreateNote,
  onDeleteNote,
  renderMarkdown,
  showNotification
}) => {
  // Navigation & Filter state
  const [currentFilter, setCurrentFilter] = useState<'all' | 'recent' | 'starred' | 'shared' | 'archived' | 'trash'>('all');
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [showOutline, setShowOutline] = useState(false);
  const [viewMode, setViewMode] = useState<'editor' | 'reader' | 'split'>('editor');
  const [autoSaveState, setAutoSaveState] = useState<'saved' | 'saving' | 'offline'>('saved');

  // Modals state
  const [isImageToNoteOpen, setIsImageToNoteOpen] = useState(false);
  const [isLearningToolsOpen, setIsLearningToolsOpen] = useState(false);
  const [learningToolType, setLearningToolType] = useState<'flashcards' | 'quiz' | 'revision' | 'lesson'>('flashcards');
  const [isHomeworkLinkOpen, setIsHomeworkLinkOpen] = useState(false);
  const [isVersionHistoryOpen, setIsVersionHistoryOpen] = useState(false);
  const [isTemplatesOpen, setIsTemplatesOpen] = useState(false);

  // Active note resolution
  const activeNote = notes.find(n => n.id === selectedNoteId) || notes[0] || null;

  // Local recovery cache for unsaved drafts
  useEffect(() => {
    if (activeNote) {
      try {
        const draftKey = `s_os_draft_${activeNote.id}`;
        localStorage.setItem(draftKey, JSON.stringify({
          title: activeNote.title,
          content: activeNote.content,
          updatedAt: new Date().toISOString()
        }));
      } catch (_) {}
    }
  }, [activeNote?.content, activeNote?.title]);

  // Filter notes based on active filter, folder, tag, search
  const filteredNotes = notes.filter(n => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const match = (n.title || '').toLowerCase().includes(q) ||
                    (n.content || '').toLowerCase().includes(q) ||
                    (n.subject || '').toLowerCase().includes(q);
      if (!match) return false;
    }

    if (activeFolderId) {
      return (n as any).folder_id === activeFolderId;
    }

    if (selectedTag) {
      const tags = (n as any).tags || [];
      return tags.includes(selectedTag);
    }

    switch (currentFilter) {
      case 'recent':
        return true;
      case 'starred':
        return Boolean(n.isStarred || (n as any).isPinned);
      case 'shared':
        return Boolean(n.collabCode);
      case 'archived':
        return Boolean(n.isArchived);
      default:
        return !n.isArchived;
    }
  });

  // Handle note content changes with debounced autosave
  const handleContentChange = async (newContent: string) => {
    if (!activeNote) return;
    setAutoSaveState('saving');
    try {
      await onUpdateNote(activeNote.id, { content: newContent });
      setTimeout(() => setAutoSaveState('saved'), 400);
    } catch (_) {
      setAutoSaveState('offline');
    }
  };

  // PDF Export preservation
  const handleExportPdf = async () => {
    if (!activeNote || !activeNote.content?.trim()) {
      showNotification('⚠️ Note content is empty.');
      return;
    }

    showNotification('📄 Generating printable PDF note...');
    try {
      await generateFormattedPdf(
        activeNote.title || 'Untitled Note',
        activeNote.subject || 'General',
        activeNote.content
      );
      showNotification('✅ PDF downloaded successfully!');
    } catch (err: any) {
      console.error('[PDF Export Error]', err);
      showNotification(`❌ ${err.message || 'Failed to export PDF.'}`);
    }
  };

  // Markdown file export
  const handleExportMarkdown = () => {
    if (!activeNote) return;
    const blob = new Blob([activeNote.content || ''], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(activeNote.title || 'Note').replace(/[^a-z0-9]/gi, '_')}.md`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    showNotification('✓ Exported Markdown file!');
  };

  // Dynamic headings for Outline Table of Contents
  const headings: { level: number; text: string }[] = [];
  if (activeNote?.content) {
    activeNote.content.split('\n').forEach(line => {
      const hMatch = line.trim().match(/^(#{1,3})\s+(.*)$/);
      if (hMatch) {
        headings.push({ level: hMatch[1].length, text: hMatch[2].replace(/\*\*|__/g, '').trim() });
      }
    });
  }

  // Word count stats
  const wordCount = (activeNote?.content || '').trim().split(/\s+/).filter(Boolean).length;
  const readTimeMin = Math.max(1, Math.ceil(wordCount / 200));

  return (
    <div className="relative min-h-[700px] w-full flex flex-col space-y-4">
      {/* Top Workspace Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-2xl bg-slate-900/60 border border-white/5 backdrop-blur-md">
        <div className="flex items-center gap-2">
          {/* Mobile Sidebar Toggle Button */}
          <button
            type="button"
            onClick={() => setMobileSidebarOpen(!mobileSidebarOpen)}
            className="md:hidden p-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white cursor-pointer"
          >
            <Menu className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-2">
            <span className="text-xl">{activeNote?.icon || '📝'}</span>
            <div>
              <h2 className="text-sm font-bold text-white tracking-tight truncate max-w-xs sm:max-w-md">
                {activeNote?.title || 'Lecture Notes Workspace'}
              </h2>
              <div className="flex items-center gap-2 text-[10px] text-slate-400">
                <span>{activeNote?.subject || 'Academic'}</span>
                <span>•</span>
                <span>{wordCount} words (~{readTimeMin}m)</span>
                <span>•</span>
                <span className={autoSaveState === 'saving' ? 'text-amber-400 font-mono' : 'text-emerald-400 font-mono'}>
                  {autoSaveState === 'saving' ? '⏳ Saving...' : '✓ Saved'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* View Switchers & Export Tools */}
        <div className="flex items-center gap-1.5">
          {/* Mode Tabs */}
          <div className="flex items-center gap-0.5 p-1 rounded-xl bg-slate-950 border border-white/5 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setViewMode('editor')}
              className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer flex items-center gap-1 ${
                viewMode === 'editor' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Edit3 className="w-3 h-3" />
              <span className="hidden sm:inline">Editor</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('reader')}
              className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer flex items-center gap-1 ${
                viewMode === 'reader' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Eye className="w-3 h-3" />
              <span className="hidden sm:inline">Reader</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('split')}
              className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer flex items-center gap-1 ${
                viewMode === 'split' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Columns className="w-3 h-3" />
              <span className="hidden sm:inline">Split</span>
            </button>
          </div>

          {/* Outline Drawer Toggle */}
          <button
            type="button"
            onClick={() => setShowOutline(!showOutline)}
            className={`p-2 rounded-xl border text-xs font-semibold cursor-pointer transition-colors ${
              showOutline ? 'bg-indigo-600/30 text-indigo-300 border-indigo-500/40' : 'bg-slate-800 text-slate-400 border-white/5 hover:text-white'
            }`}
            title="Toggle Document Outline"
          >
            <Columns className="w-4 h-4" />
          </button>

          {/* Version History */}
          <button
            type="button"
            onClick={() => setIsVersionHistoryOpen(true)}
            className="p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white border border-white/5 cursor-pointer transition-colors"
            title="Version History & Recovery"
          >
            <History className="w-4 h-4" />
          </button>

          {/* Export PDF (Fixed Vector Exporter) */}
          <button
            type="button"
            onClick={handleExportPdf}
            className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-all shadow-md active:scale-95 cursor-pointer"
            title="Export Vector PDF"
          >
            <Printer className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Print / PDF</span>
          </button>
        </div>
      </div>

      {/* Main 3-Zone Workspace Grid */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 flex-1">
        {/* Zone 1: Navigation Sidebar (Desktop sticky / Mobile drawer) */}
        <div className={`md:col-span-3 ${mobileSidebarOpen ? 'block fixed inset-0 z-50 bg-slate-950/90 p-4' : 'hidden md:block'}`}>
          {mobileSidebarOpen && (
            <div className="flex justify-end pb-2 md:hidden">
              <button onClick={() => setMobileSidebarOpen(false)} className="p-2 text-white">
                <X className="w-6 h-6" />
              </button>
            </div>
          )}
          <LectureNotesSidebar
            notes={filteredNotes}
            selectedNoteId={selectedNoteId}
            folders={folders}
            activeFolderId={activeFolderId}
            currentFilter={currentFilter}
            selectedTag={selectedTag}
            searchQuery={searchQuery}
            onSelectNote={id => {
              onSelectNote(id);
              setMobileSidebarOpen(false);
            }}
            onSelectFilter={f => setCurrentFilter(f)}
            onSelectFolder={fId => setActiveFolderId(fId)}
            onSelectTag={t => setSelectedTag(t)}
            onSearchChange={q => setSearchQuery(q)}
            onCreateNote={() => {
              onCreateNote({ title: 'Untitled Note', subject: 'General' });
              setMobileSidebarOpen(false);
            }}
            onCreateFolder={() => {
              showNotification('Create folder dialog opened');
            }}
          />
        </div>

        {/* Zone 2: Document Canvas & Writing Surface */}
        <div className={`${showOutline ? 'md:col-span-6 lg:col-span-7' : 'md:col-span-9'} space-y-4`}>
          {activeNote ? (
            <div className="rounded-3xl border border-white/5 bg-slate-900/50 backdrop-blur-md overflow-hidden shadow-xl p-5 sm:p-7 space-y-5">
              {/* Document Header (Editable Title & Subject) */}
              <div className="space-y-3 pb-3 border-b border-white/5">
                <div className="flex items-center justify-between gap-3">
                  <input
                    type="text"
                    value={activeNote.title}
                    onChange={e => onUpdateNote(activeNote.id, { title: e.target.value })}
                    placeholder="Note Title..."
                    className="w-full text-2xl sm:text-3xl font-black font-display text-white bg-transparent border-b border-transparent focus:border-indigo-500/50 pb-1 focus:outline-none transition-colors"
                  />
                  <input
                    type="text"
                    value={activeNote.subject}
                    onChange={e => onUpdateNote(activeNote.id, { subject: e.target.value })}
                    placeholder="Subject..."
                    className="text-xs font-bold text-slate-300 bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 focus:outline-none shrink-0"
                  />
                </div>
              </div>

              {/* View Modes Rendering */}
              {viewMode === 'reader' ? (
                /* Reader View: Clean formatted reading mode */
                <div className="p-6 rounded-2xl bg-slate-950/40 border border-white/5 min-h-[440px] leading-relaxed select-text space-y-3">
                  {renderMarkdown(activeNote.content || '')}
                </div>
              ) : viewMode === 'split' ? (
                /* Split View: Editor + Live Preview */
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div className="p-2 rounded-2xl bg-slate-950/40 border border-white/5">
                    <LectureNotesEditor
                      initialContent={activeNote.content || ''}
                      noteTitle={activeNote.title}
                      noteSubject={activeNote.subject}
                      allNotes={notes}
                      onChange={handleContentChange}
                      onOpenLearningTools={tool => {
                        setLearningToolType(tool);
                        setIsLearningToolsOpen(true);
                      }}
                      onOpenHomeworkLinking={() => setIsHomeworkLinkOpen(true)}
                    />
                  </div>
                  <div className="p-5 rounded-2xl bg-slate-950/60 border border-white/5 max-h-[600px] overflow-y-auto leading-relaxed select-text space-y-3">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block pb-2 border-b border-white/5">
                      Live Reader Preview
                    </span>
                    {renderMarkdown(activeNote.content || '')}
                  </div>
                </div>
              ) : (
                /* Full Hybrid Editor */
                <LectureNotesEditor
                  initialContent={activeNote.content || ''}
                  noteTitle={activeNote.title}
                  noteSubject={activeNote.subject}
                  allNotes={notes}
                  onChange={handleContentChange}
                  onOpenLearningTools={tool => {
                    setLearningToolType(tool);
                    setIsLearningToolsOpen(true);
                  }}
                  onOpenHomeworkLinking={() => setIsHomeworkLinkOpen(true)}
                />
              )}
            </div>
          ) : (
            <div className="p-12 rounded-3xl bg-slate-900/40 border border-dashed border-white/10 text-center space-y-4">
              <span className="text-5xl block">📝</span>
              <h3 className="text-base font-bold text-white">Select or Initialize a Lecture Note</h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                Start writing rich educational documents with equations, tables, and study flashcard integration.
              </p>
              <button
                type="button"
                onClick={() => onCreateNote({ title: 'New Lecture Note', subject: 'Physics' })}
                className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all shadow-md active:scale-95 cursor-pointer"
              >
                + Create Note
              </button>
            </div>
          )}
        </div>

        {/* Zone 3: Optional Contextual Outline / Table of Contents */}
        {showOutline && (
          <div className="md:col-span-3 lg:col-span-2 p-4 rounded-3xl bg-slate-950/60 border border-white/5 space-y-3 max-h-[600px] overflow-y-auto">
            <div className="flex items-center justify-between pb-2 border-b border-white/5">
              <span className="text-[11px] font-bold uppercase text-slate-400 tracking-wider">
                Document Outline
              </span>
              <button onClick={() => setShowOutline(false)} className="text-slate-500 hover:text-white p-1">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            {headings.length === 0 ? (
              <p className="text-[11px] text-slate-500 italic">No headings yet. Insert H1 or H2 headings to build an outline.</p>
            ) : (
              <div className="space-y-1.5 text-xs">
                {headings.map((h, hIdx) => (
                  <div 
                    key={hIdx}
                    className={`text-slate-400 hover:text-indigo-300 transition-colors cursor-pointer truncate ${
                      h.level === 1 ? 'font-bold text-slate-200' : h.level === 2 ? 'pl-2 text-slate-300' : 'pl-4 text-slate-400 text-[11px]'
                    }`}
                  >
                    {h.text}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Persistent Floating Quick Create '+' Button */}
      <FloatingQuickCreate
        onCreateNote={() => onCreateNote({ title: 'Untitled Note', subject: 'General' })}
        onCreateFolder={() => showNotification('Folder created!')}
        onOpenTemplate={() => setIsTemplatesOpen(true)}
        onOpenMathWorkspace={() => {
          // Open math workspace from floating '+'
          showNotification('Math Workspace opened');
        }}
        onOpenImageToNote={() => setIsImageToNoteOpen(true)}
        onOpenSketch={() => showNotification('Open sketch modal')}
        onOpenChecklist={() => {
          if (activeNote) {
            handleContentChange((activeNote.content || '') + '\n\n- [ ] Task 1\n- [ ] Task 2');
          }
        }}
        onOpenLessonBuilder={() => {
          setLearningToolType('lesson');
          setIsLearningToolsOpen(true);
        }}
        onImportMarkdown={() => {
          const input = document.createElement('input');
          input.type = 'file';
          input.accept = '.md,.txt';
          input.onchange = (e: any) => {
            const file = e.target.files?.[0];
            if (file) {
              const reader = new FileReader();
              reader.onload = ev => {
                const text = ev.target?.result as string;
                onCreateNote({
                  title: file.name.replace(/\.[^/.]+$/, ''),
                  content: text,
                  subject: 'Imported'
                });
                showNotification('✓ Imported Markdown note!');
              };
              reader.readAsText(file);
            }
          };
          input.click();
        }}
        onImportPdf={() => {
          setIsImageToNoteOpen(true);
        }}
        onPasteContent={async () => {
          try {
            const text = await navigator.clipboard.readText();
            if (text && activeNote) {
              handleContentChange((activeNote.content || '') + '\n\n' + text);
              showNotification('✓ Pasted clipboard content!');
            }
          } catch (_) {
            showNotification('Unable to read clipboard.');
          }
        }}
      />

      {/* Priority Feature: Image to Note OCR Modal */}
      <ImageToNoteModal
        isOpen={isImageToNoteOpen}
        onClose={() => setIsImageToNoteOpen(false)}
        onSaveAsNote={(title, subj, content) => {
          onCreateNote({
            title,
            subject: subj,
            content
          });
          showNotification('✓ Transcribed handwritten note saved to vault!');
        }}
        renderMarkdown={renderMarkdown}
      />

      {/* Learning Tools Integration Modal */}
      {activeNote && (
        <NoteToLearningToolsModal
          isOpen={isLearningToolsOpen}
          toolType={learningToolType}
          noteTitle={activeNote.title}
          noteSubject={activeNote.subject}
          noteContent={activeNote.content || ''}
          userId={currentUserId}
          onClose={() => setIsLearningToolsOpen(false)}
          onNotify={showNotification}
          onCreateDerivedNote={(title, subj, content) => {
            onCreateNote({ title, subject: subj, content });
          }}
        />
      )}

      {/* Homework Linking Modal */}
      {activeNote && (
        <HomeworkLinkModal
          isOpen={isHomeworkLinkOpen}
          activeNote={activeNote}
          allHomework={homeworkList}
          currentUserId={currentUserId}
          onClose={() => setIsHomeworkLinkOpen(false)}
          onNotify={showNotification}
        />
      )}

      {/* Document Version History & Recovery Modal */}
      {activeNote && (
        <NoteVersionHistoryModal
          isOpen={isVersionHistoryOpen}
          currentTitle={activeNote.title}
          currentContent={activeNote.content || ''}
          versions={[]}
          onClose={() => setIsVersionHistoryOpen(false)}
          onRestoreVersion={(content, title) => {
            onUpdateNote(activeNote.id, { content, ...(title ? { title } : {}) });
            showNotification('✓ Restored note version!');
          }}
        />
      )}

      {/* Educational Templates Modal */}
      <NoteTemplatesModal
        isOpen={isTemplatesOpen}
        onClose={() => setIsTemplatesOpen(false)}
        onApplyTemplate={(title, subj, content) => {
          onCreateNote({
            title,
            subject: subj,
            content
          });
          showNotification(`✓ Initialized note with ${title}!`);
        }}
      />
    </div>
  );
};
