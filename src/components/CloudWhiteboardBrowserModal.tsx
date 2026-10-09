/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * StudentOS Cloud Whiteboard File Browser
 * Allows browsing, opening, and managing persistent cloud whiteboard documents with school isolation.
 */

import React, { useState, useEffect } from 'react';
import {
  X,
  Cloud,
  FileText,
  Clock,
  Trash2,
  FolderOpen,
  RefreshCw,
  Search,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import {
  CloudWhiteboardSummary,
  listCloudWhiteboards,
  loadCloudWhiteboard,
  deleteCloudWhiteboard,
  Slide
} from '../lib/whiteboardFileManager';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSelectDocument: (slides: Slide[], title: string) => void;
  currentUser?: {
    id?: string;
    name?: string;
    role?: string;
    school_id?: string;
  };
}

export const CloudWhiteboardBrowserModal: React.FC<Props> = ({
  isOpen,
  onClose,
  onSelectDocument,
  currentUser
}) => {
  const [documents, setDocuments] = useState<CloudWhiteboardSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchDocs = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const list = await listCloudWhiteboards(currentUser);
      setDocuments(list);
    } catch (err: any) {
      setErrorMsg(err.message || 'Could not load cloud documents.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchDocs();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const filtered = documents.filter(d =>
    d.fileName.toLowerCase().includes(search.toLowerCase()) ||
    d.userName.toLowerCase().includes(search.toLowerCase())
  );

  const handleOpenDoc = async (doc: CloudWhiteboardSummary) => {
    setOpeningId(doc.id);
    setErrorMsg(null);
    try {
      const res = await loadCloudWhiteboard(doc.id);
      if (res.success && res.document?.slides) {
        onSelectDocument(res.document.slides, res.document.fileName);
        onClose();
      } else {
        setErrorMsg(res.error || 'Failed to open this whiteboard document.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Error loading document from cloud.');
    } finally {
      setOpeningId(null);
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!window.confirm('Are you sure you want to delete this cloud whiteboard?')) return;
    setDeletingId(id);
    try {
      await deleteCloudWhiteboard(id);
      setDocuments(prev => prev.filter(d => d.id !== id));
    } catch {}
    setDeletingId(null);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-slate-900 border border-indigo-500/35 rounded-3xl p-5 sm:p-6 shadow-2xl space-y-4 animate-scaleUp text-slate-100 flex flex-col max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-2xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <Cloud className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-black text-white uppercase tracking-wider font-display flex items-center gap-2">
                <span>StudentOS Whiteboard Files</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 font-mono">
                  {documents.length} Saved
                </span>
              </h3>
              <p className="text-[11px] text-slate-400 font-sans">
                Open previously saved cloud whiteboards from any device with school sync.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={fetchDocs}
              disabled={loading}
              className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors text-sm cursor-pointer"
              title="Refresh List"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors text-sm cursor-pointer"
              title="Close Dialog"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search saved cloud boards by name or author..."
            className="w-full pl-10 pr-4 py-2 rounded-2xl bg-slate-950 border border-white/10 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 shadow-inner"
          />
        </div>

        {errorMsg && (
          <div className="p-3 rounded-2xl bg-red-950/40 border border-red-500/30 flex items-center gap-2 text-xs text-red-300">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Document List */}
        <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar min-h-[220px]">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-48 space-y-2 text-slate-500">
              <RefreshCw className="w-6 h-6 animate-spin text-indigo-400" />
              <span className="text-xs font-mono">Loading Cloud Whiteboards...</span>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 space-y-2 text-slate-500 text-center p-4">
              <Cloud className="w-8 h-8 text-slate-600" />
              <p className="text-xs font-medium text-slate-400">No cloud whiteboard documents found.</p>
              <p className="text-[11px] text-slate-500 max-w-xs">
                Click "Save" on any whiteboard and choose "StudentOS Cloud" to keep your boards synchronized across devices.
              </p>
            </div>
          ) : (
            filtered.map((doc) => {
              const isOpening = openingId === doc.id;
              const isDeleting = deletingId === doc.id;
              return (
                <div
                  key={doc.id}
                  onClick={() => !isOpening && handleOpenDoc(doc)}
                  className="p-3 rounded-2xl bg-slate-950/80 hover:bg-slate-800/80 border border-white/5 hover:border-indigo-500/30 transition-all cursor-pointer flex items-center justify-between group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-indigo-500/15 border border-indigo-500/25 flex items-center justify-center text-indigo-400 shrink-0">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-black text-white group-hover:text-indigo-300 transition-colors">
                        {doc.fileName}
                      </h4>
                      <div className="flex items-center gap-2.5 text-[10px] text-slate-400 mt-0.5">
                        <span className="font-mono text-indigo-400/90">
                          {doc.slideCount} slide{doc.slideCount === 1 ? '' : 's'}
                        </span>
                        <span>•</span>
                        <span>{doc.userName}</span>
                        <span>•</span>
                        <span className="flex items-center gap-1 font-mono text-slate-500">
                          <Clock className="w-3 h-3" />
                          {new Date(doc.updatedAt || doc.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={(e) => handleDelete(e, doc.id)}
                      disabled={isDeleting}
                      className="p-2 rounded-xl text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors opacity-0 group-hover:opacity-100 cursor-pointer"
                      title="Delete from Cloud"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={isOpening}
                      className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-bold flex items-center gap-1.5 shadow-sm cursor-pointer"
                    >
                      {isOpening ? (
                        <RefreshCw className="w-3 h-3 animate-spin" />
                      ) : (
                        <FolderOpen className="w-3 h-3" />
                      )}
                      <span>Open</span>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
