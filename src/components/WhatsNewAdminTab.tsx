/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  Plus, Edit, Trash2, Calendar, Clock, Eye, Send, CheckCircle, 
  AlertTriangle, Archive, RefreshCw, X, Upload, ExternalLink,
  Shield, Check, Search, Filter, History, Sparkles, Layers,
  ChevronRight, ArrowLeft
} from 'lucide-react';
import { 
  SystemUpdate, 
  SystemUpdateCategory, 
  SystemUpdateStatus, 
  SystemUpdateAuditLog,
  UserProfile, 
  UserRole 
} from '../types';
import { 
  getAllUpdatesForSuperAdmin, 
  saveSystemUpdate, 
  deleteSystemUpdate,
  fetchAuditLogs 
} from '../lib/supabaseUpdates';
import { uploadFileToStorage } from '../lib/storageHelper';
import { CATEGORY_CONFIG, renderMarkdownContent } from './WhatsNewPortal';

interface WhatsNewAdminTabProps {
  currentUser: UserProfile;
  showNotification: (msg: string) => void;
  onClose?: () => void;
}

const AVAILABLE_ROLES: { role: UserRole | 'all'; label: string }[] = [
  { role: 'all', label: 'Everyone (All Roles)' },
  { role: 'student', label: 'Students' },
  { role: 'teacher', label: 'Teachers' },
  { role: 'coordinator', label: 'Academic Coordinators' },
  { role: 'admin', label: 'School Administrators' },
  { role: 'super_admin', label: 'Super Admins' }
];

const QUICK_INTERNAL_TABS = [
  { tab: 'meet', label: 'StudentOS Meet (Virtual Classroom)' },
  { tab: 'gradebook', label: 'Digital Gradebook' },
  { tab: 'materials', label: 'Materials Hub' },
  { tab: 'assignments', label: 'Assignment Center' },
  { tab: 'calendar', label: 'Academic Calendar' },
  { tab: 'whiteboard', label: 'Drawing Board' },
  { tab: 'tasks', label: 'Task Manager' },
  { tab: 'ai_teacher', label: 'Campus AI Agent' },
  { tab: 'blogs', label: 'Educational Blogs' },
  { tab: 'houses', label: 'House Standings' }
];

export function WhatsNewAdminTab({
  currentUser,
  showNotification,
  onClose
}: WhatsNewAdminTabProps) {
  const [updates, setUpdates] = useState<SystemUpdate[]>([]);
  const [auditLogs, setAuditLogs] = useState<SystemUpdateAuditLog[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [statusFilter, setStatusFilter] = useState<'all' | SystemUpdateStatus | 'audit'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Editor states
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [previewModalOpen, setPreviewModalOpen] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [uploadingImage, setUploadingImage] = useState<boolean>(false);

  // Form Fields
  const [editId, setEditId] = useState<string | null>(null);
  const [formVersion, setFormVersion] = useState<string>('v3.13.0');
  const [formTitle, setFormTitle] = useState<string>('');
  const [formSummary, setFormSummary] = useState<string>('');
  const [formCategory, setFormCategory] = useState<SystemUpdateCategory>('feature');
  const [formContent, setFormContent] = useState<string>('');
  const [formAudience, setFormAudience] = useState<(UserRole | 'all')[]>(['all']);
  const [formIsMajor, setFormIsMajor] = useState<boolean>(false);
  const [formActionUrl, setFormActionUrl] = useState<string>('');
  const [formActionLabel, setFormActionLabel] = useState<string>('');
  const [formMediaUrls, setFormMediaUrls] = useState<string[]>([]);
  const [customMediaInput, setCustomMediaInput] = useState<string>('');
  
  // Scheduling States
  const [scheduleDate, setScheduleDate] = useState<string>('');
  const [scheduleTime, setScheduleTime] = useState<string>('18:00');
  const [isScheduling, setIsScheduling] = useState<boolean>(false);

  // Local Timezone info
  const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  const tzOffset = -new Date().getTimezoneOffset() / 60;
  const tzDisplay = `${userTimezone} (UTC${tzOffset >= 0 ? '+' : ''}${tzOffset})`;

  const loadData = async () => {
    setLoading(true);
    try {
      const [list, logs] = await Promise.all([
        getAllUpdatesForSuperAdmin(),
        fetchAuditLogs()
      ]);
      setUpdates(list);
      setAuditLogs(logs);
    } catch (err: any) {
      console.error('Error fetching admin updates:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const resetForm = () => {
    setEditId(null);
    setFormVersion('v3.13.0');
    setFormTitle('');
    setFormSummary('');
    setFormCategory('feature');
    setFormContent(`### 🚀 Summary of Changes\n\n- **Key Highlight 1**: Describe the main capability added.\n- **Key Highlight 2**: Detail performance or UI upgrade.\n\n#### 📌 Instructions for Students & Faculty\nExplain how to navigate to the feature.\n`);
    setFormAudience(['all']);
    setFormIsMajor(false);
    setFormActionUrl('');
    setFormActionLabel('');
    setFormMediaUrls([]);
    setCustomMediaInput('');
    setScheduleDate('');
    setScheduleTime('18:00');
    setIsScheduling(false);
  };

  const handleStartCreate = () => {
    resetForm();
    setIsEditing(true);
  };

  const handleStartEdit = (u: SystemUpdate) => {
    setEditId(u.id);
    setFormVersion(u.version);
    setFormTitle(u.title);
    setFormSummary(u.summary);
    setFormCategory(u.category);
    setFormContent(u.content);
    setFormAudience(u.audienceRoles || ['all']);
    setFormIsMajor(Boolean(u.isMajorRelease));
    setFormActionUrl(u.actionUrl || '');
    setFormActionLabel(u.actionLabel || '');
    setFormMediaUrls(u.mediaUrls || []);
    setCustomMediaInput('');

    if (u.status === 'scheduled' && u.scheduledPublishAt) {
      setIsScheduling(true);
      const d = new Date(u.scheduledPublishAt);
      setScheduleDate(d.toISOString().split('T')[0]);
      setScheduleTime(d.toTimeString().substring(0, 5));
    } else {
      setIsScheduling(false);
      setScheduleDate('');
      setScheduleTime('18:00');
    }

    setIsEditing(true);
  };

  // Image file upload
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingImage(true);
    try {
      showNotification('Uploading screenshot to Supabase Storage...');
      const result = await uploadFileToStorage(file, 'system-updates');
      setFormMediaUrls(prev => [...prev, result.url]);
      showNotification('✅ Screenshot uploaded successfully!');
    } catch (err: any) {
      showNotification(`Upload failed: ${err.message}`);
    } finally {
      setUploadingImage(false);
      e.target.value = '';
    }
  };

  const handleAddMediaUrl = () => {
    if (!customMediaInput.trim()) return;
    setFormMediaUrls(prev => [...prev, customMediaInput.trim()]);
    setCustomMediaInput('');
  };

  const handleRemoveMediaUrl = (idx: number) => {
    setFormMediaUrls(prev => prev.filter((_, i) => i !== idx));
  };

  const toggleAudienceRole = (role: UserRole | 'all') => {
    if (role === 'all') {
      setFormAudience(['all']);
      return;
    }
    const current = formAudience.filter(r => r !== 'all');
    if (current.includes(role)) {
      const next = current.filter(r => r !== role);
      setFormAudience(next.length === 0 ? ['all'] : next);
    } else {
      setFormAudience([...current, role]);
    }
  };

  // Compile current update object for saving or preview
  const buildCurrentUpdateObject = (targetStatus: SystemUpdateStatus): SystemUpdate => {
    const nowIso = new Date().toISOString();
    let scheduledIso: string | undefined = undefined;
    let publishedIso: string | undefined = undefined;

    if (targetStatus === 'scheduled') {
      if (scheduleDate && scheduleTime) {
        scheduledIso = new Date(`${scheduleDate}T${scheduleTime}`).toISOString();
      } else {
        scheduledIso = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      }
    } else if (targetStatus === 'published') {
      publishedIso = nowIso;
    }

    const existing = updates.find(u => u.id === editId);

    return {
      id: editId || `update-${Date.now()}`,
      version: formVersion.trim() || 'v1.0.0',
      title: formTitle.trim() || 'Untitled Release',
      summary: formSummary.trim(),
      category: formCategory,
      content: formContent.trim(),
      status: targetStatus,
      audienceRoles: formAudience,
      isMajorRelease: formIsMajor,
      actionUrl: formActionUrl.trim() || undefined,
      actionLabel: formActionLabel.trim() || undefined,
      mediaUrls: formMediaUrls,
      authorId: currentUser.uid || currentUser.email || 'super_admin',
      authorName: currentUser.name || 'Super Administrator',
      authorRole: 'super_admin',
      scheduledPublishAt: scheduledIso,
      publishedAt: publishedIso || existing?.publishedAt,
      archivedAt: targetStatus === 'archived' ? nowIso : undefined,
      createdAt: existing?.createdAt || nowIso,
      updatedAt: nowIso
    };
  };

  const handleSave = async (targetStatus: SystemUpdateStatus) => {
    if (!formTitle.trim()) {
      showNotification('❌ Please enter a title for the update.');
      return;
    }
    if (!formVersion.trim()) {
      showNotification('❌ Please enter a version tag (e.g. v3.13.0).');
      return;
    }

    if (targetStatus === 'scheduled') {
      if (!scheduleDate || !scheduleTime) {
        showNotification('❌ Please select a scheduled date and time.');
        return;
      }
      const scheduledTimeMs = new Date(`${scheduleDate}T${scheduleTime}`).getTime();
      if (scheduledTimeMs <= Date.now()) {
        showNotification('❌ Scheduled time must be in the future.');
        return;
      }
    }

    setSaving(true);
    try {
      const updateObj = buildCurrentUpdateObject(targetStatus);
      await saveSystemUpdate(updateObj, {
        id: currentUser.uid || 'super_admin',
        name: currentUser.name || 'Super Admin',
        role: currentUser.role
      });

      showNotification(`✓ Release Note ${updateObj.version} saved as ${targetStatus.toUpperCase()}!`);
      setIsEditing(false);
      resetForm();
      await loadData();
    } catch (err: any) {
      showNotification(`Failed to save update: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (updateId: string) => {
    if (!confirm('Are you sure you want to permanently delete this update entry?')) return;
    try {
      await deleteSystemUpdate(updateId, {
        id: currentUser.uid || 'super_admin',
        name: currentUser.name || 'Super Admin',
        role: currentUser.role
      });
      showNotification('Update note deleted.');
      await loadData();
    } catch (err: any) {
      showNotification(`Delete failed: ${err.message}`);
    }
  };

  const handleQuickStatusChange = async (update: SystemUpdate, newStatus: SystemUpdateStatus) => {
    const updated: SystemUpdate = {
      ...update,
      status: newStatus,
      publishedAt: newStatus === 'published' ? new Date().toISOString() : update.publishedAt,
      archivedAt: newStatus === 'archived' ? new Date().toISOString() : undefined,
      scheduledPublishAt: newStatus === 'scheduled' ? update.scheduledPublishAt : undefined,
      updatedAt: new Date().toISOString()
    };
    await saveSystemUpdate(updated, {
      id: currentUser.uid || 'super_admin',
      name: currentUser.name || 'Super Admin',
      role: currentUser.role
    });
    showNotification(`Status updated to ${newStatus.toUpperCase()}`);
    await loadData();
  };

  // Filter updates
  const filteredUpdates = updates.filter(u => {
    if (statusFilter !== 'all' && statusFilter !== 'audit' && u.status !== statusFilter) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return u.title.toLowerCase().includes(q) || u.version.toLowerCase().includes(q) || u.summary.toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <div className="space-y-6 animate-fadeIn text-slate-100 max-w-6xl mx-auto">
      
      {/* Live Preview Modal */}
      {previewModalOpen && (
        <div 
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 overflow-y-auto"
          onClick={() => setPreviewModalOpen(false)}
        >
          <div 
            className="bg-slate-900 border border-indigo-500/30 rounded-3xl p-6 sm:p-8 max-w-3xl w-full max-h-[90vh] overflow-y-auto space-y-6 shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-white/5 pb-3">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 rounded-full bg-indigo-500/20 text-indigo-400 font-mono text-[10px] font-black uppercase">
                  🔍 Live Preview Mode
                </span>
                <span className="text-xs text-slate-400">This simulates how standard users will see this release note.</span>
              </div>
              <button 
                onClick={() => setPreviewModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Simulated Card */}
            {(() => {
              const previewObj = buildCurrentUpdateObject('published');
              const cat = CATEGORY_CONFIG[previewObj.category];
              return (
                <div className="rounded-3xl border border-white/10 bg-slate-950 p-6 sm:p-8 space-y-5 shadow-2xl">
                  <div className="flex items-center justify-between gap-3 border-b border-white/5 pb-4">
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="px-3 py-1 rounded-xl bg-white/10 text-white font-mono font-black text-sm">
                          {previewObj.version}
                        </span>
                        <span className={`px-2.5 py-0.5 rounded-xl border text-[11px] font-bold flex items-center gap-1.5 ${cat.badgeBg} ${cat.badgeText} ${cat.border}`}>
                          <span>{cat.icon}</span>
                          <span>{cat.label}</span>
                        </span>
                        {previewObj.isMajorRelease && (
                          <span className="px-2 py-0.5 rounded-xl bg-purple-500/20 text-purple-300 border border-purple-500/30 text-[10px] font-black uppercase">
                            🌟 Major Release
                          </span>
                        )}
                      </div>
                      <h2 className="text-xl sm:text-2xl font-black text-white font-display">
                        {previewObj.title || 'Untitled Update'}
                      </h2>
                    </div>
                  </div>

                  {previewObj.summary && (
                    <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/5 text-xs sm:text-sm text-slate-300">
                      💡 {previewObj.summary}
                    </div>
                  )}

                  <div className="prose prose-invert max-w-none">
                    {renderMarkdownContent(previewObj.content)}
                  </div>

                  {previewObj.mediaUrls && previewObj.mediaUrls.length > 0 && (
                    <div className="grid grid-cols-2 gap-3 pt-2">
                      {previewObj.mediaUrls.map((url, i) => (
                        <img key={i} src={url} alt="preview" className="rounded-xl aspect-video object-cover border border-white/10" />
                      ))}
                    </div>
                  )}

                  {previewObj.actionUrl && (
                    <div className="pt-4 border-t border-white/5 flex justify-end">
                      <div className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold flex items-center gap-2">
                        <span>{previewObj.actionLabel || `Explore ${previewObj.actionUrl.toUpperCase()}`}</span>
                        <ChevronRight className="w-4 h-4" />
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setPreviewModalOpen(false)}
                className="px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-500"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/5 pb-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 text-[10px] font-black uppercase tracking-wider">
              Super Admin clearance
            </span>
            <span className="text-xs text-slate-400 font-mono">Timezone: {tzDisplay}</span>
          </div>
          <h3 className="text-2xl font-black font-display text-white">What's New & Release Notes Manager</h3>
          <p className="text-xs text-slate-400">Author official release updates, schedule future releases, target roles, and manage audit logs.</p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {onClose && (
            <button
              onClick={onClose}
              className="px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-bold"
            >
              Back
            </button>
          )}

          {!isEditing && (
            <button
              onClick={handleStartCreate}
              className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black shadow-lg shadow-indigo-600/30 flex items-center gap-2 cursor-pointer active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>Create Release Note</span>
            </button>
          )}
        </div>
      </div>

      {/* ===================== EDITOR FORM ===================== */}
      {isEditing ? (
        <div className="bg-slate-900/90 border border-indigo-500/25 rounded-3xl p-6 sm:p-8 space-y-6 shadow-2xl backdrop-blur-xl">
          <div className="flex items-center justify-between border-b border-white/5 pb-4">
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setIsEditing(false)}
                className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <h4 className="text-lg font-black text-white font-display">
                {editId ? 'Edit Release Note' : 'Draft New Release Note'}
              </h4>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPreviewModalOpen(true)}
                className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-slate-200 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <Eye className="w-3.5 h-3.5 text-indigo-400" />
                <span>Live Preview</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Version */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wider font-mono">
                Version Tag *
              </label>
              <input
                type="text"
                value={formVersion}
                onChange={(e) => setFormVersion(e.target.value)}
                placeholder="e.g. v3.13.0"
                className="w-full bg-slate-950 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white font-mono font-bold focus:border-indigo-500 focus:outline-none"
              />
              <div className="flex gap-1.5 pt-1">
                {['v3.12.1', 'v3.13.0', 'v4.0.0'].map(v => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setFormVersion(v)}
                    className="px-2 py-0.5 bg-white/5 hover:bg-white/10 text-[10px] rounded text-slate-400 font-mono"
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>

            {/* Category */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wider font-mono">
                Category *
              </label>
              <select
                value={formCategory}
                onChange={(e) => setFormCategory(e.target.value as SystemUpdateCategory)}
                className="w-full bg-slate-950 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white font-bold focus:border-indigo-500 focus:outline-none"
              >
                <option value="feature">✨ New Feature</option>
                <option value="improvement">🚀 Improvement</option>
                <option value="bugfix">🐛 Bug Fix</option>
                <option value="maintenance">🔧 Maintenance</option>
                <option value="security">🔒 Security</option>
              </select>
            </div>

            {/* Major Release Flag */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wider font-mono">
                Major Milestone?
              </label>
              <label className="flex items-center gap-3 p-2.5 bg-slate-950 border border-white/10 rounded-xl cursor-pointer">
                <input
                  type="checkbox"
                  checked={formIsMajor}
                  onChange={(e) => setFormIsMajor(e.target.checked)}
                  className="rounded border-white/20 text-purple-600 focus:ring-0 w-4 h-4"
                />
                <span className="text-xs font-bold text-purple-300">
                  Highlight with Major Release Banner
                </span>
              </label>
            </div>
          </div>

          {/* Title */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-300 uppercase tracking-wider font-mono">
              Release Title *
            </label>
            <input
              type="text"
              value={formTitle}
              onChange={(e) => setFormTitle(e.target.value)}
              placeholder="e.g. StudentOS Meet: Virtual Classroom Integration & HD Audio"
              className="w-full bg-slate-950 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white font-bold focus:border-indigo-500 focus:outline-none"
            />
          </div>

          {/* Short Summary */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-300 uppercase tracking-wider font-mono">
              Short Summary / Excerpt
            </label>
            <input
              type="text"
              value={formSummary}
              onChange={(e) => setFormSummary(e.target.value)}
              placeholder="1-2 sentences summarizing the change for quick scanning..."
              className="w-full bg-slate-950 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-slate-300 focus:border-indigo-500 focus:outline-none"
            />
          </div>

          {/* Audience Targeting */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-300 uppercase tracking-wider font-mono">
              Audience / Role Visibility
            </label>
            <div className="flex flex-wrap gap-2">
              {AVAILABLE_ROLES.map(({ role, label }) => {
                const isSelected = formAudience.includes(role);
                return (
                  <button
                    key={role}
                    type="button"
                    onClick={() => toggleAudienceRole(role)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                      isSelected
                        ? 'bg-indigo-600 text-white border-indigo-500 shadow-sm'
                        : 'bg-slate-950 text-slate-400 border-white/5 hover:text-white'
                    }`}
                  >
                    {isSelected && <span className="mr-1">✓</span>}
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Markdown Content */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wider font-mono">
                Full Release Content (Markdown Supported) *
              </label>
              <span className="text-[10px] text-slate-400 font-mono">Supports ### Headers, - Lists, **Bold**, `code`</span>
            </div>
            <textarea
              rows={8}
              value={formContent}
              onChange={(e) => setFormContent(e.target.value)}
              placeholder="### What's New&#10;- Feature detail 1&#10;- Feature detail 2"
              className="w-full bg-slate-950 border border-white/10 rounded-2xl p-4 font-mono text-xs text-slate-200 focus:border-indigo-500 focus:outline-none leading-relaxed"
            />
          </div>

          {/* Action Link & CTA */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-2xl bg-white/[0.02] border border-white/5">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wider font-mono">
                Action Button Destination
              </label>
              <select
                value={formActionUrl}
                onChange={(e) => setFormActionUrl(e.target.value)}
                className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white"
              >
                <option value="">None (No CTA Button)</option>
                {QUICK_INTERNAL_TABS.map(t => (
                  <option key={t.tab} value={t.tab}>Tab: {t.label}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wider font-mono">
                Action Button Label
              </label>
              <input
                type="text"
                value={formActionLabel}
                onChange={(e) => setFormActionLabel(e.target.value)}
                placeholder="e.g. Try StudentOS Meet Now"
                className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
              />
            </div>
          </div>

          {/* Media & Screenshots */}
          <div className="space-y-3 p-4 rounded-2xl bg-white/[0.02] border border-white/5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wider font-mono">
                Screenshots & Visual Assets
              </label>
              <label className="px-3 py-1.5 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-300 border border-indigo-500/30 text-xs font-bold cursor-pointer transition-all flex items-center gap-1.5">
                <Upload className="w-3.5 h-3.5" />
                <span>{uploadingImage ? 'Uploading...' : 'Upload Image'}</span>
                <input 
                  type="file" 
                  accept="image/*" 
                  className="hidden" 
                  onChange={handleImageUpload} 
                  disabled={uploadingImage} 
                />
              </label>
            </div>

            <div className="flex gap-2">
              <input
                type="url"
                value={customMediaInput}
                onChange={(e) => setCustomMediaInput(e.target.value)}
                placeholder="Or paste an image URL (https://...)"
                className="flex-1 bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
              />
              <button
                type="button"
                onClick={handleAddMediaUrl}
                className="px-4 py-2 bg-white/10 hover:bg-white/15 rounded-xl text-xs font-bold text-white cursor-pointer"
              >
                Add URL
              </button>
            </div>

            {formMediaUrls.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                {formMediaUrls.map((url, i) => (
                  <div key={i} className="relative rounded-xl overflow-hidden border border-white/10 aspect-video group">
                    <img src={url} alt="upload" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => handleRemoveMediaUrl(i)}
                      className="absolute top-1 right-1 p-1 bg-rose-600 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Scheduling Section */}
          <div className="p-4 rounded-2xl bg-indigo-950/20 border border-indigo-500/20 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-black text-indigo-300 uppercase tracking-wider font-mono flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-indigo-400" />
                <span>Schedule Release Publication</span>
              </label>
              <button
                type="button"
                onClick={() => setIsScheduling(!isScheduling)}
                className={`px-3 py-1 rounded-xl text-xs font-bold border transition-all ${
                  isScheduling 
                    ? 'bg-indigo-600 text-white border-indigo-500' 
                    : 'bg-slate-950 text-slate-400 border-white/10'
                }`}
              >
                {isScheduling ? 'Scheduled Mode ON' : 'Enable Scheduling'}
              </button>
            </div>

            {isScheduling && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 animate-fadeIn">
                <div className="space-y-1">
                  <span className="text-[10px] text-slate-400 font-mono">Date ({userTimezone}):</span>
                  <input
                    type="date"
                    value={scheduleDate}
                    onChange={(e) => setScheduleDate(e.target.value)}
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white"
                  />
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] text-slate-400 font-mono">Time ({userTimezone}):</span>
                  <input
                    type="time"
                    value={scheduleTime}
                    onChange={(e) => setScheduleTime(e.target.value)}
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white"
                  />
                </div>
                <p className="text-[10px] text-indigo-300/80 col-span-full font-mono">
                  ⚡ Scheduled releases remain hidden from non-super admins until the target timestamp is reached server-side.
                </p>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-white/5">
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white text-xs font-bold"
            >
              Cancel
            </button>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                disabled={saving}
                onClick={() => handleSave('draft')}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-white/10 cursor-pointer disabled:opacity-50"
              >
                Save as Draft
              </button>

              {isScheduling ? (
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => handleSave('scheduled')}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white text-xs font-black shadow-lg shadow-amber-600/20 cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                >
                  <Clock className="w-4 h-4" />
                  <span>Schedule Release</span>
                </button>
              ) : (
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => handleSave('published')}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-black shadow-lg shadow-emerald-600/20 cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                >
                  <Send className="w-4 h-4" />
                  <span>Publish Immediately</span>
                </button>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* ===================== LIST VIEW ===================== */
        <div className="space-y-4">
          
          {/* Sub-navigation tabs */}
          <div className="flex items-center justify-between flex-wrap gap-3 p-1.5 bg-slate-900/60 rounded-2xl border border-white/5">
            <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
              {[
                { key: 'all', label: 'All Releases' },
                { key: 'published', label: 'Published' },
                { key: 'scheduled', label: 'Scheduled' },
                { key: 'draft', label: 'Drafts' },
                { key: 'archived', label: 'Archived' },
                { key: 'audit', label: 'Audit Trail' }
              ].map(tab => {
                const count = tab.key === 'audit' 
                  ? auditLogs.length 
                  : tab.key === 'all' 
                    ? updates.length 
                    : updates.filter(u => u.status === tab.key).length;

                return (
                  <button
                    key={tab.key}
                    onClick={() => setStatusFilter(tab.key as any)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                      statusFilter === tab.key
                        ? 'bg-indigo-600 text-white font-black shadow'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <span>{tab.label}</span>
                    <span className="ml-1 opacity-60 text-[10px]">({count})</span>
                  </button>
                );
              })}
            </div>

            {statusFilter !== 'audit' && (
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Filter versions or titles..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 pr-3 py-1.5 bg-slate-950 border border-white/10 rounded-xl text-xs text-white focus:outline-none"
                />
              </div>
            )}
          </div>

          {/* Audit Logs View */}
          {statusFilter === 'audit' ? (
            <div className="bg-slate-900/50 border border-white/5 rounded-3xl p-5 space-y-3">
              <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider font-mono">
                System Update Audit Trail ({auditLogs.length} actions logged)
              </h4>
              <div className="divide-y divide-white/5">
                {auditLogs.map((log) => (
                  <div key={log.id} className="py-3 flex items-center justify-between gap-4 text-xs">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-indigo-400 uppercase">{log.action}</span>
                        <span className="text-white font-semibold">{log.details || log.updateId}</span>
                      </div>
                      <span className="text-[10px] text-slate-400">
                        Actor: {log.actorName} ({log.actorRole})
                      </span>
                    </div>
                    <span className="text-[10px] font-mono text-slate-500 shrink-0">
                      {new Date(log.timestamp).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            /* Releases List */
            <div className="space-y-3">
              {filteredUpdates.length === 0 ? (
                <div className="p-12 text-center rounded-3xl bg-slate-900/30 border border-white/5 space-y-2">
                  <p className="text-sm text-slate-400">No releases found matching the selected filter.</p>
                </div>
              ) : (
                filteredUpdates.map((update) => {
                  const cat = CATEGORY_CONFIG[update.category] || CATEGORY_CONFIG.feature;
                  
                  return (
                    <div 
                      key={update.id}
                      className="p-5 rounded-2xl bg-slate-900/60 border border-white/5 hover:border-white/15 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
                    >
                      <div className="space-y-2 flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="px-2.5 py-0.5 rounded-lg bg-white/10 text-white font-mono font-bold text-xs">
                            {update.version}
                          </span>

                          <span className={`px-2 py-0.5 rounded-lg border text-[10px] font-bold flex items-center gap-1 ${cat.badgeBg} ${cat.badgeText} ${cat.border}`}>
                            <span>{cat.icon}</span>
                            <span>{cat.label}</span>
                          </span>

                          {/* Status Pill */}
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${
                            update.status === 'published'
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                              : update.status === 'scheduled'
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30 animate-pulse'
                                : update.status === 'draft'
                                  ? 'bg-slate-700/50 text-slate-300 border border-slate-600/50'
                                  : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                          }`}>
                            {update.status}
                          </span>

                          {update.isMajorRelease && (
                            <span className="text-[10px] font-black text-purple-400">🌟 Major</span>
                          )}
                        </div>

                        <h4 className="text-base font-bold text-white truncate">
                          {update.title}
                        </h4>

                        <div className="flex items-center gap-3 text-[11px] text-slate-400 font-mono flex-wrap">
                          {update.scheduledPublishAt && update.status === 'scheduled' && (
                            <span className="text-amber-400 font-bold">
                              ⏰ Scheduled: {new Date(update.scheduledPublishAt).toLocaleString()}
                            </span>
                          )}
                          {update.publishedAt && update.status === 'published' && (
                            <span>Published: {new Date(update.publishedAt).toLocaleDateString()}</span>
                          )}
                          <span>Audience: {(update.audienceRoles || ['all']).join(', ')}</span>
                          <span>Author: {update.authorName}</span>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 shrink-0 flex-wrap">
                        {update.status === 'draft' && (
                          <button
                            onClick={() => handleQuickStatusChange(update, 'published')}
                            className="px-3 py-1.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white border border-emerald-500/30 text-xs font-bold transition-all"
                            title="Publish now"
                          >
                            Publish Now
                          </button>
                        )}

                        {update.status === 'scheduled' && (
                          <button
                            onClick={() => handleQuickStatusChange(update, 'draft')}
                            className="px-3 py-1.5 rounded-xl bg-amber-600/20 hover:bg-amber-600 text-amber-300 hover:text-white border border-amber-500/30 text-xs font-bold transition-all"
                            title="Cancel schedule & return to draft"
                          >
                            Cancel Schedule
                          </button>
                        )}

                        {update.status === 'published' && (
                          <button
                            onClick={() => handleQuickStatusChange(update, 'draft')}
                            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold"
                            title="Unpublish"
                          >
                            Unpublish
                          </button>
                        )}

                        <button
                          onClick={() => handleStartEdit(update)}
                          className="px-3 py-1.5 rounded-xl bg-indigo-600/20 hover:bg-indigo-600 text-indigo-300 hover:text-white border border-indigo-500/30 text-xs font-bold transition-all"
                        >
                          Edit
                        </button>

                        <button
                          onClick={() => handleDelete(update.id)}
                          className="p-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 hover:text-rose-300 transition-all"
                          title="Delete update"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      )}

    </div>
  );
}
