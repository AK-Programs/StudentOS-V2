import React, { useState, useEffect, useRef } from 'react';
import { sendNotificationToUsers } from '../firebase';
import { uploadFileToStorage } from '../lib/storageHelper';
import { Plus, Trash2, Edit2, Download, FileText, Image as ImageIcon, UploadCloud } from 'lucide-react';
import { AssignmentUploadForm } from './AssignmentUploadForm';
import { getSupabaseResources, saveSupabaseResource, deleteSupabaseResource } from '../lib/supabaseResources';
import { supabase } from '../lib/supabase';

export default function SimpleResourceManager({ 
  type, title, emoji, currentUser, effectiveRole, showNotification, goBack 
}: any) {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form State
  const [fTitle, setFTitle] = useState('');
  const [fContent, setFContent] = useState('');
  const [fDueDate, setFDueDate] = useState('');
  const [fTargetGrade, setFTargetGrade] = useState('All Grades');
  const [fTargetSection, setFTargetSection] = useState('All Sections');
  const [fUrl, setFUrl] = useState<string | null>(null);
  const [fFileName, setFFileName] = useState<string>('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  
  // Additional states for gallery
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [fGalleryUrls, setFGalleryUrls] = useState<{url: string, name: string}[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const canEdit = ['teacher', 'coordinator', 'admin', 'super_admin'].includes(effectiveRole);

  useEffect(() => {
    fetchItems();

    // Subscribe to realtime material updates
    const channel = supabase.channel('materials_hub_channel');
    channel.on('broadcast', { event: 'materials_updated' }, () => {
      fetchItems();
    }).subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [type]);

  const fetchItems = async () => {
    setLoading(true);
    try {
      const tableName = type === 'assignment' ? 'assignments' : 'school_resources';
      const fetched = await getSupabaseResources(tableName);
      console.log(`[DEBUG] Fetched ${fetched.length} items from ${tableName}:`, fetched);
      
      const list: any[] = [];
      fetched.forEach(item => {
        // Match both type and resourceType for backwards/forwards compatibility
        const itemType = item.type || item.resourceType;
        if (itemType !== type) return;

        // Ensure consistent 'url' field for display
        const finalUrl = item.url || item.fileUrl || item.file_url || item.attachment_url || item.fileData;
        if (finalUrl) {
          item.url = finalUrl;
          item.fileData = finalUrl;
        }
        
        // Filter logic for students
        if (effectiveRole === 'student') {
          const itemGrade = item.targetGrade || 'All Grades';
          const itemSection = item.targetSection || 'All Sections';
          if (itemGrade !== 'All Grades' && itemGrade !== currentUser.grade) return;
          if (itemSection !== 'All Sections' && itemSection !== currentUser.section) return;
        }
        list.push(item);
      });
      
      list.sort((a,b) => {
        const tA = a.created_at || a.createdAt || 0;
        const tB = b.created_at || b.createdAt || 0;
        return Number(tB) - Number(tA);
      });
      setItems(list);
    } catch(err) {
      console.error('Failed to load items from Supabase:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (type === 'gallery') {
      const files = Array.from(e.target.files || []) as File[];
      if (files.length === 0) return;
      if (files.some(f => f.size > 200 * 1024 * 1024)) {
        showNotification('⚠️ One or more files exceed storage limit of 200 MB.');
        return;
      }
      setSelectedFiles(files);
      setFFileName(`${files.length} images selected`);
    } else {
      const file = e.target.files?.[0];
      if (!file) return;

      if (file.size > 200 * 1024 * 1024) { 
        showNotification('⚠️ File exceeds storage limit of 200 MB.');
        return;
      }
      
      setSelectedFile(file);
      setFFileName(file.name);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit) return;
    try {
      setLoading(true);
      let fileUrl = fUrl;
      let storagePath = null;
      let finalGalleryUrls = [...fGalleryUrls];

      if (type === 'gallery' && selectedFiles.length > 0) {
        showNotification(`Uploading ${selectedFiles.length} photos securely...`);
        for (const file of selectedFiles) {
          console.log("FILE OBJECT", file, file?.name, file?.size, file?.type);
          const { url, path } = await uploadFileToStorage(file, 'materials');
          finalGalleryUrls.push({ url, name: file.name });
        }
        showNotification(`✓ ${selectedFiles.length} photos uploaded successfully!`);
      } else if (selectedFile) {
        console.log("FILE OBJECT", selectedFile, selectedFile?.name, selectedFile?.size, selectedFile?.type);
        console.log("UPLOAD FUNCTION", uploadFileToStorage);
        console.log("bucket", "materials", "path", `uploads/${selectedFile.name}`, "supabaseUrl", (import.meta as any).env.VITE_SUPABASE_URL);

        const { url, path } = await uploadFileToStorage(selectedFile, 'materials');
        fileUrl = url;
        storagePath = path;
      }

      const id = editingId || `res-${Date.now()}`;
      
      const dataToSave = {
        id: id || '',
        type: type || 'resource',
        resourceType: type || 'resource',
        title: fTitle || '',
        content: fContent || '',
        description: fContent || '',
        url: fileUrl || null,
        fileUrl: fileUrl || null,
        fileData: fileUrl || null,
        storagePath: storagePath || null,
        galleryUrls: finalGalleryUrls || [],
        fileName: fFileName || null,
        dueDate: fDueDate || null,
        targetGrade: fTargetGrade || 'All Grades',
        class: fTargetGrade || 'All Grades',
        targetSection: fTargetSection || 'All Sections',
        section: fTargetSection || 'All Sections',
        createdAt: editingId ? (items.find(i => i.id === id)?.createdAt || Date.now()) : Date.now(),
        created_at: editingId ? (items.find(i => i.id === id)?.created_at || Date.now()) : Date.now(),
        author: currentUser?.name || 'Teacher'
      };

      console.log("MODULE DATA", dataToSave);

      const tableName = type === 'assignment' ? 'assignments' : 'school_resources';
      await saveSupabaseResource(tableName, dataToSave);

      if (!editingId) {
        try {
          if (type === 'notice') {
            await sendNotificationToUsers({
              title: '📢 New Notice Posted',
              message: `"${fTitle}" has been published by ${currentUser.name}.`,
              type: 'notice',
              targetGrades: fTargetGrade === 'All Grades' ? undefined : [fTargetGrade],
              targetSections: fTargetSection === 'All Sections' ? undefined : [fTargetSection]
            });
          } else if (type === 'assignment') {
            await sendNotificationToUsers({
              title: '📚 New Assignment Uploaded',
              message: `"${fTitle}" is assigned. Due: ${fDueDate || 'No deadline'}.`,
              type: 'assignment',
              targetGrades: fTargetGrade === 'All Grades' ? undefined : [fTargetGrade],
              targetSections: fTargetSection === 'All Sections' ? undefined : [fTargetSection]
            });
          } else if (type === 'worksheet') {
            await sendNotificationToUsers({
              title: '📝 New Worksheet Uploaded',
              message: `"${fTitle}" worksheet is now available.`,
              type: 'worksheet',
              targetGrades: fTargetGrade === 'All Grades' ? undefined : [fTargetGrade],
              targetSections: fTargetSection === 'All Sections' ? undefined : [fTargetSection]
            });
          } else if (type === 'timetable') {
            await sendNotificationToUsers({
              title: '📅 New Timetable Published',
              message: `"${fTitle}" timetable has been updated.`,
              type: 'timetable' as any,
              targetGrades: fTargetGrade === 'All Grades' ? undefined : [fTargetGrade],
              targetSections: fTargetSection === 'All Sections' ? undefined : [fTargetSection]
            });
          } else if (type === 'gallery') {
            await sendNotificationToUsers({
              title: '🖼️ Photo Gallery Updated',
              message: `New event photos published for "${fTitle}".`,
              type: 'gallery' as any,
              targetGrades: fTargetGrade === 'All Grades' ? undefined : [fTargetGrade],
              targetSections: fTargetSection === 'All Sections' ? undefined : [fTargetSection]
            });
          }
        } catch (notifErr) {
          console.error('Failed to dispatch notifications:', notifErr);
        }
      }

      showNotification(editingId ? 'Updated successfully!' : 'Created successfully!');
      setIsFormOpen(false);
      setSelectedFile(null);
      setSelectedFiles([]);
      fetchItems();
    } catch (err: any) {
      showNotification(`Error saving resource: ${err.message || String(err)}`);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (item: any) => {
    setFTitle(item.title);
    setFContent(item.content || '');
    setFDueDate(item.dueDate || '');
    setFUrl(item.url || item.fileData || null);
    setFFileName(item.fileName || '');
    setFTargetGrade(item.targetGrade || 'All Grades');
    setFTargetSection(item.targetSection || 'All Sections');
    setFGalleryUrls(item.galleryUrls || []);
    setEditingId(item.id);
    setSelectedFile(null);
    setSelectedFiles([]);
    setIsFormOpen(true);
  };


  const handleDelete = async (id: string) => {
    if (!confirm('Delete this item completely?')) return;
    try {
      const tableName = type === 'assignment' ? 'assignments' : 'school_resources';
      await deleteSupabaseResource(tableName, id);
      showNotification('Deleted successfully.');
      fetchItems();
    } catch(err) {
      showNotification('Error deleting item.');
      console.error(err);
    }
  };

  const renderFileIcon = (fileName: string) => {
    if (!fileName) return <FileText size={16} />;
    const ext = fileName.split('.').pop()?.toLowerCase();
    if (ext === 'pdf') return <FileText size={16} className="text-red-400" />;
    if (['jpg', 'jpeg', 'png', 'gif'].includes(ext || '')) return <ImageIcon size={16} className="text-blue-400" />;
    return <FileText size={16} className="text-slate-400" />;
  };

  return (
    <div className="space-y-6 animate-fadeIn max-w-4xl mx-auto pb-12">
      <div className="flex justify-between items-center bg-slate-900 border border-white/10 p-6 rounded-3xl">
        <div className="flex items-center gap-4">
          <div className="text-4xl">{emoji}</div>
          <div>
            <h3 className="text-2xl font-black text-white">{title}</h3>
            <p className="text-slate-400 text-xs">Manage and view {title.toLowerCase()}.</p>
          </div>
        </div>
        <div className="flex gap-2">
          {canEdit && (
            <button 
              onClick={() => { 
                setEditingId(null); 
                setFTitle(''); 
                setFContent(''); 
                setFUrl(null); 
                setFFileName(''); 
                setFDueDate(''); 
                setFTargetGrade('All Grades'); 
                setFTargetSection('All Sections'); 
                setFGalleryUrls([]); 
                setSelectedFiles([]); 
                setSelectedFile(null); 
                setIsFormOpen(true); 
              }}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2"
            >
              <Plus size={16} /> Add New
            </button>
          )}
          <button onClick={goBack} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition-all">
            Go Back
          </button>
        </div>
      </div>

      {isFormOpen && canEdit && (
        <div className="bg-slate-900 border border-indigo-500/30 p-6 rounded-2xl space-y-4">
          <div className="flex justify-between items-center mb-4">
            <h4 className="font-bold text-white text-lg">{editingId ? 'Edit (Upload New Version)' : 'Create New'}</h4>
            <button type="button" onClick={() => setIsFormOpen(false)} className="px-4 py-2 hover:bg-white/5 text-slate-300 rounded-xl text-xs font-bold">Cancel</button>
          </div>
          <AssignmentUploadForm category={type} onSuccess={() => { setIsFormOpen(false); fetchItems(); }} />
        </div>
      )}

      {loading ? (
        <div className="text-center py-10 text-slate-400">Loading...</div>
      ) : items.length === 0 ? (
        <div className="text-center py-10 bg-slate-900 border border-white/5 rounded-2xl text-slate-400">No {title.toLowerCase()} found.</div>
      ) : (
        <div className="space-y-4">
          {items.map(item => (
            <div key={item.id} className="bg-slate-900 p-5 rounded-2xl border border-white/5 flex flex-col md:flex-row gap-4 justify-between group hover:border-white/10 transition-all">
              <div className="space-y-2 flex-1">
                <div className="flex items-center gap-2">
                  <h4 className="text-lg font-bold text-white">{item.title}</h4>
                  {item.dueDate && <span className="bg-rose-500/20 text-rose-400 text-[10px] px-2 py-0.5 rounded uppercase font-bold">Due: {item.dueDate}</span>}
                  {item.targetGrade && item.targetGrade !== 'All Grades' && <span className="bg-emerald-500/20 text-emerald-400 text-[10px] px-2 py-0.5 rounded uppercase font-bold">{item.targetGrade}</span>}
                  {item.targetSection && item.targetSection !== 'All Sections' && <span className="bg-amber-500/20 text-amber-400 text-[10px] px-2 py-0.5 rounded uppercase font-bold">{item.targetSection}</span>}
                </div>
                {item.content && <p className="text-sm text-slate-300 whitespace-pre-wrap leading-relaxed">{item.content}</p>}
                
                {item.fileData && type !== 'gallery' && (
                  <div className="mt-3 inline-flex items-center gap-2 bg-slate-800/80 px-3 py-1.5 rounded-lg border border-white/5">
                    {renderFileIcon(item.fileName)}
                    <span className="text-xs text-slate-300 truncate max-w-[200px]">{item.fileName}</span>
                  </div>
                )}

                {item.galleryUrls && item.galleryUrls.length > 0 && type === 'gallery' && (
                  <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                    {item.galleryUrls.map((gObj: any, idx: number) => (
                      <a key={idx} href={gObj.url} target="_blank" rel="noreferrer" className="block relative aspect-square rounded-xl overflow-hidden hover:opacity-80 transition-opacity border border-white/10 group/gallery">
                        <img src={gObj.url} alt={gObj.name} className="object-cover w-full h-full" />
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover/gallery:opacity-100 transition-opacity flex items-center justify-center">
                           <Download size={20} className="text-white" />
                        </div>
                      </a>
                    ))}
                  </div>
                )}

                <div className="text-[10px] text-slate-500 pt-2 flex items-center gap-2">
                  <span>Author: {item.author}</span>
                  <span>•</span>
                  <span>{new Date(item.createdAt).toLocaleDateString()}</span>
                </div>

                {/* AI Presentation / Material Companion Button */}
                <div className="pt-2">
                  <button
                    onClick={async () => {
                      showNotification('🤖 Generating AI Presentation companion notes & slides...');
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
                        alert(data.text || 'Generated companion notes successfully!');
                      } catch (err: any) {
                        alert('Error: ' + err.message);
                      }
                    }}
                    className="px-3 py-1 bg-indigo-500/15 hover:bg-indigo-500/25 border border-indigo-500/30 text-indigo-300 rounded-lg text-[10px] font-bold flex items-center gap-1.5 transition-all"
                  >
                    <span>✨</span> Generate Speaker Notes & AI Quiz
                  </button>
                </div>
              </div>
              <div className="flex md:flex-col gap-2 items-end justify-center min-w-[120px]">
                {item.fileData && type !== 'gallery' && (
                  <a href={item.fileData} target="_blank" rel="noopener noreferrer" className="w-full justify-center px-3 py-2 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 rounded-lg text-xs font-bold flex items-center gap-2 transition-all">
                    <Download size={14} /> Open
                  </a>
                )}
                {canEdit && (
                  <div className="flex gap-2 md:opacity-0 group-hover:opacity-100 transition-all mt-auto pt-2">
                    <button onClick={() => handleDelete(item.id)} className="flex-1 justify-center p-2 text-rose-400 border border-rose-400/20 hover:bg-rose-400/20 rounded-lg flex items-center gap-1 text-[10px] font-bold"><Trash2 size={12}/> Del</button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
