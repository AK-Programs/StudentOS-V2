/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Interactive 8-Segment Illustrated Winter Spin Wheel Modal
 * - Illustrated 8-segment reward wheel with decorative studded golden rim
 * - Server-authoritative cryptographic reward roll & accurate GPU physics landing
 * - Central tactile "SPIN" button with pulse animation & idle breathing motion
 * - Top 3D pointer with dynamic deflection spring motion
 * - Strict 2-hour cooldown timer & transparent pre-spin odds
 * - Silent-by-default audio cues with toggle
 * - Energetic celebration card with confetti on win
 */

import React, { useEffect, useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import {
  Clock,
  ShieldAlert,
  Volume2,
  VolumeX,
  RotateCw,
  CheckCircle2,
  Sparkles,
  Trophy,
  Crown,
  Zap,
  Award
} from 'lucide-react';
import { UserProfile } from '../../types';
import {
  DEFAULT_SPIN_SEGMENTS,
  formatCountdownMs,
  hasExplicitSoundPreference,
  isGlobalSoundEnabled,
  playWheelCelebrateCue,
  playWheelTickCue,
  SpinWheelSegmentSpec,
  spinWinterWheel,
  WinterRewardRecord,
  WinterStatusResponse,
} from '../../lib/winterFestivalService';
import { AnimatedDialog, TactileButton } from '../ui/animatedComponents';
import { FrostShieldSvg, WinterCookieSvg } from './WinterArtwork';

interface SpinWheelModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserProfile;
  winterStatus: WinterStatusResponse | null;
  onSpinComplete: () => Promise<void> | void;
  isPreviewOnly?: boolean;
}

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return {
    x: cx + r * Math.cos(rad),
    y: cy + r * Math.sin(rad),
  };
}

function describeSlice(cx: number, cy: number, r: number, startAngle: number, endAngle: number) {
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const largeArc = endAngle - startAngle <= 180 ? '0' : '1';
  return ['M', cx, cy, 'L', start.x, start.y, 'A', r, r, 0, largeArc, 0, end.x, end.y, 'Z'].join(' ');
}

// Confetti burst component for win celebration
const ConfettiBurst: React.FC<{ active: boolean; isLegendary?: boolean }> = ({ active, isLegendary = false }) => {
  if (!active) return null;
  const count = isLegendary ? 35 : 25;
  const colors = isLegendary
    ? ['#fbbf24', '#f59e0b', '#f43f5e', '#38bdf8', '#a855f7', '#ffffff']
    : ['#38bdf8', '#34d399', '#fbbf24', '#f8fafc', '#f43f5e'];

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-40 flex items-center justify-center">
      {Array.from({ length: count }).map((_, i) => {
        const angle = (i * 360) / count + (Math.random() * 20 - 10);
        const distance = 90 + Math.random() * 110;
        const rad = (angle * Math.PI) / 180;
        const tx = Math.cos(rad) * distance;
        const ty = Math.sin(rad) * distance;
        const color = colors[i % colors.length];
        const size = 5 + Math.random() * 6;
        return (
          <motion.div
            key={i}
            initial={{ x: 0, y: 0, scale: 0, opacity: 1, rotate: 0 }}
            animate={{
              x: tx,
              y: ty + 40,
              scale: [0, 1.25, 0.8, 0],
              opacity: [1, 1, 0.8, 0],
              rotate: Math.random() * 360 - 180,
            }}
            transition={{ duration: 1.3 + Math.random() * 0.6, ease: [0.1, 1, 0.3, 1] }}
            style={{
              width: size,
              height: size * (Math.random() > 0.5 ? 1 : 2),
              backgroundColor: color,
              borderRadius: Math.random() > 0.5 ? '50%' : '2px',
              position: 'absolute',
            }}
          />
        );
      })}
    </div>
  );
};

// Visual icons for wheel segments
const SEGMENT_ICONS: Record<string, string> = {
  xp_25: '⚡',
  cookies_3: '🍪',
  xp_50: '🏆',
  ai_boost_2: '🧠',
  xp_100: '⭐',
  streak_shield: '🛡️',
  cookies_6: '🍪',
  frost_jackpot: '👑',
};

export const SpinWheelModal: React.FC<SpinWheelModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  winterStatus,
  onSpinComplete,
  isPreviewOnly = false,
}) => {
  const prefersReduced = useReducedMotion();
  const [wheelAudioEnabled, setWheelAudioEnabled] = useState<boolean>(() =>
    hasExplicitSoundPreference() ? isGlobalSoundEnabled() : false
  );
  const [rotationDeg, setRotationDeg] = useState<number>(0);
  const [spinning, setSpinning] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [resultReward, setResultReward] = useState<WinterRewardRecord | null>(null);
  const [winningSegmentIndex, setWinningSegmentIndex] = useState<number | null>(null);
  const [ariaAnnouncement, setAriaAnnouncement] = useState<string>('');
  const [remainingMs, setRemainingMs] = useState<number>(0);
  const [pointerDeflected, setPointerDeflected] = useState<boolean>(false);

  // Guarantee 8 segments even during loading/offline states
  const rawSegments = winterStatus?.spinWheel?.segments;
  const segments: SpinWheelSegmentSpec[] = useMemo(() => {
    if (Array.isArray(rawSegments) && rawSegments.length >= 8) {
      return rawSegments;
    }
    return DEFAULT_SPIN_SEGMENTS;
  }, [rawSegments]);

  const history = (winterStatus?.winterState?.rewardHistory || []).filter(
    (h) => h.featureType === 'spin_wheel'
  );

  useEffect(() => {
    const nextIso = winterStatus?.spinWheel?.nextEligibleAt;
    if (!nextIso) {
      setRemainingMs(0);
      return;
    }
    const update = () => {
      const diff = Math.max(0, Date.parse(nextIso) - Date.now());
      setRemainingMs(diff);
    };
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, [winterStatus?.spinWheel?.nextEligibleAt, isOpen]);

  const isReady = remainingMs <= 0 && !spinning;

  const handleSpin = async () => {
    if (!isReady || segments.length === 0) return;
    setSpinning(true);
    setError(null);
    setResultReward(null);
    setWinningSegmentIndex(null);

    const spinStartTime = Date.now();
    const cycleKey = winterStatus?.spinWheel?.nextEligibleAt || `ready_${Math.floor(Date.now() / 60000)}`;
    const idempotencyKey = `wheel_${cycleKey}_${Date.now()}`;

    // 1. Start spinning immediately on tap without waiting for API
    const initialSpinTurns = 5;
    setRotationDeg((prev) => prev + initialSpinTurns * 360);

    // Pointer tick flutter on every peg
    let tickInterval: any = null;
    if (!prefersReduced) {
      tickInterval = setInterval(() => {
        setPointerDeflected((p) => !p);
        if (wheelAudioEnabled) {
          playWheelTickCue(wheelAudioEnabled);
        }
      }, 110);
    }

    // 2. Call API in parallel
    const res = await spinWinterWheel(currentUser, idempotencyKey);

    // 6. If API fails, stop wheel and show error
    if (!res.ok || !res.data?.success) {
      if (tickInterval) clearInterval(tickInterval);
      setSpinning(false);
      setPointerDeflected(false);
      setError(res.data?.error || 'Spin failed or cooldown is still active.');
      if (typeof res.data?.remainingMs === 'number') {
        setRemainingMs(res.data.remainingMs);
      }
      return;
    }

    const segIdx = Number(res.data.segmentIndex ?? 0);
    const sliceDeg = 360 / segments.length;
    const centerOfSlice = segIdx * sliceDeg + sliceDeg / 2;
    const desiredFinalModulo = (360 - centerOfSlice) % 360;

    // 2. Ensure total spin duration is at least 4 seconds with slow ease out
    const elapsed = Date.now() - spinStartTime;
    const minSpinMs = 4200;
    const remainingSpinMs = Math.max(500, minSpinMs - elapsed);

    setRotationDeg((prev) => {
      const currentMod = ((prev % 360) + 360) % 360;
      const deltaToTarget = (desiredFinalModulo - currentMod + 360) % 360;
      const extraTurns = prefersReduced ? 0 : 6 * 360;
      return prev + extraTurns + deltaToTarget;
    });

    setTimeout(async () => {
      if (tickInterval) clearInterval(tickInterval);
      setPointerDeflected(false);
      const reward: WinterRewardRecord | null = res.data.reward || null;
      setSpinning(false);
      setWinningSegmentIndex(segIdx);
      setResultReward(reward);
      if (reward) {
        setAriaAnnouncement(
          `Winter Spin Wheel landed on ${reward.label}. Earned ${reward.xpBonus} XP and ${reward.cookiesBonus} Winter Cookies.`
        );
      }
      playWheelCelebrateCue(wheelAudioEnabled);
      await onSpinComplete();
      window.dispatchEvent(new CustomEvent('veylentra-winter-updated'));
      window.dispatchEvent(new CustomEvent('studentos-gamification-updated'));
    }, remainingSpinMs);
  };

  const sliceAngle = 360 / segments.length;

  // Outer golden studs coordinates (24 studs along rim)
  const rimStuds = useMemo(() => {
    return Array.from({ length: 24 }).map((_, i) => {
      const angle = (i * 360) / 24;
      return polarToCartesian(150, 150, 142, angle);
    });
  }, []);

  return (
    <AnimatedDialog
      isOpen={isOpen}
      onClose={() => !spinning && onClose()}
      title="Winter Reward Spin Wheel"
      subtitle="Refreshes every 2 hours · Pure academic perks & seasonal collectibles"
      maxWidth="max-w-2xl"
    >
      <div className="space-y-5 relative">
        <ConfettiBurst
          active={Boolean(resultReward)}
          isLegendary={resultReward?.rarity === 'legendary' || resultReward?.rarity === 'insane'}
        />
        <div className="sr-only" aria-live="polite">
          {ariaAnnouncement}
        </div>

        {isPreviewOnly && (
          <div className="p-3 rounded-xl border border-amber-500/40 bg-amber-500/10 text-xs text-amber-200 flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 shrink-0" />
            <span>Super Admin Preview Mode — Hidden from regular users while feature is OFF.</span>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
          {/* Wheel Assembly */}
          <div className="flex flex-col items-center gap-4">
            <div className="relative w-72 h-72 sm:w-80 sm:h-80 flex items-center justify-center select-none">
              {/* Outer Glow Halo */}
              <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-sky-500/20 via-cyan-400/10 to-amber-400/20 blur-xl pointer-events-none" />

              {/* 3D Top Pointer with spring deflection */}
              <div
                className={`absolute -top-3 left-1/2 -translate-x-1/2 z-30 transition-transform duration-100 ${
                  pointerDeflected ? 'rotate-6 scale-105' : 'rotate-0'
                }`}
                style={{ filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.5))' }}
                aria-hidden="true"
              >
                <svg width="34" height="42" viewBox="0 0 34 42" fill="none">
                  {/* Pointer Pin base */}
                  <circle cx="17" cy="8" r="7" fill="#78350f" stroke="#fef08a" strokeWidth="2" />
                  <circle cx="17" cy="8" r="3.5" fill="#f59e0b" />
                  {/* Golden Arrow Wedge pointing down */}
                  <path
                    d="M10 12 L24 12 L17 38 Z"
                    fill="url(#pointerGoldGrad)"
                    stroke="#fef08a"
                    strokeWidth="1.5"
                  />
                  {/* Inner shine */}
                  <path d="M14 13 L20 13 L17 32 Z" fill="#fef08a" opacity="0.6" />
                  <defs>
                    <linearGradient id="pointerGoldGrad" x1="10" y1="12" x2="24" y2="38" gradientUnits="userSpaceOnUse">
                      <stop stopColor="#f59e0b" />
                      <stop offset="0.5" stopColor="#fbbf24" />
                      <stop offset="1" stopColor="#d97706" />
                    </linearGradient>
                  </defs>
                </svg>
              </div>

              {/* Rotating Illustrated Wheel */}
              <motion.div
                className="w-full h-full rounded-full shadow-[0_0_40px_rgba(56,189,248,0.25)] will-change-transform"
                animate={
                  isReady && !spinning && !prefersReduced
                    ? { rotate: [rotationDeg - 1.2, rotationDeg + 1.2, rotationDeg - 1.2] }
                    : { rotate: rotationDeg }
                }
                transition={
                  isReady && !spinning && !prefersReduced
                    ? { duration: 3.5, repeat: Infinity, ease: 'easeInOut' }
                    : {
                        duration: prefersReduced ? 0.1 : 3.4,
                        ease: [0.16, 1, 0.3, 1],
                      }
                }
                style={{
                  transformOrigin: 'center center',
                }}
              >
                <svg viewBox="0 0 300 300" className="w-full h-full overflow-visible">
                  <defs>
                    {/* Radial background rim gradient */}
                    <radialGradient id="rimGrad" cx="50%" cy="50%" r="50%">
                      <stop offset="85%" stopColor="#0f172a" />
                      <stop offset="94%" stopColor="#1e293b" />
                      <stop offset="98%" stopColor="#38bdf8" />
                      <stop offset="100%" stopColor="#0284c7" />
                    </radialGradient>
                    {/* Center hub gold gradient */}
                    <linearGradient id="hubGold" x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0%" stopColor="#fef08a" />
                      <stop offset="50%" stopColor="#f59e0b" />
                      <stop offset="100%" stopColor="#b45309" />
                    </linearGradient>
                    <filter id="shadowFilter" x="-10%" y="-10%" width="120%" height="120%">
                      <feDropShadow dx="0" dy="1" stdDeviation="1.5" floodColor="#000000" floodOpacity="0.8" />
                    </filter>
                  </defs>

                  {/* Outer Rim Ring */}
                  <circle cx="150" cy="150" r="148" fill="url(#rimGrad)" stroke="#38bdf8" strokeWidth="3" />
                  <circle cx="150" cy="150" r="138" fill="#090d16" stroke="#fbbf24" strokeWidth="2" strokeDasharray="3 3" />

                  {/* 24 Golden Decorative Rim Studs */}
                  {rimStuds.map((stud, idx) => (
                    <circle
                      key={idx}
                      cx={stud.x}
                      cy={stud.y}
                      r="2.8"
                      fill="#fef08a"
                      stroke="#854d0e"
                      strokeWidth="0.8"
                    />
                  ))}

                  {/* 8 Illustrated Segments */}
                  {segments.map((seg, i) => {
                    const start = i * sliceAngle;
                    const end = (i + 1) * sliceAngle;
                    const mid = start + sliceAngle / 2;
                    const labelPos = polarToCartesian(150, 150, 96, mid);
                    const iconPos = polarToCartesian(150, 150, 122, mid);
                    const isWinner = winningSegmentIndex === i;

                    return (
                      <g key={seg.id || i} className={isWinner ? 'animate-pulse' : ''}>
                        {/* Segment Wedge */}
                        <path
                          d={describeSlice(150, 150, 137, start, end)}
                          fill={seg.color}
                          stroke="#ffffff"
                          strokeWidth={isWinner ? '3' : '1.5'}
                          strokeOpacity={isWinner ? 0.95 : 0.35}
                        />

                        {/* Wedge inner highlight divider */}
                        <line
                          x1="150"
                          y1="150"
                          x2={polarToCartesian(150, 150, 137, start).x}
                          y2={polarToCartesian(150, 150, 137, start).y}
                          stroke="#ffffff"
                          strokeWidth="1.2"
                          strokeOpacity="0.4"
                        />

                        {/* Segment Icon */}
                        <text
                          x={iconPos.x}
                          y={iconPos.y}
                          fontSize="13"
                          textAnchor="middle"
                          dominantBaseline="middle"
                          transform={`rotate(${mid}, ${iconPos.x}, ${iconPos.y})`}
                          filter="url(#shadowFilter)"
                        >
                          {SEGMENT_ICONS[seg.id] || '✨'}
                        </text>

                        {/* Segment Text Label */}
                        <text
                          x={labelPos.x}
                          y={labelPos.y}
                          fill={seg.textColor || '#ffffff'}
                          fontSize="11"
                          fontWeight="800"
                          fontFamily="sans-serif"
                          letterSpacing="0.02em"
                          textAnchor="middle"
                          dominantBaseline="middle"
                          transform={`rotate(${mid - 90}, ${labelPos.x}, ${labelPos.y})`}
                          filter="url(#shadowFilter)"
                        >
                          {seg.shortLabel}
                        </text>
                      </g>
                    );
                  })}

                  {/* Center Hub Housing */}
                  <circle cx="150" cy="150" r="32" fill="#040711" stroke="url(#hubGold)" strokeWidth="3.5" />
                  <circle cx="150" cy="150" r="26" fill="#0f172a" stroke="#38bdf8" strokeWidth="1.5" />
                  
                  {/* Central Tactile SPIN Icon & Glow */}
                  <circle
                    cx="150"
                    cy="150"
                    r="20"
                    fill={isReady ? '#2563eb' : '#1e293b'}
                    className={isReady ? 'animate-pulse cursor-pointer' : ''}
                    onClick={isReady ? handleSpin : undefined}
                  />
                  <text
                    x="150"
                    y="151"
                    fill="#ffffff"
                    fontSize="9.5"
                    fontWeight="900"
                    letterSpacing="0.08em"
                    textAnchor="middle"
                    dominantBaseline="middle"
                    className="select-none pointer-events-none"
                  >
                    {spinning ? 'SPIN' : isReady ? 'SPIN!' : 'LOCK'}
                  </text>
                </svg>
              </motion.div>
            </div>

            {/* Spin CTA Controls */}
            <div className="flex items-center gap-3 w-full justify-center">
              <TactileButton
                variant="primary"
                size="lg"
                onClick={handleSpin}
                disabled={!isReady || segments.length === 0}
                icon={<RotateCw className={`w-4 h-4 ${spinning ? 'animate-spin' : ''}`} />}
              >
                {spinning
                  ? 'Spinning Wheel...'
                  : remainingMs > 0
                  ? `Next Spin in ${formatCountdownMs(remainingMs)}`
                  : 'Spin Winter Wheel Now'}
              </TactileButton>

              <button
                type="button"
                onClick={() => setWheelAudioEnabled((v) => !v)}
                className="p-3 rounded-2xl border border-slate-800 bg-slate-900/80 hover:bg-slate-800 text-slate-300 transition-colors cursor-pointer"
                aria-label={wheelAudioEnabled ? 'Mute wheel audio cues' : 'Enable wheel audio cues'}
                title={wheelAudioEnabled ? 'Wheel audio cues ON' : 'Wheel audio cues silent'}
              >
                {wheelAudioEnabled ? <Volume2 className="w-4 h-4 text-sky-400" /> : <VolumeX className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Right Column: Status, Won Reward, and Pre-Spin Odds */}
          <div className="space-y-4">
            {/* Rewarded Celebration Card */}
            {resultReward ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                className="rounded-2xl border-2 border-emerald-400/60 bg-gradient-to-br from-emerald-950/80 via-slate-900 to-sky-950/70 p-5 space-y-3 shadow-xl shadow-emerald-500/10"
              >
                <div className="flex items-center justify-between text-xs font-black uppercase tracking-wider text-emerald-300">
                  <span className="flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-amber-300 animate-spin" />
                    {resultReward.rarity} Win Unlocked!
                  </span>
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                </div>
                <h4 className="text-base font-black text-white">{resultReward.label}</h4>
                <div className="flex flex-wrap gap-2.5 text-xs font-mono tabular-nums text-slate-200">
                  {resultReward.xpBonus > 0 && (
                    <span className="px-2.5 py-1 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-bold">
                      +{resultReward.xpBonus} XP
                    </span>
                  )}
                  {resultReward.cookiesBonus > 0 && (
                    <span className="px-2.5 py-1 rounded-lg bg-rose-500/20 border border-rose-500/40 text-rose-300 font-bold inline-flex items-center gap-1">
                      <WinterCookieSvg size={13} /> +{resultReward.cookiesBonus} Cookies
                    </span>
                  )}
                  {resultReward.aiBonusQueries > 0 && (
                    <span className="px-2.5 py-1 rounded-lg bg-indigo-500/20 border border-indigo-500/40 text-indigo-300 font-bold">
                      +{resultReward.aiBonusQueries} Daily AI Boost
                    </span>
                  )}
                  {resultReward.streakShield && (
                    <span className="px-2.5 py-1 rounded-lg bg-sky-500/20 border border-sky-500/40 text-sky-300 font-bold inline-flex items-center gap-1">
                      <FrostShieldSvg size={13} /> +1 Streak Shield
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Rewards have been authoritatively recorded to your Scholar XP ledger and synced with your school profile.
                </p>
              </motion.div>
            ) : (
              <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4 text-xs text-slate-300 flex items-center gap-3">
                <Clock className="w-5 h-5 text-sky-400 shrink-0" />
                {remainingMs > 0 ? (
                  <div>
                    <p className="font-bold text-white">2-Hour Cooldown In Progress</p>
                    <p className="text-slate-400 text-[11px] mt-0.5">
                      Ready in{' '}
                      <span className="font-mono font-bold tabular-nums text-sky-300">
                        {formatCountdownMs(remainingMs)}
                      </span>
                    </p>
                  </div>
                ) : (
                  <div>
                    <p className="font-bold text-emerald-400">Ready to Spin!</p>
                    <p className="text-slate-400 text-[11px] mt-0.5">
                      Press Spin to roll verified academic rewards.
                    </p>
                  </div>
                )}
              </div>
            )}

            {error && (
              <div className="p-3 rounded-xl border border-rose-500/40 bg-rose-500/15 text-xs text-rose-200">
                {error}
              </div>
            )}

            {/* Transparent Segment Odds Table */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                  Transparent Segment Odds
                </h4>
                <span className="text-[10px] text-slate-500 font-mono">100% Academic Perks</span>
              </div>
              <div className="max-h-48 overflow-y-auto divide-y divide-slate-800/80 rounded-2xl border border-slate-800 bg-slate-950/60 p-1">
                {segments.map((seg) => (
                  <div
                    key={seg.id || seg.index}
                    className="px-3 py-2 flex items-center justify-between gap-2 text-xs"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        className="w-3 h-3 rounded-full shrink-0 shadow-sm"
                        style={{ backgroundColor: seg.color }}
                      />
                      <span className="text-slate-200 font-medium truncate">{seg.label}</span>
                    </div>
                    <span className="font-mono font-bold tabular-nums text-sky-300 shrink-0">
                      {seg.oddsPercent}%
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Recent Spins History */}
            {history.length > 0 && (
              <div>
                <h4 className="text-xs font-bold text-slate-400 mb-1.5 uppercase tracking-wider">
                  Recent Spin Rolls
                </h4>
                <div className="max-h-24 overflow-y-auto space-y-1">
                  {history.slice(0, 3).map((item) => (
                    <div
                      key={item.id}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-900/60 border border-slate-800/60 text-[11px] text-slate-400 flex items-center justify-between gap-2"
                    >
                      <span className="truncate">{item.label}</span>
                      <span className="font-mono tabular-nums text-emerald-400 font-bold shrink-0">
                        +{item.xpBonus} XP
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </AnimatedDialog>
  );
};
