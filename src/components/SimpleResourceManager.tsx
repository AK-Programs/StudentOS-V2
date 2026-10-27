import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { sendNotificationToUsers } from '../firebase';
import { uploadFileToStorage } from '../lib/storageHelper';
import { supabase } from '../lib/supabase';
import { 
  Plus, Trash2, FileText, Image as ImageIcon, Eye, Search, 
  ArrowLeft, Calendar, Sparkles, X, Loader2, Filter
} from 'lucide-react';
import { AssignmentUploadForm } from './AssignmentUploadForm';
import { getSupabaseResources, saveSupabaseResource, deleteSupabaseResource } from '../lib/supabaseResources';
import { InAppDocumentViewer } from './InAppDocumentViewer';
import { getFolders, Folder, createFolder, renameFolder, deleteFolder } from '../lib/supabaseFolders';
import { FolderPlus, MoreVertical, Pin, Share2, Move, Edit2, Lock, Unlock, Hash } from 'lucide-react';

export default function SimpleResourceManager({ 
  type, title, emoji, currentUser, effectiveRole, showNotification, goBack 
}: any) {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [viewingDoc, setViewingDoc] = useState<{ url: string; title: string; fileName?: string } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGradeFilter, setSelectedGradeFilter] = useState('All');
  const [aiCompanionOutput, setAiCompanionOutput] = useState<{ title: string; text: string } | null>(null);
  const [generatingAiId, setGeneratingAiId] = useState<string | null>(null);

  const [folders, setFolders] = useState<Folder[]>([]);
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');

  const [itemHoldMenu, setItemHoldMenu] = useState<{ itemId: string, x: number, y: number } | null>(null);
  const holdTimerRef = useRef<any>(null);

  const canEdit = ['teacher', 'coordinator', 'admin', 'super_admin'].includes(effectiveRole);

  useEffect(() => {
    fetchItems();
    if (currentUser?.uid) {
      getFolders(currentUser.uid, 'materials').then(setFolders);
    }

    const channel = supabase.channel('materials_hub_channel');
    channel.on('broadcast', { event: 'materials_updated' }, () => {
      fetchItems();
    }).subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [type, currentUser?.grade, currentUser?.section, effectiveRole]);

  const fetchItems = async () => {
    setLoading(true);
    try {
      const tableName = type === 'assignment' ? 'assignments' : 'school_resources';
      const fetched = await getSupabaseResources(tableName);
      
      const list: any[] = [];
      fetched.forEach(item => {
        const itemType = item.type || item.resourceType;
        if (itemType !== type) return;

        const finalUrl = item.url || item.fileUrl || item.file_url || item.attachment_url || item.fileData;
        if (finalUrl) {
          item.url = finalUrl;
          item.fileData = finalUrl;
        }
        
        if (effectiveRole === 'student') {
          const itemGrade = item.targetGrade || 'All Grades';
          const itemSection = item.targetSection || 'All Sections';
          if (itemGrade !== 'All Grades' && itemGrade !== currentUser?.grade) return;
          if (itemSection !== 'All Sections' && itemSection !== currentUser?.section) return;
        }
        list.push(item);
      });
      
      list.sort((a, b) => {
        const tA = a.created_at || a.createdAt || 0;
        const tB = b.created_at || b.createdAt || 0;
        return Number(tB) - Number(tA);
      });
      setItems(list);
    } catch (err) {
      console.error('Failed to load items from Supabase:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const tableName = type === 'assignment' ? 'assignments' : 'school_resources';
      await deleteSupabaseResource(tableName, id);
      showNotification('Resource removed.');
      fetchItems();
      setItemHoldMenu(null);
    } catch (err) {
      showNotification('Error deleting item.');
      console.error(err);
    }
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim() || !currentUser?.uid) return;
    const f = await createFolder(newFolderName, 'materials', currentUser.uid);
    if (f) {
      setFolders([f, ...folders]);
      setNewFolderName('');
      setShowFolderModal(false);
      showNotification('📁 Folder created');
    }
  };

  const handleLongPress = (e: React.MouseEvent | React.TouchEvent, itemId: string) => {
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;

    holdTimerRef.current = setTimeout(() => {
      setItemHoldMenu({ itemId, x: clientX, y: clientY });
      if (navigator.vibrate) navigator.vibrate(50);
    }, 1000);
  };

  const cancelHold = () => {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
  };

  const handleMoveToFolder = async (itemId: string, folderId: string | null) => {
    const tableName = type === 'assignment' ? 'assignments' : 'school_resources';
    try {
      await supabase.from(tableName).update({ folder_id: folderId }).eq('id', itemId);
      showNotification('Moved to folder');
      fetchItems();
    } catch (_) {}
    setItemHoldMenu(null);
  };

  const renderFileIcon = (fileName: string) => {
    if (!fileName) return <FileText size={16} className="text-indigo-400" />;
    const ext = fileName.split('.').pop()?.toLowerCase();
    if (ext === 'pdf') return <FileText size={16} className="text-rose-400" />;
    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext || '')) return <ImageIcon size={16} className="text-cyan-400" />;
    return <FileText size={16} className="text-indigo-400" />;
  };

  const filteredItems = useMemo(() => {
    return items.filter(item => {
      if (selectedGradeFilter !== 'All' && (item.targetGrade || 'All Grades') !== selectedGradeFilter) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = (item.title || '').toLowerCase().includes(q);
        const matchContent = (item.content || '').toLowerCase().includes(q);
        const matchAuthor = (item.author || '').toLowerCase().includes(q);
        if (!matchTitle && !matchContent && !matchAuthor) return false;
      }
      return true;
    });
  }, [items, selectedGradeFilter, searchQuery]);

  const handleGenerateCompanion = async (item: any) => {
    setGeneratingAiId(item.id);
    showNotification('Generating study summary and practice questions...');
    try {
      const res = await fetch('/api/ai/presentation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: item.title,
          topic: item.content || item.title
        })
      });
      const data = await res.json();
      setAiCompanionOutput({
        title: item.title,
        text: data.text || 'Study summary generated.'
      });
    } catch (err: any) {
      showNotification('Could not generate study summary: ' + (err.message || 'Error'));
    } finally {
      setGeneratingAiId(null);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Header Bar */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="bento-card p-6 rounded-3xl flex flex-col sm:flex-row sm:items-center justify-between gap-4"
      >
        <div className="flex items-center gap-3.5">
          <button
            onClick={goBack}
            className="p-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-white/10 text-slate-300 hover:text-white transition-colors cursor-pointer"
            title="Back to Assignment Center"
          >
            <ArrowLeft size={16} />
          </button>
          <div>
            <div className="flex items-center gap-2 text-xs text-indigo-400 font-semibold">
              <span>Assignment Center</span>
              <span aria-hidden="true">·</span>
              <span>{items.length} {items.length === 1 ? 'entry' : 'entries'}</span>
            </div>
            <h3 className="text-xl sm:text-2xl font-black text-white font-display tracking-tight">
              {title}
            </h3>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {canEdit && (
            <button 
              onClick={() => { 
                setEditingId(null); 
                setIsFormOpen(prev => !prev); 
              }}
              className="uiverse-btn-primary px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer"
            >
              <Plus size={15} />
              <span>{isFormOpen ? 'Close Form' : `Publish ${title}`}</span>
            </button>
          )}
        </div>
      </motion.div>

      {/* Search & Filter Controls */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 p-2 bg-slate-900/70 border border-white/10 rounded-2xl">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={`Search ${title.toLowerCase()} by title, instructions, or teacher...`}
            className="w-full pl-10 pr-4 py-2 bg-transparent text-xs sm:text-sm text-white placeholder:text-slate-500 focus:outline-none"
          />
        </div>
        {effectiveRole !== 'student' && (
          <div className="flex items-center gap-2 px-2">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={selectedGradeFilter}
              onChange={(e) => setSelectedGradeFilter(e.target.value)}
              className="bg-slate-950 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-slate-200 font-semibold focus:outline-none"
            >
              <option value="All">All Grades</option>
              <option value="All Grades">School-wide</option>
              {Array.from({ length: 12 }, (_, i) => `Grade ${i + 1}`).map(g => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Upload Form Drawer */}
      <AnimatePresence>
        {isFormOpen && canEdit && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="bento-card border-indigo-500/30 p-6 rounded-3xl space-y-4"
          >
            <div className="flex justify-between items-center border-b border-white/10 pb-3">
              <div>
                <h4 className="font-bold text-white text-base">{editingId ? 'Update Resource' : `Publish New ${title}`}</h4>
                <p className="text-xs text-slate-400">Attach PDFs, worksheets, or images and assign to a class section.</p>
              </div>
              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                className="p-2 hover:bg-white/5 text-slate-400 hover:text-white rounded-xl"
              >
                <X size={16} />
              </button>
            </div>
            <AssignmentUploadForm category={type} onSuccess={() => { setIsFormOpen(false); fetchItems(); }} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* AI Companion Output Modal */}
      <AnimatePresence>
        {aiCompanionOutput && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            className="bento-card border-indigo-500/30 p-6 rounded-3xl space-y-3"
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2 text-indigo-300 font-bold text-sm">
                <Sparkles className="w-4 h-4" />
                <span>Study Companion Notes — {aiCompanionOutput.title}</span>
              </div>
              <button
                onClick={() => setAiCompanionOutput(null)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="text-xs sm:text-sm text-slate-200 whitespace-pre-wrap leading-relaxed max-h-80 overflow-y-auto pr-2">
              {aiCompanionOutput.text}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Folders Navigation */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none no-scrollbar">
        <button
          onClick={() => setActiveFolderId(null)}
          className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider border transition-all ${!activeFolderId ? 'bg-indigo-600 border-indigo-400 text-white shadow-lg shadow-indigo-500/20' : 'bg-slate-950/60 border-white/5 text-slate-400 hover:bg-slate-900'}`}
        >
          All {title}
        </button>
        {folders.map(f => (
          <button
            key={f.id}
            onClick={() => setActiveFolderId(f.id)}
            className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider border transition-all ${activeFolderId === f.id ? 'bg-indigo-600 border-indigo-400 text-white shadow-lg shadow-indigo-500/20' : 'bg-slate-950/60 border-white/5 text-slate-400 hover:bg-slate-900'}`}
          >
            📁 {f.name}
          </button>
        ))}
        {canEdit && (
          <button
            onClick={() => setShowFolderModal(true)}
            className="p-1.5 rounded-xl bg-slate-950/60 border border-dashed border-white/20 text-slate-500 hover:text-indigo-400 hover:border-indigo-500/40 transition-all"
            title="Create Folder"
          >
            <FolderPlus className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* List Content */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(n => (
            <div key={n} className="bento-card p-5 rounded-2xl h-28 animate-pulse" />
          ))}
        </div>
      ) : filteredItems.filter(i => !activeFolderId || i.folder_id === activeFolderId).length === 0 ? (
        <div className="bento-card text-center py-12 px-6 rounded-3xl space-y-2">
          <p className="text-sm font-bold text-white">No {title.toLowerCase()} found</p>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            {searchQuery
              ? `No items matched "${searchQuery}". Try clearing your search filter.`
              : `There are currently no published ${title.toLowerCase()} for this selection.`}
          </p>
        </div>
      ) : (
        <div className="space-y-3.5">
          {filteredItems
            .filter(i => !activeFolderId || i.folder_id === activeFolderId)
            .map((item, idx) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, delay: Math.min(idx * 0.03, 0.2) }}
              className="bento-card p-5 rounded-2xl flex flex-col md:flex-row gap-4 justify-between group relative"
              onMouseDown={(e) => handleLongPress(e, item.id)}
              onMouseUp={cancelHold}
              onMouseLeave={cancelHold}
              onTouchStart={(e) => handleLongPress(e, item.id)}
              onTouchEnd={cancelHold}
            >
              <div className="space-y-2 flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                  <span className="font-semibold text-indigo-400">
                    {item.targetGrade || 'All Grades'}
                  </span>
                  {item.targetSection && item.targetSection !== 'All Sections' && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span>Section {item.targetSection}</span>
                    </>
                  )}
                  {item.dueDate && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span className="text-rose-400 font-medium flex items-center gap-1">
                        <Calendar className="w-3 h-3" /> Due {item.dueDate}
                      </span>
                    </>
                  )}
                  <span aria-hidden="true">·</span>
                  <span>By {item.author || 'Faculty'}</span>
                  {item.createdAt && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono">{new Date(item.createdAt).toLocaleDateString()}</span>
                    </>
                  )}
                </div>

                <h4 className="text-base sm:text-lg font-bold text-white">{item.title}</h4>
                {item.content && (
                  <p className="text-xs sm:text-sm text-slate-300 whitespace-pre-wrap leading-relaxed">
                    {item.content}
                  </p>
                )}
                
                {item.fileData && type !== 'gallery' && (
                  <div 
                    onClick={() => setViewingDoc({ url: item.fileData, title: item.title, fileName: item.fileName })}
                    className="mt-2 inline-flex items-center gap-2 bg-slate-950/80 hover:bg-slate-900 px-3.5 py-2 rounded-xl border border-white/10 cursor-pointer transition-colors"
                  >
                    {renderFileIcon(item.fileName)}
                    <span className="text-xs text-slate-200 font-medium truncate max-w-[220px]">{item.fileName || 'Attached Document'}</span>
                    <span className="text-xs text-indigo-400 font-semibold ml-1">Preview →</span>
                  </div>
                )}

                {item.galleryUrls && item.galleryUrls.length > 0 && type === 'gallery' && (
                  <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
                    {item.galleryUrls.map((gObj: any, gIdx: number) => (
                      <div
                        key={gIdx}
                        onClick={() => setViewingDoc({ url: gObj.url, title: gObj.name || item.title, fileName: gObj.name })}
                        className="block relative aspect-square rounded-xl overflow-hidden border border-white/10 group/gallery cursor-pointer"
                      >
                        <img src={gObj.url} alt={gObj.name} className="object-cover w-full h-full transition-transform duration-300 group-hover/gallery:scale-105" />
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover/gallery:opacity-100 transition-opacity flex items-center justify-center">
                          <Eye size={18} className="text-white" />
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="pt-2 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={generatingAiId === item.id}
                    onClick={() => handleGenerateCompanion(item)}
                    className="px-3 py-1.5 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/25 text-indigo-300 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {generatingAiId === item.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="w-3.5 h-3.5" />
                    )}
                    <span>Study Summary & Practice Questions</span>
                  </button>
                </div>
              </div>

              <div className="flex md:flex-col gap-2 items-end justify-between shrink-0">
                {item.fileData && type !== 'gallery' && (
                  <button
                    onClick={() => setViewingDoc({ url: item.fileData, title: item.title, fileName: item.fileName })}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Eye size={14} /> Open File
                  </button>
                )}
                {canEdit && (
                  <button
                    onClick={() => handleDelete(item.id)}
                    className="px-3 py-1.5 text-rose-400 border border-rose-500/20 hover:bg-rose-500/15 rounded-xl flex items-center gap-1.5 text-xs font-semibold transition-colors cursor-pointer"
                  >
                    <Trash2 size={13} /> Delete
                  </button>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Item Hold Menu */}
      {itemHoldMenu && (
        <div 
          className="fixed z-[100] w-48 bg-slate-900/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl p-1.5 animate-in fade-in zoom-in duration-150"
          style={{ left: Math.min(window.innerWidth - 200, itemHoldMenu.x), top: Math.min(window.innerHeight - 300, itemHoldMenu.y) }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex flex-col gap-1">
            <div className="px-3 py-1 text-[9px] font-black text-slate-500 uppercase tracking-wider">Move to Folder</div>
            <button
              onClick={() => handleMoveToFolder(itemHoldMenu.itemId, null)}
              className="flex items-center gap-3 px-3 py-2 text-xs font-bold text-slate-200 hover:bg-white/5 rounded-xl transition-all"
            >
              <Move className="w-3.5 h-3.5 text-slate-400" />
              Root
            </button>
            {folders.map(f => (
              <button
                key={f.id}
                onClick={() => handleMoveToFolder(itemHoldMenu.itemId, f.id)}
                className="flex items-center gap-3 px-3 py-2 text-xs font-bold text-slate-200 hover:bg-white/5 rounded-xl transition-all"
              >
                <Move className="w-3.5 h-3.5 text-indigo-400" />
                {f.name}
              </button>
            ))}
            {canEdit && (
              <>
                <div className="h-px bg-white/5 my-1" />
                <button
                  onClick={() => handleDelete(itemHoldMenu.itemId)}
                  className="flex items-center gap-3 px-3 py-2 text-xs font-bold text-rose-400 hover:bg-rose-500/10 rounded-xl transition-all"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete Entry
                </button>
              </>
            )}
          </div>
        </div>
      )}
      {itemHoldMenu && <div className="fixed inset-0 z-[99]" onClick={() => setItemHoldMenu(null)} />}

      {/* Folder Creation Modal */}
      {showFolderModal && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-slate-900 border border-white/10 rounded-3xl p-6 shadow-2xl">
            <h3 className="text-lg font-black text-white mb-4 flex items-center gap-2">
              <FolderPlus className="w-5 h-5 text-indigo-400" />
              Create Hub Folder
            </h3>
            <input
              type="text"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              placeholder="Folder Name (e.g. Science Fair)"
              className="w-full px-4 py-3 bg-slate-950 border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-indigo-500"
              autoFocus
            />
            <div className="flex items-center gap-3 mt-6">
              <button
                onClick={() => setShowFolderModal(false)}
                className="flex-1 px-4 py-2.5 bg-slate-800 text-slate-300 rounded-xl text-xs font-bold"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateFolder}
                className="flex-1 px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-bold shadow-lg"
              >
                Create Folder
              </button>
            </div>
          </div>
        </div>
      )}

      {viewingDoc && (
        <InAppDocumentViewer
          url={viewingDoc.url}
          title={viewingDoc.title}
          fileName={viewingDoc.fileName}
          onClose={() => setViewingDoc(null)}
          currentUser={currentUser}
          showNotification={showNotification}
        />
      )}
    </div>
  );
}
