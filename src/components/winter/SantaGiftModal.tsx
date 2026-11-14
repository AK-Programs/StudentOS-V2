/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Nightly Santa Gift Modal (7:00 PM – 9:00 PM IST)
 * Enforces strict server window + 1-claim-per-night + transparent pre-claim odds
 * + atomic idempotency recovery without re-rolling.
 */

import React, { useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { Clock, CheckCircle2, ShieldAlert, Sparkles, RefreshCw } from 'lucide-react';
import { UserProfile } from '../../types';
import {
  claimSantaGift,
  formatCountdownMs,
  WinterRewardRecord,
  WinterStatusResponse,
} from '../../lib/winterFestivalService';
import { AnimatedDialog, TactileButton } from '../ui/animatedComponents';
import { FrostShieldSvg, SantaGiftBoxSvg, WinterCookieSvg } from './WinterArtwork';

interface SantaGiftModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserProfile;
  winterStatus: WinterStatusResponse | null;
  onRewardClaimed: () => Promise<void> | void;
  isPreviewOnly?: boolean;
}

const RARITY_STYLES: Record<string, string> = {
  Common: 'border-slate-500/40 bg-slate-500/10 text-slate-200',
  Rare: 'border-sky-400/50 bg-sky-500/15 text-sky-200',
  Legendary: 'border-amber-400/60 bg-amber-500/15 text-amber-200',
  Insane: 'border-rose-400/70 bg-rose-500/20 text-rose-100',
};

export const SantaGiftModal: React.FC<SantaGiftModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  winterStatus,
  onRewardClaimed,
  isPreviewOnly = false,
}) => {
  const prefersReduced = useReducedMotion();
  const [nowTick, setNowTick] = useState<number>(Date.now());
  const [serverOffsetMs, setServerOffsetMs] = useState<number>(0);
  const [claiming, setClaiming] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [claimedReward, setClaimedReward] = useState<WinterRewardRecord | null>(null);
  const [wasRecovered, setWasRecovered] = useState<boolean>(false);

  useEffect(() => {
    if (winterStatus?.serverTime) {
      const parsed = Date.parse(winterStatus.serverTime);
      if (Number.isFinite(parsed)) {
        setServerOffsetMs(parsed - Date.now());
      }
    }
  }, [winterStatus?.serverTime]);

  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    const interval = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [isOpen]);

  const santaWindow = winterStatus?.santa?.window;
  const tiers = winterStatus?.santa?.odds || [];
  const history = (winterStatus?.winterState?.rewardHistory || []).filter(
    (h) => h.featureType === 'santa_gift'
  );
  const pendingRecovery = history.find(
    (h) => h.eventNightKey === santaWindow?.eventNightKey && h.status === 'pending_apply'
  );

  const fetchedAtMs = winterStatus?.serverTime ? Date.parse(winterStatus.serverTime) : Date.now();
  const elapsedSinceFetch = Math.max(0, (nowTick + serverOffsetMs) - fetchedAtMs);
  const remainingOpenMs = santaWindow
    ? Math.max(0, santaWindow.msUntilOpen - elapsedSinceFetch)
    : 0;
  const remainingCloseMs = santaWindow
    ? Math.max(0, santaWindow.msUntilClose - elapsedSinceFetch)
    : 0;

  const isWindowOpenNow = Boolean(santaWindow?.isOpen) && remainingCloseMs > 0;
  const alreadyClaimed = Boolean(winterStatus?.santa?.alreadyClaimedTonight) && !pendingRecovery;

  const handleUnwrap = async () => {
    if (!santaWindow) return;
    setClaiming(true);
    setError(null);
    const idempotencyKey = `santa_${santaWindow.eventNightKey}`;
    const res = await claimSantaGift(currentUser, idempotencyKey);
    setClaiming(false);

    if (!res.ok || !res.data?.success) {
      setError(res.data?.error || 'Unable to unwrap tonight’s Santa Gift.');
      return;
    }

    setClaimedReward(res.data.reward || null);
    setWasRecovered(Boolean(res.data.recovered));
    await onRewardClaimed();
    window.dispatchEvent(new CustomEvent('veylentra-winter-updated'));
    window.dispatchEvent(new CustomEvent('studentos-gamification-updated'));
  };

  return (
    <AnimatedDialog
      isOpen={isOpen}
      onClose={onClose}
      title="Nightly Santa Gift Drop"
      subtitle="Opens nightly from 7:00 PM to 9:00 PM IST · One verified gift per evening"
      maxWidth="max-w-xl"
    >
      <div className="space-y-5">
        {isPreviewOnly && (
          <div className="p-3 rounded-xl border border-amber-500/40 bg-amber-500/10 text-xs text-amber-200 flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 shrink-0" />
            <span>Super Admin Preview Mode — Regular users cannot access Santa Gifts while disabled.</span>
          </div>
        )}

        <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5 text-center space-y-4 relative overflow-hidden">
          <div className="winter-candy-divider" />

          <motion.div
            animate={
              claiming && !prefersReduced
                ? { rotate: [-4, 4, -4, 4, 0], scale: [1, 1.06, 1] }
                : { rotate: 0, scale: 1 }
            }
            transition={{ duration: 0.6, repeat: claiming ? Infinity : 0 }}
            className="mx-auto w-20 h-20 rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center"
          >
            <SantaGiftBoxSvg size={48} />
          </motion.div>

          {santaWindow && (
            <div className="space-y-1">
              <div className="inline-flex items-center gap-2 text-xs font-medium text-slate-300">
                <Clock className="w-3.5 h-3.5 text-sky-400" />
                {isWindowOpenNow ? (
                  <span>
                    Window Open ({santaWindow.windowLabel} IST) · Closes in{' '}
                    <span className="font-mono font-bold tabular-nums text-emerald-400">
                      {formatCountdownMs(remainingCloseMs)}
                    </span>
                  </span>
                ) : (
                  <span>
                    Next Gift Drop ({santaWindow.windowLabel} IST) in{' '}
                    <span className="font-mono font-bold tabular-nums text-amber-300">
                      {formatCountdownMs(remainingOpenMs)}
                    </span>
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400">
                Academic Season Bonus · Up to 5 bonus AI queries/day across all Winter rewards
              </p>
            </div>
          )}

          {claimedReward && (
            <motion.div
              initial={prefersReduced ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: 6 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              className={`rounded-xl border p-4 text-left space-y-2 ${
                RARITY_STYLES[claimedReward.rarity] || RARITY_STYLES.Common
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold uppercase tracking-wider">
                  {claimedReward.rarity} Drop {wasRecovered ? '· Recovered' : '· Claimed'}
                </span>
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              </div>
              <p className="text-sm font-bold text-white">{claimedReward.label}</p>
              <div className="flex flex-wrap items-center gap-3 text-xs font-mono tabular-nums pt-1">
                {claimedReward.xpBonus > 0 && <span>+{claimedReward.xpBonus} XP</span>}
                {claimedReward.cookiesBonus > 0 && (
                  <span className="inline-flex items-center gap-1">
                    <WinterCookieSvg size={14} /> +{claimedReward.cookiesBonus} Cookies
                  </span>
                )}
                {claimedReward.aiBonusQueries > 0 && (
                  <span>+{claimedReward.aiBonusQueries} AI Queries Today</span>
                )}
                {claimedReward.streakShield && (
                  <span className="inline-flex items-center gap-1 text-sky-300">
                    <FrostShieldSvg size={14} /> +1 Streak Shield
                  </span>
                )}
              </div>
            </motion.div>
          )}

          {error && (
            <div className="p-3 rounded-xl border border-rose-500/40 bg-rose-500/15 text-xs text-rose-200">
              {error}
            </div>
          )}

          <div className="flex items-center justify-center gap-3 pt-1">
            {pendingRecovery ? (
              <TactileButton
                variant="primary"
                size="lg"
                onClick={handleUnwrap}
                disabled={claiming}
                icon={<RefreshCw className={`w-4 h-4 ${claiming ? 'animate-spin' : ''}`} />}
              >
                {claiming ? 'Recovering Gift...' : 'Complete Pending Gift Recovery'}
              </TactileButton>
            ) : alreadyClaimed ? (
              <div className="px-4 py-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-xs font-semibold text-emerald-300 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" />
                <span>Tonight’s Santa Gift Already Claimed — Return Tomorrow at 7:00 PM IST</span>
              </div>
            ) : (
              <TactileButton
                variant="primary"
                size="lg"
                onClick={handleUnwrap}
                disabled={!isWindowOpenNow || claiming}
                icon={<Sparkles className="w-4 h-4" />}
              >
                {claiming
                  ? 'Unwrapping Gift...'
                  : isWindowOpenNow
                  ? 'Unwrap Tonight’s Santa Gift'
                  : 'Locked Until 7:00 PM IST'}
              </TactileButton>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-slate-300">Pre-Claim Reward Drop Rates</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {tiers.map((t) => (
              <div
                key={t.rarity}
                className="rounded-xl border border-slate-800 bg-slate-950/50 p-3 flex items-center justify-between gap-2 text-xs"
              >
                <div className="min-w-0">
                  <p className="font-semibold text-slate-100">{t.rarity}</p>
                  <p className="text-[11px] text-slate-400 truncate">{t.label}</p>
                </div>
                <span className="font-mono font-bold tabular-nums text-sky-300 shrink-0">
                  {t.oddsPercent}%
                </span>
              </div>
            ))}
          </div>
        </div>

        {history.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-xs font-semibold text-slate-300">Recent Evening Drops</h4>
            <div className="max-h-36 overflow-y-auto divide-y divide-slate-800 rounded-xl border border-slate-800 bg-slate-950/40">
              {history.slice(0, 6).map((item) => (
                <div
                  key={item.id}
                  className="px-3 py-2 flex items-center justify-between gap-2 text-xs"
                >
                  <div className="min-w-0">
                    <span className="font-medium text-slate-200">{item.label}</span>
                    <span className="text-[11px] text-slate-400 ml-2 font-mono">
                      {item.eventNightKey || item.createdAt.slice(0, 10)}
                    </span>
                  </div>
                  <span className="text-[11px] font-mono tabular-nums text-emerald-400 shrink-0">
                    +{item.xpBonus} XP · {item.rarity}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </AnimatedDialog>
  );
};
