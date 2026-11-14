/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Super Admin Feature & Theme Management Console
 * - Categorized toggles across 8 platform feature groups
 * - Live Super Admin Preview Mode toggle for testing OFF features safely
 * - Dynamic registration form for future seasonal/beta/platform features
 * - Immutable Feature Audit History viewer
 */

import React, { useMemo, useState } from 'react';
import {
  Eye,
  EyeOff,
  History,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
  Sliders,
} from 'lucide-react';
import { UserProfile } from '../../types';
import {
  FeatureCategory,
  isSuperAdminRole,
  refreshFeatureRegistry,
  registerPlatformFeature,
  setSuperAdminPreviewDisabled,
  togglePlatformFeature,
  useFeatureRegistry,
} from '../../lib/featureAccessService';
import { TactileButton, UIverseToggle } from '../ui/animatedComponents';

interface FeatureControlCenterProps {
  currentUser: UserProfile;
  showNotification?: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

const ALL_CATEGORIES: Array<'All' | FeatureCategory> = [
  'All',
  'Themes & Seasonal Events',
  'Gamification & Rewards',
  'Leaderboards',
  'Student Workspace Features',
  'Faculty Workspace Features',
  'AI & Voice Tools',
  'Experimental / Beta Features',
  'Other Platform Features',
];

export const FeatureControlCenter: React.FC<FeatureControlCenterProps> = ({
  currentUser,
  showNotification,
}) => {
  const registry = useFeatureRegistry(currentUser);
  const isSuperAdmin = isSuperAdminRole(currentUser?.role);

  const [selectedCategory, setSelectedCategory] = useState<'All' | FeatureCategory>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [showRegisterForm, setShowRegisterForm] = useState<boolean>(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const [newKey, setNewKey] = useState('');
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newCategory, setNewCategory] = useState<FeatureCategory>('Other Platform Features');
  const [newVersion, setNewVersion] = useState('2026.12');
  const [newSeasonal, setNewSeasonal] = useState(false);
  const [newEnabled, setNewEnabled] = useState(false);
  const [registering, setRegistering] = useState(false);

  const filteredFeatures = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return registry.orderedFeatures.filter((f) => {
      if (selectedCategory !== 'All' && f.category !== selectedCategory) return false;
      if (!q) return true;
      return (
        f.key.toLowerCase().includes(q) ||
        f.displayName.toLowerCase().includes(q) ||
        f.description.toLowerCase().includes(q)
      );
    });
  }, [registry.orderedFeatures, selectedCategory, searchQuery]);

  const counts = useMemo(() => {
    const all = registry.orderedFeatures;
    return {
      total: all.length,
      enabled: all.filter((f) => f.enabled).length,
      disabled: all.filter((f) => !f.enabled).length,
      seasonal: all.filter((f) => f.isSeasonal).length,
    };
  }, [registry.orderedFeatures]);

  if (!isSuperAdmin) {
    return (
      <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-6 text-sm text-rose-700 dark:text-rose-200 flex items-center gap-3">
        <ShieldAlert className="w-5 h-5 shrink-0" />
        <span>
          Access restricted. Only verified Super Admins may view or modify platform feature switches.
        </span>
      </div>
    );
  }

  const handleToggle = async (featureKey: string, nextEnabled: boolean) => {
    setBusyKey(featureKey);
    setActionError(null);
    const res = await togglePlatformFeature({
      key: featureKey,
      enabled: nextEnabled,
      user: currentUser,
    });
    setBusyKey(null);

    if (!res.ok) {
      setActionError(res.error || 'Failed to update feature flag.');
      showNotification?.(res.error || 'Failed to update feature flag.', 'error');
      return;
    }

    showNotification?.(
      `${res.feature?.displayName || featureKey} is now ${nextEnabled ? 'ENABLED' : 'DISABLED'}.`,
      nextEnabled ? 'success' : 'info'
    );
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegistering(true);
    setActionError(null);
    const res = await registerPlatformFeature({
      key: newKey,
      displayName: newName,
      description: newDesc,
      category: newCategory,
      enabled: newEnabled,
      releaseVersion: newVersion,
      isSeasonal: newSeasonal,
      canPreviewBySuperAdmin: true,
      user: currentUser,
    });
    setRegistering(false);

    if (!res.ok) {
      setActionError(res.error || 'Could not register feature.');
      return;
    }

    setNewKey('');
    setNewName('');
    setNewDesc('');
    setShowRegisterForm(false);
    showNotification?.(`Registered feature "${res.feature?.displayName}".`, 'success');
  };

  return (
    <div className="space-y-6">
      {/* Header & Preview Control */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 p-5 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-sky-500/15 border border-sky-500/30 flex items-center justify-center text-sky-600 dark:text-sky-400 shrink-0">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                Feature &amp; Theme Management
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Real-time global rollout &amp; rollback registry. Disabled features vanish from UI and reject regular API requests with 403.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              type="button"
              onClick={() => setSuperAdminPreviewDisabled(!registry.previewDisabledFeatures)}
              className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-semibold transition-colors cursor-pointer ${
                registry.previewDisabledFeatures
                  ? 'border-amber-500/50 bg-amber-500/15 text-amber-700 dark:text-amber-300'
                  : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              {registry.previewDisabledFeatures ? (
                <Eye className="w-4 h-4" />
              ) : (
                <EyeOff className="w-4 h-4" />
              )}
              <span>
                Preview Disabled Features: {registry.previewDisabledFeatures ? 'ON' : 'OFF'}
              </span>
            </button>

            <TactileButton
              variant="secondary"
              size="sm"
              onClick={() => setShowRegisterForm((v) => !v)}
              icon={<Plus className="w-3.5 h-3.5" />}
            >
              Register Feature
            </TactileButton>

            <button
              type="button"
              onClick={() => refreshFeatureRegistry(currentUser)}
              className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              aria-label="Refresh feature registry"
            >
              <RefreshCw className={`w-4 h-4 ${registry.loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Summary Counters */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 p-3">
            <p className="text-[11px] text-slate-500">Registered Flags</p>
            <p className="text-xl font-bold font-mono tabular-nums text-slate-900 dark:text-white">
              {counts.total}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 p-3">
            <p className="text-[11px] text-slate-500">Enabled Globally</p>
            <p className="text-xl font-bold font-mono tabular-nums text-emerald-600 dark:text-emerald-400">
              {counts.enabled}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 p-3">
            <p className="text-[11px] text-slate-500">Disabled</p>
            <p className="text-xl font-bold font-mono tabular-nums text-slate-600 dark:text-slate-300">
              {counts.disabled}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 p-3">
            <p className="text-[11px] text-slate-500">Seasonal Events</p>
            <p className="text-xl font-bold font-mono tabular-nums text-sky-600 dark:text-sky-400">
              {counts.seasonal}
            </p>
          </div>
        </div>

        {actionError && (
          <div className="p-3 rounded-xl border border-rose-500/40 bg-rose-500/15 text-xs text-rose-700 dark:text-rose-200">
            {actionError}
          </div>
        )}

        {/* Register New Future Feature Form */}
        {showRegisterForm && (
          <form
            onSubmit={handleRegister}
            className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 p-4 space-y-3"
          >
            <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Register New Platform Feature Flag
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <input
                type="text"
                required
                placeholder="Feature key (e.g. spring_science_fair)"
                value={newKey}
                onChange={(e) => setNewKey(e.target.value)}
                className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
              />
              <input
                type="text"
                required
                placeholder="Display Name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
              />
              <select
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value as FeatureCategory)}
                className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
              >
                {ALL_CATEGORIES.filter((c) => c !== 'All').map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <input
                type="text"
                placeholder="Description"
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                className="sm:col-span-2 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
              />
              <input
                type="text"
                placeholder="Release version (e.g. 2026.12)"
                value={newVersion}
                onChange={(e) => setNewVersion(e.target.value)}
                className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
              />
            </div>
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-4 text-xs text-slate-700 dark:text-slate-300">
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newSeasonal}
                    onChange={(e) => setNewSeasonal(e.target.checked)}
                  />
                  <span>Seasonal Event</span>
                </label>
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newEnabled}
                    onChange={(e) => setNewEnabled(e.target.checked)}
                  />
                  <span>Enable Immediately</span>
                </label>
              </div>
              <div className="flex items-center gap-2">
                <TactileButton
                  variant="outline"
                  size="sm"
                  onClick={() => setShowRegisterForm(false)}
                >
                  Cancel
                </TactileButton>
                <TactileButton type="submit" variant="primary" size="sm" disabled={registering}>
                  {registering ? 'Saving...' : 'Save Feature'}
                </TactileButton>
              </div>
            </div>
          </form>
        )}

        {/* Filter & Search Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pt-1">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            {ALL_CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                  selectedCategory === cat
                    ? 'bg-sky-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="relative w-full md:w-64 shrink-0">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search feature key or name..."
              className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs"
            />
          </div>
        </div>
      </div>

      {/* Feature Flag Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredFeatures.map((feat) => (
          <div
            key={feat.key}
            className={`rounded-2xl border p-4 flex flex-col justify-between gap-3 transition-colors ${
              feat.enabled
                ? 'border-emerald-500/35 bg-white dark:bg-slate-900/90'
                : 'border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60'
            }`}
          >
            <div className="space-y-1.5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                    {feat.displayName}
                  </h4>
                  <p className="text-[11px] font-mono text-slate-500 truncate">
                    {feat.key} · v{feat.releaseVersion}
                  </p>
                </div>

                <UIverseToggle
                  checked={feat.enabled}
                  disabled={busyKey === feat.key}
                  onChange={(next) => handleToggle(feat.key, next)}
                />
              </div>

              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                {feat.description}
              </p>

              <div className="flex items-center gap-2 text-[11px] text-slate-500 flex-wrap pt-1">
                <span>{feat.category}</span>
                {feat.isSeasonal && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="text-sky-600 dark:text-sky-400 font-medium">Seasonal Event</span>
                  </>
                )}
                {Array.isArray(feat.dependencies) && feat.dependencies.length > 0 && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span>Requires: {feat.dependencies.join(', ')}</span>
                  </>
                )}
              </div>
            </div>

            <div className="pt-2 border-t border-slate-200 dark:border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500">
              <span>
                Status:{' '}
                <strong className={feat.enabled ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500'}>
                  {feat.enabled ? 'Active' : 'Disabled'}
                </strong>
              </span>
              <span className="truncate max-w-[200px]">
                Updated by {feat.updatedByName || 'System'}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Feature Audit History Log */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 p-5 space-y-3">
        <div className="flex items-center gap-2">
          <History className="w-4 h-4 text-sky-500" />
          <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
            Feature Change Audit History
          </h4>
        </div>

        {registry.auditLogs.length === 0 ? (
          <p className="text-xs text-slate-500">
            No administrative feature toggles recorded in this session yet.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                  <th className="py-2 pr-3 font-medium">Feature</th>
                  <th className="py-2 pr-3 font-medium">Transition</th>
                  <th className="py-2 pr-3 font-medium">Actor</th>
                  <th className="py-2 font-medium">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {registry.auditLogs.slice(0, 20).map((log) => (
                  <tr key={log.id}>
                    <td className="py-2 pr-3 font-mono text-slate-800 dark:text-slate-200">
                      {log.featureKey}
                    </td>
                    <td className="py-2 pr-3">
                      {log.previousEnabled === null
                        ? `Created (${log.newEnabled ? 'ON' : 'OFF'})`
                        : `${log.previousEnabled ? 'ON' : 'OFF'} → ${log.newEnabled ? 'ON' : 'OFF'}`}
                    </td>
                    <td className="py-2 pr-3 text-slate-600 dark:text-slate-300">
                      {log.actorName} ({log.actorRole})
                    </td>
                    <td className="py-2 font-mono tabular-nums text-slate-500">
                      {new Date(log.createdAt).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
