/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Interactive 8-Segment Winter Spin Wheel Modal
 * - Server-authoritative cryptographic reward roll
 * - Accurate GPU-composited wheel landing aligned to server `segmentIndex`
 * - Strict 2-hour cooldown timer + transparent pre-spin odds
 * - Silent-by-default sound cues unless user explicitly configured audio preferences
 * - Accessible aria-live result announcement
 */

import React, { useEffect, useState } from 'react';
import { useReducedMotion } from 'motion/react';
import { Clock, ShieldAlert, Volume2, VolumeX, RotateCw, CheckCircle2 } from 'lucide-react';
import { UserProfile } from '../../types';
import {
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
  const [ariaAnnouncement, setAriaAnnouncement] = useState<string>('');
  const [remainingMs, setRemainingMs] = useState<number>(0);

  const segments: SpinWheelSegmentSpec[] = winterStatus?.spinWheel?.segments || [];
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

    const cycleKey = winterStatus?.spinWheel?.nextEligibleAt || `ready_${Math.floor(Date.now() / 60000)}`;
    const idempotencyKey = `wheel_${cycleKey}_${Date.now()}`;
    const res = await spinWinterWheel(currentUser, idempotencyKey);

    if (!res.ok || !res.data?.success) {
      setSpinning(false);
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

    setRotationDeg((prev) => {
      const currentMod = ((prev % 360) + 360) % 360;
      const deltaToTarget = (desiredFinalModulo - currentMod + 360) % 360;
      const extraTurns = prefersReduced ? 0 : 6 * 360;
      return prev + extraTurns + deltaToTarget;
    });

    if (wheelAudioEnabled && !prefersReduced) {
      playWheelTickCue(wheelAudioEnabled);
      setTimeout(() => playWheelTickCue(wheelAudioEnabled), 700);
      setTimeout(() => playWheelTickCue(wheelAudioEnabled), 1500);
    }

    const settleDelay = prefersReduced ? 120 : 3450;
    setTimeout(async () => {
      const reward: WinterRewardRecord | null = res.data.reward || null;
      setSpinning(false);
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
    }, settleDelay);
  };

  const sliceAngle = segments.length > 0 ? 360 / segments.length : 45;

  return (
    <AnimatedDialog
      isOpen={isOpen}
      onClose={() => !spinning && onClose()}
      title="Winter Reward Spin Wheel"
      subtitle="Refreshes every 2 hours · Pure academic perks & seasonal collectibles"
      maxWidth="max-w-2xl"
    >
      <div className="space-y-5">
        <div className="sr-only" aria-live="polite">
          {ariaAnnouncement}
        </div>

        {isPreviewOnly && (
          <div className="p-3 rounded-xl border border-amber-500/40 bg-amber-500/10 text-xs text-amber-200 flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 shrink-0" />
            <span>Super Admin Preview Mode — Hidden from regular users while feature is OFF.</span>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-center">
          <div className="flex flex-col items-center gap-3">
            <div className="relative w-64 h-64 sm:w-72 sm:h-72 flex items-center justify-center">
              <div
                className="absolute -top-2 left-1/2 -translate-x-1/2 z-20 w-0 h-0 border-l-[10px] border-r-[10px] border-t-[18px] border-l-transparent border-r-transparent border-t-amber-400 drop-shadow"
                aria-hidden="true"
              />

              <div
                className="w-full h-full rounded-full border-4 border-sky-300/40 shadow-[0_0_30px_rgba(56,189,248,0.2)] overflow-hidden will-change-transform"
                style={{
                  transform: `rotate(${rotationDeg}deg)`,
                  transition: prefersReduced
                    ? 'transform 0.1s linear'
                    : 'transform 3.4s cubic-bezier(0.16, 1, 0.3, 1)',
                }}
              >
                <svg viewBox="0 0 240 240" className="w-full h-full">
                  {segments.map((seg, i) => {
                    const start = i * sliceAngle;
                    const end = (i + 1) * sliceAngle;
                    const mid = start + sliceAngle / 2;
                    const labelPos = polarToCartesian(120, 120, 74, mid);
                    return (
                      <g key={seg.id}>
                        <path
                          d={describeSlice(120, 120, 118, start, end)}
                          fill={seg.color}
                          stroke="rgba(255,255,255,0.22)"
                          strokeWidth="1.2"
                        />
                        <text
                          x={labelPos.x}
                          y={labelPos.y}
                          fill={seg.textColor || '#f8fafc'}
                          fontSize="9"
                          fontWeight="700"
                          textAnchor="middle"
                          dominantBaseline="middle"
                          transform={`rotate(${mid - 90}, ${labelPos.x}, ${labelPos.y})`}
                        >
                          {seg.shortLabel}
                        </text>
                      </g>
                    );
                  })}
                  <circle cx="120" cy="120" r="20" fill="#0f172a" stroke="#bae6fd" strokeWidth="2.5" />
                  <circle cx="120" cy="120" r="6" fill="#38bdf8" />
                </svg>
              </div>
            </div>

            <div className="flex items-center gap-3">
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
                  : 'Spin Winter Wheel'}
              </TactileButton>

              <button
                type="button"
                onClick={() => setWheelAudioEnabled((v) => !v)}
                className="p-2.5 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 transition-colors cursor-pointer"
                aria-label={wheelAudioEnabled ? 'Mute wheel audio cues' : 'Enable wheel audio cues'}
                title={wheelAudioEnabled ? 'Wheel audio cues ON' : 'Wheel audio cues silent'}
              >
                {wheelAudioEnabled ? <Volume2 className="w-4 h-4 text-sky-400" /> : <VolumeX className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-4">
            {resultReward ? (
              <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/15 p-4 space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-emerald-300">
                  <span>{resultReward.rarity} Reward Unlocked</span>
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                <p className="text-sm font-bold text-white">{resultReward.label}</p>
                <div className="flex flex-wrap gap-3 text-xs font-mono tabular-nums text-slate-200">
                  {resultReward.xpBonus > 0 && <span>+{resultReward.xpBonus} XP</span>}
                  {resultReward.cookiesBonus > 0 && (
                    <span className="inline-flex items-center gap-1">
                      <WinterCookieSvg size={13} /> +{resultReward.cookiesBonus} Cookies
                    </span>
                  )}
                  {resultReward.aiBonusQueries > 0 && (
                    <span>+{resultReward.aiBonusQueries} AI Queries</span>
                  )}
                  {resultReward.streakShield && (
                    <span className="inline-flex items-center gap-1 text-sky-300">
                      <FrostShieldSvg size={13} /> +1 Streak Shield
                    </span>
                  )}
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3.5 text-xs text-slate-300 flex items-center gap-2.5">
                <Clock className="w-4 h-4 text-sky-400 shrink-0" />
                {remainingMs > 0 ? (
                  <span>
                    Cooldown active · Ready in{' '}
                    <span className="font-mono font-bold tabular-nums text-sky-300">
                      {formatCountdownMs(remainingMs)}
                    </span>
                  </span>
                ) : (
                  <span>Your 2-hour Winter Wheel spin is ready now.</span>
                )}
              </div>
            )}

            {error && (
              <div className="p-3 rounded-xl border border-rose-500/40 bg-rose-500/15 text-xs text-rose-200">
                {error}
              </div>
            )}

            <div>
              <h4 className="text-xs font-semibold text-slate-300 mb-2">
                Transparent Pre-Spin Segment Odds
              </h4>
              <div className="max-h-44 overflow-y-auto divide-y divide-slate-800 rounded-xl border border-slate-800 bg-slate-950/50">
                {segments.map((seg) => (
                  <div
                    key={seg.id}
                    className="px-3 py-1.5 flex items-center justify-between gap-2 text-xs"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="w-2.5 h-2.5 rounded-sm shrink-0"
                        style={{ backgroundColor: seg.color }}
                      />
                      <span className="text-slate-200 truncate">{seg.label}</span>
                    </div>
                    <span className="font-mono font-semibold tabular-nums text-sky-300 shrink-0">
                      {seg.oddsPercent}%
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {history.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-slate-300 mb-1.5">Recent Spins</h4>
                <div className="max-h-24 overflow-y-auto space-y-1">
                  {history.slice(0, 4).map((item) => (
                    <div
                      key={item.id}
                      className="text-[11px] text-slate-400 flex items-center justify-between gap-2"
                    >
                      <span className="truncate">{item.label}</span>
                      <span className="font-mono tabular-nums text-emerald-400 shrink-0">
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
