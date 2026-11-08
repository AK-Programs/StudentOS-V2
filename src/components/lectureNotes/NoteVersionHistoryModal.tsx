import React, { useState } from 'react';
import { 
  X, 
  RotateCcw, 
  History, 
  Clock, 
  Check, 
  FileText, 
  ArrowLeft 
} from 'lucide-react';
import { NoteVersion } from '../../lib/lectureNotes/types';

interface NoteVersionHistoryModalProps {
  isOpen: boolean;
  currentTitle: string;
  currentContent: string;
  versions: NoteVersion[];
  onClose: () => void;
  onRestoreVersion: (content: string, title?: string) => void;
}

export const NoteVersionHistoryModal: React.FC<NoteVersionHistoryModalProps> = ({
  isOpen,
  currentTitle,
  currentContent,
  versions = [],
  onClose,
  onRestoreVersion
}) => {
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(
    versions.length > 0 ? versions[0].id : null
  );

  if (!isOpen) return null;

  const selectedVersion = versions.find(v => v.id === selectedVersionId) || {
    id: 'current',
    noteId: 'current',
    title: currentTitle,
    content: currentContent,
    createdAt: 'Current Working Draft'
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className="w-full max-w-4xl bg-slate-900 border border-slate-700/80 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[88vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/40">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center">
              <History className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-100">Document Version History & Recovery</h3>
              <p className="text-[11px] text-slate-400">Restore previous checkpoints and recover unsaved edits</p>
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
        <div className="flex-1 grid grid-cols-1 md:grid-cols-3 overflow-hidden">
          {/* Versions List */}
          <div className="border-r border-slate-800 p-4 overflow-y-auto space-y-2 bg-slate-950/40">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-2 block mb-2">
              Saved Checkpoints ({versions.length + 1})
            </span>

            {/* Current Draft */}
            <button
              type="button"
              onClick={() => setSelectedVersionId(null)}
              className={`w-full text-left p-3 rounded-2xl transition-all cursor-pointer ${
                selectedVersionId === null 
                  ? 'bg-indigo-600/20 border border-indigo-500/40 text-white' 
                  : 'bg-slate-900/60 hover:bg-slate-800 text-slate-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-indigo-300">Current Draft</span>
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
              </div>
              <p className="text-[11px] text-slate-400 mt-1">Live working content</p>
            </button>

            {/* Historical Versions */}
            {versions.map((ver, idx) => (
              <button
                key={ver.id}
                type="button"
                onClick={() => setSelectedVersionId(ver.id)}
                className={`w-full text-left p-3 rounded-2xl transition-all cursor-pointer ${
                  selectedVersionId === ver.id 
                    ? 'bg-indigo-600/20 border border-indigo-500/40 text-white' 
                    : 'bg-slate-900/60 hover:bg-slate-800 text-slate-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-200">Version {versions.length - idx}</span>
                  <span className="text-[10px] text-slate-500 flex items-center gap-1 font-mono">
                    <Clock className="w-3 h-3" /> {ver.createdAt}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 truncate mt-1">{ver.title || 'Note version'}</p>
              </button>
            ))}
          </div>

          {/* Preview Panel */}
          <div className="col-span-2 p-5 overflow-y-auto flex flex-col justify-between space-y-4 bg-slate-950/20">
            <div className="space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <span className="text-xs font-bold text-slate-300">
                  {selectedVersion.title || currentTitle}
                </span>
                <span className="text-[11px] text-slate-500 font-mono">
                  {selectedVersion.createdAt}
                </span>
              </div>
              <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800/80 text-xs text-slate-200 font-mono whitespace-pre-wrap leading-relaxed max-h-[420px] overflow-y-auto">
                {selectedVersion.content || '(Empty content)'}
              </div>
            </div>

            {selectedVersionId !== null && (
              <div className="pt-3 border-t border-slate-800 flex justify-end">
                <button
                  type="button"
                  onClick={() => {
                    onRestoreVersion(selectedVersion.content, selectedVersion.title);
                    onClose();
                  }}
                  className="px-5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl transition-all shadow-md active:scale-95 cursor-pointer flex items-center gap-1.5"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Restore this Version</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
