/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Veylentra Winter Festival Hub + Compact Dashboard Banner
 * Integrates verified Winter Tasks, interactive 3-question Knowledge Check mini-quiz,
 * separated Collectible Winter Badges, Profile Frames, Nightly Santa Gift,
 * 2-Hour Spin Wheel, and Role-Separated XP Leaderboards.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Award, CheckCircle2, Gift, HelpCircle, Lock, RotateCw, ShieldAlert, Sparkles } from 'lucide-react';
import { UserProfile } from '../../types';
import { useFeatureAccess } from '../../lib/featureAccessService';
import {
  claimWinterTask,
  equipWinterBorder,
  equipWinterFrame,
  fetchWinterStatus,
  formatCountdownMs,
  submitWinterQuiz,
  WinterStatusResponse,
  WinterTaskItem,
} from '../../lib/winterFestivalService';
import {
  AnimatedDialog,
  AnimatedSkeleton,
  NumberTicker,
  TactileButton,
} from '../ui/animatedComponents';
import { XpLeaderboardPanel } from '../gamification/XpLeaderboardPanel';
import { SantaGiftModal } from './SantaGiftModal';
import { SpinWheelModal } from './SpinWheelModal';
import { WinterCosmeticAvatar } from './WinterCosmeticAvatar';
import { getWinterBorderVisual, getWinterFrameVisual } from '../../lib/winterCosmetics';
import {
  CandyCaneAccent,
  FrostShieldSvg,
  SantaGiftBoxSvg,
  SnowCapAccent,
  SnowflakeVector,
  WinterCookieSvg,
} from './WinterArtwork';

interface WinterHubProps {
  currentUser: UserProfile;
  showNotification?: (msg: string, type?: 'success' | 'error' | 'info') => void;
  onNavigateTab?: (tab: string) => void;
}

function getTaskProgress(task: WinterTaskItem, status: WinterStatusResponse): { current: number; target: number; eligible: boolean } {
  const ws = status.winterState;
  switch (task.verificationMode) {
    case 'hub_visit':
      return { current: 1, target: 1, eligible: true };
    case 'winter_quiz':
      return { current: ws.quizCompleted ? 1 : 0, target: 1, eligible: Boolean(ws.quizCompleted) };
    case 'study_check':
      return { current: Math.min(5, ws.cookiesCount || 0), target: 5, eligible: (ws.cookiesCount || 0) >= 5 };
    case 'spin_or_santa': {
      const done = (ws.rewardHistory || []).some(r => r.featureType === 'spin_wheel' || r.featureType === 'santa_gift');
      return { current: done ? 1 : 0, target: 1, eligible: done };
    }
    case 'academic_action': {
      return { current: task.claimed ? 1 : 0, target: 1, eligible: true };
    }
    default:
      return { current: task.claimed ? 1 : 0, target: 1, eligible: true };
  }
}

function getWinterBadgeProgress(badgeId: string, status: WinterStatusResponse, unlocked: boolean): { label: string } | null {
  const ws = status.winterState;
  const cookies = ws.cookiesCount || 0;
  const tasksDone = (ws.claimedTaskIds || []).length;
  switch (badgeId) {
    case 'snowflake_explorer':
      return { label: unlocked ? '1 / 1 arrival task' : '0 / 1 arrival task' };
    case 'winter_scholar':
      return { label: ws.quizCompleted ? '1 / 1 quiz passed' : '0 / 1 quiz passed' };
    case 'frosty_focus':
      return { label: unlocked ? '1 / 1 study task' : '0 / 1 study task' };
    case 'cookie_collector':
      return { label: `${Math.min(5, cookies)} / 5 Cookies` };
    case 'winter_champion': {
      const done = (ws.rewardHistory || []).some(r => r.featureType === 'spin_wheel' || r.featureType === 'santa_gift');
      return { label: done || unlocked ? '1 / 1 spin or gift' : '0 / 1 spin or gift' };
    }
    case 'north_star_secret':
      return { label: unlocked ? 'Secret Unlocked' : `${Math.min(15, cookies)}/15 Cookies · ${Math.min(3, tasksDone)}/3 Tasks` };
    default:
      return null;
  }
}

export const WinterDashboardBanner: React.FC<WinterHubProps> = ({
  currentUser,
  showNotification,
  onNavigateTab,
}) => {
  const themeAccess = useFeatureAccess('winter_theme', currentUser);
  const santaAccess = useFeatureAccess('winter_santa_gifts', currentUser);
  const wheelAccess = useFeatureAccess('winter_spin_wheel', currentUser);
  const tasksAccess = useFeatureAccess('winter_festival_tasks', currentUser);

  const anyWinterVisible =
    themeAccess.accessible ||
    santaAccess.accessible ||
    wheelAccess.accessible ||
    tasksAccess.accessible;

  const [status, setStatus] = useState<WinterStatusResponse | null>(null);
  const [santaOpen, setSantaOpen] = useState(false);
  const [wheelOpen, setWheelOpen] = useState(false);

  const load = useCallback(async () => {
    if (!anyWinterVisible || !currentUser?.uid) return;
    const data = await fetchWinterStatus(currentUser);
    if (data) setStatus(data);
  }, [anyWinterVisible, currentUser]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const onSync = () => load();
    window.addEventListener('veylentra-winter-updated', onSync);
    return () => window.removeEventListener('veylentra-winter-updated', onSync);
  }, [load]);

  if (!anyWinterVisible) return null;

  return (
    <div className="rounded-2xl border border-sky-400/30 bg-slate-900/85 text-white overflow-hidden shadow-sm">
      <SnowCapAccent />
      <div className="p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5 min-w-0">
          <div className="w-11 h-11 rounded-xl bg-sky-500/15 border border-sky-400/30 flex items-center justify-center shrink-0">
            <SnowflakeVector size={22} className="text-sky-300" />
          </div>
          <div className="min-w-0 space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm sm:text-base font-bold text-white">
                Veylentra Winter Festival
              </h3>
              {(themeAccess.isPreviewOnly || santaAccess.isPreviewOnly) && (
                <span className="text-[11px] font-medium text-amber-300">
                  · Super Admin Preview
                </span>
              )}
            </div>
            <p className="text-xs text-slate-300">
              Complete verified study tasks, unwrap nightly Santa Drops (7–9 PM IST), and spin the 2-hour Reward Wheel.
            </p>
            {status && (
              <div className="flex items-center gap-4 pt-1 text-xs font-mono tabular-nums text-sky-200 flex-wrap">
                <span className="inline-flex items-center gap-1.5">
                  <WinterCookieSvg size={14} />
                  {status.winterState.cookiesCount} Cookies
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <FrostShieldSvg size={14} />
                  {status.winterState.streakShields}/3 Shields
                </span>
                <span>AI Bonus Today: +{status.winterState.aiBonusCreditsToday}/5</span>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap shrink-0">
          {santaAccess.accessible && (
            <TactileButton
              variant="secondary"
              size="sm"
              onClick={() => {
                load();
                setSantaOpen(true);
              }}
              icon={<SantaGiftBoxSvg size={16} />}
            >
              {status?.santa?.window?.isOpen ? 'Claim Santa Gift' : 'Santa Drop (7–9 PM)'}
            </TactileButton>
          )}
          {wheelAccess.accessible && (
            <TactileButton
              variant="outline"
              size="sm"
              onClick={() => {
                load();
                setWheelOpen(true);
              }}
            >
              {status?.spinWheel?.canSpin
                ? 'Spin Wheel Ready'
                : `Wheel ${formatCountdownMs(status?.spinWheel?.remainingMs || 0)}`}
            </TactileButton>
          )}
          {onNavigateTab && (
            <TactileButton
              variant="primary"
              size="sm"
              onClick={() => onNavigateTab('winter_festival')}
            >
              Open Winter Hub
            </TactileButton>
          )}
        </div>
      </div>

      <SantaGiftModal
        isOpen={santaOpen}
        onClose={() => setSantaOpen(false)}
        currentUser={currentUser}
        winterStatus={status}
        onRewardClaimed={async () => {
          await load();
          showNotification?.('Santa Gift synced to your account!', 'success');
        }}
        isPreviewOnly={santaAccess.isPreviewOnly}
      />

      <SpinWheelModal
        isOpen={wheelOpen}
        onClose={() => setWheelOpen(false)}
        currentUser={currentUser}
        winterStatus={status}
        onSpinComplete={load}
        isPreviewOnly={wheelAccess.isPreviewOnly}
      />
    </div>
  );
};

export const WinterFestivalHub: React.FC<WinterHubProps> = ({
  currentUser,
  showNotification,
}) => {
  const tasksAccess = useFeatureAccess('winter_festival_tasks', currentUser);
  const badgesAccess = useFeatureAccess('winter_badges', currentUser);
  const santaAccess = useFeatureAccess('winter_santa_gifts', currentUser);
  const wheelAccess = useFeatureAccess('winter_spin_wheel', currentUser);
  const themeAccess = useFeatureAccess('winter_theme', currentUser);

  const [status, setStatus] = useState<WinterStatusResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [statusError, setStatusError] = useState<string | null>(null);
  const hasStatusRef = useRef<boolean>(false);
  const [busyTaskId, setBusyTaskId] = useState<string | null>(null);
  const [santaOpen, setSantaOpen] = useState<boolean>(false);
  const [wheelOpen, setWheelOpen] = useState<boolean>(false);
  const [quizOpen, setQuizOpen] = useState<boolean>(false);
  const [quizAnswers, setQuizAnswers] = useState<Record<string, number>>({});
  const [quizFeedback, setQuizFeedback] = useState<{
    passed: boolean;
    correctCount: number;
    total: number;
    results: Array<{ id: string; isCorrect: boolean; explanation: string }>;
  } | null>(null);
  const [submittingQuiz, setSubmittingQuiz] = useState<boolean>(false);
  const [equippingFrame, setEquippingFrame] = useState<string | null>(null);
  const [equippingBorder, setEquippingBorder] = useState<string | null>(null);

  const isFacultyRole = ['teacher', 'coordinator', 'hod', 'admin', 'super_admin'].includes(
    String(currentUser.role || '').toLowerCase()
  );

  const loadWinterData = useCallback(async () => {
    if (!hasStatusRef.current) setLoading(true);
    setStatusError(null);
    try {
      const data = await fetchWinterStatus(currentUser);
      if (data) {
        hasStatusRef.current = true;
        setStatus(data);
      } else if (!hasStatusRef.current) {
        setStatusError('Could not load Winter Festival status. Please retry.');
      }
    } catch (err: any) {
      if (!hasStatusRef.current) {
        setStatusError(err?.message || 'Could not load Winter Festival status.');
      }
    } finally {
      setLoading(false);
    }
  }, [currentUser]);

  useEffect(() => {
    loadWinterData();
  }, [loadWinterData]);

  useEffect(() => {
    const onSync = () => loadWinterData();
    window.addEventListener('veylentra-winter-updated', onSync);
    return () => window.removeEventListener('veylentra-winter-updated', onSync);
  }, [loadWinterData]);

  const handleClaimTask = async (task: WinterTaskItem) => {
    setBusyTaskId(task.id);
    const res = await claimWinterTask(currentUser, task.id);
    setBusyTaskId(null);
    if (!res.ok || !res.data?.success) {
      showNotification?.(res.data?.error || 'Could not claim Winter task yet.', 'error');
      return;
    }
    showNotification?.(`Claimed task reward (+${task.xpReward} XP)!`, 'success');
    await loadWinterData();
    window.dispatchEvent(new CustomEvent('veylentra-winter-updated'));
    window.dispatchEvent(new CustomEvent('studentos-gamification-updated'));
  };

  const handleQuizSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingQuiz(true);
    const res = await submitWinterQuiz(currentUser, quizAnswers);
    setSubmittingQuiz(false);
    if (!res.ok || !res.data?.success) {
      showNotification?.(res.data?.error || 'Unable to submit Winter Knowledge Check.', 'error');
      return;
    }
    setQuizFeedback({
      passed: Boolean(res.data.passed),
      correctCount: Number(res.data.correctCount || 0),
      total: Number(res.data.total || 3),
      results: Array.isArray(res.data.results) ? res.data.results : [],
    });
    if (res.data.passed) {
      showNotification?.('Winter Knowledge Check passed! You can now claim the task reward.', 'success');
      await loadWinterData();
    }
  };

  const handleEquipFrame = async (frameId: string | null) => {
    setEquippingFrame(frameId || 'none');
    const res = await equipWinterFrame(currentUser, frameId);
    setEquippingFrame(null);
    if (!res.ok || !res.data?.success) {
      showNotification?.(res.data?.error || 'Unable to equip profile frame.', 'error');
      return;
    }
    showNotification?.(frameId ? 'Winter profile frame equipped!' : 'Profile frame unequipped.', 'success');
    await loadWinterData();
    window.dispatchEvent(new CustomEvent('veylentra-winter-updated'));
  };

  const handleEquipBorder = async (borderId: string | null) => {
    setEquippingBorder(borderId || 'none');
    const res = await equipWinterBorder(currentUser, borderId);
    setEquippingBorder(null);
    if (!res.ok || !res.data?.success) {
      showNotification?.(res.data?.error || 'Unable to equip winter border.', 'error');
      return;
    }
    showNotification?.(borderId ? 'Winter avatar border equipped!' : 'Winter avatar border unequipped.', 'success');
    await loadWinterData();
    window.dispatchEvent(new CustomEvent('veylentra-winter-updated'));
  };

  const anyPreview =
    themeAccess.isPreviewOnly ||
    tasksAccess.isPreviewOnly ||
    badgesAccess.isPreviewOnly ||
    santaAccess.isPreviewOnly ||
    wheelAccess.isPreviewOnly;

  return (
    <div className="space-y-6">
      {anyPreview && (
        <div className="p-3.5 rounded-xl border border-amber-500/40 bg-amber-500/15 text-xs text-amber-800 dark:text-amber-200 flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 shrink-0" />
          <span>
            Super Admin Preview Mode active — One or more Winter Festival modules are turned OFF for regular users.
          </span>
        </div>
      )}

      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-900 text-white overflow-hidden shadow-sm">
        <SnowCapAccent />
        <div className="p-5 sm:p-6 space-y-5">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2.5">
                <CandyCaneAccent size={22} />
                <h2 className="text-xl sm:text-2xl font-bold tracking-tight">
                  Winter Academic Festival &amp; Seasonal Rewards
                </h2>
              </div>
              <p className="text-xs sm:text-sm text-slate-300 max-w-2xl">
                Server-verified academic challenges, nightly Santa gift drops (7:00 PM – 9:00 PM IST),
                2-hour Reward Spin Wheel, and collectible Winter badges separate from your permanent record.
              </p>
            </div>

            <div className="flex items-center gap-2.5 flex-wrap">
              {santaAccess.accessible && (
                <TactileButton
                  variant="secondary"
                  size="md"
                  onClick={() => setSantaOpen(true)}
                  icon={<SantaGiftBoxSvg size={18} />}
                >
                  Nightly Santa Gift
                </TactileButton>
              )}
              {wheelAccess.accessible && (
                <TactileButton
                  variant="primary"
                  size="md"
                  onClick={() => setWheelOpen(true)}
                  icon={<Sparkles className="w-4 h-4" />}
                >
                  Spin Reward Wheel
                </TactileButton>
              )}
            </div>
          </div>

          <div className="winter-candy-divider" />

          {loading && !status ? (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {[0, 1, 2, 3].map((i) => (
                <AnimatedSkeleton key={i} height={74} className="w-full" />
              ))}
            </div>
          ) : !status ? (
            <div className="rounded-xl border border-amber-500/30 bg-slate-950/60 p-4 flex items-center justify-between gap-3 text-xs text-amber-200">
              <span>{statusError || 'Winter collectibles and status are temporarily unavailable.'}</span>
              <TactileButton variant="outline" size="sm" onClick={loadWinterData}>
                Retry
              </TactileButton>
            </div>
          ) : (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3.5">
                <p className="text-[11px] text-slate-400">Winter Cookies</p>
                <div className="mt-1 flex items-center gap-2 text-xl font-bold font-mono tabular-nums">
                  <WinterCookieSvg size={20} />
                  <NumberTicker value={status.winterState.cookiesCount} />
                </div>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3.5">
                <p className="text-[11px] text-slate-400">Streak Freeze Shields</p>
                <div className="mt-1 flex items-center gap-2 text-xl font-bold font-mono tabular-nums">
                  <FrostShieldSvg size={20} />
                  <span>{status.winterState.streakShields} / 3</span>
                </div>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3.5">
                <p className="text-[11px] text-slate-400">Bonus AI Queries Today</p>
                <div className="mt-1 text-xl font-bold font-mono tabular-nums text-sky-300">
                  +{status.winterState.aiBonusCreditsToday} / 5
                </div>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3.5">
                <p className="text-[11px] text-slate-400">Winter Collectibles</p>
                <div className="mt-1 text-xl font-bold font-mono tabular-nums text-amber-300">
                  {Object.keys(status.winterState.earnedWinterBadges || {}).length} /{' '}
                  {status.badges.length}
                </div>
                <p className="text-[10px] text-slate-400 mt-0.5 font-mono">
                  {(status.winterState.unlockedFrames || []).length} Frames ·{' '}
                  {(status.winterState.unlockedBorders || []).length} Borders ·{' '}
                  {(status.winterState.rewardHistory || []).filter((r) => r.featureType === 'santa_gift').length} Santa ·{' '}
                  {(status.winterState.rewardHistory || []).filter((r) => r.featureType === 'spin_wheel').length} Spins
                </p>
              </div>
            </div>
          )}
        </div>
      </section>

      {tasksAccess.accessible && status && (
        <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Verified Winter Festival Tasks
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Progress is validated against real completed actions before rewards are granted.
              </p>
            </div>
            <TactileButton
              variant="outline"
              size="sm"
              onClick={() => {
                setQuizFeedback(null);
                setQuizOpen(true);
              }}
              icon={<HelpCircle className="w-3.5 h-3.5" />}
            >
              {status.winterState.quizCompleted ? 'Review Knowledge Check' : 'Take 3-Question Quiz'}
            </TactileButton>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {status.tasks.map((task) => {
              const prog = getTaskProgress(task, status);
              const pct = task.claimed ? 100 : Math.min(100, Math.round((prog.current / prog.target) * 100));
              return (
                <div
                  key={task.id}
                  className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 p-4 flex flex-col justify-between gap-3"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                        {task.title}
                      </h4>
                      <span className="text-[11px] font-mono tabular-nums text-sky-600 dark:text-sky-400 shrink-0">
                        +{task.xpReward} XP · +{task.cookiesReward} Cookies
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-400">{task.description}</p>
                    <div className="pt-1 space-y-1">
                      <div className="flex items-center justify-between text-[11px] font-mono tabular-nums text-slate-500">
                        <span>Progress</span>
                        <span>
                          {task.claimed ? prog.target : prog.current} / {prog.target}
                        </span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-sky-500 transition-all duration-300"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-1">
                    {task.verificationMode === 'winter_quiz' && !status.winterState.quizCompleted && (
                      <TactileButton
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          setQuizFeedback(null);
                          setQuizOpen(true);
                        }}
                      >
                        Start Quiz
                      </TactileButton>
                    )}

                    {task.claimed ? (
                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                        <CheckCircle2 className="w-4 h-4" />
                        Claimed
                      </span>
                    ) : (
                      <TactileButton
                        variant={prog.eligible ? 'primary' : 'outline'}
                        size="sm"
                        disabled={!prog.eligible || busyTaskId === task.id}
                        onClick={() => handleClaimTask(task)}
                      >
                        {busyTaskId === task.id
                          ? 'Claiming...'
                          : prog.eligible
                          ? 'Claim Reward'
                          : 'In Progress'}
                      </TactileButton>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {badgesAccess.accessible && status && (
        <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 p-5 space-y-6">
          {/* Active Stackable Cosmetic Loadout Preview */}
          <div className="rounded-xl border border-sky-500/30 bg-slate-50 dark:bg-slate-950/70 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5 min-w-0">
              <WinterCosmeticAvatar
                name={currentUser.name}
                avatarUrl={currentUser.photoURL || currentUser.avatar}
                equippedBorder={status.winterState.equippedBorder}
                equippedFrame={status.winterState.equippedFrame}
                size="lg"
              />
              <div className="min-w-0 space-y-0.5">
                <p className="text-xs font-bold uppercase tracking-wider text-sky-600 dark:text-sky-400">
                  Active Cosmetic Loadout (Stackable)
                </p>
                <p className="text-sm font-bold text-slate-900 dark:text-white truncate">
                  Border:{' '}
                  {getWinterBorderVisual(status.winterState.equippedBorder)?.name || 'None Equipped'}{' '}
                  · Frame:{' '}
                  {getWinterFrameVisual(status.winterState.equippedFrame)?.name || 'None Equipped'}
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Winter Borders enclose your avatar and stack cleanly alongside seasonal or permanent Profile Frames.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0 flex-wrap">
              {status.winterState.equippedBorder && (
                <TactileButton
                  variant="outline"
                  size="sm"
                  disabled={equippingBorder === 'none'}
                  onClick={() => handleEquipBorder(null)}
                >
                  Unequip Border
                </TactileButton>
              )}
              {status.winterState.equippedFrame && (
                <TactileButton
                  variant="outline"
                  size="sm"
                  disabled={equippingFrame === 'none'}
                  onClick={() => handleEquipFrame(null)}
                >
                  Unequip Frame
                </TactileButton>
              )}
            </div>
          </div>

          {/* Winter Badges (Owned vs Locked separation + timestamps + progress) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  Winter Collectible Badges
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Stored in a dedicated seasonal collection — separate from your permanent academic badges.
                </p>
              </div>
              <span className="text-xs font-mono tabular-nums text-sky-600 dark:text-sky-400 font-semibold">
                {status.badges.filter((b) => Boolean(b.unlockedAt)).length} Earned ·{' '}
                {status.badges.filter((b) => !b.unlockedAt).length} Locked
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {status.badges.map((badge) => {
                const unlocked = Boolean(badge.unlockedAt);
                const prog = getWinterBadgeProgress(badge.id, status, unlocked);
                const earnedDate =
                  badge.unlockedAt && !Number.isNaN(Date.parse(badge.unlockedAt))
                    ? new Date(badge.unlockedAt).toLocaleDateString()
                    : null;
                return (
                  <div
                    key={badge.id}
                    className={`rounded-xl border p-3.5 space-y-1.5 transition-colors ${
                      unlocked
                        ? 'border-sky-500/40 bg-sky-500/10'
                        : 'border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40 opacity-85'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                        {unlocked ? (
                          <Award className="w-4 h-4 text-sky-500 shrink-0" />
                        ) : (
                          <Lock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        )}
                        {badge.name}
                      </span>
                      <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400 capitalize">
                        {badge.rarity}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-400">{badge.description}</p>
                    <div className="pt-1 flex items-center justify-between gap-2 text-[11px]">
                      <span className="text-slate-500 truncate">
                        {unlocked ? `Earned${earnedDate ? ` · ${earnedDate}` : ''}` : badge.unlockRequirement}
                      </span>
                      {prog && (
                        <span
                          className={`font-mono tabular-nums shrink-0 ${
                            unlocked ? 'text-emerald-600 dark:text-emerald-400 font-semibold' : 'text-slate-500'
                          }`}
                        >
                          {prog.label}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Winter Borders (5 Collectible Stackable Avatar Borders) */}
          <div className="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div>
                <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Winter Avatar Borders (Stackable Cosmetics)
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Outer festive borders appear on leaderboards, profile headers, and cards alongside your Profile Frame.
                </p>
              </div>
              <span className="text-xs font-mono tabular-nums text-sky-600 dark:text-sky-400 font-semibold">
                {(status.winterState.unlockedBorders || []).length} / {(status.borders || []).length} Unlocked
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {(status.borders || []).map((border) => {
                const isUnlocked = (status.winterState.unlockedBorders || []).includes(border.id);
                const isEquipped = status.winterState.equippedBorder === border.id;
                return (
                  <div
                    key={border.id}
                    className={`rounded-xl border p-3.5 flex flex-col justify-between gap-3 transition-colors ${
                      isUnlocked
                        ? 'border-sky-500/40 bg-sky-500/5'
                        : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 opacity-85'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <WinterCosmeticAvatar
                        name={currentUser.name}
                        avatarUrl={currentUser.photoURL || currentUser.avatar}
                        equippedBorder={border.id}
                        size="sm"
                      />
                      <div className="min-w-0 flex-1 space-y-0.5">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                            {border.name}
                          </p>
                          <span className="text-[10px] font-mono uppercase text-slate-500 dark:text-slate-400 shrink-0">
                            {border.rarity}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-snug">
                          {border.description}
                        </p>
                        <p className="text-[10px] text-slate-500 pt-0.5">
                          Unlock: {border.unlockRequirement}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-200/70 dark:border-slate-800/80">
                      <span
                        className={`text-[11px] font-semibold ${
                          isEquipped
                            ? 'text-sky-600 dark:text-sky-400'
                            : isUnlocked
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-slate-400'
                        }`}
                      >
                        {isEquipped ? 'Equipped' : isUnlocked ? 'Owned' : 'Locked'}
                      </span>
                      {isUnlocked ? (
                        <TactileButton
                          variant={isEquipped ? 'secondary' : 'primary'}
                          size="sm"
                          disabled={equippingBorder === border.id}
                          onClick={() => handleEquipBorder(isEquipped ? null : border.id)}
                        >
                          {isEquipped ? 'Unequip' : 'Equip Border'}
                        </TactileButton>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] text-slate-400">
                          <Lock className="w-3 h-3" />
                          Locked
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Seasonal Leaderboard Avatar Frames */}
          <div className="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Seasonal Leaderboard Avatar Frames
              </h4>
              <span className="text-xs font-mono tabular-nums text-sky-600 dark:text-sky-400 font-semibold">
                {(status.winterState.unlockedFrames || []).length} / {status.frames.length} Unlocked
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {status.frames.map((frame) => {
                const isUnlocked = status.winterState.unlockedFrames.includes(frame.id);
                const isEquipped = status.winterState.equippedFrame === frame.id;
                return (
                  <div
                    key={frame.id}
                    className={`rounded-xl border p-3.5 flex items-center justify-between gap-3 ${
                      isUnlocked
                        ? 'border-sky-500/40 bg-sky-500/5'
                        : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 opacity-85'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <WinterCosmeticAvatar
                        name={currentUser.name}
                        avatarUrl={currentUser.photoURL || currentUser.avatar}
                        equippedFrame={frame.id}
                        size="sm"
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                            {frame.name}
                          </p>
                          {frame.rarity && (
                            <span className="text-[10px] font-mono uppercase text-slate-500 dark:text-slate-400 shrink-0">
                              {frame.rarity}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500 truncate">{frame.description}</p>
                        {frame.unlockRequirement && (
                          <p className="text-[10px] text-slate-400 truncate">{frame.unlockRequirement}</p>
                        )}
                      </div>
                    </div>
                    {isUnlocked ? (
                      <TactileButton
                        variant={isEquipped ? 'secondary' : 'primary'}
                        size="sm"
                        disabled={equippingFrame === frame.id}
                        onClick={() => handleEquipFrame(isEquipped ? null : frame.id)}
                      >
                        {isEquipped ? 'Unequip' : 'Equip Frame'}
                      </TactileButton>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] text-slate-400 shrink-0">
                        <Lock className="w-3 h-3" />
                        Locked
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-3">
            <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Claimed Santa Gifts &amp; Spin Rewards
            </h4>
            {(() => {
              const historyItems = (status.winterState.rewardHistory || []).filter(
                (r) => r.featureType === 'santa_gift' || r.featureType === 'spin_wheel'
              );
              const existingNights = new Set(
                historyItems
                  .filter((r) => r.featureType === 'santa_gift' && r.eventNightKey)
                  .map((r) => String(r.eventNightKey))
              );
              const fallbackSantaItems = Object.entries(status.winterState.santaClaimedNights || {})
                .filter(([nightKey]) => !existingNights.has(nightKey))
                .map(([nightKey, rewardId]) => ({
                  id: String(rewardId || `santa_${nightKey}`),
                  featureType: 'santa_gift' as const,
                  idempotencyKey: `santa_${nightKey}`,
                  eventNightKey: nightKey,
                  status: 'applied' as const,
                  rarity: 'seasonal',
                  label: 'Santa Nightly Gift',
                  xpBonus: 0,
                  cookiesBonus: 0,
                  aiBonusQueries: 0,
                  streakShield: false,
                  frameId: undefined as string | undefined,
                  borderId: undefined as string | undefined,
                  createdAt: `${nightKey}T19:00:00.000Z`,
                }));
              const collectedRewards = [...historyItems, ...fallbackSantaItems];

              if (collectedRewards.length === 0) {
                return (
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    No Santa gifts or Spin rewards claimed yet. Unwrap tonight’s Santa Drop or spin the wheel to collect them here.
                  </p>
                );
              }

              return (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {collectedRewards.map((item) => {
                    const isSanta = item.featureType === 'santa_gift';
                    return (
                      <div
                        key={item.id}
                        className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 p-3.5 space-y-1.5"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5 min-w-0 truncate">
                            {isSanta ? (
                              <Gift className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                            ) : (
                              <RotateCw className="w-3.5 h-3.5 text-sky-500 shrink-0" />
                            )}
                            <span className="truncate">{item.label || (isSanta ? 'Santa Nightly Gift' : 'Spin Wheel Reward')}</span>
                          </span>
                          <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400 capitalize shrink-0">
                            {item.rarity}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono tabular-nums text-emerald-600 dark:text-emerald-400">
                          {item.xpBonus > 0 && <span>+{item.xpBonus} XP</span>}
                          {item.cookiesBonus > 0 && <span>+{item.cookiesBonus} Cookies</span>}
                          {item.aiBonusQueries > 0 && <span>+{item.aiBonusQueries} AI</span>}
                          {item.streakShield && <span>+1 Shield</span>}
                          {item.frameId && <span className="text-sky-500">+Frame</span>}
                          {item.borderId && <span className="text-amber-500">+Border</span>}
                        </div>
                        <p className="text-[11px] text-slate-500 font-mono">
                          {isSanta ? 'Santa Drop' : 'Spin Wheel'} · {item.eventNightKey || String(item.createdAt || '').slice(0, 10)}
                        </p>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        </section>
      )}

      <XpLeaderboardPanel
        type={isFacultyRole ? 'faculty' : 'student'}
        currentUser={currentUser}
      />

      <AnimatedDialog
        isOpen={quizOpen}
        onClose={() => setQuizOpen(false)}
        title="Winter Knowledge Check"
        subtitle="Answer at least 2 of 3 questions correctly to verify the Winter Knowledge Check task"
        maxWidth="max-w-lg"
      >
        <form onSubmit={handleQuizSubmit} className="space-y-4">
          {(status?.quizQuestions || []).map((q, qIdx) => {
            const fb = quizFeedback?.results.find((r) => r.id === q.id);
            return (
              <div
                key={q.id}
                className="rounded-xl border border-slate-800 bg-slate-950/60 p-3.5 space-y-2.5"
              >
                <p className="text-xs font-semibold text-slate-100">
                  {qIdx + 1}. {q.prompt}
                </p>
                <div className="space-y-1.5">
                  {q.options.map((opt, optIdx) => {
                    const selected = quizAnswers[q.id] === optIdx;
                    return (
                      <label
                        key={optIdx}
                        className={`flex items-center gap-2.5 p-2 rounded-lg border text-xs cursor-pointer transition-colors ${
                          selected
                            ? 'border-sky-500 bg-sky-500/15 text-white'
                            : 'border-slate-800 bg-slate-900/70 text-slate-300 hover:border-slate-700'
                        }`}
                      >
                        <input
                          type="radio"
                          name={q.id}
                          checked={selected}
                          onChange={() =>
                            setQuizAnswers((prev) => ({ ...prev, [q.id]: optIdx }))
                          }
                        />
                        <span>{opt}</span>
                      </label>
                    );
                  })}
                </div>
                {fb && (
                  <p
                    className={`text-[11px] ${
                      fb.isCorrect ? 'text-emerald-400' : 'text-amber-300'
                    }`}
                  >
                    {fb.isCorrect ? 'Correct · ' : 'Review · '}
                    {fb.explanation}
                  </p>
                )}
              </div>
            );
          })}

          {quizFeedback && (
            <div
              className={`p-3 rounded-xl border text-xs ${
                quizFeedback.passed
                  ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-200'
                  : 'border-amber-500/40 bg-amber-500/15 text-amber-200'
              }`}
            >
              Score: {quizFeedback.correctCount} / {quizFeedback.total}{' '}
              {quizFeedback.passed
                ? '— Passed! Close this dialog and claim your reward.'
                : '— Need at least 2 correct answers. Adjust your choices and retry.'}
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-1">
            <TactileButton variant="outline" size="sm" onClick={() => setQuizOpen(false)}>
              Close
            </TactileButton>
            <TactileButton
              type="submit"
              variant="primary"
              size="sm"
              disabled={
                submittingQuiz ||
                Object.keys(quizAnswers).length < (status?.quizQuestions?.length || 3)
              }
            >
              {submittingQuiz ? 'Checking...' : 'Submit Answers'}
            </TactileButton>
          </div>
        </form>
      </AnimatedDialog>

      <SantaGiftModal
        isOpen={santaOpen}
        onClose={() => setSantaOpen(false)}
        currentUser={currentUser}
        winterStatus={status}
        onRewardClaimed={loadWinterData}
        isPreviewOnly={santaAccess.isPreviewOnly}
      />

      <SpinWheelModal
        isOpen={wheelOpen}
        onClose={() => setWheelOpen(false)}
        currentUser={currentUser}
        winterStatus={status}
        onSpinComplete={loadWinterData}
        isPreviewOnly={wheelAccess.isPreviewOnly}
      />
    </div>
  );
};
