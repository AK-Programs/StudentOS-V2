/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Super Admin Release Management & Scheduling Pipeline
 */

import React, { useState, useEffect } from 'react';
import { 
  Rocket, Calendar, Clock, CheckCircle2, AlertCircle, Plus, 
  Edit3, Trash2, Eye, X, RefreshCw, Send, Check, ShieldAlert,
  ChevronRight, Sparkles, Filter, ExternalLink, ShieldCheck
} from 'lucide-react';
import { StudentOSRelease, ReleaseStatus, UserProfile, UserRole } from '../types';
import { 
  getAllReleases, saveRelease, publishReleaseNow, scheduleRelease, 
  cancelScheduledRelease, deleteRelease, checkAndPromoteScheduledReleases 
} from '../lib/supabaseUpdates';
import { APP_VERSION, APP_BUILD_ID } from '../config/version';

interface AdminReleaseManagerProps {
  currentUser?: UserProfile | null;
  showNotification?: (msg: string) => void;
}

export const AdminReleaseManager: React.FC<AdminReleaseManagerProps> = ({
  currentUser,
  showNotification = (msg: string) => console.log(msg)
}) => {
  const [releases, setReleases] = useState<StudentOSRelease[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [statusFilter, setStatusFilter] = useState<'all' | ReleaseStatus>('all');
  
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [previewRelease, setPreviewRelease] = useState<StudentOSRelease | null>(null);
  const [isEditing, setIsEditing] = useState<boolean>(false);

  // Form state
  const [formData, setFormData] = useState<{
    id?: string;
    version: string;
    title: string;
    description: string;
    content: string;
    category: 'feature' | 'improvement' | 'bugfix' | 'maintenance' | 'security';
    status: ReleaseStatus;
    scheduledDate: string;
    scheduledTime: string;
    audienceRoles: (UserRole | 'all')[];
    isMajor: boolean;
  }>({
    version: '',
    title: '',
    description: '',
    content: '',
    category: 'feature',
    status: 'DRAFT',
    scheduledDate: '',
    scheduledTime: '18:00',
    audienceRoles: ['all'],
    isMajor: false
  });

  const loadData = async () => {
    setLoading(true);
    try {
      // Check if any scheduled release is now due
      await checkAndPromoteScheduledReleases({
        id: currentUser?.uid || 'super_admin',
        name: currentUser?.name || 'Super Admin',
        role: currentUser?.role || 'super_admin'
      });
      const data = await getAllReleases();
      setReleases(data);
    } catch (err) {
      console.warn('[AdminReleaseManager] Error loading releases:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenCreateModal = () => {
    // Default scheduled time: tomorrow at 18:00
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateStr = tomorrow.toISOString().split('T')[0];

    setFormData({
      version: '2.9.1',
      title: '',
      description: '',
      content: `### 🚀 Highlights & Features\n\n* **Feature 1**: Description here.\n* **Improvement**: Faster performance and layout fixes.\n* **Bug Fixes**: Resolved edge case issues.`,
      category: 'feature',
      status: 'DRAFT',
      scheduledDate: dateStr,
      scheduledTime: '18:00',
      audienceRoles: ['all'],
      isMajor: false
    });
    setIsEditing(false);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (rel: StudentOSRelease) => {
    let dateStr = '';
    let timeStr = '18:00';
    if (rel.scheduled_release_at) {
      const d = new Date(rel.scheduled_release_at);
      dateStr = d.toISOString().split('T')[0];
      timeStr = d.toTimeString().substring(0, 5);
    }

    setFormData({
      id: rel.id,
      version: rel.version,
      title: rel.title,
      description: rel.description,
      content: rel.content,
      category: rel.category,
      status: rel.status,
      scheduledDate: dateStr,
      scheduledTime: timeStr,
      audienceRoles: rel.audience_roles,
      isMajor: Boolean(rel.is_major)
    });
    setIsEditing(true);
    setIsModalOpen(true);
  };

  const handleSaveRelease = async (targetStatus?: ReleaseStatus) => {
    if (!formData.version.trim() || !formData.title.trim()) {
      showNotification('Please provide a version number and release title.');
      return;
    }

    const scheduledIso = formData.scheduledDate
      ? new Date(`${formData.scheduledDate}T${formData.scheduledTime || '00:00'}:00`).toISOString()
      : new Date().toISOString();

    const finalStatus = targetStatus || formData.status;

    const releaseObj: StudentOSRelease = {
      id: formData.id || `rel-${formData.version.replace(/\./g, '-')}-${Date.now().toString(36)}`,
      release_id: formData.id || `rel-${formData.version}`,
      version: formData.version.trim(),
      title: formData.title.trim(),
      description: formData.description.trim(),
      content: formData.content.trim(),
      category: formData.category,
      status: finalStatus,
      scheduled_release_at: scheduledIso,
      actual_released_at: finalStatus === 'RELEASED' ? new Date().toISOString() : undefined,
      deployment_status: finalStatus === 'RELEASED' ? 'DEPLOYED' : finalStatus === 'SCHEDULED' ? 'READY' : 'PENDING',
      whats_new_status: finalStatus === 'RELEASED' ? 'PUBLISHED' : finalStatus === 'SCHEDULED' ? 'READY' : 'DRAFT',
      audience_roles: formData.audienceRoles,
      created_by: currentUser?.uid || 'super_admin',
      created_by_name: currentUser?.name || 'Super Admin',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      is_major: formData.isMajor
    };

    try {
      await saveRelease(releaseObj, {
        id: currentUser?.uid || 'super_admin',
        name: currentUser?.name || 'Super Admin',
        role: currentUser?.role || 'super_admin'
      });
      showNotification(
        finalStatus === 'RELEASED'
          ? `✓ StudentOS v${releaseObj.version} has been published and released immediately!`
          : finalStatus === 'SCHEDULED'
          ? `✓ StudentOS v${releaseObj.version} is scheduled for release!`
          : `✓ Draft release v${releaseObj.version} saved successfully.`
      );
      setIsModalOpen(false);
      await loadData();
    } catch (err: any) {
      showNotification('Error saving release: ' + (err?.message || 'Check network'));
    }
  };

  const handleInstantRelease = async (relId: string) => {
    if (confirm('Publish this release immediately? This will activate the release and make What’s New live for users.')) {
      try {
        await publishReleaseNow(relId, {
          id: currentUser?.uid || 'super_admin',
          name: currentUser?.name || 'Super Admin',
          role: currentUser?.role || 'super_admin'
        });
        showNotification('✓ Release published successfully!');
        await loadData();
      } catch (err: any) {
        showNotification('Failed to publish release: ' + err.message);
      }
    }
  };

  const handleCancelRelease = async (relId: string) => {
    if (confirm('Cancel this scheduled release?')) {
      try {
        await cancelScheduledRelease(relId, {
          id: currentUser?.uid || 'super_admin',
          name: currentUser?.name || 'Super Admin',
          role: currentUser?.role || 'super_admin'
        });
        showNotification('✓ Scheduled release cancelled.');
        await loadData();
      } catch (err: any) {
        showNotification('Error cancelling release: ' + err.message);
      }
    }
  };

  const handleDelete = async (relId: string, version: string) => {
    if (confirm(`Are you sure you want to delete release v${version}?`)) {
      try {
        await deleteRelease(relId, {
          id: currentUser?.uid || 'super_admin',
          name: currentUser?.name || 'Super Admin',
          role: currentUser?.role || 'super_admin'
        });
        showNotification('✓ Release deleted.');
        await loadData();
      } catch (err: any) {
        showNotification('Error deleting release: ' + err.message);
      }
    }
  };

  const filteredReleases = releases.filter(r => {
    if (statusFilter === 'all') return true;
    return r.status === statusFilter;
  });

  const scheduledCount = releases.filter(r => r.status === 'SCHEDULED').length;
  const releasedCount = releases.filter(r => r.status === 'RELEASED').length;
  const draftCount = releases.filter(r => r.status === 'DRAFT').length;

  return (
    <div className="space-y-6">
      {/* Top Banner & Stats */}
      <div className="p-6 rounded-3xl bg-slate-900 border border-white/10 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
              <Rocket className="w-5 h-5" />
            </span>
            <h2 className="text-xl font-black text-white font-display">StudentOS Release Pipeline</h2>
          </div>
          <p className="text-xs text-slate-400 mt-1 max-w-xl">
            Coordinate upcoming StudentOS releases, schedule What’s New announcements, and review production deployment readiness.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={loadData}
            className="p-3 rounded-2xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/5 transition-all cursor-pointer"
            title="Refresh releases"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={handleOpenCreateModal}
            className="px-5 py-3 rounded-2xl bg-gradient-to-r from-indigo-600 to-teal-500 hover:from-indigo-500 hover:to-teal-400 text-white font-extrabold text-xs uppercase tracking-wider shadow-lg shadow-indigo-600/20 transition-all active:scale-95 flex items-center gap-2 cursor-pointer min-h-[44px]"
          >
            <Plus className="w-4 h-4" />
            <span>Prepare New Release</span>
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="p-4 rounded-2xl bg-slate-900/80 border border-white/5">
          <span className="text-xs font-semibold text-slate-400">Active Build</span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-xl sm:text-2xl font-black text-white font-mono">v{APP_VERSION}</span>
            <span className="text-[10px] text-emerald-400 font-bold uppercase">Live</span>
          </div>
          <p className="text-[10px] text-slate-500 font-mono mt-1">{APP_BUILD_ID}</p>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/80 border border-white/5">
          <span className="text-xs font-semibold text-slate-400">Scheduled</span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-xl sm:text-2xl font-black text-amber-400 font-mono">{scheduledCount}</span>
            <span className="text-[10px] text-slate-400">releases</span>
          </div>
          <p className="text-[10px] text-slate-500 mt-1">Awaiting release time</p>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/80 border border-white/5">
          <span className="text-xs font-semibold text-slate-400">Drafts</span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-xl sm:text-2xl font-black text-slate-300 font-mono">{draftCount}</span>
            <span className="text-[10px] text-slate-400">in prep</span>
          </div>
          <p className="text-[10px] text-slate-500 mt-1">Unscheduled drafts</p>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/80 border border-white/5">
          <span className="text-xs font-semibold text-slate-400">Total Released</span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-xl sm:text-2xl font-black text-indigo-400 font-mono">{releasedCount}</span>
            <span className="text-[10px] text-slate-400">versions</span>
          </div>
          <p className="text-[10px] text-slate-500 mt-1">Historic release logs</p>
        </div>
      </div>

      {/* Deployment & Architecture Notice */}
      <div className="p-4 rounded-2xl bg-indigo-950/30 border border-indigo-500/20 text-indigo-200 text-xs flex items-start gap-3">
        <ShieldCheck className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
        <div>
          <strong className="text-white">Deployment Pipeline Safety:</strong> Releases scheduled here coordinate release metadata, audit logs, and automatic What’s New publication across StudentOS. Frontend code bundles are deployed via your production git / Vercel workflow.
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        {(['all', 'SCHEDULED', 'DRAFT', 'RELEASED', 'CANCELLED'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setStatusFilter(tab)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              statusFilter === tab
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'bg-white/5 text-slate-400 hover:text-white hover:bg-white/10'
            }`}
          >
            {tab === 'all' ? 'All Releases' : tab}
          </button>
        ))}
      </div>

      {/* Release List */}
      <div className="space-y-4">
        {filteredReleases.length === 0 ? (
          <div className="p-12 text-center rounded-3xl bg-slate-900/40 border border-white/5">
            <Rocket className="w-10 h-10 text-slate-600 mx-auto mb-3" />
            <p className="text-sm font-bold text-slate-300">No releases found</p>
            <p className="text-xs text-slate-500 mt-1">Click "Prepare New Release" to configure an upcoming version.</p>
          </div>
        ) : (
          filteredReleases.map(rel => {
            const isScheduled = rel.status === 'SCHEDULED';
            const isReleased = rel.status === 'RELEASED';
            const isDraft = rel.status === 'DRAFT';
            const isCancelled = rel.status === 'CANCELLED';

            const statusBadgeColor = isReleased
              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
              : isScheduled
              ? 'bg-amber-500/20 text-amber-300 border-amber-500/30 animate-pulse'
              : isCancelled
              ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
              : 'bg-slate-700/40 text-slate-300 border-slate-600/30';

            return (
              <div 
                key={rel.id}
                className="p-5 sm:p-6 rounded-3xl bg-slate-900 border border-white/10 shadow-lg hover:border-white/20 transition-all space-y-4"
              >
                {/* Header row */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/5 pb-4">
                  <div className="flex items-center gap-3">
                    <span className="text-xl font-black text-white font-mono">v{rel.version}</span>
                    <span className={`text-[10px] uppercase font-bold font-mono px-2.5 py-0.5 rounded-full border ${statusBadgeColor}`}>
                      {rel.status}
                    </span>
                    {rel.is_major && (
                      <span className="text-[10px] uppercase font-extrabold px-2 py-0.5 rounded-full bg-gradient-to-r from-amber-500 to-rose-500 text-white shadow-sm">
                        Major Release
                      </span>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      onClick={() => setPreviewRelease(rel)}
                      className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/5 text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer min-h-[36px]"
                      title="Preview release announcement"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Preview</span>
                    </button>

                    <button
                      onClick={() => handleOpenEditModal(rel)}
                      className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/5 text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer min-h-[36px]"
                      title="Edit release details"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>Edit</span>
                    </button>

                    {isScheduled && (
                      <button
                        onClick={() => handleCancelRelease(rel.id)}
                        className="px-3 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/20 text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer min-h-[36px]"
                      >
                        <X className="w-3.5 h-3.5" />
                        <span>Cancel</span>
                      </button>
                    )}

                    {!isReleased && (
                      <button
                        onClick={() => handleInstantRelease(rel.id)}
                        className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-md active:scale-95 flex items-center gap-1.5 cursor-pointer min-h-[36px]"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>Release Now</span>
                      </button>
                    )}

                    <button
                      onClick={() => handleDelete(rel.id, rel.version)}
                      className="p-2 rounded-xl bg-white/5 hover:bg-rose-500/20 text-slate-400 hover:text-rose-300 border border-white/5 transition-all cursor-pointer min-h-[36px]"
                      title="Delete release"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Details */}
                <div>
                  <h3 className="text-base font-bold text-white">{rel.title}</h3>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">{rel.description}</p>
                </div>

                {/* Metadata strip */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 text-[11px] text-slate-400 border-t border-white/5">
                  <div>
                    <span className="text-slate-500 block">Release Time:</span>
                    <strong className="text-slate-200">
                      {rel.actual_released_at 
                        ? new Date(rel.actual_released_at).toLocaleString() 
                        : rel.scheduled_release_at 
                        ? new Date(rel.scheduled_release_at).toLocaleString() 
                        : 'Unscheduled'}
                    </strong>
                  </div>

                  <div>
                    <span className="text-slate-500 block">Deployment:</span>
                    <span className={`font-mono font-bold ${
                      rel.deployment_status === 'DEPLOYED' ? 'text-emerald-400' :
                      rel.deployment_status === 'READY' ? 'text-amber-400' : 'text-slate-400'
                    }`}>
                      ● {rel.deployment_status}
                    </span>
                  </div>

                  <div>
                    <span className="text-slate-500 block">What’s New:</span>
                    <span className={`font-mono font-bold ${
                      rel.whats_new_status === 'PUBLISHED' ? 'text-emerald-400' :
                      rel.whats_new_status === 'READY' ? 'text-amber-400' : 'text-slate-400'
                    }`}>
                      ● {rel.whats_new_status}
                    </span>
                  </div>

                  <div>
                    <span className="text-slate-500 block">Audience:</span>
                    <span className="text-slate-200 capitalize">
                      {rel.audience_roles.join(', ')}
                    </span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* CREATE / EDIT MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="w-full max-w-2xl bg-slate-900 border border-white/10 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 my-auto max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-white/5 pb-4">
              <h3 className="text-lg font-black text-white font-display flex items-center gap-2">
                <Rocket className="w-5 h-5 text-indigo-400" />
                <span>{isEditing ? 'Edit StudentOS Release' : 'Prepare StudentOS Release'}</span>
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-400 font-bold mb-1">Version Number *</label>
                  <input
                    type="text"
                    value={formData.version}
                    onChange={(e) => setFormData({ ...formData, version: e.target.value })}
                    placeholder="e.g. 2.9.0"
                    className="w-full px-4 py-2.5 rounded-xl bg-black/40 border border-white/10 text-white font-mono focus:border-indigo-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 font-bold mb-1">Category</label>
                  <select
                    value={formData.category}
                    onChange={(e: any) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl bg-black/40 border border-white/10 text-white focus:border-indigo-500 outline-none"
                  >
                    <option value="feature">🚀 Major Feature</option>
                    <option value="improvement">⚡ Improvement</option>
                    <option value="bugfix">🐛 Bug Fix</option>
                    <option value="maintenance">🛠️ Maintenance</option>
                    <option value="security">🔒 Security</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-400 font-bold mb-1">Release Title *</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="e.g. StudentOS v2.9.0 — Orion Nova & High-Yield Study Center"
                  className="w-full px-4 py-2.5 rounded-xl bg-black/40 border border-white/10 text-white focus:border-indigo-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-bold mb-1">Short Summary</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="A concise summary of what this release brings to students and educators."
                  rows={2}
                  className="w-full px-4 py-2.5 rounded-xl bg-black/40 border border-white/10 text-white focus:border-indigo-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-bold mb-1">What’s New Markdown Notes</label>
                <textarea
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  rows={6}
                  placeholder="### Highlights..."
                  className="w-full px-4 py-2.5 rounded-xl bg-black/40 border border-white/10 text-white font-mono focus:border-indigo-500 outline-none"
                />
              </div>

              {/* Schedule row */}
              <div className="p-4 rounded-2xl bg-black/30 border border-white/5 space-y-3">
                <span className="font-bold text-slate-300 flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-indigo-400" />
                  <span>Scheduled Release Date & Time</span>
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Date</label>
                    <input
                      type="date"
                      value={formData.scheduledDate}
                      onChange={(e) => setFormData({ ...formData, scheduledDate: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-white/10 text-white outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Time</label>
                    <input
                      type="time"
                      value={formData.scheduledTime}
                      onChange={(e) => setFormData({ ...formData, scheduledTime: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-white/10 text-white outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Major Release Checkbox */}
              <label className="flex items-center gap-2 cursor-pointer text-slate-300 font-semibold select-none">
                <input
                  type="checkbox"
                  checked={formData.isMajor}
                  onChange={(e) => setFormData({ ...formData, isMajor: e.target.checked })}
                  className="w-4 h-4 rounded text-indigo-600 focus:ring-0"
                />
                <span>Highlight as Major Release (Shows celebratory announcement banner)</span>
              </label>
            </div>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-4 border-t border-white/5">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-bold transition-all cursor-pointer min-h-[44px]"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={() => handleSaveRelease('DRAFT')}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition-all cursor-pointer min-h-[44px]"
              >
                Save as Draft
              </button>

              <button
                type="button"
                onClick={() => handleSaveRelease('SCHEDULED')}
                className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-600 to-indigo-600 hover:from-amber-500 hover:to-indigo-500 text-white text-xs font-extrabold uppercase tracking-wider transition-all shadow-md cursor-pointer min-h-[44px]"
              >
                Schedule Release
              </button>

              <button
                type="button"
                onClick={() => handleSaveRelease('RELEASED')}
                className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white text-xs font-extrabold uppercase tracking-wider transition-all shadow-md cursor-pointer min-h-[44px]"
              >
                Release Now
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PREVIEW MODAL */}
      {previewRelease && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="w-full max-w-xl bg-slate-900 border border-indigo-500/30 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-4 my-auto">
            <div className="flex items-center justify-between border-b border-white/5 pb-3">
              <span className="text-xs font-extrabold uppercase tracking-wider text-indigo-400">
                What’s New Preview
              </span>
              <button
                onClick={() => setPreviewRelease(null)}
                className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 font-mono text-xs font-bold">
                  v{previewRelease.version}
                </span>
                <span className="text-xs text-slate-500">
                  {new Date(previewRelease.scheduled_release_at).toLocaleDateString()}
                </span>
              </div>
              <h4 className="text-lg font-black text-white">{previewRelease.title}</h4>
              <p className="text-xs text-slate-400">{previewRelease.description}</p>
            </div>

            <div className="p-4 rounded-2xl bg-black/40 border border-white/5 text-xs text-slate-300 whitespace-pre-line leading-relaxed max-h-[300px] overflow-y-auto scrollbar-thin">
              {previewRelease.content}
            </div>

            <div className="flex justify-end pt-3 border-t border-white/5">
              <button
                onClick={() => setPreviewRelease(null)}
                className="px-5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-all cursor-pointer"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
