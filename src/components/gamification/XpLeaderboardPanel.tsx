/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Separated XP Leaderboard Panel
 * Strictly separates Student XP Leaderboard from Faculty XP Leaderboard.
 * Supports Weekly (7d), Monthly (30d), and All-Time windows with Top-3 animated podium,
 * level progression bars, private field exclusion, and sticky current-user rank footer.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Trophy, RefreshCw, Flame, ShieldAlert, GraduationCap, Users } from 'lucide-react';
import { UserProfile } from '../../types';
import { useFeatureAccess } from '../../lib/featureAccessService';
import {
  fetchSeparatedLeaderboard,
  LeaderboardEntry,
} from '../../lib/winterFestivalService';
import {
  AnimatedEmptyState,
  AnimatedSkeleton,
  AnimatedTabs,
  NumberTicker,
  TactileButton,
} from '../ui/animatedComponents';
import { WinterCookieSvg } from '../winter/WinterArtwork';

interface XpLeaderboardPanelProps {
  type: 'student' | 'faculty';
  currentUser: UserProfile;
  compact?: boolean;
  maxRows?: number;
  onViewFull?: () => void;
}

const FRAME_RING_MAP: Record<string, string> = {
  frame_frost_halo: 'ring-2 ring-sky-400 shadow-[0_0_12px_rgba(56,189,248,0.45)]',
  frame_aurora_crown: 'ring-2 ring-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.45)]',
  frame_starlight_crest: 'ring-2 ring-amber-400 shadow-[0_0_12px_rgba(251,191,36,0.5)]',
};

export const XpLeaderboardPanel: React.FC<XpLeaderboardPanelProps> = ({
  type,
  currentUser,
  compact = false,
  maxRows,
  onViewFull,
}) => {
  const featureKey = type === 'faculty' ? 'faculty_xp_leaderboard' : 'student_xp_leaderboard';
  const access = useFeatureAccess(featureKey, currentUser);

  const [period, setPeriod] = useState<'weekly' | 'monthly' | 'all_time'>('weekly');
  const [rankings, setRankings] = useState<LeaderboardEntry[]>([]);
  const [currentUserEntry, setCurrentUserEntry] = useState<LeaderboardEntry | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const loadLeaderboard = useCallback(async () => {
    if (!access.accessible) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    const res = await fetchSeparatedLeaderboard({
      type,
      period,
      user: currentUser,
    });
    if (!res.ok || !res.data) {
      setError(res.error || 'Unable to load leaderboard.');
      setRankings([]);
      setCurrentUserEntry(null);
    } else {
      setRankings(res.data.rankings || []);
      setCurrentUserEntry(res.data.currentUserEntry || null);
    }
    setLoading(false);
  }, [access.accessible, type, period, currentUser]);

  useEffect(() => {
    loadLeaderboard();
  }, [loadLeaderboard]);

  useEffect(() => {
    const onSync = () => {
      loadLeaderboard();
    };
    window.addEventListener('studentos-gamification-updated', onSync);
    window.addEventListener('veylentra-winter-updated', onSync);
    return () => {
      window.removeEventListener('studentos-gamification-updated', onSync);
      window.removeEventListener('veylentra-winter-updated', onSync);
    };
  }, [loadLeaderboard]);

  if (!access.accessible) {
    return null;
  }

  const visibleRankings = typeof maxRows === 'number' ? rankings.slice(0, maxRows) : rankings;
  const topThree = rankings.slice(0, 3);
  const podiumOrder =
    topThree.length === 3
      ? [topThree[1], topThree[0], topThree[2]]
      : topThree;

  const isFaculty = type === 'faculty';

  return (
    <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 shadow-sm overflow-hidden">
      {access.isPreviewOnly && (
        <div className="px-4 py-2 bg-amber-500/15 border-b border-amber-500/30 flex items-center justify-between gap-2 text-xs text-amber-800 dark:text-amber-300">
          <div className="flex items-center gap-2 font-medium">
            <ShieldAlert className="w-4 h-4 shrink-0" />
            <span>Super Admin Preview Mode — This leaderboard is currently disabled for regular users.</span>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
            isFaculty
              ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/25'
              : 'bg-sky-500/15 text-sky-600 dark:text-sky-400 border border-sky-500/25'
          }`}>
            {isFaculty ? <GraduationCap className="w-5 h-5" /> : <Trophy className="w-5 h-5" />}
          </div>
          <div className="min-w-0">
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 truncate">
              {isFaculty ? 'Faculty Academic Impact Leaderboard' : 'Student Scholar XP Leaderboard'}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {isFaculty
                ? 'Faculty-only cohort · Evaluated submissions, attendance & announcements'
                : 'Student-only cohort · Verified academic study, quizzes & seasonal achievements'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <AnimatedTabs
            layoutId={`lb-period-${type}-${compact ? 'compact' : 'full'}`}
            activeTab={period}
            onTabChange={(id) => setPeriod(id as 'weekly' | 'monthly' | 'all_time')}
            tabs={[
              { id: 'weekly', label: 'Weekly' },
              { id: 'monthly', label: 'Monthly' },
              { id: 'all_time', label: 'All-Time' },
            ]}
          />
          <button
            type="button"
            onClick={loadLeaderboard}
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            aria-label="Refresh leaderboard"
            title="Refresh rankings"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          {onViewFull && (
            <TactileButton variant="outline" size="sm" onClick={onViewFull}>
              Full Board
            </TactileButton>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="p-4 sm:p-5 space-y-5">
        {loading ? (
          <div className="space-y-3">
            {[0, 1, 2, 3].map((idx) => (
              <AnimatedSkeleton key={idx} height={54} className="w-full" />
            ))}
          </div>
        ) : error ? (
          <div className="p-4 rounded-xl border border-rose-500/30 bg-rose-500/10 text-xs text-rose-700 dark:text-rose-300 flex items-center justify-between gap-3">
            <span>{error}</span>
            <TactileButton variant="outline" size="sm" onClick={loadLeaderboard}>
              Retry
            </TactileButton>
          </div>
        ) : rankings.length === 0 ? (
          <AnimatedEmptyState
            icon={<Users className="w-8 h-8" />}
            title={isFaculty ? 'No faculty XP recorded for this window yet' : 'No student XP recorded for this window yet'}
            description={
              period === 'weekly'
                ? 'Complete assignments, quizzes, attendance logs, or Winter Festival activities this week to claim the top rank.'
                : 'Verified XP entries will appear here automatically as activity progresses.'
            }
          />
        ) : (
          <>
            {/* Top 3 Podium (hidden in ultra-compact widgets if fewer than 2 entries) */}
            {!compact && podiumOrder.length >= 2 && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                {podiumOrder.map((entry) => {
                  const isFirst = entry.rank === 1;
                  const frameClass = entry.equippedFrame ? FRAME_RING_MAP[entry.equippedFrame] || '' : '';
                  const rankColors =
                    entry.rank === 1
                      ? 'border-amber-400/50 bg-amber-500/10'
                      : entry.rank === 2
                      ? 'border-slate-400/40 bg-slate-500/10'
                      : 'border-orange-500/40 bg-orange-500/10';
                  return (
                    <motion.div
                      key={entry.userId}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.25, delay: entry.rank * 0.05 }}
                      className={`rounded-xl border p-4 text-center flex flex-col items-center gap-2 ${rankColors} ${
                        isFirst ? 'sm:order-2 sm:py-5' : entry.rank === 2 ? 'sm:order-1' : 'sm:order-3'
                      }`}
                    >
                      <span className="text-xs font-mono font-bold tabular-nums text-slate-600 dark:text-slate-300">
                        Rank #{entry.rank}
                      </span>
                      <div
                        className={`w-12 h-12 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-sm font-bold text-slate-800 dark:text-slate-100 overflow-hidden ${frameClass}`}
                      >
                        {entry.avatar && entry.avatar.startsWith('http') ? (
                          <img src={entry.avatar} alt={entry.name} className="w-full h-full object-cover" />
                        ) : (
                          entry.name.slice(0, 2).toUpperCase()
                        )}
                      </div>
                      <div className="min-w-0 w-full">
                        <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{entry.name}</p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                          {entry.grade || entry.role}
                          {entry.section ? ` · ${entry.section}` : ''}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 text-sm font-bold font-mono tabular-nums text-sky-600 dark:text-sky-400">
                        <NumberTicker value={entry.xp} />
                        <span className="text-xs">XP</span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        Lv.{entry.level} {entry.levelTitle}
                      </p>
                    </motion.div>
                  );
                })}
              </div>
            )}

            {/* Rankings Table */}
            <div className="divide-y divide-slate-200 dark:divide-slate-800 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
              {visibleRankings.map((entry, idx) => {
                const isSelf = entry.userId === currentUser.uid;
                const frameClass = entry.equippedFrame ? FRAME_RING_MAP[entry.equippedFrame] || '' : '';
                const progressPct = entry.nextLevelXp
                  ? Math.min(100, Math.round((entry.xp / entry.nextLevelXp) * 100))
                  : 100;

                return (
                  <motion.div
                    key={entry.userId}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.16, delay: Math.min(idx * 0.02, 0.2) }}
                    className={`flex items-center justify-between gap-3 px-3.5 py-2.5 transition-colors ${
                      isSelf
                        ? 'bg-sky-500/10 dark:bg-sky-500/15'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <span
                        className={`w-7 text-center font-mono text-xs font-bold tabular-nums shrink-0 ${
                          entry.rank === 1
                            ? 'text-amber-500'
                            : entry.rank === 2
                            ? 'text-slate-400'
                            : entry.rank === 3
                            ? 'text-orange-500'
                            : 'text-slate-500 dark:text-slate-400'
                        }`}
                      >
                        #{entry.rank}
                      </span>

                      <div
                        className={`w-9 h-9 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-xs font-bold text-slate-800 dark:text-slate-100 shrink-0 overflow-hidden ${frameClass}`}
                      >
                        {entry.avatar && entry.avatar.startsWith('http') ? (
                          <img src={entry.avatar} alt={entry.name} className="w-full h-full object-cover" />
                        ) : (
                          entry.name.slice(0, 2).toUpperCase()
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                            {entry.name}
                          </span>
                          {isSelf && (
                            <span className="text-[10px] font-semibold text-sky-600 dark:text-sky-400">
                              (You)
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400 truncate">
                          <span>Lv.{entry.level} {entry.levelTitle}</span>
                          {entry.grade && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span>{entry.grade}</span>
                            </>
                          )}
                          {entry.badgesCount > 0 && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="tabular-nums">{entry.badgesCount} badges</span>
                            </>
                          )}
                        </div>
                        {!compact && (
                          <div className="mt-1.5 h-1.5 w-full max-w-xs rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                            <div
                              className="h-full rounded-full bg-sky-500 transition-all duration-300"
                              style={{ width: `${progressPct}%` }}
                            />
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      {entry.currentStreak > 0 && (
                        <span
                          className="hidden sm:inline-flex items-center gap-1 text-xs font-mono tabular-nums text-amber-600 dark:text-amber-400"
                          title="Study Streak"
                        >
                          <Flame className="w-3.5 h-3.5" />
                          {entry.currentStreak}d
                        </span>
                      )}
                      {entry.winterCookies > 0 && (
                        <span
                          className="hidden md:inline-flex items-center gap-1 text-xs font-mono tabular-nums text-amber-700 dark:text-amber-300"
                          title="Winter Cookies"
                        >
                          <WinterCookieSvg size={14} />
                          {entry.winterCookies}
                        </span>
                      )}
                      <span className="text-sm font-bold font-mono tabular-nums text-slate-900 dark:text-white min-w-[64px] text-right">
                        {entry.xp.toLocaleString()} XP
                      </span>
                    </div>
                  </motion.div>
                );
              })}
            </div>

            {/* Sticky Current-User Rank Footer */}
            {currentUserEntry && (
              <div className="rounded-xl border border-sky-500/30 bg-sky-500/10 px-4 py-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-xs font-mono font-bold tabular-nums text-sky-700 dark:text-sky-300">
                    Your Rank #{currentUserEntry.rank}
                  </span>
                  <span className="text-xs text-slate-700 dark:text-slate-300 truncate">
                    Lv.{currentUserEntry.level} {currentUserEntry.levelTitle}
                  </span>
                </div>
                <span className="text-sm font-bold font-mono tabular-nums text-sky-700 dark:text-sky-300">
                  {currentUserEntry.xp.toLocaleString()} XP
                </span>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
};
