/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Interactive 8-Segment Illustrated Winter Spin Wheel Modal
 * - Illustrated 8-segment reward wheel with metallic golden pegs at every slice boundary
 * - Instant-start spin with mathematically controlled 8-second deceleration curve:
 *     0–5s (~90.5% travel) -> 5–7s (gradual slow approach) -> 7–8s (final subtle crawl)
 * - Exact center-of-slice landing matching server-authoritative segmentIndex (zero overshoot)
 * - Boundary-derived spring pointer deflection & debounced mechanical Web Audio ticks
 * - Zero per-frame React state updates (direct DOM transform updates via requestAnimationFrame)
 * - Strict 2-hour cooldown timer, duplicate-spin prevention, & reduced-motion support
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import {
  Clock,
  ShieldAlert,
  Volume2,
  VolumeX,
  RotateCw,
  CheckCircle2,
  Sparkles,
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
import {
  buildResolvedSpinPlan,
  countPegBoundaryCrossings,
  evaluateLaunchPhase,
  evaluateResolvedSpinAngle,
  SPIN_DECEL_EXPONENT,
  SPIN_NOMINAL_EXTRA_TURNS,
  SPIN_TOTAL_DURATION_MS,
  SpinLaunchState,
  SpinResolvedPlan,
} from '../../lib/winterSpinPhysics';
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

// Deterministic seeded PRNG for reproducible confetti bursts
function mulberry32(seed: number) {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Confetti burst component for win celebration
const ConfettiBurst: React.FC<{ active: boolean; isLegendary?: boolean; reduced?: boolean }> = ({
  active,
  isLegendary = false,
  reduced = false,
}) => {
  const pieces = useMemo(() => {
    const rng = mulberry32(isLegendary ? 9187 : 4021);
    const count = isLegendary ? 34 : 24;
    const colors = isLegendary
      ? ['#fbbf24', '#f59e0b', '#f43f5e', '#38bdf8', '#a855f7', '#ffffff']
      : ['#38bdf8', '#34d399', '#fbbf24', '#f8fafc', '#f43f5e'];

    return Array.from({ length: count }).map((_, i) => {
      const angle = (i * 360) / count + (rng() * 18 - 9);
      const distance = 90 + rng() * 115;
      const rad = (angle * Math.PI) / 180;
      return {
        id: i,
        tx: Math.cos(rad) * distance,
        ty: Math.sin(rad) * distance + 40,
        color: colors[i % colors.length],
        size: 5 + rng() * 6,
        isRound: rng() > 0.55,
        aspect: rng() > 0.5 ? 1 : 1.85,
        rot: rng() * 360 - 180,
        duration: 1.25 + rng() * 0.55,
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
            scale: [0, 1.25, 0.85, 0],
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
  const prefersReduced = Boolean(useReducedMotion());
  const [wheelAudioEnabled, setWheelAudioEnabled] = useState<boolean>(() =>
    hasExplicitSoundPreference() ? isGlobalSoundEnabled() : false
  );
  const wheelAudioRef = useRef<boolean>(wheelAudioEnabled);
  wheelAudioRef.current = wheelAudioEnabled;

  const [spinning, setSpinning] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [resultReward, setResultReward] = useState<WinterRewardRecord | null>(null);
  const [winningSegmentIndex, setWinningSegmentIndex] = useState<number | null>(null);
  const [ariaAnnouncement, setAriaAnnouncement] = useState<string>('');
  const [remainingMs, setRemainingMs] = useState<number>(0);

  // Direct DOM refs for 60fps zero-rerender animation
  const wheelRef = useRef<HTMLDivElement | null>(null);
  const pointerRef = useRef<HTMLDivElement | null>(null);
  const rotationRef = useRef<number>(0);
  const pointerAngleRef = useRef<number>(0);
  const pointerVelRef = useRef<number>(0);
  const spinningRef = useRef<boolean>(false);
  const rafIdRef = useRef<number | null>(null);
  const mountedRef = useRef<boolean>(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
      spinningRef.current = false;
    };
  }, []);

  // Re-apply stored rotation cleanly when modal re-opens
  useEffect(() => {
    if (isOpen && wheelRef.current) {
      wheelRef.current.style.transform = `rotate(${rotationRef.current}deg)`;
    }
    if (isOpen && pointerRef.current) {
      pointerRef.current.style.transform = `rotate(${pointerAngleRef.current}deg)`;
    }
  }, [isOpen]);

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
    if (spinningRef.current || !isReady || segments.length === 0) return;

    spinningRef.current = true;
    setSpinning(true);
    setError(null);
    setResultReward(null);
    setWinningSegmentIndex(null);

    const cycleKey = winterStatus?.spinWheel?.nextEligibleAt || `ready_${Math.floor(Date.now() / 60000)}`;
    const idempotencyKey = `wheel_${cycleKey}_${Date.now()}`;

    const startTime = performance.now();
    let prevFrameTime = startTime;
    let prevAngle = rotationRef.current;

    const launchState: SpinLaunchState = {
      startAngle: rotationRef.current,
      nominalDelta: (prefersReduced ? 1 : SPIN_NOMINAL_EXTRA_TURNS) * 360,
      durationMs: SPIN_TOTAL_DURATION_MS,
      exponent: SPIN_DECEL_EXPONENT,
    };

    let resolvedPlan: SpinResolvedPlan | null = null;
    let resolvedReward: WinterRewardRecord | null = null;
    let resolvedSegIndex = 0;
    let apiFailed = false;

    // Fire server-authoritative spin request immediately in parallel with visual launch
    spinWinterWheel(currentUser, idempotencyKey)
      .then((res) => {
        if (!mountedRef.current || apiFailed) return;
        if (!res.ok || !res.data?.success) {
          apiFailed = true;
          if (rafIdRef.current !== null) {
            cancelAnimationFrame(rafIdRef.current);
            rafIdRef.current = null;
          }
          pointerAngleRef.current = 0;
          pointerVelRef.current = 0;
          if (pointerRef.current) {
            pointerRef.current.style.transform = 'rotate(0deg)';
          }
          spinningRef.current = false;
          setSpinning(false);
          setError(res.data?.error || 'Spin failed or cooldown is still active.');
          if (typeof res.data?.remainingMs === 'number') {
            setRemainingMs(res.data.remainingMs);
          }
          return;
        }

        resolvedSegIndex = Number(res.data.segmentIndex ?? 0);
        resolvedReward = res.data.reward || null;
        const resolvedAtMs = Math.max(16, performance.now() - startTime);
        resolvedPlan = buildResolvedSpinPlan({
          launch: launchState,
          resolvedAtMs,
          segmentIndex: resolvedSegIndex,
          segmentCount: segments.length,
          reducedMotion: prefersReduced,
        });
      })
      .catch((err) => {
        if (!mountedRef.current || apiFailed) return;
        apiFailed = true;
        if (rafIdRef.current !== null) {
          cancelAnimationFrame(rafIdRef.current);
          rafIdRef.current = null;
        }
        pointerAngleRef.current = 0;
        pointerVelRef.current = 0;
        if (pointerRef.current) {
          pointerRef.current.style.transform = 'rotate(0deg)';
        }
        spinningRef.current = false;
        setSpinning(false);
        setError(err?.message || 'Unable to reach spin server. Please try again.');
      });

    const step = (now: number) => {
      if (!mountedRef.current || apiFailed) return;

      const dt = Math.min(0.05, Math.max(0.001, (now - prevFrameTime) / 1000));
      prevFrameTime = now;
      const elapsedMs = now - startTime;

      let currentAngle = prevAngle;
      let finished = false;

      if (resolvedPlan) {
        const evalRes = evaluateResolvedSpinAngle(resolvedPlan, elapsedMs);
        currentAngle = evalRes.angle;
        finished = evalRes.finished;
      } else {
        currentAngle = evaluateLaunchPhase(launchState, elapsedMs).angle;
      }

      // Apply wheel transform directly without React re-render
      rotationRef.current = currentAngle;
      if (wheelRef.current) {
        wheelRef.current.style.transform = `rotate(${currentAngle}deg)`;
      }

      // Detect exact segment-boundary peg crossings
      const crossings = countPegBoundaryCrossings(prevAngle, currentAngle, segments.length);
      if (crossings > 0) {
        // Clockwise peg strikes downward pointer tip rightwards (-deg around top pivot)
        pointerAngleRef.current = prefersReduced ? -8 : -25;
        pointerVelRef.current = prefersReduced ? 0 : -140;
        if (wheelAudioRef.current && !prefersReduced) {
          playWheelTickCue(true, false);
        }
      }
      prevAngle = currentAngle;

      // Damped spring integration for mechanical pointer snap-back
      if (Math.abs(pointerAngleRef.current) > 0.05 || Math.abs(pointerVelRef.current) > 0.5) {
        const stiffness = 290;
        const damping = 21;
        const accel = -stiffness * pointerAngleRef.current - damping * pointerVelRef.current;
        pointerVelRef.current += accel * dt;
        pointerAngleRef.current += pointerVelRef.current * dt;
      } else {
        pointerAngleRef.current = 0;
        pointerVelRef.current = 0;
      }
      if (pointerRef.current) {
        pointerRef.current.style.transform = `rotate(${pointerAngleRef.current.toFixed(2)}deg)`;
      }

      if (!finished) {
        rafIdRef.current = requestAnimationFrame(step);
      } else {
        rafIdRef.current = null;
        // Lock exact final target angle with zero overshoot
        if (resolvedPlan) {
          rotationRef.current = resolvedPlan.targetAngle;
          if (wheelRef.current) {
            wheelRef.current.style.transform = `rotate(${resolvedPlan.targetAngle}deg)`;
          }
        }
        pointerAngleRef.current = 0;
        pointerVelRef.current = 0;
        if (pointerRef.current) {
          pointerRef.current.style.transform = 'rotate(0deg)';
        }

        if (wheelAudioRef.current && !prefersReduced) {
          playWheelTickCue(true, true);
        }

        spinningRef.current = false;
        setSpinning(false);
        setWinningSegmentIndex(resolvedSegIndex);
        setResultReward(resolvedReward);
        if (resolvedReward) {
          setAriaAnnouncement(
            `Winter Spin Wheel landed on ${resolvedReward.label}. Earned ${resolvedReward.xpBonus} XP and ${resolvedReward.cookiesBonus} Winter Cookies.`
          );
        }
        playWheelCelebrateCue(wheelAudioRef.current);
        onSpinComplete();
        window.dispatchEvent(new CustomEvent('veylentra-winter-updated'));
        window.dispatchEvent(new CustomEvent('studentos-gamification-updated'));
      }
    };

    rafIdRef.current = requestAnimationFrame(step);
  };

  const sliceAngle = 360 / segments.length;

  // 24 decorative outer bezel studs
  const rimStuds = useMemo(() => {
    return Array.from({ length: 24 }).map((_, i) => {
      const angle = (i * 360) / 24;
      return polarToCartesian(150, 150, 143, angle);
    });
  }, []);

  // 8 metallic pegs placed precisely on segment boundaries (0, 45, 90, ...)
  const boundaryPegs = useMemo(() => {
    return Array.from({ length: segments.length }).map((_, i) => {
      const angle = i * (360 / segments.length);
      return polarToCartesian(150, 150, 136, angle);
    });
  }, [segments.length]);

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
          isLegendary={resultReward?.rarity === 'legendary' || resultReward?.rarity === 'insane' || resultReward?.rarity === 'jackpot'}
          reduced={prefersReduced}
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
              {/* Outer Ambient Halo */}
              <motion.div
                className="absolute inset-0 rounded-full bg-gradient-to-tr from-sky-500/25 via-cyan-400/10 to-amber-400/25 blur-xl pointer-events-none"
                animate={
                  isReady && !spinning && !prefersReduced
                    ? { opacity: [0.55, 0.9, 0.55], scale: [0.98, 1.03, 0.98] }
                    : { opacity: 0.7, scale: 1 }
                }
                transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
              />

              {/* Top Mechanical Clapper Pointer (pivots smoothly around pin at y=8px) */}
              <div
                ref={pointerRef}
                className="absolute -top-3.5 left-1/2 -translate-x-1/2 z-30 will-change-transform"
                style={{
                  transformOrigin: '50% 9px',
                  filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.6))',
                }}
                aria-hidden="true"
              >
                <svg width="36" height="44" viewBox="0 0 36 44" fill="none">
                  <circle cx="18" cy="9" r="7.5" fill="#451a03" stroke="#fef08a" strokeWidth="2" />
                  <circle cx="18" cy="9" r="3.5" fill="#fbbf24" />
                  <path
                    d="M11 13 L25 13 L18 40 Z"
                    fill="url(#pointerGoldGrad)"
                    stroke="#fef08a"
                    strokeWidth="1.5"
                    strokeLinejoin="round"
                  />
                  <path d="M15 14 L21 14 L18 33 Z" fill="#fef08a" opacity="0.55" />
                  <defs>
                    <linearGradient id="pointerGoldGrad" x1="11" y1="13" x2="25" y2="40" gradientUnits="userSpaceOnUse">
                      <stop stopColor="#f59e0b" />
                      <stop offset="0.5" stopColor="#fde047" />
                      <stop offset="1" stopColor="#b45309" />
                    </linearGradient>
                  </defs>
                </svg>
              </div>

              {/* Rotating Illustrated Wheel (Direct DOM transform via requestAnimationFrame) */}
              <div
                ref={wheelRef}
                className="w-full h-full rounded-full shadow-[0_0_45px_rgba(56,189,248,0.28)] will-change-transform"
                style={{ transformOrigin: 'center center' }}
              >
                <svg viewBox="0 0 300 300" className="w-full h-full overflow-visible">
                  <defs>
                    <radialGradient id="rimGrad" cx="50%" cy="50%" r="50%">
                      <stop offset="84%" stopColor="#0f172a" />
                      <stop offset="93%" stopColor="#1e293b" />
                      <stop offset="97.5%" stopColor="#38bdf8" />
                      <stop offset="100%" stopColor="#0369a1" />
                    </radialGradient>
                    <radialGradient id="wheelDepthSheen" cx="38%" cy="32%" r="65%">
                      <stop offset="0%" stopColor="#ffffff" stopOpacity="0.18" />
                      <stop offset="55%" stopColor="#ffffff" stopOpacity="0.02" />
                      <stop offset="100%" stopColor="#020617" stopOpacity="0.28" />
                    </radialGradient>
                    <linearGradient id="hubGold" x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0%" stopColor="#fef08a" />
                      <stop offset="45%" stopColor="#f59e0b" />
                      <stop offset="100%" stopColor="#92400e" />
                    </linearGradient>
                    <filter id="shadowFilter" x="-15%" y="-15%" width="130%" height="130%">
                      <feDropShadow dx="0" dy="1" stdDeviation="1.4" floodColor="#000000" floodOpacity="0.85" />
                    </filter>
                  </defs>

                  {/* Outer Bezel */}
                  <circle cx="150" cy="150" r="149" fill="url(#rimGrad)" stroke="#38bdf8" strokeWidth="2.5" />
                  <circle cx="150" cy="150" r="138" fill="#090d16" stroke="#fbbf24" strokeWidth="1.8" strokeOpacity="0.7" />

                  {/* 24 Decorative Rim Studs */}
                  {rimStuds.map((stud, idx) => (
                    <circle
                      key={idx}
                      cx={stud.x}
                      cy={stud.y}
                      r="2.4"
                      fill="#fef08a"
                      stroke="#78350f"
                      strokeWidth="0.7"
                    />
                  ))}

                  {/* 8 Illustrated Segments */}
                  {segments.map((seg, i) => {
                    const start = i * sliceAngle;
                    const end = (i + 1) * sliceAngle;
                    const mid = start + sliceAngle / 2;
                    const labelPos = polarToCartesian(150, 150, 86, mid);
                    const iconPos = polarToCartesian(150, 150, 118, mid);
                    const isWinner = winningSegmentIndex === i;

                    return (
                      <g key={seg.id || i}>
                        <path
                          d={describeSlice(150, 150, 136, start, end)}
                          fill={seg.color}
                          stroke={isWinner ? '#fef08a' : '#ffffff'}
                          strokeWidth={isWinner ? '3.5' : '1.4'}
                          strokeOpacity={isWinner ? 1 : 0.35}
                        />
                        {isWinner && (
                          <path
                            d={describeSlice(150, 150, 136, start, end)}
                            fill="#fef08a"
                            fillOpacity="0.22"
                            className={prefersReduced ? '' : 'animate-pulse'}
                          />
                        )}
                        <line
                          x1="150"
                          y1="150"
                          x2={polarToCartesian(150, 150, 136, start).x}
                          y2={polarToCartesian(150, 150, 136, start).y}
                          stroke="#ffffff"
                          strokeWidth="1.4"
                          strokeOpacity="0.55"
                        />

                        {/* Segment Icon */}
                        <text
                          x={iconPos.x}
                          y={iconPos.y}
                          fontSize="14"
                          textAnchor="middle"
                          dominantBaseline="middle"
                          transform={`rotate(${mid}, ${iconPos.x}, ${iconPos.y})`}
                          filter="url(#shadowFilter)"
                        >
                          {SEGMENT_ICONS[seg.id] || '✨'}
                        </text>

                        {/* Segment Label */}
                        <text
                          x={labelPos.x}
                          y={labelPos.y}
                          fill={seg.textColor || '#ffffff'}
                          fontSize="10.5"
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

                  {/* Specular Depth Sheen Overlay */}
                  <circle cx="150" cy="150" r="136" fill="url(#wheelDepthSheen)" className="pointer-events-none" />

                  {/* 8 Physical Segment-Boundary Pegs that strike the top pointer */}
                  {boundaryPegs.map((peg, idx) => (
                    <g key={`peg_${idx}`}>
                      <circle cx={peg.x} cy={peg.y} r="4.2" fill="#78350f" />
                      <circle cx={peg.x} cy={peg.y} r="3.1" fill="#fde047" stroke="#fef9c3" strokeWidth="0.6" />
                    </g>
                  ))}

                  {/* Center Hub Medallion */}
                  <circle cx="150" cy="150" r="33" fill="#040711" stroke="url(#hubGold)" strokeWidth="4" />
                  <circle cx="150" cy="150" r="27" fill="#0f172a" stroke="#38bdf8" strokeWidth="1.5" />
                  <circle
                    cx="150"
                    cy="150"
                    r="21"
                    fill={spinning ? '#1d4ed8' : isReady ? '#2563eb' : '#1e293b'}
                    className={isReady && !prefersReduced ? 'animate-pulse cursor-pointer' : isReady ? 'cursor-pointer' : ''}
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
              </div>
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
            {resultReward ? (
              <motion.div
                initial={prefersReduced ? { opacity: 0 } : { opacity: 0, scale: 0.94, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                className="rounded-2xl border-2 border-emerald-400/60 bg-gradient-to-br from-emerald-950/80 via-slate-900 to-sky-950/70 p-5 space-y-3 shadow-xl shadow-emerald-500/10"
              >
                <div className="flex items-center justify-between text-xs font-black uppercase tracking-wider text-emerald-300">
                  <span className="flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-amber-300" />
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
                    className={`px-3 py-2 flex items-center justify-between gap-2 text-xs ${
                      winningSegmentIndex === seg.index ? 'bg-amber-500/15 text-amber-200 rounded-lg' : ''
                    }`}
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
