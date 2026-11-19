/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Veylentra Admin & Super Admin Engagement Policy Configuration & Audit Console
 * - Real persistence via /api/engagement/config & /api/engagement/audit
 * - Streak recovery rules, weekly goal targets, notification throttling defaults
 * - Super-Admin-guarded global feature flags + immutable change history viewer
 */

import React, { useEffect, useState } from 'react';
import {
  Shield,
  Sliders,
  Bell,
  Flame,
  Save,
  RefreshCw,
  Clock,
  CheckCircle2,
  Lock,
} from 'lucide-react';
import { EngagementPolicyConfig, UserProfile } from '../../types';
import {
  fetchEngagementAuditLogs,
  fetchEngagementPolicyConfig,
  updateEngagementPolicyConfig,
} from '../../lib/engagementService';

interface EngagementPolicyConsoleProps {
  currentUser: UserProfile;
  showNotification: (msg: string) => void;
}

export const EngagementPolicyConsole: React.FC<EngagementPolicyConsoleProps> = ({
  currentUser,
  showNotification,
}) => {
  const isSuperAdmin = (currentUser?.role || '').toLowerCase() === 'super_admin';
  const [config, setConfig] = useState<EngagementPolicyConfig | null>(null);
  const [auditLogs, setAuditLogs] = useState<
    Array<{
      id: string;
      actorUserId: string;
      actorEmail: string;
      actorRole: string;
      action: string;
      summary: string;
      createdAt: string;
    }>
  >([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);

  const loadData = async () => {
    setLoading(true);
    const [cfg, logs] = await Promise.all([
      fetchEngagementPolicyConfig(),
      fetchEngagementAuditLogs(currentUser),
    ]);
    if (cfg) setConfig(cfg);
    setAuditLogs(logs);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [currentUser?.uid]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!config || saving) return;
    setSaving(true);
    const res = await updateEngagementPolicyConfig(currentUser, config);
    setSaving(false);
    if (res.success && res.config) {
      setConfig(res.config);
      showNotification(`Saved Engagement Policy v${res.config.version} with audit trail.`);
      const logs = await fetchEngagementAuditLogs(currentUser);
      setAuditLogs(logs);
    } else {
      showNotification(res.error || 'Failed to save engagement policy.');
    }
  };

  if (loading && !config) {
    return (
      <div className="p-8 rounded-2xl bg-slate-900/70 border border-slate-800 text-center text-xs text-slate-400">
        Loading engagement policy settings and audit history...
      </div>
    );
  }

  if (!config) {
    return (
      <div className="p-6 rounded-2xl bg-slate-900/70 border border-slate-800 text-center space-y-3">
        <p className="text-xs text-slate-300">Unable to load live engagement policy configuration.</p>
        <button
          type="button"
          onClick={loadData}
          className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold cursor-pointer"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-slate-900/80 border border-slate-800">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-indigo-400" />
            <h4 className="text-sm font-black text-white">
              Engagement, Streak & Notification Policy Console
            </h4>
            <span className="text-[11px] font-mono text-indigo-300">v{config.version}</span>
          </div>
          <p className="text-xs text-slate-400">
            Last updated by <strong className="text-slate-200">{config.updatedBy}</strong> ·{' '}
            {new Date(config.updatedAt).toLocaleString()}
          </p>
        </div>

        <button
          type="button"
          onClick={loadData}
          className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 border border-white/10 cursor-pointer shrink-0"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Sync Latest</span>
        </button>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* 1. Streak Protection & Verified Recovery Rules */}
          <div className="p-5 rounded-2xl bg-slate-900/75 border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Flame className="w-4 h-4 text-amber-400" />
                <h5 className="text-sm font-bold text-white">Streak Protection & Recovery</h5>
              </div>
              <label className="flex items-center gap-2 text-xs text-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.streakRecoveryEnabled}
                  onChange={(e) =>
                    setConfig({ ...config, streakRecoveryEnabled: e.target.checked })
                  }
                  className="rounded border-slate-700 bg-slate-950 text-indigo-500"
                />
                <span>Recovery Enabled</span>
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">
                  Grace Window (Max Missed Days)
                </label>
                <input
                  type="number"
                  min={1}
                  max={7}
                  value={config.maxMissedDaysForRecovery}
                  onChange={(e) =>
                    setConfig({ ...config, maxMissedDaysForRecovery: Number(e.target.value) })
                  }
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] text-slate-400 mb-1">
                  Required Recovery Evidence
                </label>
                <select
                  value={config.requiredRecoveryActivity}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      requiredRecoveryActivity: e.target.value as any,
                    })
                  }
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-white"
                >
                  <option value="review_flashcards_or_quiz">Flashcards or Quiz</option>
                  <option value="review_flashcards">Flashcards Only</option>
                  <option value="complete_quiz">Quiz Only</option>
                  <option value="study_session">Study Session</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] text-slate-400 mb-1">
                  Minimum Activity Count
                </label>
                <input
                  type="number"
                  min={1}
                  max={25}
                  value={config.recoveryRequiredCount}
                  onChange={(e) =>
                    setConfig({ ...config, recoveryRequiredCount: Number(e.target.value) })
                  }
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] text-slate-400 mb-1">
                  Recovery Cooldown (Days)
                </label>
                <input
                  type="number"
                  min={0}
                  max={30}
                  value={config.recoveryCooldownDays}
                  onChange={(e) =>
                    setConfig({ ...config, recoveryCooldownDays: Number(e.target.value) })
                  }
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] text-slate-400 mb-1">
                  Monthly Recovery Cap
                </label>
                <input
                  type="number"
                  min={0}
                  max={10}
                  value={config.maxRecoveriesPerMonth}
                  onChange={(e) =>
                    setConfig({ ...config, maxRecoveriesPerMonth: Number(e.target.value) })
                  }
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] text-slate-400 mb-1">
                  Default Campus Timezone
                </label>
                <input
                  type="text"
                  value={config.defaultTimezone}
                  onChange={(e) => setConfig({ ...config, defaultTimezone: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-white font-mono"
                />
              </div>
            </div>
          </div>

          {/* 2. Weekly Goals & Notification Throttling */}
          <div className="p-5 rounded-2xl bg-slate-900/75 border border-slate-800 space-y-4">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-sky-400" />
              <h5 className="text-sm font-bold text-white">
                Goals & Notification Throttling Rules
              </h5>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">
                  Weekly Student XP Goal
                </label>
                <input
                  type="number"
                  min={50}
                  max={5000}
                  value={config.weeklyStudentXpGoal}
                  onChange={(e) =>
                    setConfig({ ...config, weeklyStudentXpGoal: Number(e.target.value) })
                  }
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] text-slate-400 mb-1">
                  Weekly Faculty Actions Goal
                </label>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={config.weeklyFacultyActionsGoal}
                  onChange={(e) =>
                    setConfig({ ...config, weeklyFacultyActionsGoal: Number(e.target.value) })
                  }
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] text-slate-400 mb-1">
                  Max Concurrent Flyouts (1–3)
                </label>
                <input
                  type="number"
                  min={1}
                  max={3}
                  value={config.maxVisibleFlyouts}
                  onChange={(e) =>
                    setConfig({ ...config, maxVisibleFlyouts: Number(e.target.value) })
                  }
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] text-slate-400 mb-1">
                  Flyout Cooldown (Seconds)
                </label>
                <input
                  type="number"
                  min={5}
                  max={600}
                  value={config.flyoutCooldownSeconds}
                  onChange={(e) =>
                    setConfig({ ...config, flyoutCooldownSeconds: Number(e.target.value) })
                  }
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] text-slate-400 mb-1">
                  Default Broadcast TTL (Hours)
                </label>
                <input
                  type="number"
                  min={1}
                  max={720}
                  value={config.defaultBroadcastTtlHours}
                  onChange={(e) =>
                    setConfig({ ...config, defaultBroadcastTtlHours: Number(e.target.value) })
                  }
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-white font-mono"
                />
              </div>
            </div>
          </div>
        </div>

        {/* 3. Platform Engagement Feature Flags (Super Admin Exclusive Edit) */}
        <div className="p-5 rounded-2xl bg-slate-900/75 border border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-emerald-400" />
              <h5 className="text-sm font-bold text-white">Engagement System 2.0 Feature Modules</h5>
            </div>
            {!isSuperAdmin && (
              <span className="text-[11px] text-amber-300 flex items-center gap-1">
                <Lock className="w-3 h-3" />
                Super Admin Only
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            {(
              [
                ['dailyMissions', 'Daily Missions'],
                ['streakRecovery', 'Streak Recovery'],
                ['levelUpCelebration', 'Level-Up Modal'],
                ['badgeCelebration', 'Badge Unlock Modal'],
                ['smartReturn', 'Smart Return Card'],
                ['facultyChecklists', 'Faculty Checklists'],
                ['adminOpsTasks', 'Admin Ops Tasks'],
              ] as const
            ).map(([key, label]) => (
              <label
                key={key}
                className={`p-3 rounded-xl border border-white/10 bg-slate-950/70 flex items-center justify-between gap-2 ${
                  isSuperAdmin ? 'cursor-pointer hover:border-indigo-500/40' : 'opacity-65 cursor-not-allowed'
                }`}
              >
                <span className="text-slate-200 font-medium">{label}</span>
                <input
                  type="checkbox"
                  disabled={!isSuperAdmin}
                  checked={Boolean(config.featureFlags[key])}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      featureFlags: {
                        ...config.featureFlags,
                        [key]: e.target.checked,
                      },
                    })
                  }
                  className="rounded border-slate-700 bg-slate-900 text-emerald-500"
                />
              </label>
            ))}
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-black flex items-center gap-2 shadow-lg shadow-indigo-600/20 cursor-pointer transition-colors"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? 'Saving Policy...' : 'Save Policy & Record Audit Entry'}</span>
          </button>
        </div>
      </form>

      {/* 4. Immutable Engagement Policy Audit Trail */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-slate-400" />
            <h5 className="text-xs font-bold uppercase tracking-wider text-slate-300">
              Engagement Policy Change History
            </h5>
          </div>
          <span className="text-[11px] font-mono text-slate-400">{auditLogs.length} entries</span>
        </div>

        {auditLogs.length === 0 ? (
          <div className="p-6 text-center text-xs text-slate-400">
            No policy modifications logged yet. Saving changes above writes an immutable server record.
          </div>
        ) : (
          <div className="divide-y divide-slate-800/80 max-h-72 overflow-y-auto">
            {auditLogs.map((entry) => (
              <div key={entry.id} className="px-5 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                <div className="space-y-0.5 min-w-0">
                  <div className="flex items-center gap-2 text-slate-200 font-semibold">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span className="truncate">{entry.summary}</span>
                  </div>
                  <p className="text-[11px] text-slate-400 font-mono">
                    {entry.actorEmail || entry.actorUserId} · {entry.actorRole}
                  </p>
                </div>
                <span className="text-[11px] font-mono text-slate-400 shrink-0">
                  {new Date(entry.createdAt).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
