/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Veylentra Role-Aware Engagement, Streak, Mission & Weekly Summary Panel
 * Adapts deliberately across Student, Teacher, Coordinator, Admin & Super Admin:
 * - Zero hardcoded fake streak fallbacks (displays 0 or exact server value)
 * - Displays streak state: active | at_risk | frozen | recovery_available | recovered | expired
 * - Verified Streak Recovery requires real server-confirmed learning evidence
 * - Strict role separation (Admin/Teacher/Coordinator never see Student flashcard missions)
 */

import React, { useState } from 'react';
import {
  Flame,
  ShieldCheck,
  CheckCircle2,
  Clock,
  ArrowRight,
  Sparkles,
  Calendar,
  Award,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';
import { EngagementOverview, UserProfile } from '../../types';
import {
  claimEngagementMission,
  recoverUserStreak,
} from '../../lib/engagementService';
import {
  getAuthorizedGrades,
  getAuthorizedSections,
} from '../../config/facultyPermissions';

interface UnifiedEngagementPanelProps {
  currentUser: UserProfile;
  effectiveRole: string;
  overview: EngagementOverview | null;
  loading?: boolean;
  compactMode?: boolean;
  onNavigateTab: (tabId: string, subTab?: string) => void;
  showNotification?: (msg: string) => void;
  onRefresh?: () => void;
}

const STREAK_STATE_META: Record<
  string,
  { label: string; border: string; text: string; bg: string }
> = {
  active: {
    label: 'Active',
    border: 'border-emerald-500/30',
    text: 'text-emerald-300',
    bg: 'bg-emerald-500/10',
  },
  at_risk: {
    label: 'Keep Going Today',
    border: 'border-amber-500/30',
    text: 'text-amber-300',
    bg: 'bg-amber-500/10',
  },
  frozen: {
    label: 'Frozen · Protected',
    border: 'border-cyan-500/35',
    text: 'text-cyan-300',
    bg: 'bg-cyan-500/10',
  },
  recovery_available: {
    label: 'Recovery Available',
    border: 'border-sky-500/40',
    text: 'text-sky-200',
    bg: 'bg-sky-500/15',
  },
  recovered: {
    label: 'Recovered',
    border: 'border-emerald-500/35',
    text: 'text-emerald-300',
    bg: 'bg-emerald-500/15',
  },
  expired: {
    label: 'Reset Ready',
    border: 'border-slate-700',
    text: 'text-slate-300',
    bg: 'bg-slate-800/70',
  },
};

export const UnifiedEngagementPanel: React.FC<UnifiedEngagementPanelProps> = ({
  currentUser,
  effectiveRole,
  overview,
  loading = false,
  compactMode = false,
  onNavigateTab,
  showNotification,
  onRefresh,
}) => {
  const role = (effectiveRole || currentUser?.role || 'student').toLowerCase();
  const isStudent = role === 'student';
  const isCoordinator = role === 'coordinator';
  const isAdmin = role === 'admin' || role === 'super_admin';
  const isTeacher = role === 'teacher';

  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [recovering, setRecovering] = useState<boolean>(false);

  const streakCount = overview?.streak?.currentStreak ?? currentUser?.streakDays ?? 0;
  const longestStreak = overview?.streak?.longestStreak ?? currentUser?.longestStreak ?? streakCount;
  const streakState = overview?.streak?.streakState ?? currentUser?.streakState ?? 'active';
  const stateMeta = STREAK_STATE_META[streakState] || STREAK_STATE_META.active;

  const authorizedGrades = getAuthorizedGrades(currentUser);
  const authorizedSections = getAuthorizedSections(currentUser);

  const handleClaimMission = async (missionId: string) => {
    setClaimingId(missionId);
    const res = await claimEngagementMission(currentUser, role, missionId);
    setClaimingId(null);
    if (res.success) {
      showNotification?.(`+${res.xpAwarded || 25} XP added from completed mission!`);
      onRefresh?.();
    } else {
      showNotification?.(res.error || 'Complete the task requirements first.');
    }
  };

  const handleVerifiedRecovery = async () => {
    if (!overview) return;
    setRecovering(true);
    const reqActivity =
      overview.streak.recoveryRequiredActivity ||
      (isTeacher
        ? 'attendance_mark'
        : isAdmin
          ? 'admin_audit'
          : isCoordinator
            ? 'oversight_review'
            : 'flashcards');
    const res = await recoverUserStreak(
      currentUser,
      reqActivity,
      overview.streak.recoveryCurrentProgress || 0,
      role
    );
    setRecovering(false);
    if (res.success) {
      showNotification?.(
        `Streak restored to ${res.newStreak} days! (+${res.xpRewarded || 35} XP)`
      );
      onRefresh?.();
    } else {
      showNotification?.(res.error || 'Complete the required recovery mission first.');
    }
  };

  const missions = overview?.missions || [];
  const weekly = overview?.weeklySummary;
  const weeklyTarget = Math.max(1, weekly?.weeklyGoalTarget || (isStudent ? 300 : 12));
  const weeklyCurrent = isStudent
    ? weekly?.xpEarnedThisWeek || 0
    : weekly?.actionsCompletedThisWeek || 0;
  const weeklyPct = Math.min(100, Math.round((weeklyCurrent / weeklyTarget) * 100));

  const showRecoveryPanel =
    overview?.policy?.streakRecoveryEnabled &&
    (streakState === 'frozen' || streakState === 'recovery_available') &&
    overview.streak.frozenStreakCount > 0;

  return (
    <section
      className="rounded-2xl bg-slate-900/90 border border-slate-800 p-4 sm:p-6 space-y-5 shadow-md"
      aria-label="Engagement and progression overview"
    >
      {/* Header Row: Role Context + Authoritative Streak + Weekly Progress */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
        <div className="space-y-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
            <span className="font-semibold text-indigo-300">
              {isStudent
                ? 'Daily Momentum'
                : isTeacher
                  ? 'Teaching Workflow'
                  : isCoordinator
                    ? 'Department Oversight'
                    : 'Institutional Operations'}
            </span>
            <span aria-hidden="true" className="text-slate-600">·</span>
            <span className="capitalize">{role.replace('_', ' ')}</span>
            {isCoordinator && authorizedGrades.length > 0 && (
              <>
                <span aria-hidden="true" className="text-slate-600">·</span>
                <span className="text-slate-300 font-medium">
                  Scope: {authorizedGrades.join(', ')}
                  {authorizedSections.length > 0 ? ` (${authorizedSections.join(', ')})` : ''}
                </span>
              </>
            )}
            <span aria-hidden="true" className="text-slate-600">·</span>
            <span className={`font-semibold ${stateMeta.text}`}>{stateMeta.label}</span>
          </div>
          <h3 className="text-base sm:text-lg font-bold font-display text-white tracking-tight">
            {isStudent
              ? 'Study Consistency & Missions'
              : isTeacher
                ? 'Daily Classroom Checklist'
                : isCoordinator
                  ? 'Scoped Cohort Checklist'
                  : 'Governance & Policy Readiness'}
          </h3>
        </div>

        {/* Metrics Strip: Streak / Best / XP */}
        <div className="grid grid-cols-3 gap-2.5 shrink-0">
          <div className={`px-3 py-2 rounded-xl border ${stateMeta.border} ${stateMeta.bg} min-w-[96px]`}>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block">
              Current Streak
            </span>
            <div className="flex items-center gap-1.5 mt-0.5">
              <Flame className="w-4 h-4 text-amber-400 shrink-0" />
              <span className="text-base font-bold font-mono tabular-nums text-white">
                {loading && !overview ? '—' : `${streakCount}d`}
              </span>
            </div>
          </div>

          <div className="px-3 py-2 rounded-xl border border-slate-800 bg-slate-950/60 min-w-[88px]">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block">
              Best Streak
            </span>
            <div className="flex items-center gap-1.5 mt-0.5">
              <Award className="w-4 h-4 text-indigo-400 shrink-0" />
              <span className="text-base font-bold font-mono tabular-nums text-white">
                {loading && !overview ? '—' : `${longestStreak}d`}
              </span>
            </div>
          </div>

          <div className="px-3 py-2 rounded-xl border border-slate-800 bg-slate-950/60 min-w-[96px]">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block">
              {isAdmin || isTeacher || isCoordinator ? 'Rank XP' : 'Scholar XP'}
            </span>
            <span className="text-base font-bold font-mono tabular-nums text-amber-300 block mt-0.5">
              {(overview?.xp ?? currentUser?.points ?? currentUser?.xp ?? 0).toLocaleString()}
            </span>
          </div>
        </div>
      </div>

      {/* Calm Smart Return Banner (Students only, no guilt copy) */}
      {isStudent && overview?.smartReturn && !compactMode && (
        <div className="p-4 rounded-xl bg-slate-950/70 border border-indigo-500/25 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-indigo-300">
              <Sparkles className="w-3.5 h-3.5 shrink-0" />
              <span>{overview.smartReturn.title}</span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              {overview.smartReturn.subtitle}
            </p>
          </div>
          <button
            type="button"
            onClick={() =>
              onNavigateTab(overview.smartReturn!.actionTab, overview.smartReturn!.actionSubTab)
            }
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shrink-0 cursor-pointer flex items-center gap-1.5 transition-colors"
          >
            <span>{overview.smartReturn.ctaLabel}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Server-Verified Streak Recovery Flow (Student missed 1-2 days, no free 1-click bypass) */}
      {showRecoveryPanel && overview && (
        <div className="p-4 rounded-xl bg-cyan-950/35 border border-cyan-500/35 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xs font-bold text-cyan-200">
                <ShieldCheck className="w-4 h-4 text-cyan-400 shrink-0" />
                <span>
                  {overview.streak.frozenStreakCount}-Day Streak Protected — Complete Recovery Study Mission
                </span>
              </div>
              <p className="text-xs text-slate-300">
                {overview.streak.recoveryBlockedReason
                  ? overview.streak.recoveryBlockedReason
                  : `Finish ${overview.streak.recoveryRequiredCount} flashcards or a verified quiz to restore your streak. (${overview.streak.recoveriesThisMonth}/${overview.streak.maxRecoveriesPerMonth} monthly recoveries used)`}
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs font-mono tabular-nums text-cyan-300 bg-slate-950/70 px-2.5 py-1.5 rounded-lg border border-cyan-500/30">
                {overview.streak.recoveryCurrentProgress}/{overview.streak.recoveryRequiredCount}
              </span>
              {overview.streak.recoveryCurrentProgress < overview.streak.recoveryRequiredCount ? (
                <button
                  type="button"
                  onClick={() => onNavigateTab('study_hub', 'flashcards')}
                  className="px-3.5 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold cursor-pointer transition-colors"
                >
                  Study Flashcards
                </button>
              ) : (
                <button
                  type="button"
                  disabled={recovering || !overview.streak.recoveryEligible}
                  onClick={handleVerifiedRecovery}
                  className="px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 text-xs font-bold cursor-pointer flex items-center gap-1.5 transition-colors"
                >
                  {recovering ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                  <span>Restore Streak</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Role-Specific Missions / Checklists Grid */}
      {missions.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {(compactMode ? missions.slice(0, 3) : missions).map((mission) => {
            const pct = Math.min(
              100,
              Math.round((mission.progressValue / Math.max(1, mission.targetValue)) * 100)
            );
            const isClaimed = mission.status === 'claimed';
            const isReadyToClaim = mission.status === 'completed';

            return (
              <div
                key={mission.id}
                className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 flex flex-col justify-between gap-3"
              >
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2 text-[11px] text-slate-400">
                    <span className="uppercase tracking-wider font-semibold text-indigo-300">
                      {mission.period}
                    </span>
                    <span className="font-mono tabular-nums text-amber-300 font-semibold">
                      +{mission.rewardXp} XP
                      {mission.estimatedMinutes ? ` · ${mission.estimatedMinutes}m` : ''}
                    </span>
                  </div>
                  <h4 className="text-xs sm:text-sm font-bold text-white leading-snug">
                    {mission.title}
                  </h4>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    {mission.description}
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-[11px] font-mono tabular-nums text-slate-400">
                    <span>Progress</span>
                    <span className="text-slate-200">
                      {mission.progressValue}/{mission.targetValue}
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        isClaimed || isReadyToClaim ? 'bg-emerald-400' : 'bg-indigo-500'
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>

                  {isClaimed ? (
                    <div className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-400 pt-0.5">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Completed & Claimed</span>
                    </div>
                  ) : isReadyToClaim ? (
                    <button
                      type="button"
                      disabled={claimingId === mission.id}
                      onClick={() => handleClaimMission(mission.id)}
                      className="w-full py-1.5 px-3 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold cursor-pointer transition-colors"
                    >
                      {claimingId === mission.id ? 'Saving...' : `Claim +${mission.rewardXp} XP`}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onNavigateTab(mission.actionTab)}
                      className="w-full py-1.5 px-3 rounded-lg bg-slate-800/80 hover:bg-slate-800 text-slate-200 text-xs font-semibold cursor-pointer flex items-center justify-between transition-colors"
                    >
                      <span>{mission.actionLabel}</span>
                      <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Weekly Progress & Policy Footnote */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-slate-800/80 text-xs">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
          <div className="flex-1 min-w-0 space-y-1">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-300 font-medium">
                Weekly Goal · {weekly?.activeDaysThisWeek || 0} active days this week
              </span>
              <span className="font-mono tabular-nums text-slate-200">
                {weeklyCurrent}/{weeklyTarget} {weekly?.weeklyGoalUnit || (isStudent ? 'XP' : 'actions')}
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden max-w-md">
              <div
                className="h-full rounded-full bg-amber-400 transition-all duration-300"
                style={{ width: `${weeklyPct}%` }}
              />
            </div>
          </div>
        </div>

        {isAdmin && (
          <button
            type="button"
            onClick={() => onNavigateTab('admin')}
            className="text-xs font-semibold text-indigo-300 hover:text-indigo-200 flex items-center gap-1 shrink-0 cursor-pointer"
          >
            <span>Configure Policies</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </section>
  );
};
