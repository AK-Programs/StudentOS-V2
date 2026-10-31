import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { sendNotificationToUsers } from '../firebase';
import { uploadFileToStorage } from '../lib/storageHelper';
import { supabase } from '../lib/supabase';
import { 
  Plus, Trash2, FileText, Image as ImageIcon, Eye, Search, 
  ArrowLeft, Calendar, Sparkles, X, Loader2, Filter, FolderPlus,
  Edit2, Folder as FolderIcon, ChevronRight, Move, CornerDownRight,
  FolderOpen, HardDrive, Download, MoreVertical
} from 'lucide-react';
import { AssignmentUploadForm } from './AssignmentUploadForm';
import { getSupabaseResources, saveSupabaseResource, deleteSupabaseResource } from '../lib/supabaseResources';
import { InAppDocumentViewer } from './InAppDocumentViewer';
import { getFolders, Folder, createFolder, renameFolder, deleteFolder } from '../lib/supabaseFolders';
import { SkeletonList } from './ui/Skeleton';

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

  // Folder states
  const [folders, setFolders] = useState<Folder[]>([]);
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);

  // Rename folder states
  const [renameFolderModal, setRenameFolderModal] = useState<{ id: string; name: string } | null>(null);
  const [renameInput, setRenameInput] = useState('');

  // Move item dialog
  const [moveItemModal, setMoveItemModal] = useState<{ itemId: string; currentFolderId?: string | null } | null>(null);

  const [itemHoldMenu, setItemHoldMenu] = useState<{ itemId: string, x: number, y: number } | null>(null);
  const holdTimerRef = useRef<any>(null);

  const canEdit = ['teacher', 'coordinator', 'admin', 'super_admin'].includes(effectiveRole);

  useEffect(() => {
    fetchItems();
    if (currentUser?.uid) {
      getFolders(currentUser.uid, 'materials').then(setFolders).catch(err => {
        console.error('[FOLDERS] Load error:', err);
      });
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
    const trimmed = newFolderName.trim();
    if (!trimmed || !currentUser?.uid) return;
    setIsCreatingFolder(true);
    try {
      // Create folder in Supabase; do not add to state until insert returns real row
      const saved = await createFolder(trimmed, 'materials', currentUser.uid);
      if (saved && saved.id) {
        setFolders(prev => [saved, ...prev]);
        setNewFolderName('');
        setShowFolderModal(false);
        showNotification('📁 Folder created and synced to Supabase!');
      } else {
        throw new Error('Supabase did not return a valid folder ID.');
      }
    } catch (err: any) {
      console.error('[FOLDERS] Creation failed:', err);
      showNotification(`⚠️ Failed to create folder: ${err.message || 'Database error'}`);
    } finally {
      setIsCreatingFolder(false);
    }
  };

  const handleRenameFolderSubmit = async () => {
    if (!renameFolderModal || !renameInput.trim()) return;
    try {
      await renameFolder(renameFolderModal.id, renameInput.trim());
      setFolders(prev => prev.map(f => f.id === renameFolderModal.id ? { ...f, name: renameInput.trim() } : f));
      showNotification('✓ Folder renamed');
      setRenameFolderModal(null);
      setRenameInput('');
    } catch (err: any) {
      showNotification(`⚠️ Failed to rename folder: ${err.message || 'Error'}`);
    }
  };

  const handleDeleteFolderSubmit = async (folderId: string, folderName: string) => {
    if (!confirm(`Delete folder "${folderName}"? Items inside will be moved to Root.`)) return;
    try {
      await deleteFolder(folderId);
      setFolders(prev => prev.filter(f => f.id !== folderId));
      if (activeFolderId === folderId) setActiveFolderId(null);
      showNotification('🗑️ Folder deleted');
      fetchItems();
    } catch (err: any) {
      showNotification(`⚠️ Failed to delete folder: ${err.message || 'Error'}`);
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

  const handleMoveToFolder = async (itemId: string, targetFolderId: string | null) => {
    if (targetFolderId) {
      const targetFolder = folders.find(f => f.id === targetFolderId);
      if (targetFolder && targetFolder.type !== 'materials') {
        showNotification('⚠️ Material Hub items can only be moved into Material Hub folders.');
        setItemHoldMenu(null);
        setMoveItemModal(null);
        return;
      }
    }
    const tableName = type === 'assignment' ? 'assignments' : 'school_resources';
    try {
      // 1. Update in Supabase
      const { error } = await supabase.from(tableName).update({ folder_id: targetFolderId }).eq('id', itemId);
      if (error && error.code !== '42P01') {
        showNotification(`⚠️ Move error: ${error.message}`);
        return;
      }

      // 2. Update in local state
      setItems(prev => prev.map(item => item.id === itemId ? { ...item, folder_id: targetFolderId } : item));
      showNotification(targetFolderId ? '📁 Item moved into folder' : '📂 Item moved to root');
    } catch (err: any) {
      showNotification(`⚠️ Move failed: ${err.message}`);
    } finally {
      setItemHoldMenu(null);
      setMoveItemModal(null);
    }
  };

  const renderFileIcon = (fileName: string) => {
    if (!fileName) return <FileText size={18} className="text-indigo-400" />;
    const ext = fileName.split('.').pop()?.toLowerCase();
    if (ext === 'pdf') return <FileText size={18} className="text-rose-400" />;
    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext || '')) return <ImageIcon size={18} className="text-cyan-400" />;
    return <FileText size={18} className="text-indigo-400" />;
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

  const activeFolder = useMemo(() => {
    return folders.find(f => f.id === activeFolderId);
  }, [folders, activeFolderId]);

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

  // Items currently displayed based on folder context
  const currentViewItems = useMemo(() => {
    return filteredItems.filter(item => {
      if (activeFolderId) {
        return item.folder_id === activeFolderId;
      }
      // When at root, show items that have no folder or folder_id is null
      return !item.folder_id;
    });
  }, [filteredItems, activeFolderId]);

  return (
    <div className="space-y-4 max-w-5xl mx-auto pb-12 font-sans">
      {/* Header Bar */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="bento-card p-4 sm:p-5 rounded-3xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md"
      >
        <div className="flex items-center gap-3">
          <button
            onClick={goBack}
            className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-white/10 text-slate-300 hover:text-white transition-colors cursor-pointer shrink-0"
            title="Back to Assignment Center"
          >
            <ArrowLeft size={16} />
          </button>
          <div>
            <div className="flex items-center gap-2 text-[11px] text-indigo-400 font-bold uppercase tracking-wider">
              <span>{emoji || '📚'} Material Hub</span>
              <span aria-hidden="true">·</span>
              <span>{items.length} {items.length === 1 ? 'file' : 'files'}</span>
            </div>
            <h3 className="text-lg sm:text-xl font-black text-white font-display tracking-tight leading-tight">
              {title}
            </h3>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setShowFolderModal(true)}
            className="px-3 py-2 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 hover:text-white text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer shadow-sm"
            title="Create New Hub Folder"
          >
            <FolderPlus size={14} className="text-amber-400" />
            <span>New Folder</span>
          </button>

          {canEdit && (
            <button 
              onClick={() => { 
                setEditingId(null); 
                setIsFormOpen(prev => !prev); 
              }}
              className="uiverse-btn-primary px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
            >
              <Plus size={14} />
              <span>{isFormOpen ? 'Close' : `Publish ${title}`}</span>
            </button>
          )}
        </div>
      </motion.div>

      {/* Compact Filters UI Component */}
      <div className="flex flex-col sm:flex-row items-center gap-2 p-1.5 bg-slate-900/80 border border-white/10 rounded-2xl text-xs">
        <div className="relative flex-1 w-full">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={`Search ${title.toLowerCase()}...`}
            className="w-full pl-8 pr-3 py-1.5 bg-transparent text-xs text-white placeholder:text-slate-500 focus:outline-none"
          />
        </div>
        {effectiveRole !== 'student' && (
          <div className="flex items-center gap-1 px-2 border-t sm:border-t-0 sm:border-l border-white/10 pt-1 sm:pt-0 w-full sm:w-auto">
            <Filter className="w-3 h-3 text-slate-400 shrink-0" />
            <select
              value={selectedGradeFilter}
              onChange={(e) => setSelectedGradeFilter(e.target.value)}
              className="bg-slate-950 border border-white/10 rounded-lg px-2 py-1 text-[11px] text-slate-200 font-semibold focus:outline-none"
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

      {/* Folder Navigation Button & Breadcrumbs Bar Below Filters */}
      <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 bg-slate-950/70 border border-white/10 rounded-2xl">
        {/* Windows / Android File Manager Breadcrumbs */}
        <div className="flex items-center gap-1.5 text-xs font-bold text-slate-300 overflow-x-auto scrollbar-none no-scrollbar">
          <button
            onClick={() => setActiveFolderId(null)}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg transition-all ${!activeFolderId ? 'bg-indigo-600 text-white shadow' : 'hover:bg-white/10 text-slate-400 hover:text-white'}`}
          >
            <HardDrive size={13} className="text-indigo-300" />
            <span>Root / All</span>
          </button>

          {activeFolder && (
            <>
              <ChevronRight size={13} className="text-slate-600" />
              <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/30">
                <FolderOpen size={13} className="text-amber-400" />
                <span className="truncate max-w-[150px]">{activeFolder.name}</span>
              </div>
            </>
          )}
        </div>

        {/* Back and Action Buttons */}
        <div className="flex items-center gap-1.5">
          {activeFolderId && (
            <button
              onClick={() => setActiveFolderId(null)}
              className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white text-[11px] font-bold flex items-center gap-1 transition-all"
            >
              <ArrowLeft size={12} />
              <span>Up to Root</span>
            </button>
          )}

          <button
            onClick={() => setShowFolderModal(true)}
            className="px-2.5 py-1 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 text-[11px] font-bold flex items-center gap-1 transition-all border border-indigo-500/20"
          >
            <FolderPlus size={12} />
            <span>+ Folder ({folders.length})</span>
          </button>
        </div>
      </div>

      {/* Windows / Android-Like File Manager: Folders Cards Grid (shown at Root level) */}
      {!activeFolderId && folders.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <span className="text-[11px] font-black uppercase text-slate-400 tracking-wider flex items-center gap-1.5">
              <FolderIcon className="w-3.5 h-3.5 text-amber-400" />
              <span>Folders ({folders.length})</span>
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
            {folders.map(f => {
              const fileCount = items.filter(i => i.folder_id === f.id).length;
              return (
                <div
                  key={f.id}
                  onClick={() => setActiveFolderId(f.id)}
                  className="p-3.5 rounded-2xl bg-slate-900/90 hover:bg-slate-850 border border-white/10 hover:border-amber-500/40 transition-all cursor-pointer group flex flex-col justify-between space-y-2.5 shadow-sm active:scale-[0.99]"
                >
                  <div className="flex items-start justify-between gap-1.5">
                    <div className="p-2 rounded-xl bg-amber-500/15 text-amber-400 group-hover:bg-amber-500 group-hover:text-slate-950 transition-colors">
                      <FolderIcon size={20} fill="currentColor" fillOpacity={0.2} />
                    </div>

                    <div className="flex items-center gap-1 opacity-60 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                      <button
                        onClick={() => {
                          setRenameFolderModal({ id: f.id, name: f.name });
                          setRenameInput(f.name);
                        }}
                        className="p-1 hover:bg-white/10 rounded text-slate-400 hover:text-white"
                        title="Rename Folder"
                      >
                        <Edit2 size={12} />
                      </button>
                      <button
                        onClick={() => handleDeleteFolderSubmit(f.id, f.name)}
                        className="p-1 hover:bg-rose-500/20 rounded text-slate-400 hover:text-rose-400"
                        title="Delete Folder"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>

                  <div>
                    <p className="text-xs font-bold text-white group-hover:text-amber-300 truncate">{f.name}</p>
                    <p className="text-[10px] text-slate-400">{fileCount} {fileCount === 1 ? 'file' : 'files'}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Files Section Header */}
      <div className="flex items-center justify-between px-1 pt-1">
        <span className="text-[11px] font-black uppercase text-slate-400 tracking-wider flex items-center gap-1.5">
          <FileText className="w-3.5 h-3.5 text-indigo-400" />
          <span>{activeFolder ? `Files in "${activeFolder.name}"` : 'Files at Root'} ({currentViewItems.length})</span>
        </span>
      </div>

      {/* Upload Form Drawer */}
      <AnimatePresence>
        {isFormOpen && canEdit && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="bento-card border-indigo-500/30 p-5 rounded-3xl space-y-3"
          >
            <div className="flex justify-between items-center border-b border-white/10 pb-2.5">
              <div>
                <h4 className="font-bold text-white text-sm">{editingId ? 'Update Resource' : `Publish New ${title}`}</h4>
                <p className="text-[11px] text-slate-400">
                  {activeFolder ? `Saving directly into folder "${activeFolder.name}"` : 'Attach documents, worksheets, or PDFs.'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                className="p-1.5 hover:bg-white/5 text-slate-400 hover:text-white rounded-xl"
              >
                <X size={15} />
              </button>
            </div>
            <AssignmentUploadForm category={type} folderId={activeFolderId} onSuccess={() => { setIsFormOpen(false); fetchItems(); }} />
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
            className="bento-card border-indigo-500/30 p-5 rounded-3xl space-y-2.5"
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-2">
              <div className="flex items-center gap-2 text-indigo-300 font-bold text-xs">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Study Companion Notes — {aiCompanionOutput.title}</span>
              </div>
              <button
                onClick={() => setAiCompanionOutput(null)}
                className="p-1 text-slate-400 hover:text-white rounded-lg"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="text-xs text-slate-200 whitespace-pre-wrap leading-relaxed max-h-72 overflow-y-auto pr-1">
              {aiCompanionOutput.text}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* List Content: Windows/Android File Manager Row List */}
      {loading ? (
        <SkeletonList count={5} />
      ) : currentViewItems.length === 0 ? (
        <div className="bento-card text-center py-10 px-4 rounded-3xl space-y-2">
          <div className="p-3 w-12 h-12 mx-auto rounded-2xl bg-white/5 flex items-center justify-center text-slate-400">
            {activeFolder ? <FolderOpen size={24} className="text-amber-400" /> : <FileText size={24} />}
          </div>
          <p className="text-xs font-bold text-white">
            {activeFolder ? `Folder "${activeFolder.name}" is empty` : `No files found at Root`}
          </p>
          <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
            {activeFolder 
              ? 'Move files here by tapping "Move" on any file card, or publish new resources directly.'
              : 'Create a folder or publish resources to populate your Hub.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {currentViewItems.map((item, idx) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.15, delay: Math.min(idx * 0.02, 0.15) }}
              className="bento-card p-4 rounded-2xl flex flex-col md:flex-row gap-3 justify-between group relative hover:border-indigo-500/30 transition-all shadow-sm"
              onMouseDown={(e) => handleLongPress(e, item.id)}
              onMouseUp={cancelHold}
              onMouseLeave={cancelHold}
              onTouchStart={(e) => handleLongPress(e, item.id)}
              onTouchEnd={cancelHold}
            >
              <div className="space-y-1.5 flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-slate-400">
                  <span className="font-bold text-indigo-400 bg-indigo-500/10 px-1.5 py-0.5 rounded">
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
                        <Calendar className="w-2.5 h-2.5" /> Due {item.dueDate}
                      </span>
                    </>
                  )}
                  <span aria-hidden="true">·</span>
                  <span>By {item.author || 'Faculty'}</span>
                </div>

                <div className="flex items-center gap-2">
                  {renderFileIcon(item.fileName)}
                  <h4 className="text-sm sm:text-base font-bold text-white truncate">{item.title}</h4>
                </div>

                {item.content && (
                  <p className="text-xs text-slate-300 line-clamp-2 leading-relaxed">
                    {item.content}
                  </p>
                )}
                
                {item.fileData && type !== 'gallery' && (
                  <div 
                    onClick={() => setViewingDoc({ url: item.fileData, title: item.title, fileName: item.fileName })}
                    className="inline-flex items-center gap-1.5 bg-slate-950/80 hover:bg-slate-900 px-2.5 py-1.5 rounded-lg border border-white/10 cursor-pointer transition-colors text-xs"
                  >
                    <span className="text-[11px] text-slate-200 font-medium truncate max-w-[200px]">{item.fileName || 'Document'}</span>
                    <span className="text-[10px] text-indigo-400 font-bold ml-1">Open →</span>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center md:flex-col gap-1.5 justify-end shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-white/5">
                <button
                  onClick={() => setMoveItemModal({ itemId: item.id, currentFolderId: item.folder_id })}
                  className="px-2.5 py-1.5 bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white rounded-lg text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer border border-white/5"
                  title="Move to Folder"
                >
                  <Move size={12} className="text-indigo-400" />
                  <span>Move</span>
                </button>

                {item.fileData && type !== 'gallery' && (
                  <button
                    onClick={() => setViewingDoc({ url: item.fileData, title: item.title, fileName: item.fileName })}
                    className="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    <Eye size={12} />
                    <span>View</span>
                  </button>
                )}

                {canEdit && (
                  <button
                    onClick={() => handleDelete(item.id)}
                    className="p-1.5 text-rose-400 hover:bg-rose-500/15 rounded-lg transition-colors cursor-pointer"
                    title="Delete item"
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Move to Folder Modal Dialog */}
      {moveItemModal && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-slate-900 border border-white/10 rounded-3xl p-5 shadow-2xl space-y-3.5 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
              <h4 className="text-sm font-black text-white flex items-center gap-2">
                <Move className="w-4 h-4 text-indigo-400" />
                <span>Move to Material Hub Folder</span>
              </h4>
              <button onClick={() => setMoveItemModal(null)} className="p-1 text-slate-400 hover:text-white">
                <X size={15} />
              </button>
            </div>

            <p className="text-xs text-slate-400">Choose destination folder for this resource:</p>

            <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
              <button
                onClick={() => handleMoveToFolder(moveItemModal.itemId, null)}
                className={`w-full text-left p-2.5 rounded-xl border flex items-center justify-between text-xs font-bold transition-all ${!moveItemModal.currentFolderId ? 'bg-indigo-600/20 border-indigo-500/40 text-white' : 'border-white/5 bg-slate-950/40 hover:bg-white/5 text-slate-300'}`}
              >
                <div className="flex items-center gap-2">
                  <HardDrive size={15} className="text-slate-400" />
                  <span>Root (No Folder)</span>
                </div>
                {!moveItemModal.currentFolderId && <span className="text-[10px] text-indigo-400 font-extrabold">Current</span>}
              </button>

              {folders.map(f => {
                const isSelected = moveItemModal.currentFolderId === f.id;
                return (
                  <button
                    key={f.id}
                    onClick={() => handleMoveToFolder(moveItemModal.itemId, f.id)}
                    className={`w-full text-left p-2.5 rounded-xl border flex items-center justify-between text-xs font-bold transition-all ${isSelected ? 'bg-amber-500/20 border-amber-500/40 text-white' : 'border-white/5 bg-slate-950/40 hover:bg-white/5 text-slate-300'}`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <FolderIcon size={15} className="text-amber-400 shrink-0" />
                      <span className="truncate">{f.name}</span>
                    </div>
                    {isSelected && <span className="text-[10px] text-amber-400 font-extrabold shrink-0">Current</span>}
                  </button>
                );
              })}
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setMoveItemModal(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Item Hold Menu */}
      {itemHoldMenu && (
        <div 
          className="fixed z-[100] w-52 bg-slate-900/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl p-2 animate-in fade-in zoom-in duration-150"
          style={{ left: Math.min(window.innerWidth - 220, itemHoldMenu.x), top: Math.min(window.innerHeight - 320, itemHoldMenu.y) }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex flex-col gap-1">
            <div className="px-3 py-1 text-[9px] font-black text-slate-500 uppercase tracking-wider">Move to Folder</div>
            <button
              onClick={() => handleMoveToFolder(itemHoldMenu.itemId, null)}
              className="flex items-center gap-2.5 px-3 py-2 text-xs font-bold text-slate-200 hover:bg-white/5 rounded-xl transition-all"
            >
              <HardDrive className="w-3.5 h-3.5 text-slate-400" />
              Root
            </button>
            {folders.map(f => (
              <button
                key={f.id}
                onClick={() => handleMoveToFolder(itemHoldMenu.itemId, f.id)}
                className="flex items-center gap-2.5 px-3 py-2 text-xs font-bold text-slate-200 hover:bg-white/5 rounded-xl transition-all"
              >
                <FolderIcon className="w-3.5 h-3.5 text-amber-400" />
                <span className="truncate">{f.name}</span>
              </button>
            ))}
            {canEdit && (
              <>
                <div className="h-px bg-white/5 my-1" />
                <button
                  onClick={() => handleDelete(itemHoldMenu.itemId)}
                  className="flex items-center gap-2.5 px-3 py-2 text-xs font-bold text-rose-400 hover:bg-rose-500/10 rounded-xl transition-all"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete Resource
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
          <div className="w-full max-w-sm bg-slate-900 border border-white/10 rounded-3xl p-5 shadow-2xl space-y-3.5">
            <h3 className="text-base font-black text-white flex items-center gap-2">
              <FolderPlus className="w-5 h-5 text-amber-400" />
              <span>Create Material Hub Folder</span>
            </h3>
            <p className="text-xs text-slate-400">Folders help organize syllabus documents, revision sheets, and past question papers.</p>
            <input
              type="text"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              placeholder="e.g. Physics Formulae & Lab Sheets"
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-white/10 rounded-xl text-white text-xs focus:outline-none focus:border-indigo-500"
              autoFocus
              disabled={isCreatingFolder}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreateFolder();
              }}
            />
            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={() => setShowFolderModal(false)}
                disabled={isCreatingFolder}
                className="flex-1 px-3 py-2 bg-slate-800 text-slate-300 rounded-xl text-xs font-bold"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateFolder}
                disabled={isCreatingFolder || !newFolderName.trim()}
                className="flex-1 px-3 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold shadow-lg hover:bg-indigo-500 transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {isCreatingFolder ? (
                  <>
                    <Loader2 size={13} className="animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <span>Create Folder</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rename Folder Modal */}
      {renameFolderModal && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-slate-900 border border-white/10 rounded-3xl p-5 shadow-2xl space-y-3.5">
            <h3 className="text-base font-black text-white flex items-center gap-2">
              <Edit2 className="w-4 h-4 text-amber-400" />
              <span>Rename Folder</span>
            </h3>
            <input
              type="text"
              value={renameInput}
              onChange={(e) => setRenameInput(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-white/10 rounded-xl text-white text-xs focus:outline-none focus:border-indigo-500"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleRenameFolderSubmit();
              }}
            />
            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={() => setRenameFolderModal(null)}
                className="flex-1 px-3 py-2 bg-slate-800 text-slate-300 rounded-xl text-xs font-bold"
              >
                Cancel
              </button>
              <button
                onClick={handleRenameFolderSubmit}
                className="flex-1 px-3 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold shadow-lg hover:bg-indigo-500 transition-colors"
              >
                Save
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
