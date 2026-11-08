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
  RotateCcw,
  FolderPlus,
  PanelLeft,
  ChevronLeft,
  ChevronRight,
  BrainCircuit,
  MessageSquarePlus
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
import { VisualMathEditorModal } from './VisualMathEditorModal';
import { SketchCanvasModal } from './SketchCanvasModal';
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
  onCreateFolder?: (folder: Partial<NoteFolder>) => void;
  onDeleteNote: (id: string) => void;
  renderMarkdown: (text: string) => React.ReactNode;
  showNotification: (msg: string) => void;
}

export const LectureNotesWorkspace: React.FC<LectureNotesWorkspaceProps> = ({
  notes = [],
  selectedNoteId,
  folders: initialFolders = [],
  homeworkList = [],
  currentUserId = 'guest',
  onSelectNote,
  onUpdateNote,
  onCreateNote,
  onCreateFolder: onCreateFolderProp,
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
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isAIGenerating, setIsAIGenerating] = useState(false);
  const [isAICreateModalOpen, setIsAICreateModalOpen] = useState(false);
  const [aiCreateQuery, setAiCreateQuery] = useState('');

  // Custom local folders state
  const [localFolders, setLocalFolders] = useState<NoteFolder[]>(initialFolders);
  const [isCreateFolderOpen, setIsCreateFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');

  // Modals state
  const [isImageToNoteOpen, setIsImageToNoteOpen] = useState(false);
  const [isLearningToolsOpen, setIsLearningToolsOpen] = useState(false);
  const [learningToolType, setLearningToolType] = useState<'flashcards' | 'quiz' | 'revision' | 'lesson'>('flashcards');
  const [isHomeworkLinkOpen, setIsHomeworkLinkOpen] = useState(false);
  const [isVersionHistoryOpen, setIsVersionHistoryOpen] = useState(false);
  const [isTemplatesOpen, setIsTemplatesOpen] = useState(false);
  const [isMathWorkspaceOpen, setIsMathWorkspaceOpen] = useState(false);
  const [isSketchModalOpen, setIsSketchModalOpen] = useState(false);

  // Synchronize initialFolders
  useEffect(() => {
    if (initialFolders && initialFolders.length > 0) {
      setLocalFolders(initialFolders);
    }
  }, [initialFolders]);

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

  // Combine ALL active filter criteria cleanly (Search + Folder + Tag + Navigation Filter)
  const filteredNotes = notes.filter(n => {
    // 1. Search Query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = (n.title || '').toLowerCase().includes(q);
      const matchSubject = (n.subject || '').toLowerCase().includes(q);
      const matchContent = (n.content || '').toLowerCase().includes(q);
      const tags = (n as any).tags || [];
      const matchTags = tags.some((t: string) => t.toLowerCase().includes(q));
      if (!matchTitle && !matchSubject && !matchContent && !matchTags) {
        return false;
      }
    }

    // 2. Active Folder Filter
    if (activeFolderId) {
      const noteFolder = (n as any).folder_id || (n as any).folderId;
      if (noteFolder !== activeFolderId) return false;
    }

    // 3. Selected Tag Filter
    if (selectedTag) {
      const tags = (n as any).tags || [];
      if (!tags.includes(selectedTag)) return false;
    }

    // 4. Navigation View Filter
    switch (currentFilter) {
      case 'recent':
        return !n.isArchived;
      case 'starred':
        return Boolean(n.isStarred || (n as any).isPinned) && !n.isArchived;
      case 'shared':
        return Boolean(n.collabCode) && !n.isArchived;
      case 'archived':
        return Boolean(n.isArchived);
      case 'trash':
        return Boolean((n as any).isDeleted);
      case 'all':
      default:
        return !n.isArchived && !(n as any).isDeleted;
    }
  });

  // Sort notes for 'recent' view by created/updated date descending
  const sortedFilteredNotes = [...filteredNotes].sort((a, b) => {
    if (currentFilter === 'recent') {
      const dA = new Date(a.createdAt || 0).getTime();
      const dB = new Date(b.createdAt || 0).getTime();
      return dB - dA;
    }
    return 0;
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

  // Folder creation handler
  const handleSaveNewFolder = () => {
    if (!newFolderName.trim()) return;
    const newFolder: NoteFolder = {
      id: 'f_' + Date.now(),
      name: newFolderName.trim(),
      color: 'indigo',
      createdAt: new Date().toISOString()
    };
    if (onCreateFolderProp) {
      onCreateFolderProp(newFolder);
    } else {
      setLocalFolders(prev => [...prev, newFolder]);
    }
    setNewFolderName('');
    setIsCreateFolderOpen(false);
    showNotification(`✓ Folder "${newFolder.name}" created!`);
  };

  // Vector PDF Export
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

  const handleCreateWithAI = async () => {
    if (!aiCreateQuery.trim()) return;
    setIsAIGenerating(true);
    try {
      const res = await fetch('/api/ai/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_note',
          topic: aiCreateQuery,
          subject: 'Academic'
        })
      });
      if (!res.ok) throw new Error('AI Generation failed');
      const data = await res.json();
      if (data.success && data.content) {
        onCreateNote({
          title: aiCreateQuery.slice(0, 40) + (aiCreateQuery.length > 40 ? '...' : ''),
          content: data.content,
          subject: 'AI Generated'
        });
        setIsAICreateModalOpen(false);
        setAiCreateQuery('');
        showNotification('✨ Note created with AI!');
      }
    } catch (err: any) {
      showNotification(`❌ AI error: ${err.message}`);
    } finally {
      setIsAIGenerating(false);
    }
  };

  return (
    <div className="relative min-h-[700px] w-full flex flex-col space-y-4">
      {/* Top Workspace Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-2xl bg-slate-900/60 border border-white/5 backdrop-blur-md">
        <div className="flex items-center gap-2">
          {/* Desktop Sidebar Toggle */}
          <button
            type="button"
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            className="hidden md:flex p-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white cursor-pointer transition-all active:scale-95"
            title={isSidebarCollapsed ? "Show Notes Panel" : "Hide Notes Panel"}
          >
            <PanelLeft className={`w-4 h-4 transition-transform ${isSidebarCollapsed ? '' : 'rotate-180'}`} />
          </button>

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
                <span className={autoSaveState === 'saving' ? 'text-amber-400 font-mono font-bold' : 'text-emerald-400 font-mono font-bold'}>
                  {autoSaveState === 'saving' ? '⏳ Saving...' : '✓ Saved'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* View Switchers & Export Tools */}
        <div className="flex items-center gap-1.5">
          {/* View Mode Tabs */}
          <div className="flex items-center gap-0.5 p-1 rounded-xl bg-slate-950 border border-white/5 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setViewMode('editor')}
              className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer flex items-center gap-1 ${
                viewMode === 'editor' ? 'bg-indigo-600 text-white font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Edit3 className="w-3 h-3" />
              <span className="hidden sm:inline">Editor</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('reader')}
              className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer flex items-center gap-1 ${
                viewMode === 'reader' ? 'bg-indigo-600 text-white font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Eye className="w-3 h-3" />
              <span className="hidden sm:inline">Reader</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('split')}
              className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer flex items-center gap-1 ${
                viewMode === 'split' ? 'bg-indigo-600 text-white font-bold' : 'text-slate-400 hover:text-white'
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
        {/* Zone 1: Navigation Sidebar (Contextual Collapsible Panel) */}
        <div 
          className={`
            ${mobileSidebarOpen ? 'block fixed inset-0 z-50 bg-slate-950/95 p-4' : 'hidden md:block'}
            transition-all duration-300 ease-in-out
            ${isSidebarCollapsed ? 'md:w-0 md:opacity-0 md:pointer-events-none md:col-span-0' : 'md:col-span-3'}
            h-[calc(100vh-180px)] min-h-[500px] flex flex-col
          `}
        >
          {mobileSidebarOpen && (
            <div className="flex justify-end pb-2 md:hidden">
              <button onClick={() => setMobileSidebarOpen(false)} className="p-2 text-white">
                <X className="w-6 h-6" />
              </button>
            </div>
          )}
          <div className="flex-1 overflow-hidden flex flex-col">
            <LectureNotesSidebar
              allNotes={notes}
              notes={sortedFilteredNotes}
              selectedNoteId={selectedNoteId}
              folders={localFolders}
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
              onCreateFolder={() => setIsCreateFolderOpen(true)}
              onToggleStar={id => {
                const target = notes.find(n => n.id === id);
                if (target) {
                  onUpdateNote(id, { isStarred: !target.isStarred });
                }
              }}
              onDeleteNote={onDeleteNote}
              onOpenCreateWithAI={() => setIsAICreateModalOpen(true)}
            />
          </div>
        </div>

        {/* Zone 2: Document Canvas & Writing Surface */}
        <div className={`
          ${isSidebarCollapsed ? 'md:col-span-12' : showOutline ? 'md:col-span-6 lg:col-span-7' : 'md:col-span-9'} 
          space-y-4 transition-all duration-300
        `}>
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
                      noteId={activeNote.id}
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
                  noteId={activeNote.id}
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
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setIsAICreateModalOpen(true)}
                  className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-indigo-400 text-xs font-bold transition-all border border-indigo-500/30 flex items-center gap-2 mx-auto"
                >
                  <BrainCircuit className="w-4 h-4" />
                  Create with AI
                </button>
              </div>
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
        onCreateFolder={() => setIsCreateFolderOpen(true)}
        onOpenTemplate={() => setIsTemplatesOpen(true)}
        onOpenMathWorkspace={() => setIsMathWorkspaceOpen(true)}
        onOpenImageToNote={() => setIsImageToNoteOpen(true)}
        onOpenSketch={() => setIsSketchModalOpen(true)}
        onOpenChecklist={() => {
          if (activeNote) {
            handleContentChange((activeNote.content || '') + '\n\n- [ ] Task 1\n- [ ] Task 2');
            showNotification('✓ Added checklist to note');
          }
        }}
        onOpenLessonBuilder={() => {
          setLearningToolType('lesson');
          setIsLearningToolsOpen(true);
        }}
        onOpenCreateWithAI={() => setIsAICreateModalOpen(true)}
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

      {/* AI Create Note Modal */}
      {isAICreateModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md animate-in fade-in duration-200">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-700 rounded-3xl p-6 space-y-6 shadow-2xl relative overflow-hidden">
            {/* Background Glow */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-600/20 blur-[60px] -z-10" />
            
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-3 text-indigo-400 font-bold">
                <div className="p-2 rounded-xl bg-indigo-600/20">
                  <BrainCircuit className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg text-white">Create with AI</h3>
                  <p className="text-[10px] font-normal text-slate-400 uppercase tracking-widest">Powered by APInex</p>
                </div>
              </div>
              <button onClick={() => setIsAICreateModalOpen(false)} className="text-slate-400 hover:text-white p-2 hover:bg-slate-800 rounded-xl transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-300 flex items-center gap-2">
                  <MessageSquarePlus className="w-3.5 h-3.5 text-indigo-400" />
                  What topic should I write about?
                </label>
                <textarea
                  autoFocus
                  value={aiCreateQuery}
                  onChange={e => setAiCreateQuery(e.target.value)}
                  placeholder="e.g. Quantum entanglement and its applications in cryptography..."
                  className="w-full min-h-[120px] px-4 py-3 text-sm rounded-2xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all placeholder:text-slate-600 resize-none"
                />
              </div>
              
              <div className="flex flex-wrap gap-2 pt-1">
                {['Linear Algebra', 'Cell Biology', 'Macroeconomics', 'History of Rome'].map(tag => (
                  <button
                    key={tag}
                    onClick={() => setAiCreateQuery(tag)}
                    className="px-3 py-1 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 text-[10px] font-medium transition-colors border border-white/5"
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsAICreateModalOpen(false)}
                className="px-4 py-2 text-xs font-bold text-slate-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!aiCreateQuery.trim() || isAIGenerating}
                onClick={handleCreateWithAI}
                className="flex items-center gap-2 px-6 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/20 transition-all active:scale-95 disabled:opacity-50 disabled:active:scale-100"
              >
                {isAIGenerating ? (
                  <>
                    <Sparkles className="w-4 h-4 animate-spin" />
                    <span>Generating...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Generate Note</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Folder Modal */}
      {isCreateFolderOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-sm bg-slate-900 border border-slate-700 rounded-3xl p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2 text-indigo-400 font-bold text-sm">
                <FolderPlus className="w-4 h-4" />
                <span>Create New Folder</span>
              </div>
              <button onClick={() => setIsCreateFolderOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-300">Folder Name</label>
              <input
                type="text"
                autoFocus
                value={newFolderName}
                onChange={e => setNewFolderName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleSaveNewFolder(); }}
                placeholder="e.g. Physics Chapter 4"
                className="w-full px-3 py-2 text-xs rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsCreateFolderOpen(false)}
                className="px-3 py-1.5 text-xs text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!newFolderName.trim()}
                onClick={handleSaveNewFolder}
                className="px-4 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 rounded-xl shadow-md transition-colors"
              >
                Create Folder
              </button>
            </div>
          </div>
        </div>
      )}

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

      {/* Standalone Visual Math Builder Modal */}
      <VisualMathEditorModal
        isOpen={isMathWorkspaceOpen}
        initialLatex="F_c = \frac{m v^2}{r}"
        initialName="Math Workspace Formula"
        onClose={() => setIsMathWorkspaceOpen(false)}
        onSave={(latex, name) => {
          if (activeNote) {
            handleContentChange((activeNote.content || '') + `\n\n$$\n${latex}\n$$`);
            showNotification('✓ Added formula to current note!');
          } else {
            onCreateNote({
              title: name || 'Math Derivation',
              subject: 'Mathematics',
              content: `# ${name || 'Math Derivation'}\n\n$$\n${latex}\n$$`
            });
            showNotification('✓ Created note with formula!');
          }
        }}
      />

      {/* Standalone Sketch Canvas Modal */}
      <SketchCanvasModal
        isOpen={isSketchModalOpen}
        onClose={() => setIsSketchModalOpen(false)}
        onSave={(dataUrl, caption) => {
          if (activeNote) {
            handleContentChange((activeNote.content || '') + `\n\n![${caption || 'Sketch Diagram'}](${dataUrl})`);
            showNotification('✓ Added sketch diagram to current note!');
          } else {
            onCreateNote({
              title: caption || 'Educational Sketch',
              subject: 'Physics',
              content: `# ${caption || 'Educational Sketch'}\n\n![${caption || 'Sketch Diagram'}](${dataUrl})`
            });
            showNotification('✓ Created note with sketch diagram!');
          }
        }}
      />
    </div>
  );
};
