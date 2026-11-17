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
import {
  Award,
  CheckCircle2,
  Coins,
  Eye,
  Gift,
  HelpCircle,
  History,
  Lock,
  Music,
  RotateCw,
  ShieldAlert,
  ShoppingBag,
  Sparkles,
  VolumeX,
} from 'lucide-react';
import { UserProfile } from '../../types';
import { isSuperAdminRole, useFeatureAccess } from '../../lib/featureAccessService';
import {
  claimWinterTask,
  CookieExchangeOption,
  equipWinterBanner,
  equipWinterBorder,
  exchangeWinterCookies,
  fetchFrostXpHistory,
  fetchWinterStatus,
  formatCountdownMs,
  FrostXpTransaction,
  purchaseWinterCollectible,
  submitWinterQuiz,
  WinterProfileBanner,
  WinterProfileBorder,
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
import {
  ProfileBannerBackdrop,
  ProfileCosmeticAvatar,
  ProfileCosmeticCard,
} from './ProfileCosmeticRenderer';
import { TargetedWinterSnowOverlay } from './WinterThemeLayer';
import { getWinterBannerVisual, getWinterBorderVisual } from '../../lib/winterCosmetics';
import { WINTER_AUDIO_ATTRIBUTIONS, winterAudio } from '../../lib/winterAudio';
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
    <div className="relative rounded-2xl border border-sky-400/30 bg-slate-900/85 text-white overflow-hidden shadow-sm">
      <TargetedWinterSnowOverlay variant="hero" />
      <SnowCapAccent />
      <div className="relative z-10 p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
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
              Complete verified study tasks, earn Frost XP for Profile Banners &amp; Borders, unwrap Santa Drops (7–9 PM IST), and spin the Wheel.
            </p>
            {status && (
              <div className="flex items-center gap-x-4 gap-y-1 pt-1 text-xs font-mono tabular-nums text-sky-200 flex-wrap">
                <span className="inline-flex items-center gap-1 text-cyan-300 font-bold">
                  <Sparkles className="w-3.5 h-3.5" />
                  {status.winterState.frostXp || 0} Frost XP
                </span>
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
              className="min-h-[44px]"
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
              className="min-h-[44px]"
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
              className="min-h-[44px]"
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
  const [equippingBanner, setEquippingBanner] = useState<string | null>(null);
  const [equippingBorder, setEquippingBorder] = useState<string | null>(null);
  const [previewBannerId, setPreviewBannerId] = useState<string | null>(null);
  const [previewBorderId, setPreviewBorderId] = useState<string | null>(null);

  const [purchaseConfirm, setPurchaseConfirm] = useState<{
    itemType: 'banner' | 'border';
    item: WinterProfileBanner | WinterProfileBorder;
  } | null>(null);
  const [purchasingKey, setPurchasingKey] = useState<string | null>(null);
  const [exchangingOptionId, setExchangingOptionId] = useState<string | null>(null);

  const [ledgerOpen, setLedgerOpen] = useState<boolean>(false);
  const [ledgerLoading, setLedgerLoading] = useState<boolean>(false);
  const [frostXpTransactions, setFrostXpTransactions] = useState<FrostXpTransaction[]>([]);
  const [ambientOn, setAmbientOn] = useState<boolean>(() => winterAudio.isAmbientPlaying());

  const isSuperAdmin = isSuperAdminRole(currentUser?.role);
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
        if (Array.isArray(data.winterState?.frostXpTransactions)) {
          setFrostXpTransactions(data.winterState.frostXpTransactions);
        }
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
    window.addEventListener('veylentra-cosmetics-updated', onSync);
    return () => {
      window.removeEventListener('veylentra-winter-updated', onSync);
      window.removeEventListener('veylentra-cosmetics-updated', onSync);
    };
  }, [loadWinterData]);

  useEffect(() => {
    return () => {
      if (winterAudio.isAmbientPlaying()) {
        winterAudio.stopAmbient();
      }
    };
  }, []);

  const handleOpenLedger = async () => {
    setLedgerOpen(true);
    setLedgerLoading(true);
    const res = await fetchFrostXpHistory(currentUser);
    setLedgerLoading(false);
    if (res.ok) {
      setFrostXpTransactions(res.transactions);
    }
  };

  const handleClaimTask = async (task: WinterTaskItem) => {
    setBusyTaskId(task.id);
    const res = await claimWinterTask(currentUser, task.id);
    setBusyTaskId(null);
    if (!res.ok || !res.data?.success) {
      showNotification?.(res.data?.error || 'Could not claim Winter task yet.', 'error');
      return;
    }
    const frostMsg = (task.frostXpReward || 0) > 0 ? ` & +${task.frostXpReward} Frost XP` : '';
    showNotification?.(`Claimed task reward (+${task.xpReward} XP${frostMsg})!`, 'success');
    if ((task.frostXpReward || 0) > 0) {
      winterAudio.playFrostXpEarned();
    }
    await loadWinterData();
    window.dispatchEvent(new CustomEvent('veylentra-winter-updated'));
    window.dispatchEvent(new CustomEvent('veylentra-cosmetics-updated'));
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
      winterAudio.playFrostXpEarned();
      showNotification?.('Winter Knowledge Check passed! You can now claim the task reward.', 'success');
      await loadWinterData();
    }
  };

  const handleEquipBanner = async (bannerId: string | null) => {
    setEquippingBanner(bannerId || 'none');
    const res = await equipWinterBanner(currentUser, bannerId);
    setEquippingBanner(null);
    if (!res.ok || !res.data?.success) {
      showNotification?.(res.data?.error || 'Unable to equip profile banner.', 'error');
      return;
    }
    setPreviewBannerId(null);
    winterAudio.playBannerEquipped();
    showNotification?.(bannerId ? 'Winter profile banner equipped!' : 'Profile banner unequipped.', 'success');
    await loadWinterData();
    window.dispatchEvent(new CustomEvent('veylentra-winter-updated'));
    window.dispatchEvent(new CustomEvent('veylentra-cosmetics-updated'));
  };

  const handleEquipBorder = async (borderId: string | null) => {
    setEquippingBorder(borderId || 'none');
    const res = await equipWinterBorder(currentUser, borderId);
    setEquippingBorder(null);
    if (!res.ok || !res.data?.success) {
      showNotification?.(res.data?.error || 'Unable to equip profile border.', 'error');
      return;
    }
    setPreviewBorderId(null);
    winterAudio.playBorderEquipped();
    showNotification?.(borderId ? 'Winter profile border equipped!' : 'Profile border unequipped.', 'success');
    await loadWinterData();
    window.dispatchEvent(new CustomEvent('veylentra-winter-updated'));
    window.dispatchEvent(new CustomEvent('veylentra-cosmetics-updated'));
  };

  const handleConfirmPurchase = async (adminGrant: boolean = false) => {
    if (!purchaseConfirm) return;
    const { itemType, item } = purchaseConfirm;
    const key = `${itemType}:${item.id}`;
    setPurchasingKey(key);
    const res = await purchaseWinterCollectible(currentUser, {
      itemType,
      itemId: item.id,
      adminGrant,
      idempotencyKey: `${adminGrant ? 'adm' : 'buy'}_${itemType}_${item.id}_${Date.now()}`,
    });
    setPurchasingKey(null);
    if (!res.ok || !res.data?.success) {
      showNotification?.(res.data?.error || 'Unable to complete unlock.', 'error');
      return;
    }
    setPurchaseConfirm(null);
    winterAudio.playPurchaseSuccess();
    showNotification?.(
      adminGrant
        ? `Super Admin Grant recorded: ${item.name} unlocked.`
        : `Unlocked ${item.name}! Click Equip to display it on your profile.`,
      'success'
    );
    await loadWinterData();
    window.dispatchEvent(new CustomEvent('veylentra-winter-updated'));
    window.dispatchEvent(new CustomEvent('veylentra-cosmetics-updated'));
  };

  const handleCookieExchange = async (opt: CookieExchangeOption) => {
    setExchangingOptionId(opt.id);
    const res = await exchangeWinterCookies(currentUser, opt.id);
    setExchangingOptionId(null);
    if (!res.ok || !res.data?.success) {
      showNotification?.(res.data?.error || 'Cookie exchange failed.', 'error');
      return;
    }
    winterAudio.playCookieExchange();
    showNotification?.(
      opt.frostXpGrant > 0
        ? `Exchanged ${opt.cookieCost} Cookies for +${opt.frostXpGrant} Frost XP!`
        : `Exchanged ${opt.cookieCost} Cookies for +${opt.aiBonusGrant} Daily AI Query!`,
      'success'
    );
    await loadWinterData();
    window.dispatchEvent(new CustomEvent('veylentra-winter-updated'));
  };

  const anyPreview =
    themeAccess.isPreviewOnly ||
    tasksAccess.isPreviewOnly ||
    badgesAccess.isPreviewOnly ||
    santaAccess.isPreviewOnly ||
    wheelAccess.isPreviewOnly;

  const activeBannerDisplay = previewBannerId !== null ? previewBannerId : (status?.winterState?.equippedBanner || null);
  const activeBorderDisplay = previewBorderId !== null ? previewBorderId : (status?.winterState?.equippedBorder || null);
  const isPreviewingCosmetic = previewBannerId !== null || previewBorderId !== null;

  return (
    <div className="space-y-6 overflow-x-hidden">
      {anyPreview && (
        <div className="p-3.5 rounded-xl border border-amber-500/40 bg-amber-500/15 text-xs text-amber-800 dark:text-amber-200 flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 shrink-0" />
          <span>
            Super Admin Preview Mode active — One or more Winter Festival modules are turned OFF for regular users.
          </span>
        </div>
      )}

      <section className="relative rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-900 text-white overflow-hidden shadow-sm">
        <TargetedWinterSnowOverlay variant="hero" />
        <SnowCapAccent />
        <div className="relative z-10 p-4 sm:p-6 space-y-5">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="space-y-1.5 min-w-0">
              <div className="flex items-center gap-2.5 flex-wrap">
                <CandyCaneAccent size={22} />
                <h2 className="text-lg sm:text-2xl font-bold tracking-tight">
                  Winter Academic Festival &amp; Frost Economy
                </h2>
              </div>
              <p className="text-xs sm:text-sm text-slate-300 max-w-2xl">
                Earn seasonal Frost XP alongside Scholar XP, unlock animated Profile Banners &amp; perimeter Profile Borders,
                exchange Winter Cookies, and roll verified academic rewards.
              </p>
            </div>

            <div className="flex items-center gap-2 sm:gap-2.5 flex-wrap">
              <button
                type="button"
                onClick={() => {
                  const next = winterAudio.toggleAmbient();
                  setAmbientOn(next);
                  if (!next && winterAudio.isAmbientPlaying() === false) {
                    // Only show notice if user tried enabling while muted
                  }
                }}
                className={`min-h-[44px] px-3 py-2 rounded-xl border text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer ${
                  ambientOn
                    ? 'border-cyan-400/50 bg-cyan-500/20 text-cyan-200'
                    : 'border-slate-700 bg-slate-950/70 text-slate-300 hover:bg-slate-800'
                }`}
                aria-label={ambientOn ? 'Pause Solstice Ambient Audio' : 'Play Solstice Ambient Audio'}
              >
                {ambientOn ? <Music className="w-4 h-4 text-cyan-300" /> : <VolumeX className="w-4 h-4" />}
                <span>{ambientOn ? 'Ambience ON' : 'Solstice Audio'}</span>
              </button>

              {santaAccess.accessible && (
                <TactileButton
                  variant="secondary"
                  size="md"
                  className="min-h-[44px]"
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
                  className="min-h-[44px]"
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
            <div className="grid grid-cols-1 min-[375px]:grid-cols-2 lg:grid-cols-5 gap-3">
              {[0, 1, 2, 3, 4].map((i) => (
                <AnimatedSkeleton key={i} height={78} className="w-full" />
              ))}
            </div>
          ) : !status ? (
            <div className="rounded-xl border border-amber-500/30 bg-slate-950/60 p-4 flex items-center justify-between gap-3 text-xs text-amber-200">
              <span>{statusError || 'Winter collectibles and status are temporarily unavailable.'}</span>
              <TactileButton variant="outline" size="sm" className="min-h-[44px]" onClick={loadWinterData}>
                Retry
              </TactileButton>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 min-[375px]:grid-cols-2 lg:grid-cols-5 gap-3">
                {/* Isolated Frost XP Card */}
                <div className="rounded-xl border border-cyan-400/35 bg-slate-950/70 p-3.5 flex flex-col justify-between gap-2">
                  <div>
                    <p className="text-[11px] text-cyan-300 font-semibold flex items-center justify-between gap-1">
                      <span>Frost XP Balance</span>
                      <button
                        type="button"
                        onClick={handleOpenLedger}
                        className="text-[10px] underline text-slate-300 hover:text-white cursor-pointer"
                      >
                        Ledger
                      </button>
                    </p>
                    <div className="mt-1 flex items-center gap-2 text-xl font-bold font-mono tabular-nums text-cyan-200">
                      <Coins className="w-5 h-5 text-cyan-300 shrink-0" />
                      <NumberTicker value={status.winterState.frostXp || 0} />
                    </div>
                  </div>
                  <p className="text-[10px] text-slate-400">Seasonal currency · Separate from Scholar XP</p>
                </div>

                <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3.5">
                  <p className="text-[11px] text-slate-400">Winter Cookies</p>
                  <div className="mt-1 flex items-center gap-2 text-xl font-bold font-mono tabular-nums">
                    <WinterCookieSvg size={20} />
                    <NumberTicker value={status.winterState.cookiesCount} />
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">Exchangeable below</p>
                </div>

                <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3.5">
                  <p className="text-[11px] text-slate-400">Streak Freeze Shields</p>
                  <div className="mt-1 flex items-center gap-2 text-xl font-bold font-mono tabular-nums">
                    <FrostShieldSvg size={20} />
                    <span>{status.winterState.streakShields} / 3</span>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">Protects study streaks</p>
                </div>

                <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3.5">
                  <p className="text-[11px] text-slate-400">Bonus AI Queries Today</p>
                  <div className="mt-1 text-xl font-bold font-mono tabular-nums text-sky-300">
                    +{status.winterState.aiBonusCreditsToday} / 5
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">Orion daily study boost</p>
                </div>

                <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3.5 min-[375px]:col-span-2 lg:col-span-1">
                  <p className="text-[11px] text-slate-400">Winter Collectibles</p>
                  <div className="mt-1 text-xl font-bold font-mono tabular-nums text-amber-300">
                    {Object.keys(status.winterState.earnedWinterBadges || {}).length} / {status.badges.length}
                  </div>
                  <p className="text-[10px] text-slate-400 mt-0.5 font-mono">
                    {(status.winterState.unlockedBanners || []).length} Banners ·{' '}
                    {(status.winterState.unlockedBorders || []).length} Borders
                  </p>
                </div>
              </div>

              {/* Cookie Exchange Bar */}
              {Array.isArray(status.cookieExchangeOptions) && status.cookieExchangeOptions.length > 0 && (
                <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div className="space-y-0.5 min-w-0">
                    <p className="text-xs font-bold text-white flex items-center gap-1.5">
                      <WinterCookieSvg size={15} />
                      <span>Winter Cookie Exchange</span>
                    </p>
                    <p className="text-[11px] text-slate-400">
                      Convert Winter Cookies earned from tasks &amp; drops into Frost XP or bonus daily Orion AI queries.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    {status.cookieExchangeOptions.map((opt) => {
                      const canAfford = (status.winterState.cookiesCount || 0) >= opt.cookieCost;
                      const busy = exchangingOptionId === opt.id;
                      return (
                        <TactileButton
                          key={opt.id}
                          variant={canAfford ? 'secondary' : 'outline'}
                          size="sm"
                          className="min-h-[44px]"
                          disabled={!canAfford || busy}
                          onClick={() => handleCookieExchange(opt)}
                        >
                          {busy ? 'Exchanging...' : `${opt.cookieCost} Cookies → ${opt.title}`}
                        </TactileButton>
                      );
                    })}
                  </div>
                </div>
              )}
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
        <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 p-4 sm:p-5 space-y-6">
          {/* Active Stackable Cosmetic Loadout Preview (Banner behind avatar + Border around avatar perimeter) */}
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  {isPreviewingCosmetic ? 'Cosmetic Loadout Preview (Unsaved Preview)' : 'Active Profile Cosmetic Loadout'}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Banner: {getWinterBannerVisual(activeBannerDisplay)?.name || 'None'} · Border:{' '}
                  {getWinterBorderVisual(activeBorderDisplay)?.name || 'None'}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {isPreviewingCosmetic && (
                  <TactileButton
                    variant="secondary"
                    size="sm"
                    className="min-h-[44px]"
                    onClick={() => {
                      setPreviewBannerId(null);
                      setPreviewBorderId(null);
                    }}
                  >
                    Exit Preview
                  </TactileButton>
                )}
                {status.winterState.equippedBanner && (
                  <TactileButton
                    variant="outline"
                    size="sm"
                    className="min-h-[44px]"
                    disabled={equippingBanner === 'none'}
                    onClick={() => handleEquipBanner(null)}
                  >
                    Unequip Banner
                  </TactileButton>
                )}
                {status.winterState.equippedBorder && (
                  <TactileButton
                    variant="outline"
                    size="sm"
                    className="min-h-[44px]"
                    disabled={equippingBorder === 'none'}
                    onClick={() => handleEquipBorder(null)}
                  >
                    Unequip Border
                  </TactileButton>
                )}
              </div>
            </div>

            <ProfileCosmeticCard
              name={currentUser.name}
              avatarUrl={currentUser.photoURL || currentUser.avatar}
              roleLabel={currentUser.role}
              equippedBanner={activeBannerDisplay}
              equippedBorder={activeBorderDisplay}
              bannerUrl={currentUser.bannerUrl}
              bannerPresetClass={currentUser.bannerPreset}
              badgeCount={Object.keys(status.winterState.earnedWinterBadges || {}).length}
              subtitle={`${status.winterState.frostXp || 0} Frost XP · ${status.winterState.cookiesCount || 0} Cookies`}
            />
          </div>

          {/* 1. Winter Profile Banners (Background artwork behind profile avatar & header) */}
          <div className="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Profile Banners &amp; Frost Shop
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Animated background artwork displayed behind your avatar across profiles, chat cards, and podium headers.
                </p>
              </div>
              <span className="text-xs font-mono tabular-nums text-sky-600 dark:text-sky-400 font-semibold">
                {(status.winterState.unlockedBanners || []).length} / {(status.banners || []).length} Owned
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {(status.banners || []).map((banner) => {
                const isUnlocked = (status.winterState.unlockedBanners || []).includes(banner.id);
                const isEquipped = status.winterState.equippedBanner === banner.id;
                const isPreviewing = previewBannerId === banner.id;
                const canAfford = (status.winterState.frostXp || 0) >= banner.frostXpCost;

                return (
                  <div
                    key={banner.id}
                    className={`rounded-xl border overflow-hidden flex flex-col justify-between transition-colors ${
                      isUnlocked
                        ? 'border-sky-500/45 bg-sky-500/5'
                        : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50'
                    }`}
                  >
                    <div>
                      <ProfileBannerBackdrop equippedBanner={banner.id} className="h-20 w-full relative">
                        <div className="absolute inset-x-3 bottom-2 flex items-end justify-between gap-2">
                          <ProfileCosmeticAvatar
                            name={currentUser.name}
                            avatarUrl={currentUser.photoURL || currentUser.avatar}
                            equippedBorder={activeBorderDisplay}
                            size="sm"
                          />
                          <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-slate-950/75 text-slate-100 border border-white/15">
                            {banner.rarity}
                          </span>
                        </div>
                      </ProfileBannerBackdrop>
                      <div className="p-3.5 space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                            {banner.name}
                          </p>
                          <span
                            className={`text-[10px] font-semibold shrink-0 ${
                              isEquipped
                                ? 'text-sky-600 dark:text-sky-400'
                                : isUnlocked
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : 'text-slate-400'
                            }`}
                          >
                            {isEquipped ? 'Equipped' : isUnlocked ? 'Owned' : 'Locked'}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-snug">
                          {banner.description}
                        </p>
                        <p className="text-[10px] text-slate-500 pt-0.5">
                          Unlock: {banner.unlockRequirement} · {banner.purpose}
                        </p>
                      </div>
                    </div>

                    <div className="px-3.5 pb-3.5 pt-2 border-t border-slate-200/70 dark:border-slate-800/80 flex flex-wrap items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => setPreviewBannerId(isPreviewing ? null : banner.id)}
                        className="min-h-[44px] px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-[11px] font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 inline-flex items-center gap-1 cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>{isPreviewing ? 'Unpreview' : 'Preview'}</span>
                      </button>

                      <div className="flex items-center gap-1.5 flex-wrap">
                        {isUnlocked ? (
                          <TactileButton
                            variant={isEquipped ? 'secondary' : 'primary'}
                            size="sm"
                            className="min-h-[44px]"
                            disabled={equippingBanner === banner.id}
                            onClick={() => handleEquipBanner(isEquipped ? null : banner.id)}
                          >
                            {isEquipped ? 'Unequip' : 'Equip Banner'}
                          </TactileButton>
                        ) : (
                          <>
                            {banner.purchasableWithFrostXp && (
                              <TactileButton
                                variant={canAfford ? 'primary' : 'outline'}
                                size="sm"
                                className="min-h-[44px]"
                                disabled={!canAfford || purchasingKey === `banner:${banner.id}`}
                                onClick={() => setPurchaseConfirm({ itemType: 'banner', item: banner })}
                                icon={<ShoppingBag className="w-3.5 h-3.5" />}
                              >
                                {banner.frostXpCost} Frost XP
                              </TactileButton>
                            )}
                            {isSuperAdmin && (
                              <button
                                type="button"
                                onClick={() => setPurchaseConfirm({ itemType: 'banner', item: banner })}
                                className="min-h-[44px] px-2.5 py-1.5 rounded-lg border border-amber-400/40 bg-amber-500/15 text-amber-300 text-[11px] font-bold hover:bg-amber-500/25 cursor-pointer"
                                title="Super Admin Audited Claim"
                              >
                                Claim Free
                              </button>
                            )}
                            {!banner.purchasableWithFrostXp && !isSuperAdmin && (
                              <span className="inline-flex items-center gap-1 text-[11px] text-slate-400 px-2">
                                <Lock className="w-3 h-3" /> Drop Exclusive
                              </span>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 2. Winter Profile Borders (Contour-aligned perimeter decorations) */}
          <div className="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Profile Borders (Avatar Perimeter)
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Festive perimeter borders trace your circular avatar contour cleanly at every size and stack with Banners.
                </p>
              </div>
              <span className="text-xs font-mono tabular-nums text-sky-600 dark:text-sky-400 font-semibold">
                {(status.winterState.unlockedBorders || []).length} / {(status.borders || []).length} Owned
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {(status.borders || []).map((border) => {
                const isUnlocked = (status.winterState.unlockedBorders || []).includes(border.id);
                const isEquipped = status.winterState.equippedBorder === border.id;
                const isPreviewing = previewBorderId === border.id;
                const canAfford = (status.winterState.frostXp || 0) >= border.frostXpCost;

                return (
                  <div
                    key={border.id}
                    className={`rounded-xl border p-3.5 flex flex-col justify-between gap-3 transition-colors ${
                      isUnlocked
                        ? 'border-sky-500/40 bg-sky-500/5'
                        : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <ProfileCosmeticAvatar
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

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200/70 dark:border-slate-800/80">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setPreviewBorderId(isPreviewing ? null : border.id)}
                          className="min-h-[44px] px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-[11px] font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>{isPreviewing ? 'Unpreview' : 'Preview'}</span>
                        </button>
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
                      </div>

                      <div className="flex items-center gap-1.5 flex-wrap">
                        {isUnlocked ? (
                          <TactileButton
                            variant={isEquipped ? 'secondary' : 'primary'}
                            size="sm"
                            className="min-h-[44px]"
                            disabled={equippingBorder === border.id}
                            onClick={() => handleEquipBorder(isEquipped ? null : border.id)}
                          >
                            {isEquipped ? 'Unequip' : 'Equip Border'}
                          </TactileButton>
                        ) : (
                          <>
                            {border.purchasableWithFrostXp && (
                              <TactileButton
                                variant={canAfford ? 'primary' : 'outline'}
                                size="sm"
                                className="min-h-[44px]"
                                disabled={!canAfford || purchasingKey === `border:${border.id}`}
                                onClick={() => setPurchaseConfirm({ itemType: 'border', item: border })}
                                icon={<ShoppingBag className="w-3.5 h-3.5" />}
                              >
                                {border.frostXpCost} Frost XP
                              </TactileButton>
                            )}
                            {isSuperAdmin && (
                              <button
                                type="button"
                                onClick={() => setPurchaseConfirm({ itemType: 'border', item: border })}
                                className="min-h-[44px] px-2.5 py-1.5 rounded-lg border border-amber-400/40 bg-amber-500/15 text-amber-300 text-[11px] font-bold hover:bg-amber-500/25 cursor-pointer"
                              >
                                Claim Free
                              </button>
                            )}
                            {!border.purchasableWithFrostXp && !isSuperAdmin && (
                              <span className="inline-flex items-center gap-1 text-[11px] text-slate-400">
                                <Lock className="w-3 h-3" />
                                Locked
                              </span>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 3. Winter Badges (Owned vs Locked separation + timestamps + progress) */}
          <div className="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-3">
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

          {/* 4. Reward History */}
          <div className="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-3">
            <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Claimed Santa Gifts, Shop &amp; Spin Rewards
            </h4>
            {(() => {
              const historyItems = (status.winterState.rewardHistory || []).filter(
                (r) =>
                  r.featureType === 'santa_gift' ||
                  r.featureType === 'spin_wheel' ||
                  r.featureType === 'winter_shop' ||
                  r.featureType === 'admin_grant' ||
                  r.featureType === 'cookie_exchange'
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
                  frostXpBonus: 0,
                  cookiesBonus: 0,
                  aiBonusQueries: 0,
                  streakShield: false,
                  bannerId: undefined as string | undefined,
                  borderId: undefined as string | undefined,
                  createdAt: `${nightKey}T19:00:00.000Z`,
                }));
              const collectedRewards = [...historyItems, ...fallbackSantaItems];

              if (collectedRewards.length === 0) {
                return (
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    No Santa gifts, Spin rewards, or Shop unlocks claimed yet.
                  </p>
                );
              }

              return (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {collectedRewards.map((item) => {
                    const isSanta = item.featureType === 'santa_gift';
                    const isShop = item.featureType === 'winter_shop' || item.featureType === 'admin_grant';
                    return (
                      <div
                        key={item.id}
                        className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 p-3.5 space-y-1.5"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5 min-w-0 truncate">
                            {isSanta ? (
                              <Gift className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                            ) : isShop ? (
                              <ShoppingBag className="w-3.5 h-3.5 text-cyan-500 shrink-0" />
                            ) : (
                              <RotateCw className="w-3.5 h-3.5 text-sky-500 shrink-0" />
                            )}
                            <span className="truncate">{item.label || 'Winter Festival Reward'}</span>
                          </span>
                          <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400 capitalize shrink-0">
                            {item.rarity}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono tabular-nums text-emerald-600 dark:text-emerald-400">
                          {item.xpBonus > 0 && <span>+{item.xpBonus} XP</span>}
                          {(item.frostXpBonus || 0) > 0 && <span className="text-cyan-400">+{item.frostXpBonus} Frost XP</span>}
                          {item.cookiesBonus > 0 && <span>+{item.cookiesBonus} Cookies</span>}
                          {item.aiBonusQueries > 0 && <span>+{item.aiBonusQueries} AI</span>}
                          {item.streakShield && <span>+1 Shield</span>}
                          {item.bannerId && <span className="text-sky-400">+Banner</span>}
                          {item.borderId && <span className="text-amber-400">+Border</span>}
                        </div>
                        <p className="text-[11px] text-slate-500 font-mono">
                          {item.featureType.replace('_', ' ')} · {item.eventNightKey || String(item.createdAt || '').slice(0, 10)}
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

      {/* Audio Attribution Footer */}
      <details className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/60 p-3.5 text-xs text-slate-500 dark:text-slate-400">
        <summary className="cursor-pointer font-semibold text-slate-700 dark:text-slate-300">
          Seasonal Audio &amp; Visual Attribution ({WINTER_AUDIO_ATTRIBUTIONS.length} cues)
        </summary>
        <div className="mt-2.5 grid grid-cols-1 sm:grid-cols-2 gap-2">
          {WINTER_AUDIO_ATTRIBUTIONS.map((item) => (
            <div key={item.id} className="p-2 rounded-lg bg-slate-100 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800">
              <p className="font-semibold text-slate-800 dark:text-slate-200">{item.label}</p>
              <p className="text-[11px]">{item.source} · {item.license}</p>
            </div>
          ))}
        </div>
      </details>

      {/* Purchase / Super Admin Claim Confirmation Dialog */}
      <AnimatedDialog
        isOpen={Boolean(purchaseConfirm)}
        onClose={() => !purchasingKey && setPurchaseConfirm(null)}
        title={purchaseConfirm?.item.name || 'Unlock Collectible'}
        subtitle={
          purchaseConfirm?.itemType === 'banner'
            ? 'Winter Profile Banner (Background Artwork)'
            : 'Winter Profile Border (Avatar Perimeter)'
        }
        maxWidth="max-w-md"
      >
        {purchaseConfirm && (
          <div className="space-y-4">
            {purchaseConfirm.itemType === 'banner' ? (
              <ProfileBannerBackdrop equippedBanner={purchaseConfirm.item.id} className="h-24 w-full rounded-xl">
                <div className="p-3 h-full flex items-end">
                  <ProfileCosmeticAvatar
                    name={currentUser.name}
                    avatarUrl={currentUser.photoURL || currentUser.avatar}
                    equippedBorder={activeBorderDisplay}
                    size="md"
                  />
                </div>
              </ProfileBannerBackdrop>
            ) : (
              <div className="flex justify-center py-3">
                <ProfileCosmeticAvatar
                  name={currentUser.name}
                  avatarUrl={currentUser.photoURL || currentUser.avatar}
                  equippedBorder={purchaseConfirm.item.id}
                  size="lg"
                />
              </div>
            )}
            <p className="text-xs text-slate-300 leading-relaxed">{purchaseConfirm.item.description}</p>
            <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3 flex items-center justify-between text-xs font-mono tabular-nums">
              <span className="text-slate-400">Your Frost XP</span>
              <span className="text-cyan-300 font-bold">{status?.winterState?.frostXp || 0} Frost XP</span>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
              <TactileButton
                variant="outline"
                size="sm"
                className="min-h-[44px]"
                onClick={() => setPurchaseConfirm(null)}
                disabled={Boolean(purchasingKey)}
              >
                Cancel
              </TactileButton>
              {purchaseConfirm.item.purchasableWithFrostXp && (
                <TactileButton
                  variant="primary"
                  size="sm"
                  className="min-h-[44px]"
                  disabled={
                    Boolean(purchasingKey) ||
                    (status?.winterState?.frostXp || 0) < purchaseConfirm.item.frostXpCost
                  }
                  onClick={() => handleConfirmPurchase(false)}
                >
                  {purchasingKey
                    ? 'Unlocking...'
                    : `Confirm Purchase (${purchaseConfirm.item.frostXpCost} Frost XP)`}
                </TactileButton>
              )}
              {isSuperAdmin && (
                <TactileButton
                  variant="secondary"
                  size="sm"
                  className="min-h-[44px]"
                  disabled={Boolean(purchasingKey)}
                  onClick={() => handleConfirmPurchase(true)}
                >
                  {purchasingKey ? 'Granting...' : 'Super Admin Claim Free (Audited)'}
                </TactileButton>
              )}
            </div>
          </div>
        )}
      </AnimatedDialog>

      {/* Frost XP Transaction History Modal */}
      <AnimatedDialog
        isOpen={ledgerOpen}
        onClose={() => setLedgerOpen(false)}
        title="Frost XP Transaction Ledger"
        subtitle="Seasonal currency earned & spent · Isolated from permanent Scholar XP"
        maxWidth="max-w-lg"
      >
        <div className="space-y-3">
          <div className="rounded-xl border border-cyan-500/30 bg-cyan-500/10 p-3 flex items-center justify-between text-xs font-mono tabular-nums">
            <span className="text-cyan-200 font-semibold">Current Frost XP Balance</span>
            <span className="text-lg font-bold text-cyan-100">{status?.winterState?.frostXp || 0} Frost XP</span>
          </div>
          {ledgerLoading ? (
            <div className="space-y-2">
              {[0, 1, 2].map((i) => (
                <AnimatedSkeleton key={i} height={46} className="w-full" />
              ))}
            </div>
          ) : frostXpTransactions.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-400 rounded-xl border border-slate-800 bg-slate-950/60 flex flex-col items-center gap-2">
              <History className="w-5 h-5 text-slate-500" />
              <span>No Frost XP transactions recorded yet. Complete Winter tasks, Cookie Exchanges, Santa drops, or Spin rolls!</span>
            </div>
          ) : (
            <div className="max-h-72 overflow-y-auto divide-y divide-slate-800 rounded-xl border border-slate-800 bg-slate-950/70">
              {frostXpTransactions.map((tx) => (
                <div key={tx.id} className="px-3.5 py-2.5 flex items-center justify-between gap-3 text-xs">
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-100 truncate">{tx.reason}</p>
                    <p className="text-[11px] text-slate-400 font-mono">
                      {tx.createdAt ? new Date(tx.createdAt).toLocaleString() : 'Recorded'}
                    </p>
                  </div>
                  <div className="text-right font-mono tabular-nums shrink-0">
                    <p className={tx.amount >= 0 ? 'text-cyan-300 font-bold' : 'text-amber-300 font-bold'}>
                      {tx.amount >= 0 ? `+${tx.amount}` : tx.amount} Frost XP
                    </p>
                    <p className="text-[10px] text-slate-500">Bal: {tx.balanceAfter}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
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
