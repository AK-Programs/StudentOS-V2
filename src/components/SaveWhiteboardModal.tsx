/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Save Whiteboard Document Modal
 * Allows student/teacher to choose custom document file name before downloading.
 */

import React, { useState } from 'react';
import { X, Save, FileText, CheckCircle2 } from 'lucide-react';
import { WHITEBOARD_FILE_EXTENSION } from '../lib/whiteboardFileManager';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSave: (fileName: string) => void;
  slideCount: number;
}

export const SaveWhiteboardModal: React.FC<Props> = ({
  isOpen,
  onClose,
  onSave,
  slideCount
}) => {
  const [fileName, setFileName] = useState('My Whiteboard');
  const [savedSuccess, setSavedSuccess] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fileName.trim()) return;

    onSave(fileName.trim());
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 600);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-slate-900 border border-indigo-500/35 rounded-3xl p-5 sm:p-6 shadow-2xl space-y-4 animate-scaleUp text-slate-100"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-2xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <Save className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-black text-white uppercase tracking-wider font-display">
                Save Whiteboard
              </h3>
              <p className="text-[11px] text-slate-400 font-sans">
                Save all {slideCount} slide{slideCount === 1 ? '' : 's'} as a StudentOS Whiteboard file.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors text-sm cursor-pointer"
            title="Close Dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          <div className="space-y-1.5">
            <label className="text-[11px] font-black uppercase tracking-wider text-slate-300 font-mono flex items-center justify-between">
              <span>File Name</span>
              <span className="text-[10px] text-indigo-400 font-sans font-normal">
                {WHITEBOARD_FILE_EXTENSION}
              </span>
            </label>
            <div className="relative">
              <input
                type="text"
                value={fileName}
                onChange={(e) => setFileName(e.target.value)}
                placeholder="My Whiteboard"
                className="w-full pl-3.5 pr-20 py-2.5 rounded-2xl bg-slate-950 border border-white/10 text-xs sm:text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 shadow-inner"
                autoFocus
                required
              />
              <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[10px] font-mono text-slate-500 pointer-events-none">
                .whiteboard
              </span>
            </div>
          </div>

          <div className="p-3 rounded-2xl bg-slate-950/70 border border-white/5 space-y-1 text-[11px] text-slate-400">
            <div className="flex items-center gap-1.5 text-slate-300 font-bold">
              <FileText className="w-3.5 h-3.5 text-indigo-400" />
              <span>Full Multi-Slide Document Package</span>
            </div>
            <p className="leading-relaxed">
              Includes all {slideCount} slides, drawings, geometric shapes, sticky notes, verified 3D models, SVG diagrams, and custom styles.
            </p>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/10">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-all cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!fileName.trim() || savedSuccess}
              className="px-5 py-2 text-xs bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 disabled:opacity-40 text-white rounded-xl font-black uppercase tracking-wider transition-all shadow-lg hover:shadow-indigo-500/25 cursor-pointer flex items-center gap-1.5"
            >
              {savedSuccess ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300" />
                  <span>Saved!</span>
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5" />
                  <span>Save Document</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
