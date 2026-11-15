/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Nightly Santa Gift Modal (7:00 PM – 9:00 PM IST)
 * Enforces strict server window + 1-claim-per-night + transparent pre-claim odds
 * + atomic idempotency recovery without re-rolling.
 * + Super Admin Anytime Preview Experience without mutating real nightly claims or XP.
 * + Coordinated 3D Santa -> Hinged Lid Open -> Magic Glow & Sparkles -> Prize Reveal timeline.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { Clock, CheckCircle2, ShieldAlert, Sparkles, RefreshCw, Eye } from 'lucide-react';
import { UserProfile } from '../../types';
import { isSuperAdminRole } from '../../lib/featureAccessService';
import {
  claimSantaGift,
  formatCountdownMs,
  isGlobalSoundEnabled,
  playWheelCelebrateCue,
  WinterRewardRecord,
  WinterStatusResponse,
} from '../../lib/winterFestivalService';
import { fetchAIUsageStatus } from '../../lib/aiUsageManager';
import { AnimatedDialog, TactileButton } from '../ui/animatedComponents';
import { FrostShieldSvg, WinterCookieSvg } from './WinterArtwork';
import { Santa3DCanvas, SantaScenePhase } from './Santa3DCanvas';

interface SantaGiftModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserProfile;
  winterStatus: WinterStatusResponse | null;
  onRewardClaimed: () => Promise<void> | void;
  isPreviewOnly?: boolean;
}

const RARITY_STYLES: Record<string, string> = {
  common: 'border-slate-500/40 bg-slate-500/10 text-slate-200 shadow-none',
  rare: 'border-sky-400/60 bg-sky-500/15 text-sky-200 shadow-[0_0_24px_rgba(56,189,248,0.2)]',
  legendary: 'border-amber-400/70 bg-amber-500/15 text-amber-200 shadow-[0_0_28px_rgba(251,191,36,0.28)]',
  insane: 'border-rose-400/80 bg-gradient-to-br from-rose-500/25 via-amber-500/15 to-sky-500/20 text-rose-100 shadow-[0_0_32px_rgba(244,63,94,0.35)]',
};

function mulberry32(seed: number) {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const FallingSnowOverlay: React.FC<{ reduced?: boolean }> = ({ reduced = false }) => {
  const flakes = useMemo(() => {
    const rng = mulberry32(202612);
    return Array.from({ length: 16 }).map((_, i) => ({
      id: i,
      left: `${(rng() * 98 + 1).toFixed(1)}%`,
      size: 3 + rng() * 3.5,
      duration: 4.5 + rng() * 4.5,
      delay: rng() * 4,
      opacity: 0.25 + rng() * 0.45,
    }));
  }, []);

  if (reduced) return null;

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
      {flakes.map((f) => (
        <motion.div
          key={f.id}
          initial={{ y: -10, opacity: 0 }}
          animate={{ y: '105%', opacity: [0, f.opacity, f.opacity, 0] }}
          transition={{
            duration: f.duration,
            repeat: Infinity,
            delay: f.delay,
            ease: 'linear',
          }}
          style={{
            position: 'absolute',
            left: f.left,
            width: f.size,
            height: f.size,
            borderRadius: '50%',
            backgroundColor: '#e0f2fe',
            filter: 'blur(0.5px)',
          }}
        />
      ))}
    </div>
  );
};

const ConfettiBurst: React.FC<{ active: boolean; isLegendary?: boolean; reduced?: boolean }> = ({
  active,
  isLegendary = false,
  reduced = false,
}) => {
  const pieces = useMemo(() => {
    const rng = mulberry32(isLegendary ? 7771 : 3104);
    const count = isLegendary ? 40 : 24;
    const colors = isLegendary
      ? ['#fbbf24', '#f59e0b', '#f43f5e', '#38bdf8', '#a855f7', '#ffffff']
      : ['#38bdf8', '#34d399', '#fbbf24', '#f8fafc', '#f43f5e'];

    return Array.from({ length: count }).map((_, i) => {
      const angle = (i * 360) / count + (rng() * 18 - 9);
      const distance = 90 + rng() * 120;
      const rad = (angle * Math.PI) / 180;
      return {
        id: i,
        tx: Math.cos(rad) * distance,
        ty: Math.sin(rad) * distance + 40,
        color: colors[i % colors.length],
        size: 5 + rng() * 6,
        isRound: rng() > 0.5,
        aspect: rng() > 0.5 ? 1 : 1.9,
        rot: rng() * 360 - 180,
        duration: 1.35 + rng() * 0.5,
      };
    });
  }, [isLegendary]);

  if (!active || reduced) return null;

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-40 flex items-center justify-center">
      {pieces.map((p) => (
        <motion.div
          key={p.id}
          initial={{ x: 0, y: 0, scale: 0, opacity: 1, rotate: 0 }}
          animate={{
            x: p.tx,
            y: p.ty,
            scale: [0, 1.3, 0.85, 0],
            opacity: [1, 1, 0.85, 0],
            rotate: p.rot,
          }}
          transition={{ duration: p.duration, ease: [0.1, 1, 0.3, 1] }}
          style={{
            width: p.size,
            height: p.size * p.aspect,
            backgroundColor: p.color,
            borderRadius: p.isRound ? '50%' : '2px',
            position: 'absolute',
          }}
        />
      ))}
    </div>
  );
};

interface PendingRevealPayload {
  reward: WinterRewardRecord | null;
  recovered: boolean;
  isPreview: boolean;
}

export const SantaGiftModal: React.FC<SantaGiftModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  winterStatus,
  onRewardClaimed,
  isPreviewOnly = false,
}) => {
  const prefersReduced = Boolean(useReducedMotion());
  const [nowTick, setNowTick] = useState<number>(Date.now());
  const [serverOffsetMs, setServerOffsetMs] = useState<number>(0);
  const [claiming, setClaiming] = useState<boolean>(false);
  const [scenePhase, setScenePhase] = useState<SantaScenePhase>('idle');
  const [error, setError] = useState<string | null>(null);
  const [claimedReward, setClaimedReward] = useState<WinterRewardRecord | null>(null);
  const [wasRecovered, setWasRecovered] = useState<boolean>(false);
  const [wasSimulatedPreview, setWasSimulatedPreview] = useState<boolean>(false);

  const pendingRevealRef = useRef<PendingRevealPayload | null>(null);
  const mountedRef = useRef<boolean>(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const isSuperAdmin = isSuperAdminRole(currentUser?.role);

  useEffect(() => {
    if (winterStatus?.serverTime) {
      const parsed = Date.parse(winterStatus.serverTime);
      if (Number.isFinite(parsed)) {
        setServerOffsetMs(parsed - Date.now());
      }
    }
  }, [winterStatus?.serverTime]);

  useEffect(() => {
    if (!isOpen) {
      setClaiming(false);
      setScenePhase('idle');
      pendingRevealRef.current = null;
      return;
    }
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

  const handleRevealComplete = useCallback(async () => {
    if (!mountedRef.current) return;
    const payload = pendingRevealRef.current;
    pendingRevealRef.current = null;

    setScenePhase('revealed');
    setClaiming(false);

    if (!payload) return;

    setClaimedReward(payload.reward);
    setWasRecovered(payload.recovered);
    setWasSimulatedPreview(payload.isPreview);

    if (isGlobalSoundEnabled()) {
      playWheelCelebrateCue(true);
    }

    if (!payload.isPreview) {
      await onRewardClaimed();
      void fetchAIUsageStatus(currentUser?.uid || 'guest', currentUser?.role || 'student');
      window.dispatchEvent(new CustomEvent('veylentra-winter-updated'));
      window.dispatchEvent(new CustomEvent('studentos-gamification-updated'));
    }
  }, [onRewardClaimed]);

  const handleUnwrap = async (previewMode: boolean = false) => {
    if (claiming) return;

    setClaiming(true);
    setError(null);
    setWasSimulatedPreview(false);
    setClaimedReward(null);
    pendingRevealRef.current = null;
    setScenePhase('pending');

    const nightKey = santaWindow?.eventNightKey || new Date().toISOString().slice(0, 10);
    const idempotencyKey = previewMode ? `santa_preview_${Date.now()}` : `santa_${nightKey}`;

    try {
      const res = await claimSantaGift(currentUser, idempotencyKey, previewMode);
      if (!mountedRef.current) return;

      if (!res.ok || !res.data?.success) {
        setScenePhase('idle');
        setClaiming(false);
        setError(res.data?.error || 'Unable to unwrap tonight’s Santa Gift.');
        return;
      }

      // Server confirmed claim/preview -> trigger coordinated 3D Santa reach -> lid open -> magic glow -> prize reveal
      pendingRevealRef.current = {
        reward: res.data.reward || null,
        recovered: Boolean(res.data.recovered),
        isPreview: Boolean(res.data.isPreview),
      };
      setScenePhase('revealing');
    } catch (err: any) {
      if (!mountedRef.current) return;
      setScenePhase('idle');
      setClaiming(false);
      setError(err?.message || 'Unable to unwrap tonight’s Santa Gift.');
    }
  };

  const activeRarity = String(
    pendingRevealRef.current?.reward?.rarity || claimedReward?.rarity || 'common'
  ).toLowerCase();
  const isLegendaryWin = activeRarity === 'legendary' || activeRarity === 'insane' || activeRarity === 'rare';

  return (
    <AnimatedDialog
      isOpen={isOpen}
      onClose={() => !claiming && onClose()}
      title="Nightly Santa Gift Drop"
      subtitle="Opens nightly from 7:00 PM to 9:00 PM IST · One verified gift per evening"
      maxWidth="max-w-xl"
    >
      <div className="space-y-5 relative overflow-hidden">
        <FallingSnowOverlay reduced={prefersReduced} />
        <ConfettiBurst active={Boolean(claimedReward)} isLegendary={isLegendaryWin} reduced={prefersReduced} />

        {(isPreviewOnly || (isSuperAdmin && !isWindowOpenNow)) && (
          <div className="p-3 rounded-xl border border-amber-500/40 bg-amber-500/10 text-xs text-amber-200 flex items-center gap-2.5 z-10 relative">
            <ShieldAlert className="w-4 h-4 shrink-0 text-amber-300" />
            <span>
              {isPreviewOnly
                ? 'Super Admin Feature Preview — Regular users cannot see Santa Gifts while the feature toggle is OFF.'
                : 'Super Admin Testing Access — Regular users see the 7:00 PM – 9:00 PM IST lock. You can preview the full unwrap experience anytime without altering real claims or XP.'}
            </span>
          </div>
        )}

        <div className="rounded-2xl border border-slate-800 bg-gradient-to-b from-slate-950/90 to-sky-950/30 p-5 text-center space-y-4 relative overflow-hidden z-10">
          <div className="winter-candy-divider" />

          {/* Immersive 3D Santa & Hinged Gift Box Canvas */}
          <div className="w-full h-64 relative rounded-xl overflow-hidden bg-gradient-to-b from-slate-900/50 to-slate-950/85 border border-slate-800/60 shadow-inner">
            <Santa3DCanvas
              phase={scenePhase}
              isOpen={isOpen}
              prefersReducedMotion={prefersReduced}
              isLegendaryWin={isLegendaryWin}
              onRevealComplete={handleRevealComplete}
            />
          </div>

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
              initial={prefersReduced ? { opacity: 0 } : { opacity: 0, scale: 0.92, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              className={`rounded-2xl border p-4 text-left space-y-2 transition-all ${
                RARITY_STYLES[String(claimedReward.rarity || 'common').toLowerCase()] || RARITY_STYLES.common
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-black uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  {claimedReward.rarity} Drop{' '}
                  {wasSimulatedPreview ? '· Preview Simulation' : wasRecovered ? '· Recovered' : '· Claimed'}
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
              {wasSimulatedPreview && (
                <p className="text-[11px] text-amber-200/90 pt-1">
                  Super Admin simulation complete — your real nightly claim and XP balance remain untouched.
                </p>
              )}
            </motion.div>
          )}

          {error && (
            <div className="p-3 rounded-xl border border-rose-500/40 bg-rose-500/15 text-xs text-rose-200">
              {error}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
            {pendingRecovery ? (
              <TactileButton
                variant="primary"
                size="lg"
                onClick={() => handleUnwrap(false)}
                disabled={claiming}
                icon={<RefreshCw className={`w-4 h-4 ${claiming ? 'animate-spin' : ''}`} />}
              >
                {claiming ? 'Recovering Gift...' : 'Complete Pending Gift Recovery'}
              </TactileButton>
            ) : alreadyClaimed ? (
              <>
                <div className="px-4 py-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-xs font-semibold text-emerald-300 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Tonight’s Santa Gift Already Claimed — Return Tomorrow at 7:00 PM IST</span>
                </div>
                {isSuperAdmin && (
                  <TactileButton
                    variant="secondary"
                    size="md"
                    onClick={() => handleUnwrap(true)}
                    disabled={claiming}
                    icon={<Eye className="w-4 h-4" />}
                  >
                    {claiming ? 'Opening Gift...' : 'Simulate Another Preview Drop'}
                  </TactileButton>
                )}
              </>
            ) : isWindowOpenNow ? (
              <TactileButton
                variant="primary"
                size="lg"
                onClick={() => handleUnwrap(false)}
                disabled={claiming}
                icon={<Sparkles className="w-4 h-4" />}
              >
                {claiming ? 'Unwrapping Gift...' : 'Unwrap Tonight’s Santa Gift'}
              </TactileButton>
            ) : isSuperAdmin ? (
              <TactileButton
                variant="primary"
                size="lg"
                onClick={() => handleUnwrap(true)}
                disabled={claiming}
                icon={<Eye className="w-4 h-4" />}
              >
                {claiming ? 'Opening Preview...' : 'Preview Santa Experience (Admin)'}
              </TactileButton>
            ) : (
              <TactileButton
                variant="primary"
                size="lg"
                onClick={() => {}}
                disabled={true}
                icon={<Clock className="w-4 h-4" />}
              >
                Locked Until 7:00 PM IST
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
                  <p className="font-semibold text-slate-100 capitalize">{t.rarity}</p>
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
                  <span className="text-[11px] font-mono tabular-nums text-emerald-400 shrink-0 capitalize">
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
