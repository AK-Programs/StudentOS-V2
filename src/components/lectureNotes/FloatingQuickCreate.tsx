import React, { useState } from 'react';
import { 
  Plus, 
  X, 
  FileText, 
  FolderPlus, 
  BookOpen, 
  LayoutTemplate, 
  Calculator, 
  GraduationCap, 
  CheckSquare, 
  PenTool, 
  FileSpreadsheet, 
  Camera, 
  FileUp, 
  Upload, 
  ClipboardPaste,
  Sparkles,
  ChevronRight
} from 'lucide-react';

interface FloatingQuickCreateProps {
  onCreateNote: () => void;
  onCreateFolder: () => void;
  onOpenTemplate: () => void;
  onOpenMathWorkspace: () => void;
  onOpenImageToNote: () => void;
  onOpenSketch: () => void;
  onOpenChecklist: () => void;
  onOpenLessonBuilder: () => void;
  onImportMarkdown: () => void;
  onImportPdf: () => void;
  onPasteContent: () => void;
  onOpenCreateWithAI: () => void;
}

export const FloatingQuickCreate: React.FC<FloatingQuickCreateProps> = ({
  onCreateNote,
  onCreateFolder,
  onOpenTemplate,
  onOpenMathWorkspace,
  onOpenImageToNote,
  onOpenSketch,
  onOpenChecklist,
  onOpenLessonBuilder,
  onImportMarkdown,
  onImportPdf,
  onPasteContent,
  onOpenCreateWithAI
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [mobileTab, setMobileTab] = useState<'create' | 'educational' | 'import'>('create');

  const createActions = [
    {
      label: 'Create Note',
      desc: 'Blank rich-text educational note',
      icon: <FileText className="w-4 h-4 text-indigo-400" />,
      onClick: () => { setIsOpen(false); onCreateNote(); }
    },
    {
      label: 'Create with AI',
      desc: 'Generate a full note from a topic prompt',
      icon: <Sparkles className="w-4 h-4 text-amber-400" />,
      onClick: () => { setIsOpen(false); onOpenCreateWithAI(); }
    },
    {
      label: 'Create Folder',
      desc: 'Organize notes by subject or chapter',
      icon: <FolderPlus className="w-4 h-4 text-blue-400" />,
      onClick: () => { setIsOpen(false); onCreateFolder(); }
    },
    {
      label: 'Study Page',
      desc: 'Focused revision canvas with memory scaffold',
      icon: <BookOpen className="w-4 h-4 text-emerald-400" />,
      onClick: () => { setIsOpen(false); onCreateNote(); }
    },
    {
      label: 'From Template',
      desc: 'Cornell Notes, Lab Report, or Derivation Sheet',
      icon: <LayoutTemplate className="w-4 h-4 text-cyan-400" />,
      onClick: () => { setIsOpen(false); onOpenTemplate(); }
    }
  ];

  const educationalActions = [
    {
      label: 'Math Workspace',
      desc: 'Visual formula builder & vector equation tool',
      icon: <Calculator className="w-4 h-4 text-purple-400" />,
      onClick: () => { setIsOpen(false); onOpenMathWorkspace(); }
    },
    {
      label: 'Image to Note (OCR)',
      desc: 'Turn whiteboard & notebook photos into digital notes',
      icon: <Camera className="w-4 h-4 text-rose-400" />,
      badge: 'Priority',
      onClick: () => { setIsOpen(false); onOpenImageToNote(); }
    },
    {
      label: 'Action Checklist',
      desc: 'Track tasks, exam checkpoints, and topics',
      icon: <CheckSquare className="w-4 h-4 text-teal-400" />,
      onClick: () => { setIsOpen(false); onOpenChecklist(); }
    },
    {
      label: 'Diagram & Sketch',
      desc: 'Hand-drawn sketches, circuits, and flowcharts',
      icon: <PenTool className="w-4 h-4 text-sky-400" />,
      onClick: () => { setIsOpen(false); onOpenSketch(); }
    },
    {
      label: 'Create a Lesson',
      desc: 'Teacher curriculum outline & classroom activities',
      icon: <GraduationCap className="w-4 h-4 text-amber-400" />,
      onClick: () => { setIsOpen(false); onOpenLessonBuilder(); }
    }
  ];

  const importActions = [
    {
      label: 'Import Markdown',
      desc: 'Load existing .md notes or Obsidian files',
      icon: <FileUp className="w-4 h-4 text-blue-400" />,
      onClick: () => { setIsOpen(false); onImportMarkdown(); }
    },
    {
      label: 'Import PDF',
      desc: 'Extract document structure into editable note',
      icon: <Upload className="w-4 h-4 text-indigo-400" />,
      onClick: () => { setIsOpen(false); onImportPdf(); }
    },
    {
      label: 'Paste Clipboard',
      desc: 'Parse rich text, tables, or equations from clipboard',
      icon: <ClipboardPaste className="w-4 h-4 text-emerald-400" />,
      onClick: () => { setIsOpen(false); onPasteContent(); }
    }
  ];

  return (
    <>
      {/* Floating Plus Button (Desktop & Mobile) */}
      <div className="fixed bottom-6 right-6 z-40">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          aria-label="Quick Create Note Action"
          className={`w-14 h-14 rounded-2xl flex items-center justify-center text-white shadow-xl transition-all duration-300 transform active:scale-95 cursor-pointer ${
            isOpen 
              ? 'bg-rose-600 rotate-45 shadow-rose-900/30 ring-4 ring-rose-500/20' 
              : 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-900/40 ring-4 ring-indigo-500/20 hover:scale-105'
          }`}
        >
          <Plus className="w-6 h-6 stroke-[2.5]" />
        </button>
      </div>

      {/* Desktop Speed-Dial Flyout */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-30 hidden md:block bg-slate-950/40 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => setIsOpen(false)}
        >
          <div 
            className="absolute bottom-24 right-6 w-80 bg-slate-900 border border-slate-700/80 rounded-3xl shadow-2xl p-4 space-y-4 animate-in slide-in-from-bottom-4 duration-200"
            onClick={e => e.stopPropagation()}
          >
            {/* 1. Create Category */}
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-2 block mb-1">
                Create
              </span>
              <div className="space-y-0.5">
                {createActions.map((act, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={act.onClick}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-slate-800 text-left transition-colors cursor-pointer group"
                  >
                    <div className="p-1.5 rounded-lg bg-slate-800 group-hover:bg-slate-700 transition-colors">
                      {act.icon}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-slate-200 group-hover:text-white truncate">{act.label}</p>
                      <p className="text-[10px] text-slate-400 truncate">{act.desc}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* 2. Educational Category */}
            <div className="pt-2 border-t border-slate-800">
              <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400 px-2 block mb-1">
                Educational
              </span>
              <div className="space-y-0.5">
                {educationalActions.map((act, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={act.onClick}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-slate-800 text-left transition-colors cursor-pointer group"
                  >
                    <div className="p-1.5 rounded-lg bg-slate-800 group-hover:bg-slate-700 transition-colors">
                      {act.icon}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-semibold text-slate-200 group-hover:text-white truncate">{act.label}</span>
                        {act.badge && (
                          <span className="text-[9px] font-bold text-rose-400 bg-rose-500/10 px-1.5 py-0.2 rounded border border-rose-500/20">
                            {act.badge}
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-slate-400 truncate">{act.desc}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* 3. Bring Content In */}
            <div className="pt-2 border-t border-slate-800">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-2 block mb-1">
                Bring Content In
              </span>
              <div className="space-y-0.5">
                {importActions.map((act, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={act.onClick}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-slate-800 text-left transition-colors cursor-pointer group"
                  >
                    <div className="p-1.5 rounded-lg bg-slate-800 group-hover:bg-slate-700 transition-colors">
                      {act.icon}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-slate-200 group-hover:text-white truncate">{act.label}</p>
                      <p className="text-[10px] text-slate-400 truncate">{act.desc}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Bottom Sheet Flyout */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-30 md:hidden bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-150 flex flex-col justify-end"
          onClick={() => setIsOpen(false)}
        >
          <div 
            className="w-full bg-slate-900 border-t border-slate-700/80 rounded-t-3xl shadow-2xl p-5 space-y-4 max-h-[80vh] overflow-y-auto animate-in slide-in-from-bottom duration-200 pb-20"
            onClick={e => e.stopPropagation()}
          >
            {/* Sheet Handle */}
            <div className="w-12 h-1.5 rounded-full bg-slate-700 mx-auto" />

            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-100">Quick Create</h3>
              <button 
                onClick={() => setIsOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Mobile Category Tabs */}
            <div className="flex items-center gap-1 p-1 bg-slate-950 rounded-xl">
              <button
                type="button"
                onClick={() => setMobileTab('create')}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                  mobileTab === 'create' ? 'bg-indigo-600 text-white' : 'text-slate-400'
                }`}
              >
                Create
              </button>
              <button
                type="button"
                onClick={() => setMobileTab('educational')}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                  mobileTab === 'educational' ? 'bg-indigo-600 text-white' : 'text-slate-400'
                }`}
              >
                Educational
              </button>
              <button
                type="button"
                onClick={() => setMobileTab('import')}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                  mobileTab === 'import' ? 'bg-indigo-600 text-white' : 'text-slate-400'
                }`}
              >
                Import
              </button>
            </div>

            {/* Tab Actions */}
            <div className="space-y-1">
              {(mobileTab === 'create' ? createActions : mobileTab === 'educational' ? educationalActions : importActions).map((act, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={act.onClick}
                  className="w-full flex items-center gap-3 p-3 rounded-2xl bg-slate-800/60 active:bg-slate-800 text-left transition-colors cursor-pointer"
                >
                  <div className="p-2 rounded-xl bg-slate-900 shrink-0">
                    {act.icon}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-100 truncate">{act.label}</span>
                      {'badge' in act && Boolean((act as any).badge) && (
                        <span className="text-[9px] font-bold text-rose-400 bg-rose-500/10 px-1.5 py-0.2 rounded border border-rose-500/20">
                          {String((act as any).badge)}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400 truncate">{act.desc}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-500 shrink-0" />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
